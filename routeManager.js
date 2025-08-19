// routeManager.js - Route calculation and management
import { geocodeAddress, getAddressComponents, validateAddress } from './geoCoding.js';
import { AppState, getState } from './state.js';
import { 
    findClosestPointOnSegment, 
    getSegmentLength, 
    calculateDynamicPadding, 
    fitMapToRoute, 
    getRoutePoints
} from './geometryUtils.js';
import { 
    fetchDirections, 
    handleApiError, 
    getDirectionsPromise,
    buildApiUrl 
} from './apiUtils.js';
import { 
    processRoute, 
    calculateRoute, 
    updateRoute, 
    clearExistingRouteElements,
    transformRouteGeometry, 
    getStepCoordinates 
} from './routeProcessor.js';
import { 
    calculateBearing, 
    setMapBearing, 
    getSegmentEndpoints, 
    calculateVerticalAlignmentAngle,
    animateMapTransform,
    setCurrentRotation,
    resetMapRotation
} from './geometryUtils.js';

// Re-export the main functions
export { 
    processRoute as processRouteData, 
    calculateRoute,
    updateRoute 
};

/**
 * Initializes route management
 * @param {Object} appState - The application state manager
 */
export function initializeRouteManagement(appState) {
    console.log('Initializing route management...');
    return Promise.resolve();
}

/**
 * Finds a route based on input addresses
 * @param {Object} appState - Application state manager
 */
export function findRoute(appState) {
    if (appState.isMarkersLocked()) {
        console.log("Markers are locked. Route finding not executed.");
        return Promise.resolve();
    }

    const startInput = document.getElementById('startPostcode').value.trim();
    const endInput = document.getElementById('endPostcode').value.trim();
    
    console.log('findRoute called with:', {
        startInput,
        endInput,
        startAddressChanged: appState.getStartAddressChanged(),
        endAddressChanged: appState.getEndAddressChanged()
    });

    if (!startInput || !endInput) {
        console.log('Missing start or end address');
        return Promise.resolve();
    }

    // Create an array to hold our geocoding promises
    const geocodingPromises = [];
    const geocodedPoints = {};
    
    // Track which addresses need geocoding
    let needsStartGeocoding = false;
    let needsEndGeocoding = false;
    
    // Remove existing markers if address has changed
    if (appState.getStartAddressChanged() && appState.getStartMarker()) {
        appState.getMap().removeLayer(appState.getStartMarker());
        appState.setStartMarker(null);
        needsStartGeocoding = true;
    } else if (!appState.getStartMarker()) {
        needsStartGeocoding = true;
    }
    
    if (appState.getEndAddressChanged() && appState.getEndMarker()) {
        appState.getMap().removeLayer(appState.getEndMarker());
        appState.setEndMarker(null);
        needsEndGeocoding = true;
    } else if (!appState.getEndMarker()) {
        needsEndGeocoding = true;
    }
    
    // Clear address changed flags
    if (appState.getStartAddressChanged()) {
        appState.setStartAddressChanged(false);
    }
    
    if (appState.getEndAddressChanged()) {
        appState.setEndAddressChanged(false);
    }
    
    // Set up geocoding promises based on what we need
    if (needsStartGeocoding) {
        console.log('Adding start geocoding promise');
        geocodingPromises.push(
            geocodeAddress(startInput, 'start')
                .then(point => {
                    geocodedPoints.start = point;
                    return point;
                })
        );
    }
    
    if (needsEndGeocoding) {
        console.log('Adding end geocoding promise');
        geocodingPromises.push(
            geocodeAddress(endInput, 'end')
                .then(point => {
                    geocodedPoints.end = point;
                    return point;
                })
        );
    }

    console.log(`Processing ${geocodingPromises.length} geocoding promises`);

    // If we have any geocoding to do, wait for it to complete
    if (geocodingPromises.length > 0) {
        Promise.all(geocodingPromises)
            .then(async () => {
                console.log('All geocoding promises resolved');
                const markerManager = await import('./markerManager.js');
                
                // Create markers sequentially to ensure proper order
                if (geocodedPoints.start) {
                    console.log('Creating start marker from geocoded point:', geocodedPoints.start);
                    await markerManager.setMarker(appState, geocodedPoints.start, 'start');
                }
                
                if (geocodedPoints.end) {
                    console.log('Creating end marker from geocoded point:', geocodedPoints.end);
                    await markerManager.setMarker(appState, geocodedPoints.end, 'end');
                }
                
                // Only calculate route if both markers exist
                if (appState.getStartMarker() && appState.getEndMarker()) {
                    return updateRoute(appState, {
                        source: 'route_find_geocoded'
                    });
                }
            })
            .catch(async error => {
                console.error('Error during geocoding:', error);
                const modal = await import('./modal.js');
                modal.showModal({ text: 'Error finding location. Please try again.' });
            });
    } 
    // If both markers exist and no geocoding needed, calculate route directly
    else if (appState.getStartMarker() && appState.getEndMarker()) {
        console.log('Both markers already exist, calculating route directly');
        return updateRoute(appState, {
            source: 'route_find'
        });
    }
}

/**
 * Base function for highlighting route segments
 * @param {Object} appState - Application state manager
 * @param {number} index - Index of the instruction/segment to highlight
 * @param {boolean} [zoomToSegment=true] - Whether to zoom to the segment
 * @returns {Promise} - Promise that resolves when highlighting is complete
 * @private
 */
function _highlightRouteSegmentBase(appState, index, zoomToSegment = true) {
    // Special case for overview instruction
    if (index < 0) {
        // Clear any existing segment highlights
        const segments = appState.getRouteSegments();
        if (segments && segments.length) {
            const map = appState.getMap();
            segments.forEach(seg => {
                if (seg.line && map.hasLayer(seg.line)) {
                    map.removeLayer(seg.line);
                }
            });
        }
        
        // Reset map bearing to 0 (north) when showing the overview
        const map = appState.getMap();
        if (map && map.setBearing) {
            resetMapRotation(map, { 
                animate: true,
                duration: 400,
                force: true 
            }).catch(error => console.error('Error resetting map bearing:', error));
        }
        
        // Fit to the entire route if zooming is enabled
        if (zoomToSegment) {
            return import('./viewportManager.js').then(viewportManager => {
                viewportManager.fitMapToRouteExplicit(appState);
                return -1; // Special return value for overview
            });
        }
        
        return Promise.resolve(-1);
    }
    
    // Rest of the existing function for normal segment highlighting
    const map = appState.getMap();
    const segments = appState.getRouteSegments();
    const routeLine = appState.getRouteLine();
    
    // Comprehensive validation with safe early returns
    if (!map) {
        console.warn('Cannot highlight route segment: Map not available');
        return Promise.resolve(-1);
    }
    
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        console.warn('Cannot highlight route segment: No route segments available');
        return Promise.resolve(-1);
    }
    
    if (index < 0 || index >= segments.length) {
        console.warn(`Cannot highlight route segment: Invalid index ${index}, max: ${segments.length-1}`);
        return Promise.resolve(-1);
    }
    
    const segment = segments[index];
    if (!segment || !segment.line) {
        console.warn(`Cannot highlight route segment: Segment at index ${index} is invalid`);
        return Promise.resolve(-1);
    }

    // Start by pre-emptively removing any existing segment highlights
    // This helps prevent race conditions where multiple segments try to appear
    segments.forEach(seg => {
        if (seg.line && map.hasLayer(seg.line)) {
            map.removeLayer(seg.line);
        }
    });
    
    // Add the current segment to the map
    segment.line.setStyle({
        opacity: 1,
        className: 'route-segment-highlight'
    }).addTo(map);

    // Helper function to check segment validity and add it if needed
    function checkAndAddSegment() {
        // Check if state has changed during async operations
        if (!appState.getRouteSegments() || index >= appState.getRouteSegments().length) {
            console.warn('Segment index no longer valid after operations');
            return -1;
        }
        
        // Verify that we still have valid segments
        const currentSegments = appState.getRouteSegments();
        if (!currentSegments || currentSegments.length === 0) {
            console.warn('No route segments available after operations');
            return -1;
        }
        
        // Ensure the target segment still exists and is valid
        const currentSegment = currentSegments[index];
        if (!currentSegment || !currentSegment.line) {
            console.warn('Segment no longer valid after operations');
            return -1;
        }
        
        // If the segment is still not on the map (could have been removed during async operations)
        // add it again
        if (!map.hasLayer(currentSegment.line)) {
            currentSegment.line.setStyle({
                opacity: 1,
                className: 'route-segment-highlight'
            }).addTo(map);
        }
        
        // Successfully highlighted the segment
        return index;
    }

    // Use unified transformation approach - concurrent rotation and movement
    if (zoomToSegment && segment.line) {
        try {
            const bounds = segment.line.getBounds();
            
            if (!bounds || !bounds.isValid()) {
                console.warn(`Cannot zoom to segment ${index}: Invalid or missing bounds`);
                return Promise.resolve(checkAndAddSegment());
            }
            
            // Calculate padding
            const segmentLength = getSegmentLength(bounds);
            const [verticalPadding, horizontalPadding] = calculateDynamicPadding(segmentLength, map);
            
            // Only calculate rotation if enabled
            let rotationAngle = null;
            if (map.setBearing && appState.isRotationEnabled()) {
                // Get the segment endpoints for vertical alignment
                const endpoints = getSegmentEndpoints(segment.line);
                if (endpoints) {
                    // Calculate the vertical alignment angle
                    rotationAngle = calculateVerticalAlignmentAngle(
                        endpoints.startPoint, 
                        endpoints.endPoint
                    );
                    
                    console.log(`Vertical alignment: segment ${index} - from [${endpoints.startPoint.lat.toFixed(6)}, ${endpoints.startPoint.lng.toFixed(6)}] to [${endpoints.endPoint.lat.toFixed(6)}, ${endpoints.endPoint.lng.toFixed(6)}]`);
                    console.log(`Preparing concurrent transformation with rotation: ${rotationAngle.toFixed(1)}°`);
                }
            }
            
            // Create unified transformation parameters
            const transformations = {
                bounds: bounds,
                padding: [verticalPadding, horizontalPadding]
            };
            
            // Only add rotation if we have an angle and rotation is enabled
            if (rotationAngle !== null && map.setBearing && appState.isRotationEnabled()) {
                transformations.bearing = rotationAngle;
            }
            
            // Use the pre-calculated optimal zoom level instead of fitting to bounds
            const optimalZoom = appState.getOptimalZoomLevel();
            if (optimalZoom) {
                // Calculate center of this segment
                const center = bounds.getCenter();
                
                // Modified transformation - use center and fixed zoom level
                transformations.center = center;
                transformations.zoom = optimalZoom;
                
                // Don't use bounds-based zoom calculation
                delete transformations.bounds;
                
                console.log(`Using fixed optimal zoom level: ${optimalZoom.toFixed(2)} for segment ${index}`);
            }
            
            // Use concurrent animation for smoother transitions
            console.log(`Starting unified transformation for segment ${index}`);
            return animateMapTransform(map, transformations, {
                duration: 800 // Consistent duration for all transformations
            }).then(() => {
                console.log(`Unified transformation for segment ${index} completed`);
                return checkAndAddSegment();
            }).catch(error => {
                console.error(`Error during unified transformation for segment ${index}:`, error);
                return checkAndAddSegment(); // Try to recover
            });
        } catch (error) {
            console.error(`Error setting up transformations for segment ${index}:`, error);
            return Promise.resolve(checkAndAddSegment());
        }
    } else {
        // If not zooming, just return the current segment index
        return Promise.resolve(checkAndAddSegment());
    }
}

/**
 * Highlights a specific segment of the route
 * @param {Object} appState - Application state manager
 * @param {number} index - Index of the instruction/segment to highlight
 * @param {boolean} [zoomToSegment=true] - Whether to zoom to the segment
 * @returns {Promise} - Promise that resolves when highlighting is complete
 */
export function highlightRouteSegment(appState, index, zoomToSegment = true) {
    // Use a more aggressive approach to prevent multiple operations
    if (appState.isHighlightingInProgress()) {
        console.log('Highlight operation already in progress - ignoring new request');
        return Promise.resolve(-1); // Return immediately
    }
    
    // Record timestamp to help debug potential racing issues
    const operationTimestamp = Date.now();
    console.log(`Starting highlight operation at ${operationTimestamp} for segment ${index}`);
    
    // Set the flag to indicate highlighting has started
    appState.setHighlightingInProgress(true);
    
            return Promise.all([
            // Clear map highlights by removing segments from map
            new Promise(resolve => {
                const segments = appState.getRouteSegments();
                if (segments && segments.length) {
                    const map = appState.getMap();
                    segments.forEach(segment => {
                        if (segment.line && map.hasLayer(segment.line)) {
                            map.removeLayer(segment.line);
                        }
                    });
                }
                resolve();
            }),
            // Clear elevation chart highlights
            import('./elevationChart.js').then(module => {
                if (module.clearElevationHighlight) {
                    return module.clearElevationHighlight();
                }
            }).catch(error => {
                console.error('Error clearing elevation highlights:', error);
            })
        ])
                .then(() => {
                    console.log(`Highlight operation ${operationTimestamp}: cleared highlights, starting base highlighting`);
                    return _highlightRouteSegmentBase(appState, index, zoomToSegment);
                })
                .then(highlightedIndex => {
                    console.log(`Highlight operation ${operationTimestamp}: base highlighting complete, result: ${highlightedIndex}`);
                    if (highlightedIndex >= 0) {
                        return import('./elevationChart.js')
                            .then(module => {
                                if (module.highlightElevationSegment) {
                                    return module.highlightElevationSegment(appState, highlightedIndex)
                                        .then(() => {
                                            console.log(`Highlight operation ${operationTimestamp}: elevation highlighting complete`);
                                            return highlightedIndex;
                                        });
                                }
                                return highlightedIndex;
                            });
                    }
                    return highlightedIndex;
                })
        .catch(error => {
            console.error(`Highlight operation ${operationTimestamp} error:`, error);
            return -1; // Consistent error return code
        })
        .finally(() => {
            // Always clear the flag when done, whether successful or not
            console.log(`Completing highlight operation ${operationTimestamp}`);
            appState.setHighlightingInProgress(false);
        });
}



/**
 * Displays turn-by-turn directions
 * @param {Object} appState - Application state manager
 * @param {Array} instructions - Array of direction instructions
 */

/**
 * Reverses the start and end points and recalculates the route
 * @param {Object} appState - Application state manager
 */
export async function reverseAndRecalculate(appState) {
    if (!appState.getStartMarker() || !appState.getEndMarker() || 
        appState.isMarkersLocked()) {
        console.log("Cannot reverse route: markers are missing or locked");
        return;
    }
    
    const map = appState.getMap();
    const startLatLng = appState.getStartMarker().getLatLng();
    const endLatLng = appState.getEndMarker().getLatLng();
    
    // Save postcodes
    const startPostcode = document.getElementById('startPostcode').value;
    const endPostcode = document.getElementById('endPostcode').value;
    
    // Remove existing markers
    [appState.getStartMarker(), appState.getEndMarker()].forEach(marker => {
        if (marker) {
            map.removeLayer(marker);
        }
    });
    appState.setStartMarker(null);
    appState.setEndMarker(null);
    
    // Handle waypoints
    const waypoints = appState.getWaypoints();
    if (waypoints.length > 0) {
        const reversedWaypoints = [...waypoints].reverse();
        appState.updateWaypoints(reversedWaypoints);
        
        const waypointManager = await import('./waypointManager.js');
        waypointManager.renumberWaypoints(appState);
    }
    
    // Create new markers
            const markerManager = await import('./markerManager.js');
        await markerManager.setMarker(appState, endLatLng, 'start');
        await markerManager.setMarker(appState, startLatLng, 'end');
    
    // Update postcodes
    document.getElementById('startPostcode').value = endPostcode;
    document.getElementById('endPostcode').value = startPostcode;
    
    return updateRoute(appState, {
        source: 'route_reverse'
    });
}

/**
 * Clears the route and optionally resets input fields
 * @param {Object} appState - Application state manager
 * @param {boolean} resetInputs - Whether to reset input fields
 */
export function clearRoute(appState, resetInputs = false) {
    try {
        const map = appState.getMap();
        if (!map) {
            console.warn('No map available for clearing route');
            return;
        }
        
        // Reset map rotation to north (0°)
        if (map.setBearing) {
            resetMapRotation(map, { 
                animate: true,
                duration: 400,
                force: true 
            });
        }
        
        // Helper function to safely remove a layer and return null
        const removeLayer = (layer) => {
            if (layer && map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
            return null;
        };

        // Clear markers
        appState.setStartMarker(removeLayer(appState.getStartMarker()));
        appState.setEndMarker(removeLayer(appState.getEndMarker()));
        appState.setButtonMarker(removeLayer(appState.getButtonMarker()));

        // Clear all waypoints
        appState.getWaypoints().forEach(waypoint => {
            removeLayer(waypoint);
        });
        appState.updateWaypoints([]);

        // Clear route elements synchronously
        clearExistingRouteElements(appState);

        // Reset route data
        appState.setCurrentInstructionIndex(0);
        appState.setInstructions([]);
        appState.setTotalDistance(0);
        appState.setCalculatedRoute(null);
        
        // Optional: Reset input fields
        if (resetInputs) {
            const startInput = document.getElementById('startPostcode');
            const endInput = document.getElementById('endPostcode');
            
            if (startInput) startInput.value = '';
            if (endInput) endInput.value = '';
        }

    } catch (error) {
        console.error('Error clearing route:', error);
        // Still try to clear state even if map operations fail
        appState.setCurrentInstructionIndex(0);
        appState.setInstructions([]);
        appState.setTotalDistance(0);
        appState.setCalculatedRoute(null);
    } finally {
        // Always clear localStorage
        localStorage.removeItem('routeData');
        localStorage.removeItem('points');
        
        // Always try to reset viewport
        import('./viewportManager.js')
            .then(viewportManager => {
                viewportManager.resetPositioningState();
            })
            .catch(error => {
                console.error('Error resetting viewport:', error);
            });
    }
}

/**
 * Prepares GPX data for download
 * @param {Object} appState - Application state manager
 * @returns {Promise} Promise that resolves to GPX data
 */
export function downloadGPX(appState) {
    if (!appState.getStartMarker() || !appState.getEndMarker()) {
        return Promise.reject(new Error(
            "No route data available or start/end markers not set. " +
            "Please calculate a route first before downloading a GPX file."
        ));
    }

    const points = getRoutePoints(appState);
    return buildApiUrl(points, 'gpx')
        .then(apiUrlForGPX => 
            fetch(apiUrlForGPX)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(
                            `Failed to download GPX: HTTP ${response.status} - ${response.statusText}`
                        );
                    }
                    return response.text();
                })
                .catch(error => {
                    console.error('Error downloading GPX:', error);
                    throw new Error('Failed to download GPX file. Please try again.');
                })
        );
}

/**
 * Gets the approximate length of a segment in meters
 * @param {Object} bounds - L.LatLngBounds object
 * @returns {number} Approximate length in meters
 */

// Keep this for backward compatibility
export function processRouteDataCoordinated(appState, data, options = {}) {
    return processRoute(appState, data, options);
}

