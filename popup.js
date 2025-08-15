// Update to refresh data when popup opens
document.addEventListener('DOMContentLoaded', () => {
  const updatePopupData = () => {
    chrome.storage.local.get(['currentPageData'], (result) => {
      if (result.currentPageData) {
        const pageData = result.currentPageData;
        const siteFaviconElement = document.querySelector('.site-favicon');
        const siteTitleElement = document.querySelector('.extension-title');
        const siteUrlElement = document.querySelector('.site-info-text');
        const siteContentSnippetElement = document.querySelector('.site-content-snippet');

        if (siteFaviconElement) siteFaviconElement.src = pageData.favicon;
        if (siteTitleElement) siteTitleElement.textContent = pageData.title || "No Title";
        if (siteUrlElement) siteUrlElement.textContent = new URL(pageData.url).hostname;
        if (siteContentSnippetElement) {
          const snippet = pageData.metaDescription || pageData.text.substring(0, 200) + '...';
          siteContentSnippetElement.textContent = snippet;
        }
      }
    });
  };

  // Update immediately
  updatePopupData();

  // Listen for future updates
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentPageData) {
      updatePopupData();
    }
  });
});