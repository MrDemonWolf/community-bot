"use client";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import Logo from "./logo";

export default function LandingHeader() {
  return (
    <div className="sticky top-0 z-50 flex justify-center px-4 py-3">
      <header className="glass flex w-full max-w-5xl items-center justify-between rounded-2xl px-3 py-1.5 sm:px-5 sm:py-2">
        <Logo />
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </header>
    </div>
  );
}
