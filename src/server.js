import 'dotenv/config';
import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { readCookie } from './auth.js';
import { init } from './store.js';
import { stream } from './ticker.js';
import { pub } from './routes/public.js';
import { account } from './routes/account.js';
import { wallet } from './routes/wallet.js';
import { admin } from './routes/admin.js';

const here = dirname(fileURLToPath(import.meta.url));
await init();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(here, '..', 'public')));
app.use('/uploads', express.static(join(config.dataDir, 'uploads')));

app.use((req, _res, next) => {
  req.session = readCookie(req);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/ticker', stream);

app.use(pub);
app.use(account);
app.use(wallet);
app.use('/admin', admin);

app.listen(config.port, () => console.log(`nova on ${config.port}`));
