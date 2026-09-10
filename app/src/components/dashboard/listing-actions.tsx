'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconPencil } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

interface Props {
  listingId: string;
  status: string;
  dealType: string;
}

/** Statuses whose listings the owner may still edit, matching the API's rule. */
const EDITABLE = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'EXPIRED'];

/**
 * Which actions an owner may take follows the API's own state machine, so the
 * UI never offers a button that would come back 403.
 */
export function ListingActions({ listingId, status, dealType }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function act(action: string, body?: unknown) {
    setPending(action);
    try {
      // Routed through our own API base so the httpOnly access cookie is
      // attached; the browser never holds the token itself.
      const response = await fetch(`/api/proxy/listings/${listingId}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? 'Action failed');
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setPending(null);
    }
  }

  const buttons: Array<{ key: string; label: string; run: () => Promise<void> }> = [];

  if (status === 'DRAFT' || status === 'REJECTED' || status === 'EXPIRED') {
    buttons.push({ key: 'submit', label: 'Submit for review', run: () => act('submit') });
  }
  if (status === 'PUBLISHED') {
    buttons.push({
      key: 'sold',
      label: dealType === 'SALE' ? 'Mark sold' : 'Mark rented',
      run: () => act('status', { status: dealType === 'SALE' ? 'SOLD' : 'RENTED' }),
    });
    buttons.push({ key: 'renew', label: 'Renew', run: () => act('renew') });
  }
  if (status !== 'ARCHIVED') {
    buttons.push({
      key: 'archive',
      label: 'Archive',
      run: () => act('status', { status: 'ARCHIVED' }),
    });
  }

  if (buttons.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {EDITABLE.includes(status) && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dashboard/listings/${listingId}/edit`}>
            <IconPencil />
            {status === 'REJECTED' ? 'Fix and resubmit' : 'Edit'}
          </Link>
        </Button>
      )}
      {buttons.map((button) => (
        <Button
          key={button.key}
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => void button.run()}
        >
          {pending === button.key ? '…' : button.label}
        </Button>
      ))}
    </div>
  );
}
