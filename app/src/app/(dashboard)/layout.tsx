import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IconHeart, IconList, IconMail } from '@tabler/icons-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Every dashboard route is gated here rather than in each page, so a new page
  // cannot be added without the guard.
  if (!user) redirect('/login?next=/dashboard');

  const { t } = await getTranslations();

  const links = [
    { href: '/dashboard/listings', label: t('dashboard.listings'), icon: IconList },
    { href: '/dashboard/enquiries', label: t('dashboard.enquiries'), icon: IconMail },
    { href: '/dashboard/saved', label: t('dashboard.saved'), icon: IconHeart },
  ];

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.name}</p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Dashboard" className="lg:w-56 lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-accent"
                >
                  <link.icon className="size-4" aria-hidden />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
