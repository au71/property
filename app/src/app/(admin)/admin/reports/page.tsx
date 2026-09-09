import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { ReportStatusControl } from '@/components/admin/report-status';
import { apiFetch } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { formatRelativeDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Reports', robots: { index: false } };

interface Report {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  listing: { id: string; publicRef: string; title: string; status: string } | null;
  reporter: { name: string; email: string | null } | null;
}

export default async function ReportsPage() {
  const { locale, t } = await getTranslations();
  const { data } = await apiFetch<{ data: Report[] }>('/admin/reports', {
    token: await getAccessToken(),
    query: { limit: 100 },
  });

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('admin.reports')}</h2>

      {data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No reports.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {data.map((report) => (
            <li key={report.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{report.reason}</p>
                  {report.listing && (
                    <Link
                      href={`/listing/${report.listing.publicRef}`}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      {report.listing.title}
                    </Link>
                  )}
                  {report.detail && <p className="mt-1 text-sm">{report.detail}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reported by {report.reporter?.name ?? 'anonymous'} ·{' '}
                    {formatRelativeDate(report.createdAt, locale)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {report.listing && <Badge variant="muted">{report.listing.status}</Badge>}
                  <ReportStatusControl id={report.id} status={report.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
