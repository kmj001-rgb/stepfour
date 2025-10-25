function areTasksEqual (task1, task2) {
  // Compare all properties of two tasks
  return JSON.stringify(task1) === JSON.stringify(task2)
}

// Define the extractFilename function
function extractFilename (url) {
  // Define function to extract filename from URL
  const filenameWithParams = url.substring(url.lastIndexOf('/') + 1)
  return filenameWithParams.split('?')[0]
}

// Function to remove duplicates from an array
function removeDuplicates (array) {
  return Array.from(new Set(array))
}

function saveUpdatedTask (task) {
  // Retrieve all tasks from local storage
  chrome.storage.local.get('tasks', function (data) {
    const tasks = data.tasks || []

    // Find the index of the task to be updated
    const index = tasks.findIndex(t => t.id === task.id)

    if (index !== -1) {
      // Update the task status
      tasks[index].status = task.status

      // Save the updated tasks to local storage
      chrome.storage.local.set({ tasks }, function () {
        console.log('Tasks saved after updating status:', tasks)

        // Show the updated status
        const updatedStatus = tasks[index].status
        console.log('Updated status:', updatedStatus)
      })
    }
  })
}
