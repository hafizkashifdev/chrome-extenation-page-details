document.addEventListener("DOMContentLoaded", () => {
  const loadingEl = document.getElementById("loading");
  const faviconEl = document.querySelector(".site-favicon");
  const titleEl = document.querySelector(".extension-title");
  const descEl = document.querySelector(".site-description");
  const snippetEl = document.querySelector(".content-snippet");
  const fullEl = document.querySelector(".full-content");
  const toggleBtn = document.querySelector(".toggle-details-btn");
  const closeBtn = document.querySelector(".close-btn");
  const fullDetails = document.querySelector(".full-details");
  const snippetUrlEl = document.querySelector(".snippet-url");

  let lastData = null;

  const setLoading = (isLoading) =>
    (loadingEl.style.display = isLoading ? "block" : "none");

  function safeGetStorage(keys, cb) {
    if (!chrome?.storage?.local) {
      cb(null);
      return;
    }
    chrome.storage.local.get(keys, (items) => cb(items));
  }

  function setPopupUIState(expanded) {
    if (!chrome?.storage?.local) return;
    try {
      chrome.storage.local.set({ popupUIState: { expanded } });
    } catch (e) {
      // ignore
    }
  }

  function getPopupUIState(cb) {
    if (!chrome?.storage?.local) {
      cb({ expanded: null });
      return;
    }
    chrome.storage.local.get("popupUIState", (res) => {
      cb(res?.popupUIState ?? { expanded: null });
    });
  }

  function applyExpandedState(expanded) {
    if (expanded) {
      fullDetails.style.display = "block";
      toggleBtn.textContent = "Show Less";
      toggleBtn.setAttribute("aria-expanded", "true");
    } else {
      fullDetails.style.display = "none";
      toggleBtn.textContent = "Show More";
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  }

  function updateUIFromData(pageData) {
    if (!pageData) return;

    // Avoid unnecessary re-render
    try {
      if (lastData && JSON.stringify(lastData) === JSON.stringify(pageData)) {
        return;
      }
    } catch (e) {}

    lastData = pageData;

    // favicon (with fallback)
    faviconEl.src =
      pageData.favicon || chrome.runtime.getURL("icons/icon48.png");

    // ✅ Title → only first 2 words, full in tooltip
    if (pageData.title) {
      const words = pageData.title.trim().split(/\s+/);
      titleEl.textContent = words.slice(0, 2).join(" ");
      titleEl.setAttribute("title", pageData.title);
    } else {
      titleEl.textContent = "";
      titleEl.setAttribute("title", "");
    }

    // description / origin
    try {
      descEl.textContent = new URL(pageData.url).hostname || "";
      descEl.setAttribute("title", pageData.url || "");
    } catch {
      descEl.textContent = "";
    }

    // ✅ Snippet → only show metaDescription or snippet, never full-content
    let snippetText = "";
    if (pageData.metaDescription && pageData.metaDescription.trim()) {
      snippetText = pageData.metaDescription.trim();
    } else if (pageData.snippet && pageData.snippet.trim()) {
      snippetText = pageData.snippet.trim();
    }

    if (snippetText.length > 0) {
      snippetEl.style.display = "block";
      snippetEl.textContent = snippetText;
    } else {
      // nothing useful → hide snippet completely
      snippetEl.style.display = "none";
      snippetEl.textContent = "";
    }

    // URL display
    let displayUrl = pageData.url || "";
    try {
      const parsed = new URL(displayUrl);
      if (
        parsed.hostname.includes("google.") &&
        parsed.pathname === "/search"
      ) {
        displayUrl = parsed.hostname;
      }
    } catch (e) {
      // keep as-is
    }
    if (snippetUrlEl) {
      snippetUrlEl.innerHTML = `<a href="${pageData.url}" target="_blank" rel="noopener noreferrer">${displayUrl}</a>`;
    }

    // Full content
    fullEl.textContent = pageData.text || "";

    // Decide toggle button visibility (only show if there is meaningful full content)
    const hasFull = !!(pageData.text && pageData.text.trim().length > 20);
    if (!hasFull) {
      toggleBtn.style.display = "none";
      fullDetails.style.display = "none";
    } else {
      toggleBtn.style.display = "inline-block";
    }

    // Use stored user preference for expanded state if present; otherwise default to pageData.showFullDetails.
    getPopupUIState((ui) => {
      const expandedPref = ui?.expanded;
      if (expandedPref === null || expandedPref === undefined) {
        applyExpandedState(!!pageData.showFullDetails && hasFull);
      } else {
        applyExpandedState(!!expandedPref && hasFull);
      }
    });

    setLoading(false);
  }

  // initial load
  setLoading(true);
  safeGetStorage(["currentPageData"], (items) => {
    updateUIFromData(items?.currentPageData ?? null);
    setLoading(false);
  });

  // listen for storage changes
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.currentPageData) {
        updateUIFromData(changes.currentPageData.newValue);
      }
      if (area === "local" && changes.popupUIState) {
        const ui = changes.popupUIState.newValue || { expanded: null };
        chrome.storage.local.get("currentPageData", ({ currentPageData }) => {
          if (!currentPageData) return;
          const hasFull = !!(
            currentPageData.text && currentPageData.text.trim().length > 20
          );
          applyExpandedState(!!ui.expanded && hasFull);
        });
      }
    });
  }

  // listen to messages from content script
  window.addEventListener("message", (e) => {
    if (e.data === "updateData") {
      setLoading(true);
      safeGetStorage(["currentPageData"], (items) => {
        updateUIFromData(items?.currentPageData ?? null);
        setLoading(false);
      });
    }
  });

  // toggle button
  toggleBtn.addEventListener("click", () => {
    const isHidden = fullDetails.style.display === "none";
    if (isHidden) {
      fullDetails.style.display = "block";
      toggleBtn.textContent = "Show Less";
      toggleBtn.setAttribute("aria-expanded", "true");
      setPopupUIState(true);
    } else {
      fullDetails.style.display = "none";
      toggleBtn.textContent = "Show More";
      toggleBtn.setAttribute("aria-expanded", "false");
      setPopupUIState(false);
    }
  });

  // close button
  closeBtn.addEventListener("click", () => {
    window.parent.postMessage("closePopup", "*");
  });

  // favicon fallback
  faviconEl.onerror = function () {
    this.src = chrome.runtime.getURL("icons/icon48.png");
  };
});
