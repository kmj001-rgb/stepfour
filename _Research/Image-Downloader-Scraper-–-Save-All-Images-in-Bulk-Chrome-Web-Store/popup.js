let selectedImages = new Set();
let allImages = [];
let filteredImages = [];

// DOM Elements
const scanBtn = document.getElementById('scanBtn');
const downloadBtn = document.getElementById('downloadBtn');
const imageGrid = document.getElementById('imageGrid');
const statusText = document.getElementById('statusText');
const imageCount = document.getElementById('imageCount');
const renameBase = document.getElementById('renameBase');
const urlSearch = document.getElementById('urlSearch');
const selectAllBtn = document.getElementById('selectAllBtn');
const unselectAllBtn = document.getElementById('unselectAllBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');

// Filter elements
const minSize = document.getElementById('minSize');
const maxSize = document.getElementById('maxSize');
const minWidth = document.getElementById('minWidth');
const minHeight = document.getElementById('minHeight');
const fileTypes = document.getElementById('fileTypes');

// Function to scan the page
async function scanPage() {
  statusText.textContent = 'Scanning page...';
  imageGrid.innerHTML = '';
  selectedImages.clear();
  downloadBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    if (!tab.url.startsWith('http')) throw new Error('Cannot scan non-HTTP pages');
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (error) {
      console.log('Content script already injected or error:', error);
    }
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getImages' });
    if (!response || !response.images) throw new Error('No response from content script');
    allImages = response.images;
    applyFilters();
    updateStatus();
  } catch (error) {
    console.error('Scan error:', error);
    statusText.textContent = `Error: ${error.message}`;
  }
}

// Display images in the grid
function displayImages(images) {
  imageGrid.innerHTML = '';
  images.forEach((image, index) => {
    const div = document.createElement('div');
    div.className = 'image-item';
    div.dataset.index = index;
    if (selectedImages.has(index)) div.classList.add('selected');

    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.alt;
    img.title = image.src;
    div.appendChild(img);

    // Action icons
    const actions = document.createElement('div');
    actions.className = 'image-actions';
    // Download icon
    const dlBtn = document.createElement('button');
    dlBtn.className = 'image-action-btn';
    dlBtn.title = 'Download';
    dlBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><path d="M10 3v10m0 0l-4-4m4 4l4-4M4 17h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    dlBtn.onclick = (e) => {
      e.stopPropagation();
      downloadSingleImage(image, index);
    };
    // Open in new tab icon
    const openBtn = document.createElement('button');
    openBtn.className = 'image-action-btn';
    openBtn.title = 'Open in new tab';
    openBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><path d="M14 3h3v3m0-3L10 10m-7 7h10a1 1 0 001-1V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    openBtn.onclick = (e) => {
      e.stopPropagation();
      window.open(image.src, '_blank');
    };
    actions.appendChild(dlBtn);
    actions.appendChild(openBtn);
    div.appendChild(actions);

    div.addEventListener('click', () => toggleImageSelection(index));
    imageGrid.appendChild(div);
  });
}

// Download a single image with rename
async function downloadSingleImage(image, idx) {
  const ext = image.src.split('.').pop().split('?')[0].split('#')[0];
  const base = renameBase.value.trim() || 'image';
  const filename = `${base}-${idx + 1}.${ext}`;
  try {
    await chrome.downloads.download({ url: image.src, filename, saveAs: false });
  } catch (error) {
    console.error('Error downloading image:', error);
  }
}

// Toggle image selection
function toggleImageSelection(index) {
  const imageItem = imageGrid.children[index];
  if (selectedImages.has(index)) {
    selectedImages.delete(index);
    imageItem.classList.remove('selected');
  } else {
    selectedImages.add(index);
    imageItem.classList.add('selected');
  }
  downloadBtn.disabled = selectedImages.size === 0;
  chrome.storage.local.set({ selectedImages: Array.from(selectedImages) });
}

// Download selected images with rename
downloadBtn.addEventListener('click', async () => {
  const base = renameBase.value.trim() || 'image';
  let i = 1;
  for (const index of selectedImages) {
    const image = filteredImages[index];
    if (!image) continue;
    const ext = image.src.split('.').pop().split('?')[0].split('#')[0];
    const filename = `${base}-${i}.${ext}`;
    try {
      await chrome.downloads.download({ url: image.src, filename, saveAs: false });
    } catch (error) {
      console.error('Error downloading image:', error);
    }
    i++;
  }
  statusText.textContent = 'Download complete';
});

// Update status
function updateStatus() {
  const count = filteredImages.length;
  imageCount.textContent = `${count} images found`;
  statusText.textContent = count > 0 ? 'Ready to download' : 'No images found';
}

// Apply filters (including URL search)
function applyFilters() {
  const urlFilter = urlSearch.value.trim().toLowerCase();
  filteredImages = allImages.filter((image, idx) => {
    // File type filter
    const fileType = image.src.split('.').pop().toLowerCase();
    const selectedTypes = Array.from(fileTypes.selectedOptions).map(opt => opt.value);
    if (selectedTypes.length > 0 && !selectedTypes.includes(fileType)) return false;
    // Size filter
    if (minSize.value && image.size < minSize.value * 1024) return false;
    if (maxSize.value && image.size > maxSize.value * 1024) return false;
    // Dimension filter
    if (minWidth.value && image.width < minWidth.value) return false;
    if (minHeight.value && image.height < minHeight.value) return false;
    // URL search filter
    if (urlFilter && !image.src.toLowerCase().includes(urlFilter)) return false;
    return true;
  });
  displayImages(filteredImages);
  updateStatus();
}

// Add event listeners for filters
[minSize, maxSize, minWidth, minHeight, fileTypes, urlSearch].forEach(element => {
  element.addEventListener('change', applyFilters);
  element.addEventListener('input', applyFilters);
});

// Add click handler for manual scan
scanBtn.addEventListener('click', scanPage);

// Auto-scan when popup opens
document.addEventListener('DOMContentLoaded', scanPage);

// Select All button
selectAllBtn.addEventListener('click', () => {
  const allIndices = Array.from({ length: filteredImages.length }, (_, i) => i);
  selectedImages = new Set(allIndices);
  displayImages(filteredImages);
  downloadBtn.disabled = false;
});

// Unselect All button
unselectAllBtn.addEventListener('click', () => {
  selectedImages.clear();
  displayImages(filteredImages);
  downloadBtn.disabled = true;
});

// Download All button
downloadAllBtn.addEventListener('click', async () => {
  const base = renameBase.value.trim() || 'image';
  let i = 1;
  for (const image of filteredImages) {
    const ext = image.src.split('.').pop().split('?')[0].split('#')[0];
    const filename = `${base}-${i}.${ext}`;
    try {
      await chrome.downloads.download({ url: image.src, filename, saveAs: false });
    } catch (error) {
      console.error('Error downloading image:', error);
    }
    i++;
  }
  statusText.textContent = 'Download complete';
}); 