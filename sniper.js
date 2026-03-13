/**
 * Zero-dependencies market monitor (vanilla Node.js https).
 *
 * Safe mode: monitoring + alerting only (no auto-buy).
 */

import https from 'node:https';
import { existsSync, readFileSync } from 'node:fs';

const CONFIG = {
  steamCountry: process.env.STEAM_COUNTRY || 'PT',
  steamCurrency: process.env.STEAM_CURRENCY || '3',
  steamLanguage: process.env.STEAM_LANGUAGE || 'portuguese',
  pollIntervalMs: Number(process.env.VANILLA_POLL_INTERVAL_MS || 5000),
  priceDbFile: process.env.PRICE_OUTPUT_FILE || 'prices.json',
  profitabilityMultiplier: Number(process.env.PROFITABILITY_MULTIPLIER || 0.8),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || ''
};

function loadPriceDatabase() {
  if (!existsSync(CONFIG.priceDbFile)) {
    console.warn(`⚠️ Price database not found: ${CONFIG.priceDbFile}`);
    return {};
  }

  try {
    const raw = readFileSync(CONFIG.priceDbFile, 'utf8');
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn(`⚠️ Invalid price database format in ${CONFIG.priceDbFile}`);
      return {};
    }

    const normalized = Object.entries(parsed).reduce((acc, [name, value]) => {
      const num = Number(value);
      if (!Number.isNaN(num) && num > 0) {
        acc[name] = num;
      }
      return acc;
    }, {});

    console.log(`Loaded ${Object.keys(normalized).length} items from price database (${CONFIG.priceDbFile}).`);
    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`⚠️ Failed to parse ${CONFIG.priceDbFile}: ${message}`);
    return {};
  }
}

function httpsRequest({ hostname, path, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers
      },
      (res) => {
        let chunks = '';
        res.on('data', (d) => {
          chunks += d;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body: chunks });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function notifyTelegram(message) {
  if (!CONFIG.telegramToken || !CONFIG.telegramChatId) {
    return Promise.resolve();
  }

  const payload = JSON.stringify({
    chat_id: CONFIG.telegramChatId,
    text: `📈 Steam Watcher\n\n${message}`
  });

  return httpsRequest({
    hostname: 'api.telegram.org',
    path: `/bot${CONFIG.telegramToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    body: payload
  }).catch((error) => {
    console.error('[telegram] failed:', error.message);
  });
}

function extractListings(resultsHtml) {
  const regex =
    /Market_LoadOrderSpread\(\s*(\d+)\s*\).*?market_listing_item_name"[^>]*>([^<]+)<\/span>[\s\S]*?market_listing_price market_listing_price_with_fee"[^>]*>([\d.,]+)\s*€/gim;
  const items = [];

  for (const match of resultsHtml.matchAll(regex)) {
    const listingId = match[1];
    const name = (match[2] || '').trim();
    const normalized = (match[3] || '').replace(/\./g, '').replace(',', '.');
    const priceEur = Number(normalized);

    if (!listingId || !name || Number.isNaN(priceEur)) continue;
    items.push({ listingId, name, priceEur });
  }

  return items;
}

function checkProfit(priceDb, itemName, steamPrice) {
  const referencePrice = priceDb[itemName];
  if (!referencePrice) return false;

  const maxPurchasePrice = referencePrice * CONFIG.profitabilityMultiplier;

  if (steamPrice <= maxPurchasePrice) {
    console.log(
      `🎯 OPORTUNIDADE: ${itemName} por €${steamPrice.toFixed(2)} (Ref: €${referencePrice.toFixed(2)}, Max: €${maxPurchasePrice.toFixed(2)})`
    );
    return {
      referencePrice,
      maxPurchasePrice
    };
  }

  return false;
}

async function pollRecentMarket() {
  const path = `/market/recent?country=${encodeURIComponent(CONFIG.steamCountry)}&currency=${encodeURIComponent(CONFIG.steamCurrency)}&language=${encodeURIComponent(CONFIG.steamLanguage)}`;

  const res = await httpsRequest({
    hostname: 'steamcommunity.com',
    path,
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (res.statusCode !== 200) {
    throw new Error(`Steam status ${res.statusCode}`);
  }

  const parsed = JSON.parse(res.body);
  const html = parsed.results_html || '';
  return extractListings(html);
}

async function run() {
  console.log('🚀 Vanilla monitor started (safe mode, no auto-buy).');

  while (true) {
    const priceDb = loadPriceDatabase();

    try {
      const listings = await pollRecentMarket();

      for (const item of listings) {
        const opportunity = checkProfit(priceDb, item.name, item.priceEur);
        if (!opportunity) continue;

        const msg = [
          `Opportunity: ${item.name}`,
          `Steam: €${item.priceEur.toFixed(2)}`,
          `Reference: €${opportunity.referencePrice.toFixed(2)}`,
          `Max buy: €${opportunity.maxPurchasePrice.toFixed(2)}`,
          `Listing: ${item.listingId}`
        ].join('\n');

        await notifyTelegram(msg);
      }
    } catch (error) {
      console.error('[watcher] cycle failed:', error.message);
    }

    await new Promise((r) => setTimeout(r, CONFIG.pollIntervalMs));
  }
}

run().catch((error) => {
  console.error('[fatal]', error.message);
  process.exitCode = 1;
});
