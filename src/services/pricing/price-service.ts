import { loadConfig } from '../../config/env.js';
import { redis } from '../../core/redis.js';
import { logger } from '../../utils/logger.js';

export interface ExternalPriceItem {
  marketHashName: string;
  buffPrice: number;
}

export interface PriceReference {
  marketHashName: string;
  buffPrice: number;
  maxBuyPrice: number;
  updatedAt: string;
}

const PRICE_KEY_PREFIX = 'price';

export class PriceService {
  private readonly env = loadConfig();

  calculateMaxBuyPrice(buffPrice: number): number {
    const margin = this.env.TARGET_MARGIN_PERCENT / 100;
    const maxBuyPrice = buffPrice * this.env.STEAM_NET_MULTIPLIER * (1 - margin);

    return Number(maxBuyPrice.toFixed(2));
  }

  async updateReferencePrices(items: ExternalPriceItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const pipeline = redis.pipeline();
    const now = new Date().toISOString();

    for (const item of items) {
      const maxBuyPrice = this.calculateMaxBuyPrice(item.buffPrice);

      const payload: PriceReference = {
        marketHashName: item.marketHashName,
        buffPrice: item.buffPrice,
        maxBuyPrice,
        updatedAt: now
      };

      pipeline.set(`${PRICE_KEY_PREFIX}:${item.marketHashName}`, JSON.stringify(payload));
    }

    await pipeline.exec();

    logger.info({ updatedItems: items.length }, 'Reference prices updated in Redis');
    return items.length;
  }

  async getMaxBuyPrice(marketHashName: string): Promise<number | null> {
    const raw = await redis.get(`${PRICE_KEY_PREFIX}:${marketHashName}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PriceReference;
    return parsed.maxBuyPrice;
  }
}
