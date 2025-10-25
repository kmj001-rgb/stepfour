/**
 * Content Script - Pagination Engine Integration
 * Initializes and manages the pagination engine on web pages
 */

(function() {
    'use strict';

    // Global pagination engine instance
    let paginationEngine = null;

    /**
     * Initialize the pagination engine
     */
    function initializePaginationEngine() {
        try {
            // Create engine instance
            paginationEngine = new window.PaginationEngine({
                enableContentHashing: true,
                enableUrlValidation: true
            });

            // Initialize with dependencies
            paginationEngine.initialize({
                QueryStringStrategy: window.QueryStringStrategy,
                PathBasedStrategy: window.PathBasedStrategy,
                NextButtonStrategy: window.NextButtonStrategy,
                LoadMoreStrategy: window.LoadMoreStrategy,
                ContentHashValidator: window.ContentHashValidator,
                UrlValidator: window.UrlValidator,
                ClickNavigator: window.ClickNavigator,
                UrlNavigator: window.UrlNavigator,
                PaginationState: window.PaginationState
            });

            console.log('✅ Pagination engine initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize pagination engine:', error);
            return false;
        }
    }

    /**
     * Listen for messages from background script
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Initialize engine if not already done
        if (!paginationEngine) {
            const initialized = initializePaginationEngine();
            if (!initialized) {
                sendResponse({
                    success: false,
                    error: 'Failed to initialize pagination engine'
                });
                return;
            }
        }

        // Handle detect command
        if (message.action === 'PAGINATION_DETECT_INTERNAL') {
            handleDetect(sendResponse);
            return true; // Keep channel open for async response
        }

        // Handle navigate next command
        if (message.action === 'PAGINATION_NAVIGATE_NEXT_INTERNAL') {
            handleNavigateNext(sendResponse);
            return true;
        }

        // Handle reset command
        if (message.action === 'PAGINATION_RESET_INTERNAL') {
            handleReset(sendResponse);
            return true;
        }

        // Handle get state command
        if (message.action === 'PAGINATION_GET_STATE_INTERNAL') {
            handleGetState(sendResponse);
            return true;
        }
    });

    /**
     * Handle detect command
     */
    async function handleDetect(sendResponse) {
        try {
            const detection = await paginationEngine.detect();

            if (detection) {
                // Send detection result to background
                chrome.runtime.sendMessage({
                    action: 'PAGINATION_DETECTION_RESULT',
                    detection: detection
                });

                sendResponse({
                    success: true,
                    detection: detection
                });
            } else {
                sendResponse({
                    success: false,
                    error: 'No pagination detected'
                });
            }
        } catch (error) {
            console.error('Detection error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Handle navigate next command
     */
    async function handleNavigateNext(sendResponse) {
        try {
            const success = await paginationEngine.navigateNext();

            sendResponse({
                success: success
            });
        } catch (error) {
            console.error('Navigation error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Handle reset command
     */
    async function handleReset(sendResponse) {
        try {
            paginationEngine.reset();

            sendResponse({
                success: true
            });
        } catch (error) {
            console.error('Reset error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Handle get state command
     */
    async function handleGetState(sendResponse) {
        try {
            const state = paginationEngine.getState();
            const summary = state.getSummary();

            sendResponse({
                success: true,
                state: summary
            });
        } catch (error) {
            console.error('Get state error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }

    console.log('🚀 Pagination content script loaded');
})();
