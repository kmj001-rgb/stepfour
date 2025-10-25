/**
 * ContentHasher - SHA-256 content hashing for duplicate detection
 * Prevents infinite pagination loops by detecting when same content appears
 * Phase 2: Duplicate Detection Implementation
 * 
 * @version 1.0.0
 */

class ContentHasher {
  constructor(options = {}) {
    this.seenHashes = new Set();
    this.hashHistory = []; // Ordered list for recent duplicate checking
    this.maxHistorySize = options.maxHistorySize || 1000; // Prevent memory leaks
    this.storageKey = options.storageKey || 'contentHasher_seenHashes';
    this.enableLogging = options.enableLogging !== false; // Default true
  }

  /**
   * Generate SHA-256 hash of content using Web Crypto API
   * @param {string|Object|Array} content - Content to hash
   * @returns {Promise<string>} Hex string of hash
   */
  async hashContent(content) {
    try {
      // Convert content to string if needed
      let text = content;
      if (typeof content !== 'string') {
        text = JSON.stringify(content);
      }
      
      // Use Web Crypto API for hashing
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (error) {
      console.error('ContentHasher: Error hashing content:', error);
      // Return a fallback hash based on content length
      return `fallback_${typeof content}_${String(content).length}`;
    }
  }

  /**
   * Check if content has been seen before
   * @param {string|Object|Array} content - Content to check
   * @returns {Promise<boolean>} True if duplicate, false if new
   */
  async isDuplicate(content) {
    const hash = await this.hashContent(content);
    
    if (this.seenHashes.has(hash)) {
      if (this.enableLogging) {
        console.log(`ContentHasher: Duplicate detected (hash: ${hash.substring(0, 8)}...)`);
      }
      return true;
    }
    
    // Add to seen hashes
    this.seenHashes.add(hash);
    this.hashHistory.push({
      hash: hash,
      timestamp: Date.now()
    });
    
    // Maintain history size limit
    if (this.hashHistory.length > this.maxHistorySize) {
      const removed = this.hashHistory.shift();
      // Only remove from set if not in recent history
      const stillInHistory = this.hashHistory.some(h => h.hash === removed.hash);
      if (!stillInHistory) {
        this.seenHashes.delete(removed.hash);
      }
    }
    
    return false;
  }

  /**
   * Check if content matches any of the last N hashes (for circular pagination)
   * Useful when pagination loops back to first few pages
   * @param {string|Object|Array} content - Content to check
   * @param {number} lookback - Number of recent hashes to check against
   * @returns {Promise<boolean>} True if matches recent content
   */
  async isRecentDuplicate(content, lookback = 3) {
    const hash = await this.hashContent(content);
    
    // Get last N hashes from history
    const recentHashes = this.hashHistory
      .slice(-lookback)
      .map(h => h.hash);
    
    if (recentHashes.includes(hash)) {
      if (this.enableLogging) {
        console.log(`ContentHasher: Recent duplicate detected within last ${lookback} pages (hash: ${hash.substring(0, 8)}...)`);
      }
      return true;
    }
    
    // Add to history
    this.seenHashes.add(hash);
    this.hashHistory.push({
      hash: hash,
      timestamp: Date.now()
    });
    
    // Maintain history size limit
    if (this.hashHistory.length > this.maxHistorySize) {
      const removed = this.hashHistory.shift();
      const stillInHistory = this.hashHistory.some(h => h.hash === removed.hash);
      if (!stillInHistory) {
        this.seenHashes.delete(removed.hash);
      }
    }
    
    return false;
  }

  /**
   * Get hash without storing it (for comparison purposes)
   * @param {string|Object|Array} content - Content to hash
   * @returns {Promise<string>} Hash string
   */
  async getHash(content) {
    return await this.hashContent(content);
  }

  /**
   * Check if a specific hash exists in the seen set
   * @param {string} hash - Hash to check
   * @returns {boolean} True if hash exists
   */
  hasHash(hash) {
    return this.seenHashes.has(hash);
  }

  /**
   * Reset all stored hashes (clear memory)
   */
  reset() {
    this.seenHashes.clear();
    this.hashHistory = [];
    if (this.enableLogging) {
      console.log('ContentHasher: Reset - all hashes cleared');
    }
  }

  /**
   * Get statistics about hash storage
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      totalHashes: this.seenHashes.size,
      historyLength: this.hashHistory.length,
      maxHistorySize: this.maxHistorySize,
      oldestTimestamp: this.hashHistory.length > 0 ? this.hashHistory[0].timestamp : null,
      newestTimestamp: this.hashHistory.length > 0 ? this.hashHistory[this.hashHistory.length - 1].timestamp : null
    };
  }

  /**
   * Save hashes to localStorage for persistence
   * @param {string} customKey - Optional custom storage key
   * @returns {boolean} Success status
   */
  saveToStorage(customKey = null) {
    try {
      const key = customKey || this.storageKey;
      const data = {
        hashes: Array.from(this.seenHashes),
        history: this.hashHistory,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
      if (this.enableLogging) {
        console.log(`ContentHasher: Saved ${this.seenHashes.size} hashes to localStorage`);
      }
      return true;
    } catch (error) {
      console.error('ContentHasher: Error saving to storage:', error);
      return false;
    }
  }

  /**
   * Load hashes from localStorage
   * @param {string} customKey - Optional custom storage key
   * @returns {boolean} Success status
   */
  loadFromStorage(customKey = null) {
    try {
      const key = customKey || this.storageKey;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        const data = JSON.parse(stored);
        this.seenHashes = new Set(data.hashes || []);
        this.hashHistory = data.history || [];
        
        if (this.enableLogging) {
          console.log(`ContentHasher: Loaded ${this.seenHashes.size} hashes from localStorage`);
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('ContentHasher: Error loading from storage:', error);
      return false;
    }
  }

  /**
   * Clear stored hashes from localStorage
   * @param {string} customKey - Optional custom storage key
   * @returns {boolean} Success status
   */
  clearStorage(customKey = null) {
    try {
      const key = customKey || this.storageKey;
      localStorage.removeItem(key);
      if (this.enableLogging) {
        console.log('ContentHasher: Cleared localStorage');
      }
      return true;
    } catch (error) {
      console.error('ContentHasher: Error clearing storage:', error);
      return false;
    }
  }

  /**
   * Save hashes to Chrome storage (for extension context)
   * @returns {Promise<boolean>} Success status
   */
  async saveToChrome() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const data = {
          hashes: Array.from(this.seenHashes),
          history: this.hashHistory,
          timestamp: Date.now()
        };
        
        await chrome.storage.local.set({ [this.storageKey]: data });
        
        if (this.enableLogging) {
          console.log(`ContentHasher: Saved ${this.seenHashes.size} hashes to chrome.storage`);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('ContentHasher: Error saving to chrome.storage:', error);
      return false;
    }
  }

  /**
   * Load hashes from Chrome storage (for extension context)
   * @returns {Promise<boolean>} Success status
   */
  async loadFromChrome() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(this.storageKey);
        const data = result[this.storageKey];
        
        if (data) {
          this.seenHashes = new Set(data.hashes || []);
          this.hashHistory = data.history || [];
          
          if (this.enableLogging) {
            console.log(`ContentHasher: Loaded ${this.seenHashes.size} hashes from chrome.storage`);
          }
          return true;
        }
        
        return false;
      }
      return false;
    } catch (error) {
      console.error('ContentHasher: Error loading from chrome.storage:', error);
      return false;
    }
  }

  /**
   * Clear hashes from Chrome storage (for extension context)
   * @returns {Promise<boolean>} Success status
   */
  async clearChrome() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove(this.storageKey);
        if (this.enableLogging) {
          console.log('ContentHasher: Cleared chrome.storage');
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('ContentHasher: Error clearing chrome.storage:', error);
      return false;
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ContentHasher = ContentHasher;
  
  if (!window.__ST) {
    window.__ST = {};
  }
  window.__ST.ContentHasher = ContentHasher;
  
  console.log('✅ ContentHasher loaded and available');
}

// CommonJS export for Node.js/testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentHasher;
}
