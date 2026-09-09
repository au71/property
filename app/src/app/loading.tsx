import { ListingCardSkeleton } from '@/components/listing/listing-card';

export default function Loading() {
  return (
    <div className="container-page py-10">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
