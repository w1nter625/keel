import {
  listDecisionsForIssue,
  listDecisionsForProject,
  saveDecision,
  buildDecision,
  updateDecisionRecord,
  deleteDecisionRecord,
} from "../lib/decisions.js";
import { filterDecisions, formatDecisionList } from "../lib/format.js";
import { resolveIssueRef, actionResult, normalizeStatus, safeText } from "../lib/ids.js";
import { getIssue, getCurrentUser } from "../lib/jira.js";
import { getWorkGraph, userAri, summarizeGraph } from "../lib/graph.js";
import { scoreReadiness, formatReadinessMessage } from "../lib/readiness.js";
import { withTimeout, emptyGraph } from "../lib/timeout.js";

async function loadGraphSafe(params) {
  try {
    return await withTimeout(getWorkGraph(params), 8000, "Teamwork Graph");
  } catch (error) {
    return emptyGraph([error.message || String(error)]);
  }
}

function actorName(user) {
  return user?.name || user?.email || user?.accountId || null;
}

async function loadIssueOrError(ref) {
  if (!ref.issueKey) {
    return { error: actionResult(false, "I need a Jira issue key, for example SHOP-12. Open a work item or pass issueKey.") };
  }
  try {
    const issue = await getIssue(ref.issueKey);
    return { issue };
  } catch (error) {
    return { error: actionResult(false, `Could not load ${ref.issueKey}: ${error.message}`) };
  }
}

export async function listDecisions(payload, context) {
  const ref = resolveIssueRef(payload, context);
  if (!ref.issueKey) {
    return actionResult(false, "I need a Jira issue key to list decisions. Open a work item or pass issueKey.");
  }
  const decisions = filterDecisions(await listDecisionsForIssue(ref.issueKey), {
    status: payload.status,
  });
  return actionResult(true, formatDecisionList(decisions), {
    issueKey: ref.issueKey,
    count: decisions.length,
    decisions,
  });
}

export async function recordDecision(payload, context) {
  const ref = resolveIssueRef(payload, context);
  const title = safeText(payload.title);
  const rationale = safeText(payload.rationale);
  if (!title || !rationale) {
    return actionResult(false, "A decision needs both a title and a rationale (the why).");
  }
  const loaded = await loadIssueOrError(ref);
  if (loaded.error) return loaded.error;
  const issue = loaded.issue;
  const user = await getCurrentUser();
  const decision = buildDecision({
    issueKey: issue.key,
    issueId: issue.id,
    projectKey: issue.projectKey || ref.projectKey,
    title,
    rationale,
    alternatives: payload.alternatives,
    status: payload.status,
    owner: payload.owner || actorName(user),
    actor: actorName(user),
  });
  await saveDecision(decision);
  return actionResult(
    true,
    `Recorded a ${decision.status} decision on ${issue.key}: "${decision.title}" (id: ${decision.id}).`,
    { decision }
  );
}

export async function updateDecision(payload, context) {
  const ref = resolveIssueRef(payload, context);
  const decisionId = safeText(payload.decisionId);
  if (!ref.issueKey || !decisionId) {
    return actionResult(false, "I need the issue key and the decision id to update a decision.");
  }
  const patch = {};
  if (payload.status) patch.status = normalizeStatus(payload.status, undefined);
  if (payload.title) patch.title = payload.title;
  if (payload.rationale) patch.rationale = payload.rationale;
  if (payload.alternatives != null) patch.alternatives = payload.alternatives;
  if (payload.owner != null) patch.owner = payload.owner;
  const user = await getCurrentUser();
  const updated = await updateDecisionRecord(ref.issueKey, decisionId, patch, actorName(user));
  if (!updated) {
    return actionResult(false, `No decision ${decisionId} was found on ${ref.issueKey}.`);
  }
  return actionResult(true, `Updated decision "${updated.title}" on ${updated.issueKey} to ${updated.status}.`, {
    decision: updated,
  });
}

export async function deleteDecision(payload, context) {
  const ref = resolveIssueRef(payload, context);
  const decisionId = safeText(payload.decisionId);
  if (!ref.issueKey || !decisionId) {
    return actionResult(false, "I need the issue key and the decision id to delete a decision.");
  }
  const deleted = await deleteDecisionRecord(ref.issueKey, decisionId);
  if (!deleted) {
    return actionResult(false, `No decision ${decisionId} was found on ${ref.issueKey}.`);
  }
  return actionResult(true, `Deleted decision "${deleted.title}" from ${deleted.issueKey}.`, {
    decision: deleted,
  });
}

export async function getShipReadiness(payload, context) {
  const ref = resolveIssueRef(payload, context);
  const loaded = await loadIssueOrError(ref);
  if (loaded.error) return loaded.error;
  const issue = loaded.issue;
  const decisions = await listDecisionsForIssue(issue.key);
  const graph = await loadGraphSafe({
    cloudId: ref.cloudId,
    issueId: issue.id,
    assigneeAri: userAri(issue.assignee?.accountId),
  });
  const readiness = scoreReadiness({
    decisions,
    issue,
    blockers: issue.blockers,
    subtasks: issue.subtasks,
    graph: {
      goals: graph.goals,
      pullRequests: graph.pullRequests,
      deployments: graph.deployments,
      people: [issue.assignee, issue.reporter].filter(Boolean),
    },
  });
  const contextLine = summarizeGraph(graph);
  const message = formatReadinessMessage(issue.key, readiness, { contextLine });
  return actionResult(true, message, {
    issueKey: issue.key,
    issue,
    decisions,
    graph,
    readiness,
  });
}

export async function getWorkContext(payload, context) {
  const ref = resolveIssueRef(payload, context);
  const loaded = await loadIssueOrError(ref);
  if (loaded.error) return loaded.error;
  const issue = loaded.issue;
  const graph = await loadGraphSafe({
    cloudId: ref.cloudId,
    issueId: issue.id,
    assigneeAri: userAri(issue.assignee?.accountId),
  });
  const people = [issue.assignee, issue.reporter].filter(Boolean);
  const lines = [
    `${issue.key}: ${issue.summary} (${issue.statusName || "unknown status"}).`,
    issue.assignee?.name ? `Assignee: ${issue.assignee.name}.` : "No assignee.",
    issue.reporter?.name ? `Reporter: ${issue.reporter.name}.` : null,
    issue.blockers?.length
      ? `Blocked by: ${issue.blockers.map((b) => b.key).join(", ")}.`
      : "No open blocker links found in Jira.",
    summarizeGraph(graph),
  ].filter(Boolean);
  return actionResult(true, lines.join(" "), {
    issueKey: issue.key,
    issue,
    people,
    graph,
  });
}

export async function searchDecisions(payload, context) {
  const ref = resolveIssueRef(payload, context);
  const projectKey = ref.projectKey;
  if (!projectKey) {
    return actionResult(false, "I need a Jira project key to search decisions, for example SHOP.");
  }
  const decisions = filterDecisions(await listDecisionsForProject(projectKey), {
    status: payload.status,
    query: payload.query,
  });
  return actionResult(true, formatDecisionList(decisions), {
    projectKey,
    count: decisions.length,
    decisions,
  });
}
