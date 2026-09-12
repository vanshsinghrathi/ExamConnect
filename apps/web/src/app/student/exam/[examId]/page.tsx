"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import styles from "./exam.module.css";

type Deadline = {
  id: number;
  applicationUrl: string | null;
  status: string;
  applicationStart: string | null;
  applicationEnd: string | null;
  examDate: string | null;
};

type Source = {
  id: number;
  organization: string;
  notificationTitle: string;
  notificationDate: string | null;
  officialUrl: string;
  notificationIdentifier: string | null;
  dateImported: string;
  lastVerifiedAt: string | null;
};

type ExamResult = {
  exam: {
    id: number;
    name: string;
    conductingBody: string;
    examType: string;
    description: string | null;
    officialWebsite: string | null;
  };
  post: {
    id: number;
    name: string;
    code: string | null;
    department: string | null;
    vacancies: number | null;
    qualification: string | null;
    description: string | null;
  } | null;
  eligible: boolean;
  reasons: string[];
  sources: Source[];
  deadlines: Deadline[];
};

type ApiResponse = {
  results: ExamResult[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function statusClass(
  status: string,
): string {
  switch (status) {
    case "OPEN":
      return styles.statusOpen;

    case "UPCOMING":
      return styles.statusUpcoming;

    case "CLOSED":
      return styles.statusClosed;

    default:
      return styles.statusUnknown;
  }
}

function cleanReason(
  reason: string,
): string {
  return reason
    .replace(
      /^Requirement satisfied:\s*/i,
      "",
    )
    .replace(
      /^Requirement failed:\s*/i,
      "",
    )
    .replace(
      /^Requirement not satisfied:\s*/i,
      "",
    )
    .trim();
}

export default function ExamDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const examId = Number(
    params.examId,
  );

  const [results, setResults] =
    useState<ExamResult[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function loadExamDetails() {
      try {
        setLoading(true);
        setError(null);

        if (
          !Number.isInteger(examId) ||
          examId <= 0
        ) {
          throw new Error(
            "Invalid exam ID.",
          );
        }

        const response = await fetch(
          `${API_URL}/student/eligible-exams`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        if (response.status === 401) {
          router.push("/");
          return;
        }

        if (!response.ok) {
          throw new Error(
            `API request failed with status ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as ApiResponse;

        const examResults =
          (data.results ?? []).filter(
            (result) =>
              result.exam.id === examId,
          );

        if (
          examResults.length === 0
        ) {
          throw new Error(
            "Exam details could not be found.",
          );
        }

        setResults(examResults);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load exam details.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadExamDetails();
  }, [examId, router]);

  const exam = results[0]?.exam;

  const eligiblePosts = useMemo(
    () =>
      results.filter(
        (result) =>
          result.post !== null &&
          result.eligible,
      ),
    [results],
  );

  const ineligiblePosts = useMemo(
    () =>
      results.filter(
        (result) =>
          result.post !== null &&
          !result.eligible,
      ),
    [results],
  );

  const allDeadlines = useMemo(
    () => {
      const deadlines: Array<
        Deadline & {
          postName: string;
        }
      > = [];

      for (const result of results) {
        for (const deadline of result.deadlines) {
          deadlines.push({
            ...deadline,
            postName:
              result.post?.name ??
              "Exam Level",
          });
        }
      }

      return Array.from(
        new Map(
          deadlines.map(
            (deadline) => [
              `${deadline.id}-${deadline.postName}`,
              deadline,
            ],
          ),
        ).values(),
      );
    },
    [results],
  );

  const sources = useMemo(
    () => {
      return Array.from(
        new Map(
          results
            .flatMap(
              (result) =>
                result.sources,
            )
            .map((source) => [
              source.id,
              source,
            ]),
        ).values(),
      );
    },
    [results],
  );

  if (loading) {
    return (
      <main
        className={styles.page}
      >
        <section
          className={styles.loadingCard}
        >
          Loading exam details...
        </section>
      </main>
    );
  }

  if (error || !exam) {
    return (
      <main
        className={styles.page}
      >
        <section
          className={styles.errorCard}
        >
          <button
            type="button"
            className={styles.backButton}
            onClick={() =>
              router.push("/")
            }
          >
            ← Dashboard
          </button>

          <h1>
            Unable to load exam
          </h1>

          <p>
            {error ??
              "Exam details could not be found."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header
        className={styles.header}
      >
        <button
          type="button"
          className={styles.backButton}
          onClick={() =>
            router.push("/")
          }
        >
          ← Dashboard
        </button>

        <p className={styles.eyebrow}>
          EXAMCONNECT
        </p>

        <h1>
          {exam.name}
        </h1>

        <p
          className={
            styles.organization
          }
        >
          {exam.conductingBody}
        </p>

        <div
          className={styles.headerMeta}
        >
          <span>
            {exam.examType}
          </span>

          <span>
            {eligiblePosts.length} eligible
            post
            {eligiblePosts.length !== 1
              ? "s"
              : ""}
          </span>
        </div>
      </header>

      <section
        className={styles.infoGrid}
      >
        <article
          className={styles.infoCard}
        >
          <span
            className={styles.label}
          >
            Conducting Body
          </span>

          <strong>
            {exam.conductingBody}
          </strong>
        </article>

        <article
          className={styles.infoCard}
        >
          <span
            className={styles.label}
          >
            Exam Type
          </span>

          <strong>
            {exam.examType}
          </strong>
        </article>

        <article
          className={styles.infoCard}
        >
          <span
            className={styles.label}
          >
            Eligible Posts
          </span>

          <strong>
            {eligiblePosts.length}
          </strong>
        </article>

        <article
          className={styles.infoCard}
        >
          <span
            className={styles.label}
          >
            Total Posts
          </span>

          <strong>
            {
              results.filter(
                (result) =>
                  result.post !== null,
              ).length
            }
          </strong>
        </article>
      </section>

      {exam.description && (
        <section
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeader
            }
          >
            <p
              className={styles.eyebrow}
            >
              ABOUT THE EXAM
            </p>

            <h2>
              Exam Description
            </h2>
          </div>

          <div
            className={styles.textCard}
          >
            <p>
              {exam.description}
            </p>
          </div>
        </section>
      )}

      <section
        className={styles.section}
      >
        <div
          className={
            styles.sectionHeader
          }
        >
          <div>
            <p
              className={styles.eyebrow}
            >
              ELIGIBILITY
            </p>

            <h2>
              Eligible Posts
            </h2>
          </div>

          <span
            className={
              styles.countBadge
            }
          >
            {eligiblePosts.length}
          </span>
        </div>

        {eligiblePosts.length ===
        0 ? (
          <div
            className={
              styles.emptyCard
            }
          >
            No eligible posts found
            for this exam.
          </div>
        ) : (
          <div
            className={
              styles.postGrid
            }
          >
            {eligiblePosts.map(
              (result) => {
                const post =
                  result.post!;

                return (
                  <article
                    key={post.id}
                    className={
                      styles.postCard
                    }
                  >
                    <div
                      className={
                        styles.postHeader
                      }
                    >
                      <div>
                        <span
                          className={
                            styles.eligibleBadge
                          }
                        >
                          ✓ Eligible
                        </span>

                        <h3>
                          {post.name}
                        </h3>
                      </div>

                      {post.code && (
                        <span
                          className={
                            styles.postCode
                          }
                        >
                          {post.code}
                        </span>
                      )}
                    </div>

                    <div
                      className={
                        styles.detailGrid
                      }
                    >
                      <div>
                        <span
                          className={
                            styles.label
                          }
                        >
                          Department
                        </span>

                        <p>
                          {post.department ??
                            "Not available"}
                        </p>
                      </div>

                      <div>
                        <span
                          className={
                            styles.label
                          }
                        >
                          Vacancies
                        </span>

                        <p>
                          {post.vacancies ??
                            "Not available"}
                        </p>
                      </div>

                      <div
                        className={
                          styles.fullWidth
                        }
                      >
                        <span
                          className={
                            styles.label
                          }
                        >
                          Required Qualification
                        </span>

                        <p>
                          {post.qualification ??
                            "Not available"}
                        </p>
                      </div>
                    </div>

                    {post.description && (
                      <div
                        className={
                          styles.descriptionBox
                        }
                      >
                        <span
                          className={
                            styles.label
                          }
                        >
                          Post Description
                        </span>

                        <p>
                          {post.description}
                        </p>
                      </div>
                    )}

                    <div
                      className={
                        styles.reasonsBox
                      }
                    >
                      <span
                        className={
                          styles.label
                        }
                      >
                        Why you qualify
                      </span>

                      {result.reasons.map(
                        (
                          reason,
                          index,
                        ) => (
                          <p
                            key={`${reason}-${index}`}
                            className={
                              styles.reason
                            }
                          >
                            ✓{" "}
                            {cleanReason(
                              reason,
                            )}
                          </p>
                        ),
                      )}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      {ineligiblePosts.length >
        0 && (
        <section
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <p
                className={
                  styles.eyebrow
                }
              >
                OTHER POSTS
              </p>

              <h2>
                Posts you do not
                qualify for
              </h2>
            </div>

            <span
              className={
                styles.countBadge
              }
            >
              {ineligiblePosts.length}
            </span>
          </div>

          <div
            className={
              styles.ineligibleList
            }
          >
            {ineligiblePosts.map(
              (result) => {
                const post =
                  result.post!;

                return (
                  <article
                    key={post.id}
                    className={
                      styles.ineligibleCard
                    }
                  >
                    <div>
                      <div
                        className={
                          styles.postHeader
                        }
                      >
                        <div>
                          <span
                            className={
                              styles.notEligibleBadge
                            }
                          >
                            ✕ Not Eligible
                          </span>

                          <h3>
                            {post.name}
                          </h3>
                        </div>

                        {post.code && (
                          <span
                            className={
                              styles.postCode
                            }
                          >
                            {post.code}
                          </span>
                        )}
                      </div>

                      {post.department && (
                        <p>
                          {post.department}
                        </p>
                      )}

                      {post.vacancies !==
                        null && (
                        <p>
                          Vacancies:{" "}
                          <strong>
                            {
                              post.vacancies
                            }
                          </strong>
                        </p>
                      )}

                      {post.qualification && (
                        <div
                          className={
                            styles.descriptionBox
                          }
                        >
                          <span
                            className={
                              styles.label
                            }
                          >
                            Required Qualification
                          </span>

                          <p>
                            {
                              post.qualification
                            }
                          </p>
                        </div>
                      )}

                      <div
                        className={
                          styles.reasonsBox
                        }
                      >
                        <span
                          className={
                            styles.label
                          }
                        >
                          Why you are not eligible
                        </span>

                        {result.reasons.length >
                        0 ? (
                          result.reasons.map(
                            (
                              reason,
                              index,
                            ) => (
                              <p
                                key={`${reason}-${index}`}
                                className={
                                  styles.reason
                                }
                              >
                                ✕{" "}
                                {cleanReason(
                                  reason,
                                )}
                              </p>
                            ),
                          )
                        ) : (
                          <p
                            className={
                              styles.reason
                            }
                          >
                            ✕ You do not meet
                            the eligibility
                            requirements for
                            this post.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </section>
      )}

      {allDeadlines.length >
        0 && (
        <section
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <p
                className={
                  styles.eyebrow
                }
              >
                IMPORTANT DATES
              </p>

              <h2>
                Applications & Exam
                Dates
              </h2>
            </div>
          </div>

          <div
            className={
              styles.deadlineList
            }
          >
            {allDeadlines.map(
              (deadline) => (
                <article
                  key={`${deadline.id}-${deadline.postName}`}
                  className={
                    styles.deadlineCard
                  }
                >
                  <div>
                    <span
                      className={`${styles.statusBadge} ${statusClass(
                        deadline.status,
                      )}`}
                    >
                      {deadline.status}
                    </span>

                    <h3>
                      {
                        deadline.postName
                      }
                    </h3>

                    <p>
                      Application Start:{" "}
                      <strong>
                        {formatDate(
                          deadline.applicationStart,
                        )}
                      </strong>
                    </p>

                    <p>
                      Last Date:{" "}
                      <strong>
                        {formatDate(
                          deadline.applicationEnd,
                        )}
                      </strong>
                    </p>

                    <p>
                      Exam Date:{" "}
                      <strong>
                        {formatDate(
                          deadline.examDate,
                        )}
                      </strong>
                    </p>
                  </div>

                  {deadline.applicationUrl && (
                    <a
                      href={
                        deadline.applicationUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        styles.applyButton
                      }
                    >
                      Apply Officially →
                    </a>
                  )}
                </article>
              ),
            )}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section
          className={styles.section}
        >
          <div
            className={
              styles.sectionHeader
            }
          >
            <div>
              <p
                className={
                  styles.eyebrow
                }
              >
                VERIFIED SOURCE
              </p>

              <h2>
                Official Notifications
              </h2>
            </div>
          </div>

          <div
            className={
              styles.sourceList
            }
          >
            {sources.map(
              (source) => (
                <article
                  key={source.id}
                  className={
                    styles.sourceCard
                  }
                >
                  <div>
                    <h3>
                      {
                        source
                          .notificationTitle
                      }
                    </h3>

                    <p>
                      {
                        source.organization
                      }
                    </p>

                    {source.notificationDate && (
                      <p>
                        Notification Date:{" "}
                        <strong>
                          {formatDate(
                            source.notificationDate,
                          )}
                        </strong>
                      </p>
                    )}
                  </div>

                  <a
                    href={
                      source.officialUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      styles.sourceButton
                    }
                  >
                    View Official Source →
                  </a>
                </article>
              ),
            )}
          </div>
        </section>
      )}

      <section
        className={
          styles.bottomAction
        }
      >
        <button
          type="button"
          className={styles.backButton}
          onClick={() =>
            router.push("/")
          }
        >
          ← Back to Dashboard
        </button>

        {exam.officialWebsite && (
          <a
            href={
              exam.officialWebsite
            }
            target="_blank"
            rel="noopener noreferrer"
            className={
              styles.applyButton
            }
          >
            Visit Official Website →
          </a>
        )}
      </section>
    </main>
  );
}