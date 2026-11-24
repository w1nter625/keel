/**
 * Shared identifiers and context extraction for Rovo actions and UI resolvers.
 */

const STATUSES = new Set(["proposed", "accepted", "rejected", "superseded"]);

export function normalizeStatus(value, fallback = "proposed") {
  if (!value || typeof value !== "string") return fallback;
  const status = value.trim().toLowerCase();
  return STATUSES.has(status) ? status : fallback;
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function projectKeyFromIssueKey(issueKey) {
  if (!issueKey || typeof issueKey !== "string") return null;
  const trimmed = issueKey.trim().toUpperCase();
  const idx = trimmed.lastIndexOf("-");
  if (idx <= 0) return trimmed || null;
  return trimmed.slice(0, idx);
}

/**
 * Rovo actions and Forge resolvers pass context in slightly different shapes.
 * This helper keeps issue key / id / cloudId resolution in one place.
 */
export function resolveIssueRef(payload = {}, context = {}) {
  const ctx = {
    ...(context || {}),
    ...((payload && payload.context) || {}),
  };
  const jira = ctx.jira || ctx.extension?.jira || ctx.extension || {};
  const issue = jira.issue || {};

  const issueKey = firstString(
    payload.issueKey,
    payload.issue_key,
    jira.issueKey,
    issue.key,
    ctx.issueKey,
    ctx.extension?.issue?.key
  );

  const issueId = firstString(
    payload.issueId,
    payload.issue_id,
    jira.issueId,
    issue.id,
    ctx.issueId,
    ctx.extension?.issue?.id
  );

  const cloudId = firstString(
    payload.cloudId,
    ctx.cloudId,
    ctx.extension?.cloudId,
    context.cloudId
  );

  const projectKey = firstString(
    payload.projectKey,
    payload.project_key,
    jira.projectKey,
    ctx.projectKey,
    projectKeyFromIssueKey(issueKey)
  );

  return { issueKey, issueId, cloudId, projectKey };
}

export function issueAri(cloudId, issueId) {
  if (!cloudId || !issueId) return null;
  return `ari:cloud:jira:${cloudId}:issue/${issueId}`;
}

export function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export function safeText(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

export function actionResult(ok, message, data = {}) {
  return {
    ok,
    message,
    ...data,
  };
}
