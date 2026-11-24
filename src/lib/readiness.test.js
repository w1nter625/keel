import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreReadiness, isDoneStatus } from "./readiness.js";

describe("isDoneStatus", () => {
  it("treats done category as done", () => {
    assert.equal(isDoneStatus({ statusCategory: "done" }), true);
  });
  it("treats in-progress as not done", () => {
    assert.equal(isDoneStatus({ statusName: "In Review", statusCategory: "indeterminate" }), false);
  });
});

describe("scoreReadiness", () => {
  it("is not ready when a decision is still proposed", () => {
    const result = scoreReadiness({
      decisions: [{ status: "proposed", title: "Use Stripe" }],
      issue: { statusName: "In Review" },
    });
    assert.equal(result.status, "not-ready");
    assert.ok(result.score <= 70);
    assert.ok(result.reasons.some((r) => r.code === "open-decisions"));
  });

  it("is not ready when blocked by an open issue", () => {
    const result = scoreReadiness({
      decisions: [{ status: "accepted", title: "Use Stripe" }],
      blockers: [{ key: "SHOP-88", summary: "PCI review", statusName: "In Progress", statusCategory: "indeterminate" }],
      issue: { statusName: "In Review" },
    });
    assert.equal(result.status, "not-ready");
    assert.ok(result.reasons.some((r) => r.code === "blockers"));
  });

  it("is at risk when in review with no pull request", () => {
    const result = scoreReadiness({
      decisions: [{ status: "accepted", title: "Use Stripe" }],
      issue: { statusName: "In Review", statusCategory: "indeterminate" },
      graph: { pullRequests: [] },
    });
    assert.equal(result.status, "at-risk");
    assert.ok(result.reasons.some((r) => r.code === "no-pr"));
  });

  it("is ready when decisions are accepted and nothing is blocked", () => {
    const result = scoreReadiness({
      decisions: [{ status: "accepted", title: "Use Stripe" }],
      issue: { statusName: "In Review", statusCategory: "indeterminate" },
      blockers: [{ key: "SHOP-1", statusName: "Done", statusCategory: "done" }],
      graph: { pullRequests: [{ id: "pr-1", name: "checkout" }] },
    });
    assert.equal(result.status, "ready");
    assert.equal(result.label, "Ready to ship");
    assert.ok(result.score >= 85);
  });
});
