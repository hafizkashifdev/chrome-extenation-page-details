document.addEventListener('DOMContentLoaded', () => {
  const loadingEl = document.getElementById('loading');
  const faviconElement = document.querySelector('.site-favicon');
  const titleElement = document.querySelector('.extension-title');
  const descriptionElement = document.querySelector('.site-description');
  const snippetElement = document.querySelector('.content-snippet');
  const fullContentElement = document.querySelector('.full-content');
  const toggleBtn = document.querySelector('.toggle-details-btn');
  const closeBtn = document.querySelector('.close-btn');
  const fullDetails = document.querySelector('.full-details');

  // Helper: show/hide loading indicator
  const setLoading = (isLoading) => {
    loadingEl.style.display = isLoading ? 'block' : 'none';
  };

  function toggleDetails() {
    const isHidden = fullDetails.style.display === 'none';
    fullDetails.style.display = isHidden ? 'block' : 'none';
    toggleBtn.textContent = isHidden ? 'Show Less' : 'Show More';
    toggleBtn.setAttribute('aria-expanded', String(isHidden));
  }

  function closePopup() {
    window.parent.postMessage('closePopup', '*');
  }

  // Ensure we don't stack listeners
  toggleBtn.removeEventListener('click', toggleDetails);
  closeBtn.removeEventListener('click', closePopup);
  toggleBtn.addEventListener('click', toggleDetails);
  closeBtn.addEventListener('click', closePopup);

  // favicon fallback
  faviconElement.onerror = function () {
    this.src = chrome.runtime.getURL('icons/icon48.png');
  };

  // Try to fill UI from storage; if missing, wait for it shortly
  const loadFromStorageOnce = () => new Promise((resolve) => {
    chrome.storage.local.get(['currentPageData'], (result) => resolve(result.currentPageData || null));
  });

  const updateUI = async () => {
    setLoading(true);
    let data = await loadFromStorageOnce();

    // If data not there yet, wait briefly (content script stores then opens popup)
    if (!data) {
      await new Promise(r => setTimeout(r, 200));
      data = await loadFromStorageOnce();
    }

    if (!data) {
      // Still nothing; keep loader visible and rely on onChanged listener below
      return;
    }

    const pageData = data;

    // Favicon (absolute or fallback)
    if (pageData.favicon) {
      faviconElement.src = pageData.favicon;
    } else {
      faviconElement.src = chrome.runtime.getURL('icons/icon48.png');
    }

    // Title + origin
    titleElement.textContent = pageData.title || 'No Title';
    titleElement.setAttribute('title', titleElement.textContent);
    try {
      const host = new URL(pageData.url).hostname;
      descriptionElement.textContent = host;
      descriptionElement.setAttribute('title', host);
    } catch {
      descriptionElement.textContent = '';
    }

    // Text content
    const fullText = pageData.text || '';
    const snippetText = pageData.metaDescription && pageData.metaDescription.trim()
      ? pageData.metaDescription
      : (fullText.length > 140 ? fullText.substring(0, 140) + '…' : fullText);

    snippetElement.textContent = snippetText;
    fullContentElement.textContent = fullText;

    setLoading(false);
  };

  updateUI();

  // If storage changes afterwards, refresh UI
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.currentPageData) {
      updateUI();
    }
  });

  // Support manual refresh from content script
  window.addEventListener('message', (event) => {
    if (event.data === 'updateData') {
      updateUI();
    }
  });
});
