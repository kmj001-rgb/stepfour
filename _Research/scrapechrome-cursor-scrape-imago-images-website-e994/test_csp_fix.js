// Test script to verify CSP bypass fix on imago-images.com
// Run this in the browser console after reloading the extension

console.log('=== TESTING CSP BYPASS FIX ===');

// Test 1: Check if content script is loaded
function testContentScript() {
    console.log('\n1. CONTENT SCRIPT TEST');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ Chrome extension APIs available');
        
        // Try to send a test message
        chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Content script not responding:', chrome.runtime.lastError.message);
            } else {
                console.log('✅ Content script responding:', response);
            }
        });
    } else {
        console.log('❌ Chrome extension APIs not available');
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
        } else {
            console.log('❌ No injected script messages found');
        }
        console.log = originalLog;
    }, 2000);
}

// Test 3: Test message passing
function testMessagePassing() {
    console.log('\n3. MESSAGE PASSING TEST');
    
    // Send a test message to the injected script
    window.postMessage({
        type: 'GALLERY_SCRAPER_INJECTED',
        action: 'getPageInfo'
    }, '*');
    
    console.log('✅ Test message sent to injected script');
}

// Test 4: Check for any errors
function testErrors() {
    console.log('\n4. ERROR TEST');
    
    const originalError = console.error;
    const errors = [];
    
    console.error = function(...args) {
        const errorMessage = args.join(' ');
        errors.push(errorMessage);
        originalError.apply(console, args);
    };
    
    setTimeout(() => {
        if (errors.length > 0) {
            console.log('⚠️ Errors found:', errors.length);
            errors.forEach(error => console.log('  -', error));
        } else {
            console.log('✅ No errors detected');
        }
        console.error = originalError;
    }, 3000);
}

// Run all tests
function runAllTests() {
    console.log('Starting CSP bypass tests...\n');
    
    testContentScript();
    setTimeout(() => testInjectedScript(), 500);
    setTimeout(() => testMessagePassing(), 1000);
    setTimeout(() => testErrors(), 1500);
    
    setTimeout(() => {
        console.log('\n=== TEST SUMMARY ===');
        console.log('If you see ✅ for content script and injected script tests, the fix is working.');
        console.log('If you see ❌, the CSP bypass may need adjustment.');
        console.log('\nNext step: Try using the extension to scrape images.');
    }, 4000);
}

// Auto-run tests
runAllTests();

// Export for manual testing
window.testCSPFix = runAllTests;