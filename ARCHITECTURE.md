# Keel architecture

## Why this shape

Codegeist 2026 scores a working product, not a thin wrapper around one API. Keel is therefore a small system with one job: keep the *why* next to the work, then use Jira + Teamwork Graph to say whether shipping is honest.

The same decision store is shared by the issue panel, the project page, the Rovo agent, and the MCP tools. Judges can click the UI, ask the agent, or call a tool and see the same records.

## Runtime

```
                    ┌──────────────────┐
                    │  Jira issue      │
                    │  (Keel panel)    │  UI Kit → resolver
                    └────────┬─────────┘
                             │
┌─────────────┐   invoke     │      Rovo / MCP actions
│ Rovo agent  ├──────────────┼──────────────────────────┐
│ Keel MCP    │              ▼                          ▼
└─────────────┘     src/index.js resolver      src/actions/handlers.js
                             │                          │
                             └────────────┬─────────────┘
                                          ▼
                          ┌─────────────────────────────┐
                          │  src/lib/decisions.js (KVS) │
                          │  src/lib/jira.js            │
                          │  src/lib/graph.js           │
                          │  src/lib/readiness.js       │
                          └─────────────────────────────┘
```

## Decision storage

Decision records live in the Forge key-value store (`storage:app`) so they stay in the Atlassian cloud and do not require a remote backend.

- Record: `dec:{issueKey}:{id}`
- Issue index: `dec-index:{issueKey}`
- Project index: `dec-proj:{projectKey}`

Statuses: `proposed`, `accepted`, `rejected`, `superseded`.

## Ship-readiness

`scoreReadiness` is a pure function (see `src/lib/readiness.js` and its tests).

| Signal | Source | Effect |
| --- | --- | --- |
| Proposed decisions | Keel store | Blocker → **Not ready** |
| "Is blocked by" links that are not done | Jira REST | Blocker → **Not ready** |
| Open sub-tasks | Jira REST | Risk → **At risk** |
| Linked goal at risk | Teamwork Graph | Risk → **At risk** |
| In review, no linked PR | Teamwork Graph | Risk → **At risk** |
| No decisions at all | Keel store | Note only |

Headline status is `ready`, `at-risk`, or `not-ready`, with a 0–100 score.

## Teamwork Graph

Jira REST calls must use `route`/rest/api/3/issue/${key}?${query}` from `@forge/api` (never a pre-built path string). Backend graph calls use `api.asUser().requestTeamworkGraph` and **curated queries** only (`jiraWorkItemGoals`, `jiraWorkItemComments`, `jiraWorkItemLinkedExternalPullRequests`, `jiraWorkItemLinkedExternalDeployments`, `atlassianUserInTeams`). Raw `cypherQuery` is not available to new apps.

ARIs:

- Issue: `ari:cloud:jira:{cloudId}:issue/{issueId}`
- User: `ari:cloud:identity::user/{accountId}`

Declared scopes include graph types for issues, comments, users, teams, goals, external pull requests, and external deployments. Official Graph behaviour: a missing or ungranted scope omits data; it should not fail the whole request. The UI and the agent must tolerate empty graph results (a fresh Codegeist site may have no connectors).

## Rovo and MCP

- `rovo:agent` named Keel, prompt in `prompts/keel-agent.md`.
- Six `action` modules, reused by the agent and by `rovo:mcp`.
- `app.rovo` metadata (`tag: keel`, description, keywords) is required for `rovo:mcp` from 5 January 2027, which is also when judging starts. It is already in `manifest.yml`.
- MCP endpoint after install: `https://mcp.atlassian.com/forge/<appId>`. External exposure is off until a site admin enables it.

## App id

`app.id` is `ari:cloud:ecosystem::app/6d480529-4bd1-412e-92c2-1bf5cd27b8b0`. Production 2.1.0 is deployed and installed on https://one-atlas-dtoi.atlassian.net (Jira). Development 2.1.0 is deployed but was uninstalled from the site so the UI shows Keel, not Keel (development).

## What still needs a live site

- Replacing `app.id`
- Deploy and install (`forge deploy`, `forge install --demo-site`)
- Confirming Graph field names against the live schema / playground if a curated query returns errors
- Seeding the SHOP demo issues (`scripts/seed-demo.md`)
- Recording the demo video (`DEMO_SCRIPT.md`)
