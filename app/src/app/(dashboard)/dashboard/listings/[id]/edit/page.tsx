import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ListingEditor } from '@/components/dashboard/listing-editor';
import { getAmenities, getCategoryTree, getLocationTree } from '@/lib/api/queries';
import { apiFetch, ApiError } from '@/lib/api/client';
import { canListProperties, getAccessToken, getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import type { ListingDetail } from '@/lib/api/types';

export const metadata: Metadata = { title: 'Edit listing', robots: { index: false } };

export default async function EditListingPage(
  props: PageProps<'/dashboard/listings/[id]/edit'>,
) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!canListProperties(user)) redirect('/dashboard/listings');

  const { locale, t } = await getTranslations();
  const token = await getAccessToken();

  let listing: ListingDetail;
  try {
    // The viewer's token matters: an unpublished listing is only visible to its
    // own account and to staff.
    listing = await apiFetch<ListingDetail>(`/listings/${encodeURIComponent(id)}`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [{ data: regions }, { data: categories }, { data: amenities }] = await Promise.all([
    getLocationTree(),
    getCategoryTree(),
    getAmenities(),
  ]);

  return (
    <ListingEditor
      listing={listing}
      regions={regions}
      categories={categories}
      amenities={amenities}
      locale={locale}
      statusLabel={t(`status.${listing.status as 'DRAFT'}`)}
    />
  );
}
