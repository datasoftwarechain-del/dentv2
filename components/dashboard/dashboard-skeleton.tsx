import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col">
      {/* Header skeleton */}
      <div className="sticky top-0 z-20 flex h-16 items-center justify-between px-6 bg-background/60 backdrop-blur-xl border-b border-border/40">
        <Skeleton className="h-6 w-44 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-6">
        {/* KPI cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="border border-border/60">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-20 rounded mb-2" />
                <Skeleton className="h-3 w-36 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main table/list skeleton */}
        <Card className="border border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
