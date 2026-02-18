export const ACCESS_HIERARCHY: Record<string, number> = {
  EVERYONE: 0,
  SUBSCRIBER: 1,
  REGULAR: 2,
  VIP: 3,
  MODERATOR: 4,
  LEAD_MODERATOR: 5,
  BROADCASTER: 6,
};

export function meetsAccessLevel(
  userLevel: string,
  requiredLevel: string
): boolean {
  return ACCESS_HIERARCHY[userLevel] >= ACCESS_HIERARCHY[requiredLevel];
}
