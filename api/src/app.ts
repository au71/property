import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { loadActor } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { localStorageDir } from './lib/storage.js';
import { authRouter } from './modules/auth/routes.js';
import { taxonomyRouter } from './modules/taxonomy/routes.js';
import { listingsRouter, myListingsRouter } from './modules/listings/routes.js';
import { listingMediaRouter, mediaRouter } from './modules/media/routes.js';
import {
  enquiryRouter,
  listingEnquiryRouter,
  myEnquiryRouter,
} from './modules/enquiries/routes.js';
import { reportRouter, savedRouter } from './modules/saved/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { prisma } from './db/prisma.js';
import { buildOpenApiDocument } from './openapi/spec.js';

// Registers the Request.actor augmentation.
import './middleware/types.js';

export function createApp(): Express {
  const app = express();

  // Behind Caddy/nginx in every deployed environment, so req.ip must come from
  // X-Forwarded-For rather than the proxy's own address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    helmet({
      // The API serves uploaded images to a browser on another origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      exposedHeaders: ['x-request-id'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!config.isTest) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req as { requestId?: string }).requestId ?? '',
        autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
      }),
    );
  }

  // The published contract clients generate their typed API layer from.
  app.get('/openapi.json', (_req, res) => {
    res.json(buildOpenApiDocument());
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // Uploaded media. In production this is fronted by the reverse proxy or a CDN.
  if (config.storage.driver === 'local') {
    app.use(
      '/media',
      express.static(localStorageDir, {
        maxAge: '30d',
        immutable: true,
        fallthrough: false,
      }),
    );
  }

  const api = express.Router();
  api.use(generalLimiter);
  api.use(loadActor);

  api.use('/auth', authRouter);
  api.use('/', taxonomyRouter);
  api.use('/listings/:id/media', listingMediaRouter);
  api.use('/listings/:id/enquiries', listingEnquiryRouter);
  api.use('/listings/:id/report', reportRouter);
  api.use('/listings', listingsRouter);
  api.use('/media', mediaRouter);
  api.use('/enquiries', enquiryRouter);
  api.use('/me', myListingsRouter);
  api.use('/me', myEnquiryRouter);
  api.use('/me', savedRouter);
  api.use('/admin', adminRouter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
