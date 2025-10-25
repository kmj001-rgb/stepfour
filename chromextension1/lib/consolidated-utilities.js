// chrome-safe.js - Centralized Chrome API error handling wrapper  
// Provides consistent chrome.runtime.lastError handling and Promise-based APIs
// Phase 1b Enhancement: Integrated with RetryManager for robust retry mechanisms

/**
 * ChromeSafe - Centralized wrapper for Chrome extension APIs
 * Handles chrome.runtime.lastError consistently and provides Promise-based interfaces
 * Enhanced with RetryManager integration for robust retry mechanisms
 */
class ChromeSafe {
  
  // Static reference to RetryManager instance
  static retryManager = null;
  
  /**
   * Initialize ChromeSafe with RetryManager integration
   * @param {RetryManager} retryManager - RetryManager instance
   */
  static initialize(retryManager) {
    this.retryManager = retryManager;
    console.log('✅ ChromeSafe initialized with RetryManager integration');
  }
  /**
   * Generic wrapper for Chrome API calls with callback-based error handling
   * @param {Function} apiCall - Chrome API function to call
   * @param {...any} args - Arguments to pass to the API
   * @returns {Promise} - Promise that resolves with result or rejects with error
   */
  static async call(apiCall, ...args) {
    return new Promise((resolve, reject) => {
      try {
        const callback = (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Chrome API Error: ${chrome.runtime.lastError.message}`));
          } else {
            resolve(result);
          }
        };

        apiCall(...args, callback);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Safe wrapper for chrome.tabs.sendMessage with timeout and error handling
   * @param {number} tabId - Target tab ID
   * @param {any} message - Message to send
   * @param {object} options - Optional options
   * @returns {Promise} - Promise that resolves with response or rejects with error
   */
  static async sendMessage(tabId, message, options = {}) {
    const timeout = options.timeout || 5000; // 5 second default timeout

    // Strip custom timeout option before forwarding to Chrome API
    const chromeOptions = { ...options };
    delete chromeOptions.timeout;

    return Promise.race([
      this.call(chrome.tabs.sendMessage, tabId, message, chromeOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Message timeout')), timeout)
      )
    ]);
  }

  /**
   * Safe wrapper for chrome.runtime.sendMessage
   * @param {any} message - Message to send
   * @param {object} options - Optional options
   * @returns {Promise} - Promise that resolves with response or rejects with error
   */
  static async sendRuntimeMessage(message, options = {}) {
    return this.call(chrome.runtime.sendMessage, message, options);
  }

  /**
   * Safe wrapper for chrome.scripting.executeScript
   * @param {object} injection - Script injection details
   * @returns {Promise} - Promise that resolves with results or rejects with error
   */
  static async executeScript(injection) {
    try {
      // Validate required parameters
      if (!injection.target || !injection.target.tabId) {
        throw new Error('executeScript requires target.tabId');
      }

      if (!injection.files && !injection.function) {
        throw new Error('executeScript requires files or function');
      }

      return await this.call(chrome.scripting.executeScript, injection);
    } catch (error) {
      throw new Error(`Script injection failed: ${error.message}`);
    }
  }

  /**
   * Safe wrapper for chrome.tabs.query
   * @param {object} queryInfo - Tab query parameters
   * @returns {Promise} - Promise that resolves with tabs array or rejects with error
   */
  static async queryTabs(queryInfo) {
    return this.call(chrome.tabs.query, queryInfo);
  }

  /**
   * Safe wrapper for chrome.tabs.update
   * @param {number} tabId - Tab ID to update
   * @param {object} updateProperties - Properties to update
   * @returns {Promise} - Promise that resolves with updated tab or rejects with error
   */
  static async updateTab(tabId, updateProperties) {
    return this.call(chrome.tabs.update, tabId, updateProperties);
  }

  /**
   * Safe wrapper for chrome.tabs.create
   * @param {object} createProperties - Properties for new tab
   * @returns {Promise} - Promise that resolves with created tab or rejects with error
   */
  static async createTab(createProperties) {
    return this.call(chrome.tabs.create, createProperties);
  }

  /**
   * Safe wrapper for chrome.windows.create
   * @param {object} createData - Window creation data
   * @returns {Promise} - Promise that resolves with created window or rejects with error
   */
  static async createWindow(createData) {
    return this.call(chrome.windows.create, createData);
  }

  /**
   * Safe wrapper for chrome.windows.update
   * @param {number} windowId - Window ID to update
   * @param {object} updateInfo - Update information
   * @returns {Promise} - Promise that resolves with updated window or rejects with error
   */
  static async updateWindow(windowId, updateInfo) {
    return this.call(chrome.windows.update, windowId, updateInfo);
  }

  /**
   * Safe wrapper for chrome.storage APIs
   * @param {string} area - Storage area ('local', 'sync', 'session')
   * @param {string} method - Method to call ('get', 'set', 'remove', 'clear')
   * @param {...any} args - Arguments for the storage method
   * @returns {Promise} - Promise that resolves with result or rejects with error
   */
  static async storage(area, method, ...args) {
    if (!chrome.storage[area]) {
      throw new Error(`Invalid storage area: ${area}`);
    }

    if (!chrome.storage[area][method]) {
      throw new Error(`Invalid storage method: ${method}`);
    }

    return this.call(chrome.storage[area][method], ...args);
  }

  /**
   * Safe wrapper for chrome.downloads.download
   * @param {object} options - Download options
   * @returns {Promise} - Promise that resolves with download ID or rejects with error
   */
  static async download(options) {
    return this.call(chrome.downloads.download, options);
  }

  /**
   * Safe wrapper for chrome.notifications.create
   * @param {string} notificationId - Notification ID
   * @param {object} options - Notification options
   * @returns {Promise} - Promise that resolves with notification ID or rejects with error
   */
  static async createNotification(notificationId, options) {
    return this.call(chrome.notifications.create, notificationId, options);
  }

  /**
   * Enhanced promise-based messaging with unique IDs and robust handshake protocol
   * @param {any} message - Message to send
   * @param {object} options - Options including timeout, retries, etc.
   * @returns {Promise} - Promise that resolves with response or rejects with error
   */
  static async sendMessageWithHandshake(message, options = {}) {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timeout = options.timeout || 5000;
    const maxRetries = options.maxRetries || 3;

    // Add unique ID to track the message
    const enhancedMessage = { ...message, messageId };

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await new Promise((resolve, reject) => {
          // Set up response listener with timeout
          const responseTimeout = setTimeout(() => {
            reject(new Error(`Message timeout after ${timeout}ms (attempt ${attempt + 1}/${maxRetries})`));
          }, timeout);

          // Listen for the response with the same ID
          const listener = (request, sender, sendResponse) => {
            if (request.messageId === messageId) {
              clearTimeout(responseTimeout);

              if (request.status === 'success') {
                resolve(request.payload);
              } else {
                reject(new Error(request.error || 'Unknown messaging error'));
              }

              // Clean up the listener
              chrome.runtime.onMessage.removeListener(listener);
            }
          };

          chrome.runtime.onMessage.addListener(listener);

          // Send the message
          chrome.runtime.sendMessage(enhancedMessage);
        });

      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error(`Message failed after ${maxRetries} attempts: ${error.message}`);
        }

        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Enhanced tab messaging with handshake protocol
   * @param {number} tabId - Target tab ID
   * @param {any} message - Message to send
   * @param {object} options - Options including timeout, retries, etc.
   * @returns {Promise} - Promise that resolves with response or rejects with error
   */
  static async sendTabMessageWithHandshake(tabId, message, options = {}) {
    const messageId = `tab_msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timeout = options.timeout || 5000;
    const maxRetries = options.maxRetries || 3;

    // Add unique ID to track the message
    const enhancedMessage = { ...message, messageId };

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await Promise.race([
          this.call(chrome.tabs.sendMessage, tabId, enhancedMessage),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tab message timeout after ${timeout}ms (attempt ${attempt + 1}/${maxRetries})`)), timeout)
          )
        ]);

      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error(`Tab message failed after ${maxRetries} attempts: ${error.message}`);
        }

        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Create a robust message handler for service workers
   * @param {Function} messageHandler - Function to handle incoming messages
   * @returns {Function} - Enhanced message listener
   */
  static createRobustMessageHandler(messageHandler) {
    return (request, sender, sendResponse) => {
      // Handle enhanced messages with unique IDs
      if (request.messageId) {
        try {
          const result = messageHandler(request, sender);

          // Handle both sync and async responses
          if (result instanceof Promise) {
            result
              .then(payload => {
                sendResponse({
                  status: 'success',
                  messageId: request.messageId,
                  payload
                });
              })
              .catch(error => {
                sendResponse({
                  status: 'error',
                  messageId: request.messageId,
                  error: error.message || 'Unknown error'
                });
              });
            return true; // Keep message channel open
          } else {
            // Sync response
            sendResponse({
              status: 'success',
              messageId: request.messageId,
              payload: result
            });
            return false;
          }
        } catch (error) {
          sendResponse({
            status: 'error',
            messageId: request.messageId,
            error: error.message || 'Unknown error'
          });
          return false;
        }
      } else {
        // Fallback to original message handler for non-enhanced messages
        return messageHandler(request, sender, sendResponse);
      }
    };
  }

  /**
   * Check if Chrome API is available
   * @param {string} apiPath - Dot-separated API path (e.g., 'tabs.sendMessage')
   * @returns {boolean} - True if API is available
   */
  static isApiAvailable(apiPath) {
    const parts = apiPath.split('.');
    let current = chrome;

    for (const part of parts) {
      if (!current || typeof current[part] === 'undefined') {
        return false;
      }
      current = current[part];
    }

    return true;
  }

  // ============================================================================
  // RETRY-ENABLED METHODS - Enhanced with RetryManager integration
  // ============================================================================

  /**
   * Enhanced download with RetryManager integration
   * @param {object} options - Download options
   * @param {object} retryOptions - Retry-specific options
   * @returns {Promise} - Promise that resolves with download ID or rejects with error
   */
  static async downloadWithRetry(options, retryOptions = {}) {
    if (!this.retryManager) {
      console.warn('⚠️ RetryManager not available, falling back to direct download');
      return this.download(options);
    }

    const taskId = retryOptions.taskId || `download_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create download operation
    const downloadOperation = async () => {
      try {
        const downloadId = await this.download(options);
        console.log(`✅ Download successful: ${options.filename || options.url}`);
        return downloadId;
      } catch (error) {
        // Enhance error with download context
        const enhancedError = new Error(`Download failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.downloadOptions = options;
        throw enhancedError;
      }
    };

    // Determine error category from download options/context
    const errorCategory = retryOptions.errorCategory || 'network';
    
    // Retry the download operation
    return this.retryManager.retryTask(taskId, downloadOperation, {
      errorCategory,
      context: { operation: 'download', url: options.url },
      metadata: { filename: options.filename },
      priority: retryOptions.priority || 'high',
      policyOverride: retryOptions.policyOverride
    });
  }

  /**
   * Enhanced tab messaging with RetryManager integration
   * @param {number} tabId - Target tab ID
   * @param {any} message - Message to send
   * @param {object} options - Optional options
   * @returns {Promise} - Promise that resolves with response or rejects with error
   */
  static async sendMessageWithRetry(tabId, message, options = {}) {
    if (!this.retryManager) {
      console.warn('⚠️ RetryManager not available, falling back to direct sendMessage');
      return this.sendMessage(tabId, message, options);
    }

    const taskId = options.taskId || `message_${tabId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create message operation
    const messageOperation = async () => {
      try {
        const response = await this.sendMessage(tabId, message, options);
        console.log(`✅ Message sent successfully to tab ${tabId}`);
        return response;
      } catch (error) {
        // Enhance error with message context
        const enhancedError = new Error(`Message failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.tabId = tabId;
        enhancedError.messageAction = message.action || message.type;
        throw enhancedError;
      }
    };

    // Determine error category
    let errorCategory = 'network';
    if (options.errorCategory) {
      errorCategory = options.errorCategory;
    } else if (message.action === 'PERMISSION_CHECK') {
      errorCategory = 'permission';
    }
    
    // Retry the message operation
    return this.retryManager.retryTask(taskId, messageOperation, {
      errorCategory,
      context: { operation: 'sendMessage', tabId, action: message.action || message.type },
      metadata: { timeout: options.timeout },
      priority: options.priority || 'medium',
      policyOverride: options.policyOverride
    });
  }

  /**
   * Enhanced runtime messaging with RetryManager integration
   * @param {any} message - Message to send
   * @param {object} options - Optional options
   * @returns {Promise} - Promise that resolves with response or rejects with error
   */
  static async sendRuntimeMessageWithRetry(message, options = {}) {
    if (!this.retryManager) {
      console.warn('⚠️ RetryManager not available, falling back to direct sendRuntimeMessage');
      return this.sendRuntimeMessage(message, options);
    }

    const taskId = options.taskId || `runtime_msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create runtime message operation
    const messageOperation = async () => {
      try {
        const response = await this.sendRuntimeMessage(message, options);
        console.log(`✅ Runtime message sent successfully`);
        return response;
      } catch (error) {
        // Enhance error with runtime message context
        const enhancedError = new Error(`Runtime message failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.messageAction = message.action || message.type;
        throw enhancedError;
      }
    };

    // Determine error category
    const errorCategory = options.errorCategory || 'extension';
    
    // Retry the runtime message operation
    return this.retryManager.retryTask(taskId, messageOperation, {
      errorCategory,
      context: { operation: 'sendRuntimeMessage', action: message.action || message.type },
      priority: options.priority || 'medium',
      policyOverride: options.policyOverride
    });
  }

  /**
   * Enhanced script execution with RetryManager integration
   * @param {object} injection - Script injection details
   * @param {object} retryOptions - Retry-specific options
   * @returns {Promise} - Promise that resolves with results or rejects with error
   */
  static async executeScriptWithRetry(injection, retryOptions = {}) {
    if (!this.retryManager) {
      console.warn('⚠️ RetryManager not available, falling back to direct executeScript');
      return this.executeScript(injection);
    }

    const taskId = retryOptions.taskId || `script_${injection.target.tabId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create script execution operation
    const scriptOperation = async () => {
      try {
        const results = await this.executeScript(injection);
        console.log(`✅ Script executed successfully in tab ${injection.target.tabId}`);
        return results;
      } catch (error) {
        // Enhance error with script execution context
        const enhancedError = new Error(`Script execution failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.tabId = injection.target.tabId;
        enhancedError.scriptFiles = injection.files;
        throw enhancedError;
      }
    };

    // Determine error category
    const errorCategory = retryOptions.errorCategory || 'extension';
    
    // Retry the script execution operation
    return this.retryManager.retryTask(taskId, scriptOperation, {
      errorCategory,
      context: { operation: 'executeScript', tabId: injection.target.tabId },
      metadata: { files: injection.files, func: injection.function ? 'provided' : 'none' },
      priority: retryOptions.priority || 'high',
      policyOverride: retryOptions.policyOverride
    });
  }

  /**
   * Enhanced storage operations with RetryManager integration
   * @param {string} area - Storage area ('local', 'sync', 'session')
   * @param {string} method - Method to call ('get', 'set', 'remove', 'clear')
   * @param {object} retryOptions - Retry-specific options
   * @param {...any} args - Arguments for the storage method
   * @returns {Promise} - Promise that resolves with result or rejects with error
   */
  static async storageWithRetry(area, method, retryOptions = {}, ...args) {
    if (!this.retryManager) {
      console.warn('⚠️ RetryManager not available, falling back to direct storage');
      return this.storage(area, method, ...args);
    }

    const taskId = retryOptions.taskId || `storage_${area}_${method}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create storage operation
    const storageOperation = async () => {
      try {
        const result = await this.storage(area, method, ...args);
        console.log(`✅ Storage ${method} successful in ${area}`);
        return result;
      } catch (error) {
        // Enhance error with storage context
        const enhancedError = new Error(`Storage ${method} failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.storageArea = area;
        enhancedError.storageMethod = method;
        throw enhancedError;
      }
    };

    // Determine error category
    const errorCategory = retryOptions.errorCategory || 'extension';
    
    // Retry the storage operation
    return this.retryManager.retryTask(taskId, storageOperation, {
      errorCategory,
      context: { operation: 'storage', area, method },
      priority: retryOptions.priority || 'low',
      policyOverride: retryOptions.policyOverride
    });
  }

  /**
   * Enhanced fetch operation wrapper with RetryManager integration
   * For use in content scripts or other contexts where fetch is available
   * @param {string|Request} input - URL or Request object
   * @param {object} init - Fetch init options
   * @param {object} retryOptions - Retry-specific options
   * @returns {Promise} - Promise that resolves with Response or rejects with error
   */
  static async fetchWithRetry(input, init = {}, retryOptions = {}) {
    if (!this.retryManager) {
      console.warn('⚠️ RetryManager not available, falling back to direct fetch');
      return fetch(input, init);
    }

    const url = typeof input === 'string' ? input : input.url;
    const taskId = retryOptions.taskId || `fetch_${url.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    
    // Create fetch operation
    const fetchOperation = async () => {
      try {
        const response = await fetch(input, init);
        
        // Check for HTTP error status
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.statusText = response.statusText;
          error.url = url;
          throw error;
        }
        
        console.log(`✅ Fetch successful: ${url}`);
        return response;
      } catch (error) {
        // Enhance error with fetch context
        const enhancedError = new Error(`Fetch failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.url = url;
        enhancedError.method = init.method || 'GET';
        throw enhancedError;
      }
    };

    // Determine error category based on the error type or status
    let errorCategory = 'network';
    if (retryOptions.errorCategory) {
      errorCategory = retryOptions.errorCategory;
    }
    
    // Retry the fetch operation
    return this.retryManager.retryTask(taskId, fetchOperation, {
      errorCategory,
      context: { operation: 'fetch', url, method: init.method || 'GET' },
      priority: retryOptions.priority || 'medium',
      policyOverride: retryOptions.policyOverride
    });
  }

  /**
   * Create a retry-enabled wrapper for any Chrome API operation
   * @param {Function} operation - The operation to wrap with retry logic
   * @param {string} operationName - Name for the operation (used in task ID and logging)
   * @param {object} retryOptions - Retry-specific options
   * @returns {Promise} - Promise that resolves with operation result or rejects with error
   */
  static async withRetry(operation, operationName, retryOptions = {}) {
    if (!this.retryManager) {
      console.warn(`⚠️ RetryManager not available for ${operationName}, executing directly`);
      return operation();
    }

    const taskId = retryOptions.taskId || `${operationName}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create wrapped operation
    const wrappedOperation = async () => {
      try {
        const result = await operation();
        console.log(`✅ ${operationName} successful`);
        return result;
      } catch (error) {
        // Enhance error with operation context
        const enhancedError = new Error(`${operationName} failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.operationName = operationName;
        throw enhancedError;
      }
    };

    // Use provided error category or default
    const errorCategory = retryOptions.errorCategory || 'default';
    
    // Retry the operation
    return this.retryManager.retryTask(taskId, wrappedOperation, {
      errorCategory,
      context: { operation: operationName },
      priority: retryOptions.priority || 'medium',
      policyOverride: retryOptions.policyOverride
    });
  }

  /**
   * Batch operation wrapper with RetryManager integration
   * Executes multiple operations with retry logic and proper error handling
   * @param {Array} operations - Array of operation objects {operation, name, retryOptions}
   * @param {object} batchOptions - Batch-specific options
   * @returns {Promise} - Promise that resolves with array of results
   */
  static async batchWithRetry(operations, batchOptions = {}) {
    if (!this.retryManager) {
      console.warn('⚠️ RetryManager not available for batch operations, executing directly');
      return Promise.all(operations.map(op => op.operation()));
    }

    const batchId = batchOptions.batchId || `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const maxConcurrency = batchOptions.maxConcurrency || 5;
    const stopOnFirstError = batchOptions.stopOnFirstError || false;

    console.log(`🔄 Starting batch operation ${batchId} with ${operations.length} tasks`);

    const results = [];
    const errors = [];
    const chunks = [];

    // Split operations into chunks for controlled concurrency
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      chunks.push(operations.slice(i, i + maxConcurrency));
    }

    // Process chunks sequentially, operations within chunk concurrently
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (opConfig, index) => {
        try {
          const taskId = `${batchId}_${index}`;
          const result = await this.withRetry(
            opConfig.operation,
            opConfig.name || `batch_op_${index}`,
            { ...opConfig.retryOptions, taskId }
          );
          return { success: true, result, index };
        } catch (error) {
          return { success: false, error, index };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);
      
      for (const promiseResult of chunkResults) {
        if (promiseResult.status === 'fulfilled') {
          const opResult = promiseResult.value;
          if (opResult.success) {
            results.push(opResult.result);
          } else {
            errors.push(opResult.error);
            if (stopOnFirstError) {
              throw new Error(`Batch operation failed: ${opResult.error.message}`);
            }
          }
        } else {
          errors.push(promiseResult.reason);
          if (stopOnFirstError) {
            throw new Error(`Batch operation failed: ${promiseResult.reason.message}`);
          }
        }
      }
    }

    console.log(`✅ Batch operation ${batchId} completed: ${results.length} successful, ${errors.length} failed`);

    return {
      results,
      errors,
      totalCount: operations.length,
      successCount: results.length,
      errorCount: errors.length
    };
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChromeSafe;
} else if (typeof window !== 'undefined') {
  window.ChromeSafe = ChromeSafe;
} else if (typeof self !== 'undefined') {
  self.ChromeSafe = ChromeSafe;
}
// lib-utilities.js - Consolidated library utilities for STEPTHREE V2
// Combines css-path.js, secure-dom.js, and worker-manager.js to reduce file count

// =============================================================================
// COMMON UTILITIES (from common-utils.js - shared across extension)
// =============================================================================

// Enhanced CSS Selector Validation and Safe Query Utilities
class StepThreeSelectorUtils {

  // Safe CSS selector validation with DoS protection
  static validateCSSSelector(selector) {
    if (!selector || typeof selector !== 'string') {
      return { valid: false, error: 'Selector cannot be empty' };
    }

    // Trim whitespace
    selector = selector.trim();
    if (!selector) {
      return { valid: false, error: 'Selector cannot be empty' };
    }

    // DoS Protection: Check selector length
    if (selector.length > 1000) {
      return {
        valid: false,
        error: 'Selector too long (max 1000 characters)',
        details: 'Long selectors can cause performance issues'
      };
    }

    // DoS Protection: Check for excessive nesting levels
    const nestingLevel = (selector.match(/\s+/g) || []).length;
    if (nestingLevel > 10) {
      return {
        valid: false,
        error: 'Selector too complex (max 10 nesting levels)',
        details: 'Deeply nested selectors can cause performance issues'
      };
    }

    // DoS Protection: Check for dangerous patterns
    const dangerousPatterns = [
      /\*\s*\*\s*\*/,          // Multiple universal selectors
      /:\w+\(\s*:\w+\(\s*:/,   // Nested pseudo-selectors
      /(\[\w+\*=)[^]]{50,}/,   // Very long attribute selectors with wildcards
      /(\+\s*){5,}/,           // Too many adjacent sibling selectors
      /(~\s*){5,}/,            // Too many general sibling selectors
      /(>\s*){8,}/             // Too many child selectors
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(selector)) {
        return {
          valid: false,
          error: 'Selector contains potentially dangerous patterns',
          details: 'Complex selectors with excessive wildcards or nesting can cause performance issues'
        };
      }
    }

    // DoS Protection: Limit pseudo-selector complexity
    const pseudoSelectors = (selector.match(/:[a-zA-Z-]+(\([^)]*\))?/g) || []).length;
    if (pseudoSelectors > 5) {
      return {
        valid: false,
        error: 'Too many pseudo-selectors (max 5)',
        details: 'Multiple pseudo-selectors can cause performance issues'
      };
    }

    try {
      // Performance test with timeout protection
      const testStartTime = performance.now();
      document.querySelectorAll(selector);
      const testDuration = performance.now() - testStartTime;

      if (testDuration > 100) { // 100ms threshold
        return {
          valid: false,
          error: 'Selector is too slow to execute',
          details: 'This selector takes too long to process and could cause performance issues'
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Invalid CSS selector syntax: ${error.message}`,
        details: 'Please check your selector syntax. Examples: ".class", "#id", "tag", "[attribute]"'
      };
    }

    return { valid: true, selector: selector };
  }

  // Safe querySelectorAll with validation
  static safeQuerySelectorAll(selector, context = document) {
    const validation = this.validateCSSSelector(selector);
    if (!validation.valid) {
      console.warn('Invalid CSS selector rejected:', validation.error);
      return [];
    }

    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      console.warn('Error executing selector:', error.message);
      return [];
    }
  }

  // Safe querySelector with validation
  static safeQuerySelector(selector, context = document) {
    const validation = this.validateCSSSelector(selector);
    if (!validation.valid) {
      console.warn('Invalid CSS selector rejected:', validation.error);
      return null;
    }

    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn('Error executing selector:', error.message);
      return null;
    }
  }
}

class StepThreeCommonUtils {
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

      if (part1 < part2) {
        return -1;
      }
      if (part1 > part2) {
        return 1;
      }
    }

    return 0;
  }

  // Storage utilities
  static async getStorageData(keys) {
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      console.error('Failed to get storage data:', error);
      return {};
    }
  }

  static async setStorageData(data) {
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Failed to set storage data:', error);
      return false;
    }
  }

  // Time utilities
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  static formatFileSize(bytes) {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Async utilities
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// CSS PATH UTILITIES (from css-path.js)
// =============================================================================

function getCssPath(el) {
  if (!(el instanceof Element)) {return '';}
  const parts = [];
  while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
      parts.unshift(selector);
      break;
    } else {
      // add nth-child for uniqueness among siblings
      let sib = el, nth = 1;
      while ((sib = sib.previousElementSibling)) {nth++;}
      selector += `:nth-child(${nth})`;
    }
    parts.unshift(selector);
    el = el.parentElement;
  }
  return parts.join(' > ');
}

// =============================================================================
// SECURE DOM UTILITIES (from secure-dom.js)
// =============================================================================

/**
 * Securely sets text content without HTML parsing
 * @param {HTMLElement} element - Target element
 * @param {string} content - Text content to set
 */
function setTextContent(element, content) {
  element.textContent = content;
}

/**
 * Securely creates HTML structure from simple templates
 * @param {string} tagName - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {string|HTMLElement|Array} content - Content to append
 * @returns {HTMLElement} Created element
 */
function createElement(tagName, attributes = {}, content = null) {
  const element = document.createElement(tagName);

  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  // Add content
  if (content !== null) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (content instanceof HTMLElement) {
      element.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (typeof item === 'string') {
          element.appendChild(document.createTextNode(item));
        } else if (item instanceof HTMLElement) {
          element.appendChild(item);
        }
      });
    }
  }

  return element;
}

/**
 * Replaces element content in a secure way
 * @param {HTMLElement} element - Target element
 * @param {string|HTMLElement|Array} content - New content
 */
function replaceContent(element, content) {
  // Clear existing content
  element.innerHTML = '';

  if (typeof content === 'string') {
    element.textContent = content;
  } else if (content instanceof HTMLElement) {
    element.appendChild(content);
  } else if (Array.isArray(content)) {
    content.forEach(item => {
      if (typeof item === 'string') {
        element.appendChild(document.createTextNode(item));
      } else if (item instanceof HTMLElement) {
        element.appendChild(item);
      }
    });
  }
}

/**
 * Creates a button with secure event handling
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @param {Object} options - Additional options
 * @returns {HTMLElement} Button element
 */
function createButton(text, onClick, options = {}) {
  const button = createElement('button', {
    textContent: text,
    className: options.className || '',
    style: options.style || {}
  });

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}

/**
 * Creates an input element with secure defaults
 * @param {string} type - Input type
 * @param {Object} options - Input options
 * @returns {HTMLElement} Input element
 */
/**
 * Creates a status indicator element
 * @param {string} message - Status message to display
 * @param {string} type - Status type ('success', 'error', 'warning', 'info')
 * @returns {HTMLElement} Status indicator element
 */
function createStatusIndicator(message, type = 'info') {
  const indicator = createElement('div', {
    textContent: message,
    className: `stepthree-status-indicator stepthree-status-${type}`,
    style: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '6px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      zIndex: '10000',
      maxWidth: '300px',
      wordWrap: 'break-word',
      transition: 'all 0.3s ease'
    }
  });

  // Set background color based on type
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  indicator.style.backgroundColor = colors[type] || colors.info;

  return indicator;
}

function createInput(type, options = {}) {
  const input = createElement('input', {
    type: type,
    placeholder: options.placeholder || '',
    value: options.value || '',
    className: options.className || '',
    style: options.style || {}
  });

  if (options.onChange) {
    input.addEventListener('input', options.onChange);
  }

  return input;
}

// =============================================================================
// WORKER MANAGER (from worker-manager.js)
// =============================================================================

class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.taskQueue = [];
    this.currentTasks = new Map();
    this.taskIdCounter = 0;
    this.maxWorkers = Math.min(navigator.hardwareConcurrency || 2, 4);
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create initial worker pool
      for (let i = 0; i < this.maxWorkers; i++) {
        await this.createWorker(`worker-${i}`);
      }

      this.isInitialized = true;
      console.log(`✅ Worker pool initialized with ${this.workers.size} workers`);
    } catch (error) {
      console.error('❌ Failed to initialize worker pool:', error);
      throw error;
    }
  }

  async createWorker(id) {
    try {
      const workerUrl = chrome.runtime.getURL('workers/heavy-operations-worker.js');
      const worker = new Worker(workerUrl);

      worker.onmessage = (event) => this.handleWorkerMessage(id, event);
      worker.onerror = (error) => this.handleWorkerError(id, error);

      this.workers.set(id, {
        worker,
        busy: false,
        tasks: new Set()
      });

      // Wait for worker to be ready
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 5000);

        const tempHandler = (event) => {
          if (event.data && event.data.type === 'ready') {
            clearTimeout(timeout);
            worker.removeEventListener('message', tempHandler);
            resolve();
          }
        };

        worker.addEventListener('message', tempHandler);
        worker.postMessage({ type: 'init' });
      });
    } catch (error) {
      console.error(`❌ Failed to create worker ${id}:`, error);
      throw error;
    }
  }

  async executeTask(operation, data = {}, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const taskId = ++this.taskIdCounter;
    const task = {
      id: taskId,
      operation,
      data,
      options,
      resolve: null,
      reject: null,
      startTime: Date.now()
    };

    return new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;

      const worker = this.getAvailableWorker();
      if (worker) {
        this.assignTaskToWorker(worker, task);
      } else {
        this.taskQueue.push(task);
      }

      // Set timeout if specified
      if (options.timeout) {
        setTimeout(() => {
          if (this.currentTasks.has(taskId)) {
            this.cancelTask(taskId);
            reject(new Error('Task timeout'));
          }
        }, options.timeout);
      }
    });
  }

  getAvailableWorker() {
    for (const [id, workerInfo] of this.workers) {
      if (!workerInfo.busy) {
        return { id, ...workerInfo };
      }
    }
    return null;
  }

  assignTaskToWorker(workerData, task) {
    const { id, worker } = workerData;
    const workerInfo = this.workers.get(id);

    workerInfo.busy = true;
    workerInfo.tasks.add(task.id);
    this.currentTasks.set(task.id, { workerId: id, task });

    worker.postMessage({
      type: 'task',
      taskId: task.id,
      operation: task.operation,
      data: task.data
    });
  }

  handleWorkerMessage(workerId, event) {
    const { type, taskId, result, error } = event.data;

    if (type === 'task-complete' || type === 'task-error') {
      const taskData = this.currentTasks.get(taskId);
      if (!taskData) {return;}

      const { task } = taskData;
      const workerInfo = this.workers.get(workerId);

      // Mark worker as available
      workerInfo.busy = false;
      workerInfo.tasks.delete(taskId);
      this.currentTasks.delete(taskId);

      // Resolve or reject the task
      if (type === 'task-complete') {
        task.resolve(result);
      } else {
        task.reject(new Error(error || 'Task failed'));
      }

      // Process next queued task
      this.processQueue();
    }
  }

  handleWorkerError(workerId, error) {
    console.error(`Worker ${workerId} error:`, error);

    // Restart failed worker
    this.restartWorker(workerId);
  }

  async restartWorker(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      // Terminate old worker
      workerInfo.worker.terminate();

      // Fail current tasks
      for (const taskId of workerInfo.tasks) {
        const taskData = this.currentTasks.get(taskId);
        if (taskData) {
          taskData.task.reject(new Error('Worker failed'));
          this.currentTasks.delete(taskId);
        }
      }

      // Create new worker
      try {
        await this.createWorker(workerId);
        this.processQueue();
      } catch (error) {
        console.error(`Failed to restart worker ${workerId}:`, error);
      }
    }
  }

  processQueue() {
    while (this.taskQueue.length > 0) {
      const worker = this.getAvailableWorker();
      if (!worker) {break;}

      const task = this.taskQueue.shift();
      this.assignTaskToWorker(worker, task);
    }
  }

  cancelTask(taskId) {
    const taskData = this.currentTasks.get(taskId);
    if (taskData) {
      taskData.task.reject(new Error('Task cancelled'));
      this.currentTasks.delete(taskId);

      const workerInfo = this.workers.get(taskData.workerId);
      if (workerInfo) {
        workerInfo.tasks.delete(taskId);
        if (workerInfo.tasks.size === 0) {
          workerInfo.busy = false;
        }
      }
    }
  }

  getStats() {
    return {
      workers: this.workers.size,
      busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.currentTasks.size
    };
  }

  terminate() {
    for (const workerInfo of this.workers.values()) {
      workerInfo.worker.terminate();
    }
    this.workers.clear();
    this.currentTasks.clear();
    this.taskQueue.length = 0;
    this.isInitialized = false;
  }
}

// =============================================================================
// INTERNATIONALIZATION (from i18n.js)
// =============================================================================

class I18nManager {
  constructor() {
    // Cache not needed for English-only extension
    // User-facing error messages for internationalization readiness
    this.errorMessages = {
      network: 'Network connection issue',
      cors: 'Website blocking external access',
      permission: 'Access permission denied',
      rateLimit: 'Too many requests - please wait',
      timeout: 'Request timed out',
      server: 'Server error on website',
      notFound: 'Image not found',
      format: 'Unsupported image format',
      memory: 'Memory limit reached',
      unknown: 'An error occurred processing your request'
    };
  }

  getMessage(key, substitutions = null, fallback = '') {
    // For English-only extension, just return fallback or key
    return fallback || key;
  }

  getMessages(keys) {
    const messages = {};
    keys.forEach(key => {
      messages[key] = this.getMessage(key);
    });
    return messages;
  }

  /**
   * Get user-friendly error message
   * Wraps technical errors in localization-aware functions for multi-language support
   * @param {string} errorType - Type of error (network, cors, permission, etc.)
   * @param {string} fallback - Fallback message if error type not found
   * @returns {string} User-friendly error message
   */
  getErrorMessage(errorType, fallback = null) {
    return this.errorMessages[errorType] || fallback || this.errorMessages.unknown;
  }

  /**
   * Set custom error messages (for future i18n support)
   * @param {Object} messages - Object with error types as keys and messages as values
   */
  setErrorMessages(messages) {
    this.errorMessages = { ...this.errorMessages, ...messages };
  }

  clearCache() {
    // No cache to clear in English-only version
  }
}

// =============================================================================
// ERROR BOUNDARY (from error-boundary.js)
// =============================================================================

class ErrorBoundary {
  constructor(options = {}) {
    this.options = {
      enableReporting: options.enableReporting ?? true,
      enableRecovery: options.enableRecovery ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      ...options
    };

    this.errorCount = 0;
    this.lastError = null;
    this.retryAttempts = new Map();

    this.initialize();
  }

  /**
   * Safely extract error message from any error type
   * @param {*} error - Error object, string, or any value
   * @returns {string} Safe error message string
   */
  getErrorMessage(error) {
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

  initialize() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        type: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: 'promise',
        promise: event.promise
      });
    });

    // Chrome extension specific error handler
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onConnect.addListener((port) => {
        port.onDisconnect.addListener(() => {
          if (chrome.runtime.lastError) {
            this.handleError(new Error(chrome.runtime.lastError.message), {
              type: 'chrome-runtime',
              port: port.name
            });
          }
        });
      });
    }
  }

  handleError(error, context = {}) {
    this.errorCount++;
    this.lastError = { error, context, timestamp: Date.now() };

    console.error('ErrorBoundary caught error:', error, context);

    if (this.options.enableReporting) {
      this.reportError(error, context);
    }

    if (this.options.enableRecovery) {
      this.attemptRecovery(error, context);
    }
  }

  reportError(error, context) {
    // Send error report to background script
    if (chrome?.runtime?.sendMessage) {
      const errorMessage = this.getErrorMessage(error);
      const errorName = (error instanceof Error) ? error.name : 'Error';
      const errorStack = (error instanceof Error) ? error.stack : null;
      
      chrome.runtime.sendMessage({
        action: 'errorReport',
        error: {
          message: errorMessage,
          stack: errorStack,
          name: errorName
        },
        context,
        timestamp: Date.now()
      }).catch(() => {
        // Ignore errors when sending error reports
      });
    }
  }

  attemptRecovery(error, context) {
    const errorMessage = this.getErrorMessage(error);
    const errorName = (error instanceof Error) ? error.name : 'Error';
    const errorKey = `${errorName}:${errorMessage}`;
    const attempts = this.retryAttempts.get(errorKey) || 0;

    if (attempts < this.options.maxRetries) {
      this.retryAttempts.set(errorKey, attempts + 1);

      setTimeout(() => {
        console.log(`Attempting recovery for error (attempt ${attempts + 1}):`, errorMessage);
        // Custom recovery logic can be added here
      }, this.options.retryDelay * (attempts + 1));
    } else {
      console.error(`Max retry attempts reached for error: ${errorMessage}`);
    }
  }

  wrapFunction(fn, context = {}) {
    return (...args) => {
      try {
        const result = fn.apply(this, args);
        if (result && typeof result.catch === 'function') {
          return result.catch(error => this.handleError(error, context));
        }
        return result;
      } catch (error) {
        this.handleError(error, context);
        throw error;
      }
    };
  }

  getStats() {
    return {
      errorCount: this.errorCount,
      lastError: this.lastError,
      retryAttempts: Object.fromEntries(this.retryAttempts)
    };
  }
}

// =============================================================================
// PERFORMANCE MONITOR (from performance-monitor.js)
// =============================================================================

class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      enableMemoryTracking: options.enableMemoryTracking ?? true,
      enableTimingTracking: options.enableTimingTracking ?? true,
      enableUserTiming: options.enableUserTiming ?? true,
      memoryWarningThreshold: options.memoryWarningThreshold ?? 100 * 1024 * 1024, // 100MB
      slowOperationThreshold: options.slowOperationThreshold ?? 5000, // 5 seconds
      maxHistoryEntries: options.maxHistoryEntries ?? 100,
      ...options
    };

    this.metrics = {
      memory: [],
      timing: new Map(),
      operations: [],
      warnings: []
    };

    this.activeOperations = new Map();
    this.initialize();
  }

  initialize() {
    // Start periodic memory monitoring
    if (this.options.enableMemoryTracking) {
      this.startMemoryMonitoring();
    }

    // Monitor long-running operations
    this.startOperationMonitoring();
  }

  startMemoryMonitoring() {
    const checkMemory = () => {
      if (performance.memory) {
        const memoryInfo = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          timestamp: Date.now()
        };

        this.metrics.memory.push(memoryInfo);

        // Keep only recent entries
        if (this.metrics.memory.length > this.options.maxHistoryEntries) {
          this.metrics.memory.shift();
        }

        // Check for memory warnings
        if (memoryInfo.used > this.options.memoryWarningThreshold) {
          this.addWarning('memory', `High memory usage: ${this.formatBytes(memoryInfo.used)}`);
        }
      }
    };

    // Check memory every 10 seconds
    checkMemory();
    setInterval(checkMemory, 10000);
  }

  startOperationMonitoring() {
    // Monitor for operations that take too long
    setInterval(() => {
      const now = Date.now();
      for (const [operationId, startTime] of this.activeOperations) {
        const duration = now - startTime;
        if (duration > this.options.slowOperationThreshold) {
          this.addWarning('performance', `Slow operation detected: ${operationId} (${duration}ms)`);
        }
      }
    }, 5000);
  }

  startOperation(operationId) {
    this.activeOperations.set(operationId, Date.now());

    if (this.options.enableUserTiming && performance.mark) {
      performance.mark(`${operationId}-start`);
    }

    return operationId;
  }

  endOperation(operationId) {
    const startTime = this.activeOperations.get(operationId);
    if (!startTime) {
      return null;
    }

    const duration = Date.now() - startTime;
    this.activeOperations.delete(operationId);

    const operation = {
      id: operationId,
      duration,
      timestamp: Date.now()
    };

    this.metrics.operations.push(operation);

    // Keep only recent entries
    if (this.metrics.operations.length > this.options.maxHistoryEntries) {
      this.metrics.operations.shift();
    }

    if (this.options.enableUserTiming && performance.mark && performance.measure) {
      performance.mark(`${operationId}-end`);
      performance.measure(operationId, `${operationId}-start`, `${operationId}-end`);
    }

    return operation;
  }

  addWarning(type, message) {
    const warning = {
      type,
      message,
      timestamp: Date.now()
    };

    this.metrics.warnings.push(warning);

    // Keep only recent warnings
    if (this.metrics.warnings.length > 50) {
      this.metrics.warnings.shift();
    }

    console.warn(`Performance warning (${type}): ${message}`);
  }

  formatBytes(bytes) {
    if (bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getMetrics() {
    return {
      memory: [...this.metrics.memory],
      operations: [...this.metrics.operations],
      warnings: [...this.metrics.warnings],
      activeOperations: this.activeOperations.size
    };
  }

  clearMetrics() {
    this.metrics.memory = [];
    this.metrics.operations = [];
    this.metrics.warnings = [];
    this.activeOperations.clear();
  }
}

// =============================================================================
// UPDATED GLOBAL EXPORTS
// =============================================================================

// Export functions for both ES modules and global use
// Utility helper functions for cross-module reuse
const isValidUrl = StepThreeCommonUtils.isValidUrl.bind(StepThreeCommonUtils);
const getErrorMessage = ErrorBoundary.prototype.getErrorMessage.bind({});

const LibUtilities = {
  StepThreeCommonUtils,
  getCssPath,
  setTextContent,
  createElement,
  replaceContent,
  createButton,
  createStatusIndicator,
  createInput,
  WorkerManager,
  I18nManager,
  ErrorBoundary,
  PerformanceMonitor,
  // Modular utility functions for cross-module reuse
  isValidUrl,
  getErrorMessage
};

// Make available globally
if (typeof window !== 'undefined') {
  window.StepThreeCommonUtils = StepThreeCommonUtils;
  window.getCssPath = getCssPath;
  window.setTextContent = setTextContent;
  window.createElement = createElement;
  window.replaceContent = replaceContent;
  window.createButton = createButton;
  window.createStatusIndicator = createStatusIndicator;
  window.createInput = createInput;
  window.WorkerManager = WorkerManager;
  window.I18nManager = I18nManager;
  window.ErrorBoundary = ErrorBoundary;
  window.PerformanceMonitor = PerformanceMonitor;
  window.LibUtilities = LibUtilities;
  
  // Modular utility functions
  window.isValidUrl = isValidUrl;
  window.getErrorMessage = getErrorMessage;

  // For backward compatibility
  window.StepThreeUtils = StepThreeCommonUtils;
}

// For service worker/importScripts environment
if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
  self.StepThreeCommonUtils = StepThreeCommonUtils;
  self.getCssPath = getCssPath;
  self.setTextContent = setTextContent;
  self.createElement = createElement;
  self.replaceContent = replaceContent;
  self.createButton = createButton;
  self.createStatusIndicator = createStatusIndicator;
  self.createInput = createInput;
  self.WorkerManager = WorkerManager;
  self.I18nManager = I18nManager;
  self.ErrorBoundary = ErrorBoundary;
  self.PerformanceMonitor = PerformanceMonitor;
  self.LibUtilities = LibUtilities;
  
  // Modular utility functions
  self.isValidUrl = isValidUrl;
  self.getErrorMessage = getErrorMessage;

  // For backward compatibility
  self.StepThreeUtils = StepThreeCommonUtils;
}

// ES modules export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibUtilities;
}
// mv3-safe-dom.js - MV3 Compliant DOM Manipulation Utilities
// Provides safe alternatives to innerHTML and other CSP-violating methods

/**
 * MV3SafeDOM - CSP-compliant DOM manipulation utilities
 * Provides safe alternatives to innerHTML, outerHTML, and other CSP violations
 * 
 * CSP (Content Security Policy) Readiness:
 * ==========================================
 * This utility class ensures full compliance with Chrome Extension Manifest V3 CSP restrictions:
 * 
 * 1. NO innerHTML/outerHTML: All methods use createElement() and textContent instead
 * 2. NO eval() or Function(): All code is statically defined
 * 3. NO inline event handlers: Use addEventListener() instead
 * 4. NO inline scripts: All scripts are in external files
 * 5. NO data: URIs for scripts: Only safe content types (images) allowed
 * 
 * These methods work in CSP-locked environments (strict-dynamic, nonce-based, hash-based CSP)
 * and are safe for use in:
 * - Chrome Extension pages (popup, sidepanel, options)
 * - Content scripts injected into web pages
 * - Sandboxed iframes
 * - Web pages with strict CSP headers
 * 
 * @example
 * // Instead of: element.innerHTML = '<div>Hello</div>';
 * // Use: MV3SafeDOM.clearElement(element);
 * //      const div = MV3SafeDOM.createElement('div', {}, 'Hello');
 * //      element.appendChild(div);
 */
class MV3SafeDOM {
  /**
   * Safely clear all children from an element (replaces innerHTML = '')
   * @param {Element} element - Element to clear
   */
  static clearElement(element) {
    if (!element) return;
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Safely set text content (replaces innerHTML for text-only)
   * @param {Element} element - Target element
   * @param {string} text - Text content
   */
  static setTextContent(element, text) {
    if (!element) return;
    element.textContent = text || '';
  }

  /**
   * Safely create and append text node
   * @param {Element} parent - Parent element
   * @param {string} text - Text content
   * @returns {Text} Created text node
   */
  static appendText(parent, text) {
    if (!parent || !text) return null;
    const textNode = document.createTextNode(text);
    parent.appendChild(textNode);
    return textNode;
  }

  /**
   * Safely create element with attributes and text
   * @param {string} tag - HTML tag name
   * @param {object} attributes - Element attributes
   * @param {string} textContent - Text content
   * @returns {Element} Created element
   */
  static createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    // Set attributes safely
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });

    // Set text content safely
    if (textContent) {
      element.textContent = textContent;
    }

    return element;
  }

  /**
   * Safely create SVG element (common in UI)
   * @param {string} svgString - SVG markup
   * @returns {SVGElement} Created SVG element
   */
  static createSVGFromString(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;
    return document.importNode(svg, true);
  }

  /**
   * Safely create icon element (replaces icon innerHTML patterns)
   * @param {string} iconType - Icon type (svg, emoji, etc.)
   * @param {string} iconContent - Icon content
   * @param {object} attributes - Element attributes
   * @returns {Element} Created icon element
   */
  static createIcon(iconType, iconContent, attributes = {}) {
    let iconElement;

    if (iconType === 'svg') {
      iconElement = this.createSVGFromString(iconContent);
    } else if (iconType === 'emoji') {
      iconElement = this.createElement('span', attributes, iconContent);
    } else {
      iconElement = this.createElement('span', attributes);
      iconElement.textContent = iconContent;
    }

    return iconElement;
  }

  /**
   * Safely build complex DOM structure (replaces complex innerHTML)
   * @param {Element} parent - Parent element
   * @param {object} structure - DOM structure description
   */
  static buildStructure(parent, structure) {
    if (!parent || !structure) return;

    const { tag, attributes = {}, textContent, children = [] } = structure;
    
    const element = this.createElement(tag, attributes, textContent);
    parent.appendChild(element);

    // Recursively build children
    children.forEach(child => {
      if (typeof child === 'string') {
        this.appendText(element, child);
      } else {
        this.buildStructure(element, child);
      }
    });

    return element;
  }

  /**
   * Safely replace element content with structured data
   * @param {Element} element - Target element
   * @param {object|string} content - Content to set
   */
  static replaceContent(element, content) {
    if (!element) return;

    this.clearElement(element);

    if (typeof content === 'string') {
      this.setTextContent(element, content);
    } else if (content && typeof content === 'object') {
      this.buildStructure(element, content);
    }
  }

  /**
   * Safely create button with icon and text (common pattern)
   * @param {string} iconHtml - SVG icon markup
   * @param {string} text - Button text
   * @param {object} attributes - Button attributes
   * @returns {Element} Created button
   */
  static createButton(iconHtml, text, attributes = {}) {
    const button = this.createElement('button', attributes);
    
    if (iconHtml) {
      const iconElement = this.createSVGFromString(iconHtml);
      button.appendChild(iconElement);
    }
    
    if (text) {
      const textSpan = this.createElement('span', {}, text);
      button.appendChild(textSpan);
    }

    return button;
  }

  /**
   * Safely create image element with error fallback
   * @param {string} src - Image source
   * @param {string} alt - Alt text
   * @param {string} fallbackContent - Fallback content for errors
   * @param {object} attributes - Additional attributes
   * @returns {Element} Created image or fallback element
   */
  static createImageWithFallback(src, alt = '', fallbackContent = '🖼️', attributes = {}) {
    const container = this.createElement('div', { className: 'image-container' });
    
    if (src) {
      const img = this.createElement('img', { 
        src, 
        alt,
        loading: 'lazy',
        ...attributes 
      });
      
      img.onerror = () => {
        this.clearElement(container);
        this.setTextContent(container, fallbackContent);
        container.className = 'image-fallback';
      };
      
      container.appendChild(img);
    } else {
      this.setTextContent(container, fallbackContent);
      container.className = 'image-fallback';
    }

    return container;
  }

  /**
   * Safely create list from array data
   * @param {Array} items - Array of items
   * @param {Function} itemRenderer - Function to render each item
   * @param {object} listAttributes - List element attributes
   * @returns {Element} Created list element
   */
  static createList(items, itemRenderer, listAttributes = {}) {
    const list = this.createElement('ul', listAttributes);
    
    items.forEach((item, index) => {
      const listItem = this.createElement('li');
      const renderedContent = itemRenderer(item, index);
      
      if (typeof renderedContent === 'string') {
        this.setTextContent(listItem, renderedContent);
      } else if (renderedContent instanceof Element) {
        listItem.appendChild(renderedContent);
      }
      
      list.appendChild(listItem);
    });

    return list;
  }

  /**
   * Safely create progress indicator
   * @param {number} percentage - Progress percentage (0-100)
   * @param {string} text - Progress text
   * @param {object} attributes - Container attributes
   * @returns {Element} Created progress element
   */
  static createProgressIndicator(percentage, text, attributes = {}) {
    const container = this.createElement('div', { 
      className: 'progress-container',
      ...attributes 
    });
    
    const progressBar = this.createElement('div', { className: 'progress-bar' });
    const progressFill = this.createElement('div', { 
      className: 'progress-fill',
      style: { width: `${Math.min(100, Math.max(0, percentage))}%` }
    });
    
    progressBar.appendChild(progressFill);
    container.appendChild(progressBar);
    
    if (text) {
      const textElement = this.createElement('div', { className: 'progress-text' }, text);
      container.appendChild(textElement);
    }

    return container;
  }
}

// Make globally available for MV3 compliance fixes
if (typeof window !== 'undefined') {
  window.MV3SafeDOM = MV3SafeDOM;
}

// unified-logger.js - Comprehensive unified logging system for STEPTHREE Chrome extension
// Provides centralized logging with memory management, export capabilities, and global availability

console.log('🔧 Loading Unified Logger System...');

/**
 * UnifiedLogger - Centralized logging system with memory management and export capabilities
 * Provides consistent logging across the entire extension with export functionality
 */
class UnifiedLogger {
  constructor(options = {}) {
    // Configuration options
    this.options = {
      maxEntries: options.maxEntries || 500,
      enableConsoleOutput: options.enableConsoleOutput !== false,
      enableTimestamps: options.enableTimestamps !== false,
      enableStackTrace: options.enableStackTrace !== false,
      dateFormat: options.dateFormat || 'ISO', // 'ISO' or 'readable'
      autoCleanupThreshold: options.autoCleanupThreshold || 0.8, // Cleanup when 80% full
      ...options
    };

    // Log levels configuration with styling
    this.logLevels = {
      DEBUG: {
        name: 'DEBUG',
        priority: 0,
        style: {
          color: '#6b7280',
          backgroundColor: '#f3f4f6',
          icon: '🔍'
        },
        consoleMethod: 'log'
      },
      INFO: {
        name: 'INFO',
        priority: 1,
        style: {
          color: '#2563eb',
          backgroundColor: '#eff6ff',
          icon: 'ℹ️'
        },
        consoleMethod: 'info'
      },
      ERROR: {
        name: 'ERROR',
        priority: 2,
        style: {
          color: '#dc2626',
          backgroundColor: '#fef2f2',
          icon: '❌'
        },
        consoleMethod: 'error'
      }
    };

    // Internal state
    this.logs = [];
    this.isLogging = false; // Thread-safety flag
    this.logQueue = []; // Queue for thread-safe logging
    this.sessionId = this.generateSessionId();
    this.initialized = false;

    // Statistics
    this.stats = {
      totalLogs: 0,
      logsByLevel: {
        DEBUG: 0,
        INFO: 0,
        ERROR: 0
      },
      sessionsCreated: 0,
      exportsGenerated: 0,
      memoryCleanups: 0
    };

    // Initialize the logger
    this.initialize();
  }

  /**
   * Initialize the logger system
   */
  initialize() {
    try {
      // Set up global error handlers to capture unhandled errors
      this.setupGlobalErrorCapture();
      
      // Start log processing queue
      this.startLogProcessor();
      
      // Mark as initialized
      this.initialized = true;
      
      // Log initial system information using console.log to avoid potential recursion
      console.log(`✅ Unified Logger initialized - Session: ${this.sessionId}, Max Entries: ${this.options.maxEntries}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Unified Logger:', error);
      throw error;
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Format timestamp according to configuration
   */
  formatTimestamp(date) {
    if (!this.options.enableTimestamps) {
      return null;
    }

    if (this.options.dateFormat === 'ISO') {
      return date.toISOString();
    } else {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    }
  }

  /**
   * Get stack trace for debugging
   */
  getStackTrace() {
    if (!this.options.enableStackTrace) {
      return null;
    }

    try {
      const stack = new Error().stack;
      return stack
        .split('\n')
        .slice(3) // Remove logger internal calls
        .join('\n');
    } catch (error) {
      return 'Stack trace unavailable';
    }
  }

  /**
   * Thread-safe logging implementation
   */
  async safeLog(level, message, metadata = {}) {
    // Add to queue for processing
    this.logQueue.push({
      level,
      message,
      metadata,
      timestamp: new Date(),
      stackTrace: this.getStackTrace()
    });

    // Process queue if not already processing
    if (!this.isLogging) {
      await this.processLogQueue();
    }
  }

  /**
   * Process log queue in a thread-safe manner
   */
  async processLogQueue() {
    if (this.isLogging || this.logQueue.length === 0) {
      return;
    }

    this.isLogging = true;

    try {
      while (this.logQueue.length > 0) {
        const logEntry = this.logQueue.shift();
        await this.createLogEntry(logEntry);
      }
    } catch (error) {
      console.error('❌ Error processing log queue:', error);
    } finally {
      this.isLogging = false;
    }
  }

  /**
   * Create and store log entry
   */
  async createLogEntry({ level, message, metadata, timestamp, stackTrace }) {
    const levelConfig = this.logLevels[level];
    if (!levelConfig) {
      console.warn(`Unknown log level: ${level}`);
      return;
    }

    // Create log entry
    const logEntry = {
      id: this.generateLogId(),
      level: level,
      message: String(message),
      metadata: metadata || {},
      timestamp: timestamp,
      formattedTimestamp: this.formatTimestamp(timestamp),
      sessionId: this.sessionId,
      stackTrace: stackTrace,
      style: levelConfig.style
    };

    // Add to logs array
    this.logs.push(logEntry);

    // Update statistics
    this.stats.totalLogs++;
    this.stats.logsByLevel[level]++;

    // Console output if enabled
    if (this.options.enableConsoleOutput) {
      this.outputToConsole(logEntry, levelConfig);
    }

    // Check for memory cleanup
    await this.checkMemoryCleanup();

    return logEntry;
  }

  /**
   * Generate unique log ID
   */
  generateLogId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `log_${timestamp}_${random}`;
  }

  /**
   * Output log to console with styling
   */
  outputToConsole(logEntry, levelConfig) {
    try {
      const style = levelConfig.style;
      const prefix = `${style.icon} [${levelConfig.name}]`;
      const timestamp = logEntry.formattedTimestamp ? `[${logEntry.formattedTimestamp}]` : '';
      const message = `${prefix} ${timestamp} ${logEntry.message}`;

      // Use appropriate console method
      const consoleMethod = console[levelConfig.consoleMethod] || console.log;
      
      if (Object.keys(logEntry.metadata).length > 0) {
        consoleMethod(`%c${message}`, `color: ${style.color}; background-color: ${style.backgroundColor}; padding: 2px 4px; border-radius: 3px;`, logEntry.metadata);
      } else {
        consoleMethod(`%c${message}`, `color: ${style.color}; background-color: ${style.backgroundColor}; padding: 2px 4px; border-radius: 3px;`);
      }

      // Show stack trace for errors if available
      if (levelConfig.name === 'ERROR' && logEntry.stackTrace) {
        console.group('Stack Trace:');
        console.log(logEntry.stackTrace);
        console.groupEnd();
      }
    } catch (error) {
      // Fallback to basic console.log
      console.log(`[${levelConfig.name}] ${logEntry.message}`);
    }
  }

  /**
   * Check if memory cleanup is needed
   */
  async checkMemoryCleanup() {
    // Only trigger cleanup AFTER exceeding maxEntries (500), not before
    if (this.logs.length > this.options.maxEntries) {
      await this.performMemoryCleanup();
    }
  }

  /**
   * Perform memory cleanup by removing oldest entries
   */
  async performMemoryCleanup() {
    const targetSize = this.options.maxEntries; // Trim to exactly maxEntries (500)
    const removedCount = this.logs.length - targetSize;
    
    if (removedCount > 0) {
      const removedLogs = this.logs.splice(0, removedCount);
      this.stats.memoryCleanups++;
      
      // Use console.log directly to avoid infinite recursion - this doesn't go through the logging system
      console.log(`🧹 [CLEANUP] Memory cleanup performed: removed ${removedCount} oldest log entries. Remaining: ${this.logs.length}, Cleanup #${this.stats.memoryCleanups}`);
    }
  }

  /**
   * Start log processor for continuous queue processing
   */
  startLogProcessor() {
    // Process queue every 100ms
    setInterval(() => {
      if (this.logQueue.length > 0 && !this.isLogging) {
        this.processLogQueue();
      }
    }, 100);
  }

  /**
   * Setup global error capture
   */
  setupGlobalErrorCapture() {
    // Only setup in browser environment
    if (typeof window !== 'undefined') {
      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        // Use console.error directly to avoid potential recursion during error handling
        console.error('❌ [GLOBAL] Unhandled Promise Rejection:', event.reason);
      });

      // Capture global errors
      window.addEventListener('error', (event) => {
        // Use console.error directly to avoid potential recursion during error handling
        console.error(`❌ [GLOBAL] Global Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
      });
    }
  }

  /**
   * PUBLIC API METHODS
   */

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} metadata - Additional metadata
   */
  debug(message, metadata = {}) {
    return this.safeLog('DEBUG', message, metadata);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} metadata - Additional metadata
   */
  info(message, metadata = {}) {
    return this.safeLog('INFO', message, metadata);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} metadata - Additional metadata
   */
  error(message, metadata = {}) {
    return this.safeLog('ERROR', message, metadata);
  }

  /**
   * Get all logs
   * @param {Object} options - Filtering options
   * @returns {Array} Array of log entries
   */
  getLogs(options = {}) {
    let filteredLogs = [...this.logs];

    // Filter by level
    if (options.level) {
      filteredLogs = filteredLogs.filter(log => log.level === options.level);
    }

    // Filter by date range
    if (options.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= options.startDate);
    }
    if (options.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= options.endDate);
    }

    // Filter by session
    if (options.sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === options.sessionId);
    }

    // Limit results
    if (options.limit) {
      filteredLogs = filteredLogs.slice(-options.limit);
    }

    return filteredLogs;
  }

  /**
   * Export logs as downloadable .txt file
   * @param {Object} options - Export options
   * @returns {string} Download URL for the exported file
   */
  exportLogs(options = {}) {
    try {
      // Get logs to export
      const logsToExport = this.getLogs(options.filter || {});
      
      // Generate export content
      const exportContent = this.generateExportContent(logsToExport, options);
      
      // Create blob and download URL
      const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = options.filename || `stepthree-logs-${timestamp}.txt`;
      
      // Trigger download
      if (typeof window !== 'undefined' && window.document) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      // Update statistics
      this.stats.exportsGenerated++;
      
      // Use console.log directly to avoid potential recursion
      console.log(`📁 [EXPORT] Log export completed: ${filename} (${logsToExport.length} logs, export #${this.stats.exportsGenerated})`);

      return url;
    } catch (error) {
      // Use console.log directly to avoid potential recursion
      console.error('❌ [EXPORT] Failed to export logs:', error.message);
      throw error;
    }
  }

  /**
   * Generate export content string
   */
  generateExportContent(logs, options = {}) {
    const includeMetadata = options.includeMetadata !== false;
    const includeStackTrace = options.includeStackTrace !== false;
    const separator = options.separator || '================================================================================';
    
    let content = `StepThree Gallery Scraper - Log Export
Generated: ${new Date().toISOString()}
Session ID: ${this.sessionId}
Total Logs: ${logs.length}
${separator}

`;

    // Add statistics summary
    const logsByLevel = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {});

    content += `LOG SUMMARY:
${Object.entries(logsByLevel).map(([level, count]) => `${level}: ${count}`).join('\n')}

${separator}

LOG ENTRIES:

`;

    // Add individual log entries
    logs.forEach((log, index) => {
      content += `[${index + 1}] ${log.formattedTimestamp || log.timestamp} [${log.level}] ${log.message}\n`;
      
      if (includeMetadata && Object.keys(log.metadata).length > 0) {
        content += `    Metadata: ${JSON.stringify(log.metadata, null, 2)}\n`;
      }
      
      if (includeStackTrace && log.stackTrace && log.level === 'ERROR') {
        content += `    Stack Trace:\n${log.stackTrace}\n`;
      }
      
      content += '\n';
    });

    content += `${separator}
Export completed: ${new Date().toISOString()}
`;

    return content;
  }

  /**
   * Get logger statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentLogCount: this.logs.length,
      maxEntries: this.options.maxEntries,
      memoryUsage: Math.round((this.logs.length / this.options.maxEntries) * 100),
      sessionId: this.sessionId,
      queueSize: this.logQueue.length,
      isProcessing: this.isLogging
    };
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    const clearedCount = this.logs.length;
    this.logs = [];
    
    // Reset level statistics
    Object.keys(this.stats.logsByLevel).forEach(level => {
      this.stats.logsByLevel[level] = 0;
    });
    
    // Use console.log directly to avoid potential recursion
    console.log(`🧹 [CLEAR] All logs cleared. Count: ${clearedCount}`);
    
    return clearedCount;
  }

  /**
   * Set log level (for filtering console output)
   */
  setLogLevel(minLevel) {
    const levelPriorities = {
      'DEBUG': 0,
      'INFO': 1,
      'ERROR': 2
    };
    
    this.minLogLevel = levelPriorities[minLevel] || 0;
    // Use console.log directly to avoid potential recursion
    console.log(`⚙️ [CONFIG] Log level set to ${minLevel} (priority: ${this.minLogLevel})`);
  }

  /**
   * Destroy logger and clean up resources
   */
  destroy() {
    this.logs = [];
    this.logQueue = [];
    this.isLogging = false;
    this.initialized = false;
    
    // Use console.log directly to avoid potential recursion
    console.log('🗑️ [DESTROY] Unified Logger destroyed');
  }
}

// Create global instance
const logger = new UnifiedLogger({
  maxEntries: 500,
  enableConsoleOutput: true,
  enableTimestamps: true,
  enableStackTrace: true
});

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UnifiedLogger, logger };
} else if (typeof window !== 'undefined') {
  window.UnifiedLogger = UnifiedLogger;
  window.logger = logger;
} else if (typeof self !== 'undefined') {
  self.UnifiedLogger = UnifiedLogger;
  self.logger = logger;
} else if (typeof globalThis !== 'undefined') {
  globalThis.UnifiedLogger = UnifiedLogger;
  globalThis.logger = logger;
}