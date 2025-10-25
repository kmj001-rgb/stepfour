// This script handles the simple tab switching and dark mode toggle for the popup UI.

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
});