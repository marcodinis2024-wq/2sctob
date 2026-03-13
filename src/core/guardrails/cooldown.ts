export class CooldownController {
  private blockedUntil = 0;

  isBlocked(now = Date.now()): boolean {
    return now < this.blockedUntil;
  }

  remainingMs(now = Date.now()): number {
    return Math.max(0, this.blockedUntil - now);
  }

  triggerRandomCooldown(minMinutes: number, maxMinutes: number): number {
    const minMs = minMinutes * 60_000;
    const maxMs = maxMinutes * 60_000;
    const span = Math.max(0, maxMs - minMs);
    const chosen = minMs + Math.floor(Math.random() * (span + 1));

    this.blockedUntil = Date.now() + chosen;
    return chosen;
  }
}
