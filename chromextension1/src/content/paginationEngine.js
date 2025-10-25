/**
 * Main pagination engine with multi-strategy detection
 * @module paginationEngine
 */

class PaginationEngine {
    constructor(options = {}) {
        // Will be initialized when strategies are loaded
        this.strategies = [];
        this.validators = {};
        this.navigators = {};
        this.state = null;
        this.siteProfile = null;
        this.options = options;
    }

    /**
     * Initialize the engine with strategies, validators, and navigators
     * This must be called after all dependencies are loaded
     */
    initialize(dependencies) {
        const {
            QueryStringStrategy,
            PathBasedStrategy,
            NextButtonStrategy,
            LoadMoreStrategy,
            ContentHashValidator,
            UrlValidator,
            ClickNavigator,
            UrlNavigator,
            PaginationState
        } = dependencies;

        this.strategies = [
            new QueryStringStrategy(),
            new PathBasedStrategy(),
            new NextButtonStrategy(),
            new LoadMoreStrategy()
        ];
        
        this.validators = {
            contentHash: new ContentHashValidator(),
            url: new UrlValidator()
        };
        
        this.navigators = {
            click: new ClickNavigator(),
            url: new UrlNavigator()
        };
        
        this.state = new PaginationState();
    }

    /**
     * Detect pagination using all strategies
     * Returns best match with confidence score
     */
    async detect() {
        const results = [];
        
        // Try each strategy
        for (const strategy of this.strategies) {
            try {
                const result = await strategy.detect();
                if (result) {
                    result.strategy = strategy.name;
                    result.confidence = result.confidence || strategy.confidence || 0.5;
                    results.push(result);
                }
            } catch (error) {
                console.warn(`Strategy ${strategy.name} failed:`, error);
            }
        }
        
        // Sort by confidence and return best
        results.sort((a, b) => b.confidence - a.confidence);
        
        if (results.length > 0) {
            this.state.setDetectionResult(results[0]);
            return results[0];
        }
        
        return null;
    }

    /**
     * Navigate to next page using detected strategy
     */
    async navigateNext() {
        const detection = this.state.getCurrentDetection();
        if (!detection) {
            throw new Error('No pagination detected');
        }
        
        // Validate before navigation
        const isValid = await this.validate(detection);
        if (!isValid) {
            throw new Error('Pagination validation failed (possible loop or end)');
        }
        
        // Get appropriate navigator
        const navigator = this.getNavigator(detection.navigationType);
        
        // Navigate
        const success = await navigator.navigate(detection.target);
        
        if (success) {
            this.state.incrementPage();
        }
        
        return success;
    }

    /**
     * Validate pagination state (detect loops, duplicates)
     */
    async validate(detection) {
        // Check URL visited before
        if (detection.nextUrl && this.validators.url.hasVisited(detection.nextUrl)) {
            console.warn('URL already visited - pagination loop detected');
            return false;
        }
        
        // Check content hash (if content-based validation enabled)
        if (this.options.enableContentHashing) {
            const contentHash = await this.validators.contentHash.hashCurrentPage();
            if (this.validators.contentHash.hasSeenHash(contentHash)) {
                console.warn('Content hash match - duplicate page detected');
                return false;
            }
        }
        
        return true;
    }

    getNavigator(type) {
        return this.navigators[type] || this.navigators.url;
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Reset the engine state
     */
    reset() {
        this.state.reset();
        this.validators.url.reset();
        this.validators.contentHash.reset();
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.PaginationEngine = PaginationEngine;
}
