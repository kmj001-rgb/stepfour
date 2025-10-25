let style = document.createElement('style');
style.innerHTML = `
    .highlight {
        outline: 2px solid red;
    }
    .nextfinder {
        outline: 2px solid green;
    }
`;
document.head.appendChild(style);

let onclickEvents = [];

let title = document.title;

function storeOnClickEvents() {
    const elements = document.querySelectorAll('[onclick]');
    onclickEvents = Array.from(elements).map(element => {
        return {
            element: element,
            onclick: element.onclick
        };
    });
}

function removeOnClickEvents() {
    onclickEvents.forEach(item => {
        item.element.onclick = null;
    });
}

function restoreOnClickEvents() {
    onclickEvents.forEach(item => {
        item.element.onclick = item.onclick;
    });
}

storeOnClickEvents();
removeOnClickEvents();

let hrefs = [];

// Function to remove href attributes
function removeHrefs() {
    const links = document.querySelectorAll('a');
    links.forEach((link, index) => {
        hrefs[index] = link.getAttribute('href');
        link.removeAttribute('href');
    });
    console.log('Hrefs removed');
}

// Function to restore href attributes
function restoreHrefs() {
    const links = document.querySelectorAll('a');
    links.forEach((link, index) => {
        link.setAttribute('href', hrefs[index]);
    });
    console.log('Hrefs restored');
}

removeHrefs();

// Function to add highlight to all matching elements
function highlightElements(tagName, className) {
    let selector = `${tagName}.${className}`.replace(/\.{2}/g, '.');
    selector = selector.endsWith('.') ? selector.slice(0, -1) : selector;
    let elements = document.querySelectorAll(selector);
    elements.forEach(element => element.classList.add('highlight'));
    console.log(elements.length);
}

// Function to remove highlight from all elements
function removeHighlight() {
    const highlightedElements = document.querySelectorAll('.highlight');
    highlightedElements.forEach(element => element.classList.remove('highlight'));
}

// Create and position input popup
function createInputPopup(x, y, onSubmit) {
    const popup = document.createElement('div');
    popup.className = 'input-popup';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Choose table name';

    const button = document.createElement('button');
    button.textContent = 'Submit';

    button.addEventListener('click', () => {
        onSubmit(input.value);
        document.body.removeChild(popup);
    });

    popup.appendChild(input);
    popup.appendChild(button);

    popup.style.position = 'absolute';
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;

    document.body.appendChild(popup);

    // Focus the input field for user convenience
    input.focus();
}

function mover(event) {
    // Remove existing highlights
    removeHighlight();

    const element = event.target;
    const tagName = element.tagName.toLowerCase();
    const className = element.className.toString().replace(/ /g, '.');

    if (className) {
        // Add highlight to matching elements
        highlightElements(tagName, className);
    }
}

document.addEventListener('mouseover', mover);

function extrapolateData(desc, map, json, columns) {
    let name = "None"
    if (desc.className !== "") {
        name = desc.className.toString().split(' ')[0];
    }
    
    let oldName = name;
    if (map.has(name)) {
        map.set(name, map.get(name) + 1);
        name += ' ' + map.get(name);
    }
    else {
        map.set(name, 1);
    }

    // Check for src or href attribute
    if (desc.hasAttribute('href')) {
        json[name] = desc.getAttribute('href');
        columns.add(name);
    }
    else if (desc.hasAttribute('src')) {
        json[name] = desc.getAttribute('src');
        columns.add(name);
    }

    // Check for DIRECT inner text
    let tempElement = desc.cloneNode(true);

    // Loop over the elements within the copy
    tempElement.querySelectorAll("*").forEach(function(el) {
        el.remove(); // remove the children
    });

    if (tempElement.textContent !== "") {
        map.set(oldName, map.get(oldName) + 1);
        oldName += ' ' + map.get(oldName);
        json[oldName] = tempElement.textContent;
        columns.add(oldName);
    }

}

function handleClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.target.innerText != 'Submit') {

        const existingPopups = document.querySelectorAll('.input-popup');
        existingPopups.forEach(popup => popup.remove());

        createInputPopup(event.pageX, event.pageY, (value) => {
            const element = event.target;
            const tagName = element.tagName.toLowerCase();
            let classes = element.className.replace(/ /g, '.');
            if (classes.charAt(classes.length - 1) === '.') {
                classes = temp.slice(0, -1);
            }

            if (classes) {
                // Add highlight to matching elements
                highlightElements(tagName, classes);

                let selector = `${tagName}.${classes}`.replace(/\.{2}/g, '.');
                selector = selector.endsWith('.') ? selector.slice(0, -1) : selector;
                const suffix = '.highlight';
                if (selector.endsWith(suffix)) {
                    selector = selector.slice(0, -suffix.length);
                }

                const scrapedData = document.querySelectorAll(selector);
                chrome.storage.local.set({'selector': selector});
               
                let json_data = [];
                let columns = new Set();

                scrapedData.forEach(ele => {
                    let allDescendents = ele.querySelectorAll('*');
                    let map = new Map();
                    let json = {};

                    extrapolateData(ele, map, json, columns);

                    allDescendents.forEach(desc => {
                        extrapolateData(desc, map, json, columns);
                    });

                    json_data.push(json);
                });

                // Send element info to the popup
                const elementInfo = {
                    tag: tagName,
                    id: element.id,
                    classes: classes,
                    text: element.innerText,
                    column: Array.from(columns),
                    data: json_data
                };
                chrome.runtime.sendMessage({ action: 'saveColumn', elementInfo });
                chrome.runtime.sendMessage({ action: 'updateElement', title});
                chrome.runtime.sendMessage({ type: 'focusPopup' });
            }
        });

        // stop click and hover
        restoreHrefs();
        restoreOnClickEvents();
        document.removeEventListener('click', handleClick);
        document.removeEventListener('mouseout', removeHighlight);
        document.removeEventListener('mouseover', mover);
    }
}

document.addEventListener('click', handleClick);
document.addEventListener('mouseout', removeHighlight);