$(function () {
  // Retrieve the saved lock status from local storage or set to false if not found
  var isLocked = localStorage.getItem('isLocked') === 'true' ? true : false

  // Function to update lock status and UI
  function updateLockStatus () {
    $('#tasks-container').sortable('option', 'disabled', isLocked)
    $('.lock-btn').text(isLocked ? 'Unlock Drag' : 'Lock Drag')
    localStorage.setItem('isLocked', isLocked) // Save the lock status to local storage
  }

  $('#tasks-container, #sortable').sortable({
    placeholder: 'sortable-placeholder',
    forcePlaceholderSize: true,
    start: function (event, ui) {
      if (isLocked) {
        // Prevent dragging if tasks are locked
        event.preventDefault()
      } else {
        ui.placeholder.addClass('dragging-placeholder')
      }
    },
    stop: function (event, ui) {
      ui.placeholder.removeClass('dragging-placeholder')
    },
    disabled: isLocked, // Disable sorting if tasks are locked
    // Call updateLockStatus after the sortable is initialized
    create: function (event, ui) {
      updateLockStatus()
    }
  })

  // Add click event handler for the lock button outside #tasks-container
  $(document).on('click', '.lock-btn', function () {
    isLocked = !isLocked // Toggle the lock state
    updateLockStatus()
  })
})
