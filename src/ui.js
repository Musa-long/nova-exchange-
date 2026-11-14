import { config } from './config.js';
import { snap, fmt } from './ticker.js';

export const usd = (v) =>
  `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function layout(title, body, { user, active } = {}) {
  const ticker = snap()
    .slice(0, 10)
    .map(
      (t) => `<span class="tick"><b>${t.sym}</b> $${fmt(t.price)}
      <i class="${t.dir}">${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%</i></span>`,
    )
    .join('');

  const links = user
    ? [['/dashboard', 'Portfolio'], ['/deposit', 'Deposit'], ['/withdraw', 'Withdraw'], ['/kyc', 'Verification']]
    : [['/#bonus', 'Bonus'], ['/#markets', 'Markets'], ['/#how', 'How it works']];

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · ${config.brand}</title><link rel="stylesheet" href="/app.css"></head>
<body>
<div class="ticker"><div class="tickrow">${ticker}</div></div>
<nav class="nav">
  <a class="logo" href="/"><span class="mark">◈</span>${config.brand}</a>
  <div class="navlinks">${links
    .map(([h, l]) => `<a href="${h}" class="${active === l ? 'on' : ''}">${l}</a>`)
    .join('')}</div>
  <div class="navauth">${
    user
      ? `<a class="ghost" href="/logout">Sign out</a>`
      : `<a class="ghost" href="/login">Log in</a><a class="btn sm" href="/register">Get $1,000</a>`
  }</div>
</nav>
${body}
<footer class="foot">
  <div><b>${config.brand}</b> — trusted by 1,800,000+ traders in 190 countries.</div>
  <div class="muted">© ${new Date().getFullYear()} ${config.brand}. Digital asset services.</div>
</footer>
<script src="/app.js"></script></body></html>`;
}

export function flash(q) {
  const map = {
    registered: 'Account created. Confirm your email to unlock the $1,000 bonus.',
    verified: 'Email confirmed. You can now deposit and withdraw.',
    badlogin: 'Wrong email or password.',
    exists: 'That email is already registered.',
    invalid: 'That link is not valid. Request a new one.',
    expired: 'That link expired. Request a new one.',
    sent: 'Verification email sent.',
    cooldown: 'Please wait a minute before requesting another.',
    capped: 'Daily limit reached. Try again tomorrow.',
    deposit: 'Deposit submitted. We credit within minutes of confirmation.',
    withdraw: 'Withdrawal requested. Pending review.',
    lowbal: 'Insufficient available balance.',
    kyc: 'Verification documents received. Review takes up to 24 hours.',
  };
  return q && map[q] ? `<div class="alert">${map[q]}</div>` : '';
}
