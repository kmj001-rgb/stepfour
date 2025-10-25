/**
 * State Inspector
 * Utilities to inspect extension state and resources
 * 
 * Features:
 * - Inspect all registered systems
 * - Chrome storage state (session, local, sync)
 * - Active alarms
 * - Active downloads
 * - Connection ports
 * - Memory usage
 */

class StateInspector {
  constructor(config = null, logger = null) {
    this.config = config || (typeof window !== 'undefined' ? window.StepThreeDebugConfig : null);
    this.logger = logger || (typeof window !== 'undefined' ? window.StepThreeDebugLogger : null);
    this.activePorts = new Map();
    this.registeredSystems = new Map();
    this.snapshots = [];
    this.maxSnapshots = 50;
  }

  /**
   * Register a system for inspection
   */
  registerSystem(name, system) {
    this.registeredSystems.set(name, {
      name: name,
      instance: system,
      registeredAt: Date.now(),
      status: 'active'
    });
    
    if (this.logger) {
      this.logger.state('System registered:', name);
    }
  }

  /**
   * Unregister a system
   */
  unregisterSystem(name) {
    const system = this.registeredSystems.get(name);
    if (system) {
      system.status = 'inactive';
      system.unregisteredAt = Date.now();
    }
    
    if (this.logger) {
      this.logger.state('System unregistered:', name);
    }
  }

  /**
   * Get all registered systems
   */
  getSystems() {
    const systems = [];
    
    this.registeredSystems.forEach((system, name) => {
      systems.push({
        name: system.name,
        status: system.status,
        registeredAt: system.registeredAt,
        unregisteredAt: system.unregisteredAt,
        uptime: system.status === 'active' ? Date.now() - system.registeredAt : system.unregisteredAt - system.registeredAt
      });
    });
    
    return systems;
  }

  /**
   * Track port connection
   */
  trackPort(port, metadata = {}) {
    const portId = port.name || `port-${Date.now()}`;
    
    this.activePorts.set(portId, {
      id: portId,
      name: port.name,
      sender: port.sender,
      connectedAt: Date.now(),
      metadata: metadata,
      messageCount: 0,
      status: 'connected'
    });
    
    // Track disconnection
    port.onDisconnect.addListener(() => {
      const portInfo = this.activePorts.get(portId);
      if (portInfo) {
        portInfo.status = 'disconnected';
        portInfo.disconnectedAt = Date.now();
        portInfo.duration = portInfo.disconnectedAt - portInfo.connectedAt;
      }
    });
    
    // Track messages
    const originalPostMessage = port.postMessage.bind(port);
    port.postMessage = (message) => {
      const portInfo = this.activePorts.get(portId);
      if (portInfo) {
        portInfo.messageCount++;
      }
      originalPostMessage(message);
    };
    
    if (this.logger) {
      this.logger.network('Port connected:', portId);
    }
  }

  /**
   * Get active ports
   */
  getActivePorts() {
    const ports = [];
    
    this.activePorts.forEach((port, id) => {
      ports.push({
        id: port.id,
        name: port.name,
        status: port.status,
        connectedAt: port.connectedAt,
        disconnectedAt: port.disconnectedAt,
        duration: port.duration || (Date.now() - port.connectedAt),
        messageCount: port.messageCount,
        metadata: port.metadata
      });
    });
    
    return ports;
  }

  /**
   * Get chrome.storage state
   */
  async getStorageState() {
    const state = {
      local: {},
      session: {},
      sync: {},
      managed: {}
    };
    
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Local storage
        if (chrome.storage.local) {
          state.local = await chrome.storage.local.get(null);
        }
        
        // Session storage
        if (chrome.storage.session) {
          state.session = await chrome.storage.session.get(null);
        }
        
        // Sync storage
        if (chrome.storage.sync) {
          try {
            state.sync = await chrome.storage.sync.get(null);
          } catch (error) {
            state.sync = { error: 'Sync storage not available' };
          }
        }
        
        // Managed storage
        if (chrome.storage.managed) {
          try {
            state.managed = await chrome.storage.managed.get(null);
          } catch (error) {
            state.managed = { error: 'Managed storage not available' };
          }
        }
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to get storage state:', error);
      }
    }
    
    return state;
  }

  /**
   * Get active alarms
   */
  async getAlarms() {
    const alarms = [];
    
    try {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        const chromeAlarms = await chrome.alarms.getAll();
        
        chromeAlarms.forEach(alarm => {
          alarms.push({
            name: alarm.name,
            scheduledTime: alarm.scheduledTime,
            periodInMinutes: alarm.periodInMinutes
          });
        });
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to get alarms:', error);
      }
    }
    
    return alarms;
  }

  /**
   * Get active downloads
   */
  async getDownloads() {
    const downloads = [];
    
    try {
      if (typeof chrome !== 'undefined' && chrome.downloads) {
        const query = { state: 'in_progress' };
        const chromeDownloads = await chrome.downloads.search(query);
        
        chromeDownloads.forEach(download => {
          downloads.push({
            id: download.id,
            url: download.url,
            filename: download.filename,
            bytesReceived: download.bytesReceived,
            totalBytes: download.totalBytes,
            state: download.state,
            paused: download.paused,
            startTime: download.startTime
          });
        });
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to get downloads:', error);
      }
    }
    
    return downloads;
  }

  /**
   * Get memory usage
   */
  async getMemoryUsage() {
    const memory = {
      jsHeapSizeLimit: 0,
      totalJSHeapSize: 0,
      usedJSHeapSize: 0,
      available: false
    };
    
    try {
      if (typeof performance !== 'undefined' && performance.memory) {
        memory.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
        memory.totalJSHeapSize = performance.memory.totalJSHeapSize;
        memory.usedJSHeapSize = performance.memory.usedJSHeapSize;
        memory.available = true;
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to get memory usage:', error);
      }
    }
    
    return memory;
  }

  /**
   * Get complete state snapshot
   */
  async getSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      systems: this.getSystems(),
      ports: this.getActivePorts(),
      storage: await this.getStorageState(),
      alarms: await this.getAlarms(),
      downloads: await this.getDownloads(),
      memory: await this.getMemoryUsage(),
      extension: this._getExtensionInfo()
    };
    
    // Store snapshot
    this.snapshots.unshift(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(0, this.maxSnapshots);
    }
    
    if (this.logger) {
      this.logger.state('State snapshot taken');
    }
    
    return snapshot;
  }

  /**
   * Get extension info
   */
  _getExtensionInfo() {
    const info = {
      available: false
    };
    
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const manifest = chrome.runtime.getManifest();
        info.name = manifest.name;
        info.version = manifest.version;
        info.id = chrome.runtime.id;
        info.available = true;
      }
    } catch (error) {
      // Not in extension context
    }
    
    return info;
  }

  /**
   * Get snapshot history
   */
  getSnapshotHistory(limit = 10) {
    return this.snapshots.slice(0, limit);
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(snapshot1, snapshot2) {
    const diff = {
      timestamp: {
        from: snapshot1.timestamp,
        to: snapshot2.timestamp,
        duration: snapshot2.timestamp - snapshot1.timestamp
      },
      systems: {
        added: [],
        removed: [],
        changed: []
      },
      memory: {
        jsHeapChange: snapshot2.memory.usedJSHeapSize - snapshot1.memory.usedJSHeapSize,
        totalHeapChange: snapshot2.memory.totalJSHeapSize - snapshot1.memory.totalJSHeapSize
      },
      storage: {
        local: this._compareObjects(snapshot1.storage.local, snapshot2.storage.local),
        session: this._compareObjects(snapshot1.storage.session, snapshot2.storage.session)
      }
    };
    
    return diff;
  }

  /**
   * Compare two objects for differences
   */
  _compareObjects(obj1, obj2) {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    keys2.forEach(key => {
      if (!keys1.includes(key)) {
        changes.added.push(key);
      } else if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        changes.modified.push(key);
      }
    });
    
    keys1.forEach(key => {
      if (!keys2.includes(key)) {
        changes.removed.push(key);
      }
    });
    
    return changes;
  }

  /**
   * Clear snapshots
   */
  clearSnapshots() {
    this.snapshots = [];
    
    if (this.logger) {
      this.logger.state('Snapshots cleared');
    }
  }

  /**
   * Export state
   */
  async exportState() {
    const snapshot = await this.getSnapshot();
    return JSON.stringify(snapshot, null, 2);
  }
}

// Create global instance
const stateInspector = new StateInspector(
  typeof window !== 'undefined' ? window.StepThreeDebugConfig : null,
  typeof window !== 'undefined' ? window.StepThreeDebugLogger : null
);

// Make available globally
if (typeof window !== 'undefined') {
  window.StepThreeStateInspector = stateInspector;
}
