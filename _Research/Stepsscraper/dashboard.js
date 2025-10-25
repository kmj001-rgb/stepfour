// StepScraper: Enhanced Dashboard with Dedicated Window Support
// Based on analysis of multiple Chrome extensions for professional UI/UX

console.log('StepScraper: Dashboard initialized');

// Global state
let isScraping = false;
let isPaused = false;
let currentSettings = null;
let siteProfile = null;

// Enhanced presets based on analyzed extensions
const PRESETS = {
    'Getty Images': {
        downloadFolder: 'Getty_Images',
        maxWaitTime: 30000,
        scrollDelay: 2000,
        autoScroll: true,
        autoDownload: true,
        maxPages: 100,
        retryCount: 3
    },
    'Shutterstock': {
        downloadFolder: 'Shutterstock',
        maxWaitTime: 25000,
        scrollDelay: 1500,
        autoScroll: true,
        autoDownload: true,
        maxPages: 100,
        retryCount: 3
    },
    'MirrorPix': {
        downloadFolder: 'MirrorPix',
        maxWaitTime: 20000,
        scrollDelay: 1000,
        autoScroll: true,
        autoDownload: true,
        maxPages: 100,
        retryCount: 2
    },
    'Imago Images': {
        downloadFolder: 'Imago_Images',
        maxWaitTime: 20000,
        scrollDelay: 1000,
        autoScroll: true,
        autoDownload: true,
        maxPages: 100,
        retryCount: 2
    },
    'ActionPress': {
        downloadFolder: 'ActionPress',
        maxWaitTime: 20000,
        scrollDelay: 1000,
        autoScroll: true,
        autoDownload: true,
        maxPages: 100,
        retryCount: 2
    },
    'Generic': {
        downloadFolder: 'StepScraper',
        maxWaitTime: 30000,
        scrollDelay: 1000,
        autoScroll: true,
        autoDownload: true,
        maxPages: 100,
        retryCount: 2
    }
};

// DOM elements
const elements = {
    // Settings
    downloadFolder: document.getElementById('downloadFolder'),
    maxWaitTime: document.getElementById('maxWaitTime'),
    scrollDelay: document.getElementById('scrollDelay'),
    autoScroll: document.getElementById('autoScroll'),
    autoDownload: document.getElementById('autoDownload'),
    maxPages: document.getElementById('maxPages'),
    retryCount: document.getElementById('retryCount'),
    presetSelect: document.getElementById('presetSelect'),
    
    // Controls
    scrapePage: document.getElementById('scrapePage'),
    scrapeAll: document.getElementById('scrapeAll'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    exportBtn: document.getElementById('exportBtn'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    
    // Status
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    
    // Statistics
    totalImages: document.getElementById('totalImages'),
    downloadedImages: document.getElementById('downloadedImages'),
    failedDownloads: document.getElementById('failedDownloads'),
    currentPage: document.getElementById('currentPage'),
    
    // Progress
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    
    // Log
    statusLog: document.getElementById('statusLog'),
    
    // Site info
    siteInfo: document.getElementById('siteInfo'),
    siteName: document.getElementById('siteName'),
    siteStatus: document.getElementById('siteStatus')
};

// Initialize dashboard
async function initializeDashboard() {
    try {
        console.log('Initializing StepScraper dashboard...');
        
        // Load settings
        await loadSettings();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup message listeners
        setupMessageListeners();
        
        // Load current tab info
        await loadCurrentTabInfo();
        
        // Load theme preference
        loadThemePreference();
        
        // Update UI
        updateUI();
        
        console.log('StepScraper dashboard initialized successfully');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        addLogEntry(`Error initializing dashboard: ${error.message}`, 'error');
    }
}

// Load settings from storage
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        currentSettings = result.settings || PRESETS['Generic'];
        
        // Apply settings to UI
        elements.downloadFolder.value = currentSettings.downloadFolder || 'StepScraper';
        elements.maxWaitTime.value = currentSettings.maxWaitTime || 30000;
        elements.scrollDelay.value = currentSettings.scrollDelay || 1000;
        elements.autoScroll.checked = currentSettings.autoScroll !== false;
        elements.autoDownload.checked = currentSettings.autoDownload !== false;
        elements.maxPages.value = currentSettings.maxPages || 100;
        elements.retryCount.value = currentSettings.retryCount || 2;
        
        // Set preset
        const presetName = getPresetName(currentSettings);
        elements.presetSelect.value = presetName;
        
    } catch (error) {
        console.error('Error loading settings:', error);
        currentSettings = PRESETS['Generic'];
    }
}

// Save settings to storage
async function saveSettings() {
    try {
        currentSettings = {
            downloadFolder: elements.downloadFolder.value,
            maxWaitTime: parseInt(elements.maxWaitTime.value) || 30000,
            scrollDelay: parseInt(elements.scrollDelay.value) || 1000,
            autoScroll: elements.autoScroll.checked,
            autoDownload: elements.autoDownload.checked,
            maxPages: parseInt(elements.maxPages.value) || 100,
            retryCount: parseInt(elements.retryCount.value) || 2
        };
        
        await chrome.storage.local.set({ settings: currentSettings });
        addLogEntry('Settings saved', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        addLogEntry(`Error saving settings: ${error.message}`, 'error');
    }
}

// Get preset name based on settings
function getPresetName(settings) {
    for (const [name, preset] of Object.entries(PRESETS)) {
        if (preset.downloadFolder === settings.downloadFolder) {
            return name;
        }
    }
    return 'Generic';
}

// Setup event listeners
function setupEventListeners() {
    // Settings changes
    elements.downloadFolder.addEventListener('change', saveSettings);
    elements.maxWaitTime.addEventListener('change', saveSettings);
    elements.scrollDelay.addEventListener('change', saveSettings);
    elements.autoScroll.addEventListener('change', saveSettings);
    elements.autoDownload.addEventListener('change', saveSettings);
    elements.maxPages.addEventListener('change', saveSettings);
    elements.retryCount.addEventListener('change', saveSettings);
    
    // Preset selection
    elements.presetSelect.addEventListener('change', (e) => {
        const presetName = e.target.value;
        const preset = PRESETS[presetName];
        if (preset) {
            currentSettings = { ...preset };
            applySettingsToUI();
            saveSettings();
            addLogEntry(`Preset applied: ${presetName}`, 'info');
        }
    });
    
    // Control buttons
    elements.scrapePage.addEventListener('click', () => startScraping(false));
    elements.scrapeAll.addEventListener('click', () => startScraping(true));
    
    elements.pauseBtn.addEventListener('click', () => {
        if (isPaused) {
            resumeScraping();
        } else {
            pauseScraping();
        }
    });
    
    elements.stopBtn.addEventListener('click', stopScraping);
    elements.exportBtn.addEventListener('click', exportData);
    elements.clearLogsBtn.addEventListener('click', clearLogs);
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// Apply settings to UI
function applySettingsToUI() {
    elements.downloadFolder.value = currentSettings.downloadFolder;
    elements.maxWaitTime.value = currentSettings.maxWaitTime;
    elements.scrollDelay.value = currentSettings.scrollDelay;
    elements.autoScroll.checked = currentSettings.autoScroll;
    elements.autoDownload.checked = currentSettings.autoDownload;
    elements.maxPages.value = currentSettings.maxPages;
    elements.retryCount.value = currentSettings.retryCount;
}

// Load current tab info
async function loadCurrentTabInfo() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // Get site profile
            const response = await chrome.runtime.sendMessage({ 
                action: 'getSiteProfile' 
            });
            siteProfile = response;
            
            // Update site info
            if (siteProfile && siteProfile.name) {
                elements.siteName.textContent = siteProfile.name;
                elements.siteStatus.textContent = 'Detected';
                elements.siteInfo.style.display = 'block';
                
                // Auto-apply site-specific settings
                if (siteProfile.downloadFolder && !currentSettings.downloadFolder.includes(siteProfile.downloadFolder)) {
                    currentSettings.downloadFolder = siteProfile.downloadFolder;
                    elements.downloadFolder.value = siteProfile.downloadFolder;
                    addLogEntry(`Auto-detected site: ${siteProfile.name}`, 'info');
                }
            } else {
                elements.siteName.textContent = 'Unknown Site';
                elements.siteStatus.textContent = 'Generic Mode';
                elements.siteInfo.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error loading tab info:', error);
    }
}

// Start scraping
async function startScraping(scrapeAllPages = false) {
    try {
        if (isScraping) {
            addLogEntry('Scraping already in progress', 'warn');
            return;
        }
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            addLogEntry('No active tab found', 'error');
            return;
        }
        
        // Validate URL
        if (!tab.url.startsWith('http')) {
            addLogEntry('Please navigate to a valid gallery page', 'error');
            return;
        }
        
        // Prepare settings
        const settings = {
            ...currentSettings,
            currentUrl: tab.url,
            scrapeAllPages: scrapeAllPages
        };
        
        // Start scraping
        await chrome.runtime.sendMessage({
            action: 'startScraping',
            settings: settings
        });
        
        isScraping = true;
        isPaused = false;
        updateScrapingUI(true, false);
        
        addLogEntry(`Scraping started - ${scrapeAllPages ? 'All pages' : 'Current page'}`, 'success');
        
    } catch (error) {
        console.error('Error starting scraping:', error);
        addLogEntry(`Error starting scraping: ${error.message}`, 'error');
    }
}

// Pause scraping
async function pauseScraping() {
    try {
        await chrome.runtime.sendMessage({ action: 'pauseScraping' });
        isPaused = true;
        updateScrapingUI(true, true);
        addLogEntry('Scraping paused', 'warning');
    } catch (error) {
        console.error('Error pausing scraping:', error);
        addLogEntry(`Error pausing scraping: ${error.message}`, 'error');
    }
}

// Resume scraping
async function resumeScraping() {
    try {
        await chrome.runtime.sendMessage({ action: 'resumeScraping' });
        isPaused = false;
        updateScrapingUI(true, false);
        addLogEntry('Scraping resumed', 'success');
    } catch (error) {
        console.error('Error resuming scraping:', error);
        addLogEntry(`Error resuming scraping: ${error.message}`, 'error');
    }
}

// Stop scraping
async function stopScraping() {
    try {
        await chrome.runtime.sendMessage({ action: 'stopScraping' });
        isScraping = false;
        isPaused = false;
        updateScrapingUI(false, false);
        addLogEntry('Scraping stopped', 'info');
    } catch (error) {
        console.error('Error stopping scraping:', error);
        addLogEntry(`Error stopping scraping: ${error.message}`, 'error');
    }
}

// Export data
async function exportData() {
    try {
        const format = confirm('Export as JSON? Click OK for JSON, Cancel for CSV') ? 'json' : 'csv';
        await chrome.runtime.sendMessage({ action: 'exportData', format: format });
        addLogEntry(`Data exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        addLogEntry(`Error exporting data: ${error.message}`, 'error');
    }
}

// Clear logs
async function clearLogs() {
    try {
        await chrome.runtime.sendMessage({ action: 'clearLogs' });
        elements.statusLog.innerHTML = '';
        addLogEntry('Logs cleared', 'info');
    } catch (error) {
        console.error('Error clearing logs:', error);
        addLogEntry(`Error clearing logs: ${error.message}`, 'error');
    }
}

// Setup message listeners
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'progressUpdate':
                handleProgressUpdate(message.progress);
                break;
            case 'logUpdate':
                handleLogUpdate(message.log);
                break;
            case 'scrapingComplete':
                handleScrapingComplete();
                break;
            case 'scrapingError':
                handleScrapingError(message.error);
                break;
        }
    });
}

// Handle progress update
function handleProgressUpdate(progress) {
    // Update statistics
    elements.totalImages.textContent = progress.total || 0;
    elements.downloadedImages.textContent = progress.downloaded || 0;
    elements.failedDownloads.textContent = progress.failed || 0;
    
    // Update progress bar
    if (progress.total > 0) {
        const percentage = progress.percentage || 0;
        elements.progressBar.style.width = `${percentage}%`;
        elements.progressText.textContent = `${percentage}% (${progress.downloaded}/${progress.total})`;
    }
}

// Handle log update
function handleLogUpdate(log) {
    addLogEntry(log.message, log.type);
}

// Handle scraping complete
function handleScrapingComplete() {
    isScraping = false;
    isPaused = false;
    updateScrapingUI(false, false);
    addLogEntry('Scraping completed successfully!', 'success');
}

// Handle scraping error
function handleScrapingError(error) {
    addLogEntry(`Scraping error: ${error}`, 'error');
}

// Update scraping UI
function updateScrapingUI(scraping, paused) {
    if (scraping) {
        elements.scrapePage.style.display = 'none';
        elements.scrapeAll.style.display = 'none';
        if (paused) {
            elements.statusIndicator.className = 'status-indicator status-paused';
            elements.statusText.textContent = 'Paused';
            elements.pauseBtn.innerHTML = '<span>▶️</span>Resume';
        } else {
            elements.statusIndicator.className = 'status-indicator status-running';
            elements.statusText.textContent = 'Running';
            elements.pauseBtn.innerHTML = '<span>⏸️</span>Pause';
        }
    } else {
        elements.scrapePage.style.display = 'flex';
        elements.scrapeAll.style.display = 'flex';
        elements.statusIndicator.className = 'status-indicator status-idle';
        elements.statusText.textContent = 'Ready';
        elements.pauseBtn.innerHTML = '<span>⏸️</span>Pause';
    }
}

// Add log entry
function addLogEntry(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
    
    elements.statusLog.appendChild(logEntry);
    elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
    
    // Keep only last 100 log entries
    while (elements.statusLog.children.length > 100) {
        elements.statusLog.removeChild(elements.statusLog.firstChild);
    }
}

// Update UI
function updateUI() {
    // Update status
    if (isScraping) {
        updateScrapingUI(true, isPaused);
    } else {
        updateScrapingUI(false, false);
    }
    
    // Update progress
    elements.progressBar.style.width = '0%';
    elements.progressText.textContent = '0% (0/0)';
}

// Theme management
function loadThemePreference() {
    const theme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', theme);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Add initial log entry
addLogEntry('StepScraper dashboard ready 🚀', 'info');