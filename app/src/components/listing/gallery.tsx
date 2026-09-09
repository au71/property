'use client';

import Image from 'next/image';
import { useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconPhoto } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface MediaItem {
  id?: string;
  url?: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
}

export function Gallery({
  media,
  title,
  emptyLabel,
}: {
  media: MediaItem[];
  title: string;
  emptyLabel: string;
}) {
  const [index, setIndex] = useState(0);

  if (media.length === 0) {
    return (
      <div className="flex aspect-16/10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <IconPhoto className="size-10" aria-hidden />
        <span className="sr-only">{emptyLabel}</span>
      </div>
    );
  }

  const current = media[Math.min(index, media.length - 1)]!;
  const move = (delta: number) =>
    setIndex((i) => (i + delta + media.length) % media.length);

  return (
    <div>
      <div
        className="relative aspect-16/10 overflow-hidden rounded-xl bg-muted"
        // Arrow keys are how people actually page through a gallery.
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') move(-1);
          if (e.key === 'ArrowRight') move(1);
        }}
        tabIndex={0}
        role="group"
        aria-label={`${title} — image ${index + 1} of ${media.length}`}
      >
        {current.url && (
          <Image
            src={current.url}
            alt={`${title} — image ${index + 1}`}
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
            priority
          />
        )}

        {media.length > 1 && (
          <>
            <GalleryButton side="left" onClick={() => move(-1)} />
            <GalleryButton side="right" onClick={() => move(1)} />
            <span className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
              {index + 1} / {media.length}
            </span>
          </>
        )}
      </div>

      {media.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {media.map((item, i) => (
            <li key={item.id ?? i}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'relative block size-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors sm:size-20',
                  i === index ? 'border-primary' : 'border-transparent hover:border-border',
                )}
              >
                {item.thumbUrl && (
                  <Image src={item.thumbUrl} alt="" fill sizes="80px" className="object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GalleryButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? IconChevronLeft : IconChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous image' : 'Next image'}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
