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

        // New map definition structure (multi-floor support)
        this.mapDefinition = null;  // Will store floors, bitmaps, coordinate systems
        this.currentFloorId = null;  // Currently displayed floor
        this.currentFloor = null;  // Current floor object from definition
        this.currentFloorImage = null;  // Current floor image
        this.bitmapCatalog = {};  // Loaded bitmap images by bitmapId
        this.displayRectangles = [];  // Rectangles to highlight from map command
        this.overlays = [];  // Current overlays (bitmaps + text)
        this.renderContext = null;  // Cached rendering context (offsets, dimensions)

        // Legacy: Floor plan background (for backward compatibility)
        this.floorPlanImage = null;
        this.floorPlanData = null;
        this.floorPlanLoaded = false;

        // Highlighted rooms
        this.highlightedRooms = [];

        // Arrows to display (legacy - will be replaced by overlays)
        this.arrows = [];

        // Arrow images (legacy - will be replaced by bitmap catalog)
        this.arrowImages = {
            up: null,
            down: null,
            left: null,
            right: null
        };

        this.init();
        // Legacy loading - will be replaced by map_definition message
        this.loadFloorPlan();
        this.loadArrowImages();
    }

    init() {
        // Set canvas size
        this.resizeCanvas();

        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());

        // Setup clear arrows button
        const clearButton = document.getElementById('clear-arrows-button');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearArrows();
            });
        }

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

    loadArrowImages() {
        console.log('MapViewer: Loading arrow images...');
        const directions = ['up', 'down', 'left', 'right'];
        let loadedCount = 0;

        directions.forEach(direction => {
            const img = new Image();
            img.onload = () => {
                console.log(`MapViewer: Arrow ${direction} loaded`);
                loadedCount++;
                if (loadedCount === directions.length) {
                    console.log('MapViewer: All arrow images loaded');
                    this.redraw();
                }
            };
            img.onerror = (error) => {
                console.error(`MapViewer: Failed to load arrow ${direction}:`, error);
            };
            img.src = `/backend/bitmaps/arrow_${direction}.bmp`;
            this.arrowImages[direction] = img;
        });
    }

    redraw() {
        // New multi-floor system takes priority
        if (this.currentFloorImage && this.currentFloorImage.complete && this.currentFloor) {
            this.drawFloorView();
        } else if (this.points.length > 0) {
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

    /**
     * Draw the new multi-floor view with overlays
     */
    drawFloorView() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;

        this.ctx.clearRect(0, 0, width, height);

        console.log('MapViewer: drawFloorView called for floor', this.currentFloorId);

        // Draw the floor image scaled to fit canvas
        const imgAspect = this.currentFloorImage.width / this.currentFloorImage.height;
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

        // Draw floor image
        this.ctx.drawImage(this.currentFloorImage, offsetX, offsetY, drawWidth, drawHeight);

        // Store rendering context for virtualToCanvas
        this.renderContext = {
            offsetX, offsetY, drawWidth, drawHeight,
            imgWidth: this.currentFloorImage.width,
            imgHeight: this.currentFloorImage.height
        };

        // Draw display rectangles with colors and opacity
        this.drawDisplayRectangles();

        // Draw overlays (bitmaps and text)
        this.drawOverlays();
    }

    /**
     * Draw rectangles specified in map commands with colors and opacity
     * Per spec: {name, color, strokeOpacity, fillOpacity, showName}
     */
    drawDisplayRectangles() {
        if (!this.displayRectangles || this.displayRectangles.length === 0) {
            return;
        }

        this.displayRectangles.forEach(displayRect => {
            this.drawRectangleHighlight(displayRect);
        });
    }

    /**
     * Draw a single rectangle highlight
     * @param {Object} rectDisplay - {name, color, strokeOpacity, fillOpacity, showName}
     */
    drawRectangleHighlight(rectDisplay) {
        // Find rectangle definition in floor data (search by 'name' per spec)
        const rectDef = this.currentFloor.rectangles.find(r => r.name === rectDisplay.name);
        if (!rectDef) {
            console.warn(`MapViewer: Rectangle ${rectDisplay.name} not found in floor definition`);
            return;
        }

        // Convert virtual coordinates to canvas
        const topLeft = this.virtualToCanvas(rectDef.topLeft.x, rectDef.topLeft.y);
        const bottomRight = this.virtualToCanvas(rectDef.bottomRight.x, rectDef.bottomRight.y);

        const rectWidth = bottomRight.canvasX - topLeft.canvasX;
        const rectHeight = bottomRight.canvasY - topLeft.canvasY;

        // Set color and opacity per spec
        const color = rectDisplay.color || '#FFD700'; // Default yellow
        const fillOpacity = rectDisplay.fillOpacity !== undefined ? rectDisplay.fillOpacity : 0.3;
        const strokeOpacity = rectDisplay.strokeOpacity !== undefined ? rectDisplay.strokeOpacity : 1.0;

        // Draw filled rectangle with fillOpacity
        if (fillOpacity > 0) {
            this.ctx.fillStyle = this.hexToRgba(color, fillOpacity);
            this.ctx.fillRect(topLeft.canvasX, topLeft.canvasY, rectWidth, rectHeight);
        }

        // Draw border with strokeOpacity
        if (strokeOpacity > 0) {
            this.ctx.strokeStyle = this.hexToRgba(color, strokeOpacity);
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(topLeft.canvasX, topLeft.canvasY, rectWidth, rectHeight);
        }

        // Draw name if requested
        if (rectDisplay.showName) {
            this.ctx.fillStyle = '#000000';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(rectDef.name, topLeft.canvasX + rectWidth / 2, topLeft.canvasY + rectHeight / 2);
        }
    }

    /**
     * Draw overlays (bitmaps and text) on the floor
     */
    drawOverlays() {
        if (!this.overlays || this.overlays.length === 0) {
            return;
        }

        this.overlays.forEach(overlay => {
            if (overlay.type === 'bitmap') {
                this.drawBitmapOverlay(overlay);
            } else if (overlay.type === 'text') {
                this.drawTextOverlay(overlay);
            }
        });
    }

    /**
     * Draw a bitmap overlay at specified position
     * Per spec: position can be {type: "rectangle", name} or {type: "coordinate", x, y}
     */
    drawBitmapOverlay(overlay) {
        const bitmap = this.bitmapCatalog[overlay.bitmapId];
        if (!bitmap || !bitmap.image || !bitmap.image.complete) {
            console.warn(`MapViewer: Bitmap ${overlay.bitmapId} not loaded`);
            return;
        }

        // Resolve position based on type
        const coords = this.resolveOverlayPosition(overlay.position, overlay.offset);
        if (!coords) return;

        // If position type is "rectangle" and has color, highlight the rectangle first
        if (overlay.position.type === 'rectangle' && overlay.position.color) {
            this.drawRectangleHighlight({
                name: overlay.position.name,
                color: overlay.position.color,
                strokeOpacity: overlay.position.strokeOpacity,
                fillOpacity: overlay.position.fillOpacity,
                showName: false
            });
        }

        // Default bitmap size (can be made configurable later)
        const bitmapSize = 30; // pixels

        // Draw bitmap centered at position
        this.ctx.drawImage(
            bitmap.image,
            coords.canvasX - bitmapSize / 2,
            coords.canvasY - bitmapSize / 2,
            bitmapSize,
            bitmapSize
        );
    }

    /**
     * Draw a text overlay at specified position
     * Per spec: position can be {type: "rectangle", name} or {type: "coordinate", x, y}
     */
    drawTextOverlay(overlay) {
        // Resolve position based on type
        const coords = this.resolveOverlayPosition(overlay.position, overlay.offset);
        if (!coords) return;

        // If position type is "rectangle" and has color, highlight the rectangle first
        if (overlay.position.type === 'rectangle' && overlay.position.color) {
            this.drawRectangleHighlight({
                name: overlay.position.name,
                color: overlay.position.color,
                strokeOpacity: overlay.position.strokeOpacity,
                fillOpacity: overlay.position.fillOpacity,
                showName: false
            });
        }

        // Draw background if specified
        if (overlay.backgroundColor) {
            const fontSize = overlay.fontSize || 16;
            const textWidth = this.ctx.measureText(overlay.text).width;
            const padding = 4;

            this.ctx.fillStyle = overlay.backgroundColor;
            this.ctx.fillRect(
                coords.canvasX - textWidth / 2 - padding,
                coords.canvasY - fontSize / 2 - padding,
                textWidth + padding * 2,
                fontSize + padding * 2
            );
        }

        // Set text style
        this.ctx.fillStyle = overlay.color || '#000000';
        this.ctx.font = `${overlay.fontSize || 16}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Draw text
        this.ctx.fillText(overlay.text, coords.canvasX, coords.canvasY);
    }

    /**
     * Resolve overlay position to canvas coordinates
     * @param {Object} position - {type: "rectangle"|"coordinate", ...}
     * @param {Object} offset - {x, y} offset in virtual coordinates
     * @returns {Object} {canvasX, canvasY} or null if not found
     */
    resolveOverlayPosition(position, offset = null) {
        let vx, vy;

        if (position.type === 'rectangle') {
            // Find rectangle center
            const rectDef = this.currentFloor.rectangles.find(r => r.name === position.name);
            if (!rectDef) {
                console.warn(`MapViewer: Rectangle ${position.name} not found in floor definition`);
                return null;
            }

            // Calculate center of rectangle
            vx = (rectDef.topLeft.x + rectDef.bottomRight.x) / 2;
            vy = (rectDef.topLeft.y + rectDef.bottomRight.y) / 2;
        } else if (position.type === 'coordinate') {
            // Direct coordinate specification
            vx = position.x;
            vy = position.y;
        } else {
            console.warn(`MapViewer: Unknown position type ${position.type}`);
            return null;
        }

        // Apply offset if specified
        if (offset) {
            vx += offset.x || 0;
            vy += offset.y || 0;
        }

        // Convert to canvas coordinates
        return this.virtualToCanvas(vx, vy);
    }

    /**
     * Convert hex color to rgba with opacity
     */
    hexToRgba(hex, opacity) {
        // Remove # if present
        hex = hex.replace('#', '');

        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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

        // Draw arrows on rooms
        this.drawArrows(relativeToCanvas);
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
     * Draw arrows on the floor plan
     * @param {Function} relativeToCanvas - Function to convert relative coordinates to canvas coordinates
     */
    drawArrows(relativeToCanvas) {
        if (!this.floorPlanData || !this.floorPlanData.rectangles) {
            return;
        }

        // Draw each arrow
        this.arrows.forEach(arrow => {
            const room = arrow.room;
            const direction = arrow.direction;

            // Find the room rectangle
            const rect = this.floorPlanData.rectangles.find(r => r.name === room);
            if (!rect) {
                console.warn(`MapViewer: Room ${room} not found in floor plan data`);
                return;
            }

            // Check if arrow image is loaded
            const arrowImage = this.arrowImages[direction];
            if (!arrowImage || !arrowImage.complete) {
                console.warn(`MapViewer: Arrow image ${direction} not loaded yet`);
                return;
            }

            // Calculate room center in canvas coordinates
            const topLeft = relativeToCanvas(rect.topLeft.x, rect.topLeft.y);
            const bottomRight = relativeToCanvas(rect.bottomRight.x, rect.bottomRight.y);
            const centerX = (topLeft.canvasX + bottomRight.canvasX) / 2;
            const centerY = (topLeft.canvasY + bottomRight.canvasY) / 2;

            // Calculate arrow size (40% of room size, min 30px, max 80px)
            const roomWidth = bottomRight.canvasX - topLeft.canvasX;
            const roomHeight = bottomRight.canvasY - topLeft.canvasY;
            const arrowSize = Math.min(Math.max(Math.min(roomWidth, roomHeight) * 0.4, 30), 80);

            // Draw arrow image centered in the room
            this.ctx.drawImage(
                arrowImage,
                centerX - arrowSize / 2,
                centerY - arrowSize / 2,
                arrowSize,
                arrowSize
            );

            console.log(`MapViewer: Drew ${direction} arrow in ${room} at (${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
        });
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
     * Add an arrow to display on the floor plan
     * @param {string} room - Room name where the arrow should be displayed
     * @param {string} direction - Direction of the arrow (up, down, left, right)
     */
    addArrow(room, direction) {
        console.log(`MapViewer: Adding ${direction} arrow to ${room}`);
        this.arrows.push({ room, direction });
        this.redraw();

        // Update info panel
        const arrowInfo = `Arrow: ${direction} in ${room}`;
        if (this.mapInfo.textContent) {
            this.mapInfo.textContent += ` | ${arrowInfo}`;
        } else {
            this.mapInfo.textContent = arrowInfo;
        }
    }

    /**
     * Clear all arrows from the floor plan
     */
    clearArrows() {
        console.log('MapViewer: Clearing all arrows');
        this.arrows = [];
        this.redraw();
    }

    /**
     * Clear all room highlights
     */
    clearHighlights() {
        console.log('MapViewer: Clearing all highlights');
        this.highlightedRooms = [];
        this.redraw();
    }

    /**
     * Clear all map highlights and overlays (new interface)
     */
    clearMap() {
        console.log('MapViewer: Clearing map display (rectangles and overlays)');
        this.displayRectangles = [];
        this.overlays = [];
        this.redraw();
    }

    /**
     * Load map definition (new interface)
     * @param {Object} definition - Map definition with floors and bitmaps
     */
    loadMapDefinition(definition) {
        console.log('MapViewer: Loading map definition:', definition);

        this.mapDefinition = definition;

        // Load bitmap catalog
        this.bitmapCatalog = {};
        if (definition.bitmaps) {
            definition.bitmaps.forEach(bitmap => {
                const img = new Image();
                img.onload = () => {
                    console.log(`MapViewer: Loaded bitmap ${bitmap.bitmapId}`);
                };
                img.onerror = (error) => {
                    console.error(`MapViewer: Failed to load bitmap ${bitmap.bitmapId}:`, error);
                };
                img.src = `/backend/bitmaps/${bitmap.bitmapFile}`;
                this.bitmapCatalog[bitmap.bitmapId] = {
                    image: img,
                    name: bitmap.bitmapName,
                    file: bitmap.bitmapFile
                };
            });
        }

        // Set first floor as current if available
        if (definition.floors && definition.floors.length > 0) {
            this.currentFloorId = definition.floors[0].floorId;
            console.log(`MapViewer: Set current floor to ${this.currentFloorId}`);

            // Load and display the first floor
            this.loadFloorFromDefinition(this.currentFloorId);
        }

        // Update info panel
        if (definition.floors && definition.floors.length > 0) {
            const floor = definition.floors[0];
            this.mapInfo.textContent = `Map loaded: ${floor.floorName} (${definition.floors.length} floor(s), ${floor.rectangles.length} room(s))`;
        }
    }

    /**
     * Load and display a specific floor
     * @param {string} floorId - Floor ID to display
     */
    loadFloorFromDefinition(floorId) {
        if (!this.mapDefinition || !this.mapDefinition.floors) {
            console.error('MapViewer: No map definition loaded');
            return;
        }

        const floor = this.mapDefinition.floors.find(f => f.floorId === floorId);
        if (!floor) {
            console.error(`MapViewer: Floor ${floorId} not found`);
            return;
        }

        console.log(`MapViewer: Loading floor ${floor.floorName}`);

        // Load floor image
        this.currentFloorImage = new Image();
        this.currentFloorImage.onload = () => {
            console.log(`MapViewer: Floor image loaded: ${floor.floorImage}`);
            this.currentFloor = floor;
            this.currentFloorId = floorId;
            this.redraw();
        };
        this.currentFloorImage.onerror = (error) => {
            console.error(`MapViewer: Failed to load floor image: ${floor.floorImage}`, error);
        };
        this.currentFloorImage.src = `/backend/data/${floor.floorImage}`;
    }

    /**
     * Convert virtual coordinates to canvas pixel coordinates
     * @param {number} vx - Virtual X coordinate
     * @param {number} vy - Virtual Y coordinate
     * @returns {Object} Canvas coordinates {canvasX, canvasY}
     */
    virtualToCanvas(vx, vy) {
        if (!this.currentFloor || !this.renderContext) {
            return { canvasX: 0, canvasY: 0 };
        }

        const coordSys = this.currentFloor.coordinateSystem;
        const { offsetX, offsetY, drawWidth, drawHeight, imgWidth, imgHeight } = this.renderContext;

        // Step 1: Virtual coords to image pixel coords
        const coordWidth = coordSys.bottomRight.x - coordSys.topLeft.x;
        const coordHeight = coordSys.bottomRight.y - coordSys.topLeft.y;
        const pixelWidth = coordSys.bottomRight.px - coordSys.topLeft.px;
        const pixelHeight = coordSys.bottomRight.py - coordSys.topLeft.py;

        const px = coordSys.topLeft.px + (vx - coordSys.topLeft.x) * pixelWidth / coordWidth;
        const py = coordSys.topLeft.py + (vy - coordSys.topLeft.y) * pixelHeight / coordHeight;

        // Step 2: Image pixel coords to canvas coords (using stored render context)
        const canvasX = offsetX + (px / imgWidth) * drawWidth;
        const canvasY = offsetY + (py / imgHeight) * drawHeight;

        return { canvasX, canvasY };
    }

    /**
     * Handle map display command (new interface)
     * @param {Object} command - Map command with floor, rectangles, overlays
     */
    handleMapCommand(command) {
        console.log('MapViewer: Handling map command:', command);

        if (!this.mapDefinition) {
            console.error('MapViewer: No map definition loaded, cannot handle map command');
            return;
        }

        const { floorId, rectangles, overlays } = command;

        // Switch floor if needed
        if (floorId && floorId !== this.currentFloorId) {
            this.loadFloorFromDefinition(floorId);
        }

        // Store rectangles and overlays for rendering
        this.displayRectangles = rectangles || [];
        this.overlays = overlays || [];

        // Redraw with new data
        this.redraw();

        // Update info panel
        if (this.currentFloor) {
            const info = `${this.currentFloor.floorName}: ${rectangles ? rectangles.length : 0} rectangles, ${overlays ? overlays.length : 0} overlays`;
            this.mapInfo.textContent = info;
        }
    }
}

// Export for use in app.js
window.MapViewer = MapViewer;
