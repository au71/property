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

const STATUSES = ['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'] as const;

export function ReportStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, setPending] = useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    try {
      const response = await fetch(`/api/proxy/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error('Could not update the report');
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
      <SelectTrigger className="h-8 w-36 text-xs" aria-label="Report status">
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
