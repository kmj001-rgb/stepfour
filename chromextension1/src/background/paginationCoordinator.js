/**
 * Pagination Coordinator - Background Service Worker
 * Manages communication between UI and content scripts for pagination
 */

// State management
const paginationState = {
    activeTab: null,
    isPaginating: false,
    detection: null
};

/**
 * Handle messages from UI and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PAGINATION_DETECT') {
        handleDetect(sender.tab.id, sendResponse);
        return true; // Keep channel open for async response
    }
    
    if (message.action === 'PAGINATION_NAVIGATE_NEXT') {
        handleNavigateNext(sender.tab.id, sendResponse);
        return true;
    }
    
    if (message.action === 'PAGINATION_RESET') {
        handleReset(sender.tab.id, sendResponse);
        return true;
    }
    
    if (message.action === 'PAGINATION_GET_STATE') {
        handleGetState(sender.tab.id, sendResponse);
        return true;
    }

    // Handle detection results from content script
    if (message.action === 'PAGINATION_DETECTION_RESULT') {
        paginationState.detection = message.detection;
        paginationState.activeTab = sender.tab.id;
        
        // Broadcast to UI
        broadcastToUI({
            action: 'PAGINATION_STATE_UPDATE',
            state: {
                detection: message.detection,
                isPaginating: paginationState.isPaginating
            }
        });
        
        sendResponse({ success: true });
        return true;
    }
});

/**
 * Handle detect request
 */
async function handleDetect(tabId, sendResponse) {
    try {
        // Send detect command to content script
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_DETECT_INTERNAL'
        });
        
        if (response && response.success) {
            paginationState.detection = response.detection;
            paginationState.activeTab = tabId;
            
            sendResponse({
                success: true,
                detection: response.detection
            });
        } else {
            sendResponse({
                success: false,
                error: response?.error || 'Detection failed'
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
 * Handle navigate next request
 */
async function handleNavigateNext(tabId, sendResponse) {
    try {
        paginationState.isPaginating = true;
        
        // Send navigate command to content script
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_NAVIGATE_NEXT_INTERNAL'
        });
        
        if (response && response.success) {
            sendResponse({ success: true });
        } else {
            sendResponse({
                success: false,
                error: response?.error || 'Navigation failed'
            });
        }
    } catch (error) {
        console.error('Navigation error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    } finally {
        paginationState.isPaginating = false;
    }
}

/**
 * Handle reset request
 */
async function handleReset(tabId, sendResponse) {
    try {
        // Send reset command to content script
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_RESET_INTERNAL'
        });
        
        paginationState.detection = null;
        paginationState.isPaginating = false;
        
        sendResponse({ success: true });
    } catch (error) {
        console.error('Reset error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * Handle get state request
 */
async function handleGetState(tabId, sendResponse) {
    try {
        // Send get state command to content script
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'PAGINATION_GET_STATE_INTERNAL'
        });
        
        if (response && response.success) {
            sendResponse({
                success: true,
                state: response.state
            });
        } else {
            sendResponse({
                success: false,
                error: 'Failed to get state'
            });
        }
    } catch (error) {
        console.error('Get state error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * Broadcast message to all UI panels
 */
function broadcastToUI(message) {
    // This would typically send to side panel or popup
    // For now, we'll just log
    console.log('Broadcast to UI:', message);
}

console.log('Pagination Coordinator initialized');
