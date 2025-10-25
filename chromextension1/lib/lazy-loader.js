/**
 * LazyLibraryLoader - Dynamically loads heavy libraries on-demand
 * 
 * Reduces initial page load time by deferring library loading until needed.
 * Implements caching to prevent duplicate loads and provides loading state tracking.
 * 
 * Usage:
 *   const loader = new LazyLibraryLoader();
 *   await loader.loadExportLibraries();
 *   // Now XLSX and Papa are available globally
 */
class LazyLibraryLoader {
  constructor() {
    this.loadedLibraries = new Set();
    this.loadingPromises = new Map();
    this.loadingCallbacks = new Map();
  }

  /**
   * Load a single script dynamically
   * @param {string} src - Script path relative to extension root
   * @param {string} globalCheck - Global variable name to check if already loaded
   * @returns {Promise<void>}
   */
  async loadScript(src, globalCheck) {
    // Check if already loaded via global variable
    if (globalCheck && typeof window[globalCheck] !== 'undefined') {
      console.log(`✅ ${globalCheck} already loaded`);
      this.loadedLibraries.add(src);
      return Promise.resolve();
    }

    // Check if already in loading state
    if (this.loadingPromises.has(src)) {
      console.log(`⏳ ${globalCheck} already loading, waiting...`);
      return this.loadingPromises.get(src);
    }

    // Start loading
    console.log(`📥 Loading library: ${globalCheck} from ${src}...`);
    
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      
      // Determine the correct URL based on context
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        // Chrome extension context
        script.src = chrome.runtime.getURL(src);
      } else {
        // Regular web context (development server)
        script.src = src;
      }
      
      script.onload = () => {
        this.loadedLibraries.add(src);
        console.log(`✅ ${globalCheck} loaded successfully`);
        
        // Notify any registered callbacks
        if (this.loadingCallbacks.has(src)) {
          this.loadingCallbacks.get(src).forEach(callback => callback());
          this.loadingCallbacks.delete(src);
        }
        
        resolve();
      };
      
      script.onerror = (error) => {
        console.error(`❌ Failed to load ${globalCheck}:`, error);
        this.loadingPromises.delete(src); // Allow retry
        reject(new Error(`Failed to load library: ${globalCheck}`));
      };
      
      document.head.appendChild(script);
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  /**
   * Load all export-related libraries (XLSX, Papa Parse)
   * @returns {Promise<void>}
   */
  async loadExportLibraries() {
    console.log('📦 Loading export libraries...');
    
    try {
      await Promise.all([
        this.loadScript('lib/xlsx.full.min.js', 'XLSX'),
        this.loadScript('lib/papaparse.min.js', 'Papa')
      ]);
      
      console.log('✅ All export libraries loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load export libraries:', error);
      throw error;
    }
  }

  /**
   * Check if a specific library is loaded
   * @param {string} src - Script path
   * @returns {boolean}
   */
  isLoaded(src) {
    return this.loadedLibraries.has(src);
  }

  /**
   * Check if export libraries are loaded
   * @returns {boolean}
   */
  areExportLibrariesLoaded() {
    return (
      typeof window.XLSX !== 'undefined' &&
      typeof window.Papa !== 'undefined'
    );
  }

  /**
   * Register a callback to be called when a library finishes loading
   * @param {string} src - Script path
   * @param {Function} callback - Callback function
   */
  onLoaded(src, callback) {
    if (this.isLoaded(src)) {
      callback();
      return;
    }
    
    if (!this.loadingCallbacks.has(src)) {
      this.loadingCallbacks.set(src, []);
    }
    
    this.loadingCallbacks.get(src).push(callback);
  }

  /**
   * Get loading state for UI feedback
   * @returns {Object} Loading state information
   */
  getLoadingState() {
    return {
      loaded: Array.from(this.loadedLibraries),
      loading: Array.from(this.loadingPromises.keys()),
      exportLibrariesReady: this.areExportLibrariesLoaded()
    };
  }
}

// Create a global instance for use across the extension
if (typeof window !== 'undefined') {
  window.lazyLoader = window.lazyLoader || new LazyLibraryLoader();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LazyLibraryLoader;
}
