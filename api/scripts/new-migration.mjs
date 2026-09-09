#!/usr/bin/env node
/**
 * Creates a new Prisma migration without clobbering the FTS5 search index.
 *
 * Why this exists: `listing_fts` and its shadow tables are SQLite virtual-table
 * objects created by a hand-written migration. They cannot be expressed in
 * schema.prisma, so `prisma migrate dev` diffs the schema against the database,
 * sees them as orphans, and helpfully proposes dropping them. That would delete
 * the search index.
 *
 * So: generate the migration without applying it, strip any statement touching
 * an FTS object, then apply what's left.
 *
 *   npm run db:migrate:new -- --name add_something
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'prisma/migrations';
const FTS_OBJECT = /listing_fts/i;

const args = process.argv.slice(2);
const nameIndex = args.indexOf('--name');
if (nameIndex === -1 || !args[nameIndex + 1]) {
  console.error('Usage: npm run db:migrate:new -- --name <migration_name>');
  process.exit(1);
}
const name = args[nameIndex + 1];

const run = (cmd, cmdArgs) =>
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' });

const before = new Set(readdirSync(MIGRATIONS_DIR));
run('npx', ['prisma', 'migrate', 'dev', '--create-only', '--name', name]);
const created = readdirSync(MIGRATIONS_DIR).filter((d) => !before.has(d));

if (created.length === 0) {
  console.log('No schema changes detected; nothing to migrate.');
  process.exit(0);
}

for (const dir of created) {
  const file = join(MIGRATIONS_DIR, dir, 'migration.sql');
  const sql = readFileSync(file, 'utf8');

  // Split on statement boundaries, keeping the terminating semicolon.
  const statements = sql.split(/;\s*\n/).filter((s) => s.trim().length > 0);
  const kept = statements.filter((s) => !FTS_OBJECT.test(s));
  const dropped = statements.length - kept.length;

  if (dropped > 0) {
    const header =
      '-- NOTE: statements targeting the listing_fts search index were removed\n' +
      '-- automatically by scripts/new-migration.mjs. See that file for why.\n\n';
    writeFileSync(file, header + kept.join(';\n\n') + (kept.length ? ';\n' : ''));
    console.log(`\nStripped ${dropped} FTS-touching statement(s) from ${dir}/migration.sql`);
  }
}

run('npx', ['prisma', 'migrate', 'deploy']);
run('npx', ['prisma', 'generate']);
console.log('\nMigration created and applied.');
