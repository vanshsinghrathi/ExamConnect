"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

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

type LoggedInUser = {
  id: number;
  email: string;
  role: string;
};

type GroupedExam = {
  exam: ExamResult["exam"];
  posts: ExamResult[];
  eligible: boolean;
  openApplications: number;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status: string): string {
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

function groupExamResults(
  results: ExamResult[],
): GroupedExam[] {
  const groups = new Map<number, GroupedExam>();

  for (const result of results) {
    const existing = groups.get(result.exam.id);

    if (!existing) {
      groups.set(result.exam.id, {
        exam: result.exam,
        posts: [result],
        eligible: result.eligible,
        openApplications:
          result.deadlines.filter(
            (deadline) => deadline.status === "OPEN",
          ).length,
      });

      continue;
    }

    existing.posts.push(result);

    if (result.eligible) {
      existing.eligible = true;
    }

    existing.openApplications +=
      result.deadlines.filter(
        (deadline) => deadline.status === "OPEN",
      ).length;
  }

  return Array.from(groups.values());
}

function getUniqueSources(
  posts: ExamResult[],
): Source[] {
  const sources = posts.flatMap(
    (result) => result.sources ?? [],
  );

  return Array.from(
    new Map(
      sources.map((source) => [
        source.id,
        source,
      ]),
    ).values(),
  );
}

function cleanReason(reason: string): string {
  return reason.replace(
    /^Requirement (?:not )?satisfied:\s*/i,
    "",
  );
}

export default function Home() {
  const router = useRouter();

  const [user, setUser] =
    useState<LoggedInUser | null>(null);

  const [email, setEmail] = useState(
    "eligibility-test@example.com",
  );

  const [password, setPassword] = useState(
    "EligibilityTest123!",
  );

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [loginError, setLoginError] =
    useState<string | null>(null);

  const [results, setResults] =
    useState<ExamResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function loadEligibleExams() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/student/eligible-exams`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        setUser(null);
        setResults([]);
        return;
      }

      if (!response.ok) {
        throw new Error(
          `API request failed with status ${response.status}.`,
        );
      }

      const data =
        (await response.json()) as ApiResponse;

      const presentationResults =
        (data.results ?? []).filter(
          (result) =>
            !result.exam.name
              .trim()
              .toLowerCase()
              .includes(
                "examconnect notification test exam",
              ),
        );

      setResults(presentationResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load eligible exams.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(
          `${API_URL}/auth/me`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data =
          (await response.json()) as {
            user: LoggedInUser;
          };

        setUser(data.user);

        await loadEligibleExams();
      } catch {
        setUser(null);
      }
    }

    void checkSession();
  }, []);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setLoginLoading(true);
      setLoginError(null);

      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const data =
        (await response.json()) as {
          user?: LoggedInUser;
          message?: string;
        };

      if (!response.ok || !data.user) {
        throw new Error(
          data.message ??
            "Invalid email or password.",
        );
      }

      setUser(data.user);

      await loadEligibleExams();
    } catch (loginRequestError) {
      setLoginError(
        loginRequestError instanceof Error
          ? loginRequestError.message
          : "Unable to log in.",
      );
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        },
      );
    } finally {
      setUser(null);
      setResults([]);
    }
  }

  if (!user) {
    return (
      <main className={styles.authPage}>
        <section className={styles.loginCard}>
          <div className={styles.loginBrand}>
            EXAMCONNECT
          </div>

          <p className={styles.loginEyebrow}>
            STUDENT PORTAL
          </p>

          <h1>
            Find the exams made for you.
          </h1>

          <p className={styles.loginSubtitle}>
            Sign in to check government
            exams you are eligible for,
            application deadlines, and
            official application links.
          </p>

          <form
            className={styles.loginForm}
            onSubmit={handleLogin}
          >
            <label>
              Email

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError && (
              <div className={styles.loginError}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className={styles.loginButton}
              disabled={loginLoading}
            >
              {loginLoading
                ? "Signing in..."
                : "Sign In"}
            </button>
          </form>

          <p className={styles.demoText}>
            Development test account is pre-filled.
          </p>
        </section>
      </main>
    );
  }

  const groupedExams =
    groupExamResults(results);

  const eligibleExams =
    groupedExams.filter(
      (exam) => exam.eligible,
    );

  const ineligibleExams =
    groupedExams.filter(
      (exam) => !exam.eligible,
    );

  const openExams = groupedExams.filter(
    (exam) => exam.openApplications > 0,
  ).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>
            EXAMCONNECT
          </p>

          <h1>
            Government Exam Dashboard
          </h1>

          <p className={styles.subtitle}>
            Find government exams you
            are eligible for, track
            deadlines, and apply through
            official sources.
          </p>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.userEmail}>
            {user.email}
          </span>

          <button
            type="button"
            className={styles.profileButton}
            onClick={() =>
              router.push("/student/profile")
            }
          >
            Profile
          </button>

          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            Total Exams
          </span>

          <strong>
            {groupedExams.length}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            Eligible Exams
          </span>

          <strong>
            {eligibleExams.length}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            Open Exams
          </span>

          <strong>
            {openExams}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            Not Eligible
          </span>

          <strong>
            {ineligibleExams.length}
          </strong>
        </div>
      </section>

      {loading && (
        <section className={styles.messageCard}>
          <div className={styles.spinner} />

          <p>
            Checking your eligibility...
          </p>
        </section>
      )}

      {error && !loading && (
        <section className={styles.errorCard}>
          <h2>
            Unable to load dashboard
          </h2>

          <p>{error}</p>

          <button
            type="button"
            className={styles.retryButton}
            onClick={loadEligibleExams}
          >
            Try Again
          </button>
        </section>
      )}

      {!loading && !error && (
        <>
          <section className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>
                Your Results
              </p>

              <h2>
                Eligible Government Exams
              </h2>
            </div>

            <span className={styles.resultCount}>
              {eligibleExams.length} result
              {eligibleExams.length !== 1 ? "s" : ""}
            </span>
          </section>

          {eligibleExams.length === 0 && (
            <section className={styles.emptyCard}>
              <div className={styles.emptyIcon}>
                !
              </div>

              <h3>
                No eligible exams found
              </h3>

              <p>
                Update your student profile and
                education details to check again.
              </p>
            </section>
          )}

          <section className={styles.examGrid}>
            {eligibleExams.map((group) => {
              const sources = getUniqueSources(
                group.posts,
              );

              return (
                <article
                  key={group.exam.id}
                  className={styles.examCard}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.eligibleBadge}>
                      ✓ Eligible
                    </span>

                    <span className={styles.examType}>
                      {group.exam.examType}
                    </span>
                  </div>

                  <h3>
                    {group.exam.name}
                  </h3>

                  <p className={styles.organization}>
                    {group.exam.conductingBody}
                  </p>

                  {group.exam.description && (
                    <p
                      style={{
                        color: "#697386",
                        fontSize: "13px",
                        lineHeight: 1.6,
                        marginTop: "10px",
                      }}
                    >
                      {group.exam.description}
                    </p>
                  )}

                  <div className={styles.postBox}>
                    <span className={styles.fieldLabel}>
                      Posts & Qualification
                    </span>

                    {group.posts.map((result) => (
                      <div
                        key={
                          result.post?.id ??
                          result.exam.id
                        }
                        className={styles.postRow}
                        style={{
                          alignItems: "flex-start",
                          marginTop: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <span
                          aria-label={
                            result.eligible
                              ? "Eligible"
                              : "Not eligible"
                          }
                          style={{
                            color: result.eligible
                              ? "#237a46"
                              : "#b34444",
                            fontWeight: 700,
                          }}
                        >
                          {result.eligible ? "✓" : "✕"}
                        </span>

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <strong>
                            {result.post?.name ??
                              "Exam Level Eligibility"}
                          </strong>

                          {result.post?.department && (
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#697386",
                                marginTop: "4px",
                              }}
                            >
                              Department: {result.post.department}
                            </p>
                          )}

                          {result.post?.qualification && (
                            <p
                              style={{
                                fontSize: "12px",
                                lineHeight: 1.6,
                                color: "#697386",
                                marginTop: "5px",
                                overflowWrap: "anywhere",
                              }}
                            >
                              Qualification:{" "}
                              {result.post.qualification}
                            </p>
                          )}

                          {result.post?.vacancies != null && (
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#697386",
                                marginTop: "5px",
                              }}
                            >
                              Vacancies: {result.post.vacancies}
                            </p>
                          )}

                          <span
                            className={`${styles.statusBadge} ${
                              result.eligible
                                ? styles.statusOpen
                                : styles.statusClosed
                            }`}
                            style={{
                              marginTop: "7px",
                            }}
                          >
                            {result.eligible
                              ? "ELIGIBLE"
                              : "NOT ELIGIBLE"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.reasons}>
                    <span className={styles.fieldLabel}>
                      Eligibility by Post
                    </span>

                    {group.posts.map((result) => (
                      <div
                        key={`reasons-${
                          result.post?.id ??
                          result.exam.id
                        }`}
                        style={{
                          paddingTop: "10px",
                          paddingBottom: "10px",
                          borderBottom: "1px solid #edf0f5",
                        }}
                      >
                        <p
                          style={{
                            color: "#253047",
                            fontSize: "13px",
                            fontWeight: 700,
                            lineHeight: 1.5,
                            marginBottom: "8px",
                          }}
                        >
                          {result.post?.name ??
                            "Exam Level Eligibility"}
                          {" — "}
                          {result.eligible
                            ? "Eligible"
                            : "Not Eligible"}
                        </p>

                        {result.reasons.length > 0 ? (
                          result.reasons.map(
                            (reason, index) => (
                              <p
                                key={`${
                                  result.post?.id ??
                                  result.exam.id
                                }-${index}`}
                                className={
                                  result.eligible
                                    ? styles.reasonPassed
                                    : styles.reasonFailed
                                }
                                style={{
                                  fontSize: "13px",
                                  lineHeight: 1.6,
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {result.eligible
                                  ? "✓ "
                                  : "✕ "}
                                {cleanReason(reason)}
                              </p>
                            ),
                          )
                        ) : (
                          <p
                            className={
                              result.eligible
                                ? styles.reasonPassed
                                : styles.reasonFailed
                            }
                          >
                            {result.eligible
                              ? "Eligibility requirements satisfied."
                              : "The eligibility requirements were not satisfied."}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {group.posts.some(
                    (result) =>
                      result.eligible &&
                      result.deadlines.length > 0,
                  ) && (
                    <div className={styles.deadlineBox}>
                      <span className={styles.fieldLabel}>
                        Application
                      </span>

                      {group.posts
                        .filter(
                          (result) =>
                            result.eligible &&
                            result.deadlines.length > 0,
                        )
                        .flatMap((result) =>
                          result.deadlines.map(
                            (deadline) => ({
                              ...deadline,
                              postName:
                                result.post?.name ??
                                "Exam Level",
                            }),
                          ),
                        )
                        .map(
                          (
                            deadline,
                            deadlineIndex,
                          ) => (
                            <div
                              key={`${deadline.id}-${deadline.postName}-${deadlineIndex}`}
                              className={styles.deadlineItem}
                            >
                              <div>
                                <span
                                  className={`${styles.statusBadge} ${statusClass(
                                    deadline.status,
                                  )}`}
                                >
                                  {deadline.status}
                                </span>

                                <p className={styles.deadlinePost}>
                                  {deadline.postName}
                                </p>

                                <p>
                                  Last Date:{" "}
                                  <strong>
                                    {formatDate(
                                      deadline.applicationEnd,
                                    )}
                                  </strong>
                                </p>

                                {deadline.applicationStart && (
                                  <p>
                                    Start Date:{" "}
                                    <strong>
                                      {formatDate(
                                        deadline.applicationStart,
                                      )}
                                    </strong>
                                  </p>
                                )}

                                {deadline.examDate && (
                                  <p>
                                    Exam Date:{" "}
                                    <strong>
                                      {formatDate(
                                        deadline.examDate,
                                      )}
                                    </strong>
                                  </p>
                                )}
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
                            </div>
                          ),
                        )}
                    </div>
                  )}

                  {(sources.length > 0 ||
                    group.exam.officialWebsite) && (
                    <div className={styles.sourceBox}>
                      <span className={styles.fieldLabel}>
                        Official Source
                      </span>

                      {sources.length > 0 ? (
                        sources.map((source) => (
                          <div
                            key={source.id}
                            style={{
                              marginTop: "8px",
                              marginBottom: "12px",
                            }}
                          >
                            <p>
                              {source.organization}
                            </p>

                            <p>
                              {source.notificationTitle}
                            </p>

                            {source.notificationDate && (
                              <p
                                style={{
                                  color: "#697386",
                                  fontSize: "12px",
                                }}
                              >
                                Notification Date:{" "}
                                {formatDate(
                                  source.notificationDate,
                                )}
                              </p>
                            )}

                            <a
                              href={source.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View official notification →
                            </a>
                          </div>
                        ))
                      ) : (
                        <div>
                          <p>
                            {group.exam.conductingBody}
                          </p>

                          {group.exam.officialWebsite && (
                            <a
                              href={
                                group.exam.officialWebsite
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Visit official website →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.detailsAction}>
                    <button
                      type="button"
                      className={styles.detailsButton}
                      onClick={() =>
                        router.push(
                          `/student/exam/${group.exam.id}`,
                        )
                      }
                    >
                      View Details →
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {ineligibleExams.length > 0 && (
            <>
              <section className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>
                    Eligibility Review
                  </p>

                  <h2>
                    Other Government Exams
                  </h2>
                </div>

                <span className={styles.resultCount}>
                  {ineligibleExams.length} result
                  {ineligibleExams.length !== 1 ? "s" : ""}
                </span>
              </section>

              <section className={styles.examGrid}>
                {ineligibleExams.map((group) => {
                  const sources = getUniqueSources(
                    group.posts,
                  );

                  return (
                    <article
                      key={group.exam.id}
                      className={styles.examCard}
                    >
                      <div className={styles.cardTop}>
                        <span
                          className={`${styles.statusBadge} ${styles.statusClosed}`}
                        >
                          Not Eligible
                        </span>

                        <span className={styles.examType}>
                          {group.exam.examType}
                        </span>
                      </div>

                      <h3>{group.exam.name}</h3>

                      <p className={styles.organization}>
                        {group.exam.conductingBody}
                      </p>

                      <div className={styles.postBox}>
                        <span className={styles.fieldLabel}>
                          Posts & Qualification
                        </span>

                        {group.posts.map((result) => (
                          <div
                            key={
                              result.post?.id ??
                              result.exam.id
                            }
                            className={styles.postRow}
                            style={{
                              alignItems: "flex-start",
                              marginTop: "12px",
                              marginBottom: "12px",
                            }}
                          >
                            <span
                              style={{
                                color: "#b34444",
                                fontWeight: 700,
                              }}
                            >
                              ✕
                            </span>

                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <strong>
                                {result.post?.name ??
                                  "Exam Level Eligibility"}
                              </strong>

                              {result.post?.qualification && (
                                <p
                                  style={{
                                    fontSize: "12px",
                                    lineHeight: 1.6,
                                    color: "#697386",
                                    marginTop: "5px",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  Qualification:{" "}
                                  {result.post.qualification}
                                </p>
                              )}

                              <span
                                className={`${styles.statusBadge} ${styles.statusClosed}`}
                                style={{
                                  marginTop: "7px",
                                }}
                              >
                                NOT ELIGIBLE
                              </span>

                              {result.reasons.map(
                                (reason, index) => (
                                  <p
                                    key={`${
                                      result.post?.id ??
                                      result.exam.id
                                    }-${index}`}
                                    className={
                                      styles.reasonFailed
                                    }
                                    style={{
                                      fontSize: "13px",
                                      lineHeight: 1.6,
                                      marginTop: "7px",
                                    }}
                                  >
                                    {cleanReason(reason)}
                                  </p>
                                ),
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {(sources.length > 0 ||
                        group.exam.officialWebsite) && (
                        <div className={styles.sourceBox}>
                          <span className={styles.fieldLabel}>
                            Official Source
                          </span>

                          {sources.length > 0 ? (
                            sources.map((source) => (
                              <div key={source.id}>
                                <p>
                                  {source.organization}
                                </p>

                                <p>
                                  {source.notificationTitle}
                                </p>

                                <a
                                  href={source.officialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  View official notification →
                                </a>
                              </div>
                            ))
                          ) : (
                            group.exam.officialWebsite && (
                              <a
                                href={
                                  group.exam.officialWebsite
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Visit official website →
                              </a>
                            )
                          )}
                        </div>
                      )}

                      <div className={styles.detailsAction}>
                        <button
                          type="button"
                          className={styles.detailsButton}
                          onClick={() =>
                            router.push(
                              `/student/exam/${group.exam.id}`,
                            )
                          }
                        >
                          View Details →
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}