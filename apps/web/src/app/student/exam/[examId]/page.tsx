"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../../../../components/ui.module.css";
import { AppShell } from "../../../../components/AppShell";
import {
  AlertBanner,
  EmptyState,
  LoadingSkeleton,
} from "../../../../components/FeedbackStates";
import {
  IconArrowLeft,
  IconBookmark,
  IconCheckCircle,
  IconExternalLink,
  IconFileText,
  IconXCircle,
} from "../../../../components/Icons";
import {
  DeadlineStatusBadge,
  EligibilityBadge,
  GenericBadge,
} from "../../../../components/StatusBadge";
import { apiFetch, cleanReason, formatDate } from "../../../../lib/api";
import { useAuthGuard } from "../../../../lib/useAuthGuard";
import type { ExamResult } from "../../../../lib/types";

export default function ExamDetailsPage() {
  const { user, checking } = useAuthGuard();
  const params = useParams();
  const examId = Number(params.examId);

  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingBookmark, setSavingBookmark] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!Number.isInteger(examId) || examId <= 0) {
      setError("Invalid examination ID.");
      setLoading(false);
      return;
    }

    let active = true;
    async function loadExam() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch<{ results: ExamResult[] }>(
          `/student/exams/${examId}/eligibility`,
        );
        if (!active) return;
        setResults(data.results ?? []);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Unable to load examination details.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadExam();
    return () => {
      active = false;
    };
  }, [user, examId]);

  const first = results[0] ?? null;
  const isSaved = Boolean(first?.saved);

  async function handleToggleSave() {
    if (!first) return;
    try {
      setSavingBookmark(true);
      await apiFetch(`/student/saved-exams/${first.exam.id}`, {
        method: isSaved ? "DELETE" : "POST",
      });
      setResults((prev) => prev.map((r) => ({ ...r, saved: !isSaved })));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update bookmark.",
      );
    } finally {
      setSavingBookmark(false);
    }
  }

  if (checking || !user) {
    return (
      <main className={styles.authCentered}>
        <section className={styles.authCard}>
          <LoadingSkeleton rows={2} />
        </section>
      </main>
    );
  }

  const allSources = Array.from(
    new Map(results.flatMap((r) => r.sources).map((s) => [s.id, s])).values(),
  );
  const allDeadlines = Array.from(
    new Map(results.flatMap((r) => r.deadlines).map((d) => [d.id, d])).values(),
  );
  const anyEligible = results.some((r) => r.eligible);

  // Exam-level rules from first item (shared across exam)
  const examLevelRules = (first?.ruleEvaluations ?? []).filter(
    (r) => r.scope === "EXAM",
  );

  return (
    <AppShell user={user} title="Examination Details">
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/"
          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
        >
          <IconArrowLeft size={14} />
          Back to Dashboard
        </Link>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <AlertBanner tone="error">{error}</AlertBanner>
      ) : !first ? (
        <EmptyState
          title="Examination not found"
          description="The requested examination does not exist or has been archived."
          action={
            <Link href="/" className={`${styles.btn} ${styles.btnPrimary}`}>
              Return to Dashboard
            </Link>
          }
        />
      ) : (
        <div className={styles.stackLg}>
          {/* Exam Overview Card */}
          <section className={styles.card}>
            <div className={styles.examCardTop}>
              <div>
                <div className={styles.examAuthority}>
                  {first.exam.conductingBody}
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
                  {first.exam.name}
                </h1>
                <div className={styles.examMetaRow}>
                  <EligibilityBadge eligible={anyEligible} />
                  {first.exam.examType && (
                    <GenericBadge label={first.exam.examType} tone="neutral" />
                  )}
                  <GenericBadge
                    label={`${results.filter((r) => r.eligible).length}/${results.length} qualifying post(s)`}
                    tone={anyEligible ? "info" : "neutral"}
                  />
                </div>
              </div>

              <div className={styles.examTopActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={handleToggleSave}
                  disabled={savingBookmark}
                >
                  <IconBookmark size={16} filled={isSaved} />
                  {isSaved ? "Saved" : "Save Exam"}
                </button>

                {first.exam.officialWebsite && (
                  <a
                    href={first.exam.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.btn} ${styles.btnBlue}`}
                  >
                    Official Website
                    <IconExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>

            {first.exam.description && (
              <p
                style={{
                  marginTop: 14,
                  fontSize: 14.5,
                  color: "var(--text-secondary)",
                  lineHeight: 1.65,
                }}
              >
                {first.exam.description}
              </p>
            )}
          </section>

          {/* Exam-Level Rules Section */}
          {examLevelRules.length > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>
                    Exam-Level Eligibility Criteria
                  </h2>
                  <p className={styles.cardSubtitle}>
                    Common conditions evaluated across all posts in this examination
                    (including age cutoff dates and category-wise limits).
                  </p>
                </div>
              </div>

              <div className={styles.stackMd}>
                {examLevelRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className={`${styles.postBox} ${
                      rule.satisfied
                        ? styles.postBoxEligible
                        : styles.postBoxIneligible
                    }`}
                  >
                    <div className={styles.postHeader}>
                      <div>
                        <div className={styles.postTitle}>{rule.name}</div>
                        <div className={styles.postMeta}>
                          Field: <code>{rule.conditionField}</code> • Rule:{" "}
                          <code>{rule.expectedValue}</code>
                        </div>
                      </div>
                      <EligibilityBadge eligible={rule.satisfied} />
                    </div>
                    <div className={styles.reasonItem}>
                      <span
                        className={
                          rule.satisfied ? styles.reasonPass : styles.reasonFail
                        }
                        style={{ marginTop: 2 }}
                      >
                        {rule.satisfied ? (
                          <IconCheckCircle size={15} />
                        ) : (
                          <IconXCircle size={15} />
                        )}
                      </span>
                      <span>{cleanReason(rule.reason)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Post-by-Post Breakdown */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  Posts &amp; Post-Level Eligibility ({results.length})
                </h2>
                <p className={styles.cardSubtitle}>
                  Every post group is evaluated independently against both exam-level
                  and post-specific qualification criteria.
                </p>
              </div>
            </div>

            <div className={styles.stackMd}>
              {results.map((item, idx) => {
                const postRules = (item.ruleEvaluations ?? []).filter(
                  (r) => r.scope === "POST",
                );
                const allEvalRules = item.ruleEvaluations ?? [];

                return (
                  <div
                    key={item.post?.id ?? `post-${idx}`}
                    className={`${styles.postBox} ${
                      item.eligible
                        ? styles.postBoxEligible
                        : styles.postBoxIneligible
                    }`}
                  >
                    <div className={styles.postHeader}>
                      <div>
                        <h3 className={styles.postTitle} style={{ fontSize: 16 }}>
                          {item.post ? item.post.name : "General Examination"}
                        </h3>
                        {item.post && (
                          <div className={styles.postMeta} style={{ marginTop: 3 }}>
                            {[
                              item.post.code ? `Code: ${item.post.code}` : null,
                              item.post.department
                                ? `Department: ${item.post.department}`
                                : null,
                              item.post.vacancies
                                ? `Verified Vacancies: ${item.post.vacancies.toLocaleString("en-IN")}`
                                : "Vacancies: Per official notice",
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        )}
                      </div>
                      <EligibilityBadge eligible={item.eligible} />
                    </div>

                    {item.post?.qualification && (
                      <div className={styles.postMeta}>
                        <strong>Official Qualification Requirement:</strong>{" "}
                        {item.post.qualification}
                      </div>
                    )}

                    {item.post?.description && (
                      <div className={styles.postMeta}>{item.post.description}</div>
                    )}

                    <div style={{ marginTop: 6 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "var(--text-muted)",
                          marginBottom: 6,
                        }}
                      >
                        {postRules.length > 0
                          ? "Rule-by-Rule Evaluation"
                          : "Eligibility Reasons"}
                      </div>
                      <ul className={styles.reasonList}>
                        {(allEvalRules.length > 0
                          ? allEvalRules
                          : item.reasons.map((reason) => ({
                              satisfied: item.eligible,
                              reason,
                              scope: "EXAM" as const,
                            }))
                        ).map((entry, rIdx) => (
                          <li key={rIdx} className={styles.reasonItem}>
                            <span
                              className={
                                entry.satisfied
                                  ? styles.reasonPass
                                  : styles.reasonFail
                              }
                              style={{ marginTop: 2, flexShrink: 0 }}
                            >
                              {entry.satisfied ? (
                                <IconCheckCircle size={14} />
                              ) : (
                                <IconXCircle size={14} />
                              )}
                            </span>
                            <span>
                              <strong>[{entry.scope}]</strong>{" "}
                              {cleanReason(entry.reason)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Application Deadlines & Official Notification Sources */}
          <div className={styles.gridTwo}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Application Schedule &amp; Deadlines</h2>
              </div>

              {allDeadlines.length === 0 ? (
                <p className={styles.cardSubtitle}>
                  No application schedule recorded yet.
                </p>
              ) : (
                <div className={styles.stackMd}>
                  {allDeadlines.map((d) => (
                    <div key={d.id} className={styles.postBox}>
                      <div className={styles.postHeader}>
                        <DeadlineStatusBadge status={d.status} />
                        {d.applicationUrl && d.status === "OPEN" && (
                          <a
                            href={d.applicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
                          >
                            Apply Online
                            <IconExternalLink size={13} />
                          </a>
                        )}
                      </div>
                      <div className={styles.deadlineMeta}>
                        {!d.applicationStart && !d.applicationEnd ? (
                          <span style={{ color: "var(--amber-700, #b45309)", fontWeight: 600 }}>
                            ⚠ Application dates not yet announced
                          </span>
                        ) : (
                          <>
                            <span>
                              Start: <strong>{formatDate(d.applicationStart)}</strong>
                            </span>
                            <span>
                              Closing: <strong>{formatDate(d.applicationEnd)}</strong>
                            </span>
                          </>
                        )}
                        {d.examDate && (
                          <span>
                            Exam Date: <strong>{formatDate(d.examDate)}</strong>
                          </span>
                        )}
                      </div>
                      {d.status === "CLOSED" && (
                        <p className={styles.fieldHint}>
                          This application window is closed (historical cycle record).
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                  Official Notification Sources ({allSources.length})
                </h2>
              </div>

              {allSources.length === 0 ? (
                <p className={styles.cardSubtitle}>
                  No official notification PDFs attached yet.
                </p>
              ) : (
                <div className={styles.stackMd}>
                  {allSources.map((src) => (
                    <div key={src.id} className={styles.postBox}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {src.notificationTitle}
                      </div>
                      <div className={styles.postMeta}>
                        {src.organization}
                        {src.notificationIdentifier
                          ? ` • Ref: ${src.notificationIdentifier}`
                          : ""}
                      </div>
                      <div className={styles.postMeta}>
                        Published: {formatDate(src.notificationDate)} • Last verified:{" "}
                        {src.lastVerifiedAt
                          ? formatDate(src.lastVerifiedAt)
                          : "Pending verification"}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <a
                          href={src.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                        >
                          <IconFileText size={14} />
                          Open Official Document
                          <IconExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
