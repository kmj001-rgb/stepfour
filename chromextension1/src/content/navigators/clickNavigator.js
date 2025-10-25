/**
 * Click-based navigator for pagination
 * Navigates by clicking buttons or links
 */
class ClickNavigator {
    constructor() {
        this.name = 'click';
    }

    /**
     * Navigate by clicking element
     * @param {Element|string} target - The element to click or selector
     */
    async navigate(target) {
        let element = target;
        
        // If target is a string, query for the element
        if (typeof target === 'string') {
            element = document.querySelector(target);
        }

        if (!element) {
            throw new Error('No element found for click navigation');
        }

        try {
            // Scroll element into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Wait a bit for scroll
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Click the element
            element.click();
            
            return true;
        } catch (error) {
            console.error('Click navigation failed:', error);
            return false;
        }
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.ClickNavigator = ClickNavigator;
}
