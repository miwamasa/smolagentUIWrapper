/**
 * Debug Viewer module - displays parser output for debugging
 */

class DebugViewer {
    constructor() {
        this.output = document.getElementById('debug-output');
        this.clearButton = document.getElementById('clear-debug-button');
        this.togglePrettyButton = document.getElementById('toggle-pretty-button');

        this.prettyPrint = true;
        this.outputHistory = [];

        this.init();
    }

    init() {
        // Set up event listeners
        this.clearButton.addEventListener('click', () => this.clear());
        this.togglePrettyButton.addEventListener('click', () => this.toggleFormat());

        console.log('Debug viewer initialized');
    }

    /**
     * Add debug output
     * @param {Object} data - Data to display
     * @param {string} label - Optional label for the output
     */
    addOutput(data, label = null) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = {
            timestamp,
            label,
            data
        };

        this.outputHistory.push(entry);

        // Display the output
        this.render();

        // Auto-scroll to bottom
        this.output.scrollTop = this.output.scrollHeight;
    }

    /**
     * Render all output history
     */
    render() {
        if (this.outputHistory.length === 0) {
            this.output.textContent = '';
            return;
        }

        let content = '';

        this.outputHistory.forEach((entry, index) => {
            const separator = index > 0 ? '\n' + '='.repeat(80) + '\n' : '';
            const header = `[${entry.timestamp}]${entry.label ? ' ' + entry.label : ''}\n`;

            let dataStr;
            if (this.prettyPrint) {
                dataStr = this.formatJSON(entry.data);
            } else {
                dataStr = JSON.stringify(entry.data);
            }

            content += separator + header + dataStr + '\n';
        });

        this.output.textContent = content;
    }

    /**
     * Format JSON with syntax highlighting
     * @param {Object} data - Data to format
     * @returns {string} Formatted JSON string
     */
    formatJSON(data) {
        try {
            return JSON.stringify(data, null, 2);
        } catch (error) {
            return `Error formatting JSON: ${error.message}\n${String(data)}`;
        }
    }

    /**
     * Toggle between pretty print and compact format
     */
    toggleFormat() {
        this.prettyPrint = !this.prettyPrint;
        this.render();

        // Update button text
        const buttonText = this.prettyPrint ? 'Toggle Format' : 'Toggle Format';
        this.togglePrettyButton.textContent = buttonText;

        console.log('Debug format:', this.prettyPrint ? 'Pretty' : 'Compact');
    }

    /**
     * Clear all debug output
     */
    clear() {
        this.outputHistory = [];
        this.output.textContent = '';
        console.log('Debug output cleared');
    }

    /**
     * Get number of entries
     */
    getEntryCount() {
        return this.outputHistory.length;
    }

    /**
     * Export debug output as JSON file
     */
    exportJSON() {
        const dataStr = JSON.stringify(this.outputHistory, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `debug-output-${Date.now()}.json`;
        link.click();

        URL.revokeObjectURL(url);
        console.log('Debug output exported');
    }
}

// Export for use in app.js
window.DebugViewer = DebugViewer;
