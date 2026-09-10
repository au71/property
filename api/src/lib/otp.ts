import { createHash, randomInt } from 'node:crypto';
import { logger } from './logger.js';
import { config } from '../config/index.js';

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * How long a freshly sent code stays the only one. Without this, "resend" is an
 * SMS bomb aimed at whatever number the attacker types: the per-IP limiter does
 * not help when the requests come from many IPs, and every message costs money
 * and lands on a stranger's handset.
 */
export const OTP_RESEND_SECONDS = 60;

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtpCode(phone: string, code: string): string {
  // Salted with the phone number so a code hash cannot be replayed across users.
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

export function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

/**
 * Stand-in for a real SMS gateway. It writes the message to the log so a
 * developer can complete the OTP flow locally, and stays silent under test and
 * in production (where a real provider must be configured instead — sending
 * nothing while logging codes to a production log would be worse than useless).
 */
class LogSmsProvider implements SmsProvider {
  // Nothing to await yet; a real gateway call will be awaited here.
  // eslint-disable-next-line @typescript-eslint/require-await
  async send(to: string, message: string): Promise<void> {
    if (config.isProduction) {
      logger.error(
        { to },
        'No real SMS provider configured; the OTP was not delivered. Set SMS_PROVIDER.',
      );
      return;
    }
    if (config.isTest) return;
    logger.info({ to, message }, 'SMS (development stand-in, not actually sent)');
  }
}

export const smsProvider: SmsProvider = new LogSmsProvider();
