"use client";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import Logo from "./logo";

export default function DashboardHeader() {
  return (
    <header className="glass-subtle sticky top-0 z-50 flex h-14 items-center justify-between px-5">
      <Logo className="text-lg font-bold tracking-tight" />
      <div className="flex items-center gap-2">
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
