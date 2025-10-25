'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    let currentlyFilteredImageNodes = [];
    
    const defaultOptions = {
        'size-criterion-dropdown': 'at-least',
        'width-input': 50,
        'height-input': 50,
        'sort-dropdown': 'largest',
        'show-filenames-checkbox': false,
        'show-dimensions-checkbox': true,
    };
    document.addEventListener('input', saveOptions);
    document.addEventListener('change', saveOptions);

    const optionsContainer = document.getElementById('options');
    const container = document.getElementById('thumbnails');
    const showAllImagesButton = document.getElementById('show-all-images-button');
    const emptyContainer = document.getElementById('thumbnails-empty');
    const loadingContainer = document.getElementById('thumbnails-loading');
    const errorContainer = document.getElementById('error');
    const errorText = document.getElementById('error-text');
    const template = document.getElementById('thumbnail-template');
    template.removeAttribute('id');
    template.remove();

    const sortDropdown = document.getElementById('sort-dropdown');
    sortDropdown.onchange = onSortMethodChange;
    function onSortMethodChange() {
        const method = sortDropdown.value;
        const getKeys = {
            largest: image => [pixels(image), basename(image.dataset.originalSrc)],
            smallest: image => [-pixels(image), basename(image.dataset.originalSrc)],
            filename: image => [basename(image.dataset.originalSrc)],
        }[method];
        sortImages(getKeys);

        function pixels(image) {
            return image.dataset.originalWidth * image.dataset.originalHeight;
        }
    }

    const sizeCriterionDropdown = document.getElementById('size-criterion-dropdown');
    sizeCriterionDropdown.onchange = () => filterImages();
    const widthInput = document.getElementById('width-input');
    widthInput.oninput = () => filterImages();
    const heightInput = document.getElementById('height-input');
    heightInput.oninput = () => filterImages();

    optionsContainer.hidden = true;
    container.hidden = true;
    emptyContainer.hidden = true;
    errorContainer.hidden = true;

    const showFilenamesCheckbox = document.getElementById('show-filenames-checkbox');
    showFilenamesCheckbox.onchange = onShowFilenamesChange;
    function onShowFilenamesChange() {
        document.documentElement.classList.toggle('show-filenames', showFilenamesCheckbox.checked);
    };

    const showDimensionsCheckbox = document.getElementById('show-dimensions-checkbox');
    showDimensionsCheckbox.onchange = onShowDimensionsChange;
    function onShowDimensionsChange() {
        document.documentElement.classList.toggle('show-dimensions', showDimensionsCheckbox.checked);
    };

    showAllImagesButton.onclick = showAllImages;

    chrome.runtime.onMessage.addListener((message, sender, reply) => {
        handleMessage(message);
        return true;
    });

    async function handleMessage(message) {
        if (message.type === 'images-from-page') {
            showImages(message.images);
        }
        else {
            throw new Error('Invalid message type: ' + message.type);
        }
    }

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({target: {tabId: currentTab.id}, files: ['page.js']}, function(x) {
        if (chrome.runtime.lastError) {
            loadingContainer.hidden = true;
            errorContainer.hidden = false;
            errorText.textContent = chrome.runtime.lastError.message;
        }
    });

    async function showImages(images) {
        container.replaceChildren();

        const blockedImages = [];
        const results = await Promise.all([
            readStorage('options'),
            Promise.all(unique(images, image => image.url).map(image => new Promise((resolve, reject) => {
                const node = template.cloneNode(true);
                const imageNode = node.querySelector('img');
                imageNode.src = image.thumbnail;
                imageNode.title = image.url;
                imageNode.dataset.originalSrc = image.url;
                imageNode.dataset.originalWidth = image.width;
                imageNode.dataset.originalHeight = image.height;
                imageNode.onload = () => resolve(node);
                imageNode.onerror = () => {
                    blockedImages.push(imageNode.src);
                    resolve(node);
                };
                node.querySelector('a').href = image.url;
            })))
        ]);

        const savedOptions = results[0] || {};
        const options = overlay(defaultOptions, savedOptions);
        renderOptions(options);

        const nodes = results[1];
        nodes.forEach(node => {
            const image = node.querySelector('img');
            const filenameLabel = node.querySelector('.image-filename');
            filenameLabel.textContent = basename(image.dataset.originalSrc);
            const dimensionsLabel = node.querySelector('.image-dimensions');
            dimensionsLabel.textContent = image.dataset.originalWidth + '⨯' + image.dataset.originalHeight;
            dimensionsLabel.hidden = false;
            container.appendChild(node);
        });
        onSortMethodChange();
        onShowDimensionsChange();
        onShowFilenamesChange();
        filterImages();
        loadingContainer.hidden = true;
        optionsContainer.hidden = false;
    }

    function sortImages(getKeys) {
        sortNode(container, node => getKeys(node.querySelector('img')));
    }

    function allImages() {
        return Array.from(container.children).map(node => node.querySelector('img'));
    }

    function imageFilter(image) {
        const width = parseInt(widthInput.value, 10);
        if (isNaN(width)) width = 0;

        const height = parseInt(heightInput.value, 10);
        if (isNaN(height)) height = 0;

        const criterion = sizeCriterionDropdown.value;
        if (criterion === 'at-least') {
            return image.naturalWidth >= width && image.naturalHeight >= height;
        }
        else {
            return image.naturalWidth <= width && image.naturalHeight <= height;
        }
    }

    function filterImages() {
        const active = filterChildren(container, node => imageFilter(node.querySelector('img')));
        container.hidden = active.length === 0;
        emptyContainer.hidden = active.length > 0;
        currentlyFilteredImageNodes = active.map(parent => parent.querySelector('img'));
    }

    function showAllImages() {
        const images = allImages();
        
        const widths = images.map(img => img.naturalWidth);
        const heights = images.map(img => img.naturalHeight);

        const criterion = sizeCriterionDropdown.value;
        let newWidthLimit;
        let newHeightLimit;
        if (criterion === 'at-least') {
            const smallestWidth = Math.min(...widths);
            const smallestHeight = Math.min(...heights);
            newWidthLimit = roundDown(smallestWidth, 50);
            newHeightLimit = roundDown(smallestHeight, 50);
        }
        else {
            const greatestWidth = Math.max(...widths);
            const greatestHeight = Math.max(...heights);
            newWidthLimit = roundUp(greatestWidth, 50);
            newHeightLimit = roundUp(greatestHeight, 50);
        }

        widthInput.value = newWidthLimit;
        heightInput.value = newHeightLimit;
        saveOptions();
        
        filterImages();
    }

    function unique(array, getKey) {
        const keys = new Set();
        const result = [];
        for (const value of array) {
            const key = getKey(value);
            if (!keys.has(key)) {
                keys.add(key);
                result.push(value);
            }
        }
        return Array.from(result);
    }

    function sortNode(container, getKeys) {
        const nodes = [].slice.call(container.children);
        nodes.sort((a, b) => {
            // `getKeys` returns an array of keys. If the first pair of keys for
            // both values yields a difference of zero, the next pair of keys
            // will be tried, and so on. We need this in order to sort by
            // filename secondarily when image dimensions are equal.
            const keysA = getKeys(a);
            const keysB = getKeys(b);
            return keysA.reduce((diff, keyA, i) => {
                if (diff !== 0) return diff;
                const keyB = keysB[i];
                if (typeof keyA === 'string' && typeof keyB === 'string') {
                    return keyA.localeCompare(keyB);
                }
                else return keyB - keyA;
            }, 0);
        });
        nodes.forEach(n => container.appendChild(n));
    }

    function filterChildren(container, filter) {
        const nodes = [].slice.call(container.children);
        nodes.forEach(node => node.hidden = !filter(node));
        return nodes.filter(node => !node.hidden);
    }

    function basename(urlString) {
        const url = new URL(urlString);
        const parts = url.pathname.split('/');
        return parts[parts.length - 1];
    }

    function overlay(target, source) {
        const result = Object.assign({}, target);
        Object.keys(target).forEach(key => {
            if (key in source) result[key] = source[key];
        });
        return result;
    }

    function readStorage(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(key, result => resolve(result[key]));
        });
    }

    function valueProperty(element) {
        if (element.tagName === 'INPUT' && element.type === 'checkbox') {
            return 'checked';
        }
        else return 'value';
    }

    function renderOptions(options) {
        Object.keys(options).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const value = options[id];
                element[valueProperty(element)] = value;
            }
        });
    }

    function readOptions() {
        const options = {};
        Object.keys(defaultOptions).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                options[id] = element[valueProperty(element)];
            }
        });
        return options;
    }

    function saveOptions() {
        const options = readOptions();
        chrome.storage.sync.set({options: options});
    }

    function roundUp(value, step) {
        return Math.ceil(value / step) * step;
    }

    function roundDown(value, step) {
        return Math.floor(value / step) * step;
    }
});
