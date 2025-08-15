(() => {
  const pageData = {
    url: window.location.href,
    title: document.title,
    text: document.body.innerText.trim()
  };

  chrome.runtime.sendMessage({ action: "pageData", data: pageData });
})();
