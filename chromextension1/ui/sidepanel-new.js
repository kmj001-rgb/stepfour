// sidepanel-unified.js - Unified sidepanel functionality
// Consolidates features from popup.js, windowed-dashboard.js, and options.js

/**
 * Detect if running in production mode
 * Production mode suppresses verbose logging but keeps errors/warnings
 */
const isProduction = () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const url = chrome.runtime.getURL('');
      return url.startsWith('chrome-extension://') && !url.includes('localhost');
    }
    return true; // Default to production if unsure
  } catch (e) {
    return true;
  }
};

const PRODUCTION = isProduction();

if (!PRODUCTION) console.log('🚀 StepThree Unified Sidepanel initializing...');

// Import Message Schema constants (loaded via message-schema.js script)
// MESSAGE_ACTIONS, MESSAGE_SOURCES, PORT_NAMES, etc. are now available globally

/**
 * Robust sendMessage wrapper with timeout and error handling
 * Prevents "No response received from background script" errors
 * @param {Object} message - The message to send to the background script
 * @param {number} timeout - Timeout in milliseconds (default: 8000ms)
 * @returns {Promise<Object>} Response from background script
 */
function sendMessageWithTimeout(message, timeout = 8000) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Message timeout after ${timeout}ms`));
    }, timeout);

    try {
      // callback-style to read chrome.runtime.lastError reliably
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (timedOut) return; // already rejected by timeout
        if (chrome.runtime && chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(response);
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

class UnifiedSidepanel {
  constructor() {
    // State management
    this.currentTab = null;
    this.isConnected = false;
    this.isScanning = false;
    this.scanResults = null;
    this.port = null;

    // Stats
    this.stats = {
      totalItems: 0,
      progressPercent: 0
    };

    // Settings
    this.settings = {
      autoDetectGalleries: true,
      downloadImages: true,
      smartFiltering: true,
      keyboardShortcuts: true,
      contextMenu: true,
      maxDownloads: 5,
      downloadFolder: 'StepThree',
      filenameMask: '*name*.*ext*',
      retryAttempts: 3,
      debugLogging: false,
      advancedFiltering: true,
      memoryOptimization: true,
      pageWait: 2000,
      scrollDelay: 1000,
      includeTableData: false,
      // Pagination settings
      autoPagination: true,
      maxPages: 10,
      paginationDelay: 2000,
      nextSelector: ''
    };

    // Activity log
    this.activityLog = [];
    this.maxLogEntries = 100;

    // Toast notifications
    this.toastQueue = [];
    this.toastIdCounter = 0;

    // Element picker state
    this.elementPickerActive = false;

    this.init();
    this.setupCleanupHandlers();
  }

  async init() {
    try {
      if (!PRODUCTION) console.log('📋 Initializing Unified Sidepanel...');

      // Load saved settings
      await this.loadSettings();

      // Set up event listeners
      this.setupEventListeners();

      // Get current tab
      await this.getCurrentTab();

      // Set up port connection for real-time updates
      this.setupPortConnection();

      // Update UI
      this.updateUI();

      // Log initialization
      this.logActivity('Sidepanel initialized');

      if (!PRODUCTION) console.log('✅ Unified Sidepanel initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize sidepanel:', error);
      this.showToast('Failed to initialize sidepanel', 'error');
    }
  }

  // ========== Port Communication ==========

  setupPortConnection() {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      if (!PRODUCTION) console.log('Chrome runtime not available - port connection skipped');
      return;
    }

    try {
      if (!PRODUCTION) console.log('🔌 Establishing port connection to background...');
      
      this.port = chrome.runtime.connect({ name: 'stepthree-sidepanel' });
      
      this.port.onMessage.addListener((message) => this.handlePortMessage(message));
      
      this.port.onDisconnect.addListener(() => {
        if (!PRODUCTION) console.log('🔌 Port disconnected');
        this.port = null;
        this.updateConnectionStatus(false);
      });
      
      this.port.postMessage({
        action: 'UI_SUBSCRIBE',
        payload: { channels: ['scan'] }
      });
      
      if (!PRODUCTION) console.log('✅ Port connected and subscribed to scan updates');
      this.logActivity('Connected to background for live updates');
      
    } catch (error) {
      console.error('❌ Failed to set up port connection:', error);
      this.port = null;
    }
  }

  handlePortMessage(message) {
    try {
      const action = message.action || message.updateType;
      
      if (!PRODUCTION) console.log('📨 Received port message:', action, message);
      
      switch (action) {
        case 'SCAN_STARTED':
          this.handleScanStarted(message);
          break;
          
        case 'SCAN_PROGRESS':
          this.handleScanProgressUpdate(message);
          break;
          
        case 'SCAN_COMPLETE':
          this.handleScanCompleteUpdate(message);
          break;
          
        case 'SCAN_ERROR':
          this.handleScanErrorUpdate(message);
          break;
          
        case 'SCAN_STOPPED':
          this.handleScanStoppedUpdate(message);
          break;
          
        case 'DOWNLOAD_STARTED':
          this.handleDownloadStarted(message);
          break;
          
        case 'DOWNLOAD_PROGRESS':
          this.handleDownloadProgress(message);
          break;
          
        case 'DOWNLOAD_COMPLETE':
          this.handleDownloadComplete(message);
          break;
          
        case 'EXPORT_STARTED':
          this.handleExportStarted(message);
          break;
          
        case 'EXPORT_COMPLETE':
          this.handleExportComplete(message);
          break;
          
        case 'PAGINATION_PROGRESS':
          this.handlePaginationProgress(message);
          break;
          
        default:
          if (!PRODUCTION) console.log('Unhandled port message:', action);
      }
    } catch (error) {
      console.error('❌ Error handling port message:', error);
    }
  }

  handleScanStarted(message) {
    if (!PRODUCTION) console.log('🚀 Scan started:', message);
    this.isScanning = true;
    this.showProgressCard();
    this.updateProgress(0, 'Scan starting...');
    this.logActivity('Scan started');
  }

  handleScanProgressUpdate(message) {
    const { progress, status, data } = message;
    
    if (!PRODUCTION) console.log('📊 Scan progress update:', progress, status);
    
    const progressPercent = progress || 0;
    const statusText = status || 'Scanning...';
    
    this.updateProgress(progressPercent, statusText);
    
    if (data) {
      this.stats.progressPercent = progressPercent;
      if (data.totalItems !== undefined) {
        this.stats.totalItems = data.totalItems;
      }
      this.updateStats(this.stats);
    }
    
    this.logActivity(`Progress: ${progressPercent}%`);
  }

  handleScanCompleteUpdate(message) {
    if (!PRODUCTION) console.log('✅ Scan complete:', message);
    
    const { results, stats, data } = message;
    const scanResults = results || data;
    
    this.isScanning = false;
    this.scanResults = scanResults;
    
    if (scanResults && Array.isArray(scanResults.items)) {
      const itemCount = scanResults.items.length;
      this.stats.totalItems = itemCount;
      this.stats.progressPercent = 100;
      
      this.updateStats(this.stats);
      this.showToast(`Scan complete! Found ${itemCount} items`, 'success');
      this.logActivity(`Scan complete: ${itemCount} items found`);
    } else if (scanResults && scanResults.length > 0) {
      const itemCount = scanResults.length;
      this.stats.totalItems = itemCount;
      this.stats.progressPercent = 100;
      
      this.updateStats(this.stats);
      this.showToast(`Scan complete! Found ${itemCount} items`, 'success');
      this.logActivity(`Scan complete: ${itemCount} items found`);
    } else {
      this.showToast('Scan complete', 'success');
      this.logActivity('Scan complete');
    }
    
    this.updateProgress(100, 'Complete');
    this.hideProgressCard();
  }

  handleScanErrorUpdate(message) {
    console.error('❌ Scan error:', message);
    
    const { error, data } = message;
    const errorMessage = error || data?.error || 'An error occurred during scan';
    
    this.isScanning = false;
    this.hideProgressCard();
    this.showToast(`Scan error: ${errorMessage}`, 'error');
    this.logActivity(`Scan error: ${errorMessage}`);
  }

  handleScanStoppedUpdate(message) {
    if (!PRODUCTION) console.log('🛑 Scan stopped:', message);
    
    this.isScanning = false;
    this.hideProgressCard();
    this.showToast('Scan stopped', 'warning');
    this.logActivity('Scan stopped');
  }

  handlePaginationProgress(message) {
    const payload = message.data || message.payload || message;
    const { currentPage, totalPages, imagesCollected, status } = payload;
    
    if (!PRODUCTION) console.log('📄 Pagination progress:', payload);
    
    // Guard against missing fields
    if (!currentPage && currentPage !== 0) {
      console.warn('Pagination progress missing currentPage field');
      return;
    }
    
    let statusText = '';
    if (status === 'scanning') {
      statusText = `Scanning page ${currentPage}${totalPages ? ` of ${totalPages}` : ''}...`;
    } else if (status === 'navigating') {
      statusText = `Navigating to page ${currentPage + 1}...`;
    } else if (status === 'complete') {
      statusText = `Completed ${currentPage} page${currentPage !== 1 ? 's' : ''}`;
    }
    
    this.updateProgress(totalPages ? (currentPage / totalPages * 100) : 50, statusText);
    
    if (imagesCollected !== undefined) {
      this.stats.totalItems = imagesCollected;
      this.updateStats(this.stats);
    }
    
    this.logActivity(`${statusText} - ${imagesCollected || 0} images collected`);
  }

  handleDownloadStarted(message) {
    const data = message.data || message;
    if (!PRODUCTION) console.log('📥 Download started:', message);
    this.showProgressCard();
    this.updateProgress(0, 'Starting downloads...');
    this.logActivity(`Starting download of ${data.totalItems || 0} items`);
  }

  handleDownloadProgress(message) {
    const data = message.data || message;
    const { completed, total, percentage } = data;
    if (!PRODUCTION) console.log('📥 Download progress:', { completed, total, percentage });
    
    this.updateProgress(percentage || 0, `Downloading: ${completed}/${total}`);
    this.logActivity(`Download progress: ${completed}/${total} (${percentage}%)`);
  }

  handleDownloadComplete(message) {
    const data = message.data || message;
    if (!PRODUCTION) console.log('✅ Download complete:', message);
    const { results } = data;
    
    if (results) {
      const successMsg = `Downloaded ${results.successful}/${results.total} images`;
      this.showToast(successMsg, results.failed > 0 ? 'warning' : 'success');
      this.logActivity(successMsg);
      
      if (results.failed > 0) {
        this.logActivity(`Failed to download ${results.failed} images`);
      }
    }
    
    this.hideProgressCard();
  }

  handleExportStarted(message) {
    const data = message.data || message;
    if (!PRODUCTION) console.log('📤 Export started:', message);
    this.showToast('Preparing export...', 'info');
    this.logActivity('Export started');
  }

  handleExportComplete(message) {
    const data = message.data || message;
    if (!PRODUCTION) console.log('✅ Export complete:', message);
    const { results } = data;
    
    if (results && Array.isArray(results)) {
      const successCount = results.filter(r => r.success).length;
      this.showToast(`Exported ${successCount} file(s)`, 'success');
      this.logActivity(`Export complete: ${successCount} file(s)`);
    } else {
      this.showToast('Export complete', 'success');
      this.logActivity('Export complete');
    }
  }

  disconnectPort() {
    if (this.port) {
      try {
        this.port.postMessage({
          action: 'UI_UNSUBSCRIBE',
          payload: { channels: ['scan'] }
        });
        this.port.disconnect();
        this.port = null;
        if (!PRODUCTION) console.log('🔌 Port disconnected and unsubscribed');
      } catch (error) {
        console.error('❌ Error disconnecting port:', error);
        this.port = null;
      }
    }
  }

  // ========== Tab Management ==========

  async getCurrentTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      this.currentTab = {
        id: 'dev-mode',
        title: 'Development Mode',
        url: 'http://localhost:5000'
      };
      this.updatePageInfo('Development Mode');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        this.currentTab = tab;
        this.isConnected = true;
        this.updatePageInfo(tab.title || 'Unknown page');
        this.updateConnectionStatus(true);
      }
    } catch (error) {
      console.error('Failed to get current tab:', error);
      this.isConnected = false;
      this.updateConnectionStatus(false);
    }
  }

  updatePageInfo(title) {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
      pageInfo.textContent = title;
    }
  }

  updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (statusDot) {
      statusDot.classList.toggle('disconnected', !connected);
    }

    if (statusText) {
      statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }
  }

  // ========== Event Listeners ==========

  setupEventListeners() {
    // Primary Actions
    this.addClickListener('scanPageBtn', () => this.handleScanPage());
    this.addClickListener('manualSelectBtn', () => this.handleManualSelect());
    
    // Debug Panel
    this.addClickListener('debugPanelBtn', () => this.openDebugPanel());

    // Progress Controls
    // Note: Pause button acts as stop since SCAN_PAUSE is not implemented in background.js
    this.addClickListener('pauseBtn', () => this.handleStop());
    this.addClickListener('stopBtn', () => this.handleStop());

    // Export Options
    this.addClickListener('presetQuickBasic', () => this.applyExportPreset('quickBasic'));
    this.addClickListener('presetCompleteDataset', () => this.applyExportPreset('completeDataset'));
    this.addClickListener('presetWebReport', () => this.applyExportPreset('webReport'));
    this.addClickListener('selectAllFields', () => this.handleSelectAllFields());
    this.addClickListener('selectCommonFields', () => this.handleSelectCommonFields());
    this.addClickListener('clearAllFields', () => this.handleClearAllFields());
    
    // Include Advanced Metadata toggle
    this.addChangeListener('includeMetadata', (e) => this.toggleAdvancedFields(e.target.checked));

    // Settings - Toggles
    this.setupToggleListeners();

    // Settings - Inputs
    this.setupInputListeners();

    // Element picker for next selector
    this.addClickListener('pickNextSelectorBtn', () => this.handlePickNextSelector());
    this.addClickListener('cancelElementPickerBtn', () => this.cancelElementPicker());

    // Settings - Actions
    this.addClickListener('resetSettingsBtn', () => this.resetSettings());
    this.addClickListener('saveSettingsBtn', () => this.saveSettings());

    // Permission Actions
    this.addClickListener('grantPermissionBtn', () => this.handleGrantPermission());
    this.addClickListener('cancelPermissionBtn', () => this.hidePermissionSection());

    // Footer
    this.addClickListener('helpBtn', () => this.showHelp());

    // Filename mask pattern tags
    this.setupPatternTagListeners();
  }

  setupToggleListeners() {
    const toggles = {
      autoDetectToggle: 'autoDetectGalleries',
      downloadImagesToggle: 'downloadImages',
      smartFilterToggle: 'smartFiltering',
      keyboardShortcutsToggle: 'keyboardShortcuts',
      contextMenuToggle: 'contextMenu',
      advancedFilteringToggle: 'advancedFiltering',
      memoryOptToggle: 'memoryOptimization',
      includeTableDataToggle: 'includeTableData',
      debugToggle: 'debugLogging',
      autoPaginationToggle: 'autoPagination'
    };

    Object.entries(toggles).forEach(([elementId, settingKey]) => {
      const toggle = document.getElementById(elementId);
      if (toggle) {
        toggle.addEventListener('change', () => {
          this.settings[settingKey] = toggle.checked;
          this.logActivity(`${settingKey} ${toggle.checked ? 'enabled' : 'disabled'}`);
        });
      }
    });
  }

  setupInputListeners() {
    const inputs = {
      downloadFolderInput: 'downloadFolder',
      filenameMaskInput: 'filenameMask',
      maxDownloadsSelect: 'maxDownloads',
      retryAttemptsSelect: 'retryAttempts',
      pageWaitInput: 'pageWait',
      scrollDelayInput: 'scrollDelay',
      maxPagesSelect: 'maxPages',
      paginationDelayInput: 'paginationDelay',
      nextSelectorInput: 'nextSelector'
    };

    Object.entries(inputs).forEach(([elementId, settingKey]) => {
      const input = document.getElementById(elementId);
      if (input) {
        input.addEventListener('change', () => {
          const value = input.type === 'number' || input.tagName === 'SELECT' 
            ? parseInt(input.value) 
            : input.value;
          this.settings[settingKey] = value;
        });
      }
    });
  }

  addClickListener(id, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handler);
    }
  }

  addChangeListener(id, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', handler);
    }
  }

  setupPatternTagListeners() {
    // Add click listeners to all pattern tags
    const patternTags = document.querySelectorAll('.pattern-tag');
    patternTags.forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.preventDefault();
        const pattern = tag.getAttribute('data-pattern');
        if (pattern) {
          this.insertPatternIntoMask(pattern);
        }
      });
    });
  }

  insertPatternIntoMask(pattern) {
    const maskInput = document.getElementById('filenameMaskInput');
    if (maskInput) {
      const currentValue = maskInput.value;
      const cursorPos = maskInput.selectionStart || currentValue.length;
      
      // Insert the pattern at cursor position
      const newValue = currentValue.slice(0, cursorPos) + pattern + currentValue.slice(cursorPos);
      maskInput.value = newValue;
      
      // Update the setting
      this.settings.filenameMask = newValue;
      
      // Set cursor position after the inserted pattern
      const newCursorPos = cursorPos + pattern.length;
      maskInput.setSelectionRange(newCursorPos, newCursorPos);
      maskInput.focus();
      
      // Show a brief visual feedback
      maskInput.style.backgroundColor = '#e8f5e8';
      setTimeout(() => {
        maskInput.style.backgroundColor = '';
      }, 300);
    }
  }

  // ========== Action Handlers ==========

  async handleScanPage() {
    try {
      this.logActivity('Starting page scan...');
      this.showToast('Scanning page for images...', 'info');
      this.showProgressCard();
      this.updateProgress(0, 'Initializing scan...');
      this.isScanning = true;
      
      // Get current tab
      if (!this.currentTab) {
        await this.getCurrentTab();
      }
      
      // Validate tab context - ensure we're not on a restricted page
      if (!this.currentTab || !this.currentTab.url) {
        throw new Error('No valid tab found');
      }
      
      const url = this.currentTab.url;
      const restrictedPrefixes = ['chrome://', 'edge://', 'about:', 'chrome-extension://', 'data:', 'file://'];
      const isRestricted = restrictedPrefixes.some(prefix => url.startsWith(prefix));
      
      if (isRestricted) {
        throw new Error('Cannot scan restricted pages (chrome://, edge://, about:, etc.). Please navigate to a regular webpage.');
      }
      
      if (!PRODUCTION) console.log('Attempting scan on tab:', this.currentTab?.id, 'URL:', url);
      
      // Check if table data should be included
      const includeTableData = this.settings.includeTableData || false;
      
      // Send SCAN_START message using proper message format
      // This will orchestrate smart detection first, then fall back to comprehensive scan
      let response;
      try {
        response = await sendMessageWithTimeout({
          action: 'SCAN_START',
          source: 'sidepanel',
          payload: {
            tabId: this.currentTab?.id,
            options: {
              concurrency: this.settings.maxDownloads || 5,
              timeout: 30000,
              maxPages: this.settings.autoPagination ? (this.settings.maxPages || 10) : 1,
              paginationDelay: this.settings.paginationDelay || 2000,
              autoPagination: this.settings.autoPagination || false,
              downloadImages: this.settings.downloadImages,
              smartFiltering: this.settings.smartFiltering,
              includeTables: includeTableData,
              nextSelector: (this.settings.nextSelector || '').trim() || undefined
            }
          },
          requestId: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        }, 10000); // 10s timeout for scan start
      } catch (messageError) {
        console.error('Failed to send message to background:', messageError);
        throw new Error(`Communication error: ${messageError.message}`);
      }
      
      if (!PRODUCTION) console.log('Scan response:', response);
      
      if (response && (response.ok || response.success)) {
        this.logActivity('Scan initiated successfully');
        // Progress updates will come via port messages
      } else if (response === undefined) {
        // Background script acknowledged but no response yet (still initializing)
        this.logActivity('Scan request sent, waiting for background...');
      } else {
        throw new Error(response?.error || response?.message || 'Failed to start scan');
      }
      
    } catch (error) {
      console.error('Scan error:', error);
      this.showToast(`Scan failed: ${error.message}`, 'error');
      this.hideProgressCard();
      this.isScanning = false;
      this.logActivity(`Scan failed: ${error.message}`);
    }
  }


  async handleManualSelect() {
    try {
      this.logActivity('Activating manual selector...');
      this.showToast('Click elements to select them', 'info');
      
      if (!this.currentTab) {
        await this.getCurrentTab();
      }
      
      let response;
      try {
        response = await sendMessageWithTimeout({
          action: 'ACTIVATE_SELECTOR',
          source: 'sidepanel',
          payload: {
            tabId: this.currentTab?.id
          },
          requestId: `selector_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        }, 8000); // 8s timeout for selector activation
      } catch (messageError) {
        console.error('Failed to send message to background:', messageError);
        throw new Error(`Communication error: ${messageError.message}`);
      }
      
      if (response && (response.ok || response.success)) {
        this.logActivity('Manual selector activated - click elements on the page');
      } else if (response === undefined) {
        // Background script acknowledged but no response yet (still initializing)
        this.logActivity('Selector request sent, waiting for background...');
      } else {
        throw new Error(response?.error || response?.message || 'Failed to activate selector');
      }
    } catch (error) {
      console.error('Selector activation error:', error);
      this.showToast(`Failed to activate selector: ${error.message}`, 'error');
      this.logActivity(`Selector activation failed: ${error.message}`);
    }
  }

  async handlePickNextSelector() {
    try {
      this.logActivity('Starting element picker for Next button...');
      this.showToast('Click the Next/Load More button on the page (Press ESC to cancel)', 'info');
      this.updateElementPickerUI(true);

      if (!this.currentTab) {
        await this.getCurrentTab();
      }

      // Start basic element picker directly in the tab (guarantees element_selected message)
      if (!chrome?.tabs?.sendMessage) {
        throw new Error('Chrome tabs API not available');
      }

      // Send message with proper error handling and retry mechanism
      let pickerStarted = false;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (!pickerStarted && retryCount <= maxRetries) {
        try {
          const response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'start_element_picker',
            source: 'sidepanel',
            requestId: `pick_next_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
          });
          
          if (response && !response.success) {
            throw new Error(response.error || 'Failed to start element picker');
          }
          pickerStarted = true;
          this.elementPickerActive = true;
          this.logActivity('Element picker started successfully');
        } catch (error) {
          retryCount++;
          
          if (error.message.includes('Could not establish connection') || 
              error.message.includes('Receiving end does not exist')) {
            if (retryCount <= maxRetries) {
              this.logActivity(`Content script not ready, retrying... (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
              continue;
            } else {
              throw new Error('Content script not loaded. Please refresh the page and try again.');
            }
          }
          if (error.message.includes('The message port closed')) {
            throw new Error('Page connection lost. Please refresh the page and try again.');
          }
          throw error;
        }
      }

      // Listen for element_selected from content script with improved error handling
      const selector = await new Promise((resolve, reject) => {
        let timeoutWarningShown = false;
        
        const timeout = setTimeout(() => {
          chrome.runtime?.onMessage?.removeListener(listener);
          reject(new Error('Element selection timed out. Please try clicking an element within 15 seconds.'));
        }, 15000); // Reduced timeout from 30s to 15s
        
        // Show warning at 10 seconds
        const warningTimeout = setTimeout(() => {
          if (!timeoutWarningShown) {
            this.showToast('Please click an element soon - timeout in 5 seconds', 'warning');
            timeoutWarningShown = true;
          }
        }, 10000);

        const listener = (message, sender, sendResponse) => {
          try {
            // Only process messages from the current tab
            if (sender.tab && sender.tab.id !== this.currentTab.id) {
              return;
            }

            const action = message?.action || message?.type;
            if (action === 'element_selected' && message?.selector) {
              clearTimeout(timeout);
              clearTimeout(warningTimeout);
              chrome.runtime?.onMessage?.removeListener(listener);
              resolve(message.selector);
            }
          } catch (error) {
            console.error('Error in element selection listener:', error);
          }
        };

        if (chrome?.runtime?.onMessage) {
          chrome.runtime.onMessage.addListener(listener);
        } else {
          clearTimeout(timeout);
          reject(new Error('Chrome runtime not available'));
        }
      });

      // Update settings and UI
      this.settings.nextSelector = selector;
      this.updateInput('nextSelectorInput', selector);
      this.showToast('Next button selector set', 'success');
      this.logActivity(`Next selector set: ${selector}`);
      this.elementPickerActive = false;

      // Persist settings
      await this.saveSettings();
    } catch (error) {
      console.error('Pick Next selector error:', error);
      this.showToast(`Failed to pick element: ${error.message}`, 'error');
      this.logActivity(`Pick Next selector failed: ${error.message}`);
      
      // If picker was started but failed, try to stop it
      if (this.currentTab && chrome?.tabs?.sendMessage) {
        try {
          await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'stop_element_picker'
          });
        } catch (stopError) {
          console.warn('Failed to stop element picker:', stopError);
        }
      }
    } finally {
      // Clean up any pending timeouts or listeners
      this.cleanupElementPicker();
    }
  }

  cancelElementPicker() {
    if (this.elementPickerActive) {
      this.cleanupElementPicker();
      this.showToast('Element picker cancelled', 'info');
      this.logActivity('Element picker cancelled by user');
      this.updateElementPickerUI(false);
    }
  }

  updateElementPickerUI(isActive) {
    const pickBtn = document.getElementById('pickNextSelectorBtn');
    const cancelBtn = document.getElementById('cancelElementPickerBtn');
    
    if (pickBtn) {
      pickBtn.disabled = isActive;
      pickBtn.textContent = isActive ? '⏳ Picking...' : '🎯 Pick';
    }
    
    if (cancelBtn) {
      cancelBtn.style.display = isActive ? 'inline-block' : 'none';
    }
  }

  cleanupElementPicker() {
    // This method can be called to clean up any pending element picker state
    if (this.elementPickerActive && this.currentTab && chrome?.tabs?.sendMessage) {
      try {
        chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'stop_element_picker'
        });
        this.elementPickerActive = false;
        this.updateElementPickerUI(false);
      } catch (error) {
        console.warn('Failed to stop element picker during cleanup:', error);
      }
    }
  }

  setupCleanupHandlers() {
    // Clean up when the sidepanel is closed or page changes
    window.addEventListener('beforeunload', () => {
      this.cleanupElementPicker();
    });

    // Clean up when the page visibility changes (user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.cleanupElementPicker();
      }
    });
  }

  openDebugPanel() {
    try {
      this.logActivity('Opening debug panel...');
      window.open(chrome.runtime.getURL('ui/debug-panel.html'), '_blank', 'width=1200,height=800');
      this.showToast('Debug panel opened in new window', 'success');
    } catch (error) {
      console.error('Failed to open debug panel:', error);
      this.showToast('Failed to open debug panel', 'error');
    }
  }

  async handleStop() {
    try {
      const response = await sendMessageWithTimeout({
        action: 'SCAN_STOP',
        source: 'sidepanel',
        requestId: `stop_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      }, 5000); // 5s timeout for stop
      
      if (response && response.ok) {
        this.isScanning = false;
        this.logActivity('Operation stopped');
        this.showToast('Stopped', 'error');
        this.hideProgressCard();
      }
    } catch (error) {
      console.error('Stop error:', error);
      this.isScanning = false;
      this.hideProgressCard();
      this.showToast('Stopped', 'error');
    }
  }



  applyExportPreset(presetName) {
    const presets = {
      quickBasic: {
        formats: ['csv'],
        fields: ['filename', 'url', 'width', 'height'],
        includeMetadata: false
      },
      completeDataset: {
        formats: ['csv', 'xlsx', 'json'],
        fields: ['filename', 'url', 'thumbnailUrl', 'width', 'height', 'altText', 'link', 'timestamp', 'confidenceScore', 'extractionMethod'],
        includeMetadata: true
      },
      webReport: {
        formats: ['html'],
        fields: ['filename', 'url', 'width', 'height', 'altText', 'link'],
        includeMetadata: false
      }
    };
    
    const preset = presets[presetName];
    if (!preset) return;
    
    // Apply format selections
    document.getElementById('formatCSV').checked = preset.formats.includes('csv');
    document.getElementById('formatXLSX').checked = preset.formats.includes('xlsx');
    document.getElementById('formatJSON').checked = preset.formats.includes('json');
    document.getElementById('formatHTML').checked = preset.formats.includes('html');
    
    // Apply field selections
    document.querySelectorAll('#fieldCheckboxes input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = preset.fields.includes(checkbox.value);
    });
    
    // Apply metadata toggle
    const metadataToggle = document.getElementById('includeMetadata');
    if (metadataToggle) {
      metadataToggle.checked = preset.includeMetadata;
      this.toggleAdvancedFields(preset.includeMetadata);
    }
    
    this.showToast(`Applied ${presetName.replace(/([A-Z])/g, ' $1').trim()} preset`, 'success');
    this.logActivity(`Applied export preset: ${presetName}`);
  }
  
  toggleAdvancedFields(show) {
    const advancedFields = document.getElementById('advancedFields');
    if (advancedFields) {
      advancedFields.style.display = show ? 'block' : 'none';
    }
  }

  handleSelectAllFields() {
    document.querySelectorAll('#fieldCheckboxes input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = true;
    });
    this.logActivity('All export fields selected');
  }

  handleSelectCommonFields() {
    const commonFields = ['filename', 'url', 'width', 'height'];
    document.querySelectorAll('#fieldCheckboxes input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = commonFields.includes(checkbox.value);
    });
    this.logActivity('Common export fields selected');
  }

  handleClearAllFields() {
    document.querySelectorAll('#fieldCheckboxes input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    this.logActivity('All export fields cleared');
  }

  async handleGrantPermission() {
    this.logActivity('Requesting downloads permission...');
    
    if (typeof chrome === 'undefined' || !chrome.permissions) {
      this.showToast('Chrome APIs not available', 'error');
      return;
    }

    try {
      const granted = await chrome.permissions.request({
        permissions: ['downloads']
      });

      if (granted) {
        this.hidePermissionSection();
        this.showToast('Permission granted', 'success');
        this.logActivity('Downloads permission granted');
      } else {
        this.showToast('Permission denied', 'error');
        this.logActivity('Downloads permission denied');
      }
    } catch (error) {
      console.error('Permission request error:', error);
      this.showToast('Permission request failed', 'error');
    }
  }

  showHelp() {
    this.logActivity('Opening help...');
    this.showToast('Help documentation - Coming soon', 'info');
  }

  // ========== Settings Management ==========

  async loadSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      if (!PRODUCTION) console.log('Chrome storage not available - using defaults');
      return;
    }

    try {
      const result = await chrome.storage.local.get(Object.keys(this.settings));
      this.settings = { ...this.settings, ...result };
      if (!PRODUCTION) console.log('✅ Settings loaded');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      this.showToast('Chrome storage not available', 'error');
      return;
    }

    try {
      await chrome.storage.local.set(this.settings);
      this.showToast('Settings saved successfully', 'success');
      this.logActivity('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('Failed to save settings', 'error');
    }
  }

  async resetSettings() {
    if (!confirm('Reset all settings to defaults?')) {
      return;
    }

    this.settings = {
      autoDetectGalleries: true,
      downloadImages: true,
      smartFiltering: true,
      keyboardShortcuts: true,
      contextMenu: true,
      maxDownloads: 5,
      downloadFolder: 'StepThree',
      filenameMask: '*name*.*ext*',
      retryAttempts: 3,
      debugLogging: false,
      advancedFiltering: true,
      memoryOptimization: true,
      pageWait: 2000,
      scrollDelay: 1000,
      includeTableData: false,
      // Pagination settings
      autoPagination: true,
      maxPages: 10,
      paginationDelay: 2000
    };

    this.updateUI();
    await this.saveSettings();
    this.logActivity('Settings reset to defaults');
  }

  // ========== UI Updates ==========

  updateUI() {
    // Update all toggle switches
    this.updateToggle('autoDetectToggle', this.settings.autoDetectGalleries);
    this.updateToggle('downloadImagesToggle', this.settings.downloadImages);
    this.updateToggle('smartFilterToggle', this.settings.smartFiltering);
    this.updateToggle('keyboardShortcutsToggle', this.settings.keyboardShortcuts);
    this.updateToggle('contextMenuToggle', this.settings.contextMenu);
    this.updateToggle('advancedFilteringToggle', this.settings.advancedFiltering);
    this.updateToggle('memoryOptToggle', this.settings.memoryOptimization);
    this.updateToggle('includeTableDataToggle', this.settings.includeTableData);
    this.updateToggle('debugToggle', this.settings.debugLogging);
    this.updateToggle('autoPaginationToggle', this.settings.autoPagination);

    // Update input fields
    this.updateInput('downloadFolderInput', this.settings.downloadFolder);
    this.updateInput('filenameMaskInput', this.settings.filenameMask);
    this.updateInput('maxDownloadsSelect', this.settings.maxDownloads);
    this.updateInput('retryAttemptsSelect', this.settings.retryAttempts);
    this.updateInput('pageWaitInput', this.settings.pageWait);
    this.updateInput('scrollDelayInput', this.settings.scrollDelay);
    this.updateInput('maxPagesSelect', this.settings.maxPages);
    this.updateInput('paginationDelayInput', this.settings.paginationDelay);
    this.updateInput('nextSelectorInput', this.settings.nextSelector || '');
  }

  updateToggle(id, checked) {
    const toggle = document.getElementById(id);
    if (toggle) {
      toggle.checked = checked;
    }
  }

  updateInput(id, value) {
    const input = document.getElementById(id);
    if (input) {
      input.value = value;
    }
  }

  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };
    
    this.updateElement('totalItems', this.stats.totalItems);
    this.updateElement('progressPercent', `${this.stats.progressPercent}%`);
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateProgress(percent, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }

    if (progressText) {
      progressText.textContent = text;
    }
  }

  showProgressCard() {
    const card = document.getElementById('progressCard');
    if (card) {
      card.classList.remove('hidden');
    }

    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    if (pauseBtn) pauseBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = false;
  }

  hideProgressCard() {
    const card = document.getElementById('progressCard');
    if (card) {
      card.classList.add('hidden');
    }

    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    if (pauseBtn) pauseBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
  }



  showPermissionSection() {
    const section = document.getElementById('permissionSection');
    if (section) {
      section.classList.remove('hidden');
    }
  }

  hidePermissionSection() {
    const section = document.getElementById('permissionSection');
    if (section) {
      section.classList.add('hidden');
    }
  }

  // ========== Activity Log ==========

  logActivity(message) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    this.activityLog.push({ time, message });

    // Keep only last 100 entries
    if (this.activityLog.length > this.maxLogEntries) {
      this.activityLog.shift();
    }

    this.updateActivityLog();
  }

  updateActivityLog() {
    const logContainer = document.getElementById('activityLog');
    if (!logContainer) return;

    logContainer.innerHTML = '';

    // Show most recent entries first
    const recentLogs = [...this.activityLog].reverse().slice(0, 20);

    recentLogs.forEach(({ time, message }) => {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${message}</span>
      `;
      logContainer.appendChild(entry);
    });
  }

  // ========== Toast Notifications ==========

  showToast(message, type = 'info') {
    const toastId = ++this.toastIdCounter;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.dataset.id = toastId;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;

    const container = document.getElementById('toastContainer');
    if (container) {
      container.appendChild(toast);

      // Auto remove after 3 seconds
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.unifiedSidepanel = new UnifiedSidepanel();
});

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
  if (window.unifiedSidepanel) {
    window.unifiedSidepanel.disconnectPort();
  }
});
