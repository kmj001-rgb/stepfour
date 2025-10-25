// MasterScraper: Enhanced Background Script with Dedicated Window Support
// Based on analysis of multiple Chrome extensions for robust image downloading

console.log('MasterScraper: Background script initialized');

// Global state management
let scrapingState = {
    isActive: false,
    currentPage: 1,
    totalPages: 0,
    totalImages: 0,
    downloadedImages: 0,
    failedDownloads: 0,
    startTime: null,
    settings: null,
    currentTabId: null,
    dashboardTabId: null
};

let downloadQueue = [];
let downloadInProgress = false;
let processedUrls = new Set();
let downloadRetries = new Map();
let failedDownloads = [];

// Enhanced site-specific configurations
const SITE_PROFILES = {
    'gettyimages.com': {
        name: 'Getty Images',
        downloadFolder: 'Getty_Images',
        imageSelectors: [
            'img[data-testid="asset-card-image"]',
            '.asset-card img',
            '.mosaic-asset img',
            'img[data-testid="image"]'
        ],
        linkSelectors: [
            'a[data-testid="asset-card-link"]',
            '.asset-card a',
            '.mosaic-asset a',
            'a[data-testid="asset-link"]'
        ],
        nextPageSelectors: [
            'button[data-automation="mosaic-load-more-button"]',
            '.pagination-next',
            '[aria-label="Load more"]',
            '.pagination .next'
        ],
        waitTime: 3000,
        retryCount: 3
    },
    
    'shutterstock.com': {
        name: 'Shutterstock',
        downloadFolder: 'Shutterstock',
        imageSelectors: [
            '.asset-card img',
            '.search-result img',
            '.thumbnail img',
            '[data-testid="search-result"] img'
        ],
        linkSelectors: [
            '.asset-card a',
            '.search-result a',
            '.thumbnail a',
            '[data-testid="search-result"] a'
        ],
        nextPageSelectors: [
            '.pagination .next',
            '.pagination-next',
            'a[rel="next"]',
            '.next-page'
        ],
        waitTime: 2500,
        retryCount: 3
    },
    
    'mirrorpix.com': {
        name: 'MirrorPix',
        downloadFolder: 'MirrorPix',
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img',
            '.gallery-item img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a',
            '.gallery-item a'
        ],
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        waitTime: 2000,
        retryCount: 2
    },
    
    'imago-images.com': {
        name: 'Imago Images',
        downloadFolder: 'Imago_Images',
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img',
            '.gallery-item img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a',
            '.gallery-item a'
        ],
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        waitTime: 2000,
        retryCount: 2
    },
    
    'actionpress.de': {
        name: 'ActionPress',
        downloadFolder: 'ActionPress',
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img',
            '.gallery-item img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a',
            '.gallery-item a'
        ],
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        waitTime: 2000,
        retryCount: 2
    },
    
    'newscom.com': {
        name: 'Newscom',
        downloadFolder: 'Newscom',
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img',
            '.gallery-item img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a',
            '.gallery-item a'
        ],
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        waitTime: 2000,
        retryCount: 2
    }
};

// Enhanced utility functions
const Utils = {
    // Get current site profile
    getSiteProfile: (url) => {
        try {
            const hostname = new URL(url).hostname;
            return SITE_PROFILES[hostname] || {
                name: 'Generic Site',
                downloadFolder: 'MasterScraper',
                imageSelectors: ['img'],
                linkSelectors: ['a'],
                nextPageSelectors: [
                    'a[rel="next"]',
                    '.pagination .next',
                    '.pagination-next',
                    '.next-page',
                    'button[data-testid="pagination-next"]',
                    '[aria-label="Next page"]'
                ],
                waitTime: 2000,
                retryCount: 2
            };
        } catch (e) {
            return SITE_PROFILES['generic'] || {
                name: 'Generic Site',
                downloadFolder: 'MasterScraper',
                imageSelectors: ['img'],
                linkSelectors: ['a'],
                nextPageSelectors: [
                    'a[rel="next"]',
                    '.pagination .next',
                    '.pagination-next',
                    '.next-page'
                ],
                waitTime: 2000,
                retryCount: 2
            };
        }
    },

    // Generate unique filename
    generateUniqueFilename: (url, existingFiles = []) => {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            let filename = pathSegments.pop() || pathSegments.pop();
            
            if (filename) {
                // Remove query parameters and hash
                filename = filename.split('?')[0].split('#')[0];
                
                // If no extension, add .jpg as default
                if (!filename.includes('.')) {
                    filename += '.jpg';
                }
                
                // Check for duplicates
                if (!existingFiles.includes(filename)) {
                    return filename;
                }
                
                // Generate unique name with underscore sequence
                const nameParts = filename.split('.');
                const extension = nameParts.pop();
                const baseName = nameParts.join('.');
                
                let counter = 1;
                let newFilename = `${baseName}_${counter}.${extension}`;
                
                while (existingFiles.includes(newFilename)) {
                    counter++;
                    newFilename = `${baseName}_${counter}.${extension}`;
                }
                
                return newFilename;
            }
        } catch (e) {
            console.error('Error generating filename:', e);
        }
        
        return `image_${Date.now()}.jpg`;
    },

    // Extract filename from URL (fallback for reports)
    getFilenameFromUrl: (url) => {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            let filename = pathSegments.pop() || pathSegments.pop();
            if (filename) {
                filename = filename.split('?')[0].split('#')[0];
                if (!filename.includes('.')) filename += '.jpg';
                return filename;
            }
        } catch (e) {}
        return 'unnamed_image.jpg';
    },

    // Validate image URL
    isValidImageUrl: (url) => {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) return false;
        
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
            return validExtensions.some(ext => pathname.includes(ext)) || 
                   urlObj.searchParams.has('image') ||
                   urlObj.searchParams.has('img');
        } catch (e) {
            return false;
        }
    },

    // Wait for a specific duration
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Format file size
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Get file extension from URL
    getFileExtension: (url) => {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/);
            return match ? match[1] : 'jpg';
        } catch (e) {
            return 'jpg';
        }
    }
};

// Enhanced download queue management
class DownloadQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.concurrentDownloads = 3; // Limit concurrent downloads
        this.activeDownloads = 0;
        this.completedDownloads = 0;
        this.failedDownloads = 0;
    }

    add(downloadItem) {
        this.queue.push(downloadItem);
        this.process();
    }

    async process() {
        if (this.processing || this.activeDownloads >= this.concurrentDownloads) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.activeDownloads < this.concurrentDownloads) {
            const item = this.queue.shift();
            this.activeDownloads++;
            
            this.downloadItem(item).finally(() => {
                this.activeDownloads--;
                this.process(); // Continue processing
            });
        }

        this.processing = false;
    }

    async downloadItem(item) {
        const { url, filename, folder, retryCount = 0 } = item;
        const maxRetries = 3;

        try {
            // Check if already downloaded
            if (processedUrls.has(url)) {
                console.log(`Skipping already processed URL: ${url}`);
                return;
            }

            // Download the image
            await chrome.downloads.download({
                url: url,
                filename: `${folder}/${filename}`,
                conflictAction: 'uniquify'
            });

            // Track the download
            processedUrls.add(url);
            this.completedDownloads++;
            scrapingState.downloadedImages++;

            // Log success
            logEvent(`Downloaded: ${filename}`, 'success');
            updateProgress();

        } catch (error) {
            console.error(`Download failed for ${url}:`, error);

            if (retryCount < maxRetries) {
                // Retry with exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                logEvent(`Retrying download: ${filename} (attempt ${retryCount + 1})`, 'warn');
                
                setTimeout(() => {
                    this.add({
                        ...item,
                        retryCount: retryCount + 1
                    });
                }, delay);
            } else {
                // Mark as failed
                this.failedDownloads++;
                scrapingState.failedDownloads++;
                failedDownloads.push({
                    url: url,
                    filename: filename,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });

                logEvent(`Download failed after ${maxRetries} attempts: ${filename}`, 'error');
                updateProgress();
            }
        }
    }

    getStatus() {
        return {
            queueLength: this.queue.length,
            activeDownloads: this.activeDownloads,
            completedDownloads: this.completedDownloads,
            failedDownloads: this.failedDownloads,
            isProcessing: this.processing
        };
    }
}

// Initialize download queue instance
const downloadQueueInstance = new DownloadQueue();

// Dedicated window/tab management
async function createDashboardWindow() {
    try {
        const tab = await chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html'),
            active: true
        });
        
        scrapingState.dashboardTabId = tab.id;
        logEvent('Dashboard tab opened', 'info');
        return tab;
    } catch (error) {
        logEvent(`Error creating dashboard tab: ${error.message}`, 'error');
        throw error;
    }
}

async function focusDashboardWindow() {
    if (scrapingState.dashboardTabId) {
        try {
            await chrome.tabs.update(scrapingState.dashboardTabId, { active: true });
        } catch (error) {
            // Tab might be closed, create a new one
            await createDashboardWindow();
        }
    } else {
        await createDashboardWindow();
    }
}

// Enhanced download management
async function processImageDownloads(thumbnails, destinations, settings) {
    if (!thumbnails || thumbnails.length === 0) {
        logEvent('No images to download', 'warn');
        return;
    }

    Utils.getSiteProfile(settings.currentUrl || '');
    let downloadFolder = settings.downloadFolder || 'MasterScraper';
    
    // Validate download folder name
    if (!downloadFolder || downloadFolder.trim() === '') {
        logEvent('Invalid download folder name, using default', 'warn');
        downloadFolder = 'MasterScraper';
    }
    
    // Clean folder name (remove invalid characters)
    downloadFolder = downloadFolder.replace(/[<>:"/\\|?*]/g, '_');

    logEvent(`Starting download of ${thumbnails.length} images to folder: ${downloadFolder}`, 'info');

    // Get existing files for duplicate checking
    const existingFiles = await getExistingFiles(downloadFolder);

    // Add downloads to queue
    for (let i = 0; i < thumbnails.length; i++) {
        const thumbnailUrl = thumbnails[i];
        const destinationUrl = destinations[i] || '';

        if (!Utils.isValidImageUrl(thumbnailUrl)) {
            logEvent(`Invalid image URL: ${thumbnailUrl}`, 'warn');
            continue;
        }

        // Generate unique filename
        const filename = Utils.generateUniqueFilename(thumbnailUrl, existingFiles);
        existingFiles.push(filename);

        // Add to download queue
        downloadQueueInstance.add({
            url: thumbnailUrl,
            filename: filename,
            folder: downloadFolder,
            destinationUrl: destinationUrl,
            index: i
        });
    }

    // Start processing
    downloadQueueInstance.process();
}

// Get existing files in download folder
async function getExistingFiles(folder) {
    // This is a simplified implementation
    // In a real scenario, you might want to check the actual download directory
    return [];
}

// Enhanced progress tracking
function updateProgress() {
    const status = downloadQueueInstance.getStatus();
    const progress = {
        total: scrapingState.totalImages,
        downloaded: scrapingState.downloadedImages,
        failed: scrapingState.failedDownloads,
        queued: status.queueLength,
        active: status.activeDownloads,
        percentage: scrapingState.totalImages > 0 ? 
            Math.round((scrapingState.downloadedImages / scrapingState.totalImages) * 100) : 0
    };

    // Send to dashboard tab if open
    if (scrapingState.dashboardTabId) {
        chrome.runtime.sendMessage({
            action: 'progressUpdate',
            progress: progress
        });
    }
}

// Enhanced logging
function logEvent(message, type = 'info', data = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        message: message,
        type: type,
        data: data
    };

    // Store in chrome.storage
    chrome.storage.local.get(['logs'], (result) => {
        const logs = result.logs || [];
        logs.push(logEntry);
        
        // Keep only last 1000 log entries
        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }
        
        chrome.storage.local.set({ logs: logs });
    });

    // Send to dashboard tab if open
    if (scrapingState.dashboardTabId) {
        chrome.runtime.sendMessage({
            action: 'logUpdate',
            log: logEntry
        });
    }

    console.log(`[MasterScraper] ${type.toUpperCase()}: ${message}`, data);
}

// Enhanced message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'openDashboard':
            focusDashboardWindow();
            sendResponse({ success: true });
            break;

        case 'startScraping': {
            const targetTabId = message.targetTabId || sender.tab?.id || scrapingState.currentTabId;
            handleStartScraping(message.settings, { id: targetTabId });
            sendResponse({ success: true });
            break;
        }

        case 'stopScraping':
            handleStopScraping();
            sendResponse({ success: true });
            break;

        case 'pauseScraping':
            handlePauseScraping();
            sendResponse({ success: true });
            break;

        case 'resumeScraping':
            handleResumeScraping();
            sendResponse({ success: true });
            break;

        case 'pageData':
            handlePageData(message.data);
            sendResponse({ success: true });
            break;

        case 'scrapingComplete':
            handleScrapingComplete(message.data);
            sendResponse({ success: true });
            break;

        case 'scrapingError':
            handleScrapingError(message.error, message.pageNumber);
            sendResponse({ success: true });
            break;

        case 'statusUpdate':
            handleStatusUpdate(message.message, message.type);
            sendResponse({ success: true });
            break;

        case 'getScrapingStatus':
            sendResponse(getScrapingStatus());
            break;

        case 'getDownloadStatus':
            sendResponse(downloadQueueInstance.getStatus());
            break;

        case 'clearLogs':
            chrome.storage.local.remove(['logs']);
            sendResponse({ success: true });
            break;

        case 'exportData':
            handleExportData(message.format);
            sendResponse({ success: true });
            break;

        case 'getSiteProfile':
            try {
                const url = message.url || sender.tab?.url || '';
                const profile = Utils.getSiteProfile(url);
                sendResponse(profile);
            } catch (e) {
                sendResponse({ name: 'Generic Site', downloadFolder: 'MasterScraper' });
            }
            break;

        case 'getTargetTab': {
            chrome.storage.local.get(['targetTabId', 'targetTabUrl'], async (res) => {
                if (res.targetTabId) {
                    try {
                        const tab = await chrome.tabs.get(res.targetTabId);
                        sendResponse({ id: tab.id, url: tab.url || res.targetTabUrl || '' });
                    } catch (e) {
                        sendResponse({ id: null, url: '' });
                    }
                } else {
                    sendResponse({ id: null, url: '' });
                }
            });
            break;
        }

        case 'updateTargetFromActive': {
            (async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab && tab.url && tab.url.startsWith('http')) {
                        await chrome.storage.local.set({ targetTabId: tab.id, targetTabUrl: tab.url });
                        sendResponse({ success: true, id: tab.id, url: tab.url });
                    } else {
                        sendResponse({ success: false, error: 'No active http(s) tab found' });
                    }
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
            })();
            break;
        }

        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep message channel open for async response
});

// Enhanced scraping handlers
function handleStartScraping(settings, tab) {
    scrapingState = {
        isActive: true,
        currentPage: 1,
        totalPages: 0,
        totalImages: 0,
        downloadedImages: 0,
        failedDownloads: 0,
        startTime: new Date().toISOString(),
        settings: settings,
        currentTabId: tab.id,
        dashboardTabId: scrapingState.dashboardTabId || null
    };

    // Apply concurrency from settings
    if (typeof settings.maxConcurrentDownloads === 'number' && settings.maxConcurrentDownloads > 0) {
        downloadQueueInstance.concurrentDownloads = Math.max(1, Math.min(10, settings.maxConcurrentDownloads));
    }

    logEvent('Scraping started', 'info', { settings: settings });
    
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
        action: 'startScraping',
        settings: settings
    });
}

function handleStopScraping() {
    scrapingState.isActive = false;
    logEvent('Scraping stopped by user', 'warn');
    
    // Clear download queue
    downloadQueueInstance.queue = [];
    downloadQueueInstance.processing = false;
}

function handlePauseScraping() {
    scrapingState.isActive = false;
    logEvent('Scraping paused', 'info');
}

function handleResumeScraping() {
    scrapingState.isActive = true;
    logEvent('Scraping resumed', 'info');
}

function handlePageData(data) {
    scrapingState.currentPage = data.pageNumber;
    scrapingState.totalImages += data.thumbnails.length;

    logEvent(`Page ${data.pageNumber}: Found ${data.thumbnails.length} images`, 'info');

    // Process downloads if auto-download is enabled
    if (scrapingState.settings.autoDownload !== false) {
        processImageDownloads(data.thumbnails, data.destinations, scrapingState.settings);
    }

    // Store data for export
    chrome.storage.local.get(['scrapedData'], (result) => {
        const existingData = result.scrapedData || { thumbnails: [], destinations: [], metadata: [] };
        existingData.thumbnails.push(...data.thumbnails);
        existingData.destinations.push(...data.destinations);
        existingData.metadata.push(...data.metadata);
        
        chrome.storage.local.set({ scrapedData: existingData });
    });
}

function handleScrapingComplete(data) {
    scrapingState.isActive = false;
    scrapingState.totalImages = data.thumbnails.length;

    logEvent(`Scraping completed! Total: ${data.thumbnails.length} images`, 'success', {
        totalImages: data.thumbnails.length,
        duration: new Date() - new Date(scrapingState.startTime)
    });

    // Generate final report
    generateFinalReport(data);
}

function handleScrapingError(error, pageNumber) {
    logEvent(`Scraping error on page ${pageNumber}: ${error}`, 'error');
}

function handleStatusUpdate(message, type) {
    logEvent(message, type);
}

function getScrapingStatus() {
    return {
        ...scrapingState,
        downloadStatus: downloadQueueInstance.getStatus()
    };
}

// Enhanced export functionality
async function handleExportData(format = 'json') {
    try {
        const result = await chrome.storage.local.get(['scrapedData']);
        const data = result.scrapedData || { thumbnails: [], destinations: [], metadata: [] };

        let content = '';
        let filename = '';

        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
            filename = `masterscraper_report_${new Date().toISOString().split('T')[0]}.json`;
        } else if (format === 'csv') {
            content = generateCSV(data);
            filename = `masterscraper_report_${new Date().toISOString().split('T')[0]}.csv`;
        }

        // Download the file
        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url: url,
            filename: filename,
            conflictAction: 'uniquify'
        });

        logEvent(`Data exported to ${filename}`, 'success');

    } catch (error) {
        logEvent(`Export failed: ${error.message}`, 'error');
    }
}

// Generate CSV from scraped data
function generateCSV(data) {
    const headers = ['Index', 'Thumbnail URL', 'Destination URL', 'Filename', 'Alt Text', 'Width', 'Height'];
    const rows = [headers.join(',')];

    for (let i = 0; i < data.thumbnails.length; i++) {
        const thumbnail = data.thumbnails[i];
        const destination = data.destinations[i] || '';
        const metadata = data.metadata[i] || {};
        
        const row = [
            i + 1,
            `"${thumbnail}"`,
            `"${destination}"`,
            `"${metadata.filename || Utils.getFilenameFromUrl(thumbnail)}"`,
            `"${metadata.alt || ''}"`,
            metadata.width || 0,
            metadata.height || 0
        ];
        
        rows.push(row.join(','));
    }

    return rows.join('\n');
}

// Generate final report
function generateFinalReport(data) {
    const report = {
        timestamp: new Date().toISOString(),
        totalImages: data.thumbnails.length,
        downloadedImages: scrapingState.downloadedImages,
        failedDownloads: scrapingState.failedDownloads,
        duration: new Date() - new Date(scrapingState.startTime),
        settings: scrapingState.settings,
        failedDownloadsList: failedDownloads
    };

    // Store report
    chrome.storage.local.set({ lastReport: report });

    // Export report
    const reportContent = JSON.stringify(report, null, 2);
    const blob = new Blob([reportContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
        url: url,
        filename: `masterscraper_report_${new Date().toISOString().split('T')[0]}.json`,
        conflictAction: 'uniquify'
    });

    logEvent('Final report generated and downloaded', 'success');
}

// Download completion handler
chrome.downloads.onChanged.addListener((downloadDelta) => {
    if (downloadDelta.state && downloadDelta.state.current === 'complete') {
        updateProgress();
    }
});

// Tab management
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === scrapingState.dashboardTabId) {
        scrapingState.dashboardTabId = null;
        logEvent('Dashboard tab closed', 'info');
    }
});

// Open/focus dashboard when the toolbar icon is clicked
chrome.action.onClicked.addListener(async () => {
    try {
        // Capture current active http(s) tab as target before opening dashboard
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.url && activeTab.url.startsWith('http')) {
            await chrome.storage.local.set({ targetTabId: activeTab.id, targetTabUrl: activeTab.url });
        }
    } catch (e) {
        // ignore
    }
    focusDashboardWindow();
});

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        logEvent('MasterScraper installed successfully', 'success');
        
        // Initialize default settings
        chrome.storage.local.set({
            settings: {
                downloadFolder: 'MasterScraper',
                maxWaitTime: 30000,
                scrollDelay: 1000,
                autoScroll: true,
                autoDownload: true,
                maxPages: 100,
                retryCount: 3,
                maxConcurrentDownloads: 3
            }
        });
    }
});

// Initialize
logEvent('MasterScraper background script ready', 'info');