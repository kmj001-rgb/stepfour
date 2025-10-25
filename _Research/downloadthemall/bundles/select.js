/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./windows/select.ts":
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
const tslib_1 = __webpack_require__("./node_modules/tslib/tslib.es6.js");
// License: MIT
const table_1 = __webpack_require__("./uikit/lib/table.ts");
const modal_1 = tslib_1.__importDefault(__webpack_require__("./uikit/lib/modal.ts"));
const contextmenu_1 = __webpack_require__("./windows/contextmenu.ts");
const windowutils_1 = __webpack_require__("./lib/windowutils.ts");
const i18n_1 = __webpack_require__("./lib/i18n.ts");
const prefs_1 = __webpack_require__("./lib/prefs.ts");
const recentlist_1 = __webpack_require__("./lib/recentlist.ts");
const windowstate_1 = __webpack_require__("./windows/windowstate.ts");
const dropdown_1 = __webpack_require__("./windows/dropdown.ts");
const keys_1 = __webpack_require__("./windows/keys.ts");
const icons_1 = __webpack_require__("./windows/icons.ts");
const sorting_1 = __webpack_require__("./lib/sorting.ts");
const renamer_1 = __webpack_require__("./lib/manager/renamer.ts");
const constants_1 = __webpack_require__("./uikit/lib/constants.ts");
// eslint-disable-next-line no-unused-vars
const browser_1 = __webpack_require__("./lib/browser.ts");
const winutil_1 = __webpack_require__("./windows/winutil.ts");
const util_1 = __webpack_require__("./lib/util.ts");
__webpack_require__("./windows/theme.ts");
const PORT = browser_1.runtime.connect(null, { name: "select" });
const TREE_CONFIG_VERSION = 1;
const COL_CHECK = 0;
const COL_DOWNLOAD = 1;
const COL_TITLE = 2;
const COL_DESC = 3;
const COL_MASK = 4;
const COL_REFERRER = 5;
const ICON_BASE_SIZE = 16;
const NUM_FILTER_CLASSES = 8;
let Table;
let Mask;
let FastFilter;
let Subfolder;
function clearErrors() {
    const not = winutil_1.$("#notification");
    not.textContent = "";
    not.style.display = "none";
}
function matched(item) {
    return item && item.matched && item.matched !== "unmanual";
}
class PausedModalDialog extends modal_1.default {
    getContent() {
        const tmpl = winutil_1.$("#paused-template");
        const content = tmpl.content.cloneNode(true);
        return content;
    }
    shown() {
        this.focusDefault();
    }
    get buttons() {
        return [
            {
                title: i18n_1._("remember"),
                value: "ok",
                default: true,
                dismiss: false
            },
            {
                title: i18n_1._("add-paused-once"),
                value: "once",
                default: false,
                dismiss: false
            },
            {
                title: i18n_1._("cancel"),
                value: "cancel",
                default: false,
                dismiss: true
            }
        ];
    }
}
class CheckClasser extends Map {
    constructor(numClasses) {
        super();
        this.gen = (function* () {
            for (;;) {
                for (let c = 0; c < numClasses; ++c) {
                    yield `filter-${c + 1}`;
                }
            }
        })();
        this.set("manual", "filter-manual");
        this.set("fast", "filter-fast");
    }
    "get"(key) {
        let result = super.get(key);
        if (typeof result !== "string") {
            result = this.gen.next().value;
            if (result) {
                super.set(key, result);
            }
        }
        return result;
    }
}
class ItemCollection {
    constructor(items) {
        this.items = items;
        this.assignRows();
        this.items.forEach((item, idx) => item.backIdx = idx);
        this.indexes = new Map(items.map((i, idx) => [idx, i]));
    }
    assignRows() {
        this.items.forEach((item, idx) => item.rowid = idx);
    }
    get length() {
        return this.items.length;
    }
    get checked() {
        const rv = [];
        this.items.forEach(function (item, idx) {
            if (item.matched && item.matched !== "unmanual") {
                rv.push(idx);
            }
        });
        return rv;
    }
    get checkedBackIndexes() {
        const rv = [];
        this.items.forEach(function (item) {
            if (item.matched && item.matched !== "unmanual") {
                rv.push(item.backIdx);
            }
        });
        return rv;
    }
    at(idx) {
        return this.items[idx];
    }
    byIndex(idx) {
        return this.indexes.get(idx);
    }
    sort(keyFn) {
        sorting_1.sort(this.items, keyFn, sorting_1.naturalCaseCompare);
        this.assignRows();
    }
    reverse() {
        this.items.reverse();
        this.assignRows();
    }
    filter(fn) {
        return this.items.filter(fn);
    }
}
class SelectionTable extends table_1.VirtualTable {
    constructor(treeConfig, type, links, media) {
        if (type === "links" && !links.length) {
            type = "media";
        }
        else if (type === "media" && !media.length) {
            type = "links";
        }
        super("#items", treeConfig, TREE_CONFIG_VERSION);
        this.checkClasser = new CheckClasser(NUM_FILTER_CLASSES);
        this.icons = new icons_1.Icons(winutil_1.$("#icons"));
        this.links = new ItemCollection(links);
        this.media = new ItemCollection(media);
        this.type = type;
        this.items = type === "links" ? this.links : this.media;
        this.status = winutil_1.$("#statusItems");
        this.linksTab = winutil_1.$("#linksTab");
        if (!links.length) {
            this.linksTab.classList.add("disabled");
        }
        else {
            this.linksTab.addEventListener("click", this.switchTab.bind(this, "links"));
        }
        this.mediaTab = winutil_1.$("#mediaTab");
        if (!media.length) {
            this.mediaTab.classList.add("disabled");
        }
        else {
            this.mediaTab.addEventListener("click", this.switchTab.bind(this, "media"));
        }
        this.linksFilters = winutil_1.$("#linksFilters");
        this.mediaFilters = winutil_1.$("#mediaFilters");
        i18n_1.localize(winutil_1.$("#table-context").content);
        this.contextMenu = new contextmenu_1.ContextMenu("#table-context");
        keys_1.Keys.adoptContext(this.contextMenu);
        this.sortcol = null;
        this.sortasc = true;
        this.keyfns = new Map([
            ["colDownload", item => item.usable],
            ["colTitle", item => [item.title, item.usable]],
            ["colDescription", item => [item.description, item.usable]],
            ["colMask", item => [item.mask, item.usable]],
        ]);
        this.on("config-changed", () => {
            prefs_1.Prefs.set("tree-config-select", JSON.stringify(this));
        });
        this.on("column-clicked", colid => {
            const keyfn = this.keyfns.get(colid);
            if (!keyfn) {
                return false;
            }
            this.links.sort(keyfn);
            this.media.sort(keyfn);
            const elem = document.querySelector(`#${colid}`);
            const oldelem = (this.sortcol && document.querySelector(`#${this.sortcol}`));
            if (this.sortcol === colid && this.sortasc) {
                this.links.reverse();
                this.media.reverse();
                this.sortasc = false;
            }
            else {
                this.sortcol = colid;
                this.sortasc = true;
            }
            if (oldelem) {
                oldelem.dataset.sortdir = "";
            }
            if (elem) {
                elem.dataset.sortdir = this.sortasc ? "asc" : "desc";
            }
            this.invalidate();
            return true;
        });
        this.on(" -keypress", () => this.checkSelection());
        this.contextMenu.on("ctx-check-selected", () => {
            this.checkSelection("manual");
        });
        this.contextMenu.on("ctx-uncheck-selected", () => {
            this.checkSelection("unmanual");
        });
        this.contextMenu.on("ctx-toggle-selected", () => {
            this.checkSelection("toggle");
        });
        keys_1.Keys.on("ACCEL-KeyA", (event) => {
            const target = event.target;
            if (target.localName === "input") {
                return false;
            }
            this.selectAll();
            return true;
        });
        keys_1.Keys.on("ACCEL-KeyF", () => {
            this.selectChecked();
            return true;
        });
        keys_1.Keys.on("ACCEL-KeyI", () => {
            this.selectToggle();
            return true;
        });
        keys_1.Keys.on("ACCEL-KeyO", () => {
            this.openSelection();
            return true;
        });
        this.contextMenu.on("ctx-mask", async () => {
            if (this.selection.empty) {
                return;
            }
            let oldmask = "";
            for (const r of this.selection) {
                const m = this.items.at(r).mask;
                if (oldmask && m !== oldmask) {
                    oldmask = "";
                    break;
                }
                oldmask = m || oldmask;
            }
            try {
                keys_1.Keys.suppressed = true;
                const newmask = await modal_1.default.prompt(i18n_1._("set_mask"), i18n_1._("set_mask_text"), oldmask);
                for (const r of this.selection) {
                    this.items.at(r).mask = newmask;
                    this.invalidateRow(r);
                }
            }
            catch (ex) {
                console.warn("mask dismissed", ex);
            }
            finally {
                keys_1.Keys.suppressed = false;
            }
        });
        this.contextMenu.on("ctx-referrer", async () => {
            if (this.selection.empty) {
                return;
            }
            let oldref = "";
            for (const r of this.selection) {
                const m = this.items.at(r).usableReferrer;
                if (oldref && m !== oldref) {
                    oldref = "";
                    break;
                }
                oldref = m || oldref;
            }
            try {
                keys_1.Keys.suppressed = true;
                const newref = await modal_1.default.prompt(i18n_1._("set_referrer"), i18n_1._("set_referrer_text"), oldref);
                try {
                    let ref;
                    if (!newref) {
                        ref = {
                            referrer: undefined,
                            usableReferrer: undefined,
                        };
                    }
                    else {
                        const u = new URL(newref);
                        u.hash = "";
                        ref = {
                            referrer: u.toString(),
                            usableReferrer: decodeURIComponent(u.toString()),
                        };
                    }
                    for (const r of this.selection) {
                        Object.assign(this.items.at(r), ref);
                        this.invalidateRow(r);
                    }
                }
                catch {
                    // ignored
                }
            }
            catch (ex) {
                console.warn("mask dismissed", ex);
            }
            finally {
                keys_1.Keys.suppressed = false;
            }
        });
        this.contextMenu.on("dismissed", () => this.table.focus());
        this.on("contextmenu", (tree, event) => {
            if (!this.selection.empty) {
                this.contextMenu.show(event);
            }
            return true;
        });
        this.init();
        this.switchTab(type);
    }
    get rowCount() {
        return this.items.length;
    }
    checkSelection(state) {
        if (this.selection.empty) {
            return false;
        }
        for (const rowid of this.selection) {
            const item = this.items.at(rowid);
            if (!state) {
                state = matched(item) ? "unmanual" : "manual";
            }
            let ns;
            switch (state) {
                case "toggle":
                    ns = matched(item) ? "unmanual" : "manual";
                    break;
                default:
                    ns = state;
            }
            item.matched = ns;
            this.invalidateRow(rowid);
        }
        this.updateStatus();
        return true;
    }
    selectAll() {
        this.selection.add(0, this.rowCount - 1);
    }
    selectChecked() {
        this.selection.clear();
        let min = null;
        for (const ci of this.items.checked) {
            this.selection.add(ci);
            min = min === null ? ci : Math.min(min, ci);
        }
        if (min !== null) {
            this.scrollIntoView(min);
        }
    }
    selectToggle() {
        this.selection.toggle(0, this.rowCount - 1);
    }
    openSelection() {
        const privates = [];
        const items = this.items.filter((i, idx) => this.selection.contains(idx)).
            filter(i => {
            if (i.private) {
                privates.push(i);
                return false;
            }
            return true;
        });
        if (!items.length && !privates.length) {
            if (this.focusRow < 0) {
                return;
            }
            const item = this.items.at(this.focusRow);
            if (item.private) {
                privates.push(item);
            }
            else {
                items.push(item);
            }
        }
        if (items.length) {
            PORT.postMessage({
                msg: "openUrls",
                urls: items.map(e => e.url),
                incognito: false,
            });
        }
        if (privates.length) {
            PORT.postMessage({
                msg: "openUrls",
                urls: privates.map(e => e.url),
                incognito: true,
            });
        }
    }
    applyDeltaTo(delta, items) {
        const active = items === this.items;
        for (const d of delta) {
            const { idx = -1, matched = null } = d;
            if (idx < 0) {
                continue;
            }
            const item = items.byIndex(idx);
            if (!item) {
                continue;
            }
            if (item.matched === matched) {
                continue;
            }
            if (matched !== "fast" &&
                (item.matched === "manual" || item.matched === "unmanual")) {
                // Skip manually selected items
                continue;
            }
            item.matched = matched;
            if (active) {
                this.invalidateRow(item.rowid);
            }
        }
    }
    applyDeltas({ deltaLinks = [], deltaMedia = [] }) {
        this.applyDeltaTo(deltaLinks, this.links);
        this.applyDeltaTo(deltaMedia, this.media);
        this.updateStatus();
    }
    switchTab(type) {
        this.type = type;
        const isLinks = type === "links";
        this.linksTab.classList[isLinks ? "add" : "remove"]("active");
        this.mediaTab.classList[!isLinks ? "add" : "remove"]("active");
        this.linksFilters.classList[isLinks ? "add" : "remove"]("active");
        this.mediaFilters.classList[!isLinks ? "add" : "remove"]("active");
        this.items = this[type];
        this.selection.clear();
        this.invalidate();
        this.updateStatus();
    }
    updateStatus() {
        const selected = this.items.checked.length;
        if (!selected) {
            this.status.textContent = i18n_1._("noitems.label");
        }
        else {
            this.status.textContent = i18n_1._("numitems.label", [selected]);
        }
        clearErrors();
    }
    getRowClasses(rowid) {
        const item = this.items.at(rowid);
        if (!item || !matched(item) || !item.matched) {
            return null;
        }
        const m = this.checkClasser.get(item.matched);
        if (!m) {
            return null;
        }
        return ["filtered", m];
    }
    getCellIcon(rowid, colid) {
        const item = this.items.at(rowid);
        if (item && colid === COL_DOWNLOAD) {
            return this.icons.get(windowutils_1.iconForPath(item.url, ICON_BASE_SIZE));
        }
        return null;
    }
    getCellType(rowid, colid) {
        switch (colid) {
            case COL_CHECK:
                return constants_1.CellTypes.TYPE_CHECK;
            default:
                return constants_1.CellTypes.TYPE_TEXT;
        }
    }
    getDownloadText(idx) {
        const item = this.items.at(idx);
        if (!item) {
            return "";
        }
        if (item.fileName) {
            return `${item.usable} (${item.fileName})`;
        }
        return item.usable;
    }
    getText(prop, idx) {
        const item = this.items.at(idx);
        if (!item || !(prop in item) || !item[prop]) {
            return "";
        }
        return item[prop];
    }
    getMaskText(idx) {
        const item = this.items.at(idx);
        if (item) {
            return item.mask;
        }
        return i18n_1._("mask.default");
    }
    getCellText(rowid, colid) {
        switch (colid) {
            case COL_DOWNLOAD:
                return this.getDownloadText(rowid);
            case COL_TITLE:
                return this.getText("title", rowid);
            case COL_DESC:
                return this.getText("description", rowid);
            case COL_REFERRER:
                return this.getText("usableReferrer", rowid);
            case COL_MASK:
                return this.getMaskText(rowid);
            default:
                return "";
        }
    }
    getCellCheck(rowid, colid) {
        if (colid === COL_CHECK) {
            return !!matched(this.items.at(rowid));
        }
        return false;
    }
    setCellCheck(rowid, colid, value) {
        this.items.at(rowid).matched = value ? "manual" : "unmanual";
        this.invalidateRow(rowid);
        this.updateStatus();
    }
}
async function download(paused = false) {
    try {
        const mask = Mask.value;
        if (!mask) {
            throw new Error("error.invalidMask");
        }
        const subfolder = Subfolder.value;
        util_1.validateSubFolder(subfolder);
        const items = Table.items.checkedBackIndexes;
        if (!items.length) {
            throw new Error("error.noItemsSelected");
        }
        if (paused && !(await prefs_1.Prefs.get("add-paused"))) {
            try {
                keys_1.Keys.suppressed = true;
                const remember = await new PausedModalDialog().show();
                if (remember === "ok") {
                    await prefs_1.Prefs.set("add-paused", true);
                    await prefs_1.Prefs.save();
                }
            }
            catch (ex) {
                return;
            }
            finally {
                keys_1.Keys.suppressed = false;
            }
        }
        if (!paused) {
            await prefs_1.Prefs.set("add-paused", false);
        }
        PORT.postMessage({
            msg: "queue",
            items,
            options: {
                type: Table.type,
                paused,
                mask,
                maskOnce: winutil_1.$("#maskOnceCheck").checked,
                fast: FastFilter.value,
                fastOnce: winutil_1.$("#fastOnceCheck").checked,
                subfolder,
                subfolderOnce: winutil_1.$("#subfolderOnceCheck").checked,
            }
        });
    }
    catch (ex) {
        const not = winutil_1.$("#notification");
        const msg = i18n_1._(ex.message || ex);
        not.textContent = msg || ex.message || ex;
        not.style.display = "block";
    }
}
class Filter {
    constructor(container, raw, active = false) {
        Object.assign(this, raw);
        this.active = active;
        this.container = container;
        this.elem = document.createElement("label");
        this.elem.classList.add("filter");
        this.elem.setAttribute("title", this.elem.textContent = this.label);
        this.checkElem = document.createElement("input");
        this.checkElem.setAttribute("type", "checkbox");
        this.checkElem.checked = active;
        this.elem.insertBefore(this.checkElem, this.elem.firstChild);
        this.container.appendChild(this.elem);
        this.checkElem.addEventListener("change", this.changed.bind(this));
    }
    changed() {
        PORT.postMessage({
            msg: "filter-changed",
            id: this.id,
            value: this.checkElem.checked
        });
    }
}
function setFiltersInternal(desc, filters, active) {
    const container = winutil_1.$(desc);
    container.textContent = "";
    for (let filter of filters) {
        filter = new Filter(container, filter, active.has(filter.id));
    }
}
function setFilters(filters) {
    const { linkFilterDescs = [], mediaFilterDescs = [], activeFilters = [] } = filters;
    const active = new Set(activeFilters);
    setFiltersInternal("#linksFilters", linkFilterDescs, active);
    setFiltersInternal("#mediaFilters", mediaFilterDescs, active);
}
function cancel() {
    PORT.postMessage("cancel");
    return true;
}
async function init() {
    await Promise.all([recentlist_1.MASK.init(), recentlist_1.FASTFILTER.init(), recentlist_1.SUBFOLDER.init()]);
    Mask = new dropdown_1.Dropdown("#mask", recentlist_1.MASK.values);
    Mask.on("changed", clearErrors);
    FastFilter = new dropdown_1.Dropdown("#fast", recentlist_1.FASTFILTER.values);
    FastFilter.on("changed", () => {
        PORT.postMessage({
            msg: "fast-filter",
            fastFilter: FastFilter.value
        });
    });
    Subfolder = new dropdown_1.Dropdown("#subfolder", recentlist_1.SUBFOLDER.values);
    Subfolder.on("changed", clearErrors);
}
const LOADED = new Promise(resolve => {
    addEventListener("load", function dom() {
        removeEventListener("load", dom);
        i18n_1.locale.then(() => resolve(true));
    });
});
addEventListener("DOMContentLoaded", function dom() {
    removeEventListener("DOMContentLoaded", dom);
    init().catch(console.error);
    i18n_1.localize(document.documentElement);
    winutil_1.$("#donate").addEventListener("click", () => {
        PORT.postMessage({
            msg: "donate",
        });
    });
    winutil_1.$("#statusPrefs").addEventListener("click", () => {
        PORT.postMessage({
            msg: "prefs",
        });
    });
    winutil_1.$("#btnDownload").addEventListener("click", () => download(false));
    winutil_1.$("#btnPaused").addEventListener("click", () => download(true));
    winutil_1.$("#btnCancel").addEventListener("click", cancel);
    winutil_1.$("#fastDisableOthers").addEventListener("change", () => {
        PORT.postMessage({
            msg: "onlyfast",
            fast: winutil_1.$("#fastDisableOthers").checked
        });
    });
    keys_1.Keys.on("Enter", "Return", () => {
        download(false);
        return true;
    });
    keys_1.Keys.on("ACCEL-Enter", "ACCEL-Return", () => {
        download(true);
        return true;
    });
    PORT.onMessage.addListener(async (msg) => {
        try {
            await LOADED;
            switch (msg.msg) {
                case "items": {
                    const { type = "links", links = [], media = [] } = msg.data;
                    const treeConfig = JSON.parse(await prefs_1.Prefs.get("tree-config-select", "{}"));
                    requestAnimationFrame(() => {
                        Table = new SelectionTable(treeConfig, type, links, media);
                    });
                    return;
                }
                case "filters":
                    setFilters(msg.data);
                    return;
                case "item-delta":
                    requestAnimationFrame(() => {
                        Table.applyDeltas(msg.data);
                    });
                    return;
                default:
                    throw Error("Unhandled message");
            }
        }
        catch (ex) {
            console.error("Failed to process message", msg, ex);
        }
    });
    keys_1.Keys.on("Escape", cancel);
    renamer_1.hookButton(winutil_1.$("#maskButton"));
});
addEventListener("contextmenu", event => {
    event.preventDefault();
    return false;
});
addEventListener("beforeunload", function () {
    PORT.disconnect();
});
new windowstate_1.WindowState(PORT);


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
/******/ 			"select": 0
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
/******/ 	var __webpack_exports__ = __webpack_require__.O(undefined, ["common"], () => (__webpack_require__("./windows/select.ts")))
/******/ 	__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 	
/******/ })()
;
//# sourceMappingURL=select.js.map