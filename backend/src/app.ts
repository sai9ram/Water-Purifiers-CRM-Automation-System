import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { buildCorsOptions } from './config/cors';
import { logger } from './config/logger';
import { openApiSpec } from './config/swagger';
import { verifyDatabaseConnection } from './database/prisma';
import { sendError, sendSuccess } from './utils/api-response';
import { authRoutes } from './modules/auth/auth.routes';
import { customerRoutes } from './modules/customers/customer.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: process.env.NODE_ENV !== 'test'
    })
  );

  // OpenAPI / Swagger UI documentation
  app.get('/api/v1/docs.json', (_req, res) => {
    res.status(200).json(openApiSpec);
  });
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Health check endpoint
  app.get('/api/v1/health', async (_req, res) => {
    const dbConnected = await verifyDatabaseConnection();
    if (!dbConnected) {
      sendError(
        res,
        'Database connection unavailable',
        [{ field: 'database', message: 'PostgreSQL unreachable' }],
        503
      );
      return;
    }

    sendSuccess(
      res,
      'Pure Home Waters API is healthy',
      {
        service: 'pure-home-waters-backend',
        version: '1.0.0',
        database: 'connected',
        timestamp: new Date().toISOString()
      },
      {},
      200
    );
  });

  // Versioned API routes (/api/v1)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/customers', customerRoutes);

  // 404 & centralized error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
