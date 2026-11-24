import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Heading,
  Inline,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import { invoke } from "@forge/bridge";

const STATUS_APPEARANCE = {
  proposed: "inprogress",
  accepted: "success",
  rejected: "removed",
  superseded: "default",
};

const ProjectPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke("getProjectData");
        if (!result?.ok) {
          setError(result?.message || "Could not load project decisions.");
        } else {
          setData(result);
        }
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner size="medium" />
        <Text>Loading project decisions…</Text>
      </Inline>
    );
  }

  if (error) {
    return <SectionMessage appearance="error" title="Keel could not load">{error}</SectionMessage>;
  }

  const openCount = data.decisions.filter((d) => d.status === "proposed").length;

  return (
    <Stack space="space.200">
      <Heading size="large">Keel decisions · {data.projectKey}</Heading>
      <Text>
        {data.decisions.length} recorded decision{data.decisions.length === 1 ? "" : "s"}, {openCount} still proposed.
      </Text>
      {data.decisions.length === 0 ? (
        <SectionMessage appearance="information" title="No decisions in this project">
          Open a work item and use the Keel issue panel, the Keel Rovo agent, or the Keel MCP tools to record the first why.
        </SectionMessage>
      ) : (
        <Stack space="space.150">
          {data.decisions.map((decision) => (
            <Stack key={decision.id} space="space.050">
              <Inline space="space.100" alignBlock="center">
                <Lozenge appearance={STATUS_APPEARANCE[decision.status] || "default"}>{decision.status}</Lozenge>
                <Text>
                  {decision.issueKey}: {decision.title}
                </Text>
              </Inline>
              {decision.rationale ? <Text>Why: {decision.rationale}</Text> : null}
              {decision.owner ? <Text>Owner: {decision.owner}</Text> : null}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <ProjectPage />
  </React.StrictMode>
);
