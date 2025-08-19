// viewportManager.js - Centralized management of map viewport positioning
import { getState } from './state.js';
import { fitMapToRoute } from './geometryUtils.js';

// Track whether initial positioning has been done
let initialPositioningDone = false;

/**
 * Updates map position based on user location
 * @param {Object} appState - Application state manager
 * @param {Object} options - Positioning options
 * @param {boolean} options.userLocationAvailable - Whether user location is available
 * @param {boolean} options.skipInitialCenter - Whether to skip initial centering on user location
 */
export function updateMapPosition(appState, options = {}) {
    const { userLocationAvailable = false, skipInitialCenter = false } = options;
    
    // Only handle user location positioning here if not explicitly skipped
    if (userLocationAvailable && appState.getUserCoords() && !skipInitialCenter) {
        if (!initialPositioningDone) {
            console.log('Centering map on user location:', appState.getUserCoords());
            appState.getMap().setView(appState.getUserCoords(), 16);
            initialPositioningDone = true;
            return;
        }
    } else if (userLocationAvailable && skipInitialCenter) {
        // Mark positioning as done but don't center
        initialPositioningDone = true;
        console.log('Initial centering on user skipped (route loading in progress)');
    }
    
    // Handle follow mode
    if (appState.isFollowingUser() && appState.getUserCoords()) {
        console.log('Following user, updating map center');
        appState.getMap().setView(appState.getUserCoords(), appState.getMap().getZoom());
    }
}

/**
 * Explicitly fits the map to the current route
 * @param {Object} appState - Application state manager
 * @returns {Promise<boolean>} Promise that resolves with whether the fit was successful
 */
export function fitMapToRouteExplicit(appState) {
    if (!appState.getMap() || !appState.isMapReady()) {
        console.warn('Cannot fit map to route: Map not ready');
        return Promise.resolve(false);
    }
    
    if (!appState.getRouteLine()) {
        console.warn('Cannot fit map to route: No route to fit');
        return Promise.resolve(false);
    }
    
    // Extra check to ensure route has valid bounds
    const routeLine = appState.getRouteLine();
    if (!routeLine.getBounds || !routeLine.getBounds().isValid()) {
        console.warn('Cannot fit map to route: Route has invalid bounds');
        return Promise.resolve(false);
    }
    
    console.log('Fitting map to route');
    return new Promise(resolve => {
        const result = fitMapToRoute(appState);
        if (result) {
            console.log('Successfully fitted map to route');
        } else {
            console.warn('Failed to fit map to route');
        }
        initialPositioningDone = true;
        resolve(result);
    });
}

/**
 * Explicitly centers the map on user location
 * @param {Object} appState - Application state manager
 */
export function centerOnUserExplicit(appState) {
    if (!appState.getUserCoords()) {
        console.log('No user location to center on');
        return false;
    }
    
    console.log('Explicitly centering on user');
    appState.getMap().setView(appState.getUserCoords(), 16);
    return true;
}

/**
 * Resets the positioning state (e.g. when clearing route)
 */
export function resetPositioningState() {
    initialPositioningDone = false;
}

/**
 * Gets whether initial positioning has been done
 * @returns {boolean} Whether initial positioning is done
 */
export function isInitialPositioningDone() {
    return initialPositioningDone;
}