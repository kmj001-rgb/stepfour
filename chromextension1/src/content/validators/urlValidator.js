/**
 * URL validator to detect visited URLs and prevent loops
 */
class UrlValidator {
    constructor() {
        this.visitedUrls = new Set();
    }

    /**
     * Check if URL has been visited before
     */
    hasVisited(url) {
        const normalizedUrl = this.normalizeUrl(url);
        
        if (this.visitedUrls.has(normalizedUrl)) {
            return true;
        }
        
        this.visitedUrls.add(normalizedUrl);
        return false;
    }

    /**
     * Normalize URL for comparison
     * Removes trailing slashes, sorts query params, etc.
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // Remove trailing slash from pathname
            let pathname = urlObj.pathname;
            if (pathname.endsWith('/') && pathname.length > 1) {
                pathname = pathname.slice(0, -1);
            }
            
            // Sort query parameters for consistent comparison
            const params = Array.from(urlObj.searchParams.entries())
                .sort((a, b) => a[0].localeCompare(b[0]));
            
            const sortedParams = new URLSearchParams(params);
            
            return `${urlObj.origin}${pathname}${sortedParams.toString() ? '?' + sortedParams.toString() : ''}`;
        } catch (e) {
            // If URL parsing fails, return original
            return url;
        }
    }

    /**
     * Mark current URL as visited
     */
    markCurrentUrl() {
        this.hasVisited(window.location.href);
    }

    /**
     * Reset validator state
     */
    reset() {
        this.visitedUrls.clear();
    }

    /**
     * Get list of visited URLs
     */
    getVisitedUrls() {
        return Array.from(this.visitedUrls);
    }

    /**
     * Get count of visited URLs
     */
    getVisitedCount() {
        return this.visitedUrls.size;
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.UrlValidator = UrlValidator;
}
