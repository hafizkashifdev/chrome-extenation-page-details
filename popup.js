document.addEventListener('DOMContentLoaded', () => {
  const updatePopupData = () => {
    chrome.storage.local.get(['currentPageData'], (result) => {
      if (result.currentPageData) {
        const pageData = result.currentPageData;
        const faviconElement = document.querySelector('.site-favicon');
        const titleElement = document.querySelector('.extension-title');
        const descriptionElement = document.querySelector('.site-description');
        const snippetElement = document.querySelector('.content-snippet');
        const fullContentElement = document.querySelector('.full-content');
        const toggleBtn = document.querySelector('.toggle-details-btn');
        const closeBtn = document.querySelector('.close-btn');
        const fullDetails = document.querySelector('.full-details');

        // Set favicon with error handling for fallback
        faviconElement.onerror = function() {
          this.onerror = null; // Prevent looping
          this.src = chrome.runtime.getURL('icons/icon48.png');
        };
        if (pageData.favicon) {
          faviconElement.src = pageData.favicon;
        } else {
          faviconElement.src = chrome.runtime.getURL('icons/icon48.png');
        }

        titleElement.textContent = pageData.title || "No Title";
        descriptionElement.textContent = new URL(pageData.url).hostname;

        // Handle large query by limiting initial snippet
        const fullText = pageData.text || "";
        const snippetText = fullText.length > 100 ? fullText.substring(0, 100) + '...' : fullText;
        snippetElement.textContent = pageData.metaDescription || snippetText;
        fullContentElement.textContent = fullText;

        // Remove existing listeners to prevent duplicates
        const oldToggleListener = toggleBtn._eventListeners?.click;
        if (oldToggleListener) {
          toggleBtn.removeEventListener('click', oldToggleListener);
        }
        const oldCloseListener = closeBtn._eventListeners?.click;
        if (oldCloseListener) {
          closeBtn.removeEventListener('click', oldCloseListener);
        }

        // Toggle "Show More" functionality with snippet visibility
        toggleBtn.addEventListener('click', () => {
          const isHidden = fullDetails.style.display === 'none';
          fullDetails.style.display = isHidden ? 'block' : 'none';
          snippetElement.style.display = isHidden ? 'none' : 'block';
          toggleBtn.textContent = isHidden ? 'Show Less' : 'Show More';
        }, { once: false });

        // Close button functionality using postMessage
        closeBtn.addEventListener('click', () => {
          window.parent.postMessage('closePopup', '*');
        }, { once: false });
      }
    });
  };

  // Initial update
  updatePopupData();

  // Listen for data update messages
  window.addEventListener('message', (event) => {
    if (event.data === 'updateData') {
      updatePopupData();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentPageData) {
      updatePopupData();
    }
  });
});