// console.log("content.js mv3");

const scriptFilename = "app.61074c6e.js";
const cssFilename = "app.76341cae.css";

// ----- inject app ------------------------------------------------------------------------

// inject scripts
// function addScriptToPage() {

//     // skip if app already injected
//     let appId = document.getElementById('vue-app-js');
//     if (appId) {
//         // console.log("app already open");
//         return;
//     }

//     let head = document.getElementsByTagName('head')[0];
//     let body = document.getElementsByTagName('body')[0];

//     let div = document.createElement("div");
//     div.id = "app";
//     body.appendChild(div);

//     let js = document.createElement("script");
//     js.src = chrome.runtime.getURL(`js/${scriptFilename}`);
//     js.id = "vue-app-js";
//     body.appendChild(js);

//     let css = document.createElement('link');
//     css.id = "vue-app-css";
//     css.rel = "stylesheet";
//     css.type = "text/css";
//     css.href = chrome.runtime.getURL(`css/${cssFilename}`);
//     head.appendChild(css);
// }

// addScriptToPage();


// new approach - shadow DOM -----------------------------------------------------------------------------------

// add css as usual for now
function addCssToPage() {
    let head = document.getElementsByTagName('head')[0];
    let css = document.createElement('link');
    css.id = "vue-app-css";
    css.rel = "stylesheet";
    css.type = "text/css";
    css.href = chrome.runtime.getURL(`css/${cssFilename}`);
    head.appendChild(css);
}


// Function to fetch and inject CSS into the shadow root
async function injectCSS(shadowRoot, cssURL) {
    try {
        const response = await fetch(cssURL);
        const cssText = await response.text();
        const style = document.createElement('style');
        style.textContent = cssText;
        shadowRoot.appendChild(style);
    } catch (error) {
        console.error('Failed to load CSS:', error);
    }
}

function addScriptToPageNew() {
    
    let appId = document.getElementById('vue-app-js');
    if (appId) {
        return;
    }

    let shadowHost = document.createElement("div");
    shadowHost.id = "simplescraper-shadow-host";
    document.body.appendChild(shadowHost);

    let shadowRoot = shadowHost.attachShadow({mode: 'open'});

    let appContainer = document.createElement('div');
    appContainer.id = 'simplescraper-extension';
    shadowRoot.appendChild(appContainer);

    let js = document.createElement("script");
    js.src = chrome.runtime.getURL(`js/${scriptFilename}`);
    js.id = "vue-app-js";
    document.body.appendChild(js);

    // CSS URL
    const cssURL = chrome.runtime.getURL(`css/${cssFilename}`);
    injectCSS(shadowRoot, cssURL);

    addCssToPage();
}

addScriptToPageNew();

// --------------------------



// ----- events and functions ------------------------------------------------------------------------


// listen for events from injected
function addContentScriptListeners() {
    // console.log("addContentScriptListeners");
    
    window.addEventListener("eventSaveLocalResultsBack", onSaveLocalResultsBack, false); // prop menu -> con* -> back
    window.addEventListener("eventSignup", onSignupRequest, false); // signup -> con* -> back (remove after mv3?)
    window.addEventListener("eventRequestUser", onUserRequest, false); // app -> con* -> back (remove after mv3?)
    window.addEventListener("eventGetRecipes", onGetRecipesEvent, false); // replaced?
    window.addEventListener("eventGetScrapeJobsForRecipeBack", onGetScrapeJobsForRecipeEvent, false);
    window.addEventListener("eventOpenScrapeResultsBack", onOpenScrapeResults, false);
    // window.addEventListener("eventGetTemplates", onGetTemplates, false); // todo
    window.addEventListener("eventCheckOrRequestCookies", onCheckOrRequestCookies, false);

    // document.addEventListener("localStorageSet", onLocalStorageChange, false);
    // window.addEventListener("eventScrapeRequest", onScrapeRequest, false); // replaced
    // window.addEventListener("eventSaveScrapeRecipe", onSaveScrapeRecipe, false); // replaced

    
}
addContentScriptListeners();


function onCheckOrRequestCookies() {
    // console.log("onCheckOrRequestCookies");
    chrome.runtime.sendMessage({ name: "check-or-request-cookies" }, response => {
        window.dispatchEvent(new CustomEvent('eventCookiesCheckedOrRequestedFront', { detail: response }));
    });
}


async function onGetTemplates(msgContent) {
    // console.log("onGetTemplates: ", msgContent);

    let obj = {};
    obj.name = 'get-templates';
    obj.data = msgContent.detail;

    chrome.runtime.sendMessage(obj, function(response) {
        // console.log("onGetTemplates response: ", response);
        window.dispatchEvent(new CustomEvent("eventGetTemplatesFront", { detail: response }));
    });
}


// replaced
// function onScrapeRequest(msgContent) {
//     // console.log("onScrapeRequest: ", msgContent.detail);

//     // pass data to background
//     let obj = {};
//     obj.name = 'scrape-request';
//     obj.data = msgContent.detail;

//     chrome.runtime.sendMessage(obj, function(response) {
//         console.log("onScrapeRequest response: ", response);
//     });
// }

function onSaveScrapeRecipe(msgContent) {
    // console.log("onSaveScrapeRecipe: ", msgContent.detail);

    let obj = {};
    obj.name = 'save-recipe-request';
    obj.data = msgContent.detail;

    chrome.runtime.sendMessage(obj, function(response) {
        // console.log("onSaveScrapeRecipe response: ", response);
        window.dispatchEvent(new CustomEvent("eventRecipeSaved", { detail: response }));
    });
}


function onSignupRequest(msgContent) {
    // console.log("onSignupRequest: ", msgContent.detail);

    let obj = {};
    obj.name = 'signup-request';

    chrome.runtime.sendMessage(obj, function(response) {
        console.log("onSignupRequest response: ", response);
    });
}


async function onUserRequest(msgContent) {
    // console.log("onUserRequest: ", msgContent);

    let obj = {};
    obj.name = 'user-request';

    chrome.runtime.sendMessage(obj, function(response) {
        // console.log("onUserRequest response: ", response);
        window.dispatchEvent(new CustomEvent("eventUserFront", { detail: response }));
    });
}


async function onGetRecipesEvent(msgContent) {
    // console.log("onGetRecipesEvent: ", msgContent);

    let obj = {};
    obj.name = 'get-recipes-event';

    chrome.runtime.sendMessage(obj, function(response) {
        // console.log("onGetRecipesEvent response: ", response);
        window.dispatchEvent(new CustomEvent("eventGetRecipesFront", { detail: response }));
    });
}


async function onGetScrapeJobsForRecipeEvent(msgContent) {
    // console.log("onGetScrapeJobsForRecipeEvent: ", msgContent);

    let obj = {};
    obj.name = 'get-scrape-jobs-event';

    chrome.runtime.sendMessage(obj, function(response) {
        // console.log("onGetRecipesEvent response: ", response);
        window.dispatchEvent(new CustomEvent("eventGetScrapeJobsForRecipeFront", { detail: response }));
    });
}


async function onOpenScrapeResults(msgContent) {
    // console.log("onOpenScrapeResults: ", msgContent);

    let obj = {};
    obj.name = 'open-scrape-results-page';

    chrome.runtime.sendMessage(obj, function(response) {
        // console.log("onOpenScrapeResults response: ", response);
        window.dispatchEvent(new CustomEvent("eventOnOpenScrapeResultsFront", { detail: response }));
    });
}


function onSaveLocalResultsBack(msgContent) {
    // console.log("onSaveLocalResultsBack: ", msgContent.detail);

    // send data to background
    let obj = {};
    obj.name = 'save-local-results';
    obj.data = msgContent.detail;

    chrome.runtime.sendMessage(obj, function(response) {
        // wait for response
        // console.log("onSaveLocalResultsBack response: ", response);
    });
}



// ----- temp visual indicator ----------------------------------------------------------------

function fitExtension() {

    document.body.style.marginTop = "70px";
  
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.position === 'fixed') {
        const originalTop = parseInt(computedStyle.top, 10);
        if (!isNaN(originalTop)) {
          element.style.top = `${originalTop + 70}px`;
        } else { 
          element.style.top = '70px';
        }
      }
    });
  }
  
  fitExtension();


// ---------- meh ------------------------------------------------------------------------------------------------

// listen for messages from background
// chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
//     console.log('message in content script: ', message);
//     // if (message.ping) { sendResponse({ pong: true }); return; }
// });

// send messages to background
// function sendMessageToBackground(theData) {
//     console.log("sendMessageToBackground: ", theData);
//     chrome.runtime.sendMessage({
//         name: theData.name,
//         data: theData.data
//     }, function(response) {
//         // wait for response
//         console.log("sendMessageToBackground response: ", response);
//     });
// }

// alternative approach:
// document.querySelector("head").insertAdjacentHTML(
//     "beforeend",
//     `<link href=${chrome.runtime.getURL(
//         "css/app.css"
//       )} rel="stylesheet" />`
// );



// fetch extension html page. Not used, for reference
// async function getHTML() {
//     try {
//         let awaitURL = await fetch(chrome.runtime.getURL("index.html"));
//         let pageData = await awaitURL.text();
//         console.log("pageData ", pageData);
//         console.log("response ", awaitURL);
//     } catch {
//         console.log("getHTML error");
//     }
// }