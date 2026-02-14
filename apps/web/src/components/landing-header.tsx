"use client";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import Logo from "./logo";

export default function LandingHeader() {
  return (
    <div className="sticky top-0 z-50 flex justify-center px-4 py-3">
      <header className="glass flex w-full max-w-5xl items-center justify-between rounded-2xl px-5 py-2">
        <div className="flex items-center gap-5">
          <Logo />
          <nav className="flex gap-1 text-sm">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              Home
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </header>
    </div>
  );
}
