// Enhanced function to check for pending task URLs
document.addEventListener('DOMContentLoaded', function () {
  // Add this near the top with other utility functions
  async function applyWatermark (imageBlob, watermarkSettings) {
    if (!watermarkSettings || !watermarkSettings.watermarkImage) {
      return imageBlob
    }

    return new Promise(resolve => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      const watermark = new Image()

      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        watermark.src = watermarkSettings.watermarkImage
        watermark.onload = () => {
          const opacity = watermarkSettings.opacity / 100
          const maxSize = watermarkSettings.maxWatermarkSize / 100

          let wmWidth = watermark.width
          let wmHeight = watermark.height

          const maxW = img.width * maxSize
          const maxH = img.height * maxSize
          if (wmWidth > maxW || wmHeight > maxH) {
            const ratio = Math.min(maxW / wmWidth, maxH / wmHeight)
            wmWidth *= ratio
            wmHeight *= ratio
          }

          let x, y
          const margin = parseInt(watermarkSettings.margin) || 0

          switch (watermarkSettings.gravity) {
            case 'northwest':
              x = margin
              y = margin
              break
            case 'north':
              x = (img.width - wmWidth) / 2
              y = margin
              break
            case 'northeast':
              x = img.width - wmWidth - margin
              y = margin
              break
            case 'west':
              x = margin
              y = (img.height - wmHeight) / 2
              break
            case 'center':
              x = (img.width - wmWidth) / 2
              y = (img.height - wmHeight) / 2
              break
            case 'east':
              x = img.width - wmWidth - margin
              y = (img.height - wmHeight) / 2
              break
            case 'southwest':
              x = margin
              y = img.height - wmHeight - margin
              break
            case 'south':
              x = (img.width - wmWidth) / 2
              y = img.height - wmHeight - margin
              break
            case 'southeast':
              x = img.width - wmWidth - margin
              y = img.height - wmHeight - margin
              break
            default:
              x = (img.width - wmWidth) / 2
              y = (img.height - wmHeight) / 2
          }

          ctx.globalAlpha = opacity
          ctx.drawImage(watermark, x, y, wmWidth, wmHeight)

          canvas.toBlob(
            blob => {
              resolve(blob)
            },
            'image/jpeg',
            0.9
          )
        }
      }

      img.src = URL.createObjectURL(imageBlob)
    })
  }

  // Add this near the top of your file
  function debounce (func, wait, immediate) {
    let timeout
    return function () {
      const context = this,
        args = arguments
      const later = function () {
        timeout = null
        if (!immediate) func.apply(context, args)
      }
      const callNow = immediate && !timeout
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
      if (callNow) func.apply(context, args)
    }
  }

  // Add this function to check task status (draft, pending, etc.)
  function getTaskStatus (taskId) {
    return new Promise(resolve => {
      chrome.storage.local.get('tasks', function (data) {
        const tasks = data.tasks || []
        const task = tasks.find(t => t.id === taskId)
        resolve(task ? task.status : 'new') // 'new' for unsaved tasks
      })
    })
  }

  // Add this near other utility functions
  async function countTasks () {
    return new Promise(resolve => {
      chrome.storage.local.get('tasks', function (data) {
        const tasks = data.tasks || []
        resolve(tasks.length)
      })
    })
  }

  // Function to auto-save a task as draft
  function autoSaveTask (taskId) {
    const taskElement = document.querySelector(
      `.task[data-task-id="${taskId}"]`
    )
    if (!taskElement) return

    // Get all task data
    const urlsTextarea = taskElement.querySelector('.urls')
    const urls = urlsTextarea.value.split('\n').filter(url => url.trim() !== '')

    // Only proceed if there are URLs or if it's an existing draft
    if (urls.length > 0 || taskElement.classList.contains('draft')) {
      // Get all task data
      const sortableListHTML = taskElement.querySelector(
        `#sortable-${taskId}`
      ).innerHTML
      const sequenceStartInputElement = taskElement.querySelector(
        `#sequence-start-${taskId}`
      )
      const sequenceStartValue = sequenceStartInputElement
        ? sequenceStartInputElement.value || '1'
        : '1'

      const downloadTimeValue =
        taskElement.querySelector('.download-time').value

      const downloadIfChecked = taskElement.querySelector(
        `#download-if-checkbox-${taskId}`
      )?.checked

      const keywordsList = taskElement.querySelectorAll('.download-if-keyword')
      let downloadIfKeywords = Array.from(keywordsList).map(keyword => {
        const text = keyword.textContent.replace('X', '').trim()
        const [condition, value] = text.split(': ')
        return { condition, value }
      })

      const hasContains = downloadIfKeywords.some(
        kw => kw.condition === 'contains'
      )
      const hasNotContains = downloadIfKeywords.some(
        kw => kw.condition === 'not-contains'
      )

      let downloadIfLogic = null
      if (hasContains && hasNotContains) {
        downloadIfLogic =
          taskElement.querySelector(
            `input[name="downloadIfLogic-${taskId}"]:checked`
          )?.value || 'and'
      }

      // Get conversion settings
      const convertCheckbox = taskElement.querySelector(
        `#convert-checkbox-${taskId}`
      )
      const convertFormat = taskElement.querySelector(
        `#convert-format-${taskId}`
      )
      const qualitySlider = taskElement.querySelector(
        `#quality-slider-${taskId}`
      )

      const task = {
        id: taskId,
        urls: urls,
        fileTypes: [],
        folderName: taskElement.querySelector('.folderName').value.trim(),
        downloadTime: downloadTimeValue,
        zipDownload: taskElement.querySelector(`#zip-checkbox-${taskId}`)
          .checked,
        status: 'draft',
        isDraft: true,
        buildCheckbox: taskElement.querySelector(`#build-checkbox-${taskId}`)
          .checked,
        sortableList: sortableListHTML,
        sequenceStart: sequenceStartValue,
        convert: {
          enabled: convertCheckbox ? convertCheckbox.checked : false,
          format: convertFormat ? convertFormat.value : 'jpeg',
          quality: qualitySlider ? parseInt(qualitySlider.value) : 100
        },
        downloadIf: {
          enabled: downloadIfChecked || false,
          keywords: downloadIfKeywords,
          logic: downloadIfLogic
        }
      }

      const allFormatsCheckbox = taskElement.querySelector(
        `#all-formats-checkbox-${taskId}`
      )
      if (allFormatsCheckbox.checked) {
        task.fileTypes.push('all')
      } else {
        taskElement
          .querySelectorAll(`.file-type-${taskId}:checked`)
          .forEach(checkbox => {
            task.fileTypes.push(checkbox.value)
          })
      }

      // Save the task
      chrome.storage.local.get('tasks', function (data) {
        const tasks = data.tasks || []
        const existingIndex = tasks.findIndex(t => t.id === taskId)

        if (existingIndex !== -1) {
          tasks[existingIndex] = task // Update existing task
        } else {
          tasks.push(task) // Add new task
        }

        chrome.storage.local.set({ tasks }, function () {
          console.log('Task auto-saved as draft:', taskId)
          showSaveIndicator(taskElement)
        })
      })
    }
  }

  // Helper function to show save indicator
  function showSaveIndicator (taskElement) {
    const urlCountDiv = taskElement.querySelector('.url-count')
    if (!urlCountDiv) return

    // Remove any existing indicator first
    const existingIndicator = urlCountDiv.querySelector('.save-indicator')
    if (existingIndicator) existingIndicator.remove()

    const savedIndicator = document.createElement('span')
    savedIndicator.textContent = ' ✓ Saved as Draft'
    savedIndicator.className = 'save-indicator'
    savedIndicator.style.color = '#4CAF50'
    savedIndicator.style.marginLeft = '5px'
    savedIndicator.style.fontSize = '0.8em'

    urlCountDiv.appendChild(savedIndicator)

    setTimeout(() => {
      savedIndicator.remove()
    }, 2000)
  }

  // Modify the checkForPendingTaskUrls function in options.js
  async function checkForPendingTaskUrls () {
    try {
      const result = await chrome.storage.local.get([
        'pendingTaskUrls',
        'shouldCreateNewTask',
        'taskToUpdate'
      ])

      if (!result.pendingTaskUrls) return

      let taskElement
      const pendingUrls = result.pendingTaskUrls
        .split('\n')
        .filter(url => url.trim() !== '')

      if (result.shouldCreateNewTask) {
        // Check if we already have a task with these URLs (prevent duplicates)
        const tasks = await new Promise(resolve => {
          chrome.storage.local.get('tasks', data => resolve(data.tasks || []))
        })

        const existingTask = tasks.find(task => {
          const taskUrls = task.urls || []
          return (
            JSON.stringify(taskUrls.sort()) ===
            JSON.stringify(pendingUrls.sort())
          )
        })

        if (existingTask) {
          // Use existing task instead of creating new one
          taskElement = document.querySelector(
            `.task[data-task-id="${existingTask.id}"]`
          )
          if (!taskElement) {
            addTaskToDOM(existingTask)
            taskElement = document.querySelector(
              `.task[data-task-id="${existingTask.id}"]`
            )
          }
        } else {
          // Create new task only if no duplicate exists
          createTask()

          // Wait for DOM update
          await new Promise(resolve => setTimeout(resolve, 300))

          // Get the newly created task
          const taskElements = document.querySelectorAll('.task')
          taskElement = taskElements[taskElements.length - 1]

          // Mark as draft in storage
          chrome.storage.local.get('tasks', function (data) {
            const tasks = data.tasks || []
            const newTask = tasks.find(t => t.id === taskElement.dataset.taskId)
            if (newTask) {
              newTask.status = 'draft'
              newTask.isDraft = true
              newTask.downloadTime = ''
              chrome.storage.local.set({ tasks })
            }
          })
        }
      } else if (result.taskToUpdate) {
        // Try to find existing task with retry logic
        let attempts = 0
        const maxAttempts = 5
        const retryDelay = 200

        while (attempts < maxAttempts && !taskElement) {
          taskElement = document.querySelector(
            `.task[data-task-id="${result.taskToUpdate}"]`
          )
          if (!taskElement) {
            attempts++
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }

        if (!taskElement) {
          console.log('Task to update not found, creating new task')
          createTask()
          await new Promise(resolve => setTimeout(resolve, 300))
          const taskElements = document.querySelectorAll('.task')
          taskElement = taskElements[taskElements.length - 1]
        } else {
          // Update the task in storage
          chrome.storage.local.get('tasks', function (data) {
            const tasks = data.tasks || []
            const taskIndex = tasks.findIndex(t => t.id === result.taskToUpdate)
            if (taskIndex !== -1) {
              tasks[taskIndex].urls = pendingUrls
              tasks[taskIndex].status = 'draft'
              tasks[taskIndex].isDraft = true
              chrome.storage.local.set({ tasks })
            }
          })
        }
      }

      if (taskElement) {
        const taskId = taskElement.getAttribute('data-task-id')
        const urlsTextarea = taskElement.querySelector('.urls')

        if (urlsTextarea) {
          urlsTextarea.value = result.pendingTaskUrls

          // Trigger input event to update counters
          const event = new Event('input', { bubbles: true })
          urlsTextarea.dispatchEvent(event)

          // Scroll to the task with smooth behavior
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

          // Add highlight animation
          taskElement.style.transition = 'all 0.5s ease'
          taskElement.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.5)'

          // Add pulsing animation
          const pulseAnimation = [
            { boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.5)' },
            { boxShadow: '0 0 0 6px rgba(66, 153, 225, 0.3)' },
            { boxShadow: '0 0 0 3px rgba(66, 225, 153, 0.5)' }
          ]

          const pulseTiming = {
            duration: 1000,
            iterations: 3
          }

          taskElement.animate(pulseAnimation, pulseTiming)

          // Add border highlight that fades out
          taskElement.style.border = '2px solid #4299e1'

          // Remove the border after animation completes
          setTimeout(() => {
            taskElement.style.boxShadow = ''
            taskElement.style.border = ''
          }, 3000)

          // Add a subtle background color change
          taskElement.style.backgroundColor = 'rgba(66, 153, 225, 0.1)'
          setTimeout(() => {
            taskElement.style.backgroundColor = ''
          }, 1500)

          // Add a checkmark icon briefly
          const checkmark = document.createElement('div')
          checkmark.innerHTML = '✓'
          checkmark.style.position = 'absolute'
          checkmark.style.right = '10px'
          checkmark.style.top = '10px'
          checkmark.style.color = '#48bb78'
          checkmark.style.fontSize = '24px'
          checkmark.style.fontWeight = 'bold'
          checkmark.style.opacity = '0'
          checkmark.style.transition = 'opacity 0.5s ease'
          taskElement.style.position = 'relative'
          taskElement.appendChild(checkmark)

          // Fade in and out the checkmark
          setTimeout(() => {
            checkmark.style.opacity = '1'
            setTimeout(() => {
              checkmark.style.opacity = '0'
              setTimeout(() => {
                checkmark.remove()
              }, 500)
            }, 1000)
          }, 300)
        }
      }

      // Clean up
      await chrome.storage.local.remove([
        'pendingTaskUrls',
        'shouldCreateNewTask',
        'taskToUpdate'
      ])
    } catch (error) {
      console.error('Error processing pending task:', error)
    }
  }

  // Listen for changes in authentication state
  chrome.storage.onChanged.addListener(async changes => {
    if ('isLoggedIn' in changes || 'license' in changes) {
      const { isLoggedIn, license } = await new Promise(resolve => {
        chrome.storage.local.get(['isLoggedIn', 'license'], resolve)
      })

      if (!isLoggedIn || !license || license.license_status !== 'sold') {
        await deleteNonDefaultTasks(license?.license_status || 'none')
        updateUI(false)
      }
    }
  })

  // Check for pending task URLs when the page loads
  checkForPendingTaskUrls()

  // Also listen for storage changes in case the URLs arrive after page load
  chrome.storage.onChanged.addListener(function (changes) {
    if (changes.pendingTaskUrls || changes.shouldCreateNewTask) {
      checkForPendingTaskUrls()
    }
  })

  // Add this near the top of your options.js
  let handlingSidepanelTask = false

  async function handleSidepanelTask () {
    if (handlingSidepanelTask) return
    handlingSidepanelTask = true

    try {
      const result = await chrome.storage.local.get('pendingSidepanelTask')
      if (!result.pendingSidepanelTask) return

      // License check
      const licenseCheck = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'validateSession' }, resolve)
      })

      const licenseStatus = licenseCheck?.license?.license_status

      if (licenseStatus !== 'sold') {
        // FREE USER: Overwrite default task instead of creating new
        const tasksData = await new Promise(resolve => {
          chrome.storage.local.get('tasks', data => resolve(data.tasks || []))
        })

        if (tasksData.length === 0) {
          // If no default task exists, create it (should rarely happen)
          const defaultTask = {
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
          tasksData.push(defaultTask)
          await chrome.storage.local.set({ tasks: tasksData })
        }

        // Overwrite default task URLs with new pendingSidepanelTask URLs
        tasksData[0].urls = result.pendingSidepanelTask.urls || ['']

        // Set status to draft or pending as per logic
        tasksData[0].status = 'draft'
        tasksData[0].isDraft = true

        await chrome.storage.local.set({ tasks: tasksData })

        // Update DOM: find default task and update textarea value
        const defaultTaskId = tasksData[0].id
        let taskElement = document.querySelector(
          `.task[data-task-id="${defaultTaskId}"]`
        )
        if (!taskElement) {
          // If not in DOM, add it
          addTaskToDOM(tasksData[0])
          taskElement = document.querySelector(
            `.task[data-task-id="${defaultTaskId}"]`
          )
        }

        if (taskElement) {
          const textarea = taskElement.querySelector('.urls')
          if (textarea) {
            textarea.value = result.pendingSidepanelTask.urls.join('\n')
            textarea.dispatchEvent(new Event('input', { bubbles: true }))
            taskElement.scrollIntoView({ behavior: 'smooth' })
          }
        }

        // Clean up storage
        await chrome.storage.local.remove('pendingSidepanelTask')

        handlingSidepanelTask = false
        return
      }

      // PREMIUM USER logic - existing behavior (create task etc.)
      createTask()
      await new Promise(resolve => setTimeout(resolve, 300))
      const tasks = document.querySelectorAll('.task')
      const newTask = tasks[tasks.length - 1]

      if (newTask) {
        const textarea = newTask.querySelector('.urls')
        if (textarea) {
          textarea.value = result.pendingSidepanelTask.urls.join('\n')
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
          newTask.scrollIntoView({ behavior: 'smooth' })
        }
      }

      await chrome.storage.local.remove('pendingSidepanelTask')
    } catch (error) {
      console.error('Sidepanel task error:', error)
    } finally {
      handlingSidepanelTask = false
    }
  }

  // Add these listeners:
  handleSidepanelTask()
  chrome.storage.onChanged.addListener(changes => {
    if (changes.pendingSidepanelTask) {
      handleSidepanelTask()
    }
  })

  const loginBtn = document.getElementById('loginBtn')
  const logoutBtn = document.getElementById('logoutBtn')
  const statusText = document.getElementById('status')
  const licenseInfo = document.getElementById('licenseInfo')
  const licenseKey = document.getElementById('licenseKey')
  const licenseStatus = document.getElementById('licenseStatus')
  const licenseExpiration = document.getElementById('licenseExpiration')
  const licenseMessage = document.getElementById('licenseMessage') // Add this element in your HTML

  const BASE_URL = 'https://bulkimagedownloaderurllist.com'
  const EXTENSION_ID = chrome.runtime.id // Get the extension ID
  const MAX_URLS = 5

  // ✅ Function to convert GMT datetime to the user's local timezone
  function convertToLocalTime (gmtDateTime) {
    try {
      // Parse the GMT datetime string into a Date object
      const gmtDate = new Date(gmtDateTime + ' GMT')

      // Get the user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      // Format the datetime in the user's timezone
      const localDateTime = gmtDate.toLocaleString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })

      return localDateTime
    } catch (error) {
      console.error('❌ Error converting datetime to local timezone:', error)
      return gmtDateTime // Fallback to the original GMT datetime
    }
  }

  // ✅ Function to update UI based on login state
  function updateUI (isLoggedIn, userEmail = null, license = null) {
    const statusText = document.getElementById('statusText')
    const loginBtn = document.getElementById('loginBtn')
    const logoutBtn = document.getElementById('logoutBtn')
    const licenseInfo = document.getElementById('licenseInfo')
    const licenseKey = document.getElementById('licenseKey')
    const licenseExpiration = document.getElementById('licenseExpiration')
    const licenseMessage = document.getElementById('licenseMessage')
    const signinPrompt = document.querySelector('.signin-prompt')

    if (
      !statusText ||
      !loginBtn ||
      !logoutBtn ||
      !licenseInfo ||
      !licenseKey ||
      !licenseExpiration ||
      !licenseMessage ||
      !signinPrompt
    ) {
      console.error('One or more elements are missing in the DOM.')
      return
    }

    // Delete all tasks except default if license is not "sold"
    if (license && license.license_status !== 'sold') {
      deleteNonDefaultTasks()
    }

    if (isLoggedIn && userEmail) {
      statusText.innerText = `Logged in as: ${userEmail}`
      loginBtn.style.display = 'none'
      logoutBtn.style.display = 'block'
      signinPrompt.style.display = 'none' // Hide the sign-in prompt when logged in

      if (license) {
        licenseInfo.style.display = 'block'
        licenseMessage.style.display = 'none'
        licenseKey.innerText = license.license_key

        const localExpiration = convertToLocalTime(license.expiration_date)

        // Get the row elements
        const statusRow = document.getElementById('statusRow')
        const expiresRow = document.getElementById('expiresRow')
        const statusLabel = statusRow.querySelector('.license-label')
        const statusValue = statusRow.querySelector('.license-value')
        const expiresLabel = expiresRow.querySelector('.license-label')
        const expiresValue = expiresRow.querySelector('.license-value')

        // Reset all displays first
        statusRow.style.display = 'flex'
        expiresRow.style.display = 'flex'
        statusLabel.textContent = 'Status:'
        expiresLabel.textContent = 'Expires:'
        statusLabel.classList.remove('license-status-expired')
        expiresLabel.classList.remove('license-status-expired')

        if (license.license_status === 'expired') {
          statusRow.style.display = 'none'
          expiresLabel.textContent = 'Expired:'
          expiresLabel.classList.add('license-status-expired')
          expiresValue.textContent = localExpiration
        } else if (license.license_status === 'sold') {
          statusValue.textContent = 'Active'
          statusValue.className = 'license-value license-status-active'
          expiresValue.textContent = localExpiration
        } else {
          statusValue.textContent = license.license_status
          statusValue.className = 'license-value license-status-other'
          expiresValue.textContent = localExpiration
        }

        // Remove any existing license button first
        const existingButton = document.getElementById('getLicenseButton')
        if (existingButton) existingButton.remove()

        if (license.license_status !== 'sold') {
          const buttonContainer = document.querySelector('.button-container')
          const getLicenseButton = document.createElement('button')
          getLicenseButton.id = 'getLicenseButton'
          getLicenseButton.className = 'btn premium-btn'

          const buttonText =
            license.license_status === 'expired'
              ? 'Get License'
              : license.license_status === 'pending'
              ? 'Complete Purchase'
              : 'Get License'

          getLicenseButton.innerHTML = `<span class="button-icon">⭐</span> ${buttonText}`
          getLicenseButton.addEventListener('click', () => {
            window.location.href = `${BASE_URL}/shop/`
          })

          buttonContainer.appendChild(getLicenseButton)
        }
      } else {
        // No license case (user is logged in but has no license)
        licenseInfo.style.display = 'none'
        licenseMessage.style.display = 'block'
        licenseMessage.innerHTML = `
                  <p class="license-message-text">You're logged in but don't have a license yet.</p>
                  <button id="getLicenseButton" class="btn premium-btn">
                      <span class="button-icon">⭐</span>
                      Get Your License Now
                  </button>
              `

        document
          .getElementById('getLicenseButton')
          .addEventListener('click', () => {
            window.location.href = `${BASE_URL}/shop/`
          })
      }
    } else {
      // User is not logged in
      statusText.innerText = 'Sign In to Get Started'
      loginBtn.style.display = 'block'
      logoutBtn.style.display = 'none'
      licenseInfo.style.display = 'none'
      signinPrompt.style.display = 'block' // Show the sign-in prompt when logged out
    }
  }

  async function deleteNonDefaultTasks (licenseStatus) {
    const { tasks = [] } = await new Promise(resolve => {
      chrome.storage.local.get('tasks', resolve)
    })

    if (licenseStatus !== 'sold') {
      chrome.storage.local.get('tasks', data => {
        const tasks = data.tasks || []

        // Find existing default task, or create if missing
        let defaultTask = tasks[0]

        if (!defaultTask) {
          defaultTask = {
            id: Date.now().toString(),
            urls: [''], // keep existing URLs or empty default
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
        }

        // Keep default task intact and remove any other tasks
        const updatedTasks = [defaultTask]

        chrome.storage.local.set({ tasks: updatedTasks }, () => {
          // Update DOM to reflect only default task without clearing URLs
          const tasksContainer = document.getElementById('tasks-container')
          tasksContainer.innerHTML = ''
          addTaskToDOM(defaultTask)
        })
      })
    }
  }

  // ✅ Listen for messages from background.js
  chrome.runtime.onMessage.addListener(message => {
    if (message.action === 'updateUI') {
      //console.log("🔄 Received updateUI message:", message);

      // ✅ Check local storage in case message is missed
      chrome.storage.local.get(
        ['isLoggedIn', 'userEmail', 'license'],
        async data => {
          //console.log("📂 Local storage check on page load:", data);

          // Always enforce task limits based on current license status
          const licenseStatus = data.license?.license_status || 'none'
          if (licenseStatus !== 'sold') {
            await deleteNonDefaultTasks(licenseStatus)
          }

          updateUI(data.isLoggedIn, data.userEmail, data.license)
        }
      )
    }
  })

  // ✅ Function to check session from background.js
  async function checkSession () {
    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'validateSession' }, resolve)
      })

      if (response?.status === 'success') {
        // Valid session - enforce task limits based on license
        const licenseStatus = response.license?.license_status || 'none'
        if (licenseStatus !== 'sold') {
          await deleteNonDefaultTasks(licenseStatus)
        }
        updateUI(true, response.userEmail, response.license)
      } else {
        // Invalid session - treat as unlicensed
        await handleUnlicensedState()
      }
    } catch (error) {
      console.error('Session check failed:', error)
      await handleUnlicensedState()
    }
  }

  async function handleUnlicensedState () {
    // Clear user data and enforce single task
    await chrome.storage.local.set({
      isLoggedIn: false,
      userEmail: null,
      license: null
    })
    await deleteNonDefaultTasks('none')
    updateUI(false)
  }

  // ✅ Check local storage in case message is missed
  chrome.storage.local.get(['isLoggedIn', 'userEmail', 'license'], data => {
    //console.log("📂 Local storage check on page load:", data);

    // Delete non-default tasks if license is not "sold"
    if (data.license && data.license.license_status !== 'sold') {
      deleteNonDefaultTasks()
    }

    updateUI(data.isLoggedIn, data.userEmail, data.license)
  })

  // Handle login button click
  loginBtn.addEventListener('click', () => {
    const redirectUrl = chrome.runtime.getURL('options.html')
    const loginUrl = `${BASE_URL}/?action=google_login&redirect_to=${encodeURIComponent(
      redirectUrl
    )}&source=extension&extension_id=${EXTENSION_ID}`
    window.location.href = loginUrl
  })

  // Handle logout button click (modified version)
  logoutBtn.addEventListener('click', async () => {
    try {
      // Step 1: Delete tokens from server
      const deleteResponse = await fetch(
        `${BASE_URL}/wp-json/api/delete-tokens`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Extension-ID': EXTENSION_ID
          }
        }
      )

      if (!deleteResponse.ok) throw new Error('Failed to delete tokens.')

      // Step 2: Get logout nonce
      const nonceResponse = await fetch(
        `${BASE_URL}/wp-json/api/get-logout-nonce`,
        {
          credentials: 'include',
          headers: {
            'X-Extension-ID': EXTENSION_ID
          }
        }
      )
      const nonceData = await nonceResponse.json()
      if (!nonceData.success) throw new Error('Failed to fetch logout nonce.')

      // Step 3: Perform logout with nonce
      const response = await fetch(
        `${BASE_URL}/?action=google_logout&google_logout_nonce=${nonceData.nonce}`,
        {
          credentials: 'include',
          headers: {
            'X-Extension-ID': EXTENSION_ID
          }
        }
      )

      // Step 4: Clear local data and tasks
      await new Promise(resolve => {
        chrome.storage.local.set(
          {
            isLoggedIn: false,
            userEmail: null,
            license: null,
            tasks: [] // Clear all tasks
          },
          async () => {
            // Enforce single default task after logout
            await deleteNonDefaultTasks('none')
            resolve()
          }
        )
      })

      // Step 5: Clear UI tasks
      const tasksContainer = document.getElementById('tasks-container')
      while (tasksContainer.firstChild) {
        tasksContainer.removeChild(tasksContainer.firstChild)
      }

      // Step 6: Redirect or reload
      if (response.redirected) {
        window.location.href = response.url
      } else {
        location.reload()
      }
    } catch (error) {
      console.error('Logout failed:', error)
      // Fallback cleanup if anything fails
      chrome.storage.local.set(
        {
          isLoggedIn: false,
          userEmail: null,
          license: null,
          tasks: []
        },
        async () => {
          await deleteNonDefaultTasks('none')
          location.reload()
        }
      )
    }
  })

  // Run this when the page loads
  document.addEventListener('DOMContentLoaded', async () => {
    // First check if we have a valid license in local storage
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['isLoggedIn', 'userEmail', 'license'], resolve)
    })

    // If no valid license, enforce task limits immediately
    if (!data.license || data.license.license_status !== 'sold') {
      await deleteNonDefaultTasks(data.license?.license_status || 'none')
    }

    // Then check session to verify license status
    await checkSession()
  })

  // Add event listener to enable "Create Tasks" button after file selection
  document.getElementById('fileInput').addEventListener('change', function () {
    const file = this.files[0]

    if (file && file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Please upload a valid CSV file.')
      this.value = '' // Clear the file input
      document.getElementById('parseCsvButton').disabled = true // Disable parse button
    } else {
      document.getElementById('parseCsvButton').disabled = !this.files.length
    }
  })

  // Modify the parseCsvButton event listener to include license validation
  document
    .getElementById('parseCsvButton')
    .addEventListener('click', async function () {
      try {
        // 1. FIRST force fresh license check by calling background.js
        const licenseCheck = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            { action: 'validateSession' },
            response => {
              if (chrome.runtime.lastError) {
                console.error('License check error:', chrome.runtime.lastError)
                resolve({ valid: false })
              } else {
                resolve(response)
              }
            }
          )
        })

        // 2. Check the license status from the response
        if (
          !licenseCheck ||
          !licenseCheck.license ||
          licenseCheck.license.license_status !== 'sold'
        ) {
          alert('Valid license required for bulk importing tasks from CSV')
          return
        }

        // 3. Only proceed with CSV parsing if license is valid
        const file = document.getElementById('fileInput').files[0]
        if (file) {
          parseCsv(file)
        }

        // 4. Update UI to reflect current license status
        chrome.storage.local.get(['license'], data => {
          updateUI(true, licenseCheck.userEmail, data.license)
        })
      } catch (error) {
        console.error('Error during license check:', error)
        alert('Error validating license. Please try again.')
      }
    })

  // The rest of your existing parseCsv and createTaskFromCsv functions remain unchanged
  function parseCsv (file) {
    const reader = new FileReader()
    reader.onload = function (event) {
      const csvData = event.target.result
      const rows = csvData
        .trim()
        .split('\n')
        .map(row => row.split(','))

      // Assuming first row is the header, start from the second row
      rows.slice(1).forEach(row => {
        if (row.length) createTaskFromCsv(row)
      })
    }
    reader.readAsText(file)
  }

  function createTaskFromCsv (row) {
    createTask() // Create a new task in the DOM using the existing function

    // Get the last created task element
    const taskElements = document.querySelectorAll('.task')
    const lastTaskElement = taskElements[taskElements.length - 1]
    const taskId = lastTaskElement.dataset.taskId

    // Populate fields based on the CSV data
    const urlsTextarea = lastTaskElement.querySelector('.urls')
    const folderNameInput = lastTaskElement.querySelector('.folderName')
    const downloadTimeInput = lastTaskElement.querySelector('.download-time')
    const zipCheckbox = lastTaskElement.querySelector('.zip-checkbox')
    const buildCheckbox = lastTaskElement.querySelector('.build-checkbox')
    const sortableList = lastTaskElement.querySelector(`#sortable-${taskId}`)
    const sequenceStartInput = lastTaskElement.querySelector(
      '.sequence-start-input'
    )
    const downloadIfCheckbox = lastTaskElement.querySelector(
      '.download-if-checkbox'
    )
    const downloadIfKeywordsList = lastTaskElement.querySelector(
      '.download-if-keywords'
    )
    const downloadIfLogic = lastTaskElement.querySelector(
      `input[name="downloadIfLogic-${taskId}"]`
    )
    const downloadIfInputsContainer = lastTaskElement.querySelector(
      `#download-if-inputs-${taskId}`
    )
    const convertCheckbox = lastTaskElement.querySelector(
      `#convert-checkbox-${taskId}`
    )
    const convertOptions = lastTaskElement.querySelector(
      `#convert-options-${taskId}`
    )
    const convertFormat = lastTaskElement.querySelector(
      `#convert-format-${taskId}`
    )
    const qualitySlider = lastTaskElement.querySelector(
      `#quality-slider-${taskId}`
    )
    const qualityValue = lastTaskElement.querySelector(
      `#quality-value-${taskId}`
    )

    // WATERMARK checkbox
    const watermarkCheckbox = lastTaskElement.querySelector(
      `#watermark-checkbox-${taskId}`
    )

    // Populate each field from the CSV row
    urlsTextarea.value = row[0].split(';').join('\n') // URLs
    folderNameInput.value = row[2] // Folder name
    downloadTimeInput.value = row[3] // Download time
    zipCheckbox.checked = row[4].toLowerCase() === 'true' // zipDownload
    buildCheckbox.checked = row[5].toLowerCase() === 'true' // buildCheckbox

    // File types from row[1]
    const selectedFileTypes = row[1].split(';')
    const allFormatsCheckbox = lastTaskElement.querySelector(
      `input[type="checkbox"][value="all"]`
    )
    if (
      selectedFileTypes.length === 1 &&
      selectedFileTypes[0].toLowerCase() === 'all'
    ) {
      allFormatsCheckbox.checked = true
    } else {
      allFormatsCheckbox.checked = false
      selectedFileTypes.forEach(type => {
        const fileTypeCheckbox = lastTaskElement.querySelector(
          `input[type="checkbox"][value="${type.trim()}"]`
        )
        if (fileTypeCheckbox) {
          fileTypeCheckbox.checked = true
        }
      })
    }

    // sortableList from row[6]
    if (row[6]) {
      sortableList.innerHTML = ''
      row[6].split(';').forEach(item => {
        const listItem = document.createElement('li')
        listItem.className = 'ui-state-default'
        listItem.textContent = item
        sortableList.appendChild(listItem)
      })
      const extensionItem = document.createElement('li')
      extensionItem.className = 'ui-state-default extension ui-sortable-handle'
      extensionItem.textContent = '.extension'
      sortableList.appendChild(extensionItem)
    }

    if (row[7]) sequenceStartInput.value = row[7]

    downloadIfCheckbox.checked = row[8].toLowerCase() === 'true'

    if (downloadIfCheckbox.checked) {
      downloadIfInputsContainer.style.display = 'block'
      downloadIfKeywordsList.style.display = 'block'

      const keywords = row[9].split(';')
      keywords.forEach(keyword => {
        if (keyword.trim()) {
          const keywordElement = document.createElement('li')
          keywordElement.className = 'download-if-keyword'
          keywordElement.textContent = keyword.trim()
          const removeButton = document.createElement('button')
          removeButton.textContent = 'X'
          removeButton.className = 'remove-keyword-btn'
          removeButton.addEventListener('click', () => keywordElement.remove())
          keywordElement.appendChild(removeButton)
          downloadIfKeywordsList.appendChild(keywordElement)
        }
      })

      if (row[10]) {
        const logicRadio = lastTaskElement.querySelector(
          `input[name="downloadIfLogic-${taskId}"][value="${row[10].toLowerCase()}"]`
        )
        if (logicRadio) {
          logicRadio.checked = true
          const hasContains = Array.from(
            downloadIfKeywordsList.querySelectorAll('.download-if-keyword')
          ).some(el => el.textContent.includes('contains:'))
          const hasNotContains = Array.from(
            downloadIfKeywordsList.querySelectorAll('.download-if-keyword')
          ).some(el => el.textContent.includes('not-contains:'))
          if (hasContains && hasNotContains) {
            lastTaskElement.querySelector(
              `#download-if-logic-${taskId}`
            ).style.display = 'block'
          }
        }
      }
    } else {
      downloadIfInputsContainer.style.display = 'none'
      downloadIfKeywordsList.style.display = 'none'
      lastTaskElement.querySelector(
        `#download-if-logic-${taskId}`
      ).style.display = 'none'
    }

    // Conversion settings (columns 11 to 13)
    if (row.length > 13) {
      const convertEnabled = row[11] ? row[11].toLowerCase() === 'true' : false
      if (convertCheckbox) {
        convertCheckbox.checked = convertEnabled
        const event = new Event('change')
        convertCheckbox.dispatchEvent(event)
        convertOptions.style.display = convertEnabled ? 'block' : 'none'
      }

      if (row[12] && convertFormat) {
        const format = row[12].toLowerCase()
        if (['jpeg', 'png', 'webp'].includes(format)) {
          convertFormat.value = format
        }
      }

      if (row[13] && qualitySlider && qualityValue) {
        const quality = parseInt(row[13]) || 100
        qualitySlider.value = quality
        qualityValue.textContent = `${quality}%`
        const inputEvent = new Event('input')
        qualitySlider.dispatchEvent(inputEvent)
      }
    }

    const statusElement = lastTaskElement.querySelector('.status')
    if (statusElement) {
      statusElement.textContent = row[15]
    }

    if (row.length > 14 && watermarkCheckbox) {
      watermarkCheckbox.checked = row[14].toLowerCase() === 'true'
    }

    setTimeout(() => {
      autoSaveTask(taskId)
    }, 300)
  }

  let filenameMap = {} // Global map for tracking filenames
  const tasksContainer = document.getElementById('tasks-container')
  const createTaskBtn = document.getElementById('create-task-btn')
  const saveOptionsBtn = document.getElementById('save-options-btn')
  const datetimeInputs = document.querySelectorAll('.download-time')

  // Dark mode toggle logic
  const darkModeToggle = document.getElementById('darkModeToggle')

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
      if (isDarkMode) {
        document.body.classList.add('dark-mode')
      } else {
        document.body.classList.remove('dark-mode')
      }
    })
  })

  createTaskBtn.addEventListener('click', async function () {
    try {
      const currentTasks = await new Promise(resolve => {
        chrome.storage.local.get('tasks', data => resolve(data.tasks || []))
      })

      // License check
      const licenseCheck = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'validateSession' }, response => {
          if (chrome.runtime.lastError) {
            console.error('License check error:', chrome.runtime.lastError)
            resolve({ valid: false })
          } else {
            resolve(response)
          }
        })
      })

      const licenseStatus = licenseCheck?.license?.license_status

      if (licenseStatus !== 'sold') {
        // Free user: block creating new tasks
        alert(
          'Free users can only use the default task and cannot create new tasks.'
        )
        return
      }

      // Premium users: allow creating tasks
      createTask()

      // Update UI license status if needed
      if (currentTasks.length > 0) {
        chrome.storage.local.get(['license'], data => {
          updateUI(true, licenseCheck?.userEmail, data.license)
        })
      }
    } catch (error) {
      console.error('Error during license check:', error)
      alert('Error validating license. Please try again.')
    }
  })

  saveOptionsBtn.addEventListener('click', saveOptions)
  chrome.alarms.create('downloadAlarm', { periodInMinutes: 0.5 })
  chrome.alarms.onAlarm.addListener(handleAlarm)

  chrome.storage.local.get('tasks', function (data) {
    let tasks = data.tasks || []

    // Check if there are no tasks and create a default task if necessary
    if (tasks.length === 0) {
      const defaultTask = {
        id: Date.now().toString(),
        urls: [''], // Default empty URL
        fileTypes: ['all'], // Default to all file types
        folderName: '', // Default empty folder name
        downloadTime: '', // Default to current time
        zipDownload: false, // Default to not zipping
        status: 'pending', // Default status
        buildCheckbox: false, // Default to not building filenames
        sortableList: '<li class="ui-state-default extension">.extension</li>', // Default sortable list
        sequenceStart: '1', // Default sequence start
        downloadIf: {
          enabled: false, // Default to no "Download If" condition
          keywords: [], // Default empty keywords
          logic: null // Default no logic
        }
      }

      tasks.push(defaultTask) // Add the default task to the tasks array
      chrome.storage.local.set({ tasks }, function () {
        //console.log("Default task created and saved:", defaultTask);
      })
    }

    // Add each task to the DOM
    tasks.forEach(task => {
      addTaskToDOM(task)
      const taskElement = tasksContainer.lastElementChild
      if (taskElement) {
        const removeTaskBtn = taskElement.querySelector('.remove-task-btn')
        if (removeTaskBtn) {
          removeTaskBtn.addEventListener('click', removeTask)
        }
        const stripDuplicatesBtn = taskElement.querySelector(
          '.strip-duplicates-btn'
        )
        if (stripDuplicatesBtn) {
          stripDuplicatesBtn.addEventListener('click', stripDuplicates)
        }
        const allFormatsCheckbox = taskElement.querySelector(
          `#all-formats-checkbox-${task.id}`
        )
        if (allFormatsCheckbox) {
          allFormatsCheckbox.addEventListener('change', function () {
            const otherCheckboxes = taskElement.querySelectorAll(
              `.file-type-${task.id}`
            )
            otherCheckboxes.forEach(checkbox => {
              checkbox.disabled = this.checked
              if (this.checked) {
                checkbox.checked = false
              }
            })
          })
        }

        const otherCheckboxes = taskElement.querySelectorAll(
          `.file-type-${task.id}:not(.file-type)`
        )
        otherCheckboxes.forEach(checkbox => {
          checkbox.addEventListener('change', function () {
            if (this.checked) {
              const allFormatsCheckbox = taskElement.querySelector(
                `#all-formats-checkbox-${task.id}`
              )
              if (allFormatsCheckbox) {
                allFormatsCheckbox.checked = false
              }
              allFormatsCheckbox.disabled = true
            }
          })
        })

        const checkboxes = taskElement.querySelectorAll(`.file-type-${task.id}`)
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', function () {
            const allFormatsCheckbox = taskElement.querySelector(
              `#all-formats-checkbox-${task.id}`
            )
            if (allFormatsCheckbox) {
              const allChecked = Array.from(checkboxes).every(
                checkbox => checkbox.checked
              )
              allFormatsCheckbox.disabled = allChecked
            }
          })
        })

        // Update buildCheckbox and sortableList
        const buildCheckbox = taskElement.querySelector(
          `#build-checkbox-${task.id}`
        )
        const sortableList = taskElement.querySelector(`#sortable-${task.id}`)
        buildCheckbox.checked = task.buildCheckbox
        sortableList.innerHTML = task.sortableList

        // Update sequenceStart input visibility and value
        const sequenceStartInputElement = taskElement.querySelector(
          `#sequence-start-${task.id}`
        )
        if (sortableList.innerHTML.toLowerCase().includes('sequence')) {
          sequenceStartInputElement.style.display = 'block'
        } else {
          sequenceStartInputElement.style.display = 'none'
        }

        // Set the saved value for the sequence start input if it exists
        if (task.sequenceStart) {
          sequenceStartInputElement.value = task.sequenceStart // Set the value only if it's provided
        } else {
          sequenceStartInputElement.value = '' // Clear the value to ensure the placeholder is shown
        }

        const urls = task.urls || []
        if (urls.length > 0 && validateUrlSections(urls)) {
          populateDropdown(urls, task.id) // Populate the dropdown if URLs have the same number of sections
        }
      }
    })
  })

  const queuedDownloadToggle = document.getElementById('queuedDownloadToggle')

  // Monitor and handle Queued Download toggle
  queuedDownloadToggle.addEventListener('change', toggleQueuedDownloadMode)

  function toggleQueuedDownloadMode () {
    const isQueuedDownload = queuedDownloadToggle.checked

    // Save the state to chrome.storage.local
    chrome.storage.local.set({ isQueuedDownload }, function () {
      //console.log('Queued Download mode saved:', isQueuedDownload);
    })

    // Disable download-time inputs if Queued Download is active
    document.querySelectorAll('.download-time').forEach(input => {
      input.disabled = isQueuedDownload
    })

    // Stop the downloadAlarm if Queued Download is active
    if (isQueuedDownload) {
      chrome.alarms.clear('downloadAlarm')
      executeTasksInSequence()
    } else {
      chrome.alarms.create('downloadAlarm', { periodInMinutes: 0.5 })
    }
  }

  // Load Queued Download state on page load
  chrome.storage.local.get(['isQueuedDownload'], function (data) {
    const savedQueuedDownload = data.isQueuedDownload || false
    queuedDownloadToggle.checked = savedQueuedDownload

    // Trigger the change handler to apply the state
    toggleQueuedDownloadMode()

    // Manually trigger the UI update since the checkbox change event won't fire
    document.querySelectorAll('.download-time').forEach(input => {
      input.disabled = savedQueuedDownload
    })
  })

  async function executeTasksInSequence () {
    chrome.storage.local.get('tasks', async function (data) {
      let tasks = data.tasks || []
      const pendingTasks = tasks
        .filter(task => task.status === 'pending')
        .sort((a, b) => parseInt(a.id) - parseInt(b.id)) // Sort tasks by task.id in ascending order

      for (const task of pendingTasks) {
        // Set the task status to "inProgress" before starting
        task.status = 'inProgress'
        await saveUpdatedTask(task) // Save status change immediately

        // Check if the task should be downloaded as a ZIP or individual files
        if (task.zipDownload) {
          // Await downloadZip to ensure this task completes before moving to the next
          await downloadZip(task)
        } else {
          // Use downloadFiles or another function to download individual files
          await downloadFiles(task)
        }

        // Set the task status to "completed" after download is finished
        task.status = 'completed'
        await saveUpdatedTask(task) // Save status change immediately after completion
      }
    })
  }

  // Modify handleAlarm to skip execution if Queued Download is active
  function handleAlarm (alarm) {
    if (alarm.name === 'downloadAlarm' && !queuedDownloadToggle.checked) {
      chrome.storage.local.get('tasks', function (data) {
        const tasks = data.tasks || []
        // Filter out drafts before processing
        const processableTasks = tasks.filter(task => task.status !== 'draft')
        executePendingTasks(tasks)
      })
    }
  }

  // Function to get the current date and time in the format 'YYYY-MM-DDTHH:MM'
  function getMinDateTime () {
    const now = new Date() // Get current date and time
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0') // Months are zero-based
    const day = now.getDate().toString().padStart(2, '0')
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')

    // Return in the format 'YYYY-MM-DDTHH:MM'
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  function updateProgress (taskId, progressValue) {
    const progressBar = document.getElementById(`progress-bar-${taskId}`)
    const progressText = document.getElementById(`progress-text-${taskId}`)

    if (progressBar && progressText) {
      progressBar.value = progressValue
      progressText.textContent = `Progress: ${progressValue}%`
    }
  }

  function splitUrl (url) {
    return url.split(/[^a-zA-Z0-9]+/).filter(Boolean)
  }

  function validateUrlSections (urls) {
    const sectionCounts = urls.map(url => splitUrl(url).length)
    return sectionCounts.every(count => count === sectionCounts[0])
  }

  // Original filename options (that should always be present)
  const originalFilenameOptions = [
    { value: 'filename', text: 'Filename' },
    { value: '-', text: 'Hyphen' },
    { value: 'sequence', text: 'Sequence' },
    { value: 'timestamp', text: 'Timestamp' },
    { value: '_', text: 'Underscore' },
    { value: 'urlfragments', text: 'URL Fragments' },
    { value: 'website', text: 'Website' },
    { value: 'shortuuid', text: 'Random String' },
    { value: 'add_new', text: 'Add New' }
  ]

  // Function to populate original options in the dropdown
  function populateDropdown (urls, taskId) {
    const segments = splitUrl(urls[0]) // Assuming all URLs have the same number of segments
    const dropdown = document.querySelector(`#newItem-${taskId}`)

    // Clear the dropdown but keep the original filename options
    dropdown.innerHTML = ''

    // Add the original filename options first
    originalFilenameOptions.forEach(optionData => {
      const option = document.createElement('option')
      option.value = optionData.value
      option.text = optionData.text
      dropdown.appendChild(option)
    })

    // Add new options based on URL segments (only if URLs are valid)
    segments.forEach((segment, index) => {
      const option = document.createElement('option')
      option.value = `segment-${index}`
      option.text = `Segment ${index + 1}: ${segment}`
      dropdown.appendChild(option)
    })
  }

  // Function to handle failed validation and restore original options
  function handleFailedValidation (taskId) {
    //console.log("URLs do not have the same number of sections.");
    const dropdown = document.querySelector(`#newItem-${taskId}`)

    // Clear only dynamically added options but keep the original options
    dropdown.innerHTML = ''

    // Add back the original options (they should always be visible)
    originalFilenameOptions.forEach(optionData => {
      const option = document.createElement('option')
      option.value = optionData.value
      option.text = optionData.text
      dropdown.appendChild(option)
    })
  }

  // URL validation and handling in your existing event listener
  function handleUrlsInput (urls, taskId) {
    if (validateUrlSections(urls)) {
      populateDropdown(urls, taskId) // Populate dropdown if URLs have the same number of sections
    } else {
      handleFailedValidation(taskId) // Restore the original options
    }
  }

  function saveKeywordsToStorage (taskId) {
    const taskElement = document.querySelector(
      `.task[data-task-id="${taskId}"]`
    )
    const keywordsList = taskElement.querySelectorAll('.download-if-keyword')

    // Create the updated list of keywords
    const keywords = Array.from(keywordsList).map(keyword => {
      const text = keyword.textContent.replace('X', '').trim() // Remove the "X" from the text
      const [condition, value] = text.split(': ')
      return { condition, value }
    })

    // Save the updated keywords in Chrome storage
    chrome.storage.local.get('tasks', function (data) {
      const tasks = data.tasks || []
      const taskIndex = tasks.findIndex(t => t.id === taskId)

      if (taskIndex !== -1) {
        tasks[taskIndex].downloadIf = tasks[taskIndex].downloadIf || {}
        tasks[taskIndex].downloadIf.keywords = keywords // Store updated keywords
        tasks[taskIndex].downloadIf.enabled = true

        chrome.storage.local.set({ tasks }, function () {
          //console.log("Download If keywords saved:", keywords);
        })
      }
    })

    // Re-run the logic check after saving the updated list
    checkAndToggleLogicDisplay(taskId)
  }

  function checkAndToggleLogicDisplay (taskId) {
    // Get all the keywords from the task's keyword list
    const keywords = Array.from(
      document.querySelectorAll(
        `.task[data-task-id="${taskId}"] .download-if-keyword`
      )
    ).map(keyword => keyword.textContent.trim()) // Trim any extra spaces

    //console.log("Keywords:", keywords);

    // Check if "contains" and "not-contains" exist in the list as separate conditions
    const hasContains = keywords.some(kw => kw.startsWith('contains:'))
    const hasNotContains = keywords.some(kw => kw.startsWith('not-contains:'))

    //console.log("Has Contains:", hasContains);
    //console.log("Has Not Contains:", hasNotContains);

    // Reference to the logic div (radio buttons)
    const logicDiv = document.getElementById(`download-if-logic-${taskId}`)

    // Show the logic div if both conditions are present, otherwise hide it
    if (hasContains && hasNotContains) {
      logicDiv.style.display = 'block' // Show the AND/OR radio buttons
    } else {
      logicDiv.style.display = 'none' // Hide the AND/OR radio buttons
    }
  }

  function generateShortUUID () {
    return Math.random().toString(36).substring(2, 10) // Generates an 8-character alphanumeric string
  }

  // Add this function to handle URL input changes with auto-save
  function setupUrlAutoSave (textarea, taskId) {
    const debouncedSave = debounce(async () => {
      const status = await getTaskStatus(taskId)
      if (status === 'draft' || status === 'new') {
        autoSaveTask(taskId)
      }
    }, 500)

    // Use both input and change events
    textarea.addEventListener('input', debouncedSave)
    textarea.addEventListener('change', debouncedSave)

    // Special handling for paste events
    textarea.addEventListener('paste', () => {
      setTimeout(debouncedSave, 100) // Small delay to ensure paste is complete
    })
  }

  function createTask () {
    const taskId = Date.now().toString()
    // Determine if dragging is enabled or disabled
    const dragClass = 'dragdis'
    // Add sequence start number input field
    const sequenceStartInput = `<input type="text" id="sequence-start-${taskId}" class="sequence-start-input" placeholder="Start from e.g 1 or 0050 etc">`
    const taskTemplate = `
                <div class="task ${dragClass} createtask" draggable="${!isLocked}" data-task-id="${taskId}">
                        <textarea class="urls" rows="3" cols="30" placeholder="Enter image URLs"></textarea>
                        <!-- In your task template -->
                          <div class="url-info-container">
                              <div id="url-count-${taskId}" class="url-count">Paste URLs to check for duplicates</div>
                              <div id="duplicate-warning-${taskId}" class="duplicate-warning" style="display:none;"></div>
                          </div>
                            <progress id="progress-bar-${taskId}" max="100" value="0"></progress>
                        <div class="progress-text" id="progress-text-${taskId}">Progress: 0%</div>
                <div><details>
                      <summary class="opt-others">🗂️Select File Types</summary>
                      <label><input type="checkbox" id="all-formats-checkbox-${taskId}" class="file-type" value="all" checked> All Formats</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="jpg"> JPG</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="png"> PNG</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="gif"> GIF</label>                      
                      <label><input type="checkbox" class="file-type-${taskId}" value="jpeg"> JPEG</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="webp"> WEBP</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="svg"> SVG</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="pdf"> PDF</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="apng"> APNG</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="arw"> ARW</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="avif"> AVIF</label> 
                      <label><input type="checkbox" class="file-type-${taskId}" value="bmp"> BMP</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="cr2"> CR2</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="crw"> CRW</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="dcr"> DCR</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="dng"> DNG</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="exif"> EXIF</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="hdr"> HDR</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="heic"> HEIC</label>                      
                      <label><input type="checkbox" class="file-type-${taskId}" value="heif"> HEIF</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="ico"> ICO</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="indd"> INDD</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="jp2"> JP2</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="jfif"> JFIF</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="nef"> NEF</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="orf"> ORF</label> 
                      <label><input type="checkbox" class="file-type-${taskId}" value="raw"> RAW</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="raf"> RAF</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="rw2"> RW2</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="svgz"> SVGZ</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="tiff"> TIFF</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="tif"> TIF</label>
                </details>
                
                </div>
                <input type="datetime-local" class="download-time" value="">
  
                <input type="text" class="folderName" placeholder="Folder Name">
  
                      <div class="convert-switch-container">
                  <label class="switch">
                      <input type="checkbox" id="convert-checkbox-${taskId}" class="convert-checkbox">
                      <span class="slider round"></span>
                  </label>
                  <label class="switch-label">Convert</label>
              </div>
  
              <div id="convert-options-${taskId}" class="convert-options" style="display: none;">
                  <select id="convert-format-${taskId}" class="convert-format">
                      <option value="jpg">JPG</option>
                      <option value="png">PNG</option>
                      <option value="webp">WebP</option>
                  </select>
                  <label>Quality: <input type="range" id="quality-slider-${taskId}" min="1" max="100" value="100"></label>
                  <span id="quality-value-${taskId}">100%</span>
              </div>
  
            <!-- "Download If" Feature -->
            <div class="download-if-container">
              <label>
                <input type="checkbox" class="download-if-checkbox" id="download-if-checkbox-${taskId}">
                DOWNLOAD IF URL
              </label>
  
              <!-- Flex container for dropdown, input, and add button -->
              <div class="download-if-inputs" id="download-if-inputs-${taskId}" style="display: none;">
  
                <select id="download-if-condition-${taskId}" class="download-if-condition">
                  <option value="contains">Contains</option>
                  <option value="not-contains">Not Contains</option>
                </select>
  
                <input type="text" id="download-if-value-${taskId}" class="download-if-value" placeholder="Add Keyword, Domain etc">
                <button id="download-if-add-${taskId}" class="download-if-add-btn" style="padding:5px; margin:.1px;">Add</button>
              </div>
  
              <ul id="download-if-keywords-${taskId}" class="download-if-keywords" style="display: none;"></ul>
  
              <div class="download-if-logic" id="download-if-logic-${taskId}" style="display:none;">
                <label><input type="radio" name="downloadIfLogic-${taskId}" value="and" checked> AND</label>
                <label><input type="radio" name="downloadIfLogic-${taskId}" value="or"> OR</label>
              </div>
            </div>
  
            <div class="zip-switch-container">
                <label class="switch">
                    <input type="checkbox" id="zip-checkbox-${taskId}" class="zip-checkbox">
                    <span class="slider round"></span>
                </label>
                <label class="switch-label">Zip</label>
            </div>

                <div class="watermark-switch-container">
                    <label class="switch">
                        <input type="checkbox" id="watermark-checkbox-${taskId}" class="watermark-checkbox">
                        <span class="slider round"></span>
                    </label>
                    <label class="switch-label">Watermark</label>
                </div>

                <div class="fl_const">📝Filename Constructor</div>
                <input type="checkbox" id="build-checkbox-${taskId}" class="build-checkbox">
                  <select id="newItem-${taskId}" class="new-item-dropdown">
                    <option value="">Select an option</option>
                    <option value="filename">Filename</option>
                    <option value="-">Hyphen</option>
                    <option value="sequence">Sequence</option>
                    <option value="timestamp">Timestamp</option>
                    <option value="_">Underscore</option>
                    <option value="urlfragments">URL Fragments</option>
                    <option value="website">Website</option>
                    <option value="shortuuid">Random String</option>
                    <option value="add_new">Add New</option>
                  </select>
  
                  <input type="text" id="newItemInput-${taskId}" class="new-item-input" placeholder="Enter new keyword" style="display:none;">
                  <button id="addButton" class="add-new-item-btn" style="padding:5px;">Add</button>
                  <ul id="sortable-${taskId}" class="sortable isort">
                    <li class="ui-state-default extension">.extension</li> 
                  </ul>
                  ${sequenceStartInput}
                <button class="remove-task-btn">X</button>
                <button class="strip-duplicates-btn"> Strip Duplicates</button>
        </div>
        `

    tasksContainer.insertAdjacentHTML('beforeend', taskTemplate)
    const taskElement = tasksContainer.lastElementChild
    const urlsTextarea = taskElement.querySelector('.urls')

    // Set up auto-save for this new task
    setupUrlAutoSave(urlsTextarea, taskId)

    const urlCountDiv = taskElement.querySelector(`#url-count-${taskId}`)
    const allFormatsCheckbox = taskElement.querySelector(
      `#all-formats-checkbox-${taskId}`
    )
    const zipCheckbox = taskElement.querySelector(`#zip-checkbox-${taskId}`)
    const checkboxes = taskElement.querySelectorAll(`.file-type-${taskId}`)
    const newItemSelect = taskElement.querySelector(`#newItem-${taskId}`)
    const sequenceStartInputElement = taskElement.querySelector(
      `#sequence-start-${taskId}`
    )
    const newItemInput = taskElement.querySelector(`#newItemInput-${taskId}`)
    const addButton = taskElement.querySelector('.add-new-item-btn')
    const sortableList = taskElement.querySelector(`#sortable-${taskId}`)
    const buildCheckbox = taskElement.querySelector(`#build-checkbox-${taskId}`)

    const convertCheckbox = taskElement.querySelector(
      `#convert-checkbox-${taskId}`
    )
    const convertOptions = taskElement.querySelector(
      `#convert-options-${taskId}`
    )
    const qualitySlider = taskElement.querySelector(`#quality-slider-${taskId}`)
    const qualityValue = taskElement.querySelector(`#quality-value-${taskId}`)

    const downloadIfCheckbox = document.getElementById(
      `download-if-checkbox-${taskId}`
    )
    const downloadIfCondition = document.getElementById(
      `download-if-condition-${taskId}`
    )
    const downloadIfValue = document.getElementById(
      `download-if-value-${taskId}`
    )
    const downloadIfAddButton = document.getElementById(
      `download-if-add-${taskId}`
    )
    const downloadIfKeywordsList = document.getElementById(
      `download-if-keywords-${taskId}`
    )
    const downloadIfLogicDiv = document.getElementById(
      `download-if-logic-${taskId}`
    )

    // Show/hide conversion options when checkbox is toggled
    convertCheckbox.addEventListener('change', function () {
      convertOptions.style.display = this.checked ? 'block' : 'none'
    })

    // Update quality percentage display
    qualitySlider.addEventListener('input', function () {
      qualityValue.textContent = `${this.value}%`
    })

    downloadIfCheckbox.addEventListener('change', function () {
      const downloadIfInputsContainer = document.querySelector(
        `#download-if-inputs-${taskId}`
      ) // Reference to the container

      if (this.checked) {
        downloadIfInputsContainer.style.display = 'block' // Show the entire container when checkbox is checked
        downloadIfKeywordsList.style.display = 'block' // Show the keywords list
        checkAndToggleLogicDisplay(taskId) // Call logic display toggle to show/hide AND/OR based on keywords
      } else {
        downloadIfInputsContainer.style.display = 'none' // Hide the entire container when checkbox is unchecked
        downloadIfKeywordsList.style.display = 'none' // Hide the keywords list
        downloadIfLogicDiv.style.display = 'none' // Also hide the AND/OR logic buttons
      }
    })

    // Show or hide the Add button when the text input is focused
    downloadIfValue.addEventListener('input', function () {
      if (downloadIfValue.value.trim() !== '') {
        downloadIfAddButton.style.display = 'inline-block'
      } else {
        downloadIfAddButton.style.display = 'none'
      }
    })

    // Add keywords dynamically while checking for duplicates
    downloadIfAddButton.addEventListener('click', function () {
      const condition = downloadIfCondition.value
      const value = downloadIfValue.value.trim()

      // Check if the keyword already exists in the DOM (regardless of "contains" or "not-contains")
      const existingKeywords = Array.from(
        downloadIfKeywordsList.querySelectorAll('.download-if-keyword')
      ).map(keyword => {
        const text = keyword.textContent.replace('X', '').trim()
        const [existingCondition, existingValue] = text.split(': ')
        return existingValue // Only check if the value exists
      })

      // If the keyword already exists, show an alert and stop further execution
      if (existingKeywords.includes(value)) {
        alert(
          `The keyword "${value}" has already been added under either "contains" or "not-contains". Please choose a different keyword.`
        )
        return // Stop further execution if the keyword already exists
      }

      if (value !== '') {
        // Add the keyword to the list in the DOM
        const keywordElement = document.createElement('li')
        keywordElement.className = 'download-if-keyword'
        keywordElement.textContent = `${condition}: ${value}`

        // Add a remove button
        const removeButton = document.createElement('button')
        removeButton.textContent = 'X'
        removeButton.className = 'remove-keyword-btn'
        removeButton.addEventListener('click', function () {
          keywordElement.remove()
          checkAndToggleLogicDisplay(taskId) // Check the logic buttons visibility after removing a keyword
        })

        keywordElement.appendChild(removeButton)
        downloadIfKeywordsList.appendChild(keywordElement)

        // Check if both "Contains" and "Not Contains" are present and show/hide the AND/OR logic buttons
        checkAndToggleLogicDisplay(taskId)

        // Clear the input field
        downloadIfValue.value = ''
      }
    })

    // Add event listener to the sortable list to check for "Sequence" updates
    $(sortableList).sortable({
      cancel: '.extension', // Prevent dragging of the .extension item
      beforeStop: function (event, ui) {
        // Get the current and previous elements in the sortable list
        const currentItem = ui.item
        const prevItem = currentItem.prev()
        const nextItem = currentItem.next()

        // Prevent dropping on top or below the .extension item
        if (prevItem.hasClass('extension') || nextItem.hasClass('extension')) {
          $(sortableList).sortable('cancel') // Cancel the move if it's next to .extension
        }
      },
      update: function () {
        checkSequenceInList() // Check if "Sequence" is in the list and toggle the input visibility
      }
    })

    // Call checkSequenceInList initially to set the correct visibility
    checkSequenceInList()

    // Retrieve the saved lock status from local storage or set to false if not found
    var isLocked = localStorage.getItem('isLocked') === 'true' ? true : true

    // Function to update lock status and UI
    function updateLockStatus () {
      $('.lock-btn').text(isLocked ? 'Unlock Drag' : 'Lock Drag')
      localStorage.setItem('isLocked', isLocked) // Save the lock status to local storage

      // Update draggable attribute for each task
      $('.task').attr('draggable', !isLocked)

      // Enable or disable sorting based on lock status
      $('#tasks-container').sortable('option', 'disabled', isLocked)
    }

    // Add click event handler for the lock button
    $('.lock-btn').on('click', function () {
      isLocked = !isLocked // Toggle the lock state
      updateLockStatus()
    })

    // Update lock status when the page loads
    updateLockStatus()

    newItemSelect.disabled = true

    // Modify the handleUrlInput function to include auto-save
    function handleUrlInput (textarea, urlCountDiv, taskId) {
      return new Promise(async resolve => {
        let urls = textarea.value.split('\n').filter(url => url.trim() !== '')
        const originalUrlCount = urls.length

        // First check if we should auto-save
        const status = await getTaskStatus(taskId)
        const shouldAutoSave = status === 'draft' || status === 'new'

        // Call handleUrlsInput if filename constructor is enabled
        const taskElement = textarea.closest('.task')
        const buildCheckbox = taskElement.querySelector(
          `#build-checkbox-${taskId}`
        )
        if (buildCheckbox && buildCheckbox.checked && urls.length > 0) {
          handleUrlsInput(urls, taskId)
        }

        // License enforcement if exceeding limit
        if (originalUrlCount > MAX_URLS) {
          chrome.runtime.sendMessage(
            { action: 'validateSession' },
            licenseCheck => {
              const hasActiveLicense =
                licenseCheck?.license?.license_status === 'sold'
              const isExpired =
                licenseCheck?.license?.license_status === 'expired'
              const noLicense = !licenseCheck?.license

              if (!hasActiveLicense) {
                const maxAllowed = MAX_URLS
                urls = urls.slice(0, maxAllowed)
                textarea.value = urls.join('\n')

                const uniqueUrls = [...new Set(urls)]
                const duplicateCount = urls.length - uniqueUrls.length

                let message = ''
                if (isExpired) {
                  message = 'Expired license - renew for unlimited URLs'
                } else if (noLicense) {
                  message = 'Free version limit'
                } else {
                  message = 'License required'
                }

                urlCountDiv.textContent = `URL count: ${urls.length} - ${message}`

                const duplicateWarningDiv = document.getElementById(
                  `duplicate-warning-${taskId}`
                )
                if (duplicateCount > 0 && duplicateWarningDiv) {
                  duplicateWarningDiv.style.display = 'block'
                  duplicateWarningDiv.textContent = `Duplicate URLs detected: ${duplicateCount}`
                } else if (duplicateWarningDiv) {
                  duplicateWarningDiv.style.display = 'none'
                }

                if (isExpired && document.querySelector('.licenseInfo')) {
                  showLicenseMessage(
                    '⚠️ License expired - renew for unlimited URLs'
                  )
                }

                // Auto-save even if limited by license - but only if we actually changed the URLs
                if (shouldAutoSave && originalUrlCount > MAX_URLS) {
                  autoSaveTask(taskId)
                }

                resolve()
                return
              }

              // If has license, continue with full processing
              const uniqueUrls = [...new Set(urls)]
              const duplicateCount = urls.length - uniqueUrls.length

              urlCountDiv.textContent = `URL count: ${urls.length}`

              const duplicateWarningDiv = document.getElementById(
                `duplicate-warning-${taskId}`
              )
              if (duplicateCount > 0 && duplicateWarningDiv) {
                duplicateWarningDiv.style.display = 'block'
                duplicateWarningDiv.textContent = `Duplicate URLs detected: ${duplicateCount}`
              } else if (duplicateWarningDiv) {
                duplicateWarningDiv.style.display = 'none'
              }

              if (shouldAutoSave) {
                autoSaveTask(taskId)
              }

              resolve()
            }
          )
        } else {
          // If under limit, process normally
          const uniqueUrls = [...new Set(urls)]
          const duplicateCount = urls.length - uniqueUrls.length

          urlCountDiv.textContent = `URL count: ${urls.length}`

          const duplicateWarningDiv = document.getElementById(
            `duplicate-warning-${taskId}`
          )
          if (duplicateCount > 0 && duplicateWarningDiv) {
            duplicateWarningDiv.style.display = 'block'
            duplicateWarningDiv.textContent = `Duplicate URLs detected: ${duplicateCount}`
          } else if (duplicateWarningDiv) {
            duplicateWarningDiv.style.display = 'none'
          }

          if (shouldAutoSave) {
            autoSaveTask(taskId)
          }

          resolve()
        }
      })
    }

    // Helper function to process URLs and handle duplicates
    function processUrls (urls, textarea, urlCountDiv, taskId, shouldAutoSave) {
      const uniqueUrls = [...new Set(urls)]
      const duplicateCount = urls.length - uniqueUrls.length

      urlCountDiv.textContent = `URL count: ${urls.length}`

      const duplicateWarningDiv = document.getElementById(
        `duplicate-warning-${taskId}`
      )
      if (duplicateCount > 0 && duplicateWarningDiv) {
        duplicateWarningDiv.style.display = 'block'
        duplicateWarningDiv.textContent = `Duplicate URLs detected: ${duplicateCount}`
      } else if (duplicateWarningDiv) {
        duplicateWarningDiv.style.display = 'none'
      }

      // Auto-save if this is a draft or new task
      if (shouldAutoSave) {
        autoSaveTask(taskId)
      }
    }

    // Safe message display
    function showLicenseMessage (text) {
      const licenseInfo = document.querySelector('.licenseInfo')
      if (!licenseInfo) return

      // Create or update license message in the dedicated license info area
      let msg = licenseInfo.querySelector('.license-message')
      if (!msg) {
        msg = document.createElement('div')
        msg.className = 'license-message'
        licenseInfo.appendChild(msg)
      }
      msg.innerHTML = `<p>${text} <a href="${BASE_URL}/shop/" target="_blank">Renew</a></p>`

      // Ensure this doesn't affect the URL count display
      const urlCounts = document.querySelectorAll('.url-count')
      urlCounts.forEach(count => {
        count.style.display = 'block' // Ensure URL counts remain visible
      })
    }

    // Setup event listeners
    document.querySelectorAll('.urls').forEach(textarea => {
      const taskId = textarea.closest('.task').dataset.taskId
      const urlCountDiv = document.getElementById(`url-count-${taskId}`)

      // Handle all input types (keyboard + paste)
      textarea.addEventListener(
        'input',
        debounce(() => {
          handleUrlInput(textarea, urlCountDiv, taskId)
        }, 500)
      )

      // Special handling for CTRL+V
      textarea.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'v') {
          setTimeout(() => handleUrlInput(textarea, urlCountDiv, taskId), 10)
        }
      })
    })

    // Initialize the URL count and duplicate count
    const initialUrls = urlsTextarea.value
      .split('\n')
      .filter(url => url.trim() !== '')
    const initialUniqueUrls = [...new Set(initialUrls)]
    const initialUrlCount = initialUrls.length
    const initialDuplicateCount = initialUrlCount - initialUniqueUrls.length

    urlCountDiv.textContent = `URL count: ${initialUrlCount} (${initialDuplicateCount} duplicates)`

    buildCheckbox.addEventListener('change', function () {
      newItemSelect.disabled = !this.checked
      if (this.checked) {
        // When enabled, check URLs and populate dropdown
        const urls = urlsTextarea.value
          .split('\n')
          .filter(url => url.trim() !== '')
        if (urls.length > 0) {
          handleUrlsInput(urls, taskId)
        }
      } else {
        newItemInput.style.display = 'none'
      }
    })

    newItemSelect.addEventListener('change', function () {
      if (this.value === 'add_new') {
        newItemInput.style.display = 'inline-block'
      } else {
        newItemInput.style.display = 'none'
      }
    })
    addButton.addEventListener('click', addNewItem)

    // Function to check if "Sequence" is in the list and toggle the sequence start input
    function checkSequenceInList () {
      const sequenceExists = sortableList.innerHTML
        .toLowerCase()
        .includes('sequence')
      sequenceStartInputElement.style.display = sequenceExists
        ? 'block'
        : 'none'
    }

    // Add event listener to the sortable list to check for "Sequence" updates
    $(sortableList).sortable({
      cancel: '.extension', // Prevent dragging of the .extension item
      beforeStop: function (event, ui) {
        // Get the current and previous elements in the sortable list
        const currentItem = ui.item
        const prevItem = currentItem.prev()
        const nextItem = currentItem.next()

        // Prevent dropping on top or below the .extension item
        if (prevItem.hasClass('extension') || nextItem.hasClass('extension')) {
          $(sortableList).sortable('cancel') // Cancel the move if it's next to .extension
        }
      },
      update: function () {
        checkSequenceInList() // Check if "Sequence" is in the list and toggle the input visibility
      }
    })

    // Update the addNewItem function to call checkSequenceInList after adding the item
    function addNewItem () {
      let newItem
      if (newItemSelect.value === 'add_new') {
        newItem = newItemInput.value
      } else {
        newItem = newItemSelect.value
      }

      if (newItem.startsWith('segment-')) {
        const segmentIndex = parseInt(newItem.split('-')[1])
        newItem = `Segment ${segmentIndex + 1}`
      }

      if (newItem.trim() !== '') {
        const extensionItem = sortableList.querySelector('.extension')
        const newItemElement = document.createElement('li')
        newItemElement.className = 'ui-state-default'
        newItemElement.textContent = newItem
        const removeButton = document.createElement('button')
        removeButton.className = 'remove-btn'
        removeButton.textContent = 'X'
        removeButton.addEventListener('click', function () {
          newItemElement.remove()
          checkSequenceInList() // Check if the sequence item is still in the list
        })
        newItemElement.appendChild(removeButton)
        sortableList.insertBefore(newItemElement, extensionItem)
        newItemSelect.value = ''
        newItemInput.value = ''
        newItemInput.style.display = 'none'

        checkSequenceInList() // Check if the sequence item has been added
      }
    }

    // Call checkSequenceInList initially to set the correct visibility
    checkSequenceInList()

    // Make sure to call checkSequenceInList when removing a task or an item
    document.addEventListener('click', function (event) {
      if (event.target && event.target.classList.contains('remove-btn')) {
        // The remove button was clicked
        const listItemToRemove = event.target.closest('.ui-state-default')
        listItemToRemove.remove()
        checkSequenceInList() // Recheck if sequence is in the list after removing an item
      }
    })

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function () {
        if (this.checked) {
          allFormatsCheckbox.checked = false
          allFormatsCheckbox.disabled = true
        }
      })
    })

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function () {
        const allChecked = Array.from(checkboxes).every(
          checkbox => checkbox.checked
        )
        allFormatsCheckbox.disabled = allChecked
      })
    })

    zipCheckbox.addEventListener('change', function () {
      // Do nothing here to prevent immediate download
    })

    const removeTaskBtn = taskElement.querySelector('.remove-task-btn')
    removeTaskBtn.addEventListener('click', removeTask)
    const stripDuplicatesBtn = taskElement.querySelector(
      '.strip-duplicates-btn'
    )
    stripDuplicatesBtn.addEventListener('click', stripDuplicates)
    const downloadTimeInput = taskElement.querySelector('.download-time')
    downloadTimeInput.setAttribute('min', getMinDateTime())

    setTimeout(() => {
      autoSaveTask(taskId)
    }, 300)
  }

  function removeTask (event) {
    const taskElement = event.target.closest('.task')
    const taskId = taskElement.getAttribute('data-task-id')

    chrome.storage.local.get(['tasks', 'license'], function (data) {
      const tasks = data.tasks || []
      const licenseStatus = data.license?.license_status

      // Check if free user and if trying to delete the default task (assumed first task)
      if (licenseStatus !== 'sold') {
        // Check if task is default task:
        // Assuming default task is the first task in storage
        if (tasks.length > 0 && tasks[0].id === taskId) {
          alert('Free users cannot delete the default task.')
          return // block deletion
        }
      }

      // Proceed with deletion for premium or non-default tasks
      const updatedTasks = tasks.filter(task => task.id !== taskId)
      chrome.storage.local.set({ tasks: updatedTasks }, function () {
        //console.log("Task removed:", taskId);
      })

      taskElement.remove()
    })
  }

  // Add this function to save tasks without triggering downloads
  async function saveTasksAsDraft () {
    return new Promise(async (resolve, reject) => {
      // Get license status first
      const licenseCheck = await new Promise(resolve =>
        chrome.runtime.sendMessage({ action: 'validateSession' }, resolve)
      )
      const hasPremiumLicense = licenseCheck?.license?.license_status === 'sold'

      const tasks = []
      const taskElements = document.querySelectorAll('.task')
      let invalidDateTime = false

      // For free or expired users: save only the default task (assumed first)
      // For premium users: save all tasks normally
      if (!hasPremiumLicense) {
        if (taskElements.length === 0) {
          // No tasks to save
          resolve()
          return
        }

        // Use only the first task element as default task
        const taskElement = taskElements[0]

        // Proceed to extract task data from default task element
        const taskId = taskElement.getAttribute('data-task-id')
        const sortableListHTML = taskElement.querySelector(
          `#sortable-${taskId}`
        ).innerHTML
        const sequenceStartInputElement = taskElement.querySelector(
          `#sequence-start-${taskId}`
        )
        const sequenceStartValue = sequenceStartInputElement
          ? sequenceStartInputElement.value || '1'
          : '1'

        const isSequenceSelected = sortableListHTML
          .toLowerCase()
          .includes('sequence')

        if (
          isSequenceSelected &&
          (isNaN(sequenceStartValue) || sequenceStartValue.trim() === '')
        ) {
          alert('Please enter a valid number for "Start from".')
          reject()
          return
        }

        const downloadTimeValue =
          taskElement.querySelector('.download-time').value

        const sequenceStart = isSequenceSelected ? sequenceStartValue : null

        const downloadIfChecked = taskElement.querySelector(
          `#download-if-checkbox-${taskId}`
        )?.checked

        const keywordsList = taskElement.querySelectorAll(
          '.download-if-keyword'
        )
        let downloadIfKeywords = Array.from(keywordsList).map(keyword => {
          const text = keyword.textContent.replace('X', '').trim()
          const [condition, value] = text.split(': ')
          return { condition, value }
        })

        if (downloadIfChecked && downloadIfKeywords.length === 0) {
          alert(
            `Please add at least one keyword for the "Download If" condition in task ${taskId} or uncheck the Download IF URL option.`
          )
          reject()
          return
        }

        const hasContains = downloadIfKeywords.some(
          kw => kw.condition === 'contains'
        )
        const hasNotContains = downloadIfKeywords.some(
          kw => kw.condition === 'not-contains'
        )

        let downloadIfLogic = null

        if (hasContains && hasNotContains) {
          downloadIfLogic =
            taskElement.querySelector(
              `input[name="downloadIfLogic-${taskId}"]:checked`
            )?.value || 'and'
        } else {
          downloadIfLogic = null
        }

        if (!downloadIfChecked) {
          downloadIfKeywords = []
          downloadIfLogic = null
          const downloadIfKeywordsList = taskElement.querySelector(
            `#download-if-keywords-${taskId}`
          )
          const downloadIfLogicDiv = taskElement.querySelector(
            `#download-if-logic-${taskId}`
          )
          downloadIfKeywordsList.innerHTML = ''
          downloadIfLogicDiv.style.display = 'none'
        }

        // Get conversion settings
        const convertCheckbox = taskElement.querySelector(
          `#convert-checkbox-${taskId}`
        )
        const convertFormat = taskElement.querySelector(
          `#convert-format-${taskId}`
        )
        const qualitySlider = taskElement.querySelector(
          `#quality-slider-${taskId}`
        )

        const task = {
          id: taskId,
          urls: taskElement
            .querySelector('.urls')
            .value.split('\n')
            .filter(url => url.trim() !== ''),
          fileTypes: [],
          folderName: taskElement.querySelector('.folderName').value.trim(),
          downloadTime: downloadTimeValue,
          zipDownload: taskElement.querySelector(`#zip-checkbox-${taskId}`)
            .checked,
          status: 'draft', // Always draft for save
          isDraft: true,
          buildCheckbox: taskElement.querySelector(`#build-checkbox-${taskId}`)
            .checked,
          sortableList: sortableListHTML,
          sequenceStart: sequenceStart,
          convert: {
            enabled: convertCheckbox ? convertCheckbox.checked : false,
            format: convertFormat ? convertFormat.value : 'jpeg',
            quality: qualitySlider ? parseInt(qualitySlider.value) : 100
          },
          downloadIf: {
            enabled: downloadIfChecked || false,
            keywords: downloadIfKeywords,
            logic: downloadIfLogic
          },
          watermark: {
            enabled:
              taskElement.querySelector(`#watermark-checkbox-${taskId}`)
                ?.checked || false,
            settings:
              JSON.parse(localStorage.getItem('watermarkAppState')) || null
          }
        }

        const allFormatsCheckbox = taskElement.querySelector(
          `#all-formats-checkbox-${taskId}`
        )
        if (allFormatsCheckbox.checked) {
          task.fileTypes.push('all')
        } else {
          taskElement
            .querySelectorAll(`.file-type-${taskId}:checked`)
            .forEach(checkbox => {
              task.fileTypes.push(checkbox.value)
            })
        }

        tasks.push(task)
      } else {
        // Premium user: save all tasks normally
        for (const taskElement of taskElements) {
          const taskId = taskElement.getAttribute('data-task-id')
          const sortableListHTML = taskElement.querySelector(
            `#sortable-${taskId}`
          ).innerHTML
          const sequenceStartInputElement = taskElement.querySelector(
            `#sequence-start-${taskId}`
          )
          const sequenceStartValue = sequenceStartInputElement
            ? sequenceStartInputElement.value || '1'
            : '1'

          const isSequenceSelected = sortableListHTML
            .toLowerCase()
            .includes('sequence')

          if (
            isSequenceSelected &&
            (isNaN(sequenceStartValue) || sequenceStartValue.trim() === '')
          ) {
            alert('Please enter a valid number for "Start from".')
            reject()
            return
          }

          const downloadTimeValue =
            taskElement.querySelector('.download-time').value

          const sequenceStart = isSequenceSelected ? sequenceStartValue : null

          const downloadIfChecked = taskElement.querySelector(
            `#download-if-checkbox-${taskId}`
          )?.checked

          const keywordsList = taskElement.querySelectorAll(
            '.download-if-keyword'
          )
          let downloadIfKeywords = Array.from(keywordsList).map(keyword => {
            const text = keyword.textContent.replace('X', '').trim()
            const [condition, value] = text.split(': ')
            return { condition, value }
          })

          if (downloadIfChecked && downloadIfKeywords.length === 0) {
            alert(
              `Please add at least one keyword for the "Download If" condition in task ${taskId} or uncheck the Download IF URL option.`
            )
            reject()
            return
          }

          const hasContains = downloadIfKeywords.some(
            kw => kw.condition === 'contains'
          )
          const hasNotContains = downloadIfKeywords.some(
            kw => kw.condition === 'not-contains'
          )

          let downloadIfLogic = null

          if (hasContains && hasNotContains) {
            downloadIfLogic =
              taskElement.querySelector(
                `input[name="downloadIfLogic-${taskId}"]:checked`
              )?.value || 'and'
          } else {
            downloadIfLogic = null
          }

          if (!downloadIfChecked) {
            downloadIfKeywords = []
            downloadIfLogic = null
            const downloadIfKeywordsList = taskElement.querySelector(
              `#download-if-keywords-${taskId}`
            )
            const downloadIfLogicDiv = taskElement.querySelector(
              `#download-if-logic-${taskId}`
            )
            downloadIfKeywordsList.innerHTML = ''
            downloadIfLogicDiv.style.display = 'none'
          }

          // Get conversion settings
          const convertCheckbox = taskElement.querySelector(
            `#convert-checkbox-${taskId}`
          )
          const convertFormat = taskElement.querySelector(
            `#convert-format-${taskId}`
          )
          const qualitySlider = taskElement.querySelector(
            `#quality-slider-${taskId}`
          )

          const task = {
            id: taskId,
            urls: taskElement
              .querySelector('.urls')
              .value.split('\n')
              .filter(url => url.trim() !== ''),
            fileTypes: [],
            folderName: taskElement.querySelector('.folderName').value.trim(),
            downloadTime: downloadTimeValue,
            zipDownload: taskElement.querySelector(`#zip-checkbox-${taskId}`)
              .checked,
            status: 'draft',
            isDraft: true,
            buildCheckbox: taskElement.querySelector(
              `#build-checkbox-${taskId}`
            ).checked,
            sortableList: sortableListHTML,
            sequenceStart: sequenceStart,
            convert: {
              enabled: convertCheckbox ? convertCheckbox.checked : false,
              format: convertFormat ? convertFormat.value : 'jpeg',
              quality: qualitySlider ? parseInt(qualitySlider.value) : 100
            },
            downloadIf: {
              enabled: downloadIfChecked || false,
              keywords: downloadIfKeywords,
              logic: downloadIfLogic
            },
            watermark: {
              enabled:
                taskElement.querySelector(`#watermark-checkbox-${taskId}`)
                  ?.checked || false,
              settings:
                JSON.parse(localStorage.getItem('watermarkAppState')) || null
            }
          }

          const allFormatsCheckbox = taskElement.querySelector(
            `#all-formats-checkbox-${taskId}`
          )
          if (allFormatsCheckbox.checked) {
            task.fileTypes.push('all')
          } else {
            taskElement
              .querySelectorAll(`.file-type-${taskId}:checked`)
              .forEach(checkbox => {
                task.fileTypes.push(checkbox.value)
              })
          }

          tasks.push(task)
        }
      }

      chrome.storage.local.set({ tasks }, function () {
        console.log('Tasks saved as draft:', tasks)
        resolve()
      })
    })
  }

  // Add event listener for the draft save button
  document
    .getElementById('draft-save-btn')
    ?.addEventListener('click', async function () {
      // Check task count first
      const taskCount = await countTasks()
      const licenseCheck = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'validateSession' }, resolve)
      })

      const hasPremiumLicense = licenseCheck?.license?.license_status === 'sold'

      if (!hasPremiumLicense && taskCount > 1) {
        alert(
          'Free version is limited to one task. Please upgrade to premium for unlimited tasks.'
        )
        return
      }

      const draftSaveBtn = document.getElementById('draft-save-btn')
      const originalText = draftSaveBtn.textContent

      // Show saving state
      draftSaveBtn.textContent = 'Saving...'
      draftSaveBtn.disabled = true

      saveTasksAsDraft()
        .then(() => {
          draftSaveBtn.textContent = 'Saved!'
          setTimeout(() => {
            draftSaveBtn.textContent = originalText
            draftSaveBtn.disabled = false
          }, 2000)
        })
        .catch(() => {
          draftSaveBtn.textContent = 'Error!'
          setTimeout(() => {
            draftSaveBtn.textContent = originalText
            draftSaveBtn.disabled = false
          }, 2000)
        })
    })

  function saveOptions () {
    return new Promise(async (resolve, reject) => {
      // First check task count
      const taskCount = await countTasks()
      const licenseCheck = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'validateSession' }, response => {
          if (chrome.runtime.lastError) {
            console.error('License check error:', chrome.runtime.lastError)
            resolve({ valid: false })
          } else {
            resolve(response)
          }
        })
      })

      const hasPremiumLicense = licenseCheck?.license?.license_status === 'sold'

      // Block save if no valid license and have multiple tasks
      if (!hasPremiumLicense && taskCount > 1) {
        alert(
          'Free version is limited to one task. Please upgrade to premium for unlimited tasks.'
        )
        // loadingSpinnerImg is created later; remove only if defined
        const loadingSpinnerImg = document.querySelector(
          'img[src="images/loading.gif"]'
        )
        if (loadingSpinnerImg) loadingSpinnerImg.remove()
        reject('Task limit exceeded')
        return
      }

      const saveOptionsBtn = document.getElementById('save-options-btn')
      const loadingSpinnerImg = document.createElement('img')
      loadingSpinnerImg.src = 'images/loading.gif'
      loadingSpinnerImg.width = '50'
      loadingSpinnerImg.height = '50'
      loadingSpinnerImg.style.padding = '10px'
      loadingSpinnerImg.style.verticalAlign = 'middle'
      saveOptionsBtn.parentNode.insertBefore(
        loadingSpinnerImg,
        saveOptionsBtn.nextSibling
      )

      const isExpired = licenseCheck?.license?.license_status === 'expired'
      const tasks = []
      const taskElements = document.querySelectorAll('.task')
      let invalidDateTime = false
      let invalidWatermarkTasks = []

      let isQueuedDownloadActive = false
      try {
        const storageData = await new Promise(resolve => {
          chrome.storage.local.get(['isQueuedDownload'], resolve)
        })
        isQueuedDownloadActive = storageData.isQueuedDownload || false
      } catch (error) {
        console.error('Error reading queued download state:', error)
        isQueuedDownloadActive = document.getElementById(
          'queuedDownloadToggle'
        ).checked
      }

      // Validate watermark and enforce URL limits as before
      taskElements.forEach(taskElement => {
        const taskId = taskElement.getAttribute('data-task-id')

        const watermarkCheckbox = taskElement.querySelector(
          `#watermark-checkbox-${taskId}`
        )
        watermarkCheckbox.addEventListener('change', function () {
          if (this.checked) {
            const watermarkSettings = JSON.parse(
              localStorage.getItem('watermarkAppState')
            )
            if (!hasValidWatermarkSettings(watermarkSettings)) {
              const proceed = confirm(
                'Watermark settings are not configured.\n\nWould you like to go to the Watermark tab to configure them now?'
              )
              if (proceed) {
                document.querySelector('.watermark-tab-button').click()
              }
              this.checked = false
            }
          }
        })

        if (watermarkCheckbox?.checked) {
          const watermarkSettings = JSON.parse(
            localStorage.getItem('watermarkAppState')
          )
          if (!watermarkSettings || !watermarkSettings.watermarkImage) {
            invalidWatermarkTasks.push(taskId)
          }
        }

        const urls = taskElement
          .querySelector('.urls')
          .value.split('\n')
          .filter(url => url.trim() !== '')

        if (!hasPremiumLicense && urls.length > MAX_URLS) {
          const maxAllowed = MAX_URLS
          const limitedUrls = urls.slice(0, maxAllowed)
          taskElement.querySelector('.urls').value = limitedUrls.join('\n')
          const urlCountDiv = taskElement.querySelector(`#url-count-${taskId}`)
          urlCountDiv.textContent = `URL count: ${maxAllowed} (${
            isExpired ? 'Expired license' : 'Free version'
          } limit per download)`

          if (isExpired && document.querySelector('.licenseInfo')) {
            showLicenseMessage('⚠️ License expired - renew for unlimited URLs')
          }
        }
      })

      if (invalidWatermarkTasks.length > 0) {
        alert(
          `The following tasks have watermark enabled but no settings configured:\n\n${invalidWatermarkTasks.join(
            ', '
          )}\n\nPlease either:\n1. Configure your watermark settings in the Watermark tab\nOR\n2. Disable watermark for these tasks`
        )
        loadingSpinnerImg.remove()
        reject()
        return
      }

      // --- Modified section starts here ---

      if (!hasPremiumLicense) {
        // Save only the first task (default task) for free or expired users
        if (taskElements.length > 0) {
          const taskElement = taskElements[0]
          const taskId = taskElement.getAttribute('data-task-id')
          const sortableListHTML = taskElement.querySelector(
            `#sortable-${taskId}`
          ).innerHTML
          const sequenceStartInputElement = taskElement.querySelector(
            `#sequence-start-${taskId}`
          )
          const sequenceStartValue = sequenceStartInputElement
            ? sequenceStartInputElement.value || '1'
            : '1'

          const isSequenceSelected = sortableListHTML
            .toLowerCase()
            .includes('sequence')

          if (
            isSequenceSelected &&
            (isNaN(sequenceStartValue) || sequenceStartValue.trim() === '')
          ) {
            alert('Please enter a valid number for "Start from".')
            loadingSpinnerImg.remove()
            reject()
            return
          }

          const downloadTimeValue =
            taskElement.querySelector('.download-time').value
          const downloadTime = new Date(downloadTimeValue).getTime()
          const currentTime = new Date().getTime()
          let status = 'pending'
          if (
            !downloadTimeValue ||
            isNaN(downloadTime) ||
            (!isQueuedDownloadActive && currentTime > downloadTime)
          ) {
            invalidDateTime = true
          }

          const sequenceStart = isSequenceSelected ? sequenceStartValue : null

          const downloadIfChecked = taskElement.querySelector(
            `#download-if-checkbox-${taskId}`
          )?.checked

          const keywordsList = taskElement.querySelectorAll(
            '.download-if-keyword'
          )
          let downloadIfKeywords = Array.from(keywordsList).map(keyword => {
            const text = keyword.textContent.replace('X', '').trim()
            const [condition, value] = text.split(': ')
            return { condition, value }
          })

          if (downloadIfChecked && downloadIfKeywords.length === 0) {
            alert(
              `Please add at least one keyword for the "Download If" condition in task ${taskId} or uncheck the Download IF URL option.`
            )
            loadingSpinnerImg.remove()
            reject()
            return
          }

          const hasContains = downloadIfKeywords.some(
            kw => kw.condition === 'contains'
          )
          const hasNotContains = downloadIfKeywords.some(
            kw => kw.condition === 'not-contains'
          )

          let downloadIfLogic = null

          if (hasContains && hasNotContains) {
            downloadIfLogic =
              taskElement.querySelector(
                `input[name="downloadIfLogic-${taskId}"]:checked`
              )?.value || 'and'
          } else {
            downloadIfLogic = null
          }

          if (!downloadIfChecked) {
            downloadIfKeywords = []
            downloadIfLogic = null
            const downloadIfKeywordsList = taskElement.querySelector(
              `#download-if-keywords-${taskId}`
            )
            const downloadIfLogicDiv = taskElement.querySelector(
              `#download-if-logic-${taskId}`
            )
            downloadIfKeywordsList.innerHTML = ''
            downloadIfLogicDiv.style.display = 'none'
          }

          // Get conversion settings
          const convertCheckbox = taskElement.querySelector(
            `#convert-checkbox-${taskId}`
          )
          const convertFormat = taskElement.querySelector(
            `#convert-format-${taskId}`
          )
          const qualitySlider = taskElement.querySelector(
            `#quality-slider-${taskId}`
          )

          const task = {
            id: taskId,
            urls: taskElement
              .querySelector('.urls')
              .value.split('\n')
              .filter(url => url.trim() !== ''),
            fileTypes: [],
            folderName: taskElement.querySelector('.folderName').value.trim(),
            downloadTime: downloadTimeValue,
            zipDownload: taskElement.querySelector(`#zip-checkbox-${taskId}`)
              .checked,
            status: status,
            buildCheckbox: taskElement.querySelector(
              `#build-checkbox-${taskId}`
            ).checked,
            sortableList: sortableListHTML,
            sequenceStart: sequenceStart,
            convert: {
              enabled: convertCheckbox ? convertCheckbox.checked : false,
              format: convertFormat ? convertFormat.value : 'jpeg',
              quality: qualitySlider ? parseInt(qualitySlider.value) : 100
            },
            downloadIf: {
              enabled: downloadIfChecked || false,
              keywords: downloadIfKeywords,
              logic: downloadIfLogic
            },
            watermark: {
              enabled:
                taskElement.querySelector(`#watermark-checkbox-${taskId}`)
                  ?.checked || false,
              settings:
                JSON.parse(localStorage.getItem('watermarkAppState')) || null
            }
          }

          const allFormatsCheckbox = taskElement.querySelector(
            `#all-formats-checkbox-${taskId}`
          )
          if (allFormatsCheckbox.checked) {
            task.fileTypes.push('all')
          } else {
            taskElement
              .querySelectorAll(`.file-type-${taskId}:checked`)
              .forEach(checkbox => {
                task.fileTypes.push(checkbox.value)
              })
          }

          tasks.push(task)
        }
      } else {
        // Premium users save all tasks normally
        taskElements.forEach(taskElement => {
          const taskId = taskElement.getAttribute('data-task-id')
          const sortableListHTML = taskElement.querySelector(
            `#sortable-${taskId}`
          ).innerHTML
          const sequenceStartInputElement = taskElement.querySelector(
            `#sequence-start-${taskId}`
          )
          const sequenceStartValue = sequenceStartInputElement
            ? sequenceStartInputElement.value || '1'
            : '1'

          const isSequenceSelected = sortableListHTML
            .toLowerCase()
            .includes('sequence')

          if (
            isSequenceSelected &&
            (isNaN(sequenceStartValue) || sequenceStartValue.trim() === '')
          ) {
            alert('Please enter a valid number for "Start from".')
            loadingSpinnerImg.remove()
            reject()
            return
          }

          const downloadTimeValue =
            taskElement.querySelector('.download-time').value
          const downloadTime = new Date(downloadTimeValue).getTime()
          const currentTime = new Date().getTime()
          let status = 'pending'

          if (
            !downloadTimeValue ||
            isNaN(downloadTime) ||
            (!isQueuedDownloadActive && currentTime > downloadTime)
          ) {
            invalidDateTime = true
          }

          const sequenceStart = isSequenceSelected ? sequenceStartValue : null

          const downloadIfChecked = taskElement.querySelector(
            `#download-if-checkbox-${taskId}`
          )?.checked

          const keywordsList = taskElement.querySelectorAll(
            '.download-if-keyword'
          )
          let downloadIfKeywords = Array.from(keywordsList).map(keyword => {
            const text = keyword.textContent.replace('X', '').trim()
            const [condition, value] = text.split(': ')
            return { condition, value }
          })

          if (downloadIfChecked && downloadIfKeywords.length === 0) {
            alert(
              `Please add at least one keyword for the "Download If" condition in task ${taskId} or uncheck the Download IF URL option.`
            )
            loadingSpinnerImg.remove()
            reject()
            return
          }

          const hasContains = downloadIfKeywords.some(
            kw => kw.condition === 'contains'
          )
          const hasNotContains = downloadIfKeywords.some(
            kw => kw.condition === 'not-contains'
          )

          let downloadIfLogic = null

          if (hasContains && hasNotContains) {
            downloadIfLogic =
              taskElement.querySelector(
                `input[name="downloadIfLogic-${taskId}"]:checked`
              )?.value || 'and'
          } else {
            downloadIfLogic = null
          }

          if (!downloadIfChecked) {
            downloadIfKeywords = []
            downloadIfLogic = null
            const downloadIfKeywordsList = taskElement.querySelector(
              `#download-if-keywords-${taskId}`
            )
            const downloadIfLogicDiv = taskElement.querySelector(
              `#download-if-logic-${taskId}`
            )
            downloadIfKeywordsList.innerHTML = ''
            downloadIfLogicDiv.style.display = 'none'
          }

          const convertCheckbox = taskElement.querySelector(
            `#convert-checkbox-${taskId}`
          )
          const convertFormat = taskElement.querySelector(
            `#convert-format-${taskId}`
          )
          const qualitySlider = taskElement.querySelector(
            `#quality-slider-${taskId}`
          )

          const task = {
            id: taskId,
            urls: taskElement
              .querySelector('.urls')
              .value.split('\n')
              .filter(url => url.trim() !== ''),
            fileTypes: [],
            folderName: taskElement.querySelector('.folderName').value.trim(),
            downloadTime: downloadTimeValue,
            zipDownload: taskElement.querySelector(`#zip-checkbox-${taskId}`)
              .checked,
            status: status,
            buildCheckbox: taskElement.querySelector(
              `#build-checkbox-${taskId}`
            ).checked,
            sortableList: sortableListHTML,
            sequenceStart: sequenceStart,
            convert: {
              enabled: convertCheckbox ? convertCheckbox.checked : false,
              format: convertFormat ? convertFormat.value : 'jpeg',
              quality: qualitySlider ? parseInt(qualitySlider.value) : 100
            },
            downloadIf: {
              enabled: downloadIfChecked || false,
              keywords: downloadIfKeywords,
              logic: downloadIfLogic
            },
            watermark: {
              enabled:
                taskElement.querySelector(`#watermark-checkbox-${taskId}`)
                  ?.checked || false,
              settings:
                JSON.parse(localStorage.getItem('watermarkAppState')) || null
            }
          }

          const allFormatsCheckbox = taskElement.querySelector(
            `#all-formats-checkbox-${taskId}`
          )
          if (allFormatsCheckbox.checked) {
            task.fileTypes.push('all')
          } else {
            taskElement
              .querySelectorAll(`.file-type-${taskId}:checked`)
              .forEach(checkbox => {
                task.fileTypes.push(checkbox.value)
              })
          }

          tasks.push(task)
        })
      }
      if (!isQueuedDownloadActive) {
        if (invalidDateTime) {
          alert(
            "Please select a valid date and time in the future or make sure there doesn't exist a task with a date in the past. Or just enable the Queued Download option at the top to avoid the need for scheduled downloads"
          )
          loadingSpinnerImg.remove()
          reject()
          return
        }
      }

      chrome.storage.local.set({ tasks }, function () {
        if (isQueuedDownloadActive) {
          executeTasksInSequence()
        }

        setTimeout(() => {
          loadingSpinnerImg.remove()
          resolve()
        }, 1000)
      })
    })
  }

  // Helper function for license messages (added if not existing)
  function showLicenseMessage (text) {
    const licenseInfo = document.querySelector('.licenseInfo')
    if (!licenseInfo) return

    // Create or update license message in the dedicated license info area
    let msg = licenseInfo.querySelector('.license-message')
    if (!msg) {
      msg = document.createElement('div')
      msg.className = 'license-message'
      licenseInfo.appendChild(msg)
    }
    msg.innerHTML = `<p>${text} <a href="${BASE_URL}/shop/" target="_blank">Renew</a></p>`

    // Ensure this doesn't affect the URL count display
    const urlCounts = document.querySelectorAll('.url-count')
    urlCounts.forEach(count => {
      count.style.display = 'block' // Ensure URL counts remain visible
    })
  }
  // Your dockedSaveButton event listener
  document
    .getElementById('dockedSaveButton')
    .addEventListener('click', function () {
      const saveButton = document.getElementById('dockedSaveButton')
      const loadingImage = document.getElementById('loadingImage')

      // Hide save button and show loading image
      saveButton.style.display = 'none'
      loadingImage.style.display = 'inline-block'

      // Call saveOptions and ensure button reverts back afterward
      saveOptions()
        .then(() => {
          //console.log("Options saved successfully");
        })
        .catch(error => {
          console.error('Error saving options:', error)
        })
        .finally(() => {
          // This will execute regardless of success or failure
          loadingImage.style.display = 'none' // Hide loading image
          saveButton.style.display = 'inline-block' // Show save button again
        })
    })

  //Delete all tasks

  document
    .getElementById('removeAllTasksButton')
    .addEventListener('click', function () {
      const removeIcon = document.getElementById('removeIcon')

      // Show confirmation dialog
      const confirmDelete = confirm(
        'Are you sure you want to delete all tasks?'
      )
      if (confirmDelete) {
        // Remove all tasks logic
        chrome.storage.local.set({ tasks: [] }, function () {
          //console.log("All tasks deleted.");

          // Optionally, remove task elements from the DOM
          const taskContainer = document.getElementById('tasks-container')
          while (taskContainer.firstChild) {
            taskContainer.removeChild(taskContainer.firstChild)
          }

          alert('All tasks have been deleted.')
        })
      }
    })

  function areTasksEqual (task1, task2) {
    return JSON.stringify(task1) === JSON.stringify(task2)
  }

  function executePendingTasks (tasks) {
    tasks.forEach(task => {
      if (
        task.status === 'pending' &&
        !task.isDraft && // Optional: Extra safeguard if using isDraft flag
        isDownloadTimeReached(task.downloadTime)
      ) {
        task.status = 'inProgress'
        saveUpdatedTask(task)
        downloadFiles(task)
      }
    })
  }

  function isDownloadTimeReached (downloadTime) {
    const currentTime = new Date().getTime()
    const selectedTime = new Date(downloadTime).getTime()
    return currentTime >= selectedTime
  }

  async function convertImage (blob, targetFormat, quality) {
    try {
      // First convert blob to File if it isn't already
      const file =
        blob instanceof File
          ? blob
          : new File([blob], 'image', { type: blob.type })

      // Convert based on target format
      switch (targetFormat) {
        case 'jpeg':
          return await imageConversion.compress(file, {
            type: 'image/jpeg',
            quality: quality / 100
          })
        case 'png':
          return await imageConversion.compress(file, {
            type: 'image/png',
            quality: quality / 100
          })
        case 'webp':
          return await imageConversion.compress(file, {
            type: 'image/webp',
            quality: quality / 100
          })
        default:
          return blob // Return original if format not recognized
      }
    } catch (error) {
      console.error('Image conversion error:', error)
      throw error
    }
  }

  function hasValidWatermarkSettings (watermarkSettings) {
    return (
      watermarkSettings &&
      watermarkSettings.watermarkImage &&
      watermarkSettings.opacity &&
      watermarkSettings.maxWatermarkSize &&
      watermarkSettings.gravity &&
      watermarkSettings.margin
    )
  }

  async function downloadFiles (task) {
    // Check watermark settings if watermark is enabled
    if (task.watermark?.enabled) {
      const watermarkSettings = JSON.parse(
        localStorage.getItem('watermarkAppState')
      )
      if (!hasValidWatermarkSettings(watermarkSettings)) {
        alert(
          'Watermark is enabled but settings are not configured.\n\nPlease either:\n1. Go to the Watermark tab and configure your settings\nOR\n2. Uncheck the Watermark checkbox in this task'
        )
        updateProgress(task.id, 0)
        task.status = 'pending' // Reset status
        await saveUpdatedTask(task)
        return
      }
      task.watermark.settings = watermarkSettings // Store settings in task
    }

    if (
      !task.urls ||
      task.urls.length === 0 ||
      task.urls.every(url => url.trim() === '')
    ) {
      console.log('No URLs to download for task', task.id)
      updateProgress(task.id, 100)
      task.status = 'completed'
      await saveUpdatedTask(task)
      return
    }

    const filenameMap = new Map() // To track duplicate filenames
    const filteredUrls = task.urls.filter(url =>
      passesFilter(task, extractFilename(url), url)
    )
    let totalFiles = filteredUrls.length
    let filesDownloaded = 0
    let failedDownloads = []
    let downloadPromises = []
    let activeDownloads = 0
    const MAX_PARALLEL_DOWNLOADS = 5 // Number of parallel downloads
    let currentSequence = parseInt(task.sequenceStart || '1', 10)

    // Function to process a single URL
    async function processUrl (url) {
      try {
        // Validate URL first
        if (!isValidUrl(url)) {
          throw new Error(`Invalid URL: ${url}`)
        }

        let response
        try {
          response = await fetch(url, {
            mode: 'no-cors',
            credentials: 'omit'
          })

          if (response.type === 'opaque') {
            // We can't read the response, but we can try to download it
          } else if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
        } catch (fetchError) {
          // If fetch fails, try a direct download without processing
          console.warn(
            `Fetch failed for ${url}, attempting direct download`,
            fetchError
          )
          try {
            await new Promise((resolve, reject) => {
              chrome.downloads.download(
                {
                  url: url,
                  conflictAction: 'uniquify',
                  saveAs: false
                },
                function (downloadId) {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError)
                  } else {
                    resolve()
                  }
                }
              )
            })
            return
          } catch (downloadError) {
            console.error(
              `Direct download also failed for ${url}:`,
              downloadError
            )
            throw downloadError
          }
        }

        let blob
        try {
          blob = await response.blob()

          // ===== WATERMARK INTEGRATION START =====
          if (task.watermark?.enabled && task.watermark.settings) {
            try {
              blob = await applyWatermark(blob, task.watermark.settings)
            } catch (watermarkError) {
              console.error(
                'Watermark application failed, using original image:',
                watermarkError
              )
            }
          }
          // ===== WATERMARK INTEGRATION END =====

          let extension = extractExtensionFromUrl(url)

          // Convert image if enabled
          if (task.convert?.enabled) {
            try {
              // Create off-screen canvas for conversion
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')

              // Create image from blob
              const img = await createImageBitmap(blob)
              canvas.width = img.width
              canvas.height = img.height
              ctx.drawImage(img, 0, 0)

              // Determine output format and quality
              let mimeType
              switch (task.convert.format) {
                case 'jpeg':
                  mimeType = 'image/jpeg'
                  extension = 'jpg'
                  break
                case 'png':
                  mimeType = 'image/png'
                  extension = 'png'
                  break
                case 'webp':
                  mimeType = 'image/webp'
                  extension = 'webp'
                  break
                default:
                  mimeType = 'image/jpeg'
                  extension = 'jpg'
              }

              // Convert to new format
              blob = await new Promise(resolve => {
                canvas.toBlob(
                  convertedBlob => {
                    resolve(convertedBlob || blob) // Fallback to original if conversion fails
                  },
                  mimeType,
                  task.convert.quality / 100
                )
              })
            } catch (conversionError) {
              console.error(
                'Conversion failed, using original:',
                conversionError
              )
              // Continue with original blob if conversion fails
            }
          }

          // If no valid extension from URL, try to get extension from content-type
          if (!extension && response.headers) {
            let contentType = response.headers.get('content-type')
            if (contentType && contentType.startsWith('image/')) {
              extension = contentType.split('/')[1].toLowerCase() // Extract extension from content-type
            }
          }

          // Fallback to default 'bin' extension if no valid extension found
          if (!extension) {
            extension = 'bin'
          }

          // Extract cleaned filename without extension
          let filename = extractFilename(url)
          let filenameWithoutExtension =
            filename.substring(0, filename.lastIndexOf('.')) || filename

          // Handle duplicate filenames and append sequence numbers
          if (filenameMap.has(filenameWithoutExtension)) {
            let duplicateCount = filenameMap.get(filenameWithoutExtension) + 1
            filenameMap.set(filenameWithoutExtension, duplicateCount)
            filenameWithoutExtension += `-${duplicateCount}`
          } else {
            filenameMap.set(filenameWithoutExtension, 0) // First occurrence
          }

          // Handle filename construction if the build checkbox is checked
          let filePath
          if (task.buildCheckbox) {
            const sortableList = task.sortableList
            const parser = new DOMParser()
            const doc = parser.parseFromString(sortableList, 'text/html')
            const listItems = doc.querySelectorAll('.ui-state-default')
            const values = Array.from(listItems)
              .map(item => {
                const content = Array.from(item.childNodes)
                  .filter(node => node.nodeName !== 'BUTTON')
                  .map(node => node.textContent.trim())
                  .join('')
                return content
              })
              .filter(value => value !== '.extension') // Ignore the ".extension" item

            // Only use custom filename construction if there are actually items selected
            if (values.length > 0) {
              // Define dynamic actions for keywords
              const sequenceLength = (task.sequenceStart || '1').length
              const paddedSequence = currentSequence
                .toString()
                .padStart(sequenceLength, '0') // Pad the sequence number

              const keywordActions = {
                filename: () => filenameWithoutExtension,
                sequence: () => paddedSequence, // Use padded sequence
                timestamp: () => Date.now(),
                urlfragments: () => {
                  const parsedUrl = new URL(url)
                  const pathname = parsedUrl.pathname
                  // Split path into segments and remove empty segments
                  const segments = pathname
                    .split('/')
                    .filter(segment => segment.trim() !== '')
                  // Remove the last segment (filename) if it contains an extension
                  if (segments.length > 0) {
                    const lastSegment = segments[segments.length - 1]
                    if (lastSegment.includes('.')) {
                      segments.pop() // Remove the filename segment
                    }
                  }
                  return segments.join('-')
                },
                website: () => new URL(url).hostname.replace(/\./g, '-'),
                shortuuid: () => generateShortUUID(), // Add shortuuid action
                segment: index => {
                  const segments = splitUrl(url)
                  return segments[index] || ''
                }
              }

              // Build filename dynamically
              let constructedFilename = ''
              values.forEach(value => {
                if (value.startsWith('Segment')) {
                  const index = parseInt(value.split(' ')[1], 10) - 1
                  constructedFilename += keywordActions['segment'](index)
                } else if (keywordActions[value.toLowerCase()]) {
                  constructedFilename += keywordActions[value.toLowerCase()]()
                } else {
                  constructedFilename += value
                }
              })

              let newFilename = `${task.prefix || ''}${constructedFilename}${
                task.suffix || ''
              }.${extension}`
              filePath = task.folderName
                ? `${task.folderName}/${newFilename}`
                : newFilename
            } else {
              // Fallback to default filename if no items are selected
              let newFilename = `${
                task.prefix || ''
              }${filenameWithoutExtension}${task.suffix || ''}.${extension}`
              filePath = task.folderName
                ? `${task.folderName}/${newFilename}`
                : newFilename
            }
          } else {
            // Default handling without file builder
            let newFilename = `${task.prefix || ''}${filenameWithoutExtension}${
              task.suffix || ''
            }.${extension}`
            filePath = task.folderName
              ? `${task.folderName}/${newFilename}`
              : newFilename
          }

          if (
            task.fileTypes.includes(extension.toLowerCase()) ||
            task.fileTypes.includes('all')
          ) {
            // Create object URL for download
            const blobUrl = URL.createObjectURL(blob)
            await new Promise((resolve, reject) => {
              chrome.downloads.download(
                {
                  url: blobUrl,
                  filename: filePath,
                  conflictAction: 'uniquify',
                  saveAs: false
                },
                function (downloadId) {
                  if (chrome.runtime.lastError) {
                    URL.revokeObjectURL(blobUrl)
                    reject(chrome.runtime.lastError)
                  } else {
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
                    resolve()
                  }
                }
              )
            })
          }

          currentSequence++ // Increment the sequence for the next file
        } catch (error) {
          console.error('Error processing file:', url, error)
          throw error
        }
      } catch (error) {
        console.error('Error processing file:', url, error)
        throw error
      }
    }

    // Process URLs in batches
    for (let i = 0; i < filteredUrls.length; i += MAX_PARALLEL_DOWNLOADS) {
      const batch = filteredUrls.slice(i, i + MAX_PARALLEL_DOWNLOADS)

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(url =>
          processUrl(url).catch(error => {
            failedDownloads.push(url)
            return Promise.reject(error)
          })
        )
      )

      // Update progress
      filesDownloaded += batchResults.length
      updateProgress(task.id, Math.round((filesDownloaded / totalFiles) * 100))
    }

    // Create a report of failed downloads if any
    if (failedDownloads.length > 0) {
      const failReport = `Failed to download ${
        failedDownloads.length
      } files:\n\n${failedDownloads.join('\n')}`
      const blob = new Blob([failReport], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      chrome.downloads.download({
        url: url,
        filename: `download_errors_task_${task.id}.txt`,
        conflictAction: 'uniquify',
        saveAs: false
      })
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    // If no images were downloaded, download README_no_images_message.txt
    if (filesDownloaded === 0) {
      const noImagesMessage =
        `Task ID: ${task.id} - No images could be downloaded. Possible reasons:\n` +
        `1. No images match selected image formats\n` +
        `2. All download attempts failed\n` +
        `3. URLs were invalid\n\n` +
        `Try selecting the "All formats" option or checking your URLs. If you have other image download extensions try temporarily disabling them.`
      const blob = new Blob([noImagesMessage], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      chrome.downloads.download({
        url: url,
        filename: `README_no_images_message_${task.id}.txt`,
        conflictAction: 'uniquify',
        saveAs: false
      })
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    // Update the task status to "completed"
    task.status = 'completed'
    await saveUpdatedTask(task)
    updateProgress(task.id, 100)
  }

  // Helper function to validate URLs
  function isValidUrl (url) {
    try {
      new URL(url)
      return true
    } catch (e) {
      return false
    }
  }

  // Helper Function to Apply Filtering Logic:
  function passesFilter (task, filename, url) {
    if (!task.downloadIf || !task.downloadIf.enabled) {
      //console.log(`No filtering enabled for URL "${url}". Passing by default.`);
      return true // No filtering is enabled, pass by default
    }

    const keywords = task.downloadIf.keywords || []
    const logic = task.downloadIf.logic

    // Check for the presence of "contains" and "not-contains" keywords
    const containsKeywords = keywords.filter(
      keyword => keyword.condition === 'contains'
    )
    const notContainsKeywords = keywords.filter(
      keyword => keyword.condition === 'not-contains'
    )

    // "Contains" logic: Check if URL contains any keyword marked with "contains"
    const containsCondition = containsKeywords.some(keyword =>
      url.includes(keyword.value)
    ) // At least one "contains" keyword should be present in the URL

    // "Not contains" logic: Check if URL does not contain any keyword marked with "not-contains"
    const notContainsCondition = notContainsKeywords.every(
      keyword => !url.includes(keyword.value)
    ) // None of the "not-contains" keywords should be in the URL

    //console.log(`Contains condition for URL "${url}": ${containsCondition}`);
    //console.log(`Not contains condition for URL "${url}": ${notContainsCondition}`);

    // Handle cases where only one type of condition is present
    if (containsKeywords.length > 0 && notContainsKeywords.length === 0) {
      // Only "contains" condition present
      return containsCondition
    } else if (
      notContainsKeywords.length > 0 &&
      containsKeywords.length === 0
    ) {
      // Only "not-contains" condition present
      return notContainsCondition
    }

    // If both "contains" and "not-contains" are present, handle the logic based on "and"/"or"
    if (containsKeywords.length > 0 && notContainsKeywords.length > 0) {
      if (logic === 'and') {
        // Both conditions must be satisfied for "and"
        return containsCondition && notContainsCondition
      } else if (logic === 'or') {
        // Either condition must be satisfied for "or"
        return containsCondition || notContainsCondition
      }
    }

    return false // Default case, if no valid condition is met
  }

  function extractExtensionFromUrl (url) {
    // First check if the URL is empty or invalid
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return null
    }

    try {
      const validImageFormats = [
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
        'tif',
        'txt'
      ]

      // Extract extension using regex first
      const match = url.match(/\.(\w+)(?:[\?#]|$)/)
      let extension = match ? match[1].toLowerCase() : null

      if (extension && validImageFormats.includes(extension)) {
        return extension
      }

      // Attempt to normalize URL for parsing
      let normalizedUrl = url

      // If the URL does not have a protocol, prepend a dummy one
      if (!/^https?:\/\//i.test(url)) {
        normalizedUrl = 'http://dummy.com/' + url.replace(/^\/+/, '')
      }

      const parsedUrl = new URL(normalizedUrl)
      const lastSegment = parsedUrl.pathname
        .split('/')
        .pop()
        .split('?')[0]
        .split('!')[0]
        .split('#')[0]

      const dotIndex = lastSegment.lastIndexOf('.')
      if (dotIndex !== -1 && dotIndex < lastSegment.length - 1) {
        extension = lastSegment.substring(dotIndex + 1).toLowerCase()

        if (validImageFormats.includes(extension)) {
          return extension
        }
      }

      return null
    } catch (error) {
      console.error('Invalid URL format:', error)
      return null
    }
  }

  // Helper function to extract filename and clean unnecessary parts after the extension
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

    // Extract the last segment after the last "/"
    const lastSegment = url.substring(url.lastIndexOf('/') + 1)
    // Clean up query parameters and fragments from the filename
    const filenameWithParams = lastSegment.split('?')[0].split('!')[0]

    // Check for valid file formats in the filename
    for (let format of validImageFormats) {
      if (filenameWithParams.toLowerCase().endsWith(`.${format}`)) {
        // Return the filename up to the extension
        return filenameWithParams.substring(
          0,
          filenameWithParams.toLowerCase().lastIndexOf(`.${format}`)
        )
      }
    }

    // If no valid format is found, return the filename up to the last period
    const dotIndex = filenameWithParams.lastIndexOf('.')
    if (dotIndex > 0) {
      return filenameWithParams.substring(0, dotIndex) // Strip out the extension
    }

    return filenameWithParams // Return the entire segment if no valid extension
  }

  // ZIP download function with download complete tracking
  async function downloadZip (task) {
    // Check watermark settings if watermark is enabled
    if (task.watermark?.enabled) {
      const watermarkSettings = JSON.parse(
        localStorage.getItem('watermarkAppState')
      )
      if (!hasValidWatermarkSettings(watermarkSettings)) {
        alert(
          'Watermark is enabled but settings are not configured.\n\nPlease either:\n1. Go to the Watermark tab and configure your settings\nOR\n2. Uncheck the Watermark checkbox in this task'
        )
        updateProgress(task.id, 0)
        task.status = 'pending' // Reset status
        await saveUpdatedTask(task)
        return
      }
      task.watermark.settings = watermarkSettings // Store settings in task
    }

    // Validate inputs
    if (
      !task.urls ||
      task.urls.length === 0 ||
      task.urls.every(url => url.trim() === '')
    ) {
      console.log('No URLs to zip for task', task.id)
      updateProgress(task.id, 100)
      task.status = 'completed'
      await saveUpdatedTask(task)
      return
    }

    const zip = new JSZip()
    const controller = new AbortController()
    const fetchOptions = { signal: controller.signal }
    const filenameMap = new Map()
    const filteredUrls = task.urls.filter(url =>
      passesFilter(task, extractFilename(url), url)
    )
    let filesProcessed = 0
    let imagesDownloaded = false
    let currentSequence = parseInt(task.sequenceStart || '1', 10)

    // Set initial task state
    task.status = 'inProgress'
    await saveUpdatedTask(task)

    // Process files in parallel with controlled concurrency
    try {
      await processInBatches(filteredUrls, 5, async url => {
        try {
          let response = await fetch(url, fetchOptions)
          if (!response.ok) throw new Error(`HTTP ${response.status}`)

          // Get file extension from content-type or URL
          const contentType = response.headers.get('content-type') || ''
          let extension = (
            contentType.split('/')[1] ||
            extractExtensionFromUrl(url) ||
            'bin'
          )
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')

          // Get the blob
          let blob = await response.blob()

          // Apply watermark if enabled
          if (task.watermark?.enabled && task.watermark.settings) {
            try {
              blob = await applyWatermark(blob, task.watermark.settings)
            } catch (watermarkError) {
              console.error(
                'Watermark application failed, using original image:',
                watermarkError
              )
            }
          }

          // Process image conversion if enabled
          let finalExtension = extension
          if (task.convert?.enabled) {
            try {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              const img = await createImageBitmap(blob)
              canvas.width = img.width
              canvas.height = img.height
              ctx.drawImage(img, 0, 0)

              let mimeType
              switch (task.convert.format) {
                case 'jpeg':
                  mimeType = 'image/jpeg'
                  finalExtension = 'jpg'
                  break
                case 'png':
                  mimeType = 'image/png'
                  finalExtension = 'png'
                  break
                case 'webp':
                  mimeType = 'image/webp'
                  finalExtension = 'webp'
                  break
                default:
                  mimeType = 'image/jpeg'
                  finalExtension = 'jpg'
              }

              blob = await new Promise(resolve => {
                canvas.toBlob(
                  convertedBlob => {
                    resolve(convertedBlob || blob)
                  },
                  mimeType,
                  task.convert.quality / 100
                )
              })
            } catch (conversionError) {
              console.error(
                'Conversion failed, using original:',
                conversionError
              )
            }
          }

          // Generate filename based on construction options
          let filename
          if (task.buildCheckbox && task.sortableList) {
            // Build filename using construction options
            const parser = new DOMParser()
            const doc = parser.parseFromString(task.sortableList, 'text/html')
            const listItems = doc.querySelectorAll('.ui-state-default')
            const values = Array.from(listItems)
              .map(item => {
                const content = Array.from(item.childNodes)
                  .filter(node => node.nodeName !== 'BUTTON')
                  .map(node => node.textContent.trim())
                  .join('')
                return content
              })
              .filter(value => value !== '.extension')

            // Only use custom filename if there are actually items selected
            if (values.length > 0) {
              // Define dynamic actions for keywords
              const sequenceLength = (task.sequenceStart || '1').length
              const paddedSequence = currentSequence
                .toString()
                .padStart(sequenceLength, '0')

              const keywordActions = {
                filename: () => extractFilename(url).replace(/\.[^/.]+$/, ''),
                sequence: () => paddedSequence,
                timestamp: () => Date.now(),
                urlfragments: () => {
                  const parsedUrl = new URL(url)
                  const pathname = parsedUrl.pathname
                  const segments = pathname
                    .split('/')
                    .filter(segment => segment.trim() !== '')
                  if (segments.length > 0) {
                    const lastSegment = segments[segments.length - 1]
                    if (lastSegment.includes('.')) {
                      segments.pop()
                    }
                  }
                  return segments.join('-')
                },
                website: () => new URL(url).hostname.replace(/\./g, '-'),
                shortuuid: () => generateShortUUID(),
                segment: index => {
                  const segments = splitUrl(url)
                  return segments[index] || ''
                }
              }

              // Build filename dynamically
              let constructedFilename = ''
              values.forEach(value => {
                if (value.startsWith('Segment')) {
                  const index = parseInt(value.split(' ')[1], 10) - 1
                  constructedFilename += keywordActions['segment'](index)
                } else if (keywordActions[value.toLowerCase()]) {
                  constructedFilename += keywordActions[value.toLowerCase()]()
                } else {
                  constructedFilename += value
                }
              })

              filename = `${constructedFilename}.${finalExtension}`
              currentSequence++ // Increment sequence for next file
            } else {
              // Fallback to default filename if no items are selected
              const baseName = extractFilename(url).replace(/\.[^/.]+$/, '')

              // Handle duplicates
              if (filenameMap.has(baseName)) {
                const count = filenameMap.get(baseName) + 1
                filenameMap.set(baseName, count)
                filename = `${baseName}-${count}.${finalExtension}`
              } else {
                filenameMap.set(baseName, 0)
                filename = `${baseName}.${finalExtension}`
              }
            }
          } else {
            // Default filename handling
            const baseName = extractFilename(url).replace(/\.[^/.]+$/, '')

            // Handle duplicates
            if (filenameMap.has(baseName)) {
              const count = filenameMap.get(baseName) + 1
              filenameMap.set(baseName, count)
              filename = `${baseName}-${count}.${finalExtension}`
            } else {
              filenameMap.set(baseName, 0)
              filename = `${baseName}.${finalExtension}`
            }
          }

          // Add to zip if file type matches
          if (
            task.fileTypes.includes(finalExtension.toLowerCase()) ||
            task.fileTypes.includes('all')
          ) {
            zip.file(filename, blob, { binary: true })
            imagesDownloaded = true
          }
        } catch (error) {
          console.error(`Failed ${url}:`, error)
        } finally {
          filesProcessed++
          updateProgress(
            task.id,
            Math.round((filesProcessed / filteredUrls.length) * 100)
          )
        }
      })

      // Finalize zip if we got files
      if (Object.keys(zip.files).length > 0) {
        const blob = await zip.generateAsync({
          type: 'blob',
          streamFiles: true,
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        })

        triggerDownload(blob, task.folderName || `Task_${task.id}`, task.id)
      } else if (!imagesDownloaded) {
        addNoImagesNote(zip, task.id)
        const blob = await zip.generateAsync({ type: 'blob' })
        triggerDownload(blob, `Task_${task.id}_note`, task.id)
      }

      task.status = 'completed'
    } catch (error) {
      console.error('Zip generation failed:', error)
      task.status = 'failed'
    } finally {
      controller.abort()
      await saveUpdatedTask(task)
      updateProgress(task.id, 100)
    }
  }

  async function processFileForZip (url, task, filenameMap) {
    try {
      // Fetch the file
      const response = await fetch(url, {
        mode: 'no-cors',
        credentials: 'omit'
      })
      if (!response.ok && response.type !== 'opaque') {
        throw new Error(`HTTP error: ${response.status}`)
      }

      // Get the blob
      let blob = await response.blob()
      let extension =
        extractExtensionFromUrl(url) ||
        response.headers.get('content-type')?.split('/')[1]?.toLowerCase() ||
        'bin'

      // Process conversion if enabled
      if (task.convert?.enabled) {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const img = await createImageBitmap(blob)
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          let mimeType, convertedExtension
          switch (task.convert.format) {
            case 'png':
              mimeType = 'image/png'
              convertedExtension = 'png'
              break
            case 'webp':
              mimeType = 'image/webp'
              convertedExtension = 'webp'
              break
            default: // Default to jpeg
              mimeType = 'image/jpeg'
              convertedExtension = 'jpg'
          }

          blob = await new Promise(resolve => {
            canvas.toBlob(
              convertedBlob => {
                resolve(convertedBlob || blob)
              },
              mimeType,
              task.convert.quality / 100
            )
          })
          extension = convertedExtension
        } catch (convError) {
          console.error('Conversion failed, using original:', convError)
        }
      }

      // Generate filename using the updated function
      const filename = buildCustomFilename(
        task,
        url,
        extractFilename(url).replace(/\.[^/.]+$/, ''),
        extension
      )

      return { filename, blob }
    } catch (error) {
      console.error(`Failed to process ${url}:`, error)
      return null
    }
  }

  // Helper function to process a single URL for zip
  async function processUrl (url, task, filenameMap, fetchOptions) {
    try {
      const response = await fetch(url, fetchOptions)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      // Get file extension from content-type or URL
      const contentType = response.headers.get('content-type') || ''
      let extension = (
        contentType.split('/')[1] ||
        extractExtensionFromUrl(url) ||
        'bin'
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')

      // Process image conversion if enabled
      const { finalBlob, finalExtension } = await processImage(
        response,
        extension,
        task.convert
      )

      // Generate filename
      const filename = generateFilename(task, url, finalExtension, filenameMap)

      return { filename, blob: finalBlob }
    } catch (error) {
      console.error(`Failed ${url}:`, error)
      return null
    }
  }

  // Helper Functions

  async function processImage (response, originalExt, convertSettings) {
    if (!convertSettings?.enabled) {
      return {
        finalBlob: await response.blob(),
        finalExtension: originalExt
      }
    }

    try {
      // Create image bitmap
      const imageBitmap = await createImageBitmap(await response.blob())
      const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imageBitmap, 0, 0)

      // Convert to target format
      let mimeType
      switch (convertSettings.format) {
        case 'png':
          mimeType = 'image/png'
          break
        case 'webp':
          mimeType = 'image/webp'
          break
        default:
          mimeType = 'image/jpeg'
      }

      const blob = await canvas.convertToBlob({
        type: mimeType,
        quality: convertSettings.quality / 100
      })

      return {
        finalBlob: blob,
        finalExtension: convertSettings.format
      }
    } catch (error) {
      console.error('Conversion failed, using original:', error)
      return {
        finalBlob: await response.blob(),
        finalExtension: originalExt
      }
    }
  }

  function generateFilename (task, url, extension, filenameMap) {
    let baseName = extractFilename(url).replace(/\.[^/.]+$/, '')

    // Handle duplicates
    if (filenameMap.has(baseName)) {
      const count = filenameMap.get(baseName) + 1
      filenameMap.set(baseName, count)
      baseName += `-${count}`
    } else {
      filenameMap.set(baseName, 0)
    }

    // Apply naming rules
    if (task.buildCheckbox) {
      return buildCustomFilename(task, url, baseName, extension)
    }

    return `${baseName}.${extension}`
  }

  function buildCustomFilename (task, url, baseName, extension) {
    if (!task.sortableList) return `${baseName}.${extension}`

    const parser = new DOMParser()
    const doc = parser.parseFromString(task.sortableList, 'text/html')
    const items = doc.querySelectorAll('.ui-state-default:not(.extension)')

    const components = Array.from(items).map(item => {
      const content = item.textContent.replace('X', '').trim()

      // Handle special keywords
      if (content === 'sequence') {
        const sequenceStart = task.sequenceStart || '1'
        const sequenceLength = sequenceStart.length
        const currentCount = filenameMap.get(baseName)
        const currentSequence = parseInt(sequenceStart, 10) + currentCount
        return currentSequence.toString().padStart(sequenceLength, '0')
      }
      if (content === 'timestamp') return Date.now()
      if (content === 'filename') return baseName
      if (content === 'shortuuid') return generateShortUUID() // Add this line
      if (content.startsWith('Segment')) {
        const index = parseInt(content.split(' ')[1], 10) - 1
        const segments = splitUrl(url)
        return segments[index] || ''
      }
      return content
    })

    return `${components.join('')}.${extension}`
  }

  async function processInBatches (items, batchSize, processFn) {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      await Promise.all(batch.map(processFn))
    }
  }

  function triggerDownload (blob, baseName, taskId) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.zip`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 30000) // 30s timeout for large zips
  }

  function addNoImagesNote (zip, taskId) {
    zip.file(
      `README_${taskId}.txt`,
      `No images matched your filters in Task ${taskId}\n` +
        `Possible issues:\n` +
        `- File type filters too restrictive\n` +
        `- Download If conditions too strict\n` +
        `- URLs might not point to valid images`
    )
  }

  $(function () {
    $('#tasks-container').sortable({
      update: function (event, ui) {
        saveOrder() // Call the function to save the new task order
      }
    })
  })

  function saveOrder () {
    const tasks = []
    const taskElements = document.querySelectorAll('.task')

    taskElements.forEach(taskElement => {
      const taskId = taskElement.getAttribute('data-task-id')
      const task = {
        id: taskId,
        urls: taskElement
          .querySelector('.urls')
          .value.split('\n')
          .filter(url => url.trim() !== ''),
        fileTypes: [],
        folderName: taskElement.querySelector('.folderName').value.trim(),
        downloadTime: taskElement.querySelector('.download-time').value,
        zipDownload: taskElement.querySelector(`#zip-checkbox-${taskId}`)
          .checked,
        buildCheckbox: taskElement.querySelector(`#build-checkbox-${taskId}`)
          .checked,
        sortableList: taskElement.querySelector(`#sortable-${taskId}`).innerHTML
      }

      const allFormatsCheckbox = taskElement.querySelector(
        `#all-formats-checkbox-${taskId}`
      )
      if (allFormatsCheckbox.checked) {
        task.fileTypes.push('all')
      } else {
        taskElement
          .querySelectorAll(`.file-type-${taskId}:checked`)
          .forEach(checkbox => {
            task.fileTypes.push(checkbox.value)
          })
      }

      tasks.push(task) // Add the task to the array
    })

    chrome.storage.local.set({ tasks }, function () {
      //console.log("Task order saved:", tasks); // Confirm that the new order is saved
    })
  }

  // Helper function to save task status updates immediately
  async function saveUpdatedTask (task) {
    return new Promise(resolve => {
      chrome.storage.local.get('tasks', function (data) {
        const tasks = data.tasks || []
        const index = tasks.findIndex(t => t.id === task.id)
        if (index !== -1) {
          tasks[index] = task // Update the task in the list
          chrome.storage.local.set({ tasks }, function () {
            //console.log("Task status updated:", task.status);
            resolve()
          })
        } else {
          resolve() // Resolve even if task isn't found to prevent blocking
        }
      })
    })
  }

  function stripDuplicates (event) {
    const taskElement = event.target.closest('.task')
    const taskId = taskElement.getAttribute('data-task-id')
    const urlsTextarea = taskElement.querySelector('.urls')
    const urlCountDiv = taskElement.querySelector(`#url-count-${taskId}`)
    const duplicateWarningDiv = taskElement.querySelector(
      `#duplicate-warning-${taskId}`
    )

    // Get the URLs from the textarea and remove duplicates
    const urls = urlsTextarea.value.split('\n').filter(url => url.trim() !== '')
    const uniqueUrls = [...new Set(urls)] // Use a Set to remove duplicates
    urlsTextarea.value = uniqueUrls.join('\n')

    // Update the URL count
    const urlCount = uniqueUrls.length
    urlCountDiv.textContent = `URL count: ${urlCount}`

    // Hide the duplicate warning after stripping duplicates
    hideDuplicateWarning(duplicateWarningDiv)

    // Update the task in storage
    chrome.storage.local.get('tasks', function (data) {
      const tasks = data.tasks || []
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        task.urls = uniqueUrls
        //console.log("Duplicates removed:", task.urls);
        const updatedTasks = tasks.map(t => (t.id === taskId ? task : t))
        chrome.storage.local.set({ tasks: updatedTasks }, function () {
          //console.log("Task updated with removed duplicates:", task);
        })
      }
    })

    // Helper function to hide the duplicate warning
    function hideDuplicateWarning (warningElement) {
      warningElement.style.display = 'none'
      warningElement.classList.remove('blink')
    }
  }

  function removeDuplicates (array) {
    return Array.from(new Set(array))
  }

  function addTaskToDOM (task) {
    const taskId = task.id || Date.now().toString()
    const sequenceStartValue = localStorage.getItem('startFrom') || '1' // Default to 1
    // Determine if dragging is enabled or disabled
    const dragClass = isLocked ? 'dragdis' : 'drag'

    // Calculate initial duplicate count
    const initialUrls = task.urls
      .join('\n')
      .split('\n')
      .filter(url => url.trim() !== '')
    const initialUniqueUrls = [...new Set(initialUrls)]
    const initialUrlCount = initialUrls.length
    const initialDuplicateCount = initialUrlCount - initialUniqueUrls.length
    const showDuplicateWarning = initialDuplicateCount > 0

    // Add sequence start number input field
    const sequenceStartInput = `<input type="text" id="sequence-start-${taskId}" class="sequence-start-input" placeholder="Start from e.g 1 or 0050 etc" value="${sequenceStartValue}">`

    const taskTemplate = `
            <div class="task ${dragClass} ${
      task.status
    }" draggable="${!isLocked}" data-task-id="${taskId}"><div style="font-size:9px; float:right;">#${
      task.id
    }</div>
                
                <textarea class="urls" rows="3" cols="30" placeholder="Enter image URLs">${task.urls.join(
                  '\n'
                )}</textarea>
  
          <div class="url-info-container">
              <div id="url-count-${taskId}" class="url-count">
                  ${
                    initialUrlCount > 0
                      ? `URL count: ${initialUrlCount}`
                      : 'Paste URLs to check for duplicates'
                  }
              </div>
              <div id="duplicate-warning-${taskId}" class="duplicate-warning" style="display:${
      showDuplicateWarning ? 'block' : 'none'
    }">
                  Duplicate URLs detected: ${initialDuplicateCount}
              </div>
          </div>
  
  
                      <!-- Add the progress bar and progress text -->
      <progress id="progress-bar-${taskId}" max="100" value="0"></progress>
      <div class="progress-text" id="progress-text-${taskId}">Progress: 0%</div>
      
                <div><details>
                    <summary class="opt-others">🗂️ Select File Types</summary>  
                      <label><input type="checkbox" id="all-formats-checkbox-${taskId}" class="file-type" value="all" ${
      task.fileTypes.includes('all') ? 'checked' : ''
    }> All Types</label>
  
                      <label><input type="checkbox" class="file-type-${taskId}" value="jpg" ${
      task.fileTypes.includes('jpg') ? 'checked' : ''
    }> JPG</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="png" ${
      task.fileTypes.includes('png') ? 'checked' : ''
    }> PNG</label>
                      <label><input type="checkbox" class="file-type-${taskId}" value="gif" ${
      task.fileTypes.includes('gif') ? 'checked' : ''
    }> GIF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="jpeg" ${
      task.fileTypes.includes('jpeg') ? 'checked' : ''
    }> JPEG</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="webp" ${
      task.fileTypes.includes('webp') ? 'checked' : ''
    }> WEBP</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="svg" ${
      task.fileTypes.includes('svg') ? 'checked' : ''
    }> SVG</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="pdf" ${
      task.fileTypes.includes('pdf') ? 'checked' : ''
    }> PDF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="apng" ${
      task.fileTypes.includes('apng') ? 'checked' : ''
    }> APNG</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="arw" ${
      task.fileTypes.includes('arw') ? 'checked' : ''
    }> ARW</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="avif" ${
      task.fileTypes.includes('avif') ? 'checked' : ''
    }> AVIF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="bmp" ${
      task.fileTypes.includes('bmp') ? 'checked' : ''
    }> BMP</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="cr2" ${
      task.fileTypes.includes('cr2') ? 'checked' : ''
    }> CR2</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="crw" ${
      task.fileTypes.includes('crw') ? 'checked' : ''
    }> CRW</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="dcr" ${
      task.fileTypes.includes('dcr') ? 'checked' : ''
    }> DCR</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="dng" ${
      task.fileTypes.includes('dng') ? 'checked' : ''
    }> DNG</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="exif" ${
      task.fileTypes.includes('exif') ? 'checked' : ''
    }> EXIF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="hdr" ${
      task.fileTypes.includes('hdr') ? 'checked' : ''
    }> HDR</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="heic" ${
      task.fileTypes.includes('heic') ? 'checked' : ''
    }> HEIC</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="heif" ${
      task.fileTypes.includes('heif') ? 'checked' : ''
    }> HEIF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="ico" ${
      task.fileTypes.includes('ico') ? 'checked' : ''
    }> ICO</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="indd" ${
      task.fileTypes.includes('indd') ? 'checked' : ''
    }> INDD</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="jp2" ${
      task.fileTypes.includes('jp2') ? 'checked' : ''
    }> JP2</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="jfif" ${
      task.fileTypes.includes('jfif') ? 'checked' : ''
    }> JFIF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="nef" ${
      task.fileTypes.includes('nef') ? 'checked' : ''
    }> NEF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="orf" ${
      task.fileTypes.includes('orf') ? 'checked' : ''
    }> ORF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="raw" ${
      task.fileTypes.includes('raw') ? 'checked' : ''
    }> RAW</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="raf" ${
      task.fileTypes.includes('raf') ? 'checked' : ''
    }> RAF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="rw2" ${
      task.fileTypes.includes('rw2') ? 'checked' : ''
    }> RW2</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="svgz" ${
      task.fileTypes.includes('svgz') ? 'checked' : ''
    }> SVGZ</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="tiff" ${
      task.fileTypes.includes('tiff') ? 'checked' : ''
    }> TIFF</label>
                                      <label><input type="checkbox" class="file-type-${taskId}" value="tif" ${
      task.fileTypes.includes('tif') ? 'checked' : ''
    }> TIF</label>
                      </details>
                    
                </div>
                <input type="datetime-local" class="download-time" value="${
                  task.downloadTime
                }">
                <input type="text" class="folderName" value="${
                  task.folderName || ''
                }" placeholder="Folder Name">
  
              <div class="convert-switch-container">
                  <label class="switch">
                      <input type="checkbox" id="convert-checkbox-${taskId}" class="convert-checkbox">
                      <span class="slider round"></span>
                  </label>
                  <label class="switch-label">Convert</label>
              </div>
  
              <div id="convert-options-${taskId}" class="convert-options" style="display: none;">
                  <select id="convert-format-${taskId}" class="convert-format">
                      <option value="jpg">JPG</option>
                      <option value="png">PNG</option>
                      <option value="webp">WebP</option>
                  </select>
                  <label>Quality: <input type="range" id="quality-slider-${taskId}" min="1" max="100" value="100"></label>
                  <span id="quality-value-${taskId}">100%</span>
              </div>
  
  <!-- "Download If" Feature -->
  <div class="download-if-container">
    <label>
      <input type="checkbox" class="download-if-checkbox" id="download-if-checkbox-${taskId}" ${
      task.downloadIf?.enabled ? 'checked' : ''
    }>
      DOWNLOAD IF URL
    </label>
  
    <!-- Flex container for dropdown, input, and add button -->
    <div  id="download-if-inputs-${taskId}" class="download-if-inputs" style="display: ${
      task.downloadIf?.enabled ? 'block' : 'none'
    };">
      <select id="download-if-condition-${taskId}" class="download-if-condition">
        <option value="contains" ${
          task.downloadIf?.condition === 'contains' ? 'selected' : ''
        }>Contains</option>
        <option value="not-contains" ${
          task.downloadIf?.condition === 'not-contains' ? 'selected' : ''
        }>Not Contains</option>
      </select>
  
      <input type="text" id="download-if-value-${taskId}" class="download-if-value" placeholder="Add Keyword, Domain etc" value="${
      task.downloadIf?.value || ''
    }">
      
      <button id="download-if-add-${taskId}" class="download-if-add-btn" style="padding:5px; margin:.1px;">Add</button>
    </div>
  
    <ul id="download-if-keywords-${taskId}" class="download-if-keywords"></ul>
  
    <div class="download-if-logic" id="download-if-logic-${taskId}" style="display:none;">
      <label  class="download-if"><input type="radio" name="downloadIfLogic-${taskId}" value="and" checked> AND</label>
      <label  class="download-if"><input type="radio" name="downloadIfLogic-${taskId}" value="or"> OR</label>
    </div>
  </div>
     <div class="zip-switch-container">
                      <label class="switch">
                          <input type="checkbox" id="zip-checkbox-${taskId}" class="zip-checkbox" ${
      task.zipDownload ? 'checked' : ''
    }>
                          <span class="slider round"></span>
                      </label>
                      <label class="switch-label">Zip</label>
                  </div>

                <div class="watermark-switch-container">
                    <label class="switch">
                        <input type="checkbox" id="watermark-checkbox-${taskId}" class="watermark-checkbox" ${
      task.watermark?.enabled ? 'checked' : ''
    }>
                        <span class="slider round"></span>
                    </label>
                    <label class="switch-label">Watermark</label>
                </div>

                <div class="fl_const">📝Filename Constructor</div>
                <input type="checkbox" id="build-checkbox-${taskId}" class="build-checkbox">
                  <select id="newItem-${taskId}" class="new-item-dropdown">
                    <option value="">Select an option</option>
                    <option value="filename">Filename</option>
                    <option value="-">Hyphen</option>
                    <option value="sequence">Sequence</option>
                    <option value="timestamp">Timestamp</option>
                    <option value="_">Underscore</option>
                    <option value="urlfragments">URL Fragments</option>
                    <option value="website">Website</option>
                    <option value="shortuuid">Random String</option>
                    <option value="add_new">Add New</option>
                  </select>
  
                  <input type="text" id="newItemInput-${taskId}" class="new-item-input" placeholder="Enter new keyword" style="display:none;">
                  <button id="addButton" class="add-new-item-btn" style="padding:5px;">Add</button>
                  <ul id="sortable-${taskId}" class="sortable isort">
                    <li class="ui-state-default extension">.extension</li> 
                  </ul>
                  ${sequenceStartInput}
                <button class="remove-task-btn">x</button>
                <button class="strip-duplicates-btn">Strip Duplicates</button> 
            </div>
        `

    tasksContainer.insertAdjacentHTML('beforeend', taskTemplate)

    const taskElement = tasksContainer.lastElementChild
    const downloadTimeInput = taskElement.querySelector('.download-time')

    const convertCheckbox = taskElement.querySelector(
      `#convert-checkbox-${taskId}`
    )
    const convertOptions = taskElement.querySelector(
      `#convert-options-${taskId}`
    )
    const qualitySlider = taskElement.querySelector(`#quality-slider-${taskId}`)
    const qualityValue = taskElement.querySelector(`#quality-value-${taskId}`)

    const urlsTextarea = taskElement.querySelector('.urls')

    // Set up auto-save for this existing task if it's a draft
    if (task.status === 'draft' || task.isDraft) {
      setupUrlAutoSave(urlsTextarea, taskId)
    }

    const urlCountDiv = taskElement.querySelector(`#url-count-${taskId}`)
    const allFormatsCheckbox = document.getElementById(
      `all-formats-checkbox-${taskId}`
    )
    const zipCheckbox = document.getElementById(`zip-checkbox-${taskId}`)
    const newItemSelect = taskElement.querySelector(`#newItem-${taskId}`)
    const sequenceStartInputElement = taskElement.querySelector(
      `#sequence-start-${taskId}`
    )
    const newItemInput = taskElement.querySelector(`#newItemInput-${taskId}`)
    const addButton = taskElement.querySelector('.add-new-item-btn')
    const sortableList = taskElement.querySelector(`#sortable-${taskId}`)
    const buildCheckbox = taskElement.querySelector(`#build-checkbox-${taskId}`)

    // Restore "Download If" state
    const downloadIfInputsContainer = document.getElementById(
      `download-if-inputs-${taskId}`
    )
    const downloadIfCheckbox = document.getElementById(
      `download-if-checkbox-${taskId}`
    )
    const downloadIfCondition = document.getElementById(
      `download-if-condition-${taskId}`
    )
    const downloadIfValue = document.getElementById(
      `download-if-value-${taskId}`
    )
    const downloadIfAddButton = document.getElementById(
      `download-if-add-${taskId}`
    )
    const downloadIfKeywordsList = document.getElementById(
      `download-if-keywords-${taskId}`
    )
    const downloadIfLogicDiv = document.getElementById(
      `download-if-logic-${taskId}`
    )

    // Show/hide conversion options when checkbox is toggled
    convertCheckbox.addEventListener('change', function () {
      convertOptions.style.display = this.checked ? 'block' : 'none'
    })

    // Update quality percentage display
    qualitySlider.addEventListener('input', function () {
      qualityValue.textContent = `${this.value}%`
    })

    // Set initial state from task data (for addTaskToDOM)
    if (task.convert) {
      convertCheckbox.checked = task.convert.enabled
      convertOptions.style.display = task.convert.enabled ? 'block' : 'none'
      if (task.convert.format) {
        taskElement.querySelector(`#convert-format-${taskId}`).value =
          task.convert.format
      }
      if (task.convert.quality) {
        qualitySlider.value = task.convert.quality
        qualityValue.textContent = `${task.convert.quality}%`
      }
    }

    // Show or hide the dropdown, input, Add button, keywords list, and logic based on the checkbox
    downloadIfCheckbox.addEventListener('change', function () {
      if (this.checked) {
        downloadIfCondition.style.display = 'inline-block'
        downloadIfValue.style.display = 'inline-block' // Show the text input when checkbox is checked
        downloadIfAddButton.style.display = 'inline-block' // Show the Add button
        downloadIfKeywordsList.style.display = 'block' // Show the keywords list
        downloadIfInputsContainer.style.display = 'block' // Show the keywords list

        // Call the logic display toggle function
        checkAndToggleLogicDisplay(taskId)
      } else {
        downloadIfCondition.style.display = 'none'
        downloadIfValue.style.display = 'none' // Hide the text input if the checkbox is unchecked
        downloadIfAddButton.style.display = 'none' // Hide the Add button
        downloadIfKeywordsList.style.display = 'none' // Hide the keywords list
        downloadIfLogicDiv.style.display = 'none' // Also hide the AND/OR logic buttons
        downloadIfInputsContainer.style.display = 'none' // Show the keywords list
      }
    })

    // Show or hide the Add button when the text input is focused
    downloadIfValue.addEventListener('input', function () {
      if (downloadIfValue.value.trim() !== '') {
        downloadIfAddButton.style.display = 'inline-block'
      } else {
        downloadIfAddButton.style.display = 'none'
      }
    })

    // Restore "Download If" keywords and add AND/OR logic display
    if (task.downloadIf && task.downloadIf.keywords) {
      task.downloadIf.keywords.forEach(({ condition, value }) => {
        const keywordElement = document.createElement('li')
        keywordElement.className = 'download-if-keyword'
        keywordElement.textContent = `${condition}: ${value}`

        // Add a remove button
        const removeButton = document.createElement('button')
        removeButton.textContent = 'X'
        removeButton.className = 'remove-keyword-btn'
        removeButton.addEventListener('click', function () {
          keywordElement.remove()
          saveKeywordsToStorage(taskId) // Save updated list
          checkAndToggleLogicDisplay(taskId) // Check again after removing a keyword
        })

        keywordElement.appendChild(removeButton)
        downloadIfKeywordsList.appendChild(keywordElement)
      })

      // Check if both "contains" and "not-contains" conditions exist and show the AND/OR logic selection
      checkAndToggleLogicDisplay(taskId)
    }

    // Restore the selected logic
    if (task.downloadIf && task.downloadIf.logic) {
      const logicRadios = taskElement.querySelector(
        `input[name="downloadIfLogic-${taskId}"][value="${task.downloadIf.logic}"]`
      )
      if (logicRadios) {
        logicRadios.checked = true
      }
    }

    // Example call when adding keywords dynamically
    downloadIfAddButton.addEventListener('click', function () {
      const condition = downloadIfCondition.value
      const value = downloadIfValue.value.trim()

      // Check if the keyword already exists in the list (regardless of "contains" or "not-contains")
      const existingKeywords = Array.from(
        downloadIfKeywordsList.querySelectorAll('.download-if-keyword')
      ).map(keyword => {
        const text = keyword.textContent.replace('X', '').trim()
        const [existingCondition, existingValue] = text.split(': ')
        return existingValue // We only care about the value (the keyword), not the condition
      })

      // If the keyword already exists, show an alert and stop further execution
      if (existingKeywords.includes(value)) {
        alert(
          `The keyword "${value}" has already been added under either "contains" or "not-contains". Please choose a different keyword.`
        )
        return // Stop further execution if the keyword already exists
      }

      if (value !== '') {
        // Add the keyword to the list in the UI
        const keywordElement = document.createElement('li')
        keywordElement.className = 'download-if-keyword'
        keywordElement.textContent = `${condition}: ${value}`

        // Add a remove button
        const removeButton = document.createElement('button')
        removeButton.textContent = 'X'
        removeButton.className = 'remove-keyword-btn'
        removeButton.addEventListener('click', function () {
          keywordElement.remove()
          saveKeywordsToStorage(taskId) // Save updated list
          checkAndToggleLogicDisplay(taskId) // Update logic display
        })

        keywordElement.appendChild(removeButton)
        downloadIfKeywordsList.appendChild(keywordElement)

        // Save the keyword to Chrome storage
        saveKeywordsToStorage(taskId)

        // Check if both "Contains" and "Not Contains" are present and show radio buttons
        checkAndToggleLogicDisplay(taskId)

        // Clear input field
        downloadIfValue.value = ''
      }
    })

    // Add event listener to the sortable list to check for "Sequence" updates
    $(sortableList).sortable({
      cancel: '.extension', // Prevent dragging of the .extension item
      beforeStop: function (event, ui) {
        // Get the current and previous elements in the sortable list
        const currentItem = ui.item
        const prevItem = currentItem.prev()
        const nextItem = currentItem.next()

        // Prevent dropping on top or below the .extension item
        if (prevItem.hasClass('extension') || nextItem.hasClass('extension')) {
          $(sortableList).sortable('cancel') // Cancel the move if it's next to .extension
        }
      },
      update: function () {
        checkSequenceInList() // Check if "Sequence" is in the list and toggle the input visibility
      }
    })

    // Call checkSequenceInList initially to set the correct visibility
    checkSequenceInList()

    // Retrieve the saved lock status from local storage or set to false if not found
    var isLocked = localStorage.getItem('isLocked') === 'true' ? true : false

    // Set the sequence start value from the saved task
    if (task.sequenceStart) {
      sequenceStartInputElement.value = task.sequenceStart // Set the value only if it's provided
    } else {
      sequenceStartInputElement.value = '' // Clear the value to ensure the placeholder is shown
    }
    // Show or hide sequence start input based on current selection

    // Function to update lock status and UI
    function updateLockStatus () {
      $('.lock-btn').text(isLocked ? 'Unlock Drag' : 'Lock Drag')
      localStorage.setItem('isLocked', isLocked) // Save the lock status to local storage

      // Update draggable attribute for each task and apply the appropriate class
      $('.task').each(function () {
        $(this).attr('draggable', !isLocked)
        if (isLocked) {
          $(this).removeClass('drag').addClass('dragdis')
        } else {
          $(this).removeClass('dragdis').addClass('drag')
        }
      })

      // Enable or disable sorting based on lock status
      $('#tasks-container').sortable('option', 'disabled', isLocked)
    }

    // Add click event handler for the lock button
    $('.lock-btn').on('click', function () {
      isLocked = !isLocked // Toggle the lock state
      updateLockStatus()
    })

    // Update lock status when the page loads
    updateLockStatus()

    // Set the initial state of the dropdown based on the saved value of the checkbox
    newItemSelect.disabled = !task.buildCheckbox

    // Add an event listener to update the URL count and duplicate count with unified paste/input handler
    function handleUrlInput (textarea, urlCountDiv, taskId) {
      let urls = textarea.value.split('\n').filter(url => url.trim() !== '')
      const originalUrlCount = urls.length

      // License enforcement if exceeding limit
      if (originalUrlCount > MAX_URLS) {
        chrome.runtime.sendMessage(
          { action: 'validateSession' },
          licenseCheck => {
            const hasActiveLicense =
              licenseCheck?.license?.license_status === 'sold'
            const isExpired =
              licenseCheck?.license?.license_status === 'expired'

            if (!hasActiveLicense) {
              const maxAllowed = MAX_URLS
              urls = urls.slice(0, maxAllowed) // Enforce limit
              textarea.value = urls.join('\n') // Update textarea with limited URLs

              // Calculate duplicates based on the LIMITED urls only
              const uniqueUrls = [...new Set(urls)]
              const duplicateCount = urls.length - uniqueUrls.length

              // Update URL count display (without duplicate info)
              urlCountDiv.textContent = `URL count: ${urls.length} - ${
                isExpired ? 'Expired license' : 'Free version'
              } limit`

              // Update duplicate warning
              const duplicateWarningDiv = document.getElementById(
                `duplicate-warning-${taskId}`
              )
              if (duplicateCount > 0 && duplicateWarningDiv) {
                duplicateWarningDiv.style.display = 'block'
                duplicateWarningDiv.textContent = `Duplicate URLs detected: ${duplicateCount}`
              } else if (duplicateWarningDiv) {
                duplicateWarningDiv.style.display = 'none'
              }

              if (isExpired && document.querySelector('.licenseInfo')) {
                showLicenseMessage(
                  '⚠️ License expired - renew for unlimited URLs'
                )
              }
              return // Exit early after license enforcement
            }
          }
        )
      }

      // If no license enforcement needed or user has valid license
      const uniqueUrls = [...new Set(urls)]
      const duplicateCount = urls.length - uniqueUrls.length

      // Update URL count display (without duplicate info)
      urlCountDiv.textContent = `URL count: ${urls.length}`

      // Update duplicate warning
      const duplicateWarningDiv = document.getElementById(
        `duplicate-warning-${taskId}`
      )
      if (duplicateCount > 0 && duplicateWarningDiv) {
        duplicateWarningDiv.style.display = 'block'
        duplicateWarningDiv.textContent = `Duplicate URLs detected: ${duplicateCount}`
      } else if (duplicateWarningDiv) {
        duplicateWarningDiv.style.display = 'none'
      }
    }

    // Safe message display
    function showLicenseMessage (text) {
      const licenseInfo = document.querySelector('.licenseInfo')
      if (!licenseInfo) return

      // Create or update license message in the dedicated license info area
      let msg = licenseInfo.querySelector('.license-message')
      if (!msg) {
        msg = document.createElement('div')
        msg.className = 'license-message'
        licenseInfo.appendChild(msg)
      }
      msg.innerHTML = `<p>${text} <a href="${BASE_URL}/shop/" target="_blank">Renew</a></p>`

      // Ensure this doesn't affect the URL count display
      const urlCounts = document.querySelectorAll('.url-count')
      urlCounts.forEach(count => {
        count.style.display = 'block' // Ensure URL counts remain visible
      })
    }

    // Setup event listeners
    document.querySelectorAll('.urls').forEach(textarea => {
      const taskId = textarea.closest('.task').dataset.taskId
      const urlCountDiv = document.getElementById(`url-count-${taskId}`)

      // Handle all input types (keyboard + paste)
      textarea.addEventListener(
        'input',
        debounce(() => {
          handleUrlInput(textarea, urlCountDiv, taskId)
        }, 500)
      )

      // Special handling for CTRL+V
      textarea.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'v') {
          setTimeout(() => handleUrlInput(textarea, urlCountDiv, taskId), 10)
        }
      })
    })

    urlCountDiv.textContent = `URL count: ${initialUrlCount}`

    // In the addTaskToDOM function, after setting up the buildCheckbox event listener:
    buildCheckbox.addEventListener('change', function () {
      newItemSelect.disabled = !this.checked
      if (this.checked) {
        // When enabled, check URLs and populate dropdown
        const urls = urlsTextarea.value
          .split('\n')
          .filter(url => url.trim() !== '')
        if (urls.length > 0) {
          handleUrlsInput(urls, taskId)
        }
      } else {
        newItemInput.style.display = 'none'
      }
    })

    // Also add this right after setting up the textarea event listeners to handle initial state:
    if (task.buildCheckbox && task.urls.length > 0) {
      handleUrlsInput(task.urls, taskId)
    }

    newItemSelect.addEventListener('change', function () {
      if (this.value === 'add_new') {
        newItemInput.style.display = 'inline-block'
      } else {
        newItemInput.style.display = 'none'
      }
    })

    addButton.addEventListener('click', addNewItem)

    // Function to check if "Sequence" is in the list and toggle the sequence start input
    function checkSequenceInList () {
      const sequenceExists = sortableList.innerHTML
        .toLowerCase()
        .includes('sequence')
      sequenceStartInputElement.style.display = sequenceExists
        ? 'block'
        : 'none'
    }

    // Add event listener to the sortable list to check for "Sequence" updates
    $(sortableList).sortable({
      cancel: '.extension', // Prevent dragging of the .extension item
      beforeStop: function (event, ui) {
        // Get the current and previous elements in the sortable list
        const currentItem = ui.item
        const prevItem = currentItem.prev()
        const nextItem = currentItem.next()

        // Prevent dropping on top or below the .extension item
        if (prevItem.hasClass('extension') || nextItem.hasClass('extension')) {
          $(sortableList).sortable('cancel') // Cancel the move if it's next to .extension
        }
      },
      update: function () {
        checkSequenceInList() // Check if "Sequence" is in the list and toggle the input visibility
      }
    })

    // Update the addNewItem function to call checkSequenceInList after adding the item
    function addNewItem () {
      let newItem
      if (newItemSelect.value === 'add_new') {
        newItem = newItemInput.value
      } else {
        newItem = newItemSelect.value
      }

      if (newItem.startsWith('segment-')) {
        const segmentIndex = parseInt(newItem.split('-')[1])
        newItem = `Segment ${segmentIndex + 1}`
      }

      if (newItem.trim() !== '') {
        const extensionItem = sortableList.querySelector('.extension')
        const newItemElement = document.createElement('li')
        newItemElement.className = 'ui-state-default'
        newItemElement.textContent = newItem
        const removeButton = document.createElement('button')
        removeButton.className = 'remove-btn'
        removeButton.textContent = 'X'
        removeButton.addEventListener('click', function () {
          newItemElement.remove()
          checkSequenceInList() // Check if the sequence item is still in the list
        })
        newItemElement.appendChild(removeButton)
        sortableList.insertBefore(newItemElement, extensionItem)
        newItemSelect.value = ''
        newItemInput.value = ''
        newItemInput.style.display = 'none'

        checkSequenceInList() // Check if the sequence item has been added
      }
    }

    // Call checkSequenceInList initially to set the correct visibility
    checkSequenceInList()

    // Make sure to call checkSequenceInList when removing a task or an item
    document.addEventListener('click', function (event) {
      if (event.target && event.target.classList.contains('remove-btn')) {
        // The remove button was clicked
        const listItemToRemove = event.target.closest('.ui-state-default')
        listItemToRemove.remove()
        checkSequenceInList() // Recheck if sequence is in the list after removing an item
      }
    })

    // Add event listener to the "All Formats" checkbox
    allFormatsCheckbox.addEventListener('change', function () {
      const checkboxes = taskElement.querySelectorAll(`.file-type-${taskId}`)
      checkboxes.forEach(checkbox => {
        checkbox.disabled = this.checked
        if (this.checked) {
          checkbox.checked = false
        }
      })
    })

    const duplicateButton = document.createElement('button')
    duplicateButton.textContent = 'Duplicate'
    duplicateButton.classList.add('duplicate-task-btn')

    duplicateButton.addEventListener('click', async function () {
      try {
        // 1. Force fresh license check
        const licenseCheck = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            { action: 'validateSession' },
            response => {
              if (chrome.runtime.lastError) {
                console.error('License check error:', chrome.runtime.lastError)
                resolve({ valid: false })
              } else {
                resolve(response)
              }
            }
          )
        })

        // 2. Check license status
        if (
          !licenseCheck ||
          !licenseCheck.license ||
          licenseCheck.license.license_status !== 'sold'
        ) {
          alert('Valid license required to duplicate tasks')
          return
        }

        // 3. Only proceed if license is valid
        duplicateTask.call(this)

        // 4. Update UI if needed
        chrome.storage.local.get(['license'], data => {
          updateUI(true, licenseCheck.userEmail, data.license)
        })
      } catch (error) {
        console.error('Error during license check:', error)
        alert('Error validating license. Please try again.')
      }
    })

    taskElement.appendChild(duplicateButton)

    // Function to duplicate the task
    async function duplicateTask () {
      try {
        // 1. First force fresh license check
        const licenseCheck = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            { action: 'validateSession' },
            response => {
              if (chrome.runtime.lastError) {
                console.error('License check error:', chrome.runtime.lastError)
                resolve({ valid: false })
              } else {
                resolve(response)
              }
            }
          )
        })

        // 2. Check the license status
        if (
          !licenseCheck ||
          !licenseCheck.license ||
          licenseCheck.license.license_status !== 'sold'
        ) {
          alert('Valid license required to duplicate tasks')
          return
        }

        // 3. Proceed with duplication if license is valid
        const taskElement = this.closest('.task')
        const taskId = taskElement.getAttribute('data-task-id')

        chrome.storage.local.get('tasks', function (data) {
          const tasks = data.tasks || []
          const originalTask = tasks.find(t => t.id === taskId)

          if (originalTask) {
            const clonedTask = { ...originalTask }
            clonedTask.id = Date.now().toString()

            // Maintain your existing time check logic
            const currentTime = new Date()
            const downloadTime = new Date(clonedTask.downloadTime)
            clonedTask.status =
              currentTime < downloadTime ? 'pending' : 'scheduled'

            tasks.push(clonedTask)

            chrome.storage.local.set({ tasks }, function () {
              //console.log("Cloned task saved:", clonedTask);
              addTaskToDOM(clonedTask)

              // Keep your important message for duplicated tasks
              const clonedTaskElement = document.querySelector(
                `[data-task-id="${clonedTask.id}"]`
              )
              if (clonedTaskElement) {
                const message = document.createElement('p')
                message.textContent =
                  "*Important! For duplicates such as this, using the save button before refreshing the page discards the copied task details. Just refresh page and you're good :) You can save after refresh."
                message.style.fontSize = '11px'
                message.style.color = '#2196F3'
                clonedTaskElement.appendChild(message)
              }
            })
          }
        })

        // 4. Update UI to reflect current license status
        chrome.storage.local.get(['license'], data => {
          updateUI(true, licenseCheck.userEmail, data.license)
        })
      } catch (error) {
        console.error('Error during duplication:', error)
        alert('Error duplicating task. Please try again.')
      }
    }

    function saveUpdatedTask (task) {
      chrome.storage.local.get('tasks', function (data) {
        const tasks = data.tasks || []
        const index = tasks.findIndex(t => t.id === task.id)
        if (index !== -1) {
          tasks[index].status = task.status
          tasks[index].buildCheckbox = task.buildCheckbox // Update buildCheckbox
          tasks[index].sortableList = task.sortableList // Update sortableList
          chrome.storage.local.set({ tasks }, function () {
            //console.log("Tasks saved after updating status:", tasks);
            const updatedStatus = tasks[index].status
            //console.log("Updated status:", updatedStatus);
          })
        }
      })
    }

    zipCheckbox.checked = task.zipDownload

    document.addEventListener('click', function (event) {
      if (event.target && event.target.classList.contains('remove-btn')) {
        // The remove button was clicked
        const listItemToRemove = event.target.closest('.ui-state-default')
        listItemToRemove.remove()
      }
    })
  }

  // Add this function to create and export the CSV
  function exportTasksToCSV () {
    chrome.storage.local.get('tasks', function (data) {
      const tasks = data.tasks || []

      // Create CSV header row (matches your import format)
      let csvContent =
        'urls,fileTypes,folderName,downloadTime,zipDownload,buildCheckbox,sortableList,sequenceStart,downloadIfEnabled,downloadIfKeywords,downloadIfLogic,Convert Enabled,Convert Format,Convert Quality,watermark,status\n'

      // Add each task's data to the CSV
      tasks.forEach(task => {
        // Prepare each field with proper CSV formatting
        const urls = task.urls.join(';') // Join URLs with semicolon
        const fileTypes = task.fileTypes.join(';') // Join file types with semicolon
        const folderName = task.folderName || ''
        const downloadTime = task.downloadTime || ''
        const zipDownload = task.zipDownload ? 'true' : 'false'
        const buildCheckbox = task.buildCheckbox ? 'true' : 'false'
        const convertEnabled = task.convert?.enabled ? 'true' : 'false'
        const convertFormat = task.convert?.format || ''
        const convertQuality = task.convert?.quality || ''
        const watermark = task.watermark?.enabled ? 'true' : 'false'

        // Extract sortable list items (excluding the .extension item)
        let sortableItems = []
        if (task.sortableList) {
          const parser = new DOMParser()
          const doc = parser.parseFromString(task.sortableList, 'text/html')
          const items = doc.querySelectorAll(
            '.ui-state-default:not(.extension)'
          )
          items.forEach(item => {
            sortableItems.push(item.textContent.replace('X', '').trim())
          })
        }
        const sortableList = sortableItems.join(';')

        const sequenceStart = task.sequenceStart || ''

        // Handle Download If data
        const downloadIfEnabled = task.downloadIf?.enabled ? 'true' : 'false'

        let downloadIfKeywords = []
        if (task.downloadIf?.keywords) {
          task.downloadIf.keywords.forEach(keyword => {
            downloadIfKeywords.push(`${keyword.condition}: ${keyword.value}`)
          })
        }
        const downloadIfKeywordsStr = downloadIfKeywords.join(';')

        const downloadIfLogic = task.downloadIf?.logic || ''
        const status = task.status || 'pending'
        const taskId = task.id || ''

        // Create CSV row - note the order of fields matches the header
        const row = [
          `"${urls}"`,
          `"${fileTypes}"`,
          `"${folderName}"`,
          `"${downloadTime}"`,
          `"${zipDownload}"`,
          `"${buildCheckbox}"`,
          `"${sortableList}"`,
          `"${sequenceStart}"`,
          `"${downloadIfEnabled}"`,
          `"${downloadIfKeywordsStr}"`,
          `"${downloadIfLogic}"`,
          `"${convertEnabled}"`,
          `"${convertFormat}"`,
          `"${convertQuality}"`,
          `"${watermark}"`,
          `"${status}"`,
          `"${task.id || ''}"`
        ].join(',')

        csvContent += row + '\n'
      })

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute(
        'download',
        `bulk_image_downloader_tasks_${new Date()
          .toISOString()
          .slice(0, 10)}.csv`
      )
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  // Add this event listener to your existing code:
  document
    .getElementById('exportTasksBtn')
    ?.addEventListener('click', function () {
      try {
        // Directly export tasks without license check
        exportTasksToCSV()
      } catch (error) {
        console.error('Error exporting tasks:', error)
        alert('Error exporting tasks. Please try again.')
      }
    })
})
