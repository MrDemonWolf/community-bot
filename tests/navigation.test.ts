import { describe, expect, test } from "bun:test";
import type { Subject } from "../packages/core/src/permissions";
import { navigationFor, settingsSectionsFor } from "../apps/web/src/components/navigation";

function destinations(subject: Subject, publicPageEnabled = false) {
  return navigationFor(subject, publicPageEnabled).map((item) => item.href);
}

describe("platform-scoped dashboard navigation", () => {
  test("public channel navigation follows the creator's visibility preference for every role", () => {
    for (const subject of [{ owner: true, grants: [] }, { owner: false, grants: [{ platform: "twitch", role: "moderator", source: "test" }] }] satisfies Subject[]) {
      expect(destinations(subject, false)).not.toContain("/channel");
      expect(destinations(subject, true)).toContain("/channel");
    }
  });
  test("the creator can reach management, both platforms, and personal accounts", () => {
    const links = destinations({ owner: true, grants: [] });
    for (const route of ["/dashboard", "/dashboard/features", "/dashboard/rewards", "/dashboard/settings", "/setup", "/dashboard/access", "/access"]) expect(links).toContain(route);
  });
  test("a Discord admin gets Discord settings without Twitch rewards or creator controls", () => {
    const links = destinations({ owner: false, grants: [{ platform: "discord", role: "admin", source: "test" }] });
    expect(links).toContain("/dashboard/features");
    expect(links).toContain("/dashboard/settings");
    for (const route of ["/dashboard/rewards", "/dashboard/access", "/setup"]) expect(links).not.toContain(route);
  });
  test("a Twitch moderator gets the queue and personal settings without administration", () => {
    const links = destinations({ owner: false, grants: [{ platform: "twitch", role: "moderator", source: "test" }] });
    expect(links).toContain("/dashboard/rewards");
    expect(links).toContain("/dashboard/settings");
    for (const route of ["/dashboard/features", "/dashboard/access", "/setup"]) expect(links).not.toContain(route);
  });
  test("an unmapped member can reach personal access but no privileged destination", () => {
    const links = destinations({ owner: false, grants: [] });
    expect(links).toContain("/access");
    expect(links.some((route) => route.startsWith("/dashboard") || route === "/setup")).toBe(false);
  });
});

describe("settings section permissions", () => {
  test("the creator can reach every personal and workspace section", () => {
    expect(settingsSectionsFor({ owner: true, grants: [] }).map((section) => section.id)).toEqual([
      "profile-picture", "appearance", "preferences", "discord-presence", "discord-connection", "twitch-connection",
    ]);
  });
  test("Discord admins have personal settings and presence without credentials", () => {
    expect(settingsSectionsFor({ owner: false, grants: [{ platform: "discord", role: "admin", source: "test" }] }).map((section) => section.id)).toEqual([
      "profile-picture", "appearance", "discord-presence",
    ]);
  });
  test("Twitch moderators have only personal settings", () => {
    expect(settingsSectionsFor({ owner: false, grants: [{ platform: "twitch", role: "moderator", source: "test" }] }).map((section) => section.id)).toEqual([
      "profile-picture", "appearance",
    ]);
  });
  test("unmapped accounts have no dashboard settings destination", () => {
    expect(settingsSectionsFor({ owner: false, grants: [] })).toEqual([]);
  });
});
