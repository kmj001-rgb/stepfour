# Site Profiles Implementation

This document details the implementation of site-specific profiles for major image agencies in the Gallery Scraper Pro Chrome extension.

## Overview

Site profiles provide optimized scraping configurations for specific websites, dramatically improving compatibility and success rates while maintaining universal functionality for any gallery-style page.

## Implemented Profiles

### 1. Getty Images (gettyimages.com / gettyimages.co.uk)
**Status:** ✅ Implemented and Enhanced
**Authentication:** Not required for browsing
**Profile Features:**
- Enhanced selectors based on user-provided HTML sample
- Optimized for mosaic asset layouts and gallery views
- Supports both .com and .co.uk domains
- Advanced pagination detection
- Infinite scroll and lazy loading support

### 2. Mirrorpix (mirrorpix.com)
**Status:** ✅ Implemented and Refined (January 2025)
**Authentication:** Not required for browsing
**Profile Features:**
- **REFINED SELECTORS:** Updated based on complete HTML source provided by user
- **Primary Image Pattern:** `img.medium-thumbnail` with unique ID pattern `medium__[hash]`
- **Dynamic Thumbnails:** Uses `/thumb.php/[id].jpg?[encoded_params]` for image serving
- **Complex Class Structure:** Images have multiple descriptive classes including file type and drag functionality
- **jQuery UI Integration:** Supports ui-draggable interface and webgate.js framework
- **Traditional Pagination:** Uses numbered buttons and next/previous navigation (confirmed by user)
- **Historical Archive:** Optimized for Reach PLC's extensive newspaper photo archive

**Key Selector Updates:**
```javascript
imageContainer: 'img.medium-thumbnail, img[id^="medium__"], img[src*="thumb.php"]',
imageElement: 'img.medium-thumbnail, img[id^="medium__"], img[src*="thumb.php"]',
linkElement: 'a:has(img.medium-thumbnail), img.medium-thumbnail[onclick]',
nextPageButton: '.pagination .next, .pagination-next, [href*="page="]'
```

### 3. ActionPress (actionpress.de)
**Status:** ✅ Implemented
**Authentication:** May require login for full access
**Profile Features:**
- German news agency optimization
- Editorial and sports content focus
- European media licensing support

### 4. SmartFrame / Archive News Images
**Status:** ✅ Implemented
**Domains:** news-images.smartframe.io, archive.newsimages.co.uk
**Profile Features:**
- SmartFrame viewer integration
- Archive-specific navigation patterns
- News media optimization

### 5. Imago Images (imago-images.com)
**Status:** ✅ Implemented
**Authentication:** May require login for licensing
**Profile Features:**
- International sports and news focus
- European image agency optimization
- Multi-language support considerations

### 6. Shutterstock (shutterstock.com)
**Status:** ✅ Implemented
**Authentication:** Account recommended for full access
**Profile Features:**
- Stock photography optimization
- Grid layout support
- Subscription-based access patterns

## Technical Implementation

### Profile Structure
Each site profile contains:
- **selectors**: Optimized CSS selectors for the site's DOM structure
- **waitSettings**: Timing configurations for page loads and interactions
- **scrollBehavior**: Scroll strategy and limits
- **special**: Site-specific flags and behaviors

### Integration Points
1. **Detection**: Automatic site detection in `background.js`
2. **Merging**: Profile settings merged with user preferences
3. **Application**: Site-specific logic applied in `content.js`
4. **Fallback**: Universal selectors used if site-specific ones fail

### Profile Detection
```javascript
function detectSiteProfile(url) {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [pattern, profile] of Object.entries(SITE_PROFILES)) {
        if (hostname.includes(pattern)) return profile;
    }
    return null;
}
```

## Usage and Benefits

### For Users
- **Improved Success Rates**: Site-specific optimizations increase scraping reliability
- **Faster Processing**: Optimized wait times and selectors reduce scraping duration
- **Better Compatibility**: Handles site-specific features like infinite scroll, authentication flows
- **Transparent Operation**: Profiles activate automatically, no user configuration required

### For Developers
- **Modular Design**: Easy to add new profiles without affecting existing functionality
- **Comprehensive Testing**: Each profile includes detailed testing scenarios
- **Documentation**: Extensive comments and documentation for maintenance
- **Fallback Safety**: Universal functionality maintained for unknown sites

## Testing and Validation

Comprehensive testing procedures are documented in `SITE_PROFILES_TESTING.md`, including:
- Profile activation verification
- Selector accuracy testing
- Cross-browser compatibility
- Performance impact assessment
- Error handling validation

## Future Enhancements

- Additional major image agencies
- Dynamic profile updates
- User-customizable profiles
- Performance analytics and optimization
- A/B testing for selector improvements

## Documentation References

- `SITE_PROFILES_TESTING.md` - Comprehensive testing guide
- `SITE_PROFILES_SUMMARY.md` - Implementation summary
- `README.md` - User-facing documentation
- `background.js` - Profile definitions and detection logic
- `content.js` - Profile application and scraping logic