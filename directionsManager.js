// directionsManager.js - Managing directions display
/**
 * Initializes the directions panel
 * @param {Object} appState - The application state manager
 */
export function initializeDirectionsPanel(appState) {
    console.log('Initializing directions panel...');
    
    // Subscribe to relevant state changes
    appState.subscribe('instructions:updated', () => {
        showCurrentDirection(appState);
    });
    
    appState.subscribe('instruction:current:updated', () => {
        showCurrentDirection(appState);
    });
    
    appState.subscribe('distance:updated', () => {
        updateDistanceDisplay(appState);
    });
    
    appState.subscribe('state:reset', () => {
        resetDirectionsPanel();
    });
}

/**
 * Shows the current direction instruction
 * @param {Object} appState - Application state manager
 */
export function showCurrentDirection(appState) {
    // Check if we're in initial route loading
    const isInitialRouteLoad = appState.isRouteJustLoaded && appState.isRouteJustLoaded();
    
    const instructions = appState.getInstructions();
    const currentInstructionIndex = appState.getCurrentInstructionIndex();
    
    const currentDirectionElement = document.getElementById('currentDirection');

    if (instructions.length === 0) {
        currentDirectionElement.innerText = "No navigation instructions available.";
        return;
    }

    // Display current instruction
    if (currentInstructionIndex >= 0 && currentInstructionIndex < instructions.length) {
        const instruction = instructions[currentInstructionIndex];
        
        // Display total route length
        updateDistanceDisplay(appState);
        
        if (instruction.isOverviewInstruction) {
            // Special handling for the "Go" instruction
            const totalDistance = appState.getTotalDistance();
            const distanceInKm = totalDistance ? (totalDistance / 1000).toFixed(2) + ' km' : '';
            
            // Show a more informative overview message
            currentDirectionElement.innerText = `Go - Total distance: ${distanceInKm}`;
            
            // Only fit to the entire route if the user hasn't manually navigated to a direction
            // or if we're showing the overview explicitly (index 0)
            if (!appState.hasUserNavigatedToDirectionStep() || currentInstructionIndex === 0) {
                import('./viewportManager.js').then(viewportManager => {
                    viewportManager.fitMapToRouteExplicit(appState);
                });
            }
        } else {
            // Regular direction handling
            const distance = Math.round(instruction.distance);
            currentDirectionElement.innerText = `${currentInstructionIndex}. ${instruction.text} - ${distance}m`;
            
            // Highlight the segment as usual
            import('./routeManager.js').then(routeManager => {
                // Always enable zooming for the first direction after "Go"
                // This ensures we always zoom to the first segment when showing directions
                const shouldZoom = currentInstructionIndex === 1 || !isInitialRouteLoad;
                console.log(`Highlighting segment for direction ${currentInstructionIndex} with zoom:`, shouldZoom);
                routeManager.highlightRouteSegment(appState, currentInstructionIndex - 1, shouldZoom);
            });
        }
    } else {
        currentDirectionElement.innerText = "No navigation instructions available.";
    }
}

/**
 * Updates the distance display in the UI
 * @param {Object} appState - Application state manager
 * @param {number} [distance] - Distance in meters (if not provided, uses the value from state)
 */
export function updateDistanceDisplay(appState, distance) {
    // If distance is provided, update the state
    if (typeof distance === 'number') {
        appState.setTotalDistance(distance);
    }
    
    // Get the current distance (either the new one or the existing one)
    const totalDistance = appState.getTotalDistance();
    const totalDistanceElement = document.getElementById('totalDistance');
    
    if (totalDistanceElement) {
        if (totalDistance) {
            // Convert to kilometers and round to 2 decimal places
            const distanceInKm = (totalDistance / 1000).toFixed(2);
            totalDistanceElement.classList.add('totalDistanceStyle');
            totalDistanceElement.innerText = `Distance: ${distanceInKm} km`;
        } else {
            // Handle zero distance case
            totalDistanceElement.innerText = 'Distance: 0.0km';
        }
    }
}

/**
 * Changes to the next or previous direction
 * @param {Object} appState - Application state manager
 * @param {number} step - Step to move (+1 for next, -1 for previous)
 */
export function changeDirection(appState, step) {
    const instructions = appState.getInstructions();
    const currentIndex = appState.getCurrentInstructionIndex();
    
    if (!instructions || instructions.length === 0) return;
    
    const newIndex = Math.max(0, Math.min(instructions.length - 1, currentIndex + step));
    if (newIndex === currentIndex) return;
    
    appState.setCurrentInstructionIndex(newIndex);
    
    // Handle direction changes directly
    if (newIndex === 0) {
        // Reset map rotation to north when returning to overview "Go" step
                    import('./geometryUtils.js').then(geometryUtils => {
                // Get the map from appState
                const map = appState.getMap();
                if (map) {
                    geometryUtils.resetMapRotation(map, { 
                        animate: true,
                        duration: 600,
                        force: true
                    });
                }
            });
        
        // Reset the navigation flag when user returns to overview
        appState.setUserNavigatedToDirectionStep(false);
        
        // Clear highlights and fit to route
        Promise.all([
            // Clear map highlights
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
            // Clear elevation highlights
            import('./elevationChart.js').then(module => {
                if (module.clearElevationHighlight) {
                    return module.clearElevationHighlight();
                }
            }).catch(error => {
                console.error('Error clearing elevation highlights:', error);
            })
        ]).then(() => {
            // Update directions display
            showCurrentDirection(appState);
            updateDistanceDisplay(appState);
            
            // Fit to the entire route
            import('./viewportManager.js').then(viewportManager => {
                viewportManager.fitMapToRouteExplicit(appState);
            });
        });
    } else {
        // Set flag to indicate user has navigated to a specific direction step
        appState.setUserNavigatedToDirectionStep(true);
        
        // Regular direction - highlight the corresponding segment
        console.log(`Changing to direction ${newIndex}, highlighting segment ${newIndex - 1} with zooming enabled`);
        import('./routeManager.js').then(routeManager => {
            routeManager.highlightRouteSegment(appState, newIndex - 1, true);
        });
    }
}

/**
 * Resets the directions panel to default state
 */
function resetDirectionsPanel() {
    const currentDirectionElement = document.getElementById('currentDirection');
    const totalDistanceElement = document.getElementById('totalDistance');
    
    if (currentDirectionElement) {
        currentDirectionElement.innerText = "No route set...";
    }
    
    if (totalDistanceElement) {
        totalDistanceElement.innerText = "Distance: 0.0km";
    }
}