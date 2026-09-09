'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { IconCheck, IconLoader2, IconUpload } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CategoryNode, Named, RegionNode } from '@/lib/api/types';
import type { Locale } from '@/lib/format';
import { cn } from '@/lib/utils';

const LAKH = 100_000;
const STEPS = ['Type', 'Location', 'Details', 'Price', 'Photos'] as const;

interface Props {
  regions: RegionNode[];
  categories: CategoryNode[];
  amenities: Named[];
  locale: Locale;
  defaultContact: { name: string; phone: string };
}

interface FormState {
  dealType: 'SALE' | 'RENT';
  categoryId: string;
  townshipId: string;
  addressLine: string;
  hideExactAddress: boolean;
  title: string;
  description: string;
  priceLakh: string;
  priceIsNegotiable: boolean;
  rentPeriod: 'MONTHLY' | 'YEARLY';
  advanceMonths: string;
  bedrooms: string;
  bathrooms: string;
  floorAreaSqft: string;
  landWidthFt: string;
  landLengthFt: string;
  contactName: string;
  contactPhone: string;
  amenityIds: string[];
}

export function ListingWizard({ regions, categories, amenities, locale, defaultContact }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({
    dealType: 'SALE',
    categoryId: '',
    townshipId: '',
    addressLine: '',
    hideExactAddress: false,
    title: '',
    description: '',
    priceLakh: '',
    priceIsNegotiable: false,
    rentPeriod: 'MONTHLY',
    advanceMonths: '6',
    bedrooms: '',
    bathrooms: '',
    floorAreaSqft: '',
    landWidthFt: '',
    landLengthFt: '',
    contactName: defaultContact.name,
    contactPhone: defaultContact.phone,
    amenityIds: [],
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const name = (item: { nameEn: string; nameMy: string }) =>
    locale === 'my' ? item.nameMy : item.nameEn;

  const leafCategories = useMemo(
    () => categories.flatMap((parent) => (parent.children ?? []).map((c) => ({ ...c, parent }))),
    [categories],
  );

  // Which attribute questions to ask follows the category's field set, so a
  // land listing is never asked how many bathrooms it has.
  const fieldSet = leafCategories.find((c) => c.id === form.categoryId)?.fieldSet ?? 'BUILDING';

  const relevantAmenities = amenities.filter(
    (a) => !('appliesTo' in a) || !a.appliesTo || a.appliesTo === fieldSet,
  );

  function validateStep(index: number): boolean {
    const found: Record<string, string> = {};
    if (index === 0 && !form.categoryId) found['categoryId'] = 'Choose a property type';
    if (index === 1 && !form.townshipId) found['townshipId'] = 'Choose a township';
    if (index === 2) {
      if (form.title.trim().length < 10) found['title'] = 'At least 10 characters';
      if (form.description.trim().length < 30) found['description'] = 'At least 30 characters';
    }
    if (index === 3) {
      if (!form.priceLakh) found['priceLakh'] = 'Enter a price';
      if (!form.contactName.trim()) found['contactName'] = 'Required';
      if (!form.contactPhone.trim()) found['contactPhone'] = 'Required';
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    for (let i = 0; i < 4; i += 1) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    if (files.length === 0) {
      toast.error('Add at least one photo — a listing cannot be reviewed without one.');
      return;
    }

    setPending(true);
    try {
      const payload: Record<string, unknown> = {
        dealType: form.dealType,
        categoryId: form.categoryId,
        townshipId: form.townshipId,
        title: form.title.trim(),
        description: form.description.trim(),
        priceAmount: String(Number(form.priceLakh) * LAKH),
        priceIsNegotiable: form.priceIsNegotiable,
        hideExactAddress: form.hideExactAddress,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        amenityIds: form.amenityIds,
      };
      if (form.addressLine.trim()) payload['addressLine'] = form.addressLine.trim();
      if (form.dealType === 'RENT') {
        payload['rentPeriod'] = form.rentPeriod;
        if (form.advanceMonths) payload['advanceMonths'] = Number(form.advanceMonths);
      }
      if (fieldSet === 'BUILDING') {
        if (form.bedrooms) payload['bedrooms'] = Number(form.bedrooms);
        if (form.bathrooms) payload['bathrooms'] = Number(form.bathrooms);
        if (form.floorAreaSqft) payload['floorAreaSqft'] = Number(form.floorAreaSqft);
      }
      if (fieldSet === 'LAND') {
        if (form.landWidthFt) payload['landWidthFt'] = Number(form.landWidthFt);
        if (form.landLengthFt) payload['landLengthFt'] = Number(form.landLengthFt);
      }
      if (fieldSet === 'COMMERCIAL' && form.floorAreaSqft) {
        payload['floorAreaSqft'] = Number(form.floorAreaSqft);
      }

      const created = await post('/api/proxy/listings', payload);
      const listingId = (created as { id: string }).id;

      const body = new FormData();
      for (const file of files) body.append('files', file);
      const upload = await fetch(`/api/proxy/listings/${listingId}/media`, {
        method: 'POST',
        body,
      });
      if (!upload.ok) throw new Error('The listing was saved but the photos did not upload.');

      await post(`/api/proxy/listings/${listingId}/submit`, undefined);

      toast.success('Submitted for review. Staff will publish it shortly.');
      router.push('/dashboard/listings');
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => index < step && setStep(index)}
              disabled={index > step}
              aria-current={index === step ? 'step' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                index === step && 'bg-primary text-primary-foreground',
                index < step && 'bg-secondary text-secondary-foreground hover:bg-accent',
                index > step && 'text-muted-foreground',
              )}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5 space-y-5 rounded-xl border border-border bg-card p-5">
        {step === 0 && (
          <>
            <Tabs
              value={form.dealType}
              onValueChange={(v) => set('dealType', v as 'SALE' | 'RENT')}
            >
              <TabsList>
                <TabsTrigger value="SALE">For sale</TabsTrigger>
                <TabsTrigger value="RENT">For rent</TabsTrigger>
              </TabsList>
            </Tabs>

            <Field label="Property type" error={errors['categoryId']}>
              <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a property type" />
                </SelectTrigger>
                <SelectContent>
                  {leafCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {name(category.parent)} · {name(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Township" error={errors['townshipId']}>
              <Select value={form.townshipId} onValueChange={(v) => set('townshipId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a township" />
                </SelectTrigger>
                <SelectContent>
                  {regions.flatMap((region) =>
                    region.cities.flatMap((city) =>
                      city.townships.map((township) => (
                        <SelectItem key={township.id} value={township.id}>
                          {name(township)} · {name(city)}
                        </SelectItem>
                      )),
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Street address (optional)">
              <Input
                value={form.addressLine}
                onChange={(e) => set('addressLine', e.target.value)}
                placeholder="No. 12, Pyay Road"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.hideExactAddress}
                onCheckedChange={(v) => set('hideExactAddress', v === true)}
              />
              Hide the exact address until someone enquires
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Title" error={errors['title']}>
              <Input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Two bedroom condo in Bahan with lift and parking"
              />
            </Field>

            <Field label="Description" error={errors['description']}>
              <Textarea
                rows={6}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Describe the property, the neighbourhood and what is included."
              />
            </Field>

            {fieldSet === 'BUILDING' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Bedrooms">
                  <Input
                    inputMode="numeric"
                    value={form.bedrooms}
                    onChange={(e) => set('bedrooms', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
                <Field label="Bathrooms">
                  <Input
                    inputMode="numeric"
                    value={form.bathrooms}
                    onChange={(e) => set('bathrooms', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
                <Field label="Floor area (sqft)">
                  <Input
                    inputMode="numeric"
                    value={form.floorAreaSqft}
                    onChange={(e) => set('floorAreaSqft', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
              </div>
            )}

            {fieldSet === 'LAND' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Width (ft)">
                  <Input
                    inputMode="numeric"
                    value={form.landWidthFt}
                    onChange={(e) => set('landWidthFt', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
                <Field label="Length (ft)">
                  <Input
                    inputMode="numeric"
                    value={form.landLengthFt}
                    onChange={(e) => set('landLengthFt', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
              </div>
            )}

            {fieldSet === 'COMMERCIAL' && (
              <Field label="Floor area (sqft)">
                <Input
                  inputMode="numeric"
                  value={form.floorAreaSqft}
                  onChange={(e) => set('floorAreaSqft', e.target.value.replace(/\D/g, ''))}
                />
              </Field>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Amenities</legend>
              <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {relevantAmenities.map((amenity) => (
                  <label key={amenity.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.amenityIds.includes(amenity.id)}
                      onCheckedChange={() =>
                        set(
                          'amenityIds',
                          form.amenityIds.includes(amenity.id)
                            ? form.amenityIds.filter((id) => id !== amenity.id)
                            : [...form.amenityIds, amenity.id],
                        )
                      }
                    />
                    {name(amenity)}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            <Field
              label={form.dealType === 'SALE' ? 'Asking price (lakh / သိန်း)' : 'Monthly rent (lakh / သိန်း)'}
              error={errors['priceLakh']}
            >
              <Input
                inputMode="numeric"
                value={form.priceLakh}
                onChange={(e) => set('priceLakh', e.target.value.replace(/\D/g, ''))}
                placeholder="2500"
              />
              {form.priceLakh && (
                <p className="mt-1 text-xs text-muted-foreground">
                  = {(Number(form.priceLakh) * LAKH).toLocaleString('en-US')} MMK
                </p>
              )}
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.priceIsNegotiable}
                onCheckedChange={(v) => set('priceIsNegotiable', v === true)}
              />
              Price is negotiable
            </label>

            {form.dealType === 'RENT' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Rent period">
                  <Select
                    value={form.rentPeriod}
                    onValueChange={(v) => set('rentPeriod', v as 'MONTHLY' | 'YEARLY')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Months in advance">
                  <Input
                    inputMode="numeric"
                    value={form.advanceMonths}
                    onChange={(e) => set('advanceMonths', e.target.value.replace(/\D/g, ''))}
                  />
                </Field>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" error={errors['contactName']}>
                <Input
                  value={form.contactName}
                  onChange={(e) => set('contactName', e.target.value)}
                />
              </Field>
              <Field label="Contact phone" error={errors['contactPhone']}>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value)}
                  placeholder="09xxxxxxxxx"
                />
              </Field>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Field label="Photos">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground hover:bg-accent">
                <IconUpload className="size-6" aria-hidden />
                Choose photos (up to 15)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 15))}
                />
              </label>
            </Field>

            {files.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="truncate rounded-md border border-border px-2 py-1.5 text-xs"
                  >
                    {file.name}
                  </li>
                ))}
              </ul>
            )}

            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Your listing goes to staff for review before it appears publicly. You will see it
              under “Awaiting review” until then.
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? <IconLoader2 className="animate-spin" /> : <IconCheck />}
            Submit for review
          </Button>
        )}
      </div>
    </div>
  );
}

async function post(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(message ?? 'Could not save the listing');
  }
  return payload;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
