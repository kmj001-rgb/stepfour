// enhanced-css-selector.js - Advanced CSS Selector Generation for STEPTHREE
// Based on antonmedv/finder library with penalty-based optimization, timeout protection, and cross-site compatibility
// Ported from Simplescraper's sophisticated selector generation system

console.log('🚀 Loading Enhanced CSS Selector System...');

/**
 * Enhanced CSS Selector Generation System
 * Integrates antonmedv/finder library with STEPTHREE-specific optimizations
 */
class EnhancedCSSSelector {
  constructor(options = {}) {
    this.options = {
      // Core finder options
      timeoutMs: options.timeoutMs || 1000,
      seedMinLength: options.seedMinLength || 3,
      optimizedMinLength: options.optimizedMinLength || 2,
      maxNumberOfPathChecks: options.maxNumberOfPathChecks || Infinity,
      
      // STEPTHREE-specific options
      enableImageOptimization: options.enableImageOptimization !== false,
      enableGalleryPattern: options.enableGalleryPattern !== false,
      enablePerformanceSafeguards: options.enablePerformanceSafeguards !== false,
      maxSelectorLength: options.maxSelectorLength || 1000,
      
      // Cross-site compatibility
      enableCrossSiteOptimization: options.enableCrossSiteOptimization !== false,
      enableDataAttributePreference: options.enableDataAttributePreference !== false,
      
      ...options
    };
    
    // Performance tracking
    this.metrics = {
      selectorsGenerated: 0,
      optimizationTime: 0,
      timeouts: 0,
      crossSiteOptimizations: 0,
      patternOptimizations: 0
    };
    
    // Pattern cache for better performance
    this.selectorCache = new Map();
    this.patternCache = new Map();
    
    // Input Sanitizer integration (CR-019: Critical security hardening)
    this.sanitizer = null;
    this.initializeInputSanitizer();
    
    // Initialize antonmedv/finder core
    this.initializeFinder();
  }

  /**
   * Initialize Input Sanitizer for security (CR-019)
   */
  initializeInputSanitizer() {
    if (typeof window !== 'undefined' && window.InputSanitizer) {
      this.sanitizer = new window.InputSanitizer();
      console.log('✅ Input Sanitizer integration enabled for selector security');
    } else {
      throw new Error('SECURITY: InputSanitizer is required but not available');
    }
  }

  /**
   * Sanitize generated selector for security (CR-019)
   * @param {string} selector - Selector to sanitize
   * @returns {string} - Sanitized selector or empty string if blocked
   */
  sanitizeGeneratedSelector(selector) {
    if (!selector || typeof selector !== 'string') {
      console.warn('⚠️ sanitizeGeneratedSelector received invalid input:', selector);
      return '';
    }
    
    if (this.sanitizer) {
      const sanitized = this.sanitizer.sanitizeSelector(selector);
      if (!sanitized) {
        console.error('🛡️ SECURITY: Generated selector was blocked by sanitizer');
        console.error('🛡️ SECURITY: Blocked selector:', selector);
        console.error('🛡️ SECURITY: This selector was deemed unsafe and has been rejected');
        
        if (window.logger) {
          window.logger.error('Generated selector blocked by security sanitization', {
            blockedSelector: selector,
            reason: 'Failed sanitization check',
            action: 'Returning empty string to prevent security risk'
          });
        }
        
        return this.generateSafeFallback();
      }
      return sanitized;
    }
    
    return selector;
  }

  /**
   * Generate a safe fallback selector
   * SECURITY FIX: Returns empty string instead of dangerous wildcard '*'
   * @returns {string} - Safe fallback selector (empty string to prevent unintended scraping)
   */
  generateSafeFallback() {
    console.error('🚨 SECURITY: generateSafeFallback() called - selector sanitization blocked a dangerous selector');
    console.error('🚨 SECURITY: Returning empty string to prevent wildcard selection of entire page');
    
    if (window.logger) {
      window.logger.error('Selector generation failed security check', {
        reason: 'Sanitization blocked dangerous selector',
        fallback: 'empty string',
        impact: 'Selector generation failed to prevent security risk'
      });
    }
    
    return '';
  }

  /**
   * Initialize the antonmedv/finder core functionality
   * Inline implementation for Chrome extension compatibility
   */
  initializeFinder() {
    // Core finder types and utilities
    this.finderCore = {
      // Enhanced accepted attribute names for better selector generation
      // ENHANCED: More comprehensive attribute support
      acceptedAttrNames: new Set([
        // Core accessibility and semantic attributes
        'role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-expanded', 
        'aria-hidden', 'aria-selected', 'aria-checked', 'aria-pressed',
        
        // Standard HTML attributes
        'id', 'name', 'type', 'value', 'placeholder', 'title', 'alt',
        'href', 'src', 'rel', 'target', 'method', 'action',
        
        // Data attributes (testing and identification)
        'data-testid', 'data-test', 'data-id', 'data-name', 'data-component',
        'data-role', 'data-action', 'data-type', 'data-value',
        
        // Gallery and media-specific attributes
        'data-gallery', 'data-image', 'data-photo', 'data-src', 'data-original',
        'data-lazy', 'data-loading', 'data-thumbnail', 'data-full-size',
        
        // Framework and library attributes
        'data-react-class', 'data-reactid', 'data-vue-component', 'data-angular',
        'data-testid', 'data-cy', 'data-selenium', 'data-automation',
        
        // CMS and content attributes  
        'data-cms', 'data-field', 'data-content', 'data-block', 'data-widget',
        
        // Interactive elements
        'data-toggle', 'data-target', 'data-dismiss', 'data-trigger',
        'data-placement', 'data-container', 'data-offset'
      ]),
      
      // Enhanced word-like validation for robust selectors
      // ENHANCED: Better pattern matching and validation
      wordLike: (name) => {
        if (!name || typeof name !== 'string') return false;
        
        // Basic length and character requirements
        if (name.length < 2) return false;
        if (name.length > 100) return false; // Reasonable upper limit
        
        // Must start with letter or underscore
        if (!/^[a-zA-Z_]/.test(name)) return false;
        
        // Enhanced pattern matching
        if (/^[a-z\-_]{2,}$/i.test(name)) {
          // Split by common delimiters 
          const words = name.split(/[-_]|(?=[A-Z])/);
          
          // Filter out empty segments
          const validWords = words.filter(word => word.length > 0);
          
          // Must have at least one valid word
          if (validWords.length === 0) return false;
          
          // Check each word segment
          for (const word of validWords) {
            // Single character words are usually okay in tech contexts
            if (word.length === 1) {
              // Allow single letters that are common abbreviations
              if (!/^[a-zA-Z]$/.test(word)) return false;
              continue;
            }
            
            // Two character minimum for most words
            if (word.length < 2) return false;
            
            // Avoid excessive consonant clusters (but be more lenient)
            if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{5,}/.test(word)) return false;
            
            // Avoid all numbers
            if (/^\d+$/.test(word)) return false;
            
            // Allow common tech abbreviations and terms
            const techTerms = /^(btn|nav|img|src|url|api|ui|ux|id|css|js|html|svg|png|jpg|gif|min|max|auto|flex|grid|row|col|xs|sm|md|lg|xl)$/i;
            if (techTerms.test(word)) continue;
            
            // Allow words with reasonable vowel distribution
            if (word.length >= 3) {
              const vowelCount = (word.match(/[aeiouAEIOU]/g) || []).length;
              const consonantCount = word.length - vowelCount;
              // More lenient ratio for technical terms
              if (consonantCount > 0 && vowelCount === 0 && word.length > 4) {
                return false;
              }
            }
          }
          
          return true;
        }
        
        // Allow numbers mixed with letters (common in modern frameworks)
        if (/^[a-zA-Z][a-zA-Z0-9\-_]*[a-zA-Z0-9]$/.test(name) && name.length >= 2) {
          // Avoid pure number sequences
          if (!/^\d+$/.test(name)) {
            return true;
          }
        }
        
        return false;
      },
      
      // Enhanced attribute validation with STEPTHREE preferences
      // ENHANCED: Comprehensive attribute name and value validation
      attr: (name, value) => {
        if (!name || !value || typeof name !== 'string' || typeof value !== 'string') {
          return false;
        }
        
        // Enhanced name validation
        let nameIsOk = false;
        
        // Check against accepted attribute names
        nameIsOk = this.finderCore.acceptedAttrNames.has(name);
        
        // Allow well-formed data attributes
        if (!nameIsOk && name.startsWith('data-')) {
          // Data attribute must have valid format: data-something
          if (name.length > 5) {
            const dataPart = name.substring(5);
            nameIsOk = this.finderCore.wordLike(dataPart) || /^[a-z][a-z0-9\-]*$/.test(dataPart);
          }
        }
        
        // Allow aria attributes
        if (!nameIsOk && name.startsWith('aria-')) {
          if (name.length > 5) {
            const ariaPart = name.substring(5);
            nameIsOk = this.finderCore.wordLike(ariaPart) || /^[a-z][a-z0-9]*$/.test(ariaPart);
          }
        }
        
        // Allow ng-, v-, and other framework attributes in some cases
        if (!nameIsOk && (name.startsWith('ng-') || name.startsWith('v-') || name.startsWith('x-'))) {
          const frameworkPart = name.substring(name.indexOf('-') + 1);
          nameIsOk = this.finderCore.wordLike(frameworkPart);
        }
        
        if (!nameIsOk) return false;
        
        // Enhanced value validation
        let valueIsOk = false;
        
        // Basic length check
        if (value.length > 200) return false; // Reasonable upper limit
        
        // Word-like values are good
        if (this.finderCore.wordLike(value)) {
          valueIsOk = true;
        }
        
        // Allow alphanumeric values with common separators
        if (!valueIsOk && /^[a-zA-Z0-9\-_\.\/\:]{1,100}$/.test(value)) {
          valueIsOk = true;
        }
        
        // Allow URL fragments and paths
        if (!valueIsOk && (value.startsWith('#') || value.startsWith('/') || value.startsWith('./'))) {
          const pathPart = value.replace(/^[#\/\.]*/, '');
          if (pathPart.length > 0 && /^[a-zA-Z0-9\-_\/\.%]+$/.test(pathPart)) {
            valueIsOk = true;
          }
        }
        
        // Allow common enum-like values
        if (!valueIsOk) {
          const commonValues = [
            // Boolean-like values
            'true', 'false', 'yes', 'no', 'on', 'off', 'enabled', 'disabled',
            // Common UI states
            'active', 'inactive', 'selected', 'unselected', 'open', 'closed',
            'expanded', 'collapsed', 'visible', 'hidden', 'loading', 'loaded',
            // Common types
            'button', 'link', 'image', 'text', 'number', 'email', 'password',
            'checkbox', 'radio', 'select', 'textarea', 'file', 'submit', 'reset',
            // Gallery/media values
            'gallery', 'carousel', 'slider', 'grid', 'list', 'thumbnail', 'full',
            'small', 'medium', 'large', 'auto', 'manual', 'lazy', 'eager'
          ];
          
          valueIsOk = commonValues.includes(value.toLowerCase());
        }
        
        // Allow single letters and numbers (common in frameworks)
        if (!valueIsOk && /^[a-zA-Z0-9]$/.test(value)) {
          valueIsOk = true;
        }
        
        // Allow semantic identifiers (even if they contain numbers)
        if (!valueIsOk && /^[a-zA-Z][a-zA-Z0-9\-_]*[a-zA-Z0-9]$/.test(value) && value.length <= 50) {
          // Additional check: avoid pure hash-like strings
          if (!/^[a-f0-9]{8,}$/i.test(value)) {
            valueIsOk = true;
          }
        }
        
        // Special handling for specific attribute types
        if (!valueIsOk) {
          if (name === 'role') {
            // ARIA roles
            const validRoles = ['button', 'link', 'img', 'banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form', 'article', 'section', 'list', 'listitem', 'tab', 'tabpanel', 'dialog', 'alertdialog', 'alert', 'status'];
            valueIsOk = validRoles.includes(value);
          } else if (name === 'type') {
            // Input types and other type attributes
            const validTypes = ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'color', 'range', 'file', 'hidden', 'submit', 'reset', 'button', 'checkbox', 'radio'];
            valueIsOk = validTypes.includes(value);
          } else if (name.endsWith('-toggle') || name.endsWith('-trigger')) {
            // Toggle/trigger attributes often have target selectors
            valueIsOk = /^[#\.]?[a-zA-Z][a-zA-Z0-9\-_]*$/.test(value);
          }
        }
        
        return nameIsOk && valueIsOk;
      },
      
      // Enhanced ID validation
      idName: (name) => {
        return this.finderCore.wordLike(name) || /^[a-zA-Z][a-zA-Z0-9\-_]{2,}$/.test(name);
      },
      
      // Enhanced class name validation with gallery patterns
      className: (name) => {
        if (this.finderCore.wordLike(name)) return true;
        
        // STEPTHREE: Prefer gallery and image-related classes
        const galleryPatterns = /^(gallery|image|photo|picture|thumb|carousel|slider|grid|masonry|lightbox)/i;
        if (galleryPatterns.test(name)) return true;
        
        // Allow common UI framework classes but with lower priority
        return /^[a-zA-Z][a-zA-Z0-9\-_]{2,}$/.test(name);
      },
      
      // Tag name validation
      tagName: (name) => {
        return true; // All tag names are valid
      }
    };

    console.log('✅ Enhanced CSS Selector finder core initialized');
  }

  /**
   * Generate enhanced CSS selector for a given element
   * Main entry point with penalty-based optimization
   */
  async generateSelector(element, options = {}) {
    const startTime = performance.now();
    
    try {
      // Validate input
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        throw new Error("Invalid element provided for selector generation");
      }
      
      // Check cache first
      const cacheKey = this.generateCacheKey(element, options);
      if (this.selectorCache.has(cacheKey)) {
        return this.selectorCache.get(cacheKey);
      }
      
      // Merge options with defaults
      const config = {
        root: options.root || document.body,
        timeoutMs: options.timeoutMs || this.options.timeoutMs,
        seedMinLength: options.seedMinLength || this.options.seedMinLength,
        optimizedMinLength: options.optimizedMinLength || this.options.optimizedMinLength,
        maxNumberOfPathChecks: options.maxNumberOfPathChecks || this.options.maxNumberOfPathChecks,
        idName: this.finderCore.idName,
        className: this.finderCore.className,
        tagName: this.finderCore.tagName,
        attr: this.finderCore.attr
      };

      // Handle special cases
      if (element.tagName.toLowerCase() === 'html') {
        return 'html';
      }

      // Generate selector using enhanced finder algorithm
      const selector = await this.findUniqueSelector(element, config, startTime);
      
      // Apply STEPTHREE-specific optimizations
      const optimizedSelector = await this.applySTEPTHREEOptimizations(selector, element, config);
      
      // CR-019: Sanitize generated selector for security
      const sanitizedSelector = this.sanitizeGeneratedSelector(optimizedSelector);
      
      // SECURITY: Check if sanitization resulted in empty selector (blocked for security)
      if (!sanitizedSelector || sanitizedSelector.trim() === '') {
        console.error('🚨 SECURITY: Selector generation failed - sanitization returned empty selector');
        console.error('🚨 SECURITY: This indicates the generated selector was blocked for security reasons');
        
        if (window.logger) {
          window.logger.error('Selector generation blocked by security sanitization', {
            reason: 'Generated selector failed security validation',
            result: 'Returning empty string to prevent unintended scraping'
          });
        }
        
        // Return empty string - will be caught by validation in calling code
        return '';
      }
      
      // Cache the sanitized result
      this.selectorCache.set(cacheKey, sanitizedSelector);
      
      // Update metrics
      this.metrics.selectorsGenerated++;
      this.metrics.optimizationTime += performance.now() - startTime;
      
      return sanitizedSelector;
      
    } catch (error) {
      console.warn('⚠️ Enhanced selector generation failed:', error);
      
      // Fallback to basic selector generation (also sanitized)
      const fallback = this.generateFallbackSelector(element);
      const sanitizedFallback = this.sanitizeGeneratedSelector(fallback);
      
      // SECURITY: Check if fallback sanitization also resulted in empty selector
      if (!sanitizedFallback || sanitizedFallback.trim() === '') {
        console.error('🚨 SECURITY: Fallback selector generation also failed sanitization');
        console.error('🚨 SECURITY: Cannot generate a safe selector for this element');
        
        if (window.logger) {
          window.logger.error('Both primary and fallback selector generation failed', {
            error: error.message,
            reason: 'Fallback selector also failed security validation',
            result: 'Returning empty string'
          });
        }
      }
      
      return sanitizedFallback;
    }
  }

  /**
   * Core finder algorithm with penalty-based optimization
   * ENHANCED: Better timeout protection and fallback strategies
   */
  async findUniqueSelector(element, config, startTime) {
    const rootDocument = this.findRootDocument(config.root);
    let foundPath = null;
    let count = 0;
    let bestCandidates = [];
    const timeoutBuffer = Math.min(200, config.timeoutMs * 0.2); // Reserve 20% time for fallbacks

    try {
      // Enhanced candidate search with progressive timeout checking
      for (const candidate of this.searchCandidates(element, config, rootDocument)) {
        const elapsedTime = performance.now() - startTime;
        
        // Progressive timeout checking with buffer
        if (elapsedTime > (config.timeoutMs - timeoutBuffer)) {
          console.debug(`⏱️ Approaching timeout at ${elapsedTime}ms, switching to best candidate strategy`);
          break;
        }
        
        // Check path count limits
        if (count >= config.maxNumberOfPathChecks) {
          console.debug(`📊 Reached max path checks: ${count}`);
          break;
        }
        
        count++;
        
        // Store all valid candidates for fallback
        if (this.isValidPath(candidate, rootDocument)) {
          bestCandidates.push({
            path: candidate,
            penalty: this.calculatePenalty(candidate),
            unique: this.isUnique(candidate, rootDocument)
          });
          
          // If we found a unique selector, we can use it
          if (bestCandidates[bestCandidates.length - 1].unique) {
            foundPath = candidate;
            break;
          }
        }
        
        // Periodic timeout check for long-running searches
        if (count % 50 === 0) {
          const currentElapsed = performance.now() - startTime;
          if (currentElapsed > (config.timeoutMs - timeoutBuffer)) {
            console.debug(`⏱️ Periodic timeout check triggered at ${currentElapsed}ms`);
            break;
          }
        }
      }

      // Enhanced fallback strategy
      if (!foundPath) {
        foundPath = this.selectBestFallbackCandidate(bestCandidates, element, rootDocument, config);
      }

      if (!foundPath) {
        // Last resort: generate emergency fallback
        foundPath = this.generateEmergencyFallback(element, rootDocument, config);
      }

      if (!foundPath) {
        throw new Error('No valid selector could be generated');
      }

      // Enhanced optimization with remaining time
      const remainingTime = config.timeoutMs - (performance.now() - startTime);
      if (remainingTime > 100) { // Only optimize if we have sufficient time
        const optimized = Array.from(this.optimizePath(foundPath, element, config, rootDocument, startTime));
        optimized.sort(this.compareByPenalty);
        
        if (optimized.length > 0) {
          return this.pathToSelector(optimized[0]);
        }
      }
      
      return this.pathToSelector(foundPath);

    } catch (error) {
      this.metrics.timeouts++;
      console.warn('⚠️ Selector generation failed, using emergency fallback:', error);
      
      // Emergency fallback path
      const emergencySelector = this.generateEmergencySelector(element);
      if (emergencySelector) {
        return emergencySelector;
      }
      
      throw new Error(`Selector generation failed: ${error.message}`);
    }
  }

  /**
   * Validate if a path is structurally valid
   * ENHANCED: Comprehensive path validation
   */
  isValidPath(path, rootDocument) {
    if (!path || path.length === 0) return false;
    
    try {
      const selector = this.pathToSelector(path);
      if (!selector || selector.length === 0) return false;
      
      // Test if selector is syntactically valid
      rootDocument.querySelectorAll(selector);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Select best fallback candidate when no unique selector found
   * ENHANCED: Intelligent fallback selection
   */
  selectBestFallbackCandidate(candidates, element, rootDocument, config) {
    if (!candidates || candidates.length === 0) return null;
    
    // Sort candidates by quality score
    candidates.sort((a, b) => {
      // Prefer unique selectors
      if (a.unique !== b.unique) {
        return b.unique ? 1 : -1;
      }
      
      // Then by penalty (lower is better)
      if (a.penalty !== b.penalty) {
        return a.penalty - b.penalty;
      }
      
      // Then by stability
      const stabilityA = this.calculatePathStability(a.path);
      const stabilityB = this.calculatePathStability(b.path);
      return stabilityB - stabilityA;
    });
    
    // Use best candidate that at least selects the target element
    for (const candidate of candidates) {
      try {
        const selector = this.pathToSelector(candidate.path);
        const elements = rootDocument.querySelectorAll(selector);
        
        // Check if target element is in the selection
        for (const el of elements) {
          if (el === element) {
            console.debug(`✅ Using fallback candidate: ${selector} (selects ${elements.length} elements)`);
            return candidate.path;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return candidates[0]?.path || null;
  }

  /**
   * Generate emergency fallback when all else fails
   * ENHANCED: Multiple fallback strategies
   */
  generateEmergencyFallback(element, rootDocument, config) {
    try {
      // Strategy 1: Try to build a simple path from element to root
      const simplePath = this.buildSimplePath(element, rootDocument);
      if (simplePath && this.isValidPath(simplePath, rootDocument)) {
        return simplePath;
      }
      
      // Strategy 2: Use any available stable identifier
      const stableIdentifier = this.findStableIdentifier(element);
      if (stableIdentifier) {
        try {
          const elements = rootDocument.querySelectorAll(stableIdentifier);
          if (Array.from(elements).includes(element)) {
            return [{
              name: stableIdentifier,
              penalty: 100,
              level: 0
            }];
          }
        } catch (error) {
          // Continue to next strategy
        }
      }
      
      // Strategy 3: Use tag name with nth-of-type
      const tagName = element.tagName.toLowerCase();
      const nthOfType = this.calculateNthOfType(element, tagName);
      if (nthOfType !== undefined) {
        const selector = this.generateNthOfType(tagName, nthOfType);
        return [{
          name: selector,
          penalty: 200,
          level: 0
        }];
      }
      
      // Strategy 4: Use tag name with nth-child
      const nthChild = this.calculateNthChild(element);
      if (nthChild !== undefined) {
        const selector = this.generateNthChild(tagName, nthChild);
        return [{
          name: selector,
          penalty: 300,
          level: 0
        }];
      }
      
    } catch (error) {
      console.warn('⚠️ Emergency fallback generation failed:', error);
    }
    
    return null;
  }

  /**
   * Generate absolute emergency selector (last resort)
   * ENHANCED: Guaranteed fallback generation
   */
  generateEmergencySelector(element) {
    try {
      // Fallback 1: Use any ID if present
      if (element.id) {
        return `#${CSS.escape(element.id)}`;
      }
      
      // Fallback 2: Use class if present
      if (element.className && element.className.trim()) {
        const firstClass = element.className.trim().split(/\s+/)[0];
        if (firstClass) {
          return `.${CSS.escape(firstClass)}`;
        }
      }
      
      // Fallback 3: Use tag with nth-of-type
      const tagName = element.tagName.toLowerCase();
      const nthOfType = this.calculateNthOfType(element, tagName);
      if (nthOfType !== undefined) {
        return this.generateNthOfType(tagName, nthOfType);
      }
      
      // Fallback 4: Use tag with nth-child
      const nthChild = this.calculateNthChild(element);
      if (nthChild !== undefined) {
        return this.generateNthChild(tagName, nthChild);
      }
      
      // Fallback 5: Just use tag name (not unique but something)
      return tagName;
      
    } catch (error) {
      console.error('❌ Emergency selector generation failed:', error);
      return 'div'; // Absolute last resort
    }
  }

  /**
   * Build simple path from element to root
   * ENHANCED: Simplified path building for emergencies
   */
  buildSimplePath(element, rootDocument) {
    const path = [];
    let current = element;
    let level = 0;
    const maxLevels = 5; // Limit depth for emergency fallback
    
    try {
      while (current && current !== rootDocument && level < maxLevels) {
        const tagName = current.tagName.toLowerCase();
        
        // Try to get a reasonable selector for this level
        let selector = null;
        
        // Prefer ID if available
        if (current.id && this.finderCore.idName(current.id)) {
          selector = `#${CSS.escape(current.id)}`;
        }
        // Then stable class
        else if (current.className) {
          const stableClass = current.className.split(' ')
            .find(c => this.isStableClass(c) && this.finderCore.className(c));
          if (stableClass) {
            selector = `.${CSS.escape(stableClass)}`;
          }
        }
        // Then tag with nth-of-type
        if (!selector) {
          const nthOfType = this.calculateNthOfType(current, tagName);
          if (nthOfType !== undefined) {
            selector = this.generateNthOfType(tagName, nthOfType);
          } else {
            selector = tagName;
          }
        }
        
        path.push({
          name: selector,
          penalty: 100 + level * 10,
          level: level
        });
        
        current = current.parentElement;
        level++;
      }
      
      return path.length > 0 ? path : null;
      
    } catch (error) {
      console.warn('⚠️ Simple path building failed:', error);
      return null;
    }
  }

  /**
   * Search for candidate selector paths using generator pattern
   */
  *searchCandidates(element, config, rootDocument) {
    const stack = [];
    let paths = [];
    let current = element;
    let level = 0;

    while (current && current !== rootDocument) {
      const levelKnots = this.generateLevelKnots(current, config);
      
      // Add level information
      for (const knot of levelKnots) {
        knot.level = level;
      }
      
      stack.push(levelKnots);
      current = current.parentElement;
      level++;

      // Generate combinations from current stack
      paths.push(...this.generateCombinations(stack));

      // Yield candidates when we have enough levels
      if (level >= config.seedMinLength) {
        paths.sort(this.compareByPenalty);
        for (const candidate of paths) {
          yield candidate;
        }
        paths = [];
      }
    }

    // Yield remaining candidates
    paths.sort(this.compareByPenalty);
    for (const candidate of paths) {
      yield candidate;
    }
  }

  /**
   * Generate selector knots for a given element level
   * Enhanced with STEPTHREE-specific preferences
   */
  generateLevelKnots(element, config) {
    const knots = [];

    // Priority 1: ID selectors (penalty: 0)
    const elementId = element.getAttribute('id');
    if (elementId && config.idName(elementId)) {
      knots.push({
        name: '#' + CSS.escape(elementId),
        penalty: 0
      });
    }

    // Priority 2: Data attributes for galleries (penalty: 0.5)
    if (this.options.enableImageOptimization) {
      const dataTestId = element.getAttribute('data-testid');
      const dataId = element.getAttribute('data-id');
      
      if (dataTestId && config.attr('data-testid', dataTestId)) {
        knots.push({
          name: `[data-testid="${CSS.escape(dataTestId)}"]`,
          penalty: 0.5
        });
      }
      
      if (dataId && config.attr('data-id', dataId)) {
        knots.push({
          name: `[data-id="${CSS.escape(dataId)}"]`,
          penalty: 0.5
        });
      }
    }

    // Priority 3: Class selectors (penalty: 1)
    for (let i = 0; i < element.classList.length; i++) {
      const className = element.classList[i];
      if (config.className(className)) {
        let penalty = 1;
        
        // STEPTHREE: Lower penalty for gallery-related classes
        if (this.options.enableGalleryPattern && this.isGalleryClass(className)) {
          penalty = 0.8;
        }
        
        knots.push({
          name: '.' + CSS.escape(className),
          penalty: penalty
        });
      }
    }

    // Priority 4: Attribute selectors (penalty: 2)
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (config.attr(attr.name, attr.value)) {
        knots.push({
          name: `[${CSS.escape(attr.name)}="${CSS.escape(attr.value)}"]`,
          penalty: 2
        });
      }
    }

    // Priority 5: Tag selectors (penalty: 5)
    const tagName = element.tagName.toLowerCase();
    if (config.tagName(tagName)) {
      knots.push({
        name: tagName,
        penalty: 5
      });

      // Add nth-of-type if needed
      const nthOfType = this.calculateNthOfType(element, tagName);
      if (nthOfType !== undefined) {
        knots.push({
          name: this.generateNthOfType(tagName, nthOfType),
          penalty: 10
        });
      }
    }

    // Priority 6: nth-child (penalty: 50)
    const nthChild = this.calculateNthChild(element);
    if (nthChild !== undefined) {
      knots.push({
        name: this.generateNthChild(tagName, nthChild),
        penalty: 50
      });
    }

    return knots;
  }

  /**
   * Check if a class name is gallery-related
   */
  isGalleryClass(className) {
    const galleryPatterns = [
      'gallery', 'image', 'photo', 'picture', 'thumb', 'thumbnail',
      'carousel', 'slider', 'grid', 'masonry', 'lightbox', 'modal',
      'item', 'tile', 'card', 'media'
    ];
    
    return galleryPatterns.some(pattern => 
      className.toLowerCase().includes(pattern)
    );
  }

  /**
   * Generate all combinations from the stack
   */
  *generateCombinations(stack, path = []) {
    if (stack.length > 0) {
      for (const knot of stack[0]) {
        yield* this.generateCombinations(stack.slice(1), path.concat(knot));
      }
    } else {
      yield path;
    }
  }

  /**
   * Convert path to CSS selector string
   */
  pathToSelector(path) {
    if (!path || path.length === 0) return '';
    
    let node = path[0];
    let query = node.name;
    
    for (let i = 1; i < path.length; i++) {
      const level = path[i].level || 0;
      if (node.level === level - 1) {
        query = `${path[i].name} > ${query}`;
      } else {
        query = `${path[i].name} ${query}`;
      }
      node = path[i];
    }
    
    return query;
  }

  /**
   * Calculate penalty score for a path with enhanced scoring
   * ENHANCED: Better penalty calculation with multiple factors
   */
  calculatePenalty(path) {
    if (!path || path.length === 0) return Infinity;
    
    let basePenalty = path.reduce((total, knot) => total + knot.penalty, 0);
    
    // Enhanced penalty factors
    let complexityPenalty = 0;
    let stabilityPenalty = 0;
    let lengthPenalty = 0;
    
    // Complexity penalty based on selector structure
    const pathString = this.pathToSelector(path);
    complexityPenalty += this.calculateComplexityPenalty(pathString);
    
    // Stability penalty for fragile selectors
    stabilityPenalty += this.calculateStabilityPenalty(path);
    
    // Length penalty for overly long selectors
    lengthPenalty += Math.max(0, (pathString.length - 50) * 0.1);
    
    // Gallery optimization bonus (negative penalty)
    let galleryBonus = 0;
    if (this.options.enableGalleryPattern) {
      galleryBonus = this.calculateGalleryBonus(path);
    }
    
    const totalPenalty = basePenalty + complexityPenalty + stabilityPenalty + lengthPenalty - galleryBonus;
    return Math.max(0, totalPenalty);
  }

  /**
   * Enhanced path comparison with tie-breaking algorithms
   * ENHANCED: Better tie-breaking for selector quality
   */
  compareByPenalty = (a, b) => {
    const penaltyA = this.calculatePenalty(a);
    const penaltyB = this.calculatePenalty(b);
    
    // Primary sort by penalty
    if (penaltyA !== penaltyB) {
      return penaltyA - penaltyB;
    }
    
    // Tie-breaking criteria
    
    // 1. Prefer shorter paths (fewer levels)
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    
    // 2. Prefer stable selector types (ID > data > class > tag)
    const stabilityA = this.calculatePathStability(a);
    const stabilityB = this.calculatePathStability(b);
    if (stabilityA !== stabilityB) {
      return stabilityB - stabilityA; // Higher stability wins
    }
    
    // 3. Prefer gallery-friendly selectors
    if (this.options.enableGalleryPattern) {
      const galleryScoreA = this.calculateGalleryFriendliness(a);
      const galleryScoreB = this.calculateGalleryFriendliness(b);
      if (galleryScoreA !== galleryScoreB) {
        return galleryScoreB - galleryScoreA; // Higher gallery score wins
      }
    }
    
    // 4. Prefer cross-site compatible selectors
    if (this.options.enableCrossSiteOptimization) {
      const compatA = this.calculateCrossSiteCompatibility(a);
      const compatB = this.calculateCrossSiteCompatibility(b);
      if (compatA !== compatB) {
        return compatB - compatA; // Higher compatibility wins
      }
    }
    
    // 5. Final tie-breaker: prefer alphabetically first (for consistency)
    const selectorA = this.pathToSelector(a);
    const selectorB = this.pathToSelector(b);
    return selectorA.localeCompare(selectorB);
  }

  /**
   * Calculate complexity penalty for a selector string
   * ENHANCED: Detailed complexity analysis
   */
  calculateComplexityPenalty(selector) {
    let penalty = 0;
    
    // Descendant combinators add complexity
    penalty += (selector.match(/\s+(?![)\]])/g) || []).length * 0.5;
    
    // Child combinators are more specific but complex
    penalty += (selector.match(/\s*>\s*/g) || []).length * 0.3;
    
    // Pseudo-selectors add complexity
    penalty += (selector.match(/:/g) || []).length * 1.0;
    
    // Attribute selectors are moderately complex
    penalty += (selector.match(/\[.*?\]/g) || []).length * 0.8;
    
    // Multiple classes/IDs in one selector
    const classes = (selector.match(/\./g) || []).length;
    const ids = (selector.match(/#/g) || []).length;
    if (classes > 1) penalty += (classes - 1) * 0.4;
    if (ids > 1) penalty += (ids - 1) * 0.6; // Multiple IDs are very unusual
    
    return penalty;
  }

  /**
   * Calculate stability penalty for a path
   * ENHANCED: Path-level stability analysis
   */
  calculateStabilityPenalty(path) {
    let penalty = 0;
    
    for (const knot of path) {
      // Position-dependent selectors are unstable
      if (knot.name.includes(':nth-child') || knot.name.includes(':nth-of-type')) {
        penalty += 2.0;
      }
      
      // Generated class names are unstable
      if (knot.name.includes('.css-') || knot.name.includes('.sc-') || knot.name.includes('._')) {
        penalty += 1.5;
      }
      
      // Very generic tag selectors without context
      if (/^(div|span|p|a)$/.test(knot.name)) {
        penalty += 0.5;
      }
    }
    
    return penalty;
  }

  /**
   * Calculate gallery optimization bonus
   * ENHANCED: Gallery-specific scoring
   */
  calculateGalleryBonus(path) {
    let bonus = 0;
    
    for (const knot of path) {
      // Gallery-related classes get bonus
      if (this.isGalleryClass(knot.name.replace(/^\./, ''))) {
        bonus += 0.5;
      }
      
      // Data attributes for galleries
      if (knot.name.includes('[data-gallery') || 
          knot.name.includes('[data-image') ||
          knot.name.includes('[data-photo')) {
        bonus += 0.7;
      }
      
      // Semantic image-related attributes
      if (knot.name.includes('[role="img"]') || 
          knot.name.includes('[aria-label*="image"]')) {
        bonus += 0.4;
      }
    }
    
    return Math.min(bonus, 2.0); // Cap bonus at 2.0
  }

  /**
   * Calculate path stability score for tie-breaking
   * ENHANCED: Comprehensive stability scoring
   */
  calculatePathStability(path) {
    let stabilityScore = 0;
    
    for (const knot of path) {
      // ID selectors are most stable
      if (knot.name.startsWith('#')) {
        stabilityScore += 10;
      }
      // Data attributes are very stable
      else if (knot.name.includes('[data-')) {
        stabilityScore += 8;
      }
      // Semantic attributes
      else if (knot.name.includes('[role=') || knot.name.includes('[aria-')) {
        stabilityScore += 7;
      }
      // Class selectors (variable stability)
      else if (knot.name.startsWith('.')) {
        const className = knot.name.substring(1);
        if (this.isStableClass(className)) {
          stabilityScore += 6;
        } else {
          stabilityScore += 3;
        }
      }
      // Tag selectors are least stable
      else {
        stabilityScore += 1;
      }
    }
    
    return stabilityScore / path.length; // Average stability per knot
  }

  /**
   * Calculate gallery-friendliness score for tie-breaking
   * ENHANCED: Gallery-specific selector scoring
   */
  calculateGalleryFriendliness(path) {
    let galleryScore = 0;
    
    for (const knot of path) {
      const name = knot.name;
      
      // Direct gallery class references
      if (name.includes('gallery') || name.includes('image') || name.includes('photo')) {
        galleryScore += 3;
      }
      
      // Gallery-related patterns
      if (name.includes('carousel') || name.includes('slider') || name.includes('grid')) {
        galleryScore += 2;
      }
      
      // Image-specific attributes
      if (name.includes('img') || name.includes('picture') || name.includes('figure')) {
        galleryScore += 2;
      }
      
      // Media-related patterns
      if (name.includes('media') || name.includes('thumb') || name.includes('tile')) {
        galleryScore += 1;
      }
    }
    
    return galleryScore;
  }

  /**
   * Calculate cross-site compatibility score for tie-breaking
   * ENHANCED: Cross-site compatibility analysis
   */
  calculateCrossSiteCompatibility(path) {
    let compatScore = 0;
    
    for (const knot of path) {
      const name = knot.name;
      
      // Highly compatible selectors
      if (name.includes('[data-testid') || name.includes('[data-id')) {
        compatScore += 5;
      }
      
      // Semantic attributes are compatible
      if (name.includes('[role=') || name.includes('[aria-')) {
        compatScore += 4;
      }
      
      // Stable IDs are good
      if (name.startsWith('#') && this.finderCore.idName(name.substring(1))) {
        compatScore += 4;
      }
      
      // Framework-specific classes reduce compatibility
      if (name.includes('.ng-') || name.includes('.vue-') || 
          name.includes('.react-') || name.includes('.css-')) {
        compatScore -= 2;
      }
      
      // Position-dependent selectors reduce compatibility
      if (name.includes(':nth-') || name.includes(':first-') || name.includes(':last-')) {
        compatScore -= 3;
      }
      
      // Generic tag names are moderately compatible
      if (/^[a-z]+$/.test(name) && !['div', 'span', 'p', 'a'].includes(name)) {
        compatScore += 2;
      }
    }
    
    return Math.max(0, compatScore);
  }

  /**
   * Check if selector is unique in the document
   */
  isUnique(path, rootDocument) {
    const selector = this.pathToSelector(path);
    try {
      const elements = rootDocument.querySelectorAll(selector);
      return elements.length === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Optimize path by removing redundant levels
   */
  *optimizePath(path, element, config, rootDocument, startTime) {
    if (path.length > 2 && path.length > config.optimizedMinLength) {
      for (let i = 1; i < path.length - 1; i++) {
        const elapsedTime = performance.now() - startTime;
        if (elapsedTime > config.timeoutMs) {
          return;
        }

        const newPath = [...path];
        newPath.splice(i, 1);
        
        if (this.isUnique(newPath, rootDocument)) {
          const selector = this.pathToSelector(newPath);
          try {
            if (rootDocument.querySelector(selector) === element) {
              yield newPath;
              yield* this.optimizePath(newPath, element, config, rootDocument, startTime);
            }
          } catch (error) {
            // Skip invalid selectors
          }
        }
      }
    }
  }

  /**
   * Apply STEPTHREE-specific optimizations
   * ENHANCED: Better optimization with stability testing
   */
  async applySTEPTHREEOptimizations(selector, element, config) {
    let optimizedSelector = selector;

    // Gallery pattern optimization
    if (this.options.enableGalleryPattern) {
      optimizedSelector = this.optimizeForGalleryPatterns(optimizedSelector, element);
    }

    // Cross-site compatibility optimization
    if (this.options.enableCrossSiteOptimization) {
      optimizedSelector = this.optimizeForCrossSiteCompatibility(optimizedSelector, element);
      this.metrics.crossSiteOptimizations++;
    }

    // Dynamic content optimization (NEW)
    if (this.options.enableDynamicContentSupport) {
      optimizedSelector = this.optimizeForDynamicContent(optimizedSelector, element);
    }

    // Stability validation (NEW)
    const stabilityScore = this.validateSelectorStability(optimizedSelector, element);
    if (stabilityScore < 0.7) {
      console.warn('⚠️ Selector stability low, trying refinement');
      optimizedSelector = await this.refineSelectorForStability(optimizedSelector, element, config);
    }

    // Length validation
    if (optimizedSelector.length > this.options.maxSelectorLength) {
      console.warn('⚠️ Selector too long, using fallback');
      optimizedSelector = this.generateFallbackSelector(element);
    }

    return optimizedSelector;
  }

  /**
   * Optimize selector for dynamic content scenarios
   * NEW: Better handling of changing DOM
   */
  optimizeForDynamicContent(selector, element) {
    // Avoid selectors that depend on position if content is dynamic
    if (this.isDynamicContent(element)) {
      // Remove nth-child and nth-of-type selectors for dynamic content
      selector = selector.replace(/:nth-child\(\d+\)/g, '');
      selector = selector.replace(/:nth-of-type\(\d+\)/g, '');
      
      // Prefer data attributes and IDs for dynamic content
      const stableAlternative = this.findStableSelector(element);
      if (stableAlternative && this.isValidSelector(stableAlternative)) {
        return stableAlternative;
      }
    }

    return selector;
  }

  /**
   * Check if element is in dynamic content area
   */
  isDynamicContent(element) {
    let current = element;
    while (current && current !== document.body) {
      // Check for dynamic content indicators
      if (this.hasDynamicContentMarkers(current)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  /**
   * Check for dynamic content markers
   */
  hasDynamicContentMarkers(element) {
    const dynamicMarkers = [
      'data-ajax', 'data-dynamic', 'data-lazy', 'data-infinite',
      'data-virtual', 'data-load-more', 'data-scroll'
    ];
    
    return dynamicMarkers.some(marker => element.hasAttribute(marker)) ||
           /infinite|lazy|dynamic|ajax|virtual/i.test(element.className);
  }

  /**
   * Find stable selector for dynamic content
   */
  findStableSelector(element) {
    // Priority order for stable selectors
    const stableAttributes = [
      'data-testid', 'data-id', 'data-name', 'id', 
      'role', 'aria-label', 'data-component'
    ];
    
    for (const attr of stableAttributes) {
      const value = element.getAttribute(attr);
      if (value && this.finderCore.attr(attr, value)) {
        return `[${attr}="${CSS.escape(value)}"]`;
      }
    }
    
    // Try class-based selector with gallery preference
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      const stableClasses = classes.filter(c => 
        this.isStableClass(c) && this.finderCore.className(c)
      );
      
      if (stableClasses.length > 0) {
        return '.' + CSS.escape(stableClasses[0]);
      }
    }
    
    return null;
  }

  /**
   * Check if class name is stable (not generated or framework-specific)
   */
  isStableClass(className) {
    // Avoid auto-generated classes
    const unstablePatterns = [
      /^css-\w+$/,           // CSS-in-JS classes
      /^sc-\w+$/,            // Styled-components
      /^_\w+$/,              // Module CSS
      /^\w+-\d+$/,           // Generated classes with numbers
      /^[a-f0-9]{6,}$/,      // Hash-like classes
      /^MuiButton-\w+$/,     // Material-UI classes
      /^ant-\w+$/,           // Ant Design classes
      /^v-\w+$/              // Vue scoped classes
    ];
    
    return !unstablePatterns.some(pattern => pattern.test(className));
  }

  /**
   * Validate selector stability across different scenarios
   * NEW: Comprehensive stability testing
   */
  validateSelectorStability(selector, element) {
    let stabilityScore = 1.0;
    
    try {
      // Test 1: Basic uniqueness
      const elements = document.querySelectorAll(selector);
      if (elements.length !== 1 || elements[0] !== element) {
        stabilityScore -= 0.4;
      }
      
      // Test 2: Stability against common DOM changes
      stabilityScore -= this.testDOMChangeStability(selector, element) * 0.3;
      
      // Test 3: Cross-browser compatibility indicators
      stabilityScore -= this.testCrossBrowserCompatibility(selector) * 0.2;
      
      // Test 4: Framework stability
      stabilityScore -= this.testFrameworkStability(selector) * 0.1;
      
    } catch (error) {
      stabilityScore = 0;
    }
    
    return Math.max(0, stabilityScore);
  }

  /**
   * Test stability against DOM changes
   */
  testDOMChangeStability(selector, element) {
    let instabilityScore = 0;
    
    // Check for position-dependent selectors
    if (selector.includes(':nth-child') || selector.includes(':nth-of-type')) {
      instabilityScore += 0.5;
    }
    
    // Check for fragile attribute dependencies
    if (selector.includes('[class*=') && selector.includes('css-')) {
      instabilityScore += 0.3;
    }
    
    // Check for deep nesting (fragile to structural changes)
    const nestingLevel = (selector.match(/>/g) || []).length + (selector.match(/\s+/g) || []).length;
    if (nestingLevel > 3) {
      instabilityScore += 0.2;
    }
    
    return Math.min(1, instabilityScore);
  }

  /**
   * Test cross-browser compatibility
   */
  testCrossBrowserCompatibility(selector) {
    let incompatibilityScore = 0;
    
    // Check for modern CSS selectors that might not work everywhere
    if (selector.includes(':is(') || selector.includes(':where(')) {
      incompatibilityScore += 0.3;
    }
    
    if (selector.includes(':has(')) {
      incompatibilityScore += 0.2;
    }
    
    return incompatibilityScore;
  }

  /**
   * Test framework stability
   */
  testFrameworkStability(selector) {
    let instabilityScore = 0;
    
    const frameworkPatterns = [
      /\bReact\w+/,
      /\bVue\w+/,
      /\bng-\w+/,
      /\b_\w+_\w+/,
      /\bsc-\w+/
    ];
    
    frameworkPatterns.forEach(pattern => {
      if (pattern.test(selector)) {
        instabilityScore += 0.2;
      }
    });
    
    return Math.min(1, instabilityScore);
  }

  /**
   * Refine selector for better stability
   * NEW: Intelligent selector refinement
   */
  async refineSelectorForStability(selector, element, config) {
    try {
      // Strategy 1: Try to find a more stable alternative
      const stableSelector = this.findStableSelector(element);
      if (stableSelector && this.validateSelectorStability(stableSelector, element) > 0.7) {
        return stableSelector;
      }
      
      // Strategy 2: Simplify current selector
      const simplifiedSelector = this.simplifySelector(selector, element);
      if (simplifiedSelector && this.validateSelectorStability(simplifiedSelector, element) > 0.7) {
        return simplifiedSelector;
      }
      
      // Strategy 3: Generate alternative using different strategy
      const alternativeConfig = {
        ...config,
        seedMinLength: Math.max(2, config.seedMinLength - 1),
        enableDataAttributePreference: true
      };
      
      const alternative = await this.findUniqueSelector(element, alternativeConfig, Date.now());
      if (this.validateSelectorStability(alternative, element) > 0.7) {
        return alternative;
      }
      
      // Strategy 4: Use hybrid approach
      return this.generateHybridSelector(element);
      
    } catch (error) {
      console.warn('⚠️ Selector refinement failed:', error);
      return selector; // Return original if refinement fails
    }
  }

  /**
   * Simplify selector by removing fragile parts
   */
  simplifySelector(selector, element) {
    let simplified = selector;
    
    // Remove position-dependent selectors
    simplified = simplified.replace(/:nth-child\(\d+\)/g, '');
    simplified = simplified.replace(/:nth-of-type\(\d+\)/g, '');
    
    // Remove excessive nesting
    const parts = simplified.split(/\s*>\s*|\s+/);
    if (parts.length > 3) {
      simplified = parts.slice(-3).join(' ');
    }
    
    // Validate simplified selector
    try {
      const elements = document.querySelectorAll(simplified);
      if (elements.length === 1 && elements[0] === element) {
        return simplified;
      }
    } catch (error) {
      // Invalid selector
    }
    
    return null;
  }

  /**
   * Generate hybrid selector combining multiple approaches
   */
  generateHybridSelector(element) {
    const components = [];
    
    // Add stable identifier if available
    const stableId = this.findStableIdentifier(element);
    if (stableId) {
      components.push(stableId);
    }
    
    // Add tag name for context
    components.push(element.tagName.toLowerCase());
    
    // Combine components
    if (components.length > 1) {
      return components.join('');
    } else if (components.length === 1) {
      return components[0];
    }
    
    // Last resort: use tag with position
    return this.generateFallbackSelector(element);
  }

  /**
   * Find most stable identifier for element
   */
  findStableIdentifier(element) {
    // Priority: ID > data attributes > stable classes
    if (element.id && this.finderCore.idName(element.id)) {
      return `#${CSS.escape(element.id)}`;
    }
    
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId && this.finderCore.attr('data-testid', dataTestId)) {
      return `[data-testid="${CSS.escape(dataTestId)}"]`;
    }
    
    const dataId = element.getAttribute('data-id');
    if (dataId && this.finderCore.attr('data-id', dataId)) {
      return `[data-id="${CSS.escape(dataId)}"]`;
    }
    
    if (element.className) {
      const stableClass = element.className.split(' ')
        .find(c => this.isStableClass(c) && this.finderCore.className(c));
      if (stableClass) {
        return `.${CSS.escape(stableClass)}`;
      }
    }
    
    return null;
  }

  /**
   * Optimize selector for gallery patterns
   */
  optimizeForGalleryPatterns(selector, element) {
    // Check if element is part of a repeating pattern
    const parent = element.parentElement;
    if (!parent) return selector;

    const siblings = Array.from(parent.children);
    const similarElements = siblings.filter(sibling => 
      sibling.tagName === element.tagName &&
      sibling.className === element.className
    );

    // If this is part of a repeating pattern, prefer class-based selectors
    if (similarElements.length > 2) {
      const classSelector = this.extractClassSelector(selector);
      if (classSelector && this.isValidSelector(classSelector)) {
        this.metrics.patternOptimizations++;
        return classSelector;
      }
    }

    return selector;
  }

  /**
   * Optimize selector for cross-site compatibility
   */
  optimizeForCrossSiteCompatibility(selector, element) {
    // Prefer data attributes and semantic selectors
    if (selector.includes('[data-')) {
      return selector; // Data attributes are usually stable
    }

    // Avoid framework-specific classes
    const frameworkClasses = ['ng-', 'v-', 'vue-', 'react-', '_', 'css-'];
    let hasFrameworkClass = false;
    
    for (const framework of frameworkClasses) {
      if (selector.includes(`.${framework}`) || selector.includes(`[class*="${framework}"]`)) {
        hasFrameworkClass = true;
        break;
      }
    }

    if (hasFrameworkClass) {
      // Try to find a more stable alternative
      const stableSelector = this.findStableAlternative(element);
      if (stableSelector) {
        return stableSelector;
      }
    }

    return selector;
  }

  /**
   * Find a more stable alternative selector
   */
  findStableAlternative(element) {
    // Try semantic attributes first
    const semanticAttrs = ['role', 'aria-label', 'data-testid', 'data-id'];
    for (const attr of semanticAttrs) {
      const value = element.getAttribute(attr);
      if (value && this.finderCore.attr(attr, value)) {
        const selector = `[${attr}="${CSS.escape(value)}"]`;
        if (this.isValidSelector(selector)) {
          return selector;
        }
      }
    }

    // Try tag + position as last resort
    const tagName = element.tagName.toLowerCase();
    const nthOfType = this.calculateNthOfType(element, tagName);
    if (nthOfType !== undefined) {
      return this.generateNthOfType(tagName, nthOfType);
    }

    return null;
  }

  /**
   * Extract class selector from a complex selector
   */
  extractClassSelector(selector) {
    const classMatch = selector.match(/\.[a-zA-Z][a-zA-Z0-9\-_]*/);
    return classMatch ? classMatch[0] : null;
  }

  /**
   * Validate if a selector is functional
   */
  isValidSelector(selector) {
    try {
      document.querySelector(selector);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate fallback selector for edge cases
   */
  generateFallbackSelector(element) {
    const tagName = element.tagName.toLowerCase();
    const nthChild = this.calculateNthChild(element);
    
    if (nthChild !== undefined) {
      return this.generateNthChild(tagName, nthChild);
    }
    
    return tagName;
  }

  /**
   * Generate fallback path for timeout scenarios
   */
  generateFallbackPath(element, rootDocument) {
    const path = [];
    let current = element;
    let level = 0;

    while (current && current !== rootDocument) {
      const tagName = current.tagName.toLowerCase();
      const nthOfType = this.calculateNthOfType(current, tagName);
      
      if (nthOfType === undefined) {
        return null;
      }

      path.push({
        name: this.generateNthOfType(tagName, nthOfType),
        penalty: NaN,
        level: level
      });

      current = current.parentElement;
      level++;
    }

    return this.isUnique(path, rootDocument) ? path : null;
  }

  /**
   * Calculate nth-child position
   */
  calculateNthChild(element) {
    const parent = element.parentNode;
    if (!parent) return undefined;

    let child = parent.firstChild;
    let index = 0;

    while (child) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        index++;
      }
      if (child === element) {
        return index;
      }
      child = child.nextSibling;
    }

    return undefined;
  }

  /**
   * Calculate nth-of-type position
   */
  calculateNthOfType(element, tagName) {
    const parent = element.parentNode;
    if (!parent) return undefined;

    let child = parent.firstChild;
    let index = 0;

    while (child) {
      if (child.nodeType === Node.ELEMENT_NODE && 
          child.tagName.toLowerCase() === tagName) {
        index++;
      }
      if (child === element) {
        return index;
      }
      child = child.nextSibling;
    }

    return undefined;
  }

  /**
   * Generate optimized nth-child selector
   * ENHANCED: Better nth-child generation with optimization patterns
   */
  generateNthChild(tagName, index) {
    if (tagName === 'html') return 'html';
    
    // For gallery scenarios, try to use more stable patterns
    if (this.options.enableGalleryPattern && this.isCommonGalleryTag(tagName)) {
      // Try to find if this follows a repeating pattern (every 2nd, 3rd, etc.)
      const pattern = this.detectNthPattern(index);
      if (pattern) {
        return `${tagName}:${pattern}`;
      }
    }
    
    return `${tagName}:nth-child(${index})`;
  }

  /**
   * Generate optimized nth-of-type selector
   * ENHANCED: Better nth-of-type generation with gallery optimization
   */
  generateNthOfType(tagName, index) {
    if (tagName === 'html') return 'html';
    
    // Enhanced nth-of-type with pattern detection
    if (this.options.enableGalleryPattern) {
      const pattern = this.detectNthPattern(index);
      if (pattern && this.isCommonGalleryTag(tagName)) {
        return `${tagName}:${pattern.replace('nth-child', 'nth-of-type')}`;
      }
    }
    
    return `${tagName}:nth-of-type(${index})`;
  }

  /**
   * Detect nth patterns for optimization
   * ENHANCED: Pattern detection for repeating gallery elements
   */
  detectNthPattern(index) {
    if (index <= 1) return null;
    
    // Common gallery patterns
    if (index % 2 === 0) return 'nth-child(even)';
    if (index % 2 === 1) return 'nth-child(odd)';
    if (index % 3 === 1) return 'nth-child(3n+1)';
    if (index % 4 === 1) return 'nth-child(4n+1)';
    if (index % 5 === 1) return 'nth-child(5n+1)';
    
    return null;
  }

  /**
   * Check if tag is commonly used in galleries
   * ENHANCED: Gallery tag detection for optimization
   */
  isCommonGalleryTag(tagName) {
    const galleryTags = ['div', 'li', 'article', 'section', 'figure', 'a', 'span'];
    return galleryTags.includes(tagName.toLowerCase());
  }

  /**
   * Find root document for queries
   */
  findRootDocument(rootNode) {
    if (rootNode.nodeType === Node.DOCUMENT_NODE) {
      return rootNode;
    }
    return rootNode.ownerDocument || document;
  }

  /**
   * Generate cache key for selector caching
   */
  generateCacheKey(element, options) {
    const elementId = element.getAttribute('id') || '';
    const elementClass = element.className || '';
    const elementTag = element.tagName;
    const optionsHash = JSON.stringify(options);
    
    return `${elementTag}-${elementId}-${elementClass}-${optionsHash}`;
  }

  /**
   * Generate multiple selector candidates for an element
   * Useful for finding the most robust selector across different scenarios
   */
  async generateSelectorCandidates(element, options = {}) {
    const candidates = [];
    
    try {
      // Generate primary selector
      const primary = await this.generateSelector(element, options);
      candidates.push({ selector: primary, type: 'primary', penalty: 0 });

      // Generate alternative selectors with different preferences
      const configs = [
        { ...options, enableImageOptimization: true, type: 'image-optimized' },
        { ...options, enableGalleryPattern: true, type: 'gallery-optimized' },
        { ...options, enableCrossSiteOptimization: true, type: 'cross-site-optimized' },
        { ...options, seedMinLength: 2, type: 'shorter' },
        { ...options, seedMinLength: 4, type: 'longer' }
      ];

      for (const config of configs) {
        try {
          const candidate = await this.generateSelector(element, config);
          if (candidate !== primary && this.isValidSelector(candidate)) {
            candidates.push({
              selector: candidate,
              type: config.type,
              penalty: this.calculateSelectorComplexity(candidate)
            });
          }
        } catch (error) {
          // Skip failed candidates
        }
      }

      // Sort by penalty (lower is better)
      candidates.sort((a, b) => a.penalty - b.penalty);
      
      return candidates;
      
    } catch (error) {
      console.warn('⚠️ Selector candidate generation failed:', error);
      return [{
        selector: this.generateFallbackSelector(element),
        type: 'fallback',
        penalty: 100
      }];
    }
  }

  /**
   * Calculate selector complexity for penalty scoring
   */
  calculateSelectorComplexity(selector) {
    let complexity = 0;
    
    // Length penalty
    complexity += Math.floor(selector.length / 10);
    
    // Specificity penalties
    complexity += (selector.match(/#/g) || []).length * 0; // IDs are good
    complexity += (selector.match(/\./g) || []).length * 1; // Classes are okay
    complexity += (selector.match(/\[/g) || []).length * 2; // Attributes are heavier
    complexity += (selector.match(/:/g) || []).length * 5; // Pseudo-selectors are complex
    complexity += (selector.match(/>/g) || []).length * 3; // Child selectors add complexity
    
    return complexity;
  }

  /**
   * Batch generate selectors for multiple elements
   * Optimized for performance when processing many elements
   */
  async generateSelectorsForElements(elements, options = {}) {
    const results = new Map();
    const batchSize = options.batchSize || 10;
    
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      const batchPromises = batch.map(async (element, index) => {
        try {
          const selector = await this.generateSelector(element, options);
          return { element, selector, index: i + index };
        } catch (error) {
          console.warn(`Failed to generate selector for element ${i + index}:`, error);
          return { 
            element, 
            selector: this.generateFallbackSelector(element), 
            index: i + index 
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => {
        results.set(result.element, result.selector);
      });
    }
    
    return results;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.selectorCache.size,
      averageOptimizationTime: this.metrics.selectorsGenerated > 0 
        ? this.metrics.optimizationTime / this.metrics.selectorsGenerated 
        : 0
    };
  }

  /**
   * Clear caches and reset metrics
   */
  reset() {
    this.selectorCache.clear();
    this.patternCache.clear();
    this.metrics = {
      selectorsGenerated: 0,
      optimizationTime: 0,
      timeouts: 0,
      crossSiteOptimizations: 0,
      patternOptimizations: 0
    };
  }
}

// Export class using idempotent assignment to avoid redeclaration errors
// This allows the file to be loaded multiple times safely
if (typeof globalThis !== 'undefined') {
  globalThis.EnhancedCSSSelector = EnhancedCSSSelector;
  
  // Also export to __ST namespace for content script access
  if (!globalThis.__ST) {
    globalThis.__ST = {};
  }
  globalThis.__ST.EnhancedCSSSelector = EnhancedCSSSelector;
}

// Also export to window if available (for browser environments)
if (typeof window !== 'undefined') {
  window.EnhancedCSSSelector = EnhancedCSSSelector;
  
  if (!window.__ST) {
    window.__ST = {};
  }
  window.__ST.EnhancedCSSSelector = EnhancedCSSSelector;
}

console.log('✅ Enhanced CSS Selector System loaded successfully');