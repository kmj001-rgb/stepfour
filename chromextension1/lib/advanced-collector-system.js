/**
 * Advanced Collector System - Enhanced Implementation
 * Provides comprehensive image collection functionality for the Chrome extension
 */

class AdvancedCollectorSystem {
  constructor(options = {}) {
    this.options = {
      concurrency: options.concurrency || 5,
      timeout: options.timeout || 30000,
      batchSize: options.batchSize || 100,
      maxDocuments: options.maxDocuments || 10,
      maxDepth: options.maxDepth || 2,
      minImageSize: options.minImageSize || 100,
      supportedFormats: options.supportedFormats || ["jpg", "jpeg", "png", "gif", "webp", "svg"],
      stripQueryParams: options.stripQueryParams !== undefined ? options.stripQueryParams : false,
      ...options
    };

    this.feeds = {
      high_confidence: [],
      same_origin: [],
      external: [],
      pending: []
    };

    this.processed = [];
    this.cache = new Set();
    this.urlCache = new Set();
    
    this.metrics = {
      totalFound: 0,
      categorized: 0,
      validated: 0,
      duplicates: 0,
      errors: 0,
      processingTime: 0
    };
  }

  async collectImages(options = {}) {
    const startTime = performance.now();
    
    try {
      console.log('🔍 Advanced Collector: Starting comprehensive image collection...');
      const images = [];
      
      this._collectFromImgSrc(images);
      this._collectFromImgSrcset(images);
      this._collectFromLazyLoading(images);
      this._collectFromBackgroundImages(images);
      this._collectFromPictureElements(images);
      this._collectFromSvgImages(images);
      this._collectFromImageLinks(images);
      
      this.metrics.totalFound = images.length;
      this.metrics.processingTime = performance.now() - startTime;
      
      console.log(`✅ Advanced Collector: Found ${images.length} images in ${this.metrics.processingTime.toFixed(2)}ms`);
      console.log(`   - High confidence: ${this.feeds.high_confidence.length}`);
      console.log(`   - Same origin: ${this.feeds.same_origin.length}`);
      console.log(`   - External: ${this.feeds.external.length}`);
      
      return images;
    } catch (error) {
      console.error('❌ Advanced Collector error:', error);
      this.metrics.errors++;
      this.metrics.processingTime = performance.now() - startTime;
      return [];
    }
  }

  _collectFromImgSrc(images) {
    try {
      const imgElements = document.querySelectorAll('img[src]');
      imgElements.forEach(img => {
        try {
          const url = this._normalizeUrl(img.src);
          if (this._validateUrl(url)) {
            const imageData = this._createImageData(url, img, 'img-src');
            if (this._addToCache(imageData)) {
              images.push(imageData);
              this.categorizeImage(imageData);
            }
          }
        } catch (error) {
          this.metrics.errors++;
        }
      });
    } catch (error) {
      console.error('Error collecting from img[src]:', error);
      this.metrics.errors++;
    }
  }

  _collectFromImgSrcset(images) {
    try {
      const imgElements = document.querySelectorAll('img[srcset]');
      imgElements.forEach(img => {
        try {
          const srcset = img.getAttribute('srcset');
          const urls = this._parseSrcset(srcset);
          
          urls.forEach(url => {
            try {
              const normalizedUrl = this._normalizeUrl(url);
              if (this._validateUrl(normalizedUrl)) {
                const imageData = this._createImageData(normalizedUrl, img, 'img-srcset');
                if (this._addToCache(imageData)) {
                  images.push(imageData);
                  this.categorizeImage(imageData);
                }
              }
            } catch (error) {
              this.metrics.errors++;
            }
          });
        } catch (error) {
          this.metrics.errors++;
        }
      });
    } catch (error) {
      console.error('Error collecting from srcset:', error);
      this.metrics.errors++;
    }
  }

  _collectFromLazyLoading(images) {
    try {
      const lazyAttributes = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy'];
      
      lazyAttributes.forEach(attr => {
        try {
          const elements = document.querySelectorAll(`img[${attr}], [${attr}]`);
          elements.forEach(el => {
            try {
              const url = el.getAttribute(attr);
              if (url) {
                const normalizedUrl = this._normalizeUrl(url);
                if (this._validateUrl(normalizedUrl)) {
                  const imageData = this._createImageData(normalizedUrl, el, `lazy-${attr}`);
                  if (this._addToCache(imageData)) {
                    images.push(imageData);
                    this.categorizeImage(imageData);
                  }
                }
              }
            } catch (error) {
              this.metrics.errors++;
            }
          });
        } catch (error) {
          this.metrics.errors++;
        }
      });
    } catch (error) {
      console.error('Error collecting from lazy loading:', error);
      this.metrics.errors++;
    }
  }

  _collectFromBackgroundImages(images) {
    try {
      const elementsWithBg = document.querySelectorAll('[style*="background-image"]');
      elementsWithBg.forEach(el => {
        try {
          const style = el.getAttribute('style');
          const urls = this._extractBackgroundImageUrls(style);
          
          urls.forEach(url => {
            try {
              const normalizedUrl = this._normalizeUrl(url);
              if (this._validateUrl(normalizedUrl)) {
                const imageData = this._createImageData(normalizedUrl, el, 'background-image');
                if (this._addToCache(imageData)) {
                  images.push(imageData);
                  this.categorizeImage(imageData);
                }
              }
            } catch (error) {
              this.metrics.errors++;
            }
          });
        } catch (error) {
          this.metrics.errors++;
        }
      });
    } catch (error) {
      console.error('Error collecting from background images:', error);
      this.metrics.errors++;
    }
  }

  _collectFromPictureElements(images) {
    try {
      const pictureElements = document.querySelectorAll('picture');
      pictureElements.forEach(picture => {
        try {
          const sources = picture.querySelectorAll('source[srcset], source[src]');
          sources.forEach(source => {
            try {
              const srcset = source.getAttribute('srcset');
              const src = source.getAttribute('src');
              
              if (srcset) {
                const urls = this._parseSrcset(srcset);
                urls.forEach(url => {
                  try {
                    const normalizedUrl = this._normalizeUrl(url);
                    if (this._validateUrl(normalizedUrl)) {
                      const imageData = this._createImageData(normalizedUrl, source, 'picture-source');
                      if (this._addToCache(imageData)) {
                        images.push(imageData);
                        this.categorizeImage(imageData);
                      }
                    }
                  } catch (error) {
                    this.metrics.errors++;
                  }
                });
              }
              
              if (src) {
                const normalizedUrl = this._normalizeUrl(src);
                if (this._validateUrl(normalizedUrl)) {
                  const imageData = this._createImageData(normalizedUrl, source, 'picture-source');
                  if (this._addToCache(imageData)) {
                    images.push(imageData);
                    this.categorizeImage(imageData);
                  }
                }
              }
            } catch (error) {
              this.metrics.errors++;
            }
          });
          
          const img = picture.querySelector('img');
          if (img && img.src) {
            try {
              const normalizedUrl = this._normalizeUrl(img.src);
              if (this._validateUrl(normalizedUrl)) {
                const imageData = this._createImageData(normalizedUrl, img, 'picture-img');
                if (this._addToCache(imageData)) {
                  images.push(imageData);
                  this.categorizeImage(imageData);
                }
              }
            } catch (error) {
              this.metrics.errors++;
            }
          }
        } catch (error) {
          this.metrics.errors++;
        }
      });
    } catch (error) {
      console.error('Error collecting from picture elements:', error);
      this.metrics.errors++;
    }
  }

  _collectFromSvgImages(images) {
    try {
      const svgImages = document.querySelectorAll('svg image, svg use');
      svgImages.forEach(svgImg => {
        try {
          const href = svgImg.getAttribute('href') || svgImg.getAttribute('xlink:href');
          if (href) {
            const normalizedUrl = this._normalizeUrl(href);
            if (this._validateUrl(normalizedUrl)) {
              const imageData = this._createImageData(normalizedUrl, svgImg, 'svg-image');
              if (this._addToCache(imageData)) {
                images.push(imageData);
                this.categorizeImage(imageData);
              }
            }
          }
        } catch (error) {
          this.metrics.errors++;
        }
      });
    } catch (error) {
      console.error('Error collecting from SVG images:', error);
      this.metrics.errors++;
    }
  }

  _collectFromImageLinks(images) {
    try {
      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        try {
          const href = link.getAttribute('href');
          if (href && this._isImageUrl(href)) {
            const normalizedUrl = this._normalizeUrl(href);
            if (this._validateUrl(normalizedUrl)) {
              const imageData = this._createImageData(normalizedUrl, link, 'link');
              if (this._addToCache(imageData)) {
                images.push(imageData);
                this.categorizeImage(imageData);
              }
            }
          }
        } catch (error) {
          this.metrics.errors++;
        }
      });
    } catch (error) {
      console.error('Error collecting from image links:', error);
      this.metrics.errors++;
    }
  }

  _parseSrcset(srcset) {
    if (!srcset) return [];
    
    try {
      const urls = [];
      const candidates = srcset.split(',');
      
      candidates.forEach(candidate => {
        const parts = candidate.trim().split(/\s+/);
        if (parts.length > 0 && parts[0]) {
          urls.push(parts[0]);
        }
      });
      
      return urls;
    } catch (error) {
      console.error('Error parsing srcset:', error);
      return [];
    }
  }

  _extractBackgroundImageUrls(styleString) {
    if (!styleString) return [];
    
    try {
      const urls = [];
      const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/gi;
      let match;
      
      while ((match = urlRegex.exec(styleString)) !== null) {
        if (match[1]) {
          urls.push(match[1]);
        }
      }
      
      return urls;
    } catch (error) {
      console.error('Error extracting background image URLs:', error);
      return [];
    }
  }

  _isImageUrl(url) {
    if (!url) return false;
    
    try {
      const urlLower = url.toLowerCase();
      return this.options.supportedFormats.some(format => {
        return urlLower.includes(`.${format}`) || 
               urlLower.includes(`/${format}/`) ||
               urlLower.match(new RegExp(`\\.${format}($|\\?|#)`));
      });
    } catch (error) {
      return false;
    }
  }

  _normalizeUrl(url) {
    if (!url) return null;
    
    try {
      let normalized;
      
      if (url.startsWith('//')) {
        normalized = window.location.protocol + url;
      } else if (url.startsWith('/')) {
        normalized = window.location.origin + url;
      } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
        normalized = new URL(url, window.location.href).href;
      } else {
        normalized = url;
      }
      
      if (this.options.stripQueryParams) {
        try {
          const urlObj = new URL(normalized);
          normalized = urlObj.origin + urlObj.pathname;
        } catch (e) {
        }
      }
      
      return normalized;
    } catch (error) {
      console.error('Error normalizing URL:', error);
      return url;
    }
  }

  _validateUrl(url) {
    if (!url) return false;
    
    try {
      if (url.startsWith('data:')) {
        return false;
      }
      
      const urlObj = new URL(url);
      
      if (!this._isImageUrl(url)) {
        return false;
      }
      
      this.metrics.validated++;
      return true;
    } catch (error) {
      return false;
    }
  }

  _createImageData(url, element, loadingMethod) {
    const imageData = {
      url: url,
      element: element,
      type: loadingMethod,
      metadata: {
        loadingMethod: loadingMethod,
        alt: element.getAttribute ? element.getAttribute('alt') : null,
        title: element.getAttribute ? element.getAttribute('title') : null,
        width: element.width || element.naturalWidth || null,
        height: element.height || element.naturalHeight || null,
        className: element.className || null,
        id: element.id || null
      },
      confidence: 0,
      timestamp: Date.now()
    };
    
    return imageData;
  }

  _addToCache(imageData) {
    if (!imageData || !imageData.url) return false;
    
    if (this.urlCache.has(imageData.url)) {
      this.metrics.duplicates++;
      return false;
    }
    
    this.urlCache.add(imageData.url);
    return true;
  }

  categorizeImage(imageData) {
    if (!imageData || !imageData.url) return null;
    
    try {
      const confidence = this._calculateConfidence(imageData);
      imageData.confidence = confidence;
      
      const url = new URL(imageData.url);
      const isSameOrigin = url.origin === window.location.origin;
      
      if (confidence >= 0.7) {
        this.feeds.high_confidence.push(imageData);
      } else if (isSameOrigin) {
        this.feeds.same_origin.push(imageData);
      } else {
        this.feeds.external.push(imageData);
      }
      
      this.metrics.categorized++;
      return imageData;
    } catch (error) {
      console.error('❌ Categorization error:', error);
      this.metrics.errors++;
      return null;
    }
  }

  _calculateConfidence(imageData) {
    let score = 0.5;
    
    try {
      const url = imageData.url.toLowerCase();
      const metadata = imageData.metadata;
      
      const galleryKeywords = ['gallery', 'photo', 'image', 'img', 'picture', 'pic', 'album'];
      if (galleryKeywords.some(keyword => url.includes(keyword))) {
        score += 0.15;
      }
      
      if (/\d{3,}/.test(url) || /_\d+\.|_\d+$/.test(url)) {
        score += 0.1;
      }
      
      if (metadata.width && metadata.height) {
        const area = metadata.width * metadata.height;
        
        if (area > 500000) {
          score += 0.15;
        } else if (area > 250000) {
          score += 0.1;
        } else if (area < this.options.minImageSize * this.options.minImageSize) {
          score -= 0.2;
        }
      }
      
      if (imageData.element) {
        const element = imageData.element;
        
        const parent = element.parentElement;
        if (parent) {
          const parentClass = parent.className ? parent.className.toLowerCase() : '';
          const parentId = parent.id ? parent.id.toLowerCase() : '';
          
          if (galleryKeywords.some(keyword => 
            parentClass.includes(keyword) || parentId.includes(keyword))) {
            score += 0.15;
          }
        }
        
        if (parent) {
          const siblings = parent.querySelectorAll('img, a[href*=".jpg"], a[href*=".png"]');
          if (siblings.length > 3) {
            score += 0.1;
          }
        }
        
        if (element.tagName === 'A' || element.closest('a')) {
          score += 0.1;
        }
      }
      
      return Math.max(0, Math.min(1, score));
    } catch (error) {
      console.error('Error calculating confidence:', error);
      return 0.5;
    }
  }

  async findGalleryImages(options = {}) {
    return this.collectImages(options);
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.feeds = {
      high_confidence: [],
      same_origin: [],
      external: [],
      pending: []
    };
    this.processed = [];
    this.cache.clear();
    this.urlCache.clear();
    this.metrics = {
      totalFound: 0,
      categorized: 0,
      validated: 0,
      duplicates: 0,
      errors: 0,
      processingTime: 0
    };
  }
}

// Export class using idempotent assignment to avoid redeclaration errors
// This allows the file to be loaded multiple times safely
if (typeof globalThis !== 'undefined') {
  globalThis.AdvancedCollectorSystem = AdvancedCollectorSystem;
  
  // Also export to __ST namespace for content script access
  if (!globalThis.__ST) {
    globalThis.__ST = {};
  }
  globalThis.__ST.AdvancedCollectorSystem = AdvancedCollectorSystem;
}

// Also export to window if available (for browser environments)
if (typeof window !== 'undefined') {
  window.AdvancedCollectorSystem = AdvancedCollectorSystem;
  
  if (!window.__ST) {
    window.__ST = {};
  }
  window.__ST.AdvancedCollectorSystem = AdvancedCollectorSystem;
  
  console.log('✅ AdvancedCollectorSystem loaded and available');
}

// CommonJS export for Node.js/testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedCollectorSystem;
}
