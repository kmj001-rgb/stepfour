// Function to get all images from the page
function getAllImages() {
  const images = [];
  const seen = new Set();
  
  try {
    // Get all img elements
    document.querySelectorAll('img').forEach(img => {
      try {
        if (img.src && !img.src.startsWith('data:')) {
          if (!seen.has(img.src)) {
            seen.add(img.src);
            images.push({
              src: img.src,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              alt: img.alt || '',
              title: img.title || ''
            });
          }
        }
      } catch (error) {
        console.warn('Error processing image:', error);
      }
    });

    // Get background images
    document.querySelectorAll('*').forEach(element => {
      try {
        const style = window.getComputedStyle(element);
        const bgImage = style.backgroundImage;
        
        if (bgImage && bgImage !== 'none') {
          const url = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
          if (url && url[1] && !url[1].startsWith('data:')) {
            if (!seen.has(url[1])) {
              seen.add(url[1]);
              images.push({
                src: url[1],
                width: element.offsetWidth,
                height: element.offsetHeight,
                alt: 'Background image',
                title: ''
              });
            }
          }
        }
      } catch (error) {
        console.warn('Error processing background image:', error);
      }
    });
  } catch (error) {
    console.error('Error in getAllImages:', error);
  }

  return images;
}

// Function to handle messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getImages') {
    try {
      const images = getAllImages();
      sendResponse({ images });
    } catch (error) {
      console.error('Error processing getImages request:', error);
      sendResponse({ error: error.message });
    }
  }
  return true; // Required for async response
}); 