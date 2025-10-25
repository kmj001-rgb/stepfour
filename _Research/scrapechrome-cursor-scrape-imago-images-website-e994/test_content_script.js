// Test script to verify content script injection and basic functionality
// This should be run in the browser console on imago-images.com

console.log('=== CONTENT SCRIPT TEST ===');

// Check if content script is loaded
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ Chrome extension APIs available');
    
    // Test message sending
    try {
        chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Message sending failed:', chrome.runtime.lastError);
            } else {
                console.log('✅ Message sent successfully:', response);
            }
        });
    } catch (error) {
        console.error('❌ Error sending message:', error);
    }
} else {
    console.log('❌ Chrome extension APIs not available');
}

// Test basic DOM functionality
console.log('=== DOM TEST ===');
console.log('Document ready state:', document.readyState);
console.log('Window location:', window.location.href);

// Test if we can find any elements
const testSelectors = [
    'img',
    'a',
    'div',
    'body'
];

testSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
});

// Test if we can access the page
console.log('=== PAGE ACCESS TEST ===');
try {
    console.log('Page title:', document.title);
    console.log('Page URL:', window.location.href);
    console.log('Domain:', window.location.hostname);
    console.log('✅ Page access successful');
} catch (error) {
    console.error('❌ Page access failed:', error);
}

console.log('=== TEST COMPLETE ===');