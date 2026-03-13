import axios from 'axios';

import { loadConfig } from '../../config/env.js';
import { getSteamHeaders } from '../../core/session.js';

const env = loadConfig();

const walletInfoRegex = /g_rgWalletInfo\s*=\s*(\{[\s\S]*?\});/m;

export interface WalletInfo {
  wallet_balance: string;
  wallet_currency: number;
  wallet_fee: string;
  wallet_fee_minimum: string;
  wallet_fee_percent: string;
}

export async function getWalletBalanceCents(): Promise<number | null> {
  const response = await axios.get<string>('https://steamcommunity.com/market/', {
    timeout: env.REQUEST_TIMEOUT_MS,
    headers: getSteamHeaders()
  });

  const match = response.data.match(walletInfoRegex);
  if (!match?.[1]) {
    return null;
  }

  const parsed = JSON.parse(match[1]) as WalletInfo;
  const balance = Number(parsed.wallet_balance);

  return Number.isNaN(balance) ? null : balance;
}
