# Deployment & Production Readiness Guide

This guide covers deploying **ExamConnect** (`apps/web`, `apps/api`, `apps/worker`) with PostgreSQL, Redis, HTTPS cookies, and live SMTP email delivery.

## 1. Environment Variables Checklist

Never commit `.env` files or real credentials to Git. Configure these variables in your hosting provider's secret store:

### Backend (`apps/api` & `apps/worker`)

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | API port (default `4000`) |
| `HOST` | Yes | Bind address (`0.0.0.0` in containers/cloud) |
| `DATABASE_URL` | Yes | PostgreSQL 17 connection URI (`sslmode=require` recommended in prod) |
| `REDIS_HOST` / `REDIS_PORT` | Worker | Redis connection for BullMQ job scheduling |
| `APP_URL` | Yes | Public frontend URL (e.g. `https://examconnect.example.com`) used to build password reset links |
| `CORS_ORIGINS` | Yes | Comma-separated allowed frontend origins |
| `COOKIE_SECURE` | Yes | Set `true` over HTTPS (enables `Secure` + `SameSite=None` for cross-origin APIs) |
| `BREVO_API_KEY` | One of Brevo or SMTP | Brevo API key (`xkeysib-...`). When set, email goes over HTTPS via Brevo instead of SMTP |
| `EMAIL_FROM` | With Brevo | Verified Brevo sender, e.g. `ExamConnect Security <no-reply@yourdomain.com>` (falls back to `SMTP_FROM`) |
| `SMTP_HOST` | One of Brevo or SMTP | SMTP server hostname (e.g. `smtp.resend.com`, `smtp.sendgrid.net`, `email-smtp.ap-south-1.amazonaws.com`) |
| `SMTP_PORT` | Yes (for reset mail) | `587` (STARTTLS) or `465` (SMTPS/TLS) |
| `SMTP_SECURE` | Optional | `true` for port `465`, `false` for STARTTLS on `587` |
| `SMTP_USER` | Yes (for reset mail) | SMTP authentication username |
| `SMTP_PASS` | Yes (for reset mail) | SMTP authentication password / API key |
| `SMTP_FROM` | Yes (for reset mail) | Verified sender header (e.g. `ExamConnect Security <no-reply@yourdomain.com>`) |

### Frontend (`apps/web`)

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Public HTTPS URL of the Fastify API (never store DB or SMTP secrets in `NEXT_PUBLIC_*`) |

## 2. Email Delivery Behavior (Forgot Password)

Mail is sent by `apps/api/src/email/email-service.ts`, using the first provider that is configured:

1. **Brevo HTTPS API** — when `BREVO_API_KEY` is set. Sender comes from `EMAIL_FROM` (falls back to `SMTP_FROM`) and must be verified at https://app.brevo.com/senders. **Use this on Render free and Railway Hobby**, which block outbound SMTP ports 25/465/587; HTTPS is not blocked. Free plan: 300 emails/day.
2. **SMTP via [Nodemailer](https://nodemailer.com)** — when `SMTP_HOST` and `SMTP_FROM` are set (Gmail, SES, Resend SMTP, ...). Needs a host that allows outbound SMTP.
3. **Ethereal** — development only (see below).

- **Production (`NODE_ENV=production`)**:
  - Requires a real SMTP provider. If SMTP credentials are missing **or point at Ethereal** (`smtp.ethereal.email`, which never delivers mail), `POST /auth/forgot-password` returns HTTP `503` and logs an operational error. It **never** claims an email was sent when delivery fails.
  - Reset tokens are **never** logged in production.
- **Local Development (`NODE_ENV !== production`)** — [Ethereal Email](https://ethereal.email) test inbox:
  - Ethereal is a free fake SMTP service: it accepts mail but never delivers it. No API key is needed.
  - **Persistent inbox (recommended):** create an account at https://ethereal.email/create (or run `node -e "require('nodemailer').createTestAccount().then(console.log)"` from `apps/api`) and put its credentials in `.env` with `SMTP_HOST=smtp.ethereal.email`, `SMTP_PORT=587`. Log in at https://ethereal.email/login to see every captured email.
  - **Zero config:** if `SMTP_HOST` is blank, the API creates a throwaway Ethereal account on the first reset request.
  - Either way, the API logs a `previewUrl` for each reset email; open it to view the message and click the `/reset-password?token=...` link.
  - To send real mail locally, set `SMTP_*` to a real provider instead.

## 3. Production Build Steps

```powershell
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Apply database migrations (additive, non-destructive)
pnpm --filter @examconnect/database exec prisma db migrate

# 3. Typecheck and run automated tests
pnpm typecheck
pnpm --filter @examconnect/api test

# 4. Build API and Frontend
pnpm --filter @examconnect/api build
pnpm --filter web build
```

## 4. Running in Production

```powershell
# Start API
pnpm --filter @examconnect/api start

# Start Frontend
pnpm --filter web start

# Start Background Worker (requires Redis)
pnpm --filter @examconnect/worker dev
```

## 5. Health Check Endpoints

- `GET /health` — API liveness probe
- `GET /health/db` — PostgreSQL readiness probe
- `GET /admin/system-health` — Authenticated admin diagnostics (DB, SMTP status, active sessions, unverified source count)
