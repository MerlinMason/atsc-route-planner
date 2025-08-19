// app.js - Main application entry point
import { initializeState, getState } from './state.js';
import { initializeMap, initializeMapWithState } from './mapManager.js';
import { initializeLocationTracking, watchUserLocation } from './locationManager.js';
import { initializeMarkerManagement } from './markerManager.js';
import { initializeRouteManagement } from './routeManager.js';
import { initializeWaypointManagement } from './waypointManager.js';
import { initializeDirectionsPanel } from './directionsManager.js';
import { initializeEventListeners } from './eventManager.js';
import { initializeElevationChart } from './elevationChart.js';
import { initializeModals } from './modal.js';
import { initializeGPXSaving } from './fileUtils.js';

import { initializeRotation } from './rotationManager.js';

// Keep only ONE L.Map.mergeOptions block
L.Map.mergeOptions({
    tap: true,            // Enable tap
    touchZoom: true,      // Keep pinch zoom
    dragging: true,       // Keep drag panning
    tapHold: true,        // Enable built-in hold detection
    tapTolerance: 15,     // Slightly lower than default
    holdDelay: 700        // Match our long press timing
});

/**
 * Initialize feature buttons with direct imports
 * @param {Object} appState - Application state manager
 */
async function initializeFeatureButtons(appState) {
    // Google Drive integration button
    const googleDriveBtn = document.getElementById('googleDriveIntegration');
    if (googleDriveBtn) {
        googleDriveBtn.addEventListener('click', async () => {
            try {
                const module = await import('./features/googleDrive.js');
                await module.initializeGoogleDrive(appState);
            } catch (error) {
                console.error('Failed to initialize Google Drive integration:', error);
                const modal = await import('./modal.js');
                modal.showModal({
                    text: 'Failed to initialize Google Drive integration. Please try again.'
                });
            }
        });
    }

    // GPX import button
    const gpxImportBtn = document.getElementById('gpxImport');
    if (gpxImportBtn) {
        gpxImportBtn.addEventListener('click', async () => {
            try {
                const module = await import('./features/gpxImport.js');
                await module.showGPXImportDialog(appState);
            } catch (error) {
                console.error('Failed to initialize GPX import:', error);
                const modal = await import('./modal.js');
                modal.showModal({
                    text: 'Failed to initialize GPX import. Please try again.'
                });
            }
        });
    }
}

/**
 * Initialize core modules and register them in the registry
 * @param {Object} appState - Application state manager
 */
async function initializeCoreModules(appState) {
    console.log('Initializing core modules...');
    
    // Initialize map
    const map = initializeMap();
    
    // Wait for map to be ready before proceeding
    await new Promise(resolve => map.whenReady(resolve));
    console.log('Map is ready');
    
    // Update app state with map
    appState.setMap(map);
    appState.setMapReady(true);
    
    // Initialize core modules
    await initializeModals();
    await initializeLocationTracking(appState);
    await initializeMarkerManagement(appState);
    await initializeRouteManagement(appState);
    await initializeWaypointManagement(appState);
    await initializeDirectionsPanel(appState);
    await initializeElevationChart(appState);
    await initializeRotation(appState);
    
    // Initialize feature UI
    await initializeFeatureButtons(appState);
}

/**
 * Main application initialization function
 */
async function initializeApplication() {
    // Define the flags
    let routeLoadingFromStorage = false;
    let routeLoadingFromURL = false;

    console.log('Initializing Route Planner application...');
    
    // Get the singleton state instance
    const appState = getState();
    
    try {
        // Initialize core modules first
        await initializeCoreModules(appState);
        
        // Initialize URL handling with dynamic import
        const viewportManager = await import('./viewportManager.js');
        const urlManager = await import('./urlManager.js');
        
        // Check for stored route data
        const hasStorageRouteData = localStorage.getItem('routeData') !== null;
        if (hasStorageRouteData) {
            routeLoadingFromStorage = true;
            appState.setRouteJustLoaded(true);
        }
        
        // Initialize URL handling
        const urlResult = await urlManager.initializeURLHandling(appState);
        if (urlResult && urlResult.routeLoaded) {
            routeLoadingFromURL = true;
        }
        
        // Handle route loading
        if (routeLoadingFromStorage || routeLoadingFromURL) {
            const handleRouteProcessed = function() {
                console.log('Route loaded from storage/URL, explicitly fitting to entire route');
                
                // Try fitting multiple times with increasing delays for reliability
                setTimeout(() => {
                    console.log('First attempt to fit route (100ms)');
                    viewportManager.fitMapToRouteExplicit(appState);
                }, 100);
                
                setTimeout(() => {
                    console.log('Second attempt to fit route (500ms)');
                    viewportManager.fitMapToRouteExplicit(appState);
                }, 500);
                
                setTimeout(() => {
                    console.log('Final attempt to fit route (1000ms)');
                    viewportManager.fitMapToRouteExplicit(appState);
                }, 1000);
                
                // Unsubscribe using the function we stored
                if (unsubscribeRouteUpdated) {
                    unsubscribeRouteUpdated();
                }
            };
            
            // Store the unsubscribe function returned by subscribe
            const unsubscribeRouteUpdated = appState.subscribe('route:updated', handleRouteProcessed);
        }
        
        // Initialize GPX saving
        await initializeGPXSaving(appState);
        
        // Set up event listeners
        await initializeEventListeners(appState);
        
        // Initialize location tracking
        let initialFitPerformed = false;
        if (navigator.permissions) {
            const permission = await navigator.permissions.query({name:'geolocation'});
            console.log('Geolocation permission state:', permission.state);
        }
        
        try {
            // Skip initial center on user if we're loading a route from storage or URL
            const skipInitialCenter = routeLoadingFromStorage || routeLoadingFromURL;
            await watchUserLocation(appState, 5, skipInitialCenter);
            console.log('User location tracking initialized successfully');
            
            if (routeLoadingFromStorage || routeLoadingFromURL) {
                console.log('Route loading in progress, not centering on user');
            } else if (!initialFitPerformed && appState.getRouteLine()) {
                initialFitPerformed = true;
                console.log('Initial fit to route');
                            const viewportManager = await import('./viewportManager.js');
            await viewportManager.fitMapToRouteExplicit(appState);
            } else if (appState.getUserCoords()) {
                console.log('No route, centering on user location:', appState.getUserCoords());
                appState.getMap().setView(appState.getUserCoords(), 16);
            }
        } catch (error) {
            console.error('Failed to initialize user location tracking:', error);
            const modal = await import('./modal.js');
            modal.showModal({ 
                text: 'Could not access your location. Please check your browser permissions.' 
            });
        }
        
        // Set up route update subscription
        appState.subscribe('route:updated', async () => {
            const waypointManager = await import('./waypointManager.js');
            waypointManager.updateWaypointList(appState);
        });
        
        // Update map options
        const map = appState.getMap();
        map.options.tapHold = true;
        map.options.tapTolerance = 30;
        
        // Initialize map features that need access to appState
        await initializeMapWithState(appState);
        
        console.log('Route Planner application initialized successfully');
        
    } catch (error) {
        console.error('Error during application initialization:', error);
        const modal = await import('./modal.js');
        modal.showModal({ 
            text: 'Error initializing application. Please refresh the page.' 
        });
    }
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApplication);

// Handle visibility changes for performance optimization
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log("Window minimized at:", new Date().toISOString());
    } else {
        console.log("Window reopened at:", new Date().toISOString());
    }
});

/**
 * Expose a function globally with proper error handling and type checking
 * @param {string} name - Global function name
 * @param {Function} fn - Function to expose
 */
function exposeGlobalFunction(name, fn) {
    window[name] = async (...args) => {
        try {
            const appState = getState();
            return await fn(appState, ...args);
        } catch (error) {
            console.error(`Error in ${name}:`, error);
            const modal = await import('./modal.js');
            modal.showModal({ 
                text: `Error executing ${name}. Please try again.` 
            });
            throw error;
        }
    };
}

// Register global functions
async function registerGlobalFunctions() {
    const routeManager = await import('./routeManager.js');
    const routeProcessor = await import('./routeProcessor.js');
    const locationManager = await import('./locationManager.js');

    const elevationChart = await import('./elevationChart.js');
    const modal = await import('./modal.js');
    const urlManager = await import('./urlManager.js');
    
    exposeGlobalFunction('findRoute', routeManager.findRoute);
    exposeGlobalFunction('calculateRoute', routeProcessor.calculateRoute);
    exposeGlobalFunction('getCurrentLocation', locationManager.getCurrentLocation);
            exposeGlobalFunction('fitRoute', async (appState) => {
            const viewportManager = await import('./viewportManager.js');
            return viewportManager.fitMapToRouteExplicit(appState);
        });
    exposeGlobalFunction('updateElevationChart', elevationChart.updateElevationChart);
    exposeGlobalFunction('showModal', modal.showModal);
    exposeGlobalFunction('resetWelcomeModal', modal.resetWelcomeModalFlag);
    exposeGlobalFunction('generateShareableURL', async (appState) => {
        const url = await urlManager.generateShareableURL(appState);
        console.log('Generated URL:', url);
        return url;
    });
}

// Register global functions after DOM is loaded
document.addEventListener('DOMContentLoaded', registerGlobalFunctions);