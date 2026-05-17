import { describe, expect, test } from "bun:test";
import { hasRoleAtLeast, roleRank, RoleSchema } from "./roles";

describe("roles", () => {
  test("rank ordering", () => {
    expect(roleRank("guest")).toBeLessThan(roleRank("viewer"));
    expect(roleRank("viewer")).toBeLessThan(roleRank("sub"));
    expect(roleRank("sub")).toBeLessThan(roleRank("vip"));
    expect(roleRank("vip")).toBeLessThan(roleRank("mod"));
    expect(roleRank("mod")).toBeLessThan(roleRank("broadcaster"));
  });

  test("hasRoleAtLeast lets equal-or-higher through", () => {
    expect(hasRoleAtLeast("broadcaster", "mod")).toBe(true);
    expect(hasRoleAtLeast("mod", "mod")).toBe(true);
    expect(hasRoleAtLeast("vip", "mod")).toBe(false);
    expect(hasRoleAtLeast("guest", "viewer")).toBe(false);
  });

  test("RoleSchema rejects garbage", () => {
    expect(RoleSchema.safeParse("broadcaster").success).toBe(true);
    expect(RoleSchema.safeParse("admin").success).toBe(false);
  });
});
