document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Element References ---
  const getEl = (id) => document.getElementById(id);
  const query = (sel) => document.querySelector(sel);

  const ui = {
    favicon: query(".site-favicon"),
    title: query(".extension-title"),
    desc: query(".site-description"),
    snippet: query(".content-snippet"),
    fullContent: query(".full-content"),
    fullDetails: query(".full-details"),
    snippetUrl: query(".snippet-url"),
    closeBtn: getEl("popupCloseBtn"),
    mainActionButton: getEl("mainActionButton"),
    userProfile: query(".user-profile"),
    userAvatar: getEl("userAvatar"),
    userMenu: getEl("userMenu"),
    userMenuName: getEl("userMenuName"),
    userMenuEmail: getEl("userMenuEmail"),
    logoutButton: getEl("logoutButton"),
  };

  const forms = {
    login: getEl("loginForm"),
    forgotPassword: getEl("forgotPasswordForm"),
  };

  const passwordStrengthUI = {
    login: getEl("loginPasswordStrength"),
  };

  // --- State & Config ---
  let lastData = null;
  const VALID_USER = { email: "kashifnazim127@gmail.com", password: "Hafiz@786", name: "Kashif Nazim", avatarUrl: "" };
  const PASSWORD_REQUIREMENTS = { minLength: 8, upper: 1, lower: 1, num: 1, special: 1 };
  const SPECIAL_CHARS_REGEX = new RegExp(`[${'!@#$%^&*()_+-=[]{}|;:,.<>?'.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);

  // --- Helper Functions ---
  const storage = {
    get: (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve)),
    set: (data) => new Promise(resolve => chrome.storage.local.set(data, resolve)),
    remove: (keys) => new Promise(resolve => chrome.storage.local.remove(keys, resolve)),
  };

  const getInitials = (name = '') => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const showToast = (text, type = 'error', duration = 3000) => {
    const toastContainer = getEl('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = text;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  };

  const showAuthForm = (formEl) => {
    Object.values(forms).forEach(form => form.style.display = 'none');
    formEl.style.display = 'block';
    ui.mainActionButton.style.display = 'none';
  };

  const applyExpandedState = (expanded) => {
    ui.fullDetails.style.display = expanded ? "block" : "none";
    ui.mainActionButton.textContent = expanded ? "Show Less" : "Show Full Analysis";
    ui.mainActionButton.setAttribute("aria-expanded", String(expanded));
  };

  const updatePasswordStrengthUI = (password, strengthEl, inputEl = null) => {
    if (password.length === 0) {
      strengthEl.style.display = 'none';
      if (inputEl) inputEl.classList.remove('input-error');
      return true;
    }

    let strength = 0;
    if (password.length >= PASSWORD_REQUIREMENTS.minLength) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (SPECIAL_CHARS_REGEX.test(password)) strength++;

    strengthEl.style.display = 'block';
    const strengthClass = strength <= 2 ? 'weak' : strength <= 4 ? 'medium' : 'strong';
    strengthEl.className = `password-strength ${strengthClass}`;

    const isStrong = strength >= 4;
    if (inputEl) inputEl.classList.toggle('input-error', !isStrong);
    return isStrong;
  };

  const updateUIForAuthState = (isLoggedIn, userData) => {
    ui.closeBtn.style.display = isLoggedIn ? 'none' : 'flex';
    
    ui.userProfile.style.display = isLoggedIn ? 'block' : 'none';
    if (isLoggedIn && userData) {
      ui.userAvatar.textContent = getInitials(userData.name);
      ui.userMenuName.textContent = userData.name || '';
      ui.userMenuEmail.textContent = userData.email || '';
      Object.values(forms).forEach(form => form.style.display = 'none');
    } else {
      ui.userMenu.style.display = 'none';
      ui.fullDetails.style.display = 'none';
      ui.snippet.style.display = 'none';
    }
  };

  const updateUIFromData = async (pageData) => {
    if (!pageData || JSON.stringify(lastData) === JSON.stringify(pageData)) return;
    lastData = pageData;

    ui.favicon.src = pageData.favicon || chrome.runtime.getURL("icons/icon48.png");
    ui.title.textContent = pageData.title?.trim().split(/\s+/).slice(0, 2).join(" ") || "";
    ui.title.title = pageData.title || "";
    try {
      const url = new URL(pageData.url);
      ui.desc.textContent = url.hostname;
      ui.desc.title = pageData.url;
      ui.snippetUrl.innerHTML = `<a href="${pageData.url}" target="_blank" rel="noopener noreferrer">${url.hostname.includes("google.") ? url.hostname : pageData.url}</a>`;
    } catch {
      ui.desc.textContent = "";
    }

    const snippetText = (pageData.metaDescription || pageData.snippet || "").trim();
    ui.snippet.textContent = snippetText;
    ui.fullContent.textContent = pageData.text || "";

    const hasFullContent = pageData.text?.trim().length > 20;
    
    const authFormVisible = Object.values(forms).some(form => form.style.display === 'block');
    if (hasFullContent && !authFormVisible) {
      ui.mainActionButton.style.display = "inline-block";
    } else {
      ui.mainActionButton.style.display = "none";
    }

    const { user, isLoggedIn } = await storage.get(['user', 'isLoggedIn']);
    updateUIForAuthState(isLoggedIn, user);
    ui.snippet.style.display = isLoggedIn && snippetText ? "block" : "none";

    const { popupUIState } = await storage.get("popupUIState");
    const shouldExpand = popupUIState?.expanded ?? (pageData.showFullDetails && hasFullContent && isLoggedIn);
    applyExpandedState(shouldExpand);

    if (isLoggedIn && ui.fullDetails.dataset.pendingView === 'true') {
      applyExpandedState(true);
      await storage.set({ popupUIState: { expanded: true } });
      ui.fullDetails.dataset.pendingView = 'false';
    }
  };

  // --- Event Handlers ---
  ui.mainActionButton.addEventListener("click", async () => {
    const { isLoggedIn } = await storage.get('isLoggedIn');
    if (isLoggedIn) {
      const isExpanded = ui.mainActionButton.getAttribute("aria-expanded") === "true";
      applyExpandedState(!isExpanded);
      await storage.set({ popupUIState: { expanded: !isExpanded } });
    } else {
      ui.fullDetails.dataset.pendingView = 'true';
      showAuthForm(forms.login);
    }
  });

  document.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    switch (e.target.id) {
      case 'authForm':
        if (data.email.trim() === VALID_USER.email && data.password === VALID_USER.password) {
          Object.values(forms).forEach(form => form.style.display = 'none');
          updateUIForAuthState(true, VALID_USER);
          
          if (ui.fullDetails.dataset.pendingView === 'true') {
              applyExpandedState(true);
              ui.fullDetails.dataset.pendingView = 'false';
          }
          
          ui.mainActionButton.style.display = 'inline-block';

          await storage.set({ 
              user: VALID_USER, 
              isLoggedIn: true,
              popupUIState: { expanded: ui.fullDetails.style.display === 'block' }
          });
        } else {
            showToast('Invalid email or password.');
        }
        break;
      case 'forgotPasswordFormElement':
        showToast('If this email is registered, you will receive reset instructions.', 'success');
        setTimeout(() => showAuthForm(forms.login), 2000);
        break;
    }
  });

  document.addEventListener('click', (e) => {
    const targetId = e.target.id;
    if (targetId.startsWith('show') || targetId.startsWith('backTo')) e.preventDefault();
    
    switch (targetId) {
      case 'backToSignInLink': showAuthForm(forms.login); break;
      case 'forgotPasswordLink': showAuthForm(forms.forgotPassword); break;
      case 'logoutButton':
        // FIX: Immediately show the header close button on sign out.
        ui.closeBtn.style.display = 'flex';

        ui.fullDetails.style.display = 'none';
        ui.snippet.style.display = 'none';
        ui.userProfile.style.display = 'none';
        applyExpandedState(false);

        storage.remove(['user', 'isLoggedIn', 'popupUIState']).then(() => {
            showToast('You have been signed out.', 'success');
        });
        break;
      case 'userAvatar':
        e.stopPropagation();
        ui.userMenu.style.display = ui.userMenu.style.display === 'none' ? 'block' : 'none';
        break;
      case 'popupCloseBtn':
        window.parent.postMessage("closePopup", "*");
        break;
    }
    
    if (!ui.userProfile.contains(e.target)) {
        ui.userMenu.style.display = 'none';
    }
  });
  
  getEl('loginPassword').addEventListener('input', (e) => updatePasswordStrengthUI(e.target.value, passwordStrengthUI.login));
  
  // --- Initialization ---
  const init = async () => {
    const { currentPageData } = await storage.get("currentPageData");
    await updateUIFromData(currentPageData);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.currentPageData) updateUIFromData(changes.currentPageData.newValue);
        if (changes.user || changes.isLoggedIn) init();
      }
    });
  };

  init();
});