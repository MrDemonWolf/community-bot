/**
 * Apple WeatherKit attribution helpers.
 *
 * Apple requires attribution wherever WeatherKit data is shown:
 *   - "Weather" logo (or text "Weather" with the Apple style)
 *   - Link to Apple's legal attribution page
 *   - Each data point: name of the data provider when known
 *
 * Failing to attribute is a ToS violation.
 *
 * Reference: https://developer.apple.com/weatherkit/get-started/
 *
 * NOTE: When `!weather` (Phase post-MVP) replies in Twitch chat (plain text),
 * include "via Apple Weather" suffix. When in Discord embed, set the
 * embed footer to "Weather" + the attribution URL as the embed URL.
 * When in dashboard widget, render the official Apple Weather attribution
 * mark (image) and link to the legal page in a tooltip/footer.
 */

export const APPLE_WEATHER_ATTRIBUTION_URL =
  "https://weatherkit.apple.com/legal-attribution.html";

export const APPLE_WEATHER_TEXT_SUFFIX = "via Apple Weather";

export const APPLE_WEATHER_DISCORD_EMBED_FOOTER = {
  text: "Weather",
  iconURL: undefined as string | undefined, // host the Apple-supplied PNG ourselves; do not hotlink
};

/**
 * Append the chat-friendly attribution suffix to a one-line weather string.
 * Twitch chat is plain text; we cannot link there, so we say it.
 */
export function withChatAttribution(line: string): string {
  return `${line} (${APPLE_WEATHER_TEXT_SUFFIX})`;
}

/**
 * Build a Discord embed footer object with attribution.
 * Call site supplies the icon URL once we host the Apple-provided mark.
 */
export function buildDiscordEmbedFooter(iconURL?: string) {
  return {
    text: APPLE_WEATHER_DISCORD_EMBED_FOOTER.text,
    iconURL: iconURL ?? APPLE_WEATHER_DISCORD_EMBED_FOOTER.iconURL,
  };
}

/**
 * Dashboard widget attribution payload. Frontend renders the Apple-supplied
 * "Weather" mark (image) and the legal-attribution URL must be a clickable link.
 */
export function buildDashboardAttribution() {
  return {
    label: "Weather",
    legalUrl: APPLE_WEATHER_ATTRIBUTION_URL,
  };
}

/**
 * Per-data-point provider attribution.
 * WeatherKit responses include a `metadata.attributionURL` and provider info.
 * Pass through; do not synthesize.
 */
export type WeatherKitMetadata = {
  attributionURL: string;
  expireTime: string;
  latitude: number;
  longitude: number;
  readTime: string;
  reportedTime?: string;
  units: "m" | "h"; // metric or imperial-hybrid
  version: number;
};

export function extractAttributionFromResponse(
  metadata: WeatherKitMetadata,
): { attributionUrl: string; readTime: string } {
  return {
    attributionUrl: metadata.attributionURL,
    readTime: metadata.readTime,
  };
}
