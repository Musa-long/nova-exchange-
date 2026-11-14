import { config } from './config.js';
import { notify, esc } from './telegram.js';

let transporter = null;

async function smtp() {
  if (transporter) return transporter;

  const { default: nodemailer } = await import('nodemailer');

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });

  return transporter;
}

async function deliver(to, subject, html, text) {

  // BREVO API
  if (config.mailProvider === 'brevo' && config.brevoKey) {

    const match = config.mailFrom.match(/^(.*?)\s*<([^<>]+)>$/);

    const sender = match
      ? {
          name: match[1].trim(),
          email: match[2].trim(),
        }
      : {
          email: config.mailFrom.trim(),
        };

    const res = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          'api-key': config.brevoKey,
          'accept': 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        `Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`
      );
    }

    return 'brevo';
  }

  // RESEND API
  if (config.mailProvider === 'resend' && config.resendKey) {

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.resendKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: config.mailFrom,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`
      );
    }

    return 'resend';
  }

  // SMTP
  if (config.mailProvider === 'smtp' && config.smtp.host) {

    const tx = await smtp();

    await tx.sendMail({
      from: config.mailFrom,
      to,
      subject,
      html,
      text,
    });

    return 'smtp';
  }

  console.log(`[mail:console] to=${to}\n${text}\n`);

  return 'console';
}

export async function sendVerification(user, token) {

  const link =
    `${config.appUrl}/verify?token=${encodeURIComponent(token)}`;

  const subject = 'Confirm your Nova Exchange account';

  const text =
    `Confirm your email to activate your Nova Exchange account and claim the $1,000 bonus.\n\n` +
    `${link}\n\nThis link expires in ${config.verifyTtlHours} hours.`;

  const html = `
  <div style="font-family:system-ui,sans-serif;background:#07090c;color:#e8eef6;padding:32px;border-radius:14px;max-width:520px">

    <h2 style="margin:0 0 8px">Confirm your email</h2>

    <p style="color:#7c8b9d;font-size:14px">
      Activate your account and unlock the
      <b style="color:#00e08a">$1,000</b> welcome bonus.
    </p>

    <p style="margin:24px 0">
      <a href="${link}"
        style="background:#00e08a;color:#04150e;padding:13px 22px;border-radius:9px;font-weight:700;text-decoration:none">
        Confirm email
      </a>
    </p>

    <p style="color:#7c8b9d;font-size:12px;word-break:break-all">
      ${esc(link)}
    </p>

    <p style="color:#7c8b9d;font-size:12px">
      Expires in ${config.verifyTtlHours} hours.
    </p>

  </div>`;

  let channel = 'console';

  try {

    channel = await deliver(
      user.email,
      subject,
      html,
      text
    );

  } catch (err) {

    channel = `failed: ${err.message}`;

    notify(
      `⚠️ <b>VERIFY MAIL FAILED</b>\n` +
      `${esc(user.email)}\n` +
      `<code>${esc(err.message).slice(0, 200)}</code>`
    );
  }

  return { channel, link };
}
