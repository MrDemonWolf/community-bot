import type { Route } from "next";
import { ArrowUpRight, Gift, LayoutDashboard, Settings2, Shield, SlidersHorizontal, UserRound, Puzzle, type LucideIcon } from "lucide-react";
import { canAccess, type Subject } from "@community-bot/core/permissions";

export interface NavigationItem {
  id: string;
  href: Route;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
  section: "primary" | "tools" | "account";
  external?: boolean;
}

export function navigationFor(access: Subject): NavigationItem[] {
  const items: NavigationItem[] = [];
  if (canAccess(access, "dashboard:view")) items.push({ id: "home", href: "/dashboard", label: "Overview", mobileLabel: "Home", icon: LayoutDashboard, section: "primary" });
  if (canAccess(access, "features:manage", "discord") || canAccess(access, "features:manage", "twitch")) items.push({ id: "features", href: "/dashboard/features", label: "Features", icon: Puzzle, section: "primary" });
  if (canAccess(access, "redemptions:view", "twitch")) items.push({ id: "rewards", href: "/dashboard/rewards", label: "Channel points", mobileLabel: "Rewards", icon: Gift, section: "primary" });
  if (access.owner || canAccess(access, "presence:manage", "discord")) items.push({ id: "settings", href: "/dashboard/settings" as Route, label: "Settings", icon: SlidersHorizontal, section: "tools" });
  if (access.owner) items.push({ id: "setup", href: "/setup", label: "Guided setup", icon: Settings2, section: "tools" }, { id: "staff", href: "/dashboard/access", label: "Staff access", icon: Shield, section: "tools" });
  items.push({ id: "accounts", href: "/access", label: "My accounts", icon: UserRound, section: "account" }, { id: "public", href: "/channel", label: "Public channel", icon: ArrowUpRight, section: "account", external: true });
  return items;
}
