import { describe, it, expect } from "vitest";
import { replaceTemplateVariables, buildCustomEmbed } from "./embeds.js";

describe("shared embeds", () => {
  describe("replaceTemplateVariables", () => {
    it("replaces a single variable", () => {
      expect(
        replaceTemplateVariables("{user} joined!", { user: "<@123>" })
      ).toBe("<@123> joined!");
    });

    it("replaces multiple variables in one string", () => {
      expect(
        replaceTemplateVariables("{displayName} joined {server}", {
          displayName: "Wolf",
          server: "My Server",
        })
      ).toBe("Wolf joined My Server");
    });

    it("handles repeated occurrences of the same variable", () => {
      expect(
        replaceTemplateVariables("{user} - {user}", { user: "<@123>" })
      ).toBe("<@123> - <@123>");
    });

    it("leaves unknown variables untouched", () => {
      expect(
        replaceTemplateVariables("{unknown} text", { user: "<@123>" })
      ).toBe("{unknown} text");
    });

    it("handles empty template string", () => {
      expect(replaceTemplateVariables("", { user: "<@123>" })).toBe("");
    });

    it("handles template with no variables (passthrough)", () => {
      expect(replaceTemplateVariables("Hello world", {})).toBe("Hello world");
    });
  });

  describe("buildCustomEmbed", () => {
    it("replaces all template variables", () => {
      const json = JSON.stringify({
        title: "Welcome {displayName}!",
        description: "You joined {server} as member #{memberCount}",
        footer: { text: "Enjoy your stay" },
      });

      const embed = buildCustomEmbed(json, {
        displayName: "Wolf",
        server: "My Server",
        memberCount: "1,234",
      });

      expect(embed).not.toBeNull();
      expect(embed!.data.title).toBe("Welcome Wolf!");
      expect(embed!.data.description).toBe(
        "You joined My Server as member #1,234"
      );
      expect(embed!.data.footer?.text).toBe("Enjoy your stay");
    });

    it("handles missing/undefined variables gracefully", () => {
      const json = JSON.stringify({
        title: "{displayName} - {unknown}",
      });

      const embed = buildCustomEmbed(json, { displayName: "Wolf" });
      expect(embed).not.toBeNull();
      expect(embed!.data.title).toBe("Wolf - {unknown}");
    });

    it("falls back to null on invalid JSON", () => {
      expect(buildCustomEmbed("not json", {})).toBeNull();
    });

    it("falls back to null on empty string", () => {
      expect(buildCustomEmbed("", {})).toBeNull();
    });

    it("preserves color value from JSON", () => {
      const json = JSON.stringify({ title: "Test", color: 0x3498db });
      const embed = buildCustomEmbed(json, {});
      expect(embed).not.toBeNull();
      expect(embed!.data.color).toBe(0x3498db);
    });

    it("handles fields array correctly", () => {
      const json = JSON.stringify({
        title: "Welcome",
        fields: [
          { name: "Server", value: "{server}", inline: true },
          { name: "Member", value: "{displayName}", inline: true },
        ],
      });

      const embed = buildCustomEmbed(json, {
        server: "My Server",
        displayName: "Wolf",
      });

      expect(embed).not.toBeNull();
      expect(embed!.data.fields).toHaveLength(2);
      expect(embed!.data.fields![0].value).toBe("My Server");
      expect(embed!.data.fields![1].value).toBe("Wolf");
    });

    it("returns null for non-object JSON", () => {
      expect(buildCustomEmbed('"just a string"', {})).toBeNull();
      expect(buildCustomEmbed("42", {})).toBeNull();
      expect(buildCustomEmbed("null", {})).toBeNull();
    });

    it("sets author with all fields", () => {
      const json = JSON.stringify({
        author: {
          name: "{displayName}",
          icon_url: "https://example.com/icon.png",
          url: "https://example.com",
        },
      });

      const embed = buildCustomEmbed(json, { displayName: "Wolf" });

      expect(embed).not.toBeNull();
      expect(embed!.data.author?.name).toBe("Wolf");
      expect(embed!.data.author?.url).toBe("https://example.com");
    });

    it("handles embed with only description", () => {
      const json = JSON.stringify({ description: "Welcome!" });
      const embed = buildCustomEmbed(json, {});
      expect(embed).not.toBeNull();
      expect(embed!.data.description).toBe("Welcome!");
    });
  });
});
