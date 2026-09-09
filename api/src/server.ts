import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { applySqlitePragmas, prisma } from './db/prisma.js';
import { startJobs, stopJobs } from './jobs/index.js';

async function main(): Promise<void> {
  await applySqlitePragmas();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.env },
      `Property API listening on http://localhost:${config.port}`,
    );
  });

  if (config.enableCron) startJobs();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    stopJobs();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
    // Do not let a hung connection block the deploy indefinitely.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start');
  process.exit(1);
});
