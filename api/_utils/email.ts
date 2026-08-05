import { Resend } from "resend";
import nodemailer from "nodemailer";

// ============================================================
// Sending mail.
//
// Two providers behind one function. Locally that is Mailpit, the SMTP server
// the Supabase stack already runs, so every email this app sends is visible at
// http://127.0.0.1:54324 without a key, without a verified domain, and without
// the risk of a test run reaching a real person. In production it is Resend.
//
// The choice is made from the environment rather than from a flag a caller
// passes, because the one thing that must never happen is a development run
// posting to the live provider. Resend is used only when a key is present and
// the environment says production.
//
// Failures are reported, never thrown. Email is a notification channel, not
// the transaction: a course a parent paid for must not fail to appear because
// a mail server was briefly unavailable. The in-app notification is the
// record; this is the copy.
// ============================================================

export interface EmailInput {
  to: string | string[];
  subject: string;
  /** Rendered by layout() unless `raw` is set. */
  html: string;
  replyTo?: string;
}

export type EmailResult = { sent: boolean; provider: "resend" | "smtp" | "none"; error?: string };

const FROM = process.env.EMAIL_FROM || "Yakal Education Services <onboarding@resend.dev>";

function provider(): "resend" | "smtp" {
  const isProduction =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  // A key on its own is not enough. Someone with a production key in their
  // local .env should still be sending to Mailpit.
  if (isProduction && process.env.RESEND_API_KEY) return "resend";
  return "smtp";
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const recipients = to.filter((a) => a && a.includes("@"));
  if (recipients.length === 0) return { sent: false, provider: "none", error: "No recipient" };

  const which = provider();

  try {
    if (which === "resend") {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: FROM,
        to: recipients,
        subject: input.subject,
        html: input.html,
        replyTo: input.replyTo,
      });
      if (error) return { sent: false, provider: "resend", error: error.message };
      return { sent: true, provider: "resend" };
    }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "127.0.0.1",
      port: Number(process.env.SMTP_PORT || 54325),
      // Mailpit accepts anything and speaks plain SMTP.
      secure: false,
      ignoreTLS: true,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
        : undefined,
    });

    await transport.sendMail({
      from: FROM,
      to: recipients.join(", "),
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    return { sent: true, provider: "smtp" };
  } catch (err: any) {
    console.error(`sendEmail via ${which} failed:`, err?.message ?? err);
    return { sent: false, provider: which, error: err?.message ?? "Send failed" };
  }
}

// ------------------------------------------------------------
// Layout
//
// Inline styles and a table, because that is what mail clients render.
// Outlook ignores most of a stylesheet and several clients strip <style>
// entirely, so anything that matters has to sit on the element.
// ------------------------------------------------------------

const TEAL = "#1099A1";

export function layout(opts: {
  heading: string;
  intro: string;
  /** Body rows, each a label and a value. Omitted when empty. */
  facts?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  footer?: string;
  /** Who it is to, so the greeting is a name rather than "Hello there". */
  recipientName?: string;
}): string {
  const facts = (opts.facts ?? [])
    .filter((f) => f.value)
    .map(
      (f) => `
        <tr>
          <td style="padding:8px 0;color:#667781;font-size:13px;width:150px;vertical-align:top;">${escapeHtml(f.label)}</td>
          <td style="padding:8px 0;color:#111111;font-size:14px;font-weight:600;">${escapeHtml(f.value)}</td>
        </tr>`
    )
    .join("");

  // Full width, no card. A 560px rounded panel floating on grey is a web page
  // pretending to be an email: on a phone it is a narrow column inside a
  // narrow screen, and the rounding is the first thing an older client throws
  // away. The content is the page, and it reads at any width.
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:${TEAL};padding:28px 24px;">
      <p style="margin:0;color:#ffffff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Yakal Education Services</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.25;">${escapeHtml(opts.heading)}</h1>
    </td></tr>

    <tr><td style="padding:28px 24px 0;">
      ${
        opts.recipientName
          ? `<p style="margin:0 0 16px;color:#111111;font-size:15px;line-height:1.6;">Hello ${escapeHtml(
              opts.recipientName
            )},</p>`
          : ""
      }
      <p style="margin:0 0 20px;color:#333333;font-size:15px;line-height:1.65;">${escapeHtml(opts.intro)}</p>

      ${facts ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e9edef;border-bottom:1px solid #e9edef;margin:0 0 22px;">${facts}</table>` : ""}

      ${
        opts.cta
          ? `<a href="${opts.cta.url}" style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;">${escapeHtml(opts.cta.label)}</a>`
          : ""
      }
    </td></tr>

    <tr><td style="padding:26px 24px 0;">
      <p style="margin:0;color:#333333;font-size:15px;line-height:1.6;">Yakal Education Services</p>
      <p style="margin:4px 0 0;color:#8696a0;font-size:13px;line-height:1.6;">Tutoring and college admissions</p>
    </td></tr>

    <tr><td style="padding:22px 24px 32px;">
      <div style="border-top:1px solid #e9edef;padding-top:16px;">
        <p style="margin:0;color:#8696a0;font-size:12px;line-height:1.6;">${escapeHtml(
          opts.footer ?? "You are receiving this because you have a Yakal account."
        )}</p>
      </div>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The app's public URL, for links in an email. */
export function appUrl(path = ""): string {
  const base =
    process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");
  return `${base.replace(/\/$/, "")}${path}`;
}
