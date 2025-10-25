/**
 * Production Mode Detection - Loads FIRST before any other content scripts
 * Sets up production-aware console to suppress verbose logging in production
 * 
 * This must load before any other lib files that use console logging
 */

(function() {
  'use strict';
  
  /**
   * Detect if running in production mode
   * Production: chrome-extension://[id]/ (installed extension)
   * Development: test pages, replit, or localhost
   */
  const isProduction = () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        const url = chrome.runtime.getURL('');
        return url.startsWith('chrome-extension://') && !url.includes('localhost');
      }
      return true; // Default to production mode if unsure
    } catch (e) {
      return true;
    }
  };
  
  const PRODUCTION = isProduction();
  
  // Create production-aware console
  // In production: suppress log, info, debug but keep error and warn for troubleshooting
  // In development: keep all console methods
  if (PRODUCTION) {
    // Save original console methods
    const originalConsole = {
      log: console.log,
      info: console.info,
      debug: console.debug,
      error: console.error,
      warn: console.warn
    };
    
    // Override verbose logging methods in production
    console.log = function() {};
    console.info = function() {};
    console.debug = function() {};
    // Keep console.error and console.warn for troubleshooting
    
    // Log once to service console (using original method)
    originalConsole.info('✅ StepThree Content Scripts running in PRODUCTION mode - verbose logging suppressed');
  }
  
  // Make PRODUCTION flag available globally for other scripts
  window.__STEPTHREE_PRODUCTION_MODE__ = PRODUCTION;
  
  if (!PRODUCTION) {
    console.log('🔧 StepThree Content Scripts running in DEVELOPMENT mode - verbose logging enabled');
  }
})();
