import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { config } from './config.js';

const FILE = join(config.dataDir, 'db.json');
let db = { users: [] };
let timer = null;

export const sha256 = (v) => createHash('sha256').update(v).digest('hex');

export async function init() {
  await mkdir(config.dataDir, { recursive: true });
  try {
    db = JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    db = { users: [] };
  }
  for (const u of db.users) if (u.emailVerified === undefined) u.emailVerified = false;
}

function save() {
  clearTimeout(timer);
  timer = setTimeout(() => writeFile(FILE, JSON.stringify(db)).catch(() => {}), 120);
}

export const users = () => db.users;
export const byEmail = (email) =>
  db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase().trim());
export const byId = (id) => db.users.find((u) => u.id === id);
export const byToken = (token) =>
  db.users.find((u) => u.verifyToken && u.verifyToken === sha256(token));

export function createUser({ email, phone, passwordHash }) {
  const user = {
    id: randomUUID(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    passwordHash,
    createdAt: Date.now(),
    emailVerified: false,
    verifyToken: null,
    verifyExpires: 0,
    verifySentAt: 0,
    verifyCount: 0,
    verifyDay: new Date().toDateString(),
    balance: 0,
    bonus: 0,
    bonusUnlocksAt: 0,
    bonusIssued: false,
    kyc: null,
    deposits: [],
    withdrawals: [],
  };
  db.users.push(user);
  save();
  return user;
}

export function issueVerification(user) {
  const token = randomBytes(32).toString('base64url');
  user.verifyToken = sha256(token);
  user.verifyExpires = Date.now() + config.verifyTtlHours * 3600_000;
  user.verifySentAt = Date.now();

  const today = new Date().toDateString();
  if (user.verifyDay !== today) {
    user.verifyDay = today;
    user.verifyCount = 0;
  }
  user.verifyCount++;
  save();
  return token;
}

export function canResend(user) {
  if (Date.now() - user.verifySentAt < config.verifyCooldownMs) {
    return {
      ok: false,
      wait: Math.ceil((config.verifyCooldownMs - (Date.now() - user.verifySentAt)) / 1000),
    };
  }
  if (user.verifyDay === new Date().toDateString() && user.verifyCount >= config.verifyDailyCap) {
    return { ok: false, wait: 0, capped: true };
  }
  return { ok: true };
}

export function markVerified(user) {
  user.emailVerified = true;
  user.verifyToken = null;
  user.verifyExpires = 0;
  save();
}

export function touch() {
  save();
}

export const round = (v) => Math.round(v * 100) / 100;

export function maybeUnlock(user) {
  if (user.bonus > 0 && user.bonusUnlocksAt && Date.now() >= user.bonusUnlocksAt) {
    user.balance = round(user.balance + user.bonus);
    user.bonus = 0;
    save();
  }
  return user;
}

export function creditDeposit(user, dep, amount) {
  dep.status = 'credited';
  dep.amount = round(amount);
  dep.creditedAt = Date.now();
  user.balance = round(user.balance + dep.amount);

  let bonusIssued = false;
  const isFirst = user.deposits.filter((d) => d.status === 'credited').length === 1;
  if (isFirst && !user.bonusIssued && user.emailVerified && dep.amount <= config.bonusMinDeposit) {
    user.bonusIssued = true;
    user.bonus = config.bonusAmount;
    user.bonusUnlocksAt = Date.now() + config.bonusLockHours * 3600_000;
    bonusIssued = true;
  }
  save();
  return bonusIssued;
}

export function allPending() {
  const deposits = [];
  const withdrawals = [];
  for (const u of db.users) {
    for (const d of u.deposits) if (d.status === 'pending') deposits.push({ ...d, user: u });
    for (const w of u.withdrawals) if (w.status === 'pending') withdrawals.push({ ...w, user: u });
  }
  return { deposits, withdrawals };
}

export function stats() {
  const credited = db.users.flatMap((u) => u.deposits).filter((d) => d.status === 'credited');
  return {
    users: db.users.length,
    verified: db.users.filter((u) => u.emailVerified).length,
    volume: round(credited.reduce((s, d) => s + d.amount, 0)),
    kyc: db.users.filter((u) => u.kyc?.status === 'pending').length,
  };
}
