'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CategoryNode, RegionNode } from '@/lib/api/types';
import type { Locale } from '@/lib/format';

const ANY = '__any__';

interface Props {
  regions: RegionNode[];
  categories: CategoryNode[];
  locale: Locale;
  labels: {
    buy: string;
    rent: string;
    placeholder: string;
    search: string;
    location: string;
    category: string;
    any: string;
  };
}

export function HomeSearch({ regions, categories, locale, labels }: Props) {
  const router = useRouter();
  const [dealType, setDealType] = useState<'buy' | 'rent'>('buy');
  const [q, setQ] = useState('');
  const [township, setTownship] = useState(ANY);
  const [category, setCategory] = useState(ANY);

  const name = (item: { nameEn: string; nameMy: string }) =>
    locale === 'my' ? item.nameMy : item.nameEn;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (township !== ANY) params.set('townshipSlug', township);
    if (category !== ANY) params.set('categorySlug', category);
    const query = params.toString();
    router.push(`/${dealType}${query ? `?${query}` : ''}`);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <Tabs value={dealType} onValueChange={(v) => setDealType(v as 'buy' | 'rent')}>
        <TabsList>
          <TabsTrigger value="buy">{labels.buy}</TabsTrigger>
          <TabsTrigger value="rent">{labels.rent}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
        />

        <Select value={township} onValueChange={setTownship}>
          <SelectTrigger className="md:w-44" aria-label={labels.location}>
            <SelectValue placeholder={labels.location} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{labels.any}</SelectItem>
            {regions.flatMap((region) =>
              region.cities.flatMap((city) =>
                city.townships.map((t) => (
                  <SelectItem key={t.id} value={t.slug}>
                    {name(t)} · {name(city)}
                  </SelectItem>
                )),
              ),
            )}
          </SelectContent>
        </Select>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="md:w-44" aria-label={labels.category}>
            <SelectValue placeholder={labels.category} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{labels.any}</SelectItem>
            {categories.flatMap((parent) =>
              (parent.children ?? []).map((child) => (
                <SelectItem key={child.id} value={child.slug}>
                  {name(child)}
                </SelectItem>
              )),
            )}
          </SelectContent>
        </Select>

        <Button type="submit">
          <IconSearch />
          {labels.search}
        </Button>
      </div>
    </form>
  );
}
