import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  STEAM_APP_ID: z.string().default('730'),
  MARKET_HASH_NAME: z.string().min(1).default('AK-47 | Asiimov (Field-Tested)'),
  STEAM_COUNTRY: z.string().default('PT'),
  STEAM_LANGUAGE: z.string().default('portuguese'),
  STEAM_CURRENCY: z.coerce.number().int().default(3),

  REDIS_URL: z.string().url(),
  POSTGRES_URL: z.string().url(),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),

  STEAM_SESSION_ID: z.string().min(1),
  STEAM_LOGIN_SECURE: z.string().min(1),
  STEAM_WALLET_CURRENCY: z.string().default('3'),
  STEAM_USER_AGENT: z.string().default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'),

  TARGET_MARGIN_PERCENT: z.coerce.number().min(0).max(100).default(5),
  STEAM_NET_MULTIPLIER: z.coerce.number().positive().default(0.87),
  PRICE_REFRESH_MINUTES: z.coerce.number().int().positive().default(15),
  MAX_BUY_PRICE: z.coerce.number().positive(),

  WATCHER_INTERVAL_MIN_MS: z.coerce.number().int().positive().default(500),
  WATCHER_INTERVAL_MAX_MS: z.coerce.number().int().positive().default(1000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(6000),
  REQUEST_JITTER_MIN_MS: z.coerce.number().int().positive().default(50),
  REQUEST_JITTER_MAX_MS: z.coerce.number().int().positive().default(200),

  PROXY_LIST: z.string().default('')
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}
