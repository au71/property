import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage(props: PageProps<'/login'>) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { t } = await getTranslations();
  const { next } = await props.searchParams;
  const redirectTo = typeof next === 'string' && next.startsWith('/') ? next : '/dashboard';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.signIn')}</CardTitle>
        <CardDescription>{t('home.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm
          redirectTo={redirectTo}
          labels={{
            identifier: t('auth.identifier'),
            password: t('auth.password'),
            submit: t('auth.signIn'),
            error: t('common.error'),
          }}
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            {t('auth.signUp')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
