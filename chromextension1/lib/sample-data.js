/**
 * sample-data.js - Comprehensive Sample Gallery Data System
 * Provides realistic test data for StepThree Gallery Scraper extension
 * Demonstrates pattern recognition, confidence scoring, and various gallery types
 */

console.log('📊 Sample Data System loading...');

/**
 * Sample Gallery Data Generator
 * Creates comprehensive test data for demonstration and testing
 */
class SampleDataGenerator {
  constructor() {
    this.version = '2.0.0';
    this.generated = Date.now();
    this.sampleCount = 0;
    
    // Base URLs for realistic sample images (using placeholder services)
    this.imageServices = {
      picsum: 'https://picsum.photos',
      placeholder: 'https://via.placeholder.com',
      unsplash: 'https://source.unsplash.com'
    };
    
    // Sample domains for realistic URL patterns
    this.sampleDomains = [
      'example.com',
      'test-gallery.demo',
      'portfolio.sample',
      'ecommerce.test',
      'photos.demo',
      'gallery.example'
    ];
    
    // Sample categories and tags
    this.categories = [
      'nature', 'architecture', 'technology', 'people', 'animals',
      'food', 'travel', 'art', 'fashion', 'sports', 'business',
      'abstract', 'vintage', 'modern', 'minimalist', 'colorful'
    ];
    
    // Sample confidence score ranges for different pattern types
    this.confidenceRanges = {
      highConfidence: { min: 0.85, max: 0.98 },
      mediumConfidence: { min: 0.65, max: 0.84 },
      lowConfidence: { min: 0.35, max: 0.64 },
      uncertain: { min: 0.15, max: 0.34 }
    };
  }

  /**
   * Generate sample image data with realistic metadata
   */
  generateImageData(index, galleryType, confidenceLevel = 'highConfidence') {
    const confidence = this.generateConfidenceScore(confidenceLevel);
    const width = this.getRandomDimension(200, 1920);
    const height = this.getRandomDimension(200, 1080);
    const format = this.getRandomFormat();
    const category = this.getRandomCategory();
    
    const imageData = {
      id: `sample_${galleryType}_${index}`,
      url: this.generateImageUrl(width, height, category, format),
      filename: `${galleryType}_image_${String(index).padStart(3, '0')}.${format}`,
      title: this.generateImageTitle(category, index),
      altText: this.generateAltText(category),
      description: this.generateDescription(category),
      width: width,
      height: height,
      format: format,
      size: this.estimateFileSize(width, height, format),
      category: category,
      tags: this.generateTags(category),
      confidence: confidence,
      patternType: this.getPatternType(confidence),
      metadata: {
        discovered: Date.now(),
        selector: this.generateSelector(galleryType),
        parentElement: this.generateParentSelector(galleryType),
        loadMethod: this.getLoadMethod(confidenceLevel),
        validated: confidence > 0.7,
        duplicateOf: index > 15 && Math.random() < 0.1 ? `sample_${galleryType}_${Math.floor(Math.random() * 15)}` : null
      },
      performance: {
        discoveryTime: Math.random() * 100 + 10,
        validationTime: Math.random() * 50 + 5,
        downloadTime: null,
        retryCount: confidence < 0.5 ? Math.floor(Math.random() * 3) : 0
      },
      source: {
        domain: this.getRandomDomain(),
        page: this.generatePageUrl(galleryType),
        galleryType: galleryType,
        position: index,
        isLazyLoaded: Math.random() < 0.3,
        hasDataSrc: Math.random() < 0.4
      }
    };

    // Add occasional incomplete data for testing
    if (Math.random() < 0.15) {
      imageData.title = imageData.title || 'Untitled';
      imageData.altText = '';
      imageData.description = '';
      imageData.confidence *= 0.8; // Lower confidence for incomplete data
    }

    // Add error simulation for some items
    if (Math.random() < 0.05) {
      imageData.error = {
        type: this.getRandomError(),
        message: 'Sample error for testing error handling',
        timestamp: Date.now(),
        recoverable: Math.random() < 0.7
      };
      imageData.confidence *= 0.5;
    }

    return imageData;
  }

  /**
   * Gallery Type Definitions with Pattern Recognition
   */
  getGalleryTypes() {
    return {
      basicGrid: {
        name: 'Basic Grid Gallery',
        description: 'Simple CSS grid layout with uniform image sizes',
        pattern: 'Regular grid pattern with consistent spacing',
        confidence: 'highConfidence',
        sampleCount: 24,
        characteristics: {
          layout: 'grid',
          uniformSize: true,
          lazyLoading: false,
          infiniteScroll: false,
          selectors: ['.gallery-grid img', '.image-grid .item img', '.photo-grid img']
        }
      },
      
      masonryLayout: {
        name: 'Masonry Gallery',
        description: 'Pinterest-style masonry layout with varying image heights',
        pattern: 'Masonry grid with variable aspect ratios',
        confidence: 'mediumConfidence',
        sampleCount: 18,
        characteristics: {
          layout: 'masonry',
          uniformSize: false,
          lazyLoading: true,
          infiniteScroll: true,
          selectors: ['.masonry-grid img', '.masonry .item img', '.pinterest-style img']
        }
      },
      
      carousel: {
        name: 'Image Carousel',
        description: 'Horizontal scrolling image carousel with navigation',
        pattern: 'Linear carousel with slide transitions',
        confidence: 'mediumConfidence',
        sampleCount: 12,
        characteristics: {
          layout: 'carousel',
          uniformSize: true,
          lazyLoading: true,
          infiniteScroll: false,
          selectors: ['.carousel img', '.slider .slide img', '.swiper-slide img']
        }
      },
      
      productGallery: {
        name: 'E-commerce Product Gallery',
        description: 'Product images with thumbnails and zoom functionality',
        pattern: 'Product showcase with primary and thumbnail images',
        confidence: 'highConfidence',
        sampleCount: 15,
        characteristics: {
          layout: 'product',
          uniformSize: false,
          lazyLoading: true,
          infiniteScroll: false,
          selectors: ['.product-images img', '.product-gallery img', '.item-photos img']
        }
      },
      
      portfolioGrid: {
        name: 'Photography Portfolio',
        description: 'Professional photography portfolio with metadata',
        pattern: 'Portfolio grid with detailed image information',
        confidence: 'highConfidence',
        sampleCount: 21,
        characteristics: {
          layout: 'portfolio',
          uniformSize: false,
          lazyLoading: true,
          infiniteScroll: true,
          selectors: ['.portfolio img', '.photo-portfolio img', '.gallery-portfolio img']
        }
      },
      
      socialFeed: {
        name: 'Social Media Feed',
        description: 'Social media style image feed with user interactions',
        pattern: 'Feed layout with social engagement elements',
        confidence: 'lowConfidence',
        sampleCount: 30,
        characteristics: {
          layout: 'feed',
          uniformSize: false,
          lazyLoading: true,
          infiniteScroll: true,
          selectors: ['.feed img', '.social-feed img', '.post img']
        }
      },
      
      mixedContent: {
        name: 'Mixed Content Gallery',
        description: 'Gallery with various content types and layouts',
        pattern: 'Complex mixed layout with multiple patterns',
        confidence: 'uncertain',
        sampleCount: 27,
        characteristics: {
          layout: 'mixed',
          uniformSize: false,
          lazyLoading: true,
          infiniteScroll: true,
          selectors: ['.content img', '.mixed-gallery img', '.flexible-grid img']
        }
      },
      
      lightboxGallery: {
        name: 'Lightbox Gallery',
        description: 'Thumbnail grid with lightbox popup functionality',
        pattern: 'Thumbnail grid with modal preview system',
        confidence: 'highConfidence',
        sampleCount: 16,
        characteristics: {
          layout: 'lightbox',
          uniformSize: true,
          lazyLoading: false,
          infiniteScroll: false,
          selectors: ['.lightbox-gallery img', '.thumbnail-gallery img', '.modal-gallery img']
        }
      }
    };
  }

  /**
   * Generate complete sample data for a specific gallery type
   */
  generateGalleryData(galleryType) {
    const galleryConfig = this.getGalleryTypes()[galleryType];
    if (!galleryConfig) {
      throw new Error(`Unknown gallery type: ${galleryType}`);
    }

    const images = [];
    const { sampleCount, confidence } = galleryConfig;

    for (let i = 1; i <= sampleCount; i++) {
      // Vary confidence levels for realistic distribution
      let confidenceLevel = confidence;
      if (i % 5 === 0) confidenceLevel = 'mediumConfidence';
      if (i % 8 === 0) confidenceLevel = 'lowConfidence';
      if (i % 12 === 0) confidenceLevel = 'uncertain';

      images.push(this.generateImageData(i, galleryType, confidenceLevel));
    }

    // Generate summary statistics
    const stats = this.generateStats(images);
    
    // Generate pattern recognition results
    const patterns = this.generatePatternRecognition(galleryType, galleryConfig, images);

    return {
      galleryType,
      config: galleryConfig,
      images,
      stats,
      patterns,
      metadata: {
        generated: this.generated,
        version: this.version,
        totalImages: images.length,
        sampleId: `sample_${galleryType}_${Date.now()}`
      }
    };
  }

  /**
   * Generate all sample gallery types
   */
  generateAllSampleData() {
    const galleryTypes = Object.keys(this.getGalleryTypes());
    const allSampleData = {};

    for (const galleryType of galleryTypes) {
      allSampleData[galleryType] = this.generateGalleryData(galleryType);
    }

    // Generate combined statistics
    const combinedStats = this.generateCombinedStats(allSampleData);

    return {
      version: this.version,
      generated: this.generated,
      galleryTypes: galleryTypes,
      galleries: allSampleData,
      combinedStats,
      metadata: {
        totalGalleries: galleryTypes.length,
        totalImages: combinedStats.totalImages,
        averageConfidence: combinedStats.averageConfidence,
        patternDistribution: combinedStats.patternDistribution
      }
    };
  }

  /**
   * Generate realistic confidence scores
   */
  generateConfidenceScore(level) {
    const range = this.confidenceRanges[level] || this.confidenceRanges.mediumConfidence;
    return Math.random() * (range.max - range.min) + range.min;
  }

  /**
   * Generate realistic image URLs
   */
  generateImageUrl(width, height, category, format) {
    const service = Object.keys(this.imageServices)[Math.floor(Math.random() * Object.keys(this.imageServices).length)];
    const baseUrl = this.imageServices[service];
    
    switch (service) {
      case 'picsum':
        return `${baseUrl}/${width}/${height}?random=${this.sampleCount++}`;
      case 'placeholder':
        return `${baseUrl}/${width}x${height}/667eea/ffffff?text=${encodeURIComponent(category)}`;
      case 'unsplash':
        return `${baseUrl}/${width}x${height}/?${category},${this.sampleCount++}`;
      default:
        return `${baseUrl}/${width}/${height}`;
    }
  }

  /**
   * Generate pattern recognition results
   */
  generatePatternRecognition(galleryType, config, images) {
    const patterns = {
      detected: true,
      confidence: this.calculateAverageConfidence(images),
      layoutType: config.characteristics.layout,
      selectors: {
        primary: config.characteristics.selectors[0],
        alternatives: config.characteristics.selectors.slice(1),
        confidence: Math.random() * 0.3 + 0.7
      },
      characteristics: {
        uniformSize: config.characteristics.uniformSize,
        lazyLoading: {
          detected: config.characteristics.lazyLoading,
          percentage: config.characteristics.lazyLoading ? Math.random() * 0.5 + 0.3 : 0
        },
        infiniteScroll: {
          detected: config.characteristics.infiniteScroll,
          loadThreshold: config.characteristics.infiniteScroll ? Math.random() * 200 + 100 : null
        }
      },
      performance: {
        recognitionTime: Math.random() * 200 + 50,
        validationTime: Math.random() * 100 + 25,
        accuracy: Math.random() * 0.2 + 0.8
      },
      recommendations: this.generateRecommendations(galleryType, config)
    };

    return patterns;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(galleryType, config) {
    const recommendations = [];
    
    if (config.characteristics.lazyLoading) {
      recommendations.push({
        type: 'performance',
        message: 'Lazy loading detected - consider scroll-based discovery',
        priority: 'medium'
      });
    }
    
    if (config.characteristics.infiniteScroll) {
      recommendations.push({
        type: 'strategy',
        message: 'Infinite scroll detected - enable progressive scanning',
        priority: 'high'
      });
    }
    
    if (config.characteristics.layout === 'masonry') {
      recommendations.push({
        type: 'technical',
        message: 'Masonry layout - wait for all images to load before calculating positions',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Generate realistic statistics
   */
  generateStats(images) {
    const confidenceScores = images.map(img => img.confidence);
    const sizes = images.map(img => img.size);
    const formats = images.reduce((acc, img) => {
      acc[img.format] = (acc[img.format] || 0) + 1;
      return acc;
    }, {});

    return {
      totalImages: images.length,
      averageConfidence: this.calculateAverageConfidence(images),
      confidenceDistribution: {
        high: confidenceScores.filter(c => c > 0.8).length,
        medium: confidenceScores.filter(c => c > 0.6 && c <= 0.8).length,
        low: confidenceScores.filter(c => c <= 0.6).length
      },
      sizeStats: {
        totalSize: sizes.reduce((a, b) => a + b, 0),
        averageSize: sizes.reduce((a, b) => a + b, 0) / sizes.length,
        minSize: Math.min(...sizes),
        maxSize: Math.max(...sizes)
      },
      formatDistribution: formats,
      completenessScore: this.calculateCompletenessScore(images),
      estimatedDownloadTime: this.estimateDownloadTime(images),
      duplicateCount: images.filter(img => img.metadata.duplicateOf).length,
      errorCount: images.filter(img => img.error).length
    };
  }

  /**
   * Generate combined statistics for all galleries
   */
  generateCombinedStats(allSampleData) {
    const allImages = Object.values(allSampleData).flatMap(gallery => gallery.images);
    const galleryStats = Object.values(allSampleData).map(gallery => gallery.stats);

    return {
      totalImages: allImages.length,
      averageConfidence: this.calculateAverageConfidence(allImages),
      patternDistribution: this.calculatePatternDistribution(allSampleData),
      performanceMetrics: this.calculatePerformanceMetrics(allSampleData),
      qualityMetrics: this.calculateQualityMetrics(allImages),
      recommendedSettings: this.generateRecommendedSettings(allSampleData)
    };
  }

  /**
   * Helper methods for generating realistic data
   */
  getRandomDimension(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  }

  getRandomFormat() {
    const formats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    return formats[Math.floor(Math.random() * formats.length)];
  }

  getRandomCategory() {
    return this.categories[Math.floor(Math.random() * this.categories.length)];
  }

  getRandomDomain() {
    return this.sampleDomains[Math.floor(Math.random() * this.sampleDomains.length)];
  }

  generateImageTitle(category, index) {
    const titles = {
      nature: ['Beautiful Landscape', 'Scenic View', 'Natural Wonder', 'Peaceful Scene'],
      architecture: ['Modern Building', 'Historic Structure', 'Urban Design', 'Architectural Detail'],
      technology: ['Tech Innovation', 'Digital Solution', 'Modern Interface', 'Technical Excellence'],
      people: ['Portrait Study', 'Human Connection', 'Lifestyle Moment', 'Professional Portrait'],
      animals: ['Wildlife Photography', 'Animal Portrait', 'Nature Companion', 'Wildlife Scene']
    };
    
    const categoryTitles = titles[category] || ['Sample Image', 'Gallery Item', 'Featured Photo', 'Collection Item'];
    const title = categoryTitles[Math.floor(Math.random() * categoryTitles.length)];
    return `${title} ${index}`;
  }

  generateAltText(category) {
    const altTexts = {
      nature: 'A beautiful natural landscape scene',
      architecture: 'An architectural structure or building detail',
      technology: 'Technology or digital interface element',
      people: 'Portrait or lifestyle photography',
      animals: 'Wildlife or animal photography'
    };
    
    return altTexts[category] || 'Sample image for gallery demonstration';
  }

  generateDescription(category) {
    if (Math.random() < 0.3) return ''; // Some images have no description
    
    const descriptions = {
      nature: 'Stunning natural scenery captured in high resolution, showcasing the beauty of the outdoors.',
      architecture: 'Architectural photography highlighting design elements and structural beauty.',
      technology: 'Technology-focused imagery demonstrating innovation and modern solutions.',
      people: 'Portrait photography capturing human emotion and professional presentation.',
      animals: 'Wildlife photography showcasing animals in their natural environment.'
    };
    
    return descriptions[category] || 'Sample image description for demonstration purposes.';
  }

  generateTags(category) {
    const allTags = {
      nature: ['landscape', 'outdoor', 'scenic', 'natural', 'environment'],
      architecture: ['building', 'design', 'structure', 'urban', 'modern'],
      technology: ['tech', 'digital', 'innovation', 'modern', 'interface'],
      people: ['portrait', 'human', 'lifestyle', 'professional', 'social'],
      animals: ['wildlife', 'nature', 'animal', 'outdoor', 'photography']
    };
    
    const categoryTags = allTags[category] || ['sample', 'demo', 'test'];
    const numTags = Math.floor(Math.random() * 3) + 1;
    return categoryTags.slice(0, numTags);
  }

  generateSelector(galleryType) {
    const selectors = {
      basicGrid: '.gallery-grid img',
      masonryLayout: '.masonry-grid .item img',
      carousel: '.carousel-slide img',
      productGallery: '.product-images img',
      portfolioGrid: '.portfolio-item img',
      socialFeed: '.feed-item img',
      mixedContent: '.content-item img',
      lightboxGallery: '.thumbnail img'
    };
    
    return selectors[galleryType] || '.gallery img';
  }

  generateParentSelector(galleryType) {
    const parents = {
      basicGrid: '.gallery-grid',
      masonryLayout: '.masonry-container',
      carousel: '.carousel-container',
      productGallery: '.product-gallery',
      portfolioGrid: '.portfolio-grid',
      socialFeed: '.social-feed',
      mixedContent: '.content-grid',
      lightboxGallery: '.lightbox-gallery'
    };
    
    return parents[galleryType] || '.gallery-container';
  }

  generatePageUrl(galleryType) {
    return `https://${this.getRandomDomain()}/gallery/${galleryType}`;
  }

  getPatternType(confidence) {
    if (confidence > 0.85) return 'high_confidence';
    if (confidence > 0.65) return 'medium_confidence';
    if (confidence > 0.35) return 'low_confidence';
    return 'uncertain';
  }

  getLoadMethod(confidenceLevel) {
    const methods = {
      highConfidence: 'direct',
      mediumConfidence: Math.random() < 0.5 ? 'lazy' : 'direct',
      lowConfidence: 'lazy',
      uncertain: 'dynamic'
    };
    
    return methods[confidenceLevel] || 'direct';
  }

  getRandomError() {
    const errors = [
      'network_timeout',
      'invalid_url',
      'access_denied',
      'rate_limited',
      'server_error',
      'malformed_data'
    ];
    
    return errors[Math.floor(Math.random() * errors.length)];
  }

  estimateFileSize(width, height, format) {
    const baseSize = width * height * 3; // Base RGB size
    const compressionRates = { jpg: 0.1, jpeg: 0.1, png: 0.5, webp: 0.08, gif: 0.3 };
    const rate = compressionRates[format] || 0.2;
    return Math.floor(baseSize * rate);
  }

  calculateAverageConfidence(images) {
    if (images.length === 0) return 0;
    return images.reduce((sum, img) => sum + img.confidence, 0) / images.length;
  }

  calculateCompletenessScore(images) {
    const completeFields = ['title', 'altText', 'description'];
    let totalFieldCount = 0;
    let completeFieldCount = 0;
    
    images.forEach(img => {
      completeFields.forEach(field => {
        totalFieldCount++;
        if (img[field] && img[field].trim()) {
          completeFieldCount++;
        }
      });
    });
    
    return totalFieldCount > 0 ? completeFieldCount / totalFieldCount : 0;
  }

  estimateDownloadTime(images) {
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const estimatedSpeed = 1024 * 1024; // 1MB/s average
    return Math.ceil(totalSize / estimatedSpeed);
  }

  calculatePatternDistribution(allSampleData) {
    const distribution = {};
    Object.entries(allSampleData).forEach(([type, data]) => {
      distribution[type] = {
        imageCount: data.images.length,
        averageConfidence: data.stats.averageConfidence,
        layoutType: data.config.characteristics.layout
      };
    });
    return distribution;
  }

  calculatePerformanceMetrics(allSampleData) {
    const allImages = Object.values(allSampleData).flatMap(gallery => gallery.images);
    const discoveryTimes = allImages.map(img => img.performance.discoveryTime);
    const validationTimes = allImages.map(img => img.performance.validationTime);
    
    return {
      averageDiscoveryTime: discoveryTimes.reduce((a, b) => a + b, 0) / discoveryTimes.length,
      averageValidationTime: validationTimes.reduce((a, b) => a + b, 0) / validationTimes.length,
      totalProcessingTime: discoveryTimes.reduce((a, b) => a + b, 0) + validationTimes.reduce((a, b) => a + b, 0),
      efficiency: this.calculateEfficiencyScore(allImages)
    };
  }

  calculateQualityMetrics(images) {
    const qualityFactors = {
      hasTitle: images.filter(img => img.title && img.title.trim()).length / images.length,
      hasAltText: images.filter(img => img.altText && img.altText.trim()).length / images.length,
      hasDescription: images.filter(img => img.description && img.description.trim()).length / images.length,
      highConfidence: images.filter(img => img.confidence > 0.8).length / images.length,
      noErrors: images.filter(img => !img.error).length / images.length
    };
    
    return {
      ...qualityFactors,
      overallQuality: Object.values(qualityFactors).reduce((a, b) => a + b, 0) / Object.keys(qualityFactors).length
    };
  }

  calculateEfficiencyScore(images) {
    const totalTime = images.reduce((sum, img) => sum + img.performance.discoveryTime + img.performance.validationTime, 0);
    const successfulImages = images.filter(img => !img.error).length;
    return successfulImages / (totalTime / 1000); // Images per second
  }

  generateRecommendedSettings(allSampleData) {
    const allImages = Object.values(allSampleData).flatMap(gallery => gallery.images);
    const avgConfidence = this.calculateAverageConfidence(allImages);
    const errorRate = allImages.filter(img => img.error).length / allImages.length;
    
    return {
      confidenceThreshold: Math.max(0.3, avgConfidence - 0.2),
      retryAttempts: errorRate > 0.1 ? 3 : 2,
      concurrency: errorRate > 0.05 ? 2 : 3,
      downloadDelay: errorRate > 0.1 ? 200 : 100,
      skipDuplicates: true,
      enableLazyLoading: true,
      enableInfiniteScroll: true
    };
  }
}

/**
 * Demo Mode Manager
 * Handles demo mode state and sample data loading
 */
class DemoModeManager {
  constructor() {
    this.isDemo = false;
    this.currentSampleData = null;
    this.sampleDataGenerator = new SampleDataGenerator();
    this.loadedGalleryType = null;
    this.demoStartTime = null;
    this.demoStats = {
      totalSessions: 0,
      averageSessionTime: 0,
      mostUsedGallery: null,
      exportCount: 0
    };
  }

  /**
   * Initialize demo mode
   */
  async initializeDemoMode() {
    console.log('🎭 Initializing Demo Mode...');
    this.isDemo = true;
    this.demoStartTime = Date.now();
    
    // Load demo statistics
    await this.loadDemoStats();
    
    console.log('✅ Demo Mode initialized');
    return true;
  }

  /**
   * Load sample data for specific gallery type
   */
  async loadSampleData(galleryType = 'basicGrid') {
    console.log(`📊 Loading sample data for gallery type: ${galleryType}`);
    
    try {
      this.currentSampleData = this.sampleDataGenerator.generateGalleryData(galleryType);
      this.loadedGalleryType = galleryType;
      
      // Update demo stats
      this.updateDemoStats('galleryLoaded', galleryType);
      
      console.log(`✅ Sample data loaded: ${this.currentSampleData.images.length} images`);
      return this.currentSampleData;
    } catch (error) {
      console.error('❌ Failed to load sample data:', error);
      throw error;
    }
  }

  /**
   * Load all sample data
   */
  async loadAllSampleData() {
    console.log('📊 Loading all sample gallery data...');
    
    try {
      const allSampleData = this.sampleDataGenerator.generateAllSampleData();
      this.currentSampleData = allSampleData;
      this.loadedGalleryType = 'all';
      
      // Update demo stats
      this.updateDemoStats('allGalleriesLoaded');
      
      console.log(`✅ All sample data loaded: ${allSampleData.metadata.totalImages} total images`);
      return allSampleData;
    } catch (error) {
      console.error('❌ Failed to load all sample data:', error);
      throw error;
    }
  }

  /**
   * Get available gallery types
   */
  getAvailableGalleryTypes() {
    return this.sampleDataGenerator.getGalleryTypes();
  }

  /**
   * Export sample data in specified format
   */
  async exportSampleData(format = 'csv', galleryType = null) {
    if (!this.currentSampleData) {
      throw new Error('No sample data loaded. Load sample data first.');
    }

    console.log(`📤 Exporting sample data in ${format} format...`);
    
    try {
      let dataToExport;
      
      if (galleryType && this.currentSampleData.galleries) {
        dataToExport = this.currentSampleData.galleries[galleryType];
      } else if (this.currentSampleData.images) {
        dataToExport = this.currentSampleData;
      } else {
        dataToExport = this.currentSampleData;
      }

      // Update demo stats
      this.updateDemoStats('dataExported', format);

      console.log(`✅ Sample data export prepared in ${format} format`);
      return {
        format,
        data: dataToExport,
        filename: `sample_gallery_${galleryType || 'all'}_${Date.now()}.${format}`,
        size: this.estimateExportSize(dataToExport, format),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Failed to export sample data:', error);
      throw error;
    }
  }

  /**
   * Simulate scraping progress for demo purposes
   */
  async simulateScrapingProgress(progressCallback, totalImages = null) {
    const imagesToProcess = totalImages || 
      (this.currentSampleData?.images?.length || 
       this.currentSampleData?.metadata?.totalImages || 20);
    
    console.log(`🎭 Simulating scraping progress for ${imagesToProcess} images...`);
    
    for (let i = 0; i < imagesToProcess; i++) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
      
      const progress = {
        completed: i + 1,
        total: imagesToProcess,
        percentage: Math.round(((i + 1) / imagesToProcess) * 100),
        currentImage: this.currentSampleData?.images?.[i] || { filename: `sample_image_${i + 1}.jpg` },
        estimatedTimeRemaining: Math.max(0, (imagesToProcess - i - 1) * 150)
      };
      
      if (progressCallback) {
        progressCallback(progress);
      }
    }
    
    console.log('✅ Demo scraping simulation completed');
    this.updateDemoStats('simulationCompleted');
  }

  /**
   * Update demo statistics
   */
  updateDemoStats(action, data = null) {
    switch (action) {
      case 'galleryLoaded':
        this.demoStats.mostUsedGallery = data;
        break;
      case 'dataExported':
        this.demoStats.exportCount++;
        break;
      case 'simulationCompleted':
        this.demoStats.totalSessions++;
        if (this.demoStartTime) {
          const sessionTime = Date.now() - this.demoStartTime;
          this.demoStats.averageSessionTime = 
            (this.demoStats.averageSessionTime * (this.demoStats.totalSessions - 1) + sessionTime) / 
            this.demoStats.totalSessions;
        }
        break;
    }
    
    this.saveDemoStats();
  }

  /**
   * Load demo statistics from storage
   */
  async loadDemoStats() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['demoStats']);
        if (result.demoStats) {
          this.demoStats = { ...this.demoStats, ...result.demoStats };
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load demo stats:', error);
    }
  }

  /**
   * Save demo statistics to storage
   */
  async saveDemoStats() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ demoStats: this.demoStats });
      }
    } catch (error) {
      console.warn('⚠️ Could not save demo stats:', error);
    }
  }

  /**
   * Estimate export file size
   */
  estimateExportSize(data, format) {
    const baseSize = JSON.stringify(data).length;
    const multipliers = { csv: 0.7, xlsx: 1.5, json: 1.0 };
    return Math.floor(baseSize * (multipliers[format] || 1.0));
  }

  /**
   * Get demo mode status
   */
  getDemoStatus() {
    return {
      isDemo: this.isDemo,
      currentSampleData: this.currentSampleData !== null,
      loadedGalleryType: this.loadedGalleryType,
      stats: this.demoStats,
      sessionTime: this.demoStartTime ? Date.now() - this.demoStartTime : 0,
      availableGalleries: Object.keys(this.sampleDataGenerator.getGalleryTypes())
    };
  }

  /**
   * Reset demo mode
   */
  resetDemoMode() {
    console.log('🔄 Resetting demo mode...');
    this.currentSampleData = null;
    this.loadedGalleryType = null;
    this.demoStartTime = Date.now();
    console.log('✅ Demo mode reset');
  }

  /**
   * Exit demo mode
   */
  exitDemoMode() {
    console.log('🚪 Exiting demo mode...');
    this.isDemo = false;
    this.currentSampleData = null;
    this.loadedGalleryType = null;
    this.demoStartTime = null;
    console.log('✅ Demo mode exited');
  }
}

// Global instances for use throughout the extension
if (typeof window !== 'undefined') {
  window.SampleDataGenerator = SampleDataGenerator;
  window.DemoModeManager = DemoModeManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SampleDataGenerator, DemoModeManager };
}

console.log('✅ Sample Data System loaded successfully');