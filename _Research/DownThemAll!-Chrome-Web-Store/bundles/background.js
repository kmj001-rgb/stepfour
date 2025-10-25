/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./lib/background.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
// License: MIT
const constants_1 = __webpack_require__("./lib/constants.ts");
const api_1 = __webpack_require__("./lib/api.ts");
const item_1 = __webpack_require__("./lib/item.ts");
const prefs_1 = __webpack_require__("./lib/prefs.ts");
const i18n_1 = __webpack_require__("./lib/i18n.ts");
const windowutils_1 = __webpack_require__("./lib/windowutils.ts");
const filters_1 = __webpack_require__("./lib/filters.ts");
const man_1 = __webpack_require__("./lib/manager/man.ts");
const browser_1 = __webpack_require__("./lib/browser.ts");
const bus_1 = __webpack_require__("./lib/bus.ts");
const util_1 = __webpack_require__("./lib/util.ts");
const db_1 = __webpack_require__("./lib/db.ts");
const menus = typeof (browser_1.menus) !== "undefined" && browser_1.menus || browser_1.contextMenus;
const GATHER = "/bundles/content-gather.js";
const CHROME_CONTEXTS = Object.freeze(new Set([
    "all",
    "audio",
    "browser_action",
    "editable",
    "frame",
    "image",
    "launcher",
    "link",
    "page",
    "page_action",
    "selection",
    "video",
]));
async function runContentJob(tab, file, msg) {
    try {
        if (tab && tab.incognito && msg) {
            msg.private = tab.incognito;
        }
        const res = await browser_1.tabs.executeScript(tab.id, {
            file,
            allFrames: true,
            runAt: "document_start"
        });
        if (!msg) {
            return res;
        }
        const promises = [];
        const results = [];
        for (const frame of await browser_1.webNavigation.getAllFrames({ tabId: tab.id })) {
            promises.push(browser_1.tabs.sendMessage(tab.id, msg, {
                frameId: frame.frameId
            }).then(function (res) {
                results.push(res);
            }).catch(console.error));
        }
        await Promise.all(promises);
        return results;
    }
    catch (ex) {
        console.error("Failed to execute content script", file, ex.message || ex.toString(), ex);
        return [];
    }
}
class Handler {
    async processResults(turbo = false, results) {
        const links = this.makeUnique(results, "links");
        const media = this.makeUnique(results, "media");
        await api_1.API[turbo ? "turbo" : "regular"](links, media);
    }
    makeUnique(results, what) {
        return item_1.makeUniqueItems(results.filter(e => e[what]).map(e => {
            const finisher = new item_1.Finisher(e);
            return util_1.filterInSitu(e[what].
                map((item) => finisher.finish(item)), e => !!e);
        }));
    }
    async performSelection(options) {
        try {
            const tabOptions = {
                currentWindow: true,
                discarded: false,
            };
            if (!browser_1.CHROME) {
                tabOptions.hidden = false;
            }
            const selectedTabs = options.allTabs ?
                await browser_1.tabs.query(tabOptions) :
                [options.tab];
            const textLinks = await prefs_1.Prefs.get("text-links", true);
            const gatherOptions = {
                type: "DTA:gather",
                selectionOnly: options.selectionOnly,
                textLinks,
                schemes: Array.from(constants_1.ALLOWED_SCHEMES.values()),
                transferable: constants_1.TRANSFERABLE_PROPERTIES,
            };
            const results = await Promise.all(selectedTabs.
                map((tab) => runContentJob(tab, GATHER, gatherOptions)));
            await this.processResults(options.turbo, results.flat());
        }
        catch (ex) {
            console.error(ex.toString(), ex.stack, ex);
        }
    }
}
function getMajor(version) {
    if (!version) {
        return "";
    }
    const match = version.match(/^\d+\.\d+/);
    if (!match) {
        return "";
    }
    return match[0];
}
browser_1.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
    const { version } = browser_1.runtime.getManifest();
    const major = getMajor(version);
    const prevMajor = getMajor(previousVersion);
    if (reason === "update" && major !== prevMajor) {
        browser_1.tabs.create({
            url: `https://about.downthemall.org/changelog/?cur=${major}&prev=${prevMajor}`,
        });
    }
    else if (reason === "install") {
        browser_1.tabs.create({
            url: `https://about.downthemall.org/4.0/?cur=${major}`,
        });
    }
});
i18n_1.locale.then(() => {
    const menuHandler = new class Menus extends Handler {
        constructor() {
            super();
            this.onClicked = this.onClicked.bind(this);
            const alls = new Map();
            const menuCreate = (options) => {
                if (browser_1.CHROME) {
                    delete options.icons;
                    options.contexts = options.contexts.
                        filter((e) => CHROME_CONTEXTS.has(e));
                    if (!options.contexts.length) {
                        return;
                    }
                }
                if (options.contexts.includes("all")) {
                    alls.set(options.id, options.contexts);
                }
                menus.create(options);
            };
            menuCreate({
                id: "DTARegularLink",
                contexts: ["link"],
                icons: {
                    16: "/style/button-regular.png",
                    32: "/style/button-regular@2x.png",
                },
                title: i18n_1._("dta.regular.link"),
            });
            menuCreate({
                id: "DTATurboLink",
                contexts: ["link"],
                icons: {
                    16: "/style/button-turbo.png",
                    32: "/style/button-turbo@2x.png",
                },
                title: i18n_1._("dta.turbo.link"),
            });
            menuCreate({
                id: "DTARegularImage",
                contexts: ["image"],
                icons: {
                    16: "/style/button-regular.png",
                    32: "/style/button-regular@2x.png",
                },
                title: i18n_1._("dta.regular.image"),
            });
            menuCreate({
                id: "DTATurboImage",
                contexts: ["image"],
                icons: {
                    16: "/style/button-turbo.png",
                    32: "/style/button-turbo@2x.png",
                },
                title: i18n_1._("dta.turbo.image"),
            });
            menuCreate({
                id: "DTARegularMedia",
                contexts: ["video", "audio"],
                icons: {
                    16: "/style/button-regular.png",
                    32: "/style/button-regular@2x.png",
                },
                title: i18n_1._("dta.regular.media"),
            });
            menuCreate({
                id: "DTATurboMedia",
                contexts: ["video", "audio"],
                icons: {
                    16: "/style/button-turbo.png",
                    32: "/style/button-turbo@2x.png",
                },
                title: i18n_1._("dta.turbo.media"),
            });
            menuCreate({
                id: "DTARegularSelection",
                contexts: ["selection"],
                icons: {
                    16: "/style/button-regular.png",
                    32: "/style/button-regular@2x.png",
                },
                title: i18n_1._("dta.regular.selection"),
            });
            menuCreate({
                id: "DTATurboSelection",
                contexts: ["selection"],
                icons: {
                    16: "/style/button-turbo.png",
                    32: "/style/button-turbo@2x.png",
                },
                title: i18n_1._("dta.turbo.selection"),
            });
            menuCreate({
                id: "DTARegular",
                contexts: ["all", "browser_action", "tools_menu"],
                icons: {
                    16: "/style/button-regular.png",
                    32: "/style/button-regular@2x.png",
                },
                title: i18n_1._("dta.regular"),
            });
            menuCreate({
                id: "DTATurbo",
                contexts: ["all", "browser_action", "tools_menu"],
                icons: {
                    16: "/style/button-turbo.png",
                    32: "/style/button-turbo@2x.png",
                },
                title: i18n_1._("dta.turbo"),
            });
            menuCreate({
                id: "sep-1",
                contexts: ["all", "browser_action", "tools_menu"],
                type: "separator"
            });
            menuCreate({
                id: "DTARegularAll",
                contexts: ["all", "browser_action", "tools_menu"],
                icons: {
                    16: "/style/button-regular.png",
                    32: "/style/button-regular@2x.png",
                },
                title: i18n_1._("dta-regular-all"),
            });
            menuCreate({
                id: "DTATurboAll",
                contexts: ["all", "browser_action", "tools_menu"],
                icons: {
                    16: "/style/button-turbo.png",
                    32: "/style/button-turbo@2x.png",
                },
                title: i18n_1._("dta-turbo-all"),
            });
            const sep2ctx = menus.ACTION_MENU_TOP_LEVEL_LIMIT === 6 ?
                ["all", "tools_menu"] :
                ["all", "browser_action", "tools_menu"];
            menuCreate({
                id: "sep-2",
                contexts: sep2ctx,
                type: "separator"
            });
            menuCreate({
                id: "DTAAdd",
                contexts: ["all", "browser_action", "tools_menu"],
                icons: {
                    16: "/style/add.svg",
                    32: "/style/add.svg",
                    64: "/style/add.svg",
                    128: "/style/add.svg",
                },
                title: i18n_1._("add-download"),
            });
            menuCreate({
                id: "sep-3",
                contexts: ["all", "browser_action", "tools_menu"],
                type: "separator"
            });
            menuCreate({
                id: "DTAManager",
                contexts: ["all", "browser_action", "tools_menu"],
                icons: {
                    16: "/style/button-manager.png",
                    32: "/style/button-manager@2x.png",
                },
                title: i18n_1._("manager.short"),
            });
            menuCreate({
                id: "DTAPrefs",
                contexts: ["all", "browser_action", "tools_menu"],
                icons: {
                    16: "/style/settings.svg",
                    32: "/style/settings.svg",
                    64: "/style/settings.svg",
                    128: "/style/settings.svg",
                },
                title: i18n_1._("prefs.short"),
            });
            Object.freeze(alls);
            const adjustMenus = (v) => {
                for (const [id, contexts] of alls.entries()) {
                    const adjusted = v ?
                        contexts.filter(e => e !== "all") :
                        contexts;
                    menus.update(id, {
                        contexts: adjusted
                    });
                }
            };
            prefs_1.Prefs.get("hide-context", false).then((v) => {
                // This is the initial load, so no need to adjust when visible already
                if (!v) {
                    return;
                }
                adjustMenus(v);
            });
            prefs_1.Prefs.on("hide-context", (prefs, key, value) => {
                adjustMenus(value);
            });
            menus.onClicked.addListener(this.onClicked);
        }
        *makeSingleItemList(url, results) {
            for (const result of results) {
                const finisher = new item_1.Finisher(result);
                for (const list of [result.links, result.media]) {
                    for (const e of list) {
                        if (e.url !== url) {
                            continue;
                        }
                        const finished = finisher.finish(e);
                        if (!finished) {
                            continue;
                        }
                        yield finished;
                    }
                }
            }
        }
        async findSingleItem(tab, url, turbo = false) {
            if (!url) {
                return;
            }
            const results = await runContentJob(tab, "/bundles/content-gather.js", {
                type: "DTA:gather",
                selectionOnly: false,
                schemes: Array.from(constants_1.ALLOWED_SCHEMES.values()),
                transferable: constants_1.TRANSFERABLE_PROPERTIES,
            });
            const found = Array.from(this.makeSingleItemList(url, results));
            const unique = item_1.makeUniqueItems([found]);
            if (!unique.length) {
                return;
            }
            const [item] = unique;
            api_1.API[turbo ? "singleTurbo" : "singleRegular"](item);
        }
        onClicked(info, tab) {
            if (!tab.id) {
                return;
            }
            const { menuItemId } = info;
            const { [`onClicked${menuItemId}`]: handler } = this;
            if (!handler) {
                console.error("Invalid Handler for", menuItemId);
                return;
            }
            const rv = handler.call(this, info, tab);
            if (rv && rv.catch) {
                rv.catch(console.error);
            }
        }
        async emulate(action) {
            const tab = await browser_1.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (!tab || !tab.length) {
                return;
            }
            this.onClicked({
                menuItemId: action
            }, tab[0]);
        }
        async onClickedDTARegular(info, tab) {
            return await this.performSelection({
                selectionOnly: false,
                allTabs: false,
                turbo: false,
                tab,
            });
        }
        async onClickedDTARegularAll(info, tab) {
            return await this.performSelection({
                selectionOnly: false,
                allTabs: true,
                turbo: false,
                tab,
            });
        }
        async onClickedDTARegularSelection(info, tab) {
            return await this.performSelection({
                selectionOnly: true,
                allTabs: false,
                turbo: false,
                tab,
            });
        }
        async onClickedDTATurbo(info, tab) {
            return await this.performSelection({
                selectionOnly: false,
                allTabs: false,
                turbo: true,
                tab,
            });
        }
        async onClickedDTATurboAll(info, tab) {
            return await this.performSelection({
                selectionOnly: false,
                allTabs: true,
                turbo: true,
                tab,
            });
        }
        async onClickedDTATurboSelection(info, tab) {
            return await this.performSelection({
                selectionOnly: true,
                allTabs: false,
                turbo: true,
                tab,
            });
        }
        async onClickedDTARegularLink(info, tab) {
            if (!info.linkUrl) {
                return;
            }
            await this.findSingleItem(tab, info.linkUrl, false);
        }
        async onClickedDTATurboLink(info, tab) {
            if (!info.linkUrl) {
                return;
            }
            await this.findSingleItem(tab, info.linkUrl, true);
        }
        async onClickedDTARegularImage(info, tab) {
            if (!info.srcUrl) {
                return;
            }
            await this.findSingleItem(tab, info.srcUrl, false);
        }
        async onClickedDTATurboImage(info, tab) {
            if (!info.srcUrl) {
                return;
            }
            await this.findSingleItem(tab, info.srcUrl, true);
        }
        async onClickedDTARegularMedia(info, tab) {
            if (!info.srcUrl) {
                return;
            }
            await this.findSingleItem(tab, info.srcUrl, false);
        }
        async onClickedDTATurboMedia(info, tab) {
            if (!info.srcUrl) {
                return;
            }
            await this.findSingleItem(tab, info.srcUrl, true);
        }
        onClickedDTAAdd() {
            api_1.API.singleRegular(null);
        }
        async onClickedDTAManager() {
            await windowutils_1.openManager();
        }
        async onClickedDTAPrefs() {
            await windowutils_1.openPrefs();
        }
    }();
    new class Action extends Handler {
        constructor() {
            super();
            this.onClicked = this.onClicked.bind(this);
            browser_1.browserAction.onClicked.addListener(this.onClicked);
            prefs_1.Prefs.get("button-type", false).then(v => this.adjust(v));
            prefs_1.Prefs.on("button-type", (prefs, key, value) => {
                this.adjust(value);
            });
        }
        adjust(type) {
            browser_1.browserAction.setPopup({
                popup: type !== "popup" ? "" : "/windows/popup.html"
            });
            let icons;
            switch (type) {
                case "popup":
                    icons = {
                        16: "/style/icon16.png",
                        32: "/style/icon32.png",
                        48: "/style/icon48.png",
                        64: "/style/icon64.png",
                        128: "/style/icon128.png",
                        256: "/style/icon256.png"
                    };
                    break;
                case "dta":
                    icons = {
                        16: "/style/button-regular.png",
                        32: "/style/button-regular@2x.png",
                    };
                    break;
                case "turbo":
                    icons = {
                        16: "/style/button-turbo.png",
                        32: "/style/button-turbo@2x.png",
                    };
                    break;
                case "manager":
                    icons = {
                        16: "/style/button-manager.png",
                        32: "/style/button-manager@2x.png",
                    };
                    break;
            }
            browser_1.browserAction.setIcon({ path: icons });
        }
        async onClicked() {
            switch (await prefs_1.Prefs.get("button-type")) {
                case "popup":
                    break;
                case "dta":
                    menuHandler.emulate("DTARegular");
                    break;
                case "turbo":
                    menuHandler.emulate("DTATurbo");
                    break;
                case "manager":
                    menuHandler.emulate("DTAManager");
                    break;
            }
        }
    }();
    bus_1.Bus.on("do-regular", () => menuHandler.emulate("DTARegular"));
    bus_1.Bus.on("do-regular-all", () => menuHandler.emulate("DTARegularAll"));
    bus_1.Bus.on("do-turbo", () => menuHandler.emulate("DTATurbo"));
    bus_1.Bus.on("do-turbo-all", () => menuHandler.emulate("DTATurboAll"));
    bus_1.Bus.on("do-single", () => api_1.API.singleRegular(null));
    bus_1.Bus.on("open-manager", () => windowutils_1.openManager(true));
    bus_1.Bus.on("open-prefs", () => windowutils_1.openPrefs());
    (async function init() {
        const urlBase = browser_1.runtime.getURL("");
        try {
            browser_1.history.onVisited.addListener(({ url }) => {
                if (!url || !url.startsWith(urlBase)) {
                    return;
                }
                browser_1.history.deleteUrl({ url });
            });
            const results = await browser_1.history.search({ text: urlBase });
            for (const { url } of results) {
                if (!url) {
                    continue;
                }
                browser_1.history.deleteUrl({ url });
            }
        }
        catch (ex) {
            console.error("Failed to clean history", ex);
        }
        if (!browser_1.CHROME) {
            try {
                const sessionRemover = async () => {
                    for (const s of await browser_1.sessions.getRecentlyClosed()) {
                        try {
                            if (s.tab && s.tab.url && s.tab.sessionId) {
                                if (s.tab.url.startsWith(urlBase)) {
                                    await browser_1.sessions.forgetClosedTab(s.tab.windowId, s.tab.sessionId);
                                }
                                continue;
                            }
                            if (!s.window || !s.window.tabs || s.window.tabs.length > 1) {
                                continue;
                            }
                            const [tab] = s.window.tabs;
                            if (tab.url.startsWith(urlBase) && s.window.sessionId) {
                                await browser_1.sessions.forgetClosedWindow(s.window.sessionId);
                            }
                        }
                        catch (ex) {
                            console.error("failed to remove session entry", ex);
                        }
                    }
                };
                browser_1.sessions.onChanged.addListener(sessionRemover);
                await sessionRemover();
            }
            catch (ex) {
                console.error("failed to install session remover", ex);
            }
        }
        try {
            await db_1.DB.init();
        }
        catch (ex) {
            console.error("db init", ex.toString(), ex.message, ex.stack, ex);
        }
        await prefs_1.Prefs.set("last-run", new Date());
        await filters_1.filters();
        await man_1.getManager();
    })().catch(ex => {
        console.error("Failed to init components", ex.toString(), ex.stack, ex);
    });
});


/***/ }),

/***/ "crypto":
/***/ ((module) => {

module.exports = crypto;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		var deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			var notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				var [chunkIds, fn, priority] = deferred[i];
/******/ 				var fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					var r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"background": 0
/******/ 		};
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		__webpack_require__.O.j = (chunkId) => (installedChunks[chunkId] === 0);
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 			return __webpack_require__.O(result);
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkdtalite"] = self["webpackChunkdtalite"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 	var __webpack_exports__ = __webpack_require__.O(undefined, ["common"], () => (__webpack_require__("./lib/background.ts")))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	
/******/ })()
;
//# sourceMappingURL=background.js.map