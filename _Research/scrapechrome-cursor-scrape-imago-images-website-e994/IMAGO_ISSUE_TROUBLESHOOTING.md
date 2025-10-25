# Imago Images Content Script Injection Issue - Troubleshooting Guide

## Issue Summary
The Gallery Scraper Pro extension shows "Connection failed" → "Connected" → "Failed to start scraping" on imago-images.com. This indicates the content script is not being injected properly.

## Root Cause Analysis

### **Primary Issue: Content Script Injection Blocked**
The content script is not being injected on imago-images.com, likely due to:
1. **CSP (Content Security Policy)** restrictions
2. **Site-specific anti-extension measures**
3. **Timing issues** with page loading
4. **Extension permission issues**

## Immediate Diagnostic Steps

### Step 1: Run Diagnostic Script
1. Navigate to: https://www.imago-images.com/search?querystring=Faye%20tozer
2. Open browser console (F12)
3. Copy and paste the content of `diagnose_imago_issue.js`
4. Check the results

### Step 2: Check Extension Status
1. Go to `chrome://extensions/`
2. Find "Gallery Scraper Pro"
3. Check for any error messages
4. Click "Reload" if there are errors
5. Ensure the extension is enabled

### Step 3: Test on Different Site
1. Try the extension on a simple test page: `file:///workspace/test_extension.html`
2. If it works on test page but not imago-images.com, the issue is site-specific

## Expected Diagnostic Results

### ✅ **If Extension is Working:**
- Chrome APIs available
- Extension accessible
- Gallery Scraper messages found
- Manual injection working

### ❌ **If Content Script is Blocked:**
- Chrome APIs not available
- No Gallery Scraper messages
- CSP meta tag found
- Manual injection fails

## Solutions Based on Diagnostic Results

### **Solution 1: CSP Blocking (Most Likely)**
**Symptoms**: CSP meta tag found, Chrome APIs not available

**Fix**: Update manifest to handle CSP restrictions
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### **Solution 2: Timing Issues**
**Symptoms**: Page not fully loaded, extension scripts not found

**Fix**: Change content script timing in manifest
```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### **Solution 3: Permission Issues**
**Symptoms**: Extension not accessible, installation issues

**Fix**: 
1. Remove and reinstall extension
2. Check Chrome version compatibility
3. Ensure all permissions are granted

### **Solution 4: Site-Specific Blocking**
**Symptoms**: Anti-bot measures detected, blocking scripts found

**Fix**: Use alternative injection method or site-specific workarounds

## Alternative Solutions

### **Option 1: Manual Injection Test**
1. Run the `content_script_fix.js` script in console
2. Check if manual injection works
3. If it works, the issue is CSP-related

### **Option 2: Extension Reload**
1. Go to `chrome://extensions/`
2. Find Gallery Scraper Pro
3. Click "Reload" button
4. Try again

### **Option 3: Browser Restart**
1. Close all Chrome windows
2. Restart Chrome
3. Try the extension again

### **Option 4: Incognito Mode Test**
1. Open Chrome in incognito mode
2. Load the extension
3. Test on imago-images.com
4. Check if it works in incognito

## Advanced Troubleshooting

### **Check Network Tab**
1. Open Developer Tools → Network tab
2. Reload the page
3. Look for any blocked requests
4. Check for CSP violation errors

### **Check Console Errors**
1. Open Developer Tools → Console tab
2. Look for any error messages
3. Check for CSP violation warnings
4. Look for extension-related errors

### **Check Application Tab**
1. Open Developer Tools → Application tab
2. Check Storage → Local Storage
3. Look for extension data
4. Check if extension is storing data

## Temporary Workarounds

### **Workaround 1: Use Different Browser**
1. Try the extension in Firefox or Edge
2. Check if the issue is Chrome-specific

### **Workaround 2: Disable Site Extensions**
1. Go to `chrome://extensions/`
2. Temporarily disable other extensions
3. Test if conflict is causing the issue

### **Workaround 3: Use Different URL**
1. Try a different imago-images.com page
2. Check if the issue is URL-specific

## Prevention Measures

### **For Future Sites**
1. **Test on Simple Pages First**: Always test on basic HTML pages
2. **Check CSP Headers**: Look for restrictive security policies
3. **Monitor Console**: Watch for injection errors
4. **Use Fallback Methods**: Have alternative injection strategies

### **Extension Improvements**
1. **Better Error Handling**: More specific error messages
2. **CSP Detection**: Automatic detection of CSP restrictions
3. **Alternative Injection**: Fallback injection methods
4. **User Feedback**: Clear indication of injection status

## Next Steps

### **Immediate Actions**
1. Run the diagnostic script
2. Check extension status
3. Try the alternative solutions
4. Report results

### **If Issue Persists**
1. Check Chrome version (should be 88+)
2. Try different browser
3. Contact support with diagnostic results
4. Consider site-specific workarounds

### **For Development**
1. Add CSP detection to extension
2. Implement alternative injection methods
3. Add better error reporting
4. Create site-specific profiles

## Contact Information

If the issue persists after trying all solutions:
1. Share the diagnostic script results
2. Include browser version and OS
3. Note any error messages in console
4. Describe the exact steps taken

The diagnostic script will provide specific information about what's blocking the content script injection, allowing for targeted solutions.