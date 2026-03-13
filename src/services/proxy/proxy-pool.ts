import { loadConfig } from '../../config/env.js';

export class ProxyPool {
  private readonly proxies: string[];

  constructor(list: string) {
    this.proxies = list
      .split(',')
      .map((proxy) => proxy.trim())
      .filter((proxy) => proxy.length > 0);
  }

  getRandomProxy(): string | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const idx = Math.floor(Math.random() * this.proxies.length);
    return this.proxies[idx] ?? null;
  }
}

export function createProxyPoolFromEnv(): ProxyPool {
  const env = loadConfig();
  return new ProxyPool(env.PROXY_LIST);
}
