/**
 * Configuration file for Consulgenix Extension
 * Contains environment-specific settings and API endpoints
 */

const CONFIG = {
  // API Configuration
  API: {
    BASE_URL: 'https://gateway-consulmings.apiswagger.co.uk',
    ENDPOINTS: {
      SIGN_IN: '/sign-in',
      FORGOT_PASSWORD: '/forgot-password',
      RESET_PASSWORD: '/reset-password'
    },
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3
  },

  // Authentication Configuration
  AUTH: {
    TOKEN_STORAGE_KEY: 'authToken',
    REFRESH_TOKEN_STORAGE_KEY: 'refreshToken',
    USER_DATA_STORAGE_KEY: 'userData',
    LOGIN_STATE_STORAGE_KEY: 'isLoggedIn'
  },

  // Password Requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  },

  // UI Configuration
  UI: {
    TOAST_DURATION: 3000,
    FORM_TRANSITION_DELAY: 2000,
    MAX_RESET_CODE_LENGTH: 6,
    AVATAR_FALLBACK_CHAR: 'U'
  },

  // Extension Configuration
  EXTENSION: {
    NAME: 'Consulgenix Extension',
    VERSION: '1.0.0',
    DESCRIPTION: 'An AI-powered extension to scan pages and perform automations.'
  },

  // Error Messages
  ERRORS: {
    NETWORK_ERROR: 'Network error. Please check your connection and try again.',
    INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
    EMAIL_REQUIRED: 'Email is required.',
    PASSWORD_REQUIRED: 'Password is required.',
    PASSWORDS_NOT_MATCH: 'Passwords do not match. Please try again.',
    WEAK_PASSWORD: 'Password is too weak. Please use a stronger password.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    RESET_CODE_REQUIRED: 'Reset code is required.',
    INVALID_RESET_CODE: 'Invalid reset code. Please check and try again.',
    GENERIC_ERROR: 'An unexpected error occurred. Please try again.'
  },

  // Success Messages
  SUCCESS: {
    SIGN_IN: 'Successfully signed in!',
    SIGN_OUT: 'You have been signed out.',
    FORGOT_PASSWORD: 'Reset code sent to your email.',
    RESET_PASSWORD: 'Password has been reset successfully.'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
