/**
 * Pagination state manager
 * Tracks current pagination state and history
 */
class PaginationState {
    constructor() {
        this.currentDetection = null;
        this.currentPage = 1;
        this.history = [];
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Set detection result
     */
    setDetectionResult(detection) {
        this.currentDetection = detection;
        if (detection && detection.currentPage) {
            this.currentPage = detection.currentPage;
        }
    }

    /**
     * Get current detection
     */
    getCurrentDetection() {
        return this.currentDetection;
    }

    /**
     * Increment page number
     */
    incrementPage() {
        this.currentPage++;
        this.history.push({
            page: this.currentPage,
            url: window.location.href,
            timestamp: Date.now()
        });
    }

    /**
     * Get current page number
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Get pagination history
     */
    getHistory() {
        return this.history;
    }

    /**
     * Start pagination session
     */
    start() {
        this.startTime = Date.now();
    }

    /**
     * End pagination session
     */
    end() {
        this.endTime = Date.now();
    }

    /**
     * Get session duration in ms
     */
    getDuration() {
        if (!this.startTime) return 0;
        const end = this.endTime || Date.now();
        return end - this.startTime;
    }

    /**
     * Reset state
     */
    reset() {
        this.currentDetection = null;
        this.currentPage = 1;
        this.history = [];
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Get state summary
     */
    getSummary() {
        return {
            currentPage: this.currentPage,
            totalPages: this.history.length,
            duration: this.getDuration(),
            detection: this.currentDetection ? {
                type: this.currentDetection.type,
                confidence: this.currentDetection.confidence
            } : null
        };
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.PaginationState = PaginationState;
}
