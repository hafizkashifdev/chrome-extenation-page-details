// Send page data to the extension popup
const pageData = {
    url: window.location.href,
    title: document.title,
    text: document.body.innerText.substring(0, 500) + "..." // First 500 chars
  };
  chrome.runtime.sendMessage({ action: "pageData", data: pageData });