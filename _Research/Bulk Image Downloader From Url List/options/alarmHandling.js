    // Set up Chrome alarm to trigger periodically
    chrome.alarms.create('downloadAlarm', { periodInMinutes: 0.5 });
    chrome.alarms.onAlarm.addListener(handleAlarm);

    function handleAlarm(alarm) {
        if (alarm.name === 'downloadAlarm') {
            // Execute pending tasks when the alarm triggers
            chrome.storage.local.get('tasks', function (data) {
                const tasks = data.tasks || [];
                executePendingTasks(tasks);
            });
        }
    }