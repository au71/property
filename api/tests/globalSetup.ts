import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Integration tests run against a real SQLite file rather than mocks: the
 * things most worth testing here (FTS5 search, cascade deletes, unique
 * constraints, BigInt round-trips) only exist in the database.
 */
export const TEST_DB_PATH = resolve('var/test/test.db');

export default function setup(): void {
  rmSync(resolve('var/test'), { recursive: true, force: true });
  mkdirSync(resolve('var/test'), { recursive: true });

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    stdio: 'pipe',
  });
}

export function teardown(): void {
  rmSync(resolve('var/test'), { recursive: true, force: true });
}
