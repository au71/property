import Link from 'next/link';
import { getTranslations } from '@/lib/i18n';

export async function Footer() {
  const { t } = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <h2 className="text-sm font-semibold">Property</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('home.subtitle')}</p>
        </div>
        <nav aria-label="Buy">
          <h2 className="text-sm font-semibold">{t('nav.buy')}</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/buy/yangon/condo">Condos in Yangon</Link></li>
            <li><Link className="hover:text-foreground" href="/buy/yangon/house">Houses in Yangon</Link></li>
            <li><Link className="hover:text-foreground" href="/buy/mandalay/residential-land">Land in Mandalay</Link></li>
          </ul>
        </nav>
        <nav aria-label="Rent">
          <h2 className="text-sm font-semibold">{t('nav.rent')}</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/rent/yangon/apartment">Apartments in Yangon</Link></li>
            <li><Link className="hover:text-foreground" href="/rent/yangon/condo">Condos in Yangon</Link></li>
            <li><Link className="hover:text-foreground" href="/rent/mandalay/house">Houses in Mandalay</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-semibold">{t('nav.postListing')}</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/register">{t('auth.signUp')}</Link></li>
            <li><Link className="hover:text-foreground" href="/login">{t('auth.signIn')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-page border-t border-border py-4 text-xs text-muted-foreground">
        © {year} Property
      </div>
    </footer>
  );
}
