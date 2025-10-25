// A robust content script to handle scraping logic, pagination, and lazy loading.

// Helper function to wait for a specific duration
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to get a unique filename from a URL
const getFilenameFromUrl = (url) => {
    try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/');
        let filename = pathSegments.pop() || pathSegments.pop(); // Handle trailing slashes
        if (filename) {
            return filename.split('?')[0]; // Remove query parameters
        }
    } catch (e) {
        console.error('Invalid URL:', url);
    }
    return 'unnamed_image.jpg';
};

// Function to extract image and destination links
const extractData = () => {
    const thumbnails = [];
    const destinations = [];
    const items = document.querySelectorAll('img'); // Find all images

    items.forEach(img => {
        const thumbnailUrl = img.src;
        // Find the closest parent <a> tag for the destination link
        const destinationElement = img.closest('a');
        const destinationUrl = destinationElement ? destinationElement.href : '';
        
        thumbnails.push(thumbnailUrl);
        destinations.push(destinationUrl);
    });

    return { thumbnails, destinations };
};

// Function to wait for the page to fully load
const waitForPageLoad = async () => {
    while (document.readyState !== 'complete') {
        await wait(500);
    }
    await wait(2000); // Additional wait time for scripts to run
};

// Function to handle lazy loading/infinite scroll
const scrollAndCheck = async (delay) => {
    let previousHeight = document.body.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    await wait(delay);
    let newHeight = document.body.scrollHeight;
    return newHeight > previousHeight;
};

// Main scraping logic
const scrape = async () => {
    console.log('Starting scrape process on page...');
    await waitForPageLoad();

    // Check for lazy-loading and scroll down
    let hasNewContent = true;
    while (hasNewContent) {
        hasNewContent = await scrollAndCheck(2000); // Wait 2 seconds for new content
    }

    const scrapedData = extractData();
    console.log('Scraped data:', scrapedData);

    // Send the data to the background script
    chrome.runtime.sendMessage({ action: 'scrapedData', data: scrapedData });
};

// Function to detect and click the next page button
const paginate = async () => {
    // Look for a pagination button with text like 'Next', '>', etc.
    const nextButton = document.querySelector('a.next, a[rel="next"], button.next-page, .pagination a:last-child');
    if (nextButton) {
        console.log('Found next page button. Clicking...');
        nextButton.click();
        // Wait for the next page to load
        await waitForPageLoad();
        // Recurse to scrape the new page
        scrape();
    } else {
        console.log('No next page button found. Scraping complete.');
        // Notify the background script that the scrape is finished
        chrome.runtime.sendMessage({ action: 'scrapeComplete' });
    }
};


// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrapePage') {
        scrape();
    } else if (message.action === 'paginate') {
        paginate();
    }
    
    return true; // Keep the message channel open for async response
});