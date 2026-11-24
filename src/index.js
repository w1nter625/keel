import Resolver from "@forge/resolver";
import {
  listDecisions,
  recordDecision,
  updateDecision,
  deleteDecision,
  getShipReadiness,
  getWorkContext,
  searchDecisions,
} from "./actions/handlers.js";
import { listDecisionsForIssue, listDecisionsForProject, saveDecision, buildDecision, updateDecisionRecord, deleteDecisionRecord } from "./lib/decisions.js";
import { resolveIssueRef } from "./lib/ids.js";
import { getIssue, getCurrentUser } from "./lib/jira.js";
import { getWorkGraph, userAri } from "./lib/graph.js";
import { scoreReadiness } from "./lib/readiness.js";
import { withTimeout, emptyGraph } from "./lib/timeout.js";

const resolver = new Resolver();

resolver.define("getPanelData", async (req) => {
  const ref = resolveIssueRef(req.payload || {}, req.context || {});
  if (!ref.issueKey) {
    return { ok: false, message: "This panel needs to be opened from a Jira work item." };
  }

  let issue;
  try {
    issue = await withTimeout(getIssue(ref.issueKey), 8000, "Jira issue");
  } catch (error) {
    return { ok: false, message: `Could not load the work item: ${error.message}` };
  }
  if (!issue) {
    return { ok: false, message: "This panel needs to be opened from a Jira work item." };
  }

  const [decisionsResult, graphResult, userResult] = await Promise.allSettled([
    withTimeout(listDecisionsForIssue(issue.key), 8000, "decisions"),
    withTimeout(
      getWorkGraph({
        cloudId: ref.cloudId || req.context?.cloudId,
        issueId: issue.id,
        assigneeAri: userAri(issue.assignee?.accountId),
      }),
      8000,
      "Teamwork Graph"
    ),
    withTimeout(getCurrentUser(), 5000, "current user"),
  ]);

  const warnings = [];
  const decisions = decisionsResult.status === "fulfilled" ? decisionsResult.value : [];
  if (decisionsResult.status === "rejected") {
    warnings.push("Decision records could not be loaded.");
  }
  const graph =
    graphResult.status === "fulfilled"
      ? graphResult.value
      : emptyGraph([graphResult.reason?.message || "Teamwork Graph timed out or failed."]);
  if (graphResult.status === "rejected") {
    warnings.push("Teamwork Graph context is unavailable; readiness is based on Jira and decisions only.");
  }
  const user =
    userResult.status === "fulfilled" ? userResult.value : { name: null, accountId: null };

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
  return { ok: true, issue, decisions, graph, readiness, user, warnings };
});

resolver.define("createDecision", async (req) => {
  const ref = resolveIssueRef(req.payload || {}, req.context || {});
  let issue;
  try {
    issue = await getIssue(ref.issueKey);
  } catch (error) {
    return { ok: false, message: `Could not load the work item: ${error.message}` };
  }
  if (!issue) {
    return { ok: false, message: "This panel needs to be opened from a Jira work item." };
  }
  const user = await getCurrentUser();
  const payload = req.payload || {};
  const decision = buildDecision({
    issueKey: issue.key,
    issueId: issue.id,
    projectKey: issue.projectKey,
    title: payload.title,
    rationale: payload.rationale,
    alternatives: payload.alternatives,
    status: payload.status,
    owner: payload.owner || user?.name,
    actor: user?.name,
  });
  await saveDecision(decision);
  return { ok: true, decision };
});

resolver.define("updateDecision", async (req) => {
  const ref = resolveIssueRef(req.payload || {}, req.context || {});
  const payload = req.payload || {};
  if (!payload.decisionId) return { ok: false, message: "Decision not found." };
  const user = await getCurrentUser();
  const patch = {
    title: payload.title,
    rationale: payload.rationale,
    alternatives: payload.alternatives,
    status: payload.status,
    owner: payload.owner,
  };
  const updated = await updateDecisionRecord(ref.issueKey, payload.decisionId, patch, user?.name);
  if (!updated) return { ok: false, message: "Decision not found." };
  return { ok: true, decision: updated };
});

resolver.define("deleteDecision", async (req) => {
  const ref = resolveIssueRef(req.payload || {}, req.context || {});
  const payload = req.payload || {};
  if (!payload.decisionId) return { ok: false, message: "Decision not found." };
  const deleted = await deleteDecisionRecord(ref.issueKey, payload.decisionId);
  if (!deleted) return { ok: false, message: "Decision not found." };
  return { ok: true, decision: deleted };
});

resolver.define("getProjectData", async (req) => {
  const ref = resolveIssueRef(req.payload || {}, req.context || {});
  const projectKey =
    ref.projectKey ||
    req.context?.extension?.project?.key ||
    req.payload?.projectKey;
  if (!projectKey) {
    return { ok: false, message: "Open this page from a Jira project." };
  }
  const decisions = await listDecisionsForProject(projectKey);
  return { ok: true, projectKey, decisions };
});

export const handler = resolver.getDefinitions();

export {
  listDecisions,
  recordDecision,
  updateDecision,
  deleteDecision,
  getShipReadiness,
  getWorkContext,
  searchDecisions,
};
