import nodemailer, { type Mail } from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

/**
 * - "brevo": Brevo's transactional email HTTPS API (BREVO_API_KEY). Works on hosts that
 *   block outbound SMTP ports (Render free tier, Railway Hobby). Takes priority over SMTP.
 * - "smtp": a real SMTP provider delivers mail to real inboxes.
 * - "ethereal": mail is captured by Ethereal (https://ethereal.email) and never delivered;
 *   each message gets a preview URL. Used for development and testing only.
 * - "unconfigured": no delivery possible (production without SMTP).
 */
export type EmailMode = "brevo" | "smtp" | "ethereal" | "unconfigured";

export type EmailDeliveryResult = {
  delivered: boolean;
  mode: EmailMode;
  messageId?: string;
  previewUrl?: string;
  error?: string;
};

export const ETHEREAL_SMTP_HOST = "smtp.ethereal.email";

export function isEtherealHost(host: string): boolean {
  return host.trim().toLowerCase() === ETHEREAL_SMTP_HOST;
}

export function getSmtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !from) {
    return null;
  }

  const port = portRaw ? Number(portRaw) : 587;
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;

  return {
    host,
    port,
    secure,
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfigFromEnv() !== null;
}

export const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export type EmailAddress = { email: string; name?: string };

export type BrevoConfig = {
  apiKey: string;
  sender: EmailAddress;
};

/**
 * Parses `Name <email@example.com>`, `"Name" <email@example.com>` or a bare address.
 */
export function parseEmailAddress(value: string): EmailAddress | null {
  const trimmed = value.trim().replace(/^"(.*)"$/, "$1").trim();
  const match = trimmed.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"(.*)"$/, "$1").trim();
    return name ? { email: match[2], name } : { email: match[2] };
  }
  return /^[^\s<>@]+@[^\s<>@]+$/.test(trimmed) ? { email: trimmed } : null;
}

/**
 * Brevo is used when BREVO_API_KEY is set. The sender comes from EMAIL_FROM
 * (falling back to SMTP_FROM) and must be a verified sender in Brevo.
 */
export function getBrevoConfigFromEnv(): BrevoConfig | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  const fromRaw = process.env.EMAIL_FROM?.trim() || process.env.SMTP_FROM?.trim() || "";
  const sender = parseEmailAddress(fromRaw);
  if (!sender) {
    return null;
  }
  return { apiKey, sender };
}

/**
 * Whether password reset emails can reach real inboxes in production.
 * Ethereal never delivers mail, so it does not count.
 */
export function canDeliverRealEmail(): boolean {
  if (getBrevoConfigFromEnv()) {
    return true;
  }
  const config = getSmtpConfigFromEnv();
  return config !== null && !isEtherealHost(config.host);
}

export function getEmailMode(): EmailMode {
  if (getBrevoConfigFromEnv()) {
    return "brevo";
  }
  const config = getSmtpConfigFromEnv();
  if (config) {
    return isEtherealHost(config.host) ? "ethereal" : "smtp";
  }
  // Outside production an Ethereal test account is created on demand.
  return process.env.NODE_ENV === "production" ? "unconfigured" : "ethereal";
}

let autoEtherealConfig: Promise<SmtpConfig> | null = null;

async function createAutoEtherealConfig(): Promise<SmtpConfig> {
  const account = await nodemailer.createTestAccount();
  return {
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    user: account.user,
    pass: account.pass,
    from: `ExamConnect Security <${account.user}>`,
  };
}

/**
 * Uses SMTP_* from the environment. Outside production, if SMTP is not configured,
 * a throwaway Ethereal account is created once per process.
 */
async function resolveSmtpConfig(): Promise<SmtpConfig | null> {
  const fromEnv = getSmtpConfigFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  autoEtherealConfig ??= createAutoEtherealConfig();
  try {
    return await autoEtherealConfig;
  } catch (error) {
    autoEtherealConfig = null; // allow a retry on the next request
    throw error;
  }
}

let cachedTransport: { key: string; transporter: Mail } | null = null;

function getTransporter(config: SmtpConfig): Mail {
  const key = JSON.stringify([config.host, config.port, config.secure, config.user, config.pass]);
  if (cachedTransport?.key === key) {
    return cachedTransport.transporter;
  }
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
  cachedTransport = { key, transporter };
  return transporter;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPasswordResetEmail(params: {
  resetUrl: string;
  expiresMinutes: number;
  recipientEmail: string;
}): { subject: string; text: string; html: string } {
  const safeUrl = escapeHtml(params.resetUrl);
  const safeEmail = escapeHtml(params.recipientEmail);
  const subject = "Reset your ExamConnect password";

  const text = [
    "ExamConnect — Password Reset Request",
    "",
    `We received a request to reset the password for your ExamConnect account (${params.recipientEmail}).`,
    "",
    `Reset your password using the secure link below (valid for ${params.expiresMinutes} minutes and single-use):`,
    params.resetUrl,
    "",
    "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.",
    "",
    "— ExamConnect Security Team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your ExamConnect password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f1f3d;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dde4ef;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:#0f1f3d;padding:24px 32px;">
              <div style="font-size:14px;font-weight:800;letter-spacing:0.14em;color:#ffffff;">EXAMCONNECT</div>
              <div style="font-size:12px;color:#9db4d8;margin-top:4px;">Government Exam Eligibility &amp; Recruitment Platform</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f1f3d;">Reset your password</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#41516d;">
                We received a password reset request for your ExamConnect account (<strong>${safeEmail}</strong>).
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#41516d;">
                Click the button below to choose a new password. This link expires in <strong>${params.expiresMinutes} minutes</strong> and can only be used once.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#1d4ed8;border-radius:8px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#5b6b84;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#1d4ed8;background:#f4f7fc;padding:10px 12px;border-radius:6px;border:1px solid #e1e8f3;">
                ${safeUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e6ecf5;margin:24px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.6;color:#6c7b93;">
                If you did not request a password reset, you can safely ignore this message. All existing sessions will be revoked once a password reset is completed.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

const BREVO_TIMEOUT_MS = 15_000;

/**
 * Sends one email through Brevo's transactional API over HTTPS.
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 * Success is HTTP 201 with {"messageId": "..."}; errors return {"code", "message"}.
 */
export async function sendViaBrevo(
  config: BrevoConfig,
  message: { to: string; subject: string; html: string },
  fetchImpl: typeof fetch = fetch,
): Promise<EmailDeliveryResult> {
  let response: Response;
  try {
    response = await fetchImpl(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: config.sender,
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
      }),
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      delivered: false,
      mode: "brevo",
      error: timedOut
        ? `Brevo API did not respond within ${BREVO_TIMEOUT_MS / 1000}s.`
        : `Could not reach Brevo API: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const bodyText = await response.text().catch(() => "");
  let body: { messageId?: string; code?: string; message?: string } = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    // non-JSON body; reported below as raw text
  }

  if (!response.ok) {
    const detail = body.message
      ? `${body.code ?? "error"}: ${body.message}`
      : bodyText.slice(0, 300) || response.statusText;
    return {
      delivered: false,
      mode: "brevo",
      error: `Brevo API rejected the email (HTTP ${response.status}) — ${detail}`,
    };
  }

  return {
    delivered: true,
    mode: "brevo",
    ...(body.messageId ? { messageId: body.messageId } : {}),
  };
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<EmailDeliveryResult> {
  const rendered = renderPasswordResetEmail({
    resetUrl: params.resetUrl,
    expiresMinutes: params.expiresMinutes,
    recipientEmail: params.to,
  });

  if (process.env.BREVO_API_KEY?.trim()) {
    const brevo = getBrevoConfigFromEnv();
    if (!brevo) {
      return {
        delivered: false,
        mode: "brevo",
        error:
          "BREVO_API_KEY is set but EMAIL_FROM (or SMTP_FROM) is missing or not a valid address, e.g. \"ExamConnect <you@example.com>\".",
      };
    }
    return sendViaBrevo(brevo, { to: params.to, ...rendered });
  }

  let config: SmtpConfig | null;
  try {
    config = await resolveSmtpConfig();
  } catch (error) {
    return {
      delivered: false,
      mode: "ethereal",
      error: `Could not create an Ethereal test account: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  if (!config) {
    return {
      delivered: false,
      mode: "unconfigured",
      error:
        "Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
    };
  }

  const mode: EmailMode = isEtherealHost(config.host) ? "ethereal" : "smtp";

  try {
    const info = await getTransporter(config).sendMail({
      from: config.from,
      to: params.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    const previewUrl = mode === "ethereal" ? nodemailer.getTestMessageUrl(info) : false;

    return {
      delivered: true,
      mode,
      messageId: info.messageId,
      ...(previewUrl ? { previewUrl } : {}),
    };
  } catch (error) {
    return {
      delivered: false,
      mode,
      error: error instanceof Error ? error.message : "SMTP delivery failed.",
    };
  }
}
