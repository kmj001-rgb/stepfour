// background.js - Gallery Scraper Pro Background Service Worker
// Handles downloads, network monitoring, state management, and coordination

// ============================================================================
// ERROR MESSAGES & HELPERS
// ============================================================================

const ERROR_MESSAGES = {
    'NETWORK_ERROR': '🌐 Network connection issue - check your internet connection',
    'TIMEOUT': '⏰ Page took too long to load - try increasing the wait time in settings',
    'NO_IMAGES': '🖼️ No images found - the page might not have loaded completely or selectors need adjustment',
    'DOWNLOAD_FAILED': '📥 Download failed - the file may be protected, moved, or require authentication',
    'PAGINATION_FAILED': '📄 Cannot find next page - pagination might be complete or page structure changed',
    'SELECTOR_ERROR': '🎯 Element selector not found - the site layout may have changed',
    'PERMISSION_ERROR': '🔒 Permission denied - check if the site requires login or has access restrictions',
    'RATE_LIMITED': '🚦 Rate limited by server - try reducing concurrent downloads or adding delays',
    'INVALID_URL': '🔗 Invalid URL format - please check the link and try again',
    'STORAGE_ERROR': '💾 Storage error - check available disk space and permissions',
    'SCRIPT_ERROR': '⚙️ Script execution error - the page might have security restrictions'
};

/**
 * Get helpful error message with troubleshooting guidance
 * @param {string} errorType - Type of error
 * @param {string} details - Additional error details
 * @returns {string} Formatted error message
 */
function getHelpfulError(errorType, details = '') {
    const baseMessage = ERROR_MESSAGES[errorType] || '❌ An unexpected error occurred';
    
    let helpfulMessage = baseMessage;
    
    // Add specific troubleshooting tips
    switch (errorType) {
        case 'TIMEOUT':
            helpfulMessage += '\n💡 Try: Increase "Page Wait" to 45-60 seconds in settings';
            break;
        case 'NO_IMAGES':
            helpfulMessage += '\n💡 Try: Wait for the page to fully load, or check if custom selectors are needed';
            break;
        case 'DOWNLOAD_FAILED':
            helpfulMessage += '\n💡 Try: Check if you\'re logged into the site, or reduce concurrent downloads';
            break;
        case 'RATE_LIMITED':
            helpfulMessage += '\n💡 Try: Use "Max Compatible" preset or reduce "Max Downloads" to 2-3';
            break;
        case 'SELECTOR_ERROR':
            helpfulMessage += '\n💡 Try: The site may have updated - try different selectors or contact support';
            break;
    }
    
    if (details) {
        helpfulMessage += `\n📋 Details: ${details}`;
    }
    
    return helpfulMessage;
}

// ============================================================================
// SITE-SPECIFIC PROFILES
// ============================================================================

const SITE_PROFILES = {
    'gettyimages.com': {
        name: 'Getty Images',
        selectors: {
            // Based on actual Getty Images HTML structure from user's sample
            // Primary: Look for containers with Getty's specific image classes
            imageContainer: 'img.Xc8V0Fvh0qg0lUySLpoi, [data-testid="gallery-asset"], .search-result-item, figure[data-testid], .gallery-mosaic-asset, .mosaic-asset',
            imageElement: 'img.Xc8V0Fvh0qg0lUySLpoi, img[data-testid="image"], .search-result-asset img, .gallery-mosaic-asset img, .mosaic-asset img',
            linkElement: 'a[href*="/detail/"], a[href*="/photos/"], a[href*="/photo/"], a[data-testid="asset-link"], .gallery-mosaic-asset a, .mosaic-asset a',
            nextPageButton: 'button[data-testid="pagination-next"], .pagination-next:not([disabled]), [aria-label*="Next page"]:not([disabled]), button[aria-label*="next"], .pagination a:last-child',
            loadMoreButton: 'button[data-testid="load-more"], .load-more-button, .infinite-scroll-trigger, [data-testid="show-more"], button[data-testid="show-more-button"]'
        },
        waitSettings: {
            pageLoad: 8000, // Getty can be slow, especially with search results
            scrollDelay: 1500, // Slower scrolling for better loading of high-res previews
            afterScroll: 3000 // More time for lazy loading and network requests
        },
        scrollBehavior: {
            strategy: 'incremental', // scroll gradually to trigger lazy loading
            maxScrolls: 20, // Getty has many results, especially for popular searches
            checkInterval: 2000 // Wait longer between scroll checks for network requests
        },
        special: {
            hasInfiniteScroll: true,
            requiresAuthentication: false, // Public browsing available
            hasLazyLoading: true,
            customWaitForImages: true, // Getty loads images progressively with different resolutions
            respectsRobotsTxt: true,
            hasHighQualityPreviews: true, // Getty serves multiple image sizes
            usesProgressiveLoading: true // Images load from low to high resolution
        }
    },
    'gettyimages.co.uk': {
        name: 'Getty Images UK',
        extends: 'gettyimages.com' // Inherits from main Getty profile
    },
            'mirrorpix.com': {
        name: 'Mirrorpix',
        selectors: {
            // REFINED SELECTORS: Based on actual HTML structure provided by user (January 2025)
            // Confirmed image pattern: <img class="medium medium-02031305 medium-thumbnail medium-vm-float medium-filetype-jpeg medium-image medium-static medium-draggable ui-draggable" alt="02031305" loading="lazy" height="133" width="200" id="medium__29aeda4c8284" src="/thumb.php/02031305.jpg?eJw...">
            // Most specific and reliable selectors based on actual DOM structure
            imageContainer: 'img.medium-thumbnail.medium-image.ui-draggable, img.medium.medium-thumbnail, img[id^="medium__"], img[src*="thumb.php"], img.medium-static.medium-draggable',
            imageElement: 'img.medium-thumbnail.medium-image.ui-draggable, img.medium.medium-thumbnail, img[id^="medium__"], img[src*="thumb.php"], img.medium-static.medium-draggable',
            // Enhanced link detection for webgate.js framework with jQuery UI draggable system
            // Mirrorpix likely uses programmatic click handlers through jQuery rather than traditional <a> tags
            linkElement: 'a:has(img.medium-thumbnail), a:has(img[id^="medium__"]), a:has(img[src*="thumb.php"]), img.medium-thumbnail[onclick], img[id^="medium__"][onclick], img.ui-draggable[onclick], a[href*="detail"], a[href*="view"], a[href*="media"], [data-medium-id], .ui-draggable[data-url], img[data-href], img.medium-image[data-url]',
            // Pagination selectors optimized for webgate CMS with numbered buttons support
            nextPageButton: '.pagination .next, .pagination-next, .pager .next, .page-next, button[title*="Next"], a[title*="Next"], button[aria-label*="Next"], a[aria-label*="Next"], .ui-pagination .next, .webgate-pagination .next, [onclick*="nextPage"], [href*="page="], .pagination a:last-child, .numbered-pagination .next, a[href*="?page"], button[data-page], .menutree a[href*="page"]',
            loadMoreButton: '.load-more, .show-more, .pagination-load-more, .infinite-scroll-trigger, button[onclick*="loadMore"], .webgate-load-more'
        },
        waitSettings: {
            pageLoad: 10000, // Increased for complex jQuery UI system with multiple libraries (jquery-ui.js, jquery.contextMenu.js, webgate.js, gui.js, etc.)
            scrollDelay: 2000, // Longer delay for ui-draggable initialization, lazy loading="lazy", and jQuery animations
            afterScroll: 4000 // Extra time for image loading, draggable interface setup, potential AJAX calls, and SmartFrame integration
        },
        scrollBehavior: {
            strategy: 'smooth', // Smooth scrolling for better UX with draggable images and jQuery UI components
            maxScrolls: 30, // Increased for comprehensive coverage of historical archive with deep pagination
            checkInterval: 2000 // Longer interval for jQuery animations, lazy loading, and complex JavaScript processing
        },
        special: {
            hasInfiniteScroll: false, // Uses traditional pagination with numbered buttons (confirmed by user)
            requiresAuthentication: false, // Free to browse as mentioned by user
            hasLazyLoading: true, // Images use loading="lazy" attribute (confirmed in HTML sample)
            usesCustomImageClasses: true, // Uses complex "medium-*" class system with multiple descriptive classes
            hasDraggableImages: true, // Images have ui-draggable class for interface functionality
            usesPhpThumbs: true, // Uses thumb.php/[id].jpg?[encoded_params] for dynamic image serving (confirmed in HTML)
            hasHistoricalArchive: true, // Extensive historical photo archive from UK newspapers (Daily Mirror, Sunday Mirror, etc.)
            usesNumberedPagination: true, // Uses numbered pagination buttons as mentioned by user
            hasComplexImageClasses: true, // Images have multiple classes: "medium medium-[id] medium-thumbnail medium-vm-float medium-filetype-jpeg medium-image medium-static medium-draggable ui-draggable"
            usesUniqueImageIds: true, // Images have unique IDs like "medium__29aeda4c8284" for individual targeting
            hasComplexClassStructure: true, // Each image has multiple descriptive classes including file type and drag functionality
            usesReachPlcArchive: true, // Archive from Reach PLC (Daily Mirror, Sunday Mirror, Daily Record, etc.)
            usesJQueryUI: true, // Heavy use of jQuery UI components (jquery-ui.min.js, draggable, contextMenu, progressbar)
            hasContextMenus: true, // Uses jquery.contextMenu.js for right-click functionality on images
            hasProgressBars: true, // Uses jquery.progressbar.js for loading states and progress indication
            hasComplexJavaScript: true, // Multiple JS libraries: webgate.js (v132), gui.js (v161), jquery libraries
            usesLegacyTheme: true, // Uses older theme system (theme3) with specific CSS structure and webfonts
            hasSmartFrameIntegration: true, // Has SmartFrame embed code generator integration (confirmed in HTML)
            usesAdvancedSearch: true, // Complex search form with radio buttons, checkboxes, and geographic filtering
            hasAutoComplete: true, // Uses jquery.autocomplete.js for search suggestions
            hasMouseWheelSupport: true, // jquery.mousewheel.js for enhanced scrolling
            usesCookieSupport: true, // jquery.cookie.js for state management
            hasHotKeySupport: true, // jquery.hotkeys.js for keyboard shortcuts
            hasScrollPanes: true, // jquery.jscrollpane.js for custom scrolling areas
            hasTouchSupport: true, // jquery.touchSwipe.min.js for mobile compatibility
            hasTreeViews: true, // jquery.treeview.js for hierarchical navigation
            hasImageFiltering: true, // caman.full.pack.js for image manipulation
            hasFileUploads: true, // dropzone.min.js for file upload functionality
            hasMapsIntegration: true, // leaflet.js for geographic mapping
            hasVideoPlayer: true, // jwplayer.js for video content
            usesWebGateFramework: true, // Custom webgate.js framework for gallery management
            hasResponsiveDesign: true, // Viewport meta tag and device detection
            hasCookieConsent: true, // Cookiebot integration for GDPR compliance
            usesSecurityTokens: true, // Security token service for form protection ($.bsfunctions.forms.security.token_service_url)
            hasComplexNavigation: true, // Complex navigation with menutree classes and hierarchical structure
            usesProgressiveEnhancement: true, // Graceful degradation with multiple fallbacks and feature detection
            hasAdvancedFormHandling: true, // Complex forms with radio buttons, checkboxes, autocomplete, and validation
            usesContentManagement: true, // Full content management system with webgate framework
            hasMultiLanguageSupport: true, // Language selection and locale handling
            usesAdvancedCaching: true, // Complex caching with versioned assets and cache busting parameters
            hasMetaDataRichness: true, // Rich meta data including OpenGraph, Twitter Cards, and schema.org markup
            usesAdvancedSecurity: true, // CSRF tokens, content security policies, and secure form handling
            hasComplexAssetManagement: true, // Versioned CSS/JS assets with cache busting (e.g., ?version=109, ?version=132)
            usesModularArchitecture: true // Modular loading of CSS and JavaScript components with dependency management
        }
    },
    'actionpress.de': {
        name: 'ActionPress',
        selectors: {
            // ActionPress uses picturemaxx backend with specific German interface
            imageContainer: '.media-result, .image-item, .search-result, [data-media-id]',
            imageElement: '.media-result img, .image-item img, .search-result img',
            linkElement: '.media-result a, .image-item a, .search-result a[href*="detail"]',
            nextPageButton: '.pagination .next, .weiter, [aria-label*="weiter"], [title*="Next"]',
            loadMoreButton: '.mehr-laden, .load-more-results, .show-more'
        },
        waitSettings: {
            pageLoad: 5500, // German servers can be slower
            scrollDelay: 1200,
            afterScroll: 2200
        },
        scrollBehavior: {
            strategy: 'incremental',
            maxScrolls: 15,
            checkInterval: 1200
        },
        special: {
            hasInfiniteScroll: true,
            requiresAuthentication: true,
            hasLazyLoading: true,
            usesPictureMaxx: true, // Uses picturemaxx backend
            languageSpecific: 'de'
        }
    },
    'news-images.smartframe.io': {
        name: 'SmartFrame News Images',
        selectors: {
            // SmartFrame technology with specialized news image structure
            imageContainer: '.sf-grid-item, .sf-asset, .smartframe-item, [data-sf-asset]',
            imageElement: '.sf-grid-item img, .sf-asset img, .smartframe-item img, iframe[src*="smartframe"]',
            linkElement: '.sf-grid-item a, .sf-asset a, .smartframe-item a, a[href*="offer"]',
            nextPageButton: '.sf-pagination .next, .pagination-next, [aria-label*="Next page"]',
            loadMoreButton: '.sf-load-more, .load-more-assets, .show-more-results'
        },
        waitSettings: {
            pageLoad: 7000, // SmartFrame can be very slow due to embedding
            scrollDelay: 1500,
            afterScroll: 3000
        },
        scrollBehavior: {
            strategy: 'smooth',
            maxScrolls: 20,
            checkInterval: 2000 // Longer wait for SmartFrame embeds
        },
        special: {
            hasInfiniteScroll: true,
            requiresAuthentication: false,
            hasLazyLoading: true,
            customWaitForImages: true,
            usesSmartFrame: true,
            hasEmbeddedImages: true // Special handling for iframe embeds
        }
    },
    'archive.newsimages.co.uk': {
        name: 'News Images Archive',
        extends: 'news-images.smartframe.io'
    },
    'imago-images.com': {
        name: 'Imago Images',
        selectors: {
            // Imago uses sophisticated German photo agency structure
            imageContainer: '.search-result-item, .image-tile, .gallery-item, [data-media-id], .result-item, .search-result, .media-item, .image-container',
            imageElement: '.search-result-item img, .image-tile img, .gallery-item img, .result-item img, .search-result img, .media-item img, .image-container img',
            linkElement: '.search-result-item a, .image-tile a, .gallery-item a, a[href*="detail"], .result-item a, .search-result a, .media-item a, .image-container a',
            nextPageButton: '.pagination .next, .next-page-btn, [aria-label*="next"], .pagination-next, .next-page, button[aria-label*="Next"]',
            loadMoreButton: '.load-more-results, .show-more-images, .infinite-load, .load-more, .show-more'
        },
        waitSettings: {
            pageLoad: 8000, // German servers, comprehensive metadata - increased wait time
            scrollDelay: 1500,
            afterScroll: 3000
        },
        scrollBehavior: {
            strategy: 'incremental',
            maxScrolls: 20, // Imago has extensive collections
            checkInterval: 1500
        },
        special: {
            hasInfiniteScroll: true,
            requiresAuthentication: true, // Professional agency requiring login
            hasLazyLoading: true,
            highQualityImages: true,
            languageSpecific: 'de',
            needsLongerWait: true // Add flag for longer wait times
        }
    },
    'shutterstock.com': {
        name: 'Shutterstock',
        selectors: {
            // Shutterstock's modern React-based interface with data attributes
            imageContainer: '[data-automation="mosaic-grid-cell"], [data-testid="image-tile"], .tile',
            imageElement: '[data-automation="mosaic-grid-cell-image"], [data-testid="image-tile"] img, .tile img',
            linkElement: '[data-automation="mosaic-grid-cell-overlay"], [data-testid="image-tile"] a, .tile a',
            nextPageButton: '[data-automation="pagination-next-button"], [aria-label*="Next page"], .pagination-next',
            loadMoreButton: '[data-automation="load-more"], .load-more-button, .infinite-scroll-trigger'
        },
        waitSettings: {
            pageLoad: 4000, // React app initialization
            scrollDelay: 800,
            afterScroll: 1500
        },
        scrollBehavior: {
            strategy: 'smooth',
            maxScrolls: 25, // Shutterstock has massive collections
            checkInterval: 1000
        },
        special: {
            hasInfiniteScroll: true,
            requiresAuthentication: false, // Public browsing with watermarks
            hasLazyLoading: true,
            highVolume: true, // Millions of images
            modernFramework: 'react', // React-based SPA
            hasWatermarks: true // Preview images are watermarked
        }
    }
};

/**
 * Detect site profile based on current URL
 * @param {string} url - Current page URL
 * @returns {Object|null} - Site profile or null if no match
 */
function detectSiteProfile(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Remove www. prefix for matching
        const cleanHostname = hostname.replace(/^www\./, '');
        
        // Direct match
        if (SITE_PROFILES[cleanHostname]) {
            const profile = SITE_PROFILES[cleanHostname];
            
            // Handle profile inheritance
            if (profile.extends) {
                const baseProfile = SITE_PROFILES[profile.extends];
                return {
                    ...baseProfile,
                    ...profile,
                    name: profile.name,
                    hostname: cleanHostname
                };
            }
            
            return {
                ...profile,
                hostname: cleanHostname
            };
        }
        
        // Partial hostname matching for subdomains
        for (const [domain, profile] of Object.entries(SITE_PROFILES)) {
            if (cleanHostname.includes(domain) || domain.includes(cleanHostname)) {
                const resolvedProfile = profile.extends ? 
                    { ...SITE_PROFILES[profile.extends], ...profile } : profile;
                
                return {
                    ...resolvedProfile,
                    hostname: cleanHostname
                };
            }
        }
        
        return null;
    } catch (error) {
        logEvent(`Error detecting site profile: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Get fallback selectors for universal compatibility
 * @returns {Object} - Universal selector set
 */
function getUniversalSelectors() {
    return {
        imageContainer: 'a img, .image, .photo, .picture, .thumbnail, [class*="image"], [class*="photo"], [class*="thumb"]',
        imageElement: 'img',
        linkElement: 'a[href]',
        nextPageButton: '.next, .pagination-next, .page-next, [class*="next"], [aria-label*="next" i], [title*="next" i]',
        loadMoreButton: '.load-more, .show-more, .more, [class*="load"], [class*="more"]'
    };
}

/**
 * Merge site profile with user settings
 * @param {Object} siteProfile - Detected site profile
 * @param {Object} userSettings - User's custom settings
 * @returns {Object} - Merged configuration
 */
function mergeSiteProfileWithSettings(siteProfile, userSettings) {
    if (!siteProfile) {
        return {
            selectors: getUniversalSelectors(),
            waitSettings: {
                pageLoad: userSettings.maxWait || 30000,
                scrollDelay: userSettings.scrollDelay || 500,
                afterScroll: 1000
            },
            scrollBehavior: {
                strategy: 'smooth',
                maxScrolls: 10,
                checkInterval: 1000
            },
            special: {
                hasInfiniteScroll: false,
                requiresAuthentication: false,
                hasLazyLoading: true
            }
        };
    }
    
    return {
        ...siteProfile,
        waitSettings: {
            ...siteProfile.waitSettings,
            pageLoad: userSettings.maxWait || siteProfile.waitSettings.pageLoad,
            scrollDelay: userSettings.scrollDelay || siteProfile.waitSettings.scrollDelay
        }
    };
}

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
let incompleteDownloads = [];
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
    
    // Add to incomplete downloads before starting
    const downloadItem = {
        url: url,
        filename: uniqueFilename,
        folder: downloadFolder,
        timestamp: Date.now(),
        completed: false
    };
    
    incompleteDownloads.push(downloadItem);
    saveIncompleteDownloads();
    
    try {
        await chrome.downloads.download({
            url: url,
            filename: uniqueFilename,
            conflictAction: 'overwrite'
        });
        
        // Mark as completed and remove from incomplete list
        downloadItem.completed = true;
        removeIncompleteDownload(url);
        
        logEvent(`Downloaded: ${uniqueFilename}`, 'success');
        
        // Send progress update
        sendToPopup({
            action: 'downloadProgress',
            downloaded: allScrapedThumbnails.length - downloadQueue.length,
            total: allScrapedThumbnails.length,
            currentFile: uniqueFilename,
            completedUrl: url
        });
        
        return true;
        
    } catch (error) {
        // Remove from incomplete downloads on failure
        removeIncompleteDownload(url);
        
        const helpfulError = getHelpfulError('DOWNLOAD_FAILED', error.message);
        logEvent(`Failed to download ${url}: ${helpfulError}`, 'error');
        allFailedExtractions.push(`Download failed: ${url} - ${helpfulError}`);
        
        // Send failure update
        sendToPopup({
            action: 'downloadProgress',
            failedUrl: url,
            error: helpfulError
        });
        
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

/**
 * Resume incomplete downloads from previous session
 */
async function resumeIncompleteDownloads() {
    if (incompleteDownloads.length === 0) {
        return;
    }
    
    logEvent(`Resuming ${incompleteDownloads.length} incomplete downloads...`, 'info');
    
    const downloadsToResume = incompleteDownloads.filter(item => !item.completed);
    
    for (const download of downloadsToResume) {
        try {
            // Add to download queue for processing
            downloadQueue.push({
                url: download.url,
                downloadFolder: download.folder
            });
            
        } catch (error) {
            logEvent(`Error queueing resume download ${download.filename}: ${error.message}`, 'error');
        }
    }
    
    // Start processing the queue
    if (downloadQueue.length > 0) {
        logEvent(`Added ${downloadQueue.length} downloads to resume queue`, 'info');
        processDownloadQueue();
    }
}

/**
 * Save incomplete downloads to storage
 */
function saveIncompleteDownloads() {
    chrome.storage.local.set({ incompleteDownloads });
}

/**
 * Remove completed download from incomplete list
 * @param {string} url - URL of the completed download
 */
function removeIncompleteDownload(url) {
    const index = incompleteDownloads.findIndex(item => item.url === url);
    if (index !== -1) {
        incompleteDownloads.splice(index, 1);
        saveIncompleteDownloads();
    }
}

/**
 * Clear all incomplete downloads (for manual cleanup)
 */
function clearIncompleteDownloads() {
    incompleteDownloads = [];
    chrome.storage.local.remove('incompleteDownloads');
    logEvent('Cleared incomplete downloads list', 'info');
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
    
    // Detect site profile
    const detectedProfile = detectSiteProfile(currentPageUrl);
    const finalConfig = mergeSiteProfileWithSettings(detectedProfile, request.settings);
    
    if (detectedProfile) {
        logEvent(`Starting single page scrape with ${detectedProfile.name} profile`, 'info', currentPageUrl);
    } else {
        logEvent('Starting single page scrape with universal selectors', 'info', currentPageUrl);
    }
    
    // Forward to content script with enhanced settings
    try {
        chrome.tabs.sendMessage(activeTabId, {
            action: 'startScrapePage',
            settings: request.settings,
            siteProfile: finalConfig,
            profileName: detectedProfile?.name || 'Universal'
        }, (response) => {
            if (chrome.runtime.lastError) {
                const helpfulError = getHelpfulError('SCRIPT_ERROR', chrome.runtime.lastError.message);
                logEvent(`Failed to start scraping: ${helpfulError}`, 'error');
                resetScrapeState();
            } else if (!response || !response.success) {
                const error = response?.error || 'No response from content script';
                logEvent(`Failed to start scraping: ${error}`, 'error');
                resetScrapeState();
            } else {
                logEvent('Scraping started successfully', 'info');
            }
        });
    } catch (error) {
        const helpfulError = getHelpfulError('SCRIPT_ERROR', error.message);
        logEvent(`Failed to start scraping: ${helpfulError}`, 'error');
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
    
    // Detect site profile
    const detectedProfile = detectSiteProfile(currentPageUrl);
    const finalConfig = mergeSiteProfileWithSettings(detectedProfile, request.settings);
    
    if (detectedProfile) {
        logEvent(`Starting multi-page scrape with ${detectedProfile.name} profile`, 'info', currentPageUrl);
    } else {
        logEvent('Starting multi-page scrape with universal selectors', 'info', currentPageUrl);
    }
    
    // Forward to content script with enhanced settings
    try {
        chrome.tabs.sendMessage(activeTabId, {
            action: 'startScrapeAllPages',
            settings: request.settings,
            siteProfile: finalConfig,
            profileName: detectedProfile?.name || 'Universal'
        }, (response) => {
            if (chrome.runtime.lastError) {
                const helpfulError = getHelpfulError('SCRIPT_ERROR', chrome.runtime.lastError.message);
                logEvent(`Failed to start scraping: ${helpfulError}`, 'error');
                resetScrapeState();
            } else if (!response || !response.success) {
                const error = response?.error || 'No response from content script';
                logEvent(`Failed to start scraping: ${error}`, 'error');
                resetScrapeState();
            } else {
                logEvent('Scraping started successfully', 'info');
            }
        });
    } catch (error) {
        const helpfulError = getHelpfulError('SCRIPT_ERROR', error.message);
        logEvent(`Failed to start scraping: ${helpfulError}`, 'error');
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
chrome.storage.local.get(['scrapeLog', 'scrapeState', 'incompleteDownloads'], (result) => {
    if (result.scrapeLog) {
        scrapeLog = result.scrapeLog;
    }
    
    // Load incomplete downloads
    if (result.incompleteDownloads) { 
        incompleteDownloads = result.incompleteDownloads;
        if (incompleteDownloads.length > 0) {
            logEvent(`Found ${incompleteDownloads.length} incomplete downloads - will resume when scraping starts`, 'info');
        }
    }
    
    // Resume scraping state if it was interrupted
    if (result.scrapeState && result.scrapeState.isActive) {
        logEvent('Resuming interrupted scraping session...', 'info');
        isScrapingActive = true;
        currentScrapeMode = result.scrapeState.mode || 'all';
        // Resume incomplete downloads if any
        if (incompleteDownloads.length > 0) {
            setTimeout(() => resumeIncompleteDownloads(), 2000); // Delay to ensure everything is ready
        }
    }
});

// Persist state periodically to handle unexpected shutdowns
setInterval(() => {
    if (isScrapingActive) {
        chrome.storage.local.set({
            scrapeState: {
                isActive: isScrapingActive,
                isPaused: isScrapingPaused,
                mode: currentScrapeMode,
                activeTabId: activeTabId,
                currentPageUrl: currentPageUrl,
                timestamp: Date.now()
            }
        });
    }
}, 5000); // Save state every 5 seconds

// Handle extension icon click - open dashboard in new tab
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Check if dashboard is already open
        const tabs = await chrome.tabs.query({});
        const dashboardTab = tabs.find(t => t.url && t.url.includes('dashboard.html'));
        
        if (dashboardTab) {
            // Focus existing dashboard tab
            await chrome.tabs.update(dashboardTab.id, { active: true });
            await chrome.windows.update(dashboardTab.windowId, { focused: true });
            logEvent('Focused existing dashboard tab', 'info');
        } else {
            // Create new dashboard tab
            const dashboardTab = await chrome.tabs.create({
                url: chrome.runtime.getURL('dashboard.html'),
                active: true
            });
            logEvent('Opened new dashboard tab', 'info');
        }
    } catch (error) {
        console.error('Error opening dashboard:', error);
        logEvent(`Failed to open dashboard: ${error.message}`, 'error');
    }
});