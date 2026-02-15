"use client";

import { useState } from "react";
import Logo from "./logo";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { Sheet, SheetTrigger, SheetClose, SheetContent } from "./ui/sheet";
import { SidebarContent } from "@/app/(dashboard)/components/dashboard-sidebar";
import { Menu, X } from "lucide-react";
import type { authClient } from "@/lib/auth-client";

export default function DashboardHeader({
  session,
}: {
  session?: typeof authClient.$Infer.Session;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass-subtle sticky top-0 z-50 flex h-14 items-center justify-between px-4 sm:px-5">
      <div className="flex items-center gap-3">
        {session && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground lg:hidden">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent>
              {/* Drawer header */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                <Logo className="text-lg font-bold tracking-tight" />
                <SheetClose className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground">
                  <X className="h-4 w-4" />
                </SheetClose>
              </div>
              {/* Scrollable nav */}
              <div className="flex-1 overflow-y-auto">
                <SidebarContent
                  session={session}
                  onNavigate={() => setOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
        <Logo className="text-lg font-bold tracking-tight" />
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
