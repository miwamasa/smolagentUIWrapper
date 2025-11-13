/**
 * Main application - integrates all modules
 */

class App {
    constructor() {
        this.chatManager = null;
        this.mapViewer = null;
        this.imageViewer = null;
        this.debugViewer = null;

        this.init();
    }

    init() {
        console.log('Initializing Smolagent UI...');

        // Initialize map viewer
        this.mapViewer = new MapViewer();
        console.log('Map viewer initialized');

        // Initialize image viewer
        this.imageViewer = new ImageViewer();
        console.log('Image viewer initialized');

        // Initialize debug viewer
        this.debugViewer = new DebugViewer();
        console.log('Debug viewer initialized');

        // Initialize chat manager (WebSocket connection)
        this.chatManager = new ChatManager();
        console.log('Chat manager initialized');

        // Register message handler to route messages to appropriate viewers
        this.chatManager.registerMessageHandler((type, data) => {
            this.handleMessage(type, data);
        });

        console.log('Smolagent UI ready');
    }

    /**
     * Handle messages and route to appropriate viewer
     * @param {string} type - Message type (image, map, etc.)
     * @param {Object} data - Message data
     */
    handleMessage(type, data) {
        console.log('Handling message:', type, data);

        // Route to appropriate viewer
        switch (type) {
            case 'map_definition':
                // Load map definition (floors, coordinate systems, bitmaps)
                if (data.content) {
                    this.mapViewer.loadMapDefinition(data.content);
                }
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'debug':
                // Send debug information to debug viewer
                this.debugViewer.addOutput(data.content, 'Parser Output');
                break;

            case 'code':
                // Code block (handled by chat manager, log in debug)
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'image':
                this.imageViewer.addImage(data);
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'map':
                // New multi-floor map display command
                if (data.content) {
                    this.mapViewer.handleMapCommand(data.content);
                }
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'highlight_room':
                // Highlight specific rooms on the floor plan
                if (data.content && data.content.rooms) {
                    this.mapViewer.highlightRooms(data.content.rooms);
                }
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'arrow':
                // Draw arrow on the floor plan
                if (data.content && data.content.room && data.content.direction) {
                    this.mapViewer.addArrow(data.content.room, data.content.direction);
                }
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'clear_arrows':
                // Clear all arrows from the floor plan
                this.mapViewer.clearArrows();
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'clear_map':
                // Clear all highlights and overlays from the map
                this.mapViewer.clearMap();
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            case 'unified_response':
                // Phase 2.0 unified response format
                this.handleUnifiedResponse(data.content);
                // Also send to debug viewer
                this.debugViewer.addOutput(data, `Type: ${type} (Phase 2.0)`);
                break;

            case 'text':
            case 'user_message':
            case 'error':
                // These are handled by chat manager, also log in debug
                this.debugViewer.addOutput(data, `Type: ${type}`);
                break;

            default:
                console.warn('Unhandled message type:', type);
                this.debugViewer.addOutput(data, `Type: ${type} (unhandled)`);
        }
    }

    /**
     * Handle Phase 2.0 unified response
     * @param {Array} unifiedResponseArray - Array containing single unified response object
     */
    handleUnifiedResponse(unifiedResponseArray) {
        if (!Array.isArray(unifiedResponseArray) || unifiedResponseArray.length === 0) {
            console.warn('Invalid unified response format');
            return;
        }

        const response = unifiedResponseArray[0];  // Get first element per Phase 2.0 spec
        console.log('Processing Phase 2.0 unified response:', response);

        // Handle message (required field) - display in chat
        if (response.message) {
            // The message is already displayed by chat.js as 'text' type
            // No additional action needed here
        }

        // Handle sensor data
        if (response.sensor) {
            console.log('Sensor data received:', response.sensor.title);
            // TODO: Add sensor data visualization when sensor viewer is implemented
        }

        // Handle BIM data
        if (response.bim) {
            console.log('BIM element ID:', response.bim);
            // TODO: Highlight BIM element in 3D viewer when implemented
        }

        // Handle 2d_map data
        if (response['2d_map']) {
            const mapData = response['2d_map'];
            console.log('2D map data received for floor:', mapData.floor);

            // Handle item (equipment position)
            if (mapData.item) {
                console.log('Equipment item:', mapData.item.name, 'at', mapData.item.x, mapData.item.y);
                // TODO: Display equipment marker on 2D map
            }

            // Handle area (map display commands)
            if (mapData.area && mapData.area.type === 'map' && mapData.area.content) {
                this.mapViewer.handleMapCommand({
                    floorId: mapData.floor,
                    ...mapData.area.content
                });
            }
        }

        // Handle images
        if (response.images && Array.isArray(response.images)) {
            response.images.forEach(img => {
                this.imageViewer.addImage({
                    type: 'image',
                    content: img.data,  // base64 data
                    format: img.type,
                    path: img.title
                });
            });
        }

        // Handle report
        if (response.report) {
            console.log('Report received:', response.report.title);
            // TODO: Add report viewer/download functionality when implemented
            // For now, could display in chat or create download link
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}
