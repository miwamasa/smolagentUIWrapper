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
                this.mapViewer.updateMap(data);
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
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new App();
    });
} else {
    window.app = new App();
}
