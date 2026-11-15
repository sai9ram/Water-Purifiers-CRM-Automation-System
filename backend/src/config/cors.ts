import { CorsOptions } from 'cors';
import { env } from './env';

export function buildCorsOptions(): CorsOptions {
  const allowedOrigins = env.FRONTEND_URL.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'test') {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  };
}
