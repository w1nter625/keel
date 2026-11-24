/**
 * Issue keys interpolated into Forge `route` must not be pre-encoded and
 * must not contain path or query fragments. The `route` tag encodes values.
 */
const UNSAFE = ["..", ".%2e", "%2e.", "%2e%2e", "/", "\\", "?", "#"];

export function assertSafeIssueKey(issueKey) {
  if (issueKey == null) return null;
  const key = String(issueKey).trim();
  if (!key) return null;
  const lower = key.toLowerCase();
  for (const needle of UNSAFE) {
    if (lower.includes(needle.toLowerCase())) {
      throw new Error(`Invalid issue key: contains a disallowed path or query fragment`);
    }
  }
  // Reject already-percent-encoded values so route() is the only encoder.
  if (key.includes("%")) {
    throw new Error("Invalid issue key: do not pre-encode values passed to route()");
  }
  return key;
}
