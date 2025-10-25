/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./lib/batches.ts":
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BatchGenerator = void 0;
// License: MIT
const PROCESS = Symbol();
class Literal {
    constructor(str) {
        this.preview = this.str = str;
        this.length = 1;
        Object.freeze(this);
    }
    *[Symbol.iterator]() {
        yield this.str;
    }
}
function reallyParseInt(str) {
    if (!/^[+-]?[0-9]+$/.test(str)) {
        throw new Error("Not a number");
    }
    const rv = parseInt(str, 10);
    if (isNaN(rv) || rv !== (rv | 0)) {
        throw new Error("Not a number");
    }
    return rv;
}
class Numeral {
    constructor(str) {
        const rawpieces = str.split(":").map(e => e.trim());
        const pieces = rawpieces.map(e => reallyParseInt(e));
        if (pieces.length < 2) {
            throw new Error("Invalid input");
        }
        const [start, stop, step] = pieces;
        if (step === 0) {
            throw new Error("Invalid step");
        }
        this.step = !step ? 1 : step;
        const dir = this.step > 0;
        if (dir && start > stop) {
            throw new Error("Invalid sequence");
        }
        else if (!dir && start < stop) {
            throw new Error("Invalid sequence");
        }
        this.start = start;
        this.stop = stop;
        this.digits = dir ? rawpieces[0].length : rawpieces[1].length;
        this.length = Math.floor((this.stop - this.start + (dir ? 1 : -1)) / this.step);
        this.preview = this[Symbol.iterator]().next().value;
        Object.freeze(this);
    }
    *[Symbol.iterator]() {
        const { digits, start, stop, step } = this;
        const dir = step > 0;
        for (let i = start; (dir ? i <= stop : i >= stop); i += step) {
            const rv = i.toString();
            const len = digits - rv.length;
            if (len > 0) {
                yield "0".repeat(len) + rv;
            }
            else {
                yield rv;
            }
        }
    }
}
class Character {
    constructor(str) {
        const rawpieces = str.split(":").map(e => e.trim());
        const pieces = rawpieces.map((e, i) => {
            if (i === 2) {
                return reallyParseInt(e);
            }
            if (e.length > 1) {
                throw new Error("Malformed Character sequence");
            }
            return e.charCodeAt(0);
        });
        if (pieces.length < 2) {
            throw new Error("Invalid input");
        }
        const [start, stop, step] = pieces;
        if (step === 0) {
            throw new Error("Invalid step");
        }
        this.step = !step ? 1 : step;
        const dir = this.step > 0;
        if (dir && start > stop) {
            throw new Error("Invalid sequence");
        }
        else if (!dir && start < stop) {
            throw new Error("Invalid sequence");
        }
        this.start = start;
        this.stop = stop;
        this.length = Math.floor((this.stop - this.start + (dir ? 1 : -1)) / this.step);
        this.preview = this[Symbol.iterator]().next().value;
        Object.freeze(this);
    }
    *[Symbol.iterator]() {
        const { start, stop, step } = this;
        const dir = step > 0;
        for (let i = start; (dir ? i <= stop : i >= stop); i += step) {
            yield String.fromCharCode(i);
        }
    }
}
class BatchGenerator {
    constructor(str) {
        this.gens = [];
        let i;
        this.hasInvalid = false;
        while ((i = str.search(/\[.+?:.+?\]/)) !== -1) {
            if (i !== 0) {
                this.gens.push(new Literal(str.slice(0, i)));
                str = str.slice(i);
            }
            const end = str.indexOf("]");
            if (end <= 0) {
                throw new Error("Something went terribly wrong");
            }
            const tok = str.slice(1, end);
            str = str.slice(end + 1);
            try {
                this.gens.push(new Numeral(tok));
            }
            catch {
                try {
                    this.gens.push(new Character(tok));
                }
                catch {
                    this.gens.push(new Literal(`[${tok}]`));
                    this.hasInvalid = true;
                }
            }
        }
        if (str) {
            this.gens.push(new Literal(str));
        }
        // Merge literls
        for (let i = this.gens.length; i > 1; --i) {
            const sgen0 = this.gens[i - 1];
            const sgen1 = this.gens[i];
            if (sgen0 instanceof Literal && sgen1 instanceof Literal) {
                this.gens[i - 1] = new Literal(sgen0.str + sgen1.str);
                this.gens.splice(i, 1);
            }
        }
        this.length = this.gens.reduce((p, c) => p * c.length, 1);
        this.preview = this.gens.reduce((p, c) => p + c.preview, "");
    }
    static *[PROCESS](gens) {
        const cur = gens.pop();
        if (!cur) {
            yield "";
            return;
        }
        for (const g of BatchGenerator[PROCESS](gens)) {
            for (const tail of cur) {
                yield g + tail;
            }
        }
    }
    *[Symbol.iterator]() {
        if (this.length === 1) {
            yield this.preview;
            return;
        }
        yield* BatchGenerator[PROCESS](this.gens.slice());
    }
}
exports.BatchGenerator = BatchGenerator;


/***/ }),

/***/ "./windows/single.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var __webpack_unused_export__;
/* eslint-disable require-atomic-updates */

__webpack_unused_export__ = ({ value: true });
const tslib_1 = __webpack_require__("./node_modules/tslib/tslib.es6.js");
// License: MIT
const modal_1 = tslib_1.__importDefault(__webpack_require__("./uikit/lib/modal.ts"));
const i18n_1 = __webpack_require__("./lib/i18n.ts");
// eslint-disable-next-line no-unused-vars
const item_1 = __webpack_require__("./lib/item.ts");
const recentlist_1 = __webpack_require__("./lib/recentlist.ts");
const batches_1 = __webpack_require__("./lib/batches.ts");
const windowstate_1 = __webpack_require__("./windows/windowstate.ts");
const dropdown_1 = __webpack_require__("./windows/dropdown.ts");
const keys_1 = __webpack_require__("./windows/keys.ts");
const renamer_1 = __webpack_require__("./lib/manager/renamer.ts");
const browser_1 = __webpack_require__("./lib/browser.ts");
const winutil_1 = __webpack_require__("./windows/winutil.ts");
const util_1 = __webpack_require__("./lib/util.ts");
__webpack_require__("./windows/theme.ts");
const PORT = browser_1.runtime.connect(null, { name: "single" });
let ITEM;
let Mask;
let Subfolder;
class BatchModalDialog extends modal_1.default {
    constructor(gen) {
        super();
        this.gen = gen;
    }
    getContent() {
        const tmpl = winutil_1.$("#batch-template");
        const content = tmpl.content.cloneNode(true);
        winutil_1.$(".batch-items", content).textContent = this.gen.length.toLocaleString();
        winutil_1.$(".batch-preview", content).textContent = this.gen.preview;
        return content;
    }
    get buttons() {
        return [
            {
                title: i18n_1._("batch.batch"),
                value: "ok",
                default: true,
                dismiss: false
            },
            {
                title: i18n_1._("batch.single"),
                value: "single",
                default: false,
                dismiss: false
            },
            {
                title: i18n_1._("cancel"),
                value: "cancel",
                default: false,
                dismiss: true,
            }
        ];
    }
}
function setItem(item) {
    if (!item) {
        return;
    }
    ITEM = item;
    const { usable = "", fileName = "", title = "", description = "", usableReferrer = "", mask = "", subfolder = "", } = item;
    winutil_1.$("#URL").value = usable;
    winutil_1.$("#filename").value = fileName;
    winutil_1.$("#title").value = title;
    winutil_1.$("#description").value = description;
    winutil_1.$("#referrer").value = usableReferrer;
    if (mask) {
        Mask.value = mask;
    }
    if (subfolder) {
        Subfolder.value = subfolder;
    }
}
function displayError(err) {
    const not = winutil_1.$("#notification");
    not.textContent = i18n_1._(err);
    not.style.display = "block";
}
async function downloadInternal(paused) {
    let usable = winutil_1.$("#URL").value.trim();
    let url;
    try {
        url = new URL(usable).toString();
    }
    catch (ex) {
        try {
            url = new URL(`https://${usable}`).toString();
            winutil_1.$("#URL").value = usable = `https://${usable}`;
        }
        catch (ex) {
            return displayError("error.invalidURL");
        }
    }
    const gen = new batches_1.BatchGenerator(usable);
    const usableReferrer = winutil_1.$("#referrer").value.trim();
    let referrer;
    try {
        referrer = usableReferrer ? new URL(usableReferrer).toString() : "";
    }
    catch (ex) {
        return displayError("error.invalidReferrer");
    }
    const fileName = winutil_1.$("#filename").value.trim();
    const title = winutil_1.$("#title").value.trim();
    const description = winutil_1.$("#description").value.trim();
    const mask = Mask.value.trim();
    if (!mask) {
        return displayError("error.invalidMask");
    }
    const subfolder = Subfolder.value.trim();
    util_1.validateSubFolder(subfolder);
    const items = [];
    if (!ITEM) {
        ITEM = new item_1.Item({
            url,
            usable,
            referrer,
            usableReferrer,
            fileName,
            title,
            description,
            mask,
            subfolder
        });
    }
    else {
        ITEM.fileName = fileName;
        ITEM.title = title;
        ITEM.description = description;
        ITEM.mask = mask;
        ITEM.subfolder = subfolder;
        if (usableReferrer !== ITEM.usableReferrer) {
            ITEM.referrer = referrer;
            ITEM.usableReferrer = usableReferrer;
        }
    }
    let isBatch = gen.length > 1;
    if (isBatch) {
        try {
            keys_1.Keys.suppressed = true;
            const rv = await new BatchModalDialog(gen).show();
            isBatch = rv === "ok";
        }
        finally {
            keys_1.Keys.suppressed = false;
        }
    }
    if (!isBatch) {
        if (usable !== ITEM.usable) {
            ITEM.url = url;
            ITEM.usable = usable;
        }
        items.push(ITEM);
    }
    else {
        for (const usable of gen) {
            items.push(Object.assign({}, ITEM, { usable, url: new URL(usable).toString() }));
        }
    }
    PORT.postMessage({
        msg: "queue",
        items,
        options: {
            paused,
            mask,
            maskOnce: winutil_1.$("#maskOnceCheck").checked,
            subfolder,
            subfolderOnce: winutil_1.$("#subfolderOnceCheck").checked,
        }
    });
    return null;
}
function download(paused) {
    downloadInternal(paused).catch(console.error);
}
function cancel() {
    PORT.postMessage("cancel");
    return true;
}
async function init() {
    await i18n_1.localize(document.documentElement);
    await Promise.all([recentlist_1.MASK.init(), recentlist_1.SUBFOLDER.init()]);
    Mask = new dropdown_1.Dropdown("#mask", recentlist_1.MASK.values);
    Subfolder = new dropdown_1.Dropdown("#subfolder", recentlist_1.SUBFOLDER.values);
}
addEventListener("DOMContentLoaded", async function dom() {
    removeEventListener("DOMContentLoaded", dom);
    const inited = init();
    PORT.onMessage.addListener(async (msg) => {
        try {
            switch (msg.msg) {
                case "item": {
                    await inited;
                    setItem(msg.data.item);
                    return;
                }
                default:
                    throw Error("Unhandled message");
            }
        }
        catch (ex) {
            console.error("Failed to process message", msg, ex);
        }
    });
    await inited;
    winutil_1.$("#btnDownload").addEventListener("click", () => download(false));
    winutil_1.$("#btnPaused").addEventListener("click", () => download(true));
    winutil_1.$("#btnCancel").addEventListener("click", cancel);
    keys_1.Keys.on("Enter", "Return", () => {
        download(false);
        return true;
    });
    keys_1.Keys.on("ACCEL-Enter", "ACCEL-Return", () => {
        download(true);
        return true;
    });
    keys_1.Keys.on("Escape", () => {
        cancel();
        return true;
    });
    renamer_1.hookButton(winutil_1.$("#maskButton"));
});
addEventListener("load", function () {
    winutil_1.$("#URL").focus();
});
addEventListener("contextmenu", event => {
    const target = event.target;
    if (target.localName === "input") {
        return null;
    }
    event.preventDefault();
    event.stopPropagation();
    return false;
});
addEventListener("beforeunload", function () {
    PORT.disconnect();
});
new windowstate_1.WindowState(PORT);


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
/******/ 			"single": 0
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
/******/ 	var __webpack_exports__ = __webpack_require__.O(undefined, ["common"], () => (__webpack_require__("./windows/single.ts")))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	
/******/ })()
;
//# sourceMappingURL=single.js.map