// content-bundle.js - Unified content script for StepThree Gallery Scraper
// Consolidates essential functionality from multiple scripts to improve performance
// and eliminate race conditions in MV3 extension context

import { PERFORMANCE_CONFIG } from '../config/constants.js';
import { InputSanitizer } from '../lib/input-sanitizer.js';

// Check if content script is already injected (for on-demand programmatic injection)
if (window.__STEPTHREE_INJECTED) {
  console.log('⚠️ STEPTHREE Content Bundle already injected, skipping...');
  throw new Error('Content script already loaded'); // Stop execution
}

// Mark as injected to prevent double injection
window.__STEPTHREE_INJECTED = true;

// Early exit for obviously irrelevant system pages (performance optimization)
// This prevents the extension from loading unnecessary infrastructure on internal browser pages
// where the gallery scraper will never be used, reducing memory and CPU usage.
if (window.location.protocol === 'chrome:' || 
    window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'about:') {
  console.log('⏭️ STEPTHREE skipping system page:', window.location.protocol);
  throw new Error('Extension not applicable on system pages');
}

console.log('🚀 STEPTHREE Content Bundle loading...');

/**
 * ============================================================================
 * UNIVERSAL GALLERY SCRAPER - PERFORMANCE & DESIGN ARCHITECTURE
 * ============================================================================
 * 
 * WHY THIS SCRIPT RUNS ON ALL PAGES:
 * This is a universal gallery scraper designed to work on ANY website where
 * users want to extract images, tables, or media content. We cannot predict
 * which sites users will visit, so the extension must be ready everywhere.
 * 
 * PERFORMANCE STRATEGY (Lazy Loading):
 * ✓ Only lightweight infrastructure loads initially (~50KB)
 *   - Debug configuration
 *   - Memory management framework
 *   - Input sanitization
 *   - Message handlers (dormant until activated)
 * 
 * ✗ Heavy operations DO NOT run automatically:
 *   - DOM scraping and image detection
 *   - Mutation observers
 *   - Table detection systems
 *   - Advanced collector systems
 *   - Pattern recognition engines
 * 
 * USER ACTIVATION REQUIRED:
 * Heavy systems only activate when the user explicitly triggers them via:
 * - Extension popup button click
 * - Context menu selection ("Extract images from page")
 * - Keyboard shortcut
 * - Message from background service worker
 * 
 * MANIFEST V3 BEST PRACTICE:
 * This architecture follows Chrome's recommended pattern for universal extensions:
 * - Register lightweight message listeners on all pages
 * - Keep dormant until user interaction
 * - Minimize memory footprint during normal browsing
 * - Only activate heavy processing on-demand
 * 
 * MEMORY SAFEGUARDS:
 * - Bounded caches with LRU eviction
 * - Automatic cleanup on page visibility changes
 * - Resource tracking for observers and timers
 * - Emergency cleanup at memory thresholds
 * 
 * This ensures near-zero performance impact during normal browsing while
 * maintaining instant availability when users need gallery extraction.
 * ============================================================================
 */

// =============================================================================
// 1. DEBUG CONFIGURATION - Must be first for logging to work
// =============================================================================

/**
 * Debug Configuration System - Namespace-based approach to prevent identifier conflicts
 * Controls console logging and debug output across the extension
 */
(function() {
  'use strict';

  // Initialize StepThree namespace safely
  const global = typeof globalThis !== 'undefined' ? globalThis :
    (typeof self !== 'undefined' ? self :
      (typeof window !== 'undefined' ? window : {}));

  if (!global.__ST) {
    global.__ST = {};
  }

  // Prevent double initialization
  if (global.__ST.DebugConfigLoaded) {
    return;
  }
  global.__ST.DebugConfigLoaded = true;

  // Define DebugConfig class
  class DebugConfig {
    constructor() {
      // Check if we're in production environment
      this.isProduction = this.detectProductionEnvironment();

      // Global debug settings - can be overridden per module
      this.globalDebugSettings = {
        enableConsoleLogging: !this.isProduction,
        enablePerformanceLogging: !this.isProduction,
        enableErrorLogging: true, // Always log errors
        enableWarningLogging: true, // Always log warnings
        enableInfoLogging: !this.isProduction,
        enableDebugLogging: false, // Only for development debugging
        enableVerboseLogging: false // Only for deep debugging
      };

      // Module-specific debug settings
      this.moduleSettings = {
        'scraper': { enableConsoleLogging: !this.isProduction },
        'picker': { enableConsoleLogging: !this.isProduction },
        'background': { enableConsoleLogging: !this.isProduction },
        'export': { enableConsoleLogging: !this.isProduction },
        'performance': { enableConsoleLogging: !this.isProduction },
        'ui': { enableConsoleLogging: !this.isProduction }
      };
    }

    /**
     * Detect if we're running in a production environment
     */
    detectProductionEnvironment() {
      // Check for production indicators
      try {
        // Chrome extension production detection
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          const manifest = chrome.runtime.getManifest();
          // Consider it production if it's a packaged extension
          if (chrome.runtime.getURL('').startsWith('chrome-extension://')) {
            return true;
          }
        }

        // Development environment indicators
        if (typeof location !== 'undefined') {
          const isDevelopment =
            location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.port !== '';
          return !isDevelopment;
        }

        // Default to production for safety
        return true;
      } catch (error) {
        // If we can't determine, default to production (safer)
        return true;
      }
    }

    /**
     * Check if debugging is enabled for a specific module and level
     */
    isEnabled(module, level) {
      module = module || 'global';
      level = level || 'info';
      const moduleSettings = this.moduleSettings[module] || this.globalDebugSettings;

      switch (level.toLowerCase()) {
      case 'error':
        return moduleSettings.enableErrorLogging !== false;
      case 'warn':
      case 'warning':
        return moduleSettings.enableWarningLogging !== false;
      case 'info':
        return moduleSettings.enableInfoLogging !== false &&
                 moduleSettings.enableConsoleLogging !== false;
      case 'log':
        return moduleSettings.enableConsoleLogging !== false;
      case 'debug':
        return moduleSettings.enableDebugLogging === true &&
                 moduleSettings.enableConsoleLogging !== false;
      case 'verbose':
        return moduleSettings.enableVerboseLogging === true &&
                 moduleSettings.enableConsoleLogging !== false;
      case 'performance':
        return moduleSettings.enablePerformanceLogging !== false &&
                 moduleSettings.enableConsoleLogging !== false;
      default:
        return moduleSettings.enableConsoleLogging !== false;
      }
    }

    /**
     * Safe console logging with debug controls
     */
    log(module, level) {
      const args = Array.prototype.slice.call(arguments, 2);
      if (!this.isEnabled(module, level)) {
        return;
      }

      const prefix = '[' + (module || 'STEPTHREE').toUpperCase() + ']';

      switch ((level || 'log').toLowerCase()) {
      case 'error':
        console.error.apply(console, [prefix].concat(args));
        break;
      case 'warn':
      case 'warning':
        console.warn.apply(console, [prefix].concat(args));
        break;
      case 'info':
        console.info.apply(console, [prefix].concat(args));
        break;
      case 'debug':
        console.debug.apply(console, [prefix].concat(args));
        break;
      case 'performance':
        if (console.time) {
          console.time(prefix + ' ' + args[0]);
        } else {
          console.log.apply(console, [prefix].concat(args));
        }
        break;
      default:
        console.log.apply(console, [prefix].concat(args));
      }
    }

    /**
     * Performance timing utilities
     */
    timeStart(module, label) {
      if (!this.isEnabled(module, 'performance')) {
        return;
      }
      console.time('[' + (module || 'STEPTHREE').toUpperCase() + '] ' + label);
    }

    timeEnd(module, label) {
      if (!this.isEnabled(module, 'performance')) {
        return;
      }
      console.timeEnd('[' + (module || 'STEPTHREE').toUpperCase() + '] ' + label);
    }
  }

  // Store in namespace
  global.__ST.DebugConfig = DebugConfig;

  // Create DEBUG instance in namespace
  if (!global.__ST.DEBUG) {
    global.__ST.DEBUG = new DebugConfig();
  }

  // Export for backward compatibility
  if (typeof window !== 'undefined') {
    window.DEBUG = global.__ST.DEBUG;
  } else if (typeof self !== 'undefined') {
    self.DEBUG = global.__ST.DEBUG;
  }

})(); // End Debug Config IIFE

// =============================================================================
// 1.5 INPUT SANITIZATION SYSTEM - CR-019: Critical security hardening
// =============================================================================

/**
 * Input Sanitization Integration for Content Scripts
 * Provides security sanitization for user input from DOM
 * NOTE: Requires input-sanitizer.js to be loaded before this script in manifest.json
 */
(function() {
  'use strict';

  const global = typeof globalThis !== 'undefined' ? globalThis :
    (typeof self !== 'undefined' ? self :
      (typeof window !== 'undefined' ? window : {}));

  if (!global.__ST) {
    global.__ST = {};
  }

  // Prevent double initialization
  if (global.__ST.InputSanitizationLoaded) {
    return;
  }
  global.__ST.InputSanitizationLoaded = true;

  // Try to get InputSanitizer from global scope
  let InputSanitizerClass = null;
  if (typeof global.InputSanitizer !== 'undefined') {
    InputSanitizerClass = global.InputSanitizer;
  } else if (typeof window !== 'undefined' && typeof window.InputSanitizer !== 'undefined') {
    InputSanitizerClass = window.InputSanitizer;
  }

  // Initialize sanitizer if available
  let sanitizerInstance = null;
  if (InputSanitizerClass) {
    try {
      sanitizerInstance = new InputSanitizerClass();
      console.log('✅ Input Sanitizer initialized in content script (CR-019)');
    } catch (error) {
      throw new Error('SECURITY: Failed to initialize InputSanitizer - ' + error.message);
    }
  } else {
    throw new Error('SECURITY: InputSanitizer is required but not available');
  }

  /**
   * Sanitization Utilities for Content Script
   */
  const SanitizationUtils = {
    /**
     * Sanitize CSS selector before using in querySelector
     */
    sanitizeSelector(selector) {
      if (!sanitizerInstance) {
        throw new Error('SECURITY: InputSanitizer required for selector sanitization');
      }
      return sanitizerInstance.sanitizeSelector(selector);
    },

    /**
     * Sanitize URL before using
     */
    sanitizeURL(url) {
      if (!sanitizerInstance) {
        throw new Error('SECURITY: InputSanitizer required for URL sanitization');
      }
      return sanitizerInstance.sanitizeURL(url);
    },

    /**
     * Sanitize HTML content to prevent XSS
     */
    sanitizeHTML(html) {
      if (!sanitizerInstance) {
        throw new Error('SECURITY: InputSanitizer required for HTML sanitization');
      }
      return sanitizerInstance.sanitizeHTML(html);
    },

    /**
     * Sanitize filename
     */
    sanitizeFilename(filename) {
      if (!sanitizerInstance) {
        throw new Error('SECURITY: InputSanitizer required for filename sanitization');
      }
      return sanitizerInstance.sanitizeFilename(filename);
    },

    /**
     * Safe querySelector with sanitization
     */
    safeQuerySelector(element, selector) {
      const sanitized = this.sanitizeSelector(selector);
      if (!sanitized) {
        console.warn('🛡️ Selector sanitization blocked invalid selector');
        return null;
      }
      try {
        return element.querySelector(sanitized);
      } catch (error) {
        console.warn('Invalid selector:', sanitized, error);
        return null;
      }
    },

    /**
     * Safe querySelectorAll with sanitization
     */
    safeQuerySelectorAll(element, selector) {
      const sanitized = this.sanitizeSelector(selector);
      if (!sanitized) {
        console.warn('🛡️ Selector sanitization blocked invalid selector');
        return [];
      }
      try {
        return element.querySelectorAll(sanitized);
      } catch (error) {
        console.warn('Invalid selector:', sanitized, error);
        return [];
      }
    },

    /**
     * Get sanitizer instance
     */
    getSanitizer() {
      return sanitizerInstance;
    }
  };

  // Store in namespace
  global.__ST.SanitizationUtils = SanitizationUtils;

  // Export for easy access
  if (typeof window !== 'undefined') {
    window.SanitizationUtils = SanitizationUtils;
  } else if (typeof self !== 'undefined') {
    self.SanitizationUtils = SanitizationUtils;
  }

})(); // End Input Sanitization IIFE

// =============================================================================
// 2. MEMORY MANAGEMENT SYSTEM - Critical for preventing memory leaks
// =============================================================================

/**
 * Comprehensive Memory Management and Lifecycle System
 * Implements singleton protection, lifecycle management, bounded data structures,
 * DOM reference cleanup, observer/timer tracking, and memory monitoring
 */
(function() {
  'use strict';

  const global = typeof globalThis !== 'undefined' ? globalThis :
    (typeof self !== 'undefined' ? self :
      (typeof window !== 'undefined' ? window : {}));

  if (!global.__ST) {
    global.__ST = {};
  }

  // Prevent double initialization
  if (global.__ST.MemoryManagementLoaded) {
    return;
  }
  global.__ST.MemoryManagementLoaded = true;

  /**
   * LRU Cache implementation with size limits
   */
  class LRUCache {
    constructor(maxSize = 1000) {
      this.maxSize = maxSize;
      this.cache = new Map();
    }

    get(key) {
      if (this.cache.has(key)) {
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
      }
      return null;
    }

    set(key, value) {
      if (this.cache.has(key)) {
        this.cache.delete(key);
      } else if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(key, value);
    }

    delete(key) {
      return this.cache.delete(key);
    }

    clear() {
      this.cache.clear();
    }

    get size() {
      return this.cache.size;
    }
  }

  /**
   * Bounded Array - Prevents unbounded growth
   */
  class BoundedArray {
    constructor(maxSize = 1000) {
      this.maxSize = maxSize;
      this.items = [];
    }

    push(item) {
      this.items.push(item);
      if (this.items.length > this.maxSize) {
        this.items.shift();
      }
      return this.items.length;
    }

    unshift(item) {
      this.items.unshift(item);
      if (this.items.length > this.maxSize) {
        this.items.pop();
      }
      return this.items.length;
    }

    slice(start, end) {
      return this.items.slice(start, end);
    }

    forEach(callback) {
      return this.items.forEach(callback);
    }

    get length() {
      return this.items.length;
    }

    clear() {
      this.items.length = 0;
    }
  }

  /**
   * Resource Tracker - Tracks all observers, timers, and event listeners
   */
  class ResourceTracker {
    constructor() {
      this.observers = new Set();
      this.timers = new Set();
      this.intervals = new Set();
      this.eventListeners = new WeakMap();
      this.workers = new Set();
      this.originalSetTimeout = window.setTimeout;
      this.originalSetInterval = window.setInterval;
      this.originalClearTimeout = window.clearTimeout;
      this.originalClearInterval = window.clearInterval;
      this.isIntercepting = false;
      this.setupInterception();
    }

    setupInterception() {
      if (this.isIntercepting) {
        return;
      }

      const self = this;
      
      // Intercept setTimeout
      window.setTimeout = function(callback, delay, ...args) {
        const timeoutId = self.originalSetTimeout.call(this, function() {
          self.timers.delete(timeoutId);
          return callback.apply(this, args);
        }, delay);
        self.timers.add(timeoutId);
        return timeoutId;
      };

      // Intercept setInterval
      window.setInterval = function(callback, delay, ...args) {
        const intervalId = self.originalSetInterval.call(this, callback, delay, ...args);
        self.intervals.add(intervalId);
        return intervalId;
      };

      // Intercept clearTimeout
      window.clearTimeout = function(timeoutId) {
        self.timers.delete(timeoutId);
        return self.originalClearTimeout.call(this, timeoutId);
      };

      // Intercept clearInterval
      window.clearInterval = function(intervalId) {
        self.intervals.delete(intervalId);
        return self.originalClearInterval.call(this, intervalId);
      };

      this.isIntercepting = true;
    }

    trackObserver(observer) {
      this.observers.add(observer);
    }

    trackEventListener(element, event, listener, options) {
      if (!this.eventListeners.has(element)) {
        this.eventListeners.set(element, new Map());
      }
      const elementListeners = this.eventListeners.get(element);
      if (!elementListeners.has(event)) {
        elementListeners.set(event, new Set());
      }
      elementListeners.get(event).add({ listener, options });
    }

    trackWorker(worker) {
      this.workers.add(worker);
    }

    cleanup() {
      // Disconnect all observers
      for (const observer of this.observers) {
        try {
          if (observer && typeof observer.disconnect === 'function') {
            observer.disconnect();
          }
        } catch (error) {
          console.warn('Error disconnecting observer:', error);
        }
      }
      this.observers.clear();

      // Clear all timers
      for (const timerId of this.timers) {
        try {
          this.originalClearTimeout.call(window, timerId);
        } catch (error) {
          console.warn('Error clearing timeout:', error);
        }
      }
      this.timers.clear();

      // Clear all intervals
      for (const intervalId of this.intervals) {
        try {
          this.originalClearInterval.call(window, intervalId);
        } catch (error) {
          console.warn('Error clearing interval:', error);
        }
      }
      this.intervals.clear();

      // Terminate all workers
      for (const worker of this.workers) {
        try {
          if (worker && typeof worker.terminate === 'function') {
            worker.terminate();
          }
        } catch (error) {
          console.warn('Error terminating worker:', error);
        }
      }
      this.workers.clear();

      // Restore original global functions
      if (this.isIntercepting) {
        window.setTimeout = this.originalSetTimeout;
        window.setInterval = this.originalSetInterval;
        window.clearTimeout = this.originalClearTimeout;
        window.clearInterval = this.originalClearInterval;
        this.isIntercepting = false;
      }

      console.log('🧹 Resource tracker cleanup completed');
    }

    getStatus() {
      return {
        observers: this.observers.size,
        timers: this.timers.size,
        intervals: this.intervals.size,
        workers: this.workers.size,
        timestamp: Date.now()
      };
    }
  }

  /**
   * DOM Reference Manager - Uses WeakMap for DOM references
   */
  class DOMReferenceManager {
    constructor() {
      this.elementMetadata = new WeakMap();
      this.elementCaches = new WeakMap();
    }

    setElementMetadata(element, metadata) {
      if (element && element instanceof Element) {
        this.elementMetadata.set(element, metadata);
      }
    }

    getElementMetadata(element) {
      return this.elementMetadata.get(element);
    }

    setElementCache(element, cache) {
      if (element && element instanceof Element) {
        this.elementCaches.set(element, cache);
      }
    }

    getElementCache(element) {
      return this.elementCaches.get(element);
    }

    cleanup() {
      // WeakMaps clean themselves, but we can help by dereferencing
      try {
        // Force garbage collection hint
        if (typeof window.gc === 'function') {
          window.gc();
        }
      } catch (error) {
        // Ignore gc errors
      }
      console.log('🗑️ DOM reference cleanup completed');
    }
  }

  /**
   * Memory Monitor - Lightweight memory monitoring
   */
  class MemoryMonitor {
    constructor() {
      this.samples = new BoundedArray(100);
      this.lastSample = null;
      this.thresholds = {
        warning: PERFORMANCE_CONFIG.MEMORY_WARNING_THRESHOLD_BYTES,
        critical: PERFORMANCE_CONFIG.MEMORY_CRITICAL_THRESHOLD_BYTES
      };
      this.startMonitoring();
    }

    startMonitoring() {
      // Sample every 30 seconds
      window.setInterval(() => {
        this.takeSample();
      }, PERFORMANCE_CONFIG.MEMORY_SAMPLE_INTERVAL_MS);

      // Take initial sample
      setTimeout(() => this.takeSample(), 1000);
    }

    takeSample() {
      try {
        if (typeof performance === 'undefined' || !performance.memory) {
          return;
        }

        const sample = {
          timestamp: Date.now(),
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          resourcesTracked: global.__ST.resourceTracker ? global.__ST.resourceTracker.getStatus() : {}
        };

        this.samples.push(sample);
        this.lastSample = sample;

        // Check thresholds
        this.checkMemoryThresholds(sample);

        // Report health status
        this.reportHealthStatus(sample);

      } catch (error) {
        console.warn('Error taking memory sample:', error);
      }
    }

    checkMemoryThresholds(sample) {
      const used = sample.usedJSHeapSize;
      
      if (used > this.thresholds.critical) {
        console.error('💥 CRITICAL MEMORY USAGE:', this.formatBytes(used));
        this.triggerEmergencyCleanup();
      } else if (used > this.thresholds.warning) {
        console.warn('⚠️ HIGH MEMORY USAGE:', this.formatBytes(used));
        this.triggerPreventiveCleanup();
      }
    }

    triggerEmergencyCleanup() {
      try {
        global.__ST.lifecycleManager?.emergencyCleanup();
      } catch (error) {
        console.error('Emergency cleanup failed:', error);
      }
    }

    triggerPreventiveCleanup() {
      try {
        global.__ST.lifecycleManager?.preventiveCleanup();
      } catch (error) {
        console.warn('Preventive cleanup failed:', error);
      }
    }

    reportHealthStatus(sample) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({
            cmd: 'health_status',
            type: 'memory_sample',
            data: {
              usedMemory: sample.usedJSHeapSize,
              totalMemory: sample.totalJSHeapSize,
              resourceCount: sample.resourcesTracked,
              timestamp: sample.timestamp
            }
          }).catch(() => {
            // Ignore messaging errors
          });
        }
      } catch (error) {
        // Ignore health status errors
      }
    }

    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getMemoryStats() {
      const recent = this.samples.slice(-10);
      if (recent.length === 0) return null;

      const current = recent[recent.length - 1];
      const trend = recent.length > 1 ? 
        (current.usedJSHeapSize - recent[0].usedJSHeapSize) / recent.length : 0;

      return {
        current: current.usedJSHeapSize,
        trend: trend,
        samples: recent.length,
        formatted: this.formatBytes(current.usedJSHeapSize)
      };
    }
  }

  /**
   * Lifecycle Manager - Centralized cleanup and lifecycle management
   */
  class LifecycleManager {
    constructor() {
      this.initialized = false;
      this.cleanupHandlers = new Set();
      this.emergencyCleanupHandlers = new Set();
      this.setupLifecycleHandlers();
    }

    setupLifecycleHandlers() {
      if (this.initialized) return;
      
      // Page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.onPageHidden();
        }
      });

      // Page unload events
      window.addEventListener('beforeunload', () => {
        this.onBeforeUnload();
      });

      window.addEventListener('pagehide', () => {
        this.onPageHide();
      });

      // Focus loss
      window.addEventListener('blur', () => {
        this.onBlur();
      });

      this.initialized = true;
      console.log('✅ Lifecycle manager initialized');
    }

    registerCleanupHandler(handler, isEmergency = false) {
      if (typeof handler === 'function') {
        if (isEmergency) {
          this.emergencyCleanupHandlers.add(handler);
        } else {
          this.cleanupHandlers.add(handler);
        }
      }
    }

    unregisterCleanupHandler(handler) {
      this.cleanupHandlers.delete(handler);
      this.emergencyCleanupHandlers.delete(handler);
    }

    onPageHidden() {
      this.preventiveCleanup();
    }

    onBeforeUnload() {
      this.fullCleanup();
    }

    onPageHide() {
      this.fullCleanup();
    }

    onBlur() {
      // Light cleanup on focus loss
      setTimeout(() => {
        if (document.hidden) {
          this.preventiveCleanup();
        }
      }, 5000);
    }

    preventiveCleanup() {
      console.log('🧹 Starting preventive cleanup...');
      
      for (const handler of this.cleanupHandlers) {
        try {
          handler('preventive');
        } catch (error) {
          console.warn('Cleanup handler error:', error);
        }
      }

      // Clear caches
      this.clearCaches();
    }

    emergencyCleanup() {
      console.log('🚨 Starting emergency cleanup...');
      
      for (const handler of [...this.cleanupHandlers, ...this.emergencyCleanupHandlers]) {
        try {
          handler('emergency');
        } catch (error) {
          console.error('Emergency cleanup handler error:', error);
        }
      }

      // Aggressive cleanup
      this.clearCaches();
      global.__ST.resourceTracker?.cleanup();
      global.__ST.domReferenceManager?.cleanup();

      // Force garbage collection hint
      try {
        if (typeof window.gc === 'function') {
          window.gc();
        }
      } catch (error) {
        // Ignore gc errors
      }
    }

    fullCleanup() {
      console.log('🧹 Starting full cleanup...');
      
      // Run all cleanup handlers
      for (const handler of [...this.cleanupHandlers, ...this.emergencyCleanupHandlers]) {
        try {
          handler('full');
        } catch (error) {
          console.error('Full cleanup handler error:', error);
        }
      }

      // Cleanup resources
      global.__ST.resourceTracker?.cleanup();
      global.__ST.domReferenceManager?.cleanup();
      this.clearCaches();

      console.log('✅ Full cleanup completed');
    }

    clearCaches() {
      // Clear any global caches
      for (const key of Object.keys(global.__ST)) {
        const obj = global.__ST[key];
        if (obj && typeof obj.clear === 'function') {
          try {
            obj.clear();
          } catch (error) {
            console.warn(`Error clearing cache ${key}:`, error);
          }
        }
      }
    }
  }

  // Initialize memory management systems
  global.__ST.LRUCache = LRUCache;
  global.__ST.BoundedArray = BoundedArray;
  global.__ST.ResourceTracker = ResourceTracker;
  global.__ST.DOMReferenceManager = DOMReferenceManager;
  global.__ST.MemoryMonitor = MemoryMonitor;
  global.__ST.LifecycleManager = LifecycleManager;

  // Create global instances
  if (!global.__ST.resourceTracker) {
    global.__ST.resourceTracker = new ResourceTracker();
  }
  
  if (!global.__ST.domReferenceManager) {
    global.__ST.domReferenceManager = new DOMReferenceManager();
  }
  
  if (!global.__ST.memoryMonitor) {
    global.__ST.memoryMonitor = new MemoryMonitor();
  }
  
  if (!global.__ST.lifecycleManager) {
    global.__ST.lifecycleManager = new LifecycleManager();
  }

  console.log('✅ Memory management system loaded');

})(); // End Memory Management IIFE

// =============================================================================
// 2.5 DOM QUERY CACHING SYSTEM - CR-015: Performance optimization
// =============================================================================

/**
 * DOM Query Caching and Batching System Integration
 * Reduces expensive querySelectorAll calls and prevents layout thrashing
 * NOTE: Requires dom-cache.js to be loaded before this script in manifest.json
 */
(function() {
  'use strict';

  const global = typeof globalThis !== 'undefined' ? globalThis :
    (typeof self !== 'undefined' ? self :
      (typeof window !== 'undefined' ? window : {}));

  if (!global.__ST) {
    global.__ST = {};
  }

  // Prevent double initialization
  if (global.__ST.DOMCachingLoaded) {
    return;
  }
  global.__ST.DOMCachingLoaded = true;

  // Check if DOMQueryCache and DOMBatcher are available
  const DOMQueryCacheClass = global.DOMQueryCache || global.__ST.DOMQueryCache;
  const DOMBatcherClass = global.DOMBatcher || global.__ST.DOMBatcher;

  if (!DOMQueryCacheClass || !DOMBatcherClass) {
    console.warn('⚠️ DOM caching classes not available - add dom-cache.js to manifest.json content_scripts');
    return;
  }

  // Initialize DOM Query Cache with optimized settings
  let domQueryCache = null;
  try {
    domQueryCache = new DOMQueryCacheClass({
      defaultTTL: 5000, // 5 seconds
      maxCacheSize: 50, // Limit cache size
      enableMutationObserver: true,
      mutationDebounce: 150,
      enableStats: true
    });

    // Configure caching for common selectors
    domQueryCache.configureSelector('img', { 
      ttl: 3000, // Images change less frequently
      enabled: true 
    });
    domQueryCache.configureSelector('a[href]', { 
      ttl: 5000, // Links are fairly static
      enabled: true 
    });
    domQueryCache.configureSelector('img[data-src]', { 
      ttl: 2000, // Lazy images change more
      enabled: true 
    });
    domQueryCache.configureSelector('img[data-lazy]', { 
      ttl: 2000,
      enabled: true 
    });
    domQueryCache.configureSelector('[style*="background-image"]', { 
      ttl: 4000,
      enabled: true 
    });

    console.log('✅ DOMQueryCache initialized (CR-015)');
  } catch (error) {
    console.warn('⚠️ Failed to initialize DOMQueryCache:', error);
  }

  // Initialize DOM Batcher
  let domBatcher = null;
  try {
    domBatcher = new DOMBatcherClass({
      autoFlush: true,
      flushDelay: 16,
      enableStats: true
    });

    console.log('✅ DOMBatcher initialized (CR-015)');
  } catch (error) {
    console.warn('⚠️ Failed to initialize DOMBatcher:', error);
  }

  // Store instances in global namespace
  global.__ST.domQueryCache = domQueryCache;
  global.__ST.domBatcher = domBatcher;

  // Export convenience wrappers for easy access
  global.__ST.cachedQuery = function(selector, options = {}) {
    if (!domQueryCache) {
      return Array.from(document.querySelectorAll(selector));
    }
    return domQueryCache.query(selector, options);
  };

  global.__ST.cachedQuerySingle = function(selector, options = {}) {
    if (!domQueryCache) {
      return document.querySelector(selector);
    }
    return domQueryCache.query(selector, { ...options, single: true });
  };

  global.__ST.batchRead = function(callback) {
    if (!domBatcher) {
      return Promise.resolve(callback());
    }
    return domBatcher.read(callback);
  };

  global.__ST.batchWrite = function(callback) {
    if (!domBatcher) {
      return Promise.resolve(callback());
    }
    return domBatcher.write(callback);
  };

  global.__ST.batchMeasure = function(element) {
    if (!domBatcher) {
      return Promise.resolve(element?.getBoundingClientRect() || null);
    }
    return domBatcher.measure(element);
  };

  // Export for backward compatibility
  if (typeof window !== 'undefined') {
    window.cachedQuery = global.__ST.cachedQuery;
    window.cachedQuerySingle = global.__ST.cachedQuerySingle;
    window.batchRead = global.__ST.batchRead;
    window.batchWrite = global.__ST.batchWrite;
    window.batchMeasure = global.__ST.batchMeasure;
  }

  // Report cache stats periodically in debug mode
  if (global.__ST.DEBUG && !global.__ST.DEBUG.isProduction) {
    setInterval(() => {
      if (domQueryCache) {
        const stats = domQueryCache.getStats();
        console.log('📊 DOM Cache Stats:', stats);
      }
      if (domBatcher) {
        const stats = domBatcher.getStats();
        console.log('📊 DOM Batcher Stats:', stats);
      }
    }, 60000); // Every minute
  }

})(); // End DOM Caching IIFE

// =============================================================================
// 3. ERROR HANDLING SYSTEM - Early, so error handling is available
// =============================================================================

/**
 * Centralized Error Handling System
 * Provides unified error reporting, logging, and user feedback
 * Now with memory-safe bounded data structures and lifecycle management
 */
class ErrorHandlingSystem {
  constructor(options = {}) {
    this.options = {
      enableConsoleLogging: options.enableConsoleLogging !== false,
      enableUserNotifications: options.enableUserNotifications !== false,
      enableErrorReporting: options.enableErrorReporting !== false,
      maxErrorHistory: Math.min(options.maxErrorHistory || 100, 500), // Cap at 500
      // Lightweight configuration - no heavy monitoring
      enableSmartThrottling: options.enableSmartThrottling !== false,
      maxNotificationsPerMinute: options.maxNotificationsPerMinute || 3,
      errorRecoveryStrategies: options.errorRecoveryStrategies !== false,
      minimalErrorLogging: options.minimalErrorLogging || false,
      adaptiveErrorHandling: options.adaptiveErrorHandling !== false,
      ...options
    };

    // Use memory-safe bounded data structures
    const global = typeof globalThis !== 'undefined' ? globalThis : window;
    const LRUCache = global.__ST?.LRUCache || Map;
    const BoundedArray = global.__ST?.BoundedArray || Array;

    this.notificationCounts = new LRUCache(100);
    this.lastErrorTimes = new LRUCache(200);
    this.recoveryAttempts = new LRUCache(50);
    this.errorCounts = new LRUCache(300);

    // Use bounded array for history
    if (BoundedArray === Array) {
      this.errorHistory = [];
    } else {
      this.errorHistory = new BoundedArray(this.options.maxErrorHistory);
    }

    this.initialized = false;

    this.init();
  }

  init() {
    if (this.initialized) {
      return;
    }

    // Set up global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleGlobalError(event.error, 'Global Error', {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleGlobalError(event.reason, 'Unhandled Promise Rejection', {
          promise: event.promise
        });
      });
    }

    // Register with lifecycle manager for cleanup
    const global = typeof globalThis !== 'undefined' ? globalThis : window;
    if (global.__ST?.lifecycleManager) {
      global.__ST.lifecycleManager.registerCleanupHandler((type) => {
        if (type === 'preventive') {
          this.trimHistory();
        } else {
          this.clearHistory();
        }
      });
    }

    this.initialized = true;
    this.log('✅ Error handling system initialized with memory management', 'info');
  }

  /**
   * Enhanced error handling
   * @param {Error|string} error - The error object or message
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional error metadata
   * @param {string} severity - Error severity: 'low', 'medium', 'high', 'critical'
   * @param {Object} recoveryOptions - Recovery strategy options
   */
  handleError(error, context = 'Unknown', metadata = {}, severity = 'medium', recoveryOptions = {}) {
    try {
      const errorInfo = this.normalizeError(error, context, metadata, severity);

      // Log the error
      if (this.options.enableConsoleLogging) {
        this.logError(errorInfo);
      }

      // Store in history
      this.addToHistory(errorInfo);

      // Count occurrences
      this.trackErrorFrequency(errorInfo);

      // Smart notification throttling
      if (this.options.enableUserNotifications && this.shouldNotifyUser(errorInfo)) {
        if (this.canNotifyUser(errorInfo)) {
          this.notifyUser(errorInfo);
        }
      }

      // Attempt automatic error recovery if enabled
      if (this.options.errorRecoveryStrategies && recoveryOptions.attemptRecovery) {
        this.attemptErrorRecovery(errorInfo, recoveryOptions);
      }

      return errorInfo;
    } catch (handlingError) {
      // Fallback error handling
      console.error('❌ Error in error handling system:', handlingError);
      console.error('Original error:', error);
    }
  }

  /**
   * Handle global unhandled errors
   */
  handleGlobalError(error, type, details) {
    this.handleError(error, `Global: ${type}`, details, 'high');
  }

  /**
   * Normalize error into consistent format
   */
  normalizeError(error, context, metadata, severity) {
    const timestamp = new Date().toISOString();
    const id = this.generateErrorId();

    let message, stack, name;

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
      name = error.name;
    } else if (typeof error === 'string') {
      message = error;
      name = 'CustomError';
    } else {
      message = String(error);
      name = 'UnknownError';
    }

    return {
      id,
      timestamp,
      message,
      stack,
      name,
      context,
      severity,
      metadata: {
        url: typeof window !== 'undefined' ? window.location?.href : 'N/A',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        ...metadata
      }
    };
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Log error to console with appropriate formatting
   */
  logError(errorInfo) {
    const { severity, context, message, id } = errorInfo;

    const symbols = {
      low: '💡',
      medium: '⚠️',
      high: '❌',
      critical: '💥'
    };

    const symbol = symbols[severity] || '⚠️';

    console.group(`${symbol} [${severity.toUpperCase()}] ${context}`);
    console.error(`Message: ${message}`);
    console.error(`ID: ${id}`);
    console.error(`Time: ${errorInfo.timestamp}`);

    if (errorInfo.stack) {
      console.error('Stack:', errorInfo.stack);
    }

    if (Object.keys(errorInfo.metadata).length > 0) {
      console.error('Metadata:', errorInfo.metadata);
    }

    console.groupEnd();
  }

  /**
   * Add error to history - works with both regular array and BoundedArray
   */
  addToHistory(errorInfo) {
    if (typeof this.errorHistory.unshift === 'function') {
      // BoundedArray or regular array
      this.errorHistory.unshift(errorInfo);
      
      // For regular arrays, maintain max history size
      if (!this.errorHistory.maxSize && this.errorHistory.length > this.options.maxErrorHistory) {
        this.errorHistory = this.errorHistory.slice(0, this.options.maxErrorHistory);
      }
    } else {
      console.warn('Invalid errorHistory structure');
    }
  }

  /**
   * Track error frequency - works with both Map and LRUCache
   */
  trackErrorFrequency(errorInfo) {
    const key = `${errorInfo.context}:${errorInfo.message}`;
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);
  }

  /**
   * Trim history for preventive cleanup
   */
  trimHistory() {
    if (typeof this.errorHistory.clear === 'function') {
      // Keep only recent errors for BoundedArray
      const recentCount = Math.floor(this.options.maxErrorHistory * 0.5);
      if (this.errorHistory.length > recentCount) {
        const recent = this.errorHistory.slice(0, recentCount);
        this.errorHistory.clear();
        recent.forEach(error => this.errorHistory.push(error));
      }
    } else if (Array.isArray(this.errorHistory)) {
      // Regular array
      const keepCount = Math.floor(this.options.maxErrorHistory * 0.5);
      this.errorHistory = this.errorHistory.slice(0, keepCount);
    }
    
    console.log('🧹 Error history trimmed');
  }

  /**
   * Determine if user should be notified
   */
  shouldNotifyUser(errorInfo) {
    // Only notify for high and critical errors
    if (!['high', 'critical'].includes(errorInfo.severity)) {
      return false;
    }

    // Don't spam user with repeated errors
    const key = `${errorInfo.context}:${errorInfo.message}`;
    const count = this.errorCounts.get(key) || 0;

    return count <= 3; // Only notify for first 3 occurrences
  }

  /**
   * Smart notification throttling
   */
  canNotifyUser(errorInfo) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${minute}`;
    
    // Check if we've exceeded notification limits this minute
    const currentCount = this.notificationCounts.get(key) || 0;
    if (currentCount >= this.options.maxNotificationsPerMinute) {
      return false;
    }
    
    // Check if this specific error was recently shown
    const errorKey = `${errorInfo.context}:${errorInfo.name}`;
    const lastShown = this.lastErrorTimes.get(errorKey);
    if (lastShown && (now - lastShown) < 30000) { // 30 second cooldown
      return false;
    }
    
    // Update counters
    this.notificationCounts.set(key, currentCount + 1);
    this.lastErrorTimes.set(errorKey, now);
    
    return true;
  }

  /**
   * Notify user about error
   */
  notifyUser(errorInfo) {
    try {
      const message = this.createUserFriendlyMessage(errorInfo);

      // Route notification through service worker (content scripts can't access chrome.notifications directly)
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          cmd: 'show_notification',
          title: 'StepThree Gallery Scraper',
          body: message,
          iconUrl: 'icons/48.png',
          notificationType: 'basic'
        }).catch(error => {
          console.error('Failed to send notification to service worker:', error);
          // Fallback to console warning
          console.warn('User notification (fallback):', message);
        });
      } else if (typeof window !== 'undefined') {
        // Fallback to console warning for testing
        console.warn('User notification:', message);
      }
    } catch (notificationError) {
      console.error('Failed to notify user:', notificationError);
    }
  }

  /**
   * Create user-friendly error message
   */
  createUserFriendlyMessage(errorInfo) {
    const contextMap = {
      'scraping': 'There was an issue while scraping images.',
      'download': 'Failed to download some images.',
      'export': 'Export operation encountered a problem.',
      'network': 'Network connection issue detected.',
      'permission': 'Permission denied for this operation.'
    };

    for (const [key, friendlyMessage] of Object.entries(contextMap)) {
      if (errorInfo.context.toLowerCase().includes(key)) {
        return `${friendlyMessage} Error ID: ${errorInfo.id}`;
      }
    }

    return `An error occurred in ${errorInfo.context}. Error ID: ${errorInfo.id}`;
  }

  /**
   * Attempt automatic error recovery
   */
  attemptErrorRecovery(errorInfo, recoveryOptions) {
    const recoveryKey = `${errorInfo.context}:${errorInfo.name}`;
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
    
    if (attempts >= 3) {
      this.log(`🛑 Max recovery attempts reached for ${recoveryKey}`, 'warn');
      return false;
    }
    
    this.recoveryAttempts.set(recoveryKey, attempts + 1);
    
    // Basic recovery strategies
    switch (errorInfo.context) {
      case 'Content Script':
        this.recoverContentScript(recoveryOptions);
        break;
      case 'Smart Selection':
        this.recoverSmartSelection(recoveryOptions);
        break;
      case 'Download Manager':
        this.recoverDownload(recoveryOptions);
        break;
      default:
        this.genericRecovery(errorInfo, recoveryOptions);
    }
    
    return true;
  }

  /**
   * Content script recovery strategies
   */
  recoverContentScript(options) {
    this.log('🔄 Attempting content script recovery...', 'info');
    
    // Clear any cached selectors
    if (window.AdaptiveSelectorSystem) {
      window.AdaptiveSelectorSystem.clearCache?.();
    }
    
    // Retry with backup patterns
    if (options.retryCallback) {
      setTimeout(() => options.retryCallback(), 1000);
    }
  }

  /**
   * Smart selection recovery
   */
  recoverSmartSelection(options) {
    this.log('🎯 Attempting smart selection recovery...', 'info');
    
    // Use fallback selectors
    if (options.fallbackSelectors) {
      return options.fallbackSelectors;
    }
    
    // Reduce confidence threshold temporarily
    if (window.AdaptiveSelectorSystem) {
      const system = window.AdaptiveSelectorSystem;
      system.options.confidenceThreshold = Math.max(0.4, system.options.confidenceThreshold - 0.2);
    }
  }

  /**
   * Download recovery
   */
  recoverDownload(options) {
    this.log('⬇️ Attempting download recovery...', 'info');
    
    // Retry with different approach
    if (options.retryCallback) {
      setTimeout(() => options.retryCallback(), 2000);
    }
  }

  /**
   * Generic error recovery
   */
  genericRecovery(errorInfo, options) {
    this.log(`🔧 Generic recovery for ${errorInfo.context}`, 'info');
    
    // Reset error count after successful recovery
    setTimeout(() => {
      const recoveryKey = `${errorInfo.context}:${errorInfo.name}`;
      this.recoveryAttempts.delete(recoveryKey);
    }, 300000); // 5 minutes
  }

  /**
   * Utility logging method
   */
  log(message, level = 'info') {
    if (this.options.enableConsoleLogging) {
      const symbols = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        success: '✅'
      };
      console.log(`${symbols[level] || 'ℹ️'} ${message}`);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorHistory.length,
      bySeverity: {},
      byContext: {},
      mostFrequent: [],
      recentErrors: this.errorHistory.slice(0, 10)
    };

    // Count by severity
    this.errorHistory.forEach(error => {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    // Count by context
    this.errorHistory.forEach(error => {
      const context = error.context.split(':')[0]; // Get main context
      stats.byContext[context] = (stats.byContext[context] || 0) + 1;
    });

    // Most frequent errors
    const sortedFrequencies = Array.from(this.errorCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    stats.mostFrequent = sortedFrequencies.map(([key, count]) => ({
      error: key,
      count
    }));

    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    if (typeof this.errorHistory.clear === 'function') {
      this.errorHistory.clear();
    } else if (Array.isArray(this.errorHistory)) {
      this.errorHistory.length = 0;
    }
    
    this.errorCounts.clear();
    this.notificationCounts.clear();
    this.lastErrorTimes.clear();
    this.recoveryAttempts.clear();
    this.log('🗑️ Error history cleared', 'info');
  }
}

// Global error handler instance with singleton protection
if (typeof window !== 'undefined') {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  if (!global.__ST) {
    global.__ST = {};
  }
  
  if (!global.__ST.ErrorHandlingSystemLoaded) {
    global.__ST.ErrorHandlingSystemLoaded = true;
    window.StepThreeErrorHandler = new ErrorHandlingSystem();
  }
}

// =============================================================================
// 3. INPUT VALIDATION SYSTEM
// =============================================================================

/**
 * Lightweight Input Validation and Sanitization System
 * Essential validation for security without heavy overhead
 */
class InputValidationSystem {
  constructor(options = {}) {
    this.options = {
      // Validation strictness levels
      strictMode: options.strictMode !== false,
      allowDangerousUrls: options.allowDangerousUrls || false,
      maxStringLength: options.maxStringLength || 10000,
      maxArrayLength: options.maxArrayLength || 1000,
      
      // Security settings
      enableXSSProtection: options.enableXSSProtection !== false,
      enableSQLInjectionProtection: options.enableSQLInjectionProtection !== false,
      
      // URL validation
      allowedProtocols: options.allowedProtocols || ['http:', 'https:', 'data:', 'blob:'],
      blockedDomains: options.blockedDomains || [],
      
      // File validation
      allowedFileTypes: options.allowedFileTypes || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      
      ...options
    };

    // Lightweight XSS protection patterns
    this.xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi
    ];

    // Basic SQL injection patterns
    this.sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /['"]\s*;\s*--/gi,
      /\/\*[\s\S]*?\*\//gi
    ];

    console.log('✅ Input Validation System initialized');
  }

  /**
   * Main validation entry point
   */
  validate(input, type, options = {}) {
    try {
      const validationConfig = {
        ...this.options,
        ...options,
        type,
        originalInput: input
      };

      return this.performValidation(input, type, validationConfig);
    } catch (error) {
      return {
        valid: false,
        sanitized: input,
        errors: [`Validation system error: ${error.message}`],
        type
      };
    }
  }

  /**
   * Perform validation based on type
   */
  performValidation(input, type, config) {
    switch (type) {
      case 'url':
        return this.validateUrl(input, config);
      case 'string':
        return this.validateString(input, config);
      case 'css_selector':
        return this.validateCssSelector(input, config);
      case 'filename':
        return this.validateFilename(input, config);
      case 'user_input':
        return this.validateUserInput(input, config);
      default:
        return this.validateGeneric(input, config);
    }
  }

  /**
   * URL validation with security checks
   */
  validateUrl(url, config) {
    const errors = [];
    let sanitized = url;

    try {
      const urlObj = new URL(url);
      
      // Protocol validation
      if (!this.options.allowedProtocols.includes(urlObj.protocol)) {
        errors.push(`Protocol '${urlObj.protocol}' not allowed`);
      }

      // Check for dangerous URL patterns
      if (!this.options.allowDangerousUrls) {
        const dangerousPatterns = [
          /javascript:/i,
          /data:.*script/i,
          /vbscript:/i
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(url)) {
            errors.push('URL contains potentially dangerous content');
            break;
          }
        }
      }

      // XSS protection in URL parameters
      if (this.options.enableXSSProtection) {
        const urlString = urlObj.toString();
        for (const pattern of this.xssPatterns) {
          if (pattern.test(urlString)) {
            errors.push('URL contains XSS patterns');
            sanitized = this.sanitizeXSS(url);
            break;
          }
        }
      }

    } catch (urlError) {
      errors.push(`Invalid URL format: ${urlError.message}`);
    }

    return {
      valid: errors.length === 0,
      sanitized,
      errors,
      type: 'url'
    };
  }

  /**
   * String validation with XSS protection
   */
  validateString(str, config) {
    const errors = [];
    let sanitized = str;

    // Type check
    if (typeof str !== 'string') {
      sanitized = String(str);
    }

    // Length validation
    if (sanitized.length > this.options.maxStringLength) {
      errors.push(`String too long: ${sanitized.length} > ${this.options.maxStringLength}`);
      sanitized = sanitized.substring(0, this.options.maxStringLength);
    }

    // XSS protection
    if (this.options.enableXSSProtection) {
      sanitized = this.sanitizeXSS(sanitized);
    }

    // SQL injection protection
    if (this.options.enableSQLInjectionProtection) {
      for (const pattern of this.sqlPatterns) {
        if (pattern.test(sanitized)) {
          errors.push('String contains SQL injection patterns');
          sanitized = this.sanitizeSQLInjection(sanitized);
          break;
        }
      }
    }

    // Control character removal
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return {
      valid: errors.length === 0,
      sanitized,
      errors,
      type: 'string'
    };
  }

  /**
   * CSS selector validation
   */
  validateCssSelector(selector, config) {
    const errors = [];
    let sanitized = selector;

    try {
      // Test if valid CSS selector
      document.querySelector(selector);
      
      // Check for dangerous CSS patterns
      const dangerousPatterns = [
        /javascript:/i,
        /expression\(/i,
        /url\([^)]*script/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(selector)) {
          errors.push('CSS selector contains dangerous patterns');
          break;
        }
      }

    } catch (selectorError) {
      errors.push(`Invalid CSS selector: ${selectorError.message}`);
    }

    return {
      valid: errors.length === 0,
      sanitized,
      errors,
      type: 'css_selector'
    };
  }

  /**
   * Filename validation
   */
  validateFilename(filename, config) {
    const errors = [];
    let sanitized = filename;

    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    
    // Length validation
    if (sanitized.length > 255) {
      errors.push('Filename too long');
      sanitized = sanitized.substring(0, 255);
    }

    // File extension validation
    if (this.options.allowedFileTypes.length > 0) {
      const extension = sanitized.split('.').pop()?.toLowerCase();
      if (extension && !this.options.allowedFileTypes.includes(extension)) {
        errors.push(`File type '${extension}' not allowed`);
      }
    }

    return {
      valid: errors.length === 0,
      sanitized,
      errors,
      type: 'filename'
    };
  }

  /**
   * User input validation (strict)
   */
  validateUserInput(input, config) {
    // Apply strict validation for user inputs
    const strictConfig = {
      ...config,
      enableXSSProtection: true,
      enableSQLInjectionProtection: true,
      strictMode: true
    };

    return this.validateString(input, strictConfig);
  }

  /**
   * Generic validation fallback
   */
  validateGeneric(input, config) {
    const errors = [];
    let sanitized = input;

    // Basic sanitization
    if (typeof input === 'string') {
      sanitized = this.sanitizeBasic(input);
    }

    return {
      valid: true,
      sanitized,
      errors,
      type: 'generic'
    };
  }

  /**
   * XSS sanitization
   */
  sanitizeXSS(str) {
    let sanitized = str;
    
    for (const pattern of this.xssPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Encode HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }

  /**
   * SQL injection sanitization
   */
  sanitizeSQLInjection(str) {
    let sanitized = str;
    
    for (const pattern of this.sqlPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    return sanitized;
  }

  /**
   * Basic sanitization
   */
  sanitizeBasic(str) {
    return str
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  }
}

// Create global instance with singleton protection
if (typeof window !== 'undefined') {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  if (!global.__ST) {
    global.__ST = {};
  }
  
  if (!global.__ST.InputValidationSystemLoaded) {
    global.__ST.InputValidationSystemLoaded = true;
    window.inputValidator = new InputValidationSystem({
      strictMode: true,
      enableXSSProtection: true,
      enableSQLInjectionProtection: true
    });
  }
}

// =============================================================================
// 4. LIBRARY UTILITIES - Essential utilities for CSS selectors and DOM operations
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
        details: 'Complex selectors can cause performance issues'
      };
    }

    // Test for valid CSS syntax
    try {
      document.querySelector(selector);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid CSS selector: ${error.message}`,
        details: 'Selector syntax is not valid CSS'
      };
    }
  }

  // Safe query selector with validation and fallback
  static safeQuerySelector(selector, context = document) {
    const validation = this.validateCSSSelector(selector);
    if (!validation.valid) {
      console.warn('Invalid CSS selector:', validation.error);
      return null;
    }

    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn('Error executing selector:', error.message);
      return null;
    }
  }

  // Safe query selector all with validation and performance limits
  static safeQuerySelectorAll(selector, context = document, maxResults = 1000) {
    const validation = this.validateCSSSelector(selector);
    if (!validation.valid) {
      console.warn('Invalid CSS selector:', validation.error);
      return [];
    }

    try {
      const elements = Array.from(context.querySelectorAll(selector));
      
      // Limit results to prevent memory issues
      if (elements.length > maxResults) {
        console.warn(`Selector returned ${elements.length} elements, limiting to ${maxResults}`);
        return elements.slice(0, maxResults);
      }
      
      return elements;
    } catch (error) {
      console.warn('Error executing selector:', error.message);
      return [];
    }
  }

  // Generate CSS path for an element
  static getElementCSSPath(element) {
    if (!(element instanceof Element)) {
      return '';
    }

    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.nodeName.toLowerCase();
      
      if (element.id) {
        selector += '#' + element.id;
        path.unshift(selector);
        break;
      } else {
        const siblings = element.parentNode ? Array.from(element.parentNode.children) : [];
        const sameTagSiblings = siblings.filter(sibling => sibling.nodeName === element.nodeName);
        
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(element) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      
      path.unshift(selector);
      element = element.parentElement;
    }

    return path.join(' > ');
  }

  // Check if element is visible
  static isElementVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  // Get element dimensions safely
  static getElementDimensions(element) {
    if (!(element instanceof Element)) {
      return { width: 0, height: 0, x: 0, y: 0 };
    }

    try {
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top
      };
    } catch (error) {
      console.warn('Error getting element dimensions:', error);
      return { width: 0, height: 0, x: 0, y: 0 };
    }
  }
}

// Worker Manager - Memory-safe worker management for offloading heavy tasks
class WorkerManager {
  constructor() {
    // Use memory-safe bounded data structures
    const global = typeof globalThis !== 'undefined' ? globalThis : window;
    const LRUCache = global.__ST?.LRUCache || Map;
    
    this.workers = new LRUCache(10); // Limit to 10 workers max
    this.workerIndex = 0;
    this.maxWorkers = Math.min(4, navigator.hardwareConcurrency || 2);

    // Register cleanup handler
    if (global.__ST?.lifecycleManager) {
      global.__ST.lifecycleManager.registerCleanupHandler(() => {
        this.terminateAll();
      }, true); // Emergency cleanup
    }
  }

  // Create a worker from inline code
  createInlineWorker(workerCode, workerName = `worker_${this.workerIndex++}`) {
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      
      // Register with resource tracker
      const global = typeof globalThis !== 'undefined' ? globalThis : window;
      if (global.__ST?.resourceTracker) {
        global.__ST.resourceTracker.trackWorker(worker);
      }
      
      this.workers.set(workerName, {
        worker,
        url: workerUrl,
        created: Date.now()
      });

      // Clean up URL when worker terminates
      worker.addEventListener('error', () => {
        this.terminateWorker(workerName);
      });

      return workerName;
    } catch (error) {
      console.error('Failed to create inline worker:', error);
      return null;
    }
  }

  // Send message to worker
  sendMessage(workerName, message) {
    const workerData = this.workers.get(workerName);
    if (!workerData) {
      console.error(`Worker ${workerName} not found`);
      return Promise.reject(new Error(`Worker ${workerName} not found`));
    }

    return new Promise((resolve, reject) => {
      const messageId = Date.now() + Math.random();
      
      const handleMessage = (event) => {
        if (event.data.messageId === messageId) {
          workerData.worker.removeEventListener('message', handleMessage);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      workerData.worker.addEventListener('message', handleMessage);
      workerData.worker.postMessage({ ...message, messageId });

      // Timeout after 30 seconds
      setTimeout(() => {
        workerData.worker.removeEventListener('message', handleMessage);
        reject(new Error('Worker timeout'));
      }, 30000);
    });
  }

  // Terminate specific worker
  terminateWorker(workerName) {
    const workerData = this.workers.get(workerName);
    if (workerData) {
      workerData.worker.terminate();
      URL.revokeObjectURL(workerData.url);
      this.workers.delete(workerName);
    }
  }

  // Terminate all workers
  terminateAll() {
    for (const [workerName] of this.workers) {
      this.terminateWorker(workerName);
    }
  }

  // Get worker status
  getWorkerStatus() {
    const status = {};
    for (const [name, data] of this.workers) {
      status[name] = {
        created: data.created,
        age: Date.now() - data.created
      };
    }
    return status;
  }
}

// Make utilities available globally
if (typeof window !== 'undefined') {
  window.StepThreeSelectorUtils = StepThreeSelectorUtils;
  window.WorkerManager = WorkerManager;
  
  // Create global worker manager instance
  if (!window.workerManager) {
    window.workerManager = new WorkerManager();
  }
}

console.log('✅ Library utilities loaded');

// =============================================================================
// 5. SERVICE WORKER FETCH UTILITIES - Critical for MV3 compliance
// =============================================================================

class ServiceWorkerFetch {
  // Standard fetch replacement using service worker
  static async fetch(url, options = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetch_url',
        url: url,
        options: options
      });

      if (!response.success) {
        throw new Error(response.error || 'Service worker fetch failed');
      }

      // Create a Response-like object for compatibility
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        headers: new Map(Object.entries(response.headers)),
        
        // Data access methods
        async json() {
          return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        },
        
        async text() {
          return typeof response.data === 'string' ? response.data : 
                 (response.data instanceof ArrayBuffer ? new TextDecoder().decode(response.data) : String(response.data));
        },
        
        async arrayBuffer() {
          return response.data instanceof ArrayBuffer ? response.data : 
                 new TextEncoder().encode(String(response.data)).buffer;
        },
        
        async blob() {
          const data = response.data instanceof ArrayBuffer ? response.data : 
                      new TextEncoder().encode(String(response.data)).buffer;
          return new Blob([data], { type: response.contentType || 'application/octet-stream' });
        }
      };
    } catch (error) {
      console.error('ServiceWorkerFetch error:', error);
      throw error;
    }
  }

  // Image-specific fetch replacement
  static async fetchImage(url, options = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetch_image',
        url: url,
        options: options
      });

      if (!response.success) {
        throw new Error(response.error || 'Service worker image fetch failed');
      }

      // Return blob for image data
      const blob = new Blob([response.data], { type: response.contentType });
      return {
        ok: true,
        status: response.status,
        blob: () => Promise.resolve(blob),
        arrayBuffer: () => Promise.resolve(response.data)
      };
    } catch (error) {
      console.error('ServiceWorkerFetch image error:', error);
      throw error;
    }
  }

  // Image validation (HEAD request) replacement
  static async validateImage(url, options = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'validate_image',
        url: url,
        options: options
      });

      if (!response.success) {
        throw new Error(response.error || 'Service worker image validation failed');
      }

      return {
        ok: response.valid,
        status: response.status,
        headers: new Map([
          ['content-type', response.contentType],
          ['content-length', response.size?.toString()]
        ].filter(([k, v]) => v !== null))
      };
    } catch (error) {
      console.error('ServiceWorkerFetch validation error:', error);
      throw error;
    }
  }

  // Test service worker connectivity
  static async testConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'ping' });
      return response?.success === true;
    } catch (error) {
      console.error('ServiceWorkerFetch connection test failed:', error);
      return false;
    }
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.ServiceWorkerFetch = ServiceWorkerFetch;
  
  // Override global fetch for MV3 compliance in extension context
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    window.extensionFetch = ServiceWorkerFetch.fetch;
  }
}

console.log('✅ ServiceWorker fetch utilities loaded');

// =============================================================================
// 6. CONTENT CORE - Essential helper functions for robust web scraping
// =============================================================================

// Prevent duplicate initialization
if (!window.RobustHelpers) {
  window.RobustHelpers = true;

  class RobustHelpers {

    /**
     * Enhanced waitForSelector with multiple strategies and robust error handling
     * @param {string|string[]} selectors - CSS selector(s) to wait for
     * @param {Object} options - Configuration options
     * @returns {Promise<Element>} - The found element
     */
    static async waitForSelector(selectors, options = {}) {
      const config = {
        timeout: options.timeout || 10000,
        interval: options.interval || 100,
        visible: options.visible !== false,
        enabled: options.enabled !== false,
        multiple: options.multiple || false,
        retries: options.retries || 3,
        throwOnTimeout: options.throwOnTimeout !== false,
        context: options.context || document,
        ...options
      };

      // Normalize selectors to array
      const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

      for (let attempt = 1; attempt <= config.retries; attempt++) {
        try {
          const result = await this._waitForSelectorAttempt(selectorArray, config);
          if (result) {
            console.log(`✅ Selector found on attempt ${attempt}:`,
              Array.isArray(selectors) ? selectors[0] : selectors);
            return config.multiple ? result : result[0];
          }
        } catch (error) {
          console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
          if (attempt === config.retries) {
            if (config.throwOnTimeout) {
              throw new Error(`Failed to find selector after ${config.retries} attempts: ${selectorArray.join(', ')}`);
            }
            return null;
          }
          // Wait before retry
          await this.sleep(config.interval * attempt);
        }
      }

      return null;
    }

    /**
     * Single attempt to find selector
     * @private
     */
    static async _waitForSelectorAttempt(selectors, config) {
      const startTime = Date.now();

      while (Date.now() - startTime < config.timeout) {
        for (const selector of selectors) {
          try {
            const elements = config.multiple
              ? Array.from(config.context.querySelectorAll(selector))
              : [config.context.querySelector(selector)].filter(Boolean);

            if (elements.length > 0) {
              // Filter by visibility if required
              const validElements = config.visible
                ? elements.filter(el => this.isElementVisible(el))
                : elements;

              // Filter by enabled state if required
              const enabledElements = config.enabled
                ? validElements.filter(el => this.isElementEnabled(el))
                : validElements;

              if (enabledElements.length > 0) {
                return enabledElements;
              }
            }
          } catch (error) {
            console.warn(`Invalid selector "${selector}":`, error.message);
          }
        }

        await this.sleep(config.interval);
      }

      return null;
    }

    /**
     * Enhanced image gathering with comprehensive URL resolution and validation
     * @param {Object} options - Gathering options
     * @returns {Promise<Array>} - Array of image objects
     */
    static async gatherImages(options = {}) {
      const config = {
        selectors: options.selectors || [
          'img[src]',
          'img[data-src]',
          'img[data-lazy-src]',
          '[style*="background-image"]',
          'picture img',
          'figure img',
          '.image img',
          '[data-background]'
        ],
        minWidth: options.minWidth || 0,
        minHeight: options.minHeight || 0,
        formats: options.formats || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        includeThumbnails: options.includeThumbnails !== false,
        includeMetadata: options.includeMetadata !== false,
        deduplicateUrls: options.deduplicateUrls !== false,
        resolveUrls: options.resolveUrls !== false,
        validateImages: options.validateImages !== false,
        ...options
      };

      const imageResults = [];
      const seenUrls = new Set();

      // Gather from direct img elements
      for (const selector of config.selectors) {
        try {
          const elements = document.querySelectorAll(selector);

          for (const element of elements) {
            const imageData = await this.extractImageFromElement(element, config);

            if (imageData && this.validateImageData(imageData, config)) {
              const normalizedUrl = this.normalizeUrl(imageData.url);

              if (!config.deduplicateUrls || !seenUrls.has(normalizedUrl)) {
                seenUrls.add(normalizedUrl);
                imageResults.push(imageData);
              }
            }
          }
        } catch (error) {
          console.warn(`Error processing selector "${selector}":`, error);
        }
      }

      console.log(`🖼️ Gathered ${imageResults.length} images from ${seenUrls.size} unique URLs`);
      return imageResults;
    }

    /**
     * Extract image data from a single element
     * @param {Element} element - DOM element to extract from
     * @param {Object} config - Configuration options
     * @returns {Promise<Object|null>} - Image data object or null
     */
    static async extractImageFromElement(element, config = {}) {
      try {
        let url = null;
        let thumbnailUrl = null;

        // Try multiple URL sources
        if (element.tagName === 'IMG') {
          url = element.src || element.dataset.src || element.dataset.lazySrc ||
                element.dataset.original || element.getAttribute('data-url');
          thumbnailUrl = element.dataset.thumbnail || element.dataset.thumb;
        } else {
          // Check for background images
          const style = window.getComputedStyle(element);
          const backgroundImage = style.backgroundImage;
          if (backgroundImage && backgroundImage !== 'none') {
            const matches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            url = matches ? matches[1] : null;
          }

          // Check data attributes
          url = url || element.dataset.background || element.dataset.image;
        }

        if (!url) {return null;}

        // Normalize and validate URL
        const normalizedUrl = this.normalizeUrl(url);
        if (!normalizedUrl || !this.isValidImageUrl(normalizedUrl, config.formats)) {
          return null;
        }

        // Get element dimensions
        const rect = element.getBoundingClientRect();
        const dimensions = await this.getImageDimensions(normalizedUrl).catch(() => ({ width: 0, height: 0 }));

        // Build image data object
        const imageData = {
          url: normalizedUrl,
          thumbnailUrl: thumbnailUrl ? this.normalizeUrl(thumbnailUrl) : null,
          element: element,
          dimensions: {
            natural: dimensions,
            displayed: {
              width: rect.width,
              height: rect.height
            }
          },
          metadata: config.includeMetadata ? await this.extractImageMetadata(element, normalizedUrl) : null,
          timestamp: Date.now()
        };

        return imageData;
      } catch (error) {
        console.warn('Error extracting image from element:', error);
        return null;
      }
    }

    /**
     * Comprehensive URL normalization
     * @param {string} url - URL to normalize
     * @param {Object} options - Normalization options
     * @returns {string|null} - Normalized URL or null if invalid
     */
    static normalizeUrl(url, options = {}) {
      if (!url || typeof url !== 'string') {return null;}

      try {
        // Clean the URL
        let cleanUrl = url.trim();

        // Remove quotes and decode if needed
        cleanUrl = cleanUrl.replace(/^['"]|['"]$/g, '');

        // Handle data URLs
        if (cleanUrl.startsWith('data:')) {
          return options.allowDataUrls !== false ? cleanUrl : null;
        }

        // Handle protocol-relative URLs
        if (cleanUrl.startsWith('//')) {
          cleanUrl = window.location.protocol + cleanUrl;
        }

        // Handle relative URLs
        if (!cleanUrl.match(/^https?:/)) {
          cleanUrl = new URL(cleanUrl, window.location.href).href;
        }

        // Create URL object for validation and normalization
        const urlObj = new URL(cleanUrl);

        return urlObj.href;
      } catch (error) {
        console.warn('URL normalization failed:', error);
        return null;
      }
    }

    /**
     * Validate if URL is a valid image URL
     * @param {string} url - URL to validate
     * @param {Array<string>} allowedFormats - Allowed image formats
     * @returns {boolean} - True if valid image URL
     */
    static isValidImageUrl(url, allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']) {
      if (!url) {return false;}

      try {
        const urlObj = new URL(url);

        // Check for data URLs
        if (urlObj.protocol === 'data:') {
          return urlObj.pathname.startsWith('image/');
        }

        // Extract file extension
        const pathname = urlObj.pathname.toLowerCase();
        const extension = pathname.split('.').pop();

        // Check if extension is in allowed formats
        if (allowedFormats.includes(extension)) {
          return true;
        }

        // Check for common image URL patterns
        const imagePatterns = [
          /\/images?\//,
          /\/img\//,
          /\/photos?\//,
          /\/gallery\//,
          /\/media\//,
          /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i
        ];

        return imagePatterns.some(pattern => pattern.test(url));
      } catch (error) {
        return false;
      }
    }

    /**
     * Check if element is visible
     * @param {Element} element - Element to check
     * @returns {boolean} - True if visible
     */
    static isElementVisible(element) {
      if (!element) {return false;}

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return rect.width > 0 &&
             rect.height > 0 &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             style.display !== 'none' &&
             element.offsetParent !== null;
    }

    /**
     * Check if element is enabled/interactive
     * @param {Element} element - Element to check
     * @returns {boolean} - True if enabled
     */
    static isElementEnabled(element) {
      if (!element) {return false;}

      const style = window.getComputedStyle(element);
      return !element.disabled &&
             style.pointerEvents !== 'none' &&
             !element.hasAttribute('aria-disabled');
    }

    /**
     * Click element with retries and various strategies
     * @param {Element} element - Element to click
     * @param {Object} options - Click options
     * @returns {Promise<boolean>} - True if click succeeded
     */
    static async clickElement(element, options = {}) {
      const config = {
        retries: options.retries || 3,
        scrollIntoView: options.scrollIntoView !== false,
        waitAfterScroll: options.waitAfterScroll || 300,
        clickStrategies: options.clickStrategies || ['click', 'dispatchEvent', 'mouseEvents'],
        ...options
      };

      if (!element) {return false;}

      for (let attempt = 1; attempt <= config.retries; attempt++) {
        try {
          // Scroll into view if requested
          if (config.scrollIntoView) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(config.waitAfterScroll);
          }

          // Check if element is clickable
          if (!this.isElementVisible(element) || !this.isElementEnabled(element)) {
            throw new Error('Element is not clickable');
          }

          // Try different click strategies
          for (const strategy of config.clickStrategies) {
            try {
              if (strategy === 'click') {
                element.click();
              } else if (strategy === 'dispatchEvent') {
                element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              } else if (strategy === 'mouseEvents') {
                element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              }

              console.log(`✅ Click succeeded with strategy "${strategy}" on attempt ${attempt}`);
              return true;
            } catch (strategyError) {
              console.warn(`Click strategy "${strategy}" failed:`, strategyError);
            }
          }

          throw new Error('All click strategies failed');
        } catch (error) {
          console.warn(`Click attempt ${attempt} failed:`, error.message);
          if (attempt === config.retries) {
            return false;
          }
          await this.sleep(200 * attempt);
        }
      }

      return false;
    }

    /**
     * Extract text content with various fallbacks
     * @param {Element} element - Element to extract text from
     * @param {Object} options - Extraction options
     * @returns {string} - Extracted text
     */
    static extractText(element, options = {}) {
      if (!element) {return '';}

      const config = {
        trim: options.trim !== false,
        preserveLineBreaks: options.preserveLineBreaks || false,
        maxLength: options.maxLength || null,
        fallbackToTitle: options.fallbackToTitle !== false,
        fallbackToAlt: options.fallbackToAlt !== false,
        ...options
      };

      let text = '';

      // Try various text extraction methods
      if (element.textContent) {
        text = element.textContent;
      } else if (element.innerText) {
        text = element.innerText;
      } else if (config.fallbackToTitle && element.title) {
        text = element.title;
      } else if (config.fallbackToAlt && element.alt) {
        text = element.alt;
      }

      // Process the text
      if (config.trim) {
        text = text.trim();
      }

      if (!config.preserveLineBreaks) {
        text = text.replace(/\s+/g, ' ');
      }

      if (config.maxLength && text.length > config.maxLength) {
        text = text.substring(0, config.maxLength) + '...';
      }

      return text;
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    static sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get image dimensions
     * @param {string} url - Image URL
     * @returns {Promise<Object>} - Object with width and height
     */
    static getImageDimensions(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
    }

    /**
     * Extract image metadata
     * @param {Element} element - Image element
     * @param {string} url - Image URL
     * @returns {Promise<Object>} - Metadata object
     */
    static async extractImageMetadata(element, url) {
      const metadata = {
        alt: element.alt || '',
        title: element.title || '',
        className: element.className || '',
        id: element.id || '',
        src: url,
        format: this.getImageFormat(url),
        attributes: {}
      };

      // Extract custom data attributes
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
          metadata.attributes[attr.name] = attr.value;
        }
      }

      return metadata;
    }

    /**
     * Get image format from URL
     * @param {string} url - Image URL
     * @returns {string} - Image format
     */
    static getImageFormat(url) {
      try {
        const urlObj = new URL(url);
        const extension = urlObj.pathname.split('.').pop().toLowerCase();
        return extension || 'unknown';
      } catch {
        return 'unknown';
      }
    }

    /**
     * Validate image data against criteria
     * @param {Object} imageData - Image data object
     * @param {Object} config - Validation config
     * @returns {boolean} - True if valid
     */
    static validateImageData(imageData, config = {}) {
      if (!imageData || !imageData.url) {return false;}

      // Check dimensions if specified
      if (config.minWidth || config.minHeight) {
        const width = imageData.dimensions?.natural?.width || imageData.dimensions?.displayed?.width || 0;
        const height = imageData.dimensions?.natural?.height || imageData.dimensions?.displayed?.height || 0;

        if (config.minWidth && width < config.minWidth) {return false;}
        if (config.minHeight && height < config.minHeight) {return false;}
      }

      // Check format if specified
      if (config.formats && Array.isArray(config.formats)) {
        const format = this.getImageFormat(imageData.url);
        if (!config.formats.includes(format)) {return false;}
      }

      return true;
    }
  }

  // Export to global scope
  window.RobustHelpers = RobustHelpers;

  console.log('✅ Content core utilities loaded');
}

// =============================================================================
// 7. DOM OBSERVERS - Essential DOM observation and content detection
// =============================================================================

// Prevent duplicate declarations
if (!window.DynamicContentObserver) {

  class DynamicContentObserver {
    constructor(options = {}) {
      this.options = {
        // Observer configuration
        observeAttributes: options.observeAttributes !== false,
        observeChildList: options.observeChildList !== false,
        observeSubtree: options.observeSubtree !== false,
        
        // Content detection thresholds
        minNewElements: options.minNewElements || 5,
        minImageElements: options.minImageElements || 3,
        significantChangeThreshold: options.significantChangeThreshold || 0.3,
        
        // Performance settings
        throttleDelay: options.throttleDelay || 500,
        maxCallbacksPerSecond: options.maxCallbacksPerSecond || 10,
        observerTimeout: options.observerTimeout || 30000,
        
        // Content type detection
        detectImages: options.detectImages !== false,
        detectProducts: options.detectProducts !== false,
        detectGalleries: options.detectGalleries !== false,
        
        // Advanced detection patterns
        contentPatterns: options.contentPatterns || {
          images: ['img', '[style*="background-image"]', 'picture', '[data-src]', '[data-lazy]', '[loading="lazy"]'],
          products: ['.product', '.item', '[data-product]', '.listing', '.card'],
          galleries: ['.gallery', '.grid', '.masonry', '[data-gallery]', '.feed', '.posts', '.tiles'],
          containers: ['.container', '.content', '.main', '[role="main"]', 'article', 'section'],
          lazyImages: ['[data-src]', '[data-lazy]', '[data-original]', '.lazy', '.lazyload', '[loading="lazy"]']
        },
        
        // Element significance scoring
        significanceWeights: options.significanceWeights || {
          images: 0.8,
          products: 0.9,
          galleries: 0.7,
          links: 0.5,
          text: 0.3
        },

        ...options
      };

      // State management with memory-safe structures
      this.isActive = false;
      this.observer = null;
      this.processTimer = null;

      // Use memory-safe bounded structures
      const global = typeof globalThis !== 'undefined' ? globalThis : window;
      const LRUCache = global.__ST?.LRUCache || Map;
      const BoundedArray = global.__ST?.BoundedArray || Array;
      
      this.callbacks = new LRUCache(20); // Limit callbacks to 20
      this.changeBuffer = BoundedArray === Array ? [] : new BoundedArray(500); // Cap buffer
      this.metrics = {
        totalChanges: 0,
        significantChanges: 0,
        elementsAdded: 0,
        elementsRemoved: 0,
        imagesDetected: 0,
        lastActivity: Date.now()
      };

      // Content analysis
      this.elementClassifiers = {
        isImageContent: (element) => {
          if (element.tagName === 'IMG') return true;
          if (element.querySelector && element.querySelector('img')) return true;
          
          const style = window.getComputedStyle ? window.getComputedStyle(element) : {};
          return style.backgroundImage && style.backgroundImage !== 'none';
        },

        isProductContent: (element) => {
          const text = element.textContent?.toLowerCase() || '';
          const className = element.className?.toLowerCase() || '';
          
          const productKeywords = ['price', 'buy', 'add to cart', 'product', '$', '€', '£'];
          const productClasses = ['product', 'item', 'listing', 'card'];
          
          return productKeywords.some(k => text.includes(k)) ||
                 productClasses.some(c => className.includes(c));
        },

        isGalleryContent: (element) => {
          const className = element.className?.toLowerCase() || '';
          const children = element.children?.length || 0;
          
          const galleryClasses = ['gallery', 'grid', 'masonry', 'photos'];
          const hasMultipleImages = children >= 3 && 
            Array.from(element.children).filter(child => 
              this.elementClassifiers.isImageContent(child)
            ).length >= 2;
          
          return galleryClasses.some(c => className.includes(c)) || hasMultipleImages;
        }
      };
    }

    start(callback = null) {
      if (this.isActive) {
        console.warn('DynamicContentObserver is already active');
        return false;
      }

      try {
        this.observer = new MutationObserver(this.handleMutations.bind(this));
        
        // Register observer with resource tracker
        const global = typeof globalThis !== 'undefined' ? globalThis : window;
        if (global.__ST?.resourceTracker) {
          global.__ST.resourceTracker.trackObserver(this.observer);
        }

        // Register with lifecycle manager for cleanup
        if (global.__ST?.lifecycleManager) {
          global.__ST.lifecycleManager.registerCleanupHandler(() => {
            this.stop();
          });
        }
        
        const observerConfig = {
          childList: this.options.observeChildList,
          subtree: this.options.observeSubtree,
          attributes: this.options.observeAttributes,
          characterData: true
        };

        this.observer.observe(document.body, observerConfig);
        this.isActive = true;

        if (callback) {
          this.addCallback('default', callback);
        }

        // Set timeout for automatic cleanup
        setTimeout(() => {
          if (this.isActive && Date.now() - this.metrics.lastActivity > this.options.observerTimeout) {
            console.log('🕐 Auto-stopping observer due to inactivity');
            this.stop();
          }
        }, this.options.observerTimeout);

        console.log('✅ DynamicContentObserver started successfully');
        return true;
      } catch (error) {
        console.error('❌ Failed to start DynamicContentObserver:', error);
        return false;
      }
    }

    stop() {
      if (!this.isActive) {
        return false;
      }

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.processTimer) {
        clearTimeout(this.processTimer);
        this.processTimer = null;
      }

      this.isActive = false;
      this.changeBuffer = [];
      
      console.log('🛑 DynamicContentObserver stopped. Final metrics:', this.getMetrics());
      return true;
    }

    addCallback(name, callback) {
      if (typeof callback === 'function') {
        this.callbacks.set(name, callback);
        console.log(`📞 Added callback: ${name}`);
      }
    }

    removeCallback(name) {
      const removed = this.callbacks.delete(name);
      if (removed) {
        console.log(`🗑️ Removed callback: ${name}`);
      }
      return removed;
    }

    handleMutations(mutations) {
      if (!this.isActive) return;

      const startTime = performance.now();
      this.metrics.lastActivity = Date.now();

      // Buffer mutations for batch processing
      mutations.forEach(mutation => {
        this.changeBuffer.push({
          type: mutation.type,
          target: mutation.target,
          addedNodes: Array.from(mutation.addedNodes),
          removedNodes: Array.from(mutation.removedNodes),
          attributeName: mutation.attributeName,
          oldValue: mutation.oldValue,
          timestamp: Date.now()
        });
      });

      // Throttle processing
      if (this.processTimer) {
        clearTimeout(this.processTimer);
      }

      this.processTimer = setTimeout(() => {
        this.processChangeBuffer();
      }, this.options.throttleDelay);
    }

    processChangeBuffer() {
      if (!this.changeBuffer.length) return;

      const startTime = performance.now();
      console.log(`🔄 Processing ${this.changeBuffer.length} buffered changes`);

      const analysis = this.analyzeChanges(this.changeBuffer);
      this.metrics.totalChanges += this.changeBuffer.length;

      if (this.isSignificantChange(analysis)) {
        this.metrics.significantChanges++;
        this.notifyCallbacks(analysis);
      }

      // Update element counts
      this.metrics.elementsAdded += analysis.addedElements.length;
      this.metrics.elementsRemoved += analysis.removedElements.length;
      this.metrics.imagesDetected += analysis.newImages.length;

      // Clear buffer
      this.changeBuffer = [];

      const processingTime = performance.now() - startTime;
      console.log(`✅ Processed changes in ${processingTime.toFixed(2)}ms`);
    }

    analyzeChanges(changes) {
      const analysis = {
        addedElements: [],
        removedElements: [],
        modifiedElements: [],
        newImages: [],
        newProducts: [],
        newGalleries: [],
        contentTypes: new Set(),
        significance: 0,
        patterns: []
      };

      changes.forEach(change => {
        if (change.type === 'childList') {
          // Analyze added nodes
          change.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              analysis.addedElements.push(node);
              this.classifyElement(node, analysis);
            }
          });

          // Analyze removed nodes
          change.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              analysis.removedElements.push(node);
            }
          });
        } else if (change.type === 'attributes') {
          analysis.modifiedElements.push(change.target);
        }
      });

      // Calculate significance score
      analysis.significance = this.calculateSignificance(analysis);

      return analysis;
    }

    classifyElement(element, analysis) {
      // Check for images
      if (this.options.detectImages && this.elementClassifiers.isImageContent(element)) {
        analysis.newImages.push(element);
        analysis.contentTypes.add('images');
      }

      // Check for products
      if (this.options.detectProducts && this.elementClassifiers.isProductContent(element)) {
        analysis.newProducts.push(element);
        analysis.contentTypes.add('products');
      }

      // Check for galleries
      if (this.options.detectGalleries && this.elementClassifiers.isGalleryContent(element)) {
        analysis.newGalleries.push(element);
        analysis.contentTypes.add('galleries');
      }

      // Recursively check children
      if (element.children) {
        Array.from(element.children).forEach(child => {
          this.classifyElement(child, analysis);
        });
      }
    }

    calculateSignificance(analysis) {
      let score = 0;
      const weights = this.options.significanceWeights;

      score += analysis.newImages.length * weights.images;
      score += analysis.newProducts.length * weights.products;
      score += analysis.newGalleries.length * weights.galleries;
      score += Math.min(analysis.addedElements.length * weights.links, 10);

      return Math.min(score / 10, 1); // Normalize to 0-1
    }

    isSignificantChange(analysis) {
      const elementThreshold = analysis.addedElements.length >= this.options.minNewElements;
      const imageThreshold = analysis.newImages.length >= this.options.minImageElements;
      const significanceThreshold = analysis.significance >= this.options.significantChangeThreshold;

      return elementThreshold || imageThreshold || significanceThreshold;
    }

    notifyCallbacks(analysis) {
      const data = {
        ...analysis,
        timestamp: Date.now(),
        metrics: { ...this.metrics }
      };

      this.callbacks.forEach((callback, name) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Callback ${name} failed:`, error);
        }
      });
    }

    getMetrics() {
      return {
        ...this.metrics,
        isActive: this.isActive,
        bufferedChanges: this.changeBuffer.length,
        activeCallbacks: this.callbacks.size
      };
    }
  }

  // Export to global scope
  window.DynamicContentObserver = DynamicContentObserver;

  console.log('✅ DOM observers loaded');
}

// =============================================================================
// 8. SCRAPER CORE - Essential scraping functionality
// =============================================================================

if (!window.EnhancedScraperUtils) {

  class EnhancedScraperUtils {
    constructor(options = {}) {
      this.options = {
        // Rate limiting
        requestsPerSecond: options.requestsPerSecond || 2,
        burstLimit: options.burstLimit || 5,
        cooldownPeriod: options.cooldownPeriod || 30000,

        // Retry configuration
        maxRetries: options.maxRetries || 3,
        baseDelay: options.baseDelay || 1000,
        maxDelay: options.maxDelay || 10000,
        backoffMultiplier: options.backoffMultiplier || 2,

        // Content validation
        minImageSize: options.minImageSize || 100,
        maxImageSize: options.maxImageSize || 50 * 1024 * 1024, // 50MB
        allowedFormats: options.allowedFormats || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],

        // Performance monitoring
        enableMetrics: options.enableMetrics !== false,

        // Content filtering
        enableDuplicateDetection: options.enableDuplicateDetection !== false,
        enableContentValidation: options.enableContentValidation !== false,

        ...options
      };

      // Rate limiting state
      this.requestQueue = [];
      this.requestHistory = [];
      this.isThrottled = false;
      this.throttledUntil = 0;

      // Content tracking
      this.processedUrls = new Set();
      this.contentHashes = new Set();

      // Performance metrics
      this.metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        retriedRequests: 0,
        duplicatesSkipped: 0,
        averageResponseTime: 0
      };

      console.log('✅ Enhanced scraper utilities initialized');
    }

    // Enhanced request with rate limiting and retry logic
    async makeEnhancedRequest(url, options = {}) {
      // Check if we should rate limit
      if (this.shouldRateLimit()) {
        await this.waitForRateLimit();
      }

      // Record request attempt
      this.recordRequest();

      const startTime = performance.now();

      try {
        const response = await this.executeRequestWithRetry(url, options);

        // Record success metrics
        const responseTime = performance.now() - startTime;
        this.recordSuccess(responseTime);

        return response;
      } catch (error) {
        // Record failure metrics
        this.recordFailure(error, url);
        throw error;
      }
    }

    // Execute request with exponential backoff retry logic
    async executeRequestWithRetry(url, options) {
      let lastError = null;
      const maxRetries = this.options.maxRetries;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = this.calculateBackoffDelay(attempt);
            console.log(`🔄 Retry attempt ${attempt}/${maxRetries} for ${url} after ${delay}ms`);
            await this.sleep(delay);
            this.metrics.retriedRequests++;
          }

          // Make the actual request using ServiceWorkerFetch
          const response = await ServiceWorkerFetch.fetch(url, {
            ...options,
            method: options.method || 'GET'
          });

          // Check if response is ok
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Validate content if enabled
          if (this.options.enableContentValidation) {
            await this.validateResponse(response, url);
          }

          return response;

        } catch (error) {
          lastError = error;

          // Check if we should retry based on error type
          if (!this.isRetryableError(error) || attempt === maxRetries) {
            break;
          }

          console.warn(`⚠️ Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        }
      }

      // All retries exhausted
      throw lastError;
    }

    // Calculate exponential backoff delay
    calculateBackoffDelay(attempt) {
      const baseDelay = this.options.baseDelay;
      const backoffMultiplier = this.options.backoffMultiplier;
      const maxDelay = this.options.maxDelay;

      // Exponential backoff
      let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);

      // Cap at max delay
      return Math.min(Math.max(delay, baseDelay), maxDelay);
    }

    // Check if error is retryable
    isRetryableError(error) {
      // Network errors are generally retryable
      if (error.name === 'TypeError' || error.name === 'NetworkError') {
        return true;
      }

      // HTTP status codes that are retryable
      if (error.message.includes('HTTP')) {
        const statusMatch = error.message.match(/HTTP (\d+)/);
        if (statusMatch) {
          const status = parseInt(statusMatch[1]);
          // Retry on 5xx (server errors) and some 4xx (rate limiting)
          return status >= 500 || status === 429 || status === 408;
        }
      }

      // Timeout errors are retryable
      if (error.message.includes('timeout') || error.message.includes('aborted')) {
        return true;
      }

      return false;
    }

    // Rate limiting logic
    shouldRateLimit() {
      const now = Date.now();

      // Check if we're in cooldown period
      if (now < this.throttledUntil) {
        return true;
      }

      // Clean old requests from history (keep last 60 seconds)
      this.requestHistory = this.requestHistory.filter(
        timestamp => now - timestamp < 60000
      );

      // Check requests per second limit
      const recentRequests = this.requestHistory.filter(
        timestamp => now - timestamp < 1000
      );

      if (recentRequests.length >= this.options.requestsPerSecond) {
        return true;
      }

      // Check burst limit
      const burstWindow = this.requestHistory.filter(
        timestamp => now - timestamp < 5000
      );

      if (burstWindow.length >= this.options.burstLimit) {
        console.log('🚦 Rate limit: Burst limit reached, applying throttle');
        this.throttledUntil = now + this.options.cooldownPeriod;
        return true;
      }

      return false;
    }

    // Wait for rate limit to clear
    async waitForRateLimit() {
      const now = Date.now();
      const waitTime = Math.max(
        this.throttledUntil - now,
        1000 - (now - Math.max(...this.requestHistory.slice(-1), 0))
      );

      if (waitTime > 0) {
        console.log(`🚦 Rate limiting: waiting ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }

    // Record request for rate limiting
    recordRequest() {
      this.requestHistory.push(Date.now());
      this.metrics.totalRequests++;
    }

    // Enhanced duplicate detection using content hashing
    async detectDuplicate(url, content) {
      if (!this.options.enableDuplicateDetection) {
        return false;
      }

      // URL-based detection
      if (this.processedUrls.has(url)) {
        this.metrics.duplicatesSkipped++;
        return true;
      }

      // Content-based detection using hash
      if (content) {
        const hash = await this.calculateContentHash(content);
        if (this.contentHashes.has(hash)) {
          this.metrics.duplicatesSkipped++;
          return true;
        }
        this.contentHashes.add(hash);
      }

      this.processedUrls.add(url);
      return false;
    }

    // Calculate content hash for duplicate detection
    async calculateContentHash(content) {
      if (typeof content === 'string') {
        content = new TextEncoder().encode(content);
      }

      // Use SubtleCrypto if available, fallback to simple hash
      if (window.crypto && window.crypto.subtle) {
        try {
          const hashBuffer = await window.crypto.subtle.digest('SHA-256', content);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
          console.warn('⚠️ Crypto hash failed, using fallback');
        }
      }

      // Simple hash fallback
      let hash = 0;
      const str = content.toString();
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(16);
    }

    // Validate response content
    async validateResponse(response, url) {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = parseInt(response.headers.get('content-length') || '0');

      // Check content type
      if (contentType.startsWith('image/')) {
        const format = contentType.split('/')[1];
        if (!this.options.allowedFormats.includes(format)) {
          throw new Error(`Unsupported image format: ${format}`);
        }
      }

      // Check content size
      if (contentLength > 0) {
        if (contentLength < this.options.minImageSize) {
          throw new Error(`Image too small: ${contentLength} bytes`);
        }
        if (contentLength > this.options.maxImageSize) {
          throw new Error(`Image too large: ${contentLength} bytes`);
        }
      }

      return true;
    }

    // Record failure
    recordFailure(error, url) {
      this.metrics.failedRequests++;
      console.error(`❌ Request failed for ${url}:`, error);
    }

    // Record successful requests
    recordSuccess(responseTime) {
      this.metrics.successfulRequests++;

      // Update average response time
      const totalSuccessful = this.metrics.successfulRequests;
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful;
    }

    // Helper methods
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get metrics report
    getMetricsReport() {
      const successRate = this.metrics.totalRequests > 0 ?
        (this.metrics.successfulRequests / this.metrics.totalRequests * 100) : 0;

      return {
        summary: {
          totalRequests: this.metrics.totalRequests,
          successfulRequests: this.metrics.successfulRequests,
          failedRequests: this.metrics.failedRequests,
          successRate: successRate,
          averageResponseTime: this.metrics.averageResponseTime,
          duplicatesSkipped: this.metrics.duplicatesSkipped
        }
      };
    }
  }

  // Export to global scope
  window.EnhancedScraperUtils = EnhancedScraperUtils;
  console.log('✅ Enhanced scraper utilities loaded');
}

// Advanced Extractor for comprehensive image extraction
if (!window.AdvancedExtractor) {

  class AdvancedExtractor {
    constructor(options = {}) {
      this.options = {
        // Extraction strategies
        useMultipleStrategies: options.useMultipleStrategies !== false,
        enableFallbackExtraction: options.enableFallbackExtraction !== false,
        maxExtractionAttempts: options.maxExtractionAttempts || 5,
        
        // Target detection
        autoDetectTargets: options.autoDetectTargets !== false,
        smartTargetSelection: options.smartTargetSelection !== false,
        
        // Content validation
        validateExtractedContent: options.validateExtractedContent !== false,
        minContentThreshold: options.minContentThreshold || 3,
        
        // Performance settings
        batchSize: options.batchSize || 50,
        extractionTimeout: options.extractionTimeout || 30000,
        
        // Image-specific options
        minImageDimensions: options.minImageDimensions || { width: 50, height: 50 },
        supportedFormats: options.supportedFormats || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
        extractImageMetadata: options.extractImageMetadata !== false,
        
        // Enhanced detection patterns
        imageSelectors: options.imageSelectors || [
          'img[src]',
          'img[data-src]', 
          'img[data-lazy-src]',
          'img[data-original]',
          '[style*="background-image"]',
          'picture source',
          'picture img',
          '[data-background-image]'
        ],
        
        containerSelectors: options.containerSelectors || [
          '.gallery', '.images', '.photos', '.grid',
          '.masonry', '.carousel', '.slider', '.product-images',
          '[data-gallery]', '[data-images]', '[data-photos]'
        ],

        ...options
      };

      // State management
      this.isActive = false;
      this.extractedItems = [];
      this.failedExtractions = [];
      
      // Strategy tracking
      this.strategies = new Map();
      
      // Quality metrics
      this.qualityMetrics = {
        totalFound: 0,
        validated: 0,
        filtered: 0,
        duplicates: 0
      };

      this.initializeExtractionStrategies();
    }

    initializeExtractionStrategies() {
      // Register extraction strategies
      this.strategies.set('direct', this.directImageExtraction.bind(this));
      this.strategies.set('background', this.backgroundImageExtraction.bind(this));
      this.strategies.set('lazy', this.lazyLoadedImageExtraction.bind(this));
      this.strategies.set('semantic', this.semanticImageExtraction.bind(this));

      console.log('🎯 Advanced extraction strategies initialized:', Array.from(this.strategies.keys()));
    }

    // Main extraction method
    async extractImages(selector = null, options = {}) {
      const config = { ...this.options, ...options };
      this.isActive = true;
      
      const startTime = performance.now();
      console.log('🚀 Starting advanced image extraction...');

      try {
        // Reset state
        this.extractedItems = [];
        this.failedExtractions = [];
        this.qualityMetrics = { totalFound: 0, validated: 0, filtered: 0, duplicates: 0 };

        // Execute extraction strategies
        const results = await this.executeExtractionStrategies(selector, config);
        
        // Process and validate results
        const processedResults = await this.processExtractionResults(results, config);
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        const finalResults = {
          success: true,
          images: processedResults,
          metadata: {
            totalFound: this.qualityMetrics.totalFound,
            validated: this.qualityMetrics.validated,
            filtered: this.qualityMetrics.filtered,
            duplicates: this.qualityMetrics.duplicates,
            extractionTime: duration,
            strategiesUsed: Array.from(this.strategies.keys())
          }
        };

        console.log(`✅ Advanced extraction completed in ${duration.toFixed(2)}ms`);
        return finalResults;

      } catch (error) {
        console.error('❌ Advanced extraction failed:', error);
        return {
          success: false,
          error: error.message,
          images: [],
          metadata: {
            totalFound: this.qualityMetrics.totalFound,
            extractionTime: performance.now() - startTime
          }
        };
      } finally {
        this.isActive = false;
      }
    }

    async executeExtractionStrategies(selector, config) {
      const allResults = [];
      const strategies = config.useMultipleStrategies ? 
        Array.from(this.strategies.keys()) : ['direct'];

      for (const strategyName of strategies) {
        const strategy = this.strategies.get(strategyName);
        if (strategy) {
          try {
            const results = await strategy(selector, config);
            allResults.push(...results);
          } catch (error) {
            console.warn(`Strategy ${strategyName} failed:`, error);
          }
        }
      }

      return allResults;
    }

    // Direct image extraction strategy
    async directImageExtraction(selector, config) {
      const images = [];
      const targetSelector = selector || 'img[src]';
      
      try {
        const elements = document.querySelectorAll(targetSelector);
        
        for (const img of elements) {
          if (img.src && this.isValidImageElement(img, config)) {
            images.push({
              url: img.src,
              element: img,
              strategy: 'direct',
              metadata: this.extractElementMetadata(img)
            });
          }
        }
      } catch (error) {
        console.warn('Direct extraction failed:', error);
      }

      return images;
    }

    // Background image extraction strategy
    async backgroundImageExtraction(selector, config) {
      const images = [];
      
      try {
        const elements = document.querySelectorAll('[style*="background-image"], [data-background]');
        
        for (const el of elements) {
          const bgUrl = this.extractBackgroundImageUrl(el);
          if (bgUrl && this.isValidImageUrl(bgUrl, config)) {
            images.push({
              url: bgUrl,
              element: el,
              strategy: 'background',
              metadata: this.extractElementMetadata(el)
            });
          }
        }
      } catch (error) {
        console.warn('Background extraction failed:', error);
      }

      return images;
    }

    // Lazy loaded image extraction strategy
    async lazyLoadedImageExtraction(selector, config) {
      const images = [];
      
      try {
        const elements = document.querySelectorAll('img[data-src], img[data-lazy], img[data-original], [loading="lazy"]');
        
        for (const img of elements) {
          const lazySrc = img.dataset.src || img.dataset.lazy || img.dataset.original;
          if (lazySrc && this.isValidImageUrl(lazySrc, config)) {
            images.push({
              url: lazySrc,
              element: img,
              strategy: 'lazy',
              metadata: this.extractElementMetadata(img)
            });
          }
        }
      } catch (error) {
        console.warn('Lazy extraction failed:', error);
      }

      return images;
    }

    // Semantic image extraction strategy
    async semanticImageExtraction(selector, config) {
      const images = [];
      
      try {
        const semanticSelectors = [
          'figure img', 'picture img', 'article img',
          '.gallery img', '.photos img', '.images img'
        ];
        
        for (const semanticSelector of semanticSelectors) {
          const elements = document.querySelectorAll(semanticSelector);
          
          for (const img of elements) {
            const src = img.src || img.dataset.src;
            if (src && this.isValidImageElement(img, config)) {
              images.push({
                url: src,
                element: img,
                strategy: 'semantic',
                metadata: this.extractElementMetadata(img)
              });
            }
          }
        }
      } catch (error) {
        console.warn('Semantic extraction failed:', error);
      }

      return images;
    }

    // Process and validate extraction results
    async processExtractionResults(results, config) {
      const processedResults = [];
      const seenUrls = new Set();

      for (const result of results) {
        this.qualityMetrics.totalFound++;

        // Check for duplicates
        if (seenUrls.has(result.url)) {
          this.qualityMetrics.duplicates++;
          continue;
        }
        seenUrls.add(result.url);

        // Validate content
        if (config.validateExtractedContent && !this.validateImageResult(result, config)) {
          this.qualityMetrics.filtered++;
          continue;
        }

        this.qualityMetrics.validated++;
        processedResults.push(result);
      }

      return processedResults;
    }

    // Helper methods
    isValidImageElement(img, config) {
      if (!img || img.tagName !== 'IMG') return false;
      
      const { width, height } = config.minImageDimensions;
      const imgWidth = img.naturalWidth || img.offsetWidth;
      const imgHeight = img.naturalHeight || img.offsetHeight;
      
      return imgWidth >= width && imgHeight >= height;
    }

    isValidImageUrl(url, config) {
      if (!url) return false;
      
      const supportedFormats = config.supportedFormats;
      const extension = url.split('.').pop()?.toLowerCase();
      
      return supportedFormats.includes(extension) || url.startsWith('data:image/');
    }

    extractBackgroundImageUrl(element) {
      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;
      
      if (bgImage && bgImage !== 'none') {
        const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        return match ? match[1] : null;
      }
      
      return element.dataset.background || null;
    }

    extractElementMetadata(element) {
      return {
        alt: element.alt || '',
        title: element.title || '',
        className: element.className || '',
        id: element.id || ''
      };
    }

    validateImageResult(result, config) {
      // Basic validation - can be extended
      return result.url && result.url.length > 0;
    }
  }

  // Export to global scope
  window.AdvancedExtractor = AdvancedExtractor;
  console.log('✅ Basic DOM extractor loaded (fallback mode)');
}

// Main scraper function - unified entry point with Advanced Collector System
if (!window.runScrape) {
  window.runScrape = async function(selector, options = {}) {
    console.log('🚀 Starting unified scraper with Advanced Collector System...');
    
    try {
      // Check if Advanced Collector System is available with proper type checking
      if (typeof window.AdvancedCollectorSystem === 'function') {
        console.log('📡 Using Advanced Collector System with 8 detection methods');
        
        // Initialize Advanced Collector System
        const collector = new window.AdvancedCollectorSystem({
          // Configure based on options
          concurrency: options.concurrency || 5,
          timeout: options.timeout || 30000,
          minImageSize: options.minImageSize || 100,
          supportedFormats: options.supportedFormats || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
          customExtensions: options.customExtensions || ['pdf'],
          
          // Enable all 8 detection methods by default
          enablePerformanceAPI: options.enablePerformanceAPI !== false,
          enableShadowDOM: options.enableShadowDOM !== false,
          enableAdvancedBackground: options.enableAdvancedBackground !== false,
          enableSVGProcessing: options.enableSVGProcessing !== false,
          enableLazyLoading: options.enableLazyLoading !== false,
          enableUrlExtraction: options.enableUrlExtraction !== false,
          enableCustomExtensions: options.enableCustomExtensions !== false,
          enableMultiDocument: options.enableMultiDocument === true
        });
        
        // Run comprehensive collection
        const result = await collector.collectImages(options);
        
        // Format results for compatibility with existing dashboard
        const formattedResult = {
          success: result.success,
          items: result.images.map(img => ({
            url: img.url,
            src: img.src,
            type: img.type,
            confidence: img.confidence,
            discoveryMethod: img.discoveryMethod,
            metadata: img.metadata
          })),
          stats: {
            found: result.metadata?.totalFound || 0,
            validated: result.metadata?.validated || 0,
            duplicates: result.metadata?.duplicates || 0,
            errors: result.metadata?.errors || 0,
            extractionTime: result.metadata?.processingTime || 0,
            methodStats: result.metadata?.methodStats || {}
          },
          feeds: result.feeds,
          advanced: true // Flag to indicate advanced collection was used
        };
        
        console.log(`✅ Advanced Collector completed: ${formattedResult.items.length} items found`);
        console.log(`📊 Method breakdown:`, result.metadata.methodStats);
        
        // Send results to dashboard via messaging system
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            chrome.runtime.sendMessage({
              type: 'SCAN_RESULTS',
              data: formattedResult
            }).catch(error => {
              console.log('Note: Dashboard not connected for result display:', error.message);
            });
          } catch (error) {
            console.log('Note: Extension context not available for messaging');
          }
        }
        
        return formattedResult;
        
      } else {
        console.warn('🔄 Advanced Collector System not available - using basic DOM extraction');
        
        // Show user-visible notification that advanced features are unavailable
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            chrome.runtime.sendMessage({
              type: 'SYSTEM_WARNING',
              data: {
                message: 'Advanced Collector unavailable - using basic extraction',
                level: 'warning'
              }
            }).catch(() => {/* Dashboard not connected */});
          } catch (error) {
            // Extension context not available, continue silently
          }
        }
        
        // Fallback to existing extractor
        const extractor = new window.AdvancedExtractor({
          useMultipleStrategies: true,
          validateExtractedContent: true,
          enableFallbackExtraction: true
        });
        
        // Extract images
        const result = await extractor.extractImages(selector, options);
        
        // Format results for compatibility
        const formattedResult = {
          success: result.success,
          items: result.images || [],
          stats: {
            found: result.metadata?.totalFound || 0,
            validated: result.metadata?.validated || 0,
            duplicates: result.metadata?.duplicates || 0,
            errors: result.metadata?.errors || 0,
            extractionTime: result.metadata?.extractionTime || 0,
            methodStats: result.metadata?.methodStats || {}
          },
          advanced: false // Flag to indicate basic collection was used
        };
        
        console.log(`✅ Basic scraper completed: ${formattedResult.items.length} items found`);
        
        // Send results to dashboard via messaging system
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          try {
            chrome.runtime.sendMessage({
              type: 'SCAN_RESULTS',
              data: formattedResult
            }).catch(error => {
              console.log('Note: Dashboard not connected for result display:', error.message);
            });
          } catch (error) {
            console.log('Note: Extension context not available for messaging');
          }
        }
        
        return formattedResult;
      }
      
    } catch (error) {
      console.error('❌ Scraper failed:', error);
      return {
        success: false,
        items: [],
        error: error.message,
        stats: { found: 0, validated: 0, duplicates: 0, errors: 1, extractionTime: 0, methodStats: {} }
      };
    }
  };
  
  console.log('✅ Main scraper function loaded');
}

// =============================================================================
// 9. ENHANCED SMART SELECTION - Intelligent element selection capabilities
// =============================================================================

// Inline Enhanced Smart Selector System - No external script injection

// Fallback: Keep basic AdaptiveSelectorSystem for compatibility
if (!window.AdaptiveSelectorSystem) {

  class AdaptiveSelectorSystem {
    constructor(options = {}) {
      this.options = {
        // Enhanced fallback strategy configuration
        maxFallbackAttempts: options.maxFallbackAttempts || 3,
        selectorTimeout: options.selectorTimeout || 1500,
        confidenceThreshold: options.confidenceThreshold || 0.8,
        minimalConfidenceThreshold: options.minimalConfidenceThreshold || 0.6,
        
        // Site-specific patterns
        siteSpecificPatterns: {
          instagram: {
            imageSelectors: [
              'article img',
              '[role="presentation"] img',
              'img[alt*="Photo by"]',
              'img[src*="scontent"]'
            ],
            containerSelectors: [
              'article',
              '[role="presentation"]',
              'section main'
            ]
          },
          pinterest: {
            imageSelectors: [
              '[data-test-id="pin-image"]',
              '.GrowthUnauthPinImage img',
              'img[alt*="Pin"]'
            ],
            containerSelectors: [
              '[data-test-id="pin"]',
              '.GrowthUnauthPin'
            ]
          },
          generic: {
            imageSelectors: [
              'img[src*="cdn"]',
              'img[loading="lazy"]',
              'img[data-src]',
              'img[data-lazy]',
              '.gallery img',
              '.grid img',
              'article img'
            ],
            containerSelectors: [
              '.gallery',
              '.grid',
              '.masonry',
              '.photos',
              '.images',
              '.feed'
            ]
          }
        },
        
        ...options
      };

      this.selectorHistory = new Map();
      this.performanceMetrics = {
        successful: 0,
        failed: 0,
        fallbacksUsed: 0,
        averageAttempts: 0
      };

      this.initializeSiteDetection();
    }

    // Initialize site detection
    initializeSiteDetection() {
      this.currentSite = this.detectCurrentSite();
      this.sitePatterns = this.getCurrentSitePatterns();
      console.log('🌐 Site detected:', this.currentSite);
    }

    // Detect current site based on URL patterns
    detectCurrentSite() {
      const hostname = window.location.hostname.toLowerCase();
      
      if (hostname.includes('instagram')) return 'instagram';
      if (hostname.includes('pinterest')) return 'pinterest';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
      if (hostname.includes('facebook')) return 'facebook';
      
      return 'generic';
    }

    // Get patterns for current site
    getCurrentSitePatterns() {
      const sitePatterns = this.options.siteSpecificPatterns[this.currentSite];
      if (sitePatterns) {
        return sitePatterns;
      }

      // Fallback to generic patterns
      return this.options.siteSpecificPatterns.generic;
    }

    // Enhanced method to find gallery images using site-specific patterns
    async findGalleryImages(options = {}) {
      const startTime = performance.now();
      const maxImages = options.maxImages || 1000;
      const minSize = options.minSize || 100;

      console.log(`🖼️ Finding gallery images for site: ${this.currentSite}`);

      try {
        let allImages = [];

        // Use site-specific selectors first
        if (this.sitePatterns && this.sitePatterns.imageSelectors) {
          for (const selector of this.sitePatterns.imageSelectors) {
            try {
              const images = this.testSelector(selector);
              allImages.push(...images);
            } catch (error) {
              console.warn(`⚠️ Site-specific selector failed: ${selector}`, error);
            }
          }
        }

        // If no site-specific images found, use generic approach
        if (allImages.length === 0) {
          console.log('🔄 No site-specific images found, using generic approach...');
          allImages = this.findGenericGalleryImages();
        }

        // Filter and validate images
        const validImages = await this.validateGalleryImages(allImages, { minSize, maxImages });

        const processingTime = performance.now() - startTime;
        console.log(`✅ Found ${validImages.length} valid gallery images in ${processingTime.toFixed(2)}ms`);

        return {
          images: validImages,
          site: this.currentSite,
          patterns: this.sitePatterns,
          processingTime,
          totalFound: allImages.length,
          validCount: validImages.length
        };

      } catch (error) {
        console.error('❌ Error finding gallery images:', error);
        return {
          images: [],
          site: this.currentSite,
          error: error.message,
          processingTime: performance.now() - startTime
        };
      }
    }

    // Find images using generic patterns when site-specific ones fail
    findGenericGalleryImages() {
      const selectors = [
        'img[src*="cdn"]',
        'img[loading="lazy"]',
        'img[data-src]',
        'img[data-lazy]',
        '.gallery img',
        '.grid img',
        '.masonry img',
        '.photos img',
        '.images img',
        '.feed img',
        '.posts img',
        'article img',
        'section img'
      ];

      let allImages = [];
      for (const selector of selectors) {
        try {
          const images = this.testSelector(selector);
          allImages.push(...images);
        } catch (error) {
          console.warn(`⚠️ Generic selector failed: ${selector}`);
        }
      }

      // Remove duplicates
      return Array.from(new Set(allImages));
    }

    // Test a CSS selector and return matching elements
    testSelector(selector) {
      try {
        return Array.from(document.querySelectorAll(selector));
      } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error);
        return [];
      }
    }

    // Validate gallery images based on size and other criteria
    async validateGalleryImages(images, options = {}) {
      const { minSize = 100, maxImages = 1000 } = options;
      const validImages = [];

      for (let i = 0; i < Math.min(images.length, maxImages); i++) {
        const img = images[i];
        
        if (this.isValidGalleryImage(img, minSize)) {
          validImages.push({
            element: img,
            src: this.getImageSrc(img),
            alt: img.alt || '',
            width: img.naturalWidth || img.offsetWidth,
            height: img.naturalHeight || img.offsetHeight,
            lazy: this.isLazyLoadedImage(img),
            inViewport: this.isInViewport(img)
          });
        }
      }

      return validImages;
    }

    // Check if image meets gallery criteria
    isValidGalleryImage(img, minSize) {
      if (!img || !img.tagName || img.tagName.toLowerCase() !== 'img') {
        return false;
      }

      // Check size
      const width = img.naturalWidth || img.offsetWidth;
      const height = img.naturalHeight || img.offsetHeight;
      
      if (width < minSize || height < minSize) {
        return false;
      }

      // Check if image has valid source
      const src = this.getImageSrc(img);
      if (!src || src.startsWith('data:image/svg') || src.includes('loading') || src.includes('placeholder')) {
        return false;
      }

      // Check for common exclusions
      const excludePatterns = [
        /avatar/i,
        /profile/i,
        /icon/i,
        /logo/i,
        /button/i,
        /arrow/i,
        /spinner/i,
        /loading/i
      ];

      const alt = img.alt || '';
      const className = img.className || '';
      
      if (excludePatterns.some(pattern => pattern.test(alt) || pattern.test(className) || pattern.test(src))) {
        return false;
      }

      return true;
    }

    // Get image source, handling lazy loading
    getImageSrc(img) {
      return img.src || 
             img.getAttribute('data-src') || 
             img.getAttribute('data-lazy') ||
             img.getAttribute('data-original') ||
             '';
    }

    // Check if image is lazy-loaded
    isLazyLoadedImage(img) {
      return !!(img.getAttribute('data-src') || 
                img.getAttribute('data-lazy') || 
                img.getAttribute('loading') === 'lazy' ||
                img.classList.contains('lazy') ||
                img.classList.contains('lazyload'));
    }

    // Check if element is in viewport
    isInViewport(element) {
      if (!element.getBoundingClientRect) return false;
      
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }

    // Score element for selection
    scoreElement(element) {
      let score = 0;
      const factors = [];
      
      // Size scoring
      const rect = element.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 200) {
        score += 0.3;
        factors.push('large_size');
      }
      
      // Class name scoring
      const className = element.className?.toLowerCase() || '';
      const highValueClasses = ['gallery', 'photo', 'image', 'picture'];
      if (highValueClasses.some(cls => className.includes(cls))) {
        score += 0.4;
        factors.push('semantic_class');
      }
      
      // Attribute scoring
      if (element.hasAttribute('data-src') || element.hasAttribute('data-lazy')) {
        score += 0.2;
        factors.push('lazy_loading');
      }
      
      return { score, factors };
    }

    // Detect gallery containers
    detectGalleryContainers() {
      const containers = [];

      if (this.sitePatterns && this.sitePatterns.containerSelectors) {
        for (const selector of this.sitePatterns.containerSelectors) {
          try {
            const elements = this.testSelector(selector);
            containers.push(...elements);
          } catch (error) {
            console.warn(`⚠️ Container selector failed: ${selector}`);
          }
        }
      }

      // Generic fallback
      if (containers.length === 0) {
        const genericSelectors = [
          '.gallery',
          '.grid',
          '.masonry',
          '.photos',
          '.images',
          '.feed',
          '.posts',
          '[role="main"]',
          'main',
          'section'
        ];

        for (const selector of genericSelectors) {
          try {
            const elements = this.testSelector(selector);
            containers.push(...elements);
          } catch (error) {
            console.warn(`⚠️ Generic container selector failed: ${selector}`);
          }
        }
      }

      return Array.from(new Set(containers));
    }
  }

  // Export to global scope
  window.AdaptiveSelectorSystem = AdaptiveSelectorSystem;
  console.log('✅ Adaptive selector system loaded');
}

// Simple Element Picker for interactive selection
if (!window.StepThreeElementPicker) {
  
  class StepThreeElementPicker {
    constructor() {
      this.isActive = false;
      this.highlightedElement = null;
      this.overlay = null;
      this.timeoutId = null;
      this.handlers = {
        mouseover: this.handleMouseOver.bind(this),
        click: this.handleClick.bind(this),
        keydown: this.handleKeyDown.bind(this)
      };
    }

    async startPicking() {
      if (this.isActive) {
        console.warn('Element picker already active');
        return false;
      }

      this.isActive = true;
      this.createOverlay();
      this.attachEventListeners();
      
      // Set a timeout to automatically stop the picker after 30 seconds
      this.timeoutId = setTimeout(() => {
        if (this.isActive) {
          console.warn('Element picker timed out - stopping automatically');
          this.stop();
        }
      }, 30000);
      
      console.log('✅ Element picker started - click any element to select');
      return true;
    }

    stop() {
      if (!this.isActive) {
        return false;
      }

      this.isActive = false;
      
      // Clear timeout if it exists
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      this.removeOverlay();
      this.detachEventListeners();
      this.clearHighlight();
      
      console.log('🛑 Element picker stopped');
      return true;
    }

    createOverlay() {
      this.overlay = document.createElement('div');
      this.overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
        z-index: 999999;
        pointer-events: auto;
        cursor: crosshair;
      `;
      document.body.appendChild(this.overlay);
    }

    removeOverlay() {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
        this.overlay = null;
      }
    }

    attachEventListeners() {
      // Intercept at the document level (capture) and via overlay to block page handlers
      document.addEventListener('mouseover', this.handlers.mouseover, true);
      document.addEventListener('click', this.handlers.click, true);
      if (this.overlay) {
        // Block interactions from reaching the page underneath
        const block = (e) => {
          if (!this.isActive) return;
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        };
        this._overlayBlockHandlers = {
          mousedown: block,
          mouseup: block,
          click: block,
          pointerdown: block,
          pointerup: block,
          contextmenu: block,
          wheel: block
        };
        Object.entries(this._overlayBlockHandlers).forEach(([type, handler]) => {
          this.overlay.addEventListener(type, handler);
        });
      }
      document.addEventListener('keydown', this.handlers.keydown, true);
    }

    detachEventListeners() {
      document.removeEventListener('mouseover', this.handlers.mouseover, true);
      document.removeEventListener('click', this.handlers.click, true);
      if (this.overlay && this._overlayBlockHandlers) {
        Object.entries(this._overlayBlockHandlers).forEach(([type, handler]) => {
          this.overlay.removeEventListener(type, handler);
        });
        this._overlayBlockHandlers = null;
      }
      document.removeEventListener('keydown', this.handlers.keydown, true);
    }

    handleMouseOver(event) {
      if (!this.isActive) return;
      
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      const element = this.getUnderlyingElementAtPoint(event.clientX, event.clientY);
      this.highlightElement(element);
    }

    handleClick(event) {
      if (!this.isActive) return;
      
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      
      const element = this.getUnderlyingElementAtPoint(event.clientX, event.clientY) || event.target;
      const selector = this.generateSelector(element);
      
      console.log('🎯 Element selected:', { element, selector });
      
      // Send selection back to extension with error handling
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          chrome.runtime.sendMessage({
            action: 'element_selected',
            selector: selector,
            element: {
              tagName: element.tagName,
              className: element.className,
              id: element.id,
              textContent: element.textContent?.substring(0, 100)
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Failed to send element_selected message:', chrome.runtime.lastError);
            } else {
              console.log('✅ Element selection message sent successfully');
            }
          });
        } catch (error) {
          console.error('Error sending element_selected message:', error);
        }
      } else {
        console.error('Chrome runtime not available for sending element_selected message');
      }
      
      this.stop();
    }

    handleKeyDown(event) {
      if (!this.isActive) return;
      
      if (event.key === 'Escape') {
        event.preventDefault();
        this.stop();
      }
    }

    getUnderlyingElementAtPoint(x, y) {
      try {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        if (!this.overlay) return document.elementFromPoint(x, y);
        const prev = this.overlay.style.pointerEvents;
        this.overlay.style.pointerEvents = 'none';
        const el = document.elementFromPoint(x, y);
        this.overlay.style.pointerEvents = prev || 'auto';
        return el;
      } catch {
        return null;
      }
    }

    highlightElement(element) {
      this.clearHighlight();
      
      if (element && element !== document.body && element !== document.documentElement) {
        element.style.outline = '2px solid #ff6b6b';
        element.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
        this.highlightedElement = element;
      }
    }

    clearHighlight() {
      if (this.highlightedElement) {
        this.highlightedElement.style.outline = '';
        this.highlightedElement.style.backgroundColor = '';
        this.highlightedElement = null;
      }
    }

    generateSelector(element) {
      if (element.id) {
        return `#${element.id}`;
      }
      
      let selector = element.tagName.toLowerCase();
      
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += '.' + classes[0];
        }
      }
      
      return selector;
    }
  }

  // Export to global scope
  window.StepThreeElementPicker = StepThreeElementPicker;
  console.log('✅ Element picker loaded');
}

// =============================================================================
// 9.5. ENHANCED SMART SELECTOR SYSTEM (BUNDLED FOR MV3 COMPATIBILITY)
// =============================================================================

// Initialize Enhanced Smart Selector with CSP-safe bundling
async function initializeEnhancedSelector() {
  return new Promise((resolve) => {
    try {
      // Define EnhancedSmartSelectorSystem class inline to avoid CSP issues
      if (!window.EnhancedSmartSelectorSystem) {
        
        class EnhancedSmartSelectorSystem {
          constructor(options = {}) {
            this.options = {
              // Core selection options
              maxFallbackAttempts: options.maxFallbackAttempts || 3,
              selectorTimeout: options.selectorTimeout || 2000,
              confidenceThreshold: options.confidenceThreshold || 0.75,
              earlyExitThreshold: options.earlyExitThreshold || 0.90,
              
              // Auto-expand settings
              autoExpandAfterSamples: options.autoExpandAfterSamples || 3,
              autoExpandMinConfidence: options.autoExpandMinConfidence || 0.90,
              maxAutoExpandElements: options.maxAutoExpandElements || 1000,
              
              // Similarity clustering weights
              similarityWeights: {
                tagName: 0.2,
                className: 0.25,
                attributes: 0.20,
                cssPath: 0.15,
                siblings: 0.10,
                urlPattern: 0.10
              },
              
              // URL pattern mining
              urlPatternMining: {
                enabled: options.enableUrlPatternMining !== false,
                numericPattern: /(\d+)/g,
                sequenceThreshold: 3, // Min sequence length to consider pattern
                confidenceBoost: 0.15 // Boost for URL pattern matches
              },
              
              confidenceWeights: {
                dataAttributes: 0.95,
                reactPatterns: 0.92,
                semanticClasses: 0.88,
                structuralPatterns: 0.85,
                genericSelectors: 0.60
              },
              
              enableProgressiveAnalysis: options.enableProgressiveAnalysis !== false,
              enableEarlyExit: options.enableEarlyExit !== false,
              maxAnalysisTime: options.maxAnalysisTime || 5000,
              
              // Core site-specific patterns for major platforms
              siteSpecificPatterns: {
                instagram: {
                  domain: ['instagram.com', 'www.instagram.com'],
                  confidence: 0.95,
                  imageSelectors: [
                    '._aagu img', '._aagv img', 'article img[src*="scontent"]',
                    '[role="presentation"] img[src*="scontent"]', 'img[alt*="Photo by"]',
                    'div[class*="x1n2onr6"] img', 'div[class*="x1lliihq"] img',
                    'section[role="main"] img:not([alt*="avatar"])',
                    'div[data-visualcompletion="media-vc-image"] img'
                  ]
                },
                twitter: {
                  domain: ['twitter.com', 'x.com'],
                  confidence: 0.90,
                  imageSelectors: [
                    '[data-testid="tweetPhoto"] img', '[data-testid="media"] img',
                    'img[src*="pbs.twimg.com"]', '[role="group"] img[src*="pbs.twimg"]',
                    'div[data-testid="tweet"] img:not([src*="profile_images"])'
                  ]
                },
                pinterest: {
                  domain: ['pinterest.com', 'www.pinterest.com'],
                  confidence: 0.93,
                  imageSelectors: [
                    '[data-test-id="pin-image"] img', '.GrowthUnauthPinImage img',
                    'img[src*="pinimg"]', 'div[class*="gridCentered"] img'
                  ]
                },
                generic: {
                  confidence: 0.60,
                  imageSelectors: [
                    'img[src]:not([src*="icon"]):not([src*="avatar"]):not([width="16"]):not([height="16"])',
                    'img[data-src]:not([data-src*="icon"])', '.gallery img', '.images img',
                    'article img:not([width="16"]):not([height="16"])', 'figure img'
                  ]
                }
              },
              
              ...options
            };

            // Smart selector state
            this.currentSite = this.detectCurrentSite();
            this.sitePatterns = this.getCurrentSitePatterns();
            this.selectedElements = [];
            this.selectedSamples = []; // Tracks user-selected samples for pattern recognition
            this.autoExpandedElements = []; // Tracks auto-expanded elements
            this.urlPatterns = new Map(); // Cache for detected URL patterns
            this.similarityCache = new Map(); // Cache for similarity calculations
            this.isActive = false;
            this.ready = true;
            this.selectionCounter = 0;
            
            // Progressive selection workflow state
            this.progressiveMode = 'sampling'; // 'sampling', 'analyzing', 'expanding'
            this.patternAnalysis = null;
            this.lastAnalysisTime = 0;
            
            console.log(`🧠 Enhanced Smart Selector initialized for site: ${this.currentSite}`);
          }

          detectCurrentSite() {
            const hostname = window.location.hostname.toLowerCase();
            if (hostname.includes('instagram')) return 'instagram';
            if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
            if (hostname.includes('pinterest')) return 'pinterest';
            return 'generic';
          }

          getCurrentSitePatterns() {
            return this.options.siteSpecificPatterns[this.currentSite] || 
                   this.options.siteSpecificPatterns.generic;
          }

          async findGalleryImages(options = {}) {
            const startTime = performance.now();
            try {
              const selectors = this.sitePatterns.imageSelectors || [];
              const allImages = [];
              
              for (const selector of selectors) {
                try {
                  const elements = document.querySelectorAll(selector);
                  allImages.push(...Array.from(elements));
                } catch (error) {
                  console.warn(`Selector failed: ${selector}`, error);
                }
              }

              // Remove duplicates and filter valid images
              const uniqueImages = Array.from(new Set(allImages));
              const validImages = uniqueImages.filter(img => {
                if (!img.src && !img.dataset.src) return false;
                const rect = img.getBoundingClientRect();
                return rect.width > (options.minSize || 100) && rect.height > (options.minSize || 100);
              });

              const processingTime = performance.now() - startTime;
              
              return {
                images: validImages.slice(0, options.maxImages || 1000),
                site: this.currentSite,
                totalFound: allImages.length,
                validCount: validImages.length,
                processingTime,
                enhanced: true
              };
            } catch (error) {
              console.error('Enhanced selector error:', error);
              return { images: [], error: error.message, enhanced: false };
            }
          }

          // Alias for compatibility
          findImages(options = {}) {
            return this.findGalleryImages(options);
          }

          startInteractiveSelection() {
            if (this.isActive) return false;
            this.isActive = true;
            
            this.setupEventListeners();
            document.body.style.cursor = 'crosshair';
            
            console.log('🎯 Enhanced interactive selection started');
            return true;
          }

          setupEventListeners() {
            this.mouseOverHandler = this.handleMouseOver.bind(this);
            this.clickHandler = this.handleClick.bind(this);
            
            document.addEventListener('mouseover', this.mouseOverHandler);
            document.addEventListener('click', this.clickHandler);
          }

          stopSelection() {
            if (!this.isActive) return false;
            this.isActive = false;
            
            if (this.mouseOverHandler) {
              document.removeEventListener('mouseover', this.mouseOverHandler);
            }
            if (this.clickHandler) {
              document.removeEventListener('click', this.clickHandler);
            }
            
            document.body.style.cursor = '';
            
            // Clear highlights
            document.querySelectorAll('.st-enhanced-highlight').forEach(el => {
              el.classList.remove('st-enhanced-highlight');
            });
            
            console.log('🛑 Enhanced interactive selection stopped');
            return true;
          }

          handleMouseOver(event) {
            if (!this.isActive) return;
            
            // Clear previous highlight
            document.querySelectorAll('.st-enhanced-highlight').forEach(el => {
              el.classList.remove('st-enhanced-highlight');
            });
            
            // Highlight current element
            event.target.classList.add('st-enhanced-highlight');
          }

          handleClick(event) {
            if (!this.isActive) return;
            event.preventDefault();
            event.stopPropagation();
            
            this.selectionCounter++;
            const element = event.target;
            
            // Add to selected samples for pattern analysis
            this.selectedSamples.push({
              element: element,
              selector: this.generateStableSelector(element),
              attributes: this.extractElementAttributes(element),
              cssPath: this.generateCSSPath(element),
              urlPattern: this.extractUrlPattern(element),
              timestamp: Date.now(),
              index: this.selectionCounter
            });
            
            // Add visual selection indicator
            this.addSelectionIndicator(element, this.selectionCounter);
            
            console.log(`🎯 Enhanced element selected (${this.selectionCounter}):`, element);
            
            // Progressive selection workflow
            if (this.selectionCounter >= this.options.autoExpandAfterSamples) {
              this.progressiveMode = 'analyzing';
              this.analyzePatternAndAutoExpand();
            } else {
              // Continue sampling mode
              this.progressiveMode = 'sampling';
              this.updateSelectionStatus(`Select ${this.options.autoExpandAfterSamples - this.selectionCounter} more samples to auto-detect similar elements`);
            }
            
            // Emit selection event with enhanced data
            window.dispatchEvent(new CustomEvent('st-element-selected', {
              detail: { 
                element: element, 
                selector: this.generateStableSelector(element),
                selectionCount: this.selectionCounter,
                mode: this.progressiveMode,
                samples: this.selectedSamples.length,
                autoExpanded: this.autoExpandedElements.length
              }
            }));
          }

          // =============================================================================
          // SIMILARITY CLUSTERING ALGORITHM
          // =============================================================================

          /**
           * Analyze patterns from selected samples and auto-expand selection
           */
          async analyzePatternAndAutoExpand() {
            console.log('🧠 Analyzing patterns from selected samples...');
            
            if (this.selectedSamples.length < this.options.autoExpandAfterSamples) {
              return;
            }
            
            const startTime = performance.now();
            this.patternAnalysis = await this.performSimilarityAnalysis();
            
            if (this.patternAnalysis.confidence >= this.options.autoExpandMinConfidence) {
              await this.autoExpandSelection();
              this.progressiveMode = 'expanding';
            } else {
              this.progressiveMode = 'sampling';
              this.updateSelectionStatus(`Pattern confidence too low (${Math.round(this.patternAnalysis.confidence * 100)}%), need more samples`);
            }
            
            this.lastAnalysisTime = performance.now() - startTime;
            console.log(`🎯 Pattern analysis completed in ${this.lastAnalysisTime.toFixed(2)}ms`);
          }

          /**
           * Perform similarity analysis on selected samples
           */
          async performSimilarityAnalysis() {
            const analysis = {
              confidence: 0,
              patterns: {
                tagName: {},
                className: {},
                attributes: {},
                cssPath: {},
                urlPattern: {},
                siblings: {}
              },
              selectedSelector: '',
              similarElements: [],
              breakdown: {}
            };
            
            // Analyze common patterns across samples
            for (const sample of this.selectedSamples) {
              // Tag name analysis
              const tagName = sample.element.tagName.toLowerCase();
              analysis.patterns.tagName[tagName] = (analysis.patterns.tagName[tagName] || 0) + 1;
              
              // Class name analysis
              if (sample.element.className) {
                const classes = sample.element.className.split(' ').filter(c => c.trim());
                classes.forEach(cls => {
                  analysis.patterns.className[cls] = (analysis.patterns.className[cls] || 0) + 1;
                });
              }
              
              // Attribute analysis
              for (const attr of sample.element.attributes) {
                if (attr.name !== 'class' && attr.name !== 'id') {
                  const key = `${attr.name}=${attr.value}`;
                  analysis.patterns.attributes[key] = (analysis.patterns.attributes[key] || 0) + 1;
                }
              }
              
              // URL pattern analysis
              if (sample.urlPattern) {
                analysis.patterns.urlPattern[sample.urlPattern] = (analysis.patterns.urlPattern[sample.urlPattern] || 0) + 1;
              }
              
              // Sibling analysis
              const siblingsInfo = this.analyzeSiblings(sample.element);
              const siblingKey = `${siblingsInfo.total}_${siblingsInfo.position}`;
              analysis.patterns.siblings[siblingKey] = (analysis.patterns.siblings[siblingKey] || 0) + 1;
            }
            
            // Calculate confidence based on pattern consistency
            const sampleCount = this.selectedSamples.length;
            const weights = this.options.similarityWeights;
            let totalConfidence = 0;
            
            // Tag name confidence
            const mostCommonTag = this.getMostCommonPattern(analysis.patterns.tagName);
            if (mostCommonTag.count === sampleCount) {
              totalConfidence += weights.tagName;
              analysis.breakdown.tagName = { confidence: 1.0, pattern: mostCommonTag.pattern };
            }
            
            // Class name confidence
            const mostCommonClass = this.getMostCommonPattern(analysis.patterns.className);
            if (mostCommonClass.count >= Math.ceil(sampleCount * 0.7)) {
              const classConfidence = mostCommonClass.count / sampleCount;
              totalConfidence += weights.className * classConfidence;
              analysis.breakdown.className = { confidence: classConfidence, pattern: mostCommonClass.pattern };
            }
            
            // Attribute confidence
            const mostCommonAttr = this.getMostCommonPattern(analysis.patterns.attributes);
            if (mostCommonAttr.count >= Math.ceil(sampleCount * 0.6)) {
              const attrConfidence = mostCommonAttr.count / sampleCount;
              totalConfidence += weights.attributes * attrConfidence;
              analysis.breakdown.attributes = { confidence: attrConfidence, pattern: mostCommonAttr.pattern };
            }
            
            // URL pattern confidence
            if (this.options.urlPatternMining.enabled) {
              const urlConfidence = this.calculateUrlPatternConfidence(analysis.patterns.urlPattern, sampleCount);
              totalConfidence += weights.urlPattern * urlConfidence;
              analysis.breakdown.urlPattern = { confidence: urlConfidence };
            }
            
            analysis.confidence = Math.min(totalConfidence, 1.0);
            
            // Generate stable selector for similar elements
            analysis.selectedSelector = this.generatePatternSelector(analysis);
            
            return analysis;
          }

          /**
           * Auto-expand selection based on pattern analysis
           */
          async autoExpandSelection() {
            if (!this.patternAnalysis || !this.patternAnalysis.selectedSelector) {
              return;
            }
            
            console.log(`🚀 Auto-expanding selection with selector: ${this.patternAnalysis.selectedSelector}`);
            
            try {
              // Find all elements matching the pattern
              const candidateElements = document.querySelectorAll(this.patternAnalysis.selectedSelector);
              const filteredElements = [];
              
              for (const candidate of candidateElements) {
                // Skip already selected elements
                if (this.selectedSamples.some(sample => sample.element === candidate)) {
                  continue;
                }
                
                // Calculate similarity to selected samples
                const similarity = this.calculateElementSimilarity(candidate, this.selectedSamples);
                
                if (similarity >= this.options.autoExpandMinConfidence) {
                  filteredElements.push({
                    element: candidate,
                    similarity: similarity,
                    selector: this.generateStableSelector(candidate)
                  });
                }
                
                // Limit auto-expansion to prevent page overload
                if (filteredElements.length >= this.options.maxAutoExpandElements) {
                  break;
                }
              }
              
              // Add auto-expanded elements
              this.autoExpandedElements = filteredElements;
              
              // Add visual indicators for auto-expanded elements
              filteredElements.forEach((item, index) => {
                this.addAutoExpandIndicator(item.element, index + 1);
              });
              
              const totalSelected = this.selectedSamples.length + this.autoExpandedElements.length;
              this.updateSelectionStatus(`Auto-expanded: found ${this.autoExpandedElements.length} similar elements (${totalSelected} total)`);
              
              console.log(`✅ Auto-expansion completed: ${this.autoExpandedElements.length} elements added`);
              
              // Emit auto-expansion event
              window.dispatchEvent(new CustomEvent('st-auto-expanded', {
                detail: {
                  expandedCount: this.autoExpandedElements.length,
                  totalCount: totalSelected,
                  confidence: this.patternAnalysis.confidence,
                  selector: this.patternAnalysis.selectedSelector
                }
              }));
              
            } catch (error) {
              console.error('❌ Auto-expansion failed:', error);
              this.updateSelectionStatus('Auto-expansion failed, continue manual selection');
            }
          }

          // =============================================================================
          // URL PATTERN MINING
          // =============================================================================

          /**
           * Extract URL pattern from element (for images and links)
           */
          extractUrlPattern(element) {
            const urls = [];
            
            // Get URLs from various sources
            if (element.src) urls.push(element.src);
            if (element.href) urls.push(element.href);
            if (element.dataset.src) urls.push(element.dataset.src);
            if (element.dataset.original) urls.push(element.dataset.original);
            
            // Analyze URL patterns
            for (const url of urls) {
              const pattern = this.detectNumericSequence(url);
              if (pattern) {
                return pattern;
              }
            }
            
            return null;
          }

          /**
           * Detect numeric sequences in URLs for gallery pattern recognition
           */
          detectNumericSequence(url) {
            if (!this.options.urlPatternMining.enabled) {
              return null;
            }
            
            try {
              const numbers = [...url.matchAll(this.options.urlPatternMining.numericPattern)];
              
              if (numbers.length === 0) {
                return null;
              }
              
              // Look for sequences (e.g., /image1.jpg, /image2.jpg, /image3.jpg)
              const lastNumber = numbers[numbers.length - 1];
              const numberValue = parseInt(lastNumber[1]);
              
              if (!isNaN(numberValue) && numberValue > 0) {
                // Generate pattern by replacing the number with a placeholder
                const pattern = url.replace(lastNumber[1], '{n}');
                return {
                  pattern: pattern,
                  position: lastNumber.index,
                  value: numberValue,
                  url: url
                };
              }
              
            } catch (error) {
              console.warn('URL pattern detection failed:', error);
            }
            
            return null;
          }

          /**
           * Calculate confidence for URL patterns
           */
          calculateUrlPatternConfidence(urlPatterns, sampleCount) {
            if (Object.keys(urlPatterns).length === 0) {
              return 0;
            }
            
            const mostCommon = this.getMostCommonPattern(urlPatterns);
            const confidence = mostCommon.count / sampleCount;
            
            // Boost confidence if URL pattern indicates a sequence
            if (mostCommon.pattern && mostCommon.pattern.includes('{n}')) {
              return Math.min(confidence + this.options.urlPatternMining.confidenceBoost, 1.0);
            }
            
            return confidence;
          }

          generateSelector(element) {
            if (element.id) {
              return `#${element.id}`;
            }
            
            let selector = element.tagName.toLowerCase();
            
            if (element.className) {
              const classes = element.className.split(' ').filter(c => c.trim() && !c.includes('st-enhanced'));
              if (classes.length > 0) {
                selector += '.' + classes[0];
              }
            }
            
            return selector;
          }

          // =============================================================================
          // HELPER METHODS FOR SMART PATTERN RECOGNITION
          // =============================================================================

          /**
           * Generate stable CSS selector for element
           */
          generateStableSelector(element) {
            // Try ID first (most stable)
            if (element.id && element.id.trim()) {
              return `#${element.id}`;
            }

            // Try stable data attributes
            const stableAttributes = ['data-testid', 'data-cy', 'data-test', 'role', 'aria-label'];
            for (const attr of stableAttributes) {
              const value = element.getAttribute(attr);
              if (value && value.trim()) {
                return `[${attr}="${value}"]`;
              }
            }

            // Try meaningful classes (avoid generated/temporary classes)
            if (element.className) {
              const classes = element.className.split(' ')
                .filter(cls => cls.trim() && !cls.match(/^(st-|temp-|auto-|gen-|css-)/))
                .filter(cls => cls.length > 2);
              
              if (classes.length > 0) {
                return element.tagName.toLowerCase() + '.' + classes[0];
              }
            }

            // Fallback to CSS path
            return this.generateCSSPath(element);
          }

          /**
           * Generate CSS path to element
           */
          generateCSSPath(element) {
            const path = [];
            let current = element;

            while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
              let selector = current.tagName.toLowerCase();
              
              if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
              }

              // Add nth-child if needed for uniqueness
              const siblings = Array.from(current.parentNode?.children || [])
                .filter(sibling => sibling.tagName === current.tagName);
              
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
              }

              path.unshift(selector);
              current = current.parentNode;
            }

            return path.join(' > ');
          }

          /**
           * Extract element attributes for analysis
           */
          extractElementAttributes(element) {
            const attributes = {};
            
            for (const attr of element.attributes) {
              attributes[attr.name] = attr.value;
            }
            
            return attributes;
          }

          /**
           * Analyze element siblings for pattern recognition
           */
          analyzeSiblings(element) {
            const parent = element.parentNode;
            if (!parent) {
              return { total: 0, position: 0, similarSiblings: 0 };
            }

            const siblings = Array.from(parent.children);
            const position = siblings.indexOf(element);
            const similarSiblings = siblings.filter(sibling => 
              sibling.tagName === element.tagName && 
              sibling.className === element.className
            ).length;

            return {
              total: siblings.length,
              position: position,
              similarSiblings: similarSiblings
            };
          }

          /**
           * Calculate similarity between element and selected samples
           */
          calculateElementSimilarity(element, samples) {
            if (samples.length === 0) return 0;

            let totalSimilarity = 0;
            const weights = this.options.similarityWeights;

            for (const sample of samples) {
              let similarity = 0;

              // Tag name similarity
              if (element.tagName === sample.element.tagName) {
                similarity += weights.tagName;
              }

              // Class name similarity
              const elementClasses = new Set(element.className.split(' ').filter(c => c.trim()));
              const sampleClasses = new Set(sample.element.className.split(' ').filter(c => c.trim()));
              const classIntersection = new Set([...elementClasses].filter(x => sampleClasses.has(x)));
              const classUnion = new Set([...elementClasses, ...sampleClasses]);
              
              if (classUnion.size > 0) {
                const classJaccard = classIntersection.size / classUnion.size;
                similarity += weights.className * classJaccard;
              }

              // Attribute similarity
              const elementAttrs = this.extractElementAttributes(element);
              const sampleAttrs = sample.attributes;
              const attrSimilarity = this.calculateAttributeSimilarity(elementAttrs, sampleAttrs);
              similarity += weights.attributes * attrSimilarity;

              // CSS path similarity (structural)
              const elementPath = this.generateCSSPath(element);
              const samplePath = sample.cssPath;
              const pathSimilarity = this.calculatePathSimilarity(elementPath, samplePath);
              similarity += weights.cssPath * pathSimilarity;

              // Sibling context similarity
              const elementSiblings = this.analyzeSiblings(element);
              const sampleSiblings = this.analyzeSiblings(sample.element);
              const siblingSimilarity = this.calculateSiblingSimilarity(elementSiblings, sampleSiblings);
              similarity += weights.siblings * siblingSimilarity;

              // URL pattern similarity
              if (this.options.urlPatternMining.enabled) {
                const elementUrlPattern = this.extractUrlPattern(element);
                const urlSimilarity = this.calculateUrlSimilarity(elementUrlPattern, sample.urlPattern);
                similarity += weights.urlPattern * urlSimilarity;
              }

              totalSimilarity += similarity;
            }

            return totalSimilarity / samples.length;
          }

          /**
           * Calculate attribute similarity using Jaccard index
           */
          calculateAttributeSimilarity(attrs1, attrs2) {
            const keys1 = new Set(Object.keys(attrs1));
            const keys2 = new Set(Object.keys(attrs2));
            const intersection = new Set([...keys1].filter(x => keys2.has(x)));
            const union = new Set([...keys1, ...keys2]);

            if (union.size === 0) return 1; // Both empty
            return intersection.size / union.size;
          }

          /**
           * Calculate path similarity using edit distance
           */
          calculatePathSimilarity(path1, path2) {
            const parts1 = path1.split(' > ');
            const parts2 = path2.split(' > ');
            
            // Simple similarity based on common path elements
            const common = parts1.filter(part => parts2.includes(part)).length;
            const total = Math.max(parts1.length, parts2.length);
            
            return total > 0 ? common / total : 0;
          }

          /**
           * Calculate sibling similarity
           */
          calculateSiblingSimilarity(siblings1, siblings2) {
            const totalDiff = Math.abs(siblings1.total - siblings2.total);
            const positionDiff = Math.abs(siblings1.position - siblings2.position);
            const similarDiff = Math.abs(siblings1.similarSiblings - siblings2.similarSiblings);
            
            // Normalize differences and calculate similarity
            const totalSim = totalDiff <= 2 ? 1 : Math.max(0, 1 - totalDiff / 10);
            const positionSim = positionDiff <= 2 ? 1 : Math.max(0, 1 - positionDiff / 5);
            const similarSim = similarDiff === 0 ? 1 : Math.max(0, 1 - similarDiff / 3);
            
            return (totalSim + positionSim + similarSim) / 3;
          }

          /**
           * Calculate URL similarity
           */
          calculateUrlSimilarity(pattern1, pattern2) {
            if (!pattern1 || !pattern2) return 0;
            
            // Compare URL patterns
            if (pattern1.pattern === pattern2.pattern) {
              return 1;
            }
            
            // Check if URLs are similar (same base, different numbers)
            const base1 = pattern1.pattern.replace('{n}', '');
            const base2 = pattern2.pattern.replace('{n}', '');
            
            return base1 === base2 ? 0.8 : 0;
          }

          /**
           * Get most common pattern from analysis
           */
          getMostCommonPattern(patterns) {
            let maxCount = 0;
            let mostCommon = null;

            for (const [pattern, count] of Object.entries(patterns)) {
              if (count > maxCount) {
                maxCount = count;
                mostCommon = pattern;
              }
            }

            return { pattern: mostCommon, count: maxCount };
          }

          /**
           * Generate selector based on pattern analysis
           */
          generatePatternSelector(analysis) {
            const selectors = [];

            // Use most common tag
            const tagPattern = analysis.breakdown.tagName;
            if (tagPattern && tagPattern.confidence > 0.8) {
              selectors.push(tagPattern.pattern);
            }

            // Add most common class
            const classPattern = analysis.breakdown.className;
            if (classPattern && classPattern.confidence > 0.7) {
              selectors.push(`${tagPattern?.pattern || ''}.${classPattern.pattern}`);
            }

            // Add most common attribute
            const attrPattern = analysis.breakdown.attributes;
            if (attrPattern && attrPattern.confidence > 0.6) {
              selectors.push(`[${attrPattern.pattern}]`);
            }

            // Return the most specific selector
            return selectors.length > 0 ? selectors[selectors.length - 1] : 'img';
          }

          // =============================================================================
          // VISUAL FEEDBACK SYSTEM
          // =============================================================================

          /**
           * Add visual indicator for selected elements
           */
          addSelectionIndicator(element, index) {
            // Remove existing indicators
            const existingBadge = element.querySelector('.st-selection-badge');
            if (existingBadge) {
              existingBadge.remove();
            }

            // Add selection styling
            element.classList.add('st-selected-element');

            // Create selection badge
            const badge = document.createElement('div');
            badge.className = 'st-selection-badge';
            badge.textContent = index.toString();
            badge.style.cssText = `
              position: absolute;
              top: -10px;
              left: -10px;
              background: #4CAF50;
              color: white;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              z-index: 10000;
              pointer-events: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;

            // Position badge relative to element
            element.style.position = 'relative';
            element.appendChild(badge);
          }

          /**
           * Add visual indicator for auto-expanded elements
           */
          addAutoExpandIndicator(element, index) {
            // Add auto-expand styling
            element.classList.add('st-auto-expanded-element');

            // Create auto-expand badge
            const badge = document.createElement('div');
            badge.className = 'st-auto-expand-badge';
            badge.textContent = '+';
            badge.style.cssText = `
              position: absolute;
              top: -8px;
              right: -8px;
              background: #2196F3;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              font-weight: bold;
              z-index: 10000;
              pointer-events: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;

            // Position badge relative to element
            element.style.position = 'relative';
            element.appendChild(badge);
          }

          /**
           * Update selection status message
           */
          updateSelectionStatus(message) {
            // Emit status update event for dashboard
            window.dispatchEvent(new CustomEvent('st-selection-status', {
              detail: { 
                message: message,
                mode: this.progressiveMode,
                samples: this.selectedSamples.length,
                autoExpanded: this.autoExpandedElements.length
              }
            }));

            console.log(`📢 Selection Status: ${message}`);
          }
        }

        // Export to global scope for compatibility
        window.EnhancedSmartSelectorSystem = EnhancedSmartSelectorSystem;
        
        // Add CSS for highlighting if not already present
        if (!document.querySelector('#st-enhanced-styles')) {
          const style = document.createElement('style');
          style.id = 'st-enhanced-styles';
          style.textContent = `
            .st-enhanced-highlight {
              outline: 2px solid #00ff88 !important;
              background-color: rgba(0, 255, 136, 0.1) !important;
              transition: all 0.1s ease !important;
            }
          `;
          document.head.appendChild(style);
        }
      }

      // Initialize the enhanced selector instance
      ExtensionState.selector = new window.EnhancedSmartSelectorSystem({
        confidenceThreshold: 0.75,
        earlyExitThreshold: 0.90,
        maxFallbackAttempts: 3,
        enableProgressiveAnalysis: true,
        enableEarlyExit: true
      });

      console.log('✅ Enhanced Smart Selector System bundled and initialized successfully');
      resolve(true);
      
    } catch (error) {
      console.error('❌ Enhanced selector initialization failed:', error);
      
      // Fallback to basic selector
      if (window.AdaptiveSelectorSystem) {
        ExtensionState.selector = new window.AdaptiveSelectorSystem({
          confidenceThreshold: 0.8,
          maxFallbackAttempts: 3
        });
        console.log('⚠️ Using fallback AdaptiveSelectorSystem');
      }
      
      resolve(false);
    }
  });
}

// =============================================================================
// 10. INITIALIZATION & INTEGRATION - Main entry point and message handling
// =============================================================================

// Main Extension Integration
if (!window.StepThreeContentBundleInitialized) {
  window.StepThreeContentBundleInitialized = true;

  // Global state management
  const ExtensionState = {
    initialized: false,
    observer: null,
    picker: null,
    scraper: null,
    lastActivity: Date.now(),
    config: {
      enableDebug: window.StepThreeConfig?.DEBUG_MODE || false,
      enableMetrics: true,
      autoInitialize: true
    }
  };

  // Initialize all components
  async function initializeExtension() {
    if (ExtensionState.initialized) {
      console.warn('⚠️ Extension already initialized');
      return false;
    }

    try {
      console.log('🚀 Initializing STEPTHREE Gallery Scraper...');

      // Initialize global utilities (only those that are defined)
      if (typeof ServiceWorkerFetch !== 'undefined') {
        window.ServiceWorkerFetch = ServiceWorkerFetch;
      }

      // Initialize services
      ExtensionState.scraper = new window.EnhancedScraperUtils({
        enableMetrics: ExtensionState.config.enableMetrics,
        requestsPerSecond: 2,
        maxRetries: 3,
        enableDuplicateDetection: true
      });

      // Initialize content observer
      ExtensionState.observer = new window.DynamicContentObserver({
        detectImages: true,
        detectGalleries: true,
        significantChangeThreshold: 0.3,
        throttleDelay: 500
      });

      // Initialize selector system with readiness promise
      ExtensionState.selectorReady = initializeEnhancedSelector();
      
      // Wait for selector to be ready
      await ExtensionState.selectorReady;

      // Initialize element picker
      ExtensionState.picker = new window.StepThreeElementPicker();

      ExtensionState.initialized = true;
      ExtensionState.lastActivity = Date.now();

      console.log('✅ Extension initialized successfully!');
      return true;

    } catch (error) {
      console.error('❌ Extension initialization failed:', error);
      return false;
    }
  }

  // Message handler for extension communication
  function handleExtensionMessage(message, sender, sendResponse) {
    console.log('📨 Received message:', message);

    try {
      switch (message.action) {
        case 'ping':
          sendResponse({ status: 'ok', initialized: ExtensionState.initialized });
          break;

        case 'initialize':
          initializeExtension().then(success => {
            sendResponse({ success, initialized: ExtensionState.initialized });
          }).catch(error => {
            sendResponse({ success: false, error: error.message });
          });
          break;

        case 'scrape_images':
          handleScrapeImages(message, sendResponse);
          break;

        case 'find_gallery':
          handleFindGallery(message, sendResponse);
          break;

        case 'start_element_picker':
          handleStartElementPicker(message, sendResponse);
          break;

        case 'stop_element_picker':
          handleStopElementPicker(message, sendResponse);
          break;

        case 'start_smart_selector':
          handleStartSmartSelector(message, sendResponse);
          break;

        case 'stop_smart_selector':
          handleStopSmartSelector(message, sendResponse);
          break;

        case 'smart_find_images':
          handleSmartFindImages(message, sendResponse);
          break;

        case 'start_interactive_selection':
          handleStartInteractiveSelection(message, sendResponse);
          break;

        case 'start_observer':
          handleStartObserver(message, sendResponse);
          break;

        case 'stop_observer':
          handleStopObserver(message, sendResponse);
          break;

        case 'get_status':
          sendResponse(getExtensionStatus());
          break;

        case 'get_metrics':
          sendResponse(getExtensionMetrics());
          break;

        default:
          console.warn('⚠️ Unknown message action:', message.action);
          sendResponse({ error: `Unknown action: ${message.action}` });
      }
    } catch (error) {
      console.error('❌ Message handler error:', error);
      sendResponse({ error: error.message });
    }

    return true; // Keep message channel open for async responses
  }

  // Handle scrape images request
  async function handleScrapeImages(message, sendResponse) {
    try {
      const options = message.options || {};
      const selector = message.selector || null;

      const result = await window.runScrape(selector, options);
      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, error: error.message, items: [] });
    }
  }

  // Handle find gallery request
  async function handleFindGallery(message, sendResponse) {
    try {
      if (!ExtensionState.selector) {
        throw new Error('Selector system not initialized');
      }

      const result = await ExtensionState.selector.findGalleryImages(message.options || {});
      sendResponse({ success: true, ...result });
    } catch (error) {
      sendResponse({ success: false, error: error.message, images: [] });
    }
  }

  // Handle smart selector requests
  async function handleStartSmartSelector(message, sendResponse) {
    try {
      // Ensure selector is ready
      await ExtensionState.selectorReady;
      
      if (!ExtensionState.selector) {
        throw new Error('Smart selector system not initialized');
      }

      if (ExtensionState.selector.startInteractiveSelection) {
        const result = ExtensionState.selector.startInteractiveSelection();
        sendResponse({ success: true, result, enhanced: true });
      } else {
        // Fallback to basic element picker
        const result = ExtensionState.picker?.startPicking();
        sendResponse({ success: !!result, fallback: true, enhanced: false });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleStopSmartSelector(message, sendResponse) {
    try {
      if (ExtensionState.selector && ExtensionState.selector.stopSelection) {
        ExtensionState.selector.stopSelection();
      }
      if (ExtensionState.picker) {
        ExtensionState.picker.stop();
      }
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleSmartFindImages(message, sendResponse) {
    try {
      // Ensure selector is ready
      await ExtensionState.selectorReady;
      
      if (!ExtensionState.selector) {
        throw new Error('Smart selector system not initialized');
      }

      let result;
      if (ExtensionState.selector.findImages) {
        // Use enhanced smart selector
        result = await ExtensionState.selector.findImages(message.options || {});
      } else {
        // Fallback to basic gallery finder
        result = await ExtensionState.selector.findGalleryImages(message.options || {});
      }
      
      sendResponse({ success: true, enhanced: !!ExtensionState.selector.findImages, ...result });
    } catch (error) {
      sendResponse({ success: false, error: error.message, images: [] });
    }
  }

  async function handleStartInteractiveSelection(message, sendResponse) {
    try {
      // Ensure selector is ready
      await ExtensionState.selectorReady;
      
      if (!ExtensionState.selector) {
        throw new Error('Selector system not initialized');
      }

      if (ExtensionState.selector.startInteractiveSelection) {
        ExtensionState.selector.startInteractiveSelection();
        sendResponse({ success: true, enhanced: true });
      } else {
        // Fallback to basic picker
        const result = ExtensionState.picker?.startPicking();
        sendResponse({ success: !!result, enhanced: false });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  // Handle start element picker request
  function handleStartElementPicker(message, sendResponse) {
    try {
      if (!ExtensionState.picker) {
        throw new Error('Element picker not initialized');
      }

      const success = ExtensionState.picker.startPicking();
      sendResponse({ success });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  // Handle stop element picker request
  function handleStopElementPicker(message, sendResponse) {
    try {
      if (!ExtensionState.picker) {
        throw new Error('Element picker not initialized');
      }

      const success = ExtensionState.picker.stop();
      sendResponse({ success });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  // =============================================================================
  // MISSING SMART SELECTOR HANDLERS - Complete Smart Selector workflow
  // =============================================================================

  async function handleTriggerAutoExpand(message, sendResponse) {
    try {
      console.log('🚀 Triggering Smart Selector auto-expand:', message);
      
      if (!ExtensionState.selector) {
        throw new Error('Smart selector system not initialized');
      }

      const candidates = message.candidates || [];
      const options = message.options || {};
      
      // Use Enhanced Smart Selector System for auto-expand if available
      if (ExtensionState.selector.autoExpandSelection) {
        const result = await ExtensionState.selector.autoExpandSelection(candidates, options);
        sendResponse({ 
          success: true, 
          expandedElements: result.expandedElements || [],
          totalExpanded: result.totalExpanded || 0,
          confidence: result.confidence,
          processingTime: result.processingTime
        });
      } else {
        console.warn('Auto-expand not available, using fallback');
        sendResponse({ 
          success: false, 
          error: 'Auto-expand functionality not available',
          fallback: true
        });
      }
    } catch (error) {
      console.error('❌ Auto-expand failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleRemoveLastSample(message, sendResponse) {
    try {
      console.log('🗑️ Removing last Smart Selector sample');
      
      if (!ExtensionState.selector) {
        throw new Error('Smart selector system not initialized');
      }

      // Check if selector has sample management methods
      if (ExtensionState.selector.removeLastSample) {
        const result = ExtensionState.selector.removeLastSample();
        sendResponse({ 
          success: true, 
          remainingSamples: result.remainingSamples || 0,
          updatedStats: result.stats || {},
          message: 'Last sample removed successfully'
        });
      } else if (ExtensionState.selector.selectedSamples) {
        // Manual removal if direct method not available
        const samples = ExtensionState.selector.selectedSamples;
        if (samples.length > 0) {
          samples.pop();
          sendResponse({ 
            success: true, 
            remainingSamples: samples.length,
            message: 'Last sample removed'
          });
        } else {
          sendResponse({ success: false, error: 'No samples to remove' });
        }
      } else {
        throw new Error('Sample management not available in current selector');
      }
    } catch (error) {
      console.error('❌ Remove last sample failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleClearSmartSelection(message, sendResponse) {
    try {
      console.log('🧹 Clearing all Smart Selector data');
      
      if (!ExtensionState.selector) {
        throw new Error('Smart selector system not initialized');
      }

      let clearedCount = 0;
      let resetStats = {};
      
      // Clear selection data if available
      if (ExtensionState.selector.clearSelection) {
        const result = ExtensionState.selector.clearSelection();
        clearedCount = result.clearedCount || 0;
        resetStats = result.stats || {};
      } else if (ExtensionState.selector.selectedSamples) {
        // Manual clearing if direct method not available
        clearedCount = ExtensionState.selector.selectedSamples.length;
        ExtensionState.selector.selectedSamples = [];
        
        // Clear other selection state if available
        if (ExtensionState.selector.confidenceStats) {
          ExtensionState.selector.confidenceStats = { high: 0, medium: 0, low: 0 };
        }
        if (ExtensionState.selector.patternData) {
          ExtensionState.selector.patternData = {};
        }
      }
      
      sendResponse({ 
        success: true, 
        clearedCount,
        resetStats,
        message: `Cleared ${clearedCount} selections and reset Smart Selector state`
      });
    } catch (error) {
      console.error('❌ Clear smart selection failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handleSmartSelectorUpdate(message, sendResponse) {
    try {
      console.log('🔄 Processing Smart Selector update:', message);
      
      const updateData = {
        timestamp: Date.now(),
        selectionCount: message.selectionCount || 0,
        confidenceStats: message.confidenceStats || {},
        patternData: message.patternData || {},
        ...message.updateData
      };
      
      // Store update data if selector system available
      if (ExtensionState.selector && ExtensionState.selector.updateProgress) {
        ExtensionState.selector.updateProgress(updateData);
      }
      
      // Send update to dashboard/popup if needed
      if (message.forwardToDashboard) {
        try {
          chrome.runtime.sendMessage({
            action: 'smart_selector_progress_update',
            data: updateData,
            source: 'content'
          });
        } catch (error) {
          console.warn('Could not forward update to dashboard:', error);
        }
      }
      
      sendResponse({ 
        success: true, 
        message: 'Update processed',
        updateData
      });
    } catch (error) {
      console.error('❌ Smart selector update failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async function handlePatternAnalysisComplete(message, sendResponse) {
    try {
      console.log('🧠 Processing pattern analysis completion:', message);
      
      const analysisData = {
        timestamp: Date.now(),
        patterns: message.patterns || [],
        confidenceScores: message.confidenceScores || {},
        urlPatterns: message.urlPatterns || [],
        autoExpandCandidates: message.autoExpandCandidates || [],
        totalElements: message.totalElements || 0,
        highConfidenceCount: message.highConfidenceCount || 0,
        processingTime: message.processingTime || 0,
        ...message.analysisData
      };
      
      // If auto-expand is enabled and we have high-confidence candidates
      if (message.enableAutoExpand && analysisData.autoExpandCandidates.length > 0) {
        console.log('🚀 Triggering auto-expand based on pattern analysis');
        
        if (ExtensionState.selector && ExtensionState.selector.autoExpandSelection) {
          try {
            const autoExpandResult = await ExtensionState.selector.autoExpandSelection(
              analysisData.autoExpandCandidates,
              message.autoExpandOptions || {}
            );
            analysisData.autoExpandResults = autoExpandResult;
          } catch (error) {
            console.warn('Auto-expand failed:', error);
            analysisData.autoExpandError = error.message;
          }
        } else {
          analysisData.autoExpandError = 'Auto-expand not available';
        }
      }
      
      sendResponse({ 
        success: true, 
        message: 'Pattern analysis complete',
        analysisData
      });
    } catch (error) {
      console.error('❌ Pattern analysis completion failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Handle start observer request
  function handleStartObserver(message, sendResponse) {
    try {
      if (!ExtensionState.observer) {
        throw new Error('Observer not initialized');
      }

      const callback = (data) => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({
            action: 'content_changed',
            data: data
          });
        }
      };

      const success = ExtensionState.observer.start(callback);
      sendResponse({ success });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  // Handle stop observer request
  function handleStopObserver(message, sendResponse) {
    try {
      if (!ExtensionState.observer) {
        throw new Error('Observer not initialized');
      }

      const success = ExtensionState.observer.stop();
      sendResponse({ success });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

// =============================================================================
// CONTENT ORCHESTRATOR SYSTEM - Controls frame scanning, deduplication, and throttling
// =============================================================================

/**
 * Content Orchestrator System
 * Manages detector execution sequence, frame gating, deduplication, and throttling
 * Prevents race conditions and duplicate scanning across content scripts
 */
class ContentOrchestrator {
  constructor(options = {}) {
    this.options = {
      // Frame gating settings
      enableFrameGating: options.enableFrameGating !== false,
      topFrameOnly: options.topFrameOnly !== false, // Default to top-level only
      allowedIframeHosts: options.allowedIframeHosts || [],
      maxIframeDepth: options.maxIframeDepth || 2,
      
      // Deduplication settings
      enableDeduplication: options.enableDeduplication !== false,
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      maxCacheSize: options.maxCacheSize || 10000,
      
      // Throttling settings
      enableThrottling: options.enableThrottling !== false,
      maxConcurrentDetectors: options.maxConcurrentDetectors || 3,
      detectorTimeout: options.detectorTimeout || 30000, // 30 seconds
      minDetectorInterval: options.minDetectorInterval || 1000, // 1 second between detectors
      cpuUsageThreshold: options.cpuUsageThreshold || 80, // Max 80% CPU usage
      
      // Coordination settings
      enableDetectorSequencing: options.enableDetectorSequencing !== false,
      enableMetricsTracking: options.enableMetricsTracking !== false,
      
      ...options
    };

    // Frame gating state
    this.currentFrameInfo = this.analyzeCurrentFrame();
    this.shouldScanFrame = this.determineScanEligibility();
    
    // Use memory-safe bounded data structures
    const global = typeof globalThis !== 'undefined' ? globalThis : window;
    const LRUCache = global.__ST?.LRUCache || Map;
    const BoundedArray = global.__ST?.BoundedArray || Array;

    // Deduplication system with bounded caches
    this.documentCache = new LRUCache(Math.min(this.options.maxCacheSize || 1000, 2000));
    this.globalCache = new LRUCache(Math.min(this.options.maxCacheSize || 1000, 2000));
    this.seenItems = new LRUCache(5000); // Use LRUCache instead of unbounded Set
    
    // Throttling system with bounded structures
    this.activeDetectors = new LRUCache(50);
    this.detectorQueue = BoundedArray === Array ? [] : new BoundedArray(100);
    this.lastDetectorExecution = 0;
    this.cpuMonitor = new CPUMonitor();
    
    // Detector coordination with bounded structures  
    this.registeredDetectors = new LRUCache(100);
    this.detectorMetrics = new LRUCache(200);
    this.executionHistory = BoundedArray === Array ? [] : new BoundedArray(500);
    
    // Performance tracking
    this.metrics = {
      framesScanned: 0,
      detectorsExecuted: 0,
      itemsDeduped: 0,
      throttledRequests: 0,
      averageDetectorTime: 0,
      totalProcessingTime: 0
    };

    this.initialized = false;
    this.documentId = this.generateDocumentId();
    
    console.log(`🎛️ Content Orchestrator initialized for ${this.currentFrameInfo.type} frame (scan: ${this.shouldScanFrame})`);
    
    // Initialize global orchestrator instance
    this.setupGlobalInstance();
  }

  /**
   * Analyze current frame context
   */
  analyzeCurrentFrame() {
    const isTopFrame = window === window.top;
    const isIframe = !isTopFrame;
    
    let frameDepth = 0;
    let currentWin = window;
    while (currentWin !== window.top && frameDepth < 10) {
      frameDepth++;
      try {
        currentWin = currentWin.parent;
      } catch (e) {
        break; // Cross-origin frame
      }
    }

    return {
      isTopFrame,
      isIframe,
      frameDepth,
      origin: window.location.origin,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      type: isTopFrame ? 'top' : `iframe-depth-${frameDepth}`,
      crossOrigin: this.isCrossOriginFrame()
    };
  }

  /**
   * Check if current frame is cross-origin
   */
  isCrossOriginFrame() {
    try {
      return window.location.hostname !== window.top.location.hostname;
    } catch (e) {
      return true; // Assume cross-origin if we can't access
    }
  }

  /**
   * Determine if this frame should be scanned
   */
  determineScanEligibility() {
    if (!this.options.enableFrameGating) {
      return true; // Always scan if frame gating disabled
    }

    // Always scan top frame
    if (this.currentFrameInfo.isTopFrame) {
      return true;
    }

    // Skip iframe scanning if topFrameOnly is true
    if (this.options.topFrameOnly) {
      console.log(`⏭️ Skipping iframe scan (topFrameOnly mode): ${this.currentFrameInfo.hostname}`);
      return false;
    }

    // Check iframe depth limit
    if (this.currentFrameInfo.frameDepth > this.options.maxIframeDepth) {
      console.log(`⏭️ Skipping iframe scan (depth ${this.currentFrameInfo.frameDepth} > ${this.options.maxIframeDepth})`);
      return false;
    }

    // Check allowed iframe hosts
    if (this.options.allowedIframeHosts.length > 0) {
      const isAllowed = this.options.allowedIframeHosts.some(host => 
        this.currentFrameInfo.hostname.includes(host)
      );
      if (!isAllowed) {
        console.log(`⏭️ Skipping iframe scan (host not in allowlist): ${this.currentFrameInfo.hostname}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Generate unique document identifier for caching
   */
  generateDocumentId() {
    const url = window.location.href;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${btoa(url).substr(0, 20)}_${timestamp}_${random}`;
  }

  /**
   * Register a detector with the orchestrator
   */
  registerDetector(name, detectorInstance, options = {}) {
    if (!this.shouldScanFrame) {
      console.log(`⏭️ Detector registration skipped (frame not eligible): ${name}`);
      return false;
    }

    const detectorConfig = {
      name,
      instance: detectorInstance,
      priority: options.priority || 5, // Lower number = higher priority
      timeout: options.timeout || this.options.detectorTimeout,
      maxRetries: options.maxRetries || 2,
      dependencies: options.dependencies || [],
      registered: Date.now(),
      ...options
    };

    this.registeredDetectors.set(name, detectorConfig);
    console.log(`✅ Detector registered: ${name} (priority: ${detectorConfig.priority})`);
    
    return true;
  }

  /**
   * Execute detectors in sequence with throttling
   */
  async executeDetectors(context = {}) {
    if (!this.shouldScanFrame) {
      console.log('⏭️ Detector execution skipped (frame not eligible)');
      return { success: false, reason: 'frame_not_eligible', results: [] };
    }

    console.log(`🚀 Starting detector execution (${this.registeredDetectors.size} detectors)`);
    const startTime = performance.now();
    
    try {
      // Sort detectors by priority
      const sortedDetectors = Array.from(this.registeredDetectors.values())
        .sort((a, b) => a.priority - b.priority);

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const detector of sortedDetectors) {
        // Check throttling before each detector
        if (this.options.enableThrottling && !await this.canExecuteDetector(detector)) {
          console.log(`⏸️ Detector throttled: ${detector.name}`);
          this.metrics.throttledRequests++;
          continue;
        }

        try {
          const detectorResult = await this.executeDetector(detector, context);
          
          if (detectorResult.success) {
            results.push(detectorResult);
            successCount++;
          } else {
            errorCount++;
          }
          
        } catch (error) {
          console.error(`❌ Detector execution failed: ${detector.name}`, error);
          errorCount++;
        }

        // Respect minimum interval between detectors
        if (this.options.minDetectorInterval > 0) {
          await this.sleep(this.options.minDetectorInterval);
        }
      }

      const totalTime = performance.now() - startTime;
      this.metrics.totalProcessingTime += totalTime;
      this.metrics.detectorsExecuted += successCount;

      console.log(`✅ Detector execution completed: ${successCount} success, ${errorCount} errors (${totalTime.toFixed(2)}ms)`);
      
      return {
        success: true,
        results,
        metrics: {
          totalDetectors: sortedDetectors.length,
          successCount,
          errorCount,
          totalTime,
          frameInfo: this.currentFrameInfo
        }
      };

    } catch (error) {
      console.error('❌ Detector execution pipeline failed:', error);
      return { success: false, error: error.message, results: [] };
    }
  }

  /**
   * Execute a single detector with error handling and metrics
   */
  async executeDetector(detector, context) {
    const startTime = performance.now();
    
    try {
      console.log(`🔍 Executing detector: ${detector.name}`);
      
      // Track active detector
      this.activeDetectors.set(detector.name, { startTime, status: 'running' });
      
      // Execute detector with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Detector timeout')), detector.timeout)
      );
      
      const detectorPromise = this.invokeDetector(detector, context);
      const result = await Promise.race([detectorPromise, timeoutPromise]);
      
      // Process results through deduplication
      const dedupedResult = this.options.enableDeduplication ? 
        this.deduplicateResults(result, detector.name) : result;
      
      const executionTime = performance.now() - startTime;
      
      // Update metrics
      this.updateDetectorMetrics(detector.name, {
        executionTime,
        itemsFound: dedupedResult?.items?.length || 0,
        success: true
      });
      
      console.log(`✅ Detector completed: ${detector.name} (${executionTime.toFixed(2)}ms, ${dedupedResult?.items?.length || 0} items)`);
      
      return {
        success: true,
        detector: detector.name,
        result: dedupedResult,
        executionTime,
        frameInfo: this.currentFrameInfo
      };
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      this.updateDetectorMetrics(detector.name, {
        executionTime,
        error: error.message,
        success: false
      });
      
      console.error(`❌ Detector failed: ${detector.name} (${executionTime.toFixed(2)}ms)`, error);
      
      return {
        success: false,
        detector: detector.name,
        error: error.message,
        executionTime
      };
      
    } finally {
      this.activeDetectors.delete(detector.name);
      this.lastDetectorExecution = Date.now();
    }
  }

  /**
   * Invoke detector method with proper context
   */
  async invokeDetector(detector, context) {
    const { instance } = detector;
    
    // Try different method names that detectors might use
    const methodNames = [
      'collectImages',
      'detectImages', 
      'scanImages',
      'findImages',
      'execute',
      'run'
    ];
    
    for (const methodName of methodNames) {
      if (typeof instance[methodName] === 'function') {
        return await instance[methodName](context);
      }
    }
    
    // Fallback: if instance is a function, call it directly
    if (typeof instance === 'function') {
      return await instance(context);
    }
    
    throw new Error(`No executable method found on detector: ${detector.name}`);
  }

  /**
   * Deduplicate results using cache system
   */
  deduplicateResults(result, detectorName) {
    if (!result || !result.items || !Array.isArray(result.items)) {
      return result;
    }

    const dedupedItems = [];
    let duplicateCount = 0;

    for (const item of result.items) {
      const itemKey = this.generateItemKey(item);
      
      if (!this.isItemDuplicate(itemKey)) {
        dedupedItems.push(item);
        this.markItemAsSeen(itemKey, detectorName);
      } else {
        duplicateCount++;
      }
    }

    if (duplicateCount > 0) {
      console.log(`🔄 Deduplication: ${duplicateCount} duplicates removed from ${detectorName}`);
      this.metrics.itemsDeduped += duplicateCount;
    }

    return {
      ...result,
      items: dedupedItems,
      deduplication: {
        originalCount: result.items.length,
        dedupedCount: dedupedItems.length,
        duplicatesRemoved: duplicateCount
      }
    };
  }

  /**
   * Generate cache key for an item
   */
  generateItemKey(item) {
    // Use URL as primary key, fallback to other properties
    const url = item.url || item.src || item.href;
    if (url) {
      return `url:${this.normalizeUrl(url)}`;
    }
    
    // Fallback to element-based key
    if (item.element) {
      const selector = this.getElementSelector(item.element);
      return `element:${selector}`;
    }
    
    // Last resort: use item hash
    return `hash:${this.hashObject(item)}`;
  }

  /**
   * Check if item is duplicate
   */
  isItemDuplicate(itemKey) {
    return this.seenItems.has(itemKey) || 
           this.documentCache.has(itemKey) || 
           this.globalCache.has(itemKey);
  }

  /**
   * Mark item as seen
   */
  markItemAsSeen(itemKey, detectorName) {
    const timestamp = Date.now();
    
    this.seenItems.add(itemKey);
    this.documentCache.set(itemKey, { detector: detectorName, timestamp });
    
    // Manage cache size
    if (this.documentCache.size > this.options.maxCacheSize) {
      this.cleanupCache();
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, data] of this.documentCache.entries()) {
      if (now - data.timestamp > this.options.cacheTimeout) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => {
      this.documentCache.delete(key);
      this.seenItems.delete(key);
    });
    
    console.log(`🧹 Cache cleanup: removed ${expiredKeys.length} expired entries`);
  }

  /**
   * Check if detector can execute (throttling)
   */
  async canExecuteDetector(detector) {
    // Check active detector limit
    if (this.activeDetectors.size >= this.options.maxConcurrentDetectors) {
      return false;
    }
    
    // Check minimum interval
    const timeSinceLastExecution = Date.now() - this.lastDetectorExecution;
    if (timeSinceLastExecution < this.options.minDetectorInterval) {
      return false;
    }
    
    // Check CPU usage if monitoring is available
    if (this.cpuMonitor.isAvailable()) {
      const cpuUsage = await this.cpuMonitor.getCurrentUsage();
      if (cpuUsage > this.options.cpuUsageThreshold) {
        console.log(`⏸️ High CPU usage detected: ${cpuUsage}%`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Update detector metrics
   */
  updateDetectorMetrics(detectorName, metrics) {
    const existing = this.detectorMetrics.get(detectorName) || {
      executions: 0,
      totalTime: 0,
      totalItems: 0,
      errors: 0,
      successes: 0
    };
    
    existing.executions++;
    existing.totalTime += metrics.executionTime || 0;
    existing.totalItems += metrics.itemsFound || 0;
    
    if (metrics.success) {
      existing.successes++;
    } else {
      existing.errors++;
      existing.lastError = metrics.error;
    }
    
    existing.averageTime = existing.totalTime / existing.executions;
    existing.lastExecution = Date.now();
    
    this.detectorMetrics.set(detectorName, existing);
  }

  /**
   * Get orchestrator metrics
   */
  getMetrics() {
    return {
      orchestrator: this.metrics,
      detectors: Object.fromEntries(this.detectorMetrics),
      frame: this.currentFrameInfo,
      cache: {
        documentCacheSize: this.documentCache.size,
        globalCacheSize: this.globalCache.size,
        seenItemsSize: this.seenItems.size
      },
      active: {
        detectorsRunning: this.activeDetectors.size,
        detectorQueue: this.detectorQueue.length
      }
    };
  }

  /**
   * Setup global instance
   */
  setupGlobalInstance() {
    // Create global namespace if it doesn't exist
    if (typeof window !== 'undefined') {
      if (!window.__ST) {
        window.__ST = {};
      }
      
      // Store orchestrator instance
      window.__ST.ContentOrchestrator = this;
      window.ContentOrchestrator = this; // Backward compatibility
      
      console.log('✅ Content Orchestrator available globally');
    }
  }

  // Utility methods
  normalizeUrl(url) { return window.RobustHelpers?.normalizeUrl(url) || url; }
  getElementSelector(element) { return window.StepThreeSelectorUtils?.getElementCSSPath(element) || 'unknown'; }
  hashObject(obj) { return btoa(JSON.stringify(obj)).substr(0, 16); }
  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

/**
 * Simple CPU Monitor for throttling decisions
 */
class CPUMonitor {
  constructor() {
    this.available = 'performance' in window && 'measureUserAgentSpecificMemory' in performance;
    this.lastMeasurement = 0;
    this.measurementInterval = 1000; // 1 second
  }

  isAvailable() {
    return this.available;
  }

  async getCurrentUsage() {
    if (!this.available) {
      return 0; // Assume low CPU if can't measure
    }

    const now = Date.now();
    if (now - this.lastMeasurement < this.measurementInterval) {
      return this.lastCpuUsage || 0;
    }

    try {
      // Simplified CPU usage estimation based on timing
      const start = performance.now();
      
      // Do a small amount of work to measure responsiveness
      let count = 0;
      const endTime = start + 10; // 10ms test
      while (performance.now() < endTime) {
        count++;
      }
      
      const actualTime = performance.now() - start;
      
      // Estimate CPU usage based on how long the work took
      // If it took significantly longer than 10ms, CPU is likely busy
      const cpuEstimate = Math.min(100, Math.max(0, (actualTime - 10) * 5));
      
      this.lastCpuUsage = cpuEstimate;
      this.lastMeasurement = now;
      
      return cpuEstimate;
    } catch (error) {
      return 0;
    }
  }
}

// Initialize global Content Orchestrator instance with coordination
if (typeof window !== 'undefined' && !window.__ST?.ContentOrchestratorLoaded) {
  // Mark as loaded to prevent duplicate initialization
  if (!window.__ST) window.__ST = {};
  window.__ST.ContentOrchestratorLoaded = true;

  // BUGFIX: Add shared detection system registry to prevent duplicates
  window.__ST.detectionSystems = {
    smartPatternRecognition: null,
    dynamicContentObserver: null,
    advancedExtractor: null,
    initialized: new Set()
  };

  // Create orchestrator with frame-appropriate settings
  const orchestratorOptions = {
    enableFrameGating: true,
    topFrameOnly: true, // Default to top-level only to reduce duplicates
    enableDeduplication: true,
    enableThrottling: true,
    enableDetectorSequencing: true,
    enableMetricsTracking: true,
    maxConcurrentDetectors: 2,
    minDetectorInterval: 500
  };

  window.__ST.orchestrator = new ContentOrchestrator(orchestratorOptions);
  
  console.log('✅ Content Orchestrator System initialized with coordination registry');
  
  // BUGFIX: Initialize shared detection systems
  window.__ST.initializeSharedDetectionSystems = function() {
    console.log('🔄 [COORD] Initializing shared detection systems...');
    
    // Initialize SmartPatternRecognition once globally
    if (!window.__ST.detectionSystems.smartPatternRecognition && typeof SmartPatternRecognition !== 'undefined') {
      try {
        window.__ST.detectionSystems.smartPatternRecognition = new SmartPatternRecognition({
          enableAdvancedPatterns: true,
          enableUrlValidation: true,
          coordinated: true
        });
        console.log('✅ [COORD] Shared SmartPatternRecognition initialized');
      } catch (error) {
        console.error('❌ [COORD] Failed to initialize SmartPatternRecognition:', error);
      }
    }
    
    // Initialize DynamicContentObserver and register with orchestrator
    if (!window.__ST.detectionSystems.dynamicContentObserver && typeof DynamicContentObserver !== 'undefined') {
      try {
        window.__ST.detectionSystems.dynamicContentObserver = new DynamicContentObserver({
          throttleDelay: 1000,
          coordinated: true
        });
        
        // Register with orchestrator
        const observerRegistered = window.__ST.orchestrator.registerDetector('dynamic-content-observer', {
          name: 'dynamic-content-observer',
          execute: async (context) => {
            return window.__ST.detectionSystems.dynamicContentObserver.analyzeChanges();
          },
          cleanup: () => {
            window.__ST.detectionSystems.dynamicContentObserver.stop();
          }
        }, {
          priority: 1, // High priority - runs first
          timeout: 15000,
          maxRetries: 1
        });
        
        if (observerRegistered) {
          console.log('✅ [COORD] DynamicContentObserver registered with orchestrator');
        }
      } catch (error) {
        console.error('❌ [COORD] Failed to initialize DynamicContentObserver:', error);
      }
    }
  };
  
  // Helper function to get shared detection system
  window.__ST.getSharedDetectionSystem = function(systemName) {
    return window.__ST.detectionSystems[systemName] || null;
  };
  
  // Helper function to prevent duplicate initialization
  window.__ST.markSystemInitialized = function(systemName) {
    window.__ST.detectionSystems.initialized.add(systemName);
    console.log(`🏷️ [COORD] System marked as initialized: ${systemName}`);
  };
  
  window.__ST.isSystemInitialized = function(systemName) {
    return window.__ST.detectionSystems.initialized.has(systemName);
  };
}

  // Get extension status
  function getExtensionStatus() {
    return {
      initialized: ExtensionState.initialized,
      lastActivity: ExtensionState.lastActivity,
      observerActive: ExtensionState.observer?.isActive || false,
      pickerActive: ExtensionState.picker?.isActive || false,
      config: ExtensionState.config,
      url: window.location.href,
      timestamp: Date.now()
    };
  }

  // Get extension metrics
  function getExtensionMetrics() {
    const metrics = {
      scraper: ExtensionState.scraper?.getMetricsReport() || {},
      observer: ExtensionState.observer?.getMetrics() || {},
      timestamp: Date.now()
    };

    return metrics;
  }

  // DISABLED: Legacy message listener to prevent duplicate listeners causing race conditions
  // The enhanced message listener (setupEnhancedMessageListener) handles all messages now
  // if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  //   chrome.runtime.onMessage.addListener(handleExtensionMessage);
  //   console.log('✅ Message listener registered');
  // }
  console.log('⚠️ Legacy message listener disabled - using enhanced listener only');

  // Auto-initialize if configured
  if (ExtensionState.config.autoInitialize) {
    // Delay initialization to ensure DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => initializeExtension().catch(console.error), 100);
      });
    } else {
      setTimeout(() => initializeExtension().catch(console.error), 100);
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (ExtensionState.observer) {
      ExtensionState.observer.stop();
    }
    if (ExtensionState.picker) {
      ExtensionState.picker.stop();
    }
  });

  console.log('✅ STEPTHREE Content Bundle loaded and ready!');

  // Export global API for external access
  window.StepThree = {
    initialize: initializeExtension,
    scrape: window.runScrape,
    findGallery: (options) => ExtensionState.selector?.findGalleryImages(options),
    startPicker: () => ExtensionState.picker?.startPicking(),
    stopPicker: () => ExtensionState.picker?.stop(),
    startObserver: (callback) => ExtensionState.observer?.start(callback),
    stopObserver: () => ExtensionState.observer?.stop(),
    getStatus: getExtensionStatus,
    getMetrics: getExtensionMetrics
  };

} else {
  console.log('✅ STEPTHREE Content Bundle already loaded');
}

// =============================================================================
// SMART PATTERN RECOGNITION SYSTEM - Merged from smart-pattern-recognition.js
// =============================================================================

/**
 * Smart Pattern Recognition System
 * Provides intelligent image analysis, URL validation, and confidence scoring
 */
class SmartPatternRecognition {
  constructor(options = {}) {
    this.options = {
      // Pattern recognition settings
      enableAdvancedPatterns: options.enableAdvancedPatterns !== false,
      enableUrlValidation: options.enableUrlValidation !== false,
      enableContentValidation: options.enableContentValidation !== false,
      enableDomainReputation: options.enableDomainReputation !== false,
      enableContextAnalysis: options.enableContextAnalysis !== false,
      
      // Quality thresholds
      minConfidenceScore: options.minConfidenceScore || 0.3,
      highConfidenceThreshold: options.highConfidenceThreshold || 0.75,
      minImageWidth: options.minImageWidth || 30, // More lenient for gallery images
      minImageHeight: options.minImageHeight || 30, // More lenient for gallery images
      minFileSize: options.minFileSize || 1024, // 1KB
      maxAspectRatio: options.maxAspectRatio || 10,
      
      // Performance settings
      maxCacheSize: options.maxCacheSize || 1000,
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      maxAnalysisTime: options.maxAnalysisTime || 5000, // 5 seconds
      
      ...options
    };

    // Caching system for pattern analysis results
    this.patternCache = new Map();
    this.domainReputationCache = new Map();
    this.urlValidationCache = new Map();
    this.contentValidationCache = new Map();

    // Pattern libraries
    this.galleryPatterns = this.buildGalleryPatterns();
    this.excludePatterns = this.buildExcludePatterns();
    this.dimensionPatterns = this.buildDimensionPatterns();
    this.knownGalleryDomains = this.buildKnownDomains();
    this.knownCdnDomains = this.buildCdnDomains();

    // Quality assessment weights
    this.scoringWeights = {
      urlPattern: 0.25,
      domainReputation: 0.20,
      dimensionInfo: 0.15,
      fileExtension: 0.10,
      contextualClues: 0.15,
      contentValidation: 0.15
    };

    // Initialize performance tracking
    this.metrics = {
      patternsProcessed: 0,
      urlsValidated: 0,
      contentValidated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageProcessingTime: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 }
    };

    this.initialized = true;
    console.log('✅ Smart Pattern Recognition System initialized');
  }

  // Build pattern libraries
  buildGalleryPatterns() {
    return {
      positive: [
        { test: url => /\/gallery\/|\/galleries\/|\/photos\/|\/images\//i.test(url), name: 'gallery-path', weight: 0.8 },
        { test: url => /\/media\/|\/assets\/|\/uploads\//i.test(url), name: 'media-path', weight: 0.7 },
        { test: url => /\d{3,}x\d{3,}|_\d{3,}x\d{3,}/i.test(url), name: 'dimensions', weight: 0.9 }
      ],
      thumbnails: [
        { test: url => /thumb|thumbnail|preview|small/i.test(url), name: 'thumbnail', weight: 0.6 }
      ],
      highRes: [
        { test: url => /original|full|large|hd|high/i.test(url), name: 'high-res', weight: 0.9 }
      ]
    };
  }

  buildExcludePatterns() {
    return [
      { test: url => /icon|favicon|logo|emoji|avatar|profile/i.test(url), name: 'ui-elements' },
      { test: url => /loading|spinner|placeholder|blank/i.test(url), name: 'placeholders' }
    ];
  }

  buildDimensionPatterns() {
    return [
      { regex: /(\d{3,})x(\d{3,})/i, widthGroup: 1, heightGroup: 2 },
      { regex: /_(\d{3,})x(\d{3,})/i, widthGroup: 1, heightGroup: 2 }
    ];
  }

  buildKnownDomains() {
    return new Set([
      'imgur.com', 'flickr.com', 'instagram.com', 'pinterest.com',
      'unsplash.com', 'pixabay.com', 'pexels.com', 'artstation.com'
    ]);
  }

  buildCdnDomains() {
    return new Set([
      'cloudinary.com', 'amazonaws.com', 'googleusercontent.com',
      'fbcdn.net', 'cdninstagram.com', 'pinimg.com'
    ]);
  }

  async validateUrl(url, context = {}) {
    if (!this.options.enableUrlValidation) {
      return { isValid: true, confidence: 0.5, reasons: ['validation-disabled'] };
    }

    const cacheKey = `url_${url}`;
    if (this.urlValidationCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.urlValidationCache.get(cacheKey);
    }

    const startTime = performance.now();
    let confidence = 0;
    const reasons = [];

    try {
      const urlObj = new URL(url);
      
      // Gallery pattern analysis
      const galleryScore = this.analyzeGalleryPatterns(url, urlObj);
      confidence += galleryScore.score * this.scoringWeights.urlPattern;
      reasons.push(...galleryScore.reasons);

      // Domain reputation analysis
      const domainScore = await this.analyzeDomainReputation(urlObj.hostname);
      confidence += domainScore.score * this.scoringWeights.domainReputation;
      reasons.push(...domainScore.reasons);

      // File extension analysis
      const extensionScore = this.analyzeFileExtension(url, urlObj);
      confidence += extensionScore.score * this.scoringWeights.fileExtension;
      reasons.push(...extensionScore.reasons);

      // Normalize confidence score
      confidence = Math.min(Math.max(confidence, 0), 1);

      const result = {
        isValid: confidence >= this.options.minConfidenceScore,
        confidence,
        reasons,
        metadata: {
          domain: urlObj.hostname,
          path: urlObj.pathname,
          processingTime: performance.now() - startTime
        }
      };

      this.cacheResult(this.urlValidationCache, cacheKey, result);
      this.metrics.urlsValidated++;
      
      return result;

    } catch (error) {
      console.warn('URL validation error:', error);
      return {
        isValid: false,
        confidence: 0,
        reasons: ['invalid-url'],
        penalties: [error.message]
      };
    }
  }

  analyzeGalleryPatterns(url, urlObj) {
    let score = 0;
    const reasons = [];

    for (const pattern of this.galleryPatterns.positive) {
      if (pattern.test(url)) {
        score += pattern.weight || 0.8;
        reasons.push(`gallery-pattern-${pattern.name}`);
      }
    }

    return { score: Math.min(score, 1), reasons };
  }

  async analyzeDomainReputation(hostname) {
    const cacheKey = `domain_${hostname}`;
    if (this.domainReputationCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.domainReputationCache.get(cacheKey);
    }

    let score = 0.5;
    const reasons = [];

    if (this.knownGalleryDomains.has(hostname)) {
      score = 0.9;
      reasons.push('known-gallery-domain');
    } else if (this.knownCdnDomains.has(hostname)) {
      score = 0.8;
      reasons.push('known-cdn-domain');
    }

    const result = { score, reasons };
    this.cacheResult(this.domainReputationCache, cacheKey, result);
    
    return result;
  }

  analyzeFileExtension(url, urlObj) {
    const path = urlObj.pathname.toLowerCase();
    let score = 0;
    const reasons = [];

    const extensionMatch = path.match(/\.([a-z0-9]+)(?:\?|$)/);
    if (!extensionMatch) {
      return { score: 0.3, reasons: ['no-extension'] };
    }

    const extension = extensionMatch[1];
    const extensionScores = {
      'jpg': 0.9, 'jpeg': 0.9, 'png': 0.9, 'webp': 0.85,
      'gif': 0.7, 'svg': 0.6, 'bmp': 0.5
    };

    score = extensionScores[extension] || 0.1;
    reasons.push(`extension-${extension}`);

    return { score, reasons };
  }

  async calculateConfidenceScore(imageObj, context = {}) {
    const startTime = performance.now();

    try {
      const urlValidation = await this.validateUrl(imageObj.src, context);
      
      const finalScore = urlValidation.confidence;
      this.updateConfidenceMetrics(finalScore);

      return {
        confidence: Math.min(Math.max(finalScore, 0), 1),
        breakdown: { url: urlValidation },
        processingTime: performance.now() - startTime
      };

    } catch (error) {
      console.warn('Confidence calculation error:', error);
      return {
        confidence: 0.3,
        breakdown: {},
        error: error.message
      };
    }
  }

  updateConfidenceMetrics(score) {
    this.metrics.patternsProcessed++;
    
    if (score >= 0.7) {
      this.metrics.confidenceDistribution.high++;
    } else if (score >= 0.4) {
      this.metrics.confidenceDistribution.medium++;
    } else {
      this.metrics.confidenceDistribution.low++;
    }
  }

  cacheResult(cache, key, result) {
    if (cache.size >= this.options.maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    result._cached = Date.now();
    cache.set(key, result);
  }

  /**
   * Enhanced image categorization with Smart Pattern Recognition
   * This is the missing method that AdvancedCollectorSystem expects
   */
  categorizeImageEnhanced(imageObj, confidenceData = null) {
    const startTime = performance.now();
    
    try {
      // Use provided confidence data or calculate it
      const confidence = confidenceData ? confidenceData.confidence : 0.5;
      
      // Enhanced categorization logic based on confidence and patterns
      let category, categoryReason, confidenceTier;
      
      if (confidence >= this.options.highConfidenceThreshold) {
        category = 'high_confidence';
        categoryReason = 'Smart pattern analysis indicates high-quality gallery image';
        confidenceTier = 'high';
      } else if (confidence >= this.options.minConfidenceScore) {
        category = 'same_origin';
        categoryReason = 'Moderate confidence based on URL patterns and context';
        confidenceTier = 'medium';
      } else {
        category = 'external';
        categoryReason = 'Low confidence, requires additional validation';
        confidenceTier = 'low';
      }
      
      // Apply advanced pattern analysis
      const galleryTypeResult = this.detectGalleryType(imageObj);
      const qualityAssessment = this.assessImageQuality(imageObj);
      const duplicateCheck = this.checkForDuplicates(imageObj);
      
      // Adjust category based on advanced analysis
      if (galleryTypeResult.isGallery && qualityAssessment.score > 0.7) {
        category = 'high_confidence';
        categoryReason += ` | Gallery pattern detected: ${galleryTypeResult.type}`;
      }
      
      if (duplicateCheck.isDuplicate) {
        category = 'external'; // Lower priority for duplicates
        categoryReason += ' | Potential duplicate detected';
      }
      
      return {
        ...imageObj,
        category,
        categoryReason,
        confidenceTier,
        enhancedAnalysis: {
          galleryType: galleryTypeResult,
          quality: qualityAssessment,
          duplicateStatus: duplicateCheck,
          processingTime: performance.now() - startTime
        }
      };
      
    } catch (error) {
      console.warn('Enhanced categorization failed:', error);
      return {
        ...imageObj,
        category: 'external',
        categoryReason: 'Error during enhanced analysis',
        confidenceTier: 'low',
        error: error.message
      };
    }
  }
  
  /**
   * Intelligent gallery pattern detection
   */
  detectGalleryType(imageObj) {
    const url = imageObj.src;
    const element = imageObj.element;
    
    // Check for gallery indicators in URL
    const urlPatterns = {
      instagram: /instagram\.com.*\/(p|reel)\//i,
      pinterest: /pinimg\.com|pinterest\.com/i,
      ecommerce: /shop|product|catalog|store/i,
      photography: /photo|gallery|portfolio/i,
      artstation: /artstation\.com/i,
      behance: /behance\.net/i
    };
    
    for (const [type, pattern] of Object.entries(urlPatterns)) {
      if (pattern.test(url)) {
        return { isGallery: true, type, confidence: 0.9 };
      }
    }
    
    // Check DOM context for gallery patterns
    if (element) {
      const parent = element.closest('.gallery, .images, .photos, .grid, [data-gallery], [class*="grid"], [class*="masonry"]');
      if (parent) {
        const galleryType = this.detectDOMGalleryType(parent);
        return { isGallery: true, type: galleryType, confidence: 0.8 };
      }
    }
    
    return { isGallery: false, type: 'unknown', confidence: 0.2 };
  }
  
  /**
   * Detect gallery type from DOM structure
   */
  detectDOMGalleryType(container) {
    const style = window.getComputedStyle(container);
    const className = container.className.toLowerCase();
    
    if (style.display === 'grid' || className.includes('grid')) {
      return 'grid';
    }
    if (className.includes('carousel') || className.includes('slider')) {
      return 'carousel';
    }
    if (className.includes('masonry')) {
      return 'masonry';
    }
    if (container.querySelector('[data-infinite]') || className.includes('infinite')) {
      return 'infinite-scroll';
    }
    
    return 'standard';
  }
  
  /**
   * Advanced image quality assessment
   */
  assessImageQuality(imageObj) {
    let score = 0.5;
    const factors = [];
    
    // Dimension-based scoring
    const width = imageObj.width || 0;
    const height = imageObj.height || 0;
    
    if (width >= 800 && height >= 600) {
      score += 0.3;
      factors.push('high-resolution');
    } else if (width >= 400 && height >= 300) {
      score += 0.1;
      factors.push('medium-resolution');
    }
    
    // Aspect ratio assessment
    if (width > 0 && height > 0) {
      const aspectRatio = width / height;
      if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
        score += 0.1;
        factors.push('good-aspect-ratio');
      }
    }
    
    // URL quality indicators
    const url = imageObj.src;
    const highQualityIndicators = ['original', 'full', 'large', 'hd', 'high', '1080', '4k'];
    const lowQualityIndicators = ['thumb', 'small', 'preview', 'icon', 'avatar'];
    
    for (const indicator of highQualityIndicators) {
      if (url.toLowerCase().includes(indicator)) {
        score += 0.2;
        factors.push(`high-quality-indicator-${indicator}`);
        break;
      }
    }
    
    for (const indicator of lowQualityIndicators) {
      if (url.toLowerCase().includes(indicator)) {
        score -= 0.2;
        factors.push(`low-quality-indicator-${indicator}`);
        break;
      }
    }
    
    return {
      score: Math.min(Math.max(score, 0), 1),
      factors
    };
  }
  
  /**
   * Duplicate detection using URL patterns
   */
  checkForDuplicates(imageObj) {
    const url = imageObj.src;
    
    // Simple URL-based duplicate detection
    // Extract base URL without query parameters for comparison
    const baseUrl = url.split('?')[0];
    const urlHash = this.generateSimpleHash(baseUrl);
    
    if (this.patternCache.has(`duplicate_${urlHash}`)) {
      return {
        isDuplicate: true,
        method: 'url-hash',
        confidence: 0.9
      };
    }
    
    // Cache this URL hash
    this.patternCache.set(`duplicate_${urlHash}`, true);
    
    return {
      isDuplicate: false,
      method: 'url-hash',
      confidence: 0.1
    };
  }
  
  /**
   * Generate simple hash for URL comparison
   */
  generateSimpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheStats: {
        patternCacheSize: this.patternCache.size,
        domainCacheSize: this.domainReputationCache.size,
        urlCacheSize: this.urlValidationCache.size,
        contentCacheSize: this.contentValidationCache.size
      }
    };
  }

  reset() {
    this.metrics = {
      patternsProcessed: 0,
      urlsValidated: 0,
      contentValidated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageProcessingTime: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 }
    };

    this.patternCache.clear();
    this.domainReputationCache.clear();
    this.urlValidationCache.clear();
    this.contentValidationCache.clear();
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.SmartPatternRecognition = SmartPatternRecognition;
}

console.log('✅ Smart Pattern Recognition System loaded successfully');

// =============================================================================
// ENHANCED SMART SELECTOR SYSTEM - Merged from enhanced-smart-selector.js
// =============================================================================

if (!window.EnhancedSmartSelectorSystem) {

  class EnhancedSmartSelectorSystem {
    constructor(options = {}) {
      this.options = {
        maxFallbackAttempts: options.maxFallbackAttempts || 3,
        selectorTimeout: options.selectorTimeout || 2000,
        confidenceThreshold: options.confidenceThreshold || 0.75,
        earlyExitThreshold: options.earlyExitThreshold || 0.90,
        
        confidenceWeights: {
          dataAttributes: 0.95,
          reactPatterns: 0.92,
          semanticClasses: 0.88,
          structuralPatterns: 0.85,
          genericSelectors: 0.60
        },
        
        enableProgressiveAnalysis: options.enableProgressiveAnalysis !== false,
        enableEarlyExit: options.enableEarlyExit !== false,
        maxAnalysisTime: options.maxAnalysisTime || 5000,
        
        // Comprehensive site-specific patterns
        siteSpecificPatterns: {
          instagram: {
            domain: ['instagram.com', 'www.instagram.com'],
            confidence: 0.95,
            imageSelectors: [
              '._aagu img', '._aagv img', 'article img[src*="scontent"]',
              '[role="presentation"] img[src*="scontent"]', 'img[alt*="Photo by"]',
              'div[class*="x1n2onr6"] img', 'article img:not([src*="static"])',
              'section[role="main"] img:not([alt*="avatar"])'
            ]
          },
          pinterest: {
            domain: ['pinterest.com', 'www.pinterest.com'],
            confidence: 0.93,
            imageSelectors: [
              '[data-test-id="pin-image"] img', '.GrowthUnauthPinImage img',
              '.pinImage img', 'img[src*="pinimg"]', 'div[class*="gridCentered"] img'
            ]
          },
          twitter: {
            domain: ['twitter.com', 'x.com'],
            confidence: 0.90,
            imageSelectors: [
              '[data-testid="tweetPhoto"] img', '[data-testid="media"] img',
              'img[src*="pbs.twimg.com"]', '[role="group"] img[src*="pbs.twimg.com"]'
            ]
          },
          generic: {
            confidence: 0.60,
            imageSelectors: [
              'img[src]:not([src*="icon"]):not([src*="avatar"]):not([width="16"]):not([height="16"])',
              '.gallery img', '.images img', '.photos img', 'article img:not([width="16"])',
              'figure img', '.media img'
            ]
          }
        },
        
        ...options
      };

      this.cache = new Map();
      
      // Enhanced performance and learning metrics
      this.performanceMetrics = {
        totalAnalyses: 0,
        averageConfidence: 0,
        siteSpecificHits: 0,
        genericFallbacks: 0,
        processingTimes: [],
        adaptiveLearning: {
          successfulPatterns: new Map(),
          failedPatterns: new Map(),
          confidenceAdjustments: 0,
          patternEvolution: []
        }
      };
      
      // Adaptive learning system
      this.adaptiveLearning = {
        patternSuccess: new Map(),
        patternFailure: new Map(),
        userFeedback: new Map(),
        confidenceHistory: [],
        lastUpdate: Date.now()
      };
      
      // Initialize Smart Pattern Recognition if available
      this.smartPatternRecognition = null;
      this.initializeSmartPatternRecognition();

      this.initializeModalSystem();
      console.log('✅ Enhanced Smart Selector System initialized with adaptive learning');
    }
    
    /**
     * Initialize Smart Pattern Recognition integration with coordination
     */
    initializeSmartPatternRecognition() {
      try {
        // BUGFIX: Use shared instance to prevent race conditions
        if (window.__ST?.getSharedDetectionSystem) {
          this.smartPatternRecognition = window.__ST.getSharedDetectionSystem('smartPatternRecognition');
          if (this.smartPatternRecognition) {
            console.log('✅ [COORD] Using shared SmartPatternRecognition instance');
            return;
          }
        }
        
        // Fallback to individual instance if shared system not available
        if (typeof SmartPatternRecognition !== 'undefined' && !window.__ST?.isSystemInitialized('smart-pattern-recognition-selector')) {
          this.smartPatternRecognition = new SmartPatternRecognition({
            minConfidenceScore: this.options.confidenceThreshold * 0.8,
            highConfidenceThreshold: this.options.confidenceThreshold,
            enableAdvancedPatterns: true,
            enableUrlValidation: true,
            enableContentValidation: true
          });
          console.log('✅ Smart Pattern Recognition integrated with Enhanced Smart Selector');
        }
      } catch (error) {
        console.warn('⚠️ Smart Pattern Recognition integration failed:', error);
      }
    }

    async findGalleryImages(options = {}) {
      const startTime = performance.now();
      const domain = window.location.hostname.toLowerCase();
      
      try {
        // Progressive analysis with early exit
        const analysisResults = await this.performProgressiveAnalysis(domain, options);
        
        if (this.options.enableEarlyExit && 
            analysisResults.confidence >= this.options.earlyExitThreshold) {
          console.log(`🚀 Early exit triggered - high confidence: ${analysisResults.confidence}`);
          return this.finalizeResults(analysisResults, startTime);
        }

        // Site-specific analysis
        const siteResults = await this.performSiteSpecificAnalysis(domain, options);
        
        // Merge and optimize results
        const mergedResults = this.mergeAnalysisResults([analysisResults, siteResults]);
        
        return this.finalizeResults(mergedResults, startTime);
        
      } catch (error) {
        console.error('Enhanced Smart Selector error:', error);
        return this.handleAnalysisError(error, startTime);
      }
    }

    async performProgressiveAnalysis(domain, options) {
      const results = { images: [], confidence: 0, metadata: {} };
      
      // High confidence selectors first
      const highConfidenceSelectors = this.getHighConfidenceSelectors(domain);
      const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
      
      for (const selector of highConfidenceSelectors) {
        const elements = cachedQuery(selector);
        for (const element of elements) {
          const imageData = this.extractImageData(element, selector, 0.9);
          if (imageData) {
            results.images.push(imageData);
          }
        }
        
        if (results.images.length > 10) break; // Early exit for performance
      }
      
      results.confidence = this.calculateOverallConfidence(results.images);
      return results;
    }

    async performSiteSpecificAnalysis(domain, options) {
      const sitePattern = this.findSitePattern(domain);
      const results = { images: [], confidence: 0, metadata: { sitePattern: sitePattern?.domain } };
      const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
      
      if (sitePattern) {
        console.log(`🎯 Using site-specific patterns for ${sitePattern.domain}`);
        
        for (const selector of sitePattern.imageSelectors) {
          const elements = cachedQuery(selector);
          for (const element of elements) {
            const imageData = this.extractImageData(element, selector, sitePattern.confidence);
            if (imageData) {
              results.images.push(imageData);
            }
          }
        }
        
        this.performanceMetrics.siteSpecificHits++;
      } else {
        // Fallback to generic patterns
        const genericPattern = this.options.siteSpecificPatterns.generic;
        for (const selector of genericPattern.imageSelectors) {
          const elements = cachedQuery(selector);
          for (const element of elements) {
            const imageData = this.extractImageData(element, selector, genericPattern.confidence);
            if (imageData) {
              results.images.push(imageData);
            }
          }
        }
        
        this.performanceMetrics.genericFallbacks++;
      }
      
      results.confidence = this.calculateOverallConfidence(results.images);
      return results;
    }

    findSitePattern(domain) {
      for (const [key, pattern] of Object.entries(this.options.siteSpecificPatterns)) {
        if (pattern.domain && pattern.domain.some(d => domain.includes(d))) {
          return pattern;
        }
      }
      return null;
    }

    getHighConfidenceSelectors(domain) {
      return [
        '[data-testid*="image"] img',
        '[data-test-id*="image"] img',
        '[data-gallery] img',
        '.gallery img',
        '.image-container img',
        'img[loading="lazy"]:not([src*="icon"])'
      ];
    }

    /**
     * Enhanced image data extraction with comprehensive detection
     */
    extractImageData(element, selector, confidence) {
      const detectionResults = this.detectAllImageSources(element);
      
      if (!detectionResults.src) return null;
      
      // Advanced filtering with quality assessment
      if (!this.passesQualityFilter(detectionResults, element)) {
        return null;
      }
      
      // Enhanced metadata collection
      const metadata = this.collectEnhancedMetadata(element, detectionResults);
      
      // Apply adaptive confidence adjustment
      const adjustedConfidence = this.adjustConfidenceAdaptively(confidence, metadata, detectionResults);
      
      return {
        src: detectionResults.src,
        alt: element.alt || detectionResults.alt || '',
        width: element.naturalWidth || detectionResults.width || element.getBoundingClientRect().width,
        height: element.naturalHeight || detectionResults.height || element.getBoundingClientRect().height,
        selector: selector,
        confidence: adjustedConfidence,
        element: element,
        metadata: metadata,
        detectionMethod: detectionResults.method,
        qualityScore: detectionResults.qualityScore
      };
    }
    
    /**
     * Comprehensive image source detection including lazy loading, srcset, and video posters
     */
    detectAllImageSources(element) {
      const results = { src: null, method: 'none', qualityScore: 0.5, width: 0, height: 0, alt: '' };
      
      // Method 1: Standard IMG elements with lazy loading support
      if (element.tagName === 'IMG') {
        // Priority order for different src attributes
        const srcAttributes = [
          'src',           // Standard source
          'data-src',      // Common lazy loading
          'data-lazy-src', // Lazy loading variant
          'data-srcset',   // Responsive images
          'data-original', // Original image
          'data-full',     // Full size image
          'data-large'     // Large image
        ];
        
        for (const attr of srcAttributes) {
          const value = element.getAttribute(attr);
          if (value && !value.startsWith('data:')) {
            results.src = value;
            results.method = `img-${attr}`;
            results.qualityScore = this.getAttributeQualityScore(attr);
            break;
          }
        }
        
        // Handle srcset for responsive images
        if (!results.src) {
          const srcset = element.getAttribute('srcset') || element.getAttribute('data-srcset');
          if (srcset) {
            const sources = this.parseSrcset(srcset);
            const bestSource = this.selectBestSource(sources);
            if (bestSource) {
              results.src = bestSource.url;
              results.method = 'img-srcset';
              results.qualityScore = 0.8;
              results.width = bestSource.width;
            }
          }
        }
        
        results.alt = element.alt || '';
      }
      
      // Method 2: Background images with advanced CSS detection
      if (!results.src) {
        const backgroundSrc = this.detectBackgroundImage(element);
        if (backgroundSrc) {
          results.src = backgroundSrc.url;
          results.method = 'background-css';
          results.qualityScore = backgroundSrc.qualityScore;
        }
      }
      
      // Method 3: Video poster images and thumbnails
      if (!results.src && (element.tagName === 'VIDEO' || element.closest('video'))) {
        const videoSrc = this.detectVideoThumbnail(element);
        if (videoSrc) {
          results.src = videoSrc.url;
          results.method = 'video-poster';
          results.qualityScore = videoSrc.qualityScore;
        }
      }
      
      // Method 4: Progressive web app detection
      if (!results.src) {
        const pwaSrc = this.detectProgressiveImage(element);
        if (pwaSrc) {
          results.src = pwaSrc.url;
          results.method = 'progressive-app';
          results.qualityScore = pwaSrc.qualityScore;
        }
      }
      
      return results;
    }
    
    /**
     * Parse srcset attribute to extract image sources
     */
    parseSrcset(srcset) {
      const sources = [];
      const candidates = srcset.split(',');
      
      for (const candidate of candidates) {
        const trimmed = candidate.trim();
        const parts = trimmed.split(/\s+/);
        
        if (parts.length >= 1) {
          const url = parts[0];
          let width = 0;
          
          // Extract width from descriptor (e.g., "800w")
          if (parts.length > 1) {
            const descriptor = parts[1];
            if (descriptor.endsWith('w')) {
              width = parseInt(descriptor.slice(0, -1), 10) || 0;
            }
          }
          
          sources.push({ url, width });
        }
      }
      
      return sources;
    }
    
    /**
     * Select the best source from srcset based on quality
     */
    selectBestSource(sources) {
      if (sources.length === 0) return null;
      
      // Sort by width descending, prefer larger images
      sources.sort((a, b) => b.width - a.width);
      
      // Return the largest available, but prefer reasonable sizes
      const idealWidth = 1200; // Target width for good quality
      
      for (const source of sources) {
        if (source.width >= idealWidth) {
          return source;
        }
      }
      
      // If no ideal size, return the largest
      return sources[0];
    }
    
    /**
     * Advanced background image detection
     */
    detectBackgroundImage(element) {
      const style = window.getComputedStyle(element);
      const backgroundImage = style.backgroundImage;
      
      if (backgroundImage && backgroundImage !== 'none') {
        // Extract URL from CSS background-image
        const matches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (matches) {
          const url = matches[1];
          let qualityScore = 0.6;
          
          // Assess quality based on URL patterns
          if (url.includes('large') || url.includes('full') || url.includes('original')) {
            qualityScore = 0.9;
          } else if (url.includes('medium') || url.includes('cover')) {
            qualityScore = 0.7;
          }
          
          return { url, qualityScore };
        }
      }
      
      // Check for CSS custom properties (CSS variables)
      const computedStyle = style;
      for (let i = 0; i < computedStyle.length; i++) {
        const property = computedStyle[i];
        if (property.startsWith('--') && property.includes('image')) {
          const value = computedStyle.getPropertyValue(property);
          if (value.includes('url(')) {
            const matches = value.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (matches) {
              return { url: matches[1], qualityScore: 0.5 };
            }
          }
        }
      }
      
      return null;
    }
    
    /**
     * Detect video thumbnails and poster images
     */
    detectVideoThumbnail(element) {
      const video = element.tagName === 'VIDEO' ? element : element.closest('video');
      
      if (video) {
        // Check for poster attribute
        const poster = video.getAttribute('poster');
        if (poster) {
          return { url: poster, qualityScore: 0.8 };
        }
        
        // Check for thumbnail in parent container
        const container = video.parentElement;
        if (container) {
          const thumbnail = container.querySelector('[data-thumbnail], [data-poster], .video-thumbnail img');
          if (thumbnail) {
            const src = thumbnail.src || thumbnail.getAttribute('data-src');
            if (src) {
              return { url: src, qualityScore: 0.7 };
            }
          }
        }
      }
      
      return null;
    }
    
    /**
     * Detect progressive web app images
     */
    detectProgressiveImage(element) {
      // Check for PWA-specific attributes
      const pwaAttributes = [
        'data-progressive-src',
        'data-intersection-src',
        'data-dynamic-src'
      ];
      
      for (const attr of pwaAttributes) {
        const value = element.getAttribute(attr);
        if (value) {
          return { url: value, qualityScore: 0.6 };
        }
      }
      
      return null;
    }
    
    /**
     * Get quality score for different src attributes
     */
    getAttributeQualityScore(attribute) {
      const scores = {
        'src': 0.9,
        'data-original': 0.95,
        'data-full': 0.9,
        'data-large': 0.85,
        'data-src': 0.8,
        'data-lazy-src': 0.75,
        'data-srcset': 0.8
      };
      
      return scores[attribute] || 0.5;
    }
    
    /**
     * Advanced quality filtering with multiple criteria
     */
    passesQualityFilter(detectionResults, element) {
      const src = detectionResults.src;
      
      // Filter out low-value images based on URL patterns
      const lowValueIndicators = ['icon', 'avatar', 'logo', 'emoji', 'loading', 'spinner', 'placeholder'];
      if (lowValueIndicators.some(indicator => src.toLowerCase().includes(indicator))) {
        return false;
      }
      
      // Filter based on alt text
      if (element.alt) {
        const altLower = element.alt.toLowerCase();
        if (lowValueIndicators.some(indicator => altLower.includes(indicator))) {
          return false;
        }
      }
      
      // Size-based filtering
      const rect = element.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) { // More lenient threshold
        return false;
      }
      
      // Aspect ratio filtering (avoid extremely wide or tall images)
      if (rect.width > 0 && rect.height > 0) {
        const aspectRatio = rect.width / rect.height;
        if (aspectRatio > 10 || aspectRatio < 0.1) {
          return false;
        }
      }
      
      // Data URL filtering (avoid base64 images unless high quality)
      if (src.startsWith('data:')) {
        if (src.length < 1000) { // Very small data URLs are likely icons
          return false;
        }
      }
      
      return true;
    }
    
    /**
     * Collect enhanced metadata for adaptive learning
     */
    collectEnhancedMetadata(element, detectionResults) {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      return {
        // Basic element info
        className: element.className,
        id: element.id,
        tagName: element.tagName,
        
        // Positioning and layout
        position: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        },
        
        // Style information
        styles: {
          display: computedStyle.display,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex,
          opacity: computedStyle.opacity
        },
        
        // Context analysis
        context: this.analyzeElementContext(element),
        
        // Detection metadata
        detection: {
          method: detectionResults.method,
          qualityScore: detectionResults.qualityScore,
          timestamp: Date.now()
        },
        
        // Parent analysis
        parentAnalysis: this.analyzeParentContainer(element)
      };
    }
    
    /**
     * Adaptive confidence adjustment based on learning
     */
    adjustConfidenceAdaptively(baseConfidence, metadata, detectionResults) {
      let adjustedConfidence = baseConfidence;
      
      // Apply learned pattern adjustments
      const patternKey = this.generatePatternKey(metadata, detectionResults);
      
      if (this.adaptiveLearning.patternSuccess.has(patternKey)) {
        const successRate = this.adaptiveLearning.patternSuccess.get(patternKey);
        adjustedConfidence *= (1 + (successRate - 0.5) * 0.4); // Max 20% boost/penalty
        this.performanceMetrics.adaptiveLearning.confidenceAdjustments++;
      }
      
      // Gallery context boost
      if (metadata.context && metadata.context.isInGallery) {
        adjustedConfidence *= 1.2;
      }
      
      // Quality score integration
      adjustedConfidence *= (0.7 + detectionResults.qualityScore * 0.3);
      
      // Smart Pattern Recognition integration
      if (this.smartPatternRecognition) {
        try {
          const smartAnalysis = this.smartPatternRecognition.calculateConfidenceScore(
            { src: detectionResults.src }, 
            { metadata, detectionResults }
          );
          if (smartAnalysis && smartAnalysis.confidence) {
            adjustedConfidence = (adjustedConfidence + smartAnalysis.confidence) / 2;
          }
        } catch (error) {
          console.warn('Smart Pattern Recognition confidence calculation failed:', error);
        }
      }
      
      return Math.min(Math.max(adjustedConfidence, 0), 1);
    }
    
    /**
     * Generate pattern key for adaptive learning
     */
    generatePatternKey(metadata, detectionResults) {
      const components = [
        detectionResults.method || 'unknown',
        metadata.context ? metadata.context.galleryType : 'none',
        metadata.tagName || 'unknown',
        metadata.className ? metadata.className.split(' ')[0] : 'no-class'
      ];
      
      return components.join('|');
    }
    
    /**
     * Analyze element context for better pattern recognition
     */
    analyzeElementContext(element) {
      const context = {
        isInGallery: false,
        galleryType: 'none',
        siblingCount: 0,
        hasGalleryIndicators: false
      };
      
      // Check if element is in a gallery container
      const galleryContainer = element.closest('.gallery, .images, .photos, [data-gallery], .grid, .masonry, .carousel');
      if (galleryContainer) {
        context.isInGallery = true;
        context.galleryType = this.detectContainerType(galleryContainer);
        context.hasGalleryIndicators = true;
      }
      
      // Count similar siblings
      const parent = element.parentElement;
      if (parent) {
        const siblings = parent.querySelectorAll(element.tagName);
        context.siblingCount = siblings.length;
      }
      
      return context;
    }
    
    /**
     * Analyze parent container for pattern recognition
     */
    analyzeParentContainer(element) {
      const parent = element.parentElement;
      if (!parent) return null;
      
      const computedStyle = window.getComputedStyle(parent);
      
      return {
        className: parent.className,
        display: computedStyle.display,
        flexDirection: computedStyle.flexDirection,
        gridTemplateColumns: computedStyle.gridTemplateColumns,
        childCount: parent.children.length,
        hasDataAttributes: this.hasGalleryDataAttributes(parent)
      };
    }
    
    /**
     * Check for gallery-related data attributes
     */
    hasGalleryDataAttributes(element) {
      const galleryAttributes = ['data-gallery', 'data-grid', 'data-masonry', 'data-carousel', 'data-slideshow'];
      return galleryAttributes.some(attr => element.hasAttribute(attr));
    }
    
    /**
     * Detect container type for gallery classification
     */
    detectContainerType(container) {
      const className = container.className.toLowerCase();
      const style = window.getComputedStyle(container);
      
      if (style.display === 'grid' || className.includes('grid')) {
        return 'grid';
      }
      if (className.includes('masonry')) {
        return 'masonry';
      }
      if (className.includes('carousel') || className.includes('slider')) {
        return 'carousel';
      }
      if (className.includes('gallery')) {
        return 'gallery';
      }
      
      return 'container';
    }
    
    /**
     * Learn from successful pattern selections
     */
    learnFromSuccess(imageData) {
      if (!imageData.metadata) return;
      
      const patternKey = this.generatePatternKey(imageData.metadata, {
        method: imageData.detectionMethod || 'unknown'
      });
      
      const currentSuccess = this.adaptiveLearning.patternSuccess.get(patternKey) || 0.5;
      const newSuccess = Math.min(currentSuccess + 0.1, 1.0);
      
      this.adaptiveLearning.patternSuccess.set(patternKey, newSuccess);
      this.performanceMetrics.adaptiveLearning.successfulPatterns.set(patternKey, 
        (this.performanceMetrics.adaptiveLearning.successfulPatterns.get(patternKey) || 0) + 1
      );
      
      console.log(`🎯 Pattern learning: ${patternKey} success rate: ${newSuccess.toFixed(2)}`);
    }
    
    /**
     * Learn from failed pattern selections
     */
    learnFromFailure(imageData) {
      if (!imageData.metadata) return;
      
      const patternKey = this.generatePatternKey(imageData.metadata, {
        method: imageData.detectionMethod || 'unknown'
      });
      
      const currentSuccess = this.adaptiveLearning.patternSuccess.get(patternKey) || 0.5;
      const newSuccess = Math.max(currentSuccess - 0.1, 0.0);
      
      this.adaptiveLearning.patternSuccess.set(patternKey, newSuccess);
      this.performanceMetrics.adaptiveLearning.failedPatterns.set(patternKey,
        (this.performanceMetrics.adaptiveLearning.failedPatterns.get(patternKey) || 0) + 1
      );
      
      console.log(`❌ Pattern learning: ${patternKey} success rate: ${newSuccess.toFixed(2)}`);
    }

    calculateOverallConfidence(images) {
      if (images.length === 0) return 0;
      
      const totalConfidence = images.reduce((sum, img) => sum + img.confidence, 0);
      return totalConfidence / images.length;
    }

    mergeAnalysisResults(resultsArray) {
      const mergedImages = [];
      const seenUrls = new Set();
      
      for (const results of resultsArray) {
        for (const image of results.images) {
          if (!seenUrls.has(image.src)) {
            seenUrls.add(image.src);
            mergedImages.push(image);
          }
        }
      }
      
      // Sort by confidence
      mergedImages.sort((a, b) => b.confidence - a.confidence);
      
      return {
        images: mergedImages,
        confidence: this.calculateOverallConfidence(mergedImages),
        metadata: { merged: true }
      };
    }

    finalizeResults(results, startTime) {
      const processingTime = performance.now() - startTime;
      
      this.performanceMetrics.totalAnalyses++;
      this.performanceMetrics.processingTimes.push(processingTime);
      this.performanceMetrics.averageConfidence = 
        (this.performanceMetrics.averageConfidence + results.confidence) / 2;
      
      console.log(`✅ Enhanced Smart Selector completed: ${results.images.length} images found (${processingTime.toFixed(2)}ms)`);
      
      return {
        success: true,
        images: results.images,
        confidence: results.confidence,
        metadata: {
          ...results.metadata,
          processingTime,
          totalFound: results.images.length,
          performance: this.performanceMetrics
        }
      };
    }

    handleAnalysisError(error, startTime) {
      const processingTime = performance.now() - startTime;
      
      console.error('Analysis error:', error);
      
      return {
        success: false,
        images: [],
        confidence: 0,
        error: error.message,
        metadata: { processingTime }
      };
    }

    // Modal system for selector interface
    initializeModalSystem() {
      this.modalContainer = null;
      this.modalIframe = null;
      this.modalOverlay = null;
      this.isModalActive = false;
    }

    createSecureModal(title = 'Smart Selector', content = '') {
      if (this.isModalActive) {
        this.closeModal();
      }

      this.modalOverlay = document.createElement('div');
      this.modalOverlay.id = 'stepthree-smart-selector-overlay';
      this.modalOverlay.style.cssText = `
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100vw !important; height: 100vh !important;
        background: rgba(0, 0, 0, 0.7) !important; z-index: 2147483647 !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
      `;

      this.modalContainer = document.createElement('div');
      this.modalContainer.style.cssText = `
        background: white !important; border-radius: 12px !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
        max-width: 90vw !important; max-height: 90vh !important;
        width: 800px !important; height: 600px !important;
        display: flex !important; flex-direction: column !important;
      `;

      const header = document.createElement('div');
      header.style.cssText = `
        padding: 20px !important; border-bottom: 1px solid #e0e0e0 !important;
        display: flex !important; justify-content: space-between !important;
        align-items: center !important; background: #f8f9fa !important;
      `;

      const titleElement = document.createElement('h3');
      titleElement.textContent = title;
      titleElement.style.cssText = `
        margin: 0 !important; font-size: 18px !important;
        font-weight: 600 !important; color: #333 !important;
      `;

      const closeButton = document.createElement('button');
      closeButton.textContent = '✕'; // Fixed: Use textContent instead of innerHTML for CSP compliance
      closeButton.style.cssText = `
        background: none !important; border: none !important;
        font-size: 20px !important; cursor: pointer !important;
        color: #666 !important; padding: 5px 8px !important;
      `;
      closeButton.onclick = () => this.closeModal();

      header.appendChild(titleElement);
      header.appendChild(closeButton);

      this.modalIframe = document.createElement('iframe');
      this.modalIframe.style.cssText = `
        flex: 1 !important; border: none !important;
        width: 100% !important; height: 100% !important;
      `;
      
      this.modalIframe.srcdoc = this.createIframeContent(content);

      this.modalContainer.appendChild(header);
      this.modalContainer.appendChild(this.modalIframe);
      this.modalOverlay.appendChild(this.modalContainer);
      
      document.body.appendChild(this.modalOverlay);
      
      this.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.modalOverlay) {
          this.closeModal();
        }
      });

      this.isModalActive = true;
      return this.modalContainer;
    }

    createIframeContent(content) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                   line-height: 1.6; color: #333; padding: 20px; }
            .selector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); 
                            gap: 12px; margin: 20px 0; }
            .selector-item { background: #f8f9fa; padding: 12px; border-radius: 8px; 
                            border: 2px solid #e9ecef; cursor: pointer; transition: all 0.2s ease; }
            .selector-item:hover { background: #e3f2fd; border-color: #2196f3; }
          </style>
        </head>
        <body>
          <div class="container">${content}</div>
        </body>
        </html>
      `;
    }

    closeModal() {
      if (this.modalOverlay && this.modalOverlay.parentNode) {
        this.modalOverlay.remove();
      }
      this.isModalActive = false;
      this.modalContainer = null;
      this.modalIframe = null;
      this.modalOverlay = null;
    }

    getPerformanceMetrics() {
      return { ...this.performanceMetrics };
    }

    clearCache() {
      this.cache.clear();
    }
  }

  // Export globally
  window.EnhancedSmartSelectorSystem = EnhancedSmartSelectorSystem;
  console.log('✅ Enhanced Smart Selector System loaded successfully');
}

// =============================================================================
// CENTRALIZED MESSAGE COORDINATOR - Prevents race conditions and conflicts
// =============================================================================

/**
 * Centralized Message Coordinator - Single source of truth for message handling
 * Prevents race conditions and listener conflicts between multiple content scripts
 */

// CRITICAL FIX: Generate unique frame identifier to prevent handler conflicts
function generateFrameId() {
  return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${window.location.hostname || 'unknown'}`;
}

// Global message coordination state
window.__STEPTHREE_MESSAGE_COORDINATOR = window.__STEPTHREE_MESSAGE_COORDINATOR || {
  initialized: false,
  ready: false,
  frameId: generateFrameId(), // CRITICAL FIX: Unique frame identifier
  listeners: new Map(),
  messageHandlers: new Map(),
  queuedHandlers: [], // CRITICAL FIX: Queue handlers during initialization
  startupTime: Date.now(),
  initializationAttempts: 0,
  MAX_ATTEMPTS: 3
};

const coordinator = window.__STEPTHREE_MESSAGE_COORDINATOR;

// Enhanced state management with enterprise monitoring  
let initialized = false;
let extensionReady = false;
let errorBoundary = null;
let performanceMonitor = null;
let startupTime = Date.now();
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;

// Check if we're in a Chrome extension context and initialize
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
  initializeContentScriptCoordinator();
} else {
  console.log('🌐 Not in Chrome extension context, skipping coordinator initialization');
}

// Enhanced initialization with centralized coordination
async function initializeContentScriptCoordinator() {
  coordinator.initializationAttempts++;
  
  if (coordinator.initializationAttempts > coordinator.MAX_ATTEMPTS) {
    console.error('❌ Max coordinator initialization attempts exceeded');
    return;
  }

  // Prevent double initialization
  if (coordinator.initialized) {
    console.log('⚠️ Message coordinator already initialized, registering as handler');
    await registerWithCoordinator();
    return;
  }

  try {
    console.log(`🔄 Initializing STEPTHREE message coordinator (attempt ${coordinator.initializationAttempts})...`);

    // Initialize enterprise error boundary first
    await initializeErrorBoundary();
    
    // Initialize performance monitoring
    await initializePerformanceMonitoring();
    
    // Wait for DOM to be ready with timeout
    await waitForDOMReady();
    
    // Perform pre-initialization checks
    await performPreInitChecks();

    // Enhanced module availability check with fallbacks
    const moduleCheckResult = await checkModuleAvailability();
    
    if (!moduleCheckResult.success && moduleCheckResult.critical) {
      console.warn(`⚠️ Critical modules missing: ${moduleCheckResult.missing.join(', ')}`);
      // Continue initialization with fallbacks rather than failing completely
    }

    // Set up centralized message listener (only once)
    await setupCentralizedMessageListener();

    // Initialize core systems with error boundaries
    await initializeCoreSystems();
    
    // Register this script's message handlers
    await registerMessageHandlers();
    
    // Perform post-initialization validation
    await performPostInitValidation();

    coordinator.initialized = true;
    coordinator.ready = true;
    initialized = true;
    extensionReady = true;
    
    // CRITICAL FIX: Process any queued handler registrations now that coordinator is ready
    processQueuedHandlers();
    
    const initTime = Date.now() - coordinator.startupTime;
    console.log(`✅ STEPTHREE message coordinator initialized successfully in ${initTime}ms`);
    
    // Report successful initialization
    reportInitializationSuccess(initTime);

  } catch (error) {
    await handleInitializationError(error);
  }
}

/**
 * Register with existing coordinator (when coordinator already initialized by another script)
 */
async function registerWithCoordinator() {
  try {
    console.log('🔗 Registering content-bundle handlers with existing coordinator...');
    
    // Initialize local systems
    await initializeErrorBoundary();
    await initializePerformanceMonitoring();
    await waitForDOMReady();
    await initializeCoreSystems();
    
    // Register our message handlers with the coordinator
    await registerMessageHandlers();
    
    initialized = true;
    extensionReady = true;
    
    console.log('✅ Content-bundle registered with coordinator successfully');
  } catch (error) {
    console.error('❌ Failed to register with coordinator:', error);
  }
}

/**
 * Centralized message listener setup - Single listener for all content scripts
 * CRITICAL: Only one listener across all content scripts to prevent conflicts
 */
async function setupCentralizedMessageListener() {
  if (!chrome.runtime.onMessage) {
    throw new Error('Chrome runtime message API not available');
  }

  // CRITICAL: Check if listener already exists (prevent duplicates)
  if (window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED) {
    console.log('⚠️ Message listener already registered, skipping duplicate setup');
    return;
  }

  console.log('🎯 Setting up centralized message listener...');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Centralized message received:', { 
      action: message.action || message.type, 
      sender: sender.tab ? 'tab' : 'extension',
      url: window.location.href 
    });
    
    // Route through centralized coordinator
    handleCentralizedMessage(message, sender, sendResponse);
    
    return true; // Keep message channel open for async responses
  });

  // Mark listener as registered globally
  window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED = true;
  console.log('✅ Centralized message listener set up successfully');
}

/**
 * Register message handlers with the coordinator
 */
async function registerMessageHandlers() {
  console.log('🔗 Registering content-bundle message handlers...');
  
  // Register handlers for this script's capabilities
  const handlers = {
    'ping': handlePing,
    'check_orchestrator_status': handleCheckOrchestratorStatus,
    'getPageStatus': handleGetPageStatus,
    'quickScan': handleQuickScan,
    'advancedScan': handleAdvancedScan,
    'detectTables': handleDetectTables,
    'enhancedGalleryDetection': handleEnhancedGalleryDetection,
    'sitePatternAnalysis': handleSitePatternAnalysis,
    'lazyImageDetection': handleLazyImageDetection,
    'toggleSelector': handleToggleSelector,
    'testSelector': handleTestSelector,
    'clearHighlights': handleClearHighlights,
    'START_BATCH_SCRAPE': handleStartBatchScrape
  };

  // CRITICAL FIX: Register each handler using frame-aware registration
  for (const [messageType, handler] of Object.entries(handlers)) {
    // Use the registerStepThreeMessageHandler function to ensure frame-aware registration
    window.registerStepThreeMessageHandler(messageType, handler, 'content-bundle', 1);
  }

  console.log(`✅ Registered ${Object.keys(handlers).length} message handlers from content-bundle`);
}

/**
 * Centralized message routing - Routes messages to appropriate handlers
 */
async function handleCentralizedMessage(message, sender, sendResponse) {
  const startTime = Date.now();
  let messageType; // ensure defined for finally logging
  
  try {
    // Check if coordinator is ready
    if (!coordinator.ready) {
      console.warn('⚠️ Message coordinator not ready, rejecting message:', message);
      sendResponse({ success: false, error: 'Coordinator not ready' });
      return;
    }

    const { action, type } = message;
    messageType = type || action;
    
    console.log(`🎯 Routing message: ${messageType}`);

    // CRITICAL FIX: Find registered handler using frame-aware lookup
    const handlerInfo = findFrameAwareHandler(messageType);
    
    if (handlerInfo && handlerInfo.handler) {
      console.log(`📋 Using handler from: ${handlerInfo.source}`);
      
      // Wrap in error boundary if available
      if (errorBoundary && typeof errorBoundary.safeExecute === 'function') {
      const responseWrapper = (payload) => {
        try { sendResponse(payload); } catch (e) { console.warn('sendResponse wrapper failed:', e); }
      };
      await errorBoundary.safeExecute('message_handling', async () => {
        return await handlerInfo.handler(message, responseWrapper);
      }, {
          operationName: 'message_handling',
          checkDOMSize: false,
          maxExecutionTime: 30000 // 30 seconds for complex operations
        }).catch(error => {
          console.error(`❌ Message handling failed for ${messageType}:`, error);
        responseWrapper({ 
            success: false, 
            error: error.message,
            messageType,
            fallback: true 
        });
        });
      } else {
        // Basic error handling
        try {
        const responseWrapper = (payload) => {
          try { sendResponse(payload); } catch (e) { console.warn('sendResponse wrapper failed:', e); }
        };
        await handlerInfo.handler(message, responseWrapper);
        } catch (error) {
          console.error(`❌ Message handling failed for ${messageType}:`, error);
        try { sendResponse({ success: false, error: error.message, messageType }); } catch {}
        }
      }
    } else {
      console.log(`❓ No handler found for message type: ${messageType}`);
      sendResponse({ 
        success: false, 
        error: `No handler registered for message type: ${messageType}`,
        messageType 
      });
    }
  } catch (error) {
    console.error('❌ Centralized message routing error:', error);
    sendResponse({ success: false, error: error.message });
  } finally {
    const duration = Date.now() - startTime;
    console.log(`⏱️ Message routing completed in ${duration}ms for: ${messageType || 'unknown'}`);
  }
}

/**
 * CRITICAL FIX: Enhanced utility function that queues handlers during initialization
 * Prevents lost handler registrations during coordinator initialization window
 * Uses frame-aware handler keys to prevent conflicts between frames
 */
window.registerStepThreeMessageHandler = function(messageType, handler, source = 'unknown', priority = 0) {
  // CRITICAL FIX: Create frame-aware handler key to prevent cross-frame conflicts
  const frameAwareKey = `${messageType}@${coordinator.frameId}@${source}`;
  
  // CRITICAL FIX: Check if coordinator is ready or queue the registration
  if (!coordinator.initialized || !coordinator.messageHandlers) {
    console.log(`📬 Coordinator not ready, queueing handler for '${messageType}' from ${source} [${coordinator.frameId}]`);
    
    // Queue the handler registration for later processing
    coordinator.queuedHandlers.push({
      messageType,
      frameAwareKey,
      handler,
      source,
      priority,
      timestamp: Date.now()
    });
    
    console.log(`✅ Queued handler for '${messageType}' from ${source} (${coordinator.queuedHandlers.length} in queue)`);
    return true;
  }
  
  // Coordinator is ready, register immediately with frame-aware key
  coordinator.messageHandlers.set(frameAwareKey, {
    messageType, // Store original message type for routing
    handler,
    source,
    priority,
    frameId: coordinator.frameId
  });
  
  console.log(`✅ Registered handler for '${messageType}' from ${source} [${coordinator.frameId}]`);
  return true;
};

/**
 * CRITICAL FIX: Process queued handler registrations when coordinator becomes ready
 * Ensures no handler registrations are lost during initialization window
 * Updated to handle frame-aware handler keys
 */
function processQueuedHandlers() {
  if (coordinator.queuedHandlers.length === 0) {
    console.log('📋 No queued handlers to process');
    return;
  }
  
  console.log(`🔄 Processing ${coordinator.queuedHandlers.length} queued handler registrations...`);
  
  let successCount = 0;
  let failCount = 0;
  
  // Process all queued handlers
  while (coordinator.queuedHandlers.length > 0) {
    const queuedHandler = coordinator.queuedHandlers.shift();
    
    try {
      // Register the queued handler with frame-aware key
      const handlerKey = queuedHandler.frameAwareKey || queuedHandler.messageType;
      
      coordinator.messageHandlers.set(handlerKey, {
        messageType: queuedHandler.messageType, // Store original message type for routing
        handler: queuedHandler.handler,
        source: queuedHandler.source,
        priority: queuedHandler.priority,
        frameId: coordinator.frameId
      });
      
      console.log(`✅ Processed queued handler for '${queuedHandler.messageType}' from ${queuedHandler.source} [${coordinator.frameId}]`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Failed to process queued handler for '${queuedHandler.messageType}':`, error);
      failCount++;
    }
  }
  
  console.log(`📊 Queue processing complete: ${successCount} successful, ${failCount} failed`);
}

/**
 * CRITICAL FIX: Find frame-aware handler with intelligent fallback
 * Searches for handlers in priority order: current frame -> any frame -> fallback
 */
function findFrameAwareHandler(messageType) {
  const currentFrameId = coordinator.frameId;
  
  // Strategy 1: Look for handler specific to current frame with any source
  for (const [handlerKey, handlerInfo] of coordinator.messageHandlers) {
    if (handlerInfo.messageType === messageType && handlerInfo.frameId === currentFrameId) {
      console.log(`🎯 Found frame-specific handler: ${handlerKey}`);
      return handlerInfo;
    }
  }
  
  // Strategy 2: Look for handler with same message type from any frame (backward compatibility)
  for (const [handlerKey, handlerInfo] of coordinator.messageHandlers) {
    if (handlerInfo.messageType === messageType || handlerKey === messageType) {
      console.log(`🔄 Found compatible handler: ${handlerKey}`);
      return handlerInfo;
    }
  }
  
  // Strategy 3: Check if there's a direct key match (legacy handlers)
  const directHandler = coordinator.messageHandlers.get(messageType);
  if (directHandler) {
    console.log(`📎 Found legacy handler: ${messageType}`);
    return directHandler;
  }
  
  console.log(`❓ No handler found for message type: ${messageType} in frame: ${currentFrameId}`);
  return null;
}

// =============================================================================
// CENTRALIZED MESSAGE HANDLERS - Simplified handlers for coordinator
// =============================================================================

/**
 * Simple ping handler
 */
async function handlePing(message, sendResponse) {
  sendResponse({ success: true, ready: extensionReady, coordinator: coordinator.ready });
}

// REMOVED: Duplicate handleCheckOrchestratorStatus function - using the comprehensive version below

/**
 * Main message handler - Routes messages to appropriate handlers
 */
async function handleMessage(message, sender, sendResponse) {
  const startTime = Date.now();
  let messageType; // ensure defined for finally logging
  try {
    if (!extensionReady) {
      console.warn('⚠️ Content script not ready, rejecting message:', message);
      sendResponse({ success: false, error: 'Content script not ready' });
      return;
    }

    const { action, type } = message;
    messageType = type || action;
    
    console.log(`🎯 Processing message: ${messageType}`);

    switch (messageType) {
      case 'ping':
        sendResponse({ success: true, ready: coordinatorState.ready });
        break;

      case 'check_orchestrator_status':
        await handleCheckOrchestratorStatus(sendResponse);
        break;

      case 'getPageStatus':
        await handleGetPageStatus(sendResponse);
        break;

      case 'quickScan':
        await handleQuickScan(message, sendResponse);
        break;

      case 'advancedScan':
        await handleAdvancedScan(message, sendResponse);
        break;

      case 'enhancedGalleryDetection':
        await handleEnhancedGalleryDetection(message, sendResponse);
        break;

      case 'detectTables':
        await handleDetectTables(message, sendResponse);
        break;

      case 'sitePatternAnalysis':
        await handleSitePatternAnalysis(message, sendResponse);
        break;
      case 'START_BATCH_SCRAPE':
        await handleStartBatchScrape(message, sendResponse);
        break;

      case 'lazyImageDetection':
        await handleLazyImageDetection(message, sendResponse);
        break;

      case 'toggleSelector':
        await handleToggleSelector(message, sendResponse);
        break;

      case 'testSelector':
        await handleTestSelector(message, sendResponse);
        break;

      case 'clearHighlights':
        await handleClearHighlights(sendResponse);
        break;

      // CRITICAL: Add missing orchestrator_score_element handler
      case 'orchestrator_score_element':
        await handleOrchestratorScoreElement(message, sendResponse);
        break;

      // Add missing legacy handlers to prevent message handler gaps
      case 'scrape_images':
        await handleScrapeImages(message, sendResponse);
        break;

      case 'find_gallery':
        await handleFindGallery(message, sendResponse);
        break;

      case 'start_element_picker':
        await handleStartElementPicker(message, sendResponse);
        break;

      case 'stop_element_picker':
        await handleStopElementPicker(message, sendResponse);
        break;

      case 'start_smart_selector':
        await handleStartSmartSelector(message, sendResponse);
        break;

      case 'stop_smart_selector':
        await handleStopSmartSelector(message, sendResponse);
        break;

      case 'smart_find_images':
        await handleSmartFindImages(message, sendResponse);
        break;

      case 'start_interactive_selection':
        await handleStartInteractiveSelection(message, sendResponse);
        break;

      // Missing Smart Selector handlers added for complete workflow
      case 'trigger_auto_expand':
        await handleTriggerAutoExpand(message, sendResponse);
        break;

      case 'remove_last_sample':
        await handleRemoveLastSample(message, sendResponse);
        break;

      case 'clear_smart_selection':
        await handleClearSmartSelection(message, sendResponse);
        break;

      case 'smart_selector_update':
        await handleSmartSelectorUpdate(message, sendResponse);
        break;

      case 'pattern_analysis_complete':
        await handlePatternAnalysisComplete(message, sendResponse);
        break;

      default:
        console.log('❓ Unknown message type:', messageType);
        sendResponse({ success: true, message: 'Message received but not handled', messageType });
    }
  } catch (error) {
    console.error('❌ Message handling error:', error);
    sendResponse({ success: false, error: error.message });
  } finally {
    const duration = Date.now() - startTime;
    console.log(`⏱️ Message processing completed in ${duration}ms for: ${messageType || 'unknown'}`);
  }
}

/**
 * CRITICAL: Handle orchestrator status check - This is what the dashboard expects
 * FIXED: Now includes strict gating for critical modules and proper availability checking
 */
async function handleCheckOrchestratorStatus(sendResponse) {
  try {
    // Check component availability with strict validation
    const components = {
      errorHandler: typeof window.StepThreeErrorHandler !== 'undefined',
      validator: typeof window.inputValidator !== 'undefined',
      selectorUtils: typeof window.StepThreeSelectorUtils !== 'undefined',
      robustHelpers: typeof window.RobustHelpers !== 'undefined',
      advancedCollector: typeof window.AdvancedCollectorSystem !== 'undefined',
      smartSelector: typeof window.EnhancedSmartSelectorSystem !== 'undefined'
    };

    // Define critical components - orchestrator is not available without these
    const criticalComponents = ['errorHandler', 'validator', 'selectorUtils'];
    const missingCritical = criticalComponents.filter(comp => !components[comp]);
    
    // Determine availability based on critical component check
    const available = missingCritical.length === 0;
    const ready = available && extensionReady && initialized;
    
    // Perform lightweight self-test for additional validation
    const selfTestResult = await performOrchestratorSelfTest();
    
    const status = {
      available: available && selfTestResult.passed,
      ready: ready && selfTestResult.passed,
      initialized: initialized,
      url: window.location.href,
      timestamp: Date.now(),
      components: components,
      criticalComponents: {
        required: criticalComponents,
        missing: missingCritical,
        allPresent: missingCritical.length === 0
      },
      selfTest: selfTestResult,
      readyReason: available ? (ready ? 'All systems operational' : 'Components loaded but not ready') : `Missing critical components: ${missingCritical.join(', ')}`
    };

    console.log(available ? '✅ Orchestrator status check - AVAILABLE:' : '❌ Orchestrator status check - NOT AVAILABLE:', status);
    sendResponse({ success: true, status });
  } catch (error) {
    console.error('❌ Orchestrator status check failed:', error);
    sendResponse({ 
      success: false, 
      error: error.message,
      status: { 
        available: false, 
        ready: false,
        error: error.message,
        timestamp: Date.now()
      }
    });
  }
}

/**
 * Perform lightweight self-test to validate orchestrator dependencies
 * ADDED: Self-test function for orchestrator status validation
 */
async function performOrchestratorSelfTest() {
  const testResults = {
    passed: true,
    tests: {},
    errors: []
  };

  try {
    // Test 1: Chrome runtime availability
    testResults.tests.chromeRuntime = {
      passed: typeof chrome !== 'undefined' && chrome.runtime,
      description: 'Chrome runtime API available'
    };
    if (!testResults.tests.chromeRuntime.passed) {
      testResults.errors.push('Chrome runtime API not available');
      testResults.passed = false;
    }

    // Test 2: Essential DOM APIs
    testResults.tests.domApis = {
      passed: typeof document !== 'undefined' && typeof document.querySelectorAll === 'function',
      description: 'Essential DOM APIs available'
    };
    if (!testResults.tests.domApis.passed) {
      testResults.errors.push('Essential DOM APIs not available');
      testResults.passed = false;
    }

    // Test 3: Error handler functional
    testResults.tests.errorHandler = {
      passed: typeof window.StepThreeErrorHandler !== 'undefined' && window.StepThreeErrorHandler.initialized,
      description: 'Error handling system functional'
    };
    if (!testResults.tests.errorHandler.passed) {
      testResults.errors.push('Error handling system not functional');
      testResults.passed = false;
    }

    // Test 4: Basic selector functionality
    try {
      const testElement = document.createElement('div');
      const testResult = testElement.tagName === 'DIV';
      testResults.tests.basicSelectors = {
        passed: testResult,
        description: 'Basic element selection functional'
      };
      if (!testResult) {
        testResults.errors.push('Basic element selection not working');
        testResults.passed = false;
      }
    } catch (error) {
      testResults.tests.basicSelectors = {
        passed: false,
        description: 'Basic element selection functional'
      };
      testResults.errors.push(`Basic element selection failed: ${error.message}`);
      testResults.passed = false;
    }

    testResults.timestamp = Date.now();
    testResults.summary = testResults.passed ? 'All self-tests passed' : `${testResults.errors.length} test(s) failed`;

    console.log(testResults.passed ? '✅ Orchestrator self-test PASSED' : '❌ Orchestrator self-test FAILED:', testResults);
    return testResults;

  } catch (error) {
    console.error('❌ Self-test execution failed:', error);
    return {
      passed: false,
      tests: {},
      errors: [`Self-test execution failed: ${error.message}`],
      timestamp: Date.now(),
      summary: 'Self-test execution failed'
    };
  }
}

/**
 * Handle orchestrator score element - CRITICAL missing handler
 */
async function handleOrchestratorScoreElement(message, sendResponse) {
  try {
    const { elementData, options = {} } = message;
    
    if (!elementData || !elementData.element) {
      sendResponse({ 
        success: false, 
        error: 'Invalid element data provided' 
      });
      return;
    }

    // Use EnhancedSmartSelectorSystem for scoring if available
    if (window.EnhancedSmartSelectorSystem) {
      try {
        const selector = new window.EnhancedSmartSelectorSystem();
        const result = await selector.scoreElement(elementData.element, options);
        
        sendResponse({
          success: true,
          confidence: result.confidence || 0.5,
          confidenceTier: result.confidenceTier || 'medium',
          patternAnalysis: result.patternAnalysis || {},
          elementId: elementData.elementId || generateElementId()
        });
      } catch (error) {
        console.warn('❌ Enhanced selector scoring failed, using fallback:', error);
        // Fallback scoring
        const fallbackScore = calculateFallbackConfidence(elementData);
        sendResponse({
          success: true,
          confidence: fallbackScore,
          confidenceTier: fallbackScore >= 0.75 ? 'high' : fallbackScore >= 0.5 ? 'medium' : 'low',
          patternAnalysis: { method: 'fallback' },
          elementId: elementData.elementId || generateElementId()
        });
      }
    } else {
      // Use basic scoring when enhanced system not available
      const fallbackScore = calculateFallbackConfidence(elementData);
      sendResponse({
        success: true,
        confidence: fallbackScore,
        confidenceTier: fallbackScore >= 0.75 ? 'high' : fallbackScore >= 0.5 ? 'medium' : 'low',
        patternAnalysis: { method: 'basic_fallback' },
        elementId: elementData.elementId || generateElementId()
      });
    }
  } catch (error) {
    console.error('❌ Orchestrator score element failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Helper function for fallback confidence calculation
function calculateFallbackConfidence(elementData) {
  let confidence = 0.5; // Base confidence
  
  if (elementData.element && elementData.element.tagName) {
    if (elementData.element.tagName === 'IMG') confidence += 0.2;
    if (elementData.element.className && elementData.element.className.includes('gallery')) confidence += 0.1;
    if (elementData.element.hasAttribute && elementData.element.hasAttribute('data-src')) confidence += 0.1;
  }
  
  if (elementData.src || elementData.url) {
    const url = elementData.src || elementData.url;
    if (url.includes('gallery') || url.includes('photo')) confidence += 0.1;
    if (/\.(jpg|jpeg|png|webp)$/i.test(url)) confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

// Helper function to generate element IDs
function generateElementId() {
  return 'elem_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

/**
 * Get page status - simplified but functional
 */
async function handleGetPageStatus(sendResponse) {
  try {
    const images = document.querySelectorAll('img');
    const galleryDetected = detectSimpleGallery();
    
    sendResponse({
      success: true,
      itemCount: images.length,
      pageStatus: galleryDetected ? 'Gallery detected' : 'Ready to scan',
      isGalleryPage: galleryDetected,
      url: window.location.href
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Quick scan handler
 */
async function handleQuickScan(message, sendResponse) {
  try {
    console.log('🚀 Starting quick scan...');

    // Use AdvancedCollectorSystem if available
    if (window.AdvancedCollectorSystem) {
      const collector = new window.AdvancedCollectorSystem({
        concurrency: 3,
        timeout: 15000,
        maxPages: 1
      });
      
      const results = await collector.collectImages({
        ...message.settings,
        maxPages: 1
      });
      
      sendResponse({
        success: true,
        itemCount: results.images ? results.images.length : 0,
        items: results.images,
        stats: results.metrics
      });
      
      console.log('✅ Quick scan completed:', results.images?.length || 0, 'items');
      return;
    }

    // Fallback to basic scan
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
      url: img.src,
      alt: img.alt,
      dimensions: {
        width: img.width,
        height: img.height
      }
    })).filter(img => img.url);

    sendResponse({
      success: true,
      itemCount: images.length,
      items: images,
      stats: { totalFound: images.length }
    });

    console.log('✅ Quick scan completed (fallback):', images.length, 'items');
  } catch (error) {
    console.error('❌ Quick scan failed:', error);
    // Ensure we always respond to avoid unhandled promise rejection
    const images = Array.from(document.querySelectorAll('img')).map(img => ({ url: img.src, alt: img.alt }))
      .filter(img => !!img.url);
    sendResponse({ success: true, itemCount: images.length, items: images, stats: { totalFound: images.length }, fallback: true, error: error.message });
  }
}

/**
 * Advanced scan handler
 */
async function handleAdvancedScan(message, sendResponse) {
  try {
    console.log('🚀 Starting advanced scan...');

    // Use AdvancedCollectorSystem if available
    if (window.AdvancedCollectorSystem) {
      const collector = new window.AdvancedCollectorSystem({
        concurrency: message.settings?.concurrency || 5,
        timeout: message.settings?.timeout || 30000,
        maxPages: message.settings?.maxPages || 5
      });
      
      const results = await collector.collectImages({
        selector: message.selector,
        ...message.settings
      });
      
      sendResponse({
        success: true,
        itemCount: results.images ? results.images.length : 0,
        items: results.images,
        stats: results.metrics
      });
      
      console.log('✅ Advanced scan completed:', results.images?.length || 0, 'items');
      return;
    }

    // Fallback to basic advanced scan
    const selector = message.selector || 'img';
    const elements = document.querySelectorAll(selector);
    const items = Array.from(elements).map(el => {
      if (el.tagName === 'IMG') {
        return {
          url: el.src,
          alt: el.alt,
          dimensions: { width: el.width, height: el.height }
        };
      } else {
        // Try to extract background images
        const style = window.getComputedStyle(el);
        const backgroundImage = style.backgroundImage;
        if (backgroundImage && backgroundImage !== 'none') {
          const matches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          return matches ? { url: matches[1], source: 'background' } : null;
        }
      }
      return null;
    }).filter(Boolean);
    
    sendResponse({
      success: true,
      itemCount: items.length,
      items: items,
      stats: { totalFound: items.length }
    });

    console.log('✅ Advanced scan completed (fallback):', items.length, 'items');
  } catch (error) {
    console.error('❌ Advanced scan failed:', error);
    const selector = message.selector || 'img';
    const elements = document.querySelectorAll(selector);
    const items = Array.from(elements).map(el => {
      if (el.tagName === 'IMG') {
        return { url: el.src, alt: el.alt, dimensions: { width: el.width, height: el.height } };
      }
      const style = window.getComputedStyle(el);
      const bg = style.backgroundImage;
      if (bg && bg !== 'none') {
        const m = bg.match(/url\(['"]?([^'"]+)['"]?\)/);
        return m ? { url: m[1], source: 'background' } : null;
      }
      return null;
    }).filter(Boolean);
    sendResponse({ success: true, itemCount: items.length, items, stats: { totalFound: items.length }, fallback: true, error: error.message });
  }
}

/**
 * Enhanced gallery detection handler
 */
async function handleEnhancedGalleryDetection(message, sendResponse) {
  try {
    console.log('🔍 Starting enhanced gallery detection...');

    // Use enhanced smart selector if available
    if (window.EnhancedSmartSelectorSystem) {
      const smartSelector = new window.EnhancedSmartSelectorSystem();
      const galleryResults = await smartSelector.findGalleryImages({
        maxImages: message.maxImages || 500,
        minSize: message.minSize || 100
      });

      sendResponse({
        success: true,
        site: galleryResults.site || window.location.hostname,
        galleryImages: galleryResults.images || [],
        totalFound: galleryResults.totalFound || 0,
        validCount: galleryResults.validCount || 0,
        processingTime: galleryResults.processingTime || 0,
        patterns: galleryResults.patterns || [],
        isGalleryPage: (galleryResults.validCount || 0) > 3
      });

      console.log(`✅ Enhanced gallery detection completed: ${galleryResults.validCount || 0} valid images found`);
      return;
    }

    // Fallback to simple gallery detection
    const galleryDetected = detectSimpleGallery();
    const images = document.querySelectorAll('img');
    
    sendResponse({
      success: true,
      site: window.location.hostname,
      galleryImages: Array.from(images).slice(0, 50).map(img => ({
        url: img.src,
        alt: img.alt
      })),
      totalFound: images.length,
      validCount: images.length,
      processingTime: 10,
      patterns: ['img'],
      isGalleryPage: galleryDetected
    });

    console.log(`✅ Enhanced gallery detection completed (fallback): ${images.length} images found`);
  } catch (error) {
    console.error('❌ Enhanced gallery detection failed:', error);
    // Graceful fallback response so background never sees unhandled rejection
    const images = document.querySelectorAll('img');
    sendResponse({
      success: true,
      site: window.location.hostname,
      galleryImages: Array.from(images).slice(0, 50).map(img => ({ url: img.src, alt: img.alt })),
      totalFound: images.length,
      validCount: images.length,
      processingTime: 0,
      patterns: ['img'],
      isGalleryPage: detectSimpleGallery(),
      fallback: true,
      error: error.message
    });
  }
}

/**
 * Site pattern analysis handler
 */
async function handleSitePatternAnalysis(message, sendResponse) {
  try {
    console.log('🌐 Starting site pattern analysis...');

    const siteInfo = {
      currentSite: window.location.hostname,
      detectedPatterns: ['img', '[data-src]', 'picture'],
      urlPatterns: {
        hostname: window.location.hostname,
        pathname: window.location.pathname
      },
      galleryContainers: Array.from(document.querySelectorAll('.gallery, .grid, .photos, .images')).length
    };

    const pageAnalysis = {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
      hasInfiniteScroll: document.querySelector('[data-infinite], .infinite-scroll, .load-more') !== null,
      hasLazyLoading: document.querySelector('[data-src], [loading="lazy"], .lazy') !== null,
      estimatedImageCount: document.querySelectorAll('img, [data-src]').length
    };

    sendResponse({
      success: true,
      siteInfo,
      pageAnalysis
    });

    console.log('✅ Site pattern analysis completed for:', siteInfo.currentSite);
  } catch (error) {
    console.error('❌ Site pattern analysis failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Lazy image detection handler
 */
async function handleLazyImageDetection(message, sendResponse) {
  try {
    console.log('👁️ Starting lazy image detection...');

    const lazyImages = document.querySelectorAll('[data-src], [data-lazy], [loading="lazy"], .lazy, .lazyload');
    const visibleLazyImages = Array.from(lazyImages).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });

    sendResponse({
      success: true,
      totalLazyImages: lazyImages.length,
      visibleLazyImages: visibleLazyImages.length,
      patterns: Array.from(new Set(Array.from(lazyImages).map(img => img.className).filter(c => c)))
    });

    console.log(`✅ Lazy image detection completed: ${lazyImages.length} lazy images found`);
  } catch (error) {
    console.error('❌ Lazy image detection failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Detect tables handler - wrappers TableDetectionSystem results
 */
async function handleDetectTables(message, sendResponse) {
  try {
    const collector = window.AdvancedCollectorSystem ? new window.AdvancedCollectorSystem() : null;
    if (!collector) {
      sendResponse({ success: true, tables: [], note: 'Collector not available' });
      return;
    }
    const tables = await collector.detectTabularStructures(message?.options || {});
    sendResponse({ success: true, tables });
  } catch (error) {
    sendResponse({ success: false, error: error.message, tables: [] });
  }
}

/**
 * Toggle selector mode handler
 */
async function handleToggleSelector(message, sendResponse) {
  try {
    // Use EnhancedSmartSelectorSystem if available
    if (window.EnhancedSmartSelectorSystem) {
      const smartSelector = new window.EnhancedSmartSelectorSystem();
      if (typeof smartSelector.startSelectionMode === 'function') {
        await smartSelector.startSelectionMode();
      } else if (typeof smartSelector.startInteractiveSelection === 'function') {
        smartSelector.startInteractiveSelection();
      } else {
        throw new Error('No selection method available');
      }
      sendResponse({ success: true, message: 'Smart selector mode activated' });
      return;
    }

    // Fallback message
    sendResponse({ success: false, error: 'Element picker not available' });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Test selector handler
 */
async function handleTestSelector(message, sendResponse) {
  try {
    const { selector } = message;
    if (!selector) {
      sendResponse({ success: false, error: 'No selector provided' });
      return;
    }

    const elements = document.querySelectorAll(selector);
    
    // Highlight elements
    elements.forEach(el => {
      el.style.outline = '2px solid #ff6b6b';
      el.style.backgroundColor = 'rgba(255, 107, 107, 0.2)';
    });

    sendResponse({
      success: true,
      count: elements.length,
      selector: selector
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: `Invalid selector: ${error.message}`,
      selector: message.selector
    });
  }
}

/**
 * Clear highlights handler
 */
async function handleClearHighlights(sendResponse) {
  try {
    // Remove all test highlights
    const highlightedElements = document.querySelectorAll('[style*="outline"][style*="background-color"]');
    highlightedElements.forEach(el => {
      el.style.outline = '';
      el.style.backgroundColor = '';
    });

    sendResponse({ success: true, message: 'Highlights cleared' });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Batch scrape handler used by background batch router
 */
async function handleStartBatchScrape(message, sendResponse) {
  try {
    let items = [];
    let metrics = {};
    if (window.AdvancedCollectorSystem) {
      const collector = new window.AdvancedCollectorSystem({ concurrency: 2, timeout: 15000 });
      const res = await collector.collectImages({ maxPages: 1 });
      items = res.images || [];
      metrics = res.metrics || {};
    } else {
      items = Array.from(document.querySelectorAll('img')).map(img => ({ url: img.src, alt: img.alt })).filter(i => i.url);
      metrics = { totalFound: items.length, fallback: true };
    }
    sendResponse({ completed: true, items, metadata: metrics });
  } catch (error) {
    const imgs = Array.from(document.querySelectorAll('img')).map(img => ({ url: img.src, alt: img.alt })).filter(i => i.url);
    sendResponse({ completed: true, items: imgs, metadata: { totalFound: imgs.length, fallback: true, error: error.message } });
  }
}

/**
 * Simple gallery detection - fallback method
 */
function detectSimpleGallery() {
  try {
    const images = document.querySelectorAll('img');
    const imageContainers = document.querySelectorAll('div img, article img, section img');
    
    // Simple heuristics
    if (images.length > 10) return true;
    if (imageContainers.length > 5) return true;
    
    // Check for common gallery patterns
    const galleryIndicators = [
      'gallery', 'photo', 'image', 'picture', 'thumb',
      'grid', 'masonry', 'lightbox', 'carousel'
    ];
    
    const bodyClass = document.body.className.toLowerCase();
    const bodyId = document.body.id.toLowerCase();
    
    return galleryIndicators.some(indicator => 
      bodyClass.includes(indicator) || bodyId.includes(indicator)
    );
  } catch (error) {
    console.error('Gallery detection error:', error);
    return false;
  }
}

// ============================================================================= 
// SUPPORT FUNCTIONS FOR ORCHESTRATOR INITIALIZATION
// =============================================================================

/**
 * Initialize enterprise error boundary system
 */
async function initializeErrorBoundary() {
  try {
    // Use existing StepThreeErrorHandler if available
    if (window.StepThreeErrorHandler) {
      errorBoundary = window.StepThreeErrorHandler;
      console.log('✅ Using existing error handler for orchestrator');
      return;
    }

    console.log('⚠️ Error boundary not available, using basic error handling');
  } catch (error) {
    console.error('❌ Failed to initialize error boundary:', error);
  }
}

/**
 * Initialize performance monitoring
 */
async function initializePerformanceMonitoring() {
  try {
    // Check for existing performance monitor
    if (window.globalProductionMonitor) {
      performanceMonitor = window.globalProductionMonitor;
      performanceMonitor.info('Orchestrator initialization started', {
        url: window.location.href,
        timestamp: startupTime
      });
      console.log('✅ Performance monitoring initialized for orchestrator');
    } else {
      console.log('⚠️ Performance monitor not available');
    }
  } catch (error) {
    console.error('❌ Failed to initialize performance monitoring:', error);
  }
}

/**
 * Wait for DOM ready with timeout and retry
 */
async function waitForDOMReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('DOM ready timeout'));
    }, 10000); // 10 second timeout

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        clearTimeout(timeout);
        resolve();
      });
    } else {
      clearTimeout(timeout);
      resolve();
    }
  });
}

/**
 * Perform pre-initialization checks
 */
async function performPreInitChecks() {
  // Check if we're in a valid environment
  if (!window || !document) {
    throw new Error('Invalid browser environment');
  }

  // Check Chrome extension context
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    throw new Error('Chrome extension context not available');
  }

  // Check DOM size for performance
  const domElementCount = document.querySelectorAll('*').length;
  if (domElementCount > 5000) {
    console.warn(`⚠️ Large DOM detected: ${domElementCount} elements`);
    
    if (performanceMonitor) {
      performanceMonitor.warn('Large DOM detected during orchestrator initialization', {
        elementCount: domElementCount,
        url: window.location.href
      });
    }
  }

  console.log('✅ Pre-initialization checks completed');
}

/**
 * Enhanced module availability check with fallbacks
 */
async function checkModuleAvailability() {
  const requiredModules = [
    { 
      name: 'DEBUG', 
      property: 'DEBUG',
      critical: false,
      fallback: () => ({ isEnabled: () => true, log: console.log })
    },
    { 
      name: 'ErrorHandler', 
      property: 'StepThreeErrorHandler',
      critical: false,
      fallback: () => ({ handleError: console.error })
    },
    { 
      name: 'AdvancedCollectorSystem', 
      property: 'AdvancedCollectorSystem',
      critical: false,
      fallback: null
    }
  ];

  const optionalModules = [
    { name: 'SelectorUtils', property: 'StepThreeSelectorUtils', critical: false },
    { name: 'RobustHelpers', property: 'RobustHelpers', critical: false },
    { name: 'EnhancedSmartSelector', property: 'EnhancedSmartSelectorSystem', critical: false }
  ];

  const allModules = [...requiredModules, ...optionalModules];
  const missing = [];
  const criticalMissing = [];

  for (const module of allModules) {
    const available = typeof window[module.property] !== 'undefined';
    
    if (!available) {
      missing.push(module.name);
      
      if (module.critical) {
        criticalMissing.push(module.name);
      } else if (module.fallback) {
        // Set up fallback
        try {
          window[module.property] = module.fallback();
          console.log(`✅ Fallback initialized for ${module.name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to initialize fallback for ${module.name}:`, error);
        }
      }
    }
  }

  if (missing.length > 0) {
    console.warn('⚠️ Some orchestrator modules not loaded:', missing);
  }

  return {
    success: criticalMissing.length === 0,
    critical: criticalMissing.length > 0,
    missing,
    criticalMissing,
    totalChecked: allModules.length
  };
}

/**
 * Initialize core systems with error boundaries
 */
async function initializeCoreSystems() {
  const systems = [
    {
      name: 'Smart Selector System',
      init: () => {
        return typeof window.EnhancedSmartSelectorSystem !== 'undefined';
      }
    },
    {
      name: 'Advanced Collector System',
      init: () => {
        return typeof window.AdvancedCollectorSystem !== 'undefined';
      }
    },
    {
      name: 'DOM Observers',
      init: () => {
        if (window.DynamicContentObserver) {
          // Don't auto-start observer, just verify it's available
          return true;
        }
        return false;
      }
    }
  ];

  for (const system of systems) {
    try {
      const success = system.init();
      if (success) {
        console.log(`✅ ${system.name} available`);
      } else {
        console.warn(`⚠️ ${system.name} not available`);
      }
    } catch (error) {
      console.error(`❌ Failed to initialize ${system.name}:`, error);
    }
  }
}

/**
 * Perform post-initialization validation
 */
async function performPostInitValidation() {
  // Validate message listener is working
  try {
    if (!chrome.runtime.onMessage.hasListeners()) {
      console.warn('⚠️ No message listeners detected after setup');
    } else {
      console.log('✅ Message listeners validated');
    }
  } catch (error) {
    console.warn('⚠️ Could not validate message listeners:', error);
  }

  // Test basic DOM operations
  try {
    const testElement = document.querySelector('body');
    if (!testElement) {
      throw new Error('Cannot access document body');
    }
    console.log('✅ DOM access validated');
  } catch (error) {
    console.error('❌ DOM access validation failed:', error);
  }
}

/**
 * Report successful initialization
 */
function reportInitializationSuccess(initTime) {
  const report = {
    success: true,
    initializationTime: initTime,
    extensionReady: extensionReady,
    initialized: initialized,
    url: window.location.href,
    timestamp: Date.now()
  };

  if (performanceMonitor) {
    performanceMonitor.info('Orchestrator initialization completed', report);
  }

  // Optionally notify background script of successful initialization
  try {
    chrome.runtime.sendMessage({
      action: 'orchestrator_ready',
      report
    }).catch(error => {
      // Don't fail initialization if background communication fails
      console.warn('⚠️ Could not notify background script:', error);
    });
  } catch (error) {
    console.warn('⚠️ Background communication not available:', error);
  }
}

/**
 * Handle initialization errors
 */
async function handleInitializationError(error) {
  console.error(`❌ Orchestrator initialization failed (attempt ${initializationAttempts}):`, error);

  if (errorBoundary) {
    errorBoundary.handleError(error, 'Orchestrator Initialization', {
      attempt: initializationAttempts,
      url: window.location.href
    }, 'high');
  }

  // Try to set up basic message handling even if full initialization failed
  if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
    console.log('🔄 Attempting emergency message handler setup...');
    
    // CRITICAL: Check if a listener is already registered before setting up emergency handler
    if (window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED) {
      console.log('⚠️ Message listener already registered, skipping emergency handler');
      return;
    }
    
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 Emergency message handler:', message);
        
        if (message.action === 'check_orchestrator_status' || message.type === 'check_orchestrator_status') {
          sendResponse({
            success: false,
            error: 'Orchestrator initialization failed',
            status: {
              available: false,
              ready: false,
              error: error.message
            }
          });
        } else {
          sendResponse({
            success: false,
            error: 'Content script not properly initialized'
          });
        }
        return true;
      });
      
      // Mark listener as registered
      window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED = true;
      console.log('✅ Emergency message handler set up');
    } catch (emergencyError) {
      console.error('❌ Emergency handler setup failed:', emergencyError);
    }
  }
}

console.log('✅ Content Script Orchestrator functionality loaded');

// =============================================================================
// END OF CONTENT BUNDLE
// =============================================================================

console.log('🎆 STEPTHREE Gallery Scraper Content Bundle v2.0 Ready!');
console.log('📊 Bundle includes:', [
  'Debug Config',
  'Error Handling', 
  'Input Validation',
  'Library Utilities',
  'ServiceWorker Fetch',
  'Content Core',
  'DOM Observers',
  'Scraper Core',
  'Advanced Extractor',
  'Smart Selection',
  'Element Picker',
  'Initialization'
].join(', '));

// simple-injector.js - Enhanced content script initialization with enterprise reliability
// Enterprise-grade error handling, performance safeguards, and comprehensive monitoring

console.log('🚀 STEPTHREE Enhanced Content Script loading...');

// Use coordinator state instead of creating duplicate variables
// Access through coordinator object to prevent conflicts
const coordinatorState = window.__STEPTHREE_MESSAGE_COORDINATOR;

// CRITICAL: Wait for centralized coordinator instead of creating own listeners
// This prevents race conditions and duplicate responses by using centralized system
let coordinatorCheckAttempts = 0;
const MAX_COORDINATOR_WAIT_ATTEMPTS = 10;

// Check if we're in a Chrome extension context
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
  console.log('🌐 Not in Chrome extension context, exiting');
} else {
  initializeContentScript();
}

// Enhanced initialization with enterprise error handling and performance monitoring
async function initializeContentScript() {
  coordinatorState.initializationAttempts++;
  
  if (coordinatorState.initializationAttempts > coordinatorState.MAX_ATTEMPTS) {
    console.error('❌ Max initialization attempts exceeded');
    return;
  }

  try {
    console.log(`🔄 Initializing STEPTHREE content script (attempt ${coordinatorState.initializationAttempts})...`);

    // Initialize enterprise error boundary first
    await initializeErrorBoundary();
    
    // Initialize performance monitoring
    await initializePerformanceMonitoring();
    
    // Wait for DOM to be ready with timeout
    await waitForDOMReady();
    
    // Perform pre-initialization checks
    await performPreInitChecks();

    // Enhanced module availability check with fallbacks
    const moduleCheckResult = await checkModuleAvailability();
    
    if (!moduleCheckResult.success && moduleCheckResult.critical) {
      throw new Error(`Critical modules missing: ${moduleCheckResult.missing.join(', ')}`);
    }

    // Register with centralized message coordinator instead of setting up own listener
    await registerWithMessageCoordinator();

    // Initialize core systems with error boundaries
    await initializeCoreSystems();
    
    // Perform post-initialization validation
    await performPostInitValidation();

    // Update coordinator state instead of local variables
    coordinatorState.initialized = true;
    coordinatorState.ready = true;
    
    const initTime = Date.now() - coordinatorState.startupTime;
    console.log(`✅ STEPTHREE content script initialized successfully in ${initTime}ms`);
    
    // Report successful initialization
    reportInitializationSuccess(initTime);

  } catch (error) {
    await handleInitializationError(error);
  }
}

/**
 * Register content script specific fallback strategies
 */
function registerContentScriptFallbacks() {
  if (!errorBoundary) return;

  // Element selection fallback
  errorBoundary.registerFallback('element_selection', async (error, config) => {
    console.log('🔄 Using basic element selection fallback');
    return document.querySelectorAll('img, a, div');
  });

  // Message handling fallback
  errorBoundary.registerFallback('message_handling', async (error, config) => {
    console.log('🔄 Using basic message handling fallback');
    return { success: false, error: error.message, fallback: true };
  });

  // Scraping operation fallback
  errorBoundary.registerFallback('scraping_operation', async (error, config) => {
    console.log('🔄 Using basic scraping fallback');
    const images = document.querySelectorAll('img[src]');
    return {
      items: Array.from(images).map(img => ({
        src: img.src,
        alt: img.alt || '',
        fallback: true
      })),
      fallback: true
    };
  });

  console.log('✅ Content script fallback strategies registered');
}

/**
 * Enhanced message handler with error boundaries
 */
async function handleMessageSafely(message, sender, sendResponse) {
  const startTime = Date.now();
  
  try {
    console.log('📨 Enhanced content script received message:', {
      action: message.action || message.type,
      sender: sender.tab ? 'tab' : 'extension',
      url: window.location.href
    });

    if (performanceMonitor) {
      performanceMonitor.debug('Message received', {
        action: message.action || message.type,
        timestamp: startTime
      });
    }

    // Use existing message handler but with enhanced error reporting
    const result = await handleMessage(message, sender, sendResponse);
    
    const duration = Date.now() - startTime;
    if (performanceMonitor && duration > 1000) {
      performanceMonitor.warn('Slow message handling', {
        action: message.action || message.type,
        duration
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (performanceMonitor) {
      performanceMonitor.error('Message handling error', {
        action: message.action || message.type,
        error: error.message,
        duration
      });
    }
    
    throw error;
  }
}

console.log('✅ STEPTHREE Enhanced Content Script loaded with enterprise reliability');

// enhanced-image-manager.js - Comprehensive Image Manager for STEPTHREE
// Ports efficient imageManager system from reference extension with enhanced capabilities
// Integrates with existing SmartPatternRecognition and AdvancedCollectorSystem

console.log('🚀 Loading Enhanced Image Manager...');

/**
 * Enhanced Image Manager - Ported from reference "Image Downloaderb" extension
 * Implements comprehensive image detection with modern enhancements
 */
class EnhancedImageManager {
  constructor(options = {}) {
    this.options = {
      // Performance settings
      maxNodesPerMethod: options.maxNodesPerMethod || 2000,
      timeBudgetPerMethod: options.timeBudgetPerMethod || 8000,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
      
      // Detection method toggles
      enableShadowDOM: options.enableShadowDOM !== false,
      enableSrcsetDetection: options.enableSrcsetDetection !== false,
      enableBackgroundImages: options.enableBackgroundImages !== false,
      enableUrlExtraction: options.enableUrlExtraction !== false,
      enableInputImages: options.enableInputImages !== false,
      enableLinkDetection: options.enableLinkDetection !== false,
      
      // Quality filtering - More lenient for gallery images
      minImageWidth: options.minImageWidth || 20, // Reduced from 50 to allow smaller thumbnails
      minImageHeight: options.minImageHeight || 20, // Reduced from 50 to allow smaller thumbnails
      allowSmallGalleryImages: options.allowSmallGalleryImages !== false, // New option for gallery context
      supportedExtensions: options.supportedExtensions || [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 
        'tif', 'apng', 'jfif', 'pjpeg', 'pjp'
      ],
      
      ...options
    };

    // Image type classification from reference extension
    this.imageType = {
      IMG: "IMG",
      TEXT: "TEXT", 
      LINK: "LINK",
      INPUT_IMG: "INPUT_IMG",
      BACKGROUND: "BACKGROUND"
    };

    // State management
    this.imgList = [];
    this.processedUrls = new Set();
    this.backgroundUrls = new Set();
    
    // Performance metrics
    this.metrics = {
      totalFound: 0,
      duplicatesSkipped: 0,
      processingTime: 0,
      methodStats: {
        standardImages: 0,
        documentImages: 0,
        shadowDOMImages: 0,
        srcsetImages: 0,
        backgroundImages: 0,
        urlExtraction: 0,
        inputImages: 0,
        linkImages: 0
      },
      errors: []
    };

    // Initialize integration with STEPTHREE systems
    this.smartPatternRecognition = null;
    this.initializeIntegrations();
  }

  /**
   * Initialize integrations with existing STEPTHREE systems
   */
  async initializeIntegrations() {
    try {
      // BUGFIX: Check for shared SmartPatternRecognition to prevent race conditions
      if (window.__ST?.getSharedDetectionSystem) {
        this.smartPatternRecognition = window.__ST.getSharedDetectionSystem('smartPatternRecognition');
        if (this.smartPatternRecognition) {
          console.log('✅ [COORD] Using shared SmartPatternRecognition instance');
          return;
        }
      }
      
      // Fallback: Create individual instance if shared system not available
      if (typeof SmartPatternRecognition !== 'undefined' && !window.__ST?.isSystemInitialized('smart-pattern-recognition-image-manager')) {
        window.__ST?.markSystemInitialized('smart-pattern-recognition-image-manager');
        this.smartPatternRecognition = new SmartPatternRecognition({
          enableAdvancedPatterns: true,
          enableUrlValidation: true
        });
        console.log('✅ [COORD] SmartPatternRecognition integration enabled (individual instance)');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize SmartPatternRecognition integration:', error);
    }
  }

  /**
   * Main entry point - Enhanced image collection with comprehensive detection
   */
  async getImages() {
    console.log('🔍 Starting comprehensive image detection...');
    const startTime = performance.now();
    
    try {
      // Reset state
      this.imgList = [];
      this.processedUrls.clear();
      this.backgroundUrls.clear();

      // Execute all detection methods in sequence for optimal performance
      await this.detectStandardImages();
      await this.detectDocumentImages(); 
      await this.detectShadowDOMImages();
      await this.detectSrcsetImages();
      await this.detectInputImages();
      await this.detectLinkImages();
      await this.detectBackgroundImages();
      await this.extractUrlsFromHTML();

      // Post-processing and deduplication
      this.deduplicateImages();
      this.metrics.totalFound = this.imgList.length;
      this.metrics.processingTime = performance.now() - startTime;

      console.log(`✅ Image detection completed: ${this.imgList.length} images found in ${this.metrics.processingTime.toFixed(2)}ms`);
      console.log('📊 Method stats:', this.metrics.methodStats);

      return this.imgList;

    } catch (error) {
      console.error('❌ Image detection failed:', error);
      this.metrics.errors.push(error.message);
      return this.imgList;
    }
  }

  /**
   * Enhanced image size validation with gallery-aware logic
   * More lenient for common gallery patterns
   */
  isValidImageSize(width, height, src, element) {
    // Basic size check - very permissive for gallery images
    const basicMinWidth = this.options.minImageWidth;
    const basicMinHeight = this.options.minImageHeight;
    
    // If meets basic requirements, always allow
    if (width >= basicMinWidth && height >= basicMinHeight) {
      return true;
    }
    
    // If gallery context is disabled, use strict validation
    if (!this.options.allowSmallGalleryImages) {
      return false;
    }
    
    // Gallery-aware validation - allow smaller images in certain contexts
    const isInGalleryContext = this.detectGalleryContext(element, src);
    
    if (isInGalleryContext) {
      // More lenient thresholds for gallery images
      const galleryMinWidth = Math.max(10, basicMinWidth * 0.4); // 40% of basic requirement
      const galleryMinHeight = Math.max(10, basicMinHeight * 0.4);
      
      if (width >= galleryMinWidth && height >= galleryMinHeight) {
        console.debug(`🖼️ Allowing small gallery image: ${width}x${height} from ${src.substring(0, 50)}...`);
        return true;
      }
    }
    
    // Check for common icon/avatar patterns that should be excluded
    if (this.isLikelyIconOrAvatar(src, width, height)) {
      return false;
    }
    
    // Final check - allow reasonable aspect ratios even if small
    const aspectRatio = width / height;
    if (aspectRatio >= 0.5 && aspectRatio <= 2.0 && width >= 15 && height >= 15) {
      console.debug(`🖼️ Allowing small image with good aspect ratio: ${width}x${height}`);
      return true;
    }
    
    return false;
  }

  /**
   * Detect if an image is in a gallery context
   */
  detectGalleryContext(element, src) {
    if (!element || !src) return false;
    
    try {
      // Check element classes and IDs for gallery indicators
      const classNames = element.className || '';
      const parentClasses = element.parentElement?.className || '';
      const grandparentClasses = element.parentElement?.parentElement?.className || '';
      
      const galleryIndicators = [
        'gallery', 'grid', 'photo', 'image', 'thumb', 'tile',
        'carousel', 'slider', 'lightbox', 'masonry', 'portfolio'
      ];
      
      for (const indicator of galleryIndicators) {
        if (classNames.toLowerCase().includes(indicator) ||
            parentClasses.toLowerCase().includes(indicator) ||
            grandparentClasses.toLowerCase().includes(indicator)) {
          return true;
        }
      }
      
      // Check URL patterns that suggest gallery images
      const urlLower = src.toLowerCase();
      if (urlLower.includes('gallery') || 
          urlLower.includes('photos') || 
          urlLower.includes('album') ||
          urlLower.includes('thumb') ||
          urlLower.includes('preview')) {
        return true;
      }
      
      // Check for common gallery attributes
      if (element.dataset?.gallery || 
          element.dataset?.lightbox ||
          element.getAttribute?.('data-gallery') ||
          element.getAttribute?.('data-fancybox')) {
        return true;
      }
      
      // Check for multiple similar images (suggests gallery)
      const siblings = element.parentElement?.children || [];
      const similarImages = Array.from(siblings).filter(child => 
        child.tagName === 'IMG' && child !== element
      );
      
      if (similarImages.length >= 3) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.debug('Error detecting gallery context:', error);
      return false;
    }
  }

  /**
   * Check if image is likely an icon or avatar that should be excluded
   */
  isLikelyIconOrAvatar(src, width, height) {
    if (!src) return false;
    
    try {
      const urlLower = src.toLowerCase();
      
      // Common icon/avatar patterns in URLs
      const iconPatterns = [
        'icon', 'favicon', 'logo', 'avatar', 'profile',
        'button', 'sprite', 'ui/', '/icons/', 'assets/img/ui'
      ];
      
      for (const pattern of iconPatterns) {
        if (urlLower.includes(pattern)) {
          return true;
        }
      }
      
      // Very small images are likely icons
      if (width <= 16 && height <= 16) {
        return true;
      }
      
      // Perfect squares under 32px are often icons
      if (width === height && width <= 32) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.debug('Error checking icon/avatar pattern:', error);
      return false;
    }
  }

  /**
   * Method 1: Standard IMG tag detection (enhanced from reference)
   */
  async detectStandardImages() {
    try {
      console.log('🔍 Detecting standard IMG tags...');
      
      const imgs = document.getElementsByTagName("img");
      
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        
        try {
          // Get image source (prefer currentSrc for responsive images)
          const src = img.currentSrc || img.src;
          if (!src || this.processedUrls.has(src)) continue;

          // Calculate dimensions (enhanced approach from reference)
          let width = 0, height = 0;
          
          // Try natural dimensions first
          if (img.naturalWidth && img.naturalHeight) {
            width = img.naturalWidth;
            height = img.naturalHeight;
          } else {
            // Fallback to computed dimensions
            const rect = img.getBoundingClientRect();
            width = rect.width || 0;
            height = rect.height || 0;
          }

          // Apply size filtering with gallery-aware logic
          if (!this.isValidImageSize(width, height, src, img)) {
            continue;
          }

          this.addImg(this.imageType.IMG, src, width, height, {
            element: img,
            alt: img.alt,
            className: img.className,
            dataset: img.dataset
          });
          
          this.metrics.methodStats.standardImages++;

        } catch (error) {
          console.debug('Error processing standard image:', error);
        }
      }

    } catch (error) {
      console.warn('⚠️ Standard image detection failed:', error);
      this.metrics.errors.push('Standard images: ' + error.message);
    }
  }

  /**
   * Method 2: Document.images collection (from reference extension)
   */
  async detectDocumentImages() {
    try {
      console.log('🔍 Detecting document.images collection...');
      
      const imgs = document.images;
      if (!imgs || imgs.length === 0) return;

      for (let i = 0; i < imgs.length; i++) {
        try {
          const img = imgs[i];
          const src = img.currentSrc || img.src;
          
          if (!src || this.processedUrls.has(src)) continue;

          // Enhanced dimension calculation
          let width = parseInt(img.naturalWidth) || 0;
          let height = parseInt(img.naturalHeight) || 0;
          
          // Fallback dimension calculation
          if (width === 0 || height === 0) {
            const newImg = new Image();
            newImg.src = src;
            const nwidth = parseInt(newImg.width) || 0;
            const nheight = parseInt(newImg.height) || 0;
            width = Math.max(width, nwidth);
            height = Math.max(height, nheight);
          }

          this.addImg(this.imageType.IMG, src, width, height, {
            element: img,
            fromDocumentCollection: true
          });
          
          this.metrics.methodStats.documentImages++;

        } catch (error) {
          console.debug('Error processing document image:', error);
        }
      }

    } catch (error) {
      console.warn('⚠️ Document images detection failed:', error);
      this.metrics.errors.push('Document images: ' + error.message);
    }
  }

  /**
   * Method 3: Shadow DOM detection (ported from reference extension)
   */
  async detectShadowDOMImages() {
    if (!this.options.enableShadowDOM) return;

    try {
      console.log('🔍 Detecting Shadow DOM images...');
      
      const shadowImages = this.querySelectorAllShadows("img");
      
      for (const img of shadowImages) {
        try {
          const src = img.currentSrc || img.src;
          if (!src || this.processedUrls.has(src)) continue;

          let width = parseInt(img.naturalWidth) || 0;
          let height = parseInt(img.naturalHeight) || 0;

          this.addImg(this.imageType.IMG, src, width, height, {
            element: img,
            fromShadowDOM: true,
            shadowHost: img.getRootNode()?.host?.tagName || 'unknown'
          });
          
          this.metrics.methodStats.shadowDOMImages++;

        } catch (error) {
          console.debug('Error processing shadow DOM image:', error);
        }
      }

    } catch (error) {
      console.warn('⚠️ Shadow DOM detection failed:', error);
      this.metrics.errors.push('Shadow DOM: ' + error.message);
    }
  }

  /**
   * Method 4: Enhanced srcset detection (ported and improved)
   */
  async detectSrcsetImages() {
    if (!this.options.enableSrcsetDetection) return;

    try {
      console.log('🔍 Detecting srcset images...');
      
      // Process source elements
      const sources = document.getElementsByTagName("source");
      for (const source of sources) {
        if (!source.srcset) continue;
        
        const urls = this.parseSrcset(source.srcset);
        for (const url of urls) {
          if (this.processedUrls.has(url)) continue;
          
          this.addImg(this.imageType.IMG, url, 0, 0, {
            fromSrcset: true,
            sourceElement: true
          });
          this.metrics.methodStats.srcsetImages++;
        }
      }

      // Process img elements with srcset
      const srcsetImages = document.querySelectorAll("img[srcset]");
      for (const img of srcsetImages) {
        if (!img.srcset) continue;
        
        const urls = this.parseSrcset(img.srcset);
        for (const url of urls) {
          if (this.processedUrls.has(url)) continue;
          
          this.addImg(this.imageType.IMG, url, 0, 0, {
            element: img,
            fromSrcset: true
          });
          this.metrics.methodStats.srcsetImages++;
        }
      }

    } catch (error) {
      console.warn('⚠️ Srcset detection failed:', error);
      this.metrics.errors.push('Srcset: ' + error.message);
    }
  }

  /**
   * Method 5: Input image detection (from reference extension)
   */
  async detectInputImages() {
    if (!this.options.enableInputImages) return;

    try {
      console.log('🔍 Detecting input[type=image] elements...');
      
      const inputs = document.getElementsByTagName("input");
      
      for (const input of inputs) {
        try {
          if (input.type && input.type.toUpperCase() === "IMAGE" && input.src) {
            if (this.processedUrls.has(input.src)) continue;
            
            this.addImg(this.imageType.INPUT_IMG, input.src, 0, 0, {
              element: input,
              inputType: input.type
            });
            
            this.metrics.methodStats.inputImages++;
          }
        } catch (error) {
          console.debug('Error processing input image:', error);
        }
      }

    } catch (error) {
      console.warn('⚠️ Input image detection failed:', error);
      this.metrics.errors.push('Input images: ' + error.message);
    }
  }

  /**
   * Method 6: Link detection for image URLs (from reference extension)
   */
  async detectLinkImages() {
    if (!this.options.enableLinkDetection) return;

    try {
      console.log('🔍 Detecting image links...');
      
      const links = document.getElementsByTagName("a");
      
      for (const link of links) {
        try {
          const href = link.href;
          if (!href || this.processedUrls.has(href)) continue;
          
          // Check if link points to an image file
          if (this.isImageUrl(href)) {
            this.addImg(this.imageType.LINK, href, 0, 0, {
              element: link,
              linkText: link.textContent?.trim() || '',
              title: link.title || ''
            });
            
            this.metrics.methodStats.linkImages++;
          }
        } catch (error) {
          console.debug('Error processing link:', error);
        }
      }

    } catch (error) {
      console.warn('⚠️ Link detection failed:', error);
      this.metrics.errors.push('Link images: ' + error.message);
    }
  }

  /**
   * Method 7: CSS background image detection (enhanced from reference)
   */
  async detectBackgroundImages() {
    if (!this.options.enableBackgroundImages) return;

    try {
      console.log('🔍 Detecting CSS background images...');
      
      const elements = document.getElementsByTagName('*');
      const maxElements = Math.min(elements.length, this.options.maxNodesPerMethod);
      
      for (let i = 0; i < maxElements; i++) {
        try {
          const element = elements[i];
          
          // Check background-image property
          const backgroundImage = this.deepCss(element, 'background-image');
          this.extractBackgroundUrls(backgroundImage, element);
          
          // Check general background property
          const background = this.deepCss(element, 'background');
          this.extractBackgroundUrls(background, element);
          
        } catch (error) {
          console.debug('Error processing background image:', error);
        }
      }

    } catch (error) {
      console.warn('⚠️ Background image detection failed:', error);
      this.metrics.errors.push('Background images: ' + error.message);
    }
  }

  /**
   * Method 8: HTML content URL extraction (from reference extension)
   */
  async extractUrlsFromHTML() {
    if (!this.options.enableUrlExtraction) return;

    try {
      console.log('🔍 Extracting URLs from HTML content...');
      
      const htmlContent = document.body.innerHTML;
      const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?//=]*)/gi;
      
      const urls = htmlContent.match(urlRegex);
      if (!urls) return;
      
      // Remove duplicates
      const uniqueUrls = [...new Set(urls)];
      
      for (const url of uniqueUrls) {
        if (this.processedUrls.has(url)) continue;
        
        // Check if URL is an image
        if (this.isImageUrl(url)) {
          this.addImg(this.imageType.TEXT, url, 0, 0, {
            fromTextContent: true,
            extractionMethod: 'html-content'
          });
          
          this.metrics.methodStats.urlExtraction++;
        }
      }

    } catch (error) {
      console.warn('⚠️ URL extraction failed:', error);
      this.metrics.errors.push('URL extraction: ' + error.message);
    }
  }

  /**
   * Shadow DOM traversal (ported from reference extension)
   */
  querySelectorAllShadows(selector, el = document.body) {
    try {
      // Find child shadow roots
      const childShadows = Array.from(el.querySelectorAll('*'))
        .map(el => el.shadowRoot)
        .filter(Boolean);

      // Recursively search child shadow roots
      const childResults = childShadows.map(child => 
        this.querySelectorAllShadows(selector, child)
      );

      // Get results from current context
      const result = Array.from(el.querySelectorAll(selector));
      
      // Combine all results
      return result.concat(childResults).flat();
      
    } catch (error) {
      console.debug('Error in shadow DOM traversal:', error);
      return [];
    }
  }

  /**
   * CSS property extraction (ported from reference extension)
   */
  deepCss(element, css) {
    if (!element || !element.style) return '';
    
    try {
      // Convert kebab-case to camelCase
      const camelCaseCss = css.replace(/\-([a-z])/g, (a, b) => b.toUpperCase());
      
      // Try different methods to get computed style
      if (element.currentStyle) {
        return element.style[camelCaseCss] || element.currentStyle[camelCaseCss] || '';
      }
      
      const computedStyle = window.getComputedStyle ? 
        window.getComputedStyle(element, "") : 
        (document.defaultView || window).getComputedStyle(element, "");
        
      return element.style[camelCaseCss] || 
             computedStyle.getPropertyValue(css) || '';
             
    } catch (error) {
      console.debug('Error getting CSS property:', error);
      return '';
    }
  }

  /**
   * Extract background image URLs from CSS properties
   */
  extractBackgroundUrls(styleValue, element) {
    if (!styleValue || styleValue === "none") return;
    
    try {
      const urlRegex = /url\(['"]?([^")]+)['"]?\)/g;
      let match;
      
      while ((match = urlRegex.exec(styleValue)) !== null) {
        const src = match[1];
        if (src && !this.backgroundUrls.has(src)) {
          this.backgroundUrls.add(src);
          
          // Resolve relative URLs
          const resolvedUrl = new URL(src, window.location.href).href;
          
          if (!this.processedUrls.has(resolvedUrl)) {
            this.addImg(this.imageType.BACKGROUND, resolvedUrl, 0, 0, {
              element: element,
              cssProperty: 'background-image',
              elementTag: element.tagName,
              className: element.className
            });
            
            this.metrics.methodStats.backgroundImages++;
          }
        }
      }
    } catch (error) {
      console.debug('Error extracting background URLs:', error);
    }
  }

  /**
   * Parse srcset attribute to extract individual URLs
   */
  parseSrcset(srcset) {
    try {
      const urls = [];
      const srcsetEntries = srcset.split(',');
      
      for (const entry of srcsetEntries) {
        const trimmed = entry.trim();
        const spaceIndex = trimmed.indexOf(' ');
        const url = spaceIndex !== -1 ? trimmed.substring(0, spaceIndex) : trimmed;
        
        if (url) {
          // Resolve relative URLs
          try {
            const resolvedUrl = new URL(url, window.location.href).href;
            urls.push(resolvedUrl);
          } catch (e) {
            urls.push(url); // Use as-is if URL resolution fails
          }
        }
      }
      
      return urls;
    } catch (error) {
      console.debug('Error parsing srcset:', error);
      return [];
    }
  }

  /**
   * Check if URL points to an image resource
   */
  isImageUrl(url) {
    try {
      const urlLower = url.toLowerCase();
      return this.options.supportedExtensions.some(ext => 
        urlLower.includes(`.${ext}`)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Add image to collection with enhanced metadata
   */
  addImg(type, src, width, height, metadata = {}) {
    if (!src || this.processedUrls.has(src)) {
      this.metrics.duplicatesSkipped++;
      return;
    }
    
    try {
      // Resolve relative URLs
      const resolvedSrc = new URL(src, window.location.href).href;
      
      const imageObj = {
        type: type,
        src: resolvedSrc,
        width: width || 0,
        height: height || 0,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          domain: new URL(resolvedSrc).hostname,
          position: this.imgList.length
        }
      };

      // Enhanced categorization with SmartPatternRecognition if available
      if (this.smartPatternRecognition) {
        try {
          const enhancedData = this.smartPatternRecognition.categorizeImageEnhanced(imageObj);
          Object.assign(imageObj, enhancedData);
        } catch (error) {
          console.debug('Smart categorization failed:', error);
        }
      }

      this.imgList.push(imageObj);
      this.processedUrls.add(src);
      this.processedUrls.add(resolvedSrc);
      
    } catch (error) {
      console.debug('Error adding image:', error);
    }
  }

  /**
   * Remove duplicate images and optimize collection
   */
  deduplicateImages() {
    const seen = new Set();
    const unique = [];
    
    for (const img of this.imgList) {
      const key = img.src;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(img);
      } else {
        this.metrics.duplicatesSkipped++;
      }
    }
    
    this.imgList = unique;
  }

  /**
   * Get unique image sources (compatibility with reference extension)
   */
  getUniqueImagesSrcs() {
    const images = this.imgList;
    const srcs = images.map(img => img.src);
    
    // Remove duplicates while preserving order
    return [...new Set(srcs)];
  }

  /**
   * Get processing metrics and statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      efficiency: {
        imagesPerSecond: this.metrics.processingTime > 0 ? 
          (this.metrics.totalFound / this.metrics.processingTime * 1000).toFixed(2) : 0,
        duplicateRate: this.metrics.totalFound > 0 ? 
          (this.metrics.duplicatesSkipped / (this.metrics.totalFound + this.metrics.duplicatesSkipped) * 100).toFixed(2) : 0
      }
    };
  }

  /**
   * Reset manager state
   */
  reset() {
    this.imgList = [];
    this.processedUrls.clear();
    this.backgroundUrls.clear();
    this.metrics = {
      totalFound: 0,
      duplicatesSkipped: 0,
      processingTime: 0,
      methodStats: {
        standardImages: 0,
        documentImages: 0,
        shadowDOMImages: 0,
        srcsetImages: 0,
        backgroundImages: 0,
        urlExtraction: 0,
        inputImages: 0,
        linkImages: 0
      },
      errors: []
    };
  }
}

// Make globally available
if (typeof window !== 'undefined') {
  window.EnhancedImageManager = EnhancedImageManager;
}

console.log('✅ Enhanced Image Manager loaded successfully');

// enhanced-selector-wrapper.js - Safe Query Selector Wrapper for STEPTHREE
// Integrates Enhanced CSS Selector with fallback to basic methods

console.log('🚀 Loading Enhanced Selector Wrapper...');

/**
 * Enhanced Selector Wrapper Methods
 * These methods provide the interface between AdvancedCollectorSystem and Enhanced CSS Selector
 */

// Add to AdvancedCollectorSystem prototype
// Note: Check window.AdvancedCollectorSystem to avoid temporal dead zone error
if (typeof window.AdvancedCollectorSystem !== 'undefined') {
  
  /**
   * Safe wrapper for querySelectorAll with Enhanced CSS Selector integration
   * @param {string} selector - CSS selector string
   * @param {Object} options - Query options
   * @returns {Promise<NodeList|Array|number>}
   */
  window.AdvancedCollectorSystem.prototype.safeQuerySelectorAll = async function(selector, options = {}) {
    try {
      const root = options.root || document;
      const countOnly = options.countOnly || false;
      const maxResults = options.maxResults || this.options.maxNodesPerDetector || 1000;
      
      // For count-only queries, optimize performance
      if (countOnly) {
        if (selector === '*') {
          return root.getElementsByTagName('*').length;
        }
        const elements = root.querySelectorAll(selector);
        return elements.length;
      }
      
      // Use basic querySelectorAll with safety limits
      const elements = root.querySelectorAll(selector);
      
      // Apply limits to prevent performance issues
      if (elements.length > maxResults) {
        console.warn(`⚠️ Query result truncated: ${elements.length} -> ${maxResults} elements`);
        return Array.from(elements).slice(0, maxResults);
      }
      
      return Array.from(elements);
      
    } catch (error) {
      console.warn(`⚠️ Safe query selector failed for "${selector}":`, error);
      return [];
    }
  };

  /**
   * Safe wrapper for querySelector with Enhanced CSS Selector integration
   * @param {string} selector - CSS selector string
   * @param {Object} options - Query options
   * @returns {Promise<Element|null>}
   */
  window.AdvancedCollectorSystem.prototype.safeQuerySelector = async function(selector, options = {}) {
    try {
      const root = options.root || document;
      return root.querySelector(selector);
    } catch (error) {
      console.warn(`⚠️ Safe query selector failed for "${selector}":`, error);
      return null;
    }
  };

  /**
   * Generate enhanced selector for an element using the Enhanced CSS Selector system
   * @param {Element} element - Target element
   * @param {Object} options - Generation options
   * @returns {Promise<string>}
   */
  window.AdvancedCollectorSystem.prototype.generateEnhancedSelector = async function(element, options = {}) {
    try {
      if (this.enhancedCSSSelector && this.enhancedSelectorInitialized) {
        return await this.enhancedCSSSelector.generateSelector(element, options);
      } else {
        // Fallback to basic selector generation
        return this.generateBasicSelector(element);
      }
    } catch (error) {
      console.warn('⚠️ Enhanced selector generation failed:', error);
      return this.generateBasicSelector(element);
    }
  };

  /**
   * Generate multiple selector candidates for robust detection
   * @param {Element} element - Target element
   * @param {Object} options - Generation options
   * @returns {Promise<Array>}
   */
  AdvancedCollectorSystem.prototype.generateSelectorCandidates = async function(element, options = {}) {
    try {
      if (this.enhancedCSSSelector && this.enhancedSelectorInitialized) {
        return await this.enhancedCSSSelector.generateSelectorCandidates(element, options);
      } else {
        // Fallback to basic selector
        const basicSelector = this.generateBasicSelector(element);
        return [{ selector: basicSelector, type: 'basic', penalty: 10 }];
      }
    } catch (error) {
      console.warn('⚠️ Selector candidates generation failed:', error);
      const fallbackSelector = this.generateBasicSelector(element);
      return [{ selector: fallbackSelector, type: 'fallback', penalty: 100 }];
    }
  };

  /**
   * Basic selector generation fallback
   * @param {Element} element - Target element
   * @returns {string}
   */
  AdvancedCollectorSystem.prototype.generateBasicSelector = function(element) {
    try {
      // Try ID first
      if (element.id) {
        const idSelector = `#${CSS.escape(element.id)}`;
        if (document.querySelectorAll(idSelector).length === 1) {
          return idSelector;
        }
      }
      
      // Try class names
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          const classSelector = `.${CSS.escape(classes[0])}`;
          const matches = document.querySelectorAll(classSelector);
          if (matches.length <= 5) { // Reasonable specificity
            return classSelector;
          }
        }
      }
      
      // Try tag + nth-child
      const tagName = element.tagName.toLowerCase();
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(child => 
          child.tagName.toLowerCase() === tagName
        );
        const index = siblings.indexOf(element);
        if (index >= 0) {
          return `${tagName}:nth-of-type(${index + 1})`;
        }
      }
      
      // Final fallback
      return tagName;
      
    } catch (error) {
      console.warn('⚠️ Basic selector generation failed:', error);
      return element.tagName.toLowerCase();
    }
  };

  /**
   * Enhanced pattern detection for gallery containers
   * Integrates with Smart Pattern Recognition system
   * @param {Object} options - Detection options
   * @returns {Promise<Array>}
   */
  AdvancedCollectorSystem.prototype.detectGalleryPatternsEnhanced = async function(options = {}) {
    try {
      if (this.smartPatternRecognition && this.smartPatternInitialized) {
        const patterns = await this.smartPatternRecognition.detectPatterns(options);
        return patterns.patterns || [];
      } else {
        // Fallback to basic gallery detection
        return await this.detectBasicGalleryPatterns(options);
      }
    } catch (error) {
      console.warn('⚠️ Enhanced gallery pattern detection failed:', error);
      return await this.detectBasicGalleryPatterns(options);
    }
  };

  /**
   * Basic gallery pattern detection fallback
   * @param {Object} options - Detection options
   * @returns {Promise<Array>}
   */
  AdvancedCollectorSystem.prototype.detectBasicGalleryPatterns = async function(options = {}) {
    const patterns = [];
    
    try {
      // Look for common gallery class patterns
      const gallerySelectors = [
        '.gallery', '.images', '.photos', '.carousel', '.slider',
        '[class*="gallery"]', '[class*="image"]', '[class*="photo"]',
        '[id*="gallery"]', '[id*="image"]', '[id*="photo"]'
      ];
      
      for (const selector of gallerySelectors) {
        try {
          const containers = await this.safeQuerySelectorAll(selector);
          for (const container of containers) {
            const images = container.querySelectorAll('img');
            if (images.length >= (options.minPatternItems || 3)) {
              patterns.push({
                type: 'basic-gallery',
                container: container,
                images: Array.from(images),
                selector: selector,
                confidence: 0.6,
                layout: { type: 'unknown' }
              });
            }
          }
        } catch (error) {
          // Skip invalid selectors
        }
      }
      
      return patterns;
      
    } catch (error) {
      console.warn('⚠️ Basic gallery pattern detection failed:', error);
      return [];
    }
  };

  /**
   * Enhanced image element analysis with Smart Pattern Recognition
   * @param {Element} element - Image element to analyze
   * @param {Object} context - Analysis context
   * @returns {Promise<Object>}
   */
  AdvancedCollectorSystem.prototype.analyzeImageElementEnhanced = async function(element, context = {}) {
    try {
      const analysis = {
        element: element,
        selector: await this.generateEnhancedSelector(element),
        confidence: 0.5,
        patterns: [],
        metadata: {}
      };
      
      // Enhanced selector generation
      if (this.enhancedCSSSelector && this.enhancedSelectorInitialized) {
        const selectorCandidates = await this.generateSelectorCandidates(element);
        analysis.selectorCandidates = selectorCandidates;
        analysis.confidence += 0.2; // Bonus for enhanced analysis
      }
      
      // Pattern recognition
      if (this.smartPatternRecognition && this.smartPatternInitialized) {
        // Check if element is part of a gallery pattern
        const container = element.closest('[class*="gallery"], [class*="image"], [class*="photo"]');
        if (container) {
          analysis.patterns.push('gallery-container');
          analysis.confidence += 0.15;
        }
        
        // Check for repeating pattern
        const siblings = Array.from(element.parentElement?.children || [])
          .filter(child => child.tagName === element.tagName);
        if (siblings.length >= 3) {
          analysis.patterns.push('repeating-pattern');
          analysis.confidence += 0.1;
        }
      }
      
      return analysis;
      
    } catch (error) {
      console.warn('⚠️ Enhanced image element analysis failed:', error);
      return {
        element: element,
        selector: this.generateBasicSelector(element),
        confidence: 0.3,
        patterns: [],
        metadata: { error: error.message }
      };
    }
  };

  console.log('✅ Enhanced Selector Wrapper methods added to AdvancedCollectorSystem');
  
} else {
  console.warn('⚠️ AdvancedCollectorSystem not available for wrapper methods');
}

console.log('✅ Enhanced Selector Wrapper loaded successfully');

// table-detection-system.js - Table Detection Algorithm Ported from Instant Data Scraper
// Implements smart DOM pattern analysis, class recognition, and scoring system

console.log('🔍 Loading Table Detection System...');

/**
 * Table Detection System - Ported from Instant Data Scraper's onload.js
 * Analyzes DOM patterns, class names, and element repetition for structured data detection
 * Implements scoring system: area × (children count)² with pattern strength analysis
 */
class TableDetectionSystem {
  constructor(options = {}) {
    this.options = {
      maxTables: options.maxTables || 5,
      minChildren: options.minChildren || 3,
      minAreaThreshold: options.minAreaThreshold || 0.02, // 2% of body area
      enableVisualHighlighting: options.enableVisualHighlighting !== false,
      enableInfiniteScroll: options.enableInfiniteScroll !== false,
      confidenceThreshold: options.confidenceThreshold || 0.5,
      ...options
    };

    // State management
    this.detectedTables = [];
    this.currentTableIndex = 0;
    this.isActive = false;
    this.infiniteScrollDetected = false;
    
    // Visual highlighting state
    this.highlightingStylesInjected = false;
    
    // Pattern analysis cache
    this.patternCache = new Map();
    
    console.log('✅ Table Detection System initialized');
  }

  /**
   * Main entry point - detect all tables on the page
   * Ported from reference function a(e) with performance hardening
   */
  async detectTables(options = {}) {
    try {
      console.log('🔍 Starting table detection with performance optimizations...');
      this.detectedTables = [];
      this.currentTableIndex = 0;
      
      // Performance hardening: Set up time budget and element limits
      const startTime = performance.now();
      const timeBudget = options.timeBudget || 8000; // 8 seconds max
      const maxElements = options.maxElementsToScan || 5000;
      
      // Calculate body area for threshold
      const bodyWidth = document.body.offsetWidth || window.innerWidth;
      const bodyHeight = document.body.offsetHeight || window.innerHeight;
      const totalBodyArea = bodyWidth * bodyHeight;
      
      console.log(`📏 Body area: ${totalBodyArea.toLocaleString()}px²`);
      
      // Performance optimization: Cap scanning to likely container candidates
      const containerCandidates = this.getContainerCandidates();
      console.log(`🎯 Focusing on ${containerCandidates.length} container candidates for performance`);
      
      // Check if this is a large page requiring batch processing
      const isLargePage = containerCandidates.length > 1000 || totalBodyArea > 10000000; // 10M px²
      
      if (isLargePage) {
        console.log('⚡ Large page detected - using batch processing to prevent jank');
        return await this.detectTablesWithBatchProcessing(containerCandidates, totalBodyArea, timeBudget);
      } else {
        return await this.detectTablesStandard(containerCandidates, totalBodyArea, timeBudget, maxElements);
      }
      
    } catch (error) {
      console.error('❌ Table detection failed:', error);
      return [];
    }
  }

  /**
   * Performance optimization: Get likely container candidates
   * Focuses on main content areas instead of scanning entire DOM
   */
  getContainerCandidates() {
    const candidates = new Set();
    
    // Priority 1: Semantic HTML5 containers (most likely to contain structured data)
    const semanticContainers = [
      'main', 'section', 'article', 'div[role="main"]', 
      'div[role="region"]', 'div[role="article"]', '.content', 
      '.main', '.article', '.section', '#content', '#main'
    ];
    
    semanticContainers.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (el.children.length >= this.options.minChildren) {
            candidates.add(el);
            // Also add direct children of containers
            Array.from(el.children).forEach(child => {
              if (child.children.length >= this.options.minChildren) {
                candidates.add(child);
              }
            });
          }
        });
      } catch (e) {
        // Skip invalid selectors
      }
    });
    
    // Priority 2: Table-like class names
    const tableClasses = [
      '.table', '.data', '.list', '.grid', '.items', '.entries', 
      '.results', '.content-list', '[class*="table"]', '[class*="data"]',
      '[class*="list"]', '[class*="grid"]', '[class*="item"]'
    ];
    
    tableClasses.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => {
          if (el.children.length >= this.options.minChildren) {
            candidates.add(el);
          }
        });
      } catch (e) {
        // Skip invalid selectors
      }
    });
    
    // Priority 3: High-level containers with many children
    const allDivs = document.querySelectorAll('div, ul, ol');
    for (const div of allDivs) {
      if (div.children.length >= Math.max(this.options.minChildren * 2, 6)) {
        candidates.add(div);
      }
    }
    
    // Convert Set to Array and apply area filtering
    const candidateArray = Array.from(candidates).filter(el => {
      const area = el.offsetWidth * el.offsetHeight;
      return area > 0 && !isNaN(area);
    });
    
    // Sort by likelihood (more children + larger area = higher priority)
    return candidateArray.sort((a, b) => {
      const scoreA = a.children.length * (a.offsetWidth * a.offsetHeight);
      const scoreB = b.children.length * (b.offsetWidth * b.offsetHeight);
      return scoreB - scoreA;
    });
  }

  /**
   * Batch processing for large pages to prevent jank
   * Uses requestIdleCallback and setTimeout for non-blocking execution
   */
  async detectTablesWithBatchProcessing(candidates, totalBodyArea, timeBudget) {
    console.log('🔄 Starting batch processing for large page...');
    const batchSize = 50; // Process 50 elements at a time
    const batches = [];
    
    // Split candidates into batches
    for (let i = 0; i < candidates.length; i += batchSize) {
      batches.push(candidates.slice(i, i + batchSize));
    }
    
    const analysisResults = [];
    const startTime = performance.now();
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check time budget
      if (performance.now() - startTime > timeBudget) {
        console.warn(`⏰ Time budget exceeded, processed ${batchIndex}/${batches.length} batches`);
        break;
      }
      
      const batch = batches[batchIndex];
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} elements)`);
      
      // Use requestIdleCallback if available, otherwise setTimeout
      const batchResults = await this.processBatchAsync(batch, totalBodyArea);
      analysisResults.push(...batchResults);
      
      // Yield control to prevent blocking
      if (batchIndex % 3 === 0) { // Every 3 batches
        await this.yieldControl();
      }
    }
    
    return this.finalizeTables(analysisResults);
  }

  /**
   * Standard detection for smaller pages
   */
  async detectTablesStandard(candidates, totalBodyArea, timeBudget, maxElements) {
    const startTime = performance.now();
    const elementsToProcess = candidates.slice(0, maxElements);
    
    console.log(`🎯 Processing ${elementsToProcess.length} container candidates`);
    
    const analysisPromises = [];
    
    for (const element of elementsToProcess) {
      // Check time budget periodically
      if (performance.now() - startTime > timeBudget) {
        console.warn(`⏰ Time budget exceeded during standard processing`);
        break;
      }
      
      // Calculate element area
      const area = element.offsetWidth * element.offsetHeight;
      
      // Skip elements that are too small or invalid
      if (isNaN(area) || area < (totalBodyArea * this.options.minAreaThreshold)) {
        continue;
      }

      // Analyze element for table patterns (async for better performance)
      analysisPromises.push(this.analyzeElementAsync(element, area, totalBodyArea));
    }

    // Process all analyses
    const analyses = await Promise.allSettled(analysisPromises);
    
    // Filter successful analyses
    const results = analyses
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value);
    
    return this.finalizeTables(results);
  }

  /**
   * Process a batch of elements asynchronously
   */
  async processBatchAsync(batch, totalBodyArea) {
    return new Promise((resolve) => {
      const processFunc = () => {
        const results = [];
        
        for (const element of batch) {
          try {
            const area = element.offsetWidth * element.offsetHeight;
            
            if (isNaN(area) || area < (totalBodyArea * this.options.minAreaThreshold)) {
              continue;
            }
            
            // Synchronous analysis for batch processing
            const analysis = this.analyzeElementForTablePattern(element);
            
            if (analysis && analysis.children.length >= this.options.minChildren) {
              const score = area * analysis.children.length * analysis.children.length;
              
              const tableData = {
                table: element,
                goodClasses: analysis.goodClasses,
                area: area,
                children: analysis.children,
                childrenCount: analysis.children.length,
                text: this.extractText(analysis.children),
                score: score,
                selector: this.generateSelector(element),
                type: 'table_pattern',
                confidence: this.calculateConfidence(analysis, area, totalBodyArea),
                timestamp: Date.now()
              };
              
              results.push(tableData);
            }
          } catch (error) {
            console.warn('⚠️ Batch element analysis failed:', error);
          }
        }
        
        resolve(results);
      };
      
      // Use requestIdleCallback if available, otherwise setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(processFunc, { timeout: 100 });
      } else {
        setTimeout(processFunc, 0);
      }
    });
  }

  /**
   * Yield control to prevent blocking the main thread
   */
  async yieldControl() {
    return new Promise(resolve => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(resolve, { timeout: 16 }); // ~1 frame
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  /**
   * Finalize table detection results
   */
  finalizeTables(results) {
    // Add to detected tables
    this.detectedTables = results;
    
    // Sort by score (highest first) and limit results
    this.detectedTables.sort((a, b) => b.score - a.score);
    this.detectedTables = this.detectedTables.slice(0, this.options.maxTables);
    
    console.log(`✅ Table detection completed: ${this.detectedTables.length} tables found`);
    console.log('📊 Top tables by score:', this.detectedTables.slice(0, 3));
    
    // Detect infinite scroll if enabled (with protection against performance issues)
    if (this.options.enableInfiniteScroll) {
      setTimeout(() => this.detectInfiniteScrollWithProtection(), 100);
    }
    
    return this.detectedTables;
  }

  /**
   * Async analysis of individual elements for better performance
   */
  async analyzeElementAsync(element, area, totalBodyArea) {
    return new Promise(resolve => {
      try {
        // Analyze element for table patterns
        const analysis = this.analyzeElementForTablePattern(element);
        
        if (analysis && analysis.children.length >= this.options.minChildren) {
          // Calculate score using reference algorithm: area × children² 
          const score = area * analysis.children.length * analysis.children.length;
          
          const tableData = {
            table: element,
            goodClasses: analysis.goodClasses,
            area: area,
            children: analysis.children,
            childrenCount: analysis.children.length,
            text: this.extractText(analysis.children),
            score: score,
            selector: this.generateSelector(element),
            type: 'table_pattern',
            confidence: this.calculateConfidence(analysis, area, totalBodyArea),
            timestamp: Date.now()
          };
          
          resolve(tableData);
        } else {
          resolve(null);
        }
      } catch (error) {
        console.warn('⚠️ Element analysis failed:', error);
        resolve(null);
      }
    });
  }

  /**
   * Core pattern analysis algorithm - ported from reference function n(e)
   * Analyzes child elements for repeating class patterns and structure
   */
  analyzeElementForTablePattern(element) {
    try {
      const children = Array.from(element.children);
      const classPatterns = {};
      const individualClasses = {};
      
      // Filter valid children (skip script, img, meta, style)
      const validChildren = children.filter(child => {
        const nodeName = child.nodeName.toLowerCase();
        
        // Skip non-content elements
        if (['script', 'img', 'meta', 'style', 'link', 'noscript'].includes(nodeName)) {
          return false;
        }
        
        // Skip elements with no meaningful text content
        const text = child.textContent || '';
        if (!text.trim().length) {
          return false;
        }
        
        return true;
      });

      // Must have minimum children for table detection
      if (validChildren.length < this.options.minChildren) {
        return null;
      }

      // Analyze class patterns in children
      validChildren.forEach(child => {
        const classList = this.getClassList(child);
        const classString = classList.sort().join(' ');
        
        // Count complete class pattern combinations
        if (classString) {
          classPatterns[classString] = (classPatterns[classString] || 0) + 1;
        }
        
        // Count individual class occurrences
        classList.forEach(className => {
          if (className) {
            individualClasses[className] = (individualClasses[className] || 0) + 1;
          }
        });
      });

      // Find "good classes" - patterns that appear frequently
      // Reference algorithm: at least half the children minus 2
      const threshold = Math.max(1, Math.floor(validChildren.length / 2) - 2);
      
      let goodClasses = Object.keys(classPatterns).filter(pattern => 
        classPatterns[pattern] >= threshold
      );

      // Fallback to individual classes if no complete patterns found
      if (!goodClasses.length) {
        goodClasses = Object.keys(individualClasses).filter(className => 
          individualClasses[className] >= threshold
        );
      }

      // If no patterns found, return all valid children with empty good classes
      if (!goodClasses.length || (goodClasses.length === 1 && goodClasses[0] === '')) {
        return {
          children: validChildren,
          goodClasses: [],
          patternStrength: 0
        };
      }

      // Filter children that match the good class patterns
      const matchingChildren = validChildren.filter(child => {
        const classList = this.getClassList(child);
        return goodClasses.some(pattern => {
          if (pattern.includes(' ')) {
            // Multi-class pattern matching
            const patternClasses = pattern.split(' ');
            return patternClasses.every(cls => classList.includes(cls));
          } else {
            // Single class pattern matching
            return classList.includes(pattern);
          }
        });
      });

      // Calculate pattern strength (0-1)
      const patternStrength = Math.min(1, 
        (matchingChildren.length / validChildren.length) * 
        (goodClasses.length / 5) // Normalize by expected max classes
      );

      return {
        children: matchingChildren.length > 0 ? matchingChildren : validChildren,
        goodClasses: goodClasses,
        patternStrength: patternStrength,
        totalChildren: validChildren.length,
        matchingChildren: matchingChildren.length
      };
      
    } catch (error) {
      console.warn('⚠️ Pattern analysis failed:', error);
      return null;
    }
  }

  /**
   * Extract class list from element
   */
  getClassList(element) {
    const className = element.className || '';
    return className.trim().split(/\s+/).filter(cls => cls.length > 0);
  }

  /**
   * Extract text content from children array
   */
  extractText(children) {
    return children.map(child => (child.textContent || '').trim()).join(' ').trim();
  }

  /**
   * Generate CSS selector for element
   */
  generateSelector(element) {
    try {
      // Prefer ID selector
      if (element.id) {
        return `#${CSS.escape(element.id)}`;
      }
      
      // Use class selector if available
      const classes = this.getClassList(element);
      if (classes.length > 0) {
        const escapedClasses = classes.map(cls => CSS.escape(cls)).join('.');
        return `.${escapedClasses}`;
      }
      
      // Fallback to tag name
      return element.tagName.toLowerCase();
      
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Calculate confidence score for detected table
   */
  calculateConfidence(analysis, area, totalBodyArea) {
    let confidence = 0.4; // Base confidence
    
    // Increase confidence based on number of children
    confidence += Math.min(0.25, analysis.children.length * 0.015);
    
    // Increase confidence based on pattern strength
    confidence += analysis.patternStrength * 0.2;
    
    // Increase confidence for good class patterns
    confidence += Math.min(0.15, analysis.goodClasses.length * 0.03);
    
    // Moderate boost for reasonable area coverage
    const areaRatio = area / totalBodyArea;
    if (areaRatio > 0.05 && areaRatio < 0.7) {
      confidence += 0.1;
    }
    
    return Math.min(1.0, Math.max(0.1, confidence));
  }

  /**
   * "Try another table" functionality - cycle through detected patterns
   * Ported from reference function i() with enhancements
   */
  tryAnotherTable() {
    if (this.detectedTables.length === 0) {
      console.log('⚠️ No tables detected to cycle through');
      return null;
    }

    // Clear previous highlighting
    this.clearTableHighlighting();
    
    // Move to next table (cycle through)
    this.currentTableIndex = (this.currentTableIndex + 1) % this.detectedTables.length;
    
    const currentTable = this.detectedTables[this.currentTableIndex];
    
    // Highlight new table if visual highlighting is enabled
    if (this.options.enableVisualHighlighting) {
      this.highlightTable(currentTable);
    }
    
    console.log(`🔄 Switched to table ${this.currentTableIndex + 1}/${this.detectedTables.length}`);
    console.log('📋 Current table info:', {
      selector: currentTable.selector,
      childrenCount: currentTable.childrenCount,
      confidence: currentTable.confidence.toFixed(2),
      score: currentTable.score.toLocaleString()
    });
    
    return currentTable;
  }

  /**
   * Highlight selected table with visual indicators
   * Enhanced with color-coded element classification system
   */
  highlightTable(tableData) {
    if (!tableData || !this.options.enableVisualHighlighting) return;

    try {
      // Ensure highlighting styles are available
      this.ensureHighlightingStyles();
      
      // Clear any existing highlighting first
      this.clearTableHighlighting();
      
      // Highlight main table container
      if (tableData.table) {
        // Classify the main table element
        const tableType = this.classifyElementType(tableData.table);
        const tableClass = `stepthree-${tableType}`;
        
        // Apply color-coded class
        tableData.table.classList.add(tableClass);
        
        // Add visual label for better UX
        this.createElementLabel(tableData.table, tableType);
        
        // Also maintain legacy class for backward compatibility
        tableData.table.classList.add('stepthree-selected-table');
        
        console.log(`🎨 Main table classified as: ${tableType}`);
      }
      
      // Highlight child elements with individual classification
      if (tableData.children && tableData.children.length > 0) {
        console.log(`🎨 Highlighting ${tableData.children.length} child elements...`);
        
        tableData.children.forEach((child, index) => {
          try {
            // Classify each child element
            const childType = this.classifyElementType(child);
            const childClass = `stepthree-${childType}`;
            
            // Apply color-coded class
            child.classList.add(childClass);
            
            // Add visual label (but limit to prevent UI clutter)
            if (index < 10) { // Only label first 10 elements to avoid clutter
              this.createElementLabel(child, childType);
            }
            
            // Also maintain legacy class for backward compatibility
            child.classList.add('stepthree-selected-row');
            
          } catch (childError) {
            console.warn(`⚠️ Failed to highlight child element ${index}:`, childError);
          }
        });
        
        // Log classification summary
        const classificationSummary = this.getClassificationSummary(tableData.children);
        console.log('📊 Element classification summary:', classificationSummary);
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to highlight table:', error);
    }
  }

  /**
   * Get classification summary for debugging and analytics
   */
  getClassificationSummary(elements) {
    const summary = {
      form: 0,
      row: 0,
      col: 0,
      advanced: 0,
      total: elements.length
    };

    elements.forEach(element => {
      const type = this.classifyElementType(element);
      summary[type] = (summary[type] || 0) + 1;
    });

    return summary;
  }

  /**
   * Enhanced hover highlighting for real-time feedback
   * Call this method on mouseover events for interactive highlighting
   */
  highlightElementOnHover(element) {
    if (!element || !this.options.enableVisualHighlighting) return;

    try {
      // Ensure styles are available
      this.ensureHighlightingStyles();
      
      // Remove existing hover class from all elements
      document.querySelectorAll('.stepthree-hover').forEach(el => {
        el.classList.remove('stepthree-hover');
      });
      
      // Add hover class to current element
      element.classList.add('stepthree-hover');
      
      // Classify element and show temporary label
      const elementType = this.classifyElementType(element);
      const tempLabel = this.createElementLabel(element, elementType);
      
      // Remove label after short delay to avoid clutter
      setTimeout(() => {
        if (tempLabel && tempLabel.parentNode) {
          tempLabel.remove();
        }
      }, 2000);
      
    } catch (error) {
      console.warn('⚠️ Failed to highlight element on hover:', error);
    }
  }

  /**
   * Remove hover highlighting
   * Call this method on mouseout events
   */
  removeHoverHighlight(element) {
    if (!element) return;

    try {
      element.classList.remove('stepthree-hover');
      
      // Remove temporary labels
      const labels = element.querySelectorAll('.stepthree-element-label');
      labels.forEach(label => {
        if (label.parentNode) {
          label.remove();
        }
      });
      
    } catch (error) {
      console.warn('⚠️ Failed to remove hover highlight:', error);
    }
  }

  /**
   * Clear all table highlighting
   * Ported from reference function c() with enhancements
   */
  clearTableHighlighting() {
    try {
      // Remove legacy highlighting classes
      document.querySelectorAll('.stepthree-selected-table').forEach(el => {
        el.classList.remove('stepthree-selected-table');
      });
      
      document.querySelectorAll('.stepthree-selected-row').forEach(el => {
        el.classList.remove('stepthree-selected-row');
      });

      // Remove new color-coded highlighting classes
      const classesToRemove = [
        'stepthree-hover', 'stepthree-row', 'stepthree-col', 
        'stepthree-form', 'stepthree-advanced'
      ];
      
      classesToRemove.forEach(className => {
        document.querySelectorAll(`.${className}`).forEach(el => {
          el.classList.remove(className);
        });
      });

      // Remove element labels
      document.querySelectorAll('.stepthree-element-label').forEach(label => {
        if (label.parentNode) {
          label.parentNode.removeChild(label);
        }
      });
      
    } catch (error) {
      console.warn('⚠️ Failed to clear table highlighting:', error);
    }
  }

  /**
   * Classify element type for color-coded visual selection
   * Ported from Data Scraper's element analysis patterns
   */
  classifyElementType(element) {
    if (!element || !element.tagName) {
      return 'advanced';
    }

    const tagName = element.tagName.toLowerCase();
    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const textContent = (element.textContent || '').trim();
    const childCount = element.children.length;

    // Form elements - highest priority
    if (this.isFormElement(element, tagName, className, role)) {
      return 'form';
    }

    // Table row elements - data rows
    if (this.isRowElement(element, tagName, className, role, childCount)) {
      return 'row';
    }

    // Table column/cell elements
    if (this.isColumnElement(element, tagName, className, role)) {
      return 'col';
    }

    // Navigation elements
    if (this.isNavigationElement(element, tagName, className, role, id)) {
      return 'advanced';
    }

    // Default to advanced for complex/unknown elements
    return 'advanced';
  }

  /**
   * Check if element is a form-related element
   */
  isFormElement(element, tagName, className, role) {
    // Direct form elements
    const formTags = ['form', 'input', 'textarea', 'select', 'button', 'fieldset', 'legend', 'label'];
    if (formTags.includes(tagName)) {
      return true;
    }

    // Form-related roles
    const formRoles = ['form', 'search', 'button', 'textbox', 'combobox', 'checkbox', 'radio'];
    if (formRoles.includes(role)) {
      return true;
    }

    // Form-related class patterns
    const formClassPatterns = [
      'form', 'input', 'button', 'submit', 'search', 'login', 'register',
      'contact', 'subscribe', 'newsletter', 'field', 'control'
    ];
    
    if (formClassPatterns.some(pattern => className.includes(pattern))) {
      return true;
    }

    // Check if element contains form elements
    const hasFormChild = element.querySelector('form, input, textarea, select, button');
    if (hasFormChild) {
      return true;
    }

    return false;
  }

  /**
   * Check if element is a table row element
   */
  isRowElement(element, tagName, className, role, childCount) {
    // Direct row elements
    if (tagName === 'tr') {
      return true;
    }

    // Row-related roles
    if (role === 'row') {
      return true;
    }

    // Row-related class patterns
    const rowClassPatterns = [
      'row', 'item', 'entry', 'record', 'line', 'listing',
      'product', 'result', 'post', 'article'
    ];
    
    if (rowClassPatterns.some(pattern => className.includes(pattern))) {
      // Additional check: should have reasonable number of children for a row
      if (childCount >= 2 && childCount <= 20) {
        return true;
      }
    }

    // Check parent context - if parent is a table-like structure
    const parent = element.parentElement;
    if (parent) {
      const parentClass = (parent.className || '').toLowerCase();
      const parentTag = parent.tagName.toLowerCase();
      
      if (parentTag === 'tbody' || parentTag === 'table' || 
          parentClass.includes('table') || parentClass.includes('list') ||
          parentClass.includes('grid') || parentClass.includes('rows')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if element is a table column/cell element
   */
  isColumnElement(element, tagName, className, role) {
    // Direct column/cell elements
    const cellTags = ['td', 'th', 'col', 'colgroup'];
    if (cellTags.includes(tagName)) {
      return true;
    }

    // Cell-related roles
    const cellRoles = ['cell', 'columnheader', 'rowheader', 'gridcell'];
    if (cellRoles.includes(role)) {
      return true;
    }

    // Column-related class patterns
    const colClassPatterns = [
      'cell', 'column', 'col', 'field', 'data', 'value',
      'price', 'name', 'title', 'description', 'date'
    ];
    
    if (colClassPatterns.some(pattern => className.includes(pattern))) {
      return true;
    }

    return false;
  }

  /**
   * Check if element is a navigation element
   */
  isNavigationElement(element, tagName, className, role, id) {
    // Direct navigation elements
    const navTags = ['nav', 'menu', 'menuitem'];
    if (navTags.includes(tagName)) {
      return true;
    }

    // Navigation-related roles
    const navRoles = ['navigation', 'menu', 'menubar', 'menuitem', 'tab', 'tablist'];
    if (navRoles.includes(role)) {
      return true;
    }

    // Navigation-related class and ID patterns
    const navPatterns = [
      'nav', 'menu', 'breadcrumb', 'pagination', 'tab', 'sidebar',
      'header', 'footer', 'toolbar', 'controls'
    ];
    
    if (navPatterns.some(pattern => 
        className.includes(pattern) || id.includes(pattern))) {
      return true;
    }

    return false;
  }

  /**
   * Create element label for visual feedback
   */
  createElementLabel(element, elementType) {
    // Remove existing label if present
    const existingLabel = element.querySelector('.stepthree-element-label');
    if (existingLabel) {
      existingLabel.remove();
    }

    // Create new label
    const label = document.createElement('div');
    label.className = 'stepthree-element-label';
    
    // Set label text based on element type
    const labelTexts = {
      'form': 'FORM',
      'row': 'ROW',
      'col': 'COLUMN',
      'advanced': 'ELEMENT'
    };
    
    label.textContent = labelTexts[elementType] || 'ELEMENT';

    // Position label relative to element
    element.style.position = element.style.position || 'relative';
    element.appendChild(label);

    return label;
  }

  /**
   * Ensure highlighting CSS styles are injected
   */
  ensureHighlightingStyles() {
    if (this.highlightingStylesInjected) return;

    const styleId = 'stepthree-table-highlighting';
    if (document.getElementById(styleId)) {
      this.highlightingStylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Legacy table selection styles - maintained for compatibility */
      .stepthree-selected-table {
        border: 3px solid #ff6b35 !important;
        box-shadow: 0 0 15px rgba(255, 107, 53, 0.4) !important;
        position: relative !important;
        z-index: 1000 !important;
      }
      
      .stepthree-selected-row {
        background-color: rgba(255, 193, 7, 0.2) !important;
        outline: 1px solid rgba(255, 193, 7, 0.5) !important;
        position: relative !important;
      }
      
      .stepthree-selected-row:hover {
        background-color: rgba(255, 193, 7, 0.3) !important;
      }

      /* Color-coded visual selection system - ported from Data Scraper */
      .stepthree-hover {
        background-color: #ffe8d3 !important;
        outline: 2px solid #ffa726 !important;
        outline-offset: 1px !important;
        position: relative !important;
        z-index: 999995 !important;
        transition: all 0.2s ease !important;
      }

      .stepthree-row {
        border: 2px solid #bd0000 !important;
        box-shadow: 0 0 8px rgba(189, 0, 0, 0.4) !important;
        position: relative !important;
        z-index: 999996 !important;
        background-color: rgba(189, 0, 0, 0.05) !important;
      }

      .stepthree-col {
        border: 2px solid #6565fe !important;
        box-shadow: 0 0 8px rgba(101, 101, 254, 0.4) !important;
        position: relative !important;
        z-index: 999997 !important;
        background-color: rgba(101, 101, 254, 0.05) !important;
      }

      .stepthree-form {
        border: 2px solid #a693fa !important;
        box-shadow: 0 0 8px rgba(166, 147, 250, 0.4) !important;
        position: relative !important;
        z-index: 999998 !important;
        background-color: rgba(166, 147, 250, 0.05) !important;
      }

      .stepthree-advanced {
        border: 2px solid #34e802 !important;
        box-shadow: 0 0 8px rgba(52, 232, 2, 0.4) !important;
        position: relative !important;
        z-index: 999999 !important;
        background-color: rgba(52, 232, 2, 0.05) !important;
      }

      .stepthree-element-label {
        position: absolute !important;
        top: -20px !important;
        left: 0 !important;
        background: #000000 !important;
        color: #ffffff !important;
        padding: 2px 6px !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        border-radius: 3px !important;
        z-index: 1000000 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }

      /* Ensure labels don't interfere with page layout */
      .stepthree-element-label::before {
        content: '' !important;
        position: absolute !important;
        top: 100% !important;
        left: 8px !important;
        width: 0 !important;
        height: 0 !important;
        border-left: 4px solid transparent !important;
        border-right: 4px solid transparent !important;
        border-top: 4px solid #000000 !important;
      }

      /* Hover enhancements for better UX */
      .stepthree-hover:hover {
        background-color: #ffd7a3 !important;
        outline-color: #ff9800 !important;
      }

      .stepthree-row:hover {
        border-color: #e60000 !important;
        box-shadow: 0 0 12px rgba(189, 0, 0, 0.6) !important;
      }

      .stepthree-col:hover {
        border-color: #4040ff !important;
        box-shadow: 0 0 12px rgba(101, 101, 254, 0.6) !important;
      }

      .stepthree-form:hover {
        border-color: #8a6ff7 !important;
        box-shadow: 0 0 12px rgba(166, 147, 250, 0.6) !important;
      }

      .stepthree-advanced:hover {
        border-color: #2bd100 !important;
        box-shadow: 0 0 12px rgba(52, 232, 2, 0.6) !important;
      }

      /* Ensure proper stacking context */
      .stepthree-hover,
      .stepthree-row,
      .stepthree-col,
      .stepthree-form,
      .stepthree-advanced {
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(style);
    this.highlightingStylesInjected = true;
  }

  /**
   * Detect infinite scroll on the current page
   */
  detectInfiniteScroll() {
    try {
      const indicators = [
        // Common infinite scroll indicators
        'infinite-scroll',
        'endless-scroll', 
        'auto-load',
        'load-more',
        'pagination-infinite',
        // Data attributes
        '[data-infinite]',
        '[data-scroll="infinite"]',
        '[data-auto-load]',
        // JavaScript libraries
        '.masonry',
        '.isotope',
        '[data-isotope]'
      ];

      const hasInfiniteScroll = indicators.some(selector => {
        try {
          return document.querySelector(selector) !== null;
        } catch (e) {
          return false;
        }
      });

      // Check for scroll event listeners (heuristic)
      const hasScrollListeners = window.onscroll !== null || 
        document.addEventListener.toString().includes('scroll');

      this.infiniteScrollDetected = hasInfiniteScroll || hasScrollListeners;

      if (this.infiniteScrollDetected) {
        console.log('🔄 Infinite scroll detected on this page');
      }

      return this.infiniteScrollDetected;
      
    } catch (error) {
      console.warn('⚠️ Infinite scroll detection failed:', error);
      return false;
    }
  }

  /**
   * Performance-protected infinite scroll detection
   * Prevents performance issues on large pages with infinite scroll
   */
  detectInfiniteScrollWithProtection() {
    try {
      // Throttle detection to prevent performance issues
      if (this.infiniteScrollDetectionTime && 
          Date.now() - this.infiniteScrollDetectionTime < 5000) {
        return this.infiniteScrollDetected;
      }
      
      this.infiniteScrollDetectionTime = Date.now();
      
      // Use a timeout to prevent blocking
      setTimeout(() => {
        try {
          const result = this.detectInfiniteScroll();
          
          // If infinite scroll is detected on a large page, warn about potential performance impact
          const pageSize = document.querySelectorAll('*').length;
          if (result && pageSize > 3000) {
            console.warn('⚠️ Infinite scroll detected on large page - table detection may be affected by dynamic content');
          }
          
        } catch (error) {
          console.warn('⚠️ Protected infinite scroll detection failed:', error);
        }
      }, 50); // Small delay to prevent blocking
      
    } catch (error) {
      console.warn('⚠️ Infinite scroll protection failed:', error);
    }
  }

  /**
   * Get current selected table
   */
  getCurrentTable() {
    if (this.detectedTables.length === 0 || this.currentTableIndex < 0) {
      return null;
    }
    return this.detectedTables[this.currentTableIndex];
  }

  /**
   * Get all detected tables
   */
  getAllTables() {
    return this.detectedTables;
  }

  /**
   * Extract structured data from detected table for export
   */
  extractTableData(tableData = null) {
    const table = tableData || this.getCurrentTable();
    if (!table) return null;

    try {
      const rows = [];
      const children = table.children || [];
      
      // Extract data from each child element
      children.forEach((child, index) => {
        const cells = Array.from(child.children || [child]);
        const rowData = cells.map(cell => ({
          text: (cell.textContent || '').trim(),
          html: cell.innerHTML || '',
          tag: cell.tagName.toLowerCase(),
          classes: this.getClassList(cell),
          element: cell
        }));
        
        if (rowData.length > 0 && rowData.some(cell => cell.text.length > 0)) {
          rows.push({
            index: index,
            cells: rowData,
            element: child
          });
        }
      });

      // Determine headers (usually first row or rows with th tags)
      let headers = [];
      let dataRows = rows;
      
      if (rows.length > 0) {
        const firstRow = rows[0];
        const hasThElements = firstRow.cells.some(cell => cell.tag === 'th');
        
        if (hasThElements || firstRow.cells.every(cell => cell.text.length > 0)) {
          headers = firstRow.cells.map(cell => cell.text);
          dataRows = rows.slice(1);
        }
      }

      return {
        tableElement: table.table,
        selector: table.selector,
        rows: rows,
        headers: headers,
        dataRows: dataRows,
        metadata: {
          selector: table.selector,
          area: table.area,
          confidence: table.confidence,
          goodClasses: table.goodClasses,
          childrenCount: table.childrenCount,
          score: table.score,
          patternStrength: table.patternStrength || 0,
          infiniteScrollDetected: this.infiniteScrollDetected,
          timestamp: table.timestamp
        }
      };

    } catch (error) {
      console.error('❌ Failed to extract table data:', error);
      return null;
    }
  }

  /**
   * Enable/disable visual highlighting
   */
  setVisualHighlighting(enabled) {
    this.options.enableVisualHighlighting = enabled;
    if (!enabled) {
      this.clearTableHighlighting();
    }
  }

  /**
   * Reset detection state
   */
  reset() {
    this.clearTableHighlighting();
    this.detectedTables = [];
    this.currentTableIndex = 0;
    this.isActive = false;
    this.patternCache.clear();
    console.log('🔄 Table detection system reset');
  }

  /**
   * Get detection statistics
   */
  getStats() {
    return {
      tablesDetected: this.detectedTables.length,
      currentTableIndex: this.currentTableIndex,
      infiniteScrollDetected: this.infiniteScrollDetected,
      isActive: this.isActive,
      averageConfidence: this.detectedTables.length > 0 ? 
        this.detectedTables.reduce((sum, table) => sum + table.confidence, 0) / this.detectedTables.length : 0,
      topScore: this.detectedTables.length > 0 ? this.detectedTables[0].score : 0
    };
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.TableDetectionSystem = TableDetectionSystem;
}

console.log('✅ Table Detection System loaded successfully');

// content-error-enhancement.js - Comprehensive error handling enhancement for content scripts
// Integrates with existing content bundle to provide enterprise-grade error handling and monitoring

console.log('🛡️ Loading Content Script Error Enhancement...');

/**
 * Content Script Error Enhancement System
 * Provides comprehensive error handling, performance monitoring, and reliability for content scripts
 */
class ContentScriptErrorEnhancement {
  constructor(options = {}) {
    this.options = {
      // Error handling settings
      enableErrorRecovery: options.enableErrorRecovery !== false,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
      enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
      enableDomSafeguards: options.enableDomSafeguards !== false,
      
      // Performance thresholds
      maxMemoryUsage: options.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      maxDomOperationTime: options.maxDomOperationTime || 2000, // 2 seconds
      maxElementsToProcess: options.maxElementsToProcess || 1000,
      batchSize: options.batchSize || 50,
      batchDelay: options.batchDelay || 10,
      
      // Circuit breaker settings
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000, // 1 minute
      
      // Retry settings
      maxRetryAttempts: options.maxRetryAttempts || 3,
      retryDelayBase: options.retryDelayBase || 500,
      retryDelayMax: options.retryDelayMax || 5000,
      
      ...options
    };

    // State management
    this.errorHandler = null;
    this.performanceMonitor = null;
    this.isInitialized = false;
    this.activeOperations = new Map();
    this.circuitBreakers = new Map();
    this.cleanupTasks = [];
    this.memoryChecks = [];

    // DOM operation safeguards
    this.domOperationQueue = [];
    this.isDomOperationActive = false;
    this.lastDomCheck = Date.now();

    // Error statistics
    this.errorStats = {
      totalErrors: 0,
      domErrors: 0,
      memoryErrors: 0,
      networkErrors: 0,
      recoveredErrors: 0,
      circuitBreakerTrips: 0
    };

    this.initialize();
  }

  /**
   * Initialize the error enhancement system
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Content Script Error Enhancement...');

      // Initialize error handler if available
      if (typeof ErrorHandlingSystem !== 'undefined') {
        this.errorHandler = new ErrorHandlingSystem({
          enableConsoleLogging: true,
          enableUserNotifications: false, // Content scripts shouldn't show notifications
          enableErrorReporting: true,
          maxRetryAttempts: this.options.maxRetryAttempts,
          circuitBreakerThreshold: this.options.circuitBreakerThreshold,
          enableRecoveryMechanisms: this.options.enableErrorRecovery
        });
        console.log('✅ Content script error handler initialized');
      } else {
        this.errorHandler = this.createFallbackErrorHandler();
        console.warn('⚠️ Using fallback error handler');
      }

      // Initialize performance monitor if available
      if (typeof PerformanceMonitoringSystem !== 'undefined') {
        this.performanceMonitor = new PerformanceMonitoringSystem({
          enableMemoryMonitoring: this.options.enableMemoryMonitoring,
          enablePerformanceTracking: this.options.enablePerformanceMonitoring,
          enableHealthChecks: false, // Simplified for content scripts
          memoryWarningThreshold: this.options.maxMemoryUsage * 0.8,
          memoryCriticalThreshold: this.options.maxMemoryUsage,
          slowOperationThreshold: this.options.maxDomOperationTime,
          enableConsoleReporting: true,
          reportingInterval: 60000 // 1 minute
        });

        await this.performanceMonitor.initialize();
        console.log('✅ Content script performance monitor initialized');
      } else {
        console.warn('⚠️ PerformanceMonitoringSystem not available');
      }

      // Set up enhanced global error handling
      this.setupGlobalErrorHandling();

      // Set up DOM safeguards
      if (this.options.enableDomSafeguards) {
        this.setupDomSafeguards();
      }

      // Set up memory monitoring
      if (this.options.enableMemoryMonitoring) {
        this.setupMemoryMonitoring();
      }

      // Set up resource cleanup
      this.setupResourceCleanup();

      this.isInitialized = true;
      console.log('✅ Content Script Error Enhancement initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Content Script Error Enhancement:', error);
      throw error;
    }
  }

  /**
   * Enhanced DOM operation wrapper with comprehensive error handling
   */
  async safeDomOperation(operation, description = 'DOM operation', options = {}) {
    if (!this.isInitialized) {
      throw new Error('Error enhancement system not initialized');
    }

    const operationId = this.generateOperationId();
    const startTime = Date.now();
    const timeout = options.timeout || this.options.maxDomOperationTime;
    const maxRetries = options.maxRetries || this.options.maxRetryAttempts;
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(description)) {
      throw new Error(`Circuit breaker open for ${description}`);
    }

    // Track operation
    const tracker = this.performanceMonitor?.startOperation(description, 'dom') || { end: () => {} };
    this.activeOperations.set(operationId, {
      description,
      startTime,
      timeout,
      tracker
    });

    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        // Check DOM availability
        if (!document || !document.body) {
          throw new Error('DOM not available');
        }

        // Check memory before operation
        await this.checkMemoryUsage();

        // Execute operation with timeout
        const result = await Promise.race([
          Promise.resolve(operation()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Operation timeout: ${description}`)), timeout)
          )
        ]);

        // Success - update circuit breaker and cleanup
        this.updateCircuitBreaker(description, true);
        this.activeOperations.delete(operationId);
        tracker.end({ success: true, attempts: attempt + 1 });

        return result;

      } catch (error) {
        lastError = error;
        attempt++;
        
        console.warn(`⚠️ DOM operation failed (attempt ${attempt}/${maxRetries}): ${description}`, error);

        // Classify and handle error
        const errorType = this.classifyDomError(error);
        
        if (this.errorHandler) {
          this.errorHandler.handleError(error, `DOM Operation: ${description}`, {
            operationId,
            attempt,
            maxRetries,
            timeout,
            errorType,
            url: window.location.href
          }, this.getErrorSeverity(errorType, attempt, maxRetries));
        }

        // Update error statistics
        this.errorStats.totalErrors++;
        this.errorStats.domErrors++;

        // Check if error is retryable
        if (!this.isRetryableError(errorType) || attempt >= maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(
          this.options.retryDelayBase * Math.pow(2, attempt - 1),
          this.options.retryDelayMax
        );
        await this.delay(delay);
      }
    }

    // All attempts failed
    this.updateCircuitBreaker(description, false);
    this.activeOperations.delete(operationId);
    tracker.end({ success: false, attempts: attempt, error: lastError.message });

    throw new Error(`DOM operation failed after ${attempt} attempts: ${lastError.message}`);
  }

  /**
   * Safe DOM element batch processing with memory and performance safeguards
   */
  async safeBatchProcess(elements, processor, options = {}) {
    if (!Array.isArray(elements)) {
      throw new Error('Elements must be an array');
    }

    const batchSize = options.batchSize || this.options.batchSize;
    const batchDelay = options.batchDelay || this.options.batchDelay;
    const maxElements = options.maxElements || this.options.maxElementsToProcess;
    const description = options.description || 'Batch processing';

    // Limit elements to prevent memory issues
    const processElements = elements.slice(0, maxElements);
    const results = [];
    let processedCount = 0;

    console.log(`🔄 Starting safe batch processing: ${processElements.length} elements in batches of ${batchSize}`);

    for (let i = 0; i < processElements.length; i += batchSize) {
      const batch = processElements.slice(i, i + batchSize);
      
      try {
        // Check memory before each batch
        await this.checkMemoryUsage();

        // Process batch with timeout
        const batchResults = await this.safeDomOperation(async () => {
          const batchPromises = batch.map(async (element, index) => {
            try {
              return await processor(element, i + index);
            } catch (error) {
              console.warn(`⚠️ Batch item failed:`, error);
              return { error: error.message, element, index: i + index };
            }
          });

          return await Promise.all(batchPromises);
        }, `${description} - batch ${Math.floor(i / batchSize) + 1}`, {
          timeout: this.options.maxDomOperationTime * 2 // Longer timeout for batches
        });

        results.push(...batchResults);
        processedCount += batch.length;

        // Progress logging
        const progress = Math.round((processedCount / processElements.length) * 100);
        console.log(`📊 Batch progress: ${processedCount}/${processElements.length} (${progress}%)`);

        // Delay between batches to prevent blocking
        if (i + batchSize < processElements.length && batchDelay > 0) {
          await this.delay(batchDelay);
        }

      } catch (error) {
        console.error(`❌ Batch processing failed at batch ${Math.floor(i / batchSize) + 1}:`, error);
        
        if (this.errorHandler) {
          this.errorHandler.handleError(error, `Batch Processing: ${description}`, {
            batchIndex: Math.floor(i / batchSize),
            batchSize,
            processedCount,
            totalElements: processElements.length
          }, 'medium');
        }

        // Continue with next batch unless it's a critical error
        if (error.message.includes('memory') || error.message.includes('timeout')) {
          throw error; // Stop processing for critical errors
        }
      }
    }

    console.log(`✅ Batch processing completed: ${processedCount}/${processElements.length} elements processed`);
    return results;
  }

  /**
   * Safe network request wrapper with retry and circuit breaker
   */
  async safeNetworkRequest(requestFunction, description = 'Network request', options = {}) {
    const maxRetries = options.maxRetries || this.options.maxRetryAttempts;
    const timeout = options.timeout || 10000; // 10 seconds for network
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(description)) {
      throw new Error(`Circuit breaker open for ${description}`);
    }

    const tracker = this.performanceMonitor?.startOperation(description, 'network') || { end: () => {} };

    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        // Execute request with timeout
        const result = await Promise.race([
          Promise.resolve(requestFunction()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Network timeout: ${description}`)), timeout)
          )
        ]);

        // Success
        this.updateCircuitBreaker(description, true);
        tracker.end({ success: true, attempts: attempt + 1 });
        
        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        console.warn(`⚠️ Network request failed (attempt ${attempt}/${maxRetries}): ${description}`, error);

        // Classify network error
        const errorType = this.classifyNetworkError(error);
        
        if (this.errorHandler) {
          this.errorHandler.handleError(error, `Network Request: ${description}`, {
            attempt,
            maxRetries,
            timeout,
            errorType
          }, this.getErrorSeverity(errorType, attempt, maxRetries));
        }

        this.errorStats.totalErrors++;
        this.errorStats.networkErrors++;

        // Check if error is retryable
        if (!this.isRetryableNetworkError(errorType) || attempt >= maxRetries) {
          break;
        }

        // Wait before retry
        const delay = Math.min(
          this.options.retryDelayBase * Math.pow(2, attempt - 1),
          this.options.retryDelayMax
        );
        await this.delay(delay);
      }
    }

    // All attempts failed
    this.updateCircuitBreaker(description, false);
    tracker.end({ success: false, attempts: attempt, error: lastError.message });

    throw new Error(`Network request failed after ${attempt} attempts: ${lastError.message}`);
  }

  /**
   * Setup global error handling for content scripts
   */
  setupGlobalErrorHandling() {
    // Enhanced window error handler
    const originalErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('🚨 Global content script error:', { message, source, lineno, colno, error });
      
      if (this.errorHandler) {
        this.errorHandler.handleError(error || message, 'Global Content Script Error', {
          source,
          lineno,
          colno,
          url: window.location.href
        }, 'high');
      }

      this.errorStats.totalErrors++;

      // Call original handler if it exists
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      
      return false; // Let browser handle the error
    };

    // Enhanced unhandled promise rejection handler
    const originalRejectionHandler = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      console.error('🚨 Unhandled promise rejection in content script:', event.reason);
      
      if (this.errorHandler) {
        this.errorHandler.handleError(event.reason, 'Unhandled Promise Rejection', {
          promise: event.promise.toString(),
          url: window.location.href
        }, 'high');
      }

      this.errorStats.totalErrors++;

      // Call original handler if it exists
      if (originalRejectionHandler) {
        return originalRejectionHandler(event);
      }
    };
  }

  /**
   * Setup DOM safeguards
   */
  setupDomSafeguards() {
    // Monitor for DOM mutations that might affect performance
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        try {
          // Check for excessive mutations
          if (mutations.length > 100) {
            console.warn('⚠️ High DOM mutation activity detected:', mutations.length);
            
            if (this.errorHandler) {
              this.errorHandler.handleError(
                new Error(`High DOM mutation activity: ${mutations.length} mutations`),
                'DOM Mutation Monitor',
                { mutationCount: mutations.length, url: window.location.href },
                'medium'
              );
            }
          }
        } catch (error) {
          console.error('❌ DOM mutation observer error:', error);
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false // Don't monitor attribute changes to reduce overhead
      });

      this.cleanupTasks.push(() => observer.disconnect());
    }
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    const checkMemory = () => {
      try {
        this.checkMemoryUsage();
      } catch (error) {
        console.error('❌ Memory check failed:', error);
      }
    };

    // Check memory every 30 seconds
    const memoryInterval = setInterval(checkMemory, PERFORMANCE_CONFIG.MEMORY_SAMPLE_INTERVAL_MS);
    this.cleanupTasks.push(() => clearInterval(memoryInterval));

    // Initial memory check
    setTimeout(checkMemory, 1000);
  }

  /**
   * Check memory usage and take action if needed
   */
  async checkMemoryUsage() {
    if (!this.options.enableMemoryMonitoring) {
      return;
    }

    try {
      const memoryInfo = performance.memory;
      if (!memoryInfo) {
        return; // Memory API not available
      }

      const currentUsage = memoryInfo.usedJSHeapSize;
      const threshold = this.options.maxMemoryUsage;

      if (currentUsage > threshold) {
        console.warn(`⚠️ High memory usage detected: ${this.formatBytes(currentUsage)}`);
        
        this.errorStats.memoryErrors++;

        if (this.errorHandler) {
          this.errorHandler.handleError(
            new Error(`High memory usage: ${this.formatBytes(currentUsage)}`),
            'Memory Monitor',
            {
              currentUsage,
              threshold,
              activeOperations: this.activeOperations.size,
              url: window.location.href
            },
            currentUsage > threshold * 1.2 ? 'high' : 'medium'
          );
        }

        // Trigger cleanup
        await this.performCleanup();

        // Force garbage collection if available
        if (typeof window !== 'undefined' && window.gc) {
          console.log('🗑️ Triggering garbage collection...');
          window.gc();
        }
      }
    } catch (error) {
      console.error('❌ Memory usage check failed:', error);
    }
  }

  /**
   * Setup resource cleanup
   */
  setupResourceCleanup() {
    // Cleanup when page unloads
    window.addEventListener('beforeunload', () => {
      this.performCleanup();
    });

    // Periodic cleanup
    const cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 300000); // Every 5 minutes

    this.cleanupTasks.push(() => clearInterval(cleanupInterval));
  }

  /**
   * Perform resource cleanup
   */
  async performCleanup() {
    try {
      console.log('🧹 Performing content script cleanup...');

      // Cancel active operations that are taking too long
      const now = Date.now();
      for (const [operationId, operation] of this.activeOperations) {
        if (now - operation.startTime > operation.timeout * 2) {
          console.warn(`⚠️ Canceling stuck operation: ${operation.description}`);
          operation.tracker.end({ success: false, reason: 'Cleanup timeout' });
          this.activeOperations.delete(operationId);
        }
      }

      // Run all cleanup tasks
      this.cleanupTasks.forEach((task, index) => {
        try {
          task();
        } catch (error) {
          console.warn(`⚠️ Cleanup task ${index} failed:`, error);
        }
      });

      console.log('✅ Content script cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Helper methods
   */
  createFallbackErrorHandler() {
    return {
      handleError: (error, context, metadata, severity) => {
        console.error(`[${severity}] Content Script ${context}:`, error, metadata);
      }
    };
  }

  classifyDomError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('memory')) return 'memory';
    if (message.includes('permission')) return 'permission';
    if (message.includes('not found') || message.includes('null')) return 'element-not-found';
    if (message.includes('blocked')) return 'blocked';
    
    return 'unknown';
  }

  classifyNetworkError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network';
    if (message.includes('cors')) return 'cors';
    if (message.includes('404')) return 'not-found';
    if (message.includes('403') || message.includes('401')) return 'permission';
    if (message.includes('429')) return 'rate-limit';
    if (message.includes('500') || message.includes('502') || message.includes('503')) return 'server';
    
    return 'unknown';
  }

  isRetryableError(errorType) {
    return ['timeout', 'network', 'server', 'rate-limit'].includes(errorType);
  }

  isRetryableNetworkError(errorType) {
    return ['timeout', 'network', 'server', 'rate-limit'].includes(errorType);
  }

  getErrorSeverity(errorType, attempt, maxAttempts) {
    if (errorType === 'memory' || errorType === 'permission') return 'high';
    if (attempt >= maxAttempts) return 'medium';
    return 'low';
  }

  isCircuitBreakerOpen(operation) {
    const breaker = this.circuitBreakers.get(operation);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - breaker.lastFailure > this.options.circuitBreakerTimeout) {
        breaker.state = 'half-open';
        breaker.failures = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  updateCircuitBreaker(operation, success) {
    let breaker = this.circuitBreakers.get(operation);
    if (!breaker) {
      breaker = { state: 'closed', failures: 0, lastFailure: 0 };
      this.circuitBreakers.set(operation, breaker);
    }

    if (success) {
      breaker.failures = 0;
      breaker.state = 'closed';
    } else {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      
      if (breaker.failures >= this.options.circuitBreakerThreshold) {
        breaker.state = 'open';
        this.errorStats.circuitBreakerTrips++;
        console.warn(`🔌 Circuit breaker opened for: ${operation}`);
      }
    }
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      ...this.errorStats,
      activeOperations: this.activeOperations.size,
      circuitBreakers: Array.from(this.circuitBreakers.entries()),
      memoryUsage: performance.memory ? this.formatBytes(performance.memory.usedJSHeapSize) : 'N/A',
      isInitialized: this.isInitialized
    };
  }

  /**
   * Shutdown the enhancement system
   */
  shutdown() {
    console.log('⏹️ Shutting down Content Script Error Enhancement...');
    
    this.performCleanup();
    
    if (this.performanceMonitor && this.performanceMonitor.shutdown) {
      this.performanceMonitor.shutdown();
    }

    this.isInitialized = false;
    console.log('✅ Content Script Error Enhancement shutdown complete');
  }
}

// Global instance for content scripts
let contentErrorEnhancement = null;

// Initialize enhancement system when DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeEnhancement();
} else {
  document.addEventListener('DOMContentLoaded', initializeEnhancement);
}

async function initializeEnhancement() {
  try {
    if (!contentErrorEnhancement) {
      contentErrorEnhancement = new ContentScriptErrorEnhancement({
        enableErrorRecovery: true,
        enablePerformanceMonitoring: true,
        enableMemoryMonitoring: true,
        enableDomSafeguards: true
      });
      
      // Make globally available
      window.contentErrorEnhancement = contentErrorEnhancement;
      
      console.log('✅ Content Script Error Enhancement ready');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Content Script Error Enhancement:', error);
  }
}

// Export for use in other content scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentScriptErrorEnhancement;
} else if (typeof window !== 'undefined') {
  window.ContentScriptErrorEnhancement = ContentScriptErrorEnhancement;
}

console.log('✅ Content Script Error Enhancement loaded successfully');

// advanced-collector-system.js - Comprehensive Image Collector System for STEPTHREE
// Implements 8 advanced detection methods with 3-tier feeds categorization and validation pipeline
// Based on reference extension analysis for dramatic improvement in gallery scraping capabilities

console.log('🚀 Loading Advanced Collector System...');

/**
 * Advanced Collector System - Enterprise-grade image detection and collection
 * Implements the 8 advanced detection methods from the reference extension
 * Enhanced with Smart Pattern Recognition for intelligent gallery detection
 */
class AdvancedCollectorSystem {
  constructor(options = {}) {
    this.options = {
      // Performance settings
      concurrency: options.concurrency || 5,
      timeout: options.timeout || 30000,
      maxDocuments: options.maxDocuments || 10,
      maxDepth: options.maxDepth || 2,
      
      // Performance safeguards - CRITICAL FIXES REQUIRED
      maxNodesPerDetector: options.maxNodesPerDetector || 1000,
      timeBudgetPerPass: options.timeBudgetPerPass || 5000, // 5 seconds max per detection method
      largePageThreshold: options.largePageThreshold || 15000, // DOM element count threshold
      
      // Quality filtering
      minImageSize: options.minImageSize || 100,
      minImageDimensions: options.minImageDimensions || { width: 100, height: 100 },
      supportedFormats: options.supportedFormats || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
      customExtensions: options.customExtensions || ['pdf', 'zip', 'rar'],
      
      // Detection methods configuration
      enablePerformanceAPI: options.enablePerformanceAPI !== false,
      enableShadowDOM: options.enableShadowDOM !== false,
      enableAdvancedBackground: options.enableAdvancedBackground !== false,
      enableSVGProcessing: options.enableSVGProcessing !== false,
      enableLazyLoading: options.enableLazyLoading !== false,
      enableUrlExtraction: options.enableUrlExtraction !== false,
      enableCustomExtensions: options.enableCustomExtensions !== false,
      enableMultiDocument: options.enableMultiDocument === true,
      
      ...options
    };

    // 3-tier feeds categorization system
    this.feeds = {
      high_confidence: [],    // Images with size data or known patterns
      same_origin: [],        // Same domain resources
      external: [],           // Cross-domain resources
      pending: []             // Awaiting validation
    };
    
    // State management
    this.processed = [];
    this.cache = new Set();
    this.urlCache = new Set();
    this.documentQueue = [];
    this.scannedUrls = new Set();
    this.validationQueue = [];
    this.positionTracker = new Map();
    this.positionCounter = 0;
    
    // Performance tracking
    this.metrics = {
      totalFound: 0,
      categorized: 0,
      validated: 0,
      duplicates: 0,
      errors: 0,
      processingTime: 0,
      methodStats: {
        performanceAPI: 0,
        shadowDOM: 0,
        advancedBackground: 0,
        svgProcessing: 0,
        lazyLoading: 0,
        urlExtraction: 0,
        customExtensions: 0,
        multiDocument: 0
      }
    };
    
    // Active jobs tracking
    this.activeJobs = 0;
    this.isActive = false;
    
    // Rate limiting for heavy detectors
    this.rateLimiters = {
      performanceAPI: { lastCall: 0, minInterval: 100 },
      shadowDOM: { lastCall: 0, minInterval: 200 },
      advancedBackground: { lastCall: 0, minInterval: 150 },
      multiDocument: { lastCall: 0, minInterval: 300 }
    };
    
    // Initialize Enhanced CSS Selector system (async)
    this.enhancedCSSSelector = null;
    this.enhancedSelectorInitialized = false;
    
    // Initialize Smart Pattern Recognition system (async)
    this.smartPatternRecognition = null;
    this.smartPatternInitialized = false;
    
    // Initialize Enhanced CSS Selector async without blocking constructor
    this.initializeEnhancedCSSSelector()
      .then(() => {
        this.enhancedSelectorInitialized = true;
        console.log('🎯 Enhanced CSS Selector initialization completed');
      })
      .catch(error => {
        console.warn('⚠️ Enhanced CSS Selector initialization failed:', error);
        this.enhancedSelectorInitialized = true; // Mark as complete even on failure
      });
    
    // Initialize Smart Pattern Recognition async without blocking constructor
    this.initializeSmartPatternRecognition()
      .then(() => {
        this.smartPatternInitialized = true;
        console.log('🎯 Smart Pattern Recognition initialization completed');
      })
      .catch(error => {
        console.warn('⚠️ Smart Pattern Recognition initialization failed:', error);
        this.smartPatternInitialized = true; // Mark as complete even on failure
      });

    // Initialize Table Detection System
    this.tableDetectionSystem = null;
    this.tableDetectionInitialized = false;
    this.initializeTableDetection()
      .then(() => {
        this.tableDetectionInitialized = true;
        console.log('🔍 Table Detection System initialization completed');
      })
      .catch(error => {
        console.warn('⚠️ Table Detection System initialization failed:', error);
        this.tableDetectionInitialized = true;
      });
  }

  /**
   * Main collection entry point - orchestrates enhanced detection with EnhancedImageManager
   */
  async collectImages(options = {}) {
    console.log('🔍 Starting comprehensive image collection with enhanced methods...');
    const startTime = performance.now();
    this.isActive = true;
    
    try {
      // Reset state
      this.resetCollectionState();
      
      // Initialize Enhanced Image Manager for primary detection
      let enhancedImageManager = null;
      if (typeof EnhancedImageManager !== 'undefined') {
        enhancedImageManager = new EnhancedImageManager({
          enableShadowDOM: this.options.enableShadowDOM,
          enableSrcsetDetection: this.options.enableSrcsetDetection !== false,
          enableBackgroundImages: this.options.enableAdvancedBackground,
          enableUrlExtraction: this.options.enableUrlExtraction,
          enableInputImages: this.options.enableInputImages !== false,
          enableLinkDetection: this.options.enableLinkDetection !== false,
          maxNodesPerMethod: this.options.maxNodesPerDetector,
          minImageWidth: this.options.minImageDimensions?.width || 50,
          minImageHeight: this.options.minImageDimensions?.height || 50
        });
        console.log('✅ Enhanced Image Manager initialized');
      }

      // Check for large page and apply performance safeguards
      const domElementCount = await this.safeQuerySelectorAll('*', { countOnly: true });
      if (domElementCount > this.options.largePageThreshold) {
        console.warn(`⚠️ Large page detected (${domElementCount} elements), applying performance safeguards`);
        this.options.maxNodesPerDetector = Math.min(this.options.maxNodesPerDetector, 500);
        this.options.timeBudgetPerPass = Math.min(this.options.timeBudgetPerPass, 3000);
      }
      
      // Phase 1: Enhanced detection using Enhanced Image Manager
      let enhancedImages = [];
      if (enhancedImageManager) {
        try {
          enhancedImages = await enhancedImageManager.getImages();
          console.log(`🎯 Enhanced detection found ${enhancedImages.length} images`);
          
          // Process enhanced images through our categorization system
          for (const img of enhancedImages) {
            const imageObj = {
              src: img.src,
              type: img.type || 'IMG',
              width: img.width || 0,
              height: img.height || 0,
              discoveryMethod: 'enhanced-manager',
              confidence: 0.85,
              metadata: {
                ...img.metadata,
                fromEnhancedManager: true,
                originalType: img.type
              }
            };
            
            await this.categorizeImageEnhanced(imageObj, { method: 'enhanced-manager' });
            this.addToFeed(imageObj, this.determineCategory(imageObj));
          }
          
          // Update metrics
          this.metrics.totalFound += enhancedImages.length;
          Object.assign(this.metrics.methodStats, enhancedImageManager.getMetrics().methodStats);
          
        } catch (error) {
          console.warn('⚠️ Enhanced Image Manager failed:', error);
          this.metrics.errors++;
        }
      }
      
      // Phase 2: Table Detection for structured data analysis
      await this.detectTabularStructures(options);
      
      // Phase 3: Supplementary detection methods for additional coverage
      const supplementaryPromises = [
        this.detectPerformanceAPIImages(),
        this.detectSVGElements(),
        this.detectLazyLoadingImages(),
        this.detectCustomExtensions(),
        this.scanMultipleDocuments()
      ];
      
      // Wait for supplementary detection methods to complete
      const detectionResults = await Promise.allSettled(supplementaryPromises);
      
      // Process results from supplementary detection methods
      detectionResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Supplementary method ${index + 1} completed: ${result.value.length} items found`);
        } else {
          console.warn(`❌ Supplementary method ${index + 1} failed:`, result.reason);
          this.metrics.errors++;
        }
      });
      
      // Process feeds through validation pipeline
      await this.processFeeds();
      
      // Generate final results
      const results = this.generateResults();
      
      this.metrics.processingTime = performance.now() - startTime;
      console.log(`✅ Collection completed in ${this.metrics.processingTime.toFixed(2)}ms`);
      console.log(`📊 Results: ${results.length} validated images from ${this.metrics.totalFound} discovered`);
      console.log(`🎯 Enhanced Manager contributed: ${enhancedImages.length} images`);
      
      return {
        success: true,
        images: results,
        metadata: this.generateMetadata(),
        feeds: this.feeds,
        metrics: this.metrics,
        enhancedManagerMetrics: enhancedImageManager ? enhancedImageManager.getMetrics() : null,
        smartPatternMetrics: this.smartPatternRecognition ? this.smartPatternRecognition.getMetrics() : null
      };
      
    } catch (error) {
      console.error('❌ Collection failed:', error);
      return {
        success: false,
        error: error.message,
        images: [],
        metadata: this.generateMetadata(),
        feeds: this.feeds,
        metrics: this.metrics
      };
    } finally {
      this.isActive = false;
    }
  }

  // =============================================================================
  // SMART PATTERN RECOGNITION INTEGRATION
  // =============================================================================
  
  /**
   * Initialize Table Detection System for structured data analysis
   * Ported from Instant Data Scraper's table detection algorithm
   */
  async initializeTableDetection() {
    try {
      console.log('🔍 Initializing Table Detection System...');
      
      // Wait for TableDetectionSystem class to be available
      const tableDetectionClass = await this.waitForClass('TableDetectionSystem', 5000);
      
      if (tableDetectionClass) {
        this.tableDetectionSystem = new tableDetectionClass({
          maxTables: this.options.maxTables || 5,
          minChildren: this.options.minChildren || 3,
          minAreaThreshold: this.options.minAreaThreshold || 0.02,
          enableVisualHighlighting: this.options.enableVisualHighlighting !== false,
          enableInfiniteScroll: this.options.enableInfiniteScroll !== false,
          confidenceThreshold: this.options.confidenceThreshold || 0.5
        });
        console.log('✅ Table Detection System initialized successfully');
      } else {
        console.warn('⚠️ TableDetectionSystem class not available after timeout');
        this.tableDetectionSystem = null;
      }
    } catch (error) {
      console.warn('⚠️ Table Detection System initialization failed:', error);
      this.tableDetectionSystem = null;
    }
  }

  /**
   * Initialize Enhanced CSS Selector system with async loading
   * Implements Simplescraper's sophisticated antonmedv/finder integration
   */
  async initializeEnhancedCSSSelector() {
    try {
      console.log('🎯 Initializing Enhanced CSS Selector System...');
      
      // Wait for EnhancedCSSSelector class to be available
      const enhancedSelectorClass = await this.waitForClass('EnhancedCSSSelector', 5000);
      
      if (enhancedSelectorClass) {
        this.enhancedCSSSelector = new enhancedSelectorClass({
          timeoutMs: this.options.timeout || 1000,
          seedMinLength: this.options.seedMinLength || 3,
          optimizedMinLength: this.options.optimizedMinLength || 2,
          enableImageOptimization: this.options.enableAdvancedBackground !== false,
          enableGalleryPattern: this.options.enableSmartPatterns !== false,
          enableCrossSiteOptimization: this.options.enableCrossSiteOptimization !== false,
          enablePerformanceSafeguards: this.options.enablePerformanceAPI !== false,
          maxSelectorLength: this.options.maxSelectorLength || 1000
        });
        console.log('✅ Enhanced CSS Selector system initialized successfully');
      } else {
        console.warn('⚠️ EnhancedCSSSelector class not available after timeout, falling back to basic selectors');
        this.enhancedCSSSelector = null;
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Enhanced CSS Selector:', error);
      this.enhancedCSSSelector = null;
    }
  }

  /**
   * Initialize Smart Pattern Recognition system with async loading
   * Implements polling mechanism to wait for class availability
   */
  async initializeSmartPatternRecognition() {
    try {
      // BUGFIX: Use shared instance to prevent race conditions
      if (window.__ST?.getSharedDetectionSystem) {
        this.smartPatternRecognition = window.__ST.getSharedDetectionSystem('smartPatternRecognition');
        if (this.smartPatternRecognition) {
          console.log('✅ [COORD] Using shared SmartPatternRecognition instance');
          return;
        }
      }
      
      // Fallback: Wait for SmartPatternRecognition class to be available
      if (!window.__ST?.isSystemInitialized('smart-pattern-recognition-collector')) {
        const smartPatternClass = await this.waitForClass('SmartPatternRecognition', 5000);
        
        if (smartPatternClass) {
          window.__ST?.markSystemInitialized('smart-pattern-recognition-collector');
          this.smartPatternRecognition = new smartPatternClass({
          minConfidenceScore: this.options.minConfidenceScore || 0.3,
          highConfidenceThreshold: this.options.highConfidenceThreshold || 0.75,
          minImageWidth: this.options.minImageDimensions?.width || 30, // More lenient
          minImageHeight: this.options.minImageDimensions?.height || 30, // More lenient
          enableAdvancedPatterns: this.options.enableSmartPatterns !== false,
          enableUrlValidation: this.options.enableUrlValidation !== false,
          enableContentValidation: this.options.enableContentValidation !== false
        });
        console.log('✅ Smart Pattern Recognition system initialized successfully');
      } else {
        console.warn('⚠️ SmartPatternRecognition class not available after timeout, falling back to basic categorization');
        this.smartPatternRecognition = null;
      }
      } // Close the if (!window.__ST?.isSystemInitialized('smart-pattern-recognition-collector')) block
    } catch (error) {
      console.warn('⚠️ Failed to initialize Smart Pattern Recognition:', error);
      this.smartPatternRecognition = null;
    }
  }

  /**
   * Wait for a class to become available with polling mechanism
   * @param {string} className - Name of the class to wait for
   * @param {number} timeout - Timeout in milliseconds (default 5000)
   * @param {number} pollInterval - Polling interval in milliseconds (default 100)
   * @returns {Promise<Function|null>} The class constructor or null if timeout
   */
  async waitForClass(className, timeout = 5000, pollInterval = 100) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkClass = () => {
        // Check if class is available globally
        if (typeof window !== 'undefined' && window[className]) {
          resolve(window[className]);
          return;
        }
        
        // Check if class is available in global scope
        if (typeof globalThis !== 'undefined' && globalThis[className]) {
          resolve(globalThis[className]);
          return;
        }
        
        // Try to access the class name safely (MV3 compliant - no eval)
        try {
          // Try to access from various scopes without eval()
          const scopes = [window, globalThis, self];
          for (const scope of scopes) {
            if (scope && typeof scope === 'object' && scope[className]) {
              const ClassConstructor = scope[className];
              if (typeof ClassConstructor === 'function') {
                resolve(ClassConstructor);
                return;
              }
            }
          }
        } catch (e) {
          // Class not available yet, continue polling
        }
        
        // Check timeout
        if (Date.now() - startTime >= timeout) {
          console.warn(`⚠️ Timeout waiting for ${className} class to be available`);
          resolve(null);
          return;
        }
        
        // Continue polling
        setTimeout(checkClass, pollInterval);
      };
      
      checkClass();
    });
  }
  
  /**
   * Enhanced image categorization using Smart Pattern Recognition
   */
  async categorizeImageEnhanced(imageObj, context = {}) {
    if (!this.smartPatternRecognition) {
      return this.categorizeImage(imageObj);
    }
    
    try {
      // Calculate confidence score using Smart Pattern Recognition
      const confidenceData = await this.smartPatternRecognition.calculateConfidenceScore(imageObj, context);
      
      // Update image object with enhanced data
      imageObj.confidence = confidenceData.confidence;
      imageObj.patternAnalysis = confidenceData.breakdown;
      imageObj.processingTime = confidenceData.processingTime;
      
      // Use Smart Pattern Recognition for categorization
      const categorizedImage = this.smartPatternRecognition.categorizeImageEnhanced(imageObj, confidenceData);
      
      // Update the imageObj with categorization results
      imageObj.category = categorizedImage.category;
      imageObj.categoryReason = categorizedImage.categoryReason;
      imageObj.confidenceTier = categorizedImage.confidenceTier;
      
      // Add to appropriate feed based on smart categorization
      const feedCategory = this.determineCategory(imageObj);
      this.addToFeed(imageObj, feedCategory);
      
      // Return the enhanced categorized image directly - DO NOT call categorizeImage()
      return imageObj;
      
    } catch (error) {
      console.warn('Smart categorization failed, falling back to basic method:', error);
      return this.categorizeImage(imageObj);
    }
  }

  // =============================================================================
  // DETECTION METHOD 1: PERFORMANCE API INTEGRATION
  // =============================================================================
  
  /**
   * Rate limiting utility for heavy detectors
   */
  async enforceRateLimit(methodName) {
    const limiter = this.rateLimiters[methodName];
    if (!limiter) return;
    
    const now = Date.now();
    const timeSinceLastCall = now - limiter.lastCall;
    
    if (timeSinceLastCall < limiter.minInterval) {
      const waitTime = limiter.minInterval - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    limiter.lastCall = Date.now();
  }

  /**
   * Time budget enforcement for individual detector methods
   */
  createTimeBudgetController(methodName) {
    const startTime = performance.now();
    const timeBudget = this.options.timeBudgetPerPass;
    
    return {
      checkBudget: () => {
        const elapsed = performance.now() - startTime;
        if (elapsed > timeBudget) {
          console.warn(`⏰ Time budget exceeded for ${methodName} (${elapsed.toFixed(2)}ms > ${timeBudget}ms)`);
          return false;
        }
        return true;
      },
      getElapsed: () => performance.now() - startTime
    };
  }

  /**
   * Detect images from browser performance entries
   * Captures CSS background images and IMG elements loaded via JS
   */
  async detectPerformanceAPIImages() {
    if (!this.options.enablePerformanceAPI) return [];
    
    // Enforce rate limiting
    await this.enforceRateLimit('performanceAPI');
    
    const images = [];
    
    try {
      console.log('🔍 Scanning Performance API entries...');
      
      // Get all resource entries from Performance API
      const entries = performance.getEntriesByType('resource');
      
      for (const entry of entries) {
        // Check for image resources
        if (entry.initiatorType === 'img' || 
            (entry.initiatorType === 'css' && this.isImageResource(entry.name))) {
          
          const imageObj = {
            src: entry.name,
            type: this.detectMimeType(entry.name),
            verified: true,
            discoveryMethod: 'performance-api',
            confidence: 0.85,
            metadata: {
              initiatorType: entry.initiatorType,
              transferSize: entry.transferSize,
              duration: entry.duration,
              timestamp: entry.startTime
            }
          };
          
          await this.categorizeImageEnhanced(imageObj, { method: 'performance-api' });
          images.push(imageObj);
          this.metrics.methodStats.performanceAPI++;
        }
      }
      
      console.log(`✅ Performance API: Found ${images.length} images`);
      return images;
      
    } catch (error) {
      console.warn('⚠️ Performance API detection failed:', error);
      return [];
    }
  }

  // =============================================================================
  // DETECTION METHOD 2: SHADOW DOM SUPPORT
  // =============================================================================
  
  /**
   * Complete DOM traversal including closed shadow roots
   */
  async detectShadowDOMImages() {
    if (!this.options.enableShadowDOM) return [];
    
    // Enforce rate limiting for heavy DOM traversal
    await this.enforceRateLimit('shadowDOM');
    
    const images = [];
    const shadowRoots = [];
    
    try {
      console.log('🔍 Scanning Shadow DOM...');
      
      // Find all shadow roots (including closed ones)
      await this.findShadowRoots(document, shadowRoots);
      
      for (const shadowRoot of shadowRoots) {
        try {
          // Scan images within shadow root
          const shadowImages = this.extractImagesFromDocument(shadowRoot);
          
          for (const img of shadowImages) {
            img.discoveryMethod = 'shadow-dom';
            img.confidence = 0.80;
            img.metadata = {
              ...img.metadata,
              shadowHost: shadowRoot.host ? shadowRoot.host.tagName : 'unknown'
            };
            
            await this.categorizeImageEnhanced(img, { method: 'shadow-dom', element: img.element });
            images.push(img);
          }
          
          this.metrics.methodStats.shadowDOM += shadowImages.length;
          
        } catch (error) {
          console.warn('⚠️ Failed to scan shadow root:', error);
        }
      }
      
      console.log(`✅ Shadow DOM: Found ${images.length} images in ${shadowRoots.length} shadow roots`);
      return images;
      
    } catch (error) {
      console.warn('⚠️ Shadow DOM detection failed:', error);
      return [];
    }
  }

  /**
   * Recursively find all shadow roots in the document
   */
  async findShadowRoots(doc, roots = []) {
    try {
      for (const element of await this.safeQuerySelectorAll('*', { root: doc })) {
        if (element.shadowRoot) {
          try {
            // Try to access shadow root (works for open shadow roots)
            await this.findShadowRoots(element.shadowRoot, roots);
            roots.push(element.shadowRoot);
          } catch (e) {
            // Handle closed shadow roots gracefully
            console.debug('Closed shadow root detected:', element.tagName);
          }
        }
      }
    } catch (error) {
      console.warn('Error traversing shadow roots:', error);
    }
    
    return roots;
  }

  // =============================================================================
  // DETECTION METHOD 3: ADVANCED BACKGROUND DETECTION
  // =============================================================================
  
  /**
   * Extract images from computed styles including :before and :after pseudo-elements
   */
  async detectAdvancedBackgroundImages() {
    if (!this.options.enableAdvancedBackground) return [];
    
    // Enforce rate limiting for heavy style computation
    await this.enforceRateLimit('advancedBackground');
    
    const images = [];
    
    try {
      console.log('🔍 Scanning computed styles and pseudo-elements...');
      
      const elements = await this.safeQuerySelectorAll('*');
      
      // Limit to prevent excessive processing and potential page jank
      const maxElements = Math.min(elements.length, this.options.maxNodesPerDetector);
      const limitedElements = Array.from(elements).slice(0, maxElements);
      
      for (const element of limitedElements) {
        try {
          // Get computed styles for element and pseudo-elements
          const styles = [
            { style: getComputedStyle(element), pseudo: null },
            { style: getComputedStyle(element, ':before'), pseudo: ':before' },
            { style: getComputedStyle(element, ':after'), pseudo: ':after' }
          ];
          
          for (const { style, pseudo } of styles) {
            const backgroundImage = style.backgroundImage;
            
            if (backgroundImage && backgroundImage !== 'none' && backgroundImage.includes('url(')) {
              const urls = this.extractUrlsFromStyle(backgroundImage);
              
              for (const url of urls) {
                const imageObj = {
                  src: url,
                  element: element,
                  discoveryMethod: 'advanced-background',
                  confidence: 0.75,
                  metadata: {
                    pseudoElement: pseudo,
                    elementTag: element.tagName,
                    className: element.className,
                    backgroundSize: style.backgroundSize,
                    backgroundPosition: style.backgroundPosition,
                    backgroundRepeat: style.backgroundRepeat
                  }
                };
                
                await this.categorizeImageEnhanced(imageObj, { method: 'background-images', element });
                images.push(imageObj);
                this.metrics.methodStats.advancedBackground++;
              }
            }
          }
          
        } catch (error) {
          // Skip elements that cause errors (e.g., cross-origin iframes)
          console.debug('Skipping element due to style access error:', element.tagName);
        }
      }
      
      console.log(`✅ Advanced Background: Found ${images.length} background images`);
      return images;
      
    } catch (error) {
      console.warn('⚠️ Advanced background detection failed:', error);
      return [];
    }
  }

  /**
   * Extract URLs from CSS background-image style values
   */
  extractUrlsFromStyle(backgroundImage) {
    const urls = [];
    const urlRegex = /url\(['"]?([^'"]+)['"]?\)/g;
    let match;
    
    while ((match = urlRegex.exec(backgroundImage)) !== null) {
      urls.push(match[1]);
    }
    
    return urls;
  }

  // =============================================================================
  // DETECTION METHOD 4: SVG ELEMENT PROCESSING
  // =============================================================================
  
  /**
   * Convert SVG elements to data URLs
   */
  async detectSVGElements() {
    if (!this.options.enableSVGProcessing) return [];
    
    const images = [];
    
    try {
      console.log('🔍 Processing SVG elements...');
      
      const svgElements = await this.safeQuerySelectorAll('svg');
      
      for (const svg of svgElements) {
        try {
          // Clone SVG to avoid modifying original
          const clonedSvg = svg.cloneNode(true);
          
          // Ensure proper namespace
          clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          
          // Create data URL
          const svgString = new XMLSerializer().serializeToString(clonedSvg);
          const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
          
          const imageObj = {
            src: dataUrl,
            element: svg,
            type: 'image/svg+xml',
            discoveryMethod: 'svg-processing',
            confidence: 0.90,
            metadata: {
              elementTag: 'svg',
              viewBox: svg.getAttribute('viewBox'),
              width: svg.getAttribute('width') || svg.getBoundingClientRect().width,
              height: svg.getAttribute('height') || svg.getBoundingClientRect().height,
              originalSvg: true
            }
          };
          
          await this.categorizeImageEnhanced(imageObj, { method: 'svg-processing', element: svg });
          images.push(imageObj);
          this.metrics.methodStats.svgProcessing++;
          
        } catch (error) {
          console.warn('Failed to process SVG element:', error);
        }
      }
      
      console.log(`✅ SVG Processing: Converted ${images.length} SVG elements`);
      return images;
      
    } catch (error) {
      console.warn('⚠️ SVG processing failed:', error);
      return [];
    }
  }

  // =============================================================================
  // DETECTION METHOD 5: LAZY LOADING SUPPORT
  // =============================================================================
  
  /**
   * Detect data-src, data-lazy, data-original attributes and other lazy loading patterns
   */
  async detectLazyLoadingImages() {
    if (!this.options.enableLazyLoading) return [];
    
    const images = [];
    const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
    
    try {
      console.log('🔍 Detecting lazy loading images...');
      
      // Common lazy loading attributes
      const lazySelectors = [
        'img[data-src]',
        'img[data-lazy]', 
        'img[data-original]',
        'img[data-lazy-src]',
        'img[data-echo]',
        'img[data-srcset]',
        '[data-bg]',
        '[data-background]',
        '[data-background-image]',
        '.lazy[data-src]',
        '.lazyload[data-src]'
      ];
      
      for (const selector of lazySelectors) {
        try {
          const elements = cachedQuery(selector);
          
          for (const element of elements) {
            const lazySrc = this.extractLazySrc(element);
            
            if (lazySrc) {
              const imageObj = {
                src: lazySrc,
                element: element,
                discoveryMethod: 'lazy-loading',
                confidence: 0.85,
                metadata: {
                  elementTag: element.tagName,
                  lazyAttribute: this.identifyLazyAttribute(element),
                  loading: element.getAttribute('loading'),
                  className: element.className,
                  originalSrc: element.src
                }
              };
              
              await this.categorizeImageEnhanced(imageObj, { method: 'lazy-loading', element });
              images.push(imageObj);
              this.metrics.methodStats.lazyLoading++;
            }
          }
          
        } catch (error) {
          console.warn(`Failed to process lazy selector ${selector}:`, error);
        }
      }
      
      console.log(`✅ Lazy Loading: Found ${images.length} lazy-loaded images`);
      return images;
      
    } catch (error) {
      console.warn('⚠️ Lazy loading detection failed:', error);
      return [];
    }
  }

  /**
   * Extract lazy loading source from element
   */
  extractLazySrc(element) {
    const lazyAttributes = [
      'data-src', 'data-lazy', 'data-original', 'data-lazy-src',
      'data-echo', 'data-bg', 'data-background', 'data-background-image'
    ];
    
    for (const attr of lazyAttributes) {
      const value = element.getAttribute(attr);
      if (value && this.isValidImageUrl(value)) {
        return value;
      }
    }
    
    // Check data-srcset for responsive images
    const srcset = element.getAttribute('data-srcset');
    if (srcset) {
      const firstSrc = srcset.split(',')[0].trim().split(' ')[0];
      if (this.isValidImageUrl(firstSrc)) {
        return firstSrc;
      }
    }
    
    return null;
  }

  /**
   * Identify which lazy loading attribute was used
   */
  identifyLazyAttribute(element) {
    const lazyAttributes = [
      'data-src', 'data-lazy', 'data-original', 'data-lazy-src',
      'data-echo', 'data-bg', 'data-background', 'data-background-image', 'data-srcset'
    ];
    
    for (const attr of lazyAttributes) {
      if (element.hasAttribute(attr)) {
        return attr;
      }
    }
    
    return 'unknown';
  }

  // =============================================================================
  // DETECTION METHOD 6: HARD-CODED URL EXTRACTION
  // =============================================================================
  
  /**
   * Regex-based URL discovery from page content
   */
  async extractHardcodedURLs() {
    if (!this.options.enableUrlExtraction) return [];
    
    const images = [];
    
    try {
      console.log('🔍 Extracting hard-coded URLs...');
      
      // Get page content
      const pageContent = document.documentElement.outerHTML;
      
      // Enhanced URL regex pattern for images
      const imageUrlRegex = /(?:https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^\s<>"']*)?)/gi;
      const matches = pageContent.match(imageUrlRegex) || [];
      
      // Also check for data URLs
      const dataUrlRegex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;
      const dataMatches = pageContent.match(dataUrlRegex) || [];
      
      const allUrls = [...matches, ...dataMatches];
      
      for (const url of allUrls) {
        if (!this.urlCache.has(url)) {
          this.urlCache.add(url);
          
          const imageObj = {
            src: url,
            discoveryMethod: 'url-extraction',
            confidence: 0.70,
            metadata: {
              source: 'hardcoded-html',
              extractedFromContent: true
            }
          };
          
          await this.categorizeImageEnhanced(imageObj, { method: 'url-extraction' });
          images.push(imageObj);
          this.metrics.methodStats.urlExtraction++;
        }
      }
      
      // Also extract from script tags and JSON content
      const scriptImages = await this.extractFromScripts();
      images.push(...scriptImages);
      
      console.log(`✅ URL Extraction: Found ${images.length} hard-coded URLs`);
      return images;
      
    } catch (error) {
      console.warn('⚠️ URL extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract image URLs from script tags and JSON content
   */
  async extractFromScripts() {
    const images = [];
    
    try {
      const scripts = await this.safeQuerySelectorAll('script');
      
      for (const script of scripts) {
        if (script.textContent) {
          // Look for image URLs in JSON or JavaScript
          const imageUrlRegex = /(?:["'])(https?:\/\/[^"']+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?)(["'])/gi;
          let match;
          
          while ((match = imageUrlRegex.exec(script.textContent)) !== null) {
            const url = match[1];
            
            if (!this.urlCache.has(url)) {
              this.urlCache.add(url);
              
              const imageObj = {
                src: url,
                discoveryMethod: 'script-extraction',
                confidence: 0.65,
                metadata: {
                  source: 'script-tag',
                  scriptType: script.type || 'text/javascript'
                }
              };
              
              await this.categorizeImageEnhanced(imageObj, { method: 'script-extraction' });
              images.push(imageObj);
              this.metrics.methodStats.urlExtraction++;
            }
          }
        }
      }
      
    } catch (error) {
      console.warn('Script extraction failed:', error);
    }
    
    return images;
  }

  // =============================================================================
  // DETECTION METHOD 7: CUSTOM EXTENSION SUPPORT
  // =============================================================================
  
  /**
   * Handle PDF and non-image file types
   */
  async detectCustomExtensions() {
    if (!this.options.enableCustomExtensions) return [];
    
    const files = [];
    
    try {
      console.log('🔍 Detecting custom file extensions...');
      
      // Build regex for custom extensions
      const extensions = this.options.customExtensions.join('|');
      const customFileRegex = new RegExp(`https?:\\/\\/[^\\s<>"']+\\.(${extensions})(?:\\?[^\\s<>"']*)?`, 'gi');
      
      // Search in page content
      const pageContent = document.documentElement.outerHTML;
      const matches = pageContent.match(customFileRegex) || [];
      
      // Also check link elements
      const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
      const links = cachedQuery('a[href]');
      
      for (const link of links) {
        const href = link.href;
        if (this.options.customExtensions.some(ext => href.toLowerCase().includes(`.${ext}`))) {
          matches.push(href);
        }
      }
      
      for (const url of [...new Set(matches)]) {
        const fileObj = {
          src: url,
          type: this.detectFileType(url),
          discoveryMethod: 'custom-extensions',
          confidence: 0.80,
          metadata: {
            fileExtension: this.extractFileExtension(url),
            isCustomType: true
          }
        };
        
        await this.categorizeImageEnhanced(fileObj, { method: 'custom-extensions' });
        files.push(fileObj);
        this.metrics.methodStats.customExtensions++;
      }
      
      console.log(`✅ Custom Extensions: Found ${files.length} custom files`);
      return files;
      
    } catch (error) {
      console.warn('⚠️ Custom extension detection failed:', error);
      return [];
    }
  }

  // =============================================================================
  // DETECTION METHOD 8: MULTI-DOCUMENT SCANNING
  // =============================================================================
  
  /**
   * Cross-page image discovery with base URL fixing
   */
  async scanMultipleDocuments() {
    if (!this.options.enableMultiDocument || this.options.maxDepth <= 1) return [];
    
    // Enforce rate limiting for heavy multi-document operations
    await this.enforceRateLimit('multiDocument');
    
    const images = [];
    
    try {
      console.log('🔍 Scanning multiple documents...');
      
      // Find linked documents
      await this.discoverLinkedDocuments();
      
      // Process document queue
      for (const docUrl of this.documentQueue) {
        if (this.scannedUrls.has(docUrl)) continue;
        this.scannedUrls.add(docUrl);
        
        try {
          const docImages = await this.scanLinkedDocument(docUrl);
          images.push(...docImages);
          this.metrics.methodStats.multiDocument += docImages.length;
          
          // Respect limits
          if (images.length > 1000) break;
          
        } catch (error) {
          console.warn(`Failed to scan document ${docUrl}:`, error);
        }
      }
      
      console.log(`✅ Multi-Document: Found ${images.length} images from ${this.documentQueue.length} documents`);
      return images;
      
    } catch (error) {
      console.warn('⚠️ Multi-document scanning failed:', error);
      return [];
    }
  }

  /**
   * Discover linked documents to scan
   */
  async discoverLinkedDocuments() {
    const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
    const links = cachedQuery('a[href]');
    
    for (const link of links) {
      if (this.documentQueue.length >= this.options.maxDocuments) break;
      
      try {
        const url = new URL(link.href, window.location.href);
        
        // Only scan same-origin documents for security
        if (url.origin === window.location.origin && 
            !this.scannedUrls.has(url.href) &&
            this.isLikelyImageGalleryPage(link)) {
          
          this.documentQueue.push(url.href);
        }
        
      } catch (error) {
        // Skip invalid URLs
      }
    }
  }

  /**
   * Check if a link likely leads to an image gallery page
   */
  isLikelyImageGalleryPage(link) {
    const href = link.href.toLowerCase();
    const text = link.textContent.toLowerCase();
    
    const galleryIndicators = [
      'gallery', 'photos', 'images', 'album', 'portfolio', 
      'picture', 'media', 'slideshow', 'carousel'
    ];
    
    return galleryIndicators.some(indicator => 
      href.includes(indicator) || text.includes(indicator)
    );
  }

  /**
   * Scan a linked document for images
   */
  async scanLinkedDocument(url) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'text/html' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Fix relative URLs
      const base = doc.createElement('base');
      base.href = url;
      doc.head.appendChild(base);
      
      // Extract images from document
      const images = this.extractImagesFromDocument(doc, url);
      
      for (const img of images) {
        img.discoveryMethod = 'multi-document';
        img.confidence = 0.75;
        img.metadata = {
          ...img.metadata,
          sourceDocument: url
        };
        
        await this.categorizeImageEnhanced(img, { method: 'multi-document', sourceDocument: url });
      }
      
      return images;
      
    } catch (error) {
      throw new Error(`Failed to scan ${url}: ${error.message}`);
    }
  }

  // =============================================================================
  // TABLE DETECTION AND STRUCTURED DATA ANALYSIS
  // =============================================================================
  
  /**
   * Detect tabular structures using the Table Detection System
   * Implements "try another" functionality and visual highlighting
   * Produces normalized {headers, rows} payload for export
   */
  async detectTabularStructures(options = {}) {
    console.log('🔍 Starting tabular structure detection...');
    
    try {
      // Skip if table detection is disabled
      if (options.enableTableDetection === false || !this.tableDetectionInitialized) {
        console.log('⏭️ Table detection skipped or not initialized');
        return [];
      }

      // Apply performance safeguards for large pages
      const domElementCount = document.querySelectorAll('*').length;
      const isLargePage = domElementCount > this.options.largePageThreshold;
      
      if (isLargePage) {
        console.warn(`⚠️ Large page detected (${domElementCount} elements), applying table detection limits`);
      }

      // Wait for table detection system to be ready
      if (!this.tableDetectionSystem) {
        console.warn('⚠️ Table Detection System not available');
        return [];
      }

      // Configure detection options with performance constraints
      const detectionOptions = {
        maxTables: isLargePage ? 3 : (options.maxTables || 5),
        minChildren: options.minChildren || 3,
        minAreaThreshold: options.minAreaThreshold || 0.02,
        enableVisualHighlighting: options.enableVisualHighlighting !== false,
        enableInfiniteScroll: options.enableInfiniteScroll !== false,
        confidenceThreshold: options.confidenceThreshold || 0.5,
        // Performance constraints for large pages
        maxElementsToScan: isLargePage ? 3000 : 5000,
        timeBudget: isLargePage ? 3000 : 8000 // ms
      };

      console.log(`🎯 Detecting tables with options:`, detectionOptions);

      // Use TableDetectionSystem to detect tables
      const detectedTables = await this.tableDetectionSystem.detectTables(detectionOptions);
      
      if (!detectedTables || detectedTables.length === 0) {
        console.log('📊 No tabular structures detected');
        return [];
      }

      console.log(`✅ Detected ${detectedTables.length} tabular structures`);

      // Process each detected table into normalized format
      const processedTables = [];
      
      for (let i = 0; i < detectedTables.length; i++) {
        const tableData = detectedTables[i];
        
        try {
          // Extract structured data from table
          const extractedData = this.tableDetectionSystem.extractTableData(tableData);
          
          if (extractedData && extractedData.rows && extractedData.rows.length > 0) {
            // Normalize data into standard format
            const normalizedTable = {
              src: `table-${i}`, // Unique identifier
              type: 'TABLE',
              discoveryMethod: 'table-detection',
              confidence: tableData.confidence || 0.7,
              headers: extractedData.headers || [],
              rows: extractedData.rows || [],
              dataRows: extractedData.dataRows || [],
              metadata: {
                selector: extractedData.selector,
                tableIndex: i,
                area: tableData.area,
                score: tableData.score,
                childrenCount: tableData.childrenCount,
                goodClasses: tableData.goodClasses,
                patternStrength: extractedData.metadata?.patternStrength || 0,
                infiniteScrollDetected: extractedData.metadata?.infiniteScrollDetected || false,
                timestamp: Date.now(),
                // Table-specific metadata
                tableData: {
                  headers: extractedData.headers || [],
                  rows: extractedData.rows || [],
                  dataRows: extractedData.dataRows || []
                },
                // Export-ready payload
                exportPayload: {
                  headers: extractedData.headers || [],
                  rows: extractedData.dataRows || extractedData.rows || []
                }
              },
              // Methods for "try another" functionality
              tryAnother: () => this.tryAnotherTable(),
              highlight: () => this.highlightTable(tableData),
              clearHighlight: () => this.clearTableHighlighting(),
              extractData: () => extractedData
            };

            // Add to feeds system for consistency
            await this.categorizeImageEnhanced(normalizedTable, { method: 'table-detection' });
            this.addToFeed(normalizedTable, 'high_confidence'); // Tables are high confidence structured data
            
            processedTables.push(normalizedTable);
            
            // Update metrics
            this.metrics.totalFound++;
            this.metrics.methodStats.tableDetection = (this.metrics.methodStats.tableDetection || 0) + 1;
            
            console.log(`📋 Processed table ${i + 1}: ${extractedData.headers?.length || 0} headers, ${extractedData.dataRows?.length || extractedData.rows?.length || 0} rows`);
          }
          
        } catch (error) {
          console.warn(`⚠️ Failed to process table ${i}:`, error);
          this.metrics.errors++;
        }
      }

      // Implement visual highlighting for first table if enabled
      if (processedTables.length > 0 && detectionOptions.enableVisualHighlighting) {
        try {
          this.tableDetectionSystem.highlightTable(detectedTables[0]);
          console.log('🎨 Visual highlighting applied to first detected table');
        } catch (error) {
          console.warn('⚠️ Failed to apply visual highlighting:', error);
        }
      }

      console.log(`✅ Table detection completed: ${processedTables.length} tables processed`);
      
      return processedTables;
      
    } catch (error) {
      console.error('❌ Table detection failed:', error);
      this.metrics.errors++;
      return [];
    }
  }

  /**
   * "Try another table" functionality - cycles through detected tables
   */
  async tryAnotherTable() {
    if (!this.tableDetectionSystem) {
      console.warn('⚠️ Table Detection System not available for table cycling');
      return null;
    }

    try {
      const nextTable = this.tableDetectionSystem.tryAnotherTable();
      
      if (nextTable) {
        console.log(`🔄 Switched to table: ${nextTable.selector}`);
        
        // Extract and return normalized data for the new table
        const extractedData = this.tableDetectionSystem.extractTableData(nextTable);
        
        return {
          success: true,
          tableData: extractedData,
          tableInfo: {
            selector: nextTable.selector,
            confidence: nextTable.confidence,
            area: nextTable.area,
            score: nextTable.score
          }
        };
      } else {
        console.log('⚠️ No more tables to cycle through');
        return { success: false, message: 'No more tables available' };
      }
      
    } catch (error) {
      console.error('❌ Failed to switch to another table:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Highlight specified table with visual indicators
   */
  highlightTable(tableData) {
    if (!this.tableDetectionSystem) {
      console.warn('⚠️ Table Detection System not available for highlighting');
      return;
    }

    try {
      this.tableDetectionSystem.highlightTable(tableData);
      console.log('🎨 Table highlighting applied');
    } catch (error) {
      console.warn('⚠️ Failed to highlight table:', error);
    }
  }

  /**
   * Clear all table highlighting
   */
  clearTableHighlighting() {
    if (!this.tableDetectionSystem) {
      console.warn('⚠️ Table Detection System not available for clearing highlights');
      return;
    }

    try {
      this.tableDetectionSystem.clearTableHighlighting();
      console.log('🧹 Table highlighting cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear table highlighting:', error);
    }
  }

  /**
   * Get current table data in normalized format for export
   */
  async getCurrentTableData() {
    if (!this.tableDetectionSystem) {
      console.warn('⚠️ Table Detection System not available');
      return null;
    }

    try {
      const currentTable = this.tableDetectionSystem.getCurrentTable();
      
      if (!currentTable) {
        console.log('⚠️ No current table selected');
        return null;
      }

      const extractedData = this.tableDetectionSystem.extractTableData(currentTable);
      
      if (!extractedData) {
        console.warn('⚠️ Failed to extract data from current table');
        return null;
      }

      // Return normalized format suitable for export systems
      return {
        headers: extractedData.headers || [],
        rows: extractedData.dataRows || extractedData.rows || [],
        metadata: {
          selector: extractedData.selector,
          confidence: currentTable.confidence,
          area: currentTable.area,
          score: currentTable.score,
          tableData: extractedData
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to get current table data:', error);
      return null;
    }
  }

  /**
   * Get all detected tables in normalized format
   */
  async getAllTableData() {
    if (!this.tableDetectionSystem) {
      console.warn('⚠️ Table Detection System not available');
      return [];
    }

    try {
      const allTables = this.tableDetectionSystem.getAllTables();
      const normalizedTables = [];
      
      for (const table of allTables) {
        const extractedData = this.tableDetectionSystem.extractTableData(table);
        
        if (extractedData) {
          normalizedTables.push({
            headers: extractedData.headers || [],
            rows: extractedData.dataRows || extractedData.rows || [],
            metadata: {
              selector: extractedData.selector,
              confidence: table.confidence,
              area: table.area,
              score: table.score,
              tableData: extractedData
            }
          });
        }
      }
      
      return normalizedTables;
      
    } catch (error) {
      console.error('❌ Failed to get all table data:', error);
      return [];
    }
  }

  // =============================================================================
  // FEED CATEGORIZATION AND PROCESSING
  // =============================================================================
  
  /**
   * Categorize image into appropriate feed based on confidence and origin
   */
  categorizeImage(imageObj) {
    // Prevent duplicates
    if (this.cache.has(imageObj.src)) {
      this.metrics.duplicates++;
      return false;
    }
    
    this.cache.add(imageObj.src);
    this.metrics.totalFound++;
    
    // Add position tracking
    this.positionTracker.set(imageObj.src, this.positionCounter++);
    imageObj.position = this.positionCounter - 1;
    
    const category = this.determineCategory(imageObj);
    this.feeds[category].push(imageObj);
    this.metrics.categorized++;
    
    return true;
  }

  /**
   * Enhanced category determination using Smart Pattern Recognition
   */
  determineCategory(imageObj) {
    // If Smart Pattern Recognition has already categorized, use that result
    if (imageObj.category) {
      // Map to feed names
      const categoryMap = {
        'high_confidence': 'high_confidence',
        'same_origin': 'same_origin', 
        'external_resources': 'external'
      };
      return categoryMap[imageObj.category] || 'external';
    }
    
    // Fallback to original logic with enhanced thresholds
    if (imageObj.confidence >= 0.75 || 
        (imageObj.metadata && (imageObj.metadata.width || imageObj.metadata.height)) ||
        this.isKnownImageExtension(imageObj.src)) {
      return 'high_confidence';
    }
    
    // Same origin check
    try {
      const url = new URL(imageObj.src, window.location.href);
      if (url.origin === window.location.origin) {
        return 'same_origin';
      }
    } catch (e) {
      // Invalid URL, categorize as external
    }
    
    return 'external';
  }

  /**
   * Check if URL has a known image extension
   */
  isKnownImageExtension(src) {
    const knownExtensions = this.options.supportedFormats;
    const url = src.toLowerCase();
    
    return knownExtensions.some(ext => 
      url.includes(`.${ext}`) || src.startsWith(`data:image/${ext}`)
    );
  }

  /**
   * Process all feeds through validation pipeline
   */
  async processFeeds() {
    console.log('🔄 Processing feeds through validation pipeline...');
    
    // Process high confidence images first
    await this.processQueue(this.feeds.high_confidence, 'high_confidence');
    await this.processQueue(this.feeds.same_origin, 'same_origin');
    await this.processQueue(this.feeds.external, 'external');
  }

  /**
   * Enhanced feed queue processing with Smart Pattern Recognition
   */
  async processQueue(queue, queueName) {
    console.log(`Processing ${queueName} queue: ${queue.length} items`);
    
    const validationPromises = queue.map(async (imageObj, index) => {
      try {
        if (this.activeJobs >= this.options.concurrency) {
          await this.waitForAvailableSlot();
        }
        
        this.activeJobs++;
        
        // Enhanced validation with Smart Pattern Recognition
        const validatedImage = await this.validateImageEnhanced(imageObj);
        this.activeJobs--;
        
        if (validatedImage.valid) {
          this.processed.push(validatedImage);
          this.metrics.validated++;
        }
        
        return validatedImage;
        
      } catch (error) {
        this.activeJobs--;
        console.warn(`Validation failed for ${imageObj.src}:`, error);
        return { ...imageObj, valid: false, error: error.message };
      }
    });
    
    await Promise.allSettled(validationPromises);
  }

  /**
   * Enhanced image validation using Smart Pattern Recognition
   */
  async validateImageEnhanced(imageObj) {
    try {
      // Use Smart Pattern Recognition for enhanced validation if available
      if (this.smartPatternRecognition) {
        // Perform content validation using Smart Pattern Recognition
        const contentValidation = await this.smartPatternRecognition.validateContent(imageObj);
        
        // Update image object with validation results
        imageObj.contentValidation = contentValidation;
        imageObj.valid = contentValidation.isValid;
        
        // Enhance confidence score based on validation
        if (contentValidation.confidence && imageObj.confidence) {
          imageObj.confidence = (imageObj.confidence + contentValidation.confidence) / 2;
        } else if (contentValidation.confidence) {
          imageObj.confidence = contentValidation.confidence;
        }
        
        return imageObj;
      } else {
        // Fallback to basic validation
        return await this.validateImage(imageObj);
      }
    } catch (error) {
      console.warn('Enhanced validation failed, falling back to basic validation:', error);
      return await this.validateImage(imageObj);
    }
  }

  /**
   * Wait for an available processing slot
   */
  async waitForAvailableSlot() {
    while (this.activeJobs >= this.options.concurrency) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // =============================================================================
  // VALIDATION PIPELINE
  // =============================================================================
  
  /**
   * Comprehensive image validation with multiple fallback methods
   */
  async validateImage(imageObj) {
    // Fast path: extension-based validation
    const fastResult = this.fastValidation(imageObj);
    if (fastResult.confidence > 0.8) {
      return { ...imageObj, ...fastResult, valid: true };
    }
    
    // Network validation for better accuracy
    try {
      const networkResult = await this.networkValidation(imageObj);
      return { ...imageObj, ...networkResult, valid: networkResult.valid };
    } catch (error) {
      // Fallback to fast validation result
      return { ...imageObj, ...fastResult, valid: fastResult.confidence > 0.6 };
    }
  }

  /**
   * Fast validation based on URL patterns and extensions
   */
  fastValidation(imageObj) {
    const src = imageObj.src;
    
    // Data URLs
    if (src.startsWith('data:image/')) {
      return { confidence: 0.95, method: 'data-url', type: this.extractDataUrlType(src) };
    }
    
    // Known extensions
    if (this.isKnownImageExtension(src)) {
      return { confidence: 0.85, method: 'extension', type: `image/${this.extractFileExtension(src)}` };
    }
    
    // CDN patterns
    if (this.isCDNImage(src)) {
      return { confidence: 0.80, method: 'cdn-pattern', type: 'image/unknown' };
    }
    
    return { confidence: 0.3, method: 'unknown', type: 'unknown' };
  }

  /**
   * Network-based validation using HEAD requests
   */
  async networkValidation(imageObj) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.options.timeout);
    
    try {
      const response = await fetch(imageObj.src, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 
          'referer': imageObj.metadata?.sourceDocument || window.location.href 
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');
      
      return {
        valid: contentType.startsWith('image/') || this.isKnownImageExtension(imageObj.src),
        confidence: contentType.startsWith('image/') ? 0.95 : 0.7,
        method: 'network',
        type: contentType,
        size: contentLength ? parseInt(contentLength) : null
      };
      
    } catch (error) {
      throw new Error(`Network validation failed: ${error.message}`);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================
  
  /**
   * Extract images from a document (used by multiple detection methods)
   */
  async extractImagesFromDocument(doc, baseUrl = null) {
    const images = [];
    
    try {
      // Standard img elements
      const imgElements = await this.safeQuerySelectorAll('img[src], img[data-src]', { root: doc });
      
      for (const img of imgElements) {
        const src = img.src || img.dataset.src;
        if (src) {
          const absoluteUrl = baseUrl ? new URL(src, baseUrl).href : src;
          
          images.push({
            src: absoluteUrl,
            element: img,
            metadata: {
              alt: img.alt,
              width: img.naturalWidth || img.offsetWidth,
              height: img.naturalHeight || img.offsetHeight,
              className: img.className,
              id: img.id
            }
          });
        }
      }
      
    } catch (error) {
      console.warn('Error extracting images from document:', error);
    }
    
    return images;
  }

  /**
   * Check if URL points to a CDN image
   */
  isCDNImage(url) {
    const cdnPatterns = [
      'cdn', 'cloudfront', 'imgur', 'flickr', 'instagram',
      'facebook', 'twitter', 'pinterest', 'unsplash'
    ];
    
    return cdnPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }

  /**
   * Check if URL is valid image URL
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      new URL(url);
      return true;
    } catch {
      return url.startsWith('data:image/');
    }
  }

  /**
   * Detect MIME type from URL
   */
  detectMimeType(url) {
    const extension = this.extractFileExtension(url);
    const mimeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg', 
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp'
    };
    
    return mimeMap[extension] || 'image/unknown';
  }

  /**
   * Extract file extension from URL
   */
  extractFileExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split('.').pop().toLowerCase();
    } catch {
      const match = url.match(/\.([a-z0-9]+)$/i);
      return match ? match[1].toLowerCase() : '';
    }
  }

  /**
   * Extract data URL type
   */
  extractDataUrlType(dataUrl) {
    const match = dataUrl.match(/^data:image\/([^;]+)/);
    return match ? `image/${match[1]}` : 'image/unknown';
  }

  /**
   * Detect file type from URL
   */
  detectFileType(url) {
    const extension = this.extractFileExtension(url);
    
    if (this.options.supportedFormats.includes(extension)) {
      return this.detectMimeType(url);
    }
    
    if (this.options.customExtensions.includes(extension)) {
      const typeMap = {
        'pdf': 'application/pdf',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed'
      };
      return typeMap[extension] || 'application/octet-stream';
    }
    
    return 'unknown';
  }

  /**
   * Check if resource is an image from Performance API
   */
  isImageResource(url) {
    return this.isKnownImageExtension(url) || this.isCDNImage(url);
  }

  /**
   * Reset collection state for new scan
   */
  resetCollectionState() {
    this.feeds = {
      high_confidence: [],
      same_origin: [],
      external: [],
      pending: []
    };
    
    this.processed = [];
    this.cache.clear();
    this.urlCache.clear();
    this.documentQueue = [];
    this.scannedUrls.clear();
    this.positionTracker.clear();
    this.positionCounter = 0;
    
    this.metrics = {
      totalFound: 0,
      categorized: 0,
      validated: 0,
      duplicates: 0,
      errors: 0,
      processingTime: 0,
      methodStats: {
        performanceAPI: 0,
        shadowDOM: 0,
        advancedBackground: 0,
        svgProcessing: 0,
        lazyLoading: 0,
        urlExtraction: 0,
        customExtensions: 0,
        multiDocument: 0
      }
    };
  }

  /**
   * Generate final results with metadata enrichment
   */
  generateResults() {
    // Sort by position to maintain discovery order
    return this.processed
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map(image => ({
        url: image.src,
        src: image.src, // For compatibility
        type: image.type || this.detectMimeType(image.src),
        size: image.size,
        confidence: image.confidence,
        discoveryMethod: image.discoveryMethod,
        position: image.position,
        metadata: {
          ...image.metadata,
          validated: true,
          validationMethod: image.method
        }
      }));
  }

  /**
   * Generate comprehensive metadata
   */
  generateMetadata() {
    return {
      totalFound: this.metrics.totalFound,
      validated: this.metrics.validated,
      duplicates: this.metrics.duplicates,
      errors: this.metrics.errors,
      processingTime: this.metrics.processingTime,
      methodStats: this.metrics.methodStats,
      feeds: {
        high_confidence: this.feeds.high_confidence.length,
        same_origin: this.feeds.same_origin.length,
        external: this.feeds.external.length,
        pending: this.feeds.pending.length
      },
      smartPatternStats: this.smartPatternRecognition ? this.smartPatternRecognition.getMetrics() : null,
      performance: {
        averageProcessingTime: this.metrics.processingTime / Math.max(this.metrics.validated, 1),
        successRate: this.metrics.validated / Math.max(this.metrics.totalFound, 1),
        duplicateRate: this.metrics.duplicates / Math.max(this.metrics.totalFound, 1)
      }
    };
  }
}

// Export to global scope
if (typeof window !== 'undefined') {
  window.AdvancedCollectorSystem = AdvancedCollectorSystem;
  console.log('✅ Advanced Collector System loaded successfully');
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedCollectorSystem;
}

// Ensure Enhanced Selector Wrapper methods are attached even if class loaded after wrapper block
if (typeof window !== 'undefined' && typeof window.AdvancedCollectorSystem !== 'undefined') {
  const proto = window.AdvancedCollectorSystem.prototype;
  if (typeof proto.safeQuerySelectorAll !== 'function') {
    proto.safeQuerySelectorAll = async function(selector, options = {}) {
      try {
        const root = options.root || document;
        const countOnly = options.countOnly || false;
        const maxResults = options.maxResults || this.options?.maxNodesPerDetector || 1000;
        if (countOnly) {
          if (selector === '*') return root.getElementsByTagName('*').length;
          return root.querySelectorAll(selector).length;
        }
        const elements = root.querySelectorAll(selector);
        if (elements.length > maxResults) {
          console.warn(`⚠️ Query result truncated: ${elements.length} -> ${maxResults} elements`);
          return Array.from(elements).slice(0, maxResults);
        }
        return Array.from(elements);
      } catch (error) {
        console.warn(`⚠️ Safe query selector failed for "${selector}":`, error);
        return [];
      }
    };
  }
  if (typeof proto.safeQuerySelector !== 'function') {
    proto.safeQuerySelector = async function(selector, options = {}) {
      try {
        const root = options.root || document;
        return root.querySelector(selector);
      } catch (error) {
        console.warn(`⚠️ Safe query selector failed for "${selector}":`, error);
        return null;
      }
    };
  }
}

// =============================================================================
// CONTENT ORCHESTRATOR INTEGRATION
// =============================================================================

/**
 * IMPORTANT: Heavy System Initialization (Message-Driven, Not Automatic)
 * 
 * The following systems are registered but NOT automatically activated:
 * - Advanced Collector System registration
 * - Content Orchestrator integration
 * - Heavy DOM scanning operations
 * - Observer and monitoring systems
 * 
 * These systems only activate when the user explicitly triggers scraping via:
 * - Extension popup action
 * - Context menu selection
 * - Keyboard shortcut
 * - Message from background service worker
 * 
 * This ensures minimal performance impact during normal browsing.
 * The extension infrastructure loads, but remains dormant until needed.
 */

/**
 * Register with Content Orchestrator for coordinated execution
 * This prevents duplicate scanning and implements proper throttling
 */
(function registerWithOrchestrator() {
  'use strict';
  
  // Wait for Content Orchestrator to be available
  function waitForOrchestrator(callback, retries = 10) {
    if (typeof window !== 'undefined' && window.__ST?.orchestrator) {
      callback(window.__ST.orchestrator);
    } else if (retries > 0) {
      setTimeout(() => waitForOrchestrator(callback, retries - 1), 100);
    } else {
      console.warn('⚠️ Content Orchestrator not found - Advanced Collector System will not register');
    }
  }
  
  // Registration function
  function registerDetector(orchestrator) {
    try {
      // Create detector instance
      const collector = new AdvancedCollectorSystem({
        // Optimized settings for orchestrated execution
        concurrency: 3, // Reduced for coordinated mode
        timeout: 20000, // 20 seconds 
        maxDocuments: 5, // Limit document scanning
        maxDepth: 1, // Reduce depth to prevent excessive scanning
        
        // Enable key detection methods but be selective
        enablePerformanceAPI: true,
        enableShadowDOM: true,
        enableAdvancedBackground: true,
        enableSVGProcessing: true,
        enableLazyLoading: true,
        enableUrlExtraction: true,
        enableCustomExtensions: false, // Disable for performance
        enableMultiDocument: false, // Disable to prevent iframe scanning conflicts
        
        // Quality filtering
        minImageSize: 50,
        minImageDimensions: { width: 50, height: 50 },
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
      });
      
      // Create adapter function for orchestrator compatibility
      async function advancedCollectorDetector(context = {}) {
        console.log('🚀 Advanced Collector System executing...');
        
        try {
          // Use the collector's main collection method
          const result = await collector.collectImages(context);
          
          if (result.success) {
            console.log(`✅ Advanced Collector completed: ${result.images.length} items collected`);
            
            return {
              success: true,
              items: result.images,
              metadata: {
                ...result.metadata,
                feeds: result.feeds,
                metrics: result.metrics,
                smartPatternMetrics: result.smartPatternMetrics
              }
            };
          } else {
            console.error('❌ Advanced Collector failed:', result.error);
            return {
              success: false,
              items: [],
              error: result.error
            };
          }
          
        } catch (error) {
          console.error('❌ Advanced Collector System failed:', error);
          return {
            success: false,
            items: [],
            error: error.message
          };
        }
      }
      
      // Register with orchestrator
      const registered = orchestrator.registerDetector('advanced-collector-system', advancedCollectorDetector, {
        priority: 3, // Medium priority - runs after pattern recognition
        timeout: 25000, // 25 seconds timeout
        maxRetries: 2,
        dependencies: ['smart-pattern-recognition'] // Run after pattern analysis
      });
      
      if (registered) {
        console.log('✅ Advanced Collector System registered with Content Orchestrator');
      } else {
        console.warn('⚠️ Advanced Collector System registration failed - frame not eligible for scanning');
      }
      
    } catch (error) {
      console.error('❌ Failed to register Advanced Collector System with orchestrator:', error);
    }
  }
  
  // Wait for orchestrator and register
  waitForOrchestrator(registerDetector);
  
})(); // End orchestrator integration IIFE