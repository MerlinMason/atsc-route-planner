// apiUtils.js - Utilities for API interactions and keys

// API Keys (consolidated from separate files)
const scrambledEgg = 'YmViZjUzNmQtNDgyYy00Njc0LTlkMjQtYjg1NjhiYmQ5YTVl';
const boiledEgg = atob(scrambledEgg);

const pamKey = 'cGsuZXlKMUlqb2liMjlzWlhnaUxDSmhJam9pWTJ4MmFqZDJNMkZ2TUdzNGRUSnBjRGR1ZG5oc2VIUnRaU0o5LkxQQ1o3dTdlc3BVQTBMa0t0SkNhRWc=';
const mapKey = atob(pamKey);

export { boiledEgg, mapKey };

/**
 * Builds the API URL for route calculation
 * @param {Array} points - Array of LatLng points
 * @param {string} type - Response type ('json' or 'gpx')
 * @returns {Promise<string>} Promise that resolves to the API URL
 */
export function buildApiUrl(points, type = 'json') {
    const url = `https://graphhopper.com/api/1/route?point=${
        points.map(p => `${p.lat},${p.lng}`).join('&point=')
    }&vehicle=hike&points_encoded=false&elevation=true&key=${boiledEgg}&type=${type}`;
    
    return Promise.resolve(url);
}