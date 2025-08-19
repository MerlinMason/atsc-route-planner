// routeProcessor.js - Unified route processing functionality
import { getState } from './state.js';
import { 
    fitMapToRoute, 
    getRoutePoints, 
    findClosestPointOnSegment,
    calculateDynamicPadding,
    getSegmentLength
} from './geometryUtils.js';
import { buildApiUrl } from './apiUtils.js';

/**
 * Process route data from start to finish - from API response to UI updates
 * @param {Object} appState - Application state manager
 * @param {Object} data - Route data from API
 * @param {Object} options - Options for processing
 * @returns {Promise} Promise that resolves when processing is complete
 */
export function processRoute(appState, data, options = {}) {
    return new Promise((resolve) => {
        // Reset navigation tracking when a new route is processed
        appState.setUserNavigatedToDirectionStep(false);
        
        // 1. Update state and localStorage
        prepareRouteData(appState, data);
        
        // 2. Clear existing route elements
        clearExistingRouteElements(appState);

        // 3. Validate route data
        if (!data.paths || data.paths.length === 0) {
            console.error("No paths in route data");
            return resolve(data);
        }

        // 4. Create and add new route elements
        const routeData = data.paths[0];
        const routeLine = renderRouteElements(appState, routeData);
        
        // 5. Process route segments
        processRouteSegments(appState, routeData, routeLine.getLatLngs());
        
        // 6. Update UI components
        updateUIComponents(appState, routeData).then(() => {
            // 7. Explicitly fit map to route if we're not dragging
            if (!appState.isDragging() && routeLine) {
                import('./viewportManager.js').then(viewportManager => {
                    console.log('Explicitly fitting map to route after processing');
                    // Small delay to ensure the UI has updated
                    setTimeout(() => viewportManager.fitMapToRouteExplicit(appState), 200);
                });
            }
            
            // 8. Resolve the promise
            resolve(data);
        });
    });
}

/**
 * Calculate a route using the current markers and waypoints
 * @param {Object} appState - Application state manager
 * @param {Object} options - Calculation options
 * @returns {Promise} Promise that resolves when calculation is complete
 */
export function calculateRoute(appState, options = {}) {
    if (!appState.getStartMarker() || !appState.getEndMarker()) {
        console.log("Cannot calculate route: Start or end marker is missing.");
        return Promise.resolve(null);
    }

    if (!appState.getMap() || !appState.isMapReady()) {
        console.warn('Map not fully initialized yet, retrying in 300ms...');
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!appState.getMap() || !appState.isMapReady()) {
                    console.error('Map still not initialized after retry');
                    resolve(null);
                    return;
                }
                calculateRoute(appState, options).then(resolve);
            }, 300);
        });
    }

    const points = getRoutePoints(appState);
    
    return buildApiUrl(points, 'json')
        .then(apiUrl => {
            console.log("Fetching route from API:", apiUrl);
            return fetch(apiUrl);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        });
}

/**
 * Centralized route update orchestrator
 * @param {Object} appState - Application state manager
 * @param {Object} options - Update options
 * @returns {Promise} Promise that resolves when update is complete
 */
export function updateRoute(appState, options = {}) {
    const { source = 'unknown' } = options;
    console.log(`Initiating route update (source: ${source})`);

    return calculateRoute(appState)
        .then(data => {
            if (!data) {
                console.log('No route data returned from calculation');
                return null;
            }
            return processRoute(appState, data);
        })
        .catch(error => {
            console.error("Error updating route:", error);
            return import('./modal.js')
                .then(modal => {
                    modal.showModal({ 
                        text: 'Error calculating route. Please try again.' 
                    });
                    throw error;
                });
        });
}

// Specialized component functions (support the public API)
/**
 * Stage 1: Prepare route data - storage and cleanup
 */
function prepareRouteData(appState, data) {
    // Store calculated route
    appState.setCalculatedRoute(data.paths[0]);
    localStorage.setItem('routeData', JSON.stringify(data));

    // Also store the points data
    const points = getRoutePoints(appState);
    localStorage.setItem('points', JSON.stringify(points));
}

/**
 * Stage 2: Clear existing route elements
 */
export function clearExistingRouteElements(appState) {
    const map = appState.getMap();
    
    // Remove existing route line and arrowhead
    if (appState.getRouteLine()) {
        map.removeLayer(appState.getRouteLine());
    }
    
    if (appState.getArrowHead()) {
        map.removeLayer(appState.getArrowHead());
    }
    
    // Remove any existing route segment highlights
    const segments = appState.getRouteSegments();
    if (segments && segments.length) {
        segments.forEach(segment => {
            if (segment.line && map.hasLayer(segment.line)) {
                map.removeLayer(segment.line);
            }
        });
    }
    
    // Clear connector lines
    const connectorLines = appState.getConnectorLines();
    if (connectorLines && connectorLines.length) {
        connectorLines.forEach(line => {
            if (map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    }
    appState.setConnectorLines([]);
    appState.setRouteLine(null);
    appState.setArrowHead(null);
    appState.setRouteSegments([]);
}

/**
 * Stage 3: Render route elements - lines, segments, arrows
 */
function renderRouteElements(appState, routeData) {
    const map = appState.getMap();
    const routeCoords = routeData.points.coordinates;
    const latLngs = routeCoords.map(coord => L.latLng(coord[1], coord[0]));

    // Create and add the main route line
    const routeLine = L.polyline(latLngs, {
        color: '#ff6b00',
        weight: 7,
        opacity: 1,
        className: 'main-route-line'
    }).addTo(map);
    
    appState.setRouteLine(routeLine);
    appState.setRouteCoordinates(latLngs);
    
    // Add direction arrows
    const arrowHead = L.polylineDecorator(routeLine, {
        patterns: [
            {
                repeat: '50px',
                symbol: L.Symbol.arrowHead({
                    pixelSize: 9,
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#ff6b00',
                        weight: 4
                    }
                })
            }
        ]
    }).addTo(map);
    
    appState.setArrowHead(arrowHead);
    
    // Draw connector lines
    drawConnectorLines(appState, routeLine);
    
    return routeLine;
}

/**
 * Stage 4: Process route segments for highlighting
 */
function processRouteSegments(appState, routeData, latLngs) {
    const instructions = routeData.instructions || [];
    const segments = [];
    let longestSegmentBounds = null;
    let longestSegmentLength = 0;
    
    if (instructions.length > 0) {
        instructions.forEach((instruction, index) => {
            // Extract the interval of coordinates for this instruction
            if (instruction.interval) {
                const [startIdx, endIdx] = instruction.interval;
                
                // Ensure indices are valid
                const validStartIdx = Math.max(0, startIdx);
                const validEndIdx = Math.min(endIdx, latLngs.length - 1);
                
                // Use exact same coordinates as the main route
                const segmentCoords = latLngs.slice(validStartIdx, validEndIdx + 1);
                
                if (segmentCoords.length >= 2) {
                    // Create a segment polyline using the helper function
                    const segment = createSegmentPolyline(segmentCoords);
                    
                    // Calculate segment bounds and length to find the longest one
                    const bounds = segment.getBounds();
                    if (bounds && bounds.isValid()) {
                        // Calculate the length of this segment (approximate)
                        const sw = bounds.getSouthWest();
                        const ne = bounds.getNorthEast();
                        const segmentLength = sw.distanceTo(ne);
                        
                        // Check if this is the longest segment so far
                        if (segmentLength > longestSegmentLength) {
                            longestSegmentLength = segmentLength;
                            longestSegmentBounds = bounds;
                        }
                    }
                    
                    // Store both the line and the interval
                    segments.push({
                        line: segment,
                        interval: [validStartIdx, validEndIdx]
                    });
                }
            }
        });
    }
    
    // Calculate optimal zoom level based on the longest segment
    if (longestSegmentBounds) {
        // Using 0% padding - exact bounds of the longest segment
        const expandedBounds = longestSegmentBounds.pad(0);
        
        try {
            // Get the map instance
            const map = appState.getMap();
            if (map) {
                // Use minimal fixed padding instead of dynamic padding calculation
                const verticalPadding = 20;   // pixels
                const horizontalPadding = 20; // pixels
                
                // Use Leaflet's internal calculations to get the optimal zoom
                const boundsOptions = {
                    paddingTopLeft: [horizontalPadding, verticalPadding],
                    paddingBottomRight: [horizontalPadding, verticalPadding],
                    animate: false,
                    maxZoom: 19  // Allow closer zooming to match fitRoute behavior
                };
                
                // Get the optimal zoom level without actually moving the map
                const targetState = map._getBoundsCenterZoom(expandedBounds, boundsOptions);
                const optimalZoom = targetState.zoom;
                
                console.log(`Calculated optimal zoom level: ${optimalZoom.toFixed(2)} based on longest segment (${longestSegmentLength.toFixed(0)}m)`);
                
                // Store the optimal zoom level in app state
                appState.setOptimalZoomLevel(optimalZoom);
            }
        } catch (error) {
            console.error('Error calculating optimal zoom level:', error);
            // Set a reasonable default zoom level if calculation fails
            appState.setOptimalZoomLevel(15);
        }
    } else {
        // If we couldn't determine a longest segment, set a reasonable default
        console.warn('Could not determine longest segment, using default zoom level');
        appState.setOptimalZoomLevel(15);
    }
    
    // Store segments in app state
    appState.setRouteSegments(segments);
}

/**
 * Stage 5: Update UI components - directions, elevation, etc.
 */
function updateUIComponents(appState, routeData) {
    return import('./directionsManager.js')
        .then(directionsModule => {
            // 1. Update distance and directions
            directionsModule.updateDistanceDisplay(appState, routeData.distance);
            displayDirections(appState, routeData.instructions);
                    return import('./elevationChart.js');
    })
    .then(elevationChart => {
        // 2. Update elevation chart
        const elevations = routeData.points.coordinates.map(coord => coord[2]);
        return elevationChart.updateElevationChart(elevations);
    })
        .then(() => {
            // 3. Only fit the viewport on initial load
            return import('./viewportManager.js')
                .then(({ isInitialPositioningDone, fitMapToRouteExplicit }) => {
                    if (!isInitialPositioningDone()) {
                        return fitMapToRouteExplicit(appState);
                    }
                });
        });
}

/**
 * Get all route markers in order (start, waypoints, end)
 * @param {Object} appState - Application state manager
 * @returns {Array} Array of markers in route order
 */
function getRouteMarkers(appState) {
    return [
        appState.getStartMarker(),
        ...appState.getWaypoints(),
        appState.getEndMarker()
    ].filter(marker => marker);
}

/**
 * Draw connector lines between markers and the route
 */
function drawConnectorLines(appState, routeLine) {
    const map = appState.getMap();
    const markers = getRouteMarkers(appState);

    // Remove existing connector lines
    const existingConnectorLines = appState.getConnectorLines();
    if (existingConnectorLines && existingConnectorLines.length) {
        existingConnectorLines.forEach(line => {
            if (map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    }
    appState.setConnectorLines([]);

    // Get the actual route coordinates as LatLngs
    const routeLatLngs = routeLine.getLatLngs();
    
    const newConnectorLines = [];
    markers.forEach(marker => {
        const markerLatLng = marker.getLatLng();
        
        // Find closest point on the route for this marker
        const closestPoint = findClosestPointOnRoute(markerLatLng, routeLine, routeLatLngs, map);
        
        // Draw connector if closest point was found and distance is greater than threshold
        if (closestPoint.latLng && closestPoint.distance > 5) {
            const connector = createConnectorLine(markerLatLng, closestPoint.latLng);
            connector.addTo(map);
            newConnectorLines.push(connector);
        }
    });
    
    appState.setConnectorLines(newConnectorLines);
}

/**
 * Find the closest point on a route to a given position
 * @param {L.LatLng} position - The position to find the closest point to
 * @param {L.Polyline} routeLine - The route polyline
 * @param {Array} routeLatLngs - Array of LatLngs making up the route
 * @param {L.Map} map - The map object
 * @returns {Object} Object with latLng and distance properties
 */
function findClosestPointOnRoute(position, routeLine, routeLatLngs, map) {
    let minDist = Infinity;
    let closestLatLng = null;
    
    // For simple routes, check each segment
    if (routeLatLngs.length < 1000) {
        // Check each segment of the route
        for (let i = 0; i < routeLatLngs.length - 1; i++) {
            const p1 = routeLatLngs[i];
            const p2 = routeLatLngs[i + 1];
            
            // Find closest point on this line segment
            const closest = findClosestPointOnSegment(position, p1, p2, map);
            const dist = position.distanceTo(closest);
            
            if (dist < minDist) {
                minDist = dist;
                closestLatLng = closest;
            }
        }
    } else {
        // For very long routes, use the more approximate method for performance
        const closestPoint = routeLine.closestLayerPoint(map.latLngToLayerPoint(position));
        if (closestPoint) {
            closestLatLng = map.layerPointToLatLng(closestPoint);
            minDist = position.distanceTo(closestLatLng);
        }
    }
    
    return {
        latLng: closestLatLng,
        distance: minDist
    };
}

/**
 * Creates a connector line with standard styling
 * @param {L.LatLng} from - Starting point
 * @param {L.LatLng} to - Ending point  
 * @returns {L.Polyline} Styled connector line
 */
function createConnectorLine(from, to) {
    return L.polyline([from, to], {
        color: '#ff6b00',
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 8',
        className: 'connector-line'
    });
}

/**
 * Creates a segment polyline with standard styling
 * @param {Array} segmentCoords - Array of coordinates for the segment
 * @returns {L.Polyline} Leaflet polyline for the segment
 */
function createSegmentPolyline(segmentCoords) {
    return L.polyline(segmentCoords, {
        color: '#ffffff', // White highlight color
        weight: 1,        // Thinner than main route
        opacity: 0,       // Start invisible
        className: 'route-segment', 
        pane: 'overlayPane'   
    });
}

/**
 * Display directions on the UI
 */
function displayDirections(appState, instructions) {
    if (!instructions || instructions.length === 0) {
        document.getElementById('currentDirection').innerText = "No navigation instructions available.";
        return;
    }

    // Add a "Go" instruction to the beginning of the list
    const enhancedInstructions = [
        {
            text: "Go",
            distance: instructions.reduce((total, instr) => total + (instr.distance || 0), 0),
            interval: [-1, -1], // Special marker to indicate this is the overview instruction
            isOverviewInstruction: true
        },
        ...instructions
    ];

    // Store instructions and set index to the overview instruction (0)
    appState.setInstructions(enhancedInstructions);
    appState.setCurrentInstructionIndex(0);
    
    // Show the first direction via coordinator
            import('./directionsManager.js').then(directionsManager => {
            directionsManager.showCurrentDirection(appState);
            directionsManager.updateDistanceDisplay(appState);
        });
}