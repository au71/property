import type { CategoryNode, ListingDetail, Named, RegionNode } from '@/lib/api/types';

/**
 * One definition of a listing form's state, shared by the create wizard and the
 * edit page. Both screens ask the same questions; only the layout differs — the
 * wizard walks through them in steps, editing shows them all at once.
 */

export const LAKH = 100_000;

export interface ListingFormState {
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
  propertyOwnerName: string;
  propertyOwnerPhone: string;
  propertyOwnerNote: string;
  amenityIds: string[];
}

export function emptyForm(contact: { name: string; phone: string }): ListingFormState {
  return {
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
    contactName: contact.name,
    contactPhone: contact.phone,
    propertyOwnerName: '',
    propertyOwnerPhone: '',
    propertyOwnerNote: '',
    amenityIds: [],
  };
}

const num = (v: unknown): string => (typeof v === 'number' ? String(v) : '');

/** Turns an API listing back into form state, for the edit page. */
export function formFromListing(listing: ListingDetail): ListingFormState {
  const attributes = (listing.attributes ?? {}) as Record<string, unknown>;
  const price = listing.price ?? {};
  const amount = price.amount ? BigInt(price.amount) : null;

  return {
    dealType: (listing.dealType as 'SALE' | 'RENT') ?? 'SALE',
    categoryId: listing.category?.id ?? '',
    townshipId: listing.township?.id ?? '',
    addressLine: listing.address ?? '',
    hideExactAddress: Boolean(listing.addressHidden),
    title: listing.title ?? '',
    description: listing.description ?? '',
    // Prices are entered in lakh, which is how they are quoted. Exact division:
    // the API only ever stores whole kyat.
    priceLakh: amount != null ? String(amount / BigInt(LAKH)) : '',
    priceIsNegotiable: Boolean(price.isNegotiable),
    rentPeriod: (price.rentPeriod as 'MONTHLY' | 'YEARLY') ?? 'MONTHLY',
    advanceMonths: num(price.advanceMonths),
    bedrooms: num(attributes['bedrooms']),
    bathrooms: num(attributes['bathrooms']),
    floorAreaSqft: num(attributes['floorAreaSqft']),
    landWidthFt: num(attributes['landWidthFt']),
    landLengthFt: num(attributes['landLengthFt']),
    contactName: listing.contact?.name ?? '',
    // Present only because the viewer can edit this listing; see the API's dto.
    contactPhone: listing.contact?.phone ?? '',
    propertyOwnerName: listing.propertyOwner?.name ?? '',
    propertyOwnerPhone: listing.propertyOwner?.phone ?? '',
    propertyOwnerNote: listing.propertyOwner?.note ?? '',
    amenityIds: (listing.amenities ?? []).map((a) => a.id),
  };
}

export type FieldSet = 'BUILDING' | 'LAND' | 'COMMERCIAL';

export function fieldSetFor(categories: CategoryNode[], categoryId: string): FieldSet {
  for (const parent of categories) {
    for (const child of parent.children ?? []) {
      if (child.id === categoryId) return child.fieldSet;
    }
  }
  return 'BUILDING';
}

export function leafCategories(categories: CategoryNode[]) {
  return categories.flatMap((parent) =>
    (parent.children ?? []).map((child) => ({ ...child, parent })),
  );
}

export function amenitiesFor(amenities: Named[], fieldSet: FieldSet) {
  return amenities.filter((a) => {
    const applies = (a as { appliesTo?: string | null }).appliesTo;
    return !applies || applies === fieldSet;
  });
}

export interface ValidationErrors {
  [field: string]: string;
}

/**
 * The same rules the API enforces, checked here so the user sees them beside the
 * field rather than as a rejected request.
 */
export function validate(form: ListingFormState, fieldSet: FieldSet): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.categoryId) errors['categoryId'] = 'Choose a property type';
  if (!form.townshipId) errors['townshipId'] = 'Choose a township';
  if (form.title.trim().length < 10) errors['title'] = 'At least 10 characters';
  if (form.description.trim().length < 30) errors['description'] = 'At least 30 characters';
  if (!form.priceLakh) errors['priceLakh'] = 'Enter a price';
  if (!form.contactName.trim()) errors['contactName'] = 'Required';
  if (!form.contactPhone.trim()) errors['contactPhone'] = 'Required';
  void fieldSet;
  return errors;
}

/** Builds the request body the API expects from the form state. */
export function toPayload(
  form: ListingFormState,
  fieldSet: FieldSet,
  options: { includeOwnerDetails: boolean },
): Record<string, unknown> {
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

  if (options.includeOwnerDetails) {
    if (form.propertyOwnerName.trim()) payload['propertyOwnerName'] = form.propertyOwnerName.trim();
    if (form.propertyOwnerPhone.trim())
      payload['propertyOwnerPhone'] = form.propertyOwnerPhone.trim();
    if (form.propertyOwnerNote.trim()) payload['propertyOwnerNote'] = form.propertyOwnerNote.trim();
  }

  return payload;
}

export type { CategoryNode, Named, RegionNode };
