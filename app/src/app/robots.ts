import type { MetadataRoute } from 'next';

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Signed-in areas hold nothing useful to a crawler and plenty that is
      // private; the auth pages would only compete with the real content.
      disallow: ['/dashboard/', '/admin/', '/api/', '/login', '/register'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
