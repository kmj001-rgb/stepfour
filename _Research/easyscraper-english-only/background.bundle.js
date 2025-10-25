/**
 * Easy Scraper Chrome Extension - English Only Background Script Bundle
 * 
 * This is a simplified, English-only version of the background script bundle
 * that handles extension lifecycle, storage, and communication between components.
 */

(function() {
    'use strict';
    
    // ============================================================================
    // ENGLISH TEXT STRINGS (INTEGRATED DIRECTLY)
    // ============================================================================
    
    const ENGLISH_STRINGS = {
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
        WARNING: "Warning",
        
        // Extension lifecycle
        EXTENSION_INSTALLED: "Easy Scraper extension installed successfully",
        EXTENSION_UPDATED: "Easy Scraper extension updated successfully",
        EXTENSION_STARTED: "Easy Scraper extension started",
        EXTENSION_STOPPED: "Easy Scraper extension stopped"
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
    // MAIN BACKGROUND SCRIPT CLASS
    // ============================================================================
    
    class EasyScraperBackgroundScript {
        constructor() {
            this.isInitialized = false;
            this.extensionVersion = '1.3.6';
            this.storageData = {};
            this.activeTabs = new Map();
            this.init();
        }
        
        init() {
            if (this.isInitialized) return;
            
            this.setupEventListeners();
            this.loadStorageData();
            this.setupMessageListener();
            this.isInitialized = true;
            
            console.log('Easy Scraper Background Script initialized (English Only)');
        }
        
        setupEventListeners() {
            // Extension installation event
            chrome.runtime.onInstalled.addListener((details) => {
                if (details.reason === 'install') {
                    this.onExtensionInstalled();
                } else if (details.reason === 'update') {
                    this.onExtensionUpdated();
                }
            });
            
            // Extension startup event
            chrome.runtime.onStartup.addListener(() => {
                this.onExtensionStarted();
            });
            
            // Tab events
            chrome.tabs.onActivated.addListener((activeInfo) => {
                this.onTabActivated(activeInfo);
            });
            
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                this.onTabUpdated(tabId, changeInfo, tab);
            });
            
            chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
                this.onTabRemoved(tabId, removeInfo);
            });
            
            // Storage change events
            chrome.storage.onChanged.addListener((changes, namespace) => {
                this.onStorageChanged(changes, namespace);
            });
        }
        
        setupMessageListener() {
            // Listen for messages from popup and content scripts
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                this.handleMessage(request, sender, sendResponse);
                return true; // Keep message channel open for async response
            });
        }
        
        handleMessage(request, sender, sendResponse) {
            try {
                switch (request.action) {
                    case 'getExtensionInfo':
                        this.handleGetExtensionInfo(request, sender, sendResponse);
                        break;
                    
                    case 'saveData':
                        this.handleSaveData(request, sender, sendResponse);
                        break;
                    
                    case 'loadData':
                        this.handleLoadData(request, sender, sendResponse);
                        break;
                    
                    case 'clearData':
                        this.handleClearData(request, sender, sendResponse);
                        break;
                    
                    case 'getTabInfo':
                        this.handleGetTabInfo(request, sender, sendResponse);
                        break;
                    
                    case 'scrapingComplete':
                        this.handleScrapingComplete(request, sender, sendResponse);
                        break;
                    
                    case 'scrapingError':
                        this.handleScrapingError(request, sender, sendResponse);
                        break;
                    
                    default:
                        console.warn('Unknown message action:', request.action);
                        sendResponse({success: false, error: 'Unknown action'});
                }
            } catch (error) {
                console.error('Error handling message:', error);
                sendResponse({success: false, error: error.message});
            }
        }
        
        handleGetExtensionInfo(request, sender, sendResponse) {
            const info = {
                version: this.extensionVersion,
                name: 'Easy Scraper (English Only)',
                description: 'A free web scraper for instant results. Scrape any website with one click. No coding required.',
                isInitialized: this.isInitialized,
                activeTabsCount: this.activeTabs.size,
                storageDataSize: Object.keys(this.storageData).length
            };
            
            sendResponse({success: true, data: info});
        }
        
        handleSaveData(request, sender, sendResponse) {
            const {key, data} = request;
            
            if (!key) {
                sendResponse({success: false, error: 'No key provided'});
                return;
            }
            
            this.storageData[key] = data;
            
            // Save to Chrome storage
            chrome.storage.local.set({[key]: data}, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving data:', chrome.runtime.lastError);
                    sendResponse({success: false, error: chrome.runtime.lastError.message});
                } else {
                    sendResponse({success: true, message: 'Data saved successfully'});
                }
            });
        }
        
        handleLoadData(request, sender, sendResponse) {
            const {key} = request;
            
            if (!key) {
                sendResponse({success: false, error: 'No key provided'});
                return;
            }
            
            // Load from Chrome storage
            chrome.storage.local.get([key], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Error loading data:', chrome.runtime.lastError);
                    sendResponse({success: false, error: chrome.runtime.lastError.message});
                } else {
                    const data = result[key];
                    sendResponse({success: true, data: data});
                }
            });
        }
        
        handleClearData(request, sender, sendResponse) {
            const {key} = request;
            
            if (key) {
                // Clear specific key
                delete this.storageData[key];
                chrome.storage.local.remove([key], () => {
                    if (chrome.runtime.lastError) {
                        console.error('Error clearing data:', chrome.runtime.lastError);
                        sendResponse({success: false, error: chrome.runtime.lastError.message});
                    } else {
                        sendResponse({success: true, message: 'Data cleared successfully'});
                    }
                });
            } else {
                // Clear all data
                this.storageData = {};
                chrome.storage.local.clear(() => {
                    if (chrome.runtime.lastError) {
                        console.error('Error clearing all data:', chrome.runtime.lastError);
                        sendResponse({success: false, error: chrome.runtime.lastError.message});
                    } else {
                        sendResponse({success: true, message: 'All data cleared successfully'});
                    }
                });
            }
        }
        
        handleGetTabInfo(request, sender, sendResponse) {
            const {tabId} = request;
            
            if (tabId) {
                // Get specific tab info
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({success: false, error: chrome.runtime.lastError.message});
                    } else {
                        sendResponse({success: true, data: tab});
                    }
                });
            } else {
                // Get current active tab info
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if (tabs && tabs.length > 0) {
                        sendResponse({success: true, data: tabs[0]});
                    } else {
                        sendResponse({success: false, error: 'No active tab found'});
                    }
                });
            }
        }
        
        handleScrapingComplete(request, sender, sendResponse) {
            const {data, tabId} = request;
            
            // Save scraped data
            const storageKey = `scrapedData_${tabId || sender.tab.id}`;
            this.storageData[storageKey] = data;
            
            chrome.storage.local.set({[storageKey]: data}, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving scraped data:', chrome.runtime.lastError);
                } else {
                    console.log('Scraped data saved successfully');
                }
            });
            
            // Send notification
            this.showNotification(
                getEnglishText('SCRAPING_COMPLETE'),
                `Successfully scraped ${data.length} items`
            );
            
            sendResponse({success: true, message: 'Scraping data processed'});
        }
        
        handleScrapingError(request, sender, sendResponse) {
            const {error, tabId} = request;
            
            console.error('Scraping error:', error);
            
            // Send notification
            this.showNotification(
                getEnglishText('SCRAPING_FAILED'),
                error || 'An unknown error occurred'
            );
            
            sendResponse({success: false, message: 'Scraping error logged'});
        }
        
        onExtensionInstalled() {
            console.log(getEnglishText('EXTENSION_INSTALLED'));
            
            // Initialize default settings
            const defaultSettings = {
                maxItems: 100,
                autoScroll: false,
                delayBetweenRequests: 100,
                enableLogging: true,
                notifications: true
            };
            
            this.storageData.settings = defaultSettings;
            chrome.storage.local.set({settings: defaultSettings});
            
            // Show welcome notification
            this.showNotification(
                'Welcome to Easy Scraper!',
                'Extension installed successfully. Click the extension icon to get started.'
            );
        }
        
        onExtensionUpdated() {
            console.log(getEnglishText('EXTENSION_UPDATED'));
            
            // Show update notification
            this.showNotification(
                'Easy Scraper Updated',
                `Extension updated to version ${this.extensionVersion}`
            );
        }
        
        onExtensionStarted() {
            console.log(getEnglishText('EXTENSION_STARTED'));
        }
        
        onTabActivated(activeInfo) {
            const {tabId} = activeInfo;
            
            // Track active tab
            this.activeTabs.set(tabId, {
                activatedAt: Date.now(),
                isActive: true
            });
            
            // Clean up old tab entries
            this.cleanupOldTabs();
        }
        
        onTabUpdated(tabId, changeInfo, tab) {
            if (changeInfo.status === 'complete' && tab.url) {
                // Tab finished loading
                if (this.activeTabs.has(tabId)) {
                    const tabInfo = this.activeTabs.get(tabId);
                    tabInfo.lastUpdated = Date.now();
                    tabInfo.url = tab.url;
                    tabInfo.title = tab.title;
                }
            }
        }
        
        onTabRemoved(tabId, removeInfo) {
            // Remove tab from tracking
            this.activeTabs.delete(tabId);
            
            // Clean up associated data
            const storageKey = `scrapedData_${tabId}`;
            if (this.storageData[storageKey]) {
                delete this.storageData[storageKey];
                chrome.storage.local.remove([storageKey]);
            }
        }
        
        onStorageChanged(changes, namespace) {
            // Update local storage data
            for (const [key, {newValue}] of Object.entries(changes)) {
                if (namespace === 'local') {
                    this.storageData[key] = newValue;
                }
            }
        }
        
        loadStorageData() {
            // Load all stored data
            chrome.storage.local.get(null, (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Error loading storage data:', chrome.runtime.lastError);
                } else {
                    this.storageData = result;
                    console.log('Storage data loaded successfully');
                }
            });
        }
        
        cleanupOldTabs() {
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            for (const [tabId, tabInfo] of this.activeTabs.entries()) {
                if (now - tabInfo.activatedAt > maxAge) {
                    this.activeTabs.delete(tabId);
                }
            }
        }
        
        showNotification(title, message) {
            // Check if notifications are enabled
            if (this.storageData.settings && !this.storageData.settings.notifications) {
                return;
            }
            
            // Create notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'assets/icon-48.png',
                title: title,
                message: message
            });
        }
        
        // Utility methods
        getStorageData() {
            return this.storageData;
        }
        
        getActiveTabs() {
            return Array.from(this.activeTabs.entries());
        }
        
        getExtensionVersion() {
            return this.extensionVersion;
        }
    }
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    // Initialize the background script
    const easyScraperBackground = new EasyScraperBackgroundScript();
    
    // Make it available globally for debugging
    window.EasyScraperBackground = easyScraperBackground;
    
    console.log('Easy Scraper Background Script loaded (English Only)');
    
})();