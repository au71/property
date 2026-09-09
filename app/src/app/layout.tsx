import type { Metadata, Viewport } from 'next';
import { Inter, Roboto, Noto_Sans_Myanmar } from 'next/font/google';
import { Toaster } from 'sonner';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { getLocale } from '@/lib/i18n';
import './globals.css';

// Per the shadcn preset: Inter for body text, Roboto for headings.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
});
// Latin fonts have no Burmese glyphs; without this the site falls back to
// whatever the device happens to have, which on many Android phones is nothing.
const notoMyanmar = Noto_Sans_Myanmar({
  variable: '--font-noto-myanmar',
  subsets: ['myanmar'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Property — buy, sell and rent in Myanmar',
    template: '%s · Property',
  },
  description:
    'Property for sale and for rent in Yangon, Mandalay and across Myanmar. Condos, apartments, houses, land and commercial space.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#101418' },
  ],
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${roboto.variable} ${notoMyanmar.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
