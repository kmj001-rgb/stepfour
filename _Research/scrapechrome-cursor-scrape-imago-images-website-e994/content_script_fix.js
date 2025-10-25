// Alternative content script injection for sites with strict CSP
// This script can be manually injected to test if the issue is CSP-related

console.log('=== ALTERNATIVE CONTENT SCRIPT INJECTION ===');

// Check if we're already in a content script context
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ Already in content script context');
} else {
    console.log('❌ Not in content script context - attempting manual injection');
    
    // Try to manually inject the content script functionality
    try {
        // Create a script element to inject the content script
        const script = document.createElement('script');
        script.textContent = `
            // Simulate content script functionality
            console.log('[Manual Injection] Content script functionality injected');
            
            // Add message listener
            window.addEventListener('message', function(event) {
                if (event.source !== window) return;
                if (event.data.type !== 'GALLERY_SCRAPER_MESSAGE') return;
                
                console.log('[Manual Injection] Received message:', event.data);
                
                // Handle the message
                const { action, settings, siteProfile } = event.data;
                
                if (action === 'startScrapePage' || action === 'startScrapeAllPages') {
                    console.log('[Manual Injection] Starting scraping...');
                    
                    // Simulate scraping functionality
                    setTimeout(() => {
                        // Send response back
                        window.postMessage({
                            type: 'GALLERY_SCRAPER_RESPONSE',
                            action: action,
                            success: true,
                            data: {
                                thumbnails: [],
                                destinations: [],
                                message: 'Manual injection working'
                            }
                        }, '*');
                    }, 1000);
                }
            });
            
            // Send ready message
            window.postMessage({
                type: 'GALLERY_SCRAPER_READY',
                message: 'Manual injection ready'
            }, '*');
        `;
        
        document.head.appendChild(script);
        console.log('✅ Manual injection script added');
        
    } catch (error) {
        console.log('❌ Manual injection failed:', error.message);
    }
}

// Test if manual injection worked
setTimeout(() => {
    console.log('Testing manual injection...');
    
    // Try to send a test message
    window.postMessage({
        type: 'GALLERY_SCRAPER_MESSAGE',
        action: 'getPageInfo'
    }, '*');
    
}, 1000);

// Listen for responses
window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data.type !== 'GALLERY_SCRAPER_RESPONSE' && event.data.type !== 'GALLERY_SCRAPER_READY') return;
    
    console.log('[Manual Injection] Response received:', event.data);
});

console.log('Manual injection test complete');