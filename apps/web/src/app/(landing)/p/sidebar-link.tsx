"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

export default function SidebarLink({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  const cls = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    active
      ? "bg-surface-raised text-foreground"
      : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
  }`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {icon}
        {label}
        <ExternalLink className="ml-auto h-3 w-3 opacity-40" />
      </a>
    );
  }

  return (
    <Link href={href as Route} className={cls}>
      {icon}
      {label}
    </Link>
  );
}
