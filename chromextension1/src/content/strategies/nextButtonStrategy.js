/**
 * Detects next button-based pagination
 */
class NextButtonStrategy {
    constructor() {
        this.name = 'next-button';
        this.confidence = 0.75;
        
        this.nextSelectors = [
            'a[rel="next"]',
            'a.next',
            'a.pagination-next',
            'a.next-page',
            'button.next',
            'button[aria-label*="next" i]',
            'a[aria-label*="next" i]',
            '.pagination a:last-child',
            '.pager a:last-child'
        ];
        
        this.nextTextPatterns = [
            /next/i,
            /→/,
            /»/,
            /›/,
            />/,
            /siguiente/i, // Spanish
            /suivant/i,   // French
            /次/,         // Japanese
            /下一页/i     // Chinese
        ];
    }

    async detect() {
        // Try common selectors first
        for (const selector of this.nextSelectors) {
            const element = document.querySelector(selector);
            if (element && this.isValidNextButton(element)) {
                return this.buildResult(element, 0.9);
            }
        }
        
        // Search by text content
        const links = document.querySelectorAll('a[href], button');
        for (const link of links) {
            const text = link.textContent.trim();
            for (const pattern of this.nextTextPatterns) {
                if (pattern.test(text) && text.length < 20) { // Avoid false matches
                    if (this.isValidNextButton(link)) {
                        return this.buildResult(link, 0.7);
                    }
                }
            }
        }
        
        return null;
    }

    isValidNextButton(element) {
        // Check if element is visible
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        
        // Check if disabled
        if (element.disabled || element.classList.contains('disabled') || element.getAttribute('aria-disabled') === 'true') {
            return false;
        }
        
        // For links, must have href
        if (element.tagName === 'A' && !element.href) {
            return false;
        }
        
        return true;
    }

    buildResult(element, confidence) {
        const isButton = element.tagName === 'BUTTON';
        
        return {
            type: 'next-button',
            element: element,
            target: isButton ? element : element.href,
            nextUrl: isButton ? null : element.href,
            navigationType: isButton ? 'click' : 'url',
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
    window.NextButtonStrategy = NextButtonStrategy;
}
