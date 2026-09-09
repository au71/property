import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Users', robots: { index: false } };

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  roles: string[];
  agentProfile: { agencyName: string | null; isVerifiedAgent: boolean } | null;
  _count: { ownedListings: number };
}

export default async function UsersPage(props: PageProps<'/admin/users'>) {
  const { locale, t } = await getTranslations();
  const { search } = await props.searchParams;

  const { data } = await apiFetch<{ data: AdminUser[] }>('/admin/users', {
    token: await getAccessToken(),
    query: { limit: 100, ...(typeof search === 'string' ? { search } : {}) },
  });

  return (
    <div>
      <h2 className="text-lg font-semibold">{t('admin.users')}</h2>

      <form method="get" className="mt-4 flex max-w-sm gap-2">
        <input
          name="search"
          defaultValue={typeof search === 'string' ? search : ''}
          placeholder="Name, email or phone"
          aria-label="Search users"
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button type="submit" className="rounded-md bg-primary px-4 text-sm text-primary-foreground">
          Search
        </button>
      </form>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Contact</th>
              <th className="py-2 pr-4 font-medium">Roles</th>
              <th className="py-2 pr-4 font-medium">Listings</th>
              <th className="py-2 pr-4 font-medium">Joined</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-4">
                  <p className="font-medium">{user.name}</p>
                  {user.agentProfile?.agencyName && (
                    <p className="text-xs text-muted-foreground">
                      {user.agentProfile.agencyName}
                      {user.agentProfile.isVerifiedAgent ? ' ✓' : ''}
                    </p>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  <p>{user.email}</p>
                  <p className="text-xs">{user.phone}</p>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="muted">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="py-2.5 pr-4 tabular-nums">{user._count.ownedListings}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {formatDate(user.createdAt, locale)}
                </td>
                <td className="py-2.5">
                  <Badge variant={user.isActive ? 'success' : 'destructive'}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
