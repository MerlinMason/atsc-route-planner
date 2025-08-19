// googleDrive.js - Google Drive integration feature
import { getState } from '../state.js';

// Google Drive API configuration
const CONFIG = {
    API_KEY: null, // Will be set during initialization
    CLIENT_ID: null, // Will be set during initialization
    SCOPES: ['https://www.googleapis.com/auth/drive.file'],
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
};

let gapi = null;
let tokenClient = null;
let accessToken = null;

/**
 * Initialize Google Drive integration
 * @param {Object} appState - Application state manager
 */
export async function initializeGoogleDrive(appState) {
    if (!CONFIG.API_KEY || !CONFIG.CLIENT_ID) {
        const modal = await import('../modal.js');
        modal.showModal({
            text: 'Please configure your Google Drive API credentials in the settings.'
        });
        return;
    }

    try {
        // Load the Google API client library
        await loadGapiClient();
        
        // Initialize the tokenClient
        await initializeTokenClient();
        
        // Get authorization
        await getAuthorization();
        
        // Show the save/load dialog
        await showDriveDialog(appState);
    } catch (error) {
        console.error('Failed to initialize Google Drive:', error);
        const modal = await import('../modal.js');
        modal.showModal({
            text: 'Failed to initialize Google Drive. Please try again.'
        });
    }
}

/**
 * Load the Google API client library
 */
async function loadGapiClient() {
    if (!gapi) {
        // Load the gapi script
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
        
        // Initialize gapi.client
        await new Promise((resolve, reject) => {
            window.gapi.load('client', {
                callback: resolve,
                onerror: reject
            });
        });
        
        gapi = window.gapi;
    }
    
    await gapi.client.init({
        apiKey: CONFIG.API_KEY,
        discoveryDocs: CONFIG.DISCOVERY_DOCS
    });
}

/**
 * Initialize the Google Identity Services token client
 */
async function initializeTokenClient() {
    if (!tokenClient) {
        // Load the Google Identity Services script
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
        
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES.join(' '),
            callback: (response) => {
                if (response.error) {
                    throw new Error(response.error);
                }
                accessToken = response.access_token;
            }
        });
    }
}

/**
 * Get authorization from the user
 */
async function getAuthorization() {
    if (!accessToken) {
        await new Promise((resolve, reject) => {
            try {
                tokenClient.callback = (response) => {
                    if (response.error) {
                        reject(response);
                    }
                    accessToken = response.access_token;
                    resolve(response);
                };
                tokenClient.requestAccessToken();
            } catch (error) {
                reject(error);
            }
        });
    }
}

/**
 * Show the Google Drive save/load dialog
 * @param {Object} appState - Application state manager
 */
async function showDriveDialog(appState) {
    const modal = await import('../modal.js');
    
    const dialogContent = `
        <div class="drive-dialog">
            <h2>Google Drive</h2>
            <div class="drive-actions">
                <button id="saveRouteToDrive">Save Route</button>
                <button id="loadRouteFromDrive">Load Route</button>
            </div>
        </div>
    `;
    
    modal.showModal({
        text: dialogContent,
        showClose: true
    });
    
    // Set up event listeners
    document.getElementById('saveRouteToDrive').addEventListener('click', () => {
        saveRouteToDrive(appState);
    });
    
    document.getElementById('loadRouteFromDrive').addEventListener('click', () => {
        loadRouteFromDrive(appState);
    });
}

/**
 * Save the current route to Google Drive
 * @param {Object} appState - Application state manager
 */
async function saveRouteToDrive(appState) {
    try {
        const routeData = localStorage.getItem('routeData');
        const pointsData = localStorage.getItem('points');
        
        if (!routeData || !pointsData) {
            throw new Error('No route to save');
        }
        
        const fileMetadata = {
            name: 'route_' + new Date().toISOString().split('T')[0] + '.json',
            mimeType: 'application/json'
        };
        
        const fileContent = JSON.stringify({
            route: JSON.parse(routeData),
            points: JSON.parse(pointsData)
        });
        
        const file = await createFile(fileMetadata, fileContent);
        
        const modal = await import('../modal.js');
        modal.showModal({
            text: `Route saved to Google Drive as ${file.name}`
        });
    } catch (error) {
        console.error('Failed to save route to Drive:', error);
        const modal = await import('../modal.js');
        modal.showModal({
            text: 'Failed to save route to Google Drive. Please try again.'
        });
    }
}

/**
 * Load a route from Google Drive
 * @param {Object} appState - Application state manager
 */
async function loadRouteFromDrive(appState) {
    try {
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/json' and name contains 'route_'",
            fields: 'files(id, name, modifiedTime)'
        });
        
        const files = response.result.files;
        if (files.length === 0) {
            throw new Error('No routes found in Google Drive');
        }
        
        // Show file selection dialog
        const modal = await import('../modal.js');
        const fileList = files
            .map(file => `
                <div class="drive-file" data-id="${file.id}">
                    <span>${file.name}</span>
                    <span>${new Date(file.modifiedTime).toLocaleString()}</span>
                </div>
            `)
            .join('');
        
        modal.showModal({
            text: `
                <div class="drive-file-list">
                    <h3>Select a route to load</h3>
                    ${fileList}
                </div>
            `,
            showClose: true
        });
        
        // Handle file selection
        document.querySelectorAll('.drive-file').forEach(element => {
            element.addEventListener('click', async () => {
                const fileId = element.dataset.id;
                await loadRouteFile(appState, fileId);
                modal.hideModal();
            });
        });
    } catch (error) {
        console.error('Failed to load routes from Drive:', error);
        const modal = await import('../modal.js');
        modal.showModal({
            text: 'Failed to load routes from Google Drive. Please try again.'
        });
    }
}

/**
 * Create a file in Google Drive
 * @param {Object} metadata - File metadata
 * @param {string} content - File content
 * @returns {Promise<Object>} Created file metadata
 */
async function createFile(metadata, content) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";
    
    const contentType = metadata.mimeType || 'application/json';
    
    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        content +
        closeDelim;
    
    const request = gapi.client.request({
        'path': '/upload/drive/v3/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
            'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
    });
    
    const response = await request;
    return response.result;
}

/**
 * Load a specific route file from Google Drive
 * @param {Object} appState - Application state manager
 * @param {string} fileId - Google Drive file ID
 */
async function loadRouteFile(appState, fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        const fileData = response.result;
        if (!fileData.route || !fileData.points) {
            throw new Error('Invalid route file format');
        }
        
        // Save to localStorage
        localStorage.setItem('routeData', JSON.stringify(fileData.route));
        localStorage.setItem('points', JSON.stringify(fileData.points));
        
        // Reload the route
        const urlManager = await import('../urlManager.js');
        await urlManager.handleURLParameters(appState);
        
        const modal = await import('../modal.js');
        modal.showModal({
            text: 'Route loaded successfully'
        });
    } catch (error) {
        console.error('Failed to load route file:', error);
        const modal = await import('../modal.js');
        modal.showModal({
            text: 'Failed to load route file. Please try again.'
        });
    }
}

/**
 * Set the API credentials
 * @param {Object} credentials - API credentials
 */
export function setCredentials(credentials) {
    CONFIG.API_KEY = credentials.apiKey;
    CONFIG.CLIENT_ID = credentials.clientId;
} 