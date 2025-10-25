(() => {
  // Production mode detection handled by lib/production-mode.js (loaded first)
  // production-mode.js already overrides console.log/info/debug in production
  const PRODUCTION = window.__STEPTHREE_PRODUCTION_MODE__ !== undefined 
    ? window.__STEPTHREE_PRODUCTION_MODE__ 
    : true; // fallback to production mode if not set

  // Note: Console override is handled by lib/production-mode.js which loads first
  // This ensures consistent logging behavior across all content scripts

  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // config/constants.js
  var PERFORMANCE_CONFIG, EXPORT_CONFIG;
  var init_constants = __esm({
    "config/constants.js"() {
      PERFORMANCE_CONFIG = {
        MEMORY_SAMPLE_INTERVAL_MS: 3e4,
        MEMORY_WARNING_THRESHOLD_BYTES: 200 * 1024 * 1024,
        MEMORY_CRITICAL_THRESHOLD_BYTES: 300 * 1024 * 1024
      };
      EXPORT_CONFIG = {
        MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
        BATCH_SIZE: 100,
        COMPRESSION_LEVEL: 6,
        STREAMING_THRESHOLD: 500,
        LARGE_DATASET_THRESHOLD: 1e3
      };
    }
  });

  // lib/input-sanitizer.js
  var InputSanitizer;
  var init_input_sanitizer = __esm({
    "lib/input-sanitizer.js"() {
      console.log("\u{1F6E1}\uFE0F Loading Input Sanitizer System...");
      InputSanitizer = class {
        constructor(options = {}) {
          this.options = {
            // Selector sanitization options
            maxSelectorLength: options.maxSelectorLength || 1e4,
            allowedSelectorChars: options.allowedSelectorChars || /^[a-zA-Z0-9\s\-_#.\[\]=:()>+~*,"'|^$]+$/,
            // URL sanitization options
            allowedProtocols: options.allowedProtocols || ["http:", "https:"],
            maxUrlLength: options.maxUrlLength || 2048,
            // Filename sanitization options
            maxFilenameLength: options.maxFilenameLength || 255,
            allowedFilenameChars: options.allowedFilenameChars || /^[a-zA-Z0-9\-_. ()]+$/,
            // HTML sanitization options
            escapeHtml: options.escapeHtml !== false,
            ...options
          };
          this.dangerousPatterns = {
            // CSS selector injection patterns
            selector: [
              /<script/i,
              /javascript:/i,
              /on\w+=/i,
              /eval\(/i,
              /expression\(/i,
              /<iframe/i,
              /<embed/i,
              /<object/i
            ],
            // URL injection patterns
            url: [
              /javascript:/i,
              /data:text\/html/i,
              /vbscript:/i,
              /file:/i,
              /<script/i,
              /on\w+=/i
            ],
            // Path traversal patterns
            path: [
              /\.\./,
              /\/\.\./,
              /\.\.[\\/]/,
              /^[\\\/]/,
              /[\\/]$/
            ]
          };
          this.stats = {
            selectorsProcessed: 0,
            urlsProcessed: 0,
            filenamesProcessed: 0,
            htmlProcessed: 0,
            threatsBlocked: 0
          };
        }
        /**
         * Sanitize CSS selectors to prevent injection attacks
         * @param {string} selector - CSS selector to sanitize
         * @param {Object} options - Additional options
         * @returns {string} - Sanitized selector or empty string if invalid
         */
        sanitizeSelector(selector, options = {}) {
          this.stats.selectorsProcessed++;
          try {
            if (!selector || typeof selector !== "string") {
              return "";
            }
            selector = selector.trim();
            if (selector.length === 0) {
              return "";
            }
            if (selector.length > this.options.maxSelectorLength) {
              console.warn("\u{1F6E1}\uFE0F Selector exceeds maximum length:", selector.length);
              this.stats.threatsBlocked++;
              return "";
            }
            for (const pattern of this.dangerousPatterns.selector) {
              if (pattern.test(selector)) {
                console.warn("\u{1F6E1}\uFE0F Dangerous pattern detected in selector:", pattern);
                this.stats.threatsBlocked++;
                return "";
              }
            }
            if (!this.options.allowedSelectorChars.test(selector)) {
              console.warn("\u{1F6E1}\uFE0F Invalid characters in selector:", selector);
              this.stats.threatsBlocked++;
              return "";
            }
            if (typeof document !== "undefined") {
              try {
                document.querySelector(":root");
                document.createDocumentFragment().querySelector(selector);
              } catch (e) {
                console.warn("\u{1F6E1}\uFE0F Selector validation test failed:", e.message);
              }
            }
            selector = selector.replace(/[<>]/g, "").replace(/\\/g, "\\\\");
            return selector;
          } catch (error) {
            console.error("\u274C Selector sanitization error:", error);
            this.stats.threatsBlocked++;
            return "";
          }
        }
        /**
         * Sanitize URLs to allow only safe protocols (http/https)
         * @param {string} url - URL to sanitize
         * @param {Object} options - Additional options
         * @returns {string} - Sanitized URL or empty string if invalid
         */
        sanitizeURL(url, options = {}) {
          this.stats.urlsProcessed++;
          try {
            if (!url || typeof url !== "string") {
              return "";
            }
            url = url.trim();
            if (url.length === 0) {
              return "";
            }
            if (url.length > this.options.maxUrlLength) {
              console.warn("\u{1F6E1}\uFE0F URL exceeds maximum length:", url.length);
              this.stats.threatsBlocked++;
              return "";
            }
            for (const pattern of this.dangerousPatterns.url) {
              if (pattern.test(url)) {
                console.warn("\u{1F6E1}\uFE0F Dangerous pattern detected in URL:", pattern);
                this.stats.threatsBlocked++;
                return "";
              }
            }
            let parsedUrl;
            try {
              parsedUrl = new URL(url);
            } catch (e) {
              try {
                parsedUrl = new URL(url, "https://example.com");
              } catch (e2) {
                console.warn("\u{1F6E1}\uFE0F Invalid URL format:", url);
                this.stats.threatsBlocked++;
                return "";
              }
            }
            if (!this.options.allowedProtocols.includes(parsedUrl.protocol)) {
              console.warn("\u{1F6E1}\uFE0F Disallowed protocol in URL:", parsedUrl.protocol);
              this.stats.threatsBlocked++;
              return "";
            }
            if (parsedUrl.username || parsedUrl.password) {
              console.warn("\u{1F6E1}\uFE0F URL contains credentials:", url);
              this.stats.threatsBlocked++;
              return "";
            }
            if (options.blockPrivateIPs) {
              const hostname = parsedUrl.hostname.toLowerCase();
              if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.16.") || hostname === "[::1]") {
                console.warn("\u{1F6E1}\uFE0F Private IP/localhost blocked:", hostname);
                this.stats.threatsBlocked++;
                return "";
              }
            }
            return parsedUrl.href;
          } catch (error) {
            console.error("\u274C URL sanitization error:", error);
            this.stats.threatsBlocked++;
            return "";
          }
        }
        /**
         * Sanitize filenames to prevent path traversal and special characters
         * @param {string} filename - Filename to sanitize
         * @param {Object} options - Additional options
         * @returns {string} - Sanitized filename or generated safe filename
         */
        sanitizeFilename(filename, options = {}) {
          this.stats.filenamesProcessed++;
          try {
            if (!filename || typeof filename !== "string") {
              return this.generateSafeFilename();
            }
            filename = filename.split(/[\\/]/).pop() || filename;
            filename = filename.trim();
            if (filename.length === 0) {
              return this.generateSafeFilename();
            }
            if (filename.length > this.options.maxFilenameLength) {
              console.warn("\u{1F6E1}\uFE0F Filename exceeds maximum length:", filename.length);
              filename = filename.substring(0, this.options.maxFilenameLength);
            }
            for (const pattern of this.dangerousPatterns.path) {
              if (pattern.test(filename)) {
                console.warn("\u{1F6E1}\uFE0F Path traversal pattern detected:", pattern);
                this.stats.threatsBlocked++;
                return this.generateSafeFilename();
              }
            }
            filename = filename.replace(/[^a-zA-Z0-9\-_. ()]/g, "_");
            filename = filename.replace(/\.{2,}/g, ".");
            filename = filename.replace(/^[.\s]+|[.\s]+$/g, "");
            if (filename.length === 0 || filename === ".") {
              return this.generateSafeFilename();
            }
            if (!this.options.allowedFilenameChars.test(filename)) {
              console.warn("\u{1F6E1}\uFE0F Invalid characters remain in filename:", filename);
              return this.generateSafeFilename();
            }
            const reservedNames = [
              "CON",
              "PRN",
              "AUX",
              "NUL",
              "COM1",
              "COM2",
              "COM3",
              "COM4",
              "COM5",
              "COM6",
              "COM7",
              "COM8",
              "COM9",
              "LPT1",
              "LPT2",
              "LPT3",
              "LPT4",
              "LPT5",
              "LPT6",
              "LPT7",
              "LPT8",
              "LPT9"
            ];
            const nameWithoutExt = filename.split(".")[0].toUpperCase();
            if (reservedNames.includes(nameWithoutExt)) {
              filename = "_" + filename;
            }
            return filename;
          } catch (error) {
            console.error("\u274C Filename sanitization error:", error);
            this.stats.threatsBlocked++;
            return this.generateSafeFilename();
          }
        }
        /**
         * Sanitize HTML content to prevent XSS attacks
         * @param {string} html - HTML content to sanitize
         * @param {Object} options - Additional options
         * @returns {string} - Sanitized HTML (escaped)
         */
        sanitizeHTML(html, options = {}) {
          this.stats.htmlProcessed++;
          try {
            if (!html || typeof html !== "string") {
              return "";
            }
            html = html.trim();
            if (html.length === 0) {
              return "";
            }
            const htmlEscapeMap = {
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#x27;",
              "/": "&#x2F;"
            };
            const escapedHtml = html.replace(/[&<>"'\/]/g, (char) => {
              return htmlEscapeMap[char];
            });
            return escapedHtml;
          } catch (error) {
            console.error("\u274C HTML sanitization error:", error);
            this.stats.threatsBlocked++;
            return "";
          }
        }
        /**
         * Generate a safe filename with timestamp
         * @returns {string} - Safe generated filename
         */
        generateSafeFilename() {
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1e4);
          return `file_${timestamp}_${random}`;
        }
        /**
         * Batch sanitize multiple selectors
         * @param {Array<string>} selectors - Array of selectors to sanitize
         * @returns {Array<string>} - Array of sanitized selectors
         */
        sanitizeSelectors(selectors) {
          if (!Array.isArray(selectors)) {
            return [];
          }
          return selectors.map((selector) => this.sanitizeSelector(selector)).filter((s) => s.length > 0);
        }
        /**
         * Batch sanitize multiple URLs
         * @param {Array<string>} urls - Array of URLs to sanitize
         * @returns {Array<string>} - Array of sanitized URLs
         */
        sanitizeURLs(urls, options = {}) {
          if (!Array.isArray(urls)) {
            return [];
          }
          return urls.map((url) => this.sanitizeURL(url, options)).filter((u) => u.length > 0);
        }
        /**
         * Get sanitization statistics
         * @returns {Object} - Statistics object
         */
        getStats() {
          return { ...this.stats };
        }
        /**
         * Reset statistics
         */
        resetStats() {
          this.stats = {
            selectorsProcessed: 0,
            urlsProcessed: 0,
            filenamesProcessed: 0,
            htmlProcessed: 0,
            threatsBlocked: 0
          };
        }
      };
      if (typeof window !== "undefined") {
        window.InputSanitizer = InputSanitizer;
      }
      if (typeof globalThis !== "undefined") {
        globalThis.InputSanitizer = InputSanitizer;
      }
      console.log("\u2705 Input Sanitizer System loaded");
    }
  });

  // content/content-bundle.js
  var require_content_bundle = __commonJS({
    "content/content-bundle.js"(exports, module) {
      init_constants();
      init_input_sanitizer();
      if (window.__STEPTHREE_INJECTED) {
        console.log("\u26A0\uFE0F STEPTHREE Content Bundle already injected, skipping...");
        throw new Error("Content script already loaded");
      }
      window.__STEPTHREE_INJECTED = true;
      if (window.location.protocol === "chrome:" || window.location.protocol === "chrome-extension:" || window.location.protocol === "about:") {
        console.log("\u23ED\uFE0F STEPTHREE skipping system page:", window.location.protocol);
        throw new Error("Extension not applicable on system pages");
      }
      console.log("\u{1F680} STEPTHREE Content Bundle loading...");
      (function() {
        "use strict";
        const global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
        if (!global.__ST) {
          global.__ST = {};
        }
        if (global.__ST.DebugConfigLoaded) {
          return;
        }
        global.__ST.DebugConfigLoaded = true;
        class DebugConfig {
          constructor() {
            this.isProduction = this.detectProductionEnvironment();
            this.globalDebugSettings = {
              enableConsoleLogging: !this.isProduction,
              enablePerformanceLogging: !this.isProduction,
              enableErrorLogging: true,
              // Always log errors
              enableWarningLogging: true,
              // Always log warnings
              enableInfoLogging: !this.isProduction,
              enableDebugLogging: false,
              // Only for development debugging
              enableVerboseLogging: false
              // Only for deep debugging
            };
            this.moduleSettings = {
              "scraper": { enableConsoleLogging: !this.isProduction },
              "picker": { enableConsoleLogging: !this.isProduction },
              "background": { enableConsoleLogging: !this.isProduction },
              "export": { enableConsoleLogging: !this.isProduction },
              "performance": { enableConsoleLogging: !this.isProduction },
              "ui": { enableConsoleLogging: !this.isProduction }
            };
          }
          /**
           * Detect if we're running in a production environment
           */
          detectProductionEnvironment() {
            try {
              if (typeof chrome !== "undefined" && chrome.runtime) {
                const manifest = chrome.runtime.getManifest();
                if (chrome.runtime.getURL("").startsWith("chrome-extension://")) {
                  return true;
                }
              }
              if (typeof location !== "undefined") {
                const isDevelopment = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.port !== "";
                return !isDevelopment;
              }
              return true;
            } catch (error) {
              return true;
            }
          }
          /**
           * Check if debugging is enabled for a specific module and level
           */
          isEnabled(module2, level) {
            module2 = module2 || "global";
            level = level || "info";
            const moduleSettings = this.moduleSettings[module2] || this.globalDebugSettings;
            switch (level.toLowerCase()) {
              case "error":
                return moduleSettings.enableErrorLogging !== false;
              case "warn":
              case "warning":
                return moduleSettings.enableWarningLogging !== false;
              case "info":
                return moduleSettings.enableInfoLogging !== false && moduleSettings.enableConsoleLogging !== false;
              case "log":
                return moduleSettings.enableConsoleLogging !== false;
              case "debug":
                return moduleSettings.enableDebugLogging === true && moduleSettings.enableConsoleLogging !== false;
              case "verbose":
                return moduleSettings.enableVerboseLogging === true && moduleSettings.enableConsoleLogging !== false;
              case "performance":
                return moduleSettings.enablePerformanceLogging !== false && moduleSettings.enableConsoleLogging !== false;
              default:
                return moduleSettings.enableConsoleLogging !== false;
            }
          }
          /**
           * Safe console logging with debug controls
           */
          log(module2, level, ...args) {
            if (!this.isEnabled(module2, level)) {
              return;
            }
            const prefix = "[" + (module2 || "STEPTHREE").toUpperCase() + "]";
            switch ((level || "log").toLowerCase()) {
              case "error":
                console.error.apply(console, [prefix].concat(args));
                break;
              case "warn":
              case "warning":
                console.warn.apply(console, [prefix].concat(args));
                break;
              case "info":
                console.info.apply(console, [prefix].concat(args));
                break;
              case "debug":
                console.debug.apply(console, [prefix].concat(args));
                break;
              case "performance":
                if (console.time) {
                  console.time(prefix + " " + args[0]);
                } else {
                  console.log.apply(console, [prefix].concat(args));
                }
                break;
              default:
                console.log.apply(console, [prefix].concat(args));
            }
          }
          /**
           * Performance timing utilities
           */
          timeStart(module2, label) {
            if (!this.isEnabled(module2, "performance")) {
              return;
            }
            console.time("[" + (module2 || "STEPTHREE").toUpperCase() + "] " + label);
          }
          timeEnd(module2, label) {
            if (!this.isEnabled(module2, "performance")) {
              return;
            }
            console.timeEnd("[" + (module2 || "STEPTHREE").toUpperCase() + "] " + label);
          }
        }
        global.__ST.DebugConfig = DebugConfig;
        if (!global.__ST.DEBUG) {
          global.__ST.DEBUG = new DebugConfig();
        }
        if (typeof window !== "undefined") {
          window.DEBUG = global.__ST.DEBUG;
        } else if (typeof self !== "undefined") {
          self.DEBUG = global.__ST.DEBUG;
        }
      })();
      (function() {
        "use strict";
        const global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
        if (!global.__ST) {
          global.__ST = {};
        }
        if (global.__ST.InputSanitizationLoaded) {
          return;
        }
        global.__ST.InputSanitizationLoaded = true;
        let InputSanitizerClass = null;
        if (typeof global.InputSanitizer !== "undefined") {
          InputSanitizerClass = global.InputSanitizer;
        } else if (typeof window !== "undefined" && typeof window.InputSanitizer !== "undefined") {
          InputSanitizerClass = window.InputSanitizer;
        }
        let sanitizerInstance = null;
        if (InputSanitizerClass) {
          try {
            sanitizerInstance = new InputSanitizerClass();
            console.log("\u2705 Input Sanitizer initialized in content script (CR-019)");
          } catch (error) {
            throw new Error("SECURITY: Failed to initialize InputSanitizer - " + error.message);
          }
        } else {
          throw new Error("SECURITY: InputSanitizer is required but not available");
        }
        const SanitizationUtils = {
          /**
           * Sanitize CSS selector before using in querySelector
           */
          sanitizeSelector(selector) {
            if (!sanitizerInstance) {
              throw new Error("SECURITY: InputSanitizer required for selector sanitization");
            }
            return sanitizerInstance.sanitizeSelector(selector);
          },
          /**
           * Sanitize URL before using
           */
          sanitizeURL(url) {
            if (!sanitizerInstance) {
              throw new Error("SECURITY: InputSanitizer required for URL sanitization");
            }
            return sanitizerInstance.sanitizeURL(url);
          },
          /**
           * Sanitize HTML content to prevent XSS
           */
          sanitizeHTML(html) {
            if (!sanitizerInstance) {
              throw new Error("SECURITY: InputSanitizer required for HTML sanitization");
            }
            return sanitizerInstance.sanitizeHTML(html);
          },
          /**
           * Sanitize filename
           */
          sanitizeFilename(filename) {
            if (!sanitizerInstance) {
              throw new Error("SECURITY: InputSanitizer required for filename sanitization");
            }
            return sanitizerInstance.sanitizeFilename(filename);
          },
          /**
           * Safe querySelector with sanitization
           */
          safeQuerySelector(element, selector) {
            const sanitized = this.sanitizeSelector(selector);
            if (!sanitized) {
              console.warn("\u{1F6E1}\uFE0F Selector sanitization blocked invalid selector");
              return null;
            }
            try {
              return element.querySelector(sanitized);
            } catch (error) {
              console.warn("Invalid selector:", sanitized, error);
              return null;
            }
          },
          /**
           * Safe querySelectorAll with sanitization
           */
          safeQuerySelectorAll(element, selector) {
            const sanitized = this.sanitizeSelector(selector);
            if (!sanitized) {
              console.warn("\u{1F6E1}\uFE0F Selector sanitization blocked invalid selector");
              return [];
            }
            try {
              return element.querySelectorAll(sanitized);
            } catch (error) {
              console.warn("Invalid selector:", sanitized, error);
              return [];
            }
          },
          /**
           * Get sanitizer instance
           */
          getSanitizer() {
            return sanitizerInstance;
          }
        };
        global.__ST.SanitizationUtils = SanitizationUtils;
        if (typeof window !== "undefined") {
          window.SanitizationUtils = SanitizationUtils;
        } else if (typeof self !== "undefined") {
          self.SanitizationUtils = SanitizationUtils;
        }
      })();
      (function() {
        "use strict";
        const global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
        if (!global.__ST) {
          global.__ST = {};
        }
        if (global.__ST.MemoryManagementLoaded) {
          return;
        }
        global.__ST.MemoryManagementLoaded = true;
        class LRUCache {
          constructor(maxSize = 1e3) {
            this.maxSize = maxSize;
            this.cache = /* @__PURE__ */ new Map();
          }
          get(key) {
            if (this.cache.has(key)) {
              const value = this.cache.get(key);
              this.cache.delete(key);
              this.cache.set(key, value);
              return value;
            }
            return null;
          }
          set(key, value) {
            if (this.cache.has(key)) {
              this.cache.delete(key);
            } else if (this.cache.size >= this.maxSize) {
              const firstKey = this.cache.keys().next().value;
              this.cache.delete(firstKey);
            }
            this.cache.set(key, value);
          }
          delete(key) {
            return this.cache.delete(key);
          }
          clear() {
            this.cache.clear();
          }
          get size() {
            return this.cache.size;
          }
          [Symbol.iterator]() {
            return this.cache[Symbol.iterator]();
          }
        }
        class BoundedArray {
          constructor(maxSize = 1e3) {
            this.maxSize = maxSize;
            this.items = [];
          }
          push(item) {
            this.items.push(item);
            if (this.items.length > this.maxSize) {
              this.items.shift();
            }
            return this.items.length;
          }
          unshift(item) {
            this.items.unshift(item);
            if (this.items.length > this.maxSize) {
              this.items.pop();
            }
            return this.items.length;
          }
          slice(start, end) {
            return this.items.slice(start, end);
          }
          forEach(callback) {
            return this.items.forEach(callback);
          }
          get length() {
            return this.items.length;
          }
          clear() {
            this.items.length = 0;
          }
        }
        class ResourceTracker {
          constructor() {
            this.observers = /* @__PURE__ */ new Set();
            this.timers = /* @__PURE__ */ new Set();
            this.intervals = /* @__PURE__ */ new Set();
            this.eventListeners = /* @__PURE__ */ new WeakMap();
            this.workers = /* @__PURE__ */ new Set();
            this.originalSetTimeout = window.setTimeout;
            this.originalSetInterval = window.setInterval;
            this.originalClearTimeout = window.clearTimeout;
            this.originalClearInterval = window.clearInterval;
            this.isIntercepting = false;
            this.setupInterception();
          }
          setupInterception() {
            if (this.isIntercepting) {
              return;
            }
            const self2 = this;
            window.setTimeout = function(callback, delay, ...args) {
              const timeoutId = self2.originalSetTimeout.call(this, function() {
                self2.timers.delete(timeoutId);
                return callback.apply(this, args);
              }, delay);
              self2.timers.add(timeoutId);
              return timeoutId;
            };
            window.setInterval = function(callback, delay, ...args) {
              const intervalId = self2.originalSetInterval.call(this, callback, delay, ...args);
              self2.intervals.add(intervalId);
              return intervalId;
            };
            window.clearTimeout = function(timeoutId) {
              self2.timers.delete(timeoutId);
              return self2.originalClearTimeout.call(this, timeoutId);
            };
            window.clearInterval = function(intervalId) {
              self2.intervals.delete(intervalId);
              return self2.originalClearInterval.call(this, intervalId);
            };
            this.isIntercepting = true;
          }
          trackObserver(observer) {
            this.observers.add(observer);
          }
          trackEventListener(element, event, listener, options) {
            if (!this.eventListeners.has(element)) {
              this.eventListeners.set(element, /* @__PURE__ */ new Map());
            }
            const elementListeners = this.eventListeners.get(element);
            if (!elementListeners.has(event)) {
              elementListeners.set(event, /* @__PURE__ */ new Set());
            }
            elementListeners.get(event).add({ listener, options });
          }
          trackWorker(worker) {
            this.workers.add(worker);
          }
          cleanup() {
            for (const observer of this.observers) {
              try {
                if (observer && typeof observer.disconnect === "function") {
                  observer.disconnect();
                }
              } catch (error) {
                console.warn("Error disconnecting observer:", error);
              }
            }
            this.observers.clear();
            for (const timerId of this.timers) {
              try {
                this.originalClearTimeout.call(window, timerId);
              } catch (error) {
                console.warn("Error clearing timeout:", error);
              }
            }
            this.timers.clear();
            for (const intervalId of this.intervals) {
              try {
                this.originalClearInterval.call(window, intervalId);
              } catch (error) {
                console.warn("Error clearing interval:", error);
              }
            }
            this.intervals.clear();
            for (const worker of this.workers) {
              try {
                if (worker && typeof worker.terminate === "function") {
                  worker.terminate();
                }
              } catch (error) {
                console.warn("Error terminating worker:", error);
              }
            }
            this.workers.clear();
            if (this.isIntercepting) {
              window.setTimeout = this.originalSetTimeout;
              window.setInterval = this.originalSetInterval;
              window.clearTimeout = this.originalClearTimeout;
              window.clearInterval = this.originalClearInterval;
              this.isIntercepting = false;
            }
            console.log("\u{1F9F9} Resource tracker cleanup completed");
          }
          getStatus() {
            return {
              observers: this.observers.size,
              timers: this.timers.size,
              intervals: this.intervals.size,
              workers: this.workers.size,
              timestamp: Date.now()
            };
          }
        }
        class DOMReferenceManager {
          constructor() {
            this.elementMetadata = /* @__PURE__ */ new WeakMap();
            this.elementCaches = /* @__PURE__ */ new WeakMap();
          }
          setElementMetadata(element, metadata) {
            if (element && element instanceof Element) {
              this.elementMetadata.set(element, metadata);
            }
          }
          getElementMetadata(element) {
            return this.elementMetadata.get(element);
          }
          setElementCache(element, cache) {
            if (element && element instanceof Element) {
              this.elementCaches.set(element, cache);
            }
          }
          getElementCache(element) {
            return this.elementCaches.get(element);
          }
          cleanup() {
            try {
              if (typeof window.gc === "function") {
                window.gc();
              }
            } catch (error) {
            }
            console.log("\u{1F5D1}\uFE0F DOM reference cleanup completed");
          }
        }
        class MemoryMonitor {
          constructor() {
            this.samples = new BoundedArray(100);
            this.lastSample = null;
            this.thresholds = {
              warning: PERFORMANCE_CONFIG.MEMORY_WARNING_THRESHOLD_BYTES,
              critical: PERFORMANCE_CONFIG.MEMORY_CRITICAL_THRESHOLD_BYTES
            };
            this.startMonitoring();
          }
          startMonitoring() {
            window.setInterval(() => {
              this.takeSample();
            }, PERFORMANCE_CONFIG.MEMORY_SAMPLE_INTERVAL_MS);
            setTimeout(() => this.takeSample(), 1e3);
          }
          takeSample() {
            try {
              if (typeof performance === "undefined" || !performance.memory) {
                return;
              }
              const sample = {
                timestamp: Date.now(),
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                resourcesTracked: global.__ST.resourceTracker ? global.__ST.resourceTracker.getStatus() : {}
              };
              this.samples.push(sample);
              this.lastSample = sample;
              this.checkMemoryThresholds(sample);
              this.reportHealthStatus(sample);
            } catch (error) {
              console.warn("Error taking memory sample:", error);
            }
          }
          checkMemoryThresholds(sample) {
            const used = sample.usedJSHeapSize;
            if (used > this.thresholds.critical) {
              console.error("\u{1F4A5} CRITICAL MEMORY USAGE:", this.formatBytes(used));
              this.triggerEmergencyCleanup();
            } else if (used > this.thresholds.warning) {
              console.warn("\u26A0\uFE0F HIGH MEMORY USAGE:", this.formatBytes(used));
              this.triggerPreventiveCleanup();
            }
          }
          triggerEmergencyCleanup() {
            try {
              global.__ST.lifecycleManager?.emergencyCleanup();
            } catch (error) {
              console.error("Emergency cleanup failed:", error);
            }
          }
          triggerPreventiveCleanup() {
            try {
              global.__ST.lifecycleManager?.preventiveCleanup();
            } catch (error) {
              console.warn("Preventive cleanup failed:", error);
            }
          }
          reportHealthStatus(sample) {
            try {
              if (typeof chrome !== "undefined" && chrome.runtime) {
                chrome.runtime.sendMessage({
                  cmd: "health_status",
                  type: "memory_sample",
                  data: {
                    usedMemory: sample.usedJSHeapSize,
                    totalMemory: sample.totalJSHeapSize,
                    resourceCount: sample.resourcesTracked,
                    timestamp: sample.timestamp
                  }
                }).catch(() => {
                });
              }
            } catch (error) {
            }
          }
          formatBytes(bytes) {
            if (bytes === 0) return "0 Bytes";
            const k = 1024;
            const sizes = ["Bytes", "KB", "MB", "GB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
          }
          getMemoryStats() {
            const recent = this.samples.slice(-10);
            if (recent.length === 0) return null;
            const current = recent[recent.length - 1];
            const trend = recent.length > 1 ? (current.usedJSHeapSize - recent[0].usedJSHeapSize) / recent.length : 0;
            return {
              current: current.usedJSHeapSize,
              trend,
              samples: recent.length,
              formatted: this.formatBytes(current.usedJSHeapSize)
            };
          }
        }
        class LifecycleManager {
          constructor() {
            this.initialized = false;
            this.cleanupHandlers = /* @__PURE__ */ new Set();
            this.emergencyCleanupHandlers = /* @__PURE__ */ new Set();
            this.setupLifecycleHandlers();
          }
          setupLifecycleHandlers() {
            if (this.initialized) return;
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "hidden") {
                this.onPageHidden();
              }
            });
            window.addEventListener("beforeunload", () => {
              this.onBeforeUnload();
            });
            window.addEventListener("pagehide", () => {
              this.onPageHide();
            });
            window.addEventListener("blur", () => {
              this.onBlur();
            });
            this.initialized = true;
            console.log("\u2705 Lifecycle manager initialized");
          }
          registerCleanupHandler(handler, isEmergency = false) {
            if (typeof handler === "function") {
              if (isEmergency) {
                this.emergencyCleanupHandlers.add(handler);
              } else {
                this.cleanupHandlers.add(handler);
              }
            }
          }
          unregisterCleanupHandler(handler) {
            this.cleanupHandlers.delete(handler);
            this.emergencyCleanupHandlers.delete(handler);
          }
          onPageHidden() {
            this.preventiveCleanup();
          }
          onBeforeUnload() {
            this.fullCleanup();
          }
          onPageHide() {
            this.fullCleanup();
          }
          onBlur() {
            setTimeout(() => {
              if (document.hidden) {
                this.preventiveCleanup();
              }
            }, 5e3);
          }
          preventiveCleanup() {
            console.log("\u{1F9F9} Starting preventive cleanup...");
            for (const handler of this.cleanupHandlers) {
              try {
                handler("preventive");
              } catch (error) {
                console.warn("Cleanup handler error:", error);
              }
            }
            this.clearCaches();
          }
          emergencyCleanup() {
            console.log("\u{1F6A8} Starting emergency cleanup...");
            for (const handler of [...this.cleanupHandlers, ...this.emergencyCleanupHandlers]) {
              try {
                handler("emergency");
              } catch (error) {
                console.error("Emergency cleanup handler error:", error);
              }
            }
            this.clearCaches();
            global.__ST.resourceTracker?.cleanup();
            global.__ST.domReferenceManager?.cleanup();
            try {
              if (typeof window.gc === "function") {
                window.gc();
              }
            } catch (error) {
            }
          }
          fullCleanup() {
            console.log("\u{1F9F9} Starting full cleanup...");
            for (const handler of [...this.cleanupHandlers, ...this.emergencyCleanupHandlers]) {
              try {
                handler("full");
              } catch (error) {
                console.error("Full cleanup handler error:", error);
              }
            }
            global.__ST.resourceTracker?.cleanup();
            global.__ST.domReferenceManager?.cleanup();
            this.clearCaches();
            console.log("\u2705 Full cleanup completed");
          }
          clearCaches() {
            for (const key of Object.keys(global.__ST)) {
              const obj = global.__ST[key];
              if (obj && typeof obj.clear === "function") {
                try {
                  obj.clear();
                } catch (error) {
                  console.warn(`Error clearing cache ${key}:`, error);
                }
              }
            }
          }
        }
        global.__ST.LRUCache = LRUCache;
        global.__ST.BoundedArray = BoundedArray;
        global.__ST.ResourceTracker = ResourceTracker;
        global.__ST.DOMReferenceManager = DOMReferenceManager;
        global.__ST.MemoryMonitor = MemoryMonitor;
        global.__ST.LifecycleManager = LifecycleManager;
        if (!global.__ST.resourceTracker) {
          global.__ST.resourceTracker = new ResourceTracker();
        }
        if (!global.__ST.domReferenceManager) {
          global.__ST.domReferenceManager = new DOMReferenceManager();
        }
        if (!global.__ST.memoryMonitor) {
          global.__ST.memoryMonitor = new MemoryMonitor();
        }
        if (!global.__ST.lifecycleManager) {
          global.__ST.lifecycleManager = new LifecycleManager();
        }
        console.log("\u2705 Memory management system loaded");
      })();
      (function() {
        "use strict";
        const global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
        if (!global.__ST) {
          global.__ST = {};
        }
        if (global.__ST.DOMCachingLoaded) {
          return;
        }
        global.__ST.DOMCachingLoaded = true;
        const DOMQueryCacheClass = global.DOMQueryCache || global.__ST.DOMQueryCache;
        const DOMBatcherClass = global.DOMBatcher || global.__ST.DOMBatcher;
        if (!DOMQueryCacheClass || !DOMBatcherClass) {
          console.warn("\u26A0\uFE0F DOM caching classes not available - add dom-cache.js to manifest.json content_scripts");
          return;
        }
        let domQueryCache = null;
        try {
          domQueryCache = new DOMQueryCacheClass({
            defaultTTL: 5e3,
            // 5 seconds
            maxCacheSize: 50,
            // Limit cache size
            enableMutationObserver: true,
            mutationDebounce: 150,
            enableStats: true
          });
          domQueryCache.configureSelector("img", {
            ttl: 3e3,
            // Images change less frequently
            enabled: true
          });
          domQueryCache.configureSelector("a[href]", {
            ttl: 5e3,
            // Links are fairly static
            enabled: true
          });
          domQueryCache.configureSelector("img[data-src]", {
            ttl: 2e3,
            // Lazy images change more
            enabled: true
          });
          domQueryCache.configureSelector("img[data-lazy]", {
            ttl: 2e3,
            enabled: true
          });
          domQueryCache.configureSelector('[style*="background-image"]', {
            ttl: 4e3,
            enabled: true
          });
          console.log("\u2705 DOMQueryCache initialized (CR-015)");
        } catch (error) {
          console.warn("\u26A0\uFE0F Failed to initialize DOMQueryCache:", error);
        }
        let domBatcher = null;
        try {
          domBatcher = new DOMBatcherClass({
            autoFlush: true,
            flushDelay: 16,
            enableStats: true
          });
          console.log("\u2705 DOMBatcher initialized (CR-015)");
        } catch (error) {
          console.warn("\u26A0\uFE0F Failed to initialize DOMBatcher:", error);
        }
        global.__ST.domQueryCache = domQueryCache;
        global.__ST.domBatcher = domBatcher;
        global.__ST.cachedQuery = function(selector, options = {}) {
          if (!domQueryCache) {
            return Array.from(document.querySelectorAll(selector));
          }
          return domQueryCache.query(selector, options);
        };
        global.__ST.cachedQuerySingle = function(selector, options = {}) {
          if (!domQueryCache) {
            return document.querySelector(selector);
          }
          return domQueryCache.query(selector, { ...options, single: true });
        };
        global.__ST.batchRead = function(callback) {
          if (!domBatcher) {
            return Promise.resolve(callback());
          }
          return domBatcher.read(callback);
        };
        global.__ST.batchWrite = function(callback) {
          if (!domBatcher) {
            return Promise.resolve(callback());
          }
          return domBatcher.write(callback);
        };
        global.__ST.batchMeasure = function(element) {
          if (!domBatcher) {
            return Promise.resolve(element?.getBoundingClientRect() || null);
          }
          return domBatcher.measure(element);
        };
        if (typeof window !== "undefined") {
          window.cachedQuery = global.__ST.cachedQuery;
          window.cachedQuerySingle = global.__ST.cachedQuerySingle;
          window.batchRead = global.__ST.batchRead;
          window.batchWrite = global.__ST.batchWrite;
          window.batchMeasure = global.__ST.batchMeasure;
        }
        if (global.__ST.DEBUG && !global.__ST.DEBUG.isProduction) {
          setInterval(() => {
            if (domQueryCache) {
              const stats = domQueryCache.getStats();
              console.log("\u{1F4CA} DOM Cache Stats:", stats);
            }
            if (domBatcher) {
              const stats = domBatcher.getStats();
              console.log("\u{1F4CA} DOM Batcher Stats:", stats);
            }
          }, 6e4);
        }
      })();
      var ErrorHandlingSystem = class {
        constructor(options = {}) {
          this.options = {
            enableConsoleLogging: options.enableConsoleLogging !== false,
            enableUserNotifications: options.enableUserNotifications !== false,
            enableErrorReporting: options.enableErrorReporting !== false,
            maxErrorHistory: Math.min(options.maxErrorHistory || 100, 500),
            // Cap at 500
            // Lightweight configuration - no heavy monitoring
            enableSmartThrottling: options.enableSmartThrottling !== false,
            maxNotificationsPerMinute: options.maxNotificationsPerMinute || 3,
            errorRecoveryStrategies: options.errorRecoveryStrategies !== false,
            minimalErrorLogging: options.minimalErrorLogging || false,
            adaptiveErrorHandling: options.adaptiveErrorHandling !== false,
            ...options
          };
          const global = typeof globalThis !== "undefined" ? globalThis : window;
          const LRUCache = global.__ST?.LRUCache || Map;
          const BoundedArray = global.__ST?.BoundedArray || Array;
          this.notificationCounts = new LRUCache(100);
          this.lastErrorTimes = new LRUCache(200);
          this.recoveryAttempts = new LRUCache(50);
          this.errorCounts = new LRUCache(300);
          if (BoundedArray === Array) {
            this.errorHistory = [];
          } else {
            this.errorHistory = new BoundedArray(this.options.maxErrorHistory);
          }
          this.initialized = false;
          this.init();
        }
        init() {
          if (this.initialized) {
            return;
          }
          if (typeof window !== "undefined") {
            window.addEventListener("error", (event) => {
              // Only handle errors from extension code, not host page errors
              if (this.isExtensionError(event.filename)) {
                this.handleGlobalError(event.error, "Global Error", {
                  filename: event.filename,
                  lineno: event.lineno,
                  colno: event.colno
                });
              }
            });
            window.addEventListener("unhandledrejection", (event) => {
              // Promise rejections don't have a source URL, so we handle them all
              // but could filter by stack trace if needed in the future
              this.handleGlobalError(event.reason, "Unhandled Promise Rejection", {
                promise: event.promise
              });
            });
          }
          const global = typeof globalThis !== "undefined" ? globalThis : window;
          if (global.__ST?.lifecycleManager) {
            global.__ST.lifecycleManager.registerCleanupHandler((type) => {
              if (type === "preventive") {
                this.trimHistory();
              } else {
                this.clearHistory();
              }
            });
          }
          this.initialized = true;
          this.log("\u2705 Error handling system initialized with memory management", "info");
        }
        /**
         * Enhanced error handling
         * @param {Error|string} error - The error object or message
         * @param {string} context - Context where error occurred
         * @param {Object} metadata - Additional error metadata
         * @param {string} severity - Error severity: 'low', 'medium', 'high', 'critical'
         * @param {Object} recoveryOptions - Recovery strategy options
         */
        handleError(error, context = "Unknown", metadata = {}, severity = "medium", recoveryOptions = {}) {
          try {
            const errorInfo = this.normalizeError(error, context, metadata, severity);
            if (this.options.enableConsoleLogging) {
              this.logError(errorInfo);
            }
            this.addToHistory(errorInfo);
            this.trackErrorFrequency(errorInfo);
            if (this.options.enableUserNotifications && this.shouldNotifyUser(errorInfo)) {
              if (this.canNotifyUser(errorInfo)) {
                this.notifyUser(errorInfo);
              }
            }
            if (this.options.errorRecoveryStrategies && recoveryOptions.attemptRecovery) {
              this.attemptErrorRecovery(errorInfo, recoveryOptions);
            }
            return errorInfo;
          } catch (handlingError) {
            console.error("\u274C Error in error handling system:", handlingError);
            console.error("Original error:", error);
          }
        }
        /**
         * Check if an error originates from extension code
         */
        isExtensionError(filename) {
          if (!filename) {
            return false;
          }
          // Check if it's from a chrome-extension:// URL
          if (filename.startsWith("chrome-extension://")) {
            return true;
          }
          // Check if it's from our extension specifically
          try {
            const extensionUrl = chrome.runtime.getURL("");
            if (filename.startsWith(extensionUrl)) {
              return true;
            }
          } catch (e) {
            // If chrome.runtime is not available, fall back to checking the protocol
          }
          return false;
        }
        /**
         * Handle global unhandled errors
         */
        handleGlobalError(error, type, details) {
          this.handleError(error, `Global: ${type}`, details, "high");
        }
        /**
         * Normalize error into consistent format
         */
        normalizeError(error, context, metadata, severity) {
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          const id = this.generateErrorId();
          let message, stack, name;
          if (error instanceof Error) {
            message = error.message;
            stack = error.stack;
            name = error.name;
          } else if (typeof error === "string") {
            message = error;
            name = "CustomError";
          } else {
            message = String(error);
            name = "UnknownError";
          }
          return {
            id,
            timestamp,
            message,
            stack,
            name,
            context,
            severity,
            metadata: {
              url: typeof window !== "undefined" ? window.location?.href : "N/A",
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
              ...metadata
            }
          };
        }
        /**
         * Generate unique error ID
         */
        generateErrorId() {
          return "err_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
        }
        /**
         * Log error to console with appropriate formatting
         */
        logError(errorInfo) {
          const { severity, context, message, id } = errorInfo;
          const symbols = {
            low: "\u{1F4A1}",
            medium: "\u26A0\uFE0F",
            high: "\u274C",
            critical: "\u{1F4A5}"
          };
          const symbol = symbols[severity] || "\u26A0\uFE0F";
          console.group(`${symbol} [${severity.toUpperCase()}] ${context}`);
          console.error(`Message: ${message}`);
          console.error(`ID: ${id}`);
          console.error(`Time: ${errorInfo.timestamp}`);
          if (errorInfo.stack) {
            console.error("Stack:", errorInfo.stack);
          }
          if (Object.keys(errorInfo.metadata).length > 0) {
            console.error("Metadata:", errorInfo.metadata);
          }
          console.groupEnd();
        }
        /**
         * Add error to history - works with both regular array and BoundedArray
         */
        addToHistory(errorInfo) {
          if (typeof this.errorHistory.unshift === "function") {
            this.errorHistory.unshift(errorInfo);
            if (!this.errorHistory.maxSize && this.errorHistory.length > this.options.maxErrorHistory) {
              this.errorHistory = this.errorHistory.slice(0, this.options.maxErrorHistory);
            }
          } else {
            console.warn("Invalid errorHistory structure");
          }
        }
        /**
         * Track error frequency - works with both Map and LRUCache
         */
        trackErrorFrequency(errorInfo) {
          const key = `${errorInfo.context}:${errorInfo.message}`;
          const current = this.errorCounts.get(key) || 0;
          this.errorCounts.set(key, current + 1);
        }
        /**
         * Trim history for preventive cleanup
         */
        trimHistory() {
          if (typeof this.errorHistory.clear === "function") {
            const recentCount = Math.floor(this.options.maxErrorHistory * 0.5);
            if (this.errorHistory.length > recentCount) {
              const recent = this.errorHistory.slice(0, recentCount);
              this.errorHistory.clear();
              recent.forEach((error) => this.errorHistory.push(error));
            }
          } else if (Array.isArray(this.errorHistory)) {
            const keepCount = Math.floor(this.options.maxErrorHistory * 0.5);
            this.errorHistory = this.errorHistory.slice(0, keepCount);
          }
          console.log("\u{1F9F9} Error history trimmed");
        }
        /**
         * Determine if user should be notified
         */
        shouldNotifyUser(errorInfo) {
          if (!["high", "critical"].includes(errorInfo.severity)) {
            return false;
          }
          const key = `${errorInfo.context}:${errorInfo.message}`;
          const count = this.errorCounts.get(key) || 0;
          return count <= 3;
        }
        /**
         * Smart notification throttling
         */
        canNotifyUser(errorInfo) {
          const now = Date.now();
          const minute = Math.floor(now / 6e4);
          const key = `${minute}`;
          const currentCount = this.notificationCounts.get(key) || 0;
          if (currentCount >= this.options.maxNotificationsPerMinute) {
            return false;
          }
          const errorKey = `${errorInfo.context}:${errorInfo.name}`;
          const lastShown = this.lastErrorTimes.get(errorKey);
          if (lastShown && now - lastShown < 3e4) {
            return false;
          }
          this.notificationCounts.set(key, currentCount + 1);
          this.lastErrorTimes.set(errorKey, now);
          return true;
        }
        /**
         * Notify user about error
         */
        notifyUser(errorInfo) {
          try {
            const message = this.createUserFriendlyMessage(errorInfo);
            if (typeof chrome !== "undefined" && chrome.runtime) {
              chrome.runtime.sendMessage({
                cmd: "show_notification",
                title: "StepThree Gallery Scraper",
                body: message,
                iconUrl: "icons/48.png",
                notificationType: "basic"
              }).catch((error) => {
                console.error("Failed to send notification to service worker:", error);
                console.warn("User notification (fallback):", message);
              });
            } else if (typeof window !== "undefined") {
              console.warn("User notification:", message);
            }
          } catch (notificationError) {
            console.error("Failed to notify user:", notificationError);
          }
        }
        /**
         * Create user-friendly error message
         */
        createUserFriendlyMessage(errorInfo) {
          const contextMap = {
            "scraping": "There was an issue while scraping images.",
            "download": "Failed to download some images.",
            "export": "Export operation encountered a problem.",
            "network": "Network connection issue detected.",
            "permission": "Permission denied for this operation."
          };
          for (const [key, friendlyMessage] of Object.entries(contextMap)) {
            if (errorInfo.context.toLowerCase().includes(key)) {
              return `${friendlyMessage} Error ID: ${errorInfo.id}`;
            }
          }
          return `An error occurred in ${errorInfo.context}. Error ID: ${errorInfo.id}`;
        }
        /**
         * Attempt automatic error recovery
         */
        attemptErrorRecovery(errorInfo, recoveryOptions) {
          const recoveryKey = `${errorInfo.context}:${errorInfo.name}`;
          const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
          if (attempts >= 3) {
            this.log(`\u{1F6D1} Max recovery attempts reached for ${recoveryKey}`, "warn");
            return false;
          }
          this.recoveryAttempts.set(recoveryKey, attempts + 1);
          switch (errorInfo.context) {
            case "Content Script":
              this.recoverContentScript(recoveryOptions);
              break;
            case "Smart Selection":
              this.recoverSmartSelection(recoveryOptions);
              break;
            case "Download Manager":
              this.recoverDownload(recoveryOptions);
              break;
            default:
              this.genericRecovery(errorInfo, recoveryOptions);
          }
          return true;
        }
        /**
         * Content script recovery strategies
         */
        recoverContentScript(options) {
          this.log("\u{1F504} Attempting content script recovery...", "info");
          if (window.AdaptiveSelectorSystem) {
            window.AdaptiveSelectorSystem.clearCache?.();
          }
          if (options.retryCallback) {
            setTimeout(() => options.retryCallback(), 1e3);
          }
        }
        /**
         * Smart selection recovery
         */
        recoverSmartSelection(options) {
          this.log("\u{1F3AF} Attempting smart selection recovery...", "info");
          if (options.fallbackSelectors) {
            return options.fallbackSelectors;
          }
          if (window.AdaptiveSelectorSystem) {
            const system = window.AdaptiveSelectorSystem;
            system.options.confidenceThreshold = Math.max(0.4, system.options.confidenceThreshold - 0.2);
          }
        }
        /**
         * Download recovery
         */
        recoverDownload(options) {
          this.log("\u2B07\uFE0F Attempting download recovery...", "info");
          if (options.retryCallback) {
            setTimeout(() => options.retryCallback(), 2e3);
          }
        }
        /**
         * Generic error recovery
         */
        genericRecovery(errorInfo, options) {
          this.log(`\u{1F527} Generic recovery for ${errorInfo.context}`, "info");
          setTimeout(() => {
            const recoveryKey = `${errorInfo.context}:${errorInfo.name}`;
            this.recoveryAttempts.delete(recoveryKey);
          }, 3e5);
        }
        /**
         * Utility logging method
         */
        log(message, level = "info") {
          if (this.options.enableConsoleLogging) {
            const symbols = {
              info: "\u2139\uFE0F",
              warn: "\u26A0\uFE0F",
              error: "\u274C",
              success: "\u2705"
            };
            console.log(`${symbols[level] || "\u2139\uFE0F"} ${message}`);
          }
        }
        /**
         * Get error statistics
         */
        getErrorStats() {
          const stats = {
            totalErrors: this.errorHistory.length,
            bySeverity: {},
            byContext: {},
            mostFrequent: [],
            recentErrors: this.errorHistory.slice(0, 10)
          };
          this.errorHistory.forEach((error) => {
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
          });
          this.errorHistory.forEach((error) => {
            const context = error.context.split(":")[0];
            stats.byContext[context] = (stats.byContext[context] || 0) + 1;
          });
          const sortedFrequencies = Array.from(this.errorCounts.entries()).sort(([, a], [, b]) => b - a).slice(0, 5);
          stats.mostFrequent = sortedFrequencies.map(([key, count]) => ({
            error: key,
            count
          }));
          return stats;
        }
        /**
         * Clear error history
         */
        clearHistory() {
          if (typeof this.errorHistory.clear === "function") {
            this.errorHistory.clear();
          } else if (Array.isArray(this.errorHistory)) {
            this.errorHistory.length = 0;
          }
          this.errorCounts.clear();
          this.notificationCounts.clear();
          this.lastErrorTimes.clear();
          this.recoveryAttempts.clear();
          this.log("\u{1F5D1}\uFE0F Error history cleared", "info");
        }
      };
      if (typeof window !== "undefined") {
        const global = typeof globalThis !== "undefined" ? globalThis : window;
        if (!global.__ST) {
          global.__ST = {};
        }
        if (!global.__ST.ErrorHandlingSystemLoaded) {
          global.__ST.ErrorHandlingSystemLoaded = true;
          window.StepThreeErrorHandler = new ErrorHandlingSystem();
        }
      }
      var InputValidationSystem = class {
        constructor(options = {}) {
          this.options = {
            // Validation strictness levels
            strictMode: options.strictMode !== false,
            allowDangerousUrls: options.allowDangerousUrls || false,
            maxStringLength: options.maxStringLength || 1e4,
            maxArrayLength: options.maxArrayLength || 1e3,
            // Security settings
            enableXSSProtection: options.enableXSSProtection !== false,
            enableSQLInjectionProtection: options.enableSQLInjectionProtection !== false,
            // URL validation
            allowedProtocols: options.allowedProtocols || ["http:", "https:", "data:", "blob:"],
            blockedDomains: options.blockedDomains || [],
            // File validation
            allowedFileTypes: options.allowedFileTypes || ["jpg", "jpeg", "png", "gif", "webp", "svg"],
            maxFileSize: options.maxFileSize || 50 * 1024 * 1024,
            // 50MB
            ...options
          };
          this.xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe\b[^>]*>/gi
          ];
          this.sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
            /['"]\s*;\s*--/gi,
            /\/\*[\s\S]*?\*\//gi
          ];
          console.log("\u2705 Input Validation System initialized");
        }
        /**
         * Main validation entry point
         */
        validate(input, type, options = {}) {
          try {
            const validationConfig = {
              ...this.options,
              ...options,
              type,
              originalInput: input
            };
            return this.performValidation(input, type, validationConfig);
          } catch (error) {
            return {
              valid: false,
              sanitized: input,
              errors: [`Validation system error: ${error.message}`],
              type
            };
          }
        }
        /**
         * Perform validation based on type
         */
        performValidation(input, type, config) {
          switch (type) {
            case "url":
              return this.validateUrl(input, config);
            case "string":
              return this.validateString(input, config);
            case "css_selector":
              return this.validateCssSelector(input, config);
            case "filename":
              return this.validateFilename(input, config);
            case "user_input":
              return this.validateUserInput(input, config);
            default:
              return this.validateGeneric(input, config);
          }
        }
        /**
         * URL validation with security checks
         */
        validateUrl(url, config) {
          const errors = [];
          let sanitized = url;
          try {
            const urlObj = new URL(url);
            if (!this.options.allowedProtocols.includes(urlObj.protocol)) {
              errors.push(`Protocol '${urlObj.protocol}' not allowed`);
            }
            if (!this.options.allowDangerousUrls) {
              const dangerousPatterns = [
                /javascript:/i,
                /data:.*script/i,
                /vbscript:/i
              ];
              for (const pattern of dangerousPatterns) {
                if (pattern.test(url)) {
                  errors.push("URL contains potentially dangerous content");
                  break;
                }
              }
            }
            if (this.options.enableXSSProtection) {
              const urlString = urlObj.toString();
              for (const pattern of this.xssPatterns) {
                if (pattern.test(urlString)) {
                  errors.push("URL contains XSS patterns");
                  sanitized = this.sanitizeXSS(url);
                  break;
                }
              }
            }
          } catch (urlError) {
            errors.push(`Invalid URL format: ${urlError.message}`);
          }
          return {
            valid: errors.length === 0,
            sanitized,
            errors,
            type: "url"
          };
        }
        /**
         * String validation with XSS protection
         */
        validateString(str, config) {
          const errors = [];
          let sanitized = str;
          if (typeof str !== "string") {
            sanitized = String(str);
          }
          if (sanitized.length > this.options.maxStringLength) {
            errors.push(`String too long: ${sanitized.length} > ${this.options.maxStringLength}`);
            sanitized = sanitized.substring(0, this.options.maxStringLength);
          }
          if (this.options.enableXSSProtection) {
            sanitized = this.sanitizeXSS(sanitized);
          }
          if (this.options.enableSQLInjectionProtection) {
            for (const pattern of this.sqlPatterns) {
              if (pattern.test(sanitized)) {
                errors.push("String contains SQL injection patterns");
                sanitized = this.sanitizeSQLInjection(sanitized);
                break;
              }
            }
          }
          sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");
          return {
            valid: errors.length === 0,
            sanitized,
            errors,
            type: "string"
          };
        }
        /**
         * CSS selector validation
         */
        validateCssSelector(selector, config) {
          const errors = [];
          let sanitized = selector;
          try {
            document.querySelector(selector);
            const dangerousPatterns = [
              /javascript:/i,
              /expression\(/i,
              /url\([^)]*script/i
            ];
            for (const pattern of dangerousPatterns) {
              if (pattern.test(selector)) {
                errors.push("CSS selector contains dangerous patterns");
                break;
              }
            }
          } catch (selectorError) {
            errors.push(`Invalid CSS selector: ${selectorError.message}`);
          }
          return {
            valid: errors.length === 0,
            sanitized,
            errors,
            type: "css_selector"
          };
        }
        /**
         * Filename validation
         */
        validateFilename(filename, config) {
          const errors = [];
          let sanitized = filename;
          sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1F]/g, "");
          if (sanitized.length > 255) {
            errors.push("Filename too long");
            sanitized = sanitized.substring(0, 255);
          }
          if (this.options.allowedFileTypes.length > 0) {
            const extension = sanitized.split(".").pop()?.toLowerCase();
            if (extension && !this.options.allowedFileTypes.includes(extension)) {
              errors.push(`File type '${extension}' not allowed`);
            }
          }
          return {
            valid: errors.length === 0,
            sanitized,
            errors,
            type: "filename"
          };
        }
        /**
         * User input validation (strict)
         */
        validateUserInput(input, config) {
          const strictConfig = {
            ...config,
            enableXSSProtection: true,
            enableSQLInjectionProtection: true,
            strictMode: true
          };
          return this.validateString(input, strictConfig);
        }
        /**
         * Generic validation fallback
         */
        validateGeneric(input, config) {
          const errors = [];
          let sanitized = input;
          if (typeof input === "string") {
            sanitized = this.sanitizeBasic(input);
          }
          return {
            valid: true,
            sanitized,
            errors,
            type: "generic"
          };
        }
        /**
         * XSS sanitization
         */
        sanitizeXSS(str) {
          let sanitized = str;
          for (const pattern of this.xssPatterns) {
            sanitized = sanitized.replace(pattern, "");
          }
          sanitized = sanitized.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
          return sanitized;
        }
        /**
         * SQL injection sanitization
         */
        sanitizeSQLInjection(str) {
          let sanitized = str;
          for (const pattern of this.sqlPatterns) {
            sanitized = sanitized.replace(pattern, "");
          }
          return sanitized;
        }
        /**
         * Basic sanitization
         */
        sanitizeBasic(str) {
          return str.replace(/[\x00-\x1F\x7F]/g, "").trim();
        }
      };
      if (typeof window !== "undefined") {
        const global = typeof globalThis !== "undefined" ? globalThis : window;
        if (!global.__ST) {
          global.__ST = {};
        }
        if (!global.__ST.InputValidationSystemLoaded) {
          global.__ST.InputValidationSystemLoaded = true;
          window.inputValidator = new InputValidationSystem({
            strictMode: true,
            enableXSSProtection: true,
            enableSQLInjectionProtection: true
          });
        }
      }
      var StepThreeSelectorUtils = class {
        // Safe CSS selector validation with DoS protection
        static validateCSSSelector(selector) {
          if (!selector || typeof selector !== "string") {
            return { valid: false, error: "Selector cannot be empty" };
          }
          selector = selector.trim();
          if (!selector) {
            return { valid: false, error: "Selector cannot be empty" };
          }
          if (selector.length > 1e3) {
            return {
              valid: false,
              error: "Selector too long (max 1000 characters)",
              details: "Long selectors can cause performance issues"
            };
          }
          const nestingLevel = (selector.match(/\s+/g) || []).length;
          if (nestingLevel > 10) {
            return {
              valid: false,
              error: "Selector too complex (max 10 nesting levels)",
              details: "Complex selectors can cause performance issues"
            };
          }
          try {
            document.querySelector(selector);
            return { valid: true };
          } catch (error) {
            return {
              valid: false,
              error: `Invalid CSS selector: ${error.message}`,
              details: "Selector syntax is not valid CSS"
            };
          }
        }
        // Safe query selector with validation and fallback
        static safeQuerySelector(selector, context = document) {
          const validation = this.validateCSSSelector(selector);
          if (!validation.valid) {
            console.warn("Invalid CSS selector:", validation.error);
            return null;
          }
          try {
            return context.querySelector(selector);
          } catch (error) {
            console.warn("Error executing selector:", error.message);
            return null;
          }
        }
        // Safe query selector all with validation and performance limits
        static safeQuerySelectorAll(selector, context = document, maxResults = 1e3) {
          const validation = this.validateCSSSelector(selector);
          if (!validation.valid) {
            console.warn("Invalid CSS selector:", validation.error);
            return [];
          }
          try {
            const elements = Array.from(context.querySelectorAll(selector));
            if (elements.length > maxResults) {
              console.warn(`Selector returned ${elements.length} elements, limiting to ${maxResults}`);
              return elements.slice(0, maxResults);
            }
            return elements;
          } catch (error) {
            console.warn("Error executing selector:", error.message);
            return [];
          }
        }
        // Generate CSS path for an element
        static getElementCSSPath(element) {
          if (!(element instanceof Element)) {
            return "";
          }
          const path = [];
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.nodeName.toLowerCase();
            if (element.id) {
              selector += "#" + element.id;
              path.unshift(selector);
              break;
            } else {
              const siblings = element.parentNode ? Array.from(element.parentNode.children) : [];
              const sameTagSiblings = siblings.filter((sibling) => sibling.nodeName === element.nodeName);
              if (sameTagSiblings.length > 1) {
                const index = sameTagSiblings.indexOf(element) + 1;
                selector += `:nth-of-type(${index})`;
              }
            }
            path.unshift(selector);
            element = element.parentElement;
          }
          return path.join(" > ");
        }
        // Check if element is visible
        static isElementVisible(element) {
          if (!(element instanceof Element)) {
            return false;
          }
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
        }
        // Get element dimensions safely
        static getElementDimensions(element) {
          if (!(element instanceof Element)) {
            return { width: 0, height: 0, x: 0, y: 0 };
          }
          try {
            const rect = element.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              x: rect.left,
              y: rect.top
            };
          } catch (error) {
            console.warn("Error getting element dimensions:", error);
            return { width: 0, height: 0, x: 0, y: 0 };
          }
        }
      };
      var WorkerManager = class {
        constructor() {
          const global = typeof globalThis !== "undefined" ? globalThis : window;
          const LRUCache = global.__ST?.LRUCache || Map;
          this.workers = new LRUCache(10);
          this.workerIndex = 0;
          this.maxWorkers = Math.min(4, navigator.hardwareConcurrency || 2);
          if (global.__ST?.lifecycleManager) {
            global.__ST.lifecycleManager.registerCleanupHandler(() => {
              this.terminateAll();
            }, { name: 'WorkerManager', priority: 90 });
          }
        }
        // Create a worker from inline code
        createInlineWorker(workerCode, workerName = `worker_${this.workerIndex++}`) {
          try {
            const blob = new Blob([workerCode], { type: "application/javascript" });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);
            const global = typeof globalThis !== "undefined" ? globalThis : window;
            if (global.__ST?.resourceTracker) {
              global.__ST.resourceTracker.trackWorker(worker);
            }
            this.workers.set(workerName, {
              worker,
              url: workerUrl,
              created: Date.now()
            });
            worker.addEventListener("error", () => {
              this.terminateWorker(workerName);
            });
            return workerName;
          } catch (error) {
            console.error("Failed to create inline worker:", error);
            return null;
          }
        }
        // Send message to worker
        sendMessage(workerName, message) {
          const workerData = this.workers.get(workerName);
          if (!workerData) {
            console.error(`Worker ${workerName} not found`);
            return Promise.reject(new Error(`Worker ${workerName} not found`));
          }
          return new Promise((resolve, reject) => {
            const messageId = Date.now() + Math.random();
            const handleMessage2 = (event) => {
              if (event.data.messageId === messageId) {
                workerData.worker.removeEventListener("message", handleMessage2);
                if (event.data.error) {
                  reject(new Error(event.data.error));
                } else {
                  resolve(event.data.result);
                }
              }
            };
            workerData.worker.addEventListener("message", handleMessage2);
            workerData.worker.postMessage({ ...message, messageId });
            setTimeout(() => {
              workerData.worker.removeEventListener("message", handleMessage2);
              reject(new Error("Worker timeout"));
            }, 3e4);
          });
        }
        // Terminate specific worker
        terminateWorker(workerName) {
          const workerData = this.workers.get(workerName);
          if (workerData) {
            workerData.worker.terminate();
            URL.revokeObjectURL(workerData.url);
            this.workers.delete(workerName);
          }
        }
        // Terminate all workers
        terminateAll() {
          if (!this.workers) {
            return;
          }
          // Handle both LRUCache and Map iteration
          const entries = this.workers.entries ? Array.from(this.workers.entries()) : Array.from(this.workers);
          for (const [workerName] of entries) {
            this.terminateWorker(workerName);
          }
        }
        // Get worker status
        getWorkerStatus() {
          const status = {};
          if (!this.workers) {
            return status;
          }
          // Handle both LRUCache and Map iteration
          const entries = this.workers.entries ? Array.from(this.workers.entries()) : Array.from(this.workers);
          for (const [name, data] of entries) {
            status[name] = {
              created: data.created,
              age: Date.now() - data.created
            };
          }
          return status;
        }
      };
      if (typeof window !== "undefined") {
        window.StepThreeSelectorUtils = StepThreeSelectorUtils;
        window.WorkerManager = WorkerManager;
        if (!window.workerManager) {
          window.workerManager = new WorkerManager();
        }
      }
      console.log("\u2705 Library utilities loaded");
      var ServiceWorkerFetch = class {
        // Standard fetch replacement using service worker
        static async fetch(url, options = {}) {
          try {
            const response = await chrome.runtime.sendMessage({
              action: "fetch_url",
              url,
              options
            });
            if (!response.success) {
              throw new Error(response.error || "Service worker fetch failed");
            }
            return {
              ok: response.status >= 200 && response.status < 300,
              status: response.status,
              statusText: response.statusText,
              headers: new Map(Object.entries(response.headers)),
              // Data access methods
              async json() {
                return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
              },
              async text() {
                return typeof response.data === "string" ? response.data : response.data instanceof ArrayBuffer ? new TextDecoder().decode(response.data) : String(response.data);
              },
              async arrayBuffer() {
                return response.data instanceof ArrayBuffer ? response.data : new TextEncoder().encode(String(response.data)).buffer;
              },
              async blob() {
                const data = response.data instanceof ArrayBuffer ? response.data : new TextEncoder().encode(String(response.data)).buffer;
                return new Blob([data], { type: response.contentType || "application/octet-stream" });
              }
            };
          } catch (error) {
            console.error("ServiceWorkerFetch error:", error);
            throw error;
          }
        }
        // Image-specific fetch replacement
        static async fetchImage(url, options = {}) {
          try {
            const response = await chrome.runtime.sendMessage({
              action: "fetch_image",
              url,
              options
            });
            if (!response.success) {
              throw new Error(response.error || "Service worker image fetch failed");
            }
            const blob = new Blob([response.data], { type: response.contentType });
            return {
              ok: true,
              status: response.status,
              blob: () => Promise.resolve(blob),
              arrayBuffer: () => Promise.resolve(response.data)
            };
          } catch (error) {
            console.error("ServiceWorkerFetch image error:", error);
            throw error;
          }
        }
        // Image validation (HEAD request) replacement
        static async validateImage(url, options = {}) {
          try {
            const response = await chrome.runtime.sendMessage({
              action: "validate_image",
              url,
              options
            });
            if (!response.success) {
              throw new Error(response.error || "Service worker image validation failed");
            }
            return {
              ok: response.valid,
              status: response.status,
              headers: new Map([
                ["content-type", response.contentType],
                ["content-length", response.size?.toString()]
              ].filter(([k, v]) => v !== null))
            };
          } catch (error) {
            console.error("ServiceWorkerFetch validation error:", error);
            throw error;
          }
        }
        // Test service worker connectivity
        static async testConnection() {
          try {
            const response = await chrome.runtime.sendMessage({ action: "ping" });
            return response?.success === true;
          } catch (error) {
            console.error("ServiceWorkerFetch connection test failed:", error);
            return false;
          }
        }
      };
      if (typeof window !== "undefined") {
        window.ServiceWorkerFetch = ServiceWorkerFetch;
        if (typeof chrome !== "undefined" && chrome.runtime) {
          window.extensionFetch = ServiceWorkerFetch.fetch;
        }
      }
      console.log("\u2705 ServiceWorker fetch utilities loaded");
      if (!window.RobustHelpers) {
        window.RobustHelpers = true;
        class RobustHelpers {
          /**
           * Enhanced waitForSelector with multiple strategies and robust error handling
           * @param {string|string[]} selectors - CSS selector(s) to wait for
           * @param {Object} options - Configuration options
           * @returns {Promise<Element>} - The found element
           */
          static async waitForSelector(selectors, options = {}) {
            const config = {
              timeout: options.timeout || 1e4,
              interval: options.interval || 100,
              visible: options.visible !== false,
              enabled: options.enabled !== false,
              multiple: options.multiple || false,
              retries: options.retries || 3,
              throwOnTimeout: options.throwOnTimeout !== false,
              context: options.context || document,
              ...options
            };
            const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
            for (let attempt = 1; attempt <= config.retries; attempt++) {
              try {
                const result = await this._waitForSelectorAttempt(selectorArray, config);
                if (result) {
                  console.log(
                    `\u2705 Selector found on attempt ${attempt}:`,
                    Array.isArray(selectors) ? selectors[0] : selectors
                  );
                  return config.multiple ? result : result[0];
                }
              } catch (error) {
                console.warn(`\u26A0\uFE0F Attempt ${attempt} failed:`, error.message);
                if (attempt === config.retries) {
                  if (config.throwOnTimeout) {
                    throw new Error(`Failed to find selector after ${config.retries} attempts: ${selectorArray.join(", ")}`);
                  }
                  return null;
                }
                await this.sleep(config.interval * attempt);
              }
            }
            return null;
          }
          /**
           * Single attempt to find selector
           * @private
           */
          static async _waitForSelectorAttempt(selectors, config) {
            const startTime = Date.now();
            while (Date.now() - startTime < config.timeout) {
              for (const selector of selectors) {
                try {
                  const elements = config.multiple ? Array.from(config.context.querySelectorAll(selector)) : [config.context.querySelector(selector)].filter(Boolean);
                  if (elements.length > 0) {
                    const validElements = config.visible ? elements.filter((el) => this.isElementVisible(el)) : elements;
                    const enabledElements = config.enabled ? validElements.filter((el) => this.isElementEnabled(el)) : validElements;
                    if (enabledElements.length > 0) {
                      return enabledElements;
                    }
                  }
                } catch (error) {
                  console.warn(`Invalid selector "${selector}":`, error.message);
                }
              }
              await this.sleep(config.interval);
            }
            return null;
          }
          /**
           * Enhanced image gathering with comprehensive URL resolution and validation
           * @param {Object} options - Gathering options
           * @returns {Promise<Array>} - Array of image objects
           */
          static async gatherImages(options = {}) {
            const config = {
              selectors: options.selectors || [
                "img[src]",
                "img[data-src]",
                "img[data-lazy-src]",
                '[style*="background-image"]',
                "picture img",
                "figure img",
                ".image img",
                "[data-background]"
              ],
              minWidth: options.minWidth || 0,
              minHeight: options.minHeight || 0,
              formats: options.formats || ["jpg", "jpeg", "png", "gif", "webp", "svg"],
              includeThumbnails: options.includeThumbnails !== false,
              includeMetadata: options.includeMetadata !== false,
              deduplicateUrls: options.deduplicateUrls !== false,
              resolveUrls: options.resolveUrls !== false,
              validateImages: options.validateImages !== false,
              ...options
            };
            const imageResults = [];
            const seenUrls = /* @__PURE__ */ new Set();
            for (const selector of config.selectors) {
              try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                  const imageData = await this.extractImageFromElement(element, config);
                  if (imageData && this.validateImageData(imageData, config)) {
                    const normalizedUrl = this.normalizeUrl(imageData.url);
                    if (!config.deduplicateUrls || !seenUrls.has(normalizedUrl)) {
                      seenUrls.add(normalizedUrl);
                      imageResults.push(imageData);
                    }
                  }
                }
              } catch (error) {
                console.warn(`Error processing selector "${selector}":`, error);
              }
            }
            console.log(`\u{1F5BC}\uFE0F Gathered ${imageResults.length} images from ${seenUrls.size} unique URLs`);
            return imageResults;
          }
          /**
           * Extract image data from a single element
           * @param {Element} element - DOM element to extract from
           * @param {Object} config - Configuration options
           * @returns {Promise<Object|null>} - Image data object or null
           */
          static async extractImageFromElement(element, config = {}) {
            try {
              let url = null;
              let thumbnailUrl = null;
              if (element.tagName === "IMG") {
                url = element.src || element.dataset.src || element.dataset.lazySrc || element.dataset.original || element.getAttribute("data-url");
                thumbnailUrl = element.dataset.thumbnail || element.dataset.thumb;
              } else {
                const style = window.getComputedStyle(element);
                const backgroundImage = style.backgroundImage;
                if (backgroundImage && backgroundImage !== "none") {
                  const matches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                  url = matches ? matches[1] : null;
                }
                url = url || element.dataset.background || element.dataset.image;
              }
              if (!url) {
                return null;
              }
              const normalizedUrl = this.normalizeUrl(url);
              if (!normalizedUrl || !this.isValidImageUrl(normalizedUrl, config.formats)) {
                return null;
              }
              const rect = element.getBoundingClientRect();
              const dimensions = await this.getImageDimensions(normalizedUrl).catch(() => ({ width: 0, height: 0 }));
              const imageData = {
                url: normalizedUrl,
                thumbnailUrl: thumbnailUrl ? this.normalizeUrl(thumbnailUrl) : null,
                element,
                dimensions: {
                  natural: dimensions,
                  displayed: {
                    width: rect.width,
                    height: rect.height
                  }
                },
                metadata: config.includeMetadata ? await this.extractImageMetadata(element, normalizedUrl) : null,
                timestamp: Date.now()
              };
              return imageData;
            } catch (error) {
              console.warn("Error extracting image from element:", error);
              return null;
            }
          }
          /**
           * Comprehensive URL normalization
           * @param {string} url - URL to normalize
           * @param {Object} options - Normalization options
           * @returns {string|null} - Normalized URL or null if invalid
           */
          static normalizeUrl(url, options = {}) {
            if (!url || typeof url !== "string") {
              return null;
            }
            try {
              let cleanUrl = url.trim();
              cleanUrl = cleanUrl.replace(/^['"]|['"]$/g, "");
              if (cleanUrl.startsWith("data:")) {
                return options.allowDataUrls !== false ? cleanUrl : null;
              }
              if (cleanUrl.startsWith("//")) {
                cleanUrl = window.location.protocol + cleanUrl;
              }
              if (!cleanUrl.match(/^https?:/)) {
                cleanUrl = new URL(cleanUrl, window.location.href).href;
              }
              const urlObj = new URL(cleanUrl);
              return urlObj.href;
            } catch (error) {
              console.warn("URL normalization failed:", error);
              return null;
            }
          }
          /**
           * Validate if URL is a valid image URL
           * @param {string} url - URL to validate
           * @param {Array<string>} allowedFormats - Allowed image formats
           * @returns {boolean} - True if valid image URL
           */
          static isValidImageUrl(url, allowedFormats = ["jpg", "jpeg", "png", "gif", "webp", "svg"]) {
            if (!url) {
              return false;
            }
            try {
              const urlObj = new URL(url);
              if (urlObj.protocol === "data:") {
                return urlObj.pathname.startsWith("image/");
              }
              const pathname = urlObj.pathname.toLowerCase();
              const extension = pathname.split(".").pop();
              if (allowedFormats.includes(extension)) {
                return true;
              }
              const imagePatterns = [
                /\/images?\//,
                /\/img\//,
                /\/photos?\//,
                /\/gallery\//,
                /\/media\//,
                /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i
              ];
              return imagePatterns.some((pattern) => pattern.test(url));
            } catch (error) {
              return false;
            }
          }
          /**
           * Check if element is visible
           * @param {Element} element - Element to check
           * @returns {boolean} - True if visible
           */
          static isElementVisible(element) {
            if (!element) {
              return false;
            }
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.opacity !== "0" && style.display !== "none" && element.offsetParent !== null;
          }
          /**
           * Check if element is enabled/interactive
           * @param {Element} element - Element to check
           * @returns {boolean} - True if enabled
           */
          static isElementEnabled(element) {
            if (!element) {
              return false;
            }
            const style = window.getComputedStyle(element);
            return !element.disabled && style.pointerEvents !== "none" && !element.hasAttribute("aria-disabled");
          }
          /**
           * Click element with retries and various strategies
           * @param {Element} element - Element to click
           * @param {Object} options - Click options
           * @returns {Promise<boolean>} - True if click succeeded
           */
          static async clickElement(element, options = {}) {
            const config = {
              retries: options.retries || 3,
              scrollIntoView: options.scrollIntoView !== false,
              waitAfterScroll: options.waitAfterScroll || 300,
              clickStrategies: options.clickStrategies || ["click", "dispatchEvent", "mouseEvents"],
              ...options
            };
            if (!element) {
              return false;
            }
            for (let attempt = 1; attempt <= config.retries; attempt++) {
              try {
                if (config.scrollIntoView) {
                  element.scrollIntoView({ behavior: "smooth", block: "center" });
                  await this.sleep(config.waitAfterScroll);
                }
                if (!this.isElementVisible(element) || !this.isElementEnabled(element)) {
                  throw new Error("Element is not clickable");
                }
                for (const strategy of config.clickStrategies) {
                  try {
                    if (strategy === "click") {
                      element.click();
                    } else if (strategy === "dispatchEvent") {
                      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                    } else if (strategy === "mouseEvents") {
                      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                    }
                    console.log(`\u2705 Click succeeded with strategy "${strategy}" on attempt ${attempt}`);
                    return true;
                  } catch (strategyError) {
                    console.warn(`Click strategy "${strategy}" failed:`, strategyError);
                  }
                }
                throw new Error("All click strategies failed");
              } catch (error) {
                console.warn(`Click attempt ${attempt} failed:`, error.message);
                if (attempt === config.retries) {
                  return false;
                }
                await this.sleep(200 * attempt);
              }
            }
            return false;
          }
          /**
           * Extract text content with various fallbacks
           * @param {Element} element - Element to extract text from
           * @param {Object} options - Extraction options
           * @returns {string} - Extracted text
           */
          static extractText(element, options = {}) {
            if (!element) {
              return "";
            }
            const config = {
              trim: options.trim !== false,
              preserveLineBreaks: options.preserveLineBreaks || false,
              maxLength: options.maxLength || null,
              fallbackToTitle: options.fallbackToTitle !== false,
              fallbackToAlt: options.fallbackToAlt !== false,
              ...options
            };
            let text = "";
            if (element.textContent) {
              text = element.textContent;
            } else if (element.innerText) {
              text = element.innerText;
            } else if (config.fallbackToTitle && element.title) {
              text = element.title;
            } else if (config.fallbackToAlt && element.alt) {
              text = element.alt;
            }
            if (config.trim) {
              text = text.trim();
            }
            if (!config.preserveLineBreaks) {
              text = text.replace(/\s+/g, " ");
            }
            if (config.maxLength && text.length > config.maxLength) {
              text = text.substring(0, config.maxLength) + "...";
            }
            return text;
          }
          /**
           * Sleep utility
           * @param {number} ms - Milliseconds to sleep
           * @returns {Promise} - Promise that resolves after delay
           */
          static sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          /**
           * Get image dimensions
           * @param {string} url - Image URL
           * @returns {Promise<Object>} - Object with width and height
           */
          static getImageDimensions(url) {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => reject(new Error("Failed to load image"));
              img.src = url;
            });
          }
          /**
           * Extract image metadata
           * @param {Element} element - Image element
           * @param {string} url - Image URL
           * @returns {Promise<Object>} - Metadata object
           */
          static async extractImageMetadata(element, url) {
            const metadata = {
              alt: element.alt || "",
              title: element.title || "",
              className: element.className || "",
              id: element.id || "",
              src: url,
              format: this.getImageFormat(url),
              attributes: {}
            };
            for (const attr of element.attributes) {
              if (attr.name.startsWith("data-")) {
                metadata.attributes[attr.name] = attr.value;
              }
            }
            return metadata;
          }
          /**
           * Get image format from URL
           * @param {string} url - Image URL
           * @returns {string} - Image format
           */
          static getImageFormat(url) {
            try {
              const urlObj = new URL(url);
              const extension = urlObj.pathname.split(".").pop().toLowerCase();
              return extension || "unknown";
            } catch {
              return "unknown";
            }
          }
          /**
           * Validate image data against criteria
           * @param {Object} imageData - Image data object
           * @param {Object} config - Validation config
           * @returns {boolean} - True if valid
           */
          static validateImageData(imageData, config = {}) {
            if (!imageData || !imageData.url) {
              return false;
            }
            if (config.minWidth || config.minHeight) {
              const width = imageData.dimensions?.natural?.width || imageData.dimensions?.displayed?.width || 0;
              const height = imageData.dimensions?.natural?.height || imageData.dimensions?.displayed?.height || 0;
              if (config.minWidth && width < config.minWidth) {
                return false;
              }
              if (config.minHeight && height < config.minHeight) {
                return false;
              }
            }
            if (config.formats && Array.isArray(config.formats)) {
              const format = this.getImageFormat(imageData.url);
              if (!config.formats.includes(format)) {
                return false;
              }
            }
            return true;
          }
        }
        window.RobustHelpers = RobustHelpers;
        console.log("\u2705 Content core utilities loaded");
      }
      if (!window.DynamicContentObserver) {
        class DynamicContentObserver2 {
          constructor(options = {}) {
            this.options = {
              // Observer configuration
              observeAttributes: options.observeAttributes !== false,
              observeChildList: options.observeChildList !== false,
              observeSubtree: options.observeSubtree !== false,
              // Content detection thresholds
              minNewElements: options.minNewElements || 5,
              minImageElements: options.minImageElements || 3,
              significantChangeThreshold: options.significantChangeThreshold || 0.3,
              // Performance settings
              throttleDelay: options.throttleDelay || 500,
              maxCallbacksPerSecond: options.maxCallbacksPerSecond || 10,
              observerTimeout: options.observerTimeout || 3e4,
              // Content type detection
              detectImages: options.detectImages !== false,
              detectProducts: options.detectProducts !== false,
              detectGalleries: options.detectGalleries !== false,
              // Advanced detection patterns
              contentPatterns: options.contentPatterns || {
                images: ["img", '[style*="background-image"]', "picture", "[data-src]", "[data-lazy]", '[loading="lazy"]'],
                products: [".product", ".item", "[data-product]", ".listing", ".card"],
                galleries: [".gallery", ".grid", ".masonry", "[data-gallery]", ".feed", ".posts", ".tiles"],
                containers: [".container", ".content", ".main", '[role="main"]', "article", "section"],
                lazyImages: ["[data-src]", "[data-lazy]", "[data-original]", ".lazy", ".lazyload", '[loading="lazy"]']
              },
              // Element significance scoring
              significanceWeights: options.significanceWeights || {
                images: 0.8,
                products: 0.9,
                galleries: 0.7,
                links: 0.5,
                text: 0.3
              },
              ...options
            };
            this.isActive = false;
            this.observer = null;
            this.processTimer = null;
            const global = typeof globalThis !== "undefined" ? globalThis : window;
            const LRUCache = global.__ST?.LRUCache || Map;
            const BoundedArray = global.__ST?.BoundedArray || Array;
            this.callbacks = new LRUCache(20);
            this.changeBuffer = BoundedArray === Array ? [] : new BoundedArray(500);
            this.metrics = {
              totalChanges: 0,
              significantChanges: 0,
              elementsAdded: 0,
              elementsRemoved: 0,
              imagesDetected: 0,
              lastActivity: Date.now()
            };
            this.elementClassifiers = {
              isImageContent: (element) => {
                if (element.tagName === "IMG") return true;
                if (element.querySelector && element.querySelector("img")) return true;
                const style = window.getComputedStyle ? window.getComputedStyle(element) : {};
                return style.backgroundImage && style.backgroundImage !== "none";
              },
              isProductContent: (element) => {
                const text = element.textContent?.toLowerCase() || "";
                const className = element.className?.toLowerCase() || "";
                const productKeywords = ["price", "buy", "add to cart", "product", "$", "\u20AC", "\xA3"];
                const productClasses = ["product", "item", "listing", "card"];
                return productKeywords.some((k) => text.includes(k)) || productClasses.some((c) => className.includes(c));
              },
              isGalleryContent: (element) => {
                const className = element.className?.toLowerCase() || "";
                const children = element.children?.length || 0;
                const galleryClasses = ["gallery", "grid", "masonry", "photos"];
                const hasMultipleImages = children >= 3 && Array.from(element.children).filter(
                  (child) => this.elementClassifiers.isImageContent(child)
                ).length >= 2;
                return galleryClasses.some((c) => className.includes(c)) || hasMultipleImages;
              }
            };
          }
          start(callback = null) {
            if (this.isActive) {
              console.warn("DynamicContentObserver is already active");
              return false;
            }
            try {
              this.observer = new MutationObserver(this.handleMutations.bind(this));
              const global = typeof globalThis !== "undefined" ? globalThis : window;
              if (global.__ST?.resourceTracker) {
                global.__ST.resourceTracker.trackObserver(this.observer);
              }
              if (global.__ST?.lifecycleManager) {
                global.__ST.lifecycleManager.registerCleanupHandler(() => {
                  this.stop();
                });
              }
              const observerConfig = {
                childList: this.options.observeChildList,
                subtree: this.options.observeSubtree,
                attributes: this.options.observeAttributes,
                characterData: true
              };
              this.observer.observe(document.body, observerConfig);
              this.isActive = true;
              if (callback) {
                this.addCallback("default", callback);
              }
              setTimeout(() => {
                if (this.isActive && Date.now() - this.metrics.lastActivity > this.options.observerTimeout) {
                  console.log("\u{1F550} Auto-stopping observer due to inactivity");
                  this.stop();
                }
              }, this.options.observerTimeout);
              console.log("\u2705 DynamicContentObserver started successfully");
              return true;
            } catch (error) {
              console.error("\u274C Failed to start DynamicContentObserver:", error);
              return false;
            }
          }
          stop() {
            if (!this.isActive) {
              return false;
            }
            if (this.observer) {
              this.observer.disconnect();
              this.observer = null;
            }
            if (this.processTimer) {
              clearTimeout(this.processTimer);
              this.processTimer = null;
            }
            this.isActive = false;
            this.changeBuffer = [];
            console.log("\u{1F6D1} DynamicContentObserver stopped. Final metrics:", this.getMetrics());
            return true;
          }
          addCallback(name, callback) {
            if (typeof callback === "function") {
              this.callbacks.set(name, callback);
              console.log(`\u{1F4DE} Added callback: ${name}`);
            }
          }
          removeCallback(name) {
            const removed = this.callbacks.delete(name);
            if (removed) {
              console.log(`\u{1F5D1}\uFE0F Removed callback: ${name}`);
            }
            return removed;
          }
          handleMutations(mutations) {
            if (!this.isActive) return;
            const startTime = performance.now();
            this.metrics.lastActivity = Date.now();
            mutations.forEach((mutation) => {
              this.changeBuffer.push({
                type: mutation.type,
                target: mutation.target,
                addedNodes: Array.from(mutation.addedNodes),
                removedNodes: Array.from(mutation.removedNodes),
                attributeName: mutation.attributeName,
                oldValue: mutation.oldValue,
                timestamp: Date.now()
              });
            });
            if (this.processTimer) {
              clearTimeout(this.processTimer);
            }
            this.processTimer = setTimeout(() => {
              this.processChangeBuffer();
            }, this.options.throttleDelay);
          }
          processChangeBuffer() {
            if (!this.changeBuffer.length) return;
            const startTime = performance.now();
            console.log(`\u{1F504} Processing ${this.changeBuffer.length} buffered changes`);
            const analysis = this.analyzeChanges(this.changeBuffer);
            this.metrics.totalChanges += this.changeBuffer.length;
            if (this.isSignificantChange(analysis)) {
              this.metrics.significantChanges++;
              this.notifyCallbacks(analysis);
            }
            this.metrics.elementsAdded += analysis.addedElements.length;
            this.metrics.elementsRemoved += analysis.removedElements.length;
            this.metrics.imagesDetected += analysis.newImages.length;
            this.changeBuffer = [];
            const processingTime = performance.now() - startTime;
            console.log(`\u2705 Processed changes in ${processingTime.toFixed(2)}ms`);
          }
          analyzeChanges(changes) {
            const analysis = {
              addedElements: [],
              removedElements: [],
              modifiedElements: [],
              newImages: [],
              newProducts: [],
              newGalleries: [],
              contentTypes: /* @__PURE__ */ new Set(),
              significance: 0,
              patterns: []
            };
            changes.forEach((change) => {
              if (change.type === "childList") {
                change.addedNodes.forEach((node) => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    analysis.addedElements.push(node);
                    this.classifyElement(node, analysis);
                  }
                });
                change.removedNodes.forEach((node) => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    analysis.removedElements.push(node);
                  }
                });
              } else if (change.type === "attributes") {
                analysis.modifiedElements.push(change.target);
              }
            });
            analysis.significance = this.calculateSignificance(analysis);
            return analysis;
          }
          classifyElement(element, analysis) {
            if (this.options.detectImages && this.elementClassifiers.isImageContent(element)) {
              analysis.newImages.push(element);
              analysis.contentTypes.add("images");
            }
            if (this.options.detectProducts && this.elementClassifiers.isProductContent(element)) {
              analysis.newProducts.push(element);
              analysis.contentTypes.add("products");
            }
            if (this.options.detectGalleries && this.elementClassifiers.isGalleryContent(element)) {
              analysis.newGalleries.push(element);
              analysis.contentTypes.add("galleries");
            }
            if (element.children) {
              Array.from(element.children).forEach((child) => {
                this.classifyElement(child, analysis);
              });
            }
          }
          calculateSignificance(analysis) {
            let score = 0;
            const weights = this.options.significanceWeights;
            score += analysis.newImages.length * weights.images;
            score += analysis.newProducts.length * weights.products;
            score += analysis.newGalleries.length * weights.galleries;
            score += Math.min(analysis.addedElements.length * weights.links, 10);
            return Math.min(score / 10, 1);
          }
          isSignificantChange(analysis) {
            const elementThreshold = analysis.addedElements.length >= this.options.minNewElements;
            const imageThreshold = analysis.newImages.length >= this.options.minImageElements;
            const significanceThreshold = analysis.significance >= this.options.significantChangeThreshold;
            return elementThreshold || imageThreshold || significanceThreshold;
          }
          notifyCallbacks(analysis) {
            const data = {
              ...analysis,
              timestamp: Date.now(),
              metrics: { ...this.metrics }
            };
            this.callbacks.forEach((callback, name) => {
              try {
                callback(data);
              } catch (error) {
                console.error(`Callback ${name} failed:`, error);
              }
            });
          }
          getMetrics() {
            return {
              ...this.metrics,
              isActive: this.isActive,
              bufferedChanges: this.changeBuffer.length,
              activeCallbacks: this.callbacks.size
            };
          }
        }
        window.DynamicContentObserver = DynamicContentObserver2;
        console.log("\u2705 DOM observers loaded");
      }
      if (!window.EnhancedScraperUtils) {
        class EnhancedScraperUtils {
          constructor(options = {}) {
            this.options = {
              // Rate limiting
              requestsPerSecond: options.requestsPerSecond || 2,
              burstLimit: options.burstLimit || 5,
              cooldownPeriod: options.cooldownPeriod || 3e4,
              // Retry configuration
              maxRetries: options.maxRetries || 3,
              baseDelay: options.baseDelay || 1e3,
              maxDelay: options.maxDelay || 1e4,
              backoffMultiplier: options.backoffMultiplier || 2,
              // Content validation
              minImageSize: options.minImageSize || 100,
              maxImageSize: options.maxImageSize || 50 * 1024 * 1024,
              // 50MB
              allowedFormats: options.allowedFormats || ["jpg", "jpeg", "png", "webp", "gif", "svg"],
              // Performance monitoring
              enableMetrics: options.enableMetrics !== false,
              // Content filtering
              enableDuplicateDetection: options.enableDuplicateDetection !== false,
              enableContentValidation: options.enableContentValidation !== false,
              ...options
            };
            this.requestQueue = [];
            this.requestHistory = [];
            this.isThrottled = false;
            this.throttledUntil = 0;
            this.processedUrls = /* @__PURE__ */ new Set();
            this.contentHashes = /* @__PURE__ */ new Set();
            this.metrics = {
              totalRequests: 0,
              successfulRequests: 0,
              failedRequests: 0,
              retriedRequests: 0,
              duplicatesSkipped: 0,
              averageResponseTime: 0
            };
            console.log("\u2705 Enhanced scraper utilities initialized");
          }
          // Enhanced request with rate limiting and retry logic
          async makeEnhancedRequest(url, options = {}) {
            if (this.shouldRateLimit()) {
              await this.waitForRateLimit();
            }
            this.recordRequest();
            const startTime = performance.now();
            try {
              const response = await this.executeRequestWithRetry(url, options);
              const responseTime = performance.now() - startTime;
              this.recordSuccess(responseTime);
              return response;
            } catch (error) {
              this.recordFailure(error, url);
              throw error;
            }
          }
          // Execute request with exponential backoff retry logic
          async executeRequestWithRetry(url, options) {
            let lastError = null;
            const maxRetries = this.options.maxRetries;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              try {
                if (attempt > 0) {
                  const delay = this.calculateBackoffDelay(attempt);
                  console.log(`\u{1F504} Retry attempt ${attempt}/${maxRetries} for ${url} after ${delay}ms`);
                  await this.sleep(delay);
                  this.metrics.retriedRequests++;
                }
                const response = await ServiceWorkerFetch.fetch(url, {
                  ...options,
                  method: options.method || "GET"
                });
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                if (this.options.enableContentValidation) {
                  await this.validateResponse(response, url);
                }
                return response;
              } catch (error) {
                lastError = error;
                if (!this.isRetryableError(error) || attempt === maxRetries) {
                  break;
                }
                console.warn(`\u26A0\uFE0F Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
              }
            }
            throw lastError;
          }
          // Calculate exponential backoff delay
          calculateBackoffDelay(attempt) {
            const baseDelay = this.options.baseDelay;
            const backoffMultiplier = this.options.backoffMultiplier;
            const maxDelay = this.options.maxDelay;
            let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
            return Math.min(Math.max(delay, baseDelay), maxDelay);
          }
          // Check if error is retryable
          isRetryableError(error) {
            if (error.name === "TypeError" || error.name === "NetworkError") {
              return true;
            }
            if (error.message.includes("HTTP")) {
              const statusMatch = error.message.match(/HTTP (\d+)/);
              if (statusMatch) {
                const status = parseInt(statusMatch[1]);
                return status >= 500 || status === 429 || status === 408;
              }
            }
            if (error.message.includes("timeout") || error.message.includes("aborted")) {
              return true;
            }
            return false;
          }
          // Rate limiting logic
          shouldRateLimit() {
            const now = Date.now();
            if (now < this.throttledUntil) {
              return true;
            }
            this.requestHistory = this.requestHistory.filter(
              (timestamp) => now - timestamp < 6e4
            );
            const recentRequests = this.requestHistory.filter(
              (timestamp) => now - timestamp < 1e3
            );
            if (recentRequests.length >= this.options.requestsPerSecond) {
              return true;
            }
            const burstWindow = this.requestHistory.filter(
              (timestamp) => now - timestamp < 5e3
            );
            if (burstWindow.length >= this.options.burstLimit) {
              console.log("\u{1F6A6} Rate limit: Burst limit reached, applying throttle");
              this.throttledUntil = now + this.options.cooldownPeriod;
              return true;
            }
            return false;
          }
          // Wait for rate limit to clear
          async waitForRateLimit() {
            const now = Date.now();
            const waitTime = Math.max(
              this.throttledUntil - now,
              1e3 - (now - Math.max(...this.requestHistory.slice(-1), 0))
            );
            if (waitTime > 0) {
              console.log(`\u{1F6A6} Rate limiting: waiting ${waitTime}ms`);
              await this.sleep(waitTime);
            }
          }
          // Record request for rate limiting
          recordRequest() {
            this.requestHistory.push(Date.now());
            this.metrics.totalRequests++;
          }
          // Enhanced duplicate detection using content hashing
          async detectDuplicate(url, content) {
            if (!this.options.enableDuplicateDetection) {
              return false;
            }
            if (this.processedUrls.has(url)) {
              this.metrics.duplicatesSkipped++;
              return true;
            }
            if (content) {
              const hash = await this.calculateContentHash(content);
              if (this.contentHashes.has(hash)) {
                this.metrics.duplicatesSkipped++;
                return true;
              }
              this.contentHashes.add(hash);
            }
            this.processedUrls.add(url);
            return false;
          }
          // Calculate content hash for duplicate detection
          async calculateContentHash(content) {
            if (typeof content === "string") {
              content = new TextEncoder().encode(content);
            }
            if (window.crypto && window.crypto.subtle) {
              try {
                const hashBuffer = await window.crypto.subtle.digest("SHA-256", content);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
              } catch (error) {
                console.warn("\u26A0\uFE0F Crypto hash failed, using fallback");
              }
            }
            let hash = 0;
            const str = content.toString();
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash;
            }
            return hash.toString(16);
          }
          // Validate response content
          async validateResponse(response, url) {
            const contentType = response.headers.get("content-type") || "";
            const contentLength = parseInt(response.headers.get("content-length") || "0");
            if (contentType.startsWith("image/")) {
              const format = contentType.split("/")[1];
              if (!this.options.allowedFormats.includes(format)) {
                throw new Error(`Unsupported image format: ${format}`);
              }
            }
            if (contentLength > 0) {
              if (contentLength < this.options.minImageSize) {
                throw new Error(`Image too small: ${contentLength} bytes`);
              }
              if (contentLength > this.options.maxImageSize) {
                throw new Error(`Image too large: ${contentLength} bytes`);
              }
            }
            return true;
          }
          // Record failure
          recordFailure(error, url) {
            this.metrics.failedRequests++;
            console.error(`\u274C Request failed for ${url}:`, error);
          }
          // Record successful requests
          recordSuccess(responseTime) {
            this.metrics.successfulRequests++;
            const totalSuccessful = this.metrics.successfulRequests;
            this.metrics.averageResponseTime = (this.metrics.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful;
          }
          // Helper methods
          sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
          // Get metrics report
          getMetricsReport() {
            const successRate = this.metrics.totalRequests > 0 ? this.metrics.successfulRequests / this.metrics.totalRequests * 100 : 0;
            return {
              summary: {
                totalRequests: this.metrics.totalRequests,
                successfulRequests: this.metrics.successfulRequests,
                failedRequests: this.metrics.failedRequests,
                successRate,
                averageResponseTime: this.metrics.averageResponseTime,
                duplicatesSkipped: this.metrics.duplicatesSkipped
              }
            };
          }
        }
        window.EnhancedScraperUtils = EnhancedScraperUtils;
        console.log("\u2705 Enhanced scraper utilities loaded");
      }
      if (!window.AdvancedExtractor) {
        class AdvancedExtractor {
          constructor(options = {}) {
            this.options = {
              // Extraction strategies
              useMultipleStrategies: options.useMultipleStrategies !== false,
              enableFallbackExtraction: options.enableFallbackExtraction !== false,
              maxExtractionAttempts: options.maxExtractionAttempts || 5,
              // Target detection
              autoDetectTargets: options.autoDetectTargets !== false,
              smartTargetSelection: options.smartTargetSelection !== false,
              // Content validation
              validateExtractedContent: options.validateExtractedContent !== false,
              minContentThreshold: options.minContentThreshold || 3,
              // Performance settings
              batchSize: options.batchSize || 50,
              extractionTimeout: options.extractionTimeout || 3e4,
              // Image-specific options
              minImageDimensions: options.minImageDimensions || { width: 50, height: 50 },
              supportedFormats: options.supportedFormats || ["jpg", "jpeg", "png", "webp", "gif", "svg"],
              extractImageMetadata: options.extractImageMetadata !== false,
              // Enhanced detection patterns
              imageSelectors: options.imageSelectors || [
                "img[src]",
                "img[data-src]",
                "img[data-lazy-src]",
                "img[data-original]",
                '[style*="background-image"]',
                "picture source",
                "picture img",
                "[data-background-image]"
              ],
              containerSelectors: options.containerSelectors || [
                ".gallery",
                ".images",
                ".photos",
                ".grid",
                ".masonry",
                ".carousel",
                ".slider",
                ".product-images",
                "[data-gallery]",
                "[data-images]",
                "[data-photos]"
              ],
              ...options
            };
            this.isActive = false;
            this.extractedItems = [];
            this.failedExtractions = [];
            this.strategies = /* @__PURE__ */ new Map();
            this.qualityMetrics = {
              totalFound: 0,
              validated: 0,
              filtered: 0,
              duplicates: 0
            };
            this.initializeExtractionStrategies();
          }
          initializeExtractionStrategies() {
            this.strategies.set("direct", this.directImageExtraction.bind(this));
            this.strategies.set("background", this.backgroundImageExtraction.bind(this));
            this.strategies.set("lazy", this.lazyLoadedImageExtraction.bind(this));
            this.strategies.set("semantic", this.semanticImageExtraction.bind(this));
            console.log("\u{1F3AF} Advanced extraction strategies initialized:", Array.from(this.strategies.keys()));
          }
          // Main extraction method
          async extractImages(selector = null, options = {}) {
            const config = { ...this.options, ...options };
            this.isActive = true;
            const startTime = performance.now();
            console.log("\u{1F680} Starting advanced image extraction...");
            try {
              this.extractedItems = [];
              this.failedExtractions = [];
              this.qualityMetrics = { totalFound: 0, validated: 0, filtered: 0, duplicates: 0 };
              const results = await this.executeExtractionStrategies(selector, config);
              const processedResults = await this.processExtractionResults(results, config);
              const endTime = performance.now();
              const duration = endTime - startTime;
              const finalResults = {
                success: true,
                images: processedResults,
                metadata: {
                  totalFound: this.qualityMetrics.totalFound,
                  validated: this.qualityMetrics.validated,
                  filtered: this.qualityMetrics.filtered,
                  duplicates: this.qualityMetrics.duplicates,
                  extractionTime: duration,
                  strategiesUsed: Array.from(this.strategies.keys())
                }
              };
              console.log(`\u2705 Advanced extraction completed in ${duration.toFixed(2)}ms`);
              return finalResults;
            } catch (error) {
              console.error("\u274C Advanced extraction failed:", error);
              return {
                success: false,
                error: error.message,
                images: [],
                metadata: {
                  totalFound: this.qualityMetrics.totalFound,
                  extractionTime: performance.now() - startTime
                }
              };
            } finally {
              this.isActive = false;
            }
          }
          async executeExtractionStrategies(selector, config) {
            const allResults = [];
            const strategies = config.useMultipleStrategies ? Array.from(this.strategies.keys()) : ["direct"];
            for (const strategyName of strategies) {
              const strategy = this.strategies.get(strategyName);
              if (strategy) {
                try {
                  const results = await strategy(selector, config);
                  allResults.push(...results);
                } catch (error) {
                  console.warn(`Strategy ${strategyName} failed:`, error);
                }
              }
            }
            return allResults;
          }
          // Direct image extraction strategy
          async directImageExtraction(selector, config) {
            const images = [];
            const targetSelector = selector || "img[src]";
            try {
              const elements = document.querySelectorAll(targetSelector);
              for (const img of elements) {
                if (img.src && this.isValidImageElement(img, config)) {
                  images.push({
                    url: img.src,
                    element: img,
                    strategy: "direct",
                    metadata: this.extractElementMetadata(img)
                  });
                }
              }
            } catch (error) {
              console.warn("Direct extraction failed:", error);
            }
            return images;
          }
          // Background image extraction strategy
          async backgroundImageExtraction(selector, config) {
            const images = [];
            try {
              const elements = document.querySelectorAll('[style*="background-image"], [data-background]');
              for (const el of elements) {
                const bgUrl = this.extractBackgroundImageUrl(el);
                if (bgUrl && this.isValidImageUrl(bgUrl, config)) {
                  images.push({
                    url: bgUrl,
                    element: el,
                    strategy: "background",
                    metadata: this.extractElementMetadata(el)
                  });
                }
              }
            } catch (error) {
              console.warn("Background extraction failed:", error);
            }
            return images;
          }
          // Lazy loaded image extraction strategy
          async lazyLoadedImageExtraction(selector, config) {
            const images = [];
            try {
              const elements = document.querySelectorAll('img[data-src], img[data-lazy], img[data-original], [loading="lazy"]');
              for (const img of elements) {
                const lazySrc = img.dataset.src || img.dataset.lazy || img.dataset.original;
                if (lazySrc && this.isValidImageUrl(lazySrc, config)) {
                  images.push({
                    url: lazySrc,
                    element: img,
                    strategy: "lazy",
                    metadata: this.extractElementMetadata(img)
                  });
                }
              }
            } catch (error) {
              console.warn("Lazy extraction failed:", error);
            }
            return images;
          }
          // Semantic image extraction strategy
          async semanticImageExtraction(selector, config) {
            const images = [];
            try {
              const semanticSelectors = [
                "figure img",
                "picture img",
                "article img",
                ".gallery img",
                ".photos img",
                ".images img"
              ];
              for (const semanticSelector of semanticSelectors) {
                const elements = document.querySelectorAll(semanticSelector);
                for (const img of elements) {
                  const src = img.src || img.dataset.src;
                  if (src && this.isValidImageElement(img, config)) {
                    images.push({
                      url: src,
                      element: img,
                      strategy: "semantic",
                      metadata: this.extractElementMetadata(img)
                    });
                  }
                }
              }
            } catch (error) {
              console.warn("Semantic extraction failed:", error);
            }
            return images;
          }
          // Process and validate extraction results
          async processExtractionResults(results, config) {
            const processedResults = [];
            const seenUrls = /* @__PURE__ */ new Set();
            for (const result of results) {
              this.qualityMetrics.totalFound++;
              if (seenUrls.has(result.url)) {
                this.qualityMetrics.duplicates++;
                continue;
              }
              seenUrls.add(result.url);
              if (config.validateExtractedContent && !this.validateImageResult(result, config)) {
                this.qualityMetrics.filtered++;
                continue;
              }
              this.qualityMetrics.validated++;
              processedResults.push(result);
            }
            return processedResults;
          }
          // Helper methods
          isValidImageElement(img, config) {
            if (!img || img.tagName !== "IMG") return false;
            const { width, height } = config.minImageDimensions;
            const imgWidth = img.naturalWidth || img.offsetWidth;
            const imgHeight = img.naturalHeight || img.offsetHeight;
            return imgWidth >= width && imgHeight >= height;
          }
          isValidImageUrl(url, config) {
            if (!url) return false;
            const supportedFormats = config.supportedFormats;
            const extension = url.split(".").pop()?.toLowerCase();
            return supportedFormats.includes(extension) || url.startsWith("data:image/");
          }
          extractBackgroundImageUrl(element) {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== "none") {
              const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
              return match ? match[1] : null;
            }
            return element.dataset.background || null;
          }
          extractElementMetadata(element) {
            return {
              alt: element.alt || "",
              title: element.title || "",
              className: element.className || "",
              id: element.id || ""
            };
          }
          validateImageResult(result, config) {
            return result.url && result.url.length > 0;
          }
        }
        window.AdvancedExtractor = AdvancedExtractor;
        console.log("\u2705 Basic DOM extractor loaded (fallback mode)");
      }
      if (!window.runScrape) {
        window.runScrape = async function(selector, options = {}) {
          console.log("\u{1F680} Starting unified scraper with Advanced Collector System...");
          try {
            if (typeof window.AdvancedCollectorSystem === "function") {
              console.log("\u{1F4E1} Using Advanced Collector System with 8 detection methods");
              const collector = new window.AdvancedCollectorSystem({
                // Configure based on options
                concurrency: options.concurrency || 5,
                timeout: options.timeout || 3e4,
                minImageSize: options.minImageSize || 100,
                supportedFormats: options.supportedFormats || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"],
                customExtensions: options.customExtensions || ["pdf"],
                // Enable all 8 detection methods by default
                enablePerformanceAPI: options.enablePerformanceAPI !== false,
                enableShadowDOM: options.enableShadowDOM !== false,
                enableAdvancedBackground: options.enableAdvancedBackground !== false,
                enableSVGProcessing: options.enableSVGProcessing !== false,
                enableLazyLoading: options.enableLazyLoading !== false,
                enableUrlExtraction: options.enableUrlExtraction !== false,
                enableCustomExtensions: options.enableCustomExtensions !== false,
                enableMultiDocument: options.enableMultiDocument === true
              });
              const result = await collector.collectImages(options);
              const formattedResult = {
                success: result.success,
                items: result.images.map((img) => ({
                  url: img.url,
                  src: img.src,
                  type: img.type,
                  confidence: img.confidence,
                  discoveryMethod: img.discoveryMethod,
                  metadata: img.metadata
                })),
                stats: {
                  found: result.metadata?.totalFound || 0,
                  validated: result.metadata?.validated || 0,
                  duplicates: result.metadata?.duplicates || 0,
                  errors: result.metadata?.errors || 0,
                  extractionTime: result.metadata?.processingTime || 0,
                  methodStats: result.metadata?.methodStats || {}
                },
                feeds: result.feeds,
                advanced: true
                // Flag to indicate advanced collection was used
              };
              console.log(`\u2705 Advanced Collector completed: ${formattedResult.items.length} items found`);
              console.log(`\u{1F4CA} Method breakdown:`, result.metadata.methodStats);
              if (typeof chrome !== "undefined" && chrome.runtime) {
                try {
                  chrome.runtime.sendMessage({
                    type: "SCAN_RESULTS",
                    data: formattedResult
                  }).catch((error) => {
                    console.log("Note: Dashboard not connected for result display:", error.message);
                  });
                } catch (error) {
                  console.log("Note: Extension context not available for messaging");
                }
              }
              return formattedResult;
            } else {
              console.warn("\u{1F504} Advanced Collector System not available - using basic DOM extraction");
              if (typeof chrome !== "undefined" && chrome.runtime) {
                try {
                  chrome.runtime.sendMessage({
                    type: "SYSTEM_WARNING",
                    data: {
                      message: "Advanced Collector unavailable - using basic extraction",
                      level: "warning"
                    }
                  }).catch(() => {
                  });
                } catch (error) {
                }
              }
              const extractor = new window.AdvancedExtractor({
                useMultipleStrategies: true,
                validateExtractedContent: true,
                enableFallbackExtraction: true
              });
              const result = await extractor.extractImages(selector, options);
              const formattedResult = {
                success: result.success,
                items: result.images || [],
                stats: {
                  found: result.metadata?.totalFound || 0,
                  validated: result.metadata?.validated || 0,
                  duplicates: result.metadata?.duplicates || 0,
                  errors: result.metadata?.errors || 0,
                  extractionTime: result.metadata?.extractionTime || 0,
                  methodStats: result.metadata?.methodStats || {}
                },
                advanced: false
                // Flag to indicate basic collection was used
              };
              console.log(`\u2705 Basic scraper completed: ${formattedResult.items.length} items found`);
              if (typeof chrome !== "undefined" && chrome.runtime) {
                try {
                  chrome.runtime.sendMessage({
                    type: "SCAN_RESULTS",
                    data: formattedResult
                  }).catch((error) => {
                    console.log("Note: Dashboard not connected for result display:", error.message);
                  });
                } catch (error) {
                  console.log("Note: Extension context not available for messaging");
                }
              }
              return formattedResult;
            }
          } catch (error) {
            console.error("\u274C Scraper failed:", error);
            return {
              success: false,
              items: [],
              error: error.message,
              stats: { found: 0, validated: 0, duplicates: 0, errors: 1, extractionTime: 0, methodStats: {} }
            };
          }
        };
        console.log("\u2705 Main scraper function loaded");
      }
      if (!window.AdaptiveSelectorSystem) {
        class AdaptiveSelectorSystem {
          constructor(options = {}) {
            this.options = {
              // Enhanced fallback strategy configuration
              maxFallbackAttempts: options.maxFallbackAttempts || 3,
              selectorTimeout: options.selectorTimeout || 1500,
              confidenceThreshold: options.confidenceThreshold || 0.8,
              minimalConfidenceThreshold: options.minimalConfidenceThreshold || 0.6,
              // Site-specific patterns
              siteSpecificPatterns: {
                instagram: {
                  imageSelectors: [
                    "article img",
                    '[role="presentation"] img',
                    'img[alt*="Photo by"]',
                    'img[src*="scontent"]'
                  ],
                  containerSelectors: [
                    "article",
                    '[role="presentation"]',
                    "section main"
                  ]
                },
                pinterest: {
                  imageSelectors: [
                    '[data-test-id="pin-image"]',
                    ".GrowthUnauthPinImage img",
                    'img[alt*="Pin"]'
                  ],
                  containerSelectors: [
                    '[data-test-id="pin"]',
                    ".GrowthUnauthPin"
                  ]
                },
                generic: {
                  imageSelectors: [
                    'img[src*="cdn"]',
                    'img[loading="lazy"]',
                    "img[data-src]",
                    "img[data-lazy]",
                    ".gallery img",
                    ".grid img",
                    "article img"
                  ],
                  containerSelectors: [
                    ".gallery",
                    ".grid",
                    ".masonry",
                    ".photos",
                    ".images",
                    ".feed"
                  ]
                }
              },
              ...options
            };
            this.selectorHistory = /* @__PURE__ */ new Map();
            this.performanceMetrics = {
              successful: 0,
              failed: 0,
              fallbacksUsed: 0,
              averageAttempts: 0
            };
            this.initializeSiteDetection();
          }
          // Initialize site detection
          initializeSiteDetection() {
            this.currentSite = this.detectCurrentSite();
            this.sitePatterns = this.getCurrentSitePatterns();
            console.log("\u{1F310} Site detected:", this.currentSite);
          }
          // Detect current site based on URL patterns
          detectCurrentSite() {
            const hostname = window.location.hostname.toLowerCase();
            if (hostname.includes("instagram")) return "instagram";
            if (hostname.includes("pinterest")) return "pinterest";
            if (hostname.includes("twitter") || hostname.includes("x.com")) return "twitter";
            if (hostname.includes("facebook")) return "facebook";
            return "generic";
          }
          // Get patterns for current site
          getCurrentSitePatterns() {
            const sitePatterns = this.options.siteSpecificPatterns[this.currentSite];
            if (sitePatterns) {
              return sitePatterns;
            }
            return this.options.siteSpecificPatterns.generic;
          }
          // Enhanced method to find gallery images using site-specific patterns
          async findGalleryImages(options = {}) {
            const startTime = performance.now();
            const maxImages = options.maxImages || 1e3;
            const minSize = options.minSize || 100;
            console.log(`\u{1F5BC}\uFE0F Finding gallery images for site: ${this.currentSite}`);
            try {
              let allImages = [];
              if (this.sitePatterns && this.sitePatterns.imageSelectors) {
                for (const selector of this.sitePatterns.imageSelectors) {
                  try {
                    const images = this.testSelector(selector);
                    allImages.push(...images);
                  } catch (error) {
                    console.warn(`\u26A0\uFE0F Site-specific selector failed: ${selector}`, error);
                  }
                }
              }
              if (allImages.length === 0) {
                console.log("\u{1F504} No site-specific images found, using generic approach...");
                allImages = this.findGenericGalleryImages();
              }
              const validImages = await this.validateGalleryImages(allImages, { minSize, maxImages });
              const processingTime = performance.now() - startTime;
              console.log(`\u2705 Found ${validImages.length} valid gallery images in ${processingTime.toFixed(2)}ms`);
              return {
                images: validImages,
                site: this.currentSite,
                patterns: this.sitePatterns,
                processingTime,
                totalFound: allImages.length,
                validCount: validImages.length
              };
            } catch (error) {
              console.error("\u274C Error finding gallery images:", error);
              return {
                images: [],
                site: this.currentSite,
                error: error.message,
                processingTime: performance.now() - startTime
              };
            }
          }
          // Find images using generic patterns when site-specific ones fail
          findGenericGalleryImages() {
            const selectors = [
              'img[src*="cdn"]',
              'img[loading="lazy"]',
              "img[data-src]",
              "img[data-lazy]",
              ".gallery img",
              ".grid img",
              ".masonry img",
              ".photos img",
              ".images img",
              ".feed img",
              ".posts img",
              "article img",
              "section img"
            ];
            let allImages = [];
            for (const selector of selectors) {
              try {
                const images = this.testSelector(selector);
                allImages.push(...images);
              } catch (error) {
                console.warn(`\u26A0\uFE0F Generic selector failed: ${selector}`);
              }
            }
            return Array.from(new Set(allImages));
          }
          // Test a CSS selector and return matching elements
          testSelector(selector) {
            try {
              return Array.from(document.querySelectorAll(selector));
            } catch (error) {
              console.warn(`Invalid selector: ${selector}`, error);
              return [];
            }
          }
          // Validate gallery images based on size and other criteria
          async validateGalleryImages(images, options = {}) {
            const { minSize = 100, maxImages = 1e3 } = options;
            const validImages = [];
            for (let i = 0; i < Math.min(images.length, maxImages); i++) {
              const img = images[i];
              if (this.isValidGalleryImage(img, minSize)) {
                validImages.push({
                  element: img,
                  src: this.getImageSrc(img),
                  alt: img.alt || "",
                  width: img.naturalWidth || img.offsetWidth,
                  height: img.naturalHeight || img.offsetHeight,
                  lazy: this.isLazyLoadedImage(img),
                  inViewport: this.isInViewport(img)
                });
              }
            }
            return validImages;
          }
          // Check if image meets gallery criteria
          isValidGalleryImage(img, minSize) {
            if (!img || !img.tagName || img.tagName.toLowerCase() !== "img") {
              return false;
            }
            const width = img.naturalWidth || img.offsetWidth;
            const height = img.naturalHeight || img.offsetHeight;
            if (width < minSize || height < minSize) {
              return false;
            }
            const src = this.getImageSrc(img);
            if (!src || src.startsWith("data:image/svg") || src.includes("loading") || src.includes("placeholder")) {
              return false;
            }
            const excludePatterns = [
              /avatar/i,
              /profile/i,
              /icon/i,
              /logo/i,
              /button/i,
              /arrow/i,
              /spinner/i,
              /loading/i
            ];
            const alt = img.alt || "";
            const className = img.className || "";
            if (excludePatterns.some((pattern) => pattern.test(alt) || pattern.test(className) || pattern.test(src))) {
              return false;
            }
            return true;
          }
          // Get image source, handling lazy loading
          getImageSrc(img) {
            return img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy") || img.getAttribute("data-original") || "";
          }
          // Check if image is lazy-loaded
          isLazyLoadedImage(img) {
            return !!(img.getAttribute("data-src") || img.getAttribute("data-lazy") || img.getAttribute("loading") === "lazy" || img.classList.contains("lazy") || img.classList.contains("lazyload"));
          }
          // Check if element is in viewport
          isInViewport(element) {
            if (!element.getBoundingClientRect) return false;
            const rect = element.getBoundingClientRect();
            return rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth);
          }
          // Score element for selection
          scoreElement(element) {
            let score = 0;
            const factors = [];
            const rect = element.getBoundingClientRect();
            if (rect.width > 200 && rect.height > 200) {
              score += 0.3;
              factors.push("large_size");
            }
            const className = element.className?.toLowerCase() || "";
            const highValueClasses = ["gallery", "photo", "image", "picture"];
            if (highValueClasses.some((cls) => className.includes(cls))) {
              score += 0.4;
              factors.push("semantic_class");
            }
            if (element.hasAttribute("data-src") || element.hasAttribute("data-lazy")) {
              score += 0.2;
              factors.push("lazy_loading");
            }
            return { score, factors };
          }
          // Detect gallery containers
          detectGalleryContainers() {
            const containers = [];
            if (this.sitePatterns && this.sitePatterns.containerSelectors) {
              for (const selector of this.sitePatterns.containerSelectors) {
                try {
                  const elements = this.testSelector(selector);
                  containers.push(...elements);
                } catch (error) {
                  console.warn(`\u26A0\uFE0F Container selector failed: ${selector}`);
                }
              }
            }
            if (containers.length === 0) {
              const genericSelectors = [
                ".gallery",
                ".grid",
                ".masonry",
                ".photos",
                ".images",
                ".feed",
                ".posts",
                '[role="main"]',
                "main",
                "section"
              ];
              for (const selector of genericSelectors) {
                try {
                  const elements = this.testSelector(selector);
                  containers.push(...elements);
                } catch (error) {
                  console.warn(`\u26A0\uFE0F Generic container selector failed: ${selector}`);
                }
              }
            }
            return Array.from(new Set(containers));
          }
        }
        window.AdaptiveSelectorSystem = AdaptiveSelectorSystem;
        console.log("\u2705 Adaptive selector system loaded");
      }
      if (!window.StepThreeElementPicker) {
        class StepThreeElementPicker {
          constructor() {
            this.isActive = false;
            this.highlightedElement = null;
            this.overlay = null;
            this.handlers = {
              mouseover: this.handleMouseOver.bind(this),
              click: this.handleClick.bind(this),
              mousedown: this.handleInteractionBlock.bind(this),
              mouseup: this.handleInteractionBlock.bind(this),
              pointerdown: this.handleInteractionBlock.bind(this),
              pointerup: this.handleInteractionBlock.bind(this),
              touchstart: this.handleInteractionBlock.bind(this),
              touchend: this.handleInteractionBlock.bind(this),
              keydown: this.handleKeyDown.bind(this)
            };
          }
          async startPicking() {
            if (this.isActive) {
              console.warn("Element picker already active");
              return false;
            }
            this.isActive = true;
            this.createOverlay();
            this.attachEventListeners();
            console.log("\u2705 Element picker started - click any element to select");
            return true;
          }
          stop() {
            if (!this.isActive) {
              return false;
            }
            this.isActive = false;
            this.removeOverlay();
            this.detachEventListeners();
            this.clearHighlight();
            console.log("\u{1F6D1} Element picker stopped");
            return true;
          }
          createOverlay() {
            this.overlay = document.createElement("div");
            this.overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
        z-index: 999999;
        pointer-events: auto;
        cursor: crosshair;
      `;
            document.body.appendChild(this.overlay);
          }
          removeOverlay() {
            if (this.overlay && this.overlay.parentNode) {
              this.overlay.parentNode.removeChild(this.overlay);
              this.overlay = null;
            }
          }
          attachEventListeners() {
            document.addEventListener("mouseover", this.handlers.mouseover, true);
            document.addEventListener("click", this.handlers.click, true);
            document.addEventListener("mousedown", this.handlers.mousedown, true);
            document.addEventListener("mouseup", this.handlers.mouseup, true);
            document.addEventListener("pointerdown", this.handlers.pointerdown, true);
            document.addEventListener("pointerup", this.handlers.pointerup, true);
            document.addEventListener("touchstart", this.handlers.touchstart, true);
            document.addEventListener("touchend", this.handlers.touchend, true);
            document.addEventListener("keydown", this.handlers.keydown, true);
            if (this.overlay) {
              const block = (e) => {
                if (!this.isActive) return;
                e.preventDefault();
                e.stopPropagation();
                typeof e.stopImmediatePropagation === "function" && e.stopImmediatePropagation();
              };
              this._overlayBlockHandlers = {
                mousedown: block,
                mouseup: block,
                click: block,
                pointerdown: block,
                pointerup: block,
                contextmenu: block,
                wheel: block
              };
              Object.entries(this._overlayBlockHandlers).forEach(([type, handler]) => {
                this.overlay.addEventListener(type, handler);
              });
            }
          }
          detachEventListeners() {
            document.removeEventListener("mouseover", this.handlers.mouseover, true);
            document.removeEventListener("click", this.handlers.click, true);
            document.removeEventListener("mousedown", this.handlers.mousedown, true);
            document.removeEventListener("mouseup", this.handlers.mouseup, true);
            document.removeEventListener("pointerdown", this.handlers.pointerdown, true);
            document.removeEventListener("pointerup", this.handlers.pointerup, true);
            document.removeEventListener("touchstart", this.handlers.touchstart, true);
            document.removeEventListener("touchend", this.handlers.touchend, true);
            document.removeEventListener("keydown", this.handlers.keydown, true);
            if (this.overlay && this._overlayBlockHandlers) {
              Object.entries(this._overlayBlockHandlers).forEach(([type, handler]) => {
                this.overlay.removeEventListener(type, handler);
              });
              this._overlayBlockHandlers = null;
            }
          }
          handleMouseOver(event) {
            if (!this.isActive) return;
            event.preventDefault();
            event.stopPropagation();
            typeof event.stopImmediatePropagation === "function" && event.stopImmediatePropagation();
            const element = this.getUnderlyingElementAtPoint(event.clientX, event.clientY);
            this.highlightElement(element);
          }
          handleInteractionBlock(event) {
            if (!this.isActive) return;
            event.preventDefault();
            event.stopPropagation();
            typeof event.stopImmediatePropagation === "function" && event.stopImmediatePropagation();
            return false;
          }
          handleClick(event) {
            if (!this.isActive) return;
            event.preventDefault();
            event.stopPropagation();
            typeof event.stopImmediatePropagation === "function" && event.stopImmediatePropagation();
            const element = this.getUnderlyingElementAtPoint(event.clientX, event.clientY) || event.target;
            const selector = this.generateSelector(element);
            console.log("\u{1F3AF} Element selected:", { element, selector });
            if (typeof chrome !== "undefined" && chrome.runtime) {
              chrome.runtime.sendMessage({
                action: "element_selected",
                selector,
                element: {
                  tagName: element.tagName,
                  className: element.className,
                  id: element.id,
                  textContent: element.textContent?.substring(0, 100)
                }
              }).catch((error) => {
                console.debug("Could not send element selection to background:", error.message);
              });
            }
            this.stop();
            return false;
          }
          handleKeyDown(event) {
            if (!this.isActive) return;
            if (event.key === "Escape") {
              event.preventDefault();
              this.stop();
            }
          }
          getUnderlyingElementAtPoint(x, y) {
            try {
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
              if (!this.overlay) return document.elementFromPoint(x, y);
              const prev = this.overlay.style.pointerEvents;
              this.overlay.style.pointerEvents = "none";
              const el = document.elementFromPoint(x, y);
              this.overlay.style.pointerEvents = prev || "auto";
              return el;
            } catch {
              return null;
            }
          }
          highlightElement(element) {
            this.clearHighlight();
            if (element && element !== document.body && element !== document.documentElement) {
              element.style.outline = "2px solid #ff6b6b";
              element.style.backgroundColor = "rgba(255, 107, 107, 0.1)";
              this.highlightedElement = element;
            }
          }
          clearHighlight() {
            if (this.highlightedElement) {
              this.highlightedElement.style.outline = "";
              this.highlightedElement.style.backgroundColor = "";
              this.highlightedElement = null;
            }
          }
          generateSelector(element) {
            // Check if element is inside Shadow DOM
            if (this.isInShadowDOM(element)) {
              const shadowSelector = this.generateShadowDOMSelector(element);
              if (shadowSelector) {
                console.log('✅ Generated Shadow DOM selector:', shadowSelector);
                return shadowSelector;
              }
            }
            
            // Try to use EnhancedCSSSelector for robust selector generation
            if (window.EnhancedCSSSelector) {
              try {
                const enhancedSelector = new window.EnhancedCSSSelector({
                  enableDataAttributePreference: true,
                  enableCrossSiteOptimization: true,
                  maxSelectorLength: 500
                });
                const stableSelector = enhancedSelector.generateStableSelector(element);
                if (stableSelector && stableSelector.length > 0 && stableSelector.length < 500) {
                  console.log('✅ Using enhanced stable selector:', stableSelector);
                  return stableSelector;
                }
              } catch (error) {
                console.warn('⚠️ Enhanced selector generation failed, using fallback:', error);
              }
            }
            
            // Fallback: Try stable attributes first
            // 1. ID (most stable)
            if (element.id && /^[a-z]/i.test(element.id)) {
              return `#${element.id}`;
            }
            
            // 2. Data attributes (very stable - used for testing)
            const dataAttrs = ['data-testid', 'data-test', 'data-automation', 'data-cy', 'data-selenium'];
            for (const attr of dataAttrs) {
              const value = element.getAttribute(attr);
              if (value) {
                return `[${attr}="${value}"]`;
              }
            }
            
            // 3. ARIA labels (stable and semantic)
            const ariaLabel = element.getAttribute('aria-label');
            if (ariaLabel) {
              return `[aria-label="${ariaLabel}"]`;
            }
            
            // 4. Role attributes
            const role = element.getAttribute('role');
            if (role) {
              const roleSelector = `[role="${role}"]`;
              // Make it more specific if multiple elements have same role
              if (element.className) {
                const classes = element.className.split(" ")
                  .filter(c => c.trim() && !/^[a-z]{1,3}-[a-z0-9]{3,10}$/i.test(c)); // Exclude hashed classes
                if (classes.length > 0) {
                  return roleSelector + '.' + classes[0];
                }
              }
              return roleSelector;
            }
            
            // 5. Semantic classes (avoid framework hashes)
            let selector = element.tagName.toLowerCase();
            if (element.className) {
              const classes = element.className.split(" ")
                .filter(c => {
                  const trimmed = c.trim();
                  // Exclude common framework-generated patterns:
                  // - Angular: _ngcontent, ng-
                  // - React: css-*, makeStyles-*
                  // - Vue: v-*, data-v-*
                  // - Short hashes: x-abc, g-123
                  return trimmed && 
                    !/^(_ngcontent|ng-|css-|makeStyles-|v-|data-v-)/.test(trimmed) &&
                    !/^[a-z]{1,3}-[a-z0-9]{3,10}$/i.test(trimmed) &&
                    trimmed.length > 2;
                });
              
              if (classes.length > 0) {
                selector += "." + classes.join(".");
              }
            }
            
            // 6. XPath by text content (as recommended by report Section 3.2B)
            // This is very stable for pagination elements with text like "Next", "Previous"
            const textContent = element.textContent?.trim();
            if (textContent && textContent.length > 0 && textContent.length < 30) {
              // Check if this is a pagination-related element
              const isPagination = /^(next|previous|prev|more|load more|\d+|›|»|‹|«|→|←)$/i.test(textContent);
              if (isPagination) {
                const tag = element.tagName.toLowerCase();
                // Generate XPath: //button[contains(., 'Next')]
                const xpathSelector = `//${tag}[contains(., '${textContent}')]`;
                console.log('✅ Generated XPath selector for pagination:', xpathSelector);
                return `xpath:${xpathSelector}`; // Prefix to indicate XPath
              }
            }
            
            // 7. Add nth-of-type if selector is too generic
            if (selector === element.tagName.toLowerCase() || selector === 'a' || selector === 'button' || selector === 'div') {
              const parent = element.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
                const index = siblings.indexOf(element) + 1;
                if (siblings.length > 1) {
                  selector += `:nth-of-type(${index})`;
                }
              }
            }
            
            return selector;
          }
          
          isInShadowDOM(element) {
            // Check if element is inside a Shadow DOM
            let current = element;
            while (current) {
              if (current.getRootNode && current.getRootNode() instanceof ShadowRoot) {
                return true;
              }
              current = current.parentElement;
            }
            return false;
          }
          
          generateShadowDOMSelector(element) {
            // Generate selector that traverses Shadow DOM
            // Format: "host-selector::shadow::inner-selector"
            try {
              const root = element.getRootNode();
              if (!(root instanceof ShadowRoot)) {
                return null;
              }
              
              // Find the shadow host
              const host = root.host;
              if (!host) {
                return null;
              }
              
              // Generate selector for the host element
              let hostSelector = '';
              if (host.id) {
                hostSelector = `#${host.id}`;
              } else if (host.className && typeof host.className === 'string') {
                const classes = host.className.split(' ').filter(c => c.trim())[0];
                hostSelector = host.tagName.toLowerCase() + (classes ? '.' + classes : '');
              } else {
                hostSelector = host.tagName.toLowerCase();
              }
              
              // Generate selector for element within shadow root
              let innerSelector = '';
              if (element.id) {
                innerSelector = `#${element.id}`;
              } else if (element.getAttribute('data-testid')) {
                innerSelector = `[data-testid="${element.getAttribute('data-testid')}"]`;
              } else if (element.className && typeof element.className === 'string') {
                const classes = element.className.split(' ').filter(c => c.trim());
                innerSelector = element.tagName.toLowerCase() + (classes.length ? '.' + classes.join('.') : '');
              } else {
                innerSelector = element.tagName.toLowerCase();
              }
              
              // Return special notation indicating Shadow DOM traversal
              return `${hostSelector}::shadow::${innerSelector}`;
            } catch (error) {
              console.warn('Shadow DOM selector generation failed:', error);
              return null;
            }
          }
        }
        window.StepThreeElementPicker = StepThreeElementPicker;
        console.log("\u2705 Element picker loaded");
      }
      async function initializeEnhancedSelector() {
        return new Promise((resolve) => {
          try {
            if (!window.EnhancedSmartSelectorSystem) {
              class EnhancedSmartSelectorSystem {
                constructor(options = {}) {
                  this.options = {
                    // Core selection options
                    maxFallbackAttempts: options.maxFallbackAttempts || 3,
                    selectorTimeout: options.selectorTimeout || 2e3,
                    confidenceThreshold: options.confidenceThreshold || 0.75,
                    earlyExitThreshold: options.earlyExitThreshold || 0.9,
                    // Auto-expand settings
                    autoExpandAfterSamples: options.autoExpandAfterSamples || 3,
                    autoExpandMinConfidence: options.autoExpandMinConfidence || 0.9,
                    maxAutoExpandElements: options.maxAutoExpandElements || 1e3,
                    // Similarity clustering weights
                    similarityWeights: {
                      tagName: 0.2,
                      className: 0.25,
                      attributes: 0.2,
                      cssPath: 0.15,
                      siblings: 0.1,
                      urlPattern: 0.1
                    },
                    // URL pattern mining
                    urlPatternMining: {
                      enabled: options.enableUrlPatternMining !== false,
                      numericPattern: /(\d+)/g,
                      sequenceThreshold: 3,
                      // Min sequence length to consider pattern
                      confidenceBoost: 0.15
                      // Boost for URL pattern matches
                    },
                    confidenceWeights: {
                      dataAttributes: 0.95,
                      reactPatterns: 0.92,
                      semanticClasses: 0.88,
                      structuralPatterns: 0.85,
                      genericSelectors: 0.6
                    },
                    enableProgressiveAnalysis: options.enableProgressiveAnalysis !== false,
                    enableEarlyExit: options.enableEarlyExit !== false,
                    maxAnalysisTime: options.maxAnalysisTime || 5e3,
                    // Core site-specific patterns for major platforms
                    siteSpecificPatterns: {
                      instagram: {
                        domain: ["instagram.com", "www.instagram.com"],
                        confidence: 0.95,
                        imageSelectors: [
                          "._aagu img",
                          "._aagv img",
                          'article img[src*="scontent"]',
                          '[role="presentation"] img[src*="scontent"]',
                          'img[alt*="Photo by"]',
                          'div[class*="x1n2onr6"] img',
                          'div[class*="x1lliihq"] img',
                          'section[role="main"] img:not([alt*="avatar"])',
                          'div[data-visualcompletion="media-vc-image"] img'
                        ]
                      },
                      twitter: {
                        domain: ["twitter.com", "x.com"],
                        confidence: 0.9,
                        imageSelectors: [
                          '[data-testid="tweetPhoto"] img',
                          '[data-testid="media"] img',
                          'img[src*="pbs.twimg.com"]',
                          '[role="group"] img[src*="pbs.twimg"]',
                          'div[data-testid="tweet"] img:not([src*="profile_images"])'
                        ]
                      },
                      pinterest: {
                        domain: ["pinterest.com", "www.pinterest.com"],
                        confidence: 0.93,
                        imageSelectors: [
                          '[data-test-id="pin-image"] img',
                          ".GrowthUnauthPinImage img",
                          'img[src*="pinimg"]',
                          'div[class*="gridCentered"] img'
                        ]
                      },
                      generic: {
                        confidence: 0.6,
                        imageSelectors: [
                          'img[src]:not([src*="icon"]):not([src*="avatar"]):not([width="16"]):not([height="16"])',
                          'img[data-src]:not([data-src*="icon"])',
                          ".gallery img",
                          ".images img",
                          'article img:not([width="16"]):not([height="16"])',
                          "figure img"
                        ]
                      }
                    },
                    ...options
                  };
                  this.currentSite = this.detectCurrentSite();
                  this.sitePatterns = this.getCurrentSitePatterns();
                  this.selectedElements = [];
                  this.selectedSamples = [];
                  this.autoExpandedElements = [];
                  this.urlPatterns = /* @__PURE__ */ new Map();
                  this.similarityCache = /* @__PURE__ */ new Map();
                  this.isActive = false;
                  this.ready = true;
                  this.selectionCounter = 0;
                  this.progressiveMode = "sampling";
                  this.patternAnalysis = null;
                  this.lastAnalysisTime = 0;
                  console.log(`\u{1F9E0} Enhanced Smart Selector initialized for site: ${this.currentSite}`);
                }
                detectCurrentSite() {
                  const hostname = window.location.hostname.toLowerCase();
                  if (hostname.includes("instagram")) return "instagram";
                  if (hostname.includes("twitter") || hostname.includes("x.com")) return "twitter";
                  if (hostname.includes("pinterest")) return "pinterest";
                  return "generic";
                }
                getCurrentSitePatterns() {
                  return this.options.siteSpecificPatterns[this.currentSite] || this.options.siteSpecificPatterns.generic;
                }
                async findGalleryImages(options = {}) {
                  const startTime = performance.now();
                  try {
                    const selectors = this.sitePatterns.imageSelectors || [];
                    const allImages = [];
                    for (const selector of selectors) {
                      try {
                        const elements = document.querySelectorAll(selector);
                        allImages.push(...Array.from(elements));
                      } catch (error) {
                        console.warn(`Selector failed: ${selector}`, error);
                      }
                    }
                    const uniqueImages = Array.from(new Set(allImages));
                    const validImages = uniqueImages.filter((img) => {
                      if (!img.src && !img.dataset.src) return false;
                      const rect = img.getBoundingClientRect();
                      return rect.width > (options.minSize || 100) && rect.height > (options.minSize || 100);
                    });
                    const processingTime = performance.now() - startTime;
                    return {
                      images: validImages.slice(0, options.maxImages || 1e3),
                      site: this.currentSite,
                      totalFound: allImages.length,
                      validCount: validImages.length,
                      processingTime,
                      enhanced: true
                    };
                  } catch (error) {
                    console.error("Enhanced selector error:", error);
                    return { images: [], error: error.message, enhanced: false };
                  }
                }
                // Alias for compatibility
                findImages(options = {}) {
                  return this.findGalleryImages(options);
                }
                startInteractiveSelection() {
                  if (this.isActive) return false;
                  this.isActive = true;
                  this.setupEventListeners();
                  document.body.style.cursor = "crosshair";
                  console.log("\u{1F3AF} Enhanced interactive selection started");
                  return true;
                }
                setupEventListeners() {
                  this.mouseOverHandler = this.handleMouseOver.bind(this);
                  this.clickHandler = this.handleClick.bind(this);
                  document.addEventListener("mouseover", this.mouseOverHandler);
                  document.addEventListener("click", this.clickHandler);
                }
                stopSelection() {
                  if (!this.isActive) return false;
                  this.isActive = false;
                  if (this.mouseOverHandler) {
                    document.removeEventListener("mouseover", this.mouseOverHandler);
                  }
                  if (this.clickHandler) {
                    document.removeEventListener("click", this.clickHandler);
                  }
                  document.body.style.cursor = "";
                  document.querySelectorAll(".st-enhanced-highlight").forEach((el) => {
                    el.classList.remove("st-enhanced-highlight");
                  });
                  console.log("\u{1F6D1} Enhanced interactive selection stopped");
                  return true;
                }
                handleMouseOver(event) {
                  if (!this.isActive) return;
                  document.querySelectorAll(".st-enhanced-highlight").forEach((el) => {
                    el.classList.remove("st-enhanced-highlight");
                  });
                  event.target.classList.add("st-enhanced-highlight");
                }
                handleClick(event) {
                  if (!this.isActive) return;
                  event.preventDefault();
                  event.stopPropagation();
                  this.selectionCounter++;
                  const element = event.target;
                  this.selectedSamples.push({
                    element,
                    selector: this.generateStableSelector(element),
                    attributes: this.extractElementAttributes(element),
                    cssPath: this.generateCSSPath(element),
                    urlPattern: this.extractUrlPattern(element),
                    timestamp: Date.now(),
                    index: this.selectionCounter
                  });
                  this.addSelectionIndicator(element, this.selectionCounter);
                  console.log(`\u{1F3AF} Enhanced element selected (${this.selectionCounter}):`, element);
                  if (this.selectionCounter >= this.options.autoExpandAfterSamples) {
                    this.progressiveMode = "analyzing";
                    this.analyzePatternAndAutoExpand();
                  } else {
                    this.progressiveMode = "sampling";
                    this.updateSelectionStatus(`Select ${this.options.autoExpandAfterSamples - this.selectionCounter} more samples to auto-detect similar elements`);
                  }
                  window.dispatchEvent(new CustomEvent("st-element-selected", {
                    detail: {
                      element,
                      selector: this.generateStableSelector(element),
                      selectionCount: this.selectionCounter,
                      mode: this.progressiveMode,
                      samples: this.selectedSamples.length,
                      autoExpanded: this.autoExpandedElements.length
                    }
                  }));
                }
                // =============================================================================
                // SIMILARITY CLUSTERING ALGORITHM
                // =============================================================================
                /**
                 * Analyze patterns from selected samples and auto-expand selection
                 */
                async analyzePatternAndAutoExpand() {
                  console.log("\u{1F9E0} Analyzing patterns from selected samples...");
                  if (this.selectedSamples.length < this.options.autoExpandAfterSamples) {
                    return;
                  }
                  const startTime = performance.now();
                  this.patternAnalysis = await this.performSimilarityAnalysis();
                  if (this.patternAnalysis.confidence >= this.options.autoExpandMinConfidence) {
                    await this.autoExpandSelection();
                    this.progressiveMode = "expanding";
                  } else {
                    this.progressiveMode = "sampling";
                    this.updateSelectionStatus(`Pattern confidence too low (${Math.round(this.patternAnalysis.confidence * 100)}%), need more samples`);
                  }
                  this.lastAnalysisTime = performance.now() - startTime;
                  console.log(`\u{1F3AF} Pattern analysis completed in ${this.lastAnalysisTime.toFixed(2)}ms`);
                }
                /**
                 * Perform similarity analysis on selected samples
                 */
                async performSimilarityAnalysis() {
                  const analysis = {
                    confidence: 0,
                    patterns: {
                      tagName: {},
                      className: {},
                      attributes: {},
                      cssPath: {},
                      urlPattern: {},
                      siblings: {}
                    },
                    selectedSelector: "",
                    similarElements: [],
                    breakdown: {}
                  };
                  for (const sample of this.selectedSamples) {
                    const tagName = sample.element.tagName.toLowerCase();
                    analysis.patterns.tagName[tagName] = (analysis.patterns.tagName[tagName] || 0) + 1;
                    if (sample.element.className) {
                      const classes = sample.element.className.split(" ").filter((c) => c.trim());
                      classes.forEach((cls) => {
                        analysis.patterns.className[cls] = (analysis.patterns.className[cls] || 0) + 1;
                      });
                    }
                    for (const attr of sample.element.attributes) {
                      if (attr.name !== "class" && attr.name !== "id") {
                        const key = `${attr.name}=${attr.value}`;
                        analysis.patterns.attributes[key] = (analysis.patterns.attributes[key] || 0) + 1;
                      }
                    }
                    if (sample.urlPattern) {
                      analysis.patterns.urlPattern[sample.urlPattern] = (analysis.patterns.urlPattern[sample.urlPattern] || 0) + 1;
                    }
                    const siblingsInfo = this.analyzeSiblings(sample.element);
                    const siblingKey = `${siblingsInfo.total}_${siblingsInfo.position}`;
                    analysis.patterns.siblings[siblingKey] = (analysis.patterns.siblings[siblingKey] || 0) + 1;
                  }
                  const sampleCount = this.selectedSamples.length;
                  const weights = this.options.similarityWeights;
                  let totalConfidence = 0;
                  const mostCommonTag = this.getMostCommonPattern(analysis.patterns.tagName);
                  if (mostCommonTag.count === sampleCount) {
                    totalConfidence += weights.tagName;
                    analysis.breakdown.tagName = { confidence: 1, pattern: mostCommonTag.pattern };
                  }
                  const mostCommonClass = this.getMostCommonPattern(analysis.patterns.className);
                  if (mostCommonClass.count >= Math.ceil(sampleCount * 0.7)) {
                    const classConfidence = mostCommonClass.count / sampleCount;
                    totalConfidence += weights.className * classConfidence;
                    analysis.breakdown.className = { confidence: classConfidence, pattern: mostCommonClass.pattern };
                  }
                  const mostCommonAttr = this.getMostCommonPattern(analysis.patterns.attributes);
                  if (mostCommonAttr.count >= Math.ceil(sampleCount * 0.6)) {
                    const attrConfidence = mostCommonAttr.count / sampleCount;
                    totalConfidence += weights.attributes * attrConfidence;
                    analysis.breakdown.attributes = { confidence: attrConfidence, pattern: mostCommonAttr.pattern };
                  }
                  if (this.options.urlPatternMining.enabled) {
                    const urlConfidence = this.calculateUrlPatternConfidence(analysis.patterns.urlPattern, sampleCount);
                    totalConfidence += weights.urlPattern * urlConfidence;
                    analysis.breakdown.urlPattern = { confidence: urlConfidence };
                  }
                  analysis.confidence = Math.min(totalConfidence, 1);
                  analysis.selectedSelector = this.generatePatternSelector(analysis);
                  return analysis;
                }
                /**
                 * Auto-expand selection based on pattern analysis
                 */
                async autoExpandSelection() {
                  if (!this.patternAnalysis || !this.patternAnalysis.selectedSelector) {
                    return;
                  }
                  console.log(`\u{1F680} Auto-expanding selection with selector: ${this.patternAnalysis.selectedSelector}`);
                  try {
                    const candidateElements = document.querySelectorAll(this.patternAnalysis.selectedSelector);
                    const filteredElements = [];
                    for (const candidate of candidateElements) {
                      if (this.selectedSamples.some((sample) => sample.element === candidate)) {
                        continue;
                      }
                      const similarity = this.calculateElementSimilarity(candidate, this.selectedSamples);
                      if (similarity >= this.options.autoExpandMinConfidence) {
                        filteredElements.push({
                          element: candidate,
                          similarity,
                          selector: this.generateStableSelector(candidate)
                        });
                      }
                      if (filteredElements.length >= this.options.maxAutoExpandElements) {
                        break;
                      }
                    }
                    this.autoExpandedElements = filteredElements;
                    filteredElements.forEach((item, index) => {
                      this.addAutoExpandIndicator(item.element, index + 1);
                    });
                    const totalSelected = this.selectedSamples.length + this.autoExpandedElements.length;
                    this.updateSelectionStatus(`Auto-expanded: found ${this.autoExpandedElements.length} similar elements (${totalSelected} total)`);
                    console.log(`\u2705 Auto-expansion completed: ${this.autoExpandedElements.length} elements added`);
                    window.dispatchEvent(new CustomEvent("st-auto-expanded", {
                      detail: {
                        expandedCount: this.autoExpandedElements.length,
                        totalCount: totalSelected,
                        confidence: this.patternAnalysis.confidence,
                        selector: this.patternAnalysis.selectedSelector
                      }
                    }));
                  } catch (error) {
                    console.error("\u274C Auto-expansion failed:", error);
                    this.updateSelectionStatus("Auto-expansion failed, continue manual selection");
                  }
                }
                // =============================================================================
                // URL PATTERN MINING
                // =============================================================================
                /**
                 * Extract URL pattern from element (for images and links)
                 */
                extractUrlPattern(element) {
                  const urls = [];
                  if (element.src) urls.push(element.src);
                  if (element.href) urls.push(element.href);
                  if (element.dataset.src) urls.push(element.dataset.src);
                  if (element.dataset.original) urls.push(element.dataset.original);
                  for (const url of urls) {
                    const pattern = this.detectNumericSequence(url);
                    if (pattern) {
                      return pattern;
                    }
                  }
                  return null;
                }
                /**
                 * Detect numeric sequences in URLs for gallery pattern recognition
                 */
                detectNumericSequence(url) {
                  if (!this.options.urlPatternMining.enabled) {
                    return null;
                  }
                  try {
                    const numbers = [...url.matchAll(this.options.urlPatternMining.numericPattern)];
                    if (numbers.length === 0) {
                      return null;
                    }
                    const lastNumber = numbers[numbers.length - 1];
                    const numberValue = parseInt(lastNumber[1]);
                    if (!isNaN(numberValue) && numberValue > 0) {
                      const pattern = url.replace(lastNumber[1], "{n}");
                      return {
                        pattern,
                        position: lastNumber.index,
                        value: numberValue,
                        url
                      };
                    }
                  } catch (error) {
                    console.warn("URL pattern detection failed:", error);
                  }
                  return null;
                }
                /**
                 * Calculate confidence for URL patterns
                 */
                calculateUrlPatternConfidence(urlPatterns, sampleCount) {
                  if (Object.keys(urlPatterns).length === 0) {
                    return 0;
                  }
                  const mostCommon = this.getMostCommonPattern(urlPatterns);
                  const confidence = mostCommon.count / sampleCount;
                  if (mostCommon.pattern && mostCommon.pattern.includes("{n}")) {
                    return Math.min(confidence + this.options.urlPatternMining.confidenceBoost, 1);
                  }
                  return confidence;
                }
                generateSelector(element) {
                  if (element.id) {
                    return `#${element.id}`;
                  }
                  let selector = element.tagName.toLowerCase();
                  if (element.className) {
                    const classes = element.className.split(" ").filter((c) => c.trim() && !c.includes("st-enhanced"));
                    if (classes.length > 0) {
                      selector += "." + classes[0];
                    }
                  }
                  return selector;
                }
                // =============================================================================
                // HELPER METHODS FOR SMART PATTERN RECOGNITION
                // =============================================================================
                /**
                 * Generate stable CSS selector for element
                 */
                generateStableSelector(element) {
                  if (element.id && element.id.trim()) {
                    return `#${element.id}`;
                  }
                  const stableAttributes = ["data-testid", "data-cy", "data-test", "role", "aria-label"];
                  for (const attr of stableAttributes) {
                    const value = element.getAttribute(attr);
                    if (value && value.trim()) {
                      return `[${attr}="${value}"]`;
                    }
                  }
                  if (element.className) {
                    const classes = element.className.split(" ").filter((cls) => cls.trim() && !cls.match(/^(st-|temp-|auto-|gen-|css-)/)).filter((cls) => cls.length > 2);
                    if (classes.length > 0) {
                      return element.tagName.toLowerCase() + "." + classes[0];
                    }
                  }
                  return this.generateCSSPath(element);
                }
                /**
                 * Generate CSS path to element
                 */
                generateCSSPath(element) {
                  const path = [];
                  let current = element;
                  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
                    let selector = current.tagName.toLowerCase();
                    if (current.id) {
                      selector += `#${current.id}`;
                      path.unshift(selector);
                      break;
                    }
                    const siblings = Array.from(current.parentNode?.children || []).filter((sibling) => sibling.tagName === current.tagName);
                    if (siblings.length > 1) {
                      const index = siblings.indexOf(current) + 1;
                      selector += `:nth-child(${index})`;
                    }
                    path.unshift(selector);
                    current = current.parentNode;
                  }
                  return path.join(" > ");
                }
                /**
                 * Extract element attributes for analysis
                 */
                extractElementAttributes(element) {
                  const attributes = {};
                  for (const attr of element.attributes) {
                    attributes[attr.name] = attr.value;
                  }
                  return attributes;
                }
                /**
                 * Analyze element siblings for pattern recognition
                 */
                analyzeSiblings(element) {
                  const parent = element.parentNode;
                  if (!parent) {
                    return { total: 0, position: 0, similarSiblings: 0 };
                  }
                  const siblings = Array.from(parent.children);
                  const position = siblings.indexOf(element);
                  const similarSiblings = siblings.filter(
                    (sibling) => sibling.tagName === element.tagName && sibling.className === element.className
                  ).length;
                  return {
                    total: siblings.length,
                    position,
                    similarSiblings
                  };
                }
                /**
                 * Calculate similarity between element and selected samples
                 */
                calculateElementSimilarity(element, samples) {
                  if (samples.length === 0) return 0;
                  let totalSimilarity = 0;
                  const weights = this.options.similarityWeights;
                  for (const sample of samples) {
                    let similarity = 0;
                    if (element.tagName === sample.element.tagName) {
                      similarity += weights.tagName;
                    }
                    const elementClasses = new Set(element.className.split(" ").filter((c) => c.trim()));
                    const sampleClasses = new Set(sample.element.className.split(" ").filter((c) => c.trim()));
                    const classIntersection = new Set([...elementClasses].filter((x) => sampleClasses.has(x)));
                    const classUnion = /* @__PURE__ */ new Set([...elementClasses, ...sampleClasses]);
                    if (classUnion.size > 0) {
                      const classJaccard = classIntersection.size / classUnion.size;
                      similarity += weights.className * classJaccard;
                    }
                    const elementAttrs = this.extractElementAttributes(element);
                    const sampleAttrs = sample.attributes;
                    const attrSimilarity = this.calculateAttributeSimilarity(elementAttrs, sampleAttrs);
                    similarity += weights.attributes * attrSimilarity;
                    const elementPath = this.generateCSSPath(element);
                    const samplePath = sample.cssPath;
                    const pathSimilarity = this.calculatePathSimilarity(elementPath, samplePath);
                    similarity += weights.cssPath * pathSimilarity;
                    const elementSiblings = this.analyzeSiblings(element);
                    const sampleSiblings = this.analyzeSiblings(sample.element);
                    const siblingSimilarity = this.calculateSiblingSimilarity(elementSiblings, sampleSiblings);
                    similarity += weights.siblings * siblingSimilarity;
                    if (this.options.urlPatternMining.enabled) {
                      const elementUrlPattern = this.extractUrlPattern(element);
                      const urlSimilarity = this.calculateUrlSimilarity(elementUrlPattern, sample.urlPattern);
                      similarity += weights.urlPattern * urlSimilarity;
                    }
                    totalSimilarity += similarity;
                  }
                  return totalSimilarity / samples.length;
                }
                /**
                 * Calculate attribute similarity using Jaccard index
                 */
                calculateAttributeSimilarity(attrs1, attrs2) {
                  const keys1 = new Set(Object.keys(attrs1));
                  const keys2 = new Set(Object.keys(attrs2));
                  const intersection = new Set([...keys1].filter((x) => keys2.has(x)));
                  const union = /* @__PURE__ */ new Set([...keys1, ...keys2]);
                  if (union.size === 0) return 1;
                  return intersection.size / union.size;
                }
                /**
                 * Calculate path similarity using edit distance
                 */
                calculatePathSimilarity(path1, path2) {
                  const parts1 = path1.split(" > ");
                  const parts2 = path2.split(" > ");
                  const common = parts1.filter((part) => parts2.includes(part)).length;
                  const total = Math.max(parts1.length, parts2.length);
                  return total > 0 ? common / total : 0;
                }
                /**
                 * Calculate sibling similarity
                 */
                calculateSiblingSimilarity(siblings1, siblings2) {
                  const totalDiff = Math.abs(siblings1.total - siblings2.total);
                  const positionDiff = Math.abs(siblings1.position - siblings2.position);
                  const similarDiff = Math.abs(siblings1.similarSiblings - siblings2.similarSiblings);
                  const totalSim = totalDiff <= 2 ? 1 : Math.max(0, 1 - totalDiff / 10);
                  const positionSim = positionDiff <= 2 ? 1 : Math.max(0, 1 - positionDiff / 5);
                  const similarSim = similarDiff === 0 ? 1 : Math.max(0, 1 - similarDiff / 3);
                  return (totalSim + positionSim + similarSim) / 3;
                }
                /**
                 * Calculate URL similarity
                 */
                calculateUrlSimilarity(pattern1, pattern2) {
                  if (!pattern1 || !pattern2) return 0;
                  if (pattern1.pattern === pattern2.pattern) {
                    return 1;
                  }
                  const base1 = pattern1.pattern.replace("{n}", "");
                  const base2 = pattern2.pattern.replace("{n}", "");
                  return base1 === base2 ? 0.8 : 0;
                }
                /**
                 * Get most common pattern from analysis
                 */
                getMostCommonPattern(patterns) {
                  let maxCount = 0;
                  let mostCommon = null;
                  for (const [pattern, count] of Object.entries(patterns)) {
                    if (count > maxCount) {
                      maxCount = count;
                      mostCommon = pattern;
                    }
                  }
                  return { pattern: mostCommon, count: maxCount };
                }
                /**
                 * Generate selector based on pattern analysis
                 */
                generatePatternSelector(analysis) {
                  const selectors = [];
                  const tagPattern = analysis.breakdown.tagName;
                  if (tagPattern && tagPattern.confidence > 0.8) {
                    selectors.push(tagPattern.pattern);
                  }
                  const classPattern = analysis.breakdown.className;
                  if (classPattern && classPattern.confidence > 0.7) {
                    selectors.push(`${tagPattern?.pattern || ""}.${classPattern.pattern}`);
                  }
                  const attrPattern = analysis.breakdown.attributes;
                  if (attrPattern && attrPattern.confidence > 0.6) {
                    selectors.push(`[${attrPattern.pattern}]`);
                  }
                  return selectors.length > 0 ? selectors[selectors.length - 1] : "img";
                }
                // =============================================================================
                // VISUAL FEEDBACK SYSTEM
                // =============================================================================
                /**
                 * Add visual indicator for selected elements
                 */
                addSelectionIndicator(element, index) {
                  const existingBadge = element.querySelector(".st-selection-badge");
                  if (existingBadge) {
                    existingBadge.remove();
                  }
                  element.classList.add("st-selected-element");
                  const badge = document.createElement("div");
                  badge.className = "st-selection-badge";
                  badge.textContent = index.toString();
                  badge.style.cssText = `
              position: absolute;
              top: -10px;
              left: -10px;
              background: #4CAF50;
              color: white;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              z-index: 10000;
              pointer-events: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
                  element.style.position = "relative";
                  element.appendChild(badge);
                }
                /**
                 * Add visual indicator for auto-expanded elements
                 */
                addAutoExpandIndicator(element, index) {
                  element.classList.add("st-auto-expanded-element");
                  const badge = document.createElement("div");
                  badge.className = "st-auto-expand-badge";
                  badge.textContent = "+";
                  badge.style.cssText = `
              position: absolute;
              top: -8px;
              right: -8px;
              background: #2196F3;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              font-weight: bold;
              z-index: 10000;
              pointer-events: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
                  element.style.position = "relative";
                  element.appendChild(badge);
                }
                /**
                 * Update selection status message
                 */
                updateSelectionStatus(message) {
                  window.dispatchEvent(new CustomEvent("st-selection-status", {
                    detail: {
                      message,
                      mode: this.progressiveMode,
                      samples: this.selectedSamples.length,
                      autoExpanded: this.autoExpandedElements.length
                    }
                  }));
                  console.log(`\u{1F4E2} Selection Status: ${message}`);
                }
              }
              window.EnhancedSmartSelectorSystem = EnhancedSmartSelectorSystem;
              if (!document.querySelector("#st-enhanced-styles")) {
                const style = document.createElement("style");
                style.id = "st-enhanced-styles";
                style.textContent = `
            .st-enhanced-highlight {
              outline: 2px solid #00ff88 !important;
              background-color: rgba(0, 255, 136, 0.1) !important;
              transition: all 0.1s ease !important;
            }
          `;
                document.head.appendChild(style);
              }
            }
            const ExtensionState = {
              selector: null,
              picker: null,
              observer: null,
              initialized: false,
              config: {
                autoInitialize: true
              }
            };
            ExtensionState.selector = new window.EnhancedSmartSelectorSystem({
              confidenceThreshold: 0.75,
              earlyExitThreshold: 0.9,
              maxFallbackAttempts: 3,
              enableProgressiveAnalysis: true,
              enableEarlyExit: true
            });
            console.log("\u2705 Enhanced Smart Selector System bundled and initialized successfully");
            resolve(true);
          } catch (error) {
            console.error("\u274C Enhanced selector initialization failed:", error);
            if (window.AdaptiveSelectorSystem) {
              ExtensionState.selector = new window.AdaptiveSelectorSystem({
                confidenceThreshold: 0.8,
                maxFallbackAttempts: 3
              });
              console.log("\u26A0\uFE0F Using fallback AdaptiveSelectorSystem");
            }
            resolve(false);
          }
        });
      }
      if (!window.StepThreeContentBundleInitialized) {
        let handleExtensionMessage = function(message, sender, sendResponse) {
          console.log("\u{1F4E8} Received message:", message);
          try {
            switch (message.action) {
              case "ping":
                sendResponse({ status: "ok", initialized: ExtensionState2.initialized });
                break;
              case "initialize":
                initializeExtension().then((success) => {
                  sendResponse({ success, initialized: ExtensionState2.initialized });
                }).catch((error) => {
                  sendResponse({ success: false, error: error.message });
                });
                break;
              case "scrape_images":
                handleScrapeImages2(message, sendResponse);
                break;
              case "find_gallery":
                handleFindGallery2(message, sendResponse);
                break;
              case "start_element_picker":
                handleStartElementPicker2(message, sendResponse);
                return true;
              case "stop_element_picker":
                handleStopElementPicker2(message, sendResponse);
                break;
              case "start_smart_selector":
                handleStartSmartSelector2(message, sendResponse);
                break;
              case "stop_smart_selector":
                handleStopSmartSelector2(message, sendResponse);
                break;
              case "smart_find_images":
                handleSmartFindImages2(message, sendResponse);
                break;
              case "start_interactive_selection":
                handleStartInteractiveSelection2(message, sendResponse);
                break;
              case "start_observer":
                handleStartObserver(message, sendResponse);
                break;
              case "stop_observer":
                handleStopObserver(message, sendResponse);
                break;
              case "get_status":
                sendResponse(getExtensionStatus());
                break;
              case "get_metrics":
                sendResponse(getExtensionMetrics());
                break;
              default:
                console.warn("\u26A0\uFE0F Unknown message action:", message.action);
                sendResponse({ error: `Unknown action: ${message.action}` });
            }
          } catch (error) {
            console.error("\u274C Message handler error:", error);
            sendResponse({ error: error.message });
          }
          return true;
        }, handleStartElementPicker2 = async function(message, sendResponse) {
          try {
            if (!ExtensionState2.initialized) {
              console.log("\u{1F504} Extension not initialized yet, initializing now...");
              await initializeExtension();
            }
            if (!ExtensionState2.picker) {
              throw new Error("Element picker not initialized");
            }
            const success = ExtensionState2.picker.startPicking();
            sendResponse({ success });
          } catch (error) {
            console.error("\u274C Start element picker error:", error);
            sendResponse({ success: false, error: error.message });
          }
        }, handleStopElementPicker2 = function(message, sendResponse) {
          try {
            if (!ExtensionState2.picker) {
              throw new Error("Element picker not initialized");
            }
            const success = ExtensionState2.picker.stop();
            sendResponse({ success });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        }, handleStartObserver = function(message, sendResponse) {
          try {
            if (!ExtensionState2.observer) {
              throw new Error("Observer not initialized");
            }
            const callback = (data) => {
              if (typeof chrome !== "undefined" && chrome.runtime) {
                chrome.runtime.sendMessage({
                  action: "content_changed",
                  data
                }).catch((error) => {
                  console.debug("Could not send content change to background:", error.message);
                });
              }
            };
            const success = ExtensionState2.observer.start(callback);
            sendResponse({ success });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        }, handleStopObserver = function(message, sendResponse) {
          try {
            if (!ExtensionState2.observer) {
              throw new Error("Observer not initialized");
            }
            const success = ExtensionState2.observer.stop();
            sendResponse({ success });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        }, getExtensionStatus = function() {
          return {
            initialized: ExtensionState2.initialized,
            lastActivity: ExtensionState2.lastActivity,
            observerActive: ExtensionState2.observer?.isActive || false,
            pickerActive: ExtensionState2.picker?.isActive || false,
            config: ExtensionState2.config,
            url: window.location.href,
            timestamp: Date.now()
          };
        }, getExtensionMetrics = function() {
          const metrics = {
            scraper: ExtensionState2.scraper?.getMetricsReport() || {},
            observer: ExtensionState2.observer?.getMetrics() || {},
            timestamp: Date.now()
          };
          return metrics;
        };
        window.StepThreeContentBundleInitialized = true;
        const ExtensionState2 = {
          initialized: false,
          observer: null,
          picker: null,
          scraper: null,
          lastActivity: Date.now(),
          config: {
            enableDebug: window.StepThreeConfig?.DEBUG_MODE || false,
            enableMetrics: true,
            autoInitialize: true
          }
        };
        async function initializeExtension() {
          if (ExtensionState2.initialized) {
            console.warn("\u26A0\uFE0F Extension already initialized");
            return false;
          }
          try {
            console.log("\u{1F680} Initializing STEPTHREE Gallery Scraper...");
            if (typeof ServiceWorkerFetch !== "undefined") {
              window.ServiceWorkerFetch = ServiceWorkerFetch;
            }
            ExtensionState2.scraper = new window.EnhancedScraperUtils({
              enableMetrics: ExtensionState2.config.enableMetrics,
              requestsPerSecond: 2,
              maxRetries: 3,
              enableDuplicateDetection: true
            });
            ExtensionState2.observer = new window.DynamicContentObserver({
              detectImages: true,
              detectGalleries: true,
              significantChangeThreshold: 0.3,
              throttleDelay: 500
            });
            ExtensionState2.selectorReady = initializeEnhancedSelector();
            await ExtensionState2.selectorReady;
            ExtensionState2.picker = new window.StepThreeElementPicker();
            ExtensionState2.initialized = true;
            ExtensionState2.lastActivity = Date.now();
            console.log("\u2705 Extension initialized successfully!");
            return true;
          } catch (error) {
            console.error("\u274C Extension initialization failed:", error);
            return false;
          }
        }
        async function handleScrapeImages2(message, sendResponse) {
          try {
            const options = message.options || {};
            const selector = message.selector || null;
            const result = await window.runScrape(selector, options);
            sendResponse(result);
          } catch (error) {
            sendResponse({ success: false, error: error.message, items: [] });
          }
        }
        async function handleFindGallery2(message, sendResponse) {
          try {
            if (!ExtensionState2.selector) {
              throw new Error("Selector system not initialized");
            }
            const result = await ExtensionState2.selector.findGalleryImages(message.options || {});
            sendResponse({ success: true, ...result });
          } catch (error) {
            sendResponse({ success: false, error: error.message, images: [] });
          }
        }
        async function handleStartSmartSelector2(message, sendResponse) {
          try {
            await ExtensionState2.selectorReady;
            if (!ExtensionState2.selector) {
              throw new Error("Smart selector system not initialized");
            }
            if (ExtensionState2.selector.startInteractiveSelection) {
              const result = ExtensionState2.selector.startInteractiveSelection();
              sendResponse({ success: true, result, enhanced: true });
            } else {
              const result = ExtensionState2.picker?.startPicking();
              sendResponse({ success: !!result, fallback: true, enhanced: false });
            }
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        }
        async function handleStopSmartSelector2(message, sendResponse) {
          try {
            if (ExtensionState2.selector && ExtensionState2.selector.stopSelection) {
              ExtensionState2.selector.stopSelection();
            }
            if (ExtensionState2.picker) {
              ExtensionState2.picker.stop();
            }
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        }
        async function handleSmartFindImages2(message, sendResponse) {
          try {
            await ExtensionState2.selectorReady;
            if (!ExtensionState2.selector) {
              throw new Error("Smart selector system not initialized");
            }
            let result;
            if (ExtensionState2.selector.findImages) {
              result = await ExtensionState2.selector.findImages(message.options || {});
            } else {
              result = await ExtensionState2.selector.findGalleryImages(message.options || {});
            }
            sendResponse({ success: true, enhanced: !!ExtensionState2.selector.findImages, ...result });
          } catch (error) {
            sendResponse({ success: false, error: error.message, images: [] });
          }
        }
        async function handleStartInteractiveSelection2(message, sendResponse) {
          try {
            await ExtensionState2.selectorReady;
            if (!ExtensionState2.selector) {
              throw new Error("Selector system not initialized");
            }
            if (ExtensionState2.selector.startInteractiveSelection) {
              ExtensionState2.selector.startInteractiveSelection();
              sendResponse({ success: true, enhanced: true });
            } else {
              const result = ExtensionState2.picker?.startPicking();
              sendResponse({ success: !!result, enhanced: false });
            }
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        }
        async function handleTriggerAutoExpand2(message, sendResponse) {
          try {
            console.log("\u{1F680} Triggering Smart Selector auto-expand:", message);
            if (!ExtensionState2.selector) {
              throw new Error("Smart selector system not initialized");
            }
            const candidates = message.candidates || [];
            const options = message.options || {};
            if (ExtensionState2.selector.autoExpandSelection) {
              const result = await ExtensionState2.selector.autoExpandSelection(candidates, options);
              sendResponse({
                success: true,
                expandedElements: result.expandedElements || [],
                totalExpanded: result.totalExpanded || 0,
                confidence: result.confidence,
                processingTime: result.processingTime
              });
            } else {
              console.warn("Auto-expand not available, using fallback");
              sendResponse({
                success: false,
                error: "Auto-expand functionality not available",
                fallback: true
              });
            }
          } catch (error) {
            console.error("\u274C Auto-expand failed:", error);
            sendResponse({ success: false, error: error.message });
          }
        }
        async function handleRemoveLastSample2(message, sendResponse) {
          try {
            console.log("\u{1F5D1}\uFE0F Removing last Smart Selector sample");
            if (!ExtensionState2.selector) {
              throw new Error("Smart selector system not initialized");
            }
            if (ExtensionState2.selector.removeLastSample) {
              const result = ExtensionState2.selector.removeLastSample();
              sendResponse({
                success: true,
                remainingSamples: result.remainingSamples || 0,
                updatedStats: result.stats || {},
                message: "Last sample removed successfully"
              });
            } else if (ExtensionState2.selector.selectedSamples) {
              const samples = ExtensionState2.selector.selectedSamples;
              if (samples.length > 0) {
                samples.pop();
                sendResponse({
                  success: true,
                  remainingSamples: samples.length,
                  message: "Last sample removed"
                });
              } else {
                sendResponse({ success: false, error: "No samples to remove" });
              }
            } else {
              throw new Error("Sample management not available in current selector");
            }
          } catch (error) {
            console.error("\u274C Remove last sample failed:", error);
            sendResponse({ success: false, error: error.message });
          }
        }
        async function handleClearSmartSelection2(message, sendResponse) {
          try {
            console.log("\u{1F9F9} Clearing all Smart Selector data");
            if (!ExtensionState2.selector) {
              throw new Error("Smart selector system not initialized");
            }
            let clearedCount = 0;
            let resetStats = {};
            if (ExtensionState2.selector.clearSelection) {
              const result = ExtensionState2.selector.clearSelection();
              clearedCount = result.clearedCount || 0;
              resetStats = result.stats || {};
            } else if (ExtensionState2.selector.selectedSamples) {
              clearedCount = ExtensionState2.selector.selectedSamples.length;
              ExtensionState2.selector.selectedSamples = [];
              if (ExtensionState2.selector.confidenceStats) {
                ExtensionState2.selector.confidenceStats = { high: 0, medium: 0, low: 0 };
              }
              if (ExtensionState2.selector.patternData) {
                ExtensionState2.selector.patternData = {};
              }
            }
            sendResponse({
              success: true,
              clearedCount,
              resetStats,
              message: `Cleared ${clearedCount} selections and reset Smart Selector state`
            });
          } catch (error) {
            console.error("\u274C Clear smart selection failed:", error);
            sendResponse({ success: false, error: error.message });
          }
        }
        async function handleSmartSelectorUpdate2(message, sendResponse) {
          try {
            console.log("\u{1F504} Processing Smart Selector update:", message);
            const updateData = {
              timestamp: Date.now(),
              selectionCount: message.selectionCount || 0,
              confidenceStats: message.confidenceStats || {},
              patternData: message.patternData || {},
              ...message.updateData
            };
            if (ExtensionState2.selector && ExtensionState2.selector.updateProgress) {
              ExtensionState2.selector.updateProgress(updateData);
            }
            if (message.forwardToDashboard) {
              try {
                chrome.runtime.sendMessage({
                  action: "smart_selector_progress_update",
                  data: updateData,
                  source: "content"
                });
              } catch (error) {
                console.warn("Could not forward update to dashboard:", error);
              }
            }
            sendResponse({
              success: true,
              message: "Update processed",
              updateData
            });
          } catch (error) {
            console.error("\u274C Smart selector update failed:", error);
            sendResponse({ success: false, error: error.message });
          }
        }
        async function handlePatternAnalysisComplete2(message, sendResponse) {
          try {
            console.log("\u{1F9E0} Processing pattern analysis completion:", message);
            const analysisData = {
              timestamp: Date.now(),
              patterns: message.patterns || [],
              confidenceScores: message.confidenceScores || {},
              urlPatterns: message.urlPatterns || [],
              autoExpandCandidates: message.autoExpandCandidates || [],
              totalElements: message.totalElements || 0,
              highConfidenceCount: message.highConfidenceCount || 0,
              processingTime: message.processingTime || 0,
              ...message.analysisData
            };
            if (message.enableAutoExpand && analysisData.autoExpandCandidates.length > 0) {
              console.log("\u{1F680} Triggering auto-expand based on pattern analysis");
              if (ExtensionState2.selector && ExtensionState2.selector.autoExpandSelection) {
                try {
                  const autoExpandResult = await ExtensionState2.selector.autoExpandSelection(
                    analysisData.autoExpandCandidates,
                    message.autoExpandOptions || {}
                  );
                  analysisData.autoExpandResults = autoExpandResult;
                } catch (error) {
                  console.warn("Auto-expand failed:", error);
                  analysisData.autoExpandError = error.message;
                }
              } else {
                analysisData.autoExpandError = "Auto-expand not available";
              }
            }
            sendResponse({
              success: true,
              message: "Pattern analysis complete",
              analysisData
            });
          } catch (error) {
            console.error("\u274C Pattern analysis completion failed:", error);
            sendResponse({ success: false, error: error.message });
          }
        }
        class ContentOrchestrator {
          constructor(options = {}) {
            this.options = {
              // Frame gating settings
              enableFrameGating: options.enableFrameGating !== false,
              topFrameOnly: options.topFrameOnly !== false,
              // Default to top-level only
              allowedIframeHosts: options.allowedIframeHosts || [],
              maxIframeDepth: options.maxIframeDepth || 2,
              // Deduplication settings
              enableDeduplication: options.enableDeduplication !== false,
              cacheTimeout: options.cacheTimeout || 3e5,
              // 5 minutes
              maxCacheSize: options.maxCacheSize || 1e4,
              // Throttling settings
              enableThrottling: options.enableThrottling !== false,
              maxConcurrentDetectors: options.maxConcurrentDetectors || 3,
              detectorTimeout: options.detectorTimeout || 3e4,
              // 30 seconds
              minDetectorInterval: options.minDetectorInterval || 1e3,
              // 1 second between detectors
              cpuUsageThreshold: options.cpuUsageThreshold || 80,
              // Max 80% CPU usage
              // Coordination settings
              enableDetectorSequencing: options.enableDetectorSequencing !== false,
              enableMetricsTracking: options.enableMetricsTracking !== false,
              ...options
            };
            this.currentFrameInfo = this.analyzeCurrentFrame();
            this.shouldScanFrame = this.determineScanEligibility();
            const global = typeof globalThis !== "undefined" ? globalThis : window;
            const LRUCache = global.__ST?.LRUCache || Map;
            const BoundedArray = global.__ST?.BoundedArray || Array;
            this.documentCache = new LRUCache(Math.min(this.options.maxCacheSize || 1e3, 2e3));
            this.globalCache = new LRUCache(Math.min(this.options.maxCacheSize || 1e3, 2e3));
            this.seenItems = new LRUCache(5e3);
            this.activeDetectors = new LRUCache(50);
            this.detectorQueue = BoundedArray === Array ? [] : new BoundedArray(100);
            this.lastDetectorExecution = 0;
            this.cpuMonitor = new CPUMonitor();
            this.registeredDetectors = new LRUCache(100);
            this.detectorMetrics = new LRUCache(200);
            this.executionHistory = BoundedArray === Array ? [] : new BoundedArray(500);
            this.metrics = {
              framesScanned: 0,
              detectorsExecuted: 0,
              itemsDeduped: 0,
              throttledRequests: 0,
              averageDetectorTime: 0,
              totalProcessingTime: 0
            };
            this.initialized = false;
            this.documentId = this.generateDocumentId();
            console.log(`\u{1F39B}\uFE0F Content Orchestrator initialized for ${this.currentFrameInfo.type} frame (scan: ${this.shouldScanFrame})`);
            this.setupGlobalInstance();
          }
          /**
           * Analyze current frame context
           */
          analyzeCurrentFrame() {
            const isTopFrame = window === window.top;
            const isIframe = !isTopFrame;
            let frameDepth = 0;
            let currentWin = window;
            while (currentWin !== window.top && frameDepth < 10) {
              frameDepth++;
              try {
                currentWin = currentWin.parent;
              } catch (e) {
                break;
              }
            }
            return {
              isTopFrame,
              isIframe,
              frameDepth,
              origin: window.location.origin,
              hostname: window.location.hostname,
              pathname: window.location.pathname,
              type: isTopFrame ? "top" : `iframe-depth-${frameDepth}`,
              crossOrigin: this.isCrossOriginFrame()
            };
          }
          /**
           * Check if current frame is cross-origin
           */
          isCrossOriginFrame() {
            try {
              return window.location.hostname !== window.top.location.hostname;
            } catch (e) {
              return true;
            }
          }
          /**
           * Determine if this frame should be scanned
           */
          determineScanEligibility() {
            if (!this.options.enableFrameGating) {
              return true;
            }
            if (this.currentFrameInfo.isTopFrame) {
              return true;
            }
            if (this.options.topFrameOnly) {
              console.log(`\u23ED\uFE0F Skipping iframe scan (topFrameOnly mode): ${this.currentFrameInfo.hostname}`);
              return false;
            }
            if (this.currentFrameInfo.frameDepth > this.options.maxIframeDepth) {
              console.log(`\u23ED\uFE0F Skipping iframe scan (depth ${this.currentFrameInfo.frameDepth} > ${this.options.maxIframeDepth})`);
              return false;
            }
            if (this.options.allowedIframeHosts.length > 0) {
              const isAllowed = this.options.allowedIframeHosts.some(
                (host) => this.currentFrameInfo.hostname.includes(host)
              );
              if (!isAllowed) {
                console.log(`\u23ED\uFE0F Skipping iframe scan (host not in allowlist): ${this.currentFrameInfo.hostname}`);
                return false;
              }
            }
            return true;
          }
          /**
           * Generate unique document identifier for caching
           */
          generateDocumentId() {
            const url = window.location.href;
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 11);
            return `${btoa(url).substring(0, 20)}_${timestamp}_${random}`;
          }
          /**
           * Register a detector with the orchestrator
           */
          registerDetector(name, detectorInstance, options = {}) {
            if (!this.shouldScanFrame) {
              console.log(`\u23ED\uFE0F Detector registration skipped (frame not eligible): ${name}`);
              return false;
            }
            const detectorConfig = {
              name,
              instance: detectorInstance,
              priority: options.priority || 5,
              // Lower number = higher priority
              timeout: options.timeout || this.options.detectorTimeout,
              maxRetries: options.maxRetries || 2,
              dependencies: options.dependencies || [],
              registered: Date.now(),
              ...options
            };
            this.registeredDetectors.set(name, detectorConfig);
            console.log(`\u2705 Detector registered: ${name} (priority: ${detectorConfig.priority})`);
            return true;
          }
          /**
           * Execute detectors in sequence with throttling
           */
          async executeDetectors(context = {}) {
            if (!this.shouldScanFrame) {
              console.log("\u23ED\uFE0F Detector execution skipped (frame not eligible)");
              return { success: false, reason: "frame_not_eligible", results: [] };
            }
            console.log(`\u{1F680} Starting detector execution (${this.registeredDetectors.size} detectors)`);
            const startTime = performance.now();
            try {
              const sortedDetectors = Array.from(this.registeredDetectors.values()).sort((a, b) => a.priority - b.priority);
              const results = [];
              let successCount = 0;
              let errorCount = 0;
              for (const detector of sortedDetectors) {
                if (this.options.enableThrottling && !await this.canExecuteDetector(detector)) {
                  console.log(`\u23F8\uFE0F Detector throttled: ${detector.name}`);
                  this.metrics.throttledRequests++;
                  continue;
                }
                try {
                  const detectorResult = await this.executeDetector(detector, context);
                  if (detectorResult.success) {
                    results.push(detectorResult);
                    successCount++;
                  } else {
                    errorCount++;
                  }
                } catch (error) {
                  console.error(`\u274C Detector execution failed: ${detector.name}`, error);
                  errorCount++;
                }
                if (this.options.minDetectorInterval > 0) {
                  await this.sleep(this.options.minDetectorInterval);
                }
              }
              const totalTime = performance.now() - startTime;
              this.metrics.totalProcessingTime += totalTime;
              this.metrics.detectorsExecuted += successCount;
              console.log(`\u2705 Detector execution completed: ${successCount} success, ${errorCount} errors (${totalTime.toFixed(2)}ms)`);
              return {
                success: true,
                results,
                metrics: {
                  totalDetectors: sortedDetectors.length,
                  successCount,
                  errorCount,
                  totalTime,
                  frameInfo: this.currentFrameInfo
                }
              };
            } catch (error) {
              console.error("\u274C Detector execution pipeline failed:", error);
              return { success: false, error: error.message, results: [] };
            }
          }
          /**
           * Execute a single detector with error handling and metrics
           */
          async executeDetector(detector, context) {
            const startTime = performance.now();
            try {
              console.log(`\u{1F50D} Executing detector: ${detector.name}`);
              this.activeDetectors.set(detector.name, { startTime, status: "running" });
              const timeoutPromise = new Promise(
                (_, reject) => setTimeout(() => reject(new Error("Detector timeout")), detector.timeout)
              );
              const detectorPromise = this.invokeDetector(detector, context);
              const result = await Promise.race([detectorPromise, timeoutPromise]);
              const dedupedResult = this.options.enableDeduplication ? this.deduplicateResults(result, detector.name) : result;
              const executionTime = performance.now() - startTime;
              this.updateDetectorMetrics(detector.name, {
                executionTime,
                itemsFound: dedupedResult?.items?.length || 0,
                success: true
              });
              console.log(`\u2705 Detector completed: ${detector.name} (${executionTime.toFixed(2)}ms, ${dedupedResult?.items?.length || 0} items)`);
              return {
                success: true,
                detector: detector.name,
                result: dedupedResult,
                executionTime,
                frameInfo: this.currentFrameInfo
              };
            } catch (error) {
              const executionTime = performance.now() - startTime;
              this.updateDetectorMetrics(detector.name, {
                executionTime,
                error: error.message,
                success: false
              });
              console.error(`\u274C Detector failed: ${detector.name} (${executionTime.toFixed(2)}ms)`, error);
              return {
                success: false,
                detector: detector.name,
                error: error.message,
                executionTime
              };
            } finally {
              this.activeDetectors.delete(detector.name);
              this.lastDetectorExecution = Date.now();
            }
          }
          /**
           * Invoke detector method with proper context
           */
          async invokeDetector(detector, context) {
            const { instance } = detector;
            const methodNames = [
              "collectImages",
              "detectImages",
              "scanImages",
              "findImages",
              "execute",
              "run"
            ];
            for (const methodName of methodNames) {
              if (typeof instance[methodName] === "function") {
                return await instance[methodName](context);
              }
            }
            if (typeof instance === "function") {
              return await instance(context);
            }
            throw new Error(`No executable method found on detector: ${detector.name}`);
          }
          /**
           * Deduplicate results using cache system
           */
          deduplicateResults(result, detectorName) {
            if (!result || !result.items || !Array.isArray(result.items)) {
              return result;
            }
            const dedupedItems = [];
            let duplicateCount = 0;
            for (const item of result.items) {
              const itemKey = this.generateItemKey(item);
              if (!this.isItemDuplicate(itemKey)) {
                dedupedItems.push(item);
                this.markItemAsSeen(itemKey, detectorName);
              } else {
                duplicateCount++;
              }
            }
            if (duplicateCount > 0) {
              console.log(`\u{1F504} Deduplication: ${duplicateCount} duplicates removed from ${detectorName}`);
              this.metrics.itemsDeduped += duplicateCount;
            }
            return {
              ...result,
              items: dedupedItems,
              deduplication: {
                originalCount: result.items.length,
                dedupedCount: dedupedItems.length,
                duplicatesRemoved: duplicateCount
              }
            };
          }
          /**
           * Generate cache key for an item
           */
          generateItemKey(item) {
            const url = item.url || item.src || item.href;
            if (url) {
              return `url:${this.normalizeUrl(url)}`;
            }
            if (item.element) {
              const selector = this.getElementSelector(item.element);
              return `element:${selector}`;
            }
            return `hash:${this.hashObject(item)}`;
          }
          /**
           * Check if item is duplicate
           */
          isItemDuplicate(itemKey) {
            return this.seenItems.has(itemKey) || this.documentCache.has(itemKey) || this.globalCache.has(itemKey);
          }
          /**
           * Mark item as seen
           */
          markItemAsSeen(itemKey, detectorName) {
            const timestamp = Date.now();
            this.seenItems.add(itemKey);
            this.documentCache.set(itemKey, { detector: detectorName, timestamp });
            if (this.documentCache.size > this.options.maxCacheSize) {
              this.cleanupCache();
            }
          }
          /**
           * Clean up old cache entries
           */
          cleanupCache() {
            const now = Date.now();
            const expiredKeys = [];
            for (const [key, data] of this.documentCache.entries()) {
              if (now - data.timestamp > this.options.cacheTimeout) {
                expiredKeys.push(key);
              }
            }
            expiredKeys.forEach((key) => {
              this.documentCache.delete(key);
              this.seenItems.delete(key);
            });
            console.log(`\u{1F9F9} Cache cleanup: removed ${expiredKeys.length} expired entries`);
          }
          /**
           * Check if detector can execute (throttling)
           */
          async canExecuteDetector(detector) {
            if (this.activeDetectors.size >= this.options.maxConcurrentDetectors) {
              return false;
            }
            const timeSinceLastExecution = Date.now() - this.lastDetectorExecution;
            if (timeSinceLastExecution < this.options.minDetectorInterval) {
              return false;
            }
            if (this.cpuMonitor.isAvailable()) {
              const cpuUsage = await this.cpuMonitor.getCurrentUsage();
              if (cpuUsage > this.options.cpuUsageThreshold) {
                console.log(`\u23F8\uFE0F High CPU usage detected: ${cpuUsage}%`);
                return false;
              }
            }
            return true;
          }
          /**
           * Update detector metrics
           */
          updateDetectorMetrics(detectorName, metrics) {
            const existing = this.detectorMetrics.get(detectorName) || {
              executions: 0,
              totalTime: 0,
              totalItems: 0,
              errors: 0,
              successes: 0
            };
            existing.executions++;
            existing.totalTime += metrics.executionTime || 0;
            existing.totalItems += metrics.itemsFound || 0;
            if (metrics.success) {
              existing.successes++;
            } else {
              existing.errors++;
              existing.lastError = metrics.error;
            }
            existing.averageTime = existing.totalTime / existing.executions;
            existing.lastExecution = Date.now();
            this.detectorMetrics.set(detectorName, existing);
          }
          /**
           * Get orchestrator metrics
           */
          getMetrics() {
            return {
              orchestrator: this.metrics,
              detectors: Object.fromEntries(this.detectorMetrics),
              frame: this.currentFrameInfo,
              cache: {
                documentCacheSize: this.documentCache.size,
                globalCacheSize: this.globalCache.size,
                seenItemsSize: this.seenItems.size
              },
              active: {
                detectorsRunning: this.activeDetectors.size,
                detectorQueue: this.detectorQueue.length
              }
            };
          }
          /**
           * Setup global instance
           */
          setupGlobalInstance() {
            if (typeof window !== "undefined") {
              if (!window.__ST) {
                window.__ST = {};
              }
              window.__ST.ContentOrchestrator = this;
              window.ContentOrchestrator = this;
              console.log("\u2705 Content Orchestrator available globally");
            }
          }
          // Utility methods
          normalizeUrl(url) {
            return window.RobustHelpers?.normalizeUrl(url) || url;
          }
          getElementSelector(element) {
            return window.StepThreeSelectorUtils?.getElementCSSPath(element) || "unknown";
          }
          hashObject(obj) {
            return btoa(JSON.stringify(obj)).substring(0, 16);
          }
          sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }
        }
        class CPUMonitor {
          constructor() {
            this.available = "performance" in window && "measureUserAgentSpecificMemory" in performance;
            this.lastMeasurement = 0;
            this.measurementInterval = 1e3;
          }
          isAvailable() {
            return this.available;
          }
          async getCurrentUsage() {
            if (!this.available) {
              return 0;
            }
            const now = Date.now();
            if (now - this.lastMeasurement < this.measurementInterval) {
              return this.lastCpuUsage || 0;
            }
            try {
              const start = performance.now();
              let count = 0;
              const endTime = start + 10;
              while (performance.now() < endTime) {
                count++;
              }
              const actualTime = performance.now() - start;
              const cpuEstimate = Math.min(100, Math.max(0, (actualTime - 10) * 5));
              this.lastCpuUsage = cpuEstimate;
              this.lastMeasurement = now;
              return cpuEstimate;
            } catch (error) {
              return 0;
            }
          }
        }
        if (typeof window !== "undefined" && !window.__ST?.ContentOrchestratorLoaded) {
          if (!window.__ST) window.__ST = {};
          window.__ST.ContentOrchestratorLoaded = true;
          window.__ST.detectionSystems = {
            smartPatternRecognition: null,
            dynamicContentObserver: null,
            advancedExtractor: null,
            initialized: /* @__PURE__ */ new Set()
          };
          const orchestratorOptions = {
            enableFrameGating: true,
            topFrameOnly: true,
            // Default to top-level only to reduce duplicates
            enableDeduplication: true,
            enableThrottling: true,
            enableDetectorSequencing: true,
            enableMetricsTracking: true,
            maxConcurrentDetectors: 2,
            minDetectorInterval: 500
          };
          window.__ST.orchestrator = new ContentOrchestrator(orchestratorOptions);
          console.log("\u2705 Content Orchestrator System initialized with coordination registry");
          window.__ST.initializeSharedDetectionSystems = function() {
            console.log("\u{1F504} [COORD] Initializing shared detection systems...");
            if (!window.__ST.detectionSystems.smartPatternRecognition && typeof SmartPatternRecognition !== "undefined") {
              try {
                window.__ST.detectionSystems.smartPatternRecognition = new SmartPatternRecognition({
                  enableAdvancedPatterns: true,
                  enableUrlValidation: true,
                  coordinated: true
                });
                console.log("\u2705 [COORD] Shared SmartPatternRecognition initialized");
              } catch (error) {
                console.error("\u274C [COORD] Failed to initialize SmartPatternRecognition:", error);
              }
            }
            if (!window.__ST.detectionSystems.dynamicContentObserver && typeof DynamicContentObserver !== "undefined") {
              try {
                window.__ST.detectionSystems.dynamicContentObserver = new DynamicContentObserver({
                  throttleDelay: 1e3,
                  coordinated: true
                });
                const observerRegistered = window.__ST.orchestrator.registerDetector("dynamic-content-observer", {
                  name: "dynamic-content-observer",
                  execute: async (context) => {
                    return window.__ST.detectionSystems.dynamicContentObserver.analyzeChanges();
                  },
                  cleanup: () => {
                    window.__ST.detectionSystems.dynamicContentObserver.stop();
                  }
                }, {
                  priority: 1,
                  // High priority - runs first
                  timeout: 15e3,
                  maxRetries: 1
                });
                if (observerRegistered) {
                  console.log("\u2705 [COORD] DynamicContentObserver registered with orchestrator");
                }
              } catch (error) {
                console.error("\u274C [COORD] Failed to initialize DynamicContentObserver:", error);
              }
            }
          };
          window.__ST.getSharedDetectionSystem = function(systemName) {
            return window.__ST.detectionSystems[systemName] || null;
          };
          window.__ST.markSystemInitialized = function(systemName) {
            window.__ST.detectionSystems.initialized.add(systemName);
            console.log(`\u{1F3F7}\uFE0F [COORD] System marked as initialized: ${systemName}`);
          };
          window.__ST.isSystemInitialized = function(systemName) {
            return window.__ST.detectionSystems.initialized.has(systemName);
          };
        }
        console.log("\u26A0\uFE0F Legacy message listener disabled - using enhanced listener only");
        if (ExtensionState2.config.autoInitialize) {
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
              setTimeout(() => initializeExtension().catch(console.error), 100);
            });
          } else {
            setTimeout(() => initializeExtension().catch(console.error), 100);
          }
        }
        window.addEventListener("beforeunload", () => {
          if (ExtensionState2.observer) {
            ExtensionState2.observer.stop();
          }
          if (ExtensionState2.picker) {
            ExtensionState2.picker.stop();
          }
        });
        console.log("\u2705 STEPTHREE Content Bundle loaded and ready!");
        window.StepThree = {
          initialize: initializeExtension,
          scrape: window.runScrape,
          findGallery: (options) => ExtensionState2.selector?.findGalleryImages(options),
          startPicker: () => ExtensionState2.picker?.startPicking(),
          stopPicker: () => ExtensionState2.picker?.stop(),
          startObserver: (callback) => ExtensionState2.observer?.start(callback),
          stopObserver: () => ExtensionState2.observer?.stop(),
          getStatus: getExtensionStatus,
          getMetrics: getExtensionMetrics
        };
      } else {
        console.log("\u2705 STEPTHREE Content Bundle already loaded");
      }
      var SmartPatternRecognition = class {
        constructor(options = {}) {
          this.options = {
            // Pattern recognition settings
            enableAdvancedPatterns: options.enableAdvancedPatterns !== false,
            enableUrlValidation: options.enableUrlValidation !== false,
            enableContentValidation: options.enableContentValidation !== false,
            enableDomainReputation: options.enableDomainReputation !== false,
            enableContextAnalysis: options.enableContextAnalysis !== false,
            // Quality thresholds
            minConfidenceScore: options.minConfidenceScore || 0.3,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.75,
            minImageWidth: options.minImageWidth || 30,
            // More lenient for gallery images
            minImageHeight: options.minImageHeight || 30,
            // More lenient for gallery images
            minFileSize: options.minFileSize || 1024,
            // 1KB
            maxAspectRatio: options.maxAspectRatio || 10,
            // Performance settings
            maxCacheSize: options.maxCacheSize || 1e3,
            cacheTimeout: options.cacheTimeout || 3e5,
            // 5 minutes
            maxAnalysisTime: options.maxAnalysisTime || 5e3,
            // 5 seconds
            ...options
          };
          this.patternCache = /* @__PURE__ */ new Map();
          this.domainReputationCache = /* @__PURE__ */ new Map();
          this.urlValidationCache = /* @__PURE__ */ new Map();
          this.contentValidationCache = /* @__PURE__ */ new Map();
          this.galleryPatterns = this.buildGalleryPatterns();
          this.excludePatterns = this.buildExcludePatterns();
          this.dimensionPatterns = this.buildDimensionPatterns();
          this.knownGalleryDomains = this.buildKnownDomains();
          this.knownCdnDomains = this.buildCdnDomains();
          this.scoringWeights = {
            urlPattern: 0.25,
            domainReputation: 0.2,
            dimensionInfo: 0.15,
            fileExtension: 0.1,
            contextualClues: 0.15,
            contentValidation: 0.15
          };
          this.metrics = {
            patternsProcessed: 0,
            urlsValidated: 0,
            contentValidated: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageProcessingTime: 0,
            confidenceDistribution: { high: 0, medium: 0, low: 0 }
          };
          this.initialized = true;
          console.log("\u2705 Smart Pattern Recognition System initialized");
        }
        // Build pattern libraries
        buildGalleryPatterns() {
          return {
            positive: [
              { test: (url) => /\/gallery\/|\/galleries\/|\/photos\/|\/images\//i.test(url), name: "gallery-path", weight: 0.8 },
              { test: (url) => /\/media\/|\/assets\/|\/uploads\//i.test(url), name: "media-path", weight: 0.7 },
              { test: (url) => /\d{3,}x\d{3,}|_\d{3,}x\d{3,}/i.test(url), name: "dimensions", weight: 0.9 }
            ],
            thumbnails: [
              { test: (url) => /thumb|thumbnail|preview|small/i.test(url), name: "thumbnail", weight: 0.6 }
            ],
            highRes: [
              { test: (url) => /original|full|large|hd|high/i.test(url), name: "high-res", weight: 0.9 }
            ]
          };
        }
        buildExcludePatterns() {
          return [
            { test: (url) => /icon|favicon|logo|emoji|avatar|profile/i.test(url), name: "ui-elements" },
            { test: (url) => /loading|spinner|placeholder|blank/i.test(url), name: "placeholders" }
          ];
        }
        buildDimensionPatterns() {
          return [
            { regex: /(\d{3,})x(\d{3,})/i, widthGroup: 1, heightGroup: 2 },
            { regex: /_(\d{3,})x(\d{3,})/i, widthGroup: 1, heightGroup: 2 }
          ];
        }
        buildKnownDomains() {
          return /* @__PURE__ */ new Set([
            "imgur.com",
            "flickr.com",
            "instagram.com",
            "pinterest.com",
            "unsplash.com",
            "pixabay.com",
            "pexels.com",
            "artstation.com"
          ]);
        }
        buildCdnDomains() {
          return /* @__PURE__ */ new Set([
            "cloudinary.com",
            "amazonaws.com",
            "googleusercontent.com",
            "fbcdn.net",
            "cdninstagram.com",
            "pinimg.com"
          ]);
        }
        async validateUrl(url, context = {}) {
          if (!this.options.enableUrlValidation) {
            return { isValid: true, confidence: 0.5, reasons: ["validation-disabled"] };
          }
          const cacheKey = `url_${url}`;
          if (this.urlValidationCache.has(cacheKey)) {
            this.metrics.cacheHits++;
            return this.urlValidationCache.get(cacheKey);
          }
          const startTime = performance.now();
          let confidence = 0;
          const reasons = [];
          try {
            const urlObj = new URL(url);
            const galleryScore = this.analyzeGalleryPatterns(url, urlObj);
            confidence += galleryScore.score * this.scoringWeights.urlPattern;
            reasons.push(...galleryScore.reasons);
            const domainScore = await this.analyzeDomainReputation(urlObj.hostname);
            confidence += domainScore.score * this.scoringWeights.domainReputation;
            reasons.push(...domainScore.reasons);
            const extensionScore = this.analyzeFileExtension(url, urlObj);
            confidence += extensionScore.score * this.scoringWeights.fileExtension;
            reasons.push(...extensionScore.reasons);
            confidence = Math.min(Math.max(confidence, 0), 1);
            const result = {
              isValid: confidence >= this.options.minConfidenceScore,
              confidence,
              reasons,
              metadata: {
                domain: urlObj.hostname,
                path: urlObj.pathname,
                processingTime: performance.now() - startTime
              }
            };
            this.cacheResult(this.urlValidationCache, cacheKey, result);
            this.metrics.urlsValidated++;
            return result;
          } catch (error) {
            console.warn("URL validation error:", error);
            return {
              isValid: false,
              confidence: 0,
              reasons: ["invalid-url"],
              penalties: [error.message]
            };
          }
        }
        analyzeGalleryPatterns(url, urlObj) {
          let score = 0;
          const reasons = [];
          for (const pattern of this.galleryPatterns.positive) {
            if (pattern.test(url)) {
              score += pattern.weight || 0.8;
              reasons.push(`gallery-pattern-${pattern.name}`);
            }
          }
          return { score: Math.min(score, 1), reasons };
        }
        async analyzeDomainReputation(hostname) {
          const cacheKey = `domain_${hostname}`;
          if (this.domainReputationCache.has(cacheKey)) {
            this.metrics.cacheHits++;
            return this.domainReputationCache.get(cacheKey);
          }
          let score = 0.5;
          const reasons = [];
          if (this.knownGalleryDomains.has(hostname)) {
            score = 0.9;
            reasons.push("known-gallery-domain");
          } else if (this.knownCdnDomains.has(hostname)) {
            score = 0.8;
            reasons.push("known-cdn-domain");
          }
          const result = { score, reasons };
          this.cacheResult(this.domainReputationCache, cacheKey, result);
          return result;
        }
        analyzeFileExtension(url, urlObj) {
          const path = urlObj.pathname.toLowerCase();
          let score = 0;
          const reasons = [];
          const extensionMatch = path.match(/\.([a-z0-9]+)(?:\?|$)/);
          if (!extensionMatch) {
            return { score: 0.3, reasons: ["no-extension"] };
          }
          const extension = extensionMatch[1];
          const extensionScores = {
            "jpg": 0.9,
            "jpeg": 0.9,
            "png": 0.9,
            "webp": 0.85,
            "gif": 0.7,
            "svg": 0.6,
            "bmp": 0.5
          };
          score = extensionScores[extension] || 0.1;
          reasons.push(`extension-${extension}`);
          return { score, reasons };
        }
        async calculateConfidenceScore(imageObj, context = {}) {
          const startTime = performance.now();
          try {
            const urlValidation = await this.validateUrl(imageObj.src, context);
            const finalScore = urlValidation.confidence;
            this.updateConfidenceMetrics(finalScore);
            return {
              confidence: Math.min(Math.max(finalScore, 0), 1),
              breakdown: { url: urlValidation },
              processingTime: performance.now() - startTime
            };
          } catch (error) {
            console.warn("Confidence calculation error:", error);
            return {
              confidence: 0.3,
              breakdown: {},
              error: error.message
            };
          }
        }
        updateConfidenceMetrics(score) {
          this.metrics.patternsProcessed++;
          if (score >= 0.7) {
            this.metrics.confidenceDistribution.high++;
          } else if (score >= 0.4) {
            this.metrics.confidenceDistribution.medium++;
          } else {
            this.metrics.confidenceDistribution.low++;
          }
        }
        cacheResult(cache, key, result) {
          if (cache.size >= this.options.maxCacheSize) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
          }
          result._cached = Date.now();
          cache.set(key, result);
        }
        /**
         * Enhanced image categorization with Smart Pattern Recognition
         * This is the missing method that AdvancedCollectorSystem expects
         */
        categorizeImageEnhanced(imageObj, confidenceData = null) {
          const startTime = performance.now();
          try {
            const confidence = confidenceData ? confidenceData.confidence : 0.5;
            let category, categoryReason, confidenceTier;
            if (confidence >= this.options.highConfidenceThreshold) {
              category = "high_confidence";
              categoryReason = "Smart pattern analysis indicates high-quality gallery image";
              confidenceTier = "high";
            } else if (confidence >= this.options.minConfidenceScore) {
              category = "same_origin";
              categoryReason = "Moderate confidence based on URL patterns and context";
              confidenceTier = "medium";
            } else {
              category = "external";
              categoryReason = "Low confidence, requires additional validation";
              confidenceTier = "low";
            }
            const galleryTypeResult = this.detectGalleryType(imageObj);
            const qualityAssessment = this.assessImageQuality(imageObj);
            const duplicateCheck = this.checkForDuplicates(imageObj);
            if (galleryTypeResult.isGallery && qualityAssessment.score > 0.7) {
              category = "high_confidence";
              categoryReason += ` | Gallery pattern detected: ${galleryTypeResult.type}`;
            }
            if (duplicateCheck.isDuplicate) {
              category = "external";
              categoryReason += " | Potential duplicate detected";
            }
            return {
              ...imageObj,
              category,
              categoryReason,
              confidenceTier,
              enhancedAnalysis: {
                galleryType: galleryTypeResult,
                quality: qualityAssessment,
                duplicateStatus: duplicateCheck,
                processingTime: performance.now() - startTime
              }
            };
          } catch (error) {
            console.warn("Enhanced categorization failed:", error);
            return {
              ...imageObj,
              category: "external",
              categoryReason: "Error during enhanced analysis",
              confidenceTier: "low",
              error: error.message
            };
          }
        }
        /**
         * Intelligent gallery pattern detection
         */
        detectGalleryType(imageObj) {
          const url = imageObj.src;
          const element = imageObj.element;
          const urlPatterns = {
            instagram: /instagram\.com.*\/(p|reel)\//i,
            pinterest: /pinimg\.com|pinterest\.com/i,
            ecommerce: /shop|product|catalog|store/i,
            photography: /photo|gallery|portfolio/i,
            artstation: /artstation\.com/i,
            behance: /behance\.net/i
          };
          for (const [type, pattern] of Object.entries(urlPatterns)) {
            if (pattern.test(url)) {
              return { isGallery: true, type, confidence: 0.9 };
            }
          }
          if (element) {
            const parent = element.closest('.gallery, .images, .photos, .grid, [data-gallery], [class*="grid"], [class*="masonry"]');
            if (parent) {
              const galleryType = this.detectDOMGalleryType(parent);
              return { isGallery: true, type: galleryType, confidence: 0.8 };
            }
          }
          return { isGallery: false, type: "unknown", confidence: 0.2 };
        }
        /**
         * Detect gallery type from DOM structure
         */
        detectDOMGalleryType(container) {
          const style = window.getComputedStyle(container);
          const className = container.className.toLowerCase();
          if (style.display === "grid" || className.includes("grid")) {
            return "grid";
          }
          if (className.includes("carousel") || className.includes("slider")) {
            return "carousel";
          }
          if (className.includes("masonry")) {
            return "masonry";
          }
          if (container.querySelector("[data-infinite]") || className.includes("infinite")) {
            return "infinite-scroll";
          }
          return "standard";
        }
        /**
         * Advanced image quality assessment
         */
        assessImageQuality(imageObj) {
          let score = 0.5;
          const factors = [];
          const width = imageObj.width || 0;
          const height = imageObj.height || 0;
          if (width >= 800 && height >= 600) {
            score += 0.3;
            factors.push("high-resolution");
          } else if (width >= 400 && height >= 300) {
            score += 0.1;
            factors.push("medium-resolution");
          }
          if (width > 0 && height > 0) {
            const aspectRatio = width / height;
            if (aspectRatio >= 0.5 && aspectRatio <= 2) {
              score += 0.1;
              factors.push("good-aspect-ratio");
            }
          }
          const url = imageObj.src;
          const highQualityIndicators = ["original", "full", "large", "hd", "high", "1080", "4k"];
          const lowQualityIndicators = ["thumb", "small", "preview", "icon", "avatar"];
          for (const indicator of highQualityIndicators) {
            if (url.toLowerCase().includes(indicator)) {
              score += 0.2;
              factors.push(`high-quality-indicator-${indicator}`);
              break;
            }
          }
          for (const indicator of lowQualityIndicators) {
            if (url.toLowerCase().includes(indicator)) {
              score -= 0.2;
              factors.push(`low-quality-indicator-${indicator}`);
              break;
            }
          }
          return {
            score: Math.min(Math.max(score, 0), 1),
            factors
          };
        }
        /**
         * Duplicate detection using URL patterns
         */
        checkForDuplicates(imageObj) {
          const url = imageObj.src;
          const baseUrl = url.split("?")[0];
          const urlHash = this.generateSimpleHash(baseUrl);
          if (this.patternCache.has(`duplicate_${urlHash}`)) {
            return {
              isDuplicate: true,
              method: "url-hash",
              confidence: 0.9
            };
          }
          this.patternCache.set(`duplicate_${urlHash}`, true);
          return {
            isDuplicate: false,
            method: "url-hash",
            confidence: 0.1
          };
        }
        /**
         * Generate simple hash for URL comparison
         */
        generateSimpleHash(str) {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
          }
          return hash.toString(36);
        }
        getMetrics() {
          return {
            ...this.metrics,
            cacheStats: {
              patternCacheSize: this.patternCache.size,
              domainCacheSize: this.domainReputationCache.size,
              urlCacheSize: this.urlValidationCache.size,
              contentCacheSize: this.contentValidationCache.size
            }
          };
        }
        reset() {
          this.metrics = {
            patternsProcessed: 0,
            urlsValidated: 0,
            contentValidated: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageProcessingTime: 0,
            confidenceDistribution: { high: 0, medium: 0, low: 0 }
          };
          this.patternCache.clear();
          this.domainReputationCache.clear();
          this.urlValidationCache.clear();
          this.contentValidationCache.clear();
        }
      };
      if (typeof window !== "undefined") {
        window.SmartPatternRecognition = SmartPatternRecognition;
      }
      console.log("\u2705 Smart Pattern Recognition System loaded successfully");
      if (!window.EnhancedSmartSelectorSystem) {
        class EnhancedSmartSelectorSystem {
          constructor(options = {}) {
            this.options = {
              maxFallbackAttempts: options.maxFallbackAttempts || 3,
              selectorTimeout: options.selectorTimeout || 2e3,
              confidenceThreshold: options.confidenceThreshold || 0.75,
              earlyExitThreshold: options.earlyExitThreshold || 0.9,
              confidenceWeights: {
                dataAttributes: 0.95,
                reactPatterns: 0.92,
                semanticClasses: 0.88,
                structuralPatterns: 0.85,
                genericSelectors: 0.6
              },
              enableProgressiveAnalysis: options.enableProgressiveAnalysis !== false,
              enableEarlyExit: options.enableEarlyExit !== false,
              maxAnalysisTime: options.maxAnalysisTime || 5e3,
              // Comprehensive site-specific patterns
              siteSpecificPatterns: {
                instagram: {
                  domain: ["instagram.com", "www.instagram.com"],
                  confidence: 0.95,
                  imageSelectors: [
                    "._aagu img",
                    "._aagv img",
                    'article img[src*="scontent"]',
                    '[role="presentation"] img[src*="scontent"]',
                    'img[alt*="Photo by"]',
                    'div[class*="x1n2onr6"] img',
                    'article img:not([src*="static"])',
                    'section[role="main"] img:not([alt*="avatar"])'
                  ]
                },
                pinterest: {
                  domain: ["pinterest.com", "www.pinterest.com"],
                  confidence: 0.93,
                  imageSelectors: [
                    '[data-test-id="pin-image"] img',
                    ".GrowthUnauthPinImage img",
                    ".pinImage img",
                    'img[src*="pinimg"]',
                    'div[class*="gridCentered"] img'
                  ]
                },
                twitter: {
                  domain: ["twitter.com", "x.com"],
                  confidence: 0.9,
                  imageSelectors: [
                    '[data-testid="tweetPhoto"] img',
                    '[data-testid="media"] img',
                    'img[src*="pbs.twimg.com"]',
                    '[role="group"] img[src*="pbs.twimg.com"]'
                  ]
                },
                generic: {
                  confidence: 0.6,
                  imageSelectors: [
                    'img[src]:not([src*="icon"]):not([src*="avatar"]):not([width="16"]):not([height="16"])',
                    ".gallery img",
                    ".images img",
                    ".photos img",
                    'article img:not([width="16"])',
                    "figure img",
                    ".media img"
                  ]
                }
              },
              ...options
            };
            this.cache = /* @__PURE__ */ new Map();
            this.performanceMetrics = {
              totalAnalyses: 0,
              averageConfidence: 0,
              siteSpecificHits: 0,
              genericFallbacks: 0,
              processingTimes: [],
              adaptiveLearning: {
                successfulPatterns: /* @__PURE__ */ new Map(),
                failedPatterns: /* @__PURE__ */ new Map(),
                confidenceAdjustments: 0,
                patternEvolution: []
              }
            };
            this.adaptiveLearning = {
              patternSuccess: /* @__PURE__ */ new Map(),
              patternFailure: /* @__PURE__ */ new Map(),
              userFeedback: /* @__PURE__ */ new Map(),
              confidenceHistory: [],
              lastUpdate: Date.now()
            };
            this.smartPatternRecognition = null;
            this.initializeSmartPatternRecognition();
            this.initializeModalSystem();
            console.log("\u2705 Enhanced Smart Selector System initialized with adaptive learning");
          }
          /**
           * Initialize Smart Pattern Recognition integration with coordination
           */
          initializeSmartPatternRecognition() {
            try {
              if (window.__ST?.getSharedDetectionSystem) {
                this.smartPatternRecognition = window.__ST.getSharedDetectionSystem("smartPatternRecognition");
                if (this.smartPatternRecognition) {
                  console.log("\u2705 [COORD] Using shared SmartPatternRecognition instance");
                  return;
                }
              }
              if (typeof SmartPatternRecognition !== "undefined" && !window.__ST?.isSystemInitialized("smart-pattern-recognition-selector")) {
                this.smartPatternRecognition = new SmartPatternRecognition({
                  minConfidenceScore: this.options.confidenceThreshold * 0.8,
                  highConfidenceThreshold: this.options.confidenceThreshold,
                  enableAdvancedPatterns: true,
                  enableUrlValidation: true,
                  enableContentValidation: true
                });
                console.log("\u2705 Smart Pattern Recognition integrated with Enhanced Smart Selector");
              }
            } catch (error) {
              console.warn("\u26A0\uFE0F Smart Pattern Recognition integration failed:", error);
            }
          }
          async findGalleryImages(options = {}) {
            const startTime = performance.now();
            const domain = window.location.hostname.toLowerCase();
            try {
              const analysisResults = await this.performProgressiveAnalysis(domain, options);
              if (this.options.enableEarlyExit && analysisResults.confidence >= this.options.earlyExitThreshold) {
                console.log(`\u{1F680} Early exit triggered - high confidence: ${analysisResults.confidence}`);
                return this.finalizeResults(analysisResults, startTime);
              }
              const siteResults = await this.performSiteSpecificAnalysis(domain, options);
              const mergedResults = this.mergeAnalysisResults([analysisResults, siteResults]);
              return this.finalizeResults(mergedResults, startTime);
            } catch (error) {
              console.error("Enhanced Smart Selector error:", error);
              return this.handleAnalysisError(error, startTime);
            }
          }
          async performProgressiveAnalysis(domain, options) {
            const results = { images: [], confidence: 0, metadata: {} };
            const highConfidenceSelectors = this.getHighConfidenceSelectors(domain);
            const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
            for (const selector of highConfidenceSelectors) {
              const elements = cachedQuery(selector);
              for (const element of elements) {
                const imageData = this.extractImageData(element, selector, 0.9);
                if (imageData) {
                  results.images.push(imageData);
                }
              }
              if (results.images.length > 10) break;
            }
            results.confidence = this.calculateOverallConfidence(results.images);
            return results;
          }
          async performSiteSpecificAnalysis(domain, options) {
            const sitePattern = this.findSitePattern(domain);
            const results = { images: [], confidence: 0, metadata: { sitePattern: sitePattern?.domain } };
            const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
            if (sitePattern) {
              console.log(`\u{1F3AF} Using site-specific patterns for ${sitePattern.domain}`);
              for (const selector of sitePattern.imageSelectors) {
                const elements = cachedQuery(selector);
                for (const element of elements) {
                  const imageData = this.extractImageData(element, selector, sitePattern.confidence);
                  if (imageData) {
                    results.images.push(imageData);
                  }
                }
              }
              this.performanceMetrics.siteSpecificHits++;
            } else {
              const genericPattern = this.options.siteSpecificPatterns.generic;
              for (const selector of genericPattern.imageSelectors) {
                const elements = cachedQuery(selector);
                for (const element of elements) {
                  const imageData = this.extractImageData(element, selector, genericPattern.confidence);
                  if (imageData) {
                    results.images.push(imageData);
                  }
                }
              }
              this.performanceMetrics.genericFallbacks++;
            }
            results.confidence = this.calculateOverallConfidence(results.images);
            return results;
          }
          findSitePattern(domain) {
            for (const [key, pattern] of Object.entries(this.options.siteSpecificPatterns)) {
              if (pattern.domain && pattern.domain.some((d) => domain.includes(d))) {
                return pattern;
              }
            }
            return null;
          }
          getHighConfidenceSelectors(domain) {
            return [
              '[data-testid*="image"] img',
              '[data-test-id*="image"] img',
              "[data-gallery] img",
              ".gallery img",
              ".image-container img",
              'img[loading="lazy"]:not([src*="icon"])'
            ];
          }
          /**
           * Enhanced image data extraction with comprehensive detection
           */
          extractImageData(element, selector, confidence) {
            const detectionResults = this.detectAllImageSources(element);
            if (!detectionResults.src) return null;
            if (!this.passesQualityFilter(detectionResults, element)) {
              return null;
            }
            const metadata = this.collectEnhancedMetadata(element, detectionResults);
            const adjustedConfidence = this.adjustConfidenceAdaptively(confidence, metadata, detectionResults);
            return {
              src: detectionResults.src,
              alt: element.alt || detectionResults.alt || "",
              width: element.naturalWidth || detectionResults.width || element.getBoundingClientRect().width,
              height: element.naturalHeight || detectionResults.height || element.getBoundingClientRect().height,
              selector,
              confidence: adjustedConfidence,
              element,
              metadata,
              detectionMethod: detectionResults.method,
              qualityScore: detectionResults.qualityScore
            };
          }
          /**
           * Comprehensive image source detection including lazy loading, srcset, and video posters
           */
          detectAllImageSources(element) {
            const results = { src: null, method: "none", qualityScore: 0.5, width: 0, height: 0, alt: "" };
            if (element.tagName === "IMG") {
              const srcAttributes = [
                "src",
                // Standard source
                "data-src",
                // Common lazy loading
                "data-lazy-src",
                // Lazy loading variant
                "data-srcset",
                // Responsive images
                "data-original",
                // Original image
                "data-full",
                // Full size image
                "data-large"
                // Large image
              ];
              for (const attr of srcAttributes) {
                const value = element.getAttribute(attr);
                if (value && !value.startsWith("data:")) {
                  results.src = value;
                  results.method = `img-${attr}`;
                  results.qualityScore = this.getAttributeQualityScore(attr);
                  break;
                }
              }
              if (!results.src) {
                const srcset = element.getAttribute("srcset") || element.getAttribute("data-srcset");
                if (srcset) {
                  const sources = this.parseSrcset(srcset);
                  const bestSource = this.selectBestSource(sources);
                  if (bestSource) {
                    results.src = bestSource.url;
                    results.method = "img-srcset";
                    results.qualityScore = 0.8;
                    results.width = bestSource.width;
                  }
                }
              }
              results.alt = element.alt || "";
            }
            if (!results.src) {
              const backgroundSrc = this.detectBackgroundImage(element);
              if (backgroundSrc) {
                results.src = backgroundSrc.url;
                results.method = "background-css";
                results.qualityScore = backgroundSrc.qualityScore;
              }
            }
            if (!results.src && (element.tagName === "VIDEO" || element.closest("video"))) {
              const videoSrc = this.detectVideoThumbnail(element);
              if (videoSrc) {
                results.src = videoSrc.url;
                results.method = "video-poster";
                results.qualityScore = videoSrc.qualityScore;
              }
            }
            if (!results.src) {
              const pwaSrc = this.detectProgressiveImage(element);
              if (pwaSrc) {
                results.src = pwaSrc.url;
                results.method = "progressive-app";
                results.qualityScore = pwaSrc.qualityScore;
              }
            }
            return results;
          }
          /**
           * Parse srcset attribute to extract image sources
           */
          parseSrcset(srcset) {
            const sources = [];
            const candidates = srcset.split(",");
            for (const candidate of candidates) {
              const trimmed = candidate.trim();
              const parts = trimmed.split(/\s+/);
              if (parts.length >= 1) {
                const url = parts[0];
                let width = 0;
                if (parts.length > 1) {
                  const descriptor = parts[1];
                  if (descriptor.endsWith("w")) {
                    width = parseInt(descriptor.slice(0, -1), 10) || 0;
                  }
                }
                sources.push({ url, width });
              }
            }
            return sources;
          }
          /**
           * Select the best source from srcset based on quality
           */
          selectBestSource(sources) {
            if (sources.length === 0) return null;
            sources.sort((a, b) => b.width - a.width);
            const idealWidth = 1200;
            for (const source of sources) {
              if (source.width >= idealWidth) {
                return source;
              }
            }
            return sources[0];
          }
          /**
           * Advanced background image detection
           */
          detectBackgroundImage(element) {
            const style = window.getComputedStyle(element);
            const backgroundImage = style.backgroundImage;
            if (backgroundImage && backgroundImage !== "none") {
              const matches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
              if (matches) {
                const url = matches[1];
                let qualityScore = 0.6;
                if (url.includes("large") || url.includes("full") || url.includes("original")) {
                  qualityScore = 0.9;
                } else if (url.includes("medium") || url.includes("cover")) {
                  qualityScore = 0.7;
                }
                return { url, qualityScore };
              }
            }
            const computedStyle = style;
            for (let i = 0; i < computedStyle.length; i++) {
              const property = computedStyle[i];
              if (property.startsWith("--") && property.includes("image")) {
                const value = computedStyle.getPropertyValue(property);
                if (value.includes("url(")) {
                  const matches = value.match(/url\(['"]?([^'"]+)['"]?\)/);
                  if (matches) {
                    return { url: matches[1], qualityScore: 0.5 };
                  }
                }
              }
            }
            return null;
          }
          /**
           * Detect video thumbnails and poster images
           */
          detectVideoThumbnail(element) {
            const video = element.tagName === "VIDEO" ? element : element.closest("video");
            if (video) {
              const poster = video.getAttribute("poster");
              if (poster) {
                return { url: poster, qualityScore: 0.8 };
              }
              const container = video.parentElement;
              if (container) {
                const thumbnail = container.querySelector("[data-thumbnail], [data-poster], .video-thumbnail img");
                if (thumbnail) {
                  const src = thumbnail.src || thumbnail.getAttribute("data-src");
                  if (src) {
                    return { url: src, qualityScore: 0.7 };
                  }
                }
              }
            }
            return null;
          }
          /**
           * Detect progressive web app images
           */
          detectProgressiveImage(element) {
            const pwaAttributes = [
              "data-progressive-src",
              "data-intersection-src",
              "data-dynamic-src"
            ];
            for (const attr of pwaAttributes) {
              const value = element.getAttribute(attr);
              if (value) {
                return { url: value, qualityScore: 0.6 };
              }
            }
            return null;
          }
          /**
           * Get quality score for different src attributes
           */
          getAttributeQualityScore(attribute) {
            const scores = {
              "src": 0.9,
              "data-original": 0.95,
              "data-full": 0.9,
              "data-large": 0.85,
              "data-src": 0.8,
              "data-lazy-src": 0.75,
              "data-srcset": 0.8
            };
            return scores[attribute] || 0.5;
          }
          /**
           * Advanced quality filtering with multiple criteria
           */
          passesQualityFilter(detectionResults, element) {
            const src = detectionResults.src;
            const lowValueIndicators = ["icon", "avatar", "logo", "emoji", "loading", "spinner", "placeholder"];
            if (lowValueIndicators.some((indicator) => src.toLowerCase().includes(indicator))) {
              return false;
            }
            if (element.alt) {
              const altLower = element.alt.toLowerCase();
              if (lowValueIndicators.some((indicator) => altLower.includes(indicator))) {
                return false;
              }
            }
            const rect = element.getBoundingClientRect();
            if (rect.width < 20 || rect.height < 20) {
              return false;
            }
            if (rect.width > 0 && rect.height > 0) {
              const aspectRatio = rect.width / rect.height;
              if (aspectRatio > 10 || aspectRatio < 0.1) {
                return false;
              }
            }
            if (src.startsWith("data:")) {
              if (src.length < 1e3) {
                return false;
              }
            }
            return true;
          }
          /**
           * Collect enhanced metadata for adaptive learning
           */
          collectEnhancedMetadata(element, detectionResults) {
            const rect = element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(element);
            return {
              // Basic element info
              className: element.className,
              id: element.id,
              tagName: element.tagName,
              // Positioning and layout
              position: {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              },
              // Style information
              styles: {
                display: computedStyle.display,
                position: computedStyle.position,
                zIndex: computedStyle.zIndex,
                opacity: computedStyle.opacity
              },
              // Context analysis
              context: this.analyzeElementContext(element),
              // Detection metadata
              detection: {
                method: detectionResults.method,
                qualityScore: detectionResults.qualityScore,
                timestamp: Date.now()
              },
              // Parent analysis
              parentAnalysis: this.analyzeParentContainer(element)
            };
          }
          /**
           * Adaptive confidence adjustment based on learning
           */
          adjustConfidenceAdaptively(baseConfidence, metadata, detectionResults) {
            let adjustedConfidence = baseConfidence;
            const patternKey = this.generatePatternKey(metadata, detectionResults);
            if (this.adaptiveLearning.patternSuccess.has(patternKey)) {
              const successRate = this.adaptiveLearning.patternSuccess.get(patternKey);
              adjustedConfidence *= 1 + (successRate - 0.5) * 0.4;
              this.performanceMetrics.adaptiveLearning.confidenceAdjustments++;
            }
            if (metadata.context && metadata.context.isInGallery) {
              adjustedConfidence *= 1.2;
            }
            adjustedConfidence *= 0.7 + detectionResults.qualityScore * 0.3;
            if (this.smartPatternRecognition) {
              try {
                const smartAnalysis = this.smartPatternRecognition.calculateConfidenceScore(
                  { src: detectionResults.src },
                  { metadata, detectionResults }
                );
                if (smartAnalysis && smartAnalysis.confidence) {
                  adjustedConfidence = (adjustedConfidence + smartAnalysis.confidence) / 2;
                }
              } catch (error) {
                console.warn("Smart Pattern Recognition confidence calculation failed:", error);
              }
            }
            return Math.min(Math.max(adjustedConfidence, 0), 1);
          }
          /**
           * Generate pattern key for adaptive learning
           */
          generatePatternKey(metadata, detectionResults) {
            const components = [
              detectionResults.method || "unknown",
              metadata.context ? metadata.context.galleryType : "none",
              metadata.tagName || "unknown",
              metadata.className ? metadata.className.split(" ")[0] : "no-class"
            ];
            return components.join("|");
          }
          /**
           * Analyze element context for better pattern recognition
           */
          analyzeElementContext(element) {
            const context = {
              isInGallery: false,
              galleryType: "none",
              siblingCount: 0,
              hasGalleryIndicators: false
            };
            const galleryContainer = element.closest(".gallery, .images, .photos, [data-gallery], .grid, .masonry, .carousel");
            if (galleryContainer) {
              context.isInGallery = true;
              context.galleryType = this.detectContainerType(galleryContainer);
              context.hasGalleryIndicators = true;
            }
            const parent = element.parentElement;
            if (parent) {
              const siblings = parent.querySelectorAll(element.tagName);
              context.siblingCount = siblings.length;
            }
            return context;
          }
          /**
           * Analyze parent container for pattern recognition
           */
          analyzeParentContainer(element) {
            const parent = element.parentElement;
            if (!parent) return null;
            const computedStyle = window.getComputedStyle(parent);
            return {
              className: parent.className,
              display: computedStyle.display,
              flexDirection: computedStyle.flexDirection,
              gridTemplateColumns: computedStyle.gridTemplateColumns,
              childCount: parent.children.length,
              hasDataAttributes: this.hasGalleryDataAttributes(parent)
            };
          }
          /**
           * Check for gallery-related data attributes
           */
          hasGalleryDataAttributes(element) {
            const galleryAttributes = ["data-gallery", "data-grid", "data-masonry", "data-carousel", "data-slideshow"];
            return galleryAttributes.some((attr) => element.hasAttribute(attr));
          }
          /**
           * Detect container type for gallery classification
           */
          detectContainerType(container) {
            const className = container.className.toLowerCase();
            const style = window.getComputedStyle(container);
            if (style.display === "grid" || className.includes("grid")) {
              return "grid";
            }
            if (className.includes("masonry")) {
              return "masonry";
            }
            if (className.includes("carousel") || className.includes("slider")) {
              return "carousel";
            }
            if (className.includes("gallery")) {
              return "gallery";
            }
            return "container";
          }
          /**
           * Learn from successful pattern selections
           */
          learnFromSuccess(imageData) {
            if (!imageData.metadata) return;
            const patternKey = this.generatePatternKey(imageData.metadata, {
              method: imageData.detectionMethod || "unknown"
            });
            const currentSuccess = this.adaptiveLearning.patternSuccess.get(patternKey) || 0.5;
            const newSuccess = Math.min(currentSuccess + 0.1, 1);
            this.adaptiveLearning.patternSuccess.set(patternKey, newSuccess);
            this.performanceMetrics.adaptiveLearning.successfulPatterns.set(
              patternKey,
              (this.performanceMetrics.adaptiveLearning.successfulPatterns.get(patternKey) || 0) + 1
            );
            console.log(`\u{1F3AF} Pattern learning: ${patternKey} success rate: ${newSuccess.toFixed(2)}`);
          }
          /**
           * Learn from failed pattern selections
           */
          learnFromFailure(imageData) {
            if (!imageData.metadata) return;
            const patternKey = this.generatePatternKey(imageData.metadata, {
              method: imageData.detectionMethod || "unknown"
            });
            const currentSuccess = this.adaptiveLearning.patternSuccess.get(patternKey) || 0.5;
            const newSuccess = Math.max(currentSuccess - 0.1, 0);
            this.adaptiveLearning.patternSuccess.set(patternKey, newSuccess);
            this.performanceMetrics.adaptiveLearning.failedPatterns.set(
              patternKey,
              (this.performanceMetrics.adaptiveLearning.failedPatterns.get(patternKey) || 0) + 1
            );
            console.log(`\u274C Pattern learning: ${patternKey} success rate: ${newSuccess.toFixed(2)}`);
          }
          calculateOverallConfidence(images) {
            if (images.length === 0) return 0;
            const totalConfidence = images.reduce((sum, img) => sum + img.confidence, 0);
            return totalConfidence / images.length;
          }
          mergeAnalysisResults(resultsArray) {
            const mergedImages = [];
            const seenUrls = /* @__PURE__ */ new Set();
            for (const results of resultsArray) {
              for (const image of results.images) {
                if (!seenUrls.has(image.src)) {
                  seenUrls.add(image.src);
                  mergedImages.push(image);
                }
              }
            }
            mergedImages.sort((a, b) => b.confidence - a.confidence);
            return {
              images: mergedImages,
              confidence: this.calculateOverallConfidence(mergedImages),
              metadata: { merged: true }
            };
          }
          finalizeResults(results, startTime) {
            const processingTime = performance.now() - startTime;
            this.performanceMetrics.totalAnalyses++;
            this.performanceMetrics.processingTimes.push(processingTime);
            this.performanceMetrics.averageConfidence = (this.performanceMetrics.averageConfidence + results.confidence) / 2;
            console.log(`\u2705 Enhanced Smart Selector completed: ${results.images.length} images found (${processingTime.toFixed(2)}ms)`);
            return {
              success: true,
              images: results.images,
              confidence: results.confidence,
              metadata: {
                ...results.metadata,
                processingTime,
                totalFound: results.images.length,
                performance: this.performanceMetrics
              }
            };
          }
          handleAnalysisError(error, startTime) {
            const processingTime = performance.now() - startTime;
            console.error("Analysis error:", error);
            return {
              success: false,
              images: [],
              confidence: 0,
              error: error.message,
              metadata: { processingTime }
            };
          }
          // Modal system for selector interface
          initializeModalSystem() {
            this.modalContainer = null;
            this.modalIframe = null;
            this.modalOverlay = null;
            this.isModalActive = false;
          }
          createSecureModal(title = "Smart Selector", content = "") {
            if (this.isModalActive) {
              this.closeModal();
            }
            this.modalOverlay = document.createElement("div");
            this.modalOverlay.id = "stepthree-smart-selector-overlay";
            this.modalOverlay.style.cssText = `
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100vw !important; height: 100vh !important;
        background: rgba(0, 0, 0, 0.7) !important; z-index: 2147483647 !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
      `;
            this.modalContainer = document.createElement("div");
            this.modalContainer.style.cssText = `
        background: white !important; border-radius: 12px !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3) !important;
        max-width: 90vw !important; max-height: 90vh !important;
        width: 800px !important; height: 600px !important;
        display: flex !important; flex-direction: column !important;
      `;
            const header = document.createElement("div");
            header.style.cssText = `
        padding: 20px !important; border-bottom: 1px solid #e0e0e0 !important;
        display: flex !important; justify-content: space-between !important;
        align-items: center !important; background: #f8f9fa !important;
      `;
            const titleElement = document.createElement("h3");
            titleElement.textContent = title;
            titleElement.style.cssText = `
        margin: 0 !important; font-size: 18px !important;
        font-weight: 600 !important; color: #333 !important;
      `;
            const closeButton = document.createElement("button");
            closeButton.textContent = "\u2715";
            closeButton.style.cssText = `
        background: none !important; border: none !important;
        font-size: 20px !important; cursor: pointer !important;
        color: #666 !important; padding: 5px 8px !important;
      `;
            closeButton.onclick = () => this.closeModal();
            header.appendChild(titleElement);
            header.appendChild(closeButton);
            this.modalIframe = document.createElement("iframe");
            this.modalIframe.style.cssText = `
        flex: 1 !important; border: none !important;
        width: 100% !important; height: 100% !important;
      `;
            this.modalIframe.srcdoc = this.createIframeContent(content);
            this.modalContainer.appendChild(header);
            this.modalContainer.appendChild(this.modalIframe);
            this.modalOverlay.appendChild(this.modalContainer);
            document.body.appendChild(this.modalOverlay);
            this.modalOverlay.addEventListener("click", (e) => {
              if (e.target === this.modalOverlay) {
                this.closeModal();
              }
            });
            this.isModalActive = true;
            return this.modalContainer;
          }
          createIframeContent(content) {
            return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                   line-height: 1.6; color: #333; padding: 20px; }
            .selector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); 
                            gap: 12px; margin: 20px 0; }
            .selector-item { background: #f8f9fa; padding: 12px; border-radius: 8px; 
                            border: 2px solid #e9ecef; cursor: pointer; transition: all 0.2s ease; }
            .selector-item:hover { background: #e3f2fd; border-color: #2196f3; }
          </style>
        </head>
        <body>
          <div class="container">${content}</div>
        </body>
        </html>
      `;
          }
          closeModal() {
            if (this.modalOverlay && this.modalOverlay.parentNode) {
              this.modalOverlay.remove();
            }
            this.isModalActive = false;
            this.modalContainer = null;
            this.modalIframe = null;
            this.modalOverlay = null;
          }
          getPerformanceMetrics() {
            return { ...this.performanceMetrics };
          }
          clearCache() {
            this.cache.clear();
          }
        }
        window.EnhancedSmartSelectorSystem = EnhancedSmartSelectorSystem;
        console.log("\u2705 Enhanced Smart Selector System loaded successfully");
      }
      function generateFrameId() {
        return `frame_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${window.location.hostname || "unknown"}`;
      }
      window.__STEPTHREE_MESSAGE_COORDINATOR = window.__STEPTHREE_MESSAGE_COORDINATOR || {
        initialized: false,
        ready: false,
        frameId: generateFrameId(),
        // CRITICAL FIX: Unique frame identifier
        listeners: /* @__PURE__ */ new Map(),
        messageHandlers: /* @__PURE__ */ new Map(),
        queuedHandlers: [],
        // CRITICAL FIX: Queue handlers during initialization
        startupTime: Date.now(),
        initializationAttempts: 0,
        MAX_ATTEMPTS: 3
      };
      var coordinator = window.__STEPTHREE_MESSAGE_COORDINATOR;
      var initialized = false;
      var extensionReady = false;
      var errorBoundary = null;
      var performanceMonitor = null;
      var startupTime = Date.now();
      var initializationAttempts = 0;
      var MAX_INITIALIZATION_ATTEMPTS = 3;
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        initializeContentScriptCoordinator();
      } else {
        console.log("\u{1F310} Not in Chrome extension context, skipping coordinator initialization");
      }
      async function initializeContentScriptCoordinator() {
        coordinator.initializationAttempts++;
        if (coordinator.initializationAttempts > coordinator.MAX_ATTEMPTS) {
          console.error("\u274C Max coordinator initialization attempts exceeded");
          return;
        }
        if (coordinator.initialized) {
          console.log("\u26A0\uFE0F Message coordinator already initialized, registering as handler");
          await registerWithCoordinator();
          return;
        }
        try {
          console.log(`\u{1F504} Initializing STEPTHREE message coordinator (attempt ${coordinator.initializationAttempts})...`);
          await initializeErrorBoundary();
          await initializePerformanceMonitoring();
          await waitForDOMReady();
          await performPreInitChecks();
          const moduleCheckResult = await checkModuleAvailability();
          if (!moduleCheckResult.success && moduleCheckResult.critical) {
            console.warn(`\u26A0\uFE0F Critical modules missing: ${moduleCheckResult.missing.join(", ")}`);
          }
          await setupCentralizedMessageListener();
          await initializeCoreSystems();
          await registerMessageHandlers();
          await performPostInitValidation();
          coordinator.initialized = true;
          coordinator.ready = true;
          initialized = true;
          extensionReady = true;
          processQueuedHandlers();
          const initTime = Date.now() - coordinator.startupTime;
          console.log(`\u2705 STEPTHREE message coordinator initialized successfully in ${initTime}ms`);
          reportInitializationSuccess(initTime);
        } catch (error) {
          await handleInitializationError(error);
        }
      }
      async function registerWithCoordinator() {
        try {
          console.log("\u{1F517} Registering content-bundle handlers with existing coordinator...");
          await initializeErrorBoundary();
          await initializePerformanceMonitoring();
          await waitForDOMReady();
          await initializeCoreSystems();
          await registerMessageHandlers();
          initialized = true;
          extensionReady = true;
          console.log("\u2705 Content-bundle registered with coordinator successfully");
        } catch (error) {
          console.error("\u274C Failed to register with coordinator:", error);
        }
      }
      async function setupCentralizedMessageListener() {
        if (!chrome.runtime.onMessage) {
          throw new Error("Chrome runtime message API not available");
        }
        if (window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED) {
          console.log("\u26A0\uFE0F Message listener already registered, skipping duplicate setup");
          return;
        }
        console.log("\u{1F3AF} Setting up centralized message listener...");
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          console.log("\u{1F4E8} Centralized message received:", {
            action: message.action || message.type,
            sender: sender.tab ? "tab" : "extension",
            url: window.location.href
          });
          handleCentralizedMessage(message, sender, sendResponse);
          return true;
        });
        window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED = true;
        console.log("\u2705 Centralized message listener set up successfully");
      }
      async function registerMessageHandlers() {
        console.log("\u{1F517} Registering content-bundle message handlers...");
        const handlers = {
          "ping": handlePing,
          "check_orchestrator_status": handleCheckOrchestratorStatus,
          "getPageStatus": handleGetPageStatus,
          "quickScan": handleQuickScan,
          "advancedScan": handleAdvancedScan,
          "enhancedGalleryDetection": handleEnhancedGalleryDetection,
          "detectTables": handleDetectTables,
          "sitePatternAnalysis": handleSitePatternAnalysis,
          "lazyImageDetection": handleLazyImageDetection,
          "toggleSelector": handleToggleSelector,
          "testSelector": handleTestSelector,
          // Pagination bridge: request explicit next action
          "performPaginationStep": handlePerformPaginationStep,
          // Install network interceptor in page context and bridge via DOM
          "installNetworkInterceptor": handleInstallNetworkInterceptor,
          "clearHighlights": handleClearHighlights
        };
        for (const [messageType2, handler] of Object.entries(handlers)) {
          window.registerStepThreeMessageHandler(messageType2, handler, "content-bundle", 1);
        }
        console.log(`\u2705 Registered ${Object.keys(handlers).length} message handlers from content-bundle`);
      }
      // Perform an explicit pagination step: click next, load more, or scroll
      async function handlePerformPaginationStep(message, sendResponse) {
        try {
          const options = message.payload?.options || {};
          if (options.installIntercept) {
            installNetworkInterceptorBridge();
          }
          const detector = window.PaginationDetector ? new window.PaginationDetector() : null;
          if (!detector) {
            sendResponse({ success: false, error: 'PaginationDetector unavailable' });
            return;
          }

          // If a custom next selector is provided, try it first
          const customSelector = (options.nextSelector || '').trim();
          if (customSelector) {
            try {
              let el = null;
              
              // Support XPath selectors (xpath://...)
              if (customSelector.startsWith('xpath:')) {
                const xpathExpression = customSelector.substring(6);
                const result = document.evaluate(
                  xpathExpression,
                  document,
                  null,
                  XPathResult.FIRST_ORDERED_NODE_TYPE,
                  null
                );
                el = result.singleNodeValue;
              } else {
                // Regular CSS selector
                el = document.querySelector(customSelector);
              }
              if (el) {
                const url = (typeof detector.getElementUrl === 'function') ? detector.getElementUrl(el) : (el.href || null);
                if (url && url !== 'null' && typeof url === 'string') {
                  window.location.href = url;
                  sendResponse({ success: true, type: 'navigate', url, selector: customSelector });
                  return;
                } else {
                  // Use trusted click for SPA navigation
                  try {
                    // Generate stable selector
                    let stableSelector = customSelector;
                    if (el.id) stableSelector = `#${el.id}`;
                    else if (el.getAttribute('data-testid')) stableSelector = `[data-testid="${el.getAttribute('data-testid')}"]`;
                    
                    const response = await chrome.runtime.sendMessage({
                      action: 'EXECUTE_TRUSTED_CLICK',
                      selector: stableSelector,
                      source: 'handleNextPage'
                    });
                    
                    if (!response || !response.success) {
                      console.warn('Trusted click failed, using fallback');
                      el.click();
                    }
                  } catch (e) {
                    console.warn('Trusted click error, using fallback:', e);
                    el.click();
                  }
                  
                  if (typeof detector.waitForNewContent === 'function') {
                    await detector.waitForNewContent();
                  }
                  sendResponse({ success: true, type: 'click-only', selector: customSelector });
                  return;
                }
              }
            } catch (_) {
              // ignore and fall back to auto-detection
            }
          }

          // First try DOM-based next
          const nextInfo = detector.findNextPage();
          if (nextInfo && nextInfo.isLoadMore) {
            // Load more - use trusted click
            const before = document.body.scrollHeight;
            try {
              const response = await chrome.runtime.sendMessage({
                action: 'EXECUTE_TRUSTED_CLICK',
                selector: customSelector || 'button', // fallback selector
                source: 'loadMore'
              });
              if (!response || !response.success) {
                nextInfo.element.click();
              }
            } catch (e) {
              nextInfo.element.click();
            }
            await detector.waitForNewContent();
            sendResponse({ success: true, type: 'load-more' });
            return;
          }
          if (nextInfo && nextInfo.url && nextInfo.url !== 'null') {
            // Navigate by URL
            window.location.href = nextInfo.url;
            sendResponse({ success: true, type: 'navigate', url: nextInfo.url });
            return;
          }
          // Support SPA-style next elements without direct href - use trusted click
          if (nextInfo && nextInfo.element) {
            try {
              const response = await chrome.runtime.sendMessage({
                action: 'EXECUTE_TRUSTED_CLICK',
                selector: customSelector || nextInfo.element.tagName.toLowerCase(),
                source: 'spaNavigation'
              });
              if (!response || !response.success) {
                nextInfo.element.click();
              }
            } catch (e) {
              nextInfo.element.click();
            }
            await detector.waitForNewContent();
            sendResponse({ success: true, type: 'click-only' });
            return;
          }

          // Fallback to infinite scroll step
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          const grew = await detector.waitForNewContent();
          if (grew) {
            sendResponse({ success: true, type: 'scroll' });
            return;
          }

          sendResponse({ success: false, error: 'No pagination action available' });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      }

      // Inject page-context script to intercept fetch/XHR and bridge via hidden element
      function installNetworkInterceptorBridge() {
        try {
          const bridgeId = '__st_network_bridge';
          let bridge = document.getElementById(bridgeId);
          if (!bridge) {
            bridge = document.createElement('div');
            bridge.id = bridgeId;
            bridge.style.display = 'none';
            document.documentElement.appendChild(bridge);
          }

          if (!window.__ST_BRIDGE_OBSERVER_INSTALLED) {
            const observer = new MutationObserver((mutations) => {
              for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'data-payload') {
                  try {
                    const payload = bridge.getAttribute('data-payload');
                    if (payload) {
                      const data = JSON.parse(payload);
                      chrome.runtime.sendMessage({
                        type: 'PAGINATION_PROGRESS',
                        payload: { intercept: true, data }
                      }).catch(() => {});
                    }
                  } catch (_) {}
                }
              }
            });
            observer.observe(bridge, { attributes: true, attributeFilter: ['data-payload'] });
            window.__ST_BRIDGE_OBSERVER_INSTALLED = true;
          }

          if (!window.__ST_NETWORK_INTERCEPT_INSTALLED) {
            const code = `(() => {\
              try {\
                if (window.__stNetworkInterceptorInstalled) return;\
                window.__stNetworkInterceptorInstalled = true;\
                const bridgeId = '${'__st_network_bridge'}';\
                const publish = (data) => {\
                  try {\
                    const el = document.getElementById(bridgeId);\
                    if (el) { el.setAttribute('data-payload', JSON.stringify({ ts: Date.now(), ...data })); }\
                  } catch (e) {}\
                };\
                // fetch interception\
                const ofetch = window.fetch;\
                if (ofetch) {\
                  window.fetch = async function(...args) {\
                    const req = args[0];\
                    const url = (typeof req === 'string') ? req : (req && req.url) || '';\
                    const method = (typeof req === 'object' && req && req.method) ? req.method : ((args[1] && args[1].method) || 'GET');\
                    const res = await ofetch.apply(this, args);\
                    try {\
                      const clone = res.clone();\
                      const ct = clone.headers && clone.headers.get ? clone.headers.get('content-type') : '';\
                      let bodyText = '';\\
                      if (ct && ct.indexOf('application/json') !== -1) { bodyText = await clone.text(); }\
                      publish({ kind: 'fetch', url, method, status: res.status, body: bodyText });\
                    } catch (e) {}\
                    return res;\
                  };\
                }\
                // XHR interception\
                if (window.XMLHttpRequest) {\
                  const oOpen = XMLHttpRequest.prototype.open;\
                  const oSend = XMLHttpRequest.prototype.send;\
                  XMLHttpRequest.prototype.open = function(method, url) {\
                    this.__st = { method, url };\
                    return oOpen.apply(this, arguments);\
                  };\
                  XMLHttpRequest.prototype.send = function(body) {\
                    this.addEventListener('load', function() {\
                      try {\
                        publish({ kind: 'xhr', url: (this.__st && this.__st.url) || '', method: (this.__st && this.__st.method) || '', status: this.status, body: this.responseText });\
                      } catch (e) {}\
                    });\
                    return oSend.apply(this, arguments);\
                  };\
                }\
              } catch (e) { /* swallow */ }\
            })();`;
            const s = document.createElement('script');
            s.textContent = code;
            (document.head || document.documentElement).appendChild(s);
            s.parentNode && s.parentNode.removeChild(s);
            window.__ST_NETWORK_INTERCEPT_INSTALLED = true;
          }
        } catch (error) {
          console.warn('Failed to install network interceptor bridge:', error);
        }
      }

      async function handleInstallNetworkInterceptor(_message, sendResponse) {
        try {
          installNetworkInterceptorBridge();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      }
      async function handleCentralizedMessage(message, sender, sendResponse) {
        const startTime = Date.now();
        // Ensure messageType2 is always defined for logging in all code paths
        let messageType2 = "unknown";
        try {
          if (!coordinator.ready) {
            console.warn("\u26A0\uFE0F Message coordinator not ready, rejecting message:", message);
            sendResponse({ success: false, error: "Coordinator not ready" });
            return;
          }
          const { action, type } = message || {};
          messageType2 = type || action || "unknown";
          console.log(`\u{1F3AF} Routing message: ${messageType2}`);
          const handlerInfo = findFrameAwareHandler(messageType2);
          if (handlerInfo && handlerInfo.handler) {
            console.log(`\u{1F4CB} Using handler from: ${handlerInfo.source}`);
            if (errorBoundary && typeof errorBoundary.safeExecute === "function") {
              await errorBoundary.safeExecute("message_handling", async () => {
                return await handlerInfo.handler(message, sendResponse);
              }, {
                operationName: "message_handling",
                checkDOMSize: false,
                maxExecutionTime: 3e4
                // 30 seconds for complex operations
              }).catch((error) => {
                console.error(`\u274C Message handling failed for ${messageType2}:`, error);
                sendResponse({
                  success: false,
                  error: error.message,
                  messageType: messageType2,
                  fallback: true
                });
              });
            } else {
              try {
                await handlerInfo.handler(message, sendResponse);
              } catch (error) {
                console.error(`\u274C Message handling failed for ${messageType2}:`, error);
                sendResponse({ success: false, error: error.message, messageType: messageType2 });
              }
            }
          } else {
            console.log(`\u2753 No handler found for message type: ${messageType2}`);
            // Skip responding to element picker messages - let the simple handler at the end of file handle them
            if (messageType2 === 'start_element_picker' || messageType2 === 'stop_element_picker') {
              console.log(`\u{1F504} Skipping centralized response for ${messageType2} - will be handled by simple handler`);
              return; // Don't call sendResponse, let other listeners handle it
            }
            sendResponse({
              success: false,
              error: `No handler registered for message type: ${messageType2}`,
              messageType: messageType2
            });
          }
        } catch (error) {
          console.error("\u274C Centralized message routing error:", error);
          sendResponse({ success: false, error: error.message });
        } finally {
          const duration = Date.now() - startTime;
          const mt = (message && (message.type || message.action)) || messageType2 || 'unknown';
          console.log(`\u23F1\uFE0F Message routing completed in ${duration}ms for: ${mt}`);
        }
      }
      window.registerStepThreeMessageHandler = function(messageType2, handler, source = "unknown", priority = 0) {
        const frameAwareKey = `${messageType2}@${coordinator.frameId}@${source}`;
        if (!coordinator.initialized || !coordinator.messageHandlers) {
          console.log(`\u{1F4EC} Coordinator not ready, queueing handler for '${messageType2}' from ${source} [${coordinator.frameId}]`);
          coordinator.queuedHandlers.push({
            messageType: messageType2,
            frameAwareKey,
            handler,
            source,
            priority,
            timestamp: Date.now()
          });
          console.log(`\u2705 Queued handler for '${messageType2}' from ${source} (${coordinator.queuedHandlers.length} in queue)`);
          return true;
        }
        coordinator.messageHandlers.set(frameAwareKey, {
          messageType: messageType2,
          // Store original message type for routing
          handler,
          source,
          priority,
          frameId: coordinator.frameId
        });
        console.log(`\u2705 Registered handler for '${messageType2}' from ${source} [${coordinator.frameId}]`);
        return true;
      };
      function processQueuedHandlers() {
        if (coordinator.queuedHandlers.length === 0) {
          console.log("\u{1F4CB} No queued handlers to process");
          return;
        }
        console.log(`\u{1F504} Processing ${coordinator.queuedHandlers.length} queued handler registrations...`);
        let successCount = 0;
        let failCount = 0;
        while (coordinator.queuedHandlers.length > 0) {
          const queuedHandler = coordinator.queuedHandlers.shift();
          try {
            const handlerKey = queuedHandler.frameAwareKey || queuedHandler.messageType;
            coordinator.messageHandlers.set(handlerKey, {
              messageType: queuedHandler.messageType,
              // Store original message type for routing
              handler: queuedHandler.handler,
              source: queuedHandler.source,
              priority: queuedHandler.priority,
              frameId: coordinator.frameId
            });
            console.log(`\u2705 Processed queued handler for '${queuedHandler.messageType}' from ${queuedHandler.source} [${coordinator.frameId}]`);
            successCount++;
          } catch (error) {
            console.error(`\u274C Failed to process queued handler for '${queuedHandler.messageType}':`, error);
            failCount++;
          }
        }
        console.log(`\u{1F4CA} Queue processing complete: ${successCount} successful, ${failCount} failed`);
      }
      function findFrameAwareHandler(messageType2) {
        const currentFrameId = coordinator.frameId;
        for (const [handlerKey, handlerInfo] of coordinator.messageHandlers) {
          if (handlerInfo.messageType === messageType2 && handlerInfo.frameId === currentFrameId) {
            console.log(`\u{1F3AF} Found frame-specific handler: ${handlerKey}`);
            return handlerInfo;
          }
        }
        for (const [handlerKey, handlerInfo] of coordinator.messageHandlers) {
          if (handlerInfo.messageType === messageType2 || handlerKey === messageType2) {
            console.log(`\u{1F504} Found compatible handler: ${handlerKey}`);
            return handlerInfo;
          }
        }
        const directHandler = coordinator.messageHandlers.get(messageType2);
        if (directHandler) {
          console.log(`\u{1F4CE} Found legacy handler: ${messageType2}`);
          return directHandler;
        }
        console.log(`\u2753 No handler found for message type: ${messageType2} in frame: ${currentFrameId}`);
        return null;
      }
      async function handlePing(message, sendResponse) {
        sendResponse({ success: true, ready: extensionReady, coordinator: coordinator.ready });
      }
      async function handleCheckOrchestratorStatus(sendResponse) {
        try {
          const components = {
            errorHandler: typeof window.StepThreeErrorHandler !== "undefined",
            validator: typeof window.inputValidator !== "undefined",
            selectorUtils: typeof window.StepThreeSelectorUtils !== "undefined",
            robustHelpers: typeof window.RobustHelpers !== "undefined",
            advancedCollector: typeof window.AdvancedCollectorSystem !== "undefined",
            smartSelector: typeof window.EnhancedSmartSelectorSystem !== "undefined"
          };
          const criticalComponents = ["errorHandler", "validator", "selectorUtils"];
          const missingCritical = criticalComponents.filter((comp) => !components[comp]);
          const available = missingCritical.length === 0;
          const ready = available && extensionReady && initialized;
          const selfTestResult = await performOrchestratorSelfTest();
          const status = {
            available: available && selfTestResult.passed,
            ready: ready && selfTestResult.passed,
            initialized,
            url: window.location.href,
            timestamp: Date.now(),
            components,
            criticalComponents: {
              required: criticalComponents,
              missing: missingCritical,
              allPresent: missingCritical.length === 0
            },
            selfTest: selfTestResult,
            readyReason: available ? ready ? "All systems operational" : "Components loaded but not ready" : `Missing critical components: ${missingCritical.join(", ")}`
          };
          console.log(available ? "\u2705 Orchestrator status check - AVAILABLE:" : "\u274C Orchestrator status check - NOT AVAILABLE:", status);
          sendResponse({ success: true, status });
        } catch (error) {
          console.error("\u274C Orchestrator status check failed:", error);
          sendResponse({
            success: false,
            error: error.message,
            status: {
              available: false,
              ready: false,
              error: error.message,
              timestamp: Date.now()
            }
          });
        }
      }
      async function performOrchestratorSelfTest() {
        const testResults = {
          passed: true,
          tests: {},
          errors: []
        };
        try {
          testResults.tests.chromeRuntime = {
            passed: typeof chrome !== "undefined" && chrome.runtime,
            description: "Chrome runtime API available"
          };
          if (!testResults.tests.chromeRuntime.passed) {
            testResults.errors.push("Chrome runtime API not available");
            testResults.passed = false;
          }
          testResults.tests.domApis = {
            passed: typeof document !== "undefined" && typeof document.querySelectorAll === "function",
            description: "Essential DOM APIs available"
          };
          if (!testResults.tests.domApis.passed) {
            testResults.errors.push("Essential DOM APIs not available");
            testResults.passed = false;
          }
          testResults.tests.errorHandler = {
            passed: typeof window.StepThreeErrorHandler !== "undefined" && window.StepThreeErrorHandler.initialized,
            description: "Error handling system functional"
          };
          if (!testResults.tests.errorHandler.passed) {
            testResults.errors.push("Error handling system not functional");
            testResults.passed = false;
          }
          try {
            const testElement = document.createElement("div");
            const testResult = testElement.tagName === "DIV";
            testResults.tests.basicSelectors = {
              passed: testResult,
              description: "Basic element selection functional"
            };
            if (!testResult) {
              testResults.errors.push("Basic element selection not working");
              testResults.passed = false;
            }
          } catch (error) {
            testResults.tests.basicSelectors = {
              passed: false,
              description: "Basic element selection functional"
            };
            testResults.errors.push(`Basic element selection failed: ${error.message}`);
            testResults.passed = false;
          }
          testResults.timestamp = Date.now();
          testResults.summary = testResults.passed ? "All self-tests passed" : `${testResults.errors.length} test(s) failed`;
          console.log(testResults.passed ? "\u2705 Orchestrator self-test PASSED" : "\u274C Orchestrator self-test FAILED:", testResults);
          return testResults;
        } catch (error) {
          console.error("\u274C Self-test execution failed:", error);
          return {
            passed: false,
            tests: {},
            errors: [`Self-test execution failed: ${error.message}`],
            timestamp: Date.now(),
            summary: "Self-test execution failed"
          };
        }
      }
      async function handleGetPageStatus(sendResponse) {
        try {
          const images = document.querySelectorAll("img");
          const galleryDetected = detectSimpleGallery();
          sendResponse({
            success: true,
            itemCount: images.length,
            pageStatus: galleryDetected ? "Gallery detected" : "Ready to scan",
            isGalleryPage: galleryDetected,
            url: window.location.href
          });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      }
      
      /**
       * PaginationDetector - Intelligent pagination detection for auto-pagination
       * Detects various types of pagination: next buttons, numbered pages, infinite scroll
       */
      class PaginationDetector {
        constructor() {
          this.nextPagePatterns = {
            textPatterns: [
              /next\s*(page)?/i,
              /siguiente/i, /suivant/i, /weiter/i,
              /次へ|次のページ/i, /다음/i, /下一页|下一頁/i,
              /próxima/i, /volgende/i, /nästa/i, /følgende/i,
              /→|›|»|⟩|⇨|➔|➜|➡/,
            ],
            classIdPatterns: [
              /next/i, /pagination.*next/i, /nav.*next/i,
              /forward/i, /arrow.*right/i, /chevron.*right/i,
            ],
            relPatterns: ['next', 'nofollow next'],
            ariaPatterns: [/next/i, /go to next/i, /navigate to next/i],
          };
          
          this.paginationSelectors = [
            '.pagination', '.pager', '.page-navigation', '.nav-links',
            '[role="navigation"]', 'nav', '.paginator', '.page-numbers',
            '.wp-pagenavi', '.pagination-wrapper',
          ];
          
          this.infiniteScrollPatterns = [
            'load more', 'show more', 'see more', 'view more',
            'cargar más', 'charger plus', 'mehr laden',
            'もっと見る', '더 보기', '加载更多',
          ];
        }

        findNextPage() {
          const methods = [
            () => this.findByRelAttribute(),
            () => this.findByUrlParameters(),
            () => this.findByTextContent(),
            () => this.findByClassId(),
            () => this.findByAriaLabel(),
            () => this.findByXPathDeepText(),
            () => this.findNumberedPagination(),
            () => this.findInfiniteScrollButton(),
          ];
          for (const method of methods) {
            const result = method();
            if (result) return result;
          }
          return null;
        }

        findByRelAttribute() {
          for (const relValue of this.nextPagePatterns.relPatterns) {
            const link = document.querySelector(`a[rel="${relValue}"], link[rel="${relValue}"]`);
            if (link && this.isValidNextPageElement(link)) {
              return { element: link, url: link.href, type: 'rel-attribute', confidence: 1.0 };
            }
          }
          return null;
        }

        // URL parameter based pagination (?page=, ?offset= + limit)
        findByUrlParameters() {
          try {
            const url = new URL(window.location.href);
            const params = url.searchParams;
            const pageKeys = ['page', 'p', 'pg', 'pageno', 'pageNumber'];
            for (const key of pageKeys) {
              const val = params.get(key);
              const current = val !== null ? parseInt(val, 10) : NaN;
              if (!Number.isNaN(current)) {
                params.set(key, String(current + 1));
                const nextUrl = `${url.origin}${url.pathname}?${params.toString()}${url.hash}`;
                return { element: null, url: nextUrl, type: 'url-parameter', confidence: 0.98 };
              }
            }
            const offsetKey = ['offset', 'start', 'skip'].find(k => params.has(k));
            if (offsetKey) {
              const currentOffset = parseInt(params.get(offsetKey) || '0', 10);
              const limitKey = ['limit', 'per_page', 'size', 'count'].find(k => params.has(k));
              const step = parseInt((limitKey && params.get(limitKey)) || '0', 10) || 20;
              params.set(offsetKey, String(currentOffset + step));
              const nextUrl = `${url.origin}${url.pathname}?${params.toString()}${url.hash}`;
              return { element: null, url: nextUrl, type: 'url-parameter', confidence: 0.95 };
            }
            return null;
          } catch (_) {
            return null;
          }
        }

        findByTextContent() {
          const links = Array.from(document.querySelectorAll('a[href], button[onclick], button[data-href], button, a'));
          for (const link of links) {
            const text = this.getElementText(link);
            for (const pattern of this.nextPagePatterns.textPatterns) {
              if (pattern.test(text)) {
                const url = this.getElementUrl(link);
                if (this.isValidNextPageElement(link)) {
                  return { element: link, url: url || null, type: 'text-content', confidence: 0.9, clickOnly: !url };
                }
              }
            }
          }
          return null;
        }

        findByClassId() {
          for (const pattern of this.nextPagePatterns.classIdPatterns) {
            const elements = Array.from(document.querySelectorAll('a[href], button[onclick], button[data-href], button, a'));
            for (const element of elements) {
              const classId = `${element.className} ${element.id}`;
              if (pattern.test(classId)) {
                const url = this.getElementUrl(element);
                if (this.isValidNextPageElement(element)) {
                  return { element: element, url: url || null, type: 'class-id', confidence: 0.8, clickOnly: !url };
                }
              }
            }
          }
          return null;
        }

        findByAriaLabel() {
          const elements = Array.from(document.querySelectorAll('[aria-label], [aria-labelledby]'));
          for (const element of elements) {
            const ariaLabel = element.getAttribute('aria-label') || '';
            const ariaLabelledBy = element.getAttribute('aria-labelledby');
            let labelText = ariaLabel;
            if (ariaLabelledBy) {
              const labelElement = document.getElementById(ariaLabelledBy);
              labelText += ' ' + (labelElement ? labelElement.textContent : '');
            }
            for (const pattern of this.nextPagePatterns.ariaPatterns) {
              if (pattern.test(labelText)) {
                const url = this.getElementUrl(element);
                if (this.isValidNextPageElement(element)) {
                  return { element: element, url: url || null, type: 'aria-label', confidence: 0.85, clickOnly: !url };
                }
              }
            }
          }
          return null;
        }

        // XPath deep text matching for robust Next detection
        findByXPathDeepText() {
          try {
            const xpaths = [
              "//a[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'next') and @href]",
              "//button[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'next')]",
              "//a[.='›' or .='»' or .='→' or .='⟩']",
            ];
            for (const xp of xpaths) {
              const it = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
              let node = it.iterateNext();
              while (node) {
                const url = this.getElementUrl(node);
                if (url && this.isValidNextPageElement(node)) {
                  return { element: node, url, type: 'xpath-text', confidence: 0.85 };
                }
                node = it.iterateNext();
              }
            }
          } catch (_) {}
          return null;
        }

        findNumberedPagination() {
          for (const selector of this.paginationSelectors) {
            const container = document.querySelector(selector);
            if (!container) continue;
            const links = Array.from(container.querySelectorAll('a[href]'));
            const currentPageIndex = links.findIndex(link => {
              return link.classList.contains('current') ||
                     link.classList.contains('active') ||
                     link.getAttribute('aria-current') === 'page' ||
                     link.hasAttribute('disabled');
            });
            if (currentPageIndex >= 0 && currentPageIndex < links.length - 1) {
              const nextLink = links[currentPageIndex + 1];
              const nextText = this.getElementText(nextLink);
              if (/^\d+$/.test(nextText) || /next|›|→|»/i.test(nextText)) {
                return { element: nextLink, url: nextLink.href, type: 'numbered-pagination', confidence: 0.95 };
              }
            }
          }
          return null;
        }

        findInfiniteScrollButton() {
          const buttons = Array.from(document.querySelectorAll('button, a[href], [role="button"]'));
          for (const button of buttons) {
            const text = this.getElementText(button).toLowerCase();
            for (const pattern of this.infiniteScrollPatterns) {
              if (text.includes(pattern.toLowerCase())) {
                const url = this.getElementUrl(button);
                return { element: button, url: url || window.location.href, type: 'infinite-scroll', confidence: 0.7, isLoadMore: true };
              }
            }
          }
          return null;
        }

        getElementText(element) {
          if (!element) return '';
          let text = element.textContent || element.innerText || '';
          text += ' ' + (element.getAttribute('title') || '');
          text += ' ' + (element.getAttribute('alt') || '');
          text += ' ' + (element.getAttribute('value') || '');
          return text.trim();
        }

        getElementUrl(element) {
          if (!element) return null;
          if (element.href) return element.href;
          const dataHref = element.getAttribute('data-href') ||
                          element.getAttribute('data-url') ||
                          element.getAttribute('data-link');
          if (dataHref) return dataHref;
          const onclick = element.getAttribute('onclick');
          if (onclick) {
            const urlMatch = onclick.match(/(?:location\.href|window\.location)\s*=\s*['"]([^'"]+)['"]/);
            if (urlMatch) return urlMatch[1];
          }
          return null;
        }

        isValidNextPageElement(element) {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          // Disallow non-interactive via pointer-events
          if (style.pointerEvents === 'none') return false;
          if (rect.width === 0 && rect.height === 0) return false;
          // Respect ARIA/state-disabled
          if (element.disabled || element.getAttribute('disabled') === 'true' || element.getAttribute('aria-disabled') === 'true') return false;
          return true;
        }

        async navigateToNextPage(nextPageInfo) {
          if (!nextPageInfo || !nextPageInfo.element) return false;
          try {
            const element = nextPageInfo.element;
            if (nextPageInfo.isLoadMore) {
              // Use trusted click for SPAs (Layer 3 fix)
              await this.performTrustedClick(element);
              await this.waitForNewContent();
              return true;
            }
            // Only navigate if URL is a valid non-null string
            if (nextPageInfo.url && typeof nextPageInfo.url === 'string' && nextPageInfo.url !== 'null') {
              window.location.href = nextPageInfo.url;
              return true;
            }
            // Fallback: clickable next element without direct URL (SPA)
            // Use trusted click for better reliability on modern SPAs
            await this.performTrustedClick(element);
            await this.waitForNewContent();
            return true;
          } catch (error) {
            console.error('Error navigating to next page:', error);
            return false;
          }
        }
        
        async performTrustedClick(element) {
          // Layer 3 Solution: Use Main World injection for trusted clicks on SPAs
          // Generates a selector for the element and requests background script to execute
          // the click in the page's Main World context (trusted event)
          try {
            // Generate best possible selector for the element
            let selector = null;
            
            // Try using EnhancedCSSSelector if available
            if (window.EnhancedCSSSelector) {
              try {
                const enhancedSelector = new window.EnhancedCSSSelector();
                selector = enhancedSelector.generateStableSelector(element);
              } catch (e) {
                console.warn('EnhancedCSSSelector failed, using fallback');
              }
            }
            
            // Fallback: generate simple but stable selector
            if (!selector) {
              if (element.id) {
                selector = `#${element.id}`;
              } else if (element.getAttribute('data-testid')) {
                selector = `[data-testid="${element.getAttribute('data-testid')}"]`;
              } else if (element.className && typeof element.className === 'string') {
                const classes = element.className.split(' ').filter(c => c.trim());
                if (classes.length > 0) {
                  selector = element.tagName.toLowerCase() + '.' + classes.join('.');
                }
              } else {
                selector = element.tagName.toLowerCase();
              }
            }
            
            // Request trusted click from background script
            const response = await chrome.runtime.sendMessage({
              action: 'EXECUTE_TRUSTED_CLICK',
              selector: selector,
              source: 'pagination'
            });
            
            if (response && response.success) {
              console.log('✅ Trusted click executed successfully:', response.message);
              return true;
            } else {
              console.warn('⚠️ Trusted click failed, falling back to direct click:', response?.error);
              // Fallback to direct click if trusted click fails
              element.click();
              return true;
            }
          } catch (error) {
            console.warn('⚠️ Trusted click error, using direct click fallback:', error);
            // Fallback to direct click
            element.click();
            return true;
          }
        }

        async waitForNewContent(maxWait = 5000) {
          const startTime = Date.now();
          const initialHeight = document.body.scrollHeight;
          return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              const currentHeight = document.body.scrollHeight;
              const elapsed = Date.now() - startTime;
              if (currentHeight > initialHeight) {
                clearInterval(checkInterval);
                resolve(true);
              } else if (elapsed >= maxWait) {
                clearInterval(checkInterval);
                resolve(false);
              }
            }, 100);
          });
        }

        getPaginationInfo() {
          const info = { currentPage: 1, totalPages: null, hasNext: false, hasPrevious: false };
          const currentPageEl = document.querySelector('.current, .active, [aria-current="page"]');
          if (currentPageEl) {
            const pageNum = parseInt(this.getElementText(currentPageEl));
            if (!isNaN(pageNum)) info.currentPage = pageNum;
          }
          const pageLinks = Array.from(document.querySelectorAll('.pagination a, .pager a, .page-numbers a'));
          const pageNumbers = pageLinks.map(link => parseInt(this.getElementText(link))).filter(num => !isNaN(num));
          if (pageNumbers.length > 0) info.totalPages = Math.max(...pageNumbers);
          info.hasNext = !!this.findNextPage();
          info.hasPrevious = !!document.querySelector('a[rel="prev"], .prev, .previous');
          return info;
        }
      }

      // Register PaginationDetector globally
      if (typeof window !== 'undefined') {
        window.PaginationDetector = PaginationDetector;
        if (!window.__ST) window.__ST = {};
        window.__ST.PaginationDetector = PaginationDetector;
        console.log('✅ PaginationDetector embedded in content.js');
      }

      /**
       * PaginationSession - Manages multi-page scanning with auto-pagination
       * Handles next buttons, numbered pages, and infinite scroll
       */
      class PaginationSession {
        constructor(options = {}) {
          this.maxPages = options.maxPages || 10;
          this.paginationDelay = options.paginationDelay || 2000;
          this.collectorOptions = options.collectorOptions || {};
          this.nextSelector = (options.nextSelector && typeof options.nextSelector === 'string')
            ? options.nextSelector.trim()
            : '';
          this.currentPage = 1;
          this.totalImages = [];
          this.visitedUrls = new Set([window.location.href]);
          this.detector = null;
          this.aborted = false;
        }

        /**
         * Start the pagination session and collect images from multiple pages
         */
        async start() {
          try {
            // Check if we're resuming from a previous pagination session
            const savedState = this.loadPaginationState();
            if (savedState) {
              console.log('🔄 Resuming pagination from saved state:', {
                currentPage: savedState.currentPage + 1,
                imagesCollected: savedState.images.length,
                maxPages: savedState.maxPages
              });
              
              // Restore state
              this.totalImages = savedState.images;
              this.currentPage = savedState.currentPage + 1;
              this.maxPages = savedState.maxPages;
              this.paginationDelay = savedState.paginationDelay;
              this.visitedUrls = new Set(savedState.visitedUrls);
              this.collectorOptions = savedState.collectorOptions;
              if (savedState.nextSelector) {
                this.nextSelector = savedState.nextSelector;
              }
              
              // Clear the saved state
              sessionStorage.removeItem('stepthree_pagination_state');
            }
            
            console.log('📄 Starting PaginationSession:', {
              maxPages: this.maxPages,
              paginationDelay: this.paginationDelay,
              currentPage: this.currentPage
            });

            // Initialize PaginationDetector if available
            if (window.PaginationDetector) {
              this.detector = new window.PaginationDetector();
            } else {
              console.warn('⚠️ PaginationDetector not available, pagination disabled');
              return await this.collectCurrentPage();
            }

            // Collect images from current page
            await this.collectCurrentPage();

            // Navigate through additional pages if available
            while (this.currentPage < this.maxPages && !this.aborted) {
              let nextPageInfo = null;

              // Prefer a custom next selector if provided
              if (this.nextSelector) {
                try {
                  const customElement = document.querySelector(this.nextSelector);
                  if (customElement) {
                    const urlFromElement = (typeof this.detector.getElementUrl === 'function')
                      ? this.detector.getElementUrl(customElement)
                      : (customElement.href || null);
                    nextPageInfo = {
                      element: customElement,
                      url: urlFromElement || null,
                      type: 'custom-selector',
                      confidence: 1.0,
                      clickOnly: !urlFromElement
                    };
                  }
                } catch (_) {
                  // ignore custom selector errors and fall back
                }
              }

              // Fall back to automatic detection
              if (!nextPageInfo) {
                nextPageInfo = this.detector.findNextPage();
              }

              // If no explicit next element found, attempt infinite scroll strategy
              if (!nextPageInfo) {
                const maybeInfinite = (typeof this.detector.detectInfiniteScroll === 'function') && this.detector.detectInfiniteScroll();
                if (maybeInfinite) {
                  console.log('🔄 Infinite scroll detected, performing scroll step');
                  const scrolled = await this.handleInfiniteScroll();
                  if (!scrolled) {
                    console.log('✅ Infinite scroll exhausted, pagination complete');
                    break;
                  }
                  // Respect randomized human-like delay between scroll steps
                  await this.randomizedDelay(2000, 5000);
                  continue;
                }
                console.log('✅ No more pages found, pagination complete');
                break;
              }

              console.log(`🔗 Found next page (type: ${nextPageInfo.type}, confidence: ${nextPageInfo.confidence}):`, nextPageInfo.url);

              // Send progress update - navigating
              this.sendProgressUpdate('navigating');

              // Check if this is a "Load More" button (infinite scroll)
              if (nextPageInfo.isLoadMore) {
                await this.handleLoadMore(nextPageInfo);
              } else {
                // Regular navigation - check if we've visited this URL
                // Skip check if URL is null or invalid
                if (nextPageInfo.url && typeof nextPageInfo.url === 'string' && this.visitedUrls.has(nextPageInfo.url)) {
                  console.log('⚠️ Already visited this URL, stopping pagination');
                  break;
                }
                
                // Navigate to next page
                console.log('🔄 Navigating to next page:', nextPageInfo.url);
                
                // Validate URL before proceeding
                if (!nextPageInfo.url || typeof nextPageInfo.url !== 'string' || nextPageInfo.url === 'null') {
                  console.error('❌ Invalid URL for navigation, stopping pagination');
                  break;
                }
                
                this.visitedUrls.add(nextPageInfo.url);
                
                // Store current state before navigation
                const collectedSoFar = this.totalImages.length;
                const pagesScanned = this.currentPage;
                
            // Save pagination state to sessionStorage for continuation after reload
                try {
                  sessionStorage.setItem('stepthree_pagination_state', JSON.stringify({
                    images: this.totalImages,
                    currentPage: this.currentPage,
                    maxPages: this.maxPages,
                    paginationDelay: this.paginationDelay,
                    visitedUrls: Array.from(this.visitedUrls),
                collectorOptions: this.collectorOptions,
                nextSelector: this.nextSelector,
                    continuing: true
                  }));
                } catch (e) {
                  console.warn('Could not save pagination state:', e);
                }
                
                // Navigate to next page (this will reload the page)
                window.location.href = nextPageInfo.url;
                
                // Execution stops here as page will reload
                return {
                  success: true,
                  images: this.totalImages,
                  pagesScanned: this.currentPage,
                  totalFound: this.totalImages.length,
                  navigating: true
                };
              }

              // Respect randomized human-like delay
              await this.randomizedDelay(Math.max(1500, this.paginationDelay - 500), this.paginationDelay + 2500);
            }

            // Send final completion update
            this.sendProgressUpdate('complete');

            return {
              success: true,
              images: this.totalImages,
              pagesScanned: this.currentPage,
              totalFound: this.totalImages.length
            };

          } catch (error) {
            console.error('❌ PaginationSession error:', error);
            this.sendProgressUpdate('complete'); // Send completion even on error
            return {
              success: false,
              error: error.message,
              images: this.totalImages, // Return what we collected so far
              pagesScanned: this.currentPage,
              totalFound: this.totalImages.length
            };
          }
        }

        /**
         * Collect images from the current page
         */
        async collectCurrentPage() {
          try {
            console.log(`📸 Scanning page ${this.currentPage}...`);
            
            // Send progress update - scanning
            this.sendProgressUpdate('scanning');

            // Use AdvancedCollectorSystem if available
            if (window.AdvancedCollectorSystem) {
              const collector = new window.AdvancedCollectorSystem({
                concurrency: 3,
                timeout: 15000,
                maxPages: 1,
                ...this.collectorOptions
              });

              const results = await collector.collectImages();
              const images = results.images || [];
              
              console.log(`✅ Page ${this.currentPage}: Found ${images.length} images`);
              
              // Add to total collection
              this.totalImages = this.totalImages.concat(images);
              
              return images;
            } else {
              // Fallback: simple image collection
              const images = Array.from(document.querySelectorAll('img'))
                .map(img => ({
                  url: img.src,
                  alt: img.alt,
                  dimensions: {
                    width: img.width,
                    height: img.height
                  }
                }))
                .filter(img => img.url);
              
              console.log(`✅ Page ${this.currentPage}: Found ${images.length} images (fallback)`);
              
              this.totalImages = this.totalImages.concat(images);
              
              return images;
            }
          } catch (error) {
            console.error(`❌ Error collecting images from page ${this.currentPage}:`, error);
            return [];
          }
        }

        /**
         * Handle "Load More" button (infinite scroll)
         */
        async handleLoadMore(nextPageInfo) {
          try {
            const beforeHeight = document.body.scrollHeight;
            const beforeImageCount = this.totalImages.length;

            // Click the load more button
            nextPageInfo.element.click();
            console.log('🖱️ Clicked "Load More" button');

            // Wait for content to load
            await this.waitForNewContent(beforeHeight);

            // Increment page counter
            this.currentPage++;
            this.visitedUrls.add(window.location.href);

            // Collect new images
            const newImages = await this.collectCurrentPage();
            
            // Check if we actually got new images
            const actualNewImages = this.totalImages.length - beforeImageCount;
            if (actualNewImages === 0) {
              console.log('⚠️ No new images loaded, stopping pagination');
              this.aborted = true;
            }

          } catch (error) {
            console.error('❌ Error handling load more:', error);
            this.aborted = true;
          }
        }

        /**
         * Perform one infinite scroll step until new content loads or timeout
         * Increments currentPage on success and collects newly loaded images
         */
        async handleInfiniteScroll() {
          try {
            const beforeHeight = document.body.scrollHeight;
            const beforeCount = this.totalImages.length;

            // Scroll to bottom to trigger lazy loading
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            // Wait for new content via MutationObserver + height growth
            const loaded = await this.waitForNewContent(beforeHeight, 7000);
            if (!loaded) {
              return false;
            }

            // Increment logical page and collect
            this.currentPage++;
            const _ = await this.collectCurrentPage();

            const gained = this.totalImages.length - beforeCount;
            if (gained <= 0) {
              // No new items despite height change, treat as exhausted
              return false;
            }
            return true;
          } catch (err) {
            console.error('❌ Infinite scroll step failed:', err);
            return false;
          }
        }

        /**
         * Wait for new content to load after clicking "Load More"
         */
        async waitForNewContent(beforeHeight, maxWait = 5000) {
          const start = Date.now();
          return new Promise((resolve) => {
            let settled = false;
            let observer = null;
            const done = (result) => {
              if (settled) return;
              settled = true;
              if (observer) observer.disconnect();
              clearInterval(poller);
              clearTimeout(timer);
              resolve(result);
            };

            try {
              observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                  if (m.addedNodes && m.addedNodes.length > 0) {
                    done(true);
                    break;
                  }
                }
              });
              observer.observe(document.body, { childList: true, subtree: true });
            } catch (_) {}

            const poller = setInterval(() => {
              if (document.body.scrollHeight > beforeHeight) {
                done(true);
              }
            }, 120);

            const timer = setTimeout(() => done(false), maxWait);
          });
        }

        /**
         * Randomized human-like delay helper
         */
        randomizedDelay(minMs, maxMs) {
          const delta = Math.max(0, maxMs - minMs);
          const wait = minMs + Math.floor(Math.random() * (delta + 1));
          return this.delay(wait);
        }

        /**
         * Send progress update to background script
         */
        sendProgressUpdate(status) {
          try {
            const paginationInfo = this.detector ? this.detector.getPaginationInfo() : null;
            
            chrome.runtime.sendMessage({
              type: 'PAGINATION_PROGRESS',
              payload: {
                currentPage: this.currentPage,
                totalPages: paginationInfo?.totalPages || null,
                imagesCollected: this.totalImages.length,
                status: status // 'scanning' | 'navigating' | 'complete'
              }
            }).catch(err => {
              // Ignore errors if background script isn't listening
              console.debug('Progress update not received by background:', err.message);
            });
          } catch (error) {
            console.debug('Could not send progress update:', error.message);
          }
        }

        /**
         * Load pagination state from sessionStorage
         */
        loadPaginationState() {
          try {
            const stateStr = sessionStorage.getItem('stepthree_pagination_state');
            if (!stateStr) return null;
            
            const state = JSON.parse(stateStr);
            if (!state.continuing) return null;
            
            return state;
          } catch (e) {
            console.warn('Could not load pagination state:', e);
            return null;
          }
        }

        /**
         * Delay helper
         */
        delay(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Abort the pagination session
         */
        abort() {
          this.aborted = true;
        }
      }
      
      async function handleQuickScan(message, sendResponse) {
        try {
          console.log("\u{1F680} Starting quick scan...");
          
          // Extract settings from either message.settings or message.payload.options
          const settings = message.settings || message.payload?.options || message.options || {};
          
          // Check for auto-pagination settings
          const autoPagination = settings.autoPagination || false;
          const maxPages = settings.maxPages || 1;
          const paginationDelay = settings.paginationDelay || 2000;
          
          // Use PaginationSession if auto-pagination is enabled and maxPages > 1
          if (autoPagination && maxPages > 1) {
            console.log("\u{1F4C4} Auto-pagination enabled, using PaginationSession");
            console.log(`   - Max pages: ${maxPages}`);
            console.log(`   - Pagination delay: ${paginationDelay}ms`);
            
            const paginationSession = new PaginationSession({
              maxPages: maxPages,
              paginationDelay: paginationDelay,
              nextSelector: (settings.nextSelector || '').trim() || undefined,
              collectorOptions: {
                concurrency: 3,
                timeout: 15000,
                ...settings
              }
            });
            
            const paginationResults = await paginationSession.start();
            
            sendResponse({
              success: paginationResults.success,
              itemCount: paginationResults.totalFound || 0,
              items: paginationResults.images || [],
              stats: {
                totalFound: paginationResults.totalFound || 0,
                pagesScanned: paginationResults.pagesScanned || 1,
                pagination: true
              },
              error: paginationResults.error
            });
            
            console.log("\u2705 Pagination scan completed:", {
              images: paginationResults.totalFound || 0,
              pages: paginationResults.pagesScanned || 1
            });
            return;
          }
          
          // Normal single-page scan (original logic)
          if (window.AdvancedCollectorSystem) {
            const collector = new window.AdvancedCollectorSystem({
              concurrency: 3,
              timeout: 15e3,
              maxPages: 1
            });
            const results = await collector.collectImages({
              ...settings,
              maxPages: 1
            });
            sendResponse({
              success: true,
              itemCount: results.images ? results.images.length : 0,
              items: results.images,
              stats: results.metrics
            });
            console.log("\u2705 Quick scan completed:", results.images?.length || 0, "items");
            return;
          }
          const images = Array.from(document.querySelectorAll("img")).map((img) => ({
            url: img.src,
            alt: img.alt,
            dimensions: {
              width: img.width,
              height: img.height
            }
          })).filter((img) => img.url);
          sendResponse({
            success: true,
            itemCount: images.length,
            items: images,
            stats: { totalFound: images.length }
          });
          console.log("\u2705 Quick scan completed (fallback):", images.length, "items");
        } catch (error) {
          console.error("\u274C Quick scan failed:", error);
          sendResponse({ success: false, error: error.message, itemCount: 0 });
        }
      }
      async function handleAdvancedScan(message, sendResponse) {
        try {
          console.log("\u{1F680} Starting advanced scan...");
          // Extract settings from either message.settings or message.payload.options
          const settings = message.settings || message.payload?.options || message.options || {};
          
          if (window.AdvancedCollectorSystem) {
            const collector = new window.AdvancedCollectorSystem({
              concurrency: settings.concurrency || 5,
              timeout: settings.timeout || 3e4,
              maxPages: settings.maxPages || 5
            });
            const results = await collector.collectImages({
              selector: message.selector,
              ...settings
            });
            sendResponse({
              success: true,
              itemCount: results.images ? results.images.length : 0,
              items: results.images,
              stats: results.metrics
            });
            console.log("\u2705 Advanced scan completed:", results.images?.length || 0, "items");
            return;
          }
          const selector = message.selector || "img";
          const elements = document.querySelectorAll(selector);
          const items = Array.from(elements).map((el) => {
            if (el.tagName === "IMG") {
              return {
                url: el.src,
                alt: el.alt,
                dimensions: { width: el.width, height: el.height }
              };
            } else {
              const style = window.getComputedStyle(el);
              const backgroundImage = style.backgroundImage;
              if (backgroundImage && backgroundImage !== "none") {
                const matches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                return matches ? { url: matches[1], source: "background" } : null;
              }
            }
            return null;
          }).filter(Boolean);
          sendResponse({
            success: true,
            itemCount: items.length,
            items,
            stats: { totalFound: items.length }
          });
          console.log("\u2705 Advanced scan completed (fallback):", items.length, "items");
        } catch (error) {
          console.error("\u274C Advanced scan failed:", error);
          sendResponse({ success: false, error: error.message, itemCount: 0 });
        }
      }
      async function handleEnhancedGalleryDetection(message, sendResponse) {
        try {
          console.log("\u{1F50D} Starting enhanced gallery detection...");
          if (window.EnhancedSmartSelectorSystem) {
            const smartSelector = new window.EnhancedSmartSelectorSystem();
            const galleryResults = await smartSelector.findGalleryImages({
              maxImages: message.maxImages || 500,
              minSize: message.minSize || 100
            });
            sendResponse({
              success: true,
              site: galleryResults.site || window.location.hostname,
              galleryImages: galleryResults.images || [],
              totalFound: galleryResults.totalFound || 0,
              validCount: galleryResults.validCount || 0,
              processingTime: galleryResults.processingTime || 0,
              patterns: galleryResults.patterns || [],
              isGalleryPage: (galleryResults.validCount || 0) > 3
            });
            console.log(`\u2705 Enhanced gallery detection completed: ${galleryResults.validCount || 0} valid images found`);
            return;
          }
          const galleryDetected = detectSimpleGallery();
          const images = document.querySelectorAll("img");
          sendResponse({
            success: true,
            site: window.location.hostname,
            galleryImages: Array.from(images).slice(0, 50).map((img) => ({
              url: img.src,
              alt: img.alt
            })),
            totalFound: images.length,
            validCount: images.length,
            processingTime: 10,
            patterns: ["img"],
            isGalleryPage: galleryDetected
          });
          console.log(`\u2705 Enhanced gallery detection completed (fallback): ${images.length} images found`);
        } catch (error) {
          console.error("\u274C Enhanced gallery detection failed:", error);
          sendResponse({
            success: false,
            error: error.message,
            fallback: detectSimpleGallery()
          });
        }
      }
      async function handleDetectTables(message, sendResponse) {
        try {
          console.log("🔍 Starting table detection...");
          
          // Check if EnhancedSmartSelectorSystem is available (which has tableDetectionSystem)
          if (window.EnhancedSmartSelectorSystem) {
            const smartSelector = new window.EnhancedSmartSelectorSystem();
            
            // Wait for table detection system to initialize if needed
            if (smartSelector.tableDetectionSystem) {
              const tables = await smartSelector.tableDetectionSystem.detectTables({
                maxTables: message.maxTables || 10,
                minRows: message.minRows || 2,
                minCols: message.minCols || 2
              });
              
              sendResponse({
                success: true,
                tables: tables || [],
                totalTables: tables ? tables.length : 0,
                message: tables && tables.length > 0 ? `Found ${tables.length} tables` : 'No tables detected'
              });
              console.log(`✅ Table detection completed: ${tables ? tables.length : 0} tables found`);
              return;
            }
          }
          
          // Fallback: simple table detection
          const tables = document.querySelectorAll('table');
          const tableData = Array.from(tables).slice(0, 10).map((table, index) => ({
            index: index,
            rows: table.rows.length,
            element: table.tagName
          }));
          
          sendResponse({
            success: true,
            tables: tableData,
            totalTables: tables.length,
            message: tables.length > 0 ? `Found ${tables.length} tables (fallback)` : 'No tables detected'
          });
          console.log(`✅ Table detection completed (fallback): ${tables.length} tables found`);
        } catch (error) {
          console.error("❌ Table detection failed:", error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      }
      async function handleSitePatternAnalysis(message, sendResponse) {
        try {
          console.log("\u{1F310} Starting site pattern analysis...");
          const siteInfo = {
            currentSite: window.location.hostname,
            detectedPatterns: ["img", "[data-src]", "picture"],
            urlPatterns: {
              hostname: window.location.hostname,
              pathname: window.location.pathname
            },
            galleryContainers: Array.from(document.querySelectorAll(".gallery, .grid, .photos, .images")).length
          };
          const pageAnalysis = {
            url: window.location.href,
            hostname: window.location.hostname,
            title: document.title,
            hasInfiniteScroll: document.querySelector("[data-infinite], .infinite-scroll, .load-more") !== null,
            hasLazyLoading: document.querySelector('[data-src], [loading="lazy"], .lazy') !== null,
            estimatedImageCount: document.querySelectorAll("img, [data-src]").length
          };
          sendResponse({
            success: true,
            siteInfo,
            pageAnalysis
          });
          console.log("\u2705 Site pattern analysis completed for:", siteInfo.currentSite);
        } catch (error) {
          console.error("\u274C Site pattern analysis failed:", error);
          sendResponse({ success: false, error: error.message });
        }
      }
      async function handleLazyImageDetection(message, sendResponse) {
        try {
          console.log("\u{1F441}\uFE0F Starting lazy image detection...");
          const lazyImages = document.querySelectorAll('[data-src], [data-lazy], [loading="lazy"], .lazy, .lazyload');
          const visibleLazyImages = Array.from(lazyImages).filter((img) => {
            const rect = img.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
          });
          sendResponse({
            success: true,
            totalLazyImages: lazyImages.length,
            visibleLazyImages: visibleLazyImages.length,
            patterns: Array.from(new Set(Array.from(lazyImages).map((img) => img.className).filter((c) => c)))
          });
          console.log(`\u2705 Lazy image detection completed: ${lazyImages.length} lazy images found`);
        } catch (error) {
          console.error("\u274C Lazy image detection failed:", error);
          sendResponse({ success: false, error: error.message });
        }
      }
      async function handleToggleSelector(message, sendResponse) {
        try {
          if (window.EnhancedSmartSelectorSystem) {
            const smartSelector = new window.EnhancedSmartSelectorSystem();
            await smartSelector.startSelectionMode();
            sendResponse({ success: true, message: "Smart selector mode activated" });
            return;
          }
          sendResponse({ success: false, error: "Element picker not available" });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      }
      async function handleTestSelector(message, sendResponse) {
        try {
          const { selector } = message;
          if (!selector) {
            sendResponse({ success: false, error: "No selector provided" });
            return;
          }
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            el.style.outline = "2px solid #ff6b6b";
            el.style.backgroundColor = "rgba(255, 107, 107, 0.2)";
          });
          sendResponse({
            success: true,
            count: elements.length,
            selector
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: `Invalid selector: ${error.message}`,
            selector: message.selector
          });
        }
      }
      async function handleClearHighlights(sendResponse) {
        try {
          const highlightedElements = document.querySelectorAll('[style*="outline"][style*="background-color"]');
          highlightedElements.forEach((el) => {
            el.style.outline = "";
            el.style.backgroundColor = "";
          });
          sendResponse({ success: true, message: "Highlights cleared" });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      }
      function detectSimpleGallery() {
        try {
          const images = document.querySelectorAll("img");
          const imageContainers = document.querySelectorAll("div img, article img, section img");
          if (images.length > 10) return true;
          if (imageContainers.length > 5) return true;
          const galleryIndicators = [
            "gallery",
            "photo",
            "image",
            "picture",
            "thumb",
            "grid",
            "masonry",
            "lightbox",
            "carousel"
          ];
          const bodyClass = document.body.className.toLowerCase();
          const bodyId = document.body.id.toLowerCase();
          return galleryIndicators.some(
            (indicator) => bodyClass.includes(indicator) || bodyId.includes(indicator)
          );
        } catch (error) {
          console.error("Gallery detection error:", error);
          return false;
        }
      }
      async function initializeErrorBoundary() {
        try {
          if (window.StepThreeErrorHandler) {
            errorBoundary = window.StepThreeErrorHandler;
            console.log("\u2705 Using existing error handler for orchestrator");
            return;
          }
          console.log("\u26A0\uFE0F Error boundary not available, using basic error handling");
        } catch (error) {
          console.error("\u274C Failed to initialize error boundary:", error);
        }
      }
      async function initializePerformanceMonitoring() {
        try {
          if (window.globalProductionMonitor) {
            performanceMonitor = window.globalProductionMonitor;
            performanceMonitor.info("Orchestrator initialization started", {
              url: window.location.href,
              timestamp: startupTime
            });
            console.log("\u2705 Performance monitoring initialized for orchestrator");
          } else {
            console.log("\u26A0\uFE0F Performance monitor not available");
          }
        } catch (error) {
          console.error("\u274C Failed to initialize performance monitoring:", error);
        }
      }
      async function waitForDOMReady() {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("DOM ready timeout"));
          }, 1e4);
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
      async function performPreInitChecks() {
        if (!window || !document) {
          throw new Error("Invalid browser environment");
        }
        if (typeof chrome === "undefined" || !chrome.runtime) {
          throw new Error("Chrome extension context not available");
        }
        const domElementCount = document.querySelectorAll("*").length;
        if (domElementCount > 5e3) {
          console.warn(`\u26A0\uFE0F Large DOM detected: ${domElementCount} elements`);
          if (performanceMonitor) {
            performanceMonitor.warn("Large DOM detected during orchestrator initialization", {
              elementCount: domElementCount,
              url: window.location.href
            });
          }
        }
        console.log("\u2705 Pre-initialization checks completed");
      }
      async function checkModuleAvailability() {
        const requiredModules = [
          {
            name: "DEBUG",
            property: "DEBUG",
            critical: false,
            fallback: () => ({ isEnabled: () => true, log: console.log })
          },
          {
            name: "ErrorHandler",
            property: "StepThreeErrorHandler",
            critical: false,
            fallback: () => ({ handleError: console.error })
          },
          {
            name: "AdvancedCollectorSystem",
            property: "AdvancedCollectorSystem",
            critical: false,
            fallback: null
          }
        ];
        const optionalModules = [
          { name: "SelectorUtils", property: "StepThreeSelectorUtils", critical: false },
          { name: "RobustHelpers", property: "RobustHelpers", critical: false },
          { name: "EnhancedSmartSelector", property: "EnhancedSmartSelectorSystem", critical: false }
        ];
        const allModules = [...requiredModules, ...optionalModules];
        const missing = [];
        const criticalMissing = [];
        for (const module2 of allModules) {
          const available = typeof window[module2.property] !== "undefined";
          if (!available) {
            missing.push(module2.name);
            if (module2.critical) {
              criticalMissing.push(module2.name);
            } else if (module2.fallback) {
              try {
                window[module2.property] = module2.fallback();
                console.log(`\u2705 Fallback initialized for ${module2.name}`);
              } catch (error) {
                console.warn(`\u26A0\uFE0F Failed to initialize fallback for ${module2.name}:`, error);
              }
            }
          }
        }
        if (missing.length > 0) {
          console.warn("\u26A0\uFE0F Some orchestrator modules not loaded:", missing);
        }
        return {
          success: criticalMissing.length === 0,
          critical: criticalMissing.length > 0,
          missing,
          criticalMissing,
          totalChecked: allModules.length
        };
      }
      async function initializeCoreSystems() {
        const systems = [
          {
            name: "Smart Selector System",
            init: () => {
              return typeof window.EnhancedSmartSelectorSystem !== "undefined";
            }
          },
          {
            name: "Advanced Collector System",
            init: () => {
              return typeof window.AdvancedCollectorSystem !== "undefined";
            }
          },
          {
            name: "DOM Observers",
            init: () => {
              if (window.DynamicContentObserver) {
                return true;
              }
              return false;
            }
          }
        ];
        for (const system of systems) {
          try {
            const success = system.init();
            if (success) {
              console.log(`\u2705 ${system.name} available`);
            } else {
              console.warn(`\u26A0\uFE0F ${system.name} not available`);
            }
          } catch (error) {
            console.error(`\u274C Failed to initialize ${system.name}:`, error);
          }
        }
      }
      async function performPostInitValidation() {
        try {
          if (!chrome.runtime.onMessage.hasListeners()) {
            console.warn("\u26A0\uFE0F No message listeners detected after setup");
          } else {
            console.log("\u2705 Message listeners validated");
          }
        } catch (error) {
          console.warn("\u26A0\uFE0F Could not validate message listeners:", error);
        }
        try {
          const testElement = document.querySelector("body");
          if (!testElement) {
            throw new Error("Cannot access document body");
          }
          console.log("\u2705 DOM access validated");
        } catch (error) {
          console.error("\u274C DOM access validation failed:", error);
        }
      }
      function reportInitializationSuccess(initTime) {
        const report = {
          success: true,
          initializationTime: initTime,
          extensionReady,
          initialized,
          url: window.location.href,
          timestamp: Date.now()
        };
        if (performanceMonitor) {
          performanceMonitor.info("Orchestrator initialization completed", report);
        }
        try {
          chrome.runtime.sendMessage({
            action: "orchestrator_ready",
            report
          }).catch((error) => {
            console.warn("\u26A0\uFE0F Could not notify background script:", error);
          });
        } catch (error) {
          console.warn("\u26A0\uFE0F Background communication not available:", error);
        }
      }
      async function handleInitializationError(error) {
        console.error(`\u274C Orchestrator initialization failed (attempt ${initializationAttempts}):`, error);
        if (errorBoundary) {
          errorBoundary.handleError(error, "Orchestrator Initialization", {
            attempt: initializationAttempts,
            url: window.location.href
          }, "high");
        }
        if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
          console.log("\u{1F504} Attempting emergency message handler setup...");
          if (window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED) {
            console.log("\u26A0\uFE0F Message listener already registered, skipping emergency handler");
            return;
          }
          try {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
              console.log("\u{1F4E8} Emergency message handler:", message);
              if (message.action === "check_orchestrator_status" || message.type === "check_orchestrator_status") {
                sendResponse({
                  success: false,
                  error: "Orchestrator initialization failed",
                  status: {
                    available: false,
                    ready: false,
                    error: error.message
                  }
                });
              } else {
                sendResponse({
                  success: false,
                  error: "Content script not properly initialized"
                });
              }
              return true;
            });
            window.__STEPTHREE_MESSAGE_LISTENER_REGISTERED = true;
            console.log("\u2705 Emergency message handler set up");
          } catch (emergencyError) {
            console.error("\u274C Emergency handler setup failed:", emergencyError);
          }
        }
      }
      console.log("\u2705 Content Script Orchestrator functionality loaded");
      console.log("\u{1F386} STEPTHREE Gallery Scraper Content Bundle v2.0 Ready!");
      console.log("\u{1F4CA} Bundle includes:", [
        "Debug Config",
        "Error Handling",
        "Input Validation",
        "Library Utilities",
        "ServiceWorker Fetch",
        "Content Core",
        "DOM Observers",
        "Scraper Core",
        "Advanced Extractor",
        "Smart Selection",
        "Element Picker",
        "Initialization"
      ].join(", "));
      console.log("\u{1F680} STEPTHREE Enhanced Content Script loading...");
      var coordinatorState = window.__STEPTHREE_MESSAGE_COORDINATOR;
      async function registerWithMessageCoordinator() {
        try {
          console.log("\u{1F504} Registering with message coordinator...");
          if (!coordinatorState) {
            console.warn("\u26A0\uFE0F Message coordinator not initialized, creating minimal state");
            window.__STEPTHREE_MESSAGE_COORDINATOR = {
              initialized: false,
              ready: false,
              startupTime: Date.now(),
              initializationAttempts: 0,
              MAX_ATTEMPTS: 3,
              scanState: {
                isScanning: false,
                progress: 0,
                currentOperation: null,
                results: null,
                error: null
              }
            };
            coordinatorState = window.__STEPTHREE_MESSAGE_COORDINATOR;
          }
          
          // Initialize scan state if not present
          if (!coordinatorState.scanState) {
            coordinatorState.scanState = {
              isScanning: false,
              progress: 0,
              currentOperation: null,
              results: null,
              error: null
            };
          }
          
          // Scan state initialized - handlers are registered via registerMessageHandlers()
          // No need for duplicate registration here
          
          // Notify background script that content is ready
          chrome.runtime.sendMessage({
            action: 'CONTENT_READY'
          }).catch(err => {
            console.warn("\u26A0\uFE0F Could not notify background of ready state:", err.message);
          });
          
          console.log("\u2705 Message coordinator registration complete");
        } catch (error) {
          console.error("\u274C Failed to register with message coordinator:", error);
          throw error;
        }
      }
      
      // Handle SCAN_START message
      async function handleScanStart(message, sendResponse) {
        try {
          console.log("\u{1F680} Starting scan from background command...");
          
          if (coordinatorState.scanState.isScanning) {
            sendResponse({
              success: false,
              error: 'Scan already in progress'
            });
            return;
          }
          
          // Update scan state
          coordinatorState.scanState.isScanning = true;
          coordinatorState.scanState.progress = 0;
          coordinatorState.scanState.currentOperation = 'Initializing scan...';
          coordinatorState.scanState.error = null;
          coordinatorState.scanState.results = null;
          
          // Send initial progress update
          chrome.runtime.sendMessage({
            action: 'SCAN_PROGRESS',
            progress: 0,
            status: 'Starting scan...'
          }).catch(err => console.warn('Progress update failed:', err));
          
          // Check if AdvancedCollectorSystem is available
          if (!window.AdvancedCollectorSystem) {
            throw new Error('AdvancedCollectorSystem not available');
          }
          
          // Create collector instance
          const collector = new window.AdvancedCollectorSystem({
            concurrency: message.options?.concurrency || 5,
            timeout: message.options?.timeout || 30000,
            maxPages: message.options?.maxPages || 1,
            minImageSize: message.options?.minImageSize || 100
          });
          
          // Perform the scan
          coordinatorState.scanState.currentOperation = 'Collecting images...';
          const results = await collector.collectImages({
            selector: message.options?.selector,
            ...message.options
          });
          
          // Update scan state with results
          coordinatorState.scanState.isScanning = false;
          coordinatorState.scanState.progress = 100;
          coordinatorState.scanState.currentOperation = 'Complete';
          coordinatorState.scanState.results = results;
          
          // Send results back to background
          chrome.runtime.sendMessage({
            action: 'SCAN_COMPLETE',
            results: results,
            stats: {
              totalImages: results.images?.length || 0,
              success: results.success
            }
          }).catch(err => console.warn('Results update failed:', err));
          
          // Send response
          sendResponse({
            success: true,
            results: results
          });
          
          console.log("\u2705 Scan completed successfully:", results.images?.length || 0, 'images');
          
        } catch (error) {
          console.error("\u274C Scan failed:", error);
          
          // Update scan state with error
          coordinatorState.scanState.isScanning = false;
          coordinatorState.scanState.error = error.message;
          coordinatorState.scanState.currentOperation = 'Failed';
          
          // Notify background of error
          chrome.runtime.sendMessage({
            action: 'SCAN_ERROR',
            error: error.message
          }).catch(err => console.warn('Error notification failed:', err));
          
          sendResponse({
            success: false,
            error: error.message
          });
        }
      }
      
      // Handle SCAN_STATUS message
      function handleScanStatus(message, sendResponse) {
        sendResponse({
          success: true,
          status: {
            isScanning: coordinatorState.scanState.isScanning,
            progress: coordinatorState.scanState.progress,
            currentOperation: coordinatorState.scanState.currentOperation,
            hasResults: !!coordinatorState.scanState.results,
            hasError: !!coordinatorState.scanState.error
          }
        });
      }
      
      // Handle SCAN_STOP message
      function handleScanStop(message, sendResponse) {
        try {
          if (!coordinatorState.scanState.isScanning) {
            sendResponse({
              success: false,
              error: 'No scan in progress'
            });
            return;
          }
          
          // Stop the scan
          coordinatorState.scanState.isScanning = false;
          coordinatorState.scanState.currentOperation = 'Stopped by user';
          
          // Notify background
          chrome.runtime.sendMessage({
            action: 'SCAN_STOPPED'
          }).catch(err => console.warn('Stop notification failed:', err));
          
          sendResponse({
            success: true,
            message: 'Scan stopped'
          });
          
          console.log("\u{1F6D1} Scan stopped by user");
          
        } catch (error) {
          console.error("\u274C Failed to stop scan:", error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      }
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.getURL) {
        console.log("\u{1F310} Not in Chrome extension context, exiting");
      } else {
        initializeContentScript();
      }
      async function initializeContentScript() {
        coordinatorState.initializationAttempts++;
        if (coordinatorState.initializationAttempts > coordinatorState.MAX_ATTEMPTS) {
          console.error("\u274C Max initialization attempts exceeded");
          return;
        }
        try {
          console.log(`\u{1F504} Initializing STEPTHREE content script (attempt ${coordinatorState.initializationAttempts})...`);
          await initializeErrorBoundary();
          await initializePerformanceMonitoring();
          await waitForDOMReady();
          await performPreInitChecks();
          const moduleCheckResult = await checkModuleAvailability();
          if (!moduleCheckResult.success && moduleCheckResult.critical) {
            throw new Error(`Critical modules missing: ${moduleCheckResult.missing.join(", ")}`);
          }
          await registerWithMessageCoordinator();
          await initializeCoreSystems();
          await performPostInitValidation();
          coordinatorState.initialized = true;
          coordinatorState.ready = true;
          const initTime = Date.now() - coordinatorState.startupTime;
          console.log(`\u2705 STEPTHREE content script initialized successfully in ${initTime}ms`);
          reportInitializationSuccess(initTime);
        } catch (error) {
          await handleInitializationError(error);
        }
      }
      console.log("\u2705 STEPTHREE Enhanced Content Script loaded with enterprise reliability");
      console.log("\u{1F680} Loading Enhanced Image Manager...");
      var EnhancedImageManager = class {
        constructor(options = {}) {
          this.options = {
            // Performance settings
            maxNodesPerMethod: options.maxNodesPerMethod || 2e3,
            timeBudgetPerMethod: options.timeBudgetPerMethod || 8e3,
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            // Detection method toggles
            enableShadowDOM: options.enableShadowDOM !== false,
            enableSrcsetDetection: options.enableSrcsetDetection !== false,
            enableBackgroundImages: options.enableBackgroundImages !== false,
            enableUrlExtraction: options.enableUrlExtraction !== false,
            enableInputImages: options.enableInputImages !== false,
            enableLinkDetection: options.enableLinkDetection !== false,
            // Quality filtering - More lenient for gallery images
            minImageWidth: options.minImageWidth || 20,
            // Reduced from 50 to allow smaller thumbnails
            minImageHeight: options.minImageHeight || 20,
            // Reduced from 50 to allow smaller thumbnails
            allowSmallGalleryImages: options.allowSmallGalleryImages !== false,
            // New option for gallery context
            supportedExtensions: options.supportedExtensions || [
              "jpg",
              "jpeg",
              "png",
              "gif",
              "webp",
              "svg",
              "bmp",
              "ico",
              "tif",
              "apng",
              "jfif",
              "pjpeg",
              "pjp"
            ],
            ...options
          };
          this.imageType = {
            IMG: "IMG",
            TEXT: "TEXT",
            LINK: "LINK",
            INPUT_IMG: "INPUT_IMG",
            BACKGROUND: "BACKGROUND"
          };
          this.imgList = [];
          this.processedUrls = /* @__PURE__ */ new Set();
          this.backgroundUrls = /* @__PURE__ */ new Set();
          this.metrics = {
            totalFound: 0,
            duplicatesSkipped: 0,
            processingTime: 0,
            methodStats: {
              standardImages: 0,
              documentImages: 0,
              shadowDOMImages: 0,
              srcsetImages: 0,
              backgroundImages: 0,
              urlExtraction: 0,
              inputImages: 0,
              linkImages: 0
            },
            errors: []
          };
          this.smartPatternRecognition = null;
          this.initializeIntegrations();
        }
        /**
         * Initialize integrations with existing STEPTHREE systems
         */
        async initializeIntegrations() {
          try {
            if (window.__ST?.getSharedDetectionSystem) {
              this.smartPatternRecognition = window.__ST.getSharedDetectionSystem("smartPatternRecognition");
              if (this.smartPatternRecognition) {
                console.log("\u2705 [COORD] Using shared SmartPatternRecognition instance");
                return;
              }
            }
            if (typeof SmartPatternRecognition !== "undefined" && !window.__ST?.isSystemInitialized("smart-pattern-recognition-image-manager")) {
              window.__ST?.markSystemInitialized("smart-pattern-recognition-image-manager");
              this.smartPatternRecognition = new SmartPatternRecognition({
                enableAdvancedPatterns: true,
                enableUrlValidation: true
              });
              console.log("\u2705 [COORD] SmartPatternRecognition integration enabled (individual instance)");
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to initialize SmartPatternRecognition integration:", error);
          }
        }
        /**
         * Main entry point - Enhanced image collection with comprehensive detection
         */
        async getImages() {
          console.log("\u{1F50D} Starting comprehensive image detection...");
          const startTime = performance.now();
          try {
            this.imgList = [];
            this.processedUrls.clear();
            this.backgroundUrls.clear();
            await this.detectStandardImages();
            await this.detectDocumentImages();
            await this.detectShadowDOMImages();
            await this.detectSrcsetImages();
            await this.detectInputImages();
            await this.detectLinkImages();
            await this.detectBackgroundImages();
            await this.extractUrlsFromHTML();
            this.deduplicateImages();
            this.metrics.totalFound = this.imgList.length;
            this.metrics.processingTime = performance.now() - startTime;
            console.log(`\u2705 Image detection completed: ${this.imgList.length} images found in ${this.metrics.processingTime.toFixed(2)}ms`);
            console.log("\u{1F4CA} Method stats:", this.metrics.methodStats);
            return this.imgList;
          } catch (error) {
            console.error("\u274C Image detection failed:", error);
            this.metrics.errors.push(error.message);
            return this.imgList;
          }
        }
        /**
         * Enhanced image size validation with gallery-aware logic
         * More lenient for common gallery patterns
         */
        isValidImageSize(width, height, src, element) {
          const basicMinWidth = this.options.minImageWidth;
          const basicMinHeight = this.options.minImageHeight;
          if (width >= basicMinWidth && height >= basicMinHeight) {
            return true;
          }
          if (!this.options.allowSmallGalleryImages) {
            return false;
          }
          const isInGalleryContext = this.detectGalleryContext(element, src);
          if (isInGalleryContext) {
            const galleryMinWidth = Math.max(10, basicMinWidth * 0.4);
            const galleryMinHeight = Math.max(10, basicMinHeight * 0.4);
            if (width >= galleryMinWidth && height >= galleryMinHeight) {
              console.debug(`\u{1F5BC}\uFE0F Allowing small gallery image: ${width}x${height} from ${src.substring(0, 50)}...`);
              return true;
            }
          }
          if (this.isLikelyIconOrAvatar(src, width, height)) {
            return false;
          }
          const aspectRatio = width / height;
          if (aspectRatio >= 0.5 && aspectRatio <= 2 && width >= 15 && height >= 15) {
            console.debug(`\u{1F5BC}\uFE0F Allowing small image with good aspect ratio: ${width}x${height}`);
            return true;
          }
          return false;
        }
        /**
         * Detect if an image is in a gallery context
         */
        detectGalleryContext(element, src) {
          if (!element || !src) return false;
          try {
            const classNames = element.className || "";
            const parentClasses = element.parentElement?.className || "";
            const grandparentClasses = element.parentElement?.parentElement?.className || "";
            const galleryIndicators = [
              "gallery",
              "grid",
              "photo",
              "image",
              "thumb",
              "tile",
              "carousel",
              "slider",
              "lightbox",
              "masonry",
              "portfolio"
            ];
            for (const indicator of galleryIndicators) {
              if (classNames.toLowerCase().includes(indicator) || parentClasses.toLowerCase().includes(indicator) || grandparentClasses.toLowerCase().includes(indicator)) {
                return true;
              }
            }
            const urlLower = src.toLowerCase();
            if (urlLower.includes("gallery") || urlLower.includes("photos") || urlLower.includes("album") || urlLower.includes("thumb") || urlLower.includes("preview")) {
              return true;
            }
            if (element.dataset?.gallery || element.dataset?.lightbox || element.getAttribute?.("data-gallery") || element.getAttribute?.("data-fancybox")) {
              return true;
            }
            const siblings = element.parentElement?.children || [];
            const similarImages = Array.from(siblings).filter(
              (child) => child.tagName === "IMG" && child !== element
            );
            if (similarImages.length >= 3) {
              return true;
            }
            return false;
          } catch (error) {
            console.debug("Error detecting gallery context:", error);
            return false;
          }
        }
        /**
         * Check if image is likely an icon or avatar that should be excluded
         */
        isLikelyIconOrAvatar(src, width, height) {
          if (!src) return false;
          try {
            const urlLower = src.toLowerCase();
            const iconPatterns = [
              "icon",
              "favicon",
              "logo",
              "avatar",
              "profile",
              "button",
              "sprite",
              "ui/",
              "/icons/",
              "assets/img/ui"
            ];
            for (const pattern of iconPatterns) {
              if (urlLower.includes(pattern)) {
                return true;
              }
            }
            if (width <= 16 && height <= 16) {
              return true;
            }
            if (width === height && width <= 32) {
              return true;
            }
            return false;
          } catch (error) {
            console.debug("Error checking icon/avatar pattern:", error);
            return false;
          }
        }
        /**
         * Method 1: Standard IMG tag detection (enhanced from reference)
         */
        async detectStandardImages() {
          try {
            console.log("\u{1F50D} Detecting standard IMG tags...");
            const imgs = document.getElementsByTagName("img");
            for (let i = 0; i < imgs.length; i++) {
              const img = imgs[i];
              try {
                const src = img.currentSrc || img.src;
                if (!src || this.processedUrls.has(src)) continue;
                let width = 0, height = 0;
                if (img.naturalWidth && img.naturalHeight) {
                  width = img.naturalWidth;
                  height = img.naturalHeight;
                } else {
                  const rect = img.getBoundingClientRect();
                  width = rect.width || 0;
                  height = rect.height || 0;
                }
                if (!this.isValidImageSize(width, height, src, img)) {
                  continue;
                }
                this.addImg(this.imageType.IMG, src, width, height, {
                  element: img,
                  alt: img.alt,
                  className: img.className,
                  dataset: img.dataset
                });
                this.metrics.methodStats.standardImages++;
              } catch (error) {
                console.debug("Error processing standard image:", error);
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Standard image detection failed:", error);
            this.metrics.errors.push("Standard images: " + error.message);
          }
        }
        /**
         * Method 2: Document.images collection (from reference extension)
         */
        async detectDocumentImages() {
          try {
            console.log("\u{1F50D} Detecting document.images collection...");
            const imgs = document.images;
            if (!imgs || imgs.length === 0) return;
            for (let i = 0; i < imgs.length; i++) {
              try {
                const img = imgs[i];
                const src = img.currentSrc || img.src;
                if (!src || this.processedUrls.has(src)) continue;
                let width = parseInt(img.naturalWidth) || 0;
                let height = parseInt(img.naturalHeight) || 0;
                if (width === 0 || height === 0) {
                  const newImg = new Image();
                  newImg.src = src;
                  const nwidth = parseInt(newImg.width) || 0;
                  const nheight = parseInt(newImg.height) || 0;
                  width = Math.max(width, nwidth);
                  height = Math.max(height, nheight);
                }
                this.addImg(this.imageType.IMG, src, width, height, {
                  element: img,
                  fromDocumentCollection: true
                });
                this.metrics.methodStats.documentImages++;
              } catch (error) {
                console.debug("Error processing document image:", error);
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Document images detection failed:", error);
            this.metrics.errors.push("Document images: " + error.message);
          }
        }
        /**
         * Method 3: Shadow DOM detection (ported from reference extension)
         */
        async detectShadowDOMImages() {
          if (!this.options.enableShadowDOM) return;
          try {
            console.log("\u{1F50D} Detecting Shadow DOM images...");
            const shadowImages = this.querySelectorAllShadows("img");
            for (const img of shadowImages) {
              try {
                const src = img.currentSrc || img.src;
                if (!src || this.processedUrls.has(src)) continue;
                let width = parseInt(img.naturalWidth) || 0;
                let height = parseInt(img.naturalHeight) || 0;
                this.addImg(this.imageType.IMG, src, width, height, {
                  element: img,
                  fromShadowDOM: true,
                  shadowHost: img.getRootNode()?.host?.tagName || "unknown"
                });
                this.metrics.methodStats.shadowDOMImages++;
              } catch (error) {
                console.debug("Error processing shadow DOM image:", error);
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Shadow DOM detection failed:", error);
            this.metrics.errors.push("Shadow DOM: " + error.message);
          }
        }
        /**
         * Method 4: Enhanced srcset detection (ported and improved)
         */
        async detectSrcsetImages() {
          if (!this.options.enableSrcsetDetection) return;
          try {
            console.log("\u{1F50D} Detecting srcset images...");
            const sources = document.getElementsByTagName("source");
            for (const source of sources) {
              if (!source.srcset) continue;
              const urls = this.parseSrcset(source.srcset);
              for (const url of urls) {
                if (this.processedUrls.has(url)) continue;
                this.addImg(this.imageType.IMG, url, 0, 0, {
                  fromSrcset: true,
                  sourceElement: true
                });
                this.metrics.methodStats.srcsetImages++;
              }
            }
            const srcsetImages = document.querySelectorAll("img[srcset]");
            for (const img of srcsetImages) {
              if (!img.srcset) continue;
              const urls = this.parseSrcset(img.srcset);
              for (const url of urls) {
                if (this.processedUrls.has(url)) continue;
                this.addImg(this.imageType.IMG, url, 0, 0, {
                  element: img,
                  fromSrcset: true
                });
                this.metrics.methodStats.srcsetImages++;
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Srcset detection failed:", error);
            this.metrics.errors.push("Srcset: " + error.message);
          }
        }
        /**
         * Method 5: Input image detection (from reference extension)
         */
        async detectInputImages() {
          if (!this.options.enableInputImages) return;
          try {
            console.log("\u{1F50D} Detecting input[type=image] elements...");
            const inputs = document.getElementsByTagName("input");
            for (const input of inputs) {
              try {
                if (input.type && input.type.toUpperCase() === "IMAGE" && input.src) {
                  if (this.processedUrls.has(input.src)) continue;
                  this.addImg(this.imageType.INPUT_IMG, input.src, 0, 0, {
                    element: input,
                    inputType: input.type
                  });
                  this.metrics.methodStats.inputImages++;
                }
              } catch (error) {
                console.debug("Error processing input image:", error);
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Input image detection failed:", error);
            this.metrics.errors.push("Input images: " + error.message);
          }
        }
        /**
         * Method 6: Link detection for image URLs (from reference extension)
         */
        async detectLinkImages() {
          if (!this.options.enableLinkDetection) return;
          try {
            console.log("\u{1F50D} Detecting image links...");
            const links = document.getElementsByTagName("a");
            for (const link of links) {
              try {
                const href = link.href;
                if (!href || this.processedUrls.has(href)) continue;
                if (this.isImageUrl(href)) {
                  this.addImg(this.imageType.LINK, href, 0, 0, {
                    element: link,
                    linkText: link.textContent?.trim() || "",
                    title: link.title || ""
                  });
                  this.metrics.methodStats.linkImages++;
                }
              } catch (error) {
                console.debug("Error processing link:", error);
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Link detection failed:", error);
            this.metrics.errors.push("Link images: " + error.message);
          }
        }
        /**
         * Method 7: CSS background image detection (enhanced from reference)
         */
        async detectBackgroundImages() {
          if (!this.options.enableBackgroundImages) return;
          try {
            console.log("\u{1F50D} Detecting CSS background images...");
            const elements = document.getElementsByTagName("*");
            const maxElements = Math.min(elements.length, this.options.maxNodesPerMethod);
            for (let i = 0; i < maxElements; i++) {
              try {
                const element = elements[i];
                const backgroundImage = this.deepCss(element, "background-image");
                this.extractBackgroundUrls(backgroundImage, element);
                const background = this.deepCss(element, "background");
                this.extractBackgroundUrls(background, element);
              } catch (error) {
                console.debug("Error processing background image:", error);
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Background image detection failed:", error);
            this.metrics.errors.push("Background images: " + error.message);
          }
        }
        /**
         * Method 8: HTML content URL extraction (from reference extension)
         */
        async extractUrlsFromHTML() {
          if (!this.options.enableUrlExtraction) return;
          try {
            console.log("\u{1F50D} Extracting URLs from HTML content...");
            const htmlContent = document.body.innerHTML;
            const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?//=]*)/gi;
            const urls = htmlContent.match(urlRegex);
            if (!urls) return;
            const uniqueUrls = [...new Set(urls)];
            for (const url of uniqueUrls) {
              if (this.processedUrls.has(url)) continue;
              if (this.isImageUrl(url)) {
                this.addImg(this.imageType.TEXT, url, 0, 0, {
                  fromTextContent: true,
                  extractionMethod: "html-content"
                });
                this.metrics.methodStats.urlExtraction++;
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F URL extraction failed:", error);
            this.metrics.errors.push("URL extraction: " + error.message);
          }
        }
        /**
         * Shadow DOM traversal (ported from reference extension)
         */
        querySelectorAllShadows(selector, el = document.body) {
          try {
            const childShadows = Array.from(el.querySelectorAll("*")).map((el2) => el2.shadowRoot).filter(Boolean);
            const childResults = childShadows.map(
              (child) => this.querySelectorAllShadows(selector, child)
            );
            const result = Array.from(el.querySelectorAll(selector));
            return result.concat(childResults).flat();
          } catch (error) {
            console.debug("Error in shadow DOM traversal:", error);
            return [];
          }
        }
        /**
         * CSS property extraction (ported from reference extension)
         */
        deepCss(element, css) {
          if (!element || !element.style) return "";
          try {
            const camelCaseCss = css.replace(/\-([a-z])/g, (a, b) => b.toUpperCase());
            if (element.currentStyle) {
              return element.style[camelCaseCss] || element.currentStyle[camelCaseCss] || "";
            }
            const computedStyle = window.getComputedStyle ? window.getComputedStyle(element, "") : (document.defaultView || window).getComputedStyle(element, "");
            return element.style[camelCaseCss] || computedStyle.getPropertyValue(css) || "";
          } catch (error) {
            console.debug("Error getting CSS property:", error);
            return "";
          }
        }
        /**
         * Extract background image URLs from CSS properties
         */
        extractBackgroundUrls(styleValue, element) {
          if (!styleValue || styleValue === "none") return;
          try {
            const urlRegex = /url\(['"]?([^")]+)['"]?\)/g;
            let match;
            while ((match = urlRegex.exec(styleValue)) !== null) {
              const src = match[1];
              if (src && !this.backgroundUrls.has(src)) {
                this.backgroundUrls.add(src);
                const resolvedUrl = new URL(src, window.location.href).href;
                if (!this.processedUrls.has(resolvedUrl)) {
                  this.addImg(this.imageType.BACKGROUND, resolvedUrl, 0, 0, {
                    element,
                    cssProperty: "background-image",
                    elementTag: element.tagName,
                    className: element.className
                  });
                  this.metrics.methodStats.backgroundImages++;
                }
              }
            }
          } catch (error) {
            console.debug("Error extracting background URLs:", error);
          }
        }
        /**
         * Parse srcset attribute to extract individual URLs
         */
        parseSrcset(srcset) {
          try {
            const urls = [];
            const srcsetEntries = srcset.split(",");
            for (const entry of srcsetEntries) {
              const trimmed = entry.trim();
              const spaceIndex = trimmed.indexOf(" ");
              const url = spaceIndex !== -1 ? trimmed.substring(0, spaceIndex) : trimmed;
              if (url) {
                try {
                  const resolvedUrl = new URL(url, window.location.href).href;
                  urls.push(resolvedUrl);
                } catch (e) {
                  urls.push(url);
                }
              }
            }
            return urls;
          } catch (error) {
            console.debug("Error parsing srcset:", error);
            return [];
          }
        }
        /**
         * Check if URL points to an image resource
         */
        isImageUrl(url) {
          try {
            const urlLower = url.toLowerCase();
            return this.options.supportedExtensions.some(
              (ext) => urlLower.includes(`.${ext}`)
            );
          } catch (error) {
            return false;
          }
        }
        /**
         * Add image to collection with enhanced metadata
         */
        addImg(type, src, width, height, metadata = {}) {
          if (!src || this.processedUrls.has(src)) {
            this.metrics.duplicatesSkipped++;
            return;
          }
          try {
            const resolvedSrc = new URL(src, window.location.href).href;
            const imageObj = {
              type,
              src: resolvedSrc,
              width: width || 0,
              height: height || 0,
              metadata: {
                ...metadata,
                timestamp: Date.now(),
                domain: new URL(resolvedSrc).hostname,
                position: this.imgList.length
              }
            };
            if (this.smartPatternRecognition) {
              try {
                const enhancedData = this.smartPatternRecognition.categorizeImageEnhanced(imageObj);
                Object.assign(imageObj, enhancedData);
              } catch (error) {
                console.debug("Smart categorization failed:", error);
              }
            }
            this.imgList.push(imageObj);
            this.processedUrls.add(src);
            this.processedUrls.add(resolvedSrc);
          } catch (error) {
            console.debug("Error adding image:", error);
          }
        }
        /**
         * Remove duplicate images and optimize collection
         */
        deduplicateImages() {
          const seen = /* @__PURE__ */ new Set();
          const unique = [];
          for (const img of this.imgList) {
            const key = img.src;
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(img);
            } else {
              this.metrics.duplicatesSkipped++;
            }
          }
          this.imgList = unique;
        }
        /**
         * Get unique image sources (compatibility with reference extension)
         */
        getUniqueImagesSrcs() {
          const images = this.imgList;
          const srcs = images.map((img) => img.src);
          return [...new Set(srcs)];
        }
        /**
         * Get processing metrics and statistics
         */
        getMetrics() {
          return {
            ...this.metrics,
            efficiency: {
              imagesPerSecond: this.metrics.processingTime > 0 ? (this.metrics.totalFound / this.metrics.processingTime * 1e3).toFixed(2) : 0,
              duplicateRate: this.metrics.totalFound > 0 ? (this.metrics.duplicatesSkipped / (this.metrics.totalFound + this.metrics.duplicatesSkipped) * 100).toFixed(2) : 0
            }
          };
        }
        /**
         * Reset manager state
         */
        reset() {
          this.imgList = [];
          this.processedUrls.clear();
          this.backgroundUrls.clear();
          this.metrics = {
            totalFound: 0,
            duplicatesSkipped: 0,
            processingTime: 0,
            methodStats: {
              standardImages: 0,
              documentImages: 0,
              shadowDOMImages: 0,
              srcsetImages: 0,
              backgroundImages: 0,
              urlExtraction: 0,
              inputImages: 0,
              linkImages: 0
            },
            errors: []
          };
        }
      };
      if (typeof window !== "undefined") {
        window.EnhancedImageManager = EnhancedImageManager;
      }
      console.log("\u2705 Enhanced Image Manager loaded successfully");
      console.log("\u{1F680} Loading Enhanced Selector Wrapper...");
      if (typeof window.AdvancedCollectorSystem !== "undefined") {
        window.AdvancedCollectorSystem.prototype.safeQuerySelectorAll = async function(selector, options = {}) {
          try {
            const root = options.root || document;
            const countOnly = options.countOnly || false;
            const maxResults = options.maxResults || this.options.maxNodesPerDetector || 1e3;
            if (countOnly) {
              if (selector === "*") {
                return root.getElementsByTagName("*").length;
              }
              const elements2 = root.querySelectorAll(selector);
              return elements2.length;
            }
            const elements = root.querySelectorAll(selector);
            if (elements.length > maxResults) {
              console.warn(`\u26A0\uFE0F Query result truncated: ${elements.length} -> ${maxResults} elements`);
              return Array.from(elements).slice(0, maxResults);
            }
            return Array.from(elements);
          } catch (error) {
            console.warn(`\u26A0\uFE0F Safe query selector failed for "${selector}":`, error);
            return [];
          }
        };
        window.AdvancedCollectorSystem.prototype.safeQuerySelector = async function(selector, options = {}) {
          try {
            const root = options.root || document;
            return root.querySelector(selector);
          } catch (error) {
            console.warn(`\u26A0\uFE0F Safe query selector failed for "${selector}":`, error);
            return null;
          }
        };
        window.AdvancedCollectorSystem.prototype.generateEnhancedSelector = async function(element, options = {}) {
          try {
            if (this.enhancedCSSSelector && this.enhancedSelectorInitialized) {
              return await this.enhancedCSSSelector.generateSelector(element, options);
            } else {
              return this.generateBasicSelector(element);
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Enhanced selector generation failed:", error);
            return this.generateBasicSelector(element);
          }
        };
        window.AdvancedCollectorSystem.prototype.generateSelectorCandidates = async function(element, options = {}) {
          try {
            if (this.enhancedCSSSelector && this.enhancedSelectorInitialized) {
              return await this.enhancedCSSSelector.generateSelectorCandidates(element, options);
            } else {
              const basicSelector = this.generateBasicSelector(element);
              return [{ selector: basicSelector, type: "basic", penalty: 10 }];
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Selector candidates generation failed:", error);
            const fallbackSelector = this.generateBasicSelector(element);
            return [{ selector: fallbackSelector, type: "fallback", penalty: 100 }];
          }
        };
        window.AdvancedCollectorSystem.prototype.generateBasicSelector = function(element) {
          try {
            if (element.id) {
              const idSelector = `#${CSS.escape(element.id)}`;
              if (document.querySelectorAll(idSelector).length === 1) {
                return idSelector;
              }
            }
            if (element.className && typeof element.className === "string") {
              const classes = element.className.split(" ").filter((c) => c.trim());
              if (classes.length > 0) {
                const classSelector = `.${CSS.escape(classes[0])}`;
                const matches = document.querySelectorAll(classSelector);
                if (matches.length <= 5) {
                  return classSelector;
                }
              }
            }
            const tagName = element.tagName.toLowerCase();
            const parent = element.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                (child) => child.tagName.toLowerCase() === tagName
              );
              const index = siblings.indexOf(element);
              if (index >= 0) {
                return `${tagName}:nth-of-type(${index + 1})`;
              }
            }
            return tagName;
          } catch (error) {
            console.warn("\u26A0\uFE0F Basic selector generation failed:", error);
            return element.tagName.toLowerCase();
          }
        };
        window.AdvancedCollectorSystem.prototype.detectGalleryPatternsEnhanced = async function(options = {}) {
          try {
            if (this.smartPatternRecognition && this.smartPatternInitialized) {
              const patterns = await this.smartPatternRecognition.detectPatterns(options);
              return patterns.patterns || [];
            } else {
              return await this.detectBasicGalleryPatterns(options);
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Enhanced gallery pattern detection failed:", error);
            return await this.detectBasicGalleryPatterns(options);
          }
        };
        window.AdvancedCollectorSystem.prototype.detectBasicGalleryPatterns = async function(options = {}) {
          const patterns = [];
          try {
            const gallerySelectors = [
              ".gallery",
              ".images",
              ".photos",
              ".carousel",
              ".slider",
              '[class*="gallery"]',
              '[class*="image"]',
              '[class*="photo"]',
              '[id*="gallery"]',
              '[id*="image"]',
              '[id*="photo"]'
            ];
            for (const selector of gallerySelectors) {
              try {
                const containers = await this.safeQuerySelectorAll(selector);
                for (const container of containers) {
                  const images = container.querySelectorAll("img");
                  if (images.length >= (options.minPatternItems || 3)) {
                    patterns.push({
                      type: "basic-gallery",
                      container,
                      images: Array.from(images),
                      selector,
                      confidence: 0.6,
                      layout: { type: "unknown" }
                    });
                  }
                }
              } catch (error) {
              }
            }
            return patterns;
          } catch (error) {
            console.warn("\u26A0\uFE0F Basic gallery pattern detection failed:", error);
            return [];
          }
        };
        window.AdvancedCollectorSystem.prototype.analyzeImageElementEnhanced = async function(element, context = {}) {
          try {
            const analysis = {
              element,
              selector: await this.generateEnhancedSelector(element),
              confidence: 0.5,
              patterns: [],
              metadata: {}
            };
            if (this.enhancedCSSSelector && this.enhancedSelectorInitialized) {
              const selectorCandidates = await this.generateSelectorCandidates(element);
              analysis.selectorCandidates = selectorCandidates;
              analysis.confidence += 0.2;
            }
            if (this.smartPatternRecognition && this.smartPatternInitialized) {
              const container = element.closest('[class*="gallery"], [class*="image"], [class*="photo"]');
              if (container) {
                analysis.patterns.push("gallery-container");
                analysis.confidence += 0.15;
              }
              const siblings = Array.from(element.parentElement?.children || []).filter((child) => child.tagName === element.tagName);
              if (siblings.length >= 3) {
                analysis.patterns.push("repeating-pattern");
                analysis.confidence += 0.1;
              }
            }
            return analysis;
          } catch (error) {
            console.warn("\u26A0\uFE0F Enhanced image element analysis failed:", error);
            return {
              element,
              selector: this.generateBasicSelector(element),
              confidence: 0.3,
              patterns: [],
              metadata: { error: error.message }
            };
          }
        };
        console.log("\u2705 Enhanced Selector Wrapper methods added to AdvancedCollectorSystem");
      } else {
        console.warn("\u26A0\uFE0F AdvancedCollectorSystem not available for wrapper methods");
      }
      console.log("\u2705 Enhanced Selector Wrapper loaded successfully");
      console.log("\u{1F50D} Loading Table Detection System...");
      var TableDetectionSystem = class {
        constructor(options = {}) {
          this.options = {
            maxTables: options.maxTables || 5,
            minChildren: options.minChildren || 3,
            minAreaThreshold: options.minAreaThreshold || 0.02,
            // 2% of body area
            enableVisualHighlighting: options.enableVisualHighlighting !== false,
            enableInfiniteScroll: options.enableInfiniteScroll !== false,
            confidenceThreshold: options.confidenceThreshold || 0.5,
            ...options
          };
          this.detectedTables = [];
          this.currentTableIndex = 0;
          this.isActive = false;
          this.infiniteScrollDetected = false;
          this.highlightingStylesInjected = false;
          this.patternCache = /* @__PURE__ */ new Map();
          console.log("\u2705 Table Detection System initialized");
        }
        /**
         * Main entry point - detect all tables on the page
         * Ported from reference function a(e) with performance hardening
         */
        async detectTables(options = {}) {
          try {
            console.log("\u{1F50D} Starting table detection with performance optimizations...");
            this.detectedTables = [];
            this.currentTableIndex = 0;
            const startTime = performance.now();
            const timeBudget = options.timeBudget || 8e3;
            const maxElements = options.maxElementsToScan || 5e3;
            const bodyWidth = document.body.offsetWidth || window.innerWidth;
            const bodyHeight = document.body.offsetHeight || window.innerHeight;
            const totalBodyArea = bodyWidth * bodyHeight;
            console.log(`\u{1F4CF} Body area: ${totalBodyArea.toLocaleString()}px\xB2`);
            const containerCandidates = this.getContainerCandidates();
            console.log(`\u{1F3AF} Focusing on ${containerCandidates.length} container candidates for performance`);
            const isLargePage = containerCandidates.length > 1e3 || totalBodyArea > 1e7;
            if (isLargePage) {
              console.log("\u26A1 Large page detected - using batch processing to prevent jank");
              return await this.detectTablesWithBatchProcessing(containerCandidates, totalBodyArea, timeBudget);
            } else {
              return await this.detectTablesStandard(containerCandidates, totalBodyArea, timeBudget, maxElements);
            }
          } catch (error) {
            console.error("\u274C Table detection failed:", error);
            return [];
          }
        }
        /**
         * Performance optimization: Get likely container candidates
         * Focuses on main content areas instead of scanning entire DOM
         */
        getContainerCandidates() {
          const candidates = /* @__PURE__ */ new Set();
          const semanticContainers = [
            "main",
            "section",
            "article",
            'div[role="main"]',
            'div[role="region"]',
            'div[role="article"]',
            ".content",
            ".main",
            ".article",
            ".section",
            "#content",
            "#main"
          ];
          semanticContainers.forEach((selector) => {
            try {
              document.querySelectorAll(selector).forEach((el) => {
                if (el.children.length >= this.options.minChildren) {
                  candidates.add(el);
                  Array.from(el.children).forEach((child) => {
                    if (child.children.length >= this.options.minChildren) {
                      candidates.add(child);
                    }
                  });
                }
              });
            } catch (e) {
            }
          });
          const tableClasses = [
            ".table",
            ".data",
            ".list",
            ".grid",
            ".items",
            ".entries",
            ".results",
            ".content-list",
            '[class*="table"]',
            '[class*="data"]',
            '[class*="list"]',
            '[class*="grid"]',
            '[class*="item"]'
          ];
          tableClasses.forEach((selector) => {
            try {
              document.querySelectorAll(selector).forEach((el) => {
                if (el.children.length >= this.options.minChildren) {
                  candidates.add(el);
                }
              });
            } catch (e) {
            }
          });
          const allDivs = document.querySelectorAll("div, ul, ol");
          for (const div of allDivs) {
            if (div.children.length >= Math.max(this.options.minChildren * 2, 6)) {
              candidates.add(div);
            }
          }
          const candidateArray = Array.from(candidates).filter((el) => {
            const area = el.offsetWidth * el.offsetHeight;
            return area > 0 && !isNaN(area);
          });
          return candidateArray.sort((a, b) => {
            const scoreA = a.children.length * (a.offsetWidth * a.offsetHeight);
            const scoreB = b.children.length * (b.offsetWidth * b.offsetHeight);
            return scoreB - scoreA;
          });
        }
        /**
         * Batch processing for large pages to prevent jank
         * Uses requestIdleCallback and setTimeout for non-blocking execution
         */
        async detectTablesWithBatchProcessing(candidates, totalBodyArea, timeBudget) {
          console.log("\u{1F504} Starting batch processing for large page...");
          const batchSize = 50;
          const batches = [];
          for (let i = 0; i < candidates.length; i += batchSize) {
            batches.push(candidates.slice(i, i + batchSize));
          }
          const analysisResults = [];
          const startTime = performance.now();
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            if (performance.now() - startTime > timeBudget) {
              console.warn(`\u23F0 Time budget exceeded, processed ${batchIndex}/${batches.length} batches`);
              break;
            }
            const batch = batches[batchIndex];
            console.log(`\u{1F504} Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} elements)`);
            const batchResults = await this.processBatchAsync(batch, totalBodyArea);
            analysisResults.push(...batchResults);
            if (batchIndex % 3 === 0) {
              await this.yieldControl();
            }
          }
          return this.finalizeTables(analysisResults);
        }
        /**
         * Standard detection for smaller pages
         */
        async detectTablesStandard(candidates, totalBodyArea, timeBudget, maxElements) {
          const startTime = performance.now();
          const elementsToProcess = candidates.slice(0, maxElements);
          console.log(`\u{1F3AF} Processing ${elementsToProcess.length} container candidates`);
          const analysisPromises = [];
          for (const element of elementsToProcess) {
            if (performance.now() - startTime > timeBudget) {
              console.warn(`\u23F0 Time budget exceeded during standard processing`);
              break;
            }
            const area = element.offsetWidth * element.offsetHeight;
            if (isNaN(area) || area < totalBodyArea * this.options.minAreaThreshold) {
              continue;
            }
            analysisPromises.push(this.analyzeElementAsync(element, area, totalBodyArea));
          }
          const analyses = await Promise.allSettled(analysisPromises);
          const results = analyses.filter((result) => result.status === "fulfilled" && result.value).map((result) => result.value);
          return this.finalizeTables(results);
        }
        /**
         * Process a batch of elements asynchronously
         */
        async processBatchAsync(batch, totalBodyArea) {
          return new Promise((resolve) => {
            const processFunc = () => {
              const results = [];
              for (const element of batch) {
                try {
                  const area = element.offsetWidth * element.offsetHeight;
                  if (isNaN(area) || area < totalBodyArea * this.options.minAreaThreshold) {
                    continue;
                  }
                  const analysis = this.analyzeElementForTablePattern(element);
                  if (analysis && analysis.children.length >= this.options.minChildren) {
                    const score = area * analysis.children.length * analysis.children.length;
                    const tableData = {
                      table: element,
                      goodClasses: analysis.goodClasses,
                      area,
                      children: analysis.children,
                      childrenCount: analysis.children.length,
                      text: this.extractText(analysis.children),
                      score,
                      selector: this.generateSelector(element),
                      type: "table_pattern",
                      confidence: this.calculateConfidence(analysis, area, totalBodyArea),
                      timestamp: Date.now()
                    };
                    results.push(tableData);
                  }
                } catch (error) {
                  console.warn("\u26A0\uFE0F Batch element analysis failed:", error);
                }
              }
              resolve(results);
            };
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(processFunc, { timeout: 100 });
            } else {
              setTimeout(processFunc, 0);
            }
          });
        }
        /**
         * Yield control to prevent blocking the main thread
         */
        async yieldControl() {
          return new Promise((resolve) => {
            if (typeof requestIdleCallback !== "undefined") {
              requestIdleCallback(resolve, { timeout: 16 });
            } else {
              setTimeout(resolve, 0);
            }
          });
        }
        /**
         * Finalize table detection results
         */
        finalizeTables(results) {
          this.detectedTables = results;
          this.detectedTables.sort((a, b) => b.score - a.score);
          this.detectedTables = this.detectedTables.slice(0, this.options.maxTables);
          console.log(`\u2705 Table detection completed: ${this.detectedTables.length} tables found`);
          console.log("\u{1F4CA} Top tables by score:", this.detectedTables.slice(0, 3));
          if (this.options.enableInfiniteScroll) {
            setTimeout(() => this.detectInfiniteScrollWithProtection(), 100);
          }
          return this.detectedTables;
        }
        /**
         * Async analysis of individual elements for better performance
         */
        async analyzeElementAsync(element, area, totalBodyArea) {
          return new Promise((resolve) => {
            try {
              const analysis = this.analyzeElementForTablePattern(element);
              if (analysis && analysis.children.length >= this.options.minChildren) {
                const score = area * analysis.children.length * analysis.children.length;
                const tableData = {
                  table: element,
                  goodClasses: analysis.goodClasses,
                  area,
                  children: analysis.children,
                  childrenCount: analysis.children.length,
                  text: this.extractText(analysis.children),
                  score,
                  selector: this.generateSelector(element),
                  type: "table_pattern",
                  confidence: this.calculateConfidence(analysis, area, totalBodyArea),
                  timestamp: Date.now()
                };
                resolve(tableData);
              } else {
                resolve(null);
              }
            } catch (error) {
              console.warn("\u26A0\uFE0F Element analysis failed:", error);
              resolve(null);
            }
          });
        }
        /**
         * Core pattern analysis algorithm - ported from reference function n(e)
         * Analyzes child elements for repeating class patterns and structure
         */
        analyzeElementForTablePattern(element) {
          try {
            const children = Array.from(element.children);
            const classPatterns = {};
            const individualClasses = {};
            const validChildren = children.filter((child) => {
              const nodeName = child.nodeName.toLowerCase();
              if (["script", "img", "meta", "style", "link", "noscript"].includes(nodeName)) {
                return false;
              }
              const text = child.textContent || "";
              if (!text.trim().length) {
                return false;
              }
              return true;
            });
            if (validChildren.length < this.options.minChildren) {
              return null;
            }
            validChildren.forEach((child) => {
              const classList = this.getClassList(child);
              const classString = classList.sort().join(" ");
              if (classString) {
                classPatterns[classString] = (classPatterns[classString] || 0) + 1;
              }
              classList.forEach((className) => {
                if (className) {
                  individualClasses[className] = (individualClasses[className] || 0) + 1;
                }
              });
            });
            const threshold = Math.max(1, Math.floor(validChildren.length / 2) - 2);
            let goodClasses = Object.keys(classPatterns).filter(
              (pattern) => classPatterns[pattern] >= threshold
            );
            if (!goodClasses.length) {
              goodClasses = Object.keys(individualClasses).filter(
                (className) => individualClasses[className] >= threshold
              );
            }
            if (!goodClasses.length || goodClasses.length === 1 && goodClasses[0] === "") {
              return {
                children: validChildren,
                goodClasses: [],
                patternStrength: 0
              };
            }
            const matchingChildren = validChildren.filter((child) => {
              const classList = this.getClassList(child);
              return goodClasses.some((pattern) => {
                if (pattern.includes(" ")) {
                  const patternClasses = pattern.split(" ");
                  return patternClasses.every((cls) => classList.includes(cls));
                } else {
                  return classList.includes(pattern);
                }
              });
            });
            const patternStrength = Math.min(
              1,
              matchingChildren.length / validChildren.length * (goodClasses.length / 5)
              // Normalize by expected max classes
            );
            return {
              children: matchingChildren.length > 0 ? matchingChildren : validChildren,
              goodClasses,
              patternStrength,
              totalChildren: validChildren.length,
              matchingChildren: matchingChildren.length
            };
          } catch (error) {
            console.warn("\u26A0\uFE0F Pattern analysis failed:", error);
            return null;
          }
        }
        /**
         * Extract class list from element
         */
        getClassList(element) {
          const className = element.className || "";
          return className.trim().split(/\s+/).filter((cls) => cls.length > 0);
        }
        /**
         * Extract text content from children array
         */
        extractText(children) {
          return children.map((child) => (child.textContent || "").trim()).join(" ").trim();
        }
        /**
         * Generate CSS selector for element
         */
        generateSelector(element) {
          try {
            if (element.id) {
              return `#${CSS.escape(element.id)}`;
            }
            const classes = this.getClassList(element);
            if (classes.length > 0) {
              const escapedClasses = classes.map((cls) => CSS.escape(cls)).join(".");
              return `.${escapedClasses}`;
            }
            return element.tagName.toLowerCase();
          } catch (error) {
            return "unknown";
          }
        }
        /**
         * Calculate confidence score for detected table
         */
        calculateConfidence(analysis, area, totalBodyArea) {
          let confidence = 0.4;
          confidence += Math.min(0.25, analysis.children.length * 0.015);
          confidence += analysis.patternStrength * 0.2;
          confidence += Math.min(0.15, analysis.goodClasses.length * 0.03);
          const areaRatio = area / totalBodyArea;
          if (areaRatio > 0.05 && areaRatio < 0.7) {
            confidence += 0.1;
          }
          return Math.min(1, Math.max(0.1, confidence));
        }
        /**
         * "Try another table" functionality - cycle through detected patterns
         * Ported from reference function i() with enhancements
         */
        tryAnotherTable() {
          if (this.detectedTables.length === 0) {
            console.log("\u26A0\uFE0F No tables detected to cycle through");
            return null;
          }
          this.clearTableHighlighting();
          this.currentTableIndex = (this.currentTableIndex + 1) % this.detectedTables.length;
          const currentTable = this.detectedTables[this.currentTableIndex];
          if (this.options.enableVisualHighlighting) {
            this.highlightTable(currentTable);
          }
          console.log(`\u{1F504} Switched to table ${this.currentTableIndex + 1}/${this.detectedTables.length}`);
          console.log("\u{1F4CB} Current table info:", {
            selector: currentTable.selector,
            childrenCount: currentTable.childrenCount,
            confidence: currentTable.confidence.toFixed(2),
            score: currentTable.score.toLocaleString()
          });
          return currentTable;
        }
        /**
         * Highlight selected table with visual indicators
         * Enhanced with color-coded element classification system
         */
        highlightTable(tableData) {
          if (!tableData || !this.options.enableVisualHighlighting) return;
          try {
            this.ensureHighlightingStyles();
            this.clearTableHighlighting();
            if (tableData.table) {
              const tableType = this.classifyElementType(tableData.table);
              const tableClass = `stepthree-${tableType}`;
              tableData.table.classList.add(tableClass);
              this.createElementLabel(tableData.table, tableType);
              tableData.table.classList.add("stepthree-selected-table");
              console.log(`\u{1F3A8} Main table classified as: ${tableType}`);
            }
            if (tableData.children && tableData.children.length > 0) {
              console.log(`\u{1F3A8} Highlighting ${tableData.children.length} child elements...`);
              tableData.children.forEach((child, index) => {
                try {
                  const childType = this.classifyElementType(child);
                  const childClass = `stepthree-${childType}`;
                  child.classList.add(childClass);
                  if (index < 10) {
                    this.createElementLabel(child, childType);
                  }
                  child.classList.add("stepthree-selected-row");
                } catch (childError) {
                  console.warn(`\u26A0\uFE0F Failed to highlight child element ${index}:`, childError);
                }
              });
              const classificationSummary = this.getClassificationSummary(tableData.children);
              console.log("\u{1F4CA} Element classification summary:", classificationSummary);
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to highlight table:", error);
          }
        }
        /**
         * Get classification summary for debugging and analytics
         */
        getClassificationSummary(elements) {
          const summary = {
            form: 0,
            row: 0,
            col: 0,
            advanced: 0,
            total: elements.length
          };
          elements.forEach((element) => {
            const type = this.classifyElementType(element);
            summary[type] = (summary[type] || 0) + 1;
          });
          return summary;
        }
        /**
         * Enhanced hover highlighting for real-time feedback
         * Call this method on mouseover events for interactive highlighting
         */
        highlightElementOnHover(element) {
          if (!element || !this.options.enableVisualHighlighting) return;
          try {
            this.ensureHighlightingStyles();
            document.querySelectorAll(".stepthree-hover").forEach((el) => {
              el.classList.remove("stepthree-hover");
            });
            element.classList.add("stepthree-hover");
            const elementType = this.classifyElementType(element);
            const tempLabel = this.createElementLabel(element, elementType);
            setTimeout(() => {
              if (tempLabel && tempLabel.parentNode) {
                tempLabel.remove();
              }
            }, 2e3);
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to highlight element on hover:", error);
          }
        }
        /**
         * Remove hover highlighting
         * Call this method on mouseout events
         */
        removeHoverHighlight(element) {
          if (!element) return;
          try {
            element.classList.remove("stepthree-hover");
            const labels = element.querySelectorAll(".stepthree-element-label");
            labels.forEach((label) => {
              if (label.parentNode) {
                label.remove();
              }
            });
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to remove hover highlight:", error);
          }
        }
        /**
         * Clear all table highlighting
         * Ported from reference function c() with enhancements
         */
        clearTableHighlighting() {
          try {
            document.querySelectorAll(".stepthree-selected-table").forEach((el) => {
              el.classList.remove("stepthree-selected-table");
            });
            document.querySelectorAll(".stepthree-selected-row").forEach((el) => {
              el.classList.remove("stepthree-selected-row");
            });
            const classesToRemove = [
              "stepthree-hover",
              "stepthree-row",
              "stepthree-col",
              "stepthree-form",
              "stepthree-advanced"
            ];
            classesToRemove.forEach((className) => {
              document.querySelectorAll(`.${className}`).forEach((el) => {
                el.classList.remove(className);
              });
            });
            document.querySelectorAll(".stepthree-element-label").forEach((label) => {
              if (label.parentNode) {
                label.parentNode.removeChild(label);
              }
            });
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to clear table highlighting:", error);
          }
        }
        /**
         * Classify element type for color-coded visual selection
         * Ported from Data Scraper's element analysis patterns
         */
        classifyElementType(element) {
          if (!element || !element.tagName) {
            return "advanced";
          }
          const tagName = element.tagName.toLowerCase();
          const className = (element.className || "").toLowerCase();
          const id = (element.id || "").toLowerCase();
          const role = (element.getAttribute("role") || "").toLowerCase();
          const textContent = (element.textContent || "").trim();
          const childCount = element.children.length;
          if (this.isFormElement(element, tagName, className, role)) {
            return "form";
          }
          if (this.isRowElement(element, tagName, className, role, childCount)) {
            return "row";
          }
          if (this.isColumnElement(element, tagName, className, role)) {
            return "col";
          }
          if (this.isNavigationElement(element, tagName, className, role, id)) {
            return "advanced";
          }
          return "advanced";
        }
        /**
         * Check if element is a form-related element
         */
        isFormElement(element, tagName, className, role) {
          const formTags = ["form", "input", "textarea", "select", "button", "fieldset", "legend", "label"];
          if (formTags.includes(tagName)) {
            return true;
          }
          const formRoles = ["form", "search", "button", "textbox", "combobox", "checkbox", "radio"];
          if (formRoles.includes(role)) {
            return true;
          }
          const formClassPatterns = [
            "form",
            "input",
            "button",
            "submit",
            "search",
            "login",
            "register",
            "contact",
            "subscribe",
            "newsletter",
            "field",
            "control"
          ];
          if (formClassPatterns.some((pattern) => className.includes(pattern))) {
            return true;
          }
          const hasFormChild = element.querySelector("form, input, textarea, select, button");
          if (hasFormChild) {
            return true;
          }
          return false;
        }
        /**
         * Check if element is a table row element
         */
        isRowElement(element, tagName, className, role, childCount) {
          if (tagName === "tr") {
            return true;
          }
          if (role === "row") {
            return true;
          }
          const rowClassPatterns = [
            "row",
            "item",
            "entry",
            "record",
            "line",
            "listing",
            "product",
            "result",
            "post",
            "article"
          ];
          if (rowClassPatterns.some((pattern) => className.includes(pattern))) {
            if (childCount >= 2 && childCount <= 20) {
              return true;
            }
          }
          const parent = element.parentElement;
          if (parent) {
            const parentClass = (parent.className || "").toLowerCase();
            const parentTag = parent.tagName.toLowerCase();
            if (parentTag === "tbody" || parentTag === "table" || parentClass.includes("table") || parentClass.includes("list") || parentClass.includes("grid") || parentClass.includes("rows")) {
              return true;
            }
          }
          return false;
        }
        /**
         * Check if element is a table column/cell element
         */
        isColumnElement(element, tagName, className, role) {
          const cellTags = ["td", "th", "col", "colgroup"];
          if (cellTags.includes(tagName)) {
            return true;
          }
          const cellRoles = ["cell", "columnheader", "rowheader", "gridcell"];
          if (cellRoles.includes(role)) {
            return true;
          }
          const colClassPatterns = [
            "cell",
            "column",
            "col",
            "field",
            "data",
            "value",
            "price",
            "name",
            "title",
            "description",
            "date"
          ];
          if (colClassPatterns.some((pattern) => className.includes(pattern))) {
            return true;
          }
          return false;
        }
        /**
         * Check if element is a navigation element
         */
        isNavigationElement(element, tagName, className, role, id) {
          const navTags = ["nav", "menu", "menuitem"];
          if (navTags.includes(tagName)) {
            return true;
          }
          const navRoles = ["navigation", "menu", "menubar", "menuitem", "tab", "tablist"];
          if (navRoles.includes(role)) {
            return true;
          }
          const navPatterns = [
            "nav",
            "menu",
            "breadcrumb",
            "pagination",
            "tab",
            "sidebar",
            "header",
            "footer",
            "toolbar",
            "controls"
          ];
          if (navPatterns.some((pattern) => className.includes(pattern) || id.includes(pattern))) {
            return true;
          }
          return false;
        }
        /**
         * Create element label for visual feedback
         */
        createElementLabel(element, elementType) {
          const existingLabel = element.querySelector(".stepthree-element-label");
          if (existingLabel) {
            existingLabel.remove();
          }
          const label = document.createElement("div");
          label.className = "stepthree-element-label";
          const labelTexts = {
            "form": "FORM",
            "row": "ROW",
            "col": "COLUMN",
            "advanced": "ELEMENT"
          };
          label.textContent = labelTexts[elementType] || "ELEMENT";
          element.style.position = element.style.position || "relative";
          element.appendChild(label);
          return label;
        }
        /**
         * Ensure highlighting CSS styles are injected
         */
        ensureHighlightingStyles() {
          if (this.highlightingStylesInjected) return;
          const styleId = "stepthree-table-highlighting";
          if (document.getElementById(styleId)) {
            this.highlightingStylesInjected = true;
            return;
          }
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = `
      /* Legacy table selection styles - maintained for compatibility */
      .stepthree-selected-table {
        border: 3px solid #ff6b35 !important;
        box-shadow: 0 0 15px rgba(255, 107, 53, 0.4) !important;
        position: relative !important;
        z-index: 1000 !important;
      }
      
      .stepthree-selected-row {
        background-color: rgba(255, 193, 7, 0.2) !important;
        outline: 1px solid rgba(255, 193, 7, 0.5) !important;
        position: relative !important;
      }
      
      .stepthree-selected-row:hover {
        background-color: rgba(255, 193, 7, 0.3) !important;
      }

      /* Color-coded visual selection system - ported from Data Scraper */
      .stepthree-hover {
        background-color: #ffe8d3 !important;
        outline: 2px solid #ffa726 !important;
        outline-offset: 1px !important;
        position: relative !important;
        z-index: 999995 !important;
        transition: all 0.2s ease !important;
      }

      .stepthree-row {
        border: 2px solid #bd0000 !important;
        box-shadow: 0 0 8px rgba(189, 0, 0, 0.4) !important;
        position: relative !important;
        z-index: 999996 !important;
        background-color: rgba(189, 0, 0, 0.05) !important;
      }

      .stepthree-col {
        border: 2px solid #6565fe !important;
        box-shadow: 0 0 8px rgba(101, 101, 254, 0.4) !important;
        position: relative !important;
        z-index: 999997 !important;
        background-color: rgba(101, 101, 254, 0.05) !important;
      }

      .stepthree-form {
        border: 2px solid #a693fa !important;
        box-shadow: 0 0 8px rgba(166, 147, 250, 0.4) !important;
        position: relative !important;
        z-index: 999998 !important;
        background-color: rgba(166, 147, 250, 0.05) !important;
      }

      .stepthree-advanced {
        border: 2px solid #34e802 !important;
        box-shadow: 0 0 8px rgba(52, 232, 2, 0.4) !important;
        position: relative !important;
        z-index: 999999 !important;
        background-color: rgba(52, 232, 2, 0.05) !important;
      }

      .stepthree-element-label {
        position: absolute !important;
        top: -20px !important;
        left: 0 !important;
        background: #000000 !important;
        color: #ffffff !important;
        padding: 2px 6px !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        border-radius: 3px !important;
        z-index: 1000000 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
      }

      /* Ensure labels don't interfere with page layout */
      .stepthree-element-label::before {
        content: '' !important;
        position: absolute !important;
        top: 100% !important;
        left: 8px !important;
        width: 0 !important;
        height: 0 !important;
        border-left: 4px solid transparent !important;
        border-right: 4px solid transparent !important;
        border-top: 4px solid #000000 !important;
      }

      /* Hover enhancements for better UX */
      .stepthree-hover:hover {
        background-color: #ffd7a3 !important;
        outline-color: #ff9800 !important;
      }

      .stepthree-row:hover {
        border-color: #e60000 !important;
        box-shadow: 0 0 12px rgba(189, 0, 0, 0.6) !important;
      }

      .stepthree-col:hover {
        border-color: #4040ff !important;
        box-shadow: 0 0 12px rgba(101, 101, 254, 0.6) !important;
      }

      .stepthree-form:hover {
        border-color: #8a6ff7 !important;
        box-shadow: 0 0 12px rgba(166, 147, 250, 0.6) !important;
      }

      .stepthree-advanced:hover {
        border-color: #2bd100 !important;
        box-shadow: 0 0 12px rgba(52, 232, 2, 0.6) !important;
      }

      /* Ensure proper stacking context */
      .stepthree-hover,
      .stepthree-row,
      .stepthree-col,
      .stepthree-form,
      .stepthree-advanced {
        box-sizing: border-box !important;
      }
    `;
          document.head.appendChild(style);
          this.highlightingStylesInjected = true;
        }
        /**
         * Detect infinite scroll on the current page
         */
        detectInfiniteScroll() {
          try {
            const indicators = [
              // Common infinite scroll indicators
              "infinite-scroll",
              "endless-scroll",
              "auto-load",
              "load-more",
              "pagination-infinite",
              // Data attributes
              "[data-infinite]",
              '[data-scroll="infinite"]',
              "[data-auto-load]",
              // JavaScript libraries
              ".masonry",
              ".isotope",
              "[data-isotope]"
            ];
            const hasInfiniteScroll = indicators.some((selector) => {
              try {
                return document.querySelector(selector) !== null;
              } catch (e) {
                return false;
              }
            });
            const hasScrollListeners = window.onscroll !== null || document.addEventListener.toString().includes("scroll");
            this.infiniteScrollDetected = hasInfiniteScroll || hasScrollListeners;
            if (this.infiniteScrollDetected) {
              console.log("\u{1F504} Infinite scroll detected on this page");
            }
            return this.infiniteScrollDetected;
          } catch (error) {
            console.warn("\u26A0\uFE0F Infinite scroll detection failed:", error);
            return false;
          }
        }
        /**
         * Performance-protected infinite scroll detection
         * Prevents performance issues on large pages with infinite scroll
         */
        detectInfiniteScrollWithProtection() {
          try {
            if (this.infiniteScrollDetectionTime && Date.now() - this.infiniteScrollDetectionTime < 5e3) {
              return this.infiniteScrollDetected;
            }
            this.infiniteScrollDetectionTime = Date.now();
            setTimeout(() => {
              try {
                const result = this.detectInfiniteScroll();
                const pageSize = document.querySelectorAll("*").length;
                if (result && pageSize > 3e3) {
                  console.warn("\u26A0\uFE0F Infinite scroll detected on large page - table detection may be affected by dynamic content");
                }
              } catch (error) {
                console.warn("\u26A0\uFE0F Protected infinite scroll detection failed:", error);
              }
            }, 50);
          } catch (error) {
            console.warn("\u26A0\uFE0F Infinite scroll protection failed:", error);
          }
        }
        /**
         * Get current selected table
         */
        getCurrentTable() {
          if (this.detectedTables.length === 0 || this.currentTableIndex < 0) {
            return null;
          }
          return this.detectedTables[this.currentTableIndex];
        }
        /**
         * Get all detected tables
         */
        getAllTables() {
          return this.detectedTables;
        }
        /**
         * Extract structured data from detected table for export
         */
        extractTableData(tableData = null) {
          const table = tableData || this.getCurrentTable();
          if (!table) return null;
          try {
            const rows = [];
            const children = table.children || [];
            children.forEach((child, index) => {
              const cells = Array.from(child.children || [child]);
              const rowData = cells.map((cell) => ({
                text: (cell.textContent || "").trim(),
                html: cell.innerHTML || "",
                tag: cell.tagName.toLowerCase(),
                classes: this.getClassList(cell),
                element: cell
              }));
              if (rowData.length > 0 && rowData.some((cell) => cell.text.length > 0)) {
                rows.push({
                  index,
                  cells: rowData,
                  element: child
                });
              }
            });
            let headers = [];
            let dataRows = rows;
            if (rows.length > 0) {
              const firstRow = rows[0];
              const hasThElements = firstRow.cells.some((cell) => cell.tag === "th");
              if (hasThElements || firstRow.cells.every((cell) => cell.text.length > 0)) {
                headers = firstRow.cells.map((cell) => cell.text);
                dataRows = rows.slice(1);
              }
            }
            return {
              tableElement: table.table,
              selector: table.selector,
              rows,
              headers,
              dataRows,
              metadata: {
                selector: table.selector,
                area: table.area,
                confidence: table.confidence,
                goodClasses: table.goodClasses,
                childrenCount: table.childrenCount,
                score: table.score,
                patternStrength: table.patternStrength || 0,
                infiniteScrollDetected: this.infiniteScrollDetected,
                timestamp: table.timestamp
              }
            };
          } catch (error) {
            console.error("\u274C Failed to extract table data:", error);
            return null;
          }
        }
        /**
         * Enable/disable visual highlighting
         */
        setVisualHighlighting(enabled) {
          this.options.enableVisualHighlighting = enabled;
          if (!enabled) {
            this.clearTableHighlighting();
          }
        }
        /**
         * Reset detection state
         */
        reset() {
          this.clearTableHighlighting();
          this.detectedTables = [];
          this.currentTableIndex = 0;
          this.isActive = false;
          this.patternCache.clear();
          console.log("\u{1F504} Table detection system reset");
        }
        /**
         * Get detection statistics
         */
        getStats() {
          return {
            tablesDetected: this.detectedTables.length,
            currentTableIndex: this.currentTableIndex,
            infiniteScrollDetected: this.infiniteScrollDetected,
            isActive: this.isActive,
            averageConfidence: this.detectedTables.length > 0 ? this.detectedTables.reduce((sum, table) => sum + table.confidence, 0) / this.detectedTables.length : 0,
            topScore: this.detectedTables.length > 0 ? this.detectedTables[0].score : 0
          };
        }
      };
      if (typeof window !== "undefined") {
        window.TableDetectionSystem = TableDetectionSystem;
      }
      console.log("\u2705 Table Detection System loaded successfully");
      console.log("\u{1F6E1}\uFE0F Loading Content Script Error Enhancement...");
      var ContentScriptErrorEnhancement = class {
        constructor(options = {}) {
          this.options = {
            // Error handling settings
            enableErrorRecovery: options.enableErrorRecovery !== false,
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
            enableDomSafeguards: options.enableDomSafeguards !== false,
            // Performance thresholds
            maxMemoryUsage: options.maxMemoryUsage || 150 * 1024 * 1024,
            // 100MB
            maxDomOperationTime: options.maxDomOperationTime || 2e3,
            // 2 seconds
            maxElementsToProcess: options.maxElementsToProcess || 1e3,
            batchSize: options.batchSize || 50,
            batchDelay: options.batchDelay || 10,
            // Circuit breaker settings
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 6e4,
            // 1 minute
            // Retry settings
            maxRetryAttempts: options.maxRetryAttempts || 3,
            retryDelayBase: options.retryDelayBase || 500,
            retryDelayMax: options.retryDelayMax || 5e3,
            ...options
          };
          this.errorHandler = null;
          this.performanceMonitor = null;
          this.isInitialized = false;
          this.activeOperations = /* @__PURE__ */ new Map();
          this.circuitBreakers = /* @__PURE__ */ new Map();
          this.cleanupTasks = [];
          this.memoryChecks = [];
          this.domOperationQueue = [];
          this.isDomOperationActive = false;
          this.lastDomCheck = Date.now();
          this.errorStats = {
            totalErrors: 0,
            domErrors: 0,
            memoryErrors: 0,
            networkErrors: 0,
            recoveredErrors: 0,
            circuitBreakerTrips: 0
          };
          this.initialize();
        }
        /**
         * Initialize the error enhancement system
         */
        async initialize() {
          try {
            console.log("\u{1F504} Initializing Content Script Error Enhancement...");
            if (typeof PerformanceMonitoringSystem === "undefined") {
              window.PerformanceMonitoringSystem = class {
                constructor(options = {}) {
                  this.options = options;
                  this.initialized = false;
                }
                async initialize() {
                  this.initialized = true;
                  return Promise.resolve();
                }
                startOperation(description, type) {
                  return { end: () => {} };
                }
                recordMetric(name, value) {}
                getMetrics() {
                  return {};
                }
                shutdown() {}
              };
              console.log("\u2705 PerformanceMonitoringSystem stub initialized");
            }
            if (typeof ErrorHandlingSystem !== "undefined") {
              this.errorHandler = new ErrorHandlingSystem({
                enableConsoleLogging: true,
                enableUserNotifications: false,
                // Content scripts shouldn't show notifications
                enableErrorReporting: true,
                maxRetryAttempts: this.options.maxRetryAttempts,
                circuitBreakerThreshold: this.options.circuitBreakerThreshold,
                enableRecoveryMechanisms: this.options.enableErrorRecovery
              });
              console.log("\u2705 Content script error handler initialized");
            } else {
              this.errorHandler = this.createFallbackErrorHandler();
              console.warn("\u26A0\uFE0F Using fallback error handler");
            }
            if (typeof PerformanceMonitoringSystem !== "undefined") {
              this.performanceMonitor = new PerformanceMonitoringSystem({
                enableMemoryMonitoring: this.options.enableMemoryMonitoring,
                enablePerformanceTracking: this.options.enablePerformanceMonitoring,
                enableHealthChecks: false,
                // Simplified for content scripts
                memoryWarningThreshold: this.options.maxMemoryUsage * 0.8,
                memoryCriticalThreshold: this.options.maxMemoryUsage,
                slowOperationThreshold: this.options.maxDomOperationTime,
                enableConsoleReporting: true,
                reportingInterval: 6e4
                // 1 minute
              });
              await this.performanceMonitor.initialize();
              console.log("\u2705 Content script performance monitor initialized");
            } else {
              console.warn("\u26A0\uFE0F PerformanceMonitoringSystem not available");
            }
            this.setupGlobalErrorHandling();
            if (this.options.enableDomSafeguards) {
              this.setupDomSafeguards();
            }
            if (this.options.enableMemoryMonitoring) {
              this.setupMemoryMonitoring();
            }
            this.setupResourceCleanup();
            this.isInitialized = true;
            console.log("\u2705 Content Script Error Enhancement initialized successfully");
          } catch (error) {
            console.error("\u274C Failed to initialize Content Script Error Enhancement:", error);
            throw error;
          }
        }
        /**
         * Enhanced DOM operation wrapper with comprehensive error handling
         */
        async safeDomOperation(operation, description = "DOM operation", options = {}) {
          if (!this.isInitialized) {
            throw new Error("Error enhancement system not initialized");
          }
          const operationId = this.generateOperationId();
          const startTime = Date.now();
          const timeout = options.timeout || this.options.maxDomOperationTime;
          const maxRetries = options.maxRetries || this.options.maxRetryAttempts;
          if (this.isCircuitBreakerOpen(description)) {
            throw new Error(`Circuit breaker open for ${description}`);
          }
          const tracker = this.performanceMonitor?.startOperation(description, "dom") || { end: () => {
          } };
          this.activeOperations.set(operationId, {
            description,
            startTime,
            timeout,
            tracker
          });
          let attempt = 0;
          let lastError = null;
          while (attempt < maxRetries) {
            try {
              if (!document || !document.body) {
                throw new Error("DOM not available");
              }
              await this.checkMemoryUsage();
              const result = await Promise.race([
                Promise.resolve(operation()),
                new Promise(
                  (_, reject) => setTimeout(() => reject(new Error(`Operation timeout: ${description}`)), timeout)
                )
              ]);
              this.updateCircuitBreaker(description, true);
              this.activeOperations.delete(operationId);
              tracker.end({ success: true, attempts: attempt + 1 });
              return result;
            } catch (error) {
              lastError = error;
              attempt++;
              console.warn(`\u26A0\uFE0F DOM operation failed (attempt ${attempt}/${maxRetries}): ${description}`, error);
              const errorType = this.classifyDomError(error);
              if (this.errorHandler) {
                this.errorHandler.handleError(error, `DOM Operation: ${description}`, {
                  operationId,
                  attempt,
                  maxRetries,
                  timeout,
                  errorType,
                  url: window.location.href
                }, this.getErrorSeverity(errorType, attempt, maxRetries));
              }
              this.errorStats.totalErrors++;
              this.errorStats.domErrors++;
              if (!this.isRetryableError(errorType) || attempt >= maxRetries) {
                break;
              }
              const delay = Math.min(
                this.options.retryDelayBase * Math.pow(2, attempt - 1),
                this.options.retryDelayMax
              );
              await this.delay(delay);
            }
          }
          this.updateCircuitBreaker(description, false);
          this.activeOperations.delete(operationId);
          tracker.end({ success: false, attempts: attempt, error: lastError.message });
          throw new Error(`DOM operation failed after ${attempt} attempts: ${lastError.message}`);
        }
        /**
         * Safe DOM element batch processing with memory and performance safeguards
         */
        async safeBatchProcess(elements, processor, options = {}) {
          if (!Array.isArray(elements)) {
            throw new Error("Elements must be an array");
          }
          const batchSize = options.batchSize || this.options.batchSize;
          const batchDelay = options.batchDelay || this.options.batchDelay;
          const maxElements = options.maxElements || this.options.maxElementsToProcess;
          const description = options.description || "Batch processing";
          const processElements = elements.slice(0, maxElements);
          const results = [];
          let processedCount = 0;
          console.log(`\u{1F504} Starting safe batch processing: ${processElements.length} elements in batches of ${batchSize}`);
          for (let i = 0; i < processElements.length; i += batchSize) {
            const batch = processElements.slice(i, i + batchSize);
            try {
              await this.checkMemoryUsage();
              const batchResults = await this.safeDomOperation(async () => {
                const batchPromises = batch.map(async (element, index) => {
                  try {
                    return await processor(element, i + index);
                  } catch (error) {
                    console.warn(`\u26A0\uFE0F Batch item failed:`, error);
                    return { error: error.message, element, index: i + index };
                  }
                });
                return await Promise.all(batchPromises);
              }, `${description} - batch ${Math.floor(i / batchSize) + 1}`, {
                timeout: this.options.maxDomOperationTime * 2
                // Longer timeout for batches
              });
              results.push(...batchResults);
              processedCount += batch.length;
              const progress = Math.round(processedCount / processElements.length * 100);
              console.log(`\u{1F4CA} Batch progress: ${processedCount}/${processElements.length} (${progress}%)`);
              if (i + batchSize < processElements.length && batchDelay > 0) {
                await this.delay(batchDelay);
              }
            } catch (error) {
              console.error(`\u274C Batch processing failed at batch ${Math.floor(i / batchSize) + 1}:`, error);
              if (this.errorHandler) {
                this.errorHandler.handleError(error, `Batch Processing: ${description}`, {
                  batchIndex: Math.floor(i / batchSize),
                  batchSize,
                  processedCount,
                  totalElements: processElements.length
                }, "medium");
              }
              if (error.message.includes("memory") || error.message.includes("timeout")) {
                throw error;
              }
            }
          }
          console.log(`\u2705 Batch processing completed: ${processedCount}/${processElements.length} elements processed`);
          return results;
        }
        /**
         * Safe network request wrapper with retry and circuit breaker
         */
        async safeNetworkRequest(requestFunction, description = "Network request", options = {}) {
          const maxRetries = options.maxRetries || this.options.maxRetryAttempts;
          const timeout = options.timeout || 1e4;
          if (this.isCircuitBreakerOpen(description)) {
            throw new Error(`Circuit breaker open for ${description}`);
          }
          const tracker = this.performanceMonitor?.startOperation(description, "network") || { end: () => {
          } };
          let attempt = 0;
          let lastError = null;
          while (attempt < maxRetries) {
            try {
              const result = await Promise.race([
                Promise.resolve(requestFunction()),
                new Promise(
                  (_, reject) => setTimeout(() => reject(new Error(`Network timeout: ${description}`)), timeout)
                )
              ]);
              this.updateCircuitBreaker(description, true);
              tracker.end({ success: true, attempts: attempt + 1 });
              return result;
            } catch (error) {
              lastError = error;
              attempt++;
              console.warn(`\u26A0\uFE0F Network request failed (attempt ${attempt}/${maxRetries}): ${description}`, error);
              const errorType = this.classifyNetworkError(error);
              if (this.errorHandler) {
                this.errorHandler.handleError(error, `Network Request: ${description}`, {
                  attempt,
                  maxRetries,
                  timeout,
                  errorType
                }, this.getErrorSeverity(errorType, attempt, maxRetries));
              }
              this.errorStats.totalErrors++;
              this.errorStats.networkErrors++;
              if (!this.isRetryableNetworkError(errorType) || attempt >= maxRetries) {
                break;
              }
              const delay = Math.min(
                this.options.retryDelayBase * Math.pow(2, attempt - 1),
                this.options.retryDelayMax
              );
              await this.delay(delay);
            }
          }
          this.updateCircuitBreaker(description, false);
          tracker.end({ success: false, attempts: attempt, error: lastError.message });
          throw new Error(`Network request failed after ${attempt} attempts: ${lastError.message}`);
        }
        /**
         * Setup global error handling for content scripts
         */
        setupGlobalErrorHandling() {
          const originalErrorHandler = window.onerror;
          window.onerror = (message, source, lineno, colno, error) => {
            // Only handle errors from extension code, not host page errors
            const isExtensionError = source && (
              source.startsWith("chrome-extension://") ||
              (chrome?.runtime?.getURL && source.startsWith(chrome.runtime.getURL("")))
            );
            
            if (isExtensionError) {
              console.error("\u{1F6A8} Global content script error:", { message, source, lineno, colno, error });
              if (this.errorHandler) {
                this.errorHandler.handleError(error || message, "Global Content Script Error", {
                  source,
                  lineno,
                  colno,
                  url: window.location.href
                }, "high");
              }
              this.errorStats.totalErrors++;
            }
            
            if (originalErrorHandler) {
              return originalErrorHandler(message, source, lineno, colno, error);
            }
            return false;
          };
          const originalRejectionHandler = window.onunhandledrejection;
          window.onunhandledrejection = (event) => {
            // For promise rejections, check stack trace if available
            let isExtensionError = false;
            if (event.reason?.stack) {
              isExtensionError = event.reason.stack.includes("chrome-extension://");
            }
            
            if (isExtensionError) {
              console.error("\u{1F6A8} Unhandled promise rejection in content script:", event.reason);
              if (this.errorHandler) {
                this.errorHandler.handleError(event.reason, "Unhandled Promise Rejection", {
                  promise: event.promise.toString(),
                  url: window.location.href
                }, "high");
              }
              this.errorStats.totalErrors++;
            }
            
            if (originalRejectionHandler) {
              return originalRejectionHandler(event);
            }
          };
        }
        /**
         * Setup DOM safeguards
         */
        setupDomSafeguards() {
          if (typeof MutationObserver !== "undefined") {
            const observer = new MutationObserver((mutations) => {
              try {
                if (mutations.length > 100) {
                  console.warn("\u26A0\uFE0F High DOM mutation activity detected:", mutations.length);
                  if (this.errorHandler) {
                    this.errorHandler.handleError(
                      new Error(`High DOM mutation activity: ${mutations.length} mutations`),
                      "DOM Mutation Monitor",
                      { mutationCount: mutations.length, url: window.location.href },
                      "medium"
                    );
                  }
                }
              } catch (error) {
                console.error("\u274C DOM mutation observer error:", error);
              }
            });
            observer.observe(document.body || document.documentElement, {
              childList: true,
              subtree: true,
              attributes: false
              // Don't monitor attribute changes to reduce overhead
            });
            this.cleanupTasks.push(() => observer.disconnect());
          }
        }
        /**
         * Setup memory monitoring
         */
        setupMemoryMonitoring() {
          const checkMemory = () => {
            try {
              this.checkMemoryUsage();
            } catch (error) {
              console.error("\u274C Memory check failed:", error);
            }
          };
          const memoryInterval = setInterval(checkMemory, PERFORMANCE_CONFIG.MEMORY_SAMPLE_INTERVAL_MS);
          this.cleanupTasks.push(() => clearInterval(memoryInterval));
          setTimeout(checkMemory, 1e3);
        }
        /**
         * Check memory usage and take action if needed
         */
        async checkMemoryUsage() {
          if (!this.options.enableMemoryMonitoring) {
            return;
          }
          try {
            const memoryInfo = performance.memory;
            if (!memoryInfo) {
              return;
            }
            const currentUsage = memoryInfo.usedJSHeapSize;
            const threshold = this.options.maxMemoryUsage;
            if (currentUsage > threshold) {
              console.warn(`\u26A0\uFE0F High memory usage detected: ${this.formatBytes(currentUsage)}`);
              this.errorStats.memoryErrors++;
              
              // Clean up failed image loads immediately
              this.cleanupFailedImageLoads();
              
              if (this.errorHandler) {
                this.errorHandler.handleError(
                  new Error(`High memory usage: ${this.formatBytes(currentUsage)}`),
                  "Memory Monitor",
                  {
                    currentUsage,
                    threshold,
                    activeOperations: this.activeOperations.size,
                    url: window.location.href
                  },
                  currentUsage > threshold * 1.2 ? "high" : "medium"
                );
              }
              await this.performCleanup();
              if (typeof window !== "undefined" && window.gc) {
                console.log("\u{1F5D1}\uFE0F Triggering garbage collection...");
                window.gc();
              }
            }
          } catch (error) {
            console.error("\u274C Memory usage check failed:", error);
          }
        }
        /**
         * Setup resource cleanup
         */
        setupResourceCleanup() {
          window.addEventListener("beforeunload", () => {
            this.performCleanup();
          });
          const cleanupInterval = setInterval(() => {
            this.performCleanup();
          }, 3e5);
          this.cleanupTasks.push(() => clearInterval(cleanupInterval));
        }
        /**
         * Perform resource cleanup
         */
        async performCleanup() {
          try {
            console.log("\u{1F9F9} Performing content script cleanup...");
            const now = Date.now();
            for (const [operationId, operation] of this.activeOperations) {
              if (now - operation.startTime > operation.timeout * 2) {
                console.warn(`\u26A0\uFE0F Canceling stuck operation: ${operation.description}`);
                operation.tracker.end({ success: false, reason: "Cleanup timeout" });
                this.activeOperations.delete(operationId);
              }
            }
            this.cleanupTasks.forEach((task, index) => {
              try {
                task();
              } catch (error) {
                console.warn(`\u26A0\uFE0F Cleanup task ${index} failed:`, error);
              }
            });
            console.log("\u2705 Content script cleanup completed");
          } catch (error) {
            console.error("\u274C Cleanup failed:", error);
          }
        }
        /**
         * Clean up failed image loads to free memory
         */
        cleanupFailedImageLoads() {
          try {
            // Revoke all blob URLs to free memory
            if (typeof window !== "undefined" && window.blobUrls) {
              window.blobUrls.forEach(url => URL.revokeObjectURL(url));
              window.blobUrls.clear();
            }
            
            // Clear any cached image elements with blob URLs
            const images = document.querySelectorAll('img[src^="blob:"]');
            images.forEach(img => {
              try {
                URL.revokeObjectURL(img.src);
                img.src = '';
              } catch (e) {
                // Ignore errors from already revoked URLs
              }
            });
            
            console.log("\u{1F9F9} Cleaned up failed image loads");
          } catch (error) {
            console.warn("Failed to cleanup images:", error);
          }
        }
        /**
         * Helper methods
         */
        createFallbackErrorHandler() {
          return {
            handleError: (error, context, metadata, severity) => {
              console.error(`[${severity}] Content Script ${context}:`, error, metadata);
            }
          };
        }
        classifyDomError(error) {
          const message = error.message.toLowerCase();
          if (message.includes("timeout")) return "timeout";
          if (message.includes("memory")) return "memory";
          if (message.includes("permission")) return "permission";
          if (message.includes("not found") || message.includes("null")) return "element-not-found";
          if (message.includes("blocked")) return "blocked";
          return "unknown";
        }
        classifyNetworkError(error) {
          const message = error.message.toLowerCase();
          if (message.includes("timeout")) return "timeout";
          if (message.includes("network")) return "network";
          if (message.includes("cors")) return "cors";
          if (message.includes("404")) return "not-found";
          if (message.includes("403") || message.includes("401")) return "permission";
          if (message.includes("429")) return "rate-limit";
          if (message.includes("500") || message.includes("502") || message.includes("503")) return "server";
          return "unknown";
        }
        isRetryableError(errorType) {
          return ["timeout", "network", "server", "rate-limit"].includes(errorType);
        }
        isRetryableNetworkError(errorType) {
          return ["timeout", "network", "server", "rate-limit"].includes(errorType);
        }
        getErrorSeverity(errorType, attempt, maxAttempts) {
          if (errorType === "memory" || errorType === "permission") return "high";
          if (attempt >= maxAttempts) return "medium";
          return "low";
        }
        isCircuitBreakerOpen(operation) {
          const breaker = this.circuitBreakers.get(operation);
          if (!breaker) return false;
          if (breaker.state === "open") {
            if (Date.now() - breaker.lastFailure > this.options.circuitBreakerTimeout) {
              breaker.state = "half-open";
              breaker.failures = 0;
              return false;
            }
            return true;
          }
          return false;
        }
        updateCircuitBreaker(operation, success) {
          let breaker = this.circuitBreakers.get(operation);
          if (!breaker) {
            breaker = { state: "closed", failures: 0, lastFailure: 0 };
            this.circuitBreakers.set(operation, breaker);
          }
          if (success) {
            breaker.failures = 0;
            breaker.state = "closed";
          } else {
            breaker.failures++;
            breaker.lastFailure = Date.now();
            if (breaker.failures >= this.options.circuitBreakerThreshold) {
              breaker.state = "open";
              this.errorStats.circuitBreakerTrips++;
              console.warn(`\u{1F50C} Circuit breaker opened for: ${operation}`);
            }
          }
        }
        generateOperationId() {
          return `op_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        }
        formatBytes(bytes) {
          if (bytes === 0) return "0 B";
          const k = 1024;
          const sizes = ["B", "KB", "MB", "GB"];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        }
        delay(ms) {
          return new Promise((resolve) => setTimeout(resolve, ms));
        }
        /**
         * Get error statistics
         */
        getStats() {
          return {
            ...this.errorStats,
            activeOperations: this.activeOperations.size,
            circuitBreakers: Array.from(this.circuitBreakers.entries()),
            memoryUsage: performance.memory ? this.formatBytes(performance.memory.usedJSHeapSize) : "N/A",
            isInitialized: this.isInitialized
          };
        }
        /**
         * Shutdown the enhancement system
         */
        shutdown() {
          console.log("\u23F9\uFE0F Shutting down Content Script Error Enhancement...");
          this.performCleanup();
          if (this.performanceMonitor && this.performanceMonitor.shutdown) {
            this.performanceMonitor.shutdown();
          }
          this.isInitialized = false;
          console.log("\u2705 Content Script Error Enhancement shutdown complete");
        }
      };
      var contentErrorEnhancement = null;
      if (document.readyState === "complete" || document.readyState === "interactive") {
        initializeEnhancement();
      } else {
        document.addEventListener("DOMContentLoaded", initializeEnhancement);
      }
      async function initializeEnhancement() {
        try {
          if (!contentErrorEnhancement) {
            contentErrorEnhancement = new ContentScriptErrorEnhancement({
              enableErrorRecovery: true,
              enablePerformanceMonitoring: true,
              enableMemoryMonitoring: true,
              enableDomSafeguards: true
            });
            window.contentErrorEnhancement = contentErrorEnhancement;
            console.log("\u2705 Content Script Error Enhancement ready");
            
            // Check if page has many images and enable aggressive cleanup
            const imageCount = document.querySelectorAll('img').length;
            if (imageCount > 100) {
              console.warn(`\u26A0\uFE0F Large page detected (${imageCount} images), enabling aggressive cleanup`);
              
              // Force cleanup every 30 seconds on large pages
              setInterval(() => {
                if (performance.memory && performance.memory.usedJSHeapSize > 150 * 1024 * 1024) {
                  console.log("\u{1F9F9} Periodic cleanup triggered");
                  if (window.contentErrorEnhancement) {
                    window.contentErrorEnhancement.performCleanup();
                  }
                }
              }, 30000);
            }
          }
        } catch (error) {
          console.error("\u274C Failed to initialize Content Script Error Enhancement:", error);
        }
      }
      if (typeof module !== "undefined" && module.exports) {
        module.exports = ContentScriptErrorEnhancement;
      } else if (typeof window !== "undefined") {
        window.ContentScriptErrorEnhancement = ContentScriptErrorEnhancement;
      }
      console.log("\u2705 Content Script Error Enhancement loaded successfully");
      console.log("\u{1F680} Loading Advanced Collector System...");
      var AdvancedCollectorSystem = class {
        constructor(options = {}) {
          this.options = {
            // Performance settings
            concurrency: options.concurrency || 5,
            timeout: options.timeout || 3e4,
            maxDocuments: options.maxDocuments || 10,
            maxDepth: options.maxDepth || 2,
            // Performance safeguards - CRITICAL FIXES REQUIRED
            maxNodesPerDetector: options.maxNodesPerDetector || 1e3,
            timeBudgetPerPass: options.timeBudgetPerPass || 5e3,
            // 5 seconds max per detection method
            largePageThreshold: options.largePageThreshold || 15e3,
            // DOM element count threshold
            // Quality filtering
            minImageSize: options.minImageSize || 100,
            minImageDimensions: options.minImageDimensions || { width: 100, height: 100 },
            supportedFormats: options.supportedFormats || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"],
            customExtensions: options.customExtensions || ["pdf", "zip", "rar"],
            // Detection methods configuration
            enablePerformanceAPI: options.enablePerformanceAPI !== false,
            enableShadowDOM: options.enableShadowDOM !== false,
            enableAdvancedBackground: options.enableAdvancedBackground !== false,
            enableSVGProcessing: options.enableSVGProcessing !== false,
            enableLazyLoading: options.enableLazyLoading !== false,
            enableUrlExtraction: options.enableUrlExtraction !== false,
            enableCustomExtensions: options.enableCustomExtensions !== false,
            enableMultiDocument: options.enableMultiDocument === true,
            ...options
          };
          this.feeds = {
            high_confidence: [],
            // Images with size data or known patterns
            same_origin: [],
            // Same domain resources
            external: [],
            // Cross-domain resources
            pending: []
            // Awaiting validation
          };
          this.processed = [];
          this.cache = /* @__PURE__ */ new Set();
          this.urlCache = /* @__PURE__ */ new Set();
          this.documentQueue = [];
          this.scannedUrls = /* @__PURE__ */ new Set();
          this.validationQueue = [];
          this.positionTracker = /* @__PURE__ */ new Map();
          this.positionCounter = 0;
          this.metrics = {
            totalFound: 0,
            categorized: 0,
            validated: 0,
            duplicates: 0,
            errors: 0,
            processingTime: 0,
            methodStats: {
              performanceAPI: 0,
              shadowDOM: 0,
              advancedBackground: 0,
              svgProcessing: 0,
              lazyLoading: 0,
              urlExtraction: 0,
              customExtensions: 0,
              multiDocument: 0
            }
          };
          this.activeJobs = 0;
          this.isActive = false;
          this.rateLimiters = {
            performanceAPI: { lastCall: 0, minInterval: 100 },
            shadowDOM: { lastCall: 0, minInterval: 200 },
            advancedBackground: { lastCall: 0, minInterval: 150 },
            multiDocument: { lastCall: 0, minInterval: 300 }
          };
          this.enhancedCSSSelector = null;
          this.enhancedSelectorInitialized = false;
          this.smartPatternRecognition = null;
          this.smartPatternInitialized = false;
          this.initializeEnhancedCSSSelector().then(() => {
            this.enhancedSelectorInitialized = true;
            console.log("\u{1F3AF} Enhanced CSS Selector initialization completed");
          }).catch((error) => {
            console.warn("\u26A0\uFE0F Enhanced CSS Selector initialization failed:", error);
            this.enhancedSelectorInitialized = true;
          });
          this.initializeSmartPatternRecognition().then(() => {
            this.smartPatternInitialized = true;
            console.log("\u{1F3AF} Smart Pattern Recognition initialization completed");
          }).catch((error) => {
            console.warn("\u26A0\uFE0F Smart Pattern Recognition initialization failed:", error);
            this.smartPatternInitialized = true;
          });
          this.tableDetectionSystem = null;
          this.tableDetectionInitialized = false;
          this.initializeTableDetection().then(() => {
            this.tableDetectionInitialized = true;
            console.log("\u{1F50D} Table Detection System initialization completed");
          }).catch((error) => {
            console.warn("\u26A0\uFE0F Table Detection System initialization failed:", error);
            this.tableDetectionInitialized = true;
          });
        }
        /**
         * Main collection entry point - orchestrates enhanced detection with EnhancedImageManager
         */
        async collectImages(options = {}) {
          console.log("\u{1F50D} Starting comprehensive image collection with enhanced methods...");
          const startTime = performance.now();
          this.isActive = true;
          try {
            this.resetCollectionState();
            
            // Check memory before processing
            if (performance.memory && 
                performance.memory.usedJSHeapSize > 250 * 1024 * 1024) { // 250MB limit
              console.warn("\u26A0\uFE0F Memory limit reached, enabling aggressive mode");
              this.options.maxNodesPerDetector = Math.min(this.options.maxNodesPerDetector, 500);
              this.options.timeBudgetPerPass = 3000; // Reduce time budget
            }
            
            let enhancedImageManager = null;
            if (typeof EnhancedImageManager !== "undefined") {
              enhancedImageManager = new EnhancedImageManager({
                enableShadowDOM: this.options.enableShadowDOM,
                enableSrcsetDetection: this.options.enableSrcsetDetection !== false,
                enableBackgroundImages: this.options.enableAdvancedBackground,
                enableUrlExtraction: this.options.enableUrlExtraction,
                enableInputImages: this.options.enableInputImages !== false,
                enableLinkDetection: this.options.enableLinkDetection !== false,
                maxNodesPerMethod: this.options.maxNodesPerDetector,
                minImageWidth: this.options.minImageDimensions?.width || 50,
                minImageHeight: this.options.minImageDimensions?.height || 50
              });
              console.log("\u2705 Enhanced Image Manager initialized");
            }
            const domElementCount = await this.safeQuerySelectorAll("*", { countOnly: true });
            if (domElementCount > this.options.largePageThreshold) {
              console.warn(`\u26A0\uFE0F Large page detected (${domElementCount} elements), applying performance safeguards`);
              this.options.maxNodesPerDetector = Math.min(this.options.maxNodesPerDetector, 500);
              this.options.timeBudgetPerPass = Math.min(this.options.timeBudgetPerPass, 3e3);
            }
            let enhancedImages = [];
            if (enhancedImageManager) {
              try {
                enhancedImages = await enhancedImageManager.getImages();
                console.log(`\u{1F3AF} Enhanced detection found ${enhancedImages.length} images`);
                
                // Limit results to prevent memory overflow
                const MAX_IMAGES = 1000;
                if (enhancedImages.length > MAX_IMAGES) {
                  console.warn(`\u26A0\uFE0F Limiting results from ${enhancedImages.length} to ${MAX_IMAGES}`);
                  enhancedImages = enhancedImages.slice(0, MAX_IMAGES);
                }
                
                for (const img of enhancedImages) {
                  const imageObj = {
                    src: img.src,
                    type: img.type || "IMG",
                    width: img.width || 0,
                    height: img.height || 0,
                    discoveryMethod: "enhanced-manager",
                    confidence: 0.85,
                    metadata: {
                      ...img.metadata,
                      fromEnhancedManager: true,
                      originalType: img.type
                    }
                  };
                  await this.categorizeImageEnhanced(imageObj, { method: "enhanced-manager" });
                  this.addToFeed(imageObj, this.determineCategory(imageObj));
                }
                this.metrics.totalFound += enhancedImages.length;
                Object.assign(this.metrics.methodStats, enhancedImageManager.getMetrics().methodStats);
              } catch (error) {
                console.warn("\u26A0\uFE0F Enhanced Image Manager failed:", error);
                this.metrics.errors++;
              }
            }
            await this.detectTabularStructures(options);
            const supplementaryPromises = [
              this.detectPerformanceAPIImages(),
              this.detectSVGElements(),
              this.detectLazyLoadingImages(),
              this.detectCustomExtensions(),
              this.scanMultipleDocuments()
            ];
            const detectionResults = await Promise.allSettled(supplementaryPromises);
            detectionResults.forEach((result, index) => {
              if (result.status === "fulfilled") {
                console.log(`\u2705 Supplementary method ${index + 1} completed: ${result.value.length} items found`);
              } else {
                console.warn(`\u274C Supplementary method ${index + 1} failed:`, result.reason);
                this.metrics.errors++;
              }
            });
            await this.processFeeds();
            const results = this.generateResults();
            this.metrics.processingTime = performance.now() - startTime;
            console.log(`\u2705 Collection completed in ${this.metrics.processingTime.toFixed(2)}ms`);
            console.log(`\u{1F4CA} Results: ${results.length} validated images from ${this.metrics.totalFound} discovered`);
            console.log(`\u{1F3AF} Enhanced Manager contributed: ${enhancedImages.length} images`);
            return {
              success: true,
              images: results,
              metadata: this.generateMetadata(),
              feeds: this.feeds,
              metrics: this.metrics,
              enhancedManagerMetrics: enhancedImageManager ? enhancedImageManager.getMetrics() : null,
              smartPatternMetrics: this.smartPatternRecognition ? this.smartPatternRecognition.getMetrics() : null
            };
          } catch (error) {
            console.error("\u274C Collection failed:", error);
            return {
              success: false,
              error: error.message,
              images: [],
              metadata: this.generateMetadata(),
              feeds: this.feeds,
              metrics: this.metrics
            };
          } finally {
            this.isActive = false;
          }
        }
        // =============================================================================
        // SMART PATTERN RECOGNITION INTEGRATION
        // =============================================================================
        /**
         * Initialize Table Detection System for structured data analysis
         * Ported from Instant Data Scraper's table detection algorithm
         */
        async initializeTableDetection() {
          try {
            console.log("\u{1F50D} Initializing Table Detection System...");
            const tableDetectionClass = await this.waitForClass("TableDetectionSystem", 5e3);
            if (tableDetectionClass) {
              this.tableDetectionSystem = new tableDetectionClass({
                maxTables: this.options.maxTables || 5,
                minChildren: this.options.minChildren || 3,
                minAreaThreshold: this.options.minAreaThreshold || 0.02,
                enableVisualHighlighting: this.options.enableVisualHighlighting !== false,
                enableInfiniteScroll: this.options.enableInfiniteScroll !== false,
                confidenceThreshold: this.options.confidenceThreshold || 0.5
              });
              console.log("\u2705 Table Detection System initialized successfully");
            } else {
              console.warn("\u26A0\uFE0F TableDetectionSystem class not available after timeout");
              this.tableDetectionSystem = null;
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Table Detection System initialization failed:", error);
            this.tableDetectionSystem = null;
          }
        }
        /**
         * Initialize Enhanced CSS Selector system with async loading
         * Implements Simplescraper's sophisticated antonmedv/finder integration
         */
        async initializeEnhancedCSSSelector() {
          try {
            console.log("\u{1F3AF} Initializing Enhanced CSS Selector System...");
            const enhancedSelectorClass = await this.waitForClass("EnhancedCSSSelector", 5e3);
            if (enhancedSelectorClass) {
              this.enhancedCSSSelector = new enhancedSelectorClass({
                timeoutMs: this.options.timeout || 1e3,
                seedMinLength: this.options.seedMinLength || 3,
                optimizedMinLength: this.options.optimizedMinLength || 2,
                enableImageOptimization: this.options.enableAdvancedBackground !== false,
                enableGalleryPattern: this.options.enableSmartPatterns !== false,
                enableCrossSiteOptimization: this.options.enableCrossSiteOptimization !== false,
                enablePerformanceSafeguards: this.options.enablePerformanceAPI !== false,
                maxSelectorLength: this.options.maxSelectorLength || 1e3
              });
              console.log("\u2705 Enhanced CSS Selector system initialized successfully");
            } else {
              console.warn("\u26A0\uFE0F EnhancedCSSSelector class not available after timeout, falling back to basic selectors");
              this.enhancedCSSSelector = null;
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to initialize Enhanced CSS Selector:", error);
            this.enhancedCSSSelector = null;
          }
        }
        /**
         * Initialize Smart Pattern Recognition system with async loading
         * Implements polling mechanism to wait for class availability
         */
        async initializeSmartPatternRecognition() {
          try {
            if (window.__ST?.getSharedDetectionSystem) {
              this.smartPatternRecognition = window.__ST.getSharedDetectionSystem("smartPatternRecognition");
              if (this.smartPatternRecognition) {
                console.log("\u2705 [COORD] Using shared SmartPatternRecognition instance");
                return;
              }
            }
            if (!window.__ST?.isSystemInitialized("smart-pattern-recognition-collector")) {
              const smartPatternClass = await this.waitForClass("SmartPatternRecognition", 5e3);
              if (smartPatternClass) {
                window.__ST?.markSystemInitialized("smart-pattern-recognition-collector");
                this.smartPatternRecognition = new smartPatternClass({
                  minConfidenceScore: this.options.minConfidenceScore || 0.3,
                  highConfidenceThreshold: this.options.highConfidenceThreshold || 0.75,
                  minImageWidth: this.options.minImageDimensions?.width || 30,
                  // More lenient
                  minImageHeight: this.options.minImageDimensions?.height || 30,
                  // More lenient
                  enableAdvancedPatterns: this.options.enableSmartPatterns !== false,
                  enableUrlValidation: this.options.enableUrlValidation !== false,
                  enableContentValidation: this.options.enableContentValidation !== false
                });
                console.log("\u2705 Smart Pattern Recognition system initialized successfully");
              } else {
                console.warn("\u26A0\uFE0F SmartPatternRecognition class not available after timeout, falling back to basic categorization");
                this.smartPatternRecognition = null;
              }
            }
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to initialize Smart Pattern Recognition:", error);
            this.smartPatternRecognition = null;
          }
        }
        /**
         * Wait for a class to become available with polling mechanism
         * @param {string} className - Name of the class to wait for
         * @param {number} timeout - Timeout in milliseconds (default 5000)
         * @param {number} pollInterval - Polling interval in milliseconds (default 100)
         * @returns {Promise<Function|null>} The class constructor or null if timeout
         */
        async waitForClass(className, timeout = 5e3, pollInterval = 100) {
          return new Promise((resolve) => {
            const startTime = Date.now();
            const checkClass = () => {
              if (typeof window !== "undefined" && window[className]) {
                resolve(window[className]);
                return;
              }
              if (typeof globalThis !== "undefined" && globalThis[className]) {
                resolve(globalThis[className]);
                return;
              }
              try {
                const scopes = [window, globalThis, self];
                for (const scope of scopes) {
                  if (scope && typeof scope === "object" && scope[className]) {
                    const ClassConstructor = scope[className];
                    if (typeof ClassConstructor === "function") {
                      resolve(ClassConstructor);
                      return;
                    }
                  }
                }
              } catch (e) {
              }
              if (Date.now() - startTime >= timeout) {
                console.warn(`\u26A0\uFE0F Timeout waiting for ${className} class to be available`);
                resolve(null);
                return;
              }
              setTimeout(checkClass, pollInterval);
            };
            checkClass();
          });
        }
        /**
         * Enhanced image categorization using Smart Pattern Recognition
         */
        async categorizeImageEnhanced(imageObj, context = {}) {
          if (!this.smartPatternRecognition) {
            return this.categorizeImage(imageObj);
          }
          try {
            const confidenceData = await this.smartPatternRecognition.calculateConfidenceScore(imageObj, context);
            imageObj.confidence = confidenceData.confidence;
            imageObj.patternAnalysis = confidenceData.breakdown;
            imageObj.processingTime = confidenceData.processingTime;
            const categorizedImage = this.smartPatternRecognition.categorizeImageEnhanced(imageObj, confidenceData);
            imageObj.category = categorizedImage.category;
            imageObj.categoryReason = categorizedImage.categoryReason;
            imageObj.confidenceTier = categorizedImage.confidenceTier;
            const feedCategory = this.determineCategory(imageObj);
            this.addToFeed(imageObj, feedCategory);
            return imageObj;
          } catch (error) {
            console.warn("Smart categorization failed, falling back to basic method:", error);
            return this.categorizeImage(imageObj);
          }
        }
        // =============================================================================
        // DETECTION METHOD 1: PERFORMANCE API INTEGRATION
        // =============================================================================
        /**
         * Rate limiting utility for heavy detectors
         */
        async enforceRateLimit(methodName) {
          const limiter = this.rateLimiters[methodName];
          if (!limiter) return;
          const now = Date.now();
          const timeSinceLastCall = now - limiter.lastCall;
          if (timeSinceLastCall < limiter.minInterval) {
            const waitTime = limiter.minInterval - timeSinceLastCall;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
          limiter.lastCall = Date.now();
        }
        /**
         * Time budget enforcement for individual detector methods
         */
        createTimeBudgetController(methodName) {
          const startTime = performance.now();
          const timeBudget = this.options.timeBudgetPerPass;
          return {
            checkBudget: () => {
              const elapsed = performance.now() - startTime;
              if (elapsed > timeBudget) {
                console.warn(`\u23F0 Time budget exceeded for ${methodName} (${elapsed.toFixed(2)}ms > ${timeBudget}ms)`);
                return false;
              }
              return true;
            },
            getElapsed: () => performance.now() - startTime
          };
        }
        /**
         * Detect images from browser performance entries
         * Captures CSS background images and IMG elements loaded via JS
         */
        async detectPerformanceAPIImages() {
          if (!this.options.enablePerformanceAPI) return [];
          await this.enforceRateLimit("performanceAPI");
          const images = [];
          try {
            console.log("\u{1F50D} Scanning Performance API entries...");
            const entries = performance.getEntriesByType("resource");
            for (const entry of entries) {
              if (entry.initiatorType === "img" || entry.initiatorType === "css" && this.isImageResource(entry.name)) {
                const imageObj = {
                  src: entry.name,
                  type: this.detectMimeType(entry.name),
                  verified: true,
                  discoveryMethod: "performance-api",
                  confidence: 0.85,
                  metadata: {
                    initiatorType: entry.initiatorType,
                    transferSize: entry.transferSize,
                    duration: entry.duration,
                    timestamp: entry.startTime
                  }
                };
                await this.categorizeImageEnhanced(imageObj, { method: "performance-api" });
                images.push(imageObj);
                this.metrics.methodStats.performanceAPI++;
              }
            }
            console.log(`\u2705 Performance API: Found ${images.length} images`);
            return images;
          } catch (error) {
            console.warn("\u26A0\uFE0F Performance API detection failed:", error);
            return [];
          }
        }
        // =============================================================================
        // DETECTION METHOD 2: SHADOW DOM SUPPORT
        // =============================================================================
        /**
         * Complete DOM traversal including closed shadow roots
         */
        async detectShadowDOMImages() {
          if (!this.options.enableShadowDOM) return [];
          await this.enforceRateLimit("shadowDOM");
          const images = [];
          const shadowRoots = [];
          try {
            console.log("\u{1F50D} Scanning Shadow DOM...");
            await this.findShadowRoots(document, shadowRoots);
            for (const shadowRoot of shadowRoots) {
              try {
                const shadowImages = this.extractImagesFromDocument(shadowRoot);
                for (const img of shadowImages) {
                  img.discoveryMethod = "shadow-dom";
                  img.confidence = 0.8;
                  img.metadata = {
                    ...img.metadata,
                    shadowHost: shadowRoot.host ? shadowRoot.host.tagName : "unknown"
                  };
                  await this.categorizeImageEnhanced(img, { method: "shadow-dom", element: img.element });
                  images.push(img);
                }
                this.metrics.methodStats.shadowDOM += shadowImages.length;
              } catch (error) {
                console.warn("\u26A0\uFE0F Failed to scan shadow root:", error);
              }
            }
            console.log(`\u2705 Shadow DOM: Found ${images.length} images in ${shadowRoots.length} shadow roots`);
            return images;
          } catch (error) {
            console.warn("\u26A0\uFE0F Shadow DOM detection failed:", error);
            return [];
          }
        }
        /**
         * Recursively find all shadow roots in the document
         */
        async findShadowRoots(doc, roots = []) {
          try {
            for (const element of await this.safeQuerySelectorAll("*", { root: doc })) {
              if (element.shadowRoot) {
                try {
                  await this.findShadowRoots(element.shadowRoot, roots);
                  roots.push(element.shadowRoot);
                } catch (e) {
                  console.debug("Closed shadow root detected:", element.tagName);
                }
              }
            }
          } catch (error) {
            console.warn("Error traversing shadow roots:", error);
          }
          return roots;
        }
        // =============================================================================
        // DETECTION METHOD 3: ADVANCED BACKGROUND DETECTION
        // =============================================================================
        /**
         * Extract images from computed styles including :before and :after pseudo-elements
         */
        async detectAdvancedBackgroundImages() {
          if (!this.options.enableAdvancedBackground) return [];
          await this.enforceRateLimit("advancedBackground");
          const images = [];
          try {
            console.log("\u{1F50D} Scanning computed styles and pseudo-elements...");
            const elements = await this.safeQuerySelectorAll("*");
            const maxElements = Math.min(elements.length, this.options.maxNodesPerDetector);
            const limitedElements = Array.from(elements).slice(0, maxElements);
            for (const element of limitedElements) {
              try {
                const styles = [
                  { style: getComputedStyle(element), pseudo: null },
                  { style: getComputedStyle(element, ":before"), pseudo: ":before" },
                  { style: getComputedStyle(element, ":after"), pseudo: ":after" }
                ];
                for (const { style, pseudo } of styles) {
                  const backgroundImage = style.backgroundImage;
                  if (backgroundImage && backgroundImage !== "none" && backgroundImage.includes("url(")) {
                    const urls = this.extractUrlsFromStyle(backgroundImage);
                    for (const url of urls) {
                      const imageObj = {
                        src: url,
                        element,
                        discoveryMethod: "advanced-background",
                        confidence: 0.75,
                        metadata: {
                          pseudoElement: pseudo,
                          elementTag: element.tagName,
                          className: element.className,
                          backgroundSize: style.backgroundSize,
                          backgroundPosition: style.backgroundPosition,
                          backgroundRepeat: style.backgroundRepeat
                        }
                      };
                      await this.categorizeImageEnhanced(imageObj, { method: "background-images", element });
                      images.push(imageObj);
                      this.metrics.methodStats.advancedBackground++;
                    }
                  }
                }
              } catch (error) {
                console.debug("Skipping element due to style access error:", element.tagName);
              }
            }
            console.log(`\u2705 Advanced Background: Found ${images.length} background images`);
            return images;
          } catch (error) {
            console.warn("\u26A0\uFE0F Advanced background detection failed:", error);
            return [];
          }
        }
        /**
         * Extract URLs from CSS background-image style values
         */
        extractUrlsFromStyle(backgroundImage) {
          const urls = [];
          const urlRegex = /url\(['"]?([^'"]+)['"]?\)/g;
          let match;
          while ((match = urlRegex.exec(backgroundImage)) !== null) {
            urls.push(match[1]);
          }
          return urls;
        }
        // =============================================================================
        // DETECTION METHOD 4: SVG ELEMENT PROCESSING
        // =============================================================================
        /**
         * Convert SVG elements to data URLs
         */
        async detectSVGElements() {
          if (!this.options.enableSVGProcessing) return [];
          const images = [];
          try {
            console.log("\u{1F50D} Processing SVG elements...");
            const svgElements = await this.safeQuerySelectorAll("svg");
            for (const svg of svgElements) {
              try {
                const clonedSvg = svg.cloneNode(true);
                clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                const svgString = new XMLSerializer().serializeToString(clonedSvg);
                const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
                const imageObj = {
                  src: dataUrl,
                  element: svg,
                  type: "image/svg+xml",
                  discoveryMethod: "svg-processing",
                  confidence: 0.9,
                  metadata: {
                    elementTag: "svg",
                    viewBox: svg.getAttribute("viewBox"),
                    width: svg.getAttribute("width") || svg.getBoundingClientRect().width,
                    height: svg.getAttribute("height") || svg.getBoundingClientRect().height,
                    originalSvg: true
                  }
                };
                await this.categorizeImageEnhanced(imageObj, { method: "svg-processing", element: svg });
                images.push(imageObj);
                this.metrics.methodStats.svgProcessing++;
              } catch (error) {
                console.warn("Failed to process SVG element:", error);
              }
            }
            console.log(`\u2705 SVG Processing: Converted ${images.length} SVG elements`);
            return images;
          } catch (error) {
            console.warn("\u26A0\uFE0F SVG processing failed:", error);
            return [];
          }
        }
        // =============================================================================
        // DETECTION METHOD 5: LAZY LOADING SUPPORT
        // =============================================================================
        /**
         * Detect data-src, data-lazy, data-original attributes and other lazy loading patterns
         */
        async detectLazyLoadingImages() {
          if (!this.options.enableLazyLoading) return [];
          const images = [];
          const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
          try {
            console.log("\u{1F50D} Detecting lazy loading images...");
            const lazySelectors = [
              "img[data-src]",
              "img[data-lazy]",
              "img[data-original]",
              "img[data-lazy-src]",
              "img[data-echo]",
              "img[data-srcset]",
              "[data-bg]",
              "[data-background]",
              "[data-background-image]",
              ".lazy[data-src]",
              ".lazyload[data-src]"
            ];
            for (const selector of lazySelectors) {
              try {
                const elements = cachedQuery(selector);
                for (const element of elements) {
                  const lazySrc = this.extractLazySrc(element);
                  if (lazySrc) {
                    const imageObj = {
                      src: lazySrc,
                      element,
                      discoveryMethod: "lazy-loading",
                      confidence: 0.85,
                      metadata: {
                        elementTag: element.tagName,
                        lazyAttribute: this.identifyLazyAttribute(element),
                        loading: element.getAttribute("loading"),
                        className: element.className,
                        originalSrc: element.src
                      }
                    };
                    await this.categorizeImageEnhanced(imageObj, { method: "lazy-loading", element });
                    images.push(imageObj);
                    this.metrics.methodStats.lazyLoading++;
                  }
                }
              } catch (error) {
                console.warn(`Failed to process lazy selector ${selector}:`, error);
              }
            }
            console.log(`\u2705 Lazy Loading: Found ${images.length} lazy-loaded images`);
            return images;
          } catch (error) {
            console.warn("\u26A0\uFE0F Lazy loading detection failed:", error);
            return [];
          }
        }
        /**
         * Extract lazy loading source from element
         */
        extractLazySrc(element) {
          const lazyAttributes = [
            "data-src",
            "data-lazy",
            "data-original",
            "data-lazy-src",
            "data-echo",
            "data-bg",
            "data-background",
            "data-background-image"
          ];
          for (const attr of lazyAttributes) {
            const value = element.getAttribute(attr);
            if (value && this.isValidImageUrl(value)) {
              return value;
            }
          }
          const srcset = element.getAttribute("data-srcset");
          if (srcset) {
            const firstSrc = srcset.split(",")[0].trim().split(" ")[0];
            if (this.isValidImageUrl(firstSrc)) {
              return firstSrc;
            }
          }
          return null;
        }
        /**
         * Identify which lazy loading attribute was used
         */
        identifyLazyAttribute(element) {
          const lazyAttributes = [
            "data-src",
            "data-lazy",
            "data-original",
            "data-lazy-src",
            "data-echo",
            "data-bg",
            "data-background",
            "data-background-image",
            "data-srcset"
          ];
          for (const attr of lazyAttributes) {
            if (element.hasAttribute(attr)) {
              return attr;
            }
          }
          return "unknown";
        }
        // =============================================================================
        // DETECTION METHOD 6: HARD-CODED URL EXTRACTION
        // =============================================================================
        /**
         * Regex-based URL discovery from page content
         */
        async extractHardcodedURLs() {
          if (!this.options.enableUrlExtraction) return [];
          const images = [];
          try {
            console.log("\u{1F50D} Extracting hard-coded URLs...");
            const pageContent = document.documentElement.outerHTML;
            const imageUrlRegex = /(?:https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^\s<>"']*)?)/gi;
            const matches = pageContent.match(imageUrlRegex) || [];
            const dataUrlRegex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;
            const dataMatches = pageContent.match(dataUrlRegex) || [];
            const allUrls = [...matches, ...dataMatches];
            for (const url of allUrls) {
              if (!this.urlCache.has(url)) {
                this.urlCache.add(url);
                const imageObj = {
                  src: url,
                  discoveryMethod: "url-extraction",
                  confidence: 0.7,
                  metadata: {
                    source: "hardcoded-html",
                    extractedFromContent: true
                  }
                };
                await this.categorizeImageEnhanced(imageObj, { method: "url-extraction" });
                images.push(imageObj);
                this.metrics.methodStats.urlExtraction++;
              }
            }
            const scriptImages = await this.extractFromScripts();
            images.push(...scriptImages);
            console.log(`\u2705 URL Extraction: Found ${images.length} hard-coded URLs`);
            return images;
          } catch (error) {
            console.warn("\u26A0\uFE0F URL extraction failed:", error);
            return [];
          }
        }
        /**
         * Extract image URLs from script tags and JSON content
         */
        async extractFromScripts() {
          const images = [];
          try {
            const scripts = await this.safeQuerySelectorAll("script");
            for (const script of scripts) {
              if (script.textContent) {
                const imageUrlRegex = /(?:["'])(https?:\/\/[^"']+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)(?:\?[^"']*)?)(["'])/gi;
                let match;
                while ((match = imageUrlRegex.exec(script.textContent)) !== null) {
                  const url = match[1];
                  if (!this.urlCache.has(url)) {
                    this.urlCache.add(url);
                    const imageObj = {
                      src: url,
                      discoveryMethod: "script-extraction",
                      confidence: 0.65,
                      metadata: {
                        source: "script-tag",
                        scriptType: script.type || "text/javascript"
                      }
                    };
                    await this.categorizeImageEnhanced(imageObj, { method: "script-extraction" });
                    images.push(imageObj);
                    this.metrics.methodStats.urlExtraction++;
                  }
                }
              }
            }
          } catch (error) {
            console.warn("Script extraction failed:", error);
          }
          return images;
        }
        // =============================================================================
        // DETECTION METHOD 7: CUSTOM EXTENSION SUPPORT
        // =============================================================================
        /**
         * Handle PDF and non-image file types
         */
        async detectCustomExtensions() {
          if (!this.options.enableCustomExtensions) return [];
          const files = [];
          try {
            console.log("\u{1F50D} Detecting custom file extensions...");
            const extensions = this.options.customExtensions.join("|");
            const customFileRegex = new RegExp(`https?:\\/\\/[^\\s<>"']+\\.(${extensions})(?:\\?[^\\s<>"']*)?`, "gi");
            const pageContent = document.documentElement.outerHTML;
            const matches = pageContent.match(customFileRegex) || [];
            const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
            const links = cachedQuery("a[href]");
            for (const link of links) {
              const href = link.href;
              if (this.options.customExtensions.some((ext) => href.toLowerCase().includes(`.${ext}`))) {
                matches.push(href);
              }
            }
            for (const url of [...new Set(matches)]) {
              const fileObj = {
                src: url,
                type: this.detectFileType(url),
                discoveryMethod: "custom-extensions",
                confidence: 0.8,
                metadata: {
                  fileExtension: this.extractFileExtension(url),
                  isCustomType: true
                }
              };
              await this.categorizeImageEnhanced(fileObj, { method: "custom-extensions" });
              files.push(fileObj);
              this.metrics.methodStats.customExtensions++;
            }
            console.log(`\u2705 Custom Extensions: Found ${files.length} custom files`);
            return files;
          } catch (error) {
            console.warn("\u26A0\uFE0F Custom extension detection failed:", error);
            return [];
          }
        }
        // =============================================================================
        // DETECTION METHOD 8: MULTI-DOCUMENT SCANNING
        // =============================================================================
        /**
         * Cross-page image discovery with base URL fixing
         */
        async scanMultipleDocuments() {
          if (!this.options.enableMultiDocument || this.options.maxDepth <= 1) return [];
          await this.enforceRateLimit("multiDocument");
          const images = [];
          try {
            console.log("\u{1F50D} Scanning multiple documents...");
            await this.discoverLinkedDocuments();
            for (const docUrl of this.documentQueue) {
              if (this.scannedUrls.has(docUrl)) continue;
              this.scannedUrls.add(docUrl);
              try {
                const docImages = await this.scanLinkedDocument(docUrl);
                images.push(...docImages);
                this.metrics.methodStats.multiDocument += docImages.length;
                if (images.length > 1e3) break;
              } catch (error) {
                console.warn(`Failed to scan document ${docUrl}:`, error);
              }
            }
            console.log(`\u2705 Multi-Document: Found ${images.length} images from ${this.documentQueue.length} documents`);
            return images;
          } catch (error) {
            console.warn("\u26A0\uFE0F Multi-document scanning failed:", error);
            return [];
          }
        }
        /**
         * Discover linked documents to scan
         */
        async discoverLinkedDocuments() {
          const cachedQuery = window.__ST?.cachedQuery || ((sel) => Array.from(document.querySelectorAll(sel)));
          const links = cachedQuery("a[href]");
          for (const link of links) {
            if (this.documentQueue.length >= this.options.maxDocuments) break;
            try {
              const url = new URL(link.href, window.location.href);
              if (url.origin === window.location.origin && !this.scannedUrls.has(url.href) && this.isLikelyImageGalleryPage(link)) {
                this.documentQueue.push(url.href);
              }
            } catch (error) {
            }
          }
        }
        /**
         * Check if a link likely leads to an image gallery page
         */
        isLikelyImageGalleryPage(link) {
          const href = link.href.toLowerCase();
          const text = link.textContent.toLowerCase();
          const galleryIndicators = [
            "gallery",
            "photos",
            "images",
            "album",
            "portfolio",
            "picture",
            "media",
            "slideshow",
            "carousel"
          ];
          return galleryIndicators.some(
            (indicator) => href.includes(indicator) || text.includes(indicator)
          );
        }
        /**
         * Scan a linked document for images
         */
        async scanLinkedDocument(url) {
          try {
            const response = await fetch(url, {
              headers: { "Accept": "text/html" }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const base = doc.createElement("base");
            base.href = url;
            doc.head.appendChild(base);
            const images = this.extractImagesFromDocument(doc, url);
            for (const img of images) {
              img.discoveryMethod = "multi-document";
              img.confidence = 0.75;
              img.metadata = {
                ...img.metadata,
                sourceDocument: url
              };
              await this.categorizeImageEnhanced(img, { method: "multi-document", sourceDocument: url });
            }
            return images;
          } catch (error) {
            throw new Error(`Failed to scan ${url}: ${error.message}`);
          }
        }
        // =============================================================================
        // TABLE DETECTION AND STRUCTURED DATA ANALYSIS
        // =============================================================================
        /**
         * Detect tabular structures using the Table Detection System
         * Implements "try another" functionality and visual highlighting
         * Produces normalized {headers, rows} payload for export
         */
        async detectTabularStructures(options = {}) {
          console.log("\u{1F50D} Starting tabular structure detection...");
          try {
            if (options.enableTableDetection === false || !this.tableDetectionInitialized) {
              console.log("\u23ED\uFE0F Table detection skipped or not initialized");
              return [];
            }
            const domElementCount = document.querySelectorAll("*").length;
            const isLargePage = domElementCount > this.options.largePageThreshold;
            if (isLargePage) {
              console.warn(`\u26A0\uFE0F Large page detected (${domElementCount} elements), applying table detection limits`);
            }
            if (!this.tableDetectionSystem) {
              console.warn("\u26A0\uFE0F Table Detection System not available");
              return [];
            }
            const detectionOptions = {
              maxTables: isLargePage ? 3 : options.maxTables || 5,
              minChildren: options.minChildren || 3,
              minAreaThreshold: options.minAreaThreshold || 0.02,
              enableVisualHighlighting: options.enableVisualHighlighting !== false,
              enableInfiniteScroll: options.enableInfiniteScroll !== false,
              confidenceThreshold: options.confidenceThreshold || 0.5,
              // Performance constraints for large pages
              maxElementsToScan: isLargePage ? 1e3 : 5e3,
              timeBudget: isLargePage ? 3e3 : 8e3
              // ms
            };
            console.log(`\u{1F3AF} Detecting tables with options:`, detectionOptions);
            const detectedTables = await this.tableDetectionSystem.detectTables(detectionOptions);
            if (!detectedTables || detectedTables.length === 0) {
              console.log("\u{1F4CA} No tabular structures detected");
              return [];
            }
            console.log(`\u2705 Detected ${detectedTables.length} tabular structures`);
            const processedTables = [];
            for (let i = 0; i < detectedTables.length; i++) {
              const tableData = detectedTables[i];
              try {
                const extractedData = this.tableDetectionSystem.extractTableData(tableData);
                if (extractedData && extractedData.rows && extractedData.rows.length > 0) {
                  const normalizedTable = {
                    src: `table-${i}`,
                    // Unique identifier
                    type: "TABLE",
                    discoveryMethod: "table-detection",
                    confidence: tableData.confidence || 0.7,
                    headers: extractedData.headers || [],
                    rows: extractedData.rows || [],
                    dataRows: extractedData.dataRows || [],
                    metadata: {
                      selector: extractedData.selector,
                      tableIndex: i,
                      area: tableData.area,
                      score: tableData.score,
                      childrenCount: tableData.childrenCount,
                      goodClasses: tableData.goodClasses,
                      patternStrength: extractedData.metadata?.patternStrength || 0,
                      infiniteScrollDetected: extractedData.metadata?.infiniteScrollDetected || false,
                      timestamp: Date.now(),
                      // Table-specific metadata
                      tableData: {
                        headers: extractedData.headers || [],
                        rows: extractedData.rows || [],
                        dataRows: extractedData.dataRows || []
                      },
                      // Export-ready payload
                      exportPayload: {
                        headers: extractedData.headers || [],
                        rows: extractedData.dataRows || extractedData.rows || []
                      }
                    },
                    // Methods for "try another" functionality
                    tryAnother: () => this.tryAnotherTable(),
                    highlight: () => this.highlightTable(tableData),
                    clearHighlight: () => this.clearTableHighlighting(),
                    extractData: () => extractedData
                  };
                  await this.categorizeImageEnhanced(normalizedTable, { method: "table-detection" });
                  this.addToFeed(normalizedTable, "high_confidence");
                  processedTables.push(normalizedTable);
                  this.metrics.totalFound++;
                  this.metrics.methodStats.tableDetection = (this.metrics.methodStats.tableDetection || 0) + 1;
                  console.log(`\u{1F4CB} Processed table ${i + 1}: ${extractedData.headers?.length || 0} headers, ${extractedData.dataRows?.length || extractedData.rows?.length || 0} rows`);
                }
              } catch (error) {
                console.warn(`\u26A0\uFE0F Failed to process table ${i}:`, error);
                this.metrics.errors++;
              }
            }
            if (processedTables.length > 0 && detectionOptions.enableVisualHighlighting) {
              try {
                this.tableDetectionSystem.highlightTable(detectedTables[0]);
                console.log("\u{1F3A8} Visual highlighting applied to first detected table");
              } catch (error) {
                console.warn("\u26A0\uFE0F Failed to apply visual highlighting:", error);
              }
            }
            console.log(`\u2705 Table detection completed: ${processedTables.length} tables processed`);
            return processedTables;
          } catch (error) {
            console.error("\u274C Table detection failed:", error);
            this.metrics.errors++;
            return [];
          }
        }
        /**
         * "Try another table" functionality - cycles through detected tables
         */
        async tryAnotherTable() {
          if (!this.tableDetectionSystem) {
            console.warn("\u26A0\uFE0F Table Detection System not available for table cycling");
            return null;
          }
          try {
            const nextTable = this.tableDetectionSystem.tryAnotherTable();
            if (nextTable) {
              console.log(`\u{1F504} Switched to table: ${nextTable.selector}`);
              const extractedData = this.tableDetectionSystem.extractTableData(nextTable);
              return {
                success: true,
                tableData: extractedData,
                tableInfo: {
                  selector: nextTable.selector,
                  confidence: nextTable.confidence,
                  area: nextTable.area,
                  score: nextTable.score
                }
              };
            } else {
              console.log("\u26A0\uFE0F No more tables to cycle through");
              return { success: false, message: "No more tables available" };
            }
          } catch (error) {
            console.error("\u274C Failed to switch to another table:", error);
            return { success: false, error: error.message };
          }
        }
        /**
         * Highlight specified table with visual indicators
         */
        highlightTable(tableData) {
          if (!this.tableDetectionSystem) {
            console.warn("\u26A0\uFE0F Table Detection System not available for highlighting");
            return;
          }
          try {
            this.tableDetectionSystem.highlightTable(tableData);
            console.log("\u{1F3A8} Table highlighting applied");
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to highlight table:", error);
          }
        }
        /**
         * Clear all table highlighting
         */
        clearTableHighlighting() {
          if (!this.tableDetectionSystem) {
            console.warn("\u26A0\uFE0F Table Detection System not available for clearing highlights");
            return;
          }
          try {
            this.tableDetectionSystem.clearTableHighlighting();
            console.log("\u{1F9F9} Table highlighting cleared");
          } catch (error) {
            console.warn("\u26A0\uFE0F Failed to clear table highlighting:", error);
          }
        }
        /**
         * Get current table data in normalized format for export
         */
        async getCurrentTableData() {
          if (!this.tableDetectionSystem) {
            console.warn("\u26A0\uFE0F Table Detection System not available");
            return null;
          }
          try {
            const currentTable = this.tableDetectionSystem.getCurrentTable();
            if (!currentTable) {
              console.log("\u26A0\uFE0F No current table selected");
              return null;
            }
            const extractedData = this.tableDetectionSystem.extractTableData(currentTable);
            if (!extractedData) {
              console.warn("\u26A0\uFE0F Failed to extract data from current table");
              return null;
            }
            return {
              headers: extractedData.headers || [],
              rows: extractedData.dataRows || extractedData.rows || [],
              metadata: {
                selector: extractedData.selector,
                confidence: currentTable.confidence,
                area: currentTable.area,
                score: currentTable.score,
                tableData: extractedData
              }
            };
          } catch (error) {
            console.error("\u274C Failed to get current table data:", error);
            return null;
          }
        }
        /**
         * Get all detected tables in normalized format
         */
        async getAllTableData() {
          if (!this.tableDetectionSystem) {
            console.warn("\u26A0\uFE0F Table Detection System not available");
            return [];
          }
          try {
            const allTables = this.tableDetectionSystem.getAllTables();
            const normalizedTables = [];
            for (const table of allTables) {
              const extractedData = this.tableDetectionSystem.extractTableData(table);
              if (extractedData) {
                normalizedTables.push({
                  headers: extractedData.headers || [],
                  rows: extractedData.dataRows || extractedData.rows || [],
                  metadata: {
                    selector: extractedData.selector,
                    confidence: table.confidence,
                    area: table.area,
                    score: table.score,
                    tableData: extractedData
                  }
                });
              }
            }
            return normalizedTables;
          } catch (error) {
            console.error("\u274C Failed to get all table data:", error);
            return [];
          }
        }
        // =============================================================================
        // FEED CATEGORIZATION AND PROCESSING
        // =============================================================================
        /**
         * Categorize image into appropriate feed based on confidence and origin
         */
        categorizeImage(imageObj) {
          if (this.cache.has(imageObj.src)) {
            this.metrics.duplicates++;
            return false;
          }
          this.cache.add(imageObj.src);
          this.metrics.totalFound++;
          this.positionTracker.set(imageObj.src, this.positionCounter++);
          imageObj.position = this.positionCounter - 1;
          const category = this.determineCategory(imageObj);
          this.feeds[category].push(imageObj);
          this.metrics.categorized++;
          return true;
        }
        /**
         * Enhanced category determination using Smart Pattern Recognition
         */
        determineCategory(imageObj) {
          if (imageObj.category) {
            const categoryMap = {
              "high_confidence": "high_confidence",
              "same_origin": "same_origin",
              "external_resources": "external"
            };
            return categoryMap[imageObj.category] || "external";
          }
          if (imageObj.confidence >= 0.75 || imageObj.metadata && (imageObj.metadata.width || imageObj.metadata.height) || this.isKnownImageExtension(imageObj.src)) {
            return "high_confidence";
          }
          try {
            const url = new URL(imageObj.src, window.location.href);
            if (url.origin === window.location.origin) {
              return "same_origin";
            }
          } catch (e) {
          }
          return "external";
        }
        /**
         * Check if URL has a known image extension
         */
        isKnownImageExtension(src) {
          const knownExtensions = this.options.supportedFormats;
          const url = src.toLowerCase();
          return knownExtensions.some(
            (ext) => url.includes(`.${ext}`) || src.startsWith(`data:image/${ext}`)
          );
        }
        /**
         * Process all feeds through validation pipeline
         */
        async processFeeds() {
          console.log("\u{1F504} Processing feeds through validation pipeline...");
          await this.processQueue(this.feeds.high_confidence, "high_confidence");
          await this.processQueue(this.feeds.same_origin, "same_origin");
          await this.processQueue(this.feeds.external, "external");
        }
        /**
         * Enhanced feed queue processing with Smart Pattern Recognition
         */
        async processQueue(queue, queueName) {
          console.log(`Processing ${queueName} queue: ${queue.length} items`);
          const validationPromises = queue.map(async (imageObj, index) => {
            try {
              if (this.activeJobs >= this.options.concurrency) {
                await this.waitForAvailableSlot();
              }
              this.activeJobs++;
              const validatedImage = await this.validateImageEnhanced(imageObj);
              this.activeJobs--;
              if (validatedImage.valid) {
                this.processed.push(validatedImage);
                this.metrics.validated++;
              }
              return validatedImage;
            } catch (error) {
              this.activeJobs--;
              console.warn(`Validation failed for ${imageObj.src}:`, error);
              return { ...imageObj, valid: false, error: error.message };
            }
          });
          await Promise.allSettled(validationPromises);
        }
        /**
         * Enhanced image validation using Smart Pattern Recognition
         */
        async validateImageEnhanced(imageObj) {
          try {
            if (this.smartPatternRecognition) {
              const contentValidation = await this.smartPatternRecognition.validateContent(imageObj);
              imageObj.contentValidation = contentValidation;
              imageObj.valid = contentValidation.isValid;
              if (contentValidation.confidence && imageObj.confidence) {
                imageObj.confidence = (imageObj.confidence + contentValidation.confidence) / 2;
              } else if (contentValidation.confidence) {
                imageObj.confidence = contentValidation.confidence;
              }
              return imageObj;
            } else {
              return await this.validateImage(imageObj);
            }
          } catch (error) {
            console.warn("Enhanced validation failed, falling back to basic validation:", error);
            return await this.validateImage(imageObj);
          }
        }
        /**
         * Wait for an available processing slot
         */
        async waitForAvailableSlot() {
          while (this.activeJobs >= this.options.concurrency) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }
        // =============================================================================
        // VALIDATION PIPELINE
        // =============================================================================
        /**
         * Comprehensive image validation with multiple fallback methods
         */
        async validateImage(imageObj) {
          const fastResult = this.fastValidation(imageObj);
          if (fastResult.confidence > 0.8) {
            return { ...imageObj, ...fastResult, valid: true };
          }
          try {
            const networkResult = await this.networkValidation(imageObj);
            return { ...imageObj, ...networkResult, valid: networkResult.valid };
          } catch (error) {
            return { ...imageObj, ...fastResult, valid: fastResult.confidence > 0.6 };
          }
        }
        /**
         * Fast validation based on URL patterns and extensions
         */
        fastValidation(imageObj) {
          const src = imageObj.src;
          if (src.startsWith("data:image/")) {
            return { confidence: 0.95, method: "data-url", type: this.extractDataUrlType(src) };
          }
          if (this.isKnownImageExtension(src)) {
            return { confidence: 0.85, method: "extension", type: `image/${this.extractFileExtension(src)}` };
          }
          if (this.isCDNImage(src)) {
            return { confidence: 0.8, method: "cdn-pattern", type: "image/unknown" };
          }
          return { confidence: 0.3, method: "unknown", type: "unknown" };
        }
        /**
         * Network-based validation using HEAD requests
         */
        async networkValidation(imageObj) {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), this.options.timeout);
          try {
            const response = await fetch(imageObj.src, {
              method: "HEAD",
              signal: controller.signal,
              headers: {
                "referer": imageObj.metadata?.sourceDocument || window.location.href
              }
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const contentType = response.headers.get("content-type") || "";
            const contentLength = response.headers.get("content-length");
            return {
              valid: contentType.startsWith("image/") || this.isKnownImageExtension(imageObj.src),
              confidence: contentType.startsWith("image/") ? 0.95 : 0.7,
              method: "network",
              type: contentType,
              size: contentLength ? parseInt(contentLength) : null
            };
          } catch (error) {
            throw new Error(`Network validation failed: ${error.message}`);
          }
        }
        // =============================================================================
        // UTILITY METHODS
        // =============================================================================
        /**
         * Extract images from a document (used by multiple detection methods)
         */
        async extractImagesFromDocument(doc, baseUrl = null) {
          const images = [];
          try {
            const imgElements = await this.safeQuerySelectorAll("img[src], img[data-src]", { root: doc });
            for (const img of imgElements) {
              const src = img.src || img.dataset.src;
              if (src) {
                const absoluteUrl = baseUrl ? new URL(src, baseUrl).href : src;
                images.push({
                  src: absoluteUrl,
                  element: img,
                  metadata: {
                    alt: img.alt,
                    width: img.naturalWidth || img.offsetWidth,
                    height: img.naturalHeight || img.offsetHeight,
                    className: img.className,
                    id: img.id
                  }
                });
              }
            }
          } catch (error) {
            console.warn("Error extracting images from document:", error);
          }
          return images;
        }
        /**
         * Check if URL points to a CDN image
         */
        isCDNImage(url) {
          const cdnPatterns = [
            "cdn",
            "cloudfront",
            "imgur",
            "flickr",
            "instagram",
            "facebook",
            "twitter",
            "pinterest",
            "unsplash"
          ];
          return cdnPatterns.some((pattern) => url.toLowerCase().includes(pattern));
        }
        /**
         * Check if URL is valid image URL
         */
        isValidImageUrl(url) {
          if (!url || typeof url !== "string") return false;
          try {
            new URL(url);
            return true;
          } catch {
            return url.startsWith("data:image/");
          }
        }
        /**
         * Detect MIME type from URL
         */
        detectMimeType(url) {
          const extension = this.extractFileExtension(url);
          const mimeMap = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
            "svg": "image/svg+xml",
            "bmp": "image/bmp"
          };
          return mimeMap[extension] || "image/unknown";
        }
        /**
         * Extract file extension from URL
         */
        extractFileExtension(url) {
          try {
            const pathname = new URL(url).pathname;
            return pathname.split(".").pop().toLowerCase();
          } catch {
            const match = url.match(/\.([a-z0-9]+)$/i);
            return match ? match[1].toLowerCase() : "";
          }
        }
        /**
         * Extract data URL type
         */
        extractDataUrlType(dataUrl) {
          const match = dataUrl.match(/^data:image\/([^;]+)/);
          return match ? `image/${match[1]}` : "image/unknown";
        }
        /**
         * Detect file type from URL
         */
        detectFileType(url) {
          const extension = this.extractFileExtension(url);
          if (this.options.supportedFormats.includes(extension)) {
            return this.detectMimeType(url);
          }
          if (this.options.customExtensions.includes(extension)) {
            const typeMap = {
              "pdf": "application/pdf",
              "zip": "application/zip",
              "rar": "application/x-rar-compressed"
            };
            return typeMap[extension] || "application/octet-stream";
          }
          return "unknown";
        }
        /**
         * Check if resource is an image from Performance API
         */
        isImageResource(url) {
          return this.isKnownImageExtension(url) || this.isCDNImage(url);
        }
        /**
         * Reset collection state for new scan
         */
        resetCollectionState() {
          this.feeds = {
            high_confidence: [],
            same_origin: [],
            external: [],
            pending: []
          };
          this.processed = [];
          this.cache.clear();
          this.urlCache.clear();
          this.documentQueue = [];
          this.scannedUrls.clear();
          this.positionTracker.clear();
          this.positionCounter = 0;
          this.metrics = {
            totalFound: 0,
            categorized: 0,
            validated: 0,
            duplicates: 0,
            errors: 0,
            processingTime: 0,
            methodStats: {
              performanceAPI: 0,
              shadowDOM: 0,
              advancedBackground: 0,
              svgProcessing: 0,
              lazyLoading: 0,
              urlExtraction: 0,
              customExtensions: 0,
              multiDocument: 0
            }
          };
        }
        /**
         * Generate final results with metadata enrichment
         */
        generateResults() {
          return this.processed.sort((a, b) => (a.position || 0) - (b.position || 0)).map((image) => ({
            url: image.src,
            src: image.src,
            // For compatibility
            type: image.type || this.detectMimeType(image.src),
            size: image.size,
            confidence: image.confidence,
            discoveryMethod: image.discoveryMethod,
            position: image.position,
            metadata: {
              ...image.metadata,
              validated: true,
              validationMethod: image.method
            }
          }));
        }
        /**
         * Generate comprehensive metadata
         */
        generateMetadata() {
          return {
            totalFound: this.metrics.totalFound,
            validated: this.metrics.validated,
            duplicates: this.metrics.duplicates,
            errors: this.metrics.errors,
            processingTime: this.metrics.processingTime,
            methodStats: this.metrics.methodStats,
            feeds: {
              high_confidence: this.feeds.high_confidence.length,
              same_origin: this.feeds.same_origin.length,
              external: this.feeds.external.length,
              pending: this.feeds.pending.length
            },
            smartPatternStats: this.smartPatternRecognition ? this.smartPatternRecognition.getMetrics() : null,
            performance: {
              averageProcessingTime: this.metrics.processingTime / Math.max(this.metrics.validated, 1),
              successRate: this.metrics.validated / Math.max(this.metrics.totalFound, 1),
              duplicateRate: this.metrics.duplicates / Math.max(this.metrics.totalFound, 1)
            }
          };
        }
        /**
         * Add item to a specific feed with validation and deduplication
         */
        addToFeed(item, feedName = "external") {
          try {
            const validFeeds = ["high_confidence", "same_origin", "external", "pending"];
            const targetFeed = validFeeds.includes(feedName) ? feedName : "external";
            const key = item?.src || item?.url;
            if (!key) return false;
            if (this.cache.has(key)) {
              this.metrics.duplicates++;
              return false;
            }
            this.cache.add(key);
            // Maintain insertion order information
            this.positionTracker.set(key, this.positionCounter++);
            item.position = this.positionCounter - 1;
            this.feeds[targetFeed].push(item);
            this.metrics.categorized++;
            return true;
          } catch (error) {
            console.warn("Failed to add item to feed:", error);
            this.metrics.errors++;
            return false;
          }
        }
      };
      if (typeof window !== "undefined") {
        window.AdvancedCollectorSystem = AdvancedCollectorSystem;
        console.log("\u2705 Advanced Collector System loaded successfully");

        // Fallback: ensure required helpers exist on the prototype (compat shims)
        try {
          const proto = window.AdvancedCollectorSystem && window.AdvancedCollectorSystem.prototype;
          if (proto) {
            // Shim: addToFeed may be missing in some builds; provide a safe implementation
            if (typeof proto.addToFeed !== 'function') {
              proto.addToFeed = function(item, feedName = 'external') {
                try {
                  const validFeeds = ['high_confidence', 'same_origin', 'external', 'pending'];
                  const targetFeed = validFeeds.includes(feedName) ? feedName : 'external';
                  const key = item?.src || item?.url;
                  if (!key) return false;
                  // Initialize caches/feeds if absent
                  this.cache = this.cache || new Set();
                  this.positionTracker = this.positionTracker || new Map();
                  this.positionCounter = this.positionCounter || 0;
                  this.metrics = this.metrics || { duplicates: 0, categorized: 0, errors: 0 };
                  this.feeds = this.feeds || { high_confidence: [], same_origin: [], external: [], pending: [] };
                  if (this.cache.has(key)) {
                    this.metrics.duplicates++;
                    return false;
                  }
                  this.cache.add(key);
                  this.positionTracker.set(key, this.positionCounter++);
                  item.position = this.positionCounter - 1;
                  (this.feeds[targetFeed] || (this.feeds[targetFeed] = [])).push(item);
                  this.metrics.categorized++;
                  return true;
                } catch (error) {
                  console.warn('Failed to add item to feed (shim):', error);
                  if (this.metrics) this.metrics.errors = (this.metrics.errors || 0) + 1;
                  return false;
                }
              }
            }
            if (typeof proto.safeQuerySelectorAll !== 'function') {
              proto.safeQuerySelectorAll = function(selector, options = {}) {
                try {
                  const root = options.root || document;
                  const countOnly = options.countOnly || false;
                  const maxResults = options.maxResults || (this && this.options ? this.options.maxNodesPerDetector : 1000);
                  if (countOnly) {
                    if (selector === '*') {
                      return root.getElementsByTagName('*').length;
                    }
                    const elements2 = root.querySelectorAll(selector);
                    return elements2.length;
                  }
                  const elements = root.querySelectorAll(selector);
                  if (elements.length > maxResults) {
                    console.warn(`⚠️ Query result truncated: ${elements.length} -> ${maxResults} elements`);
                    return Array.from(elements).slice(0, maxResults);
                  }
                  return Array.from(elements);
                } catch (error) {
                  console.warn(`⚠️ Safe query selector failed for "${selector}":`, error);
                  return [];
                }
              };
            }
            if (typeof proto.safeQuerySelector !== 'function') {
              proto.safeQuerySelector = function(selector, options = {}) {
                try {
                  const root = options.root || document;
                  return root.querySelector(selector);
                } catch (error) {
                  console.warn(`⚠️ Safe query selector failed for "${selector}":`, error);
                  return null;
                }
              };
            }
          }
        } catch (e) {
          console.warn('⚠️ Failed to attach fallback query helpers:', e);
        }
      }
      if (typeof module !== "undefined" && module.exports) {
        module.exports = AdvancedCollectorSystem;
      }
      (function registerWithOrchestrator() {
        "use strict";
        function waitForOrchestrator(callback, retries = 10) {
          if (typeof window !== "undefined" && window.__ST?.orchestrator) {
            callback(window.__ST.orchestrator);
          } else if (retries > 0) {
            setTimeout(() => waitForOrchestrator(callback, retries - 1), 100);
          } else {
            console.warn("\u26A0\uFE0F Content Orchestrator not found - Advanced Collector System will not register");
          }
        }
        function registerDetector(orchestrator) {
          try {
            const collector = new AdvancedCollectorSystem({
              // Optimized settings for orchestrated execution
              concurrency: 3,
              // Reduced for coordinated mode
              timeout: 2e4,
              // 20 seconds 
              maxDocuments: 5,
              // Limit document scanning
              maxDepth: 1,
              // Reduce depth to prevent excessive scanning
              // Enable key detection methods but be selective
              enablePerformanceAPI: true,
              enableShadowDOM: true,
              enableAdvancedBackground: true,
              enableSVGProcessing: true,
              enableLazyLoading: true,
              enableUrlExtraction: true,
              enableCustomExtensions: false,
              // Disable for performance
              enableMultiDocument: false,
              // Disable to prevent iframe scanning conflicts
              // Quality filtering
              minImageSize: 50,
              minImageDimensions: { width: 50, height: 50 },
              supportedFormats: ["jpg", "jpeg", "png", "gif", "webp", "svg"]
            });
            async function advancedCollectorDetector(context = {}) {
              console.log("\u{1F680} Advanced Collector System executing...");
              try {
                const result = await collector.collectImages(context);
                if (result.success) {
                  console.log(`\u2705 Advanced Collector completed: ${result.images.length} items collected`);
                  return {
                    success: true,
                    items: result.images,
                    metadata: {
                      ...result.metadata,
                      feeds: result.feeds,
                      metrics: result.metrics,
                      smartPatternMetrics: result.smartPatternMetrics
                    }
                  };
                } else {
                  console.error("\u274C Advanced Collector failed:", result.error);
                  return {
                    success: false,
                    items: [],
                    error: result.error
                  };
                }
              } catch (error) {
                console.error("\u274C Advanced Collector System failed:", error);
                return {
                  success: false,
                  items: [],
                  error: error.message
                };
              }
            }
            const registered = orchestrator.registerDetector("advanced-collector-system", advancedCollectorDetector, {
              priority: 3,
              // Medium priority - runs after pattern recognition
              timeout: 25e3,
              // 25 seconds timeout
              maxRetries: 2,
              dependencies: ["smart-pattern-recognition"]
              // Run after pattern analysis
            });
            if (registered) {
              console.log("\u2705 Advanced Collector System registered with Content Orchestrator");
            } else {
              console.warn("\u26A0\uFE0F Advanced Collector System registration failed - frame not eligible for scanning");
            }
          } catch (error) {
            console.error("\u274C Failed to register Advanced Collector System with orchestrator:", error);
          }
        }
        waitForOrchestrator(registerDetector);
      })();
    }
  });
  require_content_bundle();
  
  // PHASE 4 FIX: Set readiness flag after content script initialization
  // This signals to background handlers that the content script is ready
  window.__STEPTHREE_CONTENT_READY = true;
     console.log('\u2705 STEPTHREE Content Script ready');
// CRITICAL FIX: Add message listener for postMessage communication from background.js
     // This enables SCAN_START, ACTIVATE_SELECTOR, SMART_DETECT, and DETECT_TABLES functionality
     window.addEventListener('message', async (event) => {
       // Security: Only accept messages from same origin
       if (event.source !== window) {
         return;
       }

       const message = event.data;
       
       // Handle STEPTHREE_SCAN_START message
       if (message.type === 'STEPTHREE_SCAN_START') {
         console.log('🚀 Received STEPTHREE_SCAN_START message:', message);
         try {
           // Find the quickScan handler from coordinator.messageHandlers
           const coordinator = window.__STEPTHREE_MESSAGE_COORDINATOR;
           if (!coordinator || !coordinator.messageHandlers) {
             console.error('❌ Message coordinator not available');
             return;
           }
           
           // Search for quickScan handler in the Map
           let quickScanHandler = null;
           for (const [key, handlerInfo] of coordinator.messageHandlers) {
             if (handlerInfo.messageType === 'quickScan') {
               quickScanHandler = handlerInfo.handler;
               break;
             }
           }
           
           if (quickScanHandler) {
             // Create a proper sendResponse function
             const sendResponse = (response) => {
               console.log('✅ Scan completed:', response);
               // Broadcast scan results to sidepanel via chrome.runtime
               chrome.runtime.sendMessage({
                 action: 'SCAN_COMPLETE',
                 source: 'content',
                 payload: {
                   itemCount: response.itemCount,
                   items: response.items,
                   stats: response.stats
                 }
               }).catch(err => console.warn('Failed to send scan results:', err));
             };
             
             await quickScanHandler(
               { settings: message.options },
               sendResponse
             );
           } else {
             console.error('❌ quickScan handler not found in coordinator.messageHandlers');
             console.log('Available handlers:', Array.from(coordinator.messageHandlers.keys()));
           }
         } catch (error) {
           console.error('❌ Error handling STEPTHREE_SCAN_START:', error);
         }
       }
       
       // Handle STEPTHREE_ACTION messages (toggleSelector, enhancedGalleryDetection, etc.)
       else if (message.type === 'STEPTHREE_ACTION') {
         console.log('🎯 Received STEPTHREE_ACTION message:', message);
         try {
           const coordinator = window.__STEPTHREE_MESSAGE_COORDINATOR;
           if (!coordinator || !coordinator.messageHandlers) {
             console.error('❌ Message coordinator not available');
             return;
           }
           
           // Map background action names to content script handler names
           const actionMap = {
             'toggleSelector': 'toggleSelector',
             'enhancedGalleryDetection': 'enhancedGalleryDetection',
             'detectTables': 'detectTables',
             'smartDetect': 'enhancedGalleryDetection'  // Map smartDetect to enhancedGalleryDetection
           };
           
           const handlerName = actionMap[message.action] || message.action;
           
           // Search for the action handler in the Map
           let actionHandler = null;
           for (const [key, handlerInfo] of coordinator.messageHandlers) {
             if (handlerInfo.messageType === handlerName) {
               actionHandler = handlerInfo.handler;
               break;
             }
           }
           
           if (actionHandler) {
             // Create a proper sendResponse function
             const sendResponse = (response) => {
               console.log(`✅ Action ${message.action} completed:`, response);
               // Send response back via chrome.runtime
               chrome.runtime.sendMessage({
                 action: `${message.action.toUpperCase()}_COMPLETE`,
                 source: 'content',
                 payload: response
               }).catch(err => console.warn('Failed to send action response:', err));
             };
             
             await actionHandler(
               message.options || {},
               sendResponse
             );
           } else {
             console.error(`❌ Handler not found for action: ${message.action} (mapped to: ${handlerName})`);
             console.log('Available handlers:', Array.from(coordinator.messageHandlers.keys()));
           }
         } catch (error) {
           console.error(`❌ Error handling STEPTHREE_ACTION ${message.action}:`, error);
         }
       }
     });

     console.log('✅ STEPTHREE postMessage listener registered');   })();
   //# sourceMappingURL=content.js.map

// ============================================================================
// SIMPLE DIRECT MESSAGE HANDLER - GUARANTEED TO WORK
// ============================================================================
(function setupSimpleMessageHandler() {
  console.log('🔧 Setting up simple direct message handler...');
  
  // Check if listener is already registered to prevent duplicates
  if (window.__STEPTHREE_SIMPLE_HANDLER_REGISTERED) {
    console.log('⚠️ Simple message handler already registered, skipping duplicate setup');
    return;
  }
  
  // Direct message listener - no complex coordinator needed
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 SIMPLE HANDLER received:', message);
    
    const messageType = message.type || message.action;
    
    // Handle quickScan
    if (messageType === 'quickScan') {
      console.log('🚀 Handling quickScan...');
      (async () => {
        try {
          const images = Array.from(document.querySelectorAll('img')).map(img => ({
            url: img.src,
            alt: img.alt || '',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          })).filter(img => img.url && img.url.startsWith('http'));
          
          sendResponse({
            success: true,
            itemCount: images.length,
            items: images,
            stats: { total: images.length }
          });
        } catch (error) {
          console.error('❌ quickScan error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep channel open
    }
    
    // Handle detectTables
    if (messageType === 'detectTables') {
      console.log('🔍 Handling detectTables...');
      (async () => {
        try {
          const tables = Array.from(document.querySelectorAll('table')).map((table, i) => ({
            index: i,
            rows: table.rows.length,
            cols: table.rows[0]?.cells.length || 0
          }));
          
          sendResponse({
            success: true,
            tables: tables,
            totalTables: tables.length,
            message: `Found ${tables.length} tables`
          });
        } catch (error) {
          console.error('❌ detectTables error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }
    
    // Handle enhancedGalleryDetection
    if (messageType === 'enhancedGalleryDetection') {
      console.log('🎯 Handling enhancedGalleryDetection...');
      (async () => {
        try {
          const images = Array.from(document.querySelectorAll('img')).map(img => ({
            url: img.src,
            alt: img.alt || ''
          })).filter(img => img.url);
          
          sendResponse({
            success: true,
            galleryImages: images,
            totalFound: images.length,
            validCount: images.length,
            isGalleryPage: images.length > 3
          });
        } catch (error) {
          console.error('❌ enhancedGalleryDetection error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }
  
  // Handle start element picker (simple, reliable path)
  if (messageType === 'start_element_picker') {
    (async () => {
      try {
        if (!window.__ST_SIMPLE_PICKER) {
          if (typeof window.StepThreeElementPicker === 'function') {
            window.__ST_SIMPLE_PICKER = new window.StepThreeElementPicker();
          }
        }
        if (!window.__ST_SIMPLE_PICKER) {
          sendResponse({ success: false, error: 'Element picker not available' });
          return;
        }
        const started = await window.__ST_SIMPLE_PICKER.startPicking();
        sendResponse({ success: !!started });
      } catch (error) {
        console.error('❌ start_element_picker error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // Handle stop element picker (simple, reliable path)
  if (messageType === 'stop_element_picker') {
    try {
      const picker = window.__ST_SIMPLE_PICKER;
      const ok = picker && typeof picker.stop === 'function' ? picker.stop() : false;
      sendResponse({ success: !!ok });
    } catch (error) {
      console.error('❌ stop_element_picker error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
    
    // Handle toggleSelector
    if (messageType === 'toggleSelector') {
      console.log('🎯 Handling toggleSelector...');
      (async () => {
        try {
          // Simple selector activation
          sendResponse({ 
            success: true, 
            message: 'Selector mode activated (simple mode)' 
          });
        } catch (error) {
          console.error('❌ toggleSelector error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }
    
    console.log('⚠️ Unknown message type:', messageType);
    return false;
  });
  
  window.__STEPTHREE_SIMPLE_HANDLER_REGISTERED = true;
  console.log('✅ Simple direct message handler registered successfully');
})();
