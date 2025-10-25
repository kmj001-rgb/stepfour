/**
 * Easy Scraper Chrome Extension - English Only Popup Bundle
 * 
 * This is a simplified, English-only version of the popup bundle
 * with all translation systems removed and English text integrated directly.
 */

(function() {
    'use strict';
    
    // ============================================================================
    // ENGLISH TEXT STRINGS (INTEGRATED DIRECTLY)
    // ============================================================================
    
    const ENGLISH_STRINGS = {
        // Common actions
        ADD_REVIEW: "Add a Review",
        ALLOW_PERMISSIONS: "Allow permissions",
        BACK: "Back",
        CANCEL: "Cancel",
        CONFIRM: "Confirm",
        CONTINUE: "Continue",
        COPY: "Copy",
        DELETE: "Delete",
        DISMISS: "Dismiss",
        EXPORT: "Export",
        IMPORT: "Import",
        LOAD: "Load",
        NEXT: "Next",
        PREVIOUS: "Previous",
        REFRESH: "Refresh",
        RESET: "Reset",
        SAVE: "Save",
        SEARCH: "Search",
        SELECT: "Select",
        SUBMIT: "Submit",
        UPLOAD: "Upload",
        
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
        
        // File operations
        CHOOSE_FILE: "Choose File",
        DOWNLOAD: "Download",
        FILE_SIZE: "File size",
        IMPORT_CSV: "Import CSV",
        SAVE_AS: "Save As",
        UPLOAD_FILE: "Upload File",
        
        // Settings and configuration
        ADVANCED: "Advanced",
        BASIC: "Basic",
        CONFIGURATION: "Configuration",
        CUSTOM_SELECTORS: "Custom Selectors",
        DELAY_BETWEEN_REQUESTS: "Delay between requests",
        ENABLE_LOGGING: "Enable logging",
        GENERAL: "General",
        MAX_ITEMS: "Maximum items to scrape",
        NOTIFICATIONS: "Notifications",
        PERFORMANCE: "Performance",
        PRIVACY: "Privacy",
        SAVE_SETTINGS: "Save Settings",
        SCRAPING_OPTIONS: "Scraping Options",
        TIMEOUT: "Timeout (seconds)",
        
        // Notifications and messages
        ERROR_OCCURRED: "An error occurred",
        INVALID_URL: "Invalid URL provided",
        NO_PERMISSION: "Permission denied",
        SCRAPING_COMPLETE: "Scraping completed successfully",
        SCRAPING_FAILED: "Scraping failed",
        SUCCESS: "Operation completed successfully",
        WARNING: "Warning",
        
        // Help and documentation
        ABOUT: "About",
        DOCUMENTATION: "Documentation",
        FAQ: "Frequently Asked Questions",
        GET_HELP: "Get Help",
        HOW_TO_USE: "How to Use",
        SUPPORT: "Support",
        TUTORIAL: "Tutorial",
        VERSION: "Version",
        
        // Data display
        COLUMNS: "Columns",
        DATA_PREVIEW: "Data Preview",
        FILTER: "Filter",
        ROWS: "Rows",
        SORT: "Sort",
        TABLE_VIEW: "Table View",
        TOTAL_RECORDS: "Total Records",
        
        // Status and progress
        CONNECTING: "Connecting...",
        CONNECTED: "Connected",
        DISCONNECTED: "Disconnected",
        ERROR: "Error",
        IDLE: "Idle",
        PROCESSING: "Processing...",
        READY: "Ready",
        SUCCESS: "Success",
        WAITING: "Waiting..."
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
    // MAIN POPUP COMPONENT
    // ============================================================================
    
    class EasyScraperPopup {
        constructor() {
            this.isInitialized = false;
            this.currentData = null;
            this.init();
        }
        
        init() {
            if (this.isInitialized) return;
            
            this.setupEventListeners();
            this.loadSavedData();
            this.isInitialized = true;
            
            console.log('Easy Scraper Popup initialized (English Only)');
        }
        
        setupEventListeners() {
            // Start scraping button
            const startButton = document.getElementById('start-scraping');
            if (startButton) {
                startButton.addEventListener('click', () => this.startScraping());
                startButton.textContent = getEnglishText('START_SCRAPING');
            }
            
            // Export buttons
            const exportCsvButton = document.getElementById('export-csv');
            if (exportCsvButton) {
                exportCsvButton.addEventListener('click', () => this.exportToCSV());
                exportCsvButton.textContent = getEnglishText('EXPORT_CSV');
            }
            
            const exportJsonButton = document.getElementById('export-json');
            if (exportJsonButton) {
                exportJsonButton.addEventListener('click', () => this.exportToJSON());
                exportJsonButton.textContent = getEnglishText('EXPORT_JSON');
            }
            
            // Settings button
            const settingsButton = document.getElementById('settings');
            if (settingsButton) {
                settingsButton.addEventListener('click', () => this.openSettings());
                settingsButton.textContent = getEnglishText('SETTINGS.CONFIGURATION');
            }
            
            // Help button
            const helpButton = document.getElementById('help');
            if (helpButton) {
                helpButton.addEventListener('click', () => this.openHelp());
                helpButton.textContent = getEnglishText('HELP.GET_HELP');
            }
        }
        
        startScraping() {
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = getEnglishText('SCRAPING');
            }
            
            // Send message to content script to start scraping
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'startScraping',
                    message: getEnglishText('START_SCRAPING')
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error starting scraping:', chrome.runtime.lastError);
                        if (statusElement) {
                            statusElement.textContent = getEnglishText('ERROR_OCCURRED');
                        }
                    } else {
                        console.log('Scraping started:', response);
                    }
                });
            });
        }
        
        exportToCSV() {
            if (!this.currentData || this.currentData.length === 0) {
                alert(getEnglishText('NO_DATA'));
                return;
            }
            
            // Convert data to CSV format
            const csvContent = this.convertToCSV(this.currentData);
            this.downloadFile(csvContent, 'scraped_data.csv', 'text/csv');
        }
        
        exportToJSON() {
            if (!this.currentData || this.currentData.length === 0) {
                alert(getEnglishText('NO_DATA'));
                return;
            }
            
            // Convert data to JSON format
            const jsonContent = JSON.stringify(this.currentData, null, 2);
            this.downloadFile(jsonContent, 'scraped_data.json', 'application/json');
        }
        
        convertToCSV(data) {
            if (!data || data.length === 0) return '';
            
            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(',')];
            
            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    // Escape quotes and wrap in quotes if contains comma
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
        
        openSettings() {
            // Open settings modal or page
            console.log('Opening settings...');
            // Implementation would go here
        }
        
        openHelp() {
            // Open help modal or page
            console.log('Opening help...');
            // Implementation would go here
        }
        
        loadSavedData() {
            // Load any previously scraped data from storage
            chrome.storage.local.get(['scrapedData'], (result) => {
                if (result.scrapedData) {
                    this.currentData = result.scrapedData;
                    this.updateDataDisplay();
                }
            });
        }
        
        updateDataDisplay() {
            const dataContainer = document.getElementById('data-container');
            if (!dataContainer || !this.currentData) return;
            
            if (this.currentData.length === 0) {
                dataContainer.innerHTML = `<p>${getEnglishText('NO_DATA')}</p>`;
                return;
            }
            
            // Create a simple table display
            const table = document.createElement('table');
            table.className = 'data-table';
            
            // Create header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = Object.keys(this.currentData[0]);
            
            headers.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create body
            const tbody = document.createElement('tbody');
            this.currentData.forEach(row => {
                const tr = document.createElement('tr');
                headers.forEach(header => {
                    const td = document.createElement('td');
                    td.textContent = row[header] || '';
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            
            dataContainer.innerHTML = '';
            dataContainer.appendChild(table);
        }
        
        updateStatus(message) {
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = message;
            }
        }
    }
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    // Initialize the popup when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        window.easyScraperPopup = new EasyScraperPopup();
    });
    
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'scrapingComplete') {
            if (window.easyScraperPopup) {
                window.easyScraperPopup.currentData = request.data;
                window.easyScraperPopup.updateDataDisplay();
                window.easyScraperPopup.updateStatus(getEnglishText('SCRAPING_COMPLETE'));
            }
            sendResponse({status: 'success'});
        } else if (request.action === 'scrapingError') {
            if (window.easyScraperPopup) {
                window.easyScraperPopup.updateStatus(getEnglishText('SCRAPING_FAILED'));
            }
            sendResponse({status: 'error'});
        }
    });
    
    // ============================================================================
    // EXPORT FOR EXTERNAL USE
    // ============================================================================
    
    // Make functions available globally for debugging
    window.EasyScraperUtils = {
        getText: getEnglishText,
        getAllStrings: () => ENGLISH_STRINGS,
        getPopup: () => window.easyScraperPopup
    };
    
    console.log('Easy Scraper Popup Bundle loaded (English Only)');
    
})();