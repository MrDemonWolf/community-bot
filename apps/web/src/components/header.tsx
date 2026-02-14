"use client";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import Logo from "./logo";

export default function Header() {
  return (
    <div className="sticky top-0 z-50 flex justify-center px-4 py-3">
      <header className="flex w-full max-w-5xl items-center justify-between rounded-2xl border border-gray-200/60 bg-white/70 px-5 py-2 shadow-lg shadow-black/5 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-[#091533]/70 dark:shadow-black/20">
        <div className="flex items-center gap-5">
          <Logo />
          <nav className="flex gap-1 text-sm">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Dashboard
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
