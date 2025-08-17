const createExtensionUI = () => {
  const container = document.createElement('div');
  container.className = 'magical-extension-container';

  const hoverCloseButton = document.createElement('div');
  hoverCloseButton.className = 'magical-hover-close';
  hoverCloseButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  container.appendChild(hoverCloseButton);

  const icon = document.createElement('div');
  icon.className = 'magical-extension-icon';
  icon.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="IM" class="icon-content iim-logo" width="40" height="40">
    <svg class="icon-content back-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `;
  container.appendChild(icon);

  const dragHandle = document.createElement('div');
  dragHandle.className = 'magical-drag-handle';
  // REVERTED: Keep original dots SVG as requested
  dragHandle.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="14" viewBox="0 0 16 24" fill="#6c757d">
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

const initExtension = () => {
  if (extensionUI) {
    extensionUI.container.remove();
    extensionUI.popup.remove();
  }
  extensionUI = createExtensionUI();

  const { container, icon, dragHandle, popup, hoverCloseButton } = extensionUI;

  let isDragging = false;
  let initialTop = null;

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
      const maxY = window.innerHeight - container.offsetHeight - 10; // Minimum 10px from bottom
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
  
  icon.addEventListener('click', async () => {
    if (!isDragging) {
      container.classList.add('hidden');
      popup.style.display = 'block';
      const frame = document.getElementById('popupFrame');
      if (frame) {
        frame.contentWindow.postMessage('updateData', '*');
      }
      
      const pageData = {
        url: window.location.href,
        title: document.title,
        text: document.body.innerText.trim(),
        favicon: document.querySelector('link[rel*="icon"]')?.href || `${window.location.origin}/favicon.ico`,
        metaDescription: document.querySelector('meta[name="description"]')?.content || '',
        timestamp: new Date().toISOString()
      };
      
      try {
        await chrome.runtime.sendMessage({ action: "pageData", data: pageData });
      } catch (error) {
        console.error("Error sending page data:", error);
      }
    }
  });

  hoverCloseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    container.style.display = 'none';
  });

  window.addEventListener('message', (event) => {
    if (event.data === 'closePopup') {
      popup.style.display = 'none';
      container.classList.remove('hidden');
      initExtension(); // Reinitialize to handle multiple cycles
    } else if (event.data === 'updateData') {
      icon.click(); // Trigger data update on reopen
    }
  });
};

if (document.readyState === 'complete') {
  initExtension();
} else {
  window.addEventListener('load', initExtension);
}