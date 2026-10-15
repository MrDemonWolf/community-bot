import { expect, test } from "bun:test";
import { canAccess, twitchBadgeRoles, type Subject } from "./permissions";

test("platform roles never cross platforms or grant owner settings", () => {
  const subject: Subject = { owner: false, grants: [{ platform: "twitch", role: "admin", source: "test" }] };
  expect(canAccess(subject, "features:manage", "twitch")).toBe(true);
  expect(canAccess(subject, "features:manage", "discord")).toBe(false);
  expect(canAccess(subject, "integrations:manage", "twitch")).toBe(false);
  expect(canAccess(subject, "access:manage", "twitch")).toBe(false);
  expect(canAccess(subject, "features:manage")).toBe(false);
  expect(canAccess(subject, "dashboard:view")).toBe(true);
});
test("perks stay separate from management and expired evidence fails closed", () => {
  const subject: Subject = { owner: false, grants: [{ platform: "twitch", role: "vip", source: "test" }] };
  expect(canAccess(subject, "command:vip", "twitch")).toBe(true);
  expect(canAccess(subject, "command:subscriber", "twitch")).toBe(false);
  expect(canAccess(subject, "dashboard:view")).toBe(false);
  subject.grants = [{ platform: "discord", role: "moderator", source: "test", expiresAt: "2000-01-01T00:00:00Z" }];
  expect(canAccess(subject, "bot:mute", "discord")).toBe(false);
  expect(canAccess({ owner: true, grants: [] }, "access:manage")).toBe(true);
});
test("chat badges recognize subscribers, VIPs and lead mods without guessing from founder status", () => {
  expect(twitchBadgeRoles([{ setId: "vip" }, { setId: "subscriber" }, { setId: "lead_moderator" }])).toEqual(["viewer", "subscriber", "vip", "moderator", "lead_moderator"]);
  expect(twitchBadgeRoles([{ setId: "founder" }])).toEqual(["viewer"]);
});
