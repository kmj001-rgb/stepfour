// offscreen-manager.js - Offscreen document management for MV3 compliance
// Manages creation, lifecycle, and communication with offscreen documents

console.log('📄 Loading Offscreen Manager...');

/**
 * Offscreen Document Manager for MV3 Compliance
 * Handles creation, lifecycle, and secure communication with offscreen documents
 */
class OffscreenManager {
  constructor(options = {}) {
    this.options = {
      maxConcurrentOffscreenDocs: options.maxConcurrentOffscreenDocs || 3,
      offscreenDocTimeout: options.offscreenDocTimeout || 5 * 60 * 1000, // 5 minutes
      enableAutoCleanup: options.enableAutoCleanup !== false,
      ...options
    };

    this.activeOffscreenDocs = new Map();
    this.messageHandlers = new Map();
    this.pendingOperations = new Map();
    this.cleanupTimers = new Map();
    
    // Phase 2: Health check and heartbeat system
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    this.heartbeatTimers = new Map();
    this.healthStatus = new Map();
    this.recoveryAttempts = new Map();
    
    this.setupMessageHandling();
    
    // SECURITY FIX (M1): Add guaranteed cleanup handlers for resource cleanup enforcement
    // Ensures all offscreen documents are cleaned up on page unload/hide
    // Prevents memory leaks and orphaned offscreen documents
    this.setupCleanupHandlers();
    
    // Phase 2: Start health monitoring system
    this.startHealthMonitoring();
    
    console.log('✅ Offscreen Manager initialized');
  }

  /**
   * Phase 2: Start health monitoring and heartbeat system
   * BUG FIX: Use chrome.alarms instead of setInterval for MV3 compliance
   * @private
   */
  startHealthMonitoring() {
    console.log('🏥 Starting offscreen document health monitoring...');
    
    // BUG FIX: Use chrome.alarms for periodic health checks
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.create('offscreen-health-check', {
        periodInMinutes: this.healthCheckInterval / 60000
      });
      console.log('✅ Offscreen health monitoring started with chrome.alarms');
    } else {
      // Fallback for non-service worker contexts
      setInterval(() => {
        this.performHealthChecks();
      }, this.healthCheckInterval);
      console.log('✅ Offscreen health monitoring started with setInterval (non-SW context)');
    }
  }
  
  /**
   * Handle alarm event for health monitoring
   * BUG FIX: Added to handle chrome.alarms callback
   */
  handleAlarmEvent(alarm) {
    if (alarm.name === 'offscreen-health-check') {
      this.performHealthChecks();
    } else if (alarm.name && alarm.name.startsWith('offscreen-heartbeat-')) {
      const docId = alarm.name.replace('offscreen-heartbeat-', '');
      this.performHeartbeat(docId);
    }
  }

  /**
   * Phase 2: Perform health checks on all active offscreen documents
   * @private
   */
  async performHealthChecks() {
    for (const [docId, docInfo] of this.activeOffscreenDocs.entries()) {
      try {
        const isHealthy = await this.healthCheck(docId);
        
        if (!isHealthy) {
          console.warn(`⚠️ Offscreen document ${docId} failed health check`);
          await this.recoverOffscreenDoc(docId);
        } else {
          // Reset recovery attempts on successful health check
          this.recoveryAttempts.set(docId, 0);
        }
      } catch (error) {
        console.error(`❌ Health check failed for ${docId}:`, error);
      }
    }
  }

  /**
   * Phase 2: Health check for a specific offscreen document
   * Sends a ping and waits for pong response
   * 
   * @param {string} docId - Document ID to check
   * @returns {Promise<boolean>} True if healthy, false otherwise
   */
  async healthCheck(docId) {
    try {
      const docInfo = this.activeOffscreenDocs.get(docId);
      
      if (!docInfo || !docInfo.ready) {
        return false;
      }

      const checkId = `health_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Send health check ping
      const response = await this.sendMessageToOffscreen({
        action: 'OFFSCREEN_HEALTH_CHECK',
        checkId,
        docId
      }, 5000); // 5 second timeout for health check

      if (response && response.ok && response.healthy) {
        this.healthStatus.set(docId, {
          healthy: true,
          lastCheck: Date.now(),
          checkId
        });
        
        docInfo.lastHealthCheck = Date.now();
        return true;
      }

      return false;

    } catch (error) {
      console.error(`❌ Health check failed for ${docId}:`, error);
      
      this.healthStatus.set(docId, {
        healthy: false,
        lastCheck: Date.now(),
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Phase 2: Recover failed offscreen document
   * Attempts to recreate the offscreen document
   * 
   * @param {string} docId - Document ID to recover
   * @private
   */
  async recoverOffscreenDoc(docId) {
    const attempts = this.recoveryAttempts.get(docId) || 0;
    const maxAttempts = 3;

    if (attempts >= maxAttempts) {
      console.error(`❌ Max recovery attempts (${maxAttempts}) reached for ${docId}, giving up`);
      return;
    }

    this.recoveryAttempts.set(docId, attempts + 1);

    try {
      console.log(`🔧 Attempting to recover offscreen document ${docId} (attempt ${attempts + 1}/${maxAttempts})...`);

      // Cleanup the failed document
      await this.cleanupOffscreenDoc(docId);

      // Wait a bit before recreation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Recreate based on type
      const docInfo = this.activeOffscreenDocs.get(docId);
      if (!docInfo) {
        console.warn(`⚠️ Document info lost for ${docId}, cannot recover`);
        return;
      }

      if (docInfo.type === 'export') {
        await this.createExportOffscreenDoc();
        console.log(`✅ Export offscreen document recovered`);
      } else if (docInfo.type === 'sandbox') {
        await this.createSandboxOffscreenDoc();
        console.log(`✅ Sandbox offscreen document recovered`);
      }

    } catch (error) {
      console.error(`❌ Failed to recover offscreen document ${docId}:`, error);
    }
  }

  /**
   * Phase 2: Start heartbeat for an offscreen document
   * BUG FIX: Use chrome.alarms instead of setInterval for MV3 compliance
   * @param {string} docId - Document ID to start heartbeat for
   * @private
   */
  startHeartbeat(docId) {
    // Clear existing heartbeat if any
    this.stopHeartbeat(docId);

    // BUG FIX: Use chrome.alarms in service worker context
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      const alarmName = `offscreen-heartbeat-${docId}`;
      chrome.alarms.create(alarmName, {
        periodInMinutes: this.healthCheckInterval / 60000
      });
      this.heartbeatTimers.set(docId, alarmName); // Store alarm name instead of timer ID
      console.log(`💓 Heartbeat started for ${docId} using chrome.alarms`);
    } else {
      // Fallback to setInterval in non-service worker contexts
      const heartbeatTimer = setInterval(async () => {
        try {
          const docInfo = this.activeOffscreenDocs.get(docId);
          
          if (!docInfo || !docInfo.ready) {
            this.stopHeartbeat(docId);
            return;
          }

          await this.performHeartbeat(docId);

        } catch (error) {
          console.warn(`⚠️ Heartbeat failed for ${docId}:`, error);
        }
      }, this.healthCheckInterval);

      this.heartbeatTimers.set(docId, heartbeatTimer);
      console.log(`💓 Heartbeat started for ${docId} using setInterval`);
    }
  }
  
  /**
   * Perform heartbeat for an offscreen document
   * BUG FIX: Extracted from setInterval to be called by alarm handler
   * @param {string} docId - Document ID to send heartbeat to
   * @private
   */
  async performHeartbeat(docId) {
    try {
      const docInfo = this.activeOffscreenDocs.get(docId);
      
      if (!docInfo || !docInfo.ready) {
        this.stopHeartbeat(docId);
        return;
      }

      // Send heartbeat ping
      await this.sendMessageToOffscreen({
        action: 'OFFSCREEN_HEARTBEAT',
        docId,
        timestamp: Date.now()
      }, 3000); // 3 second timeout for heartbeat

      docInfo.lastHeartbeat = Date.now();

    } catch (error) {
      console.warn(`⚠️ Heartbeat failed for ${docId}:`, error);
    }
  }

  /**
   * Phase 2: Stop heartbeat for an offscreen document
   * BUG FIX: Handle both chrome.alarms and setInterval cleanup
   * @param {string} docId - Document ID to stop heartbeat for
   * @private
   */
  stopHeartbeat(docId) {
    const timerOrAlarmName = this.heartbeatTimers.get(docId);
    if (timerOrAlarmName) {
      if (typeof timerOrAlarmName === 'string') {
        // It's an alarm name, clear the alarm
        if (typeof chrome !== 'undefined' && chrome.alarms) {
          chrome.alarms.clear(timerOrAlarmName);
        }
      } else {
        // It's an interval ID, clear the interval
        clearInterval(timerOrAlarmName);
      }
      this.heartbeatTimers.delete(docId);
      console.log(`💓 Heartbeat stopped for ${docId}`);
    }
  }

  /**
   * Phase 2: Get health status for all offscreen documents
   * 
   * @returns {Object} Health status summary
   */
  getHealthStatus() {
    const status = {
      timestamp: Date.now(),
      totalDocuments: this.activeOffscreenDocs.size,
      documents: {}
    };

    for (const [docId, docInfo] of this.activeOffscreenDocs.entries()) {
      const healthInfo = this.healthStatus.get(docId) || {};
      const recoveryCount = this.recoveryAttempts.get(docId) || 0;

      status.documents[docId] = {
        type: docInfo.type,
        ready: docInfo.ready,
        created: docInfo.created,
        lastUsed: docInfo.lastUsed,
        lastHealthCheck: docInfo.lastHealthCheck,
        lastHeartbeat: docInfo.lastHeartbeat,
        healthy: healthInfo.healthy !== false,
        recoveryAttempts: recoveryCount,
        uptime: Date.now() - docInfo.created
      };
    }

    return status;
  }

  /**
   * Setup guaranteed cleanup handlers (SECURITY FIX M1)
   */
  setupCleanupHandlers() {
    if (typeof window !== 'undefined') {
      // beforeunload: Fires when user navigates away or closes window
      window.addEventListener('beforeunload', () => {
        this.cleanupAllOffscreenDocs();
      });

      // pagehide: More reliable than beforeunload in some browsers
      // Fires when page is being hidden (navigation, tab close, etc.)
      window.addEventListener('pagehide', () => {
        this.cleanupAllOffscreenDocs();
      });

      console.log('✅ Offscreen Manager cleanup handlers registered');
    }
  }

  /**
   * Setup message handling for offscreen communication
   */
  setupMessageHandling() {
    // Listen for messages from offscreen documents
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action?.startsWith('OFFSCREEN_')) {
        this.handleOffscreenMessage(message, sender, sendResponse);
        return true; // Keep message channel open
      }
    });
  }

  /**
   * Create offscreen document for export operations
   */
  async createExportOffscreenDoc() {
    try {
      const docId = 'export-worker';
      
      // Check if already exists
      if (this.activeOffscreenDocs.has(docId)) {
        console.log('📄 Export offscreen document already exists');
        return this.activeOffscreenDocs.get(docId);
      }

      console.log('📄 Creating export offscreen document...');

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: 'offscreen/export-worker.html',
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: 'Secure processing of heavy export operations (XLSX, CSV, JSON generation) in isolated context for security and performance'
      });

      // Register the document
      const docInfo = {
        id: docId,
        url: 'offscreen/export-worker.html',
        type: 'export',
        created: Date.now(),
        lastUsed: Date.now(),
        ready: false
      };

      this.activeOffscreenDocs.set(docId, docInfo);
      
      // Setup cleanup timer
      this.scheduleCleanup(docId);
      
      // Wait for ready notification
      await this.waitForDocumentReady(docId);
      
      // Phase 2: Start heartbeat for this document
      this.startHeartbeat(docId);
      
      console.log('✅ Export offscreen document created and ready');
      return docInfo;

    } catch (error) {
      console.error('❌ Failed to create export offscreen document:', error);
      throw new Error(`Failed to create export offscreen document: ${error.message}`);
    }
  }

  /**
   * Create offscreen document for sandbox operations
   */
  async createSandboxOffscreenDoc() {
    try {
      const docId = 'sandbox-operations';
      
      // Check if already exists
      if (this.activeOffscreenDocs.has(docId)) {
        console.log('📄 Sandbox offscreen document already exists');
        return this.activeOffscreenDocs.get(docId);
      }

      console.log('📄 Creating sandbox offscreen document...');

      // Create offscreen document
      await chrome.offscreen.createDocument({
        url: 'sandbox/secure-operations.html',
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: 'Secure processing of untrusted operations (URL validation, content parsing) in sandboxed isolated context'
      });

      // Register the document
      const docInfo = {
        id: docId,
        url: 'sandbox/secure-operations.html',
        type: 'sandbox',
        created: Date.now(),
        lastUsed: Date.now(),
        ready: false
      };

      this.activeOffscreenDocs.set(docId, docInfo);
      
      // Setup cleanup timer
      this.scheduleCleanup(docId);
      
      // Wait for ready notification
      await this.waitForDocumentReady(docId);
      
      // Phase 2: Start heartbeat for this document
      this.startHeartbeat(docId);
      
      console.log('✅ Sandbox offscreen document created and ready');
      return docInfo;

    } catch (error) {
      console.error('❌ Failed to create sandbox offscreen document:', error);
      throw new Error(`Failed to create sandbox offscreen document: ${error.message}`);
    }
  }

  /**
   * Execute export operation in offscreen document
   */
  async executeExportOperation(data, format, filename, options = {}) {
    try {
      console.log(`🚀 Executing ${format} export in offscreen document...`);

      // Ensure export offscreen document exists
      await this.createExportOffscreenDoc();
      
      const exportId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Send export request to offscreen document
      const result = await this.sendMessageToOffscreen({
        action: 'OFFSCREEN_EXPORT_START',
        exportId,
        data,
        format,
        filename,
        options
      });

      if (!result.ok) {
        throw new Error(result.error || 'Export operation failed');
      }

      console.log(`✅ Export operation completed in offscreen document`);
      return result.result;

    } catch (error) {
      console.error('❌ Offscreen export operation failed:', error);
      throw new Error(`Offscreen export failed: ${error.message}`);
    }
  }

  /**
   * Execute sandbox operation in offscreen document
   */
  async executeSandboxOperation(action, data, options = {}) {
    try {
      console.log(`🔒 Executing ${action} operation in sandbox...`);

      // Ensure sandbox offscreen document exists
      await this.createSandboxOffscreenDoc();
      
      const operationId = `sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Send operation request to sandbox document
      const result = await this.sendMessageToOffscreen({
        action,
        operationId,
        data,
        options
      });

      if (!result.ok) {
        throw new Error(result.error || 'Sandbox operation failed');
      }

      console.log(`✅ Sandbox operation completed`);
      return result.result;

    } catch (error) {
      console.error('❌ Sandbox operation failed:', error);
      throw new Error(`Sandbox operation failed: ${error.message}`);
    }
  }

  /**
   * Send message to offscreen document
   */
  async sendMessageToOffscreen(message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Offscreen message timeout'));
      }, 30000); // 30 second timeout

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || { ok: false, error: 'No response' });
        }
      });
    });
  }

  /**
   * Handle messages from offscreen documents
   */
  handleOffscreenMessage(message, sender, sendResponse) {
    try {
      const { action } = message;

      switch (action) {
        case 'OFFSCREEN_WORKER_READY':
          this.handleWorkerReady(message, sendResponse);
          break;

        case 'OFFSCREEN_EXPORT_PROGRESS':
          this.handleExportProgress(message, sendResponse);
          break;

        case 'SANDBOX_READY':
          this.handleSandboxReady(message, sendResponse);
          break;

        default:
          console.warn('Unknown offscreen message action:', action);
          sendResponse({ ok: false, error: 'Unknown action' });
      }

    } catch (error) {
      console.error('❌ Error handling offscreen message:', error);
      sendResponse({ ok: false, error: error.message });
    }
  }

  /**
   * Handle worker ready notification
   */
  handleWorkerReady(message, sendResponse) {
    const docInfo = this.findOffscreenDocByType('export');
    if (docInfo) {
      docInfo.ready = message.ready;
      docInfo.lastUsed = Date.now();
      console.log('📄 Export worker ready notification received');
    }
    sendResponse({ ok: true });
  }

  /**
   * Handle export progress updates
   */
  handleExportProgress(message, sendResponse) {
    // Forward progress updates to interested listeners
    // This could be connected to UI progress indicators
    console.log('📊 Export progress:', message.progress);
    sendResponse({ ok: true });
  }

  /**
   * Handle sandbox ready notification
   */
  handleSandboxReady(message, sendResponse) {
    const docInfo = this.findOffscreenDocByType('sandbox');
    if (docInfo) {
      docInfo.ready = message.ready;
      docInfo.lastUsed = Date.now();
      console.log('🔒 Sandbox ready notification received');
    }
    sendResponse({ ok: true });
  }

  /**
   * Wait for offscreen document to be ready
   */
  async waitForDocumentReady(docId, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const docInfo = this.activeOffscreenDocs.get(docId);
      if (docInfo && docInfo.ready) {
        return true;
      }
      
      // Check if document is ready
      try {
        const response = await this.sendMessageToOffscreen({
          action: docInfo.type === 'export' ? 'OFFSCREEN_WORKER_READY' : 'SANDBOX_READY'
        });
        
        if (response.ready) {
          docInfo.ready = true;
          return true;
        }
      } catch (error) {
        // Document not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Offscreen document ${docId} did not become ready within timeout`);
  }

  /**
   * Find offscreen document by type
   */
  findOffscreenDocByType(type) {
    for (const docInfo of this.activeOffscreenDocs.values()) {
      if (docInfo.type === type) {
        return docInfo;
      }
    }
    return null;
  }

  /**
   * Schedule cleanup for offscreen document
   */
  scheduleCleanup(docId) {
    if (!this.options.enableAutoCleanup) return;

    // Clear existing timer
    if (this.cleanupTimers.has(docId)) {
      clearTimeout(this.cleanupTimers.get(docId));
    }

    // Schedule new cleanup
    const timer = setTimeout(() => {
      this.cleanupOffscreenDoc(docId);
    }, this.options.offscreenDocTimeout);

    this.cleanupTimers.set(docId, timer);
  }

  /**
   * Cleanup offscreen document
   */
  async cleanupOffscreenDoc(docId) {
    try {
      const docInfo = this.activeOffscreenDocs.get(docId);
      if (!docInfo) return;

      console.log(`🧹 Cleaning up offscreen document: ${docId}`);

      // Close offscreen document
      await chrome.offscreen.closeDocument();
      
      // Remove from tracking
      this.activeOffscreenDocs.delete(docId);
      
      // Clear cleanup timer
      if (this.cleanupTimers.has(docId)) {
        clearTimeout(this.cleanupTimers.get(docId));
        this.cleanupTimers.delete(docId);
      }

      console.log(`✅ Offscreen document cleaned up: ${docId}`);

    } catch (error) {
      console.error(`❌ Failed to cleanup offscreen document ${docId}:`, error);
    }
  }

  /**
   * Cleanup all offscreen documents
   */
  async cleanupAllOffscreenDocs() {
    console.log('🧹 Cleaning up all offscreen documents...');
    
    const cleanupPromises = Array.from(this.activeOffscreenDocs.keys()).map(docId => 
      this.cleanupOffscreenDoc(docId)
    );
    
    await Promise.allSettled(cleanupPromises);
    
    console.log('✅ All offscreen documents cleaned up');
  }

  /**
   * Get status of offscreen documents
   */
  getOffscreenStatus() {
    const status = {
      activeDocuments: this.activeOffscreenDocs.size,
      documents: Array.from(this.activeOffscreenDocs.values()).map(doc => ({
        id: doc.id,
        type: doc.type,
        ready: doc.ready,
        created: doc.created,
        lastUsed: doc.lastUsed,
        age: Date.now() - doc.created
      })),
      pendingOperations: this.pendingOperations.size
    };

    return status;
  }

  /**
   * Refresh usage timestamp for document
   */
  touchDocument(docId) {
    const docInfo = this.activeOffscreenDocs.get(docId);
    if (docInfo) {
      docInfo.lastUsed = Date.now();
      // Reschedule cleanup
      this.scheduleCleanup(docId);
    }
  }
}

// Make available globally for Chrome extension context
if (typeof globalThis !== 'undefined') {
  globalThis.OffscreenManager = OffscreenManager;
}

console.log('✅ Offscreen Manager loaded successfully');