import type { NextConfig } from 'next';

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const { hostname, port, protocol } = new URL(apiOrigin);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: protocol.replace(':', '') as 'http' | 'https',
        hostname,
        ...(port ? { port } : {}),
        pathname: '/media/**',
      },
    ],
    // Next 16 blocks optimising images served from a local IP by default.
    // In development the API is on localhost, so this is required to see any
    // listing photo at all. It stays off in production, where media comes from
    // a public origin or a CDN.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
};

export default nextConfig;
