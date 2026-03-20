import { Skeleton } from "@/components/ui/skeleton";

interface KioskSkeletonListProps {
  count?: number;
}

export function KioskSkeletonList({ count = 4 }: KioskSkeletonListProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
          <Skeleton className="h-5 w-5 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function KioskSkeletonTiles({ count = 3 }: KioskSkeletonListProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-border bg-card min-h-[180px] justify-center">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="space-y-2 w-full flex flex-col items-center">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
