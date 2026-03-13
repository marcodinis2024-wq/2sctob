/**
 * Zero-dependencies price table updater (vanilla Node.js https + fs).
 *
 * Fetches a JSON price feed and stores it in local `prices.json`.
 */

import https from 'node:https';
import { writeFileSync } from 'node:fs';

const PRICE_SOURCE_URL = process.env.PRICE_SOURCE_URL || 'https://api.prices.example/cs2';
const OUTPUT_FILE = process.env.PRICE_OUTPUT_FILE || 'prices.json';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const { statusCode = 0 } = res;

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`HTTP ${statusCode} when fetching price feed`));
          res.resume();
          return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch {
            reject(new Error('Invalid JSON payload from price source'));
          }
        });
      })
      .on('error', (error) => reject(error));
  });
}

async function updatePrices() {
  try {
    const prices = await fetchJson(PRICE_SOURCE_URL);
    writeFileSync(OUTPUT_FILE, `${JSON.stringify(prices, null, 2)}\n`, 'utf8');
    console.log(`✅ Price table updated: ${OUTPUT_FILE}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`❌ Failed to update prices: ${message}`);
    process.exitCode = 1;
  }
}

void updatePrices();
