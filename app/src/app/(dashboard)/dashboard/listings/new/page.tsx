import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ListingWizard } from '@/components/dashboard/listing-wizard';
import { getAmenities, getCategoryTree, getLocationTree } from '@/lib/api/queries';
import { canListProperties, getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'New listing', robots: { index: false } };

export default async function NewListingPage() {
  const user = await getCurrentUser();
  // A seeker has no business on this page; the API would refuse anyway, but
  // sending them to a form they cannot submit is a poor way to say so.
  if (!canListProperties(user)) redirect('/dashboard/listings');

  const { locale, t } = await getTranslations();
  const [{ data: regions }, { data: categories }, { data: amenities }] = await Promise.all([
    getLocationTree(),
    getCategoryTree(),
    getAmenities(),
  ]);

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('dashboard.newListing')}</h2>
      <ListingWizard
        regions={regions}
        categories={categories}
        amenities={amenities}
        locale={locale}
        defaultContact={{ name: user?.name ?? '', phone: user?.phone ?? '' }}
      />
    </div>
  );
}
