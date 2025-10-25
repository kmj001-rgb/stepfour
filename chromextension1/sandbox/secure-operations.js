// secure-operations.js - Secure sandbox for untrusted operations
// Runs in sandboxed context for maximum security isolation
// Handles URL validation, content parsing, and data sanitization

console.log('🔒 StepThree Secure Operations - Sandbox Initialized');

/**
 * Secure Operations Sandbox for MV3 Compliance
 * Handles potentially unsafe operations in isolated sandbox context
 */
class SecureOperationsSandbox {
  constructor() {
    this.isReady = false;
    this.operationHistory = [];
    
    // Phase 2: Health monitoring
    this.healthStatus = {
      healthy: false,
      lastCheck: null,
      lastHeartbeat: null,
      operationCount: 0,
      errorCount: 0,
      startTime: Date.now()
    };
    
    this.setupMessageListener();
    this.initializeSandbox();
    
    console.log('✅ Secure Operations Sandbox initialized');
  }

  /**
   * Initialize sandbox environment
   */
  initializeSandbox() {
    try {
      // Verify sandbox environment
      this.verifySandboxSecurity();
      
      this.isReady = true;
      
      // Phase 2: Mark as healthy after successful initialization
      this.healthStatus.healthy = true;
      
      this.notifyReady();

    } catch (error) {
      console.error('❌ Failed to initialize sandbox:', error);
      this.isReady = false;
      
      // Phase 2: Mark as unhealthy
      this.healthStatus.healthy = false;
      this.healthStatus.errorCount++;
      
      // Notify parent of security failure
      this.notifySecurityFailure(error);
    }
  }

  /**
   * Verify sandbox security constraints
   * Throws error if any security check fails
   */
  verifySandboxSecurity() {
    const securityIssues = [];

    // Check that localStorage is blocked (should be inaccessible in sandbox)
    try {
      localStorage.getItem('test');
      // If we reach here, localStorage access succeeded - SECURITY VIOLATION!
      const error = 'Security violation: localStorage access is not blocked in sandbox';
      console.error('❌', error);
      securityIssues.push(error);
    } catch (error) {
      // Good - localStorage is blocked as expected
      console.log('✅ localStorage access blocked - sandbox security verified');
    }

    // Check that sessionStorage is blocked
    try {
      sessionStorage.getItem('test');
      const error = 'Security violation: sessionStorage access is not blocked in sandbox';
      console.error('❌', error);
      securityIssues.push(error);
    } catch (error) {
      console.log('✅ sessionStorage access blocked - sandbox security verified');
    }

    // Check that indexedDB is blocked
    try {
      if (window.indexedDB) {
        const error = 'Security violation: indexedDB is accessible in sandbox';
        console.error('❌', error);
        securityIssues.push(error);
      } else {
        console.log('✅ indexedDB access blocked - sandbox security verified');
      }
    } catch (error) {
      console.log('✅ indexedDB access blocked - sandbox security verified');
    }

    // Check that we're in a sandboxed frame
    if (!this.isSandboxedFrame()) {
      const error = 'Security violation: Not running in a sandboxed frame environment';
      console.error('❌', error);
      securityIssues.push(error);
    } else {
      console.log('✅ Running in sandboxed frame - sandbox security verified');
    }

    // If any security issues found, halt initialization
    if (securityIssues.length > 0) {
      const errorMessage = `Sandbox security verification failed with ${securityIssues.length} issue(s):\n${securityIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}`;
      throw new Error(errorMessage);
    }

    console.log('✅ All sandbox security checks passed - sandbox is secure');
  }

  /**
   * Check if we're running in a sandboxed iframe
   */
  isSandboxedFrame() {
    try {
      // In a sandboxed iframe, we should be in a frame
      if (window.self === window.top) {
        return false; // Not in a frame at all
      }
      
      // Try to access frameElement - this will be restricted in sandbox
      // or if cross-origin
      if (window.frameElement) {
        return window.frameElement.hasAttribute('sandbox');
      }
      
      // If we can't access frameElement, we're likely sandboxed
      return true;
    } catch (error) {
      // Error accessing frameElement indicates we're sandboxed or cross-origin
      return true;
    }
  }

  /**
   * Setup message listener for communication with service worker
   */
  setupMessageListener() {
    // In sandbox, we need to use postMessage for communication
    window.addEventListener('message', (event) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        console.warn('❌ Message from unauthorized origin:', event.origin);
        return;
      }

      this.handleMessage(event.data);
    });

    console.log('📨 Sandbox message listener setup');
  }

  /**
   * Handle messages from parent frame
   */
  async handleMessage(message) {
    try {
      const { action, operationId, data, options } = message;

      // Check if sandbox is ready for operations (except ready check)
      if (action !== 'SANDBOX_READY' && !this.isReady) {
        console.error('❌ Operation rejected - sandbox security verification failed');
        this.postMessage({ 
          ok: false, 
          operationId,
          error: 'Sandbox is not ready - security verification failed. No operations can be executed in compromised sandbox.' 
        });
        return;
      }

      switch (action) {
        case 'SANDBOX_URL_VALIDATE':
          await this.handleUrlValidation(operationId, data, options);
          break;

        case 'SANDBOX_CONTENT_SANITIZE':
          await this.handleContentSanitization(operationId, data, options);
          break;

        case 'SANDBOX_DATA_PARSE':
          await this.handleDataParsing(operationId, data, options);
          break;

        case 'SANDBOX_PATTERN_ANALYZE':
          await this.handlePatternAnalysis(operationId, data, options);
          break;

        case 'SANDBOX_READY':
          this.postMessage({ ok: true, ready: this.isReady });
          break;

        case 'OFFSCREEN_HEALTH_CHECK':
          await this.handleHealthCheck(message);
          break;

        case 'OFFSCREEN_HEARTBEAT':
          await this.handleHeartbeat(message);
          break;

        default:
          console.warn('Unknown action in sandbox:', action);
          this.postMessage({ ok: false, error: 'Unknown action' });
      }
      
      // Phase 2: Track operation count
      this.healthStatus.operationCount++;

    } catch (error) {
      console.error('❌ Error handling message in sandbox:', error);
      
      // Phase 2: Track errors
      this.healthStatus.errorCount++;
      
      this.postMessage({ ok: false, error: error.message });
    }
  }

  /**
   * Phase 2: Handle health check requests
   * Reports current health status back to background
   */
  async handleHealthCheck(message) {
    try {
      const { checkId, docId } = message;
      
      this.healthStatus.lastCheck = Date.now();
      
      // Calculate uptime
      const uptime = Date.now() - this.healthStatus.startTime;
      
      // Determine overall health
      const healthy = this.isReady && this.healthStatus.healthy;
      
      const response = {
        ok: true,
        healthy,
        checkId,
        docId,
        status: {
          ready: this.isReady,
          uptime,
          operationCount: this.healthStatus.operationCount,
          errorCount: this.healthStatus.errorCount,
          errorRate: this.healthStatus.operationCount > 0 
            ? (this.healthStatus.errorCount / this.healthStatus.operationCount * 100).toFixed(2) + '%'
            : '0%',
          lastCheck: this.healthStatus.lastCheck,
          lastHeartbeat: this.healthStatus.lastHeartbeat
        }
      };
      
      this.postMessage(response);
      
      console.log('💓 Health check completed:', { healthy, checkId });
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.postMessage({
        ok: false,
        healthy: false,
        error: error.message
      });
    }
  }

  /**
   * Phase 2: Handle heartbeat pings
   * Responds to heartbeat to confirm sandbox is alive
   */
  async handleHeartbeat(message) {
    try {
      const { docId, timestamp } = message;
      
      this.healthStatus.lastHeartbeat = Date.now();
      
      // Calculate latency
      const latency = this.healthStatus.lastHeartbeat - timestamp;
      
      const response = {
        ok: true,
        docId,
        timestamp: this.healthStatus.lastHeartbeat,
        latency,
        alive: true
      };
      
      this.postMessage(response);
      
      console.log('💓 Heartbeat acknowledged:', { latency: latency + 'ms' });
      
    } catch (error) {
      console.error('❌ Heartbeat failed:', error);
    }
  }

  /**
   * Phase 2: Attempt to recover from errors
   * Resets error state and re-verifies sandbox security
   */
  async attemptRecovery() {
    try {
      console.log('🔧 Attempting sandbox recovery...');
      
      // Reset error count
      this.healthStatus.errorCount = 0;
      
      // Re-verify sandbox security
      this.verifySandboxSecurity();
      
      // Mark as healthy if verification passes
      this.isReady = true;
      this.healthStatus.healthy = true;
      
      console.log('✅ Sandbox recovery successful');
      
      // Notify background of recovery
      this.postMessage({
        ok: true,
        action: 'SANDBOX_RECOVERED',
        timestamp: Date.now()
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Sandbox recovery failed:', error);
      this.healthStatus.healthy = false;
      return false;
    }
  }

  /**
   * Handle URL validation
   */
  async handleUrlValidation(operationId, data, options) {
    try {
      const { urls } = data;
      const validatedUrls = [];

      for (const url of urls || []) {
        const validation = this.validateUrl(url, options);
        validatedUrls.push({
          original: url,
          ...validation
        });
      }

      this.postMessage({
        ok: true,
        operationId,
        result: {
          validatedUrls,
          totalCount: urls?.length || 0,
          validCount: validatedUrls.filter(u => u.isValid).length
        }
      });

    } catch (error) {
      this.postMessage({
        ok: false,
        operationId,
        error: error.message
      });
    }
  }

  /**
   * Validate individual URL
   */
  validateUrl(url, options = {}) {
    try {
      const urlObj = new URL(url);
      
      const validation = {
        isValid: true,
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        warnings: [],
        errors: []
      };

      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        validation.warnings.push('Non-HTTP protocol detected');
      }

      // Check for suspicious patterns
      if (this.containsSuspiciousPatterns(url)) {
        validation.warnings.push('Suspicious URL patterns detected');
      }

      // Check URL length
      if (url.length > 2000) {
        validation.warnings.push('Unusually long URL');
      }

      // Domain validation
      if (options.allowedDomains && !options.allowedDomains.includes(urlObj.hostname)) {
        validation.errors.push('Domain not in allowed list');
        validation.isValid = false;
      }

      return validation;

    } catch (error) {
      return {
        isValid: false,
        errors: [`Invalid URL format: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Check for suspicious URL patterns
   */
  containsSuspiciousPatterns(url) {
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /<script/i,
      /onclick/i,
      /onerror/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Handle content sanitization
   */
  async handleContentSanitization(operationId, data, options) {
    try {
      const { content, type } = data;
      
      let sanitizedContent;
      switch (type) {
        case 'html':
          sanitizedContent = this.sanitizeHtml(content, options);
          break;
        case 'css':
          sanitizedContent = this.sanitizeCss(content, options);
          break;
        case 'text':
          sanitizedContent = this.sanitizeText(content, options);
          break;
        default:
          sanitizedContent = this.sanitizeGeneric(content, options);
      }

      this.postMessage({
        ok: true,
        operationId,
        result: {
          sanitized: sanitizedContent,
          originalLength: content?.length || 0,
          sanitizedLength: sanitizedContent?.length || 0
        }
      });

    } catch (error) {
      this.postMessage({
        ok: false,
        operationId,
        error: error.message
      });
    }
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html, options = {}) {
    if (!html) return '';
    
    // Remove script tags and event handlers
    let sanitized = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');

    // Remove style attributes if not allowed
    if (!options.allowStyles) {
      sanitized = sanitized.replace(/style\s*=\s*"[^"]*"/gi, '');
    }

    return sanitized;
  }

  /**
   * Sanitize CSS content
   */
  sanitizeCss(css, options = {}) {
    if (!css) return '';
    
    // Remove potentially dangerous CSS
    return css
      .replace(/expression\s*\(/gi, '')
      .replace(/@import/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');
  }

  /**
   * Sanitize plain text content
   */
  sanitizeText(text, options = {}) {
    if (!text) return '';
    
    // Basic text sanitization
    return text
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');
  }

  /**
   * Generic content sanitization
   */
  sanitizeGeneric(content, options = {}) {
    if (!content) return '';
    
    return String(content)
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');
  }

  /**
   * Handle data parsing operations
   */
  async handleDataParsing(operationId, data, options) {
    try {
      const { content, format } = data;
      
      let parsed;
      switch (format) {
        case 'json':
          parsed = this.parseJson(content, options);
          break;
        case 'csv':
          parsed = this.parseCsv(content, options);
          break;
        case 'xml':
          parsed = this.parseXml(content, options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      this.postMessage({
        ok: true,
        operationId,
        result: parsed
      });

    } catch (error) {
      this.postMessage({
        ok: false,
        operationId,
        error: error.message
      });
    }
  }

  /**
   * Parse JSON safely
   */
  parseJson(content, options = {}) {
    try {
      const parsed = JSON.parse(content);
      
      // Validate structure if schema provided
      if (options.schema) {
        this.validateAgainstSchema(parsed, options.schema);
      }
      
      return {
        data: parsed,
        type: 'json',
        valid: true
      };
      
    } catch (error) {
      return {
        data: null,
        type: 'json',
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Parse CSV safely
   */
  parseCsv(content, options = {}) {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      const delimiter = options.delimiter || ',';
      
      if (lines.length === 0) {
        return { data: [], headers: [], valid: true };
      }
      
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/['"]/g, ''));
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter);
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim().replace(/['"]/g, '') || '';
        });
        
        data.push(row);
      }
      
      return {
        data,
        headers,
        type: 'csv',
        valid: true,
        rowCount: data.length
      };
      
    } catch (error) {
      return {
        data: [],
        headers: [],
        type: 'csv',
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Parse XML safely
   */
  parseXml(content, options = {}) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error('XML parsing error');
      }
      
      return {
        data: this.xmlToObject(doc.documentElement),
        type: 'xml',
        valid: true
      };
      
    } catch (error) {
      return {
        data: null,
        type: 'xml',
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Convert XML to object
   */
  xmlToObject(element) {
    const obj = {};
    
    // Add attributes
    if (element.attributes.length > 0) {
      obj['@attributes'] = {};
      for (let attr of element.attributes) {
        obj['@attributes'][attr.name] = attr.value;
      }
    }
    
    // Add children
    for (let child of element.children) {
      const name = child.tagName;
      const value = child.children.length > 0 ? this.xmlToObject(child) : child.textContent;
      
      if (obj[name]) {
        if (!Array.isArray(obj[name])) {
          obj[name] = [obj[name]];
        }
        obj[name].push(value);
      } else {
        obj[name] = value;
      }
    }
    
    return obj;
  }

  /**
   * Handle pattern analysis
   */
  async handlePatternAnalysis(operationId, data, options) {
    try {
      const { patterns, content } = data;
      const results = [];

      for (const pattern of patterns || []) {
        const analysis = this.analyzePattern(pattern, content, options);
        results.push(analysis);
      }

      this.postMessage({
        ok: true,
        operationId,
        result: {
          patterns: results,
          totalPatterns: patterns?.length || 0,
          matchingPatterns: results.filter(r => r.matches > 0).length
        }
      });

    } catch (error) {
      this.postMessage({
        ok: false,
        operationId,
        error: error.message
      });
    }
  }

  /**
   * Analyze individual pattern
   */
  analyzePattern(pattern, content, options = {}) {
    try {
      const regex = new RegExp(pattern, options.flags || 'gi');
      const matches = content.match(regex) || [];
      
      return {
        pattern,
        matches: matches.length,
        examples: matches.slice(0, 5), // First 5 matches
        valid: true
      };
      
    } catch (error) {
      return {
        pattern,
        matches: 0,
        examples: [],
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate data against schema
   */
  validateAgainstSchema(data, schema) {
    // Basic schema validation - can be extended
    if (schema.type && typeof data !== schema.type) {
      throw new Error(`Expected ${schema.type}, got ${typeof data}`);
    }
    
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data)) {
          throw new Error(`Required field missing: ${field}`);
        }
      }
    }
  }

  /**
   * Post message to parent frame
   */
  postMessage(data) {
    window.parent.postMessage(data, window.location.origin);
  }

  /**
   * Notify that sandbox is ready
   */
  notifyReady() {
    this.postMessage({
      action: 'SANDBOX_READY',
      ready: this.isReady,
      timestamp: Date.now()
    });
  }

  /**
   * Notify parent frame of security failure
   */
  notifySecurityFailure(error) {
    console.error('🚨 SECURITY FAILURE - Notifying parent frame');
    this.postMessage({
      action: 'SANDBOX_SECURITY_FAILURE',
      ready: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}

// Initialize the secure operations sandbox
const secureOperations = new SecureOperationsSandbox();

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  console.log('🧹 Sandbox cleaning up...');
});