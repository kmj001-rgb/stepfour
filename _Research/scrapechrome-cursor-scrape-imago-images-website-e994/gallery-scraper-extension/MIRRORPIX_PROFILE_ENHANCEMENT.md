# Mirrorpix Profile Enhancement

## Overview
Enhanced the Mirrorpix site profile based on comprehensive HTML analysis provided by the user. This update significantly improves scraping reliability for the Mirrorpix historical photo archive.

## Key HTML Analysis Findings

### Image Structure
The actual HTML shows a sophisticated image class system:
```html
<img class="medium medium-02031305 medium-thumbnail medium-vm-float medium-filetype-jpeg medium-image medium-static medium-draggable ui-draggable" 
     alt="02031305" 
     loading="lazy" 
     height="133" 
     width="200" 
     id="medium__29aeda4c8284" 
     src="/thumb.php/02031305.jpg?eJwljLsKAjEQRf_l1ikmjzGbdJJJGwVVQQa1EJck2YrFqJf6746aZw-Fc5oO0RKy3-7MopBUiIDwjasFlxmbdsJVYHuN1HCbZ9GJkyGpL_NfjPDq0mxr6Bkmv6S3_T5Ktwh7RECnsRKHZdLmw6zI5z1w4LJy2odbBlxB8xvcHPCMmoQ~~">
```

### Site Architecture
- **Backend**: Uses webgate framework with extensive jQuery UI components
- **Theme**: Legacy theme3 system with custom CSS and webfonts
- **JavaScript**: Multiple libraries including webgate.js (v132), gui.js (v161)
- **Image System**: PHP-based thumbnail generation with encoded parameters
- **Search**: Advanced search form with geographic filtering and autocomplete

## Enhanced Selectors

### Image Detection
**Previous**: Basic medium-thumbnail and PHP thumb detection
**Enhanced**: Comprehensive class-based targeting with fallbacks
```javascript
imageContainer: 'img.medium-thumbnail, img[class*="medium-thumbnail"], img[id^="medium__"], img[src*="thumb.php"], img.medium-image, img.ui-draggable, .result-item img, .search-result img, .media-item img'
```

### Link Detection
**Previous**: Simple has() selectors
**Enhanced**: Includes clickable images and onclick handlers
```javascript
linkElement: 'a:has(img.medium-thumbnail), a:has(img[class*="medium-thumbnail"]), a:has(img[id^="medium__"]), a:has(img[src*="thumb.php"]), a[href*="detail"], a[href*="media"], a[onclick*="medium"], a[href*="view"], a[href*="result"], a[href*="thumb"], img.medium-thumbnail[onclick], img[id^="medium__"][onclick]'
```

### Pagination Detection
**Previous**: Basic pagination selectors
**Enhanced**: Comprehensive webgate.js and jQuery UI pagination targeting
```javascript
nextPageButton: '.pagination .next, .pagination-next, .pager .next, .ui-pagination .next, button[title*="Next"], a[title*="Next"], button[title*="next"], a[title*="next"], [class*="next"][class*="page"], button:contains("Next"), a:contains("Next"), .ui-button:contains("Next"), .webgate-pagination .next, .jquery-pagination .next, [onclick*="nextPage"], [href*="next"], .pagination a[rel="next"]'
```

## Improved Wait Settings

### Timing Adjustments
- **pageLoad**: 9000ms → 10000ms (complex jQuery UI system)
- **scrollDelay**: 1500ms → 2000ms (draggable initialization + lazy loading)
- **afterScroll**: 3000ms → 4000ms (SmartFrame integration + AJAX)

### Scroll Behavior
- **maxScrolls**: 25 → 30 (deeper archive coverage)
- **checkInterval**: 1500ms → 2000ms (complex JavaScript processing)

## New Special Features Detected

### JavaScript Libraries
- **jquery.autocomplete.js**: Search suggestions
- **jquery.mousewheel.js**: Enhanced scrolling
- **jquery.cookie.js**: State management
- **jquery.hotkeys.js**: Keyboard shortcuts
- **jquery.jscrollpane.js**: Custom scrolling
- **jquery.touchSwipe.min.js**: Mobile support
- **jquery.treeview.js**: Hierarchical navigation
- **caman.full.pack.js**: Image manipulation
- **dropzone.min.js**: File uploads
- **leaflet.js**: Geographic mapping
- **jwplayer.js**: Video content

### Framework Features
- **webgate.js (v132)**: Custom gallery framework
- **gui.js (v161)**: Interface management
- **SmartFrame integration**: Embed code generator
- **Cookiebot**: GDPR compliance
- **Theme3 system**: Legacy CSS with webfonts

### Archive Characteristics
- **Reach PLC Archive**: Daily Mirror, Sunday Mirror, Daily Record, etc.
- **Historical Coverage**: Extensive UK newspaper photo archive
- **Complex Search**: Geographic filtering, advanced search forms
- **Draggable Interface**: jQuery UI draggable images
- **Context Menus**: Right-click functionality
- **Progress Indicators**: Loading states and progress bars

## Testing Recommendations

### Primary Tests
1. **Image Detection**: Verify medium-thumbnail class targeting
2. **Link Extraction**: Test both wrapped and onclick images
3. **Pagination**: Test numbered buttons and next/previous
4. **Performance**: Monitor 10s page load timeouts

### Edge Cases
1. **JavaScript Heavy Pages**: Allow extra time for jQuery UI
2. **Lazy Loading**: Test scroll-triggered image loading
3. **Draggable Interface**: Ensure no interference with scraping
4. **SmartFrame Embeds**: Handle embedded content properly

## Compatibility Notes

### Browser Compatibility
- Supports legacy jQuery versions (1.12.4)
- Uses jQuery Migrate for compatibility
- Extensive polyfill usage
- Mobile touch support included

### Performance Considerations
- Heavy JavaScript load (10+ libraries)
- Legacy theme system may be slower
- PHP thumbnail generation adds latency
- SmartFrame embeds require extra wait time

## Results Expected

### Improved Detection
- Higher success rate for image identification
- Better link extraction from complex DOM
- More reliable pagination navigation
- Enhanced handling of lazy-loaded content

### Performance
- Optimized wait times for complex JavaScript
- Better scroll behavior for deep archives
- Improved handling of interactive elements
- More robust timeout handling

## Conclusion

This enhancement transforms the Mirrorpix profile from basic pattern matching to comprehensive DOM understanding. The profile now accounts for the sophisticated webgate framework, extensive jQuery UI usage, and complex image class system used by this major UK newspaper archive.

The enhanced selectors, improved timing, and comprehensive special feature detection should significantly improve scraping success rates while maintaining compatibility with Mirrorpix's complex technical architecture.