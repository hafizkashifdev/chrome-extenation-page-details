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
    breadcrumbHeader: getEl("breadcrumbHeader"),
    // Preview content elements
    previewContent: getEl("previewContent"),
    previewSnippet: getEl("previewSnippet"),
    contentLength: getEl("contentLength"),
    keyTopics: getEl("keyTopics"),
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
  const VALID_USER = {
    email: "kashifnazim127@gmail.com",
    password: "Hafiz@786",
    name: "Kashif Nazim",
    avatarUrl: "",
  };
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
    if (ui.closeBtn) ui.closeBtn.style.display = isLoggedIn ? "none" : "flex";
    if (ui.userProfile)
      ui.userProfile.style.display = isLoggedIn ? "block" : "none";
    if (ui.needAssistanceTrigger)
      ui.needAssistanceTrigger.style.display = isLoggedIn ? "flex" : "none";
    // Show/hide the play/pause button based on login state
    if (ui.playPauseBtn)
      ui.playPauseBtn.style.display = isLoggedIn ? "flex" : "none";

    if (isLoggedIn && userData) {
      if (ui.userAvatar) ui.userAvatar.textContent = getInitials(userData.name);
      if (ui.userMenuName) ui.userMenuName.textContent = userData.name || "";
      if (ui.userMenuEmail) ui.userMenuEmail.textContent = userData.email || "";
      
      // Hide all auth forms and preview content when logged in
      Object.values(forms).forEach((form) => {
        if (form) form.style.display = "none";
      });
      if (ui.previewContent) ui.previewContent.style.display = "none";
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

    suggestions.add("What are the key points?");
    suggestions.add("Explain this like I am 10");
    suggestions.add("Suggest a title for this page");

    ui.suggestionsContainer.innerHTML = "";
    suggestions.forEach((promptText) => {
      if (ui.suggestionsContainer.childElementCount >= 6) return;
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

    switch (e.target.id) {
      case "authForm":
        if (
          data.email.trim() === VALID_USER.email &&
          data.password === VALID_USER.password
        ) {
          Object.values(forms).forEach((form) => {
            if (form) form.style.display = "none";
          });
          // Hide preview content after successful login
          if (ui.previewContent) ui.previewContent.style.display = "none";
          updateUIForAuthState(true, VALID_USER);

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
            user: VALID_USER,
            isLoggedIn: true,
            popupUIState: {
              expanded:
                ui.fullDetails && ui.fullDetails.style.display === "block",
            },
          });
        } else {
          showToast("Invalid email or password.");
        }
        break;
      case "forgotPasswordFormElement":
        showToast(
          "If this email is registered, you will receive reset instructions.",
          "success"
        );
        if (forms.login) setTimeout(() => showAuthForm(forms.login), 2000);
        break;
    }
  });

  document.addEventListener("click", (e) => {
    const targetId = e.target.id;
    if (!e.target || !targetId) return;

    if (targetId.startsWith("show") || targetId.startsWith("backTo"))
      e.preventDefault();

    switch (targetId) {
      case "backToSignInLink":
        if (forms.login) showAuthForm(forms.login);
        break;
      case "forgotPasswordLink":
        if (forms.forgotPassword) showAuthForm(forms.forgotPassword);
        break;
      case "logoutButton":
        updateUIForAuthState(false, null);
        applyExpandedState(false);
        // Show preview content again after logout
        if (lastData && ui.previewContent) {
          showPreviewContent(lastData);
        }
        // Use direct storage access for logout
        storage.remove(['user', 'isLoggedIn', 'popupUIState'])
          .then(() => {
            showToast("You have been signed out.", "success");
          })
          .catch((error) => {
            console.warn("Storage access failed during logout:", error.message);
            showToast("You have been signed out locally.");
          });
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

  const loginPasswordInput = getEl("loginPassword");
  if (loginPasswordInput) {
    loginPasswordInput.addEventListener("input", (e) =>
      updatePasswordStrengthUI(e.target.value, passwordStrengthUI.login)
    );
  }

  const init = async () => {
    try {
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
                if (changes.currentPageData)
                  updateUIFromData(changes.currentPageData.newValue);
                if (changes.user || changes.isLoggedIn) {
                  // Update UI immediately for auth state changes
                  if (changes.isLoggedIn) {
                    const isLoggedIn = changes.isLoggedIn.newValue;
                    if (!isLoggedIn && lastData) {
                      // User logged out, show preview content
                      showPreviewContent(lastData);
                    }
                  }
                  init();
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
