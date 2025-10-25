/**
 * Easy Scraper Chrome Extension - English Only Content Script Bundle
 * 
 * This is a simplified, English-only version of the content script bundle
 * that runs on web pages to extract data and interact with the DOM.
 */

(function() {
    'use strict';
    
    // ============================================================================
    // ENGLISH TEXT STRINGS (INTEGRATED DIRECTLY)
    // ============================================================================
    
    const ENGLISH_STRINGS = {
        // Scraping interface
        AUTO_SCROLL: "Autoscroll",
        CHANGE_LIST: "Change List",
        CHANGE_SELECTION_LEVEL: "Change selection level",
        CLICK: "Click",
        CLICK_LOAD_MORE: "Click button to load more items on same page",
        CLICK_NEXT_PAGE: "Click link to navigate to next page",
        COLUMN: "Column",
        CSV_FILE: "CSV file",
        DEFAULT_SCRAPER_NAME: "Scrape details from {domain}",
        DURATION: "Duration",
        ESC: "Esc",
        EXPORT_CSV: "Export to CSV",
        EXPORT_JSON: "Export to JSON",
        EXPORT_EXCEL: "Export to Excel",
        FINISHED: "Finished",
        LOADING: "Loading...",
        NO_DATA: "No data found",
        PAUSE: "Pause",
        RESUME: "Resume",
        SCRAPE: "Scrape",
        SCRAPING: "Scraping...",
        SELECT_ELEMENTS: "Select elements to scrape",
        START_SCRAPING: "Start Scraping",
        STOP: "Stop",
        TOTAL_ITEMS: "Total items",
        
        // Status and progress
        CONNECTING: "Connecting...",
        CONNECTED: "Connected",
        DISCONNECTED: "Disconnected",
        ERROR: "Error",
        IDLE: "Idle",
        PROCESSING: "Processing...",
        READY: "Ready",
        SUCCESS: "Success",
        WAITING: "Waiting...",
        
        // Notifications and messages
        ERROR_OCCURRED: "An error occurred",
        INVALID_URL: "Invalid URL provided",
        NO_PERMISSION: "Permission denied",
        SCRAPING_COMPLETE: "Scraping completed successfully",
        SCRAPING_FAILED: "Scraping failed",
        SUCCESS: "Operation completed successfully",
        WARNING: "Warning"
    };
    
    // ============================================================================
    // TEXT UTILITY FUNCTIONS
    // ============================================================================
    
    /**
     * Get English text string with optional placeholder replacements
     * @param {string} key - Key to the text string
     * @param {Object} replacements - Optional placeholder replacements
     * @returns {string} - The English text string
     */
    function getEnglishText(key, replacements = {}) {
        let text = ENGLISH_STRINGS[key] || key;
        
        // Replace placeholders if any
        if (replacements && Object.keys(replacements).length > 0) {
            for (const [placeholder, value] of Object.entries(replacements)) {
                text = text.replace(new RegExp(`{${placeholder}}`, 'g'), value);
            }
        }
        
        return text;
    }
    
    // ============================================================================
    // MAIN CONTENT SCRIPT CLASS
    // ============================================================================
    
    class EasyScraperContentScript {
        constructor() {
            this.isInitialized = false;
            this.isScraping = false;
            this.scrapedData = [];
            this.currentSelector = null;
            this.autoScroll = false;
            this.maxItems = 100;
            this.init();
        }
        
        init() {
            if (this.isInitialized) return;
            
            this.setupMessageListener();
            this.createScrapingInterface();
            this.isInitialized = true;
            
            console.log('Easy Scraper Content Script initialized (English Only)');
        }
        
        setupMessageListener() {
            // Listen for messages from the popup
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'startScraping') {
                    this.startScraping();
                    sendResponse({status: 'success', message: getEnglishText('SCRAPING')});
                } else if (request.action === 'stopScraping') {
                    this.stopScraping();
                    sendResponse({status: 'success', message: getEnglishText('STOP')});
                } else if (request.action === 'getStatus') {
                    sendResponse({
                        status: this.isScraping ? getEnglishText('SCRAPING') : getEnglishText('IDLE'),
                        dataCount: this.scrapedData.length
                    });
                }
                return true; // Keep message channel open for async response
            });
        }
        
        createScrapingInterface() {
            // Create floating scraping interface
            const interface = document.createElement('div');
            interface.id = 'easy-scraper-interface';
            interface.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 300px;
                background: white;
                border: 2px solid #007bff;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
            `;
            
            interface.innerHTML = `
                <div style="background: #007bff; color: white; padding: 10px; border-radius: 6px 6px 0 0; font-weight: bold;">
                    🕷️ Easy Scraper (English Only)
                </div>
                <div style="padding: 15px;">
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            ${getEnglishText('SELECT_ELEMENTS')}:
                        </label>
                        <input type="text" id="scraper-selector" placeholder="CSS selector (e.g., .item)" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">
                            ${getEnglishText('TOTAL_ITEMS')}:
                        </label>
                        <input type="number" id="scraper-max-items" value="100" min="1" max="1000"
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="scraper-auto-scroll" style="margin-right: 8px;">
                            ${getEnglishText('AUTO_SCROLL')}
                        </label>
                    </div>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button id="scraper-start" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ${getEnglishText('START_SCRAPING')}
                        </button>
                        <button id="scraper-stop" style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; display: none;">
                            ${getEnglishText('STOP')}
                        </button>
                    </div>
                    <div id="scraper-status" style="text-align: center; color: #666; font-style: italic;">
                        ${getEnglishText('READY')}
                    </div>
                    <div id="scraper-progress" style="margin-top: 10px; display: none;">
                        <div style="background: #f0f0f0; border-radius: 4px; height: 20px; overflow: hidden;">
                            <div id="scraper-progress-bar" style="background: #007bff; height: 100%; width: 0%; transition: width 0.3s;"></div>
                        </div>
                        <div id="scraper-count" style="text-align: center; margin-top: 5px; font-size: 12px;">
                            0 / 0
                        </div>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 10px; border-top: 1px solid #ddd; border-radius: 0 0 6px 6px;">
                    <button id="scraper-export" style="width: 100%; padding: 8px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        ${getEnglishText('EXPORT_CSV')}
                    </button>
                </div>
            `;
            
            document.body.appendChild(interface);
            
            // Add event listeners
            this.setupInterfaceEvents();
            
            // Make interface draggable
            this.makeDraggable(interface);
        }
        
        setupInterfaceEvents() {
            const startButton = document.getElementById('scraper-start');
            const stopButton = document.getElementById('scraper-stop');
            const exportButton = document.getElementById('scraper-export');
            const selectorInput = document.getElementById('scraper-selector');
            const maxItemsInput = document.getElementById('scraper-max-items');
            const autoScrollCheckbox = document.getElementById('scraper-auto-scroll');
            
            startButton.addEventListener('click', () => this.startScraping());
            stopButton.addEventListener('click', () => this.stopScraping());
            exportButton.addEventListener('click', () => this.exportData());
            
            // Update settings when inputs change
            selectorInput.addEventListener('input', (e) => {
                this.currentSelector = e.target.value;
            });
            
            maxItemsInput.addEventListener('input', (e) => {
                this.maxItems = parseInt(e.target.value) || 100;
            });
            
            autoScrollCheckbox.addEventListener('change', (e) => {
                this.autoScroll = e.target.checked;
            });
        }
        
        makeDraggable(element) {
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;
            
            element.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                
                if (e.target === element || element.contains(e.target)) {
                    isDragging = true;
                }
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    
                    xOffset = currentX;
                    yOffset = currentY;
                    
                    element.style.transform = `translate(${currentX}px, ${currentY}px)`;
                }
            });
            
            document.addEventListener('mouseup', () => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            });
        }
        
        startScraping() {
            if (this.isScraping) return;
            
            if (!this.currentSelector || this.currentSelector.trim() === '') {
                this.updateStatus(getEnglishText('ERROR_OCCURRED') + ': No selector specified');
                return;
            }
            
            this.isScraping = true;
            this.scrapedData = [];
            this.updateStatus(getEnglishText('SCRAPING'));
            this.showProgress();
            this.updateButtons();
            
            // Start the scraping process
            this.scrapeElements();
        }
        
        stopScraping() {
            this.isScraping = false;
            this.updateStatus(getEnglishText('STOP'));
            this.hideProgress();
            this.updateButtons();
        }
        
        async scrapeElements() {
            try {
                const elements = document.querySelectorAll(this.currentSelector);
                
                if (elements.length === 0) {
                    this.updateStatus(getEnglishText('NO_DATA'));
                    this.stopScraping();
                    return;
                }
                
                this.updateProgress(0, elements.length);
                
                for (let i = 0; i < Math.min(elements.length, this.maxItems); i++) {
                    if (!this.isScraping) break;
                    
                    const element = elements[i];
                    const data = this.extractElementData(element);
                    
                    if (data) {
                        this.scrapedData.push(data);
                    }
                    
                    this.updateProgress(i + 1, Math.min(elements.length, this.maxItems));
                    
                    // Auto-scroll if enabled
                    if (this.autoScroll && i % 10 === 0) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await this.delay(500);
                    }
                    
                    // Small delay to prevent overwhelming the page
                    await this.delay(100);
                }
                
                if (this.isScraping) {
                    this.updateStatus(getEnglishText('SCRAPING_COMPLETE') + `: ${this.scrapedData.length} items`);
                    this.stopScraping();
                    
                    // Send data to popup
                    chrome.runtime.sendMessage({
                        action: 'scrapingComplete',
                        data: this.scrapedData
                    });
                }
                
            } catch (error) {
                console.error('Scraping error:', error);
                this.updateStatus(getEnglishText('SCRAPING_FAILED') + ': ' + error.message);
                this.stopScraping();
            }
        }
        
        extractElementData(element) {
            try {
                const data = {};
                
                // Extract text content
                data.text = element.textContent?.trim() || '';
                
                // Extract common attributes
                data.href = element.href || element.getAttribute('href') || '';
                data.src = element.src || element.getAttribute('src') || '';
                data.alt = element.alt || element.getAttribute('alt') || '';
                data.title = element.title || element.getAttribute('title') || '';
                
                // Extract data attributes
                const dataAttributes = element.dataset;
                for (const key in dataAttributes) {
                    data[`data-${key}`] = dataAttributes[key];
                }
                
                // Extract classes
                data.classes = Array.from(element.classList).join(' ');
                
                // Extract ID
                data.id = element.id || '';
                
                // Extract tag name
                data.tagName = element.tagName.toLowerCase();
                
                return data;
                
            } catch (error) {
                console.error('Error extracting element data:', error);
                return null;
            }
        }
        
        updateStatus(message) {
            const statusElement = document.getElementById('scraper-status');
            if (statusElement) {
                statusElement.textContent = message;
            }
        }
        
        updateProgress(current, total) {
            const progressBar = document.getElementById('scraper-progress-bar');
            const countElement = document.getElementById('scraper-count');
            
            if (progressBar) {
                const percentage = (current / total) * 100;
                progressBar.style.width = percentage + '%';
            }
            
            if (countElement) {
                countElement.textContent = `${current} / ${total}`;
            }
        }
        
        showProgress() {
            const progressElement = document.getElementById('scraper-progress');
            if (progressElement) {
                progressElement.style.display = 'block';
            }
        }
        
        hideProgress() {
            const progressElement = document.getElementById('scraper-progress');
            if (progressElement) {
                progressElement.style.display = 'none';
            }
        }
        
        updateButtons() {
            const startButton = document.getElementById('scraper-start');
            const stopButton = document.getElementById('scraper-stop');
            
            if (startButton) {
                startButton.style.display = this.isScraping ? 'none' : 'block';
            }
            
            if (stopButton) {
                stopButton.style.display = this.isScraping ? 'block' : 'none';
            }
        }
        
        exportData() {
            if (this.scrapedData.length === 0) {
                alert(getEnglishText('NO_DATA'));
                return;
            }
            
            // Convert to CSV
            const csvContent = this.convertToCSV(this.scrapedData);
            this.downloadFile(csvContent, 'scraped_data.csv', 'text/csv');
        }
        
        convertToCSV(data) {
            if (!data || data.length === 0) return '';
            
            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(',')];
            
            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    return `"${String(value).replace(/"/g, '""')}"`;
                });
                csvRows.push(values.join(','));
            }
            
            return csvRows.join('\n');
        }
        
        downloadFile(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    // Initialize the content script
    const easyScraper = new EasyScraperContentScript();
    
    // Make it available globally for debugging
    window.EasyScraperContent = easyScraper;
    
    console.log('Easy Scraper Content Script loaded (English Only)');
    
})();