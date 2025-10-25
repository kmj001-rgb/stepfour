// simple-service-worker.js - MV3 Compliant Enhanced Service Worker
// Integrates ErrorHandlingSystem, PerformanceMonitoringSystem, and MV3 resilience features
// Features: Chrome.alarms keepalive, idempotent initialization, defensive message handling

import { QUEUE_CONFIG } from '../config/constants.js';
import { Logger } from '../lib/logger.js';
import { InputSanitizer } from '../lib/input-sanitizer.js';

// Import consolidated background classes
import {
  SimpleDownloadManager,
  SimpleMessageHandler,
  StepThreeDownloadQueue,
  BatchOperationsManager,
  MemoryOptimizedProcessor,
  SiteProfileManager,
  ConsolidatedBackgroundManager,
  EnhancedErrorHandling,
  StepThreeUtils,
  applyMask,
  resetCounters,
  getCounterStats
} from './consolidated-background.js';

// Create logger instance for service worker (will lazy-init on first use)
const serviceWorkerLogger = new Logger('ServiceWorker');

// Create safe console methods to prevent 'Illegal invocation' errors
// Integrate logger if available, otherwise fallback to console
const safeConsole = serviceWorkerLogger ? {
  log: (...args) => serviceWorkerLogger.debug(...args),
  error: (...args) => serviceWorkerLogger.error(...args),
  warn: (...args) => serviceWorkerLogger.warn(...args),
  info: (...args) => serviceWorkerLogger.info(...args)
} : {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console)
};

// Make safeConsole available globally to prevent conflicts with imported scripts
globalThis.safeConsole = safeConsole;

// NOTE: No logging at module load to ensure MV3 compliance
// Logs will be emitted when event handlers fire

// ============================================================================
// GLOBAL VARIABLES AND DECLARATIONS
// ============================================================================

// ProxyRouter singleton - declared first, instantiated after class definition
let globalProxyRouter = null;
let proxyRouterReady = false;

// ============================================================================
// PHASE 3: ENHANCED QUEUE SYSTEM WITH PRIORITY AND DEDUPLICATION (P3-1)
// ============================================================================

/**
 * Priority levels for message queue
 * @enum {number}
 */
const MessagePriority = {
  CRITICAL: 0,  // Health checks, keepalive
  HIGH: 1,      // User-initiated actions
  NORMAL: 2,    // Regular operations
  LOW: 3        // Background tasks, cleanup
};

/**
 * Enhanced message queue with priority, deduplication, and timeout handling
 * Phase 3: P3-1 implementation
 */
class PriorityMessageQueue {
  constructor(maxSize = 100, messageTimeout = 30000) {
    this.queues = {
      [MessagePriority.CRITICAL]: [],
      [MessagePriority.HIGH]: [],
      [MessagePriority.NORMAL]: [],
      [MessagePriority.LOW]: []
    };
    this.maxSize = maxSize;
    this.messageTimeout = messageTimeout;
    this.messageHashes = new Set(); // For deduplication
    this.processingLock = false;
    this.stats = {
      enqueued: 0,
      dequeued: 0,
      duplicates: 0,
      timeouts: 0,
      dropped: 0
    };
  }

  /**
   * Generate hash for message deduplication
   * @private
   */
  _hashMessage(message) {
    const key = `${message.action || message.type}_${message.requestId || ''}_${JSON.stringify(message.payload || {})}`;
    return key;
  }

  /**
   * Enqueue message with priority and deduplication
   */
  enqueue(item) {
    const priority = this._determinePriority(item.message);
    const hash = this._hashMessage(item.message);

    // Deduplication check
    if (this.messageHashes.has(hash)) {
      this.stats.duplicates++;
      safeConsole.log(`🔄 Duplicate message detected, skipping: ${item.message.action || item.message.type}`);
      return false;
    }

    // Check total size across all queues
    const totalSize = this.size();
    if (totalSize >= this.maxSize) {
      // Drop lowest priority message to make room
      if (this.queues[MessagePriority.LOW].length > 0) {
        const dropped = this.queues[MessagePriority.LOW].shift();
        this.messageHashes.delete(this._hashMessage(dropped.message));
        this.stats.dropped++;
        safeConsole.warn(`⚠️ Queue full, dropped low priority message: ${dropped.message.action}`);
      } else {
        // Queue full with higher priority messages
        this.stats.dropped++;
        safeConsole.warn(`⚠️ Queue full, cannot enqueue message: ${item.message.action}`);
        if (item.sendResponse) {
          item.sendResponse({ error: 'Service worker overloaded, please retry' });
        }
        return false;
      }
    }

    // Add to appropriate priority queue
    item.enqueuedAt = Date.now();
    item.hash = hash;
    item.priority = priority;
    this.queues[priority].push(item);
    this.messageHashes.add(hash);
    this.stats.enqueued++;

    safeConsole.log(`📥 Enqueued message (priority: ${priority}): ${item.message.action || item.message.type}`);
    return true;
  }

  /**
   * Dequeue next highest priority message
   */
  dequeue() {
    // Remove stale messages first
    this._removeStaleMessages();

    // Check queues in priority order
    for (const priority of [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.NORMAL, MessagePriority.LOW]) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        const item = queue.shift();
        this.messageHashes.delete(item.hash);
        this.stats.dequeued++;
        return item;
      }
    }

    return null;
  }

  /**
   * Determine priority based on message action
   * @private
   */
  _determinePriority(message) {
    const action = message.action || message.type || '';

    // Critical: health checks, keepalive
    if (action.includes('HEALTH') || action.includes('KEEPALIVE') || action.includes('PING')) {
      return MessagePriority.CRITICAL;
    }

    // High: user-initiated actions
    if (action.includes('START') || action.includes('STOP') || action.includes('CANCEL') || 
        action.includes('GET_') || action.includes('SET_')) {
      return MessagePriority.HIGH;
    }

    // Low: cleanup, background tasks
    if (action.includes('CLEANUP') || action.includes('EXPIRE') || action.includes('PURGE')) {
      return MessagePriority.LOW;
    }

    // Normal: everything else
    return MessagePriority.NORMAL;
  }

  /**
   * Remove stale messages that exceeded timeout
   * @private
   */
  _removeStaleMessages() {
    const now = Date.now();
    let removedCount = 0;

    for (const priority in this.queues) {
      const queue = this.queues[priority];
      const originalLength = queue.length;

      // Filter out stale messages
      this.queues[priority] = queue.filter(item => {
        const age = now - item.enqueuedAt;
        if (age > this.messageTimeout) {
          this.messageHashes.delete(item.hash);
          if (item.sendResponse) {
            try {
              item.sendResponse({ error: 'Request timeout', timeout: true });
            } catch (e) {
              // sendResponse may have expired
            }
          }
          return false;
        }
        return true;
      });

      removedCount += originalLength - this.queues[priority].length;
    }

    if (removedCount > 0) {
      this.stats.timeouts += removedCount;
      safeConsole.warn(`⏱️ Removed ${removedCount} stale messages from queue`);
    }
  }

  /**
   * Get total queue size across all priorities
   */
  size() {
    return Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0);
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentSize: this.size(),
      byPriority: {
        critical: this.queues[MessagePriority.CRITICAL].length,
        high: this.queues[MessagePriority.HIGH].length,
        normal: this.queues[MessagePriority.NORMAL].length,
        low: this.queues[MessagePriority.LOW].length
      }
    };
  }

  /**
   * Clear all queues
   */
  clear() {
    for (const priority in this.queues) {
      this.queues[priority] = [];
    }
    this.messageHashes.clear();
  }
}

/**
 * Connection state machine for port connections
 * Phase 3: P3-1 implementation
 */
const ConnectionState = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTING: 'disconnecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

/**
 * Connection pool manager with state machine and limits
 * Phase 3: P3-1 implementation
 */
class ConnectionPool {
  constructor(maxConnections = 50, connectionTimeout = 60000) {
    this.connections = new Map(); // portName -> connection info
    this.maxConnections = maxConnections;
    this.connectionTimeout = connectionTimeout;
    this.stats = {
      totalCreated: 0,
      currentActive: 0,
      totalDisconnected: 0,
      totalTimedOut: 0,
      totalErrors: 0
    };
  }

  /**
   * Add new connection with state machine
   */
  addConnection(port) {
    // Check connection limit
    if (this.connections.size >= this.maxConnections) {
      safeConsole.warn(`⚠️ Connection pool full (${this.maxConnections}), rejecting new connection: ${port.name}`);
      try {
        port.postMessage({ error: 'Connection pool full', retry: true });
        port.disconnect();
      } catch (e) {
        // Ignore if port already disconnected
      }
      this.stats.totalErrors++;
      return false;
    }

    const connectionId = `${port.name}_${Date.now()}`;
    const connectionInfo = {
      port,
      portName: port.name,
      connectionId,
      state: ConnectionState.CONNECTING,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      timeoutTimer: null
    };

    // Set up timeout
    connectionInfo.timeoutTimer = setTimeout(() => {
      this._handleConnectionTimeout(connectionId);
    }, this.connectionTimeout);

    this.connections.set(connectionId, connectionInfo);
    this.stats.totalCreated++;
    this.stats.currentActive++;

    safeConsole.log(`🔌 Connection added to pool: ${port.name} (${connectionId})`);

    // Transition to connected state
    setTimeout(() => {
      const conn = this.connections.get(connectionId);
      if (conn && conn.state === ConnectionState.CONNECTING) {
        conn.state = ConnectionState.CONNECTED;
        safeConsole.log(`✅ Connection ready: ${port.name}`);
      }
    }, 100);

    return true;
  }

  /**
   * Handle connection timeout
   * @private
   */
  _handleConnectionTimeout(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    safeConsole.warn(`⏱️ Connection timeout: ${conn.portName} (${connectionId})`);
    
    conn.state = ConnectionState.ERROR;
    this.stats.totalTimedOut++;

    try {
      conn.port.postMessage({ error: 'Connection timeout' });
      conn.port.disconnect();
    } catch (e) {
      // Ignore if already disconnected
    }

    this.removeConnection(connectionId);
  }

  /**
   * Update connection activity timestamp
   */
  updateActivity(connectionId) {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.lastActivity = Date.now();
      conn.messageCount++;
    }
  }

  /**
   * Remove connection from pool
   */
  removeConnection(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) return false;

    // Clear timeout timer
    if (conn.timeoutTimer) {
      clearTimeout(conn.timeoutTimer);
    }

    // Update state
    if (conn.state !== ConnectionState.DISCONNECTED) {
      conn.state = ConnectionState.DISCONNECTED;
      this.stats.totalDisconnected++;
      this.stats.currentActive--;
    }

    this.connections.delete(connectionId);
    safeConsole.log(`🔌 Connection removed from pool: ${conn.portName} (${connectionId})`);

    return true;
  }

  /**
   * Find connection by port
   */
  findByPort(port) {
    for (const [connectionId, conn] of this.connections.entries()) {
      if (conn.port === port) {
        return { connectionId, ...conn };
      }
    }
    return null;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      maxConnections: this.maxConnections,
      connectionTimeout: this.connectionTimeout
    };
  }

  /**
   * Cleanup idle connections
   */
  cleanupIdleConnections(idleTimeout = 300000) { // 5 minutes
    const now = Date.now();
    const toRemove = [];

    for (const [connectionId, conn] of this.connections.entries()) {
      const idleTime = now - conn.lastActivity;
      if (idleTime > idleTimeout && conn.state === ConnectionState.CONNECTED) {
        toRemove.push(connectionId);
      }
    }

    for (const connectionId of toRemove) {
      const conn = this.connections.get(connectionId);
      safeConsole.log(`🧹 Cleaning up idle connection: ${conn.portName} (idle for ${Math.floor((now - conn.lastActivity) / 1000)}s)`);
      
      try {
        conn.port.postMessage({ action: 'IDLE_DISCONNECT' });
        conn.port.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }

      this.removeConnection(connectionId);
    }

    if (toRemove.length > 0) {
      safeConsole.log(`🧹 Cleaned up ${toRemove.length} idle connections`);
    }
  }
}

// Initialize enhanced queues
const priorityMessageQueue = new PriorityMessageQueue(QUEUE_CONFIG.MAX_PENDING_MESSAGES, 30000);
const priorityConnectionQueue = new PriorityMessageQueue(50, 10000); // Smaller queue for connections
const connectionPool = new ConnectionPool(50, 60000);

// Legacy arrays for backward compatibility during transition
let pendingMessages = [];
let pendingConnections = [];

// Mutex-based queue draining synchronization (CR-011 fix)
let queueDrained = false;
let queueDrainLock = null;
let queueDrainInProgress = false;

// Initialization timeout tracker
let initTimeoutId = null;

// Start periodic cleanup of idle connections
setInterval(() => {
  connectionPool.cleanupIdleConnections();
}, 60000); // Every minute

// ============================================================================
// PHASE 2: HEALTH MONITORING AND OBSERVABILITY SYSTEM
// ============================================================================

// Health monitoring state
let serviceWorkerRestartCount = 0;
let serviceWorkerStartTimestamps = [];
let keepaliveAlarmCount = 0;
let keepaliveAlarmFailures = 0;
let lastKeepaliveTime = null;
let healthMetricsInterval = null;

// Message processing metrics
let messageProcessingTimes = [];
const MAX_PROCESSING_SAMPLES = 100;

// Connection health metrics
let connectionMetrics = {
  activePorts: 0,
  totalConnections: 0,
  disconnections: 0,
  reconnectionAttempts: 0,
  connectionErrors: 0
};

/**
 * Track service worker restart
 * @private
 */
function trackServiceWorkerStart() {
  serviceWorkerRestartCount++;
  const timestamp = Date.now();
  serviceWorkerStartTimestamps.push(timestamp);
  
  // Keep only last 10 restart timestamps
  if (serviceWorkerStartTimestamps.length > 10) {
    serviceWorkerStartTimestamps.shift();
  }
  
  safeConsole.info(`🔄 Service worker start #${serviceWorkerRestartCount} at ${new Date(timestamp).toISOString()}`);
}

/**
 * Get comprehensive health status for dashboard and monitoring
 * Phase 2: P2-2 implementation
 * 
 * @returns {Object} Complete health status object
 */
async function getHealthStatus() {
  const now = Date.now();
  const uptime = typeof serviceWorkerStartTime !== 'undefined' 
    ? now - serviceWorkerStartTime 
    : 0;
  
  // Calculate average message processing time
  const avgProcessingTime = messageProcessingTimes.length > 0
    ? messageProcessingTimes.reduce((a, b) => a + b, 0) / messageProcessingTimes.length
    : 0;
  
  // Get alarm status
  let alarmStatus = { keepalive: 'unknown', healthCheck: 'unknown' };
  try {
    const alarms = await chrome.alarms.getAll();
    const keepaliveAlarm = alarms.find(a => a.name === 'stepthree-keepalive');
    const healthCheckAlarm = alarms.find(a => a.name === 'stepthree-health-check');
    
    alarmStatus = {
      keepalive: keepaliveAlarm ? 'active' : 'inactive',
      healthCheck: healthCheckAlarm ? 'active' : 'inactive',
      keepaliveSchedule: keepaliveAlarm?.scheduledTime ? new Date(keepaliveAlarm.scheduledTime).toISOString() : null,
      totalAlarms: alarms.length
    };
  } catch (error) {
    safeConsole.warn('⚠️ Failed to get alarm status:', error);
  }
  
  // Memory status
  const memoryStatus = performance.memory ? {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    usedMB: Math.floor(performance.memory.usedJSHeapSize / 1024 / 1024),
    totalMB: Math.floor(performance.memory.totalJSHeapSize / 1024 / 1024),
    limitMB: Math.floor(performance.memory.jsHeapSizeLimit / 1024 / 1024)
  } : null;
  
  return {
    timestamp: now,
    uptime,
    uptimeFormatted: formatDuration(uptime),
    
    // Restart tracking
    restartCount: serviceWorkerRestartCount,
    restartTimestamps: serviceWorkerStartTimestamps,
    lastRestart: serviceWorkerStartTimestamps[serviceWorkerStartTimestamps.length - 1] || null,
    
    // Keepalive monitoring
    keepalive: {
      alarmCount: keepaliveAlarmCount,
      failureCount: keepaliveAlarmFailures,
      successRate: keepaliveAlarmCount > 0 
        ? ((keepaliveAlarmCount - keepaliveAlarmFailures) / keepaliveAlarmCount * 100).toFixed(2) + '%'
        : 'N/A',
      lastKeepalive: lastKeepaliveTime,
      timeSinceLastKeepalive: lastKeepaliveTime ? now - lastKeepaliveTime : null,
      alarmStatus: alarmStatus.keepalive,
      healthCheckStatus: alarmStatus.healthCheck
    },
    
    // Message processing metrics
    messageProcessing: {
      totalMessages: globalProxyRouter?.performanceMetrics?.messageCount || 0,
      averageProcessingTime: Math.round(avgProcessingTime),
      samples: messageProcessingTimes.length,
      recentTimes: messageProcessingTimes.slice(-10)
    },
    
    // Connection health
    connections: {
      ...connectionMetrics,
      activePortNames: globalProxyRouter?.portConnections 
        ? Array.from(globalProxyRouter.portConnections.keys())
        : []
    },
    
    // Queue status
    queues: {
      pendingMessages: pendingMessages.length,
      pendingConnections: pendingConnections.length,
      queueDrained,
      queueDrainInProgress
    },
    
    // Router status
    router: {
      ready: proxyRouterReady,
      initialized: globalProxyRouter?.isInitialized || false,
      errorCount: globalProxyRouter?.performanceMetrics?.errorCount || 0
    },
    
    // Memory status
    memory: memoryStatus,
    
    // Alarm configuration
    alarms: alarmStatus,
    
    // Overall health assessment
    healthy: proxyRouterReady && 
             queueDrained && 
             (keepaliveAlarmFailures < 3) &&
             (pendingMessages.length < QUEUE_CONFIG.MAX_PENDING_MESSAGES * 0.8),
    
    issues: []
  };
}

/**
 * Format duration in milliseconds to human readable string
 * @private
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Log health metrics periodically
 * @private
 */
async function logHealthMetrics() {
  try {
    const health = await getHealthStatus();
    
    safeConsole.info('📊 Health Metrics Report:', {
      uptime: health.uptimeFormatted,
      restarts: health.restartCount,
      keepaliveSuccess: health.keepalive.successRate,
      avgMessageTime: health.messageProcessing.averageProcessingTime + 'ms',
      activePorts: health.connections.activePorts,
      memory: health.memory ? `${health.memory.usedMB}MB / ${health.memory.limitMB}MB` : 'N/A',
      healthy: health.healthy ? '✅' : '⚠️',
      issues: health.issues
    });
    
    if (!health.healthy) {
      safeConsole.warn('⚠️ Service worker health issues detected');
    }
  } catch (error) {
    safeConsole.error('❌ Failed to log health metrics:', error);
  }
}

/**
 * Start periodic health metrics logging (every 5 minutes)
 * @private
 */
function startHealthMetricsLogging() {
  if (healthMetricsInterval) {
    clearInterval(healthMetricsInterval);
  }
  
  // Log immediately on start
  logHealthMetrics();
  
  // Then log every 5 minutes
  healthMetricsInterval = setInterval(() => {
    logHealthMetrics();
  }, 5 * 60 * 1000); // 5 minutes
  
  safeConsole.info('📊 Health metrics logging started (every 5 minutes)');
}

/**
 * Track message processing time
 * @private
 */
function trackMessageProcessingTime(startTime) {
  const processingTime = Date.now() - startTime;
  messageProcessingTimes.push(processingTime);
  
  // Keep only last N samples
  if (messageProcessingTimes.length > MAX_PROCESSING_SAMPLES) {
    messageProcessingTimes.shift();
  }
  
  return processingTime;
}

// Track service worker start
trackServiceWorkerStart();

// Start health metrics logging
if (typeof window === 'undefined') {
  // Only start in service worker context (not in imported contexts)
  setTimeout(() => {
    startHealthMetricsLogging();
  }, 5000); // Delay to allow initialization
}

// ============================================================================
// MV3 COMPLIANT: TOP-LEVEL EVENT LISTENER REGISTRATION
// ============================================================================

/**
 * MV3 COMPLIANT: Pure wrapper functions that delegate to router methods
 * These are registered at top level during initial script evaluation
 */

// Alarm event handler wrapper with readiness guard
function onAlarmWrapper(alarm) {
  try {
    if (proxyRouterReady && globalProxyRouter && typeof globalProxyRouter.handleAlarmEvent === 'function') {
      globalProxyRouter.handleAlarmEvent(alarm);
    } else {
      // Alarms are critical for keepalive, continue with fallback behavior
      console.warn('⚠️ ProxyRouter not ready for alarm event, using fallback:', alarm.name);
      
      // Basic keepalive fallback
      if (alarm.name === 'stepthree-keepalive') {
        console.log('💓 Fallback keepalive heartbeat - service worker active');
        // Update activity timestamp if available
        if (typeof lastActivity !== 'undefined') {
          lastActivity = Date.now();
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in alarm wrapper:', error);
  }
}

// Message event handler wrapper with readiness guard
function onMessageWrapper(message, sender, sendResponse) {
  const startTime = Date.now(); // Phase 2: Track message processing time
  
  try {
    // CR-011 FIX: Check both proxyRouterReady AND queueDrained to prevent race conditions
    // Only process directly if router is ready AND queue has been drained
    if (proxyRouterReady && queueDrained && globalProxyRouter && typeof globalProxyRouter.handleMessage === 'function') {
      // Phase 2: Wrap sendResponse to track processing time
      const wrappedSendResponse = (response) => {
        trackMessageProcessingTime(startTime);
        sendResponse(response);
      };
      
      globalProxyRouter.handleMessage(message, sender, wrappedSendResponse);
      return true; // Keep message channel open for async responses
    } else if (!proxyRouterReady || !queueDrained) {
      // Queue message for processing once router is ready AND queue is drained
      // This prevents race condition where messages arrive during queue draining
      console.log('📫 Queueing message until ProxyRouter is ready and queue is drained:', message?.action || message?.type);
      pendingMessages.push({ message, sender, sendResponse, timestamp: Date.now() });
      
      // SECURITY FIX: Bounded queue with LRU eviction prevents memory leak
      // When queue exceeds limit, remove oldest (FIFO) to prevent unbounded growth
      if (pendingMessages.length > QUEUE_CONFIG.MAX_PENDING_MESSAGES) {
        const dropped = pendingMessages.shift(); // Remove oldest entry (LRU eviction)
        dropped.sendResponse({ error: 'Service worker overloaded, message dropped' });
        console.warn(`⚠️ MEMORY PROTECTION: Dropped oldest pending message (queue full: ${QUEUE_CONFIG.MAX_PENDING_MESSAGES})`);
      }
      return true; // Keep channel open for queued processing
    } else {
      console.warn('⚠️ ProxyRouter not ready for message:', message?.action || message?.type);
      sendResponse({ error: 'Service worker initializing, please retry' });
      return false;
    }
  } catch (error) {
    console.error('❌ Error in message wrapper:', error);
    sendResponse({ error: 'Message handling failed' });
    return false;
  }
}

// Port connection handler wrapper with readiness guard
function onConnectWrapper(port) {
  try {
    // CR-011 FIX: Check both proxyRouterReady AND queueDrained to prevent race conditions
    if (proxyRouterReady && queueDrained && globalProxyRouter && typeof globalProxyRouter.handlePortConnection === 'function') {
      globalProxyRouter.handlePortConnection(port);
    } else if (!proxyRouterReady || !queueDrained) {
      // Queue port connection for processing once router is ready AND queue is drained
      console.log('🔌 Queueing port connection until ProxyRouter is ready and queue is drained:', port.name);
      pendingConnections.push({ port, timestamp: Date.now() });
      
      // SECURITY FIX: Bounded queue with LRU eviction prevents memory leak
      // When queue exceeds limit, remove oldest (FIFO) to prevent unbounded growth
      if (pendingConnections.length > 50) {
        const dropped = pendingConnections.shift(); // Remove oldest entry (LRU eviction)
        console.warn(`⚠️ MEMORY PROTECTION: Dropped oldest pending connection (queue full: 50)`);
        // Port will disconnect naturally
      }
    } else {
      console.warn('⚠️ ProxyRouter not ready for port connection:', port.name);
      // Port will disconnect naturally if not handled
    }
  } catch (error) {
    console.error('❌ Error in connect wrapper:', error);
  }
}

// Action click handler wrapper with enhanced error handling
async function onActionClickWrapper(tab) {
  try {
    if (typeof lastActivity !== 'undefined') {
      lastActivity = Date.now();
    }
    
    console.log('🖱️ Extension icon clicked on tab:', tab?.id);
    
    if (!tab || !tab.id) {
      console.warn('⚠️ No active tab found for icon click');
      if (typeof showErrorNotification === 'function') {
        await showErrorNotification('Please ensure you are on a valid web page and try again.');
      }
      return;
    }
    
    // Inject content script on-demand before opening dashboard
    await injectContentScript(tab.id, false);
    
    // Delegate to existing handler
    if (typeof openDashboard === 'function') {
      await openDashboard(tab);
    } else {
      console.warn('⚠️ openDashboard function not available');
    }
  } catch (error) {
    console.error('❌ Error in action click wrapper:', error);
    
    if (globalProxyRouter && globalProxyRouter.errorHandler && typeof globalProxyRouter.errorHandler.handleError === 'function') {
      globalProxyRouter.errorHandler.handleError(error, 'Icon Click Handler', { tabId: tab?.id }, 'medium');
    }
    
    if (typeof showErrorNotification === 'function') {
      await showErrorNotification('Failed to open dashboard. Please try again.');
    }
  }
}

// Command handler wrapper with enhanced error handling
async function onCommandWrapper(command, tab) {
  try {
    if (typeof lastActivity !== 'undefined') {
      lastActivity = Date.now();
    }
    
    console.log('⌨️ Keyboard command received:', command, 'on tab:', tab?.id);
    
    if (!tab || !tab.id) {
      console.warn('⚠️ No active tab found for command:', command);
      if (typeof showErrorNotification === 'function') {
        await showErrorNotification('Please ensure you are on a valid web page and try the command again.');
      }
      return;
    }
    
    // Inject content script on-demand before executing command
    await injectContentScript(tab.id, false);
    
    // Delegate to existing handler
    if (typeof handleKeyboardCommand === 'function') {
      await handleKeyboardCommand(command, tab);
    } else {
      console.warn('⚠️ handleKeyboardCommand function not available');
    }
  } catch (error) {
    console.error('❌ Error in command wrapper:', error);
    
    if (globalProxyRouter && globalProxyRouter.errorHandler && typeof globalProxyRouter.errorHandler.handleError === 'function') {
      globalProxyRouter.errorHandler.handleError(error, 'Command Handler', { command, tabId: tab?.id }, 'medium');
    }
    
    if (typeof showErrorNotification === 'function') {
      await showErrorNotification(`Command '${command}' failed. Please try again.`);
    }
  }
}

/**
 * MV3 COMPLIANT: Register ALL Chrome API event listeners during initial script evaluation
 * This MUST happen synchronously during script parsing, not in async functions
 */

// Register alarm listener (MOVED FROM startServiceWorkerWatchdog)
chrome.alarms.onAlarm.addListener(onAlarmWrapper);

// Register message listener (MOVED FROM setupMessageRouting)
chrome.runtime.onMessage.addListener(onMessageWrapper);

// Register port connection listener (MOVED FROM setupPortHandling)
chrome.runtime.onConnect.addListener(onConnectWrapper);

// Register action click listener
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(onActionClickWrapper);
}

// Register command listener
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(onCommandWrapper);
}

// Context menu handler wrapper
async function onContextMenuClickWrapper(info, tab) {
  try {
    if (typeof lastActivity !== 'undefined') {
      lastActivity = Date.now();
    }
    
    console.log('📋 Context menu clicked:', info.menuItemId);
    
    // Inject content script on-demand before handling context menu action
    if (tab && tab.id) {
      await injectContentScript(tab.id, false);
    }
    
    // Delegate to context menu manager if available
    if (typeof contextMenuManager !== 'undefined' && contextMenuManager && typeof contextMenuManager.handleContextMenuClick === 'function') {
      await contextMenuManager.handleContextMenuClick(info, tab);
    } else {
      console.warn('⚠️ contextMenuManager not available');
    }
  } catch (error) {
    console.error('❌ Error in context menu wrapper:', error);
    
    if (globalProxyRouter && globalProxyRouter.errorHandler && typeof globalProxyRouter.errorHandler.handleError === 'function') {
      globalProxyRouter.errorHandler.handleError(error, 'Context Menu Handler', {
        menuItemId: info?.menuItemId,
        tabId: tab?.id
      }, 'medium');
    }
  }
}

// Tab update handler wrapper
function onTabUpdatedWrapper(tabId, changeInfo, tab) {
  try {
    if (typeof lastActivity !== 'undefined') {
      lastActivity = Date.now();
    }
    
    // Log significant tab changes
    if (changeInfo.status === 'complete' || changeInfo.url) {
      console.log(`📄 Tab ${tabId} updated:`, changeInfo);
    }
    
    // Handle tab updates if needed by other components
    // This is typically used for content script injection or state tracking
  } catch (error) {
    console.error('❌ Error in tab update wrapper:', error);
  }
}

// Register context menu listener
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(onContextMenuClickWrapper);
}

// Register tab update listener  
if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener(onTabUpdatedWrapper);
}

// NOTE: No module-scope logging for MV3 compliance - all event listeners registered above

// ============================================================================
// INITIALIZATION TIMEOUT - Prevent infinite queuing if router fails to initialize
// ============================================================================

const INIT_TIMEOUT_MS = 10000; // 10 seconds
initTimeoutId = setTimeout(() => {
  if (!proxyRouterReady) {
    console.error('❌ CRITICAL: ProxyRouter failed to initialize within timeout');
    
    // Respond to all queued messages with error
    console.warn(`Clearing ${pendingMessages.length} queued messages due to initialization failure`);
    pendingMessages.forEach(({sendResponse}) => {
      try {
        sendResponse({
          error: 'Service worker initialization failed',
          retryable: true,
          errorCode: 'INIT_TIMEOUT'
        });
      } catch (e) {
        // sendResponse may have already expired, ignore
        console.debug('sendResponse callback expired:', e);
      }
    });
    pendingMessages = [];
    
    // Clear queued connections
    console.warn(`Clearing ${pendingConnections.length} queued connections due to initialization failure`);
    pendingConnections.forEach(({port}) => {
      try {
        port.postMessage({
          type: 'INIT_ERROR',
          error: 'Service worker initialization failed'
        });
        port.disconnect();
      } catch (e) {
        console.debug('Port already disconnected:', e);
      }
    });
    pendingConnections = [];
  }
}, INIT_TIMEOUT_MS);

/**
 * CR-011 FIX: Fallback queue draining when ProxyRouter fails to initialize
 * Handles pending messages and connections with proper error responses
 * Respects mutex to prevent race conditions with normal queue draining
 */
async function drainQueuesFallback() {
  // CR-011 FIX: Check if queue is already drained or being drained
  if (queueDrained) {
    console.log('✅ Queue already drained, skipping fallback...');
    return;
  }
  
  if (queueDrainInProgress) {
    console.log('⏳ Queue draining in progress, waiting for completion...');
    if (queueDrainLock) {
      await queueDrainLock;
    }
    return;
  }
  
  // CR-011 FIX: Acquire the drain lock to prevent concurrent draining
  queueDrainInProgress = true;
  let resolveLock;
  queueDrainLock = new Promise(resolve => { resolveLock = resolve; });
  
  try {
    console.log('🔄 Draining queues with fallback handling (mutex-protected)...');
    
    // Drain pending messages with error responses
    const messagesToDrain = [...pendingMessages];
    pendingMessages = [];
    
    for (const item of messagesToDrain) {
      try {
        item.sendResponse({
          ok: false,
          error: 'ProxyRouter initialization failed, using fallback handling',
          requestId: item.message.requestId || `fallback_${Date.now()}`,
          fallback: true
        });
      } catch (error) {
        console.warn('❌ Failed to respond to queued message:', error);
      }
    }
    
    // Drain pending connections (they will timeout naturally)
    const connectionsToDrain = [...pendingConnections];
    pendingConnections = [];
    
    for (const item of connectionsToDrain) {
      console.log(`⚠️ Dropping queued connection: ${item.port.name} (ProxyRouter failed)`);
    }
    
    // CR-011 FIX: Mark queue as drained after fallback processing
    queueDrained = true;
    
    console.log(`✅ Fallback queue drain completed: ${messagesToDrain.length} messages, ${connectionsToDrain.length} connections`);
    
  } catch (error) {
    console.error('❌ Fallback queue draining failed:', error);
    // Don't mark as drained on error to allow retry
  } finally {
    // CR-011 FIX: Always release the lock
    queueDrainInProgress = false;
    if (resolveLock) {
      resolveLock();
    }
  }
}

// ============================================================================
// ON-DEMAND CONTENT SCRIPT INJECTION
// ============================================================================

/**
 * Inject content script when needed (on-demand injection)
 * Checks if already injected to prevent duplicate injection
 * @param {number} tabId - The ID of the tab to inject into
 * @param {boolean} allFrames - Whether to inject into all frames (default: false)
 * @returns {Promise<boolean>} - True if injected successfully, false if already injected or failed
 */
async function injectContentScript(tabId, allFrames = false) {
  try {
    safeConsole.log(`💉 Attempting to inject content script into tab ${tabId}...`);
    
    // Check if already injected by testing for the flag
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__STEPTHREE_INJECTED
    });
    
    if (results && results[0]?.result) {
      safeConsole.log(`✅ Content script already injected in tab ${tabId}, skipping...`);
      return false; // Already injected
    }
    
    // Inject the bundled content script
    await chrome.scripting.executeScript({
      target: { tabId, allFrames },
      files: ['dist/content.js']
    });
    
    safeConsole.log(`✅ Content script injected successfully into tab ${tabId}`);
    return true;
    
  } catch (error) {
    safeConsole.error(`❌ Failed to inject content script into tab ${tabId}:`, error);
    
    // Log specific error types for debugging
    if (error.message?.includes('Cannot access')) {
      safeConsole.warn('⚠️ Cannot inject into this page (likely chrome:// or extension page)');
    } else if (error.message?.includes('No tab with id')) {
      safeConsole.warn('⚠️ Tab no longer exists');
    }
    
    return false;
  }
}

// Make injectContentScript available globally for other modules
globalThis.injectContentScript = injectContentScript;

// Define required scripts for initialization tracking
const requiredScripts = [
  './consolidated-background.js',
  '../lib/message-schema.js',
  '../lib/proxy-router.js',
  '../lib/retry-manager.js',
  '../lib/sample-data.js',
  '../lib/consolidated-systems.js'
];

// Initialize script loading counters
let scriptsLoaded = 0;
let scriptLoadErrors = [];

// NOTE: importScripts blocks removed for ES module compatibility and MV3 compliance
// All dependencies are bundled into dist/background.js via esbuild
// The following code is preserved as comments for reference only:
/*
try {
  importScripts('./consolidated-background.js');
  scriptsLoaded++;
} catch (error) {
  scriptLoadErrors.push('consolidated-background.js');
}

try {
  importScripts('../lib/message-schema.js');
  scriptsLoaded++;
} catch (error) {
  scriptLoadErrors.push('message-schema.js');
}

try {
  importScripts('../lib/proxy-router.js');
  scriptsLoaded++;
} catch (error) {
  scriptLoadErrors.push('proxy-router.js');
}

try {
  importScripts('../lib/retry-manager.js');
  scriptsLoaded++;
} catch (error) {
  scriptLoadErrors.push('retry-manager.js');
}

try {
  importScripts('../lib/sample-data.js');
  scriptsLoaded++;
} catch (error) {
  scriptLoadErrors.push('sample-data.js');
}

try {
  importScripts('../lib/consolidated-systems.js');
  scriptsLoaded++;
} catch (error) {
  scriptLoadErrors.push('consolidated-systems.js');
}
*/

// ============================================================================
// MV3 COMPLIANT PROXY ROUTER SYSTEM
// ============================================================================

// ProxyRouter singleton is now declared at the top of the file
// This ensures proper initialization order

/**
 * ProxyRouter - Centralized communication system for STEPTHREE Chrome Extension
 * Routes messages between service worker, content scripts, popup, and dashboard
 * Provides port channel support with keepalive and state persistence
 * MV3 COMPLIANT: Singleton pattern for top-level event listener registration
 */
class ProxyRouter {
  constructor(options = {}) {
    this.isInitialized = false;
    this.messageHandlers = new Map();
    this.portConnections = new Map(); // Map<string, Set<ConnectionInfo>>
    this.subscriptions = new Map(); // Map<string, Set<string>>
    this.messageQueue = [];
    this.maxQueueSize = options.maxPendingMessages || 1000; // Bounded queue to prevent memory leaks
    this.state = {
      jobs: new Map(),
      progress: new Map(),
      permissions: new Map(),
      health: { status: 'starting', lastCheck: Date.now() },
      retries: new Map(), // Phase 1b: Retry state tracking
      demo: {
        isActive: false,
        currentGalleryType: null,
        sampleData: null,
        sessionStartTime: null,
        stats: {}
      }
    };
    
    // Backpressure management
    this.updateThrottle = new Map();
    this.maxUpdateRate = 100; // 10Hz = 100ms minimum interval
    this.maxQueueSize = 1000;
    
    // Session state persistence
    this.stateKey = 'stepthree_proxy_state';
    this.lastStateSave = 0;
    this.stateSaveInterval = 5000; // Save state every 5 seconds
    
    // Port keepalive management
    this.portKeepaliveInterval = 30000; // 30 seconds
    this.portKeepaliveTimers = new Map();
    
    // Phase 1b: RetryManager integration
    this.retryManager = null;
    this.errorHandler = null;
    
    // Demo Mode Manager integration
    this.demoModeManager = null;
    
    // Initialize performance metrics to prevent undefined access during early messages
    this.performanceMetrics = {
      startTime: Date.now(),
      messageCount: 0,
      errorCount: 0,
      memoryUsage: [],
      responseTime: [],
      lastHealthCheck: Date.now(),
      // ENHANCED: Add message validation telemetry
      validationErrors: 0,
      normalizedMessages: 0,
      legacyMessages: 0,
      broadcastsSent: 0,
      broadcastValidationErrors: 0
    };
    
    console.log('🔄 ProxyRouter initialized');
  }

  /**
   * Initialize the ProxyRouter system
   * MV3 COMPLIANT: Idempotent initialization that can be called multiple times
   */
  async initialize(existingMessageHandler = null) {
    // Idempotent check - prevent duplicate initialization
    if (this.isInitialized) {
      console.log('✅ ProxyRouter already initialized, skipping...');
      return true;
    }
    
    try {
      console.log('🚀 Initializing ProxyRouter...');
      
      // Phase 1b: Initialize ErrorHandlingSystem first
      await this.initializeErrorHandling();
      
      // Phase 1b: Initialize RetryManager with ErrorHandlingSystem integration
      await this.initializeRetryManager();
      
      // Load persisted state
      await this.loadState();
      
      // Set up message routing
      this.setupMessageRouting();
      
      // Set up port connection handling
      this.setupPortHandling();
      
      // Register default message handlers
      this.registerDefaultHandlers(existingMessageHandler);
      
      // Phase 1b: Register retry message handlers
      this.registerRetryHandlers();
      
      // Initialize and register demo mode handlers
      await this.initializeDemoMode();
      this.registerDemoModeHandlers();
      
      // Start periodic state saving
      this.startPeriodicStateSave();
      
      // Start port keepalive system
      this.startPortKeepalive();
      
      // ENHANCED: Start watchdog timers for service worker health
      this.startServiceWorkerWatchdog();
      
      // ENHANCED: Initialize performance monitoring
      this.initializePerformanceMonitoring();
      
      this.isInitialized = true;
      
      // Update health status
      this.updateHealthStatus('running');
      
      console.log('✅ ProxyRouter initialized successfully with enhanced monitoring');
      return true;
      
    } catch (error) {
      console.error('❌ ProxyRouter initialization failed:', error);
      this.updateHealthStatus('error', error.message);
      return false;
    }
  }

  /**
   * ENHANCED: Initialize performance monitoring safeguards
   */
  initializePerformanceMonitoring() {
    // Performance metrics are already initialized in constructor to prevent early access errors
    // This method now only sets up the monitoring intervals and resets counters if needed
    if (!this.performanceMetrics) {
      console.warn('⚠️ Performance metrics not found in constructor, reinitializing...');
      this.performanceMetrics = {
        startTime: Date.now(),
        messageCount: 0,
        errorCount: 0,
        memoryUsage: [],
        responseTime: [],
        lastHealthCheck: Date.now()
      };
    } else {
      // Reset start time and clear arrays for fresh monitoring
      this.performanceMetrics.startTime = Date.now();
      this.performanceMetrics.lastHealthCheck = Date.now();
      console.log('📊 Performance monitoring reinitializing with existing metrics');
    }

    // Monitor message processing performance
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 30000); // Every 30 seconds

    console.log('📊 Performance monitoring initialized');
  }

  /**
   * ENHANCED: Start service worker watchdog timers
   * MV3 COMPLIANT: Only creates alarms, does NOT register event listeners
   */
  startServiceWorkerWatchdog() {
    // Create a keepalive alarm to prevent service worker suspension
    chrome.alarms.create('stepthree-keepalive', {
      delayInMinutes: 1.0,
      periodInMinutes: 1.0
    });

    // Create health check alarm
    chrome.alarms.create('stepthree-health-check', {
      delayInMinutes: 1,
      periodInMinutes: 2
    });

    // NOTE: Event listener is registered at top level during script evaluation
    console.log('⏰ Service worker watchdog timers started');
  }

  /**
   * Handle alarm events with proper context binding
   * ENHANCED: Includes functionality from removed duplicate listener
   */
  async handleAlarmEvent(alarm) {
    try {
      if (typeof lastActivity !== 'undefined') {
        lastActivity = Date.now();
      }
      if (typeof lastAlarmHeartbeat !== 'undefined') {
        lastAlarmHeartbeat = Date.now();
      }
      if (typeof alarmFailureCount !== 'undefined') {
        alarmFailureCount = 0; // Reset failure count on successful alarm
      }
      
      // Handle STEPTHREE keepalive alarm
      if (alarm.name === 'stepthree-keepalive' || (typeof KEEPALIVE_ALARM_NAME !== 'undefined' && alarm.name === KEEPALIVE_ALARM_NAME)) {
        // Phase 2: Track keepalive metrics
        keepaliveAlarmCount++;
        lastKeepaliveTime = Date.now();
        
        console.log('💓 Keepalive heartbeat - service worker active');
        this.performKeepalive();
        
        // Clear fallback timer since alarm is working
        if (typeof fallbackKeepaliveTimer !== 'undefined' && fallbackKeepaliveTimer) {
          clearTimeout(fallbackKeepaliveTimer);
          fallbackKeepaliveTimer = null;
        }
        
        // Quick health check and stats logging
        if (typeof serviceWorkerStartTime !== 'undefined') {
          const uptime = Math.floor((Date.now() - serviceWorkerStartTime) / 1000);
          const memoryInfo = performance.memory ? {
            used: Math.floor(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.floor(performance.memory.totalJSHeapSize / 1024 / 1024)
          } : null;
          
          console.log('📊 SW Status:', {
            uptime: `${uptime}s`,
            initialized: typeof isExtensionInitialized !== 'undefined' ? isExtensionInitialized : 'unknown',
            memory: memoryInfo ? `${memoryInfo.used}/${memoryInfo.total}MB` : 'unknown',
            lastActivity: typeof lastActivity !== 'undefined' ? `${Math.floor((Date.now() - lastActivity) / 1000)}s ago` : 'unknown',
            alarmWorking: true
          });
        }
        
        // Automatic recovery if not initialized
        if (typeof isExtensionInitialized !== 'undefined' && typeof isShuttingDown !== 'undefined' && 
            !isExtensionInitialized && !isShuttingDown && typeof initializeExtension === 'function') {
          console.log('🔧 Extension not initialized during keepalive, triggering recovery...');
          await initializeExtension();
        }
        
        // Verify alarm system health
        if (typeof verifyAndRepairAlarmSystem === 'function') {
          await verifyAndRepairAlarmSystem();
        }
        
      } else if (alarm.name === 'stepthree-health-check' || (typeof HEALTH_CHECK_ALARM_NAME !== 'undefined' && alarm.name === HEALTH_CHECK_ALARM_NAME)) {
        console.log('🏥 Performing comprehensive health check...');
        this.performHealthCheck();
        
        if (typeof performComprehensiveHealthCheck === 'function') {
          await performComprehensiveHealthCheck();
        }
      } else {
        console.log('🔔 Unknown alarm:', alarm.name);
      }
    } catch (error) {
      console.error('❌ Alarm handler error:', error);
      
      // Phase 2: Track keepalive failures
      keepaliveAlarmFailures++;
      
      if (typeof alarmFailureCount !== 'undefined') {
        alarmFailureCount++;
      }
      
      if (this.errorHandler && typeof this.errorHandler.handleError === 'function') {
        this.errorHandler.handleError(error, 'Alarm Handler', { 
          alarmName: alarm.name, 
          failureCount: typeof alarmFailureCount !== 'undefined' ? alarmFailureCount : 0
        }, 'medium');
      }
      
      // If alarm handler fails repeatedly, start fallback mechanisms
      if (typeof alarmFailureCount !== 'undefined' && alarmFailureCount >= 3 && typeof activateFallbackKeepalive === 'function') {
        console.warn('⚠️ Multiple alarm failures detected, activating fallback keepalive...');
        activateFallbackKeepalive();
      }
    }
  }

  /**
   * Handle runtime messages with proper context binding
   */
  handleMessageBound(message, sender, sendResponse) {
    this.handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async responses
  }

  /**
   * ENHANCED: Perform keepalive to prevent service worker suspension
   */
  performKeepalive() {
    console.log('💓 Service worker keepalive');
    this.updateHealthStatus('active');
    
    // Ping all connected ports to maintain connections
    for (const [portName, connections] of this.portConnections) {
      for (const connection of connections) {
        if (connection.connected) {
          try {
            connection.port.postMessage({
              action: 'PORT_KEEPALIVE',
              timestamp: Date.now()
            });
          } catch (error) {
            console.warn('Failed to send keepalive to port:', portName);
            this.handlePortDisconnection(connection.port);
          }
        }
      }
    }
  }

  /**
   * ENHANCED: Perform comprehensive health check with validation telemetry
   */
  performHealthCheck() {
    const now = Date.now();
    const uptime = this.performanceMetrics ? now - this.performanceMetrics.startTime : 0;
    
    const healthData = {
      status: 'healthy',
      uptime,
      messageCount: this.performanceMetrics ? this.performanceMetrics.messageCount : 0,
      errorCount: this.performanceMetrics ? this.performanceMetrics.errorCount : 0,
      portConnections: this.portConnections.size,
      memoryUsage: this.getMemoryUsage(),
      timestamp: now,
      // ENHANCED: Include validation telemetry
      validation: {
        validationErrors: this.performanceMetrics ? this.performanceMetrics.validationErrors : 0,
        normalizedMessages: this.performanceMetrics ? this.performanceMetrics.normalizedMessages : 0,
        legacyMessages: this.performanceMetrics ? this.performanceMetrics.legacyMessages : 0,
        broadcastsSent: this.performanceMetrics ? this.performanceMetrics.broadcastsSent : 0,
        broadcastValidationErrors: this.performanceMetrics ? this.performanceMetrics.broadcastValidationErrors : 0,
        recentFailures: this.validationFailures ? this.validationFailures.length : 0
      }
    };

    // ENHANCED: Check for validation issues
    if (this.performanceMetrics) {
      const validationErrorRate = this.performanceMetrics.validationErrors / Math.max(this.performanceMetrics.messageCount, 1);
      
      if (validationErrorRate > 0.1) { // More than 10% validation failures
        healthData.status = 'degraded';
        healthData.warning = `High validation failure rate: ${(validationErrorRate * 100).toFixed(1)}%`;
      } else if (this.performanceMetrics.errorCount > 50) {
        healthData.status = 'degraded';
        healthData.warning = 'High general error count detected';
      }

      if (uptime > 3600000 && this.performanceMetrics.messageCount === 0) {
        healthData.status = 'inactive';
        healthData.warning = 'No messages processed recently';
      }

      // Check for broadcast validation issues
      if (this.performanceMetrics.broadcastValidationErrors > 10) {
        healthData.status = 'degraded';
        healthData.warning = 'High broadcast validation failures detected';
      }
    }

    this.updateHealthStatus(healthData.status, healthData);
    console.log('🏥 Enhanced health check completed:', {
      ...healthData,
      validationSummary: {
        errorRate: this.performanceMetrics ? (this.performanceMetrics.validationErrors / Math.max(this.performanceMetrics.messageCount, 1) * 100).toFixed(1) + '%' : '0%',
        legacyMessageRate: this.performanceMetrics ? (this.performanceMetrics.legacyMessages / Math.max(this.performanceMetrics.messageCount, 1) * 100).toFixed(1) + '%' : '0%'
      }
    });
  }

  /**
   * ENHANCED: Collect performance metrics
   */
  collectPerformanceMetrics() {
    if (!this.performanceMetrics) {
      console.warn('⚠️ Performance metrics not initialized, skipping collection');
      return;
    }
    
    const memUsage = this.getMemoryUsage();
    
    this.performanceMetrics.memoryUsage.push({
      usage: memUsage,
      timestamp: Date.now()
    });

    // Keep only last 100 entries
    if (this.performanceMetrics.memoryUsage.length > 100) {
      this.performanceMetrics.memoryUsage.shift();
    }

    // Check for memory leaks
    if (this.performanceMetrics.memoryUsage.length > 10) {
      const recent = this.performanceMetrics.memoryUsage.slice(-10);
      const growth = recent[recent.length - 1].usage - recent[0].usage;
      
      if (growth > 50 * 1024 * 1024) { // 50MB growth
        console.warn('⚠️ Potential memory leak detected');
        this.broadcastUpdate('warning', {
          type: 'memory_leak',
          message: 'High memory usage detected',
          growth: growth / (1024 * 1024) + 'MB'
        });
      }
    }
  }

  /**
   * Broadcast method for RetryManager compatibility
   * Delegates to broadcastUpdate method
   */
  broadcast(message) {
    try {
      if (!message || typeof message !== 'object') {
        console.warn('⚠️ Invalid broadcast message:', message);
        return;
      }

      // Extract update type and data from the message
      const updateType = message.updateType || message.action || 'unknown_update';
      const data = message.data || message;
      const options = {
        priority: message.priority,
        fallbackToMessage: message.fallbackToMessage
      };

      console.log(`📡 [BROADCAST] RetryManager broadcast:`, {
        updateType,
        dataSize: JSON.stringify(data).length,
        source: message.source || 'unknown'
      });

      // Use the existing broadcastUpdate method
      this.broadcastUpdate(updateType, data, options);
      
    } catch (error) {
      console.error('❌ Error in broadcast method:', error);
    }
  }

  /**
   * ENHANCED: Get memory usage estimate
   */
  getMemoryUsage() {
    // Estimate memory usage based on stored data
    let estimatedUsage = 0;
    
    // Count cached data
    estimatedUsage += this.messageQueue.length * 1024; // ~1KB per message
    estimatedUsage += this.portConnections.size * 2048; // ~2KB per connection
    
    // Add state size
    try {
      const stateStr = JSON.stringify(this.state);
      estimatedUsage += stateStr.length * 2; // UTF-16 encoding
    } catch (error) {
      // Ignore serialization errors
    }

    return estimatedUsage;
  }

  /**
   * ENHANCED: Track validation failure for telemetry
   * @param {string} error - Validation error message
   * @param {Object} message - Original message that failed validation
   * @param {Object} sender - Chrome sender object
   */
  trackValidationFailure(error, message, sender) {
    try {
      if (this.performanceMetrics) {
        this.performanceMetrics.validationErrors++;
      }

      // Log structured validation failure data
      const failureData = {
        error,
        timestamp: Date.now(),
        messageAction: message?.action || message?.type || 'unknown',
        messageSize: JSON.stringify(message || {}).length,
        senderTabId: sender?.tab?.id || 'no-tab',
        senderUrl: sender?.tab?.url || sender?.url || 'unknown'
      };

      console.warn('📊 [TELEMETRY] Validation failure tracked:', failureData);

      // Store failure for health reporting (keep last 100)
      if (!this.validationFailures) {
        this.validationFailures = [];
      }
      this.validationFailures.push(failureData);
      
      // Keep only last 100 failures to prevent memory growth
      if (this.validationFailures.length > 100) {
        this.validationFailures.shift();
      }

      // Update error count for health checks
      if (this.performanceMetrics) {
        this.performanceMetrics.errorCount++;
      }

    } catch (trackingError) {
      console.error('❌ Failed to track validation failure:', trackingError);
    }
  }

  /**
   * ENHANCED: Create validated error response using proper StepThreeResponse format
   * @param {string} requestId - Request ID for response correlation
   * @param {string} error - Error message
   * @param {Object} metadata - Additional response metadata
   * @returns {Object} Validated StepThreeResponse
   */
  createValidatedErrorResponse(requestId, error, metadata = {}) {
    try {
      // Use the MessageValidator to create proper response format
      if (globalThis.StepThreeMessageSchema?.MessageValidator) {
        return globalThis.StepThreeMessageSchema.MessageValidator.createResponse(
          requestId,
          false,
          null,
          error,
          {
            timestamp: Date.now(),
            source: 'proxy_router',
            validationContext: true,
            ...metadata
          }
        );
      } else {
        // Fallback response format
        return {
          ok: false,
          error,
          requestId,
          timestamp: Date.now(),
          metadata: {
            source: 'proxy_router_fallback',
            validationContext: true,
            ...metadata
          }
        };
      }
    } catch (responseError) {
      console.error('❌ Failed to create validated error response:', responseError);
      // Ultimate fallback
      return {
        ok: false,
        error: `Response creation failed: ${responseError.message}`,
        requestId: requestId || 'unknown',
        timestamp: Date.now()
      };
    }
  }

  /**
   * ENHANCED: Create error response (legacy compatibility)
   * @param {string} requestId - Request ID for response correlation
   * @param {string} error - Error message
   * @returns {Object} Error response
   */
  createErrorResponse(requestId, error) {
    return this.createValidatedErrorResponse(requestId, error, { legacy: true });
  }

  /**
   * Set up message routing through chrome.runtime.onMessage
   * MV3 COMPLIANT: Does NOT register event listeners (done at top level)
   */
  setupMessageRouting() {
    // NOTE: Event listener is registered at top level during script evaluation
    console.log('📨 Message routing established');
  }

  /**
   * Set up port connection handling through chrome.runtime.onConnect
   * MV3 COMPLIANT: Does NOT register event listeners (done at top level)
   */
  setupPortHandling() {
    // NOTE: Event listener is registered at top level during script evaluation
    console.log('🔌 Port handling established');
  }

  /**
   * Handle incoming messages with validation and routing
   * ENHANCED: Added defensive checks and bounded queue
   */
  async handleMessage(message, sender, sendResponse) {
    const startTime = performance.now();
    const requestId = message.requestId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Defensive check: Bounded messageQueue to prevent memory leaks
      if (this.messageQueue.length >= this.maxQueueSize) {
        console.warn(`⚠️ Message queue full (${this.messageQueue.length}), dropping oldest messages`);
        this.messageQueue.splice(0, Math.floor(this.maxQueueSize * 0.1)); // Drop 10% of oldest
      }
      
      // Add message to queue for processing history
      this.messageQueue.push({
        requestId,
        action: message.action || message.type,
        timestamp: Date.now(),
        size: JSON.stringify(message).length
      });
      
      // Keep queue bounded
      if (this.messageQueue.length > this.maxQueueSize) {
        this.messageQueue.shift();
      }
      // Extract action from message (support legacy 'type' field)
      let action = message.action || message.type;
      
      // ENHANCED LOGGING: Track message metadata
      const messageMetadata = {
        requestId,
        action,
        messageSize: JSON.stringify(message).length,
        hasPayload: !!message.payload,
        senderTabId: sender.tab?.id || 'no-tab',
        senderUrl: sender.tab?.url || 'no-url',
        timestamp: new Date().toISOString()
      };
      
      console.log(`📨 [PROXY] Incoming message:`, messageMetadata);
      
      // Add source information if not present
      if (!message.source) {
        if (sender.tab) {
          message.source = globalThis.StepThreeMessageSchema?.MESSAGE_SOURCES?.CONTENT_SCRIPT || 'content_script';
        } else {
          message.source = globalThis.StepThreeMessageSchema?.MESSAGE_SOURCES?.POPUP || 'popup';
        }
      }
      
      // Track message processing performance
      if (this.performanceMetrics) {
        this.performanceMetrics.messageCount++;
      }
      
      // ENHANCED: Validate and normalize message with comprehensive error handling and telemetry
      if (globalThis.StepThreeMessageSchema?.MessageValidator) {
        const validationStartTime = performance.now();
        
        // Use the new validateAndNormalize method for comprehensive handling
        const result = globalThis.StepThreeMessageSchema.MessageValidator.validateAndNormalize(
          message,
          sender,
          false // Use lenient validation for better compatibility
        );
        
        const validationTime = performance.now() - validationStartTime;
        
        if (result.valid) {
          // Update the message with the normalized version
          message = result.message;
          action = message.action; // Update action variable
          
          // Log successful validation with any warnings
          console.log(`✅ [PROXY] Message validated and normalized (${validationTime.toFixed(2)}ms):`, {
            requestId: message.requestId,
            action: message.action,
            source: message.source,
            warnings: result.warnings?.length || 0
          });
          
          // Log warnings if present
          if (result.warnings?.length > 0) {
            console.warn(`⚠️ [PROXY] Message validation warnings:`, {
              requestId: message.requestId,
              warnings: result.warnings
            });
          }
        } else {
          // Track validation failures for telemetry
          this.trackValidationFailure(result.error, message, sender);
          
          console.error(`❌ [PROXY] Message validation failed (${validationTime.toFixed(2)}ms):`, {
            error: result.error,
            requestId: result.message?.requestId || 'unknown',
            originalAction: message?.action || message?.type || 'unknown',
            messageKeys: Object.keys(message),
            warnings: result.warnings
          });
          
          // Use the normalized message's requestId for better error reporting
          const fallbackRequestId = result.message?.requestId || requestId;
          sendResponse(this.createValidatedErrorResponse(fallbackRequestId, `Message validation failed: ${result.error}`));
          return;
        }
      } else {
        // ENHANCED: Improved fallback validation when schema is unavailable
        console.warn(`⚠️ [PROXY] MessageValidator not available, using enhanced fallback:`, {
          requestId,
          action,
          hasAction: !!action,
          schemaAvailable: false
        });
        
        // Apply basic normalization manually
        if (!action) {
          console.error(`❌ [PROXY] No action specified in fallback validation:`, {
            requestId,
            messageKeys: Object.keys(message),
            possibleActions: ['action', 'type']
          });
          this.trackValidationFailure('No action specified', message, sender);
          sendResponse(this.createValidatedErrorResponse(requestId, 'Message must specify an action'));
          return;
        }
        
        // Basic normalization for fallback
        if (!message.source) {
          message.source = sender?.tab ? 'content_script' : 'popup';
        }
        
        if (!message.requestId) {
          message.requestId = requestId;
        }
      }

      // Route message to appropriate handler
      const handler = this.messageHandlers.get(action);
      if (handler) {
        const handlerStartTime = performance.now();
        console.log(`🚀 [PROXY] Routing to handler:`, {
          requestId,
          action,
          handlerExists: true,
          availableHandlers: Array.from(this.messageHandlers.keys())
        });
        
        try {
          await handler(message, sender, sendResponse, requestId);
          const handlerTime = performance.now() - handlerStartTime;
          console.log(`✅ [PROXY] Handler completed (${handlerTime.toFixed(2)}ms):`, {
            requestId,
            action,
            success: true
          });
        } catch (handlerError) {
          const handlerTime = performance.now() - handlerStartTime;
          console.error(`❌ [PROXY] Handler failed (${handlerTime.toFixed(2)}ms):`, {
            requestId,
            action,
            error: handlerError.message,
            stack: handlerError.stack
          });
          throw handlerError;
        }
      } else {
        // BUGFIX: Try legacy handler fallback before failing
        if (this.legacyHandler && typeof this.legacyHandler.handleMessage === 'function') {
          console.log(`🔄 [PROXY] Falling back to legacy handler:`, {
            requestId,
            action,
            legacyHandlerAvailable: true
          });
          
          try {
            await this.legacyHandler.handleMessage(message, sender, sendResponse);
            console.log(`✅ [PROXY] Legacy handler completed:`, {
              requestId,
              action,
              success: true
            });
            return;
          } catch (legacyError) {
            console.error(`❌ [PROXY] Legacy handler failed:`, {
              requestId,
              action,
              error: legacyError.message
            });
            // Fall through to error response
          }
        }
        
        console.error(`❌ [PROXY] No handler found:`, {
          requestId,
          action,
          availableHandlers: Array.from(this.messageHandlers.keys()),
          legacyHandlerAvailable: !!(this.legacyHandler && this.legacyHandler.handleMessage),
          messageType: typeof message,
          messageKeys: Object.keys(message)
        });
        sendResponse(this.createErrorResponse(requestId, `No handler for action: ${action}`));
      }
      
    } catch (error) {
      const totalTime = performance.now() - startTime;
      if (this.performanceMetrics) {
        this.performanceMetrics.errorCount++;
      }
      
      console.error(`💥 [PROXY] Message handling error (${totalTime.toFixed(2)}ms):`, {
        requestId,
        action: message?.action || message?.type,
        error: error.message,
        stack: error.stack,
        messageSize: JSON.stringify(message || {}).length,
        senderInfo: {
          tabId: sender.tab?.id,
          url: sender.tab?.url,
          origin: sender.origin
        }
      });
      
      sendResponse(this.createErrorResponse(requestId, error.message));
    } finally {
      const totalTime = performance.now() - startTime;
      console.log(`⏱️ [PROXY] Message processing completed:`, {
        requestId,
        totalTime: `${totalTime.toFixed(2)}ms`,
        action: message?.action || message?.type
      });
    }
  }

  /**
   * Handle port connections with name-based routing
   */
  handlePortConnection(port) {
    const connectionStartTime = performance.now();
    
    // Phase 2: Track connection metrics
    connectionMetrics.totalConnections++;
    connectionMetrics.activePorts++;
    
    try {
      const connectionInfo = {
        port,
        portId: `${port.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        connected: true,
        lastActivity: Date.now(),
        subscriptions: new Set(),
        connectTime: Date.now()
      };
      
      console.log(`🔌 [PORT] Connection established:`, {
        portName: port.name,
        portId: connectionInfo.portId,
        timestamp: new Date().toISOString(),
        sender: port.sender,
        existingConnections: this.portConnections.get(port.name)?.size || 0
      });
      
      // Store port connection in set
      if (!this.portConnections.has(port.name)) {
        this.portConnections.set(port.name, new Set());
      }
      this.portConnections.get(port.name).add(connectionInfo);
      
      const totalConnections = Array.from(this.portConnections.values())
        .reduce((sum, connections) => sum + connections.size, 0);
      
      console.log(`📊 [PORT] Connection stats:`, {
        portName: port.name,
        connectionsForThisPort: this.portConnections.get(port.name).size,
        totalConnections,
        allPortNames: Array.from(this.portConnections.keys())
      });
      
      // Set up port message handling with logging
      port.onMessage.addListener((message) => {
        console.log(`📨 [PORT] Message received:`, {
          portName: port.name,
          portId: connectionInfo.portId,
          action: message.action || message.type,
          messageSize: JSON.stringify(message).length,
          timestamp: new Date().toISOString()
        });
        this.handlePortMessage(port, message);
      });
      
      // Handle port disconnection with enhanced logging
      port.onDisconnect.addListener(() => {
        const disconnectTime = Date.now();
        const connectionDuration = disconnectTime - connectionInfo.connectTime;
        
        console.log(`🔌❌ [PORT] Disconnection detected:`, {
          portName: port.name,
          portId: connectionInfo.portId,
          connectionDuration: `${connectionDuration}ms`,
          reason: chrome.runtime.lastError?.message || 'unknown',
          timestamp: new Date().toISOString()
        });
        
        this.handlePortDisconnection(port);
      });
      
      // Send connection confirmation
      const confirmationMessage = {
        action: globalThis.StepThreeMessageSchema?.MESSAGE_ACTIONS?.PORT_CONNECT || 'PORT_CONNECT',
        data: { 
          status: 'connected', 
          timestamp: Date.now(),
          portId: connectionInfo.portId
        }
      };
      
      try {
        this.sendToPort(port.name, confirmationMessage);
        console.log(`✅ [PORT] Confirmation sent:`, {
          portName: port.name,
          portId: connectionInfo.portId
        });
      } catch (confirmError) {
        console.error(`❌ [PORT] Failed to send confirmation:`, {
          portName: port.name,
          portId: connectionInfo.portId,
          error: confirmError.message
        });
      }
      
      // Start keepalive for this port
      this.startPortKeepalive(port.name);
      
      const setupTime = performance.now() - connectionStartTime;
      console.log(`⚡ [PORT] Setup completed (${setupTime.toFixed(2)}ms):`, {
        portName: port.name,
        portId: connectionInfo.portId
      });
      
    } catch (error) {
      const setupTime = performance.now() - connectionStartTime;
      console.error(`💥 [PORT] Connection setup failed (${setupTime.toFixed(2)}ms):`, {
        portName: port.name,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // Try to send error notification if port is still available
      try {
        port.postMessage({
          action: 'PORT_ERROR',
          error: error.message,
          timestamp: Date.now()
        });
      } catch (notifyError) {
        console.warn(`⚠️ [PORT] Could not notify client of connection error:`, notifyError.message);
      }
    }
  }

  /**
   * Handle messages received through port connections
   */
  async handlePortMessage(port, message) {
    try {
      // Update last activity for this specific port
      const connections = this.portConnections.get(port.name);
      if (connections) {
        for (const connection of connections) {
          if (connection.port === port) {
            connection.lastActivity = Date.now();
            break;
          }
        }
      }
      
      // Handle port-specific messages
      const action = message.action || message.type;
      
      if (action === (globalThis.StepThreeMessageSchema?.MESSAGE_ACTIONS?.UI_SUBSCRIBE || 'UI_SUBSCRIBE')) {
        this.handleSubscription(port.name, message.payload);
      } else if (action === (globalThis.StepThreeMessageSchema?.MESSAGE_ACTIONS?.UI_UNSUBSCRIBE || 'UI_UNSUBSCRIBE')) {
        this.handleUnsubscription(port.name, message.payload);
      } else if (action === (globalThis.StepThreeMessageSchema?.MESSAGE_ACTIONS?.PORT_KEEPALIVE || 'PORT_KEEPALIVE')) {
        // Respond to keepalive ping
        this.sendToPort(port.name, {
          action: action,
          data: { timestamp: Date.now(), status: 'alive' }
        });
      } else {
        // Route to regular message handler
        const requestId = message.requestId || `port_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await this.handleMessage(message, { port }, (response) => {
          this.sendToPort(port.name, response);
        });
      }
      
    } catch (error) {
      console.error('❌ Port message handling error:', error);
    }
  }

  /**
   * Handle port disconnection cleanup
   */
  handlePortDisconnection(port) {
    // Phase 2: Track disconnection metrics
    connectionMetrics.disconnections++;
    if (connectionMetrics.activePorts > 0) {
      connectionMetrics.activePorts--;
    }
    
    try {
      console.log(`🔌 Port disconnected: ${port.name}`);
      
      // Remove specific port connection from set
      const connections = this.portConnections.get(port.name);
      if (connections) {
        for (const connection of connections) {
          if (connection.port === port) {
            connections.delete(connection);
            // If no more connections for this port name, clean up the set
            if (connections.size === 0) {
              this.portConnections.delete(port.name);
              this.subscriptions.delete(port.name);
            }
            break;
          }
        }
      }
      
      // Clear keepalive timer
      if (this.portKeepaliveTimers.has(port.name)) {
        clearInterval(this.portKeepaliveTimers.get(port.name));
        this.portKeepaliveTimers.delete(port.name);
      }
      
    } catch (error) {
      console.error('❌ Port disconnection error:', error);
    }
  }

  /**
   * Register a message handler for a specific action
   * @param {string} action - The action name to handle
   * @param {Function} handler - The handler function
   */
  registerMessageHandler(action, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.messageHandlers.set(action, handler);
    console.log(`✅ Registered handler for action: ${action}`);
  }

  /**
   * Register default message handlers
   */
  registerDefaultHandlers(existingMessageHandler = null) {
    const schema = globalThis.StepThreeMessageSchema;
    
    // Health ping handler
    this.registerHandler(
      schema?.MESSAGE_ACTIONS?.HEALTH_PING || 'HEALTH_PING',
      this.handleHealthPing.bind(this)
    );
    
    // Phase 2: Comprehensive health check handler for dashboard
    this.registerHandler(
      'HEALTH_CHECK',
      this.handleHealthCheckRequest.bind(this)
    );
    
    // Permission handlers
    this.registerHandler(
      schema?.MESSAGE_ACTIONS?.PERMISSION_CHECK || 'PERMISSION_CHECK',
      this.handlePermissionCheck.bind(this)
    );
    
    this.registerHandler(
      schema?.MESSAGE_ACTIONS?.PERMISSION_PROMPT || 'PERMISSION_PROMPT',
      this.handlePermissionPrompt.bind(this)
    );
    
    // Status handlers
    this.registerHandler(
      schema?.MESSAGE_ACTIONS?.SCAN_STATUS || 'SCAN_STATUS',
      this.handleStatusRequest.bind(this)
    );
    
    this.registerHandler(
      schema?.MESSAGE_ACTIONS?.DOWNLOAD_STATUS || 'DOWNLOAD_STATUS',
      this.handleStatusRequest.bind(this)
    );
    
    // BUGFIX: Properly configure legacy handler fallback
    if (existingMessageHandler) {
      if (typeof existingMessageHandler.handleMessage === 'function') {
        this.legacyHandler = existingMessageHandler;
        console.log(`🔗 [PROXY] Legacy handler configured:`, {
          handlerType: typeof existingMessageHandler.handleMessage,
          fallbackAvailable: true
        });
      } else if (typeof existingMessageHandler === 'function') {
        // Wrap function handler to match expected interface
        this.legacyHandler = {
          handleMessage: existingMessageHandler
        };
        console.log(`🔗 [PROXY] Legacy function handler wrapped:`, {
          fallbackAvailable: true
        });
      } else {
        console.warn(`⚠️ [PROXY] Invalid legacy handler provided:`, {
          handlerType: typeof existingMessageHandler,
          hasHandleMessage: !!(existingMessageHandler && existingMessageHandler.handleMessage)
        });
      }
    } else {
      console.log(`ℹ️ [PROXY] No legacy handler provided`);
    }
    
    console.log('📋 Default message handlers registered');
  }

  /**
   * Register a message handler for a specific action
   */
  registerHandler(action, handler) {
    this.messageHandlers.set(action, handler);
    console.log(`📝 Handler registered for action: ${action}`);
  }

  /**
   * Handle health ping requests
   */
  async handleHealthPing(message, sender, sendResponse, requestId) {
    // Count total active connections across all port names
    let totalConnections = 0;
    for (const connections of this.portConnections.values()) {
      totalConnections += connections.size;
    }
    
    const healthData = {
      status: this.state.health.status,
      timestamp: Date.now(),
      uptime: Date.now() - serviceWorkerStartTime,
      connections: totalConnections,
      portNames: this.portConnections.size,
      subscriptions: this.subscriptions.size,
      messageHandlers: this.messageHandlers.size,
      queueSize: this.messageQueue.length
    };
    
    this.updateHealthStatus('running');
    sendResponse(this.createSuccessResponse(requestId, healthData));
  }

  /**
   * Phase 2: Handle comprehensive health check requests from dashboard
   * Returns detailed health status including restart count, keepalive metrics, etc.
   */
  async handleHealthCheckRequest(message, sender, sendResponse, requestId) {
    try {
      const healthStatus = await getHealthStatus();
      sendResponse(this.createSuccessResponse(requestId, healthStatus));
    } catch (error) {
      console.error('❌ Failed to get health status:', error);
      sendResponse(this.createErrorResponse(requestId, 'Failed to retrieve health status'));
    }
  }

  /**
   * Handle permission check requests
   */
  async handlePermissionCheck(message, sender, sendResponse, requestId) {
    try {
      const { permissions } = message.payload || {};
      const results = {};
      
      if (permissions && Array.isArray(permissions)) {
        for (const permission of permissions) {
          try {
            const hasPermission = await chrome.permissions.contains({ permissions: [permission] });
            results[permission] = hasPermission;
          } catch (error) {
            results[permission] = false;
          }
        }
      }
      
      sendResponse(this.createSuccessResponse(requestId, results));
      
    } catch (error) {
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle permission prompt requests (route to UI for user gesture)
   */
  async handlePermissionPrompt(message, sender, sendResponse, requestId) {
    try {
      const { permission, reason } = message.payload || {};
      
      // Store permission request for tracking
      this.state.permissions.set(requestId, {
        permission,
        reason,
        status: 'pending',
        timestamp: Date.now()
      });
      
      // Route to UI for user gesture (MV3 compliant)
      this.broadcastUpdate(
        globalThis.StepThreeMessageSchema?.UPDATE_TYPES?.PERMISSION_STATUS || 'permission_status',
        {
          requestId,
          permission,
          reason,
          requiresUserGesture: true
        }
      );
      
      sendResponse(this.createSuccessResponse(requestId, { 
        status: 'pending', 
        message: 'Permission request routed to UI' 
      }));
      
    } catch (error) {
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle status requests for various systems
   */
  async handleStatusRequest(message, sender, sendResponse, requestId) {
    try {
      const action = message.action || message.type;
      let statusData = {};
      
      if (action.includes('SCAN')) {
        statusData = {
          scanning: false, // TODO: Connect to actual scan state
          progress: this.state.progress.get('scan') || 0
        };
      } else if (action.includes('DOWNLOAD')) {
        statusData = {
          active: false, // TODO: Connect to actual download state
          progress: this.state.progress.get('download') || 0,
          queue: this.state.jobs.get('download_queue') || []
        };
      }
      
      sendResponse(this.createSuccessResponse(requestId, statusData));
      
    } catch (error) {
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle subscription requests from UI components
   */
  handleSubscription(portName, subscriptionData) {
    try {
      const { channels } = subscriptionData || {};
      
      if (!this.subscriptions.has(portName)) {
        this.subscriptions.set(portName, new Set());
      }
      
      const portSubscriptions = this.subscriptions.get(portName);
      
      if (channels && Array.isArray(channels)) {
        channels.forEach(channel => portSubscriptions.add(channel));
        console.log(`📡 Port ${portName} subscribed to channels: ${channels.join(', ')}`);
      } else {
        // Subscribe to all updates
        portSubscriptions.add('*');
        console.log(`📡 Port ${portName} subscribed to all updates`);
      }
      
      // Update port connection info for all connections with this name
      const connections = this.portConnections.get(portName);
      if (connections) {
        for (const connection of connections) {
          connection.subscriptions = new Set([...portSubscriptions]);
        }
      }
      
    } catch (error) {
      console.error('❌ Subscription error:', error);
    }
  }

  /**
   * Handle unsubscription requests from UI components
   */
  handleUnsubscription(portName, subscriptionData) {
    try {
      const { channels } = subscriptionData || {};
      
      if (!this.subscriptions.has(portName)) {
        return;
      }
      
      const portSubscriptions = this.subscriptions.get(portName);
      
      if (channels && Array.isArray(channels)) {
        channels.forEach(channel => portSubscriptions.delete(channel));
        console.log(`📡 Port ${portName} unsubscribed from channels: ${channels.join(', ')}`);
      } else {
        // Unsubscribe from all
        portSubscriptions.clear();
        console.log(`📡 Port ${portName} unsubscribed from all updates`);
      }
      
    } catch (error) {
      console.error('❌ Unsubscription error:', error);
    }
  }

  /**
   * ENHANCED: Broadcast update to subscribed UI components with validation
   */
  broadcastUpdate(updateType, data, options = {}) {
    const broadcastStartTime = performance.now();
    const broadcastId = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    try {
      const schema = globalThis.StepThreeMessageSchema;
      
      // ENHANCED: Create properly formatted broadcast message
      const broadcastMessage = {
        action: schema?.MESSAGE_ACTIONS?.BROADCAST_UPDATE || 'BROADCAST_UPDATE',
        updateType,
        data,
        timestamp: Date.now(),
        priority: options.priority || (schema?.MESSAGE_PRIORITY?.MEDIUM || 2),
        targets: options.targets,
        broadcastId
      };

      // ENHANCED: Validate broadcast before emission
      if (schema?.MessageValidator?.validateBroadcast) {
        const validation = schema.MessageValidator.validateBroadcast(broadcastMessage);
        
        if (!validation.valid) {
          // Track broadcast validation failures
          if (this.performanceMetrics) {
            this.performanceMetrics.broadcastValidationErrors++;
          }
          
          console.error(`❌ [BROADCAST] Validation failed (${broadcastId}):`, {
            error: validation.error,
            updateType,
            dataKeys: data ? Object.keys(data) : null,
            broadcastId
          });
          
          // Don't emit invalid broadcasts
          return;
        }
        
        console.log(`✅ [BROADCAST] Validation passed (${broadcastId}):`, {
          updateType,
          dataSize: JSON.stringify(data || {}).length,
          broadcastId
        });
      }

      const channel = schema?.MessageSchemaUtils?.getUpdateChannel(updateType) || 'general';
      const priority = broadcastMessage.priority;
      
      console.log(`📡 [BROADCAST] Starting:`, {
        broadcastId,
        updateType,
        channel,
        priority,
        dataSize: JSON.stringify(data).length,
        subscriberCount: this.subscriptions.size,
        timestamp: new Date().toISOString()
      });
      
      // Apply throttling to prevent overwhelming UI
      const throttleKey = `${channel}_${updateType}`;
      const now = Date.now();
      const lastUpdate = this.updateThrottle.get(throttleKey) || 0;
      const timeSinceLastUpdate = now - lastUpdate;
      
      if (timeSinceLastUpdate < this.maxUpdateRate) {
        console.warn(`🕰️ [BROADCAST] Throttled (${timeSinceLastUpdate}ms since last):`, {
          broadcastId,
          updateType,
          channel,
          throttleKey,
          maxUpdateRate: this.maxUpdateRate
        });
        return;
      }
      
      this.updateThrottle.set(throttleKey, now);
      
      // Create broadcast message
      const broadcast = {
        action: schema?.MESSAGE_ACTIONS?.BROADCAST_UPDATE || 'BROADCAST_UPDATE',
        updateType,
        data,
        timestamp: now,
        priority,
        channel,
        broadcastId,
        ...options
      };
      
      // Send to subscribed ports with detailed tracking
      let sentCount = 0;
      let failedCount = 0;
      const deliveryResults = [];
      
      for (const [portName, subscriptions] of this.subscriptions.entries()) {
        const deliveryStartTime = performance.now();
        let delivered = false;
        let reason = 'not_subscribed';
        
        if (subscriptions.has('*') || subscriptions.has(channel) || subscriptions.has(updateType)) {
          const connections = this.portConnections.get(portName);
          if (connections && connections.size > 0) {
            // Check if any connection is subscribed to this update
            let hasSubscription = false;
            for (const connection of connections) {
              if (connection.subscriptions.has('*') || connection.subscriptions.has(channel) || connection.subscriptions.has(updateType)) {
                hasSubscription = true;
                break;
              }
            }
            if (hasSubscription) {
              delivered = this.sendToPort(portName, broadcast);
              reason = delivered ? 'delivered' : 'send_failed';
              if (delivered) {
                sentCount++;
              } else {
                failedCount++;
              }
            } else {
              reason = 'no_connection_subscription';
            }
          } else {
            reason = 'no_connections';
          }
        }
        
        const deliveryTime = performance.now() - deliveryStartTime;
        deliveryResults.push({
          portName,
          delivered,
          reason,
          deliveryTime: `${deliveryTime.toFixed(2)}ms`,
          subscriptions: Array.from(subscriptions),
          connectionCount: this.portConnections.get(portName)?.size || 0
        });
      }
      
      console.log(`📦 [BROADCAST] Delivery results:`, {
        broadcastId,
        updateType,
        sentCount,
        failedCount,
        totalSubscribers: this.subscriptions.size,
        deliveryResults
      });
      
      // Fallback to sendMessage for non-port subscribers
      if (sentCount === 0 && options.fallbackToMessage) {
        console.log(`🔄 [BROADCAST] Using fallback messaging:`, { broadcastId, updateType });
        this.fallbackBroadcast(broadcast);
      }
      
      const totalTime = performance.now() - broadcastStartTime;
      console.log(`✅ [BROADCAST] Completed (${totalTime.toFixed(2)}ms):`, {
        broadcastId,
        updateType,
        channel,
        sentCount,
        failedCount,
        success: sentCount > 0 || options.fallbackToMessage
      });
      
    } catch (error) {
      const totalTime = performance.now() - broadcastStartTime;
      console.error(`💥 [BROADCAST] Error (${totalTime.toFixed(2)}ms):`, {
        broadcastId,
        updateType,
        error: error.message,
        stack: error.stack,
        subscriptionsCount: this.subscriptions.size
      });
    }
  }

  /**
   * Send message to all connections for a specific port name
   */
  sendToPort(portName, message) {
    try {
      const connections = this.portConnections.get(portName);
      if (!connections || connections.size === 0) {
        return false;
      }
      
      let sentCount = 0;
      const deadConnections = new Set();
      
      for (const connection of connections) {
        try {
          if (connection.connected && connection.port) {
            connection.port.postMessage(message);
            connection.lastActivity = Date.now();
            sentCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to send to port ${portName} connection ${connection.portId}:`, error);
          connection.connected = false;
          deadConnections.add(connection);
        }
      }
      
      // Clean up dead connections
      for (const deadConnection of deadConnections) {
        connections.delete(deadConnection);
      }
      
      return sentCount > 0;
    } catch (error) {
      console.error(`❌ Error sending to port ${portName}:`, error);
      return false;
    }
  }

  /**
   * Fallback broadcast using chrome.runtime.sendMessage
   */
  async fallbackBroadcast(broadcast) {
    try {
      // Send to all tabs (content scripts) - using async/await to avoid context issues
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, broadcast);
        } catch (error) {
          // Ignore errors for tabs without content scripts
        }
      }
    } catch (error) {
      console.error('❌ Fallback broadcast error:', error);
    }
  }

  /**
   * Start port keepalive system
   */
  startPortKeepalive(portName = null) {
    const ports = portName ? [portName] : Array.from(this.portConnections.keys());
    
    ports.forEach(name => {
      if (this.portKeepaliveTimers.has(name)) {
        clearInterval(this.portKeepaliveTimers.get(name));
      }
      
      const timer = setInterval(() => {
        const connections = this.portConnections.get(name);
        if (connections && connections.size > 0) {
          const deadConnections = new Set();
          
          for (const connection of connections) {
            if (connection.connected) {
              const timeSinceActivity = Date.now() - connection.lastActivity;
              if (timeSinceActivity > this.portKeepaliveInterval) {
                // Send keepalive ping to this specific connection
                try {
                  connection.port.postMessage({
                    action: globalThis.StepThreeMessageSchema?.MESSAGE_ACTIONS?.PORT_KEEPALIVE || 'PORT_KEEPALIVE',
                    timestamp: Date.now()
                  });
                  connection.lastActivity = Date.now();
                } catch (error) {
                  console.warn(`Failed to send keepalive to ${name}:`, error);
                  connection.connected = false;
                  deadConnections.add(connection);
                }
              }
            } else {
              deadConnections.add(connection);
            }
          }
          
          // Remove dead connections
          for (const deadConnection of deadConnections) {
            connections.delete(deadConnection);
          }
          
          // If no connections left, clean up
          if (connections.size === 0) {
            this.portConnections.delete(name);
            this.subscriptions.delete(name);
            clearInterval(timer);
            this.portKeepaliveTimers.delete(name);
          }
        } else {
          // No connections, clean up timer
          clearInterval(timer);
          this.portKeepaliveTimers.delete(name);
        }
      }, this.portKeepaliveInterval);
      
      this.portKeepaliveTimers.set(name, timer);
    });
  }

  /**
   * Load state from chrome.storage.session
   */
  async loadState() {
    const loadStartTime = performance.now();
    const loadId = `load_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    try {
      console.log(`📁 [STATE] Loading state:`, {
        loadId,
        stateKey: this.stateKey,
        timestamp: new Date().toISOString()
      });
      
      const result = await chrome.storage.session.get(this.stateKey);
      if (result[this.stateKey]) {
        const savedState = result[this.stateKey];
        const stateAge = Date.now() - (savedState.timestamp || 0);
        const serializedSize = JSON.stringify(savedState).length;
        
        console.log(`📊 [STATE] Found saved state:`, {
          loadId,
          stateAge: `${stateAge}ms ago`,
          stateSize: `${serializedSize} bytes`,
          hasJobs: !!savedState.jobs,
          hasProgress: !!savedState.progress,
          hasPermissions: !!savedState.permissions,
          hasHealth: !!savedState.health,
          lastSaved: savedState.timestamp ? new Date(savedState.timestamp).toISOString() : 'unknown'
        });
        
        // Restore state with validation and logging
        let restoredCount = 0;
        if (savedState.jobs) {
          this.state.jobs = new Map(savedState.jobs);
          restoredCount++;
          console.log(`🔄 [STATE] Jobs restored: ${this.state.jobs.size} entries`);
        }
        if (savedState.progress) {
          this.state.progress = new Map(savedState.progress);
          restoredCount++;
          console.log(`🔄 [STATE] Progress restored: ${this.state.progress.size} entries`);
        }
        if (savedState.permissions) {
          this.state.permissions = new Map(savedState.permissions);
          restoredCount++;
          console.log(`🔄 [STATE] Permissions restored: ${this.state.permissions.size} entries`);
        }
        if (savedState.health) {
          this.state.health = { ...this.state.health, ...savedState.health };
          restoredCount++;
          console.log(`🔄 [STATE] Health status restored:`, this.state.health);
        }
        
        const loadTime = performance.now() - loadStartTime;
        console.log(`✅ [STATE] Load completed (${loadTime.toFixed(2)}ms):`, {
          loadId,
          restoredSections: restoredCount,
          totalEntries: this.state.jobs.size + this.state.progress.size + this.state.permissions.size
        });
        
      } else {
        const loadTime = performance.now() - loadStartTime;
        console.log(`🆕 [STATE] No saved state found (${loadTime.toFixed(2)}ms):`, {
          loadId,
          usingDefaults: true
        });
      }
    } catch (error) {
      const loadTime = performance.now() - loadStartTime;
      console.error(`💥 [STATE] Load failed (${loadTime.toFixed(2)}ms):`, {
        loadId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Save state to chrome.storage.session
   */
  async saveState() {
    const saveStartTime = performance.now();
    const saveId = `save_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    try {
      const now = Date.now();
      const timeSinceLastSave = now - this.lastStateSave;
      
      if (timeSinceLastSave < this.stateSaveInterval) {
        console.log(`🕰️ [STATE] Save skipped (${timeSinceLastSave}ms since last):`, {
          saveId,
          stateSaveInterval: this.stateSaveInterval,
          lastSave: new Date(this.lastStateSave).toISOString()
        });
        return;
      }
      
      const stateToSave = {
        jobs: Array.from(this.state.jobs.entries()),
        progress: Array.from(this.state.progress.entries()),
        permissions: Array.from(this.state.permissions.entries()),
        health: this.state.health,
        timestamp: now
      };
      
      const serializedState = JSON.stringify(stateToSave);
      const stateSize = serializedState.length;
      
      console.log(`💾 [STATE] Saving state:`, {
        saveId,
        stateSize: `${stateSize} bytes`,
        jobsCount: this.state.jobs.size,
        progressCount: this.state.progress.size,
        permissionsCount: this.state.permissions.size,
        healthStatus: this.state.health.status,
        timeSinceLastSave: `${timeSinceLastSave}ms`
      });
      
      await chrome.storage.session.set({
        [this.stateKey]: stateToSave
      });
      
      this.lastStateSave = now;
      const saveTime = performance.now() - saveStartTime;
      
      console.log(`✅ [STATE] Save completed (${saveTime.toFixed(2)}ms):`, {
        saveId,
        stateSize: `${stateSize} bytes`,
        success: true
      });
      
    } catch (error) {
      const saveTime = performance.now() - saveStartTime;
      console.error(`💥 [STATE] Save failed (${saveTime.toFixed(2)}ms):`, {
        saveId,
        error: error.message,
        stack: error.stack,
        quotaExceeded: error.name === 'QuotaExceededError'
      });
    }
  }

  /**
   * Start periodic state saving
   */
  startPeriodicStateSave() {
    setInterval(() => {
      this.saveState();
    }, this.stateSaveInterval);
  }

  /**
   * Update health status
   */
  updateHealthStatus(status, details = null) {
    this.state.health = {
      status,
      lastCheck: Date.now(),
      details
    };
    
    // Broadcast health update
    this.broadcastUpdate(
      globalThis.StepThreeMessageSchema?.UPDATE_TYPES?.HEALTH_STATUS || 'health_status',
      this.state.health
    );
  }

  /**
   * Create success response
   */
  createSuccessResponse(requestId, data = null, metadata = {}) {
    if (globalThis.StepThreeMessageSchema?.MessageValidator) {
      return globalThis.StepThreeMessageSchema.MessageValidator.createResponse(
        requestId, true, data, null, metadata
      );
    }
    
    return {
      ok: true,
      requestId,
      data,
      timestamp: Date.now(),
      ...metadata
    };
  }


  /**
   * Get current router status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      connections: this.portConnections.size,
      subscriptions: this.subscriptions.size,
      handlers: this.messageHandlers.size,
      queueSize: this.messageQueue.length,
      health: this.state.health,
      retryManager: this.retryManager ? {
        isInitialized: this.retryManager.isInitialized,
        queueSize: this.retryManager.retryQueue?.size || 0,
        activeRetries: this.retryManager.activeRetries?.size || 0,
        circuitBreakers: this.retryManager.circuitBreakers?.size || 0
      } : null
    };
  }

  // ============================================================================
  // PHASE 1B: RETRY MANAGER INTEGRATION METHODS
  // ============================================================================

  /**
   * Initialize ErrorHandlingSystem for RetryManager integration
   */
  async initializeErrorHandling() {
    try {
      // Check if ErrorHandlingSystem is available
      if (typeof globalThis.ErrorHandlingSystem !== 'undefined') {
        this.errorHandler = new globalThis.ErrorHandlingSystem({
          enableConsoleLogging: true,
          enableUserNotifications: false, // Handled by ProxyRouter
          enableErrorReporting: true,
          enableRecoveryMechanisms: true
        });
        
        console.log('✅ ErrorHandlingSystem initialized for RetryManager');
      } else {
        console.warn('⚠️ ErrorHandlingSystem not available, retry error classification will be limited');
      }
    } catch (error) {
      console.error('❌ Failed to initialize ErrorHandlingSystem:', error);
    }
  }

  /**
   * Initialize RetryManager with ErrorHandlingSystem integration
   */
  async initializeRetryManager() {
    try {
      // Check if RetryManager is available
      if (typeof globalThis.RetryManager !== 'undefined') {
        this.retryManager = new globalThis.RetryManager({
          stateKey: 'stepthree_retry_manager_state',
          enableBroadcasting: true,
          enableStateLogging: true,
          alarmNamePrefix: 'stepthree_retry_'
        });

        // Set up RetryManager callbacks
        this.retryManager.setCallbacks({
          onRetryAttempt: (retryTask) => {
            this.broadcastRetryUpdate('retry_attempt', {
              taskId: retryTask.taskId,
              attemptCount: retryTask.attemptCount,
              maxAttempts: retryTask.maxAttempts,
              errorCategory: retryTask.errorCategory,
              nextRetryAt: retryTask.nextRetryAt
            });
          },
          onRetrySuccess: (retryTask, result) => {
            this.broadcastRetryUpdate('retry_success', {
              taskId: retryTask.taskId,
              attemptCount: retryTask.attemptCount,
              totalTime: Date.now() - retryTask.startTime,
              errorCategory: retryTask.errorCategory
            });
          },
          onRetryFailure: (retryTask, reason) => {
            this.broadcastRetryUpdate('retry_failure', {
              taskId: retryTask.taskId,
              attemptCount: retryTask.attemptCount,
              reason,
              errorCategory: retryTask.errorCategory,
              totalTime: Date.now() - retryTask.startTime
            });
          },
          onCircuitBreakerTriggered: (errorCategory, circuitBreaker) => {
            this.broadcastRetryUpdate('circuit_breaker_opened', {
              errorCategory,
              failureCount: circuitBreaker.failureCount,
              cooldownMs: this.retryManager.options.circuitBreakerCooldown
            });
          },
          onCircuitBreakerReset: (errorCategory, circuitBreaker) => {
            this.broadcastRetryUpdate('circuit_breaker_reset', {
              errorCategory,
              successCount: circuitBreaker.successCount
            });
          },
          onStateChange: (updateType, data) => {
            // Update internal retry state tracking
            this.state.retries.set(updateType, {
              ...data,
              timestamp: Date.now()
            });
          }
        });

        // Initialize RetryManager
        await this.retryManager.initialize(this.errorHandler, this);

        // Initialize ChromeSafe with RetryManager
        if (typeof globalThis.ChromeSafe !== 'undefined') {
          globalThis.ChromeSafe.initialize(this.retryManager);
          console.log('✅ ChromeSafe initialized with RetryManager');
        }

        console.log('✅ RetryManager initialized and integrated with ProxyRouter');
      } else {
        console.warn('⚠️ RetryManager not available, retry functionality will be disabled');
      }
    } catch (error) {
      console.error('❌ Failed to initialize RetryManager:', error);
      throw error;
    }
  }

  /**
   * Register retry-specific message handlers
   */
  registerRetryHandlers() {
    try {
      // Retry task management
      this.messageHandlers.set('RETRY_TASK', this.handleRetryTask.bind(this));
      this.messageHandlers.set('CANCEL_RETRY', this.handleCancelRetry.bind(this));
      this.messageHandlers.set('PAUSE_RETRY_CATEGORY', this.handlePauseRetryCategory.bind(this));
      this.messageHandlers.set('RESUME_RETRY_CATEGORY', this.handleResumeRetryCategory.bind(this));
      this.messageHandlers.set('PAUSE_ALL_RETRIES', this.handlePauseAllRetries.bind(this));
      this.messageHandlers.set('RESUME_ALL_RETRIES', this.handleResumeAllRetries.bind(this));

      // Retry status and information
      this.messageHandlers.set('GET_RETRY_STATS', this.handleGetRetryStats.bind(this));
      this.messageHandlers.set('GET_RETRY_QUEUE', this.handleGetRetryQueue.bind(this));
      this.messageHandlers.set('GET_CIRCUIT_BREAKER_STATUS', this.handleGetCircuitBreakerStatus.bind(this));

      // Enhanced download with retry
      this.messageHandlers.set('DOWNLOAD_WITH_RETRY', this.handleDownloadWithRetry.bind(this));

      console.log('✅ Retry message handlers registered');
    } catch (error) {
      console.error('❌ Failed to register retry handlers:', error);
    }
  }

  /**
   * Initialize Demo Mode functionality
   */
  async initializeDemoMode() {
    try {
      console.log('🎭 Initializing Demo Mode...');
      
      // Check if sample data system is available
      if (typeof DemoModeManager !== 'undefined') {
        this.demoModeManager = new DemoModeManager();
        await this.demoModeManager.initializeDemoMode();
        
        // Update demo state
        this.state.demo.isActive = false; // Demo mode starts inactive
        this.state.demo.sessionStartTime = Date.now();
        
        console.log('✅ Demo Mode initialized successfully');
      } else {
        console.warn('⚠️ DemoModeManager not available, demo functionality will be disabled');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Demo Mode:', error);
      throw error;
    }
  }

  /**
   * Register demo mode message handlers
   */
  registerDemoModeHandlers() {
    try {
      console.log('🎭 Registering Demo Mode handlers...');
      
      // Demo mode control
      this.messageHandlers.set('DEMO_MODE_ENABLE', this.handleDemoModeEnable.bind(this));
      this.messageHandlers.set('DEMO_MODE_DISABLE', this.handleDemoModeDisable.bind(this));
      this.messageHandlers.set('DEMO_MODE_STATUS', this.handleDemoModeStatus.bind(this));
      this.messageHandlers.set('DEMO_MODE_RESET', this.handleDemoModeReset.bind(this));
      
      // Sample data management
      this.messageHandlers.set('LOAD_SAMPLE_DATA', this.handleLoadSampleData.bind(this));
      this.messageHandlers.set('LOAD_ALL_SAMPLE_DATA', this.handleLoadAllSampleData.bind(this));
      this.messageHandlers.set('GET_SAMPLE_GALLERY_TYPES', this.handleGetSampleGalleryTypes.bind(this));
      this.messageHandlers.set('GET_CURRENT_SAMPLE_DATA', this.handleGetCurrentSampleData.bind(this));
      
      // Demo mode simulation
      this.messageHandlers.set('SIMULATE_SCRAPING_PROGRESS', this.handleSimulateScrapingProgress.bind(this));
      this.messageHandlers.set('EXPORT_SAMPLE_DATA', this.handleExportSampleData.bind(this));
      this.messageHandlers.set('GET_DEMO_STATS', this.handleGetDemoStats.bind(this));
      
      console.log('✅ Demo Mode handlers registered');
    } catch (error) {
      console.error('❌ Failed to register demo mode handlers:', error);
    }
  }

  /**
   * Handle retry task creation
   */
  async handleRetryTask(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const { taskId, operation, retryOptions } = message.payload;
      
      if (!taskId || !operation) {
        throw new Error('taskId and operation are required');
      }

      // Create operation function (this would typically be handled differently in real implementation)
      const operationFunction = async () => {
        // This is a placeholder - in real implementation, operations would be predefined
        // or passed as serializable configurations
        throw new Error('Operation functions must be predefined for security');
      };

      const success = await this.retryManager.retryTask(taskId, operationFunction, retryOptions);

      sendResponse(this.createSuccessResponse(requestId, { 
        taskId, 
        queued: success 
      }));

    } catch (error) {
      console.error('❌ Error handling retry task:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle retry task cancellation
   */
  async handleCancelRetry(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const { taskId } = message.payload;
      const success = await this.retryManager.cancelTask(taskId);

      sendResponse(this.createSuccessResponse(requestId, { 
        taskId, 
        cancelled: success 
      }));

    } catch (error) {
      console.error('❌ Error cancelling retry:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle pausing retry category
   */
  async handlePauseRetryCategory(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const { errorCategory } = message.payload;
      const success = this.retryManager.pauseCategory(errorCategory);

      sendResponse(this.createSuccessResponse(requestId, { 
        errorCategory, 
        paused: success 
      }));

    } catch (error) {
      console.error('❌ Error pausing retry category:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle resuming retry category
   */
  async handleResumeRetryCategory(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const { errorCategory } = message.payload;
      const success = this.retryManager.resumeCategory(errorCategory);

      sendResponse(this.createSuccessResponse(requestId, { 
        errorCategory, 
        resumed: success 
      }));

    } catch (error) {
      console.error('❌ Error resuming retry category:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle pausing all retries
   */
  async handlePauseAllRetries(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const success = this.retryManager.pauseAll();

      sendResponse(this.createSuccessResponse(requestId, { 
        allPaused: success 
      }));

    } catch (error) {
      console.error('❌ Error pausing all retries:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle resuming all retries
   */
  async handleResumeAllRetries(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const success = this.retryManager.resumeAll();

      sendResponse(this.createSuccessResponse(requestId, { 
        allResumed: success 
      }));

    } catch (error) {
      console.error('❌ Error resuming all retries:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle getting retry statistics
   */
  async handleGetRetryStats(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const stats = this.retryManager.getStats();

      sendResponse(this.createSuccessResponse(requestId, stats));

    } catch (error) {
      console.error('❌ Error getting retry stats:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle getting retry queue status
   */
  async handleGetRetryQueue(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const queueStatus = this.retryManager.getQueueStatus();

      sendResponse(this.createSuccessResponse(requestId, queueStatus));

    } catch (error) {
      console.error('❌ Error getting retry queue:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle getting circuit breaker status
   */
  async handleGetCircuitBreakerStatus(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const circuitBreakerStats = this.retryManager.getCircuitBreakerStats();

      sendResponse(this.createSuccessResponse(requestId, circuitBreakerStats));

    } catch (error) {
      console.error('❌ Error getting circuit breaker status:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle download with retry integration
   */
  async handleDownloadWithRetry(message, sender, sendResponse, requestId) {
    try {
      if (!this.retryManager) {
        throw new Error('RetryManager not available');
      }

      const { downloadOptions, retryOptions } = message.payload;
      
      if (!downloadOptions || !downloadOptions.url) {
        throw new Error('Download options with URL are required');
      }

      // Use ChromeSafe download with retry
      if (typeof globalThis.ChromeSafe !== 'undefined' && globalThis.ChromeSafe.downloadWithRetry) {
        const downloadId = await globalThis.ChromeSafe.downloadWithRetry(downloadOptions, retryOptions);
        
        sendResponse(this.createSuccessResponse(requestId, { 
          downloadId,
          taskId: retryOptions?.taskId 
        }));
      } else {
        throw new Error('ChromeSafe downloadWithRetry not available');
      }

    } catch (error) {
      console.error('❌ Error handling download with retry:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * DEMO MODE HANDLERS - Enable demo functionality through DemoModeManager
   */

  /**
   * Handle demo mode enable
   */
  async handleDemoModeEnable(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const { galleryType } = message.payload || {};
      await this.demoModeManager.initializeDemoMode();
      
      // Load default gallery type if specified
      if (galleryType) {
        await this.demoModeManager.loadSampleData(galleryType);
      }

      this.state.demo = {
        isActive: true,
        currentGalleryType: galleryType || null,
        sessionStartTime: Date.now(),
        stats: this.demoModeManager.getDemoStatus()
      };

      sendResponse(this.createSuccessResponse(requestId, {
        enabled: true,
        galleryType: galleryType || null,
        status: this.demoModeManager.getDemoStatus()
      }));

    } catch (error) {
      console.error('❌ Error enabling demo mode:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle demo mode disable
   */
  async handleDemoModeDisable(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      this.demoModeManager.exitDemoMode();
      this.state.demo = {
        isActive: false,
        currentGalleryType: null,
        sampleData: null,
        sessionStartTime: null,
        stats: {}
      };

      sendResponse(this.createSuccessResponse(requestId, {
        disabled: true,
        status: this.demoModeManager.getDemoStatus()
      }));

    } catch (error) {
      console.error('❌ Error disabling demo mode:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle demo mode status request
   */
  async handleDemoModeStatus(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const status = this.demoModeManager.getDemoStatus();
      sendResponse(this.createSuccessResponse(requestId, status));

    } catch (error) {
      console.error('❌ Error getting demo mode status:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle demo mode reset
   */
  async handleDemoModeReset(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      this.demoModeManager.resetDemoMode();
      this.state.demo.sessionStartTime = Date.now();

      sendResponse(this.createSuccessResponse(requestId, {
        reset: true,
        status: this.demoModeManager.getDemoStatus()
      }));

    } catch (error) {
      console.error('❌ Error resetting demo mode:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle loading sample data
   */
  async handleLoadSampleData(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const { galleryType } = message.payload || {};
      if (!galleryType) {
        throw new Error('Gallery type is required');
      }

      const sampleData = await this.demoModeManager.loadSampleData(galleryType);
      this.state.demo.currentGalleryType = galleryType;
      this.state.demo.sampleData = sampleData;

      sendResponse(this.createSuccessResponse(requestId, {
        galleryType,
        sampleData,
        imageCount: sampleData.images?.length || 0
      }));

    } catch (error) {
      console.error('❌ Error loading sample data:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle loading all sample data
   */
  async handleLoadAllSampleData(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const allSampleData = await this.demoModeManager.loadAllSampleData();
      this.state.demo.currentGalleryType = 'all';
      this.state.demo.sampleData = allSampleData;

      sendResponse(this.createSuccessResponse(requestId, {
        allSampleData,
        totalImages: allSampleData.metadata?.totalImages || 0
      }));

    } catch (error) {
      console.error('❌ Error loading all sample data:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle getting sample gallery types
   */
  async handleGetSampleGalleryTypes(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const galleryTypes = this.demoModeManager.getAvailableGalleryTypes();
      sendResponse(this.createSuccessResponse(requestId, {
        galleryTypes,
        count: Object.keys(galleryTypes).length
      }));

    } catch (error) {
      console.error('❌ Error getting sample gallery types:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle getting current sample data
   */
  async handleGetCurrentSampleData(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const currentData = this.demoModeManager.currentSampleData;
      const loadedType = this.demoModeManager.loadedGalleryType;

      sendResponse(this.createSuccessResponse(requestId, {
        currentSampleData: currentData,
        loadedGalleryType: loadedType,
        hasData: currentData !== null,
        imageCount: currentData?.images?.length || currentData?.metadata?.totalImages || 0
      }));

    } catch (error) {
      console.error('❌ Error getting current sample data:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle simulating scraping progress
   */
  async handleSimulateScrapingProgress(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const { totalImages, callbackPort } = message.payload || {};
      
      // Create progress callback function
      const progressCallback = (progress) => {
        this.broadcastUpdate('demo_progress', progress);
        
        // Send progress to specific port if provided
        if (callbackPort && this.portConnections.has(callbackPort)) {
          for (const connection of this.portConnections.get(callbackPort)) {
            if (connection.connected) {
              try {
                connection.port.postMessage({
                  action: 'DEMO_PROGRESS_UPDATE',
                  data: progress
                });
              } catch (error) {
                console.warn('Failed to send progress update:', error);
              }
            }
          }
        }
      };

      // Start simulation (non-blocking)
      this.demoModeManager.simulateScrapingProgress(progressCallback, totalImages)
        .then(() => {
          this.broadcastUpdate('demo_simulation_complete', { 
            completed: true, 
            totalImages: totalImages || 20 
          });
        })
        .catch((error) => {
          console.error('❌ Demo simulation error:', error);
          this.broadcastUpdate('demo_simulation_error', { 
            error: error.message 
          });
        });

      sendResponse(this.createSuccessResponse(requestId, {
        started: true,
        totalImages: totalImages || 20,
        estimatedDuration: (totalImages || 20) * 150
      }));

    } catch (error) {
      console.error('❌ Error starting scraping simulation:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle exporting sample data
   */
  async handleExportSampleData(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const { format, galleryType } = message.payload || {};
      const exportData = await this.demoModeManager.exportSampleData(format, galleryType);

      sendResponse(this.createSuccessResponse(requestId, exportData));

    } catch (error) {
      console.error('❌ Error exporting sample data:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Handle getting demo statistics
   */
  async handleGetDemoStats(message, sender, sendResponse, requestId) {
    try {
      if (!this.demoModeManager) {
        throw new Error('DemoModeManager not available');
      }

      const stats = this.demoModeManager.demoStats;
      const status = this.demoModeManager.getDemoStatus();

      sendResponse(this.createSuccessResponse(requestId, {
        stats,
        status,
        sessionTime: status.sessionTime
      }));

    } catch (error) {
      console.error('❌ Error getting demo stats:', error);
      sendResponse(this.createErrorResponse(requestId, error.message));
    }
  }

  /**
   * Broadcast retry updates to connected UI components
   */
  broadcastRetryUpdate(updateType, data) {
    try {
      this.broadcast({
        action: 'BROADCAST_UPDATE',
        updateType: `retry_${updateType}`,
        data: {
          ...data,
          timestamp: Date.now()
        },
        source: 'retry_manager'
      });
    } catch (error) {
      console.error('❌ Error broadcasting retry update:', error);
    }
  }
}

// ============================================================================
// PROXYROUTER INITIALIZATION WITH ERROR HANDLING
// ============================================================================

/**
 * Initialize ProxyRouter with proper error handling and queue processing
 * This runs after the class definition to ensure proper initialization order
 */
async function initializeProxyRouter() {
  if (proxyRouterReady) {
    console.log('✅ ProxyRouter already initialized, skipping...');
    return true;
  }

  try {
    console.log('🚀 Initializing ProxyRouter after class definition...');
    
    // Create the ProxyRouter instance now that the class is defined
    globalProxyRouter = new ProxyRouter();
    
    // Initialize the router with existing systems integration
    const initSuccess = await globalProxyRouter.initialize();
    
    if (initSuccess) {
      // Mark router as ready
      proxyRouterReady = true;
      
      // Clear initialization timeout on success
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
        console.log('✅ ProxyRouter initialized successfully, timeout cleared');
      }
      
      // Drain all pending queues using unified function
      await drainPendingQueues();
      
      return true;
    } else {
      throw new Error('ProxyRouter initialization returned false');
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize ProxyRouter:', error);
    
    // Ensure graceful degradation - keep event listeners working with fallback
    console.warn('⚠️ Running in degraded mode without ProxyRouter');
    
    // Clear queued items with error responses
    clearQueuedItemsWithError('ProxyRouter initialization failed');
    
    return false;
  }
}

/**
 * CR-011 FIX: Process queued messages that arrived before ProxyRouter was ready
 * Enhanced with comprehensive error handling and tracking
 */
async function processQueuedMessages() {
  if (pendingMessages.length === 0) {
    return;
  }
  
  console.log(`📬 Processing ${pendingMessages.length} queued messages...`);
  
  const messages = [...pendingMessages];
  pendingMessages.length = 0; // Clear the queue
  
  let processedCount = 0;
  let expiredCount = 0;
  let errorCount = 0;
  
  for (const { message, sender, sendResponse, timestamp } of messages) {
    try {
      // Check if message is still valid (not too old)
      const age = Date.now() - timestamp;
      if (age > 30000) { // 30 seconds timeout
        console.warn('⏰ Dropping expired queued message:', message?.action || message?.type);
        try {
          sendResponse({ error: 'Message expired while service worker was initializing' });
        } catch (responseError) {
          console.warn('❌ Failed to send expiry response:', responseError);
        }
        expiredCount++;
        continue;
      }
      
      // Process the message
      if (globalProxyRouter && typeof globalProxyRouter.handleMessage === 'function') {
        globalProxyRouter.handleMessage(message, sender, sendResponse);
        processedCount++;
      } else {
        try {
          sendResponse({ error: 'ProxyRouter not available' });
        } catch (responseError) {
          console.warn('❌ Failed to send error response:', responseError);
        }
        errorCount++;
      }
    } catch (error) {
      console.error('❌ Error processing queued message:', error);
      try {
        sendResponse({ error: 'Failed to process queued message' });
      } catch (responseError) {
        console.warn('❌ Failed to send error response:', responseError);
      }
      errorCount++;
    }
  }
  
  console.log(`✅ Queue processing complete: ${processedCount} processed, ${expiredCount} expired, ${errorCount} errors`);
}

/**
 * CR-011 FIX: Process queued port connections that arrived before ProxyRouter was ready
 * Enhanced with comprehensive error handling and tracking
 */
async function processQueuedConnections() {
  if (pendingConnections.length === 0) {
    return;
  }
  
  console.log(`🔌 Processing ${pendingConnections.length} queued port connections...`);
  
  const connections = [...pendingConnections];
  pendingConnections.length = 0; // Clear the queue
  
  let processedCount = 0;
  let expiredCount = 0;
  let errorCount = 0;
  
  for (const { port, timestamp } of connections) {
    try {
      // Check if connection is still valid
      const age = Date.now() - timestamp;
      if (age > 30000) { // 30 seconds timeout
        console.warn('⏰ Dropping expired queued connection:', port?.name);
        expiredCount++;
        continue;
      }
      
      // Process the connection
      if (globalProxyRouter && typeof globalProxyRouter.handlePortConnection === 'function') {
        globalProxyRouter.handlePortConnection(port);
        processedCount++;
      } else {
        console.warn('⚠️ ProxyRouter not available for connection:', port?.name);
        errorCount++;
      }
    } catch (error) {
      console.error('❌ Error processing queued connection:', error);
      errorCount++;
    }
  }
  
  console.log(`✅ Connection queue processing complete: ${processedCount} processed, ${expiredCount} expired, ${errorCount} errors`);
}

/**
 * CR-011 FIX: Unified function to drain all pending queues when ProxyRouter becomes ready
 * Implements mutex-based synchronization to prevent race conditions
 * Ensures queue is drained ONLY ONCE after ProxyRouter is ready
 */
async function drainPendingQueues() {
  // CR-011 FIX: Check if already drained to prevent duplicate processing
  if (queueDrained) {
    console.log('✅ Queue already drained, skipping...');
    return;
  }
  
  // CR-011 FIX: Check if draining is in progress to prevent concurrent draining
  if (queueDrainInProgress) {
    console.log('⏳ Queue draining already in progress, waiting...');
    // Wait for the existing drain operation to complete
    if (queueDrainLock) {
      await queueDrainLock;
    }
    return;
  }
  
  // CR-011 FIX: Set the in-progress flag and create a lock promise
  queueDrainInProgress = true;
  let resolveLock;
  queueDrainLock = new Promise(resolve => { resolveLock = resolve; });
  
  try {
    console.log('🔄 Draining all pending queues (mutex-protected)...');
    
    // First drain the service worker's global queues
    await processQueuedMessages();
    await processQueuedConnections();
    
    // Then drain ProxyRouter's internal queues if available
    if (globalProxyRouter && typeof globalProxyRouter.drainQueues === 'function') {
      await globalProxyRouter.drainQueues();
    }
    
    // CR-011 FIX: Mark queue as drained ONLY after successful completion
    queueDrained = true;
    console.log('✅ All pending queues drained successfully (queue now marked as drained)');
  } catch (error) {
    console.error('❌ Error draining pending queues:', error);
    // CR-011 FIX: On error, do NOT mark as drained so it can be retried
    // But still release the lock to prevent deadlock
    console.warn('⚠️ Queue draining failed, queue will remain in pending state for retry');
  } finally {
    // CR-011 FIX: Always release the lock and clear in-progress flag
    queueDrainInProgress = false;
    if (resolveLock) {
      resolveLock();
    }
  }
}

/**
 * Clear queued items with error responses when initialization fails
 */
function clearQueuedItemsWithError(errorMessage) {
  // Clear pending messages with error responses
  for (const { sendResponse } of pendingMessages) {
    try {
      sendResponse({ error: errorMessage });
    } catch (error) {
      console.error('❌ Failed to send error response to queued message:', error);
    }
  }
  pendingMessages.length = 0;
  
  // Clear pending connections (they'll disconnect naturally)
  pendingConnections.length = 0;
  
  console.log('🧹 Cleared queued items due to initialization failure');
}

// Start ProxyRouter initialization immediately after class definition
initializeProxyRouter().then(success => {
  if (success) {
    console.log('🎉 Service worker fully initialized and ready');
  } else {
    console.warn('⚠️ Service worker running in degraded mode');
  }
}).catch(error => {
  console.error('💥 Critical error during ProxyRouter initialization:', error);
});

// Legacy proxyRouter reference points to globalProxyRouter for compatibility
Object.defineProperty(globalThis, 'proxyRouter', {
  get() { return globalProxyRouter; },
  configurable: true
});

// ============================================================================
// MV3 COMPLIANCE: Chrome.alarms-based Keepalive System
// ============================================================================

const KEEPALIVE_ALARM_NAME = 'stepthree-keepalive';
const HEALTH_CHECK_ALARM_NAME = 'stepthree-health-check';
const KEEPALIVE_INTERVAL = 1.0; // 1 minute - MV3 compliance (minimum allowed periodInMinutes)
const HEALTH_CHECK_INTERVAL = 2; // 2 minutes - comprehensive health monitoring

// Initialize MV3 keepalive system
async function initializeKeepaliveSystem() {
  try {
    console.log('🔄 Initializing MV3 keepalive system...');
    
    // Clear any existing alarms first to prevent duplicates
    try {
      await chrome.alarms.clear(KEEPALIVE_ALARM_NAME);
      await chrome.alarms.clear(HEALTH_CHECK_ALARM_NAME);
    } catch (error) {
      console.warn('⚠️ Could not clear existing alarms:', error);
    }
    
    // Create keepalive alarm - MV3 compliant (≥1 minute)
    await chrome.alarms.create(KEEPALIVE_ALARM_NAME, {
      delayInMinutes: KEEPALIVE_INTERVAL,
      periodInMinutes: KEEPALIVE_INTERVAL
    });
    
    // Create health check alarm - less frequent but comprehensive
    await chrome.alarms.create(HEALTH_CHECK_ALARM_NAME, {
      delayInMinutes: HEALTH_CHECK_INTERVAL,
      periodInMinutes: HEALTH_CHECK_INTERVAL
    });
    
    console.log('✅ MV3 keepalive system initialized');
    console.log(`📊 Keepalive: ${KEEPALIVE_INTERVAL}m, Health checks: ${HEALTH_CHECK_INTERVAL}m`);
    
    // DIAGNOSTIC: Verify alarm creation success
    await verifyAlarmCreation();
    
    // Start alarm monitoring system
    startAlarmMonitoring();
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize keepalive system:', error);
    return false;
  }
}

// Enhanced alarm handling with fallback mechanisms
let lastAlarmHeartbeat = Date.now();
let alarmFailureCount = 0;
let fallbackKeepaliveTimer = null;

// REMOVED: Duplicate alarm listener - now handled by top-level onAlarmWrapper
// Functionality moved to ProxyRouter.handleAlarmEvent method

// Comprehensive health check with recovery mechanisms
async function performComprehensiveHealthCheck() {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    serviceWorker: true, // If we're running, SW is alive
    components: {},
    actions: []
  };
  
  try {
    // Check all major components
    healthCheck.components = {
      downloadManager: downloadManager && downloadManager.isReady ? downloadManager.isReady() : false,
      messageHandler: messageHandler && messageHandler.isInitialized ? messageHandler.isInitialized : false,
      exportSystem: exportSystem !== null,
      errorHandler: errorHandler !== null,
      performanceMonitor: performanceMonitor && performanceMonitor.isInitialized ? performanceMonitor.isInitialized : false,
      contextMenuManager: contextMenuManager !== null
    };
    
    // Count unhealthy components
    const unhealthyComponents = Object.entries(healthCheck.components)
      .filter(([, healthy]) => !healthy)
      .map(([component]) => component);
    
    console.log('🏥 Health check results:', {
      healthy: unhealthyComponents.length === 0,
      unhealthyComponents: unhealthyComponents.length,
      details: healthCheck.components
    });
    
    // Trigger recovery if multiple components are unhealthy (but only if not already in recovery)
    if (unhealthyComponents.length > 0 && !isInRecoveryMode) {
      console.warn('⚠️ Unhealthy components detected:', unhealthyComponents);
      healthCheck.actions.push('recovery_triggered');
      
      // Set recovery flag to prevent infinite recursion
      isInRecoveryMode = true;
      
      try {
        // If more than 2 components are unhealthy or extension isn't initialized, full recovery
        if (!isExtensionInitialized || unhealthyComponents.length > 2) {
          console.log('🔧 Triggering full system recovery...');
          healthCheck.actions.push('full_recovery');
          await initializeExtension();
        } else {
          // Try to recover individual components
          healthCheck.actions.push('component_recovery');
          await recoverIndividualComponents(unhealthyComponents);
        }
      } finally {
        // Always clear recovery flag when done
        isInRecoveryMode = false;
      }
    } else if (unhealthyComponents.length > 0 && isInRecoveryMode) {
      console.log('⚠️ Unhealthy components detected but recovery already in progress, skipping to prevent recursion');
      healthCheck.actions.push('recovery_skipped_recursion_prevention');
    } else {
      console.log('✅ All systems healthy');
    }
    
    // DIAGNOSTIC: Add E2E communication verification to health checks
    if (unhealthyComponents.length === 0) {
      const e2eResults = await verifyE2ECommunication();
      healthCheck.e2eDiagnostics = e2eResults;
      
      // Test orchestrator communication with active tabs if available
      try {
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTabs.length > 0 && activeTabs[0].url && !activeTabs[0].url.startsWith('chrome://')) {
          const orchestratorTest = await testOrchestratorCommunication(activeTabs[0].id);
          healthCheck.orchestratorTest = orchestratorTest;
        }
      } catch (error) {
        healthCheck.orchestratorTestError = error.message;
      }
    }
    
    // Log to performance monitor if available
    if (performanceMonitor && performanceMonitor.logEvent) {
      performanceMonitor.logEvent('health-check', healthCheck);
    }
    
    return healthCheck;
  } catch (error) {
    console.error('❌ Health check failed:', error);
    healthCheck.error = error.message;
    healthCheck.actions.push('health_check_failed');
    return healthCheck;
  }
}

// Recovery for individual components
async function recoverIndividualComponents(unhealthyComponents) {
  for (const component of unhealthyComponents) {
    try {
      console.log(`🔧 Attempting to recover component: ${component}`);
      
      switch (component) {
        case 'downloadManager':
          if (!downloadManager) {
            downloadManager = new SimpleDownloadManager({
              enableNotifications: true,
              enableProgress: true,
              maxConcurrentDownloads: 3,
              errorHandler: errorHandler,
              performanceMonitor: performanceMonitor
            });
          }
          break;
          
        case 'messageHandler':
          if (!messageHandler) {
            messageHandler = SimpleMessageHandler.getInstance();
            await messageHandler.initialize(downloadManager, exportSystem);
            if (errorHandler && messageHandler) {
              messageHandler.errorHandler = errorHandler;
              messageHandler.performanceMonitor = performanceMonitor;
            }
          }
          break;
          
        case 'exportSystem':
          if (!exportSystem && typeof AdvancedExportSystem !== 'undefined') {
            exportSystem = new AdvancedExportSystem();
          }
          break;
          
        default:
          console.warn(`⚠️ No recovery method for component: ${component}`);
      }
      
      console.log(`✅ Component recovery attempted: ${component}`);
    } catch (error) {
      console.error(`❌ Failed to recover component ${component}:`, error);
    }
  }
}

// ============================================================================
// DIAGNOSTIC TOOLS: MV3 Compliance Verification
// ============================================================================

// Verify alarm creation success and provide diagnostics
async function verifyAlarmCreation() {
  try {
    console.log('🔍 Verifying alarm creation...');
    
    // Get all current alarms
    const alarms = await chrome.alarms.getAll();
    const alarmNames = alarms.map(alarm => alarm.name);
    
    // Check if our alarms exist
    const keepaliveExists = alarms.find(alarm => alarm.name === KEEPALIVE_ALARM_NAME);
    const healthCheckExists = alarms.find(alarm => alarm.name === HEALTH_CHECK_ALARM_NAME);
    
    const diagnostics = {
      totalAlarms: alarms.length,
      alarmNames: alarmNames,
      keepaliveAlarm: {
        exists: !!keepaliveExists,
        periodInMinutes: keepaliveExists?.periodInMinutes,
        compliant: keepaliveExists?.periodInMinutes >= 1
      },
      healthCheckAlarm: {
        exists: !!healthCheckExists,
        periodInMinutes: healthCheckExists?.periodInMinutes,
        compliant: healthCheckExists?.periodInMinutes >= 1
      }
    };
    
    console.log('📊 Alarm Diagnostics:', diagnostics);
    
    // Verify MV3 compliance
    if (!diagnostics.keepaliveAlarm.compliant) {
      console.error('❌ CRITICAL: Keepalive alarm not MV3 compliant!', diagnostics.keepaliveAlarm);
    }
    
    if (!diagnostics.healthCheckAlarm.compliant) {
      console.error('❌ CRITICAL: Health check alarm not MV3 compliant!', diagnostics.healthCheckAlarm);
    }
    
    if (diagnostics.keepaliveAlarm.compliant && diagnostics.healthCheckAlarm.compliant) {
      console.log('✅ All alarms are MV3 compliant');
    }
    
    return diagnostics;
  } catch (error) {
    console.error('❌ Alarm verification failed:', error);
    return { error: error.message };
  }
}

// ============================================================================
// ENHANCED ALARM SYSTEM: Fallback and Monitoring Mechanisms  
// ============================================================================

// Verify and repair alarm system if needed
async function verifyAndRepairAlarmSystem() {
  try {
    const alarms = await chrome.alarms.getAll();
    const keepaliveAlarm = alarms.find(a => a.name === KEEPALIVE_ALARM_NAME);
    const healthAlarm = alarms.find(a => a.name === HEALTH_CHECK_ALARM_NAME);
    
    let repaired = false;
    
    // Check if keepalive alarm exists and is healthy
    if (!keepaliveAlarm) {
      console.warn('⚠️ Keepalive alarm missing, recreating...');
      await chrome.alarms.create(KEEPALIVE_ALARM_NAME, {
        delayInMinutes: KEEPALIVE_INTERVAL,
        periodInMinutes: KEEPALIVE_INTERVAL
      });
      repaired = true;
    }
    
    // Check if health check alarm exists
    if (!healthAlarm) {
      console.warn('⚠️ Health check alarm missing, recreating...');
      await chrome.alarms.create(HEALTH_CHECK_ALARM_NAME, {
        delayInMinutes: HEALTH_CHECK_INTERVAL,
        periodInMinutes: HEALTH_CHECK_INTERVAL
      });
      repaired = true;
    }
    
    if (repaired) {
      console.log('🔧 Alarm system repaired successfully');
    }
    
    return { repaired, alarms: await chrome.alarms.getAll() };
  } catch (error) {
    console.error('❌ Failed to verify/repair alarm system:', error);
    // If alarm API fails, activate fallback immediately
    activateFallbackKeepalive();
    return { repaired: false, error: error.message };
  }
}

// Start monitoring alarm system health
function startAlarmMonitoring() {
  console.log('🔍 Starting alarm monitoring system...');
  
  // Check alarm health every 2 minutes
  const monitorInterval = setInterval(async () => {
    try {
      const timeSinceLastAlarm = Date.now() - lastAlarmHeartbeat;
      const expectedInterval = KEEPALIVE_INTERVAL * 60 * 1000; // Convert to ms
      
      // If no alarm for more than 1.5x the expected interval, there's a problem
      if (timeSinceLastAlarm > expectedInterval * 1.5) {
        console.warn(`⚠️ Alarm system appears to have failed! Last heartbeat: ${timeSinceLastAlarm}ms ago`);
        
        // Try to repair the alarm system
        const repairResult = await verifyAndRepairAlarmSystem();
        
        if (!repairResult.repaired) {
          console.error('💥 Alarm system repair failed, activating fallback...');
          activateFallbackKeepalive();
        }
      }
    } catch (error) {
      console.error('❌ Alarm monitoring check failed:', error);
    }
  }, 120000); // Check every 2 minutes
  
  // Store cleanup function
  cleanupTasks.push(() => clearInterval(monitorInterval));
}

// Activate fallback keepalive when alarms fail
function activateFallbackKeepalive() {
  if (fallbackKeepaliveTimer) {
    return; // Already active
  }
  
  console.log('🆘 Activating fallback keepalive system...');
  
  const fallbackInterval = () => {
    try {
      lastActivity = Date.now();
      console.log('💓 Fallback keepalive heartbeat - service worker active');
      
      // Basic health check
      if (!isExtensionInitialized && !isShuttingDown) {
        console.log('🔧 Extension not initialized during fallback, triggering recovery...');
        initializeExtension().catch(error => {
          console.error('❌ Fallback recovery failed:', error);
        });
      }
      
      // Try to restore alarm system periodically
      if (Math.random() < 0.1) { // 10% chance each heartbeat
        console.log('🔄 Attempting to restore alarm system...');
        verifyAndRepairAlarmSystem().then(result => {
          if (result.repaired) {
            console.log('✅ Alarm system restored, deactivating fallback...');
            if (fallbackKeepaliveTimer) {
              clearTimeout(fallbackKeepaliveTimer);
              fallbackKeepaliveTimer = null;
            }
          }
        }).catch(error => {
          console.warn('⚠️ Alarm system restoration failed:', error);
        });
      }
      
      // Schedule next heartbeat
      fallbackKeepaliveTimer = setTimeout(fallbackInterval, 60000); // 1 minute
      
    } catch (error) {
      console.error('❌ Fallback keepalive error:', error);
      // Schedule retry
      fallbackKeepaliveTimer = setTimeout(fallbackInterval, 60000);
    }
  };
  
  // Start immediately
  fallbackInterval();
  
  // Add cleanup
  cleanupTasks.push(() => {
    if (fallbackKeepaliveTimer) {
      clearTimeout(fallbackKeepaliveTimer);
      fallbackKeepaliveTimer = null;
    }
  });
}

// Verify E2E communication flow
async function verifyE2ECommunication() {
  try {
    console.log('🔍 Verifying E2E communication flow...');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      messageHandler: {
        singleton: !!messageHandler,
        initialized: messageHandler?.isInitialized,
        listenerCount: SimpleMessageHandler.listenerCount
      },
      communication: {
        testResults: []
      }
    };
    
    // Test if we can get active tabs
    try {
      const tabs = await chrome.tabs.query({ active: true });
      diagnostics.communication.activeTabs = tabs.length;
    } catch (error) {
      diagnostics.communication.tabsError = error.message;
    }
    
    console.log('📊 E2E Communication Diagnostics:', diagnostics);
    
    // Verify critical conditions
    if (SimpleMessageHandler.listenerCount > 1) {
      console.error('❌ CRITICAL: Multiple message listeners detected!', SimpleMessageHandler.listenerCount);
    } else if (SimpleMessageHandler.listenerCount === 1) {
      console.log('✅ Exactly one message listener registered (correct)');
    } else {
      console.warn('⚠️ No message listeners registered');
    }
    
    return diagnostics;
  } catch (error) {
    console.error('❌ E2E communication verification failed:', error);
    return { error: error.message };
  }
}

// Test orchestrator communication with a specific tab
async function testOrchestratorCommunication(tabId) {
  try {
    console.log(`🧪 Testing orchestrator communication with tab ${tabId}...`);
    
    const testResults = {
      tabId,
      timestamp: Date.now(),
      tests: []
    };
    
    // Test 1: Check orchestrator status
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'check_orchestrator_status'
      });
      
      testResults.tests.push({
        test: 'check_orchestrator_status',
        success: !!response?.success,
        available: response?.available,
        components: response?.components,
        response: response
      });
    } catch (error) {
      testResults.tests.push({
        test: 'check_orchestrator_status',
        success: false,
        error: error.message
      });
    }
    
    // Test 2: Try to score a mock element
    try {
      const mockElementData = {
        element: { tagName: 'IMG', src: 'test.jpg' },
        src: 'test.jpg'
      };
      
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'orchestrator_score_element',
        elementData: mockElementData,
        options: { enableSmartPatternRecognition: true }
      });
      
      testResults.tests.push({
        test: 'orchestrator_score_element',
        success: !!response?.success,
        confidence: response?.confidence,
        response: response
      });
    } catch (error) {
      testResults.tests.push({
        test: 'orchestrator_score_element', 
        success: false,
        error: error.message
      });
    }
    
    console.log('🧪 Orchestrator test results:', testResults);
    return testResults;
  } catch (error) {
    console.error('❌ Orchestrator communication test failed:', error);
    return { error: error.message, tabId };
  }
}

// ============================================================================
// MV3 COMPLIANCE: Event-driven Re-initialization Handlers
// ============================================================================

// Handle Chrome startup - extension was already installed and Chrome is starting
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 STEPTHREE Extension: Chrome startup detected');
  
  // Reset all state variables for fresh start
  serviceWorkerStartTime = Date.now();
  lastActivity = Date.now();
  isShuttingDown = false;
  isExtensionInitialized = false;
  initializationAttempts = 0;
  
  try {
    // Initialize keepalive system first (critical for MV3)
    await initializeKeepaliveSystem();
    
    // Initialize the extension
    await initializeExtension();
    
    // MV3 BEST PRACTICE: Initialize context menus on startup
    try {
      if (typeof ContextMenuManager !== 'undefined') {
        if (!contextMenuManager) {
          contextMenuManager = new ContextMenuManager();
        }
        await contextMenuManager.setupContextMenus();
        console.log('✅ Context menus initialized on startup');
      }
    } catch (error) {
      console.error('❌ Context menu initialization failed on startup:', error);
    }
    
    console.log('✅ Extension startup initialization completed');
  } catch (error) {
    console.error('❌ Startup initialization failed:', error);
    // Continue anyway - error mode will be activated if needed
  }
});

// Handle extension installation/update - fresh install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 STEPTHREE Extension: Installation/update detected', details);
  
  // Reset all state variables for fresh start
  serviceWorkerStartTime = Date.now();
  lastActivity = Date.now();
  isShuttingDown = false;
  isExtensionInitialized = false;
  initializationAttempts = 0;
  
  try {
    // Initialize keepalive system first (critical for MV3)
    await initializeKeepaliveSystem();
    
    // Initialize the extension
    await initializeExtension();
    
    // MV3 BEST PRACTICE: Initialize context menus on install/update
    try {
      if (typeof ContextMenuManager !== 'undefined') {
        if (!contextMenuManager) {
          contextMenuManager = new ContextMenuManager();
        }
        await contextMenuManager.setupContextMenus();
        console.log('✅ Context menus initialized on install/update');
      }
    } catch (error) {
      console.error('❌ Context menu initialization failed on install/update:', error);
    }
    
    // Handle different installation scenarios
    if (details.reason === 'install') {
      console.log('🎉 Fresh installation - extension ready');
      
      // Show welcome notification
      if (chrome.notifications) {
        chrome.notifications.create('welcome', {
          type: 'basic',
          iconUrl: 'icons/48.png',
          title: 'StepThree Gallery Scraper',
          message: 'Extension installed successfully! Click the icon to get started.'
        });
      }
      
    } else if (details.reason === 'update') {
      console.log('🔄 Extension updated from version', details.previousVersion);
      
      // Perform any necessary migration or cleanup
      await handleExtensionUpdate(details.previousVersion);
    }
    
    console.log('✅ Extension installation/update initialization completed');
  } catch (error) {
    console.error('❌ Installation initialization failed:', error);
    // Continue anyway - error mode will be activated if needed
  }
});

// Handle extension updates and migrations
async function handleExtensionUpdate(previousVersion) {
  try {
    console.log(`🔄 Handling update from version ${previousVersion}`);
    
    // Clear old alarms that might have different names
    const allAlarms = await chrome.alarms.getAll();
    for (const alarm of allAlarms) {
      if (alarm.name.includes('stepthree') || alarm.name.includes('gallery')) {
        await chrome.alarms.clear(alarm.name);
        console.log(`🧹 Cleared old alarm: ${alarm.name}`);
      }
    }
    
    // Clear any old notification that might be hanging around
    try {
      const notifications = await chrome.notifications.getAll();
      for (const [id] of Object.entries(notifications)) {
        if (id.includes('stepthree') || id.includes('gallery')) {
          await chrome.notifications.clear(id);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not clear old notifications:', error);
    }
    
    // Log successful update
    console.log('✅ Extension update handling completed');
  } catch (error) {
    console.error('❌ Extension update handling failed:', error);
  }
}

// Enhanced script loading with comprehensive error handling
// Critical libraries MUST be loaded first
const criticalLibraries = [
  '../lib/xlsx.full.min.js',
  '../lib/papaparse.min.js'
  // Note: jszip.min.js removed - ZIP functionality removed per requirements
];

const supportingScripts = [
  '../lib/consolidated-utilities.js'
  // Note: consolidated-systems.js is included in consolidated-background.js
];

const coreScripts = [
  './advanced-export-system.js'
  // Note: ./consolidated-background.js is already imported at line 8
];

let criticalLibrariesLoaded = 0;
const criticalLibraryErrors = [];

// NOTE: importScripts library loading removed for ES module compatibility and MV3 compliance
// All libraries (XLSX, Papa Parse) are bundled into dist/background.js via esbuild
// The following code is preserved as comments for reference only:
/*
for (const script of criticalLibraries) {
  try {
    importScripts(script);
    criticalLibrariesLoaded++;
  } catch (error) {
    criticalLibraryErrors.push({ script, error: error.message });
  }
}

try {
  if (typeof XLSX !== 'undefined') {
    globalThis.XLSX = XLSX;
  }
  
  if (typeof Papa !== 'undefined') {
    globalThis.Papa = Papa;
  }
} catch (error) {
  criticalLibraryErrors.push({ script: 'Library exposure', error: error.message });
}

for (const script of supportingScripts) {
  try {
    importScripts(script);
    criticalLibrariesLoaded++;
  } catch (error) {
    criticalLibraryErrors.push({ script, error: error.message });
  }
}

for (const script of coreScripts) {
  try {
    importScripts(script);
    criticalLibrariesLoaded++;
  } catch (error) {
    criticalLibraryErrors.push({ script, error: error.message });
  }
}
*/

// ============================================================================
// MV3 COMPLIANCE: Cleanup and State Management
// ============================================================================

// Cleanup previous initialization attempts to ensure idempotent behavior
async function cleanupPreviousInitialization() {
  console.log('🧹 Cleaning up previous initialization state...');
  
  try {
    // Clear existing intervals and timeouts
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
    
    // Run registered cleanup tasks
    for (const cleanupTask of cleanupTasks) {
      try {
        await cleanupTask();
      } catch (error) {
        console.warn('⚠️ Cleanup task failed:', error);
      }
    }
    
    // Reset cleanup tasks array
    cleanupTasks.length = 0;
    
    // Cleanup any hanging notifications
    try {
      const notifications = await chrome.notifications.getAll();
      for (const [id] of Object.entries(notifications)) {
        if (id.includes('stepthree') || id.includes('extension') || id.includes('error')) {
          await chrome.notifications.clear(id);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not clear old notifications:', error);
    }
    
    console.log('✅ Previous initialization cleanup completed');
  } catch (error) {
    console.warn('⚠️ Some cleanup operations failed:', error);
    // Don't throw - cleanup failures shouldn't prevent initialization
  }
}

// MV3 COMPLIANCE: Circuit Breaker Pattern for Error Recovery
class CircuitBreaker {
  constructor(name, threshold = 5, timeout = 60000, monitor = 30000) {
    this.name = name;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.threshold = threshold;
    this.timeout = timeout;
    this.monitor = monitor;
    this.successCount = 0;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker ${this.name}: Moving to HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN - operation blocked`);
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`✅ Circuit breaker ${this.name}: Recovered to CLOSED state`);
    }
  }
  
  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    console.warn(`⚠️ Circuit breaker ${this.name}: Failure ${this.failureCount}/${this.threshold}`, error.message);
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.error(`❌ Circuit breaker ${this.name}: OPEN - too many failures`);
      
      // ENHANCEMENT 3: Notify user when circuit breaker opens
      this.notifyUserCircuitOpen();
    }
  }
  
  /**
   * ENHANCEMENT 3: Notify user when circuit breaker trips
   * Provides actionable feedback and suggests reload
   */
  notifyUserCircuitOpen() {
    try {
      // Send notification via chrome notifications API
      const notificationOptions = {
        type: 'basic',
        iconUrl: 'icons/128.png',
        title: 'StepThree - Service Temporarily Paused',
        message: `Too many ${this.name} errors detected. Please reload the page or try again in a minute.`,
        priority: 2,
        requireInteraction: false
      };
      
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create(
          `circuit-breaker-${this.name}-${Date.now()}`,
          notificationOptions
        ).catch(err => {
          console.warn('Could not create notification:', err);
        });
      }
      
      // Also broadcast to connected UI components
      if (globalProxyRouter && typeof globalProxyRouter.broadcastUpdate === 'function') {
        globalProxyRouter.broadcastUpdate('error', {
          type: 'circuit_breaker_open',
          name: this.name,
          message: `Service temporarily paused due to repeated errors. Please reload the page.`,
          action: 'reload_suggested',
          timestamp: Date.now()
        });
      }
    } catch (notifyError) {
      console.error('Failed to notify user of circuit breaker:', notifyError);
    }
  }
  
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Initialize circuit breakers for major operations
const circuitBreakers = {
  initialization: new CircuitBreaker('initialization', 3, 30000),
  messageHandling: new CircuitBreaker('messageHandling', 5, 15000),
  downloadOperations: new CircuitBreaker('downloadOperations', 10, 60000),
  exportOperations: new CircuitBreaker('exportOperations', 5, 30000)
};

// Enhanced initialization - comprehensive system management
let downloadManager = null;
let messageHandler = null;
let contextMenuManager = null;
let exportSystem = null;
let errorHandler = null;
let performanceMonitor = null;
// memoryManagementSystem removed - dangerous function overrides removed per requirements
let isExtensionInitialized = false;
let initializationAttempts = 0;
let healthCheckInterval = null;
let cleanupTasks = [];
let isInRecoveryMode = false; // Flag to prevent infinite recursion in health checks

// Service worker lifecycle management
let serviceWorkerStartTime = Date.now();
let lastActivity = Date.now();
let isShuttingDown = false;

// ============================================================================
// MV3 COMPLIANCE: Idempotent Extension Initialization
// ============================================================================

// Enhanced extension initialization with idempotent design and comprehensive error handling
async function initializeExtension() {
  // MV3 COMPLIANCE: Idempotent initialization check
  if (isExtensionInitialized && !isShuttingDown) {
    console.log('✅ Extension already initialized, performing health check...');
    
    // Verify all systems are still healthy
    const healthCheck = await performComprehensiveHealthCheck();
    if (healthCheck.components && Object.values(healthCheck.components).every(Boolean)) {
      console.log('✅ All systems healthy, skipping duplicate initialization');
      return true;
    } else {
      console.log('⚠️ Some systems unhealthy, proceeding with re-initialization...');
      isExtensionInitialized = false; // Allow re-initialization
    }
  }
  
  if (isShuttingDown) {
    console.log('⏹️ Skipping initialization - service worker is shutting down');
    return false;
  }

  initializationAttempts++;
  const maxAttempts = 5; // Increased for MV3 resilience
  
  // MV3 COMPLIANCE: Cleanup previous initialization attempts
  try {
    await cleanupPreviousInitialization();
  } catch (error) {
    console.warn('⚠️ Cleanup of previous initialization failed:', error);
    // Continue anyway - cleanup failure shouldn't prevent initialization
  }
  
  try {
    console.log(`🔄 Initializing STEPTHREE extension (attempt ${initializationAttempts}/${maxAttempts})...`);
    
    // Check critical script loading
    if (criticalLibraryErrors.length > 0) {
      throw new Error(`Critical scripts failed to load: ${criticalLibraryErrors.map(e => e.script).join(', ')}`);
    }

    // Initialize error handling system first (highest priority)
    if (typeof ErrorHandlingSystem !== 'undefined') {
      try {
        errorHandler = new ErrorHandlingSystem({
          enableConsoleLogging: true,
          enableUserNotifications: true,
          enableErrorReporting: false,
          maxRetryAttempts: 3,
          circuitBreakerThreshold: 5,
          notificationDuration: 8000
        });
        console.log('✅ Enhanced error handling system initialized');
      } catch (error) {
        console.error('❌ Critical: Error handling system failed to initialize:', error);
        // Continue with basic error handling
        errorHandler = {
          handleError: (err, context, metadata, severity) => {
            console.error(`[${severity}] ${context}:`, err);
          }
        };
      }
    }

    // Initialize performance monitoring system
    if (typeof PerformanceMonitoringSystem !== 'undefined') {
      try {
        performanceMonitor = new PerformanceMonitoringSystem({
          enableMemoryMonitoring: true,
          enablePerformanceTracking: true,
          enableHealthChecks: true,
          memoryWarningThreshold: 150 * 1024 * 1024, // 150MB
          memoryCriticalThreshold: 250 * 1024 * 1024, // 250MB
          slowOperationThreshold: 2000, // 2 seconds
          healthCheckInterval: 120000, // 2 minutes
          reportingInterval: 300000 // 5 minutes
        });
        
        await performanceMonitor.initialize();
        
        // Register service worker health checker
        performanceMonitor.registerHealthChecker('service-worker', async () => {
          const uptime = Date.now() - serviceWorkerStartTime;
          const timeSinceActivity = Date.now() - lastActivity;
          
          return {
            healthy: !isShuttingDown && timeSinceActivity < 300000, // 5 minutes
            message: isShuttingDown ? 'Service worker shutting down' : 'Service worker healthy',
            details: {
              uptime: `${Math.floor(uptime / 1000)}s`,
              lastActivity: `${Math.floor(timeSinceActivity / 1000)}s ago`,
              initialized: isExtensionInitialized
            }
          };
        });
        
        console.log('✅ Performance monitoring system initialized');
      } catch (error) {
        console.error('❌ Performance monitoring failed to initialize:', error);
        if (errorHandler) {
          errorHandler.handleError(error, 'Performance Monitor Initialization', {}, 'medium');
        }
      }
    }

    // MemoryManagementSystem removed - it was overriding native browser functions
    // Use ResourceTracker instead for safe resource tracking

    // Track initialization performance
    const initTimer = performanceMonitor?.startOperation('extension-initialization', 'lifecycle') || { end: () => {} };

    // Initialize export system with error handling
    try {
      if (typeof AdvancedExportSystem !== 'undefined') {
        exportSystem = new AdvancedExportSystem();
        console.log('✅ Advanced export system initialized');
      } else {
        console.warn('⚠️ AdvancedExportSystem not available');
      }
    } catch (error) {
      console.error('❌ Export system initialization failed:', error);
      if (errorHandler) {
        errorHandler.handleError(error, 'Export System Initialization', {}, 'medium');
      }
    }

    // Initialize download manager with enhanced monitoring
    try {
      downloadManager = new SimpleDownloadManager({
        enableNotifications: true,
        enableProgress: true,
        maxConcurrentDownloads: 3,
        errorHandler: errorHandler,
        performanceMonitor: performanceMonitor
      });
      console.log('✅ Download manager initialized');
    } catch (error) {
      console.error('❌ Download manager initialization failed:', error);
      if (errorHandler) {
        errorHandler.handleError(error, 'Download Manager Initialization', {}, 'high');
      }
      throw error; // Download manager is critical
    }

    // Initialize message handler with all systems and enhanced error handling
    try {
      messageHandler = SimpleMessageHandler.getInstance();
      await messageHandler.initialize(downloadManager, exportSystem);
      
      // Enhance message handler with error reporting
      if (errorHandler && messageHandler) {
        messageHandler.errorHandler = errorHandler;
        messageHandler.performanceMonitor = performanceMonitor;
      }
      
      console.log('✅ Message handler initialized');
    } catch (error) {
      console.error('❌ Message handler initialization failed:', error);
      if (errorHandler) {
        errorHandler.handleError(error, 'Message Handler Initialization', {}, 'critical');
      }
      throw error; // Message handler is critical
    }

    // Initialize ProxyRouter with enhanced message routing and validation
    try {
      console.log('🔄 Initializing ProxyRouter...');
      
      // Create ProxyRouter instance with message validation enabled
      if (typeof ProxyRouter !== 'undefined') {
        globalProxyRouter = new ProxyRouter({
          enableMessageValidation: true,
          strictValidation: false, // Allow unknown actions with warnings
          maxPendingMessages: 100,
          maxPendingConnections: 50,
          messageTimeout: 10000
        });
        
        // Initialize with dependencies
        await globalProxyRouter.initialize({
          errorHandler: errorHandler,
          downloadQueue: downloadManager,
          exportSystem: exportSystem
        });
        
        // Register handlers for download and export operations
        if (messageHandler) {
          // Route download operations through existing messageHandler
          globalProxyRouter.registerMessageHandler('SCRAPE_DONE', messageHandler.handleScrapeResults.bind(messageHandler));
          globalProxyRouter.registerMessageHandler('START_DOWNLOAD', messageHandler.handleStartDownload.bind(messageHandler));
          globalProxyRouter.registerMessageHandler('GET_QUEUE_STATUS', messageHandler.handleGetQueueStatus.bind(messageHandler));
          globalProxyRouter.registerMessageHandler('EXPORT_DATA', messageHandler.handleExportData.bind(messageHandler));
          globalProxyRouter.registerMessageHandler('CHECK_PERMISSIONS', messageHandler.handleCheckPermissions.bind(messageHandler));
          // Acknowledge content initialization pings to avoid noisy warnings
          globalProxyRouter.registerMessageHandler('orchestrator_ready', async (message) => {
            return { success: true, acknowledged: true, report: message.report };
          });
          globalProxyRouter.registerMessageHandler('CONTENT_READY', async (message) => {
            // ENHANCEMENT 2: Track content script readiness for explicit confirmation
            const tabId = message.sender?.tab?.id || message.payload?.tabId;
            if (tabId) {
              if (!globalThis.contentScriptReadyTabs) {
                globalThis.contentScriptReadyTabs = new Set();
              }
              globalThis.contentScriptReadyTabs.add(tabId);
              console.log(`✅ Content script ready confirmed for tab ${tabId}`);
            }
            return { success: true, acknowledged: true, ready: true };
          });
          globalProxyRouter.registerMessageHandler('memory_sample', async (message) => {
            // Optionally record memory metric in future; for now just ack
            return { success: true, acknowledged: true, sample: message.sample };
          });
          
          // Register scan and content routing handlers
          globalProxyRouter.registerMessageHandler('SCAN_START', async (message) => {
            try {
              const { tabId, options } = message.payload || {};
              if (!tabId) {
                return { success: false, error: 'Tab ID required' };
              }
              
              // ENHANCEMENT 2: Wait for content script readiness confirmation before scan
              const maxWaitTime = 3000; // 3 seconds max wait
              const startWait = Date.now();
              
              while (!globalThis.contentScriptReadyTabs?.has(tabId)) {
                if (Date.now() - startWait > maxWaitTime) {
                  console.warn(`⚠️ Content script readiness timeout for tab ${tabId}, proceeding anyway`);
                  break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // Inject content script and trigger scan
              await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                  if (window.__STEPTHREE_CONTENT_READY) {
                    window.postMessage({ type: 'STEPTHREE_SCAN_START', options: arguments[0] }, '*');
                  } else {
                    console.warn('⚠️ Content script not ready, scan may fail');
                  }
                },
                args: [options]
              });
              
              return { success: true, message: 'Scan initiated' };
            } catch (error) {
              console.error('SCAN_START handler error:', error);
              // ENHANCEMENT 3: Use circuit breaker for scan operations
              if (circuitBreakers.initialization) {
                circuitBreakers.initialization.onFailure(error);
              }
              return { success: false, error: error.message };
            }
          });
          
          globalProxyRouter.registerMessageHandler('ROUTE_TO_CONTENT', async (message) => {
            try {
              const { tabId, action, options } = message.payload || {};
              if (!tabId) {
                return { success: false, error: 'Tab ID required' };
              }
              
              // Route message to content script
              const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: (contentAction, contentOptions) => {
                  if (window.__STEPTHREE_CONTENT_READY) {
                    window.postMessage({ 
                      type: 'STEPTHREE_ACTION', 
                      action: contentAction, 
                      options: contentOptions 
                    }, '*');
                    return { success: true, message: 'Action routed to content script' };
                  }
                  return { success: false, error: 'Content script not ready' };
                },
                args: [action, options]
              });
              
              return result?.result || { success: false, error: 'No response from content script' };
            } catch (error) {
              console.error('ROUTE_TO_CONTENT handler error:', error);
              return { success: false, error: error.message };
            }
          });
        }
        
        // Mark ProxyRouter as ready and drain any queued items
        proxyRouterReady = true;
        
        // Clear initialization timeout on success
        if (initTimeoutId) {
          clearTimeout(initTimeoutId);
          console.log('✅ ProxyRouter initialized successfully, timeout cleared');
        }
        
        console.log('✅ ProxyRouter ready, draining queues...');
        
        // Drain all pending queues using unified function
        await drainPendingQueues();
        
        console.log('✅ ProxyRouter initialization completed successfully');
      } else {
        throw new Error('ProxyRouter class not available');
      }
    } catch (error) {
      console.error('❌ ProxyRouter initialization failed:', error);
      if (errorHandler) {
        errorHandler.handleError(error, 'ProxyRouter Initialization', {}, 'high');
      }
      
      // Ensure proxyRouterReady is false on failure
      proxyRouterReady = false;
      
      // Drain queued items using fallback handling
      console.warn('⚠️ Draining queues with fallback handling...');
      drainQueuesFallback();
      
      console.warn('⚠️ Extension will continue with legacy message handling');
    }

    // NOTE: Context menu initialization moved to chrome.runtime.onInstalled and onStartup
    // This follows MV3 best practices to prevent duplicate menu ID errors

    // Set up enhanced systems
    await setupEnhancedNotificationHandlers();
    await setupEnhancedEventListeners();
    setupLifecycleManagement();
    setupResourceCleanup();

    // Start health monitoring
    if (performanceMonitor) {
      startServiceWorkerHealthChecks();
    }

    // Mark as initialized
    isExtensionInitialized = true;
    lastActivity = Date.now();
    
    // End initialization timer
    initTimer.end({ success: true, attempt: initializationAttempts });

    console.log(`✅ STEPTHREE extension initialized successfully (attempt ${initializationAttempts})`);
    console.log(`📊 Initialization summary: ${scriptsLoaded}/${requiredScripts.length} scripts loaded`);
    
    // CRITICAL: Add comprehensive startup verification
    await logStartupSummary();
    
    // Perform self-diagnostic check
    const diagnosticResult = await performStartupDiagnostics();
    if (!diagnosticResult.healthy) {
      console.warn('⚠️ Startup diagnostics detected issues:', diagnosticResult.issues);
    }
    
    return true;

  } catch (error) {
    console.error(`❌ Extension initialization failed (attempt ${initializationAttempts}):`, error);
    
    if (errorHandler) {
      errorHandler.handleError(error, 'Extension Initialization', {
        attempt: initializationAttempts,
        maxAttempts,
        scriptLoadErrors: scriptLoadErrors.length,
        uptime: Date.now() - serviceWorkerStartTime
      }, 'critical');
    }

    // Retry initialization if not at max attempts
    if (initializationAttempts < maxAttempts && !isShuttingDown) {
      console.log(`🔄 Retrying initialization in 2 seconds (attempt ${initializationAttempts + 1}/${maxAttempts})...`);
      setTimeout(() => {
        initializeExtension();
      }, 2000);
    } else {
      console.error('💥 Extension initialization failed permanently');
      // Set up minimal error-only functionality
      setupMinimalErrorMode();
    }

    return false;
  }
}

// Minimal error mode when initialization fails completely
function setupMinimalErrorMode() {
  console.log('⚠️ Setting up minimal error mode...');
  
  // REMOVED: Emergency message listener - conflicts with top-level onMessageWrapper
  // Emergency handling is now built into the top-level message wrapper
  console.log('🚨 Service worker in error mode - using top-level message handler');

  // REMOVED: Duplicate action listener - handled by top-level onActionClickWrapper
}

// Enhanced event listeners with comprehensive error handling and monitoring
async function setupEnhancedEventListeners() {
  try {
    console.log('🔄 Setting up enhanced event listeners...');
    // NOTE: All event listeners are now registered at top level for MV3 compliance

    // REMOVED: Duplicate action click listener - handled by top-level onActionClickWrapper

    // REMOVED: Duplicate context menu listener - handled by top-level onContextMenuClickWrapper

    // REMOVED: Duplicate command listener - handled by top-level onCommandWrapper

    // REMOVED: Duplicate tab update listener - handled by top-level onTabUpdatedWrapper

    // REMOVED: Tab removal listener - resource cleanup can be handled elsewhere if needed

    // REMOVED: Download change listener - can be handled elsewhere if needed

    console.log('✅ Enhanced event listeners set up successfully');
  } catch (error) {
    console.error('❌ Failed to set up enhanced event listeners:', error);
    if (errorHandler) {
      errorHandler.handleError(error, 'Event Listener Setup', {}, 'high');
    }
    throw error;
  }
}

// Enhanced notification handlers with error handling and performance monitoring
async function setupEnhancedNotificationHandlers() {
  try {
    console.log('🔄 Setting up enhanced notification handlers...');

    // Handle notification clicks with comprehensive error handling
    if (chrome.notifications && chrome.notifications.onClicked) {
      chrome.notifications.onClicked.addListener(async (notificationId) => {
        const operation = performanceMonitor?.startOperation('notification-click', 'ui') || { end: () => {} };
        lastActivity = Date.now();
        
        try {
          console.log('🔔 Notification clicked:', notificationId);
          
          // Handle different types of notifications
          if (notificationId.includes('download_')) {
            try {
              await chrome.downloads.showDefaultFolder();
              operation.addMetadata({ notificationType: 'download', action: 'showFolder' });
            } catch (error) {
              console.warn('⚠️ Could not show download folder:', error);
              // Fallback to opening downloads page
              await chrome.tabs.create({ url: 'chrome://downloads/' });
              operation.addMetadata({ notificationType: 'download', action: 'fallbackDownloadsPage' });
            }
          } else if (notificationId.includes('scraping_')) {
            try {
              const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
              if (tabs[0]) {
                await openDashboard(tabs[0]);
                operation.addMetadata({ notificationType: 'scraping', action: 'openDashboard', tabId: tabs[0].id });
              } else {
                throw new Error('No active tab found');
              }
            } catch (error) {
              console.error('❌ Failed to open dashboard from notification:', error);
              if (errorHandler) {
                errorHandler.handleError(error, 'Notification Dashboard Open', { notificationId }, 'medium');
              }
            }
          } else if (notificationId.includes('error-')) {
            // Handle error notifications - could provide recovery options
            operation.addMetadata({ notificationType: 'error', action: 'acknowledged' });
          }
          
          // Clear the notification
          await chrome.notifications.clear(notificationId);
          operation.end({ success: true, notificationId });
          
        } catch (error) {
          console.error('❌ Notification click handler failed:', error);
          if (errorHandler) {
            errorHandler.handleError(error, 'Notification Click Handler', { notificationId }, 'low');
          }
          operation.end({ success: false, error: error.message });
        }
      });
    }

    // Handle notification button clicks with enhanced error handling
    if (chrome.notifications && chrome.notifications.onButtonClicked) {
      chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
        const operation = performanceMonitor?.startOperation('notification-button-click', 'ui') || { end: () => {} };
        lastActivity = Date.now();
        
        try {
          console.log('🔘 Notification button clicked:', notificationId, buttonIndex);
          
          if (notificationId.includes('download_')) {
            if (buttonIndex === 0) {
              // Show download folder
              try {
                await chrome.downloads.showDefaultFolder();
                operation.addMetadata({ action: 'showFolder' });
              } catch (error) {
                console.warn('⚠️ Could not show download folder, opening downloads page');
                await chrome.tabs.create({ url: 'chrome://downloads/' });
                operation.addMetadata({ action: 'fallbackDownloadsPage' });
              }
            } else if (buttonIndex === 1) {
              // Open download manager
              await chrome.tabs.create({ url: 'chrome://downloads/' });
              operation.addMetadata({ action: 'openDownloadsPage' });
            }
          } else if (notificationId.includes('error-')) {
            if (buttonIndex === 0) {
              // Retry action
              operation.addMetadata({ action: 'retry' });
              // Could implement retry logic here
            } else if (buttonIndex === 1) {
              // Dismiss/ignore
              operation.addMetadata({ action: 'dismiss' });
            }
          }
          
          await chrome.notifications.clear(notificationId);
          operation.end({ success: true, notificationId, buttonIndex });
          
        } catch (error) {
          console.error('❌ Notification button click handler failed:', error);
          if (errorHandler) {
            errorHandler.handleError(error, 'Notification Button Handler', { notificationId, buttonIndex }, 'low');
          }
          operation.end({ success: false, error: error.message });
        }
      });
    }

    console.log('✅ Enhanced notification handlers set up successfully');
  } catch (error) {
    console.error('❌ Failed to set up enhanced notification handlers:', error);
    if (errorHandler) {
      errorHandler.handleError(error, 'Notification Handler Setup', {}, 'medium');
    }
    throw error;
  }
}

// Service worker lifecycle management
function setupLifecycleManagement() {
  try {
    console.log('🔄 Setting up service worker lifecycle management...');

    // Handle service worker installation
    self.addEventListener('install', (event) => {
      console.log('⚙️ Service worker installing...');
      event.waitUntil(
        (async () => {
          try {
            // Perform any installation tasks
            console.log('✅ Service worker installation completed');
          } catch (error) {
            console.error('❌ Service worker installation failed:', error);
            if (errorHandler) {
              errorHandler.handleError(error, 'Service Worker Installation', {}, 'critical');
            }
          }
        })()
      );
    });

    // Handle service worker activation
    self.addEventListener('activate', (event) => {
      console.log('🔄 Service worker activating...');
      event.waitUntil(
        (async () => {
          try {
            // Claim all existing clients
            await self.clients.claim();
            
            // Initialize extension if not already done
            if (!isExtensionInitialized && !isShuttingDown) {
              console.log('🚀 Initializing extension on activation...');
              await initializeExtension();
            }
            
            safeConsole.log('✅ Service worker activation completed');
          } catch (error) {
            safeConsole.error('❌ Service worker activation failed:', error);
            if (errorHandler) {
              errorHandler.handleError(error, 'Service Worker Activation', {}, 'critical');
            }
          }
        })()
      );
    });

    // Handle service worker fetch events (if needed for caching)
    self.addEventListener('fetch', (event) => {
      // Only handle extension requests with Chrome API check
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
          if (event.request.url.startsWith(chrome.runtime.getURL(''))) {
            lastActivity = Date.now();
            // Add custom fetch handling if needed
          }
        }
      } catch (error) {
        // Fallback: Check if URL looks like an extension URL
        if (event.request.url.includes('chrome-extension://') || event.request.url.includes('moz-extension://')) {
          lastActivity = Date.now();
          console.log('🌍 Handling extension request (fallback mode):', event.request.url);
        }
      }
    });

    // Handle beforeunload for cleanup
    self.addEventListener('beforeunload', () => {
      safeConsole.log('⚠️ Service worker unloading, performing cleanup...');
      performCleanupTasks();
    });

    // NOTE: No module-scope logging for MV3 compliance
  } catch (error) {
    // Safe console error logging to prevent "Illegal invocation"
    try {
      if (typeof console !== 'undefined' && console.error && typeof console.error === 'function') {
        safeConsole.error('❌ Failed to set up lifecycle management:', error);
      } else if (typeof console !== 'undefined' && console.log && typeof console.log === 'function') {
        safeConsole.log('ERROR: ❌ Failed to set up lifecycle management:', error);
      }
    } catch (consoleError) {
      // Silent failure if console methods fail
    }
    
    if (errorHandler) {
      errorHandler.handleError(error, 'Lifecycle Management Setup', {}, 'high');
    }
  }
}

// Resource cleanup management
function setupResourceCleanup() {
  try {
    console.log('🔄 Setting up resource cleanup management...');

    // Periodic cleanup task
    const cleanupInterval = setInterval(() => {
      try {
        performCleanupTasks();
      } catch (error) {
        console.error('❌ Periodic cleanup failed:', error);
        if (errorHandler) {
          errorHandler.handleError(error, 'Periodic Cleanup', {}, 'low');
        }
      }
    }, 300000); // Every 5 minutes

    cleanupTasks.push(() => clearInterval(cleanupInterval));

    // Memory pressure cleanup
    if (performanceMonitor) {
      performanceMonitor.registerHealthChecker('memory-cleanup', async () => {
        const memoryUsage = performanceMonitor.getCurrentMemoryUsage();
        if (memoryUsage && memoryUsage > 200 * 1024 * 1024) { // 200MB
          performCleanupTasks();
          return { 
            healthy: true, 
            message: 'Memory cleanup performed',
            details: { memoryUsage: performanceMonitor.formatBytes(memoryUsage) }
          };
        }
        return { healthy: true, message: 'Memory usage normal' };
      });
    }

    console.log('✅ Resource cleanup management set up');
  } catch (error) {
    console.error('❌ Failed to set up resource cleanup:', error);
    if (errorHandler) {
      errorHandler.handleError(error, 'Resource Cleanup Setup', {}, 'medium');
    }
  }
}

// Perform cleanup tasks
function performCleanupTasks() {
  try {
    console.log('🧹 Performing cleanup tasks...');

    // Run all registered cleanup tasks
    cleanupTasks.forEach((cleanupTask, index) => {
      try {
        cleanupTask();
      } catch (error) {
        console.warn(`⚠️ Cleanup task ${index} failed:`, error);
      }
    });

    // Clear old performance data
    if (performanceMonitor) {
      const stats = performanceMonitor.getStats();
      if (stats.operations.completed > 1000) {
        console.log('🗑️ Trimming performance history...');
        // The performance monitor handles its own cleanup
      }
    }

    // Clear old error data
    if (errorHandler && errorHandler.errorHistory?.length > 100) {
      console.log('🗑️ Trimming error history...');
      // The error handler handles its own cleanup
    }

    // Memory management system removed - dangerous function overrides removed per requirements
    
    // Suggest garbage collection if available
    if (typeof gc === 'function') {
      try {
        console.log('🗑️ Triggering garbage collection...');
        gc();
      } catch (error) {
        console.warn('⚠️ Manual GC failed:', error);
        if (typeof window !== 'undefined' && window.gc) {
          window.gc();
        }
      }
    } else if (typeof window !== 'undefined' && window.gc) {
      console.log('🗑️ Triggering garbage collection...');
      window.gc();
    }

    console.log('✅ Cleanup tasks completed');
  } catch (error) {
    console.error('❌ Cleanup tasks failed:', error);
  }
}

// Cleanup resources for specific tab
function cleanupTabResources(tabId) {
  try {
    console.log(`🧹 Cleaning up resources for tab ${tabId}...`);

    // Cleanup download manager resources for this tab
    if (downloadManager && downloadManager.cleanupTabResources) {
      downloadManager.cleanupTabResources(tabId);
    }

    // Cleanup message handler resources for this tab
    if (messageHandler && messageHandler.cleanupTabResources) {
      messageHandler.cleanupTabResources(tabId);
    }

    // Memory management system removed - dangerous function overrides removed per requirements
      }
    }

    // Cleanup any tab-specific performance tracking
    if (performanceMonitor) {
      const activeOps = Array.from(performanceMonitor.activeOperations.values());
      const tabOps = activeOps.filter(op => op.metadata?.tabId === tabId);
      tabOps.forEach(op => {
        performanceMonitor.endOperation(op.id, { success: false, reason: 'Tab closed' });
      });
    }

    console.log(`✅ Tab ${tabId} resources cleaned up`);
  } catch (error) {
    console.error(`❌ Failed to cleanup resources for tab ${tabId}:`, error);
    if (errorHandler) {
      errorHandler.handleError(error, 'Tab Resource Cleanup', { tabId }, 'low');
    }
  }
}

// Service worker health checks
function startServiceWorkerHealthChecks() {
  try {
    console.log('🏥 Starting service worker health checks...');

    healthCheckInterval = setInterval(async () => {
      try {
        if (!isShuttingDown && performanceMonitor) {
          const healthStatus = await performanceMonitor.performHealthCheck();
          
          // Log health status periodically
          if (healthStatus.overall !== 'healthy') {
            console.warn('⚠️ Health check failed:', healthStatus);
            
            // Take corrective action if needed
            if (healthStatus.failureCount > 5) {
              console.error('💥 Multiple health check failures, attempting recovery...');
              attemptSystemRecovery();
            }
          }
        }
      } catch (error) {
        console.error('❌ Health check failed:', error);
        if (errorHandler) {
          errorHandler.handleError(error, 'Health Check', {}, 'medium');
        }
      }
    }, 120000); // Every 2 minutes

    cleanupTasks.push(() => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
    });

    console.log('✅ Service worker health checks started');
  } catch (error) {
    console.error('❌ Failed to start health checks:', error);
    if (errorHandler) {
      errorHandler.handleError(error, 'Health Check Setup', {}, 'medium');
    }
  }
}

// Attempt system recovery when health checks fail
async function attemptSystemRecovery() {
  try {
    console.log('🔧 Attempting system recovery...');
    
    if (isShuttingDown) {
      return;
    }

    // Reset failure counters
    if (performanceMonitor) {
      performanceMonitor.healthStatus.failureCount = 0;
    }

    // Cleanup resources
    performCleanupTasks();

    // Reinitialize critical systems if needed
    if (!isExtensionInitialized) {
      console.log('🔄 Reinitializing extension systems...');
      await initializeExtension();
    }

    console.log('✅ System recovery completed');
  } catch (error) {
    console.error('❌ System recovery failed:', error);
    if (errorHandler) {
      errorHandler.handleError(error, 'System Recovery', {}, 'critical');
    }
  }
}

// Open dashboard - simplified
async function openDashboard(tab) {
  try {
    // Check permissions first
    const hasPermissions = await chrome.permissions.contains({
      permissions: ['tabs']
    });

    if (!hasPermissions) {
      console.warn('⚠️ MV3 COMPLIANCE: Cannot request permissions from service worker');
      // MV3 FIX: Cannot request permissions from service worker context
      // Must notify UI to handle permission request with user gesture
      try {
        await chrome.runtime.sendMessage({
          type: 'PERMISSION_NEEDED',
          permission: 'tabs',
          reason: 'Tabs permission required to open dashboard'
        });
      } catch (error) {
        console.warn('Could not notify UI about permission need:', error.message);
      }
      
      // Show notification to user explaining they need to grant permissions via UI
      await showPermissionNotification(
        'StepThree needs permissions to access tabs and manage downloads. Please click the extension icon and grant permissions to continue.'
      );
      return;
    }

    // Create dashboard window
    const dashboardUrl = chrome.runtime.getURL('ui/windowed-dashboard.html');
    const urlWithParams = `${dashboardUrl}?sourceTabId=${tab.id}&sourceTabUrl=${encodeURIComponent(tab.url)}&sourceTabTitle=${encodeURIComponent(tab.title)}`;

    const window = await chrome.windows.create({
      url: urlWithParams,
      type: 'popup',
      width: 1200,
      height: 800,
      focused: true
    });

    console.log('✅ Dashboard opened:', window.id);
  } catch (error) {
    console.error('❌ Failed to open dashboard:', error);
  }
}

// Handle keyboard commands
async function handleKeyboardCommand(command, tab) {
  switch (command) {
    case 'start-scraper':
      await startScraping(tab);
      break;
    case 'open-dashboard':
      await openDashboard(tab);
      break;
    case 'toggle-selector':
      await toggleSelector(tab);
      break;
    default:
      console.log('Unknown command:', command);
  }
}

// Start scraping - simplified
async function startScraping(tab) {
  try {
    console.log('🚀 Starting scraping on tab:', tab.id);
    
    // Inject content script on-demand before sending message
    await injectContentScript(tab.id, false);
    
    // Send message to content script to start scraping
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'quickScan',
      settings: {}
    });

    if (response && response.success) {
      console.log('✅ Scraping completed:', response.itemCount, 'items found');
    } else {
      console.error('❌ Scraping failed:', response?.error);
    }
  } catch (error) {
    console.error('❌ Failed to start scraping:', error);
    await showErrorNotification('Scraping failed. Please ensure the page is loaded and try again.');
  }
}

// Toggle selector mode - simplified
async function toggleSelector(tab) {
  try {
    console.log('🎯 Toggling selector mode on tab:', tab.id);
    
    // Inject content script on-demand before sending message
    await injectContentScript(tab.id, false);
    
    await chrome.tabs.sendMessage(tab.id, {
      action: 'toggleSelector'
    });
  } catch (error) {
    console.error('❌ Failed to toggle selector:', error);
    await showErrorNotification('Failed to toggle selector. Please refresh the page and try again.');
  }
}

// REMOVED: Duplicate listeners - main initialization handlers are at lines 208-276

// Helper functions for user notifications
async function showPermissionNotification(message) {
  try {
    if (chrome.notifications && chrome.notifications.create) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'StepThree Gallery Scraper - Permissions Required',
        message: message
      });
    } else {
      console.log('📢 Permission message:', message);
    }
  } catch (error) {
    console.error('❌ Failed to show permission notification:', error);
  }
}

async function showErrorNotification(message) {
  try {
    if (chrome.notifications && chrome.notifications.create) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'StepThree Gallery Scraper - Error',
        message: message
      });
    } else {
      console.log('⚠️ Error message:', message);
    }
  } catch (error) {
    console.error('❌ Failed to show error notification:', error);
  }
}

async function showSuccessNotification(message) {
  try {
    if (chrome.notifications && chrome.notifications.create) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/48.png',
        title: 'StepThree Gallery Scraper - Success',
        message: message
      });
    } else {
      console.log('✅ Success message:', message);
    }
  } catch (error) {
    console.error('❌ Failed to show success notification:', error);
  }
}

// CRITICAL: Comprehensive startup verification functions
async function logStartupSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 STEPTHREE EXTENSION STARTUP SUMMARY');
  console.log('='.repeat(60));
  
  const summary = {
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor((Date.now() - serviceWorkerStartTime) / 1000)}s`,
    initializationAttempts,
    keepaliveSystem: !!chrome.alarms,
    scriptsLoaded: `${scriptsLoaded}/${requiredScripts.length}`,
    scriptLoadErrors: scriptLoadErrors.length,
    components: {
      downloadManager: downloadManager ? '✅ Ready' : '❌ Not Ready',
      messageHandler: messageHandler && messageHandler.isInitialized ? '✅ Ready' : '❌ Not Ready',
      exportSystem: exportSystem ? '✅ Ready' : '❌ Not Ready',
      errorHandler: errorHandler ? '✅ Ready' : '❌ Not Ready',
      performanceMonitor: performanceMonitor && performanceMonitor.isInitialized ? '✅ Ready' : '❌ Not Ready'
    },
    messageHandling: messageHandler ? `Single handler (${messageHandler.isInitialized ? 'initialized' : 'not initialized'})` : 'No handler',
    keepaliveSystemStatus: await getKeepaliveStatus()
  };
  
  console.log('📊 Startup Summary:', summary);
  
  // Verify keepalive system is called exactly once
  try {
    const alarms = await chrome.alarms.getAll();
    const keepaliveAlarms = alarms.filter(a => 
      a.name === KEEPALIVE_ALARM_NAME || a.name === HEALTH_CHECK_ALARM_NAME
    );
    console.log(`⏰ Keepalive alarms active: ${keepaliveAlarms.length}/2 expected`);
    if (keepaliveAlarms.length !== 2) {
      console.warn('⚠️ Keepalive system may not be properly initialized!');
    }
  } catch (error) {
    console.warn('⚠️ Could not verify keepalive alarms:', error);
  }
  
  console.log('='.repeat(60) + '\n');
}

// Get keepalive system status
async function getKeepaliveStatus() {
  try {
    const alarms = await chrome.alarms.getAll();
    const keepaliveAlarm = alarms.find(a => a.name === KEEPALIVE_ALARM_NAME);
    const healthCheckAlarm = alarms.find(a => a.name === HEALTH_CHECK_ALARM_NAME);
    
    return {
      keepalive: keepaliveAlarm ? `Active (${keepaliveAlarm.periodInMinutes}m)` : 'Not Active',
      healthCheck: healthCheckAlarm ? `Active (${healthCheckAlarm.periodInMinutes}m)` : 'Not Active',
      totalAlarms: alarms.length
    };
  } catch (error) {
    return { error: error.message };
  }
}

// CRITICAL: Self-diagnostic checks and error reporting
async function performStartupDiagnostics() {
  console.log('🔍 Performing startup diagnostics...');
  
  const diagnostics = {
    healthy: true,
    issues: [],
    checks: {}
  };
  
  try {
    // Check 1: Verify scripts loaded
    diagnostics.checks.scriptsLoaded = scriptLoadErrors.length === 0;
    if (!diagnostics.checks.scriptsLoaded) {
      diagnostics.issues.push(`${scriptLoadErrors.length} scripts failed to load`);
      diagnostics.healthy = false;
    }
    
    // Check 2: Verify message handler coordination (CRITICAL ISSUE 2)
    diagnostics.checks.messageHandlerReady = messageHandler && messageHandler.isInitialized;
    if (!diagnostics.checks.messageHandlerReady) {
      diagnostics.issues.push('Message handler not properly initialized');
      diagnostics.healthy = false;
    }
    
    // Check 3: Verify keepalive system (CRITICAL ISSUE 3)
    try {
      const alarms = await chrome.alarms.getAll();
      const hasKeepalive = alarms.some(a => a.name === KEEPALIVE_ALARM_NAME);
      const hasHealthCheck = alarms.some(a => a.name === HEALTH_CHECK_ALARM_NAME);
      diagnostics.checks.keepaliveSystem = hasKeepalive && hasHealthCheck;
      if (!diagnostics.checks.keepaliveSystem) {
        diagnostics.issues.push('Keepalive system not properly configured');
        diagnostics.healthy = false;
      }
    } catch (error) {
      diagnostics.issues.push('Cannot access chrome.alarms API');
      diagnostics.healthy = false;
    }
    
    // Check 4: Test basic Chrome API access (CRITICAL ISSUE 4)
    diagnostics.checks.chromeAPIs = {
      runtime: !!chrome.runtime,
      tabs: !!chrome.tabs,
      notifications: !!chrome.notifications,
      action: !!chrome.action
    };
    
    const missingAPIs = Object.entries(diagnostics.checks.chromeAPIs)
      .filter(([, available]) => !available)
      .map(([api]) => api);
    
    if (missingAPIs.length > 0) {
      diagnostics.issues.push(`Missing Chrome APIs: ${missingAPIs.join(', ')}`);
      diagnostics.healthy = false;
    }
    
    // Check 5: Memory status
    if (performance.memory) {
      const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
      diagnostics.checks.memoryUsage = `${Math.floor(memoryUsage)}MB`;
      if (memoryUsage > 100) { // 100MB threshold
        diagnostics.issues.push(`High memory usage: ${Math.floor(memoryUsage)}MB`);
      }
    }
    
    // Check 6: Test dashboard communication capability
    try {
      // Verify we can access tabs API for dashboard communication
      await chrome.tabs.query({ active: true, currentWindow: true });
      diagnostics.checks.dashboardCommunication = 'Ready';
    } catch (error) {
      diagnostics.issues.push('Cannot access tabs for dashboard communication');
      diagnostics.checks.dashboardCommunication = 'Failed';
      diagnostics.healthy = false;
    }
    
    console.log(`🔍 Diagnostics complete: ${diagnostics.healthy ? '✅ Healthy' : '⚠️ Issues found'}`);
    if (diagnostics.issues.length > 0) {
      console.warn('⚠️ Diagnostic issues:', diagnostics.issues);
    }
    console.log('📊 Diagnostic details:', diagnostics.checks);
    
  } catch (error) {
    console.error('❌ Startup diagnostics failed:', error);
    diagnostics.healthy = false;
    diagnostics.issues.push(`Diagnostics failed: ${error.message}`);
  }
  
  return diagnostics;
}

// NOTE: Module-scope initialization removed for MV3 compliance
// ProxyRouter and extension will be initialized by event handlers
// The following code is commented out to ensure no chrome.* API access at module load:
/*
(async () => {
  try {
    await globalProxyRouter.initialize();
  } catch (error) {
    console.error('Early ProxyRouter initialization failed:', error);
  }
})();

initializeExtension();
*/

// MV3 COMPLIANT: Service worker setup complete
// All initialization will happen via chrome.runtime.onInstalled/onStartup events