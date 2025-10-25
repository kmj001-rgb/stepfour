// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.set({
    defaultFolder: 'images',
    autoDownload: false,
    minSize: 0,
    minWidth: 0,
    minHeight: 0,
    fileTypes: ['jpg', 'png', 'gif', 'webp']
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    switch (command) {
      case 'scan-page':
        // Send message to content script to scan images
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getImages' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError);
            return;
          }
          // Store the images in storage for later use
          if (response && response.images) {
            chrome.storage.local.set({ currentPageImages: response.images });
          }
        });
        break;

      case 'download-selected':
        // Get selected images from storage and download them
        chrome.storage.local.get(['currentPageImages', 'selectedImages'], (data) => {
          if (data.currentPageImages && data.selectedImages) {
            const selectedUrls = Array.from(data.selectedImages)
              .map(index => data.currentPageImages[index].src);
            
            selectedUrls.forEach(url => {
              chrome.downloads.download({
                url: url,
                saveAs: false
              });
            });
          }
        });
        break;
    }
  });
}); 