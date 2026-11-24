import nodemailer from 'nodemailer';
import { config } from '../config/env';

const RESEND_API_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_FROM_ADDRESS = 'JoodPakPaw <no-reply@joodpakpaw.com>';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  emailType: 'otp' | 'password_reset';
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || config.env === 'production';
}

async function dispatchViaSmtp(payload: EmailPayload): Promise<void> {
  const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, from } = config.email;
  const host = smtpHost || 'smtp.gmail.com';
  const sender =
    from && from !== DEFAULT_FROM_ADDRESS ? from : `JoodPakPaw <${smtpUser}>`;

  const transporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(smtpPort) ? smtpPort : 587,
    secure: smtpSecure || smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: EMAIL_REQUEST_TIMEOUT_MS,
    greetingTimeout: EMAIL_REQUEST_TIMEOUT_MS,
    socketTimeout: EMAIL_REQUEST_TIMEOUT_MS,
  });

  await transporter.sendMail({
    from: sender,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

async function dispatchEmail(payload: EmailPayload): Promise<void> {
  const apiKey = config.email.resendApiKey;
  const from = config.email.from;
  const { smtpUser, smtpPass } = config.email;
  const hasSmtp = Boolean(smtpUser && smtpPass);
  const isProd = isProductionRuntime();

  if (hasSmtp) {
    try {
      await dispatchViaSmtp(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(
        `[EmailService] Failed to send ${payload.emailType} email via SMTP: ${message}`
      );
    }
    return;
  }

  if (!apiKey) {
    if (isProd) {
      // Never log email addresses, OTPs, or reset URLs/tokens in production logs
      console.warn(
        `[EmailService] Neither SMTP nor RESEND_API_KEY is configured; skipped ${payload.emailType} email delivery.`
      );
    } else if (process.env.NODE_ENV !== 'test') {
      console.info(
        `[EmailService] Dev fallback (SMTP/RESEND_API_KEY not set): type=${payload.emailType} to=${payload.to} subject="${payload.subject}"`
      );
    }
    return;
  }

  try {
    const response = await fetch(RESEND_API_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
      signal: AbortSignal.timeout(EMAIL_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[EmailService] Resend API error for ${payload.emailType} email: HTTP ${response.status}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      `[EmailService] Failed to send ${payload.emailType} email via Resend: ${message}`
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sends a 6-digit OTP verification email via Resend (or non-throwing dev fallback).
 */
export async function sendOtpEmail(
  to: string,
  otp: string,
  refCode: string
): Promise<void> {
  const safeOtp = escapeHtml(otp);
  const safeRef = escapeHtml(refCode);
  const subject = 'JoodPakPaw — Verify Your Email (OTP Code)';
  const html = [
    '<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">',
    '<h2 style="color: #0f766e;">Welcome to JoodPakPaw</h2>',
    '<p>Please use the verification code below to confirm your email address. This code expires in 15 minutes.</p>',
    `<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">`,
    `<div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f766e;">${safeOtp}</div>`,
    `<div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Reference Code: <strong>${safeRef}</strong></div>`,
    '</div>',
    '<p style="font-size: 13px; color: #6b7280;">If you did not request this code, you can safely ignore this email.</p>',
    '</div>',
  ].join('');
  const text = `Your JoodPakPaw verification code is ${otp} (Ref: ${refCode}). This code expires in 15 minutes.`;

  await dispatchEmail({
    to,
    subject,
    html,
    text,
    emailType: 'otp',
  });
}

/**
 * Sends a password reset link email via Resend (or non-throwing dev fallback).
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const safeUrl = escapeHtml(resetUrl);
  const subject = 'JoodPakPaw — Reset Your Password';
  const html = [
    '<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">',
    '<h2 style="color: #0f766e;">Reset Your JoodPakPaw Password</h2>',
    '<p>We received a request to reset your password. Click the button below to choose a new password. This link expires in 1 hour.</p>',
    `<p style="margin: 24px 0;"><a href="${safeUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Reset Password</a></p>`,
    '<p style="font-size: 13px; color: #6b7280;">If you did not request a password reset, you can safely ignore this email.</p>',
    '</div>',
  ].join('');
  const text = `Reset your JoodPakPaw password using this link (expires in 1 hour): ${resetUrl}`;

  await dispatchEmail({
    to,
    subject,
    html,
    text,
    emailType: 'password_reset',
  });
}

export const emailService = {
  sendOtpEmail,
  sendPasswordResetEmail,
};
