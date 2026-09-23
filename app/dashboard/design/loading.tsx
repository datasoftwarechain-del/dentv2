import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex-1 space-y-4 p-6">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
