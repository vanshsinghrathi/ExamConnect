"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../../../components/ui.module.css";
import { AdminGuardShell } from "../../../components/AdminGuardShell";
import { AlertBanner, LoadingSkeleton } from "../../../components/FeedbackStates";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch } from "../../../lib/api";

type SystemHealthResponse = {
  status: string;
  environment: string;
  nodeVersion: string;
  uptimeSeconds: number;
  database: { connected: boolean };
  email: { smtpConfigured: boolean; mode: string };
  redis: { configured: boolean };
  counts: {
    users: number;
    exams: number;
    posts: number;
    rules: number;
    deadlines: number;
    sources: number;
    unverifiedSources: number;
    activeSessions: number;
  };
};

function AdminHealthContent() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHealth() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<SystemHealthResponse>("/admin/system-health");
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load system health.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error) return <AlertBanner tone="error">{error}</AlertBanner>;
  if (!data) return null;

  return (
    <div className={styles.stackLg}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Data Verification, System Health &amp; Admin Settings</h1>
          <p className={styles.pageSubtitle}>
            Live diagnostics for PostgreSQL, SMTP email delivery, Redis worker
            configuration, and unverified official sources.
          </p>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={loadHealth}
        >
          Refresh Status
        </button>
      </div>

      {data.counts.unverifiedSources > 0 && (
        <AlertBanner tone="warning">
          There are <strong>{data.counts.unverifiedSources}</strong> notification
          source(s) awaiting manual verification.{" "}
          <Link href="/admin/sources" className={styles.linkBlue}>
            Review Official Sources
          </Link>
        </AlertBanner>
      )}

      <section className={styles.gridThree}>
        <div className={styles.card}>
          <span className={styles.kpiLabel}>PostgreSQL Database</span>
          <div style={{ marginTop: 8 }}>
            <GenericBadge
              label={data.database.connected ? "Connected" : "Unavailable"}
              tone={data.database.connected ? "success" : "danger"}
            />
          </div>
          <p className={styles.fieldHint} style={{ marginTop: 10 }}>
            {data.counts.exams} exams • {data.counts.posts} posts •{" "}
            {data.counts.rules} rules
          </p>
        </div>

        <div className={styles.card}>
          <span className={styles.kpiLabel}>Email / Password Reset Delivery</span>
          <div style={{ marginTop: 8 }}>
            <GenericBadge
              label={
                data.email.mode === "brevo"
                  ? "Brevo API Configured"
                  : data.email.mode === "smtp"
                  ? "SMTP Configured"
                  : data.email.mode === "ethereal"
                    ? "Ethereal Test Inbox"
                    : "SMTP Unconfigured"
              }
              tone={
                data.email.mode === "brevo" || data.email.mode === "smtp"
                  ? "success"
                  : data.email.mode === "ethereal"
                    ? "info"
                    : "warning"
              }
            />
          </div>
          <p className={styles.fieldHint} style={{ marginTop: 10 }}>
            {data.email.mode === "brevo"
              ? "Emails are sent through Brevo's HTTPS API (BREVO_API_KEY)."
              : data.email.mode === "smtp"
              ? "Outbound SMTP credentials detected."
              : data.email.mode === "ethereal"
                ? "Emails are captured by Ethereal (ethereal.email) and never delivered. Set SMTP_* to a real provider for live delivery."
                : "Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM for live email delivery."}
          </p>
        </div>

        <div className={styles.card}>
          <span className={styles.kpiLabel}>Runtime Environment</span>
          <div style={{ marginTop: 8 }}>
            <GenericBadge label={data.environment.toUpperCase()} tone="info" />
          </div>
          <p className={styles.fieldHint} style={{ marginTop: 10 }}>
            Node {data.nodeVersion} • Uptime {data.uptimeSeconds}s • Active
            sessions: {data.counts.activeSessions}
          </p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Database Integrity &amp; Audit Counts</h2>
        </div>

        <div className={styles.kpiGrid} style={{ marginBottom: 0 }}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Users</span>
            <span className={styles.kpiValue}>{data.counts.users}</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Exams</span>
            <span className={styles.kpiValue}>{data.counts.exams}</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Posts</span>
            <span className={styles.kpiValue}>{data.counts.posts}</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Eligibility Rules</span>
            <span className={styles.kpiValue}>{data.counts.rules}</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Deadlines</span>
            <span className={styles.kpiValue}>{data.counts.deadlines}</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Official Sources</span>
            <span className={styles.kpiValue}>{data.counts.sources}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminHealthPage() {
  return (
    <AdminGuardShell title="Verification & Health">
      {() => <AdminHealthContent />}
    </AdminGuardShell>
  );
}
