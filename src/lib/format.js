import { normalizeStatus } from "./ids.js";

export function filterDecisions(decisions, { status, query } = {}) {
  let result = decisions;
  if (status) {
    const wanted = normalizeStatus(status, null);
    if (wanted) result = result.filter((d) => d.status === wanted);
  }
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    result = result.filter((d) =>
      [d.title, d.rationale, d.alternatives, d.owner, d.issueKey]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  return result;
}

export function formatDecisionList(decisions) {
  if (!decisions.length) return "No matching decisions were found.";
  return decisions
    .map((d) => {
      const bits = [
        `- [${d.status}] ${d.title} (id: ${d.id})`,
        d.issueKey ? `  Issue: ${d.issueKey}` : null,
        d.owner ? `  Owner: ${d.owner}` : null,
        d.rationale ? `  Why: ${d.rationale}` : null,
        d.alternatives ? `  Alternatives: ${d.alternatives}` : null,
      ];
      return bits.filter(Boolean).join("\n");
    })
    .join("\n");
}
