import { loadConfig } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  logger.info(
    {
      steamAppId: config.STEAM_APP_ID,
      marketHashName: config.MARKET_HASH_NAME,
      priceRefreshMinutes: config.PRICE_REFRESH_MINUTES,
      watcherInterval: [config.WATCHER_INTERVAL_MIN_MS, config.WATCHER_INTERVAL_MAX_MS]
    },
    'Bootstrap complete. Run dedicated workers via npm scripts.'
  );
}

bootstrap().catch((error: unknown) => {
  logger.error({ error }, 'Fatal startup error');
  process.exitCode = 1;
});
