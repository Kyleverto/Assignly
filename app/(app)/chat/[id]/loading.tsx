import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <Skeleton className="size-5 rounded" />
        <Skeleton className="h-5 w-24" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
            >
              <Skeleton
                className={`h-10 rounded-xl ${i % 2 === 0 ? "w-48" : "w-64"}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="size-9 rounded-md" />
        </div>
      </div>
    </div>
  );
}
