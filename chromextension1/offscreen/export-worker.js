// export-worker.js - Secure offscreen worker for heavy export operations
// Runs in isolated context for security and performance
// Handles XLSX, CSV, and JSON export generation

console.log('🚀 StepThree Export Worker - Offscreen Document Initialized');

/**
 * Secure Export Worker for MV3 Compliance
 * Handles heavy export operations in isolated offscreen context
 */
class SecureExportWorker {
  constructor() {
    this.isReady = false;
    this.activeExports = new Map();
    this.exportHistory = [];
    
    // Initialize libraries and setup
    this.initializeLibraries();
    this.setupMessageListener();
    
    console.log('✅ Secure Export Worker initialized');
  }

  /**
   * Initialize and verify required libraries
   */
  initializeLibraries() {
    try {
      // Verify Papa Parse
      if (typeof Papa !== 'undefined' && Papa.unparse && Papa.parse) {
        console.log('✅ Papa Parse library verified in offscreen context');
      } else {
        console.warn('⚠️ Papa Parse library not available in offscreen context');
      }

      // JSZip removed per requirements

      // Verify XLSX
      if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.write) {
        console.log('✅ XLSX library verified in offscreen context');
      } else {
        console.warn('⚠️ XLSX library not available in offscreen context');
      }

      this.isReady = true;
      this.notifyReady();

    } catch (error) {
      console.error('❌ Failed to initialize libraries in offscreen context:', error);
      this.isReady = false;
    }
  }

  /**
   * Setup message listener for communication with service worker
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    console.log('📨 Message listener setup in offscreen context');
  }

  /**
   * Handle messages from service worker
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      const { action, exportId, data, format, filename, options } = message;

      switch (action) {
        case 'OFFSCREEN_EXPORT_START':
          await this.handleExportStart(exportId, data, format, filename, options, sendResponse);
          break;

        case 'OFFSCREEN_EXPORT_CANCEL':
          this.handleExportCancel(exportId, sendResponse);
          break;

        case 'OFFSCREEN_EXPORT_STATUS':
          this.handleExportStatus(exportId, sendResponse);
          break;

        case 'OFFSCREEN_WORKER_READY':
          sendResponse({ ok: true, ready: this.isReady });
          break;

        default:
          console.warn('Unknown action in offscreen worker:', action);
          sendResponse({ ok: false, error: 'Unknown action' });
      }

    } catch (error) {
      console.error('❌ Error handling message in offscreen worker:', error);
      sendResponse({ ok: false, error: error.message });
    }
  }

  /**
   * Handle export start request
   */
  async handleExportStart(exportId, data, format, filename, options, sendResponse) {
    try {
      console.log(`🚀 [OFFSCREEN] Starting ${format} export:`, {
        exportId,
        itemCount: data?.items?.length || 0,
        filename
      });

      // Store active export
      this.activeExports.set(exportId, {
        format,
        filename,
        startTime: Date.now(),
        status: 'processing'
      });

      // Process export based on format
      let result;
      switch (format.toLowerCase()) {
        case 'xlsx':
        case 'excel':
          result = await this.exportToExcel(data, filename, options, exportId);
          break;

        case 'csv':
          result = await this.exportToCSV(data, filename, options, exportId);
          break;

        case 'json':
          result = await this.exportToJSON(data, filename, options, exportId);
          break;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Update status
      this.activeExports.set(exportId, {
        ...this.activeExports.get(exportId),
        status: 'completed',
        result
      });

      // Add to history
      this.exportHistory.push({
        exportId,
        format,
        filename,
        success: true,
        timestamp: Date.now(),
        processingTime: Date.now() - this.activeExports.get(exportId).startTime
      });

      console.log(`✅ [OFFSCREEN] Export completed:`, {
        exportId,
        format,
        size: result.size
      });

      sendResponse({
        ok: true,
        exportId,
        result
      });

    } catch (error) {
      console.error(`❌ [OFFSCREEN] Export failed:`, error);

      // Update status
      if (this.activeExports.has(exportId)) {
        this.activeExports.set(exportId, {
          ...this.activeExports.get(exportId),
          status: 'failed',
          error: error.message
        });
      }

      // Add to history
      this.exportHistory.push({
        exportId,
        format,
        filename,
        success: false,
        error: error.message,
        timestamp: Date.now()
      });

      sendResponse({
        ok: false,
        exportId,
        error: error.message
      });
    }
  }

  /**
   * Handle export cancellation
   */
  handleExportCancel(exportId, sendResponse) {
    if (this.activeExports.has(exportId)) {
      this.activeExports.set(exportId, {
        ...this.activeExports.get(exportId),
        status: 'cancelled'
      });
      console.log(`🛑 [OFFSCREEN] Export cancelled: ${exportId}`);
    }

    sendResponse({ ok: true, cancelled: true });
  }

  /**
   * Handle export status request
   */
  handleExportStatus(exportId, sendResponse) {
    const exportInfo = this.activeExports.get(exportId);
    sendResponse({
      ok: true,
      status: exportInfo || null,
      activeExports: this.activeExports.size,
      history: this.exportHistory.slice(-5) // Last 5 exports
    });
  }

  /**
   * Export to Excel format using XLSX
   */
  async exportToExcel(data, filename, options, exportId) {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX library not available in offscreen context');
    }

    const workbook = XLSX.utils.book_new();
    const items = data.items || [];

    // Create main items sheet
    if (items.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(items);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');
    }

    // Add summary sheet if available
    if (data.summary) {
      const summaryData = Object.entries(data.summary).map(([key, value]) => ({
        Property: key,
        Value: value
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    // Generate file
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      compression: true
    });

    const finalFilename = this.ensureExtension(filename || 'export', 'xlsx');

    return {
      data: excelBuffer,
      filename: finalFilename,
      size: excelBuffer.byteLength,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  /**
   * Export to CSV format using Papa Parse
   */
  async exportToCSV(data, filename, options, exportId) {
    const items = data.items || [];
    
    if (typeof Papa !== 'undefined') {
      // Use Papa Parse if available
      const csvContent = Papa.unparse(items, {
        header: true,
        delimiter: options?.delimiter || ',',
        newline: '\r\n'
      });

      const csvBuffer = new TextEncoder().encode(csvContent);
      const finalFilename = this.ensureExtension(filename || 'export', 'csv');

      return {
        data: csvBuffer,
        filename: finalFilename,
        size: csvBuffer.byteLength,
        mimeType: 'text/csv'
      };
    } else {
      // Fallback CSV generation
      const headers = items.length > 0 ? Object.keys(items[0]) : [];
      const rows = [headers.join(',')];
      
      items.forEach(item => {
        const values = headers.map(header => {
          const value = item[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        });
        rows.push(values.join(','));
      });

      const csvContent = rows.join('\r\n');
      const csvBuffer = new TextEncoder().encode(csvContent);
      const finalFilename = this.ensureExtension(filename || 'export', 'csv');

      return {
        data: csvBuffer,
        filename: finalFilename,
        size: csvBuffer.byteLength,
        mimeType: 'text/csv'
      };
    }
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(data, filename, options, exportId) {
    const jsonContent = JSON.stringify(data, null, 2);
    const jsonBuffer = new TextEncoder().encode(jsonContent);
    const finalFilename = this.ensureExtension(filename || 'export', 'json');

    return {
      data: jsonBuffer,
      filename: finalFilename,
      size: jsonBuffer.byteLength,
      mimeType: 'application/json'
    };
  }

  // exportToZip removed - ZIP functionality has been removed per requirements

  /**
   * Ensure filename has correct extension
   */
  ensureExtension(filename, extension) {
    const ext = `.${extension}`;
    return filename.endsWith(ext) ? filename : filename + ext;
  }

  /**
   * Notify that worker is ready
   */
  notifyReady() {
    // Send ready notification to service worker
    chrome.runtime.sendMessage({
      action: 'OFFSCREEN_WORKER_READY',
      ready: this.isReady,
      timestamp: Date.now()
    }).catch(() => {
      // Ignore errors if service worker not ready
    });
  }
}

// Initialize the secure export worker
const exportWorker = new SecureExportWorker();

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  console.log('🧹 Offscreen export worker cleaning up...');
});