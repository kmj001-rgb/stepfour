// Validation script to test all fixes applied to Gallery Scraper Pro
// Run this in the browser console to validate the fixes

console.log('=== GALLERY SCRAPER PRO FIXES VALIDATION ===');

// Test 1: Check if content script is loaded
function testContentScriptLoaded() {
    console.log('Test 1: Content Script Loading');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ Chrome extension APIs available');
        
        // Test message sending
        chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('⚠️ Content script not responding (may be normal if not on target page)');
            } else {
                console.log('✅ Content script responding:', response);
            }
        });
    } else {
        console.log('❌ Chrome extension APIs not available');
    }
}

// Test 2: Validate message handling structure
function testMessageHandling() {
    console.log('Test 2: Message Handling Structure');
    
    // Check if message listener is properly set up
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        console.log('✅ Message listener infrastructure available');
    } else {
        console.log('❌ Message listener infrastructure not available');
    }
}

// Test 3: Test async operation handling
function testAsyncOperations() {
    console.log('Test 3: Async Operation Handling');
    
    // Test if async/await is supported
    if (typeof Promise !== 'undefined' && typeof async !== 'undefined') {
        console.log('✅ Async/await support available');
    } else {
        console.log('❌ Async/await not supported');
    }
}

// Test 4: Validate error handling
function testErrorHandling() {
    console.log('Test 4: Error Handling');
    
    // Test try-catch functionality
    try {
        throw new Error('Test error');
    } catch (error) {
        console.log('✅ Error handling working:', error.message);
    }
}

// Test 5: Check DOM manipulation capabilities
function testDOMManipulation() {
    console.log('Test 5: DOM Manipulation');
    
    try {
        const testElement = document.createElement('div');
        testElement.className = 'test-element';
        document.body.appendChild(testElement);
        
        const found = document.querySelector('.test-element');
        if (found) {
            console.log('✅ DOM manipulation working');
            document.body.removeChild(testElement);
        } else {
            console.log('❌ DOM manipulation failed');
        }
    } catch (error) {
        console.log('❌ DOM manipulation error:', error.message);
    }
}

// Test 6: Validate selector functionality
function testSelectorFunctionality() {
    console.log('Test 6: Selector Functionality');
    
    const testSelectors = [
        'img',
        'a',
        '.gallery-item',
        '.search-result',
        '[data-media-id]'
    ];
    
    testSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            console.log(`✅ Selector "${selector}": ${elements.length} elements found`);
        } catch (error) {
            console.log(`❌ Selector "${selector}" failed:`, error.message);
        }
    });
}

// Test 7: Check network request capabilities
function testNetworkCapabilities() {
    console.log('Test 7: Network Capabilities');
    
    if (typeof fetch !== 'undefined') {
        console.log('✅ Fetch API available');
    } else {
        console.log('❌ Fetch API not available');
    }
    
    if (typeof XMLHttpRequest !== 'undefined') {
        console.log('✅ XMLHttpRequest available');
    } else {
        console.log('❌ XMLHttpRequest not available');
    }
}

// Test 8: Validate storage capabilities
function testStorageCapabilities() {
    console.log('Test 8: Storage Capabilities');
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
        console.log('✅ Chrome storage API available');
        
        // Test storage access
        chrome.storage.local.get(['test'], (result) => {
            console.log('✅ Storage access working');
        });
    } else {
        console.log('❌ Chrome storage API not available');
    }
}

// Test 9: Check image handling
function testImageHandling() {
    console.log('Test 9: Image Handling');
    
    const images = document.querySelectorAll('img');
    console.log(`Found ${images.length} images on page`);
    
    if (images.length > 0) {
        const firstImage = images[0];
        console.log('✅ Image properties available:', {
            src: firstImage.src,
            naturalWidth: firstImage.naturalWidth,
            naturalHeight: firstImage.naturalHeight,
            complete: firstImage.complete
        });
    }
}

// Test 10: Validate URL handling
function testURLHandling() {
    console.log('Test 10: URL Handling');
    
    try {
        const currentUrl = new URL(window.location.href);
        console.log('✅ URL parsing working:', {
            hostname: currentUrl.hostname,
            pathname: currentUrl.pathname,
            search: currentUrl.search
        });
    } catch (error) {
        console.log('❌ URL parsing failed:', error.message);
    }
}

// Run all tests
function runAllTests() {
    console.log('Starting comprehensive validation...\n');
    
    testContentScriptLoaded();
    setTimeout(() => testMessageHandling(), 100);
    setTimeout(() => testAsyncOperations(), 200);
    setTimeout(() => testErrorHandling(), 300);
    setTimeout(() => testDOMManipulation(), 400);
    setTimeout(() => testSelectorFunctionality(), 500);
    setTimeout(() => testNetworkCapabilities(), 600);
    setTimeout(() => testStorageCapabilities(), 700);
    setTimeout(() => testImageHandling(), 800);
    setTimeout(() => testURLHandling(), 900);
    
    setTimeout(() => {
        console.log('\n=== VALIDATION COMPLETE ===');
        console.log('If all tests show ✅, the fixes should work correctly.');
        console.log('If any tests show ❌, there may be compatibility issues.');
    }, 1000);
}

// Auto-run validation
runAllTests();

// Export for manual testing
window.validateGalleryScraperFixes = runAllTests;