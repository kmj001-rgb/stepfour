// consolidated-background.js - Unified background functionality
// Merged from: simple-download-manager.js + simple-message-handler.js + download-queue.js + 
//              batch-operations-manager.js + memory-optimized-processor.js + site-profile-manager.js +
//              background-utilities.js + enhanced-error-handling.js
// Provides comprehensive background processing with download management, message handling, 
// batch operations, memory optimization, site profile management, utilities, and error handling
// 
// NOTE: image-metadata-tracker.js was removed for Manifest V3 compliance.
//       The chrome.webRequest API used by ImageMetadataTracker is deprecated in MV3.

// =============================================================================
// ES6 MODULE IMPORTS
// =============================================================================

// Import Logger for production-ready logging (CR-020 & CR-009)
import { Logger } from '../lib/logger.js';

// Import AdvancedExportSystem for export functionality
import { AdvancedExportSystem } from './advanced-export-system.js';

// NOTE: The following libraries are required for AdvancedExportSystem but are not ES6 modules:
// - papaparse.min.js (CSV parsing)
// - xlsx.full.min.js (Excel export)
// - input-sanitizer.js (Security)
// 
// These libraries need to be loaded separately in the service worker context.
// The classes below will check for their availability via globalThis and handle gracefully if missing.

// =============================================================================
// SIMPLE DOWNLOAD MANAGER - Simplified download management
// =============================================================================

class SimpleDownloadManager {
  constructor() {
    this.activeDownloads = new Map();
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      active: 0
    };
    this.onProgressCallback = null;
    this.downloadPromises = new Map(); // Store promises for event-driven handling
    
    // CR-002: Store listener reference for cleanup
    this.downloadListener = null;
    
    // Production mode detection for logging
    this.PRODUCTION = typeof globalThis !== 'undefined' && globalThis.PRODUCTION !== undefined 
      ? globalThis.PRODUCTION 
      : true; // Default to production mode if not set
    
    // CR-020: Initialize logger for production-ready logging
    this.logger = typeof Logger !== 'undefined' ? new Logger('DownloadManager') : { debug: console.log, info: console.log, warn: console.warn, error: console.error };
    
    // CR-019: Initialize Input Sanitizer for security
    this.sanitizer = null;
    if (typeof globalThis.InputSanitizer !== 'undefined') {
      this.sanitizer = new globalThis.InputSanitizer();
      this.logger.info('Input Sanitizer initialized for download security (CR-019)');
    } else {
      throw new Error('SECURITY: InputSanitizer is required but not available');
    }
    
    this.initializeDownloadListener();
  }

  // Set progress callback
  setProgressCallback(callback) {
    this.onProgressCallback = callback;
  }

  // Get current stats
  getStats() {
    return { ...this.stats };
  }

  // Add items for download - simplified batch processing
  async addBatch(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No valid items provided for download');
    }

    this.logger.info(`Adding ${items.length} items for download`);

    // Check if downloads permission is available
    const hasPermission = await chrome.permissions.contains({
      permissions: ['downloads']
    });

    if (!hasPermission) {
      // MV3 FIX: Cannot request permission from background
      // Signal need for permission and provide clear error
      await this.requestDownloadPermission(); // This will notify UI
      throw new Error('PERMISSION_REQUIRED:Downloads permission required. Please use the extension popup to grant downloads permission, then try again.');
    }

    this.stats.total += items.length;
    this.updateProgress();

    // Process downloads sequentially to avoid overwhelming the browser
    for (const item of items) {
      try {
        await this.downloadItem(item);
        await this.delay(100); // Small delay between downloads
      } catch (error) {
        this.logger.error('Download failed for item:', item, error);
        this.stats.failed++;
        this.updateProgress();
      }
    }

    this.logger.info('Batch download completed');
  }

  // Download a single item - direct chrome.downloads.download
  // CR-019: URL and filename sanitization for security
  async downloadItem(item) {
    try {
      this.stats.active++;
      this.updateProgress();

      let url = item.image || item.url || item.src;
      if (!url) {
        throw new Error('No URL provided for download');
      }

      // CR-019: Sanitize URL before downloading
      if (this.sanitizer) {
        const sanitizedUrl = this.sanitizer.sanitizeURL(url);
        if (!sanitizedUrl) {
          throw new Error('Invalid or unsafe URL blocked by security filter');
        }
        url = sanitizedUrl;
      }

      // Generate filename (includes sanitization)
      const filename = this.generateFilename(item, url);

      // Simple download options
      const downloadOptions = {
        url: url,
        filename: filename,
        saveAs: false // Don't show save dialog for batch downloads
      };

      this.logger.debug('Starting download:', filename);

      // Direct download call - like working extensions
      const downloadId = await chrome.downloads.download(downloadOptions);
      
      this.activeDownloads.set(downloadId, {
        item: item,
        startTime: Date.now(),
        filename: filename
      });

      // Wait for download to complete
      await this.waitForDownload(downloadId);

      this.stats.completed++;
      this.stats.active--;
      this.updateProgress();

      this.logger.debug('Download completed:', filename);

    } catch (error) {
      this.stats.failed++;
      this.stats.active--;
      this.updateProgress();
      throw error;
    }
  }

  // CR-002: Initialize event-driven download listener with proper cleanup
  initializeDownloadListener() {
    if (!chrome.downloads || !chrome.downloads.onChanged) {
      console.warn('Downloads API not available');
      return;
    }

    // CR-002: Check if listener already exists
    if (this.downloadListener) {
      if (!this.PRODUCTION) console.log('⚠️ Download listener already initialized, skipping');
      return;
    }

    // CR-002: Store bound listener reference for cleanup
    this.downloadListener = (downloadDelta) => {
      if (this.downloadPromises.has(downloadDelta.id)) {
        this.handleDownloadChange(downloadDelta);
      }
    };

    chrome.downloads.onChanged.addListener(this.downloadListener);

    if (!this.PRODUCTION) console.log('✅ Event-driven download listener initialized');
  }

  // Handle download state changes via events
  handleDownloadChange(downloadDelta) {
    const downloadId = downloadDelta.id;
    const promiseHandlers = this.downloadPromises.get(downloadId);
    
    if (!promiseHandlers) return;

    // Handle state changes
    if (downloadDelta.state && downloadDelta.state.current) {
      const state = downloadDelta.state.current;
      
      switch (state) {
        case 'complete':
          this.activeDownloads.delete(downloadId);
          this.downloadPromises.delete(downloadId);
          promiseHandlers.resolve({ state: 'complete' });
          break;
          
        case 'interrupted':
          this.activeDownloads.delete(downloadId);
          this.downloadPromises.delete(downloadId);
          const error = downloadDelta.error ? downloadDelta.error.current : 'Unknown error';
          promiseHandlers.reject(new Error(`Download interrupted: ${error}`));
          break;
      }
    }

    // Handle error changes
    if (downloadDelta.error && downloadDelta.error.current) {
      this.activeDownloads.delete(downloadId);
      this.downloadPromises.delete(downloadId);
      promiseHandlers.reject(new Error(`Download error: ${downloadDelta.error.current}`));
    }
  }

  // Wait for download completion using events
  async waitForDownload(downloadId) {
    return new Promise((resolve, reject) => {
      // Store promise handlers for this download
      this.downloadPromises.set(downloadId, { resolve, reject });

      // Set timeout as fallback
      setTimeout(() => {
        if (this.downloadPromises.has(downloadId)) {
          this.downloadPromises.delete(downloadId);
          this.activeDownloads.delete(downloadId);
          reject(new Error('Download timeout'));
        }
      }, 120000);
    });
  }

  // Request download permission with user prompt - MV3 COMPLIANT
  async requestDownloadPermission() {
    try {
      // MV3 FIX: Cannot request permissions from background without user gesture
      // Instead, signal UI to request permissions and return false for now
      console.warn('⚠️ Downloads permission needed - must be requested from UI with user gesture');
      
      // Send message to popup/dashboard to request permission
      try {
        await chrome.runtime.sendMessage({
          type: 'PERMISSION_NEEDED',
          permission: 'downloads',
          reason: 'Downloads permission required for batch download'
        });
      } catch (error) {
        console.warn('Could not notify UI about permission need:', error);
      }
      
      return false; // Always return false to trigger UI-based permission request
    } catch (error) {
      console.error('❌ Error in permission handling:', error);
      
      const enhancedError = new Error(`[Download Permission Request] Failed to request downloads permission: ${getErrorMessage(error)}`);
      enhancedError.originalError = error;
      enhancedError.context = 'requestDownloadPermission';
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  }

  // Generate filename - simplified
  // CR-019: Filename sanitization for security
  generateFilename(item, url) {
    try {
      // Get base filename from URL
      let filename = new URL(url).pathname.split('/').pop();
      
      // CR-019: Use sanitizer if available
      if (this.sanitizer) {
        filename = this.sanitizer.sanitizeFilename(filename);
      } else {
        // Fallback: Clean up filename
        filename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      }
      
      // Ensure it has an extension
      if (!filename.includes('.')) {
        filename += '.jpg'; // Default to jpg for images
      }
      
      // Add index if available
      if (item.index !== undefined) {
        const ext = filename.split('.').pop();
        const name = filename.replace('.' + ext, '');
        filename = `${name}_${String(item.index).padStart(3, '0')}.${ext}`;
      }
      
      // Sanitize the full path including folder
      const fullPath = `stepthree_gallery/${filename}`;
      return this.sanitizer ? this.sanitizer.sanitizeFilename(fullPath) : fullPath;
    } catch (error) {
      // Fallback filename
      const timestamp = Date.now();
      const index = item.index !== undefined ? `_${String(item.index).padStart(3, '0')}` : '';
      return `stepthree_gallery/image_${timestamp}${index}.jpg`;
    }
  }

  // Update progress
  updateProgress() {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.getStats());
    }
  }

  // Simple delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clear all downloads (cancel active ones)
  async clear() {
    try {
      // Cancel active downloads
      for (const downloadId of this.activeDownloads.keys()) {
        try {
          await chrome.downloads.cancel(downloadId);
        } catch (error) {
          console.warn('Failed to cancel download:', downloadId, error);
        }
      }

      // Reset state
      this.activeDownloads.clear();
      this.stats = {
        total: 0,
        completed: 0,
        failed: 0,
        active: 0
      };

      this.updateProgress();
      if (!this.PRODUCTION) console.log('✅ Download queue cleared');
    } catch (error) {
      console.error('Failed to clear downloads:', error);
      throw error;
    }
  }

  // Pause downloads (not really supported by Chrome Downloads API)
  pause() {
    if (!this.PRODUCTION) console.log('⏸️ Pause requested (Chrome Downloads API does not support pausing)');
  }

  // Resume downloads
  resume() {
    if (!this.PRODUCTION) console.log('▶️ Resume requested');
  }

  // CR-002: Cleanup method to remove event listener
  cleanup() {
    if (this.downloadListener && chrome.downloads && chrome.downloads.onChanged) {
      try {
        chrome.downloads.onChanged.removeListener(this.downloadListener);
        this.downloadListener = null;
        if (!this.PRODUCTION) console.log('✅ Download listener cleaned up');
      } catch (error) {
        console.error('Failed to remove download listener:', error);
      }
    }
  }
}

// =============================================================================
// SIMPLE MESSAGE HANDLER - Simplified message handling
// =============================================================================

class SimpleMessageHandler {
  constructor() {
    this.downloadQueue = null;
    this.notificationSystem = null;
    this.initialized = false;
    
    // CR-002: Store listener reference for cleanup
    this.messageListener = null;
    
    // Production mode detection for logging
    this.PRODUCTION = typeof globalThis !== 'undefined' && globalThis.PRODUCTION !== undefined 
      ? globalThis.PRODUCTION 
      : true; // Default to production mode if not set
    
    // CR-020: Initialize logger for production-ready logging
    this.logger = typeof Logger !== 'undefined' ? new Logger('MessageHandler') : { debug: console.log, info: console.log, warn: console.warn, error: console.error };
  }

  // Static instance for singleton pattern
  static _instance = null;

  // Static getInstance method for singleton pattern
  static getInstance() {
    if (!SimpleMessageHandler._instance) {
      SimpleMessageHandler._instance = new SimpleMessageHandler();
    }
    return SimpleMessageHandler._instance;
  }

  // CR-002: Simple initialization - no complex queueing, with proper listener management
  async initialize(downloadQueue, exportSystem) {
    // Make initialization idempotent to prevent duplicate listeners
    if (this.initialized) {
      this.logger.warn('SimpleMessageHandler already initialized, skipping');
      return;
    }

    this.downloadQueue = downloadQueue;
    this.exportSystem = exportSystem;
    this.initialized = true;
    
    // CR-002: Only add listener if it doesn't exist
    if (!this.messageListener) {
      // CR-002: Store bound listener reference maintaining proper 'this' context
      this.messageListener = (message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async responses
      };
      
      chrome.runtime.onMessage.addListener(this.messageListener);
    }

    this.logger.info('Simple message handler initialized');
  }

  // Direct message handling - no complex routing
  async handleMessage(message, sender, sendResponse) {
    try {
      if (!this.initialized) {
        sendResponse({ success: false, error: 'Extension not ready, please try again' });
        return;
      }

      const { type, action } = message;
      const messageType = type || action;

      switch (messageType) {
        case 'SCRAPE_DONE':
          await this.handleScrapeResults(message, sendResponse);
          break;

        case 'SCRAPE_ERROR':
          await this.handleScrapeError(message, sendResponse);
          break;

        case 'START_DOWNLOAD':
          await this.handleStartDownload(message, sendResponse);
          break;

        case 'GET_QUEUE_STATUS':
          this.handleGetQueueStatus(sendResponse);
          break;

        case 'PAUSE_QUEUE':
          await this.handlePauseQueue(sendResponse);
          break;

        case 'RESUME_QUEUE':
          await this.handleResumeQueue(sendResponse);
          break;

        case 'CLEAR_QUEUE':
          await this.handleClearQueue(sendResponse);
          break;

        case 'CHECK_PERMISSIONS':
          await this.handleCheckPermissions(sendResponse);
          break;

        case 'REQUEST_PERMISSIONS':
          await this.handleRequestPermissions(sendResponse);
          break;

        case 'PERMISSION_GRANTED':
          // Handle permission granted notification from UI - MV3 COMPLIANT
          if (!this.PRODUCTION) console.log(`✅ Permission granted notification received: ${message.permission}`);
          sendResponse({ received: true, permission: message.permission });
          break;

        // Enhanced Smart Selector message handlers
        case 'start_smart_selector':
          await this.handleStartSmartSelector(message, sender, sendResponse);
          break;

        case 'stop_smart_selector':
          await this.handleStopSmartSelector(message, sender, sendResponse);
          break;

        case 'smart_selector_update':
          await this.handleSmartSelectorUpdate(message, sender, sendResponse);
          break;

        case 'pattern_analysis_complete':
          await this.handlePatternAnalysisComplete(message, sender, sendResponse);
          break;

        case 'remove_last_sample':
          await this.handleRemoveLastSample(message, sender, sendResponse);
          break;

        case 'clear_smart_selection':
          await this.handleClearSmartSelection(message, sender, sendResponse);
          break;

        // Advanced Export System message handlers
        case 'EXPORT_DATA':
          await this.handleExportData(message, sendResponse);
          break;

        case 'GET_EXPORT_PROGRESS':
          await this.handleGetExportProgress(message, sendResponse);
          break;

        case 'CANCEL_EXPORT':
          await this.handleCancelExport(message, sendResponse);
          break;

        case 'GET_EXPORT_STATUS':
          await this.handleGetExportStatus(message, sendResponse);
          break;

        case 'GET_EXPORT_HISTORY':
          await this.handleGetExportHistory(message, sendResponse);
          break;

        default:
          // Handle unknown message types gracefully
          if (!this.PRODUCTION) console.log('Unknown message type:', messageType, message);
          sendResponse({ success: true, message: 'Message received but not handled' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Handle scraping results - simplified
  async handleScrapeResults(message, sendResponse) {
    try {
      const { data } = message;
      
      if (!data || !data.items || data.items.length === 0) {
        sendResponse({ success: false, error: 'No items found to download' });
        return;
      }

      if (!this.PRODUCTION) console.log(`📥 Received ${data.items.length} items for download`);

      // Add items to download queue
      if (this.downloadQueue) {
        await this.downloadQueue.addBatch(data.items);
        sendResponse({ 
          success: true, 
          message: `Added ${data.items.length} items to download queue`,
          itemCount: data.items.length 
        });
      } else {
        sendResponse({ success: false, error: 'Download queue not available' });
      }
    } catch (error) {
      console.error('Error handling scrape results:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Handle scraping errors - simplified
  async handleScrapeError(message, sendResponse) {
    try {
      console.error('Scraping error reported:', message.error);
      
      if (this.notificationSystem) {
        this.notificationSystem.showNotification('error', 'Scraping Error', message.error);
      }
      
      sendResponse({ success: true, message: 'Error reported and logged' });
    } catch (error) {
      console.error('Error handling scrape error:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Start download - simplified
  async handleStartDownload(message, sendResponse) {
    try {
      const { items } = message;
      
      if (!items || items.length === 0) {
        sendResponse({ success: false, error: 'No items provided for download' });
        return;
      }

      if (this.downloadQueue) {
        await this.downloadQueue.addBatch(items);
        sendResponse({ 
          success: true, 
          message: `Started download of ${items.length} items` 
        });
      } else {
        sendResponse({ success: false, error: 'Download queue not available' });
      }
    } catch (error) {
      console.error('Error starting download:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Get queue status - direct
  handleGetQueueStatus(sendResponse) {
    if (this.downloadQueue) {
      const stats = this.downloadQueue.getStats();
      sendResponse({ success: true, stats });
    } else {
      sendResponse({ success: false, error: 'Download queue not available' });
    }
  }

  // Pause queue - direct
  async handlePauseQueue(sendResponse) {
    try {
      if (this.downloadQueue) {
        this.downloadQueue.pause();
        sendResponse({ success: true, message: 'Download queue paused' });
      } else {
        sendResponse({ success: false, error: 'Download queue not available' });
      }
    } catch (error) {
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Resume queue - direct
  async handleResumeQueue(sendResponse) {
    try {
      if (this.downloadQueue) {
        this.downloadQueue.resume();
        sendResponse({ success: true, message: 'Download queue resumed' });
      } else {
        sendResponse({ success: false, error: 'Download queue not available' });
      }
    } catch (error) {
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Clear queue - direct
  async handleClearQueue(sendResponse) {
    try {
      if (this.downloadQueue) {
        this.downloadQueue.clear();
        sendResponse({ success: true, message: 'Download queue cleared' });
      } else {
        sendResponse({ success: false, error: 'Download queue not available' });
      }
    } catch (error) {
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Check permissions - simple
  async handleCheckPermissions(sendResponse) {
    try {
      const hasDownloads = await chrome.permissions.contains({ permissions: ['downloads'] });
      const hasTabs = await chrome.permissions.contains({ permissions: ['tabs'] });
      
      sendResponse({ 
        success: true, 
        permissions: { downloads: hasDownloads, tabs: hasTabs } 
      });
    } catch (error) {
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Request permissions - MV3 COMPLIANT: Route to UI for user gesture
  async handleRequestPermissions(sendResponse) {
    try {
      // MV3 FIX: Cannot request permissions from service worker
      // Must route to UI context with user gesture
      console.warn('⚠️ Permission request attempted from service worker - routing to UI');
      
      // Send message to UI to handle permission request
      try {
        await chrome.runtime.sendMessage({
          type: 'PERMISSION_NEEDED',
          permission: 'downloads',
          reason: 'Downloads permission required for batch operations'
        });
        
        // Return false to indicate UI handling is needed
        sendResponse({ 
          success: false, 
          error: 'PERMISSION_REQUIRED:Permission request must be handled by UI with user gesture. Please use the extension popup to grant permissions.',
          requiresUIPermission: true
        });
        
      } catch (error) {
        console.warn('Could not notify UI about permission need:', getErrorMessage(error));
        sendResponse({ 
          success: false, 
          error: 'PERMISSION_REQUIRED:Downloads permission required. Please open the extension popup and grant permissions manually.',
          requiresUIPermission: true
        });
      }
    } catch (error) {
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // =============================================================================
  // ADVANCED EXPORT SYSTEM MESSAGE HANDLERS
  // =============================================================================

  // MV3 FIX: Route large files to dashboard for reliable blob URL handling
  async routeLargeFileToFrontend(exportResult, tabId) {
    try {
      if (!this.PRODUCTION) console.log('🔄 Routing large file to dashboard for reliable download...');
      
      if (!tabId) {
        // Try to find an active dashboard tab
        const tabs = await chrome.tabs.query({ url: '*://*/ui/windowed-dashboard.html*' });
        if (tabs.length > 0) {
          tabId = tabs[0].id;
        } else {
          throw new Error('No dashboard tab found for large file routing');
        }
      }

      // Send export data to dashboard for blob creation and download
      await chrome.tabs.sendMessage(tabId, {
        action: 'handle_large_file_download',
        exportData: {
          data: Array.from(new Uint8Array(exportResult.data)), // Convert to transferable array
          mimeType: exportResult.mimeType,
          filename: exportResult.filename,
          size: exportResult.size,
          exportId: exportResult.exportId
        }
      });

      if (!this.PRODUCTION) console.log('✅ Large file successfully routed to dashboard');
      
    } catch (error) {
      console.error('❌ Failed to route large file to dashboard:', error);
      throw error;
    }
  }

  // MV3 FIX: Fallback to data URL download when dashboard routing fails  
  async fallbackToDataURLDownload(exportResult, sendResponse) {
    try {
      if (!this.PRODUCTION) console.log('⚠️ Using fallback data URL download (may fail for very large files)');
      
      // Force chunked data URL creation only
      const dataUrl = this.createChunkedDataURL(new Uint8Array(exportResult.data), exportResult.mimeType);
      
      const downloadOptions = {
        url: dataUrl,
        filename: exportResult.filename,
        saveAs: false
      };

      const downloadId = await chrome.downloads.download(downloadOptions);
      
      sendResponse({
        success: true,
        exportId: exportResult.exportId,
        downloadId: downloadId,
        filename: exportResult.filename,
        size: exportResult.size,
        fallbackUsed: true,
        warning: 'Large file download used fallback method - may be unreliable'
      });

    } catch (error) {
      console.error('❌ Fallback download also failed:', error);
      sendResponse({
        success: false,
        error: 'Both dashboard routing and fallback download failed: ' + getErrorMessage(error)
      });
    }
  }

  // MV3 SAFE: Memory-safe data URL creation - NO BLOB URLs in service worker
  async createDataURL(data, mimeType) {
    try {
      // MV3 FIX: Only use data URLs, never blob URLs in service worker
      const MAX_DATA_URL_SIZE = 25 * 1024 * 1024; // 25MB - absolute max for service worker
      
      let dataSize = 0;
      let bytes;
      
      if (data instanceof Uint8Array) {
        bytes = data;
        dataSize = data.length;
      } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
        dataSize = data.byteLength;
      } else if (typeof data === 'string') {
        // For text data, estimate size and convert to bytes
        const encoder = new TextEncoder();
        bytes = encoder.encode(data);
        dataSize = bytes.length;
      } else {
        throw new Error('Unsupported data type for createDataURL');
      }
      
      if (!this.PRODUCTION) console.log(`📊 Creating data URL for ${this.formatBytes(dataSize)} file (${mimeType})`);
      
      // MV3 FIX: Reject files too large for service worker data URLs
      if (dataSize > MAX_DATA_URL_SIZE) {
        console.error(`❌ File too large (${this.formatBytes(dataSize)}) for service worker data URL`);
        throw new Error(`File too large for service worker (${this.formatBytes(dataSize)}). Should be routed to dashboard.`);
      }
      
      // Use chunked base64 encoding for all files
      if (!this.PRODUCTION) console.log('🔄 Using chunked base64 encoding for reliable data URL');
      return await this.createChunkedDataURL(bytes, mimeType);
      
    } catch (error) {
      console.error('❌ Error creating data URL:', error);
      throw error; // MV3 FIX: No blob URL fallback in service worker
    }
  }

  // Chunked base64 encoder to prevent memory issues and call stack overflow
  async createChunkedDataURL(bytes, mimeType) {
    try {
      const CHUNK_SIZE = 65536; // 64KB chunks - safe for all browsers
      let base64Data = '';
      
      if (!this.PRODUCTION) console.log(`🔄 Processing ${bytes.length} bytes in ${Math.ceil(bytes.length / CHUNK_SIZE)} chunks`);
      
      // Process in chunks to avoid String.fromCharCode.apply() call stack limit
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        
        // Convert chunk to string using safe method
        let chunkString = '';
        for (let j = 0; j < chunk.length; j++) {
          chunkString += String.fromCharCode(chunk[j]);
        }
        
        // Add to base64 (btoa is safe for smaller chunks)
        base64Data += btoa(chunkString);
        
        // Yield control occasionally for very large files
        if (i % (CHUNK_SIZE * 10) === 0 && i > 0) {
          // Allow other operations to run
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      if (!this.PRODUCTION) console.log(`✅ Chunked encoding complete: ${base64Data.length} base64 chars`);
      return `data:${mimeType};base64,${base64Data}`;
      
    } catch (error) {
      console.error('❌ Chunked encoding failed:', error);
      throw error;
    }
  }
  
  // Helper method to format bytes for logging
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Handle export data request
  async handleExportData(message, sendResponse) {
    try {
      if (!this.exportSystem) {
        sendResponse({ success: false, error: 'Export system not available' });
        return;
      }

      const { exportData, format, filename, options = {} } = message;
      
      if (!exportData || !exportData.items) {
        sendResponse({ success: false, error: 'No data provided for export' });
        return;
      }

      if (!this.PRODUCTION) console.log(`📊 Starting ${format} export: ${exportData.items.length} items`);

      // Start export with progress tracking
      const result = await this.exportSystem.exportData(exportData, format, filename, {
        enableProgressTracking: true,
        enableUserNotifications: true,
        enableMemoryManagement: true,
        ...options
      });

      if (result.success) {
        // MV3 FIX: Check file size and route large files to dashboard
        const fileSize = result.size || result.data?.byteLength || result.data?.length || 0;
        const LARGE_FILE_THRESHOLD = 25 * 1024 * 1024; // 25MB threshold
        
        if (fileSize > LARGE_FILE_THRESHOLD) {
          if (!this.PRODUCTION) console.log(`🔄 Large file detected (${this.formatBytes(fileSize)}), routing to dashboard for reliable download`);
          
          // Route to dashboard for blob creation and download
          try {
            await this.routeLargeFileToFrontend(result, message.tabId);
            
            sendResponse({
              success: true,
              exportId: result.exportId,
              routedToDashboard: true,
              filename: result.filename,
              size: result.size,
              itemsProcessed: result.itemsProcessed,
              exportTime: result.exportTime,
              throughput: result.throughput,
              message: 'Large file routed to dashboard for reliable download'
            });
          } catch (routingError) {
            console.warn('⚠️ Dashboard routing failed, falling back to service worker download:', routingError);
            // Fallback to service worker download with data URL only
            await this.fallbackToDataURLDownload(result, sendResponse);
          }
        } else {
          // Small/medium files: use reliable data URL approach
          if (!this.PRODUCTION) console.log(`📊 Small file (${this.formatBytes(fileSize)}), using data URL approach`);
          const downloadOptions = {
            url: this.createDataURL(result.data, result.mimeType),
            filename: result.filename,
            saveAs: false
          };

          const downloadId = await chrome.downloads.download(downloadOptions);
          
          sendResponse({
            success: true,
            exportId: result.exportId,
            downloadId: downloadId,
            filename: result.filename,
            size: result.size,
            itemsProcessed: result.itemsProcessed,
            exportTime: result.exportTime,
            throughput: result.throughput
          });
        }
      } else {
        sendResponse({
          success: false,
          error: result.error,
          userFriendlyError: result.userFriendlyError,
          exportTime: result.exportTime
        });
      }

    } catch (error) {
      console.error('Export data handler error:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Handle get export progress request
  async handleGetExportProgress(message, sendResponse) {
    try {
      if (!this.exportSystem) {
        sendResponse({ success: false, error: 'Export system not available' });
        return;
      }

      const { exportId } = message;
      
      if (!exportId) {
        // Return all active exports if no specific ID provided
        const activeExports = this.exportSystem.getActiveExports();
        sendResponse({ success: true, activeExports });
        return;
      }

      // Get specific export progress (implementation would need to be added to AdvancedExportSystem)
      const activeExports = this.exportSystem.getActiveExports();
      const exportInfo = activeExports.find(exp => exp.exportId === exportId);

      if (exportInfo) {
        sendResponse({ success: true, exportInfo });
      } else {
        sendResponse({ success: false, error: 'Export not found or completed' });
      }

    } catch (error) {
      console.error('Get export progress handler error:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Handle cancel export request
  async handleCancelExport(message, sendResponse) {
    try {
      if (!this.exportSystem) {
        sendResponse({ success: false, error: 'Export system not available' });
        return;
      }

      const { exportId, exportIds } = message;
      
      if (exportId) {
        // Cancel single export
        const result = await this.exportSystem.cancelExport(exportId);
        sendResponse({ success: result.success, message: result.message });
      } else if (exportIds && Array.isArray(exportIds)) {
        // Cancel multiple exports
        const result = await this.exportSystem.cancelAllExports(exportIds);
        sendResponse({ 
          success: true, 
          cancelledExports: result.cancelledExports,
          failedCancellations: result.failedCancellations,
          results: result.results
        });
      } else {
        // Cancel all active exports
        const result = await this.exportSystem.cancelAllExports();
        sendResponse({ 
          success: true, 
          cancelledExports: result.cancelledExports,
          message: 'All active exports cancelled'
        });
      }

    } catch (error) {
      console.error('Cancel export handler error:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Handle get export status request
  async handleGetExportStatus(message, sendResponse) {
    try {
      if (!this.exportSystem) {
        sendResponse({ success: false, error: 'Export system not available' });
        return;
      }

      const status = {
        activeExports: this.exportSystem.getActiveExports(),
        exportStats: this.exportSystem.exportStats,
        exportHistory: this.exportSystem.exportHistory.slice(-10), // Last 10 exports
        systemHealth: {
          memoryUsage: this.exportSystem.getMemoryUsage(),
          isHealthy: true // Could add more health checks
        }
      };

      sendResponse({ success: true, status });

    } catch (error) {
      console.error('Get export status handler error:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // Handle get export history request  
  async handleGetExportHistory(message, sendResponse) {
    try {
      if (!this.exportSystem) {
        sendResponse({ success: false, error: 'Export system not available' });
        return;
      }

      const { limit = 50, offset = 0, format, successful } = message;
      
      let history = this.exportSystem.exportHistory;

      // Apply filters
      if (format) {
        history = history.filter(exp => exp.format === format);
      }
      if (successful !== undefined) {
        history = history.filter(exp => exp.success === successful);
      }

      // Apply pagination
      const totalCount = history.length;
      const paginatedHistory = history.slice(offset, offset + limit);

      sendResponse({ 
        success: true, 
        history: paginatedHistory,
        totalCount,
        offset,
        limit,
        hasMore: (offset + limit) < totalCount
      });

    } catch (error) {
      console.error('Get export history handler error:', error);
      sendResponse({ success: false, error: getErrorMessage(error) });
    }
  }

  // CR-002: Cleanup method to properly remove the message listener
  cleanup() {
    if (this.messageListener) {
      try {
        chrome.runtime.onMessage.removeListener(this.messageListener);
        this.messageListener = null;
        this.initialized = false;
        if (!this.PRODUCTION) console.log('✅ Message handler listener cleaned up');
      } catch (error) {
        console.error('Failed to remove message listener:', error);
      }
    }
  }
}

// =============================================================================
// ENHANCED DOWNLOAD QUEUE - Enhanced download queue management (simplified)
// =============================================================================

class StepThreeDownloadQueue {
  constructor({concurrency = 5, retryLimit = 3, hostLimit = 3} = {}) {
    this.concurrency = concurrency;
    this.hostLimit = hostLimit;
    this.retryLimit = retryLimit;

    this.queue = [];
    this.active = new Map();
    this.completed = [];
    this.failed = [];
    this.duplicates = new Set();
    this.onProgress = () => {};
    this.paused = false;
    this.stopped = false;

    this.stats = {
      totalItems: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      startTime: null,
      endTime: null
    };

    this.filters = {
      minWidth: 0,
      minHeight: 0,
      allowedTypes: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
      skipDuplicates: false,
      maxResults: 1000
    };
    
    // Memory limits for unbounded array growth prevention
    this.MAX_ERRORS = 500;
    
    this.errors = [];
    this.hostQueue = new Map();
  }

  async addItems(items, options = {}) {
    const processedItems = items.map(item => this.processItem(item, options));

    // Apply filters
    const filteredItems = options.skipFiltering ? processedItems :
      processedItems.filter(item => this.passesFilters(item));

    // Check for duplicates if enabled
    const uniqueItems = this.filters.skipDuplicates ?
      await this.removeDuplicates(filteredItems) : filteredItems;

    // Add to queue
    uniqueItems.forEach(item => {
      item.id = this.generateItemId();
      item.addedAt = Date.now();
      item.status = 'queued';
      item.retryCount = 0;
      this.queue.push(item);
    });

    this.stats.totalItems = this.queue.length + this.completed.length + this.failed.length;
    this.onProgress({
      state: 'items_added',
      added: uniqueItems.length,
      filtered: processedItems.length - filteredItems.length,
      duplicates: filteredItems.length - uniqueItems.length,
      total: this.queue.length,
      stats: this.getStats()
    });

    // Start processing if not paused
    if (!this.paused && !this.stopped) {
      this._next();
    }

    return uniqueItems.length;
  }

  // MV3 FIX: Add addBatch alias for compatibility with SimpleMessageHandler
  async addBatch(items, options = {}) {
    if (!this.PRODUCTION) console.log('📥 StepThreeDownloadQueue.addBatch called - routing to addItems for MV3 compatibility');
    return await this.addItems(items, options);
  }

  processItem(item, _options = {}) {
    const url = item.url || item.src || item.href;

    const processed = {
      url: url,
      filename: item.filename || this.generateFilename(item),
      referrer: item.referrer || `chrome-extension://${chrome.runtime.id}`,
      headers: item.headers || {},
      metadata: {
        sourceUrl: item.sourceUrl || 'unknown',
        extractedAt: Date.now(),
        selector: item.selector,
        index: item.index,
        ...item.metadata
      },
      ...item
    };

    // Validate required fields
    if (!processed.url) {
      throw new Error('Item must have a URL');
    }

    return processed;
  }

  async removeDuplicates(items) {
    const uniqueItems = [];
    const seenUrls = new Set(this.duplicates);

    for (const item of items) {
      // URL-based deduplication
      if (seenUrls.has(item.url)) {
        this.stats.duplicates++;
        continue;
      }

      seenUrls.add(item.url);
      uniqueItems.push(item);
    }

    // Update duplicates set
    seenUrls.forEach(url => this.duplicates.add(url));
    return uniqueItems;
  }

  passesFilters(item) {
    // Size filters (if metadata available)
    if (item.width && this.filters.minWidth && item.width < this.filters.minWidth) {
      return false;
    }

    if (item.height && this.filters.minHeight && item.height < this.filters.minHeight) {
      return false;
    }

    // File type filters
    const extension = this.getFileExtension(item.url || item.filename || '');
    if (extension && this.filters.allowedTypes.length > 0) {
      if (!this.filters.allowedTypes.includes(extension.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  getFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([^.]+)$/);
      return match ? match[1] : null;
    } catch (_error) {
      const match = url.match(/\.([^.]+)$/);
      return match ? match[1] : null;
    }
  }

  generateFilename(item) {
    // Extract from URL
    try {
      const url = new URL(item.url);
      const pathname = url.pathname;
      let filename = pathname.split('/').pop();

      if (!filename || !filename.includes('.')) {
        filename = `image_${Date.now()}.jpg`;
      }

      return this.sanitizeFilename(filename);
    } catch (_error) {
      return `download_${Date.now()}.bin`;
    }
  }

  sanitizeFilename(filename) {
    const invalidChars = /[<>:"/\\|?*]/g;
    return filename
      .replace(invalidChars, '_')
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200);
  }

  generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _next() {
    // Simplified processing logic
    if (this.queue.length > 0 && this.active.size < this.concurrency) {
      const item = this.queue.shift();
      this.processDownload(item);
    }
  }

  async processDownload(item) {
    try {
      const downloadId = await chrome.downloads.download({
        url: item.url,
        filename: item.filename
      });
      
      this.active.set(downloadId, item);
      // Wait for completion and handle success/failure
    } catch (error) {
      this.failed.push(item);
      this.stats.failed++;
    }
  }

  stop() {
    this.stopped = true;
    this.paused = true;
    this.active.clear();
    this.stats.endTime = Date.now();
    this.onProgress({state:'stopped', stats: this.getStats()});
  }

  clear() {
    this.stop();
    this.queue = [];
    this.completed = [];
    this.failed = [];
    this.duplicates.clear();
    this.errors = [];
    this.hostQueue.clear();
    this.stats = {
      totalItems: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      duplicates: 0,
      startTime: null,
      endTime: null
    };
    this.stopped = false;
    this.onProgress({state:'cleared', stats: this.getStats()});
  }

  getStats() {
    const now = Date.now();
    const elapsed = this.stats.startTime ? (now - this.stats.startTime) / 1000 : 0;
    const rate = elapsed > 0 ? this.stats.processed / elapsed : 0;
    const remaining = this.queue.length + this.active.size;
    const eta = rate > 0 ? remaining / rate : 0;

    return {
      ...this.stats,
      elapsed,
      rate: Math.round(rate * 100) / 100,
      eta: Math.round(eta),
      queueSize: this.queue.length,
      activeDownloads: this.active.size,
      remaining
    };
  }

  setProgressCallback(cb) {
    this.onProgress = typeof cb === 'function' ? cb : () => {};
  }

  setFilters(filters) {
    Object.assign(this.filters, filters);
  }
}

// =============================================================================
// BATCH OPERATIONS MANAGER - Simplified batch processing
// =============================================================================

class BatchOperationsManager {
  constructor(options = {}) {
    this.options = {
      maxConcurrentTabs: options.maxConcurrentTabs || 5,
      tabProcessingDelay: options.tabProcessingDelay || 1000,
      enableProgressTracking: options.enableProgressTracking !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000,
      ...options
    };

    // Memory limits for unbounded array growth prevention
    this.MAX_BATCH_QUEUE = 1000;
    this.MAX_BATCH_HISTORY = 100;
    
    this.activeBatches = new Map();
    this.batchQueue = [];
    this.processingQueue = false;
    this.batchHistory = [];

    this._listenersRegistered = false;
    this._initializationPromise = null;
  }

  // Async initialization for event handlers - called when needed
  async ensureInitialized() {
    if (this._initializationPromise) {
      return this._initializationPromise;
    }
    
    this._initializationPromise = this._initialize();
    return this._initializationPromise;
  }
  
  async _initialize() {
    if (this._listenersRegistered) {
      return;
    }
    
    if (!this.PRODUCTION) console.log('🔄 Initializing BatchOperationsManager event handlers...');
    
    try {
      // Store bound handlers so we can remove them later if needed
      this._tabUpdatedHandler = (tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
          this.handleTabLoadComplete(tabId, tab);
        }
      };
      
      this._tabRemovedHandler = (tabId) => {
        this.handleTabRemoved(tabId);
      };
      
      // Register listeners
      chrome.tabs.onUpdated.addListener(this._tabUpdatedHandler);
      chrome.tabs.onRemoved.addListener(this._tabRemovedHandler);
      
      this._listenersRegistered = true;
      if (!this.PRODUCTION) console.log('✅ BatchOperationsManager event handlers registered');
      
    } catch (error) {
      console.error('❌ Failed to initialize BatchOperationsManager:', error);
      this._initializationPromise = null; // Reset to allow retry
      throw error;
    }
  }

  async startBatchOperation(batchConfig) {
    try {
      await this.ensureInitialized();
      
      const batchId = this.generateBatchId();
      const batch = {
        id: batchId,
        config: batchConfig,
        urls: batchConfig.urls || [],
        status: 'initializing',
        startTime: Date.now(),
        endTime: null,
        progress: {
          total: batchConfig.urls?.length || 0,
          completed: 0,
          failed: 0,
          inProgress: 0
        },
        results: [],
        errors: [],
        tabs: new Map()
      };

      this.activeBatches.set(batchId, batch);
      if (!this.PRODUCTION) console.log(`🚀 Starting batch operation ${batchId} with ${batch.progress.total} URLs`);

      // Start processing
      batch.status = 'processing';
      await this.processBatch(batch);

      return batchId;
    } catch (error) {
      console.error('❌ Batch operation failed to start:', error);
      throw error;
    }
  }

  async processBatch(batch) {
    try {
      const chunks = this.chunkArray(batch.urls, this.options.maxConcurrentTabs);

      for (const chunk of chunks) {
        if (batch.status === 'cancelled') {
          break;
        }

        await this.processChunk(batch, chunk);

        // Add delay between chunks
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await this.delay(this.options.tabProcessingDelay);
        }
      }

      // Complete the batch
      batch.status = batch.errors.length > 0 ? 'completed_with_errors' : 'completed';
      batch.endTime = Date.now();

      this.notifyBatchComplete(batch);

      // Enforce memory limit before adding to history
      if (this.batchHistory.length >= this.MAX_BATCH_HISTORY) {
        this.batchHistory.shift(); // Remove oldest entry (at beginning since using push)
      }
      // Move to history
      this.batchHistory.push({
        ...batch,
        tabs: undefined // Don't store tab references in history
      });

    } catch (error) {
      batch.status = 'failed';
      batch.endTime = Date.now();
      batch.errors.push({
        type: 'batch_error',
        message: getErrorMessage(error),
        timestamp: Date.now()
      });

      console.error('❌ Batch processing failed:', error);
    }
  }

  async processChunk(batch, urls) {
    const chunkPromises = urls.map(url => this.processUrl(batch, url));
    await Promise.allSettled(chunkPromises);
  }

  async processUrl(batch, url) {
    try {
      batch.progress.inProgress++;

      // Create a new tab for this URL
      const tab = await chrome.tabs.create({
        url: url,
        active: false // Background processing
      });

      batch.tabs.set(tab.id, {
        url: url,
        status: 'loading',
        startTime: Date.now(),
        retryCount: 0
      });

      // Wait for tab to load and process
      const result = await this.waitForTabProcessing(batch, tab);

      if (result.success) {
        batch.progress.completed++;
        batch.results.push(result);
      } else {
        batch.progress.failed++;
        batch.errors.push({
          url: url,
          error: result.error,
          timestamp: Date.now()
        });
      }

      // Close the tab
      try {
        await chrome.tabs.remove(tab.id);
      } catch (closeError) {
        console.warn('Failed to close tab:', closeError);
      }

      batch.tabs.delete(tab.id);
      batch.progress.inProgress--;

    } catch (error) {
      batch.progress.inProgress--;
      batch.progress.failed++;
      batch.errors.push({
        url: url,
        error: getErrorMessage(error),
        timestamp: Date.now()
      });
      console.error(`❌ Failed to process URL ${url}:`, error);
    }
  }

  async waitForTabProcessing(batch, tab, timeout = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkInterval = setInterval(async () => {
        try {
          // Check timeout
          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            resolve({ success: false, error: 'Processing timeout' });
            return;
          }

          // Try to inject and run scraper
          const result = await this.injectAndRunScraper(tab.id);

          if (result.completed) {
            clearInterval(checkInterval);
            resolve({
              success: true,
              url: tab.url,
              items: result.items || [],
              metadata: result.metadata || {}
            });
          }

        } catch (error) {
          // Tab might not be ready yet, continue checking
          if (!this.PRODUCTION) console.log('Tab not ready yet, retrying...', getErrorMessage(error));
        }
      }, 2000); // Check every 2 seconds
    });
  }

  async injectAndRunScraper(tabId) {
    try {
      // Send message to start scraping
      const result = await chrome.tabs.sendMessage(tabId, {
        action: 'START_BATCH_SCRAPE',
        config: {
          mode: 'batch',
          timeout: 20000,
          maxItems: 1000
        }
      });

      return result || { completed: false };
    } catch (error) {
      console.warn('Failed to inject scraper:', error);
      return { completed: false, error: getErrorMessage(error) };
    }
  }

  handleTabLoadComplete(tabId, _tab) {
    // Find which batch this tab belongs to
    for (const batch of this.activeBatches.values()) {
      const tabInfo = batch.tabs.get(tabId);
      if (tabInfo) {
        tabInfo.status = 'loaded';
        tabInfo.loadTime = Date.now();
        break;
      }
    }
  }

  handleTabRemoved(tabId) {
    // Clean up tab references from active batches
    for (const batch of this.activeBatches.values()) {
      if (batch.tabs.has(tabId)) {
        batch.tabs.delete(tabId);
        break;
      }
    }
  }

  notifyBatchComplete(batch) {
    try {
      const message = `Batch operation completed: ${batch.progress.completed}/${batch.progress.total} successful`;
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'StepThree Gallery Scraper',
        message: message
      });
    } catch {
      if (!this.PRODUCTION) console.log('Batch completed:', batch.progress);
    }
  }

  // Cancel an active batch operation
  async cancelBatch(batchId) {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {return false;}

    batch.status = 'cancelled';

    // Close all associated tabs
    for (const tabId of batch.tabs.keys()) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (error) {
        console.warn('Failed to close tab during cancellation:', error);
      }
    }

    batch.endTime = Date.now();
    return true;
  }

  // Get status of all active batches
  getActiveBatches() {
    const batches = {};
    for (const [id, batch] of this.activeBatches) {
      batches[id] = {
        id: batch.id,
        status: batch.status,
        progress: batch.progress,
        startTime: batch.startTime,
        config: batch.config
      };
    }
    return batches;
  }

  // Get batch history
  getBatchHistory(limit = 10) {
    return this.batchHistory.slice(-limit);
  }

  // Utility methods
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // CR-002: Cleanup method to remove event listeners
  cleanup() {
    if (this._tabUpdatedHandler) {
      try {
        chrome.tabs.onUpdated.removeListener(this._tabUpdatedHandler);
        this._tabUpdatedHandler = null;
        if (!this.PRODUCTION) console.log('✅ Tab updated listener cleaned up');
      } catch (error) {
        console.error('Failed to remove tab updated listener:', error);
      }
    }

    if (this._tabRemovedHandler) {
      try {
        chrome.tabs.onRemoved.removeListener(this._tabRemovedHandler);
        this._tabRemovedHandler = null;
        if (!this.PRODUCTION) console.log('✅ Tab removed listener cleaned up');
      } catch (error) {
        console.error('Failed to remove tab removed listener:', error);
      }
    }

    this._listenersRegistered = false;
    this._initializationPromise = null;
  }
}

// =============================================================================
// MEMORY OPTIMIZED PROCESSOR - Simplified memory optimization
// =============================================================================

class MemoryOptimizedProcessor {
  constructor(options = {}) {
    this.options = {
      maxMemoryItems: options.maxMemoryItems || 1000,
      spillBatchSize: options.spillBatchSize || 500,
      processingBatchSize: options.processingBatchSize || 100,
      dbName: options.dbName || 'StepThreeProcessor',
      dbVersion: options.dbVersion || 1,
      enableCompression: options.enableCompression !== false,
      maxTotalItems: options.maxTotalItems || 100000,
      ...options
    };

    // Memory limits for unbounded array growth prevention
    this.MAX_MEMORY_QUEUE = 10000;
    
    this.memoryQueue = [];
    this.dbQueue = null;
    this.isProcessing = false;
    this.totalItems = 0;
    this.processedItems = 0;
    this.spilledItems = 0;

    this.stats = {
      memoryUsage: 0,
      dbUsage: 0,
      totalProcessed: 0,
      spillOperations: 0,
      compressionRatio: 0
    };

    this.observers = {
      progress: [],
      memory: [],
      error: []
    };
  }

  // Add item to processor
  async addItem(item) {
    if (this.totalItems >= this.options.maxTotalItems) {
      throw new Error(`Maximum items limit reached: ${this.options.maxTotalItems}`);
    }

    // Add metadata
    const enhancedItem = {
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      memoryId: this.memoryQueue.length
    };

    // Check memory limit
    if (this.memoryQueue.length >= this.options.maxMemoryItems) {
      await this.spillToDatabase();
    }

    // Enforce hard memory limit as safety net
    if (this.memoryQueue.length >= this.MAX_MEMORY_QUEUE) {
      this.memoryQueue.shift(); // Remove oldest entry (at beginning since using push)
    }

    this.memoryQueue.push(enhancedItem);
    this.totalItems++;

    // Update memory usage estimate
    this.updateMemoryStats();

    return enhancedItem.id;
  }

  // Add multiple items efficiently
  async addItems(items) {
    if (this.totalItems + items.length > this.options.maxTotalItems) {
      throw new Error(`Adding ${items.length} items would exceed maximum limit: ${this.options.maxTotalItems}`);
    }

    const enhancedItems = items.map((item, index) => ({
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      memoryId: this.memoryQueue.length + index
    }));

    // Check if we need to spill to database
    if (this.memoryQueue.length + enhancedItems.length > this.options.maxMemoryItems) {
      await this.spillToDatabase();
    }

    // Enforce hard memory limit as safety net - remove oldest entries if needed
    while (this.memoryQueue.length + enhancedItems.length > this.MAX_MEMORY_QUEUE) {
      this.memoryQueue.shift(); // Remove oldest entry (at beginning since using push)
    }

    this.memoryQueue.push(...enhancedItems);
    this.totalItems += enhancedItems.length;

    // Update memory usage estimate
    this.updateMemoryStats();

    return enhancedItems.map(item => item.id);
  }

  // Spill memory items to database (simplified)
  async spillToDatabase() {
    if (this.memoryQueue.length === 0) {return;}

    try {
      // Simplified spillover - just remove from memory for now
      const itemsToSpill = this.memoryQueue.splice(0, this.options.spillBatchSize);
      this.spilledItems += itemsToSpill.length;
      this.stats.spillOperations++;
      this.stats.dbUsage = this.spilledItems;

      // Update memory stats
      this.updateMemoryStats();

      if (!this.PRODUCTION) console.log(`📤 Spilled ${itemsToSpill.length} items to reduce memory usage`);
    } catch (error) {
      console.error('Database spillover failed:', error);
      throw error;
    }
  }

  // Process items in batches
  async processItems(processingFunction, options = {}) {
    if (this.isProcessing) {
      throw new Error('Processing already in progress');
    }

    this.isProcessing = true;
    const results = [];

    try {
      // Process memory items
      const batchSize = this.options.processingBatchSize;

      for (let i = 0; i < this.memoryQueue.length; i += batchSize) {
        const batch = this.memoryQueue.slice(i, i + batchSize);

        try {
          const processedBatch = await processingFunction(batch, options);
          results.push(...processedBatch);
        } catch (error) {
          console.error('Batch processing failed:', error);
        }
      }

      this.processedItems = results.length;
      return results;

    } finally {
      this.isProcessing = false;
    }
  }

  updateMemoryStats() {
    // Simplified memory usage estimation
    this.stats.memoryUsage = this.memoryQueue.length;
    this.stats.totalProcessed = this.processedItems;
  }

  generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      ...this.stats,
      totalItems: this.totalItems,
      memoryItems: this.memoryQueue.length,
      spilledItems: this.spilledItems,
      isProcessing: this.isProcessing
    };
  }

  clear() {
    this.memoryQueue = [];
    this.totalItems = 0;
    this.processedItems = 0;
    this.spilledItems = 0;
    this.stats = {
      memoryUsage: 0,
      dbUsage: 0,
      totalProcessed: 0,
      spillOperations: 0,
      compressionRatio: 0
    };
    if (!this.PRODUCTION) console.log('🧹 Memory processor cleared');
  }
}

// =============================================================================
// SITE PROFILE MANAGER - Simplified site profile management
// =============================================================================

class SiteProfileManager {
  constructor(options = {}) {
    this.options = {
      enableRemoteUpdates: options.enableRemoteUpdates !== false,
      updateInterval: options.updateInterval || 86400000, // 24 hours
      enableCustomProfiles: options.enableCustomProfiles !== false,
      maxCustomProfiles: options.maxCustomProfiles || 100,
      ...options
    };

    this.builtInProfiles = new Map();
    this.customProfiles = new Map();
    this.activeProfile = null;
    this.lastUpdateCheck = 0;

    this.initializeBuiltInProfiles();
    this.loadCustomProfiles();
  }

  initializeBuiltInProfiles() {
    // Getty Images profile
    this.builtInProfiles.set('getty', {
      id: 'getty',
      name: 'Getty Images',
      domains: ['gettyimages.com', 'gettyimages.co.uk', 'gettyimages.ca'],
      selectors: {
        gallery: 'figure img, [data-testid*="photo"] img, .gallery-item img, .search-result img',
        thumbnail: 'figure img, [data-testid*="photo"] img',
        fullSize: 'meta[property="og:image"]',
        title: 'img[alt], img[title], figcaption',
        link: 'figure a, [data-testid*="photo"] a',
        pagination: '.pagination__next'
      },
      settings: {
        waitTime: 2000,
        maxScrollAttempts: 10,
        useInfiniteScroll: true,
        respectRobots: true
      }
    });

    // Shutterstock profile
    this.builtInProfiles.set('shutterstock', {
      id: 'shutterstock',
      name: 'Shutterstock',
      domains: ['shutterstock.com'],
      selectors: {
        gallery: '[data-automation="AssetGrid-container"] > div',
        thumbnail: 'img[data-automation="asset-thumb"]',
        fullSize: 'meta[property="og:image"]',
        title: '[data-automation="asset-title"]',
        link: 'a[data-automation="asset-link"]',
        pagination: '[data-automation="pagination-next"]'
      },
      settings: {
        waitTime: 1500,
        maxScrollAttempts: 15,
        useInfiniteScroll: true,
        respectRobots: true
      }
    });

    // Unsplash profile
    this.builtInProfiles.set('unsplash', {
      id: 'unsplash',
      name: 'Unsplash',
      domains: ['unsplash.com'],
      selectors: {
        gallery: '[data-testid="photos-route"] figure',
        thumbnail: 'img[srcset]',
        fullSize: 'img[srcset]',
        title: 'img[alt]',
        link: 'a[title]',
        pagination: 'button[data-testid="load-more-button"]'
      },
      settings: {
        waitTime: 1000,
        maxScrollAttempts: 20,
        useInfiniteScroll: true,
        respectRobots: false
      }
    });

    // IMAGO Images profile
    this.builtInProfiles.set('imago', {
      id: 'imago',
      name: 'IMAGO Images',
      domains: ['imago-images.com', 'imago-images.de'],
      selectors: {
        // Generic gallery item selectors as fallback
        gallery: 'img, picture img',
        thumbnail: 'img',
        fullSize: 'meta[property="og:image"], img[src]'
        ,
        title: 'img[alt]',
        link: 'a[href]'
        ,
        // Pagination specifics
        // Try common patterns used across the site and SPA routers
        pagination: [
          'a[rel="next"]',
          'link[rel="next"]',
          'nav .pagination a.next',
          '.pagination a[rel="next"]',
          'button[aria-label*="Next" i]',
          'button[aria-label*="Weiter" i]',
          'a[aria-label*="Next" i]',
          'a[aria-label*="Weiter" i]',
          'button:has(svg[aria-label*="next" i])',
          'button:has([data-icon*="chevron-right"])',
          'a:has([data-icon*="chevron-right"])'
        ].join(', ')
      },
      settings: {
        waitTime: 1500,
        maxScrollAttempts: 12,
        useInfiniteScroll: true,
        respectRobots: true
      }
    });

    if (!this.PRODUCTION) console.log(`📁 Initialized ${this.builtInProfiles.size} built-in site profiles`);
  }

  async loadCustomProfiles() {
    try {
      const stored = await chrome.storage.local.get('customSiteProfiles');
      if (stored.customSiteProfiles) {
        for (const [id, profile] of Object.entries(stored.customSiteProfiles)) {
          this.customProfiles.set(id, profile);
        }
        if (!this.PRODUCTION) console.log(`📁 Loaded ${this.customProfiles.size} custom site profiles`);
      }
    } catch (error) {
      console.error('Failed to load custom profiles:', error);
    }
  }

  async saveCustomProfiles() {
    try {
      const profilesObj = {};
      for (const [id, profile] of this.customProfiles) {
        profilesObj[id] = profile;
      }
      await chrome.storage.local.set({ customSiteProfiles: profilesObj });
      if (!this.PRODUCTION) console.log('💾 Custom profiles saved');
    } catch (error) {
      console.error('Failed to save custom profiles:', error);
      throw error;
    }
  }

  detectSiteProfile(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // Check built-in profiles first
      for (const profile of this.builtInProfiles.values()) {
        if (profile.domains.some(d => domain.includes(d))) {
          if (!this.PRODUCTION) console.log(`🔍 Detected site profile: ${profile.name} for ${domain}`);
          return profile;
        }
      }

      // Check custom profiles
      for (const profile of this.customProfiles.values()) {
        if (profile.domains?.some(d => domain.includes(d))) {
          if (!this.PRODUCTION) console.log(`🔍 Detected custom profile: ${profile.name} for ${domain}`);
          return profile;
        }
      }

      if (!this.PRODUCTION) console.log(`❓ No site profile found for ${domain}`);
      return null;
    } catch (error) {
      console.warn('Error detecting site profile:', error);
      return null;
    }
  }

  getProfile(profileId) {
    return this.builtInProfiles.get(profileId) ||
           this.customProfiles.get(profileId);
  }

  getAllProfiles() {
    const profiles = [];

    // Add built-in profiles
    for (const profile of this.builtInProfiles.values()) {
      profiles.push({ ...profile, type: 'built-in' });
    }

    // Add custom profiles
    for (const profile of this.customProfiles.values()) {
      profiles.push({ ...profile, type: 'custom' });
    }

    return profiles;
  }

  // Get profile statistics
  getStats() {
    return {
      builtIn: this.builtInProfiles.size,
      custom: this.customProfiles.size,
      total: this.builtInProfiles.size + this.customProfiles.size,
      lastUpdate: this.lastUpdateCheck
    };
  }
}

// =============================================================================
// CONSOLIDATED BACKGROUND MANAGER
// =============================================================================

// Create unified background manager
const ConsolidatedBackgroundManager = {
  // Component instances
  downloadManager: null,
  messageHandler: null,
  downloadQueue: null,
  batchManager: null,
  memoryProcessor: null,
  siteProfileManager: null,
  exportSystem: null,
  
  // Initialize all components
  initializeAll: function(options = {}) {
    if (!this.PRODUCTION) console.log('🚀 Initializing Consolidated Background Manager...');
    
    try {
      this.downloadManager = new SimpleDownloadManager(options.download || {});
      this.messageHandler = SimpleMessageHandler.getInstance();
      this.downloadQueue = new StepThreeDownloadQueue(options.queue || {});
      this.batchManager = new BatchOperationsManager(options.batch || {});
      this.memoryProcessor = new MemoryOptimizedProcessor(options.memory || {});
      this.siteProfileManager = new SiteProfileManager(options.profiles || {});
      
      // Initialize export system first
      this.exportSystem = new AdvancedExportSystem(options.export || {});
      
      // Initialize message handler with download manager and export system
      this.messageHandler.initialize(this.downloadManager, this.exportSystem);
      
      if (!this.PRODUCTION) console.log('✅ All consolidated background components initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize consolidated background components:', error);
      
      const enhancedError = new Error(`[Consolidated Background Initialization] ${getErrorMessage(error)}`);
      enhancedError.originalError = error;
      enhancedError.context = 'initializeAll';
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  },
  
  // Get combined metrics
  getMetrics: function() {
    return {
      download: this.downloadManager?.getStats(),
      queue: this.downloadQueue?.getStats(),
      batch: this.batchManager?.getActiveBatches(),
      memory: this.memoryProcessor?.getStats(),
      profiles: this.siteProfileManager?.getStats(),
      timestamp: Date.now()
    };
  }
};// background-utilities.js - Consolidated utility functions for STEPTHREE V2 background scripts
// Combines utils.js, filename-mask.js, and keyboard-shortcuts.js to reduce file count

// =============================================================================
// COMMON UTILITIES (from utils.js)
// =============================================================================

class StepThreeUtils {
  // URL validation and parsing
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  static getFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.split('.').pop().toLowerCase();
      return ext && ext.length <= 4 ? ext : '';
    } catch {
      return '';
    }
  }

  // Enhanced URL normalization
  static normalizeUrl(url, options = {}) {
    if (!url || typeof url !== 'string') {return null;}

    try {
      // Clean the URL
      let cleanUrl = url.trim().replace(/^['"]|['"]$/g, '');

      // Handle data URLs
      if (cleanUrl.startsWith('data:')) {
        return options.allowDataUrls !== false ? cleanUrl : null;
      }

      // Handle protocol-relative URLs
      if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
      }

      // Handle relative URLs - need base URL for background scripts
      if (!cleanUrl.match(/^https?:/)) {
        return null; // Can't resolve relative URLs in background context
      }

      const urlObj = new URL(cleanUrl);

      // Normalize protocol to HTTPS if requested
      if (options.forceHttps && urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:';
      }

      // Handle query parameters
      if (options.removeQueryParams) {
        urlObj.search = '';
      }

      // Handle fragments
      if (options.removeFragment) {
        urlObj.hash = '';
      }

      return urlObj.href;
    } catch {
      return null;
    }
  }

  // Image validation
  static isImageUrl(url) {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
    const ext = this.getFileExtension(url);
    return imageExts.includes(ext);
  }

  static isValidImageSize(width, height, minWidth = 0, minHeight = 0) {
    const w = parseInt(width) || 0;
    const h = parseInt(height) || 0;
    return w >= minWidth && h >= minHeight;
  }

  // Filter utilities
  static createDefaultFilters() {
    return {
      minWidth: 0,
      minHeight: 0,
      maxSize: 0, // 0 means no limit
      allowedTypes: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
      skipDuplicates: false,
      maxResults: 1000
    };
  }

  // Version comparison utility
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) {return -1;}
      if (part1 > part2) {return 1;}
    }

    return 0;
  }
}

// =============================================================================
// FILENAME MASK UTILITIES (from filename-mask.js)
// =============================================================================

let globalCounter = 0;
let siteCounters = {};
let sessionCounters = {};

/**
 * Safely extract error message from any error type
 * @param {*} error - Error object, string, or any value
 * @returns {string} Safe error message string
 */
function getErrorMessage(error) {
  if (!error) {
    return 'Unknown error occurred';
  }
  if (error instanceof Error) {
    return error.message || 'Error occurred';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error.message) {
    return String(error.message);
  }
  return String(error);
}

function sanitizeFilename(name) {
  // Remove or replace invalid characters for file names
  // Avoid regex control character warnings by using a safer approach
  const invalidChars = /[<>:"/\\|?*]/g;

  return name.replace(invalidChars, '_')
    .replace(/[^\x20-\x7E]/g, '_') // Non-printable ASCII characters
    .replace(/\.$/, '_')  // Remove trailing dot
    .slice(0, 255);       // Limit length
}

function extractDomain(host) {
  if (!host) {return '';}
  return host.split('.').slice(-2).join('.');
}

function parseSubdirs(url) {
  try {
    const pathname = new URL(url).pathname;
    const dirs = pathname.split('/').filter(Boolean);
    return dirs.slice(0, -1).join('_'); // Exclude filename
  } catch {
    return '';
  }
}

function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      path: urlObj.pathname,
      query: urlObj.search.slice(1), // Remove '?'
      hash: urlObj.hash.slice(1)     // Remove '#'
    };
  } catch {
    return { path: '', query: '', hash: '' };
  }
}

function applyMask(mask, ctx) {
  if (!mask) {return ctx.name + (ctx.ext ? `.${ctx.ext}` : '');}

  const now = new Date();
  const dateStr = now.toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  const timeStr = now.toTimeString().slice(0,8).replace(/:/g,''); // HHMMSS
  const timestamp = now.getTime().toString();

  // Get appropriate counter
  const siteKey = ctx.host || 'global';
  if (!siteCounters[siteKey]) {siteCounters[siteKey] = 0;}
  if (!sessionCounters[siteKey]) {sessionCounters[siteKey] = 0;}

  const counter = ctx.num || ++siteCounters[siteKey];
  const sessionCounter = ++sessionCounters[siteKey];
  globalCounter = Math.max(globalCounter, counter);

  let out = mask;
  const replace = (token, value) => {
    out = out.replace(new RegExp(`\\*${token}\\*`,'gi'), sanitizeFilename(String(value || '')));
  };

  // Core tokens
  replace('name', ctx.name || 'untitled');
  replace('num', String(counter).padStart(3,'0'));
  replace('ext', ctx.ext || '');
  replace('date', dateStr);
  replace('time', timeStr);
  replace('timestamp', timestamp);
  replace('host', ctx.host || '');
  replace('domain', extractDomain(ctx.host || ctx.url || ''));
  replace('subdirs', parseSubdirs(ctx.subdirs || ctx.url || ''));

  // Enhanced URL parsing tokens
  if (ctx.url) {
    const urlParts = parseUrl(ctx.url);
    replace('url', ctx.url);
    replace('path', urlParts.path);
    replace('query', urlParts.query);
    replace('hash', urlParts.hash);
  } else {
    replace('url', '');
    replace('path', '');
    replace('query', '');
    replace('hash', '');
  }

  // Additional context tokens
  replace('caption', ctx.caption || '');
  replace('id', ctx.id || '');
  replace('resolution', ctx.resolution || '');
  replace('size', ctx.size || '');
  replace('type', ctx.type || '');
  replace('index', ctx.index || counter);
  replace('session', sessionCounter);
  replace('global', globalCounter);

  // Process *segment[n]* tags
  out = out.replace(/\*segment\[(\d+)\]\*/gi, (match, segmentIndex) => {
    const index = parseInt(segmentIndex, 10);
    if (ctx.url) {
      try {
        const urlObj = new URL(ctx.url);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        const segment = pathSegments[index - 1] || '';
        return sanitizeFilename(segment);
      } catch {
        return '';
      }
    }
    return '';
  });

  return out;
}

function resetCounters() {
  globalCounter = 0;
  siteCounters = {};
  sessionCounters = {};
}

function getCounterStats() {
  return {
    global: globalCounter,
    sites: Object.keys(siteCounters).length,
    session: Object.keys(sessionCounters).length
  };
}

// =============================================================================
// KEYBOARD SHORTCUTS (from keyboard-shortcuts.js)
// =============================================================================

class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.setupShortcuts();
  }

  setupShortcuts() {
    // Register available commands
    this.shortcuts.set('start-scraper', {
      action: 'startScraper',
      description: 'Start gallery scraper'
    });

    this.shortcuts.set('toggle-selector', {
      action: 'toggleSelector',
      description: 'Toggle selector mode'
    });

    this.shortcuts.set('open-dashboard', {
      action: 'openDashboard',
      description: 'Open dashboard'
    });

    if (!this.PRODUCTION) console.log('Keyboard shortcuts initialized:', Array.from(this.shortcuts.keys()));
  }

  async handleCommand(command, tab) {
    try {
      if (!this.PRODUCTION) console.log('Keyboard shortcut triggered:', command);

      const shortcut = this.shortcuts.get(command);
      if (!shortcut) {
        console.warn('Unknown keyboard shortcut:', command);
        return;
      }

      switch (shortcut.action) {
      case 'startScraper':
        await this.handleStartScraper(tab);
        break;

      case 'toggleSelector':
        await this.handleToggleSelector(tab);
        break;

      case 'openDashboard':
        await this.handleOpenDashboard(tab);
        break;

      default:
        console.warn('Unhandled shortcut action:', shortcut.action);
      }
    } catch (error) {
      console.error('Error handling keyboard shortcut:', error);
    }
  }

  async handleStartScraper(_tab) {
    try {
      // Inject scraper and start scraping
      await chrome.tabs.sendMessage(_tab.id, {
        action: 'startScraping',
        source: 'keyboard_shortcut'
      });

      // Show notification
      chrome.notifications.create('scraper-started', {
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'STEPTHREE V2',
        message: 'Scraper started via keyboard shortcut'
      });
    } catch (error) {
      console.error('Error starting scraper via shortcut:', error);
    }
  }

  async handleToggleSelector(tab) {
    try {
      // Toggle element selector mode
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleSelector',
        source: 'keyboard_shortcut'
      });
    } catch (error) {
      console.error('Error toggling selector via shortcut:', error);
    }
  }

  async handleOpenDashboard(_tab) {
    try {
      // Open dashboard in new tab
      await chrome.tabs.create({
        url: chrome.runtime.getURL('ui/windowed-dashboard.html'),
        active: true
      });
    } catch (error) {
      console.error('Error opening dashboard via shortcut:', error);
    }
  }

  // Get all registered shortcuts
  getShortcuts() {
    return Array.from(this.shortcuts.entries()).map(([command, data]) => ({
      command,
      action: data.action,
      description: data.description
    }));
  }
}

// =============================================================================
// CONTEXT MENU MANAGER (from context-menu-manager.js)
// =============================================================================

class ContextMenuManager {
  // Static properties for singleton pattern to prevent duplicate menu creation
  static _initializationPromise = null;
  static _isInitialized = false;
  static _listenerRegistered = false;

  constructor() {
    this.menuItems = new Map();
    this.isInitialized = false;

    // CR-002: Store listener reference for cleanup
    this.menuClickListener = null;
  }

  async setupContextMenus() {
    try {
      // Check static _isInitialized flag first (not instance flag)
      if (ContextMenuManager._isInitialized) {
        if (!this.PRODUCTION) console.log('⚠️ Context menus already initialized globally, skipping');
        return;
      }

      // If initialization in progress, await it and return
      if (ContextMenuManager._initializationPromise) {
        if (!this.PRODUCTION) console.log('⏳ Context menu initialization already in progress, waiting...');
        await ContextMenuManager._initializationPromise;
        return;
      }

      // Create new _initializationPromise and call _performSetup()
      if (!this.PRODUCTION) console.log('🔧 Starting context menu initialization...');
      ContextMenuManager._initializationPromise = this._performSetup();
      await ContextMenuManager._initializationPromise;
      
    } catch (error) {
      console.error('❌ Failed to setup context menus:', error);
      ContextMenuManager._initializationPromise = null;
    }
  }

  async _performSetup() {
    try {
      // Check if chrome.contextMenus API is available
      if (!chrome.contextMenus) {
        console.warn('Context menus API not available');
        return;
      }

      // Call await chrome.contextMenus.removeAll()
      await chrome.contextMenus.removeAll();
      
      // Check chrome.runtime.lastError after removeAll
      if (chrome.runtime.lastError) {
        console.warn('Error removing existing menus:', chrome.runtime.lastError);
      }

      // Main menu items (keep existing menu item definitions)
      const menuItems = [
        {
          id: 'stepthree-scan-page',
          title: 'Scan page for images',
          contexts: ['page'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'stepthree-separator-1',
          type: 'separator',
          contexts: ['page']
        },
        {
          id: 'stepthree-add-image',
          title: 'Add to queue',
          contexts: ['image'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'stepthree-add-all-images',
          title: 'Add all images',
          contexts: ['page'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'stepthree-separator-2',
          type: 'separator',
          contexts: ['page', 'image']
        },
        {
          id: 'stepthree-open-dashboard',
          title: 'Open dashboard',
          contexts: ['page', 'image'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        },
        {
          id: 'stepthree-separator-3',
          type: 'separator',
          contexts: ['page', 'image']
        },
        {
          id: 'stepthree-options',
          title: 'Options',
          contexts: ['page', 'image'],
          documentUrlPatterns: ['http://*/*', 'https://*/*']
        }
      ];

      // Create all menu items
      for (const item of menuItems) {
        await this.createMenuItem(item);
      }

      // Register onClicked listener only if not already registered (use static _listenerRegistered flag)
      if (!ContextMenuManager._listenerRegistered) {
        // CR-002: Store bound listener reference maintaining proper 'this' context
        this.menuClickListener = (info, tab) => {
          this.handleMenuClick(info, tab);
        };
        
        chrome.contextMenus.onClicked.addListener(this.menuClickListener);
        ContextMenuManager._listenerRegistered = true;
        if (!this.PRODUCTION) console.log('✅ Context menu listener registered');
      }

      // Set static _isInitialized = true at the end
      ContextMenuManager._isInitialized = true;
      this.isInitialized = true;
      if (!this.PRODUCTION) console.log('✅ Context menus initialized successfully');
      
    } catch (error) {
      console.error('❌ Error in _performSetup:', error);
      throw error;
    }
  }

  async createMenuItem(item) {
    try {
      chrome.contextMenus.create(item);
      
      // Check and log chrome.runtime.lastError after calling chrome.contextMenus.create()
      if (chrome.runtime.lastError) {
        console.error(`Error creating menu item ${item.id}:`, chrome.runtime.lastError);
      } else {
        this.menuItems.set(item.id, item);
      }
    } catch (error) {
      console.error(`Failed to create menu item ${item.id}:`, error);
    }
  }

  async handleMenuClick(info, tab) {
    try {
      if (!this.PRODUCTION) console.log('Context menu clicked:', info.menuItemId, info);

      switch (info.menuItemId) {
      case 'stepthree-scan-page':
        await this.handleScanPage(tab);
        break;

      case 'stepthree-add-image':
        await this.handleAddImage(info, tab);
        break;

      case 'stepthree-add-all-images':
        await this.handleAddAllImages(tab);
        break;

      case 'stepthree-open-dashboard':
        await this.handleOpenDashboard();
        break;

      case 'stepthree-options':
        await this.handleOpenOptions();
        break;

      default:
        console.warn('Unknown context menu item:', info.menuItemId);
      }
    } catch (error) {
      console.error('Context menu action failed:', error);
    }
  }

  async handleScanPage(tab) {
    try {
      // Inject content script and start scanning
      await chrome.tabs.sendMessage(tab.id, {
        action: 'startScraping',
        source: 'context_menu'
      });

      // Show notification
      chrome.notifications.create('scan-started', {
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'STEPTHREE V2',
        message: 'Page scanning started'
      });
    } catch (error) {
      console.error('Failed to scan page:', error);
    }
  }

  async handleAddImage(info, tab) {
    try {
      if (info.srcUrl) {
        // Add single image to queue
        await chrome.tabs.sendMessage(tab.id, {
          action: 'addImageToQueue',
          imageUrl: info.srcUrl,
          source: 'context_menu'
        });

        chrome.notifications.create('image-added', {
          type: 'basic',
          iconUrl: 'icons/48.png',
          title: 'STEPTHREE V2',
          message: 'Image added to queue'
        });
      }
    } catch (error) {
      console.error('Failed to add image:', error);
    }
  }

  async handleAddAllImages(tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'addAllImages',
        source: 'context_menu'
      });

      chrome.notifications.create('all-images-added', {
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'STEPTHREE V2',
        message: 'All images added to queue'
      });
    } catch (error) {
      console.error('Failed to add all images:', error);
    }
  }

  async handleOpenDashboard() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('ui/windowed-dashboard.html'),
        active: true
      });
    } catch (error) {
      console.error('Failed to open dashboard:', error);
    }
  }

  async handleOpenOptions() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('ui/options.html'),
        active: true
      });
    } catch (error) {
      console.error('Failed to open options:', error);
    }
  }

  getMenuItems() {
    return Array.from(this.menuItems.values());
  }

  isReady() {
    return this.isInitialized;
  }

  // CR-002: Cleanup method to remove event listener
  cleanup() {
    if (this.menuClickListener && chrome.contextMenus && chrome.contextMenus.onClicked) {
      try {
        chrome.contextMenus.onClicked.removeListener(this.menuClickListener);
        this.menuClickListener = null;
        this.isInitialized = false;
        if (!this.PRODUCTION) console.log('✅ Context menu listener cleaned up');
      } catch (error) {
        console.error('Failed to remove context menu listener:', error);
      }
    }
  }
}

// =============================================================================
// UPDATED EXPORTS FOR BOTH ES MODULES AND IMPORTSCRIPTS
// =============================================================================

// Support both ES modules and legacy importScripts
if (typeof self !== 'undefined') {
  // Service Worker/importScripts environment
  self.StepThreeUtils = StepThreeUtils;
  self.applyMask = applyMask;
  self.resetCounters = resetCounters;
  self.getCounterStats = getCounterStats;
  self.KeyboardShortcuts = KeyboardShortcuts;
  self.ContextMenuManager = ContextMenuManager;
}

// ES modules export (commented out for importScripts compatibility)
// export { StepThreeUtils, applyMask, resetCounters, getCounterStats, KeyboardShortcuts };
// enhanced-error-handling.js - 5-Layer Fallback Error Handling System for STEPTHREE
// Implements bulletproof image fetching with comprehensive recovery mechanisms
// Enterprise-grade reliability with intelligent error classification and recovery

if (!this.PRODUCTION) console.log('🛡️ Loading Enhanced Error Handling System...');

/**
 * Enhanced Error Handling System
 * Implements 5-layer fallback mechanisms with comprehensive error recovery
 */
class EnhancedErrorHandling {
  constructor(options = {}) {
    this.options = {
      // Fallback system configuration
      enableLayer1DirectFetch: options.enableLayer1DirectFetch !== false,
      enableLayer2CORSWorkaround: options.enableLayer2CORSWorkaround !== false,
      enableLayer3CredentialedFetch: options.enableLayer3CredentialedFetch !== false,
      enableLayer4CanvasCapture: options.enableLayer4CanvasCapture !== false,
      enableLayer5ProxyFetch: options.enableLayer5ProxyFetch !== false,
      
      // Timeout configuration (exponential backoff)
      layer1Timeout: options.layer1Timeout || 5000,
      layer2Timeout: options.layer2Timeout || 8000,
      layer3Timeout: options.layer3Timeout || 12000,
      layer4Timeout: options.layer4Timeout || 15000,
      layer5Timeout: options.layer5Timeout || 20000,
      
      // Retry configuration
      maxRetryAttempts: options.maxRetryAttempts || 3,
      retryDelayBase: options.retryDelayBase || 1000,
      retryDelayMax: options.retryDelayMax || 10000,
      
      // Concurrency limits
      maxConcurrentRequests: options.maxConcurrentRequests || 5,
      batchSize: options.batchSize || 10,
      batchDelay: options.batchDelay || 100,
      
      // Circuit breaker configuration
      circuitBreakerThreshold: options.circuitBreakerThreshold || 10,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      
      // Memory management
      memoryThreshold: options.memoryThreshold || 200 * 1024 * 1024, // 200MB
      enableMemoryManagement: options.enableMemoryManagement !== false,
      garbageCollectionInterval: options.garbageCollectionInterval || 30000,
      
      // User notifications
      enableProgressTracking: options.enableProgressTracking !== false,
      enableUserNotifications: options.enableUserNotifications !== false,
      enableDetailedLogging: options.enableDetailedLogging !== false,
      
      // Proxy configuration
      proxyServices: options.proxyServices || [
        'https://api.allorigins.win/get?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://api.codetabs.com/v1/proxy?quest='
      ],
      
      ...options
    };

    // Error classification system
    this.errorClassifier = {
      network: ['NetworkError', 'TypeError', 'Failed to fetch', 'ERR_NETWORK'],
      timeout: ['TimeoutError', 'Request timeout', 'ERR_TIMED_OUT'],
      cors: ['CORS', 'Cross-Origin', 'ERR_BLOCKED_BY_CLIENT'],
      permission: ['ERR_BLOCKED_BY_RESPONSE', '403', '401', 'Forbidden'],
      rateLimit: ['429', 'Too Many Requests', 'Rate limit'],
      server: ['500', '502', '503', '504', 'Internal Server Error'],
      notFound: ['404', 'Not Found', 'ERR_FILE_NOT_FOUND'],
      format: ['Invalid image', 'Unsupported format', 'Corrupted'],
      memory: ['Out of memory', 'Memory limit', 'ERR_INSUFFICIENT_RESOURCES']
    };

    // State management
    this.activeRequests = new Map();
    this.requestQueue = [];
    this.completedRequests = new Map();
    this.failedRequests = new Map();
    this.circuitBreakers = new Map();
    
    // Performance tracking
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      layerUsageStats: {
        layer1: { attempts: 0, successes: 0, failures: 0 },
        layer2: { attempts: 0, successes: 0, failures: 0 },
        layer3: { attempts: 0, successes: 0, failures: 0 },
        layer4: { attempts: 0, successes: 0, failures: 0 },
        layer5: { attempts: 0, successes: 0, failures: 0 }
      },
      errorTypes: {},
      averageProcessingTime: 0,
      memoryUsage: 0,
      concurrencyUtilization: 0
    };

    // Progress tracking for UI integration
    this.progressCallbacks = new Set();
    this.errorReportCallbacks = new Set();
    
    // Memory management
    this.memoryWatcher = null;
    this.lastMemoryCheck = Date.now();
    
    // Initialize systems
    this.initializeErrorHandling();
    this.startMemoryManagement();
    
    if (!this.PRODUCTION) console.log('✅ Enhanced Error Handling System initialized with 5-layer fallback');
  }

  // =============================================================================
  // MAIN ENTRY POINT - ENHANCED IMAGE FETCHING
  // =============================================================================

  /**
   * Enhanced fetch with 5-layer fallback system
   * @param {string} url - Image URL to fetch
   * @param {Object} options - Fetch options and metadata
   * @returns {Promise<Object>} - Result with data or error information
   */
  async enhancedFetch(url, options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
      }

      // Check circuit breaker
      if (this.isCircuitBreakerOpen(url)) {
        throw new Error(`Circuit breaker open for ${this.getDomainFromUrl(url)}`);
      }

      // Initialize request tracking
      this.activeRequests.set(requestId, {
        url,
        startTime,
        attempts: 0,
        currentLayer: 1,
        errors: []
      });

      this.metrics.totalRequests++;
      this.updateProgress(requestId, 0, 'Starting enhanced fetch...');

      // Execute 5-layer fallback system
      const result = await this.executeFallbackLayers(url, options, requestId);
      
      // Success - update metrics and cleanup
      this.metrics.successfulRequests++;
      this.completedRequests.set(requestId, result);
      this.activeRequests.delete(requestId);
      
      const processingTime = Date.now() - startTime;
      this.updateProcessingTimeMetrics(processingTime);
      
      this.updateProgress(requestId, 100, 'Fetch completed successfully');
      
      return {
        success: true,
        requestId,
        data: result.data,
        layer: result.layer,
        processingTime,
        attempts: result.attempts,
        metadata: result.metadata
      };

    } catch (error) {
      // Failure - update metrics and error tracking
      this.metrics.failedRequests++;
      this.updateErrorMetrics(error);
      
      const requestData = this.activeRequests.get(requestId);
      this.failedRequests.set(requestId, {
        url,
        error: error.message,
        attempts: requestData?.attempts || 0,
        processingTime: Date.now() - startTime,
        errors: requestData?.errors || []
      });
      
      this.activeRequests.delete(requestId);
      this.updateCircuitBreaker(url, false);
      
      this.updateProgress(requestId, 100, `Fetch failed: ${this.getUserFriendlyError(error.message)}`);
      
      return {
        success: false,
        requestId,
        error: error.message,
        errorType: this.classifyError(error.message),
        processingTime: Date.now() - startTime,
        attempts: requestData?.attempts || 0,
        suggestions: this.getErrorSuggestions(error.message)
      };
    }
  }

  /**
   * Execute all 5 fallback layers in sequence
   */
  async executeFallbackLayers(url, options, requestId) {
    const layers = [
      { name: 'layer1', method: 'directFetch', enabled: this.options.enableLayer1DirectFetch },
      { name: 'layer2', method: 'corsWorkaround', enabled: this.options.enableLayer2CORSWorkaround },
      { name: 'layer3', method: 'credentialedFetch', enabled: this.options.enableLayer3CredentialedFetch },
      { name: 'layer4', method: 'canvasCapture', enabled: this.options.enableLayer4CanvasCapture },
      { name: 'layer5', method: 'proxyFetch', enabled: this.options.enableLayer5ProxyFetch }
    ];

    const requestData = this.activeRequests.get(requestId);
    let lastError = null;

    for (const layer of layers) {
      if (!layer.enabled) {
        if (!this.PRODUCTION) console.log(`⏭️ Layer ${layer.name} disabled, skipping...`);
        continue;
      }

      try {
        requestData.currentLayer = parseInt(layer.name.replace('layer', ''));
        requestData.attempts++;
        
        this.metrics.layerUsageStats[layer.name].attempts++;
        
        this.updateProgress(requestId, 
          (requestData.currentLayer - 1) * 20, 
          `Attempting ${layer.name}: ${layer.method}`);

        if (!this.PRODUCTION) console.log(`🔄 Executing ${layer.name}: ${layer.method} for ${url}`);
        
        const result = await this[layer.method](url, options, requestId);
        
        // Success!
        this.metrics.layerUsageStats[layer.name].successes++;
        this.updateCircuitBreaker(url, true);
        
        return {
          data: result,
          layer: layer.name,
          attempts: requestData.attempts,
          metadata: {
            method: layer.method,
            finalLayer: layer.name,
            totalLayers: layers.length
          }
        };

      } catch (error) {
        lastError = error;
        this.metrics.layerUsageStats[layer.name].failures++;
        requestData.errors.push({
          layer: layer.name,
          method: layer.method,
          error: error.message,
          timestamp: Date.now()
        });

        console.warn(`❌ ${layer.name} failed:`, error.message);
        
        // Add retry logic for transient errors
        if (this.isTransientError(error.message) && requestData.attempts < this.options.maxRetryAttempts) {
          const retryDelay = this.calculateRetryDelay(requestData.attempts);
          if (!this.PRODUCTION) console.log(`🔄 Retrying ${layer.name} in ${retryDelay}ms...`);
          
          await this.delay(retryDelay);
          // Don't increment layer, retry same layer
          requestData.attempts++;
          continue;
        }
      }
    }

    // All layers failed
    throw new Error(`All fallback layers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  // =============================================================================
  // LAYER 1 - DIRECT FETCH
  // =============================================================================

  /**
   * Layer 1: Standard fetch with proper headers
   */
  async directFetch(url, options, requestId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.layer1Timeout);

    try {
      const fetchOptions = {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': window.location.href,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...options.headers
        },
        ...options.fetchOptions
      };

      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !this.isValidImageContentType(contentType)) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const blob = await response.blob();
      
      // Validate blob
      if (blob.size < 100) {
        throw new Error('Image too small, likely corrupted');
      }

      return blob;

    } finally {
      clearTimeout(timeout);
    }
  }

  // =============================================================================
  // LAYER 2 - CORS WORKAROUND
  // =============================================================================

  /**
   * Layer 2: CORS workaround with alternative headers and no-cors mode
   */
  async corsWorkaround(url, options, requestId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.layer2Timeout);

    try {
      // Try no-cors mode first
      const noCorsOptions = {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          ...options.headers
        }
      };

      const response = await fetch(url, noCorsOptions);
      
      // In no-cors mode, we can't check response status, so try to get blob
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('No-cors fetch returned empty response');
      }

      return blob;

    } catch (error) {
      // Try alternative headers approach
      const altHeadersOptions = {
        method: 'GET',
        signal: controller.signal,
        credentials: 'omit',
        headers: {
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          ...options.headers
        }
      };

      const response = await fetch(url, altHeadersOptions);
      
      if (!response.ok) {
        throw new Error(`Alternative headers failed: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      return blob;

    } finally {
      clearTimeout(timeout);
    }
  }

  // =============================================================================
  // LAYER 3 - CREDENTIALED FETCH
  // =============================================================================

  /**
   * Layer 3: Include credentials and try alternative origins
   */
  async credentialedFetch(url, options, requestId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.layer3Timeout);

    try {
      // Try with credentials included
      const credentialedOptions = {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Accept': 'image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': this.getAlternativeReferer(url),
          'Origin': this.getAlternativeOrigin(url),
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers
        }
      };

      const response = await fetch(url, credentialedOptions);
      
      if (!response.ok) {
        throw new Error(`Credentialed fetch failed: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      return blob;

    } finally {
      clearTimeout(timeout);
    }
  }

  // =============================================================================
  // LAYER 4 - CANVAS CAPTURE
  // =============================================================================

  /**
   * Layer 4: Render image in canvas and extract as blob
   */
  async canvasCapture(url, options, requestId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Canvas capture timeout'));
      }, this.options.layer4Timeout);

      try {
        const img = new Image();
        
        // Set up cross-origin handling
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            clearTimeout(timeout);
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            
            // Draw image to canvas
            ctx.drawImage(img, 0, 0);
            
            // Extract as blob
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Canvas toBlob failed'));
              }
            }, 'image/png', 0.9);
            
          } catch (error) {
            clearTimeout(timeout);
            reject(new Error(`Canvas processing failed: ${error.message}`));
          }
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Image failed to load for canvas capture'));
        };
        
        // Start loading
        img.src = url;
        
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Canvas capture setup failed: ${error.message}`));
      }
    });
  }

  // =============================================================================
  // LAYER 5 - PROXY FETCH
  // =============================================================================

  /**
   * Layer 5: Use proxy service for final attempt
   */
  async proxyFetch(url, options, requestId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.layer5Timeout);

    try {
      let lastError = null;
      
      // Try each proxy service
      for (const proxyService of this.options.proxyServices) {
        try {
          const proxyUrl = `${proxyService}${encodeURIComponent(url)}`;
          
          const response = await fetch(proxyUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Accept': 'application/json,text/plain,*/*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Proxy service failed: HTTP ${response.status}`);
          }
          
          // Handle different proxy response formats
          const result = await this.handleProxyResponse(response, proxyService);
          return result;
          
        } catch (error) {
          lastError = error;
          console.warn(`⚠️ Proxy service ${proxyService} failed:`, error.message);
          continue;
        }
      }
      
      throw new Error(`All proxy services failed. Last error: ${lastError?.message}`);
      
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Handle different proxy service response formats
   */
  async handleProxyResponse(response, proxyService) {
    const contentType = response.headers.get('content-type') || '';
    
    // If it's already an image, return blob
    if (contentType.startsWith('image/')) {
      return await response.blob();
    }
    
    // Handle JSON response (common for CORS proxies)
    if (contentType.includes('application/json')) {
      const data = await response.json();
      
      // Different proxy services have different response formats
      let imageData = null;
      if (data.contents) {
        imageData = data.contents; // allorigins format
      } else if (data.data) {
        imageData = data.data;
      } else if (typeof data === 'string') {
        imageData = data;
      }
      
      if (imageData) {
        // Convert base64 or binary data to blob
        return this.convertDataToBlob(imageData);
      }
    }
    
    // Fallback: try to get as blob
    return await response.blob();
  }

  /**
   * Convert various data formats to blob
   */
  convertDataToBlob(data) {
    try {
      // Try base64 conversion
      if (typeof data === 'string' && data.startsWith('data:image/')) {
        const [header, base64] = data.split(',');
        const mimeType = header.match(/data:([^;]+)/)[1];
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
      }
      
      // Try direct blob conversion
      return new Blob([data], { type: 'image/png' });
      
    } catch (error) {
      throw new Error(`Data conversion failed: ${error.message}`);
    }
  }

  // =============================================================================
  // ERROR CLASSIFICATION AND RECOVERY
  // =============================================================================

  /**
   * Classify error type for appropriate handling
   */
  classifyError(errorMessage) {
    const message = errorMessage.toLowerCase();
    
    for (const [category, patterns] of Object.entries(this.errorClassifier)) {
      for (const pattern of patterns) {
        if (message.includes(pattern.toLowerCase())) {
          return category;
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * Check if error is transient and worth retrying
   */
  isTransientError(errorMessage) {
    const transientPatterns = [
      'timeout', 'network', 'temporary', 'try again',
      'rate limit', '429', '502', '503', '504'
    ];
    
    const message = errorMessage.toLowerCase();
    return transientPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attemptNumber) {
    const delay = this.options.retryDelayBase * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 1000; // Add jitter to avoid thundering herd
    return Math.min(delay + jitter, this.options.retryDelayMax);
  }

  /**
   * Get user-friendly error suggestions based on error type
   * Provides actionable recommendations to help users resolve common issues
   * 
   * @param {string} errorMessage - The error message to analyze
   * @returns {string[]} Array of user-friendly suggestion strings
   */
  getErrorSuggestions(errorMessage) {
    const errorType = this.classifyError(errorMessage);
    
    const suggestions = {
      network: [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again'
      ],
      cors: [
        'The website may be blocking external requests',
        'Try using a different browser or incognito mode',
        'Some images may require being logged into the website'
      ],
      permission: [
        'You may need to log into the website first',
        'The website may be restricting access to images',
        'Try accessing the page directly before scraping'
      ],
      rateLimit: [
        'The website is limiting requests',
        'Wait a few minutes before trying again',
        'Reduce the number of concurrent downloads'
      ],
      timeout: [
        'The image is taking too long to load',
        'Try again with a slower connection speed',
        'The image server may be overloaded'
      ],
      format: [
        'The image format may not be supported',
        'The image file may be corrupted',
        'Try a different image quality setting'
      ],
      server: [
        'The website server is experiencing issues',
        'Try again in a few minutes',
        'The website may be temporarily unavailable'
      ],
      notFound: [
        'The image could not be found at the specified URL',
        'The image may have been moved or deleted',
        'Verify the URL is correct and try again'
      ],
      memory: [
        'Your browser is running out of memory',
        'Try closing other tabs or applications',
        'Reduce the number of images being processed at once'
      ]
    };
    
    return suggestions[errorType] || [
      'An unexpected error occurred',
      'Try refreshing the page and attempting again',
      'Check the browser console for more details'
    ];
  }

  /**
   * Convert technical error to user-friendly message
   * Translates technical error codes and messages into plain language
   * 
   * @param {string} errorMessage - The technical error message
   * @returns {string} A user-friendly error description
   */
  getUserFriendlyError(errorMessage) {
    const errorType = this.classifyError(errorMessage);
    
    const friendlyMessages = {
      network: 'Network connection issue',
      cors: 'Website blocking external access',
      permission: 'Access permission denied',
      rateLimit: 'Too many requests - please wait',
      timeout: 'Request timed out',
      server: 'Server error on website',
      notFound: 'Image not found',
      format: 'Unsupported image format',
      memory: 'Memory limit reached'
    };
    
    return friendlyMessages[errorType] || 'Unexpected error occurred';
  }

  // =============================================================================
  // CIRCUIT BREAKER PATTERN
  // =============================================================================

  /**
   * Check if circuit breaker is open for domain
   */
  isCircuitBreakerOpen(url) {
    const domain = this.getDomainFromUrl(url);
    const breaker = this.circuitBreakers.get(domain);
    
    if (!breaker) return false;
    
    if (breaker.state === 'open') {
      // Check if timeout has elapsed
      if (Date.now() - breaker.lastFailure > this.options.circuitBreakerTimeout) {
        breaker.state = 'half-open';
        breaker.consecutiveFailures = 0;
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreaker(url, success) {
    const domain = this.getDomainFromUrl(url);
    let breaker = this.circuitBreakers.get(domain);
    
    if (!breaker) {
      breaker = {
        domain,
        state: 'closed',
        consecutiveFailures: 0,
        lastFailure: null
      };
      this.circuitBreakers.set(domain, breaker);
    }
    
    if (success) {
      breaker.state = 'closed';
      breaker.consecutiveFailures = 0;
    } else {
      breaker.consecutiveFailures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.consecutiveFailures >= this.options.circuitBreakerThreshold) {
        breaker.state = 'open';
        console.warn(`🔴 Circuit breaker opened for ${domain} after ${breaker.consecutiveFailures} failures`);
      }
    }
  }

  // =============================================================================
  // BATCH PROCESSING AND CONCURRENCY MANAGEMENT
  // =============================================================================

  /**
   * Process multiple URLs with intelligent batching and concurrency control
   */
  async enhancedFetchBatch(urls, options = {}) {
    if (!this.PRODUCTION) console.log(`📦 Starting batch fetch for ${urls.length} URLs`);
    
    const batchOptions = {
      batchSize: options.batchSize || this.options.batchSize,
      concurrency: Math.min(options.concurrency || this.options.maxConcurrentRequests, urls.length),
      enableProgressTracking: options.enableProgressTracking !== false,
      ...options
    };

    const results = [];
    const errors = [];
    let completed = 0;

    // Create batches
    const batches = this.createBatches(urls, batchOptions.batchSize);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      if (!this.PRODUCTION) console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);
      
      // Process batch with concurrency control
      const batchPromises = batch.map(async (url) => {
        try {
          const result = await this.enhancedFetch(url, options);
          completed++;
          
          if (batchOptions.enableProgressTracking) {
            this.notifyBatchProgress(completed, urls.length, result);
          }
          
          return { url, ...result };
        } catch (error) {
          completed++;
          const errorResult = { url, success: false, error: error.message };
          errors.push(errorResult);
          
          if (batchOptions.enableProgressTracking) {
            this.notifyBatchProgress(completed, urls.length, errorResult);
          }
          
          return errorResult;
        }
      });

      // Wait for batch completion with concurrency limit
      const batchResults = await this.limitConcurrency(batchPromises, batchOptions.concurrency);
      results.push(...batchResults);
      
      // Batch delay to prevent overwhelming servers
      if (batchIndex < batches.length - 1) {
        await this.delay(this.options.batchDelay);
      }
      
      // Memory management check
      if (this.options.enableMemoryManagement) {
        await this.checkMemoryUsage();
      }
    }

    const summary = {
      totalRequests: urls.length,
      successful: results.filter(r => r.success).length,
      failed: errors.length,
      results,
      errors,
      processingTime: Date.now() - Date.now(), // Will be set by caller
      metrics: this.getMetricsSummary()
    };

    if (!this.PRODUCTION) console.log(`✅ Batch processing completed: ${summary.successful}/${summary.totalRequests} successful`);
    
    return summary;
  }

  /**
   * Create batches from URL array
   */
  createBatches(urls, batchSize) {
    const batches = [];
    for (let i = 0; i < urls.length; i += batchSize) {
      batches.push(urls.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Limit concurrency for Promise array
   */
  async limitConcurrency(promises, limit) {
    const results = [];
    const executing = [];

    for (const promise of promises) {
      const p = Promise.resolve(promise).then(result => {
        executing.splice(executing.indexOf(p), 1);
        return result;
      });

      results.push(p);
      
      if (promises.length >= limit) {
        executing.push(p);
        
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }

    return Promise.all(results);
  }

  // =============================================================================
  // MEMORY MANAGEMENT
  // =============================================================================

  /**
   * Initialize memory management
   */
  startMemoryManagement() {
    if (!this.options.enableMemoryManagement) return;
    
    this.memoryWatcher = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.garbageCollectionInterval);
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  async checkMemoryUsage() {
    try {
      // Use performance.memory if available (Chrome)
      if (performance.memory) {
        const memoryInfo = performance.memory;
        this.metrics.memoryUsage = memoryInfo.usedJSHeapSize;
        
        if (memoryInfo.usedJSHeapSize > this.options.memoryThreshold) {
          console.warn('🧠 High memory usage detected, triggering cleanup...');
          await this.performMemoryCleanup();
        }
      }
    } catch (error) {
      console.warn('Memory check failed:', error);
    }
  }

  /**
   * Perform memory cleanup
   */
  async performMemoryCleanup() {
    // Clear old completed requests
    const cutoffTime = Date.now() - 300000; // 5 minutes
    
    for (const [id, request] of this.completedRequests.entries()) {
      if (request.timestamp < cutoffTime) {
        this.completedRequests.delete(id);
      }
    }
    
    // Clear old failed requests
    for (const [id, request] of this.failedRequests.entries()) {
      if (request.timestamp < cutoffTime) {
        this.failedRequests.delete(id);
      }
    }
    
    // Clear old circuit breaker data
    for (const [domain, breaker] of this.circuitBreakers.entries()) {
      if (breaker.lastFailure && (Date.now() - breaker.lastFailure) > 600000) { // 10 minutes
        this.circuitBreakers.delete(domain);
      }
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    if (!this.PRODUCTION) console.log('🗑️ Memory cleanup completed');
  }

  // =============================================================================
  // PROGRESS TRACKING AND USER NOTIFICATIONS
  // =============================================================================

  /**
   * Update progress for UI integration
   */
  updateProgress(requestId, percentage, message) {
    if (!this.options.enableProgressTracking) return;
    
    const progressData = {
      requestId,
      percentage,
      message,
      timestamp: Date.now()
    };
    
    // Notify all registered callbacks
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progressData);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    });
  }

  /**
   * Notify batch progress
   */
  notifyBatchProgress(completed, total, result) {
    const percentage = Math.round((completed / total) * 100);
    const message = result.success ? 
      `Completed ${completed}/${total} images` : 
      `Failed ${completed}/${total} images`;
    
    this.updateProgress('batch', percentage, message);
  }

  /**
   * Register progress callback
   */
  onProgress(callback) {
    this.progressCallbacks.add(callback);
    
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Register error report callback
   */
  onErrorReport(callback) {
    this.errorReportCallbacks.add(callback);
    
    return () => {
      this.errorReportCallbacks.delete(callback);
    };
  }

  /**
   * Generate error report for troubleshooting
   */
  generateErrorReport() {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      activeRequests: Array.from(this.activeRequests.values()),
      recentFailures: Array.from(this.failedRequests.values()).slice(-20),
      circuitBreakers: Array.from(this.circuitBreakers.entries()),
      configuration: {
        ...this.options,
        proxyServices: this.options.proxyServices.length // Don't expose actual URLs
      }
    };
    
    // Notify error report callbacks
    this.errorReportCallbacks.forEach(callback => {
      try {
        callback(report);
      } catch (error) {
        console.warn('Error report callback failed:', error);
      }
    });
    
    return report;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Initialize error handling system
   */
  initializeErrorHandling() {
    // Set up global error handlers for the enhanced system
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message && event.reason.message.includes('Enhanced Error Handling')) {
          console.error('🚨 Enhanced Error Handling system error:', event.reason);
          this.updateErrorMetrics(event.reason);
        }
      });
    }
  }

  /**
   * Update error metrics
   */
  updateErrorMetrics(error) {
    const errorType = this.classifyError(error.message);
    this.metrics.errorTypes[errorType] = (this.metrics.errorTypes[errorType] || 0) + 1;
  }

  /**
   * Update processing time metrics
   */
  updateProcessingTimeMetrics(processingTime) {
    const currentAvg = this.metrics.averageProcessingTime;
    const total = this.metrics.totalRequests;
    this.metrics.averageProcessingTime = ((currentAvg * (total - 1)) + processingTime) / total;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Extract domain from URL
   */
  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get alternative referer for credentialed requests
   */
  getAlternativeReferer(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}/`;
    } catch {
      return window.location.href;
    }
  }

  /**
   * Get alternative origin for credentialed requests
   */
  getAlternativeOrigin(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}`;
    } catch {
      return window.location.origin;
    }
  }

  /**
   * Validate image content type
   */
  isValidImageContentType(contentType) {
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'
    ];
    
    return validTypes.some(type => contentType.toLowerCase().includes(type));
  }

  /**
   * Delay helper for backoff and rate limiting
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0,
      activeRequestCount: this.activeRequests.size,
      circuitBreakerCount: this.circuitBreakers.size
    };
  }

  /**
   * Cleanup system resources
   */
  cleanup() {
    if (this.memoryWatcher) {
      clearInterval(this.memoryWatcher);
      this.memoryWatcher = null;
    }
    
    this.activeRequests.clear();
    this.completedRequests.clear();
    this.failedRequests.clear();
    this.progressCallbacks.clear();
    this.errorReportCallbacks.clear();
    
    if (!this.PRODUCTION) console.log('🧹 Enhanced Error Handling system cleaned up');
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.EnhancedErrorHandling = EnhancedErrorHandling;
}

if (!this.PRODUCTION) console.log('✅ Enhanced Error Handling System loaded successfully');

// =============================================================================
// IMAGE METADATA TRACKER - REMOVED FOR MANIFEST V3 COMPLIANCE
// =============================================================================
// 
// The ImageMetadataTracker class has been removed to ensure full Manifest V3 compliance.
// 
// REASON FOR REMOVAL:
// The chrome.webRequest API used by this class is deprecated in Manifest V3.
// MV3 requires using declarativeNetRequest instead, which has significant limitations
// for real-time metadata capture.
//
// FUNCTIONALITY REMOVED:
// - Real-time image Content-Type tracking via webRequest.onCompleted
// - Redirect handling via webRequest.onBeforeRedirect  
// - Response header analysis via webRequest.onHeadersReceived
// - Image metadata storage (MIME types, sizes, caching info)
// - Message handlers: "getImagesCT", "getImageMetadata", "getMetadataMetrics"
//
// IMPACT:
// This was an optimization feature for enhanced image metadata detection.
// The extension core functionality (image scraping and downloading) works without it.
// Image detection now relies on DOM-based analysis and URL pattern matching.
//
// MIGRATION PATH (if needed in future):
// To restore metadata tracking in MV3, would need to:
// 1. Use declarativeNetRequest API with static rules
// 2. Implement content script-based metadata capture
// 3. Use fetch() API in offscreen documents for header inspection
//
// =============================================================================

// =============================================================================
// ES6 MODULE EXPORTS
// =============================================================================

export {
  SimpleDownloadManager,
  SimpleMessageHandler,
  StepThreeDownloadQueue,
  BatchOperationsManager,
  MemoryOptimizedProcessor,
  SiteProfileManager,
  ConsolidatedBackgroundManager,
  EnhancedErrorHandling,
  StepThreeUtils,
  applyMask,
  resetCounters,
  getCounterStats
};