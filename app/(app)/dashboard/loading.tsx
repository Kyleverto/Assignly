import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-20" />
      </div>

      <Skeleton className="h-48 rounded-2xl" />

      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
    </main>
  );
}
