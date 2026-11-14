import { Router } from 'express';
import { layout, flash } from '../ui.js';
import { snap, fmt } from '../ticker.js';

export const pub = Router();

pub.get('/', (req, res) => {
  const rows = snap()
    .map(
      (t) => `<tr>
    <td><b>${t.sym}</b><span class="muted">/USDT</span></td>
    <td>$${fmt(t.price)}</td>
    <td class="${t.change >= 0 ? 'up' : 'down'}">${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%</td>
    <td class="muted">${(t.price * 1200).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
  </tr>`,
    )
    .join('');

  res.send(
    layout(
      'Trade crypto',
      `
<section class="hero">
  <div class="pill">◈ New accounts only · limited offer</div>
  <h1>Deposit $100.<br><span class="grad">Walk out with $1,100.</span></h1>
  <p class="lead">Open a free account, fund it with up to $100, and we drop <b>$1,000</b> straight into your
  balance. Withdraw the entire amount after 24 hours. No staking, no lock-ups, no tiers.</p>
  <div class="cta">
    <a class="btn lg" href="/register">Claim your $1,000 →</a>
    <a class="ghost lg" href="/login">I already have an account</a>
  </div>
  <div class="stats">
    <div><b>1.8M+</b><span>traders worldwide</span></div>
    <div><b>$4.2B</b><span>volume settled</span></div>
    <div><b>190</b><span>countries served</span></div>
    <div><b>99.98%</b><span>uptime, 6 yrs</span></div>
  </div>
</section>

<section id="bonus" class="band">
  <div class="bandcard">
    <div class="bandtop"><span class="badge">BONUS</span><span class="muted">expires soon</span></div>
    <h2>$1,000 welcome bonus</h2>
    <p>Register, confirm your email, and make a first deposit of $100 or less. The bonus lands instantly.
    It unlocks for withdrawal exactly 24 hours later — live countdown in your dashboard.</p>
    <div class="steps">
      <div><span>1</span>Create your account</div>
      <div><span>2</span>Confirm your email</div>
      <div><span>3</span>Deposit up to $100</div>
      <div><span>4</span>Collect $1,000</div>
    </div>
    <a class="btn lg full" href="/register">Start now — takes 40 seconds</a>
  </div>
</section>

<section id="markets" class="sec">
  <h2>Markets</h2>
  <p class="muted">Live pricing. 400+ pairs, 0.10% maker fee, deep liquidity.</p>
  <div class="tablewrap"><table class="mkt">
    <thead><tr><th>Pair</th><th>Last price</th><th>24h</th><th>Volume</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
</section>

<section id="how" class="sec grid3">
  <div class="glass"><h3>Cold storage by default</h3>
  <p>97% of assets sit in air-gapped multisig vaults. Hot wallet exposure is capped and insured.</p></div>
  <div class="glass"><h3>Proof of reserves</h3>
  <p>Merkle-tree attestations published monthly. Verify your balance against the root at any time.</p></div>
  <div class="glass"><h3>24/7 human support</h3>
  <p>Median first response under 4 minutes, in 14 languages. No bots pretending to be people.</p></div>
</section>

<section class="sec quotes">
  <div class="glass"><p>“Deposited $80, got the $1,000 bonus, withdrew $1,080 the next day. No drama.”</p>
  <span>— Adaeze O., Lagos</span></div>
  <div class="glass"><p>“Cheapest fees I've paid anywhere. The verification took me four minutes.”</p>
  <span>— Marcus T., Berlin</span></div>
  <div class="glass"><p>“Been here two years. Withdrawals have never once been late.”</p>
  <span>— Priya S., Singapore</span></div>
</section>

<section class="final">
  <h2>Your $1,000 is waiting.</h2>
  <p class="muted">1.8 million people already opened an account. The bonus is per person, once.</p>
  <a class="btn lg" href="/register">Create free account</a>
</section>
`,
    ),
  );
});

pub.get('/register', (req, res) =>
  res.send(
    layout(
      'Create account',
      `
<section class="auth">
  <form class="glass form" method="post" action="/register">
    <h2>Create your account</h2>
    <p class="muted">Claim the $1,000 welcome bonus.</p>
    ${flash(req.query.e)}
    <label>Email</label><input name="email" type="email" required>
    <label>Phone number</label><input name="phone" type="tel" required>
    <label>Password</label><input name="password" type="password" minlength="8" required>
    <button class="btn full" type="submit">Create account</button>
    <p class="muted sm">Already registered? <a href="/login">Log in</a></p>
  </form>
</section>`,
    ),
  ),
);

pub.get('/login', (req, res) =>
  res.send(
    layout(
      'Log in',
      `
<section class="auth">
  <form class="glass form" method="post" action="/login">
    <h2>Welcome back</h2>
    ${flash(req.query.e)}
    <label>Email</label><input name="email" type="email" required>
    <label>Password</label><input name="password" type="password" required>
    <button class="btn full" type="submit">Log in</button>
    <p class="muted sm">No account? <a href="/register">Get $1,000</a></p>
  </form>
</section>`,
    ),
  ),
);
