import os
import pathlib

# Define the project structure
PROJECT_NAME = ""
ASSETS_DIR = "assets"

# File contents
manifest_content = """{
  "manifest_version": 3,
  "name": "Easy Scraper V2",
  "version": "2.0.0",
  "description": "A new and improved web scraper with a fresh look.",
  "action": {
    "default_icon": "assets/icon-48.png",
    "default_title": "Easy Scraper V2",
    "default_popup": "popup.html"
  },
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "downloads"
  ],
  "optional_permissions": [
    "tabs"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"]
    }
  ],
  "icons": {
    "16": "assets/icon-16.png",
    "48": "assets/icon-48.png",
    "128": "assets/icon-128.png"
  }
}"""

popup_html_content = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <title>Easy Scraper V2</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', sans-serif;
      }
      .font-inter { font-family: Inter, sans-serif; }
      .min-w-\\[400px\\] { min-width: 400px; }
      .max-w-xl { max-width: 36rem; }
      .min-h-\\[500px\\] { min-height: 500px; }
      .p-6 { padding: 1.5rem; }
      .shadow-2xl { box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25); }
      .bg-\\[\\#f5f8ff\\] { background-color: #f5f8ff; }
      .text-gray-800 { color: #1f2937; }
      .rounded-3xl { border-radius: 1.5rem; }
      .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .duration-300 { transition-duration: 300ms; }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .pb-6 { padding-bottom: 1.5rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .border-b { border-bottom-width: 1px; }
      .border-blue-100 { border-color: #dbeafe; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .font-extrabold { font-weight: 800; }
      .text-pink-600 { color: #db2777; }
      .tracking-tight { letter-spacing: -0.025em; }
      .space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-right: calc(0.5rem * -1); margin-left: calc(0.5rem * 1); }
      .p-2 { padding: 0.5rem; }
      .rounded-full { border-radius: 9999px; }
      .bg-blue-100 { background-color: #dbeafe; }
      .hover\\:text-pink-500:hover { color: #ec4899; }
      .space-x-4 > :not([hidden]) ~ :not([hidden]) { margin-right: calc(1rem * -1); margin-left: calc(1rem * 1); }
      .mb-8 { margin-bottom: 2rem; }
      .justify-center { justify-content: center; }
      .font-semibold { font-weight: 600; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .rounded-full { border-radius: 9999px; }
      .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
      .bg-pink-500 { background-color: #ec4899; }
      .text-white { color: #fff; }
      .hover\\:bg-pink-600:hover { background-color: #db2777; }
      .bg-blue-200 { background-color: #bfdbfe; }
      .text-blue-800 { color: #1e40af; }
      .hover\\:bg-blue-300:hover { background-color: #93c5fd; }
      .ml-2 { margin-left: 0.5rem; }
      .flex-grow { flex-grow: 1; }
      .p-8 { padding: 2rem; }
      .rounded-2xl { border-radius: 1rem; }
      .shadow-xl { box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
      .bg-white { background-color: #fff; }
      .text-2xl { font-size: 1.5rem; line-height: 2rem; }
      .font-bold { font-weight: 700; }
      .mb-4 { margin-bottom: 1rem; }
      .text-blue-700 { color: #1d4ed8; }
      .text-gray-600 { color: #4b5563; }
      .w-full { width: 100%; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .rounded-xl { border-radius: 0.75rem; }
      .mt-6 { margin-top: 1.5rem; }
      .p-4 { padding: 1rem; }
      .bg-blue-50 { background-color: #eff6ff; }
      .font-semibold { font-weight: 600; }
      .hidden { display: none; }
      .w-1\\/2 { width: 50%; }
      .mt-8 { margin-top: 2rem; }
      .text-center { text-align: center; }
      .text-gray-500 { color: #6b7280; }
      .inline-block { display: inline-block; }
      .mr-2 { margin-right: 0.5rem; }
    </style>
    <script defer="defer" src="popup.js"></script>
  </head>
  <body>
    <div class="font-inter min-w-[400px] max-w-xl min-h-[500px] p-6 shadow-2xl bg-[#f5f8ff] text-gray-800 rounded-3xl transition-colors duration-300">
      <!-- Header -->
      <header class="flex items-center justify-between pb-6 mb-6 border-b border-blue-100">
        <h1 class="text-pink-600">Easy Scraper V2</h1>
        <div class="flex items-center space-x-2">
          <button id="settings-btn" class="p-2 rounded-full bg-blue-100 text-pink-600 hover:text-pink-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.39a2 2 0 0 0 .73 2.73l.15.08a2 2 0 0 1 1 1.74v.44a2 2 0 0 1-1 1.73l-.15.08a2 2 0 0 0-.73 2.73l.22.39a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.44a2 2 0 0 1 1-1.73l.15-.08a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button id="dark-mode-btn" class="p-2 rounded-full bg-blue-100 text-pink-600 hover:text-pink-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lightbulb"><path d="M15 14c.2-.5.5-1 .9-1.4A6.1 6.1 0 0 0 16 9c0-5-4-9-9-9S-2 4 1 9a6.1 6.1 0 0 0 1 3.6c.4.4.7.9.9 1.4"/><path d="M8 22s2-3 4-7c.7 4 2 7 4 7"/><path d="M11.66 2.62c2.27 0 4.29 1.47 5.17 3.56a5.53 5.53 0 0 1 0 5.63c-.88 2.09-2.9 3.56-5.17 3.56"/></svg>
          </button>
        </div>
      </header>
      
      <!-- Scraper Type Navigation -->
      <nav class="flex space-x-4 mb-8">
        <button id="list-scraper-btn" class="flex items-center justify-center font-semibold py-3 px-6 rounded-full transition-all duration-300 bg-pink-500 text-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-.5.5-1 .9-1.4A6.1 6.1 0 0 0 16 9c0-5-4-9-9-9S-2 4 1 9a6.1 6.1 0 0 0 1 3.6c.4.4.7.9.9 1.4"/><path d="M8 22s2-3 4-7c.7 4 2 7 4 7"/><path d="M11.66 2.62c2.27 0 4.29 1.47 5.17 3.56a5.53 5.53 0 0 1 0 5.63c-.88 2.09-2.9 3.56-5.17 3.56"/></svg>
          <span class="ml-2">List Scraper</span>
        </button>
        <button id="details-scraper-btn" class="flex items-center justify-center font-semibold py-3 px-6 rounded-full transition-all duration-300 bg-blue-200 text-blue-800 hover:bg-blue-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
          <span class="ml-2">Details Scraper</span>
        </button>
      </nav>
      
      <!-- Main Content Area -->
      <main>
        <div id="list-scraper-view" class="p-8 rounded-2xl shadow-xl bg-white transition-colors duration-300">
          <h2 class="text-blue-700">List Scraper Configuration</h2>
          <p class="text-gray-600 mb-6">
            Configure how you want to scrape a list of items from the current page.
          </p>
          <button id="start-list-scrape-btn" class="w-full btn-primary">
            Start List Scrape
          </button>
          <div class="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl">
            <p class="font-semibold">Status:</p>
            <p id="list-scraper-status">Ready to scrape. Select a list element on the page.</p>
          </div>
          <div id="list-scraper-results" class="mt-4 p-4 bg-blue-50 text-blue-800 rounded-xl hidden">
            <p class="font-semibold">Results:</p>
            <ul id="image-url-list" class="list-disc list-inside mt-2 text-sm max-h-40 overflow-y-scroll"></ul>
          </div>
        </div>
        <div id="details-scraper-view" class="p-8 rounded-2xl shadow-xl bg-white transition-colors duration-300 hidden">
          <h2 class="text-blue-700">Details Scraper Configuration</h2>
          <p class="text-gray-600 mb-6">
            Upload a CSV file with a list of URLs to start a details scrape.
          </p>
          <div class="flex space-x-4">
            <button class="w-1/2 btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              Upload CSV
            </button>
            <button class="w-1/2 btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Download Results
            </button>
          </div>
          <div class="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl">
            <p class="font-semibold">Status:</p>
            <p>No file uploaded. Please upload a CSV to begin.</p>
          </div>
        </div>
      </main>

      <!-- Footer -->
      <footer class="mt-8 text-center text-gray-500">
        <p>© 2024 Easy Scraper. All rights reserved.</p>
      </footer>
    </div>
  </body>
</html>"""

popup_js_content = """// This script handles the simple tab switching and dark mode toggle for the popup UI.

document.addEventListener('DOMContentLoaded', () => {
    const listBtn = document.getElementById('list-scraper-btn');
    const detailsBtn = document.getElementById('details-scraper-btn');
    const listView = document.getElementById('list-scraper-view');
    const detailsView = document.getElementById('details-scraper-view');
    const settingsBtn = document.getElementById('settings-btn');
    const darkModeBtn = document.getElementById('dark-mode-btn');
    const startListScrapeBtn = document.getElementById('start-list-scrape-btn');
    const listScraperStatus = document.getElementById('list-scraper-status');
    const listScraperResults = document.getElementById('list-scraper-results');
    const imageUrlList = document.getElementById('image-url-list');

    const listBtnActiveClasses = ['bg-pink-500', 'text-white', 'shadow-lg'];
    const listBtnInactiveClasses = ['bg-blue-200', 'text-blue-800', 'hover:bg-blue-300'];

    const detailsBtnActiveClasses = ['bg-pink-500', 'text-white', 'shadow-lg'];
    const detailsBtnInactiveClasses = ['bg-blue-200', 'text-blue-800', 'hover:bg-blue-300'];

    listBtn.addEventListener('click', () => {
        // Toggle active/inactive button classes
        listBtn.classList.add(...listBtnActiveClasses);
        listBtn.classList.remove(...listBtnInactiveClasses);
        detailsBtn.classList.add(...detailsBtnInactiveClasses);
        detailsBtn.classList.remove(...detailsBtnActiveClasses);

        // Toggle visibility of the views
        listView.classList.remove('hidden');
        detailsView.classList.add('hidden');
    });

    detailsBtn.addEventListener('click', () => {
        // Toggle active/inactive button classes
        detailsBtn.classList.add(...detailsBtnActiveClasses);
        detailsBtn.classList.remove(...detailsBtnInactiveClasses);
        listBtn.classList.add(...listBtnInactiveClasses);
        listBtn.classList.remove(...listBtnActiveClasses);

        // Toggle visibility of the views
        detailsView.classList.remove('hidden');
        listView.classList.add('hidden');
    });

    settingsBtn.addEventListener('click', () => {
        alert('Settings button clicked!');
        // Here you would implement logic to open a settings view.
    });

    darkModeBtn.addEventListener('click', () => {
        // Toggle dark mode class on the body
        document.body.classList.toggle('dark');
        alert('Dark mode toggle clicked!');
    });

    startListScrapeBtn.addEventListener('click', () => {
        listScraperStatus.textContent = "Scraping images...";
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "startScrape", type: "list"}, function(response) {
                if (response && response.images) {
                    listScraperStatus.textContent = `Found ${response.images.length} images.`;
                    imageUrlList.innerHTML = ''; // Clear previous results
                    response.images.forEach(url => {
                        const li = document.createElement('li');
                        li.textContent = url;
                        imageUrlList.appendChild(li);
                    });
                    listScraperResults.classList.remove('hidden');
                } else {
                    listScraperStatus.textContent = "No images found or an error occurred.";
                    listScraperResults.classList.add('hidden');
                }
            });
        });
    });
});"""

background_js_content = """// A robust background script to manage scraper state, downloads, and communication.
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
});"""

content_script_js_content = """// A robust content script to handle scraping logic, pagination, and lazy loading.

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
});"""


def create_files():
    """Creates the files and directories for the extension project."""
    # Create the main project directory and subdirectories
    pathlib.Path(ASSETS_DIR).mkdir(parents=True, exist_ok=True)
    
    # Create the main files in the root directory
    with open(os.path.join(PROJECT_NAME, "manifest.json"), "w") as f:
        f.write(manifest_content)
        print("Overwrote manifest.json")

    with open(os.path.join(PROJECT_NAME, "popup.html"), "w") as f:
        f.write(popup_html_content)
        print("Overwrote popup.html")
        
    # Create the source files
    with open(os.path.join(PROJECT_NAME, "popup.js"), "w") as f:
        f.write(popup_js_content)
        print("Overwrote popup.js")
        
    with open(os.path.join(PROJECT_NAME, "background.js"), "w") as f:
        f.write(background_js_content)
        print("Overwrote background.js")
        
    with open(os.path.join(PROJECT_NAME, "content-script.js"), "w") as f:
        f.write(content_script_js_content)
        print("Overwrote content-script.js")

    print(f"\nProject created successfully!")
    print("Remember to add your icons to the 'assets' folder.")


if __name__ == "__main__":
    create_files()
