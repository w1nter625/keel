import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterDecisions, formatDecisionList } from "./format.js";

describe("filterDecisions", () => {
  const decisions = [
    { id: "1", title: "Use Stripe Checkout", status: "accepted", rationale: "Faster PCI path", issueKey: "SHOP-100" },
    { id: "2", title: "Feature flag the new cart", status: "proposed", rationale: "Safer rollout", issueKey: "SHOP-100" },
  ];

  it("filters by status", () => {
    const result = filterDecisions(decisions, { status: "proposed" });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "2");
  });

  it("filters by keyword", () => {
    const result = filterDecisions(decisions, { query: "pci" });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "1");
  });
});

describe("formatDecisionList", () => {
  it("explains an empty list", () => {
    assert.match(formatDecisionList([]), /No matching decisions/);
  });
});
