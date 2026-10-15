import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { decodeCroppedPng, discordAvatarUrl, sanitizeProfileImage, twitchAvatarUrl } from "./profile-image";

describe("personal profile image boundary", () => {
  test("reencodes a cropped PNG to a bounded, metadata-free square", async () => {
    const input = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#00ACED" } })
      .withMetadata({ exif: { IFD0: { Artist: "private fixture" } } }).png().toBuffer();
    const output = await sanitizeProfileImage(decodeCroppedPng(input.toString("base64")), true);
    const metadata = await sharp(output).metadata();
    expect([metadata.width, metadata.height, metadata.format]).toEqual([256, 256, "webp"]);
    expect(metadata.exif).toBeUndefined();
    expect(output.length).toBeLessThanOrEqual(256 * 1024);
  });
  test("rejects markup, broken base64, large payloads and non-square crops", async () => {
    expect(() => decodeCroppedPng(Buffer.from("<svg></svg>").toString("base64"))).toThrow();
    expect(() => decodeCroppedPng("%%%=")).toThrow();
    expect(() => decodeCroppedPng("A".repeat(700000))).toThrow();
    const rectangular = await sharp({ create: { width: 512, height: 256, channels: 3, background: "blue" } }).png().toBuffer();
    await expect(sanitizeProfileImage(rectangular, true)).rejects.toThrow("square PNG");
    await expect(sanitizeProfileImage(Buffer.from('<svg width="512" height="512"></svg>'))).rejects.toThrow();
  });
  test("limits provider image URLs to platform-owned paths", () => {
    expect(twitchAvatarUrl("https://static-cdn.jtvnw.net/jtv_user_pictures/fixture.png")).toContain("static-cdn.jtvnw.net");
    for (const url of ["http://static-cdn.jtvnw.net/jtv_user_pictures/a", "https://evil.example/a", "https://static-cdn.jtvnw.net:123/jtv_user_pictures/a", "https://static-cdn.jtvnw.net/other/a", "https://evil@static-cdn.jtvnw.net/jtv_user_pictures/a"]) expect(() => twitchAvatarUrl(url)).toThrow();
    expect(discordAvatarUrl({ id: "123456789012345678", avatar: null })).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
    expect(discordAvatarUrl({ id: "123456789012345678", avatar: null, discriminator: "1234" })).toBe("https://cdn.discordapp.com/embed/avatars/4.png");
    expect(() => discordAvatarUrl({ id: "123456789012345678", avatar: "../../private" })).toThrow();
  });
});
