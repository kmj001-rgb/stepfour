/**
 * Debug Configuration System
 * Centralized debug settings with persistence and hot-reload capability
 * 
 * Features:
 * - Global debug mode toggle
 * - Debug level control (verbose, normal, minimal)
 * - Component-specific debug flags
 * - Persistent storage
 * - Hot-reload capability
 * - Event-based configuration updates
 */

class DebugConfig {
  static DEBUG_LEVELS = {
    MINIMAL: 0,
    NORMAL: 1,
    VERBOSE: 2
  };

  static COMPONENTS = {
    BACKGROUND: 'background',
    CONTENT: 'content',
    UI: 'ui',
    NETWORK: 'network',
    PERFORMANCE: 'performance',
    STATE: 'state',
    STORAGE: 'storage'
  };

  static STORAGE_KEY = 'stepthree_debug_config';
  
  static DEFAULT_CONFIG = {
    enabled: false,
    level: this.DEBUG_LEVELS.NORMAL,
    components: {
      background: true,
      content: true,
      ui: true,
      network: true,
      performance: true,
      state: true,
      storage: true
    },
    features: {
      logHistory: true,
      stackTraces: true,
      coloredOutput: true,
      networkTracking: true,
      performanceProfiling: true,
      stateInspection: true,
      exportLogs: true
    },
    limits: {
      maxLogEntries: 1000,
      maxPerformanceEntries: 500,
      maxNetworkEntries: 500
    }
  };

  constructor() {
    this.config = { ...DebugConfig.DEFAULT_CONFIG };
    this.listeners = new Set();
    this.loaded = false;
    this.loadPromise = this.load();
  }

  /**
   * Load configuration from storage
   */
  async load() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(DebugConfig.STORAGE_KEY);
        if (result[DebugConfig.STORAGE_KEY]) {
          this.config = { ...DebugConfig.DEFAULT_CONFIG, ...result[DebugConfig.STORAGE_KEY] };
        }
      }
      this.loaded = true;
      return this.config;
    } catch (error) {
      console.error('[DebugConfig] Failed to load config:', error);
      this.loaded = true;
      return this.config;
    }
  }

  /**
   * Save configuration to storage
   */
  async save() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ [DebugConfig.STORAGE_KEY]: this.config });
        this.notifyListeners('config_updated', this.config);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[DebugConfig] Failed to save config:', error);
      return false;
    }
  }

  /**
   * Wait for config to be loaded
   */
  async waitForLoad() {
    if (this.loaded) return this.config;
    return await this.loadPromise;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Check if debug mode is enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Get debug level
   */
  getLevel() {
    return this.config.level;
  }

  /**
   * Check if component debug is enabled
   */
  isComponentEnabled(component) {
    return this.config.enabled && this.config.components[component] !== false;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.config.enabled && this.config.features[feature] !== false;
  }

  /**
   * Set global debug mode
   */
  async setEnabled(enabled) {
    this.config.enabled = enabled;
    await this.save();
  }

  /**
   * Set debug level
   */
  async setLevel(level) {
    if (Object.values(DebugConfig.DEBUG_LEVELS).includes(level)) {
      this.config.level = level;
      await this.save();
    }
  }

  /**
   * Set component debug flag
   */
  async setComponent(component, enabled) {
    if (this.config.components.hasOwnProperty(component)) {
      this.config.components[component] = enabled;
      await this.save();
    }
  }

  /**
   * Set feature flag
   */
  async setFeature(feature, enabled) {
    if (this.config.features.hasOwnProperty(feature)) {
      this.config.features[feature] = enabled;
      await this.save();
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    await this.save();
  }

  /**
   * Reset to defaults
   */
  async reset() {
    this.config = { ...DebugConfig.DEFAULT_CONFIG };
    await this.save();
  }

  /**
   * Register listener for config changes
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of changes
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[DebugConfig] Listener error:', error);
      }
    });
  }

  /**
   * Get limit value
   */
  getLimit(limitName) {
    return this.config.limits[limitName] || 0;
  }

  /**
   * Export configuration as JSON
   */
  export() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  async import(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.config = { ...DebugConfig.DEFAULT_CONFIG, ...imported };
      await this.save();
      return true;
    } catch (error) {
      console.error('[DebugConfig] Import failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const debugConfig = new DebugConfig();

// Make available globally
if (typeof window !== 'undefined') {
  window.StepThreeDebugConfig = debugConfig;
}
