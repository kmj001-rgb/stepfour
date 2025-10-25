// logger.js - Production-ready logging system with environment detection and sensitive data redaction
// Features: Log levels, environment-based filtering, sensitive data scrubbing
// CR-020: Environment detection | CR-009: Sensitive data filtering

class Logger {
  static LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  static SENSITIVE_PATTERNS = [
    /apikey/i,
    /api[_-]?key/i,
    /token/i,
    /password/i,
    /passwd/i,
    /secret/i,
    /auth/i,
    /credential/i,
    /bearer/i,
    /authorization/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /session[_-]?id/i,
    /private[_-]?key/i
  ];

  constructor(moduleName = 'Unknown') {
    this.moduleName = moduleName;
    // Default to development for safer debugging
    this.isProduction = false;
    this.minLogLevel = Logger.LOG_LEVELS.DEBUG;
    this._environmentDetected = false;
    
    // SECURITY FIX: Synchronously detect environment to prevent race condition
    // Environment detection is now synchronous - no async storage checks
    this._detectEnvironmentSync();
    
    // NOTE: No console logging during construction for MV3 compliance
  }

  // SECURITY FIX: Made synchronous to prevent race condition in logging
  // Previously async _detectEnvironment() could cause logs before environment detected
  _detectEnvironmentSync() {
    if (this._environmentDetected) {
      return;
    }
    
    try {
      // Check if we're in a chrome extension (synchronous check only)
      const isChromeExtension = typeof chrome !== 'undefined' && 
                                chrome.runtime && 
                                chrome.runtime.id;
      
      if (!isChromeExtension) {
        // Not in extension context - always use development mode
        this.isProduction = false;
        this.minLogLevel = Logger.LOG_LEVELS.DEBUG;
      } else {
        // In extension context - default to development for safety
        // Production mode must be explicitly set via setProductionMode() method
        this.isProduction = false;
        this.minLogLevel = Logger.LOG_LEVELS.DEBUG;
      }
      
      this._environmentDetected = true;
      
    } catch (error) {
      // If detection fails, default to development
      this.isProduction = false;
      this.minLogLevel = Logger.LOG_LEVELS.DEBUG;
      this._environmentDetected = true;
    }
  }

  /**
   * Explicitly set production mode (must be called after construction if needed)
   * This avoids async race conditions while still allowing production mode
   */
  setProductionMode(enabled = true) {
    this.isProduction = enabled;
    this.minLogLevel = enabled ? Logger.LOG_LEVELS.WARN : Logger.LOG_LEVELS.DEBUG;
  }

  _shouldLog(level) {
    // Environment already detected synchronously in constructor
    // No race condition possible
    return level >= this.minLogLevel;
  }

  _redactSensitiveData(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      for (const pattern of Logger.SENSITIVE_PATTERNS) {
        if (pattern.test(obj)) {
          return '[REDACTED]';
        }
      }
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    // Special handling for Error objects to preserve error information
    if (obj instanceof Error) {
      const errorObj = {
        name: obj.name,
        message: obj.message,
        stack: obj.stack
      };
      
      // Include any additional enumerable properties
      for (const [key, value] of Object.entries(obj)) {
        if (!(key in errorObj)) {
          errorObj[key] = value;
        }
      }
      
      // Recursively redact the error object properties
      return this._redactSensitiveData(errorObj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._redactSensitiveData(item));
    }

    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
      const isSensitiveKey = Logger.SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
      
      if (isSensitiveKey) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this._redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    
    return redacted;
  }

  _formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    const levelStr = Object.keys(Logger.LOG_LEVELS).find(k => Logger.LOG_LEVELS[k] === level);
    const prefix = `[${timestamp}] [${levelStr}] [${this.moduleName}]`;
    
    const redactedArgs = args.map(arg => this._redactSensitiveData(arg));
    
    return [prefix, ...redactedArgs];
  }

  debug(...args) {
    if (this._shouldLog(Logger.LOG_LEVELS.DEBUG)) {
      const formatted = this._formatMessage(Logger.LOG_LEVELS.DEBUG, args);
      console.log(...formatted);
    }
  }

  info(...args) {
    if (this._shouldLog(Logger.LOG_LEVELS.INFO)) {
      const formatted = this._formatMessage(Logger.LOG_LEVELS.INFO, args);
      console.log(...formatted);
    }
  }

  warn(...args) {
    if (this._shouldLog(Logger.LOG_LEVELS.WARN)) {
      const formatted = this._formatMessage(Logger.LOG_LEVELS.WARN, args);
      console.warn(...formatted);
    }
  }

  error(...args) {
    if (this._shouldLog(Logger.LOG_LEVELS.ERROR)) {
      // SECURITY FIX (M3): Sanitize error messages in production to prevent information disclosure
      // Keep detailed errors in development mode for debugging
      const sanitizedArgs = this.isProduction ? 
        args.map(arg => this.sanitizeErrorForUser(arg)) : args;
      
      const formatted = this._formatMessage(Logger.LOG_LEVELS.ERROR, sanitizedArgs);
      console.error(...formatted);
    }
  }

  /**
   * SECURITY FIX (M3): Sanitize error messages for production environments
   * Prevents information disclosure of internal architecture details
   * 
   * @param {*} error - Error object, string, or any value to sanitize
   * @returns {string|Object} Sanitized generic error message in production, original in development
   */
  sanitizeErrorForUser(error) {
    // If not in production, return original error for debugging
    if (!this.isProduction) {
      return error;
    }

    // Generic error message for production to prevent information disclosure
    const genericMessage = 'An error occurred processing your request';

    // Handle different error types
    if (error instanceof Error) {
      // For Error objects, return generic message but preserve error type for logging
      return {
        message: genericMessage,
        type: error.constructor.name
      };
    } else if (typeof error === 'string') {
      // For string errors, replace with generic message
      return genericMessage;
    } else if (typeof error === 'object' && error !== null) {
      // For objects with error details, return sanitized version
      return {
        message: genericMessage,
        sanitized: true
      };
    }

    // For other types, return generic message
    return genericMessage;
  }

  /**
   * ENHANCEMENT 5: Sanitize HTML output to prevent XSS in error messages and debug logs
   * Escapes HTML special characters to prevent injection attacks
   * 
   * @param {string} str - String to sanitize
   * @returns {string} HTML-escaped string safe for display
   */
  sanitizeHTML(str) {
    if (typeof str !== 'string') {
      str = String(str);
    }
    
    const htmlEscapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    return str.replace(/[&<>"'/]/g, char => htmlEscapeMap[char]);
  }

  /**
   * ENHANCEMENT 5: Sanitize text for safe display in UI modals and notifications
   * Combines error sanitization with HTML escaping
   * 
   * @param {*} text - Text to sanitize
   * @returns {string} Safe text for UI display
   */
  sanitizeForUI(text) {
    // First sanitize error message if in production
    const sanitized = this.sanitizeErrorForUser(text);
    
    // Convert to string if needed
    let textStr = typeof sanitized === 'object' ? 
      (sanitized.message || JSON.stringify(sanitized)) : 
      String(sanitized);
    
    // Then escape HTML
    return this.sanitizeHTML(textStr);
  }

  critical(...args) {
    const formatted = this._formatMessage(Logger.LOG_LEVELS.ERROR, args);
    console.error(...formatted);
  }
}

// ES Module export (for modern bundlers and ES6 imports)
export { Logger };

// Global export (for browser global scope access)
if (typeof globalThis !== 'undefined') {
  globalThis.Logger = Logger;
}
