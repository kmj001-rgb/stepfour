// Injected script to bypass CSP restrictions on imago-images.com
// This script runs in the page context and can communicate with the content script

console.log('[Gallery Scraper] Injected script loaded');

// Global variables for the injected script
let shouldScrapeContinue = false;
let processedImageUrlsOnPage = new Set();

// Message handling for communication with content script
window.addEventListener('message', function(event) {
    // Only accept messages from our content script
    if (event.source !== window) return;
    if (event.data.type !== 'GALLERY_SCRAPER_INJECTED') return;
    
    console.log('[Gallery Scraper] Injected script received message:', event.data);
    
    const { action, settings, siteProfile } = event.data;
    
    if (action === 'startScrapePage') {
        handleScrapePage(settings, siteProfile);
    } else if (action === 'startScrapeAllPages') {
        handleScrapeAllPages(settings, siteProfile);
    } else if (action === 'stopScraping') {
        shouldScrapeContinue = false;
        sendResponse({ success: true, message: 'Scraping stopped' });
    } else if (action === 'pauseScraping') {
        shouldScrapeContinue = false;
        sendResponse({ success: true, message: 'Scraping paused' });
    } else if (action === 'resumeScraping') {
        shouldScrapeContinue = true;
        sendResponse({ success: true, message: 'Scraping resumed' });
    }
});

// Send response back to content script
function sendResponse(data) {
    window.postMessage({
        type: 'GALLERY_SCRAPER_RESPONSE',
        ...data
    }, '*');
}

// Send status update to content script
function sendStatusUpdate(message, type = 'info') {
    window.postMessage({
        type: 'GALLERY_SCRAPER_STATUS',
        message,
        type,
        timestamp: Date.now()
    }, '*');
}

// Wait for page to be ready
async function waitForPageReady(maxWaitMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
        if (document.readyState === 'complete') {
            // Additional wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if network is idle
            const isNetworkIdle = await waitForNetworkIdle(2000);
            if (isNetworkIdle) {
                sendStatusUpdate('Page ready ✅');
                return true;
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    sendStatusUpdate('Page load timeout - proceeding anyway ⚠️', 'warn');
    return false;
}

// Wait for network idle
async function waitForNetworkIdle(idleTime = 2000) {
    return new Promise((resolve) => {
        let timeout;
        
        const checkIdle = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => resolve(true), idleTime);
        };
        
        checkIdle();
        
        // Listen for fetch requests
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
        
        setTimeout(() => resolve(false), 10000);
    });
}

// Scroll to bottom to load all content
async function scrollToBottom(scrollDelay = 500) {
    const maxScrolls = 20;
    let scrollCount = 0;
    
    while (scrollCount < maxScrolls && shouldScrapeContinue) {
        const previousHeight = document.documentElement.scrollHeight;
        
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        const newHeight = document.documentElement.scrollHeight;
        if (newHeight === previousHeight) {
            break; // No more content to load
        }
        
        scrollCount++;
        sendStatusUpdate(`Scrolled ${scrollCount} times`);
    }
}

// Extract image and link data
async function extractImageAndLinkData(minImageWidth = 200, minImageHeight = 200, siteProfile = null) {
    const thumbnailData = [];
    const failedExtractions = [];
    
    sendStatusUpdate('Extracting image data... 🔍');
    
    // Build selector list based on site profile or defaults
    let selectors = [];
    
    if (siteProfile && siteProfile.selectors) {
        const { imageContainer } = siteProfile.selectors;
        if (imageContainer) {
            selectors.push(imageContainer);
            sendStatusUpdate(`🎯 Using site-specific selectors for ${siteProfile.name || 'detected site'}`);
        }
    }
    
    // Add Imago-specific selectors
    const imagoSelectors = [
        '.search-result-item', '.image-tile', '.gallery-item', '[data-media-id]',
        '.result-item', '.search-result', '.media-item', '.image-container',
        '.search-results .item', '.gallery .item', '.results .item',
        '[class*="search-result"]', '[class*="image-item"]', '[class*="gallery-item"]'
    ];
    
    // Add universal fallback selectors
    const universalSelectors = [
        '.gallery-item', '.search-result', '.image-item', '.photo-item',
        '.result-item', '.thumbnail', '.card', '.tile', '.grid-item',
        '[data-testid*="image"]', '[data-testid*="photo"]', '[data-testid*="result"]',
        '.image-container', '.photo-container', '.media-item',
        'article img', 'figure img', '.content img',
        'a[href*="image"]', 'a[href*="photo"]', 'a[href*="gallery"]'
    ];
    
    // Prioritize site-specific, then Imago-specific, then universal selectors
    const defaultSelectors = [...selectors, ...imagoSelectors, ...universalSelectors].filter(Boolean);
    
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

// Validate if URL is a valid image URL
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

// Handle single page scraping
async function handleScrapePage(settings, siteProfile) {
    shouldScrapeContinue = true;
    const { maxWait, scrollDelay, minImageWidth, minImageHeight } = settings;
    
    console.log('[Gallery Scraper] Starting single page scrape with injected script');
    
    try {
        sendStatusUpdate('Starting single page scrape... 🚀');
        
        // Wait for page to be ready
        const pageReady = await waitForPageReady(maxWait);
        
        if (!pageReady || !shouldScrapeContinue) {
            sendStatusUpdate('Page not ready - stopping', 'error');
            sendResponse({ success: false, error: 'Page not ready' });
            return;
        }
        
        // Scroll to load all content
        await scrollToBottom(scrollDelay);
        if (!shouldScrapeContinue) {
            sendResponse({ success: false, error: 'Scraping stopped' });
            return;
        }
        
        // Extract data
        const { thumbnailData, failedExtractions } = await extractImageAndLinkData(
            minImageWidth, 
            minImageHeight,
            siteProfile
        );
        
        if (!shouldScrapeContinue) {
            sendResponse({ success: false, error: 'Scraping stopped' });
            return;
        }
        
        // Send data back to content script
        sendResponse({
            success: true,
            data: {
                thumbnails: thumbnailData,
                failedExtractions: failedExtractions,
                currentPageUrl: window.location.href,
                isIntermediate: false
            }
        });
        
        sendStatusUpdate(`✅ Single page complete: ${thumbnailData.length} items found`);
        
    } catch (error) {
        sendStatusUpdate(`❌ Error during scrape: ${error.message}`, 'error');
        sendResponse({ success: false, error: error.message });
    }
}

// Handle multi-page scraping
async function handleScrapeAllPages(settings, siteProfile) {
    shouldScrapeContinue = true;
    const { maxWait, scrollDelay, minImageWidth, minImageHeight } = settings;
    
    console.log('[Gallery Scraper] Starting multi-page scrape with injected script');
    
    try {
        sendStatusUpdate('Starting multi-page scrape... 🚀');
        
        // For now, just scrape the current page
        // Multi-page functionality can be added later
        await handleScrapePage(settings, siteProfile);
        
    } catch (error) {
        sendStatusUpdate(`❌ Error during multi-page scrape: ${error.message}`, 'error');
        sendResponse({ success: false, error: error.message });
    }
}

// Send ready message
sendStatusUpdate('🔧 Gallery Scraper Pro injected script loaded and ready');

// Add error handling for unhandled errors
window.addEventListener('error', function(event) {
    console.error('[Gallery Scraper] Injected script error:', event.error);
    sendStatusUpdate(`❌ Script error: ${event.error?.message || 'Unknown error'}`, 'error');
});

// Add unhandled promise rejection handling
window.addEventListener('unhandledrejection', function(event) {
    console.error('[Gallery Scraper] Unhandled promise rejection:', event.reason);
    sendStatusUpdate(`❌ Promise error: ${event.reason?.message || 'Unknown error'}`, 'error');
});

// Log successful injection
console.log('[Gallery Scraper] ✅ Injected script successfully loaded and initialized');