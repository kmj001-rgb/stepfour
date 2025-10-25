function createTask () {
  // Generate a unique ID for the task
  const taskId = Date.now().toString()

  const taskTemplate = `
    <div class="task" draggable="true" data-task-id="${taskId}">
                    <textarea class="urls" rows="3" cols="30" placeholder="Enter image URLs"></textarea>
            <div><details>
                  <summary class="opt-others">Select File Types</summary>
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
            <label class="zipit"><input type="checkbox" id="zip-checkbox-${taskId}" class="zip-checkbox">Zip</label>
            </div>
            <input type="datetime-local" class="download-time">
            <input type="text" class="prefix" placeholder="Prefix">
            <input type="text" class="suffix" placeholder="Suffix">
            <input type="text" class="folderName" placeholder="Folder Name">
            <button class="remove-task-btn">X</button>
            <button class="strip-duplicates-btn">Strip Duplicates</button>
    </div>
    `

  tasksContainer.insertAdjacentHTML('beforeend', taskTemplate)

  // Get references to elements within the newly created task
  const taskElement = tasksContainer.lastElementChild
  const allFormatsCheckbox = taskElement.querySelector(
    `#all-formats-checkbox-${taskId}`
  )
  const zipCheckbox = taskElement.querySelector(`#zip-checkbox-${taskId}`)
  const checkboxes = taskElement.querySelectorAll(`.file-type-${taskId}`)

  // Add event listener to the "All Formats" checkbox
  allFormatsCheckbox.addEventListener('change', function () {
    checkboxes.forEach(checkbox => {
      checkbox.disabled = this.checked
      if (this.checked) {
        checkbox.checked = false
      }
    })
  })

  // Add event listeners to other checkboxes to disable "All Formats" when they are checked
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      if (this.checked) {
        allFormatsCheckbox.checked = false
        allFormatsCheckbox.disabled = true
      }
    })
  })

  // Add event listener to handle enabling all options when none is checked
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const allChecked = Array.from(checkboxes).every(
        checkbox => checkbox.checked
      )
      allFormatsCheckbox.disabled = allChecked
    })
  })

  // Add event listener for ZIP checkbox to prevent immediate download
  zipCheckbox.addEventListener('change', function () {
    // Do nothing here to prevent immediate download
  })

  // Add event listener to the remove button of the newly created task
  const removeTaskBtn = taskElement.querySelector('.remove-task-btn')
  removeTaskBtn.addEventListener('click', removeTask)

  // Add event listener to the strip duplicates button of the newly created task
  const stripDuplicatesBtn = taskElement.querySelector('.strip-duplicates-btn')
  stripDuplicatesBtn.addEventListener('click', stripDuplicates)

  // Set minimum datetime for download time input
  const downloadTimeInput = taskElement.querySelector('.download-time')
  downloadTimeInput.setAttribute('min', getMinDateTime())

  downloadTimeInput.addEventListener('change', function () {
    const selectedDateTime = new Date(this.value)
    const today = new Date()

    if (isNaN(selectedDateTime) || selectedDateTime < today) {
      alert('Please select a valid date and time in the future.')
      this.value = getMinDateTime() // Reset to minimum datetime
    }
  })
}

function removeTask (event) {
  const taskElement = event.target.closest('.task')
  const taskId = taskElement.getAttribute('data-task-id')

  // Remove the task from the tasks array in local storage
  chrome.storage.local.get('tasks', function (data) {
    let tasks = data.tasks || []
    tasks = tasks.filter(task => task.id !== taskId) // Filter out the task with the matching ID
    chrome.storage.local.set({ tasks }, function () {
      console.log('Task removed:', taskId)
    })
  })

  // Remove the task element from the DOM
  taskElement.remove()
}

function saveOptions () {
  // Show loading spinner beside the "Save Options" button
  const saveOptionsBtn = document.getElementById('save-options-btn')
  const loadingSpinnerImg = document.createElement('img')
  loadingSpinnerImg.src = 'images/loading.gif' // Replace 'path_to_your_loading_spinner_image' with the actual path to your loading spinner image
  loadingSpinnerImg.width = '30' // Set the width of the spinner image
  loadingSpinnerImg.height = '30' // Set the height of the spinner image
  loadingSpinnerImg.style.padding = '10px' // Set padding to the right of the spinner image
  loadingSpinnerImg.style.verticalAlign = 'middle' //Align vertically

  saveOptionsBtn.parentNode.insertBefore(
    loadingSpinnerImg,
    saveOptionsBtn.nextSibling
  )

  const tasks = []
  const taskElements = document.querySelectorAll('.task')

  taskElements.forEach(taskElement => {
    const taskId = taskElement.getAttribute('data-task-id')
    const downloadTime = new Date(
      taskElement.querySelector('.download-time').value
    ).getTime()
    const currentTime = new Date().getTime()

    let status = 'pending' // Default status is pending if download time is in the future

    if (currentTime > downloadTime) {
      status = 'completed' // If download time has passed, mark task as completed
    }

    const task = {
      id: taskId,
      urls: taskElement
        .querySelector('.urls')
        .value.split('\n')
        .filter(url => url.trim() !== ''),
      fileTypes: [],
      prefix: taskElement.querySelector('.prefix').value.trim(),
      suffix: taskElement.querySelector('.suffix').value.trim(),
      folderName: taskElement.querySelector('.folderName').value.trim(),
      downloadTime: taskElement.querySelector('.download-time').value,
      zipDownload: taskElement.querySelector(`#zip-checkbox-${taskId}`).checked, // Include zipDownload property
      status: status // Set the status based on download time and current time
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

  chrome.storage.local.set({ tasks }, function () {
    console.log('Tasks saved:', tasks)
    executePendingTasks(tasks) // Execute pending tasks after saving options

    // Remove the loading spinner beside the "Save Options" button after 3 seconds
    setTimeout(() => {
      loadingSpinnerImg.remove()
    }, 1000) // 1000 milliseconds = 3 seconds
  })
}
