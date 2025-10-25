chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
      chrome.storage.sync.set({ 
        'ordered': '',
        'unordered': '',
        'apikey': '',
        'impdt':'',
        'usage_count': 0,
        }, function() {
      });
    }
    if (details.reason === "update") {
      chrome.storage.sync.set({ 
        'ordered': '',
        'unordered': '',
        }, function() {
      });
    }
})

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {

  if (request.action === "to-background") {
    //console.log('from-popup');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;
      
      // Send the message to the content script in the active tab
      chrome.tabs.sendMessage(tabId, { action: "to-content" }, (response) => {
        if (chrome.runtime.lastError) {
          //console.error("Failed to send message to content script:", chrome.runtime.lastError);
        } else {
          //console.log("Response from content script:", response);
          //console.log(response.ordered);
          //console.log(response.unordered);

          chrome.storage.sync.set({ 
            'ordered': response.ordered,
            'unordered': response.unordered,
            }, function() {
          });

        }
      });
    });
  }
  return true;
});