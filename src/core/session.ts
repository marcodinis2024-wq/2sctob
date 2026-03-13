import { loadConfig } from '../config/env.js';

const env = loadConfig();

export function getSteamCookieHeader(): string {
  return `sessionid=${env.STEAM_SESSION_ID}; steamLoginSecure=${env.STEAM_LOGIN_SECURE};`;
}

export function getSteamHeaders(refererListing?: string): Record<string, string> {
  return {
    Cookie: getSteamCookieHeader(),
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': env.STEAM_USER_AGENT,
    Referer:
      refererListing ??
      `https://steamcommunity.com/market/listings/${env.STEAM_APP_ID}/${encodeURIComponent(env.MARKET_HASH_NAME)}`,
    Origin: 'https://steamcommunity.com',
    Accept: '*/*'
  };
}
