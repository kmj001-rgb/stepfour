# StepThree Dashboard Guide

This guide provides a comprehensive explanation of all elements and features available on the StepThree Gallery Scraper dashboard.

## Table of Contents

- [Header Section](#header-section)
- [Quick Stats](#quick-stats)
- [Actions](#actions)
- [Pagination Options](#pagination-options)
- [Progress & Control](#progress--control)
- [Export Options](#export-options)
- [Settings](#settings)
- [Activity Log](#activity-log)
- [Footer](#footer)

---

## Header Section

The header appears at the top of the dashboard and provides essential status information.

### Gallery Scraper Title
- **Icon**: StepThree logo (32x32px)
- **Title**: "Gallery Scraper"
- Identifies the extension and its primary purpose

### Connection Status
- **Display**: Shows "Connected" with a status indicator dot
- **Purpose**: Indicates the extension's connection state with the current page
- **States**:
  - **Connected**: Green dot - Extension is active and ready
  - **Disconnected**: Red dot - Extension cannot communicate with the page
  - **Connecting**: Yellow dot - Extension is initializing

### Page Info
- **Display**: Shows current page context (e.g., domain, page type)
- **Purpose**: Provides quick reference to what page you're currently analyzing

### Agents
- **Display**: "Agents · GitHub Copilot"
- **Purpose**: Shows which AI agents or assistants are available or active

---

## Quick Stats

A collapsible card providing at-a-glance metrics of your scraping session.

### Total Items
- **Display**: Numeric count (e.g., "0", "150")
- **Purpose**: Shows the total number of images or items detected/collected
- **Updates**: Real-time as items are discovered during scanning

### Progress
- **Display**: Percentage (e.g., "0%", "45%", "100%")
- **Purpose**: Indicates completion progress of the current scraping operation
- **Calculation**: Based on items processed vs. total items found

---

## Actions

The primary action controls for initiating scraping operations.

### 🔍 Start Auto-Detect (Images & Tables)
- **Type**: Primary action button
- **Purpose**: Automatically detects and extracts images and table data from the current page
- **Functionality**:
  - Scans the entire page for image galleries
  - Identifies table structures
  - Uses intelligent detection algorithms to find content patterns
  - Provides one-click operation for most common use cases

### Include Table Data
- **Type**: Checkbox toggle
- **Purpose**: Controls whether table data is included in the extraction
- **States**:
  - **Checked**: Extracts both images AND tabular data
  - **Unchecked**: Extracts only images
- **Use Case**: Enable when pages contain structured data in tables alongside images

### 🎯 Manual Selector Mode
- **Type**: Secondary action button (under "Advanced Tools" dropdown)
- **Purpose**: Allows manual selection of specific elements on the page
- **Functionality**:
  - Activates element picker mode
  - Click on any element on the page to select it
  - Useful for targeting specific galleries or unusual page structures
  - Provides more control when auto-detection isn't perfect

---

## Pagination Options

Comprehensive controls for multi-page scraping operations.

### Auto-pagination
- **Type**: Toggle switch
- **Default**: Enabled (checked)
- **Purpose**: Automatically navigate through multiple pages of a gallery or listing
- **Behavior**:
  - Detects "Next" buttons
  - Identifies "Load More" buttons
  - Recognizes numbered page links (1, 2, 3...)
  - Continues until reaching the last page or maximum page limit

### Next Button Selector (optional)
- **Type**: Text input field with picker button
- **Purpose**: Specify a custom CSS selector for the pagination "Next" button
- **Usage**:
  - **Manual Entry**: Type CSS selector directly (e.g., `a[rel="next"]`)
  - **🎯 Pick**: Click to activate element picker, then click the Next button on the page
  - **Example Selectors**:
    - `a[rel="next"]` - Standard next link
    - `.pagination .next` - Class-based selector
    - `button[aria-label*="Next"]` - Accessible button
    - `div.tw-ml-2.lg:tw-ml-8.tw-justify-center.lg:tw-mr-8.md:tw-justify-between` - Complex Tailwind CSS selector
- **When to Use**: When auto-detection fails to find the correct Next button

### Maximum Pages
- **Type**: Dropdown select
- **Default**: 10 pages
- **Options**: 1, 3, 5, 10, 20, 50, 100, or Unlimited (999)
- **Purpose**: Safety limit to prevent runaway scraping
- **Recommendation**: 
  - Start with 10 pages for testing
  - Increase for large galleries
  - Use "Unlimited" only when you trust the site's pagination

### Pagination Delay
- **Type**: Numeric input
- **Default**: 2000 milliseconds (2 seconds)
- **Range**: 500ms to 10,000ms
- **Purpose**: Wait time between navigating pages
- **Benefits**:
  - Prevents server overload
  - Reduces risk of being blocked
  - Allows time for JavaScript content to load
  - Mimics human browsing behavior
- **Recommendation**:
  - 1000-2000ms for fast, static sites
  - 3000-5000ms for JavaScript-heavy sites
  - 5000ms+ for rate-limited sites

### How It Works
**Information Box**: Explains the pagination detection mechanism

The extension employs multiple detection strategies:
1. **Button Detection**: Looks for "Next", "→", "More" buttons
2. **Link Analysis**: Identifies numbered page links (1, 2, 3...)
3. **Load More**: Detects infinite scroll and dynamic loading buttons
4. **Pattern Recognition**: Learns from page structure to predict pagination
5. **URL Analysis**: Examines URL patterns (page=2, ?p=3, /page/4/)

The system automatically navigates pages and collects images until:
- Reaching the maximum page limit
- Detecting the last page (no more Next button)
- Encountering a duplicate page (loop prevention)

---

## Progress & Control

Dynamic section that appears during active scraping operations.

### Progress Bar
- **Display**: Visual progress indicator with percentage
- **Updates**: Real-time during scraping
- **Shows**: Current operation status and completion percentage

### Progress Text
- **Display**: Text status (e.g., "Ready", "Scanning page 3/10", "Processing images...")
- **Purpose**: Provides detailed status information

### Control Buttons

#### ⏸️ Pause
- **Purpose**: Temporarily halt the scraping operation
- **Behavior**:
  - Maintains current position
  - Can be resumed later
  - Useful when you need to review progress

#### ⏹️ Stop
- **Purpose**: Completely stop the scraping operation
- **Behavior**:
  - Terminates the current session
  - Saves already-collected data
  - Cannot be resumed (must start fresh)

---

## Export Options

Advanced data export configuration (collapsible card).

### Quick Presets
Pre-configured export settings for common use cases:

#### Quick Basic
- CSV + Excel formats
- Core fields only (filename, URL, dimensions)
- Fast export for simple needs

#### Complete Dataset
- All formats enabled (CSV, Excel, JSON, HTML)
- All available fields included
- Advanced metadata included
- Comprehensive export for analysis

#### Web Report
- HTML format
- Visual fields emphasized
- Formatted for web viewing

### Export Formats
Multiple format options (multiple can be selected):

#### 📊 CSV
- **Purpose**: Comma-separated values for spreadsheets
- **Use Case**: Excel, Google Sheets, data analysis
- **Benefits**: Universal compatibility, lightweight

#### 📈 Excel (XLSX)
- **Purpose**: Native Excel format with formatting
- **Use Case**: Professional reports, data analysis
- **Benefits**: Preserves formatting, supports multiple sheets

#### 📋 JSON
- **Purpose**: Structured data format
- **Use Case**: Programming, APIs, data processing
- **Benefits**: Hierarchical data, machine-readable

#### 🌐 HTML
- **Purpose**: Web page format
- **Use Case**: Visual reports, web publishing
- **Benefits**: Formatted display, embeddable images

### Export Fields
Granular control over which data fields to include:

#### Core Data Fields
- **Target Filename**: Original or generated filename
- **Full Resolution Link**: Direct URL to full-size image
- **Thumbnail Link**: URL to thumbnail version (if available)
- **Dimensions (Width px)**: Image width in pixels
- **Dimensions (Height px)**: Image height in pixels
- **Image Caption / Alt Text**: Descriptive text from alt attribute
- **Source Page Link**: URL of the page where image was found
- **Capture Timestamp**: Date/time when image was extracted

#### Advanced Metadata Fields
- **Extraction Quality (%)**: Confidence score of extraction accuracy
- **Discovery Method**: How the image was detected (auto, manual, table, etc.)

### Field Selection Shortcuts
- **Select All**: Enable all available fields
- **Common**: Select most frequently used fields
- **Clear**: Deselect all fields

### Include Advanced Metadata
- **Type**: Checkbox toggle
- **Purpose**: Add technical metadata to exports
- **Includes**:
  - Extraction method used
  - Confidence scores
  - Performance metrics
  - Processing timestamps

---

## Settings

Comprehensive configuration options for customizing extension behavior.

### General Settings

#### Auto-detect Galleries
- **Default**: Enabled
- **Purpose**: Automatically detect gallery pages when loading websites
- **Behavior**: Shows indicators when galleries are detected

#### Download Images
- **Default**: Enabled
- **Purpose**: Automatically download found images
- **Behavior**: 
  - Enabled: Images are downloaded to your computer
  - Disabled: Images are only cataloged/listed

#### Keyboard Shortcuts
- **Default**: Enabled
- **Purpose**: Enable quick-access keyboard commands
- **Shortcuts**:
  - `Ctrl+Shift+S`: Start scan
  - Additional shortcuts available in settings

#### Context Menu Integration
- **Default**: Enabled
- **Purpose**: Right-click menu actions for quick scraping
- **Behavior**: Adds "StepThree" options to browser right-click menu

### Performance & Extraction Strategy

#### Max Concurrent Downloads
- **Default**: 5
- **Options**: 1, 2, 3, 5, 8, 10
- **Purpose**: Number of simultaneous image downloads
- **Consideration**: 
  - Higher = faster completion
  - Lower = more stable, less server load

#### Smart Filtering
- **Default**: Enabled
- **Purpose**: Use pattern recognition to improve result quality
- **Benefits**: Filters out icons, buttons, decorative images

#### Advanced Filtering
- **Default**: Enabled
- **Purpose**: Enhanced content filtering with regex and dimension checks
- **Benefits**: More precise filtering based on custom rules

#### Memory Optimization
- **Default**: Enabled
- **Purpose**: Optimize memory usage for large galleries
- **Benefits**: Prevents browser slowdown on pages with 100s of images

#### Dynamic Content Load Wait
- **Default**: 2000ms
- **Range**: 500ms to 30,000ms
- **Purpose**: Time to wait after page loads before scanning
- **Use Case**: JavaScript-heavy pages that load content dynamically

#### Scroll Delay
- **Default**: 1000ms
- **Range**: 100ms to 10,000ms
- **Purpose**: Delay between scroll attempts
- **Use Case**: Helps load lazy-loaded images that appear on scroll

### Download Settings

#### Download Folder
- **Default**: "StepThree"
- **Purpose**: Custom folder name for organizing downloads
- **Behavior**: Creates subfolder in your Downloads directory

#### Filename Mask
- **Default**: `*name*.*ext*`
- **Purpose**: Pattern for naming downloaded files
- **Available Patterns**:

##### Basic Patterns
- `*name*`: Original filename without extension
- `*ext*`: File extension (jpg, png, etc.)
- `*domain*`: Website domain (e.g., "example.com")
- `*url*`: Full URL including subdomains
- `*subdirs*`: Full directory path from URL

##### URL Segments
- `*segment[1]*`: First path segment
- `*segment[2]*`: Second path segment
- `*segment[3]*`: Third path segment
- `*segment[4]*`: Fourth path segment

##### Numbering & Time
- `*num*`: Incremental number (prevents duplicates)
- `*y*`: Year (e.g., "2025")
- `*m*`: Month (e.g., "10")
- `*d*`: Day (e.g., "25")
- `*hh*`: Hours (24-hour format)
- `*mm*`: Minutes
- `*ss*`: Seconds

**Example Patterns**:
- `*domain*-*num*.*ext*` → "example-001.jpg"
- `*y*-*m*-*d*_*name*.*ext*` → "2025-10-25_photo.jpg"
- `*segment[1]*/*name*.*ext*` → "gallery/image.jpg"

#### Retry Attempts
- **Default**: 3
- **Options**: 0, 1, 2, 3, 5, 10
- **Purpose**: Number of times to retry failed downloads
- **Use Case**: Handles temporary network issues or rate limiting

### Advanced Settings

#### Debug Mode
- **Default**: Disabled
- **Purpose**: Enable detailed debug logs for troubleshooting
- **Output**: Console logs with technical information
- **Use Case**: Diagnosing issues or understanding extension behavior

### Settings Actions

#### Reset to Defaults
- **Purpose**: Restore all settings to factory defaults
- **Warning**: This cannot be undone

#### Save Settings
- **Purpose**: Persist current settings across browser sessions
- **Behavior**: Saves to browser's local storage

---

## Activity Log

Scrollable log of operations and events (collapsible card).

### Log Entries
Each entry contains:
- **Timestamp**: Time of event (HH:MM format)
- **Message**: Description of what occurred

### Example Log Entries
- "Ready to start..." - Initial state
- "Scanning page for images..." - Scan initiated
- "Found 24 images on page 1" - Detection complete
- "Navigating to page 2..." - Pagination in progress
- "Download complete: 150 images" - Operation finished
- "Error: Unable to access element" - Error notification

### Purpose
- Track extension activity
- Debug issues
- Monitor progress
- Review operation history

---

## Footer

Bottom section providing utility actions and version information.

### Version Display
- **Display**: "StepThree v2.0"
- **Purpose**: Shows current extension version
- **Use Case**: Helpful for support and bug reporting

### 🐛 Debug Panel
- **Icon Button**: Bug emoji
- **Purpose**: Opens detailed debug panel
- **Contents**: 
  - Technical diagnostics
  - Connection status
  - Performance metrics
  - Error logs

### ❓ Help & Support
- **Icon Button**: Question mark emoji
- **Purpose**: Access help resources
- **Links To**:
  - Documentation
  - User guides
  - Support contact
  - Feature tutorials

---

## Tips for Using the Dashboard

### Getting Started
1. Open the StepThree extension panel
2. Navigate to a page with images
3. Check that connection status shows "Connected"
4. Click "Start Auto-Detect" to begin

### Customizing Your Workflow
1. Adjust pagination settings for your target site
2. Configure export formats based on your needs
3. Use Manual Selector Mode for complex pages
4. Save settings to persist your preferences

### Troubleshooting
1. Check Activity Log for error messages
2. Enable Debug Mode for detailed information
3. Use Debug Panel for technical diagnostics
4. Verify connection status is "Connected"

### Best Practices
- Start with default settings
- Test on a few pages before large scraping operations
- Use appropriate pagination delays (2000ms recommended)
- Review export data before final export
- Save settings after finding optimal configuration

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Start scan |
| `Ctrl+Shift+P` | Pause/Resume |
| `Ctrl+Shift+X` | Stop operation |
| `Ctrl+Shift+E` | Export data |

*Note: Keyboard shortcuts must be enabled in Settings*

---

## Common Use Cases

### Use Case 1: Simple Image Gallery Download
1. Navigate to gallery page
2. Click "Start Auto-Detect"
3. Wait for completion
4. Images download automatically

### Use Case 2: Multi-Page Product Catalog
1. Enable Auto-pagination
2. Set Maximum Pages (e.g., 20)
3. Set Pagination Delay (2000ms)
4. Click "Start Auto-Detect"
5. Extension navigates pages automatically

### Use Case 3: Custom Selector for Unusual Site
1. Click "Manual Selector Mode"
2. Click on target element on page
3. Confirm selection
4. Click "Start Auto-Detect"

### Use Case 4: Data Export for Analysis
1. Complete scraping operation
2. Open Export Options
3. Select CSV and Excel formats
4. Select all desired fields
5. Enable "Include Advanced Metadata"
6. Click Export

---

## Glossary

- **Auto-pagination**: Automatic navigation through multiple pages
- **CSS Selector**: A pattern used to identify HTML elements
- **Content Hashing**: Duplicate detection technique
- **Element Picker**: Interactive tool for selecting page elements
- **Lazy Loading**: Technique where images load only when visible
- **Pagination**: Multiple pages of content (page 1, 2, 3, etc.)
- **Scraping**: Automated extraction of data from web pages
- **Shadow DOM**: Encapsulated DOM subtrees in modern web components

---

## Support

For additional help:
- Click the ❓ Help button in the footer
- Check the Activity Log for error messages
- Enable Debug Mode for detailed diagnostics
- Consult the [full documentation](PAGINATION_DOCUMENTATION.md)

---

*Last Updated: October 2025*
*StepThree Gallery Scraper v2.0*
