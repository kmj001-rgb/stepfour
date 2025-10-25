// message-schema.js - Centralized Message Schema for STEPTHREE Chrome Extension
// Defines typed message contracts, action constants, and validation functions
// for communication between service worker, content scripts, popup, and dashboard

console.log('📋 Loading Message Schema...');

/**
 * Action Constants - All possible actions in the STEPTHREE system
 */
const MESSAGE_ACTIONS = {
  // Scanning actions
  SCAN_START: 'SCAN_START',
  SCAN_STATUS: 'SCAN_STATUS', 
  SCAN_CANCEL: 'SCAN_CANCEL',
  SCAN_STOP: 'SCAN_STOP',
  SCAN_STARTED: 'SCAN_STARTED',
  SCAN_PROGRESS: 'SCAN_PROGRESS',
  SCAN_COMPLETE: 'SCAN_COMPLETE',
  SCAN_ERROR: 'SCAN_ERROR',
  SCAN_STOPPED: 'SCAN_STOPPED',
  DETECT_TABLES: 'DETECT_TABLES',
  SMART_DETECT: 'SMART_DETECT',
  ACTIVATE_SELECTOR: 'ACTIVATE_SELECTOR',
  
  // Download actions
  DOWNLOAD_ENQUEUE: 'DOWNLOAD_ENQUEUE',
  DOWNLOAD_CANCEL: 'DOWNLOAD_CANCEL',
  DOWNLOAD_STATUS: 'DOWNLOAD_STATUS',
  DOWNLOAD_PAUSE: 'DOWNLOAD_PAUSE',
  DOWNLOAD_RESUME: 'DOWNLOAD_RESUME',
  DOWNLOAD_CLEAR: 'DOWNLOAD_CLEAR',
  
  // Export actions
  EXPORT_PREPARE: 'EXPORT_PREPARE',
  EXPORT_RUN: 'EXPORT_RUN',
  EXPORT_CANCEL: 'EXPORT_CANCEL',
  EXPORT_STATUS: 'EXPORT_STATUS',
  
  // Permission actions
  PERMISSION_PROMPT: 'PERMISSION_PROMPT',
  PERMISSION_CHECK: 'PERMISSION_CHECK',
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // UI subscription actions
  UI_SUBSCRIBE: 'UI_SUBSCRIBE',
  UI_UNSUBSCRIBE: 'UI_UNSUBSCRIBE',
  UI_UPDATE: 'UI_UPDATE',
  
  // Health and maintenance
  HEALTH_PING: 'HEALTH_PING',
  HEALTH_STATUS: 'HEALTH_STATUS',
  
  // Port management
  PORT_CONNECT: 'PORT_CONNECT',
  PORT_DISCONNECT: 'PORT_DISCONNECT',
  PORT_KEEPALIVE: 'PORT_KEEPALIVE',
  
  // Internal routing
  ROUTE_TO_CONTENT: 'ROUTE_TO_CONTENT',
  ROUTE_TO_UI: 'ROUTE_TO_UI',
  BROADCAST_UPDATE: 'BROADCAST_UPDATE',
  
  // Analytics actions
  ANALYTICS_START: 'ANALYTICS_START',
  ANALYTICS_STOP: 'ANALYTICS_STOP',
  ANALYTICS_GET_STATS: 'ANALYTICS_GET_STATS'
};

/**
 * Source Types - Where messages originate from
 */
const MESSAGE_SOURCES = {
  SERVICE_WORKER: 'service_worker',
  CONTENT_SCRIPT: 'content_script',
  POPUP: 'popup',
  DASHBOARD: 'dashboard',
  OPTIONS: 'options',
  SIDEPANEL: 'sidepanel',
  SYSTEM: 'system'
};

/**
 * Port Names - Named port channels for persistent connections
 */
const PORT_NAMES = {
  POPUP: 'stepthree-popup',
  DASHBOARD: 'stepthree-dashboard',
  SIDEPANEL: 'stepthree-sidepanel',
  OPTIONS: 'stepthree-options',
  KEEPALIVE: 'stepthree-keepalive'
};

/**
 * Update Types - Categories of live updates
 */
const UPDATE_TYPES = {
  SCAN_PROGRESS: 'scan_progress',
  DOWNLOAD_PROGRESS: 'download_progress', 
  EXPORT_PROGRESS: 'export_progress',
  QUEUE_STATUS: 'queue_status',
  PERMISSION_STATUS: 'permission_status',
  HEALTH_STATUS: 'health_status',
  ERROR: 'error',
  WARNING: 'warning',
  SUCCESS: 'success',
  // Retry manager update types
  RETRY_ATTEMPT: 'retry_attempt',
  RETRY_SUCCESS: 'retry_success',
  RETRY_FAILURE: 'retry_failure',
  RETRY_SCHEDULED: 'retry_scheduled',
  RETRY_CANCELLED: 'retry_cancelled',
  RETRY_MANAGER_INITIALIZED: 'retry_manager_initialized',
  RETRY_MANAGER_ERROR: 'retry_manager_error',
  RETRY_TASK_ERROR: 'retry_task_error',
  CIRCUIT_BREAKER_TRIGGERED: 'circuit_breaker_triggered',
  CIRCUIT_BREAKER_RESET: 'circuit_breaker_reset',
  // Analytics update types
  PATTERN_ANALYTICS: 'pattern_analytics',
  PATTERN_CHOICE: 'pattern_choice',
  PATTERN_CONFIDENCE: 'pattern_confidence'
};

/**
 * Message Priority Levels - For backpressure management
 */
const MESSAGE_PRIORITY = {
  CRITICAL: 0,   // Health, errors, permission issues
  HIGH: 1,       // User actions, downloads
  MEDIUM: 2,     // Progress updates, status changes
  LOW: 3         // Keepalive, background maintenance
};

/**
 * Typed Message Contract
 * @typedef {Object} StepThreeMessage
 * @property {string} type - Deprecated, use action instead
 * @property {string} action - The action to perform (from MESSAGE_ACTIONS)
 * @property {string} requestId - Unique identifier for request/response correlation
 * @property {string} source - Where the message originated (from MESSAGE_SOURCES)
 * @property {Object} payload - Action-specific data
 * @property {number} [priority] - Message priority level (from MESSAGE_PRIORITY)
 * @property {number} [timestamp] - When message was created
 * @property {number} [timeout] - Timeout in milliseconds for response
 */

/**
 * Typed Response Contract
 * @typedef {Object} StepThreeResponse
 * @property {boolean} ok - Whether the operation succeeded
 * @property {*} [data] - Response data if successful
 * @property {string} [error] - Error message if failed
 * @property {string} requestId - Matching requestId from original message
 * @property {number} [timestamp] - When response was created
 * @property {Object} [metadata] - Additional response metadata
 */

/**
 * Broadcast Update Contract
 * @typedef {Object} StepThreeBroadcast
 * @property {string} action - Always BROADCAST_UPDATE
 * @property {string} updateType - Type of update (from UPDATE_TYPES)
 * @property {Object} data - Update data
 * @property {number} timestamp - When update was created
 * @property {string[]} [targets] - Specific targets (default: all subscribers)
 * @property {number} [priority] - Update priority level
 */

/**
 * Message Validation Functions
 */
class MessageValidator {
  
  /**
   * Normalize incoming message to ensure proper format with backward compatibility
   * @param {*} rawMessage - Raw incoming message
   * @param {Object} sender - Chrome sender object
   * @returns {Object} Normalized message
   */
  static normalizeMessage(rawMessage, sender = null) {
    try {
      // Start with a copy of the original message
      const message = { ...rawMessage };

      // Handle legacy 'type' field -> 'action'
      if (!message.action && message.type) {
        message.action = message.type;
      }
      
      // Generate requestId if missing
      if (!message.requestId) {
        const source = sender?.tab ? 'content' : 'ui';
        message.requestId = `${Date.now()}_${source}_${Math.random().toString(36).substring(2, 11)}`;
      }

      // Determine source if missing
      if (!message.source) {
        if (sender?.tab) {
          message.source = MESSAGE_SOURCES.CONTENT_SCRIPT;
        } else if (sender?.url?.includes('sidepanel')) {
          message.source = MESSAGE_SOURCES.SIDEPANEL;
        } else if (sender?.url?.includes('popup')) {
          message.source = MESSAGE_SOURCES.POPUP;
        } else if (sender?.url?.includes('dashboard')) {
          message.source = MESSAGE_SOURCES.DASHBOARD;
        } else if (sender?.url?.includes('options')) {
          message.source = MESSAGE_SOURCES.OPTIONS;
        } else {
          // Default fallback
          message.source = MESSAGE_SOURCES.SYSTEM;
        }
      }

      // Normalize payload
      if (message.payload === undefined || message.payload === null) {
        message.payload = {};
      } else if (typeof message.payload !== 'object') {
        // Wrap non-object payloads
        message.payload = { data: message.payload };
      }

      // Set default priority if missing
      if (message.priority === undefined) {
        message.priority = MessageValidator.getDefaultPriority(message.action);
      }

      // Set timestamp if missing
      if (message.timestamp === undefined) {
        message.timestamp = Date.now();
      }

      return message;

    } catch (error) {
      console.error('❌ Message normalization failed:', error);
      // Return a minimal valid message structure
      return {
        action: rawMessage?.action || rawMessage?.type || 'UNKNOWN_ACTION',
        requestId: `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        source: MESSAGE_SOURCES.SYSTEM,
        payload: rawMessage || {},
        priority: MESSAGE_PRIORITY.MEDIUM,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Validate a StepThree message format with enhanced error reporting
   * @param {*} message - Message to validate
   * @param {boolean} strict - Whether to use strict validation
   * @returns {Object} {valid: boolean, error?: string, warnings?: string[]}
   */
  static validateMessage(message, strict = false) {
    try {
      const warnings = [];
      
      // Check if message is an object
      if (!message || typeof message !== 'object') {
        return { valid: false, error: 'Message must be an object' };
      }

      // Check required fields
      const action = message.action || message.type; // Support legacy 'type' field
      if (!action || typeof action !== 'string') {
        return { valid: false, error: 'Message must have an action field' };
      }

      // Warn about legacy type field usage
      if (message.type && !message.action) {
        warnings.push('Using legacy "type" field, consider updating to "action"');
      }

      // Validate action is known (with more lenient handling for unknown actions)
      const validActions = Object.values(MESSAGE_ACTIONS);
      if (!validActions.includes(action)) {
        if (strict) {
          return { valid: false, error: `Unknown action: ${action}` };
        } else {
          warnings.push(`Unknown action "${action}" - message will be processed but may fail routing`);
        }
      }

      // Check requestId
      if (!message.requestId || typeof message.requestId !== 'string') {
        return { valid: false, error: 'Message must have a requestId field' };
      }

      // Check source
      if (!message.source || typeof message.source !== 'string') {
        return { valid: false, error: 'Message must have a source field' };
      }

      // Validate source is known
      const validSources = Object.values(MESSAGE_SOURCES);
      if (!validSources.includes(message.source)) {
        if (strict) {
          return { valid: false, error: `Unknown source: ${message.source}` };
        } else {
          warnings.push(`Unknown source "${message.source}" - using fallback handling`);
        }
      }

      // Payload is optional but must be object if present
      if (message.payload !== undefined && (typeof message.payload !== 'object' || message.payload === null)) {
        return { valid: false, error: 'Payload must be an object if provided' };
      }

      // Validate optional fields
      if (message.priority !== undefined) {
        const validPriorities = Object.values(MESSAGE_PRIORITY);
        if (!validPriorities.includes(message.priority)) {
          if (strict) {
            return { valid: false, error: 'Invalid priority level' };
          } else {
            warnings.push('Invalid priority level - using default');
          }
        }
      }

      if (message.timestamp !== undefined && typeof message.timestamp !== 'number') {
        if (strict) {
          return { valid: false, error: 'Timestamp must be a number' };
        } else {
          warnings.push('Invalid timestamp format - will be updated');
        }
      }

      if (message.timeout !== undefined && typeof message.timeout !== 'number') {
        if (strict) {
          return { valid: false, error: 'Timeout must be a number' };
        } else {
          warnings.push('Invalid timeout format - using default');
        }
      }

      return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };

    } catch (error) {
      return { valid: false, error: `Validation error: ${error.message}` };
    }
  }

  /**
   * Validate and normalize message in one step
   * @param {*} rawMessage - Raw incoming message
   * @param {Object} sender - Chrome sender object
   * @param {boolean} strict - Whether to use strict validation
   * @returns {Object} {valid: boolean, message?: Object, error?: string, warnings?: string[]}
   */
  static validateAndNormalize(rawMessage, sender = null, strict = false) {
    try {
      // First normalize the message
      const normalizedMessage = this.normalizeMessage(rawMessage, sender);
      
      // Then validate the normalized message
      const validation = this.validateMessage(normalizedMessage, strict);
      
      if (validation.valid) {
        return {
          valid: true,
          message: normalizedMessage,
          warnings: validation.warnings
        };
      } else {
        return {
          valid: false,
          message: normalizedMessage, // Still return normalized version for debugging
          error: validation.error,
          warnings: validation.warnings
        };
      }
      
    } catch (error) {
      return {
        valid: false,
        error: `Validation and normalization failed: ${error.message}`
      };
    }
  }

  /**
   * Validate a StepThree response format
   * @param {*} response - Response to validate
   * @returns {Object} {valid: boolean, error?: string}
   */
  static validateResponse(response) {
    try {
      // Check if response is an object
      if (!response || typeof response !== 'object') {
        return { valid: false, error: 'Response must be an object' };
      }

      // Check required fields
      if (typeof response.ok !== 'boolean') {
        return { valid: false, error: 'Response must have an ok boolean field' };
      }

      if (!response.requestId || typeof response.requestId !== 'string') {
        return { valid: false, error: 'Response must have a requestId field' };
      }

      // Validate conditional fields
      if (response.ok === false && !response.error) {
        return { valid: false, error: 'Failed response must include an error message' };
      }

      if (response.error !== undefined && typeof response.error !== 'string') {
        return { valid: false, error: 'Error must be a string' };
      }

      if (response.timestamp !== undefined && typeof response.timestamp !== 'number') {
        return { valid: false, error: 'Timestamp must be a number' };
      }

      if (response.metadata !== undefined && (typeof response.metadata !== 'object' || response.metadata === null)) {
        return { valid: false, error: 'Metadata must be an object if provided' };
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, error: `Response validation error: ${error.message}` };
    }
  }

  /**
   * Validate a broadcast update format
   * @param {*} broadcast - Broadcast to validate  
   * @returns {Object} {valid: boolean, error?: string}
   */
  static validateBroadcast(broadcast) {
    try {
      // Check if broadcast is an object
      if (!broadcast || typeof broadcast !== 'object') {
        return { valid: false, error: 'Broadcast must be an object' };
      }

      // Check required fields
      if (broadcast.action !== MESSAGE_ACTIONS.BROADCAST_UPDATE) {
        return { valid: false, error: 'Broadcast must have action: BROADCAST_UPDATE' };
      }

      if (!broadcast.updateType || typeof broadcast.updateType !== 'string') {
        return { valid: false, error: 'Broadcast must have an updateType field' };
      }

      // Validate updateType is known
      const validUpdateTypes = Object.values(UPDATE_TYPES);
      if (!validUpdateTypes.includes(broadcast.updateType)) {
        return { valid: false, error: `Unknown updateType: ${broadcast.updateType}` };
      }

      if (broadcast.data === undefined) {
        return { valid: false, error: 'Broadcast must have a data field' };
      }

      if (typeof broadcast.timestamp !== 'number') {
        return { valid: false, error: 'Broadcast must have a timestamp number' };
      }

      // Validate optional fields
      if (broadcast.targets !== undefined) {
        if (!Array.isArray(broadcast.targets)) {
          return { valid: false, error: 'Targets must be an array if provided' };
        }
        if (broadcast.targets.some(t => typeof t !== 'string')) {
          return { valid: false, error: 'All targets must be strings' };
        }
      }

      if (broadcast.priority !== undefined) {
        const validPriorities = Object.values(MESSAGE_PRIORITY);
        if (!validPriorities.includes(broadcast.priority)) {
          return { valid: false, error: 'Invalid priority level' };
        }
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, error: `Broadcast validation error: ${error.message}` };
    }
  }

  /**
   * Create a well-formed message
   * @param {string} action - The action to perform
   * @param {string} source - Source of the message
   * @param {Object} payload - Message payload
   * @param {Object} options - Optional settings
   * @returns {StepThreeMessage} Well-formed message
   */
  static createMessage(action, source, payload = {}, options = {}) {
    const message = {
      action,
      requestId: options.requestId || `${source}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      source,
      payload,
      timestamp: Date.now(),
      ...options
    };

    // Set default priority based on action
    if (message.priority === undefined) {
      message.priority = this.getDefaultPriority(action);
    }

    return message;
  }

  /**
   * Create a well-formed response
   * @param {string} requestId - Original request ID
   * @param {boolean} ok - Success status
   * @param {*} data - Response data
   * @param {string} error - Error message
   * @param {Object} metadata - Additional metadata
   * @returns {StepThreeResponse} Well-formed response
   */
  static createResponse(requestId, ok, data = null, error = null, metadata = {}) {
    const response = {
      ok,
      requestId,
      timestamp: Date.now(),
      ...metadata
    };

    if (ok) {
      response.data = data;
    } else {
      response.error = error || 'Unknown error';
    }

    if (Object.keys(metadata).length > 0) {
      response.metadata = metadata;
    }

    return response;
  }

  /**
   * Create a well-formed broadcast update
   * @param {string} updateType - Type of update
   * @param {*} data - Update data
   * @param {Object} options - Optional settings
   * @returns {StepThreeBroadcast} Well-formed broadcast
   */
  static createBroadcast(updateType, data, options = {}) {
    return {
      action: MESSAGE_ACTIONS.BROADCAST_UPDATE,
      updateType,
      data,
      timestamp: Date.now(),
      priority: options.priority || MESSAGE_PRIORITY.MEDIUM,
      ...options
    };
  }

  /**
   * Get default priority for an action
   * @param {string} action - Message action
   * @returns {number} Default priority level
   */
  static getDefaultPriority(action) {
    // Critical actions
    if ([
      MESSAGE_ACTIONS.HEALTH_PING,
      MESSAGE_ACTIONS.PERMISSION_PROMPT,
      MESSAGE_ACTIONS.PERMISSION_CHECK
    ].includes(action)) {
      return MESSAGE_PRIORITY.CRITICAL;
    }

    // High priority actions  
    if ([
      MESSAGE_ACTIONS.SCAN_START,
      MESSAGE_ACTIONS.DOWNLOAD_ENQUEUE,
      MESSAGE_ACTIONS.EXPORT_RUN,
      MESSAGE_ACTIONS.UI_SUBSCRIBE
    ].includes(action)) {
      return MESSAGE_PRIORITY.HIGH;
    }

    // Low priority actions
    if ([
      MESSAGE_ACTIONS.PORT_KEEPALIVE,
      MESSAGE_ACTIONS.HEALTH_STATUS
    ].includes(action)) {
      return MESSAGE_PRIORITY.LOW;
    }

    // Default to medium priority
    return MESSAGE_PRIORITY.MEDIUM;
  }
}

/**
 * MessageBuilder - Lightweight utility for content scripts and UI to ensure proper message formatting
 */
class MessageBuilder {
  
  /**
   * Create a properly formatted message for sending to service worker
   * @param {string} action - The action to perform 
   * @param {Object} payload - Message payload data
   * @param {Object} options - Optional settings
   * @returns {Object} Well-formed StepThreeMessage
   */
  static createMessage(action, payload = {}, options = {}) {
    return MessageValidator.createMessage(
      action,
      options.source || MESSAGE_SOURCES.SYSTEM,
      payload,
      options
    );
  }

  /**
   * Create a message from content script
   * @param {string} action - The action to perform
   * @param {Object} payload - Message payload data  
   * @param {Object} options - Optional settings
   * @returns {Object} Well-formed StepThreeMessage
   */
  static fromContentScript(action, payload = {}, options = {}) {
    return MessageValidator.createMessage(
      action,
      MESSAGE_SOURCES.CONTENT_SCRIPT,
      payload,
      options
    );
  }

  /**
   * Create a message from popup
   * @param {string} action - The action to perform
   * @param {Object} payload - Message payload data
   * @param {Object} options - Optional settings  
   * @returns {Object} Well-formed StepThreeMessage
   */
  static fromPopup(action, payload = {}, options = {}) {
    return MessageValidator.createMessage(
      action,
      MESSAGE_SOURCES.POPUP,
      payload,
      options
    );
  }

  /**
   * Create a message from dashboard
   * @param {string} action - The action to perform
   * @param {Object} payload - Message payload data
   * @param {Object} options - Optional settings
   * @returns {Object} Well-formed StepThreeMessage  
   */
  static fromDashboard(action, payload = {}, options = {}) {
    return MessageValidator.createMessage(
      action,
      MESSAGE_SOURCES.DASHBOARD,
      payload,
      options
    );
  }

  /**
   * Create a message from options page
   * @param {string} action - The action to perform
   * @param {Object} payload - Message payload data
   * @param {Object} options - Optional settings
   * @returns {Object} Well-formed StepThreeMessage
   */
  static fromOptions(action, payload = {}, options = {}) {
    return MessageValidator.createMessage(
      action,
      MESSAGE_SOURCES.OPTIONS,
      payload,
      options
    );
  }

  /**
   * Create a success response
   * @param {string} requestId - Original request ID
   * @param {*} data - Response data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Well-formed StepThreeResponse
   */
  static createSuccessResponse(requestId, data = null, metadata = {}) {
    return MessageValidator.createResponse(requestId, true, data, null, metadata);
  }

  /**
   * Create an error response
   * @param {string} requestId - Original request ID  
   * @param {string} error - Error message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Well-formed StepThreeResponse
   */
  static createErrorResponse(requestId, error, metadata = {}) {
    return MessageValidator.createResponse(requestId, false, null, error, metadata);
  }

  /**
   * Create a broadcast update
   * @param {string} updateType - Type of update
   * @param {Object} data - Update data
   * @param {Object} options - Optional settings
   * @returns {Object} Well-formed StepThreeBroadcast
   */
  static createBroadcast(updateType, data, options = {}) {
    return {
      action: MESSAGE_ACTIONS.BROADCAST_UPDATE,
      updateType,
      data,
      timestamp: Date.now(),
      priority: options.priority || MESSAGE_PRIORITY.MEDIUM,
      ...options
    };
  }

  /**
   * Validate that a message is properly formatted before sending
   * @param {Object} message - Message to validate
   * @returns {Object} {valid: boolean, error?: string, warnings?: string[]}
   */
  static validateBeforeSend(message) {
    return MessageValidator.validateMessage(message, false);
  }

  /**
   * Get available message actions
   * @returns {Object} MESSAGE_ACTIONS constants
   */
  static getActions() {
    return MESSAGE_ACTIONS;
  }

  /**
   * Get available message sources  
   * @returns {Object} MESSAGE_SOURCES constants
   */
  static getSources() {
    return MESSAGE_SOURCES;
  }

  /**
   * Get available update types
   * @returns {Object} UPDATE_TYPES constants
   */
  static getUpdateTypes() {
    return UPDATE_TYPES;
  }
}

/**
 * Message Schema Utilities
 */
class MessageSchemaUtils {
  
  /**
   * Check if a message requires a response
   * @param {string} action - Message action
   * @returns {boolean} Whether response is expected
   */
  static requiresResponse(action) {
    const noResponseActions = [
      MESSAGE_ACTIONS.BROADCAST_UPDATE,
      MESSAGE_ACTIONS.UI_UPDATE,
      MESSAGE_ACTIONS.PORT_KEEPALIVE
    ];
    return !noResponseActions.includes(action);
  }

  /**
   * Get timeout for a message action
   * @param {string} action - Message action
   * @returns {number} Timeout in milliseconds
   */
  static getActionTimeout(action) {
    // Quick operations
    if ([
      MESSAGE_ACTIONS.HEALTH_PING,
      MESSAGE_ACTIONS.PERMISSION_CHECK,
      MESSAGE_ACTIONS.SCAN_STATUS,
      MESSAGE_ACTIONS.DOWNLOAD_STATUS
    ].includes(action)) {
      return 5000; // 5 seconds
    }

    // Medium operations
    if ([
      MESSAGE_ACTIONS.SCAN_START,
      MESSAGE_ACTIONS.DOWNLOAD_ENQUEUE,
      MESSAGE_ACTIONS.UI_SUBSCRIBE
    ].includes(action)) {
      return 15000; // 15 seconds
    }

    // Long operations
    if ([
      MESSAGE_ACTIONS.EXPORT_RUN,
      MESSAGE_ACTIONS.EXPORT_PREPARE
    ].includes(action)) {
      return 60000; // 60 seconds
    }

    // Default timeout
    return 10000; // 10 seconds
  }

  /**
   * Check if action should be queued when backpressure is detected
   * @param {string} action - Message action
   * @returns {boolean} Whether to queue vs drop message
   */
  static shouldQueueOnBackpressure(action) {
    const alwaysQueueActions = [
      MESSAGE_ACTIONS.DOWNLOAD_ENQUEUE,
      MESSAGE_ACTIONS.EXPORT_RUN,
      MESSAGE_ACTIONS.PERMISSION_PROMPT
    ];
    return alwaysQueueActions.includes(action);
  }

  /**
   * Get the subscription channel for UI updates
   * @param {string} updateType - Type of update
   * @returns {string} Channel name for subscriptions
   */
  static getUpdateChannel(updateType) {
    const channelMap = {
      [UPDATE_TYPES.SCAN_PROGRESS]: 'scan',
      [UPDATE_TYPES.DOWNLOAD_PROGRESS]: 'downloads', 
      [UPDATE_TYPES.EXPORT_PROGRESS]: 'exports',
      [UPDATE_TYPES.QUEUE_STATUS]: 'queue',
      [UPDATE_TYPES.PERMISSION_STATUS]: 'permissions',
      [UPDATE_TYPES.HEALTH_STATUS]: 'health',
      [UPDATE_TYPES.ERROR]: 'errors',
      [UPDATE_TYPES.WARNING]: 'warnings',
      [UPDATE_TYPES.SUCCESS]: 'notifications'
    };
    return channelMap[updateType] || 'general';
  }
}

// Make available globally for Chrome extension context
if (typeof globalThis !== 'undefined') {
  globalThis.StepThreeMessageSchema = {
    MESSAGE_ACTIONS,
    MESSAGE_SOURCES,
    PORT_NAMES,
    UPDATE_TYPES,
    MESSAGE_PRIORITY,
    MessageValidator,
    MessageBuilder,
    MessageSchemaUtils
  };
}

console.log('✅ Message Schema loaded successfully');