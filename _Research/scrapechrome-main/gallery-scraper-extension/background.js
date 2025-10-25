// background.js - Gallery Scraper Pro Background Service Worker
// Handles downloads, network monitoring, state management, and coordination

// ============================================================================
// GLOBAL STATE MANAGEMENT
// ============================================================================

let isScrapingActive = false;
let isScrapingPaused = false;
let currentScrapeMode = 'single'; // 'single' or 'all'
let activeTabId = null;
let currentPageUrl = '';

// Data storage
let allScrapedThumbnails = [];
let allScrapedDestinations = [];
let allFailedExtractions = [];
let downloadedFilenames = new Map(); // For duplicate handling
let scrapeLog = [];

// Download queue management
let downloadQueue = [];
let activeDownloads = 0;
let downloadSettings = {
    maxConcurrentDownloads: 5,
    downloadFolder: ''
};

// Network monitoring
let activeRequests = new Map();
let pageIdleResolvers = new Map();

// Cleanup old requests every 30 seconds
setInterval(() => {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    
    for (const [requestId, request] of activeRequests.entries()) {
        if (now - request.timestamp > timeout) {
            activeRequests.delete(requestId);
        }
    }
}, 30000);

// ============================================================================
// LOGGING SYSTEM
// ============================================================================

/**
 * Log events with timestamp and context
 * @param {string} message - Log message
 * @param {string} type - Log type (info, warn, error, success)
 * @param {string} url - Current page URL
 */
function logEvent(message, type = 'info', url = '') {
    const logEntry = {
        timestamp: Date.now(),
        type,
        message,
        url: url || currentPageUrl,
        domain: url ? new URL(url).hostname : ''
    };
    
    scrapeLog.push(logEntry);
    
    // Keep only last 1000 log entries
    if (scrapeLog.length > 1000) {
        scrapeLog = scrapeLog.slice(-1000);
    }
    
    // Save to storage
    chrome.storage.local.set({ scrapeLog });
    
    // Send to popup if connected
    sendToPopup({
        action: 'logUpdate',
        logEntry
    });
    
    console.log(`[Gallery Scraper BG] [${type.toUpperCase()}] ${message}`);
}

// ============================================================================
// DOWNLOAD MANAGEMENT
// ============================================================================

/**
 * Generate unique filename to handle duplicates
 * @param {string} originalUrl - Original image URL
 * @param {string} downloadFolder - Target download folder
 * @returns {string} - Unique filename
 */
function getUniqueFilename(originalUrl, downloadFolder = '') {
    let filename;
    
    try {
        const url = new URL(originalUrl);
        filename = url.pathname.split('/').pop() || 'image.jpg';
        
        // Clean filename
        filename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        // Ensure it has an extension
        if (!filename.includes('.')) {
            filename += '.jpg';
        }
    } catch (error) {
        filename = `image_${Date.now()}.jpg`;
    }
    
    // Handle duplicates with underscore sequence
    const baseNameMatch = filename.match(/^(.+?)(\.[^.]+)?$/);
    const baseName = baseNameMatch[1];
    const extension = baseNameMatch[2] || '';
    
    let uniqueName = baseName;
    let counter = downloadedFilenames.get(baseName) || 0;
    
    if (counter > 0) {
        uniqueName = `${baseName}_${counter}`;
    }
    
    downloadedFilenames.set(baseName, counter + 1);
    
    const finalFilename = (downloadFolder ? downloadFolder + '/' : '') + uniqueName + extension;
    return finalFilename;
}

/**
 * Download individual image
 * @param {string} url - Image URL
 * @param {string} downloadFolder - Target folder
 * @returns {Promise<boolean>} - Success status
 */
async function downloadImage(url, downloadFolder = '') {
    const uniqueFilename = getUniqueFilename(url, downloadFolder);
    
    try {
        await chrome.downloads.download({
            url: url,
            filename: uniqueFilename,
            conflictAction: 'overwrite'
        });
        
        logEvent(`Downloaded: ${uniqueFilename}`, 'success');
        
        // Send progress update
        sendToPopup({
            action: 'downloadProgress',
            downloaded: allScrapedThumbnails.length - downloadQueue.length,
            total: allScrapedThumbnails.length,
            currentFile: uniqueFilename
        });
        
        return true;
        
    } catch (error) {
        logEvent(`Failed to download ${url}: ${error.message}`, 'error');
        allFailedExtractions.push(`Download failed: ${url} - ${error.message}`);
        return false;
    }
}

/**
 * Process download queue with concurrency control
 */
async function processDownloadQueue() {
    if (!isScrapingActive || isScrapingPaused) {
        return;
    }
    
    while (downloadQueue.length > 0 && activeDownloads < downloadSettings.maxConcurrentDownloads) {
        const { url, downloadFolder } = downloadQueue.shift();
        activeDownloads++;
        
        try {
            await downloadImage(url, downloadFolder);
        } catch (error) {
            logEvent(`Download queue error: ${error.message}`, 'error');
        } finally {
            activeDownloads--;
        }
    }
    
    // Check if all downloads are complete
    if (downloadQueue.length === 0 && activeDownloads === 0) {
        logEvent('All downloads completed', 'success');
        sendToPopup({ action: 'downloadsComplete' });
    }
}

// ============================================================================
// NETWORK MONITORING FOR PAGE IDLE DETECTION
// ============================================================================

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.tabId === activeTabId && isScrapingActive && !isScrapingPaused) {
            const requestTypes = ['xmlhttprequest', 'image', 'main_frame', 'sub_frame'];
            if (requestTypes.includes(details.type)) {
                activeRequests.set(details.requestId, {
                    timestamp: Date.now(),
                    url: details.url,
                    type: details.type
                });
                
                // Cancel any pending idle resolution
                if (pageIdleResolvers.has(activeTabId)) {
                    clearTimeout(pageIdleResolvers.get(activeTabId).timeoutId);
                }
            }
        }
    },
    { urls: ["<all_urls>"], types: ["xmlhttprequest", "image", "main_frame", "sub_frame"] },
    ["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.tabId === activeTabId && isScrapingActive && !isScrapingPaused) {
            if (activeRequests.has(details.requestId)) {
                activeRequests.delete(details.requestId);
                
                // Check if page is now idle
                if (activeRequests.size === 0 && pageIdleResolvers.has(activeTabId)) {
                    const { resolve } = pageIdleResolvers.get(activeTabId);
                    pageIdleResolvers.delete(activeTabId);
                    
                    // Small delay before resolving to catch rapid requests
                    setTimeout(() => resolve({ success: true }), 500);
                }
            }
        }
    },
    { urls: ["<all_urls>"], types: ["xmlhttprequest", "image", "main_frame", "sub_frame"] }
);

chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
        if (details.tabId === activeTabId && isScrapingActive && !isScrapingPaused) {
            if (activeRequests.has(details.requestId)) {
                activeRequests.delete(details.requestId);
                logEvent(`Network error for ${details.url}: ${details.error}`, 'warn');
                
                // Check if page is now idle
                if (activeRequests.size === 0 && pageIdleResolvers.has(activeTabId)) {
                    const { resolve } = pageIdleResolvers.get(activeTabId);
                    pageIdleResolvers.delete(activeTabId);
                    setTimeout(() => resolve({ success: true, error: details.error }), 500);
                }
            }
        }
    },
    { urls: ["<all_urls>"], types: ["xmlhttprequest", "image", "main_frame", "sub_frame"] }
);

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Reset scraping state
 */
function resetScrapeState() {
    isScrapingActive = false;
    isScrapingPaused = false;
    currentScrapeMode = 'single';
    activeTabId = null;
    currentPageUrl = '';
    
    allScrapedThumbnails = [];
    allScrapedDestinations = [];
    allFailedExtractions = [];
    downloadedFilenames.clear();
    
    downloadQueue = [];
    activeDownloads = 0;
    
    activeRequests.clear();
    pageIdleResolvers.clear();
    
    // Clear stored scrape state
    chrome.storage.local.remove('scrapeState');
    
    logEvent('Scrape state reset', 'info');
}

/**
 * Generate final report
 * @returns {Object} - Complete scraping report
 */
function generateFinalReport() {
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalThumbnails: allScrapedThumbnails.length,
            totalDestinations: allScrapedDestinations.length,
            totalFailures: allFailedExtractions.length,
            scrapeMode: currentScrapeMode,
            finalUrl: currentPageUrl
        },
        data: {
            thumbnails: [...allScrapedThumbnails],
            destinations: [...allScrapedDestinations]
        },
        failures: [...allFailedExtractions],
        log: [...scrapeLog]
    };
    
    // Save report to storage
    chrome.storage.local.set({ 
        lastScrapeReport: report,
        reportTimestamp: Date.now()
    });
    
    logEvent(`Final report generated: ${report.summary.totalThumbnails} thumbnails, ${report.summary.totalFailures} failures`, 'success');
    
    // Send to popup
    sendToPopup({
        action: 'finalReport',
        report
    });
    
    return report;
}

// ============================================================================
// COMMUNICATION HELPERS
// ============================================================================

/**
 * Send message to popup
 * @param {Object} message - Message to send
 */
function sendToPopup(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // Popup might not be open, that's okay
    });
}

/**
 * Send progress update
 * @param {Object} progress - Progress data
 */
function sendProgressUpdate(progress) {
    sendToPopup({
        action: 'progressUpdate',
        ...progress
    });
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        switch (request.action) {
            case 'processScrapedData':
                await handleProcessScrapedData(request, sender);
                sendResponse({ success: true });
                break;
                
            case 'navigateToNextPage':
                await handleNavigateToNextPage(request, sender);
                sendResponse({ success: true });
                break;
                
            case 'scrapeComplete':
                handleScrapeComplete(request);
                sendResponse({ success: true });
                break;
                
            case 'startScrapePage':
                await handleStartScrapePage(request, sender);
                sendResponse({ success: true });
                break;
                
            case 'startScrapeAllPages':
                await handleStartScrapeAllPages(request, sender);
                sendResponse({ success: true });
                break;
                
            case 'stopScraping':
                handleStopScraping();
                sendResponse({ success: true });
                break;
                
            case 'pauseScraping':
                handlePauseScraping();
                sendResponse({ success: true });
                break;
                
            case 'resumeScraping':
                await handleResumeScraping(sender);
                sendResponse({ success: true });
                break;
                
            case 'getScrapingStatus':
                sendResponse({
                    isActive: isScrapingActive,
                    isPaused: isScrapingPaused,
                    mode: currentScrapeMode,
                    stats: {
                        thumbnails: allScrapedThumbnails.length,
                        destinations: allScrapedDestinations.length,
                        failures: allFailedExtractions.length,
                        queuedDownloads: downloadQueue.length,
                        activeDownloads
                    }
                });
                break;
                
            case 'getLastReport':
                const lastReport = await chrome.storage.local.get('lastScrapeReport');
                sendResponse({ report: lastReport.lastScrapeReport || null });
                break;
                
            case 'clearLog':
                scrapeLog = [];
                await chrome.storage.local.set({ scrapeLog });
                sendResponse({ success: true });
                break;
                
            case 'statusUpdate':
                // Forward status updates to popup
                sendToPopup({
                    action: 'statusUpdate',
                    message: request.message,
                    type: request.type,
                    timestamp: request.timestamp,
                    url: request.url
                });
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        console.error('Background script error:', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
});

// ============================================================================
// SPECIFIC MESSAGE HANDLERS
// ============================================================================

/**
 * Handle scraped data processing
 */
async function handleProcessScrapedData(request, sender) {
    if (!isScrapingActive || isScrapingPaused) {
        logEvent('Scraping is inactive or paused, ignoring data', 'warn');
        return;
    }
    
    const { data, failedExtractions, currentPageUrl: pageUrl, isIntermediate, scrapeState } = request;
    
    activeTabId = sender.tab.id;
    currentPageUrl = pageUrl.split('#')[0];
    
    // Get download settings
    const settings = await chrome.storage.local.get(['downloadFolder', 'maxConcurrentDownloads']);
    downloadSettings.downloadFolder = settings.downloadFolder || '';
    downloadSettings.maxConcurrentDownloads = settings.maxConcurrentDownloads || 5;
    
    // Save scrape state if provided
    if (scrapeState) {
        await chrome.storage.local.set({ scrapeState });
    }
    
    // Add failed extractions
    allFailedExtractions.push(...failedExtractions);
    
    // Process each item
    let processedCount = 0;
    data.forEach(item => {
        allScrapedThumbnails.push(item.thumbnailUrl);
        allScrapedDestinations.push(item.destinationUrl);
        
        // Add to download queue
        downloadQueue.push({
            url: item.thumbnailUrl,
            downloadFolder: downloadSettings.downloadFolder
        });
        
        processedCount++;
    });
    
    // Send progress update
    sendProgressUpdate({
        totalScraped: allScrapedThumbnails.length,
        currentPage: scrapeState?.currentPage,
        status: `Processed ${processedCount} items from page ${scrapeState?.currentPage || 1}`,
        thumbnails: data.map(item => item.thumbnailUrl)
    });
    
    // Start processing downloads
    processDownloadQueue();
    
    // If single page mode and not intermediate, complete the scrape
    if (currentScrapeMode === 'single' && !isIntermediate) {
        logEvent(`Single page scrape complete: ${data.length} images`, 'success');
        generateFinalReport();
        resetScrapeState();
    }
}

/**
 * Handle navigation to next page
 */
async function handleNavigateToNextPage(request, sender) {
    if (!isScrapingActive || isScrapingPaused) {
        logEvent('Scraping is inactive or paused, ignoring navigation', 'warn');
        return;
    }
    
    const { nextPageUrl, scrapeState } = request;
    
    if (activeTabId) {
        if (scrapeState) {
            await chrome.storage.local.set({ scrapeState });
        }
        
        logEvent(`Navigating to next page: ${nextPageUrl}`, 'info');
        
        try {
            await chrome.tabs.update(activeTabId, { url: nextPageUrl });
        } catch (error) {
            logEvent(`Navigation failed: ${error.message}`, 'error');
            handleScrapeComplete({ error: error.message });
        }
    } else {
        logEvent('No active tab for navigation', 'error');
        resetScrapeState();
    }
}

/**
 * Handle scrape completion
 */
function handleScrapeComplete(request) {
    if (request.error) {
        logEvent(`Scraping finished with error: ${request.error}`, 'error');
    } else {
        logEvent('All pages scraped successfully', 'success');
    }
    
    generateFinalReport();
    resetScrapeState();
}

/**
 * Handle start scraping single page
 */
async function handleStartScrapePage(request, sender) {
    resetScrapeState();
    
    currentScrapeMode = 'single';
    isScrapingActive = true;
    isScrapingPaused = false;
    activeTabId = sender.tab.id;
    currentPageUrl = sender.tab.url;
    
    logEvent('Starting single page scrape', 'info', currentPageUrl);
    
    // Forward to content script
    try {
        await chrome.tabs.sendMessage(activeTabId, {
            action: 'startScrapePage',
            settings: request.settings
        });
    } catch (error) {
        logEvent(`Failed to start scraping: ${error.message}`, 'error');
        resetScrapeState();
    }
}

/**
 * Handle start scraping all pages
 */
async function handleStartScrapeAllPages(request, sender) {
    resetScrapeState();
    
    currentScrapeMode = 'all';
    isScrapingActive = true;
    isScrapingPaused = false;
    activeTabId = sender.tab.id;
    currentPageUrl = sender.tab.url;
    
    logEvent('Starting multi-page scrape', 'info', currentPageUrl);
    
    // Forward to content script
    try {
        await chrome.tabs.sendMessage(activeTabId, {
            action: 'startScrapeAllPages',
            settings: request.settings
        });
    } catch (error) {
        logEvent(`Failed to start scraping: ${error.message}`, 'error');
        resetScrapeState();
    }
}

/**
 * Handle stop scraping
 */
function handleStopScraping() {
    logEvent('Scraping stopped by user', 'info');
    
    // Send stop message to content script
    if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { action: 'stopScraping' }).catch(() => {
            // Tab might be closed, that's okay
        });
    }
    
    generateFinalReport();
    resetScrapeState();
}

/**
 * Handle pause scraping
 */
function handlePauseScraping() {
    isScrapingPaused = true;
    logEvent('Scraping paused', 'info');
    
    // Send pause message to content script
    if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { action: 'pauseScraping' }).catch(() => {
            // Tab might be closed, that's okay
        });
    }
}

/**
 * Handle resume scraping
 */
async function handleResumeScraping(sender) {
    isScrapingPaused = false;
    activeTabId = sender.tab.id;
    
    logEvent('Scraping resumed', 'info');
    
    // Send resume message to content script
    if (activeTabId) {
        try {
            await chrome.tabs.sendMessage(activeTabId, { action: 'resumeScraping' });
        } catch (error) {
            logEvent(`Failed to resume scraping: ${error.message}`, 'error');
        }
    }
    
    // Resume download processing
    processDownloadQueue();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize background script
console.log('Gallery Scraper Pro background script loaded');

// Load persistent data on startup
chrome.storage.local.get(['scrapeLog'], (result) => {
    if (result.scrapeLog) {
        scrapeLog = result.scrapeLog;
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Open popup (this is handled by manifest.json action.default_popup)
});