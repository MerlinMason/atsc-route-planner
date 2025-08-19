// markerManager.js - Handling map markers
import { createMapIcons, createWaypointIcon } from './mapManager.js';
import { reverseGeocode } from './geoCoding.js';
import { getState } from './state.js';
import { updateWaypointNumbers } from './waypointManager.js';

let pressTimer = null;
let tempConfirmMarker = null;
let markerType = null;
let markerTimeout = null;
let ignoreNextClick = false;
let lastTouchEndTime = 0;
let lastTouchPos = null;

// Detect mobile/touch device
const isTouchDevice = 'ontouchstart' in window || 
                      navigator.maxTouchPoints > 0 ||
                      navigator.msMaxTouchPoints > 0;

/**
 * Initializes marker management
 * @param {Object} appState - The application state manager
 */
export function initializeMarkerManagement(appState) {
    const map = appState.getMap();
    
    // Use Leaflet's contextmenu event which works on both desktop and mobile
    map.on('contextmenu', function(e) {
        if (appState.isMarkersLocked()) return;
        
        // Don't prevent default immediately
        if (e.originalEvent) {
            const target = e.originalEvent.target;
            if (target.classList.contains('leaflet-marker-icon')) {
                return; // Don't create marker if clicking existing one
            }
        }
        
        createTempMarker(appState, e.latlng);
    });

    // Handle marker confirmation
    map.on('click', function(e) {
        if (tempConfirmMarker) {
            const clickPos = map.latLngToContainerPoint(e.latlng);
            const markerPos = map.latLngToContainerPoint(tempConfirmMarker.getLatLng());
            const distance = clickPos.distanceTo(markerPos);
            
            if (distance < 30) { // 30px radius for touch
                confirmMarkerPlacement(appState, markerType);
            } else {
                removeTemporaryMarker(appState);
            }
        }
    });

    // Single touch handler for long press
    let touchStartTime;
    let touchTimeout;
    let startPos;
    
    map.on('touchstart', function(e) {
        if (appState.isMarkersLocked()) return;
        
        // Prevent map panning during potential long press
        L.DomEvent.preventDefault(e);
        
        touchStartTime = Date.now();
        startPos = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            latlng: map.containerPointToLatLng([e.touches[0].clientX, e.touches[0].clientY])
        };
        
        // Start long press timer
        touchTimeout = setTimeout(() => {
            const moveThreshold = 10; // pixels
            if (startPos && // Still have original position
                Math.abs(e.touches[0].clientX - startPos.x) < moveThreshold &&
                Math.abs(e.touches[0].clientY - startPos.y) < moveThreshold) {
                
                console.log("Long press detected");
                createTempMarker(appState, startPos.latlng);
            }
        }, 700); // 700ms for long press
    });

    map.on('touchmove', function(e) {
        if (touchTimeout && startPos) {
            const moveThreshold = 10; // pixels
            if (Math.abs(e.touches[0].clientX - startPos.x) > moveThreshold ||
                Math.abs(e.touches[0].clientY - startPos.y) > moveThreshold) {
                // Cancel long press if moved too far
                clearTimeout(touchTimeout);
                touchTimeout = null;
                startPos = null;
            }
        }
    });

    map.on('touchend', function() {
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        startPos = null;
    });
    
    // MOUSE EVENTS for desktop
    map.on('mousedown', (e) => {
        handlePointerStart(e, appState);
    });
    
    map.on('mouseup', () => {
        handlePointerEnd();
    });
    
    map.on('mouseout', () => {
        handlePointerEnd();
    });
    
    // Set up drag handling to cancel long press
    map.on('dragstart', () => {
        handlePointerEnd();
    });
    
    // Normal click should only affect the temporary marker
    map.on('click', (e) => {
        // Don't process click if immediately after touch end (prevents double triggers)
        if (Date.now() - lastTouchEndTime < 300) {
            return;
        }
        handleMapClick(e, appState);
    });
    
    // Handle tap on mobile
    map.on('tap', (e) => {
        // Add small delay to ensure we don't detect taps from long presses
        setTimeout(() => {
            handleMapClick(e, appState);
        }, 50);
    });
    
    // Set up marker lock button
    const lockButton = document.getElementById('lockButton');
    if (lockButton) {
        lockButton.addEventListener('click', () => toggleMarkersLocked(appState));
    }
}

/**
 * Handles the start of a pointer interaction (mouse down or touch start)
 * @param {Object} e - Event object
 * @param {Object} appState - Application state
 * @param {boolean} isTouch - Whether this is a touch event
 */
function handlePointerStart(e, appState, isTouch = false) {
    if (appState.isMarkersLocked()) return;
    
    // Check if the event is on an existing marker
    let isOnMarker = false;
    
    // Check if pointer is on start or end marker or waypoint
    const startMarker = appState.getStartMarker();
    const endMarker = appState.getEndMarker();
    const waypoints = appState.getWaypoints();
    
    if (startMarker || endMarker || waypoints.length > 0) {
        // Get the DOM element that was interacted with
        let targetElement;
        
        if (isTouch && e.touches && e.touches[0]) {
            // For touch events, get element at touch position
            targetElement = document.elementFromPoint(
                e.touches[0].clientX, 
                e.touches[0].clientY
            );
        } else if (e.originalEvent && e.originalEvent.target) {
            // For mouse events, use the target directly
            targetElement = e.originalEvent.target;
        }
        
        // Check if element exists and is/contains a marker
        if (targetElement) {
            // Check for marker classes or parent marker elements
            isOnMarker = targetElement.closest('.leaflet-marker-icon') !== null ||
                         targetElement.classList.contains('leaflet-marker-icon') ||
                         targetElement.classList.contains('leaflet-marker-shadow');
                         
            // Also check if it's inside a marker's hit area
            if (!isOnMarker) {
                const allMarkers = [
                    ...(startMarker ? [startMarker] : []), 
                    ...(endMarker ? [endMarker] : []), 
                    ...waypoints
                ];
                
                if (isTouch && e.touches && e.touches[0]) {
                    const touchPoint = appState.getMap().containerPointToLatLng(
                        L.point(e.touches[0].clientX, e.touches[0].clientY)
                    );
                    
                    // Check if touch is on or near any marker
                    isOnMarker = allMarkers.some(marker => {
                        const markerPos = marker.getLatLng();
                        const distance = touchPoint.distanceTo(markerPos);
                        // Larger hit area for touch (increased from 25 to 35 pixels)
                        return distance < 35;
                    });
                }
            }
        }
    }
    
    // Only start the press timer if not interacting with an existing marker
    if (!isOnMarker) {
        clearTimeout(pressTimer);  // Clear any existing timer
        
        // Use longer press time for mobile
        const pressDelay = isTouch || isTouchDevice ? 700 : 500;
        
        pressTimer = setTimeout(() => {
            // For touch events, now prevent default to stop panning
            if (isTouch && e.originalEvent) {
                e.originalEvent.preventDefault();
            }
            handleLongPress(appState, e, isTouch);
        }, pressDelay);
    }
}

/**
 * Handles the end of a pointer interaction (mouse up, touch end)
 */
function handlePointerEnd() {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
}

/**
 * Handles map click or tap events
 * @param {Object} e - Event object
 * @param {Object} appState - Application state
 */
function handleMapClick(e, appState) {
    // If we're ignoring clicks or no temp marker exists, do nothing
    if (ignoreNextClick || !tempConfirmMarker) {
        ignoreNextClick = false; // Reset the flag
        return;
    }
    
    // Check if click is on the temporary marker
    const markerLatLng = tempConfirmMarker.getLatLng();
    const clickLatLng = e.latlng;
    const distance = clickLatLng.distanceTo(markerLatLng);
    
    // Larger threshold for mobile devices (60px is more generous)
    const clickThreshold = isTouchDevice ? 60 : 30;
    
    console.log("Click near marker, distance:", distance, "threshold:", clickThreshold);
    
    if (distance < clickThreshold) { // pixel threshold for "clicking on marker"
        console.log("Click confirmed on temporary marker");
        confirmMarkerPlacement(appState, markerType);
    } else {
        // Click elsewhere, remove the temp marker
        removeTemporaryMarker(appState);
    }
}

/**
 * Handles a long press event on the map
 * @param {Object} appState - Application state manager
 * @param {Object} e - Map event
 * @param {boolean} isTouch - Whether this is a touch event
 */
function handleLongPress(appState, e, isTouch = false) {
    // Set this flag BEFORE creating the temporary marker
    ignoreNextClick = true;
    
    // Remove any existing temporary marker
    removeTemporaryMarker(appState);
    
    // Get the coordinates - be extra careful with touch events
    let latlng;

    console.log("Handle long press called, isTouch:", isTouch);

    try {
        if (isTouch) {
            if (e.touches && e.touches[0]) {
                latlng = appState.getMap().containerPointToLatLng(
                    L.point(e.touches[0].clientX, e.touches[0].clientY)
                );
                console.log("Using e.touches[0]:", e.touches[0].clientX, e.touches[0].clientY);
            } 
            else if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches[0]) {
                latlng = appState.getMap().containerPointToLatLng(
                    L.point(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY)
                );
                console.log("Using e.originalEvent.touches[0]");
            }
            else if (e.changedTouches && e.changedTouches[0]) {
                latlng = appState.getMap().containerPointToLatLng(
                    L.point(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
                );
                console.log("Using e.changedTouches[0]");
            }
            else {
                console.log("Falling back to e.latlng for touch event");
                latlng = e.latlng;
            }
        } else {
            latlng = e.latlng;
            console.log("Using e.latlng for mouse event");
        }
        
        console.log("Final latlng:", latlng);
    } catch (error) {
        console.error("Error extracting coordinates:", error);
        return;
    }
    
    // Determine marker type
    markerType = determineMarkerType(appState);

    // Create marker without fade-in animation
    createTemporaryMarkerWithIcon(appState, latlng, false).then(marker => {
        tempConfirmMarker = marker;
        
        // Auto-remove after delay if not confirmed
        markerTimeout = setTimeout(() => {
            fadeOutAndRemoveMarker(appState);
        }, 2000);
        
        // Add both click and touch handlers
        tempConfirmMarker.on('click touchstart', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            confirmMarkerPlacement(appState, markerType);
        });
    });
}

/**
 * Creates a temporary marker directly (simplified path for touch)
 * @param {Object} appState - Application state
 * @param {Object} latlng - The coordinates where to place the marker
 */
function createTempMarker(appState, latlng) {
    console.log("Creating temporary marker at", latlng.lat, latlng.lng);
    
    // Remove any existing temporary marker
    removeTemporaryMarker(appState);
    
    // Determine marker type
    markerType = determineMarkerType(appState);
    
    createTemporaryMarkerWithIcon(appState, latlng, false).then(marker => {
        tempConfirmMarker = marker;
        
        // Auto-remove after delay if not confirmed
        markerTimeout = setTimeout(() => {
            fadeOutAndRemoveMarker(appState);
        }, 2000);
        
        // Add both click and touch handlers
        tempConfirmMarker.on('click touchstart', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            confirmMarkerPlacement(appState, markerType);
        });
    });
}

/**
 * Confirms marker placement and creates the actual marker
 * @param {Object} appState - Application state manager
 * @param {string} type - The type of marker to create
 */
function confirmMarkerPlacement(appState, type) {
    if (!tempConfirmMarker) return;
    
    const latLng = tempConfirmMarker.getLatLng();
    
    // Clear any existing timeout
    if (markerTimeout) {
        clearTimeout(markerTimeout);
        markerTimeout = null;
    }
    
    // Remove the temporary marker
    removeTemporaryMarker(appState);
    
    // Handle different marker types
    if (type === 'waypoint') {
        import('./waypointManager.js').then(waypointManager => {  // CHANGE: Use waypointManager directly
            waypointManager.addWaypointAndUpdateRoute(appState, latLng);
        });
    } else {
        // Direct call to setMarker since we're already in markerManager
        setMarker(appState, latLng, type);
    }
}

/**
 * Fades out and removes the temporary marker
 * @param {Object} appState - Application state manager
 */
function fadeOutAndRemoveMarker(appState) {
    if (!tempConfirmMarker) return;
    
    const markerElement = tempConfirmMarker.getElement();
    if (markerElement) {
        markerElement.style.opacity = '0';
        setTimeout(() => {
            removeTemporaryMarker(appState);
        }, 200); // Wait for fade out animation
    } else {
        removeTemporaryMarker(appState);
    }
}

/**
 * Removes the temporary marker
 * @param {Object} appState - Application state manager
 */
function removeTemporaryMarker(appState) {
    if (tempConfirmMarker) {
        appState.getMap().removeLayer(tempConfirmMarker);
        tempConfirmMarker = null;
    }
    
    if (markerTimeout) {
        clearTimeout(markerTimeout);
        markerTimeout = null;
    }
    
    markerType = null;
}

/**
 * Handles map click events (no longer directly adds markers)
 * @param {Object} appState - Application state manager
 * @param {Object} e - Map click event
 */
export function mapClickHandler(appState, e) {
    // The actual marker placement is now handled by the long press system
    console.log("Map clicked, but markers are now created with long press");
}

/**
 * Creates or updates a marker on the map
 * @param {Object} appState - Application state manager
 * @param {Object} latLng - Latitude and longitude object
 * @param {string} type - Type of marker ('start', 'end', or 'waypoint')
 * @param {Object} options - Additional options
 * @param {boolean} options.byGeolocation - Whether marker was set by geolocation
 * @param {number} options.waypointNumber - Waypoint number (for waypoint markers)
 * @param {boolean} options.skipRouteUpdate - Skip route calculation update
 * @returns {Promise<Object>} Promise that resolves to the created or updated marker
 */
export function setMarker(appState, latLng, type, options = {}) {
    // Handle cases where map isn't ready by returning a Promise
    if (!appState.getMap() || !appState.isMapReady()) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (!appState.getMap() || !appState.isMapReady()) {
                    reject(new Error('Map not available'));
                    return;
                }
                setMarker(appState, latLng, type, options)
                    .then(resolve)
                    .catch(reject);
            }, 200);
        });
    }
    
    // The rest of the function will be wrapped in a Promise
    return new Promise(resolve => {
        const map = appState.getMap();
        let marker;
        
        // Get proper icon based on type
        const icons = createMapIcons();
        let icon;
        const { 
            byGeolocation = false, 
            waypointNumber, 
            skipRouteUpdate = false 
        } = options;
        
        switch(type) {
            case 'start':
                icon = icons.startIcon;
                marker = appState.getStartMarker();
                break;
            case 'end':
                icon = icons.endIcon;
                marker = appState.getEndMarker();
                break;
            case 'waypoint':
                // Let the centralized function handle numbering
                const waypoints = appState.getWaypoints();
                icon = createWaypointIcon(waypoints.length + 1);
                break;
            default:
                throw new Error(`Unknown marker type: ${type}`);
        }
        
        // Update existing marker or create new one
        if (marker) {
            marker.setLatLng(latLng);
        } else {
            marker = L.marker(latLng, { 
                icon: icon, 
                draggable: !appState.isMarkersLocked() 
            }).addTo(map);
            
            // Update state
            if (type === 'start') {
                appState.setStartMarker(marker);
            } else if (type === 'end') {
                appState.setEndMarker(marker);
            }
            // Waypoints are handled separately
        }
        
        // Store whether marker was set by geolocation
        marker._byGeolocation = byGeolocation;
        
        // Add drag event handler
        marker.on('dragend', function() {
            // Use coordinator pattern for updating location input
                    // Handle marker drag directly
        import('./geoCoding.js').then(geoModule => {
            return geoModule.reverseGeocode(marker.getLatLng(), (address) => {
                const inputField = document.getElementById(type === 'start' ? 'startPostcode' : 'endPostcode');
                if (inputField) {
                    inputField.value = address;
                }
            }, type === 'start');
        }).then(() => {
            if (!skipRouteUpdate) {
                return import('./routeProcessor.js').then(routeProcessor => {
                    return routeProcessor.updateRoute(appState, {
                        source: 'marker_drag',
                        skipZooming: true
                    });
                });
            }
            return Promise.resolve();
        });
        });
        
        // Update location input if needed (using coordinator pattern)
        if (!byGeolocation) {
                    // Update address from marker directly
        import('./geoCoding.js').then(geoModule => {
            return geoModule.reverseGeocode(marker.getLatLng(), (address) => {
                const inputField = document.getElementById(type === 'start' ? 'startPostcode' : 'endPostcode');
                if (inputField) {
                    inputField.value = address;
                }
            }, type === 'start');
        });
        }
        
        // After setting the marker, check if we should calculate a route
        if (type === 'end' && appState.getStartMarker() && appState.getEndMarker()) {
            // Both markers exist, calculate route
            import('./routeProcessor.js').then(routeProcessor => {
                return routeProcessor.updateRoute(appState, {
                    source: 'marker_placement',
                    skipZooming: false
                });
            });
        }
        
        // Resolve the Promise with the marker
        resolve(marker);
    });
}

/**
 * Toggles whether markers are locked (can't be moved or added)
 * @param {Object} appState - Application state manager
 */
export function toggleMarkersLocked(appState) {
    const lockButton = document.getElementById('lockButton');
    const newLockedState = !appState.isMarkersLocked();
    
    appState.setMarkersLocked(newLockedState);
    
    // Update lock button appearance
    if (lockButton) {
        lockButton.innerHTML = newLockedState ? 
            '<i class="material-icons">lock</i>' : 
            '<i class="material-icons">lock_open</i>';
    }
    
    // Enable/disable dragging on all markers
    toggleMarkerDragging(appState, !newLockedState);
    
    return newLockedState;
}

/**
 * Enables or disables dragging on all markers
 * @param {Object} appState - Application state manager
 * @param {boolean} draggable - Whether markers should be draggable
 */
function toggleMarkerDragging(appState, draggable) {
    // Start and end markers
    if (appState.getStartMarker()) {
        draggable ? appState.getStartMarker().dragging.enable() : appState.getStartMarker().dragging.disable();
    }
    
    if (appState.getEndMarker()) {
        draggable ? appState.getEndMarker().dragging.enable() : appState.getEndMarker().dragging.disable();
    }
    
    // All waypoints
    appState.getWaypoints().forEach(waypoint => {
        draggable ? waypoint.dragging.enable() : waypoint.dragging.disable();
    });
}

/**
 * Helper function to create a temporary marker with optional fade-in animation
 * @param {Object} appState - Application state manager
 * @param {L.LatLng} latlng - The coordinates for the marker
 * @param {boolean} withFadeIn - Whether to add a fade-in animation
 * @returns {Promise<L.Marker>} Promise that resolves to the created marker
 */
function createTemporaryMarkerWithIcon(appState, latlng, withFadeIn = false) {
    return import('./mapManager.js').then(module => {
        const confirmIcon = module.createConfirmationMarkerIcon();
        
        // Create the marker
        const marker = L.marker(latlng, {
            icon: confirmIcon,
            zIndexOffset: 1000 // Ensure it's on top
        }).addTo(appState.getMap());
        
        // Set up animation or immediate visibility
        const markerElement = marker.getElement();
        if (markerElement) {
            if (withFadeIn) {
                markerElement.style.opacity = '0';
                markerElement.style.transition = 'opacity 0.2s';
                setTimeout(() => {
                    markerElement.style.opacity = '1';
                }, 10);
            } else {
                markerElement.style.opacity = '1';
            }
        }
        
        return marker;
    });
}

/**
 * Determines what type of marker to create next
 * @param {Object} appState - Application state manager
 * @returns {string} The type of marker ('start', 'end', or 'waypoint')
 */
function determineMarkerType(appState) {
    if (!appState.getStartMarker()) return 'start';
    if (!appState.getEndMarker()) return 'end';
    return 'waypoint';
}