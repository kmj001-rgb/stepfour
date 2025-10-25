/**
 * Detects path-based pagination (/page/2, /2/, etc.)
 */
class PathBasedStrategy {
    constructor() {
        this.name = 'path-based';
        this.confidence = 0.7;
        
        // Patterns like /page/2, /p/2, /2/, etc.
        this.pathPatterns = [
            /\/page\/(\d+)/i,
            /\/p\/(\d+)/i,
            /\/(\d+)\/$/,
            /\/(\d+)$/
        ];
    }

    async detect() {
        const currentPath = window.location.pathname;
        
        // Try to match current URL
        for (const pattern of this.pathPatterns) {
            const match = currentPath.match(pattern);
            if (match) {
                return this.buildResultFromPath(currentPath, pattern, parseInt(match[1]));
            }
        }
        
        // Search for pagination links
        const links = document.querySelectorAll('a[href]');
        for (const link of links) {
            try {
                const url = new URL(link.href, window.location.origin);
                if (url.origin === window.location.origin) {
                    for (const pattern of this.pathPatterns) {
                        const match = url.pathname.match(pattern);
                        if (match) {
                            return this.buildResultFromLink(link, pattern, parseInt(match[1]));
                        }
                    }
                }
            } catch (e) {
                // Invalid URL, skip
            }
        }
        
        return null;
    }

    buildResultFromPath(path, pattern, currentPage) {
        const nextPage = currentPage + 1;
        const nextPath = path.replace(pattern, (match, page) => {
            return match.replace(page, nextPage.toString());
        });
        
        const nextUrl = new URL(nextPath, window.location.origin).href;
        
        return {
            type: 'path-based',
            pattern: pattern.source,
            currentPage: currentPage,
            nextPage: nextPage,
            nextUrl: nextUrl,
            target: nextUrl,
            navigationType: 'url',
            confidence: 0.8
        };
    }

    buildResultFromLink(element, pattern, pageNumber) {
        // Assume current page is one less
        const currentPage = pageNumber - 1;
        const nextPage = currentPage + 1;
        
        return {
            type: 'path-based',
            pattern: pattern.source,
            currentPage: currentPage,
            nextPage: nextPage,
            nextUrl: element.href,
            target: element.href,
            navigationType: 'url',
            confidence: 0.7,
            element: element
        };
    }
}

// Export for use in content script
if (typeof window !== 'undefined') {
    window.PathBasedStrategy = PathBasedStrategy;
}
