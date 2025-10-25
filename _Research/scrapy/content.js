// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    // Get the filter settings or use defaults (all enabled)
    const filters = message.filters || {
      headings: true,
      paragraphs: true,
      images: true,
      links: true,
      tables: true,
      lists: true,
      forms: true,
      meta: true
    };
    
    // Get the advanced settings or use defaults
    const advanced = message.advanced || {
      selectorType: 'css',
      customSelector: '',
      cleanWhitespace: true,
      cleanHtml: false,
      normalizeText: false,
      enablePagination: false,
      paginationSelector: '',
      maxPages: 5,
      paginationDelay: 1000
    };
    
    // Get schema if provided
    const schema = message.schema || null;
    
    // Start the scraping process
    if (advanced.enablePagination && advanced.paginationSelector) {
      // If pagination is enabled, start pagination scraping
      startPaginationScrape(filters, advanced, schema)
        .then(data => sendResponse({ data }))
        .catch(error => {
          console.error('Pagination scraping error:', error);
          sendResponse({ error: error.message });
        });
    } else {
      // Regular single-page scrape
      const scrapedData = scrapePageData(filters, advanced, schema);
      sendResponse({ data: scrapedData });
    }
  }
  // This return true is important for asynchronous response
  return true;
});

/**
 * Start a pagination scrape
 * @param {Object} filters - The data types to include in the scrape
 * @param {Object} advanced - Advanced scraping settings
 * @param {Array} schema - Optional schema definition
 */
async function startPaginationScrape(filters, advanced, schema) {
  // Initialize pagination data
  let pagesScraped = 1;
  let hasNextPage = true;
  
  // Get the first page data
  const allData = scrapePageData(filters, advanced, schema);
  
  // Initialize pagination info
  allData.paginationInfo = {
    pagesScraped: 1,
    startUrl: window.location.href
  };
  
  // Add unique identifiers to all data lists to avoid duplicates
  addUniqueIds(allData);
  
  // Define a function to check if we have a next page
  const getNextPageUrl = () => {
    try {
      // Use the pagination selector to find the next page link
      let nextPageElement;
      if (advanced.selectorType === 'xpath') {
        const result = document.evaluate(
          advanced.paginationSelector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        nextPageElement = result.singleNodeValue;
      } else {
        // Default to CSS selector
        nextPageElement = document.querySelector(advanced.paginationSelector);
      }
      
      if (nextPageElement && nextPageElement.href) {
        return nextPageElement.href;
      }
    } catch (error) {
      console.error('Error finding next page:', error);
    }
    return null;
  };
  
  // Process each next page until no more pages or max pages reached
  while (hasNextPage && pagesScraped < advanced.maxPages) {
    // Get the next page URL
    const nextPageUrl = getNextPageUrl();
    
    if (!nextPageUrl) {
      hasNextPage = false;
      break;
    }
    
    // Navigate to the next page
    const originalUrl = window.location.href;
    window.location.href = nextPageUrl;
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, advanced.paginationDelay));
    
    // Check if we've actually navigated (sometimes pagination doesn't work)
    if (window.location.href === originalUrl) {
      hasNextPage = false;
      break;
    }
    
    // Scrape the new page
    const pageData = scrapePageData(filters, advanced, schema);
    
    // Add unique identifiers and merge with existing data
    addUniqueIds(pageData);
    mergePageData(allData, pageData);
    
    // Increment counter
    pagesScraped++;
    allData.paginationInfo.pagesScraped = pagesScraped;
  }
  
  return allData;
}

/**
 * Add unique IDs to all data items
 * @param {Object} data - The scraped data
 */
function addUniqueIds(data) {
  // Add IDs to text content
  if (data.textContent) {
    if (data.textContent.headings) {
      data.textContent.headings.forEach((item, index) => {
        item.id = `heading_${Date.now()}_${index}`;
      });
    }
    if (data.textContent.paragraphs) {
      data.textContent.paragraphs.forEach((item, index) => {
        item.id = `paragraph_${Date.now()}_${index}`;
      });
    }
  }
  
  // Add IDs to other data types
  ['images', 'links', 'tables', 'lists', 'forms'].forEach(type => {
    if (data[type]) {
      data[type].forEach((item, index) => {
        item.id = `${type.slice(0, -1)}_${Date.now()}_${index}`;
      });
    }
  });
}

/**
 * Merge data from multiple pages
 * @param {Object} targetData - The accumulated data
 * @param {Object} newPageData - The new page data to merge
 */
function mergePageData(targetData, newPageData) {
  // Skip pageInfo and paginationInfo
  
  // Merge textContent
  if (newPageData.textContent) {
    if (!targetData.textContent) {
      targetData.textContent = {};
    }
    
    ['headings', 'paragraphs', 'articleText', 'other'].forEach(type => {
      if (newPageData.textContent[type]) {
        if (!targetData.textContent[type]) {
          targetData.textContent[type] = [];
        }
        targetData.textContent[type] = targetData.textContent[type].concat(newPageData.textContent[type]);
      }
    });
  }
  
  // Merge other data types
  ['images', 'links', 'tables', 'lists', 'forms'].forEach(type => {
    if (newPageData[type]) {
      if (!targetData[type]) {
        targetData[type] = [];
      }
      targetData[type] = targetData[type].concat(newPageData[type]);
    }
  });
  
  // Merge schema data if present
  if (newPageData.schemaData) {
    if (!targetData.schemaData) {
      targetData.schemaData = [];
    }
    targetData.schemaData = targetData.schemaData.concat(newPageData.schemaData);
  }
}

/**
 * Scrape data from the current page
 * @param {Object} filters - The data types to include in the scrape
 * @param {Object} advanced - Advanced scraping settings
 * @param {Array} schema - Optional schema definition
 * @returns {Object} Scraped data
 */
function scrapePageData(filters, advanced, schema) {
  // Always include page info
  const data = {
    pageInfo: {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString()
    }
  };
  
  // If a custom selector is provided, use it to scrape specific elements
  if (advanced?.customSelector) {
    data.customElements = getCustomElements(advanced.customSelector, advanced.selectorType);
  }
  
  // If a schema is provided, use it to extract structured data
  if (schema && schema.length > 0) {
    data.schemaData = extractSchemaData(schema, advanced);
  }
  
  // Only include the data types that are selected in filters
  if (filters.meta) {
    data.meta = getMetaData();
  }
  
  if (filters.headings || filters.paragraphs) {
    data.textContent = getTextContent(filters, advanced);
  }
  
  if (filters.images) {
    data.images = getImages(advanced);
  }
  
  if (filters.links) {
    data.links = getLinks(advanced);
  }
  
  if (filters.tables) {
    data.tables = getTables(advanced);
  }
  
  if (filters.lists) {
    data.lists = getLists(advanced);
  }
  
  if (filters.forms) {
    data.forms = getForms(advanced);
  }
  
  return data;
}

/**
 * Extract structured data according to a schema
 * @param {Array} schema - Schema definition
 * @param {Object} advanced - Advanced settings
 * @returns {Array} Structured data objects
 */
function extractSchemaData(schema, advanced) {
  const results = [];
  
  // Check if the schema is for a collection of items or a single item
  const selectorGroups = {};
  
  // Group fields by their common parent selectors
  schema.forEach(field => {
    // Extract the parent part of the selector if it exists
    let parentSelector = '';
    if (field.selector.includes(' > ')) {
      parentSelector = field.selector.split(' > ')[0];
    }
    
    if (!selectorGroups[parentSelector]) {
      selectorGroups[parentSelector] = [];
    }
    selectorGroups[parentSelector].push(field);
  });
  
  // Process each selector group
  Object.keys(selectorGroups).forEach(parentSelector => {
    const fields = selectorGroups[parentSelector];
    
    // If there's a parent selector, find all matching elements
    let parentElements = [document]; // Default to entire document
    
    if (parentSelector) {
      try {
        if (advanced.selectorType === 'xpath') {
          const xpathResult = document.evaluate(
            parentSelector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          
          parentElements = [];
          for (let i = 0; i < xpathResult.snapshotLength; i++) {
            parentElements.push(xpathResult.snapshotItem(i));
          }
        } else {
          parentElements = document.querySelectorAll(parentSelector);
        }
      } catch (error) {
        console.error(`Error with parent selector ${parentSelector}:`, error);
        return;
      }
    }
    
    // For each parent element, extract all fields
    Array.from(parentElements).forEach(parent => {
      const dataItem = {};
      
      // Extract each field
      fields.forEach(field => {
        try {
          let fieldValue;
          let elements;
          
          // The full selector or the relative part if using a parent
          const selector = parentSelector ? 
            field.selector.replace(`${parentSelector} > `, '') : 
            field.selector;
          
          // Get elements using the appropriate selector type
          if (advanced.selectorType === 'xpath') {
            const xpathResult = document.evaluate(
              selector,
              parent,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
            );
            
            elements = [];
            for (let i = 0; i < xpathResult.snapshotLength; i++) {
              elements.push(xpathResult.snapshotItem(i));
            }
          } else {
            elements = parent.querySelectorAll(selector);
          }
          
          if (elements.length === 1) {
            // Single element
            fieldValue = extractElementValue(elements[0], field.type, advanced);
          } else if (elements.length > 1) {
            // Multiple elements - create an array
            fieldValue = Array.from(elements).map(el => 
              extractElementValue(el, field.type, advanced)
            );
          }
          
          if (fieldValue !== undefined) {
            dataItem[field.name] = fieldValue;
          }
        } catch (error) {
          console.error(`Error extracting field ${field.name}:`, error);
        }
      });
      
      // Only add non-empty items
      if (Object.keys(dataItem).length > 0) {
        results.push(dataItem);
      }
    });
  });
  
  return results;
}

/**
 * Extract value from an element based on the field type
 * @param {Element} element - The DOM element
 * @param {string} type - Field type
 * @param {Object} advanced - Advanced settings
 * @returns {*} Extracted value
 */
function extractElementValue(element, type, advanced) {
  let value;
  
  switch (type) {
    case 'text':
      value = element.textContent;
      break;
    case 'number':
      value = parseFloat(element.textContent);
      if (isNaN(value)) value = null;
      break;
    case 'date':
      value = element.textContent;
      // Try to parse as a date if it looks like one
      if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Keep original text if parsing fails
        }
      }
      break;
    case 'boolean':
      value = !!element.textContent.trim();
      break;
    case 'url':
      if (element.tagName === 'A') {
        value = element.href;
      } else if (element.tagName === 'IMG') {
        value = element.src;
      } else {
        // Try to find a URL in the text
        const urlMatch = element.textContent.match(/https?:\/\/[^\s]+/);
        value = urlMatch ? urlMatch[0] : element.textContent;
      }
      break;
    case 'image':
      if (element.tagName === 'IMG') {
        value = element.src;
      } else {
        // Try to find an img child
        const img = element.querySelector('img');
        value = img ? img.src : null;
      }
      break;
    default:
      value = element.textContent;
  }
  
  // Apply data cleaning options
  if (value && typeof value === 'string') {
    value = cleanText(value, advanced);
  }
  
  return value;
}

/**
 * Clean text based on advanced settings
 * @param {string} text - The text to clean
 * @param {Object} advanced - Advanced settings
 * @returns {string} Cleaned text
 */
function cleanText(text, advanced) {
  if (!advanced) return text;
  
  let cleanedText = text;
  
  // Remove excess whitespace
  if (advanced.cleanWhitespace) {
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  }
  
  // Strip HTML tags
  if (advanced.cleanHtml) {
    cleanedText = cleanedText.replace(/<[^>]*>/g, '');
  }
  
  // Normalize text (lowercase, remove accents)
  if (advanced.normalizeText) {
    cleanedText = cleanedText.toLowerCase();
    // Remove accents
    cleanedText = cleanedText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  return cleanedText;
}

/**
 * Get custom elements using a selector
 * @param {string} selector - CSS or XPath selector
 * @param {string} selectorType - 'css' or 'xpath'
 * @returns {Array} Custom elements
 */
function getCustomElements(selector, selectorType) {
  const elements = [];
  
  try {
    let matchedElements;
    
    if (selectorType === 'xpath') {
      // Use XPath
      const result = document.evaluate(
        selector,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      
      matchedElements = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        matchedElements.push(result.snapshotItem(i));
      }
    } else {
      // Default to CSS
      matchedElements = document.querySelectorAll(selector);
    }
    
    if (matchedElements.length === 0) {
      return [];
    }
    
    // Process each element
    Array.from(matchedElements).forEach(element => {
      elements.push({
        tagName: element.tagName,
        textContent: element.textContent.trim(),
        attributes: getElementAttributes(element),
        html: element.outerHTML
      });
    });
  } catch (error) {
    console.error('Error getting custom elements:', error);
  }
  
  return elements;
}

/**
 * Get all attributes of an element
 * @param {Element} element - DOM element
 * @returns {Object} Attributes
 */
function getElementAttributes(element) {
  const attributes = {};
  
  if (element.hasAttributes()) {
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }
  }
  
  return attributes;
}

/**
 * Get metadata from the page
 */
function getMetaData() {
  const metaTags = document.querySelectorAll('meta');
  const metaData = {};
  
  metaTags.forEach(tag => {
    const name = tag.getAttribute('name') || tag.getAttribute('property');
    const content = tag.getAttribute('content');
    
    if (name && content) {
      metaData[name] = content;
    }
  });
  
  return metaData;
}

/**
 * Get text content from the page with improved organization
 * @param {Object} filters - The text types to include
 * @param {Object} advanced - Advanced settings for cleaning
 */
function getTextContent(filters, advanced) {
  // Process text by sections (main content, headers, etc.)
  const result = {};

  // Only include headings if the filter is enabled
  if (filters.headings) {
    result.headings = [];
    // Get headings for structure
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      const text = heading.textContent.trim();
      if (text) {
        result.headings.push({
          level: heading.tagName.toLowerCase(),
          text: advanced ? cleanText(text, advanced) : text
        });
      }
    });
  }

  // Only include paragraphs if the filter is enabled
  if (filters.paragraphs) {
    result.paragraphs = [];
    result.articleText = [];
    result.other = [];
    
    // Get main content paragraphs
    const mainContent = document.querySelector('main, article, #content, .content, .main');
    let paragraphs;

    if (mainContent) {
      // If we found a main content container, get paragraphs from it
      paragraphs = mainContent.querySelectorAll('p');
    } else {
      // Otherwise get all paragraphs
      paragraphs = document.querySelectorAll('p');
    }

    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text) {
        result.paragraphs.push({
          text: advanced ? cleanText(text, advanced) : text
        });
      }
    });

    // Get article text (may include lists and other block elements)
    const articleElements = document.querySelectorAll('article p, article li, article blockquote');
    articleElements.forEach(element => {
      const text = element.textContent.trim();
      if (text && !element.closest('header, footer, nav')) {
        result.articleText.push({
          type: element.tagName.toLowerCase(),
          text: advanced ? cleanText(text, advanced) : text
        });
      }
    });

    // Process other significant text that isn't a paragraph or heading
    const textContainers = document.querySelectorAll('div, section, aside');
    const processedTextNodes = new Set();
    
    textContainers.forEach(container => {
      // Skip if it's a container we already processed or has few words
      if (container.closest('header, footer, nav') || container.querySelectorAll('p, h1, h2, h3, h4, h5, h6').length > 0) {
        return;
      }
      
      // Get direct text from this container
      const textNodes = Array.from(container.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
      
      textNodes.forEach(node => {
        const text = node.textContent.trim();
        if (text && !processedTextNodes.has(node) && text.split(/\s+/).length > 3) {
          processedTextNodes.add(node);
          result.other.push({
            containerType: container.tagName.toLowerCase(),
            text: advanced ? cleanText(text, advanced) : text
          });
        }
      });
    });
  }

  return result;
}

/**
 * Check if an element has only element children (no text nodes)
 */
function hasOnlyElementChildren(element) {
  let hasText = false;
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      hasText = true;
      break;
    }
  }
  return !hasText && element.childElementCount > 0;
}

/**
 * Get images from the page
 * @param {Object} advanced - Advanced settings
 */
function getImages(advanced) {
  const imgElements = document.querySelectorAll('img');
  const images = [];
  
  imgElements.forEach(img => {
    if (img.src && !img.src.startsWith('data:') && img.width > 20 && img.height > 20) {
      const imageData = {
        src: img.src,
        alt: img.alt || '',
        width: img.width,
        height: img.height
      };
      
      // Clean alt text if needed
      if (advanced && imageData.alt) {
        imageData.alt = cleanText(imageData.alt, advanced);
      }
      
      images.push(imageData);
    }
  });
  
  return images;
}

/**
 * Get links from the page
 * @param {Object} advanced - Advanced settings
 */
function getLinks(advanced) {
  const linkElements = document.querySelectorAll('a[href]');
  const links = [];
  
  linkElements.forEach(link => {
    if (link.href && !link.href.startsWith('javascript:') && link.href !== '#') {
      const text = link.textContent.trim();
      
      if (text) {
        const linkData = {
          href: link.href,
          text: advanced ? cleanText(text, advanced) : text,
          title: link.title || ''
        };
        
        // Clean title if needed
        if (advanced && linkData.title) {
          linkData.title = cleanText(linkData.title, advanced);
        }
        
        links.push(linkData);
      }
    }
  });
  
  return links;
}

/**
 * Get tables from the page
 * @param {Object} advanced - Advanced settings
 */
function getTables(advanced) {
  const tableElements = document.querySelectorAll('table');
  const tables = [];
  
  tableElements.forEach(table => {
    // Skip very small tables or those likely to be for layout
    if (table.rows.length < 2 && table.rows.length > 0 && table.rows[0].cells.length < 2) {
      return;
    }
    
    const tableData = {
      headers: [],
      rows: []
    };
    
    // Get table headers
    const headerCells = table.querySelectorAll('th');
    if (headerCells.length > 0) {
      headerCells.forEach(header => {
        const headerText = header.textContent.trim();
        tableData.headers.push(advanced ? cleanText(headerText, advanced) : headerText);
      });
    } else if (table.rows.length > 0) {
      // If no explicit headers, use first row as headers
      const firstRow = table.rows[0];
      Array.from(firstRow.cells).forEach(cell => {
        const cellText = cell.textContent.trim();
        tableData.headers.push(advanced ? cleanText(cellText, advanced) : cellText);
      });
    }
    
    // Get table rows (skip first row if we used it as headers)
    const startRow = (headerCells.length === 0 && table.rows.length > 0) ? 1 : 0;
    
    for (let i = startRow; i < table.rows.length; i++) {
      const row = table.rows[i];
      const rowData = [];
      
      Array.from(row.cells).forEach(cell => {
        const cellText = cell.textContent.trim();
        rowData.push(advanced ? cleanText(cellText, advanced) : cellText);
      });
      
      tableData.rows.push(rowData);
    }
    
    tables.push(tableData);
  });
  
  return tables;
}

/**
 * Get lists from the page
 * @param {Object} advanced - Advanced settings
 */
function getLists(advanced) {
  const listElements = document.querySelectorAll('ul, ol');
  const lists = [];
  
  listElements.forEach(list => {
    const listItems = list.querySelectorAll('li');
    
    // Skip empty lists
    if (listItems.length === 0) {
      return;
    }
    
    const listData = {
      type: list.tagName.toLowerCase(),
      items: []
    };
    
    listItems.forEach(item => {
      const itemText = item.textContent.trim();
      if (itemText) {
        listData.items.push(advanced ? cleanText(itemText, advanced) : itemText);
      }
    });
    
    if (listData.items.length > 0) {
      lists.push(listData);
    }
  });
  
  return lists;
}

/**
 * Get forms from the page
 * @param {Object} advanced - Advanced settings
 */
function getForms(advanced) {
  const formElements = document.querySelectorAll('form');
  const forms = [];
  
  formElements.forEach(form => {
    const formData = {
      action: form.action || '',
      method: form.method || '',
      fields: []
    };
    
    // Get form fields
    const formFields = form.querySelectorAll('input, select, textarea');
    
    formFields.forEach(field => {
      // Skip password fields for privacy
      if (field.type === 'password') {
        return;
      }
      
      const fieldData = {
        type: field.type || field.tagName.toLowerCase(),
        name: field.name || '',
        id: field.id || '',
        placeholder: field.placeholder || ''
      };
      
      // Clean placeholder if needed
      if (advanced && fieldData.placeholder) {
        fieldData.placeholder = cleanText(fieldData.placeholder, advanced);
      }
      
      // Get label if available
      if (field.id) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) {
          fieldData.label = advanced ? cleanText(label.textContent.trim(), advanced) : label.textContent.trim();
        }
      }
      
      formData.fields.push(fieldData);
    });
    
    forms.push(formData);
  });
  
  return forms;
} 