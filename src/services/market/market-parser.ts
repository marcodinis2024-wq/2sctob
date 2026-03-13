export interface SteamListingSnapshot {
  listingId: string;
  marketHashName: string;
  totalPriceEur: number;
  totalPriceCents: number;
}

const listingRegex =
  /Market_LoadOrderSpread\(\s*(\d+)\s*\).*?market_listing_item_name"[^>]*>([^<]+)<\/span>[\s\S]*?market_listing_price market_listing_price_with_fee"[^>]*>([\d.,]+)\s*€/gim;

export function parseListingsFromHtml(html: string): SteamListingSnapshot[] {
  const snapshots: SteamListingSnapshot[] = [];

  for (const match of html.matchAll(listingRegex)) {
    const listingId = match[1];
    const marketHashName = match[2]?.trim();
    const normalizedPrice = match[3]?.replace(/\./g, '').replace(',', '.');
    const totalPriceEur = Number(normalizedPrice);

    if (!listingId || !marketHashName || Number.isNaN(totalPriceEur)) {
      continue;
    }

    snapshots.push({
      listingId,
      marketHashName,
      totalPriceEur,
      totalPriceCents: Math.round(totalPriceEur * 100)
    });
  }

  return snapshots;
}
