/**
 * API Service for Consulgenix Extension
 * Handles all backend API communications including authentication
 */

class ApiService {
  constructor() {
    this.baseURL = CONFIG.API.BASE_URL;
    this.endpoints = CONFIG.API.ENDPOINTS;
    this.timeout = CONFIG.API.TIMEOUT;
    this.retryAttempts = CONFIG.API.RETRY_ATTEMPTS;
    this.authToken = null;
    this.refreshToken = null;
    this.userData = null;
  }

  /**
   * Initialize the API service
   */
  async init() {
    try {
      // Load stored authentication data
      const authData = await this.getStoredAuthData();
      if (authData) {
        this.authToken = authData.authToken;
        this.refreshToken = authData.refreshToken;
        this.userData = authData.userData;
      }
    } catch (error) {
      console.warn('Failed to initialize API service:', error);
    }
  }

  /**
   * Get stored authentication data from chrome storage
   */
  async getStoredAuthData() {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage.local) {
        resolve(null);
        return;
      }

      chrome.storage.local.get([
        CONFIG.AUTH.TOKEN_STORAGE_KEY,
        CONFIG.AUTH.REFRESH_TOKEN_STORAGE_KEY,
        CONFIG.AUTH.USER_DATA_STORAGE_KEY
      ], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Storage get error:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }

        if (result[CONFIG.AUTH.TOKEN_STORAGE_KEY] && 
            result[CONFIG.AUTH.USER_DATA_STORAGE_KEY]) {
          resolve({
            authToken: result[CONFIG.AUTH.TOKEN_STORAGE_KEY],
            refreshToken: result[CONFIG.AUTH.REFRESH_TOKEN_STORAGE_KEY],
            userData: result[CONFIG.AUTH.USER_DATA_STORAGE_KEY]
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Store authentication data in chrome storage
   */
  async storeAuthData(authToken, refreshToken, userData) {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }

      const dataToStore = {
        [CONFIG.AUTH.TOKEN_STORAGE_KEY]: authToken,
        [CONFIG.AUTH.REFRESH_TOKEN_STORAGE_KEY]: refreshToken,
        [CONFIG.AUTH.USER_DATA_STORAGE_KEY]: userData,
        [CONFIG.AUTH.LOGIN_STATE_STORAGE_KEY]: true
      };

      chrome.storage.local.set(dataToStore, () => {
        if (chrome.runtime.lastError) {
          console.warn('Storage set error:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    });
  }

  /**
   * Clear authentication data from chrome storage
   */
  async clearAuthData() {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }

      chrome.storage.local.remove([
        CONFIG.AUTH.TOKEN_STORAGE_KEY,
        CONFIG.AUTH.REFRESH_TOKEN_STORAGE_KEY,
        CONFIG.AUTH.USER_DATA_STORAGE_KEY,
        CONFIG.AUTH.LOGIN_STATE_STORAGE_KEY
      ], () => {
        if (chrome.runtime.lastError) {
          console.warn('Storage remove error:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    });
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  async makeRequest(url, options = {}, retryCount = 0) {
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'developer-name': 'null'
      },
      timeout: this.timeout
    };

    // Add authorization header if token exists
    if (this.authToken) {
      defaultOptions.headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestOptions = { ...defaultOptions, ...options };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.errors || []
        );
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError(CONFIG.ERRORS.NETWORK_ERROR, 408);
      }

      if (retryCount < this.retryAttempts && this.shouldRetry(error)) {
        console.warn(`Request failed, retrying... (${retryCount + 1}/${this.retryAttempts})`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.makeRequest(url, options, retryCount + 1);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(CONFIG.ERRORS.NETWORK_ERROR, 0, [], error);
    }
  }

  /**
   * Determine if a request should be retried
   */
  shouldRetry(error) {
    if (error instanceof ApiError) {
      // Don't retry client errors (4xx) except for 408, 429, 500-599
      return error.status >= 500 || error.status === 408 || error.status === 429;
    }
    return true; // Retry network errors
  }

  /**
   * Delay utility for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sign in user
   */
  async signIn(email, password) {
    try {
      // Validate input
      if (!email || !email.trim()) {
        throw new ApiError(CONFIG.ERRORS.EMAIL_REQUIRED, 400);
      }
      if (!password || !password.trim()) {
        throw new ApiError(CONFIG.ERRORS.PASSWORD_REQUIRED, 400);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new ApiError(CONFIG.ERRORS.INVALID_EMAIL, 400);
      }

      const response = await this.makeRequest(
        `${this.baseURL}${this.endpoints.SIGN_IN}`,
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password: password
          })
        }
      );

      if (response.data && response.data.authToken && response.data.userData) {
        // Store authentication data
        this.authToken = response.data.authToken;
        this.refreshToken = response.data.refreshToken;
        this.userData = response.data.userData;

        await this.storeAuthData(
          response.data.authToken,
          response.data.refreshToken,
          response.data.userData
        );

        return {
          success: true,
          message: response.message || CONFIG.SUCCESS.SIGN_IN,
          user: response.data.userData,
          authToken: response.data.authToken,
          refreshToken: response.data.refreshToken,
          expiresIn: response.data.expiresIn
        };
      } else {
        throw new ApiError('Invalid response format from server', 500);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(email) {
    try {
      // Validate input
      if (!email || !email.trim()) {
        throw new ApiError(CONFIG.ERRORS.EMAIL_REQUIRED, 400);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new ApiError(CONFIG.ERRORS.INVALID_EMAIL, 400);
      }

      // The API requires authentication as shown in Swagger documentation
      // If no token is available, we need to inform the user
      if (!this.authToken) {
        throw new ApiError('Please sign in first to reset your password. The forgot password feature requires authentication.', 401);
      }

      // Make direct fetch request with proper headers as shown in Swagger
      const response = await fetch(`${this.baseURL}${this.endpoints.FORGOT_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'developer-name': 'null',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          email: email.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.errors || []
        );
      }

      const result = await response.json();

      return {
        success: true,
        message: result.message || CONFIG.SUCCESS.FORGOT_PASSWORD
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(resetCode, newPassword) {
    try {
      // Validate input
      if (!resetCode || !resetCode.trim()) {
        throw new ApiError(CONFIG.ERRORS.RESET_CODE_REQUIRED, 400);
      }
      if (!newPassword || !newPassword.trim()) {
        throw new ApiError(CONFIG.ERRORS.PASSWORD_REQUIRED, 400);
      }

      // Validate password strength
      if (!this.validatePasswordStrength(newPassword)) {
        throw new ApiError(CONFIG.ERRORS.WEAK_PASSWORD, 400);
      }

      // The API requires authentication
      if (!this.authToken) {
        throw new ApiError('Please sign in first to reset your password. The reset password feature requires authentication.', 401);
      }

      // Make direct fetch request with proper headers
      const response = await fetch(`${this.baseURL}${this.endpoints.RESET_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'developer-name': 'null',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          resetCode: resetCode.trim(),
          newPassword: newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.errors || []
        );
      }

      const result = await response.json();

      return {
        success: true,
        message: result.message || CONFIG.SUCCESS.RESET_PASSWORD
      };
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const requirements = CONFIG.PASSWORD;
    
    if (password.length < requirements.MIN_LENGTH) return false;
    if (requirements.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) return false;
    if (requirements.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) return false;
    if (requirements.REQUIRE_NUMBERS && !/[0-9]/.test(password)) return false;
    if (requirements.REQUIRE_SPECIAL_CHARS) {
      const specialCharsRegex = new RegExp(`[${requirements.SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
      if (!specialCharsRegex.test(password)) return false;
    }
    
    return true;
  }

  /**
   * Sign out user
   */
  async signOut() {
    try {
      // Clear local authentication data
      this.authToken = null;
      this.refreshToken = null;
      this.userData = null;

      await this.clearAuthData();

      return {
        success: true,
        message: CONFIG.SUCCESS.SIGN_OUT
      };
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, we should clear local data
      this.authToken = null;
      this.refreshToken = null;
      this.userData = null;
      await this.clearAuthData();
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!(this.authToken && this.userData);
  }

  /**
   * Get user display name
   */
  getUserDisplayName() {
    if (!this.userData) return 'User';
    
    const firstName = this.userData.firstName || '';
    const lastName = this.userData.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (this.userData.email) {
      return this.userData.email.split('@')[0];
    }
    
    return 'User';
  }

  /**
   * Get user initials for avatar
   */
  getUserInitials() {
    if (!this.userData) return CONFIG.UI.AVATAR_FALLBACK_CHAR;
    
    const firstName = this.userData.firstName || '';
    const lastName = this.userData.lastName || '';
    
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    } else if (this.userData.email) {
      return this.userData.email[0].toUpperCase();
    }
    
    return CONFIG.UI.AVATAR_FALLBACK_CHAR;
  }

  /**
   * Get current user data
   */
  getUserData() {
    return this.userData;
  }

  /**
   * Get current auth token
   */
  getAuthToken() {
    return this.authToken;
  }
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(message, status = 0, errors = [], originalError = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.originalError = originalError;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    // Handle specific error cases
    if (this.status === 400) {
      if (this.message.includes('Email must be an Email')) {
        return CONFIG.ERRORS.INVALID_EMAIL;
      }
      if (this.message.includes('Invalid credentials')) {
        return CONFIG.ERRORS.INVALID_CREDENTIALS;
      }
      if (this.message.includes('Invalid reset code')) {
        return CONFIG.ERRORS.INVALID_RESET_CODE;
      }
    }

    if (this.status === 401) {
      return CONFIG.ERRORS.INVALID_CREDENTIALS;
    }

    if (this.status === 404) {
      return 'User not found. Please check your email address.';
    }

    if (this.status >= 500) {
      return CONFIG.ERRORS.NETWORK_ERROR;
    }

    // Return the original message if it's user-friendly, otherwise return generic error
    if (this.message && !this.message.includes('HTTP') && !this.message.includes('fetch')) {
      return this.message;
    }

    return CONFIG.ERRORS.GENERIC_ERROR;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiService, ApiError };
} else if (typeof window !== 'undefined') {
  window.ApiService = ApiService;
  window.ApiError = ApiError;
}