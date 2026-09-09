import { pino } from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.isTest ? 'silent' : config.isProduction ? 'info' : 'debug',
  // Never log credentials, tokens, or OTP codes, wherever they appear.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'refreshToken',
      '*.refreshToken',
      'code',
      '*.code',
    ],
    censor: '[redacted]',
  },
  transport: config.isProduction ? undefined : { target: 'pino/file', options: { destination: 1 } },
});
