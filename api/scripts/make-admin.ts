/**
 * Creates (or promotes) an administrator account.
 *
 * The seeded demo accounts have a password published in the README, so a real
 * deployment needs a real administrator before it sees traffic. This generates a
 * strong password and prints it once — it is not stored anywhere in plain text
 * and cannot be recovered, only reset.
 *
 *   npm run make:admin -- --email you@example.com --name "Your Name"
 */
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import type { Role } from '../src/generated/prisma/enums.js';

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function generatePassword(): string {
  // base64url of 18 bytes: 24 characters, no ambiguous punctuation to mistype.
  return randomBytes(18).toString('base64url');
}

async function main(): Promise<void> {
  const email = arg('--email')?.trim().toLowerCase();
  const name = arg('--name')?.trim() ?? 'Administrator';
  const phone = arg('--phone')?.trim();

  if (!email) {
    console.error('Usage: npm run make:admin -- --email you@example.com --name "Your Name"');
    process.exit(1);
  }

  const roles: Role[] = ['ADMIN', 'STAFF', 'SEEKER'];
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    // Promote rather than reset: an existing account keeps its password.
    await prisma.$transaction([
      prisma.userRoleAssignment.deleteMany({ where: { userId: existing.id } }),
      prisma.userRoleAssignment.createMany({
        data: roles.map((role) => ({ userId: existing.id, role })),
      }),
      prisma.user.update({ where: { id: existing.id }, data: { isActive: true } }),
    ]);
    console.log(`Promoted ${email} to ADMIN. Their existing password is unchanged.`);
    return;
  }

  const password = generatePassword();
  await prisma.user.create({
    data: {
      email,
      name,
      phone: phone ?? null,
      passwordHash: await hashPassword(password),
      isVerified: true,
      preferredLang: 'en',
      roles: { create: roles.map((role) => ({ role })) },
    },
  });

  console.log('\nAdministrator created.\n');
  console.log(`  Email     ${email}`);
  console.log(`  Password  ${password}`);
  console.log('\nThis password is shown once and is not recoverable. Store it now.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
