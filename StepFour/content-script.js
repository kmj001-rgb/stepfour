let isPaginating = false;
let paginationMethod = 'auto';
let currentPage = 1;
let collectedImageUrls = new Set();
let paginationAttempts = 0;
let contentHashHistory = new Set();
let detectedAPIEndpoints = [];
const MAX_PAGINATION_ATTEMPTS = 50;

chrome.runtime.sendMessage({ type: 'INIT_TAB' }).catch(() => {});

injectNetworkMonitor();
detectAndAnalyzeGallery();

function injectNetworkMonitor() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const originalFetch = window.fetch;
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const clonedResponse = response.clone();
        
        try {
          const url = typeof args[0] === 'string' ? args[0] : args[0].url;
          const contentType = clonedResponse.headers.get('content-type');
          
          if (contentType && contentType.includes('application/json')) {
            const data = await clonedResponse.json();
            window.postMessage({
              type: 'STEPFOUR_API_RESPONSE',
              url: url,
              data: data
            }, '*');
          }
        } catch (e) {}
        
        return response;
      };
      
      XMLHttpRequest.prototype.open = function(method, url) {
        this._stepfourUrl = url;
        this._stepfourMethod = method;
        return originalXHROpen.apply(this, arguments);
      };
      
      XMLHttpRequest.prototype.send = function() {
        const xhr = this;
        const originalOnLoad = xhr.onload;
        
        xhr.addEventListener('load', function() {
          try {
            const contentType = xhr.getResponseHeader('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = JSON.parse(xhr.responseText);
              window.postMessage({
                type: 'STEPFOUR_API_RESPONSE',
                url: xhr._stepfourUrl,
                data: data
              }, '*');
            }
          } catch (e) {}
        });
        
        return originalXHRSend.apply(this, arguments);
      };
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();
}

let capturedAPIResponses = [];
let latestPaginationInfo = null;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'STEPFOUR_API_RESPONSE') {
    handleAPIResponse(event.data);
  }
});

function handleAPIResponse(response) {
  capturedAPIResponses.push(response);
  
  const { url, data } = response;
  
  if (!detectedAPIEndpoints.includes(url)) {
    detectedAPIEndpoints.push(url);
  }
  
  const paginationInfo = extractPaginationInfo(data);
  if (paginationInfo) {
    latestPaginationInfo = { ...paginationInfo, endpoint: url };
    console.log('StepFour: Pagination info extracted from API response:', latestPaginationInfo);
  }
  
  const imageUrls = extractImageUrlsFromJSON(data);
  if (imageUrls.length > 0 && isPaginating) {
    const images = imageUrls.map((url) => {
      const filename = url.split('/').pop().split('?')[0] || 'image.jpg';
      return {
        filename,
        fileUrl: url.startsWith('http') ? url : new URL(url, window.location.href).href,
        thumbnailUrl: url.startsWith('http') ? url : new URL(url, window.location.href).href,
        caption: '',
        sourcePage: window.location.href,
        pageNumber: currentPage
      };
    });
    
    chrome.runtime.sendMessage({
      type: 'IMAGES_FOUND',
      images: images
    }).catch(() => {});
  }
}

function extractPaginationInfo(data) {
  const info = {
    nextPage: null,
    nextUrl: null,
    nextToken: null,
    nextCursor: null,
    totalPages: null,
    currentPage: null
  };
  
  if (data.next || data.nextPage || data.next_page) {
    info.nextUrl = data.next || data.nextPage || data.next_page;
  }
  
  if (data.pagination) {
    info.nextUrl = data.pagination.next || data.pagination.nextPage;
    info.totalPages = data.pagination.totalPages || data.pagination.total_pages;
    info.currentPage = data.pagination.currentPage || data.pagination.current_page;
    info.nextToken = data.pagination.nextToken || data.pagination.next_token;
  }
  
  if (data.cursor || data.nextCursor || data.next_cursor) {
    info.nextCursor = data.cursor || data.nextCursor || data.next_cursor;
  }
  
  if (data.paging) {
    info.nextUrl = data.paging.next;
    info.nextCursor = data.paging.cursors?.after;
  }
  
  if (Object.values(info).some(v => v !== null)) {
    return info;
  }
  
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_ENDPOINT_DETECTED') {
    if (!detectedAPIEndpoints.includes(message.endpoint)) {
      detectedAPIEndpoints.push(message.endpoint);
      console.log('StepFour: API endpoint detected:', message.endpoint);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'START_PAGINATION') {
    isPaginating = true;
    paginationMethod = message.method || 'auto';
    paginationAttempts = 0;
    currentPage = 1;
    latestPaginationInfo = null;
    startPagination();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'STOP_PAGINATION') {
    isPaginating = false;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'DETECT_GALLERY') {
    detectAndAnalyzeGallery();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'EXTRACT_IMAGES') {
    const images = extractImages();
    sendResponse({ images });
    return true;
  }
});

async function detectAndAnalyzeGallery() {
  const detection = {
    isGallery: false,
    galleryType: 'Unknown',
    confidence: 'Low',
    imageCount: 0,
    paginationMethods: {}
  };
  
  const images = document.querySelectorAll('img');
  const links = document.querySelectorAll('a');
  const textLength = document.body.innerText.length || 1;
  
  detection.imageCount = images.length;
  
  if (images.length > 10) {
    detection.isGallery = true;
    detection.confidence = 'Medium';
    
    const imageDensity = images.length / Math.max(textLength / 100, 1);
    if (imageDensity > 2) {
      detection.confidence = 'High';
    }
  }
  
  const gridContainers = document.querySelectorAll('.gallery, .image-grid, .grid, .photos, [class*="gallery"], [class*="grid"], [class*="photo"], .thumbnails, .image-list');
  if (gridContainers.length > 0) {
    detection.isGallery = true;
    detection.galleryType = 'Grid Gallery';
    detection.confidence = 'High';
  }
  
  const flexGrids = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return (style.display === 'grid' || style.display === 'flex') && 
           el.querySelectorAll('img').length > 5;
  });
  if (flexGrids.length > 0) {
    detection.isGallery = true;
    detection.galleryType = 'CSS Grid Gallery';
    detection.confidence = 'High';
  }
  
  const urlPatterns = ['/gallery', '/photos', '/images', '/album', '/portfolio', '/search'];
  if (urlPatterns.some(pattern => window.location.pathname.toLowerCase().includes(pattern))) {
    detection.isGallery = true;
    if (detection.confidence === 'Low') {
      detection.confidence = 'Medium';
    }
  }
  
  if (document.querySelector('.lightbox, [class*="lightbox"], [class*="modal"], [data-fancybox]')) {
    detection.isGallery = true;
    detection.galleryType = 'Lightbox Gallery';
    detection.confidence = 'High';
  }
  
  const lazyImages = document.querySelectorAll('[loading="lazy"], [data-src], [data-lazy-src]').length;
  if (lazyImages > 10) {
    detection.isGallery = true;
    if (detection.confidence === 'Low') {
      detection.confidence = 'Medium';
    }
  }
  
  detection.paginationMethods = await detectPaginationMethods();
  
  if (detection.paginationMethods.nextButton.available) {
    detection.galleryType = 'Paginated Gallery';
  } else if (detection.paginationMethods.loadMore.available) {
    detection.galleryType = 'Load More Gallery';
  } else if (detection.paginationMethods.infiniteScroll.detected) {
    detection.galleryType = 'Infinite Scroll Gallery';
  }
  
  chrome.runtime.sendMessage({
    type: 'GALLERY_DETECTED',
    data: detection
  }).catch(() => {});
  
  extractAndSendImages();
}

async function detectPaginationMethods() {
  const methods = {
    nextButton: { available: false, selector: null },
    loadMore: { available: false, selector: null },
    infiniteScroll: { available: false, detected: false },
    arrow: { available: false, selector: null },
    urlPattern: { available: false, pattern: null },
    api: { available: false, endpoint: null }
  };
  
  const nextSelectors = [
    'a[rel="next"]',
    'link[rel="next"]',
    'a.next',
    'a.pagination-next',
    'a.page-next',
    'button.next',
    'a[aria-label*="next" i]',
    'a[title*="next" i]',
    '.pagination .next a',
    '.pager .next',
    'nav a[rel="next"]'
  ];
  
  for (const selector of nextSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        methods.nextButton.available = true;
        methods.nextButton.selector = selector;
        break;
      }
    } catch (e) {}
  }
  
  if (!methods.nextButton.available) {
    const allLinks = document.querySelectorAll('a, button');
    const nextPatterns = [
      /^next$/i,
      /^next\s+page$/i,
      /^→$/,
      /^›$/,
      /^»$/,
      /^continue$/i,
      /^siguiente$/i,
      /^suivant$/i,
      /^weiter$/i
    ];
    
    for (const link of allLinks) {
      const text = link.textContent.trim();
      if (nextPatterns.some(pattern => pattern.test(text)) && isElementVisible(link)) {
        methods.nextButton.available = true;
        methods.nextButton.selector = null;
        methods.nextButton.element = link;
        break;
      }
    }
  }
  
  const loadMoreSelectors = [
    'button[class*="load-more" i]',
    'a[class*="load-more" i]',
    'button[data-action="load-more"]',
    '[class*="show-more" i]',
    '[class*="view-more" i]',
    'button[aria-label*="load more" i]',
    '.infinite-scroll-button',
    '.load-more-btn'
  ];
  
  for (const selector of loadMoreSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        methods.loadMore.available = true;
        methods.loadMore.selector = selector;
        break;
      }
    } catch (e) {}
  }
  
  if (!methods.loadMore.available) {
    const allButtons = document.querySelectorAll('button, a');
    const loadMorePatterns = [
      /load\s+more/i,
      /show\s+more/i,
      /view\s+more/i,
      /see\s+more/i,
      /more\s+results/i
    ];
    
    for (const button of allButtons) {
      const text = button.textContent.trim();
      if (loadMorePatterns.some(pattern => pattern.test(text)) && isElementVisible(button)) {
        methods.loadMore.available = true;
        methods.loadMore.selector = null;
        methods.loadMore.element = button;
        break;
      }
    }
  }
  
  const arrowSelectors = [
    '[aria-label*="next" i]',
    '[aria-label*="forward" i]',
    '.arrow-right',
    '.next-arrow',
    '.chevron-right'
  ];
  
  for (const selector of arrowSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        methods.arrow.available = true;
        methods.arrow.selector = selector;
        break;
      }
    } catch (e) {}
  }
  
  if (!methods.arrow.available) {
    const allElements = document.querySelectorAll('a, button');
    const arrowSymbols = ['>', '›', '»', '→', '⟩', '⇨', '➔'];
    
    for (const el of allElements) {
      const text = el.textContent.trim();
      if (arrowSymbols.includes(text) && isElementVisible(el)) {
        methods.arrow.available = true;
        methods.arrow.selector = null;
        methods.arrow.element = el;
        break;
      }
    }
  }
  
  const url = window.location.href;
  const urlPatterns = [
    { pattern: /[?&]page=(\d+)/, param: 'page' },
    { pattern: /\/page\/(\d+)/, param: 'page' },
    { pattern: /[?&]p=(\d+)/, param: 'p' },
    { pattern: /\/p\/(\d+)/, param: 'p' },
    { pattern: /[?&]offset=(\d+)/, param: 'offset' },
    { pattern: /[?&]start=(\d+)/, param: 'start' },
    { pattern: /-(\d+)\.html?$/, param: 'page' }
  ];
  
  for (const { pattern, param } of urlPatterns) {
    const match = url.match(pattern);
    if (match) {
      methods.urlPattern.available = true;
      methods.urlPattern.pattern = pattern;
      methods.urlPattern.param = param;
      methods.urlPattern.currentPage = parseInt(match[1]);
      break;
    }
  }
  
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  if (scrollHeight > clientHeight * 1.5) {
    methods.infiniteScroll.detected = true;
    methods.infiniteScroll.available = true;
  }
  
  const apiDetection = detectAPIEndpoint();
  if (apiDetection.detected) {
    methods.api.available = true;
    methods.api.endpoint = apiDetection.endpoint;
    methods.api.nextUrl = apiDetection.nextUrl;
    methods.api.pageParam = apiDetection.pageParam;
  }
  
  return methods;
}

function isElementVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetParent !== null;
}

function detectAPIEndpoint() {
  const result = {
    detected: false,
    endpoint: null,
    nextUrl: null,
    pageParam: 'page'
  };
  
  if (detectedAPIEndpoints.length > 0) {
    result.detected = true;
    result.endpoint = detectedAPIEndpoints[0];
    
    const url = new URL(result.endpoint);
    if (url.searchParams.has('page')) {
      result.pageParam = 'page';
      result.nextUrl = result.endpoint;
    } else if (url.searchParams.has('offset')) {
      result.pageParam = 'offset';
      result.nextUrl = result.endpoint;
    } else if (url.searchParams.has('p')) {
      result.pageParam = 'p';
      result.nextUrl = result.endpoint;
    }
    return result;
  }
  
  if (window.__NEXT_DATA__ || window.__INITIAL_STATE__ || window.__APOLLO_STATE__) {
    result.detected = true;
    result.endpoint = window.location.pathname + '/api';
  }
  
  return result;
}

function extractAndSendImages() {
  const images = extractImages();
  
  if (images.length > 0) {
    chrome.runtime.sendMessage({
      type: 'IMAGES_FOUND',
      images: images
    }).catch(() => {});
  }
}

function extractImages() {
  const images = [];
  const sourcePage = window.location.href;
  
  const imageElements = document.querySelectorAll('img');
  imageElements.forEach((img) => {
    let fileUrl = img.src || 
                  img.dataset.src || 
                  img.dataset.lazySrc || 
                  img.dataset.original || 
                  img.dataset.full || 
                  img.dataset.fullSrc ||
                  img.getAttribute('data-src') ||
                  img.getAttribute('data-lazy');
    
    if (!fileUrl || fileUrl.startsWith('data:') || fileUrl.length < 10) {
      return;
    }
    
    if (!fileUrl.startsWith('http')) {
      try {
        fileUrl = new URL(fileUrl, window.location.href).href;
      } catch (e) {
        return;
      }
    }
    
    if (collectedImageUrls.has(fileUrl)) {
      return;
    }
    
    collectedImageUrls.add(fileUrl);
    
    const thumbnailUrl = img.src;
    const caption = img.alt || img.title || '';
    const filename = fileUrl.split('/').pop().split('?')[0] || 'image.jpg';
    
    const parentLink = img.closest('a');
    let fullResUrl = fileUrl;
    if (parentLink && parentLink.href) {
      const linkHref = parentLink.href;
      if (linkHref.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
        fullResUrl = linkHref;
      } else if (parentLink.dataset.full || parentLink.dataset.original) {
        fullResUrl = parentLink.dataset.full || parentLink.dataset.original;
      }
    }
    
    const srcset = img.srcset || img.dataset.srcset;
    if (srcset) {
      const srcsetUrls = parseSrcset(srcset);
      if (srcsetUrls.length > 0) {
        fullResUrl = srcsetUrls[srcsetUrls.length - 1];
      }
    }
    
    images.push({
      filename,
      fileUrl: fullResUrl,
      thumbnailUrl,
      caption,
      sourcePage,
      pageNumber: currentPage
    });
  });
  
  const bgImages = document.querySelectorAll('[style*="background-image"]');
  bgImages.forEach((el) => {
    const style = el.style.backgroundImage;
    const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (urlMatch) {
      let fileUrl = urlMatch[1];
      
      if (fileUrl.startsWith('data:') || fileUrl.length < 10) {
        return;
      }
      
      if (!fileUrl.startsWith('http')) {
        try {
          fileUrl = new URL(fileUrl, window.location.href).href;
        } catch (e) {
          return;
        }
      }
      
      if (collectedImageUrls.has(fileUrl)) {
        return;
      }
      
      collectedImageUrls.add(fileUrl);
      
      const filename = fileUrl.split('/').pop().split('?')[0] || 'image.jpg';
      
      images.push({
        filename,
        fileUrl,
        thumbnailUrl: fileUrl,
        caption: el.alt || el.title || el.getAttribute('aria-label') || '',
        sourcePage,
        pageNumber: currentPage
      });
    }
  });
  
  const pictureElements = document.querySelectorAll('picture');
  pictureElements.forEach((picture) => {
    const sources = picture.querySelectorAll('source[srcset], source[src]');
    sources.forEach((source) => {
      const srcset = source.getAttribute('srcset') || source.getAttribute('src');
      if (srcset) {
        const urls = parseSrcset(srcset);
        urls.forEach((url) => {
          if (!collectedImageUrls.has(url)) {
            collectedImageUrls.add(url);
            images.push({
              filename: url.split('/').pop().split('?')[0] || 'image.jpg',
              fileUrl: url,
              thumbnailUrl: url,
              caption: '',
              sourcePage,
              pageNumber: currentPage
            });
          }
        });
      }
    });
  });
  
  return images;
}

function parseSrcset(srcset) {
  const urls = [];
  const parts = srcset.split(',');
  parts.forEach((part) => {
    const urlMatch = part.trim().match(/^([^\s]+)/);
    if (urlMatch) {
      let url = urlMatch[1];
      if (!url.startsWith('http')) {
        try {
          url = new URL(url, window.location.href).href;
        } catch (e) {
          return;
        }
      }
      urls.push(url);
    }
  });
  return urls;
}

async function startPagination() {
  if (!isPaginating || paginationAttempts >= MAX_PAGINATION_ATTEMPTS) {
    isPaginating = false;
    chrome.runtime.sendMessage({
      type: 'PAGINATION_STATUS',
      data: {
        status: 'complete',
        currentPage,
        message: paginationAttempts >= MAX_PAGINATION_ATTEMPTS 
          ? 'Max pages reached' 
          : 'Pagination stopped'
      }
    }).catch(() => {});
    return;
  }
  
  paginationAttempts++;
  
  chrome.runtime.sendMessage({
    type: 'PAGINATION_STATUS',
    data: {
      status: 'paginating',
      currentPage,
      method: paginationMethod
    }
  }).catch(() => {});
  
  const beforeHash = getContentHash();
  const methods = await detectPaginationMethods();
  let success = false;
  
  if (paginationMethod === 'auto') {
    if (methods.nextButton.available) {
      success = await paginateNextButton(methods.nextButton);
    } else if (methods.loadMore.available) {
      success = await paginateLoadMore(methods.loadMore);
    } else if (methods.arrow.available) {
      success = await paginateArrow(methods.arrow);
    } else if (methods.urlPattern.available) {
      success = await paginateUrlPattern(methods.urlPattern);
    } else if (methods.api.available) {
      success = await paginateAPI(methods.api);
    } else if (methods.infiniteScroll.available) {
      success = await paginateInfiniteScroll();
    }
  } else {
    switch (paginationMethod) {
      case 'nextButton':
        success = await paginateNextButton(methods.nextButton);
        break;
      case 'loadMore':
        success = await paginateLoadMore(methods.loadMore);
        break;
      case 'infiniteScroll':
        success = await paginateInfiniteScroll();
        break;
      case 'arrow':
        success = await paginateArrow(methods.arrow);
        break;
      case 'urlPattern':
        success = await paginateUrlPattern(methods.urlPattern);
        break;
      case 'api':
        success = await paginateAPI(methods.api);
        break;
    }
  }
  
  if (success) {
    currentPage++;
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterHash = getContentHash();
    if (beforeHash === afterHash && contentHashHistory.has(afterHash)) {
      isPaginating = false;
      chrome.runtime.sendMessage({
        type: 'PAGINATION_STATUS',
        data: {
          status: 'complete',
          currentPage,
          message: 'No new content detected (duplicate page)'
        }
      }).catch(() => {});
      return;
    }
    contentHashHistory.add(afterHash);
    
    extractAndSendImages();
    
    if (isPaginating) {
      setTimeout(() => startPagination(), 1000);
    }
  } else {
    isPaginating = false;
    chrome.runtime.sendMessage({
      type: 'PAGINATION_STATUS',
      data: {
        status: 'complete',
        currentPage,
        message: 'No more pages found'
      }
    }).catch(() => {});
  }
}

function getContentHash() {
  const imageUrls = Array.from(document.querySelectorAll('img')).map(img => img.src).join('|');
  return simpleHash(imageUrls);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

async function paginateNextButton(method) {
  try {
    let element = null;
    
    if (method.selector) {
      element = document.querySelector(method.selector);
    } else if (method.element) {
      element = method.element;
    } else {
      const allLinks = document.querySelectorAll('a');
      for (const link of allLinks) {
        const text = link.textContent.trim().toLowerCase();
        if (text === 'next' || text === '→' || text === 'next page') {
          element = link;
          break;
        }
      }
    }
    
    if (element && !element.disabled && !element.classList.contains('disabled') && isElementVisible(element)) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 300));
      element.click();
      return true;
    }
  } catch (error) {
    console.error('Next button pagination failed:', error);
  }
  return false;
}

async function paginateLoadMore(method) {
  try {
    let element = null;
    
    if (method.selector) {
      element = document.querySelector(method.selector);
    } else if (method.element) {
      element = method.element;
    } else {
      const allButtons = document.querySelectorAll('button, a');
      for (const button of allButtons) {
        const text = button.textContent.trim().toLowerCase();
        if (text.includes('load more') || text.includes('show more')) {
          element = button;
          break;
        }
      }
    }
    
    if (element && !element.disabled && !element.classList.contains('disabled') && isElementVisible(element)) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 500));
      element.click();
      return true;
    }
  } catch (error) {
    console.error('Load more pagination failed:', error);
  }
  return false;
}

async function paginateArrow(method) {
  try {
    let element = null;
    
    if (method.selector) {
      element = document.querySelector(method.selector);
    } else if (method.element) {
      element = method.element;
    } else {
      const allElements = document.querySelectorAll('a, button');
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text === '>' || text === '›' || text === '»') {
          element = el;
          break;
        }
      }
    }
    
    if (element && !element.disabled && !element.classList.contains('disabled') && isElementVisible(element)) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 300));
      element.click();
      return true;
    }
  } catch (error) {
    console.error('Arrow pagination failed:', error);
  }
  return false;
}

async function paginateUrlPattern(method) {
  try {
    if (method.pattern && method.currentPage) {
      const nextPage = method.currentPage + 1;
      const currentUrl = window.location.href;
      const nextUrl = currentUrl.replace(method.pattern, (match, page) => {
        return match.replace(page, nextPage);
      });
      
      if (nextUrl !== currentUrl) {
        window.location.href = nextUrl;
        return true;
      }
    }
  } catch (error) {
    console.error('URL pattern pagination failed:', error);
  }
  return false;
}

async function paginateInfiniteScroll() {
  try {
    const beforeHeight = document.documentElement.scrollHeight;
    const beforeImageCount = document.querySelectorAll('img').length;
    
    window.scrollTo(0, document.documentElement.scrollHeight);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterHeight = document.documentElement.scrollHeight;
    const afterImageCount = document.querySelectorAll('img').length;
    
    return afterHeight > beforeHeight || afterImageCount > beforeImageCount;
  } catch (error) {
    console.error('Infinite scroll pagination failed:', error);
  }
  return false;
}

async function paginateAPI(method) {
  try {
    let apiUrl = null;
    let requestOptions = {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    
    if (latestPaginationInfo && latestPaginationInfo.nextUrl) {
      apiUrl = latestPaginationInfo.nextUrl;
      if (!apiUrl.startsWith('http')) {
        apiUrl = new URL(apiUrl, window.location.href).href;
      }
    } else if (latestPaginationInfo && latestPaginationInfo.nextCursor) {
      const baseUrl = latestPaginationInfo.endpoint || method.endpoint;
      const url = new URL(baseUrl, window.location.href);
      url.searchParams.set('cursor', latestPaginationInfo.nextCursor);
      apiUrl = url.href;
    } else if (latestPaginationInfo && latestPaginationInfo.nextToken) {
      const baseUrl = latestPaginationInfo.endpoint || method.endpoint;
      const url = new URL(baseUrl, window.location.href);
      url.searchParams.set('token', latestPaginationInfo.nextToken);
      apiUrl = url.href;
    } else if (method.endpoint) {
      apiUrl = method.endpoint;
      if (method.nextUrl) {
        const urlObj = new URL(method.nextUrl, window.location.href);
        const currentPageNum = parseInt(urlObj.searchParams.get(method.pageParam) || '1');
        const nextPageNum = currentPageNum + 1;
        urlObj.searchParams.set(method.pageParam, nextPageNum.toString());
        apiUrl = urlObj.toString();
      } else if (method.pageParam) {
        const separator = apiUrl.includes('?') ? '&' : '?';
        apiUrl = `${apiUrl}${separator}${method.pageParam}=${currentPage + 1}`;
      }
    }
    
    if (!apiUrl) {
      return false;
    }
    
    console.log('StepFour: Making API request to:', apiUrl);
    
    const response = await fetch(apiUrl, requestOptions);
    
    if (!response.ok) {
      console.error('StepFour: API request failed:', response.status);
      return false;
    }
    
    const data = await response.json();
    
    const paginationInfo = extractPaginationInfo(data);
    if (paginationInfo) {
      latestPaginationInfo = { ...paginationInfo, endpoint: apiUrl };
    }
    
    const imageUrls = extractImageUrlsFromJSON(data);
    
    if (imageUrls.length > 0) {
      const images = imageUrls.map((url) => {
        const filename = url.split('/').pop().split('?')[0] || 'image.jpg';
        return {
          filename,
          fileUrl: url.startsWith('http') ? url : new URL(url, window.location.href).href,
          thumbnailUrl: url.startsWith('http') ? url : new URL(url, window.location.href).href,
          caption: '',
          sourcePage: window.location.href,
          pageNumber: currentPage + 1
        };
      });
      
      chrome.runtime.sendMessage({
        type: 'IMAGES_FOUND',
        images: images
      }).catch(() => {});
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('API pagination failed:', error);
  }
  return false;
}

function extractImageUrlsFromJSON(data) {
  const urls = [];
  
  function traverse(obj) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item));
      return;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      
      if ((keyLower.includes('image') || keyLower.includes('photo') || keyLower.includes('picture') || 
           keyLower === 'url' || keyLower === 'src') && typeof value === 'string') {
        if (value.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i) || value.includes('/image')) {
          if (!urls.includes(value)) {
            urls.push(value);
          }
        }
      }
      
      if (typeof value === 'object') {
        traverse(value);
      }
    }
  }
  
  if (data.images || data.photos || data.items || data.results || data.data) {
    const imageArray = data.images || data.photos || data.items || data.results || data.data;
    if (Array.isArray(imageArray)) {
      traverse(imageArray);
    }
  } else {
    traverse(data);
  }
  
  return urls;
}
