import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

/**
 * Seed images are generated locally rather than fetched from a placeholder
 * service, so `npm run db:seed` works offline, in CI, and behind a proxy — and
 * produces the same bytes every run.
 */

const PALETTE = [
  ['#1e3a5f', '#4a7ba7'],
  ['#3d5a3d', '#7a9e7a'],
  ['#5f4a2e', '#a08a5f'],
  ['#4a2e4a', '#8a5f8a'],
  ['#2e4a5f', '#5f8aa0'],
  ['#5f2e2e', '#a05f5f'],
];

function svg(
  width: number,
  height: number,
  label: string,
  sub: string,
  colorIndex: number,
): string {
  const [dark, light] = PALETTE[colorIndex % PALETTE.length]!;
  // Escape the few characters that would otherwise break out of the text node.
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/>
      <stop offset="100%" stop-color="${light}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <text x="50%" y="47%" text-anchor="middle" fill="#ffffff"
        font-family="DejaVu Sans, sans-serif" font-size="${Math.round(width / 18)}"
        font-weight="700">${esc(label)}</text>
  <text x="50%" y="58%" text-anchor="middle" fill="#ffffff" fill-opacity="0.75"
        font-family="DejaVu Sans, sans-serif" font-size="${Math.round(width / 34)}">${esc(sub)}</text>
</svg>`;
}

export interface GeneratedImage {
  key: string;
  thumbKey: string;
  width: number;
  height: number;
  bytes: number;
}

export async function generateListingImage(
  baseDir: string,
  listingRef: string,
  index: number,
  label: string,
  sub: string,
): Promise<GeneratedImage> {
  const width = 1600;
  const height = 1067;
  const thumbWidth = 400;

  const source = Buffer.from(svg(width, height, label, sub, index));
  const full = await sharp(source).webp({ quality: 78 }).toBuffer();
  const thumb = await sharp(source)
    .resize(thumbWidth, Math.round((thumbWidth / width) * height))
    .webp({ quality: 70 })
    .toBuffer();

  const key = `listings/${listingRef}/${index}.webp`;
  const thumbKey = `listings/${listingRef}/${index}-thumb.webp`;

  for (const [k, buf] of [
    [key, full],
    [thumbKey, thumb],
  ] as const) {
    const path = join(baseDir, k);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buf);
  }

  return { key, thumbKey, width, height, bytes: full.byteLength };
}
