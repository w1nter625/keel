import api from "@forge/api";
import { issueAri } from "./ids.js";

/**
 * Teamwork Graph access is as-user only. New apps must use curated queries
 * (raw cypherQuery is unavailable). Missing scopes omit data rather than throw.
 * Field shapes can vary by schema version, so parsing is defensive.
 */
const WORK_CONTEXT_QUERY = `
  query KeelWorkContext($id: ID!) {
    jiraWorkItemGoals(id: $id) {
      edges { node { ... on AtlassianGoal { id name status } id } }
    }
    jiraWorkItemComments(id: $id, since: "P30D") {
      edges { node { id } }
    }
    jiraWorkItemLinkedExternalPullRequests(id: $id) {
      edges { node { id } }
    }
    jiraWorkItemLinkedExternalDeployments(id: $id) {
      edges { node { id } }
    }
  }
`;

const USER_TEAMS_QUERY = `
  query KeelUserTeams($userId: ID!) {
    atlassianUserInTeams(userId: $userId) {
      edges { node { id name } }
    }
  }
`;

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const key of keys) {
    if (obj[key] != null) out[key] = obj[key];
  }
  return out;
}

function nodesFrom(connection) {
  const edges = connection?.edges;
  if (!Array.isArray(edges)) return [];
  return edges.map((edge) => edge?.node).filter(Boolean);
}

function shapeNamed(node) {
  return {
    id: node.id || node.ari || null,
    name: node.name || node.title || node.displayName || node.key || null,
    status: node.status || node.state || node.statusName || null,
    url: node.url || node.webUrl || null,
    ...pick(node, ["title", "displayName", "key"]),
  };
}

async function requestGraph(query, variables) {
  const response = await api.asUser().requestTeamworkGraph(query, variables);
  if (typeof response.json === "function") {
    const body = await response.json();
    return body;
  }
  // Some SDK versions already return the parsed TeamworkGraphResult.
  return response;
}

export async function getWorkGraph({ cloudId, issueId, assigneeAri }) {
  const result = {
    available: false,
    ari: issueAri(cloudId, issueId),
    goals: [],
    comments: [],
    pullRequests: [],
    deployments: [],
    teams: [],
    errors: [],
  };

  if (!result.ari) {
    result.errors.push("Missing cloudId or issueId, so a Teamwork Graph ARI could not be built.");
    return result;
  }

  try {
    const body = await requestGraph(WORK_CONTEXT_QUERY, { id: result.ari });
    result.available = true;
    if (body?.errors?.length) {
      result.errors.push(...body.errors.map((e) => e.message || JSON.stringify(e)));
    }
    const data = body?.data || {};
    result.goals = nodesFrom(data.jiraWorkItemGoals).map(shapeNamed);
    result.comments = nodesFrom(data.jiraWorkItemComments).map(shapeNamed);
    result.pullRequests = nodesFrom(data.jiraWorkItemLinkedExternalPullRequests).map(shapeNamed);
    result.deployments = nodesFrom(data.jiraWorkItemLinkedExternalDeployments).map(shapeNamed);
  } catch (error) {
    result.errors.push(error.message || String(error));
  }

  if (assigneeAri) {
    try {
      const body = await requestGraph(USER_TEAMS_QUERY, { userId: assigneeAri });
      const data = body?.data || {};
      result.teams = nodesFrom(data.atlassianUserInTeams).map(shapeNamed);
      if (body?.errors?.length) {
        result.errors.push(...body.errors.map((e) => e.message || JSON.stringify(e)));
      }
    } catch (error) {
      result.errors.push(error.message || String(error));
    }
  }

  return result;
}

export function userAri(accountId) {
  if (!accountId) return null;
  return `ari:cloud:identity::user/${accountId}`;
}

export function summarizeGraph(graph) {
  const parts = [];
  if (graph.goals?.length) {
    parts.push(`Goals: ${graph.goals.map((g) => g.name || g.id).join(", ")}`);
  }
  if (graph.teams?.length) {
    parts.push(`Assignee teams: ${graph.teams.map((t) => t.name || t.id).join(", ")}`);
  }
  if (graph.pullRequests?.length) {
    parts.push(`${graph.pullRequests.length} linked pull request(s)`);
  }
  if (graph.deployments?.length) {
    parts.push(`${graph.deployments.length} linked deployment(s)`);
  }
  if (graph.comments?.length) {
    parts.push(`${graph.comments.length} comment(s) in the last 30 days`);
  }
  if (!parts.length) {
    return graph.available
      ? "Teamwork Graph returned no extra goals, teams, pull requests, or deployments for this item."
      : "Teamwork Graph context was not available.";
  }
  return parts.join(". ") + ".";
}
