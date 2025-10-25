// MasterScraper: Enhanced Dashboard with Dedicated Window Support
// Based on analysis of multiple Chrome extensions for professional UI/UX

console.log('MasterScraper: Dashboard initialized');

// Global state
let isScraping = false;
let isPaused = false;
let currentSettings = null;
let siteProfile = null;

// Default settings
const DEFAULT_SETTINGS = {
    downloadFolder: 'MasterScraper',
    maxWaitTime: 30000,
    scrollDelay: 1000,
    autoScroll: true,
    autoDownload: true,
    maxPages: 100,
    retryCount: 2,
    maxConcurrentDownloads: 3,
    minImageWidth: 0,
    imageContainerSelector: '',
    nextPageSelector: ''
};

// DOM elements
const elements = {
    // Top bar
    currentTabUrl: document.getElementById('currentTabUrl'),
    siteProfileStatus: document.getElementById('siteProfileStatus'),
    profileName: document.getElementById('profileName'),
    themeToggle: document.getElementById('themeToggle'),

    // Sidebar settings
    maxWait: document.getElementById('maxWait'), // seconds
    scrollDelay: document.getElementById('scrollDelay'), // seconds
    downloadFolder: document.getElementById('downloadFolder'),
    advancedToggle: document.getElementById('advancedToggle'),
    advancedSettings: document.getElementById('advancedSettings'),

    // Advanced
    maxConcurrentDownloads: document.getElementById('maxConcurrentDownloads'),
    minImageWidth: document.getElementById('minImageWidth'),
    imageContainerSelector: document.getElementById('imageContainerSelector'),
    nextPageSelector: document.getElementById('nextPageSelector'),
    saveSettings: document.getElementById('saveSettings'),

    // Actions
    startScrapeCurrentPage: document.getElementById('startScrapeCurrentPage'),
    startScrapeAllPages: document.getElementById('startScrapeAllPages'),
    controlButtons: document.getElementById('controlButtons'),
    startButtons: document.getElementById('startButtons'),
    pauseScraping: document.getElementById('pauseScraping'),
    resumeScraping: document.getElementById('resumeScraping'),
    stopScraping: document.getElementById('stopScraping'),

    // Preview
    previewGrid: document.getElementById('previewGrid'),

    // Status / Progress / Stats
    statusDisplay: document.getElementById('statusDisplay'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    thumbnailCount: document.getElementById('thumbnailCount'),
    destinationCount: document.getElementById('destinationCount'),
    downloadCount: document.getElementById('downloadCount'),
    failureCount: document.getElementById('failureCount'),

    // Log
    logDisplay: document.getElementById('logDisplay'),
    clearLog: document.getElementById('clearLog'),
    exportReport: document.getElementById('exportReport'),
    refreshConnection: document.getElementById('refreshConnection')
};

// Initialize dashboard
async function initializeDashboard() {
    try {
        console.log('Initializing MasterScraper dashboard...');

        // Load settings
        await loadSettings();

        // Setup UI bindings
        setupEventListeners();
        setupMessageListeners();

        // Load current tab info
        await loadCurrentTabInfo();

        // Theme
        loadThemePreference();

        // Initial UI state
        updateUIIdle();

        addLogEntry('MasterScraper dashboard ready 🚀', 'info');
        console.log('MasterScraper dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        addLogEntry(`Error initializing dashboard: ${error.message}`, 'error');
    }
}

// Settings management
async function loadSettings() {
    const result = await chrome.storage.local.get(['settings']);
    currentSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };

    // Apply to UI (convert ms->seconds where relevant)
    elements.maxWait.value = Math.round(currentSettings.maxWaitTime / 1000);
    elements.scrollDelay.value = (currentSettings.scrollDelay / 1000).toFixed(1);
    elements.downloadFolder.value = currentSettings.downloadFolder || 'MasterScraper';

    elements.maxConcurrentDownloads.value = currentSettings.maxConcurrentDownloads ?? 3;
    elements.minImageWidth.value = currentSettings.minImageWidth ?? 0;
    elements.imageContainerSelector.value = currentSettings.imageContainerSelector ?? '';
    elements.nextPageSelector.value = currentSettings.nextPageSelector ?? '';
}

async function saveSettings(showToast = true) {
    // Read from UI (convert seconds->ms where relevant)
    currentSettings = {
        ...currentSettings,
        maxWaitTime: Math.max(5000, Math.min(120000, (parseFloat(elements.maxWait.value) || 30) * 1000)),
        scrollDelay: Math.max(100, Math.min(10000, (parseFloat(elements.scrollDelay.value) || 0.5) * 1000)),
        downloadFolder: elements.downloadFolder.value || 'MasterScraper',
        maxConcurrentDownloads: parseInt(elements.maxConcurrentDownloads.value) || 3,
        minImageWidth: parseInt(elements.minImageWidth.value) || 0,
        imageContainerSelector: elements.imageContainerSelector.value || '',
        nextPageSelector: elements.nextPageSelector.value || ''
    };

    await chrome.storage.local.set({ settings: currentSettings });
    if (showToast) addLogEntry('Settings saved', 'success');
}

// Add helper to refresh target tab display and ensure we are scraping the right tab
async function refreshTargetTab() {
    try {
        const target = await chrome.runtime.sendMessage({ action: 'getTargetTab' });
        if (target && target.url) {
            elements.currentTabUrl.textContent = target.url;
            return target;
        }
    } catch (e) {}
    return { id: null, url: '' };
}

// Update loadCurrentTabInfo to show target tab
async function loadCurrentTabInfo() {
    try {
        const target = await refreshTargetTab();
        const response = await chrome.runtime.sendMessage({ action: 'getSiteProfile', url: target.url || '' });
        siteProfile = response;
        if (siteProfile && siteProfile.name) {
            elements.profileName.textContent = siteProfile.name;
            elements.siteProfileStatus.classList.remove('universal');
            elements.siteProfileStatus.classList.add('detected');
        } else {
            elements.profileName.textContent = 'Universal';
            elements.siteProfileStatus.classList.remove('detected');
            elements.siteProfileStatus.classList.add('universal');
        }
    } catch (e) {
        console.error('Error loading tab info', e);
    }
}

// UI listeners
function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Advanced toggle
    elements.advancedToggle.addEventListener('click', () => {
        const isHidden = elements.advancedSettings.classList.contains('hidden');
        elements.advancedSettings.classList.toggle('hidden', !isHidden);
        elements.advancedToggle.textContent = isHidden ? 'Hide Advanced Settings' : 'Show Advanced Settings';
    });

    // Save settings
    elements.saveSettings.addEventListener('click', () => saveSettings(true));

    // Start/stop/pause/resume
    elements.startScrapeCurrentPage.addEventListener('click', () => startScraping(false));
    elements.startScrapeAllPages.addEventListener('click', () => startScraping(true));
    elements.stopScraping.addEventListener('click', stopScraping);
    elements.pauseScraping.addEventListener('click', () => {
        if (isPaused) {
            resumeScraping();
        } else {
            pauseScraping();
        }
    });

    // Log actions
    elements.clearLog.addEventListener('click', clearLogs);
    elements.exportReport.addEventListener('click', () => exportData());
    elements.refreshConnection.addEventListener('click', async () => {
        const res = await chrome.runtime.sendMessage({ action: 'updateTargetFromActive' });
        if (res && res.success) {
            addLogEntry(`Target updated to active tab: ${res.url}`, 'info');
            await loadCurrentTabInfo();
        } else {
            addLogEntry(`Failed to update target: ${res?.error || 'Unknown error'}`, 'error');
        }
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });
}

function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message) => {
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

// Theme management
function loadThemePreference() {
    const theme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', theme);
    if (elements.themeToggle) {
        elements.themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    if (elements.themeToggle) {
        elements.themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
    }
}

// Use targetTabId when starting scraping
async function startScraping(scrapeAllPages = false) {
    try {
        await saveSettings(false);

        const target = await chrome.runtime.sendMessage({ action: 'getTargetTab' });
        if (!target || !target.id || !target.url || !target.url.startsWith('http')) {
            addLogEntry('Please navigate to a valid gallery page and click 🔄 Refresh Connection to set as target', 'error');
            return;
        }

        const settings = {
            ...currentSettings,
            currentUrl: target.url,
            scrapeAllPages: scrapeAllPages
        };

        await chrome.runtime.sendMessage({ action: 'startScraping', settings, targetTabId: target.id });
        isScraping = true;
        isPaused = false;
        updateUIRunning();
        addLogEntry(`Scraping started - ${scrapeAllPages ? 'All pages' : 'Current page'}`, 'success');
    } catch (error) {
        console.error('Error starting scraping:', error);
        addLogEntry(`Error starting scraping: ${error.message}`, 'error');
    }
}

async function stopScraping() {
    await chrome.runtime.sendMessage({ action: 'stopScraping' });
    isScraping = false;
    isPaused = false;
    updateUIIdle();
    addLogEntry('Scraping stopped', 'info');
}

async function pauseScraping() {
    await chrome.runtime.sendMessage({ action: 'pauseScraping' });
    isPaused = true;
    updateUIPaused();
    addLogEntry('Scraping paused', 'warn');
}

async function resumeScraping() {
    await chrome.runtime.sendMessage({ action: 'resumeScraping' });
    isPaused = false;
    updateUIRunning();
    addLogEntry('Scraping resumed', 'success');
}

// Progress and logs
function handleProgressUpdate(progress) {
    // Stats
    elements.thumbnailCount.textContent = progress.total || 0;
    elements.downloadCount.textContent = progress.downloaded || 0;
    elements.failureCount.textContent = progress.failed || 0;

    // Progress bar
    const percentage = progress.percentage || 0;
    elements.progressContainer.classList.remove('hidden');
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressText.textContent = `${percentage}% Complete`;
}

function handleLogUpdate(log) {
    addLogEntry(log.message, log.type);
}

function handleScrapingComplete() {
    isScraping = false;
    isPaused = false;
    updateUIIdle();
    addLogEntry('Scraping completed successfully!', 'success');
}

function handleScrapingError(error) {
    addLogEntry(`Scraping error: ${error}`, 'error');
}

// UI helpers
function addLogEntry(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
    elements.logDisplay.appendChild(entry);
    elements.logDisplay.scrollTop = elements.logDisplay.scrollHeight;
}

async function clearLogs() {
    elements.logDisplay.innerHTML = '';
    await chrome.runtime.sendMessage({ action: 'clearLogs' });
}

async function exportData() {
    const format = confirm('Export as JSON? Click OK for JSON, Cancel for CSV') ? 'json' : 'csv';
    await chrome.runtime.sendMessage({ action: 'exportData', format });
    addLogEntry(`Data export requested: ${format.toUpperCase()}`, 'info');
}

function updateUIIdle() {
    elements.startButtons.classList.remove('hidden');
    elements.controlButtons.classList.add('hidden');
    elements.resumeScraping.classList.add('hidden');
    elements.statusDisplay.classList.remove('error', 'warning', 'success');
    elements.statusDisplay.textContent = 'Ready to scrape - Select a target page and click start';
}

function updateUIRunning() {
    elements.startButtons.classList.add('hidden');
    elements.controlButtons.classList.remove('hidden');
    elements.resumeScraping.classList.add('hidden');
    elements.statusDisplay.classList.remove('error', 'warning');
    elements.statusDisplay.classList.add('success');
    elements.statusDisplay.textContent = 'Running';
}

function updateUIPaused() {
    elements.startButtons.classList.add('hidden');
    elements.controlButtons.classList.remove('hidden');
    elements.resumeScraping.classList.remove('hidden');
    elements.statusDisplay.classList.remove('error', 'success');
    elements.statusDisplay.classList.add('warning');
    elements.statusDisplay.textContent = 'Paused';
}

function applyPreset(preset) {
    // Update quick presets simply by adjusting wait/scroll
    switch (preset) {
        case 'fast':
            elements.maxWait.value = 15;
            elements.scrollDelay.value = 0.3;
            break;
        case 'quality':
            elements.maxWait.value = 45;
            elements.scrollDelay.value = 1.0;
            break;
        case 'compatible':
            elements.maxWait.value = 60;
            elements.scrollDelay.value = 1.5;
            break;
    }
    saveSettings(false);
    addLogEntry(`Preset applied: ${preset}`, 'info');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);