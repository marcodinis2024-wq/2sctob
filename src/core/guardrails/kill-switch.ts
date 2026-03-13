import { existsSync } from 'node:fs';

export function shouldStopFromKillSwitch(): boolean {
  return existsSync('stop.txt');
}
