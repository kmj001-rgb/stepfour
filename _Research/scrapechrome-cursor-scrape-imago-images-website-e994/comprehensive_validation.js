// Comprehensive Validation Script for Gallery Scraper Pro
// This script tests all components to ensure the extension will run as expected

console.log('=== COMPREHENSIVE GALLERY SCRAPER PRO VALIDATION ===');

// ============================================================================
// 1. MANIFEST VALIDATION
// ============================================================================

function validateManifest() {
    console.log('\n1. MANIFEST VALIDATION');
    
    // Check if we're in a content script context
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ Chrome extension APIs available');
        
        // Test manifest access
        try {
            const manifest = chrome.runtime.getManifest();
            console.log('✅ Manifest accessible:', {
                name: manifest.name,
                version: manifest.version,
                manifest_version: manifest.manifest_version
            });
            
            // Validate required permissions
            const requiredPermissions = ['downloads', 'storage', 'activeTab', 'scripting', 'webRequest', 'windows', 'notifications', 'tabs'];
            const manifestPermissions = manifest.permissions || [];
            
            const missingPermissions = requiredPermissions.filter(perm => !manifestPermissions.includes(perm));
            if (missingPermissions.length === 0) {
                console.log('✅ All required permissions present');
            } else {
                console.log('❌ Missing permissions:', missingPermissions);
            }
            
            // Validate host permissions
            const hostPermissions = manifest.host_permissions || [];
            if (hostPermissions.includes('<all_urls>')) {
                console.log('✅ Host permissions allow all URLs');
            } else {
                console.log('❌ Host permissions may be restricted');
            }
            
        } catch (error) {
            console.log('❌ Manifest access failed:', error.message);
        }
    } else {
        console.log('❌ Chrome extension APIs not available');
    }
}

// ============================================================================
// 2. CONTENT SCRIPT VALIDATION
// ============================================================================

function validateContentScript() {
    console.log('\n2. CONTENT SCRIPT VALIDATION');
    
    // Check if content script is loaded
    const contentScriptLoaded = document.querySelector('#gallery-scraper-verification');
    if (contentScriptLoaded) {
        console.log('✅ Content script verification element found');
        document.body.removeChild(contentScriptLoaded);
    } else {
        console.log('❌ Content script verification element not found');
    }
    
    // Check for Gallery Scraper messages
    const logs = [];
    const originalLog = console.log;
    console.log = function(...args) {
        const message = args.join(' ');
        if (message.includes('[Gallery Scraper]')) {
            logs.push(message);
        }
        originalLog.apply(console, args);
    };
    
    // Wait for any initialization messages
    setTimeout(() => {
        const initializationMessages = logs.filter(log => 
            log.includes('Content script initialization started') ||
            log.includes('Gallery Scraper Pro content script loaded') ||
            log.includes('Content script verification')
        );
        
        if (initializationMessages.length > 0) {
            console.log('✅ Content script initialization messages found:', initializationMessages.length);
            initializationMessages.forEach(msg => console.log('  -', msg));
        } else {
            console.log('❌ No content script initialization messages found');
        }
        
        console.log = originalLog;
    }, 2000);
    
    // Test DOM manipulation capabilities
    try {
        const testElement = document.createElement('div');
        testElement.id = 'validation-test';
        testElement.style.display = 'none';
        document.body.appendChild(testElement);
        
        if (document.getElementById('validation-test')) {
            console.log('✅ DOM manipulation working');
            document.body.removeChild(testElement);
        } else {
            console.log('❌ DOM manipulation failed');
        }
    } catch (error) {
        console.log('❌ DOM manipulation error:', error.message);
    }
}

// ============================================================================
// 3. MESSAGE PASSING VALIDATION
// ============================================================================

function validateMessagePassing() {
    console.log('\n3. MESSAGE PASSING VALIDATION');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Test basic message sending
        chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('❌ Message passing failed:', chrome.runtime.lastError.message);
            } else if (response) {
                console.log('✅ Message passing working:', response);
            } else {
                console.log('❌ No response received');
            }
        });
        
        // Test status update
        setTimeout(() => {
            chrome.runtime.sendMessage({
                action: 'statusUpdate',
                message: 'Validation test message',
                type: 'info',
                timestamp: Date.now(),
                url: window.location.href
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('❌ Status update failed:', chrome.runtime.lastError.message);
                } else {
                    console.log('✅ Status update working');
                }
            });
        }, 1000);
        
    } else {
        console.log('❌ Chrome APIs not available for message testing');
    }
}

// ============================================================================
// 4. PAGE STRUCTURE VALIDATION
// ============================================================================

function validatePageStructure() {
    console.log('\n4. PAGE STRUCTURE VALIDATION');
    
    // Check for images
    const images = document.querySelectorAll('img');
    console.log(`Found ${images.length} images on page`);
    
    if (images.length > 0) {
        const firstImage = images[0];
        console.log('✅ Image properties:', {
            src: firstImage.src,
            naturalWidth: firstImage.naturalWidth,
            naturalHeight: firstImage.naturalHeight,
            complete: firstImage.complete
        });
    } else {
        console.log('⚠️ No images found on page');
    }
    
    // Check for links
    const links = document.querySelectorAll('a');
    console.log(`Found ${links.length} links on page`);
    
    // Check for common gallery selectors
    const gallerySelectors = [
        '.gallery-item',
        '.search-result',
        '.image-item',
        '.result-item',
        '[data-media-id]',
        '.image-container',
        '.search-result-item',
        '.image-tile'
    ];
    
    gallerySelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        }
    });
    
    // Check page URL and domain
    console.log('✅ Page info:', {
        url: window.location.href,
        domain: window.location.hostname,
        readyState: document.readyState
    });
}

// ============================================================================
// 5. FUNCTIONALITY VALIDATION
// ============================================================================

function validateFunctionality() {
    console.log('\n5. FUNCTIONALITY VALIDATION');
    
    // Test async/await support
    if (typeof Promise !== 'undefined' && typeof async !== 'undefined') {
        console.log('✅ Async/await support available');
    } else {
        console.log('❌ Async/await not supported');
    }
    
    // Test fetch API
    if (typeof fetch !== 'undefined') {
        console.log('✅ Fetch API available');
    } else {
        console.log('❌ Fetch API not available');
    }
    
    // Test XMLHttpRequest
    if (typeof XMLHttpRequest !== 'undefined') {
        console.log('✅ XMLHttpRequest available');
    } else {
        console.log('❌ XMLHttpRequest not available');
    }
    
    // Test URL parsing
    try {
        const testUrl = new URL('https://example.com/test');
        console.log('✅ URL parsing working');
    } catch (error) {
        console.log('❌ URL parsing failed:', error.message);
    }
    
    // Test error handling
    try {
        throw new Error('Test error');
    } catch (error) {
        console.log('✅ Error handling working:', error.message);
    }
}

// ============================================================================
// 6. PERFORMANCE VALIDATION
// ============================================================================

function validatePerformance() {
    console.log('\n6. PERFORMANCE VALIDATION');
    
    // Test selector performance
    const startTime = Date.now();
    const allImages = document.querySelectorAll('img');
    const selectorTime = Date.now() - startTime;
    console.log(`✅ Selector performance: ${selectorTime}ms for ${allImages.length} images`);
    
    // Test DOM manipulation performance
    const domStartTime = Date.now();
    const testElements = [];
    for (let i = 0; i < 10; i++) {
        const element = document.createElement('div');
        element.id = `perf-test-${i}`;
        document.body.appendChild(element);
        testElements.push(element);
    }
    
    // Clean up
    testElements.forEach(element => {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
    });
    
    const domTime = Date.now() - domStartTime;
    console.log(`✅ DOM manipulation performance: ${domTime}ms for 10 elements`);
}

// ============================================================================
// 7. SECURITY VALIDATION
// ============================================================================

function validateSecurity() {
    console.log('\n7. SECURITY VALIDATION');
    
    // Check for CSP headers
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCSP) {
        console.log('⚠️ CSP meta tag found:', metaCSP.content);
    } else {
        console.log('✅ No CSP meta tag found');
    }
    
    // Check for secure context
    if (window.isSecureContext) {
        console.log('✅ Running in secure context');
    } else {
        console.log('⚠️ Not running in secure context');
    }
    
    // Check for mixed content
    const images = document.querySelectorAll('img');
    const mixedContentImages = Array.from(images).filter(img => {
        const imgUrl = img.src || img.currentSrc;
        return imgUrl && imgUrl.startsWith('http:') && window.location.protocol === 'https:';
    });
    
    if (mixedContentImages.length > 0) {
        console.log(`⚠️ Found ${mixedContentImages.length} mixed content images`);
    } else {
        console.log('✅ No mixed content detected');
    }
}

// ============================================================================
// 8. COMPATIBILITY VALIDATION
// ============================================================================

function validateCompatibility() {
    console.log('\n8. COMPATIBILITY VALIDATION');
    
    // Check browser features
    const features = {
        'Promise': typeof Promise !== 'undefined',
        'async/await': typeof async !== 'undefined',
        'fetch': typeof fetch !== 'undefined',
        'XMLHttpRequest': typeof XMLHttpRequest !== 'undefined',
        'URL': typeof URL !== 'undefined',
        'Map': typeof Map !== 'undefined',
        'Set': typeof Set !== 'undefined',
        'localStorage': typeof localStorage !== 'undefined',
        'sessionStorage': typeof sessionStorage !== 'undefined'
    };
    
    console.log('✅ Browser feature support:');
    Object.entries(features).forEach(([feature, supported]) => {
        console.log(`  ${supported ? '✅' : '❌'} ${feature}`);
    });
    
    // Check Chrome extension APIs
    const chromeAPIs = {
        'chrome.runtime': typeof chrome !== 'undefined' && chrome.runtime,
        'chrome.tabs': typeof chrome !== 'undefined' && chrome.tabs,
        'chrome.storage': typeof chrome !== 'undefined' && chrome.storage,
        'chrome.downloads': typeof chrome !== 'undefined' && chrome.downloads,
        'chrome.webRequest': typeof chrome !== 'undefined' && chrome.webRequest
    };
    
    console.log('✅ Chrome API support:');
    Object.entries(chromeAPIs).forEach(([api, available]) => {
        console.log(`  ${available ? '✅' : '❌'} ${api}`);
    });
}

// ============================================================================
// 9. ERROR HANDLING VALIDATION
// ============================================================================

function validateErrorHandling() {
    console.log('\n9. ERROR HANDLING VALIDATION');
    
    // Test try-catch functionality
    try {
        throw new Error('Test error for validation');
    } catch (error) {
        console.log('✅ Try-catch working:', error.message);
    }
    
    // Test async error handling
    (async () => {
        try {
            await Promise.reject(new Error('Async test error'));
        } catch (error) {
            console.log('✅ Async error handling working:', error.message);
        }
    })();
    
    // Test message error handling
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'nonexistent' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('✅ Message error handling working:', chrome.runtime.lastError.message);
            } else {
                console.log('⚠️ No error for nonexistent action');
            }
        });
    }
}

// ============================================================================
// 10. INTEGRATION VALIDATION
// ============================================================================

function validateIntegration() {
    console.log('\n10. INTEGRATION VALIDATION');
    
    // Test if all components are working together
    let integrationScore = 0;
    const totalTests = 5;
    
    // Test 1: Content script loaded
    if (document.querySelector('#gallery-scraper-verification')) {
        integrationScore++;
        console.log('✅ Test 1: Content script loaded');
    } else {
        console.log('❌ Test 1: Content script not loaded');
    }
    
    // Test 2: Chrome APIs available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        integrationScore++;
        console.log('✅ Test 2: Chrome APIs available');
    } else {
        console.log('❌ Test 2: Chrome APIs not available');
    }
    
    // Test 3: Message passing working
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
            if (!chrome.runtime.lastError && response) {
                integrationScore++;
                console.log('✅ Test 3: Message passing working');
            } else {
                console.log('❌ Test 3: Message passing failed');
            }
        });
    } else {
        console.log('❌ Test 3: Chrome APIs not available');
    }
    
    // Test 4: DOM manipulation working
    try {
        const testElement = document.createElement('div');
        testElement.id = 'integration-test';
        document.body.appendChild(testElement);
        if (document.getElementById('integration-test')) {
            integrationScore++;
            console.log('✅ Test 4: DOM manipulation working');
            document.body.removeChild(testElement);
        } else {
            console.log('❌ Test 4: DOM manipulation failed');
        }
    } catch (error) {
        console.log('❌ Test 4: DOM manipulation error:', error.message);
    }
    
    // Test 5: Page has content
    if (document.querySelectorAll('img').length > 0 || document.querySelectorAll('a').length > 0) {
        integrationScore++;
        console.log('✅ Test 5: Page has content');
    } else {
        console.log('❌ Test 5: Page has no content');
    }
    
    console.log(`\n📊 Integration Score: ${integrationScore}/${totalTests}`);
    
    if (integrationScore === totalTests) {
        console.log('🎉 All integration tests passed! Extension should work correctly.');
    } else {
        console.log('⚠️ Some integration tests failed. Check the issues above.');
    }
}

// ============================================================================
// RUN ALL VALIDATIONS
// ============================================================================

function runAllValidations() {
    console.log('Starting comprehensive validation...\n');
    
    validateManifest();
    setTimeout(() => validateContentScript(), 500);
    setTimeout(() => validateMessagePassing(), 1000);
    setTimeout(() => validatePageStructure(), 1500);
    setTimeout(() => validateFunctionality(), 2000);
    setTimeout(() => validatePerformance(), 2500);
    setTimeout(() => validateSecurity(), 3000);
    setTimeout(() => validateCompatibility(), 3500);
    setTimeout(() => validateErrorHandling(), 4000);
    setTimeout(() => validateIntegration(), 4500);
    
    setTimeout(() => {
        console.log('\n=== COMPREHENSIVE VALIDATION COMPLETE ===');
        console.log('Review the results above to ensure all components are working correctly.');
        console.log('If you see ❌ for any critical tests, the extension may not work as expected.');
    }, 5000);
}

// Auto-run validation
runAllValidations();

// Export for manual testing
window.runGalleryScraperValidation = runAllValidations;