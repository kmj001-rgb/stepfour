// runtime-permissions.js - Runtime permission management for MV3 compliance
// Handles user consent flows and on-demand permission requests

console.log('🔐 Loading Runtime Permissions Manager...');

/**
 * Runtime Permissions Manager for MV3 Compliance
 * Manages runtime permission requests with proper user consent flows
 */
class RuntimePermissionsManager {
  constructor(options = {}) {
    this.options = {
      enableUserNotifications: options.enableUserNotifications !== false,
      showPermissionRationale: options.showPermissionRationale !== false,
      permissionTimeout: options.permissionTimeout || 30000, // 30 seconds
      ...options
    };

    this.permissionStates = new Map();
    this.pendingRequests = new Map();
    this.permissionHistory = [];
    this.rationales = this.initializeRationales();
    
    console.log('✅ Runtime Permissions Manager initialized');
  }

  /**
   * Initialize permission rationales for user consent
   */
  initializeRationales() {
    return {
      downloads: {
        title: 'Download Permission Required',
        message: 'StepThree needs download permission to save scraped images and export data to your device.',
        benefits: [
          'Save scraped images to your Downloads folder',
          'Export data in multiple formats (Excel, CSV, JSON)',
          'Batch download processing for efficiency'
        ],
        risks: 'This permission allows the extension to download files to your device.'
      },
      notifications: {
        title: 'Notification Permission Required',
        message: 'StepThree would like to send notifications about scraping progress and completion.',
        benefits: [
          'Get notified when scraping operations complete',
          'Receive alerts about errors or issues',
          'Stay informed about background processes'
        ],
        risks: 'This permission allows the extension to show system notifications.'
      },
      clipboardRead: {
        title: 'Clipboard Read Permission Required',
        message: 'StepThree needs clipboard access to read URLs you copy for quick gallery scraping.',
        benefits: [
          'Quickly start scraping by copying gallery URLs',
          'Paste image URLs for individual processing',
          'Import lists of URLs from clipboard'
        ],
        risks: 'This permission allows the extension to read your clipboard contents.'
      },
      clipboardWrite: {
        title: 'Clipboard Write Permission Required',
        message: 'StepThree needs clipboard access to copy scraped image URLs and data.',
        benefits: [
          'Copy scraped image URLs to clipboard',
          'Copy gallery data for use in other applications',
          'Quick sharing of scraping results'
        ],
        risks: 'This permission allows the extension to write to your clipboard.'
      }
    };
  }

  /**
   * Request permission with user consent flow
   */
  async requestPermission(permission, requestContext = {}) {
    try {
      console.log(`🔐 Requesting permission: ${permission}`);

      // Check if already granted
      const hasPermission = await this.checkPermission(permission);
      if (hasPermission) {
        console.log(`✅ Permission already granted: ${permission}`);
        return { granted: true, alreadyGranted: true };
      }

      // Check if request is already pending
      if (this.pendingRequests.has(permission)) {
        console.log(`⏳ Permission request already pending: ${permission}`);
        return this.pendingRequests.get(permission);
      }

      // Create permission request promise
      const requestPromise = this.executePermissionRequest(permission, requestContext);
      this.pendingRequests.set(permission, requestPromise);

      try {
        const result = await requestPromise;
        return result;
      } finally {
        this.pendingRequests.delete(permission);
      }

    } catch (error) {
      console.error(`❌ Permission request failed: ${permission}`, error);
      throw new Error(`Permission request failed: ${error.message}`);
    }
  }

  /**
   * Execute the actual permission request flow
   */
  async executePermissionRequest(permission, requestContext) {
    try {
      // Show rationale if enabled
      if (this.options.showPermissionRationale) {
        const shouldProceed = await this.showPermissionRationale(permission, requestContext);
        if (!shouldProceed) {
          return { granted: false, userCancelled: true };
        }
      }

      // Request the permission
      const granted = await chrome.permissions.request({
        permissions: [permission]
      });

      // Update state
      this.updatePermissionState(permission, granted);

      // Log to history
      this.addToHistory(permission, granted, requestContext);

      // Show result notification
      if (this.options.enableUserNotifications) {
        await this.showPermissionResult(permission, granted);
      }

      console.log(`${granted ? '✅' : '❌'} Permission ${granted ? 'granted' : 'denied'}: ${permission}`);

      return {
        granted,
        permission,
        timestamp: Date.now(),
        context: requestContext
      };

    } catch (error) {
      console.error(`❌ Permission request execution failed: ${permission}`, error);
      throw error;
    }
  }

  /**
   * Request host permissions for specific origins
   */
  async requestHostPermissions(origins, requestContext = {}) {
    try {
      console.log(`🌐 Requesting host permissions for origins:`, origins);

      const originsArray = Array.isArray(origins) ? origins : [origins];
      
      // Check which origins already have permission
      const alreadyGranted = [];
      const needPermission = [];

      for (const origin of originsArray) {
        const hasPermission = await chrome.permissions.contains({
          origins: [origin]
        });
        
        if (hasPermission) {
          alreadyGranted.push(origin);
        } else {
          needPermission.push(origin);
        }
      }

      if (needPermission.length === 0) {
        console.log(`✅ Host permissions already granted for all origins`);
        return { granted: true, alreadyGranted, newlyGranted: [] };
      }

      // Show rationale for host permissions
      if (this.options.showPermissionRationale) {
        const shouldProceed = await this.showHostPermissionRationale(needPermission, requestContext);
        if (!shouldProceed) {
          return { granted: false, userCancelled: true, alreadyGranted };
        }
      }

      // Request host permissions
      const granted = await chrome.permissions.request({
        origins: needPermission
      });

      const result = {
        granted,
        alreadyGranted,
        newlyGranted: granted ? needPermission : [],
        denied: granted ? [] : needPermission,
        timestamp: Date.now(),
        context: requestContext
      };

      // Log to history
      this.addToHistory(`host_permissions`, granted, {
        ...requestContext,
        origins: needPermission
      });

      console.log(`${granted ? '✅' : '❌'} Host permissions ${granted ? 'granted' : 'denied'} for:`, needPermission);

      return result;

    } catch (error) {
      console.error(`❌ Host permission request failed:`, error);
      throw new Error(`Host permission request failed: ${error.message}`);
    }
  }

  /**
   * Check if permission is currently granted
   */
  async checkPermission(permission) {
    try {
      return await chrome.permissions.contains({
        permissions: [permission]
      });
    } catch (error) {
      console.error(`❌ Permission check failed: ${permission}`, error);
      return false;
    }
  }

  /**
   * Check multiple permissions at once
   */
  async checkPermissions(permissions) {
    const results = {};
    
    for (const permission of permissions) {
      results[permission] = await this.checkPermission(permission);
    }
    
    return results;
  }

  /**
   * Show permission rationale to user
   */
  async showPermissionRationale(permission, requestContext) {
    const rationale = this.rationales[permission];
    
    if (!rationale) {
      console.warn(`⚠️ No rationale defined for permission: ${permission}`);
      return true; // Proceed without rationale
    }

    try {
      // Send message to UI to show rationale dialog
      const response = await chrome.runtime.sendMessage({
        action: 'SHOW_PERMISSION_RATIONALE',
        permission,
        rationale,
        context: requestContext
      });

      return response?.proceed === true;

    } catch (error) {
      console.warn(`⚠️ Could not show permission rationale: ${error.message}`);
      return true; // Proceed without rationale on error
    }
  }

  /**
   * Show host permission rationale
   */
  async showHostPermissionRationale(origins, requestContext) {
    try {
      // Send message to UI to show host permission rationale
      const response = await chrome.runtime.sendMessage({
        action: 'SHOW_HOST_PERMISSION_RATIONALE',
        origins,
        context: requestContext,
        rationale: {
          title: 'Website Access Permission Required',
          message: `StepThree needs access to these websites to scrape gallery content.`,
          benefits: [
            'Access and analyze gallery structures',
            'Extract image information and metadata',
            'Enable smart pattern recognition'
          ],
          risks: 'This permission allows the extension to read and modify content on the specified websites.'
        }
      });

      return response?.proceed === true;

    } catch (error) {
      console.warn(`⚠️ Could not show host permission rationale: ${error.message}`);
      return true; // Proceed without rationale on error
    }
  }

  /**
   * Show permission result notification
   */
  async showPermissionResult(permission, granted) {
    try {
      const rationale = this.rationales[permission];
      const title = granted ? 'Permission Granted' : 'Permission Denied';
      const message = granted
        ? `${rationale?.title || permission} has been granted. You can now use this feature.`
        : `${rationale?.title || permission} was denied. Some features may not work.`;

      await chrome.runtime.sendMessage({
        action: 'SHOW_PERMISSION_RESULT',
        permission,
        granted,
        title,
        message
      });

    } catch (error) {
      console.warn(`⚠️ Could not show permission result: ${error.message}`);
    }
  }

  /**
   * Update internal permission state
   */
  updatePermissionState(permission, granted) {
    this.permissionStates.set(permission, {
      granted,
      lastChecked: Date.now(),
      lastChanged: Date.now()
    });
  }

  /**
   * Add operation to history
   */
  addToHistory(permission, granted, context) {
    this.permissionHistory.push({
      permission,
      granted,
      timestamp: Date.now(),
      context: context || {}
    });

    // Keep history manageable
    if (this.permissionHistory.length > 100) {
      this.permissionHistory = this.permissionHistory.slice(-50);
    }
  }

  /**
   * Remove permission (revoke)
   */
  async removePermission(permission) {
    try {
      console.log(`🔒 Removing permission: ${permission}`);

      const removed = await chrome.permissions.remove({
        permissions: [permission]
      });

      if (removed) {
        this.updatePermissionState(permission, false);
        this.addToHistory(permission, false, { action: 'revoked' });
      }

      console.log(`${removed ? '✅' : '❌'} Permission ${removed ? 'removed' : 'removal failed'}: ${permission}`);

      return { removed, permission };

    } catch (error) {
      console.error(`❌ Permission removal failed: ${permission}`, error);
      throw new Error(`Permission removal failed: ${error.message}`);
    }
  }

  /**
   * Get current permission status summary
   */
  async getPermissionStatus() {
    const essentialPermissions = ['downloads', 'notifications', 'clipboardRead', 'clipboardWrite'];
    const permissionChecks = await this.checkPermissions(essentialPermissions);

    const status = {
      timestamp: Date.now(),
      permissions: permissionChecks,
      grantedCount: Object.values(permissionChecks).filter(Boolean).length,
      totalCount: essentialPermissions.length,
      allGranted: Object.values(permissionChecks).every(Boolean),
      history: this.permissionHistory.slice(-10), // Last 10 operations
      pendingRequests: Array.from(this.pendingRequests.keys())
    };

    return status;
  }

  /**
   * Setup permission change listener
   */
  setupPermissionListener() {
    if (chrome.permissions && chrome.permissions.onAdded) {
      chrome.permissions.onAdded.addListener((permissions) => {
        console.log('🔐 Permissions added:', permissions);
        
        // Update internal state
        if (permissions.permissions) {
          permissions.permissions.forEach(permission => {
            this.updatePermissionState(permission, true);
            this.addToHistory(permission, true, { action: 'system_added' });
          });
        }
      });
    }

    if (chrome.permissions && chrome.permissions.onRemoved) {
      chrome.permissions.onRemoved.addListener((permissions) => {
        console.log('🔒 Permissions removed:', permissions);
        
        // Update internal state
        if (permissions.permissions) {
          permissions.permissions.forEach(permission => {
            this.updatePermissionState(permission, false);
            this.addToHistory(permission, false, { action: 'system_removed' });
          });
        }
      });
    }

    console.log('🔐 Permission change listeners setup');
  }

  /**
   * Get permission history
   */
  getHistory() {
    return [...this.permissionHistory];
  }

  /**
   * Clear permission history
   */
  clearHistory() {
    this.permissionHistory = [];
    console.log('🧹 Permission history cleared');
  }
}

// Make available globally for Chrome extension context
if (typeof globalThis !== 'undefined') {
  globalThis.RuntimePermissionsManager = RuntimePermissionsManager;
}

console.log('✅ Runtime Permissions Manager loaded successfully');