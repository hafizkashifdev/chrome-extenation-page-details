chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "pageData") {
      document.getElementById("output").innerHTML = `
        <p><strong>URL:</strong> ${request.data.url}</p>
        <p><strong>Title:</strong> ${request.data.title}</p>
        <p><strong>Text:</strong> ${request.data.text}</p>
      `;
    }
  });
  
  // Trigger content script when popup opens
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ["content-script.js"]
    });
  });
  