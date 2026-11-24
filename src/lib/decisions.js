import { kvs } from "@forge/kvs";
import { newId, normalizeStatus, projectKeyFromIssueKey, safeText } from "./ids.js";

const RECORD_PREFIX = "dec";
const ISSUE_INDEX_PREFIX = "dec-index";
const PROJECT_INDEX_PREFIX = "dec-proj";

function recordKey(issueKey, id) {
  return `${RECORD_PREFIX}:${issueKey}:${id}`;
}

function issueIndexKey(issueKey) {
  return `${ISSUE_INDEX_PREFIX}:${issueKey}`;
}

function projectIndexKey(projectKey) {
  return `${PROJECT_INDEX_PREFIX}:${projectKey}`;
}

async function readIndex(key) {
  const value = await kvs.get(key);
  return Array.isArray(value) ? value : [];
}

async function writeIndex(key, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  await kvs.set(key, unique);
  return unique;
}

export function buildDecision({ issueKey, issueId, projectKey, title, rationale, alternatives, status, owner, actor }) {
  const now = new Date().toISOString();
  const id = newId();
  return {
    id,
    issueKey,
    issueId: issueId || null,
    projectKey: projectKey || projectKeyFromIssueKey(issueKey),
    title: safeText(title),
    rationale: safeText(rationale),
    alternatives: safeText(alternatives),
    status: normalizeStatus(status, "proposed"),
    owner: safeText(owner),
    createdAt: now,
    updatedAt: now,
    createdBy: actor || null,
    updatedBy: actor || null,
    supersededBy: null,
  };
}

export async function saveDecision(decision) {
  if (!decision?.issueKey || !decision?.id) {
    throw new Error("Decision is missing issueKey or id");
  }
  await kvs.set(recordKey(decision.issueKey, decision.id), decision);

  const issueIds = await readIndex(issueIndexKey(decision.issueKey));
  if (!issueIds.includes(decision.id)) {
    issueIds.push(decision.id);
    await writeIndex(issueIndexKey(decision.issueKey), issueIds);
  }

  if (decision.projectKey) {
    const projectIds = await readIndex(projectIndexKey(decision.projectKey));
    const entry = `${decision.issueKey}:${decision.id}`;
    if (!projectIds.includes(entry)) {
      projectIds.push(entry);
      await writeIndex(projectIndexKey(decision.projectKey), projectIds);
    }
  }
  return decision;
}

export async function getDecision(issueKey, id) {
  if (!issueKey || !id) return null;
  const record = await kvs.get(recordKey(issueKey, id));
  return record || null;
}

export async function listDecisionsForIssue(issueKey) {
  if (!issueKey) return [];
  const ids = await readIndex(issueIndexKey(issueKey));
  const records = await Promise.all(ids.map((id) => kvs.get(recordKey(issueKey, id))));
  return records
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export async function listDecisionsForProject(projectKey) {
  if (!projectKey) return [];
  const entries = await readIndex(projectIndexKey(projectKey));
  const records = await Promise.all(
    entries.map(async (entry) => {
      const [issueKey, id] = String(entry).split(":");
      if (!issueKey || !id) return null;
      return kvs.get(recordKey(issueKey, id));
    })
  );
  return records
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function projectIndexEntry(issueKey, id) {
  return `${issueKey}:${id}`;
}

export function withoutId(ids, id) {
  return (ids || []).filter((item) => item && item !== id);
}

export function withoutProjectEntry(entries, issueKey, id) {
  const entry = projectIndexEntry(issueKey, id);
  return (entries || []).filter((item) => item && item !== entry);
}

/**
 * Apply only known editable fields. Extra payload keys (decisionId, context, …)
 * must not be written into the stored record.
 */
export function applyDecisionPatch(existing, patch = {}, actor) {
  if (!existing) return null;
  const updated = {
    ...existing,
    id: existing.id,
    issueKey: existing.issueKey,
    issueId: existing.issueId,
    projectKey: existing.projectKey,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: new Date().toISOString(),
    updatedBy: actor || existing.updatedBy,
  };
  if (patch.status) {
    updated.status = normalizeStatus(patch.status, existing.status);
  }
  if (patch.title != null) {
    const title = safeText(patch.title);
    if (title) updated.title = title;
  }
  if (patch.rationale != null) updated.rationale = safeText(patch.rationale);
  if (patch.alternatives != null) updated.alternatives = safeText(patch.alternatives);
  if (patch.owner != null) updated.owner = safeText(patch.owner);
  if (patch.supersededBy != null) updated.supersededBy = patch.supersededBy;
  return updated;
}

export async function updateDecisionRecord(issueKey, id, patch, actor) {
  const existing = await getDecision(issueKey, id);
  if (!existing) return null;
  const updated = applyDecisionPatch(existing, patch, actor);
  await kvs.set(recordKey(issueKey, id), updated);
  return updated;
}

export async function deleteDecisionRecord(issueKey, id) {
  const existing = await getDecision(issueKey, id);
  if (!existing) return null;
  await kvs.delete(recordKey(issueKey, id));
  const issueIds = await readIndex(issueIndexKey(issueKey));
  await writeIndex(issueIndexKey(issueKey), withoutId(issueIds, id));
  const projectKey = existing.projectKey;
  if (projectKey) {
    const projectIds = await readIndex(projectIndexKey(projectKey));
    await writeIndex(
      projectIndexKey(projectKey),
      withoutProjectEntry(projectIds, existing.issueKey, existing.id)
    );
  }
  return existing;
}
