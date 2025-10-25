const collectedData = {};

let isChecked = false;
let isRunning = false;
let prev_json = '';

function runPaginate() {
    chrome.storage.local.get(['curTab'], function(result) {
        chrome.scripting.executeScript({
            target: { tabId: result.curTab },
            files: ['scripts/paginate.js']
          });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateElement') {
        let element = document.getElementById('titleholder');
        element.textContent = request.title;

        chrome.storage.local.get(['url'], function(result) {
            let element = document.getElementById('url');
            element.textContent = result.url;
        });
    }
    else if (request.action === 'updateTable') {
        const data = request.json_data;
       
        if (isChecked && isRunning && JSON.stringify(data) != prev_json) {
            document.getElementById("itemcount").textContent = parseInt(document.getElementById("itemcount").textContent, 10) + data.length;
            document.getElementById("pagecount").textContent = parseInt(document.getElementById("pagecount").textContent, 10) + 1;

            chrome.storage.local.get(['key'], function(result) {
                chrome.storage.local.set({'key': result.key.concat(data)});
            });

            chrome.storage.local.get(['columns'], function(result) {
                const columns = result.columns;

                // Insert table data
                let tableBody = '<tbody>';
                data.forEach(ele => {
                    tableBody += '<tr>';
                    for (let i = 0; i < columns.length; i++) {
                        if (columns[i] in ele) {
                            tableBody += '<td class="item">' + ele[columns[i]] + '</td>';
                        }
                        else {
                            tableBody += '<td class="item"></td>';
                        }
                    }
                    tableBody += '</tr>';
                });
                tableBody += '</tbody>'
    
                const container = document.getElementById("table");
                container.innerHTML += tableBody;
    
                prev_json = JSON.stringify(data);
                setTimeout(() => runPaginate(), 2000);
            });
        }

    }

});

let removedCol = new Set();

function restartPagination() {
    if (isChecked) {
        isRunning = true;
        chrome.storage.local.get(['curTab'], function(result) {
            chrome.scripting.executeScript({
                target: { tabId: result.curTab },
                files: ['scripts/paginate.js']
              });
        });

        let getButton = document.getElementById('createElementsButton');
        getButton.removeEventListener('click', createAndInsertElements);
        getButton.innerText = "Stop Scraping";
        getButton.className = "button center goldman-bold is-danger";
        getButton.addEventListener('click', stopPagination);
    }
}

function stopPagination() {
    isRunning = false;
    let getButton = document.getElementById('createElementsButton');
    getButton.removeEventListener('click', stopPagination);
    getButton.innerText = "Get Data";
    getButton.className = "button center goldman-bold transparent-bg";
    getButton.addEventListener('click', restartPagination);

}

// Function to create and insert the elements
function createAndInsertElements() {
    removedCol.clear();
    chrome.storage.local.get(['key'], function(result) {
        const data = result.key;

        document.getElementById('itemcount').textContent = data.length;
        document.getElementById('pagecount').textContent = 1;

        chrome.storage.local.get(['columns'], function(result) {
            const columns = result.columns;

            // Create table header
            let tableHead = '<thead><tr>';
            for (let i = 0; i < columns.length; i++) {
                tableHead += '<th class="item">' + columns[i].substring(0, 8) + '<a class="remove-column" data-index="' + i + '" id="' + i + '"><span class="icon"><i class="fa-solid fa-xmark fa-xs" aria-hidden="true"></i></span></a>' + '</th>';
            }
            tableHead += '</tr></thead>';

            // Insert table data
            let tableBody = '<tbody>';
            data.forEach(ele => {
                tableBody += '<tr>';
                for (let i = 0; i < columns.length; i++) {
                    if (columns[i] in ele) {
                        tableBody += '<td class="item">' + ele[columns[i]] + '</td>';
                    }
                    else {
                        tableBody += '<td class="item"></td>';
                    }
                }
                tableBody += '</tr>';
            });
            tableBody += '</tbody>'


            const container = document.getElementById("table");
            container.innerHTML = tableHead + tableBody;

            const buttons = document.querySelectorAll('.remove-column');

            function updateButtonIndices() {
                const buttons = document.querySelectorAll('.remove-column');
                buttons.forEach((button, index) => {
                    button.setAttribute('data-index', index);
                });
            }
            
            function removeColumn(index) {
                const table = document.getElementById('table');
                const rows = table.rows;

                for (let row of rows) {
                    if (row.cells[index]) {
                        row.deleteCell(index);
                    }
                }
            }

            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    const columnIndex = button.getAttribute('data-index');
                    const id = button.getAttribute('id');
                    removeColumn(columnIndex);
                    removedCol.add(parseInt(id));
                    updateButtonIndices();
                });
            });


            if (isChecked) {
                isRunning = true;
                chrome.storage.local.get(['curTab'], function(result) {
                    chrome.scripting.executeScript({
                        target: { tabId: result.curTab },
                        files: ['scripts/paginate.js']
                      });
                });

                let getButton = document.getElementById('createElementsButton');
                getButton.removeEventListener('click', createAndInsertElements);
                getButton.innerText = "Stop Scraping";
                getButton.className = "button center goldman-bold is-danger";
                getButton.addEventListener('click', stopPagination);
            }

        });
    });

}

// Add event listener to the button
const button = document.getElementById('createElementsButton');
button.addEventListener('click', createAndInsertElements);

// Add event listener for pagination
document.getElementById('nextCheck').addEventListener('change', (event) => {
    isChecked = event.target.checked;
    if (event.target.checked) {
        chrome.storage.local.get(['curTab'], function(result) { 
            chrome.scripting.executeScript({
                target: { tabId: result.curTab },
                files: ['scripts/nextfinder.js']
            });
            chrome.runtime.sendMessage({ type: 'focusChrome' });
        });
    }
});

// Add event listener for download
const download = document.getElementById('download-button');
download.addEventListener('click', (event) => {
    chrome.storage.local.get(['key'], function(result) {
        const data = result.key;

        chrome.storage.local.get(['columns'], function(result) {
            const columns = result.columns;

            const header = Object.keys(columns).join(',') + '\n';

             // Function to escape double quotes inside a string
            function escapeDoubleQuotes(value) {
                return value.replace(/"/g, '""');
            }

            const rows = [];

            data.forEach(ele => {
                let temp = [];
                for (i = 0; i < columns.length; i++) {
                    if (!removedCol.has(i)) {
                        if (columns[i] in ele) {
                            if (typeof ele[columns[i]] === 'string' && ele[columns[i]].includes(',')) {
                                // Double quotes and escape existing double quotes
                                temp.push(`"${escapeDoubleQuotes(ele[columns[i]])}"`);
                            }
                            else {
                                temp.push(ele[columns[i]]);
                            }
                        }
                        else {
                            temp.push("-");
                        }
                    }
                }
                rows.push(temp.join(','));
            });

            // Join rows with newline character for the final CSV content
            const csvContent = header + rows.join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;' });
            const csvUrl = URL.createObjectURL(blob);

            chrome.downloads.download({ 
                url: csvUrl,
                filename: 'ScrapR_data.csv'
            });

        });

    });
});