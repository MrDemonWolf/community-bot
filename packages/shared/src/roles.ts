import { z } from "zod";

export const ROLES = ["guest", "viewer", "sub", "vip", "mod", "broadcaster"] as const;
export type Role = (typeof ROLES)[number];

export const RoleSchema = z.enum(ROLES);

const RANK: Record<Role, number> = {
  guest: 0,
  viewer: 1,
  sub: 2,
  vip: 3,
  mod: 4,
  broadcaster: 5,
};

export function roleRank(role: Role): number {
  return RANK[role];
}

export function hasRoleAtLeast(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}
