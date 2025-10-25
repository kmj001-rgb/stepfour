const EXTENSION_ID = chrome.runtime.id; // Get the extension ID
//console.log("Extension ID:", chrome.runtime.id);

// ✅ Function to get WordPress session cookie
function getWordPressSessionCookie() {
    return new Promise((resolve, reject) => {
        chrome.cookies.getAll({ domain: "bulkimagedownloaderurllist.com" }, (cookies) => {
            const sessionCookie = cookies.find(cookie => cookie.name.startsWith("wordpress_logged_in_"));
            if (sessionCookie) {
                //console.log("🍪 Found WordPress session cookie:", sessionCookie.value);
                resolve(sessionCookie.value);
            } else {
                //console.log("ℹ️ No WordPress session cookie found.");
                reject(new Error("No WordPress session cookie found."));
            }
        });
    });
}

// ✅ Function to get the auth token from the cookie
function getAuthTokenCookie() {
    return new Promise((resolve, reject) => {
        chrome.cookies.get({ url: "https://bulkimagedownloaderurllist.com", name: "auth_token" }, (cookie) => {
            if (cookie) {
                //console.log("🔑 Found auth token cookie:", cookie.value);
                resolve(cookie.value);
            } else {
                //console.log("ℹ️ No auth token cookie found.");
                reject(new Error("No auth token cookie found."));
            }
        });
    });
}

// ✅ Function to get the refresh token from the HttpOnly cookie
function getRefreshTokenCookie() {
    return new Promise((resolve, reject) => {
        chrome.cookies.get(
            {
                url: "https://bulkimagedownloaderurllist.com", // Full URL including protocol
                name: "refresh_token" // Cookie name
            },
            (cookie) => {
                if (cookie) {
                    //console.log("🔑 Found refresh token cookie:", cookie);
                    resolve(cookie.value);
                } else {
                    //console.log("ℹ️ No refresh token cookie found. Details:", {
                    //    url: "https://bulkimagedownloaderurllist.com",
                    //    name: "refresh_token",
                    //    cookie: cookie
                    //});
                    reject(new Error("No refresh token cookie found."));
                }
            }
        );
    });
}

// ✅ Function to refresh the access token using the refresh token cookie
async function refreshAccessToken() {
    try {
        const refreshToken = await getRefreshTokenCookie();
        if (!refreshToken) {
            //console.log("ℹ️ No refresh token found.");
            return null;
        }

        //console.log("🔑 Using refresh token to refresh access token:", refreshToken);

        const response = await fetch("https://bulkimagedownloaderurllist.com/wp-json/api/refresh-token", {
            method: "POST",
            credentials: "include", // Include cookies in the request
            headers: {
                "X-Extension-ID": EXTENSION_ID, // Add extension ID header
            },
        });

        if (!response.ok) {
            throw new Error(`⚠️ Failed to refresh token: ${response.status}`);
        }

        const data = await response.json();
        //console.log("✅ Access token refreshed:", data);
        return data.access_token;
    } catch (error) {
        //console.log("ℹ️ Error refreshing access token:", error);
        return null;
    }
}

// ✅ Function to validate session with retry mechanism
async function validateSession(retryCount = 0) {
    try {
        //console.log(`🔄 Validating session... (Attempt ${retryCount + 1})`);

        // Step 1: Check if the auth token exists
        const authToken = await getAuthTokenCookie().catch(() => null);

        if (!authToken) {
            //console.log("🔄 No auth token found. Attempting to refresh using refresh token...");
            const newAccessToken = await refreshAccessToken();
            if (newAccessToken) {
                //console.log("🔄 Retrying session validation with new access token...");
                return validateSession(retryCount);
            } else {
                //console.log("ℹ️ Failed to refresh access token. Logging out user...");
                forceLogout();
                return { status: "error", error: "Failed to refresh token" };
            }
        }

        // Step 2: Validate the session using the auth token
        const response = await fetch("https://bulkimagedownloaderurllist.com/wp-json/api/validate-session", {
            method: "GET",
            credentials: "include", // Include cookies in the request
            headers: {
                "X-Extension-ID": EXTENSION_ID, // Add extension ID header
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Access token might have expired, try to refresh it
                //console.log("🔄 Access token expired. Attempting to refresh...");
                const newAccessToken = await refreshAccessToken();
                if (newAccessToken) {
                    //console.log("🔄 Retrying session validation with new access token...");
                    return validateSession(retryCount);
                } else {
                    //console.log("ℹ️ Failed to refresh access token. Logging out user...");
                    forceLogout();
                    return { status: "error", error: "Token refresh failed" };
                }
            }
            throw new Error(`⚠️ Request failed with status: ${response.status}`);
        }

        // Step 3: Handle successful session validation
        const data = await response.json();
        //console.log("✅ Session validation response:", data);

        if (data.success && data.data && data.data.status === 'success') {
            //console.log("✅ User authenticated:", data.data.user);
            
            const licenseValid = data.data.license && data.data.license.license_status === "sold";
            
            // Store user data and license info
            await new Promise((resolve) => {
                chrome.storage.local.set({ 
                    isLoggedIn: true, 
                    userEmail: data.data.user.email, 
                    license: data.data.license 
                }, () => {
                    //console.log("📌 Stored login state:", { 
                    //    isLoggedIn: true, 
                    //   userEmail: data.data.user.email, 
                    //    license: data.data.license 
                    //});
                    resolve();
                });
            });

            // Send message to update UI
            try {
                await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: "updateUI",
                        isLoggedIn: true,
                        userEmail: data.data.user.email,
                        license: data.data.license
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            //console.log("ℹ️ No listener for updateUI message:", chrome.runtime.lastError.message);
                        } else {
                            //console.log("✅ UI update message sent successfully.");
                        }
                        resolve();
                    });
                });
            } catch (error) {
                //console.log("ℹ️ Failed to send message to update UI:", error);
            }

            return {
                status: "success",
                userEmail: data.data.user.email,
                license: data.data.license,
                valid: licenseValid
            };
        } else {
            if (retryCount < 2) {
               //console.log(`ℹ️ Invalid session. Retrying in 30 seconds... (Attempt ${retryCount + 2})`);
                await new Promise(resolve => setTimeout(resolve, 30000));
                return validateSession(retryCount + 1);
            } else {
                //console.log("ℹ️ Invalid session after 3 attempts. Logging out user...");
                forceLogout();
                return { status: "error", error: "Invalid session" };
            }
        }
    } catch (error) {
        //console.log("ℹ️ Error validating session:", error);

        if (retryCount < 2) {
            //console.log(`ℹ️ Retrying session validation in 30 seconds... (Attempt ${retryCount + 2})`);
            await new Promise(resolve => setTimeout(resolve, 30000));
            return validateSession(retryCount + 1);
        } else {
            //console.log("ℹ️ Maximum retries reached. Logging out user...");
            forceLogout();
            return { status: "error", error: error.message };
        }
    }
}

// ✅ Function to force logout and update UI
function forceLogout() {
    chrome.storage.local.get(["isLoggedIn"], (data) => {
        if (!data.isLoggedIn) {
            //console.log("✅ User is already logged out. Skipping forceLogout.");
            return;
        }

        chrome.storage.local.set({ isLoggedIn: false, userEmail: null, license: null }, () => {
            //console.log("📌 Stored logout state.");

            // Send message to update UI
            try {
                chrome.runtime.sendMessage({ action: "updateUI", isLoggedIn: false }, (response) => {
                    if (chrome.runtime.lastError) {
                        //console.log("ℹ️ No listener for updateUI message:", chrome.runtime.lastError.message);
                    } else {
                        //console.log("✅ UI update message sent successfully.");
                    }
                });
            } catch (error) {
                //console.log("ℹ️ Failed to send message to update UI:", error);
            }
        });
    });
}

// ✅ Listen for changes in WordPress session cookies
chrome.cookies.onChanged.addListener((change) => {
    if (change.cookie.domain.includes("bulkimagedownloaderurllist.com") && change.cookie.name.startsWith("wordpress_logged_in_")) {
        if (change.removed) {
            //console.log("🚨 WordPress session cookie removed. Logging out...");
            forceLogout();
        } else {
            //console.log("✅ WordPress session cookie found. Attempting login...");
            validateSession();
        }
    }
});

// ✅ Run session validation on startup and installation
chrome.runtime.onStartup.addListener(validateSession);
chrome.runtime.onInstalled.addListener(validateSession);

// ✅ Listen for validation request from options.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "validateSession") {
        validateSession().then(() => {
            chrome.storage.local.get(["isLoggedIn", "userEmail", "license"], (data) => {
                sendResponse({ 
                    status: "success", 
                    userEmail: data.userEmail, 
                    license: data.license,
                    valid: data.license && data.license.license_status === "sold"
                });
            });
        }).catch(error => {
            sendResponse({ status: "error", error: error.message });
        });
        return true; // Required to use sendResponse asynchronously
    }
});

// Test the getRefreshTokenCookie function
getRefreshTokenCookie()
    .then((refreshToken) => {
        //console.log("✅ Refresh token fetched successfully:", refreshToken);
    })
    .catch((error) => {
        //console.log("ℹ️ Failed to fetch refresh token:", error);
    });

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});
