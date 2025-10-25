// Test script to verify content script injection on imago-images.com
// Run this in the browser console on https://www.imago-images.com/search?querystring=Faye%20tozer

console.log('=== CONTENT SCRIPT INJECTION TEST ===');

// Test 1: Check if content script is loaded
function testContentScriptInjection() {
    console.log('Test 1: Content Script Injection Check');
    
    // Check if the content script initialization message appears
    const logs = [];
    const originalLog = console.log;
    console.log = function(...args) {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
    };
    
    // Wait a moment for any initialization messages
    setTimeout(() => {
        const contentScriptLoaded = logs.some(log => log.includes('Gallery Scraper Pro content script loaded'));
        if (contentScriptLoaded) {
            console.log('✅ Content script is loaded and initialized');
        } else {
            console.log('❌ Content script not found in logs');
        }
        
        // Check for any Gallery Scraper messages
        const scraperMessages = logs.filter(log => log.includes('[Gallery Scraper]'));
        if (scraperMessages.length > 0) {
            console.log('✅ Found Gallery Scraper messages:', scraperMessages.length);
        } else {
            console.log('❌ No Gallery Scraper messages found');
        }
        
        console.log = originalLog;
    }, 1000);
}

// Test 2: Check Chrome extension APIs
function testChromeAPIs() {
    console.log('Test 2: Chrome Extension APIs');
    
    if (typeof chrome !== 'undefined') {
        console.log('✅ Chrome object available');
        
        if (chrome.runtime) {
            console.log('✅ Chrome runtime available');
            
            // Test message sending
            chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('❌ Content script not responding:', chrome.runtime.lastError.message);
                } else {
                    console.log('✅ Content script responding:', response);
                }
            });
        } else {
            console.log('❌ Chrome runtime not available');
        }
    } else {
        console.log('❌ Chrome object not available');
    }
}

// Test 3: Check if we're in a content script context
function testContentScriptContext() {
    console.log('Test 3: Content Script Context');
    
    // Check if we're in a content script context
    if (typeof window !== 'undefined' && window.location) {
        console.log('✅ Window context available');
        console.log('Current URL:', window.location.href);
        console.log('Document ready state:', document.readyState);
    } else {
        console.log('❌ Window context not available');
    }
}

// Test 4: Check for extension injection
function testExtensionInjection() {
    console.log('Test 4: Extension Injection Check');
    
    // Look for any extension-related elements or scripts
    const scripts = document.querySelectorAll('script');
    const extensionScripts = Array.from(scripts).filter(script => 
        script.src && script.src.includes('chrome-extension')
    );
    
    if (extensionScripts.length > 0) {
        console.log('✅ Found extension scripts:', extensionScripts.length);
        extensionScripts.forEach((script, index) => {
            console.log(`  Script ${index + 1}:`, script.src);
        });
    } else {
        console.log('❌ No extension scripts found');
    }
    
    // Check for any extension-related global variables
    const extensionGlobals = Object.keys(window).filter(key => 
        key.includes('chrome') || key.includes('extension') || key.includes('gallery')
    );
    
    if (extensionGlobals.length > 0) {
        console.log('✅ Found extension-related globals:', extensionGlobals);
    } else {
        console.log('❌ No extension-related globals found');
    }
}

// Test 5: Check CSP and security policies
function testSecurityPolicies() {
    console.log('Test 5: Security Policies');
    
    // Check for CSP headers
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCSP) {
        console.log('⚠️ CSP meta tag found:', metaCSP.content);
    } else {
        console.log('✅ No CSP meta tag found');
    }
    
    // Check if we can access chrome APIs
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            console.log('✅ Chrome APIs accessible');
        } else {
            console.log('❌ Chrome APIs not accessible');
        }
    } catch (error) {
        console.log('❌ Error accessing Chrome APIs:', error.message);
    }
}

// Test 6: Manual content script test
function testManualContentScript() {
    console.log('Test 6: Manual Content Script Test');
    
    // Try to simulate what the content script should do
    try {
        // Test basic functionality
        const testElement = document.createElement('div');
        testElement.id = 'gallery-scraper-test';
        testElement.textContent = 'Gallery Scraper Test';
        document.body.appendChild(testElement);
        
        const found = document.getElementById('gallery-scraper-test');
        if (found) {
            console.log('✅ Basic DOM manipulation working');
            document.body.removeChild(found);
        } else {
            console.log('❌ Basic DOM manipulation failed');
        }
        
        // Test message sending (if chrome APIs are available)
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            console.log('✅ Chrome APIs available for testing');
        } else {
            console.log('❌ Chrome APIs not available for testing');
        }
        
    } catch (error) {
        console.log('❌ Manual test failed:', error.message);
    }
}

// Run all tests
function runInjectionTests() {
    console.log('Starting content script injection tests...\n');
    
    testContentScriptInjection();
    setTimeout(() => testChromeAPIs(), 500);
    setTimeout(() => testContentScriptContext(), 1000);
    setTimeout(() => testExtensionInjection(), 1500);
    setTimeout(() => testSecurityPolicies(), 2000);
    setTimeout(() => testManualContentScript(), 2500);
    
    setTimeout(() => {
        console.log('\n=== INJECTION TEST COMPLETE ===');
        console.log('If you see ❌ for content script tests, the extension may not be properly injected.');
        console.log('Check the Chrome Extensions page and ensure the extension is enabled.');
    }, 3000);
}

// Auto-run tests
runInjectionTests();

// Export for manual testing
window.testContentScriptInjection = runInjectionTests;