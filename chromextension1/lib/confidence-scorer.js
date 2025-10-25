// confidence-scorer.js - Unified Confidence Scoring System for STEPTHREE
// Provides sophisticated scoring algorithms for pattern recognition confidence
// Combines multiple signals to generate reliable [0..1] confidence scores

console.log('🎯 Loading Confidence Scoring System...');

/**
 * Unified Confidence Scoring System
 * Combines multiple signals to generate reliable confidence scores for pattern recognition
 */
class ConfidenceScorer {
  constructor(options = {}) {
    this.options = {
      // Confidence thresholds
      highConfidenceThreshold: options.highConfidenceThreshold || 0.75,
      mediumConfidenceThreshold: options.mediumConfidenceThreshold || 0.5,
      lowConfidenceThreshold: options.lowConfidenceThreshold || 0.25,
      
      // Signal weights - sum should equal 1.0
      weights: {
        urlPattern: options.urlPatternWeight || 0.20,
        selectorStability: options.selectorStabilityWeight || 0.25,
        layoutConsistency: options.layoutConsistencyWeight || 0.20,
        imageDimensions: options.imageDimensionsWeight || 0.15,
        lazyLoadReadiness: options.lazyLoadReadinessWeight || 0.10,
        elementCount: options.elementCountWeight || 0.10
      },
      
      // URL pattern scoring
      urlPatterns: {
        highConfidence: [
          /\/gallery\//i, /\/photos?\//i, /\/images?\//i, /\/media\//i,
          /\/portfolio\//i, /\/albums?\//i, /\/collections?\//i
        ],
        mediumConfidence: [
          /gallery/i, /photos?/i, /images?/i, /media/i,
          /portfolio/i, /albums?/i, /collections?/i
        ],
        pagination: [
          /page=(\d+)/i, /p=(\d+)/i, /offset=(\d+)/i,
          /start=(\d+)/i, /skip=(\d+)/i
        ]
      },
      
      // Layout analysis thresholds
      layout: {
        gridAlignmentTolerance: options.gridAlignmentTolerance || 10,
        spacingVarianceTolerance: options.spacingVarianceTolerance || 0.3,
        aspectRatioTolerance: options.aspectRatioTolerance || 0.4,
        minGridItems: options.minGridItems || 4
      },
      
      // Image dimension thresholds
      images: {
        minDimension: options.minImageDimension || 50,
        optimalDimension: options.optimalImageDimension || 200,
        aspectRatioVariance: options.aspectRatioVariance || 0.5
      },
      
      // Performance constraints
      maxAnalysisTime: options.maxAnalysisTime || 100, // 100ms max for scoring
      maxElementsToAnalyze: options.maxElementsToAnalyze || 100,
      
      ...options
    };

    // Validate weights sum to 1.0
    const weightSum = Object.values(this.options.weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      console.warn('⚠️ Confidence scorer weights do not sum to 1.0:', weightSum);
    }

    // Analytics tracking
    this.analytics = {
      scoresCalculated: 0,
      averageScore: 0,
      signalContributions: {},
      processingTimes: [],
      rationales: []
    };

    // Cache for repeated calculations
    this.scoreCache = new Map();
    this.elementCache = new Map();
    
    console.log('✅ Confidence Scoring System initialized');
  }

  /**
   * Calculate comprehensive confidence score for a pattern
   * @param {Object} pattern - Pattern object with elements and metadata
   * @param {Object} context - Additional context (URL, page metadata, etc.)
   * @returns {Object} {score: number, rationale: Object, signals: Object}
   */
  async calculateConfidence(pattern, context = {}) {
    const startTime = performance.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(pattern, context);
      if (this.scoreCache.has(cacheKey)) {
        return this.scoreCache.get(cacheKey);
      }

      // Validate inputs
      if (!pattern || !pattern.elements || pattern.elements.length === 0) {
        return this.createScoreResult(0, 'No elements provided', {});
      }

      // Ensure we don't exceed performance limits
      const elementsToAnalyze = pattern.elements.slice(0, this.options.maxElementsToAnalyze);
      
      // Calculate individual signal scores
      const signals = await this.calculateAllSignals(elementsToAnalyze, pattern, context);
      
      // Combine signals using weighted average
      const score = this.combineSignals(signals);
      
      // Generate detailed rationale
      const rationale = this.generateRationale(signals, score);
      
      const result = this.createScoreResult(score, rationale, signals);
      
      // Cache result
      this.scoreCache.set(cacheKey, result);
      
      // Update analytics
      this.updateAnalytics(score, signals, performance.now() - startTime, rationale);
      
      return result;
      
    } catch (error) {
      console.error('❌ Confidence scoring failed:', error);
      return this.createScoreResult(0, `Error: ${error.message}`, {});
    }
  }

  /**
   * Calculate all signal scores in parallel for performance
   */
  async calculateAllSignals(elements, pattern, context) {
    const timeout = this.options.maxAnalysisTime;
    
    try {
      // Use Promise.race with timeout to ensure performance constraints
      const signalPromises = Promise.all([
        this.scoreUrlPattern(context.url || window.location.href),
        this.scoreSelectorStability(elements, pattern.selector),
        this.scoreLayoutConsistency(elements),
        this.scoreImageDimensions(elements),
        this.scoreLazyLoadReadiness(elements),
        this.scoreElementCount(elements.length)
      ]);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Signal calculation timeout')), timeout)
      );

      const [
        urlScore,
        selectorScore,
        layoutScore,
        imageScore,
        lazyLoadScore,
        elementCountScore
      ] = await Promise.race([signalPromises, timeoutPromise]);

      return {
        urlPattern: urlScore,
        selectorStability: selectorScore,
        layoutConsistency: layoutScore,
        imageDimensions: imageScore,
        lazyLoadReadiness: lazyLoadScore,
        elementCount: elementCountScore
      };
      
    } catch (error) {
      console.warn('⚠️ Signal calculation error:', error);
      // Return default scores if calculation fails
      return {
        urlPattern: { score: 0.3, details: 'Calculation failed' },
        selectorStability: { score: 0.3, details: 'Calculation failed' },
        layoutConsistency: { score: 0.3, details: 'Calculation failed' },
        imageDimensions: { score: 0.3, details: 'Calculation failed' },
        lazyLoadReadiness: { score: 0.3, details: 'Calculation failed' },
        elementCount: { score: 0.3, details: 'Calculation failed' }
      };
    }
  }

  /**
   * Score URL pattern strength based on gallery and pagination indicators
   */
  scoreUrlPattern(url) {
    if (!url) return { score: 0.3, details: 'No URL provided' };

    let score = 0.3; // Base score
    const details = [];

    // Check high confidence patterns
    for (const pattern of this.options.urlPatterns.highConfidence) {
      if (pattern.test(url)) {
        score = Math.max(score, 0.9);
        details.push(`High confidence URL pattern: ${pattern.source}`);
        break;
      }
    }

    // Check medium confidence patterns
    if (score < 0.8) {
      for (const pattern of this.options.urlPatterns.mediumConfidence) {
        if (pattern.test(url)) {
          score = Math.max(score, 0.6);
          details.push(`Medium confidence URL pattern: ${pattern.source}`);
          break;
        }
      }
    }

    // Check for pagination indicators
    for (const pattern of this.options.urlPatterns.pagination) {
      if (pattern.test(url)) {
        score = Math.min(score + 0.2, 1.0);
        details.push('Pagination pattern detected');
        break;
      }
    }

    return {
      score: Math.max(0, Math.min(score, 1)),
      details: details.join('; ') || 'No strong URL patterns detected'
    };
  }

  /**
   * Score CSS selector stability and uniqueness
   */
  scoreSelectorStability(elements, selector) {
    if (!selector || elements.length === 0) {
      return { score: 0.2, details: 'No selector or elements provided' };
    }

    let score = 0.5; // Base score
    const details = [];

    // Analyze selector complexity and stability
    const selectorComplexity = this.analyzeSelectorComplexity(selector);
    score += selectorComplexity.boost;
    details.push(`Selector complexity: ${selectorComplexity.description}`);

    // Check selector uniqueness
    const uniqueness = this.calculateSelectorUniqueness(elements, selector);
    score += uniqueness.boost;
    details.push(`Selector uniqueness: ${uniqueness.description}`);

    // Check for volatility indicators (dynamic IDs, random classes)
    const volatility = this.assessSelectorVolatility(selector);
    score -= volatility.penalty;
    if (volatility.penalty > 0) {
      details.push(`Volatility detected: ${volatility.description}`);
    }

    return {
      score: Math.max(0, Math.min(score, 1)),
      details: details.join('; ')
    };
  }

  /**
   * Score layout consistency (grid alignment, spacing patterns)
   */
  scoreLayoutConsistency(elements) {
    if (elements.length < 2) {
      return { score: 0.3, details: 'Insufficient elements for layout analysis' };
    }

    const positions = elements.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    }).filter(pos => pos.width > 0 && pos.height > 0);

    if (positions.length < 2) {
      return { score: 0.3, details: 'Elements not visible for layout analysis' };
    }

    let score = 0.4; // Base score
    const details = [];

    // Analyze grid alignment
    const gridScore = this.analyzeGridAlignment(positions);
    score += gridScore.boost;
    details.push(`Grid alignment: ${gridScore.description}`);

    // Analyze spacing consistency
    const spacingScore = this.analyzeSpacingConsistency(positions);
    score += spacingScore.boost;
    details.push(`Spacing consistency: ${spacingScore.description}`);

    // Analyze aspect ratio consistency
    const aspectScore = this.analyzeAspectRatioConsistency(positions);
    score += aspectScore.boost;
    details.push(`Aspect ratio consistency: ${aspectScore.description}`);

    return {
      score: Math.max(0, Math.min(score, 1)),
      details: details.join('; ')
    };
  }

  /**
   * Score image dimensions and aspect ratios
   */
  scoreImageDimensions(elements) {
    const images = elements.filter(el => 
      el.tagName === 'IMG' || 
      el.querySelector('img') ||
      getComputedStyle(el).backgroundImage !== 'none'
    );

    if (images.length === 0) {
      return { score: 0.4, details: 'No images found in elements' };
    }

    let score = 0.3; // Base score
    const details = [];
    const dimensions = [];

    // Analyze image dimensions
    for (const img of images.slice(0, 20)) { // Limit for performance
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        dimensions.push({
          width: rect.width,
          height: rect.height,
          aspectRatio: rect.width / rect.height
        });
      }
    }

    if (dimensions.length > 0) {
      // Score based on optimal dimensions
      const avgDimension = dimensions.reduce((sum, d) => sum + Math.min(d.width, d.height), 0) / dimensions.length;
      if (avgDimension >= this.options.images.optimalDimension) {
        score += 0.3;
        details.push('Optimal image dimensions');
      } else if (avgDimension >= this.options.images.minDimension) {
        score += 0.2;
        details.push('Acceptable image dimensions');
      } else {
        details.push('Small image dimensions detected');
      }

      // Score aspect ratio consistency
      const aspectRatios = dimensions.map(d => d.aspectRatio);
      const aspectVariance = this.calculateVariance(aspectRatios);
      if (aspectVariance < this.options.images.aspectRatioVariance) {
        score += 0.2;
        details.push('Consistent aspect ratios');
      } else {
        details.push('Variable aspect ratios');
      }
    }

    return {
      score: Math.max(0, Math.min(score, 1)),
      details: details.join('; ')
    };
  }

  /**
   * Score lazy-load readiness and loading patterns
   */
  scoreLazyLoadReadiness(elements) {
    let score = 0.4; // Base score
    const details = [];

    // Check for lazy loading attributes
    const lazyElements = elements.filter(el => {
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      return img && (
        img.hasAttribute('loading') ||
        img.hasAttribute('data-src') ||
        img.hasAttribute('data-lazy') ||
        img.classList.contains('lazy')
      );
    });

    if (lazyElements.length > 0) {
      const lazyRatio = lazyElements.length / elements.length;
      score += lazyRatio * 0.3;
      details.push(`${Math.round(lazyRatio * 100)}% elements have lazy loading`);
    }

    // Check for intersection observer patterns
    const hasIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;
    if (hasIntersectionObserver) {
      score += 0.1;
      details.push('Intersection Observer available');
    }

    // Check for scroll-based loading patterns
    const scrollHandlers = this.detectScrollBasedLoading();
    if (scrollHandlers > 0) {
      score += 0.2;
      details.push('Scroll-based loading detected');
    }

    return {
      score: Math.max(0, Math.min(score, 1)),
      details: details.join('; ') || 'Basic loading patterns'
    };
  }

  /**
   * Score element count appropriateness
   */
  scoreElementCount(count) {
    let score = 0.3; // Base score
    const details = [];

    if (count >= 20) {
      score = 0.9;
      details.push('Excellent element count for gallery');
    } else if (count >= 10) {
      score = 0.7;
      details.push('Good element count for gallery');
    } else if (count >= 5) {
      score = 0.5;
      details.push('Moderate element count');
    } else if (count >= 3) {
      score = 0.4;
      details.push('Minimal element count');
    } else {
      score = 0.2;
      details.push('Very few elements detected');
    }

    return {
      score,
      details: details.join('; ')
    };
  }

  /**
   * Combine individual signal scores using weighted average
   */
  combineSignals(signals) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [signalName, signalData] of Object.entries(signals)) {
      const weight = this.options.weights[signalName] || 0;
      const score = signalData.score || 0;
      
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Generate detailed scoring rationale
   * Creates a comprehensive breakdown of how the confidence score was calculated
   * 
   * @param {Object} signals - All signals used in scoring calculation
   * @param {number} finalScore - The computed final confidence score
   * @returns {Object} Detailed rationale including score breakdown and recommendations
   */
  generateRationale(signals, finalScore) {
    const rationale = {
      overallScore: finalScore,
      confidence: this.getConfidenceLevel(finalScore),
      signalBreakdown: {},
      recommendations: [],
      timestamp: Date.now()
    };

    // Process each signal
    for (const [signalName, signalData] of Object.entries(signals)) {
      const weight = this.options.weights[signalName] || 0;
      const contribution = (signalData.score * weight) / finalScore;
      
      rationale.signalBreakdown[signalName] = {
        score: signalData.score,
        weight: weight,
        contribution: contribution,
        details: signalData.details
      };
    }

    // Generate recommendations
    rationale.recommendations = this.generateRecommendations(signals, finalScore);

    return rationale;
  }

  /**
   * Get confidence level description
   * Translates numeric confidence score into categorized confidence level
   * 
   * @param {number} score - Confidence score (0-1)
   * @returns {string} Confidence level: 'HIGH', 'MEDIUM', 'LOW', or 'VERY_LOW'
   */
  getConfidenceLevel(score) {
    if (score >= this.options.highConfidenceThreshold) {
      return 'HIGH';
    } else if (score >= this.options.mediumConfidenceThreshold) {
      return 'MEDIUM';
    } else if (score >= this.options.lowConfidenceThreshold) {
      return 'LOW';
    } else {
      return 'VERY_LOW';
    }
  }

  /**
   * Generate actionable recommendations based on signals
   * Analyzes pattern recognition signals and provides specific suggestions
   * to improve confidence scores and pattern accuracy
   * 
   * @param {Object} signals - Signal scores and details from pattern analysis
   * @param {number} score - Overall confidence score (0-1)
   * @returns {string[]} Array of actionable recommendation strings
   */
  generateRecommendations(signals, score) {
    const recommendations = [];

    // Check for specific improvement opportunities
    if (signals.selectorStability.score < 0.5) {
      recommendations.push('Consider using more stable CSS selectors (e.g., data attributes, unique classes)');
    }

    if (signals.layoutConsistency.score < 0.5) {
      recommendations.push('Elements may not be in a consistent grid layout - try selecting items with uniform spacing');
    }

    if (signals.imageDimensions.score < 0.5) {
      recommendations.push('Image dimensions may be inconsistent or too small - ensure all images are similar in size');
    }

    if (signals.elementCount.score < 0.5) {
      recommendations.push('Consider including more elements in the pattern (at least 3-5 items for better accuracy)');
    }

    if (score < this.options.mediumConfidenceThreshold) {
      recommendations.push('Pattern may benefit from manual refinement using the visual selector tool');
    }

    return recommendations;
  }

  // =============================================================================
  // HELPER METHODS FOR SIGNAL CALCULATIONS
  // =============================================================================

  /**
   * Analyze CSS selector complexity and stability indicators
   */
  analyzeSelectorComplexity(selector) {
    let boost = 0;
    let description = 'Basic selector';

    // Prefer attribute selectors
    if (/\[data-[^=\]]+[\]=]/.test(selector)) {
      boost += 0.2;
      description = 'Data attribute selector (stable)';
    } else if (/\[[\w-]+[\]=]/.test(selector)) {
      boost += 0.1;
      description = 'Attribute selector (good)';
    }

    // Penalize complex descendant selectors
    const descendantCount = (selector.match(/\s+/g) || []).length;
    if (descendantCount > 3) {
      boost -= 0.1;
      description += ', complex hierarchy';
    }

    // Prefer semantic class names
    const semanticClasses = /\b(gallery|image|photo|item|card|tile)\b/i.test(selector);
    if (semanticClasses) {
      boost += 0.1;
      description += ', semantic classes';
    }

    return { boost: Math.max(-0.3, Math.min(boost, 0.3)), description };
  }

  /**
   * Calculate selector uniqueness score
   */
  calculateSelectorUniqueness(elements, selector) {
    let boost = 0;
    let description = 'Unknown uniqueness';

    try {
      // Test if selector matches expected number of elements
      const matches = document.querySelectorAll(selector);
      const ratio = elements.length / matches.length;
      
      if (ratio >= 0.8) {
        boost = 0.2;
        description = 'High selector precision';
      } else if (ratio >= 0.5) {
        boost = 0.1;
        description = 'Good selector precision';
      } else {
        boost = -0.1;
        description = 'Low selector precision';
      }
    } catch (error) {
      description = 'Invalid selector';
      boost = -0.2;
    }

    return { boost, description };
  }

  /**
   * Assess selector volatility (likely to change)
   */
  assessSelectorVolatility(selector) {
    let penalty = 0;
    const issues = [];

    // Check for randomly generated IDs or classes
    if (/[#.][a-zA-Z0-9]{10,}/.test(selector)) {
      penalty += 0.1;
      issues.push('Long random identifiers');
    }

    // Check for framework-specific volatile classes
    if (/\b(css-\w+|jsx-\d+)\b/.test(selector)) {
      penalty += 0.15;
      issues.push('Framework-generated classes');
    }

    // Check for indexed selectors
    if (/:nth-child\(\d+\)/.test(selector)) {
      penalty += 0.05;
      issues.push('Position-dependent selectors');
    }

    return {
      penalty: Math.min(penalty, 0.3),
      description: issues.join(', ') || 'No volatility detected'
    };
  }

  /**
   * Analyze grid alignment patterns
   */
  analyzeGridAlignment(positions) {
    if (positions.length < this.options.layout.minGridItems) {
      return { boost: 0, description: 'Insufficient items for grid analysis' };
    }

    // Check for consistent X positions (columns)
    const xPositions = [...new Set(positions.map(p => Math.round(p.x / 10) * 10))];
    const yPositions = [...new Set(positions.map(p => Math.round(p.y / 10) * 10))];

    let boost = 0;
    const details = [];

    if (xPositions.length >= 2 && xPositions.length <= positions.length / 2) {
      boost += 0.15;
      details.push(`${xPositions.length} columns detected`);
    }

    if (yPositions.length >= 2 && yPositions.length <= positions.length / 2) {
      boost += 0.15;
      details.push(`${yPositions.length} rows detected`);
    }

    return {
      boost: Math.min(boost, 0.3),
      description: details.join(', ') || 'No clear grid structure'
    };
  }

  /**
   * Analyze spacing consistency between elements
   */
  analyzeSpacingConsistency(positions) {
    if (positions.length < 3) {
      return { boost: 0, description: 'Insufficient elements for spacing analysis' };
    }

    // Calculate horizontal and vertical gaps
    const sortedByX = [...positions].sort((a, b) => a.x - b.x);
    const sortedByY = [...positions].sort((a, b) => a.y - b.y);

    const horizontalGaps = [];
    const verticalGaps = [];

    // Calculate gaps
    for (let i = 1; i < sortedByX.length; i++) {
      const gap = sortedByX[i].x - (sortedByX[i-1].x + sortedByX[i-1].width);
      if (gap >= 0) horizontalGaps.push(gap);
    }

    for (let i = 1; i < sortedByY.length; i++) {
      const gap = sortedByY[i].y - (sortedByY[i-1].y + sortedByY[i-1].height);
      if (gap >= 0) verticalGaps.push(gap);
    }

    let boost = 0;
    const details = [];

    // Check horizontal spacing consistency
    if (horizontalGaps.length > 0) {
      const hVariance = this.calculateVariance(horizontalGaps);
      const hMean = horizontalGaps.reduce((sum, gap) => sum + gap, 0) / horizontalGaps.length;
      if (hVariance / Math.max(hMean, 1) < this.options.layout.spacingVarianceTolerance) {
        boost += 0.1;
        details.push('Consistent horizontal spacing');
      }
    }

    // Check vertical spacing consistency
    if (verticalGaps.length > 0) {
      const vVariance = this.calculateVariance(verticalGaps);
      const vMean = verticalGaps.reduce((sum, gap) => sum + gap, 0) / verticalGaps.length;
      if (vVariance / Math.max(vMean, 1) < this.options.layout.spacingVarianceTolerance) {
        boost += 0.1;
        details.push('Consistent vertical spacing');
      }
    }

    return {
      boost: Math.min(boost, 0.2),
      description: details.join(', ') || 'Inconsistent spacing'
    };
  }

  /**
   * Analyze aspect ratio consistency
   */
  analyzeAspectRatioConsistency(positions) {
    const aspectRatios = positions.map(p => p.width / p.height);
    const variance = this.calculateVariance(aspectRatios);
    const mean = aspectRatios.reduce((sum, ratio) => sum + ratio, 0) / aspectRatios.length;

    let boost = 0;
    let description = 'Variable aspect ratios';

    if (variance / Math.max(mean, 1) < this.options.layout.aspectRatioTolerance) {
      boost = 0.15;
      description = 'Consistent aspect ratios';
    }

    return { boost, description };
  }

  /**
   * Detect scroll-based loading patterns
   */
  detectScrollBasedLoading() {
    // This is a simplified detection - in practice, you'd analyze event listeners
    if (typeof window === 'undefined') return 0;
    
    let handlers = 0;
    
    // Check for common scroll loading libraries
    if (window.jQuery && window.jQuery.fn.lazyload) handlers++;
    if (window.lozad) handlers++;
    if (window.LazyLoad) handlers++;
    
    return handlers;
  }

  /**
   * Calculate variance of an array of numbers
   */
  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  /**
   * Generate cache key for scoring results
   */
  generateCacheKey(pattern, context) {
    const patternKey = pattern.selector || 'unknown';
    const urlKey = context.url || 'unknown';
    const elementCount = pattern.elements ? pattern.elements.length : 0;
    return `${patternKey}-${urlKey}-${elementCount}`;
  }

  /**
   * Create standardized score result object
   */
  createScoreResult(score, rationale, signals) {
    return {
      score: Math.max(0, Math.min(score, 1)),
      confidence: this.getConfidenceLevel(score),
      rationale,
      signals,
      timestamp: Date.now()
    };
  }

  /**
   * Update analytics tracking
   */
  updateAnalytics(score, signals, processingTime, rationale) {
    this.analytics.scoresCalculated++;
    this.analytics.averageScore = (
      (this.analytics.averageScore * (this.analytics.scoresCalculated - 1) + score) /
      this.analytics.scoresCalculated
    );
    
    this.analytics.processingTimes.push(processingTime);
    this.analytics.rationales.push(rationale);

    // Track signal contributions
    for (const [signalName, signalData] of Object.entries(signals)) {
      if (!this.analytics.signalContributions[signalName]) {
        this.analytics.signalContributions[signalName] = [];
      }
      this.analytics.signalContributions[signalName].push(signalData.score);
    }

    // Keep analytics data bounded
    if (this.analytics.processingTimes.length > 100) {
      this.analytics.processingTimes = this.analytics.processingTimes.slice(-50);
    }
    if (this.analytics.rationales.length > 50) {
      this.analytics.rationales = this.analytics.rationales.slice(-25);
    }
  }

  /**
   * Get analytics summary
   */
  getAnalytics() {
    const avgProcessingTime = this.analytics.processingTimes.length > 0 ?
      this.analytics.processingTimes.reduce((sum, time) => sum + time, 0) / this.analytics.processingTimes.length : 0;

    return {
      scoresCalculated: this.analytics.scoresCalculated,
      averageScore: this.analytics.averageScore,
      averageProcessingTime: avgProcessingTime,
      cacheSize: this.scoreCache.size,
      signalContributions: this.analytics.signalContributions
    };
  }

  /**
   * Clear caches and reset analytics
   */
  reset() {
    this.scoreCache.clear();
    this.elementCache.clear();
    this.analytics = {
      scoresCalculated: 0,
      averageScore: 0,
      signalContributions: {},
      processingTimes: [],
      rationales: []
    };
  }
}

// Make ConfidenceScorer globally available
if (typeof window !== 'undefined') {
  window.ConfidenceScorer = ConfidenceScorer;
}

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfidenceScorer;
}

console.log('✅ Confidence Scoring System loaded successfully');