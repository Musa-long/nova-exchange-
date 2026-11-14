import { scryptSync, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(pw, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && timingSafeEqual(known, test);
}

const sign = (v) => createHmac('sha256', config.sessionSecret).update(v).digest('base64url');

export function issueCookie(res, id) {
  const payload = Buffer.from(JSON.stringify({ id, at: Date.now() })).toString('base64url');
  res.cookie('sid', `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 864e5,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function readCookie(req) {
  const raw = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sid='));
  if (!raw) return null;
  const value = decodeURIComponent(raw.slice(4));
  const [payload, sig] = value.split('.');
  if (!payload || sig !== sign(payload)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
}
