/**
 * Chat module - handles WebSocket communication and chat UI
 */

class ChatManager {
    constructor() {
        this.ws = null;
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesContainer = document.getElementById('messages');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');

        this.isConnected = false;
        this.messageHandlers = [];

        this.init();
    }

    init() {
        // Set up event listeners
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Connect to WebSocket
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.updateStatus('connecting', 'Connecting...');

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.updateStatus('connected', 'Connected');
                console.log('WebSocket connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('error', 'Connection error');
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateStatus('disconnected', 'Disconnected');
                console.log('WebSocket disconnected');

                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    this.connect();
                }, 3000);
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.updateStatus('error', 'Connection failed');
        }
    }

    updateStatus(status, text) {
        this.statusText.textContent = text;
        this.statusIndicator.className = `status-indicator ${status}`;
    }

    sendMessage() {
        const message = this.messageInput.value.trim();

        if (!message) {
            return;
        }

        if (!this.isConnected) {
            alert('Not connected to server. Please wait...');
            return;
        }

        // Send message to server
        try {
            this.ws.send(JSON.stringify({
                message: message
            }));

            // Clear input
            this.messageInput.value = '';

            // Don't add user message here - wait for server confirmation
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('error', `Failed to send message: ${error.message}`);
        }
    }

    handleMessage(data) {
        const { type, content } = data;

        switch (type) {
            case 'user_message':
                // Echo of user's message
                this.addMessage('user', content);
                break;

            case 'text':
                // Agent text response
                this.addMessage('agent', content);
                break;

            case 'code':
                // Code block from agent
                this.addCodeBlock(data);
                // Also notify handlers for debug viewer
                this.notifyHandlers(type, data);
                break;

            case 'error':
                // Error message
                this.addMessage('error', content);
                break;

            case 'image':
            case 'map':
            case 'highlight_room':
            case 'debug':
                // These are handled by other modules
                // Notify registered handlers
                this.notifyHandlers(type, data);
                break;

            default:
                console.warn('Unknown message type:', type);
        }
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;

        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * Add a code block to the chat
     * @param {Object} data - Code block data
     */
    addCodeBlock(data) {
        const { content, language = 'python', step } = data;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message code-message';

        // Add step label if available
        if (step) {
            const stepLabel = document.createElement('div');
            stepLabel.className = 'code-step-label';
            stepLabel.textContent = step;
            messageDiv.appendChild(stepLabel);
        }

        // Create code container
        const codeContainer = document.createElement('div');
        codeContainer.className = 'code-container';

        // Add language label
        const langLabel = document.createElement('div');
        langLabel.className = 'code-language';
        langLabel.textContent = language;
        codeContainer.appendChild(langLabel);

        // Add copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'code-copy-button';
        copyButton.textContent = 'Copy';
        copyButton.onclick = () => {
            navigator.clipboard.writeText(content).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        };
        codeContainer.appendChild(copyButton);

        // Add code content
        const codeElement = document.createElement('pre');
        const codeContent = document.createElement('code');
        codeContent.className = `language-${language}`;
        codeContent.textContent = content;
        codeElement.appendChild(codeContent);
        codeContainer.appendChild(codeElement);

        messageDiv.appendChild(codeContainer);
        this.messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * Register a handler for specific message types
     * @param {Function} handler - Function that receives (type, data)
     */
    registerMessageHandler(handler) {
        this.messageHandlers.push(handler);
    }

    notifyHandlers(type, data) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(type, data);
            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });
    }
}

// Export for use in app.js
window.ChatManager = ChatManager;
