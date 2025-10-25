# Pagination System - Usage Examples

This document provides practical, real-world examples of using the Smart Pagination Detection System.

## Example 1: Basic Product Scraping

Scrape products from an e-commerce site with pagination:

```javascript
async function scrapeProducts() {
  const detector = new PaginationDetector();
  const hasher = new ContentHasher();
  const products = [];
  let page = 1;
  
  while (page <= 50) {
    // Extract products from current page
    const items = Array.from(document.querySelectorAll('.product-item'));
    
    const pageProducts = items.map(item => ({
      title: item.querySelector('h3')?.textContent?.trim(),
      price: item.querySelector('.price')?.textContent?.trim(),
      image: item.querySelector('img')?.src,
      link: item.querySelector('a')?.href
    }));
    
    // Check for duplicates
    const isDup = await hasher.isDuplicate(JSON.stringify(pageProducts));
    if (isDup) {
      console.log('Duplicate page detected, stopping');
      break;
    }
    
    products.push(...pageProducts);
    console.log(`Page ${page}: Found ${pageProducts.length} products`);
    
    // Find next page
    const next = detector.findNextPage();
    if (!next || !next.url) {
      console.log('No more pages');
      break;
    }
    
    // Navigate
    window.location.href = next.url;
    page++;
  }
  
  return products;
}
```

## Example 2: Automated Session with Integration

Use the integration layer for fully automated pagination:

```javascript
async function runAutomatedScraping() {
  const integration = new PaginationIntegration({
    enableFeedback: true,
    maxPages: 100,
    onPageChange: ({ page, url, strategy }) => {
      console.log(`📄 Page ${page}: ${url} (via ${strategy})`);
    },
    onLoopDetected: ({ page }) => {
      console.warn(`🔄 Loop detected at page ${page}`);
    },
    onComplete: (session) => {
      console.log(`✅ Complete! Processed ${session.pagesProcessed} pages`);
      console.log(`📊 Collected ${session.itemsCollected} items`);
      console.log(`⚠️ Loops: ${session.loopsDetected}`);
    }
  });
  
  await integration.initialize();
  
  const result = await integration.startPaginationSession({
    maxPages: 100,
    collectContent: (page) => {
      // Your extraction logic
      return Array.from(document.querySelectorAll('.article')).map(article => ({
        title: article.querySelector('h2')?.textContent,
        date: article.querySelector('.date')?.textContent,
        author: article.querySelector('.author')?.textContent,
        excerpt: article.querySelector('.excerpt')?.textContent
      }));
    }
  });
  
  console.log('Session result:', result);
}
```

## Example 3: Pattern Learning

Let the system learn and reuse pagination patterns:

```javascript
const detector = new PaginationDetector({
  enablePatternLearning: true,
  enableStateManagement: true
});

// Load previous patterns
await detector.loadState();

// First visit - system learns the pattern
// Current URL: https://shop.example.com/products?page=1
const next1 = detector.findNextPage();
// next1.url: https://shop.example.com/products?page=2

// Record navigation for learning
detector.learnUrlPattern(
  'https://shop.example.com/products?page=1',
  'https://shop.example.com/products?page=2'
);

// Save learned pattern
await detector.saveState();

// --- On next visit ---

// System automatically applies learned pattern
const learned = detector.detectWithLearnedPattern();
console.log('Using learned pattern:', learned.url);
// Faster detection without DOM inspection!
```

## Example 4: Performance Optimization

Use performance module for caching and throttling:

```javascript
const perf = new PaginationPerformance({
  cacheEnabled: true,
  cacheDuration: 10000,  // 10 seconds
  throttleEnabled: true
});

const detector = new PaginationDetector();

// Cached detection
const result = perf.optimizeDetection(detector);

// Measure performance
const detection = await perf.measurePerformance('findNextPage', () => {
  return detector.findNextPage();
});

// Get metrics
const metrics = perf.getMetrics();
console.log('Performance metrics:', metrics);
// {
//   detections: 10,
//   cacheHits: 7,
//   cacheMisses: 3,
//   cacheHitRate: '70.00%',
//   avgDetectionTimeMs: '15.43'
// }
```

## Example 5: Memory Monitoring

Monitor memory usage during long sessions:

```javascript
const monitor = new MemoryMonitor({
  enabled: true,
  checkInterval: 30000,  // Check every 30 seconds
  onWarning: (usage) => {
    console.warn(`Memory warning: ${(usage / 1024 / 1024).toFixed(2)}MB`);
    // Maybe clear some caches
  },
  onCritical: (usage) => {
    console.error(`Memory critical: ${(usage / 1024 / 1024).toFixed(2)}MB`);
    // Stop pagination, save data
  }
});

monitor.start();

// ... run pagination ...

// Check memory anytime
const memInfo = monitor.getMemoryInfo();
console.log(`Current memory: ${memInfo.usedMB}MB / ${memInfo.limitMB}MB`);

// Stop monitoring when done
monitor.stop();
```

## Example 6: Error Recovery

Handle errors gracefully with retry logic:

```javascript
async function robustPagination() {
  const integration = new PaginationIntegration({
    maxPages: 100
  });
  
  await integration.initialize();
  
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      const result = await integration.startPaginationSession({
        collectContent: (page) => {
          // Your extraction
          return extractItems();
        }
      });
      
      console.log('Success:', result);
      break;
      
    } catch (error) {
      retries++;
      console.error(`Attempt ${retries} failed:`, error);
      
      if (retries < maxRetries) {
        // Wait before retry
        await new Promise(r => setTimeout(r, 2000));
        
        // Reset state
        await integration.reset();
      } else {
        console.error('Max retries reached');
        throw error;
      }
    }
  }
}
```

## Example 7: Custom Strategy Priority

Override detection strategy priority:

```javascript
const detector = new PaginationDetector();

// Get all strategies
const allResults = detector.detectAllEnhanced();

// Filter for URL-based only
const urlBased = allResults.filter(r => r.paginationType === 'url-based');

// Or prefer specific strategy types
const preferred = allResults.find(r => 
  r.type === 'query-string' || r.type === 'path-based'
);

if (preferred) {
  window.location.href = preferred.url;
}
```

## Example 8: Shadow DOM Handling

Detect pagination in web components:

```javascript
const detector = new PaginationDetector();

// Specifically check Shadow DOM
const shadowResult = detector.detectInShadowDOM();

if (shadowResult) {
  console.log('Found in Shadow DOM');
  console.log('Host element:', shadowResult.shadowHost);
  console.log('Next URL:', shadowResult.url);
  
  // Navigate
  if (shadowResult.element) {
    shadowResult.element.click();
  } else if (shadowResult.url) {
    window.location.href = shadowResult.url;
  }
}
```

## Example 9: Batch Processing

Process multiple pages in batches:

```javascript
const perf = new PaginationPerformance();

async function scrapePage(url) {
  // Scrape a single page
  const response = await fetch(url);
  const html = await response.text();
  return extractDataFromHtml(html);
}

// Create operations for pages 1-50
const operations = [];
for (let i = 1; i <= 50; i++) {
  operations.push(() => scrapePage(`https://example.com/page/${i}`));
}

// Process in batches of 5
const results = await perf.batchProcess(operations, 5);
console.log(`Scraped ${results.length} pages`);
```

## Example 10: State Persistence

Save and restore pagination state across sessions:

```javascript
// Session 1 - Start scraping
const detector = new PaginationDetector({ enableStateManagement: true });
const hasher = new ContentHasher();

// Process pages...
detector.recordNavigation('https://example.com/page/2', { type: 'query-string' });
detector.recordNavigation('https://example.com/page/3', { type: 'query-string' });

// Save state before closing
await detector.saveState();
await hasher.saveToChrome();

// --- Later, in Session 2 ---

// Restore previous state
const detector2 = new PaginationDetector({ enableStateManagement: true });
const hasher2 = new ContentHasher();

await detector2.loadState();
await hasher2.loadFromChrome();

// Resume from where we left off
const state = detector2.getState();
console.log(`Resuming from page ${state.currentPage}`);
console.log(`Already visited ${state.visitedUrls.size} URLs`);
```

## Example 11: Real-time Feedback

Show users what's happening with the feedback UI:

```javascript
const integration = new PaginationIntegration({
  enableFeedback: true,  // Shows overlay
  onPageChange: ({ page, strategy }) => {
    // Update custom UI
    document.querySelector('#progress').textContent = 
      `Processing page ${page} (${strategy})`;
  }
});

await integration.initialize();
// User sees: "🔍 Pagination Detector"
// "✓ Detected: query-string"
// "Confidence: 95%"

await integration.startPaginationSession({...});
```

## Tips & Best Practices

### 1. Always Use Content Hashing
```javascript
// ✅ GOOD
const isDup = await hasher.isDuplicate(content);
if (!isDup) { /* process */ }

// ❌ BAD - Risk of infinite loops
// No duplicate checking
```

### 2. Set Reasonable Limits
```javascript
// ✅ GOOD
const integration = new PaginationIntegration({
  maxPages: 100,  // Prevent runaway pagination
  duplicateCheckLookback: 3
});

// ❌ BAD
const integration = new PaginationIntegration({
  maxPages: Infinity  // Dangerous!
});
```

### 3. Save State Periodically
```javascript
// ✅ GOOD
setInterval(async () => {
  await detector.saveState();
  await hasher.saveToChrome();
}, 60000); // Every minute

// ❌ BAD - State lost on crash
// Never saving state
```

### 4. Handle Navigation Errors
```javascript
// ✅ GOOD
try {
  if (next.url) window.location.href = next.url;
} catch (error) {
  console.error('Navigation failed:', error);
  // Retry or fallback
}

// ❌ BAD - Uncaught errors
window.location.href = next.url; // May throw
```

### 5. Monitor Performance
```javascript
// ✅ GOOD
const perf = new PaginationPerformance();
const metrics = perf.getMetrics();
if (metrics.avgDetectionTimeMs > 100) {
  console.warn('Detection too slow');
}

// ❌ BAD - No performance monitoring
```

---

For more information, see the [Complete Documentation](../docs/PAGINATION_DOCUMENTATION.md).
