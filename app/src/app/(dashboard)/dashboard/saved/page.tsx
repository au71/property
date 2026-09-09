import type { Metadata } from 'next';
import { ListingGrid } from '@/components/listing/listing-grid';
import { apiFetch } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import type { ListingSummary } from '@/lib/api/types';

export const metadata: Metadata = { title: 'Saved listings', robots: { index: false } };

export default async function SavedPage() {
  const { locale, t } = await getTranslations();
  const token = await getAccessToken();

  const { data } = await apiFetch<{ data: ListingSummary[] }>('/me/saved-listings', { token });

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('dashboard.saved')}</h2>
      {data.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t('dashboard.noSaved')}
        </p>
      ) : (
        <div className="mt-5">
          <ListingGrid listings={data} locale={locale} t={t} priorityCount={0} />
        </div>
      )}
    </div>
  );
}
