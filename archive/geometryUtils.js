// geometryUtils.js - Consolidated geometric calculations and map utilities

// Track the last rotation angle we've applied to the map
// This avoids relying on potentially inconsistent map._bearing values
let lastAppliedRotation = 0;

// ===== COORDINATE & DISTANCE CALCULATIONS =====

/**
 * Gets the approximate length of a segment in meters
 * @param {Object} bounds - L.LatLngBounds object
 * @returns {number} Approximate length in meters
 */
export function getSegmentLength(bounds) {
    if (!bounds || !bounds.isValid()) {
        return 0;
    }
    
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    
    // Calculate diagonal distance
    return northEast.distanceTo(southWest);
}

/**
 * Calculates the bearing between two points in degrees
 * @param {Object} startPoint - Starting point with lat/lng properties
 * @param {Object} endPoint - Ending point with lat/lng properties
 * @returns {number} - Bearing in degrees (0-360, where 0 is north)
 */
export function calculateBearing(startPoint, endPoint) {
    // Convert to radians
    const startLat = startPoint.lat * Math.PI / 180;
    const startLng = startPoint.lng * Math.PI / 180;
    const endLat = endPoint.lat * Math.PI / 180;
    const endLng = endPoint.lng * Math.PI / 180;

    // Calculate bearing
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    
    // Convert to degrees and normalize to 0-360
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    
    return bearing;
}

/**
 * Calculates the angle needed to align a segment vertically on the map
 * With bottom-to-top orientation (start point at bottom, end point at top)
 * @param {Object} startPoint - Starting point with lat/lng properties
 * @param {Object} endPoint - Ending point with lat/lng properties
 * @returns {number} - Map rotation angle in degrees to achieve vertical alignment
 */
export function calculateVerticalAlignmentAngle(startPoint, endPoint) {
    // First calculate the bearing from start to end
    const bearing = calculateBearing(startPoint, endPoint);
    
    // For vertical alignment, we need the segment to point north (0°)
    // So we need to rotate the map to counteract the segment's bearing
    
    // Calculate how much we need to rotate to get to 0° (north pointing up)
    // This is simply the opposite of the bearing
    const rotationAngle = (360 - bearing) % 360;
    
    console.log(`Original bearing: ${bearing.toFixed(1)}°, Vertical alignment angle: ${rotationAngle.toFixed(1)}°`);
    
    return rotationAngle;
}

/**
 * Finds the closest point on a line segment to a given point
 * @param {L.LatLng} p - The point to find closest point to
 * @param {L.LatLng} v - First vertex of segment
 * @param {L.LatLng} w - Second vertex of segment
 * @param {Object} map - Leaflet map instance
 * @returns {L.LatLng} Closest point on segment
 */
export function findClosestPointOnSegment(p, v, w, map) {
    // Convert to pixel coordinates for more accurate calculation
    const pPoint = map.latLngToLayerPoint(p);
    const vPoint = map.latLngToLayerPoint(v);
    const wPoint = map.latLngToLayerPoint(w);
    
    // Get the vector from v to w
    const l2 = Math.pow(vPoint.x - wPoint.x, 2) + Math.pow(vPoint.y - wPoint.y, 2);
    
    // If segment is just a point, return v
    if (l2 === 0) return v;
    
    // Calculate projection of p onto line
    const t = ((pPoint.x - vPoint.x) * (wPoint.x - vPoint.x) + 
               (pPoint.y - vPoint.y) * (wPoint.y - vPoint.y)) / l2;
    
    if (t < 0) return v; // Beyond v end of segment
    if (t > 1) return w; // Beyond w end of segment
    
    // Calculate closest point on line
    const closestPoint = L.point(
        vPoint.x + t * (wPoint.x - vPoint.x),
        vPoint.y + t * (wPoint.y - vPoint.y)
    );
    
    // Convert back to LatLng
    return map.layerPointToLatLng(closestPoint);
}

/**
 * Extracts start and end points from a segment line
 * @param {Array|Object} points - Array of points or a line object with getLatLngs method
 * @returns {Object} - Object with startPoint and endPoint properties
 */
export function getSegmentEndpoints(points) {
    // Handle case where points is a line object with getLatLngs method
    if (points && typeof points.getLatLngs === 'function') {
        points = points.getLatLngs();
    }
    
    // Validate input
    if (!Array.isArray(points) || points.length < 2) {
        console.warn('Invalid points for endpoint extraction');
        return null;
    }
    
    // Handle nested arrays (some polylines use nested arrays)
    if (Array.isArray(points[0]) && points[0].length > 0) {
        points = points[0]; // Use the first line segment
    }
    
    return {
        startPoint: points[0],
        endPoint: points[points.length - 1]
    };
}

// ===== MAP PADDING & VIEWPORT CALCULATIONS =====

/**
 * Calculates dynamic padding based on segment length
 * @param {number} segmentLength - Length of segment in meters
 * @param {Object} map - Leaflet map instance
 * @returns {Array} Padding values [vertical, horizontal]
 */
export function calculateDynamicPadding(segmentLength, map) {
    // Get map dimensions
    let mapWidth = 500, mapHeight = 500; // Default fallback values
    
    try {
        const mapContainer = map.getContainer();
        if (mapContainer) {
            mapWidth = mapContainer.clientWidth || mapWidth;
            mapHeight = mapContainer.clientHeight || mapHeight;
        }
    } catch (error) {
        console.warn('Error getting map dimensions, using defaults:', error);
    }
    
    // Base padding (minimal padding - 1.5%)
    let verticalPadding = Math.round(mapHeight * 0.015);
    let horizontalPadding = Math.round(mapWidth * 0.015);
    
    // Adjust padding based on segment length - using much smaller percentages
    if (segmentLength < 50) {
        // Use minimal padding (1.5%) - already set above
    } 
    // For short segments (< 200m), use slightly more padding (2%)
    else if (segmentLength < 200) {
        verticalPadding = Math.round(mapHeight * 0.02);
        horizontalPadding = Math.round(mapWidth * 0.02);
    } 
    // For medium segments (< 500m), use medium padding (3%)
    else if (segmentLength < 500) {
        verticalPadding = Math.round(mapHeight * 0.03);
        horizontalPadding = Math.round(mapWidth * 0.03);
    } 
    // For long segments (< 1000m), use larger padding (4%)
    else if (segmentLength < 1000) {
        verticalPadding = Math.round(mapHeight * 0.04);
        horizontalPadding = Math.round(mapWidth * 0.04);
    } 
    // For very long segments, use 5% padding
    else {
        verticalPadding = Math.round(mapHeight * 0.05);
        horizontalPadding = Math.round(mapWidth * 0.05);
    }
    
    return [verticalPadding, horizontalPadding];
}

// ===== ROTATION MANAGEMENT =====

/**
 * Gets the current rotation angle as tracked by our module
 * @returns {number} Current rotation in degrees (0-360)
 */
export function getCurrentRotation() {
    return lastAppliedRotation;
}

/**
 * Sets the current rotation tracking value
 * @param {number} angle - Rotation angle in degrees
 */
export function setCurrentRotation(angle) {
    lastAppliedRotation = ((angle % 360) + 360) % 360;
}

/**
 * Sets the map's bearing using delta rotation for smoother transitions
 * @param {Object} map - Leaflet map instance with rotation enabled
 * @param {number} targetBearing - Desired bearing in degrees (0-360)
 * @param {Object} options - Optional settings
 * @param {boolean} options.animate - Whether to animate the rotation (default: true)
 * @param {number} options.duration - Base animation duration in milliseconds (default: 400)
 * @param {boolean} options.force - Force rotation even for small changes (default: false)
 */
export function setMapBearing(map, targetBearing, options = {}) {
    // Default options
    const animate = options.animate !== false;
    const baseDuration = options.duration || 400;
    const force = options.force === true;
    
    // Validate input
    if (!map) {
        console.error('Invalid map object passed to setMapBearing');
        return Promise.resolve();
    }
    
    // Normalize target bearing to 0-360 range
    targetBearing = ((targetBearing % 360) + 360) % 360;
    
    // Make sure the map has rotation enabled
    if (typeof map.setBearing !== 'function') {
        console.warn('Map rotation not enabled - the leaflet-rotate plugin may not be loaded correctly');
        return Promise.resolve();
    }
    
    try {
        // Use our tracked rotation instead of map._bearing
        const currentBearing = lastAppliedRotation;
        
        // Skip small rotations unless forced
        if (!force && Math.abs(((targetBearing - currentBearing + 180) % 360) - 180) < 1) {
            console.log(`Skipping rotation - change too small (${currentBearing.toFixed(1)}° to ${targetBearing.toFixed(1)}°)`);
            return Promise.resolve();
        }
        
        // Calculate the shortest rotation path
        // This formula finds the smallest angle between two bearings (between -180 and +180)
        let deltaBearing = ((((targetBearing - currentBearing) % 360) + 540) % 360) - 180;
        
        // Calculate adaptive duration based on rotation amount (faster for small changes)
        const duration = animate ? Math.min(200 + Math.abs(deltaBearing), baseDuration) : 0;
        
        console.log(`Rotating from ${currentBearing.toFixed(1)}° to ${targetBearing.toFixed(1)}° (delta: ${deltaBearing.toFixed(1)}°)`);
        
        // Apply the new bearing with a wrapped error handler
        return new Promise((resolve) => {
            try {
                map.setBearing(targetBearing, { 
                    animate: animate,
                    duration: duration,
                    // Optional callback when animation completes, if supported by the plugin
                    complete: () => {
                        // Update our tracked rotation when complete
                        lastAppliedRotation = targetBearing;
                        resolve();
                    }
                });
                
                // Resolve anyway after duration + buffer time if no callback support
                setTimeout(() => {
                    // Update our tracked rotation
                    lastAppliedRotation = targetBearing;
                    resolve();
                }, duration + 100);
            } catch (error) {
                console.error('Error in setBearing call:', error);
                resolve(); // Still resolve the promise
            }
        });
    } catch (error) {
        console.error('Error while setting map bearing:', error);
        return Promise.resolve();
    }
}

/**
 * Animates multiple map transformations concurrently (rotation, zoom, and pan)
 * @param {Object} map - The Leaflet map instance
 * @param {Object} transformations - The target transformations 
 * @param {number} transformations.bearing - Target bearing in degrees
 * @param {L.LatLngBounds} transformations.bounds - Target bounds to fit
 * @param {Array} transformations.padding - Padding for bounds [vertical, horizontal]
 * @param {Object} options - Animation options
 * @returns {Promise} - Promise that resolves when the animation completes
 */
export function animateMapTransform(map, transformations, options = {}) {
    // Default options
    const baseDuration = options.duration || 800;  // Base duration as a starting point
    // Standard easing for rotation and panning
    const standardEasing = options.easing || (t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); 
    
    // Specialized zoom easing function for more natural zoom transitions
    const zoomEasing = t => {
        // Slower start, steadier middle, slower end - better for tile loading
        return t < 0.2 ? 2.5 * t * t : 
               t > 0.8 ? 1 - 2.5 * Math.pow(1 - t, 2) : 
               0.5 + (t - 0.5);
    };
    
    // Validate input
    if (!map) {
        console.error('Invalid map object passed to animateMapTransform');
        return Promise.resolve();
    }
    
    // Extract starting values
    // Use our tracked rotation state instead of map._bearing
    const startBearing = lastAppliedRotation;
    const startZoom = map.getZoom();
    const startCenter = map.getCenter();
    
    // Extract target values
    let targetBearing = startBearing;
    let targetBounds = null;
    let targetPadding = [0, 0];
    let targetCenter = startCenter;
    let targetZoom = startZoom;
    let useBounds = true;
    
    if (transformations.bearing !== undefined) {
        targetBearing = ((transformations.bearing % 360) + 360) % 360;
    }
    
    // Check if we're using explicit center and zoom instead of bounds
    if (transformations.center && transformations.zoom !== undefined) {
        targetCenter = transformations.center;
        targetZoom = transformations.zoom;
        useBounds = false; // Skip bounds-based calculations
        console.log(`Using explicit center and zoom: ${targetZoom.toFixed(2)} (fixed zoom mode)`);
    }
    // Otherwise use bounds-based approach
    else if (transformations.bounds && transformations.bounds.isValid && transformations.bounds.isValid()) {
        targetBounds = transformations.bounds;
        useBounds = true;
        
        if (Array.isArray(transformations.padding) && transformations.padding.length >= 2) {
            targetPadding = transformations.padding;
        }
        
        // Calculate target center and zoom based on bounds
        try {
            // Use Leaflet's internal calculations to get the zoom and center needed
            // to fit the bounds with padding (but don't actually move the map yet)
            const boundsOptions = {
                paddingTopLeft: [targetPadding[1], targetPadding[0]],
                paddingBottomRight: [targetPadding[1], targetPadding[0]],
                animate: false,
                maxZoom: 18
            };
            
            // Get a copy of the map state without changing the actual map
            const targetState = map._getBoundsCenterZoom(targetBounds, boundsOptions);
            targetCenter = targetState.center;
            targetZoom = targetState.zoom;
        } catch (error) {
            console.error('Error calculating target zoom/center:', error);
            // Fallback to standard fitBounds if calculation fails
            console.log('Using fallback for target state');
            targetCenter = targetBounds.getCenter();
            
            // Estimate a reasonable zoom level based on bounds size
            const boundsSize = targetBounds.getSouthWest().distanceTo(targetBounds.getNorthEast());
            if (boundsSize < 200) {
                targetZoom = 18; // Very small - high zoom
            } else if (boundsSize < 500) {
                targetZoom = 17;
            } else if (boundsSize < 1000) {
                targetZoom = 16;
            } else if (boundsSize < 2000) {
                targetZoom = 15;
            } else if (boundsSize < 5000) {
                targetZoom = 14;
            } else {
                targetZoom = 13; // Larger area - lower zoom
            }
        }
    }
    
    // Calculate the rotation delta (shortest path)
    const deltaBearing = ((((targetBearing - startBearing) % 360) + 540) % 360) - 180;
    
    // Calculate zoom change and zoom scale factor (2^delta = scale)
    const zoomDelta = targetZoom - startZoom;
    const zoomScale = Math.pow(2, Math.abs(zoomDelta)); // Scale factor between start and target zoom
    
    // Calculate adaptive duration based on zoom difference
    const zoomDifference = Math.abs(zoomDelta);
    const durationPerZoomLevel = 200; // additional ms per full zoom level change
    
    // Calculate final duration (with reasonable min/max bounds)
    const duration = Math.max(
        600, // minimum animation time
        Math.min(
            1500, // maximum animation time
            baseDuration + (zoomDifference * durationPerZoomLevel)
        )
    );
    
    console.log(`Unified transformation: rotate ${startBearing.toFixed(1)}° → ${targetBearing.toFixed(1)}°, zoom ${startZoom.toFixed(1)} → ${targetZoom.toFixed(1)}, duration: ${duration}ms (zoom scale: ${zoomScale.toFixed(2)}x)`);
    
    // Clear any existing animations
    if (map._unifiedAnimation) {
        cancelAnimationFrame(map._unifiedAnimation);
        map._unifiedAnimation = null;
    }
    
    return new Promise((resolve) => {
        const startTime = performance.now();
        let animationFrameId = null;
        let animationCanceled = false;
        
        function animateTransform(currentTime) {
            if (animationCanceled) {
                resolve();
                return;
            }
            
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use different easing for different transformations
            const rotationEasedProgress = standardEasing(progress);
            const panEasedProgress = standardEasing(progress);
            const zoomEasedProgress = zoomEasing(progress);
            
            // Apply intermediate rotation
            if (Math.abs(deltaBearing) > 0.1) {
                const intermediateBearing = (startBearing + (deltaBearing * rotationEasedProgress) + 360) % 360;
                if (typeof map.setBearing === 'function') {
                    // Don't update lastAppliedRotation here - only on completion
                    map.setBearing(intermediateBearing, { animate: false });
                }
            }
            
            // Apply intermediate zoom and center
            if (targetBounds && useBounds) {
                // Interpolate between start and target center
                const lat = startCenter.lat + ((targetCenter.lat - startCenter.lat) * panEasedProgress);
                const lng = startCenter.lng + ((targetCenter.lng - startCenter.lng) * panEasedProgress);
                
                // Use exponential interpolation for zoom (more natural than linear)
                // Each zoom level is a 2x scale change
                let intermediateZoom;
                if (Math.abs(zoomDelta) > 0.01) {
                    if (zoomDelta > 0) {
                        // Zooming in - use exponential scaling
                        const scaleFactor = 1 + ((zoomScale - 1) * zoomEasedProgress);
                        intermediateZoom = startZoom + Math.log2(scaleFactor);
                    } else {
                        // Zooming out - use exponential scaling in reverse
                        const scaleFactor = 1 + ((zoomScale - 1) * (1 - zoomEasedProgress));
                        intermediateZoom = targetZoom + Math.log2(scaleFactor);
                    }
                } else {
                    // For tiny changes, linear is fine
                    intermediateZoom = startZoom + (zoomDelta * zoomEasedProgress);
                }
                
                // Apply the new view state without animation
                map.setView([lat, lng], intermediateZoom, { animate: false, duration: 0 });
            }
            // For fixed zoom and center (non-bounds approach)
            else if (!useBounds) {
                // Simple linear interpolation for center
                const lat = startCenter.lat + ((targetCenter.lat - startCenter.lat) * panEasedProgress);
                const lng = startCenter.lng + ((targetCenter.lng - startCenter.lng) * panEasedProgress);
                
                // If the zoom level is fixed, just use the target zoom directly for a smoother experience
                // This is the key change that prevents zoom level stuttering between segments
                const intermediateZoom = targetZoom;
                
                // Apply the new view state without animation
                map.setView([lat, lng], intermediateZoom, { animate: false, duration: 0 });
            }
            
            if (progress < 1) {
                // Continue animation
                animationFrameId = requestAnimationFrame(animateTransform);
                map._unifiedAnimation = animationFrameId;
            } else {
                // Animation complete - ensure final values are exact
                if (Math.abs(deltaBearing) > 0.1 && typeof map.setBearing === 'function') {
                    map.setBearing(targetBearing, { animate: false });
                    // Update our tracked rotation state on completion
                    lastAppliedRotation = targetBearing;
                }
                
                // Apply final position - choose approach based on useBounds flag
                if (useBounds && targetBounds) {
                    map.setView(targetCenter, targetZoom, { animate: false });
                } else if (!useBounds) {
                    map.setView(targetCenter, targetZoom, { animate: false });
                }
                
                map._unifiedAnimation = null;
                
                console.log('Unified transformation completed, final rotation:', lastAppliedRotation.toFixed(1) + '°');
                resolve();
            }
        }
        
        // Start the animation
        animationFrameId = requestAnimationFrame(animateTransform);
        map._unifiedAnimation = animationFrameId;
        
        // Cancellation support
        resolve.cancel = () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationCanceled = true;
                console.log('Unified transform animation cancelled');
            }
        };
    });
}

/**
 * Resets the map rotation to north (0°) with consistent animation settings
 * @param {Object} map - Leaflet map instance
 * @param {Object} options - Optional settings
 * @param {boolean} options.animate - Whether to animate the rotation (default: true)
 * @param {number} options.duration - Animation duration in milliseconds (default: 400)
 * @param {boolean} options.force - Force rotation even for small changes (default: true)
 * @returns {Promise} Promise that resolves when rotation is complete
 */
export function resetMapRotation(map, options = {}) {
    const animate = options.animate !== false;
    const duration = options.duration || 400;
    const force = options.force !== false; // Default to true for consistency
    
    console.log('Resetting map rotation to north (0°)');
    
    // Update our tracked rotation state
    setCurrentRotation(0);
    
    return setMapBearing(map, 0, { 
        animate, 
        duration, 
        force 
    });
}

// ===== ROUTE UTILITIES =====

/**
 * Gets all points in the route for API calls
 * @param {Object} appState - Application state manager
 * @returns {Array} Array of point objects with lat/lng
 */
export function getRoutePoints(appState) {
    const points = [];
    const startMarker = appState.getStartMarker();
    const endMarker = appState.getEndMarker();
    const waypoints = appState.getWaypoints();
    
    // Add start marker if it exists
    if (startMarker) {
        const startLatLng = startMarker.getLatLng();
        points.push({
            lat: startLatLng.lat,
            lng: startLatLng.lng,
            type: 'start'
        });
    }
    
    // Add all waypoints in order
    if (waypoints && waypoints.length > 0) {
        waypoints.forEach((waypoint, index) => {
            const waypointLatLng = waypoint.getLatLng();
            points.push({
                lat: waypointLatLng.lat,
                lng: waypointLatLng.lng,
                type: 'waypoint',
                index: index + 1
            });
        });
    }
    
    // Add end marker if it exists
    if (endMarker) {
        const endLatLng = endMarker.getLatLng();
        points.push({
            lat: endLatLng.lat,
            lng: endLatLng.lng,
            type: 'end'
        });
    }
    
    return points;
}

/**
 * Fits the map to show a route with appropriate padding
 * @param {Object} appState - Application state manager
 * @param {Object} options - Options for fitting
 * @returns {boolean} Whether the fit was successful
 */
export function fitMapToRoute(appState, options = {}) {
    const { skipZooming = false } = options;
    
    // If we're dragging or skipZooming is true, don't fit the map
    if (appState.isDragging() || skipZooming) {
        console.log('Skipping map fit - dragging in progress or skipZooming is true');
        return false;
    }

    const routeLine = appState.getRouteLine();
    const map = appState.getMap();
    
    if (!routeLine || !map || !appState.isMapReady()) {
        return false;
    }
    
    try {
        // Force a map size update before fitting (ensures accurate dimensions)
        map.invalidateSize(true);
        
        const bounds = routeLine.getBounds();
        if (!bounds || !bounds.isValid()) {
            return false;
        }
        
        // Calculate appropriate padding
        const segmentLength = getSegmentLength(bounds);
        const [verticalPadding, horizontalPadding] = calculateDynamicPadding(segmentLength, map);
        
        // Simple single fit operation with animation
        map.fitBounds(bounds, {
            padding: [verticalPadding, horizontalPadding],
            maxZoom: 18,
            animate: true
        });
        
        console.log(`Map fitted to route bounds with padding: [${verticalPadding}, ${horizontalPadding}]`);
        
        // Turn off follow user when fitting to route
        appState.setFollowUser(false);
        
        return true;
    } catch (error) {
        console.error('Error fitting map to route:', error);
        return false;
    }
} 