// Debug script for imago-images.com scraping issues
// Run this in the browser console on https://www.imago-images.com/search?querystring=Faye%20tozer

console.log('=== IMAGO IMAGES DEBUG SCRIPT ===');

// Check page readiness
console.log('Document ready state:', document.readyState);
console.log('Page URL:', window.location.href);
console.log('Page title:', document.title);

// Test the Imago-specific selectors
const imagoSelectors = {
    imageContainer: '.search-result-item, .image-tile, .gallery-item, [data-media-id]',
    imageElement: '.search-result-item img, .image-tile img, .gallery-item img',
    linkElement: '.search-result-item a, .image-tile a, .gallery-item a, a[href*="detail"]',
    nextPageButton: '.pagination .next, .next-page-btn, [aria-label*="next"]',
    loadMoreButton: '.load-more-results, .show-more-images, .infinite-load'
};

console.log('=== TESTING IMAGO SELECTORS ===');

// Test each selector
Object.entries(imagoSelectors).forEach(([name, selector]) => {
    try {
        const elements = document.querySelectorAll(selector);
        console.log(`${name}: Found ${elements.length} elements`);
        if (elements.length > 0) {
            console.log(`  First element:`, elements[0]);
            console.log(`  First element HTML:`, elements[0].outerHTML.substring(0, 200) + '...');
        }
    } catch (error) {
        console.error(`${name}: Error with selector "${selector}":`, error);
    }
});

// Test universal selectors
console.log('=== TESTING UNIVERSAL SELECTORS ===');
const universalSelectors = [
    '.gallery-item', '.search-result', '.image-item', '.photo-item',
    '.result-item', '.thumbnail', '.card', '.tile', '.grid-item',
    '[data-testid*="image"]', '[data-testid*="photo"]', '[data-testid*="result"]',
    '.image-container', '.photo-container', '.media-item',
    'article img', 'figure img', '.content img',
    'a[href*="image"]', 'a[href*="photo"]', 'a[href*="gallery"]'
];

universalSelectors.forEach(selector => {
    try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`${selector}: Found ${elements.length} elements`);
        }
    } catch (error) {
        console.error(`${selector}: Error:`, error);
    }
});

// Check for any images on the page
console.log('=== CHECKING ALL IMAGES ===');
const allImages = document.querySelectorAll('img');
console.log(`Total images found: ${allImages.length}`);

allImages.forEach((img, index) => {
    if (index < 10) { // Only log first 10
        console.log(`Image ${index + 1}:`, {
            src: img.src,
            currentSrc: img.currentSrc,
            dataset: img.dataset,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            parent: img.parentElement?.tagName,
            parentClass: img.parentElement?.className
        });
    }
});

// Check for any links that might contain images
console.log('=== CHECKING LINKS ===');
const allLinks = document.querySelectorAll('a');
console.log(`Total links found: ${allLinks.length}`);

const imageLinks = Array.from(allLinks).filter(link => {
    return link.href && (
        link.href.includes('image') || 
        link.href.includes('photo') || 
        link.href.includes('detail') ||
        link.querySelector('img')
    );
});

console.log(`Links with images or image-related URLs: ${imageLinks.length}`);
imageLinks.slice(0, 5).forEach((link, index) => {
    console.log(`Image link ${index + 1}:`, {
        href: link.href,
        text: link.textContent?.trim(),
        hasImg: !!link.querySelector('img')
    });
});

// Check page structure
console.log('=== PAGE STRUCTURE ===');
console.log('Body classes:', document.body.className);
console.log('Main content areas:');
['main', 'content', 'container', 'wrapper', 'search-results', 'gallery'].forEach(className => {
    const elements = document.querySelectorAll(`.${className}`);
    if (elements.length > 0) {
        console.log(`  .${className}: ${elements.length} elements`);
    }
});

console.log('=== DEBUG COMPLETE ===');