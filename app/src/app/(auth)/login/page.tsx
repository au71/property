import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from '@/components/auth/login-form';
import { OtpLoginForm } from '@/components/auth/otp-login-form';
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
        {/* Phone first: most people here have a handset and no email address. */}
        <Tabs defaultValue="phone">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone">{t('auth.withPhone')}</TabsTrigger>
            <TabsTrigger value="password">{t('auth.withPassword')}</TabsTrigger>
          </TabsList>

          <TabsContent value="phone">
            <p className="mb-4 text-sm text-muted-foreground">{t('auth.noPasswordNeeded')}</p>
            <OtpLoginForm
              redirectTo={redirectTo}
              labels={{
                phone: t('auth.phone'),
                phoneHint: t('auth.phoneHint'),
                sendCode: t('auth.sendCode'),
                code: t('auth.code'),
                codeSentTo: t('auth.codeSentTo'),
                name: t('auth.otpName'),
                nameHint: t('auth.otpNameHint'),
                verify: t('auth.verify'),
                resend: t('auth.resend'),
                resendIn: t('auth.resendIn'),
                changeNumber: t('auth.changeNumber'),
                invalidPhone: t('auth.invalidPhone'),
                error: t('common.error'),
              }}
            />
          </TabsContent>

          <TabsContent value="password">
            <LoginForm
              redirectTo={redirectTo}
              labels={{
                identifier: t('auth.identifier'),
                password: t('auth.password'),
                submit: t('auth.signIn'),
                error: t('common.error'),
              }}
            />
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            {t('auth.signUp')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
