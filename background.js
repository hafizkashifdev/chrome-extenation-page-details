// ENHANCED: Background script with better error handling and context validation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) return true; // Keep channel open for async response

  // Validate extension context before processing
  if (!chrome.runtime || !chrome.runtime.id) {
    console.warn("Extension context invalid in background script");
    sendResponse({ status: 'error', message: 'Extension context invalid' });
    return false;
  }

  switch (request.action) {
    case 'pageData':
      // Mirror into storage
      try {
        chrome.storage.local.set({ currentPageData: request.data }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to store page data:', chrome.runtime.lastError);
            sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
          } else {
            sendResponse({ status: 'success' });
          }
        });
      } catch (error) {
        console.error('Error storing page data:', error);
        sendResponse({ status: 'error', message: error.message });
      }
      break;

    case 'getStorage':
      try {
        chrome.storage.local.get(request.keys, (data) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to get storage:', chrome.runtime.lastError);
            sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
          } else {
            sendResponse({ status: 'success', data });
          }
        });
      } catch (error) {
        console.error('Error getting storage:', error);
        sendResponse({ status: 'error', message: error.message });
      }
      break;

    case 'setStorage':
      try {
        chrome.storage.local.set(request.data, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to set storage:', chrome.runtime.lastError);
            sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
          } else {
            sendResponse({ status: 'success' });
          }
        });
      } catch (error) {
        console.error('Error setting storage:', error);
        sendResponse({ status: 'error', message: error.message });
      }
      break;

    case 'logout':
      // Handle logout in a persistent context to avoid "context invalidated" errors
      try {
        chrome.storage.local.remove(['user', 'isLoggedIn', 'popupUIState'], () => {
          if (chrome.runtime.lastError) {
            console.error('Logout storage cleanup failed:', chrome.runtime.lastError);
            sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
          } else {
            // Set isLoggedIn to false to trigger listeners in content scripts
            chrome.storage.local.set({ isLoggedIn: false }, () => {
              if (chrome.runtime.lastError) {
                console.error('Failed to set logout state:', chrome.runtime.lastError);
                sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
              } else {
                console.log('User logged out successfully.');
                sendResponse({ status: 'success' });
              }
            });
          }
        });
      } catch (error) {
        console.error('Error during logout:', error);
        sendResponse({ status: 'error', message: error.message });
      }
      break;
    
    default:
      // Handle unknown actions if necessary
      console.warn('Unknown action received:', request.action);
      sendResponse({ status: 'unknown_action', message: 'Unknown action received' });
      break;
  }
  
  // Return true to indicate you wish to send a response asynchronously
  return true;
});

// Add error handling for runtime errors
chrome.runtime.onSuspend.addListener(() => {
  console.log('Background script is being suspended');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Background script started');
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
});