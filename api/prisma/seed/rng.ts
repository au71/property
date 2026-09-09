/**
 * Deterministic RNG (mulberry32) so `npm run db:reset` produces byte-identical
 * sample data every time. Reproducible seeds make screenshots, demos and test
 * expectations stable.
 */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min: number, max: number): number => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number): number => next() * (max - min) + min,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('Cannot pick from an empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
    /** Picks `count` distinct items, or all of them when count exceeds length. */
    sample: <T>(items: readonly T[], count: number): T[] => {
      const pool = [...items];
      const out: T[] = [];
      const take = Math.min(count, pool.length);
      for (let i = 0; i < take; i += 1) {
        const idx = Math.floor(next() * pool.length);
        out.push(pool.splice(idx, 1)[0] as T);
      }
      return out;
    },
    bool: (probability = 0.5): boolean => next() < probability,
    /** Picks a key from a weight map, e.g. { PUBLISHED: 70, DRAFT: 8 }. */
    weighted: <K extends string>(weights: Record<K, number>): K => {
      const entries = Object.entries(weights) as Array<[K, number]>;
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [key, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return key;
      }
      return entries[entries.length - 1]![0];
    },
    /** A date `maxDaysAgo`..`minDaysAgo` in the past. */
    pastDate: (minDaysAgo: number, maxDaysAgo: number): Date => {
      const days = Math.floor(next() * (maxDaysAgo - minDaysAgo + 1)) + minDaysAgo;
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - days);
      d.setUTCHours(Math.floor(next() * 24), Math.floor(next() * 60), 0, 0);
      return d;
    },
  };
}

export type Rng = ReturnType<typeof makeRng>;
