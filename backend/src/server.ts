import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma, verifyDatabaseConnection } from './database/prisma';

async function startServer(): Promise<void> {
  const connected = await verifyDatabaseConnection();
  if (!connected) {
    logger.error('Failed to connect to PostgreSQL database on startup');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        docsUrl: `http://localhost:${env.PORT}/api/v1/docs`
      },
      'Pure Home Waters Backend Server started'
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down server gracefully...');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void startServer();
