# Codegeist 2026 — Devpost submission draft (Keel)

Entrant name to use: **Wynnter**  
Hackathon: [Codegeist 2026](https://codegeist2026.devpost.com/)  
Official rules: https://codegeist2026.devpost.com/rules  
Deadline: Tuesday 22 December 2026, 12:00 Pacific Time = **Wednesday 23 December 2026, 04:00 Singapore time (UTC+8)**.  
Judging starts 5 January 2027.

This file is a draft. It is not submitted until someone creates a Devpost account as Wynnter, pastes these fields, attaches the public repo and YouTube link, and provides a Forge installation link.

## Official requirements (from the rules)

Required for an eligible submission:

- A Forge app in one main **category** (we use **Apps for Software Teams**).
- A **text description** of features and functionality, including how the project meets the Forge / Atlassian technology requirement.
- A **demonstration video**, in English:
  - should be **under 5 minutes** (judges are not required to watch beyond 5);
  - should include footage that shows the project functioning;
  - **must be uploaded to YouTube and made publicly visible** (YouTube is the only host named in the rules);
  - must not use third-party trademarks or copyrighted music without permission;
  - a link to that video goes on the Devpost form.
- A **public installation link** so judges can install the app on a site they administer. This is created in the [developer console → Distribution → start sharing your app](https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app). The Forge CLI **cannot** enable sharing or mint this link. Until that console step is done, the install-link field is a blocker.
- **Setup / testing instructions** for a judge's environment (see Install in the README).
- Select the **category** and any **bonus prizes**, plus a short write-up for each bonus.

The official rules do not require a public source repository, but a repo helps judges review the implementation. This project's source is at https://github.com/w1nter625/keel (mirror: https://codeberg.org/wynnter/keel).

Standard Devpost project form fields (Inspiration, What it does, How we built it, Challenges, Accomplishments, What we learned, What's next, Built with) should also be completed in English.

## Eligibility

The hackathon is open to individuals who are **at least the age of majority where they reside**, and to teams and organizations of such people. Singapore is **not** on the excluded-territory list (that list includes Brazil, Quebec, Russia, Belarus, Crimea, Cuba, Iran, North Korea, Syria, Sudan, Myanmar, and other OFAC-restricted places). Payouts, if awarded, go through Devpost (PayPal, Payoneer, or Wise) and may require a W-8BEN.

**Confirm before submitting:** under Singapore law the age of majority is 21. If the entrant is not yet 21, do not submit as an individual until that requirement is satisfied or Devpost/Atlassian confirm another valid path.

## Links to paste

| Field | Value |
| --- | --- |
| Project name | Keel |
| Tagline | Record the why. Ship with confidence. |
| Repo | https://github.com/w1nter625/keel (mirror: https://codeberg.org/wynnter/keel) |
| Demo video | *YouTube public URL, once the file at `video/keel-demo.mp4` is uploaded* |
| Installation link | *Not available from the CLI. Enable Sharing in the developer console Distribution page for app `ari:cloud:ecosystem::app/6d480529-4bd1-412e-92c2-1bf5cd27b8b0`, copy the install link, and paste it here.* |
| Category | Apps for Software Teams |
| Bonus prizes | Best Agents — Rovo / Assignable agents; Best app with Atlassian MCP; Best apps with Teamwork Graph integration |

Marketplace listing is **not** claimed in this submission (that bonus needs a Marketplace listing or review ticket).

---

## Project name

Keel

## Tagline (typically ~12–16 words; keep short)

Record the why behind Jira work, then say honestly whether a team can ship.

## Inspiration

Software teams do not usually stall because Jira is missing a status. They stall — or they ship with false confidence — because the *why* never made it onto the work item. The payment-provider decision lived in a meeting. The PCI review is still open, but the ticket is already In Review. An AI assistant is happy to say "looks good" if you only show it the fields.

Codegeist 2026's brief is "Build with context. Ship with confidence." Keel is a small product for that gap: keep the decision next to the work, then combine it with Jira blockers and Teamwork Graph context so a team, a Rovo agent, or a coding agent can ask "can we ship?" and get an honest answer.

## What it does

Keel is a Forge app installed on Jira.

- On every work item, an issue panel lists decision records (title, why, alternatives, status, owner) and a **ship-readiness** score. You can add, edit, accept, or delete a decision without leaving the issue.
- A **Keel decisions** project page lists every recorded decision in the project, including ones still proposed.
- A **Rovo agent** named Keel answers "Is this ready to ship?", "Why did we decide this?", and "Who should I ask?" It calls the same actions the UI uses. It does not invent a yes.
- The same actions are exposed as a **Forge MCP** server (`rovo:mcp`), with an open `mcp-skill/SKILL.md` so a coding agent can ask what was decided before it changes checkout code.
- **Teamwork Graph** (curated queries only) adds goals, teams, comments, linked pull requests, and deployments to the score. If the graph is empty, Keel still scores from decisions, blockers, and sub-tasks.

In the demo, SHOP-1 (Checkout redesign) is In Review, blocked by an open PCI review, and has an accepted feature-flag decision plus a payment-provider decision. Keel keeps the score honest until the blocker is gone.

## How we built it

Keel runs entirely on Forge (runtime `nodejs24.x`, UI Kit 2, `storage:app`). There is no remote backend, which keeps the app eligible for Runs on Atlassian.

- `manifest.yml` declares a `jira:issuePanel`, a `jira:projectPage`, a `rovo:agent`, `rovo:mcp`, and seven actions.
- Resolvers and action handlers share `src/lib/decisions.js` (Forge KVS), `src/lib/jira.js` (product fetch via the `route` tagged template), `src/lib/graph.js` (curated Teamwork Graph queries), and `src/lib/readiness.js` (a pure, unit-tested scoring function).
- Jira REST paths are built with `route\`/rest/api/3/issue/${key}?${query}\`` so Forge will not reject them as path manipulation.
- The Rovo prompt lives in `prompts/keel-agent.md`. MCP guidance for third-party agents lives in `mcp-skill/SKILL.md`.

## Challenges we ran into

Forge's product-fetch API requires the `route` tagged template. Passing a pre-built path string, even wrapped in `route`, is rejected as a path-manipulation attempt, and the issue panel failed to load until that was fixed. Teamwork Graph on a fresh demo site often has no connectors, so the UI and the agent have to treat empty graph data as a normal gap rather than an error. Development-environment installs were also easy to miss in Jira's Apps menu and in Admin "Connected apps", so the entry is deployed and installed from **production**. Decision records live in Forge KVS, which cannot be seeded from Jira REST, so the demo decisions are created in the panel itself.

## Accomplishments that we're proud of

A working product on a real Jira site, not a mock: the issue panel, the project page, and the Rovo agent all read and write the same decision store. The readiness score is willing to stay "not ready" or "at risk" after a decision is recorded, because an open PCI blocker still matters. The same seven tools are available to a person in the panel, to Rovo, and to an MCP client.

## What we learned

Context for shipping is a product problem, not just a prompt problem. If the why is not stored next to the work, every assistant will improvise. We also learned the practical Forge constraints that decide whether a demo works: `route` for product fetch, production versus development installs, curated Graph queries only, and the difference between "the CLI says installed" and "a human can see the panel."

## What's next

Enable **Sharing** in the developer console so judges get an installation link. Optionally submit a Marketplace listing (the fourth bonus category). If an admin enables external MCP, show a coding agent asking Keel about payments before it touches checkout code. Longer term: notify a team when readiness changes, and connect more Graph sources (PRs and deployments) on sites that have them.

## Built with

- Atlassian Forge
- Atlassian Jira
- Atlassian Rovo (`rovo:agent`, `rovo:mcp`)
- Atlassian Teamwork Graph
- Forge UI Kit
- Forge KVS
- Node.js
- JavaScript
- React

## Bonus prize write-ups

### Best Agents — Rovo / Assignable agents

Keel ships a `rovo:agent` named Keel, with a dedicated prompt, conversation starters, and seven actions (`list-decisions`, `record-decision`, `update-decision`, `delete-decision`, `get-ship-readiness`, `get-work-context`, `search-decisions`). In the demo the agent answers whether SHOP-1 can ship and quotes the recorded payment rationale. It is instructed not to invent decisions or a go-live.

### Best app with Atlassian MCP

The same actions are declared on a `rovo:mcp` module, so they can be exposed through the Atlassian MCP server. An open skill file at `mcp-skill/SKILL.md` tells a third-party coding agent how to call those tools and not to invent a why. Admins enable the connection per site; the endpoint form is `https://mcp.atlassian.com/forge/<appId>`.

### Best apps with Teamwork Graph integration

Keel **consumes** Teamwork Graph through curated queries (`jiraWorkItemGoals`, `jiraWorkItemComments`, `jiraWorkItemLinkedExternalPullRequests`, `jiraWorkItemLinkedExternalDeployments`, `atlassianUserInTeams`) and folds that context into `get-ship-readiness` and `get-work-context`. Raw `cypherQuery` is not used. Empty graph results do not fail the panel.

## Judge setup (paste into the instructions field)

1. Open the installation link (once Sharing is enabled) and install Keel on a Jira Cloud site you administer. Accept the requested scopes.
2. Or clone https://github.com/w1nter625/keel, run `npm install`, `forge login`, `forge deploy -e production`, and `forge install -e production --site YOUR-SITE.atlassian.net --product Jira`.
3. Create or open a work item. Use **View app actions** (Apps grid) and select **Keel**. The panel is not a permanently visible sidebar.
4. In Rovo Chat, open the agent selector → Browse Agents → enable **Keel**.
5. Optional: record a decision (title + why), then ask the Keel agent: "Is this work item ready to ship?"
6. Optional: open the project's **Keel decisions** tab.

Suggested demo data is in `scripts/seed-demo.md`.

## Still blocked before clicking Submit

1. Upload `video/keel-demo.mp4` to YouTube as a **public** video (required host) and paste the URL.
2. In the developer console, enable Distribution **Sharing** and paste the installation link.
3. Confirm eligibility (age of majority in the country of residence).
4. Create or log in to a Devpost account as Wynnter and enter the submission before 23 December 2026, 04:00 Singapore time.
