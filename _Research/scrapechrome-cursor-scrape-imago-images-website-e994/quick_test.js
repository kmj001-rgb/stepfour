// Quick test for Gallery Scraper Pro on imago-images.com
// Run this in the browser console immediately

console.log('=== QUICK GALLERY SCRAPER TEST ===');

// Test 1: Check if content script is loaded
console.log('1. Checking content script...');
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ Chrome APIs available');
    
    // Try to send a test message
    chrome.runtime.sendMessage({ action: 'getPageInfo' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('❌ Content script not responding:', chrome.runtime.lastError.message);
        } else {
            console.log('✅ Content script responding:', response);
        }
    });
} else {
    console.log('❌ Chrome APIs not available - extension may not be loaded');
}

// Test 2: Check page structure
console.log('2. Checking page structure...');
const images = document.querySelectorAll('img');
console.log(`Found ${images.length} images on page`);

const links = document.querySelectorAll('a');
console.log(`Found ${links.length} links on page`);

// Test 3: Check for common gallery selectors
console.log('3. Checking gallery selectors...');
const selectors = [
    '.gallery-item',
    '.search-result',
    '.image-item',
    '.result-item',
    '[data-media-id]',
    '.image-container'
];

selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
    }
});

// Test 4: Check for any Gallery Scraper messages in console
console.log('4. Checking for Gallery Scraper messages...');
const originalLog = console.log;
let foundGalleryScraperMessages = false;

console.log = function(...args) {
    const message = args.join(' ');
    if (message.includes('[Gallery Scraper]')) {
        foundGalleryScraperMessages = true;
        console.log('✅ Found Gallery Scraper message:', message);
    }
    originalLog.apply(console, args);
};

// Wait a moment and check
setTimeout(() => {
    if (!foundGalleryScraperMessages) {
        console.log('❌ No Gallery Scraper messages found - content script may not be loaded');
    }
    console.log = originalLog;
}, 2000);

// Test 5: Check page URL and domain
console.log('5. Checking page info...');
console.log('URL:', window.location.href);
console.log('Domain:', window.location.hostname);
console.log('Document ready state:', document.readyState);

console.log('=== QUICK TEST COMPLETE ===');
console.log('If you see ❌ for content script tests, the extension may not be properly loaded.');
console.log('Try reloading the extension in chrome://extensions/');