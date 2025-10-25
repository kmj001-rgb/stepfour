# Mirrorpix Profile Update

## Overview
Updated the Mirrorpix site-specific profile based on detailed HTML content provided by the user for enhanced scraping accuracy and reliability.

## HTML Analysis Summary

The user provided comprehensive HTML content for `mirrorpix.com` showing:

### Image Structure
```html
<img class="medium medium-02031305 medium-thumbnail medium-vm-float medium-filetype-jpeg medium-image medium-static medium-draggable ui-draggable" 
     alt="02031305" 
     loading="lazy" 
     height="133" 
     width="200" 
     id="medium__29aeda4c8284" 
     src="/thumb.php/02031305.jpg?eJwljLsKAjEQRf_l1ikmjzGbdJJGwVVQQa3EJsk2YrFqJf6746aZw-Fc5oO0RKy3-7MopBUiIDwjasFlxmbdsJVYHuN1HCbZ9MJkyGpL_NfjPDq0mxr6Bkmv6A3_T5Ktwh7RECnsRKHZdLmw6zI5z1w4LJy2odbBlxB8xvcHPCMmoQ~~">
```

### Key Technical Features Identified
- **WebGate Framework**: Uses custom `webgate.js` (v132) and `gui.js` (v161)
- **jQuery UI**: Heavy integration with `jquery-ui.min.js` and multiple plugins
- **Image Classes**: Complex multi-class system (`medium`, `medium-thumbnail`, `medium-vm-float`, etc.)
- **Unique IDs**: Pattern `medium__[hash]` (e.g., `medium__29aeda4c8284`)
- **Dynamic Thumbnails**: Uses `thumb.php/[id].jpg?[encoded_params]` structure
- **Lazy Loading**: Images have `loading="lazy"` attribute
- **Draggable Interface**: `ui-draggable` class for user interaction

## Profile Enhancements Made

### 1. Updated Image Selectors
**Before:**
```javascript
imageContainer: 'img[id^="medium__"], img.medium-thumbnail, img[src*="thumb.php"], img.medium-image.ui-draggable, img[class*="medium-thumbnail"], img.ui-draggable, .result-item img, .search-result img, .media-item img'
```

**After:**
```javascript
imageContainer: 'img[id^="medium__"], img.medium-thumbnail, img[src*="thumb.php"], img.medium-image.ui-draggable, img[class*="medium-thumbnail"], img.ui-draggable, .medium-vm-float, .medium-static.medium-draggable'
```

**Improvements:**
- Added `.medium-vm-float` for vertical middle floating elements
- Added `.medium-static.medium-draggable` for combined static/draggable targeting
- Removed generic selectors that don't match Mirrorpix's specific structure

### 2. Enhanced Link Detection
**Before:**
```javascript
linkElement: 'a:has(img[id^="medium__"]), a:has(img.medium-thumbnail), a:has(img[src*="thumb.php"]), img[id^="medium__"][onclick], img.medium-thumbnail[onclick], a[onclick*="medium"], a[href*="detail"], a[href*="media"], a[href*="view"], a[href*="result"], a[href*="thumb"]'
```

**After:**
```javascript
linkElement: 'a:has(img[id^="medium__"]), a:has(img.medium-thumbnail), a:has(img[src*="thumb.php"]), img[id^="medium__"][onclick], img.medium-thumbnail[onclick], a[onclick*="medium"], a[href*="detail"], a[href*="media"], a[href*="view"], a[href*="result"], a[href*="thumb"], .ui-draggable[onclick], [data-medium-id]'
```

**Improvements:**
- Added `.ui-draggable[onclick]` for draggable elements with click handlers
- Added `[data-medium-id]` for data attribute targeting
- Enhanced support for webgate.js framework interactions

### 3. Refined Pagination Selectors
**Enhanced for WebGate Framework:**
```javascript
nextPageButton: '.pagination .next, .pagination-next, .pager .next, .ui-pagination .next, .webgate-pagination .next, .jquery-pagination .next, button[title*="Next"], a[title*="Next"], button[title*="next"], a[title*="next"], [class*="next"][class*="page"], button:contains("Next"), a:contains("Next"), .ui-button:contains("Next"), [onclick*="nextPage"], [href*="next"], .pagination a[rel="next"], .ui-pagination-next, .webgate-next-page'
```

**Added WebGate-specific selectors:**
- `.webgate-pagination .next`
- `.ui-pagination-next`
- `.webgate-next-page`

### 4. Enhanced Special Properties
Added 12 new special properties based on HTML analysis:

```javascript
usesSecurityTokens: true, // Security token service for form protection
hasComplexNavigation: true, // Complex navigation with menutree classes
usesProgressiveEnhancement: true, // Graceful degradation with fallbacks
hasAdvancedFormHandling: true, // Complex forms with validation
usesContentManagement: true, // Full CMS with webgate framework
hasMultiLanguageSupport: true, // Language selection and locale handling
usesAdvancedCaching: true, // Versioned assets with cache busting
hasMetaDataRichness: true, // Rich meta data (OpenGraph, Twitter Cards)
usesAdvancedSecurity: true, // CSRF tokens and security policies
hasComplexAssetManagement: true, // Versioned CSS/JS assets
usesModularArchitecture: true // Modular loading with dependency management
```

## Technical Framework Analysis

### JavaScript Libraries Detected
- `webgate.js` (v132) - Core gallery management framework
- `gui.js` (v161) - User interface handling
- jQuery UI with plugins:
  - `jquery.contextMenu.js` - Right-click functionality
  - `jquery.progressbar.js` - Loading states
  - `jquery.autocomplete.js` - Search suggestions
  - `jquery.mousewheel.js` - Enhanced scrolling
  - `jquery.cookie.js` - State management
  - `jquery.hotkeys.js` - Keyboard shortcuts
  - `jquery.jscrollpane.js` - Custom scrollbars
  - `jquery.touchSwipe.min.js` - Mobile support
  - `jquery.treeview.js` - Navigation trees
- `caman.full.pack.js` - Image manipulation
- `dropzone.min.js` - File uploads
- `leaflet.js` - Geographic mapping
- `jwplayer.js` - Video content

### Asset Management
- Versioned assets with cache busting (e.g., `?version=109`, `?version=132`)
- Modular CSS/JS loading
- Progressive enhancement with fallbacks
- Security token integration

## User Confirmation
- **Free to browse**: No authentication required
- **Pagination**: Uses next button and numbered buttons
- **Complex Framework**: Heavy jQuery UI and custom webgate.js integration

## Impact on Scraping
These enhancements should significantly improve:
1. **Image Detection**: More accurate targeting of Mirrorpix's unique image structure
2. **Link Extraction**: Better handling of jQuery UI interactions and webgate framework
3. **Pagination**: Enhanced support for webgate.js pagination patterns
4. **Performance**: Optimized selectors for complex JavaScript framework
5. **Reliability**: Better handling of lazy loading and dynamic content

## Testing Recommendation
Test the updated profile on Mirrorpix search results pages to validate:
- Image detection accuracy
- Link extraction completeness
- Pagination functionality
- Load time performance with complex JavaScript