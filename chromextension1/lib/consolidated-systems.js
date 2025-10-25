// error-handling-system.js - Centralized error handling system for STEPTHREE Chrome extension
// Provides comprehensive error handling, logging, user notifications, and recovery mechanisms

// Use the existing safeConsole from service worker's global scope
// The service worker declares const safeConsole and makes it available via globalThis.safeConsole

try {
  globalThis.safeConsole.log('🛡️ Loading Error Handling System...');
} catch (e) { /* Silent fallback */ }

/**
 * Error Handling System - Centralized error management for the entire extension
 * Provides error classification, user notifications, logging, and recovery mechanisms
 */
class ErrorHandlingSystem {
  constructor(options = {}) {
    this.options = {
      // Core settings
      enableConsoleLogging: options.enableConsoleLogging !== false,
      enableUserNotifications: options.enableUserNotifications !== false,
      enableErrorReporting: options.enableErrorReporting !== false,
      enableRecoveryMechanisms: options.enableRecoveryMechanisms !== false,
      
      // Notification settings
      notificationDuration: options.notificationDuration || 5000,
      maxConcurrentNotifications: options.maxConcurrentNotifications || 3,
      
      // Recovery settings
      maxRetryAttempts: options.maxRetryAttempts || 3,
      retryDelayBase: options.retryDelayBase || 1000,
      retryDelayMax: options.retryDelayMax || 10000,
      
      // Circuit breaker settings
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      
      // Memory and performance
      maxErrorHistorySize: options.maxErrorHistorySize || 100,
      errorReportingInterval: options.errorReportingInterval || 300000, // 5 minutes
      
      ...options
    };

    // Error classification system
    this.errorClassification = {
      // Network-related errors
      network: {
        patterns: ['NetworkError', 'TypeError', 'Failed to fetch', 'ERR_NETWORK', 'ERR_INTERNET_DISCONNECTED'],
        severity: 'medium',
        userMessage: 'Network connection issue. Please check your internet connection.',
        recoverable: true,
        retryable: true
      },
      
      // Timeout errors
      timeout: {
        patterns: ['TimeoutError', 'Request timeout', 'ERR_TIMED_OUT', 'timeout'],
        severity: 'medium',
        userMessage: 'Operation timed out. Please try again.',
        recoverable: true,
        retryable: true
      },
      
      // CORS and security errors
      cors: {
        patterns: ['CORS', 'Cross-Origin', 'ERR_BLOCKED_BY_CLIENT', 'ERR_BLOCKED_BY_RESPONSE'],
        severity: 'medium',
        userMessage: 'Website security restrictions prevent access. Some images may not be downloadable.',
        recoverable: true,
        retryable: false
      },
      
      // Permission errors
      permission: {
        patterns: ['ERR_BLOCKED_BY_RESPONSE', '403', '401', 'Forbidden', 'Unauthorized', 'permission'],
        severity: 'high',
        userMessage: 'Permission denied. Please check browser permissions or website access rights.',
        recoverable: false,
        retryable: false
      },
      
      // Rate limiting
      rateLimit: {
        patterns: ['429', 'Too Many Requests', 'Rate limit', 'rate.limit'],
        severity: 'medium',
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        recoverable: true,
        retryable: true
      },
      
      // Server errors
      server: {
        patterns: ['500', '502', '503', '504', 'Internal Server Error', 'Bad Gateway', 'Service Unavailable'],
        severity: 'medium',
        userMessage: 'Server error. Please try again later.',
        recoverable: true,
        retryable: true
      },
      
      // File/resource not found
      notFound: {
        patterns: ['404', 'Not Found', 'ERR_FILE_NOT_FOUND', 'No such file'],
        severity: 'low',
        userMessage: 'Resource not found. The image may have been moved or deleted.',
        recoverable: false,
        retryable: false
      },
      
      // Chrome extension specific
      extension: {
        patterns: ['Extension context', 'chrome.runtime', 'Extension', 'Manifest', 'Service worker'],
        severity: 'high',
        userMessage: 'Extension error occurred. Please try refreshing the page.',
        recoverable: true,
        retryable: false
      },
      
      // Memory and resource errors
      memory: {
        patterns: ['Out of memory', 'Memory limit', 'ERR_INSUFFICIENT_RESOURCES', 'Maximum call stack'],
        severity: 'critical',
        userMessage: 'Memory limit reached. Please reduce the number of items or restart your browser.',
        recoverable: false,
        retryable: false
      },
      
      // Validation and format errors
      validation: {
        patterns: ['Invalid', 'Validation', 'Format error', 'Parse error', 'Syntax error'],
        severity: 'medium',
        userMessage: 'Invalid data format. Please check your input.',
        recoverable: false,
        retryable: false
      }
    };

    // State management
    this.errorHistory = [];
    this.circuitBreakers = new Map();
    this.activeNotifications = new Set();
    this.retryCounters = new Map();
    this.lastErrorReportTime = 0;

    // Statistics
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      recoveredErrors: 0,
      userNotificationsShown: 0,
      circuitBreakersTriggered: 0
    };

    // Recovery mechanisms registry
    this.recoveryMechanisms = new Map();
    this.initializeDefaultRecoveryMechanisms();

    // Initialize error tracking
    this.initializeGlobalErrorHandling();

    try {
      const consoleLog = console.log.bind(console);
      consoleLog('✅ Error Handling System initialized');
    } catch (e) { /* Silent fallback */ }
  }

  /**
   * Main error handling entry point
   * @param {Error|string} error - Error object or message
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional error metadata
   * @param {string} severity - Error severity (low, medium, high, critical)
   * @returns {Object} - Error handling result
   */
  async handleError(error, context = 'unknown', metadata = {}, severity = null) {
    try {
      // Normalize error
      const normalizedError = this.normalizeError(error);
      
      // Classify error
      const classification = this.classifyError(normalizedError.message);
      const finalSeverity = severity || classification.severity;
      
      // Create error entry
      const errorEntry = {
        id: this.generateErrorId(),
        timestamp: Date.now(),
        message: normalizedError.message,
        stack: normalizedError.stack,
        context,
        classification,
        severity: finalSeverity,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          url: typeof window !== 'undefined' ? window.location?.href : 'service-worker',
          extensionVersion: this.getExtensionVersion()
        },
        handled: false,
        recovered: false,
        retryAttempts: 0
      };

      // Add to history
      this.addToErrorHistory(errorEntry);
      
      // Update statistics
      this.updateErrorStats(errorEntry);

      // Log error
      if (this.options.enableConsoleLogging) {
        this.logError(errorEntry);
      }

      // Check circuit breaker
      if (this.isCircuitBreakerOpen(context)) {
        this.logCircuitBreakerTriggered(context);
        return { success: false, circuitBreakerOpen: true, errorId: errorEntry.id };
      }

      // Attempt recovery
      const recoveryResult = await this.attemptRecovery(errorEntry);
      
      // Show user notification if appropriate
      if (this.shouldShowUserNotification(errorEntry)) {
        await this.showUserNotification(errorEntry);
      }

      // Update circuit breaker
      this.updateCircuitBreaker(context, recoveryResult.recovered);

      // Mark as handled
      errorEntry.handled = true;
      errorEntry.recovered = recoveryResult.recovered;

      // Report error if enabled
      if (this.options.enableErrorReporting) {
        await this.reportError(errorEntry);
      }

      return {
        success: recoveryResult.recovered,
        errorId: errorEntry.id,
        classification: classification.type,
        severity: finalSeverity,
        userMessage: classification.userMessage,
        retryable: classification.retryable,
        recoveryAttempted: recoveryResult.attempted,
        recovered: recoveryResult.recovered
      };

    } catch (handlingError) {
      try {
        const consoleError = console.error.bind(console);
        consoleError('❌ Error in error handling system:', handlingError);
      } catch (e) {
        // Fallback to regular logging if available
        if (typeof console !== 'undefined' && console.log) {
          const consoleLog = console.log.bind(console);
          consoleLog('ERROR: ❌ Error in error handling system:', handlingError);
        }
      }
      return { 
        success: false, 
        errorId: null, 
        systemError: true,
        message: 'Error handling system failure'
      };
    }
  }

  /**
   * Normalize error into consistent format
   */
  normalizeError(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    } else if (typeof error === 'string') {
      return {
        message: error,
        stack: null,
        name: 'StringError'
      };
    } else if (error && typeof error === 'object' && error.message) {
      return {
        message: error.message,
        stack: error.stack || null,
        name: error.name || 'ObjectError'
      };
    } else {
      return {
        message: 'Unknown error occurred',
        stack: null,
        name: 'UnknownError'
      };
    }
  }

  /**
   * Classify error based on patterns
   */
  classifyError(errorMessage) {
    const message = errorMessage.toLowerCase();
    
    for (const [type, config] of Object.entries(this.errorClassification)) {
      for (const pattern of config.patterns) {
        if (message.includes(pattern.toLowerCase())) {
          return { type, ...config };
        }
      }
    }
    
    return {
      type: 'unknown',
      severity: 'medium',
      userMessage: 'An unexpected error occurred. Please try again.',
      recoverable: true,
      retryable: true
    };
  }

  /**
   * Attempt error recovery
   */
  async attemptRecovery(errorEntry) {
    if (!this.options.enableRecoveryMechanisms) {
      return { attempted: false, recovered: false };
    }

    const recoveryMechanism = this.recoveryMechanisms.get(errorEntry.classification.type);
    if (!recoveryMechanism) {
      return { attempted: false, recovered: false };
    }

    try {
      const result = await recoveryMechanism(errorEntry);
      if (result) {
        this.stats.recoveredErrors++;
        try {
          const consoleLog = console.log.bind(console);
          consoleLog(`✅ Error recovery successful for ${errorEntry.classification.type}`);
        } catch (e) { /* Silent fallback */ }
      }
      return { attempted: true, recovered: result };
    } catch (recoveryError) {
      try {
        const consoleError = console.error.bind(console);
        consoleError('❌ Error recovery failed:', recoveryError);
      } catch (e) {
        if (typeof console !== 'undefined' && console.log) {
          const consoleLog = console.log.bind(console);
          consoleLog('ERROR: ❌ Error recovery failed:', recoveryError);
        }
      }
      return { attempted: true, recovered: false };
    }
  }

  /**
   * Show user notification for error
   */
  async showUserNotification(errorEntry) {
    if (!this.options.enableUserNotifications) {
      return;
    }

    // Check notification limits
    if (this.activeNotifications.size >= this.options.maxConcurrentNotifications) {
      return;
    }

    const notificationId = `error_${errorEntry.id}`;
    
    try {
      // Create notification using Chrome API if available
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        await chrome.notifications.create(notificationId, {
          type: 'basic',
          iconUrl: 'icons/48.png',
          title: 'StepThree Gallery Scraper',
          message: errorEntry.classification.userMessage,
          buttons: errorEntry.classification.retryable ? [
            { title: 'Retry' },
            { title: 'Dismiss' }
          ] : [
            { title: 'Dismiss' }
          ]
        });
      } else {
        // Fallback to console logging
        globalThis.safeConsole.warn('📢 User Notification:', errorEntry.classification.userMessage);
      }

      this.activeNotifications.add(notificationId);
      this.stats.userNotificationsShown++;

      // Auto-dismiss after duration
      setTimeout(() => {
        this.activeNotifications.delete(notificationId);
        if (typeof chrome !== 'undefined' && chrome.notifications) {
          chrome.notifications.clear(notificationId);
        }
      }, this.options.notificationDuration);

    } catch (notificationError) {
      console.error('❌ Failed to show notification:', notificationError);
    }
  }

  /**
   * Determine if user notification should be shown
   */
  shouldShowUserNotification(errorEntry) {
    // Don't show for low severity errors
    if (errorEntry.severity === 'low') {
      return false;
    }

    // Don't show duplicate notifications
    const recentSimilarErrors = this.errorHistory
      .filter(e => 
        e.classification.type === errorEntry.classification.type &&
        Date.now() - e.timestamp < 30000 // Within 30 seconds
      );

    return recentSimilarErrors.length <= 1;
  }

  /**
   * Circuit breaker management
   */
  isCircuitBreakerOpen(context) {
    const breaker = this.circuitBreakers.get(context);
    if (!breaker) {
      return false;
    }

    if (breaker.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - breaker.lastFailure > this.options.circuitBreakerTimeout) {
        breaker.state = 'half-open';
        breaker.consecutiveFailures = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  updateCircuitBreaker(context, success) {
    let breaker = this.circuitBreakers.get(context);
    if (!breaker) {
      breaker = {
        state: 'closed',
        consecutiveFailures: 0,
        lastFailure: 0
      };
      this.circuitBreakers.set(context, breaker);
    }

    if (success) {
      breaker.consecutiveFailures = 0;
      breaker.state = 'closed';
    } else {
      breaker.consecutiveFailures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.consecutiveFailures >= this.options.circuitBreakerThreshold) {
        breaker.state = 'open';
        this.stats.circuitBreakersTriggered++;
        console.warn(`🔌 Circuit breaker opened for context: ${context}`);
      }
    }
  }

  /**
   * Initialize default recovery mechanisms
   */
  initializeDefaultRecoveryMechanisms() {
    // Network error recovery
    this.recoveryMechanisms.set('network', async (errorEntry) => {
      // Wait a moment and check connectivity
      await this.delay(1000);
      return navigator.onLine;
    });

    // Timeout error recovery
    this.recoveryMechanisms.set('timeout', async (errorEntry) => {
      // Simple retry mechanism
      const retryKey = `${errorEntry.context}_${errorEntry.classification.type}`;
      const retryCount = this.retryCounters.get(retryKey) || 0;
      
      if (retryCount < this.options.maxRetryAttempts) {
        this.retryCounters.set(retryKey, retryCount + 1);
        const delay = Math.min(
          this.options.retryDelayBase * Math.pow(2, retryCount),
          this.options.retryDelayMax
        );
        await this.delay(delay);
        return true;
      }
      
      return false;
    });

    // Extension error recovery
    this.recoveryMechanisms.set('extension', async (errorEntry) => {
      // Try to reinitialize extension context
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          // Check if runtime is still valid
          return !!chrome.runtime.id;
        }
      } catch (e) {
        return false;
      }
      return false;
    });
  }

  /**
   * Utility functions
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  addToErrorHistory(errorEntry) {
    this.errorHistory.push(errorEntry);
    
    // SECURITY FIX: Bounded error history with LRU eviction prevents memory leak
    // When history exceeds maxErrorHistorySize (default 100), remove oldest entry
    if (this.errorHistory.length > this.options.maxErrorHistorySize) {
      this.errorHistory.shift(); // Remove oldest entry (LRU eviction)
    }
  }

  updateErrorStats(errorEntry) {
    this.stats.totalErrors++;
    
    const type = errorEntry.classification.type;
    this.stats.errorsByType[type] = (this.stats.errorsByType[type] || 0) + 1;
    
    this.stats.errorsBySeverity[errorEntry.severity]++;
  }

  logError(errorEntry) {
    const emoji = {
      low: '⚪',
      medium: '🟡', 
      high: '🟠',
      critical: '🔴'
    }[errorEntry.severity] || '⚪';

    // Use safe console logging to prevent "Illegal invocation" errors
    const message = `${emoji} [ERROR] [${errorEntry.context}] ${errorEntry.message}`;
    const details = {
      id: errorEntry.id,
      classification: errorEntry.classification.type,
      severity: errorEntry.severity,
      metadata: errorEntry.metadata,
      stack: errorEntry.stack
    };

    try {
      // Try multiple console methods with different approaches
      if (typeof console !== 'undefined') {
        if (console.error && typeof console.error === 'function') {
          globalThis.safeConsole.error(message, details);
        } else if (console.log && typeof console.log === 'function') {
          globalThis.safeConsole.log(`ERROR: ${message}`, details);
        }
      }
    } catch (e) {
      // Ultimate fallback - just try to output something
      try {
        if (typeof console !== 'undefined' && console.log) {
          globalThis.safeConsole.log(`ERROR: ${message}`);
        }
      } catch (finalError) {
        // Silent failure if all console methods fail
      }
    }
  }

  logCircuitBreakerTriggered(context) {
    const message = `🔌 Circuit breaker OPEN for context: ${context} - blocking further operations`;
    
    try {
      // Safe console warning to prevent "Illegal invocation" errors
      if (typeof console !== 'undefined') {
        if (console.warn && typeof console.warn === 'function') {
          globalThis.safeConsole.warn(message);
        } else if (console.log && typeof console.log === 'function') {
          globalThis.safeConsole.log(`WARN: ${message}`);
        }
      }
    } catch (error) {
      // Ultimate fallback - just try to output something
      try {
        if (typeof console !== 'undefined' && console.log) {
          console.log(`WARN: ${message}`);
        }
      } catch (finalError) {
        // Silent failure if all console methods fail
      }
    }
  }

  getExtensionVersion() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome.runtime.getManifest()?.version || 'unknown';
      }
    } catch (e) {
      // Ignore
    }
    return 'unknown';
  }

  async reportError(errorEntry) {
    // Placeholder for error reporting - could send to analytics service
    if (Date.now() - this.lastErrorReportTime > this.options.errorReportingInterval) {
      console.log('📊 Error report:', {
        totalErrors: this.stats.totalErrors,
        errorsByType: this.stats.errorsByType,
        recentError: {
          type: errorEntry.classification.type,
          severity: errorEntry.severity,
          context: errorEntry.context
        }
      });
      this.lastErrorReportTime = Date.now();
    }
  }

  initializeGlobalErrorHandling() {
    // Only set up global handlers in appropriate contexts
    if (typeof window !== 'undefined') {
      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, 'unhandled-promise', {
          promise: event.promise.toString()
        }, 'high');
      });

      // Handle global errors
      window.addEventListener('error', (event) => {
        this.handleError(event.error || event.message, 'global-error', {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }, 'high');
      });
    }
  }

  /**
   * Get error handling statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeNotifications: this.activeNotifications.size,
      circuitBreakers: Array.from(this.circuitBreakers.entries()),
      recentErrors: this.errorHistory.slice(-10),
      memoryUsage: this.errorHistory.length
    };
  }

  /**
   * Clear error history and reset stats
   */
  reset() {
    this.errorHistory = [];
    this.circuitBreakers.clear();
    this.activeNotifications.clear();
    this.retryCounters.clear();
    
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      recoveredErrors: 0,
      userNotificationsShown: 0,
      circuitBreakersTriggered: 0
    };
    
    console.log('✅ Error handling system reset');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandlingSystem;
} else if (typeof window !== 'undefined') {
  window.ErrorHandlingSystem = ErrorHandlingSystem;
} else if (typeof self !== 'undefined') {
  self.ErrorHandlingSystem = ErrorHandlingSystem;
} else if (typeof globalThis !== 'undefined') {
  globalThis.ErrorHandlingSystem = ErrorHandlingSystem;
}

console.log('✅ Error Handling System loaded successfully');

// Memory Management System has been removed due to dangerous function overrides
// Use ResourceTracker in lib/resource-tracker.js for safe resource tracking without overriding native functions

// performance-monitoring-system.js - Centralized performance monitoring and health checks for STEPTHREE
// Provides comprehensive performance tracking, memory monitoring, and system health diagnostics

console.log('⚡ Loading Performance Monitoring System...');

/**
 * Performance Monitoring System - Enterprise-grade performance tracking and health monitoring
 * Monitors memory usage, operation timings, resource utilization, and system health
 */
class PerformanceMonitoringSystem {
  constructor(options = {}) {
    this.options = {
      // Core monitoring settings
      enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
      enablePerformanceTracking: options.enablePerformanceTracking !== false,
      enableHealthChecks: options.enableHealthChecks !== false,
      enableResourceMonitoring: options.enableResourceMonitoring !== false,
      
      // Memory settings
      memoryCheckInterval: options.memoryCheckInterval || 30000, // 30 seconds
      memoryWarningThreshold: options.memoryWarningThreshold || 100 * 1024 * 1024, // 100MB
      memoryCriticalThreshold: options.memoryCriticalThreshold || 200 * 1024 * 1024, // 200MB
      
      // Performance settings
      slowOperationThreshold: options.slowOperationThreshold || 1000, // 1 second
      verySlowOperationThreshold: options.verySlowOperationThreshold || 5000, // 5 seconds
      maxActiveOperations: options.maxActiveOperations || 50,
      
      // Health check settings
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      componentTimeoutThreshold: options.componentTimeoutThreshold || 5000, // 5 seconds
      
      // Data retention
      maxMetricsHistory: options.maxMetricsHistory || 100,
      maxOperationHistory: options.maxOperationHistory || 500,
      
      // Reporting settings
      enableConsoleReporting: options.enableConsoleReporting !== false,
      reportingInterval: options.reportingInterval || 300000, // 5 minutes
      
      ...options
    };

    // Performance tracking
    this.activeOperations = new Map();
    this.completedOperations = [];
    this.operationStats = {
      totalOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      slowOperations: 0,
      verySlowOperations: 0
    };

    // Memory monitoring
    this.memorySnapshots = [];
    this.memoryStats = {
      current: 0,
      peak: 0,
      average: 0,
      warnings: 0,
      critical: 0,
      lastGCTime: 0
    };

    // System health
    this.healthCheckers = new Map();
    this.healthStatus = {
      overall: 'unknown',
      components: {},
      lastCheck: 0,
      failureCount: 0
    };

    // Resource monitoring
    this.resourceStats = {
      activeDownloads: 0,
      activeTabs: 0,
      activeContentScripts: 0,
      networkRequests: 0,
      storageUsage: 0
    };

    // Alerts and notifications
    this.alerts = [];
    this.alertThresholds = {
      memory: this.options.memoryWarningThreshold,
      responseTime: this.options.slowOperationThreshold,
      errorRate: 0.1, // 10% error rate
      failureCount: 5
    };

    // Initialize monitoring
    this.isInitialized = false;
    this.monitoringIntervals = new Map();
    
    this.initialize();
  }

  /**
   * Initialize the monitoring system
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Initializing Performance Monitoring System...');

      // Register default health checkers
      this.registerDefaultHealthCheckers();

      // Start monitoring intervals
      if (this.options.enableMemoryMonitoring) {
        this.startMemoryMonitoring();
      }

      if (this.options.enableHealthChecks) {
        this.startHealthMonitoring();
      }

      // Start periodic reporting
      if (this.options.enableConsoleReporting) {
        this.startPerformanceReporting();
      }

      // Initial health check
      await this.performHealthCheck();

      this.isInitialized = true;
      console.log('✅ Performance Monitoring System initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Performance Monitoring System:', error);
      throw error;
    }
  }

  /**
   * Start tracking an operation
   * @param {string} operationName - Name of the operation
   * @param {string} category - Operation category (e.g., 'download', 'scraping', 'export')
   * @param {Object} metadata - Additional operation metadata
   * @returns {Object} - Operation tracker with end() method
   */
  startOperation(operationName, category = 'general', metadata = {}) {
    if (!this.options.enablePerformanceTracking) {
      return { end: () => {} }; // No-op tracker
    }

    const operationId = this.generateOperationId();
    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();

    const operation = {
      id: operationId,
      name: operationName,
      category,
      startTime,
      startMemory,
      metadata: {
        ...metadata,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      },
      active: true
    };

    this.activeOperations.set(operationId, operation);
    this.operationStats.totalOperations++;

    // Check for too many active operations
    if (this.activeOperations.size > this.options.maxActiveOperations) {
      this.createAlert('performance', 'warning', 
        `High number of active operations: ${this.activeOperations.size}`);
    }

    return {
      id: operationId,
      end: (result = {}) => this.endOperation(operationId, result),
      addMetadata: (newMetadata) => {
        if (this.activeOperations.has(operationId)) {
          Object.assign(operation.metadata, newMetadata);
        }
      },
      markCheckpoint: (checkpoint) => {
        if (this.activeOperations.has(operationId)) {
          if (!operation.checkpoints) {
            operation.checkpoints = [];
          }
          operation.checkpoints.push({
            name: checkpoint,
            time: performance.now() - startTime,
            memory: this.getCurrentMemoryUsage()
          });
        }
      }
    };
  }

  /**
   * End operation tracking
   */
  endOperation(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return null;
    }

    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();
    const duration = endTime - operation.startTime;
    const memoryDelta = endMemory - operation.startMemory;

    // Complete the operation
    const completedOperation = {
      ...operation,
      endTime,
      endMemory,
      duration,
      memoryDelta,
      result,
      active: false,
      success: result.success !== false
    };

    // Remove from active operations
    this.activeOperations.delete(operationId);

    // Add to completed operations
    this.completedOperations.push(completedOperation);
    
    // Trim history if needed
    if (this.completedOperations.length > this.options.maxOperationHistory) {
      this.completedOperations.shift();
    }

    // Update statistics
    this.updateOperationStats(completedOperation);

    // Log slow operations
    if (duration > this.options.slowOperationThreshold) {
      const severity = duration > this.options.verySlowOperationThreshold ? 'warning' : 'info';
      console.warn(`🐌 Slow operation detected: ${operation.name} took ${duration.toFixed(2)}ms`);
      
      if (severity === 'warning') {
        this.createAlert('performance', 'warning', 
          `Very slow operation: ${operation.name} (${duration.toFixed(2)}ms)`);
      }
    }

    // Log memory usage if significant
    if (Math.abs(memoryDelta) > 10 * 1024 * 1024) { // 10MB change
      console.log(`💾 Memory change for ${operation.name}: ${this.formatBytes(memoryDelta)}`);
    }

    return completedOperation;
  }

  /**
   * Memory monitoring
   */
  startMemoryMonitoring() {
    const interval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.memoryCheckInterval);

    this.monitoringIntervals.set('memory', interval);
    console.log('📊 Memory monitoring started');
  }

  checkMemoryUsage() {
    const memoryUsage = this.getCurrentMemoryUsage();
    
    if (memoryUsage === null) {
      return; // Memory API not available
    }

    // Update memory stats
    this.memoryStats.current = memoryUsage;
    this.memoryStats.peak = Math.max(this.memoryStats.peak, memoryUsage);
    
    // Add to snapshots
    this.memorySnapshots.push({
      timestamp: Date.now(),
      usage: memoryUsage,
      activeOperations: this.activeOperations.size
    });

    // Trim snapshots
    if (this.memorySnapshots.length > this.options.maxMetricsHistory) {
      this.memorySnapshots.shift();
    }

    // Calculate average
    if (this.memorySnapshots.length > 0) {
      this.memoryStats.average = this.memorySnapshots.reduce((sum, snapshot) => 
        sum + snapshot.usage, 0) / this.memorySnapshots.length;
    }

    // Check thresholds
    if (memoryUsage > this.options.memoryCriticalThreshold) {
      this.memoryStats.critical++;
      this.createAlert('memory', 'critical', 
        `Critical memory usage: ${this.formatBytes(memoryUsage)}`);
      this.suggestGarbageCollection();
    } else if (memoryUsage > this.options.memoryWarningThreshold) {
      this.memoryStats.warnings++;
      this.createAlert('memory', 'warning', 
        `High memory usage: ${this.formatBytes(memoryUsage)}`);
    }
  }

  /**
   * Health monitoring
   */
  startHealthMonitoring() {
    const interval = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);

    this.monitoringIntervals.set('health', interval);
    console.log('🏥 Health monitoring started');
  }

  async performHealthCheck() {
    const healthResults = {};
    let overallHealthy = true;

    for (const [componentName, healthChecker] of this.healthCheckers) {
      try {
        const startTime = performance.now();
        const result = await Promise.race([
          healthChecker(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 
            this.options.componentTimeoutThreshold)
          )
        ]);

        const duration = performance.now() - startTime;
        
        healthResults[componentName] = {
          status: result.healthy ? 'healthy' : 'unhealthy',
          message: result.message || '',
          duration,
          timestamp: Date.now(),
          details: result.details || {}
        };

        if (!result.healthy) {
          overallHealthy = false;
        }

      } catch (error) {
        const normalizedError = this.normalizeError(error);
        healthResults[componentName] = {
          status: 'error',
          message: normalizedError.message,
          duration: this.options.componentTimeoutThreshold,
          timestamp: Date.now(),
          error: true
        };
        overallHealthy = false;
      }
    }

    // Update health status
    this.healthStatus.components = healthResults;
    this.healthStatus.lastCheck = Date.now();
    
    if (!overallHealthy) {
      this.healthStatus.failureCount++;
      this.healthStatus.overall = 'unhealthy';
      this.createAlert('health', 'warning', 'System health check failed');
    } else {
      this.healthStatus.failureCount = Math.max(0, this.healthStatus.failureCount - 1);
      this.healthStatus.overall = 'healthy';
    }

    return this.healthStatus;
  }

  /**
   * Register default health checkers
   */
  registerDefaultHealthCheckers() {
    // Chrome extension context health
    this.registerHealthChecker('chrome-extension', async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
          return { healthy: false, message: 'Chrome runtime not available' };
        }

        // Check if extension context is valid
        const extensionId = chrome.runtime.id;
        if (!extensionId) {
          return { healthy: false, message: 'Extension ID not available' };
        }

        return { 
          healthy: true, 
          message: 'Chrome extension context healthy',
          details: { extensionId }
        };
      } catch (error) {
        const errorMessage = (error instanceof Error) ? error.message : String(error);
        return { healthy: false, message: `Chrome extension error: ${errorMessage}` };
      }
    });

    // Memory health
    this.registerHealthChecker('memory', async () => {
      const memoryUsage = this.getCurrentMemoryUsage();
      if (memoryUsage === null) {
        return { healthy: true, message: 'Memory monitoring not available' };
      }

      const isHealthy = memoryUsage < this.options.memoryCriticalThreshold;
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Memory usage normal' : 'Memory usage critical',
        details: {
          current: this.formatBytes(memoryUsage),
          threshold: this.formatBytes(this.options.memoryCriticalThreshold)
        }
      };
    });

    // Performance health
    this.registerHealthChecker('performance', async () => {
      const recentOperations = this.completedOperations.slice(-20);
      if (recentOperations.length === 0) {
        return { healthy: true, message: 'No recent operations to analyze' };
      }

      const averageTime = recentOperations.reduce((sum, op) => sum + op.duration, 0) / recentOperations.length;
      const slowOperationsCount = recentOperations.filter(op => 
        op.duration > this.options.slowOperationThreshold).length;
      
      const slowOperationRatio = slowOperationsCount / recentOperations.length;
      const isHealthy = slowOperationRatio < 0.5; // Less than 50% slow operations

      return {
        healthy: isHealthy,
        message: isHealthy ? 'Performance normal' : 'Performance degraded',
        details: {
          averageResponseTime: `${averageTime.toFixed(2)}ms`,
          slowOperationRatio: `${(slowOperationRatio * 100).toFixed(1)}%`
        }
      };
    });

    // Storage health (if available)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      this.registerHealthChecker('storage', async () => {
        try {
          // Test storage read/write
          const testKey = 'health_check_test';
          const testValue = Date.now().toString();
          
          await chrome.storage.local.set({ [testKey]: testValue });
          const result = await chrome.storage.local.get(testKey);
          await chrome.storage.local.remove(testKey);
          
          const isHealthy = result[testKey] === testValue;
          return {
            healthy: isHealthy,
            message: isHealthy ? 'Storage working correctly' : 'Storage read/write failed'
          };
        } catch (error) {
          const errorMessage = (error instanceof Error) ? error.message : String(error);
          return { healthy: false, message: `Storage error: ${errorMessage}` };
        }
      });
    }
  }

  /**
   * Register a custom health checker
   */
  registerHealthChecker(componentName, healthCheckFunction) {
    this.healthCheckers.set(componentName, healthCheckFunction);
    console.log(`🏥 Health checker registered for: ${componentName}`);
  }

  /**
   * Performance reporting
   */
  startPerformanceReporting() {
    const interval = setInterval(() => {
      this.generatePerformanceReport();
    }, this.options.reportingInterval);

    this.monitoringIntervals.set('reporting', interval);
    console.log('📊 Performance reporting started');
  }

  generatePerformanceReport() {
    const report = {
      timestamp: Date.now(),
      memory: {
        current: this.formatBytes(this.memoryStats.current),
        peak: this.formatBytes(this.memoryStats.peak),
        average: this.formatBytes(this.memoryStats.average)
      },
      operations: {
        total: this.operationStats.totalOperations,
        active: this.activeOperations.size,
        completed: this.operationStats.completedOperations,
        failed: this.operationStats.failedOperations,
        averageResponseTime: `${this.operationStats.averageResponseTime.toFixed(2)}ms`,
        slowOperations: this.operationStats.slowOperations
      },
      health: {
        overall: this.healthStatus.overall,
        componentFailures: Object.values(this.healthStatus.components)
          .filter(c => c.status !== 'healthy').length
      },
      alerts: {
        total: this.alerts.length,
        recent: this.alerts.filter(a => 
          Date.now() - a.timestamp < this.options.reportingInterval).length
      }
    };

    console.log('📊 Performance Report:', report);
    return report;
  }

  /**
   * Utility methods
   */
  getCurrentMemoryUsage() {
    try {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
    } catch (error) {
      // Memory API not available
    }
    return null;
  }

  formatBytes(bytes) {
    if (bytes === 0 || bytes === null) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  updateOperationStats(operation) {
    if (operation.success) {
      this.operationStats.completedOperations++;
    } else {
      this.operationStats.failedOperations++;
    }

    // Update average response time
    const totalCompleted = this.operationStats.completedOperations + this.operationStats.failedOperations;
    const currentAvg = this.operationStats.averageResponseTime;
    this.operationStats.averageResponseTime = 
      (currentAvg * (totalCompleted - 1) + operation.duration) / totalCompleted;

    // Track slow operations
    if (operation.duration > this.options.slowOperationThreshold) {
      this.operationStats.slowOperations++;
    }
    if (operation.duration > this.options.verySlowOperationThreshold) {
      this.operationStats.verySlowOperations++;
    }
  }

  createAlert(type, severity, message, metadata = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      metadata
    };

    this.alerts.push(alert);

    // Trim alerts history
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Log based on severity
    switch (severity) {
      case 'critical':
        console.error(`🚨 [CRITICAL] ${message}`, metadata);
        break;
      case 'warning':
        console.warn(`⚠️ [WARNING] ${message}`, metadata);
        break;
      default:
        console.log(`ℹ️ [INFO] ${message}`, metadata);
    }

    return alert;
  }

  suggestGarbageCollection() {
    if (typeof window !== 'undefined' && window.gc) {
      console.log('🗑️ Triggering garbage collection...');
      window.gc();
      this.memoryStats.lastGCTime = Date.now();
    }
  }

  /**
   * Get comprehensive system statistics
   */
  getStats() {
    return {
      memory: this.memoryStats,
      operations: this.operationStats,
      health: this.healthStatus,
      resources: this.resourceStats,
      alerts: this.alerts.slice(-10), // Recent alerts
      activeOperations: Array.from(this.activeOperations.values()),
      recentOperations: this.completedOperations.slice(-10)
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    console.log('🔄 Shutting down Performance Monitoring System...');
    
    // Clear all intervals
    for (const [name, interval] of this.monitoringIntervals) {
      clearInterval(interval);
      console.log(`⏹️ Stopped ${name} monitoring`);
    }
    this.monitoringIntervals.clear();

    // End all active operations
    for (const [operationId, operation] of this.activeOperations) {
      this.endOperation(operationId, { success: false, reason: 'System shutdown' });
    }

    this.isInitialized = false;
    console.log('✅ Performance Monitoring System shutdown complete');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitoringSystem;
} else if (typeof window !== 'undefined') {
  window.PerformanceMonitoringSystem = PerformanceMonitoringSystem;
} else if (typeof self !== 'undefined') {
  self.PerformanceMonitoringSystem = PerformanceMonitoringSystem;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PerformanceMonitoringSystem = PerformanceMonitoringSystem;
}

console.log('✅ Performance Monitoring System loaded successfully');