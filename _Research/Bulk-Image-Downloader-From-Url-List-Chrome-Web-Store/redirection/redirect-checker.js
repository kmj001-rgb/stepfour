document.addEventListener('DOMContentLoaded', function () {
  const checkRedirectsButton = document.getElementById('checkRedirects')
  const urlsTextArea = document.getElementById('urls')
  const progressContainer = document.getElementById('progress-container')
  const progressFill = document.getElementById('progress-fill')
  const progressStatus = document.getElementById('progress-status')
  const redirectCheckerTab = document.getElementById('redirectCheckerTab')

  const BATCH_SIZE = 50 // Number of URLs to process simultaneously

  async function fetchFinalUrl (url) {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      return response.url
    } catch (error) {
      return `Error: ${error.message}`
    }
  }

  async function processUrls () {
    const urls = urlsTextArea.value
      .trim()
      .split('\n')
      .map(url => url.trim())
      .filter(url => url)
    if (urls.length === 0) {
      alert("Please add URLs before clicking 'Check Redirects'.")
      return
    }

    progressContainer.style.display = 'block'
    progressFill.style.width = '0%'
    progressStatus.textContent = `Processed 0 of ${urls.length} URLs`

    const originalUrls = []
    const redirectedUrls = []

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const urlBatch = urls.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(urlBatch.map(fetchFinalUrl))

      results.forEach((result, index) => {
        originalUrls.push(urlBatch[index])
        redirectedUrls.push(result)
      })

      const processedCount = Math.min(i + BATCH_SIZE, urls.length)
      const progressPercentage = (processedCount / urls.length) * 100
      progressFill.style.width = `${progressPercentage}%`
      progressStatus.textContent = `Processed ${processedCount} of ${urls.length} URLs`
    }

    createResultsSection(originalUrls, redirectedUrls)
    progressStatus.textContent = `Completed: Processed ${urls.length} URLs`
    alert('All URLs have been processed!')
  }

  function createResultsSection (originalUrls, redirectedUrls) {
    const existingResultsSection = document.getElementById('resultsSection')
    if (existingResultsSection) existingResultsSection.remove()

    const resultsSection = document.createElement('div')
    resultsSection.id = 'resultsSection'
    resultsSection.style.marginTop = '20px'
    resultsSection.style.display = 'flex'
    resultsSection.style.gap = '10px'

    function createTextAreaWithCopyButton (id, placeholder, content) {
      const container = document.createElement('div')
      container.style.width = '48%'

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

      container.appendChild(copyButton)
      container.appendChild(textArea)
      return container
    }

    const originalUrlsContainer = createTextAreaWithCopyButton(
      'originalUrls',
      'Original URLs',
      originalUrls
    )
    const redirectedUrlsContainer = createTextAreaWithCopyButton(
      'redirectedUrls',
      'Final Destination URLs',
      redirectedUrls
    )

    resultsSection.appendChild(originalUrlsContainer)
    resultsSection.appendChild(redirectedUrlsContainer)

    redirectCheckerTab.appendChild(resultsSection) // Append within the tab
  }

  checkRedirectsButton.addEventListener('click', processUrls)
})
