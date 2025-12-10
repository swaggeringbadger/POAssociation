# HOA App SSO Integration Guide

This document explains how to integrate Single Sign-On (SSO) with HomeHub from your HOA application.

## Overview

When a user is authenticated in your HOA app and wants to access HomeHub, you redirect them with a signed token. HomeHub verifies the signature and automatically logs them in (creating an account if needed).

**Flow:**
1. User clicks "Go to HomeHub" in HOA app
2. HOA app generates signed token with user's email
3. User is redirected to HomeHub's `/sso-callback?token=...`
4. HomeHub verifies signature, logs user in
5. User lands on HomeHub dashboard, fully authenticated

---

## Setup

### 1. Get the Shared Secret

You'll receive a shared secret from the HomeHub administrator. This secret:
- Must be kept confidential (never expose in client-side code)
- Is used to sign the SSO token
- Must match what HomeHub has configured

Store it as an environment variable:
```env
HOMEHUB_SSO_SECRET=your-shared-secret-here
```

### 2. HomeHub URLs

| Environment | SSO Callback URL |
|-------------|------------------|
| Production  | `https://your-homehub-url.replit.app/sso-callback` |
| Development | `http://localhost:5000/sso-callback` |

---

## Implementation

### Node.js / Express Example

```javascript
const crypto = require('crypto');

/**
 * Generate SSO redirect URL for HomeHub
 * @param {string} email - User's email address
 * @param {string} displayName - User's display name (optional)
 * @returns {string} Full redirect URL
 */
function generateHomeHubSSOUrl(email, displayName) {
  const payload = {
    email: email,
    appId: "hoa_app",  // Must be exactly "hoa_app"
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
    displayName: displayName || undefined
  };

  // Sign the payload
  const signature = crypto
    .createHmac("sha256", process.env.HOMEHUB_SSO_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");

  // Create the token
  const token = Buffer.from(JSON.stringify({ payload, signature }))
    .toString("base64url");

  // Return full redirect URL
  const homeHubUrl = process.env.HOMEHUB_URL || "https://your-homehub-url.replit.app";
  return `${homeHubUrl}/sso-callback?token=${token}`;
}

// Express route example
app.get('/go-to-homehub', (req, res) => {
  // Ensure user is authenticated in your app first
  if (!req.user) {
    return res.redirect('/login');
  }

  const redirectUrl = generateHomeHubSSOUrl(req.user.email, req.user.name);
  res.redirect(redirectUrl);
});
```

### TypeScript Version

```typescript
import crypto from 'crypto';

interface SSOPayload {
  email: string;
  appId: string;
  timestamp: number;
  nonce: string;
  displayName?: string;
}

function generateHomeHubSSOUrl(email: string, displayName?: string): string {
  const payload: SSOPayload = {
    email,
    appId: "hoa_app",
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
    displayName
  };

  const signature = crypto
    .createHmac("sha256", process.env.HOMEHUB_SSO_SECRET!)
    .update(JSON.stringify(payload))
    .digest("hex");

  const token = Buffer.from(JSON.stringify({ payload, signature }))
    .toString("base64url");

  const homeHubUrl = process.env.HOMEHUB_URL || "https://your-homehub-url.replit.app";
  return `${homeHubUrl}/sso-callback?token=${token}`;
}
```

### Python / Flask Example

```python
import hmac
import hashlib
import json
import uuid
import time
import base64
import os

def generate_homehub_sso_url(email: str, display_name: str = None) -> str:
    payload = {
        "email": email,
        "appId": "hoa_app",
        "timestamp": int(time.time() * 1000),  # milliseconds
        "nonce": str(uuid.uuid4()),
    }

    if display_name:
        payload["displayName"] = display_name

    # Sign the payload
    payload_json = json.dumps(payload, separators=(',', ':'))
    signature = hmac.new(
        os.environ['HOMEHUB_SSO_SECRET'].encode(),
        payload_json.encode(),
        hashlib.sha256
    ).hexdigest()

    # Create token
    token_data = json.dumps({"payload": payload, "signature": signature})
    token = base64.urlsafe_b64encode(token_data.encode()).decode().rstrip('=')

    homehub_url = os.environ.get('HOMEHUB_URL', 'https://your-homehub-url.replit.app')
    return f"{homehub_url}/sso-callback?token={token}"


# Flask route example
@app.route('/go-to-homehub')
def go_to_homehub():
    if not current_user.is_authenticated:
        return redirect('/login')

    redirect_url = generate_homehub_sso_url(
        current_user.email,
        current_user.display_name
    )
    return redirect(redirect_url)
```

---

## Token Specification

### Payload Structure

```json
{
  "email": "user@example.com",
  "appId": "hoa_app",
  "timestamp": 1699900000000,
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "displayName": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `appId` | string | Yes | Must be exactly `"hoa_app"` |
| `timestamp` | number | Yes | Current time in milliseconds (Date.now()) |
| `nonce` | string | Yes | Random UUID to prevent replay attacks |
| `displayName` | string | No | User's display name |

### Signed Token Structure

```json
{
  "payload": { /* payload object above */ },
  "signature": "hex-encoded-hmac-sha256-signature"
}
```

### Final Token

The signed token structure is JSON stringified, then base64url encoded.

---

## Security Requirements

### Token Validity
- Tokens are valid for **5 minutes** from the timestamp
- Each nonce can only be used **once** (replay protection)

### Signature
- HMAC-SHA256 using the shared secret
- Signature is computed over `JSON.stringify(payload)`
- Must use consistent JSON serialization (no extra whitespace)

### Important Notes
1. **Never expose the secret** in client-side code or logs
2. **Always use HTTPS** in production
3. **Validate user authentication** in your app before generating SSO tokens
4. **Email matching**: HomeHub uses email to match/create accounts

---

## What Happens in HomeHub

When a user arrives via SSO:

1. **Existing user with same email**: User is logged in, `hoa_app` is added to their SSO sources
2. **New user**: Account is created automatically with:
   - Email verified (trusted from your app)
   - Auth method set to "sso"
   - SSO source set to "hoa_app"
   - Default home created

Users can later add a password to their HomeHub account if they want to log in directly.

---

## Testing

### Local Development

In development mode, HomeHub uses a default secret: `dev-secret-for-hoa_app`

You can test with:
```bash
# Set the dev secret
export HOMEHUB_SSO_SECRET="dev-secret-for-hoa_app"

# Generate a test URL (Node.js one-liner)
node -e "
const crypto = require('crypto');
const payload = {
  email: 'test@example.com',
  appId: 'hoa_app',
  timestamp: Date.now(),
  nonce: crypto.randomUUID(),
  displayName: 'Test User'
};
const sig = crypto.createHmac('sha256', process.env.HOMEHUB_SSO_SECRET)
  .update(JSON.stringify(payload)).digest('hex');
const token = Buffer.from(JSON.stringify({payload, signature: sig})).toString('base64url');
console.log('http://localhost:5000/sso-callback?token=' + token);
"
```

### HomeHub Test Endpoint (Dev Only)

HomeHub provides a test endpoint in development:
```
GET /api/auth/dev/sso-test?email=test@example.com&name=Test%20User
```

This returns a redirect URL you can use to test the SSO flow.

---

## Troubleshooting

### "Invalid signature"
- Verify the secret matches exactly (no extra whitespace)
- Ensure `appId` is exactly `"hoa_app"`
- Check JSON serialization is consistent

### "Token expired"
- Tokens are valid for 5 minutes
- Ensure server clocks are synchronized
- Generate tokens immediately before redirect

### "Unknown or inactive application"
- Verify `appId` is `"hoa_app"` (not `"hoaApp"` or `"hoa-app"`)
- Contact HomeHub admin to verify the app is configured

### "This login link has already been used"
- Each nonce can only be used once
- Generate a new token for each redirect

---

## Environment Variables Summary

```env
# Required
HOMEHUB_SSO_SECRET=<shared-secret-from-homehub-admin>

# Optional (defaults shown)
HOMEHUB_URL=https://your-homehub-url.replit.app
```

---

## Support

If you encounter issues integrating SSO, contact the HomeHub administrator with:
1. The error message you're seeing
2. The `appId` you're using
3. A sample token (with a test email, NOT production user data)
