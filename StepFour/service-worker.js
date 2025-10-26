let currentTabId = null;
let collectedImages = [];
let downloadQueue = [];
let isDownloading = false;
let detectedAPIs = new Map();
let settings = {
  autoDownload: false,
  downloadFolder: '',
  filenamePattern: '*num-3*-*name*.*ext*',
  paginationMethod: 'auto',
  galleryAutoDetect: true,
  maxPages: 50,
  concurrentDownloads: 3
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('StepFour extension installed');
  chrome.storage.local.set({ settings });
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.type === 'xmlhttprequest' && details.statusCode === 200) {
      const url = new URL(details.url);
      
      if (url.pathname.includes('/api/') || 
          url.pathname.includes('/json/') ||
          url.search.includes('format=json') ||
          details.url.includes('page=') ||
          details.url.includes('offset=')) {
        
        const hostname = url.hostname;
        if (!detectedAPIs.has(hostname)) {
          detectedAPIs.set(hostname, []);
        }
        
        const endpoints = detectedAPIs.get(hostname);
        if (!endpoints.includes(details.url)) {
          endpoints.push(details.url);
          
          if (details.tabId === currentTabId) {
            chrome.tabs.sendMessage(details.tabId, {
              type: 'API_ENDPOINT_DETECTED',
              endpoint: details.url,
              method: details.method
            }).catch(() => {});
          }
        }
      }
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INIT_TAB') {
    currentTabId = sender.tab.id;
    chrome.action.setBadgeText({ text: '', tabId: currentTabId });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GALLERY_DETECTED') {
    const { isGallery, galleryType, imageCount, confidence } = message.data;
    if (isGallery && currentTabId === sender.tab.id) {
      chrome.action.setBadgeText({ 
        text: String(imageCount), 
        tabId: currentTabId 
      });
      chrome.action.setBadgeBackgroundColor({ 
        color: '#4CAF50', 
        tabId: currentTabId 
      });
    }
    
    chrome.runtime.sendMessage({
      type: 'GALLERY_STATUS_UPDATE',
      data: message.data
    }).catch(() => {});
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'IMAGES_FOUND') {
    const newImages = message.images;
    const uniqueImages = newImages.filter(img => 
      !collectedImages.some(existing => existing.fileUrl === img.fileUrl)
    );
    
    collectedImages.push(...uniqueImages);
    
    chrome.runtime.sendMessage({
      type: 'IMAGES_UPDATE',
      images: collectedImages
    }).catch(() => {});
    
    if (settings.autoDownload && uniqueImages.length > 0) {
      queueDownloads(uniqueImages);
    }
    
    sendResponse({ success: true, total: collectedImages.length });
    return true;
  }
  
  if (message.type === 'GET_IMAGES') {
    sendResponse({ images: collectedImages });
    return true;
  }
  
  if (message.type === 'CLEAR_IMAGES') {
    collectedImages = [];
    downloadQueue = [];
    chrome.runtime.sendMessage({
      type: 'IMAGES_UPDATE',
      images: []
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'START_PAGINATION') {
    chrome.tabs.sendMessage(currentTabId || sender.tab.id, {
      type: 'START_PAGINATION',
      method: message.method
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'STOP_PAGINATION') {
    chrome.tabs.sendMessage(currentTabId || sender.tab.id, {
      type: 'STOP_PAGINATION'
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'DOWNLOAD_IMAGES') {
    queueDownloads(collectedImages);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'UPDATE_SETTINGS') {
    settings = { ...settings, ...message.settings };
    chrome.storage.local.set({ settings });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GET_SETTINGS') {
    sendResponse({ settings });
    return true;
  }
  
  if (message.type === 'PAGINATION_STATUS') {
    chrome.runtime.sendMessage({
      type: 'PAGINATION_STATUS_UPDATE',
      data: message.data
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'EXPORT_CSV') {
    exportCSV(collectedImages);
    sendResponse({ success: true });
    return true;
  }
});

function queueDownloads(images) {
  images.forEach((image, index) => {
    downloadQueue.push({
      image,
      index: collectedImages.indexOf(image),
      retries: 0
    });
  });
  
  if (!isDownloading) {
    processDownloadQueue();
  }
}

async function processDownloadQueue() {
  if (downloadQueue.length === 0) {
    isDownloading = false;
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_COMPLETE'
    }).catch(() => {});
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'StepFour Downloads Complete',
      message: `Successfully downloaded ${collectedImages.length} images`
    });
    return;
  }
  
  isDownloading = true;
  const concurrentDownloads = settings.concurrentDownloads || 3;
  
  const batch = downloadQueue.splice(0, concurrentDownloads);
  
  await Promise.all(batch.map(item => downloadImage(item.image, item.index, item)));
  
  setTimeout(() => processDownloadQueue(), 500);
}

async function downloadImage(image, index, queueItem) {
  try {
    const filename = generateFilename(image, index);
    const fullPath = settings.downloadFolder 
      ? `${sanitizePath(settings.downloadFolder)}/${filename}` 
      : filename;
    
    await chrome.downloads.download({
      url: image.fileUrl,
      filename: fullPath,
      conflictAction: 'uniquify'
    });
    
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_PROGRESS',
      data: {
        url: image.fileUrl,
        filename,
        status: 'success',
        current: collectedImages.length - downloadQueue.length,
        total: collectedImages.length
      }
    }).catch(() => {});
  } catch (error) {
    console.error('Download failed:', error);
    
    if (queueItem.retries < 3) {
      queueItem.retries++;
      downloadQueue.push(queueItem);
    } else {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_PROGRESS',
        data: {
          url: image.fileUrl,
          status: 'failed',
          error: error.message
        }
      }).catch(() => {});
    }
  }
}

function generateFilename(image, index) {
  let pattern = settings.filenamePattern;
  const url = new URL(image.fileUrl);
  const pathParts = url.pathname.split('/').filter(p => p);
  const originalName = pathParts[pathParts.length - 1] || 'image';
  const nameParts = originalName.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop() : 'jpg';
  const name = nameParts.join('.');
  
  const now = new Date();
  const pageNumber = image.pageNumber || 1;
  const galleryName = extractGalleryName(image.sourcePage || url.hostname);
  
  const replacements = {
    '\\*name\\*': name || 'image',
    '\\*ext\\*': ext,
    '\\*fullname\\*': originalName,
    '\\*domain\\*': url.hostname,
    '\\*hostname\\*': url.hostname.split('.')[0],
    '\\*protocol\\*': url.protocol.replace(':', ''),
    '\\*path\\*': url.pathname.substring(1).replace(/\//g, '-'),
    '\\*url-1\\*': pathParts[0] || '',
    '\\*url-2\\*': pathParts[1] || '',
    '\\*url-3\\*': pathParts[2] || '',
    '\\*num\\*': String(index + 1).padStart(3, '0'),
    '\\*index\\*': String(index),
    '\\*timestamp\\*': String(Date.now()),
    '\\*date\\*': `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    '\\*time\\*': `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`,
    '\\*datetime\\*': `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`,
    '\\*year\\*': String(now.getFullYear()),
    '\\*month\\*': String(now.getMonth() + 1).padStart(2, '0'),
    '\\*day\\*': String(now.getDate()).padStart(2, '0'),
    '\\*hour\\*': String(now.getHours()).padStart(2, '0'),
    '\\*minute\\*': String(now.getMinutes()).padStart(2, '0'),
    '\\*second\\*': String(now.getSeconds()).padStart(2, '0'),
    '\\*page\\*': String(pageNumber),
    '\\*gallery\\*': sanitizeFilename(galleryName),
    '\\*caption\\*': sanitizeFilename(image.caption || ''),
    '\\*source\\*': sanitizeFilename(url.hostname)
  };
  
  let result = pattern;
  
  const numPatternMatch = pattern.match(/\*num-(\d+)\*/g);
  if (numPatternMatch) {
    numPatternMatch.forEach(match => {
      const digits = match.match(/\*num-(\d+)\*/)[1];
      const paddedNum = String(index + 1).padStart(parseInt(digits), '0');
      result = result.replace(new RegExp(match.replace(/\*/g, '\\*'), 'g'), paddedNum);
    });
  }
  
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'g');
    result = result.replace(regex, value);
  }
  
  return sanitizeFilename(result);
}

function extractGalleryName(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p && p.length > 0);
    
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart.match(/^[\w-]+$/)) {
        return lastPart;
      }
    }
    
    return urlObj.hostname.split('.')[0];
  } catch (e) {
    return 'gallery';
  }
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

function sanitizePath(path) {
  return path
    .split('/')
    .map(part => sanitizeFilename(part))
    .filter(part => part.length > 0)
    .join('/');
}

function exportCSV(images) {
  if (images.length === 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'StepFour Export Failed',
      message: 'No images to export'
    });
    return;
  }
  
  const headers = ['Filename', 'File URL', 'Thumbnail URL', 'Caption', 'Source Page'];
  const rows = images.map((img, index) => {
    const filename = generateFilename(img, index);
    return [
      filename,
      img.fileUrl,
      img.thumbnailUrl || img.fileUrl,
      img.caption || '',
      img.sourcePage || ''
    ];
  });
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  
  chrome.downloads.download({
    url: url,
    filename: `gallery-export-${timestamp}.csv`,
    saveAs: true
  }).then(() => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'StepFour CSV Export Complete',
      message: `Exported ${images.length} images to CSV`
    });
  });
}
