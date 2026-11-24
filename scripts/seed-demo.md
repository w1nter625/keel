# Demo data plan

Create a Jira project and three work items that make the ship-readiness score tell an honest story.

Suggested project: **SHOP** (Shopfront).

| Summary | Type | Status | Notes |
| --- | --- | --- | --- |
| Checkout redesign | Task or Story | In Review | The work item used in the demo (for example SHOP-1) |
| PCI review for payment provider | Task | In Progress | Blocks the checkout work item |
| Write checkout analytics events | Sub-task of checkout | To Do | Leaves an open sub-task risk |

## Re-run

```bash
export JIRA_BASE=https://your-site.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN          # Atlassian classic API token; never commit this
export JIRA_ACCOUNT_ID         # optional assignee account id
python3 scripts/seed-demo.py
```

The script is idempotent if a "Checkout redesign" issue already exists. Put the token in the environment only; never commit it and never paste it into this repo.

## Decisions to record during the demo

These live in Keel storage, not in Jira, so they are recorded in the issue panel or the Keel Rovo agent:

1. Title: `Use Stripe Payment Element`
   - Start as **Proposed**, then accept during the demo
   - Why: Reduces PCI scope; supports SG payment methods (PayNow, GrabPay).
   - Alternatives: In-house card form; Adyen.
2. Title: `Ship behind feature flag checkout_v2`
   - Status: **Accepted**
   - Why: Safe gradual rollout.

Forge KVS cannot be written from the Jira REST API or the Forge CLI (`forge storage` only covers local/custom entities).

## Graph data

Linked goals, pull requests, and deployments only appear if the site or a connector has that data. The ship-readiness score still works from decisions, blockers, and sub-tasks alone.
