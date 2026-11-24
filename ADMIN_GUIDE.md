# ExamConnect Administrator Guide

## 1. Secure Administrator Setup (No Public Admin Signup)

ExamConnect intentionally has **no public admin registration route**. Create or promote an administrator securely via the CLI bootstrap script:

### Promote an Existing User to ADMIN

```powershell
$env:ADMIN_EMAIL="your-admin@example.com"
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/api bootstrap:admin
```

### Create a New ADMIN User

```powershell
$env:ADMIN_EMAIL="your-admin@example.com"
$env:ADMIN_PASSWORD="StrongAdminPassword1!"
node "$env:APPDATA\npm\node_modules\pnpm\bin\pnpm.mjs" --filter @examconnect/api bootstrap:admin
```

Clear temporary environment variables after running:

```powershell
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

Sign in at `/` with your admin credentials. The left sidebar automatically reveals the **Administration** section (`/admin`).

---

## 2. Adding & Verifying Government Examinations

1. **Register Official Source (`/admin/sources`)**:
   - Add the official notification PDF or recruitment portal URL from authoritative government domains (`ssc.gov.in`, `upsc.gov.in`, `ibps.in`, `sbi.co.in/web/careers`, `opportunities.rbi.org.in`, `rrbcdg.gov.in`).
   - Record the notification title, publication date, reference identifier, and verify the source.
2. **Create Exam (`/admin/exams`)**:
   - Click **Add New Exam** and enter the official name, conducting authority, exam level, and official website URL.
3. **Configure Posts, Eligibility Rules & Deadlines (`/admin/exams/[examId]`)**:
   - **Posts**: Add each post group separately with verified vacancies (leave blank if unverified — never invent numbers) and exact qualification wording.
   - **Category Age Rules**: Use `conditionField: ageByCategory`, `operator: BETWEEN`, and format:
     ```text
     general:18-27,obc:18-30,sc:18-32,st:18-32,ews:18-27|2026-08-01
     ```
     The date after `|` is the exact official cutoff date (e.g. `2026-08-01`).
   - **AND / OR Logic Groups**: Assign rules sharing an alternative condition the same `logicGroup` name (e.g. `degree_option`) and set `logicOperator: OR`.
   - **Attach Source**: Select the verified official notification PDF for each active rule version.
   - **Deadlines**: Set exact official start/closing dates and status (`OPEN`, `UPCOMING`, `NOTIFICATION_AWAITED`, or `CLOSED`). Expired closing dates are automatically computed as `CLOSED` and never shown as open.

---

## 3. Data Verification & System Health (`/admin/health`)

Use `/admin/health` to monitor:
- PostgreSQL connectivity and live row counts
- Unverified notification sources requiring administrator review
- Email delivery mode for Forgot Password (real SMTP, Ethereal test inbox, or unconfigured)
- Active session count and API runtime uptime
