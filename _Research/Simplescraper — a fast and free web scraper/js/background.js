// mv3

// firebase not used in background script - revisit if needed (for loading existing recipes etc)
// initiate firebase
// let firebaseApp;
// let firestore;

// try {
//   importScripts(
//     'firebase/6.6.0/firebase-app.js',
//     'firebase/6.6.0/firebase-auth.js',
//     'firebase/6.6.0/firebase-firestore.js',
//     'firebase/6.6.0/firebase-functions.js'
//   );

//   const firebaseConfig = {
//       apiKey: "AIzaSyAhP8Yhe4pu4ehTbRYmvMmGMEBZKkoHcEc",
//       authDomain: "easy-scraper.firebaseapp.com",
//       databaseURL: "https://easy-scraper.firebaseio.com",
//       projectId: "easy-scraper",
//       storageBucket: "easy-scraper.appspot.com",
//       messagingSenderId: "418041239623",
//       appId: "1:418041239623:web:41c063fb887ec3d1613962"
//   };

//   firebaseApp = firebase.initializeApp(firebaseConfig);
//   firestore = firebaseApp.firestore();

//   console.log('imported scripts');

// } catch (error) {
//   console.error('Error importing scripts:', error);
// }





// ----- catch one time messages from content -----------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log(message.name);
    if (message.name === "save-local-results") { // save session to local storage

        // console.log('save-local-results: ', message.data);
        console.log('save-local-results:');
        let storageName = message.data.host;

        chrome.storage.local.set({
            'local-results': message.data
        }, function() {
            console.log('local results saved');
            sendResponse({ data: "success" });
        });

        return true; // indicate async response. https://developer.chrome.com/extensions/runtime#event-onMessage

    } else if (message.name === "get-templates") { // scrape remotely
        getTemplates(message.data).then(sendResponse); // call cloud function
        return true;
    } else if (message.name === "scrape-request") { // scrape remotely
        // not used
        // let scrapeConfig = message.data;
        // // console.log(JSON.stringify(scrapeConfig));
        // fsCallScrapeURL(scrapeConfig).then(sendResponse); // call cloud function
        return true;
    } else if (message.name === "signup-request") { // signup user

        userSignUp().then(sendResponse);
        return true;

    } else if (message.name === "user-request") {
        fnGetLoginStatus().then(sendResponse);
        // sendResponse("hello");
        return true;

    } else if (message.name === "save-recipe-request") {

        fsSaveRecipe(message.data).then(sendResponse);
        return true;
    } else if (message.name === "get-recipes-event") {

        fsGetRecipes(message.data).then(sendResponse);
        return true;
    } else if (message.name === "get-scrape-jobs-event") {

        fsGetScrapeJobs(message.data).then(sendResponse);
        return true;

    } else if (message.name === "open-scraper") {


        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length > 0) {
                var currentTab = tabs[0];
                console.log("currentTab: ", currentTab);
                chrome.scripting.executeScript({
                    target: {tabId: currentTab.id},
                    files: ["js/content.js"]
                });
            } else {
                console.log("active tab not found - huh?!");
            }
        });


    } else if (message.name === "open-scrape-results-page") {
        // open page - called from injected property selected menu
        chrome.tabs.create({ url: chrome.runtime.getURL("index.html?results=1") });
        sendResponse({ data: "success" });

    } else if (message.name === "open-extension-page") {
        // open page - called from popup
        chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
        sendResponse({ data: "success" });

    } else if (message.name === "get-local-results") {
        // get results - called from extension page (mv2 compatible)
        chrome.storage.local.get('local-results', function(results) {
            console.log('got local results ', results);
            sendResponse(results);
        });
        return true;
    } else if (message.name === "check-or-request-cookies") {
        console.log("check-or-request-cookies");
        chrome.permissions.contains({
            permissions: ['cookies'],
            origins: ['http://*/*','https://*/*']
        }, result => {
            if (result) {
                // Permissions already granted
                console.log("Permissions already granted");
                getCookies().then(cookies => sendResponse({ granted: true, cookies }));
            } else {
                // Request permissions
                console.log("Request permissions");
                chrome.permissions.request({
                    permissions: ['cookies'],
                    origins: ['http://*/*','https://*/*']
                }, granted => {
                    if (granted) {
                        getCookies().then(cookies => sendResponse({ granted: true, cookies }));
                    } else {
                        sendResponse({ granted: false });
                    }
                });
            }
        });
        return true; // Keep the message channel open for the async response
    }

    // if (message.name === "getLocalStorage") {
    //     const fieldName = chrome.storage.local.get(message.data);
    //     sendResponse({ data: localStorage[message.data.key] });
    // }


    // if (message.name === "download-json") {
    //     let blob = new Blob([message.data], { type: "application/json" });
    //     let url = URL.createObjectURL(blob);
    //     chrome.downloads.download({
    //         url: url,
    //         filename: `${message.filename || "easyscraper"}.json`
    //     });
    // }
});


chrome.runtime.onMessageExternal.addListener(function(message, sender, sendResponse) {
    if (message.name === "get-local-results") {
        // get results - called from web app
        chrome.storage.local.get('local-results', function(results) {
            console.log('got local results mv3: ', results);
            sendResponse(results);
        });
        return true;
    }
});




// ----- functions ------------------------------------------------------------------------------------------

async function userSignUp() {

    // firebase not currently used
    return "firebase not used";

    // let provider = new firebase.auth.GoogleAuthProvider();

    // try {
    //     let result = await firebase.auth().signInWithPopup(provider);
    //     // console.log("result: ", result);

    //     let user = result.user;
    //     await fsSaveUser(user);
    //     // console.log("result 2");
    //     return true;
    // } catch (err) {
    //     console.log("err ", err);
    //     return err;
    // }

}


async function fsSaveUser(user) {
    // console.log("fsSaveUser ", user);

    // firebase not currently used
    return "firebase not used - fsSaveUser";

    // let { uid, displayName, photoURL, email } = user;
    // let userObj = { uid, displayName, photoURL, email };

    // let call = firebase.functions().httpsCallable('onSaveUser');
    // try {
    //     let saveUser = await call(userObj);
    //     console.log("saveUser: ", saveUser);
    //     return true;
    // } catch (err) {
    //     console.log("err ", err);
    //     return err;
    // }

}


async function getTemplates(data) {
    // console.log("getTemplates ", data);
    // firebase not currently used
    return "firebase not used - getTemplates";
    // try {
    //     let call = firebase.functions().httpsCallable('getTemplatesForHost');
    //     let templates = await call(data);
    //     // console.log("getTemplates response: ", templates.data);
    //     return templates.data;
    // } catch (err) {
    //     console.log("getTemplates err ", err);
    //     return err;
    // }
}



async function fsGetRecipes(data) {
    // console.log("fsGetRecipes ", data);
    // firebase not currently used
    return "firebase not used - fsGetRecipes";

    // let call = firebase.functions().httpsCallable('onGetRecipes');

    // try {
    //     let recipes = await call(data);
    //     // console.log("fsGetRecipes: ", recipes.data);
    //     return recipes.data;
    // } catch (err) {
    //     console.log("err ", err);
    //     return err;
    // }
}


async function fsSaveRecipe(recipe) {
    // console.log("fsSaveRecipe ", recipe);
    // firebase not currently used
    return "firebase not used - fsSaveRecipe";
    // let call = firebase.functions().httpsCallable('onSaveRecipe');
    // try {
    //     await call(recipe);
    //     console.log("recipe saved");
    //     return true;
    // } catch (err) {
    //     console.log("err ", err);
    //     return err;
    // }

}

// not used - handled in app
// async function fsCallScrapeURL(scrapeConfig) {

//     let call = firebaseApp.functions().httpsCallable('scrapeURL');

//     try {
//         let scrapeResponse = await call(scrapeConfig);
//         // console.log("fsCallScrapeURL: ", scrapeResponse.data);
//         return scrapeResponse.data;
//     } catch (err) {
//         console.log("err: ", err);
//         return err;
//     }

// }


async function fsGetUser(uid) {
    // console.log("fsGetUser ", uid);
    // firebase not currently used
    return "firebase not used - fsGetUser";
    // let call = firebase.functions().httpsCallable('onGetUser');
    // try {
    //     let userProfile = await call(uid);
    //     // console.log("fsGetUser userProfile: ", userProfile.data);
    //     return userProfile.data;
    // } catch (err) {
    //     console.log("err ", err);
    //     return err;
    // }

}


async function fnGetLoginStatus() {
    // console.log("fnGetLoginStatus: ", firebase.auth().currentUser);
    // firebase not currently used
    return "firebase not used - fnGetLoginStatus";

    // let currentUser = firebase.auth().currentUser;

    // // if logged in, return profile, else return null
    // if (currentUser) {
    //     return await fsGetUser(currentUser.uid);
    // } else {
    //     return null;
    // }
}


async function fsGetScrapeJobs(data) {
    // console.log("fsGetScrapeJobs ", data);

    // firebase not currently used
    return "firebase not used - fsGetScrapeJobs";


    // let call = firebase.functions().httpsCallable('onGetScrapeJobs');

    // try {
    //     let scrapejobs = await call(data);
    //     console.log("scrapejobs: ", scrapejobs.data);
    //     return scrapejobs;
    // } catch (err) {
    //     console.log("fsGetScrapeJobs err ", err);
    //     return err;
    // }
}




async function getCookies() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs.length > 0) {
                const url = tabs[0].url;
                console.log(`URL: ${url}`);
                chrome.cookies.getAll({ url }, cookies => {
                    if (cookies) {
                        // console.log('Cookies retrieved:', cookies);
                        const filteredCookies = cookies.filter(cookie => !cookiesExclude(cookie));
                        // console.log('Filtered cookies:', filteredCookies);
                        resolve(filteredCookies);
                    } else {
                        console.error('No cookies found');
                        reject('No cookies found');
                    }
                });
            } else {
                reject('No active tabs found');
            }
        });
    });
}

function cookiesExclude(cookie) {
    const non = ['_ga', '_gid', '_gat', 'utm_source'];
    return non.includes(cookie.name);
}



// show onboarding
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason == "install") {
        // console.log("first install!");
        if (!window.localStorage.getItem('onboardingViewed')) {
            window.localStorage.setItem('onboardingViewed', 1);
            chrome.tabs.create({
                url: 'https://simplescraper.io/docs/how-scrape-save-recipes/?source=install'
            });
        }
    } else if (details.reason == "update") {
        // var thisVersion = chrome.runtime.getManifest().version;
        // console.log("Updated from " + details.previousVersion + " to " + thisVersion);
    }
});





// ----- meh -------------------------------------------------------------------------------------

// not used - auth to be pull instead of push
// function initAuthWatch() {
//     // Listen for auth state changes.
//     firebase.auth().onAuthStateChanged(function(user) {
//         console.log('User state change:', user);
//         let obj = {};
//         obj.name = "user-status";
//         obj.user = user;
//         // fnSendMessageToContent(obj);
//     });

// }

// window.onload = function() {
//     initAuthWatch();
// };

// send message to content script
// function fnSendMessageToContent(message) {
//     console.log("fnSendMessageToContent");
//     chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
//         chrome.tabs.sendMessage(tabs[0].id, message, function(response) {

//         });
//     });
// }



// run content script when extension button clicked - replaced with popup menu
// chrome.browserAction.onClicked.addListener(tab => {
//     chrome.tabs.executeScript(null, { file: "content.js" });

//     // open in new tab
//     chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
// });


// listen to messages from content script port - used?
// chrome.runtime.onConnect.addListener(function(port) {
//     port.onMessage.addListener(function(msg) {
//         console.log("message recieved: " + msg);
//         // send message to popup
//         port.postMessage("Hi vue!");
//     });
// });