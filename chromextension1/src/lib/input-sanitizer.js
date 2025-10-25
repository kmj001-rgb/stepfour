// input-sanitizer.js - Comprehensive Input Sanitization System
// Prevents XSS, injection attacks, and path traversal vulnerabilities
// CR-019: Critical security hardening for user input processing

/**
 * InputSanitizer - Comprehensive input validation and sanitization
 * Provides methods to sanitize CSS selectors, URLs, filenames, and HTML content
 */
class InputSanitizer {
  constructor(options = {}) {
    this.options = {
      // Selector sanitization options
      maxSelectorLength: options.maxSelectorLength || 10000,
      allowedSelectorChars: options.allowedSelectorChars || /^[a-zA-Z0-9\s\-_#.\[\]=:()>+~*,"'|^$]+$/,
      
      // URL sanitization options
      allowedProtocols: options.allowedProtocols || ['http:', 'https:'],
      maxUrlLength: options.maxUrlLength || 2048,
      
      // Filename sanitization options
      maxFilenameLength: options.maxFilenameLength || 255,
      allowedFilenameChars: options.allowedFilenameChars || /^[a-zA-Z0-9\-_. ()]+$/,
      
      // HTML sanitization options
      escapeHtml: options.escapeHtml !== false,
      
      ...options
    };
    
    // Dangerous patterns to block
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
    
    // Statistics tracking
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
      // Input validation
      if (!selector || typeof selector !== 'string') {
        return '';
      }
      
      // Trim whitespace
      selector = selector.trim();
      
      // Check length limits
      if (selector.length === 0) {
        return '';
      }
      
      if (selector.length > this.options.maxSelectorLength) {
        console.warn('🛡️ Selector exceeds maximum length:', selector.length);
        this.stats.threatsBlocked++;
        return '';
      }
      
      // Check for dangerous patterns
      for (const pattern of this.dangerousPatterns.selector) {
        if (pattern.test(selector)) {
          console.warn('🛡️ Dangerous pattern detected in selector:', pattern);
          this.stats.threatsBlocked++;
          return '';
        }
      }
      
      // Validate against allowed characters
      if (!this.options.allowedSelectorChars.test(selector)) {
        console.warn('🛡️ Invalid characters in selector:', selector);
        this.stats.threatsBlocked++;
        return '';
      }
      
      // Additional validation: Try to parse as CSS selector
      // This catches malformed selectors that might cause errors
      if (typeof document !== 'undefined') {
        try {
          // Test if selector is valid by attempting to query
          document.querySelector(':root'); // Dummy query to ensure API is available
          document.createDocumentFragment().querySelector(selector); // Will throw if invalid
        } catch (e) {
          // If we can't test the selector, be conservative but log the issue
          console.warn('🛡️ Selector validation test failed:', e.message);
          // Don't block here as some complex selectors might be valid but fail in fragment
          // The character whitelist above should catch most issues
        }
      }
      
      // Additional security: Escape special characters that might cause issues
      // But preserve valid CSS selector syntax
      selector = selector
        .replace(/[<>]/g, '') // Remove angle brackets entirely
        .replace(/\\/g, '\\\\'); // Escape backslashes
      
      return selector;
      
    } catch (error) {
      console.error('❌ Selector sanitization error:', error);
      this.stats.threatsBlocked++;
      return '';
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
      // Input validation
      if (!url || typeof url !== 'string') {
        return '';
      }
      
      // Trim whitespace
      url = url.trim();
      
      // Check length limits
      if (url.length === 0) {
        return '';
      }
      
      if (url.length > this.options.maxUrlLength) {
        console.warn('🛡️ URL exceeds maximum length:', url.length);
        this.stats.threatsBlocked++;
        return '';
      }
      
      // Check for dangerous patterns
      for (const pattern of this.dangerousPatterns.url) {
        if (pattern.test(url)) {
          console.warn('🛡️ Dangerous pattern detected in URL:', pattern);
          this.stats.threatsBlocked++;
          return '';
        }
      }
      
      // Parse URL to validate structure
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        // Try with a base URL for relative URLs
        try {
          parsedUrl = new URL(url, 'https://example.com');
        } catch (e2) {
          console.warn('🛡️ Invalid URL format:', url);
          this.stats.threatsBlocked++;
          return '';
        }
      }
      
      // Validate protocol
      if (!this.options.allowedProtocols.includes(parsedUrl.protocol)) {
        console.warn('🛡️ Disallowed protocol in URL:', parsedUrl.protocol);
        this.stats.threatsBlocked++;
        return '';
      }
      
      // Additional security checks
      // Block URLs with embedded credentials (potential phishing)
      if (parsedUrl.username || parsedUrl.password) {
        console.warn('🛡️ URL contains credentials:', url);
        this.stats.threatsBlocked++;
        return '';
      }
      
      // Block localhost and private IPs in production
      if (options.blockPrivateIPs) {
        const hostname = parsedUrl.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname === '[::1]'
        ) {
          console.warn('🛡️ Private IP/localhost blocked:', hostname);
          this.stats.threatsBlocked++;
          return '';
        }
      }
      
      // Return the sanitized URL
      return parsedUrl.href;
      
    } catch (error) {
      console.error('❌ URL sanitization error:', error);
      this.stats.threatsBlocked++;
      return '';
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
      // Input validation
      if (!filename || typeof filename !== 'string') {
        return this.generateSafeFilename();
      }
      
      // Extract just the filename if a full path was provided
      filename = filename.split(/[\\/]/).pop() || filename;
      
      // Trim whitespace
      filename = filename.trim();
      
      // Check length limits
      if (filename.length === 0) {
        return this.generateSafeFilename();
      }
      
      if (filename.length > this.options.maxFilenameLength) {
        console.warn('🛡️ Filename exceeds maximum length:', filename.length);
        filename = filename.substring(0, this.options.maxFilenameLength);
      }
      
      // Check for path traversal patterns
      for (const pattern of this.dangerousPatterns.path) {
        if (pattern.test(filename)) {
          console.warn('🛡️ Path traversal pattern detected:', pattern);
          this.stats.threatsBlocked++;
          return this.generateSafeFilename();
        }
      }
      
      // Remove dangerous characters
      // Keep: letters, numbers, dash, underscore, dot, space, parentheses
      filename = filename.replace(/[^a-zA-Z0-9\-_. ()]/g, '_');
      
      // Prevent multiple consecutive dots (potential traversal bypass)
      filename = filename.replace(/\.{2,}/g, '.');
      
      // Prevent leading/trailing dots and spaces
      filename = filename.replace(/^[.\s]+|[.\s]+$/g, '');
      
      // Ensure we still have a valid filename
      if (filename.length === 0 || filename === '.') {
        return this.generateSafeFilename();
      }
      
      // Validate against allowed characters (final check)
      if (!this.options.allowedFilenameChars.test(filename)) {
        console.warn('🛡️ Invalid characters remain in filename:', filename);
        return this.generateSafeFilename();
      }
      
      // Prevent Windows reserved filenames
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                             'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                             'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
      const nameWithoutExt = filename.split('.')[0].toUpperCase();
      if (reservedNames.includes(nameWithoutExt)) {
        filename = '_' + filename;
      }
      
      return filename;
      
    } catch (error) {
      console.error('❌ Filename sanitization error:', error);
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
      // Input validation
      if (!html || typeof html !== 'string') {
        return '';
      }
      
      // Trim whitespace
      html = html.trim();
      
      if (html.length === 0) {
        return '';
      }
      
      // Escape HTML entities to prevent XSS
      const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
      };
      
      const escapedHtml = html.replace(/[&<>"'\/]/g, (char) => {
        return htmlEscapeMap[char];
      });
      
      return escapedHtml;
      
    } catch (error) {
      console.error('❌ HTML sanitization error:', error);
      this.stats.threatsBlocked++;
      return '';
    }
  }

  /**
   * Generate a safe filename with timestamp
   * @returns {string} - Safe generated filename
   */
  generateSafeFilename() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `file_${timestamp}_${random}`;
  }
}

// Export for use in different contexts
if (typeof window !== 'undefined') {
  window.InputSanitizer = InputSanitizer;
}

// Export to globalThis for service worker context
if (typeof globalThis !== 'undefined') {
  globalThis.InputSanitizer = InputSanitizer;
}

// ES6 export
export { InputSanitizer };
