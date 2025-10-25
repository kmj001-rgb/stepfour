chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "to-content") {
    //console.log("from background:");

    var source = DOMtoString(document);
    var items = "";
    var items_2 = "";
    var doc = document.implementation.createHTMLDocument('title')
    doc.documentElement.innerHTML = source;
      var images = doc.getElementsByTagName('img'); 
    var srcList = [];
    for(var i = 0; i < images.length; i++) {
        srcList.push(images[i].src);
    }

    var count = 1;
    
    var uniqueArray = srcList.filter(function(item, pos) {
        return srcList.indexOf(item) == pos;
    });

    uniqueArray.forEach(function(entry) 
    {
      if(entry!=null && isEmptyOrSpaces(entry)!=true)
      {
        entry = entry.trim();

        if (!entry.startsWith('http')) {
          // Create a URL object from the current page URL
          const baseUrl = new URL(window.location.href);
          // Resolve the relative URL against the base URL
          entry = new URL(entry, baseUrl).href;
        }

        items = items + count+ '. '+entry+'\n';
        items_2 = items_2 +entry+'\n';
        count++;
      }
    });  

    const response = { ordered: items, unordered: items_2 };

    sendResponse(response);
  }
});


function DOMtoString(document_root) {
    var html = '',
        node = document_root.firstChild;
    while (node) {
        switch (node.nodeType) {
        case Node.ELEMENT_NODE:
            html += node.outerHTML;
            break;
        case Node.TEXT_NODE:
            html += node.nodeValue;
            break;
        case Node.CDATA_SECTION_NODE:
            html += '<![CDATA[' + node.nodeValue + ']]>';
            break;
        case Node.COMMENT_NODE:
            html += '<!--' + node.nodeValue + '-->';
            break;
        case Node.DOCUMENT_TYPE_NODE:
            // (X)HTML documents are identified by public identifiers
            html += "<!DOCTYPE " + node.name + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '') + (!node.publicId && node.systemId ? ' SYSTEM' : '') + (node.systemId ? ' "' + node.systemId + '"' : '') + '>\n';
            break;
        }
        node = node.nextSibling;
    }
    return html;
}

function isEmptyOrSpaces(str) {
  return str === null || str.match(/^\s*$/) !== null;
}