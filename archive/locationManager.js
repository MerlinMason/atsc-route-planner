// locationManager.js - User location tracking and management
import { createMapIcons } from './mapManager.js';
import { getState } from './state.js';
import { reverseGeocode } from './geoCoding.js';

/**
 * Initializes location tracking
 * @param {Object} appState - The application state manager
 */
export function initializeLocationTracking(appState) {
    console.log('Initializing location tracking...');
    
    // Setup location tracking when requested
    document.getElementById('centerUser').addEventListener('click', () => {
        centerOnUser(appState);
    });
    
    document.getElementById('setStartLocation').addEventListener('click', () => {
        setStartToCurrentLocation(appState);
    });
    
    // The actual location watching will be handled by app.js
    // This ensures proper coordination with route loading
    return Promise.resolve();
}

/**
 * Centers the map on the user's current location
 * @param {Object} appState - Application state manager
 */
export function centerOnUser(appState) {
    import('./viewportManager.js').then(viewportManager => {
        viewportManager.centerOnUserExplicit(appState);
    });
}

/**
 * Gets the current user location
 * @returns {Promise} A promise that resolves to the user's current coordinates
 */
export function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            console.log('Geolocation request sent for current location...');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('Geolocation response received for current location');
                    resolve([position.coords.latitude, position.coords.longitude]);
                },
                (error) => {
                    console.error('Error getting current location:', error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                }
            );
        } else {
            reject(new Error('Geolocation is not supported by your browser.'));
        }
    });
}

/**
 * Initialize continuous watching of user location
 * @param {Object} appState - The application state manager
 * @param {number} retries - Number of retries if geolocation fails
 * @param {boolean} skipInitialCenter - Whether to skip initial centering (e.g., when loading route data)
 * @returns {Promise} A promise that resolves to the user's coordinates
 */
export function watchUserLocation(appState, retries = 5, skipInitialCenter = false) {
    let isFirstLocationUpdate = true;
    const map = appState.getMap();
    const icons = createMapIcons();

    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            console.log("Geolocation request sent...");
            
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    console.log("Geolocation response received...");
                    const userCoords = [position.coords.latitude, position.coords.longitude];
                    appState.setUserCoords(userCoords);
                    
                    if (isFirstLocationUpdate) {
                        // Pass the skipInitialCenter flag to viewportManager
                        import('./viewportManager.js').then(viewportManager => {
                            viewportManager.updateMapPosition(appState, { 
                                userLocationAvailable: true,
                                skipInitialCenter: skipInitialCenter
                            });
                        });
                        isFirstLocationUpdate = false;
                    }
                    
                    updateUserLocationMarker(appState, userCoords, icons.userLocationIcon);
                    
                    // If following user is enabled, keep the map centered on user
                    if (appState.isFollowingUser()) {
                        map.setView(userCoords, map.getZoom());
                    }
                    
                    resolve(userCoords);
                },
                (error) => {
                    console.log(`Geolocation error: ${error.message}`);
                    if (retries > 0) {
                        console.log(`Retrying geolocation (${retries} attempts left)...`);
                        watchUserLocation(appState, retries - 1).then(resolve).catch(reject);
                    } else {
                        reject(new Error('Failed to access your location after multiple attempts.'));
                    }
                }
            );
            
            // Store the watch ID for later cleanup
            appState.setWatchId(watchId);
        } else {
            reject(new Error('Geolocation is not supported by your browser.'));
        }
    });
}

/**
 * Updates the user location marker on the map
 * @param {Object} appState - Application state manager
 * @param {Array} coords - User coordinates [lat, lng]
 * @param {Object} icon - Leaflet icon for the user marker
 */
function updateUserLocationMarker(appState, coords, icon) {
    const map = appState.getMap();
    let userLocationMarker = appState.getUserLocationMarker();
    
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }
    
    userLocationMarker = L.marker(coords, { icon }).addTo(map);
    appState.setUserLocationMarker(userLocationMarker);
}

/**
 * Toggle following the user's location
 * @param {Object} appState - Application state manager
 */
export function toggleFollowUser(appState) {
    const userCoords = appState.getUserCoords();
    const followUser = !appState.isFollowingUser();
    
    appState.setFollowUser(followUser);
    
    if (followUser && userCoords) {
        appState.getMap().setView(userCoords, 16);
    }
    
    console.log(followUser ? "Following user location." : "Stopped following user location.");
}

/**
 * Sets the start location to the current user location
 * @param {Object} appState - Application state manager
 * @returns {Promise} Promise that resolves when location is set
 */
export function setStartToCurrentLocation(appState) {
    if (appState.isMarkersLocked()) {
        console.log("Markers are locked. Start location not set to current location.");
        return Promise.resolve();
    }

    console.log("Setting start location to current location...");
    
    // Store existing route data if available
    const hasExistingRoute = appState.getRouteLine() && appState.getEndMarker();
    const oldEndPoint = appState.getEndMarker() ? appState.getEndMarker().getLatLng() : null;
    const oldEndAddress = document.getElementById('endPostcode') ? 
                         document.getElementById('endPostcode').value : '';
    const oldWaypoints = appState.getWaypoints().map(wp => wp.getLatLng());

    // Clear existing markers and routes
    return clearMarkersAndRoutes(appState).then(() => {
        appState.setStartAddressChanged(true);

        // Log the start time for performance tracking
        const startTime = Date.now();
        console.log("Button pressed at:", new Date(startTime).toISOString());

        return new Promise(async (resolve, reject) => {
            try {
                let currentLocationLatLng;
                
                // Use existing location if available, otherwise fetch new location
                if (appState.getUserCoords()) {
                    console.log("Using cached location:", appState.getUserCoords());
                    currentLocationLatLng = L.latLng(appState.getUserCoords()[0], appState.getUserCoords()[1]);
                } else {
                    console.log("Fetching current location...");
                    const currentLocation = await getCurrentLocation();
                    if (!currentLocation) {
                        throw new Error('Could not get current location');
                    }
                    currentLocationLatLng = L.latLng(currentLocation[0], currentLocation[1]);
                }
                
                console.log("Setting start marker at", currentLocationLatLng.lat, currentLocationLatLng.lng);
                
                // Set the start marker
                const markerManager = await import('./markerManager.js');
                await markerManager.setMarker(appState, currentLocationLatLng, 'start', { byGeolocation: true });
                
                // Reset the start address changed flag since we've explicitly set it
                appState.setStartAddressChanged(false);
                
                // Log performance timing
                const markerPlacedTime = Date.now();
                console.log("Start marker placed at:", new Date(markerPlacedTime).toISOString());
                console.log("Time taken to place marker:", markerPlacedTime - startTime, "ms");
                
                // Restore end marker and waypoints if we had an existing route
                if (hasExistingRoute && oldEndPoint) {
                    await markerManager.setMarker(appState, oldEndPoint, 'end');
                    
                    // Set end address back
                    if (document.getElementById('endPostcode')) {
                        document.getElementById('endPostcode').value = oldEndAddress;
                    }
                    
                    // Restore waypoints after end marker is set
                    if (oldWaypoints && oldWaypoints.length > 0) {
                        const waypointManager = await import('./waypointManager.js');
                        for (const latLng of oldWaypoints) {
                            await waypointManager.addWaypointAndUpdateRoute(appState, latLng);
                        }
                    }
                }
                
                // Handle reverse geocoding
                const geoModule = await import('./geoCoding.js');
                geoModule.reverseGeocode(currentLocationLatLng, (address) => {
                    const startPostcodeInput = document.getElementById('startPostcode');
                    if (startPostcodeInput) {
                        startPostcodeInput.value = address;
                    }
                }, true);
                
                // Force a UI refresh
                appState.getMap().invalidateSize();
                
                resolve();
            } catch (error) {
                console.error('Error setting start location:', error);
                const modalModule = await import('./modal.js');
                modalModule.showModal({ 
                    text: 'Could not access your location. Please check your browser permissions.' 
                });
                reject(error);
            }
        });
    })
    .catch(error => {
        // Add error handling for the clearMarkersAndRoutes operation
        console.error('Error clearing previous route:', error);
        return Promise.reject(error);
    });
}



/**
 * Clears all markers and routes from the map
 * @param {Object} appState - Application state manager
 * @returns {Promise} Promise that resolves when clearing is complete
 */
function clearMarkersAndRoutes(appState) {
    // First reset the current instruction index to prevent highlight attempts
    appState.setCurrentInstructionIndex(-1);
    
    // Then clear the route with the comprehensive function
            return import('./routeManager.js').then(routeManager => {
            return routeManager.clearRoute(appState, false);
        });
}