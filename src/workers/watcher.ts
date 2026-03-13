import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

import { loadConfig } from '../config/env.js';
import { CooldownController } from '../core/guardrails/cooldown.js';
import { shouldStopFromKillSwitch } from '../core/guardrails/kill-switch.js';
import { connectRedis } from '../core/redis.js';
import { parseListingsFromHtml } from '../services/market/market-parser.js';
import { sendTelegramAlert } from '../services/notifications/telegram-service.js';
import { PriceService } from '../services/pricing/price-service.js';
import { buyItem } from '../services/purchase/purchase-service.js';
import { createProxyPoolFromEnv } from '../services/proxy/proxy-pool.js';
import { randomBetween } from '../services/rate-limit/jitter.js';
import { getWalletBalanceCents } from '../services/wallet/wallet-service.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/sleep.js';

const env = loadConfig();
const proxyPool = createProxyPoolFromEnv();
const priceService = new PriceService();
const cooldown = new CooldownController();

function buildRecentUrl(): string {
  const params = new URLSearchParams({
    country: env.STEAM_COUNTRY,
    currency: String(env.STEAM_CURRENCY),
    language: env.STEAM_LANGUAGE
  });

  return `https://steamcommunity.com/market/recent?${params.toString()}`;
}

async function watchMarket(): Promise<void> {
  await connectRedis();
  const url = buildRecentUrl();

  logger.info({ url }, 'Watcher worker started');

  while (true) {
    if (shouldStopFromKillSwitch()) {
      logger.warn('Kill switch detected (stop.txt). Encerrando watcher.');
      return;
    }

    if (cooldown.isBlocked()) {
      const waitMs = cooldown.remainingMs();
      logger.warn({ waitMs }, 'Watcher em cooldown após resposta bloqueada');
      await sleep(waitMs);
      continue;
    }

    const proxy = proxyPool.getRandomProxy();
    const proxyAgent = proxy ? new HttpsProxyAgent(proxy) : undefined;

    try {
      const response = await axios.get<{ results_html: string }>(url, {
        timeout: env.REQUEST_TIMEOUT_MS,
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent
      });

      const listings = parseListingsFromHtml(response.data.results_html ?? '');

      for (const listing of listings) {
        const maxBuyPrice = await priceService.getMaxBuyPrice(listing.marketHashName);

        if (maxBuyPrice === null || listing.totalPriceEur > maxBuyPrice) {
          continue;
        }

        const walletBalanceCents = await getWalletBalanceCents();
        if (walletBalanceCents === null) {
          logger.warn({ listingId: listing.listingId }, 'Saldo não pôde ser validado; compra ignorada');
          continue;
        }

        if (walletBalanceCents < listing.totalPriceCents) {
          logger.warn(
            {
              listingId: listing.listingId,
              walletBalanceCents,
              neededCents: listing.totalPriceCents
            },
            'Saldo insuficiente; compra não tentada'
          );
          continue;
        }

        logger.info(
          {
            listingId: listing.listingId,
            marketHashName: listing.marketHashName,
            listingPrice: listing.totalPriceEur,
            maxBuyPrice
          },
          'Buy opportunity detected'
        );

        const purchaseResult = await buyItem({
          listingId: listing.listingId,
          marketHashName: listing.marketHashName,
          total: listing.totalPriceCents
        });

        const message = [
          `Item: ${listing.marketHashName}`,
          `Preço pago (target): €${listing.totalPriceEur.toFixed(2)}`,
          `Preço máx. compra: €${maxBuyPrice.toFixed(2)}`,
          `Resultado: ${purchaseResult.success ? 'SUCESSO' : 'FALHA'} (${purchaseResult.message})`
        ].join('\n');

        await sendTelegramAlert(message);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && (error.response?.status === 429 || error.response?.status === 403)) {
        const waitMs = cooldown.triggerRandomCooldown(15, 30);
        logger.error({ status: error.response?.status, proxy, waitMs }, 'Bloqueio detectado, cooldown ativado');
        await sendTelegramAlert(`⚠️ Cooldown ativado por bloqueio ${error.response?.status}. Pausa: ${Math.round(waitMs / 60000)} min.`);
      } else {
        logger.error({ error, proxy }, 'Watcher cycle failed');
      }
    }

    await sleep(randomBetween(env.WATCHER_INTERVAL_MIN_MS, env.WATCHER_INTERVAL_MAX_MS));
  }
}

watchMarket().catch((error: unknown) => {
  logger.error({ error }, 'Watcher crashed');
  process.exitCode = 1;
});
