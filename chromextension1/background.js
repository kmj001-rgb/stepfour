/**
 * StepThree Gallery Scraper - Background Service Worker
 * Chrome Extension Manifest V3 Compatible
 * 
 * This service worker handles:
 * - Message routing between UI and content scripts
 * - Content script injection with retry logic
 * - Error handling and logging
 * - Port-based communication
 * - Extension lifecycle management
 * 
 * @version 2.0.0
 * @author StepThree
 */

/**
 * Create safe console methods to prevent 'Illegal invocation' errors
 * This is used by lib/consolidated-systems.js and other modules
 * Production mode suppresses verbose logging (log, info, debug) but keeps errors/warnings
 */
const isProduction = () => {
  try {
    // Detect if running as installed extension (production) vs development
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const url = chrome.runtime.getURL('');
      // Production: chrome-extension://[id]/
      // Development: chrome-extension://[id]/ but with specific patterns or localhost
      return url.startsWith('chrome-extension://') && !url.includes('localhost');
    }
    return true; // Default to production mode if unsure
  } catch (e) {
    return true;
  }
};

const PRODUCTION = isProduction();

// Make PRODUCTION flag globally available for Logger and other modules
globalThis.PRODUCTION = PRODUCTION;

const safeConsole = {
  log: PRODUCTION ? () => {} : console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: PRODUCTION ? () => {} : console.info.bind(console),
  debug: PRODUCTION ? () => {} : console.debug.bind(console)
};

// Make safeConsole available globally to prevent errors in imported scripts
globalThis.safeConsole = safeConsole;

// Log mode on startup
if (!PRODUCTION) {
  console.log('🔧 StepThree running in DEVELOPMENT mode - verbose logging enabled');
} else {
  console.info('✅ StepThree running in PRODUCTION mode - verbose logging suppressed');
}

/**
 * Error Handler - Centralized error management system
 * Handles network errors, permission errors, and general error logging
 */
const errorHandler = {
  /**
   * Display error message to user
   * @param {string} message - Error message to display
   * @param {string} type - Error type (error, warning, info)
   * @param {Object} details - Additional error details
   */
  showError: async function(message, type = 'error', details = {}) {
    console.error(`[StepThree Background] ${type}: ${message}`, details);
    
    try {
      // Try to show error in active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SHOW_ERROR',
          message: message,
          errorType: type,
          details: details,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to show error notification:', error);
    }
  },

  /**
   * Handle network-related errors
   * @param {Error} error - The network error object
   * @param {string} context - Context where error occurred
   */
  handleNetworkError: async function(error, context = 'Unknown') {
    let userMessage = 'Network error occurred. Please check your connection.';
    
    if (error.message.includes('CORS')) {
      userMessage = 'Cannot access images due to security restrictions. Try enabling broader permissions.';
    } else if (error.message.includes('timeout')) {
      userMessage = 'Request timed out. The page might be too large or slow.';
    } else if (error.message.includes('offline')) {
      userMessage = 'You appear to be offline. Please check your connection.';
    }
    
    await this.showError(userMessage, 'network', {
      context: context,
      originalError: error.message,
      url: error.config?.url || 'unknown'
    });
  },

  /**
   * Handle permission-related errors
   * @param {string} permission - The permission that was denied
   * @param {string} context - Context where permission was needed
   */
  handlePermissionError: async function(permission, context = 'Unknown') {
    const messages = {
      'downloads': 'Downloads permission required. Click here to enable downloads.',
      'host_permissions': 'Permission needed to access images. Grant permission for this site?',
      'notifications': 'Notifications permission denied. Error messages will only appear in console.'
    };
    
    const userMessage = messages[permission] || `Permission required: ${permission}`;
    
    await this.showError(userMessage, 'permission', {
      permission: permission,
      context: context,
      action: 'Please grant the required permission in extension settings.'
    });
  },

  /**
   * Log error to storage for debugging
   * Maintains last 50 errors in chrome.storage.local
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  logError: function(message, details = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: message,
      details: details,
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version
    };
    
    console.error('[StepThree Error Log]', errorEntry);
    
    // Store last 50 errors for debugging
    chrome.storage.local.get(['errorLog'], (result) => {
      const errorLog = result.errorLog || [];
      errorLog.unshift(errorEntry);
      if (errorLog.length > 50) errorLog.pop();
      
      chrome.storage.local.set({ errorLog: errorLog });
    });
  },

  /**
   * Validate chrome.downloads API availability
   * @throws {Error} If downloads API is not available
   */
  validateDownloadsAPI: function() {
    if (!chrome.downloads) {
      throw new Error('Downloads API not available. Check extension permissions.');
    }
    if (typeof chrome.downloads.download !== 'function') {
      throw new Error('chrome.downloads.download is not available.');
    }
  }
};

/**
 * BlobURLManager - Manages blob URL lifecycle in service worker context
 * 
 * Tracks blob URLs created for downloads and cleans them up after download completion.
 * Uses chrome.downloads.onChanged to reliably clean up URLs even if service worker restarts.
 */
const blobURLManager = {
  // Map of downloadId -> blob URL for cleanup
  urlMap: new Map(),
  
  /**
   * Register a blob URL for cleanup after download completes
   * @param {number} downloadId - Chrome download ID
   * @param {string} blobUrl - Blob URL to clean up
   */
  register: function(downloadId, blobUrl) {
    if (downloadId && blobUrl) {
      this.urlMap.set(downloadId, blobUrl);
      if (!PRODUCTION) console.log(`📎 Registered blob URL for download ${downloadId}`);
    }
  },
  
  /**
   * Clean up a blob URL
   * @param {number} downloadId - Chrome download ID
   */
  cleanup: function(downloadId) {
    const url = this.urlMap.get(downloadId);
    if (url) {
      try {
        URL.revokeObjectURL(url);
        this.urlMap.delete(downloadId);
        if (!PRODUCTION) console.log(`✅ Cleaned up blob URL for download ${downloadId}`);
      } catch (error) {
        console.error(`Failed to clean up blob URL for download ${downloadId}:`, error);
      }
    }
  },
  
  /**
   * Clean up all tracked blob URLs (e.g., on extension unload)
   */
  cleanupAll: function() {
    if (!PRODUCTION) console.log(`🧹 Cleaning up ${this.urlMap.size} blob URLs`);
    for (const [downloadId, url] of this.urlMap.entries()) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Failed to clean up blob URL for download ${downloadId}:`, error);
      }
    }
    this.urlMap.clear();
  }
};

// Set up download listener for blob URL cleanup
if (chrome.downloads && chrome.downloads.onChanged) {
  chrome.downloads.onChanged.addListener((delta) => {
    // Clean up blob URL when download completes or fails
    if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
      blobURLManager.cleanup(delta.id);
    }
  });
}

// Clean up all blob URLs when service worker is about to be terminated
self.addEventListener('unload', () => {
  blobURLManager.cleanupAll();
});

/**
 * ProxyRouter - Central message routing and communication hub
 * 
 * Manages all communication between service worker, content scripts, and UI components
 * Features:
 * - Message routing with handler registry
 * - Automatic content script injection
 * - Retry logic for failed communications
 * - Port-based connections for persistent communication
 * - URL validation to prevent injection on restricted pages
 */
class ProxyRouter {
  /**
   * Initialize the ProxyRouter
   * Sets up handler registries and port management
   */
  constructor() {
    this.ports = new Map();
    this.subscribers = new Map();
    this.messageHandlers = new Map();
    this.scanHandlers = new Map();
    this.init();
  }

  /**
   * Check if a URL is valid for content script injection
   * @param {string} url - The URL to validate
   * @returns {boolean} True if URL is valid for injection
   */
  isValidUrl(url) {
    if (!url) return false;
    const invalidPrefixes = ['chrome://', 'edge://', 'about:', 'chrome-extension://', 'data:', 'file://'];
    return !invalidPrefixes.some(prefix => url.startsWith(prefix));
  }

  /**
   * Safely send messages to tab with automatic content script injection
   * If content script is not present, automatically injects it and retries
   * @param {number} tabId - The tab ID to send message to
   * @param {Object} message - The message object to send
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @returns {Promise<Object>} Response from content script
   * @throws {Error} If URL is restricted, tab not found, or max retries exceeded
   */
  async sendMessageToTab(tabId, message, maxRetries = 3) {
    // Get tab info first
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch (error) {
      throw new Error(`Tab ${tabId} not found: ${error.message}`);
    }

    // Check if URL is valid for content script
    if (!this.isValidUrl(tab.url)) {
      throw new Error(`Cannot inject content script on ${tab.url} - restricted page`);
    }

    // Try to send message with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, message);
        return response;
      } catch (error) {
        if (!PRODUCTION) console.log(`Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
        
        // If it's the "receiving end does not exist" error, try to inject content script
        if (error.message.includes('Receiving end does not exist')) {
          if (attempt < maxRetries - 1) {
            if (!PRODUCTION) console.log('Attempting to inject content script...');
            try {
              // Inject content script programmatically
              await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['lib/dom-cache.js', 'lib/advanced-collector-system.js', 'lib/enhanced-css-selector.js', 'content.js']
              });
              if (!PRODUCTION) console.log('Content script injected, waiting before retry...');
              // Wait for script to initialize (2000ms)
              // NOTE: setTimeout is acceptable here because:
              // 1. Service worker is actively processing (won't terminate)
              // 2. Delay is short (2s max)
              // 3. chrome.alarms would add unnecessary complexity for active operations
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            } catch (injectionError) {
              console.error('Failed to inject content script:', injectionError);
              if (attempt === maxRetries - 1) {
                throw new Error(`Failed to inject content script: ${injectionError.message}`);
              }
            }
          }
        }
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        // Wait before retry with exponential backoff (300ms, 600ms, 900ms)
        // NOTE: setTimeout is acceptable here because:
        // 1. Service worker is actively processing (won't terminate)
        // 2. Delays are very short (<1s)
        // 3. chrome.alarms would add unnecessary complexity for active retry logic
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  /**
   * Initialize the router by setting up handlers and keepalive
   */
  init() {
    this.setupMessageHandlers();
    this.setupScanHandlers();
    this.startPortKeepalive();
  }

  /**
   * Register all message handlers
   * Maps action types to their handler functions
   */
  setupMessageHandlers() {
    this.messageHandlers.set('ACTIVATE_SELECTOR', this.handleActivateSelector.bind(this));
    this.messageHandlers.set('SMART_DETECT', this.handleSmartDetect.bind(this));
    this.messageHandlers.set('DETECT_TABLES', this.handleDetectTables.bind(this));
    this.messageHandlers.set('enhancedGalleryDetection', this.handleEnhancedGalleryDetection.bind(this));
    this.messageHandlers.set('SCAN_START', this.handleScanStart.bind(this));
    this.messageHandlers.set('SCAN_STOP', this.handleScanStop.bind(this));
    this.messageHandlers.set('EXPORT_DATA', this.handleExportData.bind(this));
    this.messageHandlers.set('DOWNLOAD_IMAGES', this.handleDownloadImages.bind(this));

    // Pagination orchestration (SW-managed delays and state)
    this.messageHandlers.set('PAGINATION_START', this.handlePaginationStart.bind(this));
    this.messageHandlers.set('PAGINATION_STOP', this.handlePaginationStop.bind(this));

    // Pagination orchestration (SW-managed delays and state)
    this.messageHandlers.set('PAGINATION_START', this.handlePaginationStart.bind(this));
    this.messageHandlers.set('PAGINATION_STOP', this.handlePaginationStop.bind(this));

    // No-op handlers to acknowledge lifecycle/health pings from content scripts
    this.messageHandlers.set('CONTENT_READY', (request, _sender, sendResponse) => {
      try {
        sendResponse(this.createSuccessResponse(request.requestId || Date.now(), { acknowledged: true }));
      } catch {}
      return true;
    });
    this.messageHandlers.set('orchestrator_ready', (request, _sender, sendResponse) => {
      try {
        sendResponse(this.createSuccessResponse(request.requestId || Date.now(), { acknowledged: true }));
      } catch {}
      return true;
    });
    this.messageHandlers.set('memory_sample', (request, _sender, sendResponse) => {
      try {
        // Optionally store or log memory telemetry in the future
        sendResponse(this.createSuccessResponse(request.requestId || Date.now(), { received: true }));
      } catch {}
      return true;
    });
    
    // Pagination progress handler
    this.messageHandlers.set('PAGINATION_PROGRESS', (request, _sender, sendResponse) => {
      try {
        if (!PRODUCTION) console.log('📄 Pagination progress update:', request.payload);
        
        // Broadcast pagination progress to all UI subscribers
        this.broadcastToSubscribers('PAGINATION_PROGRESS', request.payload);
        
        sendResponse(this.createSuccessResponse(request.requestId || Date.now(), { received: true }));
      } catch (error) {
        console.error('Error handling pagination progress:', error);
      }
      return true;
    });

    // Element picker selection handler - forward to UI
    this.messageHandlers.set('element_selected', (request, _sender, sendResponse) => {
      try {
        if (!PRODUCTION) console.log('🎯 Element selected:', request);
        
        // Broadcast element selection to all UI subscribers (sidepanel)
        this.broadcastToSubscribers('element_selected', {
          selector: request.selector,
          element: request.element
        });
        
        sendResponse(this.createSuccessResponse(request.requestId || Date.now(), { received: true }));
      } catch (error) {
        console.error('Error handling element selection:', error);
      }
      return true;
    });

    // API pagination replication: SW performs fetch loop directly
    this.messageHandlers.set('API_PAGINATE', this.handleApiPaginate.bind(this));
    this.messageHandlers.set('OFFSCREEN_PREFETCH_PARSE', this.handleOffscreenPrefetchParse.bind(this));
    
    // Pagination debug handlers
    this.messageHandlers.set('PAGINATION_DETECT', this.handlePaginationDetectMessage.bind(this));
    this.messageHandlers.set('PAGINATION_NAVIGATE_NEXT', this.handlePaginationNavigateNextMessage.bind(this));
    this.messageHandlers.set('PAGINATION_RESET', this.handlePaginationResetMessage.bind(this));
    this.messageHandlers.set('PAGINATION_GET_STATE', this.handlePaginationGetStateMessage.bind(this));
    this.messageHandlers.set('PAGINATION_DETECTION_RESULT', this.handlePaginationDetectionResult.bind(this));
  }

  /**
   * Start SW-orchestrated pagination loop with throttling
   */
  handlePaginationStart(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    (async () => {
      try {
        const tabId = request?.payload?.tabId || sender?.tab?.id;
        const options = request?.payload?.options || {};
        if (!tabId) {
          sendResponse(this.createErrorResponse(requestId, 'No tabId for pagination'));
          return;
        }

        const maxPages = Math.max(1, parseInt(options.maxPages || 10, 10));
        const delayMin = Math.max(1000, parseInt(options.delayMin || 2000, 10));
        const delayMax = Math.max(delayMin, parseInt(options.delayMax || 5000, 10));

        let currentPage = 1;
        let stopped = false;
        this._paginationState = { tabId, stopped: false };

        const randomDelay = () => delayMin + Math.floor(Math.random() * (delayMax - delayMin + 1));

        const step = async () => {
          if (!this._paginationState || this._paginationState.stopped) return;
          if (currentPage >= maxPages) return;
          try {
            // Ask content script to perform its next step based on detector
            const contentResponse = await this.sendMessageToTab(tabId, {
              type: 'quickScan',
              action: 'quickScan',
              requestId: `${requestId}_page_${currentPage}`,
              payload: { options: { autoPagination: true, maxPages: currentPage + 1, paginationDelay: 1500 } }
            });
            // Broadcast progress (content also emits fine-grained progress)
            this.broadcastToSubscribers('PAGINATION_PROGRESS', {
              currentPage,
              status: 'scanning',
              imagesCollected: contentResponse?.itemCount || 0
            });
          } catch (err) {
            console.warn('Pagination step failed:', err.message);
          }
          currentPage += 1;
          if (currentPage < maxPages && this._paginationState && !this._paginationState.stopped) {
            setTimeout(step, randomDelay());
          } else {
            this.broadcastToSubscribers('PAGINATION_PROGRESS', { status: 'complete', currentPage });
          }
        };

        // Kick off after initial acknowledgment
        setTimeout(step, randomDelay());
        sendResponse(this.createSuccessResponse(requestId, { started: true, tabId }));
      } catch (error) {
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();
    return true;
  }

  /**
   * Replicate API pagination via fetch in SW context
   * payload: { baseUrl, method, headers, bodyTemplate, paramStrategy }
   */
  handleApiPaginate(request, _sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    (async () => {
      try {
        const { baseUrl, method = 'GET', headers = {}, bodyTemplate = null, paramStrategy = {}, maxPages = 50, delayMin = 1500, delayMax = 4000 } = request.payload || {};
        if (!baseUrl) {
          sendResponse(this.createErrorResponse(requestId, 'baseUrl is required'));
          return;
        }

        const randomDelay = () => delayMin + Math.floor(Math.random() * Math.max(0, delayMax - delayMin + 1));
        const results = [];
        let page = paramStrategy.startPage || 1;
        let offset = paramStrategy.startOffset || 0;
        const step = paramStrategy.step || paramStrategy.limit || 20;

        for (let i = 0; i < maxPages; i++) {
          // Build URL for this iteration
          let url = new URL(baseUrl);
          const sp = url.searchParams;
          if (paramStrategy.mode === 'page') {
            sp.set(paramStrategy.pageKey || 'page', String(page));
            if (paramStrategy.perPageKey && paramStrategy.perPage) {
              sp.set(paramStrategy.perPageKey, String(paramStrategy.perPage));
            }
          } else if (paramStrategy.mode === 'offset') {
            sp.set(paramStrategy.offsetKey || 'offset', String(offset));
            sp.set(paramStrategy.limitKey || 'limit', String(step));
          }
          const iterUrl = url.toString();

          // Prepare request init
          const init = { method, headers: { ...(headers || {}) } };
          if (method.toUpperCase() !== 'GET' && bodyTemplate) {
            const body = JSON.stringify({ ...bodyTemplate, page, offset });
            init.body = body;
            if (!init.headers['content-type']) {
              init.headers['content-type'] = 'application/json';
            }
          }

          const resp = await fetch(iterUrl, init);
          if (!resp.ok) {
            // Stop on 404/204 or other non-ok
            break;
          }
          const contentType = resp.headers.get('content-type') || '';
          let data = null;
          if (contentType.includes('application/json')) {
            data = await resp.json();
          } else {
            data = await resp.text();
          }

          results.push({ page, offset, data });

          // Termination heuristics
          const empty = Array.isArray(data) ? data.length === 0 : (data && typeof data === 'object' && Array.isArray(data.items) && data.items.length === 0);
          if (empty) break;

          // Increment
          if (paramStrategy.mode === 'page') {
            page += 1;
          } else if (paramStrategy.mode === 'offset') {
            offset += step;
          }

          // Throttle
          await new Promise(r => setTimeout(r, randomDelay()));
        }

        sendResponse(this.createSuccessResponse(requestId, { pages: results.length, results }));
      } catch (error) {
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();
    return true;
  }

  /**
   * Stop SW-orchestrated pagination
   */
  handlePaginationStop(request, _sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    try {
      if (this._paginationState) {
        this._paginationState.stopped = true;
      }
      sendResponse(this.createSuccessResponse(requestId, { stopped: true }));
    } catch (error) {
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
    return true;
  }

  /**
   * Register all scan-related handlers
   * Duplicates some message handlers for compatibility
   */
  setupScanHandlers() {
    this.scanHandlers.set('enhancedGalleryDetection', this.handleEnhancedGalleryDetection.bind(this));
    this.scanHandlers.set('ACTIVATE_SELECTOR', this.handleActivateSelector.bind(this));
    this.scanHandlers.set('SMART_DETECT', this.handleSmartDetect.bind(this));
    this.scanHandlers.set('DETECT_TABLES', this.handleDetectTables.bind(this));
    this.scanHandlers.set('SCAN_START', this.handleScanStart.bind(this));
    this.scanHandlers.set('SCAN_STOP', this.handleScanStop.bind(this));
    this.scanHandlers.set('EXPORT_DATA', this.handleExportData.bind(this));
    this.scanHandlers.set('DOWNLOAD_IMAGES', this.handleDownloadImages.bind(this));
  }

  handleActivateSelector(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();

    (async () => {
      try {
        // Prefer explicit tabId from caller, then sender.tab, then active tab
        const requestedTabId = request?.payload?.tabId || sender?.tab?.id || null;
        let tab = null;
        if (requestedTabId) {
          try {
            tab = await chrome.tabs.get(requestedTabId);
          } catch (e) {
            console.warn('Invalid tabId provided, falling back to active tab:', e.message);
          }
        }
        if (!tab) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            sendResponse(this.createErrorResponse(requestId, 'No active tab found'));
            return;
          }
          tab = tabs[0];
        }

        try {
          if (!PRODUCTION) console.log('🚀 Sending toggleSelector message to tab:', tab.id);
          const contentResponse = await this.sendMessageToTab(tab.id, {
            type: 'toggleSelector',
            action: 'toggleSelector',
            requestId: requestId,
            payload: request.payload || {}
          });

          // If content indicates element picker is unavailable, try to inject dependencies and retry once
          let finalResponse = contentResponse;
          if (!contentResponse?.success && /picker|not available/i.test(String(contentResponse?.error))) {
            if (!PRODUCTION) console.log('Attempting to inject Enhanced Smart Selector dependencies and retry...');
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['lib/enhanced-css-selector.js', 'content.js']
              });
              finalResponse = await this.sendMessageToTab(tab.id, {
                type: 'toggleSelector',
                action: 'toggleSelector',
                requestId: requestId,
                payload: request.payload || {}
              });
            } catch (injectErr) {
              console.warn('Injection retry failed:', injectErr.message);
            }
          }

          if (!PRODUCTION) console.log('✅ Received response from content script:', finalResponse);

          sendResponse(this.createSuccessResponse(requestId, {
            tabId: tab.id,
            status: finalResponse?.success ? 'started' : 'unavailable',
            results: finalResponse
          }));

          if (finalResponse?.success) {
            this.broadcastToSubscribers('selectorActivated', {
              tabId: tab.id,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error('❌ Failed to activate selector:', error);
          sendResponse(this.createErrorResponse(requestId, error.message));
        }
      } catch (error) {
        console.error('❌ Error in handleActivateSelector:', error);
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();

    return true;
  }

  handleSmartDetect(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();

    (async () => {
      try {
        const requestedTabId = request?.payload?.tabId || sender?.tab?.id || null;
        let tab = null;
        if (requestedTabId) {
          try { tab = await chrome.tabs.get(requestedTabId); } catch (e) { console.warn('Invalid tabId, fallback to active tab:', e.message); }
        }
        if (!tab) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            sendResponse(this.createErrorResponse(requestId, 'No active tab found'));
            return;
          }
          tab = tabs[0];
        }

        try {
          if (!PRODUCTION) console.log('🚀 Sending enhancedGalleryDetection message to tab:', tab.id);
          const contentResponse = await this.sendMessageToTab(tab.id, {
            type: 'enhancedGalleryDetection',
            action: 'enhancedGalleryDetection',
            requestId: requestId,
            payload: request.payload || {}
          });

          if (!PRODUCTION) console.log('✅ Received response from content script:', contentResponse);

          // Normalize counts for UI compatibility
          const itemCount = (contentResponse?.validCount ?? contentResponse?.totalFound ?? contentResponse?.items?.length ?? 0);

          sendResponse(this.createSuccessResponse(requestId, {
            tabId: tab.id,
            status: 'smart_detect_started',
            results: contentResponse,
            itemCount
          }));

          this.broadcastToSubscribers('smartDetectStarted', {
            tabId: tab.id,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('❌ Failed to run smart detection:', error);
          sendResponse(this.createErrorResponse(requestId, error.message));
        }
      } catch (error) {
        console.error('❌ Error in handleSmartDetect:', error);
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();

    return true;
  }

  handleDetectTables(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();

    (async () => {
      try {
        const requestedTabId = request?.payload?.tabId || sender?.tab?.id || null;
        let tab = null;
        if (requestedTabId) {
          try { tab = await chrome.tabs.get(requestedTabId); } catch (e) { console.warn('Invalid tabId, fallback to active tab:', e.message); }
        }
        if (!tab) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            sendResponse(this.createErrorResponse(requestId, 'No active tab found'));
            return;
          }
          tab = tabs[0];
        }

        try {
          if (!PRODUCTION) console.log('🚀 Sending detectTables message to tab:', tab.id);
          const contentResponse = await this.sendMessageToTab(tab.id, {
            type: 'detectTables',
            action: 'detectTables',
            requestId: requestId,
            payload: request.payload || {}
          });

          if (!PRODUCTION) console.log('✅ Received response from content script:', contentResponse);

          // Normalize table count for UI compatibility
          const tableCount = (contentResponse?.totalTables ?? contentResponse?.tables?.length ?? 0);

          sendResponse(this.createSuccessResponse(requestId, {
            tabId: tab.id,
            status: 'table_detection_started',
            results: contentResponse,
            tableCount
          }));

          this.broadcastToSubscribers('tableDetectionStarted', {
            tabId: tab.id,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('❌ Failed to detect tables:', error);
          sendResponse(this.createErrorResponse(requestId, error.message));
        }
      } catch (error) {
        console.error('❌ Error in handleDetectTables:', error);
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();

    return true;
  }

  handleEnhancedGalleryDetection(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    
    (async () => {
      try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (!tabs || tabs.length === 0) {
          sendResponse(this.createErrorResponse(requestId, 'No active tab found'));
          return;
        }
        
        const tab = tabs[0];
        
        try {
          if (!PRODUCTION) console.log('🚀 Sending enhancedGalleryDetection message to tab:', tab.id);
          const contentResponse = await this.sendMessageToTab(tab.id, {
            type: 'enhancedGalleryDetection',
            action: 'enhancedGalleryDetection',
            requestId: requestId,
            payload: request.payload || {}
          });
          
          if (!PRODUCTION) console.log('✅ Received response from content script:', contentResponse);
          
          sendResponse(this.createSuccessResponse(requestId, { 
            tabId: tab.id, 
            status: 'gallery_detection_started',
            results: contentResponse
          }));
          
          this.broadcastToSubscribers('enhancedGalleryDetectionStarted', {
            tabId: tab.id,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('❌ Failed to run enhanced gallery detection:', error);
          sendResponse(this.createErrorResponse(requestId, error.message));
        }
      } catch (error) {
        console.error('❌ Error in handleEnhancedGalleryDetection:', error);
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();
    
    return true;
  }

  handleScanStart(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    if (!PRODUCTION) console.log('📨 handleScanStart called with request:', { requestId, payload: request.payload, source: request.source });

    (async () => {
      try {
        const requestedTabId = request?.payload?.tabId || sender?.tab?.id || null;
        let tab = null;
        if (requestedTabId) {
          try { 
            tab = await chrome.tabs.get(requestedTabId);
            if (!PRODUCTION) console.log('✅ Got tab by ID:', tab.id, 'URL:', tab.url);
          } catch (e) { 
            console.warn('Invalid tabId, fallback to active tab:', e.message); 
          }
        }
        if (!tab) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            console.error('❌ No active tab found');
            sendResponse(this.createErrorResponse(requestId, 'No active tab found'));
            return;
          }
          tab = tabs[0];
          if (!PRODUCTION) console.log('✅ Using active tab:', tab.id, 'URL:', tab.url);
        }

        // Validate URL before attempting scan
        if (!this.isValidUrl(tab.url)) {
          const errorMsg = `Cannot scan restricted page: ${tab.url}. Extensions cannot access chrome://, edge://, about:, or other internal pages.`;
          console.error('❌', errorMsg);
          sendResponse(this.createErrorResponse(requestId, errorMsg));
          this.broadcastToSubscribers('SCAN_ERROR', {
            error: errorMsg,
            tabId: tab.id,
            timestamp: Date.now()
          });
          return;
        }

        try {
          if (!PRODUCTION) console.log('🚀 Sending quickScan message to tab:', tab.id, 'URL:', tab.url);
          const contentResponse = await this.sendMessageToTab(tab.id, {
            type: 'quickScan',
            action: 'quickScan',
            requestId: requestId,
            payload: request.payload || {}
          });

          if (!PRODUCTION) console.log('✅ Received response from content script:', contentResponse);

          sendResponse(this.createSuccessResponse(requestId, {
            ok: true,
            tabId: tab.id,
            status: 'scan_started',
            results: contentResponse
          }));

          this.broadcastToSubscribers('SCAN_STARTED', {
            tabId: tab.id,
            timestamp: Date.now()
          });

          // Also notify completion with initial results for UI consumers
          this.broadcastToSubscribers('SCAN_COMPLETE', {
            results: contentResponse,
            tabId: tab.id,
            timestamp: Date.now()
          });

          // If downloadImages option is enabled, automatically start downloading
          if (request.payload?.options?.downloadImages && contentResponse?.items?.length > 0) {
            if (!PRODUCTION) console.log('🚀 Auto-triggering image downloads...');
            // Use Promise.resolve().then() instead of setTimeout for MV3 compliance
            // This ensures the download starts immediately after current task completes
            Promise.resolve().then(() => {
              this.handleDownloadImages({
                requestId: `download_${requestId}`,
                payload: {
                  items: contentResponse.items,
                  options: request.payload.options
                }
              }, sender, () => {});
            });
          }
        } catch (error) {
          console.error('❌ Failed to send message to content script:', error);
          const errorMsg = `Scan initiation failed: ${error.message}`;
          sendResponse(this.createErrorResponse(requestId, errorMsg));
          // Inform UI about scan error
          this.broadcastToSubscribers('SCAN_ERROR', {
            error: errorMsg,
            tabId: tab?.id || sender?.tab?.id,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('❌ Error in handleScanStart:', error);
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();

    return true;
  }

  handleScanStop(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    try {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (chrome.runtime.lastError) {
          errorHandler.showError(chrome.runtime.lastError.message, 'permission');
          sendResponse(this.createErrorResponse(requestId, chrome.runtime.lastError.message));
          return;
        }
        
        if (!tabs || tabs.length === 0) {
          sendResponse(this.createErrorResponse(requestId, 'No active tab found'));
          return;
        }
        
        const tab = tabs[0];
        sendResponse(this.createSuccessResponse(requestId, { 
          ok: true,
          tabId: tab.id, 
          status: 'scan_stopped' 
        }));
        
        this.broadcastToSubscribers('SCAN_STOPPED', {
          tabId: tab.id,
          timestamp: Date.now()
        });
      });
      return true;
    } catch (error) {
      errorHandler.logError('Error in handleScanStop', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
      return false;
    }
  }

  handleExportData(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    
    (async () => {
      try {
        const payload = request.payload || {};
        const data = payload.data || {};
        const formats = payload.formats || [];
        const options = payload.options || {};
        
        if (!PRODUCTION) console.log('📤 Starting export:', { formats, itemCount: data.items?.length || 0 });
        
        // Broadcast export started
        this.broadcastToSubscribers('EXPORT_STARTED', {
          formats: formats,
          timestamp: Date.now()
        });
        
        // Process each format
        const exportResults = [];
        for (const format of formats) {
          try {
            const result = await this.exportToFormat(data, format, options);
            exportResults.push({ format, success: true, ...result });
            if (!PRODUCTION) console.log(`✅ Export complete: ${format}`);
          } catch (error) {
            console.error(`❌ Export failed for ${format}:`, error);
            exportResults.push({ format, success: false, error: error.message });
          }
        }
        
        // Broadcast completion
        this.broadcastToSubscribers('EXPORT_COMPLETE', {
          results: exportResults,
          timestamp: Date.now()
        });
        
        sendResponse(this.createSuccessResponse(requestId, { 
          ok: true,
          status: 'export_complete',
          results: exportResults,
          exportCount: exportResults.filter(r => r.success).length
        }));
        
      } catch (error) {
        console.error('❌ Error in handleExportData:', error);
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();
    
    return true;
  }

  /**
   * Export data to specified format
   * Creates offscreen document for heavy operations if needed
   */
  async exportToFormat(data, format, options = {}) {
    const items = data.items || [];
    
    if (items.length === 0) {
      throw new Error('No items to export');
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const siteName = items[0]?.pageUrl ? new URL(items[0].pageUrl).hostname.replace(/[^a-z0-9]/gi, '-') : 'export';
    const baseFilename = `${siteName}-gallery-${timestamp}`;
    
    switch (format.toLowerCase()) {
      case 'csv':
        return await this.exportToCSV(items, baseFilename, options);
      
      case 'xlsx':
      case 'excel':
        return await this.exportToExcel(items, baseFilename, options);
      
      case 'json':
        return await this.exportToJSON(items, baseFilename, options);
      
      case 'html':
        return await this.exportToHTML(items, baseFilename, options);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(items, baseFilename, options) {
    // Validate downloads API availability
    errorHandler.validateDownloadsAPI();
    
    const selectedFields = options.selectedFields || Object.keys(items[0] || {});
    
    // Build CSV content
    const headers = selectedFields.join(',');
    const rows = items.map(item => {
      return selectedFields.map(field => {
        const value = item[field] || '';
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    try {
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: `${baseFilename}.csv`,
        saveAs: false
      });
      
      // Register blob URL for cleanup when download completes
      blobURLManager.register(downloadId, url);
    } catch (error) {
      // Clean up on error
      URL.revokeObjectURL(url);
      console.error('CSV download failed:', error);
      throw new Error(`Failed to download CSV file: ${error.message}`);
    }
    
    return { 
      filename: `${baseFilename}.csv`,
      size: csvContent.length,
      itemCount: items.length
    };
  }

  /**
   * Export to Excel format using offscreen document
   */
  async exportToExcel(items, baseFilename, options) {
    // Validate downloads API availability
    errorHandler.validateDownloadsAPI();
    
    try {
      // Create offscreen document for XLSX processing
      await this.ensureOffscreenDocument();
      
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Send export request to offscreen document
      const response = await chrome.runtime.sendMessage({
        action: 'OFFSCREEN_EXPORT_START',
        exportId: exportId,
        data: { items },
        format: 'xlsx',
        filename: baseFilename,
        options: options
      });
      
      if (response && response.ok && response.result) {
        // Download the generated file
        const blob = new Blob([response.result.data], { 
          type: response.result.mimeType 
        });
        const url = URL.createObjectURL(blob);
        
        try {
          const downloadId = await chrome.downloads.download({
            url: url,
            filename: response.result.filename,
            saveAs: false
          });
          
          // Register blob URL for cleanup when download completes
          blobURLManager.register(downloadId, url);
        } catch (error) {
          // Clean up on error
          URL.revokeObjectURL(url);
          console.error('Excel download failed:', error);
          throw new Error(`Failed to download Excel file: ${error.message}`);
        }
        
        return {
          filename: response.result.filename,
          size: response.result.size,
          itemCount: items.length
        };
      } else {
        throw new Error(response?.error || 'Export failed');
      }
    } catch (error) {
      console.error('Excel export failed, falling back to CSV:', error);
      // Fallback to CSV if Excel fails
      return await this.exportToCSV(items, baseFilename, options);
    }
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(items, baseFilename, options) {
    // Validate downloads API availability
    errorHandler.validateDownloadsAPI();
    
    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      itemCount: items.length,
      items: items
    }, null, 2);
    
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    try {
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: `${baseFilename}.json`,
        saveAs: false
      });
      
      // Register blob URL for cleanup when download completes
      blobURLManager.register(downloadId, url);
    } catch (error) {
      // Clean up on error
      URL.revokeObjectURL(url);
      console.error('JSON download failed:', error);
      throw new Error(`Failed to download JSON file: ${error.message}`);
    }
    
    return {
      filename: `${baseFilename}.json`,
      size: jsonContent.length,
      itemCount: items.length
    };
  }

  /**
   * Export to HTML format
   */
  async exportToHTML(items, baseFilename, options) {
    // Validate downloads API availability
    errorHandler.validateDownloadsAPI();
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gallery Export - ${baseFilename}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #fff; padding: 20px; margin-bottom: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    h1 { margin: 0; color: #333; }
    .stats { color: #666; margin-top: 10px; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
    .item { background: #fff; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .item img { width: 100%; height: 200px; object-fit: cover; border-radius: 3px; }
    .item-info { margin-top: 10px; font-size: 12px; color: #666; }
    .item-info a { color: #0066cc; text-decoration: none; word-break: break-all; }
    .item-info a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Gallery Export</h1>
    <div class="stats">
      <strong>${items.length}</strong> images exported on ${new Date().toLocaleString()}
    </div>
  </div>
  <div class="gallery">
    ${items.map((item, index) => `
      <div class="item">
        <img src="${item.url || item.imageUrl || ''}" alt="${item.altText || item.filename || 'Image ' + (index + 1)}" loading="lazy" />
        <div class="item-info">
          <div><strong>${item.filename || 'Image ' + (index + 1)}</strong></div>
          ${item.width && item.height ? `<div>Size: ${item.width} × ${item.height}</div>` : ''}
          ${item.url ? `<div><a href="${item.url}" target="_blank">View Original</a></div>` : ''}
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    try {
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: `${baseFilename}.html`,
        saveAs: false
      });
      
      // Register blob URL for cleanup when download completes
      blobURLManager.register(downloadId, url);
    } catch (error) {
      // Clean up on error
      URL.revokeObjectURL(url);
      console.error('HTML download failed:', error);
      throw new Error(`Failed to download HTML file: ${error.message}`);
    }
    
    return {
      filename: `${baseFilename}.html`,
      size: htmlContent.length,
      itemCount: items.length
    };
  }

  /**
   * Ensure offscreen document exists for heavy operations
   */
  async ensureOffscreenDocument() {
    // Check if document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      if (!PRODUCTION) console.log('✅ Offscreen document already exists');
      return;
    }
    
    // Create new offscreen document
    if (!PRODUCTION) console.log('📄 Creating offscreen document...');
    await chrome.offscreen.createDocument({
      url: 'offscreen/export-worker.html',
      reasons: ['BLOBS'],
      justification: 'Process heavy export operations (XLSX, CSV) in isolated context'
    });
    
    if (!PRODUCTION) console.log('✅ Offscreen document created');
  }

  /**
   * Prefetch and parse HTML in offscreen context for non-active URLs
   * payload: { urls: string[] }
   */
  handleOffscreenPrefetchParse(request, _sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    (async () => {
      try {
        const urls = request?.payload?.urls || [];
        if (!Array.isArray(urls) || urls.length === 0) {
          sendResponse(this.createErrorResponse(requestId, 'No URLs provided'));
          return;
        }

        // Ensure offscreen doc exists
        await this.ensureOffscreenDocument();

        // Ask offscreen to parse content securely
        const results = [];
        for (const u of urls) {
          try {
            const res = await fetch(u, { method: 'GET' });
            const text = await res.text();
            // Send to sandbox offscreen for parsing if needed
            // For now, include raw HTML; advanced: forward to SANDBOX_DATA_PARSE
            results.push({ url: u, ok: res.ok, status: res.status, htmlLength: text.length });
            // Throttle gently between requests
            await new Promise(r => setTimeout(r, 300));
          } catch (e) {
            results.push({ url: u, ok: false, error: e.message });
          }
        }

        sendResponse(this.createSuccessResponse(requestId, { results }));
      } catch (error) {
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();
    return true;
  }

  /**
   * Handle image downloads
   */
  handleDownloadImages(request, sender, sendResponse) {
    const requestId = request.requestId || Date.now();
    
    (async () => {
      try {
        // Validate downloads API availability
        errorHandler.validateDownloadsAPI();
        
        const payload = request.payload || {};
        const items = payload.items || [];
        const options = payload.options || {};
        const maxConcurrent = options.concurrency || 5;
        const downloadFolder = options.downloadFolder || 'StepThree';
        
        if (!PRODUCTION) console.log('📥 Starting image downloads:', { count: items.length, maxConcurrent });
        
        if (items.length === 0) {
          sendResponse(this.createErrorResponse(requestId, 'No items to download'));
          return;
        }
        
        // Broadcast download started
        this.broadcastToSubscribers('DOWNLOAD_STARTED', {
          totalItems: items.length,
          timestamp: Date.now()
        });
        
        // Download images with concurrency control
        const results = {
          successful: 0,
          failed: 0,
          total: items.length,
          errors: []
        };
        
        // Process downloads in batches
        for (let i = 0; i < items.length; i += maxConcurrent) {
          const batch = items.slice(i, i + maxConcurrent);
          const batchPromises = batch.map(async (item, batchIndex) => {
            try {
              const itemIndex = i + batchIndex;
              const url = item.url || item.imageUrl || item.src;
              
              if (!url || !url.startsWith('http')) {
                throw new Error('Invalid URL');
              }
              
              // Generate filename
              let filename = item.filename || item.name || `image-${itemIndex + 1}`;
              
              // Extract extension from URL if not present
              if (!filename.includes('.')) {
                const urlPath = new URL(url).pathname;
                const ext = urlPath.substring(urlPath.lastIndexOf('.'));
                if (ext && ext.length < 6) {
                  filename += ext;
                } else {
                  filename += '.jpg'; // default extension
                }
              }
              
              // Download the image
              const downloadId = await chrome.downloads.download({
                url: url,
                filename: `${downloadFolder}/${filename}`,
                saveAs: false
              });
              
              results.successful++;
              
              // Broadcast progress
              this.broadcastToSubscribers('DOWNLOAD_PROGRESS', {
                completed: results.successful + results.failed,
                total: results.total,
                percentage: Math.round(((results.successful + results.failed) / results.total) * 100),
                timestamp: Date.now()
              });
              
              return { success: true, downloadId, filename };
              
            } catch (error) {
              results.failed++;
              results.errors.push({
                item: item,
                error: error.message
              });
              
              // Broadcast progress even on failure
              this.broadcastToSubscribers('DOWNLOAD_PROGRESS', {
                completed: results.successful + results.failed,
                total: results.total,
                percentage: Math.round(((results.successful + results.failed) / results.total) * 100),
                timestamp: Date.now()
              });
              
              return { success: false, error: error.message };
            }
          });
          
          // Wait for batch to complete
          await Promise.all(batchPromises);
        }
        
        // Broadcast completion
        this.broadcastToSubscribers('DOWNLOAD_COMPLETE', {
          results: results,
          timestamp: Date.now()
        });
        
        if (!PRODUCTION) console.log('✅ Downloads complete:', results);
        
        sendResponse(this.createSuccessResponse(requestId, {
          ok: true,
          status: 'download_complete',
          results: results
        }));
        
      } catch (error) {
        console.error('❌ Error in handleDownloadImages:', error);
        sendResponse(this.createErrorResponse(requestId, error.message));
      }
    })();
    
    return true;
  }

  broadcastToSubscribers(eventType, data) {
    try {
      const message = {
        action: eventType, // include action for UI consumers
        type: eventType,
        data: data,
        timestamp: Date.now()
      };
      
      this.ports.forEach((port, portId) => {
        try {
          if (port && !port.disconnected) {
            port.postMessage(message);
          }
        } catch (error) {
          console.warn(`Failed to send to port ${portId}:`, error);
          this.ports.delete(portId);
        }
      });
    } catch (error) {
      errorHandler.logError('Error in broadcastToSubscribers', error);
    }
  }

  createSuccessResponse(requestId, data) {
    return {
      success: true,
      ok: true,
      requestId: requestId,
      data: data,
      timestamp: Date.now()
    };
  }

  createErrorResponse(requestId, error) {
    return {
      success: false,
      ok: false,
      requestId: requestId,
      error: error,
      timestamp: Date.now()
    };
  }

  /**
   * Register a message handler for a specific action
   * @param {string} action - The action type to handle
   * @param {Function} handler - The handler function to call
   */
  registerMessageHandler(action, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.messageHandlers.set(action, handler);
    if (!PRODUCTION) console.log(`Registered handler for action: ${action}`);
  }

  /**
   * Start port keepalive using chrome.alarms for MV3 compliance
   * Service workers can go to sleep, so we use alarms instead of setInterval
   * Note: The alarm listener is registered at the top level for MV3 compliance
   */
  startPortKeepalive() {
    // Create alarm for keepalive pings
    chrome.alarms.create('port-keepalive', {
      periodInMinutes: 0.5 // 30 seconds
    });
    
    // Note: Listener registration moved to top level (after ProxyRouter instantiation)
    // to comply with MV3 requirements
  }

  /**
   * Send keepalive messages to all connected ports
   */
  sendKeepaliveToAllPorts() {
    this.ports.forEach((port, portId) => {
      try {
        if (port && !port.disconnected) {
          port.postMessage({ type: 'keepalive', timestamp: Date.now() });
        }
      } catch (error) {
        console.warn(`Port ${portId} disconnected, removing`);
        this.ports.delete(portId);
      }
    });
  }

  safeQuerySelectorAll(selector, context = document) {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return [];
    }
  }

  sendToPort(portId, message) {
    const port = this.ports.get(portId);
    if (port && !port.disconnected) {
      try {
        port.postMessage(message);
        return true;
      } catch (error) {
        console.warn(`Failed to send to port ${portId}:`, error);
        this.ports.delete(portId);
        return false;
      }
    }
    return false;
  }

  /**
   * Helper method to resolve tab ID from request, sender, or active tab
   * @param {Object} request - The message request
   * @param {Object} sender - The message sender
   * @returns {Promise<number|null>} The resolved tab ID or null
   */
  async resolveTabId(request, sender) {
    // Try explicit tab ID in request
    let tabId = request?.tabId || sender?.tab?.id;
    
    // Fall back to active tab
    if (!tabId) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
      } catch (error) {
        console.error('Failed to get active tab:', error);
        return null;
      }
    }
    
    return tabId;
  }

  /**
   * Pagination Debug Handlers
   * These handle messages from the pagination debug UI
   */
  async handlePaginationDetectMessage(request, sender, sendResponse) {
    const tabId = await this.resolveTabId(request, sender);
    handlePaginationDetect(tabId, (response) => {
      sendResponse(response);
    });
    return true; // Keep channel open for async response
  }

  async handlePaginationNavigateNextMessage(request, sender, sendResponse) {
    const tabId = await this.resolveTabId(request, sender);
    handlePaginationNavigateNext(tabId, (response) => {
      sendResponse(response);
    });
    return true; // Keep channel open for async response
  }

  async handlePaginationResetMessage(request, sender, sendResponse) {
    const tabId = await this.resolveTabId(request, sender);
    handlePaginationReset(tabId, (response) => {
      sendResponse(response);
    });
    return true; // Keep channel open for async response
  }

  async handlePaginationGetStateMessage(request, sender, sendResponse) {
    const tabId = await this.resolveTabId(request, sender);
    handlePaginationGetState(tabId, (response) => {
      sendResponse(response);
    });
    return true; // Keep channel open for async response
  }

  handlePaginationDetectionResult(request, sender, sendResponse) {
    try {
      paginationState.detection = request.detection;
      paginationState.activeTab = sender.tab?.id;
      
      // Broadcast to UI
      broadcastPaginationUpdate({
        action: 'PAGINATION_STATE_UPDATE',
        state: {
          detection: request.detection,
          isPaginating: paginationState.isPaginating
        }
      });
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error handling pagination detection result:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
}

// Initialize the proxy router
const proxyRouter = new ProxyRouter();

// MV3 COMPLIANCE: Register alarm listener at top level
// Handles port-keepalive alarm for maintaining long-lived connections
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'port-keepalive') {
    proxyRouter.sendKeepaliveToAllPorts();
  }
});

// Register handler for trusted clicks via Main World injection
// This solves Layer 3: Execution Isolation for modern SPAs
proxyRouter.registerMessageHandler('EXECUTE_TRUSTED_CLICK', async (message, sender, sendResponse) => {
  try {
    const { selector, tabId } = message;
    
    if (!selector) {
      throw new Error('Selector is required for trusted click');
    }
    
    const targetTabId = tabId || sender.tab?.id;
    if (!targetTabId) {
      throw new Error('No tab ID available for trusted click');
    }
    
    if (!PRODUCTION) console.log(`🎯 Executing trusted click in Main World for selector: ${selector}`);
    
    // Execute click in Main World (trusted context)
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      world: 'MAIN', // Critical: Execute in page's context for trusted events
      args: [selector],
      func: (sel) => {
        // This function runs in the page's Main World
        try {
          let element = null;
          
          // Check if selector is XPath format (xpath://...)
          if (sel.startsWith('xpath:')) {
            const xpathExpression = sel.substring(6); // Remove 'xpath:' prefix
            const result = document.evaluate(
              xpathExpression, 
              document, 
              null, 
              XPathResult.FIRST_ORDERED_NODE_TYPE, 
              null
            );
            element = result.singleNodeValue;
          }
          // Check if selector contains Shadow DOM notation (::shadow::)
          else if (sel.includes('::shadow::')) {
            const parts = sel.split('::shadow::');
            const hostSelector = parts[0];
            const innerSelector = parts[1];
            
            const host = document.querySelector(hostSelector);
            if (!host || !host.shadowRoot) {
              return { success: false, error: 'Shadow host not found or no shadow root' };
            }
            
            element = host.shadowRoot.querySelector(innerSelector);
          } else {
            // Regular CSS selector
            element = document.querySelector(sel);
          }
          
          if (!element) {
            return { success: false, error: 'Element not found with selector: ' + sel };
          }
          
          // Check if element is visible and clickable
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || 
              (rect.width === 0 && rect.height === 0)) {
            return { success: false, error: 'Element is not visible' };
          }
          
          // Check if element is disabled (termination detection)
          if (element.disabled || 
              element.getAttribute('disabled') === 'true' ||
              element.getAttribute('aria-disabled') === 'true' ||
              element.classList.contains('disabled')) {
            return { success: false, error: 'Element is disabled (pagination end)', terminationDetected: true };
          }
          
          // Perform trusted click (will be treated as user interaction)
          element.click();
          
          return { 
            success: true, 
            message: 'Trusted click executed successfully',
            elementTag: element.tagName,
            elementText: element.textContent?.substring(0, 50)
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });
    
    const result = results[0]?.result;
    if (!result) {
      throw new Error('No result from Main World execution');
    }
    
    if (!PRODUCTION) console.log('✅ Trusted click result:', result);
    sendResponse(result);
    
  } catch (error) {
    console.error('❌ Trusted click error:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Chrome extension message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // Debug logging
    if (!PRODUCTION) console.log('📨 Received message:', { type: request.type, action: request.action, request });

    // Support both 'type' and 'action' fields for compatibility
    const messageType = request.type || request.action;
    
    const handler = proxyRouter.messageHandlers.get(messageType);
    if (handler) {
      if (!PRODUCTION) console.log(`✅ Handler found for: ${messageType}`);
      return handler(request, sender, sendResponse);
    } else {
      console.warn(`❌ No handler found for message type: ${messageType}`);
      sendResponse(proxyRouter.createErrorResponse(request.requestId || Date.now(), `Unknown message type: ${messageType}`));
      return false;
    }
  } catch (error) {
    errorHandler.logError('Error in onMessage handler', error);
    sendResponse(proxyRouter.createErrorResponse(request.requestId || Date.now(), error.message));
    return false;
  }
});

// Chrome extension port connection handlers
chrome.runtime.onConnect.addListener((port) => {
  try {
    const portId = `${port.name}_${Date.now()}`;
    proxyRouter.ports.set(portId, port);
    
    port.onDisconnect.addListener(() => {
      proxyRouter.ports.delete(portId);
    });
    
    port.onMessage.addListener((message) => {
      try {
        // Support both 'type' and 'action' fields for compatibility
        const messageType = message.type || message.action;
        
        // Try general handlers first (e.g., UI_SUBSCRIBE), then scan-specific
        const handler = proxyRouter.messageHandlers.get(messageType) || proxyRouter.scanHandlers.get(messageType);
        if (handler) {
          handler(message, null, (response) => {
            port.postMessage(response);
          });
        }
      } catch (error) {
        errorHandler.logError('Error in port onMessage handler', error);
      }
    });
    
  } catch (error) {
    errorHandler.logError('Error in onConnect handler', error);
  }
});

// Handle extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  if (!PRODUCTION) console.log('Extension installed/updated:', details);
  
  try {
    proxyRouter.broadcastToSubscribers('extensionInstalled', {
      reason: details.reason,
      previousVersion: details.previousVersion,
      timestamp: Date.now()
    });
    
  } catch (error) {
    errorHandler.logError('Error in onInstalled handler', error);
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Open the side panel for the current tab
    await chrome.sidePanel.open({ tabId: tab.id });
    if (!PRODUCTION) console.log('✅ Side panel opened for tab:', tab.id);
  } catch (error) {
    console.error('❌ Failed to open side panel:', error);
    errorHandler.logError('Failed to open side panel', { error: error.message, tabId: tab.id });
  }
});

// Export for testing if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProxyRouter };
}

if (!PRODUCTION) {
  console.log('✅ StepThree background service worker loaded successfully');
} else {
  console.info('✅ StepThree background service worker ready');
}
/**
 * ========================================
 * PAGINATION COORDINATOR
 * ========================================
 * Manages communication between UI and content scripts for pagination
 */

// Pagination state management
const paginationState = {
    activeTab: null,
    isPaginating: false,
    detection: null
};

/**
 * Handle detect request
 */
async function handlePaginationDetect(tabId, sendResponse) {
    try {
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return;
        }

        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_DETECT_INTERNAL'
        });
        
        if (response && response.success) {
            paginationState.detection = response.detection;
            paginationState.activeTab = tabId;
            
            sendResponse({
                success: true,
                detection: response.detection
            });
        } else {
            sendResponse({
                success: false,
                error: response?.error || 'Detection failed'
            });
        }
    } catch (error) {
        console.error('Pagination detection error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * Handle navigate next request
 */
async function handlePaginationNavigateNext(tabId, sendResponse) {
    try {
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return;
        }

        paginationState.isPaginating = true;
        
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_NAVIGATE_NEXT_INTERNAL'
        });
        
        if (response && response.success) {
            sendResponse({ success: true });
        } else {
            sendResponse({
                success: false,
                error: response?.error || 'Navigation failed'
            });
        }
    } catch (error) {
        console.error('Pagination navigation error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    } finally {
        paginationState.isPaginating = false;
    }
}

/**
 * Handle reset request
 */
async function handlePaginationReset(tabId, sendResponse) {
    try {
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return;
        }

        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_RESET_INTERNAL'
        });
        
        paginationState.detection = null;
        paginationState.isPaginating = false;
        
        sendResponse({ success: true });
    } catch (error) {
        console.error('Pagination reset error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * Handle get state request
 */
async function handlePaginationGetState(tabId, sendResponse) {
    try {
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return;
        }

        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_GET_STATE_INTERNAL'
        });
        
        if (response && response.success) {
            sendResponse({
                success: true,
                state: response.state
            });
        } else {
            sendResponse({
                success: false,
                error: 'Failed to get state'
            });
        }
    } catch (error) {
        console.error('Pagination get state error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * Broadcast pagination update to UI
 */
function broadcastPaginationUpdate(message) {
    // Log the update for now
    if (!PRODUCTION) {
        console.log('Pagination state update:', message);
    }
}

if (!PRODUCTION) {
    console.log('✅ Pagination Coordinator initialized');
}
