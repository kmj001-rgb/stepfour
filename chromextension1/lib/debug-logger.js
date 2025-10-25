/**
 * Enhanced Debug Logger
 * Extends existing Logger with advanced debugging capabilities
 * 
 * Features:
 * - Category/tag-based logging
 * - Stack trace capture
 * - Millisecond precision timestamps
 * - Colored console output
 * - Log history buffer
 * - Export functionality
 */

class DebugLogger {
  static CATEGORIES = {
    NETWORK: { name: 'NETWORK', color: '#3498db', emoji: '🌐' },
    STATE: { name: 'STATE', color: '#9b59b6', emoji: '📊' },
    PERFORMANCE: { name: 'PERFORMANCE', color: '#e67e22', emoji: '⚡' },
    UI: { name: 'UI', color: '#1abc9c', emoji: '🎨' },
    STORAGE: { name: 'STORAGE', color: '#34495e', emoji: '💾' },
    CONTENT: { name: 'CONTENT', color: '#16a085', emoji: '📄' },
    BACKGROUND: { name: 'BACKGROUND', color: '#8e44ad', emoji: '🔧' },
    ERROR: { name: 'ERROR', color: '#e74c3c', emoji: '❌' },
    WARN: { name: 'WARN', color: '#f39c12', emoji: '⚠️' },
    SUCCESS: { name: 'SUCCESS', color: '#27ae60', emoji: '✅' },
    DEBUG: { name: 'DEBUG', color: '#95a5a6', emoji: '🐛' }
  };

  static LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  constructor(config = null) {
    this.config = config || (typeof window !== 'undefined' ? window.StepThreeDebugConfig : null);
    this.logHistory = [];
    this.maxHistorySize = 1000;
    this.listeners = new Set();
    
    // Performance monitoring
    this.startTime = Date.now();
  }

  /**
   * Check if logging is enabled for category
   */
  _shouldLog(category, level = DebugLogger.LOG_LEVELS.INFO) {
    if (!this.config) return true;
    
    const config = this.config.getConfig();
    if (!config.enabled) return false;
    
    // Check component-specific flag
    const componentMap = {
      NETWORK: 'network',
      STATE: 'state',
      PERFORMANCE: 'performance',
      UI: 'ui',
      STORAGE: 'storage',
      CONTENT: 'content',
      BACKGROUND: 'background'
    };
    
    const component = componentMap[category];
    if (component && config.components[component] === false) {
      return false;
    }
    
    return true;
  }

  /**
   * Get formatted timestamp with milliseconds precision for accurate log timing
   * @returns {Object} Timestamp object with full time, ISO format, elapsed time, and raw timestamp
   * @private
   */
  _getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const elapsed = Date.now() - this.startTime;
    
    return {
      full: `${hours}:${minutes}:${seconds}.${ms}`,
      iso: now.toISOString(),
      elapsed: elapsed,
      timestamp: now.getTime()
    };
  }

  /**
   * Capture stack trace for error tracking and debugging
   * Removes internal method calls from the trace for cleaner output
   * @returns {string|null} Stack trace string or null if unavailable
   * @private
   */
  _captureStackTrace() {
    const stack = new Error().stack;
    if (!stack) return null;
    
    const lines = stack.split('\n');
    // Remove first 3 lines (Error, _captureStackTrace, calling method)
    return lines.slice(3).join('\n');
  }

  /**
   * Format log entry
   */
  _formatLogEntry(category, level, args, options = {}) {
    const timestamp = this._getTimestamp();
    const categoryInfo = DebugLogger.CATEGORIES[category] || DebugLogger.CATEGORIES.DEBUG;
    const levelName = Object.keys(DebugLogger.LOG_LEVELS).find(k => DebugLogger.LOG_LEVELS[k] === level) || 'INFO';
    
    const entry = {
      id: `${timestamp.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: timestamp,
      category: categoryInfo.name,
      level: levelName,
      message: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' '),
      args: args,
      stack: options.captureStack ? this._captureStackTrace() : null,
      metadata: options.metadata || {}
    };
    
    return entry;
  }

  /**
   * Add entry to history buffer
   */
  _addToHistory(entry) {
    this.logHistory.unshift(entry);
    
    // Maintain max size
    const maxSize = this.config ? this.config.getLimit('maxLogEntries') : this.maxHistorySize;
    if (this.logHistory.length > maxSize) {
      this.logHistory = this.logHistory.slice(0, maxSize);
    }
    
    // Notify listeners
    this.notifyListeners('log_added', entry);
  }

  /**
   * Output colored console log
   */
  _outputColored(entry) {
    const categoryInfo = DebugLogger.CATEGORIES[entry.category] || DebugLogger.CATEGORIES.DEBUG;
    const useColors = this.config ? this.config.isFeatureEnabled('coloredOutput') : true;
    
    if (useColors && typeof window !== 'undefined') {
      const styles = [
        `color: ${categoryInfo.color}; font-weight: bold;`,
        'color: #666; font-size: 0.9em;',
        'color: inherit;'
      ];
      
      console.log(
        `%c${categoryInfo.emoji} [${entry.category}]%c ${entry.timestamp.full}%c ${entry.message}`,
        ...styles,
        ...(entry.args.filter(arg => typeof arg === 'object'))
      );
    } else {
      console.log(`[${entry.timestamp.full}] [${entry.category}] ${entry.message}`, ...entry.args);
    }
    
    // Output stack trace if present
    if (entry.stack) {
      console.log('Stack trace:', entry.stack);
    }
  }

  /**
   * Main logging method
   */
  log(category, level, ...args) {
    const options = typeof args[args.length - 1] === 'object' && args[args.length - 1]._debugOptions 
      ? args.pop() 
      : {};
    
    if (!this._shouldLog(category, level)) return;
    
    const entry = this._formatLogEntry(category, level, args, options);
    
    // Add to history if enabled
    if (!this.config || this.config.isFeatureEnabled('logHistory')) {
      this._addToHistory(entry);
    }
    
    // Output to console
    this._outputColored(entry);
  }

  /**
   * Category-specific logging methods
   */
  network(...args) {
    this.log('NETWORK', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  state(...args) {
    this.log('STATE', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  performance(...args) {
    this.log('PERFORMANCE', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  ui(...args) {
    this.log('UI', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  storage(...args) {
    this.log('STORAGE', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  content(...args) {
    this.log('CONTENT', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  background(...args) {
    this.log('BACKGROUND', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  debug(...args) {
    this.log('DEBUG', DebugLogger.LOG_LEVELS.DEBUG, ...args);
  }

  info(...args) {
    this.log('DEBUG', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  warn(...args) {
    this.log('WARN', DebugLogger.LOG_LEVELS.WARN, ...args);
  }

  error(...args) {
    const options = { captureStack: true, _debugOptions: true };
    this.log('ERROR', DebugLogger.LOG_LEVELS.ERROR, ...args, options);
  }

  success(...args) {
    this.log('SUCCESS', DebugLogger.LOG_LEVELS.INFO, ...args);
  }

  /**
   * Get log history
   */
  getHistory(filters = {}) {
    let history = [...this.logHistory];
    
    if (filters.category) {
      history = history.filter(entry => entry.category === filters.category);
    }
    
    if (filters.level) {
      const minLevel = DebugLogger.LOG_LEVELS[filters.level] || 0;
      history = history.filter(entry => DebugLogger.LOG_LEVELS[entry.level] >= minLevel);
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      history = history.filter(entry => 
        entry.message.toLowerCase().includes(search)
      );
    }
    
    if (filters.limit) {
      history = history.slice(0, filters.limit);
    }
    
    return history;
  }

  /**
   * Clear log history
   */
  clearHistory() {
    this.logHistory = [];
    this.notifyListeners('history_cleared');
  }

  /**
   * Export logs in the specified format for external analysis or reporting
   * @param {string} format - Export format: 'json' or 'csv' (default: 'json')
   * @returns {string} Formatted log data as a string
   */
  exportLogs(format = 'json') {
    const data = {
      exportTime: new Date().toISOString(),
      totalLogs: this.logHistory.length,
      logs: this.logHistory
    };
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      const headers = ['Timestamp', 'Category', 'Level', 'Message'];
      const rows = this.logHistory.map(entry => [
        entry.timestamp.iso,
        entry.category,
        entry.level,
        entry.message.replace(/"/g, '""')
      ]);
      
      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
    }
    
    return JSON.stringify(data);
  }

  /**
   * Register listener for log events to enable real-time log monitoring
   * @param {Function} callback - Function to call when log events occur (receives event type and data)
   * @returns {Function} Unsubscribe function to remove the listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[DebugLogger] Listener error:', error);
      }
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      total: this.logHistory.length,
      byCategory: {},
      byLevel: {},
      errors: 0,
      warnings: 0
    };
    
    this.logHistory.forEach(entry => {
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
      
      if (entry.level === 'ERROR') stats.errors++;
      if (entry.level === 'WARN') stats.warnings++;
    });
    
    return stats;
  }
}

// Create global instance
const debugLogger = new DebugLogger(typeof window !== 'undefined' ? window.StepThreeDebugConfig : null);

// Make available globally
if (typeof window !== 'undefined') {
  window.StepThreeDebugLogger = debugLogger;
}
