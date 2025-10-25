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

function clickNextButton() {
  chrome.storage.local.get(['nextFinder'], function (result) {
    let nextButton = document.querySelector('.nextfinder');
    if (!nextButton) {
      nextButton = document.querySelector(result.nextFinder);
    }
    if (nextButton) {
      chrome.storage.local.get(['selector'], function (result) {
        const selectName = result.selector;

        const scrapedData = document.querySelectorAll(selectName);
        
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

        
        chrome.runtime.sendMessage({ action: 'updateTable', json_data});
        nextButton.click();
        

      });
    }

  });
  
}

clickNextButton();

