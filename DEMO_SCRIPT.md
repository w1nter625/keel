# Keel demo script (under 5 minutes)

Record in English, on YouTube, public, no copyrighted music. Stay under 5 minutes; judges may only watch the first 5. Speak as the builder (Wynnter). Show the product working, not slides.

Suggested length: about 4 minutes 15 seconds.

## 0:00–0:25 — The problem

On camera: Jira issue `SHOP-1` Checkout redesign, status **In Review**.

Script:

> "This ticket looks almost done. In Review, assigned, launch on Friday. Jira cannot tell you whether the team actually agreed on a payment provider, or that PCI review is still blocking the ship. That missing why is how teams ship with false confidence. This is Keel."

## 0:25–1:20 — The panel tells the truth

Open the Keel issue panel on SHOP-1.

Point to the readiness lozenge (**Not ready to ship**) and the reasons: a proposed decision, blocker SHOP-2, an open sub-task, and (if present) no linked pull request.

Script:

> "Keel scores ship-readiness from three places: decisions the team recorded, Jira blockers and sub-tasks, and Teamwork Graph context such as goals and pull requests. SHOP-1 is not ready. The payment decision is still only proposed, and PCI review is still open."

## 1:20–2:10 — Record and accept the why

In the panel, if the Stripe decision is still proposed, click **Accept decision**. If you are starting clean, first save "Use Stripe Payment Element" as proposed, then accept it. Refresh. The open-decision blocker should disappear. Other risks remain.

Script:

> "I am accepting the decision to use Stripe Checkout, because it gets us to PCI SAQ-A faster than an in-house card form. Keel stores that why on the work item itself. The readiness score improves, but Keel still will not pretend we can ship — PCI review is blocking us."

## 2:10–3:20 — Ask the Rovo agent

Open Rovo Chat, choose the Keel agent, on SHOP-1.

Ask: **Is SHOP-1 ready to ship?**

The agent should call Get ship readiness and say not ready, naming SHOP-2.

Then ask: **Why did we decide the payment provider?**

The agent should call List decisions and quote the Stripe rationale.

Script:

> "The same records are available to Rovo. Keel does not invent a yes. It reads the decision store and the graph, then tells me what is still blocking the ship, and why we chose Stripe."

## 3:20–4:00 — MCP / project view

Switch to the project page **Keel decisions** and show both decisions in SHOP, including the accepted Stripe record.

If external MCP was enabled, cut to a coding agent and ask: **What was decided about payments on SHOP-1?** Otherwise say:

> "The same six actions are also exposed as a Forge MCP server, so a coding agent can ask what was decided before it changes checkout code. Admins enable that per site at mcp.atlassian.com/forge, using this app's id."

## 4:00–4:15 — Close

> "Keel keeps the why next to the work, and only calls a change ready when the context agrees. That is how software teams ship with confidence. I am Wynnter, and this is Keel."

## Shot checklist

- SHOP-1 in Jira, In Review
- Keel panel with a clear Not ready (or At risk) state
- Accepting or saving a decision, then an updated score
- Rovo agent answering two questions with visible tool use if the UI shows it
- Project page or MCP mention
- No unfinished forms, no placeholder `app.id`, no errors overlaid at the end
