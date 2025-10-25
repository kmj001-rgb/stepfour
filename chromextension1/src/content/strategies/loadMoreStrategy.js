/**
 * Detects "Load More" button-based pagination
 */
class LoadMoreStrategy {
    constructor() {
        this.name = 'load-more';
        this.confidence = 0.6;
        
        this.loadMoreSelectors = [
            'button.load-more',
            'a.load-more',
            'button[class*="load-more"]',
            'a[class*="load-more"]',
            '.load-more-button',
            '#load-more'
        ];
        
        this.loadMoreTextPatterns = [
            /load\s*more/i,
            /show\s*more/i,
            /more/i,
            /ver\s*m[aá]s/i,  // Spanish
            /voir\s*plus/i,    // French
            /もっと見る/,       // Japanese
            /加载更多/i        // Chinese
        ];
    }

    async detect() {
        // Try common selectors first
        for (const selector of this.loadMoreSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isValidLoadMoreButton(element)) {
                return this.buildResult(element, 0.8);
            }
        }
        
        // Search by text content
        const buttons = document.querySelectorAll('button, a');
        for (const button of buttons) {
            const text = button.textContent.trim();
            for (const pattern of this.loadMoreTextPatterns) {
                if (pattern.test(text) && text.length < 30) { // Avoid false matches
                    if (this.isValidLoadMoreButton(button)) {
                        return this.buildResult(button, 0.6);
                    }
                }
            }
        }
        
        return null;
    }

    isValidLoadMoreButton(element) {
        // Check if element is visible
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        
        // Check if disabled
        if (element.disabled || element.classList.contains('disabled') || element.getAttribute('aria-disabled') === 'true') {
            return false;
        }
        
        return true;
    }

    buildResult(element, confidence) {
        return {
            type: 'load-more',
            element: element,
            target: element,
            nextUrl: null,
            navigationType: 'click',
            confidence: confidence,
            selector: this.generateSelector(element)
        };
    }

    generateSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        
        const classes = Array.from(element.classList).filter(c => !c.match(/^js-/));
        if (classes.length > 0) {
            return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
        }
        
        return element.tagName.toLowerCase();
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.LoadMoreStrategy = LoadMoreStrategy;
}
