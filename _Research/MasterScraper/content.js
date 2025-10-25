// MasterScraper: Enhanced Content Script with Advanced Pagination & Scraping
// Based on analysis of multiple Chrome extensions for robust gallery scraping

console.log('MasterScraper: Content script loaded on', window.location.href);

// Global state management
let isScraping = false;
let shouldScrapeContinue = true;
let currentSettings = null;
let scrapedData = {
    thumbnails: [],
    destinations: [],
    metadata: []
};

// Enhanced pagination detection patterns from analyzed extensions
const PAGINATION_PATTERNS = {
    // Common next page selectors from various extensions
    nextPageSelectors: [
        // Standard pagination
        'a[rel="next"]',
        '.pagination .next',
        '.pagination-next',
        '.next-page',
        '.pagination a:last-child',
        'button[data-testid="pagination-next"]',
        '[aria-label="Next page"]',
        '[aria-label="Next"]',
        '.next',
        '.pagination__next',
        
        // Load more buttons
        'button[data-automation="mosaic-load-more-button"]',
        '[aria-label="Load more"]',
        '.load-more',
        '.load-more-button',
        '.infinite-scroll-trigger',
        
        // Site-specific patterns
        '.pagination .next a',
        '.pagination-next a',
        '.next-page a',
        '.pagination a[href*="page="]',
        '.pagination a[href*="p="]',
        
        // Generic patterns
        'a[href*="page="]',
        'a[href*="p="]',
        'a[href*="offset="]',
        'a[href*="start="]'
    ],
    
    // Previous page selectors for validation
    prevPageSelectors: [
        'a[rel="prev"]',
        '.pagination .prev',
        '.pagination-prev',
        '.prev-page',
        '[aria-label="Previous page"]',
        '[aria-label="Previous"]',
        '.prev'
    ],
    
    // URL patterns for pagination detection
    urlPatterns: {
        page: /[?&]page=(\d+)/,
        p: /[?&]p=(\d+)/,
        offset: /[?&]offset=(\d+)/,
        start: /[?&]start=(\d+)/
    }
};

// Enhanced site-specific configurations
const SITE_CONFIGS = {
    'gettyimages.com': {
        nextPageSelectors: [
            'button[data-automation="mosaic-load-more-button"]',
            '.pagination-next',
            '[aria-label="Load more"]',
            '.pagination .next'
        ],
        imageSelectors: [
            'img[data-testid="asset-card-image"]',
            '.asset-card img',
            '.mosaic-asset img'
        ],
        linkSelectors: [
            'a[data-testid="asset-card-link"]',
            '.asset-card a',
            '.mosaic-asset a'
        ],
        waitTime: 3000,
        scrollDelay: 2000
    },
    
    'shutterstock.com': {
        nextPageSelectors: [
            '.pagination .next',
            '.pagination-next',
            'a[rel="next"]',
            '.next-page'
        ],
        imageSelectors: [
            '.asset-card img',
            '.search-result img',
            '.thumbnail img'
        ],
        linkSelectors: [
            '.asset-card a',
            '.search-result a',
            '.thumbnail a'
        ],
        waitTime: 2500,
        scrollDelay: 1500
    },
    
    'mirrorpix.com': {
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a'
        ],
        waitTime: 2000,
        scrollDelay: 1000
    },
    
    'imago-images.com': {
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a'
        ],
        waitTime: 2000,
        scrollDelay: 1000
    },
    
    'actionpress.de': {
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a'
        ],
        waitTime: 2000,
        scrollDelay: 1000
    },
    
    'newscom.com': {
        nextPageSelectors: [
            '.pagination .next',
            '.next-page',
            'a[rel="next"]'
        ],
        imageSelectors: [
            '.search-result img',
            '.thumbnail img',
            '.image-container img'
        ],
        linkSelectors: [
            '.search-result a',
            '.thumbnail a',
            '.image-container a'
        ],
        waitTime: 2000,
        scrollDelay: 1000
    }
};

// Enhanced utility functions
const Utils = {
    // Wait for a specific duration
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // Get current site configuration
    getSiteConfig: () => {
        const hostname = window.location.hostname;
        return SITE_CONFIGS[hostname] || {
            nextPageSelectors: PAGINATION_PATTERNS.nextPageSelectors,
            imageSelectors: ['img'],
            linkSelectors: ['a'],
            waitTime: 2000,
            scrollDelay: 1000
        };
    },
    
    // Enhanced URL validation
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
    
    // Extract filename from URL
    getFilenameFromUrl: (url) => {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            let filename = pathSegments.pop() || pathSegments.pop();
            
            if (filename) {
                // Remove query parameters
                filename = filename.split('?')[0];
                // Remove hash
                filename = filename.split('#')[0];
                
                // If no extension, add .jpg as default
                if (!filename.includes('.')) {
                    filename += '.jpg';
                }
                
                return filename;
            }
        } catch (e) {
            console.error('Error parsing URL:', url, e);
        }
        return 'unnamed_image.jpg';
    },
    
    // Generate unique filename
    generateUniqueFilename: (baseFilename, existingFiles) => {
        if (!existingFiles.includes(baseFilename)) {
            return baseFilename;
        }
        
        const nameParts = baseFilename.split('.');
        const extension = nameParts.pop();
        const baseName = nameParts.join('.');
        
        let counter = 1;
        let newFilename = `${baseName}_${counter}.${extension}`;
        
        while (existingFiles.includes(newFilename)) {
            counter++;
            newFilename = `${baseName}_${counter}.${extension}`;
        }
        
        return newFilename;
    },

    // Resolve best URL from an <img> element, srcset, or background-image
    resolveBestImageUrl: (element) => {
        try {
            // If element is <img> with src
            if (element.tagName === 'IMG' && element.src) {
                return element.src;
            }
            // Handle srcset (img or source)
            const srcset = element.getAttribute && element.getAttribute('srcset');
            if (srcset) {
                // Pick the last (usually largest) candidate
                const candidates = srcset.split(',').map(s => s.trim().split(' ')[0]).filter(Boolean);
                if (candidates.length > 0) return candidates[candidates.length - 1];
            }
            // Handle background-image style
            const style = window.getComputedStyle(element);
            const bg = style && style.backgroundImage;
            if (bg && bg !== 'none') {
                const match = bg.match(/url\(["']?(.*?)["']?\)/);
                if (match && match[1]) return match[1];
            }
        } catch (e) {}
        return null;
    }
};

// Enhanced page loading detection
async function waitForPageLoad(timeout = 30000) {
    const startTime = Date.now();
    
    // Wait for document ready state
    while (document.readyState !== 'complete') {
        if (Date.now() - startTime > timeout) {
            throw new Error('Page load timeout');
        }
        await Utils.wait(100);
    }
    
    // Wait for network idle (no active requests for 2 seconds)
    let lastRequestTime = Date.now();
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    
    // Override fetch to track requests
    window.fetch = function(...args) {
        lastRequestTime = Date.now();
        return originalFetch.apply(this, args);
    };
    
    // Override XMLHttpRequest to track requests
    XMLHttpRequest.prototype.open = function(...args) {
        lastRequestTime = Date.now();
        return originalXHROpen.apply(this, args);
    };
    
    // Wait for network idle
    while (Date.now() - lastRequestTime < 2000) {
        if (Date.now() - startTime > timeout) {
            break;
        }
        await Utils.wait(100);
    }
    
    // Restore original functions
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    
    // Additional wait for dynamic content
    await Utils.wait(1000);
    
    sendStatusUpdate('Page loaded successfully');
}

// Enhanced scrolling for lazy loading
async function scrollToLoadContent(scrollDelay = 1000) {
    sendStatusUpdate('Scrolling to load lazy content...');
    
    let lastHeight = document.body.scrollHeight;
    let scrollAttempts = 0;
    const maxScrollAttempts = 15; // Increased from 10
    let noChangeCount = 0;
    const maxNoChange = 3;
    
    const scrollStep = async () => {
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        await Utils.wait(scrollDelay);
        
        const newHeight = document.body.scrollHeight;
        scrollAttempts++;
        
        if (newHeight > lastHeight) {
            lastHeight = newHeight;
            noChangeCount = 0;
            sendStatusUpdate(`Scrolling... (${scrollAttempts}/${maxScrollAttempts})`);
            
            if (scrollAttempts < maxScrollAttempts) {
                await scrollStep();
            }
        } else {
            noChangeCount++;
            if (noChangeCount >= maxNoChange || scrollAttempts >= maxScrollAttempts) {
                // Scroll back to top
                window.scrollTo(0, 0);
                sendStatusUpdate(`Lazy loading complete (${scrollAttempts} scrolls)`);
                return;
            }
            
            // Try scrolling again after a longer delay
            await Utils.wait(scrollDelay * 2);
            await scrollStep();
        }
    };
    
    await scrollStep();
}

// Enhanced next page detection
async function findNextPageButton() {
    const config = Utils.getSiteConfig();
    
    // Try site-specific selectors first
    for (const selector of config.nextPageSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) { // Check if visible
            return element;
        }
    }
    
    // Try generic pagination patterns
    for (const selector of PAGINATION_PATTERNS.nextPageSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
            return element;
        }
    }
    
    // Try URL-based pagination detection
    const currentUrl = new URL(window.location.href);
    const urlPatterns = PAGINATION_PATTERNS.urlPatterns;
    
    for (const [param, pattern] of Object.entries(urlPatterns)) {
        const match = currentUrl.search.match(pattern);
        if (match) {
            const currentPage = parseInt(match[1]);
            const nextPage = currentPage + 1;
            
            // Try to find a link with the next page number
            const links = document.querySelectorAll('a[href*="' + param + '=' + nextPage + '"]');
            for (const link of links) {
                if (link.offsetParent !== null) {
                    return link;
                }
            }
        }
    }
    
    return null;
}

// Enhanced navigation to next page
async function navigateToNextPage() {
    try {
        const nextButton = await findNextPageButton();
        
        if (!nextButton) {
            sendStatusUpdate('No next page button found', 'warn');
            return false;
        }
        
        // Get the href or action
        let nextUrl = null;
        if (nextButton.tagName === 'A') {
            nextUrl = nextButton.href;
        } else if (nextButton.tagName === 'BUTTON') {
            // Check for data attributes that might contain the URL
            nextUrl = nextButton.dataset.href || nextButton.dataset.url;
        }
        
        if (nextUrl) {
            // Navigate to the URL
            window.location.href = nextUrl;
        } else {
            // Click the button
            nextButton.click();
        }
        
        sendStatusUpdate('Navigating to next page...');
        return true;
        
    } catch (error) {
        sendStatusUpdate(`Next page navigation error: ${error.message}`, 'error');
        return false;
    }
}

// Enhanced data extraction
async function extractPageData() {
    const config = Utils.getSiteConfig();
    const pageData = {
        thumbnails: [],
        destinations: [],
        metadata: []
    };
    
    // Try site-specific selectors first
    let images = [];
    for (const selector of config.imageSelectors) {
        images = document.querySelectorAll(selector);
        if (images.length > 0) break;
    }
    
    // Fallback to generic image selection
    if (images.length === 0) {
        images = document.querySelectorAll('img, [style*="background-image"], source[srcset], img[srcset]');
    }
    
    // Extract data from images
    for (const el of images) {
        const urlCandidate = Utils.resolveBestImageUrl(el);
        if (!urlCandidate || !Utils.isValidImageUrl(urlCandidate)) continue;
        
        const thumbnailUrl = urlCandidate;
        let destinationUrl = '';
        
        // Find the closest parent link
        const parentLink = el.closest && el.closest('a');
        if (parentLink && parentLink.href) {
            destinationUrl = parentLink.href;
        }
        
        // Try site-specific link selectors
        if (!destinationUrl) {
            for (const selector of config.linkSelectors) {
                const link = el.closest && el.closest(selector);
                if (link && link.href) {
                    destinationUrl = link.href;
                    break;
                }
            }
        }
        
        // Extract metadata
        const metadata = {
            alt: el.alt || el.getAttribute && el.getAttribute('alt') || '',
            title: el.title || el.getAttribute && el.getAttribute('title') || '',
            width: el.naturalWidth || el.width || 0,
            height: el.naturalHeight || el.height || 0,
            filename: Utils.getFilenameFromUrl(thumbnailUrl)
        };
        
        pageData.thumbnails.push(thumbnailUrl);
        pageData.destinations.push(destinationUrl);
        pageData.metadata.push(metadata);
    }
    
    // Remove duplicates while preserving order
    const seen = new Set();
    const uniqueData = {
        thumbnails: [],
        destinations: [],
        metadata: []
    };
    
    for (let i = 0; i < pageData.thumbnails.length; i++) {
        const key = pageData.thumbnails[i] + '|' + pageData.destinations[i];
        if (!seen.has(key)) {
            seen.add(key);
            uniqueData.thumbnails.push(pageData.thumbnails[i]);
            uniqueData.destinations.push(pageData.destinations[i]);
            uniqueData.metadata.push(pageData.metadata[i]);
        }
    }
    
    return uniqueData;
}

// Enhanced single page scraping
async function scrapeCurrentPage(settings, pageNumber = null) {
    if (!shouldScrapeContinue) {
        sendStatusUpdate('Scraping stopped by user', 'warn');
        return;
    }
    
    try {
        const pageNum = pageNumber || 1;
        sendStatusUpdate(`Scraping page ${pageNum}...`);
        
        // Wait for page to load
        await waitForPageLoad(settings.maxWaitTime || 30000);
        
        // Scroll to load lazy content if enabled
        if (settings.autoScroll !== false) {
            await scrollToLoadContent(settings.scrollDelay || 1000);
        }
        
        // Extract data
        const pageData = await extractPageData();
        
        // Add to global scraped data
        scrapedData.thumbnails.push(...pageData.thumbnails);
        scrapedData.destinations.push(...pageData.destinations);
        scrapedData.metadata.push(...pageData.metadata);
        
        sendStatusUpdate(`Page ${pageNum}: Found ${pageData.thumbnails.length} images`);
        
        // Send data to background script
        chrome.runtime.sendMessage({
            action: 'pageData',
            data: {
                pageNumber: pageNum,
                thumbnails: pageData.thumbnails,
                destinations: pageData.destinations,
                metadata: pageData.metadata
            }
        });
        
    } catch (error) {
        sendStatusUpdate(`Error scraping page ${pageNumber}: ${error.message}`, 'error');
        chrome.runtime.sendMessage({
            action: 'scrapingError',
            error: error.message,
            pageNumber: pageNumber
        });
    }
}

// Enhanced multi-page scraping
async function scrapeAllPages(settings) {
    if (!shouldScrapeContinue) {
        sendStatusUpdate('Scraping stopped by user', 'warn');
        return;
    }
    
    currentSettings = settings;
    isScraping = true;
    let pageNumber = 1;
    const maxPages = settings.maxPages || 100;
    
    try {
        while (shouldScrapeContinue && pageNumber <= maxPages) {
            // Scrape current page
            await scrapeCurrentPage(settings, pageNumber);
            
            // Check if we should continue
            if (!shouldScrapeContinue) {
                sendStatusUpdate('Scraping stopped by user ⏹️');
                break;
            }
            
            // Navigate to next page
            const navigated = await navigateToNextPage();
            
            if (!navigated) {
                sendStatusUpdate('Could not navigate to next page', 'warn');
                break;
            }
            
            sendStatusUpdate('Waiting for next page to load...');
            
            // Randomized human-like wait before next page
            const baseWait = settings.pageWaitTime || 2000;
            const jitter = Math.floor(Math.random() * 800) + 200; // 200-1000ms jitter
            await Utils.wait(baseWait + jitter);
            
            pageNumber++;
        }
        
        // Send completion message
        chrome.runtime.sendMessage({
            action: 'scrapingComplete',
            data: scrapedData
        });
        
        sendStatusUpdate(`Scraping complete! Total: ${scrapedData.thumbnails.length} images from ${pageNumber - 1} pages`);
        
    } catch (error) {
        sendStatusUpdate(`Scraping error: ${error.message}`, 'error');
        chrome.runtime.sendMessage({
            action: 'scrapingError',
            error: error.message
        });
    } finally {
        isScraping = false;
    }
}

// Status update function
function sendStatusUpdate(message, type = 'info') {
    chrome.runtime.sendMessage({
        action: 'statusUpdate',
        message: message,
        type: type
    });
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'startScraping':
            shouldScrapeContinue = true;
            scrapedData = { thumbnails: [], destinations: [], metadata: [] };
            scrapeAllPages(message.settings);
            sendResponse({ success: true });
            break;
            
        case 'stopScraping':
            shouldScrapeContinue = false;
            sendStatusUpdate('Stopping scraping...', 'warn');
            sendResponse({ success: true });
            break;
            
        case 'pauseScraping':
            shouldScrapeContinue = false;
            sendStatusUpdate('Scraping paused ⏸️');
            sendResponse({ success: true });
            break;
            
        case 'resumeScraping':
            shouldScrapeContinue = true;
            isScraping = true;
            sendStatusUpdate('Scraping resumed ▶️');
            
            // Continue scraping if we were in the middle of a multi-page scrape
            if (currentSettings && shouldScrapeContinue) {
                setTimeout(() => {
                    scrapeCurrentPage(currentSettings, null);
                }, 1000);
            }
            
            sendResponse({ success: true });
            break;
            
        case 'getStatus':
            sendResponse({
                isScraping: isScraping,
                shouldContinue: shouldScrapeContinue,
                dataCount: scrapedData.thumbnails.length
            });
            break;
            
        case 'getCurrentData':
            sendResponse(scrapedData);
            break;
    }
    
    return true; // Keep message channel open for async response
});

// Initialize
sendStatusUpdate('MasterScraper content script ready 🚀');