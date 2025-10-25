class BackgroundService {
    constructor() {
        this.downloadQueue = [];
        this.isProcessingQueue = false;
        this.setupMessageListener();
        this.setupDownloadListener();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'DOWNLOAD_IMAGE') {
                this.queueImageDownload(message.url, message.filename, message.imageData);
                sendResponse({success: true});
            } else if (message.type === 'DOWNLOAD_METADATA') {
                this.downloadMetadata(message.url, message.filename);
                sendResponse({success: true});
            }
            return true; // Keep message channel open for async response
        });
    }

    queueImageDownload(url, filename, imageData) {
        this.downloadQueue.push({
            url,
            filename,
            imageData,
            timestamp: Date.now()
        });

        if (!this.isProcessingQueue) {
            this.processDownloadQueue();
        }
    }

    async processDownloadQueue() {
        if (this.isProcessingQueue || this.downloadQueue.length === 0) return;
        
        this.isProcessingQueue = true;

        while (this.downloadQueue.length > 0) {
            const downloadItem = this.downloadQueue.shift();
            
            try {
                await this.downloadImage(downloadItem.url, downloadItem.filename);
                console.log(`Downloaded: ${downloadItem.filename}`);
            } catch (error) {
                console.error(`Failed to download ${downloadItem.filename}:`, error);
                
                // Retry with different approach
                try {
                    await this.downloadImageFallback(downloadItem.url, downloadItem.filename);
                    console.log(`Downloaded with fallback: ${downloadItem.filename}`);
                } catch (fallbackError) {
                    console.error(`Fallback download failed for ${downloadItem.filename}:`, fallbackError);
                }
            }

            // Small delay between downloads to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        this.isProcessingQueue = false;
    }

    async downloadImage(url, filename) {
        try {
            // First, try to fetch the image to validate it
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.startsWith('image/')) {
                console.warn(`Warning: ${url} may not be an image (Content-Type: ${contentType})`);
            }

            // Use Chrome's downloads API
            return new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: url,
                    filename: filename,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(downloadId);
                    }
                });
            });

        } catch (error) {
            throw new Error(`Failed to download ${url}: ${error.message}`);
        }
    }

    async downloadImageFallback(url, filename) {
        // Fallback method using blob conversion
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            return new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: blobUrl,
                    filename: filename,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (downloadId) => {
                    // Clean up blob URL
                    URL.revokeObjectURL(blobUrl);
                    
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(downloadId);
                    }
                });
            });

        } catch (error) {
            throw new Error(`Fallback download failed: ${error.message}`);
        }
    }

    async downloadMetadata(url, filename) {
        try {
            return new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: url,
                    filename: filename,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log(`Metadata file downloaded: ${filename}`);
                        resolve(downloadId);
                    }
                });
            });
        } catch (error) {
            console.error(`Failed to download metadata: ${error.message}`);
        }
    }

    // Monitor download progress and handle errors
    setupDownloadListener() {
        if (chrome.downloads && chrome.downloads.onChanged) {
            chrome.downloads.onChanged.addListener((downloadDelta) => {
                if (downloadDelta.state && downloadDelta.state.current === 'complete') {
                    console.log(`Download completed: ID ${downloadDelta.id}`);
                } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
                    console.error(`Download interrupted: ID ${downloadDelta.id}`);
                }
            });
        }
    }

    // Handle extension installation
    async handleInstall() {
        console.log('Gallery Scraper extension installed');
        
        // Set default settings
        const defaultSettings = {
            imageSelectors: 'img',
            urlAttribute: 'src',
            waitTime: 3000,
            scrollToBottom: true,
            autoScroll: false,
            scrollDelay: 1000,
            nextPageSelector: '',
            maxPages: 5,
            pageWaitTime: 5000,
            folderName: 'gallery_images',
            fileNamePattern: 'original',
            createMetadata: true
        };

        try {
            const result = await chrome.storage.sync.get('galleryScraperSettings');
            if (!result.galleryScraperSettings) {
                await chrome.storage.sync.set({galleryScraperSettings: defaultSettings});
                console.log('Default settings saved');
            }
        } catch (error) {
            console.error('Failed to save default settings:', error);
        }
    }
}

// Initialize the background service
let backgroundService;

try {
    backgroundService = new BackgroundService();
    console.log('Background service initialized successfully');
} catch (error) {
    console.error('Failed to initialize background service:', error);
}

// Handle extension lifecycle events
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed/updated:', details.reason);
    if (details.reason === 'install' && backgroundService) {
        backgroundService.handleInstall();
    }
});

// Keep service worker alive and handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // This listener helps keep the service worker active
    console.log('Background received message:', message.type);
    return true;
});

// Handle startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension startup');
});

// Error handling for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in service worker:', event.reason);
    event.preventDefault();
});

// Global error handler
self.addEventListener('error', (event) => {
    console.error('Service worker error:', event.error);
});