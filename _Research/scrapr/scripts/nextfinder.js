// Function to remove highlight from all elements
function removeHighlight() {
    const highlightedElements = document.querySelectorAll('.nextfinder');
    highlightedElements.forEach(element => element.classList.remove('nextfinder'));
}

function nextmover(event) {
    // Remove existing highlights
    removeHighlight();

    const element = event.target;
    element.classList.add('nextfinder');
}

function nextClick(event) {
    const element = event.target;
    const tagName = element.tagName.toLowerCase();
    let classes = element.className.replace(/ /g, '.');
    if (classes.charAt(classes.length - 1) === '.') {
        classes = temp.slice(0, -1);
    }
    let selector = `${tagName}.${classes}`.replace(/\.{2}/g, '.');
    selector = selector.endsWith('.') ? selector.slice(0, -1) : selector;
    const suffix = '.highlight';
    if (selector.endsWith(suffix)) {
        selector = selector.slice(0, -suffix.length);
    }
    chrome.storage.local.set({'nextFinder': selector});

    document.removeEventListener('mouseover', nextmover);
    chrome.runtime.sendMessage({ type: 'focusPopup' });
}

document.addEventListener('click', nextClick);
document.addEventListener('mouseover', nextmover);
