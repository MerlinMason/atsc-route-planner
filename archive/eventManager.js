// eventManager.js - Centralized event handling
import { getState } from './state.js';

/**
 * Initializes all event listeners for the application
 * @param {Object} appState - The application state manager
 */
export function initializeEventListeners(appState) {
    console.log('Initializing event listeners...');
    
    setupRouteButtons(appState);
    setupInputListeners(appState);
    setupNavigationButtons(appState);
    
    // Info Modal button (show welcome modal on demand)
    const showInfoModalBtn = document.getElementById('showInfoModal');
    if (showInfoModalBtn) {
        showInfoModalBtn.addEventListener('click', async function() {
            console.log('Info button clicked, showing welcome modal');
            const modal = await import('./modal.js');
            modal.showWelcomeModalForFirstTimeVisitors(true); // true forces the modal to show regardless of the visited flag
        });
    }
}

/**
 * Sets up buttons related to route management
 * @param {Object} appState - Application state manager
 */
function setupRouteButtons(appState) {
    // Find Route button
    const findRouteBtn = document.getElementById('findRouteBtn');
    if (findRouteBtn) {
        findRouteBtn.addEventListener('click', () => {
            import('./routeManager.js').then(routeModule => {
                routeModule.findRoute(appState);
            });
        });
    }
    
    // Fit route button
    const fitRouteButton = document.getElementById('fitRoute');
    if (fitRouteButton) {
        fitRouteButton.addEventListener('click', () => {
            // Reset the navigation flag when user explicitly wants to fit to route
            appState.setUserNavigatedToDirectionStep(false);
            
            import('./viewportManager.js').then(viewportManager => {
                viewportManager.fitMapToRouteExplicit(appState, { isExplicitRequest: true });
            });
        });
    }
    
    // Clear route button
    const clearRouteButton = document.getElementById('clearRoute');
    if (clearRouteButton) {
        clearRouteButton.addEventListener('click', () => {
                    import('./routeManager.js').then(module => {
            module.clearRoute(appState, true);
        });
        });
    }
    
    // Reverse route button
    const reverseButton = document.getElementById('reverseWaypoints');
    if (reverseButton) {
        reverseButton.addEventListener('click', () => {
                    import('./routeManager.js').then(module => {
            module.reverseAndRecalculate(appState);
        });
        });
    }
    
    // Share route URL button
    const shareRouteURLButton = document.getElementById('shareRouteURL');
    if (shareRouteURLButton) {
        shareRouteURLButton.addEventListener('click', () => {
                    import('./urlManager.js').then(urlManager => {
            return urlManager.generateShareableURL(appState)
                .then(shareUrl => {
                    if (!shareUrl) {
                        import('./modal.js').then(modal => {
                            modal.showModal({ text: "Please create a route first." });
                        });
                        return;
                    }
                    
                    // Show in modal with copy button
                    import('./modal.js').then(modal => {
                        modal.showModal({
                            text: "Share this URL:",
                            customContent: `
                                <div class="share-url-container">
                                    <input type="text" id="shareUrlInput" class="share-url-input" value="${shareUrl}" readonly>
                                    <button id="copyShareUrl" class="control-button">
                                        <i class="material-icons">content_copy</i> Copy
                                    </button>
                                </div>
                            `,
                            customHandler: (modal) => {
                                const copyBtn = modal.querySelector('#copyShareUrl');
                                const urlInput = modal.querySelector('#shareUrlInput');
                                
                                copyBtn.addEventListener('click', () => {
                                    urlInput.select();
                                    document.execCommand('copy');
                                    copyBtn.innerHTML = '<i class="material-icons">check</i> Copied!';
                                    setTimeout(() => {
                                        copyBtn.innerHTML = '<i class="material-icons">content_copy</i> Copy';
                                    }, 2000);
                                });
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Error generating share URL:', error);
                });
        });
        });
    }
}

/**
 * Sets up input field event listeners
 * @param {Object} appState - Application state manager
 */
function setupInputListeners(appState) {
    // Start postcode input
    const startPostcodeInput = document.getElementById('startPostcode');
    if (startPostcodeInput) {
        startPostcodeInput.addEventListener('keyup', (event) => {
            console.log('Start postcode keyup event:', event.key);
            if (event.key === 'Enter') {
                console.log('Enter pressed in start postcode input');
                event.preventDefault();
                
                // Only find route if both inputs have values
                const endPostcodeInput = document.getElementById('endPostcode');
                if (startPostcodeInput.value.trim() && endPostcodeInput && endPostcodeInput.value.trim()) {
                    import('./routeManager.js').then(module => {
                        module.findRoute(appState);
                    });
                }
            }
        });
        
        startPostcodeInput.addEventListener('input', (event) => {
            console.log('Start postcode changed:', event.target.value);
            appState.setStartAddressChanged(true);
        });
    }
    
    // End postcode input
    const endPostcodeInput = document.getElementById('endPostcode');
    if (endPostcodeInput) {
        endPostcodeInput.addEventListener('keyup', (event) => {
            console.log('End postcode keyup event:', event.key);
            if (event.key === 'Enter') {
                console.log('Enter pressed in end postcode input');
                event.preventDefault();
                
                // Only find route if both inputs have values
                if (startPostcodeInput && startPostcodeInput.value.trim() && endPostcodeInput.value.trim()) {
                    import('./routeManager.js').then(module => {
                        module.findRoute(appState);
                    });
                }
            }
        });
        
        endPostcodeInput.addEventListener('input', (event) => {
            console.log('End postcode changed:', event.target.value);
            appState.setEndAddressChanged(true);
        });
    }
}

/**
 * Sets up navigation control buttons
 * @param {Object} appState - Application state manager
 */
function setupNavigationButtons(appState) {
    // Previous direction button
    const prevDirectionButton = document.getElementById('prevDirection');
    if (prevDirectionButton) {
        prevDirectionButton.addEventListener('click', () => {
            import('./directionsManager.js').then(module => {
                module.changeDirection(appState, -1);
            });
        });
    }
    
    // Next direction button
    const nextDirectionButton = document.getElementById('nextDirection');
    if (nextDirectionButton) {
        nextDirectionButton.addEventListener('click', () => {
            import('./directionsManager.js').then(module => {
                module.changeDirection(appState, 1);
            });
        });
    }
}