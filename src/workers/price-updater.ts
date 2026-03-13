import { loadConfig } from '../config/env.js';
import { connectRedis } from '../core/redis.js';
import { PriceService, type ExternalPriceItem } from '../services/pricing/price-service.js';
import { sleep } from '../utils/sleep.js';
import { logger } from '../utils/logger.js';

const env = loadConfig();
const priceService = new PriceService();

async function fetchExternalPrices(): Promise<ExternalPriceItem[]> {
  // Placeholder for Buff163/CSFloat adapters.
  return [
    { marketHashName: 'AK-47 | Slate (Field-Tested)', buffPrice: 2.5 },
    { marketHashName: 'M4A1-S | Cyrex (Factory New)', buffPrice: 14.2 }
  ];
}

async function runPriceUpdater(): Promise<void> {
  await connectRedis();
  logger.info('Price updater worker started');

  while (true) {
    try {
      const items = await fetchExternalPrices();
      await priceService.updateReferencePrices(items);
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to refresh price references');
    }

    await sleep(env.PRICE_REFRESH_MINUTES * 60_000);
  }
}

runPriceUpdater().catch((error: unknown) => {
  logger.error({ error }, 'Price updater crashed');
  process.exitCode = 1;
});
