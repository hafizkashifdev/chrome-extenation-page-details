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
    voiceButton: getEl("voiceButton"),
    // Elements for play/pause button
    playPauseBtn: getEl("playPauseBtn"),
    playIcon: query(".play-icon"),
    pauseIcon: query(".pause-icon"),
    tooltipText: query("#playPauseBtn .tooltip-text"),
    breadcrumbHeader: getEl("breadcrumbHeader"),
    // Preview content elements
    previewContent: getEl("previewContent"),
    previewSnippet: getEl("previewSnippet"),
    contentLength: getEl("contentLength"),
    keyTopics: getEl("keyTopics"),
    // Header layout elements
    brandBar: getEl("brandBar"),
  };

  const forms = {
    login: getEl("loginForm"),
    forgotPassword: getEl("forgotPasswordForm"),
    resetPassword: getEl("resetPasswordForm"),
  };

  const passwordStrengthUI = {
    login: getEl("loginPasswordStrength"),
    newPassword: getEl("newPasswordStrength"),
  };

  // --- State & Config ---
  let isPlaying = false; // State for the play/pause button
  let lastData = null;
  let apiService = null;
  let isInPasswordFlow = false; // Track if user is in password reset flow
  const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    upper: 1,
    lower: 1,
    num: 1,
    special: 1,
  };
  const SPECIAL_CHARS_REGEX = new RegExp(
    `[${"!@#$%^&*()_+-=[]{}|;:,.<>?".replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`
  );

  // --- Helper Functions ---
  // Check if user is currently in password reset flow
  const isInPasswordResetFlow = () => {
    // Use the flag first, then check DOM as fallback
    if (isInPasswordFlow) return true;
    
    const resetPasswordForm = getEl("resetPasswordForm");
    const forgotPasswordForm = getEl("forgotPasswordForm");
    return (resetPasswordForm && resetPasswordForm.style.display === "block") ||
           (forgotPasswordForm && forgotPasswordForm.style.display === "block");
  };

  // Direct storage access functions for popup context with extension context validation
  const storage = {
    get: (keys) => new Promise((resolve, reject) => {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime || !chrome.runtime.id) {
          console.warn("Extension context invalidated, returning empty result");
          resolve({}); // Return empty object instead of rejecting
          return;
        }
        
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            console.warn("Storage get error:", chrome.runtime.lastError.message);
            resolve({}); // Return empty object instead of rejecting
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        console.warn("Storage get failed:", error);
        resolve({}); // Return empty object instead of rejecting
      }
    }),
    set: (data) => new Promise((resolve, reject) => {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime || !chrome.runtime.id) {
          console.warn("Extension context invalidated, skipping storage set");
          resolve(); // Resolve instead of reject to prevent error propagation
          return;
        }
        
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            console.warn("Storage set error:", chrome.runtime.lastError.message);
            resolve(); // Resolve instead of reject to prevent error propagation
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.warn("Storage set failed:", error);
        resolve(); // Resolve instead of reject to prevent error propagation
      }
    }),
    remove: (keys) => new Promise((resolve, reject) => {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime || !chrome.runtime.id) {
          console.warn("Extension context invalidated, skipping storage remove");
          resolve(); // Resolve instead of reject to prevent error propagation
          return;
        }
        
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            console.warn("Storage remove error:", chrome.runtime.lastError.message);
            resolve(); // Resolve instead of reject to prevent error propagation
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.warn("Storage remove failed:", error);
        resolve(); // Resolve instead of reject to prevent error propagation
      }
    })
  };

  const getInitials = (name = "") => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Initialize API service
  const initApiService = async () => {
    if (!apiService) {
      apiService = new ApiService();
      await apiService.init();
    }
    return apiService;
  };

  const showToast = (text, type = "error", duration = 3000) => {
    const toastContainer = getEl("toastContainer");
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = text;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      toast.addEventListener("transitionend", () => toast.remove());
    }, duration);
  };

  const showLoader = (text = "Verifying credentials...") => {
    const loadingOverlay = getEl("loadingOverlay");
    const loadingText = loadingOverlay?.querySelector(".loading-text");
    if (loadingText) loadingText.textContent = text;
    if (loadingOverlay) loadingOverlay.style.display = "flex";
  };

  const hideLoader = () => {
    const loadingOverlay = getEl("loadingOverlay");
    if (loadingOverlay) loadingOverlay.style.display = "none";
  };

  const showAuthForm = (formEl) => {
    // Hide all other sections first
    Object.values(forms).forEach((form) => {
      if (form) form.style.display = "none";
    });
    if (ui.previewContent) ui.previewContent.style.display = "none";
    if (ui.fullDetails) ui.fullDetails.style.display = "none";
    if (ui.snippet) ui.snippet.style.display = "none";
    if (ui.mainActionButton) ui.mainActionButton.style.display = "none";
    
    // Show the requested form
    if (formEl) formEl.style.display = "block";
    
    // Update password flow flag
    isInPasswordFlow = (formEl === forms.forgotPassword || formEl === forms.resetPassword);
  };

  const applyExpandedState = (expanded) => {
    if (ui.fullDetails) {
      ui.fullDetails.style.display = expanded ? "block" : "none";
    }
    if (ui.mainActionButton) {
      ui.mainActionButton.textContent = expanded
        ? "Show Less"
        : "Show Full Analysis";
      ui.mainActionButton.setAttribute("aria-expanded", String(expanded));
    }
  };

  const updatePasswordStrengthUI = (password, strengthEl, inputEl = null) => {
    if (!strengthEl) return;
    if (password.length === 0) {
      strengthEl.style.display = "none";
      if (inputEl) inputEl.classList.remove("input-error");
      return true;
    }

    let strength = 0;
    if (password.length >= PASSWORD_REQUIREMENTS.minLength) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (SPECIAL_CHARS_REGEX.test(password)) strength++;

    strengthEl.style.display = "block";
    const strengthClass =
      strength <= 2 ? "weak" : strength <= 4 ? "medium" : "strong";
    strengthEl.className = `password-strength ${strengthClass}`;

    const isStrong = strength >= 4;
    if (inputEl) inputEl.classList.toggle("input-error", !isStrong);
    return isStrong;
  };

  const updateUIForAuthState = (isLoggedIn, userData) => {
    // Update close button visibility - hide when logged in, show when not logged in
    if (ui.closeBtn) ui.closeBtn.style.display = isLoggedIn ? "none" : "flex";
    
    // Update user profile visibility - show when logged in, hide when not logged in
    if (ui.userProfile)
      ui.userProfile.style.display = isLoggedIn ? "block" : "none";
    
    // Update brand bar positioning based on login state
    if (ui.brandBar) {
      if (isLoggedIn) {
        // When logged in, left-align the brand (avatar is present)
        ui.brandBar.classList.remove("centered");
        ui.brandBar.classList.add("left-aligned");
      } else {
        // When not logged in, center the brand (no avatar)
        ui.brandBar.classList.remove("left-aligned");
        ui.brandBar.classList.add("centered");
      }
    }
    
    if (ui.needAssistanceTrigger)
      ui.needAssistanceTrigger.style.display = isLoggedIn ? "flex" : "none";
    // Show/hide the play/pause button based on login state
    if (ui.playPauseBtn)
      ui.playPauseBtn.style.display = isLoggedIn ? "flex" : "none";

    if (isLoggedIn && userData) {
      // Use API service to get user initials and display name
      const displayName = apiService ? apiService.getUserDisplayName() : (userData.name || userData.email || 'User');
      const initials = apiService ? apiService.getUserInitials() : getInitials(displayName);
      
      if (ui.userAvatar) ui.userAvatar.textContent = initials;
      if (ui.userMenuName) ui.userMenuName.textContent = displayName;
      if (ui.userMenuEmail) ui.userMenuEmail.textContent = userData.email || "";
      
      // Hide all auth forms and preview content when logged in
      Object.values(forms).forEach((form) => {
        if (form) form.style.display = "none";
      });
      if (ui.previewContent) ui.previewContent.style.display = "none";
      
      // Reset password flow flag when user logs in
      isInPasswordFlow = false;
    } else {
      // User is not logged in - hide user-specific elements
      if (ui.userMenu) ui.userMenu.style.display = "none";
      if (ui.fullDetails) ui.fullDetails.style.display = "none";
      if (ui.snippet) ui.snippet.style.display = "none";
      
      // Show the "Show Full Analysis" button for non-logged-in users
      if (ui.mainActionButton) ui.mainActionButton.style.display = "inline-block";
      
      // Hide all auth forms initially
      Object.values(forms).forEach((form) => {
        if (form) form.style.display = "none";
      });
    }
  };

  const showPreviewContent = (pageData) => {
    if (!ui.previewContent || !pageData) return;
    
    // Hide all auth forms when showing preview content
    Object.values(forms).forEach((form) => {
      if (form) form.style.display = "none";
    });
    
    // Show preview snippet
    if (ui.previewSnippet) {
      const snippetText = (pageData.metaDescription || pageData.snippet || "").trim();
      if (snippetText) {
        ui.previewSnippet.textContent = snippetText.length > 200 
          ? snippetText.substring(0, 200) + "..." 
          : snippetText;
        ui.previewSnippet.style.display = "block";
      } else {
        ui.previewSnippet.style.display = "none";
      }
    }
    
    // Show content length
    if (ui.contentLength) {
      const textLength = pageData.text?.length || 0;
      if (textLength > 0) {
        const words = Math.ceil(textLength / 5); // Rough estimate
        ui.contentLength.textContent = `${words} words`;
      } else {
        ui.contentLength.textContent = "N/A";
      }
    }
    
    // Show key topics (extract from title and first few words)
    if (ui.keyTopics) {
      const title = pageData.title || "";
      const firstWords = pageData.text?.split(/\s+/).slice(0, 10).join(" ") || "";
      const combined = (title + " " + firstWords).toLowerCase();
      
      // Extract potential topics (simple keyword extraction)
      const topics = [];
      const commonWords = ["the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can", "a", "an"];
      
      const words = combined.split(/\W+/).filter(word => 
        word.length > 3 && !commonWords.includes(word)
      );
      
      // Get unique words and limit to 3
      const uniqueWords = [...new Set(words)].slice(0, 3);
      if (uniqueWords.length > 0) {
        ui.keyTopics.textContent = uniqueWords.map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(", ");
      } else {
        ui.keyTopics.textContent = "General";
      }
    }
    
    ui.previewContent.style.display = "block";
  };

  const updateUIFromData = async (pageData) => {
    if (!pageData || JSON.stringify(lastData) === JSON.stringify(pageData))
      return;
    
    // Don't update UI if user is in password reset flow
    if (isInPasswordResetFlow()) {
      return;
    }
    
    lastData = pageData;

    // Clear any previous fallback
    if (ui.faviconContainer) {
      ui.faviconContainer.innerHTML = `<img class="site-favicon" src="" alt="Favicon" width="24" height="24" />`;
      // Re-select the favicon img element after replacing innerHTML
      ui.favicon = ui.faviconContainer.querySelector(".site-favicon");
    }

    if (ui.favicon) {
      ui.favicon.onerror = () => {
        try {
        const titleChar = (pageData.title || " ")[0].toUpperCase();
        const fallbackDiv = document.createElement("div");
        fallbackDiv.className = "favicon-fallback";
        fallbackDiv.textContent = titleChar;

        if (ui.favicon.parentNode) {
          ui.favicon.parentNode.replaceChild(fallbackDiv, ui.favicon);
          }
        } catch (error) {
          console.warn("Favicon fallback failed:", error);
        }
      };

      try {
      ui.favicon.src =
          pageData.favicon || chrome.runtime.getURL("icons/icon48.png");
      } catch (error) {
        console.warn("Failed to set favicon:", error);
      }
    }

    if (ui.title) {
      // Split by spaces and common delimiters
      const titleWords = pageData.title
        ?.trim()
        .split(/[\s\/-]+/)
        .filter(Boolean)
        .slice(0, 2) // take only 2 words
        .map(
          (word) => (word.length > 18 ? word.slice(0, 14) : word) // enforce max 18 chars
        );

      const displayedTitle = titleWords.join(" ") || pageData.title || "";

      ui.title.textContent = displayedTitle;
      ui.title.title = pageData.title || "";
    }

    try {
      if (ui.desc) ui.desc.textContent = new URL(pageData.url).hostname;
      if (ui.desc) ui.desc.title = pageData.url;

      let displayUrl = pageData.url.replace(/^https?:\/\//, "");
      if (displayUrl.length > 35) {
        displayUrl = displayUrl.substring(0, 32) + "...";
      }

      // snippetUrl is now only used in the full details section, not in hero

      if (ui.breadcrumbDisplay) {
        let breadcrumbUrl = pageData.url.replace(/^https?:\/\//, "");
        if (breadcrumbUrl.length > 30) {
          breadcrumbUrl = breadcrumbUrl.substring(0, 27) + "...";
        }
        ui.breadcrumbDisplay.textContent = breadcrumbUrl;
        ui.breadcrumbDisplay.title = pageData.url;
      }
      if (ui.breadcrumbHeader) {
        // Put the same breadcrumb path into the hero header
        let b = pageData.url.replace(/^https?:\/\//, "");
        if (b.length > 40) b = b.substring(0, 37) + "...";
        ui.breadcrumbHeader.textContent = b;
        ui.breadcrumbHeader.title = pageData.url;
      }
    } catch {
      if (ui.desc) ui.desc.textContent = "";
    }

    const snippetText = (
      pageData.metaDescription ||
      pageData.snippet ||
      ""
    ).trim();

    // Update snippet content
    if (ui.snippet) {
      ui.snippet.textContent = snippetText;
      // Only show snippet if there's actual content
      ui.snippet.style.display = snippetText ? "block" : "none";
    }

    if (ui.fullContent) ui.fullContent.textContent = pageData.text || "";

    const hasFullContent = pageData.text?.trim().length > 20;
    const hasSnippetContent = snippetText.length > 0;

    // --- UPDATED LOGIC ---
    if (ui.snippet)
      ui.snippet.style.display = hasSnippetContent ? "block" : "none";
    if (ui.fullDetails) ui.fullDetails.style.display = "none"; // Hide by default

    const authFormVisible = Object.values(forms).some(
      (form) => form && form.style.display === "block"
    );

    // Button visibility logic - will be refined based on login status later
    if (ui.mainActionButton) {
      if (hasFullContent && !authFormVisible) {
        ui.mainActionButton.style.display = "inline-block";
      } else {
        ui.mainActionButton.style.display = "none";
      }
    }

    try {
      const { user, isLoggedIn, popupUIState } = await storage.get([
        "user",
        "isLoggedIn",
        "popupUIState",
      ]);
      
      // First, set the auth state which will hide/show appropriate elements
      updateUIForAuthState(isLoggedIn, user);

      if (isLoggedIn) {
        // User is logged in - show full content
        const shouldShowContent =
          isLoggedIn && (hasSnippetContent || hasFullContent);

        if (ui.snippet)
          ui.snippet.style.display =
            shouldShowContent && hasSnippetContent ? "block" : "none";

        const shouldExpand =
          popupUIState?.expanded ??
          (pageData.showFullDetails && hasFullContent && isLoggedIn);

        if (shouldShowContent && hasFullContent) {
          if (ui.fullDetails) ui.fullDetails.style.display = "block";
          applyExpandedState(shouldExpand);
        }

        if (
          ui.fullDetails &&
          ui.fullDetails.dataset.pendingView === "true"
        ) {
          if (ui.fullDetails) ui.fullDetails.style.display = "block";
          applyExpandedState(true);
          await storage.set({ popupUIState: { expanded: true } });
          ui.fullDetails.dataset.pendingView = "false";
        }
      } else {
        // User is not logged in - show preview content and hide any auth forms
        Object.values(forms).forEach((form) => {
          if (form) form.style.display = "none";
        });
        showPreviewContent(pageData);
        
        // Show the "Show Full Analysis" button for non-logged-in users
        if (ui.mainActionButton) ui.mainActionButton.style.display = "inline-block";
      }
    } catch (error) {
      console.error("Error updating UI from storage data:", error);
      // If there's an error, show preview content as fallback and hide auth forms
      Object.values(forms).forEach((form) => {
        if (form) form.style.display = "none";
      });
      showPreviewContent(pageData);
      
      // Show the "Show Full Analysis" button as fallback for non-logged-in users
      if (ui.mainActionButton) ui.mainActionButton.style.display = "inline-block";
    }
  };

  const showAssistanceView = () => {
    if (ui.mainContainer) ui.mainContainer.style.display = "none";
    if (ui.assistanceView) ui.assistanceView.style.display = "flex";
    generateSuggestions(lastData ? lastData.text : "");
  };

  const hideAssistanceView = () => {
    if (ui.assistanceView) ui.assistanceView.style.display = "none";
    if (ui.mainContainer) ui.mainContainer.style.display = "flex";
  };

  const generateSuggestions = (context = "") => {
    if (!ui.suggestionsContainer) return;
    const suggestions = new Set();
    const lowerContext = context.toLowerCase();

    const suggestionRules = [
      {
        keywords: ["bug", "error", "failed", "issue", "crash"],
        prompt: "Write a bug description for this issue",
      },
      {
        keywords: ["ticket", "jira", "sprint", "task", "epic"],
        prompt: "Summarise this ticket",
      },
      {
        keywords: ["ticket", "jira", "sprint", "task", "epic"],
        prompt: "Break down this epic into subtasks",
      },
      {
        keywords: ["how to", "guide", "steps", "tutorial"],
        prompt: "List the key steps from this guide",
      },
      {
        keywords: ["api", "code", "function", "test"],
        prompt: "Generate test cases for this",
      },
      {
        keywords: ["criteria", "requirements", "user story"],
        prompt: "Suggest acceptance criteria",
      },
    ];

    suggestionRules.forEach((rule) => {
      if (rule.keywords.some((kw) => lowerContext.includes(kw))) {
        suggestions.add(rule.prompt);
      }
    });

    // Add default suggestions like in the image
    suggestions.add("Analyse the acceptance criteria and suggest additional edge cases or missing scenarios for College Recruitment prospects.");
    suggestions.add("Summarise the given requirement into a technical specification that developers can follow while linking with the provided Figma and Confluence references.");
    suggestions.add("Create test cases based on this acceptance criteria for viewing College Recruitment prospects, including positive and negative scenarios.");

    ui.suggestionsContainer.innerHTML = "";
    suggestions.forEach((promptText) => {
      if (ui.suggestionsContainer.childElementCount >= 3) return;
      const btn = document.createElement("button");
      btn.className = "suggestion-btn";
      btn.textContent = promptText;
      ui.suggestionsContainer.appendChild(btn);
    });
  };

  const callChatbotAPI = (prompt, context) => {
    console.log("--- Sending to Chatbot API ---");
    console.log("PROMPT:", prompt);
    showToast("Request sent to chatbot!", "success");
  };

  // --- Event Listeners ---
  if (ui.playPauseBtn) {
    ui.playPauseBtn.addEventListener("click", () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        console.log("Start clock log");
        ui.playIcon.style.display = "none";
        ui.pauseIcon.style.display = "block";
        ui.playPauseBtn.classList.add("playing"); // Add the 'playing' class
        ui.tooltipText.textContent = "Pause Clock Log";
      } else {
        console.log("Pause clock log");
        ui.playIcon.style.display = "block";
        ui.pauseIcon.style.display = "none";
        ui.playPauseBtn.classList.remove("playing"); // Remove the 'playing' class
        ui.tooltipText.textContent = "Start Clock Log";
      }
    });
  }

  if (ui.mainActionButton) {
    ui.mainActionButton.addEventListener("click", async () => {
      const { isLoggedIn } = await storage.get(["isLoggedIn"]);
      if (isLoggedIn) {
        const isExpanded =
          ui.mainActionButton.getAttribute("aria-expanded") === "true";
        applyExpandedState(!isExpanded);
        await storage.set({ popupUIState: { expanded: !isExpanded } });
      } else {
        if (ui.fullDetails) ui.fullDetails.dataset.pendingView = "true";
        // Hide preview content when showing login form
        if (ui.previewContent) ui.previewContent.style.display = "none";
        if (forms.login) showAuthForm(forms.login);
      }
    });
  }

  document.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
      const api = await initApiService();

      switch (e.target.id) {
        case "authForm":
          await handleSignIn(data, api);
          break;
        case "forgotPasswordFormElement":
          await handleForgotPassword(data, api);
          break;
        case "resetPasswordFormElement":
          await handleResetPassword(data, api);
          break;
      }
    } catch (error) {
      console.error('Form submission error:', error);
      showToast(error.getUserMessage ? error.getUserMessage() : 'An error occurred. Please try again.');
    }
  });

  const handleSignIn = async (data, api) => {
    try {
      // Show loader immediately
      showLoader("Verifying credentials...");
      
      const result = await api.signIn(data.email.trim(), data.password);
      
      if (result.success) {
        // Update loader text
        showLoader("Setting up your account...");
        
        // Small delay to show the setup message
        await new Promise(resolve => setTimeout(resolve, 500));
        
        Object.values(forms).forEach((form) => {
          if (form) form.style.display = "none";
        });
        // Hide preview content after successful login
        if (ui.previewContent) ui.previewContent.style.display = "none";
        updateUIForAuthState(true, result.user);

        const snippetText = (
          lastData?.metaDescription ||
          lastData?.snippet ||
          ""
        ).trim();
        if (ui.snippet)
          ui.snippet.style.display = snippetText ? "block" : "none";

        if (
          ui.fullDetails &&
          ui.fullDetails.dataset.pendingView === "true"
        ) {
          applyExpandedState(true);
          ui.fullDetails.dataset.pendingView = "false";
        }

        if (ui.mainActionButton)
          ui.mainActionButton.style.display = "inline-block";

        await storage.set({
          user: result.user,
          isLoggedIn: true,
          popupUIState: {
            expanded:
              ui.fullDetails && ui.fullDetails.style.display === "block",
          },
        });

        // Hide loader and show success message
        hideLoader();
        showToast("Welcome back! You're now signed in.", "success");
      }
    } catch (error) {
      console.error('Sign in error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
        stack: error.stack
      });
      hideLoader();
      
      // Custom error messages based on error type
      let errorMessage = 'Sign in failed. Please try again.';
      
      if (error.getUserMessage) {
        errorMessage = error.getUserMessage();
      } else if (error.message) {
        if (error.message.includes('Email must be an Email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('Invalid credentials') || error.message.includes('401')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Account not found. Please check your email address.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again in a few moments.';
        } else if (error.message.includes('Invalid response format')) {
          errorMessage = 'Server response format error. Please try again.';
        }
      }
      
      showToast(errorMessage);
    }
  };

  const handleForgotPassword = async (data, api) => {
    try {
      showLoader("Sending reset code...");
      
      const result = await api.forgotPassword(data.email.trim());
      
      if (result.success) {
        hideLoader();
        showToast("Reset code sent to your email. Please check your inbox.", "success");
        // Show reset password form after successful forgot password
        setTimeout(() => {
          showAuthForm(forms.resetPassword);
          // Pre-fill email in reset form (you might want to store this temporarily)
          const resetForm = getEl("resetPasswordFormElement");
          if (resetForm) {
            // Store email for reset password form
            resetForm.dataset.email = data.email.trim();
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      hideLoader();
      
      let errorMessage = 'Failed to send reset code. Please try again.';
      
      if (error.getUserMessage) {
        errorMessage = error.getUserMessage();
      } else if (error.message) {
        if (error.message.includes('Email must be an Email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          errorMessage = 'No account found with this email address.';
        } else if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          errorMessage = 'Unauthorized access. Please try again.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again in a few moments.';
        }
      }
      
      showToast(errorMessage);
      
      // No need to redirect to sign-in form since forgot password doesn't require authentication
    }
  };

  const handleResetPassword = async (data, api) => {
    // Validate password strength
    const newPasswordInput = getEl("newPassword");
    const isStrongPassword = updatePasswordStrengthUI(
      data.newPassword, 
      passwordStrengthUI.newPassword, 
      newPasswordInput
    );

    if (!isStrongPassword) {
      showToast("Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters.");
      return;
    }

    try {
      showLoader("Resetting password...");
      
      const result = await api.resetPassword(data.resetCode.trim(), data.newPassword);
      
      if (result.success) {
        hideLoader();
        showToast("Password reset successfully! You can now sign in with your new password.", "success");
        // Go back to sign in form after successful reset
        setTimeout(() => {
          showAuthForm(forms.login);
        }, 2000);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      hideLoader();
      
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (error.getUserMessage) {
        errorMessage = error.getUserMessage();
      } else if (error.message) {
        if (error.message.includes('Invalid reset code') || error.message.includes('invalid')) {
          errorMessage = 'Invalid reset code. Please check the code sent to your email.';
        } else if (error.message.includes('expired')) {
          errorMessage = 'Reset code has expired. Please request a new one.';
        } else if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        }
      }
      
      showToast(errorMessage);
    }
  };

  const handleLogout = async () => {
    try {
      const api = await initApiService();
      await api.signOut();
      
      updateUIForAuthState(false, null);
      applyExpandedState(false);
      
      // Show preview content again after logout
      if (lastData && ui.previewContent) {
        showPreviewContent(lastData);
      }
      
      showToast("You have been signed out.", "success");
    } catch (error) {
      console.warn("Logout error:", error);
      // Still update UI even if API call fails
      updateUIForAuthState(false, null);
      applyExpandedState(false);
      
      if (lastData && ui.previewContent) {
        showPreviewContent(lastData);
      }
      
      showToast("You have been signed out locally.");
    }
  };

  document.addEventListener("click", (e) => {
    const targetId = e.target.id;
    if (!e.target || !targetId) return;

    if (targetId.startsWith("show") || targetId.startsWith("backTo"))
      e.preventDefault();

    switch (targetId) {
      case "backToSignInLink":
        if (forms.login) showAuthForm(forms.login);
        break;
      case "backToForgotPasswordLink":
        if (forms.forgotPassword) showAuthForm(forms.forgotPassword);
        break;
      case "backToSignInFromResetLink":
        if (forms.login) showAuthForm(forms.login);
        break;
      case "goToResetPasswordLink":
        if (forms.resetPassword) showAuthForm(forms.resetPassword);
        break;
      case "forgotPasswordLink":
        if (forms.forgotPassword) showAuthForm(forms.forgotPassword);
        break;
      case "logoutButton":
        handleLogout();
        break;
      case "userAvatar":
        e.stopPropagation();
        if (ui.userMenu)
          ui.userMenu.style.display =
            ui.userMenu.style.display === "none" ? "block" : "none";
        break;
      case "popupCloseBtn":
        window.parent.postMessage("closePopup", "*");
        break;
    }

    if (ui.userProfile && !ui.userProfile.contains(e.target) && ui.userMenu) {
      ui.userMenu.style.display = "none";
    }
  });

  if (ui.needAssistanceTrigger)
    ui.needAssistanceTrigger.addEventListener("click", showAssistanceView);
  if (ui.backToDetailsBtn)
    ui.backToDetailsBtn.addEventListener("click", hideAssistanceView);

  if (ui.suggestionsContainer) {
    ui.suggestionsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("suggestion-btn")) {
        if (ui.assistanceSearchInput)
          ui.assistanceSearchInput.value = e.target.textContent;
        if (ui.assistanceSearchInput) ui.assistanceSearchInput.focus();
      }
    });
  }

  if (ui.sendAssistanceRequest) {
    ui.sendAssistanceRequest.addEventListener("click", () => {
      if (!ui.assistanceSearchInput) return;
      const prompt = ui.assistanceSearchInput.value.trim();
      if (prompt) {
        callChatbotAPI(prompt, lastData ? lastData.text : "");
        ui.assistanceSearchInput.value = "";
      }
    });
  }

  // Voice button functionality
  if (ui.voiceButton) {
    ui.voiceButton.addEventListener("click", () => {
      // Placeholder for voice input functionality
      showToast("Voice input feature coming soon!", "success");
    });
  }

  const loginPasswordInput = getEl("loginPassword");
  if (loginPasswordInput) {
    loginPasswordInput.addEventListener("input", (e) =>
      updatePasswordStrengthUI(e.target.value, passwordStrengthUI.login)
    );
  }

  const newPasswordInput = getEl("newPassword");
  if (newPasswordInput) {
    newPasswordInput.addEventListener("input", (e) =>
      updatePasswordStrengthUI(e.target.value, passwordStrengthUI.newPassword, e.target)
    );
  }

  const init = async () => {
    try {
      // Initialize API service first
      await initApiService();
      
      // First, ensure all auth forms are hidden initially
      Object.values(forms).forEach((form) => {
        if (form) form.style.display = "none";
      });
      
      // Use direct storage access to get data
      const { currentPageData, isLoggedIn, user } = await storage.get(["currentPageData", "isLoggedIn", "user"]);
      
      // Set initial auth state
      updateUIForAuthState(isLoggedIn, user);
      
      if (currentPageData) {
        await updateUIFromData(currentPageData);
      } else {
        // If no page data is available, show preview content with placeholder data
        showPreviewContent({
          title: "Loading page data...",
          text: "Please wait while we analyze this page.",
          metaDescription: "Page analysis in progress...",
          url: window.location?.href || "Unknown"
        });
      }

      // Add storage listener for real-time updates with error handling
      try {
        if (chrome.storage && chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, area) => {
            try {
              if (area === "local") {
                // Don't update UI if user is in password reset flow
                const isInPasswordFlow = isInPasswordResetFlow();
                
                if (!isInPasswordFlow && changes.currentPageData) {
                  updateUIFromData(changes.currentPageData.newValue);
                }
                
                if (changes.user || changes.isLoggedIn) {
                  // Update UI immediately for auth state changes
                  if (changes.isLoggedIn) {
                    const isLoggedIn = changes.isLoggedIn.newValue;
                    if (!isLoggedIn && lastData && !isInPasswordFlow) {
                      // User logged out, show preview content
                      showPreviewContent(lastData);
                    }
                  }
                  if (!isInPasswordFlow) {
                    init();
                  }
                }
              }
            } catch (error) {
              console.warn("Storage listener error:", error);
            }
          });
        }
      } catch (error) {
        console.warn("Failed to add storage listener:", error);
      }
    } catch (err) {
      console.error("Initialization failed:", err);
      // Show preview content with placeholder data as fallback
      showPreviewContent({
        title: "Loading page data...",
        text: "Please wait while we analyze this page.",
        metaDescription: "Page analysis in progress...",
        url: window.location?.href || "Unknown"
      });
    }
  };

  init();
});