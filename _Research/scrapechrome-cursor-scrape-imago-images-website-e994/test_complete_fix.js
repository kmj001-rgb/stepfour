// Complete test script for CSP bypass fix on imago-images.com
// Run this in the browser console after reloading the extension

console.log('=== COMPLETE CSP BYPASS TEST ===');

// Test results storage
const testResults = {
    contentScript: false,
    injectedScript: false,
    messagePassing: false,
    extensionAccess: false,
    errors: []
};

// Test 1: Check if content script is loaded and accessible
function testContentScript() {
    console.log('\n1. CONTENT SCRIPT TEST');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ Chrome extension APIs available');
        testResults.extensionAccess = true;
        
        // Try to send a test message
        chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Content script not responding:', chrome.runtime.lastError.message);
                testResults.errors.push('Content script not responding: ' + chrome.runtime.lastError.message);
            } else {
                console.log('✅ Content script responding:', response);
                testResults.contentScript = true;
            }
        });
    } else {
        console.log('❌ Chrome extension APIs not available');
        testResults.errors.push('Chrome extension APIs not available');
    }
}

// Test 2: Check for injected script
function testInjectedScript() {
    console.log('\n2. INJECTED SCRIPT TEST');
    
    // Look for injected script messages
    const logs = [];
    const originalLog = console.log;
    
    console.log = function(...args) {
        const message = args.join(' ');
        if (message.includes('[Gallery Scraper] Injected script')) {
            logs.push(message);
        }
        originalLog.apply(console, args);
    };
    
    // Wait a moment and check
    setTimeout(() => {
        if (logs.length > 0) {
            console.log('✅ Injected script messages found:', logs.length);
            logs.forEach(msg => console.log('  -', msg));
            testResults.injectedScript = true;
        } else {
            console.log('❌ No injected script messages found');
            testResults.errors.push('No injected script messages found');
        }
        console.log = originalLog;
    }, 2000);
}

// Test 3: Test message passing between content script and injected script
function testMessagePassing() {
    console.log('\n3. MESSAGE PASSING TEST');
    
    // Send a test message to the injected script
    window.postMessage({
        type: 'GALLERY_SCRAPER_INJECTED',
        action: 'getPageInfo'
    }, '*');
    
    console.log('✅ Test message sent to injected script');
    
    // Listen for response
    const originalAddEventListener = window.addEventListener;
    let responseReceived = false;
    
    window.addEventListener = function(type, listener, ...args) {
        if (type === 'message') {
            const originalListener = listener;
            listener = function(event) {
                if (event.data.type === 'GALLERY_SCRAPER_RESPONSE') {
                    console.log('✅ Message passing working:', event.data);
                    testResults.messagePassing = true;
                    responseReceived = true;
                }
                originalListener.apply(this, arguments);
            };
        }
        return originalAddEventListener.call(this, type, listener, ...args);
    };
    
    // Check if response was received
    setTimeout(() => {
        if (!responseReceived) {
            console.log('⚠️ No response received from injected script (this may be normal for getPageInfo)');
        }
    }, 3000);
}

// Test 4: Check for CSP and security restrictions
function testSecurityRestrictions() {
    console.log('\n4. SECURITY RESTRICTIONS TEST');
    
    // Check for CSP meta tag
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCSP) {
        console.log('⚠️ CSP meta tag found:', metaCSP.content.substring(0, 150) + '...');
        
        // Check if CSP blocks chrome-extension scripts
        if (metaCSP.content.includes('script-src') && !metaCSP.content.includes('chrome-extension')) {
            console.log('❌ CSP blocks chrome-extension scripts');
            console.log('✅ This is why we need the injected script bypass');
        } else {
            console.log('✅ CSP allows chrome-extension scripts');
        }
    } else {
        console.log('✅ No CSP meta tag found');
    }
    
    // Check for other security headers
    console.log('Security headers (if visible):');
    ['X-Frame-Options', 'X-Content-Type-Options', 'X-XSS-Protection'].forEach(header => {
        console.log(`  ${header}: Not directly accessible from content script`);
    });
}

// Test 5: Check page structure and timing
function testPageStructure() {
    console.log('\n5. PAGE STRUCTURE TEST');
    
    console.log('Document ready state:', document.readyState);
    console.log('Page URL:', window.location.href);
    console.log('Domain:', window.location.hostname);
    
    // Check if page is fully loaded
    if (document.readyState === 'complete') {
        console.log('✅ Page fully loaded');
    } else {
        console.log('⚠️ Page not fully loaded, ready state:', document.readyState);
    }
    
    // Check for images on the page
    const images = document.querySelectorAll('img');
    console.log(`Found ${images.length} images on page`);
    
    // Check for potential image containers
    const potentialContainers = document.querySelectorAll('.search-result-item, .image-tile, .gallery-item, [data-media-id], .result-item, .search-result, .media-item, .image-container');
    console.log(`Found ${potentialContainers.length} potential image containers`);
    
    if (potentialContainers.length > 0) {
        console.log('✅ Potential scraping targets found');
    } else {
        console.log('⚠️ No obvious image containers found - may need different selectors');
    }
}

// Test 6: Check for any JavaScript errors
function testJavaScriptErrors() {
    console.log('\n6. JAVASCRIPT ERRORS TEST');
    
    const originalError = console.error;
    const errors = [];
    
    console.error = function(...args) {
        const errorMessage = args.join(' ');
        errors.push(errorMessage);
        originalError.apply(console, args);
    };
    
    setTimeout(() => {
        if (errors.length > 0) {
            console.log('⚠️ JavaScript errors found:', errors.length);
            errors.forEach(error => console.log('  -', error));
            testResults.errors.push(...errors);
        } else {
            console.log('✅ No JavaScript errors detected');
        }
        console.error = originalError;
    }, 3000);
}

// Test 7: Check extension installation and permissions
function testExtensionInstallation() {
    console.log('\n7. EXTENSION INSTALLATION TEST');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
            const manifest = chrome.runtime.getManifest();
            console.log('✅ Extension installed and accessible');
            console.log('  Name:', manifest.name);
            console.log('  Version:', manifest.version);
            console.log('  Manifest version:', manifest.manifest_version);
            
            // Check permissions
            const permissions = manifest.permissions || [];
            console.log('  Permissions:', permissions.length);
            
            // Check host permissions
            const hostPermissions = manifest.host_permissions || [];
            console.log('  Host permissions:', hostPermissions);
            
            // Check if current site is allowed
            const currentDomain = window.location.hostname;
            const isAllowed = hostPermissions.some(permission => 
                permission === '<all_urls>' || permission.includes(currentDomain)
            );
            
            if (isAllowed) {
                console.log('✅ Current site is allowed by extension permissions');
            } else {
                console.log('❌ Current site may not be allowed by extension permissions');
                testResults.errors.push('Site not allowed by extension permissions');
            }
            
        } catch (error) {
            console.log('❌ Extension installation issue:', error.message);
            testResults.errors.push('Extension installation issue: ' + error.message);
        }
    } else {
        console.log('❌ Extension not installed or not accessible');
        testResults.errors.push('Extension not installed or not accessible');
    }
}

// Test 8: Manual scraping simulation
function testManualScraping() {
    console.log('\n8. MANUAL SCRAPING SIMULATION');
    
    // Try to simulate what the scraper would do
    try {
        // Look for images
        const images = document.querySelectorAll('img');
        const validImages = Array.from(images).filter(img => {
            const src = img.src || img.currentSrc || img.dataset.src;
            return src && !src.startsWith('data:') && !src.endsWith('.svg');
        });
        
        console.log(`Found ${validImages.length} valid images`);
        
        // Look for links
        const links = document.querySelectorAll('a');
        const imageLinks = Array.from(links).filter(link => {
            const href = link.href;
            return href && (href.includes('image') || href.includes('photo') || href.includes('gallery'));
        });
        
        console.log(`Found ${imageLinks.length} image-related links`);
        
        if (validImages.length > 0 || imageLinks.length > 0) {
            console.log('✅ Page appears to have scrapable content');
        } else {
            console.log('⚠️ No obvious scrapable content found');
            testResults.errors.push('No obvious scrapable content found');
        }
        
    } catch (error) {
        console.log('❌ Manual scraping simulation failed:', error.message);
        testResults.errors.push('Manual scraping simulation failed: ' + error.message);
    }
}

// Run all tests
function runAllTests() {
    console.log('Starting comprehensive CSP bypass tests...\n');
    
    testContentScript();
    setTimeout(() => testInjectedScript(), 500);
    setTimeout(() => testMessagePassing(), 1000);
    setTimeout(() => testSecurityRestrictions(), 1500);
    setTimeout(() => testPageStructure(), 2000);
    setTimeout(() => testJavaScriptErrors(), 2500);
    setTimeout(() => testExtensionInstallation(), 3000);
    setTimeout(() => testManualScraping(), 3500);
    
    setTimeout(() => {
        console.log('\n=== COMPREHENSIVE TEST SUMMARY ===');
        console.log('Test Results:');
        console.log(`  Content Script: ${testResults.contentScript ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  Injected Script: ${testResults.injectedScript ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  Message Passing: ${testResults.messagePassing ? '✅ PASS' : '⚠️ UNKNOWN'}`);
        console.log(`  Extension Access: ${testResults.extensionAccess ? '✅ PASS' : '❌ FAIL'}`);
        
        if (testResults.errors.length > 0) {
            console.log('\nErrors Found:');
            testResults.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }
        
        console.log('\nOverall Assessment:');
        if (testResults.contentScript && testResults.injectedScript) {
            console.log('🎉 EXCELLENT: CSP bypass is working correctly!');
            console.log('✅ The extension should now work on imago-images.com');
            console.log('💡 Try using the extension to scrape images now');
        } else if (testResults.injectedScript) {
            console.log('⚠️ GOOD: Injected script is working, but content script may have issues');
            console.log('💡 The extension might work, but there could be communication issues');
        } else {
            console.log('❌ POOR: CSP bypass is not working');
            console.log('💡 The extension will likely still fail on this site');
            console.log('🔧 Check extension permissions and reload the extension');
        }
        
        console.log('\nNext Steps:');
        console.log('1. If tests passed: Try using the extension to scrape images');
        console.log('2. If tests failed: Reload the extension and run tests again');
        console.log('3. If still failing: Check chrome://extensions/ for any errors');
        
    }, 4000);
}

// Auto-run tests
runAllTests();

// Export for manual testing
window.testCompleteFix = runAllTests;