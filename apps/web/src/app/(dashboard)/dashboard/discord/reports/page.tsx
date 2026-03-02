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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PlatformBadges } from "@/components/platform-badges";
import { canManageCommands } from "@/utils/roles";
import {
  AlertCircle,
  Loader2,
  Flag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-500/20 text-red-400",
  INVESTIGATING: "bg-yellow-500/20 text-yellow-400",
  RESOLVED: "bg-green-500/20 text-green-400",
  DISMISSED: "bg-muted text-muted-foreground",
};

export default function ReportsPage() {
  const { data: profile } = useQuery(trpc.user.getProfile.queryOptions());
  const canView = canManageCommands(profile?.role ?? "USER");

  if (!canView) {
    return (
      <div>
        <h1 className="mb-6 flex items-center gap-3 font-heading text-2xl font-bold text-foreground">
          Reports <PlatformBadges platforms={["discord"]} />
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You don't have permission to view reports.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-3 font-heading text-2xl font-bold text-foreground">
        Reports <PlatformBadges platforms={["discord"]} />
      </h1>
      <ReportList />
    </div>
  );
}

function ReportList() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery(
    trpc.discordCustomCommands.listReports.queryOptions({
      status: (statusFilter || undefined) as
        | "OPEN"
        | "INVESTIGATING"
        | "RESOLVED"
        | "DISMISSED"
        | undefined,
      limit: 50,
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Flag className="size-5" />
          User Reports
        </CardTitle>
        <CardDescription>
          Review user reports submitted via <code>/report user</code> in
          Discord.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select
            value={statusFilter || "_all"}
            onValueChange={(v) =>
              setStatusFilter(v === "_all" ? "" : v ?? "")
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Status</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="INVESTIGATING">Investigating</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="DISMISSED">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            <span>Failed to load reports.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : !data?.reports.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No reports found.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {data.reports.map((r) => (
              <div key={r.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 py-3 text-left transition-colors hover:bg-surface-raised/50"
                  onClick={() =>
                    setExpandedReport(
                      expandedReport === r.id ? null : r.id
                    )
                  }
                >
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[r.status]}`}
                  >
                    {r.status}
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">
                    {r.targetTag}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    by {r.reporterTag}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                  {expandedReport === r.id ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </button>
                {expandedReport === r.id && (
                  <ReportDetail report={r} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportDetail({
  report,
}: {
  report: {
    id: string;
    reporterTag: string;
    reporterId: string;
    targetTag: string;
    targetId: string;
    reason: string;
    status: string;
    resolvedBy: string | null;
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState("");
  const [resolution, setResolution] = useState("");

  const updateMutation = useMutation(
    trpc.discordCustomCommands.updateReportStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Report updated.");
        setNewStatus("");
        setResolution("");
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  return (
    <div className="space-y-3 border-t border-border/50 bg-surface-raised/30 px-4 py-3">
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        <div>
          <span className="text-xs text-muted-foreground">Reported User</span>
          <p className="font-medium text-foreground">{report.targetTag}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {report.targetId}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Reporter</span>
          <p className="font-medium text-foreground">{report.reporterTag}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Created</span>
          <p className="text-foreground">
            {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Reason</span>
        <p className="text-sm text-foreground">{report.reason}</p>
      </div>

      {report.resolution && (
        <div>
          <span className="text-xs text-muted-foreground">Resolution</span>
          <p className="text-sm text-foreground">{report.resolution}</p>
        </div>
      )}

      {report.status !== "RESOLVED" && report.status !== "DISMISSED" && (
        <div className="flex flex-wrap gap-2">
          <Select
            value={newStatus || "_select"}
            onValueChange={(v) => setNewStatus(v === "_select" ? "" : v ?? "")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Update status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_select" disabled>
                Update status...
              </SelectItem>
              <SelectItem value="INVESTIGATING">Investigating</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="DISMISSED">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          {(newStatus === "RESOLVED" || newStatus === "DISMISSED") && (
            <Input
              placeholder="Resolution notes..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="flex-1"
            />
          )}
          <Button
            size="sm"
            disabled={!newStatus || updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                reportId: report.id,
                status: newStatus as
                  | "INVESTIGATING"
                  | "RESOLVED"
                  | "DISMISSED",
                resolution: resolution || undefined,
              })
            }
          >
            {updateMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Update
          </Button>
        </div>
      )}
    </div>
  );
}
