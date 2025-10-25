document.addEventListener('DOMContentLoaded', function() {
	document.getElementById("open-scraper").addEventListener("click", onOpenScraper);
    // document.getElementById("open-extension-page").addEventListener("click", onOpenExtensionPage);
});


function onOpenScraper(msgContent) {
    console.log("onOpenScraper");

    let obj = {};
    obj.name = 'open-scraper';

    chrome.runtime.sendMessage(obj, function(response) {
        console.log("onOpenScraper response: ", response);
    });
}

// function onOpenExtensionPage(msgContent) {
//     console.log("onOpenExtensionPage");

//     let obj = {};
//     obj.name = 'open-extension-page';

//     chrome.runtime.sendMessage(obj, function(response) {
//         console.log("onOpenExtensionPage response: ", response);
//     });
// }