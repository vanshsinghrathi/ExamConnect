"use client";

import Link from "next/link";
import styles from "./ui.module.css";
import {
  DeadlineStatusBadge,
  EligibilityBadge,
  GenericBadge,
} from "./StatusBadge";
import {
  IconBookmark,
  IconCheckCircle,
  IconExternalLink,
  IconFileText,
  IconXCircle,
} from "./Icons";
import { cleanReason, formatDate } from "../lib/api";
import type { GroupedExam } from "../lib/types";

export function ExamCard({
  grouped,
  onToggleSave,
  savingBookmark = false,
}: {
  grouped: GroupedExam;
  onToggleSave?: (examId: number, currentlySaved: boolean) => void;
  savingBookmark?: boolean;
}) {
  const primaryDeadline = grouped.deadlines[0] ?? null;
  const officialNotice = grouped.sources[0] ?? null;

  return (
    <article className={styles.examCard}>
      <div className={styles.examCardTop}>
        <div>
          <div className={styles.examAuthority}>
            {grouped.exam.conductingBody}
          </div>
          <h3 className={styles.examName}>{grouped.exam.name}</h3>

          <div className={styles.examMetaRow}>
            <EligibilityBadge eligible={grouped.eligible} />
            <DeadlineStatusBadge status={grouped.primaryStatus} />
            {grouped.exam.examType && (
              <GenericBadge label={grouped.exam.examType} tone="neutral" />
            )}
            {grouped.posts.length > 1 && (
              <GenericBadge
                label={`${grouped.eligiblePostCount}/${grouped.posts.length} posts eligible`}
                tone={grouped.eligiblePostCount > 0 ? "info" : "neutral"}
              />
            )}
          </div>
        </div>

        <div className={styles.examTopActions}>
          {onToggleSave && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => onToggleSave(grouped.exam.id, grouped.saved)}
              disabled={savingBookmark}
              aria-label={grouped.saved ? "Remove bookmark" : "Bookmark exam"}
              title={grouped.saved ? "Remove bookmark" : "Save exam"}
            >
              <IconBookmark size={15} filled={grouped.saved} />
              <span>{grouped.saved ? "Saved" : "Save"}</span>
            </button>
          )}
          <Link
            href={`/student/exam/${grouped.exam.id}`}
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
          >
            View Details
          </Link>
        </div>
      </div>

      {/* Show ALL posts — both eligible and ineligible — so candidates never miss post-level differences */}
      <div className={styles.postList}>
        {grouped.posts.map((item, idx) => (
          <div
            key={item.post?.id ?? `exam-${item.exam.id}-${idx}`}
            className={`${styles.postBox} ${
              item.eligible ? styles.postBoxEligible : styles.postBoxIneligible
            }`}
          >
            <div className={styles.postHeader}>
              <div>
                <div className={styles.postTitle}>
                  {item.post ? item.post.name : "General Examination Eligibility"}
                </div>
                {item.post && (
                  <div className={styles.postMeta}>
                    {[
                      item.post.department,
                      item.post.vacancies
                        ? `${item.post.vacancies.toLocaleString("en-IN")} verified vacancies`
                        : null,
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
                <strong>Qualification:</strong> {item.post.qualification}
              </div>
            )}

            <ul className={styles.reasonList}>
              {(item.ruleEvaluations && item.ruleEvaluations.length > 0
                ? item.ruleEvaluations
                : item.reasons.map((r) => ({
                    satisfied: item.eligible,
                    reason: cleanReason(r),
                  }))
              ).map((entry, rIdx) => (
                <li key={rIdx} className={styles.reasonItem}>
                  <span
                    className={
                      entry.satisfied ? styles.reasonPass : styles.reasonFail
                    }
                    style={{ marginTop: 2, flexShrink: 0 }}
                  >
                    {entry.satisfied ? (
                      <IconCheckCircle size={14} />
                    ) : (
                      <IconXCircle size={14} />
                    )}
                  </span>
                  <span>{cleanReason(entry.reason)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.examFooter}>
        <div className={styles.deadlineMeta}>
          {primaryDeadline ? (
            <>
              {!primaryDeadline.applicationStart && !primaryDeadline.applicationEnd ? (
                <span style={{ color: "var(--amber-700, #b45309)", fontWeight: 600 }}>
                  ⚠ Application dates not yet announced — status: {grouped.primaryStatus}
                </span>
              ) : (
                <>
                  <span>
                    Start: <strong>{formatDate(primaryDeadline.applicationStart)}</strong>
                  </span>
                  <span>
                    Last Date:{" "}
                    <strong>{formatDate(primaryDeadline.applicationEnd)}</strong>
                  </span>
                </>
              )}
              {primaryDeadline.examDate && (
                <span>
                  Exam Date: <strong>{formatDate(primaryDeadline.examDate)}</strong>
                </span>
              )}
            </>
          ) : (
            <span>Application schedule not announced yet.</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {officialNotice && (
            <a
              href={officialNotice.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            >
              <IconFileText size={14} />
              Official Notice
              <IconExternalLink size={13} />
            </a>
          )}
          {primaryDeadline?.applicationUrl &&
            primaryDeadline.status === "OPEN" && (
              <a
                href={primaryDeadline.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
              >
                Apply Now
                <IconExternalLink size={13} />
              </a>
            )}
        </div>
      </div>
    </article>
  );
}
