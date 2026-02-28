"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogCloseButton,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import Image from "next/image";
import { getRoleDisplay } from "@/utils/roles";

type UserRole = "USER" | "MODERATOR" | "LEAD_MODERATOR" | "BROADCASTER";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "USER", label: "User" },
  { value: "MODERATOR", label: "Moderator" },
  { value: "LEAD_MODERATOR", label: "Lead Moderator" },
];

const PROVIDER_ICONS: Record<string, { label: string; className: string }> = {
  twitch: { label: "Twitch", className: "text-brand-twitch" },
  discord: { label: "Discord", className: "text-brand-discord" },
};

export default function UsersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [banDialogUser, setBanDialogUser] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [roleDialogUser, setRoleDialogUser] = useState<{
    id: string;
    name: string;
    role: UserRole;
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("USER");

  const listQueryOptions = trpc.userManagement.list.queryOptions({
    skip: page * pageSize,
    take: pageSize,
    search: search || undefined,
    role: roleFilter !== "ALL" ? roleFilter : undefined,
  });

  const { data, isLoading } = useQuery(listQueryOptions);

  const updateRoleMutation = useMutation(
    trpc.userManagement.updateRole.mutationOptions({
      onSuccess: () => {
        toast.success("Role updated.");
        queryClient.invalidateQueries({ queryKey: listQueryOptions.queryKey });
        setRoleDialogUser(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const banMutation = useMutation(
    trpc.userManagement.ban.mutationOptions({
      onSuccess: () => {
        toast.success("User banned.");
        queryClient.invalidateQueries({ queryKey: listQueryOptions.queryKey });
        setBanDialogUser(null);
        setBanReason("");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const unbanMutation = useMutation(
    trpc.userManagement.unban.mutationOptions({
      onSuccess: () => {
        toast.success("User unbanned.");
        queryClient.invalidateQueries({ queryKey: listQueryOptions.queryKey });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        User Management
      </h1>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(val) => {
            setRoleFilter(val as UserRole | "ALL");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="BROADCASTER">Broadcaster</SelectItem>
            <SelectItem value="LEAD_MODERATOR">Lead Mod</SelectItem>
            <SelectItem value="MODERATOR">Moderator</SelectItem>
            <SelectItem value="USER">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.users.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.users.map((user) => {
            const roleInfo = getRoleDisplay(user.role);
            const isBroadcaster = user.role === "BROADCASTER";

            return (
              <Card key={user.id}>
                <CardContent className="flex items-center gap-4 py-3">
                  {/* Avatar */}
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name}
                      width={40}
                      height={40}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay">
                      <UserCog className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {user.name}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleInfo.className}`}
                      >
                        {roleInfo.label}
                      </span>
                      {user.banned && (
                        <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          Banned
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="mt-1 flex gap-2">
                      {user.connectedAccounts.map((a) => {
                        const info = PROVIDER_ICONS[a.provider];
                        return info ? (
                          <span
                            key={a.provider}
                            className={`text-[10px] font-medium ${info.className}`}
                          >
                            {info.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* Joined date */}
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    <p>Joined</p>
                    <p>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  {!isBroadcaster && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRoleDialogUser({
                            id: user.id,
                            name: user.name,
                            role: user.role as UserRole,
                          });
                          setSelectedRole(user.role as UserRole);
                        }}
                      >
                        <UserCog className="size-3.5" />
                        Role
                      </Button>
                      {user.banned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            unbanMutation.mutate({ userId: user.id })
                          }
                          disabled={unbanMutation.isPending}
                        >
                          <ShieldCheck className="size-3.5" />
                          Unban
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setBanDialogUser({
                              id: user.id,
                              name: user.name,
                            })
                          }
                        >
                          <ShieldAlert className="size-3.5" />
                          Ban
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                {data.total} user{data.total !== 1 ? "s" : ""} total
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ban dialog */}
      <Dialog
        open={!!banDialogUser}
        onOpenChange={(open) => {
          if (!open) {
            setBanDialogUser(null);
            setBanReason("");
          }
        }}
      >
        <DialogPopup>
          <DialogTitle>Ban {banDialogUser?.name}?</DialogTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            This user will be suspended from accessing the dashboard.
          </p>
          <Input
            placeholder="Reason (optional)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            className="mb-4"
          />
          <div className="flex justify-end gap-2">
            <DialogCloseButton>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogCloseButton>
            <Button
              size="sm"
              variant="destructive"
              disabled={banMutation.isPending}
              onClick={() => {
                if (banDialogUser) {
                  banMutation.mutate({
                    userId: banDialogUser.id,
                    reason: banReason || undefined,
                  });
                }
              }}
            >
              {banMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Ban User
            </Button>
          </div>
        </DialogPopup>
      </Dialog>

      {/* Role dialog */}
      <Dialog
        open={!!roleDialogUser}
        onOpenChange={(open) => {
          if (!open) setRoleDialogUser(null);
        }}
      >
        <DialogPopup>
          <DialogTitle>Change Role for {roleDialogUser?.name}</DialogTitle>
          <div className="mb-4 mt-2">
            <Select
              value={selectedRole}
              onValueChange={(val) => setSelectedRole(val as UserRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <DialogCloseButton>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogCloseButton>
            <Button
              size="sm"
              disabled={
                updateRoleMutation.isPending ||
                selectedRole === roleDialogUser?.role
              }
              onClick={() => {
                if (roleDialogUser && selectedRole !== "BROADCASTER") {
                  updateRoleMutation.mutate({
                    userId: roleDialogUser.id,
                    role: selectedRole,
                  });
                }
              }}
            >
              {updateRoleMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Update Role
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
