// dashboard.js - Gallery Scraper Pro Dashboard Interface
// Handles full-page dashboard UI, settings management, and real-time updates

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
    // Navigation
    currentTabUrl: document.getElementById('currentTabUrl'),
    connectionStatus: document.getElementById('connectionStatus'),
    themeToggle: document.getElementById('themeToggle'),
    siteProfileStatus: document.getElementById('siteProfileStatus'),
    profileName: document.getElementById('profileName'),
    
    // Settings
    maxWait: document.getElementById('maxWait'),
    scrollDelay: document.getElementById('scrollDelay'),
    downloadFolder: document.getElementById('downloadFolder'),
    maxConcurrentDownloads: document.getElementById('maxConcurrentDownloads'),
    minImageWidth: document.getElementById('minImageWidth'),
    imageContainerSelector: document.getElementById('imageContainerSelector'),
    nextPageSelector: document.getElementById('nextPageSelector'),
    
    // UI controls
    advancedToggle: document.getElementById('advancedToggle'),
    advancedSettings: document.getElementById('advancedSettings'),
    saveSettings: document.getElementById('saveSettings'),
    
    // Action buttons
    startButtons: document.getElementById('startButtons'),
    startScrapeCurrentPage: document.getElementById('startScrapeCurrentPage'),
    startScrapeAllPages: document.getElementById('startScrapeAllPages'),
    controlButtons: document.getElementById('controlButtons'),
    pauseScraping: document.getElementById('pauseScraping'),
    resumeScraping: document.getElementById('resumeScraping'),
    stopScraping: document.getElementById('stopScraping'),
    
    // Status display
    statusDisplay: document.getElementById('statusDisplay'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    
    // Stats
    thumbnailCount: document.getElementById('thumbnailCount'),
    destinationCount: document.getElementById('destinationCount'),
    downloadCount: document.getElementById('downloadCount'),
    failureCount: document.getElementById('failureCount'),
    
    // Log
    logDisplay: document.getElementById('logDisplay'),
    clearLog: document.getElementById('clearLog'),
    exportReport: document.getElementById('exportReport'),
    refreshConnection: document.getElementById('refreshConnection'),
    
    // Preview grid
    previewGrid: document.getElementById('previewGrid')
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentState = {
    isActive: false,
    isPaused: false,
    mode: 'single',
    activeTabId: null,
    stats: {
        thumbnails: 0,
        destinations: 0,
        failures: 0,
        queuedDownloads: 0,
        activeDownloads: 0
    }
};

let isAdvancedVisible = false;
let statusPollingInterval = null;
let downloadStartTime = Date.now();
let previewImages = new Set();

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeDashboard();
        setupEventListeners();
        await loadSettings();
        await loadTheme();
        await loadActiveTabInfo();
        await updateScrapingStatus();
        startStatusPolling();
        
        logMessage('Dashboard initialized successfully', 'success');
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        logMessage(`Initialization error: ${error.message}`, 'error');
        updateConnectionStatus(false);
    }
});

/**
 * Initialize dashboard interface
 */
async function initializeDashboard() {
    updateButtonStates();
    await loadLogEntries();
    updateConnectionStatus(true);
    logMessage('Gallery Scraper Pro dashboard ready', 'info');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Advanced settings toggle
    elements.advancedToggle.addEventListener('click', toggleAdvancedSettings);
    
    // Settings
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // Settings presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const preset = e.target.getAttribute('data-preset');
            applyPreset(preset);
        });
    });
    
    // Action buttons
    elements.startScrapeCurrentPage.addEventListener('click', () => startScraping('single'));
    elements.startScrapeAllPages.addEventListener('click', () => startScraping('all'));
    elements.pauseScraping.addEventListener('click', pauseScraping);
    elements.resumeScraping.addEventListener('click', resumeScraping);
    elements.stopScraping.addEventListener('click', stopScraping);
    
    // Log controls
    elements.clearLog.addEventListener('click', clearLog);
    elements.exportReport.addEventListener('click', exportReport);
    elements.refreshConnection.addEventListener('click', refreshConnection);
    
    // Listen for background script messages
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    
    // Handle tab close
    window.addEventListener('beforeunload', () => {
        if (statusPollingInterval) {
            clearInterval(statusPollingInterval);
        }
    });
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

/**
 * Load active tab information
 */
async function loadActiveTabInfo() {
    try {
        // Get all tabs to find the active one (excluding this dashboard)
        const tabs = await chrome.tabs.query({});
        let activeTab = null;
        
        // Find the most recently active tab that's not this dashboard
        for (const tab of tabs) {
            if (!tab.url.includes('chrome-extension://') && 
                !tab.url.includes('chrome://') &&
                !tab.url.includes('moz-extension://')) {
                if (!activeTab || tab.lastAccessed > activeTab.lastAccessed) {
                    activeTab = tab;
                }
            }
        }
        
        if (activeTab) {
            currentState.activeTabId = activeTab.id;
            elements.currentTabUrl.textContent = activeTab.url;
            
            // Detect site profile for current tab
            updateSiteProfile(activeTab.url);
            
            // Try to get additional page info from content script
            try {
                const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'getPageInfo' });
                if (response) {
                    elements.currentTabUrl.textContent = response.url;
                    updateSiteProfile(response.url);
                }
            } catch (error) {
                // Content script might not be ready, use tab URL
            }
        } else {
            elements.currentTabUrl.textContent = 'No active tab found';
            updateConnectionStatus(false, 'No target tab available');
            updateSiteProfile('');
        }
    } catch (error) {
        console.error('Error loading tab info:', error);
        elements.currentTabUrl.textContent = 'Unable to detect target tab';
        updateConnectionStatus(false, 'Tab detection failed');
        updateSiteProfile('');
    }
}

/**
 * Update site profile display based on URL
 * @param {string} url - Current page URL
 */
function updateSiteProfile(url) {
    try {
        if (!url) {
            elements.profileName.textContent = 'No Tab';
            elements.siteProfileStatus.className = 'site-profile-status universal';
            elements.siteProfileStatus.title = 'No active tab selected';
            return;
        }
        
        // Simple site detection for display (mirroring background logic)
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        
        const siteProfiles = {
            'gettyimages.com': { name: 'Getty Images', icon: '📷' },
            'gettyimages.co.uk': { name: 'Getty Images UK', icon: '📷' },
            'mirrorpix.com': { name: 'Mirrorpix', icon: '📰' },
            'actionpress.de': { name: 'ActionPress', icon: '⚡' },
            'news-images.smartframe.io': { name: 'SmartFrame', icon: '🖼️' },
            'archive.newsimages.co.uk': { name: 'News Images', icon: '📋' },
            'imago-images.com': { name: 'Imago Images', icon: '🎯' },
            'shutterstock.com': { name: 'Shutterstock', icon: '🏢' }
        };
        
        // Check for direct match or subdomain match
        let detectedProfile = siteProfiles[hostname];
        if (!detectedProfile) {
            for (const [domain, profile] of Object.entries(siteProfiles)) {
                if (hostname.includes(domain) || domain.includes(hostname)) {
                    detectedProfile = profile;
                    break;
                }
            }
        }
        
        if (detectedProfile) {
            elements.profileName.textContent = detectedProfile.name;
            elements.siteProfileStatus.className = 'site-profile-status detected';
            elements.siteProfileStatus.title = `Optimized for ${detectedProfile.name} - enhanced selectors and timing`;
            
            // Update icon
            const iconElement = elements.siteProfileStatus.querySelector('.profile-icon');
            if (iconElement) {
                iconElement.textContent = detectedProfile.icon;
            }
        } else {
            elements.profileName.textContent = 'Universal';
            elements.siteProfileStatus.className = 'site-profile-status universal';
            elements.siteProfileStatus.title = 'Using universal selectors - works on any gallery site';
            
            // Reset icon
            const iconElement = elements.siteProfileStatus.querySelector('.profile-icon');
            if (iconElement) {
                iconElement.textContent = '🎯';
            }
        }
        
    } catch (error) {
        console.error('Error updating site profile:', error);
        elements.profileName.textContent = 'Universal';
        elements.siteProfileStatus.className = 'site-profile-status universal';
    }
}

/**
 * Refresh connection to active tab
 */
async function refreshConnection() {
    updateConnectionStatus(true, 'Refreshing...');
    await loadActiveTabInfo();
    await updateScrapingStatus();
    logMessage('Connection refreshed', 'info');
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected, message = '') {
    if (connected) {
        elements.connectionStatus.textContent = '🟢 Connected';
        elements.connectionStatus.style.color = '#10b981';
    } else {
        elements.connectionStatus.textContent = `🔴 ${message || 'Disconnected'}`;
        elements.connectionStatus.style.color = '#ef4444';
    }
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Load saved theme preference
 */
async function loadTheme() {
    try {
        const result = await chrome.storage.local.get('theme');
        const savedTheme = result.theme;
        
        // Check system preference if no saved theme
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        
        applyTheme(theme);
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!savedTheme) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    } catch (error) {
        console.error('Error loading theme:', error);
    }
}

/**
 * Toggle between light and dark themes
 */
async function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    applyTheme(newTheme);
    
    try {
        await chrome.storage.local.set({ theme: newTheme });
        logMessage(`Switched to ${newTheme} theme`, 'success');
    } catch (error) {
        console.error('Error saving theme:', error);
    }
}

/**
 * Apply theme to the interface
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update theme toggle button
    if (elements.themeToggle) {
        elements.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        elements.themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
    }
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
            scrollDelay: 500, // Default in milliseconds
            downloadFolder: '',
            maxConcurrentDownloads: 5,
            minImageWidth: 200,
            minImageHeight: 200,
            imageContainerSelector: '',
            nextPageSelector: ''
        });
        
        elements.maxWait.value = settings.maxWait / 1000; // Convert ms to seconds for display
        elements.scrollDelay.value = settings.scrollDelay / 1000; // Convert ms to seconds for display
        elements.downloadFolder.value = settings.downloadFolder;
        elements.maxConcurrentDownloads.value = settings.maxConcurrentDownloads;
        elements.minImageWidth.value = settings.minImageWidth;
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
            scrollDelay: parseFloat(elements.scrollDelay.value) * 1000, // Convert to milliseconds
            downloadFolder: elements.downloadFolder.value.trim(),
            maxConcurrentDownloads: parseInt(elements.maxConcurrentDownloads.value),
            minImageWidth: parseInt(elements.minImageWidth.value),
            minImageHeight: parseInt(elements.minImageWidth.value), // Use same value for height
            imageContainerSelector: elements.imageContainerSelector.value.trim(),
            nextPageSelector: elements.nextPageSelector.value.trim()
        };
        
        await chrome.storage.local.set(settings);
        
        // Visual feedback
        const originalText = elements.saveSettings.textContent;
        const originalClass = elements.saveSettings.className;
        
        elements.saveSettings.textContent = '✅ Settings Saved!';
        elements.saveSettings.className = 'button success';
        
        setTimeout(() => {
            elements.saveSettings.textContent = originalText;
            elements.saveSettings.className = originalClass;
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

/**
 * Settings presets for different use cases
 */
const SETTINGS_PRESETS = {
    'fast': {
        name: 'Fast & Light',
        description: 'Quick scraping with minimal quality filters',
        maxWait: 10,
        scrollDelay: 0.2, // 200ms in seconds
        maxConcurrentDownloads: 8,
        minImageWidth: 100
    },
    'quality': {
        name: 'High Quality',
        description: 'Focus on high-quality images with slower, more reliable scraping',
        maxWait: 45,
        scrollDelay: 1.0, // 1000ms in seconds
        maxConcurrentDownloads: 3,
        minImageWidth: 800
    },
    'compatible': {
        name: 'Maximum Compatibility',
        description: 'Most conservative settings for difficult sites',
        maxWait: 60,
        scrollDelay: 2.0, // 2000ms in seconds
        maxConcurrentDownloads: 2,
        minImageWidth: 200
    }
};

/**
 * Apply a settings preset
 */
async function applyPreset(presetName) {
    const preset = SETTINGS_PRESETS[presetName];
    if (!preset) {
        logMessage(`Unknown preset: ${presetName}`, 'error');
        return;
    }
    
    try {
        // Update UI elements
        elements.maxWait.value = preset.maxWait;
        elements.scrollDelay.value = preset.scrollDelay;
        elements.maxConcurrentDownloads.value = preset.maxConcurrentDownloads;
        elements.minImageWidth.value = preset.minImageWidth;
        
        // Save settings
        await saveSettings();
        
        // Visual feedback
        const button = document.querySelector(`[data-preset="${presetName}"]`);
        if (button) {
            const originalText = button.textContent;
            const originalClass = button.className;
            
            button.textContent = '✅ Applied!';
            button.className = 'button success preset-btn';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.className = originalClass;
            }, 2000);
        }
        
        logMessage(`Applied "${preset.name}" preset - ${preset.description}`, 'success');
        
    } catch (error) {
        console.error('Error applying preset:', error);
        logMessage(`Failed to apply preset: ${error.message}`, 'error');
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
    if (!currentState.activeTabId) {
        updateStatus('No active tab selected. Please refresh connection.', 'error');
        return;
    }
    
    try {
        // Reset download timer and clear preview
        downloadStartTime = Date.now();
        clearPreviewGrid();
        
        // Get current settings
        const settings = {
            maxWait: parseInt(elements.maxWait.value) * 1000,
            scrollDelay: parseFloat(elements.scrollDelay.value) * 1000, // Convert seconds to milliseconds
            minImageWidth: parseInt(elements.minImageWidth.value),
            minImageHeight: parseInt(elements.minImageWidth.value)
        };
        
        // Send start message to background script
        const action = mode === 'single' ? 'startScrapePage' : 'startScrapeAllPages';
        const response = await chrome.runtime.sendMessage({
            action,
            settings,
            tabId: currentState.activeTabId
        });
        
        if (response?.success) {
            currentState.isActive = true;
            currentState.isPaused = false;
            currentState.mode = mode;
            
            updateButtonStates();
            updateStatus(`Starting ${mode === 'single' ? 'single page' : 'multi-page'} scrape...`);
            elements.progressContainer.classList.remove('hidden');
            
            logMessage(`Started ${mode === 'single' ? 'single page' : 'multi-page'} scraping`, 'success');
        } else {
            throw new Error(response?.error || 'Failed to start scraping');
        }
        
    } catch (error) {
        console.error('Error starting scraping:', error);
        logMessage(`Failed to start scraping: ${error.message}`, 'error');
        updateStatus('Failed to start scraping', 'error');
        updateConnectionStatus(false, 'Communication failed');
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
            updateStatus('Scraping resumed', 'success');
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
            updateStatus('Scraping stopped', 'warning');
            elements.progressContainer.classList.add('hidden');
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
        elements.startButtons.style.opacity = '0.5';
        elements.controlButtons.classList.remove('hidden');
        
        if (isPaused) {
            elements.pauseScraping.classList.add('hidden');
            elements.resumeScraping.classList.remove('hidden');
        } else {
            elements.pauseScraping.classList.remove('hidden');
            elements.resumeScraping.classList.add('hidden');
        }
    } else {
        elements.startButtons.style.opacity = '1';
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
 * Update progress bar and text with speed calculation
 * @param {number} current - Current progress
 * @param {number} total - Total items
 */
function updateProgress(current, total) {
    if (total > 0) {
        const percentage = Math.min(100, (current / total) * 100);
        elements.progressFill.style.width = `${percentage}%`;
        
        // Calculate download speed and ETA
        const elapsed = (Date.now() - downloadStartTime) / 1000; // seconds
        const speed = current / elapsed; // items per second
        const remaining = total - current;
        const eta = remaining > 0 && speed > 0 ? remaining / speed : 0;
        
        // Format speed and ETA
        const speedText = speed > 0 ? `${speed.toFixed(1)}/sec` : '0/sec';
        const etaText = eta > 0 ? formatTime(eta) : '';
        
        // Update progress text with speed info
        let progressText = `${Math.round(percentage)}% Complete (${current}/${total})`;
        if (speed > 0) {
            progressText += ` • ${speedText}`;
            if (etaText) {
                progressText += ` • ETA: ${etaText}`;
            }
        }
        
        elements.progressText.textContent = progressText;
        elements.progressContainer.classList.remove('hidden');
    } else {
        elements.progressContainer.classList.add('hidden');
    }
}

/**
 * Format time in seconds to human readable format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    if (seconds < 60) {
        return `${Math.ceil(seconds)}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.ceil(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

// ============================================================================
// IMAGE PREVIEW GRID
// ============================================================================

/**
 * Clear the preview grid
 */
function clearPreviewGrid() {
    previewImages.clear();
    elements.previewGrid.innerHTML = `
        <div class="preview-placeholder">
            <span>📸</span>
            <p>Scraped images will appear here</p>
        </div>
    `;
}

/**
 * Add image to preview grid
 * @param {string} imageUrl - URL of the image to preview
 * @param {string} status - Status of the image ('found', 'downloading', 'downloaded', 'failed')
 */
function addImageToPreview(imageUrl, status = 'found') {
    if (previewImages.has(imageUrl)) {
        // Update existing image status
        updateImagePreviewStatus(imageUrl, status);
        return;
    }
    
    previewImages.add(imageUrl);
    
    // Remove placeholder if this is the first image
    const placeholder = elements.previewGrid.querySelector('.preview-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    // Create preview item
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.setAttribute('data-url', imageUrl);
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Scraped image preview';
    img.loading = 'lazy';
    
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'preview-status';
    statusIndicator.textContent = getStatusEmoji(status);
    statusIndicator.title = getStatusText(status);
    
    previewItem.appendChild(img);
    previewItem.appendChild(statusIndicator);
    
    // Add click handler for full-size view
    previewItem.addEventListener('click', () => {
        window.open(imageUrl, '_blank');
    });
    
    elements.previewGrid.appendChild(previewItem);
    
    // Limit preview items to prevent performance issues
    const maxPreviews = 50;
    const previewItems = elements.previewGrid.querySelectorAll('.preview-item');
    if (previewItems.length > maxPreviews) {
        const oldestItem = previewItems[0];
        const oldestUrl = oldestItem.getAttribute('data-url');
        previewImages.delete(oldestUrl);
        oldestItem.remove();
    }
}

/**
 * Update status of existing preview image
 * @param {string} imageUrl - URL of the image
 * @param {string} status - New status
 */
function updateImagePreviewStatus(imageUrl, status) {
    const previewItem = elements.previewGrid.querySelector(`[data-url="${CSS.escape(imageUrl)}"]`);
    if (previewItem) {
        const statusIndicator = previewItem.querySelector('.preview-status');
        if (statusIndicator) {
            statusIndicator.textContent = getStatusEmoji(status);
            statusIndicator.title = getStatusText(status);
        }
    }
}

/**
 * Get emoji for status
 * @param {string} status - Status string
 * @returns {string} Emoji representation
 */
function getStatusEmoji(status) {
    switch (status) {
        case 'found': return '👁️';
        case 'downloading': return '⏳';
        case 'downloaded': return '✅';
        case 'failed': return '❌';
        default: return '❓';
    }
}

/**
 * Get text description for status
 * @param {string} status - Status string
 * @returns {string} Text description
 */
function getStatusText(status) {
    switch (status) {
        case 'found': return 'Image found';
        case 'downloading': return 'Downloading...';
        case 'downloaded': return 'Downloaded successfully';
        case 'failed': return 'Download failed';
        default: return 'Unknown status';
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
    
    // Keep only last 200 entries
    while (elements.logDisplay.children.length > 200) {
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
            
            // Add recent entries (last 100)
            const recentEntries = result.scrapeLog.slice(-100);
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
            
            updateStatus('Report exported successfully!', 'success');
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
                updateConnectionStatus(true);
                break;
                
            case 'progressUpdate':
                updateStats({
                    thumbnails: message.totalScraped,
                    destinations: message.totalScraped
                });
                
                if (message.status) {
                    updateStatus(message.status);
                }
                
                // Add images to preview grid if available
                if (message.images && Array.isArray(message.images)) {
                    message.images.forEach(imageUrl => {
                        addImageToPreview(imageUrl, 'found');
                    });
                }
                break;
                
            case 'downloadProgress':
                updateProgress(message.downloaded, message.total);
                
                if (message.currentFile) {
                    updateStatus(`Downloading: ${message.currentFile}`);
                    // Update preview status if we have the URL
                    if (message.currentUrl) {
                        updateImagePreviewStatus(message.currentUrl, 'downloading');
                    }
                }
                
                // Update completed downloads in preview
                if (message.completedUrl) {
                    updateImagePreviewStatus(message.completedUrl, 'downloaded');
                }
                
                // Update failed downloads in preview
                if (message.failedUrl) {
                    updateImagePreviewStatus(message.failedUrl, 'failed');
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
    elements.progressContainer.classList.add('hidden');
    
    logMessage(`Scraping completed: ${report.summary.totalThumbnails} thumbnails, ${report.summary.totalFailures} failures`, 'success');
}

// ============================================================================
// STATUS POLLING
// ============================================================================

/**
 * Start polling for scraping status
 */
function startStatusPolling() {
    // Poll every 3 seconds (less frequent than popup since we have real-time updates)
    statusPollingInterval = setInterval(updateScrapingStatus, 3000);
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
            
            updateConnectionStatus(true);
        }
    } catch (error) {
        // Background script might not be ready, mark as disconnected
        updateConnectionStatus(false, 'Background script unavailable');
    }
}