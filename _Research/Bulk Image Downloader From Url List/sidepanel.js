document.addEventListener('DOMContentLoaded', function () {
  // Constants
  const MAX_URLS_FREE = 5
  const BASE_URL = 'https://bulkimagedownloaderurllist.com'
  const EXTENSION_ID = chrome.runtime.id

  // DOM Elements
  const downloadButton = document.getElementById('downloadButton')
  const stripDuplicatesButton = document.getElementById('stripDuplicatesButton')
  const imageLinksTextarea = document.getElementById('imageLinks')
  const progressBar = document.getElementById('progressBar')
  const allFormatsCheckbox = document.getElementById('allFormatsCheckbox')
  const prefixInput = document.getElementById('prefix')
  const suffixInput = document.getElementById('suffix')
  const folderNameInput = document.getElementById('folderName')
  const urlCountSpan = document.getElementById('urlCount')
  const duplicateCountSpan = document.getElementById('duplicateCount')
  const duplicateFilenameCountSpan = document.createElement('span')
  const duplicateHandlingContainer = document.getElementById(
    'duplicateHandlingContainer'
  )
  const darkModeToggle = document.getElementById('darkModeToggle')
  const downloadZipButton = document.getElementById('download-zip-btn')
  const duplicateHandlingDropdown = document.getElementById('duplicateHandling')
  const loginBtn = document.getElementById('loginBtn')
  const logoutBtn = document.getElementById('logoutBtn')
  const authStatus = document.getElementById('authStatus')
  const refreshBtn = document.getElementById('refreshBtn')
  const tabButtons = document.querySelectorAll('.tab-button')
  const tabContents = document.querySelectorAll('.tab-content')

  // Initialize
  duplicateCountSpan.after(duplicateFilenameCountSpan)

  if (duplicateCountSpan) {
    duplicateCountSpan.after(duplicateFilenameCountSpan)
  }

  if (duplicateHandlingContainer) {
    duplicateHandlingContainer.style.display = 'none'
  }

  duplicateFilenameCountSpan.classList.add('duplicate-filename-count')
  if (duplicateHandlingContainer) {
    duplicateHandlingContainer.style.display = 'none'
  }
  let filenameMap = {}
  let customText = ''
  let addedItems = []

  // Current code (already in your file):
  let scanActive = false
  let foundImages = []
  let allFoundImages = [] // Add this line
  let currentScanObserver = null

  //Navigate tabs

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab')

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'))
      tabContents.forEach(content => content.classList.remove('active'))

      // Add active class to clicked button and corresponding content
      button.classList.add('active')
      document.getElementById(tabId).classList.add('active')
    })
  })

  // Set the second tab as active by default
  document.querySelector('.tab-button[data-tab="tab2"]').click()

  // Add this near your other DOM element declarations
  const scanPageBtn = document.getElementById('scanPageBtn')
  const deepScanBtn = document.getElementById('deepScanBtn')
  const stopScanBtn = document.getElementById('stopScanBtn')
  const imageGrid = document.getElementById('imageGrid')
  const progressText = document.querySelector('.progress-text')
  const imageCount = document.querySelector('.image-count')
  const progressFill = document.querySelector('.progress-fill')
  const copyAllBtn = document.getElementById('copyAllBtn')
  const downloadAllBtn = document.getElementById('downloadAllBtn')
  const exportCSVBtn = document.getElementById('exportCSVBtn')
  const clearImagesBtn = document.getElementById('clearImagesBtn')

  // Add this with your other event listeners
  exportCSVBtn.addEventListener('click', exportImageResultsToCSV)
  clearImagesBtn.addEventListener('click', clearAllImages)
  scanPageBtn.addEventListener('click', professionalScanCurrentPage)
  deepScanBtn.addEventListener('click', deepScanCurrentPage)
  copyAllBtn.addEventListener('click', copyAllImageUrls)
  downloadAllBtn.addEventListener('click', sendToDownloader)
  stopScanBtn.addEventListener('click', stopScan)

  const areaScanBtn = document.getElementById('areaScanBtn')
  areaScanBtn.addEventListener('click', startAreaScan)

  // Modify the createTaskFromImages function in sidepanel.js
  async function createTaskFromImages () {
    if (allFoundImages.length === 0) {
      alert(
        'No images found yet. Please scan the page first using the "Scan Current Page" or "Deep Scan" buttons to collect images before creating a task'
      )
      return
    }

    const createTaskBtn = document.getElementById('createTaskBtn')
    const originalText = createTaskBtn.textContent
    createTaskBtn.textContent = 'Creating...'
    createTaskBtn.disabled = true

    try {
      // 1. Force fresh license check
      const licenseCheck = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'validateSession' }, resolve)
      })

      const isLicensed = licenseCheck?.license?.license_status === 'sold'
      let urls = allFoundImages.map(img => img.src)

      // 2. GET ALL TASKS
      const tasks = await new Promise(resolve => {
        chrome.storage.local.get('tasks', data => resolve(data.tasks || []))
      })

      // 3. CHECK FOR EXISTING TASK WITH SAME URLs (regardless of status)
      const existingTask = tasks.find(task => {
        const taskUrls = task.urls || []
        return JSON.stringify(taskUrls.sort()) === JSON.stringify(urls.sort())
      })

      if (existingTask) {
        // Focus on existing task instead of creating new one
        await chrome.storage.local.set({
          pendingTaskUrls: urls.join('\n'),
          shouldCreateNewTask: false,
          taskToUpdate: existingTask.id
        })
      } else {
        // License enforcement if exceeding limit
        if (!isLicensed && urls.length > MAX_URLS_FREE) {
          urls = urls.slice(0, MAX_URLS_FREE)
          alert(
            `Free version limited to ${MAX_URLS_FREE} URLs. Upgrade for unlimited.`
          )
        }

        if (isLicensed) {
          // Licensed users can create new tasks
          // Find an empty task first, if none, create new
          const emptyTask = tasks.find(
            task =>
              task.urls.length === 0 ||
              (task.urls.length === 1 && task.urls[0] === '')
          )

          if (emptyTask) {
            // Update existing empty task as draft
            await chrome.storage.local.set({
              pendingTaskUrls: urls.join('\n'),
              shouldCreateNewTask: false,
              taskToUpdate: emptyTask.id
            })
          } else {
            // Create new task
            await chrome.storage.local.set({
              pendingTaskUrls: urls.join('\n'),
              shouldCreateNewTask: true,
              taskToUpdate: null
            })
          }
        } else {
          // FREE USER: Always overwrite URLs into the default task
          let defaultTask = tasks[0]

          if (!defaultTask) {
            // If no default task, create one
            defaultTask = {
              id: Date.now().toString(),
              urls: [''],
              fileTypes: ['all'],
              folderName: '',
              downloadTime: '',
              zipDownload: false,
              status: 'pending',
              buildCheckbox: false,
              sortableList:
                '<li class="ui-state-default extension">.extension</li>',
              sequenceStart: '1',
              downloadIf: { enabled: false, keywords: [], logic: null },
              convert: { enabled: false, format: 'jpeg', quality: 100 }
            }
            tasks.push(defaultTask)
            await chrome.storage.local.set({ tasks })
          }

          // Overwrite URLs in the default task
          await chrome.storage.local.set({
            pendingTaskUrls: urls.join('\n'),
            shouldCreateNewTask: false,
            taskToUpdate: defaultTask.id
          })

          alert(
            'Free users can only use the default task. URLs have been added to the default task.'
          )
        }
      }

      // 4. OPEN OPTIONS PAGE (focus if already open)
      const tabs = await chrome.tabs.query({
        url: chrome.runtime.getURL('options.html')
      })
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true })
      } else {
        await chrome.tabs.create({ url: 'options.html' })
      }

      createTaskBtn.textContent = 'Task Created!'
    } catch (error) {
      console.error('Error creating task:', error)
      createTaskBtn.textContent = 'Failed!'
    } finally {
      setTimeout(() => {
        createTaskBtn.textContent = originalText
        createTaskBtn.disabled = false
      }, 2000)
    }
  }

  // Add this event listener with your other event listeners
  document
    .getElementById('createTaskBtn')
    .addEventListener('click', createTaskFromImages)

  // Professional Image Extraction Function (runs in page context)
  function professionalImageExtractor () {
    // Removed options parameter
    const results = new Set()
    const seenUrls = new Set()
    const seenHashes = new Set()

    // Simplified validation - only check for duplicates and data URLs
    function isValidImage (url) {
      if (!url || seenUrls.has(url)) return false
      if (url.startsWith('data:') && url.length > 1000000) return false
      return true
    }

    // 1. Standard Image Elements - modified to remove size checks
    function extractFromImgElements () {
      document.querySelectorAll('img').forEach(img => {
        try {
          if (!img.src || !isValidImage(img.src)) return

          results.add({
            src: img.src,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            type: 'img_element',
            element: img
          })
          seenUrls.add(img.src)

          // Check for srcset
          if (img.srcset) {
            img.srcset.split(',').forEach(entry => {
              const [url, density] = entry.trim().split(/\s+/)
              if (url && isValidImage(url)) {
                results.add({
                  src: url,
                  width: Math.round(
                    (img.naturalWidth || img.width) * parseFloat(density || '1')
                  ),
                  height: Math.round(
                    (img.naturalHeight || img.height) *
                      parseFloat(density || '1')
                  ),
                  type: 'srcset',
                  element: img
                })
                seenUrls.add(url)
              }
            })
          }
        } catch (e) {
          console.warn('Error processing img element:', e)
        }
      })
    }

    // 2. CSS Background Images - modified to remove size checks
    function extractFromBackgrounds () {
      const elements = document.querySelectorAll('*')
      elements.forEach(el => {
        try {
          const style = window.getComputedStyle(el)
          const bgImage = style.backgroundImage || style.backgroundColor

          if (bgImage && bgImage.includes('url(')) {
            const urlMatch = bgImage.match(/url\((["']?)(.*?)\1\)/)
            if (urlMatch && urlMatch[2]) {
              const url = urlMatch[2].trim()
              if (!url.startsWith('data:') && isValidImage(url)) {
                results.add({
                  src: url,
                  width: el.offsetWidth,
                  height: el.offsetHeight,
                  type: 'background',
                  element: el
                })
                seenUrls.add(url)
              }
            }
          }
        } catch (e) {
          console.warn('Error processing background:', e)
        }
      })
    }

    // 3. Picture/Source Elements - modified to remove size checks
    function extractFromPictureElements () {
      document.querySelectorAll('picture').forEach(picture => {
        try {
          const sources = picture.querySelectorAll('source')
          const img = picture.querySelector('img')

          if (img && img.src && isValidImage(img.src)) {
            results.add({
              src: img.src,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              type: 'picture_img',
              element: img
            })
            seenUrls.add(img.src)
          }

          sources.forEach(source => {
            if (source.srcset) {
              source.srcset.split(',').forEach(entry => {
                const [url, descriptor] = entry.trim().split(/\s+/)
                if (url && isValidImage(url)) {
                  results.add({
                    src: url,
                    width: 0, // Will be verified later
                    height: 0, // Will be verified later
                    type: 'picture_source',
                    element: source
                  })
                  seenUrls.add(url)
                }
              })
            }
          })
        } catch (e) {
          console.warn('Error processing picture element:', e)
        }
      })
    }

    // 4. JavaScript Data Structures - modified to remove size checks
    function extractFromJavaScript () {
      try {
        const scripts = document.querySelectorAll('script:not([src])')
        scripts.forEach(script => {
          const scriptText = script.textContent

          // Look for JSON structures with image URLs
          const jsonMatches =
            scriptText.match(/"image"\s*:\s*"([^"]+)"/gi) || []
          jsonMatches.forEach(match => {
            const urlMatch = match.match(/"image"\s*:\s*"([^"]+)"/i)
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1].trim()
              if (isValidImage(url)) {
                results.add({
                  src: url,
                  width: 0,
                  height: 0,
                  type: 'js_json',
                  element: script
                })
                seenUrls.add(url)
              }
            }
          })

          // Look for JS arrays with image URLs
          const arrayMatches =
            scriptText.match(
              /\[\s*"([^"]+\.(jpg|png|gif|webp|jpeg))"\s*\]/gi
            ) || []
          arrayMatches.forEach(match => {
            const urlMatch = match.match(/"([^"]+\.(jpg|png|gif|webp|jpeg))"/i)
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1].trim()
              if (isValidImage(url)) {
                results.add({
                  src: url,
                  width: 0,
                  height: 0,
                  type: 'js_array',
                  element: script
                })
                seenUrls.add(url)
              }
            }
          })
        })
      } catch (e) {
        console.warn('Error extracting from JavaScript:', e)
      }
    }

    // 5. Meta Tags and OpenGraph - modified to remove size checks
    function extractFromMetaTags () {
      const metaTags = document.querySelectorAll(
        'meta[property^="og:"], meta[name^="twitter:"], meta[itemprop="image"]'
      )
      metaTags.forEach(meta => {
        try {
          const content = meta.getAttribute('content')
          if (content && isValidImage(content)) {
            results.add({
              src: content,
              width: 0,
              height: 0,
              type: 'meta_tag',
              element: meta
            })
            seenUrls.add(content)
          }
        } catch (e) {
          console.warn('Error processing meta tag:', e)
        }
      })
    }

    // 6. Lazy-loaded Images - modified to remove size checks
    function extractLazyLoadedImages () {
      document
        .querySelectorAll('[data-src], [data-srcset], [data-original]')
        .forEach(el => {
          try {
            const src =
              el.getAttribute('data-src') ||
              el.getAttribute('data-original') ||
              el.getAttribute('data-lazy')

            if (src && isValidImage(src)) {
              results.add({
                src: src,
                width: el.offsetWidth,
                height: el.offsetHeight,
                type: 'lazy_loaded',
                element: el
              })
              seenUrls.add(src)
            }

            const srcset = el.getAttribute('data-srcset')
            if (srcset) {
              srcset.split(',').forEach(entry => {
                const [url, descriptor] = entry.trim().split(/\s+/)
                if (url && isValidImage(url)) {
                  results.add({
                    src: url,
                    width: el.offsetWidth,
                    height: el.offsetHeight,
                    type: 'lazy_srcset',
                    element: el
                  })
                  seenUrls.add(url)
                }
              })
            }
          } catch (e) {
            console.warn('Error processing lazy-loaded element:', e)
          }
        })
    }

    // 7. Canvas Elements - unchanged
    function extractFromCanvas () {
      document.querySelectorAll('canvas').forEach(canvas => {
        try {
          const dataUrl = canvas.toDataURL('image/png')
          if (dataUrl && dataUrl.length > 10000) {
            results.add({
              src: dataUrl,
              width: canvas.width,
              height: canvas.height,
              type: 'canvas',
              element: canvas
            })
            seenUrls.add(dataUrl)
          }
        } catch (e) {}
      })
    }

    // 8. Video Posters and Thumbnails - modified to remove size checks
    function extractFromVideoElements () {
      document.querySelectorAll('video').forEach(video => {
        try {
          const poster = video.getAttribute('poster')
          if (poster && isValidImage(poster)) {
            results.add({
              src: poster,
              width: video.offsetWidth,
              height: video.offsetHeight,
              type: 'video_poster',
              element: video
            })
            seenUrls.add(poster)
          }
        } catch (e) {
          console.warn('Error processing video element:', e)
        }
      })
    }

    // 9. SVG Elements with embedded images - modified to remove size checks
    function extractFromSVG () {
      document.querySelectorAll('svg image').forEach(svgImage => {
        try {
          const href =
            svgImage.getAttribute('href') || svgImage.getAttribute('xlink:href')
          if (href && isValidImage(href)) {
            results.add({
              src: href,
              width: svgImage.width.baseVal.value,
              height: svgImage.height.baseVal.value,
              type: 'svg_image',
              element: svgImage
            })
            seenUrls.add(href)
          }
        } catch (e) {
          console.warn('Error processing SVG image:', e)
        }
      })
    }

    // 10. Dynamic Content (MutationObserver) - modified to remove size checks
    function setupMutationObserver () {
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for lazy-loaded attributes
              const lazySrc =
                node.getAttribute('data-src') ||
                node.getAttribute('data-original') ||
                node.getAttribute('data-lazy')

              if (lazySrc) {
                results.add({
                  src: lazySrc,
                  width: node.offsetWidth,
                  height: node.offsetHeight,
                  type: 'lazy_loaded',
                  element: node
                })
                seenUrls.add(lazySrc)
              }

              extractFromNode(node)
            }
          })
        })
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true, // Watch for attribute changes
        attributeFilter: ['src', 'data-src', 'data-original', 'data-lazy'] // Specific attributes to watch
      })

      return observer
    }

    function extractFromNode (node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return

      if (node.tagName === 'IMG' && node.src && isValidImage(node.src)) {
        results.add({
          src: node.src,
          width: node.naturalWidth || node.width,
          height: node.naturalHeight || node.height,
          type: 'dynamic_img',
          element: node
        })
        seenUrls.add(node.src)
      }

      const style = window.getComputedStyle(node)
      const bgImage = style.backgroundImage
      if (bgImage && bgImage.includes('url(')) {
        const urlMatch = bgImage.match(/url\((["']?)(.*?)\1\)/)
        if (urlMatch && urlMatch[2]) {
          const url = urlMatch[2].trim()
          if (!url.startsWith('data:') && isValidImage(url)) {
            results.add({
              src: url,
              width: node.offsetWidth,
              height: node.offsetHeight,
              type: 'dynamic_background',
              element: node
            })
            seenUrls.add(url)
          }
        }
      }

      node.childNodes.forEach(child => extractFromNode(child))
    }

    // Execute all extraction methods
    extractFromImgElements()
    extractFromBackgrounds()
    extractFromPictureElements()
    extractFromJavaScript()
    extractFromMetaTags()
    extractLazyLoadedImages()
    extractFromCanvas()
    extractFromVideoElements()
    extractFromSVG()

    // Set up observer for dynamic content
    const observer = setupMutationObserver()

    return new Promise(resolve => {
      setTimeout(() => {
        observer.disconnect()
        resolve(Array.from(results))
      }, 1000)
    })
  }

  async function areaSelectAndExtract () {
    return new Promise(resolve => {
      const overlay = document.createElement('div')
      Object.assign(overlay.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.1)',
        cursor: 'crosshair',
        zIndex: 2147483647
      })
      document.body.appendChild(overlay)

      let startX, startY, selectionBox

      function mouseDownHandler (e) {
        e.preventDefault()
        startX = e.clientX
        startY = e.clientY

        selectionBox = document.createElement('div')
        Object.assign(selectionBox.style, {
          position: 'fixed',
          border: '2px dashed #2196F3',
          background: 'rgba(33, 150, 243, 0.3)',
          left: `${startX}px`,
          top: `${startY}px`,
          zIndex: 2147483648
        })
        document.body.appendChild(selectionBox)

        overlay.addEventListener('mousemove', mouseMoveHandler)
        document.addEventListener('mouseup', mouseUpHandler)
        overlay.removeEventListener('mousedown', mouseDownHandler)
      }

      function mouseMoveHandler (e) {
        e.preventDefault()
        const currentX = e.clientX
        const currentY = e.clientY

        const rectX = Math.min(currentX, startX)
        const rectY = Math.min(currentY, startY)
        const rectWidth = Math.abs(currentX - startX)
        const rectHeight = Math.abs(currentY - startY)

        Object.assign(selectionBox.style, {
          left: `${rectX}px`,
          top: `${rectY}px`,
          width: `${rectWidth}px`,
          height: `${rectHeight}px`
        })
      }

      function mouseUpHandler (e) {
        e.preventDefault()
        overlay.removeEventListener('mousemove', mouseMoveHandler)
        overlay.removeEventListener('mouseup', mouseUpHandler)
        if (!selectionBox) {
          cleanup()
          resolve([])
          return
        }

        const rect = selectionBox.getBoundingClientRect()
        const results = new Set()
        const seenUrls = new Set()

        function isValidImage (url) {
          if (!url || seenUrls.has(url)) return false
          if (url.startsWith('data:') && url.length > 1000000) return false
          return true
        }

        function isElementInsideRect (el, rect) {
          const elRect = el.getBoundingClientRect()
          return !(
            elRect.right < rect.left ||
            elRect.left > rect.right ||
            elRect.bottom < rect.top ||
            elRect.top > rect.bottom
          )
        }

        document.querySelectorAll('img').forEach(img => {
          if (isValidImage(img.src) && isElementInsideRect(img, rect)) {
            results.add({
              src: img.src,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              type: 'img_element',
              element: null
            })
            seenUrls.add(img.src)
          }
        })

        cleanup()
        resolve(Array.from(results))
      }

      function cleanup () {
        if (selectionBox && selectionBox.parentNode)
          selectionBox.parentNode.removeChild(selectionBox)
        if (overlay && overlay.parentNode)
          overlay.parentNode.removeChild(overlay)
      }

      overlay.addEventListener('mousedown', mouseDownHandler)
    })
  }

  // Enhanced Sidepanel Implementation
  async function professionalScanCurrentPage () {
    try {
      // Reset state
      imageGrid.innerHTML = ''
      progressFill.style.width = '0%'
      progressText.textContent = 'Scanning current page...'
      scanPageBtn.disabled = true
      deepScanBtn.disabled = true
      stopScanBtn.disabled = false
      scanActive = true

      // Initialize counts
      updateImageCounts()

      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!tab) {
        progressText.textContent = 'No active tab found'
        return
      }

      // Phase 1: Initial scan
      progressFill.style.width = '30%'
      progressText.textContent = 'Scanning visible elements...'
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: professionalImageExtractor,
        args: []
      })

      // Check if scan was stopped during execution
      if (!scanActive) {
        progressText.textContent = `Scan stopped - found ${allFoundImages.length} images`
        return
      }

      if (results && results[0] && results[0].result) {
        // Phase 2: Verification
        progressFill.style.width = '60%'
        progressText.textContent = 'Verifying images...'
        const newImages = results[0].result
        const verifiedImages = await verifyImageDimensions(newImages)

        // Add new images to the existing collection
        allFoundImages = [...allFoundImages, ...verifiedImages]
        // Remove duplicates
        allFoundImages = allFoundImages.filter(
          (img, index, self) => index === self.findIndex(t => t.src === img.src)
        )

        if (!scanActive) {
          progressText.textContent = `Scan stopped - found ${allFoundImages.length} images`
          return
        }

        // Phase 3: Show ALL images by default (no filters applied)
        updateImageResults(allFoundImages)
        progressFill.style.width = '100%'
        progressText.textContent = `Found ${allFoundImages.length} images`
      }
    } catch (error) {
      if (!scanActive) {
        progressText.textContent = `Scan stopped - found ${allFoundImages.length} images`
      } else if (
        error.message.includes('Extension manifest must request permission')
      ) {
        progressText.innerHTML = `
                <div class="permission-message">
                    <p><strong>Permission Required</strong></p>
                    <p>To scan this website:</p>
                    <ol>
                        <li>Click the extensions icon and pin this extension</li>
                        <li>Now click on the icon which appears after pinning the extension</li>
                        <li>This message doesn't go away so just hit the scanning buttons and it will disappear</li>
                    </ol>
                </div>
            `
      } else {
        console.error('Professional scan error:', error)
        progressText.textContent = 'Scan failed: ' + error.message
      }
    } finally {
      if (scanActive) {
        scanPageBtn.disabled = false
        deepScanBtn.disabled = false
        stopScanBtn.disabled = true
      }
    }
  }

  async function deepScanCurrentPage () {
    try {
      // Reset state
      imageGrid.innerHTML = ''
      progressFill.style.width = '0%'
      progressText.textContent =
        'Deep scanning - auto scrolling to load more images...'
      scanPageBtn.disabled = true
      deepScanBtn.disabled = true
      stopScanBtn.disabled = false
      scanActive = true

      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!tab) {
        progressText.textContent = 'No active tab found'
        return
      }

      // Execute initial scan
      await professionalScanCurrentPage()
      if (!scanActive) return

      // Update progress text to show initial count
      progressText.textContent = `Found ${allFoundImages.length} images - scanning...`

      // Set up continuous scanning with scrolling
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Store the interval ID on window so we can clear it later
          window.scrollInterval = setInterval(() => {
            window.scrollBy(0, window.innerHeight * 0.8)
          }, 1000)

          // Return a cleanup function
          return () => {
            clearInterval(window.scrollInterval)
          }
        }
      })

      // Get scan duration from UI
      const scanDuration =
        parseInt(document.getElementById('scanDuration').value) || 0
      const startTime = Date.now()

      // Continuous rescan while scan is active
      while (scanActive) {
        // Check if duration has expired
        if (scanDuration > 0 && Date.now() - startTime > scanDuration * 1000) {
          progressText.textContent = `Scan completed - found ${allFoundImages.length} images`
          break
        }

        await new Promise(resolve => setTimeout(resolve, 5000)) // Rescan every 5 seconds
        if (scanActive) {
          await professionalScanCurrentPage()
          if (!scanActive) break
          // Update the count during scanning
          progressText.textContent = `Found ${allFoundImages.length} images - scanning...`
        }
      }
    } catch (error) {
      if (!scanActive) {
        progressText.textContent = `Scan stopped - found ${allFoundImages.length} images`
      } else {
        console.error('Deep scan error:', error)
        progressText.textContent = 'Deep scan failed: ' + error.message
      }
    } finally {
      // Clean up
      scanActive = false
      scanPageBtn.disabled = false
      deepScanBtn.disabled = false
      stopScanBtn.disabled = true

      // Stop the scrolling script
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (tab) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            if (window.scrollInterval) {
              clearInterval(window.scrollInterval)
            }
          }
        })
      }

      // Update final count
      progressText.textContent = `Scan completed - found ${allFoundImages.length} images`
    }
  }

  async function startAreaScan () {
    try {
      imageGrid.innerHTML = ''
      progressFill.style.width = '0%'
      progressText.textContent = 'Area scan - select an area on the page...'
      scanPageBtn.disabled = true
      deepScanBtn.disabled = true
      areaScanBtn.disabled = true
      stopScanBtn.disabled = false
      scanActive = true

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (!tab) {
        progressText.textContent = 'No active tab found'
        return
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: areaSelectAndExtract
      })

      if (!scanActive) {
        progressText.textContent = `Scan stopped - found ${allFoundImages.length} images`
        return
      }

      if (results && results[0] && results[0].result) {
        progressText.textContent = 'Verifying images...'
        const verifiedImages = await verifyImageDimensions(results[0].result)

        allFoundImages = [...allFoundImages, ...verifiedImages]

        allFoundImages = allFoundImages.filter(
          (img, index, self) => index === self.findIndex(t => t.src === img.src)
        )

        if (!scanActive) {
          progressText.textContent = `Scan stopped - found ${allFoundImages.length} images`
          return
        }

        updateImageResults(allFoundImages)
        progressFill.style.width = '100%'
        progressText.textContent = `Found ${allFoundImages.length} images`
      }
    } catch (error) {
      console.error('Area scan error:', error)
      if (
        error.message.includes('Extension manifest must request permission')
      ) {
        progressText.innerHTML = `
    <div class="permission-message">
      <p><strong>Permission Required</strong></p>
      <p>To scan this website:</p>
      <ol>
        <li>Click the extensions icon and pin this extension</li>
        <li>Now click on the icon which appears after pinning the extension</li>
        <li>This message doesn't go away so just hit the scanning buttons and it will disappear</li>
      </ol>
    </div>
  `
      } else {
        progressText.textContent = 'Area scan failed: ' + error.message
      }
    } finally {
      scanActive = false
      scanPageBtn.disabled = false
      deepScanBtn.disabled = false
      areaScanBtn.disabled = false
      stopScanBtn.disabled = true
    }
  }

  async function verifyImageDimensions (images) {
    const verificationPromises = images.map(async img => {
      if (img.width > 0 && img.height > 0) return img

      try {
        const dimensions = await getImageDimensions(img.src)
        return {
          ...img,
          width: dimensions.width,
          height: dimensions.height
        }
      } catch (e) {
        //console.warn('Failed to verify image dimensions:', e);
        return null
      }
    })
    const verifiedImages = await Promise.all(verificationPromises)
    return verifiedImages.filter(img => img !== null)
  }

  // The rest of your helper functions remain unchanged...
  function getImageDimensions (url) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = reject
      img.src = url

      setTimeout(() => reject(new Error('Image load timeout')), 5000)
    })
  }

  function updateImageResults (images) {
    imageGrid.innerHTML = ''

    // Update counts before displaying
    updateImageCounts()

    // Update progress bar
    progressFill.style.width = '100%'

    // Display images in grid with additional filter info
    images.forEach((img, index) => {
      const aspectRatio = (img.width / img.height).toFixed(2)
      const imgElement = document.createElement('div')
      imgElement.className = 'image-item'

      // Create inner HTML WITHOUT inline onerror attribute
      imgElement.innerHTML = `
            <div class="image-container">
                <span class="image-type-badge">${img.type.replace(
                  '_',
                  ' '
                )}</span>
                <span class="aspect-ratio-badge">${aspectRatio}:1</span>
                <img src="${img.src}" alt="${img.alt || ''}" title="${
        img.title || ''
      }">
            </div>
            <div class="image-url">${truncateUrl(img.src)}</div>
            <button class="copy-url-btn" data-url="${img.src}">Copy</button>
        `

      // Append to grid first
      imageGrid.appendChild(imgElement)

      // Now attach error event listener to img element
      const imgTag = imgElement.querySelector('img')
      if (imgTag) {
        imgTag.addEventListener('error', () => {
          imgTag.parentNode.innerHTML =
            '<div class="image-error">Failed to load</div>'
        })
      }
    })

    // Add event listeners for copy buttons
    document.querySelectorAll('.copy-url-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const url = e.target.getAttribute('data-url')
        navigator.clipboard.writeText(url).then(() => {
          e.target.textContent = 'Copied!'
          setTimeout(() => {
            e.target.textContent = 'Copy'
          }, 2000)
        })
      })
    })
  }

  function stopScan () {
    scanActive = false
    progressText.textContent = `Scan stopped - found ${allFoundImages.length} images`
    stopScanBtn.disabled = true

    // Keep the images found so far
    scanPageBtn.disabled = false
    deepScanBtn.disabled = false

    if (currentScanObserver) {
      currentScanObserver.disconnect()
      currentScanObserver = null
    }

    // Update UI with whatever images we've collected
    if (allFoundImages.length > 0) {
      updateImageResults(allFoundImages)
    }
  }

  function copyAllImageUrls () {
    if (allFoundImages.length === 0) {
      alert(
        'No images found yet. Please scan the page first using the "Scan Current Page" or "Deep Scan" buttons to collect images before copying URLs.'
      )
      return
    }

    const urls = allFoundImages.map(img => img.src).join('\n')
    navigator.clipboard.writeText(urls).then(() => {
      const originalText = copyAllBtn.textContent
      copyAllBtn.textContent = 'Copied!'
      setTimeout(() => {
        copyAllBtn.textContent = originalText
      }, 2000)
    })
  }

  function sendToDownloader () {
    if (allFoundImages.length === 0) {
      alert(
        'No images found yet. Please scan the page first using the "Scan Current Page" or "Deep Scan" buttons to collect images before sending to downloader.'
      )
      return
    }

    const urls = allFoundImages.map(img => img.src).join('\n')
    imageLinksTextarea.value = urls
    updateUrlCountSidePanel()

    // Switch to Downloader tab
    document.querySelector('.tab-button[data-tab="tab2"]').click()
  }

  function exportImageResultsToCSV () {
    if (allFoundImages.length === 0) {
      alert(
        'No images found yet. Please scan the page first using the "Scan Current Page" or "Deep Scan" buttons to collect images before exporting'
      )
      return
    }

    // Create CSV header
    let csvContent = 'URL,Width,Height,Type,Aspect Ratio\n'

    // Add each image as a row
    allFoundImages.forEach(img => {
      const aspectRatio = (img.width / img.height).toFixed(2)
      csvContent += `"${img.src}",${img.width},${img.height},${img.type.replace(
        '_',
        ' '
      )},${aspectRatio}\n`
    })

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'image_export.csv')
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper functions
  function truncateUrl (url, maxLength = 50) {
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url
  }

  function formatBytes (kilobytes) {
    if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`
    const megabytes = kilobytes / 1024
    return `${megabytes.toFixed(1)} MB`
  }

  function updateImageCounts () {
    const totalImages = allFoundImages.length
    //imageCount.textContent = `${totalImages} images found`;
    progressText.textContent = `Found ${totalImages} images`
  }

  function clearAllImages () {
    allFoundImages = []
    imageGrid.innerHTML = ''
    progressText.textContent = 'Images cleared'
    progressFill.style.width = '0%'
  }

  // Add to your DOMContentLoaded event listener:
  if (loginBtn && logoutBtn) {
    loginBtn.addEventListener('click', handleLogin)
    logoutBtn.addEventListener('click', handleLogout)
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshAuthStatus)
  }

  async function handleLogin () {
    // Direct Google OAuth flow without any modals
    const redirectUrl = chrome.runtime.getURL('options.html')
    const loginUrl = `${BASE_URL}/?action=google_login&redirect_to=${encodeURIComponent(
      redirectUrl
    )}&source=extension&extension_id=${EXTENSION_ID}`
    chrome.tabs.create({ url: loginUrl })
    window.close()
  }
  async function handleLogout () {
    try {
      // Same logout logic as options.js
      const deleteResponse = await fetch(
        `${BASE_URL}/wp-json/api/delete-tokens`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Extension-ID': EXTENSION_ID }
        }
      )

      if (!deleteResponse.ok) throw new Error('Failed to delete tokens')

      const nonceResponse = await fetch(
        `${BASE_URL}/wp-json/api/get-logout-nonce`,
        {
          credentials: 'include',
          headers: { 'X-Extension-ID': EXTENSION_ID }
        }
      )
      const nonceData = await nonceResponse.json()

      if (!nonceData.success) throw new Error('Failed to fetch logout nonce')

      await fetch(
        `${BASE_URL}/?action=google_logout&google_logout_nonce=${nonceData.nonce}`,
        {
          credentials: 'include',
          headers: { 'X-Extension-ID': EXTENSION_ID }
        }
      )

      // Clear local storage
      await chrome.storage.local.set({
        isLoggedIn: false,
        userEmail: null,
        license: null
      })

      updateAuthUI()
      location.reload()
    } catch (error) {}
  }

  function updateAuthUI () {
    chrome.storage.local.get(['isLoggedIn', 'userEmail'], data => {
      if (data.isLoggedIn) {
        // Change this to show a clear logged-in state without the email
        authStatus.textContent = `Logged in as: ${data.userEmail}`
        authStatus.style.color = ''
        loginBtn.style.display = 'none'
        logoutBtn.style.display = 'block'
      } else {
        // Clearer sign-in state
        authStatus.textContent = 'Sign In to access all features'
        authStatus.style.color = '#FF9800' // Orange for notice
        loginBtn.style.display = 'block'
        logoutBtn.style.display = 'none'
      }
      // Always show the refresh button
      refreshBtn.style.display = 'flex'
    })
  }

  // Call this at startup
  updateAuthUI()

  async function refreshAuthStatus () {
    try {
      // Add rotation animation
      const refreshIcon = refreshBtn.querySelector('svg')
      refreshIcon.style.transform = 'rotate(360deg)'
      refreshIcon.style.transition = 'transform 0.5s ease'

      const response = await fetch(`${BASE_URL}/wp-json/api/check-auth`, {
        credentials: 'include',
        headers: { 'X-Extension-ID': EXTENSION_ID }
      })

      if (response.ok) {
        const data = await response.json()
        await chrome.storage.local.set({
          isLoggedIn: data.isLoggedIn,
          userEmail: data.userEmail || null,
          license: data.license || null
        })

        // Update UI with consistent messaging
        if (data.isLoggedIn) {
          authStatus.textContent = `Logged in as: ${data.userEmail}`
        } else {
          authStatus.textContent = 'Sign In to access all features'
          authStatus.style.color = '#FF9800'
        }
      }
      updateAuthUI()
      updateLicenseUI()

      // Reset rotation
      setTimeout(() => {
        refreshIcon.style.transform = 'rotate(0deg)'
      }, 500)
    } catch (error) {
      console.error('Refresh failed:', error)
      // Fallback to current local state
      updateAuthUI()
      updateLicenseUI()
    }
  }

  // License Management Functions
  async function checkLicense () {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'validateSession' }, response => {
        if (chrome.runtime.lastError) {
          resolve({ valid: false })
        } else {
          resolve(response)
        }
      })
    })
  }

function updateLicenseUI() {
  checkLicense().then(licenseCheck => {
    const isLicensed = licenseCheck?.license?.license_status === 'sold'
    const licenseIndicator =
      document.getElementById('licenseIndicator') || document.createElement('div')

    licenseIndicator.id = 'licenseIndicator'
    licenseIndicator.style.margin = '12px 0'
    licenseIndicator.style.fontSize = '13px'
    licenseIndicator.style.padding = '10px'
    licenseIndicator.style.borderRadius = '6px'
    licenseIndicator.style.lineHeight = '1.4'
    licenseIndicator.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"

    if (isLicensed) {
      licenseIndicator.textContent = 'License Status: Active (Pro User)'
      licenseIndicator.style.background = '#4CAF50'
      licenseIndicator.style.color = 'white'
      licenseIndicator.style.textAlign = 'center'
      licenseIndicator.style.fontWeight = '600'
    } else {
      chrome.storage.local.get(['isLoggedIn'], data => {
        if (data.isLoggedIn) {
          // Signed in but no license — show upgrade prompt with clear info
          licenseIndicator.innerHTML = `
            <div style="color:#333;">
              <strong>You are using the Free Limited Version.</strong><br>
              To unlock unlimited downloads and advanced features, please
              <a href="${BASE_URL}/shop/" target="_blank" rel="noopener noreferrer" style="color:#1976d2; text-decoration:underline; font-weight:600;">
                Upgrade Now
              </a>.
            </div>
            <div style="margin-top:6px; font-size:12px; color:#555;">
              You can purchase a license on our shop. After purchase, you will receive an email with instructions to set up your account.<br>
              Once logged in, your license will be automatically activated here.
            </div>
          `
          licenseIndicator.style.background = '#fff8e1'
          licenseIndicator.style.border = '1px solid #ffca28'
          licenseIndicator.style.color = '#333'
        } else {
          // Not signed in — prompt sign in with clear instructions
          licenseIndicator.innerHTML = `
            <div style="color:#333;">
              <strong>Free Limited Version</strong><br>
              To access all features, click the above <strong>Sign In</strong> button &amp; then buy a license of your choice OR
            </div>
            <div style="margin-top:6px; font-size:12px; color:#555;">
              Buy the license here
              <a href="${BASE_URL}/shop/" target="_blank" rel="noopener noreferrer" style="color:#1976d2; text-decoration:underline; font-weight:600;">
                SHOP
              </a> and check your email to finish account setup (If you don't wish to use Google Login)<br>
              After purchase, your license will sync with the extension. Easy!
            </div>
          `
          licenseIndicator.style.background = '#fff3e0'
          licenseIndicator.style.border = '1px solid #ffb74d'
          licenseIndicator.style.color = '#333'
        }
      })
      return
    }

    // Insert or replace licenseIndicator in DOM if not already present
    if (!document.getElementById('licenseIndicator')) {
      downloadButton.parentNode.insertBefore(
        licenseIndicator,
        downloadButton.nextSibling
      )
    } else {
      const existing = document.getElementById('licenseIndicator')
      existing.replaceWith(licenseIndicator)
    }
  })
}



  // File Type Handling
  const fileTypeCheckboxes = [
    'jpg',
    'png',
    'gif',
    'jpeg',
    'webp',
    'svg',
    'pdf',
    'apng',
    'arw',
    'avif',
    'bmp',
    'cr2',
    'crw',
    'dcr',
    'dng',
    'exif',
    'hdr',
    'heic',
    'heif',
    'ico',
    'indd',
    'jp2',
    'jfif',
    'nef',
    'orf',
    'raw',
    'raf',
    'rw2',
    'svgz',
    'tiff',
    'tif'
  ].map(type => document.getElementById(`${type}Checkbox`))

  const validImageFormats = fileTypeCheckboxes.map(cb =>
    cb.id.replace('Checkbox', '')
  )

  function updateFileFormatCheckboxes () {
    fileTypeCheckboxes.forEach(checkbox => {
      checkbox.checked = false
      checkbox.disabled = allFormatsCheckbox.checked
    })
  }

  // Event Listeners
  allFormatsCheckbox.addEventListener('change', updateFileFormatCheckboxes)

  $('#addButton').on('click', function () {
    const selectedOption = $('#newItem').val()
    if (selectedOption === 'add_new') {
      customText = $('#newItemInput').val()
    }
    addedItems.push(selectedOption)

    const displayText =
      selectedOption === 'add_new' ? customText : selectedOption
    $('.extension').before(
      `<li class="ui-state-default">${displayText} <button class="remove-item">X</button></li>`
    )
    $('#newItemInput').val('')
  })

  $('#newItem').on('change', function () {
    const selectedOption = $(this).val()
    $('.new-item-input').toggle(selectedOption === 'add_new')
    $('#build-checkbox').prop('checked', !!selectedOption)
  })

  $('#sortable').on('click', '.remove-item', function () {
    const itemIndex = $(this).parent().index()
    addedItems.splice(itemIndex, 1)
    $(this).parent().remove()
  })

  // URL Handling - Options
  async function updateUrlCount () {
    // Initialize duplicate count elements if they don't exist
    if (!duplicateFilenameCountSpan.parentElement && duplicateCountSpan) {
      duplicateCountSpan.after(duplicateFilenameCountSpan)
      duplicateFilenameCountSpan.classList.add('duplicate-filename-count')
    }

    // Skip license checks during scanning
    if (window.isScanningActive) {
      return
    }

    // Process URLs
    let urls = imageLinksTextarea.value
      .split('\n')
      .map(url => {
        let cleanUrl = url.trim()
        if (cleanUrl.includes(' ') && !cleanUrl.startsWith('http')) {
          return cleanUrl.split(/\s+/)
        }
        return cleanUrl
      })
      .flat()
      .filter(url => {
        return (
          url.length > 0 &&
          (url.startsWith('http://') ||
            url.startsWith('https://') ||
            url.startsWith('data:image'))
        )
      })

    // License check for free version limit
    let showLicenseWarning = false
    if (urls.length > MAX_URLS_FREE) {
      const licenseCheck = await checkLicense()
      const isLicensed = licenseCheck?.license?.license_status === 'sold'

      if (!isLicensed) {
        const tasks = await new Promise(resolve => {
          chrome.storage.local.get('tasks', data => resolve(data.tasks || []))
        })

        let defaultTask = tasks[0]

        if (!defaultTask) {
          // If no default task, create one
          defaultTask = {
            id: Date.now().toString(),
            urls: [''],
            fileTypes: ['all'],
            folderName: '',
            downloadTime: '',
            zipDownload: false,
            status: 'pending',
            buildCheckbox: false,
            sortableList:
              '<li class="ui-state-default extension">.extension</li>',
            sequenceStart: '1',
            downloadIf: { enabled: false, keywords: [], logic: null },
            convert: { enabled: false, format: 'jpeg', quality: 100 }
          }
          tasks.push(defaultTask)
          await chrome.storage.local.set({ tasks })
        }

        // Overwrite URLs in the default task
        await chrome.storage.local.set({
          pendingTaskUrls: urls.join('\n'),
          shouldCreateNewTask: false,
          taskToUpdate: defaultTask.id
        })

        alert(
          `Free version is limited to ${MAX_URLS_FREE} URLs. Upgrade to the Pro version for unlimited downloads.`
        )
      }
    }

    const totalUrls = urls.length

    // Count duplicates
    const urlOccurrences = urls.reduce((acc, url) => {
      acc[url] = (acc[url] || 0) + 1
      return acc
    }, {})

    const filenameOccurrences = urls.reduce((acc, url, index) => {
      const constructedFilename = constructFilename(url, addedItems, index)
      acc[constructedFilename] = (acc[constructedFilename] || 0) + 1
      return acc
    }, {})

    const duplicateUrlCount = Object.values(urlOccurrences).reduce(
      (acc, count) => (count > 1 ? acc + (count - 1) : acc),
      0
    )

    const duplicateFilenameCount = Object.values(filenameOccurrences).reduce(
      (acc, count) => (count > 1 ? acc + (count - 1) : acc),
      0
    )

    // Update UI
    if (urlCountSpan) {
      urlCountSpan.textContent = `${totalUrls}`
    }

    // Handle duplicate URL display
    if (duplicateCountSpan) {
      if (!showLicenseWarning && duplicateUrlCount > 0) {
        duplicateCountSpan.textContent = `Duplicate URLs: ${duplicateUrlCount}`
        duplicateCountSpan.style.display = 'inline'
        duplicateCountSpan.style.background = '#ffcccc'
        duplicateCountSpan.style.color = '#000'
        duplicateCountSpan.style.padding = '4px'
        duplicateCountSpan.style.borderRadius = '4px'
      } else if (!showLicenseWarning) {
        duplicateCountSpan.style.display = 'none'
      }
    }

    // Handle duplicate filename display
    if (duplicateFilenameCountSpan) {
      if (duplicateFilenameCount > 0) {
        duplicateFilenameCountSpan.textContent = ` Similar Filenames: ${duplicateFilenameCount}`
        duplicateFilenameCountSpan.style.display = 'inline'
        duplicateFilenameCountSpan.style.background = 'cadetblue'
        duplicateFilenameCountSpan.style.color = '#fff'
        duplicateFilenameCountSpan.style.padding = '4px'
        duplicateFilenameCountSpan.style.borderRadius = '5px'

        if (duplicateHandlingContainer) {
          duplicateHandlingContainer.style.display = 'block'
        }
      } else {
        duplicateFilenameCountSpan.style.display = 'none'

        if (duplicateHandlingContainer) {
          duplicateHandlingContainer.style.display = 'none'
        }
      }
    }
  }

  async function updateUrlCountSidePanel () {
    // Initialize duplicate count elements if they don't exist
    if (!duplicateFilenameCountSpan.parentElement && duplicateCountSpan) {
      duplicateCountSpan.after(duplicateFilenameCountSpan)
      duplicateFilenameCountSpan.classList.add('duplicate-filename-count')
    }

    // Skip license checks during scanning
    if (window.isScanningActive) {
      return
    }

    // Process URLs
    let urls = imageLinksTextarea.value
      .split('\n')
      .map(url => {
        let cleanUrl = url.trim()
        if (cleanUrl.includes(' ') && !cleanUrl.startsWith('http')) {
          return cleanUrl.split(/\s+/)
        }
        return cleanUrl
      })
      .flat()
      .filter(url => {
        return (
          url.length > 0 &&
          (url.startsWith('http://') ||
            url.startsWith('https://') ||
            url.startsWith('data:image'))
        )
      })

    // License check for free version limit
    let showLicenseWarning = false
    if (urls.length > MAX_URLS_FREE) {
      const licenseCheck = await checkLicense()
      const isLicensed = licenseCheck?.license?.license_status === 'sold'

      if (!isLicensed) {
        const tasks = await new Promise(resolve => {
          chrome.storage.local.get('tasks', data => resolve(data.tasks || []))
        })

        let defaultTask = tasks[0]

        if (!defaultTask) {
          // If no default task, create one
          defaultTask = {
            id: Date.now().toString(),
            urls: [''],
            fileTypes: ['all'],
            folderName: '',
            downloadTime: '',
            zipDownload: false,
            status: 'pending',
            buildCheckbox: false,
            sortableList:
              '<li class="ui-state-default extension">.extension</li>',
            sequenceStart: '1',
            downloadIf: { enabled: false, keywords: [], logic: null },
            convert: { enabled: false, format: 'jpeg', quality: 100 }
          }
          tasks.push(defaultTask)
          await chrome.storage.local.set({ tasks })
        }

        // Overwrite URLs in the default task
        await chrome.storage.local.set({
          pendingTaskUrls: urls.join('\n'),
          shouldCreateNewTask: false,
          taskToUpdate: defaultTask.id
        })
      }
    }

    const totalUrls = urls.length

    // Count duplicates
    const urlOccurrences = urls.reduce((acc, url) => {
      acc[url] = (acc[url] || 0) + 1
      return acc
    }, {})

    const filenameOccurrences = urls.reduce((acc, url, index) => {
      const constructedFilename = constructFilename(url, addedItems, index)
      acc[constructedFilename] = (acc[constructedFilename] || 0) + 1
      return acc
    }, {})

    const duplicateUrlCount = Object.values(urlOccurrences).reduce(
      (acc, count) => (count > 1 ? acc + (count - 1) : acc),
      0
    )

    const duplicateFilenameCount = Object.values(filenameOccurrences).reduce(
      (acc, count) => (count > 1 ? acc + (count - 1) : acc),
      0
    )

    // Update UI
    if (urlCountSpan) {
      urlCountSpan.textContent = `${totalUrls}`
    }

    // Handle duplicate URL display
    if (duplicateCountSpan) {
      if (!showLicenseWarning && duplicateUrlCount > 0) {
        duplicateCountSpan.textContent = `Duplicate URLs: ${duplicateUrlCount}`
        duplicateCountSpan.style.display = 'inline'
        duplicateCountSpan.style.background = '#ffcccc'
        duplicateCountSpan.style.color = '#000'
        duplicateCountSpan.style.padding = '4px'
        duplicateCountSpan.style.borderRadius = '4px'
      } else if (!showLicenseWarning) {
        duplicateCountSpan.style.display = 'none'
      }
    }

    // Handle duplicate filename display
    if (duplicateFilenameCountSpan) {
      if (duplicateFilenameCount > 0) {
        duplicateFilenameCountSpan.textContent = ` Similar Filenames: ${duplicateFilenameCount}`
        duplicateFilenameCountSpan.style.display = 'inline'
        duplicateFilenameCountSpan.style.background = 'cadetblue'
        duplicateFilenameCountSpan.style.color = '#fff'
        duplicateFilenameCountSpan.style.padding = '4px'
        duplicateFilenameCountSpan.style.borderRadius = '5px'

        if (duplicateHandlingContainer) {
          duplicateHandlingContainer.style.display = 'block'
        }
      } else {
        duplicateFilenameCountSpan.style.display = 'none'

        if (duplicateHandlingContainer) {
          duplicateHandlingContainer.style.display = 'none'
        }
      }
    }
  }

  // concurrency helper function
async function concurrentMap(inputs, mapper, concurrency = 5) {
  const results = [];
  const executing = [];

  for (const input of inputs) {
    const p = Promise.resolve().then(() => mapper(input));
    results.push(p);

    if (concurrency <= inputs.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

  // Download Functions
async function downloadImages() {
  const licenseCheck = await checkLicense();
  const isLicensed = licenseCheck?.license?.license_status === 'sold';

  const imageLinks = imageLinksTextarea.value
    .split('\n')
    .map(url => url.trim())
    .filter(Boolean);

  // Enforce URL limit for free users
  if (!isLicensed && imageLinks.length > MAX_URLS_FREE) {
    alert(
      `Free version limited to ${MAX_URLS_FREE} URLs. Upgrade at ${BASE_URL}/shop/ for unlimited downloads.`
    );
    imageLinksTextarea.value = imageLinks.slice(0, MAX_URLS_FREE).join('\n');
    updateUrlCount();
    imageLinks.splice(MAX_URLS_FREE);
  }

  const totalImages = imageLinks.length;
  let completedDownloads = 0;
  let filenameMap = {};
  const folderName = folderNameInput.value.trim();

  function updateProgress(downloadDelta) {
    if (downloadDelta.state && downloadDelta.state.current === 'complete') {
      completedDownloads++;
      const progress = (completedDownloads / totalImages) * 100;
      progressBar.style.width = `${progress}%`;

      if (completedDownloads >= totalImages) {
        progressBar.style.width = '100%';
      }
    }
  }

  // Add the listener once before starting downloads
  chrome.downloads.onChanged.addListener(updateProgress);

  // Mapper function to download each image concurrently
  async function fetchAndDownload(url, index) {
    try {
      const fileExtension = extractExtensionFromUrl(url);
      if (!applyFileTypeFilter(fileExtension)) return;

      let constructedFilename = constructFilename(url, addedItems, index);
      if (filenameMap[constructedFilename]) {
        filenameMap[constructedFilename]++;
        constructedFilename = handleDuplicates(
          constructedFilename,
          filenameMap[constructedFilename]
        );
      } else {
        filenameMap[constructedFilename] = 1;
      }

      const filename = folderName
        ? `${folderName}/${constructedFilename}.${fileExtension}`
        : `${constructedFilename}.${fileExtension}`;

      // Trigger chrome download (no need to await)
      chrome.downloads.download({ url, filename });
    } catch (e) {
      console.warn('Error downloading image:', e);
    }
  }

  // Run downloads concurrently with limit 5
  await concurrentMap(imageLinks, fetchAndDownload, 5);

  // Remove the listener after downloads are initiated
  chrome.downloads.onChanged.removeListener(updateProgress);

  // If no images downloaded (filtered out), show README
  if (totalImages === 0 || imageLinks.length === 0) {
    downloadTextFile(
      'README.txt',
      'No images match the selected file formats. Please select the correct formats.'
    );
  }
}


  async function fetchAndDownloadImage(
    url,
    addedItems,
    folderNameInput,
    index
  ) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      // Use synchronous extractExtensionFromUrl
      let fileExtension = extractExtensionFromUrl(url);
      if (!fileExtension) {
        const contentType = response.headers.get('content-type');
        fileExtension = getFileExtensionFromContentType(contentType, url);
      }

      // Check if file extension matches selected filters
      if (!applyFileTypeFilter(fileExtension)) return;

      const folderName = folderNameInput.value.trim();
      let constructedFilename = constructFilename(url, addedItems, index);

      if (filenameMap[constructedFilename]) {
        filenameMap[constructedFilename]++;
        constructedFilename = handleDuplicates(
          constructedFilename,
          filenameMap[constructedFilename]
        );
      } else {
        filenameMap[constructedFilename] = 1;
      }

      const filename = folderName
        ? `${folderName}/${constructedFilename}.${fileExtension}`
        : `${constructedFilename}.${fileExtension}`;

      // Trigger Chrome download API
      chrome.downloads.download({ url, filename });
    } catch (error) {
      console.warn('Error in fetchAndDownloadImage:', error);
    }
  }

  function getFileExtensionFromContentType(contentType, url) {
    // Handle null/undefined content type
    if (!contentType) {
      return extractExtensionFromUrl(url) || 'jpg';
    }

    // Convert to lowercase for case-insensitive matching
    contentType = contentType.toLowerCase();

    // First check for PDF - highest priority
    if (contentType.includes('pdf')) {
      return 'pdf';
    }

    // Main extension mapping
    const extensionMap = {
      // Standard web formats
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      
      // PDF formats
      'application/pdf': 'pdf',
      'application/x-pdf': 'pdf',
      'application/acrobat': 'pdf',
      'application/vnd.pdf': 'pdf',
      'text/pdf': 'pdf',
      'text/x-pdf': 'pdf',
      
      // Image formats
      'image/apng': 'apng',
      'image/bmp': 'bmp',
      'image/avif': 'avif',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'image/ico': 'ico',
      'image/tiff': 'tiff',
      
      // RAW camera formats
      'image/x-arw': 'arw',
      'image/x-cr2': 'cr2',
      'image/x-crw': 'crw',
      'image/x-dcr': 'dcr',
      'image/x-dng': 'dng',
      'image/x-nef': 'nef',
      'image/x-nrw': 'nrw',
      'image/x-orf': 'orf',
      'image/x-raf': 'raf',
      'image/x-rw2': 'rw2',
      'image/x-3fr': '3fr',
      'image/x-ari': 'ari',
      'image/x-srf': 'srf',
      'image/x-sr2': 'sr2',
      'image/x-bay': 'bay',
      
      // Other document formats that might be mistaken for images
      'application/postscript': 'ps',
      'application/illustrator': 'ai'
    };

    // Check direct matches first
    if (extensionMap[contentType]) {
      return extensionMap[contentType];
    }

    // Handle generic image types (e.g., image/x-canon-cr2)
    if (contentType.startsWith('image/')) {
      // Try to extract subtype
      const subtype = contentType.split('/')[1].toLowerCase();
      
      // Check if subtype matches a known format
      for (const [type, ext] of Object.entries(extensionMap)) {
        if (type.includes(subtype)) {
          return ext;
        }
      }
      
      // Special case for RAW formats
      if (subtype.includes('raw') || subtype.includes('x-raw')) {
        return 'raw';
      }
    }

    // Fallback to URL analysis if content-type is ambiguous
    const urlExtension = extractExtensionFromUrl(url);
    if (urlExtension) {
      return urlExtension;
    }

    // Final fallback for completely unknown types
    return 'jpg';
  }

  function handleDuplicates (baseFilename, sequence) {
    const method = duplicateHandlingDropdown.value

    switch (method) {
      case 'hyphen_sequence':
        return `${baseFilename}-${sequence}`
      case 'underscore_sequence':
        return `${baseFilename}_${sequence}`
      case 'uuid':
        return `${baseFilename}_${generateShortUUID()}`
      case 'chrome_default':
      default:
        return `${baseFilename} (${sequence})`
    }
  }

  function generateShortUUID () {
    return Math.random().toString(36).substring(2, 10)
  }

async function downloadZipImages() {
  const licenseCheck = await checkLicense();
  const isLicensed = licenseCheck?.license?.license_status === 'sold';

  const urls = imageLinksTextarea.value
    .split('\n')
    .map(url => url.trim())
    .filter(Boolean);

  // Enforce URL limit for free users, but continue after alert and trimming
  let effectiveUrls = urls;
  if (!isLicensed && urls.length > MAX_URLS_FREE) {
    alert(
      `Free version limited to ${MAX_URLS_FREE} URLs. Upgrade at ${BASE_URL}/shop/ for unlimited downloads.`
    );
    imageLinksTextarea.value = urls.slice(0, MAX_URLS_FREE).join('\n');
    updateUrlCount();
    effectiveUrls = urls.slice(0, MAX_URLS_FREE); // Trim but proceed
  }

  const zip = new JSZip();
  const folderName = folderNameInput.value.trim();
  let filesAdded = 0;
  let failedDownloads = 0;
  const total = effectiveUrls.length;

  // Reset progress
  progressBar.style.width = '0%';
  progressText.textContent = 'Preparing download...';

  // Create a controller for aborting if needed
  const abortController = new AbortController();

  // Process files in batches to balance performance and memory
  const processBatch = async (batch) => {
    const results = await Promise.allSettled(batch.map(async (url, index) => {
      try {
        // Skip if URL is empty
        if (!url) return null;

        // Update progress
        const progress = Math.floor(((filesAdded + failedDownloads) / total) * 50);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Processing ${filesAdded + failedDownloads + 1}/${total}...`;

        const response = await fetch(url, {
          signal: abortController.signal,
          headers: {
            'Accept': 'application/pdf, image/*'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Determine file type
        let extension = extractExtensionFromUrl(url);
        if (!extension) {
          const contentType = response.headers.get('content-type');
          extension = getFileExtensionFromContentType(contentType, url);
        }

        // Skip if filtered out
        if (!applyFileTypeFilter(extension)) {
          return null;
        }

        // Handle filename
        let filename = constructFilename(url, addedItems, filesAdded + failedDownloads);
        if (filenameMap[filename]) {
          filenameMap[filename]++;
          filename = handleDuplicates(filename, filenameMap[filename]);
        } else {
          filenameMap[filename] = 1;
        }

        // Get blob and add to zip
        const blob = await response.blob();
        const fullFilename = `${filename}.${extension}`;
        
        // Special handling for PDFs to ensure proper mime type
        if (extension === 'pdf') {
          zip.folder(folderName || '').file(fullFilename, blob, { binary: true });
        } else {
          zip.folder(folderName || '').file(fullFilename, blob);
        }

        filesAdded++;
        return fullFilename;
      } catch (error) {
        failedDownloads++;
        console.warn(`Failed to download ${url}:`, error);
        return null;
      }
    }));

    return results;
  };

  // Process in batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < effectiveUrls.length; i += BATCH_SIZE) {
    const batch = effectiveUrls.slice(i, i + BATCH_SIZE);
    await processBatch(batch);
    
    // Check if we should abort (e.g., if user closed the panel)
    if (abortController.signal.aborted) {
      break;
    }
  }

  // Finalize ZIP
  if (filesAdded === 0) {
    zip.file(
      'README.txt',
      'No files matched your selected formats. Supported formats include:\n' +
      validImageFormats.join(', ') + '\n\n' +
      (failedDownloads > 0 ? `${failedDownloads} files failed to download.` : '')
    );
  }

  // Generate ZIP with progress updates
  try {
    await zip.generateAsync(
      { 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      },
      (metadata) => {
        const compressionProgress = 50 + (metadata.percent / 2);
        progressBar.style.width = `${compressionProgress}%`;
        progressText.textContent = `Compressing... ${Math.round(compressionProgress)}%`;
      }
    ).then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = folderName ? `${folderName}.zip` : 'downloads.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Final status
      progressBar.style.width = '100%';
      progressText.textContent = `Download ready! (${filesAdded} files)`;
    });
  } catch (error) {
    console.error('ZIP creation failed:', error);
    progressText.textContent = 'Failed to create ZIP file';
    progressBar.style.width = '0%';
  } finally {
    // Clean up
    abortController.abort();
  }
}

  function verifyImageUrl (url) {
    try {
      // First try HEAD request to avoid downloading large files
      const headResponse = fetch(url, { method: 'HEAD' })

      if (headResponse.ok) {
        const contentType = headResponse.headers.get('content-type')
        if (contentType && contentType.startsWith('image/')) {
          return {
            valid: true,
            type: contentType.split('/')[1].toLowerCase(),
            url: url
          }
        }
      }

      // Fallback to GET if HEAD fails or doesn't provide content-type
      const getResponse = fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-1000' } // Only fetch first 1KB for verification
      })

      if (getResponse.ok) {
        const contentType =
          getResponse.headers.get('content-type') ||
          (detectContentTypeFromBinary(getResponse.blob()))

        if (contentType && contentType.startsWith('image/')) {
          return {
            valid: true,
            type: contentType.split('/')[1].toLowerCase(),
            url: url
          }
        }
      }

      return { valid: false, reason: 'Invalid content-type' }
    } catch (error) {
      return { valid: false, reason: 'Fetch failed' }
    }
  }

  function detectContentTypeFromBinary (blob) {
    // Check magic numbers for common image formats
    const buffer = blob.slice(0, 12).arrayBuffer()
    const view = new DataView(buffer)

    // PNG
    if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a)
      return 'image/png'

    // JPEG
    if (view.getUint16(0) === 0xffd8) return 'image/jpeg'

    // GIF
    if (view.getUint32(0) === 0x47494638) return 'image/gif'

    // WebP
    if (view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250)
      return 'image/webp'

    return null
  }

  function analyzeUrlPatterns (url) {
    try {
      const parsed = new URL(url)
      const path = parsed.pathname.toLowerCase()
      const query = parsed.searchParams

      // 1. Check known CDN patterns
      if (url.includes('twimg.com/media/')) return 'jpg'
      if (url.includes('fbcdn.net/')) return 'jpg'
      if (url.includes('cdninstagram.com/')) return 'jpg'

      // 2. Check query parameters
      const format = query.get('format') || query.get('type') || query.get('f')
      if (format) return format.toLowerCase()

      // 3. Check path segments
      const segments = path.split('/')
      for (const segment of segments) {
        // Matches patterns like "image.jpg", "photo.png?123", "picture.webp#hash"
        const match = segment.match(
          /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)([?#]|$)/i
        )
        if (match) return match[1].toLowerCase()
      }

      // 4. Check for common API patterns
      if (path.includes('/image/') || path.includes('/photo/')) {
        return 'jpg' // Most APIs default to JPEG
      }

      return null
    } catch {
      return null
    }
  }

  async function isImageUrl (url) {
    // Skip data URLs (already validated)
    if (url.startsWith('data:image')) return true

    // Step 1: Content-Type verification
    const verified = verifyImageUrl(url)
    if (verified.valid) return true

    // Step 2: Advanced URL pattern analysis
    const detectedFormat = analyzeUrlPatterns(url)
    if (detectedFormat) return true

    // Step 3: Final fallback - attempt partial download
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-1000' }
      })

      if (response.ok) {
        const blob = await response.blob()
        if (blob.type.startsWith('image/')) return true

        // Check magic numbers if content-type was misleading
        return (detectContentTypeFromBinary(blob)) !== null
      }
    } catch {
      return false
    }

    return false
  }

  // Modified extractExtensionFromUrl() - now uses the complete system
  function extractExtensionFromUrl(url) {
    try {
      // Handle data URLs first
      if (url.startsWith('data:')) {
        const match = url.match(/^data:(.*?)(;|,)/);
        if (match && match[1]) {
          if (match[1].includes('pdf')) return 'pdf';
          if (match[1].includes('image')) {
            const imgType = match[1].split('/')[1];
            return imgType.toLowerCase();
          }
        }
        return null;
      }

      // Regular URL handling
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      
      // Check for explicit PDF in path
      if (path.includes('.pdf')) return 'pdf';
      
      // Extract extension from filename
      const filename = path.split('/').pop();
      const match = filename.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
      
      if (match) {
        const ext = match[1].toLowerCase();
        // Validate against our supported formats
        if (validImageFormats.includes(ext)) return ext;
      }
      
      // Check query params for format hints
      const format = parsed.searchParams.get('format') || 
                    parsed.searchParams.get('type') || 
                    parsed.searchParams.get('filetype');
      if (format && validImageFormats.includes(format.toLowerCase())) {
        return format.toLowerCase();
      }

      return null;
    } catch (e) {
      return null;
    }
  }


  // Updated URL processing
  async function processImageUrls (urls) {
    const validUrls = []

    for (const url of urls) {
      if (await isImageUrl(url)) {
        validUrls.push(url)
      }
    }

    return validUrls
  }

function constructFilename(url, addedItems, index) {
  let constructedFilename = '';
  const buildCheckboxChecked = document.getElementById('build-checkbox').checked;

  if (buildCheckboxChecked && addedItems.length > 0) {
    // Only use construction rules if checkbox is checked AND items are added
    constructedFilename = addedItems
      .map(rule => {
        if (rule === 'add_new') return customText;
        switch (rule) {
          case 'filename':
            return extractFilename(url);
          case 'sequence':
            return index + 1;
          case 'timestamp':
            return `${Date.now()}`;
          case 'urlfragments':
            return extractURLFragments(url);
          case 'website':
            return new URL(url).hostname.replace(/\./g, '-');
          case 'uuid':
            return generateShortUUID();
          default:
            return rule;
        }
      })
      .join('');
  } else {
    // Default to just the filename if:
    // 1. Checkbox is unchecked OR
    // 2. Checkbox is checked but no items are added
    constructedFilename = extractFilename(url);
  }

  return constructedFilename;
}

  function extractURLFragments (url) {
    const parsedUrl = new URL(url)
    const fragments = parsedUrl.pathname.split('/').filter(Boolean).join('-')
    return fragments
  }

  function stripDuplicates () {
    const uniqueImageLinks = [
      ...new Set(
        imageLinksTextarea.value
          .split('\n')
          .map(url => url.trim())
          .filter(Boolean)
      )
    ]
    imageLinksTextarea.value = uniqueImageLinks.join('\n')
    updateUrlCount()
    duplicateCountSpan.style.display = 'none'
  }

  function extractFilename (url) {
    const validImageFormats = [
      'jpeg',
      'jpg',
      'png',
      'gif',
      'webp',
      'svg',
      'pdf',
      'apng',
      'bmp',
      'arw',
      'avif',
      'cr2',
      'crw',
      'dcr',
      'dng',
      'exif',
      'hdr',
      'heic',
      'heif',
      'ico',
      'indd',
      'jp2',
      'jfif',
      'nef',
      'orf',
      'raw',
      'raf',
      'rw2',
      'svgz',
      'tiff',
      'tif'
    ]

    const lastSegment = url.substring(url.lastIndexOf('/') + 1)
    const filenameWithParams = lastSegment.split('?')[0].split('!')[0]

    for (let format of validImageFormats) {
      if (filenameWithParams.toLowerCase().endsWith(`.${format}`)) {
        return filenameWithParams.substring(
          0,
          filenameWithParams.toLowerCase().lastIndexOf(`.${format}`)
        )
      }
    }

    const dotIndex = filenameWithParams.lastIndexOf('.')
    if (dotIndex > 0) {
      return filenameWithParams.substring(0, dotIndex)
    }

    return filenameWithParams
  }

  function applyFileTypeFilter(fileType) {
    // Always allow if all formats selected
    if (allFormatsCheckbox.checked) return true;
    
    // Get selected formats
    const selectedFormats = fileTypeCheckboxes
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.id.replace('Checkbox', '').toLowerCase());

    // Special case for PDFs
    if (fileType === 'pdf') {
      return selectedFormats.includes('pdf');
    }

    // Normal image handling
    return selectedFormats.length === 0 || 
           selectedFormats.includes(fileType.toLowerCase());
  }

  function getSelectedFileTypes () {
    return fileTypeCheckboxes
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value)
      .join(', ')
  }

  function downloadTextFile (filename, content) {
    const blob = new Blob([content], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Initialize
  updateLicenseUI()
  updateFileFormatCheckboxes()
  imageLinksTextarea.addEventListener('input', updateUrlCount)
  downloadButton.addEventListener('click', downloadImages)
  stripDuplicatesButton.addEventListener('click', stripDuplicates)
  downloadZipButton.addEventListener('click', downloadZipImages)

  // Dark Mode
  chrome.storage.local.get('darkMode', function (data) {
    if (data.darkMode) {
      document.body.classList.add('dark-mode')
      darkModeToggle.checked = true
    } else {
      document.body.classList.remove('dark-mode')
    }
  })

  darkModeToggle.addEventListener('change', function () {
    const isDarkMode = darkModeToggle.checked
    chrome.storage.local.set({ darkMode: isDarkMode }, function () {
      document.body.classList.toggle('dark-mode', isDarkMode)
    })
  })
})
