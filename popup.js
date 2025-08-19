document.addEventListener("DOMContentLoaded", () => {
  // --- ORIGINAL DOM REFERENCES ---
  const loadingEl = document.getElementById("loading");
  const faviconEl = document.querySelector(".site-favicon");
  const titleEl = document.querySelector(".extension-title");
  const descEl = document.querySelector(".site-description");
  const snippetEl = document.querySelector(".content-snippet");
  const fullEl = document.querySelector(".full-content");
  const closeBtn = document.getElementById("popupCloseBtn");
  const fullDetails = document.querySelector(".full-details");
  const snippetUrlEl = document.querySelector(".snippet-url");

  // --- NEW AUTH DOM REFERENCES ---
  const mainActionButton = document.getElementById("mainActionButton");
  const userProfileEl = document.querySelector(".user-profile");
  const userAvatarEl = document.getElementById("userAvatar");
  const userMenuEl = document.getElementById("userMenu");
  const userMenuNameEl = document.getElementById("userMenuName");
  const userMenuEmailEl = document.getElementById("userMenuEmail");
  const logoutButton = document.getElementById("logoutButton");
  const loginFormEl = document.getElementById("loginForm");
  const signupFormEl = document.getElementById("signupForm");
  const forgotPasswordFormEl = document.getElementById("forgotPasswordForm");
  const authFormEl = document.getElementById("authForm");
  const signupFormElementEl = document.getElementById("signupFormElement");
  const forgotPasswordFormElementEl = document.getElementById("forgotPasswordFormElement");
  const showSignUpLink = document.getElementById("showSignUpLink");
  const showSignInLink = document.getElementById("showSignInLink");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const backToSignInLink = document.getElementById("backToSignInLink");
  const closeLoginForm = document.getElementById("closeLoginForm");
  const closeSignupForm = document.getElementById("closeSignupForm");
  const closeForgotPasswordForm = document.getElementById("closeForgotPasswordForm");
  const authMessageEl = document.getElementById("authMessage");
  const loginPasswordStrength = document.getElementById("loginPasswordStrength");
  const signupPasswordStrength = document.getElementById("signupPasswordStrength");

  let lastData = null;
  let isUserLoggedIn = false;
  let isFullViewActive = false;

  // --- PASSWORD VALIDATION CONFIG ---
  const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true
  };

  const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // --- VALID USER CREDENTIALS ---
  const VALID_USER = {
    email: "kashifnazim127@gmail.com",
    password: "Hafiz@786",
    name: "Kashif Nazim",
    avatarUrl: "" // Will use default icon
  };

  // --- ORIGINAL HELPER FUNCTIONS ---
  const setLoading = (isLoading) => (loadingEl.style.display = isLoading ? "block" : "none");

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
      mainActionButton.textContent = "Show Less";
      mainActionButton.setAttribute("aria-expanded", "true");
      isFullViewActive = true;
    } else {
      fullDetails.style.display = "none";
      mainActionButton.textContent = "Show Full Analysis";
      mainActionButton.setAttribute("aria-expanded", "false");
      isFullViewActive = false;
    }
  }

  // --- NEW AUTH HELPER FUNCTIONS ---
  const hideAllAuthForms = () => {
    loginFormEl.style.display = 'none';
    signupFormEl.style.display = 'none';
    forgotPasswordFormEl.style.display = 'none';
    hideMessage();
  };

  const showAuthForm = (formEl) => {
    hideAllAuthForms();
    formEl.style.display = 'block';
  };

  const showMessage = (text, type = 'error') => {
    authMessageEl.textContent = text;
    authMessageEl.className = `message ${type}`;
    authMessageEl.style.display = 'block';
  };

  const hideMessage = () => {
    authMessageEl.style.display = 'none';
  };

  function getAuthState(cb) {
    safeGetStorage(['user', 'isLoggedIn'], (items) => {
      cb(items);
    });
  }

  function setAuthState(userData, loggedIn) {
    chrome.storage.local.set({ user: userData, isLoggedIn: loggedIn });
  }

  function clearAuthState() {
    chrome.storage.local.remove(['user', 'isLoggedIn']);
  }

  function updateUIForAuthState(loggedIn, userData) {
    isUserLoggedIn = loggedIn;
    
    if (loggedIn && userData) {
      // User is logged in
      userProfileEl.style.display = 'block';
      userAvatarEl.src = userData.avatarUrl || chrome.runtime.getURL('icons/icon48.png');
      userAvatarEl.alt = userData.name || 'User Avatar';
      userMenuNameEl.textContent = userData.name || '';
      userMenuEmailEl.textContent = userData.email || '';
      mainActionButton.textContent = 'Show Full Analysis';
      hideAllAuthForms();
      
      // Show content snippet if available
      if (snippetEl.textContent && snippetEl.textContent.trim().length > 0) {
        snippetEl.style.display = "block";
      }
      
      // If we were trying to see content, show it now
      if (fullDetails.dataset.pendingView === 'true') {
        applyExpandedState(true);
        setPopupUIState(true);
        fullDetails.dataset.pendingView = 'false';
      }
    } else {
      // User is not logged in
      userProfileEl.style.display = 'none';
      userAvatarEl.src = '';
      userMenuEl.style.display = 'none';
      mainActionButton.textContent = 'Show Full Analysis';
      fullDetails.style.display = 'none';
      snippetEl.style.display = 'none'; // Hide content snippet
      mainActionButton.setAttribute("aria-expanded", "false");
      isFullViewActive = false;
      
      // Hide auth forms unless we are in the middle of a flow
      if (fullDetails.dataset.pendingView !== 'true') {
        hideAllAuthForms();
      }
    }
  }

  // --- PASSWORD VALIDATION FUNCTIONS ---
  function validatePasswordStrength(password) {
    let strength = 0;
    let messages = [];
    
    // Length check
    if (password.length >= PASSWORD_REQUIREMENTS.minLength) {
      strength += 1;
    } else {
      messages.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
    }
    
    // Uppercase check
    if (PASSWORD_REQUIREMENTS.requireUppercase && /[A-Z]/.test(password)) {
      strength += 1;
    } else if (PASSWORD_REQUIREMENTS.requireUppercase) {
      messages.push("One uppercase letter");
    }
    
    // Lowercase check
    if (PASSWORD_REQUIREMENTS.requireLowercase && /[a-z]/.test(password)) {
      strength += 1;
    } else if (PASSWORD_REQUIREMENTS.requireLowercase) {
      messages.push("One lowercase letter");
    }
    
    // Number check
    if (PASSWORD_REQUIREMENTS.requireNumber && /[0-9]/.test(password)) {
      strength += 1;
    } else if (PASSWORD_REQUIREMENTS.requireNumber) {
      messages.push("One number");
    }
    
    // Special character check
    if (PASSWORD_REQUIREMENTS.requireSpecialChar && new RegExp(`[${SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password)) {
      strength += 1;
    } else if (PASSWORD_REQUIREMENTS.requireSpecialChar) {
      messages.push("One special character");
    }
    
    return { strength, messages };
  }
  
  function updatePasswordStrengthUI(password, strengthElement, inputElement = null) {
    const { strength, messages } = validatePasswordStrength(password);
    
    strengthElement.textContent = '';
    strengthElement.className = 'password-strength';
    
    if (password.length === 0) {
      strengthElement.style.display = 'none';
      if (inputElement) inputElement.classList.remove('input-error');
      return true;
    }
    
    strengthElement.style.display = 'block';
    
    let strengthClass = '';
    if (strength <= 2) {
      strengthClass = 'weak';
    } else if (strength <= 4) {
      strengthClass = 'medium';
    } else {
      strengthClass = 'strong';
    }
    
    strengthElement.classList.add(strengthClass);
    
    if (inputElement) {
      if (strength >= 4) {
        inputElement.classList.remove('input-error');
        return true;
      } else {
        inputElement.classList.add('input-error');
        return false;
      }
    }
    
    return strength >= 4;
  }

  // --- ORIGINAL updateUIFromData FUNCTION ---
  function updateUIFromData(pageData) {
    if (!pageData) return;
    try {
      if (lastData && JSON.stringify(lastData) === JSON.stringify(pageData)) {
        return;
      }
    } catch (e) {}
    lastData = pageData;

    faviconEl.src = pageData.favicon || chrome.runtime.getURL("icons/icon48.png");
    if (pageData.title) {
      const words = pageData.title.trim().split(/\s+/);
      titleEl.textContent = words.slice(0, 2).join(" ");
      titleEl.setAttribute("title", pageData.title);
    } else {
      titleEl.textContent = "";
      titleEl.setAttribute("title", "");
    }
    try {
      descEl.textContent = new URL(pageData.url).hostname || "";
      descEl.setAttribute("title", pageData.url || "");
    } catch {
      descEl.textContent = "";
    }
    let snippetText = "";
    if (pageData.metaDescription && pageData.metaDescription.trim()) {
      snippetText = pageData.metaDescription.trim();
    } else if (pageData.snippet && pageData.snippet.trim()) {
      snippetText = pageData.snippet.trim();
    }
    if (snippetText.length > 0) {
      snippetEl.textContent = snippetText;
      // Only show snippet if user is logged in
      getAuthState(({ isLoggedIn }) => {
        if (isLoggedIn) {
          snippetEl.style.display = "block";
        } else {
          snippetEl.style.display = "none";
        }
      });
    } else {
      snippetEl.style.display = "none";
      snippetEl.textContent = "";
    }
    let displayUrl = pageData.url || "";
    try {
      const parsed = new URL(displayUrl);
      if (parsed.hostname.includes("google.") && parsed.pathname === "/search") {
        displayUrl = parsed.hostname;
      }
    } catch (e) {}
    if (snippetUrlEl) {
      snippetUrlEl.innerHTML = `<a href="${pageData.url}" target="_blank" rel="noopener noreferrer">${displayUrl}</a>`;
    }
    fullEl.textContent = pageData.text || "";
    const hasFull = !!(pageData.text && pageData.text.trim().length > 20);
    if (!hasFull) {
      mainActionButton.style.display = "none";
      fullDetails.style.display = "none";
    } else {
      mainActionButton.style.display = "inline-block";
    }
    
    // Check auth state to update the button and profile
    getAuthState(({ user, isLoggedIn }) => {
      updateUIForAuthState(isLoggedIn, user);
      // Then apply the expanded state based on user preference
      getPopupUIState((ui) => {
        const expandedPref = ui?.expanded;
        if (expandedPref === null || expandedPref === undefined) {
          applyExpandedState(!!pageData.showFullDetails && hasFull && isLoggedIn);
        } else {
          applyExpandedState(!!expandedPref && hasFull && isLoggedIn);
        }
      });
    });
    setLoading(false);
  }

  // --- INITIALIZATION ---
  setLoading(true);
  safeGetStorage(["currentPageData"], (items) => {
    updateUIFromData(items?.currentPageData ?? null);
    setLoading(false);
  });

  // --- STORAGE AND MESSAGE LISTENERS ---
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.currentPageData) {
        updateUIFromData(changes.currentPageData.newValue);
      }
      if (area === "local" && changes.popupUIState) {
        const ui = changes.popupUIState.newValue || { expanded: null };
        chrome.storage.local.get("currentPageData", ({ currentPageData }) => {
          if (!currentPageData) return;
          const hasFull = !!(currentPageData.text && currentPageData.text.trim().length > 20);
          applyExpandedState(!!ui.expanded && hasFull && isUserLoggedIn);
        });
      }
      // Listen for auth state changes
      if (area === 'local' && (changes.user || changes.isLoggedIn)) {
        getAuthState(({ user, isLoggedIn }) => {
          updateUIForAuthState(isLoggedIn, user);
        });
      }
    });
  }

  window.addEventListener("message", (e) => {
    if (e.data === "updateData") {
      setLoading(true);
      safeGetStorage(["currentPageData"], (items) => {
        updateUIFromData(items?.currentPageData ?? null);
        setLoading(false);
      });
    }
  });

  // --- MAIN ACTION BUTTON LOGIC ---
  mainActionButton.addEventListener("click", () => {
    const isExpanded = mainActionButton.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      applyExpandedState(false);
      setPopupUIState(false);
    } else {
      getAuthState(({ isLoggedIn }) => {
        if (isLoggedIn) {
          applyExpandedState(true);
          setPopupUIState(true);
        } else {
          fullDetails.dataset.pendingView = 'true';
          showAuthForm(loginFormEl);
        }
      });
    }
  });

  // --- AUTH FORM EVENT HANDLERS ---
  authFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    hideMessage();
    
    const formData = new FormData(e.target);
    const email = formData.get('email').trim();
    const password = formData.get('password');
    
    // Validate credentials
    if (email === VALID_USER.email && password === VALID_USER.password) {
      setAuthState(VALID_USER, true);
      showMessage('Login successful!', 'success');
      setTimeout(() => hideMessage(), 2000);
    } else {
      showMessage('Invalid email or password. Please try again.');
    }
  });

  signupFormElementEl.addEventListener('submit', (e) => {
    e.preventDefault();
    hideMessage();
    
    const formData = new FormData(e.target);
    const name = formData.get('name').trim();
    const email = formData.get('email').trim();
    const password = formData.get('password');
    
    // Validate password strength
    const isPasswordStrong = updatePasswordStrengthUI(password, signupPasswordStrength, document.getElementById('signupPassword'));
    
    if (!isPasswordStrong) {
      showMessage('Please use a stronger password that meets all requirements.');
      return;
    }
    
    // Check if email is already registered (in this case, just the one valid user)
    if (email === VALID_USER.email) {
      showMessage('This email is already registered. Please sign in instead.');
      return;
    }
    
    // In a real app, you would send this to your backend
    showMessage('Account created successfully! Please check your email to verify your account.', 'success');
    
    // Simulate successful registration
    const newUser = { name, email, avatarUrl: "" };
    setTimeout(() => {
      setAuthState(newUser, true);
    }, 1500);
  });

  forgotPasswordFormElementEl.addEventListener('submit', (e) => {
    e.preventDefault();
    hideMessage();
    
    const formData = new FormData(e.target);
    const email = formData.get('email').trim();
    
    if (email === VALID_USER.email) {
      showMessage('Password reset instructions have been sent to your email.', 'success');
      setTimeout(() => showAuthForm(loginFormEl), 2000);
    } else {
      showMessage('If this email is registered, you will receive reset instructions.');
      setTimeout(() => showAuthForm(loginFormEl), 2000);
    }
  });

  // --- PASSWORD STRENGTH REAL-TIME VALIDATION ---
  document.getElementById('signupPassword').addEventListener('input', (e) => {
    updatePasswordStrengthUI(e.target.value, signupPasswordStrength, e.target);
  });

  document.getElementById('loginPassword').addEventListener('input', (e) => {
    if (e.target.value.length > 0) {
      loginPasswordStrength.style.display = 'block';
      updatePasswordStrengthUI(e.target.value, loginPasswordStrength);
    } else {
      loginPasswordStrength.style.display = 'none';
    }
  });

  // --- AUTH FORM NAVIGATION LINKS ---
  showSignUpLink.addEventListener('click', (e) => { e.preventDefault(); showAuthForm(signupFormEl); });
  showSignInLink.addEventListener('click', (e) => { e.preventDefault(); showAuthForm(loginFormEl); });
  forgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); showAuthForm(forgotPasswordFormEl); });
  backToSignInLink.addEventListener('click', (e) => { e.preventDefault(); showAuthForm(loginFormEl); });

  // --- CLOSE BUTTONS FOR AUTH FORMS ---
  closeLoginForm.addEventListener('click', () => {
    hideAllAuthForms();
    fullDetails.dataset.pendingView = 'false';
  });
  
  closeSignupForm.addEventListener('click', () => {
    hideAllAuthForms();
  });
  
  closeForgotPasswordForm.addEventListener('click', () => {
    hideAllAuthForms();
  });

  // --- USER PROFILE AND MENU MANAGEMENT ---
  userAvatarEl.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenuEl.style.display = userMenuEl.style.display === 'none' ? 'block' : 'none';
  });

  logoutButton.addEventListener('click', () => {
    clearAuthState();
    userMenuEl.style.display = 'none';
    showMessage('You have been signed out.', 'success');
    setTimeout(() => hideMessage(), 2000);
  });

  // Close user menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!userProfileEl.contains(e.target)) {
      userMenuEl.style.display = 'none';
    }
  });

  // --- ORIGINAL CLOSE BUTTON AND FALLBACK ---
  closeBtn.addEventListener("click", () => {
    window.parent.postMessage("closePopup", "*");
  });
  
  faviconEl.onerror = function () {
    this.src = chrome.runtime.getURL("icons/icon16.png");
  };
});