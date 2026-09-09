'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SortSelect({
  label,
  options,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('sort') ?? 'newest';

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'newest') params.delete('sort');
    else params.set('sort', value);
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  }

  return (
    <Select value={current} onValueChange={change}>
      <SelectTrigger className="w-52" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
