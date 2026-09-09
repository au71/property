'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconAdjustmentsHorizontal, IconSearch } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { CategoryNode, Named, RegionNode } from '@/lib/api/types';
import type { Locale } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Labels {
  filters: string;
  clear: string;
  apply: string;
  category: string;
  location: string;
  price: string;
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  amenities: string;
  any: string;
  search: string;
  placeholder: string;
}

interface Props {
  regions: RegionNode[];
  categories: CategoryNode[];
  amenities: Named[];
  locale: Locale;
  dealType: string;
  labels: Labels;
}

/** Prices are entered in lakh, the unit people actually think in. */
const LAKH = 100_000;

export function FilterPanel(props: Props) {
  return (
    <>
      {/* Desktop: a persistent sidebar. */}
      <aside className="hidden w-72 shrink-0 lg:block">
        <FilterForm {...props} />
      </aside>

      {/* Mobile: the same form inside a sheet, so there is one implementation. */}
      <div className="lg:hidden">
        <MobileFilters {...props} />
      </div>
    </>
  );
}

function MobileFilters(props: Props) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const count = countActive(searchParams);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          <IconAdjustmentsHorizontal />
          {props.labels.filters}
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>{props.labels.filters}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto p-4">
          <FilterForm {...props} onApplied={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function countActive(params: URLSearchParams): number {
  let count = 0;
  for (const key of ['q', 'minPrice', 'maxPrice', 'bedroomsMin']) {
    if (params.get(key)) count += 1;
  }
  for (const key of ['categorySlug', 'townshipSlug', 'amenityId']) {
    const value = params.get(key);
    if (value) count += value.split(',').filter(Boolean).length;
  }
  return count;
}

function FilterForm({
  regions,
  categories,
  amenities,
  locale,
  dealType,
  labels,
  onApplied,
}: Props & { onApplied?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const name = (item: { nameEn: string; nameMy: string }) =>
    locale === 'my' ? item.nameMy : item.nameEn;

  const csv = (key: string) => (searchParams.get(key) ?? '').split(',').filter(Boolean);

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [categorySlugs, setCategorySlugs] = useState<string[]>(csv('categorySlug'));
  const [townshipSlugs, setTownshipSlugs] = useState<string[]>(csv('townshipSlug'));
  const [amenityIds, setAmenityIds] = useState<string[]>(csv('amenityId'));
  const [minLakh, setMinLakh] = useState(toLakh(searchParams.get('minPrice')));
  const [maxLakh, setMaxLakh] = useState(toLakh(searchParams.get('maxPrice')));
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedroomsMin') ?? '');

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    const sort = searchParams.get('sort');
    if (sort) params.set('sort', sort);
    if (q.trim()) params.set('q', q.trim());
    if (categorySlugs.length) params.set('categorySlug', categorySlugs.join(','));
    if (townshipSlugs.length) params.set('townshipSlug', townshipSlugs.join(','));
    if (amenityIds.length) params.set('amenityId', amenityIds.join(','));
    if (minLakh) params.set('minPrice', String(Number(minLakh) * LAKH));
    if (maxLakh) params.set('maxPrice', String(Number(maxLakh) * LAKH));
    if (bedrooms) params.set('bedroomsMin', bedrooms);

    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
    onApplied?.();
  }

  function clear() {
    setQ('');
    setCategorySlugs([]);
    setTownshipSlugs([]);
    setAmenityIds([]);
    setMinLakh('');
    setMaxLakh('');
    setBedrooms('');
    router.push(`/${dealType}`);
    onApplied?.();
  }

  return (
    <form onSubmit={apply} className="space-y-5 rounded-xl border border-border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="filter-q">{labels.search}</Label>
        <div className="flex gap-2">
          <Input
            id="filter-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.placeholder}
          />
          <Button type="submit" size="icon" aria-label={labels.search}>
            <IconSearch />
          </Button>
        </div>
      </div>

      <Separator />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{labels.price} (သိန်း / lakh)</legend>
        <div className="flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={minLakh}
            onChange={(e) => setMinLakh(e.target.value.replace(/\D/g, ''))}
            placeholder={labels.minPrice}
            aria-label={labels.minPrice}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            inputMode="numeric"
            value={maxLakh}
            onChange={(e) => setMaxLakh(e.target.value.replace(/\D/g, ''))}
            placeholder={labels.maxPrice}
            aria-label={labels.maxPrice}
          />
        </div>
      </fieldset>

      <Separator />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{labels.bedrooms}</legend>
        <div className="flex flex-wrap gap-1.5">
          {['', '1', '2', '3', '4', '5'].map((value) => (
            <button
              key={value || 'any'}
              type="button"
              onClick={() => setBedrooms(value)}
              aria-pressed={bedrooms === value}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                bedrooms === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-accent',
              )}
            >
              {value ? `${value}+` : labels.any}
            </button>
          ))}
        </div>
      </fieldset>

      <Separator />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{labels.category}</legend>
        <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
          {categories.map((parent) => (
            <div key={parent.id}>
              <p className="text-xs font-semibold text-muted-foreground">{name(parent)}</p>
              <div className="mt-1 space-y-1.5">
                {(parent.children ?? []).map((child) => (
                  <div key={child.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${child.id}`}
                      checked={categorySlugs.includes(child.slug)}
                      onCheckedChange={() => toggle(categorySlugs, child.slug, setCategorySlugs)}
                    />
                    <Label htmlFor={`cat-${child.id}`} className="font-normal">
                      {name(child)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <Separator />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{labels.location}</legend>
        <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
          {regions.flatMap((region) =>
            region.cities.map((city) => (
              <div key={city.id}>
                <p className="text-xs font-semibold text-muted-foreground">{name(city)}</p>
                <div className="mt-1 space-y-1.5">
                  {city.townships.map((township) => (
                    <div key={township.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`twn-${township.id}`}
                        checked={townshipSlugs.includes(township.slug)}
                        onCheckedChange={() =>
                          toggle(townshipSlugs, township.slug, setTownshipSlugs)
                        }
                      />
                      <Label htmlFor={`twn-${township.id}`} className="font-normal">
                        {name(township)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )),
          )}
        </div>
      </fieldset>

      <Separator />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{labels.amenities}</legend>
        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {amenities.map((amenity) => (
            <div key={amenity.id} className="flex items-center gap-2">
              <Checkbox
                id={`am-${amenity.id}`}
                checked={amenityIds.includes(amenity.id)}
                onCheckedChange={() => toggle(amenityIds, amenity.id, setAmenityIds)}
              />
              <Label htmlFor={`am-${amenity.id}`} className="font-normal">
                {name(amenity)}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {labels.apply}
        </Button>
        <Button type="button" variant="ghost" onClick={clear}>
          {labels.clear}
        </Button>
      </div>
    </form>
  );
}

function toLakh(value: string | null): string {
  if (!value || !/^\d+$/.test(value)) return '';
  return String(Number(value) / LAKH);
}
