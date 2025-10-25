chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["bookmarklet.js"],
  });
});

// chrome.runtime.onInstalled.addListener(details => {
//    if(details.reason == "install"){
// 		 chrome.tabs.create({url: "https://agenty.com/docs/videos"});
//    }
// });

chrome.identity.onSignInChanged.addListener(function (account_id, signedIn) {
  if (signedIn) {
    user_signed_in = true;
  } else {
    user_signed_in = false;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "oauthGoogle") {
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
      const fetchOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: `Bearer: ${token}`,
        }),
      };

      fetch(`https://api.agenty.com/v2/auth/google`, fetchOptions)
        .then((res) => res.json())
        .then((res) => {
          chrome.runtime.sendMessage({ message: "login", data: res });
        });
    });
  }
});
