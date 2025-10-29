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

        // Floor plan background
        this.floorPlanImage = null;
        this.floorPlanData = null;
        this.floorPlanLoaded = false;

        // Highlighted rooms
        this.highlightedRooms = [];

        this.init();
        this.loadFloorPlan();
    }

    init() {
        // Set canvas size
        this.resizeCanvas();

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());

        // Draw initial empty state
        this.drawEmptyState();
    }

    async loadFloorPlan() {
        console.log('MapViewer: Starting to load floor plan...');
        try {
            // Load floor plan image
            this.floorPlanImage = new Image();
            this.floorPlanImage.onload = () => {
                console.log('MapViewer: Floor plan image loaded successfully');
                this.floorPlanLoaded = true;
                this.redraw();
            };
            this.floorPlanImage.onerror = (error) => {
                console.error('MapViewer: Failed to load floor plan image:', error);
            };
            this.floorPlanImage.src = '/backend/data/OSM_floor.png';
            console.log('MapViewer: Floor plan image loading from:', this.floorPlanImage.src);

            // Load rectangle data
            console.log('MapViewer: Loading rectangle data...');
            const response = await fetch('/backend/data/OSM_floor-plan-rectangles.json');
            this.floorPlanData = await response.json();
            console.log('MapViewer: Rectangle data loaded:', this.floorPlanData);
            this.redraw();
        } catch (error) {
            console.error('MapViewer: Failed to load floor plan:', error);
        }
    }

    redraw() {
        if (this.points.length > 0) {
            this.drawPoints();
        } else {
            this.drawEmptyState();
        }
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

        console.log('MapViewer: drawEmptyState called. floorPlanLoaded=', this.floorPlanLoaded, 'floorPlanImage=', this.floorPlanImage);

        // Draw floor plan background if loaded
        if (this.floorPlanLoaded && this.floorPlanImage) {
            console.log('MapViewer: Drawing floor plan background');
            this.drawFloorPlanBackground(width, height);
        } else {
            // Draw grid
            this.drawGrid(width, height);

            // Draw placeholder text
            this.ctx.fillStyle = '#999';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Loading floor plan...', width / 2, height / 2);
        }
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

    drawFloorPlanBackground(width, height) {
        console.log('MapViewer: drawFloorPlanBackground called. Image dimensions:', this.floorPlanImage.width, 'x', this.floorPlanImage.height);

        // Draw the floor plan image scaled to fit the canvas
        const imgAspect = this.floorPlanImage.width / this.floorPlanImage.height;
        const canvasAspect = width / height;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgAspect > canvasAspect) {
            // Image is wider than canvas
            drawWidth = width;
            drawHeight = width / imgAspect;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
        } else {
            // Image is taller than canvas
            drawHeight = height;
            drawWidth = height * imgAspect;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
        }

        console.log('MapViewer: Drawing at', offsetX, offsetY, 'size', drawWidth, 'x', drawHeight);

        // Draw image
        this.ctx.drawImage(this.floorPlanImage, offsetX, offsetY, drawWidth, drawHeight);

        // Draw rectangles if data is loaded
        if (this.floorPlanData && this.floorPlanData.rectangles) {
            console.log('MapViewer: Drawing', this.floorPlanData.rectangles.length, 'rectangles');
            this.drawRectangles(offsetX, offsetY, drawWidth, drawHeight);
        }
    }

    drawRectangles(offsetX, offsetY, drawWidth, drawHeight) {
        const coordSys = this.floorPlanData.coordinateSystem;
        const rectangles = this.floorPlanData.rectangles;

        // Get original image dimensions
        const imgWidth = this.floorPlanImage.width;
        const imgHeight = this.floorPlanImage.height;

        // Calculate scale from relative coordinates to image pixels
        const coordWidth = coordSys.bottomRight.x - coordSys.topLeft.x;
        const coordHeight = coordSys.bottomRight.y - coordSys.topLeft.y;
        const pixelWidth = coordSys.bottomRight.px - coordSys.topLeft.px;
        const pixelHeight = coordSys.bottomRight.py - coordSys.topLeft.py;

        // Function to convert relative coordinate to image pixel coordinate
        const relativeToImagePixel = (relX, relY) => {
            const px = coordSys.topLeft.px + (relX - coordSys.topLeft.x) * pixelWidth / coordWidth;
            const py = coordSys.topLeft.py + (relY - coordSys.topLeft.y) * pixelHeight / coordHeight;
            return { px, py };
        };

        // Function to convert image pixel coordinate to canvas coordinate
        const imagePixelToCanvas = (px, py) => {
            const canvasX = offsetX + (px / imgWidth) * drawWidth;
            const canvasY = offsetY + (py / imgHeight) * drawHeight;
            return { canvasX, canvasY };
        };

        // Combined transformation: relative coordinate -> canvas coordinate
        const relativeToCanvas = (relX, relY) => {
            const { px, py } = relativeToImagePixel(relX, relY);
            return imagePixelToCanvas(px, py);
        };

        console.log('MapViewer: Drawing rectangles with coordinate system:', coordSys);
        console.log('MapViewer: Image size:', imgWidth, 'x', imgHeight);
        console.log('MapViewer: Canvas offset:', offsetX, offsetY, 'size:', drawWidth, 'x', drawHeight);

        // Draw each rectangle
        rectangles.forEach((rect) => {
            const topLeft = relativeToCanvas(rect.topLeft.x, rect.topLeft.y);
            const bottomRight = relativeToCanvas(rect.bottomRight.x, rect.bottomRight.y);
            const rectWidth = bottomRight.canvasX - topLeft.canvasX;
            const rectHeight = bottomRight.canvasY - topLeft.canvasY;

            console.log(`MapViewer: ${rect.name} - relative: (${rect.topLeft.x},${rect.topLeft.y}) to (${rect.bottomRight.x},${rect.bottomRight.y}), canvas: (${topLeft.canvasX.toFixed(1)},${topLeft.canvasY.toFixed(1)}) to (${bottomRight.canvasX.toFixed(1)},${bottomRight.canvasY.toFixed(1)})`);

            // Check if this room is highlighted
            const isHighlighted = this.highlightedRooms.includes(rect.name);

            // Draw rectangle border
            this.ctx.strokeStyle = isHighlighted ? '#0066ff' : '#ff0000';
            this.ctx.lineWidth = isHighlighted ? 3 : 2;
            this.ctx.strokeRect(topLeft.canvasX, topLeft.canvasY, rectWidth, rectHeight);

            // Draw semi-transparent fill
            this.ctx.fillStyle = isHighlighted ? 'rgba(0, 102, 255, 0.3)' : 'rgba(255, 0, 0, 0.1)';
            this.ctx.fillRect(topLeft.canvasX, topLeft.canvasY, rectWidth, rectHeight);

            // Draw room label
            this.ctx.fillStyle = isHighlighted ? '#0066ff' : '#ff0000';
            this.ctx.font = isHighlighted ? 'bold 14px sans-serif' : 'bold 12px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(rect.name, topLeft.canvasX + rectWidth / 2, topLeft.canvasY + rectHeight / 2);
        });
    }

    /**
     * Update map with new data (DISABLED - now using floor plan)
     * @param {Object} data - Map data object
     */
    updateMap(data) {
        console.log('MapViewer: updateMap called but coordinate plotting is disabled. Using floor plan only.');
        console.log('MapViewer: Received data:', data);
        // Old coordinate plotting functionality disabled
        // Now using floor plan with room highlights only
    }

    // Old coordinate plotting function - DISABLED
    // Now using floor plan with room highlights only
    drawPoints() {
        console.log('MapViewer: drawPoints called but coordinate plotting is disabled.');
        // Just redraw the floor plan
        this.redraw();
    }

    // Old custom data display function - DISABLED
    drawCustomData(data) {
        console.log('MapViewer: drawCustomData called but custom data display is disabled.');
        console.log('MapViewer: Data:', data);
        // Just redraw the floor plan
        this.redraw();
    }

    clear() {
        this.points = [];
        this.mapData = null;
        this.drawEmptyState();
        this.mapInfo.textContent = '';
    }

    /**
     * Highlight specific rooms on the floor plan
     * @param {Array<string>} roomNames - Array of room names to highlight
     */
    highlightRooms(roomNames) {
        console.log('MapViewer: Highlighting rooms:', roomNames);
        this.highlightedRooms = roomNames || [];
        this.redraw();

        // Update info panel
        if (roomNames && roomNames.length > 0) {
            this.mapInfo.textContent = `Highlighted: ${roomNames.join(', ')}`;
        }
    }

    /**
     * Clear all room highlights
     */
    clearHighlights() {
        console.log('MapViewer: Clearing all highlights');
        this.highlightedRooms = [];
        this.redraw();
    }
}

// Export for use in app.js
window.MapViewer = MapViewer;
