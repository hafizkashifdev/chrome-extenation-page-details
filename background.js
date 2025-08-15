chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "pageData") {
      chrome.runtime.sendMessage({ action: "updatePopup", data: request.data });
    }
  });
  