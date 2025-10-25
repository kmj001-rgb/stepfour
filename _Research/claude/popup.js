class GalleryScraperPopup {
    constructor() {
        this.isScrapingActive = false;
        this.currentStats = {
            imagesFound: 0,
            imagesDownloaded: 0,
            currentPage: 1,
            totalPages: 0
        };
        
        this.initializeEventListeners();
        this.loadSavedSettings();
        this.setupMessageListener();
    }

    initializeEventListeners() {
        document.getElementById('startScraping').addEventListener('click', () => this.startScraping());
        document.getElementById('stopScraping').addEventListener('click', () => this.stopScraping());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('loadSettings').addEventListener('click', () => this.loadSavedSettings());
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'SCRAPING_UPDATE') {
                this.updateProgress(message.data);
            } else if (message.type === 'SCRAPING_COMPLETE') {
                this.showStatus('Scraping completed successfully!', 'success');
                this.resetScrapingState();
            } else if (message.type === 'SCRAPING_ERROR') {
                this.showStatus(`Error: ${message.error}`, 'error');
                this.resetScrapingState();
            }
        });
    }

    async startScraping() {
        if (this.isScrapingActive) return;

        const settings = this.getSettings();
        
        // Validate settings
        if (!settings.imageSelectors.trim()) {
            this.showStatus('Please enter image selectors', 'error');
            return;
        }

        this.isScrapingActive = true;
        document.getElementById('startScraping').disabled = true;
        document.getElementById('stopScraping').disabled = false;
        
        this.showStatus('Starting scraping...', 'info');
        this.showProgress();

        try {
            // Get current active tab
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // Send scraping command to content script
            await chrome.tabs.sendMessage(tab.id, {
                type: 'START_SCRAPING',
                settings: settings
            });
            
        } catch (error) {
            this.showStatus(`Failed to start scraping: ${error.message}`, 'error');
            this.resetScrapingState();
        }
    }

    async stopScraping() {
        if (!this.isScrapingActive) return;

        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            await chrome.tabs.sendMessage(tab.id, {type: 'STOP_SCRAPING'});
            
            this.showStatus('Scraping stopped', 'info');
            this.resetScrapingState();
        } catch (error) {
            console.error('Error stopping scraping:', error);
            this.resetScrapingState();
        }
    }

    resetScrapingState() {
        this.isScrapingActive = false;
        document.getElementById('startScraping').disabled = false;
        document.getElementById('stopScraping').disabled = true;
        this.hideProgress();
    }

    getSettings() {
        return {
            imageSelectors: document.getElementById('imageSelectors').value,
            urlAttribute: document.getElementById('urlAttribute').value,
            waitTime: parseInt(document.getElementById('waitTime').value) * 1000,
            scrollToBottom: document.getElementById('scrollToBottom').checked,
            autoScroll: document.getElementById('autoScroll').checked,
            scrollDelay: parseInt(document.getElementById('scrollDelay').value),
            nextPageSelector: document.getElementById('nextPageSelector').value,
            maxPages: parseInt(document.getElementById('maxPages').value),
            pageWaitTime: parseInt(document.getElementById('pageWaitTime').value) * 1000,
            folderName: document.getElementById('folderName').value || 'gallery_images',
            fileNamePattern: document.getElementById('fileNamePattern').value,
            createMetadata: document.getElementById('createMetadata').checked
        };
    }

    setSettings(settings) {
        document.getElementById('imageSelectors').value = settings.imageSelectors || 'img';
        document.getElementById('urlAttribute').value = settings.urlAttribute || 'src';
        document.getElementById('waitTime').value = (settings.waitTime || 3000) / 1000;
        document.getElementById('scrollToBottom').checked = settings.scrollToBottom !== false;
        document.getElementById('autoScroll').checked = settings.autoScroll || false;
        document.getElementById('scrollDelay').value = settings.scrollDelay || 1000;
        document.getElementById('nextPageSelector').value = settings.nextPageSelector || '';
        document.getElementById('maxPages').value = settings.maxPages || 5;
        document.getElementById('pageWaitTime').value = (settings.pageWaitTime || 5000) / 1000;
        document.getElementById('folderName').value = settings.folderName || 'gallery_images';
        document.getElementById('fileNamePattern').value = settings.fileNamePattern || 'original';
        document.getElementById('createMetadata').checked = settings.createMetadata !== false;
    }

    async saveSettings() {
        const settings = this.getSettings();
        await chrome.storage.sync.set({galleryScraperSettings: settings});
        this.showStatus('Settings saved!', 'success');
    }

    async loadSavedSettings() {
        const result = await chrome.storage.sync.get('galleryScraperSettings');
        if (result.galleryScraperSettings) {
            this.setSettings(result.galleryScraperSettings);
            this.showStatus('Settings loaded!', 'info');
        }
    }

    showStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = 'block';
        
        // Auto-hide success/info messages after 3 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }

    showProgress() {
        document.getElementById('progressContainer').style.display = 'block';
    }

    hideProgress() {
        document.getElementById('progressContainer').style.display = 'none';
    }

    updateProgress(stats) {
        this.currentStats = {...this.currentStats, ...stats};
        
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        // Calculate progress percentage
        let percentage = 0;
        if (this.currentStats.imagesFound > 0) {
            percentage = (this.currentStats.imagesDownloaded / this.currentStats.imagesFound) * 100;
        }
        
        progressFill.style.width = `${percentage}%`;
        
        let text = `${this.currentStats.imagesFound} images found, ${this.currentStats.imagesDownloaded} downloaded`;
        if (this.currentStats.currentPage > 1) {
            text += ` (Page ${this.currentStats.currentPage})`;
        }
        
        progressText.textContent = text;
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GalleryScraperPopup();
});