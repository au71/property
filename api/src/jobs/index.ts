import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';

const tasks: ScheduledTask[] = [];

/** Moves listings past their expiry out of public search. */
export async function expireListings(): Promise<number> {
  const now = new Date();
  const due = await prisma.listing.findMany({
    where: { status: 'PUBLISHED', expiresAt: { lt: now }, deletedAt: null },
    select: { id: true },
  });
  if (due.length === 0) return 0;

  await prisma.$transaction([
    prisma.listing.updateMany({
      where: { id: { in: due.map((l) => l.id) } },
      data: { status: 'EXPIRED' },
    }),
    prisma.listingEvent.createMany({
      data: due.map((l) => ({
        listingId: l.id,
        fromStatus: 'PUBLISHED' as const,
        toStatus: 'EXPIRED' as const,
        note: 'Expired automatically',
      })),
    }),
  ]);
  return due.length;
}

/** Drops the featured flag once the paid period ends. */
export async function unfeatureExpired(): Promise<number> {
  const result = await prisma.listing.updateMany({
    where: { isFeatured: true, featuredUntil: { lt: new Date() } },
    data: { isFeatured: false, featuredUntil: null },
  });
  return result.count;
}

/** Removes spent and stale one-time codes. */
export async function pruneOtpCodes(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.otpCode.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
  });
  return result.count;
}

/** Revoked and expired sessions serve no purpose after their window closes. */
export async function pruneSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
  return result.count;
}

export function startJobs(): void {
  const schedule = (expression: string, name: string, job: () => Promise<number>) => {
    tasks.push(
      cron.schedule(expression, () => {
        void job()
          .then((count) => {
            if (count > 0) logger.info({ job: name, count }, 'Job completed');
          })
          // A failing job must not take the API process down with it.
          .catch((err: unknown) => logger.error({ err, job: name }, 'Job failed'));
      }),
    );
  };

  schedule('*/15 * * * *', 'expireListings', expireListings);
  schedule('0 * * * *', 'unfeatureExpired', unfeatureExpired);
  schedule('30 3 * * *', 'pruneOtpCodes', pruneOtpCodes);
  schedule('45 3 * * *', 'pruneSessions', pruneSessions);

  logger.info({ jobs: tasks.length }, 'Scheduled jobs started');
}

export function stopJobs(): void {
  for (const task of tasks) void task.stop();
  tasks.length = 0;
}
