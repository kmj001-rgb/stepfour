# StepFour - Gallery Image Scraper Chrome Extension

## Project Overview
StepFour is a production-ready Chrome extension (Manifest V3) that automatically detects image galleries, intelligently paginates through them using multiple methods, extracts image metadata, and provides CSV export and bulk download capabilities with customizable filename patterns.

## Recent Changes
- **2025-10-25**: Complete implementation with network monitoring
  - Implemented all 7 pagination methods (Next Button, Load More, Infinite Scroll, Arrow Navigation, URL Pattern, Click-Through, API-Based)
  - **Added network request monitoring**: Injected script intercepts fetch() and XMLHttpRequest to capture JSON responses
  - **Enhanced API pagination**: Extracts pagination tokens/cursors/URLs from API responses and uses them for subsequent requests
  - Built gallery auto-detection with image density analysis and grid layout detection
  - Created single-page side panel dashboard with real-time updates
  - Implemented CSV export with proper UTF-8 encoding and field escaping
  - Built download manager with queue system and customizable filename patterns
  - Generated extension icons and comprehensive documentation

## Project Architecture

### File Structure
```
StepFour/
├── manifest.json              # Manifest V3 configuration
├── service-worker.js          # Background service worker
├── content-script.js          # Page interaction and pagination
├── dashboard/
│   ├── dashboard.html         # Side panel UI
│   ├── dashboard.js           # Dashboard logic
│   └── dashboard.css          # Dashboard styles
├── icons/
│   ├── icon16.png            # 16x16 toolbar icon
│   ├── icon48.png            # 48x48 extension icon
│   └── icon128.png           # 128x128 Chrome Web Store icon
├── README.md                  # User documentation
├── replit.md                  # Project documentation (this file)
└── index.html                 # Documentation page
```

### Core Components

#### 1. Manifest (manifest.json)
- Manifest V3 compliant
- Permissions: activeTab, downloads, scripting, storage, sidePanel
- Side panel API for dashboard
- Host permissions for all URLs

#### 2. Service Worker (service-worker.js)
- Central state management for collected images
- Download queue with concurrent limit (3 simultaneous downloads)
- CSV export generation with proper formatting
- Filename pattern processor supporting 20+ tokens
- Real-time messaging with content script and dashboard

#### 3. Content Script (content-script.js)
- Gallery detection using multiple heuristics:
  - Image density analysis (image-to-text ratio)
  - Grid layout detection (CSS grid/flexbox)
  - URL pattern matching (/gallery/, /photos/, etc.)
- Pagination engine with 7 methods:
  - Next Button: Detects and clicks "Next" links
  - Load More: Clicks "Load More" buttons repeatedly
  - Infinite Scroll: Auto-scrolls to trigger loading
  - Arrow Navigation: Detects ">" arrow elements
  - URL Pattern: Increments page numbers in URLs
  - Click-Through: Gallery navigation via image clicks
  - API-Based: **Network monitoring with JSON response parsing**
    - Injected script intercepts fetch() and XMLHttpRequest
    - Captures JSON responses in real-time
    - Extracts pagination tokens (next URLs, cursors, tokens)
    - Uses captured metadata for subsequent API calls
    - Supports multiple API formats (REST, GraphQL, cursor-based)
- Image extraction with metadata (filename, URLs, caption, page number)
- Lazy-loading support (data-src, data-lazy attributes)

#### 4. Dashboard (dashboard/)
- Single-page side panel interface
- Real-time gallery detection status
- Live pagination controls and progress tracking
- Thumbnail preview grid with lazy loading
- CSV export and bulk download buttons
- Settings panel with filename pattern builder
- Chrome blue (#2196F3) and green (#4CAF50) color scheme

### Technical Details

**Browser Requirements:**
- Chrome 88+ (Manifest V3 support)
- Edge 88+, Brave 88+, Opera 74+ (Chromium-based)

**Privacy:**
- All processing is local in the browser
- No external servers or analytics
- No data leaves the user's machine

**Limitations:**
- Maximum 50 pagination attempts per session
- 3 concurrent downloads to avoid overwhelming browser
- Some dynamic galleries may require manual method selection

## User Workflow

1. Navigate to an image gallery website
2. Click StepFour icon to open side panel
3. Review gallery detection status
4. Select pagination method (or use auto-detect)
5. Click "Start Pagination"
6. Monitor progress and collected images
7. Export to CSV or download all images with custom patterns

## Filename Pattern Tokens

**Basic:** *name*, *ext*, *fullname*
**URL:** *domain*, *hostname*, *protocol*, *path*
**Numbering:** *num*, *num-3*, *num-5*, *index*
**Time:** *date*, *time*, *datetime*, *timestamp*
**Gallery:** *page*, *gallery*, *caption*, *source*

**Example Patterns:**
- `*num-3*-*name*.*ext*` → 001-sunset.jpg, 002-ocean.jpg
- `*date*-*num*.*ext*` → 2025-10-25-1.jpg
- `*domain*-*page*-*num*.*ext*` → example-1-001.jpg

## Development Notes

### Loading the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the StepFour directory
5. Extension icon should appear in toolbar

### API Pagination Implementation Details

**Network Monitoring (Lines 18-77 in content-script.js):**
- injectNetworkMonitor() runs on page load
- Intercepts window.fetch() and XMLHttpRequest in page context (Main World)
- Captures all JSON responses via window.postMessage
- Sends STEPFOUR_API_RESPONSE messages to content script

**Response Processing (Lines 79-158 in content-script.js):**
- handleAPIResponse() receives captured JSON data
- extractPaginationInfo() extracts:
  - Direct URLs: `next`, `nextPage`, `next_page`
  - Nested: `pagination.next`, `paging.next`
  - Cursors: `cursor`, `nextCursor`, `paging.cursors.after`
  - Tokens: `nextToken`, `pagination.next_token`
- Stores in latestPaginationInfo for next request

**Request Execution (Lines 918-1006 in content-script.js):**
- paginateAPI() prioritizes captured pagination metadata:
  1. Uses nextUrl if available
  2. Uses nextCursor if available
  3. Uses nextToken if available
  4. Falls back to heuristic pagination
- Extracts images directly from JSON responses
- Updates latestPaginationInfo with each response

### Testing Checklist
- [ ] Gallery detection works on various sites
- [ ] All 7 pagination methods function correctly
- [ ] API pagination captures and uses network responses
- [ ] Pagination tokens/cursors drive subsequent requests
- [ ] Images are extracted with proper metadata
- [ ] CSV export downloads with correct formatting
- [ ] Bulk download with filename patterns works
- [ ] Dashboard updates in real-time
- [ ] Side panel opens and closes properly

### Known Issues
None reported at this time.

## Future Enhancements

Potential features for future versions:
- Site-specific detection rules for popular platforms (Pinterest, Flickr, Instagram)
- Advanced API pagination with OAuth support
- Image deduplication based on visual similarity
- Batch processing queue with pause/resume
- User-configurable detection sensitivity
- Custom selector rules for complex galleries
- Export to other formats (JSON, XML)
- Image preview lightbox in dashboard
- Statistics and analytics dashboard

## Support

For issues or questions:
1. Check the README.md for detailed documentation
2. Review browser console for error messages (F12 → Console)
3. Verify Chrome version supports Manifest V3
4. Try manual pagination method selection if auto-detect fails
