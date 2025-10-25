# Source Code Directory

This directory contains the **unbundled, readable source code** for the StepThree Gallery Scraper Chrome extension.

## 📂 Contents

```
src/
├── background/           # Background service worker sources (3 files, ~485KB)
├── config/              # Configuration constants (1 file, ~800 bytes)
├── content/             # Content script sources (1 file, ~503KB)
└── lib/                 # Shared libraries (2 files, ~20KB)
```

## 🎯 Purpose

These source files were **extracted from source maps** to provide:
- ✅ Readable, well-formatted code
- ✅ Original comments and documentation
- ✅ ES6 module syntax (imports/exports)
- ✅ Easier debugging and understanding

## 📖 How to Use

### For Reading and Understanding
Simply open any `.js` file in this directory with your favorite code editor. The code is:
- Properly formatted with indentation
- Includes comments explaining functionality
- Uses descriptive variable names
- Follows modern JavaScript conventions

### For Editing and Development

⚠️ **Important**: These source files use ES6 imports/exports and **cannot be loaded directly** by Chrome extensions.

**To make changes:**
1. Edit the source files in this directory
2. Rebuild the extension using a bundler (esbuild, webpack, etc.)
3. The bundled output goes to `background.js` and `content.js` in the parent directory
4. Reload the extension in Chrome

## 📝 File Descriptions

### Background Scripts (`background/`)

| File | Size | Description |
|------|------|-------------|
| `advanced-export-system.js` | 150KB | Export functionality: CSV, Excel, JSON, ZIP formats |
| `consolidated-background.js` | 127KB | Core background logic: message routing, tab management |
| `simple-service-worker.js` | 209KB | Service worker: lifecycle, ports, event listeners |

**Total**: ~485KB of background script source code

### Content Scripts (`content/`)

| File | Size | Description |
|------|------|-------------|
| `content-bundle.js` | 503KB | Main content script: DOM scraping, gallery detection, pattern recognition |

**Total**: ~503KB of content script source code

### Shared Libraries (`lib/`)

| File | Size | Description |
|------|------|-------------|
| `input-sanitizer.js` | 13KB | Input validation, XSS protection, SQL injection prevention |
| `logger.js` | 7KB | Centralized logging with debug levels |

**Total**: ~20KB of shared library code

### Configuration (`config/`)

| File | Size | Description |
|------|------|-------------|
| `constants.js` | 804 bytes | Performance config, export settings, timeouts, queue config |

## 🔍 Code Navigation

### Finding Specific Functionality

**For gallery detection:**
- Look in `content/content-bundle.js`
- Search for: `detectGalleries`, `scanForImages`, `galleryDetection`

**For export features:**
- Look in `background/advanced-export-system.js`
- Search for: `export`, `CSV`, `Excel`, `JSON`, `ZIP`

**For message handling:**
- Look in `background/consolidated-background.js`
- Search for: `messageHandlers`, `handleMessage`, `sendMessage`

**For input validation:**
- Look in `lib/input-sanitizer.js`
- Search for: `sanitize`, `validate`, `clean`

## 🔧 Development Notes

### ES6 Module Syntax
The source files use ES6 imports/exports:
```javascript
// Imports
import { PERFORMANCE_CONFIG } from '../config/constants.js';
import { InputSanitizer } from '../lib/input-sanitizer.js';

// Exports
export const MyClass = class { ... };
export function myFunction() { ... }
```

### Bundler Requirements
To convert these sources to Chrome extension format:
- **Remove** ES6 imports/exports
- **Bundle** all dependencies
- **Minify** for production
- **Generate** source maps

Common bundlers:
- esbuild (fastest)
- webpack (most features)
- rollup (tree-shaking)

## 🐛 Debugging

### Using These Sources for Debugging

**Option 1: Source Maps**
Chrome DevTools will automatically show these sources if:
- `.map` files exist in parent directory
- Source maps are enabled in DevTools
- The bundled code references the map file

**Option 2: Direct Reading**
When you see an error in the bundled code:
1. Note the function/variable name
2. Search for it in these source files
3. Read the readable source code
4. Understand the logic and fix the issue

## 📊 Source Statistics

```
Total Source Files:   7 files
Total Source Size:    ~1.0 MB (uncompressed)
Bundled Size:         ~1.2 MB (content.js + background.js)
With Source Maps:     ~2.1 MB (includes .map files)

Breakdown:
  - Background sources: ~485 KB (3 files)
  - Content sources:    ~503 KB (1 file)
  - Shared libraries:   ~20 KB  (2 files)
  - Configuration:      ~800 B  (1 file)
```

## 🚀 Quick Start for Developers

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd ext4
   ```

2. **Read the sources**
   ```bash
   # Open in your editor
   code src/
   
   # Or read specific files
   less src/content/content-bundle.js
   ```

3. **Make changes**
   - Edit files in `src/` directory
   - Keep changes focused and documented

4. **Rebuild**
   ```bash
   npm run build
   ```

5. **Test**
   - Reload extension in Chrome
   - Test affected functionality
   - Check console for errors

## 📚 Related Documentation

- `../SOURCE_CODE_GUIDE.md` - Comprehensive guide to source code structure
- `../README.md` - Project overview and features
- `../README_FIX.md` - Recent fixes and improvements
- `../ARCHITECTURE.md` - System architecture and flow diagrams

## 🔐 Code Organization Principles

The source code follows these principles:

1. **Separation of Concerns**
   - Background scripts handle extension-level logic
   - Content scripts handle page-level interactions
   - Libraries provide reusable utilities

2. **Modularity**
   - Each file has a clear, single purpose
   - Functions are small and focused
   - Dependencies are explicit (imports)

3. **Security**
   - Input sanitization for all user inputs
   - CSP-compliant code
   - No eval() or unsafe practices

4. **Performance**
   - Lazy loading where possible
   - Efficient algorithms
   - Memory management

## ✅ Best Practices

When working with these sources:

✅ **DO**
- Read the code to understand before changing
- Add comments explaining your changes
- Test thoroughly after modifications
- Keep the bundled version in sync
- Use version control (Git)

❌ **DON'T**
- Edit the bundled files directly
- Remove existing comments
- Introduce security vulnerabilities
- Skip the build step
- Commit without testing

## 💡 Tips

1. **Use a good code editor** - VSCode, Sublime, or Atom work great
2. **Enable syntax highlighting** - Makes code easier to read
3. **Use search** - Find functions/variables quickly across files
4. **Check dependencies** - Understand what each module imports
5. **Read comments** - They explain the "why" behind the code

## 🆘 Getting Help

If you're stuck:
1. Check the main `SOURCE_CODE_GUIDE.md` for detailed explanations
2. Look at the bundled code's console output for errors
3. Use Chrome DevTools with source maps enabled
4. Review the `ARCHITECTURE.md` for system flow diagrams
5. Check existing documentation files

---

**Note**: These files were automatically extracted from source maps. They represent the original, unbundled source code that was compiled into `background.js` and `content.js`.

**Last Extracted**: Auto-generated
**Extension Version**: 2.0.0
