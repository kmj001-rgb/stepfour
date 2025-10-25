# Site-Specific Profiles Testing Guide

This document provides a comprehensive testing guide for the site-specific profiles feature implemented in Gallery Scraper Pro.

## 🎯 Overview

The extension now includes optimized profiles for major photo agencies and image sites. Each profile contains:
- **Site-specific selectors** for images, containers, links, and pagination
- **Optimized wait times** and scroll behaviors
- **Special handling** for unique site features

## 📋 Supported Sites

### ✅ Implemented Profiles

| Site | Profile Name | Login Required | Special Features |
|------|-------------|----------------|------------------|
| `gettyimages.com` | Getty Images | No | High-res previews, lazy loading |
| `gettyimages.co.uk` | Getty Images UK | No | Extends Getty International |
| `mirrorpix.com` | Mirrorpix | Yes | SmartFrame integration |
| `actionpress.de` | ActionPress | Yes | PictureMaxx platform, German UI |
| `news-images.smartframe.io` | SmartFrame News | No | Embedded images, custom wait |
| `archive.newsimages.co.uk` | News Images Archive | No | Extends SmartFrame |
| `imago-images.com` | Imago Images | Yes | High-quality images, German UI |
| `shutterstock.com` | Shutterstock | No | React framework, high volume |

## 🧪 Testing Procedures

### 1. Profile Detection Test

**Goal**: Verify the extension detects the correct site profile

**Steps**:
1. Install and activate the extension
2. Navigate to each supported site
3. Open the extension dashboard
4. Look for site profile indicator in the navbar

**Expected Results**:
- Navbar shows detected profile (e.g., "🎯 Getty Images")
- Console logs show profile detection messages
- Universal profile shown for unsupported sites

### 2. Site-Specific Selector Test

**Goal**: Test that site-specific selectors find images better than universal selectors

**Test URLs**:
```
Getty Images: https://www.gettyimages.com/photos/london
Shutterstock: https://www.shutterstock.com/search/business
Mirrorpix: https://www.mirrorpix.com/search/london (requires login)
ActionPress: https://www.actionpress.de/suche/business (requires login)
SmartFrame: https://news-images.smartframe.io/
Imago: https://www.imago-images.com/st/search/london (requires login)
```

**Steps**:
1. Navigate to test URL
2. Open extension dashboard
3. Start "Single Page" scrape
4. Monitor log messages for selector usage
5. Check found image count

**Expected Results**:
- Site-specific selectors used first (log message: "🎯 Using site-specific selectors")
- Higher image count compared to universal selectors
- Appropriate image quality and links extracted

### 3. Pagination Test

**Goal**: Verify site-specific pagination selectors work correctly

**Steps**:
1. Navigate to search results with multiple pages
2. Start "All Pages" scrape
3. Monitor pagination progress
4. Verify correct next page detection

**Expected Results**:
- Site-specific next page selectors used
- Successful navigation between pages
- No circular pagination loops
- Correct page count progression

### 4. Wait Time Optimization Test

**Goal**: Test that site-specific wait times improve reliability

**Sites to Test**:
- Getty Images (slow loading)
- ActionPress (authentication delays)
- SmartFrame (embedded content)

**Steps**:
1. Navigate to test site
2. Compare scraping with site profile vs universal settings
3. Monitor page load success rates
4. Check for timeout errors

**Expected Results**:
- Reduced timeout errors with site profiles
- Better handling of slow-loading sites
- Appropriate wait times for authentication

## 🔍 Debugging and Troubleshooting

### Console Logging

The extension provides detailed logging for site profiles:

```javascript
// Profile Detection
"🎯 Detected site profile: Getty Images"
"Using site-specific selectors for Getty Images"

// Selector Usage  
"🎯 Using site-specific selectors for Getty Images"
"🎯 Using site-specific next page selector for Getty Images"

// Fallback Behavior
"No site profile detected, using universal selectors"
```

### Testing Site Profile Detection

Open browser console and run:
```javascript
// Check current site detection
chrome.runtime.sendMessage({
    action: 'detectCurrentSite'
}, response => console.log('Profile:', response));
```

### Manual Profile Override

For testing, you can manually override the detected profile:
```javascript
// Force specific profile for testing
window.galleryScraper = { forceProfile: 'gettyimages.com' };
```

## 🐛 Common Issues and Solutions

### Issue: Site Profile Not Detected
**Solution**: 
- Check URL matches profile domains exactly
- Verify you're on the main site, not subdomains
- Clear browser cache and try again

### Issue: Poor Image Detection
**Solution**:
- Check if site layout has changed
- Use browser dev tools to inspect current selectors
- Report selector updates needed

### Issue: Pagination Failures
**Solution**:
- Verify next page buttons are visible and enabled
- Check for JavaScript-based pagination
- Test with slower wait times

### Issue: Authentication Problems
**Solution**:
- Ensure you're logged in before starting scrape
- Check if site uses 2FA or session timeouts
- Try with "Max Compatible" preset

## 📊 Performance Benchmarks

### Expected Improvements with Site Profiles

| Metric | Universal | Getty Profile | Improvement |
|--------|-----------|---------------|-------------|
| Image Detection Rate | 70-80% | 90-95% | +15-25% |
| Pagination Success | 60-70% | 85-95% | +25-35% |
| Page Load Success | 75-85% | 90-95% | +10-15% |
| Total Scrape Speed | Baseline | 20-30% faster | Variable |

### Getty Images Specific
- **Page Load**: 8s vs 30s default (optimized for slow responses)
- **Scroll Delay**: 1.5s vs 0.5s default (better lazy loading)
- **Image Detection**: Uses `img.Xc8V0Fvh0qg0lUySLpoi` directly

### Shutterstock Specific  
- **Modern Framework**: React-optimized selectors
- **High Volume**: Faster scroll, more concurrent downloads
- **Page Load**: 4s vs 30s (faster modern site)

## 🔄 Testing Checklist

### Pre-Testing Setup
- [ ] Extension installed and activated
- [ ] Browser console open for logging
- [ ] Test accounts available for login-required sites
- [ ] Stable internet connection

### Basic Function Tests
- [ ] Profile detection working on all supported sites
- [ ] Site profile status showing in dashboard UI
- [ ] Universal fallback working on unsupported sites
- [ ] Settings presets compatible with site profiles

### Site-Specific Tests

#### Getty Images
- [ ] Profile detected on both .com and .co.uk
- [ ] Images found using `Xc8V0Fvh0qg0lUySLpoi` class
- [ ] Pagination works on search results
- [ ] Lazy loading handled correctly

#### Shutterstock  
- [ ] React framework selectors working
- [ ] High-volume scraping efficient
- [ ] Watermarked images detected
- [ ] Modern pagination handled

#### Mirrorpix/SmartFrame
- [ ] Authentication state preserved
- [ ] SmartFrame embedded images found
- [ ] Custom wait times adequate
- [ ] iframe content accessible

#### ActionPress
- [ ] German language interface handled
- [ ] PictureMaxx platform compatible
- [ ] Authentication workflows supported
- [ ] Higher resolution images prioritized

#### Imago Images
- [ ] High-quality image focus working
- [ ] German language selectors
- [ ] Authentication integration
- [ ] Incremental scrolling effective

### Advanced Tests
- [ ] Resume functionality with site profiles
- [ ] Error recovery on site-specific failures
- [ ] Cross-site scraping session handling
- [ ] Performance monitoring and optimization

## 📝 Test Report Template

```
Site Profile Test Report
========================

Date: [DATE]
Tester: [NAME]
Extension Version: 1.0.0

Site: [SITE_NAME]
Profile: [PROFILE_NAME]
URL: [TEST_URL]

Results:
- Profile Detection: ✅/❌
- Image Detection Rate: [%]
- Images Found: [COUNT]
- Pagination: ✅/❌ ([PAGES] pages)
- Performance: [FAST/NORMAL/SLOW]

Issues:
- [LIST ANY PROBLEMS]

Recommendations:
- [SUGGESTED IMPROVEMENTS]
```

## 🚀 Next Steps

After testing, consider:

1. **Selector Updates**: If sites change layout, update profiles
2. **New Sites**: Add profiles for additional photo agencies
3. **Performance Tuning**: Optimize wait times based on test results
4. **Feature Expansion**: Add site-specific download options
5. **User Feedback**: Collect usage data for improvements

## 💡 Tips for Effective Testing

1. **Test with Real Content**: Use actual search results, not empty pages
2. **Vary Search Terms**: Different searches may have different layouts
3. **Test Edge Cases**: Very large galleries, slow connections, etc.
4. **Monitor Resource Usage**: Check memory and CPU impact
5. **Document Changes**: Keep track of any needed selector updates

---

**Note**: Site layouts change frequently. If you encounter issues, the selectors may need updates. Please report any problems with specific sites and current HTML structures for maintenance.