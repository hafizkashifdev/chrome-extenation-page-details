
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pageData") {
    chrome.storage.local.set({ currentPageData: request.data }, () => {
      sendResponse({status: "success"});
    });
    return true; 
  }
});