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
  // Change this line:
icon.innerHTML = `
<img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="IM" class="icon-content iim-logo" width="40" height="40">
<svg class="icon-content back-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="15 18 9 12 15 6"></polyline>
</svg>
`;
  container.appendChild(icon);

  const dragHandle = document.createElement('div');
  dragHandle.className = 'magical-drag-handle';
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

  document.body.appendChild(container);

  const popup = document.createElement('div');
  popup.className = 'magical-extension-popup';
  popup.innerHTML = `
    <iframe src="${chrome.runtime.getURL('popup.html')}"></iframe>
  `;

  // Move close button outside popup, fixed position
  const popupCloseButton = document.createElement('button');
  popupCloseButton.className = 'magical-popup-external-close';
  popupCloseButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  document.body.appendChild(popupCloseButton); // Outside popup

  document.body.appendChild(popup);

  return { container, icon, dragHandle, popup, popupCloseButton, hoverCloseButton };
};

const initExtension = () => {
  const { container, icon, dragHandle, popup, popupCloseButton, hoverCloseButton } = createExtensionUI();

  let isDragging = false;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    let startY = e.clientY;
    let initialTop = container.offsetTop;
    container.style.cursor = 'grabbing';
    e.preventDefault();

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;
      const deltaY = moveEvent.clientY - startY;
      let newTop = initialTop + deltaY;
      const minY = 0;
      const maxY = window.innerHeight - container.offsetHeight;
      newTop = Math.max(minY, Math.min(newTop, maxY));
      container.style.top = `${newTop}px`;
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  
  // Update the icon click handler to:
icon.addEventListener('click', async () => {
  if (!isDragging) {
    container.classList.add('hidden');
    popup.style.display = 'block';
    popupCloseButton.style.display = 'flex';
    
    // Position close button next to popup
    const popupRect = popup.getBoundingClientRect();
    popupCloseButton.style.right = `${window.innerWidth - popupRect.right + 10}px`;
    popupCloseButton.style.top = `${popupRect.top}px`;

    // Get fresh page data every time
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

  popupCloseButton.addEventListener('click', () => {
    popup.style.display = 'none';
    popupCloseButton.style.display = 'none';
    container.classList.remove('hidden');
  });

  hoverCloseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    container.style.display = 'none';
  });
};

if (document.readyState === 'complete') {
  initExtension();
} else {
  window.addEventListener('load', initExtension);
}