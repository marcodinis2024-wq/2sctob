'use strict';

/**
 * Zero-dependencies market monitor (vanilla Node.js https).
 *
 * This script is intentionally limited to safe monitoring + alerting.
 * It does NOT execute automated purchases.
 */

const https = require('https');

const CONFIG = {
  steamCountry: process.env.STEAM_COUNTRY || 'PT',
  steamCurrency: process.env.STEAM_CURRENCY || '3',
  steamLanguage: process.env.STEAM_LANGUAGE || 'portuguese',
  pollIntervalMs: Number(process.env.VANILLA_POLL_INTERVAL_MS || 5000),
  maxAlertPriceEur: Number(process.env.VANILLA_MAX_ALERT_PRICE_EUR || 10),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || ''
};

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
    try {
      const listings = await pollRecentMarket();
      const opportunities = listings.filter((item) => item.priceEur <= CONFIG.maxAlertPriceEur).slice(0, 3);

      for (const item of opportunities) {
        const msg = `Opportunity: ${item.name}\nPrice: €${item.priceEur.toFixed(2)}\nListing: ${item.listingId}`;
        console.log(msg);
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
