import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDecisionPatch,
  withoutId,
  withoutProjectEntry,
  projectIndexEntry,
} from "./decisions.js";

const existing = {
  id: "abc",
  issueKey: "SHOP-1",
  issueId: "10001",
  projectKey: "SHOP",
  title: "Use Stripe Payment Element",
  rationale: "Reduces PC scope,upotsSGpamen ehos",
  alternatives: "",
  status: "accepted",
  owner: "Wynnter",
  createdAt: "2026-11-24T08:00:00.000Z",
  createdBy: "Wynnter",
  updatedAt: "2026-11-24T08:00:00.000Z",
  updatedBy: "Wynnter",
  supersededBy: null,
};

describe("applyDecisionPatch", () => {
  it("updates why, title, alternatives, and status without leaking payload keys", () => {
    const updated = applyDecisionPatch(
      existing,
      {
        decisionId: "should-not-be-copied",
        context: { foo: 1 },
        title: "  Use Stripe Payment Element  ",
        rationale: "Reduces PCI scope; supports SG payment methods (PayNow, GrabPay)",
        alternatives: "In-house card form",
        status: "accepted",
      },
      "editor"
    );
    assert.equal(updated.id, "abc");
    assert.equal(updated.issueKey, "SHOP-1");
    assert.equal(updated.createdAt, existing.createdAt);
    assert.equal(updated.title, "Use Stripe Payment Element");
    assert.equal(
      updated.rationale,
      "Reduces PCI scope; supports SG payment methods (PayNow, GrabPay)"
    );
    assert.equal(updated.alternatives, "In-house card form");
    assert.equal(updated.status, "accepted");
    assert.equal(updated.updatedBy, "editor");
    assert.equal(updated.decisionId, undefined);
    assert.equal(updated.context, undefined);
    assert.ok(updated.updatedAt >= existing.updatedAt);
  });

  it("keeps the existing title when the patch title is blank", () => {
    const updated = applyDecisionPatch(existing, { title: "   " }, "editor");
    assert.equal(updated.title, existing.title);
  });

  it("returns null when there is no record", () => {
    assert.equal(applyDecisionPatch(null, { title: "x" }), null);
  });
});

describe("index helpers for delete", () => {
  it("removes a decision id from the issue index", () => {
    assert.deepEqual(withoutId(["a", "abc", "b"], "abc"), ["a", "b"]);
  });

  it("removes the project index entry", () => {
    const entry = projectIndexEntry("SHOP-1", "abc");
    assert.equal(entry, "SHOP-1:abc");
    assert.deepEqual(withoutProjectEntry(["SHOP-1:abc", "SHOP-2:x"], "SHOP-1", "abc"), ["SHOP-2:x"]);
  });
});
