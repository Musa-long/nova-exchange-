import { config } from './config.js';

export async function notify(html) {
  if (!config.tgToken || !config.tgChat) return;
  try {
    await fetch(`https://api.telegram.org/bot${config.tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.tgChat,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch {}
}

export const esc = (s) =>
  String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
