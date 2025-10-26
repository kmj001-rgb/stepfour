# StepThree Gallery Scraper - Replit Setup

## Project Overview
This is a professional Chrome Extension (Manifest V3) for scraping image galleries with smart pattern recognition and automated batch processing. The project includes an optional development server that serves a demo/landing page.

## Project Type
- **Primary**: Chrome Extension (Manifest V3)
- **Secondary**: Node.js static file server for demo purposes

## Current State
- ✅ Server configured and running on port 5000
- ✅ Demo page accessible via web preview
- ✅ All dependencies configured (no external packages needed)
- ✅ Production-ready Chrome Extension files in place

## Project Structure
```
├── manifest.json          # Chrome Extension manifest (Manifest V3)
├── background.js          # Service worker for extension
├── content.js             # Content script (bundled)
├── server.js              # Development server (Node.js)
├── index.html             # Demo landing page
├── ui/                    # Extension UI components
│   └── sidepanel-new.html # Main side panel interface
├── lib/                   # Third-party libraries and utilities
├── src/                   # Source code (for development reference)
├── icons/                 # Extension icons
└── offscreen/             # Offscreen documents for export
```

## How to Use

### As a Chrome Extension (Primary Use)
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this Replit project directory
5. The extension will appear in your browser toolbar

### Development Server (Demo Page)
- The server runs automatically on port 5000
- Access via the Replit webview to see the demo/landing page
- The demo page provides installation instructions and feature overview

## Technology Stack
- **Chrome APIs**: Manifest V3, Service Workers, Side Panel, Downloads, Storage
- **Frontend**: Vanilla JavaScript, Vue.js (for UI components)
- **Libraries**: XLSX, Papa Parse, noUiSlider
- **Development Server**: Node.js HTTP server (no dependencies)

## Key Features
- Smart pattern recognition for gallery detection
- Batch image downloading with configurable concurrency
- Multiple export formats (CSV, Excel, JSON, HTML)
- Enhanced CSS selector generation
- Real-time performance monitoring

## Configuration
- **Port**: 5000 (frontend demo server)
- **Host**: 0.0.0.0 (configured for Replit proxy)
- **Cache-Control**: Disabled for development

## Architecture Notes
- The extension is fully self-contained in the repository
- The Node.js server is purely for demo/documentation purposes
- All extension logic runs client-side in the browser
- No backend API or database required

## Recent Setup (October 25, 2025)
- Installed Node.js 20
- Configured workflow to run demo server on port 5000
- Added .gitignore for Node.js projects
- Verified server runs successfully with proper cache headers
- Configured Replit deployment (autoscale) for the demo server
- Successfully tested webview and confirmed all systems operational

## Bug Fixes (October 19, 2025)

### Fixed: Element Picker Not Working
**Issue**: Clicking "Pick Next Selector" button resulted in error "No Handler registered for message type: start_element_picker"

**Root Cause**: Multiple message listeners were registered in content.js, and the centralized handler was responding with an error before the correct handler could process the message.

**Fix**: Modified the centralized message handler to skip responding to `start_element_picker` and `stop_element_picker` messages, allowing them to be handled by the simple handler at the end of content.js.

**File**: `content.js` (line ~7525)

### Fixed: Unwanted Navigation to "/null" During Auto-Detect
**Issue**: When clicking "Start Auto-Detect (Images and Tables)", the extension would sometimes navigate from the current page (e.g., https://www.imago-images.com/search?querystring=passion) to an invalid URL (https://www.imago-images.com/null)

**Root Cause**: The pagination system was setting `nextPageInfo.url` to `null` when a pagination element didn't have a valid href. When the code tried to navigate using `window.location.href = null`, JavaScript converted `null` to the string "null", resulting in navigation to "/null".

**Fix**: Added validation checks in multiple locations:
1. In `navigateToNextPage()` - Only navigate if URL is a valid non-null string
2. In pagination loop - Validate URL before checking visited URLs
3. Before actual navigation - Stop pagination if URL is invalid

**Files**: `content.js` (lines ~8005, ~8185, ~8194)

### Fixed: Element Picker Cannot Select Stable Selectors on Modern SPAs
**Issue**: On modern Single Page Applications like imago-images.com, the element picker would generate unstable selectors that relied on framework-generated class names (e.g., `.g-a123`, `.css-xyz`) that change with every deployment.

**Root Cause**: The `generateSelector()` method in `StepThreeElementPicker` was extremely basic:
- Only used the FIRST class name from an element
- Didn't leverage the extension's own `EnhancedCSSSelector` system
- Ignored stable attributes like `data-testid`, `aria-label`, and semantic classes

**Impact**: 
- Selectors would break whenever the website updated
- Couldn't select pagination buttons reliably on Angular/React/Vue apps
- Users couldn't set custom "Next" selectors for auto-pagination

**Fix**: Completely rewrote the `generateSelector()` method to:
1. **First**: Try using `EnhancedCSSSelector` system for advanced selector generation
2. **Fallback Priority Order**:
   - IDs (if semantic, not random)
   - Data attributes (`data-testid`, `data-automation`, etc.)
   - ARIA labels (`aria-label`)
   - Role attributes (`role`)
   - Semantic class names (filtering out framework hashes using patterns)
3. **Framework Hash Detection**: Automatically excludes:
   - Angular: `_ngcontent-*`, `ng-*`
   - React: `css-*`, `makeStyles-*`
   - Vue: `v-*`, `data-v-*`
   - Generic hashes: `g-abc`, `x-123` (1-3 chars + dash + 3-10 alphanumeric)
4. **Fallback nth-of-type**: Adds positional selector for generic tags

**Result**: Element picker now generates stable, cross-deployment selectors that work on modern SPAs.

**Files**: `content.js` (lines ~4112-4202)

### Implemented: Three-Layer Solution for Modern SPA Pagination
**Based on**: Technical report "Diagnostic and Prescriptive Strategy for Chrome Extension Pagination on Dynamic Web Applications"

The extension now implements a complete three-layer solution to handle pagination on modern Single Page Applications (SPAs) like imago-images.com:

#### Layer 1: Timing/Race Condition (ALREADY IMPLEMENTED)
**Problem**: Content scripts execute before dynamically loaded pagination elements appear in the DOM.
**Solution**: Extension already uses `MutationObserver` API in multiple systems:
- `DOMQueryCacheClass` with `enableMutationObserver: true`
- `DynamicContentObserver` class for monitoring DOM changes
- Event-driven detection instead of unreliable `setTimeout`

#### Layer 2: Selector Fragility (FIXED)
**Problem**: Framework-generated class names (Angular `_ngcontent-*`, React `css-*`, Vue `v-*`) change on every deployment.
**Solution**: Enhanced `generateSelector()` method with:
1. Primary: `EnhancedCSSSelector` system for advanced generation
2. Fallback hierarchy: IDs → Data attributes → ARIA labels → Roles → XPath by text → Semantic classes
3. Framework hash detection and filtering
4. **XPath by text content** (Section 3.2B): Automatically generates XPath selectors for pagination elements with recognizable text (e.g., `xpath://button[contains(., 'Next')]`)

**Files**: 
- `content.js` (lines ~4112-4226) - Selector generation with XPath support
- `content.js` (lines ~7485-7499) - XPath evaluation in pagination handler
- `background.js` (lines ~1650-1660) - XPath support in trusted click handler

#### Layer 3: Execution Isolation - Untrusted Clicks (NEW)
**Problem**: Clicks from content script (Isolated World) don't trigger SPA navigation logic because they fail trusted event checks.

**Solution**: Main World Injection via MV3-compliant `chrome.scripting.executeScript`:
1. **Background Script Handler** (`background.js`):
   - Registers `EXECUTE_TRUSTED_CLICK` message handler
   - Uses `chrome.scripting.executeScript` with `world: 'MAIN'`
   - Executes clicks in page's trusted context
   - Validates element visibility before clicking

2. **Content Script Integration** (`content.js`):
   - New `performTrustedClick()` method in `PaginationSession` class
   - Generates stable selector for target element
   - Requests trusted click from background script
   - Falls back to direct click if Main World injection fails

3. **Applied to All Pagination Types**:
   - Load More buttons (`isLoadMore`)
   - SPA navigation without URLs (`clickOnly`)
   - Custom next selectors
   - Auto-detected pagination

**Architecture Flow**:
```
Content Script (Isolated World)
  ↓ Detects pagination element
  ↓ Generates stable selector
  ↓ Sends message: EXECUTE_TRUSTED_CLICK
Background Script (Service Worker)
  ↓ Receives message
  ↓ Calls chrome.scripting.executeScript({world: 'MAIN'})
Main World (Page Context)
  ↓ Locates element via selector
  ↓ Executes trusted click()
  ↓ SPA framework recognizes as user interaction ✅
```

**Benefits**:
- Works on Angular, React, Vue, and other modern frameworks
- Bypasses `isTrusted` event checks
- Compatible with custom event handlers
- Falls back gracefully if Main World injection fails

**Files**: 
- `background.js` (lines ~1623-1688) - Trusted click handler
- `content.js` (lines ~8099-8155) - performTrustedClick method
- `content.js` (lines ~7408-7434, ~7444-7486) - Integration points

**References**: Based on recommendations from "Diagnostic and Prescriptive Strategy for Chrome Extension Pagination on Dynamic Web Applications"

#### Additional Enhancements Based on Report

**XPath by Text Content (Section 3.2B)**:
- Element picker automatically generates XPath selectors for pagination elements
- Uses text content (e.g., "Next", "Previous", "›", "»") as selector basis
- Format: `xpath://button[contains(., 'Next')]`
- Highly stable across deployments since text rarely changes
- Supported in both content script and Main World execution

**Files**: 
- `content.js` (lines ~4198-4211) - XPath generation for pagination text
- `content.js` (lines ~7485-7499) - XPath evaluation support
- `background.js` (lines ~1650-1660) - XPath execution in Main World

**Shadow DOM Support (Section 3.3)**:
- Element picker now detects when elements are inside Shadow DOM
- Generates special selector notation: `host-selector::shadow::inner-selector`
- Trusted click handler supports Shadow DOM traversal
- Works with both Open and Closed Shadow Roots (when accessible)

**Files**: 
- `content.js` (lines ~4228-4270) - Shadow DOM detection and selector generation
- `background.js` (lines ~1663-1673) - Shadow DOM traversal in Main World

**Pagination Termination Detection (Section 5.2)**:
- Trusted click handler now checks for disabled state before clicking
- Detects: `disabled` attribute, `aria-disabled="true"`, `.disabled` class
- Returns `terminationDetected: true` when pagination end is reached
- Prevents infinite loops when "Next" button is disabled on last page

**Files**: `background.js` (lines ~1679-1685)

**Future Optimization Opportunities** (Section VI - Not Yet Implemented):
The report suggests a superior approach for production systems:

1. **Network API Analysis**: Instead of DOM manipulation, analyze the XHR/Fetch requests when clicking "Next"
2. **Direct API Calls**: Replicate the API requests with incrementing offset/page parameters
3. **Benefits**: 
   - Eliminates timing issues
   - No selector fragility
   - Much faster (no waiting for DOM changes)
   - More reliable

This would require:
- Analyzing imago-images.com's API structure
- Implementing Service Worker fetch requests with pagination parameters
- Bypassing DOM interaction entirely

**Trade-offs**: Current DOM-based approach is more universally applicable across different websites, while API-based approach would be site-specific but more robust.
