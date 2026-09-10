'use client';

import type { ReactNode } from 'react';
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
import {
  LAKH,
  amenitiesFor,
  leafCategories,
  type FieldSet,
  type ListingFormState,
  type ValidationErrors,
} from '@/lib/listing/form';
import type { CategoryNode, Named, RegionNode } from '@/lib/api/types';
import type { Locale } from '@/lib/format';

/**
 * The listing form's field groups, shared by the create wizard and the edit
 * page. Defining them once means the two screens cannot drift apart — a field
 * added for creating is automatically editable.
 */

export interface FieldProps {
  form: ListingFormState;
  set: <K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) => void;
  errors: ValidationErrors;
  locale: Locale;
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const name = (item: { nameEn: string; nameMy: string }, locale: Locale) =>
  locale === 'my' ? item.nameMy : item.nameEn;

export function DealTypeAndCategory({
  form,
  set,
  errors,
  locale,
  categories,
}: FieldProps & { categories: CategoryNode[] }) {
  return (
    <>
      <Tabs value={form.dealType} onValueChange={(v) => set('dealType', v as 'SALE' | 'RENT')}>
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
            {leafCategories(categories).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {name(category.parent, locale)} · {name(category, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

export function LocationFields({
  form,
  set,
  errors,
  locale,
  regions,
}: FieldProps & { regions: RegionNode[] }) {
  return (
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
                    {name(township, locale)} · {name(city, locale)}
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
  );
}

export function DetailFields({
  form,
  set,
  errors,
  locale,
  fieldSet,
  amenities,
}: FieldProps & { fieldSet: FieldSet; amenities: Named[] }) {
  const digits = (v: string) => v.replace(/\D/g, '');

  return (
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
              onChange={(e) => set('bedrooms', digits(e.target.value))}
            />
          </Field>
          <Field label="Bathrooms">
            <Input
              inputMode="numeric"
              value={form.bathrooms}
              onChange={(e) => set('bathrooms', digits(e.target.value))}
            />
          </Field>
          <Field label="Floor area (sqft)">
            <Input
              inputMode="numeric"
              value={form.floorAreaSqft}
              onChange={(e) => set('floorAreaSqft', digits(e.target.value))}
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
              onChange={(e) => set('landWidthFt', digits(e.target.value))}
            />
          </Field>
          <Field label="Length (ft)">
            <Input
              inputMode="numeric"
              value={form.landLengthFt}
              onChange={(e) => set('landLengthFt', digits(e.target.value))}
            />
          </Field>
        </div>
      )}

      {fieldSet === 'COMMERCIAL' && (
        <Field label="Floor area (sqft)">
          <Input
            inputMode="numeric"
            value={form.floorAreaSqft}
            onChange={(e) => set('floorAreaSqft', digits(e.target.value))}
          />
        </Field>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Amenities</legend>
        <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {amenitiesFor(amenities, fieldSet).map((amenity) => (
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
              {name(amenity, locale)}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function PriceAndContactFields({
  form,
  set,
  errors,
  showOwnerDetails,
  onToggleOwnerDetails,
}: FieldProps & { showOwnerDetails: boolean; onToggleOwnerDetails: (on: boolean) => void }) {
  const digits = (v: string) => v.replace(/\D/g, '');

  return (
    <>
      <Field
        label={form.dealType === 'SALE' ? 'Asking price (lakh / သိန်း)' : 'Monthly rent (lakh / သိန်း)'}
        error={errors['priceLakh']}
        {...(form.priceLakh
          ? { hint: `= ${(Number(form.priceLakh) * LAKH).toLocaleString('en-US')} MMK` }
          : {})}
      >
        <Input
          inputMode="numeric"
          value={form.priceLakh}
          onChange={(e) => set('priceLakh', digits(e.target.value))}
          placeholder="2500"
        />
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
              onChange={(e) => set('advanceMonths', digits(e.target.value))}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" error={errors['contactName']}>
          <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
        </Field>
        <Field label="Contact phone" error={errors['contactPhone']}>
          <Input
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            placeholder="09xxxxxxxxx"
          />
        </Field>
      </div>

      <div className="rounded-lg border border-border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={showOwnerDetails}
            onCheckedChange={(v) => onToggleOwnerDetails(v === true)}
          />
          I am listing this on behalf of the owner
        </label>

        {showOwnerDetails && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              The owner does not need an account. These details are private — only you and portal
              staff can see them, never buyers.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner’s name">
                <Input
                  value={form.propertyOwnerName}
                  onChange={(e) => set('propertyOwnerName', e.target.value)}
                />
              </Field>
              <Field label="Owner’s phone">
                <Input
                  value={form.propertyOwnerPhone}
                  onChange={(e) => set('propertyOwnerPhone', e.target.value)}
                  placeholder="09xxxxxxxxx"
                />
              </Field>
            </div>
            <Field label="Note (optional)">
              <Input
                value={form.propertyOwnerNote}
                onChange={(e) => set('propertyOwnerNote', e.target.value)}
                placeholder="Prefers viewings at the weekend"
              />
            </Field>
          </div>
        )}
      </div>
    </>
  );
}
