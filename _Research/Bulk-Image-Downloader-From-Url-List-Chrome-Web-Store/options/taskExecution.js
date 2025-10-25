    function executePendingTasks(tasks) {
        tasks.forEach(task => {
            if (
                task.status === 'pending' &&
                isDownloadTimeReached(task.downloadTime)
            ) {
                downloadFiles(task); // Execute the task only if its status is 'pending' and download time is reached
            }
        });
    }


async function downloadFiles(task) {
    if (task.zipDownload) {
        downloadZip(task);
    } else {
        // Download files individually
        task.urls.forEach(url => {
            // Fetch content type of the URL
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    // Extract filename from the URL
                    const filename = extractFilename(url);

                    // Extract filename without extension
                    const dotIndex = filename.lastIndexOf('.');
                    const filenameWithoutExtension = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;

                    // Extract extension from response headers
                    let extension = response.headers.get('content-type').split('/')[1];

                    // If content type is "octet-stream", extract extension from URL
                    if (extension === "octet-stream") {
                        const urlParts = url.split(".");
                        extension = urlParts[urlParts.length - 1];
                    }

                    // Check if the extension is allowed or if all formats are allowed
                    if (
                        task.fileTypes.includes(extension.toLowerCase()) ||
                        task.fileTypes.includes('all') ||
                        (extension === "octet-stream" && url.includes(".")) // Check if "octet-stream" and URL contains extension
                    ) {
                        // Construct new filename
                        let newFilename = `${task.prefix || ''}${filenameWithoutExtension}${task.suffix || ''}.${extension}`;

                        // Set the filename with folder path if folderName is provided
                        let filePath = task.folderName ? `${task.folderName}/${newFilename}` : newFilename;

                        // Initiate download with the specified options
                        chrome.downloads.download(
                            {
                                url: url,
                                filename: filePath,
                                conflictAction: 'uniquify', // Handle file conflicts
                                saveAs: false // Do not prompt for download location
                            },
                            function (downloadId) {
                                console.log('Download initiated with ID:', downloadId);

                                // Update task status to completed after download is initiated
                                task.status = 'completed';
                                saveUpdatedTask(task);
                            }
                        );
                    } else {
                        console.log(
                            `Skipping download of '${filename}' because its extension wasn't selected.`
                        );
                    }
                })
                .catch(error => {
                    console.error('Error fetching file:', error);
                });
        });
    }

    // Mark the task as completed
    task.status = 'completed';
    // Save the updated task status
    chrome.storage.local.get('tasks', function (data) {
        let tasks = data.tasks || [];
        tasks = tasks.map(t => (t.id === task.id ? task : t));
        chrome.storage.local.set({ tasks }, function () {
            console.log('Task status updated:', task.id, task.status);
        });
    });
}


async function downloadZip(task) {
    const zip = new JSZip();
    let filesProcessed = 0;
    let folderName = task.folderName || '';
    let imagesDownloaded = false; // Flag to track if any images were downloaded

    async function addFileToZip(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const urlObject = new URL(url);
            const filenameWithParams = urlObject.pathname.substring(urlObject.pathname.lastIndexOf('/') + 1);
            const filename = filenameWithParams.split('?')[0];
            const dotIndex = filename.lastIndexOf('.');
            const filenameWithoutExtension = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
            let extension = response.headers.get('content-type').split('/')[1];

            // If content type is "octet-stream", extract extension from URL
            if (extension === "octet-stream") {
                const urlParts = url.split(".");
                extension = urlParts[urlParts.length - 1];
            }

            if (
                task.fileTypes.includes(extension.toLowerCase()) ||
                task.fileTypes.includes('all') ||
                (extension === "octet-stream" && url.includes(".")) // Check if "octet-stream" and URL contains extension
            ) {
                let newFilename = `${task.prefix || ''}${filenameWithoutExtension}${task.suffix || ''}.${extension}`;
                const filePath = folderName ? `${folderName}/${newFilename}` : newFilename;

                const blob = await response.blob();
                zip.file(filePath, blob, { binary: true });
                filesProcessed++;

                // Set the flag to true since an image has been downloaded
                imagesDownloaded = true;
            } else {
                console.log(
                    `Skipping download of '${filename}' because its extension wasn't selected.`
                );
                filesProcessed++;
            }

            if (filesProcessed === task.urls.length) {
                if (!imagesDownloaded) {
                    // If no images were downloaded, add the message to the zip
                    const noImagesMessage = 'No images match selected image formats. You could try selecting the All formats option instead if you are not sure of the formats of your images';
                    zip.file('README_no_images_message.txt', noImagesMessage);
                    folderName = '';
                }
                zip.generateAsync({ type: 'blob' }).then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = folderName ? `${folderName}.zip` : 'no_image_matches_selected_image_formats.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }
        } catch (error) {
            console.error('Error fetching file:', error);
        }
    }

    task.urls.forEach(url => {
        addFileToZip(url);
    });
}