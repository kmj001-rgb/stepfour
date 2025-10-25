/*
    const exportTasksBtn = document.getElementById('export-tasks-btn');
exportTasksBtn.addEventListener('click', exportTasks);

function exportTasks() {
    chrome.storage.local.get('tasks', function (data) {
        const tasks = data.tasks || [];
        if (tasks.length === 0) {
            console.log('No tasks to export');
            return;
        }

        // Create CSV content
        let csvContent = 'data:text/csv;charset=utf-8,';
        
        // Add task data
        const taskIDs = tasks.map(task => task.id).join(','); // Comma-separated task IDs
        const taskFileTypes = tasks.map(task => task.fileTypes.join(':')).join(','); // Comma-separated file types
        const taskPrefixes = tasks.map(task => task.prefix || '').join(','); // Comma-separated prefixes
        const taskSuffixes = tasks.map(task => task.suffix || '').join(','); // Comma-separated suffixes
        const taskFolderNames = tasks.map(task => task.folderName || '').join(','); // Comma-separated folder names
        const taskDownloadTimes = tasks.map(task => task.downloadTime || '').join(','); // Comma-separated download times
        const taskZipDownloads = tasks.map(task => task.zipDownload ? 'Yes' : 'No').join(','); // Comma-separated zip downloads
        const taskStatuses = tasks.map(task => task.status || '').join(','); // Comma-separated statuses
        const taskURLs = tasks.map(task => task.urls.join('|')).join(','); // Comma-separated URLs

        // Concatenate all task data with commas
        csvContent += `Task IDs:,${taskIDs}\n`; // Task IDs as header
        csvContent += `File Types:,${taskFileTypes}\n`; // File Types as header
        csvContent += `Prefix:,${taskPrefixes}\n`; // Prefixes as header
        csvContent += `Suffix:,${taskSuffixes}\n`; // Suffixes as header
        csvContent += `Folder Name:,${taskFolderNames}\n`; // Folder Names as header
        csvContent += `Download Time:,${taskDownloadTimes}\n`; // Download Times as header
        csvContent += `Zip Download:,${taskZipDownloads}\n`; // Zip Downloads as header
        csvContent += `Status:,${taskStatuses}\n`; // Statuses as header
        csvContent += `URLs (Separated by |):,${taskURLs}\n\n`; // URLs as header

        // Create a download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "tasks.csv");
        document.body.appendChild(link);

        // Trigger the download
        link.click();
    });
}
*/