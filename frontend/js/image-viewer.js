/**
 * Image Viewer module - displays images from agent output
 */

class ImageViewer {
    constructor() {
        this.container = document.getElementById('image-container');
        this.images = [];

        this.init();
    }

    init() {
        // Check if placeholder exists
        this.placeholder = this.container.querySelector('.placeholder');
    }

    /**
     * Add an image to the viewer
     * @param {Object} data - Image data object
     */
    addImage(data) {
        // Remove placeholder if it exists
        if (this.placeholder) {
            this.placeholder.remove();
            this.placeholder = null;
        }

        const { content, format, path } = data;

        // Create image wrapper
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'image-wrapper';
        imageWrapper.style.marginBottom = '15px';

        // Create image element
        const img = document.createElement('img');

        // Set image source
        if (content) {
            // Base64 encoded image
            img.src = `data:image/${format || 'png'};base64,${content}`;
        } else if (path) {
            // Image path
            img.src = path;
        }

        img.alt = 'Agent output image';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        img.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';

        // Add loading state
        img.addEventListener('load', () => {
            img.style.opacity = '1';
        });

        img.addEventListener('error', () => {
            imageWrapper.innerHTML = '<p style="color: #dc3545;">Failed to load image</p>';
        });

        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s';

        // Create caption
        const caption = document.createElement('div');
        caption.style.marginTop = '5px';
        caption.style.fontSize = '12px';
        caption.style.color = '#666';

        if (path) {
            caption.textContent = `Image: ${path}`;
        } else {
            const timestamp = new Date().toLocaleTimeString();
            caption.textContent = `Generated at ${timestamp}`;
        }

        // Assemble wrapper
        imageWrapper.appendChild(img);
        imageWrapper.appendChild(caption);

        // Add to container
        this.container.appendChild(imageWrapper);

        // Store reference
        this.images.push({
            element: imageWrapper,
            data: data
        });

        // Scroll to show new image
        this.container.scrollTop = this.container.scrollHeight;

        // Add click to enlarge functionality
        img.addEventListener('click', () => this.showFullscreen(img.src));
    }

    /**
     * Show image in fullscreen
     * @param {string} src - Image source
     */
    showFullscreen(src) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.cursor = 'pointer';

        // Create fullscreen image
        const img = document.createElement('img');
        img.src = src;
        img.style.maxWidth = '90%';
        img.style.maxHeight = '90%';
        img.style.objectFit = 'contain';

        overlay.appendChild(img);

        // Close on click
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        document.body.appendChild(overlay);
    }

    /**
     * Clear all images
     */
    clear() {
        this.images.forEach(img => {
            img.element.remove();
        });

        this.images = [];

        // Restore placeholder
        if (!this.placeholder) {
            this.placeholder = document.createElement('p');
            this.placeholder.className = 'placeholder';
            this.placeholder.textContent = 'Images will appear here';
            this.container.appendChild(this.placeholder);
        }
    }

    /**
     * Get count of images
     */
    getImageCount() {
        return this.images.length;
    }
}

// Export for use in app.js
window.ImageViewer = ImageViewer;
