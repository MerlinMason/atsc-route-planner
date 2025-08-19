// geoCoding.js - Address geocoding and reverse geocoding
import { boiledEgg } from './apiUtils.js';
import { getState } from './state.js';
import { showModal } from './modal.js';

// Maintain compatibility with existing code
export let startAddress = '';
export let endAddress = '';

export function setStartAddress(address) {
    startAddress = address;
    const appState = getState();
    appState.setStartAddress(address);
}

export function setEndAddress(address) {
    endAddress = address;
    const appState = getState();
    appState.setEndAddress(address);
}

export function getStartAddress() {
    const appState = getState();
    return appState.getStartAddress();
}

export function getEndAddress() {
    const appState = getState();
    return appState.getEndAddress();
}

/**
 * Geocodes an address to coordinates
 * @param {string} address - Address to geocode
 * @param {string} type - Type of address ('start' or 'end')
 * @returns {Promise} Promise resolving to coordinates
 */
export function geocodeAddress(address, type) {
    const appState = getState();
    const apiKey = boiledEgg; 
    const apiUrl = `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(address)}&locale=en&key=${apiKey}`;
    
    console.log(`⏳ Starting geocoding for ${type} address: ${address}`);
    
    return fetch(apiUrl)
        .then(response => {
            console.log(`📥 Received response for ${type}: ${response.status}`);
            if (!response.ok) {
                throw new Error(`Geocoding error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`🔍 Geocoding results for ${type}:`, data);
            
            // Handle no results
            if (!data.hits || data.hits.length === 0) {
                throw new Error('No geocoding results found');
            }
            
            // For multiple results, apply custom sorting before showing selection UI
            if (data.hits.length > 1) {
                // Sort the hits using our custom cycling-focused algorithm
                sortHitsForCycling(data.hits, type, appState);
                
                return new Promise((resolve) => {
                    // Create address options for modal with more descriptive labels
                    let customContent = '<div class="address-list">';
                    data.hits.forEach((hit, index) => {
                        // Create a more descriptive address label
                        const addressLabel = formatAddressLabel(hit);
                        
                        // Add distance info if available
                        let distanceInfo = '';
                        if (hit._distanceToUser !== undefined) {
                            const distanceKm = (hit._distanceToUser / 1000).toFixed(1);
                            distanceInfo = ` <span class="distance-info">(${distanceKm} km away)</span>`;
                        }
                        
                        customContent += `<button class="address-option" data-index="${index}" 
                                         data-lat="${hit.point.lat}" data-lng="${hit.point.lng}">
                                         ${addressLabel}${distanceInfo}</button>`;
                    });
                    customContent += '</div>';
                    
                    // Show modal with options
                    import('./modal.js').then(module => {
                        module.showModal({
                            text: `Multiple locations found for ${type} address. Please select one:`,
                            customContent: customContent,
                            customHandler: (modal) => {
                                // Add click handlers for address options
                                const buttons = modal.querySelectorAll('.address-option');
                                buttons.forEach(btn => {
                                    btn.addEventListener('click', () => {
                                        const selectedLat = parseFloat(btn.dataset.lat);
                                        const selectedLng = parseFloat(btn.dataset.lng);
                                        
                                        // Close the modal
                                        modal.classList.remove('show');
                                        modal.style.display = 'none';
                                        
                                        // Return the selected coordinates
                                        console.log(`✅ Geocoding complete for ${type}:`, { lat: selectedLat, lng: selectedLng });
                                        resolve({ lat: selectedLat, lng: selectedLng });
                                    });
                                });
                            }
                        });
                    });
                });
            }
            
            // For single result, return immediately
            const point = {
                lat: data.hits[0].point.lat,
                lng: data.hits[0].point.lng
            };
            console.log(`✅ Geocoding complete for ${type}:`, point);
            return point;
        });
}

/**
 * Sorts geocoding hits based on relevance for cycling routes
 * @param {Array} hits - Array of geocoding hits to sort
 * @param {string} type - Type of address ('start' or 'end')
 * @param {Object} appState - Application state
 */
function sortHitsForCycling(hits, type, appState) {
    // Get current user location if available
    const userCoords = appState.getUserCoords();
    
    // Get start marker location if this is for end address
    const startMarker = type === 'end' ? appState.getStartMarker() : null;
    
    // Calculate distances and assign scores
    hits.forEach(hit => {
        // Base score from API (normalized)
        let score = hit.score || 0;
        
        // Completeness factor (0-1)
        const completeness = calculateAddressCompleteness(hit);
        score += completeness * 0.5; // Address completeness matters, but less than proximity
        
        // Distance to user's location if available
        if (userCoords) {
            const userLoc = L.latLng(userCoords[0], userCoords[1]);
            const hitLoc = L.latLng(hit.point.lat, hit.point.lng);
            const distanceToUser = userLoc.distanceTo(hitLoc); // in meters
            
            // Store distance for display
            hit._distanceToUser = distanceToUser;
            
            // Logarithmic distance factor (closer = higher score)
            // Max range for relevance: ~100km (beyond that distance is less significant)
            const distanceFactor = Math.max(0, 1 - Math.log10(distanceToUser/1000 + 1) / 2);
            
            // For start address, user proximity is most important
            if (type === 'start') {
                score += distanceFactor * 3; // Heavy weighting for user proximity
            } 
            // For end address, user proximity is still important but less so
            else {
                score += distanceFactor * 1.5;
            }
        }
        
        // For end address, proximity to start point is important if available
        if (type === 'end' && startMarker) {
            const startLoc = L.latLng(startMarker.getLatLng());
            const hitLoc = L.latLng(hit.point.lat, hit.point.lng);
            const distanceToStart = startLoc.distanceTo(hitLoc); // in meters
            
            // Store this distance too
            hit._distanceToStart = distanceToStart;
            
            // For cycling, reasonable end points aren't too far from start
            // ~30-50km is reasonable cycling distance
            const distanceFactor = Math.max(0, 1 - Math.log10(distanceToStart/1000 + 1) / 3);
            score += distanceFactor * 2;
        }
        
        // Store the final calculated score
        hit._calculatedScore = score;
    });
    
    // Sort by final calculated score (highest first)
    hits.sort((a, b) => b._calculatedScore - a._calculatedScore);
}

/**
 * Calculates how complete an address is (0-1 score)
 * @param {Object} hit - Address hit from API
 * @returns {number} Completeness score between 0 and 1
 */
function calculateAddressCompleteness(hit) {
    let fieldsPresent = 0;
    let totalFields = 5; // name, housenumber, city/town, postcode, country
    
    if (hit.name) fieldsPresent++;
    if (hit.housenumber) fieldsPresent++;
    if (hit.city || hit.town) fieldsPresent++;
    if (hit.postcode) fieldsPresent++;
    if (hit.country) fieldsPresent++;
    
    return fieldsPresent / totalFields;
}

/**
 * Formats an address hit into a descriptive label
 * @param {Object} hit - Address hit from the API
 * @returns {string} Formatted address label
 */
function formatAddressLabel(hit) {
    const parts = [];
    
    // Add the name (usually street name)
    if (hit.name) {
        parts.push(hit.name);
    }
    
    // Add the housenumber if available
    if (hit.housenumber) {
        // If parts already contains something (like a street name), append the house number
        if (parts.length > 0) {
            parts[0] += ' ' + hit.housenumber;
        } else {
            parts.push(hit.housenumber);
        }
    }
    
    // Add city/town
    if (hit.city) {
        parts.push(hit.city);
    } else if (hit.town) {
        parts.push(hit.town);
    }
    
    // Add postcode
    if (hit.postcode) {
        parts.push(hit.postcode);
    }
    
    // Add country
    if (hit.country) {
        parts.push(hit.country);
    }
    
    // Join all parts with commas
    return parts.join(', ');
}

/**
 * Reverse geocodes coordinates to an address
 * @param {Object} latlng - Coordinates to reverse geocode
 * @param {Function} callback - Callback to handle the address
 * @param {boolean} isStartLocation - Whether this is a start location
 * @returns {Promise} Promise resolving to address
 */
export function reverseGeocode(latlng, callback, isStartLocation) {
    const url = `https://graphhopper.com/api/1/geocode?point=${latlng.lat},${latlng.lng}&reverse=true&key=${boiledEgg}`;

    return new Promise((resolve, reject) => {
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.hits && data.hits.length) {
                    const address = data.hits[0].name;
                    
                    if (isStartLocation) {
                        setStartAddress(address);
                    } else {
                        setEndAddress(address);
                    }
                    
                    // Execute callback after state is set
                    callback(address);
                    return address;
                } else {
                    const fallbackAddress = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
                    callback(fallbackAddress);
                    return fallbackAddress;
                }
            })
            .then(address => {
                resolve(address);
            })
            .catch(error => {
                console.error('Geocoding failed:', error);
                callback('Geocoding failed');
                reject(error);
            });
    });
}

/**
 * Geocodes an address and creates a marker
 * @param {Object} appState - Application state manager
 * @param {string} address - Address to geocode
 * @param {string} type - Marker type ('start' or 'end')
 */
export function geocodeAddressAndCreateMarker(appState, address, type) {
    return geocodeAddress(address, type).then(results => {
        if (results && results.lat && results.lng) {
            return import('./markerManager.js').then(markerManager => {
                return markerManager.setMarker(
                    appState, 
                    L.latLng(results.lat, results.lng), 
                    type
                );
            });
        }
        
        throw new Error('Address not found');
    });
}

/**
 * Handles location selection from search results
 * @param {Object} appState - Application state manager
 * @param {Array} options - Search result options
 * @param {number} index - Selected option index
 */
export function handleLocationSelection(appState, options, index) {
    return import('./markerManager.js').then(markerManager => {
        const selectedOption = options[index];
        markerManager.setMarker(
            appState, 
            L.latLng(selectedOption.lat, selectedOption.lng), 
            selectedOption.type
        );
    });
}