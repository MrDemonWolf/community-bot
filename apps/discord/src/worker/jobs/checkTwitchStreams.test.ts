import { describe, it, expect, vi } from "vitest";

vi.mock("@community-bot/db", () => ({
  prisma: {},
}));

vi.mock("../../twitch/api.js", () => ({
  getStreams: vi.fn(),
}));

vi.mock("../../twitch/embeds.js", () => ({
  buildLiveEmbed: vi.fn(),
  buildOfflineEmbed: vi.fn(),
  buildCustomEmbed: vi.fn(),
  formatDuration: vi.fn(),
}));

vi.mock("../../utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

import {
  resolveNotificationChannelId,
  resolveRoleMention,
} from "./checkTwitchStreams.js";

describe("checkTwitchStreams helpers", () => {
  describe("resolveNotificationChannelId", () => {
    it("uses per-channel notificationChannelId when set", () => {
      const result = resolveNotificationChannelId(
        { notificationChannelId: "ch-override" },
        { notificationChannelId: "ch-guild" }
      );
      expect(result).toBe("ch-override");
    });

    it("falls back to guild default when channel override is null", () => {
      const result = resolveNotificationChannelId(
        { notificationChannelId: null },
        { notificationChannelId: "ch-guild" }
      );
      expect(result).toBe("ch-guild");
    });

    it("returns null when both channel and guild are null", () => {
      const result = resolveNotificationChannelId(
        { notificationChannelId: null },
        { notificationChannelId: null }
      );
      expect(result).toBeNull();
    });
  });

  describe("resolveRoleMention", () => {
    it("uses per-channel notificationRoleId when set", () => {
      const result = resolveRoleMention(
        { notificationRoleId: "role-override" },
        { notificationRoleId: "role-guild" }
      );
      expect(result).toBe("<@&role-override>");
    });

    it("falls back to guild default when channel override is null", () => {
      const result = resolveRoleMention(
        { notificationRoleId: null },
        { notificationRoleId: "role-guild" }
      );
      expect(result).toBe("<@&role-guild>");
    });

    it("returns @everyone for 'everyone' role ID", () => {
      const result = resolveRoleMention(
        { notificationRoleId: "everyone" },
        { notificationRoleId: "role-guild" }
      );
      expect(result).toBe("@everyone");
    });

    it("returns empty string when both channel and guild are null", () => {
      const result = resolveRoleMention(
        { notificationRoleId: null },
        { notificationRoleId: null }
      );
      expect(result).toBe("");
    });

    it("handles guild 'everyone' fallback", () => {
      const result = resolveRoleMention(
        { notificationRoleId: null },
        { notificationRoleId: "everyone" }
      );
      expect(result).toBe("@everyone");
    });
  });
});
