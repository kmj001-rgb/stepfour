document.addEventListener('DOMContentLoaded', function () {
  const check404Button = document.getElementById('check404')
  const urlsTextArea = document.getElementById('urls404')
  const progressContainer = document.getElementById('progress-container-404')
  const progressFill = document.getElementById('progress-fill-404')
  const progressStatus = document.getElementById('progress-status-404')
  const outputDiv = document.getElementById('output-404')

  const BATCH_SIZE = 20 // Number of URLs to process simultaneously
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

  function createResultsSection (reachableUrls, unreachableUrls) {
    if (!outputDiv) return
    outputDiv.innerHTML = '' // Clear previous results

    const container = document.createElement('div')
    container.style.display = 'flex'
    container.style.gap = '10px'
    container.style.marginTop = '10px'

    function createTextAreaWithCopyButton (id, placeholder, content) {
      const wrapper = document.createElement('div')
      wrapper.style.width = '48%'

      const copyButton = document.createElement('button')
      copyButton.textContent = `Copy ${placeholder}`
      copyButton.style.marginBottom = '5px'
      copyButton.addEventListener('click', () => {
        navigator.clipboard
          .writeText(content.join('\n'))
          .then(() => alert(`${placeholder} copied to clipboard!`))
          .catch(err => console.error('Failed to copy: ', err))
      })

      const textArea = document.createElement('textarea')
      textArea.id = id
      textArea.readOnly = true
      textArea.style.width = '100%'
      textArea.style.height = '200px'
      textArea.value = content.join('\n')

      wrapper.appendChild(copyButton)
      wrapper.appendChild(textArea)
      return wrapper
    }

    const reachableContainer = createTextAreaWithCopyButton(
      'reachableUrls404',
      'Reachable URLs',
      reachableUrls
    )
    const unreachableContainer = createTextAreaWithCopyButton(
      'unreachableUrls404',
      'Unreachable URLs',
      unreachableUrls
    )

    container.appendChild(reachableContainer)
    container.appendChild(unreachableContainer)
    outputDiv.appendChild(container)
  }

  async function checkUrl (url) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!response.ok) return false

      const contentType = response.headers.get('Content-Type') || ''
      return validImageFormats.some(format => contentType.includes(format))
    } catch (error) {
      return false
    }
  }

  async function processUrls () {
    const urls = urlsTextArea.value
      .trim()
      .split('\n')
      .map(url => url.trim())
      .filter(url => url)
    if (urls.length === 0) {
      alert("Please add URLs before clicking 'Check 404'.")
      return
    }

    progressContainer.style.display = 'block'
    progressFill.style.width = '0%'
    progressStatus.textContent = `Processed 0 of ${urls.length} URLs`

    const reachableUrls = []
    const unreachableUrls = []

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const urlBatch = urls.slice(i, i + BATCH_SIZE)

      const results = await Promise.all(urlBatch.map(checkUrl))

      results.forEach((isValid, index) => {
        const url = urlBatch[index]
        if (isValid) {
          reachableUrls.push(url)
        } else {
          unreachableUrls.push(url)
        }
      })

      // Update progress after each batch
      const processedCount = Math.min(i + BATCH_SIZE, urls.length)
      const progressPercentage = (processedCount / urls.length) * 100
      progressFill.style.width = `${progressPercentage}%`
      progressStatus.textContent = `Processed ${processedCount} of ${urls.length} URLs`
    }

    createResultsSection(reachableUrls, unreachableUrls)
    progressStatus.textContent = 'Completed!'
    alert('URL check complete.')
  }

  check404Button.addEventListener('click', processUrls)
})
