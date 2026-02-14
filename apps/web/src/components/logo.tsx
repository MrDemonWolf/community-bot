"use client";

import Link from "next/link";
import Image from "next/image";

const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL;
const logoDarkUrl = process.env.NEXT_PUBLIC_LOGO_DARK_URL;

export default function Logo({ className }: { className?: string }) {
  if (!logoUrl) {
    return (
      <Link
        href="/"
        className={`text-lg font-bold tracking-tight ${className ?? ""}`}
      >
        <span className="text-brand-main">Community</span>{" "}
        <span>Bot</span>
      </Link>
    );
  }

  return (
    <Link href="/" className={className}>
      {/* Light mode logo (or only logo if no dark variant) */}
      <Image
        src={logoUrl}
        alt="Community Bot"
        width={140}
        height={32}
        className={logoDarkUrl ? "block dark:hidden" : "block"}
        unoptimized
      />
      {/* Dark mode logo (only if dark variant is set) */}
      {logoDarkUrl && (
        <Image
          src={logoDarkUrl}
          alt="Community Bot"
          width={140}
          height={32}
          className="hidden dark:block"
          unoptimized
        />
      )}
    </Link>
  );
}
