import api, { route } from "@forge/api";
import { assertSafeIssueKey } from "./jira-path.js";

const ISSUE_FIELDS = [
  "summary",
  "status",
  "assignee",
  "reporter",
  "issuetype",
  "priority",
  "issuelinks",
  "subtasks",
  "parent",
  "project",
  "updated",
  "comment",
];

async function jiraGet(routedPath, label) {
  const response = await api.asUser().requestJira(routedPath, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Jira ${response.status} on ${label}: ${text.slice(0, 400)}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function getServerInfo() {
  try {
    return await jiraGet(route`/rest/api/3/serverInfo`, "serverInfo");
  } catch (error) {
    return { error: error.message };
  }
}

export async function getIssue(issueKey) {
  const key = assertSafeIssueKey(issueKey);
  if (!key) return null;
  const query = new URLSearchParams({ fields: ISSUE_FIELDS.join(",") });
  const data = await jiraGet(route`/rest/api/3/issue/${key}?${query}`, `issue ${key}`);
  return shapeIssue(data);
}

function statusOf(fields) {
  return {
    statusName: fields?.status?.name || null,
    statusCategory: fields?.status?.statusCategory?.key || fields?.status?.statusCategory?.name || null,
  };
}

function person(user) {
  if (!user) return null;
  return {
    accountId: user.accountId || null,
    name: user.displayName || user.name || null,
    email: user.emailAddress || null,
  };
}

export function shapeIssue(data) {
  if (!data) return null;
  const fields = data.fields || {};
  const { statusName, statusCategory } = statusOf(fields);
  const links = fields.issuelinks || [];
  const blockers = [];
  for (const link of links) {
    const typeName = (link.type?.name || "").toLowerCase();
    const inward = (link.type?.inward || "").toLowerCase();
    const outward = (link.type?.outward || "").toLowerCase();
    const isBlocksType = typeName.includes("block");
    // If the other issue is outwardIssue, the current issue is on the inward side
    // ("is blocked by") of a Blocks link.
    if (link.outwardIssue && (isBlocksType || inward.includes("blocked by") || inward.includes("is blocked"))) {
      blockers.push(shapeLinked(link.outwardIssue));
    }
    // If the other issue is inwardIssue and the outward verb is "is blocked by",
    // the current issue is blocked by that inward issue (unusual type naming).
    if (link.inwardIssue && (outward.includes("blocked by") || outward.includes("is blocked"))) {
      blockers.push(shapeLinked(link.inwardIssue));
    }
  }

  const subtasks = (fields.subtasks || []).map(shapeLinked);

  return {
    id: String(data.id),
    key: data.key,
    summary: fields.summary || "",
    statusName,
    statusCategory,
    issueType: fields.issuetype?.name || null,
    priority: fields.priority?.name || null,
    assignee: person(fields.assignee),
    reporter: person(fields.reporter),
    parent: fields.parent ? shapeLinked(fields.parent) : null,
    projectKey: fields.project?.key || null,
    projectName: fields.project?.name || null,
    updated: fields.updated || null,
    blockers: uniqueByKey(blockers),
    subtasks,
    rawLinks: links.length,
  };
}

function shapeLinked(issue) {
  if (!issue) return null;
  const fields = issue.fields || {};
  const { statusName, statusCategory } = statusOf(fields);
  return {
    id: issue.id ? String(issue.id) : null,
    key: issue.key,
    summary: fields.summary || "",
    statusName,
    statusCategory,
    status: statusName,
  };
}

function uniqueByKey(items) {
  const seen = new Set();
  const result = [];
  for (const item of items.filter(Boolean)) {
    if (!item.key || seen.has(item.key)) continue;
    seen.add(item.key);
    result.push(item);
  }
  return result;
}

export async function getCurrentUser() {
  try {
    const me = await jiraGet(route`/rest/api/3/myself`, "myself");
    return person(me);
  } catch (error) {
    return { name: null, accountId: null, error: error.message };
  }
}
