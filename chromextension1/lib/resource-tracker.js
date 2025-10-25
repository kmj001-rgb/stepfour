// resource-tracker.js - Resource Tracking System
// Phase 2: Defense-in-Depth Enhancement (P2-1)
// Features: Track observers, timers, ports, and other resources with automatic cleanup

import { Logger } from './logger.js';
import { lifecycleManagerInstance } from './lifecycle-manager.js';

const logger = new Logger('ResourceTracker');

/**
 * ResourceTracker - Tracks and manages various resource types
 * 
 * Provides centralized tracking of observers, timers, ports, and other resources
 * with automatic cleanup capabilities and usage statistics.
 * 
 * @class ResourceTracker
 */
class ResourceTracker {
  /**
   * Resource types that can be tracked
   */
  static RESOURCE_TYPES = {
    OBSERVER: 'observer',
    TIMER: 'timer',
    INTERVAL: 'interval',
    PORT: 'port',
    CONNECTION: 'connection',
    OFFSCREEN_DOC: 'offscreen_doc',
    CUSTOM: 'custom'
  };

  constructor() {
    this.resources = new Map();
    this.stats = {
      tracked: 0,
      cleaned: 0,
      errors: 0
    };

    this.isCleanedUp = false;

    this.#registerWithLifecycleManager();

    logger.info('✅ ResourceTracker initialized');
  }

  /**
   * Register cleanup handler with lifecycle manager
   * @private
   */
  #registerWithLifecycleManager() {
    if (lifecycleManagerInstance) {
      lifecycleManagerInstance.registerCleanupHandler(
        () => this.cleanupAll(),
        { name: 'ResourceTracker', priority: 100 }
      );
      logger.debug('✅ Registered with LifecycleManager');
    } else {
      logger.warn('⚠️ LifecycleManager not available - manual cleanup required');
    }
  }

  /**
   * Generate unique resource ID
   * @private
   */
  #generateResourceId(type, name) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${type}_${name || 'unnamed'}_${timestamp}_${random}`;
  }

  /**
   * Track a MutationObserver or IntersectionObserver
   * 
   * @param {MutationObserver|IntersectionObserver} observer - Observer instance to track
   * @param {string} name - Optional name identifier for the observer
   * @returns {string} Resource ID for tracking
   * 
   * @example
   * const observer = new MutationObserver(() => {});
   * const resourceId = resourceTracker.trackObserver(observer, 'DOM-Watcher');
   */
  trackObserver(observer, name = 'unnamed') {
    if (!observer || typeof observer.disconnect !== 'function') {
      logger.error('❌ Invalid observer - must have disconnect() method');
      throw new TypeError('Invalid observer object');
    }

    const resourceId = this.#generateResourceId(ResourceTracker.RESOURCE_TYPES.OBSERVER, name);
    
    const resourceInfo = {
      id: resourceId,
      type: ResourceTracker.RESOURCE_TYPES.OBSERVER,
      name,
      resource: observer,
      created: Date.now(),
      cleanupFn: () => observer.disconnect()
    };

    this.resources.set(resourceId, resourceInfo);
    this.stats.tracked++;

    logger.debug(`✅ Tracking observer: ${name} (${resourceId})`);

    return resourceId;
  }

  /**
   * Track a timer (setTimeout)
   * 
   * @param {number} timerId - Timer ID returned from setTimeout
   * @param {string} name - Optional name identifier for the timer
   * @returns {string} Resource ID for tracking
   * 
   * @example
   * const timerId = setTimeout(() => {}, 1000);
   * const resourceId = resourceTracker.trackTimer(timerId, 'Delayed-Action');
   */
  trackTimer(timerId, name = 'unnamed') {
    if (typeof timerId !== 'number') {
      logger.error('❌ Invalid timer ID - must be a number');
      throw new TypeError('Timer ID must be a number');
    }

    const resourceId = this.#generateResourceId(ResourceTracker.RESOURCE_TYPES.TIMER, name);
    
    const resourceInfo = {
      id: resourceId,
      type: ResourceTracker.RESOURCE_TYPES.TIMER,
      name,
      resource: timerId,
      created: Date.now(),
      cleanupFn: () => clearTimeout(timerId)
    };

    this.resources.set(resourceId, resourceInfo);
    this.stats.tracked++;

    logger.debug(`✅ Tracking timer: ${name} (${resourceId})`);

    return resourceId;
  }

  /**
   * Track an interval (setInterval)
   * 
   * @param {number} intervalId - Interval ID returned from setInterval
   * @param {string} name - Optional name identifier for the interval
   * @returns {string} Resource ID for tracking
   * 
   * @example
   * const intervalId = setInterval(() => {}, 1000);
   * const resourceId = resourceTracker.trackInterval(intervalId, 'Periodic-Check');
   */
  trackInterval(intervalId, name = 'unnamed') {
    if (typeof intervalId !== 'number') {
      logger.error('❌ Invalid interval ID - must be a number');
      throw new TypeError('Interval ID must be a number');
    }

    const resourceId = this.#generateResourceId(ResourceTracker.RESOURCE_TYPES.INTERVAL, name);
    
    const resourceInfo = {
      id: resourceId,
      type: ResourceTracker.RESOURCE_TYPES.INTERVAL,
      name,
      resource: intervalId,
      created: Date.now(),
      cleanupFn: () => clearInterval(intervalId)
    };

    this.resources.set(resourceId, resourceInfo);
    this.stats.tracked++;

    logger.debug(`✅ Tracking interval: ${name} (${resourceId})`);

    return resourceId;
  }

  /**
   * Track a Chrome runtime port
   * 
   * @param {chrome.runtime.Port} port - Chrome runtime port to track
   * @param {string} name - Optional name identifier for the port
   * @returns {string} Resource ID for tracking
   * 
   * @example
   * const port = chrome.runtime.connect({ name: 'my-port' });
   * const resourceId = resourceTracker.trackPort(port, 'Background-Connection');
   */
  trackPort(port, name = 'unnamed') {
    if (!port || typeof port.disconnect !== 'function') {
      logger.error('❌ Invalid port - must have disconnect() method');
      throw new TypeError('Invalid port object');
    }

    const resourceId = this.#generateResourceId(ResourceTracker.RESOURCE_TYPES.PORT, name);
    
    const resourceInfo = {
      id: resourceId,
      type: ResourceTracker.RESOURCE_TYPES.PORT,
      name,
      resource: port,
      created: Date.now(),
      cleanupFn: () => {
        try {
          port.disconnect();
        } catch (error) {
          logger.debug(`Port already disconnected: ${name}`);
        }
      }
    };

    this.resources.set(resourceId, resourceInfo);
    this.stats.tracked++;

    logger.debug(`✅ Tracking port: ${name} (${resourceId})`);

    return resourceId;
  }

  /**
   * Track a custom resource with cleanup function
   * 
   * @param {*} resource - Resource to track
   * @param {Function} cleanupFn - Function to call to cleanup the resource
   * @param {string} type - Resource type identifier
   * @param {string} name - Optional name identifier
   * @returns {string} Resource ID for tracking
   * 
   * @example
   * const connection = new WebSocket('ws://...');
   * const resourceId = resourceTracker.trackCustomResource(
   *   connection,
   *   () => connection.close(),
   *   'websocket',
   *   'API-Connection'
   * );
   */
  trackCustomResource(resource, cleanupFn, type = 'custom', name = 'unnamed') {
    if (typeof cleanupFn !== 'function') {
      logger.error('❌ Cleanup function must be provided');
      throw new TypeError('Cleanup function must be a function');
    }

    const resourceId = this.#generateResourceId(type, name);
    
    const resourceInfo = {
      id: resourceId,
      type,
      name,
      resource,
      created: Date.now(),
      cleanupFn
    };

    this.resources.set(resourceId, resourceInfo);
    this.stats.tracked++;

    logger.debug(`✅ Tracking custom resource: ${name} (${type}, ${resourceId})`);

    return resourceId;
  }

  /**
   * Stop tracking a resource (does not cleanup)
   * 
   * @param {string} resourceId - Resource ID to untrack
   * @returns {boolean} True if resource was found and untracked
   */
  untrack(resourceId) {
    if (!resourceId) {
      logger.warn('⚠️ Cannot untrack: no resource ID provided');
      return false;
    }

    const resource = this.resources.get(resourceId);
    if (resource) {
      this.resources.delete(resourceId);
      logger.debug(`✅ Untracked resource: ${resource.name} (${resourceId})`);
      return true;
    }

    logger.warn(`⚠️ Resource not found: ${resourceId}`);
    return false;
  }

  /**
   * Cleanup resources of a specific type
   * 
   * @param {string} resourceType - Type of resources to cleanup
   * @returns {Object} Cleanup results
   * 
   * @example
   * resourceTracker.cleanup('observer'); // Cleanup all observers
   * resourceTracker.cleanup('timer');    // Cleanup all timers
   */
  cleanup(resourceType) {
    if (!resourceType) {
      logger.warn('⚠️ No resource type specified, use cleanupAll() for all resources');
      return { success: 0, failed: 0 };
    }

    logger.info(`🧹 Cleaning up resources of type: ${resourceType}`);

    const results = { success: 0, failed: 0, errors: [] };

    for (const [resourceId, resourceInfo] of this.resources.entries()) {
      if (resourceInfo.type === resourceType) {
        try {
          resourceInfo.cleanupFn();
          this.resources.delete(resourceId);
          results.success++;
          this.stats.cleaned++;
          logger.debug(`✅ Cleaned up ${resourceType}: ${resourceInfo.name}`);
        } catch (error) {
          results.failed++;
          this.stats.errors++;
          results.errors.push({
            id: resourceId,
            name: resourceInfo.name,
            error: error.message
          });
          logger.error(`❌ Failed to cleanup ${resourceType}: ${resourceInfo.name}`, error);
        }
      }
    }

    logger.info(`✅ Cleanup of ${resourceType} completed: ${results.success} successful, ${results.failed} failed`);

    return results;
  }

  /**
   * Cleanup all tracked resources
   * 
   * @returns {Object} Cleanup results
   */
  cleanupAll() {
    if (this.isCleanedUp) {
      logger.warn('⚠️ Resources already cleaned up, skipping');
      return { success: 0, failed: 0, skipped: true };
    }

    logger.info(`🧹 Cleaning up all ${this.resources.size} tracked resources...`);

    const results = { success: 0, failed: 0, errors: [] };

    for (const [resourceId, resourceInfo] of this.resources.entries()) {
      try {
        resourceInfo.cleanupFn();
        results.success++;
        this.stats.cleaned++;
        logger.debug(`✅ Cleaned up ${resourceInfo.type}: ${resourceInfo.name}`);
      } catch (error) {
        results.failed++;
        this.stats.errors++;
        results.errors.push({
          id: resourceId,
          name: resourceInfo.name,
          type: resourceInfo.type,
          error: error.message
        });
        logger.error(`❌ Failed to cleanup ${resourceInfo.type}: ${resourceInfo.name}`, error);
      }
    }

    this.resources.clear();
    this.isCleanedUp = true;

    logger.info(`✅ Cleanup completed: ${results.success} successful, ${results.failed} failed`);

    if (results.failed > 0) {
      logger.warn('⚠️ Some resources failed to cleanup:', results.errors);
    }

    return results;
  }

  /**
   * Get resource tracking statistics
   * 
   * @returns {Object} Statistics object with resource counts and breakdown
   */
  getStats() {
    const typeBreakdown = {};
    
    for (const resourceInfo of this.resources.values()) {
      if (!typeBreakdown[resourceInfo.type]) {
        typeBreakdown[resourceInfo.type] = 0;
      }
      typeBreakdown[resourceInfo.type]++;
    }

    return {
      ...this.stats,
      activeResources: this.resources.size,
      isCleanedUp: this.isCleanedUp,
      typeBreakdown,
      resources: Array.from(this.resources.values()).map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        created: r.created,
        age: Date.now() - r.created
      }))
    };
  }

  /**
   * Get all resources of a specific type
   * 
   * @param {string} resourceType - Type of resources to get
   * @returns {Array} Array of resource info objects
   */
  getResourcesByType(resourceType) {
    return Array.from(this.resources.values())
      .filter(r => r.type === resourceType)
      .map(r => ({
        id: r.id,
        name: r.name,
        created: r.created,
        age: Date.now() - r.created
      }));
  }
}

const resourceTrackerInstance = new ResourceTracker();

export { ResourceTracker, resourceTrackerInstance };

if (typeof globalThis !== 'undefined') {
  if (!globalThis.__ST) {
    globalThis.__ST = {};
  }
  globalThis.__ST.resourceTracker = resourceTrackerInstance;
  globalThis.ResourceTracker = ResourceTracker;
  
  logger.debug('✅ ResourceTracker registered to globalThis.__ST.resourceTracker');
}
