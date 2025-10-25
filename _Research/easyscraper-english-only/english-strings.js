/**
 * Easy Scraper Extension - English Text Strings
 * 
 * This file contains all the English text strings that were previously stored
 * in translation files. By consolidating them here, we eliminate the need for
 * internationalization and make the extension English-only.
 */

// ============================================================================
// UI TEXT STRINGS
// ============================================================================

export const UI_STRINGS = {
    // ============================================================================
    // COMMON ACTIONS
    // ============================================================================
    ACTIONS: {
        ADD_REVIEW: "Add a Review",
        ALLOW_PERMISSIONS: "Allow permissions",
        BACK: "Back",
        CANCEL: "Cancel",
        CONFIRM: "Confirm",
        CONTINUE: "Continue",
        COPY: "Copy",
        DELETE: "Delete",
        DISMISS: "Dismiss",
        EXPORT: "Export",
        IMPORT: "Import",
        LOAD: "Load",
        NEXT: "Next",
        PREVIOUS: "Previous",
        REFRESH: "Refresh",
        RESET: "Reset",
        SAVE: "Save",
        SEARCH: "Search",
        SELECT: "Select",
        SUBMIT: "Submit",
        UPLOAD: "Upload"
    },

    // ============================================================================
    // SCRAPING INTERFACE
    // ============================================================================
    SCRAPING: {
        AUTO_SCROLL: "Autoscroll",
        CHANGE_LIST: "Change List",
        CHANGE_SELECTION_LEVEL: "Change selection level",
        CLICK: "Click",
        CLICK_LOAD_MORE: "Click button to load more items on same page",
        CLICK_NEXT_PAGE: "Click link to navigate to next page",
        COLUMN: "Column",
        CSV_FILE: "CSV file",
        DEFAULT_SCRAPER_NAME: "Scrape details from {domain}",
        DURATION: "Duration",
        ESC: "Esc",
        EXPORT_CSV: "Export to CSV",
        EXPORT_JSON: "Export to JSON",
        EXPORT_EXCEL: "Export to Excel",
        FINISHED: "Finished",
        LOADING: "Loading...",
        NO_DATA: "No data found",
        PAUSE: "Pause",
        RESUME: "Resume",
        SCRAPE: "Scrape",
        SCRAPING: "Scraping...",
        SELECT_ELEMENTS: "Select elements to scrape",
        START_SCRAPING: "Start Scraping",
        STOP: "Stop",
        TOTAL_ITEMS: "Total items"
    },

    // ============================================================================
    // FILE OPERATIONS
    // ============================================================================
    FILES: {
        CHOOSE_FILE: "Choose File",
        DOWNLOAD: "Download",
        FILE_SIZE: "File size",
        IMPORT_CSV: "Import CSV",
        SAVE_AS: "Save As",
        UPLOAD_FILE: "Upload File"
    },

    // ============================================================================
    // SETTINGS AND CONFIGURATION
    // ============================================================================
    SETTINGS: {
        ADVANCED: "Advanced",
        BASIC: "Basic",
        CONFIGURATION: "Configuration",
        CUSTOM_SELECTORS: "Custom Selectors",
        DELAY_BETWEEN_REQUESTS: "Delay between requests",
        ENABLE_LOGGING: "Enable logging",
        GENERAL: "General",
        LANGUAGE: "Language",
        MAX_ITEMS: "Maximum items to scrape",
        NOTIFICATIONS: "Notifications",
        PERFORMANCE: "Performance",
        PRIVACY: "Privacy",
        SAVE_SETTINGS: "Save Settings",
        SCRAPING_OPTIONS: "Scraping Options",
        TIMEOUT: "Timeout (seconds)"
    },

    // ============================================================================
    // NOTIFICATIONS AND MESSAGES
    // ============================================================================
    MESSAGES: {
        ERROR_OCCURRED: "An error occurred",
        INVALID_URL: "Invalid URL provided",
        NO_PERMISSION: "Permission denied",
        SCRAPING_COMPLETE: "Scraping completed successfully",
        SCRAPING_FAILED: "Scraping failed",
        SUCCESS: "Operation completed successfully",
        WARNING: "Warning"
    },

    // ============================================================================
    // HELP AND DOCUMENTATION
    // ============================================================================
    HELP: {
        ABOUT: "About",
        DOCUMENTATION: "Documentation",
        FAQ: "Frequently Asked Questions",
        GET_HELP: "Get Help",
        HOW_TO_USE: "How to Use",
        SUPPORT: "Support",
        TUTORIAL: "Tutorial",
        VERSION: "Version"
    },

    // ============================================================================
    // DATA DISPLAY
    // ============================================================================
    DATA: {
        COLUMNS: "Columns",
        DATA_PREVIEW: "Data Preview",
        FILTER: "Filter",
        ROWS: "Rows",
        SORT: "Sort",
        TABLE_VIEW: "Table View",
        TOTAL_RECORDS: "Total Records"
    },

    // ============================================================================
    // STATUS AND PROGRESS
    // ============================================================================
    STATUS: {
        CONNECTING: "Connecting...",
        CONNECTED: "Connected",
        DISCONNECTED: "Disconnected",
        ERROR: "Error",
        IDLE: "Idle",
        PROCESSING: "Processing...",
        READY: "Ready",
        SUCCESS: "Success",
        WAITING: "Waiting..."
    }
};

// ============================================================================
// PLACEHOLDER REPLACEMENT FUNCTIONS
// ============================================================================

/**
 * Replace placeholders in text strings with actual values
 * @param {string} text - Text with placeholders
 * @param {Object} replacements - Object with placeholder values
 * @returns {string} - Text with replaced placeholders
 */
export function replacePlaceholders(text, replacements) {
    let result = text;
    
    for (const [key, value] of Object.entries(replacements)) {
        const placeholder = `{${key}}`;
        result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return result;
}

/**
 * Get a text string with optional placeholder replacements
 * @param {string} key - Key path to the text string (e.g., "ACTIONS.ADD_REVIEW")
 * @param {Object} replacements - Optional placeholder replacements
 * @returns {string} - The text string with replacements applied
 */
export function getText(key, replacements = {}) {
    const keys = key.split('.');
    let value = UI_STRINGS;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`Text key not found: ${key}`);
            return key; // Return the key if not found
        }
    }
    
    if (typeof value === 'string') {
        return replacements && Object.keys(replacements).length > 0 
            ? replacePlaceholders(value, replacements)
            : value;
    }
    
    return key;
}

// ============================================================================
// LEGACY SUPPORT
// ============================================================================

/**
 * Legacy function to maintain compatibility with existing code
 * that might expect the old translation system
 */
export function getMessage(key, placeholders = {}) {
    return getText(key, placeholders);
}

/**
 * Export the strings object for direct access if needed
 */
export default UI_STRINGS;