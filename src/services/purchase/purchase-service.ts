import axios from 'axios';

import { loadConfig } from '../../config/env.js';
import { getSteamHeaders } from '../../core/session.js';

export interface PurchaseInput {
  listingId: string;
  marketHashName: string;
  total: number;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  status?: number;
  payload?: unknown;
}

const env = loadConfig();

function buildOrderAmounts(totalCents: number): { subtotal: number; fee: number; total: number } {
  const estimatedFee = Math.max(1, Math.round(totalCents * 0.15));
  const subtotal = Math.max(1, totalCents - estimatedFee);

  return { subtotal, fee: totalCents - subtotal, total: totalCents };
}

export async function buyItem(input: PurchaseInput): Promise<PurchaseResult> {
  const url = `https://steamcommunity.com/market/buylisting/${input.listingId}`;
  const orderAmounts = buildOrderAmounts(input.total);
  const payload = new URLSearchParams({
    sessionid: env.STEAM_SESSION_ID,
    currency: String(env.STEAM_CURRENCY),
    subtotal: String(orderAmounts.subtotal),
    fee: String(orderAmounts.fee),
    total: String(orderAmounts.total),
    quantity: '1'
  });

  try {
    const response = await axios.post(url, payload.toString(), {
      timeout: env.REQUEST_TIMEOUT_MS,
      headers: getSteamHeaders(
        `https://steamcommunity.com/market/listings/${env.STEAM_APP_ID}/${encodeURIComponent(input.marketHashName)}`
      )
    });

    if (response.data?.wallet_info) {
      return {
        success: true,
        message: 'Item comprado com sucesso',
        status: response.status,
        payload: response.data
      };
    }

    return {
      success: false,
      message: response.data?.message ?? 'Erro desconhecido no checkout',
      status: response.status,
      payload: response.data
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        message: error.response?.data?.message ?? error.message,
        status: error.response?.status,
        payload: error.response?.data
      };
    }

    return {
      success: false,
      message: 'Erro inesperado ao comprar item'
    };
  }
}
