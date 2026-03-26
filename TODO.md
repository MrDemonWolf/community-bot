# AI Features Setup

## AI Shoutouts (Gemini)

- [ ] Get a Google Gemini API key from <https://aistudio.google.com/apikey>
- [ ] Set `GEMINI_API_KEY=your-key-here` in your Twitch bot env
- [ ] Set `AI_SHOUTOUT_ENABLED=true` in your Twitch bot env
- [ ] Redeploy the Twitch bot
- [ ] Go to Dashboard → Settings → Features tab
- [ ] Toggle "AI-Enhanced Shoutouts" ON for your channel
- [ ] Test with `!so @someone` in chat — you should see a personalized follow-up message

## YouTube Song Requests (optional)

- [ ] Get a YouTube Data API v3 key from <https://console.cloud.google.com>
- [ ] Set `YOUTUBE_API_KEY=your-key-here` in your Twitch bot env
- [ ] Redeploy the Twitch bot

## Verify Everything Works

- [ ] Check bot health: `GET /health` should show `"status": "healthy"`
- [ ] Check AI readiness: `GET /health` should show `"ai": { "shoutout": "ready" }`
- [ ] In chat: `!so @someone` should produce a Gemini-generated follow-up

---

# Pre-Launch Checklist

## Branding & Assets
- [ ] Replace `apps/web/public/logo-white-border.png` with your own logo
- [ ] Replace `apps/web/public/favicon.ico` with your own favicon
- [ ] Replace `apps/web/public/apple-icon.png` (180x180)
- [ ] Replace `apps/web/public/icon-192.png` (192x192)
- [ ] Replace `apps/web/public/icon.png` (512x512)
- [ ] Set `NEXT_PUBLIC_COMPANY_NAME` in `.env` (used on TOS/Privacy pages, defaults to "Community Bot")

## Legal Pages
- [ ] Review and customize `apps/web/src/app/(landing)/terms/page.tsx` for your Terms of Service
- [ ] Review and customize `apps/web/src/app/(landing)/privacy/page.tsx` for your Privacy Policy
- [ ] Or set `NEXT_PUBLIC_TERMS_OF_SERVICE_URL` / `NEXT_PUBLIC_PRIVACY_POLICY_URL` to link to external pages instead

## Footer & Social
- [ ] Set `NEXT_PUBLIC_COPYRIGHT_NAME` and `NEXT_PUBLIC_COPYRIGHT_URL` in `.env`
- [ ] Set `NEXT_PUBLIC_SOCIAL_LINKS` with comma-separated URLs (icons auto-detected)

## Infrastructure
- [ ] Run the setup wizard (`/setup/{token}`) to configure the broadcaster account
- [ ] Verify Discord bot token and application credentials
- [ ] Verify Twitch application credentials
- [ ] Configure `BETTER_AUTH_SECRET` (min 32 chars: `openssl rand -hex 32`)
- [ ] Set `BETTER_AUTH_URL` to your production URL
- [ ] Set `CORS_ORIGIN` to your production URL
