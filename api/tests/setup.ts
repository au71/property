import { resolve } from 'node:path';

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = `file:${resolve('var/test/test.db')}`;
process.env['JWT_SECRET'] = 'test-secret-that-is-definitely-long-enough-32';
process.env['ENABLE_CRON'] = 'false';
process.env['STORAGE_LOCAL_DIR'] = 'var/test/uploads';
process.env['PUBLIC_BASE_URL'] = 'http://localhost:4000';
