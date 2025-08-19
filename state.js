// state.js - Centralized state management
/**
 * Creates and returns the application state manager
 * @returns {Object} The state manager object with getters and setters
 */
export function initializeState() {
    // Private state object
    const state = {
        map: null,
        mapReady: false,  // Add this new property
        startMarker: null,
        endMarker: null,
        routeLine: null,
        arrowHead: null,
        waypoints: [],
        btnMarker: null,
        totalDistance: 0,
        currentInstructionIndex: 0,
        instructions: [],
        startAddressChanged: false,
        endAddressChanged: false,
        markersLocked: false,
        userCoords: null,
        userLocationMarker: null,
        watchId: null,
        followUser: false,
        calculatedRoute: null,
        startAddress: '',
        endAddress: '',
        listeners: {},
        routeCoordinates: [],
        routeSegments: [],
        connectorLines: [],
        isHighlightingInProgress: false, // Add this new property
        isDragging: false,
        rotationEnabled: true, // Enable map rotation by default
        optimalZoomLevel: null, // Store the calculated optimal zoom level for all segments
        userNavigatedToDirectionStep: false // Track if user manually navigated to a direction step
    };

    // Track if route was just loaded from storage/URL
    let routeJustLoaded = false;

    // Event subscription system
    function subscribe(event, callback) {
        if (!state.listeners[event]) {
            state.listeners[event] = [];
        }
        state.listeners[event].push(callback);
        return () => {
            state.listeners[event] = state.listeners[event].filter(cb => cb !== callback);
        };
    }

    function notify(event, data) {
        if (state.listeners[event]) {
            state.listeners[event].forEach(callback => callback(data));
        }
    }

    // Create a state manager with controlled access to state
    const stateManager = {
        // Map methods
        getMap: () => state.map,
        setMap: (map) => {
            state.map = map;
            notify('map:updated', map);
        },
        
        isMapReady: () => state.mapReady,
        setMapReady: (ready) => {
            state.mapReady = ready;
            notify('map:ready', ready);
        },

        // Marker methods
        getStartMarker: () => state.startMarker,
        setStartMarker: (marker) => {
            state.startMarker = marker;
            notify('marker:start:updated', marker);
        },
        
        getEndMarker: () => state.endMarker,
        setEndMarker: (marker) => {
            state.endMarker = marker;
            notify('marker:end:updated', marker);
        },
        
        // Route methods
        getRouteLine: () => state.routeLine,
        setRouteLine: (line) => {
            state.routeLine = line;
            notify('route:updated', line);
        },
        
        getArrowHead: () => state.arrowHead,
        setArrowHead: (arrow) => {
            state.arrowHead = arrow;
        },
        
        // Waypoints methods
        getWaypoints: () => [...state.waypoints],
        addWaypoint: (waypoint) => {
            state.waypoints.push(waypoint);
            notify('waypoints:updated', state.waypoints);
        },
        removeWaypoint: (waypoint) => {
            state.waypoints = state.waypoints.filter(wp => wp !== waypoint);
            notify('waypoints:updated', state.waypoints);
        },
        updateWaypoints: (newWaypoints) => {
            state.waypoints = [...newWaypoints];
            notify('waypoints:updated', state.waypoints);
        },
        
        // Button marker for removal
        getButtonMarker: () => state.btnMarker,
        setButtonMarker: (marker) => {
            state.btnMarker = marker;
        },
        
        // Route data
        getTotalDistance: () => state.totalDistance,
        setTotalDistance: (distance) => {
            state.totalDistance = distance;
            notify('distance:updated', distance);
        },
        
        getCalculatedRoute: () => state.calculatedRoute,
        setCalculatedRoute: (route) => {
            state.calculatedRoute = route;
            notify('route:calculated', route);
        },
        
        // Directions
        getInstructions: () => [...state.instructions],
        setInstructions: (instructions) => {
            state.instructions = [...instructions];
            notify('instructions:updated', instructions);
        },
        
        getCurrentInstructionIndex: () => state.currentInstructionIndex,
        setCurrentInstructionIndex: (index) => {
            state.currentInstructionIndex = index;
            notify('instruction:current:updated', index);
        },
        
        // Address handling
        getStartAddressChanged: () => state.startAddressChanged,
        setStartAddressChanged: (changed) => {
            state.startAddressChanged = changed;
        },
        
        getEndAddressChanged: () => state.endAddressChanged,
        setEndAddressChanged: (changed) => {
            state.endAddressChanged = changed;
        },
        
        getStartAddress: () => state.startAddress,
        setStartAddress: (address) => {
            state.startAddress = address;
            notify('address:start:updated', address);
        },
        
        getEndAddress: () => state.endAddress,
        setEndAddress: (address) => {
            state.endAddress = address;
            notify('address:end:updated', address);
        },
        
        // Locking functionality
        isMarkersLocked: () => state.markersLocked,
        setMarkersLocked: (locked) => {
            state.markersLocked = locked;
            notify('markers:locked:changed', locked);
        },
        
        // User location
        getUserCoords: () => state.userCoords,
        setUserCoords: (coords) => {
            state.userCoords = coords;
            notify('user:coords:updated', coords);
        },
        
        getUserLocationMarker: () => state.userLocationMarker,
        setUserLocationMarker: (marker) => {
            state.userLocationMarker = marker;
        },
        
        getWatchId: () => state.watchId,
        setWatchId: (id) => {
            state.watchId = id;
        },
        
        isFollowingUser: () => state.followUser,
        setFollowUser: (follow) => {
            state.followUser = follow;
            notify('follow:user:updated', follow);
        },
        
        // Route coordinates and segments
        getRouteCoordinates: () => [...state.routeCoordinates],
        setRouteCoordinates: (coords) => {
            state.routeCoordinates = coords;
        },

        getRouteSegments: () => state.routeSegments,
        setRouteSegments: (segments) => {
            state.routeSegments = segments;
            notify('routeSegments:updated', segments);
        },

        // Connector lines
        getConnectorLines: () => state.connectorLines,
        setConnectorLines: (lines) => {
            state.connectorLines = lines;
        },

        // Event subscription system
        subscribe,

        // Highlighting in progress
        isHighlightingInProgress: () => state.isHighlightingInProgress,
        setHighlightingInProgress: (inProgress) => {
            state.isHighlightingInProgress = inProgress;
            notify('highlighting:inprogress:changed', inProgress);
        },

        // Route just loaded
        isRouteJustLoaded: () => routeJustLoaded,
        setRouteJustLoaded: (value) => {
            routeJustLoaded = value;
            // Auto-reset after a short delay
            if (value) {
                setTimeout(() => { routeJustLoaded = false; }, 2000);
            }
        },
        
        // Cleanup method
        reset: () => {
            state.startMarker = null;
            state.endMarker = null;
            state.routeLine = null;
            state.arrowHead = null;
            state.waypoints = [];
            state.btnMarker = null;
            state.totalDistance = 0;
            state.currentInstructionIndex = 0;
            state.instructions = [];
            state.calculatedRoute = null;
            notify('state:reset', null);
        },

        setDragging: (dragging) => {
            state.isDragging = dragging;
            console.log('Dragging state:', state.isDragging);
        },
        isDragging: () => state.isDragging,

        // Map rotation
        isRotationEnabled: () => state.rotationEnabled,
        setRotationEnabled: (enabled) => {
            state.rotationEnabled = enabled;
            notify('rotation:enabled:changed', enabled);
        },

        // Optimal zoom level for segments
        getOptimalZoomLevel: () => state.optimalZoomLevel,
        setOptimalZoomLevel: (zoomLevel) => {
            state.optimalZoomLevel = zoomLevel;
            notify('optimalZoom:updated', zoomLevel);
        },
        
        // Direction navigation tracking
        hasUserNavigatedToDirectionStep: () => state.userNavigatedToDirectionStep,
        setUserNavigatedToDirectionStep: (value) => {
            state.userNavigatedToDirectionStep = value;
            // No need to notify on this change as it's just an internal tracking flag
        }
    };
    
    return stateManager;
}

// For backward compatibility during refactoring, export some methods directly
let stateManager = null;

export function getState() {
    if (!stateManager) {
        stateManager = initializeState();
        console.log('State manager initialized');
    }
    return stateManager;
}