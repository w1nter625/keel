---
name: keel
description: Use Keel MCP tools to record Jira decision context and check whether a work item is ready to ship.
---

# Keel

Keel is an Atlassian Forge app. Its MCP server exposes tools that store decision records next to Jira work items and score ship-readiness from those decisions plus Jira and Teamwork Graph context.

## When to use this skill

- The user asks whether a Jira work item can ship, go live, or be released.
- The user wants to record, accept, or look up the *why* behind a ticket.
- A coding agent needs the team's existing decision (for example payment provider, API shape, or rollout plan) before changing code.

## Endpoint

After the Forge app is installed and an admin enables external MCP tools for the site, connect a client to:

```
https://mcp.atlassian.com/forge/<appId>
```

`<appId>` is the UUID in `app.id` in `manifest.yml` (the part after `ari:cloud:ecosystem::app/`).

## Tools

- `list-decisions` — list Keel decisions for an issue key.
- `record-decision` — create a decision (title + rationale required).
- `update-decision` — change status or text; requires `decisionId`.
- `delete-decision` — permanently remove a decision; requires `decisionId`.
- `get-ship-readiness` — readiness score, blockers, open decisions, graph risks.
- `get-work-context` — people, teams, goals, pull requests, deployments.
- `search-decisions` — search a Jira project by keyword or status.

## Rules

- Never invent decisions or readiness. Call a tool first.
- If `get-ship-readiness` returns `not-ready`, do not tell the user to ship.
- Pass `issueKey` explicitly when you are not inside a Jira issue screen.
