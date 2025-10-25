// advanced-export-system.js - Enterprise-grade export system with progress tracking and memory management
// Enhanced with DataGrab's proven patterns and enterprise reliability features

import { EXPORT_CONFIG, PERFORMANCE_CONFIG } from '../config/constants.js';

class AdvancedExportSystem {
  constructor(options = {}) {
    this.options = {
      enableCompression: options.enableCompression !== false,
      includeMetadata: options.includeMetadata !== false,
      includeThumbnails: options.includeThumbnails !== false,
      maxFileSize: options.maxFileSize || EXPORT_CONFIG.MAX_FILE_SIZE_BYTES,
      tempStorage: options.tempStorage || 'memory', // 'memory' or 'indexeddb'
      batchSize: options.batchSize || EXPORT_CONFIG.BATCH_SIZE,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      enableProgressTracking: options.enableProgressTracking !== false,
      enableUserNotifications: options.enableUserNotifications !== false,
      enableMemoryManagement: options.enableMemoryManagement !== false,
      compressionLevel: options.compressionLevel || EXPORT_CONFIG.COMPRESSION_LEVEL,
      streamingThreshold: options.streamingThreshold || EXPORT_CONFIG.STREAMING_THRESHOLD,
      ...options
    };

    this.exportStats = {
      totalExports: 0,
      formatCounts: {},
      averageExportTime: 0,
      totalDataExported: 0,
      memoryPeakUsage: 0,
      averageBatchTime: 0,
      recoveredErrors: 0,
      largeDatasetExports: 0
    };

    // Memory limits for unbounded array growth prevention
    this.MAX_EXPORT_HISTORY = 100;
    
    this.tempData = new Map();
    this.exportHistory = [];
    this.activeExports = new Map();
    this.progressCallbacks = new Map();
    
    // Memory management
    this.memoryThreshold = PERFORMANCE_CONFIG.MEMORY_WARNING_THRESHOLD_BYTES;
    this.lastGC = Date.now();
    this.gcInterval = PERFORMANCE_CONFIG.MEMORY_SAMPLE_INTERVAL_MS;
    
    // Performance monitoring
    this.performanceMetrics = {
      processingTimes: [],
      memoryUsage: [],
      batchSizes: [],
      errorRates: [],
      throughputRates: []
    };

    // User notification system
    this.notificationCallbacks = new Set();
    
    // Production mode detection for logging
    this.PRODUCTION = typeof globalThis !== 'undefined' && globalThis.PRODUCTION !== undefined 
      ? globalThis.PRODUCTION 
      : true; // Default to production mode if not set
    
    if (!this.PRODUCTION) console.log('🚀 Enterprise Export System initialized with enhanced capabilities');
  }

  // Enhanced main export method with progress tracking and error recovery
  async exportData(data, format, filename, options = {}) {
    const exportId = this.generateExportId();
    const startTime = Date.now();
    const exportOptions = { ...this.options, ...options };

    try {
      // Validate data
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Invalid data format: expected object with items array');
      }

      const itemCount = data.items.length;
      if (!this.PRODUCTION) console.log(`📊 Starting ${format.toUpperCase()} export: ${itemCount} items`);

      // Initialize progress tracking
      if (exportOptions.enableProgressTracking) {
        this.initializeProgressTracking(exportId, itemCount);
      }

      // Memory management for large datasets
      if (exportOptions.enableMemoryManagement && itemCount > EXPORT_CONFIG.LARGE_DATASET_THRESHOLD) {
        if (!this.PRODUCTION) console.log(`🧠 Large dataset detected (${itemCount} items). Using optimized processing...`);
        this.scheduleMemoryManagement();
        this.exportStats.largeDatasetExports++;
      }

      // Show user notification
      if (exportOptions.enableUserNotifications) {
        await this.showNotification('Export Started', 
          `Starting ${format.toUpperCase()} export with ${itemCount} items...`, 'info');
      }

      let result;
      let retries = 0;
      const maxRetries = exportOptions.maxRetries || 3;

      // Retry mechanism with exponential backoff
      while (retries <= maxRetries) {
        try {
          // Route to appropriate export method with progress tracking
          switch (format.toLowerCase()) {
          case 'xlsx':
          case 'excel':
            result = await this.exportToExcelWithProgress(data, filename, exportOptions, exportId);
            break;

          case 'csv':
            result = await this.exportToCSVWithProgress(data, filename, exportOptions, exportId);
            break;

          case 'json':
            result = await this.exportToJSONWithProgress(data, filename, exportOptions, exportId);
            break;

          case 'html':
            result = await this.exportToHTMLWithProgress(data, filename, exportOptions, exportId);
            break;

          case 'xml':
            result = await this.exportToXMLWithProgress(data, filename, exportOptions, exportId);
            break;

          default:
            throw new Error(`Unsupported export format: ${format}`);
          }
          break; // Success, exit retry loop

        } catch (error) {
          retries++;
          console.warn(`⚠️ Export attempt ${retries}/${maxRetries + 1} failed:`, this.getErrorMessage(error));
          
          if (retries <= maxRetries) {
            const delay = exportOptions.retryDelay * Math.pow(2, retries - 1); // Exponential backoff
            if (!this.PRODUCTION) console.log(`🔄 Retrying in ${delay}ms...`);
            
            if (exportOptions.enableUserNotifications) {
              await this.showNotification('Export Retry', 
                `Retrying export (attempt ${retries + 1}/${maxRetries + 1})...`, 'warning');
            }
            
            await this.delay(delay);
            this.exportStats.recoveredErrors++;
          } else {
            throw error; // Max retries exceeded
          }
        }
      }

      // Update progress to completion
      if (exportOptions.enableProgressTracking) {
        this.updateProgress(exportId, 100, 'Export completed successfully');
      }

      // Update statistics with enhanced metrics
      const exportTime = Date.now() - startTime;
      this.updateEnhancedStats(format, exportTime, result.size, itemCount, exportId);

      // Enforce memory limit before adding to history
      if (this.exportHistory.length >= this.MAX_EXPORT_HISTORY) {
        this.exportHistory.shift(); // Remove oldest entry (at beginning since using push)
      }
      // Add to history with enhanced information
      this.exportHistory.push({
        timestamp: Date.now(),
        exportId,
        format: format,
        filename: filename,
        itemCount: itemCount,
        fileSize: result.size,
        exportTime: exportTime,
        retryCount: retries,
        memoryPeak: this.getMemoryUsage(),
        success: true,
        throughput: itemCount / (exportTime / 1000) // items per second
      });

      // Show completion notification
      if (exportOptions.enableUserNotifications) {
        const sizeFormatted = this.formatBytes(result.size);
        const throughput = Math.round(itemCount / (exportTime / 1000));
        await this.showNotification('Export Complete', 
          `✅ Successfully exported ${itemCount} items (${sizeFormatted}) in ${this.formatTime(exportTime)} • ${throughput} items/sec`, 
          'success');
      }

      // Cleanup resources
      this.cleanupExport(exportId);

      return {
        success: true,
        exportId,
        data: result.data,
        filename: result.filename,
        size: result.size,
        mimeType: result.mimeType,
        exportTime: exportTime,
        retryCount: retries,
        itemsProcessed: itemCount,
        throughput: itemCount / (exportTime / 1000)
      };

    } catch (error) {
      console.error('❌ Export failed after all retries:', error);
      
      // Enforce memory limit before adding to history
      if (this.exportHistory.length >= this.MAX_EXPORT_HISTORY) {
        this.exportHistory.shift(); // Remove oldest entry (at beginning since using push)
      }
      // Update failed export history
      const errorMessage = this.getErrorMessage(error);
      this.exportHistory.push({
        timestamp: Date.now(),
        exportId,
        format: format,
        filename: filename,
        itemCount: data.items?.length || 0,
        error: errorMessage,
        exportTime: Date.now() - startTime,
        success: false
      });

      // Show error notification
      if (exportOptions.enableUserNotifications) {
        await this.showNotification('Export Failed', 
          `❌ Failed to export ${format.toUpperCase()}: ${this.getUserFriendlyError(errorMessage)}`, 
          'error');
      }

      // Cleanup resources
      this.cleanupExport(exportId);

      return {
        success: false,
        exportId,
        error: errorMessage,
        exportTime: Date.now() - startTime,
        userFriendlyError: this.getUserFriendlyError(errorMessage)
      };
    }
  }

  // Enhanced Excel export with progress tracking and advanced formatting
  async exportToExcelWithProgress(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 5, 'Initializing Excel export...');

      const items = data.items || [];
      
      // Detect large datasets and route to streaming export
      if (items.length > options.streamingThreshold) {
        if (!this.PRODUCTION) console.log(`📊 LARGE DATASET DETECTED: ${items.length} items > ${options.streamingThreshold} threshold`);
        if (!this.PRODUCTION) console.log('🚀 ROUTING: Using streaming export for memory optimization');
        return await this.exportToExcelStreaming(data, filename, options, exportId);
      }

      if (!this.PRODUCTION) console.log(`📋 STANDARD DATASET: ${items.length} items <= ${options.streamingThreshold} threshold`);
      if (!this.PRODUCTION) console.log('📄 ROUTING: Using standard Excel export');

      // Enhanced Diagnostics: XLSX Library Loading
      if (typeof globalThis.XLSX === 'undefined') {
        const errorMessage = 'XLSX library failed to load. This is required for Excel exports. Please check your internet connection and try again, or use CSV export as an alternative.';
        console.error('📊 FEATURE DIAGNOSTIC: XLSX Export Failed - Library not loaded:', errorMessage);
        console.warn('🔄 FALLBACK DIAGNOSTIC: User should use CSV export as alternative');
        throw new Error(errorMessage);
      }

      const XLSX = globalThis.XLSX;
      
      // Verify XLSX library functionality
      if (!XLSX.utils || !XLSX.utils.book_new || !XLSX.write) {
        const errorMessage = 'XLSX library loaded but is incomplete or corrupted. Please refresh the page and try again.';
        console.error('📊 FEATURE DIAGNOSTIC: XLSX Export Failed - Library corrupted:', errorMessage);
        console.warn('🔄 FALLBACK DIAGNOSTIC: User should refresh page or use CSV export');
        throw new Error(errorMessage);
      }
      
      // Enhanced Diagnostics: XLSX Success
      if (!this.PRODUCTION) console.log('✅ FEATURE DIAGNOSTIC: XLSX Library successfully loaded and verified');
      if (!this.PRODUCTION) console.log('📊 ENHANCED FEATURE: Excel export with advanced formatting enabled');

      this.updateProgress(exportId, 10, 'Creating Excel workbook...');

      const workbook = XLSX.utils.book_new();

      // Main items sheet with batch processing for large datasets
      if (items.length > options.batchSize) {
        this.updateProgress(exportId, 15, `Processing ${items.length} items in batches...`);
        const itemsSheet = await this.createItemsSheetBatched(items, options, exportId);
        XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
      } else {
        this.updateProgress(exportId, 15, 'Creating items sheet...');
        const itemsSheet = this.createItemsSheetEnhanced(items, options);
        XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
      }

      this.updateProgress(exportId, 40, 'Adding summary sheet...');

      // Enhanced summary sheet
      if (data.summary) {
        const summarySheet = this.createEnhancedSummarySheet(data.summary, options);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      }

      this.updateProgress(exportId, 50, 'Adding statistics sheet...');

      // Enhanced statistics sheet
      const statsSheet = this.createEnhancedStatsSheet(data, options);
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

      this.updateProgress(exportId, 60, 'Processing error log...');

      // Error log sheet (if errors exist)
      if (data.errors && data.errors.length > 0) {
        const errorSheet = this.createEnhancedErrorSheet(data.errors, options);
        XLSX.utils.book_append_sheet(workbook, errorSheet, 'Errors');
      }

      this.updateProgress(exportId, 70, 'Processing duplicate analysis...');

      // Duplicate groups sheet (if available)
      if (data.duplicateGroups && data.duplicateGroups.length > 0) {
        const dupSheet = this.createEnhancedDuplicateSheet(data.duplicateGroups, options);
        XLSX.utils.book_append_sheet(workbook, dupSheet, 'Duplicates');
      }

      // Performance metrics sheet
      if (options.includePerformanceMetrics) {
        this.updateProgress(exportId, 75, 'Adding performance metrics...');
        const perfSheet = this.createPerformanceMetricsSheet(data, options);
        XLSX.utils.book_append_sheet(workbook, perfSheet, 'Performance');
      }

      this.updateProgress(exportId, 80, 'Generating Excel file...');

      // Generate file with enhanced options
      const writeOptions = {
        bookType: 'xlsx',
        type: 'array',
        compression: options.enableCompression,
        cellStyles: true // Enable formatting
      };
      
      // Enhanced Diagnostics: XLSX Generation Options
      if (!this.PRODUCTION) console.log('📊 XLSX GENERATION DIAGNOSTIC:', {
        compression: writeOptions.compression,
        cellStyles: writeOptions.cellStyles,
        worksheetCount: workbook.SheetNames.length,
        includeMetadata: options.includeMetadata
      });
      
      const excelBuffer = XLSX.write(workbook, writeOptions);
      if (!this.PRODUCTION) console.log(`✅ FEATURE DIAGNOSTIC: Excel file generated successfully (${this.formatBytes(excelBuffer.byteLength)})`);

      this.updateProgress(exportId, 90, 'Finalizing export...');

      const finalFilename = this.ensureExtension(filename || 'export', 'xlsx');

      return {
        data: excelBuffer,
        filename: finalFilename,
        size: excelBuffer.byteLength,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

    } catch (error) {
      // Provide user-friendly error messages
      const errorMessage = this.getErrorMessage(error);
      if (errorMessage.includes('XLSX library')) {
        throw new Error(`Excel Export Failed: ${errorMessage}\\n\\nTroubleshooting steps:\\n1. Check your internet connection\\n2. Disable ad blockers temporarily\\n3. Refresh the page and try again\\n4. Use CSV export as an alternative`);
      } else {
        throw new Error(`Excel export failed: ${errorMessage}`);
      }
    }
  }

  // Streaming Excel export for large datasets with memory optimization
  async exportToExcelStreaming(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 5, 'Initializing streaming Excel export...');

      // Enhanced Diagnostics: XLSX Library Loading
      if (typeof globalThis.XLSX === 'undefined') {
        const errorMessage = 'XLSX library failed to load. This is required for Excel exports.';
        console.error('📊 FEATURE DIAGNOSTIC: XLSX Export Failed - Library not loaded:', errorMessage);
        throw new Error(errorMessage);
      }

      const XLSX = globalThis.XLSX;
      
      // Verify XLSX library functionality
      if (!XLSX.utils || !XLSX.utils.book_new || !XLSX.write) {
        const errorMessage = 'XLSX library loaded but is incomplete or corrupted.';
        console.error('📊 FEATURE DIAGNOSTIC: XLSX Export Failed - Library corrupted:', errorMessage);
        throw new Error(errorMessage);
      }
      
      if (!this.PRODUCTION) console.log('✅ FEATURE DIAGNOSTIC: XLSX Library verified for streaming export');
      if (!this.PRODUCTION) console.log('🚀 ENHANCED FEATURE: Streaming Excel export with memory optimization enabled');

      this.updateProgress(exportId, 10, 'Creating Excel workbook...');

      const workbook = XLSX.utils.book_new();
      const items = data.items || [];
      const batchSize = options.batchSize || EXPORT_CONFIG.BATCH_SIZE;
      
      if (!this.PRODUCTION) console.log(`📊 STREAMING EXPORT: Processing ${items.length} items in batches of ${batchSize}`);

      // Process main items sheet with streaming
      const worksheetData = [];
      
      // Add headers
      const headers = this.generateCSVHeaders(items, options);
      worksheetData.push(headers);

      this.updateProgress(exportId, 15, 'Processing items in batches...');

      const totalBatches = Math.ceil(items.length / batchSize);
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const progress = 15 + ((i / items.length) * 55);
        
        this.updateProgress(exportId, progress, `Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);
        
        // Process batch - flatten each item
        batch.forEach(item => {
          const flatItem = this.flattenItemForExcel(item);
          worksheetData.push(flatItem);
        });
        
        // GC hint every 5 batches
        if (batchNumber % 5 === 0) {
          if (!this.PRODUCTION) console.log(`🧠 MEMORY MANAGEMENT: Triggering cleanup after batch ${batchNumber}`);
          await this.performMemoryCleanup();
          await this.delay(10); // Give browser chance to GC
        }
        
        // Allow other tasks to run
        await this.delay(1);
      }

      this.updateProgress(exportId, 70, 'Creating Items worksheet...');
      
      // Create worksheet from accumulated data
      const itemsSheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Items');
      
      // Clear worksheetData to free memory
      worksheetData.length = 0;

      this.updateProgress(exportId, 75, 'Adding summary sheet...');

      // Enhanced summary sheet
      if (data.summary) {
        const summarySheet = this.createEnhancedSummarySheet(data.summary, options);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      }

      this.updateProgress(exportId, 80, 'Adding statistics sheet...');

      // Enhanced statistics sheet
      const statsSheet = this.createEnhancedStatsSheet(data, options);
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

      // Error log sheet (if errors exist)
      if (data.errors && data.errors.length > 0) {
        this.updateProgress(exportId, 82, 'Processing error log...');
        const errorSheet = this.createEnhancedErrorSheet(data.errors, options);
        XLSX.utils.book_append_sheet(workbook, errorSheet, 'Errors');
      }

      // Duplicate groups sheet (if available)
      if (data.duplicateGroups && data.duplicateGroups.length > 0) {
        this.updateProgress(exportId, 84, 'Processing duplicate analysis...');
        const dupSheet = this.createEnhancedDuplicateSheet(data.duplicateGroups, options);
        XLSX.utils.book_append_sheet(workbook, dupSheet, 'Duplicates');
      }

      // Performance metrics sheet
      if (options.includePerformanceMetrics) {
        this.updateProgress(exportId, 86, 'Adding performance metrics...');
        const perfSheet = this.createPerformanceMetricsSheet(data, options);
        XLSX.utils.book_append_sheet(workbook, perfSheet, 'Performance');
      }

      this.updateProgress(exportId, 88, 'Generating Excel file...');

      // Generate file with enhanced options
      const writeOptions = {
        bookType: 'xlsx',
        type: 'array',
        compression: options.enableCompression,
        cellStyles: true
      };
      
      if (!this.PRODUCTION) console.log('📊 STREAMING XLSX GENERATION:', {
        compression: writeOptions.compression,
        worksheetCount: workbook.SheetNames.length,
        totalItems: items.length
      });
      
      const excelBuffer = XLSX.write(workbook, writeOptions);
      if (!this.PRODUCTION) console.log(`✅ STREAMING EXPORT: Excel file generated successfully (${this.formatBytes(excelBuffer.byteLength)})`);

      this.updateProgress(exportId, 95, 'Finalizing streaming export...');

      const finalFilename = this.ensureExtension(filename || 'export', 'xlsx');

      return {
        data: excelBuffer,
        filename: finalFilename,
        size: excelBuffer.byteLength,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

    } catch (error) {
      console.error('❌ Streaming Excel export failed:', error);
      throw new Error(`Streaming Excel export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Enhanced CSV export with Papa Parse integration and streaming for large datasets
  async exportToCSVWithProgress(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 5, 'Initializing CSV export...');

      // Enhanced Diagnostics: Papa Parse Library Loading
      if (typeof globalThis.Papa === 'undefined') {
        console.warn('⚠️ FEATURE DIAGNOSTIC: Papa Parse library not available - using fallback CSV processing');
        if (!this.PRODUCTION) console.log('🔄 FALLBACK DIAGNOSTIC: Using legacy CSV export methods for compatibility');
        return await this.exportToCSVLegacy(data, filename, options, exportId);
      }

      const Papa = globalThis.Papa;
      
      // Verify Papa Parse functionality
      if (!Papa.unparse || !Papa.parse) {
        console.warn('⚠️ FEATURE DIAGNOSTIC: Papa Parse library incomplete - using fallback CSV processing');
        if (!this.PRODUCTION) console.log('🔄 FALLBACK DIAGNOSTIC: Papa Parse missing required methods, falling back');
        return await this.exportToCSVLegacy(data, filename, options, exportId);
      }

      if (!this.PRODUCTION) console.log('✅ FEATURE DIAGNOSTIC: Papa Parse library successfully loaded and verified');
      if (!this.PRODUCTION) console.log('🚀 ENHANCED FEATURE: Papa Parse CSV processing enabled');

      const items = data.items || [];
      const useStreaming = items.length >= options.streamingThreshold;

      // Enhanced Diagnostics: CSV Export Strategy with Papa Parse
      if (useStreaming) {
        if (!this.PRODUCTION) console.log(`📊 FEATURE DIAGNOSTIC: Large dataset (${items.length} items) - using Papa Parse streaming CSV export`);
        if (!this.PRODUCTION) console.log('🚀 ENHANCED FEATURE: Papa Parse memory-optimized streaming CSV processing enabled');
        return await this.exportToCSVStreamingPapa(data, filename, options, exportId);
      } else {
        if (!this.PRODUCTION) console.log(`📋 FEATURE DIAGNOSTIC: Standard dataset (${items.length} items) - using Papa Parse standard CSV export`);
        if (!this.PRODUCTION) console.log('📄 ENHANCED FEATURE: Papa Parse in-memory CSV processing used');
        return await this.exportToCSVStandardPapa(data, filename, options, exportId);
      }

    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('📊 FEATURE DIAGNOSTIC: Papa Parse CSV export failed:', errorMessage);
      if (!this.PRODUCTION) console.log('🔄 FALLBACK DIAGNOSTIC: Attempting fallback to legacy CSV export');
      
      try {
        return await this.exportToCSVLegacy(data, filename, options, exportId);
      } catch (fallbackError) {
        const fallbackErrorMessage = this.getErrorMessage(fallbackError);
        console.error('❌ CRITICAL: Both Papa Parse and legacy CSV export failed:', fallbackErrorMessage);
        throw new Error(`CSV export failed: ${errorMessage}. Fallback also failed: ${fallbackErrorMessage}`);
      }
    }
  }

  // Papa Parse enhanced CSV export for standard datasets
  async exportToCSVStandardPapa(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 10, 'Preparing data for Papa Parse...');

      const Papa = globalThis.Papa;
      const items = data.items || [];

      // Prepare data for Papa Parse
      this.updateProgress(exportId, 20, 'Converting data to Papa Parse format...');
      
      const csvData = [];
      
      // Add headers if needed
      if (items.length > 0) {
        const headers = this.generateCSVHeaders(items, options);
        
        // Convert items to objects for Papa Parse
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const rowObject = {};
          
          headers.forEach((header, index) => {
            const cellData = this.getItemValue(item, header, options);
            rowObject[header] = cellData;
          });
          
          csvData.push(rowObject);
          
          // Update progress periodically
          if (i % 100 === 0) {
            this.updateProgress(exportId, 20 + (i / items.length) * 50, 
              `Processing item ${i + 1}/${items.length}...`);
          }
        }
      }

      this.updateProgress(exportId, 75, 'Generating CSV with Papa Parse...');

      // Use Papa Parse to generate CSV
      const csvContent = Papa.unparse(csvData, {
        header: true,
        delimiter: options.delimiter || ',',
        newline: '\r\n',
        skipEmptyLines: options.skipEmptyLines !== false,
        quotes: options.forceQuotes || false,
        quoteChar: '"',
        escapeChar: '"'
      });

      this.updateProgress(exportId, 85, 'Adding summary information...');

      // Add summary information if requested
      let finalCsvContent = csvContent;
      if (options.includeSummary && data.summary) {
        finalCsvContent += '\n\nSUMMARY\n';
        Object.entries(data.summary).forEach(([key, value]) => {
          finalCsvContent += `${Papa.unparse([[key, value]])}\n`;
        });
      }

      this.updateProgress(exportId, 90, 'Finalizing Papa Parse CSV export...');

      const csvBuffer = new TextEncoder().encode(finalCsvContent);
      const finalFilename = this.ensureExtension(filename || 'export', 'csv');

      if (!this.PRODUCTION) console.log(`✅ FEATURE DIAGNOSTIC: Papa Parse CSV generated successfully (${this.formatBytes(csvBuffer.byteLength)})`);

      return {
        data: csvBuffer,
        filename: finalFilename,
        size: csvBuffer.byteLength,
        mimeType: 'text/csv'
      };

    } catch (error) {
      console.error('❌ Papa Parse standard CSV export failed:', error);
      throw new Error(`Papa Parse CSV export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Papa Parse enhanced streaming CSV export for large datasets
  async exportToCSVStreamingPapa(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 10, 'Starting Papa Parse streaming CSV export...');

      const Papa = globalThis.Papa;
      const items = data.items || [];
      const chunks = [];

      // Process headers
      this.updateProgress(exportId, 15, 'Processing headers...');
      const headers = this.generateCSVHeaders(items, options);
      
      // Add header row using Papa Parse
      const headerRow = Papa.unparse([headers], {
        header: false,
        delimiter: options.delimiter || ',',
        newline: '',
        quotes: options.forceQuotes || false
      });
      chunks.push(headerRow + '\n');

      this.updateProgress(exportId, 20, 'Processing data in batches with Papa Parse...');

      // Process in batches to manage memory with Papa Parse
      const batchSize = Math.min(options.batchSize, 200);
      const totalBatches = Math.ceil(items.length / batchSize);

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        this.updateProgress(exportId, 
          20 + (batchNumber / totalBatches) * 60, 
          `Papa Parse processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);

        // Convert batch to objects and process with Papa Parse
        const batchData = [];
        for (const item of batch) {
          // Check for cancellation and pause/resume
          await this.checkExportStatus(exportId);
          
          const rowData = [];
          headers.forEach(header => {
            const cellData = this.getItemValue(item, header, options);
            rowData.push(cellData);
          });
          batchData.push(rowData);
        }

        // Use Papa Parse for this batch
        const batchCsv = Papa.unparse(batchData, {
          header: false,
          delimiter: options.delimiter || ',',
          newline: '\n',
          quotes: options.forceQuotes || false,
          skipEmptyLines: options.skipEmptyLines !== false
        });

        chunks.push(batchCsv + '\n');

        // Memory management - force garbage collection periodically
        if (batchNumber % 5 === 0) {
          await this.performMemoryCleanup();
        }

        // Allow other tasks to run
        await this.delay(1);
      }

      this.updateProgress(exportId, 85, 'Adding summary information...');

      // Add summary information if requested
      if (options.includeSummary && data.summary) {
        chunks.push('\n'); // Empty line
        chunks.push('SUMMARY\n');

        Object.entries(data.summary).forEach(([key, value]) => {
          const summaryRow = Papa.unparse([[key, value]], {
            header: false,
            delimiter: options.delimiter || ',',
            newline: '',
            quotes: options.forceQuotes || false
          });
          chunks.push(summaryRow + '\n');
        });
      }

      this.updateProgress(exportId, 90, 'Finalizing Papa Parse streaming CSV export...');

      // Join all chunks
      const csvContent = chunks.join('');
      const csvBuffer = new TextEncoder().encode(csvContent);
      const finalFilename = this.ensureExtension(filename || 'export', 'csv');

      if (!this.PRODUCTION) console.log(`✅ FEATURE DIAGNOSTIC: Papa Parse streaming CSV generated successfully (${this.formatBytes(csvBuffer.byteLength)})`);

      return {
        data: csvBuffer,
        filename: finalFilename,
        size: csvBuffer.byteLength,
        mimeType: 'text/csv'
      };

    } catch (error) {
      console.error('❌ Papa Parse streaming CSV export failed:', error);
      throw new Error(`Papa Parse streaming CSV export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Legacy CSV export methods (fallback when Papa Parse is not available)
  async exportToCSVLegacy(data, filename, options, exportId) {
    try {
      const items = data.items || [];
      const useStreaming = items.length >= options.streamingThreshold;

      if (!this.PRODUCTION) console.log(`🔄 FALLBACK DIAGNOSTIC: Using legacy CSV export (streaming: ${useStreaming})`);

      if (useStreaming) {
        return await this.exportToCSVStreamingLegacy(data, filename, options, exportId);
      } else {
        return await this.exportToCSVStandardLegacy(data, filename, options, exportId);
      }
    } catch (error) {
      console.error('❌ Legacy CSV export failed:', error);
      throw new Error(`Legacy CSV export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Legacy streaming CSV export for large datasets
  async exportToCSVStreamingLegacy(data, filename, options, exportId) {
    this.updateProgress(exportId, 10, 'Starting streaming CSV export...');

    const items = data.items || [];
    const chunks = [];
    
    // Headers
    const headers = this.generateCSVHeaders(items, options);
    chunks.push(headers.join(',') + '\n');

    this.updateProgress(exportId, 20, 'Processing data in batches...');

    // Process in batches to manage memory
    const batchSize = Math.min(options.batchSize, 200); // Smaller batches for memory efficiency
    const totalBatches = Math.ceil(items.length / batchSize);

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      this.updateProgress(exportId, 
        20 + (batchNumber / totalBatches) * 60, 
        `Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);

      // Process batch with cancellation check
      for (const item of batch) {
        // Check for cancellation and pause/resume
        await this.checkExportStatus(exportId);
        
        const row = this.itemToCSVRow(item, headers, options);
        chunks.push(row.join(',') + '\n');
      }

      // Memory management - force garbage collection periodically
      if (batchNumber % 5 === 0) {
        await this.performMemoryCleanup();
      }

      // Allow other tasks to run
      await this.delay(1);
    }

    this.updateProgress(exportId, 85, 'Adding summary information...');

    // Add summary information at the end if requested
    if (options.includeSummary && data.summary) {
      chunks.push('\n'); // Empty line
      chunks.push('SUMMARY\n');

      Object.entries(data.summary).forEach(([key, value]) => {
        chunks.push(`${this.escapeCSV(key)},${this.escapeCSV(value)}\n`);
      });
    }

    this.updateProgress(exportId, 90, 'Finalizing CSV file...');

    // Join all chunks
    const csvContent = chunks.join('');
    const csvBuffer = new TextEncoder().encode(csvContent);
    const finalFilename = this.ensureExtension(filename || 'export', 'csv');

    return {
      data: csvBuffer,
      filename: finalFilename,
      size: csvBuffer.byteLength,
      mimeType: 'text/csv'
    };
  }

  // Legacy standard CSV export for smaller datasets
  async exportToCSVStandardLegacy(data, filename, options, exportId) {
    this.updateProgress(exportId, 10, 'Processing CSV data...');

    const rows = [];
    const items = data.items || [];

    // Headers
    const headers = this.generateCSVHeaders(items, options);
    rows.push(headers.join(','));

    this.updateProgress(exportId, 20, `Processing ${items.length} items...`);

    // Data rows with progress updates
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = this.itemToCSVRow(item, headers, options);
      rows.push(row.join(','));

      // Update progress periodically
      if (i % 50 === 0) {
        this.updateProgress(exportId, 20 + (i / items.length) * 60, 
          `Processing item ${i + 1}/${items.length}...`);
      }
    }

    this.updateProgress(exportId, 85, 'Adding summary information...');

    // Add summary information at the end if requested
    if (options.includeSummary && data.summary) {
      rows.push(''); // Empty line
      rows.push('SUMMARY');

      Object.entries(data.summary).forEach(([key, value]) => {
        rows.push(`${this.escapeCSV(key)},${this.escapeCSV(value)}`);
      });
    }

    this.updateProgress(exportId, 90, 'Finalizing CSV file...');

    const csvContent = rows.join('\n');
    const csvBuffer = new TextEncoder().encode(csvContent);
    const finalFilename = this.ensureExtension(filename || 'export', 'csv');

    return {
      data: csvBuffer,
      filename: finalFilename,
      size: csvBuffer.byteLength,
      mimeType: 'text/csv'
    };
  }

  // Enhanced JSON export with progress tracking
  async exportToJSONWithProgress(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 10, 'Preparing JSON data...');

      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: '2.0',
          format: 'StepThree Gallery Scraper Export - Enterprise Edition',
          url: data.sourceUrl || 'unknown',
          userAgent: navigator.userAgent,
          exportId: exportId,
          processingMode: data.items?.length >= options.streamingThreshold ? 'streaming' : 'standard'
        },
        summary: data.summary || {},
        items: data.items || [],
        statistics: data.statistics || {},
        errors: data.errors || [],
        duplicateGroups: data.duplicateGroups || [],
        extractionMethods: data.extractionMethods || [],
        processingLog: data.processingLog || [],
        performance: {
          exportStats: this.exportStats,
          memoryUsage: this.getMemoryUsage(),
          timestamp: Date.now()
        }
      };

      this.updateProgress(exportId, 30, 'Processing export options...');

      // Remove empty arrays if not needed
      if (!options.includeEmptyArrays) {
        Object.keys(exportData).forEach(key => {
          if (Array.isArray(exportData[key]) && exportData[key].length === 0) {
            delete exportData[key];
          }
        });
      }

      this.updateProgress(exportId, 50, 'Serializing JSON data...');

      const jsonString = JSON.stringify(exportData, null, options.prettify ? 2 : 0);

      this.updateProgress(exportId, 70, 'Processing compression...');

      let finalData;
      if (options.enableCompression && jsonString.length > 10000) {
        // Use compression for large files
        this.updateProgress(exportId, 80, 'Compressing large JSON file...');
        finalData = await this.compressString(jsonString);
      } else {
        finalData = new TextEncoder().encode(jsonString);
      }

      this.updateProgress(exportId, 90, 'Finalizing JSON export...');

      const finalFilename = this.ensureExtension(filename || 'export', 'json');

      return {
        data: finalData,
        filename: finalFilename,
        size: finalData.byteLength,
        mimeType: 'application/json'
      };

    } catch (error) {
      throw new Error(`JSON export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Enhanced HTML export with progress tracking
  async exportToHTMLWithProgress(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 10, 'Generating HTML report...');

      const html = await this.generateEnhancedHTMLReport(data, options, exportId);
      
      this.updateProgress(exportId, 80, 'Encoding HTML content...');

      const htmlBuffer = new TextEncoder().encode(html);
      const finalFilename = this.ensureExtension(filename || 'export', 'html');

      this.updateProgress(exportId, 90, 'Finalizing HTML export...');

      return {
        data: htmlBuffer,
        filename: finalFilename,
        size: htmlBuffer.byteLength,
        mimeType: 'text/html'
      };

    } catch (error) {
      throw new Error(`HTML export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Enhanced XML export with progress tracking
  async exportToXMLWithProgress(data, filename, options, exportId) {
    try {
      this.updateProgress(exportId, 10, 'Generating XML structure...');

      const xml = await this.generateEnhancedXMLContent(data, options, exportId);
      
      this.updateProgress(exportId, 80, 'Encoding XML content...');

      const xmlBuffer = new TextEncoder().encode(xml);
      const finalFilename = this.ensureExtension(filename || 'export', 'xml');

      this.updateProgress(exportId, 90, 'Finalizing XML export...');

      return {
        data: xmlBuffer,
        filename: finalFilename,
        size: xmlBuffer.byteLength,
        mimeType: 'application/xml'
      };

    } catch (error) {
      throw new Error(`XML export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Helper method to extract item values for Papa Parse CSV processing
  getItemValue(item, header, options = {}) {
    try {
      // Handle different item structures for CSV export
      switch (header.toLowerCase()) {
        case 'filename':
        case 'name':
          return item.filename || item.name || item.title || 'unknown';
          
        case 'url':
        case 'src':
          return item.url || item.src || item.originalUrl || '';
          
        case 'size':
          return item.size ? this.formatBytes(item.size) : '';
          
        case 'width':
          return item.width || item.metadata?.width || '';
          
        case 'height':
          return item.height || item.metadata?.height || '';
          
        case 'dimensions':
          if (item.width && item.height) {
            return `${item.width}x${item.height}`;
          }
          return '';
          
        case 'alt':
        case 'alt_text':
          return item.alt || item.altText || '';
          
        case 'description':
          return item.description || item.caption || '';
          
        case 'download_status':
        case 'status':
          return item.status || item.downloadStatus || 'pending';
          
        case 'error':
        case 'error_message':
          return item.error || item.errorMessage || '';
          
        case 'index':
          return item.index !== undefined ? item.index.toString() : '';
          
        case 'timestamp':
        case 'date':
          if (item.timestamp) {
            return new Date(item.timestamp).toISOString();
          }
          return '';
          
        case 'type':
        case 'file_type':
          if (item.url || item.src) {
            const url = item.url || item.src;
            const extension = url.split('.').pop()?.toLowerCase();
            return extension || '';
          }
          return '';
          
        default:
          // Try direct property access first
          if (item[header] !== undefined) {
            return String(item[header]);
          }
          
          // Try nested metadata access
          if (item.metadata && item.metadata[header] !== undefined) {
            return String(item.metadata[header]);
          }
          
          // Try case-insensitive property search
          const propertyKey = Object.keys(item).find(key => 
            key.toLowerCase() === header.toLowerCase()
          );
          
          if (propertyKey) {
            return String(item[propertyKey]);
          }
          
          return '';
      }
    } catch (error) {
      console.warn(`⚠️ Error extracting value for header "${header}":`, error);
      return '';
    }
  }

  // Enhanced CSV export specifically for tabular data from table detection
  async exportTabularDataToCSV(tabularData, filename, options = {}, exportId = null) {
    try {
      if (!exportId) exportId = this.generateExportId();
      this.updateProgress(exportId, 5, 'Processing tabular data...');

      // Extract table data from the input
      let tableRows = [];
      let headers = [];

      if (tabularData.tableData && tabularData.tableData.rows) {
        // Direct table data structure
        const data = tabularData.tableData;
        headers = data.headers || [];
        
        // If no explicit headers, use first row
        if (headers.length === 0 && data.rows.length > 0) {
          headers = data.rows[0].cells.map(cell => cell.text || 'Column');
          tableRows = data.rows.slice(1);
        } else {
          tableRows = data.dataRows || data.rows || [];
        }
      } else if (Array.isArray(tabularData)) {
        // Array of table data objects
        tabularData.forEach(item => {
          if (item.metadata && item.metadata.tableData) {
            const tData = item.metadata.tableData;
            if (headers.length === 0 && tData.headers) {
              headers = tData.headers;
            }
            if (tData.dataRows) {
              tableRows.push(...tData.dataRows);
            }
          }
        });
      }

      this.updateProgress(exportId, 20, 'Building CSV structure...');

      // Convert to CSV format
      const csvRows = [];
      
      // Add headers
      if (headers.length > 0) {
        csvRows.push(headers.map(h => this.escapeCSV(h.toString())).join(','));
      }

      // Add data rows  
      tableRows.forEach((row, index) => {
        let rowData = [];
        if (row.cells) {
          // Row with cells structure
          rowData = row.cells.map(cell => this.escapeCSV((cell.text || '').toString()));
        } else if (Array.isArray(row)) {
          // Simple array structure
          rowData = row.map(cell => this.escapeCSV((cell || '').toString()));
        } else {
          // Object structure
          rowData = Object.values(row).map(val => this.escapeCSV((val || '').toString()));
        }
        csvRows.push(rowData.join(','));

        if (index % 50 === 0) {
          this.updateProgress(exportId, 20 + (index / tableRows.length) * 60, 
            `Processing row ${index + 1}/${tableRows.length}...`);
        }
      });

      this.updateProgress(exportId, 85, 'Adding metadata...');

      // Add metadata section if requested
      if (options.includeMetadata && tabularData.metadata) {
        csvRows.push(''); // Empty line
        csvRows.push('METADATA');
        
        const metadata = tabularData.metadata;
        csvRows.push(`Source,${this.escapeCSV(metadata.selector || 'Unknown')}`);
        csvRows.push(`Confidence,${(metadata.confidence || 0).toFixed(2)}`);
        csvRows.push(`Children Count,${metadata.childrenCount || 0}`);
        csvRows.push(`Score,${metadata.score || 0}`);
        csvRows.push(`Pattern Strength,${(metadata.patternStrength || 0).toFixed(2)}`);
        csvRows.push(`Extracted At,${new Date(metadata.extractedAt || Date.now()).toISOString()}`);
        
        if (metadata.goodClasses && metadata.goodClasses.length > 0) {
          csvRows.push(`Good Classes,"${metadata.goodClasses.join(', ')}"`);
        }
      }

      this.updateProgress(exportId, 95, 'Finalizing CSV...');

      const csvContent = csvRows.join('\n');
      const csvBuffer = new TextEncoder().encode(csvContent);
      const finalFilename = this.ensureExtension(filename || 'table-data', 'csv');

      this.updateProgress(exportId, 100, 'Export complete!');

      return {
        data: csvBuffer,
        filename: finalFilename,
        size: csvBuffer.byteLength,
        mimeType: 'text/csv',
        rowCount: tableRows.length,
        columnCount: headers.length
      };

    } catch (error) {
      console.error('❌ Tabular CSV export failed:', error);
      throw new Error(`Tabular CSV export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Enhanced XLSX export specifically for tabular data 
  async exportTabularDataToXLSX(tabularData, filename, options = {}, exportId = null) {
    try {
      if (!exportId) exportId = this.generateExportId();
      this.updateProgress(exportId, 5, 'Processing tabular data for XLSX...');

      if (typeof globalThis.XLSX === 'undefined') {
        throw new Error('XLSX library not available');
      }

      // Extract and structure data similar to CSV export
      let tableRows = [];
      let headers = [];

      if (tabularData.tableData && tabularData.tableData.rows) {
        const data = tabularData.tableData;
        headers = data.headers || [];
        
        if (headers.length === 0 && data.rows.length > 0) {
          headers = data.rows[0].cells.map(cell => cell.text || 'Column');
          tableRows = data.rows.slice(1);
        } else {
          tableRows = data.dataRows || data.rows || [];
        }
      } else if (Array.isArray(tabularData)) {
        tabularData.forEach(item => {
          if (item.metadata && item.metadata.tableData) {
            const tData = item.metadata.tableData;
            if (headers.length === 0 && tData.headers) {
              headers = tData.headers;
            }
            if (tData.dataRows) {
              tableRows.push(...tData.dataRows);
            }
          }
        });
      }

      this.updateProgress(exportId, 30, 'Building worksheet...');

      // Create workbook and worksheet
      const workbook = globalThis.XLSX.utils.book_new();
      const worksheetData = [];

      // Add headers
      if (headers.length > 0) {
        worksheetData.push(headers);
      }

      // Add data rows
      tableRows.forEach((row, index) => {
        let rowData = [];
        if (row.cells) {
          rowData = row.cells.map(cell => cell.text || '');
        } else if (Array.isArray(row)) {
          rowData = row;
        } else {
          rowData = Object.values(row);
        }
        worksheetData.push(rowData);

        if (index % 100 === 0) {
          this.updateProgress(exportId, 30 + (index / tableRows.length) * 50, 
            `Processing row ${index + 1}/${tableRows.length}...`);
        }
      });

      // Create worksheet
      const worksheet = globalThis.XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Add metadata sheet if requested
      if (options.includeMetadata && tabularData.metadata) {
        this.updateProgress(exportId, 85, 'Adding metadata sheet...');
        
        const metadataData = [
          ['Property', 'Value'],
          ['Source', tabularData.metadata.selector || 'Unknown'],
          ['Confidence', (tabularData.metadata.confidence || 0).toFixed(2)],
          ['Children Count', tabularData.metadata.childrenCount || 0],
          ['Score', tabularData.metadata.score || 0],
          ['Pattern Strength', (tabularData.metadata.patternStrength || 0).toFixed(2)],
          ['Extracted At', new Date(tabularData.metadata.extractedAt || Date.now()).toISOString()]
        ];
        
        if (tabularData.metadata.goodClasses && tabularData.metadata.goodClasses.length > 0) {
          metadataData.push(['Good Classes', tabularData.metadata.goodClasses.join(', ')]);
        }
        
        const metadataSheet = globalThis.XLSX.utils.aoa_to_sheet(metadataData);
        globalThis.XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
      }

      globalThis.XLSX.utils.book_append_sheet(workbook, worksheet, 'Table Data');

      this.updateProgress(exportId, 95, 'Generating XLSX file...');

      // Generate file
      const xlsxData = globalThis.XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const finalFilename = this.ensureExtension(filename || 'table-data', 'xlsx');

      this.updateProgress(exportId, 100, 'Export complete!');

      return {
        data: xlsxData,
        filename: finalFilename,
        size: xlsxData.byteLength,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        rowCount: tableRows.length,
        columnCount: headers.length
      };

    } catch (error) {
      console.error('❌ Tabular XLSX export failed:', error);
      throw new Error(`Tabular XLSX export failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Enhanced ZIP export with progress tracking and advanced bundling capabilities
  // ZIP export has been removed per requirements
  // Use individual formats (CSV, Excel, JSON, HTML) instead

  // ZIP-related export methods removed per requirements
  // Use individual format exports (CSV, Excel, JSON, HTML) instead

  // Enhanced helper methods for creating Excel sheets with better formatting
  createItemsSheetEnhanced(items, options) {
    const sheetData = [];

    // Generate headers
    const headers = this.generateCSVHeaders(items, options);
    sheetData.push(headers);

    // Data rows with enhanced formatting
    items.forEach((item, index) => {
      const row = this.itemToCSVRow({...item, index: index + 1}, headers, options)
        .map(cell => typeof cell === 'string' && cell.startsWith('"') && cell.endsWith('"') ?
          cell.slice(1, -1).replace(/""/g, '"') : cell); // Remove CSV escaping for Excel
      sheetData.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Add enhanced formatting
    this.applyExcelFormatting(worksheet, headers);
    
    return worksheet;
  }

  // Batch processing for large datasets in Excel
  async createItemsSheetBatched(items, options, exportId) {
    const sheetData = [];
    const headers = this.generateCSVHeaders(items, options);
    sheetData.push(headers);

    const batchSize = Math.min(options.batchSize, 200);
    const totalBatches = Math.ceil(items.length / batchSize);

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      this.updateProgress(exportId, 
        15 + (batchNumber / totalBatches) * 20, 
        `Processing Excel batch ${batchNumber}/${totalBatches}...`);

      // Process batch
      batch.forEach((item, index) => {
        const globalIndex = i + index + 1;
        const row = this.itemToCSVRow({...item, index: globalIndex}, headers, options)
          .map(cell => typeof cell === 'string' && cell.startsWith('"') && cell.endsWith('"') ?
            cell.slice(1, -1).replace(/""/g, '"') : cell);
        sheetData.push(row);
      });

      // Memory management
      if (batchNumber % 5 === 0) {
        await this.performMemoryCleanup();
      }

      // Allow other tasks to run
      await this.delay(1);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    this.applyExcelFormatting(worksheet, headers);
    
    return worksheet;
  }

  // Apply enhanced Excel formatting
  applyExcelFormatting(worksheet, headers) {
    if (!worksheet['!cols']) {
      worksheet['!cols'] = [];
    }

    // Auto-resize columns
    headers.forEach((header, index) => {
      const maxLength = Math.max(
        header.length,
        20 // Minimum width
      );
      worksheet['!cols'][index] = { wch: Math.min(maxLength, 50) }; // Max width 50
    });

    // Add header formatting
    if (!worksheet['!merges']) {
      worksheet['!merges'] = [];
    }

    return worksheet;
  }

  // Enhanced summary sheet
  createEnhancedSummarySheet(summary, _options) {
    const now = new Date();
    const sheetData = [
      ['📊 Gallery Scraper Report - Enterprise Edition', ''],
      ['', ''],
      ['Export Information', ''],
      ['Total Items', summary.totalItems || 0],
      ['Successful Extractions', summary.successful || 0],
      ['Failed Extractions', summary.failed || 0],
      ['Duplicate Items', summary.duplicates || 0],
      ['Success Rate', summary.totalItems ? `${Math.round((summary.successful || 0) / summary.totalItems * 100)}%` : '0%'],
      ['', ''],
      ['Performance Metrics', ''],
      ['Average Processing Time', summary.averageProcessingTime || 0],
      ['Total Processing Time', summary.totalProcessingTime || 0],
      ['Items per Second', summary.throughput || 0],
      ['Memory Peak Usage', this.formatBytes(this.getMemoryUsage())],
      ['', ''],
      ['Source Information', ''],
      ['Source URL', summary.sourceUrl || ''],
      ['Export Date', now.toISOString()],
      ['Export Time (Local)', now.toLocaleString()],
      ['User Agent', navigator.userAgent.substring(0, 100) + '...']
    ];

    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  // Enhanced statistics sheet
  createEnhancedStatsSheet(data, _options) {
    const sheetData = [
      ['📈 Advanced Statistics', ''],
      ['', ''],
      ['Extraction Methods', 'Count', 'Success Rate']
    ];

    if (data.extractionMethods) {
      data.extractionMethods.forEach(method => {
        const successRate = method.successful && method.count ? 
          `${Math.round(method.successful / method.count * 100)}%` : 'N/A';
        sheetData.push([method.name, method.count, successRate]);
      });
    }

    sheetData.push(['', '', '']);
    sheetData.push(['Error Analysis', 'Count', 'Percentage']);

    if (data.errorStats) {
      const totalErrors = Object.values(data.errorStats).reduce((sum, count) => sum + count, 0);
      Object.entries(data.errorStats).forEach(([type, count]) => {
        const percentage = totalErrors ? `${Math.round(count / totalErrors * 100)}%` : '0%';
        sheetData.push([type, count, percentage]);
      });
    }

    sheetData.push(['', '', '']);
    sheetData.push(['Export Performance', 'Value', 'Unit']);
    sheetData.push(['Total Exports This Session', this.exportStats.totalExports, 'exports']);
    sheetData.push(['Average Export Time', Math.round(this.exportStats.averageExportTime), 'ms']);
    sheetData.push(['Total Data Exported', this.formatBytes(this.exportStats.totalDataExported), 'bytes']);
    sheetData.push(['Recovered Errors', this.exportStats.recoveredErrors, 'errors']);

    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  // Enhanced error sheet
  createEnhancedErrorSheet(errors, _options) {
    const sheetData = [
      ['❌ Error Log', 'Timestamp', 'Type', 'Frequency'],
      ['', '', '', '']
    ];

    // Group errors by type
    const errorGroups = {};
    errors.forEach(error => {
      const errorStr = String(error);
      if (!errorGroups[errorStr]) {
        errorGroups[errorStr] = {
          message: errorStr,
          count: 0,
          firstSeen: Date.now(),
          lastSeen: Date.now()
        };
      }
      errorGroups[errorStr].count++;
      errorGroups[errorStr].lastSeen = Date.now();
    });

    // Add grouped errors to sheet
    Object.values(errorGroups).forEach(errorGroup => {
      sheetData.push([
        errorGroup.message,
        new Date(errorGroup.lastSeen).toLocaleString(),
        this.classifyError(errorGroup.message),
        errorGroup.count
      ]);
    });

    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  // Enhanced duplicate sheet
  createEnhancedDuplicateSheet(duplicateGroups, _options) {
    const sheetData = [
      ['🔄 Duplicate Analysis', 'Group Size', 'Similarity', 'Action'],
      ['', '', '', '']
    ];

    duplicateGroups.forEach((group, index) => {
      sheetData.push([
        `Group ${index + 1}`,
        group.items?.length || 0,
        group.similarity || 'N/A',
        group.action || 'Review Required'
      ]);

      // Add items in the group
      if (group.items) {
        group.items.forEach((item, itemIndex) => {
          sheetData.push([
            `  Item ${itemIndex + 1}`,
            item.image || item.url || '',
            item.text || '',
            ''
          ]);
        });
      }

      sheetData.push(['', '', '', '']); // Separator
    });

    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  // Performance metrics sheet
  createPerformanceMetricsSheet(data, _options) {
    const sheetData = [
      ['⚡ Performance Metrics', 'Value', 'Unit', 'Trend'],
      ['', '', '', ''],
      ['Processing Performance', '', '', ''],
      ['Items Processed', data.items?.length || 0, 'items', ''],
      ['Processing Speed', Math.round((data.items?.length || 0) / ((data.processingTime || 1000) / 1000)), 'items/sec', ''],
      ['Memory Usage Peak', this.formatBytes(this.getMemoryUsage()), 'bytes', ''],
      ['Batch Processing', data.items?.length > 500 ? 'Enabled' : 'Disabled', '', ''],
      ['', '', '', ''],
      ['Export Statistics', '', '', ''],
      ['Total Exports', this.exportStats.totalExports, 'exports', ''],
      ['Average Export Time', Math.round(this.exportStats.averageExportTime), 'ms', ''],
      ['Error Recovery Rate', this.exportStats.recoveredErrors, 'errors', ''],
      ['Large Dataset Exports', this.exportStats.largeDatasetExports, 'exports', ''],
      ['', '', '', ''],
      ['Quality Metrics', '', '', ''],
      ['Success Rate', data.summary?.successRate ? `${data.summary.successRate}%` : 'N/A', '%', ''],
      ['Data Completeness', this.calculateDataCompleteness(data.items), '%', ''],
      ['Export Reliability', this.calculateExportReliability(), '%', '']
    ];

    return XLSX.utils.aoa_to_sheet(sheetData);
  }

  // Enhanced HTML report generation
  async generateEnhancedHTMLReport(data, options, exportId) {
    const items = data.items || [];
    const summary = data.summary || {};
    const stats = this.exportStats;

    this.updateProgress(exportId, 20, 'Building HTML structure...');

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gallery Scraper Report - Enterprise Edition</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            line-height: 1.6; min-height: 100vh;
        }
        .container { 
            max-width: 1400px; margin: 0 auto; background: white; padding: 40px; 
            border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header { 
            text-align: center; margin-bottom: 40px; padding-bottom: 20px; 
            border-bottom: 3px solid #667eea;
        }
        h1 { 
            color: #2563eb; margin: 0 0 10px 0; font-size: 3em; font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .subtitle { color: #6b7280; font-size: 1.2em; margin: 0; }
        .export-info { 
            background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;
            border-left: 4px solid #667eea;
        }
        h2 { 
            color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; 
            margin-top: 50px; font-size: 1.8em; position: relative;
        }
        h2::before {
            content: ''; position: absolute; bottom: -2px; left: 0; width: 60px; height: 2px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .summary { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 25px; margin: 40px 0;
        }
        .stat-card { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 25px; border-radius: 12px; text-align: center;
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3); transition: transform 0.3s;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-number { font-size: 2.5em; font-weight: bold; display: block; margin-bottom: 5px; }
        .stat-label { opacity: 0.95; font-size: 1.1em; }
        .performance-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px; margin: 30px 0;
        }
        .performance-card {
            background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;
            text-align: center;
        }
        .performance-value { font-size: 1.8em; font-weight: bold; color: #667eea; }
        .performance-label { color: #6b7280; margin-top: 5px; }
        .items-grid { 
            display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
            gap: 25px; margin-top: 40px;
        }
        .item-card { 
            background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; 
            transition: all 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        .item-card:hover { 
            transform: translateY(-5px); box-shadow: 0 12px 30px rgba(0,0,0,0.15);
            border-color: #667eea;
        }
        .item-image { 
            width: 100%; height: 220px; background: #f3f4f6; display: flex; 
            align-items: center; justify-content: center; overflow: hidden; position: relative;
        }
        .item-image img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .item-image .no-image { 
            color: #9ca3af; font-size: 3em; opacity: 0.5;
        }
        .item-info { padding: 20px; }
        .item-title { 
            font-weight: 600; margin: 0 0 12px 0; color: #1f2937; font-size: 1.1em;
            line-height: 1.4;
        }
        .item-url { 
            font-size: 0.9em; color: #6b7280; word-break: break-all; margin: 8px 0;
            background: #f8fafc; padding: 8px; border-radius: 6px;
        }
        .item-meta { 
            display: flex; justify-content: space-between; align-items: center; 
            font-size: 0.85em; color: #9ca3af; margin-top: 15px; flex-wrap: wrap; gap: 8px;
        }
        .quality-score { 
            display: inline-block; background: #10b981; color: white; 
            padding: 4px 10px; border-radius: 15px; font-weight: 500;
        }
        .extraction-method {
            background: #667eea; color: white; padding: 4px 10px; border-radius: 15px;
            font-weight: 500;
        }
        table { 
            width: 100%; border-collapse: collapse; margin-top: 25px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-radius: 8px; overflow: hidden;
        }
        th, td { border: none; padding: 15px; text-align: left; }
        th { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; font-weight: 600;
        }
        tr:nth-child(even) { background: #f8fafc; }
        tr:hover { background: #e0e7ff; }
        .error-list { 
            background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; 
            padding: 20px; margin: 20px 0;
        }
        .error-item { 
            color: #dc2626; margin: 8px 0; padding: 8px; background: white; 
            border-radius: 6px; border-left: 4px solid #dc2626;
        }
        .footer { 
            margin-top: 60px; text-align: center; color: #6b7280; font-size: 0.9em;
            padding-top: 30px; border-top: 1px solid #e5e7eb;
        }
        .export-badge {
            display: inline-block; background: #667eea; color: white; padding: 6px 12px;
            border-radius: 20px; font-size: 0.8em; margin: 0 5px;
        }
        @media print {
            body { background: white; }
            .container { box-shadow: none; margin: 0; }
            .item-card { break-inside: avoid; }
        }
        @media (max-width: 768px) {
            .container { padding: 20px; }
            .summary { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
            .items-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Gallery Scraper Report</h1>
            <p class="subtitle">Enterprise Edition - Advanced Analytics & Performance Metrics</p>
            <div class="export-info">
                <strong>Export ID:</strong> ${exportId} • 
                <strong>Generated:</strong> ${new Date().toLocaleString()} • 
                <span class="export-badge">v2.0</span>
            </div>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <span class="stat-number">${items.length}</span>
                <span class="stat-label">Total Items</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${summary.successful || items.length}</span>
                <span class="stat-label">Successful</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${summary.failed || 0}</span>
                <span class="stat-label">Failed</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${summary.duplicates || 0}</span>
                <span class="stat-label">Duplicates</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${summary.successRate || Math.round((summary.successful || items.length) / (items.length || 1) * 100)}%</span>
                <span class="stat-label">Success Rate</span>
            </div>
        </div>

        <h2>⚡ Performance Metrics</h2>
        <div class="performance-grid">
            <div class="performance-card">
                <div class="performance-value">${Math.round(summary.throughput || 0)}</div>
                <div class="performance-label">Items/Second</div>
            </div>
            <div class="performance-card">
                <div class="performance-value">${this.formatTime(summary.totalProcessingTime || 0)}</div>
                <div class="performance-label">Processing Time</div>
            </div>
            <div class="performance-card">
                <div class="performance-value">${this.formatBytes(this.getMemoryUsage())}</div>
                <div class="performance-label">Memory Usage</div>
            </div>
            <div class="performance-card">
                <div class="performance-value">${stats.totalExports}</div>
                <div class="performance-label">Total Exports</div>
            </div>
        </div>

        <h2>📋 Export Information</h2>
        <table>
            <tr><th>Property</th><th>Value</th></tr>
            <tr><td><strong>Export Date</strong></td><td>${new Date().toLocaleString()}</td></tr>
            <tr><td><strong>Source URL</strong></td><td><a href="${summary.sourceUrl || 'unknown'}" target="_blank">${summary.sourceUrl || 'unknown'}</a></td></tr>
            <tr><td><strong>Processing Mode</strong></td><td>${items.length >= options.streamingThreshold ? 'Streaming (Large Dataset)' : 'Standard'}</td></tr>
            <tr><td><strong>Total File Size</strong></td><td>${this.formatBytes(stats.totalDataExported)}</td></tr>
            <tr><td><strong>Average Export Time</strong></td><td>${this.formatTime(stats.averageExportTime)}</td></tr>
            <tr><td><strong>Error Recovery Rate</strong></td><td>${stats.recoveredErrors} errors recovered</td></tr>
            <tr><td><strong>User Agent</strong></td><td>${navigator.userAgent.substring(0, 80)}...</td></tr>
        </table>

        ${data.errors && data.errors.length > 0 ? `
        <h2>❌ Errors & Issues</h2>
        <div class="error-list">
            ${data.errors.slice(0, 10).map(error => `<div class="error-item">• ${error}</div>`).join('')}
            ${data.errors.length > 10 ? `<div class="error-item"><em>... and ${data.errors.length - 10} more errors</em></div>` : ''}
        </div>
        ` : ''}

        <h2>🖼️ Extracted Items</h2>
        <div class="items-grid">
            ${items.slice(0, 100).map((item, index) => `
                <div class="item-card">
                    <div class="item-image">
                        ${item.thumbnail || item.image ?
                            `<img src="${item.thumbnail || item.image}" alt="Image ${index + 1}" loading="lazy" onerror="this.style.display='none'; this.parentNode.innerHTML='<span class=\\"no-image\\">🖼️</span>'">` :
                            '<span class="no-image">🖼️</span>'
                        }
                    </div>
                    <div class="item-info">
                        <div class="item-title">${this.escapeHtml(item.text || `Item ${index + 1}`)}</div>
                        ${item.image ? `<div class="item-url">🖼️ ${this.escapeHtml(item.image)}</div>` : ''}
                        ${item.link ? `<div class="item-url">🔗 <a href="${item.link}" target="_blank">Source Link</a></div>` : ''}
                        <div class="item-meta">
                            <span class="extraction-method">${item.extractionMethod || 'standard'}</span>
                            ${item.enhanced?.qualityScore ? `<span class="quality-score">${item.enhanced.qualityScore}/100</span>` : ''}
                            ${item.enhanced?.processingTime ? `<span>${item.enhanced.processingTime}ms</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        ${items.length > 100 ? `<p style="text-align: center; color: #6b7280; font-style: italic; margin: 30px 0;">Showing first 100 items of ${items.length} total for performance reasons.</p>` : ''}
        
        <h2>📈 Advanced Statistics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th><th>Details</th></tr>
            ${data.extractionMethods ? data.extractionMethods.map(method =>
                `<tr><td>${method.name}</td><td>${method.count} items</td><td>${method.successful ? `${Math.round(method.successful/method.count*100)}% success rate` : 'N/A'}</td></tr>`
            ).join('') : ''}
            <tr><td>Data Completeness</td><td>${this.calculateDataCompleteness(items)}%</td><td>Percentage of items with complete data</td></tr>
            <tr><td>Export Reliability</td><td>${this.calculateExportReliability()}%</td><td>System reliability based on error rates</td></tr>
            <tr><td>Processing Efficiency</td><td>${Math.round((items.length || 0) / ((summary.totalProcessingTime || 1000) / 1000))} items/sec</td><td>Overall processing speed</td></tr>
        </table>
        
        <div class="footer">
            <p>Generated by <strong>StepThree Gallery Scraper v2.0 Enterprise Edition</strong></p>
            <p>Export completed ${new Date().toLocaleString()} • Report ID: ${exportId}</p>
            <p>🚀 Enhanced with enterprise-grade reliability features</p>
        </div>
    </div>

    <script>
        // Add interactive features
        document.querySelectorAll('.item-card').forEach(card => {
            card.addEventListener('click', () => {
                card.style.transform = card.style.transform ? '' : 'scale(1.02)';
            });
        });

        // Performance monitoring
        if (!this.PRODUCTION) console.log('📊 Report loaded successfully');
        if (!this.PRODUCTION) console.log('📈 Performance metrics available in export system');
    </script>
</body>
</html>`;

    this.updateProgress(exportId, 70, 'Finalizing HTML report...');
    return reportHtml;
  }

  // Enhanced XML content generation
  async generateEnhancedXMLContent(data, options, exportId) {
    this.updateProgress(exportId, 20, 'Building XML structure...');

    const escape = (str) => String(str).replace(/[<>&'"]/g, (c) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[c]));

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<ScrapingReport version="2.0" exportId="${exportId}" exportDate="${new Date().toISOString()}">\n`;
    
    // Enhanced metadata
    xml += '  <Metadata>\n';
    xml += `    <ExportVersion>2.0</ExportVersion>\n`;
    xml += `    <ExportId>${exportId}</ExportId>\n`;
    xml += `    <ProcessingMode>${data.items?.length >= options.streamingThreshold ? 'streaming' : 'standard'}</ProcessingMode>\n`;
    xml += `    <UserAgent>${escape(navigator.userAgent)}</UserAgent>\n`;
    xml += '  </Metadata>\n';
    
    xml += '  <Summary>\n';
    xml += `    <TotalItems>${data.items?.length || 0}</TotalItems>\n`;
    xml += `    <SuccessfulItems>${data.summary?.successful || 0}</SuccessfulItems>\n`;
    xml += `    <FailedItems>${data.summary?.failed || 0}</FailedItems>\n`;
    xml += `    <DuplicateItems>${data.summary?.duplicates || 0}</DuplicateItems>\n`;
    xml += `    <SuccessRate>${data.summary?.successRate || Math.round((data.summary?.successful || 0) / (data.items?.length || 1) * 100)}%</SuccessRate>\n`;
    xml += `    <SourceUrl>${escape(data.summary?.sourceUrl || 'unknown')}</SourceUrl>\n`;
    xml += `    <ProcessingTime>${data.summary?.totalProcessingTime || 0}ms</ProcessingTime>\n`;
    xml += `    <Throughput>${Math.round(data.summary?.throughput || 0)} items/sec</Throughput>\n`;
    xml += '  </Summary>\n';
    
    this.updateProgress(exportId, 40, 'Processing items for XML...');
    
    xml += '  <Items>\n';

    const items = data.items || [];
    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      this.updateProgress(exportId, 40 + (i / items.length) * 40, 
        `Processing XML items ${i + 1}-${Math.min(i + batchSize, items.length)}...`);

      batch.forEach((item, index) => {
        const globalIndex = i + index + 1;
        xml += `    <Item id="${globalIndex}">\n`;
        xml += `      <ImageUrl>${escape(item.image || '')}</ImageUrl>\n`;
        xml += `      <ThumbnailUrl>${escape(item.thumbnail || '')}</ThumbnailUrl>\n`;
        xml += `      <Link>${escape(item.link || '')}</Link>\n`;
        xml += `      <Text>${escape(item.text || '')}</Text>\n`;
        xml += `      <ExtractionMethod>${escape(item.extractionMethod || 'standard')}</ExtractionMethod>\n`;
        
        if (item.enhanced) {
          xml += `      <QualityScore>${item.enhanced.qualityScore || 0}</QualityScore>\n`;
          xml += `      <ProcessingTime>${item.enhanced.processingTime || 0}ms</ProcessingTime>\n`;
        }
        
        if (item.metadata) {
          xml += `      <Metadata>\n`;
          xml += `        <ContainerInfo>${escape(item.metadata.containerInfo || '')}</ContainerInfo>\n`;
          xml += `        <ElementClasses>${escape(item.metadata.elementClasses || '')}</ElementClasses>\n`;
          xml += `      </Metadata>\n`;
        }
        
        xml += '    </Item>\n';
      });

      // Allow other tasks to run
      if (i % (batchSize * 5) === 0) {
        await this.delay(1);
      }
    }

    xml += '  </Items>\n';

    // Add performance metrics
    xml += '  <Performance>\n';
    xml += `    <MemoryUsage>${this.getMemoryUsage()}</MemoryUsage>\n`;
    xml += `    <TotalExports>${this.exportStats.totalExports}</TotalExports>\n`;
    xml += `    <AverageExportTime>${Math.round(this.exportStats.averageExportTime)}ms</AverageExportTime>\n`;
    xml += `    <RecoveredErrors>${this.exportStats.recoveredErrors}</RecoveredErrors>\n`;
    xml += '  </Performance>\n';

    xml += '</ScrapingReport>';

    this.updateProgress(exportId, 80, 'Finalizing XML content...');
    return xml;
  }

  // Export cancellation system
  async cancelExport(exportId, reason = 'User cancelled') {
    if (!this.activeExports.has(exportId)) {
      return { success: false, error: 'Export not found or already completed' };
    }

    try {
      const exportInfo = this.activeExports.get(exportId);
      
      // Mark as cancelled
      exportInfo.cancelled = true;
      exportInfo.cancellationReason = reason;
      exportInfo.cancelledAt = Date.now();
      
      if (!this.PRODUCTION) console.log(`🚫 Cancelling export ${exportId}: ${reason}`);
      
      // Update progress to show cancellation
      this.updateProgress(exportId, exportInfo.currentProgress, `Cancelling: ${reason}`);
      
      // Cleanup resources
      await this.cleanupExport(exportId);
      
      // Enforce memory limit before adding to history
      if (this.exportHistory.length >= this.MAX_EXPORT_HISTORY) {
        this.exportHistory.shift(); // Remove oldest entry (at beginning since using push)
      }
      // Add to history as cancelled
      this.exportHistory.push({
        timestamp: Date.now(),
        exportId,
        cancelled: true,
        cancellationReason: reason,
        exportTime: Date.now() - exportInfo.startTime,
        success: false,
        itemsProcessed: exportInfo.currentProgress || 0
      });
      
      // Show notification
      await this.showNotification('Export Cancelled', 
        `Export ${exportId} was cancelled: ${reason}`, 'warning');
      
      return { 
        success: true, 
        exportId, 
        message: 'Export cancelled successfully',
        itemsProcessed: exportInfo.currentProgress || 0,
        elapsedTime: Date.now() - exportInfo.startTime
      };
      
    } catch (error) {
      console.error(`❌ Failed to cancel export ${exportId}:`, error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  // Cancel all active exports
  async cancelAllExports(reason = 'Bulk cancellation') {
    const exportIds = Array.from(this.activeExports.keys());
    const results = [];
    
    if (!this.PRODUCTION) console.log(`🚫 Cancelling ${exportIds.length} active exports...`);
    
    for (const exportId of exportIds) {
      const result = await this.cancelExport(exportId, reason);
      results.push({ exportId, ...result });
    }
    
    return {
      success: true,
      cancelledExports: results.filter(r => r.success).length,
      failedCancellations: results.filter(r => !r.success).length,
      results
    };
  }

  // Check if export is cancelled (to be called during processing)
  isExportCancelled(exportId) {
    const exportInfo = this.activeExports.get(exportId);
    return exportInfo ? exportInfo.cancelled === true : false;
  }

  // Check if export is paused
  isExportPaused(exportId) {
    const exportInfo = this.activeExports.get(exportId);
    return exportInfo ? exportInfo.paused === true : false;
  }

  // Wait for resume if export is paused
  async waitForResume(exportId) {
    return new Promise((resolve) => {
      const checkResume = () => {
        if (this.isExportCancelled(exportId)) {
          resolve(false); // Return false to indicate cancellation
        } else if (!this.isExportPaused(exportId)) {
          resolve(true); // Return true to continue
        } else {
          // Check again in 100ms
          setTimeout(checkResume, 100);
        }
      };
      checkResume();
    });
  }

  // Enhanced method with pause/resume support for processing loops
  async checkExportStatus(exportId) {
    if (this.isExportCancelled(exportId)) {
      throw new Error('Export was cancelled by user');
    }
    
    if (this.isExportPaused(exportId)) {
      if (!this.PRODUCTION) console.log(`⏸️ Export ${exportId} paused, waiting for resume...`);
      await this.showNotification('Export Paused', 'Export has been paused. You can resume it anytime.', 'info');
      
      const shouldContinue = await this.waitForResume(exportId);
      if (!shouldContinue) {
        throw new Error('Export was cancelled while paused');
      }
      
      if (!this.PRODUCTION) console.log(`▶️ Export ${exportId} resumed`);
      await this.showNotification('Export Resumed', 'Export has been resumed and will continue processing.', 'info');
    }
  }

  // Get list of active exports
  getActiveExports() {
    const activeExports = [];
    
    for (const [exportId, info] of this.activeExports.entries()) {
      activeExports.push({
        exportId,
        startTime: info.startTime,
        currentProgress: info.currentProgress,
        currentStatus: info.currentStatus,
        elapsedTime: Date.now() - info.startTime,
        totalItems: info.totalItems,
        cancelled: info.cancelled || false
      });
    }
    
    return activeExports;
  }

  // Progress tracking system
  generateExportId() {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeProgressTracking(exportId, totalItems) {
    this.activeExports.set(exportId, {
      totalItems,
      startTime: Date.now(),
      currentProgress: 0,
      currentStatus: 'Starting export...',
      stage: 'initialization'
    });
    
    if (!this.PRODUCTION) console.log(`🎯 Progress tracking initialized for export ${exportId}`);
  }

  updateProgress(exportId, percentage, status) {
    if (this.activeExports.has(exportId)) {
      const exportInfo = this.activeExports.get(exportId);
      exportInfo.currentProgress = Math.min(100, Math.max(0, percentage));
      exportInfo.currentStatus = status;
      exportInfo.lastUpdate = Date.now();
      
      // Call registered progress callbacks
      if (this.progressCallbacks.has(exportId)) {
        this.progressCallbacks.get(exportId).forEach(callback => {
          try {
            callback({
              exportId,
              progress: exportInfo.currentProgress,
              status: status,
              totalItems: exportInfo.totalItems,
              elapsedTime: Date.now() - exportInfo.startTime
            });
          } catch (error) {
            console.warn('Progress callback error:', error);
          }
        });
      }
      
      // Log significant progress milestones
      if (percentage % 25 === 0 || percentage === 100) {
        if (!this.PRODUCTION) console.log(`📊 Export ${exportId}: ${percentage}% - ${status}`);
      }
    }
  }

  // Register progress callback
  onProgress(exportId, callback) {
    if (!this.progressCallbacks.has(exportId)) {
      this.progressCallbacks.set(exportId, new Set());
    }
    this.progressCallbacks.get(exportId).add(callback);
  }

  // Memory management
  scheduleMemoryManagement() {
    const now = Date.now();
    if (now - this.lastGC > this.gcInterval) {
      this.performMemoryCleanup();
      this.lastGC = now;
    }
  }

  async performMemoryCleanup() {
    // Clear old temporary data
    const cutoff = Date.now() - 300000; // 5 minutes ago
    for (const [key, value] of this.tempData.entries()) {
      if (value.timestamp && value.timestamp < cutoff) {
        this.tempData.delete(key);
      }
    }

    // Suggest garbage collection
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }

    // Update memory usage tracking
    this.performanceMetrics.memoryUsage.push({
      timestamp: Date.now(),
      usage: this.getMemoryUsage()
    });

    // Keep only recent memory usage data
    if (this.performanceMetrics.memoryUsage.length > 100) {
      this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage.slice(-50);
    }

    if (!this.PRODUCTION) console.log('🧹 Memory cleanup performed');
  }

  getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  // Enhanced statistics tracking
  updateEnhancedStats(format, exportTime, fileSize, itemCount, exportId) {
    this.exportStats.totalExports++;
    this.exportStats.formatCounts[format] = (this.exportStats.formatCounts[format] || 0) + 1;
    this.exportStats.averageExportTime =
      (this.exportStats.averageExportTime * (this.exportStats.totalExports - 1) + exportTime) /
      this.exportStats.totalExports;
    this.exportStats.totalDataExported += fileSize;

    // Track memory peak
    const currentMemory = this.getMemoryUsage();
    if (currentMemory > this.exportStats.memoryPeakUsage) {
      this.exportStats.memoryPeakUsage = currentMemory;
    }

    // Track performance metrics
    this.performanceMetrics.processingTimes.push({
      exportId,
      format,
      itemCount,
      exportTime,
      timestamp: Date.now()
    });

    // Keep only recent metrics
    if (this.performanceMetrics.processingTimes.length > 50) {
      this.performanceMetrics.processingTimes = this.performanceMetrics.processingTimes.slice(-25);
    }
  }

  // User notification system
  async showNotification(title, message, type = 'info') {
    const notification = {
      title,
      message,
      type,
      timestamp: Date.now()
    };

    // Call registered notification callbacks
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.warn('Notification callback error:', error);
      }
    });

    // Console logging with emojis
    const emoji = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
    if (!this.PRODUCTION) console.log(`${emoji} ${title}: ${message}`);
  }

  onNotification(callback) {
    this.notificationCallbacks.add(callback);
  }

  removeNotificationCallback(callback) {
    this.notificationCallbacks.delete(callback);
  }

  // Error handling utilities
  /**
   * Safely extract error message from any error type
   * @param {*} error - Error object, string, or any value
   * @returns {string} Safe error message string
   */
  getErrorMessage(error) {
    if (!error) {
      return 'Unknown error occurred';
    }
    if (error instanceof Error) {
      return error.message || 'Error occurred';
    }
    if (typeof error === 'string') {
      return error;
    }
    if (typeof error === 'object' && error.message) {
      return String(error.message);
    }
    return String(error);
  }

  getUserFriendlyError(errorMessage) {
    const errorMappings = {
      'XLSX library': 'Excel library loading issue - try refreshing the page',
      'Failed to fetch': 'Network connectivity issue - check your internet connection',
      'Invalid data format': 'Data formatting issue - the scraped data may be corrupted',
      'Memory allocation': 'Out of memory - try reducing the dataset size or using batch processing',
      'Quota exceeded': 'Storage quota exceeded - try clearing browser data or using smaller datasets'
    };

    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMessage.includes(key)) {
        return value;
      }
    }

    return 'An unexpected error occurred - please try again or contact support';
  }

  classifyError(errorMessage) {
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) return 'Network';
    if (errorMessage.includes('memory') || errorMessage.includes('allocation')) return 'Memory';
    if (errorMessage.includes('library') || errorMessage.includes('XLSX')) return 'Library';
    if (errorMessage.includes('data') || errorMessage.includes('format')) return 'Data';
    if (errorMessage.includes('permission') || errorMessage.includes('access')) return 'Permission';
    return 'System';
  }

  // Data quality analysis
  calculateDataCompleteness(items) {
    if (!items || items.length === 0) return 0;

    let completeItems = 0;
    items.forEach(item => {
      let completeness = 0;
      if (item.image) completeness += 0.4;
      if (item.text) completeness += 0.3;
      if (item.link) completeness += 0.2;
      if (item.thumbnail) completeness += 0.1;
      
      if (completeness >= 0.7) completeItems++; // Consider 70%+ as complete
    });

    return Math.round((completeItems / items.length) * 100);
  }

  calculateExportReliability() {
    const totalExports = this.exportStats.totalExports;
    if (totalExports === 0) return 100;

    const failureRate = this.exportHistory.filter(exp => !exp.success).length / totalExports;
    const recoveryRate = this.exportStats.recoveredErrors / Math.max(totalExports, 1);
    
    const reliability = Math.max(0, 100 - (failureRate * 100) + (recoveryRate * 10));
    return Math.round(Math.min(100, reliability));
  }

  // Utility methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  flattenItemForExcel(item) {
    const flatItem = [];
    
    if (item.filename) flatItem.push(item.filename);
    else if (item.name) flatItem.push(item.name);
    else flatItem.push('');
    
    flatItem.push(item.url || item.image || '');
    flatItem.push(item.width || '');
    flatItem.push(item.height || '');
    flatItem.push(item.altText || item.alt || '');
    flatItem.push(item.pageTitle || '');
    flatItem.push(item.timestamp ? new Date(item.timestamp).toISOString() : '');
    flatItem.push(item.size || item.fileSize || '');
    flatItem.push(item.thumbnailUrl || item.thumbnail || '');
    flatItem.push(item.link || '');
    flatItem.push(item.confidenceScore !== undefined ? item.confidenceScore : '');
    flatItem.push(item.discoveryMethod || '');
    flatItem.push(item.category || '');
    flatItem.push(item.extractionMethod || '');
    flatItem.push(item.processingTime || '');
    flatItem.push(item.sourceDomain || item.source || '');
    
    return flatItem;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  escapeHtml(text) {
    if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    // Fallback for service worker environment
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Helper methods for enhanced metadata
  extractDomainFromItems(items) {
    if (!items || items.length === 0) return 'Unknown';
    try {
      const firstUrl = items[0].image || items[0].url;
      return firstUrl ? new URL(firstUrl).hostname : 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  calculateConfidenceDistribution(items) {
    if (!items || items.length === 0) return { high: 0, medium: 0, low: 0, unknown: 0 };
    
    const distribution = { high: 0, medium: 0, low: 0, unknown: 0 };
    items.forEach(item => {
      const confidence = item.confidence;
      if (confidence >= 0.75) distribution.high++;
      else if (confidence >= 0.5) distribution.medium++;
      else if (confidence >= 0.3) distribution.low++;
      else distribution.unknown++;
    });
    return distribution;
  }

  analyzeDiscoveryMethods(items) {
    if (!items || items.length === 0) return {};
    
    const methods = {};
    items.forEach(item => {
      const method = item.discoveryMethod || 'unknown';
      methods[method] = (methods[method] || 0) + 1;
    });
    return methods;
  }

  cleanupExport(exportId) {
    this.activeExports.delete(exportId);
    this.progressCallbacks.delete(exportId);
    
    // Clean up any temporary data for this export
    for (const [key, value] of this.tempData.entries()) {
      if (key.includes(exportId)) {
        this.tempData.delete(key);
      }
    }
  }

  // =============================================================================
  // EXPORT PREVIEW AND FIELD SELECTION SYSTEM
  // =============================================================================

  /**
   * Generate export preview for user to see sample data before exporting
   * @param {Object} data - Export data
   * @param {string} format - Export format (csv, xlsx, json, html)
   * @param {Object} options - Export options including field selection
   * @returns {Object} Preview data with sample rows and estimated file size
   */
  async generateExportPreview(data, format, options = {}) {
    try {
      const items = Array.isArray(data.items) ? data.items : [data.items];
      const previewItemCount = Math.min(options.previewRows || 5, items.length);
      const previewItems = items.slice(0, previewItemCount);
      
      // Get available fields
      const availableFields = this.getAvailableFields(items);
      
      // Use selected fields or default comprehensive fields
      const selectedFields = options.selectedFields || availableFields.slice(0, 10);
      
      let preview = {
        format: format.toUpperCase(),
        totalItems: items.length,
        previewItems: previewItemCount,
        selectedFields: selectedFields,
        availableFields: availableFields,
        estimatedSize: this.estimateExportSize(items, format, options),
        sampleData: null
      };

      // Generate format-specific preview
      switch (format.toLowerCase()) {
        case 'csv':
          preview.sampleData = this.generateCSVPreview(previewItems, selectedFields, options);
          break;
        case 'xlsx':
        case 'excel':
          preview.sampleData = this.generateXLSXPreview(previewItems, selectedFields, options);
          break;
        case 'json':
          preview.sampleData = this.generateJSONPreview(previewItems, selectedFields, options);
          break;
        case 'html':
          preview.sampleData = this.generateHTMLPreview(previewItems, selectedFields, options);
          break;
        default:
          preview.sampleData = this.generateGenericPreview(previewItems, selectedFields, options);
      }

      return {
        success: true,
        preview: preview
      };
    } catch (error) {
      console.error('❌ Failed to generate export preview:', error);
      const errorMessage = this.getErrorMessage(error);
      return {
        success: false,
        error: errorMessage,
        userFriendlyError: this.getUserFriendlyError(errorMessage)
      };
    }
  }

  /**
   * Get all available fields from the dataset
   */
  getAvailableFields(items) {
    if (!items || items.length === 0) return [];
    
    const fieldSet = new Set();
    const fieldPriority = {
      // Core fields (always first)
      'filename': 1,
      'url': 2, 
      'width': 3,
      'height': 4,
      'altText': 5,
      'pageTitle': 6,
      'timestamp': 7,
      // Secondary fields
      'size': 8,
      'thumbnailUrl': 9,
      'link': 10,
      'confidenceScore': 11,
      'discoveryMethod': 12,
      'status': 13,
      'category': 14
    };
    
    // Analyze sample items to discover fields
    const sampleSize = Math.min(10, items.length);
    for (let i = 0; i < sampleSize; i++) {
      const item = items[i];
      
      // Add standard fields that exist
      Object.keys(fieldPriority).forEach(field => {
        if (this.extractFieldValue(item, field)) {
          fieldSet.add(field);
        }
      });
      
      // Add dynamic fields from item properties
      Object.keys(item).forEach(key => {
        if (!fieldPriority[key] && item[key] !== undefined && item[key] !== null && item[key] !== '') {
          fieldSet.add(key);
        }
      });
      
      // Add metadata fields if available
      if (item.metadata) {
        Object.keys(item.metadata).forEach(key => {
          const metaKey = `metadata_${key}`;
          if (!fieldSet.has(metaKey)) {
            fieldSet.add(metaKey);
          }
        });
      }
    }
    
    // Convert to array and sort by priority
    const fieldsArray = Array.from(fieldSet);
    fieldsArray.sort((a, b) => {
      const priorityA = fieldPriority[a] || 999;
      const priorityB = fieldPriority[b] || 999;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.localeCompare(b);
    });
    
    return fieldsArray;
  }

  /**
   * Estimate export file size based on data and format
   */
  estimateExportSize(items, format, options) {
    if (!items || items.length === 0) return '0 bytes';
    
    // Sample first few items to estimate average size
    const sampleSize = Math.min(5, items.length);
    let totalSampleSize = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const item = items[i];
      const selectedFields = options.selectedFields || this.getAvailableFields([item]);
      
      selectedFields.forEach(field => {
        const value = String(this.extractFieldValue(item, field) || '');
        totalSampleSize += value.length;
      });
    }
    
    const avgItemSize = totalSampleSize / sampleSize;
    let estimatedSize = avgItemSize * items.length;
    
    // Format-specific size adjustments
    switch (format.toLowerCase()) {
      case 'xlsx':
        estimatedSize *= 1.5; // XLSX overhead
        break;
      case 'json':
        estimatedSize *= 1.3; // JSON formatting overhead
        break;
      case 'html':
        estimatedSize *= 2.0; // HTML markup overhead
        break;
      case 'xml':
        estimatedSize *= 1.8; // XML markup overhead
        break;
      // CSV is baseline
    }
    
    // Add metadata overhead
    if (options.includeMetadata !== false) {
      estimatedSize *= 1.2;
    }
    
    return this.formatBytes(Math.round(estimatedSize));
  }

  /**
   * Generate CSV preview
   */
  generateCSVPreview(items, selectedFields, options) {
    const headers = selectedFields.map(field => this.getFieldLabel(field));
    const rows = [headers];
    
    items.forEach(item => {
      const row = selectedFields.map(field => {
        const value = this.extractFieldValue(item, field);
        return String(value || '').substring(0, 100); // Truncate for preview
      });
      rows.push(row);
    });
    
    return {
      type: 'table',
      headers: headers,
      rows: rows.slice(1), // Exclude header row
      preview: rows.map(row => row.join(',')).join('\n')
    };
  }

  /**
   * Generate XLSX preview (similar to CSV but with formatting info)
   */
  generateXLSXPreview(items, selectedFields, options) {
    const csvPreview = this.generateCSVPreview(items, selectedFields, options);
    return {
      ...csvPreview,
      type: 'excel',
      features: [
        'Multiple worksheets (Items, Summary, Statistics)',
        'Auto-sized columns',
        'Header formatting',
        options.includeMetadata ? 'Metadata sheets' : null
      ].filter(Boolean)
    };
  }

  /**
   * Generate JSON preview
   */
  generateJSONPreview(items, selectedFields, options) {
    const sampleData = items.map(item => {
      const obj = {};
      selectedFields.forEach(field => {
        const value = this.extractFieldValue(item, field);
        if (value !== undefined && value !== null && value !== '') {
          obj[field] = typeof value === 'string' && value.length > 100 ? 
            value.substring(0, 100) + '...' : value;
        }
      });
      return obj;
    });
    
    return {
      type: 'json',
      structure: {
        items: sampleData,
        summary: options.includeMetadata ? '{ ... metadata ... }' : null,
        exportInfo: '{ ... export metadata ... }'
      },
      preview: JSON.stringify(sampleData, null, 2).substring(0, 1000) + (sampleData.length > 3 ? '\n  ...more items...' : '')
    };
  }

  /**
   * Generate HTML preview
   */
  generateHTMLPreview(items, selectedFields, options) {
    const headers = selectedFields.map(field => this.getFieldLabel(field));
    
    return {
      type: 'html',
      features: [
        'Responsive table layout',
        'Enhanced styling and formatting',
        'Export metadata section',
        'Visual summary statistics',
        'Print-friendly design'
      ],
      preview: `
<table>
  <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
${items.map(item => 
  `  <tr>${selectedFields.map(field => 
    `<td>${String(this.extractFieldValue(item, field) || '').substring(0, 50)}</td>`
  ).join('')}</tr>`
).join('\n')}
</table>`
    };
  }

  /**
   * Generate generic preview for other formats
   */
  generateGenericPreview(items, selectedFields, options) {
    return {
      type: 'generic',
      fields: selectedFields.map(field => ({
        key: field,
        label: this.getFieldLabel(field),
        sampleValue: String(this.extractFieldValue(items[0], field) || '').substring(0, 100)
      }))
    };
  }

  // =============================================================================
  // EXPORT TEMPLATES AND PRESETS SYSTEM
  // =============================================================================

  /**
   * Save an export template for reuse
   * SECURITY FIX: Updated to async for MV3-compliant chrome.storage.local usage
   */
  async saveExportTemplate(templateName, config) {
    try {
      const template = {
        name: templateName,
        created: Date.now(),
        config: {
          format: config.format,
          selectedFields: config.selectedFields,
          includeMetadata: config.includeMetadata,
          includeImages: config.includeImages,
          compressionLevel: config.compressionLevel,
          customOptions: config.customOptions || {}
        },
        usage: {
          useCount: 0,
          lastUsed: null
        }
      };

      // Store in chrome.storage.local (MV3 compliant)
      const templates = await this.getStoredTemplates();
      templates[templateName] = template;
      await this.storeTemplates(templates);

      if (!this.PRODUCTION) console.log(`✅ Export template '${templateName}' saved successfully`);
      return { success: true, template };
    } catch (error) {
      console.error('❌ Failed to save export template:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  /**
   * Get all saved export templates
   * SECURITY FIX: Updated to async for MV3-compliant chrome.storage.local usage
   */
  async getExportTemplates() {
    try {
      const templates = await this.getStoredTemplates();
      return {
        success: true,
        templates: Object.values(templates).sort((a, b) => b.created - a.created)
      };
    } catch (error) {
      console.error('❌ Failed to get export templates:', error);
      return { success: false, error: this.getErrorMessage(error), templates: [] };
    }
  }

  /**
   * Delete an export template
   * SECURITY FIX: Updated to async for MV3-compliant chrome.storage.local usage
   */
  async deleteExportTemplate(templateName) {
    try {
      const templates = await this.getStoredTemplates();
      if (templates[templateName]) {
        delete templates[templateName];
        await this.storeTemplates(templates);
        if (!this.PRODUCTION) console.log(`✅ Export template '${templateName}' deleted`);
        return { success: true };
      } else {
        return { success: false, error: 'Template not found' };
      }
    } catch (error) {
      console.error('❌ Failed to delete export template:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  /**
   * Use an export template (increment usage stats)
   * SECURITY FIX: Updated to async for MV3-compliant chrome.storage.local usage
   */
  async useExportTemplate(templateName) {
    try {
      const templates = await this.getStoredTemplates();
      if (templates[templateName]) {
        templates[templateName].usage.useCount++;
        templates[templateName].usage.lastUsed = Date.now();
        await this.storeTemplates(templates);
        return { success: true, config: templates[templateName].config };
      } else {
        return { success: false, error: 'Template not found' };
      }
    } catch (error) {
      console.error('❌ Failed to use export template:', error);
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  /**
   * Get stored templates from chrome.storage.local (MV3 compliant)
   * SECURITY FIX: Replaced localStorage with chrome.storage.local for MV3 compliance
   */
  async getStoredTemplates() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['stepthree_export_templates']);
        return result.stepthree_export_templates || {};
      }
      return {};
    } catch (error) {
      console.warn('Failed to load export templates from storage:', error);
      return {};
    }
  }

  /**
   * Store templates to chrome.storage.local (MV3 compliant)
   * SECURITY FIX: Replaced localStorage with chrome.storage.local for MV3 compliance
   */
  async storeTemplates(templates) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ stepthree_export_templates: templates });
      }
    } catch (error) {
      console.warn('Failed to store export templates:', error);
    }
  }

  /**
   * Get predefined export presets
   */
  getPredefinedPresets() {
    return {
      'Quick Basic': {
        name: 'Quick Basic',
        description: 'Essential fields for quick exports',
        config: {
          format: 'csv',
          selectedFields: ['filename', 'url', 'width', 'height', 'altText'],
          includeMetadata: false,
          includeImages: false
        }
      },
      'Complete Dataset': {
        name: 'Complete Dataset',
        description: 'All available fields with metadata',
        config: {
          format: 'xlsx',
          selectedFields: null, // Will use all available
          includeMetadata: true,
          includeImages: false,
          includePerformanceMetrics: true
        }
      },
      'Analysis Ready': {
        name: 'Analysis Ready',
        description: 'Optimized for data analysis with confidence scores',
        config: {
          format: 'csv',
          selectedFields: ['filename', 'url', 'width', 'height', 'confidenceScore', 'discoveryMethod', 'timestamp', 'sourceDomain'],
          includeMetadata: true,
          includeImages: false
        }
      },
      'Web Report': {
        name: 'Web Report',
        description: 'HTML report for web viewing and sharing',
        config: {
          format: 'html',
          selectedFields: ['filename', 'url', 'dimensions', 'altText', 'confidenceScore'],
          includeMetadata: true,
          includeImages: false
        }
      }
    };
  }

  // Backward compatibility methods (delegating to enhanced versions)
  async exportToExcel(data, filename, options) {
    const exportId = this.generateExportId();
    return await this.exportToExcelWithProgress(data, filename, options, exportId);
  }

  async exportToCSV(data, filename, options) {
    const exportId = this.generateExportId();
    return await this.exportToCSVWithProgress(data, filename, options, exportId);
  }

  async exportToJSON(data, filename, options) {
    const exportId = this.generateExportId();
    return await this.exportToJSONWithProgress(data, filename, options, exportId);
  }

  async exportToHTML(data, filename, options) {
    const exportId = this.generateExportId();
    return await this.exportToHTMLWithProgress(data, filename, options, exportId);
  }

  async exportToXML(data, filename, options) {
    const exportId = this.generateExportId();
    return await this.exportToXMLWithProgress(data, filename, options, exportId);
  }

  // exportToZip removed - ZIP functionality has been removed per requirements

  // Enhanced CSV headers with comprehensive metadata
  generateCSVHeaders(items, options) {
    // Use selectedFields from options if provided, otherwise use comprehensive defaults
    if (options.selectedFields && Array.isArray(options.selectedFields) && options.selectedFields.length > 0) {
      return options.selectedFields.map(field => this.getFieldLabel(field));
    }

    // Comprehensive header set with all required metadata fields
    const comprehensiveHeaders = [
      'Index',
      'Filename',
      'URL',
      'Width',
      'Height', 
      'Alt Text',
      'Page Title',
      'Timestamp',
      'File Size',
      'Thumbnail URL',
      'Source Link',
      'Confidence Score',
      'Discovery Method',
      'Queue Position',
      'Category',
      'Extraction Method',
      'Processing Time',
      'Source Domain',
      'Container Info',
      'Element Classes'
    ];

    // Add additional metadata headers based on available data
    if (options.includeMetadata && items.length > 0) {
      const sampleItem = items[0];
      if (sampleItem.enhanced) {
        comprehensiveHeaders.push('Quality Score Enhanced', 'Validation Status', 'Error Count');
      }
      if (sampleItem.metadata) {
        comprehensiveHeaders.push('Element Tag', 'CSS Classes', 'Data Attributes');
      }
      if (sampleItem.dimensions) {
        comprehensiveHeaders.push('Aspect Ratio', 'Orientation');
      }
    }

    return comprehensiveHeaders;
  }

  getFieldLabel(fieldKey) {
    const fieldLabels = {
      'filename': 'Filename',
      'url': 'URL',
      'width': 'Width',
      'height': 'Height',
      'altText': 'Alt Text',
      'pageTitle': 'Page Title',
      'timestamp': 'Timestamp',
      'size': 'File Size',
      'thumbnailUrl': 'Thumbnail URL',
      'link': 'Source Link',
      'confidenceScore': 'Confidence Score',
      'discoveryMethod': 'Discovery Method',
      'queuePosition': 'Queue Position',
      'category': 'Category',
      'extractionMethod': 'Extraction Method',
      'processingTime': 'Processing Time',
      'sourceDomain': 'Source Domain',
      'containerInfo': 'Container Info',
      'elementClasses': 'Element Classes',
      'status': 'Status',
      'dimensions': 'Dimensions',
      'caption': 'Caption',
      'resolution': 'Resolution',
      'downloadTime': 'Download Time',
      'retries': 'Retry Count',
      'agency': 'Photo Agency',
      'stockId': 'Stock ID',
      'aspectRatio': 'Aspect Ratio',
      'orientation': 'Orientation',
      'elementTag': 'Element Tag',
      'cssClasses': 'CSS Classes',
      'dataAttributes': 'Data Attributes',
      'validationStatus': 'Validation Status',
      'errorCount': 'Error Count'
    };

    return fieldLabels[fieldKey] || fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);
  }

  itemToCSVRow(item, headers, options) {
    const row = [];

    headers.forEach((header, index) => {
      let value = '';

      // If using selectedFields, map from field key to value
      if (options.selectedFields && Array.isArray(options.selectedFields)) {
        const fieldKey = this.getFieldKeyFromLabel(header);
        value = this.extractFieldValue(item, fieldKey);
      } else {
        // Enhanced comprehensive header mapping
        switch (header) {
        case 'Index':
          value = item.index || (index + 1);
          break;
        case 'Filename':
          value = this.extractFieldValue(item, 'filename');
          break;
        case 'URL':
          value = this.extractFieldValue(item, 'url');
          break;
        case 'Width':
          value = this.extractFieldValue(item, 'width');
          break;
        case 'Height':
          value = this.extractFieldValue(item, 'height');
          break;
        case 'Alt Text':
          value = this.extractFieldValue(item, 'altText');
          break;
        case 'Page Title':
          value = this.extractFieldValue(item, 'pageTitle');
          break;
        case 'Timestamp':
          value = this.extractFieldValue(item, 'timestamp');
          break;
        case 'File Size':
          value = this.extractFieldValue(item, 'size');
          break;
        case 'Thumbnail URL':
          value = this.extractFieldValue(item, 'thumbnailUrl');
          break;
        case 'Source Link':
          value = this.extractFieldValue(item, 'link');
          break;
        case 'Confidence Score':
          value = this.extractFieldValue(item, 'confidenceScore');
          break;
        case 'Discovery Method':
          value = this.extractFieldValue(item, 'discoveryMethod');
          break;
        case 'Queue Position':
          value = this.extractFieldValue(item, 'queuePosition');
          break;
        case 'Category':
          value = this.extractFieldValue(item, 'category');
          break;
        case 'Extraction Method':
          value = this.extractFieldValue(item, 'extractionMethod');
          break;
        case 'Processing Time':
          value = this.extractFieldValue(item, 'processingTime');
          break;
        case 'Source Domain':
          value = this.extractFieldValue(item, 'sourceDomain');
          break;
        case 'Container Info':
          value = this.extractFieldValue(item, 'containerInfo');
          break;
        case 'Element Classes':
          value = this.extractFieldValue(item, 'elementClasses');
          break;
        // Legacy mappings for backward compatibility
        case 'Image URL':
          value = item.image || '';
          break;
        case 'Text':
          value = item.text || '';
          break;
        case 'Quality Score':
          value = item.enhanced?.qualityScore || '';
          break;
        default:
          // Try to extract using field key approach
          const fieldKey = this.getFieldKeyFromLabel(header);
          value = this.extractFieldValue(item, fieldKey);
        }
      }

      row.push(this.escapeCSV(value));
    });

    return row;
  }

  getFieldKeyFromLabel(label) {
    const labelToFieldMap = {
      'Filename': 'filename',
      'Image URL': 'url',
      'Thumbnail URL': 'thumbnailUrl',
      'Status': 'status',
      'File Size': 'size',
      'Dimensions': 'dimensions',
      'Caption': 'caption',
      'Resolution': 'resolution',
      'Download Time': 'downloadTime',
      'Source Link': 'link',
      'Retry Count': 'retries',
      'Source Domain': 'source',
      'Extraction Method': 'extractionMethod',
      'Quality Score': 'qualityScore',
      'Processing Time': 'processingTime',
      'Container Info': 'containerInfo',
      'Photo Agency': 'agency',
      'Stock ID': 'stockId',
      'Timestamp': 'timestamp'
    };

    return labelToFieldMap[label] || label.toLowerCase();
  }

  extractFieldValue(item, fieldKey) {
    switch (fieldKey) {
    case 'filename':
      return this.generateFilename(item) || item.filename || item.name || '';
    case 'url':
      return item.image || item.url || item.src || '';
    case 'width':
      return item.width || item.dimensions?.width || '';
    case 'height':
      return item.height || item.dimensions?.height || '';
    case 'altText':
      return item.alt || item.altText || item.text || '';
    case 'pageTitle':
      return item.pageTitle || item.title || (typeof document !== 'undefined' ? document.title : '') || '';
    case 'timestamp':
      return item.timestamp || item.createdAt || item.addedAt || new Date().toISOString();
    case 'size':
      return item.size || item.fileSize || '';
    case 'thumbnailUrl':
      return item.thumbnail || item.thumbnailUrl || '';
    case 'link':
      return item.link || item.sourceLink || '';
    case 'confidenceScore':
      return item.confidence ? Math.round(item.confidence * 100) + '%' : 
             (item.confidenceScore || item.enhanced?.qualityScore || '');
    case 'discoveryMethod':
      return item.discoveryMethod || item.extractionMethod || 'unknown';
    case 'queuePosition':
      return item.queuePosition || item.index || '';
    case 'category':
      return item.category || item.confidenceTier || this.categorizeByConfidence(item.confidence) || '';
    case 'extractionMethod':
      return item.extractionMethod || item.discoveryMethod || 'standard';
    case 'processingTime':
      return item.enhanced?.processingTime || item.processingTime || '';
    case 'sourceDomain':
      try {
        const url = item.image || item.url || item.src;
        return url ? new URL(url).hostname : (item.source || '');
      } catch {
        return item.source || '';
      }
    case 'containerInfo':
      return item.metadata?.containerInfo || item.containerInfo || '';
    case 'elementClasses':
      return item.metadata?.elementClasses || item.elementClasses || item.className || '';
    case 'status':
      return item.status || 'pending';
    case 'dimensions':
      return item.dimensions ? `${item.dimensions.width}x${item.dimensions.height}` :
        (item.width && item.height ? `${item.width}x${item.height}` : '');
    case 'caption':
      return item.text || item.caption || item.alt || '';
    case 'resolution':
      return item.resolution || this.extractFieldValue(item, 'dimensions');
    case 'downloadTime':
      return item.downloadTime || item.processingTime || '';
    case 'retries':
      return item.retries || item.retryCount || 0;
    case 'agency':
      return item.agency || '';
    case 'stockId':
      return item.stockId || item.id || '';
    case 'aspectRatio':
      if (item.width && item.height) {
        return (item.width / item.height).toFixed(2);
      }
      return item.aspectRatio || '';
    case 'orientation':
      if (item.width && item.height) {
        return item.width > item.height ? 'landscape' : 
               item.width < item.height ? 'portrait' : 'square';
      }
      return item.orientation || '';
    case 'elementTag':
      return item.element?.tagName || item.elementTag || '';
    case 'cssClasses':
      return item.element?.className || item.cssClasses || '';
    case 'dataAttributes':
      if (item.element) {
        const dataAttrs = [];
        for (const attr of item.element.attributes || []) {
          if (attr.name.startsWith('data-')) {
            dataAttrs.push(`${attr.name}="${attr.value}"`);
          }
        }
        return dataAttrs.join(', ');
      }
      return item.dataAttributes || '';
    case 'validationStatus':
      return item.validationStatus || item.validated ? 'validated' : 'pending';
    case 'errorCount':
      return item.errorCount || item.errors?.length || 0;
    // Handle metadata fields dynamically
    default:
      if (fieldKey.startsWith('metadata_')) {
        const metaKey = fieldKey.replace('metadata_', '');
        return item.metadata?.[metaKey] || '';
      }
      return item[fieldKey] || '';
    }
  }

  escapeCSV(value) {
    if (value === null || value === undefined) {return '';}

    const stringValue = String(value);

    // If the value contains comma, newline, or quotes, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  ensureExtension(filename, extension) {
    if (!filename.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
      return `${filename}.${extension}`;
    }
    return filename;
  }

  getImageExtension(url) {
    const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : 'jpg';
  }

  async downloadImageAsBlob(url) {
    try {
      const response = await fetch(url);
      return await response.blob();
    } catch (error) {
      throw new Error(`Failed to download image: ${this.getErrorMessage(error)}`);
    }
  }

  async compressString(str) {
    // Enhanced compression with better browser support
    try {
      if (typeof CompressionStream !== 'undefined') {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(new TextEncoder().encode(str));
        writer.close();
        
        const chunks = [];
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        return compressed;
      }
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
    }
    
    // Fallback to uncompressed
    return new TextEncoder().encode(str);
  }

  updateStats(format, exportTime, fileSize) {
    this.exportStats.totalExports++;
    this.exportStats.formatCounts[format] = (this.exportStats.formatCounts[format] || 0) + 1;
    this.exportStats.averageExportTime =
      (this.exportStats.averageExportTime * (this.exportStats.totalExports - 1) + exportTime) /
      this.exportStats.totalExports;
    this.exportStats.totalDataExported += fileSize;
  }

  getStats() {
    return {
      ...this.exportStats,
      exportHistory: this.exportHistory.slice(-10), // Last 10 exports
      performanceMetrics: this.performanceMetrics,
      activeExports: this.activeExports.size,
      memoryUsage: this.formatBytes(this.getMemoryUsage()),
      reliability: this.calculateExportReliability()
    };
  }

  clearHistory() {
    this.exportHistory = [];
    this.tempData.clear();
    this.performanceMetrics = {
      processingTimes: [],
      memoryUsage: [],
      batchSizes: [],
      errorRates: [],
      throughputRates: []
    };
    if (!this.PRODUCTION) console.log('🧹 Export history and performance metrics cleared');
  }

  // Helper method to generate appropriate filename for items
  generateFilename(item) {
    const url = item.image || item.url || item.src;
    if (!url) return '';
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      // If filename has no extension, try to determine from URL or default to jpg
      if (!filename.includes('.')) {
        const extension = this.getImageExtension(url);
        return `${filename || 'image'}.${extension}`;
      }
      
      return filename;
    } catch (error) {
      // Fallback for invalid URLs
      const extension = this.getImageExtension(url);
      return `image.${extension}`;
    }
  }

  // Helper method to categorize items by confidence score
  categorizeByConfidence(confidence) {
    if (confidence >= 0.75) return 'High Confidence';
    if (confidence >= 0.5) return 'Medium Confidence';
    if (confidence >= 0.3) return 'Low Confidence';
    return 'Very Low Confidence';
  }

  // Enhanced image dimension detection
  async detectImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight
        });
      };
      img.onerror = () => {
        resolve({ width: 0, height: 0, aspectRatio: 0 });
      };
      img.src = url;
      
      // Timeout after 5 seconds
      setTimeout(() => {
        resolve({ width: 0, height: 0, aspectRatio: 0 });
      }, 5000);
    });
  }

}

// Enhanced export interface for service worker context
if (typeof self !== 'undefined') {
  self.AdvancedExportSystem = AdvancedExportSystem;
  if (!this.PRODUCTION) console.log('🚀 Enterprise Export System loaded in service worker context');
}

// Export for ES6 modules
export { AdvancedExportSystem };

// Usage example for enterprise features:
// const exporter = new AdvancedExportSystem({
//   enableProgressTracking: true,
//   enableUserNotifications: true,
//   enableMemoryManagement: true,
//   batchSize: 200,
//   maxRetries: 3,
//   streamingThreshold: 500
// });
//
// // Register progress callback
// exporter.onProgress(exportId, (progress) => {
//   console.log(`Export progress: ${progress.progress}% - ${progress.status}`);
// });
//
// // Register notification callback
// exporter.onNotification((notification) => {
//   showUserNotification(notification.title, notification.message, notification.type);
// });
//
// // Enhanced export with all enterprise features
// const result = await exporter.exportData(scrapingData, 'xlsx', 'enterprise-export', {
//   includePerformanceMetrics: true,
//   enableCompression: true,
//   includeThumbnails: true
// });