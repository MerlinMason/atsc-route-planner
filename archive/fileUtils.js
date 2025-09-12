// fileUtils.js - Consolidated file operations and GPX handling
import { getState } from './state.js';

/**
 * Initializes GPX saving functionality
 * @param {Object} appState - The application state manager
 */
export function initializeGPXSaving(appState) {
    console.log('Initializing GPX saving functionality...');
    
    // Add event listener for download button if not handled in eventManager
    const downloadGPXButton = document.getElementById('downloadGPX');
    if (downloadGPXButton) {
        downloadGPXButton.addEventListener('click', () => downloadGPXForRoute(appState));
    }
    
    // Make processGPXData available globally for compatibility
    window.processGPXData = (data) => processGPXData(appState, data);
}

/**
 * Downloads GPX file for the current route
 * @param {Object} appState - Application state manager
 * @returns {Promise} Promise that resolves when download is complete
 */
export function downloadGPXForRoute(appState) {
    return import('./routeManager.js').then(routeModule => {
        return routeModule.downloadGPX(appState)
            .then(gpxData => {
                return processGPXData(appState, gpxData);
            })
            .catch(error => {
                console.error('Error downloading GPX:', error);
                import('./modal.js').then(modalModule => {
                    modalModule.showModal({ text: error.message });
                });
            });
    });
}

/**
 * Processes GPX data before saving
 * @param {Object} appState - Application state manager
 * @param {string} data - GPX data as string
 */
export function processGPXData(appState, data) {
    try {
        console.log("Processing GPX data");
        
        // Parse the GPX data
        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(data, "application/xml");

        // Remove route elements (if desired)
        let rteElements = xmlDoc.getElementsByTagName('rte');
        console.log(`Found ${rteElements.length} 'rte' elements`);
        
        // Remove all route elements
        while (rteElements[0]) rteElements[0].parentNode.removeChild(rteElements[0]);

        // Serialize back to string
        let serializer = new XMLSerializer();
        let modifiedData = serializer.serializeToString(xmlDoc);

        console.log("Finished processing GPX data, starting file save");

        // Prompt for file name - THIS IS THE KEY PART
        promptForFileName(appState, modifiedData);
    } catch (error) {
        console.error("Error processing GPX data: ", error);
        
        // Show error modal
        import('./modal.js').then(modalModule => {
            modalModule.showModal({ text: `Error processing GPX data: ${error.message}` });
        });
    }
}

/**
 * Prompts the user for a filename for the GPX file
 * @param {Object} appState - Application state manager
 * @param {string} gpxData - GPX data to save
 */
function promptForFileName(appState, gpxData) {
    // Generate default file name from start and end addresses
    const startInput = document.getElementById('startPostcode')?.value?.trim() || 'Start';
    const endInput = document.getElementById('endPostcode')?.value?.trim() || 'End';
    let defaultFileName = `${startInput} to ${endInput}`;
    
    console.log('Default filename generation:', {
        startInput,
        endInput,
        defaultFileName
    });
    
    // Ensure we have a valid default filename
    if (!defaultFileName || defaultFileName === 'Start to End') {
        defaultFileName = 'My Route';
        console.log('Using fallback filename:', defaultFileName);
    }
    
    // Show filename prompt modal using dynamic import
    import('./modal.js').then(modalModule => {
        modalModule.showModal({
            text: 'Give your ride a name:',
            customContent: `
                <div class="gpx-save-container">
                    <input type="text" id="gpxFileNameInput" value="${defaultFileName}" />
                    <button id="saveGpxButton" class="control-button">
                        <i class="material-icons">download</i> Save GPX
                    </button>
                </div>
            `,
            customHandler: (modal) => {
                console.log('Setting up GPX save modal handlers');
                const saveButton = modal.querySelector('#saveGpxButton');
                const inputElement = modal.querySelector('#gpxFileNameInput');
                
                console.log('Found elements:', {
                    saveButton: !!saveButton,
                    inputElement: !!inputElement,
                    inputValue: inputElement?.value
                });
                
                // Handle save button click
                saveButton.addEventListener('click', () => {
                    console.log('Save button clicked');
                    console.log('Input element:', inputElement);
                    console.log('Input value:', inputElement?.value);
                    const fileName = inputElement?.value?.trim() || '';
                    console.log('Trimmed filename:', fileName);
                    if (fileName) {
                        saveGPXToFile(gpxData, fileName);
                        // Close the modal - The modal system will handle this
                        modal.querySelector('.close').click();
                    } else {
                        alert('Please enter a valid file name.');
                    }
                });
                
                // Handle Enter key press
                inputElement.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter') {
                        console.log('Enter key pressed');
                        const fileName = inputElement?.value?.trim() || '';
                        console.log('Trimmed filename (Enter):', fileName);
                        if (fileName) {
                            saveGPXToFile(gpxData, fileName);
                            // Close the modal
                            modal.querySelector('.close').click();
                        } else {
                            alert('Please enter a valid file name.');
                        }
                    }
                });
            }
        });
    });
}

/**
 * Saves GPX data to a file
 * @param {string} gpxData - The GPX data to save
 * @param {string} fileName - Name for the file
 */
function saveGPXToFile(gpxData, fileName) {
    // Add .gpx extension if not present
    if (!fileName.toLowerCase().endsWith('.gpx')) {
        fileName += '.gpx';
    }
    
    // Create blob and save using FileSaver
    import('file-saver').then(fileModule => {
        const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
        fileModule.default(blob, fileName);
    }).catch(error => {
        console.error('Error saving GPX file:', error);
        import('./modal.js').then(modalModule => {
            modalModule.showModal({ text: `Error saving file: ${error.message}` });
        });
    });
} 