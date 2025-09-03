# Consulgenix Chrome Extension

An AI-powered Chrome extension that scans pages and performs automations with integrated backend authentication.

## Features

- **Page Analysis**: Automatically extracts and analyzes page content
- **User Authentication**: Secure sign-in, forgot password, and reset password functionality
- **AI Assistance**: Context-aware suggestions and assistance
- **Real-time Updates**: Live page monitoring with SPA support

## Backend Integration

This extension integrates with the Consulgenix API Gateway for authentication and user management.

### API Endpoints

- **Sign In**: `POST /sign-in`
- **Forgot Password**: `POST /forgot-password`
- **Reset Password**: `POST /reset-password`

### Authentication Flow

1. **Sign In**: Users enter email and password
2. **Forgot Password**: Users can request a reset code via email
3. **Reset Password**: Users enter the OTP code and new password
4. **Auto-redirect**: Successful operations redirect to appropriate screens

## Installation

1. Clone or download this extension
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. The extension will appear in your browser toolbar

## Configuration

The extension uses environment variables for configuration. Copy `.env` to `.env.local` and modify as needed:

```bash
cp .env .env.local
```

### Environment Variables

- `API_BASE_URL`: Backend API base URL
- `API_TIMEOUT`: Request timeout in milliseconds
- `API_RETRY_ATTEMPTS`: Number of retry attempts for failed requests
- `DEBUG_MODE`: Enable debug logging

## Usage

### For Users

1. **Sign In**: Click the extension icon and enter your credentials
2. **Page Analysis**: The extension automatically analyzes the current page
3. **AI Assistance**: Click "Need Assistance?" for context-aware suggestions
4. **Sign Out**: Click your avatar and select "Sign Out"

### For Developers

The extension includes comprehensive error handling and retry logic:

- Network error handling with exponential backoff
- Input validation for all forms
- Password strength validation
- Secure token storage in Chrome's local storage

## File Structure

```
chrome-extenation-page-details/
├── manifest.json          # Extension manifest
├── popup.html            # Main popup interface
├── popup.js              # Popup logic and UI handling
├── popup.css             # Popup styling
├── content-script.js     # Content script for page analysis
├── content-style.css     # Content script styling
├── background.js         # Background service worker
├── api-service.js        # Backend API integration
├── config.js             # Configuration and constants
├── icons/                # Extension icons
├── images/               # UI images and assets
├── libs/                 # Third-party libraries
├── .env                  # Environment variables template
├── .env.local            # Local environment variables (gitignored)
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## API Integration Details

### Authentication

The extension handles JWT tokens and user data securely:

- Tokens are stored in Chrome's local storage
- Automatic token refresh (if implemented by backend)
- Secure logout with token cleanup

### Error Handling

Comprehensive error handling includes:

- Network connectivity issues
- Invalid credentials
- Server errors (5xx)
- Client errors (4xx)
- Input validation errors

### User Experience

- Loading states during API calls
- Toast notifications for success/error messages
- Form validation with real-time feedback
- Password strength indicators
- Smooth transitions between auth screens

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of Chrome extension development
- Access to the Consulgenix API Gateway

### Testing

1. Load the extension in Chrome
2. Navigate to any webpage
3. Click the extension icon
4. Test the authentication flow:
   - Sign in with valid credentials
- Test forgot password flow
   - Test reset password flow
   - Verify user data display

### Debugging

Enable debug mode by setting `DEBUG_MODE=true` in `.env.local`:

```bash
DEBUG_MODE=true
LOG_LEVEL=debug
```

Check the browser console for detailed logs.

## Security Considerations

- All API calls use HTTPS
- Sensitive data is stored in Chrome's secure local storage
- Input validation on both client and server side
- Password strength requirements enforced
- Secure token handling with automatic cleanup

## Support

For issues or questions:

1. Check the browser console for error messages
2. Verify API endpoint accessibility
3. Ensure proper environment configuration
4. Check network connectivity

## License

This extension is proprietary software for Consulgenix.