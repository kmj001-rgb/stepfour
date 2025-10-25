# MasterScraper - Professional Gallery Scraper

A production-ready Chrome extension for scraping image galleries and photo agencies with authentication support, pagination, and reliable downloading.

## 🚀 Features

### Core Functionality
- **Authentication Support**: Works with sites behind login screens
- **Page Loading**: Robust waiting for slow/unresponsive pages with network idle detection
- **Lazy Loading**: Smart scrolling to trigger infinite scroll and lazy-loaded content
- **Data Extraction**: Extracts thumbnail URLs and destination links from gallery tiles
- **Downloading**: Downloads thumbnails with original filenames to configurable folder
- **Duplicate Handling**: Uses underscore sequence (photo.jpg, photo_1.jpg, photo_2.jpg)
- **Pagination**: Detects and navigates through next pages automatically
- **Reliability**: Handles timeouts, retries, and "open in new tab" behaviors
- **Output**: JSON export with clean arrays of thumbnails and destinations

### Advanced Features
- **Modern UI**: Professional gradient-based dashboard with real-time updates
- **Progress Tracking**: Live statistics, progress bars, and activity logs
- **Control Options**: Pause, resume, and stop functionality during scraping
- **Custom Selectors**: Override default selectors for specific sites
- **Concurrent Downloads**: Configurable download limits (1-10 simultaneous)
- **Error Handling**: Comprehensive retry mechanisms and detailed logging
- **Settings Persistence**: All settings saved across browser sessions
- **Export System**: JSON reports with metadata and failure tracking

## 🎯 Supported Sites

### Photo Agencies
- **Getty Images** - Full support with optimized selectors
- **Shutterstock** - Comprehensive image extraction
- **Mirrorpix** - Authentication and pagination support
- **Imago Images** - Professional photo agency scraping
- **Action Press** - Sports and news photography
- **Adobe Stock** - Stock photo marketplace

### Universal Compatibility
- Any gallery-style website with image thumbnails
- Sites with pagination or infinite scroll
- Authentication-required platforms
- Custom layouts with configurable selectors

## 📦 Installation

### From Source
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `gallery-scraper-pro` directory
5. The MasterScraper icon should now appear in your browser toolbar

### Chrome Web Store
*(Coming soon)*

## 🎮 Usage

### Basic Operation
1. **Navigate** to any gallery page (ensure you're logged in if required)
2. **Click** the MasterScraper icon in your browser toolbar
3. **Choose** your scraping mode:
   - **Current Page**: Scrape only the current page
   - **All Pages**: Scrape current page and continue through pagination
4. **Monitor** progress in the dashboard
5. **Download** the JSON report when complete

### Settings Configuration

#### Presets
- **Balanced**: Optimal settings for most sites (default)
- **Fast**: Quick scraping with reduced wait times
- **Thorough**: Maximum reliability with longer waits
- **Max Compatible**: Conservative settings for problematic sites

#### Custom Settings
- **Page Wait**: Time to wait for page loading (10-120 seconds)
- **Scroll Delay**: Delay between scroll actions (500-5000ms)
- **Max Downloads**: Concurrent download limit (1-10)
- **Download Folder**: Custom folder name for downloads

### Advanced Features

#### Site Detection
MasterScraper automatically detects supported sites and applies optimized settings:
- Getty Images: Enhanced selectors for Getty's layout
- Shutterstock: Optimized for Shutterstock's gallery structure
- Mirrorpix: Authentication-aware scraping
- Universal: Fallback selectors for unknown sites

#### Error Recovery
- **Automatic Retries**: Failed downloads are retried with exponential backoff
- **Timeout Handling**: Configurable timeouts for unresponsive pages
- **Network Monitoring**: Detects when pages are fully loaded
- **Graceful Degradation**: Continues scraping even if some images fail

## 📊 Output Format

### JSON Report Structure
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "totalImages": 150,
    "downloadedImages": 145,
    "failedDownloads": 5,
    "totalPages": 3,
    "duration": 45000
  },
  "data": {
    "thumbnails": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "destinations": [
      "https://example.com/detail/image1",
      "https://example.com/detail/image2"
    ]
  },
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "message": "Page 1 processed successfully",
      "type": "success",
      "page": 1
    }
  ]
}
```

### File Organization
- **Downloads**: Images saved to `MasterScraper/` folder (configurable)
- **Reports**: JSON reports with timestamp in filename
- **Logs**: Detailed activity logs for troubleshooting

## 🔧 Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background processing for downloads and state management
- **Content Script**: Robust page interaction with comprehensive selector fallbacks
- **Modern JavaScript**: ES6+ with async/await throughout
- **Message Passing**: Efficient communication between components

### Performance Optimizations
- **Network Monitoring**: WebRequest API for accurate page idle detection
- **Queue Management**: Efficient download queue with concurrency control
- **Memory Management**: Cleanup and garbage collection strategies
- **Smart Scrolling**: Optimized lazy loading detection
- **Retry Logic**: Exponential backoff for failed operations

### Reliability Features
- **Timeout Handling**: Configurable timeouts for unresponsive pages
- **Circular Detection**: Prevents infinite pagination loops
- **State Persistence**: Resume interrupted scraping sessions
- **Error Recovery**: Graceful degradation and fallback strategies
- **Comprehensive Logging**: Detailed activity logs for troubleshooting

## 🛠️ Troubleshooting

### Common Issues

#### No Images Found
- **Solution**: Wait for the page to fully load before starting
- **Check**: Ensure you're on a gallery/search results page
- **Try**: Use "Max Compatible" preset for problematic sites

#### Downloads Failing
- **Solution**: Check if you're logged into the site
- **Check**: Reduce "Max Downloads" to 1-2
- **Try**: Use "Thorough" preset for better reliability

#### Page Loading Timeout
- **Solution**: Increase "Page Wait" setting to 45-60 seconds
- **Check**: Ensure stable internet connection
- **Try**: Use "Max Compatible" preset

#### Pagination Issues
- **Solution**: The site may have updated its layout
- **Check**: Verify you're on page 1 of search results
- **Try**: Use custom selectors if available

### Error Messages
- **NETWORK_ERROR**: Check internet connection
- **TIMEOUT**: Increase page wait time in settings
- **NO_IMAGES**: Page may not be fully loaded
- **DOWNLOAD_FAILED**: Check authentication or reduce concurrent downloads
- **PAGINATION_FAILED**: No more pages available or layout changed

## 📝 Development

### Project Structure
```
gallery-scraper-pro/
├── manifest.json          # Chrome Extension Manifest V3
├── background.js          # Service worker for downloads & coordination
├── content.js            # Content script for page scraping
├── dashboard.html        # Modern UI interface
├── dashboard.js          # Dashboard logic & controls
├── icons/                # Extension icons directory
│   ├── icon16.png        # 16x16 icon
│   ├── icon48.png        # 48x48 icon
│   └── icon128.png       # 128x128 icon
└── README.md             # This file
```

### Building for Production
1. Ensure all files are in the `gallery-scraper-pro/` directory
2. Verify icons are present in the `icons/` subdirectory
3. Test the extension in Chrome's developer mode
4. Package for Chrome Web Store (if applicable)

### Customization
- **Site Profiles**: Add new sites in `background.js` SITE_PROFILES
- **Selectors**: Modify selectors for specific site layouts
- **UI**: Customize dashboard appearance in `dashboard.html`
- **Settings**: Add new configuration options in `dashboard.js`

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues, questions, or feature requests:
- Check the troubleshooting section above
- Review the error logs in the dashboard
- Create an issue with detailed information about your problem

## 🔄 Changelog

### Version 2.0.0
- Complete rewrite with Manifest V3
- Professional dashboard interface
- Enhanced site detection and optimization
- Improved error handling and recovery
- Better performance and reliability
- Comprehensive logging and reporting

### Version 1.0.0
- Initial release
- Basic scraping functionality
- Simple popup interface
- Core download capabilities

---

**MasterScraper** - Professional gallery scraping made simple and reliable.