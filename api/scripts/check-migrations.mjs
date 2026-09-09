#!/usr/bin/env node
/**
 * CI guard: fails if any migration drops the FTS5 search index.
 * Prisma proposes exactly this whenever someone runs a bare `prisma migrate dev`
 * (see scripts/new-migration.mjs), and it is silent data loss if it lands.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'prisma/migrations';
const CREATES_FTS = /CREATE\s+VIRTUAL\s+TABLE\s+"?listing_fts"?/i;
const DROPS_FTS = /DROP\s+(TABLE|TRIGGER)\s+(IF\s+EXISTS\s+)?"?listing_fts/i;

const dirs = readdirSync(MIGRATIONS_DIR)
  .filter((d) => existsSync(join(MIGRATIONS_DIR, d, 'migration.sql')))
  .sort();

let createdAt = null;
const offenders = [];

for (const dir of dirs) {
  const sql = readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
  if (CREATES_FTS.test(sql)) createdAt = dir;
  // A drop is only an error if it comes after the index was created and is not
  // immediately recreated in the same migration.
  if (DROPS_FTS.test(sql) && createdAt && !CREATES_FTS.test(sql)) offenders.push(dir);
}

if (!createdAt) {
  console.error('FAIL: no migration creates the listing_fts search index.');
  process.exit(1);
}
if (offenders.length > 0) {
  console.error('FAIL: these migrations drop the listing_fts search index:');
  for (const o of offenders) console.error(`  - ${o}`);
  console.error('\nUse `npm run db:migrate:new -- --name <name>` instead of a bare');
  console.error('`prisma migrate dev`, which proposes dropping virtual tables.');
  process.exit(1);
}

console.log(`OK: listing_fts created in ${createdAt}, never dropped (${dirs.length} migrations).`);
