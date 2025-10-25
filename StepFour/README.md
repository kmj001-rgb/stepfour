# StepFour - Gallery Image Scraper

A production-ready Chrome extension for intelligent gallery detection, multi-method pagination, image scraping, CSV export, and bulk download.

## Features

### Core Functionality
- **Auto-detect Galleries**: Automatically identifies gallery pages using image density analysis, grid layout detection, and URL pattern matching
- **Multi-Method Pagination**: Supports Next button, Load More, Infinite Scroll, Arrow navigation, URL pattern increment, and API-based pagination
- **Image Extraction**: Extracts images with metadata including filename, file URL, thumbnail URL, caption, and source page
- **CSV Export**: Export all collected images to CSV with proper formatting and UTF-8 encoding
- **Bulk Download**: Download all images with customizable filename patterns and folder organization
- **Side Panel Dashboard**: Clean, modern single-page interface with real-time updates

### Advanced Features
- **Filename Pattern System**: Customize downloaded filenames with tokens like `*num*`, `*date*`, `*name*`, `*ext*`, `*domain*`, `*page*`
- **Auto-Download**: Automatically download images as they're discovered during pagination
- **Download Queue**: Intelligent queue system with concurrent download limits
- **Thumbnail Preview**: Live thumbnail grid showing collected images
- **Progress Tracking**: Real-time pagination status and progress indicators

## Installation

### Load as Unpacked Extension

1. **Clone or download this repository**

2. **Open Chrome and navigate to**:
   ```
   chrome://extensions/
   ```

3. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**:
   - Click "Load unpacked"
   - Select the StepFour directory (containing manifest.json)

5. **Verify installation**:
   - You should see the StepFour extension icon in your toolbar
   - The extension should be enabled

## Usage

### Basic Workflow

1. **Navigate to a gallery page** (e.g., Pinterest, Flickr, photo galleries)

2. **Click the StepFour icon** in your Chrome toolbar to open the side panel

3. **Check gallery detection**:
   - The dashboard will show if a gallery was detected
   - View gallery type, confidence level, and image count

4. **Select pagination method**:
   - Choose "Auto-detect" for automatic method selection
   - Or manually select: Next Button, Load More, Infinite Scroll, Arrow Navigation, or URL Pattern

5. **Start pagination**:
   - Click "Start Pagination" button
   - Watch as images are collected in real-time
   - Monitor progress in the pagination status section

6. **Export or Download**:
   - **Export CSV**: Click "Export CSV" to download metadata
   - **Download Images**: Click "Download All Images" to bulk download
   - Or enable "Auto-download" to download images automatically during pagination

### Filename Patterns

Customize how downloaded files are named using these tokens:

#### Basic Patterns
- `*name*` - Original filename from URL (without extension)
- `*ext*` - File extension (jpg, png, gif, etc.)
- `*fullname*` - Original filename with extension

#### URL Segments
- `*domain*` - Domain name (e.g., "example.com")
- `*hostname*` - Hostname without TLD (e.g., "example")
- `*path*` - Full URL path

#### Numbering & Time
- `*num*` - Sequential number (001, 002, 003...)
- `*num-3*` - 3-digit number with leading zeros
- `*num-5*` - 5-digit number with leading zeros
- `*date*` - Current date (YYYY-MM-DD)
- `*time*` - Current time (HH-MM-SS)
- `*datetime*` - Date and time combined

#### Gallery Info
- `*page*` - Current page number
- `*caption*` - Image caption/alt text
- `*gallery*` - Gallery name from page

#### Example Patterns
- `*num-3*-*name*.*ext*` → 001-sunset.jpg, 002-ocean.jpg
- `*date*-*num*.*ext*` → 2025-10-25-1.jpg
- `*domain*-*page*-*num*.*ext*` → example-1-001.jpg

### Download Organization

- **Download Folder**: Specify a subfolder (e.g., `StepFour/Galleries/Nature`)
- Files will be saved to: `Downloads/[Your Folder]/[Filename]`
- Folder hierarchy is created automatically

## File Structure

```
StepFour/
├── manifest.json              # Extension configuration (Manifest V3)
├── service-worker.js          # Background service worker
├── content-script.js          # Page interaction script
├── dashboard/
│   ├── dashboard.html         # Side panel UI
│   ├── dashboard.js           # Dashboard logic
│   └── dashboard.css          # Dashboard styles
├── icons/
│   ├── icon16.png            # 16x16 toolbar icon
│   ├── icon48.png            # 48x48 extension icon
│   └── icon128.png           # 128x128 Chrome Web Store icon
└── README.md                  # This file
```

## Supported Pagination Methods

### 1. Next Button
- Detects `<a>` or `<button>` elements with "Next", "→", "Continue"
- Common selectors: `.next`, `[rel="next"]`, `.pagination-next`

### 2. Load More Button
- Detects buttons with "Load More", "Show More", "View More"
- Clicks repeatedly until button disappears or is disabled

### 3. Infinite Scroll
- Automatically scrolls to trigger content loading
- Detects when no more content loads

### 4. Arrow Navigation
- Detects arrow elements: ">", "›", "»"
- Common in image galleries and carousels

### 5. URL Pattern Increment
- Detects URL patterns like `?page=1`, `/page/2/`, `&p=3`
- Automatically increments and navigates

### 6. API-Based (Proof of Concept)
- Monitors network requests for JSON responses
- Extracts pagination tokens from API responses

## Technical Details

- **Manifest Version**: V3 (Chrome 2025 compliant)
- **Permissions**: activeTab, downloads, scripting, storage, sidePanel
- **Architecture**: Service worker + Content scripts + Side panel
- **Privacy**: All processing is local, no data leaves your browser
- **No Dependencies**: Pure vanilla JavaScript, no external libraries

## Color Scheme

- **Primary**: #2196F3 (Chrome Blue)
- **Secondary**: #4CAF50 (Success Green)
- **Warning**: #FF9800 (Orange)
- **Background**: #F5F5F5 (Light Grey)
- **Text**: #212121 (Dark Grey)

## Browser Compatibility

- **Chrome**: 88+ (Manifest V3 support required)
- **Edge**: 88+ (Chromium-based)
- **Brave**: 88+
- **Opera**: 74+

## Troubleshooting

### Gallery Not Detected
- Try refreshing the page after loading the extension
- Some dynamic galleries require scrolling to load images
- Check if the page has sufficient images (10+ recommended)

### Pagination Not Working
- Try switching pagination methods manually
- Some sites use custom pagination that may require site-specific rules
- Check console for errors (F12 → Console tab)

### Downloads Failing
- Ensure Chrome has download permissions
- Check if download folder path is valid
- Some images may be blocked by CORS or authentication

### Images Not Appearing
- Wait for page to fully load before starting pagination
- Some sites use lazy loading - scroll down manually first
- Check if images are actually `<img>` elements (not background images)

## Privacy & Security

- **Local Processing**: All data processing happens locally in your browser
- **No External Servers**: Extension does not send data to any external servers
- **No Tracking**: No analytics, telemetry, or user tracking
- **Open Source**: All code is readable and non-minified for transparency

## License

This extension is provided as-is for educational and personal use.

## Version History

- **v1.0.0** (2025-10-25): Initial release
  - Gallery auto-detection
  - Multi-method pagination (6 methods)
  - Image extraction with metadata
  - CSV export
  - Bulk download with custom filename patterns
  - Side panel dashboard
