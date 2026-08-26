import { Skeleton, SkeletonText, SkeletonCard } from "@/components/ui/Skeleton";

export function PageLoader() {
  return (
    <div className="animate-in fade-in duration-200">
      <div className="mb-[25px] md:mb-[30px]">
        <Skeleton className="h-[28px] w-[200px] mb-[8px]" />
        <Skeleton className="h-[16px] w-[300px]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px] md:gap-[20px] mb-[25px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonCard />
    </div>
  );
}
