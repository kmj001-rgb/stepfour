/**
 * PaginationIntegration - Integration layer for pagination detection and content hashing
 * Phase 4: Integration & Testing
 * Connects PaginationDetector with ContentHasher for seamless pagination automation
 * 
 * @version 1.0.0
 */

class PaginationIntegration {
  constructor(options = {}) {
    // Initialize detector with Phase 3 features
    this.detector = new PaginationDetector({
      enablePatternLearning: options.enablePatternLearning !== false,
      enableStateManagement: options.enableStateManagement !== false,
      storageKey: options.detectorStorageKey || 'pagination_detector_state'
    });
    
    // Initialize content hasher for duplicate detection
    this.hasher = new ContentHasher({
      maxHistorySize: options.maxHistorySize || 1000,
      storageKey: options.hasherStorageKey || 'pagination_hasher_state',
      enableLogging: options.enableLogging !== false
    });
    
    // Integration options
    this.options = {
      autoDetect: options.autoDetect !== false, // Auto-detect on init
      enableFeedback: options.enableFeedback !== false, // UI feedback
      maxPages: options.maxPages || 1000, // Safety limit
      duplicateCheckLookback: options.duplicateCheckLookback || 3,
      onPageChange: options.onPageChange || null, // Callback
      onLoopDetected: options.onLoopDetected || null, // Callback
      onComplete: options.onComplete || null // Callback
    };
    
    // Session state
    this.session = {
      active: false,
      startTime: null,
      pagesProcessed: 0,
      itemsCollected: 0,
      loopsDetected: 0,
      errors: []
    };
    
    // Feedback UI elements (will be created if enabled)
    this.feedbackUI = null;
  }

  /**
   * Initialize the integration system
   * Loads saved state and performs initial detection
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      // Load saved states
      await this.detector.loadState();
      await this.hasher.loadFromChrome();
      
      // Perform initial detection if enabled
      let initialDetection = null;
      if (this.options.autoDetect) {
        initialDetection = await this.detectPagination();
      }
      
      // Create feedback UI if enabled
      if (this.options.enableFeedback) {
        this.createFeedbackUI();
      }
      
      return {
        success: true,
        detectorState: this.detector.getState(),
        hasherStats: this.hasher.getStats(),
        initialDetection: initialDetection
      };
    } catch (error) {
      console.error('PaginationIntegration: Initialization failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detect pagination on current page
   * @returns {Promise<Object>} Detection results
   */
  async detectPagination() {
    try {
      // Use enhanced detection with all strategies
      const results = this.detector.detectAllEnhanced();
      
      // Update feedback UI
      if (this.feedbackUI) {
        this.updateFeedback({
          type: 'detection',
          results: results,
          best: results[0] || null
        });
      }
      
      return {
        success: true,
        strategiesFound: results.length,
        results: results,
        best: results[0] || null
      };
    } catch (error) {
      console.error('PaginationIntegration: Detection failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start automated pagination session
   * @param {Object} options - Session options
   * @returns {Promise<Object>} Session result
   */
  async startPaginationSession(options = {}) {
    if (this.session.active) {
      return {
        success: false,
        error: 'Session already active'
      };
    }
    
    // Initialize session
    this.session = {
      active: true,
      startTime: Date.now(),
      pagesProcessed: 0,
      itemsCollected: 0,
      loopsDetected: 0,
      errors: []
    };
    
    const maxPages = options.maxPages || this.options.maxPages;
    const collectContent = options.collectContent || ((page) => page);
    
    try {
      while (this.session.pagesProcessed < maxPages) {
        // Get page content
        const content = await collectContent(this.session.pagesProcessed + 1);
        
        // Check for duplicates
        const isDuplicate = await this.hasher.isRecentDuplicate(
          content,
          this.options.duplicateCheckLookback
        );
        
        if (isDuplicate) {
          this.session.loopsDetected++;
          
          if (this.options.onLoopDetected) {
            this.options.onLoopDetected({
              page: this.session.pagesProcessed + 1,
              totalLoops: this.session.loopsDetected
            });
          }
          
          // Stop on duplicate
          break;
        }
        
        // Process content
        this.session.pagesProcessed++;
        this.session.itemsCollected += Array.isArray(content) ? content.length : 1;
        
        // Detect next page
        const detection = await this.detectPagination();
        
        if (!detection.success || !detection.best) {
          // No more pages
          break;
        }
        
        // Record navigation for learning
        if (detection.best.url) {
          this.detector.learnUrlPattern(
            window.location.href,
            detection.best.url
          );
          this.detector.recordNavigation(detection.best.url, detection.best);
        }
        
        // Navigate to next page
        const navigated = await this.navigateToNextPage(detection.best);
        
        if (!navigated) {
          this.session.errors.push({
            page: this.session.pagesProcessed,
            error: 'Navigation failed'
          });
          break;
        }
        
        // Callback
        if (this.options.onPageChange) {
          this.options.onPageChange({
            page: this.session.pagesProcessed,
            url: detection.best.url,
            strategy: detection.best.type
          });
        }
        
        // Wait for page load
        await this.waitForPageLoad();
      }
      
      // Session complete
      this.session.active = false;
      
      // Save states
      await this.saveStates();
      
      // Callback
      if (this.options.onComplete) {
        this.options.onComplete(this.session);
      }
      
      return {
        success: true,
        session: this.session
      };
      
    } catch (error) {
      this.session.active = false;
      this.session.errors.push({
        page: this.session.pagesProcessed,
        error: error.message
      });
      
      console.error('PaginationIntegration: Session failed:', error);
      return {
        success: false,
        session: this.session,
        error: error.message
      };
    }
  }

  /**
   * Navigate to next page
   * @param {Object} detection - Detection result
   * @returns {Promise<boolean>} Success status
   */
  async navigateToNextPage(detection) {
    try {
      if (detection.url && detection.url !== window.location.href) {
        // URL-based navigation
        window.location.href = detection.url;
        return true;
      } else if (detection.element) {
        // Click-based navigation
        detection.element.click();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PaginationIntegration: Navigation failed:', error);
      this.detector.recordFailure(detection.type);
      return false;
    }
  }

  /**
   * Wait for page load after navigation
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} Success status
   */
  async waitForPageLoad(timeout = 10000) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      // Wait for document ready state
      const checkReady = () => {
        if (document.readyState === 'complete') {
          resolve(true);
        } else if (Date.now() - startTime >= timeout) {
          resolve(false);
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  /**
   * Save both detector and hasher states
   * @returns {Promise<Object>} Save results
   */
  async saveStates() {
    try {
      const detectorSaved = await this.detector.saveState();
      const hasherSaved = await this.hasher.saveToChrome();
      
      return {
        success: detectorSaved && hasherSaved,
        detector: detectorSaved,
        hasher: hasherSaved
      };
    } catch (error) {
      console.error('PaginationIntegration: Save failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset both detector and hasher
   */
  async reset() {
    this.detector.resetState();
    this.hasher.reset();
    
    this.session = {
      active: false,
      startTime: null,
      pagesProcessed: 0,
      itemsCollected: 0,
      loopsDetected: 0,
      errors: []
    };
    
    await this.saveStates();
  }

  /**
   * Get complete status of integration
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      session: { ...this.session },
      detector: this.detector.getState(),
      hasher: this.hasher.getStats(),
      options: { ...this.options }
    };
  }

  /**
   * Create feedback UI overlay
   * @private
   */
  createFeedbackUI() {
    // Remove existing UI if present
    if (this.feedbackUI) {
      this.feedbackUI.remove();
    }
    
    const container = document.createElement('div');
    container.id = 'stepthree-pagination-feedback';
    container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Segoe UI', sans-serif;
      font-size: 13px;
      z-index: 999999;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: opacity 0.3s;
    `;
    
    container.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <span>🔍 Pagination Detector</span>
        <button id="stepthree-feedback-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; padding: 0;">×</button>
      </div>
      <div id="stepthree-feedback-content" style="font-size: 12px; line-height: 1.4;">
        Initializing...
      </div>
    `;
    
    document.body.appendChild(container);
    this.feedbackUI = container;
    
    // Close button handler
    const closeBtn = container.querySelector('#stepthree-feedback-close');
    closeBtn.addEventListener('click', () => {
      this.feedbackUI.style.opacity = '0';
      setTimeout(() => this.feedbackUI.remove(), 300);
      this.feedbackUI = null;
    });
  }

  /**
   * Update feedback UI with detection results
   * @private
   */
  updateFeedback(data) {
    if (!this.feedbackUI) return;
    
    const content = this.feedbackUI.querySelector('#stepthree-feedback-content');
    
    if (data.type === 'detection') {
      const { results, best } = data;
      
      if (best) {
        content.innerHTML = `
          <div style="color: #4CAF50; margin-bottom: 5px;">
            ✓ Detected: ${best.type}
          </div>
          <div style="opacity: 0.8;">
            Confidence: ${(best.confidence * 100).toFixed(0)}%<br>
            Type: ${best.paginationType}<br>
            Strategies: ${results.length} found
          </div>
        `;
      } else {
        content.innerHTML = `
          <div style="color: #ff9800;">
            ⚠ No pagination detected
          </div>
        `;
      }
    } else if (data.type === 'session') {
      content.innerHTML = `
        <div>
          Pages: ${data.pagesProcessed}<br>
          Items: ${data.itemsCollected}<br>
          Loops: ${data.loopsDetected}<br>
          Status: ${data.active ? 'Active' : 'Complete'}
        </div>
      `;
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.PaginationIntegration = PaginationIntegration;
  
  if (!window.__ST) {
    window.__ST = {};
  }
  window.__ST.PaginationIntegration = PaginationIntegration;
  
  console.log('✅ PaginationIntegration loaded and available');
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaginationIntegration;
}
