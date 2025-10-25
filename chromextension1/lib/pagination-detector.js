/**
 * PaginationDetector - Intelligent pagination detection for auto-pagination
 * Detects various types of pagination: next buttons, numbered pages, infinite scroll
 * Phase 1 Enhanced: Query string, path-based, and multi-strategy detection
 * Phase 3 Enhanced: Shadow DOM support, pattern learning, state management
 * 
 * @version 3.0.0
 */

class PaginationDetector {
  constructor(options = {}) {
    // Phase 3: State management and pattern learning
    this.enablePatternLearning = options.enablePatternLearning !== false; // Default true
    this.enableStateManagement = options.enableStateManagement !== false; // Default true
    this.storageKey = options.storageKey || 'paginationDetector_state';
    
    // Learned patterns storage
    this.learnedPatterns = {
      urlPatterns: new Map(), // hostname -> pattern
      selectorPatterns: new Map(), // hostname -> selector
      lastUsed: new Map() // hostname -> timestamp
    };
    
    // State management
    this.state = {
      currentPage: 1,
      totalPages: null,
      visitedUrls: new Set(),
      lastSuccessfulStrategy: null,
      failedStrategies: new Set(),
      paginationHistory: []
    };
    this.nextPagePatterns = {
      // Text patterns for "next" buttons/links (multi-language)
      textPatterns: [
        /next\s*(page)?/i,
        /siguiente/i,  // Spanish
        /suivant/i,    // French
        /weiter/i,     // German
        /次へ|次のページ/i,  // Japanese
        /다음/i,       // Korean
        /下一页|下一頁/i,  // Chinese
        /próxima/i,    // Portuguese
        /volgende/i,   // Dutch
        /nästa/i,      // Swedish
        /følgende/i,   // Norwegian/Danish
        /→|›|»|⟩|⇨|➔|➜|➡/,  // Arrow symbols
      ],
      
      // Class/ID patterns
      classIdPatterns: [
        /next/i,
        /pagination.*next/i,
        /nav.*next/i,
        /forward/i,
        /arrow.*right/i,
        /chevron.*right/i,
      ],
      
      // Rel attribute patterns
      relPatterns: ['next', 'nofollow next'],
      
      // ARIA label patterns
      ariaPatterns: [
        /next/i,
        /go to next/i,
        /navigate to next/i,
      ],
    };
    
    this.paginationSelectors = [
      // Common pagination container selectors
      '.pagination',
      '.pager',
      '.page-navigation',
      '.nav-links',
      '[role="navigation"]',
      'nav',
      '.paginator',
      '.page-numbers',
      '.wp-pagenavi', // WordPress
      '.pagination-wrapper',
      '.index-navigator', // From research
      '.PageNavi', // From research
      '.s-pagination-strip', // From research
    ];
    
    this.infiniteScrollPatterns = [
      'load more',
      'show more',
      'see more',
      'view more',
      'cargar más',  // Spanish
      'charger plus', // French
      'mehr laden',   // German
      'もっと見る',    // Japanese
      '더 보기',      // Korean
      '加载更多',     // Chinese
    ];
    
    // Query string parameter patterns (Phase 1 Enhancement)
    this.queryStringPatterns = [
      'page',
      'p',
      'pg',
      'pagenum',
      'paged',
      'pageNumber',
      'page_number',
      'offset',
      'start',
    ];
    
    // Path-based pagination patterns (Phase 1 Enhancement)
    this.pathPaginationPatterns = [
      /\/page\/(\d+)\/?$/i,      // /page/2/
      /\/p\/(\d+)\/?$/i,         // /p/2/
      /\/(\d+)\/?$/i,            // /2/
      /\/pg(\d+)\/?$/i,          // /pg2/
      /\/page-(\d+)\/?$/i,       // /page-2/
    ];
  }

  /**
   * Find the next page link/button
   * Enhanced with Phase 1 multi-strategy detection
   * @returns {Object|null} { element, url, type } or null
   */
  findNextPage() {
    // Use the new multi-strategy approach - returns best result
    const bestResult = this.detectBest();
    if (bestResult) {
      return bestResult;
    }
    
    // Fallback to original sequential approach if needed
    const methods = [
      () => this.findByRelAttribute(),
      () => this.detectQueryString(),
      () => this.detectPathBased(),
      () => this.findByTextContent(),
      () => this.findByClassId(),
      () => this.findByAriaLabel(),
      () => this.findNumberedPagination(),
      () => this.findInfiniteScrollButton(),
    ];

    for (const method of methods) {
      const result = method();
      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * Find next page by rel="next" attribute (most reliable)
   */
  findByRelAttribute() {
    for (const relValue of this.nextPagePatterns.relPatterns) {
      const link = document.querySelector(`a[rel="${relValue}"], link[rel="${relValue}"]`);
      if (link && this.isValidNextPageElement(link)) {
        // Guard against bad rel=next targets like /null
        const href = link.href;
        if (this._isBadUrl(href)) {
          continue;
        }
        return {
          element: link,
          url: link.href,
          type: 'rel-attribute',
          confidence: 1.0
        };
      }
    }
    return null;
  }

  /**
   * Find next page by text content
   */
  findByTextContent() {
    const links = Array.from(document.querySelectorAll('a[href], button[onclick], button[data-href]'));
    
    for (const link of links) {
      const text = this.getElementText(link);
      
      for (const pattern of this.nextPagePatterns.textPatterns) {
        if (pattern.test(text)) {
          const url = this.getElementUrl(link);
          if (this.isValidNextPageElement(link)) {
            return {
              element: link,
              url: url || null,
              type: 'text-content',
              confidence: 0.9,
              clickOnly: !url
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Find next page by class/id attributes
   */
  findByClassId() {
    for (const pattern of this.nextPagePatterns.classIdPatterns) {
      const elements = Array.from(document.querySelectorAll('a[href], button[onclick], button[data-href]'));
      
      for (const element of elements) {
        const classId = `${element.className} ${element.id}`;
        
        if (pattern.test(classId)) {
          const url = this.getElementUrl(element);
          if (this.isValidNextPageElement(element)) {
            return {
              element: element,
              url: url || null,
              type: 'class-id',
              confidence: 0.8,
              clickOnly: !url
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Find next page by ARIA label
   */
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
            return {
              element: element,
              url: url || null,
              type: 'aria-label',
              confidence: 0.85,
              clickOnly: !url
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Find numbered pagination (e.g., "1 2 3 [4] 5" where 5 is next)
   */
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
        
        // Verify it's actually a number or valid next indicator
        if (/^\d+$/.test(nextText) || /next|›|→|»/i.test(nextText)) {
          return {
            element: nextLink,
            url: nextLink.href,
            type: 'numbered-pagination',
            confidence: 0.95
          };
        }
      }
    }
    return null;
  }

  /**
   * Find infinite scroll / "Load More" button
   */
  findInfiniteScrollButton() {
    const buttons = Array.from(document.querySelectorAll('button, a[href], [role="button"]'));
    
    for (const button of buttons) {
      const text = this.getElementText(button).toLowerCase();
      
      for (const pattern of this.infiniteScrollPatterns) {
        if (text.includes(pattern.toLowerCase())) {
          const url = this.getElementUrl(button);
          return {
            element: button,
            url: url || window.location.href, // Use current URL for AJAX loads
            type: 'infinite-scroll',
            confidence: 0.7,
            isLoadMore: true
          };
        }
      }
    }
    return null;
  }

  /**
   * Get text content of element (including children)
   */
  getElementText(element) {
    if (!element) return '';
    
    // Check direct text
    let text = element.textContent || element.innerText || '';
    
    // Check title/alt attributes
    text += ' ' + (element.getAttribute('title') || '');
    text += ' ' + (element.getAttribute('alt') || '');
    text += ' ' + (element.getAttribute('value') || '');
    
    return text.trim();
  }

  /**
   * Get URL from element
   */
  getElementUrl(element) {
    if (!element) return null;
    
    // Try href first
    if (element.href) {
      const href = element.href;
      if (this._isBadUrl(href)) return null;
      return href;
    }
    
    // Try data attributes
    const dataHref = element.getAttribute('data-href') ||
                    element.getAttribute('data-url') ||
                    element.getAttribute('data-link');
    if (dataHref) {
      if (this._isBadUrl(dataHref)) return null;
      return dataHref;
    }
    
    // Try onclick for javascript navigation
    const onclick = element.getAttribute('onclick');
    if (onclick) {
      const urlMatch = onclick.match(/(?:location\.href|window\.location)\s*=\s*['"]([^'"]+)['"]/);
      if (urlMatch) {
        const candidate = urlMatch[1];
        if (this._isBadUrl(candidate)) return null;
        return candidate;
      }
    }
    
    return null;
  }

  /**
   * Determine if a URL is not safe/valid to navigate to
   * Treat placeholders like #, javascript:, null, or /null as invalid next targets.
   * @private
   */
  _isBadUrl(url) {
    try {
      if (!url) return true;
      const trimmed = String(url).trim().toLowerCase();
      // obvious non-navigable placeholders
      if (trimmed === '#' || trimmed === 'javascript:' || trimmed === 'javascript:void(0)' || trimmed === 'javascript:;' || trimmed === 'null') {
        return true;
      }
      // Resolve relative paths to check pathname
      const resolved = new URL(url, window.location.href);
      const path = resolved.pathname.toLowerCase();
      // Some sites (e.g., imago-images) expose rel=next href="/null" when no next page exists
      if (path === '/null') return true;
      return false;
    } catch (_e) {
      return true;
    }
  }

  /**
   * PHASE 1: Query String Parameter Detection
   * Detects pagination using URL query parameters (e.g., ?page=2, ?p=3)
   * @returns {Object|null} Detection result with next page URL
   */
  detectQueryString() {
    try {
      const currentUrl = new URL(window.location.href);
      
      // First, check pagination containers for query string links
      for (const selector of this.paginationSelectors) {
        const container = document.querySelector(selector);
        if (!container) continue;
        
        const links = Array.from(container.querySelectorAll('a[href]'));
        for (const link of links) {
          try {
            const linkUrl = new URL(link.href, window.location.origin);
            
            // Check if link has any of our query string patterns
            for (const pattern of this.queryStringPatterns) {
              if (linkUrl.searchParams.has(pattern)) {
                const currentValue = currentUrl.searchParams.get(pattern);
                const linkValue = linkUrl.searchParams.get(pattern);
                
                // Check if this is a "next" link (higher page number)
                const currentPage = parseInt(currentValue) || 1;
                const linkPage = parseInt(linkValue);
                
                if (linkPage === currentPage + 1) {
                  return {
                    element: link,
                    url: link.href,
                    type: 'query-string',
                    confidence: 0.95,
                    paginationType: 'url-based',
                    queryParam: pattern,
                    currentPage: currentPage,
                    nextPage: linkPage
                  };
                }
              }
            }
          } catch (e) {
            // Invalid URL, skip
            continue;
          }
        }
      }
      
      // Fallback: Check if current URL has pagination parameter
      for (const pattern of this.queryStringPatterns) {
        if (currentUrl.searchParams.has(pattern)) {
          const currentPage = parseInt(currentUrl.searchParams.get(pattern)) || 1;
          const nextPage = currentPage + 1;
          
          // Build next URL
          const nextUrl = new URL(currentUrl.href);
          nextUrl.searchParams.set(pattern, nextPage.toString());
          
          return {
            element: null,
            url: nextUrl.href,
            type: 'query-string-incremental',
            confidence: 0.85,
            paginationType: 'url-based',
            queryParam: pattern,
            currentPage: currentPage,
            nextPage: nextPage
          };
        }
      }
      
      return null;
    } catch (e) {
      console.warn('Error in detectQueryString:', e);
      return null;
    }
  }

  /**
   * PHASE 1: Path-Based Pagination Detection
   * Detects pagination in URL path (e.g., /page/2/, /p/3/)
   * @returns {Object|null} Detection result with next page URL
   */
  detectPathBased() {
    try {
      const currentUrl = new URL(window.location.href);
      const currentPath = currentUrl.pathname;
      
      // Try each path pattern
      for (const pattern of this.pathPaginationPatterns) {
        const match = currentPath.match(pattern);
        if (match) {
          const currentPage = parseInt(match[1]) || 1;
          const nextPage = currentPage + 1;
          
          // Build next URL by replacing page number
          const nextPath = currentPath.replace(pattern, (full, pageNum) => {
            return full.replace(pageNum, nextPage.toString());
          });
          
          const nextUrl = new URL(currentUrl.href);
          nextUrl.pathname = nextPath;
          
          return {
            element: null,
            url: nextUrl.href,
            type: 'path-based',
            confidence: 0.90,
            paginationType: 'url-based',
            pathPattern: pattern.toString(),
            currentPage: currentPage,
            nextPage: nextPage
          };
        }
      }
      
      // Check pagination containers for path-based links
      for (const selector of this.paginationSelectors) {
        const container = document.querySelector(selector);
        if (!container) continue;
        
        const links = Array.from(container.querySelectorAll('a[href]'));
        for (const link of links) {
          try {
            const linkUrl = new URL(link.href, window.location.origin);
            const linkPath = linkUrl.pathname;
            
            for (const pattern of this.pathPaginationPatterns) {
              const match = linkPath.match(pattern);
              if (match) {
                const linkPage = parseInt(match[1]);
                
                // Try to determine current page from URL
                const currentMatch = currentPath.match(pattern);
                const currentPage = currentMatch ? parseInt(currentMatch[1]) : 1;
                
                if (linkPage === currentPage + 1) {
                  return {
                    element: link,
                    url: link.href,
                    type: 'path-based',
                    confidence: 0.92,
                    paginationType: 'url-based',
                    pathPattern: pattern.toString(),
                    currentPage: currentPage,
                    nextPage: linkPage
                  };
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      return null;
    } catch (e) {
      console.warn('Error in detectPathBased:', e);
      return null;
    }
  }

  /**
   * PHASE 1: Multi-Strategy Detection Engine
   * Runs all detection strategies and returns results sorted by confidence
   * @returns {Array} Array of detection results sorted by confidence (highest first)
   */
  detectAll() {
    const results = [];
    
    // Strategy 1: Query String Detection
    const queryStringResult = this.detectQueryString();
    if (queryStringResult) {
      results.push(queryStringResult);
    }
    
    // Strategy 2: Path-Based Detection
    const pathBasedResult = this.detectPathBased();
    if (pathBasedResult) {
      results.push(pathBasedResult);
    }
    
    // Strategy 3: Rel Attribute (most reliable)
    const relResult = this.findByRelAttribute();
    if (relResult) {
      relResult.paginationType = this._classifyPaginationType(relResult);
      results.push(relResult);
    }
    
    // Strategy 4: Text Content
    const textResult = this.findByTextContent();
    if (textResult) {
      textResult.paginationType = this._classifyPaginationType(textResult);
      results.push(textResult);
    }
    
    // Strategy 5: Numbered Pagination
    const numberedResult = this.findNumberedPagination();
    if (numberedResult) {
      numberedResult.paginationType = this._classifyPaginationType(numberedResult);
      results.push(numberedResult);
    }
    
    // Strategy 6: Class/ID Patterns
    const classIdResult = this.findByClassId();
    if (classIdResult) {
      classIdResult.paginationType = this._classifyPaginationType(classIdResult);
      results.push(classIdResult);
    }
    
    // Strategy 7: ARIA Labels
    const ariaResult = this.findByAriaLabel();
    if (ariaResult) {
      ariaResult.paginationType = this._classifyPaginationType(ariaResult);
      results.push(ariaResult);
    }
    
    // Strategy 8: Infinite Scroll
    const infiniteResult = this.findInfiniteScrollButton();
    if (infiniteResult) {
      infiniteResult.paginationType = 'infinite-scroll';
      results.push(infiniteResult);
    }
    
    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);
    
    return results;
  }

  /**
   * PHASE 1: Get Best Detection Strategy
   * Returns the highest confidence detection result
   * @returns {Object|null} Best detection result or null
   */
  detectBest() {
    const allResults = this.detectAll();
    return allResults.length > 0 ? allResults[0] : null;
  }

  /**
   * PHASE 1: Classify Pagination Type
   * Determines the type of pagination (url-based, button-based, ajax-based, infinite-scroll)
   * @private
   * @param {Object} detection - Detection result
   * @returns {string} Pagination type
   */
  _classifyPaginationType(detection) {
    if (!detection) return 'unknown';
    
    // Already classified in new methods
    if (detection.paginationType) {
      return detection.paginationType;
    }
    
    // Infinite scroll
    if (detection.isLoadMore || detection.type === 'infinite-scroll') {
      return 'infinite-scroll';
    }
    
    // URL-based (has valid URL)
    if (detection.url && !detection.clickOnly && detection.url !== window.location.href) {
      return 'url-based';
    }
    
    // AJAX-based (clickOnly without navigation)
    if (detection.clickOnly || !detection.url) {
      return 'ajax-based';
    }
    
    // Button-based (has element but may need click)
    if (detection.element) {
      return 'button-based';
    }
    
    return 'unknown';
  }

  /**
   * Validate if element is likely a next page link
   */
  isValidNextPageElement(element) {
    if (!element) return false;
    
    // Element should be visible
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    
    // Should have some dimensions (not collapsed)
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }
    
    // Should not be disabled
    if (element.disabled || element.getAttribute('disabled') === 'true') {
      return false;
    }
    
    return true;
  }

  /**
   * Check if infinite scroll is detected on the page
   */
  detectInfiniteScroll() {
    // Check for common infinite scroll indicators
    const indicators = [
      document.querySelector('[data-infinite-scroll]'),
      document.querySelector('.infinite-scroll'),
      document.querySelector('[data-auto-pager]'),
    ];
    
    return indicators.some(el => el !== null);
  }

  /**
   * Simulate clicking/navigating to next page
   * @param {Object} nextPageInfo - Result from findNextPage()
   * @returns {Promise<boolean>} Success status
   */
  async navigateToNextPage(nextPageInfo) {
    if (!nextPageInfo || !nextPageInfo.element) return false;
    
    try {
      const element = nextPageInfo.element;
      
      // For load more buttons, trigger click
      if (nextPageInfo.isLoadMore) {
        element.click();
        // Wait for content to load
        await this.waitForNewContent();
        return true;
      }
      
      // For regular navigation, navigate to URL
      if (nextPageInfo.url) {
        window.location.href = nextPageInfo.url;
        return true;
      }
      
      // Fallback: clickable next element without URL (SPA routers)
      if (element) {
        element.click();
        await this.waitForNewContent();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error navigating to next page:', error);
      return false;
    }
  }

  /**
   * Wait for new content after AJAX load
   */
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

  /**
   * Get pagination info (current page, total pages if available)
   */
  getPaginationInfo() {
    const info = {
      currentPage: 1,
      totalPages: null,
      hasNext: false,
      hasPrevious: false
    };

    // Try to find current page number
    const currentPageEl = document.querySelector('.current, .active, [aria-current="page"]');
    if (currentPageEl) {
      const pageNum = parseInt(this.getElementText(currentPageEl));
      if (!isNaN(pageNum)) {
        info.currentPage = pageNum;
      }
    }

    // Try to find total pages
    const pageLinks = Array.from(document.querySelectorAll('.pagination a, .pager a, .page-numbers a'));
    const pageNumbers = pageLinks
      .map(link => parseInt(this.getElementText(link)))
      .filter(num => !isNaN(num));
    
    if (pageNumbers.length > 0) {
      info.totalPages = Math.max(...pageNumbers);
    }

    // Check for next/previous
    info.hasNext = !!this.findNextPage();
    info.hasPrevious = !!document.querySelector('a[rel="prev"], .prev, .previous');

    return info;
  }

  /**
   * PHASE 3: Shadow DOM Detection
   * Searches for pagination elements inside Shadow DOM
   * @returns {Object|null} Detection result or null
   */
  detectInShadowDOM() {
    try {
      const results = [];
      
      // Find all elements with shadow roots
      const elementsWithShadow = this._findElementsWithShadowDOM(document.body);
      
      for (const host of elementsWithShadow) {
        const shadowRoot = host.shadowRoot;
        if (!shadowRoot) continue;
        
        // Search for pagination in shadow DOM using standard selectors
        for (const selector of this.paginationSelectors) {
          const container = shadowRoot.querySelector(selector);
          if (container) {
            // Look for next links in shadow DOM
            const nextLink = this._findNextInContainer(container);
            if (nextLink) {
              results.push({
                element: nextLink,
                url: nextLink.href || null,
                type: 'shadow-dom',
                confidence: 0.88,
                paginationType: 'shadow-dom',
                shadowHost: host
              });
            }
          }
        }
        
        // Also try finding next button directly in shadow DOM
        const nextSelectors = [
          'a[rel="next"]',
          'a.next',
          'button.next',
          '.pagination-next'
        ];
        
        for (const selector of nextSelectors) {
          const element = shadowRoot.querySelector(selector);
          if (element && this.isValidNextPageElement(element)) {
            results.push({
              element: element,
              url: element.href || null,
              type: 'shadow-dom-direct',
              confidence: 0.90,
              paginationType: 'shadow-dom',
              shadowHost: host
            });
          }
        }
      }
      
      // Return highest confidence result
      return results.length > 0 ? results.sort((a, b) => b.confidence - a.confidence)[0] : null;
    } catch (error) {
      console.warn('PaginationDetector: Error detecting in Shadow DOM:', error);
      return null;
    }
  }

  /**
   * Helper: Find all elements with Shadow DOM
   * @private
   */
  _findElementsWithShadowDOM(root, results = []) {
    if (!root) return results;
    
    try {
      // Check if this element has a shadow root
      if (root.shadowRoot) {
        results.push(root);
      }
      
      // Recursively check children
      const children = root.children || [];
      for (const child of children) {
        this._findElementsWithShadowDOM(child, results);
      }
    } catch (error) {
      // Some shadow roots may be closed and inaccessible
    }
    
    return results;
  }

  /**
   * Helper: Find next link in container
   * @private
   */
  _findNextInContainer(container) {
    const links = Array.from(container.querySelectorAll('a[href]'));
    
    for (const link of links) {
      const text = this.getElementText(link).toLowerCase();
      if (text.includes('next') || text.includes('→') || text.includes('›')) {
        if (this.isValidNextPageElement(link)) {
          return link;
        }
      }
    }
    
    return null;
  }

  /**
   * PHASE 3: Learn URL Pattern from Current Navigation
   * Analyzes the current and next URLs to learn pagination patterns
   * @param {string} currentUrl - Current page URL
   * @param {string} nextUrl - Next page URL
   */
  learnUrlPattern(currentUrl, nextUrl) {
    if (!this.enablePatternLearning) return;
    
    try {
      const current = new URL(currentUrl);
      const next = new URL(nextUrl);
      const hostname = current.hostname;
      
      // Learn query string patterns
      for (const param of this.queryStringPatterns) {
        if (current.searchParams.has(param) && next.searchParams.has(param)) {
          const currentVal = parseInt(current.searchParams.get(param));
          const nextVal = parseInt(next.searchParams.get(param));
          
          if (!isNaN(currentVal) && !isNaN(nextVal) && nextVal === currentVal + 1) {
            this.learnedPatterns.urlPatterns.set(hostname, {
              type: 'query-string',
              param: param,
              pattern: `?${param}={page}`
            });
            this.learnedPatterns.lastUsed.set(hostname, Date.now());
            
            if (console.log) {
              console.log(`PaginationDetector: Learned pattern for ${hostname}: query parameter "${param}"`);
            }
            return;
          }
        }
      }
      
      // Learn path patterns
      for (const pattern of this.pathPaginationPatterns) {
        const currentMatch = current.pathname.match(pattern);
        const nextMatch = next.pathname.match(pattern);
        
        if (currentMatch && nextMatch) {
          const currentPage = parseInt(currentMatch[1]);
          const nextPage = parseInt(nextMatch[1]);
          
          if (!isNaN(currentPage) && !isNaN(nextPage) && nextPage === currentPage + 1) {
            this.learnedPatterns.urlPatterns.set(hostname, {
              type: 'path-based',
              pattern: pattern.toString(),
              template: current.pathname.replace(/\d+/, '{page}')
            });
            this.learnedPatterns.lastUsed.set(hostname, Date.now());
            
            if (console.log) {
              console.log(`PaginationDetector: Learned pattern for ${hostname}: path pattern`);
            }
            return;
          }
        }
      }
    } catch (error) {
      console.warn('PaginationDetector: Error learning URL pattern:', error);
    }
  }

  /**
   * PHASE 3: Get Learned Pattern for Current Site
   * @returns {Object|null} Learned pattern or null
   */
  getLearnedPattern() {
    if (!this.enablePatternLearning) return null;
    
    try {
      const hostname = window.location.hostname;
      const pattern = this.learnedPatterns.urlPatterns.get(hostname);
      
      if (pattern) {
        // Check if pattern is not too old (7 days)
        const lastUsed = this.learnedPatterns.lastUsed.get(hostname);
        const age = Date.now() - (lastUsed || 0);
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (age < maxAge) {
          return pattern;
        } else {
          // Pattern is too old, remove it
          this.learnedPatterns.urlPatterns.delete(hostname);
          this.learnedPatterns.lastUsed.delete(hostname);
        }
      }
    } catch (error) {
      console.warn('PaginationDetector: Error getting learned pattern:', error);
    }
    
    return null;
  }

  /**
   * PHASE 3: Use Learned Pattern to Generate Next URL
   * @returns {Object|null} Detection result or null
   */
  detectWithLearnedPattern() {
    const pattern = this.getLearnedPattern();
    if (!pattern) return null;
    
    try {
      const currentUrl = new URL(window.location.href);
      
      if (pattern.type === 'query-string') {
        const currentPage = parseInt(currentUrl.searchParams.get(pattern.param)) || 1;
        const nextPage = currentPage + 1;
        
        const nextUrl = new URL(currentUrl.href);
        nextUrl.searchParams.set(pattern.param, nextPage.toString());
        
        return {
          element: null,
          url: nextUrl.href,
          type: 'learned-pattern-query',
          confidence: 0.93,
          paginationType: 'url-based',
          learnedPattern: true,
          currentPage: currentPage,
          nextPage: nextPage
        };
      } else if (pattern.type === 'path-based') {
        // Extract current page from path
        const currentMatch = currentUrl.pathname.match(new RegExp(pattern.pattern));
        if (currentMatch) {
          const currentPage = parseInt(currentMatch[1]) || 1;
          const nextPage = currentPage + 1;
          
          const nextPath = pattern.template.replace('{page}', nextPage.toString());
          const nextUrl = new URL(currentUrl.href);
          nextUrl.pathname = nextPath;
          
          return {
            element: null,
            url: nextUrl.href,
            type: 'learned-pattern-path',
            confidence: 0.93,
            paginationType: 'url-based',
            learnedPattern: true,
            currentPage: currentPage,
            nextPage: nextPage
          };
        }
      }
    } catch (error) {
      console.warn('PaginationDetector: Error using learned pattern:', error);
    }
    
    return null;
  }

  /**
   * PHASE 3: State Management - Record Navigation
   * @param {string} url - URL that was navigated to
   * @param {Object} strategy - Detection strategy used
   */
  recordNavigation(url, strategy) {
    if (!this.enableStateManagement) return;
    
    try {
      this.state.visitedUrls.add(url);
      this.state.currentPage++;
      
      if (strategy) {
        this.state.lastSuccessfulStrategy = strategy.type;
        // Remove from failed strategies if it succeeded
        this.state.failedStrategies.delete(strategy.type);
      }
      
      this.state.paginationHistory.push({
        url: url,
        page: this.state.currentPage,
        strategy: strategy ? strategy.type : 'unknown',
        timestamp: Date.now()
      });
      
      // Trim history to last 50 entries
      if (this.state.paginationHistory.length > 50) {
        this.state.paginationHistory.shift();
      }
    } catch (error) {
      console.warn('PaginationDetector: Error recording navigation:', error);
    }
  }

  /**
   * PHASE 3: State Management - Record Failed Strategy
   * @param {string} strategyType - Type of strategy that failed
   */
  recordFailure(strategyType) {
    if (!this.enableStateManagement) return;
    this.state.failedStrategies.add(strategyType);
  }

  /**
   * PHASE 3: State Management - Get State
   * @returns {Object} Current state
   */
  getState() {
    return {
      ...this.state,
      visitedUrls: Array.from(this.state.visitedUrls),
      failedStrategies: Array.from(this.state.failedStrategies),
      learnedPatterns: {
        count: this.learnedPatterns.urlPatterns.size,
        patterns: Array.from(this.learnedPatterns.urlPatterns.entries())
      }
    };
  }

  /**
   * PHASE 3: State Management - Reset State
   */
  resetState() {
    this.state = {
      currentPage: 1,
      totalPages: null,
      visitedUrls: new Set(),
      lastSuccessfulStrategy: null,
      failedStrategies: new Set(),
      paginationHistory: []
    };
  }

  /**
   * PHASE 3: Save State to Storage
   * @returns {Promise<boolean>} Success status
   */
  async saveState() {
    try {
      const stateData = this.getState();
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ [this.storageKey]: stateData });
        return true;
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(stateData));
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('PaginationDetector: Error saving state:', error);
      return false;
    }
  }

  /**
   * PHASE 3: Load State from Storage
   * @returns {Promise<boolean>} Success status
   */
  async loadState() {
    try {
      let stateData = null;
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(this.storageKey);
        stateData = result[this.storageKey];
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.storageKey);
        stateData = stored ? JSON.parse(stored) : null;
      }
      
      if (stateData) {
        this.state.currentPage = stateData.currentPage || 1;
        this.state.totalPages = stateData.totalPages;
        this.state.visitedUrls = new Set(stateData.visitedUrls || []);
        this.state.lastSuccessfulStrategy = stateData.lastSuccessfulStrategy;
        this.state.failedStrategies = new Set(stateData.failedStrategies || []);
        this.state.paginationHistory = stateData.paginationHistory || [];
        
        // Load learned patterns
        if (stateData.learnedPatterns && stateData.learnedPatterns.patterns) {
          this.learnedPatterns.urlPatterns = new Map(stateData.learnedPatterns.patterns);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('PaginationDetector: Error loading state:', error);
      return false;
    }
  }

  /**
   * PHASE 3: Enhanced detectAll with Shadow DOM and Learned Patterns
   * Overrides the Phase 1 method to include Phase 3 features
   * @returns {Array} Array of detection results sorted by confidence
   */
  detectAllEnhanced() {
    const results = [];
    
    // Strategy 0: Learned Pattern (if available)
    const learnedResult = this.detectWithLearnedPattern();
    if (learnedResult) {
      results.push(learnedResult);
    }
    
    // Strategy 1: Query String Detection
    const queryStringResult = this.detectQueryString();
    if (queryStringResult) {
      results.push(queryStringResult);
    }
    
    // Strategy 2: Path-Based Detection
    const pathBasedResult = this.detectPathBased();
    if (pathBasedResult) {
      results.push(pathBasedResult);
    }
    
    // Strategy 3: Shadow DOM Detection
    const shadowDomResult = this.detectInShadowDOM();
    if (shadowDomResult) {
      results.push(shadowDomResult);
    }
    
    // Strategy 4: Rel Attribute (most reliable)
    const relResult = this.findByRelAttribute();
    if (relResult) {
      relResult.paginationType = this._classifyPaginationType(relResult);
      results.push(relResult);
    }
    
    // Strategy 5: Text Content
    const textResult = this.findByTextContent();
    if (textResult) {
      textResult.paginationType = this._classifyPaginationType(textResult);
      results.push(textResult);
    }
    
    // Strategy 6: Numbered Pagination
    const numberedResult = this.findNumberedPagination();
    if (numberedResult) {
      numberedResult.paginationType = this._classifyPaginationType(numberedResult);
      results.push(numberedResult);
    }
    
    // Strategy 7: Class/ID Patterns
    const classIdResult = this.findByClassId();
    if (classIdResult) {
      classIdResult.paginationType = this._classifyPaginationType(classIdResult);
      results.push(classIdResult);
    }
    
    // Strategy 8: ARIA Labels
    const ariaResult = this.findByAriaLabel();
    if (ariaResult) {
      ariaResult.paginationType = this._classifyPaginationType(ariaResult);
      results.push(ariaResult);
    }
    
    // Strategy 9: Infinite Scroll
    const infiniteResult = this.findInfiniteScrollButton();
    if (infiniteResult) {
      infiniteResult.paginationType = 'infinite-scroll';
      results.push(infiniteResult);
    }
    
    // Filter out failed strategies from state management
    const filteredResults = results.filter(r => !this.state.failedStrategies.has(r.type));
    
    // Sort by confidence (highest first)
    filteredResults.sort((a, b) => b.confidence - a.confidence);
    
    return filteredResults;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.PaginationDetector = PaginationDetector;
  
  if (!window.__ST) {
    window.__ST = {};
  }
  window.__ST.PaginationDetector = PaginationDetector;
  
  console.log('✅ PaginationDetector loaded and available');
}

// CommonJS export for Node.js/testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaginationDetector;
}
