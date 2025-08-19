// urlManager.js - URL data manipulation, parsing and actions
import * as LZString from 'lz-string';
import { getState } from './state.js';
import { getRoutePoints } from './geometryUtils.js';
import { buildApiUrl } from './apiUtils.js';

/**
 * Initializes URL handling
 * @param {Object} appState - The application state manager
 * @returns {Promise} Promise resolving when URL handling is complete
 */
export function initializeURLHandling(appState) {
    console.log('Initializing URL handling...');
    
    // Return the promise directly
    return handleURLParameters(appState);
}

/**
 * Handles URL parameters for shared routes
 * @param {Object} appState - Application state manager
 * @returns {Promise} Promise resolving when handling is complete
 */
export function handleURLParameters(appState) {
    console.log('Checking for URL parameters...');
    
    // Return the promise chain explicitly
    return decodePointsFromUrl()
        .then(pointsDataFromUrl => {
            if (pointsDataFromUrl) {
                console.log('Found route data in URL:', pointsDataFromUrl);
                return processURLPoints(appState, pointsDataFromUrl);
            } else {
                // No URL parameters, check localStorage for saved route
                console.log('No URL parameters found, checking localStorage...');
                return checkLocalStorage(appState);
            }
        })
        .catch(error => {
            console.error('Error handling URL parameters:', error);
        });
}

/**
 * Processes points data from URL
 * @param {Object} appState - Application state manager
 * @param {Array} pointsDataFromUrl - Points data from URL
 * @returns {Promise} Promise resolving when processing is complete
 */
function processURLPoints(appState, pointsDataFromUrl) {
    return Promise.all([
        import('./routeProcessor.js'),
        import('./apiUtils.js')
    ]).then(([routeProcessor, apiUtils]) => {
        // First create the markers
        return createMarkersFromURLData(appState, pointsDataFromUrl);
    }).then(() => {
        // When route loading completes, fit to route
        return import('./viewportManager.js').then(viewportManager => {
            viewportManager.fitMapToRouteExplicit(appState);
        });
    }).catch(error => {
        console.error('Error processing route from URL:', error);
        import('./modal.js').then(modalModule => {
            modalModule.showModal({
                text: 'Failed to load the shared route. Please try again.'
            });
        });
        return Promise.reject(error);
    });
}

/**
 * Checks localStorage for saved route
 * @param {Object} appState - Application state manager
 * @returns {Promise} Promise resolving when check is complete
 */
function checkLocalStorage(appState) {
    const routeData = localStorage.getItem('routeData');
    const pointsData = localStorage.getItem('points');
    
    if (routeData && pointsData) {
        console.log("Found route and points data in localStorage");
        
        // Parse data
        const parsedPoints = JSON.parse(pointsData);
        const parsedRouteData = JSON.parse(routeData);
        
        if (parsedPoints.length < 2) {
            return Promise.resolve();
        }
        
        // Extract points
        const startPoint = parsedPoints[0];
        const endPoint = parsedPoints[parsedPoints.length - 1];
        const middlePoints = parsedPoints.slice(1, -1);
        
        // Update this to use routeProcessor directly
        return Promise.all([
            import('./markerManager.js'),
            import('./routeProcessor.js')  // Direct import
        ]).then(([markerModule, routeProcessor]) => {
            // Manually create the markers without calculating routes
            return import('./markerManager.js').then(markerModule => {
                // Create start marker without triggering route calc
                // Handle the case whether setMarker returns a promise or the marker directly
                const startMarkerResult = markerModule.setMarker(appState, L.latLng(startPoint.lat, startPoint.lng), 'start');
                
                // Ensure we have a Promise regardless of what setMarker returns
                const startMarkerPromise = startMarkerResult instanceof Promise ? 
                    startMarkerResult : Promise.resolve(startMarkerResult);
                
                return startMarkerPromise.then(() => {
                    // Add waypoints if any
                    if (middlePoints.length > 0) {
                        return import('./waypointManager.js').then(waypointModule => {
                            // Add each waypoint
                            middlePoints.forEach(point => {
                                waypointModule.addWaypointFromLatLng(
                                    appState, 
                                    L.latLng(point.lat, point.lng)
                                );
                            });
                            
                            // Create end marker without triggering route calc
                            const endMarkerResult = markerModule.setMarker(appState, L.latLng(endPoint.lat, endPoint.lng), 'end');
                            const endMarkerPromise = endMarkerResult instanceof Promise ? 
                                endMarkerResult : Promise.resolve(endMarkerResult);
                            
                            return endMarkerPromise.then(() => {
                                // Process route data using the new processor
                                return routeProcessor.processRoute(appState, parsedRouteData, {})
                                    .then(() => {
                                        // Then explicitly fit map to route to ensure it centers properly
                                        return import('./viewportManager.js').then(viewportManager => {
                                            console.log('Explicitly fitting map to route after localStorage load');
                                            // Using a timeout to ensure the route is fully rendered
                                            setTimeout(() => viewportManager.fitMapToRouteExplicit(appState), 300);
                                            return { routeLoaded: true };
                                        });
                                    });
                            });
                        });
                    }
                    // No waypoints, just add end marker
                    const endMarkerResult = markerModule.setMarker(appState, L.latLng(endPoint.lat, endPoint.lng), 'end');
                    const endMarkerPromise = endMarkerResult instanceof Promise ? 
                        endMarkerResult : Promise.resolve(endMarkerResult);
                    
                    return endMarkerPromise.then(() => {
                        // Process route data using the new processor
                        return routeProcessor.processRoute(appState, parsedRouteData, {})
                            .then(() => {
                                // Then explicitly fit map to route to ensure it centers properly
                                return import('./viewportManager.js').then(viewportManager => {
                                    console.log('Explicitly fitting map to route after localStorage load');
                                    // Using a timeout to ensure the route is fully rendered
                                    setTimeout(() => viewportManager.fitMapToRouteExplicit(appState), 300);
                                    return { routeLoaded: true };
                                });
                            });
                    });
                });
            });
        });
    }
    
    return Promise.resolve(); // Return a resolved promise if no data found
}

/**
 * Creates markers from URL route data
 * @param {Object} appState - Application state manager
 * @param {Array} pointsData - Array of points data
 * @returns {Promise} Promise resolving when markers are created
 */
export function createMarkersFromURLData(appState, pointsData) {
    if (!pointsData || pointsData.length < 2) {
        console.warn('Invalid points data for markers');
        return Promise.resolve();
    }
    
            const startPoint = pointsData[0];
        const endPoint = pointsData[pointsData.length - 1];
        const middlePoints = pointsData.slice(1, -1);
        
        // Create start marker
        return import('./markerManager.js').then(markerManager => {
            return markerManager.setMarker(appState, L.latLng(startPoint.lat, startPoint.lng), 'start')
            .then(() => {
                // Add waypoints if there are any
                if (middlePoints.length > 0) {
                    return import('./waypointManager.js').then(waypointManager => {
                        // Add waypoints sequentially
                        let chain = Promise.resolve();
                        
                        middlePoints.forEach(point => {
                            chain = chain.then(() => {
                                return waypointManager.addWaypointAndUpdateRoute(
                                    appState, 
                                    L.latLng(point.lat, point.lng)
                                );
                            });
                        });
                        
                        return chain;
                    });
                }
                return Promise.resolve();
            })
            .then(() => {
                // Finally create end marker which will trigger route calculation
                return markerManager.setMarker(appState, L.latLng(endPoint.lat, endPoint.lng), 'end');
            });
        });
}

/**
 * Generates a shareable URL for the current route
 * @param {Object} appState - Application state manager
 * @returns {Promise<string>} Promise resolving to shareable URL
 */
export function generateShareableURL(appState) {
    const points = getRoutePoints(appState);
    
    if (!points || points.length < 2) {
        return Promise.reject(new Error('No valid route to share'));
    }

    // Compress the points data
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(points));
    
    // Build the URL with the compressed data
    const url = new URL(window.location.href);
    url.search = ''; // Clear existing query parameters
    url.searchParams.set('points', compressed);
    
    console.log('Generated shareable URL:', url.toString());
    return Promise.resolve(url.toString());
}

/**
 * Encodes points data to a URL-friendly string
 * @param {Array} pointsData - Array of points
 * @returns {string} URL with encoded data
 */
export function encodePointsToUrl(pointsData) {
    const simplePoints = pointsData.map(p => ({lat: p.lat, lng: p.lng}));
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(simplePoints));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?points=${compressed}`;
}

/**
 * Decodes points data from a URL
 * @returns {Promise} Promise resolving to array of points or null
 */
export function decodePointsFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const compressedPoints = urlParams.get('points');
    
    console.log('URL params:', urlParams.toString());
    console.log('Compressed points:', compressedPoints);
    
    if (!compressedPoints) {
        console.log('No points parameter found in URL');
        return Promise.resolve(null);
    }
    
    try {
        // Decompress the points data
        const decompressed = LZString.decompressFromEncodedURIComponent(compressedPoints);
        console.log('Decompressed data:', decompressed);
        
        if (!decompressed) {
            console.error('Failed to decompress points data');
            return Promise.resolve(null);
        }
        
        const pointsData = JSON.parse(decompressed);
        console.log('Parsed points data:', pointsData);
        return Promise.resolve(pointsData);
    } catch (error) {
        console.error('Error decoding points from URL:', error);
        return Promise.resolve(null);
    }
}

/**
 * Process URL parameters after route is created
 * @param {Object} appState - Application state manager
 */
export function processURLParameters(appState) {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if we have route parameters
    const hasRouteParams = urlParams.has('points');
    
    // After successfully loading a route from parameters
    if (hasRouteParams) {
        // Give time for the route to be calculated and displayed
        setTimeout(() => {
                    import('./viewportManager.js').then(viewportManager => {
            viewportManager.fitMapToRouteExplicit(appState);
        });
        }, 200);
    }
}
