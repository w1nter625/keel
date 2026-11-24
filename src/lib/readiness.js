/**
 * Pure ship-readiness scoring. Kept free of Forge imports so it can be tested
 * on the box without an Atlassian login.
 */

const DONE_CATEGORIES = new Set(["done", "complete", "completed", "closed"]);
const DONE_NAMES = new Set(["done", "closed", "resolved", "shipped", "released", "complete", "completed"]);

export function isDoneStatus(issue = {}) {
  const name = (issue.statusName || issue.status || "").toLowerCase();
  const category = (issue.statusCategory || "").toLowerCase();
  if (DONE_CATEGORIES.has(category)) return true;
  return DONE_NAMES.has(name);
}

export function scoreReadiness({ decisions = [], issue = {}, blockers = [], subtasks = [], graph = {} } = {}) {
  const reasons = [];
  const openDecisions = decisions.filter((d) => d.status === "proposed");
  const accepted = decisions.filter((d) => d.status === "accepted");
  const activeBlockers = blockers.filter((b) => !isDoneStatus(b));
  const openSubtasks = subtasks.filter((s) => !isDoneStatus(s));
  const goals = graph.goals || [];
  const pullRequests = graph.pullRequests || [];
  const deployments = graph.deployments || [];
  const people = graph.people || [];

  if (openDecisions.length > 0) {
    reasons.push({
      severity: "block",
      code: "open-decisions",
      text: `${openDecisions.length} decision${openDecisions.length === 1 ? " is" : "s are"} still proposed: ${openDecisions.map((d) => d.title).join("; ")}`,
    });
  }

  if (activeBlockers.length > 0) {
    reasons.push({
      severity: "block",
      code: "blockers",
      text: `Blocked by ${activeBlockers.map((b) => b.key + (b.summary ? ` (${b.summary})` : "")).join(", ")}`,
    });
  }

  if (openSubtasks.length > 0) {
    reasons.push({
      severity: "risk",
      code: "open-subtasks",
      text: `${openSubtasks.length} sub-task${openSubtasks.length === 1 ? " is" : "s are"} not done`,
    });
  }

  const atRiskGoals = goals.filter((g) => /at.?risk|off.?track|behind|red/i.test(`${g.status || ""} ${g.name || ""}`));
  if (atRiskGoals.length > 0) {
    reasons.push({
      severity: "risk",
      code: "goals",
      text: `Linked goal${atRiskGoals.length === 1 ? " is" : "s are"} at risk: ${atRiskGoals.map((g) => g.name || g.id).join(", ")}`,
    });
  }

  const isInReview = /review|qa|testing|ready/i.test(issue.statusName || issue.status || "");
  if (isInReview && pullRequests.length === 0 && !isDoneStatus(issue)) {
    reasons.push({
      severity: "risk",
      code: "no-pr",
      text: "No linked pull request found in Teamwork Graph for work that is already in review",
    });
  }

  if (accepted.length === 0 && decisions.length === 0) {
    reasons.push({
      severity: "info",
      code: "no-decisions",
      text: "No Keel decisions have been recorded on this work item yet",
    });
  }

  const blocks = reasons.filter((r) => r.severity === "block").length;
  const risks = reasons.filter((r) => r.severity === "risk").length;
  let status = "ready";
  if (blocks > 0) status = "not-ready";
  else if (risks > 0) status = "at-risk";

  // 100 starts as ready; each block -30, each risk -15, info does not reduce the headline status.
  let score = 100 - blocks * 30 - risks * 15;
  if (score < 0) score = 0;
  if (status === "ready" && reasons.some((r) => r.code === "no-decisions")) {
    score = Math.min(score, 85);
  }

  return {
    status,
    score,
    label: status === "ready" ? "Ready to ship" : status === "at-risk" ? "At risk" : "Not ready to ship",
    reasons,
    summary: {
      openDecisions: openDecisions.length,
      acceptedDecisions: accepted.length,
      blockers: activeBlockers.length,
      openSubtasks: openSubtasks.length,
      goals: goals.length,
      pullRequests: pullRequests.length,
      deployments: deployments.length,
      people: people.length,
    },
  };
}

export function formatReadinessMessage(issueKey, readiness, extras = {}) {
  const lines = [
    `${issueKey || "This work item"} is ${readiness.label.toLowerCase()} (score ${readiness.score}/100).`,
  ];
  if (readiness.reasons.length === 0) {
    lines.push("No open decisions, blockers, or graph risks were found.");
  } else {
    for (const reason of readiness.reasons) {
      const mark = reason.severity === "block" ? "Blocker" : reason.severity === "risk" ? "Risk" : "Note";
      lines.push(`${mark}: ${reason.text}`);
    }
  }
  if (extras.contextLine) lines.push(extras.contextLine);
  return lines.join("\n");
}
