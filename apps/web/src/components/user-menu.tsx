"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

const ROLE_DISPLAY: Record<string, { label: string; className: string }> = {
  ADMIN: {
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

export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { data: profile } = useQuery({
    ...trpc.user.getProfile.queryOptions(),
    enabled: !!session,
  });

  if (isPending) {
    return <Skeleton className="h-9 w-9 rounded-full" />;
  }

  if (!session) {
    return (
      <Link href="/login">
        <Button
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-raised hover:text-foreground"
        >
          Sign In
        </Button>
      </Link>
    );
  }

  const roleInfo = ROLE_DISPLAY[profile?.role ?? "USER"] ?? ROLE_DISPLAY.USER;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex items-center gap-2 rounded-full border border-border bg-surface-raised py-1 pl-1 pr-1 text-sm font-medium text-foreground transition-colors hover:bg-surface-overlay sm:pl-3" />
        }
      >
        <span className="hidden sm:inline">{session.user.name}</span>
        {session.user.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={session.user.image}
            alt={session.user.name}
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-main text-xs font-bold text-white">
            {session.user.name.charAt(0).toUpperCase()}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 border-border bg-popover">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 text-foreground">
            <span className="font-semibold">{session.user.name}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleInfo.className}`}
            >
              {roleInfo.label}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <Link href="/dashboard/settings">
            <DropdownMenuItem className="gap-2 text-muted-foreground">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="gap-2 text-red-500 dark:text-red-400"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/");
                  },
                },
              });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
