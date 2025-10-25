// Diagnostic script for imago-images.com content script injection issue
// Run this in the browser console on https://www.imago-images.com/search?querystring=Faye%20tozer

console.log('=== IMAGO-IMAGES.COM DIAGNOSTIC ===');

// Test 1: Check if we're in a content script context
function testContentScriptContext() {
    console.log('\n1. CONTENT SCRIPT CONTEXT TEST');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✅ Chrome extension APIs available');
        
        // Check if we can access the extension
        try {
            const manifest = chrome.runtime.getManifest();
            console.log('✅ Extension accessible:', manifest.name);
        } catch (error) {
            console.log('❌ Extension not accessible:', error.message);
        }
    } else {
        console.log('❌ Chrome extension APIs not available');
        console.log('This means the content script is NOT injected on this page');
        return false;
    }
    
    return true;
}

// Test 2: Check for content script messages
function testContentScriptMessages() {
    console.log('\n2. CONTENT SCRIPT MESSAGES TEST');
    
    // Look for any Gallery Scraper messages in the console
    const logs = [];
    const originalLog = console.log;
    
    console.log = function(...args) {
        const message = args.join(' ');
        if (message.includes('[Gallery Scraper]')) {
            logs.push(message);
        }
        originalLog.apply(console, args);
    };
    
    // Wait a moment and check
    setTimeout(() => {
        if (logs.length > 0) {
            console.log('✅ Found Gallery Scraper messages:', logs.length);
            logs.forEach(msg => console.log('  -', msg));
        } else {
            console.log('❌ No Gallery Scraper messages found');
            console.log('This confirms the content script is NOT running');
        }
        console.log = originalLog;
    }, 2000);
}

// Test 3: Check CSP and security restrictions
function testSecurityRestrictions() {
    console.log('\n3. SECURITY RESTRICTIONS TEST');
    
    // Check for CSP headers
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCSP) {
        console.log('⚠️ CSP meta tag found:', metaCSP.content);
        
        // Check if CSP blocks script injection
        if (metaCSP.content.includes("script-src") && !metaCSP.content.includes("'unsafe-inline'")) {
            console.log('❌ CSP likely blocking content script injection');
        }
    } else {
        console.log('✅ No CSP meta tag found');
    }
    
    // Check for other security headers
    const securityHeaders = [
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection'
    ];
    
    console.log('Security headers (if visible):');
    securityHeaders.forEach(header => {
        // Note: We can't directly access response headers from content script
        console.log(`  ${header}: Not directly accessible`);
    });
}

// Test 4: Check page structure and timing
function testPageStructure() {
    console.log('\n4. PAGE STRUCTURE TEST');
    
    console.log('Document ready state:', document.readyState);
    console.log('Page URL:', window.location.href);
    console.log('Domain:', window.location.hostname);
    
    // Check if page is fully loaded
    if (document.readyState === 'complete') {
        console.log('✅ Page fully loaded');
    } else {
        console.log('⚠️ Page not fully loaded, ready state:', document.readyState);
    }
    
    // Check for dynamic content loading
    const scripts = document.querySelectorAll('script');
    console.log(`Found ${scripts.length} script tags`);
    
    // Check for any extension-related scripts
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
}

// Test 5: Manual content script simulation
function testManualInjection() {
    console.log('\n5. MANUAL INJECTION TEST');
    
    // Try to simulate what the content script should do
    try {
        // Test basic functionality
        const testElement = document.createElement('div');
        testElement.id = 'manual-injection-test';
        testElement.textContent = 'Manual injection test';
        testElement.style.display = 'none';
        document.body.appendChild(testElement);
        
        if (document.getElementById('manual-injection-test')) {
            console.log('✅ Manual DOM manipulation working');
            document.body.removeChild(testElement);
        } else {
            console.log('❌ Manual DOM manipulation failed');
        }
        
        // Test message sending (if chrome APIs are available)
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            console.log('✅ Chrome APIs available for manual testing');
            
            // Try to send a test message
            chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('❌ Manual message sending failed:', chrome.runtime.lastError.message);
                } else {
                    console.log('✅ Manual message sending working:', response);
                }
            });
        } else {
            console.log('❌ Chrome APIs not available for manual testing');
        }
        
    } catch (error) {
        console.log('❌ Manual injection test failed:', error.message);
    }
}

// Test 6: Check for any JavaScript errors
function testJavaScriptErrors() {
    console.log('\n6. JAVASCRIPT ERRORS TEST');
    
    // Listen for any JavaScript errors
    const originalError = console.error;
    const errors = [];
    
    console.error = function(...args) {
        const errorMessage = args.join(' ');
        errors.push(errorMessage);
        originalError.apply(console, args);
    };
    
    // Wait a moment and check for errors
    setTimeout(() => {
        if (errors.length > 0) {
            console.log('⚠️ JavaScript errors found:', errors.length);
            errors.forEach(error => console.log('  -', error));
        } else {
            console.log('✅ No JavaScript errors detected');
        }
        console.error = originalError;
    }, 3000);
}

// Test 7: Check extension installation
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
            
        } catch (error) {
            console.log('❌ Extension installation issue:', error.message);
        }
    } else {
        console.log('❌ Extension not installed or not accessible');
    }
}

// Test 8: Check for site-specific blocking
function testSiteBlocking() {
    console.log('\n8. SITE BLOCKING TEST');
    
    // Check if the site has any anti-bot or anti-extension measures
    const pageContent = document.body.innerHTML;
    
    // Look for common anti-bot indicators
    const antiBotIndicators = [
        'bot',
        'crawler',
        'scraper',
        'automation',
        'extension',
        'chrome-extension'
    ];
    
    const foundIndicators = antiBotIndicators.filter(indicator => 
        pageContent.toLowerCase().includes(indicator)
    );
    
    if (foundIndicators.length > 0) {
        console.log('⚠️ Potential anti-bot measures found:', foundIndicators);
    } else {
        console.log('✅ No obvious anti-bot measures detected');
    }
    
    // Check for any blocking scripts
    const blockingScripts = Array.from(document.querySelectorAll('script')).filter(script => {
        const content = script.textContent || '';
        return content.includes('block') || content.includes('prevent') || content.includes('disable');
    });
    
    if (blockingScripts.length > 0) {
        console.log('⚠️ Potential blocking scripts found:', blockingScripts.length);
    } else {
        console.log('✅ No obvious blocking scripts detected');
    }
}

// Run all tests
function runAllDiagnostics() {
    console.log('Starting comprehensive diagnostics for imago-images.com...\n');
    
    testContentScriptContext();
    setTimeout(() => testContentScriptMessages(), 500);
    setTimeout(() => testSecurityRestrictions(), 1000);
    setTimeout(() => testPageStructure(), 1500);
    setTimeout(() => testManualInjection(), 2000);
    setTimeout(() => testJavaScriptErrors(), 2500);
    setTimeout(() => testExtensionInstallation(), 3000);
    setTimeout(() => testSiteBlocking(), 3500);
    
    setTimeout(() => {
        console.log('\n=== DIAGNOSTIC SUMMARY ===');
        console.log('Based on the results above:');
        console.log('1. If Chrome APIs are not available: Content script injection is blocked');
        console.log('2. If no Gallery Scraper messages: Content script is not running');
        console.log('3. If CSP is found: Security policy may be blocking injection');
        console.log('4. If extension is not accessible: Installation issue');
        console.log('\nNext steps:');
        console.log('- Check chrome://extensions/ for any errors');
        console.log('- Try reloading the extension');
        console.log('- Check if the site has anti-extension measures');
    }, 4000);
}

// Auto-run diagnostics
runAllDiagnostics();

// Export for manual testing
window.diagnoseImagoIssue = runAllDiagnostics;