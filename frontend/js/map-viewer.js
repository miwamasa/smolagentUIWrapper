/**
 * Map Viewer module - displays 2D map data on canvas
 */

class MapViewer {
    constructor() {
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mapInfo = document.getElementById('map-info');

        this.points = [];
        this.mapData = null;

        this.init();
    }

    init() {
        // Set canvas size
        this.resizeCanvas();

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());

        // Draw initial empty state
        this.drawEmptyState();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set canvas size with device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = (rect.height - 100) * dpr; // Account for header and info

        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = (rect.height - 100) + 'px';

        this.ctx.scale(dpr, dpr);

        // Redraw after resize
        if (this.points.length > 0) {
            this.drawPoints();
        } else {
            this.drawEmptyState();
        }
    }

    drawEmptyState() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;

        this.ctx.clearRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(width, height);

        // Draw placeholder text
        this.ctx.fillStyle = '#999';
        this.ctx.font = '14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('No map data available', width / 2, height / 2);
    }

    drawGrid(width, height) {
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;

        // Vertical lines
        const gridSize = 50;
        for (let x = 0; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Update map with new data
     * @param {Object} data - Map data object
     */
    updateMap(data) {
        this.mapData = data;

        if (data.content && data.content.points) {
            this.points = data.content.points;
            this.drawPoints();

            // Update info panel
            const description = data.content.description || 'Map data';
            const pointCount = this.points.length;
            this.mapInfo.textContent = `${description} (${pointCount} points)`;
        } else if (data.content) {
            // Handle other map data formats
            this.drawCustomData(data.content);
        }
    }

    drawPoints() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(width, height);

        if (this.points.length === 0) {
            this.drawEmptyState();
            return;
        }

        // Calculate bounds
        const lats = this.points.map(p => p.lat || p.y || 0);
        const lons = this.points.map(p => p.lon || p.x || 0);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        const latRange = maxLat - minLat || 1;
        const lonRange = maxLon - minLon || 1;

        // Add padding
        const padding = 40;

        // Transform function to convert lat/lon to canvas coordinates
        const toX = (lon) => {
            return padding + ((lon - minLon) / lonRange) * (width - 2 * padding);
        };

        const toY = (lat) => {
            // Invert Y axis (canvas Y increases downward)
            return padding + ((maxLat - lat) / latRange) * (height - 2 * padding);
        };

        // Draw points
        this.points.forEach((point, index) => {
            const x = toX(point.lon || point.x || 0);
            const y = toY(point.lat || point.y || 0);

            // Draw point
            this.ctx.fillStyle = '#007bff';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw point label
            this.ctx.fillStyle = '#333';
            this.ctx.font = '10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(index.toString(), x, y - 10);
        });

        // Draw lines connecting points if more than 1
        if (this.points.length > 1) {
            this.ctx.strokeStyle = '#007bff';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();

            this.points.forEach((point, index) => {
                const x = toX(point.lon || point.x || 0);
                const y = toY(point.lat || point.y || 0);

                if (index === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            });

            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    drawCustomData(data) {
        // Handle custom map data formats
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;

        this.ctx.clearRect(0, 0, width, height);
        this.drawGrid(width, height);

        // Display JSON data as text for now
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';

        const text = JSON.stringify(data, null, 2);
        const lines = text.split('\n');

        lines.slice(0, 10).forEach((line, index) => {
            this.ctx.fillText(line.substring(0, 50), 10, 20 + index * 15);
        });

        if (lines.length > 10) {
            this.ctx.fillText('...', 10, 20 + 10 * 15);
        }

        this.mapInfo.textContent = 'Custom map data received';
    }

    clear() {
        this.points = [];
        this.mapData = null;
        this.drawEmptyState();
        this.mapInfo.textContent = '';
    }
}

// Export for use in app.js
window.MapViewer = MapViewer;
