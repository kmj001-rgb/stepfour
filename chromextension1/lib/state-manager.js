// state-manager.js - Service Worker State Persistence for MV3 Compliance
// PHASE 3 FIX: Provides chrome.storage.session-backed state management
// Ensures state persists across service worker restarts

console.log('🔄 Loading State Manager for MV3 Compliance...');

/**
 * ServiceWorkerStateManager
 * Manages service worker state using chrome.storage.session
 * Prevents data loss when service worker terminates
 */
class ServiceWorkerStateManager {
  constructor() {
    this.STORAGE_KEY = 'stepthree_sw_state';
    this.initialized = false;
  }

  /**
   * Initialize state manager and load existing state
   */
  async initialize() {
    if (this.initialized) {
      return await this.getState();
    }

    try {
      const state = await this.getState();
      
      // Increment restart count
      state.restartCount = (state.restartCount || 0) + 1;
      const timestamp = Date.now();
      state.restartTimestamps = state.restartTimestamps || [];
      state.restartTimestamps.push(timestamp);
      
      // Keep only last 10 restart timestamps
      if (state.restartTimestamps.length > 10) {
        state.restartTimestamps = state.restartTimestamps.slice(-10);
      }
      
      await this.setState(state);
      this.initialized = true;
      
      console.log(`🔄 Service worker restart #${state.restartCount}`, {
        lastRestart: new Date(timestamp).toISOString(),
        totalRestarts: state.restartCount
      });
      
      return state;
    } catch (error) {
      console.error('❌ Failed to initialize state manager:', error);
      return this._getDefaultState();
    }
  }

  /**
   * Get current state from storage
   */
  async getState() {
    try {
      const result = await chrome.storage.session.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || this._getDefaultState();
    } catch (error) {
      console.error('❌ Failed to get state:', error);
      return this._getDefaultState();
    }
  }

  /**
   * Set entire state
   */
  async setState(state) {
    try {
      await chrome.storage.session.set({ [this.STORAGE_KEY]: state });
      return state;
    } catch (error) {
      console.error('❌ Failed to set state:', error);
      return null;
    }
  }

  /**
   * Update partial state (merge with existing)
   */
  async updateState(updates) {
    try {
      const currentState = await this.getState();
      const newState = { ...currentState, ...updates };
      await this.setState(newState);
      return newState;
    } catch (error) {
      console.error('❌ Failed to update state:', error);
      return null;
    }
  }

  /**
   * Get default initial state
   */
  _getDefaultState() {
    return {
      restartCount: 0,
      restartTimestamps: [],
      keepaliveCount: 0,
      keepaliveFailures: 0,
      lastKeepalive: null,
      messageProcessingTimes: [],
      connectionMetrics: {
        activePorts: 0,
        totalConnections: 0,
        disconnections: 0,
        reconnectionAttempts: 0,
        connectionErrors: 0
      },
      initialized: Date.now()
    };
  }

  /**
   * Increment restart count
   */
  async incrementRestartCount() {
    const state = await this.getState();
    state.restartCount = (state.restartCount || 0) + 1;
    state.restartTimestamps = state.restartTimestamps || [];
    state.restartTimestamps.push(Date.now());
    
    if (state.restartTimestamps.length > 10) {
      state.restartTimestamps = state.restartTimestamps.slice(-10);
    }
    
    await this.setState(state);
    return state.restartCount;
  }

  /**
   * Update connection metrics
   */
  async updateConnectionMetrics(updates) {
    const state = await this.getState();
    state.connectionMetrics = {
      ...state.connectionMetrics,
      ...updates
    };
    await this.setState(state);
    return state.connectionMetrics;
  }

  /**
   * Record keepalive event
   */
  async recordKeepalive(success = true) {
    const state = await this.getState();
    state.keepaliveCount = (state.keepaliveCount || 0) + 1;
    
    if (success) {
      state.lastKeepalive = Date.now();
    } else {
      state.keepaliveFailures = (state.keepaliveFailures || 0) + 1;
    }
    
    await this.setState(state);
    return {
      count: state.keepaliveCount,
      failures: state.keepaliveFailures,
      successRate: state.keepaliveCount > 0 
        ? ((state.keepaliveCount - state.keepaliveFailures) / state.keepaliveCount * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Add message processing time sample
   */
  async addMessageProcessingTime(timeMs) {
    const state = await this.getState();
    state.messageProcessingTimes = state.messageProcessingTimes || [];
    state.messageProcessingTimes.push(timeMs);
    
    // Keep only last 100 samples
    if (state.messageProcessingTimes.length > 100) {
      state.messageProcessingTimes = state.messageProcessingTimes.slice(-100);
    }
    
    await this.setState(state);
  }

  /**
   * Get statistics
   */
  async getStats() {
    const state = await this.getState();
    const avgProcessingTime = state.messageProcessingTimes.length > 0
      ? state.messageProcessingTimes.reduce((a, b) => a + b, 0) / state.messageProcessingTimes.length
      : 0;
    
    return {
      restartCount: state.restartCount,
      lastRestart: state.restartTimestamps[state.restartTimestamps.length - 1],
      keepalive: {
        count: state.keepaliveCount,
        failures: state.keepaliveFailures,
        lastKeepalive: state.lastKeepalive
      },
      connections: state.connectionMetrics,
      messageProcessing: {
        samples: state.messageProcessingTimes.length,
        averageMs: Math.round(avgProcessingTime)
      }
    };
  }

  /**
   * Clear all state (for testing/debugging)
   */
  async clearState() {
    try {
      await chrome.storage.session.remove(this.STORAGE_KEY);
      this.initialized = false;
      console.log('✅ State cleared');
    } catch (error) {
      console.error('❌ Failed to clear state:', error);
    }
  }
}

// Make available globally
if (typeof globalThis !== 'undefined') {
  globalThis.ServiceWorkerStateManager = ServiceWorkerStateManager;
}

if (typeof window !== 'undefined') {
  window.ServiceWorkerStateManager = ServiceWorkerStateManager;
}

console.log('✅ State Manager loaded successfully');
