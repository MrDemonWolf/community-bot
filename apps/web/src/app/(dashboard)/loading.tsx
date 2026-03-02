import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex h-svh flex-col">
      {/* Header placeholder */}
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
        <Skeleton className="h-6 w-32" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar placeholder */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-5 lg:block">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-full rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
        </aside>

        {/* Main content placeholder */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            <Skeleton className="mb-6 h-8 w-48" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
              <Skeleton className="h-96 rounded-xl" />
              <div className="space-y-6">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
