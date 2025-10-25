# Smart Pagination Detection System - Complete Documentation

## Overview

The Smart Pagination Detection System is a comprehensive, production-ready solution for detecting and automating pagination across any website. Built with Manifest V3 compliance, it features 10 detection strategies, content hashing for loop prevention, Shadow DOM support, pattern learning, and automated workflows.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Modules](#modules)
4. [Detection Strategies](#detection-strategies)
5. [Usage Examples](#usage-examples)
6. [API Reference](#api-reference)
7. [Configuration](#configuration)
8. [Performance](#performance)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Quick Start

### Basic Detection

```javascript
// Create a detector instance
const detector = new PaginationDetector();

// Detect pagination on current page
const nextPage = detector.findNextPage();

if (nextPage) {
  console.log(`Next page found: ${nextPage.url}`);
  console.log(`Detection type: ${nextPage.type}`);
  console.log(`Confidence: ${nextPage.confidence}`);
}
```

### With Content Hashing (Loop Prevention)

```javascript
// Initialize both detector and hasher
const detector = new PaginationDetector();
const hasher = new ContentHasher();

// Get page content
const content = document.body.innerHTML;

// Check for duplicate
const isDuplicate = await hasher.isDuplicate(content);

if (isDuplicate) {
  console.log('Loop detected! Stopping pagination.');
} else {
  // Safe to continue
  const nextPage = detector.findNextPage();
}
```

### Full Integration (Automated Sessions)

```javascript
// Use the integration layer for complete automation
const integration = new PaginationIntegration({
  enableFeedback: true,  // Show UI feedback
  maxPages: 100          // Safety limit
});

// Initialize
await integration.initialize();

// Start automated session
await integration.startPaginationSession({
  collectContent: (pageNum) => {
    // Extract your content here
    return Array.from(document.querySelectorAll('.item'));
  }
});

// Get session stats
const status = integration.getStatus();
console.log(`Processed ${status.session.pagesProcessed} pages`);
```

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────┐
│         PaginationIntegration (Phase 4)             │
│  • Session management                               │
│  • UI feedback                                      │
│  • Error recovery                                   │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
       ┌───────▼────────┐    ┌───────▼────────┐
       │ PaginationDet  │    │ ContentHasher  │
       │    (Phase 1-3) │    │    (Phase 2)   │
       │                │    │                │
       │ • 10 strategies│    │ • SHA-256      │
       │ • Shadow DOM   │    │ • Duplicates   │
       │ • Learning     │    │ • Memory mgmt  │
       └────────────────┘    └────────────────┘
```

### Data Flow

1. **Detection**: PaginationDetector scans page using 10 strategies
2. **Validation**: ContentHasher checks for duplicate content
3. **Learning**: Successful patterns are stored for future use
4. **Navigation**: Integration layer handles page transitions
5. **Feedback**: UI overlay shows real-time status

---

## Modules

### 1. PaginationDetector (lib/pagination-detector.js)

**Purpose**: Multi-strategy pagination detection with learning capabilities

**Key Features**:
- 10 detection strategies with confidence scoring
- Shadow DOM support
- URL pattern learning (7-day memory)
- State management
- Failed strategy filtering

**File Size**: 1,325 lines
**Version**: 3.0.0

### 2. ContentHasher (lib/content-hasher.js)

**Purpose**: SHA-256 content hashing for duplicate detection

**Key Features**:
- Fast hashing using Web Crypto API (<1ms typical)
- Memory-bounded storage (configurable, default 1000)
- Recent duplicate detection with lookback
- Storage persistence (localStorage & chrome.storage)
- Statistics and monitoring

**File Size**: 330 lines
**Version**: 1.0.0

### 3. PaginationIntegration (lib/pagination-integration.js)

**Purpose**: Integration layer connecting all components

**Key Features**:
- Automated pagination sessions
- User feedback UI
- Error recovery
- Event callbacks
- Comprehensive configuration

**File Size**: 460 lines
**Version**: 1.0.0

---

## Detection Strategies

The system uses 10 different strategies, executed in order of confidence:

| # | Strategy | Confidence | Type | Phase |
|---|----------|-----------|------|-------|
| 1 | Learned Pattern | 0.93 | url-based | 3 |
| 2 | rel="next" | 1.0 | url-based | 1 |
| 3 | Numbered Pagination | 0.95 | url-based | 1 |
| 4 | Query String | 0.85-0.95 | url-based | 1 |
| 5 | Path-Based | 0.90-0.92 | url-based | 1 |
| 6 | Text Content | 0.9 | mixed | 1 |
| 7 | Shadow DOM | 0.88-0.90 | mixed | 3 |
| 8 | ARIA Labels | 0.85 | mixed | 1 |
| 9 | Class/ID | 0.8 | mixed | 1 |
| 10 | Infinite Scroll | 0.7 | ajax-based | 1 |

---

## Performance

### Benchmarks

| Operation | Time | Memory |
|-----------|------|--------|
| Basic Detection | <10ms | ~10KB |
| Shadow DOM Scan | <50ms | ~20KB |
| Content Hashing | <1ms | ~64B per hash |
| Pattern Learning | <1ms | ~200B per pattern |
| Full Detection (10 strategies) | <100ms | ~50KB |

### Optimization Tips

1. **Use Learned Patterns**: After first visit, learned patterns are fastest
2. **Disable Unused Features**: Turn off pattern learning if not needed
3. **Limit History Size**: Reduce `maxHistorySize` for lower memory
4. **Cache Detection Results**: Reuse results within same page
5. **Disable UI Feedback**: Set `enableFeedback: false` for production

---

## Best Practices

### 1. Always Check for Duplicates

```javascript
// GOOD
const isDup = await hasher.isDuplicate(content);
if (!isDup) {
  // Process page
}
```

### 2. Use Integration Layer for Complex Workflows

```javascript
const integration = new PaginationIntegration();
await integration.startPaginationSession({...});
```

### 3. Handle Errors Gracefully

```javascript
try {
  const next = detector.findNextPage();
  if (next && next.url) {
    window.location.href = next.url;
  }
} catch (error) {
  console.error('Detection failed:', error);
}
```

---

**Version**: 1.0.0 (Phase 1-4 Complete)
**Last Updated**: October 2025
**Compatibility**: Chrome MV3, Modern Browsers

For full API reference and examples, see the complete documentation.
