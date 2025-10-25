// popup.js - Gallery Scraper Pro Popup Interface
// Handles UI interactions, settings management, and real-time updates

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
    // Current page
    currentPageUrl: document.getElementById('currentPageUrl'),
    
    // Settings
    maxWait: document.getElementById('maxWait'),
    scrollDelay: document.getElementById('scrollDelay'),
    downloadFolder: document.getElementById('downloadFolder'),
    maxConcurrentDownloads: document.getElementById('maxConcurrentDownloads'),
    minImageWidth: document.getElementById('minImageWidth'),
    minImageHeight: document.getElementById('minImageHeight'),
    imageContainerSelector: document.getElementById('imageContainerSelector'),
    nextPageSelector: document.getElementById('nextPageSelector'),
    
    // UI controls
    advancedToggle: document.getElementById('advancedToggle'),
    advancedSettings: document.getElementById('advancedSettings'),
    saveSettings: document.getElementById('saveSettings'),
    
    // Action buttons
    startScrapeCurrentPage: document.getElementById('startScrapeCurrentPage'),
    startScrapeAllPages: document.getElementById('startScrapeAllPages'),
    controlButtons: document.getElementById('controlButtons'),
    pauseScraping: document.getElementById('pauseScraping'),
    resumeScraping: document.getElementById('resumeScraping'),
    stopScraping: document.getElementById('stopScraping'),
    
    // Status display
    statusDisplay: document.getElementById('statusDisplay'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    
    // Stats
    thumbnailCount: document.getElementById('thumbnailCount'),
    destinationCount: document.getElementById('destinationCount'),
    downloadCount: document.getElementById('downloadCount'),
    failureCount: document.getElementById('failureCount'),
    
    // Log
    logDisplay: document.getElementById('logDisplay'),
    clearLog: document.getElementById('clearLog'),
    exportReport: document.getElementById('exportReport')
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentState = {
    isActive: false,
    isPaused: false,
    mode: 'single',
    stats: {
        thumbnails: 0,
        destinations: 0,
        failures: 0,
        queuedDownloads: 0,
        activeDownloads: 0
    }
};

let isAdvancedVisible = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializePopup();
        setupEventListeners();
        await loadSettings();
        await loadCurrentPageInfo();
        await updateScrapingStatus();
        startStatusPolling();
        
        logMessage('Popup initialized successfully', 'success');
    } catch (error) {
        console.error('Popup initialization error:', error);
        logMessage(`Initialization error: ${error.message}`, 'error');
    }
});

/**
 * Initialize popup interface
 */
async function initializePopup() {
    // Set initial state
    updateButtonStates();
    
    // Load any existing log entries
    await loadLogEntries();
    
    logMessage('Gallery Scraper Pro ready', 'info');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Advanced settings toggle
    elements.advancedToggle.addEventListener('click', toggleAdvancedSettings);
    
    // Settings
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // Action buttons
    elements.startScrapeCurrentPage.addEventListener('click', () => startScraping('single'));
    elements.startScrapeAllPages.addEventListener('click', () => startScraping('all'));
    elements.pauseScraping.addEventListener('click', pauseScraping);
    elements.resumeScraping.addEventListener('click', resumeScraping);
    elements.stopScraping.addEventListener('click', stopScraping);
    
    // Log controls
    elements.clearLog.addEventListener('click', clearLog);
    elements.exportReport.addEventListener('click', exportReport);
    
    // Listen for background script messages
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const settings = await chrome.storage.local.get({
            maxWait: 30000, // Default in milliseconds
            scrollDelay: 500,
            downloadFolder: '',
            maxConcurrentDownloads: 5,
            minImageWidth: 200,
            minImageHeight: 200,
            imageContainerSelector: '',
            nextPageSelector: ''
        });
        
        elements.maxWait.value = settings.maxWait / 1000; // Convert ms to seconds for display
        elements.scrollDelay.value = settings.scrollDelay;
        elements.downloadFolder.value = settings.downloadFolder;
        elements.maxConcurrentDownloads.value = settings.maxConcurrentDownloads;
        elements.minImageWidth.value = settings.minImageWidth;
        elements.minImageHeight.value = settings.minImageHeight;
        elements.imageContainerSelector.value = settings.imageContainerSelector;
        elements.nextPageSelector.value = settings.nextPageSelector;
        
    } catch (error) {
        console.error('Error loading settings:', error);
        logMessage('Failed to load settings', 'error');
    }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    try {
        const settings = {
            maxWait: parseInt(elements.maxWait.value) * 1000, // Convert to milliseconds
            scrollDelay: parseInt(elements.scrollDelay.value),
            downloadFolder: elements.downloadFolder.value.trim(),
            maxConcurrentDownloads: parseInt(elements.maxConcurrentDownloads.value),
            minImageWidth: parseInt(elements.minImageWidth.value),
            minImageHeight: parseInt(elements.minImageHeight.value),
            imageContainerSelector: elements.imageContainerSelector.value.trim(),
            nextPageSelector: elements.nextPageSelector.value.trim()
        };
        
        await chrome.storage.local.set(settings);
        
        // Visual feedback
        const originalText = elements.saveSettings.textContent;
        elements.saveSettings.textContent = '✅ Saved!';
        elements.saveSettings.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        
        setTimeout(() => {
            elements.saveSettings.textContent = originalText;
            elements.saveSettings.style.background = '';
        }, 2000);
        
        logMessage('Settings saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        logMessage('Failed to save settings', 'error');
    }
}

/**
 * Toggle advanced settings visibility
 */
function toggleAdvancedSettings() {
    isAdvancedVisible = !isAdvancedVisible;
    
    if (isAdvancedVisible) {
        elements.advancedSettings.classList.remove('hidden');
        elements.advancedToggle.textContent = 'Hide Advanced Settings';
    } else {
        elements.advancedSettings.classList.add('hidden');
        elements.advancedToggle.textContent = 'Show Advanced Settings';
    }
}

// ============================================================================
// SCRAPING CONTROLS
// ============================================================================

/**
 * Start scraping with specified mode
 * @param {string} mode - 'single' or 'all'
 */
async function startScraping(mode) {
    try {
        // Get current settings
        const settings = {
            maxWait: parseInt(elements.maxWait.value) * 1000,
            scrollDelay: parseInt(elements.scrollDelay.value),
            minImageWidth: parseInt(elements.minImageWidth.value),
            minImageHeight: parseInt(elements.minImageHeight.value)
        };
        
        // Send start message to background script
        const action = mode === 'single' ? 'startScrapePage' : 'startScrapeAllPages';
        const response = await chrome.runtime.sendMessage({
            action,
            settings
        });
        
        if (response?.success) {
            currentState.isActive = true;
            currentState.isPaused = false;
            currentState.mode = mode;
            
            updateButtonStates();
            updateStatus(`Starting ${mode === 'single' ? 'single page' : 'multi-page'} scrape...`);
            elements.progressBar.classList.remove('hidden');
            
            logMessage(`Started ${mode === 'single' ? 'single page' : 'multi-page'} scraping`, 'success');
        } else {
            throw new Error(response?.error || 'Failed to start scraping');
        }
        
    } catch (error) {
        console.error('Error starting scraping:', error);
        logMessage(`Failed to start scraping: ${error.message}`, 'error');
        updateStatus('Failed to start scraping', 'error');
    }
}

/**
 * Pause scraping
 */
async function pauseScraping() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'pauseScraping' });
        
        if (response?.success) {
            currentState.isPaused = true;
            updateButtonStates();
            updateStatus('Scraping paused', 'warning');
            logMessage('Scraping paused', 'warn');
        }
    } catch (error) {
        console.error('Error pausing scraping:', error);
        logMessage(`Failed to pause: ${error.message}`, 'error');
    }
}

/**
 * Resume scraping
 */
async function resumeScraping() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'resumeScraping' });
        
        if (response?.success) {
            currentState.isPaused = false;
            updateButtonStates();
            updateStatus('Scraping resumed');
            logMessage('Scraping resumed', 'success');
        }
    } catch (error) {
        console.error('Error resuming scraping:', error);
        logMessage(`Failed to resume: ${error.message}`, 'error');
    }
}

/**
 * Stop scraping
 */
async function stopScraping() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'stopScraping' });
        
        if (response?.success) {
            currentState.isActive = false;
            currentState.isPaused = false;
            updateButtonStates();
            updateStatus('Scraping stopped');
            elements.progressBar.classList.add('hidden');
            logMessage('Scraping stopped by user', 'warn');
        }
    } catch (error) {
        console.error('Error stopping scraping:', error);
        logMessage(`Failed to stop: ${error.message}`, 'error');
    }
}

// ============================================================================
// UI UPDATES
// ============================================================================

/**
 * Update button states based on current scraping status
 */
function updateButtonStates() {
    const isActive = currentState.isActive;
    const isPaused = currentState.isPaused;
    
    // Start buttons
    elements.startScrapeCurrentPage.disabled = isActive;
    elements.startScrapeAllPages.disabled = isActive;
    
    // Control buttons
    if (isActive) {
        elements.controlButtons.classList.remove('hidden');
        
        if (isPaused) {
            elements.pauseScraping.classList.add('hidden');
            elements.resumeScraping.classList.remove('hidden');
        } else {
            elements.pauseScraping.classList.remove('hidden');
            elements.resumeScraping.classList.add('hidden');
        }
    } else {
        elements.controlButtons.classList.add('hidden');
        elements.pauseScraping.classList.remove('hidden');
        elements.resumeScraping.classList.add('hidden');
    }
    
    // Settings (disable during scraping)
    const settingsInputs = [
        elements.maxWait,
        elements.scrollDelay,
        elements.downloadFolder,
        elements.maxConcurrentDownloads,
        elements.minImageWidth,
        elements.minImageHeight,
        elements.imageContainerSelector,
        elements.nextPageSelector
    ];
    
    settingsInputs.forEach(input => {
        input.disabled = isActive;
    });
    
    elements.saveSettings.disabled = isActive;
}

/**
 * Update status display
 * @param {string} message - Status message
 * @param {string} type - Message type ('info', 'error', 'warning', 'success')
 */
function updateStatus(message, type = 'info') {
    elements.statusDisplay.textContent = message;
    
    // Remove existing type classes
    elements.statusDisplay.classList.remove('error', 'warning', 'success');
    
    // Add new type class
    if (type !== 'info') {
        elements.statusDisplay.classList.add(type);
    }
}

/**
 * Update statistics display
 * @param {Object} stats - Statistics object
 */
function updateStats(stats) {
    if (stats.thumbnails !== undefined) {
        elements.thumbnailCount.textContent = stats.thumbnails;
        currentState.stats.thumbnails = stats.thumbnails;
    }
    
    if (stats.destinations !== undefined) {
        elements.destinationCount.textContent = stats.destinations;
        currentState.stats.destinations = stats.destinations;
    }
    
    if (stats.failures !== undefined) {
        elements.failureCount.textContent = stats.failures;
        currentState.stats.failures = stats.failures;
    }
    
    // Calculate downloaded count
    const downloaded = currentState.stats.thumbnails - (stats.queuedDownloads || 0);
    elements.downloadCount.textContent = Math.max(0, downloaded);
}

/**
 * Update progress bar
 * @param {number} current - Current progress
 * @param {number} total - Total items
 */
function updateProgress(current, total) {
    if (total > 0) {
        const percentage = Math.min(100, (current / total) * 100);
        elements.progressFill.style.width = `${percentage}%`;
        elements.progressBar.classList.remove('hidden');
    } else {
        elements.progressBar.classList.add('hidden');
    }
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Add log message to display
 * @param {string} message - Log message
 * @param {string} type - Message type
 */
function logMessage(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `<span class="log-time">${time}</span>${message}`;
    
    elements.logDisplay.appendChild(logEntry);
    elements.logDisplay.scrollTop = elements.logDisplay.scrollHeight;
    
    // Keep only last 100 entries
    while (elements.logDisplay.children.length > 100) {
        elements.logDisplay.removeChild(elements.logDisplay.firstChild);
    }
}

/**
 * Load existing log entries from storage
 */
async function loadLogEntries() {
    try {
        const result = await chrome.storage.local.get('scrapeLog');
        if (result.scrapeLog && Array.isArray(result.scrapeLog)) {
            // Clear existing log
            elements.logDisplay.innerHTML = '';
            
            // Add recent entries (last 50)
            const recentEntries = result.scrapeLog.slice(-50);
            recentEntries.forEach(entry => {
                const time = new Date(entry.timestamp).toLocaleTimeString();
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${entry.type}`;
                logEntry.innerHTML = `<span class="log-time">${time}</span>${entry.message}`;
                elements.logDisplay.appendChild(logEntry);
            });
            
            elements.logDisplay.scrollTop = elements.logDisplay.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading log entries:', error);
    }
}

/**
 * Clear log display and storage
 */
async function clearLog() {
    try {
        await chrome.runtime.sendMessage({ action: 'clearLog' });
        elements.logDisplay.innerHTML = '<div class="log-entry"><span class="log-time">--:--:--</span>Log cleared</div>';
        logMessage('Log cleared', 'info');
    } catch (error) {
        console.error('Error clearing log:', error);
        logMessage('Failed to clear log', 'error');
    }
}

// ============================================================================
// DATA EXPORT
// ============================================================================

/**
 * Export scraping report
 */
async function exportReport() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getLastReport' });
        
        if (response?.report) {
            const report = response.report;
            
            // Create downloadable content
            const content = {
                summary: report.summary,
                thumbnails: report.data.thumbnails,
                destinations: report.data.destinations,
                failures: report.failures,
                exportedAt: new Date().toISOString()
            };
            
            // Create and download JSON file
            const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `gallery-scraper-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Also copy to clipboard
            try {
                await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
                updateStatus('Report exported and copied to clipboard!', 'success');
            } catch (clipboardError) {
                updateStatus('Report exported to file', 'success');
            }
            
            logMessage('Report exported successfully', 'success');
            
        } else {
            updateStatus('No report available', 'warning');
            logMessage('No scraping report available to export', 'warn');
        }
        
    } catch (error) {
        console.error('Error exporting report:', error);
        logMessage(`Export failed: ${error.message}`, 'error');
        updateStatus('Export failed', 'error');
    }
}

// ============================================================================
// BACKGROUND MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from background script
 * @param {Object} message - Message from background script
 */
function handleBackgroundMessage(message) {
    try {
        switch (message.action) {
            case 'statusUpdate':
                logMessage(message.message, message.type);
                updateStatus(message.message, message.type);
                break;
                
            case 'progressUpdate':
                updateStats({
                    thumbnails: message.totalScraped,
                    destinations: message.totalScraped
                });
                
                if (message.status) {
                    updateStatus(message.status);
                }
                break;
                
            case 'downloadProgress':
                updateProgress(message.downloaded, message.total);
                
                if (message.currentFile) {
                    updateStatus(`Downloading: ${message.currentFile}`);
                }
                break;
                
            case 'finalReport':
                handleFinalReport(message.report);
                break;
                
            case 'logUpdate':
                const entry = message.logEntry;
                const time = new Date(entry.timestamp).toLocaleTimeString();
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${entry.type}`;
                logEntry.innerHTML = `<span class="log-time">${time}</span>${entry.message}`;
                elements.logDisplay.appendChild(logEntry);
                elements.logDisplay.scrollTop = elements.logDisplay.scrollHeight;
                break;
                
            case 'downloadsComplete':
                updateStatus('All downloads completed!', 'success');
                logMessage('All downloads completed', 'success');
                break;
                
            default:
                console.log('Unknown message from background:', message);
        }
    } catch (error) {
        console.error('Error handling background message:', error);
    }
}

/**
 * Handle final scraping report
 * @param {Object} report - Final scraping report
 */
function handleFinalReport(report) {
    currentState.isActive = false;
    currentState.isPaused = false;
    
    updateButtonStates();
    updateStats({
        thumbnails: report.summary.totalThumbnails,
        destinations: report.summary.totalDestinations,
        failures: report.summary.totalFailures
    });
    
    updateStatus('Scraping completed!', 'success');
    elements.progressBar.classList.add('hidden');
    
    logMessage(`Scraping completed: ${report.summary.totalThumbnails} thumbnails, ${report.summary.totalFailures} failures`, 'success');
}

// ============================================================================
// STATUS POLLING
// ============================================================================

/**
 * Start polling for scraping status
 */
function startStatusPolling() {
    // Poll every 2 seconds
    setInterval(updateScrapingStatus, 2000);
}

/**
 * Update scraping status from background script
 */
async function updateScrapingStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getScrapingStatus' });
        
        if (response) {
            const wasActive = currentState.isActive;
            
            currentState.isActive = response.isActive;
            currentState.isPaused = response.isPaused;
            currentState.mode = response.mode;
            
            // Update UI if status changed
            if (wasActive !== currentState.isActive) {
                updateButtonStates();
            }
            
            // Update stats
            if (response.stats) {
                updateStats(response.stats);
            }
        }
    } catch (error) {
        // Background script might not be ready, ignore silently
    }
}

// ============================================================================
// PAGE INFO
// ============================================================================

/**
 * Load current page information
 */
async function loadCurrentPageInfo() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            const tab = tabs[0];
            elements.currentPageUrl.textContent = tab.url;
            
            // Try to get additional page info from content script
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
                if (response) {
                    elements.currentPageUrl.textContent = response.url;
                }
            } catch (error) {
                // Content script might not be ready, use tab URL
            }
        }
    } catch (error) {
        console.error('Error loading page info:', error);
        elements.currentPageUrl.textContent = 'Unable to detect current page';
    }
}