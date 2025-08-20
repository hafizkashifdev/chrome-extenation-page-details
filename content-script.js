/* content-script.js
   Robust content extraction for IIMagical Extension
   - Uses Readability optionally, but always captures full text via TreeWalker
   - Special handling for Google SERP (includes full titles + URLs)
   - Debounced MutationObserver + history hooks for SPAs (Next.js)
   - Only updates chrome.storage.local when pageData actually changes
*/

(() => {
  // ---------- Helpers ----------
  const safeStorageAvailable = () =>
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.local &&
    typeof chrome.storage.local.get === 'function';

  function getFaviconUrl() {
    try {
      const link = document.querySelector('link[rel~="icon" i], link[rel="shortcut icon" i]');
      if (link) return new URL(link.href, document.baseURI).href;
    } catch (e) {}
    return `${location.origin}/favicon.ico`;
  }

  function deepEqual(a, b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  }

  // ---------- Text extraction ----------
  async function extractGoogleSERP() {
    const results = [];
    const items = document.querySelectorAll(
      'div.g, div.MjjYud, div.N54PNb, div.U3A9Ac, div.yuRUbf'
    );
    items.forEach((item, idx) => {
      let title = item.querySelector('h3')?.textContent?.trim() || '';
      if (title.endsWith(' - Google Search')) {
        title = title.replace(/ - Google Search$/, '');
      }

      const linkEl = item.querySelector('a[href]');
      const link = linkEl ? linkEl.href : '';
      const snippet =
        item.querySelector('.VwiC3b, .Uroaid, .MUxGbd, div[role="text"]')?.textContent?.trim() ||
        '';
      if (title) {
        results.push(`${idx + 1}. ${title}\nURL: ${link}\n${snippet}`);
      }
    });
    return results.join('\n\n').trim();
  }

  function extractAllTextViaTreeWalker() {
    if (!document.body) return '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
        const txt = node.nodeValue.trim();
        if (!txt) return NodeFilter.FILTER_REJECT;
        const parentTag = node.parentNode?.tagName;
        if (parentTag && ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(parentTag)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const parts = [];
    let n;
    while ((n = walker.nextNode())) {
      parts.push(n.nodeValue.trim());
    }
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function extractReadableText() {
    // 1) Google SERP
    if (location.hostname.includes('google.') && location.pathname === '/search') {
      const serp = await extractGoogleSERP();
      if (serp) return serp;
    }

    // Always use TreeWalker for full capture
    let fullText = extractAllTextViaTreeWalker();

    // Optionally merge in Readability if it gives structured text
    try {
      if (typeof Readability !== 'undefined') {
        const docClone = document.cloneNode(true);
        const reader = new Readability(docClone);
        const article = reader.parse();
        if (article && article.textContent && article.textContent.trim().length > 200) {
          if (article.textContent.length > fullText.length / 2) {
            fullText += "\n\n" + article.textContent.trim();
          }
        }
      }
    } catch (e) {
      // ignore
    }

    return fullText;
  }

  // ---------- pageData builder + storage ----------
  async function buildPageData() {
    const text = await extractReadableText();

    const metaDesc =
      document.querySelector('meta[name="description"]')?.content?.trim() ||
      document.querySelector('meta[property="og:description"]')?.content?.trim() ||
      document.querySelector('meta[name="twitter:description"]')?.content?.trim() ||
      null;

    let snippet = null;
    if (metaDesc && metaDesc.trim()) {
      snippet = metaDesc.trim();
    }

    const hasUsefulSnippet = !!snippet && snippet.length > 10;
    const showFullDetails = !hasUsefulSnippet;

    let docTitle = document.title || '';
    if (location.hostname.includes('google.') && docTitle.endsWith(' - Google Search')) {
      docTitle = docTitle.replace(/ - Google Search$/, '');
    }

    let finalUrl = window.location.href;
    try {
      const parsed = new URL(finalUrl);
      if (parsed.hostname.includes('google.') && parsed.pathname === '/search') {
        finalUrl = `${parsed.protocol}//${parsed.hostname}`;
      }
    } catch (e) {}

    return {
      url: finalUrl,
      title: docTitle,
      text: text || '',
      metaDescription: metaDesc,
      snippet: hasUsefulSnippet ? snippet : null,
      showFullDetails,
      favicon: getFaviconUrl(),
      timestamp: new Date().toISOString(),
    };
  }

  async function saveIfChanged(pageData) {
    if (!safeStorageAvailable()) return;
    if (!chrome?.runtime?.id) return;
    try {
      chrome.storage.local.get(['currentPageData'], (res) => {
        const prev = res?.currentPageData || null;
        if (!prev || !deepEqual(prev, pageData)) {
          try {
            chrome.storage.local.set({ currentPageData: pageData }, () => {
              try {
                chrome.runtime.sendMessage?.({ action: 'pageData', data: pageData }, () => {});
              } catch (e) {}
            });
          } catch (e) {
            console.warn('storage write failed', e);
          }
        }
      });
    } catch (e) {
      console.warn('storage write failed outer', e);
    }
  }

  async function extractAndStore() {
    const pd = await buildPageData();
    await saveIfChanged(pd);
    return pd;
  }

  // ---------- UI injection ----------
  function createExtensionUI() {
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
      </svg>`;
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
      </svg>`;
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
      </svg>`;
    container.appendChild(dragHandle);

    const popup = document.createElement('div');
    popup.className = 'magical-extension-popup';
    popup.innerHTML = `<iframe src="${chrome.runtime.getURL('popup.html')}" id="popupFrame"></iframe>`;

    document.body.appendChild(container);
    document.body.appendChild(popup);

    return { container, icon, dragHandle, popup, hoverCloseButton };
  }

  // ---------- Initialization & SPA handling ----------
  let extensionUI = null;
  function initUI() {
    if (extensionUI) {
      try { extensionUI.container.remove(); } catch (e) {}
      try { extensionUI.popup.remove(); } catch (e) {}
    }
    extensionUI = createExtensionUI();
    const { container, icon, dragHandle, popup, hoverCloseButton } = extensionUI;
    
    // FIX: Set initial logged-in state for the container
    if (safeStorageAvailable()) {
      chrome.storage.local.get('isLoggedIn', ({ isLoggedIn }) => {
        if (isLoggedIn) container.classList.add('logged-in');
      });
    }

    let isDragging = false;
    let initialTop = 0;
    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      initialTop = container.offsetTop || 0;
      const startY = e.clientY;
      container.style.cursor = 'grabbing';
      e.preventDefault();
      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const newTop = Math.max(
          10,
          Math.min(
            initialTop + (moveEvent.clientY - startY),
            window.innerHeight - container.offsetHeight - 10
          )
        );
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

    icon.addEventListener('click', async () => {
      if (isDragging) return;
      await extractAndStore();
      container.classList.add('hidden');
      popup.style.display = 'block';
      const frame = document.getElementById('popupFrame');
      if (frame) frame.contentWindow.postMessage('updateData', '*');
    });

    hoverCloseButton.addEventListener('click', (e) => {
      e.stopPropagation();
      container.style.display = 'none';
    });

    window.addEventListener('message', async (evt) => {
      if (evt.data === 'closePopup') {
        const frame = document.getElementById('popupFrame');
        if (frame) frame.contentWindow.postMessage('closedFromContent', '*');
        if (extensionUI) {
          extensionUI.popup.style.display = 'none';
          extensionUI.container.classList.remove('hidden');
        }
      } else if (evt.data === 'updateData') {
        await extractAndStore();
      }
    });
  }

  function debounce(fn, wait = 400) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  const startObservers = (onChange) => {
    const observer = new MutationObserver(debounce(onChange, 350));
    try {
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    const wrapHistory = (type) => {
      const orig = history[type];
      return function () {
        const rv = orig.apply(this, arguments);
        onChange();
        return rv;
      };
    };
    history.pushState = wrapHistory('pushState');
    history.replaceState = wrapHistory('replaceState');
    window.addEventListener('popstate', () => onChange());
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        onChange();
      }
    }, 1000);
  };

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, respond) => {
      if (msg && msg.action === 'forceExtract') {
        extractAndStore()
          .then((pd) => respond && respond({ status: 'ok', data: pd }))
          .catch(() => respond && respond({ status: 'err' }));
        return true;
      }
    });

    // FIX: Listen for login state changes to update the main container class
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.isLoggedIn && extensionUI && extensionUI.container) {
        if (changes.isLoggedIn.newValue === true) {
          extensionUI.container.classList.add('logged-in');
        } else {
          extensionUI.container.classList.remove('logged-in');
        }
      }
    });
  }

  function start() {
    try {
      initUI();
    } catch (e) {
      console.warn('initUI error', e);
    }
    extractAndStore().catch(() => {});
    startObservers(() => {
      debouncedExtract();
    });
  }

  const debouncedExtract = debounce(() => extractAndStore(), 500);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    window.addEventListener('load', start);
  }
})();