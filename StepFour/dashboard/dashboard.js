let collectedImages = [];
let isPaginating = false;
let settings = {
  autoDownload: false,
  downloadFolder: '',
  filenamePattern: '*num-3*-*name*.*ext*',
  paginationMethod: 'auto',
  galleryAutoDetect: true
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initializeUI();
  setupEventListeners();
  requestGalleryDetection();
});

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  if (result.settings) {
    settings = { ...settings, ...result.settings };
    applySettings();
  }
}

function applySettings() {
  document.getElementById('autoDownload').checked = settings.autoDownload;
  document.getElementById('downloadFolder').value = settings.downloadFolder || '';
  document.getElementById('filenamePattern').value = settings.filenamePattern;
  document.getElementById('paginationMethod').value = settings.paginationMethod;
  document.getElementById('galleryAutoDetect').checked = settings.galleryAutoDetect;
  updateFilenameExample();
}

function initializeUI() {
  updateImageStats();
  updateFilenameExample();
}

function setupEventListeners() {
  document.getElementById('startPagination').addEventListener('click', startPagination);
  document.getElementById('stopPagination').addEventListener('click', stopPagination);
  document.getElementById('clearImages').addEventListener('click', clearImages);
  document.getElementById('exportCsv').addEventListener('click', exportCSV);
  document.getElementById('downloadImages').addEventListener('click', downloadAllImages);
  
  document.getElementById('autoDownload').addEventListener('change', (e) => {
    settings.autoDownload = e.target.checked;
    saveSettings();
  });
  
  document.getElementById('downloadFolder').addEventListener('change', (e) => {
    settings.downloadFolder = e.target.value.trim();
    saveSettings();
  });
  
  document.getElementById('filenamePattern').addEventListener('input', (e) => {
    settings.filenamePattern = e.target.value;
    saveSettings();
    updateFilenameExample();
  });
  
  document.getElementById('paginationMethod').addEventListener('change', (e) => {
    settings.paginationMethod = e.target.value;
    saveSettings();
  });
  
  document.getElementById('galleryAutoDetect').addEventListener('change', (e) => {
    settings.galleryAutoDetect = e.target.checked;
    saveSettings();
  });
  
  document.querySelectorAll('.pattern-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pattern = btn.dataset.pattern;
      const input = document.getElementById('filenamePattern');
      input.value += pattern;
      settings.filenamePattern = input.value;
      saveSettings();
      updateFilenameExample();
    });
  });
  
  document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.dataset.method;
      document.getElementById('paginationMethod').value = method;
      settings.paginationMethod = method;
      saveSettings();
    });
  });
  
  document.querySelectorAll('.filename-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pattern = btn.dataset.pattern;
      document.getElementById('filenamePattern').value = pattern;
      settings.filenamePattern = pattern;
      saveSettings();
      updateFilenameExample();
    });
  });
  
  const settingsHeader = document.getElementById('settingsHeader');
  const settingsContent = document.getElementById('settingsContent');
  settingsHeader.addEventListener('click', () => {
    settingsContent.classList.toggle('collapsed');
    settingsHeader.querySelector('.collapse-icon').textContent = 
      settingsContent.classList.contains('collapsed') ? '▶' : '▼';
  });
}

async function saveSettings() {
  await chrome.storage.local.set({ settings });
  chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    settings
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GALLERY_STATUS_UPDATE') {
    updateGalleryStatus(message.data);
  }
  
  if (message.type === 'IMAGES_UPDATE') {
    collectedImages = message.images;
    updateImageStats();
    updateThumbnailGrid();
  }
  
  if (message.type === 'PAGINATION_STATUS_UPDATE') {
    updatePaginationStatus(message.data);
  }
  
  if (message.type === 'DOWNLOAD_PROGRESS') {
    console.log('Download progress:', message.data);
  }
  
  if (message.type === 'DOWNLOAD_COMPLETE') {
    console.log('All downloads complete');
  }
});

async function requestGalleryDetection() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'DETECT_GALLERY' }).catch(() => {
      updateGalleryStatus({
        isGallery: false,
        galleryType: 'Unknown',
        confidence: 'Low',
        imageCount: 0
      });
    });
  }
  
  const response = await chrome.runtime.sendMessage({ type: 'GET_IMAGES' });
  if (response && response.images) {
    collectedImages = response.images;
    updateImageStats();
    updateThumbnailGrid();
  }
}

function updateGalleryStatus(data) {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const galleryType = document.getElementById('galleryType');
  const confidence = document.getElementById('confidence');
  const pageImageCount = document.getElementById('pageImageCount');
  
  if (data.isGallery) {
    statusIndicator.classList.add('detected');
    statusText.textContent = '✓ Gallery Detected';
  } else {
    statusIndicator.classList.remove('detected');
    statusText.textContent = '✗ No Gallery Detected';
  }
  
  galleryType.textContent = data.galleryType || 'Unknown';
  confidence.textContent = data.confidence || 'Low';
  pageImageCount.textContent = data.imageCount || 0;
  
  const confidenceSpan = document.getElementById('confidence');
  confidenceSpan.className = '';
  if (data.confidence === 'High') {
    confidenceSpan.classList.add('confidence-high');
  } else if (data.confidence === 'Medium') {
    confidenceSpan.classList.add('confidence-medium');
  } else {
    confidenceSpan.classList.add('confidence-low');
  }
}

async function startPagination() {
  isPaginating = true;
  const method = settings.paginationMethod;
  
  document.getElementById('startPagination').disabled = true;
  document.getElementById('stopPagination').disabled = false;
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    chrome.runtime.sendMessage({
      type: 'START_PAGINATION',
      method
    });
  }
}

function stopPagination() {
  isPaginating = false;
  
  document.getElementById('startPagination').disabled = false;
  document.getElementById('stopPagination').disabled = true;
  
  chrome.runtime.sendMessage({ type: 'STOP_PAGINATION' });
}

function updatePaginationStatus(data) {
  const statusEl = document.getElementById('paginationStatus');
  const pageEl = document.getElementById('currentPage');
  const progressFill = document.getElementById('progressFill');
  
  if (data.status === 'paginating') {
    statusEl.textContent = `Paginating (${data.method})...`;
    pageEl.textContent = `Page: ${data.currentPage}`;
    progressFill.style.width = '50%';
  } else if (data.status === 'complete') {
    statusEl.textContent = data.message || 'Complete';
    pageEl.textContent = `Page: ${data.currentPage}`;
    progressFill.style.width = '100%';
    
    document.getElementById('startPagination').disabled = false;
    document.getElementById('stopPagination').disabled = true;
    isPaginating = false;
  }
}

function updateImageStats() {
  document.getElementById('totalImages').textContent = collectedImages.length;
}

function updateThumbnailGrid() {
  const grid = document.getElementById('thumbnailGrid');
  
  if (collectedImages.length === 0) {
    grid.innerHTML = '<p class="empty-state">No images collected yet. Start pagination to find images.</p>';
    return;
  }
  
  grid.innerHTML = '';
  
  const maxDisplay = 50;
  const displayImages = collectedImages.slice(0, maxDisplay);
  
  displayImages.forEach((img, index) => {
    const tile = document.createElement('div');
    tile.className = 'thumbnail-tile';
    tile.title = img.caption || img.filename;
    
    const imgEl = document.createElement('img');
    imgEl.src = img.thumbnailUrl;
    imgEl.alt = img.caption || '';
    imgEl.loading = 'lazy';
    
    imgEl.onerror = function() {
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ccc" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E✗%3C/text%3E%3C/svg%3E';
    };
    
    tile.appendChild(imgEl);
    
    if (img.caption) {
      const caption = document.createElement('div');
      caption.className = 'thumbnail-caption';
      caption.textContent = img.caption.substring(0, 30) + (img.caption.length > 30 ? '...' : '');
      tile.appendChild(caption);
    }
    
    grid.appendChild(tile);
  });
  
  if (collectedImages.length > maxDisplay) {
    const moreEl = document.createElement('div');
    moreEl.className = 'thumbnail-tile more-indicator';
    moreEl.textContent = `+${collectedImages.length - maxDisplay} more`;
    grid.appendChild(moreEl);
  }
}

async function clearImages() {
  if (confirm('Clear all collected images?')) {
    collectedImages = [];
    await chrome.runtime.sendMessage({ type: 'CLEAR_IMAGES' });
    updateImageStats();
    updateThumbnailGrid();
  }
}

async function exportCSV() {
  if (collectedImages.length === 0) {
    alert('No images to export');
    return;
  }
  
  await chrome.runtime.sendMessage({ type: 'EXPORT_CSV' });
}

async function downloadAllImages() {
  if (collectedImages.length === 0) {
    alert('No images to download');
    return;
  }
  
  await chrome.runtime.sendMessage({ type: 'DOWNLOAD_IMAGES' });
}

function updateFilenameExample() {
  const pattern = settings.filenamePattern;
  const example = pattern
    .replace(/\*num-(\d+)\*/g, (match, digits) => '1'.padStart(parseInt(digits), '0'))
    .replace(/\*num\*/g, '001')
    .replace(/\*name\*/g, 'image')
    .replace(/\*ext\*/g, 'jpg')
    .replace(/\*date\*/g, '2025-10-25')
    .replace(/\*time\*/g, '14-30-00')
    .replace(/\*domain\*/g, 'example')
    .replace(/\*page\*/g, '1')
    .replace(/\*caption\*/g, 'photo')
    .replace(/\*fullname\*/g, 'image.jpg');
  
  document.getElementById('filenameExample').textContent = example;
}
