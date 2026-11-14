import 'dotenv/config';

const n = (v, d) =>
  (Number.isFinite(Number(v)) ? Number(v) : d);

export const config = {
  port: n(process.env.PORT, 3000),

  sessionSecret:
    process.env.SESSION_SECRET || 'dev-secret-change-me',

  adminPassword:
    process.env.ADMIN_PASSWORD || 'changeme',

  tgToken:
    process.env.TELEGRAM_BOT_TOKEN || '',

  tgChat:
    process.env.TELEGRAM_CHAT_ID || '',

  bonusAmount:
    n(process.env.BONUS_AMOUNT, 1000),

  bonusMinDeposit:
    n(process.env.BONUS_MIN_DEPOSIT, 100),

  bonusLockHours:
    n(process.env.BONUS_LOCK_HOURS, 24),

  minWithdraw:
    n(process.env.MIN_WITHDRAW, 50),

  dataDir: '/tmp/nova',

  brand: 'Nova Exchange',

  appUrl: (
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, ''),

  // EMAIL CONFIGURATION

  mailProvider:
    (process.env.MAIL_PROVIDER || 'console').toLowerCase().trim(),

  mailFrom:
    process.env.MAIL_FROM ||
    'Nova Exchange <no-reply@localhost>',

  // BREVO API
  brevoKey:
    process.env.BREVO_API_KEY || '',

  // RESEND API
  resendKey:
    process.env.RESEND_API_KEY || '',

  // SMTP CONFIGURATION
  smtp: {
    host:
      process.env.SMTP_HOST || '',

    port:
      n(process.env.SMTP_PORT, 587),

    user:
      process.env.SMTP_USER || '',

    pass:
      process.env.SMTP_PASS || '',
  },

  // EMAIL VERIFICATION SETTINGS

  showVerifyLink:
    String(process.env.MAIL_DEV_SHOW_LINK).toLowerCase() === 'true',

  verifyTtlHours: 24,

  verifyCooldownMs: 60_000,

  verifyDailyCap: 5,
};

export const NETWORKS = [
  {
    id: 'eth',
    label: 'Ethereum',
    sym: 'ETH',
    env: 'WALLET_ETH',
    fee: 3
  },
  {
    id: 'tron',
    label: 'Tron',
    sym: 'TRX',
    env: 'WALLET_TRON',
    fee: 1
  },
  {
    id: 'polygon',
    label: 'Polygon',
    sym: 'POL',
    env: 'WALLET_POLYGON',
    fee: 0.5
  },
  {
    id: 'sol',
    label: 'Solana',
    sym: 'SOL',
    env: 'WALLET_SOL',
    fee: 0.5
  },
  {
    id: 'btc',
    label: 'Bitcoin',
    sym: 'BTC',
    env: 'WALLET_BTC',
    fee: 4
  },
  {
    id: 'bep20',
    label: 'BNB Chain',
    sym: 'BNB',
    env: 'WALLET_BEP20',
    fee: 0.5
  },
];

export const addressFor = (net) =>
  (process.env[net.env] || '').trim();
