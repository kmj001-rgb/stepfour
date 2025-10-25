// dom-cache.js - DOM Query Caching and Batching System (CR-015)
console.log('🔵 lib/dom-cache.js FILE LOADING STARTED');
// Reduces expensive querySelectorAll calls and prevents layout thrashing

/**
 * DOMQueryCache - Intelligent caching for DOM queries with TTL and mutation-based invalidation
 * 
 * Features:
 * - Time-to-live (TTL) based cache expiration
 * - Automatic cache invalidation on DOM mutations
 * - Per-selector cache configuration
 * - Memory-safe with bounded cache size
 * - Integration with lifecycle management
 */
class DOMQueryCache {
  constructor(options = {}) {
    this.options = {
      defaultTTL: options.defaultTTL || 5000, // 5 seconds default
      maxCacheSize: options.maxCacheSize || 100, // Max cached selectors
      enableMutationObserver: options.enableMutationObserver !== false,
      mutationDebounce: options.mutationDebounce || 100, // Debounce mutations
      enableStats: options.enableStats !== false,
      ...options
    };

    // Cache structure: Map<selector, {result, timestamp, ttl, hits}>
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      queries: 0
    };

    // Mutation observer for automatic invalidation
    this.observer = null;
    this.mutationDebounceTimer = null;
    this.isInitialized = false;

    // Selector-specific configurations
    this.selectorConfigs = new Map();

    this.initialize();
  }

  /**
   * Initialize the cache system
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    // Setup mutation observer for cache invalidation
    if (this.options.enableMutationObserver && typeof MutationObserver !== 'undefined') {
      this.setupMutationObserver();
    }

    // Register cleanup with lifecycle manager if available
    const global = typeof globalThis !== 'undefined' ? globalThis : window;
    if (global.__ST?.lifecycleManager) {
      global.__ST.lifecycleManager.registerCleanupHandler(() => {
        this.cleanup();
      });
    }

    // Track observer with resource tracker if available
    if (this.observer && global.__ST?.resourceTracker) {
      global.__ST.resourceTracker.trackObserver(this.observer);
    }

    this.isInitialized = true;
    console.log('✅ DOMQueryCache initialized (CR-015)');

    // SECURITY FIX (M1): Add guaranteed cleanup handler for resource cleanup enforcement
    // Ensures cleanup is called even if lifecycle manager is not available
    // Prevents memory leaks from MutationObserver and cache entries
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Setup MutationObserver to invalidate cache on DOM changes
   */
  setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      // Debounce mutations to avoid excessive invalidations
      if (this.mutationDebounceTimer) {
        clearTimeout(this.mutationDebounceTimer);
      }

      this.mutationDebounceTimer = setTimeout(() => {
        this.handleMutations(mutations);
      }, this.options.mutationDebounce);
    });

    // Observe the entire document for changes
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'style', 'src', 'href', 'data-src']
    });
  }

  /**
   * Handle DOM mutations and invalidate affected cache entries
   */
  handleMutations(mutations) {
    // For now, invalidate all cache on any mutation
    // Could be optimized to invalidate only affected selectors
    const hadEntries = this.cache.size > 0;
    if (hadEntries) {
      this.clear();
      this.stats.invalidations++;
    }
  }

  /**
   * Configure caching behavior for a specific selector
   */
  configureSelector(selector, config = {}) {
    this.selectorConfigs.set(selector, {
      ttl: config.ttl || this.options.defaultTTL,
      enabled: config.enabled !== false,
      persistent: config.persistent || false // Persistent entries don't expire
    });
  }

  /**
   * Query the DOM with caching
   * 
   * @param {string} selector - CSS selector
   * @param {Object} options - Query options
   * @param {Element} options.context - Context element (default: document)
   * @param {boolean} options.bypassCache - Skip cache and query directly
   * @param {number} options.ttl - Override TTL for this query
   * @param {boolean} options.single - Use querySelector instead of querySelectorAll
   * @returns {Array|Element|null} Query results
   */
  query(selector, options = {}) {
    this.stats.queries++;

    const context = options.context || document;
    const bypassCache = options.bypassCache || false;
    const single = options.single || false;
    const cacheKey = this.getCacheKey(selector, context, single);

    // Get selector-specific config
    const selectorConfig = this.selectorConfigs.get(selector) || {};
    
    // Skip cache if disabled for this selector or bypassed
    if (bypassCache || selectorConfig.enabled === false) {
      return this.executeQuery(selector, context, single);
    }

    // Check cache
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached) {
      const ttl = options.ttl || selectorConfig.ttl || this.options.defaultTTL;
      const age = now - cached.timestamp;

      // Return cached result if still valid
      if (selectorConfig.persistent || age < ttl) {
        this.stats.hits++;
        cached.hits++;
        return cached.result;
      }

      // Cache expired, remove it
      this.cache.delete(cacheKey);
    }

    // Cache miss - execute query
    this.stats.misses++;
    const result = this.executeQuery(selector, context, single);

    // Store in cache (enforce max size)
    if (this.cache.size >= this.options.maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(cacheKey, {
      result: result,
      timestamp: now,
      ttl: options.ttl || selectorConfig.ttl || this.options.defaultTTL,
      hits: 0
    });

    return result;
  }

  /**
   * Execute the actual DOM query
   */
  executeQuery(selector, context, single) {
    try {
      if (single) {
        return context.querySelector(selector);
      } else {
        return Array.from(context.querySelectorAll(selector));
      }
    } catch (error) {
      console.warn('DOMQueryCache: Query error for selector:', selector, error);
      return single ? null : [];
    }
  }

  /**
   * Generate cache key from selector and context
   */
  getCacheKey(selector, context, single) {
    const contextKey = context === document ? 'document' : 
                      (context.id || context.tagName || 'element');
    return `${selector}|${contextKey}|${single ? 'single' : 'all'}`;
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific selector
   */
  clearSelector(selector) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(selector + '|')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.queries > 0 ? 
      (this.stats.hits / this.stats.queries * 100).toFixed(2) : 0;

    return {
      ...this.stats,
      hitRate: hitRate + '%',
      cacheSize: this.cache.size,
      maxSize: this.options.maxCacheSize
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.mutationDebounceTimer) {
      clearTimeout(this.mutationDebounceTimer);
      this.mutationDebounceTimer = null;
    }

    this.clear();
    this.isInitialized = false;
    console.log('🧹 DOMQueryCache cleaned up');
  }
}

/**
 * DOMBatcher - Batches DOM read/write operations to prevent layout thrashing
 * 
 * Features:
 * - Separate read and write queues
 * - Uses requestAnimationFrame for efficient batching
 * - Prevents layout thrashing by separating reads from writes
 * - Automatic flushing and error handling
 */
class DOMBatcher {
  constructor(options = {}) {
    this.options = {
      autoFlush: options.autoFlush !== false,
      flushDelay: options.flushDelay || 16, // ~1 frame at 60fps
      enableStats: options.enableStats !== false,
      ...options
    };

    // Separate queues for reads and writes
    this.readQueue = [];
    this.writeQueue = [];

    // Batch scheduling
    this.rafId = null;
    this.isProcessing = false;

    // Statistics
    this.stats = {
      readsProcessed: 0,
      writesProcessed: 0,
      batchesExecuted: 0,
      errors: 0
    };

    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the batcher
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    // Register cleanup with lifecycle manager if available
    const global = typeof globalThis !== 'undefined' ? globalThis : window;
    if (global.__ST?.lifecycleManager) {
      global.__ST.lifecycleManager.registerCleanupHandler(() => {
        this.cleanup();
      });
    }

    this.isInitialized = true;
    console.log('✅ DOMBatcher initialized (CR-015)');
  }

  /**
   * Schedule a DOM read operation
   * 
   * @param {Function} callback - Function to execute during read phase
   * @returns {Promise} Promise that resolves with the callback's return value
   */
  read(callback) {
    return new Promise((resolve, reject) => {
      this.readQueue.push({
        callback,
        resolve,
        reject
      });

      this.scheduleFlush();
    });
  }

  /**
   * Schedule a DOM write operation
   * 
   * @param {Function} callback - Function to execute during write phase
   * @returns {Promise} Promise that resolves when write is complete
   */
  write(callback) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({
        callback,
        resolve,
        reject
      });

      this.scheduleFlush();
    });
  }

  /**
   * Measure an element (DOM read)
   * Convenience method for common getBoundingClientRect operations
   */
  measure(element) {
    return this.read(() => {
      if (!element || !element.getBoundingClientRect) {
        return null;
      }
      return element.getBoundingClientRect();
    });
  }

  /**
   * Mutate an element (DOM write)
   * Convenience method for common DOM modifications
   */
  mutate(element, callback) {
    return this.write(() => {
      if (!element) {
        return;
      }
      return callback(element);
    });
  }

  /**
   * Schedule a batch flush
   */
  scheduleFlush() {
    if (this.rafId !== null || this.isProcessing) {
      return;
    }

    if (this.options.autoFlush) {
      this.rafId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  /**
   * Execute all queued operations in the correct order
   * Reads first, then writes to prevent layout thrashing
   */
  flush() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.rafId = null;

    try {
      // Process all reads first
      const reads = this.readQueue.splice(0);
      for (const task of reads) {
        try {
          const result = task.callback();
          task.resolve(result);
          this.stats.readsProcessed++;
        } catch (error) {
          task.reject(error);
          this.stats.errors++;
          console.warn('DOMBatcher read error:', error);
        }
      }

      // Then process all writes
      const writes = this.writeQueue.splice(0);
      for (const task of writes) {
        try {
          const result = task.callback();
          task.resolve(result);
          this.stats.writesProcessed++;
        } catch (error) {
          task.reject(error);
          this.stats.errors++;
          console.warn('DOMBatcher write error:', error);
        }
      }

      this.stats.batchesExecuted++;
    } finally {
      this.isProcessing = false;

      // If more items were added during processing, schedule another flush
      if (this.readQueue.length > 0 || this.writeQueue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Force immediate flush of all queued operations
   */
  flushSync() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.flush();
  }

  /**
   * Get batcher statistics
   */
  getStats() {
    return {
      ...this.stats,
      pendingReads: this.readQueue.length,
      pendingWrites: this.writeQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Reject all pending operations
    this.readQueue.forEach(task => {
      task.reject(new Error('DOMBatcher cleanup'));
    });
    this.writeQueue.forEach(task => {
      task.reject(new Error('DOMBatcher cleanup'));
    });

    this.readQueue = [];
    this.writeQueue = [];
    this.isProcessing = false;
    this.isInitialized = false;

    console.log('🧹 DOMBatcher cleaned up');
  }
}

// Export classes using idempotent assignment to avoid redeclaration errors
// This allows the file to be loaded multiple times safely
if (typeof globalThis !== 'undefined') {
  globalThis.DOMQueryCache = DOMQueryCache;
  globalThis.DOMBatcher = DOMBatcher;
  
  // Also export to __ST namespace for content script access
  if (!globalThis.__ST) {
    globalThis.__ST = {};
  }
  globalThis.__ST.DOMQueryCache = DOMQueryCache;
  globalThis.__ST.DOMBatcher = DOMBatcher;
}

// Also export to window if available (for browser environments)
if (typeof window !== 'undefined') {
  window.DOMQueryCache = DOMQueryCache;
  window.DOMBatcher = DOMBatcher;
  
  if (!window.__ST) {
    window.__ST = {};
  }
  window.__ST.DOMQueryCache = DOMQueryCache;
  window.__ST.DOMBatcher = DOMBatcher;
}

// Verify exports
console.log('✅ DOM Cache loaded:', {
  globalThisDQC: typeof globalThis !== 'undefined' ? !!globalThis.DOMQueryCache : 'N/A',
  globalThisDB: typeof globalThis !== 'undefined' ? !!globalThis.DOMBatcher : 'N/A',
  windowDQC: typeof window !== 'undefined' ? !!window.DOMQueryCache : 'N/A',
  windowDB: typeof window !== 'undefined' ? !!window.DOMBatcher : 'N/A',
  __ST_DQC: (typeof globalThis !== 'undefined' ? !!globalThis.__ST?.DOMQueryCache : false) || 
             (typeof window !== 'undefined' ? !!window.__ST?.DOMQueryCache : false),
  __ST_DB: (typeof globalThis !== 'undefined' ? !!globalThis.__ST?.DOMBatcher : false) || 
            (typeof window !== 'undefined' ? !!window.__ST?.DOMBatcher : false)
});
