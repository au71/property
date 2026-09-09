'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUSES = ['NEW', 'CONTACTED', 'CLOSED', 'SPAM'] as const;

export function EnquiryStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, setPending] = useState(false);

  async function change(next: string) {
    const previous = value;
    // Optimistic: the dropdown moves at once, and reverts if the write fails.
    setValue(next);
    setPending(true);
    try {
      const response = await fetch(`/api/proxy/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error('Could not update the enquiry');
      router.refresh();
    } catch (err) {
      setValue(previous);
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={value} onValueChange={(v) => void change(v)} disabled={pending}>
      <SelectTrigger className="h-8 w-36 text-xs" aria-label="Enquiry status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
