// --- UI creation (unchanged visually) ---
const createExtensionUI = () => {
  const container = document.createElement('div');
  container.className = 'magical-extension-container';

  const hoverCloseButton = document.createElement('div');
  hoverCloseButton.className = 'magical-hover-close';
  hoverCloseButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  container.appendChild(hoverCloseButton);

  const icon = document.createElement('div');
  icon.className = 'magical-extension-icon';
  icon.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/icon48.png')}"
      alt="IM" class="icon-content iim-logo" width="40" height="40">
    <svg class="icon-content back-arrow" xmlns="http://www.w3.org/2000/svg"
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `;
  container.appendChild(icon);

  const dragHandle = document.createElement('div');
  dragHandle.className = 'magical-drag-handle';
  dragHandle.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="14"
      viewBox="0 0 16 24" fill="#6c757d">
      <circle cx="4" cy="6" r="1"></circle>
      <circle cx="12" cy="6" r="1"></circle>
      <circle cx="4" cy="12" r="1"></circle>
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="4" cy="18" r="1"></circle>
      <circle cx="12" cy="18" r="1"></circle>
    </svg>
  `;
  container.appendChild(dragHandle);

  const popup = document.createElement('div');
  popup.className = 'magical-extension-popup';
  popup.innerHTML = `
    <iframe src="${chrome.runtime.getURL('popup.html')}" id="popupFrame"></iframe>
  `;

  document.body.appendChild(container);
  document.body.appendChild(popup);

  return { container, icon, dragHandle, popup, hoverCloseButton };
};

let extensionUI = null;

// --- Utils: favicon resolver ---
function getFaviconUrl() {
  try {
    const link = document.querySelector('link[rel~="icon" i], link[rel="shortcut icon" i]');
    if (link) {
      const href = link.getAttribute('href');
      if (href) return new URL(href, document.baseURI).href;
    }
  } catch (e) {}
  return `${location.origin}/favicon.ico`;
}

// --- Utils: Google SERP extraction (titles + snippets) ---
function extractGoogleSERPText() {
  const results = [];
  const container = document.querySelector('#search');
  if (!container) return '';

  // Common result containers Google uses (class names can change; we cover a few)
  const items = container.querySelectorAll('div.g, div.MjjYud, div.N54PNb, div.U3A9Ac');
  let index = 0;

  items.forEach(item => {
    const title = item.querySelector('h3')?.innerText?.trim();
    // snippet selectors vary; we try several
    const snippetEl =
      item.querySelector('.VwiC3b') ||
      item.querySelector('.Uroaid') ||
      item.querySelector('.MUxGbd') ||
      item.querySelector('div[role="text"]');

    const snippet = snippetEl?.innerText?.trim();
    if (title) {
      results.push(`${++index}. ${title}${snippet ? ' — ' + snippet : ''}`);
    }
  });

  return results.join('\n\n').trim();
}

// --- Utils: Readability extraction with fallbacks ---
async function extractReadableText() {
  // 1) Special-case Google search pages
  if (location.hostname.includes('google.') && location.pathname === '/search') {
    const serpText = extractGoogleSERPText();
    if (serpText) return serpText;
  }

  // 2) Try Mozilla Readability (if loaded)
  try {
    // Readability may be exported as a function or object depending on build;
    // we only call it if present.
    if (typeof Readability !== 'undefined') {
      const docClone = document.cloneNode(true);
      const reader = new Readability(docClone);
      const article = reader.parse();
      if (article && article.textContent && article.textContent.trim().length > 200) {
        return article.textContent.trim();
      }
    }
  } catch (e) {
    // Continue to fallback
    // console.warn('Readability failed', e);
  }

  // 3) Fallback: body text, filter obvious junk
  const junkStartsWith = [
    'Accessibility links',
    'Skip to main content',
    'Accessibility help',
    'Accessibility feedback',
    'Filters and topics'
  ];
  const raw = (document.body.innerText || '')
    .split('\n')
    .filter(line => {
      const L = line.trim();
      if (!L) return false;
      if (junkStartsWith.some(j => L.startsWith(j))) return false;
      return true;
    })
    .join('\n');

  return raw.trim();
}

const initExtension = () => {
  if (extensionUI) {
    extensionUI.container.remove();
    extensionUI.popup.remove();
  }
  extensionUI = createExtensionUI();

  const { container, icon, dragHandle, popup, hoverCloseButton } = extensionUI;

  let isDragging = false;
  let initialTop = null;

  // --- Dragging (Y-axis only) ---
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    initialTop = container.offsetTop || 0;
    let startY = e.clientY;
    container.style.cursor = 'grabbing';
    e.preventDefault();

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;
      const deltaY = moveEvent.clientY - startY;
      let newTop = initialTop + deltaY;
      const minY = 10;
      const maxY = window.innerHeight - container.offsetHeight - 10;
      newTop = Math.max(minY, Math.min(newTop, maxY));
      container.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // --- Build page data, store, THEN open popup (prevents race) ---
  icon.addEventListener('click', async () => {
    if (isDragging) return;

    // Extract first
    const text = await extractReadableText();

    const pageData = {
      url: window.location.href,
      title: document.title,
      text,
      favicon: getFaviconUrl(),
      metaDescription: document.querySelector('meta[name="description"]')?.content || '',
      timestamp: new Date().toISOString()
    };

    // Store before opening popup (race-condition fix)
    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'pageData', data: pageData }, () => resolve());
      });
    } catch (error) {
      console.error('Error sending page data:', error);
    }

    // Now open popup and ask it to refresh
    container.classList.add('hidden');
    popup.style.display = 'block';
    const frame = document.getElementById('popupFrame');
    if (frame) {
      frame.contentWindow.postMessage('updateData', '*');
    }
  });

  // --- Hover close ---
  hoverCloseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    container.style.display = 'none';
  });

  // --- Messages from popup ---
  window.addEventListener('message', async (event) => {
    if (event.data === 'closePopup') {
      popup.style.display = 'none';
      container.classList.remove('hidden');
      // no re-init, just show launcher
    } else if (event.data === 'updateData') {
      // refresh stored data on demand (optional)
      const text = await extractReadableText();
      const pageData = {
        url: window.location.href,
        title: document.title,
        text,
        favicon: getFaviconUrl(),
        metaDescription: document.querySelector('meta[name="description"]')?.content || '',
        timestamp: new Date().toISOString()
      };
      chrome.runtime.sendMessage({ action: 'pageData', data: pageData }, () => {});
    }
  });

  // --- Optional: keep storage in sync if URL changes (SPAs) ---
  let lastHref = location.href;
  setInterval(async () => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      const text = await extractReadableText();
      const pageData = {
        url: window.location.href,
        title: document.title,
        text,
        favicon: getFaviconUrl(),
        metaDescription: document.querySelector('meta[name="description"]')?.content || '',
        timestamp: new Date().toISOString()
      };
      chrome.runtime.sendMessage({ action: 'pageData', data: pageData }, () => {});
    }
  }, 1500);
};

if (document.readyState === 'complete') {
  initExtension();
} else {
  window.addEventListener('load', initExtension);
}

// --- Background message relay (unchanged logic) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'pageData') {
    chrome.storage.local.set({ currentPageData: request.data }, () => {
      sendResponse({ status: 'success' });
    });
    return true;
  }
});
