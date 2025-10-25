# Easy Scraper Extension - Installation Guide (English Only)

This guide will walk you through installing the English-only version of the Easy Scraper Chrome extension.

## 📋 Prerequisites

- Google Chrome browser (version 88 or later)
- Administrator access to install extensions
- Basic knowledge of Chrome extensions

## 🚀 Installation Steps

### Step 1: Download and Extract

1. Download the `easyscraper-english-only.zip` file
2. Extract the ZIP file to a location on your computer
3. Ensure the extracted folder contains all the required files

### Step 2: Open Chrome Extensions Page

1. Open Google Chrome
2. Type `chrome://extensions/` in the address bar
3. Press Enter

### Step 3: Enable Developer Mode

1. In the top-right corner, toggle the "Developer mode" switch to ON
2. You should see additional options appear below

### Step 4: Load the Extension

1. Click the "Load unpacked" button
2. Navigate to the extracted `easyscraper-english-only` folder
3. Select the folder and click "Select Folder"

### Step 5: Verify Installation

1. The extension should appear in your extensions list
2. You should see the Easy Scraper icon in your Chrome toolbar
3. The extension status should show "Enabled"

## 🔧 Configuration

### Initial Setup

1. Click the Easy Scraper icon in your toolbar
2. The popup should open with English text
3. No additional configuration is required

### Permissions

The extension will request the following permissions:
- **Storage**: To save scraped data and settings
- **Active Tab**: To access the current webpage
- **Scripting**: To inject the content script

Click "Allow" when prompted.

## 🧪 Testing the Installation

### Test 1: Popup Interface

1. Click the extension icon
2. Verify the popup opens with English text
3. Check that all buttons are visible and functional

### Test 2: Content Script

1. Navigate to any website (e.g., `https://example.com`)
2. Look for the floating Easy Scraper interface on the right side
3. Verify the interface displays in English

### Test 3: Basic Functionality

1. On any webpage, enter a CSS selector (e.g., `h1`, `.title`, `#header`)
2. Click "Start Scraping"
3. Verify the scraping process begins

## 🚨 Troubleshooting

### Issue: Extension Won't Load

**Symptoms:**
- "Load unpacked" button doesn't work
- Error message about invalid manifest

**Solutions:**
1. Verify all files are present in the folder
2. Check that `manifest.json` is in the root folder
3. Ensure no files are corrupted

### Issue: Extension Loads But Doesn't Work

**Symptoms:**
- Extension appears in list but icon is missing
- Popup doesn't open
- Content script doesn't run

**Solutions:**
1. Check Chrome console for errors
2. Verify all bundle files are present
3. Try reloading the extension

### Issue: Text Not in English

**Symptoms:**
- Some text appears in other languages
- Translation errors in console

**Solutions:**
1. Ensure you're using the English-only version
2. Check that all bundle files are updated
3. Clear browser cache and reload

### Issue: Permissions Denied

**Symptoms:**
- Extension can't access webpages
- Scraping fails with permission errors

**Solutions:**
1. Check extension permissions in `chrome://extensions/`
2. Ensure all required permissions are granted
3. Try reinstalling the extension

## 📁 File Structure Verification

Ensure your extension folder contains:

```
easyscraper-english-only/
├── manifest.json              # Extension manifest
├── popup.html                 # Popup interface HTML
├── popup.bundle.js            # Popup functionality
├── content-script.bundle.js   # Content script
├── background.bundle.js       # Background script
├── english-strings.js         # English text strings
├── assets/                    # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── README.md                  # Documentation
└── INSTALLATION.md            # This file
```

## 🔄 Updating the Extension

### Manual Update

1. Download the new version
2. Remove the old extension from Chrome
3. Follow the installation steps above

### Automatic Updates

The extension will check for updates automatically when Chrome starts.

## 🗑️ Uninstalling

### Remove from Chrome

1. Go to `chrome://extensions/`
2. Find Easy Scraper in the list
3. Click "Remove"
4. Confirm the removal

### Clean Up Files

1. Delete the extension folder from your computer
2. Clear any saved data if needed

## 📞 Support

If you encounter issues:

1. **Check the console** for error messages
2. **Verify file integrity** - ensure no files are missing
3. **Check Chrome version** - ensure compatibility
4. **Review permissions** - ensure all required permissions are granted

## 🎯 Next Steps

After successful installation:

1. **Read the README.md** for usage instructions
2. **Test on different websites** to familiarize yourself
3. **Explore the settings** to customize your experience
4. **Start scraping** your first website!

---

**Note**: This is the English-only version of Easy Scraper. All text and interfaces are displayed in English only. If you need multi-language support, you would need to use the original version with translation files.