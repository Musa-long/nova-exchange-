import { Router } from 'express';
import { layout, usd } from '../ui.js';
import { config, NETWORKS } from '../config.js';
import {
  allPending,
  byId,
  creditDeposit,
  round,
  touch,
  users,
  stats,
  markVerified,
} from '../store.js';
import { notify, esc } from '../telegram.js';

export const admin = Router();

admin.use((req, _res, next) => {
  req.isAdmin = (req.headers.cookie || '').includes(`adm=${encodeURIComponent(config.adminPassword)}`);
  next();
});

admin.get('/', (req, res) => {
  if (!req.isAdmin) {
    return res.send(
      layout(
        'Admin',
        `
<section class="auth"><form class="glass form" method="post" action="/admin/login">
  <h2>Admin</h2><label>Password</label><input name="password" type="password" required>
  <button class="btn full" type="submit">Enter</button></form></section>`,
      ),
    );
  }

  const { deposits, withdrawals } = allPending();
  const s = stats();

  const depRows = deposits
    .map(
      (d) => `<tr>
    <td>${esc(d.user.email)}</td><td>${d.network}</td><td>${usd(d.amount)}</td>
    <td><code>${esc(d.txHash).slice(0, 18)}…</code></td>
    <td><form method="post" action="/admin/deposit/${d.user.id}/${d.id}" class="inline">
      <input name="amount" type="number" step="0.01" value="${d.amount}" style="width:90px">
      <button class="btn sm" name="act" value="credit">Credit</button>
      <button class="ghost sm" name="act" value="reject">Reject</button></form></td></tr>`,
    )
    .join('');

  const wdRows = withdrawals
    .map(
      (w) => `<tr>
    <td>${esc(w.user.email)}</td><td>${w.network}</td><td>${usd(w.amount)}</td>
    <td><code>${esc(w.address).slice(0, 20)}…</code></td>
    <td><form method="post" action="/admin/withdraw/${w.user.id}/${w.id}" class="inline">
      <button class="btn sm" name="act" value="paid">Paid</button>
      <button class="ghost sm" name="act" value="reject">Refund</button></form></td></tr>`,
    )
    .join('');

  const kycRows = users()
    .filter((u) => u.kyc)
    .map(
      (u) => `<tr>
    <td>${esc(u.email)}</td><td>${esc(u.kyc.first)} ${esc(u.kyc.last)}</td>
    <td>${esc(u.kyc.country)}</td><td>${esc(u.kyc.docType)} ${esc(u.kyc.docNumber)}</td>
    <td><span class="badge ${u.kyc.status}">${u.kyc.status}</span></td>
    <td><form method="post" action="/admin/kyc/${u.id}" class="inline">
      <button class="btn sm" name="act" value="approve">Approve</button>
      <button class="ghost sm" name="act" value="reject">Reject</button></form></td>
    <td><form method="post" action="/admin/verify/${u.id}" class="inline">
      ${u.emailVerified ? '✅' : '<button class="btn sm" name="act" value="verify">Mark verified</button>'}
    </form></td></tr>`,
    )
    .join('');

  const wallets = NETWORKS.map(
    (n) => `<tr><td>${n.label}</td><td><code>${esc(process.env[n.env] || '—')}</code></td></tr>`,
  ).join('');

  res.send(
    layout(
      'Admin',
      `
<section class="sec">
  <h2>Admin</h2>
  <div class="cards">
    <div class="glass stat"><span>Users</span><b>${s.users}</b></div>
    <div class="glass stat"><span>Verified</span><b>${s.verified}</b></div>
    <div class="glass stat"><span>Credited volume</span><b>${usd(s.volume)}</b></div>
    <div class="glass stat"><span>Pending KYC</span><b>${s.kyc}</b></div>
  </div>

  <h3 class="mt">Pending deposits</h3>
  <div class="tablewrap"><table class="mkt"><tbody>${depRows || '<tr><td class="muted">none</td></tr>'}</tbody></table></div>

  <h3 class="mt">Pending withdrawals</h3>
  <div class="tablewrap"><table class="mkt"><tbody>${wdRows || '<tr><td class="muted">none</td></tr>'}</tbody></table></div>

  <h3 class="mt">KYC queue</h3>
  <div class="tablewrap"><table class="mkt"><tbody>${kycRows || '<tr><td class="muted">none</td></tr>'}</tbody></table></div>

  <h3 class="mt">Configured receive addresses</h3>
  <div class="tablewrap"><table class="mkt"><tbody>${wallets}</tbody></table></div>
</section>`,
    ),
  );
});

admin.post('/login', (req, res) => {
  if (req.body.password !== config.adminPassword) return res.redirect('/admin');
  res.cookie('adm', config.adminPassword, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 864e5 });
  res.redirect('/admin');
});

admin.post('/deposit/:userId/:depId', (req, res) => {
  const user = byId(req.params.userId);
  const dep = user?.deposits.find((d) => d.id === req.params.depId);
  if (!dep) return res.redirect('/admin');

  if (req.body.act === 'credit') {
    const bonus = creditDeposit(user, dep, round(Number(req.body.amount || dep.amount)));
    notify(
      `✅ <b>DEPOSIT CREDITED</b>\n${esc(user.email)} · ${usd(dep.amount)}${
        bonus ? `\n🎁 bonus ${usd(config.bonusAmount)} issued` : ''
      }`,
    );
  } else {
    dep.status = 'rejected';
    touch();
  }
  res.redirect('/admin');
});

admin.post('/withdraw/:userId/:wdId', (req, res) => {
  const user = byId(req.params.userId);
  const w = user?.withdrawals.find((x) => x.id === req.params.wdId);
  if (!w) return res.redirect('/admin');

  if (req.body.act === 'paid') {
    w.status = 'paid';
    notify(`💸 <b>WITHDRAWAL PAID</b>\n${esc(user.email)} · ${usd(w.amount)} · ${w.network}`);
  } else {
    w.status = 'rejected';
    user.balance = round(user.balance + w.amount);
  }
  touch();
  res.redirect('/admin');
});

admin.post('/kyc/:userId', (req, res) => {
  const user = byId(req.params.userId);
  if (user?.kyc) {
    user.kyc.status = req.body.act === 'approve' ? 'approved' : 'rejected';
    touch();
  }
  res.redirect('/admin');
});

admin.post('/verify/:userId', (req, res) => {
  const user = byId(req.params.userId);
  if (user && !user.emailVerified) {
    markVerified(user);
    notify(`✋ <b>MANUALLY VERIFIED</b>\n${esc(user.email)}`);
  }
  res.redirect('/admin');
});
