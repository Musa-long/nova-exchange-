const SEED = {
  BTC: 96420, ETH: 3310, SOL: 187, TRX: 0.244, POL: 0.462,
  BNB: 618, XRP: 2.31, DOGE: 0.318, ADA: 0.912, AVAX: 34.7, LINK: 22.4, DOT: 6.85,
};

const prev = {};
const price = { ...SEED };
const change = Object.fromEntries(Object.keys(SEED).map((k) => [k, 1.2]));
const clients = new Set();

export const snap = () =>
  Object.keys(price).map((sym) => ({
    sym,
    price: price[sym],
    change: change[sym],
    dir: price[sym] >= (prev[sym] ?? price[sym]) ? 'up' : 'down',
  }));

setInterval(() => {
  for (const sym of Object.keys(price)) {
    prev[sym] = price[sym];
    const drift = (Math.random() - 0.48) * 0.004;
    price[sym] = Math.max(price[sym] * (1 + drift), 0.0001);
    change[sym] = Math.max(-14, Math.min(14, change[sym] + (Math.random() - 0.5) * 0.3));
  }
  const payload = `data: ${JSON.stringify(snap())}\n\n`;
  for (const res of clients) res.write(payload);
}, 4000);

export function stream(req, res) {
  res.set({
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify(snap())}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

export const fmt = (v) =>
  v >= 1000
    ? v.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : v >= 1
      ? v.toFixed(2)
      : v.toFixed(4);
