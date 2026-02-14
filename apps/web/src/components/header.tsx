"use client";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import Logo from "./logo";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-white/60 backdrop-blur-xl backdrop-saturate-150 dark:bg-white/5">
      <div className="flex flex-row items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="flex gap-4 text-sm">
            <Link
              href="/"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
