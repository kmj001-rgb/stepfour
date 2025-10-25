let isPaginating = false;
let paginationMethod = 'auto';
let currentPage = 1;
let collectedImageUrls = new Set();
let paginationAttempts = 0;
const MAX_PAGINATION_ATTEMPTS = 50;

chrome.runtime.sendMessage({ type: 'INIT_TAB' }).catch(() => {});

detectAndAnalyzeGallery();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_PAGINATION') {
    isPaginating = true;
    paginationMethod = message.method || 'auto';
    paginationAttempts = 0;
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
  const textLength = document.body.innerText.length;
  
  detection.imageCount = images.length;
  
  if (images.length > 10) {
    detection.isGallery = true;
    detection.confidence = 'Medium';
    
    const imageDensity = images.length / Math.max(textLength / 100, 1);
    if (imageDensity > 2) {
      detection.confidence = 'High';
    }
  }
  
  const gridContainers = document.querySelectorAll('.gallery, .image-grid, .grid, .photos, [class*="gallery"], [class*="grid"]');
  if (gridContainers.length > 0) {
    detection.isGallery = true;
    detection.galleryType = 'Grid Gallery';
    detection.confidence = 'High';
  }
  
  const urlPatterns = ['/gallery', '/photos', '/images', '/album', '/portfolio'];
  if (urlPatterns.some(pattern => window.location.pathname.includes(pattern))) {
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
    'a.next',
    'a.pagination-next',
    'button.next',
    'a:contains("Next")',
    'a[aria-label*="next" i]',
    'a[title*="next" i]'
  ];
  
  for (const selector of nextSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        methods.nextButton.available = true;
        methods.nextButton.selector = selector;
        break;
      }
    } catch (e) {}
  }
  
  if (!methods.nextButton.available) {
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      const text = link.textContent.trim().toLowerCase();
      if (text === 'next' || text === '→' || text === 'next page' || text === 'continue') {
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
    '[class*="view-more" i]'
  ];
  
  for (const selector of loadMoreSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        methods.loadMore.available = true;
        methods.loadMore.selector = selector;
        break;
      }
    } catch (e) {}
  }
  
  if (!methods.loadMore.available) {
    const allButtons = document.querySelectorAll('button, a');
    for (const button of allButtons) {
      const text = button.textContent.trim().toLowerCase();
      if (text.includes('load more') || text.includes('show more') || text.includes('view more')) {
        methods.loadMore.available = true;
        methods.loadMore.selector = null;
        methods.loadMore.element = button;
        break;
      }
    }
  }
  
  const arrowSelectors = [
    'a:contains("›")',
    'a:contains("»")',
    'button:contains("›")',
    'button:contains("»")',
    '[class*="arrow-right"]',
    '[class*="next-arrow"]'
  ];
  
  for (const selector of arrowSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        methods.arrow.available = true;
        methods.arrow.selector = selector;
        break;
      }
    } catch (e) {}
  }
  
  if (!methods.arrow.available) {
    const allElements = document.querySelectorAll('a, button');
    for (const el of allElements) {
      const text = el.textContent.trim();
      if (text === '>' || text === '›' || text === '»' || text === '→') {
        methods.arrow.available = true;
        methods.arrow.selector = null;
        methods.arrow.element = el;
        break;
      }
    }
  }
  
  const url = window.location.href;
  const urlPatterns = [
    /[?&]page=(\d+)/,
    /\/page\/(\d+)/,
    /[?&]p=(\d+)/,
    /\/p\/(\d+)/,
    /-(\d+)\.html?$/
  ];
  
  for (const pattern of urlPatterns) {
    const match = url.match(pattern);
    if (match) {
      methods.urlPattern.available = true;
      methods.urlPattern.pattern = pattern;
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

function detectAPIEndpoint() {
  const result = {
    detected: false,
    endpoint: null,
    nextUrl: null,
    pageParam: 'page'
  };
  
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent;
    
    const apiPatterns = [
      /["']api["']\s*:\s*["']([^"']+)["']/i,
      /fetch\s*\(\s*["']([^"']+\/api\/[^"']+)["']/i,
      /axios\.\w+\s*\(\s*["']([^"']+)["']/i,
      /"endpoint":\s*"([^"]+)"/i,
      /"nextPage":\s*"([^"]+)"/i
    ];
    
    for (const pattern of apiPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        result.detected = true;
        result.endpoint = match[1];
        
        if (match[1].includes('?')) {
          result.nextUrl = match[1];
        }
        break;
      }
    }
    
    if (result.detected) break;
  }
  
  if (!result.detected) {
    const currentUrl = window.location.href;
    const apiIndicators = ['/api/', '/json/', '/data/', '/feed/'];
    
    if (apiIndicators.some(indicator => currentUrl.includes(indicator))) {
      result.detected = true;
      result.endpoint = currentUrl;
      
      const urlObj = new URL(currentUrl);
      if (urlObj.searchParams.has('page')) {
        result.pageParam = 'page';
        result.nextUrl = currentUrl;
      } else if (urlObj.searchParams.has('offset')) {
        result.pageParam = 'offset';
        result.nextUrl = currentUrl;
      }
    }
  }
  
  if (window.__NEXT_DATA__ || window.__INITIAL_STATE__) {
    result.detected = true;
    result.endpoint = window.location.pathname + '/api/images';
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
  const imageElements = document.querySelectorAll('img');
  const sourcePage = window.location.href;
  
  imageElements.forEach((img) => {
    let fileUrl = img.src || img.dataset.src || img.dataset.lazy || img.dataset.original || img.dataset.full;
    
    if (!fileUrl || fileUrl.startsWith('data:') || fileUrl.length < 10) {
      return;
    }
    
    if (!fileUrl.startsWith('http')) {
      fileUrl = new URL(fileUrl, window.location.href).href;
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
        fileUrl = new URL(fileUrl, window.location.href).href;
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
        caption: el.alt || el.title || '',
        sourcePage,
        pageNumber: currentPage
      });
    }
  });
  
  return images;
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
    
    if (element && !element.disabled && !element.classList.contains('disabled')) {
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
    
    if (element && !element.disabled && !element.classList.contains('disabled') && element.offsetParent !== null) {
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
    
    if (element && !element.disabled && !element.classList.contains('disabled')) {
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
    window.scrollTo(0, document.documentElement.scrollHeight);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterHeight = document.documentElement.scrollHeight;
    
    return afterHeight > beforeHeight;
  } catch (error) {
    console.error('Infinite scroll pagination failed:', error);
  }
  return false;
}

async function paginateAPI(method) {
  try {
    if (!method.endpoint) {
      return false;
    }
    
    let apiUrl = method.endpoint;
    
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
    
    const response = await fetch(apiUrl, {
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    
    const imageUrls = extractImageUrlsFromJSON(data);
    
    if (imageUrls.length > 0) {
      const images = imageUrls.map((url, index) => {
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
      
      if (data.next || data.nextPage || data.pagination?.next) {
        method.nextUrl = data.next || data.nextPage || data.pagination.next;
      }
      
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
