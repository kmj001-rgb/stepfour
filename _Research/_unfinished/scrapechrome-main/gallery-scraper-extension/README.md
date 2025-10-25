# Gallery Scraper Pro

A professional Chrome extension for scraping image galleries and photo agencies with authentication support, pagination handling, and reliable downloading.

## 🚀 Features

### Core Functionality
- **Authentication Support**: Works with sites behind login screens (assumes user is already logged in)
- **Smart Page Loading**: Waits for complete page rendering with network idle detection
- **Lazy Loading Detection**: Automatically scrolls and triggers lazy-loaded content
- **Robust Pagination**: Detects and navigates through multiple pages automatically
- **Duplicate Handling**: Uses underscore sequence for duplicate filenames (photo.jpg, photo_1.jpg, etc.)

### Advanced Capabilities
- **Slow Page Handling**: Built-in retry mechanisms and timeout handling for unresponsive pages
- **Concurrent Downloads**: Configurable concurrent download limits for optimal performance
- **Custom Selectors**: Override default selectors for specific sites
- **Progress Tracking**: Real-time progress updates with detailed logging
- **Export Reports**: JSON export of all scraped data with comprehensive metadata

### Data Extraction
- **Thumbnail URLs**: Extracts high-quality thumbnail image URLs
- **Destination Links**: Captures the linked pages for each thumbnail
- **Metadata**: Preserves original filenames and handles various image formats
- **Error Logging**: Detailed failure tracking for troubleshooting

## 📦 Installation

### Method 1: Developer Mode (Recommended)

1. **Download the Extension**
   ```bash
   git clone <repository-url>
   cd gallery-scraper-extension
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `gallery-scraper-extension` folder
   - The extension icon should appear in your toolbar

### Method 2: Manual Installation

1. Download the extension files to a folder
2. Follow steps 2-3 from Method 1

## 🎯 Usage Guide

### Quick Start

1. **Navigate to Target Page**
   - Go to the first page of any gallery or search results
   - Ensure you're logged in if the site requires authentication

2. **Open Extension**
   - Click the Gallery Scraper Pro icon in your toolbar
   - The popup will show the current page URL

3. **Configure Settings** (Optional)
   - Adjust page wait time (default: 30 seconds)
   - Set scroll delay for lazy loading (default: 500ms)
   - Specify download folder (optional)
   - Click "Save Settings"

4. **Start Scraping**
   - **Current Page**: Click "📄 Current Page" to scrape only the current page
   - **All Pages**: Click "📚 All Pages" to scrape through pagination

### Advanced Configuration

Click "Show Advanced Settings" to access:

- **Max Concurrent Downloads**: Control download speed (1-10, default: 5)
- **Minimum Image Dimensions**: Filter out small images (default: 200x200px)
- **Custom Selectors**: Override default element detection
  - **Image Container Selector**: e.g., `.gallery-item`, `.search-result`
  - **Next Page Selector**: e.g., `.next-page`, `a[rel="next"]`

### Monitoring Progress

The extension provides real-time feedback:
- **Status Display**: Current operation status
- **Progress Bar**: Visual progress indicator
- **Statistics**: Live counts of thumbnails, downloads, and failures
- **Activity Log**: Detailed operation log with timestamps

### Control Options

During scraping, you can:
- **⏸️ Pause**: Temporarily pause the operation
- **▶️ Resume**: Continue from where you paused
- **⏹️ Stop**: Completely stop and generate final report

## 🔧 Configuration Options

### Basic Settings

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| Max Page Wait | Maximum time to wait for page loading | 30s | 5-120s |
| Scroll Delay | Delay between scroll actions for lazy loading | 500ms | 100-5000ms |
| Download Folder | Target folder for downloads (optional) | Downloads | Any valid path |

### Advanced Settings

| Setting | Description | Default | Notes |
|---------|-------------|---------|-------|
| Max Concurrent Downloads | Number of simultaneous downloads | 5 | 1-10 recommended |
| Min Image Width | Minimum image width filter | 200px | 0+ (0 = no filter) |
| Min Image Height | Minimum image height filter | 200px | 0+ (0 = no filter) |
| Image Container Selector | CSS selector for image containers | Auto-detect | Override for specific sites |
| Next Page Selector | CSS selector for pagination | Auto-detect | Override for specific sites |

## 🎛️ Supported Sites

### Auto-Detection Works With:
- Most standard gallery layouts
- Common pagination patterns
- Standard image container structures

### Manual Configuration May Be Needed For:
- Highly customized gallery layouts
- Non-standard pagination
- Sites with unusual CSS structures

### Site-Specific Tips:

**For Getty Images, Shutterstock, Adobe Stock:**
- Use default settings
- Ensure you're logged in before starting
- Allow extra time for page loading

**For Custom Gallery Sites:**
- Inspect the page to find container selectors
- Look for pagination button classes
- Test with single page first

## 📊 Output Format

### JSON Report Structure
```json
{
  "summary": {
    "totalThumbnails": 150,
    "totalDestinations": 150,
    "totalFailures": 3,
    "scrapeMode": "all",
    "finalUrl": "https://example.com/gallery?page=10"
  },
  "thumbnails": [
    "https://example.com/thumb1.jpg",
    "https://example.com/thumb2.jpg"
  ],
  "destinations": [
    "https://example.com/detail1",
    "https://example.com/detail2"
  ],
  "failures": [
    "Failed to extract image from container 45",
    "Download failed: network error"
  ],
  "exportedAt": "2024-01-15T10:30:00.000Z"
}
```

### Downloaded Files
- Files retain original names when possible
- Duplicates get underscore sequence: `image.jpg`, `image_1.jpg`, `image_2.jpg`
- Organized in specified download folder or default Downloads

## 🛠️ Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Background processing for downloads and coordination
- **Content Script**: Page interaction and data extraction
- **Popup Interface**: User controls and real-time monitoring

### Key Technologies
- **Network Monitoring**: WebRequest API for page idle detection
- **Download Management**: Chrome Downloads API with queue management
- **Storage**: Chrome Storage API for settings and state persistence
- **Error Handling**: Comprehensive retry mechanisms and logging

### Performance Optimizations
- **Concurrent Processing**: Parallel downloads with configurable limits
- **Memory Management**: Efficient data structures and cleanup
- **Network Efficiency**: Smart retry logic and timeout handling
- **UI Responsiveness**: Non-blocking operations with progress updates

## 🔍 Troubleshooting

### Common Issues

**Extension Not Loading**
- Ensure Developer Mode is enabled
- Check for JavaScript errors in console
- Verify all files are present

**No Images Found**
- Check if page has fully loaded
- Try increasing page wait time
- Inspect page for custom selectors needed
- Verify images are actual `<img>` tags or CSS backgrounds

**Pagination Not Working**
- Look for next page button/link
- Set custom next page selector
- Check if site uses JavaScript navigation
- Some sites may require manual navigation

**Downloads Failing**
- Check Chrome download permissions
- Verify folder permissions
- Try reducing concurrent downloads
- Check for network connectivity

**Slow Performance**
- Reduce concurrent downloads
- Increase scroll delay
- Check for memory issues
- Monitor network conditions

### Debug Mode

To enable detailed logging:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for `[Gallery Scraper]` messages
4. Check Network tab for failed requests

## 🔒 Privacy & Security

### Data Handling
- **No Data Collection**: Extension doesn't send data to external servers
- **Local Processing**: All operations happen locally in your browser
- **User Control**: You control what gets scraped and where it's saved
- **Session Only**: No persistent tracking or user profiling

### Permissions Explained
- **Downloads**: Required for saving images
- **Storage**: Required for settings and progress tracking
- **Active Tab**: Required for page interaction
- **All URLs**: Required for scraping any website
- **Web Request**: Required for network monitoring

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues, questions, or feature requests:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Full pagination support
- Authentication handling
- Concurrent downloads
- Export functionality
- Comprehensive error handling

## 🎯 Roadmap

### Planned Features
- **Bulk Operations**: Process multiple galleries simultaneously
- **Scheduled Scraping**: Automated periodic scraping
- **Cloud Integration**: Direct upload to cloud storage
- **Advanced Filters**: Content-based filtering options
- **API Integration**: Direct integration with photo APIs

### Performance Improvements
- **Memory Optimization**: Reduced memory footprint
- **Speed Enhancements**: Faster processing algorithms
- **Better Caching**: Intelligent caching strategies
- **Network Optimization**: Improved network handling

---

**Gallery Scraper Pro** - Professional image gallery scraping for Chrome