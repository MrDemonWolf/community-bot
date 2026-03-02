import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPageLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Audit log skeleton */}
        <div className="rounded-xl border border-border bg-card">
          <div className="p-6 pb-0">
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side cards */}
        <div className="space-y-6">
          {/* Bot controls skeleton */}
          <div className="rounded-xl border border-border bg-card">
            <div className="p-6 pb-0">
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              </div>
            </div>
          </div>

          {/* Discord status skeleton */}
          <div className="rounded-xl border border-border bg-card">
            <div className="p-6 pb-0">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats skeleton */}
          <div className="rounded-xl border border-border bg-card">
            <div className="p-6 pb-0">
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
