// DOM elements
const scrapeButton = document.getElementById('scrapeButton');
const downloadButton = document.getElementById('downloadButton');
const deleteButton = document.getElementById('deleteButton');
const formatSelect = document.getElementById('format');
const statusElement = document.getElementById('status');
const themeToggle = document.getElementById('themeToggle');
const dataStats = document.getElementById('dataStats');
const savedSites = document.getElementById('savedSites');
const sitesList = document.getElementById('sitesList');
const toggleFiltersButton = document.getElementById('toggleFilters');
const filterOptionsPanel = document.getElementById('filterOptions');

// Tabs and advanced settings
const tabButtons = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Advanced tab elements
const selectorTypeSelect = document.getElementById('selectorType');
const customSelectorInput = document.getElementById('customSelector');
const cleanWhitespaceCheck = document.getElementById('cleanWhitespace');
const cleanHtmlCheck = document.getElementById('cleanHtml');
const normalizeTextCheck = document.getElementById('normalizeText');
const enablePaginationCheck = document.getElementById('enablePagination');
const paginationSelectorInput = document.getElementById('paginationSelector');
const maxPagesInput = document.getElementById('maxPages');
const paginationDelayInput = document.getElementById('paginationDelay');

// Schema tab elements
const schemaFieldInput = document.getElementById('schemaField');
const schemaTypeSelect = document.getElementById('schemaType');
const schemaSelectorInput = document.getElementById('schemaSelector');
const addSchemaFieldButton = document.getElementById('addSchemaField');
const schemaFieldsContainer = document.getElementById('schemaFields');
const schemaPreviewArea = document.getElementById('schemaPreview');

// Export & Templates tab elements
const apiEndpointInput = document.getElementById('apiEndpoint');
const apiMethodSelect = document.getElementById('apiMethod');
const apiHeadersInput = document.getElementById('apiHeaders');
const testApiButton = document.getElementById('testApiButton');
const sendToApiButton = document.getElementById('sendToApiButton');
const templateNameInput = document.getElementById('templateName');
const templateDescriptionInput = document.getElementById('templateDescription');
const includeFiltersCheck = document.getElementById('includeFilters');
const includeAdvancedCheck = document.getElementById('includeAdvanced');
const includeSchemaCheck = document.getElementById('includeSchema');
const saveTemplateButton = document.getElementById('saveTemplateButton');
const deleteTemplateButton = document.getElementById('deleteTemplateButton');
const loadTemplateSelect = document.getElementById('loadTemplate');
const loadTemplateButton = document.getElementById('loadTemplateButton');

// Filter checkboxes
const filterHeadings = document.getElementById('filterHeadings');
const filterParagraphs = document.getElementById('filterParagraphs');
const filterImages = document.getElementById('filterImages');
const filterLinks = document.getElementById('filterLinks');
const filterTables = document.getElementById('filterTables');
const filterLists = document.getElementById('filterLists');
const filterForms = document.getElementById('filterForms');
const filterMeta = document.getElementById('filterMeta');

// Store scraped data and current page
let scrapedData = null;
let allSitesData = {};
let currentUrl = '';
let currentSiteName = '';
let schemaFields = [];
let templates = {};
let apiSettings = {
  endpoint: '',
  method: 'POST',
  headers: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme preference
  initTheme();
  
  // Set up filter toggle
  toggleFiltersButton.addEventListener('click', () => {
    filterOptionsPanel.classList.toggle('open');
    toggleFiltersButton.classList.toggle('open');
  });
  
  // Set up tab functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Hide all tab contents
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      
      // Remove active class from all tab buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Show corresponding tab content
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  
  // Set up pagination checkbox to enable/disable related inputs
  enablePaginationCheck.addEventListener('change', () => {
    paginationSelectorInput.disabled = !enablePaginationCheck.checked;
    maxPagesInput.disabled = !enablePaginationCheck.checked;
    paginationDelayInput.disabled = !enablePaginationCheck.checked;
  });
  
  // Set up schema field adding
  addSchemaFieldButton.addEventListener('click', addSchemaField);
  
  // Set up API integration buttons
  testApiButton.addEventListener('click', testApiConnection);
  sendToApiButton.addEventListener('click', sendDataToApi);
  
  // Set up template buttons
  saveTemplateButton.addEventListener('click', saveTemplate);
  loadTemplateButton.addEventListener('click', loadSelectedTemplate);
  deleteTemplateButton.addEventListener('click', deleteSelectedTemplate);
  
  // Enable/disable load template button based on selection
  loadTemplateSelect.addEventListener('change', () => {
    loadTemplateButton.disabled = !loadTemplateSelect.value;
    deleteTemplateButton.disabled = !loadTemplateSelect.value;
  });
  
  // Update schema preview
  updateSchemaPreview();
  
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    currentUrl = new URL(tab.url).hostname;
    currentSiteName = tab.title || currentUrl;
  }
  
  // Load stored data
  try {
    const result = await chrome.storage.local.get([
      'allSitesData', 
      'theme', 
      'filterSettings', 
      'advancedSettings',
      'schemaFields',
      'templates',
      'apiSettings'
    ]);
    
    // Set theme
    if (result.theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      themeToggle.checked = true;
    }
    
    // Restore filter settings
    if (result.filterSettings) {
      filterHeadings.checked = result.filterSettings.headings ?? true;
      filterParagraphs.checked = result.filterSettings.paragraphs ?? true;
      filterImages.checked = result.filterSettings.images ?? true;
      filterLinks.checked = result.filterSettings.links ?? true;
      filterTables.checked = result.filterSettings.tables ?? true;
      filterLists.checked = result.filterSettings.lists ?? true;
      filterForms.checked = result.filterSettings.forms ?? true;
      filterMeta.checked = result.filterSettings.meta ?? true;
    }
    
    // Restore advanced settings
    if (result.advancedSettings) {
      selectorTypeSelect.value = result.advancedSettings.selectorType || 'css';
      customSelectorInput.value = result.advancedSettings.customSelector || '';
      cleanWhitespaceCheck.checked = result.advancedSettings.cleanWhitespace ?? true;
      cleanHtmlCheck.checked = result.advancedSettings.cleanHtml ?? false;
      normalizeTextCheck.checked = result.advancedSettings.normalizeText ?? false;
      enablePaginationCheck.checked = result.advancedSettings.enablePagination ?? false;
      paginationSelectorInput.value = result.advancedSettings.paginationSelector || '';
      maxPagesInput.value = result.advancedSettings.maxPages || 5;
      paginationDelayInput.value = result.advancedSettings.paginationDelay || 1000;
      
      // Update pagination input states
      paginationSelectorInput.disabled = !enablePaginationCheck.checked;
      maxPagesInput.disabled = !enablePaginationCheck.checked;
      paginationDelayInput.disabled = !enablePaginationCheck.checked;
    }
    
    // Restore schema fields
    if (result.schemaFields) {
      schemaFields = result.schemaFields;
      renderSchemaFields();
      updateSchemaPreview();
    }
    
    // Restore templates
    if (result.templates) {
      templates = result.templates;
      updateTemplatesList();
    }
    
    // Restore API settings
    if (result.apiSettings) {
      apiSettings = result.apiSettings;
      apiEndpointInput.value = apiSettings.endpoint || '';
      apiMethodSelect.value = apiSettings.method || 'POST';
      
      if (apiSettings.headers) {
        try {
          apiHeadersInput.value = JSON.stringify(apiSettings.headers, null, 2);
        } catch (e) {
          apiHeadersInput.value = '{}';
        }
      }
    }
    
    if (result.allSitesData) {
      allSitesData = result.allSitesData;
      
      // Update UI based on stored data
      updateSitesList();
      
      // Check if we have data for the current site
      if (currentUrl && allSitesData[currentUrl]) {
        scrapedData = allSitesData[currentUrl].data;
        downloadButton.disabled = false;
        deleteButton.style.display = 'block';
        
        // Update stats
        updateDataStats();
        
        // Add preview toggle if we have data
        addPreviewToggle();
        
        statusElement.textContent = `Data loaded for ${currentSiteName}`;
      }
    }
  } catch (error) {
    console.error('Error loading stored data:', error);
  }
});

// Theme toggle functionality
themeToggle.addEventListener('change', () => {
  if (themeToggle.checked) {
    document.body.setAttribute('data-theme', 'dark');
    chrome.storage.local.set({ theme: 'dark' });
  } else {
    document.body.removeAttribute('data-theme');
    chrome.storage.local.set({ theme: 'light' });
  }
});

// Save filter settings
function saveFilterSettings() {
  const filterSettings = {
    headings: filterHeadings.checked,
    paragraphs: filterParagraphs.checked,
    images: filterImages.checked,
    links: filterLinks.checked,
    tables: filterTables.checked,
    lists: filterLists.checked,
    forms: filterForms.checked,
    meta: filterMeta.checked
  };
  
  chrome.storage.local.set({ filterSettings });
  return filterSettings;
}

// Save advanced settings
function saveAdvancedSettings() {
  const advancedSettings = {
    selectorType: selectorTypeSelect.value,
    customSelector: customSelectorInput.value,
    cleanWhitespace: cleanWhitespaceCheck.checked,
    cleanHtml: cleanHtmlCheck.checked,
    normalizeText: normalizeTextCheck.checked,
    enablePagination: enablePaginationCheck.checked,
    paginationSelector: paginationSelectorInput.value,
    maxPages: parseInt(maxPagesInput.value, 10),
    paginationDelay: parseInt(paginationDelayInput.value, 10)
  };
  
  chrome.storage.local.set({ advancedSettings });
  return advancedSettings;
}

// Save API settings
function saveApiSettings() {
  let headers = {};
  
  try {
    headers = JSON.parse(apiHeadersInput.value);
  } catch (error) {
    console.error('Invalid JSON in headers:', error);
    statusElement.textContent = 'Error: Invalid JSON in headers field';
    return null;
  }
  
  apiSettings = {
    endpoint: apiEndpointInput.value.trim(),
    method: apiMethodSelect.value,
    headers: headers
  };
  
  chrome.storage.local.set({ apiSettings });
  return apiSettings;
}

// Test API connection
async function testApiConnection() {
  const settings = saveApiSettings();
  
  if (!settings || !settings.endpoint) {
    statusElement.textContent = 'Please enter a valid API endpoint';
    return;
  }
  
  statusElement.textContent = 'Testing API connection...';
  
  try {
    // Create a minimal test payload
    const testData = {
      test: true,
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(settings.endpoint, {
      method: settings.method,
      headers: settings.headers,
      body: JSON.stringify(testData)
    });
    
    if (response.ok) {
      statusElement.textContent = `Connection successful: ${response.status} ${response.statusText}`;
    } else {
      statusElement.textContent = `Connection failed: ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    console.error('API connection error:', error);
    statusElement.textContent = `Connection error: ${error.message}`;
  }
}

// Send data to API
async function sendDataToApi() {
  const settings = saveApiSettings();
  
  if (!settings || !settings.endpoint) {
    statusElement.textContent = 'Please enter a valid API endpoint';
    return;
  }
  
  if (!scrapedData) {
    statusElement.textContent = 'No data to send. Please scrape data first.';
    return;
  }
  
  statusElement.textContent = 'Sending data to API...';
  
  try {
    const response = await fetch(settings.endpoint, {
      method: settings.method,
      headers: settings.headers,
      body: JSON.stringify(scrapedData)
    });
    
    if (response.ok) {
      statusElement.textContent = `Data sent successfully: ${response.status} ${response.statusText}`;
    } else {
      statusElement.textContent = `Failed to send data: ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    console.error('Error sending data to API:', error);
    statusElement.textContent = `Error: ${error.message}`;
  }
}

// Save a scraping template
function saveTemplate() {
  const name = templateNameInput.value.trim();
  
  if (!name) {
    statusElement.textContent = 'Please enter a template name';
    return;
  }
  
  // Collect settings based on user selections
  const template = {
    name: name,
    description: templateDescriptionInput.value.trim(),
    timestamp: new Date().toISOString()
  };
  
  if (includeFiltersCheck.checked) {
    template.filters = {
      headings: filterHeadings.checked,
      paragraphs: filterParagraphs.checked,
      images: filterImages.checked,
      links: filterLinks.checked,
      tables: filterTables.checked,
      lists: filterLists.checked,
      forms: filterForms.checked,
      meta: filterMeta.checked
    };
  }
  
  if (includeAdvancedCheck.checked) {
    template.advanced = {
      selectorType: selectorTypeSelect.value,
      customSelector: customSelectorInput.value,
      cleanWhitespace: cleanWhitespaceCheck.checked,
      cleanHtml: cleanHtmlCheck.checked,
      normalizeText: normalizeTextCheck.checked,
      enablePagination: enablePaginationCheck.checked,
      paginationSelector: paginationSelectorInput.value,
      maxPages: parseInt(maxPagesInput.value, 10),
      paginationDelay: parseInt(paginationDelayInput.value, 10)
    };
  }
  
  if (includeSchemaCheck.checked && schemaFields.length > 0) {
    template.schema = [...schemaFields];
  }
  
  // Add to templates collection
  templates[name] = template;
  
  // Save to storage
  chrome.storage.local.set({ templates }, () => {
    statusElement.textContent = `Template "${name}" saved`;
    templateNameInput.value = '';
    templateDescriptionInput.value = '';
    updateTemplatesList();
  });
}

// Update the templates dropdown list
function updateTemplatesList() {
  // Clear existing options (except first)
  while (loadTemplateSelect.options.length > 1) {
    loadTemplateSelect.remove(1);
  }
  
  // Add templates as options
  const templateNames = Object.keys(templates).sort();
  
  if (templateNames.length === 0) {
    loadTemplateButton.disabled = true;
    deleteTemplateButton.disabled = true;
    return;
  }
  
  templateNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    
    if (templates[name].description) {
      option.textContent += ` (${templates[name].description})`;
    }
    
    loadTemplateSelect.appendChild(option);
  });
}

// Load the selected template
function loadSelectedTemplate() {
  const templateName = loadTemplateSelect.value;
  
  if (!templateName || !templates[templateName]) {
    return;
  }
  
  const template = templates[templateName];
  
  // Apply filter settings if included
  if (template.filters) {
    filterHeadings.checked = template.filters.headings ?? true;
    filterParagraphs.checked = template.filters.paragraphs ?? true;
    filterImages.checked = template.filters.images ?? true;
    filterLinks.checked = template.filters.links ?? true;
    filterTables.checked = template.filters.tables ?? true;
    filterLists.checked = template.filters.lists ?? true;
    filterForms.checked = template.filters.forms ?? true;
    filterMeta.checked = template.filters.meta ?? true;
    
    saveFilterSettings();
  }
  
  // Apply advanced settings if included
  if (template.advanced) {
    selectorTypeSelect.value = template.advanced.selectorType || 'css';
    customSelectorInput.value = template.advanced.customSelector || '';
    cleanWhitespaceCheck.checked = template.advanced.cleanWhitespace ?? true;
    cleanHtmlCheck.checked = template.advanced.cleanHtml ?? false;
    normalizeTextCheck.checked = template.advanced.normalizeText ?? false;
    enablePaginationCheck.checked = template.advanced.enablePagination ?? false;
    paginationSelectorInput.value = template.advanced.paginationSelector || '';
    maxPagesInput.value = template.advanced.maxPages || 5;
    paginationDelayInput.value = template.advanced.paginationDelay || 1000;
    
    // Update pagination input states
    paginationSelectorInput.disabled = !enablePaginationCheck.checked;
    maxPagesInput.disabled = !enablePaginationCheck.checked;
    paginationDelayInput.disabled = !enablePaginationCheck.checked;
    
    saveAdvancedSettings();
  }
  
  // Apply schema if included
  if (template.schema && template.schema.length > 0) {
    schemaFields = [...template.schema];
    renderSchemaFields();
    updateSchemaPreview();
    saveSchemaFields();
  }
  
  statusElement.textContent = `Template "${templateName}" loaded`;
  
  // Show the appropriate tab based on what was loaded
  if (template.advanced) {
    document.querySelector('.tab[data-tab="advanced"]').click();
  } else if (template.schema) {
    document.querySelector('.tab[data-tab="schema"]').click();
  } else {
    document.querySelector('.tab[data-tab="basic"]').click();
  }
}

// Delete the selected template
function deleteSelectedTemplate() {
  const templateName = loadTemplateSelect.value;
  
  if (!templateName || !templates[templateName]) {
    return;
  }
  
  // Ask for confirmation
  if (confirm(`Delete template "${templateName}"?`)) {
    delete templates[templateName];
    
    // Save to storage
    chrome.storage.local.set({ templates }, () => {
      statusElement.textContent = `Template "${templateName}" deleted`;
      updateTemplatesList();
    });
  }
}

// Save schema fields
function saveSchemaFields() {
  chrome.storage.local.set({ schemaFields });
  return schemaFields;
}

// Add a new schema field
function addSchemaField() {
  const fieldName = schemaFieldInput.value.trim();
  const fieldType = schemaTypeSelect.value;
  const fieldSelector = schemaSelectorInput.value.trim();
  
  if (!fieldName || !fieldSelector) {
    statusElement.textContent = 'Please enter both field name and selector';
    return;
  }
  
  // Add the field to our schema
  schemaFields.push({
    name: fieldName,
    type: fieldType,
    selector: fieldSelector
  });
  
  // Reset inputs
  schemaFieldInput.value = '';
  schemaSelectorInput.value = '';
  
  // Save and render
  saveSchemaFields();
  renderSchemaFields();
  updateSchemaPreview();
  
  statusElement.textContent = `Added field "${fieldName}" to schema`;
}

// Render schema fields as chips
function renderSchemaFields() {
  // Clear the container
  const noSchemaText = document.getElementById('noSchemaText');
  
  if (schemaFields.length === 0) {
    if (!noSchemaText) {
      const infoText = document.createElement('div');
      infoText.id = 'noSchemaText';
      infoText.className = 'info-text';
      infoText.textContent = 'No schema fields defined yet';
      schemaFieldsContainer.appendChild(infoText);
    }
    return;
  }
  
  // Remove the "no fields" message if it exists
  if (noSchemaText) {
    noSchemaText.remove();
  }
  
  // Clear container
  schemaFieldsContainer.innerHTML = '';
  
  // Add each field as a chip
  schemaFields.forEach((field, index) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `
      <span>${field.name} (${field.type})</span>
      <span class="remove" title="Remove field">×</span>
    `;
    
    // Add remove handler
    chip.querySelector('.remove').addEventListener('click', () => {
      schemaFields.splice(index, 1);
      saveSchemaFields();
      renderSchemaFields();
      updateSchemaPreview();
    });
    
    schemaFieldsContainer.appendChild(chip);
  });
}

// Update the schema preview textarea
function updateSchemaPreview() {
  if (schemaFields.length === 0) {
    schemaPreviewArea.value = '{}';
    return;
  }
  
  const schemaObject = {};
  schemaFields.forEach(field => {
    // Generate a sample value based on the field type
    let sampleValue;
    switch (field.type) {
      case 'text':
        sampleValue = 'Sample text';
        break;
      case 'number':
        sampleValue = 42;
        break;
      case 'date':
        sampleValue = '2023-04-15';
        break;
      case 'boolean':
        sampleValue = true;
        break;
      case 'url':
        sampleValue = 'https://example.com';
        break;
      case 'image':
        sampleValue = 'https://example.com/image.jpg';
        break;
      default:
        sampleValue = 'Sample value';
    }
    
    schemaObject[field.name] = sampleValue;
  });
  
  schemaPreviewArea.value = JSON.stringify(schemaObject, null, 2);
}

// Add event listeners to all filter checkboxes
[filterHeadings, filterParagraphs, filterImages, filterLinks, 
 filterTables, filterLists, filterForms, filterMeta].forEach(checkbox => {
  checkbox.addEventListener('change', saveFilterSettings);
});

// Add event listeners to advanced settings
[selectorTypeSelect, customSelectorInput, cleanWhitespaceCheck, 
 cleanHtmlCheck, normalizeTextCheck, enablePaginationCheck,
 paginationSelectorInput, maxPagesInput, paginationDelayInput].forEach(element => {
  element.addEventListener('change', saveAdvancedSettings);
  element.addEventListener('input', saveAdvancedSettings);
});

// Add event listeners to API settings
[apiEndpointInput, apiMethodSelect, apiHeadersInput].forEach(element => {
  element.addEventListener('change', saveApiSettings);
  element.addEventListener('input', saveApiSettings);
});

// Initialize theme based on system preference
function initTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.setAttribute('data-theme', 'dark');
    themeToggle.checked = true;
  }
}

// Update the display of saved sites list
function updateSitesList() {
  if (Object.keys(allSitesData).length === 0) {
    savedSites.style.display = 'none';
    return;
  }
  
  // Show saved sites section
  savedSites.style.display = 'block';
  
  // Clear current list
  sitesList.innerHTML = '';
  
  // Add each site to the list
  Object.entries(allSitesData).forEach(([site, siteData]) => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    
    const siteTitle = document.createElement('div');
    siteTitle.className = 'site-title';
    siteTitle.textContent = siteData.title || site;
    
    const siteActions = document.createElement('div');
    siteActions.className = 'site-actions';
    
    // Switch to button (only if not current site)
    if (site !== currentUrl) {
      const switchButton = document.createElement('button');
      switchButton.innerHTML = '⟲';
      switchButton.className = 'small-icon-button';
      switchButton.title = 'Load this site data';
      switchButton.addEventListener('click', (e) => {
        e.stopPropagation();
        loadSiteData(site);
      });
      siteActions.appendChild(switchButton);
    }
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '×';
    deleteButton.className = 'small-icon-button';
    deleteButton.title = 'Delete this site data';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSiteData(site);
    });
    siteActions.appendChild(deleteButton);
    
    siteItem.appendChild(siteTitle);
    siteItem.appendChild(siteActions);
    
    // Make whole item clickable to load data
    siteItem.addEventListener('click', () => {
      loadSiteData(site);
    });
    
    // Highlight current site
    if (site === currentUrl) {
      siteItem.style.borderLeft = '3px solid var(--primary-color)';
      siteItem.style.paddingLeft = '10px';
    }
    
    sitesList.appendChild(siteItem);
  });
}

// Load data for a specific site
function loadSiteData(site) {
  if (allSitesData[site]) {
    scrapedData = allSitesData[site].data;
    downloadButton.disabled = false;
    
    // Update UI
    updateDataStats();
    addPreviewToggle();
    statusElement.textContent = `Loaded data for ${allSitesData[site].title || site}`;
  }
}

// Delete data for a specific site
function deleteSiteData(site) {
  if (allSitesData[site]) {
    // Ask for confirmation
    if (confirm(`Are you sure you want to delete data for ${allSitesData[site].title || site}?`)) {
      delete allSitesData[site];
      
      // Save updated data
      chrome.storage.local.set({ allSitesData });
      
      // If we deleted the current site data
      if (site === currentUrl) {
        scrapedData = null;
        downloadButton.disabled = true;
        deleteButton.style.display = 'none';
        
        if (document.getElementById('previewToggle')) {
          document.getElementById('previewToggle').remove();
        }
        if (document.getElementById('previewContainer')) {
          document.getElementById('previewContainer').remove();
        }
        
        statusElement.textContent = 'Data deleted';
        dataStats.textContent = '';
      }
      
      // Update the sites list
      updateSitesList();
    }
  }
}

// Update data statistics display
function updateDataStats() {
  if (!scrapedData) {
    dataStats.textContent = '';
    return;
  }
  
  const categories = Object.keys(scrapedData).filter(key => key !== 'pageInfo');
  const stats = [];
  
  if (scrapedData.textContent) {
    const paragraphCount = scrapedData.textContent.paragraphs?.length || 0;
    const headingCount = scrapedData.textContent.headings?.length || 0;
    if (paragraphCount || headingCount) {
      stats.push(`${paragraphCount + headingCount} text items`);
    }
  }
  
  if (scrapedData.images && scrapedData.images.length) {
    stats.push(`${scrapedData.images.length} images`);
  }
  
  if (scrapedData.links && scrapedData.links.length) {
    stats.push(`${scrapedData.links.length} links`);
  }
  
  dataStats.textContent = stats.join(', ');
}

// Adds a preview toggle button to the UI
function addPreviewToggle() {
  if (document.getElementById('previewToggle')) {
    return; // Already exists
  }
  
  const container = document.querySelector('.container');
  
  // Create preview button
  const previewToggle = document.createElement('button');
  previewToggle.id = 'previewToggle';
  previewToggle.textContent = 'Show Preview';
  
  // Insert after data controls
  const dataControlsElement = document.querySelector('.data-controls');
  container.insertBefore(previewToggle, dataControlsElement.nextSibling);
  
  // Add preview container (initially hidden)
  const previewContainer = document.createElement('div');
  previewContainer.id = 'previewContainer';
  previewContainer.style.display = 'none';
  previewContainer.style.maxHeight = '200px';
  previewContainer.style.overflowY = 'auto';
  previewContainer.style.marginTop = '10px';
  
  container.insertBefore(previewContainer, previewToggle.nextSibling);
  
  // Add click handler
  previewToggle.addEventListener('click', () => {
    const isHidden = previewContainer.style.display === 'none';
    
    if (isHidden) {
      // Generate and show preview
      previewContainer.style.display = 'block';
      previewToggle.textContent = 'Hide Preview';
      generatePreview(previewContainer);
    } else {
      // Hide preview
      previewContainer.style.display = 'none';
      previewToggle.textContent = 'Show Preview';
    }
  });
}

// Generate a preview of the scraped data
function generatePreview(container) {
  if (!scrapedData) {
    container.textContent = 'No data available for preview.';
    return;
  }
  
  container.innerHTML = '';
  
  // Page info
  if (scrapedData.pageInfo) {
    const pageInfo = document.createElement('div');
    pageInfo.innerHTML = `<strong>Page:</strong> ${scrapedData.pageInfo.title}<br>
                         <strong>URL:</strong> ${scrapedData.pageInfo.url}`;
    container.appendChild(pageInfo);
  }
  
  // Summary of data sections
  const summary = document.createElement('div');
  summary.style.marginTop = '10px';
  summary.innerHTML = '<strong>Data collected:</strong><br>';
  
  // Count items in each category
  if (scrapedData.textContent) {
    const paragraphCount = scrapedData.textContent.paragraphs?.length || 0;
    const headingCount = scrapedData.textContent.headings?.length || 0;
    summary.innerHTML += `- Text: ${paragraphCount} paragraphs, ${headingCount} headings<br>`;
  }
  
  if (scrapedData.images) {
    summary.innerHTML += `- Images: ${scrapedData.images.length} items<br>`;
  }
  
  if (scrapedData.links) {
    summary.innerHTML += `- Links: ${scrapedData.links.length} items<br>`;
  }
  
  if (scrapedData.tables) {
    summary.innerHTML += `- Tables: ${scrapedData.tables.length} items<br>`;
  }
  
  if (scrapedData.lists) {
    summary.innerHTML += `- Lists: ${scrapedData.lists.length} items<br>`;
  }
  
  if (scrapedData.forms) {
    summary.innerHTML += `- Forms: ${scrapedData.forms.length} items<br>`;
  }
  
  container.appendChild(summary);
  
  // Sample preview of text content
  if (scrapedData.textContent && scrapedData.textContent.paragraphs && scrapedData.textContent.paragraphs.length > 0) {
    const textPreview = document.createElement('div');
    textPreview.style.marginTop = '10px';
    textPreview.innerHTML = '<strong>Sample text:</strong><br>';
    
    // Show first 2 paragraphs as a sample
    const sampleParagraphs = scrapedData.textContent.paragraphs.slice(0, 2);
    sampleParagraphs.forEach(p => {
      const preview = p.text.length > 100 ? p.text.substring(0, 97) + '...' : p.text;
      textPreview.innerHTML += `<p style="margin: 5px 0; font-size: 12px;">${preview}</p>`;
    });
    
    container.appendChild(textPreview);
  }
}

// Delete button click handler
deleteButton.addEventListener('click', () => {
  if (currentUrl && allSitesData[currentUrl]) {
    deleteSiteData(currentUrl);
  } else {
    // If we have scraped data but it's not saved to a site yet
    if (scrapedData) {
      if (confirm('Delete the current scraped data?')) {
        scrapedData = null;
        downloadButton.disabled = true;
        deleteButton.style.display = 'none';
        
        if (document.getElementById('previewToggle')) {
          document.getElementById('previewToggle').remove();
        }
        if (document.getElementById('previewContainer')) {
          document.getElementById('previewContainer').remove();
        }
        
        statusElement.textContent = 'Data deleted';
        dataStats.textContent = '';
      }
    }
  }
});

// Scrape button click handler
scrapeButton.addEventListener('click', async () => {
  statusElement.textContent = 'Scraping data...';
  
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Update current tab info
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      currentUrl = new URL(tab.url).hostname;
      currentSiteName = tab.title || currentUrl;
    } else {
      // Can't access this tab
      statusElement.textContent = 'Error: Cannot scrape this page (chrome pages are restricted).';
      return;
    }
    
    // Save current filter settings
    const filterSettings = saveFilterSettings();
    
    // Save advanced settings
    const advancedSettings = saveAdvancedSettings();
    
    // First, ensure the content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (injectionError) {
      console.error('Script injection error:', injectionError);
      // Continue anyway, as the script might already be there
    }
    
    // Wait a moment for the script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now try to communicate with the content script
    try {
      // Execute content script to scrape data with filter settings
      const result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'scrape',
        filters: filterSettings,
        advanced: advancedSettings,
        schema: schemaFields.length > 0 ? schemaFields : null
      });
      
      if (result && result.data) {
        scrapedData = result.data;
        
        // Store the data in site collection
        allSitesData[currentUrl] = {
          data: scrapedData,
          title: scrapedData.pageInfo?.title || currentSiteName,
          timestamp: new Date().toISOString(),
          filters: filterSettings,
          advanced: advancedSettings,
          schema: schemaFields.length > 0 ? schemaFields : null
        };
        
        // Save all sites data
        await chrome.storage.local.set({ allSitesData });
        
        // Update UI
        downloadButton.disabled = false;
        deleteButton.style.display = 'block';
        updateDataStats();
        updateSitesList();
        
        // Add preview toggle
        addPreviewToggle();
        
        let dataMessage = '';
        
        // If using a schema, show schema fields
        if (schemaFields.length > 0 && scrapedData.schemaData) {
          dataMessage = `${Object.keys(scrapedData.schemaData).length} schema fields extracted.`;
        } else {
          // Calculate the unique categories (except pageInfo)
          const categories = Object.keys(scrapedData).filter(key => key !== 'pageInfo' && key !== 'schemaData');
          dataMessage = `${categories.length} data categories.`;
        }
        
        // If pagination was enabled and used
        if (advancedSettings.enablePagination && scrapedData.paginationInfo) {
          dataMessage += ` Scraped ${scrapedData.paginationInfo.pagesScraped} pages.`;
        }
        
        statusElement.textContent = `Scraping complete! ${dataMessage}`;
      } else {
        statusElement.textContent = 'Error: No data received from scraper.';
      }
    } catch (messageError) {
      console.error('Message error:', messageError);
      statusElement.textContent = 'Error: Could not communicate with the page. Try reloading the extension.';
    }
  } catch (error) {
    console.error('Error during scraping:', error);
    statusElement.textContent = `Error: ${error.message || 'Could not scrape the page.'}`;
  }
});

// Download button click handler
downloadButton.addEventListener('click', () => {
  if (!scrapedData) {
    statusElement.textContent = 'No data to download.';
    return;
  }
  
  const format = formatSelect.value;
  let content = '';
  let filename = `${currentUrl}-data-${new Date().toISOString().slice(0, 10)}`;
  let mimeType = '';
  
  switch (format) {
    case 'json':
      content = JSON.stringify(scrapedData, null, 2);
      filename += '.json';
      mimeType = 'application/json';
      break;
    case 'csv':
      content = convertToCSV(scrapedData);
      filename += '.csv';
      mimeType = 'text/csv';
      break;
    case 'txt':
      content = convertToTXT(scrapedData);
      filename += '.txt';
      mimeType = 'text/plain';
      break;
    case 'xml':
      content = convertToXML(scrapedData);
      filename += '.xml';
      mimeType = 'application/xml';
      break;
    case 'sql':
      content = convertToSQL(scrapedData);
      filename += '.sql';
      mimeType = 'text/plain';
      break;
    case 'markdown':
      content = convertToMarkdown(scrapedData);
      filename += '.md';
      mimeType = 'text/markdown';
      break;
  }
  
  // Create a blob and download the file
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
  
  statusElement.textContent = `Downloading data as ${format.toUpperCase()}...`;
});

// Helper function to convert data to CSV
function convertToCSV(data) {
  // Create separate CSV sections for different data types
  const sections = [];
  
  // Page info section
  if (data.pageInfo) {
    sections.push('## PAGE INFO ##');
    sections.push('url,title,timestamp');
    sections.push(`"${data.pageInfo.url}","${data.pageInfo.title}","${data.pageInfo.timestamp}"`);
    sections.push('');
  }
  
  // Text content section - paragraphs
  if (data.textContent && data.textContent.paragraphs && data.textContent.paragraphs.length > 0) {
    sections.push('## PARAGRAPHS ##');
    sections.push('text');
    data.textContent.paragraphs.forEach(p => {
      sections.push(`"${p.text.replace(/"/g, '""')}"`);
    });
    sections.push('');
  }
  
  // Text content section - headings
  if (data.textContent && data.textContent.headings && data.textContent.headings.length > 0) {
    sections.push('## HEADINGS ##');
    sections.push('level,text');
    data.textContent.headings.forEach(h => {
      sections.push(`"${h.level}","${h.text.replace(/"/g, '""')}"`);
    });
    sections.push('');
  }
  
  // Images section
  if (data.images && data.images.length > 0) {
    sections.push('## IMAGES ##');
    sections.push('src,alt,width,height');
    data.images.forEach(img => {
      sections.push(`"${img.src}","${img.alt.replace(/"/g, '""')}","${img.width}","${img.height}"`);
    });
    sections.push('');
  }
  
  // Links section
  if (data.links && data.links.length > 0) {
    sections.push('## LINKS ##');
    sections.push('href,text');
    data.links.forEach(link => {
      sections.push(`"${link.href}","${link.text.replace(/"/g, '""')}"`);
    });
    sections.push('');
  }
  
  // For tables and more complex data, fall back to JSON format inside CSV
  if (data.tables && data.tables.length > 0) {
    sections.push('## TABLES ##');
    sections.push('table_data');
    sections.push(`"${JSON.stringify(data.tables).replace(/"/g, '""')}"`);
    sections.push('');
  }
  
  if (data.lists && data.lists.length > 0) {
    sections.push('## LISTS ##');
    sections.push('list_data');
    sections.push(`"${JSON.stringify(data.lists).replace(/"/g, '""')}"`);
    sections.push('');
  }
  
  if (data.forms && data.forms.length > 0) {
    sections.push('## FORMS ##');
    sections.push('form_data');
    sections.push(`"${JSON.stringify(data.forms).replace(/"/g, '""')}"`);
    sections.push('');
  }
  
  return sections.join('\n');
}

// Helper function to convert data to TXT
function convertToTXT(data) {
  const sections = [];
  
  // Page info section
  if (data.pageInfo) {
    sections.push('===== PAGE INFO =====');
    sections.push(`URL: ${data.pageInfo.url}`);
    sections.push(`Title: ${data.pageInfo.title}`);
    sections.push(`Timestamp: ${data.pageInfo.timestamp}`);
    sections.push('');
  }
  
  // Text content section
  if (data.textContent) {
    // Headings
    if (data.textContent.headings && data.textContent.headings.length > 0) {
      sections.push('===== HEADINGS =====');
      data.textContent.headings.forEach(h => {
        sections.push(`[${h.level}] ${h.text}`);
      });
      sections.push('');
    }
    
    // Paragraphs
    if (data.textContent.paragraphs && data.textContent.paragraphs.length > 0) {
      sections.push('===== PARAGRAPHS =====');
      data.textContent.paragraphs.forEach(p => {
        sections.push(p.text);
        sections.push('');
      });
    }
  }
  
  // Images section
  if (data.images && data.images.length > 0) {
    sections.push('===== IMAGES =====');
    data.images.forEach(img => {
      sections.push(`Source: ${img.src}`);
      if (img.alt) sections.push(`Alt text: ${img.alt}`);
      sections.push(`Dimensions: ${img.width}x${img.height}`);
      sections.push('');
    });
  }
  
  // Links section
  if (data.links && data.links.length > 0) {
    sections.push('===== LINKS =====');
    data.links.forEach(link => {
      sections.push(`${link.text} - ${link.href}`);
    });
    sections.push('');
  }
  
  // Tables section
  if (data.tables && data.tables.length > 0) {
    sections.push('===== TABLES =====');
    data.tables.forEach((table, index) => {
      sections.push(`--- Table ${index + 1} ${table.caption ? '(' + table.caption + ')' : ''} ---`);
      
      // Headers
      if (table.headers && table.headers.length > 0) {
        sections.push(`Headers: ${table.headers.join(' | ')}`);
      }
      
      // Rows
      if (table.rows && table.rows.length > 0) {
        sections.push('Data:');
        table.rows.forEach(row => {
          sections.push(row.join(' | '));
        });
      }
      sections.push('');
    });
  }
  
  // Lists section
  if (data.lists && data.lists.length > 0) {
    sections.push('===== LISTS =====');
    data.lists.forEach((list, index) => {
      sections.push(`--- List ${index + 1} (${list.type}) ---`);
      list.items.forEach((item, i) => {
        sections.push(`${list.type === 'ol' ? (i+1) + '.' : '•'} ${item}`);
      });
      sections.push('');
    });
  }
  
  // Forms section (simplified)
  if (data.forms && data.forms.length > 0) {
    sections.push('===== FORMS =====');
    data.forms.forEach((form, index) => {
      sections.push(`--- Form ${index + 1} ---`);
      sections.push(`Action: ${form.action}`);
      sections.push(`Method: ${form.method}`);
      
      if (form.fields && form.fields.length > 0) {
        sections.push('Fields:');
        form.fields.forEach(field => {
          sections.push(`${field.name} (${field.type})`);
        });
      }
      sections.push('');
    });
  }
  
  return sections.join('\n');
}

// Convert data to XML format
function convertToXML(data) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<scraped-data>\n';
  
  // Page info
  if (data.pageInfo) {
    xml += '  <page-info>\n';
    xml += `    <url>${escapeXml(data.pageInfo.url)}</url>\n`;
    xml += `    <title>${escapeXml(data.pageInfo.title)}</title>\n`;
    xml += `    <timestamp>${data.pageInfo.timestamp}</timestamp>\n`;
    xml += '  </page-info>\n';
  }
  
  // Text content
  if (data.textContent) {
    xml += '  <text-content>\n';
    
    // Headings
    if (data.textContent.headings && data.textContent.headings.length > 0) {
      xml += '    <headings>\n';
      data.textContent.headings.forEach(h => {
        xml += `      <heading level="${h.level}">${escapeXml(h.text)}</heading>\n`;
      });
      xml += '    </headings>\n';
    }
    
    // Paragraphs
    if (data.textContent.paragraphs && data.textContent.paragraphs.length > 0) {
      xml += '    <paragraphs>\n';
      data.textContent.paragraphs.forEach(p => {
        xml += `      <paragraph>${escapeXml(p.text)}</paragraph>\n`;
      });
      xml += '    </paragraphs>\n';
    }
    
    xml += '  </text-content>\n';
  }
  
  // Images
  if (data.images && data.images.length > 0) {
    xml += '  <images>\n';
    data.images.forEach(img => {
      xml += '    <image>\n';
      xml += `      <src>${escapeXml(img.src)}</src>\n`;
      xml += `      <alt>${escapeXml(img.alt)}</alt>\n`;
      xml += `      <width>${img.width}</width>\n`;
      xml += `      <height>${img.height}</height>\n`;
      xml += '    </image>\n';
    });
    xml += '  </images>\n';
  }
  
  // Links
  if (data.links && data.links.length > 0) {
    xml += '  <links>\n';
    data.links.forEach(link => {
      xml += '    <link>\n';
      xml += `      <href>${escapeXml(link.href)}</href>\n`;
      xml += `      <text>${escapeXml(link.text)}</text>\n`;
      xml += '    </link>\n';
    });
    xml += '  </links>\n';
  }
  
  // Tables
  if (data.tables && data.tables.length > 0) {
    xml += '  <tables>\n';
    data.tables.forEach(table => {
      xml += '    <table>\n';
      
      // Headers
      if (table.headers && table.headers.length > 0) {
        xml += '      <headers>\n';
        table.headers.forEach(header => {
          xml += `        <header>${escapeXml(header)}</header>\n`;
        });
        xml += '      </headers>\n';
      }
      
      // Rows
      if (table.rows && table.rows.length > 0) {
        xml += '      <rows>\n';
        table.rows.forEach(row => {
          xml += '        <row>\n';
          row.forEach(cell => {
            xml += `          <cell>${escapeXml(cell)}</cell>\n`;
          });
          xml += '        </row>\n';
        });
        xml += '      </rows>\n';
      }
      
      xml += '    </table>\n';
    });
    xml += '  </tables>\n';
  }
  
  // Lists
  if (data.lists && data.lists.length > 0) {
    xml += '  <lists>\n';
    data.lists.forEach(list => {
      xml += `    <list type="${list.type}">\n`;
      list.items.forEach(item => {
        xml += `      <item>${escapeXml(item)}</item>\n`;
      });
      xml += '    </list>\n';
    });
    xml += '  </lists>\n';
  }
  
  xml += '</scraped-data>';
  return xml;
}

// Helper function to escape XML special characters
function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convert data to SQL format
function convertToSQL(data) {
  let sql = '';
  
  // Page info
  if (data.pageInfo) {
    sql += `INSERT INTO scraped_data (url, title, timestamp) VALUES ('${data.pageInfo.url}', '${data.pageInfo.title}', '${data.pageInfo.timestamp}');\n`;
  }
  
  // Text content
  if (data.textContent) {
    // Headings
    if (data.textContent.headings && data.textContent.headings.length > 0) {
      sql += 'INSERT INTO scraped_data (level, text) VALUES\n';
      data.textContent.headings.forEach(h => {
        sql += `  (${h.level}, '${h.text.replace(/'/g, "''")}'),\n`;
      });
      sql = sql.slice(0, -2) + ';\n';
    }
    
    // Paragraphs
    if (data.textContent.paragraphs && data.textContent.paragraphs.length > 0) {
      sql += 'INSERT INTO scraped_data (text) VALUES\n';
      data.textContent.paragraphs.forEach(p => {
        sql += `  ('${p.text.replace(/'/g, "''")}'),\n`;
      });
      sql = sql.slice(0, -2) + ';\n';
    }
  }
  
  // Images
  if (data.images && data.images.length > 0) {
    sql += 'INSERT INTO scraped_data (src, alt, width, height) VALUES\n';
    data.images.forEach(img => {
      sql += `  ('${img.src}', '${img.alt.replace(/'/g, "''")}', ${img.width}, ${img.height}),\n`;
    });
    sql = sql.slice(0, -2) + ';\n';
  }
  
  // Links
  if (data.links && data.links.length > 0) {
    sql += 'INSERT INTO scraped_data (href, text) VALUES\n';
    data.links.forEach(link => {
      sql += `  ('${link.href}', '${link.text.replace(/'/g, "''")}'),\n`;
    });
    sql = sql.slice(0, -2) + ';\n';
  }
  
  // Tables
  if (data.tables && data.tables.length > 0) {
    sql += 'INSERT INTO scraped_data (table_data) VALUES\n';
    sql += `  ('${data.tables.map(JSON.stringify).join("', '")}');\n`;
  }
  
  // Lists
  if (data.lists && data.lists.length > 0) {
    sql += 'INSERT INTO scraped_data (list_data) VALUES\n';
    sql += `  ('${data.lists.map(JSON.stringify).join("', '")}');\n`;
  }
  
  // Forms
  if (data.forms && data.forms.length > 0) {
    sql += 'INSERT INTO scraped_data (form_data) VALUES\n';
    sql += `  ('${data.forms.map(JSON.stringify).join("', '")}');\n`;
  }
  
  return sql;
}

// Convert data to Markdown format
function convertToMarkdown(data) {
  let markdown = '';
  
  // Page info
  if (data.pageInfo) {
    markdown += '## PAGE INFO ##\n\n';
    markdown += `- URL: ${data.pageInfo.url}\n`;
    markdown += `- Title: ${data.pageInfo.title}\n`;
    markdown += `- Timestamp: ${data.pageInfo.timestamp}\n`;
  }
  
  // Text content
  if (data.textContent) {
    // Headings
    if (data.textContent.headings && data.textContent.headings.length > 0) {
      markdown += '## HEADINGS ##\n\n';
      data.textContent.headings.forEach(h => {
        markdown += `- ${h.level}: ${h.text}\n`;
      });
    }
    
    // Paragraphs
    if (data.textContent.paragraphs && data.textContent.paragraphs.length > 0) {
      markdown += '## PARAGRAPHS ##\n\n';
      data.textContent.paragraphs.forEach(p => {
        markdown += `- ${p.text}\n`;
      });
    }
  }
  
  // Images
  if (data.images && data.images.length > 0) {
    markdown += '## IMAGES ##\n\n';
    data.images.forEach(img => {
      markdown += `- ${img.src} (${img.alt}, ${img.width}x${img.height})\n`;
    });
  }
  
  // Links
  if (data.links && data.links.length > 0) {
    markdown += '## LINKS ##\n\n';
    data.links.forEach(link => {
      markdown += `- ${link.text} - ${link.href}\n`;
    });
  }
  
  // Tables
  if (data.tables && data.tables.length > 0) {
    markdown += '## TABLES ##\n\n';
    data.tables.forEach((table, index) => {
      markdown += `### Table ${index + 1} ${table.caption ? `(${table.caption})` : ''} ###\n\n`;
      
      // Headers
      if (table.headers && table.headers.length > 0) {
        markdown += '#### Headers ####\n\n';
        markdown += table.headers.join(' | ') + '\n';
      }
      
      // Rows
      if (table.rows && table.rows.length > 0) {
        markdown += '#### Data ####\n\n';
        table.rows.forEach(row => {
          markdown += row.join(' | ') + '\n';
        });
      }
    });
  }
  
  // Lists
  if (data.lists && data.lists.length > 0) {
    markdown += '## LISTS ##\n\n';
    data.lists.forEach((list, index) => {
      markdown += `### List ${index + 1} (${list.type}) ###\n\n`;
      list.items.forEach((item, i) => {
        markdown += `${list.type === 'ol' ? (i+1) + '.' : '•'} ${item}\n`;
      });
    });
  }
  
  // Forms
  if (data.forms && data.forms.length > 0) {
    markdown += '## FORMS ##\n\n';
    data.forms.forEach((form, index) => {
      markdown += `### Form ${index + 1} ###\n\n`;
      markdown += `- Action: ${form.action}\n`;
      markdown += `- Method: ${form.method}\n`;
      
      if (form.fields && form.fields.length > 0) {
        markdown += '#### Fields ####\n\n';
        form.fields.forEach(field => {
          markdown += `- ${field.name} (${field.type})\n`;
        });
      }
    });
  }
  
  return markdown;
} 