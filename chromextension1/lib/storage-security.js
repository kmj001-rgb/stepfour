// storage-security.js - Enhanced storage security for MV3 compliance
// Provides storage quotas, validation, cleanup, and secure access patterns

console.log('🔒 Loading Storage Security System...');

/**
 * Secure Storage Manager for MV3 Compliance
 * Provides enhanced security, quotas, validation, and cleanup for chrome.storage
 * 
 * IMPORTANT: This system does NOT provide encryption. Data is stored in plaintext
 * wrapped with metadata. Only use chrome.storage for non-sensitive data.
 */
class SecureStorageManager {
  constructor(options = {}) {
    this.options = {
      maxStorageSize: options.maxStorageSize || 10 * 1024 * 1024, // 10MB default
      maxItemSize: options.maxItemSize || 1 * 1024 * 1024, // 1MB per item
      maxKeyLength: options.maxKeyLength || 100,
      maxValueDepth: options.maxValueDepth || 10,
      compressionThreshold: options.compressionThreshold || 64 * 1024, // 64KB
      enableCompression: options.enableCompression !== false,
      autoCleanup: options.autoCleanup !== false,
      quotaWarningThreshold: options.quotaWarningThreshold || 0.8, // 80%
      auditLogging: options.auditLogging !== false,
      ...options
    };

    this.storageStats = {
      totalSize: 0,
      itemCount: 0,
      lastCleanup: Date.now(),
      operations: 0,
      errors: 0,
      warnings: 0
    };

    this.auditLog = [];
    this.securityPatterns = this.initializeSecurityPatterns();
    
    console.log('✅ Secure Storage Manager initialized with quotas and validation');
  }

  /**
   * Initialize security patterns for validation
   */
  initializeSecurityPatterns() {
    return {
      // Patterns that should not be stored
      suspiciousPatterns: [
        /(?:password|pwd|pass|passwd)\w*/i,
        /(?:secret|api[_-]?key|private[_-]?key)\w*/i,
        /token.*[a-zA-Z0-9]{16,}/i,
        /<script/i,
        /javascript:/i,
        /data:.*base64/i,
        /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/,
        /^eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*$/,
        /[a-zA-Z0-9]{32,}/,
        /[:@]\/\//
      ],
      
      // Valid key patterns
      validKeyPatterns: [
        /^stepthree_[a-zA-Z0-9_-]+$/,
        /^settings_[a-zA-Z0-9_-]+$/,
        /^cache_[a-zA-Z0-9_-]+$/,
        /^state_[a-zA-Z0-9_-]+$/
      ],
      
      // Temporary key patterns (auto-cleanup)
      temporaryKeyPatterns: [
        /^temp_/,
        /^cache_/,
        /^session_/
      ]
    };
  }

  /**
   * Secure get operation with validation and logging
   */
  async secureGet(keys, storageArea = 'local') {
    try {
      this.storageStats.operations++;
      const startTime = Date.now();

      // Validate input
      this.validateKeys(keys);

      // Get storage area
      const storage = this.getStorageArea(storageArea);
      
      // Perform get operation
      const result = await storage.get(keys);
      
      // Validate and process results
      const processedResult = this.processGetResult(result);
      
      // Log operation
      if (this.options.auditLogging) {
        this.logOperation('GET', keys, storageArea, {
          success: true,
          itemCount: Object.keys(processedResult).length,
          duration: Date.now() - startTime
        });
      }

      return processedResult;

    } catch (error) {
      this.storageStats.errors++;
      this.logError('GET', keys, storageArea, error);
      throw new Error(`Secure storage get failed: ${error.message}`);
    }
  }

  /**
   * Secure set operation with validation, quotas, and compression
   */
  async secureSet(items, storageArea = 'local') {
    try {
      this.storageStats.operations++;
      const startTime = Date.now();

      // Validate input
      this.validateSetItems(items);

      // Check quotas before setting
      await this.checkQuotas(items, storageArea);

      // Process items (validation, compression, etc.)
      const processedItems = await this.processSetItems(items);

      // Get storage area
      const storage = this.getStorageArea(storageArea);
      
      // Perform set operation
      await storage.set(processedItems);
      
      // Update stats
      this.updateStorageStats(processedItems, 'SET');
      
      // Log operation
      if (this.options.auditLogging) {
        this.logOperation('SET', Object.keys(items), storageArea, {
          success: true,
          itemCount: Object.keys(processedItems).length,
          totalSize: this.calculateSize(processedItems),
          duration: Date.now() - startTime
        });
      }

      // Check if cleanup is needed
      if (this.options.autoCleanup) {
        await this.scheduleCleanupIfNeeded();
      }

      return { success: true, itemsStored: Object.keys(processedItems).length };

    } catch (error) {
      this.storageStats.errors++;
      this.logError('SET', Object.keys(items), storageArea, error);
      throw new Error(`Secure storage set failed: ${error.message}`);
    }
  }

  /**
   * Secure remove operation with validation and logging
   */
  async secureRemove(keys, storageArea = 'local') {
    try {
      this.storageStats.operations++;
      const startTime = Date.now();

      // Validate input
      this.validateKeys(keys);

      // Get storage area
      const storage = this.getStorageArea(storageArea);
      
      // Get current values for logging
      const currentValues = await storage.get(keys);
      
      // Perform remove operation
      await storage.remove(keys);
      
      // Update stats
      this.updateStorageStats(currentValues, 'REMOVE');
      
      // Log operation
      if (this.options.auditLogging) {
        this.logOperation('REMOVE', keys, storageArea, {
          success: true,
          itemCount: Array.isArray(keys) ? keys.length : 1,
          duration: Date.now() - startTime
        });
      }

      return { success: true, itemsRemoved: Array.isArray(keys) ? keys.length : 1 };

    } catch (error) {
      this.storageStats.errors++;
      this.logError('REMOVE', keys, storageArea, error);
      throw new Error(`Secure storage remove failed: ${error.message}`);
    }
  }

  /**
   * Get storage usage and quota information
   */
  async getStorageInfo(storageArea = 'local') {
    try {
      const storage = this.getStorageArea(storageArea);
      
      // Get all items to calculate usage
      const allItems = await storage.get(null);
      const totalSize = this.calculateSize(allItems);
      const itemCount = Object.keys(allItems).length;
      
      const quota = storageArea === 'local' ? 
        (await chrome.storage.local.getBytesInUse ? 
         await chrome.storage.local.getBytesInUse() : totalSize) : 
        totalSize;

      const info = {
        storageArea,
        totalSize,
        itemCount,
        quota: this.options.maxStorageSize,
        usagePercent: (totalSize / this.options.maxStorageSize) * 100,
        nearQuota: (totalSize / this.options.maxStorageSize) > this.options.quotaWarningThreshold,
        stats: { ...this.storageStats },
        lastUpdate: Date.now()
      };

      return info;

    } catch (error) {
      throw new Error(`Failed to get storage info: ${error.message}`);
    }
  }

  /**
   * Perform storage cleanup
   */
  async performCleanup(storageArea = 'local', options = {}) {
    try {
      console.log(`🧹 Starting storage cleanup for ${storageArea}...`);
      
      const storage = this.getStorageArea(storageArea);
      const allItems = await storage.get(null);
      
      const cleanupResults = {
        itemsRemoved: 0,
        sizeFreed: 0,
        errors: []
      };

      // Find items to remove
      const itemsToRemove = [];
      
      for (const [key, value] of Object.entries(allItems)) {
        let shouldRemove = false;
        
        // Remove temporary items older than threshold
        if (this.isTemporaryKey(key)) {
          const age = this.getItemAge(value);
          if (age > (options.tempItemMaxAge || 24 * 60 * 60 * 1000)) { // 24 hours
            shouldRemove = true;
          }
        }
        
        // Remove expired items
        if (this.isExpired(value)) {
          shouldRemove = true;
        }
        
        // Remove corrupted items
        if (this.isCorrupted(value)) {
          shouldRemove = true;
          cleanupResults.errors.push(`Corrupted item removed: ${key}`);
        }
        
        if (shouldRemove) {
          itemsToRemove.push(key);
          cleanupResults.sizeFreed += this.calculateSize({ [key]: value });
        }
      }

      // Remove identified items
      if (itemsToRemove.length > 0) {
        await storage.remove(itemsToRemove);
        cleanupResults.itemsRemoved = itemsToRemove.length;
      }

      // Update stats
      this.storageStats.lastCleanup = Date.now();
      
      // Log cleanup operation
      if (this.options.auditLogging) {
        this.logOperation('CLEANUP', itemsToRemove, storageArea, cleanupResults);
      }

      console.log(`✅ Storage cleanup completed:`, cleanupResults);
      return cleanupResults;

    } catch (error) {
      console.error('❌ Storage cleanup failed:', error);
      throw new Error(`Storage cleanup failed: ${error.message}`);
    }
  }

  /**
   * Validate keys for operations
   */
  validateKeys(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    
    for (const key of keyArray) {
      if (typeof key !== 'string') {
        throw new Error('Storage keys must be strings');
      }
      
      if (key.length > this.options.maxKeyLength) {
        throw new Error(`Key too long: ${key.length} > ${this.options.maxKeyLength}`);
      }
      
      // Check for suspicious patterns
      for (const pattern of this.securityPatterns.suspiciousPatterns) {
        if (pattern.test(key)) {
          this.storageStats.errors++;
          throw new Error(`SECURITY: Suspicious key pattern blocked: ${key}`);
        }
      }
    }
  }

  /**
   * Validate items for set operations
   */
  validateSetItems(items) {
    if (!items || typeof items !== 'object') {
      throw new Error('Items must be an object');
    }

    for (const [key, value] of Object.entries(items)) {
      // Validate key
      this.validateKeys(key);
      
      // Validate value size
      const valueSize = this.calculateSize({ [key]: value });
      if (valueSize > this.options.maxItemSize) {
        throw new Error(`Item too large: ${key} (${valueSize} > ${this.options.maxItemSize})`);
      }
      
      // Validate value structure
      this.validateValueStructure(value, key);
      
      // Check for sensitive data
      this.checkForSensitiveData(key, value);
    }
  }

  /**
   * Validate value structure and depth
   */
  validateValueStructure(value, key, depth = 0) {
    if (depth > this.options.maxValueDepth) {
      throw new Error(`Value too deeply nested: ${key} (depth ${depth} > ${this.options.maxValueDepth})`);
    }

    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          this.validateValueStructure(item, `${key}[${index}]`, depth + 1);
        });
      } else {
        Object.entries(value).forEach(([subKey, subValue]) => {
          this.validateValueStructure(subValue, `${key}.${subKey}`, depth + 1);
        });
      }
    }
  }

  /**
   * Check for sensitive data that shouldn't be stored
   */
  checkForSensitiveData(key, value) {
    const valueStr = JSON.stringify(value);
    
    for (const pattern of this.securityPatterns.suspiciousPatterns) {
      if (pattern.test(valueStr) || pattern.test(key)) {
        this.storageStats.errors++;
        
        // Log the security violation
        if (this.options.auditLogging) {
          this.auditLog.push({
            timestamp: Date.now(),
            type: 'SECURITY_VIOLATION',
            key,
            pattern: pattern.toString(),
            action: 'STORAGE_BLOCKED'
          });
        }
        
        // BLOCK the storage operation by throwing error
        throw new Error(`SECURITY: Sensitive data pattern detected and blocked. Key: ${key}, Pattern: ${pattern.toString()}`);
      }
    }
  }

  /**
   * Process items before storing
   * Wraps data with metadata and optionally serializes (JSON stringification only)
   * 
   * SECURITY WARNING: No encryption is performed - data is stored in plaintext
   * SECURITY WARNING: No compression is performed - only JSON serialization
   * Do NOT store sensitive data (passwords, tokens, API keys) using this system
   */
  async processSetItems(items) {
    const processedItems = {};
    
    for (const [key, value] of Object.entries(items)) {
      let processedValue = value;
      
      // Add metadata
      const metadata = {
        _stepthree_meta: {
          stored: Date.now(),
          version: '1.0',
          serialized: false
        }
      };
      
      // Serialize if enabled and value is large enough (JSON stringification only)
      if (this.options.enableCompression) {
        const valueSize = this.calculateSize({ [key]: value });
        if (valueSize > this.options.compressionThreshold) {
          try {
            processedValue = await this.serializeValue(value);
            metadata._stepthree_meta.serialized = true;
          } catch (error) {
            console.warn(`⚠️ Serialization failed for ${key}:`, error);
          }
        }
      }
      
      // Wrap value with metadata
      processedItems[key] = {
        data: processedValue,
        ...metadata
      };
    }
    
    return processedItems;
  }

  /**
   * Process retrieved items
   * Unwraps metadata and deserializes if needed (JSON parsing only)
   * 
   * SECURITY WARNING: No decryption is performed - data is retrieved as-is from storage
   * SECURITY WARNING: No decompression is performed - only JSON parsing
   */
  processGetResult(result) {
    const processedResult = {};
    
    for (const [key, value] of Object.entries(result)) {
      // Check if this is a wrapped value with metadata
      if (value && typeof value === 'object' && value._stepthree_meta) {
        let processedValue = value.data;
        
        // Deserialize if needed (legacy check for 'compressed' field)
        if (value._stepthree_meta.compressed || value._stepthree_meta.serialized) {
          try {
            processedValue = this.deserializeValue(processedValue);
          } catch (error) {
            console.warn(`⚠️ Deserialization failed for ${key}:`, error);
            processedValue = value.data; // Use original if deserialization fails
          }
        }
        
        processedResult[key] = processedValue;
      } else {
        // Legacy or unwrapped value
        processedResult[key] = value;
      }
    }
    
    return processedResult;
  }

  /**
   * Check storage quotas before setting
   */
  async checkQuotas(items, storageArea) {
    const newDataSize = this.calculateSize(items);
    const currentInfo = await this.getStorageInfo(storageArea);
    const projectedSize = currentInfo.totalSize + newDataSize;
    
    if (projectedSize > this.options.maxStorageSize) {
      throw new Error(`Storage quota exceeded: ${projectedSize} > ${this.options.maxStorageSize}`);
    }
    
    if (projectedSize > (this.options.maxStorageSize * this.options.quotaWarningThreshold)) {
      this.storageStats.warnings++;
      console.warn(`⚠️ Storage approaching quota: ${Math.round((projectedSize / this.options.maxStorageSize) * 100)}%`);
    }
  }

  /**
   * Calculate size of data in bytes
   */
  calculateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
      // Fallback calculation
      return JSON.stringify(data).length * 2; // UTF-16 encoding estimate
    }
  }

  /**
   * Get storage area reference
   */
  getStorageArea(storageArea) {
    if (!chrome.storage || !chrome.storage[storageArea]) {
      throw new Error(`Storage area not available: ${storageArea}`);
    }
    return chrome.storage[storageArea];
  }

  /**
   * Update storage statistics
   */
  updateStorageStats(items, operation) {
    const size = this.calculateSize(items);
    const count = Object.keys(items).length;
    
    switch (operation) {
      case 'SET':
        this.storageStats.totalSize += size;
        this.storageStats.itemCount += count;
        break;
      case 'REMOVE':
        this.storageStats.totalSize = Math.max(0, this.storageStats.totalSize - size);
        this.storageStats.itemCount = Math.max(0, this.storageStats.itemCount - count);
        break;
    }
  }

  /**
   * Log operation for audit trail
   */
  logOperation(operation, keys, storageArea, details) {
    const logEntry = {
      timestamp: Date.now(),
      operation,
      keys: Array.isArray(keys) ? keys : [keys],
      storageArea,
      ...details
    };
    
    this.auditLog.push(logEntry);
    
    // Keep audit log size manageable
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500); // Keep last 500 entries
    }
  }

  /**
   * Log error for debugging
   */
  logError(operation, keys, storageArea, error) {
    const errorEntry = {
      timestamp: Date.now(),
      operation,
      keys: Array.isArray(keys) ? keys : [keys],
      storageArea,
      error: error.message,
      stack: error.stack
    };
    
    this.auditLog.push(errorEntry);
    console.error(`❌ Storage ${operation} error:`, errorEntry);
  }

  /**
   * Schedule cleanup if needed
   */
  async scheduleCleanupIfNeeded() {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.storageStats.lastCleanup;
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    if (timeSinceLastCleanup > cleanupInterval) {
      setTimeout(() => {
        this.performCleanup().catch(error => {
          console.error('❌ Scheduled cleanup failed:', error);
        });
      }, 1000); // Delay to avoid blocking current operation
    }
  }

  /**
   * Utility methods for cleanup
   */
  isTemporaryKey(key) {
    return this.securityPatterns.temporaryKeyPatterns.some(pattern => pattern.test(key));
  }

  getItemAge(value) {
    if (value && value._stepthree_meta && value._stepthree_meta.stored) {
      return Date.now() - value._stepthree_meta.stored;
    }
    return 0;
  }

  isExpired(value) {
    if (value && value._stepthree_meta && value._stepthree_meta.expires) {
      return Date.now() > value._stepthree_meta.expires;
    }
    return false;
  }

  isCorrupted(value) {
    try {
      JSON.stringify(value);
      return false;
    } catch (error) {
      return true;
    }
  }

  /**
   * Serialization methods
   * SECURITY FIX: Renamed from compress/decompress to accurately reflect functionality
   * These only perform JSON serialization/parsing - NO compression or encryption
   * 
   * WARNING: Data is NOT compressed - only stringified
   * WARNING: Data is NOT encrypted - stored in plaintext
   * To implement real compression, use CompressionStream API
   * To implement real encryption, use Web Crypto API (AES-GCM)
   */
  async serializeValue(value) {
    // JSON serialization only - no actual compression or encryption
    return JSON.stringify(value);
  }

  deserializeValue(value) {
    // JSON parsing only - no actual decompression or decryption
    try {
      return JSON.parse(value);
    } catch (error) {
      return value; // Return as-is if not JSON
    }
  }

  /**
   * Get audit log
   */
  getAuditLog() {
    return [...this.auditLog];
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return { ...this.storageStats };
  }
}

// Make available globally for Chrome extension context
if (typeof globalThis !== 'undefined') {
  globalThis.SecureStorageManager = SecureStorageManager;
}

console.log('✅ Storage Security System loaded successfully');