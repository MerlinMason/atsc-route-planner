// elevationChart.js - Unified elevation chart creation, updates and highlighting

// Highlight styling constants
const HIGHLIGHT_BACKGROUND = 'rgba(255, 255, 255, 0)';  // Transparent background
const HIGHLIGHT_BORDER = 'rgba(255, 107, 0, 1)';       // Orange with custom opacity
const HIGHLIGHT_BORDER_WIDTH = 3;

// Highlight region tracking
let highlightRegion = {
    startIdx: -1,
    endIdx: -1
};

/**
 * Initializes the elevation chart
 * @param {Object} appState - The application state manager
 */
export function initializeElevationChart(appState) {
    console.log('Initializing elevation chart...');
    
    // Initial empty chart
    updateElevationChart([]);
    
    // Subscribe to route changes
    appState.subscribe('route:calculated', (route) => {
        if (route && route.points && route.points.coordinates) {
            const elevations = route.points.coordinates.map(coord => coord[2]);
            updateElevationChart(elevations);
        }
    });
    
    // Subscribe to state reset
    appState.subscribe('state:reset', () => {
        updateElevationChart([]);
    });
}

/**
 * Updates the elevation chart with new data
 * @param {Array} elevations - Array of elevation values
 */
export function updateElevationChart(elevations = []) {
    // If empty, use a minimal dataset
    const chartData = elevations.length ? elevations : [0, 0];
    
    // Create labels for each point
    const labels = chartData.map((_, index) => `Point ${index + 1}`);
    
    // Get context and validate
    const ctx = document.getElementById('elevationChart')?.getContext('2d');
    if (!ctx) {
        console.warn('Elevation chart canvas not found');
        return;
    }
    
    // Calculate elevation gain and loss using the chartData
    const { totalGain, totalLoss } = calculateElevationGainLoss(chartData);
    
    // Update UI with gain/loss values
    updateElevationGainLossUI(totalGain, totalLoss);
    
    // Create or update the chart
    createOrUpdateElevationChart(ctx, labels, chartData);
    
    console.log(`Elevation chart updated with ${chartData.length} points`);
    console.log(`Total elevation gain: ${totalGain}m, loss: ${totalLoss}m`);
}

/**
 * Highlights a specific segment of the elevation chart
 * @param {Object} appState - Application state
 * @param {number} segmentIndex - Index of the segment to highlight
 * @returns {Promise} - Promise that resolves when highlighting is complete
 */
export function highlightElevationSegment(appState, segmentIndex) {
    return new Promise(resolve => {
        // First check if there's a chart instance
        const chart = window.elevationChartInstance;
        if (!chart) {
            console.warn('Elevation chart not initialized');
            resolve(false);
            return;
        }
        
        // Ensure we have segments to highlight
        const segments = appState.getRouteSegments();
        if (!segments?.length) {
            // Gracefully exit
            resolve(false);
            return;
        }
        
        // Check index validity
        if (segmentIndex < 0) {
            // Special case - just clear highlighting
            clearElevationHighlight().then(() => resolve(true));
            return;
        }
        
        if (segmentIndex >= segments.length) {
            console.warn(`Invalid segment index: ${segmentIndex}, max: ${segments.length-1}`);
            clearElevationHighlight().then(() => resolve(false));
            return;
        }
        
        // Get and validate the segment
        const segment = segments[segmentIndex];
        if (!segment?.interval || segment.interval.length !== 2) {
            console.warn('Segment has no valid interval data');
            clearElevationHighlight().then(() => resolve(false));
            return;
        }
        
        // Extract the segment interval for highlighting
        const [startIdx, endIdx] = segment.interval;
        
        // Use try/catch for added safety
        try {
            setHighlightRegion(startIdx, endIdx, 'Elevation chart updated with highlight overlay').then(() => resolve(true));
        } catch (error) {
            console.error('Error setting elevation highlight region:', error);
            clearElevationHighlight().then(() => resolve(false));
        }
    });
}

/**
 * Clears any highlighting from the elevation chart
 * @returns {Promise} - Promise that resolves when clearing is complete
 */
export function clearElevationHighlight() {
    return new Promise(resolve => {
        setHighlightRegion(-1, -1, 'Elevation chart highlight cleared').then(() => resolve(true));
    });
}

/**
 * Clears the elevation chart completely
 */
export function clearElevationChart() {
    clearElevationHighlight();
    updateElevationChart([]);
    console.log('Elevation chart cleared');
}

/**
 * Calculates total elevation gain and loss
 * @param {Array} elevations - Array of elevation values
 * @returns {Object} Object with totalGain and totalLoss properties
 */
export function calculateElevationGainLoss(elevations) {
    let totalGain = 0;
    let totalLoss = 0;

    // Calculate gain/loss by comparing adjacent elevation points
    elevations.reduce((prev, curr) => {
        const diff = curr - prev;
        if (diff > 0) totalGain += diff;
        else if (diff < 0) totalLoss -= diff;
        return curr;
    });

    return {
        totalGain: Math.round(totalGain),
        totalLoss: Math.round(totalLoss)
    };
}

/**
 * Updates the elevation gain/loss display in the UI
 * @param {number} totalGain - Total elevation gain in meters
 * @param {number} totalLoss - Total elevation loss in meters
 */
export function updateElevationGainLossUI(totalGain, totalLoss) {
    const elevationGainLossDiv = document.getElementById('elevationGainLoss');
    if (elevationGainLossDiv) {
        elevationGainLossDiv.innerHTML = `<i class="material-icons">keyboard_arrow_up</i> ${totalGain}<i class="material-icons">keyboard_arrow_down</i> ${totalLoss} m`;
    }
}

// ----- Private Helper Functions -----

/**
 * Creates or updates the elevation chart
 * @param {Object} ctx - Canvas 2D context
 * @param {Array} labels - Labels for each data point
 * @param {Array} elevations - Array of elevation values
 */
function createOrUpdateElevationChart(ctx, labels, elevations) {
    const chartData = prepareChartData(labels, elevations);
    
    if (window.elevationChartInstance) {
        // Update existing chart
        window.elevationChartInstance.data = chartData;
        window.elevationChartInstance.options.plugins.highlightOverlay = {
            startIdx: highlightRegion.startIdx,
            endIdx: highlightRegion.endIdx
        };
        window.elevationChartInstance.update();
    } else {
        // Create new chart
        const chartOptions = createChartOptions();
        const highlightPlugin = createHighlightPlugin();
        Chart.register(highlightPlugin);
        
        window.elevationChartInstance = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: chartOptions,
            plugins: [highlightPlugin]
        });
    }
}

/**
 * Prepares chart data in the format required by Chart.js
 * @param {Array} labels - Labels for data points
 * @param {Array} elevations - Elevation values
 * @returns {Object} Chart.js compatible data object
 */
function prepareChartData(labels, elevations) {
    return {
        labels: labels,
        datasets: [{
            label: '',
            data: elevations,
            backgroundColor: 'rgba(50, 144, 88, .5)',
            borderColor: 'rgb(50, 144, 88)',
            borderWidth: 3,
            pointBackgroundColor: 'rgb(75, 192, 192)',
            pointBorderColor: '#fff',
            pointRadius: 0,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4
        }]
    };
}

/**
 * Creates chart options for the elevation chart
 * @returns {Object} Chart.js configuration options
 */
function createChartOptions() {
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index',
            events: [] // Disable hover interactions
        },
        animation: {
            duration: 300,
            easing: 'easeOutQuad'
        },
        elements: {
            line: {
                tension: 0.4,
                borderWidth: 3
            },
            point: {
                radius: 0,
                hitRadius: 10,
                hoverRadius: 6
            }
        },
        layout: {
            padding: 5 // Simplified padding
        },
        devicePixelRatio: window.devicePixelRatio || 1
    };
    
    return {
        ...baseOptions,
        scales: {
            x: { display: false },
            y: {
                title: { display: false },
                ticks: { callback: value => `${value}m` }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false, // Disable tooltips completely
                callbacks: {
                    title: () => 'Elevation',
                    label: context => `${context.parsed.y}m`
                }
            },
            highlightOverlay: {
                startIdx: highlightRegion.startIdx,
                endIdx: highlightRegion.endIdx
            }
        },
        hover: { 
            mode: null // Disable hover mode completely
        }
    };
}

/**
 * Creates the highlight plugin for the chart
 * @returns {Object} Chart.js plugin
 */
function createHighlightPlugin() {
    return {
        id: 'highlightOverlay',
        afterDatasetsDraw: (chart) => {
            const ctx = chart.ctx;
            const startIdx = chart.options.plugins.highlightOverlay.startIdx;
            const endIdx = chart.options.plugins.highlightOverlay.endIdx;
            
            // If either index is -1, nothing to highlight
            if (startIdx < 0 || endIdx < 0) return;
            
            const meta = chart.getDatasetMeta(0);
            if (!meta.data || meta.data.length === 0 || startIdx >= meta.data.length || endIdx >= meta.data.length) {
                return;
            }
            
            // Get the positions of the points
            const startPoint = meta.data[startIdx];
            const endPoint = meta.data[endIdx];
            
            // If we have valid points, draw the vertical lines
            if (startPoint && endPoint) {
                const chartArea = chart.chartArea;
                
                // Draw vertical lines at start and end points
                ctx.save();
                ctx.strokeStyle = HIGHLIGHT_BORDER; 
                ctx.lineWidth = HIGHLIGHT_BORDER_WIDTH;
                
                // Start line
                ctx.beginPath();
                ctx.moveTo(startPoint.x, chartArea.top);
                ctx.lineTo(startPoint.x, chartArea.bottom);
                ctx.stroke();
                
                // End line
                ctx.beginPath();
                ctx.moveTo(endPoint.x, chartArea.top);
                ctx.lineTo(endPoint.x, chartArea.bottom);
                ctx.stroke();
                
                ctx.restore();
            }
        }
    };
}

/**
 * Updates the highlight region for the chart
 * @param {number} startIdx - Start index for highlight
 * @param {number} endIdx - End index for highlight
 * @param {string} logMessage - Message to log on success
 * @returns {Promise} - Promise that resolves to success status
 */
function setHighlightRegion(startIdx = -1, endIdx = -1, logMessage = '') {
    return new Promise(resolve => {
        const chart = window.elevationChartInstance;
        
        // Update internal tracking
        highlightRegion.startIdx = startIdx;
        highlightRegion.endIdx = endIdx;
        
        // Update chart if available
        if (chart?.options?.plugins?.highlightOverlay) {
            chart.options.plugins.highlightOverlay.startIdx = startIdx;
            chart.options.plugins.highlightOverlay.endIdx = endIdx;
            chart.update();
            if (logMessage) console.log(logMessage);
            resolve(true);
        } else {
            resolve(false);
        }
    });
}