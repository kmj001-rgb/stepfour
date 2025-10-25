// proxy-router.js - Centralized message routing system for STEPTHREE Chrome Extension
// Handles communication between service worker, content scripts, and UI components
// Features: message validation, port management, keepalive, state persistence

import { QUEUE_CONFIG, TIMEOUT_CONFIG } from '../config/constants.js';

if (typeof Logger === 'undefined' && typeof importScripts === 'function') {
  try {
    importScripts('./logger.js');
  } catch (error) {
    console.error('Failed to load logger.js:', error);
  }
}

const proxyRouterLogger = typeof Logger !== 'undefined' ? new Logger('ProxyRouter') : null;
if (proxyRouterLogger) {
  proxyRouterLogger.debug('Loading ProxyRouter System...');
} else {
  console.log('🔗 Loading ProxyRouter System...');
}

/**
 * ProxyRouter - Central communication hub for the extension
 * Manages message routing, validation, port connections, and state persistence
 */
class ProxyRouter {
  constructor(options = {}) {
    this.options = {
      // Queue management
      maxPendingMessages: options.maxPendingMessages || QUEUE_CONFIG.MAX_PENDING_MESSAGES,
      maxPendingConnections: options.maxPendingConnections || 50,
      maxQueueAge: options.maxQueueAge || QUEUE_CONFIG.MAX_AGE_MS,
      
      // Timeout settings
      messageTimeout: options.messageTimeout || TIMEOUT_CONFIG.MESSAGE_TIMEOUT_MS,
      connectionTimeout: options.connectionTimeout || TIMEOUT_CONFIG.CONNECTION_TIMEOUT_MS,
      
      // Keepalive settings
      keepaliveInterval: options.keepaliveInterval || TIMEOUT_CONFIG.KEEPALIVE_INTERVAL_MS,
      maxKeepaliveRetries: options.maxKeepaliveRetries || 3,
      
      ...options
    };

    // Core state
    this.initialized = false;
    this.ready = false;

    // Message queues with bounded sizes
    this.pendingMessages = [];
    this.pendingConnections = [];

    // Port management
    this.ports = new Map(); // portName -> port
    this.portSubscriptions = new Map(); // portName -> Set of updateTypes
    this.portKeepalive = new Map(); // portName -> intervalId

    // Message tracking
    this.messageHandlers = new Map();
    this.responseCallbacks = new Map(); // requestId -> { callback, timeout }

    // Stats and monitoring
    this.stats = {
      messagesProcessed: 0,
      messagesQueued: 0,
      connectionsEstablished: 0,
      validationFailures: 0,
      timeouts: 0,
      errors: 0
    };

    // Error handler reference
    this.errorHandler = null;

    // Logger instance
    this.logger = proxyRouterLogger || { debug: console.log, info: console.log, warn: console.warn, error: console.error };

    this.logger.debug('ProxyRouter instance created with options:', this.options);
  }

  /**
   * Initialize the ProxyRouter with required dependencies
   */
  async initialize(dependencies = {}) {
    if (this.initialized) {
      this.logger.warn('ProxyRouter already initialized');
      return;
    }

    try {
      // Store dependencies
      this.errorHandler = dependencies.errorHandler;
      this.downloadQueue = dependencies.downloadQueue;
      this.exportSystem = dependencies.exportSystem;

      // Register default message handlers
      this.registerDefaultHandlers();

      // Set up periodic cleanup
      this.setupPeriodicCleanup();

      this.initialized = true;
      this.ready = true;

      this.logger.info('ProxyRouter initialized successfully');

      // Drain any queued items now that we're ready
      await this.drainQueues();

    } catch (error) {
      console.error('❌ ProxyRouter initialization failed:', error);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, 'ProxyRouter Initialization', {}, 'critical');
      }
      throw error;
    }
  }

  /**
   * Handle incoming messages with validation and routing
   */
  async handleMessage(message, sender, sendResponse) {
    const startTime = Date.now();
    
    // Hoist responseHandled to function scope to prevent scoping bugs
    let responseHandled = false;
    const safeResponse = (response) => {
      if (!responseHandled) {
        responseHandled = true;
        sendResponse(response);
      }
    };
    
    try {
      // Validate and normalize message - MANDATORY for security
      let normalizedMessage = message;
      if (typeof MessageValidator !== 'undefined') {
        const validationResult = MessageValidator.validateAndNormalize(
          message, 
          sender, 
          true // Always use strict validation for security
        );

        if (!validationResult.valid) {
          this.stats.validationFailures++;
          this.logger.error('Message validation failed:', validationResult.error);
          safeResponse({
            ok: false,
            error: `Message validation failed: ${validationResult.error}`,
            requestId: message.requestId || `fallback_${Date.now()}`
          });
          return false;
        }

        normalizedMessage = validationResult.message || message;
        
        // Log validation warnings if any
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          this.logger.warn('Message validation warnings:', validationResult.warnings);
        }
      }

      // Set timeout to prevent hanging channels
      const timeoutId = setTimeout(() => {
        if (!responseHandled) {
          this.logger.warn('Message handling timeout:', normalizedMessage.action);
          this.stats.timeouts++;
          safeResponse({
            ok: false,
            error: 'Message handling timeout',
            requestId: normalizedMessage.requestId,
            timeout: true
          });
        }
      }, this.options.messageTimeout);

      // Route message to appropriate handler
      const result = await this.routeMessage(normalizedMessage, sender);

      // Clear timeout and send response
      clearTimeout(timeoutId);
      
      if (!responseHandled) {
        responseHandled = true;
        sendResponse({
          ok: true,
          data: result,
          requestId: normalizedMessage.requestId,
          processingTime: Date.now() - startTime
        });
      }

      this.stats.messagesProcessed++;
      return true; // Keep message channel open

    } catch (error) {
      this.logger.error('Message handling error:', error);
      this.stats.errors++;

      // Report error
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, 'Message Handling', {
          message: message,
          sender: sender
        }, 'medium');
      }

      // Always respond to prevent channel leak using safeResponse wrapper
      safeResponse({
        ok: false,
        error: error.message || 'Message handling failed',
        requestId: message.requestId || `error_${Date.now()}`,
        processingTime: Date.now() - startTime
      });

      return false;
    }
  }

  /**
   * Handle port connections for persistent communication
   */
  handlePortConnection(port) {
    try {
      this.logger.debug('Port connection established:', port.name);

      // Store port
      this.ports.set(port.name, port);
      this.portSubscriptions.set(port.name, new Set());

      // Set up port message handling
      port.onMessage.addListener((message) => {
        this.handlePortMessage(message, port);
      });

      // Set up port disconnection handling
      port.onDisconnect.addListener(() => {
        this.handlePortDisconnection(port);
      });

      // Start keepalive for this port
      this.startPortKeepalive(port);

      // Send connection acknowledgment
      this.sendToPort(port.name, {
        action: 'PORT_CONNECTED',
        portName: port.name,
        timestamp: Date.now()
      });

      this.stats.connectionsEstablished++;

    } catch (error) {
      this.logger.error('Port connection error:', error);
      if (this.errorHandler) {
        this.errorHandler.handleError(error, 'Port Connection', { portName: port.name }, 'medium');
      }
    }
  }

  /**
   * Route messages to appropriate handlers
   */
  async routeMessage(message, sender) {
    const { action } = message;

    // Handle internal routing actions
    switch (action) {
      case 'UI_SUBSCRIBE':
        return this.handleUISubscribe(message, sender);
      
      case 'UI_UNSUBSCRIBE':
        return this.handleUIUnsubscribe(message, sender);
      
      case 'HEALTH_PING':
        return this.handleHealthPing(message);
      
      case 'HEALTH_STATUS':
        return this.getHealthStatus();
      
      case 'PORT_KEEPALIVE':
        return this.handlePortKeepalive(message);
      
      case 'BROADCAST_UPDATE':
        return this.handleBroadcastUpdate(message);

      default:
        // Route to registered message handlers or fallback
        return this.routeToHandler(message, sender);
    }
  }

  /**
   * Route to registered message handlers
   */
  async routeToHandler(message, sender) {
    const { action } = message;

    // Check for registered handler
    if (this.messageHandlers.has(action)) {
      const handler = this.messageHandlers.get(action);
      return await handler(message, sender);
    }

    // Log unknown action with context for debugging
    this.logger.error(`No handler found for action: ${action}`, {
      action,
      availableHandlers: Array.from(this.messageHandlers.keys()),
      sender: sender?.tab?.id || sender?.url || 'unknown',
      timestamp: Date.now()
    });
    
    // Return error response instead of throwing to prevent crash
    return {
      ok: false,
      error: `No handler registered for action: ${action}`,
      action,
      availableActions: Array.from(this.messageHandlers.keys())
    };
  }

  /**
   * Drain pending message and connection queues safely with timeouts
   */
  async drainQueues() {
    if (!this.ready) {
      this.logger.debug('ProxyRouter not ready, cannot drain queues');
      return;
    }

    try {
      this.logger.debug('Draining queues...', {
        pendingMessages: this.pendingMessages.length,
        pendingConnections: this.pendingConnections.length
      });

      // Drain pending messages with timeout protection
      const messagesToProcess = [...this.pendingMessages];
      this.pendingMessages = [];

      for (const item of messagesToProcess) {
        try {
          // Check if message is too old
          if (Date.now() - item.timestamp > this.options.maxQueueAge) {
            this.logger.warn('Dropping aged message:', item.message.action);
            item.sendResponse({
              ok: false,
              error: 'Message aged out of queue',
              requestId: item.message.requestId,
              aged: true
            });
            continue;
          }

          // Process message with timeout
          await Promise.race([
            this.handleMessage(item.message, item.sender, item.sendResponse),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Queue drain timeout')), 5000)
            )
          ]);

        } catch (error) {
          this.logger.error('Error processing queued message:', error);
          item.sendResponse({
            ok: false,
            error: 'Failed to process queued message',
            requestId: item.message.requestId
          });
        }
      }

      // Drain pending connections with timeout protection
      const connectionsToProcess = [...this.pendingConnections];
      this.pendingConnections = [];

      for (const item of connectionsToProcess) {
        try {
          // Check if connection is too old
          if (Date.now() - item.timestamp > this.options.maxQueueAge) {
            this.logger.warn('Dropping aged connection:', item.port.name);
            continue;
          }

          // Process connection
          this.handlePortConnection(item.port);

        } catch (error) {
          this.logger.error('Error processing queued connection:', error);
        }
      }

      this.logger.debug('Queue draining completed');

    } catch (error) {
      this.logger.error('Queue draining failed:', error);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, 'Queue Draining', {}, 'medium');
      }
    }
  }

  /**
   * Register a message handler for a specific action
   */
  registerMessageHandler(action, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.messageHandlers.set(action, handler);
    this.logger.debug(`Registered handler for action: ${action}`);
  }

  /**
   * Register default message handlers
   */
  registerDefaultHandlers() {
    // Health and monitoring
    this.registerMessageHandler('HEALTH_PING', (message) => ({
      pong: true,
      timestamp: Date.now(),
      routerStats: this.getStats()
    }));

    this.registerMessageHandler('HEALTH_STATUS', () => this.getHealthStatus());
    
    // Router management
    this.registerMessageHandler('ROUTER_STATS', () => this.getStats());
    this.registerMessageHandler('ROUTER_RESET', () => this.reset());
  }

  /**
   * Handle UI subscription requests
   */
  handleUISubscribe(message, sender) {
    const { payload } = message;
    const { updateTypes, portName } = payload;

    if (!portName) {
      throw new Error('Port name required for UI subscription');
    }

    if (!this.portSubscriptions.has(portName)) {
      this.portSubscriptions.set(portName, new Set());
    }

    const subscriptions = this.portSubscriptions.get(portName);
    
    if (Array.isArray(updateTypes)) {
      updateTypes.forEach(type => subscriptions.add(type));
    } else {
      subscriptions.add('*'); // Subscribe to all updates
    }

    this.logger.debug(`UI subscribed: ${portName} -> ${Array.from(subscriptions).join(', ')}`);

    return {
      subscribed: true,
      portName: portName,
      updateTypes: Array.from(subscriptions)
    };
  }

  /**
   * Handle UI unsubscription requests
   */
  handleUIUnsubscribe(message, sender) {
    const { payload } = message;
    const { updateTypes, portName } = payload;

    if (!portName || !this.portSubscriptions.has(portName)) {
      return { unsubscribed: false, error: 'Port not found' };
    }

    const subscriptions = this.portSubscriptions.get(portName);
    
    if (Array.isArray(updateTypes)) {
      updateTypes.forEach(type => subscriptions.delete(type));
    } else {
      subscriptions.clear(); // Unsubscribe from all
    }

    this.logger.debug(`UI unsubscribed: ${portName} from ${updateTypes}`);

    return {
      unsubscribed: true,
      portName: portName,
      remainingSubscriptions: Array.from(subscriptions)
    };
  }

  /**
   * Broadcast update to subscribed UI components
   */
  async broadcastUpdate(updateType, data, targets = null) {
    try {
      const message = {
        action: 'BROADCAST_UPDATE',
        updateType: updateType,
        data: data,
        timestamp: Date.now()
      };

      let sentCount = 0;

      for (const [portName, subscriptions] of this.portSubscriptions.entries()) {
        // Check if this port should receive this update
        if (targets && !targets.includes(portName)) continue;
        if (!subscriptions.has('*') && !subscriptions.has(updateType)) continue;

        // Send to port
        if (this.sendToPort(portName, message)) {
          sentCount++;
        }
      }

      this.logger.debug(`Broadcast sent: ${updateType} to ${sentCount} subscribers`);
      return { sent: sentCount, updateType: updateType };

    } catch (error) {
      this.logger.error('Broadcast failed:', error);
      if (this.errorHandler) {
        await this.errorHandler.handleError(error, 'Broadcast Update', { updateType }, 'medium');
      }
      return { sent: 0, error: error.message };
    }
  }

  /**
   * Send message to specific port
   */
  sendToPort(portName, message) {
    try {
      const port = this.ports.get(portName);
      if (!port) {
        this.logger.warn(`Port not found: ${portName}`);
        return false;
      }

      port.postMessage(message);
      return true;

    } catch (error) {
      this.logger.error(`Failed to send to port ${portName}:`, error);
      // Clean up disconnected port
      this.handlePortDisconnection({ name: portName });
      return false;
    }
  }

  /**
   * Handle port message
   * BUG FIX: Added early message validation before processing
   */
  async handlePortMessage(message, port) {
    try {
      // BUG FIX: Validate message structure early to prevent crashes
      if (!message || typeof message !== 'object') {
        this.logger.warn('Invalid message structure received on port:', port?.name);
        try {
          port.postMessage({
            ok: false,
            error: 'Invalid message structure',
            requestId: null
          });
        } catch (e) {
          // Port may be disconnected
        }
        return;
      }

      const { action } = message;
      
      if (!action || typeof action !== 'string') {
        this.logger.warn('Message missing action field:', { message, portName: port?.name });
        try {
          port.postMessage({
            ok: false,
            error: 'Message missing action field',
            requestId: message.requestId || null
          });
        } catch (e) {
          // Port may be disconnected
        }
        return;
      }

      // Route port messages through normal message handling
      await this.handleMessage(message, { port: port }, (response) => {
        try {
          port.postMessage(response);
        } catch (error) {
          this.logger.error('Failed to respond to port message:', error);
        }
      });
    } catch (error) {
      this.logger.error('Port message handling error:', error);
      // Try to send error response
      try {
        port.postMessage({
          ok: false,
          error: 'Port message handling failed',
          requestId: message?.requestId || null
        });
      } catch (e) {
        // Port may be disconnected
      }
    }
  }

  /**
   * Handle port disconnection
   */
  handlePortDisconnection(port) {
    const portName = port.name;
    
    this.logger.debug('Port disconnected:', portName);

    // Clean up port references
    this.ports.delete(portName);
    this.portSubscriptions.delete(portName);

    // Stop keepalive
    this.stopPortKeepalive(portName);
  }

  /**
   * Start keepalive for port
   * NOTE: This uses setInterval which is acceptable in MV3 for port-specific keepalives because:
   * 1. It's tied to port lifecycle (cleared when port disconnects)
   * 2. It maintains connections while service worker is already active
   * 3. Primary SW keepalive is handled by chrome.alarms in background.js
   */
  startPortKeepalive(port) {
    const portName = port.name;
    
    // Clear any existing keepalive
    this.stopPortKeepalive(portName);

    // Start new keepalive interval (acceptable for port-specific keepalive)
    const intervalId = setInterval(() => {
      try {
        if (this.ports.has(portName)) {
          this.sendToPort(portName, {
            action: 'PORT_KEEPALIVE',
            timestamp: Date.now()
          });
        } else {
          // Port no longer exists, clear interval
          this.stopPortKeepalive(portName);
        }
      } catch (error) {
        this.logger.warn(`Keepalive failed for ${portName}:`, error);
        this.stopPortKeepalive(portName);
      }
    }, this.options.keepaliveInterval);

    this.portKeepalive.set(portName, intervalId);
    this.logger.debug(`Keepalive started for port: ${portName}`);
  }

  /**
   * Stop keepalive for port
   */
  stopPortKeepalive(portName) {
    const intervalId = this.portKeepalive.get(portName);
    if (intervalId) {
      clearInterval(intervalId);
      this.portKeepalive.delete(portName);
      this.logger.debug(`Keepalive stopped for port: ${portName}`);
    }
  }

  /**
   * Handle health ping
   */
  handleHealthPing(message) {
    return {
      pong: true,
      timestamp: Date.now(),
      ready: this.ready,
      stats: this.getStats()
    };
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      ready: this.ready,
      initialized: this.initialized,
      stats: this.getStats(),
      ports: Array.from(this.ports.keys()),
      subscriptions: Object.fromEntries(
        Array.from(this.portSubscriptions.entries()).map(([port, subs]) => [
          port, Array.from(subs)
        ])
      ),
      queueSizes: {
        pendingMessages: this.pendingMessages.length,
        pendingConnections: this.pendingConnections.length
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      ...this.stats,
      portsConnected: this.ports.size,
      subscriptionsActive: this.portSubscriptions.size,
      handlersRegistered: this.messageHandlers.size,
      queueSizes: {
        pendingMessages: this.pendingMessages.length,
        pendingConnections: this.pendingConnections.length
      }
    };
  }

  /**
   * Setup periodic cleanup
   * PHASE 2 FIX: Use chrome.alarms instead of setInterval for MV3 compliance
   */
  setupPeriodicCleanup() {
    // Setup alarms for periodic tasks
    const setupAlarms = async () => {
      try {
        await chrome.alarms.create('proxyrouter-cleanup', { periodInMinutes: 0.5 }); // 30 seconds
        await chrome.alarms.create('proxyrouter-stats', { periodInMinutes: 5 });
        this.logger.info('ProxyRouter alarms configured');
      } catch (error) {
        this.logger.error('Failed to setup ProxyRouter alarms:', error);
      }
    };
    
    setupAlarms();
  }
  
  /**
   * Handle alarm events for ProxyRouter
   * PHASE 2 FIX: Added to handle chrome.alarms instead of setInterval
   */
  handleAlarmEvent(alarm) {
    try {
      if (alarm.name === 'proxyrouter-cleanup') {
        this.cleanupAgedQueueItems();
      } else if (alarm.name === 'proxyrouter-stats') {
        this.logger.debug('ProxyRouter Stats:', this.getStats());
      }
    } catch (error) {
      this.logger.error('ProxyRouter alarm handler error:', error);
    }
  }

  /**
   * Clean up aged queue items
   */
  cleanupAgedQueueItems() {
    const now = Date.now();
    const maxAge = this.options.maxQueueAge;

    // Clean aged messages
    const validMessages = this.pendingMessages.filter(item => {
      if (now - item.timestamp > maxAge) {
        this.logger.warn('Cleaning aged message:', item.message.action);
        item.sendResponse({
          ok: false,
          error: 'Message aged out',
          aged: true,
          requestId: item.message.requestId
        });
        return false;
      }
      return true;
    });
    this.pendingMessages = validMessages;

    // Clean aged connections
    const validConnections = this.pendingConnections.filter(item => {
      if (now - item.timestamp > maxAge) {
        this.logger.warn('Cleaning aged connection:', item.port.name);
        return false;
      }
      return true;
    });
    this.pendingConnections = validConnections;
  }

  /**
   * Reset router state
   */
  reset() {
    this.logger.info('Resetting ProxyRouter...');

    // Clear queues with proper response handling
    this.pendingMessages.forEach(item => {
      item.sendResponse({
        ok: false,
        error: 'Router reset',
        reset: true,
        requestId: item.message.requestId
      });
    });
    this.pendingMessages = [];
    this.pendingConnections = [];

    // Disconnect all ports
    for (const [portName, port] of this.ports.entries()) {
      try {
        port.disconnect();
      } catch (error) {
        this.logger.warn(`Error disconnecting port ${portName}:`, error);
      }
    }
    this.ports.clear();
    this.portSubscriptions.clear();

    // Stop all keepalives
    for (const intervalId of this.portKeepalive.values()) {
      clearInterval(intervalId);
    }
    this.portKeepalive.clear();

    // Reset stats
    this.stats = {
      messagesProcessed: 0,
      messagesQueued: 0,
      connectionsEstablished: 0,
      validationFailures: 0,
      timeouts: 0,
      errors: 0
    };

    this.logger.info('ProxyRouter reset completed');
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProxyRouter;
} else if (typeof window !== 'undefined') {
  window.ProxyRouter = ProxyRouter;
} else if (typeof self !== 'undefined') {
  self.ProxyRouter = ProxyRouter;
} else if (typeof globalThis !== 'undefined') {
  globalThis.ProxyRouter = ProxyRouter;
}

if (proxyRouterLogger) {
  proxyRouterLogger.debug('ProxyRouter class loaded');
} else {
  console.log('✅ ProxyRouter class loaded');
}