import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';
import { config } from '../config/index.js';

/**
 * SQLite has a single writer. WAL mode lets readers run concurrently with the
 * writer, and busy_timeout makes competing writers wait rather than throwing
 * SQLITE_BUSY immediately. Both are set per connection, so they belong here.
 */
const adapter = new PrismaBetterSqlite3({ url: config.databaseUrl });

export const prisma = new PrismaClient({
  adapter,
  log: config.isTest ? [] : ['warn', 'error'],
});

export async function applySqlitePragmas(): Promise<void> {
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');
}

export type { PrismaClient };
