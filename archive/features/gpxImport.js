// gpxImport.js - GPX file import feature
import { getState } from '../state.js';

/**
 * Show the GPX import dialog
 * @param {Object} appState - Application state manager
 */
export async function showGPXImportDialog(appState) {
    const modal = await import('../modal.js');
    
    const dialogContent = `
        <div class="gpx-dialog">
            <h2>Import GPX File</h2>
            <div class="gpx-input">
                <input type="file" id="gpxFileInput" accept=".gpx" />
                <p class="help-text">Select a GPX file to import</p>
            </div>
        </div>
    `;
    
    modal.showModal({
        text: dialogContent,
        showClose: true
    });
    
    // Set up file input listener
    document.getElementById('gpxFileInput').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            handleGPXFile(appState, file);
        }
    });
}

/**
 * Handle the selected GPX file
 * @param {Object} appState - Application state manager
 * @param {File} file - The selected GPX file
 */
async function handleGPXFile(appState, file) {
    try {
        const content = await readFileContent(file);
        const points = parseGPXContent(content);
        
        if (!points || points.length < 2) {
            throw new Error('Invalid GPX file: No valid track points found');
        }
        
        // Create route from GPX points
        await createRouteFromGPXPoints(appState, points);
        
        const modal = await import('../modal.js');
        modal.showModal({
            text: 'GPX file imported successfully'
        });
    } catch (error) {
        console.error('Failed to import GPX file:', error);
        const modal = await import('../modal.js');
        modal.showModal({
            text: `Failed to import GPX file: ${error.message}`
        });
    }
}

/**
 * Read the content of a file
 * @param {File} file - The file to read
 * @returns {Promise<string>} The file content
 */
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Parse GPX content and extract track points
 * @param {string} content - The GPX file content
 * @returns {Array} Array of track points
 */
function parseGPXContent(content) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        throw new Error('Invalid GPX file format');
    }
    
    // Get all track points
    const trackPoints = [];
    const trkpts = xmlDoc.getElementsByTagName('trkpt');
    
    for (let i = 0; i < trkpts.length; i++) {
        const point = trkpts[i];
        const lat = parseFloat(point.getAttribute('lat'));
        const lon = parseFloat(point.getAttribute('lon'));
        
        if (!isNaN(lat) && !isNaN(lon)) {
            trackPoints.push({
                lat: lat,
                lng: lon,
                ele: parseFloat(point.getElementsByTagName('ele')[0]?.textContent) || 0
            });
        }
    }
    
    // If no track points found, try waypoints
    if (trackPoints.length === 0) {
        const wpts = xmlDoc.getElementsByTagName('wpt');
        for (let i = 0; i < wpts.length; i++) {
            const point = wpts[i];
            const lat = parseFloat(point.getAttribute('lat'));
            const lon = parseFloat(point.getAttribute('lon'));
            
            if (!isNaN(lat) && !isNaN(lon)) {
                trackPoints.push({
                    lat: lat,
                    lng: lon,
                    ele: parseFloat(point.getElementsByTagName('ele')[0]?.textContent) || 0
                });
            }
        }
    }
    
    return trackPoints;
}

/**
 * Create a route from GPX track points
 * @param {Object} appState - Application state manager
 * @param {Array} points - Array of track points
 */
async function createRouteFromGPXPoints(appState, points) {
    // Clear existing route
    const routeManager = await import('../routeManager.js');
    await routeManager.clearRoute(appState, true);
    
    // Create start marker
    const markerManager = await import('../markerManager.js');
    await markerManager.setMarker(
        appState,
        L.latLng(points[0].lat, points[0].lng),
        'start'
    );
    
    // Add intermediate points as waypoints
    const waypointManager = await import('../waypointManager.js');
    for (let i = 1; i < points.length - 1; i++) {
        await waypointManager.addWaypointAndUpdateRoute(
            appState,
            L.latLng(points[i].lat, points[i].lng)
        );
    }
    
    // Create end marker
    await markerManager.setMarker(
        appState,
        L.latLng(points[points.length - 1].lat, points[points.length - 1].lng),
        'end'
    );
    
    // Fit map to the route
    const viewportManager = await import('../viewportManager.js');
    viewportManager.fitMapToRouteExplicit(appState);
} 