// lifecycle-manager.js - Centralized Lifecycle and Resource Management System
// Phase 2: Defense-in-Depth Enhancement (P2-1)
// Features: Singleton pattern, automatic cleanup on page unload, centralized resource tracking

import { Logger } from './logger.js';

const logger = new Logger('LifecycleManager');

/**
 * LifecycleManager - Singleton class for managing application lifecycle and cleanup
 * 
 * Provides centralized registration and coordination of cleanup handlers across all components.
 * Automatically triggers cleanup on page unload and provides manual cleanup methods.
 * 
 * @class LifecycleManager
 * @singleton
 */
class LifecycleManager {
  static #instance = null;
  static #initialized = false;

  /**
   * Get the singleton instance of LifecycleManager
   * @returns {LifecycleManager} The singleton instance
   */
  static getInstance() {
    if (!LifecycleManager.#instance) {
      LifecycleManager.#instance = new LifecycleManager();
    }
    return LifecycleManager.#instance;
  }

  /**
   * Private constructor - use getInstance() instead
   * @private
   */
  constructor() {
    if (LifecycleManager.#instance) {
      throw new Error('LifecycleManager is a singleton. Use getInstance() instead.');
    }

    this.cleanupHandlers = new Map();
    this.isCleaningUp = false;
    this.cleanupCompleted = false;
    this.handlerIdCounter = 0;
    
    this.stats = {
      handlersRegistered: 0,
      handlersRemoved: 0,
      cleanupTriggered: 0,
      lastCleanupTime: null
    };

    if (!LifecycleManager.#initialized) {
      this.#setupAutomaticCleanup();
      LifecycleManager.#initialized = true;
      logger.info('✅ LifecycleManager initialized with automatic cleanup');
    }
  }

  /**
   * Setup automatic cleanup on page unload events
   * @private
   */
  #setupAutomaticCleanup() {
    if (typeof window === 'undefined') {
      logger.warn('⚠️ Window not available - skipping automatic cleanup setup');
      return;
    }

    window.addEventListener('beforeunload', () => {
      logger.info('🔄 Page unloading - triggering automatic cleanup');
      this.cleanupAll();
    });

    window.addEventListener('pagehide', () => {
      logger.info('🔄 Page hiding - triggering automatic cleanup');
      this.cleanupAll();
    });

    logger.debug('✅ Automatic cleanup handlers registered');
  }

  /**
   * Register a cleanup handler to be called during cleanup
   * 
   * @param {Function} handler - Cleanup function to be called
   * @param {Object} options - Optional configuration
   * @param {string} options.name - Name identifier for the handler
   * @param {number} options.priority - Priority (higher = executed first, default: 0)
   * @returns {string} Handler ID that can be used to unregister
   * 
   * @example
   * const handlerId = lifecycleManager.registerCleanupHandler(() => {
   *   // Cleanup code here
   * }, { name: 'MyComponent', priority: 10 });
   */
  registerCleanupHandler(handler, options = {}) {
    if (typeof handler !== 'function') {
      logger.error('❌ Cleanup handler must be a function');
      throw new TypeError('Cleanup handler must be a function');
    }

    const handlerId = `handler_${this.handlerIdCounter++}`;
    const handlerInfo = {
      id: handlerId,
      handler,
      name: options.name || 'Anonymous',
      priority: options.priority || 0,
      registered: Date.now()
    };

    this.cleanupHandlers.set(handlerId, handlerInfo);
    this.stats.handlersRegistered++;

    logger.debug(`✅ Registered cleanup handler: ${handlerInfo.name} (${handlerId})`);

    return handlerId;
  }

  /**
   * Unregister a cleanup handler by ID
   * 
   * @param {string} handlerId - Handler ID returned from registerCleanupHandler
   * @returns {boolean} True if handler was found and removed
   */
  unregisterCleanupHandler(handlerId) {
    if (!handlerId) {
      logger.warn('⚠️ Cannot unregister handler: no ID provided');
      return false;
    }

    const handler = this.cleanupHandlers.get(handlerId);
    if (handler) {
      this.cleanupHandlers.delete(handlerId);
      this.stats.handlersRemoved++;
      logger.debug(`✅ Unregistered cleanup handler: ${handler.name} (${handlerId})`);
      return true;
    }

    logger.warn(`⚠️ Handler not found: ${handlerId}`);
    return false;
  }

  /**
   * Execute all registered cleanup handlers
   * Handlers are executed in priority order (highest first)
   * 
   * @returns {Promise<Object>} Cleanup results with success/failure counts
   */
  async cleanupAll() {
    if (this.isCleaningUp) {
      logger.warn('⚠️ Cleanup already in progress, skipping duplicate call');
      return { success: 0, failed: 0, skipped: true };
    }

    this.isCleaningUp = true;
    this.stats.cleanupTriggered++;
    this.stats.lastCleanupTime = Date.now();

    logger.info(`🧹 Starting cleanup of ${this.cleanupHandlers.size} handlers...`);

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const sortedHandlers = Array.from(this.cleanupHandlers.values())
      .sort((a, b) => b.priority - a.priority);

    for (const handlerInfo of sortedHandlers) {
      try {
        logger.debug(`🧹 Executing cleanup handler: ${handlerInfo.name}`);
        await handlerInfo.handler();
        results.success++;
        logger.debug(`✅ Cleanup handler completed: ${handlerInfo.name}`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          handler: handlerInfo.name,
          error: error.message
        });
        logger.error(`❌ Cleanup handler failed: ${handlerInfo.name}`, error);
      }
    }

    this.cleanupCompleted = true;
    this.isCleaningUp = false;

    logger.info(`✅ Cleanup completed: ${results.success} successful, ${results.failed} failed`);

    if (results.failed > 0) {
      logger.warn('⚠️ Some cleanup handlers failed:', results.errors);
    }

    return results;
  }

  /**
   * Get current lifecycle manager statistics
   * 
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      activeHandlers: this.cleanupHandlers.size,
      isCleaningUp: this.isCleaningUp,
      cleanupCompleted: this.cleanupCompleted,
      handlers: Array.from(this.cleanupHandlers.values()).map(h => ({
        id: h.id,
        name: h.name,
        priority: h.priority,
        registered: h.registered
      }))
    };
  }

  /**
   * Check if cleanup has been completed
   * @returns {boolean} True if cleanup has been executed
   */
  isCleanedUp() {
    return this.cleanupCompleted;
  }

  /**
   * Reset the lifecycle manager (for testing purposes)
   * @private
   */
  reset() {
    logger.warn('⚠️ Resetting LifecycleManager - this should only be used in tests');
    this.cleanupHandlers.clear();
    this.isCleaningUp = false;
    this.cleanupCompleted = false;
    this.stats = {
      handlersRegistered: 0,
      handlersRemoved: 0,
      cleanupTriggered: 0,
      lastCleanupTime: null
    };
  }
}

const lifecycleManagerInstance = LifecycleManager.getInstance();

export { LifecycleManager, lifecycleManagerInstance };

if (typeof globalThis !== 'undefined') {
  if (!globalThis.__ST) {
    globalThis.__ST = {};
  }
  globalThis.__ST.lifecycleManager = lifecycleManagerInstance;
  globalThis.LifecycleManager = LifecycleManager;
  
  logger.debug('✅ LifecycleManager registered to globalThis.__ST.lifecycleManager');
}
