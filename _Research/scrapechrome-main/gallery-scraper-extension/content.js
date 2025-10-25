// content.js - Gallery Scraper Pro Content Script
// Handles page scraping, authentication, pagination, and robust waiting mechanisms

let shouldScrapeContinue = false;
let processedImageUrlsOnPage = new Set();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Robust wait helper for slow/unresponsive pages
 * @param {number} tabId - Chrome tab ID
 * @param {number} maxWaitMs - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} - True if page is ready, false if timeout
 */
async function waitForPageReady(tabId, maxWaitMs = 30000) {
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = Math.ceil(maxWaitMs / 1000);

    while (Date.now() - startTime < maxWaitMs && attempts < maxAttempts) {
        attempts++;
        
        try {
            // Check document ready state
            if (document.readyState === 'complete') {
                // Additional wait for dynamic content
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check if there are active network requests
                const isNetworkIdle = await waitForNetworkIdle(2000);
                if (isNetworkIdle) {
                    sendStatusUpdate('Page ready ✅');
                    return true;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.warn('Error checking page readiness:', error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    sendStatusUpdate('Page load timeout - proceeding anyway ⚠️', 'warn');
    return false;
}

/**
 * Wait for network idle (no active requests for specified duration)
 * @param {number} idleTime - Time to wait for idle in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForNetworkIdle(idleTime = 2000) {
    return new Promise((resolve) => {
        let timeout;
        
        const checkIdle = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => resolve(true), idleTime);
        };
        
        // Start the initial timeout
        checkIdle();
        
        // Listen for any fetch requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            checkIdle();
            return originalFetch.apply(this, args);
        };
        
        // Listen for XHR requests
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(...args) {
            checkIdle();
            return originalXHROpen.apply(this, args);
        };
        
        // Fallback timeout
        setTimeout(() => resolve(false), 10000);
    });
}

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>}
 */
async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            
            const delay = baseDelay * Math.pow(2, attempt);
            sendStatusUpdate(`Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`, 'warn');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Smart scroll to bottom with lazy loading detection
 * @param {number} scrollDelay - Delay between scroll actions
 * @returns {Promise<void>}
 */
async function scrollToBottom(scrollDelay = 500) {
    let lastHeight = document.body.scrollHeight;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;
    
    sendStatusUpdate('Scrolling to load all content... 📜');
    
    while (scrollAttempts < maxScrollAttempts && shouldScrapeContinue) {
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        
        // Wait for potential lazy loading
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        // Check if new content loaded
        const newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) {
            // Try scrolling to specific elements that might trigger loading
            const loadTriggers = document.querySelectorAll(
                '[data-lazy], [data-src], .lazy, .load-more, [loading="lazy"]'
            );
            
            if (loadTriggers.length > 0) {
                loadTriggers.forEach(trigger => {
                    trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                await new Promise(resolve => setTimeout(resolve, scrollDelay * 2));
            }
            
            // Check again after trigger scrolling
            if (document.body.scrollHeight === newHeight) {
                break;
            }
        }
        
        lastHeight = newHeight;
        scrollAttempts++;
        
        sendStatusUpdate(`Scroll attempt ${scrollAttempts}/${maxScrollAttempts}...`);
    }
    
    // Final scroll to top for better extraction
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    sendStatusUpdate('Scrolling completed ✅');
}

// ============================================================================
// DATA EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract image and link data from search results
 * @param {number} minImageWidth - Minimum image width filter
 * @param {number} minImageHeight - Minimum image height filter
 * @returns {Object} - Object containing thumbnailData and failedExtractions
 */
async function extractImageAndLinkData(minImageWidth = 200, minImageHeight = 200) {
    const thumbnailData = [];
    const failedExtractions = [];
    
    sendStatusUpdate('Extracting image data... 🔍');
    
    // Get custom selectors from storage or use defaults
    let imageContainerSelector = '';
    try {
        const result = await chrome.storage.local.get('imageContainerSelector');
        imageContainerSelector = result.imageContainerSelector || '';
    } catch (error) {
        console.warn('Failed to load image container selector from storage:', error);
    }
    
    // Comprehensive list of potential image container selectors
    const defaultSelectors = [
        imageContainerSelector,
        '.gallery-item', '.search-result', '.image-item', '.photo-item',
        '.result-item', '.thumbnail', '.card', '.tile', '.grid-item',
        '[data-testid*="image"]', '[data-testid*="photo"]', '[data-testid*="result"]',
        '.image-container', '.photo-container', '.media-item',
        'article img', 'figure img', '.content img',
        'a[href*="image"]', 'a[href*="photo"]', 'a[href*="gallery"]'
    ].filter(Boolean);
    
    let containers = [];
    
    // Try each selector until we find containers
    for (const selector of defaultSelectors) {
        try {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
                containers = Array.from(found);
                sendStatusUpdate(`Found ${containers.length} containers using selector: ${selector}`);
                break;
            }
        } catch (error) {
            console.warn(`Invalid selector: ${selector}`, error);
        }
    }
    
    // Fallback: find all images with links
    if (containers.length === 0) {
        const allImages = document.querySelectorAll('img');
        containers = Array.from(allImages).filter(img => {
            const parent = img.closest('a') || img.parentElement.querySelector('a');
            return parent && img.src && isValidImageUrl(img.src);
        });
        sendStatusUpdate(`Fallback: Found ${containers.length} images with links`);
    }
    
    // Process each container
    containers.forEach((container, index) => {
        if (!shouldScrapeContinue) return;
        
        try {
            let thumbnailUrl = null;
            let destinationUrl = null;
            
            // Extract thumbnail URL
            const img = container.tagName === 'IMG' ? container : container.querySelector('img');
            if (img) {
                thumbnailUrl = img.currentSrc || img.src || img.dataset.src || img.dataset.original;
                
                // Check image dimensions if loaded
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    if (img.naturalWidth < minImageWidth || img.naturalHeight < minImageHeight) {
                        return; // Skip small images
                    }
                }
            }
            
            // Try background image if no img tag found
            if (!thumbnailUrl) {
                const bgMatch = container.style.backgroundImage?.match(/url\(['"]?(.*?)['"]?\)/);
                if (bgMatch && bgMatch[1]) {
                    thumbnailUrl = bgMatch[1];
                }
            }
            
            // Validate image URL
            if (!isValidImageUrl(thumbnailUrl)) {
                return;
            }
            
            // Check for duplicates
            if (processedImageUrlsOnPage.has(thumbnailUrl)) {
                return;
            }
            processedImageUrlsOnPage.add(thumbnailUrl);
            
            // Extract destination URL
            const link = container.tagName === 'A' ? container : 
                        container.closest('a') || 
                        container.querySelector('a') ||
                        container.parentElement.querySelector('a');
            
            if (link && link.href) {
                destinationUrl = link.href;
            }
            
            // Convert relative URLs to absolute
            if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
                try {
                    thumbnailUrl = new URL(thumbnailUrl, window.location.href).href;
                } catch (e) {
                    thumbnailUrl = null;
                }
            }
            
            if (destinationUrl && !destinationUrl.startsWith('http')) {
                try {
                    destinationUrl = new URL(destinationUrl, window.location.href).href;
                } catch (e) {
                    destinationUrl = null;
                }
            }
            
            // Add to results
            if (thumbnailUrl) {
                thumbnailData.push({ 
                    thumbnailUrl, 
                    destinationUrl: destinationUrl || '',
                    index: index + 1
                });
            } else {
                failedExtractions.push(`No valid image found in container ${index + 1}`);
            }
            
        } catch (error) {
            failedExtractions.push(`Error processing container ${index + 1}: ${error.message}`);
        }
    });
    
    sendStatusUpdate(`Extracted ${thumbnailData.length} items, ${failedExtractions.length} failed`);
    
    return { thumbnailData, failedExtractions };
}

/**
 * Validate if URL is a valid image URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:')) return false; // Skip data URLs
    if (url.toLowerCase().endsWith('.svg')) return false; // Skip SVGs
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.avif'];
    const lowerCaseUrl = url.toLowerCase();
    
    return imageExtensions.some(ext => lowerCaseUrl.includes(ext)) || 
           url.includes('image') || 
           url.includes('photo') ||
           url.includes('thumb');
}

// ============================================================================
// PAGINATION FUNCTIONS
// ============================================================================

/**
 * Find and handle next page navigation
 * @param {number} maxWaitDuration - Maximum wait time for page load
 * @returns {Promise<string|null>} - Next page URL or null if no more pages
 */
async function findAndClickNextPage(maxWaitDuration = 30000) {
    if (!shouldScrapeContinue) return null;
    
    sendStatusUpdate('Looking for next page... 🔍');
    
    // Get custom next page selector
    let nextPageSelector = '';
    const result = await chrome.storage.local.get('nextPageSelector');
    nextPageSelector = result.nextPageSelector || '';
    
    let nextElement = null;
    
    // Try custom selector first
    if (nextPageSelector) {
        try {
            nextElement = document.querySelector(nextPageSelector);
            if (nextElement) {
                sendStatusUpdate(`Found next page using custom selector: ${nextPageSelector}`);
            }
        } catch (error) {
            sendStatusUpdate(`Invalid next page selector: ${nextPageSelector}`, 'error');
        }
    }
    
    // Default selectors for next page
    if (!nextElement) {
        const defaultNextSelectors = [
            'a[rel="next"]',
            'a.next-page', 'a.pagination-next', 'a.next',
            'button.next', 'button.next-page',
            'a[aria-label*="Next" i]', 'button[aria-label*="Next" i]',
            'a.load-more-button', 'button.load-more',
            '[data-testid*="next" i]', '[data-testid*="more" i]',
            '.pagination a:last-child', '.pager a:last-child'
        ];
        
        for (const selector of defaultNextSelectors) {
            try {
                nextElement = document.querySelector(selector);
                if (nextElement && !nextElement.disabled && 
                    !nextElement.classList.contains('disabled')) {
                    sendStatusUpdate(`Found next page using: ${selector}`);
                    break;
                }
            } catch (error) {
                console.warn(`Error with selector ${selector}:`, error);
            }
        }
    }
    
    // Text-based search as fallback
    if (!nextElement) {
        const allLinks = document.querySelectorAll('a, button');
        for (const el of allLinks) {
            const text = el.textContent.trim().toLowerCase();
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
            
            if (text.includes('next') || text.includes('more') || text.includes('»') || 
                text.includes('>') || ariaLabel.includes('next')) {
                if (!el.disabled && !el.classList.contains('disabled')) {
                    nextElement = el;
                    sendStatusUpdate('Found next page by text content');
                    break;
                }
            }
        }
    }
    
    if (!nextElement) {
        sendStatusUpdate('No next page found - pagination complete ✅');
        return null;
    }
    
    // Handle different types of next page elements
    if (nextElement.tagName === 'A' && nextElement.href && 
        nextElement.href !== '#' && !nextElement.href.startsWith('javascript:')) {
        
        // Check if it opens in new tab
        if (nextElement.getAttribute('target') === '_blank') {
            sendStatusUpdate('Next page opens in new tab - handling redirect');
            return nextElement.href;
        }
        
        sendStatusUpdate(`Navigating to: ${nextElement.href}`);
        return nextElement.href;
        
    } else if (nextElement.tagName === 'BUTTON' || 
               (nextElement.tagName === 'A' && 
                (nextElement.href === '#' || nextElement.href.startsWith('javascript:')))) {
        
        sendStatusUpdate('Clicking next page button...');
        
        // Scroll element into view
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Click the element
        nextElement.click();
        
        // Wait for navigation or content change
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return 'clicked';
    }
    
    return null;
}

// ============================================================================
// MAIN SCRAPING FUNCTIONS
// ============================================================================

/**
 * Scrape current page only
 * @param {Object} settings - Scraping settings
 * @returns {Promise<boolean>} - Success status
 */
async function scrapeCurrentPage(settings) {
    shouldScrapeContinue = true;
    const { maxWait, scrollDelay, minImageWidth, minImageHeight } = settings;
    
    try {
        sendStatusUpdate('Starting single page scrape... 🚀');
        
        // Wait for page to be ready
        const pageReady = await retryOperation(
            () => waitForPageReady(null, maxWait), 
            3, 
            1000
        );
        
        if (!pageReady || !shouldScrapeContinue) {
            sendStatusUpdate('Page not ready - stopping', 'error');
            return false;
        }
        
        // Scroll to load all content
        await scrollToBottom(scrollDelay);
        if (!shouldScrapeContinue) return false;
        
        // Extract data
        const { thumbnailData, failedExtractions } = await extractImageAndLinkData(
            minImageWidth, 
            minImageHeight
        );
        
        if (!shouldScrapeContinue) return false;
        
        // Send data to background script
        chrome.runtime.sendMessage({
            action: 'processScrapedData',
            data: thumbnailData,
            failedExtractions: failedExtractions,
            currentPageUrl: window.location.href,
            isIntermediate: false
        });
        
        sendStatusUpdate(`✅ Single page complete: ${thumbnailData.length} items found`);
        return thumbnailData.length > 0;
        
    } catch (error) {
        sendStatusUpdate(`❌ Error during scrape: ${error.message}`, 'error');
        chrome.runtime.sendMessage({ 
            action: 'scrapeComplete', 
            error: error.message 
        });
        return false;
    }
}

/**
 * Scrape all pages with pagination
 * @param {Object} settings - Scraping settings
 * @returns {Promise<boolean>} - Success status
 */
async function scrapeAllPages(settings) {
    shouldScrapeContinue = true;
    const { maxWait, scrollDelay, minImageWidth, minImageHeight } = settings;
    
    // Load or initialize scrape state
    let scrapeState = await chrome.storage.local.get('scrapeState');
    let currentPage = scrapeState.scrapeState?.currentPage || 1;
    let visitedUrls = scrapeState.scrapeState ? 
        new Set(scrapeState.scrapeState.visitedUrls) : 
        new Set();
    
    let hasMorePages = true;
    let totalItemsFound = 0;
    
    try {
        while (hasMorePages && shouldScrapeContinue) {
            const currentUrl = window.location.href.split('#')[0];
            
            // Check for circular pagination
            if (visitedUrls.has(currentUrl)) {
                sendStatusUpdate('🛑 Circular pagination detected - stopping');
                break;
            }
            visitedUrls.add(currentUrl);
            
            sendStatusUpdate(`📄 Scraping page ${currentPage}: ${currentUrl}`);
            
            // Wait for page to be ready
            const pageReady = await retryOperation(
                () => waitForPageReady(null, maxWait), 
                3, 
                1000
            );
            
            if (!pageReady || !shouldScrapeContinue) break;
            
            // Scroll to load all content
            await scrollToBottom(scrollDelay);
            if (!shouldScrapeContinue) break;
            
            // Extract data from current page
            const { thumbnailData, failedExtractions } = await extractImageAndLinkData(
                minImageWidth, 
                minImageHeight
            );
            
            if (!shouldScrapeContinue) break;
            
            totalItemsFound += thumbnailData.length;
            
            // Update scrape state
            const newScrapeState = {
                currentPage,
                visitedUrls: Array.from(visitedUrls),
                totalItemsFound,
                lastUrl: currentUrl
            };
            
            // Send data to background script
            chrome.runtime.sendMessage({
                action: 'processScrapedData',
                data: thumbnailData,
                failedExtractions: failedExtractions,
                currentPageUrl: currentUrl,
                isIntermediate: true,
                scrapeState: newScrapeState
            });
            
            sendStatusUpdate(`✅ Page ${currentPage}: ${thumbnailData.length} items`);
            
            // Look for next page
            const nextPageResult = await findAndClickNextPage(maxWait);
            
            if (!nextPageResult) {
                hasMorePages = false;
                sendStatusUpdate('🏁 No more pages - scraping complete');
            } else if (nextPageResult === 'clicked') {
                // Button was clicked, wait for page change
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                // Navigate to next page URL
                currentPage++;
                chrome.runtime.sendMessage({
                    action: 'navigateToNextPage',
                    nextPageUrl: nextPageResult,
                    scrapeState: newScrapeState
                });
                return true; // Let background script handle navigation
            }
        }
        
        // Scraping complete
        chrome.runtime.sendMessage({ 
            action: 'scrapeComplete',
            totalPages: currentPage,
            totalItems: totalItemsFound
        });
        
        return true;
        
    } catch (error) {
        sendStatusUpdate(`❌ Error during multi-page scrape: ${error.message}`, 'error');
        chrome.runtime.sendMessage({ 
            action: 'scrapeComplete', 
            error: error.message 
        });
        return false;
    }
}

// ============================================================================
// COMMUNICATION FUNCTIONS
// ============================================================================

/**
 * Send status update to background script
 * @param {string} message - Status message
 * @param {string} type - Message type (info, warn, error, success)
 */
function sendStatusUpdate(message, type = 'info') {
    console.log(`[Gallery Scraper] ${message}`);
    chrome.runtime.sendMessage({
        action: 'statusUpdate',
        message,
        type,
        timestamp: Date.now(),
        url: window.location.href
    });
}

/**
 * Send stop signal to background script
 */
function sendStopSignal() {
    shouldScrapeContinue = false;
    chrome.runtime.sendMessage({ action: 'scrapingStopped' });
    return false;
}

// ============================================================================
// MESSAGE LISTENERS
// ============================================================================

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        switch (request.action) {
            case 'startScrapePage':
                sendResponse({ success: true });
                const singleResult = await scrapeCurrentPage(request.settings);
                break;
                
            case 'startScrapeAllPages':
                sendResponse({ success: true });
                const allResult = await scrapeAllPages(request.settings);
                break;
                
            case 'stopScraping':
                shouldScrapeContinue = false;
                processedImageUrlsOnPage.clear();
                sendStatusUpdate('🛑 Scraping stopped by user');
                sendResponse({ success: true });
                break;
                
            case 'pauseScraping':
                shouldScrapeContinue = false;
                sendStatusUpdate('⏸️ Scraping paused');
                sendResponse({ success: true });
                break;
                
            case 'resumeScraping':
                shouldScrapeContinue = true;
                sendStatusUpdate('▶️ Scraping resumed');
                sendResponse({ success: true });
                break;
                
            case 'getPageInfo':
                sendResponse({
                    url: window.location.href,
                    title: document.title,
                    domain: window.location.hostname
                });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        console.error('Content script error:', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
});

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize content script
sendStatusUpdate('🔧 Gallery Scraper Pro content script loaded');

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    shouldScrapeContinue = false;
    processedImageUrlsOnPage.clear();
});