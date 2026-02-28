import { describe, it, expect } from "vitest";
import { parseEmbedJson } from "./embed-preview";

describe("parseEmbedJson", () => {
  it("parses valid embed JSON into structured data", () => {
    const json = JSON.stringify({
      title: "Test Title",
      description: "Test Desc",
      color: 0x9146ff,
    });

    const result = parseEmbedJson(json);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Test Title");
    expect(result!.description).toBe("Test Desc");
    expect(result!.color).toBe(0x9146ff);
  });

  it("handles missing optional fields", () => {
    const json = JSON.stringify({ title: "Only Title" });
    const result = parseEmbedJson(json);

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Only Title");
    expect(result!.author).toBeUndefined();
    expect(result!.footer).toBeUndefined();
    expect(result!.thumbnail).toBeUndefined();
    expect(result!.fields).toBeUndefined();
  });

  it("returns null for invalid JSON", () => {
    expect(parseEmbedJson("not valid json")).toBeNull();
    expect(parseEmbedJson("{broken")).toBeNull();
  });

  it("returns null for empty string input", () => {
    expect(parseEmbedJson("")).toBeNull();
    expect(parseEmbedJson("   ")).toBeNull();
  });

  it("correctly parses color as hex number", () => {
    const json = JSON.stringify({ color: 5814783 }); // 0x58B9FF
    const result = parseEmbedJson(json);
    expect(result).not.toBeNull();
    expect(result!.color).toBe(5814783);
  });

  it("parses fields array with name/value/inline", () => {
    const json = JSON.stringify({
      fields: [
        { name: "Game", value: "Minecraft", inline: true },
        { name: "Status", value: "Online", inline: false },
      ],
    });

    const result = parseEmbedJson(json);
    expect(result).not.toBeNull();
    expect(result!.fields).toHaveLength(2);
    expect(result!.fields![0].name).toBe("Game");
    expect(result!.fields![0].value).toBe("Minecraft");
    expect(result!.fields![0].inline).toBe(true);
    expect(result!.fields![1].inline).toBe(false);
  });

  it("returns null for non-object JSON values", () => {
    expect(parseEmbedJson('"string"')).toBeNull();
    expect(parseEmbedJson("42")).toBeNull();
    expect(parseEmbedJson("null")).toBeNull();
    expect(parseEmbedJson("true")).toBeNull();
  });

  it("parses author with all fields", () => {
    const json = JSON.stringify({
      author: {
        name: "StreamerName",
        icon_url: "https://example.com/icon.png",
        url: "https://twitch.tv/streamer",
      },
    });

    const result = parseEmbedJson(json);
    expect(result).not.toBeNull();
    expect(result!.author?.name).toBe("StreamerName");
    expect(result!.author?.icon_url).toBe("https://example.com/icon.png");
    expect(result!.author?.url).toBe("https://twitch.tv/streamer");
  });
});
