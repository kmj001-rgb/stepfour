/**
 * Detects query string-based pagination (page=2, p=3, etc.)
 */
class QueryStringStrategy {
    constructor() {
        this.name = 'query-string';
        this.confidence = 0.8;
        
        this.paramPatterns = ['page', 'p', 'pg', 'pagenum', 'paged', 'pageNumber', 'offset', 'start'];
        this.containerSelectors = ['.pagination', '.pager', '.page-navigation', '.index-navigator', '.PageNavi', '.s-pagination-strip'];
    }

    async detect() {
        // Check current URL first
        const currentUrl = new URL(window.location.href);
        for (const param of this.paramPatterns) {
            if (currentUrl.searchParams.has(param)) {
                return this.buildResult(param, currentUrl);
            }
        }
        
        // Check pagination containers for links with query params
        for (const selector of this.containerSelectors) {
            const container = document.querySelector(selector);
            if (container) {
                const links = container.querySelectorAll('a[href]');
                for (const link of links) {
                    try {
                        const url = new URL(link.href, window.location.origin);
                        for (const param of this.paramPatterns) {
                            if (url.searchParams.has(param)) {
                                return this.buildResult(param, url, link);
                            }
                        }
                    } catch (e) {
                        // Invalid URL, skip
                    }
                }
            }
        }
        
        return null;
    }

    buildResult(param, url, element = null) {
        const currentPage = parseInt(url.searchParams.get(param) || '1');
        const nextPage = currentPage + 1;
        
        // Build next URL
        const nextUrl = new URL(url.href);
        nextUrl.searchParams.set(param, nextPage.toString());
        
        return {
            type: 'query-string',
            param: param,
            currentPage: currentPage,
            nextPage: nextPage,
            nextUrl: nextUrl.href,
            target: nextUrl.href,
            navigationType: 'url',
            confidence: element ? 0.9 : 0.7,
            element: element
        };
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.QueryStringStrategy = QueryStringStrategy;
}
