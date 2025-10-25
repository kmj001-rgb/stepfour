document.addEventListener('DOMContentLoaded', function () {
  // Function to show the selected tab
  function showTab (tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active')
      content.style.display = 'none'
    })

    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active')
    })

    // Show the selected tab content and set the tab as active
    const tabContent = document.getElementById(tabId)
    tabContent.classList.add('active')
    tabContent.style.display = 'block'
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active')

    // Load content when specific tabs are opened
    if (tabId === 'helpTab' && tabContent.innerHTML.trim() === '') {
      loadHelpContent(tabContent)
    } else if (tabId === 'previewImagesTab') {
      // Auto-refresh when preview tab is opened
      const refreshBtn = document.getElementById('refreshPreview')
      if (refreshBtn) refreshBtn.click()
    }
  }

  // Function to load help documentation
  function loadHelpContent (container) {
    fetch('documentation/help-content.html')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok')
        return response.text()
      })
      .then(html => {
        container.innerHTML = html
        initHelpFeatures(container)
      })
      .catch(err => {
        console.error('Failed to load help content:', err)
        container.innerHTML = `
            <div class="error-message">
              <p>Failed to load documentation. Please try again later.</p>
              <button onclick="window.location.reload()">Retry</button>
            </div>
          `
      })
  }

  // Function to initialize help tab features
  function initHelpFeatures (container) {
    // Handle anchor links
    container.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault()
        const targetId = this.getAttribute('href')
        const targetElement = container.querySelector(targetId)
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' })
        }
      })
    })
  }

  // Attach click events to each tab
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function () {
      const tabId = this.getAttribute('data-tab')
      showTab(tabId)
    })
  })

  // Show the default tab on load
  showTab('optionsTab')
})
