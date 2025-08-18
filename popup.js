document.addEventListener('DOMContentLoaded', () => {
  const loadingEl = document.getElementById('loading');
  const faviconEl = document.querySelector('.site-favicon');
  const titleEl = document.querySelector('.extension-title');
  const descEl = document.querySelector('.site-description');
  const snippetEl = document.querySelector('.content-snippet');
  const fullEl = document.querySelector('.full-content');
  const toggleBtn = document.querySelector('.toggle-details-btn');
  const closeBtn = document.querySelector('.close-btn');
  const fullDetails = document.querySelector('.full-details');

  let lastData = null;

  const setLoading = isLoading => loadingEl.style.display = isLoading ? 'block' : 'none';

  const toggleDetails = () => {
    const isHidden = fullDetails.style.display === 'none';
    fullDetails.style.display = isHidden ? 'block' : 'none';
    toggleBtn.textContent = isHidden ? 'Show Less' : 'Show More';
    toggleBtn.setAttribute('aria-expanded', String(isHidden));
  };

  toggleBtn.addEventListener('click', toggleDetails);
  closeBtn.addEventListener('click', () => window.parent.postMessage('closePopup', '*'));

  faviconEl.onerror = () => faviconEl.src = chrome.runtime.getURL('icons/icon48.png');

  const updateUI = () => {
    if (!chrome?.storage?.local) return;

    chrome.storage.local.get('currentPageData', ({ currentPageData }) => {
      if (!currentPageData) return;
      if (lastData && JSON.stringify(lastData) === JSON.stringify(currentPageData)) return;

      lastData = currentPageData;

      faviconEl.src = currentPageData.favicon || chrome.runtime.getURL('icons/icon48.png');
      titleEl.textContent = currentPageData.title || 'No Title';
      descEl.textContent = currentPageData.metaDescription || '';
      snippetEl.style.display = currentPageData.metaDescription ? 'block' : 'none';
      snippetEl.textContent = currentPageData.metaDescription || '';
      fullEl.textContent = currentPageData.text || '';

      setLoading(false);
    });
  };

  updateUI();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.currentPageData) updateUI();
  });

  window.addEventListener('message', e => {
    if (e.data === 'updateData') updateUI();
  });
});
