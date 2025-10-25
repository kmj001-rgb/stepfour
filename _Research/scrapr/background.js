let popupWindowId;
let chromeTabId;

chrome.action.onClicked.addListener(function(tab){
    chromeTabId = tab.windowId;
    chrome.windows.create({
        url: "popup.html",
        type: "popup",
        width: 770,
        height: 450,
        focused: false
      }, async (window) => {
        let [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        popupWindowId = window.id;
        chrome.storage.local.set({'curTab': tab.id});
        chrome.storage.local.set({'url': tab.url});
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/content.js']
          });
    
      });
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'saveColumn') {
        const elementInfo = request.elementInfo;
        console.log(elementInfo.column);
        console.log(elementInfo.data);

        chrome.storage.local.set({'columns': elementInfo.column});
        chrome.storage.local.set({'key': elementInfo.data});
    }
    if (request.type === 'focusPopup') {
        if (popupWindowId !== undefined) {
          chrome.windows.update(popupWindowId, { focused: true });
        }
    }
    if (request.type === 'focusChrome') {
        if (chromeTabId !== undefined) {
          chrome.windows.update(chromeTabId, { focused: true });
        }
    }
});