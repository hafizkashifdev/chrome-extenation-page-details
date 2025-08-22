document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Element References ---
  const getEl = (id) => document.getElementById(id);
  const query = (sel) => document.querySelector(sel);

  const ui = {
    faviconContainer: query(".favicon-container"),
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
    mainContainer: getEl("mainContainer"),
    assistanceView: getEl("assistanceView"),
    needAssistanceTrigger: getEl("needAssistanceTrigger"),
    backToDetailsBtn: getEl("backToDetailsBtn"),
    breadcrumbDisplay: getEl("breadcrumbDisplay"),
    assistanceSearchInput: getEl("assistanceSearchInput"),
    suggestionsContainer: getEl("suggestionsContainer"),
    sendAssistanceRequest: getEl("sendAssistanceRequest"),
    // Elements for play/pause button
    playPauseBtn: getEl("playPauseBtn"),
    playIcon: query(".play-icon"),
    pauseIcon: query(".pause-icon"),
    tooltipText: query("#playPauseBtn .tooltip-text"),
  };

  const forms = {
    login: getEl("loginForm"),
    forgotPassword: getEl("forgotPasswordForm"),
  };

  const passwordStrengthUI = {
    login: getEl("loginPasswordStrength"),
  };

  // --- State & Config ---
  let isPlaying = false; // State for the play/pause button
  let lastData = null;
  const VALID_USER = { email: "kashifnazim127@gmail.com", password: "Hafiz@786", name: "Kashif Nazim", avatarUrl: "" };
  const PASSWORD_REQUIREMENTS = { minLength: 8, upper: 1, lower: 1, num: 1, special: 1 };
  const SPECIAL_CHARS_REGEX = new RegExp(`[${'!@#$%^&*()_+-=[]{}|;:,.<>?'.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);

  // --- Helper Functions ---
  // MODIFIED: This entire 'storage' object is now a message-passing wrapper
  const storage = {
    sendMessage: (payload) => new Promise((resolve, reject) => {
      if (!chrome.runtime?.id) {
        // Context is already invalidated, reject immediately.
        return reject(new Error("Extension context invalidated."));
      }
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (response && response.status === 'success') {
          // For 'get', the data is in response.data, otherwise it's undefined
          resolve(response.data);
        } else {
          reject(new Error(response?.message || 'An unknown error occurred in the background script.'));
        }
      });
    }),
    get: function(keys) {
      return this.sendMessage({ action: 'getStorage', keys });
    },
    set: function(data) {
      return this.sendMessage({ action: 'setStorage', data });
    },
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
    Object.values(forms).forEach(form => { if(form) form.style.display = 'none'});
    if(formEl) formEl.style.display = 'block';
    if(ui.mainActionButton) ui.mainActionButton.style.display = 'none';
  };

  const applyExpandedState = (expanded) => {
    if (ui.fullDetails) {
        ui.fullDetails.style.display = expanded ? "block" : "none";
    }
    if (ui.mainActionButton) {
        ui.mainActionButton.textContent = expanded ? "Show Less" : "Show Full Analysis";
        ui.mainActionButton.setAttribute("aria-expanded", String(expanded));
    }
  };

  const updatePasswordStrengthUI = (password, strengthEl, inputEl = null) => {
    if (!strengthEl) return;
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
    if(ui.closeBtn) ui.closeBtn.style.display = isLoggedIn ? 'none' : 'flex';
    if(ui.userProfile) ui.userProfile.style.display = isLoggedIn ? 'block' : 'none';
    if(ui.needAssistanceTrigger) ui.needAssistanceTrigger.style.display = isLoggedIn ? 'flex' : 'none';
    // Show/hide the play/pause button based on login state
    if(ui.playPauseBtn) ui.playPauseBtn.style.display = isLoggedIn ? 'flex' : 'none';
    
    if (isLoggedIn && userData) {
      if(ui.userAvatar) ui.userAvatar.textContent = getInitials(userData.name);
      if(ui.userMenuName) ui.userMenuName.textContent = userData.name || '';
      if(ui.userMenuEmail) ui.userMenuEmail.textContent = userData.email || '';
      Object.values(forms).forEach(form => {
          if (form) form.style.display = 'none'
      });
    } else {
      if(ui.userMenu) ui.userMenu.style.display = 'none';
      if(ui.fullDetails) ui.fullDetails.style.display = 'none';
      if(ui.snippet) ui.snippet.style.display = 'none';
    }
  };

  const updateUIFromData = async (pageData) => {
    if (!pageData || JSON.stringify(lastData) === JSON.stringify(pageData)) return;
    lastData = pageData;

    // Clear any previous fallback
    if (ui.faviconContainer) {
      ui.faviconContainer.innerHTML = `<img class="site-favicon" src="" alt="Favicon" width="24" height="24" />`;
      // Re-select the favicon img element after replacing innerHTML
      ui.favicon = ui.faviconContainer.querySelector('.site-favicon');
    }

    if(ui.favicon) {
      ui.favicon.onerror = () => {
        const titleChar = (pageData.title || ' ')[0].toUpperCase();
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'favicon-fallback';
        fallbackDiv.textContent = titleChar;
        
        if (ui.favicon.parentNode) {
            ui.favicon.parentNode.replaceChild(fallbackDiv, ui.favicon);
        }
      };
      
      ui.favicon.src = pageData.favicon || chrome.runtime.getURL("icons/icon48.png");
    }

    if(ui.title) ui.title.textContent = pageData.title?.trim().split(/\s+/).slice(0, 2).join(" ") || "";
    if(ui.title) ui.title.title = pageData.title || "";
    try {
      if(ui.desc) ui.desc.textContent = new URL(pageData.url).hostname;
      if(ui.desc) ui.desc.title = pageData.url;

      let displayUrl = pageData.url.replace(/^https?:\/\//, '');
      if (displayUrl.length > 35) {
          displayUrl = displayUrl.substring(0, 32) + '...';
      }

      if (ui.snippetUrl) {
        ui.snippetUrl.title = pageData.url; 
        ui.snippetUrl.innerHTML = `<a href="${pageData.url}" target="_blank" rel="noopener noreferrer">${displayUrl}</a>`;
      }
      
      if (ui.breadcrumbDisplay) {
        let breadcrumbUrl = pageData.url.replace(/^https?:\/\//, '');
        if (breadcrumbUrl.length > 30) {
            breadcrumbUrl = breadcrumbUrl.substring(0, 27) + '...';
        }
        ui.breadcrumbDisplay.textContent = breadcrumbUrl;
        ui.breadcrumbDisplay.title = pageData.url;
      }
    } catch {
      if(ui.desc) ui.desc.textContent = "";
    }

    const snippetText = (pageData.metaDescription || pageData.snippet || "").trim();
    if(ui.snippet) ui.snippet.textContent = snippetText;
    if(ui.fullContent) ui.fullContent.textContent = pageData.text || "";

    const hasFullContent = pageData.text?.trim().length > 20;
    
    const authFormVisible = Object.values(forms).some(form => form && form.style.display === 'block');
    if (ui.mainActionButton) {
      if (hasFullContent && !authFormVisible) {
        ui.mainActionButton.style.display = "inline-block";
      } else {
        ui.mainActionButton.style.display = "none";
      }
    }

    try {
      const { user, isLoggedIn, popupUIState } = await storage.get(['user', 'isLoggedIn', 'popupUIState']);
      updateUIForAuthState(isLoggedIn, user);
      if(ui.snippet) ui.snippet.style.display = isLoggedIn && snippetText ? "block" : "none";

      const shouldExpand = popupUIState?.expanded ?? (pageData.showFullDetails && hasFullContent && isLoggedIn);
      applyExpandedState(shouldExpand);

      if (isLoggedIn && ui.fullDetails && ui.fullDetails.dataset.pendingView === 'true') {
        applyExpandedState(true);
        await storage.set({ popupUIState: { expanded: true } });
        ui.fullDetails.dataset.pendingView = 'false';
      }
    } catch (error) {
      console.error("Error updating UI from storage data:", error);
    }
  };

  const showAssistanceView = () => {
    if(ui.mainContainer) ui.mainContainer.style.display = 'none';
    if(ui.assistanceView) ui.assistanceView.style.display = 'flex';
    generateSuggestions(lastData ? lastData.text : '');
  };

  const hideAssistanceView = () => {
    if(ui.assistanceView) ui.assistanceView.style.display = 'none';
    if(ui.mainContainer) ui.mainContainer.style.display = 'flex';
  };

  const generateSuggestions = (context = '') => {
    if (!ui.suggestionsContainer) return;
    const suggestions = new Set();
    const lowerContext = context.toLowerCase();

    const suggestionRules = [
        { keywords: ['bug', 'error', 'failed', 'issue', 'crash'], prompt: 'Write a bug description for this issue' },
        { keywords: ['ticket', 'jira', 'sprint', 'task', 'epic'], prompt: 'Summarise this ticket' },
        { keywords: ['ticket', 'jira', 'sprint', 'task', 'epic'], prompt: 'Break down this epic into subtasks' },
        { keywords: ['how to', 'guide', 'steps', 'tutorial'], prompt: 'List the key steps from this guide' },
        { keywords: ['api', 'code', 'function', 'test'], prompt: 'Generate test cases for this' },
        { keywords: ['criteria', 'requirements', 'user story'], prompt: 'Suggest acceptance criteria' },
    ];

    suggestionRules.forEach(rule => {
        if (rule.keywords.some(kw => lowerContext.includes(kw))) {
            suggestions.add(rule.prompt);
        }
    });

    suggestions.add('What are the key points?');
    suggestions.add('Explain this like I am 10');
    suggestions.add('Suggest a title for this page');

    ui.suggestionsContainer.innerHTML = '';
    suggestions.forEach(promptText => {
        if (ui.suggestionsContainer.childElementCount >= 6) return;
        const btn = document.createElement('button');
        btn.className = 'suggestion-btn';
        btn.textContent = promptText;
        ui.suggestionsContainer.appendChild(btn);
    });
  };

  const callChatbotAPI = (prompt, context) => {
    console.log("--- Sending to Chatbot API ---");
    console.log("PROMPT:", prompt);
    showToast("Request sent to chatbot!", 'success');
  };
  
  // --- Event Listeners ---
  if (ui.playPauseBtn) {
    ui.playPauseBtn.addEventListener("click", () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        console.log("Start clock log");
        ui.playIcon.style.display = "none";
        ui.pauseIcon.style.display = "block";
        ui.playPauseBtn.classList.add('playing'); // Add the 'playing' class
        ui.tooltipText.textContent = "Pause Clock Log";
      } else {
        console.log("Pause clock log");
        ui.playIcon.style.display = "block";
        ui.pauseIcon.style.display = "none";
        ui.playPauseBtn.classList.remove('playing'); // Remove the 'playing' class
        ui.tooltipText.textContent = "Start Clock Log";
      }
    });
  }

  if (ui.mainActionButton) {
    ui.mainActionButton.addEventListener("click", async () => {
      try {
        const { isLoggedIn } = await storage.get(['isLoggedIn']);
        if (isLoggedIn) {
          const isExpanded = ui.mainActionButton.getAttribute("aria-expanded") === "true";
          applyExpandedState(!isExpanded);
          await storage.set({ popupUIState: { expanded: !isExpanded } });
        } else {
          if (ui.fullDetails) ui.fullDetails.dataset.pendingView = 'true';
          if (forms.login) showAuthForm(forms.login);
        }
      } catch (error) {
        console.error("Error handling main action button click:", error);
      }
    });
  }

  document.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    switch (e.target.id) {
      case 'authForm':
        if (data.email.trim() === VALID_USER.email && data.password === VALID_USER.password) {
          try {
            Object.values(forms).forEach(form => { if(form) form.style.display = 'none'});
            updateUIForAuthState(true, VALID_USER);
            
            const snippetText = (lastData?.metaDescription || lastData?.snippet || "").trim();
            if (ui.snippet) ui.snippet.style.display = snippetText ? "block" : "none";

            if (ui.fullDetails && ui.fullDetails.dataset.pendingView === 'true') {
                applyExpandedState(true);
                ui.fullDetails.dataset.pendingView = 'false';
            }
            
            if(ui.mainActionButton) ui.mainActionButton.style.display = 'inline-block';

            await storage.set({ 
                user: VALID_USER, 
                isLoggedIn: true,
                popupUIState: { expanded: ui.fullDetails && ui.fullDetails.style.display === 'block' }
            });
          } catch (error) {
            console.error("Error on successful login:", error);
            showToast('An error occurred during login.');
          }
        } else {
            showToast('Invalid email or password.');
        }
        break;
      case 'forgotPasswordFormElement':
        showToast('If this email is registered, you will receive reset instructions.', 'success');
        if(forms.login) setTimeout(() => showAuthForm(forms.login), 2000);
        break;
    }
  });

  document.addEventListener('click', (e) => {
    const targetId = e.target.id;
    if (!e.target || !targetId) return;

    if (targetId.startsWith('show') || targetId.startsWith('backTo')) e.preventDefault();
    
    switch (targetId) {
      case 'backToSignInLink': if(forms.login) showAuthForm(forms.login); break;
      case 'forgotPasswordLink': if(forms.forgotPassword) showAuthForm(forms.forgotPassword); break;
      case 'logoutButton':
        updateUIForAuthState(false, null);
        applyExpandedState(false);
        // MODIFIED: Delegate logout to background script
        chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
          if (chrome.runtime.lastError || response?.status !== 'success') {
            console.error("Logout failed:", chrome.runtime.lastError || response.message);
            showToast('Logout failed. Please try again.');
          } else {
            showToast('You have been signed out.', 'success');
          }
        });
        break;
      case 'userAvatar':
        e.stopPropagation();
        if(ui.userMenu) ui.userMenu.style.display = ui.userMenu.style.display === 'none' ? 'block' : 'none';
        break;
      case 'popupCloseBtn':
        window.parent.postMessage("closePopup", "*");
        break;
    }
    
    if (ui.userProfile && !ui.userProfile.contains(e.target) && ui.userMenu) {
        ui.userMenu.style.display = 'none';
    }
  });

  if (ui.needAssistanceTrigger) ui.needAssistanceTrigger.addEventListener("click", showAssistanceView);
  if (ui.backToDetailsBtn) ui.backToDetailsBtn.addEventListener("click", hideAssistanceView);

  if (ui.suggestionsContainer) {
    ui.suggestionsContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
        if(ui.assistanceSearchInput) ui.assistanceSearchInput.value = e.target.textContent;
        if(ui.assistanceSearchInput) ui.assistanceSearchInput.focus();
        }
    });
  }

  if (ui.sendAssistanceRequest) {
    ui.sendAssistanceRequest.addEventListener("click", () => {
        if(!ui.assistanceSearchInput) return;
        const prompt = ui.assistanceSearchInput.value.trim();
        if (prompt) {
        callChatbotAPI(prompt, lastData ? lastData.text : '');
        ui.assistanceSearchInput.value = '';
        }
    });
  }
  
  const loginPasswordInput = getEl('loginPassword');
  if (loginPasswordInput) {
    loginPasswordInput.addEventListener('input', (e) => updatePasswordStrengthUI(e.target.value, passwordStrengthUI.login));
  }
  
  const init = async () => {
    try {
      // Use the new storage wrapper to get data
      const { currentPageData } = await storage.get("currentPageData");
      if (currentPageData) {
        await updateUIFromData(currentPageData);
      }

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
          if (changes.currentPageData) updateUIFromData(changes.currentPageData.newValue);
          if (changes.user || changes.isLoggedIn) init();
        }
      });
    } catch (err) {
      console.error("Initialization failed:", err);
    }
  };

  init();
});