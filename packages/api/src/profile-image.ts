import sharp from "sharp";

export const MAX_IMAGE_BYTES = 512 * 1024;
const PNG = Buffer.from("89504e470d0a1a0a", "hex");

export function decodeCroppedPng(base64: string) {
  if (base64.length > 699052 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error("Upload a valid PNG image.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64 || bytes.length > MAX_IMAGE_BYTES || !bytes.subarray(0, 8).equals(PNG)) throw new Error("Upload a PNG no larger than 512 KB.");
  return bytes;
}

export async function sanitizeProfileImage(bytes: Buffer, cropped = false) {
  if (!bytes.length || bytes.length > (cropped ? MAX_IMAGE_BYTES : 5 * 1024 * 1024)) throw new Error("Image is too large.");
  const image = sharp(bytes, { limitInputPixels: 4_194_304, animated: false, failOn: "warning" });
  const metadata = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) throw new Error("Use a static PNG, JPEG, or WebP image.");
  if (cropped && (metadata.format !== "png" || !metadata.width || metadata.width !== metadata.height || metadata.width > 512)) throw new Error("Crop the image to a square PNG no larger than 512 pixels first.");
  // Sharp strips source metadata by default; three 256 KiB slots stay below 1 MB per person.
  const output = await image.rotate().resize(256, 256, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 }).timeout({ seconds: 5 }).toBuffer();
  if (output.length > 256 * 1024) throw new Error("Image could not be reduced below 256 KB.");
  return output;
}

export async function boundedFetch(url: string, init: RequestInit = {}, limit = 64 * 1024) {
  // Count streamed bytes as well as Content-Length; redirects must not escape the provider CDN allowlist.
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.body) throw new Error("The provider could not return this image.");
  if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw new Error("Provider response is too large."); }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error("Provider response is too large.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

export function twitchAvatarUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("The Twitch account has no profile image.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "static-cdn.jtvnw.net" || url.port || url.username || url.password || !url.pathname.startsWith("/jtv_user_pictures/")) throw new Error("Unexpected Twitch image location.");
  return url.toString();
}

export function discordAvatarUrl(user: { id: string; avatar: string | null; discriminator?: string }) {
  if (!/^\d{17,20}$/.test(user.id)) throw new Error("Invalid Discord account identity.");
  if (user.avatar && !/^(?:a_)?[a-f0-9]{32}$/.test(user.avatar)) throw new Error("Invalid Discord image.");
  const defaultIndex = user.discriminator && /^[0-9]{4}$/.test(user.discriminator) && user.discriminator !== "0000"
    ? Number(user.discriminator) % 5 : (BigInt(user.id) >> BigInt(22)) % BigInt(6);
  return user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
    : `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}
