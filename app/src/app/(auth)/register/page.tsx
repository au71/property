import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterForm } from '@/components/auth/register-form';
import { getCurrentUser } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const { t } = await getTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.signUp')}</CardTitle>
        <CardDescription>{t('home.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm
          labels={{
            name: t('auth.name'),
            email: t('auth.email'),
            phone: t('auth.phone'),
            password: t('auth.password'),
            intent: t('auth.intent'),
            intentSeeker: t('auth.intent.SEEKER'),
            intentOwner: t('auth.intent.OWNER'),
            intentAgent: t('auth.intent.AGENT'),
            submit: t('auth.signUp'),
            error: t('common.error'),
          }}
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            {t('auth.signIn')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
