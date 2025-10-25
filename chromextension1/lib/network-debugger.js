/**
 * Network Debugger
 * Track and debug network communications in Chrome extension
 * 
 * Features:
 * - Track chrome.runtime.sendMessage calls
 * - Monitor port connections/disconnections
 * - Message flow tracking
 * - Failed message tracking
 * - Network timing
 */

class NetworkDebugger {
  constructor(config = null, logger = null) {
    this.config = config || (typeof window !== 'undefined' ? window.StepThreeDebugConfig : null);
    this.logger = logger || (typeof window !== 'undefined' ? window.StepThreeDebugLogger : null);
    
    this.messageLog = [];
    this.portLog = [];
    this.failedMessages = [];
    this.maxLogSize = 500;
    
    this.stats = {
      totalMessages: 0,
      totalPorts: 0,
      failedMessages: 0,
      averageResponseTime: 0
    };
    
    this.isMonitoring = false;
  }

  /**
   * Start monitoring network activity
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this._patchRuntimeAPI();
    
    if (this.logger) {
      this.logger.network('Network monitoring started');
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.logger) {
      this.logger.network('Network monitoring stopped');
    }
  }

  /**
   * Patch chrome.runtime API for monitoring
   */
  _patchRuntimeAPI() {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    
    // Patch sendMessage
    if (chrome.runtime.sendMessage && !chrome.runtime._originalSendMessage) {
      chrome.runtime._originalSendMessage = chrome.runtime.sendMessage;
      
      chrome.runtime.sendMessage = (...args) => {
        const startTime = performance.now();
        const messageId = this._generateMessageId();
        
        let message, callback, options;
        
        if (typeof args[0] === 'string') {
          // sendMessage(extensionId, message, options, callback)
          options = args[2];
          callback = args[3];
          message = args[1];
        } else {
          // sendMessage(message, options, callback)
          message = args[0];
          options = args[1];
          callback = args[2];
        }
        
        const logEntry = {
          id: messageId,
          type: 'sendMessage',
          message: message,
          timestamp: Date.now(),
          startTime: startTime,
          options: options,
          status: 'pending'
        };
        
        this._logMessage(logEntry);
        
        // Wrap callback to track response
        const wrappedCallback = (response) => {
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          logEntry.status = 'success';
          logEntry.response = response;
          logEntry.duration = duration;
          logEntry.endTime = endTime;
          
          this._updateMessageLog(messageId, logEntry);
          
          if (callback) {
            callback(response);
          }
        };
        
        // Call original with wrapped callback
        try {
          if (typeof args[0] === 'string') {
            return chrome.runtime._originalSendMessage(args[0], message, options, wrappedCallback);
          } else {
            return chrome.runtime._originalSendMessage(message, options, wrappedCallback);
          }
        } catch (error) {
          logEntry.status = 'error';
          logEntry.error = error.message;
          logEntry.duration = performance.now() - startTime;
          
          this._logFailedMessage(logEntry);
          throw error;
        }
      };
    }
    
    // Patch connect
    if (chrome.runtime.connect && !chrome.runtime._originalConnect) {
      chrome.runtime._originalConnect = chrome.runtime.connect;
      
      chrome.runtime.connect = (...args) => {
        const port = chrome.runtime._originalConnect(...args);
        this._trackPort(port);
        return port;
      };
    }
  }

  /**
   * Generate unique message ID
   */
  _generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log message
   */
  _logMessage(entry) {
    this.messageLog.unshift(entry);
    
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog = this.messageLog.slice(0, this.maxLogSize);
    }
    
    this.stats.totalMessages++;
    
    if (this.logger && this.config && this.config.isComponentEnabled('network')) {
      this.logger.network('Message sent:', entry.id, entry.message);
    }
  }

  /**
   * Update message log
   */
  _updateMessageLog(messageId, updatedEntry) {
    const index = this.messageLog.findIndex(entry => entry.id === messageId);
    if (index !== -1) {
      this.messageLog[index] = updatedEntry;
    }
    
    // Update average response time
    const successfulMessages = this.messageLog.filter(entry => entry.status === 'success' && entry.duration);
    if (successfulMessages.length > 0) {
      const totalDuration = successfulMessages.reduce((sum, entry) => sum + entry.duration, 0);
      this.stats.averageResponseTime = totalDuration / successfulMessages.length;
    }
  }

  /**
   * Log failed message
   */
  _logFailedMessage(entry) {
    this.failedMessages.unshift(entry);
    
    if (this.failedMessages.length > 100) {
      this.failedMessages = this.failedMessages.slice(0, 100);
    }
    
    this.stats.failedMessages++;
    
    if (this.logger) {
      this.logger.error('Message failed:', entry.id, entry.error);
    }
  }

  /**
   * Track port connection
   */
  _trackPort(port) {
    const portId = port.name || `port-${Date.now()}`;
    const connectedAt = Date.now();
    
    const portEntry = {
      id: portId,
      name: port.name,
      sender: port.sender,
      connectedAt: connectedAt,
      status: 'connected',
      messageCount: 0,
      messages: []
    };
    
    this.portLog.unshift(portEntry);
    
    if (this.portLog.length > this.maxLogSize) {
      this.portLog = this.portLog.slice(0, this.maxLogSize);
    }
    
    this.stats.totalPorts++;
    
    // Track messages through port
    const originalPostMessage = port.postMessage.bind(port);
    port.postMessage = (message) => {
      portEntry.messageCount++;
      portEntry.messages.unshift({
        timestamp: Date.now(),
        message: message,
        direction: 'outgoing'
      });
      
      if (portEntry.messages.length > 50) {
        portEntry.messages = portEntry.messages.slice(0, 50);
      }
      
      originalPostMessage(message);
    };
    
    // Track incoming messages
    port.onMessage.addListener((message) => {
      portEntry.messageCount++;
      portEntry.messages.unshift({
        timestamp: Date.now(),
        message: message,
        direction: 'incoming'
      });
      
      if (portEntry.messages.length > 50) {
        portEntry.messages = portEntry.messages.slice(0, 50);
      }
    });
    
    // Track disconnection
    port.onDisconnect.addListener(() => {
      portEntry.status = 'disconnected';
      portEntry.disconnectedAt = Date.now();
      portEntry.duration = portEntry.disconnectedAt - portEntry.connectedAt;
      
      if (this.logger) {
        this.logger.network('Port disconnected:', portId);
      }
    });
    
    if (this.logger) {
      this.logger.network('Port connected:', portId);
    }
  }

  /**
   * Get message log
   */
  getMessageLog(filters = {}) {
    let log = [...this.messageLog];
    
    if (filters.status) {
      log = log.filter(entry => entry.status === filters.status);
    }
    
    if (filters.limit) {
      log = log.slice(0, filters.limit);
    }
    
    return log;
  }

  /**
   * Get port log
   */
  getPortLog(filters = {}) {
    let log = [...this.portLog];
    
    if (filters.status) {
      log = log.filter(entry => entry.status === filters.status);
    }
    
    if (filters.limit) {
      log = log.slice(0, filters.limit);
    }
    
    return log;
  }

  /**
   * Get failed messages
   */
  getFailedMessages() {
    return [...this.failedMessages];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.portLog.filter(p => p.status === 'connected').length,
      pendingMessages: this.messageLog.filter(m => m.status === 'pending').length
    };
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.messageLog = [];
    this.portLog = [];
    this.failedMessages = [];
    this.stats = {
      totalMessages: 0,
      totalPorts: 0,
      failedMessages: 0,
      averageResponseTime: 0
    };
    
    if (this.logger) {
      this.logger.network('Network logs cleared');
    }
  }

  /**
   * Export network data
   */
  exportData() {
    return {
      exportTime: new Date().toISOString(),
      stats: this.getStats(),
      messages: this.messageLog,
      ports: this.portLog,
      failedMessages: this.failedMessages
    };
  }

  /**
   * Get message flow diagram data
   */
  getMessageFlow(timeWindow = 60000) {
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    const recentMessages = this.messageLog.filter(entry => entry.timestamp >= cutoff);
    const recentPorts = this.portLog.filter(entry => entry.connectedAt >= cutoff);
    
    return {
      timeWindow: timeWindow,
      messages: recentMessages.map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        type: entry.type,
        status: entry.status,
        duration: entry.duration
      })),
      ports: recentPorts.map(entry => ({
        id: entry.id,
        name: entry.name,
        connectedAt: entry.connectedAt,
        status: entry.status,
        messageCount: entry.messageCount
      }))
    };
  }
}

// Create global instance
const networkDebugger = new NetworkDebugger(
  typeof window !== 'undefined' ? window.StepThreeDebugConfig : null,
  typeof window !== 'undefined' ? window.StepThreeDebugLogger : null
);

// Make available globally
if (typeof window !== 'undefined') {
  window.StepThreeNetworkDebugger = networkDebugger;
}
