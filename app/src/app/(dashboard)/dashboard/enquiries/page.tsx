import Link from 'next/link';
import type { Metadata } from 'next';
import { IconMail, IconPhone } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { EnquiryStatusControl } from '@/components/dashboard/enquiry-status';
import { apiFetch } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { formatRelativeDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Enquiries', robots: { index: false } };

interface Enquiry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  status: string;
  createdAt: string;
  preferredContact: string;
  listing: { publicRef: string; title: string } | null;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'muted' | 'destructive'> = {
  NEW: 'default',
  CONTACTED: 'secondary',
  CLOSED: 'muted',
  SPAM: 'destructive',
};

export default async function EnquiriesPage() {
  const { locale, t } = await getTranslations();
  const token = await getAccessToken();

  const { data } = await apiFetch<{ data: Enquiry[] }>('/me/enquiries/received', {
    token,
    query: { limit: 100 },
  });

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('dashboard.enquiries')}</h2>

      {data.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t('dashboard.noEnquiries')}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {data.map((enquiry) => (
            <li key={enquiry.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{enquiry.name}</p>
                  {enquiry.listing && (
                    <Link
                      href={`/listing/${enquiry.listing.publicRef}`}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      {enquiry.listing.title}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[enquiry.status] ?? 'muted'}>{enquiry.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(enquiry.createdAt, locale)}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm">{enquiry.message}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <a href={`tel:${enquiry.phone}`} className="flex items-center gap-1 hover:underline">
                  <IconPhone className="size-4" aria-hidden />
                  {enquiry.phone}
                </a>
                {enquiry.email && (
                  <a
                    href={`mailto:${enquiry.email}`}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <IconMail className="size-4" aria-hidden />
                    {enquiry.email}
                  </a>
                )}
                <span className="text-xs text-muted-foreground">
                  Prefers {enquiry.preferredContact.toLowerCase()}
                </span>
                <div className="ml-auto">
                  <EnquiryStatusControl id={enquiry.id} status={enquiry.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
