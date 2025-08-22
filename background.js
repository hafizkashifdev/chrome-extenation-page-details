chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) return true; // Keep channel open for async response

  switch (request.action) {
    case 'pageData':
      // Mirror into storage
      chrome.storage.local.set({ currentPageData: request.data }, () => {
        sendResponse({ status: 'success' });
      });
      break;

    case 'getStorage':
      chrome.storage.local.get(request.keys, (data) => {
        if (chrome.runtime.lastError) {
          sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        } else {
          sendResponse({ status: 'success', data });
        }
      });
      break;

    case 'setStorage':
      chrome.storage.local.set(request.data, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        } else {
          sendResponse({ status: 'success' });
        }
      });
      break;

    case 'logout':
      // Handle logout in a persistent context to avoid "context invalidated" errors
      chrome.storage.local.remove(['user', 'isLoggedIn', 'popupUIState'], () => {
        if (chrome.runtime.lastError) {
          console.error('Logout storage cleanup failed:', chrome.runtime.lastError);
          sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        } else {
          // Set isLoggedIn to false to trigger listeners in content scripts
          chrome.storage.local.set({ isLoggedIn: false });
          console.log('User logged out successfully.');
          sendResponse({ status: 'success' });
        }
      });
      break;
    
    default:
      // Handle unknown actions if necessary
      sendResponse({ status: 'unknown_action' });
      break;
  }
  
  // Return true to indicate you wish to send a response asynchronously
  return true;
});