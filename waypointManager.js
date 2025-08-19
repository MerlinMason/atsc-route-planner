// waypointManager.js - Managing waypoints
import { createWaypointIcon, createMapIcons } from './mapManager.js';
import { getState } from './state.js';
import { updateRoute } from './routeProcessor.js';
// Remove this import to break the circular dependency
// import { calculateRoute } from './routeManager.js';
// Remove direct imports from routeActions.js

const MAX_WAYPOINTS = 28;

/**
 * MarkerController class - Handles all marker-related operations
 */
class MarkerController {
    constructor(appState) {
        this.appState = appState;
        this.activeRemovalTimer = null;
    }

    setupMarkerEvents(marker) {
        marker.on({
            click: () => this.showRemovalButton(marker),
            dragstart: () => this.handleDragStart(),
            dragend: () => this.handleDragEnd(marker)
        });
        return marker;
    }

    handleDragStart() {
        this.appState.setDragging(true);
    }

    handleDragEnd(marker) {
        return updateRoute(this.appState, { source: 'waypoint_drag' })
            .then(() => this.appState.setDragging(false));
    }

    showRemovalButton(marker) {
        this.clearRemovalButton();
        
        const btnMarker = this.createRemovalButton(marker);
        this.appState.setButtonMarker(btnMarker);
        
        this.activeRemovalTimer = setTimeout(() => 
            this.clearRemovalButton(), 5000);
    }

    createRemovalButton(marker) {
        const map = this.appState.getMap();
        const icons = createMapIcons();

        const btnMarker = L.marker(marker.getLatLng(), {
            icon: icons.removeButtonIcon
        }).addTo(map);

        btnMarker.on('click', () => {
            this.clearRemovalButton();
            if (this.onRemoveWaypoint) {
                this.onRemoveWaypoint(marker);
            }
        });

        return btnMarker;
    }

    clearRemovalButton() {
        const map = this.appState.getMap();
        const btnMarker = this.appState.getButtonMarker();
        
        if (this.activeRemovalTimer) {
            clearTimeout(this.activeRemovalTimer);
            this.activeRemovalTimer = null;
        }
        
        if (map && btnMarker) {
            map.removeLayer(btnMarker);
            this.appState.setButtonMarker(null);
        }
    }

    createWaypointMarker(latlng, number) {
        const marker = L.marker(latlng, {
            icon: createWaypointIcon(number),
            draggable: !this.appState.isMarkersLocked()
        }).addTo(this.appState.getMap());

        marker.waypointNumber = number;
        marker.locationName = "";

        return this.setupMarkerEvents(marker);
    }
}

// Singleton instance
let waypointManagerInstance = null;

/**
 * Get or create the WaypointManager instance
 * @param {Object} appState - Application state manager
 * @returns {WaypointManager} The singleton instance
 */
function getWaypointManager(appState) {
    if (!waypointManagerInstance || waypointManagerInstance.appState !== appState) {
        waypointManagerInstance = new WaypointManager(appState);
    }
    return waypointManagerInstance;
}

/**
 * WaypointManager class - Handles all waypoint-related operations
 */
class WaypointManager {
    // Cache DOM elements
    elements = {
        list: null,
        toggleButton: null
    };

    // UI Configuration
    uiConfig = {
        items: {
            start: { className: 'waypoint-item fixed', icon: 'location_on' },
            waypoint: { className: 'waypoint-item', icon: 'drag_indicator' },
            end: { className: 'waypoint-item fixed', icon: 'sports_score' }
        },
        lockIcon: {
            html: '<i class="material-icons" style="font-size: 14px;">lock</i>',
            className: 'lock-indicator'
        },
        sortable: {
            animation: 150,
            filter: '.fixed, .close-button',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag'
        }
    };

    constructor(appState) {
        this.appState = appState;
        this.sortable = null;
        this.markerController = new MarkerController(appState);
        this.markerController.onRemoveWaypoint = (marker) => this.removeWaypoint(marker);
        this.initializeElements();
        this.setupReactiveUI();
    }

    /**
     * Initialize and cache DOM elements
     */
    initializeElements() {
        this.elements.list = document.getElementById('waypointList');
        if (!this.elements.list) return;

        // Create and cache toggle button
        this.elements.toggleButton = document.createElement('button');
        this.elements.toggleButton.className = 'close-button';
        this.elements.toggleButton.innerHTML = '<i class="material-icons-outlined">list</i> Waypoints';
        
        this.elements.list.insertBefore(this.elements.toggleButton, this.elements.list.firstChild);
        this.elements.list.classList.remove('open');

        // Create the peek indicator for mobile if needed
        if (window.matchMedia('(max-width: 768px)').matches) {
            this.createPeekIndicator();
        }

        // Initial UI updates
        this.renderWaypoints();
        this.adjustWaypointListHeight();
    }

    /**
     * Creates a peek indicator for mobile devices
     */
    createPeekIndicator() {
        // Remove any existing peek indicator
        const existingIndicator = document.querySelector('.waypoint-peek-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create a small visible element to act as the peek indicator on mobile
        const peekIndicator = document.createElement('div');
        peekIndicator.className = 'waypoint-peek-indicator';
        peekIndicator.innerHTML = '<i class="material-icons">list</i>';
        document.body.appendChild(peekIndicator);
        
        // Add click event to open the waypoint list
        peekIndicator.addEventListener('click', () => {
            this.elements.list.classList.add('open');
            peekIndicator.style.display = 'none'; // Hide the indicator when list is open
        });
        
        // Store the reference
        this.elements.peekIndicator = peekIndicator;
        
        // Also update the toggle button to hide the peek indicator when closing the list
        this.elements.toggleButton.addEventListener('click', () => {
            const isOpen = this.elements.list.classList.contains('open');
            if (isOpen) {
                this.elements.peekIndicator.style.display = 'flex';
            } else {
                this.elements.peekIndicator.style.display = 'none';
            }
        });
    }

    /**
     * Set up reactive UI updates and event handlers
     */
    setupReactiveUI() {
        if (!this.elements.list) return;

        // State change subscriptions
        this.appState.subscribe('waypoints:updated', () => this.renderWaypoints());
        this.appState.subscribe('markers:locked:changed', () => this.renderWaypoints());
        
        // Event handlers
        window.addEventListener('resize', () => this.adjustWaypointListHeight());
        
        // Update the toggle button event listener
        this.elements.toggleButton?.addEventListener('click', () => {
            const isCurrentlyOpen = this.elements.list.classList.contains('open');
            this.elements.list.classList.toggle('open');
            
            // Update peek indicator visibility if it exists
            if (this.elements.peekIndicator) {
                this.elements.peekIndicator.style.display = isCurrentlyOpen ? 'flex' : 'none';
            }
        });
        
        // Handle window resize to re-create peek indicator if needed
        window.addEventListener('resize', () => {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (isMobile && !this.elements.peekIndicator) {
                this.createPeekIndicator();
            } else if (!isMobile && this.elements.peekIndicator) {
                this.elements.peekIndicator.remove();
                this.elements.peekIndicator = null;
            }
        });
    }

    /**
     * Render the entire waypoint UI
     */
    renderWaypoints() {
        if (!this.elements.list) return;

        // Keep the toggle button
        const toggleButton = this.elements.toggleButton;
        
        // Clear the existing list
        this.elements.list.innerHTML = '';
        
        // Add the toggle button back
        if (toggleButton) {
            this.elements.list.appendChild(toggleButton);
        }
        
        // Get addresses
        const startAddress = document.getElementById('startPostcode')?.value || 'Start';
        const endAddress = document.getElementById('endPostcode')?.value || 'End';
        
        // Add start marker
        if (this.appState.getStartMarker()) {
            const startItem = this.createWaypointItem('start', startAddress);
            if (startItem) this.elements.list.appendChild(startItem);
        }
        
        // Add waypoints with their location names
        const waypoints = this.appState.getWaypoints();
        if (waypoints.length > 0) {
            waypoints.forEach((marker, index) => {
                const label = marker.locationName ? 
                    `${marker.waypointNumber}. ${marker.locationName}` : 
                    marker.waypointNumber;
                const waypointItem = this.createWaypointItem('waypoint', label, index);
                if (waypointItem) this.elements.list.appendChild(waypointItem);
            });
        }
        
        // Add end marker
        if (this.appState.getEndMarker()) {
            const endItem = this.createWaypointItem('end', endAddress);
            if (endItem) this.elements.list.appendChild(endItem);
        }
        
        // Update visibility and layout
        this.elements.list.style.display = 'block';
        this.initializeSortable();
        this.adjustWaypointListHeight();
        
        // Update lock indicators
        this.updateLockIndicators(this.appState.isMarkersLocked());
    }

    /**
     * Add a waypoint at specified coordinates
     * @param {Object} latlng - Coordinates for the waypoint
     * @returns {Promise} Promise that resolves with the created waypoint
     */
    addWaypoint(latlng) {
        if (this.appState.isMarkersLocked()) {
            console.log("Markers are locked. Cannot add waypoint.");
            return Promise.resolve(null);
        }

        const waypoints = this.appState.getWaypoints();
        if (waypoints.length >= MAX_WAYPOINTS) {
            alert(`Waypoint limit reached (${MAX_WAYPOINTS}). Please remove a waypoint before trying to add another.`);
        return Promise.resolve(null);
    }
    
        const marker = this.markerController.createWaypointMarker(latlng, waypoints.length + 1);
        
        return this.updateWaypoints(
            currentWaypoints => [...currentWaypoints, marker],
            { source: 'waypoint_add' }
        )
        .then(() => this.updateWaypointLocation(marker))
        .then(() => {
            return this.sortWaypoints({ skipZooming: true })
                .then(() => marker);
        });
    }

    /**
     * Update waypoint location using reverse geocoding
     */
    updateWaypointLocation(marker) {
        return import('./geoCoding.js')
            .then(module => {
                if (module.reverseGeocode) {
                    return new Promise(resolve => {
                        module.reverseGeocode(marker.getLatLng(), (address) => {
                            marker.locationName = address;
                            this.renderWaypoints();
                            resolve();
                        }, false);
                    });
                }
                return Promise.resolve();
            });
    }

    /**
     * Remove a waypoint and clean up its resources
     */
    removeWaypoint(marker) {
        const map = this.appState.getMap();
        if (map && marker) map.removeLayer(marker);
        
        return this.updateWaypoints(
            waypoints => waypoints.filter(wp => wp !== marker),
            { source: 'waypoint_remove' }
        );
    }

    /**
     * Update waypoints with a given operation
     * @param {Function} operation - Function that takes current waypoints and returns updated waypoints
     * @param {Object} options - Options for the update
     * @returns {Promise} Promise that resolves when the update is complete
     */
    updateWaypoints(operation, options = {}) {
        const waypoints = this.appState.getWaypoints();
        const updatedWaypoints = operation(waypoints);
        
        // Update waypoint numbers
        updatedWaypoints.forEach((waypoint, index) => {
            waypoint.waypointNumber = index + 1;
            waypoint.setIcon(createWaypointIcon(index + 1));
        });
        
        // Update state
        this.appState.updateWaypoints(updatedWaypoints);
        
        // Update route if needed
        if (!options.skipRouteUpdate) {
            return this.updateRoute({
                skipZooming: options.skipZooming,
                source: options.source || 'waypoint_update'
        });
    }
    
    return Promise.resolve();
}

/**
     * Sort waypoints to optimize route
     */
    sortWaypoints(options = {}) {
        const startMarker = this.appState.getStartMarker();
        if (!startMarker) return Promise.resolve();

        return this.updateWaypoints(
            waypoints => this.calculateOptimalOrder(waypoints, startMarker),
            { ...options, source: 'waypoint_sort' }
        );
    }

    /**
     * Calculate optimal waypoint order
     * @param {Array} waypoints - Array of waypoint markers
     * @param {Object} startMarker - Starting point marker
     * @returns {Array} Optimally ordered waypoints
     */
    calculateOptimalOrder(waypoints, startMarker) {
        // Calculate distances from start marker to each waypoint
        let distances = waypoints.map(wp => ({
            waypoint: wp,
            distance: L.latLng(startMarker.getLatLng()).distanceTo(wp.getLatLng())
        }));
        
        // Sort by distance from start
        distances.sort((a, b) => a.distance - b.distance);
        
        // Initialize with closest waypoint to start
        const sortedWaypoints = [distances[0].waypoint];
        
        // Create distance matrix between all waypoints
        const distanceMatrix = distances.map(a => 
            distances.map(b => 
                L.latLng(a.waypoint.getLatLng()).distanceTo(b.waypoint.getLatLng())
            )
        );
        
        // Insert remaining waypoints at optimal positions
        for (let i = 1; i < distances.length; i++) {
            let inserted = false;
            
            // Try to insert at the best position
            for (let j = 0; j < sortedWaypoints.length - 1; j++) {
                const indexA = waypoints.indexOf(sortedWaypoints[j]);
                const indexB = waypoints.indexOf(sortedWaypoints[j + 1]);
                const currentDist = distanceMatrix[indexA][indexB];
                
                const indexC = waypoints.indexOf(distances[i].waypoint);
                const newDist1 = distanceMatrix[indexA][indexC];
                const newDist2 = distanceMatrix[indexC][indexB];
                
                if (newDist1 + newDist2 < currentDist) {
                    sortedWaypoints.splice(j + 1, 0, distances[i].waypoint);
                    inserted = true;
                    break;
                }
            }
            
            if (!inserted) {
                sortedWaypoints.push(distances[i].waypoint);
            }
        }
        
        return sortedWaypoints;
    }

    /**
     * Update route after waypoint changes
     */
    updateRoute(options = {}) {
        if (!this.appState.getStartMarker() || !this.appState.getEndMarker()) {
            return Promise.resolve();
        }

        return updateRoute(this.appState, options);
    }

    /**
     * Handle marker lock state change
     */
    handleMarkerLockChange(locked) {
        this.initializeSortable();
        this.updateLockIndicators(locked);
    }

    /**
     * Update lock indicators in the UI
     */
    updateLockIndicators(locked) {
        if (!this.elements.list) return;

        const waypointItems = this.elements.list.querySelectorAll('.waypoint-item');
        const { className, html } = this.uiConfig.lockIcon;

        waypointItems.forEach(item => {
            if (locked) {
                item.classList.add('locked');
                if (!item.querySelector(`.${className}`)) {
                    const lockIcon = document.createElement('span');
                    lockIcon.className = className;
                    lockIcon.innerHTML = html;
                    item.appendChild(lockIcon);
                }
            } else {
                item.classList.remove('locked');
                const lockIcon = item.querySelector(`.${className}`);
                if (lockIcon) item.removeChild(lockIcon);
            }
        });
    }

    /**
     * Create a waypoint item element with consistent styling
     */
    createWaypointItem(type, text, index = undefined) {
        const config = this.uiConfig.items[type];
        if (!config) return null;

    const item = document.createElement('div');
        item.className = config.className;
        item.innerHTML = `<i class="material-icons-outlined">${config.icon}</i>${text}`;
    
    if (index !== undefined) {
        item.setAttribute('data-index', index);
        item.id = `waypoint-${index}`;
    }
    
    return item;
}

/**
     * Initialize sortable functionality
 */
    initializeSortable() {
        if (!this.elements.list) return;
    
    // Destroy existing sortable instance if it exists
        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
        
        if (typeof Sortable === 'undefined') {
            console.error("Sortable library not found. Waypoint reordering will not work.");
            return;
        }

        // If markers are locked, create a disabled version of sortable
        if (this.appState.isMarkersLocked()) {
            this.sortable = new Sortable(this.elements.list, {
                ...this.uiConfig.sortable,
                filter: ".fixed, .close-button, .waypoint-item",
                disabled: true
            });
            console.log("Sortable initialized in disabled mode (markers locked).");
            return;
        }
        
        // Normal sortable initialization
        this.sortable = new Sortable(this.elements.list, {
            ...this.uiConfig.sortable,
            onMove: evt => evt.related.className.indexOf('fixed') === -1 && 
                         evt.related.className.indexOf('close-button') === -1,
            onUpdate: (evt) => this.handleSortableUpdate(evt)
        });
        
        console.log("Sortable initialized.");
    }

    /**
     * Handle sortable update event
     */
    handleSortableUpdate(evt) {
        const waypointList = document.getElementById('waypointList');
                const allItems = Array.from(waypointList.children);
                const waypointItems = allItems.filter(item => 
                    !item.classList.contains('fixed') && 
                    !item.classList.contains('close-button'));
                
        const oldWaypointIndex = parseInt(evt.item.dataset.index, 10);
                let newIndex = evt.newIndex;
                
        // Calculate new waypoint index accounting for fixed items
                const beforeItems = allItems.slice(0, newIndex);
                const offset = beforeItems.filter(item => 
                    item.classList.contains('fixed') || 
                    item.classList.contains('close-button')).length;
                
        const newWaypointIndex = newIndex - offset;
                
                if (oldWaypointIndex >= 0 && newWaypointIndex >= 0 && oldWaypointIndex !== newWaypointIndex) {
            this.updateWaypointsOrder(oldWaypointIndex, newWaypointIndex);
    }
}

/**
     * Update waypoints order after drag and drop
     */
    updateWaypointsOrder(oldIndex, newIndex) {
        return this.updateWaypoints(waypoints => {
            if (!this.isValidIndex(oldIndex, waypoints) || !this.isValidIndex(newIndex, waypoints)) {
        console.error('Invalid waypoint indices:', oldIndex, newIndex);
                return waypoints;
            }
            
            const newWaypoints = [...waypoints];
            const [waypoint] = newWaypoints.splice(oldIndex, 1);
            newWaypoints.splice(newIndex, 0, waypoint);
            return newWaypoints;
        }, { source: 'waypoint_reorder' });
    }

    /**
     * Check if index is valid for waypoints array
     */
    isValidIndex(index, waypoints) {
    return index >= 0 && index < waypoints.length;
}

/**
     * Adjust waypoint list height based on content and viewport
     */
    adjustWaypointListHeight() {
        if (!this.elements.list) return;
        
        const viewportHeight = window.innerHeight;
        const waypointItems = this.elements.list.querySelectorAll('.waypoint-item');
        const toggleButtonHeight = this.elements.toggleButton?.offsetHeight || 0;
        const itemsHeight = waypointItems.length * 40;
        const totalContentHeight = itemsHeight + toggleButtonHeight + 20;
        
        const maxHeight = Math.min(totalContentHeight, viewportHeight * 0.7);
        
        this.elements.list.style.maxHeight = `${maxHeight}px`;
        this.elements.list.style.overflowY = 'auto';
        this.elements.list.style.overflowX = 'hidden';
    }
}

// Export a function to create and initialize the WaypointManager
export function initializeWaypointManagement(appState) {
    return getWaypointManager(appState);
}

// Export other necessary functions that need to remain as standalone
export function addWaypointFromLatLng(appState, latlng) {
    // Reset the direction navigation state when adding a waypoint
    // This ensures we go back to the overview step when the route changes
    appState.setUserNavigatedToDirectionStep(false);
    appState.setCurrentInstructionIndex(0);
    
    return getWaypointManager(appState).addWaypoint(latlng);
}

// Alias for backward compatibility
export const addWaypointAndUpdateRoute = addWaypointFromLatLng;

export function removeWaypointAndUpdateRoute(appState, waypoint) {
    // Reset the direction navigation state when removing a waypoint
    // This ensures we go back to the overview step when the route changes
    appState.setUserNavigatedToDirectionStep(false);
    appState.setCurrentInstructionIndex(0);
    
    return getWaypointManager(appState).removeWaypoint(waypoint);
}

export function showRemovalButton(appState, marker) {
    const manager = getWaypointManager(appState);
    return manager.markerController.showRemovalButton(marker);
}

export function sortWaypoints(appState, options) {
    // Reset the direction navigation state when sorting waypoints
    // This ensures we go back to the overview step when the route changes
    appState.setUserNavigatedToDirectionStep(false);
    appState.setCurrentInstructionIndex(0);
    
    return getWaypointManager(appState).sortWaypoints(options);
}

// Maintain backward compatibility with old function names
export const updateWaypointNumbers = (appState) => {
    const manager = getWaypointManager(appState);
    return manager.updateWaypoints(waypoints => waypoints);
};

export const renumberWaypoints = updateWaypointNumbers;

export function updateWaypointList(appState) {
    return getWaypointManager(appState).renderWaypoints();
}