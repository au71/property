'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** Common reasons, so staff are not retyping the same sentence all day. */
const PRESET_REASONS = [
  'The photographs are too low quality to publish. Please upload clearer images.',
  'The description is missing key details about the property.',
  'The asking price appears to be a placeholder. Please correct it.',
  'The contact phone number could not be verified.',
];

export function ModerationActions({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function call(action: string, body?: unknown) {
    setPending(true);
    try {
      const response = await fetch(`/api/proxy/admin/listings/${listingId}/${action}`, {
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
      toast.success(action === 'approve' ? 'Published' : 'Rejected');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="success"
        disabled={pending}
        onClick={() => void call('approve')}
      >
        <IconCheck />
        Approve
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            <IconX />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this listing</DialogTitle>
            <DialogDescription>
              The reason is shown to the seller so they know what to fix.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="rounded-md border border-border px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {preset.slice(0, 34)}…
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="At least 5 characters"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length < 5}
              onClick={() => void call('reject', { reason: reason.trim() })}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
