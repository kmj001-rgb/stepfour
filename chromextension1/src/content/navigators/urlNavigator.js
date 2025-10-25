/**
 * URL-based navigator for pagination
 * Navigates by changing window.location
 */
class UrlNavigator {
    constructor() {
        this.name = 'url';
    }

    /**
     * Navigate to URL
     * @param {string} url - The URL to navigate to
     */
    async navigate(url) {
        if (!url) {
            throw new Error('No URL provided for navigation');
        }

        try {
            // Validate URL
            const urlObj = new URL(url, window.location.origin);
            
            // Navigate
            window.location.href = urlObj.href;
            
            return true;
        } catch (error) {
            console.error('URL navigation failed:', error);
            return false;
        }
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.UrlNavigator = UrlNavigator;
}
