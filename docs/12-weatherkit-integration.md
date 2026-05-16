# 12 — Apple WeatherKit integration

For `!weather <location>` command. Nathanial has an Apple Developer account with 500K req/mo limit — more than enough.

## Why WeatherKit

Free at 500K/mo for ADC members. Privacy-respecting (no user tracking). Quality data. Required attribution is simple.

## Auth — JWT bearer

WeatherKit REST requires a JWT signed with your private key from the Apple Developer portal.

Setup steps (Nathanial does these once in his developer account):

1. Apple Developer Portal → Certificates, Identifiers & Profiles
2. Identifiers → register a new Services ID for WeatherKit (e.g. `com.mrdemonwolf.communitybot.weather`)
3. Enable "WeatherKit" capability on that Services ID
4. Keys → register a new key, enable WeatherKit, download the `.p8` private key (one-time download!)
5. Note the Key ID and Team ID

Store in env:

- `WEATHERKIT_TEAM_ID`
- `WEATHERKIT_SERVICE_ID` (e.g. `com.mrdemonwolf.communitybot.weather`)
- `WEATHERKIT_KEY_ID`
- `WEATHERKIT_PRIVATE_KEY` (the contents of the `.p8` file, multi-line)

## JWT generation

`packages/shared/src/integrations/weatherkit/jwt.ts`:

```ts
import { SignJWT, importPKCS8 } from 'jose';

export async function generateWeatherKitJWT(): Promise<string> {
  const privateKey = await importPKCS8(env.WEATHERKIT_PRIVATE_KEY, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({
      alg: 'ES256',
      kid: env.WEATHERKIT_KEY_ID,
      id: `${env.WEATHERKIT_TEAM_ID}.${env.WEATHERKIT_SERVICE_ID}`,
    })
    .setIssuer(env.WEATHERKIT_TEAM_ID)
    .setSubject(env.WEATHERKIT_SERVICE_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)  // 1 hour
    .sign(privateKey);
}
```

Cache JWT for ~50 minutes (gives buffer before 60-min expiry).

## API endpoint

```
GET https://weatherkit.apple.com/api/v1/weather/{language}/{lat}/{lon}?dataSets=currentWeather,forecastDaily
Authorization: Bearer <jwt>
```

## Location resolution

Use OpenStreetMap Nominatim for city → lat/lon (free, no auth, attribute required):

```
GET https://nominatim.openstreetmap.org/search?q=Beloit+WI&format=json&limit=1
User-Agent: community-bot (admin@mrdemonwolf.com)
```

Cache geocoding results forever in `geocode_cache` table.

## Attribution (required)

Per WeatherKit terms:

- Display "Apple Weather" attribution near the weather data
- Link to https://weatherkit.apple.com/legal-attribution.html

Implementation:

- Chat: append " (via Apple Weather)" to weather messages
- Dashboard: footer note linking to the legal page when weather data is shown
- Public commands page: per-command source attribution row

## `!weather <location>` command (Phase 2+ Later)

Variable syntax in template: `${weather.<location>}` or args: `!weather Beloit WI`.

Response template (default):

```
${weather.summary} in ${weather.locationName}, currently ${weather.temp}°F (feels like ${weather.feelsLike}°F). High ${weather.highToday}°F, low ${weather.lowToday}°F. (via Apple Weather)
```

Cooldown: 60s per user. Global: 5s. 500K/mo cap means we could fire 10x per minute every minute of the year and stay under cap.

## Future: WeatherKit for other contexts

- Stream title generator (Phase 8) can pull current weather as context
- Schedule planning (Phase 6+) could include local forecast for upcoming streams

## Limits

- 500K requests / month (your tier)
- 600 requests / minute (Apple's hard limit)
- 50 forecasted days max (`forecastDaily`)
- 240 forecasted hours max (`forecastHourly`)
