import type { Actor } from '../domain/policy.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
      sessionId?: string;
      requestId: string;
    }
  }
}

export type { Actor };
