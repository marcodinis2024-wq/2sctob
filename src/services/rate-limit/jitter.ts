export function randomBetween(minMs: number, maxMs: number): number {
  if (maxMs <= minMs) {
    return minMs;
  }

  return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
}
