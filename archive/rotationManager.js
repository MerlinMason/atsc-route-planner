// rotationManager.js - Handles map rotation functionality
import { setMapBearing, resetMapRotation } from './geometryUtils.js';

/**
 * Custom Leaflet control for the rotation toggle button
 */
class RotationToggleControl extends L.Control {
    constructor(options) {
        super(options);
        this.appState = options.appState;
    }
    
    onAdd(map) {
        // Create container and button
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-map-control');
        const button = L.DomUtil.create('a', 'control-button', container);
        button.id = 'toggleRotation';
        button.href = '#';
        button.setAttribute('role', 'button');
        
        // Set initial state
        const enabled = this.appState.isRotationEnabled();
        button.innerHTML = `<i class="material-icons">${enabled ? 'explore' : 'explore_off'}</i>`;
        button.title = enabled ? 'Disable map rotation' : 'Enable map rotation';
        if (enabled) button.classList.add('active');
        
        // Add click handler
        L.DomEvent.on(button, 'click', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            
            const newState = !this.appState.isRotationEnabled();
            this.appState.setRotationEnabled(newState);
            updateRotationButtonState(button, newState);
            
            // If turning off rotation, reset to north
            if (!newState) {
                if (map.setBearing) {
                    resetMapRotation(map, {
                        animate: true,
                        duration: 400,
                        force: true
                    }).catch(error => console.error('Error resetting map bearing:', error));
                }
            }
        });
        
        // Subscribe to state changes
        this.appState.subscribe('rotation:enabled:changed', (enabled) => {
            updateRotationButtonState(button, enabled);
        });
        
        return container;
    }
}

/**
 * Updates the rotation toggle button appearance based on state
 * @param {HTMLElement} button - The toggle button element
 * @param {boolean} enabled - Whether rotation is enabled
 */
function updateRotationButtonState(button, enabled) {
    const icon = button.querySelector('i.material-icons');
    
    if (enabled) {
        button.classList.add('active');
        button.title = 'Disable map rotation';
        if (icon) icon.textContent = 'explore';
    } else {
        button.classList.remove('active');
        button.title = 'Enable map rotation';
        if (icon) icon.textContent = 'explore_off';
    }
}

/**
 * Initializes map rotation functionality
 * @param {Object} appState - The application state manager
 */
export function initializeRotation(appState) {
    console.log('Initializing map rotation functionality...');
    
    // Add the rotation toggle control to the map
    new RotationToggleControl({
        position: 'topright',
        appState: appState
    }).addTo(appState.getMap());
    
    // Set up the in-panel toggle rotation button
    const toggleRotationButton = document.getElementById('toggleRotationPanel');
    if (toggleRotationButton) {
        // Set initial state
        const enabled = appState.isRotationEnabled();
        updateRotationButtonState(toggleRotationButton, enabled);
        
        // Add click handler
        toggleRotationButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Toggle rotation panel button clicked');
            
            const map = appState.getMap();
            const newState = !appState.isRotationEnabled();
            appState.setRotationEnabled(newState);
            console.log('Rotation enabled set to:', newState);
            
            // If turning off rotation, reset to north
            if (!newState && map.setBearing) {
                resetMapRotation(map, {
                    animate: true,
                    duration: 400,
                    force: true
                }).catch(error => console.error('Error resetting map bearing:', error));
            }
        });
        
        // Subscribe to state changes
        appState.subscribe('rotation:enabled:changed', (enabled) => {
            updateRotationButtonState(toggleRotationButton, enabled);
        });
        
        console.log('Rotation toggle button in directions panel initialized');
    } else {
        console.warn('Rotation toggle button in directions panel not found!');
    }
    
    return Promise.resolve();
} 