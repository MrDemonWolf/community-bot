"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { getRoleDisplay } from "@/utils/roles";

import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

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

  const roleInfo = getRoleDisplay(
    profile?.role ?? "USER",
    profile?.isChannelOwner
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex items-center gap-2 rounded-full border border-border bg-surface-raised py-1 pl-1 pr-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-overlay sm:pl-3" />
        }
      >
        <span className="hidden sm:inline">{session.user.name}</span>
        {session.user.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={session.user.image}
            alt={session.user.name}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-main text-xs font-bold text-white">
            {session.user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 border-border bg-popover">
        <div className="flex items-center gap-3 px-3 py-3">
          {session.user.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={session.user.image}
              alt={session.user.name}
              width={40}
              height={40}
              className="shrink-0 rounded-full"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-main text-sm font-bold text-white">
              {session.user.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {session.user.name}
              </span>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleInfo.className}`}
              >
                {roleInfo.label}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuGroup>
          <Link href="/dashboard/settings">
            <DropdownMenuItem className="gap-2 py-2.5 text-muted-foreground">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="gap-2 py-2.5 text-red-500 dark:text-red-400"
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
