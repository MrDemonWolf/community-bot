"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  Users,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

type UserRole = "USER" | "MODERATOR" | "LEAD_MODERATOR" | "BROADCASTER";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "USER", label: "User" },
  { value: "MODERATOR", label: "Moderator" },
  { value: "LEAD_MODERATOR", label: "Lead Moderator" },
];

const ROLE_BADGE_VARIANT: Record<string, "broadcaster" | "lead-moderator" | "moderator" | "user"> = {
  BROADCASTER: "broadcaster",
  LEAD_MODERATOR: "lead-moderator",
  MODERATOR: "moderator",
  USER: "user",
};

const ROLE_LABEL: Record<string, string> = {
  BROADCASTER: "Broadcaster",
  LEAD_MODERATOR: "Lead Mod",
  MODERATOR: "Moderator",
  USER: "User",
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
  const [deleteDialogUser, setDeleteDialogUser] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  const deleteMutation = useMutation(
    trpc.userManagement.delete.mutationOptions({
      onSuccess: () => {
        toast.success("User deleted.");
        queryClient.invalidateQueries({ queryKey: listQueryOptions.queryKey });
        setDeleteDialogUser(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div>
      {/* Header with title and user count */}
      <PageHeader title="User Management">
        {data && (
          <Badge variant="secondary" className="text-sm">
            {data.total} user{data.total !== 1 ? "s" : ""}
          </Badge>
        )}
      </PageHeader>

      {/* Search + role filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="BROADCASTER">Broadcaster</SelectItem>
            <SelectItem value="LEAD_MODERATOR">Lead Moderator</SelectItem>
            <SelectItem value="MODERATOR">Moderator</SelectItem>
            <SelectItem value="USER">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.users.length ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="Try adjusting your search or filter criteria."
        />
      ) : (
        <div className="animate-fade-in space-y-4">
          {/* Table */}
          <Card className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-raised/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Avatar
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Name
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                      Email
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Role
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.users.map((user) => {
                    const isBroadcaster = user.role === "BROADCASTER";

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-surface-raised/50 ${
                          user.banned ? "bg-destructive/5" : ""
                        }`}
                      >
                        {/* Avatar */}
                        <td className="px-4 py-3">
                          {user.image ? (
                            <Image
                              src={user.image}
                              alt={user.name}
                              width={36}
                              height={36}
                              className="size-9 rounded-full ring-2 ring-border"
                              unoptimized
                            />
                          ) : (
                            <div className="flex size-9 items-center justify-center rounded-full bg-surface-overlay ring-2 ring-border">
                              <UserCog className="size-4 text-muted-foreground" />
                            </div>
                          )}
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {user.name}
                            </p>
                            {/* Show email inline on small screens where email column is hidden */}
                            <p className="truncate text-xs text-muted-foreground md:hidden">
                              {user.email}
                            </p>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="hidden px-4 py-3 md:table-cell">
                          <p className="truncate text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </td>

                        {/* Role badge */}
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Badge variant={ROLE_BADGE_VARIANT[user.role] ?? "user"}>
                            {ROLE_LABEL[user.role] ?? "User"}
                          </Badge>
                        </td>

                        {/* Status badge */}
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {user.banned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                            >
                              Active
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          {!isBroadcaster && (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Role change */}
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`Change role for ${user.name}`}
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
                                <span className="hidden lg:inline">Role</span>
                              </Button>

                              {/* Ban / Unban */}
                              {user.banned ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Unban ${user.name}`}
                                  onClick={() =>
                                    unbanMutation.mutate({ userId: user.id })
                                  }
                                  disabled={unbanMutation.isPending}
                                >
                                  <ShieldCheck className="size-3.5" />
                                  <span className="hidden lg:inline">
                                    Unban
                                  </span>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                  aria-label={`Ban ${user.name}`}
                                  onClick={() =>
                                    setBanDialogUser({
                                      id: user.id,
                                      name: user.name,
                                    })
                                  }
                                >
                                  <ShieldAlert className="size-3.5" />
                                  <span className="hidden lg:inline">Ban</span>
                                </Button>
                              )}

                              {/* Delete */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                aria-label={`Delete ${user.name}`}
                                onClick={() =>
                                  setDeleteDialogUser({
                                    id: user.id,
                                    name: user.name,
                                  })
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–
                {Math.min((page + 1) * pageSize, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="size-4" />
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

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteDialogUser}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogUser(null);
        }}
      >
        <DialogPopup>
          <DialogTitle>Delete {deleteDialogUser?.name}?</DialogTitle>
          <p className="mb-4 text-sm text-muted-foreground">
            This will permanently remove this user account and all associated
            data. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <DialogCloseButton>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogCloseButton>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteDialogUser) {
                  deleteMutation.mutate({ userId: deleteDialogUser.id });
                }
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Delete User
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
