chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "updatePopup") {
    const output = document.getElementById("output");
    output.innerHTML = `
      <p><strong>URL:</strong> ${request.data.url}</p>
      <p><strong>Title:</strong> ${request.data.title}</p>
      <p><strong>Text Content:</strong></p>
      <div>${request.data.text.replace(/\n/g, '<br>')}</div>
    `;
  }
});

// Inject content script when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    files: ["content-script.js"]
  });
});
