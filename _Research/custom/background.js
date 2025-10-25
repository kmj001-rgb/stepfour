// A robust background script to manage scraper state, downloads, and communication.
let scraperState = {
    running: false,
    results: {
        thumbnails: [],
        destinations: []
    },
    downloadedFiles: {},
    currentPage: 1,
    lastScrapedHeight: 0
};

// Function to handle downloading a file and resolving filename duplicates
async function downloadFile(url) {
    let filename = url.substring(url.lastIndexOf('/') + 1).split('?')[0];
    let originalFilename = filename;
    let counter = 0;

    while (scraperState.downloadedFiles[filename]) {
        counter++;
        filename = `${originalFilename.split('.')[0]}_${counter}.${originalFilename.split('.')[1]}`;
    }

    scraperState.downloadedFiles[filename] = true;

    try {
        await chrome.downloads.download({
            url: url,
            filename: `scraped_images/${filename}`
        });
        return { success: true, url: url };
    } catch (error) {
        return { success: false, url: url, error: error.message };
    }
}

// Listen for messages from the popup or content script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'startScrape' && !scraperState.running) {
        scraperState.running = true;
        // Start the scraping process in the active tab
        chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
            const tabId = tabs[0].id;
            // Tell the content script to start scraping
            await chrome.tabs.sendMessage(tabId, { action: 'scrapePage' });
        });
    } else if (message.action === 'scrapedData') {
        // Receive scraped data from the content script
        console.log('Received scraped data from content script:', message.data);
        
        // Update global state with new data
        scraperState.results.thumbnails.push(...message.data.thumbnails);
        scraperState.results.destinations.push(...message.data.destinations);

        // Download thumbnails
        for (const url of message.data.thumbnails) {
            const result = await downloadFile(url);
            if (!result.success) {
                console.error(`Failed to download ${result.url}: ${result.error}`);
            }
        }
        
        // Tell the content script to paginate
        chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
            const tabId = tabs[0].id;
            await chrome.tabs.sendMessage(tabId, { action: 'paginate' });
        });
        
        sendResponse({ success: true, status: 'Scraped data received and downloads started.' });
    } else if (message.action === 'scrapeComplete') {
        // Scraper has finished, log final results and reset state
        scraperState.running = false;
        console.log('Scraping complete! Final results:', scraperState.results);
        sendResponse({ success: true, status: 'Scraping process finished.' });
    }
    
    return true;
});