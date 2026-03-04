import type { ReactNode } from "react";
import { PlatformBadges } from "./platform-badges";

interface PageHeaderProps {
  title: string;
  platforms?: ("twitch" | "discord")[];
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, platforms, subtitle, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
          {title}
          {platforms && <PlatformBadges platforms={platforms} />}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}
