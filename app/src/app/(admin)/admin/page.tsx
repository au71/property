import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Overview', robots: { index: false } };

interface Stats {
  listingsByStatus: Record<string, number>;
  listingsByCity: Array<{ city: string; count: number }>;
  listingsByCategory: Array<{ category: string; count: number }>;
  listingsByDealType: Record<string, number>;
  totalUsers: number;
  enquiriesLast30Days: number;
  openReports: number;
  publishedPerDay: Array<{ day: string; count: number }>;
}

export default async function AdminStatsPage() {
  const { t } = await getTranslations();
  const stats = await apiFetch<Stats>('/admin/stats', { token: await getAccessToken() });

  const tiles = [
    { label: 'Live listings', value: stats.listingsByStatus['PUBLISHED'] ?? 0 },
    { label: t('admin.queue'), value: stats.listingsByStatus['PENDING_REVIEW'] ?? 0 },
    { label: 'Open reports', value: stats.openReports },
    { label: 'Enquiries (30d)', value: stats.enquiriesLast30Days },
    { label: 'Users', value: stats.totalUsers },
  ];

  const peak = Math.max(1, ...stats.publishedPerDay.map((d) => d.count));

  return (
    <div className="space-y-8">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Card>
              <CardContent className="pt-5">
                <p className="text-2xl font-semibold tabular-nums">
                  {tile.value.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{tile.label}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="text-base font-semibold">Published per day (30 days)</h2>
        {stats.publishedPerDay.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No listings published yet.</p>
        ) : (
          <div
            className="mt-3 flex h-32 items-end gap-1"
            role="img"
            aria-label={`Listings published per day over the last 30 days, peaking at ${peak}`}
          >
            {stats.publishedPerDay.map((day) => (
              <div key={day.day} className="flex-1" title={`${day.day}: ${day.count}`}>
                <div
                  className="rounded-t bg-chart-1"
                  style={{ height: `${Math.max(2, (day.count / peak) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <BreakdownTable title="By city" rows={stats.listingsByCity.map((r) => [r.city, r.count])} />
        <BreakdownTable
          title="By category"
          rows={stats.listingsByCategory.slice(0, 10).map((r) => [r.category, r.count])}
        />
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const total = rows.reduce((sum, [, count]) => sum + count, 0) || 1;
  return (
    <section>
      <h2 className="text-base font-semibold">{title}</h2>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {rows.map(([label, count]) => (
            <tr key={label} className="border-b border-border last:border-0">
              <td className="py-2">{label}</td>
              <td className="w-1/2 py-2">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-chart-2"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
              </td>
              <td className="py-2 pl-3 text-right tabular-nums">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
