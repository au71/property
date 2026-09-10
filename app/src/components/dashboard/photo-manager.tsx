'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconStar,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Photo {
  id: string;
  url: string;
  thumbUrl: string;
  isCover?: boolean;
}

/**
 * Manages photos on a listing that already exists. Until this, photos could only
 * be attached while creating — a seller told "your photos are too blurry" had no
 * way to replace them, which made rejection a dead end.
 *
 * Every change hits the API immediately rather than batching into a save, so
 * there is no half-applied state if the tab closes mid-edit.
 */
export function PhotoManager({
  listingId,
  initial,
  max = 15,
}: {
  listingId: string;
  initial: Photo[];
  max?: number;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (photos.length + files.length > max) {
      toast.error(`A listing can have at most ${max} photos.`);
      return;
    }

    setBusy('upload');
    try {
      const body = new FormData();
      for (const file of Array.from(files)) body.append('files', file);
      const res = await fetch(`/api/proxy/listings/${listingId}/media`, {
        method: 'POST',
        body,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? 'Upload failed');
      }
      const { data } = (await res.json()) as { data: Photo[] };
      setPhotos((current) => [...current, ...data]);
      toast.success(data.length === 1 ? 'Photo added' : `${data.length} photos added`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    const previous = photos;
    // Optimistic, because deleting a photo should feel instant.
    setPhotos((current) => current.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/proxy/media/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete that photo');
    } catch (err) {
      setPhotos(previous);
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reorder(from: number, to: number) {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);

    const previous = photos;
    // The first photo is the cover, so moving one can change which that is.
    setPhotos(next.map((p, i) => ({ ...p, isCover: i === 0 })));
    setBusy('reorder');
    try {
      const res = await fetch(`/api/proxy/listings/${listingId}/media/reorder`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderedIds: next.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error('Could not reorder the photos');
    } catch (err) {
      setPhotos(previous);
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {photos.length} of {max} photos. The first is the cover.
        </p>
        <label className="cursor-pointer">
          <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-accent">
            {busy === 'upload' ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconUpload className="size-4" />
            )}
            Add photos
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy !== null || photos.length >= max}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No photos yet. A listing needs at least one before it can be submitted.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              <div className="relative aspect-4/3 bg-muted">
                <Image
                  src={photo.thumbUrl}
                  alt={`Photo ${index + 1}`}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-success px-1.5 py-0.5 text-xs font-medium text-success-foreground">
                    <IconStar className="size-3" aria-hidden />
                    Cover
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={index === 0 || busy !== null}
                    onClick={() => void reorder(index, index - 1)}
                    aria-label={`Move photo ${index + 1} earlier`}
                  >
                    <IconArrowLeft className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={index === photos.length - 1 || busy !== null}
                    onClick={() => void reorder(index, index + 1)}
                    aria-label={`Move photo ${index + 1} later`}
                  >
                    <IconArrowRight className="size-4" />
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  disabled={busy !== null}
                  onClick={() => void remove(photo.id)}
                  aria-label={`Delete photo ${index + 1}`}
                >
                  <IconTrash className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
