# Imago Images Scraping Troubleshooting Guide

## Issue Summary
The Gallery Scraper Pro extension is failing to start scraping on https://www.imago-images.com/search?querystring=Faye%20tozer with the error "Failed to start scraping".

## Root Cause Analysis

### 1. Content Script Injection Issues
**Problem**: The content script may not be properly injected on imago-images.com due to:
- Site-specific security measures
- CSP (Content Security Policy) restrictions
- Dynamic page loading preventing script injection

**Solutions**:
- Verify content script is loaded by checking browser console for "[Gallery Scraper] Gallery Scraper Pro content script loaded"
- Check if the site has CSP headers blocking script injection
- Ensure the extension has proper permissions in manifest.json

### 2. Message Passing Failures
**Problem**: Communication between background script and content script may be failing.

**Solutions**:
- Fixed async message handling in content script
- Added better error handling and logging
- Improved response timing to prevent timeouts

### 3. Site-Specific Selectors
**Problem**: The Imago site profile selectors may not match the actual page structure.

**Solutions**:
- Updated selectors to be more comprehensive
- Added fallback selectors for different page layouts
- Increased wait times for German servers

## Debugging Steps

### Step 1: Verify Extension Installation
1. Open Chrome Extensions page (chrome://extensions/)
2. Ensure Gallery Scraper Pro is enabled
3. Check for any error messages in the extension card

### Step 2: Test on Simple Page
1. Open the test page: `test_extension.html`
2. Try scraping to verify basic functionality
3. Check browser console for any errors

### Step 3: Debug Imago Page
1. Navigate to https://www.imago-images.com/search?querystring=Faye%20tozer
2. Open browser console (F12)
3. Run the debug script: `debug_imago.js`
4. Check for:
   - Content script loading message
   - Selector test results
   - Any JavaScript errors

### Step 4: Check Page Structure
1. Inspect the page HTML structure
2. Look for image containers and selectors
3. Verify if images are loaded dynamically
4. Check for authentication requirements

## Recent Fixes Applied

### 1. Improved Message Handling
```javascript
// Fixed async message handling in content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScrapePage' || request.action === 'startScrapeAllPages') {
        sendResponse({ success: true }); // Immediate response
        // Start scraping asynchronously
        (async () => {
            try {
                if (request.action === 'startScrapePage') {
                    await scrapeCurrentPage(request.settings, request.siteProfile);
                } else {
                    await scrapeAllPages(request.settings, request.siteProfile);
                }
            } catch (error) {
                console.error('Scraping error:', error);
                sendStatusUpdate(`❌ Scraping failed: ${error.message}`, 'error');
            }
        })();
        return true;
    }
    // ... rest of message handling
});
```

### 2. Enhanced Imago Site Profile
```javascript
'imago-images.com': {
    name: 'Imago Images',
    selectors: {
        // More comprehensive selectors
        imageContainer: '.search-result-item, .image-tile, .gallery-item, [data-media-id], .result-item, .search-result, .media-item, .image-container',
        imageElement: '.search-result-item img, .image-tile img, .gallery-item img, .result-item img, .search-result img, .media-item img, .image-container img',
        linkElement: '.search-result-item a, .image-tile a, .gallery-item a, a[href*="detail"], .result-item a, .search-result a, .media-item a, .image-container a',
        nextPageButton: '.pagination .next, .next-page-btn, [aria-label*="next"], .pagination-next, .next-page, button[aria-label*="Next"]',
        loadMoreButton: '.load-more-results, .show-more-images, .infinite-load, .load-more, .show-more'
    },
    waitSettings: {
        pageLoad: 8000, // Increased wait time for German servers
        scrollDelay: 1500,
        afterScroll: 3000
    },
    special: {
        hasInfiniteScroll: true,
        requiresAuthentication: true,
        hasLazyLoading: true,
        highQualityImages: true,
        languageSpecific: 'de',
        needsLongerWait: true
    }
}
```

### 3. Added Comprehensive Logging
- Added console logging throughout scraping process
- Enhanced error reporting
- Better status updates

## Testing Instructions

### 1. Basic Functionality Test
```bash
# Open test page in browser
file:///workspace/test_extension.html

# Try scraping and check console for logs
```

### 2. Imago Debug Test
```bash
# Navigate to Imago page
https://www.imago-images.com/search?querystring=Faye%20tozer

# Run debug script in console
# Copy and paste debug_imago.js content
```

### 3. Extension Debug Test
```bash
# Run test script in console
# Copy and paste test_content_script.js content
```

## Expected Results

### Successful Scraping Should Show:
1. Content script loaded message
2. Site profile detection: "Imago Images"
3. Selector testing results
4. Image extraction progress
5. Download progress

### Common Issues and Solutions:

#### Issue: "Failed to start scraping"
**Cause**: Content script not responding to background script
**Solution**: 
- Check if content script is loaded
- Verify message passing is working
- Check for JavaScript errors in console

#### Issue: "No images found"
**Cause**: Selectors not matching page structure
**Solution**:
- Run debug script to see actual page structure
- Update selectors based on findings
- Check if images are loaded dynamically

#### Issue: "Page not ready"
**Cause**: Page taking too long to load
**Solution**:
- Increase wait times in site profile
- Check network connectivity
- Verify authentication status

## Next Steps

1. **Test the fixes**: Try scraping on the test page first
2. **Debug Imago page**: Run the debug scripts to understand the page structure
3. **Update selectors**: Based on debug results, update the Imago site profile
4. **Test authentication**: Ensure you're logged into Imago if required
5. **Monitor logs**: Check browser console for detailed error messages

## Contact Information

If issues persist after following this guide:
1. Check the browser console for specific error messages
2. Run the debug scripts and share the output
3. Provide screenshots of the page structure
4. Note any authentication requirements or popups