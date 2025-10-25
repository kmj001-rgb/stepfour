/**
 * Debug UI for Pagination Engine
 * Injects a control panel on every page for testing
 */

(function() {
    'use strict';

    // Create debug panel
    function createDebugPanel() {
        // Check if panel already exists
        if (document.getElementById('pagination-debug-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'pagination-debug-panel';
        panel.innerHTML = `
            <div id="pagination-debug-header">
                <h3>🔍 Pagination Debug</h3>
                <button id="pagination-debug-close">×</button>
            </div>
            <div id="pagination-debug-content">
                <div class="debug-section">
                    <button id="pagination-debug-detect" class="debug-btn">Detect Pagination</button>
                    <button id="pagination-debug-next" class="debug-btn">Navigate Next</button>
                    <button id="pagination-debug-reset" class="debug-btn">Reset</button>
                </div>
                <div class="debug-section">
                    <h4>Detection Result:</h4>
                    <pre id="pagination-debug-result">No detection yet</pre>
                </div>
                <div class="debug-section">
                    <h4>State:</h4>
                    <pre id="pagination-debug-state">No state yet</pre>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #pagination-debug-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 400px;
                background: white;
                border: 2px solid #333;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
            }
            #pagination-debug-header {
                background: #333;
                color: white;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 6px 6px 0 0;
            }
            #pagination-debug-header h3 {
                margin: 0;
                font-size: 16px;
            }
            #pagination-debug-close {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }
            #pagination-debug-content {
                padding: 16px;
                max-height: 600px;
                overflow-y: auto;
            }
            .debug-section {
                margin-bottom: 16px;
            }
            .debug-section h4 {
                margin: 0 0 8px 0;
                font-size: 13px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .debug-btn {
                background: #007bff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 8px;
                margin-bottom: 8px;
                font-size: 13px;
            }
            .debug-btn:hover {
                background: #0056b3;
            }
            .debug-btn:active {
                background: #004085;
            }
            #pagination-debug-result,
            #pagination-debug-state {
                background: #f5f5f5;
                padding: 12px;
                border-radius: 4px;
                margin: 0;
                font-size: 12px;
                max-height: 200px;
                overflow-y: auto;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Add event listeners
        setupEventListeners();
    }

    /**
     * Setup event listeners for debug panel
     */
    function setupEventListeners() {
        // Close button
        document.getElementById('pagination-debug-close').addEventListener('click', () => {
            document.getElementById('pagination-debug-panel').remove();
        });

        // Detect button
        document.getElementById('pagination-debug-detect').addEventListener('click', async () => {
            updateResult('Detecting...');
            
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'PAGINATION_DETECT'
                });

                if (response.success) {
                    updateResult(JSON.stringify(response.detection, null, 2));
                    updateState();
                } else {
                    updateResult('Error: ' + response.error);
                }
            } catch (error) {
                updateResult('Error: ' + error.message);
            }
        });

        // Next button
        document.getElementById('pagination-debug-next').addEventListener('click', async () => {
            updateResult('Navigating...');
            
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'PAGINATION_NAVIGATE_NEXT'
                });

                if (response.success) {
                    updateResult('Navigation successful!');
                } else {
                    updateResult('Error: ' + response.error);
                }
            } catch (error) {
                updateResult('Error: ' + error.message);
            }
        });

        // Reset button
        document.getElementById('pagination-debug-reset').addEventListener('click', async () => {
            updateResult('Resetting...');
            
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'PAGINATION_RESET'
                });

                if (response.success) {
                    updateResult('Reset successful!');
                    updateState('No state yet');
                } else {
                    updateResult('Error: ' + response.error);
                }
            } catch (error) {
                updateResult('Error: ' + error.message);
            }
        });
    }

    /**
     * Update result display
     */
    function updateResult(text) {
        const resultEl = document.getElementById('pagination-debug-result');
        if (resultEl) {
            resultEl.textContent = text;
        }
    }

    /**
     * Update state display
     */
    async function updateState(text) {
        const stateEl = document.getElementById('pagination-debug-state');
        if (!stateEl) return;

        if (text) {
            stateEl.textContent = text;
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'PAGINATION_GET_STATE'
            });

            if (response.success) {
                stateEl.textContent = JSON.stringify(response.state, null, 2);
            } else {
                stateEl.textContent = 'Error: ' + response.error;
            }
        } catch (error) {
            stateEl.textContent = 'Error: ' + error.message;
        }
    }

    // Initialize debug panel when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDebugPanel);
    } else {
        createDebugPanel();
    }

    console.log('🐛 Pagination Debug UI loaded');
})();
