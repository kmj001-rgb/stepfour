/**
 * Debug Exporter
 * Export comprehensive debug information
 * 
 * Features:
 * - Export complete debug session as JSON
 * - System state snapshot
 * - Error history
 * - Performance metrics
 * - Log history
 * - Network activity
 */

class DebugExporter {
  constructor(config = null, logger = null, stateInspector = null, networkDebugger = null, performanceProfiler = null) {
    this.config = config || (typeof window !== 'undefined' ? window.StepThreeDebugConfig : null);
    this.logger = logger || (typeof window !== 'undefined' ? window.StepThreeDebugLogger : null);
    this.stateInspector = stateInspector || (typeof window !== 'undefined' ? window.StepThreeStateInspector : null);
    this.networkDebugger = networkDebugger || (typeof window !== 'undefined' ? window.StepThreeNetworkDebugger : null);
    this.performanceProfiler = performanceProfiler || (typeof window !== 'undefined' ? window.StepThreePerformanceProfiler : null);
  }

  /**
   * Export complete debug session
   */
  async exportSession() {
    const session = {
      meta: {
        exportTime: new Date().toISOString(),
        exportTimestamp: Date.now(),
        extensionVersion: this._getExtensionVersion(),
        browserInfo: this._getBrowserInfo()
      },
      config: this.config ? this.config.getConfig() : null,
      logs: this.logger ? this.logger.getHistory() : [],
      logStats: this.logger ? this.logger.getStats() : {},
      state: this.stateInspector ? await this.stateInspector.getSnapshot() : null,
      network: this.networkDebugger ? this.networkDebugger.exportData() : null,
      performance: this.performanceProfiler ? this.performanceProfiler.exportReport() : null,
      errors: this._getErrorHistory()
    };
    
    return session;
  }

  /**
   * Export as JSON string
   */
  async exportAsJSON(pretty = true) {
    const session = await this.exportSession();
    return pretty ? JSON.stringify(session, null, 2) : JSON.stringify(session);
  }

  /**
   * Export and download as file
   */
  async exportAndDownload(filename = null) {
    const defaultFilename = `stepthree-debug-${Date.now()}.json`;
    const finalFilename = filename || defaultFilename;
    
    const jsonData = await this.exportAsJSON();
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    if (this.logger) {
      this.logger.success('Debug session exported:', finalFilename);
    }
    
    return finalFilename;
  }

  /**
   * Export system state snapshot
   */
  async exportStateSnapshot() {
    if (!this.stateInspector) {
      return { error: 'State inspector not available' };
    }
    
    return await this.stateInspector.getSnapshot();
  }

  /**
   * Export error history
   */
  exportErrorHistory() {
    return this._getErrorHistory();
  }

  /**
   * Export performance metrics
   */
  exportPerformanceMetrics() {
    if (!this.performanceProfiler) {
      return { error: 'Performance profiler not available' };
    }
    
    return this.performanceProfiler.exportReport();
  }

  /**
   * Export log history
   */
  exportLogHistory(filters = {}) {
    if (!this.logger) {
      return { error: 'Logger not available' };
    }
    
    return {
      exportTime: new Date().toISOString(),
      filters: filters,
      logs: this.logger.getHistory(filters),
      stats: this.logger.getStats()
    };
  }

  /**
   * Export network activity
   */
  exportNetworkActivity() {
    if (!this.networkDebugger) {
      return { error: 'Network debugger not available' };
    }
    
    return this.networkDebugger.exportData();
  }

  /**
   * Export as CSV
   */
  async exportAsCSV(dataType = 'logs') {
    let csvData = '';
    
    if (dataType === 'logs' && this.logger) {
      csvData = this.logger.exportLogs('csv');
    } else if (dataType === 'performance' && this.performanceProfiler) {
      csvData = this._performanceToCSV();
    } else if (dataType === 'network' && this.networkDebugger) {
      csvData = this._networkToCSV();
    }
    
    return csvData;
  }

  /**
   * Convert performance data to CSV
   */
  _performanceToCSV() {
    if (!this.performanceProfiler) return '';
    
    const report = this.performanceProfiler.exportReport();
    const headers = ['Type', 'Name', 'Duration', 'Timestamp'];
    const rows = [];
    
    report.data.functionTimings.forEach(timing => {
      rows.push([
        'Function',
        timing.name,
        timing.duration,
        new Date(timing.timestamp).toISOString()
      ]);
    });
    
    report.data.measures.forEach(measure => {
      rows.push([
        'Measure',
        measure.name,
        measure.duration,
        new Date(measure.timestamp).toISOString()
      ]);
    });
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Convert network data to CSV
   */
  _networkToCSV() {
    if (!this.networkDebugger) return '';
    
    const data = this.networkDebugger.exportData();
    const headers = ['Type', 'ID', 'Status', 'Duration', 'Timestamp'];
    const rows = [];
    
    data.messages.forEach(msg => {
      rows.push([
        'Message',
        msg.id,
        msg.status,
        msg.duration || 'N/A',
        new Date(msg.timestamp).toISOString()
      ]);
    });
    
    data.ports.forEach(port => {
      rows.push([
        'Port',
        port.id,
        port.status,
        port.duration || 'N/A',
        new Date(port.connectedAt).toISOString()
      ]);
    });
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Get error history from storage
   */
  _getErrorHistory() {
    const errors = [];
    
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['errorLog'], (result) => {
          if (result.errorLog) {
            errors.push(...result.errorLog);
          }
        });
      }
    } catch (error) {
      console.error('Failed to get error history:', error);
    }
    
    // Also get errors from logger
    if (this.logger) {
      const logErrors = this.logger.getHistory({ level: 'ERROR' });
      errors.push(...logErrors);
    }
    
    return errors;
  }

  /**
   * Get extension version
   */
  _getExtensionVersion() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const manifest = chrome.runtime.getManifest();
        return manifest.version;
      }
    } catch (error) {
      return 'unknown';
    }
    return 'unknown';
  }

  /**
   * Get browser info
   */
  _getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      onLine: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled
    };
  }

  /**
   * Create shareable debug report (sanitized)
   */
  async createShareableReport() {
    const session = await this.exportSession();
    
    // Sanitize sensitive data
    const sanitized = this._sanitizeData(session);
    
    return {
      meta: sanitized.meta,
      summary: {
        totalLogs: sanitized.logStats?.total || 0,
        errors: sanitized.logStats?.errors || 0,
        warnings: sanitized.logStats?.warnings || 0,
        networkCalls: sanitized.network?.stats?.totalMessages || 0,
        performanceMetrics: sanitized.performance?.metrics?.stats || {}
      },
      recentErrors: sanitized.logs?.filter(log => log.level === 'ERROR').slice(0, 10) || [],
      performanceSummary: sanitized.performance?.metrics?.stats || {},
      configSnapshot: {
        enabled: sanitized.config?.enabled,
        level: sanitized.config?.level,
        components: sanitized.config?.components
      }
    };
  }

  /**
   * Sanitize data for sharing
   */
  _sanitizeData(data) {
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive patterns
    const sensitivePatterns = [
      /apikey/i,
      /api[_-]?key/i,
      /token/i,
      /password/i,
      /secret/i,
      /auth/i
    ];
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      for (const key in obj) {
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
      
      return obj;
    };
    
    return sanitizeObject(sanitized);
  }

  /**
   * Export minimal summary (for quick sharing)
   */
  async exportSummary() {
    return {
      timestamp: new Date().toISOString(),
      extension: {
        version: this._getExtensionVersion(),
        browser: this._getBrowserInfo()
      },
      stats: {
        logs: this.logger?.getStats() || {},
        network: this.networkDebugger?.getStats() || {},
        performance: this.performanceProfiler?.getSummary() || {}
      },
      config: this.config?.getConfig() || {}
    };
  }

  /**
   * Import debug session
   */
  async importSession(jsonData) {
    try {
      const session = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      // Import config
      if (session.config && this.config) {
        await this.config.updateConfig(session.config);
      }
      
      if (this.logger) {
        this.logger.success('Debug session imported successfully');
      }
      
      return { success: true, session: session };
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to import debug session:', error);
      }
      return { success: false, error: error.message };
    }
  }
}

// Create global instance
const debugExporter = new DebugExporter(
  typeof window !== 'undefined' ? window.StepThreeDebugConfig : null,
  typeof window !== 'undefined' ? window.StepThreeDebugLogger : null,
  typeof window !== 'undefined' ? window.StepThreeStateInspector : null,
  typeof window !== 'undefined' ? window.StepThreeNetworkDebugger : null,
  typeof window !== 'undefined' ? window.StepThreePerformanceProfiler : null
);

// Make available globally
if (typeof window !== 'undefined') {
  window.StepThreeDebugExporter = debugExporter;
}
