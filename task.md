Autonomous Chrome Extension Build Prompt for Replit Agent

Mission Statement

Build StepFour - a complete, production-ready Chrome extension with a single-page dashboard that automatically detects image galleries, intelligently paginates through them using multiple methods, extracts image metadata, and provides CSV export and download capabilities with customizable file naming patterns.



Project Overview

Extension Name: StepFour



Core Purpose: Gallery image scraper with auto-detection, multi-method pagination, CSV export, and bulk download



User Experience: Simple, intuitive interface with advanced automation under the hood



Architecture: Single-page dashboard (side panel or popup) with powerful background processing



Feature Requirements

🎯 Core Features (Priority Order)

1\. Single-Page Dashboard Interface ⭐ PRIMARY UI

Implementation: Use Chrome's Side Panel API (preferred) or large popup



Dashboard Must Include:



Gallery Detection Indicator



Visual indicator showing if current page is a detected gallery



Gallery type label (e.g., "Grid Gallery", "Infinite Scroll", "Paginated")



Number of images detected on current page



Pagination Control Section



Auto-detect pagination method (display which method detected)



Manual override dropdown (Next button, Load More, Autoscroll, > arrow, URL pattern, etc.)



Start/Stop pagination button



Current page number / total pages (if detectable)



Progress bar during pagination



Image Preview Section



Live count of total images found



Thumbnail grid preview (small thumbnails of found images)



Scrollable container with lazy loading



Export \& Download Section



"Export CSV" button



"Download All Images" toggle (auto-download as images are found)



Download folder setting input



Filename mask input with pattern builder



Pattern quick-insert buttons



Settings Section (collapsible)



Gallery auto-detection toggle



Default pagination method



Download preferences



Filename mask templates



Design Principles:



Clean, modern, single-page layout



No navigation between pages - everything on one dashboard



Real-time updates as pagination/scraping occurs



Clear status indicators for all operations



Responsive design that works in side panel or popup



2\. Auto-Detect Galleries ⭐ CRITICAL FEATURE

Purpose: Automatically identify when user is on a gallery page



Detection Methods:



Image density analysis: Pages with high image-to-text ratio



Grid layout detection: CSS grid or flexbox with images



Common gallery patterns:



Image thumbnails in repeating containers



Gallery-specific HTML structures (.gallery, .image-grid, etc.)



Lightbox or modal image viewers present



Image lazy-loading attributes



URL pattern matching: /gallery/, /photos/, /images/, etc.



Site-specific rules: Pre-configured rules for popular sites (Pinterest, Flickr, Instagram, etc.)



User Indicators:



Browser action icon badge showing image count



Dashboard header showing "✓ Gallery Detected" with green indicator



Automatic display of gallery type detected



Show confidence level (High/Medium/Low)



Implementation:



javascript

class GalleryDetector {

&nbsp; async detectGallery(pageData) {

&nbsp;   // Analyze page structure

&nbsp;   // Return: { isGallery: boolean, type: string, confidence: string, imageCount: number }

&nbsp; }

&nbsp; 

&nbsp; async getImageDensity()

&nbsp; async detectGridLayout()

&nbsp; async matchURLPattern()

&nbsp; async checkGalleryElements()

}

3\. Multi-Method Pagination ⭐ HIGHEST PRIORITY

Must Support All These Methods:



A. "Next" Button Click

Detect: <a> or <button> with text "Next", "→", "Continue"



Common selectors: .next, \[rel="next"], .pagination-next



Click and wait for new content



B. "Load More" Button

Detect: Buttons with text "Load More", "Show More", "View More"



Common patterns: .load-more, \[data-action="load-more"]



Click repeatedly until button disappears or is disabled



C. Auto-Scroll (Infinite Scroll)

Detect: IntersectionObserver on sentinel element at page bottom



Monitor for new content appearing as user scrolls



Automatically scroll to trigger loading



Detect when no more content loads



D. ">" Arrow Navigation

Detect: Arrow elements (text: ">", "›", "»")



Common in image galleries and carousels



Click and navigate to next page



E. URL Pattern Incrementation

Detect: URLs with patterns like ?page=1, /page/2/, \&p=3



Automatically increment and navigate to next URL



Continue until 404 or no new images found



F. API-Based Pagination

Monitor network requests for JSON responses with image data



Extract pagination tokens or next page URLs from API responses



Make subsequent API calls to fetch more data



G. Other Proof-of-Concept Methods

Keyboard navigation: Detect if arrow keys navigate pages



Timestamp-based: Some sites use ?before=timestamp patterns



Cursor-based: GraphQL-style cursor pagination



Hybrid detection: Sites using multiple methods



Auto-Detection Priority:



Try to detect all methods present on page



Recommend most reliable method to user



Allow user to override if auto-detection fails



Log successful method for site-specific rules



Implementation:



javascript

class PaginationEngine {

&nbsp; // Auto-detect which methods are available

&nbsp; async detectPaginationMethods() {

&nbsp;   return {

&nbsp;     nextButton: { available: boolean, selector: string },

&nbsp;     loadMore: { available: boolean, selector: string },

&nbsp;     infiniteScroll: { available: boolean, detected: boolean },

&nbsp;     arrow: { available: boolean, selector: string },

&nbsp;     urlPattern: { available: boolean, pattern: string },

&nbsp;     api: { available: boolean, endpoint: string }

&nbsp;   };

&nbsp; }

&nbsp; 

&nbsp; // Execute pagination using specified method

&nbsp; async paginate(method, options) {

&nbsp;   switch(method) {

&nbsp;     case 'nextButton': return await this.clickNext();

&nbsp;     case 'loadMore': return await this.clickLoadMore();

&nbsp;     case 'infiniteScroll': return await this.autoScroll();

&nbsp;     case 'arrow': return await this.clickArrow();

&nbsp;     case 'urlPattern': return await this.incrementURL();

&nbsp;     case 'api': return await this.fetchNextAPI();

&nbsp;   }

&nbsp; }

&nbsp; 

&nbsp; async clickNext() { /\* implementation \*/ }

&nbsp; async clickLoadMore() { /\* implementation \*/ }

&nbsp; async autoScroll() { /\* implementation \*/ }

&nbsp; async clickArrow() { /\* implementation \*/ }

&nbsp; async incrementURL() { /\* implementation \*/ }

&nbsp; async fetchNextAPI() { /\* implementation \*/ }

}

4\. Image Detection \& Extraction

Extract Following Data for Each Image:



Filename: Original filename from URL or generate from pattern



File URL: Full resolution image URL (not thumbnail if possible)



Thumbnail URL: Thumbnail or preview URL



Caption: Alt text, title, or nearby text content



Source Page: URL of the page where image was found



Detection Strategy:



Find all <img> elements



Check for lazy-loaded images (data-src, data-lazy, etc.)



Look for background images in CSS



Detect high-resolution versions (look for data-full, data-original)



Extract metadata from parent containers



Remove duplicates (same File URL)



Data Structure:



javascript

{

&nbsp; filename: "image-001.jpg",

&nbsp; fileUrl: "https://example.com/images/full/image.jpg",

&nbsp; thumbnailUrl: "https://example.com/images/thumb/image.jpg",

&nbsp; caption: "Beautiful sunset over mountains",

&nbsp; sourcePage: "https://example.com/gallery/nature"

}

5\. CSV Export ⭐ REQUIRED FEATURE

Export Format:



CSV file with headers: Filename,File URL,Thumbnail URL,Caption,Source Page



Properly escape fields with commas or quotes



UTF-8 encoding for international characters



One row per image



Example CSV:



text

Filename,File URL,Thumbnail URL,Caption,Source Page

image-001.jpg,https://example.com/full/img1.jpg,https://example.com/thumb/img1.jpg,"Sunset over mountains",https://example.com/gallery

image-002.jpg,https://example.com/full/img2.jpg,https://example.com/thumb/img2.jpg,"Ocean waves",https://example.com/gallery

Implementation:



Generate CSV from collected image data



Download using chrome.downloads API or Blob URL



Default filename: gallery-export-YYYY-MM-DD-HHMMSS.csv



Show success notification with download location



6\. Auto-Download Images ⭐ REQUIRED FEATURE

Functionality:



Toggle: ON/OFF switch in dashboard



When ON: Automatically download images as they're discovered during pagination



When OFF: Only collect metadata for CSV export (no downloads)



Download Behavior:



Use chrome.downloads API



Queue downloads to avoid overwhelming browser



Configurable concurrent download limit (default: 3)



Show progress in dashboard



Handle failures gracefully (retry or log error)



Respect download folder setting



User Control:



Pause/resume downloads



Cancel all downloads



Clear download queue



View download status per image



7\. Download Folder Setting

Functionality:



User can specify subfolder within default Downloads folder



Input field: "Download Folder" (e.g., StepFour/Galleries/Nature)



Creates folder hierarchy automatically



Empty = download to default Downloads folder



Implementation:



Use chrome.downloads API with filename parameter



Path separator: / (cross-platform)



Sanitize folder names (remove invalid characters)



Create nested folders as needed



Example:



User sets: MyGalleries/Pinterest/Nature



Files download to: Downloads/MyGalleries/Pinterest/Nature/image-001.jpg



8\. Filename Mask with Pattern Builder ⭐ ADVANCED FEATURE

Purpose: Allow users to customize how downloaded files are named



Pattern System:



Basic Patterns:

\*name\* - Original filename from URL (without extension)



\*ext\* - File extension (e.g., jpg, png, gif)



\*fullname\* - Original filename with extension



URL Segments:

\*domain\* - Domain name (e.g., "example.com")



\*hostname\* - Hostname without TLD (e.g., "example")



\*protocol\* - URL protocol (http/https)



\*path\* - Full URL path



\*url-1\*, \*url-2\*, \*url-3\* - URL path segments (1st, 2nd, 3rd part)



Numbering \& Time:

\*num\* - Sequential number (001, 002, 003...)



\*num-3\* - 3-digit number with leading zeros



\*num-5\* - 5-digit number with leading zeros



\*index\* - Index starting from 0



\*timestamp\* - Unix timestamp (e.g., 1698345678)



\*date\* - Current date (YYYY-MM-DD)



\*time\* - Current time (HH-MM-SS)



\*datetime\* - Date and time (YYYY-MM-DD\_HH-MM-SS)



\*year\*, \*month\*, \*day\* - Individual date components



\*hour\*, \*minute\*, \*second\* - Individual time components



Gallery/Page Info:

\*page\* - Current page number



\*gallery\* - Gallery name (from page title or URL)



\*caption\* - Image caption/alt text (sanitized)



\*source\* - Source page name



Default Pattern: \*name\*.\*ext\*



Example Patterns:



\*num-3\*-\*name\*.\*ext\* → 001-sunset.jpg, 002-ocean.jpg



\*date\*-\*num\*.\*ext\* → 2025-10-25-1.jpg, 2025-10-25-2.jpg



\*domain\*-\*page\*-\*num\*.\*ext\* → example-1-001.jpg



\*gallery\*/\*num-3\*.\*ext\* → Nature/001.jpg, Nature/002.jpg



UI Implementation:



Input field showing current pattern



Click-to-insert buttons for each pattern category



Live preview showing example filename



Save custom patterns as templates



Pattern Processor:



javascript

class FilenamePattern {

&nbsp; constructor(pattern, imageData, metadata) {

&nbsp;   this.pattern = pattern;

&nbsp;   this.imageData = imageData;

&nbsp;   this.metadata = metadata; // { pageNumber, galleryName, index, etc. }

&nbsp; }

&nbsp; 

&nbsp; generate() {

&nbsp;   let filename = this.pattern;

&nbsp;   

&nbsp;   // Replace all pattern tokens

&nbsp;   filename = filename.replace(/\\\*name\\\*/g, this.getBaseName());

&nbsp;   filename = filename.replace(/\\\*ext\\\*/g, this.getExtension());

&nbsp;   filename = filename.replace(/\\\*num\\\*/g, this.getNumber());

&nbsp;   filename = filename.replace(/\\\*num-(\\d+)\\\*/g, (match, digits) => this.getNumber(digits));

&nbsp;   filename = filename.replace(/\\\*date\\\*/g, this.getDate());

&nbsp;   filename = filename.replace(/\\\*time\\\*/g, this.getTime());

&nbsp;   // ... process all patterns

&nbsp;   

&nbsp;   return this.sanitize(filename);

&nbsp; }

&nbsp; 

&nbsp; sanitize(filename) {

&nbsp;   // Remove invalid characters, limit length, etc.

&nbsp; }

}

Technical Compliance Requirements

✅ Chrome 2025 / Manifest V3 Standards

Full Manifest V3 compliance



Service workers for background logic



ES6+ modern JavaScript (modules, async/await)



Readable, non-minified code



Side Panel API for dashboard (preferred over popup)



Chrome Downloads API for file downloads



🚫 Absolute Restrictions

❌ NO external HTTP requests to third-party servers



❌ NO cloud services or external APIs



❌ NO external dependencies or libraries



❌ NO external authentication



❌ NO minified code



Privacy-First: All processing local, no data leaves browser.



StepFour Architecture

File Structure:

text

StepFour/

├── manifest.json

├── service-worker.js

├── dashboard/

│   ├── dashboard.html          # Single-page dashboard UI

│   ├── dashboard.js            # Dashboard logic

│   └── dashboard.css           # Dashboard styles

├── modules/

│   ├── gallery-detector.js     # Auto-detect galleries

│   ├── pagination-engine.js    # Multi-method pagination

│   ├── image-extractor.js      # Find and extract images

│   ├── csv-exporter.js         # Generate CSV exports

│   ├── download-manager.js     # Handle image downloads

│   ├── filename-pattern.js     # Process filename masks

│   └── storage.js              # Local storage management

├── content/

│   ├── content.js              # Inject into pages

│   └── content.css             # Content script styles

├── icons/

│   ├── icon16.png

│   ├── icon32.png

│   ├── icon48.png

│   └── icon128.png

└── README.md

manifest.json Structure

json

{

&nbsp; "manifest\_version": 3,

&nbsp; "name": "StepFour",

&nbsp; "version": "1.0.0",

&nbsp; "description": "Auto-detect image galleries, paginate intelligently, export CSV, and download images with custom filename patterns",

&nbsp; 

&nbsp; "permissions": \[

&nbsp;   "storage",

&nbsp;   "downloads",

&nbsp;   "activeTab",

&nbsp;   "scripting",

&nbsp;   "webRequest",

&nbsp;   "sidePanel"

&nbsp; ],

&nbsp; 

&nbsp; "host\_permissions": \[

&nbsp;   "<all\_urls>"

&nbsp; ],

&nbsp; 

&nbsp; "background": {

&nbsp;   "service\_worker": "service-worker.js",

&nbsp;   "type": "module"

&nbsp; },

&nbsp; 

&nbsp; "content\_scripts": \[

&nbsp;   {

&nbsp;     "matches": \["<all\_urls>"],

&nbsp;     "js": \["content/content.js"],

&nbsp;     "run\_at": "document\_idle"

&nbsp;   }

&nbsp; ],

&nbsp; 

&nbsp; "side\_panel": {

&nbsp;   "default\_path": "dashboard/dashboard.html"

&nbsp; },

&nbsp; 

&nbsp; "action": {

&nbsp;   "default\_title": "StepFour - Gallery Scraper",

&nbsp;   "default\_icon": {

&nbsp;     "16": "icons/icon16.png",

&nbsp;     "32": "icons/icon32.png",

&nbsp;     "48": "icons/icon48.png",

&nbsp;     "128": "icons/icon128.png"

&nbsp;   }

&nbsp; },

&nbsp; 

&nbsp; "icons": {

&nbsp;   "16": "icons/icon16.png",

&nbsp;   "32": "icons/icon32.png",

&nbsp;   "48": "icons/icon48.png",

&nbsp;   "128": "icons/icon128.png"

&nbsp; }

}

Dashboard UI Layout (Single Page)

Visual Structure:

text

┌─────────────────────────────────────────┐

│  StepFour Gallery Scraper               │

├─────────────────────────────────────────┤

│  🟢 Gallery Detected: Grid Gallery      │

│  📊 48 images found                     │

├─────────────────────────────────────────┤

│  PAGINATION CONTROLS                    │

│  ┌───────────────────────────────────┐ │

│  │ Method: Auto (Next Button)    ▼  │ │

│  │ \[Start Pagination] \[Stop]        │ │

│  │ Progress: Page 3 of 12           │ │

│  │ ████████░░░░░░░░░ 25%            │ │

│  └───────────────────────────────────┘ │

├─────────────────────────────────────────┤

│  IMAGE PREVIEW                          │

│  ┌───────────────────────────────────┐ │

│  │ \[thumb]\[thumb]\[thumb]\[thumb]      │ │

│  │ \[thumb]\[thumb]\[thumb]\[thumb]      │ │

│  │ ... (scrollable grid)             │ │

│  └───────────────────────────────────┘ │

├─────────────────────────────────────────┤

│  EXPORT \& DOWNLOAD                      │

│  \[Export CSV]                           │

│  Auto-download: \[ON] OFF                │

│  Download folder: MyGalleries/Nature    │

│  Filename mask: \*num-3\*-\*name\*.\*ext\*    │

│  ┌───────────────────────────────────┐ │

│  │ Quick Patterns:                   │ │

│  │ \[\*name\*] \[\*num\*] \[\*date\*] \[\*url\*] │ │

│  └───────────────────────────────────┘ │

│  Preview: 001-sunset.jpg                │

│  \[Download All Images]                  │

├─────────────────────────────────────────┤

│  ⚙️ SETTINGS (collapsible)              │

│  Auto-detect galleries: ☑ ON           │

│  Max pages: 50                          │

│  Concurrent downloads: 3                │

└─────────────────────────────────────────┘

Implementation Priority

Phase 1: Foundation \& UI (Build First)

Project structure and manifest.json



Dashboard HTML/CSS layout (single page)



Service worker with basic messaging



Storage module for settings



Content script injection



Phase 2: Gallery Detection (Critical)

Auto-detect gallery pages



Image density analysis



Grid layout detection



URL pattern matching



Visual indicators in dashboard



Phase 3: Pagination Engine (Highest Priority)

Next button detection and click



Load More button handling



Auto-scroll for infinite scroll



Arrow navigation



URL pattern incrementation



Auto-detection system



Progress tracking



Phase 4: Image Extraction

Find all images on page



Extract metadata (filename, URLs, caption, etc.)



Detect high-res versions



Remove duplicates



Update dashboard with live count



Phase 5: Export \& Download

CSV export functionality



Download manager with queue



Filename pattern processor



Pattern UI with quick-insert buttons



Auto-download toggle



Download folder setting



Phase 6: Polish \& Testing

Error handling throughout



Progress indicators



Performance optimization



User notifications



Comprehensive testing



Documentation



Key User Workflows

Workflow 1: Auto-Detect \& Export CSV

User navigates to gallery page (e.g., Pinterest board)



Opens StepFour side panel



Extension auto-detects gallery → shows indicator



User clicks "Start Pagination"



Extension auto-selects pagination method



Paginates through all pages, collecting images



User clicks "Export CSV"



CSV downloads with all image metadata



Workflow 2: Auto-Download Images

User navigates to gallery



Opens StepFour



Turns ON "Auto-download"



Sets download folder: Travel/Japan



Sets filename mask: \*date\*-\*num-3\*.\*ext\*



Clicks "Start Pagination"



Extension paginates and downloads images automatically



Files save as: Downloads/Travel/Japan/2025-10-25-001.jpg



Workflow 3: Manual Method Override

User on gallery with tricky pagination



Auto-detect fails or picks wrong method



User manually selects "Load More" from dropdown



Clicks "Start Pagination"



Extension uses specified method



Continues until all images found



Error Handling

Must Handle:

No gallery detected → Show message, allow manual start



Pagination fails → Show error, offer retry or method change



Images not loading → Wait and retry, skip if persistent



Download fails → Log error, retry up to 3 times



Storage quota exceeded → Warn user, offer to export/clear



Invalid filename pattern → Show warning, use safe default



User Notifications:

Success: "✓ Export complete: 48 images saved to CSV"



Progress: "⏳ Paginating... Page 5 of 12"



Error: "⚠️ Pagination stopped: Next button not found"



Warning: "⚠️ 3 downloads failed. Check console for details."



Success Criteria

StepFour is complete when:



✅ Single-page dashboard loads and displays all sections

✅ Auto-detects galleries with visual indicators

✅ Paginates using all specified methods (Next, Load More, Autoscroll, Arrow, URL pattern, API)

✅ Extracts image metadata (all 5 fields)

✅ Exports CSV with proper formatting

✅ Auto-downloads images when toggle is ON

✅ Respects download folder setting

✅ Processes filename masks with all pattern categories

✅ Pattern quick-insert UI works and shows preview

✅ Real-time updates in dashboard during operations

✅ Chrome 2025 compliant (Manifest V3, service workers)

✅ Zero external dependencies

✅ Clean, readable code with comments

✅ Comprehensive error handling

✅ Complete documentation



Execution Instructions for Replit Agent

Create file structure per architecture above



Build manifest.json with all required permissions



Create single-page dashboard UI (HTML/CSS) - make it clean and functional



Implement gallery detection with multiple methods



Build pagination engine supporting ALL specified methods



Create image extractor to collect 5 required fields



Implement CSV exporter with proper formatting



Build download manager with queue and auto-download toggle



Create filename pattern processor with all pattern categories



Add pattern UI with quick-insert buttons and preview



Implement service worker for coordination



Create content script for page interaction



Add comprehensive error handling



Test all features thoroughly



Write README with usage instructions



Design Notes

Keep It Simple for Users:

One-page dashboard = no navigation confusion



Auto-detection = no manual configuration needed



Clear indicators = user always knows what's happening



Sensible defaults = works well out-of-box



Advanced Under the Hood:

Multiple pagination methods = handles any site



Pattern system = ultimate flexibility



Auto-download = saves time



Queue management = efficient and reliable



Build StepFour as specified: simple for users, advanced in capability, with all required features working reliably in a single, cohesive dashboard experience.



End of Autonomous Build Prompt

