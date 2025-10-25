document.addEventListener('DOMContentLoaded', function () {
  // Configuration
  const config = {
    defaultItemsPerPage: 20,
    defaultColumns: 5,
    imageSizeCategories: {
      small: { min: 0, max: 500 },
      medium: { min: 501, max: 1200 },
      large: { min: 1201, max: Infinity }
    },
    imageShapeThreshold: 0.1,
    maxConcurrentLoads: 6 // Limit concurrent image loads
  }

  // State management
  let state = {
    allImages: [],
    filteredImages: [],
    isFiltering: false,
    currentPage: 1,
    itemsPerPage: config.defaultItemsPerPage,
    columns: config.defaultColumns,
    filters: {
      taskId: 'all',
      searchTerm: '',
      sizeCategory: 'all',
      format: 'all',
      shape: 'all',
      minWidth: '',
      maxWidth: '',
      minHeight: '',
      maxHeight: '',
      customRatio: '',
      ratioOperator: '≈',
      minFileSize: '',
      maxFileSize: '',
      fileSizeUnit: 'kb'
    },
    imageDataCache: new Map(),
    isLoading: false
  }

  // DOM elements
  const elements = {
    container: document.getElementById('image-preview-container'),
    prevPageBtn: document.getElementById('prevPage'),
    nextPageBtn: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    imageCount: document.getElementById('imageCount'),
    searchInput: document.getElementById('imageSearch'),
    taskFilter: document.getElementById('taskFilter'),
    perPageSelect: document.getElementById('perPage'),
    refreshBtn: document.getElementById('refreshPreview'),
    columnsInput: document.getElementById('columnsInput'),
    sizeFilter: document.getElementById('sizeFilter'),
    formatFilter: document.getElementById('formatFilter'),
    shapeFilter: document.getElementById('shapeFilter'),
    minWidthInput: document.getElementById('minWidth'),
    maxWidthInput: document.getElementById('maxWidth'),
    minHeightInput: document.getElementById('minHeight'),
    maxHeightInput: document.getElementById('maxHeight'),
    ratioInput: document.getElementById('customRatio'),
    ratioOperator: document.getElementById('ratioOperator'),
    advancedFiltersBtn: document.getElementById('toggleAdvancedFilters'),
    advancedFiltersPanel: document.getElementById('advancedFiltersPanel'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    gridSettingsBtn: document.getElementById('gridSettingsBtn'),
    gridSettingsPanel: document.getElementById('gridSettingsPanel'),
    minFileSizeInput: document.getElementById('minFileSize'),
    maxFileSizeInput: document.getElementById('maxFileSize'),
    fileSizeUnitSelect: document.getElementById('fileSizeUnit')
  }

  // Initialize the preview tab
  function init () {
    setupEventListeners()
    loadTasks()
    setupBulkRemoval()
    updateRemoveButtonState()

    // Load persistent column setting
    chrome.storage.local.get(['gridColumns'], function (result) {
      if (result.gridColumns) {
        state.columns = result.gridColumns
        elements.columnsInput.value = state.columns
        document.getElementById('columnsValue').textContent = state.columns
        renderImages()
      }
    })

    // Load persistent Show Preview checkbox state
    const previewToggle = document.getElementById('previewToggle')
    if (previewToggle) {
      chrome.storage.local.get(['showPreviewChecked'], function (result) {
        const isChecked = result.showPreviewChecked || false
        previewToggle.checked = isChecked
        elements.container.style.display = isChecked ? '' : 'none'
        if (isChecked) {
          updateUI()
        }
      })

      // Save state on change
      previewToggle.addEventListener('change', function () {
        const checked = this.checked
        elements.container.style.display = checked ? '' : 'none'
        chrome.storage.local.set({ showPreviewChecked: checked })
        if (checked) {
          updateUI()
        }
      })
    } else {
      console.error('previewToggle element not found in init()')
    }

    updateUI()
  }

  // Load tasks from storage
  function loadTasks () {
    state.isLoading = true
    updateLoadingState()

    chrome.storage.local.get('tasks', function (data) {
      try {
        const tasks = data.tasks || []

        // Only process tasks if they've actually changed
        if (hasTasksChanged(tasks)) {
          updateTaskFilterOptions(tasks)
          processTasksForPreview(tasks)
        } else {
          // Just update the UI with existing data
          state.isLoading = false
          updateLoadingState()
          updateUI()
        }
      } catch (error) {
        console.error('Error in loadTasks:', error)
        state.isLoading = false
        updateLoadingState()
        updateUI()
      }
    })
  }

  // Update task filter dropdown
  function updateTaskFilterOptions (tasks) {
    elements.taskFilter.innerHTML = '<option value="all">All Tasks</option>'

    tasks.forEach(task => {
      const option = document.createElement('option')
      option.value = task.id
      option.textContent =
        `Task ${task.id}` + (task.folderName ? ` (${task.folderName})` : '')
      elements.taskFilter.appendChild(option)
    })
  }

  // Process tasks to extract images for preview
  async function processTasksForPreview (tasks) {
    try {
      // Create a new array for the updated images
      const newImages = []

      // Remove the processedUrls Set to allow duplicates
      // Process each task and URL
      tasks.forEach(task => {
        task.urls.forEach(url => {
          const trimmedUrl = url.trim()
          if (trimmedUrl) {
            // Try to find existing image data in cache or current state
            const existingImage =
              state.allImages.find(img => img.url === trimmedUrl) ||
              state.imageDataCache.get(trimmedUrl)

            const imageObj = {
              url: trimmedUrl,
              taskId: task.id,
              folderName: task.folderName || 'No folder',
              fileTypes: task.fileTypes.join(', '),
              status: task.status,
              width: existingImage?.width || 0,
              height: existingImage?.height || 0,
              aspectRatio: existingImage?.aspectRatio || 0,
              format:
                existingImage?.format ||
                extractFormatFromUrl(trimmedUrl) ||
                'pending',
              sizeCategory: existingImage?.sizeCategory || 'unknown',
              shape: existingImage?.shape || 'unknown',
              fileSize: existingImage?.fileSize || 0,
              loaded: !!existingImage,
              isDuplicate: false // We'll set this later
            }

            newImages.push(imageObj)
          }
        })
      })

      // Update state
      state.allImages = newImages

      // Mark duplicates before filtering
      markDuplicatesInState()

      state.filteredImages = newImages.slice()
      state.currentPage = 1

      // Initial render
      applyFilters()

      // Load metadata for visible images first
      await loadVisibleImagesMetadata()

      // Then load the rest in background
      await loadRemainingImagesMetadata()
    } catch (error) {
      console.error('Error in processTasksForPreview:', error)
    } finally {
      state.isLoading = false
      updateLoadingState()
      checkForDuplicates()
      updateRemoveButtonState()
    }
  }

  // New function to mark duplicates in the state
  function markDuplicatesInState () {
    const urlMap = new Map()

    // First pass to count occurrences
    state.allImages.forEach(image => {
      const normalizedUrl = image.url.trim()
      urlMap.set(normalizedUrl, (urlMap.get(normalizedUrl) || 0) + 1)
    })

    // Second pass to mark duplicates (all but first occurrence)
    const seenUrls = new Set()
    state.allImages.forEach(image => {
      const normalizedUrl = image.url.trim()
      if (seenUrls.has(normalizedUrl)) {
        image.isDuplicate = true
      } else {
        seenUrls.add(normalizedUrl)
        image.isDuplicate = false
      }
    })
  }

  async function loadVisibleImagesMetadata () {
    const visibleImages = state.filteredImages
      .slice(
        (state.currentPage - 1) * state.itemsPerPage,
        state.currentPage * state.itemsPerPage
      )
      .filter(img => !img.loaded)

    // Load metadata for visible images with concurrency control
    await Promise.all(
      visibleImages.map(
        img => loadImageMetadata(img, true) // true = prioritize
      )
    )
  }

  async function loadRemainingImagesMetadata () {
    try {
      const unloadedImages = state.allImages.filter(img => !img.loaded)
      const BATCH_SIZE = config.maxConcurrentLoads

      for (let i = 0; i < unloadedImages.length; i += BATCH_SIZE) {
        const batch = unloadedImages.slice(i, i + BATCH_SIZE)
        await Promise.all(batch.map(img => loadImageMetadata(img, false)))

        // Update UI periodically
        if (i % (BATCH_SIZE * 3) === 0) {
          applyFilters()
        }
      }
    } catch (error) {
      console.error('Error in loadRemainingImagesMetadata:', error)
    }
  }

  // Load image metadata (dimensions)
  async function loadImageMetadata (imageObj, isPriority = false) {
    if (imageObj.loaded || !isValidImageUrl(imageObj.url)) {
      setFallbackImageData(imageObj)
      return
    }

    // Skip if already in cache
    if (state.imageDataCache.has(imageObj.url)) {
      const cached = state.imageDataCache.get(imageObj.url)
      Object.assign(imageObj, cached)
      imageObj.loaded = true
      return
    }

    try {
      // First try to get metadata via HEAD request
      let fileSize = 0
      let contentType = ''
      try {
        const response = await fetch(imageObj.url, { method: 'HEAD' })
        if (response.ok) {
          const contentLength = response.headers.get('content-length')
          fileSize = contentLength ? parseInt(contentLength) : 0
          contentType = response.headers.get('content-type') || ''
        }
      } catch (e) {
        console.log('HEAD request failed, proceeding with full load', e)
      }

      // Get format from content type if available
      const formatFromHeaders = getFormatFromContentType(contentType)

      // Then load the image to get dimensions
      const img = new Image()
      img.src = imageObj.url

      await new Promise((resolve, reject) => {
        img.onload = () => {
          imageObj.width = img.naturalWidth
          imageObj.height = img.naturalHeight
          imageObj.aspectRatio = img.naturalWidth / img.naturalHeight
          imageObj.fileSize = fileSize
          imageObj.loaded = true
          imageObj.format =
            formatFromHeaders || extractFormatFromUrl(imageObj.url) || 'unknown'

          // Calculate size category
          const diagonal = Math.sqrt(
            Math.pow(imageObj.width, 2) + Math.pow(imageObj.height, 2)
          )
          if (diagonal <= config.imageSizeCategories.small.max) {
            imageObj.sizeCategory = 'small'
          } else if (diagonal <= config.imageSizeCategories.medium.max) {
            imageObj.sizeCategory = 'medium'
          } else {
            imageObj.sizeCategory = 'large'
          }

          // Calculate shape
          const ratioDiff = Math.abs(imageObj.aspectRatio - 1)
          if (ratioDiff < config.imageShapeThreshold) {
            imageObj.shape = 'square'
          } else if (imageObj.aspectRatio > 1) {
            imageObj.shape = 'horizontal'
          } else {
            imageObj.shape = 'vertical'
          }

          // Cache the results
          state.imageDataCache.set(imageObj.url, {
            width: imageObj.width,
            height: imageObj.height,
            aspectRatio: imageObj.aspectRatio,
            sizeCategory: imageObj.sizeCategory,
            shape: imageObj.shape,
            format: imageObj.format,
            fileSize: imageObj.fileSize,
            loaded: true
          })

          resolve()
        }

        img.onerror = () => {
          setFallbackImageData(imageObj)
          resolve()
        }
      })
    } catch (error) {
      console.error('Error loading image metadata:', error, imageObj.url)
      setFallbackImageData(imageObj)
    }
  }

  // New helper function to extract format from Content-Type
  function getFormatFromContentType (contentType) {
    if (!contentType) return null

    const mimeToFormat = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/x-ms-bmp': 'bmp',
      'image/tiff': 'tiff',
      'image/x-icon': 'ico',
      'image/vnd.microsoft.icon': 'ico',
      'application/pdf': 'pdf',
      'image/apng': 'apng',
      'image/avif': 'avif',
      'image/x-canon-cr2': 'cr2',
      'image/x-canon-crw': 'crw',
      'image/x-adobe-dng': 'dng',
      'image/x-exif': 'exif',
      'image/vnd.radiance': 'hdr',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'image/x-indesign': 'indd',
      'image/jp2': 'jp2',
      'image/jfif': 'jfif',
      'image/x-nikon-nef': 'nef',
      'image/x-olympus-orf': 'orf',
      'image/x-panasonic-raw': 'rw2',
      'image/x-fuji-raf': 'raf',
      'image/x-raw': 'raw',
      'image/svg+xml-compressed': 'svgz',
      'image/tif': 'tif'
    }

    const mainType = contentType.split(';')[0].trim().toLowerCase()
    return mimeToFormat[mainType] || null
  }

  /**
   * @deprecated Only used as fallback when Content-Type isn't available
   * Returns format based on URL extension
   */
  function extractFormatFromUrl (url) {
    const format = url.split('.').pop().split(/[?#]/)[0].toLowerCase()
    const validFormats = [
      'jpg',
      'jpeg',
      'png',
      'gif',
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
    ]
    return validFormats.includes(format) ? format : 'other'
  }

  function loadImageDimensions (imageObj, resolve) {
    const img = new Image()

    img.onload = function () {
      // Set basic dimensions
      imageObj.width = this.naturalWidth
      imageObj.height = this.naturalHeight
      imageObj.aspectRatio = this.naturalWidth / this.naturalHeight

      // Calculate size category based on diagonal
      const diagonal = Math.sqrt(
        Math.pow(imageObj.width, 2) + Math.pow(imageObj.height, 2)
      )
      if (diagonal <= config.imageSizeCategories.small.max) {
        imageObj.sizeCategory = 'small'
      } else if (diagonal <= config.imageSizeCategories.medium.max) {
        imageObj.sizeCategory = 'medium'
      } else {
        imageObj.sizeCategory = 'large'
      }

      // Determine image shape
      const ratioDiff = Math.abs(imageObj.aspectRatio - 1)
      if (ratioDiff < config.imageShapeThreshold) {
        imageObj.shape = 'square'
      } else if (imageObj.aspectRatio > 1) {
        imageObj.shape = 'horizontal'
      } else {
        imageObj.shape = 'vertical'
      }

      // Update cache - don't modify format here as it should come from Content-Type
      state.imageDataCache.set(imageObj.url, {
        width: imageObj.width,
        height: imageObj.height,
        aspectRatio: imageObj.aspectRatio,
        sizeCategory: imageObj.sizeCategory,
        shape: imageObj.shape,
        format: imageObj.format, // Preserve existing format
        fileSize: imageObj.fileSize || 0 // Preserve file size if available
      })

      resolve()
    }

    img.onerror = function () {
      // On error, set fallback data but preserve any existing format info
      const currentFormat = imageObj.format
      setFallbackImageData(imageObj)

      // Restore the format if it was already set
      if (currentFormat && currentFormat !== 'pending') {
        imageObj.format = currentFormat
      }

      resolve()
    }

    // Start loading the image
    img.src = imageObj.url

    // Optional: Add timeout handling
    const loadTimeout = setTimeout(() => {
      img.onload = img.onerror = null // Remove handlers
      setFallbackImageData(imageObj)
      resolve()
    }, 30000) // 30 second timeout

    // Clear timeout if image loads
    img.onload = img.onerror = function () {
      clearTimeout(loadTimeout)
      // Call original handler
      if (this === img) {
        if (img.onload) img.onload()
        if (img.onerror) img.onerror()
      }
    }.bind(img)
  }

  function isValidImageUrl (url) {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:', 'data:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  // Also update the setFallbackImageData function to handle invalid URLs better:
  function setFallbackImageData (imageObj) {
    imageObj.width = 0
    imageObj.height = 0
    imageObj.aspectRatio = 0
    imageObj.fileSize = 0
    imageObj.sizeCategory = 'unknown'
    imageObj.shape = 'unknown'
    imageObj.format =
      imageObj.format === 'pending'
        ? extractFormatFromUrl(imageObj.url) || 'unknown'
        : imageObj.format // Preserve format if already set
  }

  function hasTasksChanged (newTasks) {
    if (
      state.allImages.length !==
      newTasks.reduce((sum, task) => sum + task.urls.length, 0)
    ) {
      return true
    }

    // Check if any URLs have changed
    const currentUrls = new Set(state.allImages.map(img => img.url))
    for (const task of newTasks) {
      for (const url of task.urls) {
        if (!currentUrls.has(url.trim())) {
          return true
        }
      }
    }

    return false
  }

  // Apply all active filters
  function applyFilters (forceRefresh = false, preservePage = false) {
    state.isFiltering = true
    updateImageCount()

    if (forceRefresh) {
      state.filteredImages.forEach(img => {
        if (
          img.taskId === state.filters.taskId ||
          state.filters.taskId === 'all'
        ) {
          state.imageDataCache.delete(img.url)
          img.loaded = false
        }
      })
    }

    performFiltering(preservePage)
      .then(() => {
        state.isFiltering = false
        updateImageCount()
        checkForDuplicates()
        updateRemoveButtonState()

        return loadVisibleImagesMetadata()
      })
      .catch(error => {
        console.error('Error in applyFilters:', error)
        state.isFiltering = false
        updateImageCount()
      })
      .finally(() => {
        state.isLoading = false
        updateLoadingState()
      })
  }

  function performFiltering (preservePage = false) {
    return new Promise(resolve => {
      // Store previous state for comparison
      const previousFilteredCount = state.filteredImages.length
      const previousTaskFilter = state.filters.taskId
      const previousSearchTerm = state.filters.searchTerm
      const previousSizeCategory = state.filters.sizeCategory
      const previousFormat = state.filters.format
      const previousShape = state.filters.shape

      // Apply all filters
      state.filteredImages = state.allImages.filter(image => {
        // Basic filters
        const matchesSearch =
          state.filters.searchTerm === '' ||
          image.url.toLowerCase().includes(state.filters.searchTerm) ||
          image.folderName.toLowerCase().includes(state.filters.searchTerm)

        const matchesTask =
          state.filters.taskId === 'all' ||
          image.taskId === state.filters.taskId

        // Size filters
        const matchesSize =
          state.filters.sizeCategory === 'all' ||
          image.sizeCategory === state.filters.sizeCategory

        // Format filter
        const matchesFormat =
          state.filters.format === 'all' ||
          image.format === state.filters.format

        // Shape filter
        const matchesShape =
          state.filters.shape === 'all' || image.shape === state.filters.shape

        // Dimension filters
        const matchesMinWidth =
          state.filters.minWidth === '' ||
          (image.width && image.width >= parseInt(state.filters.minWidth))
        const matchesMaxWidth =
          state.filters.maxWidth === '' ||
          (image.width && image.width <= parseInt(state.filters.maxWidth))
        const matchesMinHeight =
          state.filters.minHeight === '' ||
          (image.height && image.height >= parseInt(state.filters.minHeight))
        const matchesMaxHeight =
          state.filters.maxHeight === '' ||
          (image.height && image.height <= parseInt(state.filters.maxHeight))

        // Aspect ratio filter with more precise handling
        let matchesRatio = true
        if (state.filters.customRatio !== '' && image.aspectRatio) {
          const [w, h] = state.filters.customRatio.split(':').map(Number)
          if (w && h) {
            const targetRatio = w / h
            const ratioDiff = Math.abs(image.aspectRatio - targetRatio)

            matchesRatio = {
              '≈': ratioDiff < 0.1, // Approximately equal (within 10%)
              '>': image.aspectRatio > targetRatio,
              '<': image.aspectRatio < targetRatio,
              '≥': image.aspectRatio >= targetRatio,
              '≤': image.aspectRatio <= targetRatio
            }[state.filters.ratioOperator]
          }
        }

        // File size filter
        let matchesFileSize = true
        if (
          (state.filters.minFileSize !== '' ||
            state.filters.maxFileSize !== '') &&
          image.fileSize > 0
        ) {
          // Convert file size to the selected unit (KB or MB)
          let fileSizeInUnit
          if (state.filters.fileSizeUnit === 'kb') {
            fileSizeInUnit = image.fileSize / 1024 // Convert bytes to KB
          } else {
            fileSizeInUnit = image.fileSize / (1024 * 1024) // Convert bytes to MB
          }

          // Check min and max size
          if (state.filters.minFileSize !== '') {
            matchesFileSize =
              matchesFileSize &&
              fileSizeInUnit >= parseFloat(state.filters.minFileSize)
          }
          if (state.filters.maxFileSize !== '') {
            matchesFileSize =
              matchesFileSize &&
              fileSizeInUnit <= parseFloat(state.filters.maxFileSize)
          }
        }

        return (
          matchesSearch &&
          matchesTask &&
          matchesSize &&
          matchesFormat &&
          matchesShape &&
          matchesMinWidth &&
          matchesMaxWidth &&
          matchesMinHeight &&
          matchesMaxHeight &&
          matchesRatio &&
          matchesFileSize
        )
      })

      // Determine if we should reset to page 1
      const shouldResetPage = () => {
        // Reset for major filter changes
        if (previousTaskFilter !== state.filters.taskId) return true
        if (previousSearchTerm !== state.filters.searchTerm) return true
        if (previousSizeCategory !== state.filters.sizeCategory) return true
        if (previousFormat !== state.filters.format) return true
        if (previousShape !== state.filters.shape) return true

        // Don't reset for other changes if preservePage is true
        if (preservePage) return false

        // Only reset if results changed significantly (more than one page worth)
        const countDifference = Math.abs(
          previousFilteredCount - state.filteredImages.length
        )
        return countDifference > state.itemsPerPage
      }

      if (shouldResetPage()) {
        state.currentPage = 1
      } else {
        // Ensure current page is still valid after filtering
        const maxPage = Math.max(
          1,
          Math.ceil(state.filteredImages.length / state.itemsPerPage)
        )
        if (state.currentPage > maxPage) {
          state.currentPage = maxPage
        }
      }

      // Update UI
      updateUI()

      // Check if we need to load metadata for visible images
      const startIdx = (state.currentPage - 1) * state.itemsPerPage
      const endIdx = startIdx + state.itemsPerPage
      const currentPageImages = state.filteredImages.slice(startIdx, endIdx)

      if (currentPageImages.some(img => !img.loaded)) {
        loadVisibleImagesMetadata().finally(resolve)
      } else {
        resolve()
      }
    })
  }

  // Render images for current page
  function renderImages () {
    elements.container.innerHTML = ''

    const startIndex = (state.currentPage - 1) * state.itemsPerPage
    const endIndex = Math.min(
      startIndex + state.itemsPerPage,
      state.filteredImages.length
    )
    const imagesToShow = state.filteredImages.slice(startIndex, endIndex)

    if (imagesToShow.length === 0) {
      elements.container.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-image"></i>
                    <p>No images match your filters</p>
                    <p>Create a task and add some image URLs in the tasks. Click Draft Save and come back here</p>
                    <p>This will allow you to use advanced filters and bulk handle duplicates in tasks etc </p>
                    <button id="resetFiltersBtn" class="btn">Reset Filters</button>
                </div>
            `

      document
        .getElementById('resetFiltersBtn')
        ?.addEventListener('click', resetFilters)
      return
    }

    // Set grid columns
    elements.container.style.gridTemplateColumns = `repeat(${state.columns}, 1fr)`

    imagesToShow.forEach(image => {
      const imageCard = createImageCard(image)
      elements.container.appendChild(imageCard)
    })

    updatePaginationControls()
  }

  // Create an image card element
  // Create an image card element
  function createImageCard (image) {
    const card = document.createElement('div')
    card.className = 'image-card'
    card.dataset.width = image.width
    card.dataset.height = image.height
    card.dataset.format = image.format
    card.dataset.shape = image.shape
    card.dataset.size = image.sizeCategory

    // Add duplicate indicator class if this is a duplicate
    if (image.isDuplicate) {
      card.classList.add('duplicate-image')
    }

    // Add checkbox for bulk selection
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'image-checkbox'
    checkbox.dataset.url = image.url
    checkbox.dataset.taskId = image.taskId
    card.appendChild(checkbox)

    const imgWrapper = document.createElement('div')
    imgWrapper.className = 'image-wrapper'

    // Add duplicate badge if this is a duplicate
    if (image.isDuplicate) {
      const duplicateBadge = document.createElement('div')
      duplicateBadge.className = 'duplicate-badge'
      duplicateBadge.innerHTML = '<i class="fas fa-clone"></i> Duplicate'
      imgWrapper.appendChild(duplicateBadge)
    }

    const img = document.createElement('img')
    img.src = image.url
    img.alt = 'Preview'
    img.loading = 'lazy'

    img.onerror = function () {
      // Remove the image and show error message
      img.remove()
      const errorMsg = document.createElement('div')
      errorMsg.className = 'image-error'
      errorMsg.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>Image not found</span>
        `
      imgWrapper.appendChild(errorMsg)
      loader.remove()
    }

    const loader = document.createElement('div')
    loader.className = 'image-loader'
    loader.innerHTML = '<div class="spinner"></div>'

    img.onload = function () {
      loader.remove()
    }

    imgWrapper.appendChild(loader)
    imgWrapper.appendChild(img)

    const info = document.createElement('div')
    info.className = 'image-info'

    const url = document.createElement('p')
    url.className = 'image-url'
    url.textContent =
      image.url.length > 40 ? image.url.substring(0, 40) + '...' : image.url
    url.title = image.url

    const meta = document.createElement('div')
    meta.className = 'image-meta'

    const dimensions = document.createElement('span')
    dimensions.className = 'dimensions'
    dimensions.innerHTML = `<i class="fas fa-expand"></i> ${image.width}×${image.height}`

    const format = document.createElement('span')
    format.className = 'format'
    format.innerHTML = `<i class="fas fa-file-image"></i> ${image.format.toUpperCase()}`

    const size = document.createElement('span')
    size.className = 'size'
    size.innerHTML = `<i class="fas fa-ruler-combined"></i> ${image.sizeCategory}`

    meta.appendChild(dimensions)
    meta.appendChild(format)
    meta.appendChild(size)

    // Only add file size if the setting is enabled
    const fileSize = document.createElement('span')
    fileSize.className = 'file-size'
    if (image.fileSize > 0) {
      const sizeInKB = (image.fileSize / 1024).toFixed(2)
      const sizeInMB = (image.fileSize / (1024 * 1024)).toFixed(2)

      // Display in appropriate unit
      if (image.fileSize >= 1024 * 1024) {
        fileSize.innerHTML = `<i class="fas fa-weight-hanging"></i> ${sizeInMB} MB`
      } else {
        fileSize.innerHTML = `<i class="fas fa-weight-hanging"></i> ${sizeInKB} KB`
      }
    } else {
      fileSize.innerHTML = `<i class="fas fa-weight-hanging"></i> N/A`
    }
    meta.appendChild(fileSize)

    const taskInfo = document.createElement('div')
    taskInfo.className = 'task-info'
    taskInfo.innerHTML = `
        <span><i class="fas fa-folder"></i> ${image.folderName}</span>
        <span><i class="fas fa-tag"></i> Task ${image.taskId}</span>
    `

    info.appendChild(url)
    info.appendChild(meta)
    info.appendChild(taskInfo)

    const actions = document.createElement('div')
    actions.className = 'image-actions'
    actions.innerHTML = `
        <button class="action-btn copy-btn" title="Copy URL">
            <i class="fas fa-copy"></i>
        </button>
        <button class="action-btn open-btn" title="Open in new tab">
            <i class="fas fa-external-link-alt"></i>
        </button>
    `

    card.appendChild(imgWrapper)
    card.appendChild(info)
    card.appendChild(actions)

    // Add event listeners to action buttons
    card
      .querySelector('.copy-btn')
      .addEventListener('click', () => copyToClipboard(image.url))
    card
      .querySelector('.open-btn')
      .addEventListener('click', () => window.open(image.url, '_blank'))

    return card
  }

  function setupBulkRemoval () {
    // Add bulk removal controls to the UI
    const bulkControls = document.createElement('div')
    bulkControls.className = 'bulk-removal-controls'
    bulkControls.innerHTML = `
        <div class="bulk-controls-group">
            <button id="selectAllBtn" class="control-btn" title="Select all images on current page">
                <i class="fas fa-check-square"></i> Select All
            </button>
            <button id="selectAllFilteredBtn" class="control-btn" title="Select all images matching current filters">
                <i class="fas fa-check-double"></i> Select Filtered
            </button>
            <button id="deselectAllBtn" class="control-btn" title="Deselect all images">
                <i class="fas fa-square"></i> Deselect All
            </button>
        </div>
        <div class="bulk-controls-group">
            <button id="removeSelectedBtn" class="control-btn remove-selected-btn danger-btn" disabled 
                title="Remove selected images from their tasks">
                <i class="fas fa-trash"></i> Remove Selected
            </button>
            <button id="removeDuplicatesBtn" class="control-btn remove-duplicates-btn" disabled
                title="Remove duplicate URLs across all tasks (keeps first occurrence)">
                <i class="fas fa-clone"></i> Remove Duplicates
            </button>
            <button id="keepFilteredOnlyBtn" class="control-btn keep-filtered-btn"
                title="Remove all images except those matching current filters">
                <i class="fas fa-filter"></i> Keep Filtered Only
            </button>
        </div>
        <div class="bulk-controls-group">
            <span id="selectedCount" class="selection-counter">0 selected</span>
            <span id="duplicateCount" class="duplicate-counter"></span>
        </div>
    `

    const previewToggleDiv = document.createElement('div')
    previewToggleDiv.className = 'preview-toggle-container'
    previewToggleDiv.style.marginBottom = '10px' // add spacing if needed
    previewToggleDiv.innerHTML = `
    <label class="ko-switch">
      <input type="checkbox" id="previewToggle" class="ko-switch-input" />
      <span class="ko-switch-slider"></span>
    </label>
    <span class="ko-switch-label">Show Preview</span>

    `
    elements.container.parentNode.insertBefore(
      previewToggleDiv,
      elements.container
    )

    // Since default is unchecked, hide the container at start
    elements.container.style.display = 'none'

    const previewToggle = document.getElementById('previewToggle')
    if (previewToggle) {
      previewToggle.addEventListener('change', function () {
        if (this.checked) {
          elements.container.style.display = ''
          updateUI()
        } else {
          elements.container.style.display = 'none'
        }
      })
    } else {
      console.error('previewToggle element not found')
    }

    // Insert bulkControls just before the image preview container
    elements.container.parentNode.insertBefore(bulkControls, elements.container)

    // Create the paragraph element
    const infoParagraph = document.createElement('p')
    infoParagraph.textContent =
      'If the images or the image metadata is taking longer to display simply turn the Preview Switch OFF/ON. Alternatively, switch to Downloader tab, click Draft Save & refresh the page. (If you have lots of urls)'
    infoParagraph.classList.add('info-paragraph')
    infoParagraph.style.margin = '10px 0' // Optional styling for spacing
    infoParagraph.style.fontSize = '12px' // Example font size
    infoParagraph.style.color = '#555555' // Example text color
    infoParagraph.style.textAlign = 'right'

    // Insert the paragraph after bulkControls but before the image preview container
    elements.container.parentNode.insertBefore(
      infoParagraph,
      elements.container
    )

    // Add event listeners with error handling
    function addSafeListener (id, handler) {
      const element = document.getElementById(id)
      if (element) {
        element.addEventListener('click', handler)
      } else {
        console.error(`Element with ID ${id} not found`)
      }
    }

    addSafeListener('selectAllBtn', selectAllImages)
    addSafeListener('selectAllFilteredBtn', selectAllFilteredImages)
    addSafeListener('deselectAllBtn', deselectAllImages)
    addSafeListener('removeSelectedBtn', removeSelectedImages)
    addSafeListener('removeDuplicatesBtn', removeDuplicateImages)
    addSafeListener('keepFilteredOnlyBtn', keepFilteredOnly)

    // Enhanced event delegation for dynamically created checkboxes
    elements.container.addEventListener('change', function (e) {
      if (e.target.classList.contains('image-checkbox')) {
        updateSelectedCount()
        updateRemoveButtonState()
      }
    })

    // Also handle click events for better mobile compatibility
    elements.container.addEventListener('click', function (e) {
      if (e.target.classList.contains('image-checkbox')) {
        // Small delay to ensure checkbox state is updated
        setTimeout(() => {
          updateSelectedCount()
          updateRemoveButtonState()
        }, 50)
      }
    })

    // Initialize button states
    updateRemoveButtonState()
    checkForDuplicates()
  }

  // Select all filtered images
  function selectAllFilteredImages () {
    // First deselect all
    deselectAllImages()

    // Select all images in filtered set (not just current page)
    const checkboxes = document.querySelectorAll('.image-checkbox')
    const filteredUrls = new Set(state.filteredImages.map(img => img.url))

    checkboxes.forEach(checkbox => {
      if (filteredUrls.has(checkbox.dataset.url)) {
        checkbox.checked = true
      }
    })

    updateSelectedCount()
    updateRemoveButtonState()
    showToast(`Selected all ${state.filteredImages.length} filtered images`)
  }

  function keepFilteredOnly () {
    if (state.filteredImages.length === 0) {
      showToast('No filtered images to keep')
      return
    }

    if (state.filteredImages.length === state.allImages.length) {
      showToast('All images are already included in the filter')
      return
    }

    if (
      !confirm(
        `Are you sure you want to remove all images except the ${state.filteredImages.length} that match your current filters? This action cannot be undone.`
      )
    ) {
      return
    }

    // Group by task ID for more efficient updates
    const removalsByTask = {}

    // Find all URLs that should be removed (those not in filteredImages)
    const filteredUrls = new Set(state.filteredImages.map(img => img.url))
    state.allImages.forEach(image => {
      if (!filteredUrls.has(image.url)) {
        const taskId = image.taskId
        if (!removalsByTask[taskId]) {
          removalsByTask[taskId] = []
        }
        removalsByTask[taskId].push(image.url)
      }
    })

    // Process each affected task
    chrome.storage.local.get('tasks', function (data) {
      const tasks = data.tasks || []
      let updatedTasks = [...tasks]
      let tasksModified = false

      Object.keys(removalsByTask).forEach(taskId => {
        const urlsToRemove = removalsByTask[taskId]
        const taskIndex = updatedTasks.findIndex(t => t.id === taskId)

        if (taskIndex !== -1) {
          const originalUrls = updatedTasks[taskIndex].urls
          const updatedUrls = originalUrls.filter(
            url => !urlsToRemove.includes(url.trim())
          )

          if (updatedUrls.length !== originalUrls.length) {
            const updatedTask = {
              ...updatedTasks[taskIndex],
              urls: updatedUrls
            }
            updatedTasks[taskIndex] = updatedTask
            tasksModified = true

            // Update the corresponding textarea in the options tab
            updateTextareaForTask(taskId, updatedUrls)
          }
        }
      })

      if (tasksModified) {
        // Save all changes at once
        chrome.storage.local.set({ tasks: updatedTasks }, function () {
          // Completely reset the preview state
          state.allImages = state.filteredImages.slice() // Keep only filtered images
          state.filteredImages = state.allImages.slice()
          state.currentPage = 1
          state.imageDataCache.clear()

          // Reload all tasks to get fresh state
          loadTasks()

          showToast(`Kept only ${state.filteredImages.length} filtered images`)
        })
      } else {
        showToast('No changes were made')
      }
    })
  }

  function checkForDuplicates () {
    if (!state.allImages.length) return false

    const urlMap = new Map()
    let duplicateCount = 0

    state.allImages.forEach(image => {
      const normalizedUrl = image.url.trim()
      if (urlMap.has(normalizedUrl)) {
        duplicateCount++
      } else {
        urlMap.set(normalizedUrl, true)
      }
    })

    const duplicatesBtn = document.getElementById('removeDuplicatesBtn')
    if (duplicatesBtn) {
      duplicatesBtn.disabled = duplicateCount === 0
      duplicatesBtn.title =
        duplicateCount > 0
          ? `Remove ${duplicateCount} duplicate URLs`
          : 'No duplicates found'
    }

    // Update duplicate counter
    const duplicateElement = document.getElementById('duplicateCount')
    if (duplicateElement) {
      if (duplicateCount > 0) {
        duplicateElement.textContent = `${duplicateCount} duplicates`
        duplicateElement.style.display = 'inline'
      } else {
        duplicateElement.style.display = 'none'
      }
    }

    return duplicateCount > 0
  }

  function removeDuplicateImages () {
    if (!checkForDuplicates()) {
      showToast('No duplicates found')
      return
    }

    if (
      !confirm(
        'Are you sure you want to remove all duplicate URLs? This will keep the first occurrence of each URL and remove all subsequent duplicates.'
      )
    ) {
      return
    }

    chrome.storage.local.get('tasks', function (data) {
      const tasks = data.tasks || []
      const updatedTasks = [...tasks]
      let tasksModified = false
      const seenUrls = new Set()

      // First pass: identify all unique URLs (first occurrences)
      tasks.forEach(task => {
        task.urls.forEach(url => {
          const trimmedUrl = url.trim()
          if (trimmedUrl) {
            seenUrls.add(trimmedUrl)
          }
        })
      })

      // Second pass: remove duplicates from each task while preserving first occurrences
      updatedTasks.forEach(task => {
        const originalUrls = task.urls
        const uniqueUrls = []
        const taskSeenUrls = new Set()

        originalUrls.forEach(url => {
          const trimmedUrl = url.trim()
          if (trimmedUrl) {
            // Only add if it's the first time we're seeing it in this task
            // OR if it hasn't been seen globally yet (preserves first occurrence across all tasks)
            if (!taskSeenUrls.has(trimmedUrl)) {
              taskSeenUrls.add(trimmedUrl)
              if (seenUrls.has(trimmedUrl)) {
                uniqueUrls.push(url)
                seenUrls.delete(trimmedUrl) // Remove from global set so we don't keep it again
              }
            } else {
              tasksModified = true
            }
          }
        })

        if (uniqueUrls.length !== originalUrls.length) {
          task.urls = uniqueUrls
          updateTextareaForTask(task.id, uniqueUrls)
          tasksModified = true
        }
      })

      if (tasksModified) {
        chrome.storage.local.set({ tasks: updatedTasks }, function () {
          // Rebuild the image list keeping only first occurrences
          const newImages = []
          const seenUrls = new Set()

          updatedTasks.forEach(task => {
            task.urls.forEach(url => {
              const trimmedUrl = url.trim()
              if (trimmedUrl && !seenUrls.has(trimmedUrl)) {
                seenUrls.add(trimmedUrl)
                const existingImage = state.allImages.find(
                  img => img.url === trimmedUrl
                )
                if (existingImage) {
                  newImages.push({
                    ...existingImage,
                    isDuplicate: false
                  })
                }
              }
            })
          })

          state.allImages = newImages
          applyFilters(true)
          showToast(
            'Duplicate URLs removed successfully (kept first occurrence of each)'
          )
        })
      } else {
        showToast('No duplicates found to remove')
      }
    })
  }

  function updateRemoveButtonState () {
    const removeBtn = document.getElementById('removeSelectedBtn')
    const duplicateBtn = document.getElementById('removeDuplicatesBtn')

    if (!removeBtn || !duplicateBtn) return

    const selectedCount = document.querySelectorAll(
      '.image-checkbox:checked'
    ).length
    removeBtn.disabled = selectedCount === 0

    // Add/remove 'active' class based on selection
    if (selectedCount > 0) {
      removeBtn.classList.add('active')
      removeBtn.classList.add('danger-btn')
    } else {
      removeBtn.classList.remove('active')
      removeBtn.classList.remove('danger-btn')
    }

    removeBtn.title =
      selectedCount > 0
        ? `Remove ${selectedCount} selected images`
        : 'Select images to enable removal'

    // Check for duplicates in the entire collection, not just current page
    const hasDuplicates = checkForDuplicates()
    duplicateBtn.disabled = !hasDuplicates
    duplicateBtn.title = hasDuplicates
      ? 'Remove all duplicate URLs (keeps first occurrence)'
      : 'No duplicates found'
  }

  function selectAllImages () {
    document.querySelectorAll('.image-checkbox').forEach(checkbox => {
      checkbox.checked = true
    })
    updateSelectedCount()
    updateRemoveButtonState()
  }

  function deselectAllImages () {
    document.querySelectorAll('.image-checkbox').forEach(checkbox => {
      checkbox.checked = false
    })
    updateSelectedCount()
    updateRemoveButtonState()
  }

  // Enhanced updateSelectedCount with duplicate info
  function updateSelectedCount () {
    const selectedCount = document.querySelectorAll(
      '.image-checkbox:checked'
    ).length
    const selectedElement = document.getElementById('selectedCount')

    if (selectedElement) {
      selectedElement.textContent = `${selectedCount} selected`
      selectedElement.classList.toggle('has-selection', selectedCount > 0)

      // Update duplicate counter if showing
      const duplicateElement = document.getElementById('duplicateCount')
      if (duplicateElement) {
        const duplicateUrls = findDuplicateUrls()
        const selectedDuplicates = Array.from(
          document.querySelectorAll('.image-checkbox:checked')
        ).filter(checkbox => duplicateUrls.has(checkbox.dataset.url)).length

        if (selectedDuplicates > 0) {
          duplicateElement.textContent = `${selectedDuplicates} duplicates`
          duplicateElement.style.display = 'inline'
        } else {
          duplicateElement.style.display = 'none'
        }
      }
    }
  }

  // Helper function to find all duplicate URLs
  function findDuplicateUrls () {
    const urlMap = new Map()
    const duplicateUrls = new Set()

    state.allImages.forEach(image => {
      const normalizedUrl = image.url.trim()
      if (urlMap.has(normalizedUrl)) {
        duplicateUrls.add(normalizedUrl)
      } else {
        urlMap.set(normalizedUrl, true)
      }
    })

    return duplicateUrls
  }

  function removeSelectedImages () {
    const checkboxes = Array.from(
      document.querySelectorAll('.image-checkbox:checked')
    )
    if (checkboxes.length === 0) {
      showToast('No images selected')
      return
    }

    // Check if any selected URLs are duplicates
    const duplicateUrls = findDuplicateUrls()
    const selectedUrls = checkboxes.map(checkbox => checkbox.dataset.url)
    const hasDuplicateSelection = selectedUrls.some(url =>
      duplicateUrls.has(url.split('?')[0].split('#')[0].trim())
    )

    if (hasDuplicateSelection) {
      // Warn user about duplicate URLs and suggest using Remove Duplicates button instead
      if (
        !confirm(
          'You are trying to delete images that have duplicate URLs. This will remove ALL occurrences of these URLs, including unique ones.\n\nFor better control over duplicates, consider using the "Remove Duplicates" button first and then you can delete any images you select after.\n\nAre you sure you want to proceed?'
        )
      ) {
        return
      }
    } else {
      // Regular confirmation for non-duplicate deletions
      if (
        !confirm(
          `Are you sure you want to remove ${checkboxes.length} selected images?`
        )
      ) {
        return
      }
    }

    // Group by task ID for more efficient updates
    const removalsByTask = {}

    checkboxes.forEach(checkbox => {
      const url = checkbox.dataset.url
      const taskId = checkbox.dataset.taskId

      if (!removalsByTask[taskId]) {
        removalsByTask[taskId] = []
      }
      removalsByTask[taskId].push(url)
    })

    // Process each affected task
    chrome.storage.local.get('tasks', function (data) {
      const tasks = data.tasks || []
      let updatedTasks = [...tasks]
      let tasksModified = false

      Object.keys(removalsByTask).forEach(taskId => {
        const urlsToRemove = removalsByTask[taskId]
        const taskIndex = updatedTasks.findIndex(t => t.id === taskId)

        if (taskIndex !== -1) {
          const originalUrls = updatedTasks[taskIndex].urls
          const updatedUrls = originalUrls.filter(
            url => !urlsToRemove.includes(url.trim())
          )

          if (updatedUrls.length !== originalUrls.length) {
            const updatedTask = {
              ...updatedTasks[taskIndex],
              urls: updatedUrls
            }
            updatedTasks[taskIndex] = updatedTask
            tasksModified = true

            // Update the corresponding textarea in the options tab
            updateTextareaForTask(taskId, updatedUrls)
          }
        }
      })

      if (tasksModified) {
        // Save all changes at once
        chrome.storage.local.set({ tasks: updatedTasks }, function () {
          // Instead of clearing everything, just remove the deleted images
          const removedUrls = new Set()
          Object.values(removalsByTask).forEach(urls => {
            urls.forEach(url => removedUrls.add(url.trim()))
          })

          state.allImages = state.allImages.filter(
            img => !removedUrls.has(img.url.trim())
          )

          // Reapply filters to update the view
          applyFilters(true)
          showToast(`Removed ${checkboxes.length} images successfully`)
        })
      } else {
        showToast('No changes were made')
      }
    })
  }

  // New function to update the textarea in options tab
  function updateTextareaForTask (taskId, updatedUrls) {
    // Find the task element in options tab
    const taskElement = document.querySelector(
      `.task[data-task-id="${taskId}"]`
    )
    if (taskElement) {
      const textarea = taskElement.querySelector('.urls')
      if (textarea) {
        textarea.value = updatedUrls.join('\n')

        // Update the URL count display
        const urlCountDiv = taskElement.querySelector(`#url-count-${taskId}`)
        if (urlCountDiv) {
          const uniqueUrls = [
            ...new Set(updatedUrls.filter(url => url.trim() !== ''))
          ]
          const duplicateCount = updatedUrls.length - uniqueUrls.length
          urlCountDiv.textContent = `URL count: ${updatedUrls.length}`

          const duplicateWarningDiv = taskElement.querySelector(
            `#duplicate-warning-${taskId}`
          )
          if (duplicateWarningDiv) {
            if (duplicateCount > 0) {
              duplicateWarningDiv.style.display = 'block'
              duplicateWarningDiv.textContent = `Duplicate URLs detected: ${duplicateCount}`
            } else {
              duplicateWarningDiv.style.display = 'none'
            }
          }
        }
      }
    }
  }

  function removeImage (imageUrl, taskId) {
    if (!confirm('Are you sure you want to remove this image from the task?')) {
      return
    }

    // Update the task in storage
    chrome.storage.local.get('tasks', function (data) {
      const tasks = data.tasks || []
      const taskIndex = tasks.findIndex(t => t.id === taskId)

      if (taskIndex !== -1) {
        const updatedTask = { ...tasks[taskIndex] }
        updatedTask.urls = updatedTask.urls.filter(
          url => url.trim() !== imageUrl
        )

        // Update the task in the array
        const updatedTasks = [...tasks]
        updatedTasks[taskIndex] = updatedTask

        // Save back to storage
        chrome.storage.local.set({ tasks: updatedTasks }, function () {
          // Update the textarea in options tab
          updateTextareaForTask(taskId, updatedTask.urls)

          // Remove from current state and refresh view
          state.allImages = state.allImages.filter(img => img.url !== imageUrl)
          applyFilters(true)

          showToast('Image removed successfully')
        })
      }
    })
  }

  // Update pagination controls
  function updatePaginationControls () {
    const totalPages = Math.ceil(
      state.filteredImages.length / state.itemsPerPage
    )

    elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`
    elements.prevPageBtn.disabled = state.currentPage === 1
    elements.nextPageBtn.disabled =
      state.currentPage === totalPages || totalPages === 0
  }

  // Update image count display to show progress
  function updateImageCount () {
    const totalCount = state.allImages.length
    const filteredCount = state.filteredImages.length

    // Create spinner HTML if it doesn't exist
    if (!document.getElementById('filterSpinner')) {
      const spinner = document.createElement('span')
      spinner.id = 'filterSpinner'
      spinner.className = 'filter-spinner'
      spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'
      elements.imageCount.prepend(spinner)
    }

    // Update text with progress
    elements.imageCount.innerHTML = `
        <span id="filterSpinner" class="filter-spinner"><i class="fas fa-spinner fa-spin"></i></span>
        ${filteredCount} images (${totalCount} total)
        <span class="filter-progress"></span>
    `

    // Calculate completion percentage if filtering is in progress
    if (state.isFiltering) {
      const loadedCount = state.allImages.filter(img => img.loaded).length
      const percentage = Math.round((loadedCount / totalCount) * 100)
      document.querySelector(
        '.filter-progress'
      ).textContent = `- ${percentage}% loaded`
    } else {
      document.querySelector('.filter-spinner').style.display = 'none'
      document.querySelector('.filter-progress').textContent = ''
    }
  }

  // Update loading state UI
  function updateLoadingState () {
    if (state.isLoading) {
      elements.loadingIndicator.style.display = 'block'
      elements.container.innerHTML = `<div class="loading-overlay">
         <div class="spinner"></div>
         <p>Loading images... This might take a while if you have many urls.</p>
         <p>If it seems stuck, try refreshing the page.</p>
         <p>Please be patient as they load.</p>
       </div>`
    } else {
      elements.loadingIndicator.style.display = 'none'
    }
  }

  // Reset all filters
  function resetFilters () {
    state.filters = {
      taskId: 'all',
      searchTerm: '',
      sizeCategory: 'all',
      format: 'all',
      shape: 'all',
      minWidth: '',
      maxWidth: '',
      minHeight: '',
      maxHeight: '',
      customRatio: '',
      ratioOperator: '≈',
      minFileSize: '',
      maxFileSize: '',
      fileSizeUnit: 'kb'
    }

    // Reset UI elements
    elements.searchInput.value = ''
    elements.taskFilter.value = 'all'
    elements.sizeFilter.value = 'all'
    elements.formatFilter.value = 'all'
    elements.shapeFilter.value = 'all'
    elements.minWidthInput.value = ''
    elements.maxWidthInput.value = ''
    elements.minHeightInput.value = ''
    elements.maxHeightInput.value = ''
    elements.ratioInput.value = ''
    ;(elements.ratioOperator.value = '≈'),
      (elements.minFileSizeInput.value = '')
    elements.maxFileSizeInput.value = ''
    elements.fileSizeUnitSelect.value = 'kb'

    applyFilters()
  }

  // Copy to clipboard
  function copyToClipboard (text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('URL copied to clipboard')
    })
  }

  // Show toast notification
  function showToast (message) {
    const toast = document.createElement('div')
    toast.className = 'toast'
    toast.textContent = message
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.classList.add('show')
      setTimeout(() => {
        toast.classList.remove('show')
        setTimeout(() => toast.remove(), 300)
      }, 2000)
    }, 10)
  }

  // Setup event listeners
  function setupEventListeners () {
    // Pagination
    elements.prevPageBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--
        updateUI()
      }
    })

    elements.nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(
        state.filteredImages.length / state.itemsPerPage
      )
      if (state.currentPage < totalPages) {
        state.currentPage++
        updateUI()
      }
    })

    // File size filter events
    elements.minFileSizeInput.addEventListener('input', e => {
      state.filters.minFileSize = e.target.value
      applyFilters(false, true)
    })

    elements.maxFileSizeInput.addEventListener('input', e => {
      state.filters.maxFileSize = e.target.value
      applyFilters(false, true)
    })

    elements.fileSizeUnitSelect.addEventListener('change', e => {
      state.filters.fileSizeUnit = e.target.value
      applyFilters(false, true)
    })

    // For search input, preserve page during typing
    let searchTimeout

    elements.searchInput.addEventListener('input', e => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        state.filters.searchTerm = e.target.value.toLowerCase()
        applyFilters(false, true) // Preserve page during typing
      }, 300)
    })

    // For other filters that might significantly change results
    elements.taskFilter.addEventListener('change', e => {
      state.filters.taskId = e.target.value
      applyFilters(true) // Don't preserve page for major filter changes
    })

    // For dimension filters that might be adjusted incrementally:
    const incrementalFilters = [
      elements.minWidthInput,
      elements.maxWidthInput,
      elements.minHeightInput,
      elements.maxHeightInput,
      elements.ratioInput
    ]

    incrementalFilters.forEach(input => {
      input.addEventListener('input', e => {
        state.filters[e.target.id.replace('Input', '')] = e.target.value
        applyFilters(false, true) // Preserve page
      })
    })

    // Size filter
    elements.sizeFilter.addEventListener('change', e => {
      state.filters.sizeCategory = e.target.value
      applyFilters()
    })

    // Format filter
    elements.formatFilter.addEventListener('change', e => {
      state.filters.format = e.target.value
      applyFilters()
    })

    // Shape filter
    elements.shapeFilter.addEventListener('change', e => {
      state.filters.shape = e.target.value
      applyFilters()
    })

    // Dimension filters
    elements.minWidthInput.addEventListener('input', e => {
      state.filters.minWidth = e.target.value
      applyFilters()
    })

    elements.maxWidthInput.addEventListener('input', e => {
      state.filters.maxWidth = e.target.value
      applyFilters()
    })

    elements.minHeightInput.addEventListener('input', e => {
      state.filters.minHeight = e.target.value
      applyFilters()
    })

    elements.maxHeightInput.addEventListener('input', e => {
      state.filters.maxHeight = e.target.value
      applyFilters()
    })

    // Aspect ratio filter
    elements.ratioInput.addEventListener('input', e => {
      state.filters.customRatio = e.target.value
      applyFilters()
    })

    elements.ratioOperator.addEventListener('change', e => {
      state.filters.ratioOperator = e.target.value
      applyFilters()
    })

    // Items per page
    elements.perPageSelect.addEventListener('change', e => {
      state.itemsPerPage = parseInt(e.target.value)
      state.currentPage = 1
      renderImages()
    })

    // Columns
    elements.columnsInput.addEventListener('input', e => {
      const value = parseInt(e.target.value)
      state.columns = value
      document.getElementById('columnsValue').textContent = value
      renderImages()

      // Save to chrome.storage for persistence
      chrome.storage.local.set({ gridColumns: value })
    })

    // Refresh button
    elements.refreshBtn.addEventListener('click', loadTasks)

    // Toggle advanced filters
    elements.advancedFiltersBtn.addEventListener('click', () => {
      elements.advancedFiltersPanel.classList.toggle('visible')
    })

    // Toggle grid settings
    elements.gridSettingsBtn.addEventListener('click', () => {
      elements.gridSettingsPanel.classList.toggle('visible')
    })

    // Close panels when clicking outside
    document.addEventListener('click', e => {
      if (
        !elements.advancedFiltersPanel.contains(e.target) &&
        e.target !== elements.advancedFiltersBtn
      ) {
        elements.advancedFiltersPanel.classList.remove('visible')
      }

      if (
        !elements.gridSettingsPanel.contains(e.target) &&
        e.target !== elements.gridSettingsBtn
      ) {
        elements.gridSettingsPanel.classList.remove('visible')
      }
    })
  }

  function validateCurrentPage () {
    const totalPages = Math.max(
      1,
      Math.ceil(state.filteredImages.length / state.itemsPerPage)
    )
    if (state.currentPage > totalPages) {
      state.currentPage = totalPages
    }
    if (state.currentPage < 1) {
      state.currentPage = 1
    }
  }

  // Update all UI elements
  function updateUI () {
    const previewToggle = document.getElementById('previewToggle')
    if (!previewToggle || !previewToggle.checked) {
      // Preview toggle not found or unchecked, skip UI update
      return
    }
    validateCurrentPage()
    renderImages()
    updateImageCount()
    updatePaginationControls()
  }

  // Initialize
  init()

  // Auto-refresh when tab is shown
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      const activeTab = document.querySelector('.tab-content.active')
      if (activeTab && activeTab.id === 'previewImagesTab') {
        // Only do a soft refresh that preserves the current view
        applyFilters(false, true)
      }
    }
  })
})
