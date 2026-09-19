import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional().default(''),
  USE_EMBEDDED_POSTGRES: z.string().optional().default('true'),
  DATA_DIR: z.string().default('./data'),
  JWT_SECRET: z.string().default('super_secret_bidstorm_jwt_key_2026_change_in_production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().optional().default(''),
  BID_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(1000),
  BID_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export const env = envSchema.parse(process.env);
