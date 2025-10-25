/**
 * Content hash validator to detect duplicate pages
 * Uses SHA-256 hashing to identify when pagination loops or ends
 */
class ContentHashValidator {
    constructor() {
        this.seenHashes = new Set();
    }

    /**
     * Generate SHA-256 hash of current page content
     */
    async hashCurrentPage() {
        // Get main content (exclude header, footer, nav)
        const content = this.extractMainContent();
        return await this.hashContent(content);
    }

    /**
     * Extract main content from page
     */
    extractMainContent() {
        // Try to find main content container
        const mainSelectors = ['main', 'article', '#content', '.content', '#main', '.main'];
        
        for (const selector of mainSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }
        
        // Fallback to body content
        return document.body.textContent.trim();
    }

    /**
     * Generate SHA-256 hash of content
     */
    async hashContent(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        
        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
    }

    /**
     * Check if content has been seen before
     */
    hasSeenHash(hash) {
        if (this.seenHashes.has(hash)) {
            return true;
        }
        
        this.seenHashes.add(hash);
        return false;
    }

    /**
     * Reset validator state
     */
    reset() {
        this.seenHashes.clear();
    }

    /**
     * Get number of unique pages seen
     */
    getUniquePageCount() {
        return this.seenHashes.size;
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.ContentHashValidator = ContentHashValidator;
}
