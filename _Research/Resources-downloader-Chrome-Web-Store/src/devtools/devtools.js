"use strict";

let isCreated = false;

chrome.runtime.onMessage.addListener((message) => {
  if (message.download) {
    if (chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({ url: message.download });
    }
  }
});

// Create Devtools Panel
chrome.devtools.panels.create(
  "Resources",
  "icons/icon16.png",
  "src/panel/panel.html",
  (panel) =>
    panel.onShown.addListener((panelWindow) => {
      chrome.devtools.network.onRequestFinished.addListener((request) =>
        panelWindow.updatePanel(request)
      );
      if (isCreated) return;
      isCreated = true;
      chrome.devtools.inspectedWindow.reload({ ignoreCache: false });
    })
);
