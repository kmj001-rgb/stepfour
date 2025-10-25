    // Define the addTaskToDOM function
    function addTaskToDOM(task) {
        const taskId = task.id || Date.now().toString(); // Generate ID if not present
        const taskTemplate = `
            <div class="task" draggable="true" data-task-id="${taskId}"><div style="font-size:9px; float:right;">#${task.id}</div>
                <div class="${task.status}"></div>
                <textarea class="urls" rows="3" cols="30" placeholder="Enter image URLs">${task.urls.join(
                    '\n'
                )}</textarea>
                <div><details>
                    <summary class="opt-others">Select File Types</summary>  
                      <label><input type="checkbox" id="all-formats-checkbox-${taskId}" class="file-type" value="all"> All Types</label>
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
                    <label class="zipit"><input type="checkbox" id="zip-checkbox-${taskId}" class="zip-checkbox" ${
            task.zipDownload ? 'checked' : ''
        }>Zip</label>
                </div>
                <input type="datetime-local" class="download-time" value="${
                    task.downloadTime
                }">
                <input type="text" class="prefix" value="${
                    task.prefix || ''
                }" placeholder="Prefix">
                <input type="text" class="suffix" value="${
                    task.suffix || ''
                }" placeholder="Suffix">
                <input type="text" class="folderName" value="${
                    task.folderName || ''
                }" placeholder="Folder Name">
                <button class="remove-task-btn">x</button>
                <button class="strip-duplicates-btn">Strip Duplicates</button> 
            </div>
        `;

        tasksContainer.insertAdjacentHTML('beforeend', taskTemplate);

        // Preselect checkboxes based on saved data
        const allFormatsCheckbox = document.getElementById(`all-formats-checkbox-${taskId}`);
        if (task.fileTypes.includes('all')) {
            allFormatsCheckbox.checked = true;
        } else {
            task.fileTypes.forEach(fileType => {
                const checkbox = tasksContainer.querySelector(`.file-type-${taskId}[value="${fileType}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }

        // Initialize ZIP checkbox state
        const zipCheckbox = document.getElementById(`zip-checkbox-${taskId}`);
        zipCheckbox.checked = task.zipDownload; // Set checkbox based on zipDownload property
    }


        // Inside the stripDuplicates function in options.js
    function stripDuplicates(event) {
        const taskElement = event.target.closest('.task');
        const taskId = taskElement.getAttribute('data-task-id');

        const urlsTextarea = taskElement.querySelector('.urls')
        const urls = urlsTextarea.value.split('\n').filter(url => url.trim() !== '')
        const uniqueUrls = [...new Set(urls)] // Use a Set to remove duplicates
        urlsTextarea.value = uniqueUrls.join('\n')

        // Get the task from local storage
        chrome.storage.local.get('tasks', function (data) {
            const tasks = data.tasks || [];
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                // Logic to remove duplicates from the task.urls array
                task.urls = removeDuplicates(task.urls);
                console.log('Duplicates removed:', task.urls);
                // Update the task in local storage
                const updatedTasks = tasks.map(t => (t.id === taskId ? task : t));
                chrome.storage.local.set({ tasks: updatedTasks }, function () {
                    console.log('Task updated with removed duplicates:', task);
                });
            }
        });
    }
