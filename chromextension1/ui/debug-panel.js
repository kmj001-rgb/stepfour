/**
 * Debug Panel UI Controller
 * Manages the debug panel interface and integrates all debugging components
 */

class DebugPanel {
  constructor() {
    this.config = window.StepThreeDebugConfig;
    this.logger = window.StepThreeDebugLogger;
    this.stateInspector = window.StepThreeStateInspector;
    this.networkDebugger = window.StepThreeNetworkDebugger;
    this.performanceProfiler = window.StepThreePerformanceProfiler;
    this.exporter = window.StepThreeDebugExporter;
    
    this.updateInterval = null;
    this.logUpdateInterval = null;
    
    this.init();
  }

  async init() {
    console.log('🐛 Initializing Debug Panel...');
    
    try {
      await this.config.waitForLoad();
      
      this.setupEventListeners();
      this.loadConfiguration();
      this.startLogMonitoring();
      this.updateUI();
      
      console.log('✅ Debug Panel initialized successfully - all components loaded');
    } catch (error) {
      console.error('❌ Debug Panel initialization failed:', error);
      throw error;
    }
  }

  setupEventListeners() {
    document.getElementById('debugToggle').addEventListener('change', (e) => {
      this.toggleDebugMode(e.target.checked);
    });
    
    document.getElementById('debugLevel').addEventListener('change', (e) => {
      this.setDebugLevel(parseInt(e.target.value));
    });
    
    document.querySelectorAll('.component-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        this.toggleComponent(e.target.dataset.component, e.target.checked);
      });
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportSession();
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
      this.clearAllData();
    });
    
    document.getElementById('clearLogsBtn').addEventListener('click', () => {
      this.clearLogs();
    });
    
    document.getElementById('logCategoryFilter').addEventListener('change', (e) => {
      this.filterLogs();
    });
    
    document.getElementById('logSearch').addEventListener('input', (e) => {
      this.filterLogs();
    });
    
    document.getElementById('refreshStateBtn').addEventListener('click', () => {
      this.updateSystemState();
    });
    
    document.getElementById('refreshNetworkBtn').addEventListener('click', () => {
      this.updateNetworkInfo();
    });
    
    document.getElementById('startProfilingBtn').addEventListener('click', () => {
      this.startProfiling();
    });
    
    document.getElementById('stopProfilingBtn').addEventListener('click', () => {
      this.stopProfiling();
    });
    
    document.getElementById('clearErrorsBtn').addEventListener('click', () => {
      this.clearErrors();
    });
    
    // Pagination debug event listeners
    document.getElementById('paginationDetectBtn').addEventListener('click', () => {
      this.detectPagination();
    });
    
    document.getElementById('paginationNextBtn').addEventListener('click', () => {
      this.navigatePaginationNext();
    });
    
    document.getElementById('paginationResetBtn').addEventListener('click', () => {
      this.resetPagination();
    });
    
    document.getElementById('refreshPaginationBtn').addEventListener('click', () => {
      this.refreshPaginationState();
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });
    
    this.logger.addListener((event, data) => {
      if (event === 'log_added') {
        this.addLogEntry(data);
      }
    });
  }

  async loadConfiguration() {
    const config = this.config.getConfig();
    
    document.getElementById('debugToggle').checked = config.enabled;
    document.getElementById('debugLevel').value = config.level;
    
    document.querySelectorAll('.component-toggle').forEach(toggle => {
      const component = toggle.dataset.component;
      toggle.checked = config.components[component] !== false;
    });
    
    this.updateStatus();
  }

  async toggleDebugMode(enabled) {
    await this.config.setEnabled(enabled);
    
    if (enabled) {
      this.networkDebugger.startMonitoring();
      this.logger.success('Debug mode enabled');
    } else {
      this.networkDebugger.stopMonitoring();
      this.logger.info('Debug mode disabled');
    }
    
    this.updateStatus();
  }

  async setDebugLevel(level) {
    await this.config.setLevel(level);
    this.logger.info('Debug level changed:', level);
  }

  async toggleComponent(component, enabled) {
    await this.config.setComponent(component, enabled);
    this.logger.info(`Component ${component} ${enabled ? 'enabled' : 'disabled'}`);
  }

  updateStatus() {
    const enabled = this.config.isEnabled();
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    if (enabled) {
      statusIndicator.classList.add('active');
      statusText.textContent = 'Active';
    } else {
      statusIndicator.classList.remove('active');
      statusText.textContent = 'Inactive';
    }
  }

  startLogMonitoring() {
    if (this.logUpdateInterval) return;
    
    this.logUpdateInterval = setInterval(() => {
      this.updateLogStats();
    }, 2000);
  }

  addLogEntry(entry) {
    const container = document.getElementById('logContainer');
    
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
      container.innerHTML = '';
    }
    
    const logElement = document.createElement('div');
    logElement.className = 'log-entry';
    
    let html = `
      <span class="log-timestamp">${entry.timestamp.full}</span>
      <span class="log-category ${entry.category}">${entry.category}</span>
      <span class="log-message">${this.escapeHtml(entry.message)}</span>
    `;
    
    if (entry.stack) {
      html += `<div class="log-stack">${this.escapeHtml(entry.stack)}</div>`;
    }
    
    logElement.innerHTML = html;
    
    container.insertBefore(logElement, container.firstChild);
    
    if (container.children.length > 100) {
      container.removeChild(container.lastChild);
    }
    
    this.updateLogStats();
  }

  filterLogs() {
    const category = document.getElementById('logCategoryFilter').value;
    const search = document.getElementById('logSearch').value.toLowerCase();
    
    const filters = {};
    if (category) filters.category = category;
    if (search) filters.search = search;
    
    const logs = this.logger.getHistory(filters);
    
    const container = document.getElementById('logContainer');
    container.innerHTML = '';
    
    if (logs.length === 0) {
      container.innerHTML = '<div class="empty-state">No logs match the filters</div>';
      return;
    }
    
    logs.forEach(log => {
      this.addLogEntry(log);
    });
  }

  updateLogStats() {
    const stats = this.logger.getStats();
    
    document.getElementById('logStats').innerHTML = `
      <span>Total: <strong>${stats.total || 0}</strong></span>
      <span>Errors: <strong class="error-count">${stats.errors || 0}</strong></span>
      <span>Warnings: <strong class="warn-count">${stats.warnings || 0}</strong></span>
    `;
  }

  clearLogs() {
    this.logger.clearHistory();
    const container = document.getElementById('logContainer');
    container.innerHTML = '<div class="empty-state">No logs yet. Enable debug mode to start logging.</div>';
    this.updateLogStats();
  }

  async updateSystemState() {
    const systems = this.stateInspector.getSystems();
    const storage = await this.stateInspector.getStorageState();
    const memory = await this.stateInspector.getMemoryUsage();
    const alarms = await this.stateInspector.getAlarms();
    
    document.getElementById('systemsList').innerHTML = systems.length > 0 
      ? systems.map(sys => `
          <div class="state-item">
            <span class="state-label">${sys.name}:</span>
            <span>${sys.status}</span>
          </div>
        `).join('')
      : '<div class="state-item">No systems registered</div>';
    
    const storageSize = {
      local: Object.keys(storage.local).length,
      session: Object.keys(storage.session).length,
      sync: Object.keys(storage.sync).length
    };
    
    document.getElementById('storageInfo').innerHTML = `
      <div class="state-item"><span class="state-label">Local:</span> ${storageSize.local} items</div>
      <div class="state-item"><span class="state-label">Session:</span> ${storageSize.session} items</div>
      <div class="state-item"><span class="state-label">Sync:</span> ${storageSize.sync} items</div>
    `;
    
    if (memory.available) {
      const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
      
      document.getElementById('memoryInfo').innerHTML = `
        <div class="state-item"><span class="state-label">Used:</span> ${usedMB} MB</div>
        <div class="state-item"><span class="state-label">Total:</span> ${totalMB} MB</div>
        <div class="state-item"><span class="state-label">Limit:</span> ${limitMB} MB</div>
      `;
    } else {
      document.getElementById('memoryInfo').innerHTML = '<div class="state-item">Memory info not available</div>';
    }
    
    document.getElementById('alarmsInfo').innerHTML = alarms.length > 0
      ? alarms.map(alarm => `
          <div class="state-item">
            <span class="state-label">${alarm.name}:</span>
            <span>${new Date(alarm.scheduledTime).toLocaleTimeString()}</span>
          </div>
        `).join('')
      : '<div class="state-item">No active alarms</div>';
  }

  updateNetworkInfo() {
    const stats = this.networkDebugger.getStats();
    const messages = this.networkDebugger.getMessageLog({ limit: 20 });
    const ports = this.networkDebugger.getPortLog({ limit: 20 });
    
    document.getElementById('totalMessages').textContent = stats.totalMessages;
    document.getElementById('activePorts').textContent = stats.activeConnections;
    document.getElementById('failedMessages').textContent = stats.failedMessages;
    document.getElementById('avgResponse').textContent = stats.averageResponseTime.toFixed(2) + 'ms';
    
    document.getElementById('messagesTab').innerHTML = messages.length > 0
      ? messages.map(msg => `
          <div class="network-item">
            <div class="network-item-header">
              <span>${msg.id}</span>
              <span class="status-badge ${msg.status}">${msg.status}</span>
            </div>
            <div class="network-item-details">
              ${msg.duration ? `Duration: ${msg.duration.toFixed(2)}ms` : 'Pending...'}
            </div>
          </div>
        `).join('')
      : '<div class="empty-state">No messages</div>';
    
    document.getElementById('portsTab').innerHTML = ports.length > 0
      ? ports.map(port => `
          <div class="network-item">
            <div class="network-item-header">
              <span>${port.name || port.id}</span>
              <span class="status-badge ${port.status === 'connected' ? 'success' : 'error'}">${port.status}</span>
            </div>
            <div class="network-item-details">
              Messages: ${port.messageCount} | Duration: ${(port.duration / 1000).toFixed(2)}s
            </div>
          </div>
        `).join('')
      : '<div class="empty-state">No ports</div>';
  }

  startProfiling() {
    this.performanceProfiler.start();
    document.getElementById('startProfilingBtn').disabled = true;
    document.getElementById('stopProfilingBtn').disabled = false;
    this.logger.success('Performance profiling started');
    
    this.updateInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

  stopProfiling() {
    this.performanceProfiler.stop();
    document.getElementById('startProfilingBtn').disabled = false;
    document.getElementById('stopProfilingBtn').disabled = true;
    this.logger.info('Performance profiling stopped');
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  updatePerformanceMetrics() {
    const summary = this.performanceProfiler.getSummary();
    const metrics = this.performanceProfiler.getMetrics();
    
    document.getElementById('totalMeasures').textContent = summary.totalMeasures;
    document.getElementById('totalFunctions').textContent = summary.totalFunctionCalls;
    document.getElementById('avgExecution').textContent = summary.averageExecutionTime + 'ms';
    document.getElementById('memoryTrend').textContent = summary.memoryTrend;
    
    const slowOps = metrics.slowestFunctions.slice(0, 5);
    document.getElementById('slowOperations').innerHTML = slowOps.length > 0
      ? slowOps.map(op => `
          <div class="operation-item">
            <span class="operation-name">${op.name}</span>
            <span class="operation-duration">${op.duration.toFixed(2)}ms</span>
          </div>
        `).join('')
      : '<div class="empty-state">No operations recorded</div>';
  }

  async updateErrorHistory() {
    const errors = this.logger.getHistory({ level: 'ERROR', limit: 20 });
    
    const container = document.getElementById('errorList');
    
    if (errors.length === 0) {
      container.innerHTML = '<div class="empty-state">No errors recorded</div>';
      return;
    }
    
    container.innerHTML = errors.map(error => `
      <div class="error-item">
        <div class="error-header">
          <span class="error-time">${new Date(error.timestamp.timestamp).toLocaleString()}</span>
        </div>
        <div class="error-message">${this.escapeHtml(error.message)}</div>
        ${error.stack ? `<div class="error-stack">${this.escapeHtml(error.stack)}</div>` : ''}
      </div>
    `).join('');
  }

  /**
   * Clear only error logs from the error history panel
   * This clears all logs which includes errors
   */
  clearErrors() {
    this.clearLogs();
    document.getElementById('errorList').innerHTML = '<div class="empty-state">No errors recorded</div>';
  }

  /**
   * Export the current debug session to a file
   * Includes logs, network activity, performance metrics, and system state
   */
  async exportSession() {
    try {
      const filename = await this.exporter.exportAndDownload();
      this.logger.success('Debug session exported:', filename);
    } catch (error) {
      this.logger.error('Failed to export session:', error);
    }
  }

  /**
   * Clear all debug data including logs, network activity, performance metrics, and state snapshots
   * Prompts user for confirmation before deletion
   */
  clearAllData() {
    if (confirm('Clear all debug data? This action cannot be undone.')) {
      this.logger.clearHistory();
      this.networkDebugger.clearLogs();
      this.performanceProfiler.clear();
      this.stateInspector.clearSnapshots();
      
      this.updateUI();
      this.logger.success('All debug data cleared');
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  async updateUI() {
    await this.updateSystemState();
    this.updateNetworkInfo();
    this.updateLogStats();
    this.updateErrorHistory();
    
    if (this.performanceProfiler.isProfiling) {
      this.updatePerformanceMetrics();
    }
  }

  /**
   * Pagination Debug Methods
   */
  async detectPagination() {
    const resultEl = document.getElementById('paginationDetectionResult');
    try {
      resultEl.textContent = 'Detecting pagination...';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'PAGINATION_DETECT'
      });
      
      if (response && response.success) {
        resultEl.textContent = JSON.stringify(response.detection, null, 2);
        this.refreshPaginationState();
      } else {
        resultEl.textContent = 'Error: ' + (response?.error || 'Detection failed');
      }
    } catch (error) {
      console.error('Pagination detection error:', error);
      resultEl.textContent = 'Error: ' + error.message;
    }
  }

  async navigatePaginationNext() {
    const resultEl = document.getElementById('paginationDetectionResult');
    try {
      resultEl.textContent = 'Navigating to next page...';
      
      const response = await chrome.runtime.sendMessage({
        action: 'PAGINATION_NAVIGATE_NEXT'
      });
      
      if (response && response.success) {
        resultEl.textContent = 'Navigation successful! Page is loading...';
        setTimeout(() => this.refreshPaginationState(), 2000);
      } else {
        resultEl.textContent = 'Error: ' + (response?.error || 'Navigation failed');
      }
    } catch (error) {
      console.error('Pagination navigation error:', error);
      resultEl.textContent = 'Error: ' + error.message;
    }
  }

  async resetPagination() {
    const resultEl = document.getElementById('paginationDetectionResult');
    const stateEl = document.getElementById('paginationStateResult');
    try {
      resultEl.textContent = 'Resetting pagination state...';
      
      const response = await chrome.runtime.sendMessage({
        action: 'PAGINATION_RESET'
      });
      
      if (response && response.success) {
        resultEl.textContent = 'Reset successful!';
        stateEl.textContent = 'State cleared.';
      } else {
        resultEl.textContent = 'Error: ' + (response?.error || 'Reset failed');
      }
    } catch (error) {
      console.error('Pagination reset error:', error);
      resultEl.textContent = 'Error: ' + error.message;
    }
  }

  async refreshPaginationState() {
    const stateEl = document.getElementById('paginationStateResult');
    try {
      stateEl.textContent = 'Loading state...';
      
      const response = await chrome.runtime.sendMessage({
        action: 'PAGINATION_GET_STATE'
      });
      
      if (response && response.success) {
        stateEl.textContent = JSON.stringify(response.state, null, 2);
      } else {
        stateEl.textContent = 'Error: ' + (response?.error || 'Failed to get state');
      }
    } catch (error) {
      console.error('Pagination state error:', error);
      stateEl.textContent = 'Error: ' + error.message;
    }
  }

  /**
   * Safely escape HTML special characters to prevent XSS attacks
   * @param {string} text - Raw text to escape
   * @returns {string} HTML-safe escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const debugPanel = new DebugPanel();

if (typeof window !== 'undefined') {
  window.StepThreeDebug = {
    config: window.StepThreeDebugConfig,
    logger: window.StepThreeDebugLogger,
    stateInspector: window.StepThreeStateInspector,
    networkDebugger: window.StepThreeNetworkDebugger,
    performanceProfiler: window.StepThreePerformanceProfiler,
    exporter: window.StepThreeDebugExporter,
    panel: debugPanel
  };
  
  console.log('%c🐛 StepThree Debug System Ready - Access via: window.StepThreeDebug', 'color: #667eea; font-size: 14px; font-weight: bold;');
}
