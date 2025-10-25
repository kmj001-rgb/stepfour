/**
 * Performance Optimization Module for Pagination Detection
 * Phase 5: Performance & Documentation
 * Provides caching, throttling, and optimization utilities
 * 
 * @version 1.0.0
 */

class PaginationPerformance {
  constructor(options = {}) {
    // Cache settings
    this.cacheEnabled = options.cacheEnabled !== false;
    this.cacheDuration = options.cacheDuration || 5000; // 5 seconds default
    this.cache = new Map();
    
    // Throttle settings
    this.throttleEnabled = options.throttleEnabled !== false;
    this.throttleDelay = options.throttleDelay || 100; // 100ms default
    this.throttleTimers = new Map();
    
    // Performance monitoring
    this.metrics = {
      detections: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgDetectionTime: 0,
      totalDetectionTime: 0
    };
    
    // Lazy loading
    this.lazyLoadEnabled = options.lazyLoadEnabled !== false;
    this.loadedModules = new Set();
  }

  /**
   * Cache detection results
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  cacheSet(key, value) {
    if (!this.cacheEnabled) return;
    
    this.cache.set(key, {
      value: value,
      timestamp: Date.now()
    });
    
    // Auto-cleanup old cache entries
    setTimeout(() => {
      this.cache.delete(key);
    }, this.cacheDuration);
  }

  /**
   * Get cached result
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  cacheGet(key) {
    if (!this.cacheEnabled) return null;
    
    const cached = this.cache.get(key);
    if (!cached) {
      this.metrics.cacheMisses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }
    
    this.metrics.cacheHits++;
    return cached.value;
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Throttle a function
   * @param {string} key - Unique key for this function
   * @param {Function} fn - Function to throttle
   * @param {number} delay - Optional custom delay
   * @returns {Function} Throttled function
   */
  throttle(key, fn, delay = this.throttleDelay) {
    if (!this.throttleEnabled) {
      return fn;
    }
    
    return (...args) => {
      if (this.throttleTimers.has(key)) {
        return; // Already running
      }
      
      this.throttleTimers.set(key, true);
      
      setTimeout(() => {
        this.throttleTimers.delete(key);
      }, delay);
      
      return fn(...args);
    };
  }

  /**
   * Debounce a function
   * @param {string} key - Unique key for this function
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in ms
   * @returns {Function} Debounced function
   */
  debounce(key, fn, delay = 300) {
    let timer;
    
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Measure function performance
   * @param {string} name - Operation name
   * @param {Function} fn - Function to measure
   * @returns {Promise<*>} Function result
   */
  async measurePerformance(name, fn) {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.metrics.detections++;
      this.metrics.totalDetectionTime += duration;
      this.metrics.avgDetectionTime = 
        this.metrics.totalDetectionTime / this.metrics.detections;
      
      if (duration > 100) {
        console.warn(`PaginationPerformance: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`PaginationPerformance: ${name} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Optimize detection by caching URL-based results
   * @param {PaginationDetector} detector - Detector instance
   * @returns {Object} Cached or fresh detection result
   */
  optimizeDetection(detector) {
    const url = window.location.href;
    const cacheKey = `detection_${url}`;
    
    // Check cache
    const cached = this.cacheGet(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Perform detection
    const result = detector.findNextPage();
    
    // Cache result
    if (result) {
      this.cacheSet(cacheKey, result);
    }
    
    return result;
  }

  /**
   * Lazy load a module
   * @param {string} moduleName - Module name
   * @param {Function} loadFn - Function to load module
   * @returns {Promise<*>} Module
   */
  async lazyLoad(moduleName, loadFn) {
    if (!this.lazyLoadEnabled) {
      return await loadFn();
    }
    
    if (this.loadedModules.has(moduleName)) {
      return; // Already loaded
    }
    
    const module = await loadFn();
    this.loadedModules.add(moduleName);
    
    return module;
  }

  /**
   * Batch process multiple operations
   * @param {Array<Function>} operations - Array of async functions
   * @param {number} batchSize - Size of each batch
   * @returns {Promise<Array>} Results
   */
  async batchProcess(operations, batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < operations.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }

  /**
   * Request idle callback wrapper
   * @param {Function} fn - Function to run when idle
   * @param {Object} options - Options
   * @returns {Promise} Promise that resolves when complete
   */
  async runWhenIdle(fn, options = {}) {
    if (typeof requestIdleCallback !== 'undefined') {
      return new Promise((resolve) => {
        requestIdleCallback(() => {
          const result = fn();
          resolve(result);
        }, options);
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = fn();
          resolve(result);
        }, 0);
      });
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.detections > 0
        ? (this.metrics.cacheHits / this.metrics.detections * 100).toFixed(2) + '%'
        : '0%',
      avgDetectionTimeMs: this.metrics.avgDetectionTime.toFixed(2)
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics = {
      detections: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgDetectionTime: 0,
      totalDetectionTime: 0
    };
  }

  /**
   * Enable/disable features dynamically
   * @param {Object} options - Options to update
   */
  updateOptions(options) {
    if ('cacheEnabled' in options) this.cacheEnabled = options.cacheEnabled;
    if ('throttleEnabled' in options) this.throttleEnabled = options.throttleEnabled;
    if ('lazyLoadEnabled' in options) this.lazyLoadEnabled = options.lazyLoadEnabled;
    if ('cacheDuration' in options) this.cacheDuration = options.cacheDuration;
    if ('throttleDelay' in options) this.throttleDelay = options.throttleDelay;
  }
}

/**
 * Memory Monitor for tracking memory usage
 */
class MemoryMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.warningThreshold = options.warningThreshold || 50 * 1024 * 1024; // 50MB
    this.criticalThreshold = options.criticalThreshold || 100 * 1024 * 1024; // 100MB
    this.intervalId = null;
    this.callbacks = {
      onWarning: options.onWarning || (() => {}),
      onCritical: options.onCritical || (() => {})
    };
  }

  /**
   * Start monitoring
   */
  start() {
    if (!this.enabled || this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory() {
    if (typeof performance === 'undefined' || !performance.memory) {
      return; // Not available in this environment
    }
    
    const usage = performance.memory.usedJSHeapSize;
    
    if (usage > this.criticalThreshold) {
      console.error(`MemoryMonitor: CRITICAL - ${(usage / 1024 / 1024).toFixed(2)}MB used`);
      this.callbacks.onCritical(usage);
    } else if (usage > this.warningThreshold) {
      console.warn(`MemoryMonitor: WARNING - ${(usage / 1024 / 1024).toFixed(2)}MB used`);
      this.callbacks.onWarning(usage);
    }
  }

  /**
   * Get current memory usage
   * @returns {Object|null} Memory info
   */
  getMemoryInfo() {
    if (typeof performance === 'undefined' || !performance.memory) {
      return null;
    }
    
    return {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      usedMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
      totalMB: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
      limitMB: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
    };
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.PaginationPerformance = PaginationPerformance;
  window.MemoryMonitor = MemoryMonitor;
  
  if (!window.__ST) {
    window.__ST = {};
  }
  window.__ST.PaginationPerformance = PaginationPerformance;
  window.__ST.MemoryMonitor = MemoryMonitor;
  
  console.log('✅ PaginationPerformance and MemoryMonitor loaded');
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PaginationPerformance, MemoryMonitor };
}
