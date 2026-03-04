"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { canManageCommands, canControlBot } from "@/utils/roles";
import {
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Loader2,
  AlertCircle,
  Trash2,
  Plus,
  Shield,
} from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  BAN: "bg-red-500/20 text-red-400",
  TEMPBAN: "bg-red-500/20 text-red-400",
  KICK: "bg-orange-500/20 text-orange-400",
  WARN: "bg-yellow-500/20 text-yellow-400",
  MUTE: "bg-purple-500/20 text-purple-400",
  UNBAN: "bg-green-500/20 text-green-400",
  UNWARN: "bg-green-500/20 text-green-400",
  UNMUTE: "bg-green-500/20 text-green-400",
  NOTE: "bg-blue-500/20 text-blue-400",
};

export default function ModerationPage() {
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canView = canManageCommands(profile?.role ?? "USER");
  const canEdit = canControlBot(profile?.role ?? "USER");

  if (!canView) {
    return (
      <div>
        <PageHeader title="Moderation" platforms={["discord"]} />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You don't have permission to view moderation cases.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Moderation" platforms={["discord"]} />
      <div className="space-y-6">
        <CaseList />
        <ThresholdConfig canEdit={canEdit} />
      </div>
    </div>
  );
}

function CaseList() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resolvedFilter, setResolvedFilter] = useState<string>("");
  const [expandedCase, setExpandedCase] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery(
    trpc.discordModeration.listCases.queryOptions({
      search: search || undefined,
      type: (typeFilter || undefined) as
        | "BAN"
        | "TEMPBAN"
        | "KICK"
        | "WARN"
        | "MUTE"
        | "UNBAN"
        | "UNWARN"
        | "UNMUTE"
        | "NOTE"
        | undefined,
      resolved:
        resolvedFilter === "active"
          ? false
          : resolvedFilter === "resolved"
            ? true
            : undefined,
      limit: 50,
    })
  );

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="font-heading">Moderation Cases</CardTitle>
        <CardDescription>
          View and search moderation actions taken in your Discord server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={typeFilter || "_all"}
            onValueChange={(v) => setTypeFilter(v === "_all" ? "" : v ?? "")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Types</SelectItem>
              <SelectItem value="BAN">Ban</SelectItem>
              <SelectItem value="TEMPBAN">Tempban</SelectItem>
              <SelectItem value="KICK">Kick</SelectItem>
              <SelectItem value="WARN">Warn</SelectItem>
              <SelectItem value="MUTE">Mute</SelectItem>
              <SelectItem value="UNBAN">Unban</SelectItem>
              <SelectItem value="UNWARN">Unwarn</SelectItem>
              <SelectItem value="UNMUTE">Unmute</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={resolvedFilter || "_all"}
            onValueChange={(v) =>
              setResolvedFilter(v === "_all" ? "" : v ?? "")
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load cases.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : !data?.cases.length ? (
          <EmptyState
            icon={Shield}
            title="No moderation cases found"
            description="Moderation actions taken in your Discord server will appear here."
          />
        ) : (
          <div className="divide-y divide-border">
            {data.cases.map((c) => (
              <div key={c.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 py-3 text-left transition-colors hover:bg-surface-raised/50"
                  onClick={() =>
                    setExpandedCase(
                      expandedCase === c.caseNumber ? null : c.caseNumber
                    )
                  }
                >
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${TYPE_COLORS[c.type] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {c.type}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    #{c.caseNumber}
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">
                    {c.targetTag}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                  {c.resolved && (
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                      Resolved
                    </span>
                  )}
                  {expandedCase === c.caseNumber ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </button>
                {expandedCase === c.caseNumber && (
                  <CaseDetail caseNumber={c.caseNumber} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CaseDetail({ caseNumber }: { caseNumber: number }) {
  const [noteContent, setNoteContent] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    trpc.discordModeration.getCase.queryOptions({ caseNumber })
  );

  const addNoteMutation = useMutation(
    trpc.discordModeration.addNote.mutationOptions({
      onSuccess: () => {
        toast.success("Note added.");
        setNoteContent("");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  if (isLoading || !data) {
    return (
      <div className="px-4 pb-4">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border/50 bg-surface-raised/30 px-4 py-3">
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        <div>
          <span className="text-xs text-muted-foreground">Target</span>
          <p className="font-medium text-foreground">{data.targetTag}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {data.targetId}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Moderator</span>
          <p className="font-medium text-foreground">{data.moderatorTag}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Created</span>
          <p className="text-foreground">
            {new Date(data.createdAt).toLocaleString()}
          </p>
        </div>
        {data.duration && (
          <div>
            <span className="text-xs text-muted-foreground">Duration</span>
            <p className="text-foreground">{data.duration} minutes</p>
          </div>
        )}
        {data.expiresAt && (
          <div>
            <span className="text-xs text-muted-foreground">Expires</span>
            <p className="text-foreground">
              {new Date(data.expiresAt).toLocaleString()}
            </p>
          </div>
        )}
        {data.resolved && data.resolvedBy && (
          <div>
            <span className="text-xs text-muted-foreground">Resolved By</span>
            <p className="text-foreground">{data.resolvedBy}</p>
          </div>
        )}
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Reason</span>
        <p className="text-sm text-foreground">
          {data.reason ?? "No reason provided"}
        </p>
      </div>

      {data.notes.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Notes ({data.notes.length})
          </span>
          {data.notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg bg-card p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {note.authorTag}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Add a note..."
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && noteContent.trim()) {
              addNoteMutation.mutate({
                caseNumber,
                content: noteContent.trim(),
              });
            }
          }}
        />
        <Button
          size="sm"
          disabled={!noteContent.trim() || addNoteMutation.isPending}
          onClick={() =>
            addNoteMutation.mutate({
              caseNumber,
              content: noteContent.trim(),
            })
          }
        >
          {addNoteMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="size-4" />
          )}
          Add Note
        </Button>
      </div>
    </div>
  );
}

function ThresholdConfig({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [newCount, setNewCount] = useState("");
  const [newAction, setNewAction] = useState("BAN");
  const [newDuration, setNewDuration] = useState("");

  const { data: thresholds, isLoading } = useQuery(
    trpc.discordModeration.listThresholds.queryOptions()
  );

  const setMutation = useMutation(
    trpc.discordModeration.setThreshold.mutationOptions({
      onSuccess: () => {
        toast.success("Threshold saved.");
        setNewCount("");
        setNewDuration("");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.discordModeration.deleteThreshold.mutationOptions({
      onSuccess: () => {
        toast.success("Threshold removed.");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Shield className="size-5" />
          Warning Thresholds
        </CardTitle>
        <CardDescription>
          Configure automatic escalation when a user reaches a certain number of
          warnings. For example, auto-ban at 5 warnings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            {thresholds && thresholds.length > 0 ? (
              <div className="mb-4 space-y-2">
                {thresholds.map((t) => {
                  const actionLabel =
                    t.action === "MUTE"
                      ? `Mute (${t.duration}m)`
                      : t.action === "BAN"
                        ? "Ban"
                        : "Kick";
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2"
                    >
                      <span className="text-sm text-foreground">
                        At <strong>{t.count}</strong> warnings →{" "}
                        <strong>{actionLabel}</strong>
                      </span>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300"
                          disabled={deleteMutation.isPending}
                          onClick={() =>
                            deleteMutation.mutate({ count: t.count })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                No thresholds configured. Warnings won't trigger automatic
                actions.
              </p>
            )}

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  placeholder="Warning count"
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  className="w-[140px]"
                  min={1}
                  max={50}
                />
                <Select
                  value={newAction}
                  onValueChange={(v) => setNewAction(v ?? "BAN")}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAN">Ban</SelectItem>
                    <SelectItem value="KICK">Kick</SelectItem>
                    <SelectItem value="MUTE">Mute</SelectItem>
                  </SelectContent>
                </Select>
                {newAction === "MUTE" && (
                  <Input
                    type="number"
                    placeholder="Duration (min)"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-[140px]"
                    min={1}
                  />
                )}
                <Button
                  size="sm"
                  disabled={
                    !newCount ||
                    setMutation.isPending ||
                    (newAction === "MUTE" && !newDuration)
                  }
                  onClick={() =>
                    setMutation.mutate({
                      count: parseInt(newCount, 10),
                      action: newAction as "BAN" | "KICK" | "MUTE",
                      duration: newAction === "MUTE" ? parseInt(newDuration, 10) : null,
                    })
                  }
                >
                  {setMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Add
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
