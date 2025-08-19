// modal.js - Modal dialog management

// Queue for modal dialogs
const modalQueue = [];
let isModalVisible = false;

/**
 * Initializes modal functionality
 */
export function initializeModals() {
    console.log('Initializing modal system...');
    
    // Create modal container if it doesn't exist
    ensureModalContainerExists();
    
    // Show welcome modal for first-time visitors
    showWelcomeModalForFirstTimeVisitors();
}

/**
 * Shows the welcome modal for first-time visitors
 * Uses localStorage to track if user has visited before
 * @param {boolean} forceShow - If true, shows the modal regardless of whether the user has visited before
 */
export function showWelcomeModalForFirstTimeVisitors(forceShow = false) {
    // Check if user has visited before
    const hasVisitedBefore = localStorage.getItem('hasVisitedBefore');
    
    // If this is the first visit or forceShow is true, show the welcome modal
    if (!hasVisitedBefore || forceShow) {
        console.log('Showing welcome modal' + (forceShow ? ' (forced)' : ' (first-time visitor)'));
        
        // Welcome text with HTML formatting
        const welcomeHtml = `
            <div class="welcome-modal-content">
                <h2>Welcome to the All Terrain Ride Planner</h2>
                
                <p>This app helps you plan and navigate extra fun routes for bike rides. It'll try avoid busy roads and prefers paths and trails.</p>
                
                <h3>Here's how to get started:</h3>
                
                <ol>
                    <li>Set the start by entering an address or clicking the location icon <i class="material-icons">my_location</i> to use your current position</li>
                    <li>Enter your destination and click the route icon <i class="material-icons">route</i> to find a route between these points</li>
                    <li>Marvel at the route you just created!</li>
                </ol>
                
                <h3>Key features:</h3>
                
                <ul class="feature-list">
                    <li class="icon-item"><i class="material-icons">add_location</i> Add waypoints by rightclicking or long pressing on the map</li>
                    <li class="icon-item"><i class="material-icons">drag_indicator</i> Drag and reorder waypoints in the sidebar to adjust your journey</li>
                    <li class="icon-item"><i class="material-icons">location_searching</i> Centre the view on your current location</li>
                    <li class="icon-item"><i class="material-icons">autorenew</i> Reverse the route and all waypoints</li>
                    <li class="icon-item"><i class="material-icons">fit_screen</i> Fit the route to the viewport</li>
                    <li class="icon-item"><i class="material-icons">close</i> Clear the route</li>
                    <li class="icon-item"><i class="material-icons">lock_open</i> Lock the route, markers and waypoints</li>
                    <li class="icon-item"><i class="material-icons">share</i> Share your planned route with others via a unique URL</li>
                    <li class="icon-item"><i class="material-icons">download</i> Download your route as a GPX file for use in your favourite GPS device</li>
                    <li class="icon-item"><i class="material-icons">arrow_forward</i> Click through a list of directions to find your way</li>
                    <li class="icon-item"><i class="material-icons">terrain</i> View elevation data to prepare for climbs and descents</li>
                </ul>
                
                <p><em>I have no coding experience and this app was built entirely with LLMs.</em><br>
                <em>Don't expect Komoot or Strava quality.</em><br>
                <a href="https://oolex.co.uk" target="_blank">oolex.co.uk</a></p>
            </div>
        `;
        
        // Show modal with custom HTML content
        showModal({
            customContent: welcomeHtml,
            customHandler: (modal) => {
                // Apply welcome modal class to modal content
                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.classList.add('welcome-modal');
                }
                
                // Only mark that the user has visited the site if this is their first visit
                if (!hasVisitedBefore) {
                    localStorage.setItem('hasVisitedBefore', 'true');
                }
            }
        });
    }
}

/**
 * Resets the welcome modal flag so it will show again on next page load
 * Useful for testing purposes
 */
export function resetWelcomeModalFlag() {
    localStorage.removeItem('hasVisitedBefore');
    console.log('Welcome modal flag reset. The welcome modal will appear on next page load.');
}

/**
 * Shows a modal dialog
 * @param {Object} options - Modal options
 * @param {string} options.text - Text content for the modal
 * @param {boolean} options.input - Whether to show an input field
 * @param {Function} options.onSubmit - Function to call when the input is submitted
 * @param {string} options.defaultValue - Default value for the input field
 * @param {string} options.customContent - HTML for custom content
 * @param {Function} options.customHandler - Function to handle custom content events
 */
export function showModal(options) {
    // Add logging to track what's being passed to the modal
    console.log('showModal called with:', {
        text: options.text,
        input: !!options.input,
        customContent: !!options.customContent,
        hasCustomHandler: !!options.customHandler
    });

    // Add to queue and process
    modalQueue.push(options);
    if (!isModalVisible) {
        processModalQueue();
    }
}

/**
 * Ensures the modal container exists in the DOM
 */
function ensureModalContainerExists() {
    // Check if the modal container already exists
    if (!document.getElementById('genericModal')) {
        // Create the modal container
        const modalContainer = document.createElement('div');
        modalContainer.id = 'genericModal';
        modalContainer.className = 'modal';
        
        // Add modal content
        modalContainer.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <p id="modalText"></p>
                <input type="text" id="modalInput" style="display: none;">
                <button id="modalSubmit" style="display: none;">Submit</button>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(modalContainer);
    }
}

/**
 * Processes the modal queue, showing the next modal
 */
function processModalQueue() {
    if (modalQueue.length === 0) {
        isModalVisible = false;
        return;
    }

    isModalVisible = true;
    const options = modalQueue.shift();
    
    // Get modal elements
    const modal = document.getElementById('genericModal');
    const modalContent = modal.querySelector('.modal-content');
    const span = modal.getElementsByClassName('close')[0];
    const submitButton = document.getElementById('modalSubmit');
    const inputElement = document.getElementById('modalInput');
    const modalText = document.getElementById('modalText');
    
    // Get or create custom content container
    const customContainer = modalContent.querySelector('.custom-content') || document.createElement('div');
    
    // Clear previous content
    modalText.textContent = options.text || '';
    customContainer.innerHTML = '';
    
    // Handle custom content if provided
    if (options.customContent) {
        console.log('Setting up custom content');
        customContainer.className = 'custom-content';
        customContainer.innerHTML = options.customContent;
        modalContent.appendChild(customContainer);
        
        // Hide default input elements
        inputElement.style.display = 'none';
        submitButton.style.display = 'none';
        
        if (options.customHandler) {
            console.log('Executing custom handler');
            try {
                options.customHandler(modal);
                console.log('Custom handler executed successfully');
                console.log('Modal content after custom handler:', modal.innerHTML);
            } catch (error) {
                console.error('Error executing custom handler:', error);
            }
        } else {
            console.log('No custom handler provided');
        }
    } else {
        console.log('Using standard input mode');
        
        // Remove custom container if it exists
        if (customContainer.parentNode) {
            customContainer.parentNode.removeChild(customContainer);
        }
        
        // Configure input if requested
        inputElement.style.display = options.input ? 'block' : 'none';
        submitButton.style.display = options.input ? 'block' : 'none';
        
        if (options.input) {
            inputElement.value = options.defaultValue || '';
        }
    }

    // Function to close current modal and show next
    const showNextModal = () => {
        modal.classList.remove('show');
        modal.style.display = 'none';
        isModalVisible = false;
        
        // Process next modal after animation
        if (modalQueue.length > 0) {
            setTimeout(() => {
                processModalQueue();
            }, 100);
        }
    };

    // Show modal with animation
    requestAnimationFrame(() => {
        modal.style.display = 'block';
        modal.offsetHeight; // Force reflow for animation
        modal.classList.add('show');
    });

    // Handle close button
    span.onclick = () => {
        showNextModal();
    };

    // Handle custom content clicks if needed
    if (options.customContent && options.customHandler) {
        const buttons = modal.getElementsByClassName('address-option');
        Array.from(buttons).forEach(button => {
            button.addEventListener('click', () => {
                const chosenIndex = parseInt(button.dataset.index, 10);
                options.customHandler(modal, chosenIndex);
                showNextModal();
            });
        });
    }

    // Handle submit button
    if (options.onSubmit) {
        submitButton.onclick = () => {
            const inputValue = inputElement.value.trim();
            if (inputValue || !options.input) {
                options.onSubmit(inputValue);
                showNextModal();
            } else {
                alert('Please enter a valid value.');
            }
        };
        
        // Also handle Enter key
        inputElement.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                const inputValue = inputElement.value.trim();
                if (inputValue || !options.input) {
                    options.onSubmit(inputValue);
                    showNextModal();
                } else {
                    alert('Please enter a valid value.');
                }
            }
        });
    }
}