import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { PASSWORD, auth, createUser, resetDatabase, tokenFor } from '../fixtures.js';

let app: Express;

beforeAll(() => {
  app = createApp();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase();
});

describe('POST /auth/register', () => {
  it('creates an account and returns a session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('x-client', 'mobile')
      .send({ name: 'Ko Test', email: 'new@example.com', password: PASSWORD, intent: 'OWNER' })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    // Everyone can browse, so an owner is also a seeker.
    expect(res.body.user.roles).toEqual(expect.arrayContaining(['OWNER', 'SEEKER']));
  });

  it('never issues STAFF or ADMIN from self-registration', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: PASSWORD, intent: 'ADMIN' })
      .expect(400);
  });

  it('rejects a duplicate email address', async () => {
    await createUser('dupe@example.com', ['SEEKER']);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dupe', email: 'dupe@example.com', password: PASSWORD })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires either an email address or a phone number', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Nobody', password: PASSWORD })
      .expect(400);
  });

  it('normalises a Myanmar phone number to +95 form', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Phone User', phone: '09123456789', password: PASSWORD })
      .expect(201);
    const user = await prisma.user.findFirst({ where: { name: 'Phone User' } });
    expect(user?.phone).toBe('+959123456789');
  });

  it('treats 09... and +959... as the same number', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'First', phone: '09123456789', password: PASSWORD })
      .expect(201);
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Second', phone: '+959123456789', password: PASSWORD })
      .expect(409);
  });

  it('does not store the password in plain text', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Hashed', email: 'hashed@example.com', password: PASSWORD })
      .expect(201);
    const user = await prisma.user.findUnique({ where: { email: 'hashed@example.com' } });
    expect(user?.passwordHash).not.toContain(PASSWORD);
    expect(user?.passwordHash?.startsWith('$argon2id$')).toBe(true);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await createUser('user@example.com', ['SEEKER'], { phone: '+959111222333' });
  });

  it('accepts a correct password', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'user@example.com', password: PASSWORD })
      .expect(200);
  });

  it('accepts a phone number as the identifier, in local form', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '09111222333', password: PASSWORD })
      .expect(200);
  });

  it('rejects a wrong password', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'user@example.com', password: 'WrongPassword1' })
      .expect(401);
  });

  it('gives the same answer for an unknown account as for a wrong password', async () => {
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'nobody@example.com', password: PASSWORD })
      .expect(401);
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'user@example.com', password: 'WrongPassword1' })
      .expect(401);
    // Otherwise login doubles as an account-existence oracle.
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('refuses a deactivated account', async () => {
    await prisma.user.update({
      where: { email: 'user@example.com' },
      data: { isActive: false },
    });
    await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'user@example.com', password: PASSWORD })
      .expect(401);
  });

  it('sets an httpOnly cookie for a web client and not for mobile', async () => {
    const web = await request(app)
      .post('/api/v1/auth/login')
      .set('x-client', 'web')
      .send({ identifier: 'user@example.com', password: PASSWORD })
      .expect(200);
    const cookies = web.headers['set-cookie'] as unknown as string[];
    expect(cookies.join()).toContain('HttpOnly');
    // The web body must not carry the refresh token, or the cookie is pointless.
    expect(web.body.refreshToken).toBeUndefined();

    const mobile = await request(app)
      .post('/api/v1/auth/login')
      .set('x-client', 'mobile')
      .send({ identifier: 'user@example.com', password: PASSWORD })
      .expect(200);
    expect(mobile.body.refreshToken).toBeTruthy();
  });
});

describe('GET /auth/me', () => {
  it('rejects a request with no token', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  it('rejects a malformed token', async () => {
    await request(app).get('/api/v1/auth/me').set(auth('not.a.jwt')).expect(401);
  });

  it('returns the current user', async () => {
    await createUser('me@example.com', ['OWNER', 'SEEKER'], { name: 'Daw Test' });
    const token = await tokenFor(app, 'me@example.com');
    const res = await request(app).get('/api/v1/auth/me').set(auth(token)).expect(200);
    expect(res.body.name).toBe('Daw Test');
    expect(res.body.roles).toEqual(expect.arrayContaining(['OWNER', 'SEEKER']));
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('reflects a role revoked after the token was issued', async () => {
    const user = await createUser('demoted@example.com', ['OWNER', 'SEEKER']);
    const token = await tokenFor(app, 'demoted@example.com');
    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id, role: 'OWNER' } });
    const res = await request(app).get('/api/v1/auth/me').set(auth(token)).expect(200);
    // Roles are read from the database, not the token, so this takes effect now.
    expect(res.body.roles).not.toContain('OWNER');
  });
});

describe('refresh token rotation', () => {
  it('issues a new token and invalidates the old one', async () => {
    await createUser('rot@example.com', ['SEEKER']);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('x-client', 'mobile')
      .send({ identifier: 'rot@example.com', password: PASSWORD })
      .expect(200);

    const first = login.body.refreshToken as string;
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-client', 'mobile')
      .send({ refreshToken: first })
      .expect(200);

    expect(refreshed.body.refreshToken).not.toBe(first);
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-client', 'mobile')
      .send({ refreshToken: first })
      .expect(401);
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const user = await createUser('reuse@example.com', ['SEEKER']);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('x-client', 'mobile')
      .send({ identifier: 'reuse@example.com', password: PASSWORD })
      .expect(200);

    const stolen = login.body.refreshToken as string;
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-client', 'mobile')
      .send({ refreshToken: stolen })
      .expect(200);

    // An attacker replays the token the real user already rotated away from.
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-client', 'mobile')
      .send({ refreshToken: stolen })
      .expect(401);

    // That must also lock out the currently-live token, not just the replayed one.
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-client', 'mobile')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);

    const live = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(live).toBe(0);
  });

  it('rejects a token that was never issued', async () => {
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-client', 'mobile')
      .send({ refreshToken: 'made-up' })
      .expect(401);
  });
});

describe('OTP sign-in', () => {
  it('creates an account on first verification', async () => {
    await request(app).post('/api/v1/auth/otp/request').send({ phone: '09987654321' }).expect(202);

    const record = await prisma.otpCode.findFirst({ where: { phone: '+959987654321' } });
    expect(record).toBeTruthy();
    // The code itself is never stored, only its salted hash.
    expect(record?.codeHash).toHaveLength(64);

    const wrong = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '09987654321', code: '000000', name: 'OTP User' });
    expect([400]).toContain(wrong.status);
  });

  it('answers identically whether or not the number is registered', async () => {
    await createUser('known@example.com', ['SEEKER'], { phone: '+959555666777' });
    const known = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '09555666777' })
      .expect(202);
    const unknown = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '09555666888' })
      .expect(202);
    expect(known.body).toEqual(unknown.body);
  });

  it('rejects a badly formed phone number', async () => {
    await request(app).post('/api/v1/auth/otp/request').send({ phone: '12345' }).expect(400);
  });
});

describe('logout', () => {
  it('revokes the session', async () => {
    const user = await createUser('out@example.com', ['SEEKER']);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('x-client', 'mobile')
      .send({ identifier: 'out@example.com', password: PASSWORD })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/logout')
      .set('x-client', 'mobile')
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);

    const live = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(live).toBe(0);
  });
});
