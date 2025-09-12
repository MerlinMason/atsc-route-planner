// mapManager.js - Map initialization and management
import { mapKey } from './apiUtils.js';
import { setMapBearing, setCurrentRotation, resetMapRotation } from './geometryUtils.js';

/**
 * Custom control for resetting map rotation to north
 */
class ResetRotationControl extends L.Control {
    constructor(options) {
        super(options);
    }
    
    onAdd(map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-map-control');
        const button = L.DomUtil.create('a', 'control-button', container);
        button.innerHTML = '<i class="material-icons">north</i>';
        button.href = '#';
        button.title = 'Reset orientation to North';
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', 'Reset orientation to North');
        
        L.DomEvent.on(button, 'click', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            if (map.setBearing) {
                resetMapRotation(map, { 
                    animate: true, 
                    duration: 400,
                    force: true
                }).catch(error => console.error('Error resetting map bearing:', error));
            }
        });
        
        return container;
    }
}

/**
 * Initializes the Leaflet map
 * @returns {Object} The leaflet map instance
 */
export function initializeMap() {
    console.log('Initializing map...');
    
    // Create the map instance with rotation enabled
    const map = L.map('map', {
        rotate: true,
        bearing: 0,
        fadeAnimation: true,
        rotateControl: {
            closeOnZeroBearing: false,
            position: 'bottomright'
        }
    });
    
    // Verify rotation capability after map creation
    console.log('Map rotation capabilities:', {
        hasBearingMethod: typeof map.setBearing === 'function'
    });
    
    // Add the tile layer
    L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        maxZoom: 18,
        id: 'outdoors-v12',
        tileSize: 512,
        zoomOffset: -1,
        fadeAnimation: true,
        accessToken: mapKey
    }).addTo(map);
    
    // Add a custom control to reset the rotation
    new ResetRotationControl({
        position: 'topright'
    }).addTo(map);
    
    // Set initial view
    const initialCoords = [51.5074, -0.1278]; // London
    map.setView(initialCoords, 13);
    
    // Set up window resize handler
    window.onresize = () => adjustMapSize(map);
    
    // Initialize map size
    adjustMapSize(map);
    
    return map;
}

/**
 * Adjusts the map size based on control bar and directions panel
 * @param {Object} map - The leaflet map instance
 */
export function adjustMapSize(map) {
    const controlBarHeight = getElementHeight('.control-bar');
    const directionsPanelHeight = getElementHeight('.directions-panel');
    const viewportHeight = window.innerHeight;
    
    const mapElement = document.getElementById('map');
    mapElement.style.height = `${viewportHeight - controlBarHeight - directionsPanelHeight}px`;
    mapElement.style.top = `${controlBarHeight}px`;
    
    // Ensure the map recognizes the size change
    if (map) {
        map.invalidateSize();
    }
}

/**
 * Gets the height of an element
 * @param {string} selector - CSS selector for the element
 * @returns {number} The element's height
 */
function getElementHeight(selector) {
    const element = document.querySelector(selector);
    return element ? element.offsetHeight : 0;
}

/**
 * Creates icon objects for map markers
 * @returns {Object} Object containing different map icons
 */
export function createMapIcons() {
    return {
        userLocationIcon: L.divIcon({
            className: 'user-location-icon',
            html: '<i class="material-icons">my_location</i>'
        }),
        
        startIcon: L.divIcon({
            className: 'start-icon',
            html: '<i class="material-icons">location_on</i>'
        }),
        
        endIcon: L.divIcon({
            className: 'end-icon',
            html: '<i class="material-icons">flag</i>'
        }),
        
        removeButtonIcon: L.divIcon({
            className: 'removeBtn',
            html: '<i class="material-icons">cancel</i>'
        })
    };
}

/**
 * Creates a waypoint icon with a number
 * @param {number} number - The waypoint number
 * @returns {Object} Leaflet divIcon for the waypoint
 */
export function createWaypointIcon(number) {
    return L.divIcon({
        className: 'waypoint-icon',
        html: `<div class="waypoint-label">${number}</div>`,
        iconSize: [30, 30], // Explicit size to match CSS
        iconAnchor: [15, 15] // Center the icon on the point
    });
}

/**
 * Creates a temporary confirmation marker icon
 * @returns {Object} Leaflet divIcon for the confirmation marker
 */
export function createConfirmationMarkerIcon() {
    return L.divIcon({
        className: 'confirmation-marker',
        html: '<i class="material-icons">add</i>', // Changed to 'add' icon
        iconSize: [36, 36],
        iconAnchor: [18, 18]     // Center anchor point
    });
}

/**
 * Sets up event listeners for map UI controls
 * @param {Object} appState - Application state manager
 */
function setupMapControls(appState) {
    const map = appState.getMap();
    console.log('Setting up map controls for the directions panel...');
    
    // Set up the reset north button in the directions panel
    const resetNorthButton = document.getElementById('resetNorthPanel');
    if (resetNorthButton) {
        resetNorthButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Reset north panel button clicked');
            if (map.setBearing) {
                resetMapRotation(map, {
                    animate: true,
                    duration: 400,
                    force: true
                });
            } else {
                console.warn('Cannot reset orientation: Map rotation not supported');
            }
        });
        resetNorthButton.title = 'Reset orientation to North';
        console.log('Reset north button in directions panel initialized');
    } else {
        console.warn('Reset north button in directions panel not found!');
    }
}

/**
 * Full map initialization including components that need the appState
 * @param {Object} appState - Application state
 * @returns {Promise} Promise that resolves when initialization is complete
 */
export function initializeMapWithState(appState) {
    // Set up map controls that need access to appState
    setupMapControls(appState);
    
    return Promise.resolve();
}