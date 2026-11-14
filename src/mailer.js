import { config } from './config.js';
import { notify, esc } from './telegram.js';

let transporter = null;

async function smtp() {
  if (transporter) return transporter;

  const { default: nodemailer } = await import('nodemailer');

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: Number(config.smtp.port),
    secure: Number(config.smtp.port) === 465,

    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

async function deliver({ to, subject, html, text }) {
  const provider = String(config.mailProvider || '')
    .trim()
    .toLowerCase();

  if (provider === 'brevo') {
    if (!config.brevoKey) {
      throw new Error('BREVO_API_KEY is missing');
    }

    const response = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',

        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': config.brevoKey,
        },

        body: JSON.stringify({
          sender: {
            name: 'Nova exchange',
            email: config.mailFrom
              .match(/<(.+)>/)?.[1] || config.mailFrom,
          },

          to: [{ email: to }],

          subject,
          htmlContent: html,
          textContent: text,
        }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `Brevo ${response.status}: ${JSON.stringify(result)}`
      );
    }

    return 'Brevo';
  }

  if (provider === 'resend') {
    if (!config.resendKey) {
      throw new Error('RESEND_API_KEY is missing');
    }

    const response = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${config.resendKey}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          from: config.mailFrom,
          to: [to],
          subject,
          html,
          text,
        }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `Resend ${response.status}: ${JSON.stringify(result)}`
      );
    }

    return 'Resend';
  }

  if (provider === 'smtp') {
    const mailer = await smtp();

    await mailer.sendMail({
      from: config.mailFrom,
      to,
      subject,
      html,
      text,
    });

    return 'SMTP';
  }

  console.log('EMAIL TO:', to);
  console.log('SUBJECT:', subject);
  console.log(text);

  return 'Console';
}

export async function sendVerification(user, code) {
  const subject = 'Your Nova Exchange verification code';

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:25px;background:#f5f5f5;border-radius:12px;">
    <div style="background:#ffffff;padding:25px;border-radius:10px;">
      <h2 style="color:#111827;text-align:center;">Nova Exchange</h2>

      <p>Hello ${esc(user.email)},</p>

      <p>Use the verification code below to confirm your email address.</p>

      <div style="background:#eef2ff;padding:20px;text-align:center;border-radius:8px;margin:25px 0;">
        <strong style="font-size:32px;letter-spacing:8px;color:#2563eb;">
          ${esc(code)}
        </strong>
      </div>

      <p>This code expires in <b>10 minutes</b>.</p>

      <p>If you did not create this account, you can ignore this email.</p>

      <hr>

      <p style="font-size:12px;color:#777;text-align:center;">
        Nova Exchange
      </p>
    </div>
  </div>
  `;

  const text = `
Nova Exchange

Your email verification code is: ${code}

This code expires in 10 minutes.

If you did not create this account, ignore this email.
`;

  try {
    const channel = await deliver({
      to: user.email,
      subject,
      html,
      text,
    });

    return { channel };
  } catch (error) {
    console.error('Email delivery failed:', error);

    notify(
      `⚠️ <b>EMAIL DELIVERY FAILED</b>\n<b>Email:</b> ${esc(user.email)}\n<b>Error:</b> ${esc(error.message)}`
    );

    return {
      channel: `failed: ${error.message}`,
    };
  }
}
