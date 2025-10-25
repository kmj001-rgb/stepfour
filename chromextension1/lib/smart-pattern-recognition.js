// smart-pattern-recognition.js - Advanced Pattern Recognition for STEPTHREE
// Based on Simplescraper's intelligent gallery detection and image pattern recognition
// Integrates with Enhanced CSS Selector system for robust gallery scraping

console.log('🚀 Loading Smart Pattern Recognition System...');

// Prevent class redeclaration when file is loaded multiple times
if (typeof window !== 'undefined' && !window.SmartPatternRecognition) {

/**
 * Smart Pattern Recognition System
 * Detects image galleries, repeating patterns, and generates intelligent selectors
 */
class SmartPatternRecognition {
  constructor(options = {}) {
    this.options = {
      // Pattern detection thresholds
      minPatternItems: options.minPatternItems || 3,
      maxPatternDistance: options.maxPatternDistance || 200,
      minConfidenceScore: options.minConfidenceScore || 0.3,
      highConfidenceThreshold: options.highConfidenceThreshold || 0.75,
      
      // Image filtering
      minImageWidth: options.minImageWidth || 30, // More lenient for gallery images
      minImageHeight: options.minImageHeight || 30, // More lenient for gallery images
      
      // Performance limits
      maxElementsToAnalyze: options.maxElementsToAnalyze || 2000,
      analysisTimeout: options.analysisTimeout || 5000,
      
      // Feature toggles
      enableAdvancedPatterns: options.enableAdvancedPatterns !== false,
      enableUrlValidation: options.enableUrlValidation !== false,
      enableContentValidation: options.enableContentValidation !== false,
      enableLayoutAnalysis: options.enableLayoutAnalysis !== false,
      
      ...options
    };

    // Pattern caches
    this.patternCache = new Map();
    this.galleryCache = new Map();
    this.selectorCache = new Map();
    
    // Performance tracking
    this.metrics = {
      patternsDetected: 0,
      galleriesFound: 0,
      confidenceScores: [],
      processingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Pattern definitions
    this.galleryPatterns = this.initializeGalleryPatterns();
    this.layoutPatterns = this.initializeLayoutPatterns();
    
    // Input Sanitizer integration (CR-019: Critical security hardening)
    this.sanitizer = null;
    this.initializeInputSanitizer();
    
    // Enhanced CSS Selector integration
    this.cssSelector = null;
    this.initializeEnhancedSelector();
    
    console.log('✅ Smart Pattern Recognition System initialized');
  }

  /**
   * Initialize Input Sanitizer for security (CR-019)
   */
  initializeInputSanitizer() {
    if (typeof window !== 'undefined' && window.InputSanitizer) {
      this.sanitizer = new window.InputSanitizer();
      console.log('✅ Input Sanitizer integration enabled for security');
    } else {
      throw new Error('SECURITY: InputSanitizer is required but not available');
    }
  }

  /**
   * Safe querySelector with sanitization (CR-019)
   * @param {Element} element - Element to query from
   * @param {string} selector - CSS selector to sanitize and use
   * @returns {Element|null} - Found element or null
   */
  safeQuerySelector(element, selector) {
    if (!selector || typeof selector !== 'string') {
      return null;
    }
    
    if (this.sanitizer) {
      selector = this.sanitizer.sanitizeSelector(selector);
      if (!selector) {
        console.warn('🛡️ Selector sanitization blocked invalid selector');
        return null;
      }
    }
    
    try {
      return element.querySelector(selector);
    } catch (error) {
      console.warn('Invalid selector after sanitization:', selector, error);
      return null;
    }
  }

  /**
   * Safe querySelectorAll with sanitization (CR-019)
   * @param {Element} element - Element to query from  
   * @param {string} selector - CSS selector to sanitize and use
   * @returns {NodeList} - Found elements or empty NodeList
   */
  safeQuerySelectorAll(element, selector) {
    if (!selector || typeof selector !== 'string') {
      return [];
    }
    
    if (this.sanitizer) {
      selector = this.sanitizer.sanitizeSelector(selector);
      if (!selector) {
        console.warn('🛡️ Selector sanitization blocked invalid selector');
        return [];
      }
    }
    
    try {
      return element.querySelectorAll(selector);
    } catch (error) {
      console.warn('Invalid selector after sanitization:', selector, error);
      return [];
    }
  }

  /**
   * Initialize Enhanced CSS Selector integration
   */
  initializeEnhancedSelector() {
    if (typeof window !== 'undefined' && window.EnhancedCSSSelector) {
      this.cssSelector = new window.EnhancedCSSSelector({
        enableImageOptimization: true,
        enableGalleryPattern: true,
        enableCrossSiteOptimization: true
      });
      console.log('✅ Enhanced CSS Selector integration enabled');
    } else {
      console.warn('⚠️ Enhanced CSS Selector not available, using fallback methods');
    }
  }

  /**
   * Initialize gallery pattern definitions
   */
  initializeGalleryPatterns() {
    return {
      // Class name patterns
      classPatterns: [
        /gallery/i, /image[s]?/i, /photo[s]?/i, /picture[s]?/i,
        /thumb[s]?/i, /thumbnail[s]?/i, /carousel/i, /slider/i,
        /grid/i, /masonry/i, /lightbox/i, /modal/i,
        /item[s]?/i, /tile[s]?/i, /card[s]?/i, /media/i,
        /portfolio/i, /showcase/i, /collection/i
      ],
      
      // ID patterns
      idPatterns: [
        /gallery/i, /images/i, /photos/i, /carousel/i,
        /slider/i, /lightbox/i, /portfolio/i
      ],
      
      // Data attribute patterns
      dataPatterns: [
        /gallery/i, /image/i, /photo/i, /carousel/i,
        /slider/i, /lightbox/i, /grid/i
      ],
      
      // URL patterns (for dynamic content)
      urlPatterns: [
        /\/gallery/i, /\/images/i, /\/photos/i, /\/portfolio/i,
        /\/media/i, /\/pictures/i
      ]
    };
  }

  /**
   * Initialize layout pattern definitions
   */
  initializeLayoutPatterns() {
    return {
      // Grid layouts
      grid: {
        minItems: 4,
        aspectRatioTolerance: 0.3,
        alignmentTolerance: 10,
        spacingTolerance: 5
      },
      
      // Carousel/slider layouts
      carousel: {
        minItems: 3,
        horizontalAlignment: true,
        overflowHidden: true
      },
      
      // Masonry layouts
      masonry: {
        minItems: 6,
        variableHeights: true,
        columnAlignment: true
      },
      
      // List layouts
      list: {
        minItems: 3,
        verticalAlignment: true,
        uniformWidth: true
      }
    };
  }

  /**
   * Main pattern detection entry point
   * Analyzes the page and returns detected gallery patterns
   */
  async detectPatterns(options = {}) {
    const startTime = performance.now();
    console.log('🎯 Starting smart pattern recognition...');
    
    try {
      // Merge options
      const config = { ...this.options, ...options };
      
      // Check cache first
      const cacheKey = this.generatePageCacheKey();
      if (this.galleryCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        return this.galleryCache.get(cacheKey);
      }
      
      this.metrics.cacheMisses++;
      
      // Phase 1: Detect potential gallery containers
      const galleryContainers = await this.detectGalleryContainers(config);
      
      // Phase 2: Analyze image patterns within containers
      const imagePatterns = await this.analyzeImagePatterns(galleryContainers, config);
      
      // Phase 3: Generate enhanced selectors for reliable patterns
      const enhancedPatterns = await this.generateEnhancedSelectors(imagePatterns, config);
      
      // Phase 4: Score and rank patterns by confidence
      const rankedPatterns = this.scoreAndRankPatterns(enhancedPatterns, config);
      
      const results = {
        success: true,
        patterns: rankedPatterns,
        containers: galleryContainers,
        metadata: {
          processingTime: performance.now() - startTime,
          patternsFound: rankedPatterns.length,
          containersAnalyzed: galleryContainers.length,
          confidence: rankedPatterns.length > 0 ? rankedPatterns[0].confidence : 0
        }
      };
      
      // Cache results
      this.galleryCache.set(cacheKey, results);
      
      // Update metrics
      this.metrics.patternsDetected += rankedPatterns.length;
      this.metrics.galleriesFound += galleryContainers.length;
      this.metrics.processingTime += results.metadata.processingTime;
      
      console.log(`✅ Pattern recognition completed: ${rankedPatterns.length} patterns found`);
      return results;
      
    } catch (error) {
      console.error('❌ Pattern recognition failed:', error);
      return {
        success: false,
        error: error.message,
        patterns: [],
        containers: [],
        metadata: {
          processingTime: performance.now() - startTime,
          patternsFound: 0,
          containersAnalyzed: 0,
          confidence: 0
        }
      };
    }
  }

  /**
   * Detect potential gallery containers using multiple strategies
   */
  async detectGalleryContainers(config) {
    const containers = new Set();
    
    try {
      // Strategy 1: Semantic gallery elements
      await this.detectSemanticGalleries(containers);
      
      // Strategy 2: Class-based detection
      await this.detectClassBasedGalleries(containers);
      
      // Strategy 3: Layout-based detection
      if (config.enableLayoutAnalysis) {
        await this.detectLayoutBasedGalleries(containers);
      }
      
      // Strategy 4: Image density analysis
      await this.detectImageDensityContainers(containers);
      
      // Strategy 5: Dynamic content detection (NEW)
      await this.detectDynamicContentContainers(containers, config);
      
      // Strategy 6: Framework-specific patterns (NEW)
      await this.detectFrameworkGalleries(containers, config);
      
      // Filter and validate containers
      const validContainers = Array.from(containers).filter(container => 
        this.validateGalleryContainer(container, config)
      );
      
      console.log(`🔍 Found ${validContainers.length} potential gallery containers`);
      return validContainers;
      
    } catch (error) {
      console.warn('⚠️ Container detection failed:', error);
      return [];
    }
  }

  /**
   * Detect semantic gallery elements (div[role], semantic HTML)
   * CR-019: Using sanitized selectors for security
   */
  async detectSemanticGalleries(containers) {
    const semanticSelectors = [
      'section[aria-label*="gallery" i]',
      'div[role="img"]',
      'div[role="gallery"]',
      'figure',
      'main section',
      '[aria-label*="image" i]',
      '[aria-label*="photo" i]',
      '[aria-describedby*="gallery" i]'
    ];
    
    for (const selector of semanticSelectors) {
      try {
        const elements = this.safeQuerySelectorAll(document, selector);
        elements.forEach(el => {
          if (this.hasImageChildren(el)) {
            containers.add(el);
          }
        });
      } catch (error) {
        // Skip invalid selectors
      }
    }
  }

  /**
   * Detect class-based galleries using enhanced pattern matching
   * ENHANCED: Better DOM traversal and performance optimization
   */
  async detectClassBasedGalleries(containers) {
    // Enhanced DOM traversal with intelligent selection
    const candidateElements = this.getGalleryCandidateElements();
    const maxElements = Math.min(candidateElements.length, this.options.maxElementsToAnalyze);
    
    // Process elements in batches to avoid blocking
    const batchSize = 100;
    for (let i = 0; i < maxElements; i += batchSize) {
      const batch = candidateElements.slice(i, i + batchSize);
      
      await this.processCandidateBatch(batch, containers);
      
      // Yield control periodically for better performance
      if (i % 500 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Get candidate elements using intelligent pre-filtering
   * ENHANCED: Smart element selection to reduce processing load
   * CR-019: Using sanitized selectors for security
   */
  getGalleryCandidateElements() {
    const candidates = new Set();
    
    // Strategy 1: Direct gallery-related selector queries (most efficient)
    const directSelectors = [
      '[class*="gallery" i]', '[class*="image" i]', '[class*="photo" i]',
      '[class*="carousel" i]', '[class*="slider" i]', '[class*="grid" i]',
      '[id*="gallery" i]', '[id*="image" i]', '[id*="photo" i]',
      '[data-gallery]', '[data-image]', '[data-photo]', '[data-carousel]'
    ];
    
    directSelectors.forEach(selector => {
      try {
        this.safeQuerySelectorAll(document, selector).forEach(el => candidates.add(el));
      } catch (error) {
        // Skip invalid selectors
      }
    });
    
    // Strategy 2: Elements containing multiple images
    const imageContainers = document.querySelectorAll('div, section, article, main, aside, nav');
    imageContainers.forEach(container => {
      const imageCount = container.querySelectorAll('img, [data-src], [data-lazy]').length;
      if (imageCount >= this.options.minPatternItems) {
        candidates.add(container);
      }
    });
    
    // Strategy 3: Parent elements of image-heavy areas
    const images = document.querySelectorAll('img');
    const imageParents = new Map();
    
    images.forEach(img => {
      let parent = img.parentElement;
      let depth = 0;
      const maxDepth = 3;
      
      while (parent && depth < maxDepth) {
        if (!imageParents.has(parent)) {
          imageParents.set(parent, 0);
        }
        imageParents.set(parent, imageParents.get(parent) + 1);
        parent = parent.parentElement;
        depth++;
      }
    });
    
    // Add parents with significant image counts
    imageParents.forEach((count, parent) => {
      if (count >= this.options.minPatternItems) {
        candidates.add(parent);
      }
    });
    
    return Array.from(candidates);
  }

  /**
   * Process a batch of candidate elements
   * ENHANCED: Optimized batch processing
   */
  async processCandidateBatch(batch, containers) {
    for (const element of batch) {
      try {
        // Multi-criteria pattern matching
        const matchReasons = [];
        
        // Check class names with enhanced matching
        if (this.matchesGalleryPatternEnhanced(element.className, this.galleryPatterns.classPatterns)) {
          matchReasons.push('class');
        }
        
        // Check IDs with enhanced matching
        if (element.id && this.matchesGalleryPatternEnhanced(element.id, this.galleryPatterns.idPatterns)) {
          matchReasons.push('id');
        }
        
        // Check data attributes with enhanced logic
        const dataMatches = this.checkDataAttributeMatches(element);
        if (dataMatches.length > 0) {
          matchReasons.push(...dataMatches);
        }
        
        // Check structural patterns
        const structuralMatch = this.checkStructuralGalleryPattern(element);
        if (structuralMatch) {
          matchReasons.push('structural');
        }
        
        // Enhanced image children validation
        if (matchReasons.length > 0 && this.hasImageChildrenEnhanced(element)) {
          // Add metadata about why this container was detected
          element._galleryDetectionReasons = matchReasons;
          element._detectionScore = this.calculateDetectionScore(matchReasons, element);
          containers.add(element);
        }
        
      } catch (error) {
        console.debug('Error processing candidate element:', error);
      }
    }
  }

  /**
   * Enhanced pattern matching with fuzzy logic
   * ENHANCED: Better pattern recognition with scoring
   */
  matchesGalleryPatternEnhanced(text, patterns) {
    if (!text || typeof text !== 'string') return false;
    
    const normalizedText = text.toLowerCase();
    
    // Direct pattern matches
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) return true;
    }
    
    // Fuzzy matching for compound class names
    const words = normalizedText.split(/[-_\s]+/);
    const galleryTerms = ['gallery', 'image', 'photo', 'picture', 'carousel', 'slider', 'grid', 'masonry'];
    
    return words.some(word => galleryTerms.includes(word));
  }

  /**
   * Enhanced data attribute checking
   * ENHANCED: More comprehensive data attribute analysis
   */
  checkDataAttributeMatches(element) {
    const matches = [];
    
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        // Check attribute name
        if (this.matchesGalleryPatternEnhanced(attr.name, this.galleryPatterns.dataPatterns)) {
          matches.push(`data-name:${attr.name}`);
        }
        
        // Check attribute value
        if (this.matchesGalleryPatternEnhanced(attr.value, this.galleryPatterns.dataPatterns)) {
          matches.push(`data-value:${attr.name}`);
        }
        
        // Special handling for common gallery data attributes
        if (this.isGalleryDataAttribute(attr.name, attr.value)) {
          matches.push(`data-special:${attr.name}`);
        }
      }
    }
    
    return matches;
  }

  /**
   * Check for structural gallery patterns
   * ENHANCED: Advanced structural analysis
   */
  checkStructuralGalleryPattern(element) {
    try {
      const children = Array.from(element.children);
      if (children.length < this.options.minPatternItems) return false;
      
      // Pattern 1: Uniform child elements (common in galleries)
      const childTagCounts = {};
      children.forEach(child => {
        const tag = child.tagName;
        childTagCounts[tag] = (childTagCounts[tag] || 0) + 1;
      });
      
      const dominantTag = Object.keys(childTagCounts)
        .reduce((a, b) => childTagCounts[a] > childTagCounts[b] ? a : b);
      
      const dominantCount = childTagCounts[dominantTag];
      const uniformityRatio = dominantCount / children.length;
      
      if (uniformityRatio >= 0.7 && dominantCount >= this.options.minPatternItems) {
        // Check if these uniform elements contain images
        const dominantElements = children.filter(child => child.tagName === dominantTag);
        const elementsWithImages = dominantElements.filter(el => 
          el.querySelector('img, [data-src], [data-lazy]')
        );
        
        if (elementsWithImages.length >= this.options.minPatternItems) {
          return true;
        }
      }
      
      // Pattern 2: Grid-like layout
      if (this.hasGridLikeStructure(children.map(child => {
        const rect = child.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      }))) {
        return true;
      }
      
      return false;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Enhanced image children validation
   * ENHANCED: More comprehensive image detection
   */
  hasImageChildrenEnhanced(element) {
    try {
      // Direct image elements
      const directImages = element.querySelectorAll('img').length;
      
      // Lazy-loaded images
      const lazyImages = element.querySelectorAll('[data-src], [data-lazy], [loading="lazy"]').length;
      
      // Background images via CSS
      const elementsWithBackgrounds = Array.from(element.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.backgroundImage && style.backgroundImage !== 'none';
      }).length;
      
      // SVG images
      const svgImages = element.querySelectorAll('svg').length;
      
      // Picture elements
      const pictureElements = element.querySelectorAll('picture').length;
      
      const totalImages = directImages + lazyImages + Math.min(elementsWithBackgrounds, 10) + svgImages + pictureElements;
      
      return totalImages >= this.options.minPatternItems;
      
    } catch (error) {
      return element.querySelectorAll('img').length >= this.options.minPatternItems;
    }
  }

  /**
   * Check if data attribute is gallery-related
   * ENHANCED: Specialized data attribute detection
   */
  isGalleryDataAttribute(name, value) {
    // Common gallery framework data attributes
    const galleryDataPatterns = [
      'data-fancybox', 'data-lightbox', 'data-gallery', 'data-photoswipe',
      'data-magnific', 'data-slick', 'data-swiper', 'data-owl',
      'data-carousel', 'data-slider', 'data-grid', 'data-masonry'
    ];
    
    if (galleryDataPatterns.includes(name)) return true;
    
    // Check for image URLs in values
    if (value && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value)) return true;
    
    // Check for gallery-like JSON data
    if (value && value.startsWith('{') && /image|photo|gallery|carousel/i.test(value)) return true;
    
    return false;
  }

  /**
   * Calculate detection score for ranking containers
   * ENHANCED: Comprehensive scoring system
   */
  calculateDetectionScore(reasons, element) {
    let score = 0;
    
    // Base scores for different detection reasons
    const reasonScores = {
      'class': 3,
      'id': 4,
      'data-name': 2,
      'data-value': 2,
      'data-special': 5,
      'structural': 3
    };
    
    reasons.forEach(reason => {
      const baseReason = reason.split(':')[0];
      score += reasonScores[baseReason] || 1;
    });
    
    // Bonus for image count
    const imageCount = element.querySelectorAll('img, [data-src], [data-lazy]').length;
    score += Math.min(imageCount * 0.5, 5);
    
    // Bonus for size appropriateness
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > 10000 && area < 2000000) {
      score += 2;
    }
    
    // Bonus for semantic markup
    if (['section', 'main', 'article', 'aside'].includes(element.tagName.toLowerCase())) {
      score += 1;
    }
    
    return score;
  }

  /**
   * Detect layout-based galleries using geometric analysis
   */
  async detectLayoutBasedGalleries(containers) {
    const potentialContainers = document.querySelectorAll('div, section, article, ul, ol');
    
    for (const container of potentialContainers) {
      const layoutAnalysis = this.analyzeLayout(container);
      
      if (layoutAnalysis.isGalleryLike) {
        containers.add(container);
      }
    }
  }

  /**
   * Detect containers with high image density
   */
  async detectImageDensityContainers(containers) {
    const allContainers = document.querySelectorAll('div, section, article, main');
    
    for (const container of allContainers) {
      const imageCount = container.querySelectorAll('img').length;
      const totalChildren = container.children.length;
      
      if (imageCount >= this.options.minPatternItems && 
          totalChildren > 0 && 
          (imageCount / totalChildren) > 0.5) {
        containers.add(container);
      }
    }
  }

  /**
   * Detect dynamic content containers (lazy loading, infinite scroll)
   * NEW: Enhanced dynamic content detection
   * CR-019: Using sanitized selectors for security
   */
  async detectDynamicContentContainers(containers, config) {
    try {
      // Look for lazy loading indicators
      const lazyLoadingSelectors = [
        '[data-src]', '[data-lazy]', '[loading="lazy"]',
        '[data-original]', '[data-echo]', '[data-unveil]',
        '.lazy', '.lazyload', '.lazy-loading',
        '[data-srcset]', '[data-background]'
      ];
      
      for (const selector of lazyLoadingSelectors) {
        const elements = this.safeQuerySelectorAll(document, selector);
        elements.forEach(element => {
          const container = this.findGalleryContainer(element);
          if (container && this.hasImageChildren(container)) {
            containers.add(container);
          }
        });
      }
      
      // Look for infinite scroll containers
      await this.detectInfiniteScrollContainers(containers);
      
      // Look for virtual scroll / windowing containers
      await this.detectVirtualScrollContainers(containers);
      
      // Look for AJAX-loaded content patterns
      await this.detectAjaxContentContainers(containers);
      
    } catch (error) {
      console.warn('⚠️ Dynamic content detection failed:', error);
    }
  }

  /**
   * Detect framework-specific gallery patterns
   * NEW: Framework-aware pattern detection
   */
  async detectFrameworkGalleries(containers, config) {
    try {
      // React/Next.js patterns
      await this.detectReactGalleries(containers);
      
      // Vue.js patterns
      await this.detectVueGalleries(containers);
      
      // Angular patterns
      await this.detectAngularGalleries(containers);
      
      // Popular gallery libraries
      await this.detectLibraryGalleries(containers);
      
    } catch (error) {
      console.warn('⚠️ Framework gallery detection failed:', error);
    }
  }

  /**
   * Find the most likely gallery container for an element
   */
  findGalleryContainer(element) {
    let current = element.parentElement;
    let depth = 0;
    const maxDepth = 5;
    
    while (current && depth < maxDepth) {
      // Check if this container has gallery characteristics
      if (this.isLikelyGalleryContainer(current)) {
        return current;
      }
      
      current = current.parentElement;
      depth++;
    }
    
    return null;
  }

  /**
   * Check if element is likely a gallery container
   */
  isLikelyGalleryContainer(element) {
    const className = element.className || '';
    const id = element.id || '';
    
    // Check for gallery-related classes or IDs
    if (this.matchesGalleryPattern(className, this.galleryPatterns.classPatterns) ||
        this.matchesGalleryPattern(id, this.galleryPatterns.idPatterns)) {
      return true;
    }
    
    // Check for multiple image children
    const imageCount = element.querySelectorAll('img, [data-src], [data-lazy]').length;
    return imageCount >= this.options.minPatternItems;
  }

  /**
   * Detect infinite scroll containers
   * CR-019: Using sanitized selectors for security
   */
  async detectInfiniteScrollContainers(containers) {
    const infiniteScrollSelectors = [
      '[data-infinite]', '[data-scroll]', '[data-load-more]',
      '.infinite-scroll', '.endless-scroll', '.auto-load',
      '[data-pagination="infinite"]', '[data-auto-load]'
    ];
    
    for (const selector of infiniteScrollSelectors) {
      const elements = this.safeQuerySelectorAll(document, selector);
      elements.forEach(element => {
        if (this.hasImageChildren(element)) {
          containers.add(element);
        }
      });
    }
    
    // Look for scroll-triggered loading patterns
    const scrollContainers = document.querySelectorAll('[style*="overflow"], .scroll');
    scrollContainers.forEach(container => {
      if (this.detectScrollLoadingPattern(container)) {
        containers.add(container);
      }
    });
  }

  /**
   * Detect virtual scroll containers
   */
  async detectVirtualScrollContainers(containers) {
    const virtualScrollSelectors = [
      '[data-virtualized]', '[data-virtual]', '[data-windowing]',
      '.virtual-scroll', '.windowed-list', '.virtualized',
      '[data-react-window]', '[data-vue-virtual]'
    ];
    
    for (const selector of virtualScrollSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Virtual scroll containers often have specific height and overflow
        const style = window.getComputedStyle(element);
        if (style.height !== 'auto' && style.overflow !== 'visible') {
          containers.add(element);
        }
      });
    }
  }

  /**
   * Detect AJAX-loaded content containers
   */
  async detectAjaxContentContainers(containers) {
    const ajaxSelectors = [
      '[data-ajax]', '[data-remote]', '[data-dynamic]',
      '.ajax-content', '.dynamic-content', '.remote-content',
      '[data-url]', '[data-endpoint]'
    ];
    
    for (const selector of ajaxSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (this.hasImageChildren(element)) {
          containers.add(element);
        }
      });
    }
  }

  /**
   * Detect React/Next.js gallery patterns
   */
  async detectReactGalleries(containers) {
    const reactSelectors = [
      '[data-reactroot] [class*="gallery"]',
      '[data-reactroot] [class*="image"]',
      '[data-reactroot] [class*="photo"]',
      '[class*="Gallery"]', '[class*="ImageGrid"]',
      '[class*="PhotoGrid"]', '[class*="Carousel"]'
    ];
    
    for (const selector of reactSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (this.hasImageChildren(element)) {
          containers.add(element);
        }
      });
    }
  }

  /**
   * Detect Vue.js gallery patterns
   */
  async detectVueGalleries(containers) {
    const vueSelectors = [
      '[data-v-] [class*="gallery"]',
      '[data-v-] [class*="image"]',
      '[v-for*="image"]', '[v-for*="photo"]',
      '.v-gallery', '.v-carousel', '.v-image-grid'
    ];
    
    for (const selector of vueSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (this.hasImageChildren(element)) {
            containers.add(element);
          }
        });
      } catch (error) {
        // Skip invalid selectors
      }
    }
  }

  /**
   * Detect Angular gallery patterns
   */
  async detectAngularGalleries(containers) {
    const angularSelectors = [
      '[ng-controller*="gallery"]', '[ng-controller*="image"]',
      '[ng-repeat*="image"]', '[ng-repeat*="photo"]',
      '.ng-gallery', '.ng-carousel', '.ng-image-grid',
      '[data-ng-] [class*="gallery"]'
    ];
    
    for (const selector of angularSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (this.hasImageChildren(element)) {
            containers.add(element);
          }
        });
      } catch (error) {
        // Skip invalid selectors
      }
    }
  }

  /**
   * Detect popular gallery library patterns
   */
  async detectLibraryGalleries(containers) {
    const libraryPatterns = {
      // Swiper.js
      swiper: ['.swiper-container', '.swiper-wrapper', '.swiper-slide'],
      // Slick
      slick: ['.slick-slider', '.slick-track', '.slick-slide'],
      // Owl Carousel
      owl: ['.owl-carousel', '.owl-stage', '.owl-item'],
      // Lightbox libraries
      lightbox: ['.lightbox', '.fancybox', '.photoswipe', '.magnific-popup'],
      // Masonry
      masonry: ['.masonry', '.isotope', '.packery'],
      // PhotoGrid
      photogrid: ['.photo-grid', '.image-grid', '.gallery-grid']
    };
    
    for (const [library, selectors] of Object.entries(libraryPatterns)) {
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (this.hasImageChildren(element)) {
            containers.add(element);
          }
        });
      }
    }
  }

  /**
   * Detect scroll-triggered loading patterns
   */
  detectScrollLoadingPattern(container) {
    // Look for loading indicators or triggers
    const loadingIndicators = container.querySelectorAll(
      '.loading, .spinner, .load-more, [data-loading]'
    );
    
    // Check if container has scroll behavior
    const style = window.getComputedStyle(container);
    const hasScroll = style.overflowY === 'scroll' || style.overflowY === 'auto';
    
    return loadingIndicators.length > 0 && hasScroll && this.hasImageChildren(container);
  }

  /**
   * Analyze image patterns within gallery containers
   */
  async analyzeImagePatterns(containers, config) {
    const patterns = [];
    
    for (const container of containers) {
      try {
        const containerPatterns = await this.analyzeContainerPatterns(container, config);
        patterns.push(...containerPatterns);
      } catch (error) {
        console.warn('⚠️ Container pattern analysis failed:', error);
      }
    }
    
    return patterns;
  }

  /**
   * Analyze patterns within a specific container
   */
  async analyzeContainerPatterns(container, config) {
    const patterns = [];
    
    // Find all images in container
    const images = Array.from(container.querySelectorAll('img'));
    
    if (images.length < config.minPatternItems) {
      return patterns;
    }
    
    // Analyze different pattern types
    const gridPattern = this.detectGridPattern(images, container);
    if (gridPattern) patterns.push(gridPattern);
    
    const listPattern = this.detectListPattern(images, container);
    if (listPattern) patterns.push(listPattern);
    
    const carouselPattern = this.detectCarouselPattern(images, container);
    if (carouselPattern) patterns.push(carouselPattern);
    
    const masonryPattern = this.detectMasonryPattern(images, container);
    if (masonryPattern) patterns.push(masonryPattern);
    
    return patterns;
  }

  /**
   * Detect grid layout patterns
   */
  detectGridPattern(images, container) {
    if (images.length < this.layoutPatterns.grid.minItems) return null;
    
    // Analyze positioning and alignment
    const positions = images.map(img => {
      const rect = img.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        element: img
      };
    });
    
    // Check for grid-like arrangement
    const rows = this.groupByRows(positions, this.layoutPatterns.grid.alignmentTolerance);
    const columns = this.groupByColumns(positions, this.layoutPatterns.grid.alignmentTolerance);
    
    if (rows.length >= 2 && columns.length >= 2) {
      return {
        type: 'grid',
        container: container,
        images: images,
        layout: { rows: rows.length, columns: columns.length },
        confidence: this.calculateGridConfidence(rows, columns),
        metadata: {
          positions: positions,
          rowGroups: rows,
          columnGroups: columns
        }
      };
    }
    
    return null;
  }

  /**
   * Detect list layout patterns
   */
  detectListPattern(images, container) {
    if (images.length < this.layoutPatterns.list.minItems) return null;
    
    const positions = images.map(img => {
      const rect = img.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });
    
    // Check for vertical or horizontal alignment
    const isVertical = this.isVerticallyAligned(positions);
    const isHorizontal = this.isHorizontallyAligned(positions);
    
    if (isVertical || isHorizontal) {
      return {
        type: 'list',
        container: container,
        images: images,
        layout: { orientation: isVertical ? 'vertical' : 'horizontal' },
        confidence: isVertical ? 0.8 : 0.7,
        metadata: { positions }
      };
    }
    
    return null;
  }

  /**
   * Detect carousel/slider patterns
   */
  detectCarouselPattern(images, container) {
    // Check for carousel indicators
    const hasCarouselClasses = /carousel|slider|swiper|slick/i.test(container.className);
    const hasNavigation = container.querySelector('.prev, .next, .arrow, [class*="nav"]') !== null;
    const hasIndicators = container.querySelector('.dot, .indicator, [class*="dot"]') !== null;
    
    if (hasCarouselClasses || hasNavigation || hasIndicators) {
      return {
        type: 'carousel',
        container: container,
        images: images,
        layout: { 
          hasNavigation, 
          hasIndicators,
          visibleImages: this.countVisibleImages(images)
        },
        confidence: 0.9,
        metadata: {
          carouselClasses: hasCarouselClasses,
          navigationElements: hasNavigation,
          indicatorElements: hasIndicators
        }
      };
    }
    
    return null;
  }

  /**
   * Detect masonry layout patterns
   */
  detectMasonryPattern(images, container) {
    if (images.length < this.layoutPatterns.masonry.minItems) return null;
    
    const positions = images.map(img => {
      const rect = img.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });
    
    // Check for variable heights with column alignment
    const hasVariableHeights = this.hasVariableHeights(positions);
    const hasColumnAlignment = this.hasColumnAlignment(positions);
    
    if (hasVariableHeights && hasColumnAlignment) {
      return {
        type: 'masonry',
        container: container,
        images: images,
        layout: { columns: this.estimateColumnCount(positions) },
        confidence: 0.75,
        metadata: { positions }
      };
    }
    
    return null;
  }

  /**
   * Generate enhanced selectors for detected patterns
   */
  async generateEnhancedSelectors(patterns, config) {
    const enhancedPatterns = [];
    
    for (const pattern of patterns) {
      try {
        let selector = null;
        
        if (this.cssSelector) {
          // Use Enhanced CSS Selector for robust selector generation
          selector = await this.cssSelector.generateSelector(pattern.container, {
            enableImageOptimization: true,
            enableGalleryPattern: true,
            timeoutMs: 2000
          });
        } else {
          // Fallback to basic selector generation
          selector = this.generateBasicSelector(pattern.container);
        }
        
        // Generate item selectors for images within the pattern
        const itemSelectors = await this.generateItemSelectors(pattern.images, pattern.container);
        
        enhancedPatterns.push({
          ...pattern,
          selector: selector,
          itemSelectors: itemSelectors,
          selectorMetadata: {
            generated: new Date().toISOString(),
            method: this.cssSelector ? 'enhanced' : 'basic',
            complexity: this.calculateSelectorComplexity(selector)
          }
        });
        
      } catch (error) {
        console.warn('⚠️ Selector generation failed for pattern:', error);
        // Include pattern without selector
        enhancedPatterns.push({
          ...pattern,
          selector: null,
          itemSelectors: [],
          selectorMetadata: { error: error.message }
        });
      }
    }
    
    return enhancedPatterns;
  }

  /**
   * Generate selectors for individual items within a pattern
   */
  async generateItemSelectors(images, container) {
    const itemSelectors = [];
    
    // Try to find a common pattern for items
    if (images.length > 0) {
      const firstImage = images[0];
      const parentElement = firstImage.parentElement;
      
      // Check if images share a common parent structure
      const commonParents = images.filter(img => 
        img.parentElement && 
        img.parentElement.tagName === parentElement.tagName &&
        img.parentElement.className === parentElement.className
      );
      
      if (commonParents.length === images.length) {
        // Generate selector for the common parent
        try {
          let itemSelector = null;
          
          if (this.cssSelector) {
            itemSelector = await this.cssSelector.generateSelector(parentElement, {
              root: container,
              enableImageOptimization: true
            });
          } else {
            itemSelector = this.generateBasicSelector(parentElement);
          }
          
          itemSelectors.push({
            type: 'item-container',
            selector: itemSelector,
            count: images.length,
            confidence: 0.9
          });
          
        } catch (error) {
          console.debug('Item selector generation failed:', error);
        }
      }
      
      // Also generate direct image selectors as fallback
      try {
        const imageSelector = `${container.tagName.toLowerCase()} img`;
        itemSelectors.push({
          type: 'direct-image',
          selector: imageSelector,
          count: images.length,
          confidence: 0.7
        });
      } catch (error) {
        console.debug('Direct image selector generation failed:', error);
      }
    }
    
    return itemSelectors;
  }

  /**
   * Score and rank patterns by confidence
   */
  scoreAndRankPatterns(patterns, config) {
    const scoredPatterns = patterns.map(pattern => {
      const confidence = this.calculateConfidenceScore(pattern, config);
      return { ...pattern, confidence };
    });
    
    // Sort by confidence (highest first)
    scoredPatterns.sort((a, b) => b.confidence - a.confidence);
    
    // Update metrics
    this.metrics.confidenceScores.push(...scoredPatterns.map(p => p.confidence));
    
    return scoredPatterns;
  }

  /**
   * Calculate confidence score for a pattern
   */
  calculateConfidenceScore(pattern, context = {}) {
    let confidence = pattern.confidence || 0;
    
    // Bonus for selector quality
    if (pattern.selector && !pattern.selectorMetadata?.error) {
      confidence += 0.1;
      
      if (pattern.selectorMetadata?.complexity < 10) {
        confidence += 0.05; // Simple selectors are better
      }
    }
    
    // Bonus for item selectors
    if (pattern.itemSelectors && pattern.itemSelectors.length > 0) {
      confidence += 0.05;
    }
    
    // Bonus for image count
    if (pattern.images && pattern.images.length >= this.options.minPatternItems) {
      confidence += Math.min(0.1, pattern.images.length * 0.01);
    }
    
    // Bonus for gallery-specific classes/attributes
    if (this.hasGalleryIndicators(pattern.container)) {
      confidence += 0.15;
    }
    
    // Penalty for errors
    if (pattern.selectorMetadata?.error) {
      confidence -= 0.2;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Enhanced image categorization with pattern context
   */
  categorizeImageEnhanced(imageObj, context = {}) {
    const startTime = performance.now();
    
    try {
      // Calculate confidence score
      const confidenceData = this.calculateConfidenceScore(imageObj, context);
      
      // Determine category based on confidence and patterns
      let category = 'external';
      let categoryReason = 'Default categorization';
      
      if (confidenceData >= this.options.highConfidenceThreshold) {
        category = 'high_confidence';
        categoryReason = 'High confidence score from pattern analysis';
      } else if (this.isSameOrigin(imageObj.src)) {
        category = 'same_origin';
        categoryReason = 'Same domain origin';
      } else if (confidenceData >= this.options.minConfidenceScore) {
        category = 'same_origin'; // Promote based on pattern confidence
        categoryReason = 'Promoted due to pattern confidence';
      }
      
      return {
        ...imageObj,
        category: category,
        categoryReason: categoryReason,
        confidenceTier: this.getConfidenceTier(confidenceData),
        patternAnalysis: {
          confidence: confidenceData,
          processingTime: performance.now() - startTime,
          method: context.method || 'smart-pattern'
        }
      };
      
    } catch (error) {
      console.warn('Enhanced categorization failed:', error);
      return {
        ...imageObj,
        category: 'external',
        categoryReason: 'Fallback due to error',
        confidenceTier: 'low',
        patternAnalysis: {
          confidence: 0,
          processingTime: performance.now() - startTime,
          error: error.message
        }
      };
    }
  }

  /**
   * Helper methods for pattern analysis
   */
  
  matchesGalleryPattern(text, patterns) {
    if (!text) return false;
    return patterns.some(pattern => pattern.test(text));
  }
  
  hasImageChildren(element) {
    return element.querySelectorAll('img').length >= this.options.minPatternItems;
  }
  
  /**
   * Enhanced gallery container validation
   * NEW: More comprehensive validation with multiple criteria
   */
  validateGalleryContainer(container, config) {
    try {
      // Basic requirements
      const imageCount = container.querySelectorAll('img, [data-src], [data-lazy]').length;
      const area = container.offsetWidth * container.offsetHeight;
      
      if (imageCount < config.minPatternItems || area <= 0) {
        return false;
      }
      
      // Enhanced validation criteria
      const validationScore = this.calculateValidationScore(container, imageCount, config);
      const isValid = validationScore >= 0.3; // Minimum validation threshold
      
      if (config.enableAdvancedPatterns) {
        // Additional checks for dynamic content
        return isValid && this.validateDynamicContent(container);
      }
      
      return isValid;
      
    } catch (error) {
      console.debug('Container validation failed:', error);
      return false;
    }
  }

  /**
   * Calculate comprehensive validation score for containers
   */
  calculateValidationScore(container, imageCount, config) {
    let score = 0;
    
    // Image count factor (0-0.3)
    const imageFactor = Math.min(imageCount / (config.minPatternItems * 2), 1);
    score += imageFactor * 0.3;
    
    // Gallery class/ID indicators (0-0.25)
    if (this.hasGalleryIndicators(container)) {
      score += 0.25;
    }
    
    // Layout structure score (0-0.2)
    const layoutScore = this.calculateLayoutScore(container);
    score += layoutScore * 0.2;
    
    // Size and visibility (0-0.15)
    const visibilityScore = this.calculateVisibilityScore(container);
    score += visibilityScore * 0.15;
    
    // Framework patterns bonus (0-0.1)
    if (this.detectFrameworkPattern(container)) {
      score += 0.1;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Calculate layout structure score
   */
  calculateLayoutScore(container) {
    const children = Array.from(container.children);
    if (children.length === 0) return 0;
    
    let score = 0;
    
    // Check for consistent element structure
    const tagCounts = {};
    children.forEach(child => {
      const tag = child.tagName;
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    
    // Bonus for consistent tag usage (suggests structured layout)
    const maxTagCount = Math.max(...Object.values(tagCounts));
    const consistencyRatio = maxTagCount / children.length;
    score += consistencyRatio * 0.5;
    
    // Check for grid-like positioning
    const positions = children.map(child => {
      const rect = child.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });
    
    if (this.hasGridLikeStructure(positions)) {
      score += 0.5;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Calculate visibility and size score
   */
  calculateVisibilityScore(container) {
    const rect = container.getBoundingClientRect();
    const style = window.getComputedStyle(container);
    
    let score = 0;
    
    // Size appropriateness (not too small or ridiculously large)
    const area = rect.width * rect.height;
    if (area > 10000 && area < 2000000) { // 100x100 to 1414x1414 reasonable range
      score += 0.4;
    }
    
    // Visibility checks
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      score += 0.3;
    }
    
    // Position on page (not too far off-screen)
    if (rect.top > -1000 && rect.top < window.innerHeight + 1000) {
      score += 0.3;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Detect framework-specific patterns
   */
  detectFrameworkPattern(container) {
    const className = container.className || '';
    const attributes = Array.from(container.attributes).map(attr => attr.name);
    
    // React patterns
    if (className.includes('React') || attributes.some(attr => attr.startsWith('data-react'))) {
      return true;
    }
    
    // Vue patterns
    if (attributes.some(attr => attr.startsWith('data-v-') || attr.startsWith('v-'))) {
      return true;
    }
    
    // Angular patterns
    if (attributes.some(attr => attr.startsWith('ng-') || attr.startsWith('data-ng-'))) {
      return true;
    }
    
    // Popular library patterns
    const libraryClasses = ['swiper', 'slick', 'owl', 'masonry', 'isotope', 'lightbox', 'fancybox'];
    return libraryClasses.some(lib => className.toLowerCase().includes(lib));
  }

  /**
   * Validate dynamic content characteristics
   */
  validateDynamicContent(container) {
    // Check for lazy loading attributes
    const lazyElements = container.querySelectorAll('[data-src], [data-lazy], [loading="lazy"]');
    if (lazyElements.length > 0) {
      return true;
    }
    
    // Check for dynamic loading indicators
    const dynamicIndicators = container.querySelectorAll(
      '.loading, .spinner, .load-more, [data-loading], [data-infinite]'
    );
    if (dynamicIndicators.length > 0) {
      return true;
    }
    
    // Check for AJAX/dynamic attributes
    const dynamicAttrs = ['data-ajax', 'data-remote', 'data-dynamic', 'data-url'];
    return dynamicAttrs.some(attr => container.hasAttribute(attr));
  }

  /**
   * Check for grid-like structure in positioned elements
   */
  hasGridLikeStructure(positions) {
    if (positions.length < 4) return false;
    
    // Group by rows and columns with tolerance
    const tolerance = 20;
    const rows = this.groupByRows(positions, tolerance);
    const columns = this.groupByColumns(positions, tolerance);
    
    // Must have at least 2 rows and 2 columns for grid structure
    return rows.length >= 2 && columns.length >= 2;
  }
  
  analyzeLayout(container) {
    const children = Array.from(container.children);
    const imageChildren = children.filter(child => 
      child.tagName === 'IMG' || child.querySelector('img')
    );
    
    return {
      isGalleryLike: imageChildren.length >= this.options.minPatternItems,
      imageRatio: children.length > 0 ? imageChildren.length / children.length : 0,
      totalImages: imageChildren.length
    };
  }
  
  groupByRows(positions, tolerance) {
    const rows = [];
    const sorted = [...positions].sort((a, b) => a.y - b.y);
    
    let currentRow = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].y - currentRow[0].y) <= tolerance) {
        currentRow.push(sorted[i]);
      } else {
        rows.push(currentRow);
        currentRow = [sorted[i]];
      }
    }
    rows.push(currentRow);
    
    return rows;
  }
  
  groupByColumns(positions, tolerance) {
    const columns = [];
    const sorted = [...positions].sort((a, b) => a.x - b.x);
    
    let currentColumn = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].x - currentColumn[0].x) <= tolerance) {
        currentColumn.push(sorted[i]);
      } else {
        columns.push(currentColumn);
        currentColumn = [sorted[i]];
      }
    }
    columns.push(currentColumn);
    
    return columns;
  }
  
  calculateGridConfidence(rows, columns) {
    // Higher confidence for more regular grids
    const avgRowSize = rows.reduce((sum, row) => sum + row.length, 0) / rows.length;
    const avgColSize = columns.reduce((sum, col) => sum + col.length, 0) / columns.length;
    
    const rowVariance = rows.reduce((sum, row) => sum + Math.pow(row.length - avgRowSize, 2), 0) / rows.length;
    const colVariance = columns.reduce((sum, col) => sum + Math.pow(col.length - avgColSize, 2), 0) / columns.length;
    
    return Math.max(0, 0.9 - (rowVariance + colVariance) * 0.1);
  }
  
  isVerticallyAligned(positions) {
    if (positions.length < 2) return false;
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
    return positions.every(pos => Math.abs(pos.x - avgX) < 20);
  }
  
  isHorizontallyAligned(positions) {
    if (positions.length < 2) return false;
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
    return positions.every(pos => Math.abs(pos.y - avgY) < 20);
  }
  
  countVisibleImages(images) {
    return images.filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length;
  }
  
  hasVariableHeights(positions) {
    if (positions.length < 2) return false;
    const heights = positions.map(pos => pos.height);
    const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    const variance = heights.reduce((sum, h) => sum + Math.pow(h - avgHeight, 2), 0) / heights.length;
    return variance > 100; // Significant height variation
  }
  
  hasColumnAlignment(positions) {
    const columns = this.groupByColumns(positions, 20);
    return columns.length >= 2 && columns.every(col => col.length >= 2);
  }
  
  estimateColumnCount(positions) {
    const columns = this.groupByColumns(positions, 20);
    return columns.length;
  }
  
  generateBasicSelector(element) {
    // Fallback selector generation
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes[0]}`;
      }
    }
    
    return element.tagName.toLowerCase();
  }
  
  calculateSelectorComplexity(selector) {
    if (!selector) return 100;
    
    let complexity = selector.length;
    complexity += (selector.match(/>/g) || []).length * 5;
    complexity += (selector.match(/\+/g) || []).length * 3;
    complexity += (selector.match(/:/g) || []).length * 2;
    
    return complexity;
  }
  
  hasGalleryIndicators(container) {
    const className = container.className || '';
    const id = container.id || '';
    
    return this.matchesGalleryPattern(className, this.galleryPatterns.classPatterns) ||
           this.matchesGalleryPattern(id, this.galleryPatterns.idPatterns);
  }
  
  isSameOrigin(url) {
    try {
      const imageUrl = new URL(url, window.location.href);
      return imageUrl.hostname === window.location.hostname;
    } catch (error) {
      return false;
    }
  }
  
  getConfidenceTier(confidence) {
    if (confidence >= this.options.highConfidenceThreshold) return 'high';
    if (confidence >= this.options.minConfidenceScore) return 'medium';
    return 'low';
  }
  
  generatePageCacheKey() {
    return `${window.location.hostname}-${window.location.pathname}-${document.title}`;
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    const avgConfidence = this.metrics.confidenceScores.length > 0 
      ? this.metrics.confidenceScores.reduce((sum, score) => sum + score, 0) / this.metrics.confidenceScores.length 
      : 0;
    
    return {
      ...this.metrics,
      averageConfidence: avgConfidence,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0 
        ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) 
        : 0,
      patternsPerGallery: this.metrics.galleriesFound > 0 
        ? this.metrics.patternsDetected / this.metrics.galleriesFound 
        : 0
    };
  }
  
  /**
   * Reset caches and metrics
   */
  reset() {
    this.patternCache.clear();
    this.galleryCache.clear();
    this.selectorCache.clear();
    
    this.metrics = {
      patternsDetected: 0,
      galleriesFound: 0,
      confidenceScores: [],
      processingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

// Export the class to window for use in STEPTHREE extension
window.SmartPatternRecognition = SmartPatternRecognition;
console.log('✅ Smart Pattern Recognition System loaded successfully');

} else if (typeof window !== "undefined") {
  console.log('ℹ️ Smart Pattern Recognition System already loaded, skipping duplicate definition');
}