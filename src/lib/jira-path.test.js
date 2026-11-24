import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeIssueKey } from "./jira-path.js";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\.(js|jsx|mjs)$/.test(name)) acc.push(path);
  }
  return acc;
}

describe("assertSafeIssueKey", () => {
  it("accepts a normal Jira key", () => {
    assert.equal(assertSafeIssueKey("SHOP-1"), "SHOP-1");
    assert.equal(assertSafeIssueKey("  abc_9-12  "), "abc_9-12");
  });

  it("returns null for empty values", () => {
    assert.equal(assertSafeIssueKey(""), null);
    assert.equal(assertSafeIssueKey(null), null);
  });

  it("rejects path or query fragments and pre-encoded values", () => {
    for (const bad of ["SHOP-1?fields=summary", "../issue", "PROJ/1", "SHOP-1#watch", "SHOP%2D1", "SHOP-1/../SHOP-2"]) {
      assert.throws(() => assertSafeIssueKey(bad), /Invalid issue key/);
    }
  });
});

describe("Forge product fetch routes", () => {
  const files = walk(srcRoot);
  const sources = files.map((path) => ({
    path: relative(srcRoot, path),
    text: readFileSync(path, "utf8"),
  }));

  it("does not pass a pre-built path string into route`", () => {
    const pattern = /route`\$\{[^}]+\}`/;
    const hits = sources
      .filter((file) => pattern.test(file.text))
      .map((file) => file.path);
    assert.deepEqual(hits, [], `route\`\${path}\` is a path manipulation. Offenders: ${hits.join(", ")}`);
  });

  it("calls requestJira/requestConfluence with a route` tagged template", () => {
    const call = /request(?:Jira|Confluence)\s*\(([^)]*)\)/g;
    const offenders = [];
    for (const file of sources) {
      let match;
      const text = file.text;
      const re = new RegExp(call);
      while ((match = re.exec(text))) {
        const inside = match[1].trim();
        if (!inside.startsWith("route`") && !inside.startsWith("routedPath") && inside !== "path") {
          // Allow a variable that is already a Route, as long as it is not a raw string concat.
          if (/^["'`]/.test(inside) || inside.includes("${") && !inside.startsWith("route")) {
            offenders.push(`${file.path}: ${match[0]}`);
          }
        }
      }
    }
    // requestJira(routedPath) in jiraGet is allowed; requestJira("/rest/...") is not.
    const hard = [];
    for (const file of sources) {
      if (/request(?:Jira|Confluence)\s*\(\s*["'`]/.test(file.text)) {
        hard.push(file.path);
      }
      if (/request(?:Jira|Confluence)\s*\(\s*`/.test(file.text) && !/request(?:Jira|Confluence)\s*\(\s*route`/.test(file.text)) {
        hard.push(file.path);
      }
    }
    assert.deepEqual(hard, [], `Product fetch must use route\`. Offenders: ${hard.join(", ")}`);
  });

  it("does not pre-encode path segments next to requestJira", () => {
    const hits = sources
      .filter((file) => /request(?:Jira|Confluence)/.test(file.text) && /encodeURIComponent/.test(file.text))
      .map((file) => file.path);
    const jira = sources.find((file) => file.path === "lib/jira.js");
    assert.ok(jira, "jira.js should exist");
    assert.equal(/encodeURIComponent/.test(jira.text), false, "jira.js must not pre-encode path values");
    assert.deepEqual(hits, [], `Do not pre-encode values passed to route(). Offenders: ${hits.join(", ")}`);
  });
});
