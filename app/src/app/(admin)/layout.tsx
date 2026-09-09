import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconChartBar, IconFlag, IconInbox, IconUsers } from '@tabler/icons-react';
import { getCurrentUser, isStaff } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // 404 rather than 403: the admin area's existence is not something a curious
  // visitor needs confirmed.
  if (!isStaff(user)) notFound();

  const { t } = await getTranslations();

  const links = [
    { href: '/admin', label: t('admin.stats'), icon: IconChartBar },
    { href: '/admin/queue', label: t('admin.queue'), icon: IconInbox },
    { href: '/admin/reports', label: t('admin.reports'), icon: IconFlag },
    { href: '/admin/users', label: t('admin.users'), icon: IconUsers },
  ];

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-semibold">{t('admin.title')}</h1>
      <nav aria-label="Admin" className="mt-4 border-b border-border">
        <ul className="flex gap-1 overflow-x-auto">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-accent"
              >
                <link.icon className="size-4" aria-hidden />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
