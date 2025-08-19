chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) return;
  if (request.action === 'pageData') {
    // Mirror into storage (content script already writes, but keep background synced)
    chrome.storage.local.set({ currentPageData: request.data }, () => {
      sendResponse({ status: 'success' });
    });
    // keep sendResponse asynchronous
    return true;
  }
});