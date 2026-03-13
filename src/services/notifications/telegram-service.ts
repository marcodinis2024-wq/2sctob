import axios from 'axios';

import { loadConfig } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const env = loadConfig();

export async function sendTelegramAlert(message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(
      url,
      {
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `🎯 *Sniper CS2:*\n\n${message}`,
        parse_mode: 'Markdown'
      },
      {
        timeout: env.REQUEST_TIMEOUT_MS
      }
    );
  } catch (error: unknown) {
    logger.error({ error }, 'Falha ao enviar alerta Telegram');
  }
}
