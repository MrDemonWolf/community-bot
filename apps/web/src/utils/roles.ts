export const ROLE_DISPLAY: Record<
  string,
  { label: string; className: string }
> = {
  BROADCASTER: {
    label: "Owner",
    className: "bg-brand-main/15 text-brand-main",
  },
  LEAD_MODERATOR: {
    label: "Lead Mod",
    className: "bg-purple-500/15 text-purple-500",
  },
  MODERATOR: {
    label: "Moderator",
    className: "bg-green-500/15 text-green-500",
  },
  USER: {
    label: "User",
    className: "bg-muted text-muted-foreground",
  },
};

export function getRoleDisplay(
  role: string,
  isChannelOwner?: boolean
): { label: string; className: string } {
  if (role === "USER" && isChannelOwner) return ROLE_DISPLAY.BROADCASTER;
  return ROLE_DISPLAY[role] ?? ROLE_DISPLAY.USER;
}

export function canManageCommands(role: string): boolean {
  return ["MODERATOR", "LEAD_MODERATOR", "BROADCASTER"].includes(role);
}

export function canControlBot(role: string): boolean {
  return ["LEAD_MODERATOR", "BROADCASTER"].includes(role);
}

export function isBroadcaster(role: string): boolean {
  return role === "BROADCASTER";
}
