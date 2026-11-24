"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../../../../components/ui.module.css";
import { AdminGuardShell } from "../../../../components/AdminGuardShell";
import { ConfirmDialog } from "../../../../components/ConfirmDialog";
import {
  AlertBanner,
  LoadingSkeleton,
} from "../../../../components/FeedbackStates";
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
} from "../../../../components/Icons";
import {
  DeadlineStatusBadge,
  GenericBadge,
} from "../../../../components/StatusBadge";
import { apiFetch, formatDate } from "../../../../lib/api";

type AdminExamDetail = {
  exam: {
    id: number;
    name: string;
    conductingBody: string;
    examType: string | null;
    description: string | null;
    officialWebsite: string | null;
    isArchived: boolean;
  };
  posts: Array<{
    id: number;
    name: string;
    code: string | null;
    department: string | null;
    vacancies: number | null;
    qualification: string | null;
    description: string | null;
  }>;
  rules: Array<{
    id: number;
    postId: number | null;
    ruleType: string;
    name: string;
    description: string | null;
    versions: Array<{
      id: number;
      versionNumber: number;
      status: string;
      conditionField: string;
      operator: string;
      expectedValue: string;
      logicGroup: string | null;
      logicOperator: string;
      notificationSourceId: number | null;
      effectiveFrom: string | null;
      effectiveTo: string | null;
    }>;
  }>;
  deadlines: Array<{
    id: number;
    postId: number | null;
    applicationUrl: string | null;
    status: string;
    computedStatus: string;
    applicationStart: string | null;
    applicationEnd: string | null;
    examDate: string | null;
  }>;
  sources: Array<{
    id: number;
    organization: string;
    notificationTitle: string;
    officialUrl: string;
    lastVerifiedAt: string | null;
  }>;
};

function AdminExamEditorContent() {
  const params = useParams();
  const examId = Number(params.examId);

  const [detail, setDetail] = useState<AdminExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  // Edit exam fields
  const [examName, setExamName] = useState("");
  const [examOrg, setExamOrg] = useState("");
  const [examType, setExamType] = useState("");
  const [examWebsite, setExamWebsite] = useState("");
  const [examDesc, setExamDesc] = useState("");
  const [savingExam, setSavingExam] = useState(false);

  // Add post fields
  const [postName, setPostName] = useState("");
  const [postCode, setPostCode] = useState("");
  const [postDept, setPostDept] = useState("");
  const [postVacancies, setPostVacancies] = useState("");
  const [postQual, setPostQual] = useState("");
  const [savingPost, setSavingPost] = useState(false);
  const [deletePostTarget, setDeletePostTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Add rule fields
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("AGE");
  const [rulePostId, setRulePostId] = useState("");
  const [ruleField, setRuleField] = useState("ageByCategory");
  const [ruleOp, setRuleOp] = useState("BETWEEN");
  const [ruleExpected, setRuleExpected] = useState(
    "general:18-27,obc:18-30,sc:18-32,st:18-32,ews:18-27|2026-08-01",
  );
  const [ruleLogicGroup, setRuleLogicGroup] = useState("");
  const [ruleLogicOp, setRuleLogicOp] = useState<"AND" | "OR">("AND");
  const [ruleSourceId, setRuleSourceId] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  // Add deadline fields
  const [dlPostId, setDlPostId] = useState("");
  const [dlStatus, setDlStatus] = useState("OPEN");
  const [dlUrl, setDlUrl] = useState("");
  const [dlStart, setDlStart] = useState("");
  const [dlEnd, setDlEnd] = useState("");
  const [dlExamDate, setDlExamDate] = useState("");
  const [savingDl, setSavingDl] = useState(false);
  const [deleteDlTarget, setDeleteDlTarget] = useState<number | null>(null);

  // Edit existing deadline fields
  const [editingDlId, setEditingDlId] = useState<number | null>(null);
  const [editDlStart, setEditDlStart] = useState("");
  const [editDlEnd, setEditDlEnd] = useState("");
  const [editDlExamDate, setEditDlExamDate] = useState("");
  const [editDlUrl, setEditDlUrl] = useState("");
  const [savingEditDl, setSavingEditDl] = useState(false);

  async function loadDetail() {
    try {
      setLoading(true);
      const data = await apiFetch<AdminExamDetail>(`/admin/exams/${examId}`);
      setDetail(data);
      setExamName(data.exam.name);
      setExamOrg(data.exam.conductingBody);
      setExamType(data.exam.examType ?? "");
      setExamWebsite(data.exam.officialWebsite ?? "");
      setExamDesc(data.exam.description ?? "");
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to load exam details.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isInteger(examId) && examId > 0) {
      void loadDetail();
    }
  }, [examId]);

  async function handleUpdateExam(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      setSavingExam(true);
      await apiFetch(`/admin/exams/${examId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: examName.trim(),
          conductingBody: examOrg.trim(),
          examType: examType.trim() || null,
          officialWebsite: examWebsite.trim() || null,
          description: examDesc.trim() || null,
        }),
      });
      setFeedback({ tone: "success", text: "Examination details saved." });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to save exam.",
      });
    } finally {
      setSavingExam(false);
    }
  }

  async function handleAddPost(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      setSavingPost(true);
      await apiFetch(`/admin/exams/${examId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          name: postName.trim(),
          code: postCode.trim() || undefined,
          department: postDept.trim() || undefined,
          vacancies: postVacancies.trim() ? Number(postVacancies) : undefined,
          qualification: postQual.trim() || undefined,
        }),
      });
      setPostName("");
      setPostCode("");
      setPostDept("");
      setPostVacancies("");
      setPostQual("");
      setFeedback({ tone: "success", text: "Post added to examination." });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to add post.",
      });
    } finally {
      setSavingPost(false);
    }
  }

  async function confirmDeletePost() {
    if (!deletePostTarget) return;
    try {
      await apiFetch(`/admin/posts/${deletePostTarget.id}`, {
        method: "DELETE",
      });
      setDeletePostTarget(null);
      setFeedback({ tone: "success", text: "Post removed." });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to delete post.",
      });
    }
  }

  async function handleAddRule(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      setSavingRule(true);
      await apiFetch(`/admin/exams/${examId}/eligibility-rules`, {
        method: "POST",
        body: JSON.stringify({
          postId: rulePostId ? Number(rulePostId) : undefined,
          notificationSourceId: ruleSourceId ? Number(ruleSourceId) : undefined,
          ruleType,
          name: ruleName.trim(),
          conditionField: ruleField,
          operator: ruleOp,
          expectedValue: ruleExpected.trim(),
          logicGroup: ruleLogicGroup.trim() || undefined,
          logicOperator: ruleLogicOp,
        }),
      });
      setRuleName("");
      setRuleLogicGroup("");
      setFeedback({
        tone: "success",
        text: "Eligibility rule created and activated.",
      });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to add rule.",
      });
    } finally {
      setSavingRule(false);
    }
  }

  async function handleToggleVersionStatus(versionId: number, currentStatus: string) {
    try {
      const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await apiFetch(`/admin/eligibility-rule-versions/${versionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setFeedback({
        tone: "success",
        text: `Rule version #${versionId} marked ${nextStatus}.`,
      });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to update rule version.",
      });
    }
  }

  async function handleAttachSource(versionId: number, sourceId: number) {
    if (!sourceId) return;
    try {
      await apiFetch(`/admin/eligibility-rule-versions/${versionId}/source`, {
        method: "PATCH",
        body: JSON.stringify({ notificationSourceId: sourceId }),
      });
      setFeedback({
        tone: "success",
        text: "Official notification source attached to rule version.",
      });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to attach source.",
      });
    }
  }

  async function handleAddDeadline(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      setSavingDl(true);
      await apiFetch(`/admin/exams/${examId}/deadlines`, {
        method: "POST",
        body: JSON.stringify({
          postId: dlPostId ? Number(dlPostId) : undefined,
          status: dlStatus,
          applicationUrl: dlUrl.trim() || undefined,
          applicationStart: dlStart ? `${dlStart}T00:00:00.000Z` : undefined,
          applicationEnd: dlEnd ? `${dlEnd}T18:29:59.000Z` : undefined,
          examDate: dlExamDate ? `${dlExamDate}T00:00:00.000Z` : undefined,
        }),
      });
      setDlUrl("");
      setDlStart("");
      setDlEnd("");
      setDlExamDate("");
      setFeedback({ tone: "success", text: "Application deadline saved." });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to add deadline.",
      });
    } finally {
      setSavingDl(false);
    }
  }

  function isoToDateInput(iso: string | null): string {
    if (!iso) return "";
    try {
      return new Date(iso).toISOString().split("T")[0];
    } catch {
      return "";
    }
  }

  function startEditDeadline(d: AdminExamDetail["deadlines"][number]) {
    setEditingDlId(d.id);
    setEditDlStart(isoToDateInput(d.applicationStart));
    setEditDlEnd(isoToDateInput(d.applicationEnd));
    setEditDlExamDate(isoToDateInput(d.examDate));
    setEditDlUrl(d.applicationUrl ?? "");
  }

  async function handleSaveDeadlineEdit(deadlineId: number) {
    setFeedback(null);
    try {
      setSavingEditDl(true);
      await apiFetch(`/admin/deadlines/${deadlineId}`, {
        method: "PATCH",
        body: JSON.stringify({
          applicationStart: editDlStart ? `${editDlStart}T00:00:00.000Z` : null,
          applicationEnd: editDlEnd ? `${editDlEnd}T18:29:59.000Z` : null,
          examDate: editDlExamDate ? `${editDlExamDate}T00:00:00.000Z` : null,
          applicationUrl: editDlUrl.trim() || null,
        }),
      });
      setEditingDlId(null);
      setFeedback({ tone: "success", text: "Deadline dates updated successfully." });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to update deadline dates.",
      });
    } finally {
      setSavingEditDl(false);
    }
  }

  async function handleQuickDeadlineStatus(deadlineId: number, status: string) {
    try {
      await apiFetch(`/admin/deadlines/${deadlineId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setFeedback({ tone: "success", text: `Deadline status set to ${status}.` });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to update deadline.",
      });
    }
  }

  async function confirmDeleteDeadline() {
    if (!deleteDlTarget) return;
    try {
      await apiFetch(`/admin/deadlines/${deleteDlTarget}`, {
        method: "DELETE",
      });
      setDeleteDlTarget(null);
      setFeedback({ tone: "success", text: "Deadline removed." });
      await loadDetail();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to delete deadline.",
      });
    }
  }

  if (loading) return <LoadingSkeleton rows={4} />;
  if (!detail) return <AlertBanner tone="error">Exam not found.</AlertBanner>;

  return (
    <div className={styles.stackLg}>
      <div>
        <Link
          href="/admin/exams"
          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
        >
          <IconArrowLeft size={14} />
          Back to Exams
        </Link>
      </div>

      <div className={styles.pageHeader}>
        <div>
          <h1>{detail.exam.name}</h1>
          <p className={styles.pageSubtitle}>
            Exam ID #{detail.exam.id} • {detail.exam.conductingBody}
          </p>
        </div>
        <GenericBadge
          label={detail.exam.isArchived ? "Archived" : "Active"}
          tone={detail.exam.isArchived ? "neutral" : "success"}
        />
      </div>

      {feedback && <AlertBanner tone={feedback.tone}>{feedback.text}</AlertBanner>}

      {/* 1. Edit Exam Details */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>1. Exam Overview</h2>
        </div>
        <form onSubmit={handleUpdateExam} className={styles.stackMd}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Exam Name *</label>
              <input
                className={styles.input}
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Conducting Body *</label>
              <input
                className={styles.input}
                value={examOrg}
                onChange={(e) => setExamOrg(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Exam Type</label>
              <input
                className={styles.input}
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Official Website</label>
              <input
                type="url"
                className={styles.input}
                value={examWebsite}
                onChange={(e) => setExamWebsite(e.target.value)}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                value={examDesc}
                onChange={(e) => setExamDesc(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={savingExam}
            >
              {savingExam ? "Saving..." : "Save Exam Changes"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Posts Management */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              2. Posts ({detail.posts.length})
            </h2>
            <p className={styles.cardSubtitle}>
              Define distinct post groups with verified vacancies and official
              qualification requirements.
            </p>
          </div>
        </div>

        <div className={styles.stackMd} style={{ marginBottom: 20 }}>
          {detail.posts.map((post) => (
            <div
              key={post.id}
              className={styles.postBox}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className={styles.postTitle}>
                  #{post.id} {post.name} {post.code ? `(${post.code})` : ""}
                </div>
                <div className={styles.postMeta}>
                  {[
                    post.department,
                    post.vacancies
                      ? `${post.vacancies} verified vacancies`
                      : "Vacancies not specified",
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
                {post.qualification && (
                  <div className={styles.postMeta}>
                    <strong>Qualification:</strong> {post.qualification}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDangerOutline} ${styles.btnSm}`}
                onClick={() => setDeletePostTarget({ id: post.id, name: post.name })}
              >
                <IconTrash size={14} />
                Delete
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddPost} className={styles.stackMd}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add New Post</h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Post Name *</label>
              <input
                className={styles.input}
                value={postName}
                onChange={(e) => setPostName(e.target.value)}
                placeholder="e.g. Data Entry Operator (Grade A)"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Post Code</label>
              <input
                className={styles.input}
                value={postCode}
                onChange={(e) => setPostCode(e.target.value)}
                placeholder="e.g. DEO-A"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Department / Ministry</label>
              <input
                className={styles.input}
                value={postDept}
                onChange={(e) => setPostDept(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Verified Vacancies (leave blank if unverified)</label>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={postVacancies}
                onChange={(e) => setPostVacancies(e.target.value)}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.label}>Official Qualification Requirement</label>
              <input
                className={styles.input}
                value={postQual}
                onChange={(e) => setPostQual(e.target.value)}
                placeholder="e.g. Class 12 (10+2) pass in Science stream with Mathematics"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnBlue}`}
              disabled={savingPost}
            >
              <IconPlus size={15} />
              {savingPost ? "Adding..." : "Add Post"}
            </button>
          </div>
        </form>
      </section>

      {/* 3. Eligibility Rules */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              3. Eligibility Rules ({detail.rules.length})
            </h2>
            <p className={styles.cardSubtitle}>
              Configure age limits, category relaxations with cutoff dates, AND/OR
              logic groups, and link official notification sources.
            </p>
          </div>
        </div>

        <div className={styles.stackMd} style={{ marginBottom: 20 }}>
          {detail.rules.map((rule) => (
            <div key={rule.id} className={styles.postBox}>
              <div className={styles.postHeader}>
                <div>
                  <div className={styles.postTitle}>
                    #{rule.id} {rule.name}
                  </div>
                  <div className={styles.postMeta}>
                    Type: {rule.ruleType} • Scope:{" "}
                    {rule.postId ? `Post #${rule.postId}` : "Exam-Level"}
                  </div>
                </div>
              </div>

              {rule.versions.map((v) => (
                <div
                  key={v.id}
                  style={{
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: 10,
                    marginTop: 6,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div className={styles.postMeta}>
                      <strong>v{v.versionNumber}</strong> •{" "}
                      <code>
                        {v.conditionField} {v.operator} {v.expectedValue}
                      </code>
                      {v.logicGroup ? ` • Group: ${v.logicGroup} (${v.logicOperator})` : ""}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <GenericBadge
                        label={v.status}
                        tone={v.status === "ACTIVE" ? "success" : "neutral"}
                      />
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                        onClick={() => handleToggleVersionStatus(v.id, v.status)}
                      >
                        {v.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={styles.fieldHint}>Official Source:</span>
                    <select
                      className={styles.selectInput}
                      value={v.notificationSourceId ?? ""}
                      onChange={(e) =>
                        handleAttachSource(v.id, Number(e.target.value))
                      }
                    >
                      <option value="">Attach official notification source...</option>
                      {detail.sources.map((src) => (
                        <option key={src.id} value={src.id}>
                          #{src.id} — {src.organization}: {src.notificationTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddRule} className={styles.stackMd}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add Eligibility Rule</h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Rule Name *</label>
              <input
                className={styles.input}
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. Category-wise Age Limit"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Scope (Exam or Specific Post)</label>
              <select
                className={styles.select}
                value={rulePostId}
                onChange={(e) => setRulePostId(e.target.value)}
              >
                <option value="">Exam-Level (applies to all posts)</option>
                {detail.posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    Post #{p.id}: {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Rule Type</label>
              <select
                className={styles.select}
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
              >
                <option value="AGE">AGE</option>
                <option value="QUALIFICATION">QUALIFICATION</option>
                <option value="PERCENTAGE">PERCENTAGE</option>
                <option value="STREAM">STREAM</option>
                <option value="CATEGORY">CATEGORY</option>
                <option value="STATE">STATE</option>
                <option value="GENDER">GENDER</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Condition Field</label>
              <select
                className={styles.select}
                value={ruleField}
                onChange={(e) => setRuleField(e.target.value)}
              >
                <option value="ageByCategory">ageByCategory (category ranges + cutoff)</option>
                <option value="age">age</option>
                <option value="qualification">qualification</option>
                <option value="stream">stream</option>
                <option value="percentage">percentage</option>
                <option value="passingYear">passingYear</option>
                <option value="category">category</option>
                <option value="state">state</option>
                <option value="gender">gender</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Operator</label>
              <select
                className={styles.select}
                value={ruleOp}
                onChange={(e) => setRuleOp(e.target.value)}
              >
                <option value="BETWEEN">BETWEEN</option>
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="IN">IN</option>
                <option value="REQUIRED">REQUIRED</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Expected Value *</label>
              <input
                className={styles.input}
                value={ruleExpected}
                onChange={(e) => setRuleExpected(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Logic Group (optional, for OR groups)</label>
              <input
                className={styles.input}
                value={ruleLogicGroup}
                onChange={(e) => setRuleLogicGroup(e.target.value)}
                placeholder="e.g. degree_option"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Logic Operator</label>
              <select
                className={styles.select}
                value={ruleLogicOp}
                onChange={(e) => setRuleLogicOp(e.target.value as "AND" | "OR")}
              >
                <option value="AND">AND (all rules in group must pass)</option>
                <option value="OR">OR (any rule in group may pass)</option>
              </select>
            </div>

            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.label}>Attach Official Notification Source</label>
              <select
                className={styles.select}
                value={ruleSourceId}
                onChange={(e) => setRuleSourceId(e.target.value)}
              >
                <option value="">None (attach later)</option>
                {detail.sources.map((src) => (
                  <option key={src.id} value={src.id}>
                    #{src.id} — {src.organization}: {src.notificationTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnBlue}`}
              disabled={savingRule}
            >
              <IconPlus size={15} />
              {savingRule ? "Adding..." : "Create Eligibility Rule"}
            </button>
          </div>
        </form>
      </section>

      {/* 4. Deadlines */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            4. Application Deadlines ({detail.deadlines.length})
          </h2>
        </div>

        <div className={styles.stackMd} style={{ marginBottom: 20 }}>
          {detail.deadlines.map((d) => (
            <div key={d.id} className={styles.postBox}>
              <div className={styles.postHeader}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <DeadlineStatusBadge status={d.computedStatus} />
                  {d.postId && (
                    <GenericBadge
                      label={`Post #${d.postId}: ${detail.posts.find((p) => p.id === d.postId)?.name ?? "Unknown"}`}
                      tone="info"
                    />
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["OPEN", "UPCOMING", "NOTIFICATION_AWAITED", "CLOSED"] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        className={`${styles.btn} ${
                          d.status === st ? styles.btnPrimary : styles.btnSecondary
                        } ${styles.btnSm}`}
                        onClick={() => handleQuickDeadlineStatus(d.id, st)}
                      >
                        {st.replace(/_/g, " ")}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDangerOutline} ${styles.btnSm}`}
                    onClick={() => setDeleteDlTarget(d.id)}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>

              {/* Warning when OPEN/UPCOMING but no dates */}
              {(d.computedStatus === "OPEN" || d.computedStatus === "UPCOMING") &&
                !d.applicationStart &&
                !d.applicationEnd && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 12px",
                      background: "#fef3c7",
                      border: "1px solid #f59e0b",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "#92400e",
                      fontWeight: 600,
                    }}
                  >
                    ⚠ This deadline is marked as {d.computedStatus} but has no start/end dates.
                    Students will see &quot;dates not announced&quot;. Click Edit Dates below to fix.
                  </div>
                )}

              {/* Date display / edit */}
              {editingDlId === d.id ? (
                <div style={{ marginTop: 10 }}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Application Start Date</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={editDlStart}
                        onChange={(e) => setEditDlStart(e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Application Closing Date</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={editDlEnd}
                        onChange={(e) => setEditDlEnd(e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Exam Date</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={editDlExamDate}
                        onChange={(e) => setEditDlExamDate(e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Apply URL</label>
                      <input
                        type="url"
                        className={styles.input}
                        value={editDlUrl}
                        onChange={(e) => setEditDlUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
                      disabled={savingEditDl}
                      onClick={() => handleSaveDeadlineEdit(d.id)}
                    >
                      {savingEditDl ? "Saving..." : "Save Dates"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                      onClick={() => setEditingDlId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 8, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <span className={styles.postMeta}>
                    Start: <strong>{formatDate(d.applicationStart)}</strong> &bull; End:{" "}
                    <strong>{formatDate(d.applicationEnd)}</strong> &bull; Exam:{" "}
                    <strong>{formatDate(d.examDate)}</strong>
                    {d.applicationUrl && (
                      <> &bull; <a href={d.applicationUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue-600)" }}>Apply Link</a></>
                    )}
                  </span>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                    onClick={() => startEditDeadline(d)}
                  >
                    ✏️ Edit Dates
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddDeadline} className={styles.stackMd}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add Application Deadline</h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Status</label>
              <select
                className={styles.select}
                value={dlStatus}
                onChange={(e) => setDlStatus(e.target.value)}
              >
                <option value="OPEN">OPEN</option>
                <option value="UPCOMING">UPCOMING</option>
                <option value="NOTIFICATION_AWAITED">NOTIFICATION_AWAITED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Scope</label>
              <select
                className={styles.select}
                value={dlPostId}
                onChange={(e) => setDlPostId(e.target.value)}
              >
                <option value="">Exam-Level</option>
                {detail.posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    Post #{p.id}: {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Application Start Date</label>
              <input
                type="date"
                className={styles.input}
                value={dlStart}
                onChange={(e) => setDlStart(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Application Closing Date</label>
              <input
                type="date"
                className={styles.input}
                value={dlEnd}
                onChange={(e) => setDlEnd(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Exam Date (if announced)</label>
              <input
                type="date"
                className={styles.input}
                value={dlExamDate}
                onChange={(e) => setDlExamDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Official Apply URL</label>
              <input
                type="url"
                className={styles.input}
                value={dlUrl}
                onChange={(e) => setDlUrl(e.target.value)}
                placeholder="https://ssc.gov.in"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnBlue}`}
              disabled={savingDl}
            >
              <IconPlus size={15} />
              {savingDl ? "Saving..." : "Add Deadline"}
            </button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={deletePostTarget !== null}
        title="Delete Post"
        message={`Delete post "${deletePostTarget?.name}" and its post-specific rules/deadlines?`}
        confirmLabel="Delete Post"
        destructive
        onConfirm={confirmDeletePost}
        onCancel={() => setDeletePostTarget(null)}
      />

      <ConfirmDialog
        open={deleteDlTarget !== null}
        title="Delete Application Deadline"
        message="Remove this application deadline record?"
        confirmLabel="Delete Deadline"
        destructive
        onConfirm={confirmDeleteDeadline}
        onCancel={() => setDeleteDlTarget(null)}
      />
    </div>
  );
}

export default function AdminExamEditorPage() {
  return (
    <AdminGuardShell title="Configure Exam">
      {() => <AdminExamEditorContent />}
    </AdminGuardShell>
  );
}
