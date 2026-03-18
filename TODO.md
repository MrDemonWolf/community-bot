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
