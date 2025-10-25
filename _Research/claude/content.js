class GalleryScraper {
    constructor() {
        this.isActive = false;
        this.settings = {};
        this.collectedUrls = [];
        this.downloadedCount = 0;
        this.currentPage = 1;
        this.setupMessageListener();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'START_SCRAPING') {
                this.startScraping(message.settings);
            } else if (message.type === 'STOP_SCRAPING') {
                this.stopScraping();
            }
        });
    }

    async startScraping(settings) {
        if (this.isActive) return;
        
        this.isActive = true;
        this.settings = settings;
        this.collectedUrls = [];
        this.downloadedCount = 0;
        this.currentPage = 1;

        try {
            console.log('Starting gallery scraping with settings:', settings);
            await this.scrapeCurrentPage();
        } catch (error) {
            console.error('Scraping error:', error);
            this.sendMessage('SCRAPING_ERROR', {error: error.message});
            this.isActive = false;
        }
    }

    stopScraping() {
        this.isActive = false;
        console.log('Scraping stopped by user');
    }

    async scrapeCurrentPage() {
        if (!this.isActive) return;

        console.log(`Scraping page ${this.currentPage}`);
        
        // Wait for page to load
        await this.waitForPageLoad();
        
        // Scroll if needed
        if (this.settings.scrollToBottom || this.settings.autoScroll) {
            await this.handleScrolling();
        }

        // Extract images from current page
        const pageImages = await this.extractImages();
        this.collectedUrls.push(...pageImages);

        console.log(`Found ${pageImages.length} images on page ${this.currentPage}`);
        
        // Update progress
        this.sendMessage('SCRAPING_UPDATE', {
            imagesFound: this.collectedUrls.length,
            imagesDownloaded: this.downloadedCount,
            currentPage: this.currentPage
        });

        // Download images from current page
        await this.downloadImages(pageImages);

        // Check if we should continue to next page
        if (this.shouldContinueToNextPage()) {
            await this.goToNextPage();
        } else {
            await this.completeScraping();
        }
    }

    async waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                setTimeout(resolve, this.settings.waitTime);
            } else {
                window.addEventListener('load', () => {
                    setTimeout(resolve, this.settings.waitTime);
                });
            }
        });
    }

    async handleScrolling() {
        if (this.settings.autoScroll) {
            await this.autoScroll();
        } else if (this.settings.scrollToBottom) {
            await this.scrollToBottom();
        }
    }

    async autoScroll() {
        return new Promise((resolve) => {
            let scrollHeight = document.body.scrollHeight;
            let currentScroll = 0;
            const scrollStep = window.innerHeight;

            const scrollInterval = setInterval(() => {
                if (!this.isActive) {
                    clearInterval(scrollInterval);
                    resolve();
                    return;
                }

                currentScroll += scrollStep;
                window.scrollTo(0, currentScroll);

                // Check if we've reached the bottom or new content loaded
                const newScrollHeight = document.body.scrollHeight;
                if (currentScroll >= newScrollHeight && newScrollHeight === scrollHeight) {
                    clearInterval(scrollInterval);
                    resolve();
                } else {
                    scrollHeight = newScrollHeight;
                }
            }, this.settings.scrollDelay);
        });
    }

    async scrollToBottom() {
        return new Promise((resolve) => {
            const scrollStep = window.innerHeight;
            let currentPosition = 0;
            const maxHeight = document.body.scrollHeight;

            const scroll = () => {
                if (!this.isActive || currentPosition >= maxHeight) {
                    resolve();
                    return;
                }
                
                currentPosition += scrollStep;
                window.scrollTo(0, currentPosition);
                setTimeout(scroll, 100);
            };

            scroll();
        });
    }

    async extractImages() {
        const images = [];
        const selectors = this.settings.imageSelectors.split(',').map(s => s.trim());
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                const url = this.extractUrlFromElement(element);
                if (url && this.isValidImageUrl(url)) {
                    const imageData = {
                        url: this.normalizeUrl(url),
                        originalUrl: url,
                        filename: this.extractFilename(url),
                        pageUrl: window.location.href,
                        selector: selector,
                        timestamp: Date.now()
                    };
                    
                    // Avoid duplicates
                    if (!images.some(img => img.url === imageData.url)) {
                        images.push(imageData);
                    }
                }
            }
        }

        return images;
    }

    extractUrlFromElement(element) {
        const attribute = this.settings.urlAttribute;
        let url = element.getAttribute(attribute);
        
        // Fallback to other common attributes
        if (!url) {
            const fallbackAttrs = ['src', 'data-src', 'data-original', 'data-lazy', 'href'];
            for (const attr of fallbackAttrs) {
                url = element.getAttribute(attr);
                if (url) break;
            }
        }

        // Check for CSS background images
        if (!url && element.style.backgroundImage) {
            const match = element.style.backgroundImage.match(/url\(['""]?(.*?)['""]?\)/);
            if (match) url = match[1];
        }

        return url;
    }

    isValidImageUrl(url) {
        if (!url) return false;
        
        // Skip data URLs, mailto, tel, etc.
        if (url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
            return false;
        }

        // Check for image file extensions
        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(\?.*)?$/i;
        return imageExtensions.test(url) || url.includes('image') || url.includes('photo');
    }

    normalizeUrl(url) {
        try {
            // Handle relative URLs
            if (url.startsWith('//')) {
                return window.location.protocol + url;
            } else if (url.startsWith('/')) {
                return window.location.origin + url;
            } else if (!url.startsWith('http')) {
                return new URL(url, window.location.href).href;
            }
            return url;
        } catch (error) {
            return url;
        }
    }

    extractFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop() || 'image';
            
            // Ensure filename has an extension
            if (!filename.includes('.')) {
                return filename + '.jpg';
            }
            
            return filename;
        } catch (error) {
            return `image_${Date.now()}.jpg`;
        }
    }

    async downloadImages(images) {
        for (let i = 0; i < images.length && this.isActive; i++) {
            const image = images[i];
            
            try {
                const filename = this.generateFilename(image, this.downloadedCount + 1);
                
                await chrome.runtime.sendMessage({
                    type: 'DOWNLOAD_IMAGE',
                    url: image.url,
                    filename: `${this.settings.folderName}/${filename}`,
                    imageData: image
                });
                
                this.downloadedCount++;
                
                // Update progress
                this.sendMessage('SCRAPING_UPDATE', {
                    imagesFound: this.collectedUrls.length,
                    imagesDownloaded: this.downloadedCount,
                    currentPage: this.currentPage
                });

                // Small delay to avoid overwhelming the download system
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error('Failed to download image:', image.url, error);
            }
        }
    }

    generateFilename(imageData, index) {
        const pattern = this.settings.fileNamePattern;
        
        switch (pattern) {
            case 'numbered':
                const paddedIndex = index.toString().padStart(3, '0');
                const extension = imageData.filename.split('.').pop() || 'jpg';
                return `${paddedIndex}.${extension}`;
                
            case 'url_based':
                return this.sanitizeFilename(imageData.url.split('/').pop() || `image_${index}`);
                
            case 'original':
            default:
                return this.sanitizeFilename(imageData.filename);
        }
    }

    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    }

    shouldContinueToNextPage() {
        if (!this.isActive || !this.settings.nextPageSelector) return false;
        
        if (this.settings.maxPages > 0 && this.currentPage >= this.settings.maxPages) {
            return false;
        }

        return !!document.querySelector(this.settings.nextPageSelector);
    }

    async goToNextPage() {
        const nextButton = document.querySelector(this.settings.nextPageSelector);
        if (!nextButton) return;

        console.log('Navigating to next page...');
        
        // Click the next page button
        nextButton.click();
        
        this.currentPage++;
        
        // Wait for page navigation
        await new Promise(resolve => setTimeout(resolve, this.settings.pageWaitTime));
        
        // Continue scraping the new page
        await this.scrapeCurrentPage();
    }

    async completeScraping() {
        console.log(`Scraping completed. Total images collected: ${this.collectedUrls.length}, downloaded: ${this.downloadedCount}`);
        
        // Create metadata file if requested
        if (this.settings.createMetadata && this.collectedUrls.length > 0) {
            await this.createMetadataFile();
        }

        this.sendMessage('SCRAPING_COMPLETE', {
            totalImages: this.collectedUrls.length,
            downloadedImages: this.downloadedCount,
            pagesScraped: this.currentPage
        });

        this.isActive = false;
    }

    async createMetadataFile() {
        const metadata = {
            scrapeDate: new Date().toISOString(),
            sourceUrl: window.location.href,
            totalImages: this.collectedUrls.length,
            downloadedImages: this.downloadedCount,
            pagesScraped: this.currentPage,
            settings: this.settings,
            images: this.collectedUrls.map((img, index) => ({
                index: index + 1,
                url: img.url,
                filename: this.generateFilename(img, index + 1),
                originalFilename: img.filename,
                pageUrl: img.pageUrl,
                timestamp: img.timestamp
            }))
        };

        const jsonContent = JSON.stringify(metadata, null, 2);
        const blob = new Blob([jsonContent], {type: 'application/json'});
        const url = URL.createObjectURL(blob);

        await chrome.runtime.sendMessage({
            type: 'DOWNLOAD_METADATA',
            url: url,
            filename: `${this.settings.folderName}/metadata.json`
        });
    }

    sendMessage(type, data) {
        chrome.runtime.sendMessage({type, data}).catch(console.error);
    }
}

// Initialize the scraper when the content script loads
const galleryScraper = new GalleryScraper();