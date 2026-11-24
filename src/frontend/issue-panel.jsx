import React, { useCallback, useEffect, useState } from "react";
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Label,
  Text,
  TextArea,
  Textfield,
} from "@forge/react";
import { invoke } from "@forge/bridge";

const STATUS_OPTIONS = [
  { label: "Proposed", value: "proposed" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Superseded", value: "superseded" },
];

const STATUS_APPEARANCE = {
  proposed: "inprogress",
  accepted: "success",
  rejected: "removed",
  superseded: "default",
};

const READINESS_APPEARANCE = {
  ready: "success",
  "at-risk": "moved",
  "not-ready": "removed",
};

const emptyForm = {
  title: "",
  rationale: "",
  alternatives: "",
  status: "proposed",
  owner: "",
};

const IssuePanel = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke("getPanelData");
      if (!result?.ok) {
        setError(result?.message || "Could not load Keel data.");
        setData(null);
      } else {
        setData(result);
        setForm((current) => ({
          ...current,
          owner: current.owner || result.user?.name || "",
        }));
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCreate = async () => {
    if (!form.title.trim() || !form.rationale.trim()) {
      setNotice({ type: "warning", text: "A decision needs a title and a why." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const result = await invoke("createDecision", form);
      if (!result?.ok) {
        setNotice({ type: "error", text: result?.message || "Could not save the decision." });
      } else {
        setForm({ ...emptyForm, owner: data?.user?.name || "" });
        setNotice({ type: "success", text: `Recorded “${result.decision.title}”.` });
        await refresh();
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message || String(err) });
    } finally {
      setSaving(false);
    }
  };

  const onAccept = async (decision) => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await invoke("updateDecision", {
        issueKey: decision.issueKey,
        decisionId: decision.id,
        status: "accepted",
      });
      if (!result?.ok) {
        setNotice({ type: "error", text: result?.message || "Could not update the decision." });
      } else {
        await refresh();
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message || String(err) });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (decision) => {
    setConfirmDeleteId(null);
    setEditingId(decision.id);
    setEditForm({
      title: decision.title || "",
      rationale: decision.rationale || "",
      alternatives: decision.alternatives || "",
      status: decision.status || "proposed",
      owner: decision.owner || "",
    });
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const onSaveEdit = async (decision) => {
    if (!editForm.title.trim() || !editForm.rationale.trim()) {
      setNotice({ type: "warning", text: "A decision needs a title and a why." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const result = await invoke("updateDecision", {
        issueKey: decision.issueKey,
        decisionId: decision.id,
        title: editForm.title,
        rationale: editForm.rationale,
        alternatives: editForm.alternatives,
        status: editForm.status,
        owner: editForm.owner,
      });
      if (!result?.ok) {
        setNotice({ type: "error", text: result?.message || "Could not update the decision." });
      } else {
        setEditingId(null);
        setNotice({ type: "success", text: `Updated “${result.decision.title}”.` });
        await refresh();
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message || String(err) });
    } finally {
      setSaving(false);
    }
  };

  const onConfirmDelete = async (decision) => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await invoke("deleteDecision", {
        issueKey: decision.issueKey,
        decisionId: decision.id,
      });
      if (!result?.ok) {
        setNotice({ type: "error", text: result?.message || "Could not delete the decision." });
      } else {
        setConfirmDeleteId(null);
        if (editingId === decision.id) setEditingId(null);
        setNotice({ type: "success", text: `Deleted “${decision.title}”.` });
        await refresh();
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message || String(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack space="space.200">
        <Inline space="space.100" alignBlock="center">
          <Spinner size="medium" />
          <Text>Loading ship context…</Text>
        </Inline>
      </Stack>
    );
  }

  if (error) {
    return <SectionMessage appearance="error" title="Keel could not load">{error}</SectionMessage>;
  }

  const readiness = data.readiness;
  const issue = data.issue;
  const graph = data.graph || {};
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];

  return (
    <Stack space="space.200">
      {warnings.length > 0 && (
        <SectionMessage appearance="warning" title="Some context is missing">
          <Text>{warnings.join(" ")}</Text>
        </SectionMessage>
      )}
      <Stack space="space.050">
        <Inline space="space.100" alignBlock="center">
          <Heading size="medium">Ship readiness</Heading>
          <Lozenge appearance={READINESS_APPEARANCE[readiness.status] || "default"} isBold>
            {readiness.label}
          </Lozenge>
          <Text>Score {readiness.score}/100</Text>
        </Inline>
        <Text>
          {issue.key}: {issue.summary} · {issue.statusName}
          {issue.assignee?.name ? ` · ${issue.assignee.name}` : ""}
        </Text>
      </Stack>

      {readiness.reasons.length === 0 ? (
        <SectionMessage appearance="success" title="No open risks">
          Keel did not find open decisions, blockers, or graph risks on this work item.
        </SectionMessage>
      ) : (
        <SectionMessage
          appearance={readiness.status === "not-ready" ? "error" : readiness.status === "at-risk" ? "warning" : "information"}
          title={readiness.status === "not-ready" ? "Do not ship yet" : "Check these before you ship"}
        >
          <Stack space="space.050">
            {readiness.reasons.map((reason) => (
              <Text key={reason.code + reason.text}>
                {reason.severity === "block" ? "Blocker" : reason.severity === "risk" ? "Risk" : "Note"}: {reason.text}
              </Text>
            ))}
          </Stack>
        </SectionMessage>
      )}

      <Box>
        <Text>
          Teamwork Graph: {graph.goals?.length || 0} goals, {graph.teams?.length || 0} teams,{" "}
          {graph.pullRequests?.length || 0} pull requests, {graph.deployments?.length || 0} deployments
          {graph.errors?.length ? ` · ${graph.errors.length} graph warning(s)` : ""}.
        </Text>
      </Box>

      <Heading size="small">Decisions on this work item</Heading>
      {notice ? (
        <SectionMessage appearance={notice.type === "success" ? "success" : notice.type === "warning" ? "warning" : "error"}>
          {notice.text}
        </SectionMessage>
      ) : null}
      {data.decisions.length === 0 ? (
        <Text>No decisions recorded yet. Capture the why before the team ships.</Text>
      ) : (
        <Stack space="space.150">
          {data.decisions.map((decision) => (
            <Stack key={decision.id} space="space.050">
              {editingId === decision.id ? (
                <Stack space="space.100">
                  <Text>Edit decision</Text>
                  <Label labelFor={`keel-edit-title-${decision.id}`}>Title</Label>
                  <Textfield
                    id={`keel-edit-title-${decision.id}`}
                    name={`edit-title-${decision.id}`}
                    value={editForm.title}
                    onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                  />
                  <Label labelFor={`keel-edit-rationale-${decision.id}`}>Why</Label>
                  <TextArea
                    id={`keel-edit-rationale-${decision.id}`}
                    name={`edit-rationale-${decision.id}`}
                    value={editForm.rationale}
                    onChange={(event) => setEditForm({ ...editForm, rationale: event.target.value })}
                  />
                  <Label labelFor={`keel-edit-alternatives-${decision.id}`}>Alternatives considered</Label>
                  <TextArea
                    id={`keel-edit-alternatives-${decision.id}`}
                    name={`edit-alternatives-${decision.id}`}
                    value={editForm.alternatives}
                    onChange={(event) => setEditForm({ ...editForm, alternatives: event.target.value })}
                  />
                  <Label labelFor={`keel-edit-status-${decision.id}`}>Status</Label>
                  <Select
                    inputId={`keel-edit-status-${decision.id}`}
                    name={`edit-status-${decision.id}`}
                    options={STATUS_OPTIONS}
                    value={STATUS_OPTIONS.find((option) => option.value === editForm.status)}
                    onChange={(option) => setEditForm({ ...editForm, status: option.value })}
                  />
                  <Inline space="space.100">
                    <Button appearance="primary" onClick={() => onSaveEdit(decision)} isDisabled={saving}>
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                    <Button appearance="subtle" onClick={cancelEdit} isDisabled={saving}>
                      Cancel
                    </Button>
                  </Inline>
                </Stack>
              ) : (
                <Stack space="space.050">
                  <Inline space="space.100" alignBlock="center">
                    <Lozenge appearance={STATUS_APPEARANCE[decision.status] || "default"}>{decision.status}</Lozenge>
                    <Text>{decision.title}</Text>
                  </Inline>
                  {decision.rationale ? <Text>Why: {decision.rationale}</Text> : null}
                  {decision.alternatives ? <Text>Alternatives: {decision.alternatives}</Text> : null}
                  <Text>
                    {decision.owner ? `Owner: ${decision.owner} · ` : ""}
                    Updated {new Date(decision.updatedAt).toLocaleString()}
                  </Text>
                  {confirmDeleteId === decision.id ? (
                    <Stack space="space.050">
                      <SectionMessage appearance="warning" title="Delete this decision?">
                        This cannot be undone.
                      </SectionMessage>
                      <Inline space="space.100">
                        <Button appearance="danger" onClick={() => onConfirmDelete(decision)} isDisabled={saving}>
                          {saving ? "Deleting…" : "Confirm delete"}
                        </Button>
                        <Button appearance="subtle" onClick={() => setConfirmDeleteId(null)} isDisabled={saving}>
                          Cancel
                        </Button>
                      </Inline>
                    </Stack>
                  ) : (
                    <Inline space="space.100">
                      {decision.status === "proposed" ? (
                        <Button appearance="primary" onClick={() => onAccept(decision)} isDisabled={saving}>
                          Accept decision
                        </Button>
                      ) : null}
                      <Button appearance="subtle" onClick={() => startEdit(decision)} isDisabled={saving}>
                        Edit
                      </Button>
                      <Button
                        appearance="subtle"
                        onClick={() => {
                          setEditingId(null);
                          setConfirmDeleteId(decision.id);
                          setNotice(null);
                        }}
                        isDisabled={saving}
                      >
                        Delete
                      </Button>
                    </Inline>
                  )}
                </Stack>
              )}
            </Stack>
          ))}
        </Stack>
      )}

      <Heading size="small">Record a decision</Heading>
      <Label labelFor="keel-title">Title</Label>
      <Textfield
        id="keel-title"
        name="title"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        placeholder="Use Stripe Payment Element"
      />
      <Label labelFor="keel-rationale">Why</Label>
      <TextArea
        id="keel-rationale"
        name="rationale"
        value={form.rationale}
        onChange={(event) => setForm({ ...form, rationale: event.target.value })}
        placeholder="The reason the team is choosing this option"
      />
      <Label labelFor="keel-alternatives">Alternatives considered</Label>
      <TextArea
        id="keel-alternatives"
        name="alternatives"
        value={form.alternatives}
        onChange={(event) => setForm({ ...form, alternatives: event.target.value })}
        placeholder="Optional. What else was considered?"
      />
      <Label labelFor="keel-status">Status</Label>
      <Select
        inputId="keel-status"
        name="status"
        options={STATUS_OPTIONS}
        value={STATUS_OPTIONS.find((option) => option.value === form.status)}
        onChange={(option) => setForm({ ...form, status: option.value })}
      />
      <Label labelFor="keel-owner">Owner</Label>
      <Textfield
        id="keel-owner"
        name="owner"
        value={form.owner}
        onChange={(event) => setForm({ ...form, owner: event.target.value })}
      />
      <Inline space="space.100">
        <Button appearance="primary" onClick={onCreate} isDisabled={saving}>
          {saving ? "Saving…" : "Save decision"}
        </Button>
        <Button appearance="subtle" onClick={refresh} isDisabled={loading || saving}>
          Refresh
        </Button>
      </Inline>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <IssuePanel />
  </React.StrictMode>
);
