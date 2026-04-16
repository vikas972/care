# Google Calendar Integration Setup

## Current Flow

The app uses a proper OAuth2 web client flow:

1. **User logs in** → `/auth/google/url` returns authorization URL
2. **Browser redirects to Google** → User grants calendar access
3. **Google redirects back** → `/auth/google/callback` stores encrypted refresh_token in DB
4. **Sync calendars** → `/calendar/sync` uses stored refresh_token to fetch events

## Prerequisites

### 1. Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or use your existing one (ID: `867073877941`)
3. Enable the **Google Calendar API**:
   - Search for "Google Calendar API"
   - Click **Enable**
   - Wait a few minutes for propagation

### 2. OAuth 2.0 Credentials (Web Client)

1. Go to **APIs & Services** → **Credentials**
2. Create **OAuth 2.0 Client ID** (type: Web application)
3. Add **Authorized JavaScript origins**:
   - `http://localhost:8000`
   - `http://localhost:5173` (if running frontend separately)

4. Add **Authorized redirect URIs**:
   - `http://localhost:8000/auth/google/callback` (development)
   - Your production URL when deploying

5. Copy the **Client ID** and **Client Secret**

### 3. Update `.env`

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

## Testing the Integration

### Step 1: Start the app
```bash
python -m uvicorn app.main:app --reload
```

### Step 2: Get OAuth URL
```bash
curl http://localhost:8000/auth/google/url
# Returns: {"authorization_url": "https://...", "state": "..."}
```

### Step 3: Visit the URL and authorize

### Step 4: Check if token was stored
```bash
# Query your DB:
SELECT id, email, google_sub, google_refresh_token_encrypted FROM users WHERE email='your@email.com';
# Should show google_refresh_token_encrypted is NOT NULL
```

### Step 5: Sync calendar events
```bash
curl -X POST http://localhost:8000/calendar/sync \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

## Troubleshooting

### "Google Calendar API has not been used"
- ✅ Go to Google Cloud Console and enable Google Calendar API

### "No refresh token; revoke app access in Google"
- ✅ Make sure you're using a **Web Client** credential (not Desktop/Installed App)
- ✅ Check `GOOGLE_REDIRECT_URI` matches your setup exactly
- ✅ Revoke app at https://myaccount.google.com/permissions and retry

### "Token refresh failed"
- ✅ Revoke app access and re-authenticate
- ✅ Check `ENCRYPTION_KEY` in `.env` hasn't changed (would corrupt stored token)

### Events not syncing
- ✅ Check database: `SELECT * FROM calendar_events WHERE user_id=<your-id>;`
- ✅ Check if you have events in Google Calendar in the next 14 days
- ✅ Check logs for errors in `/calendar/sync`

## Important: Remove the standalone script

Once integrated, delete `calander.py` - it was only for local testing with installed app credentials.
