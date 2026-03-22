/** Strip the leading '#' from a Twitch channel name. */
export function stripHash(channel: string): string {
  return channel.startsWith("#") ? channel.slice(1) : channel;
}
