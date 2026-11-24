#!/usr/bin/env python3
"""Create the Shopfront demo issues on a Jira Cloud site.

Auth is taken from the environment (never hard-code secrets):
  JIRA_BASE, JIRA_EMAIL, JIRA_API_TOKEN
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ["JIRA_BASE"].rstrip("/")
EMAIL = os.environ["JIRA_EMAIL"]
TOKEN = os.environ["JIRA_API_TOKEN"]
LEAD = os.environ.get("JIRA_ACCOUNT_ID", "")

AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()


def request(method: str, path: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Basic {AUTH}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw.decode()) if raw else None)
    except urllib.error.HTTPError as exc:
        err = exc.read().decode()
        try:
            parsed = json.loads(err)
        except json.JSONDecodeError:
            parsed = err
        return exc.code, parsed


def die(msg: str, detail=None):
    print(msg, file=sys.stderr)
    if detail is not None:
        print(json.dumps(detail, indent=2)[:2000] if not isinstance(detail, str) else detail[:2000], file=sys.stderr)
    sys.exit(1)


def ensure_project():
    status, data = request("GET", "/rest/api/3/project/SHOP")
    if status == 200:
        print(f"Project SHOP already exists: {data.get('name')} ({data.get('style')})")
        return data
    templates = [
        "com.pyxis.greenhopper.jira:gh-simplified-agility-kanban",
        "com.pyxis.greenhopper.jira:gh-simplified-kanban-classic",
        "com.pyxis.greenhopper.jira:gh-simplified-scrum-classic",
        "com.pyxis.greenhopper.jira:gh-simplified-agility-scrum",
    ]
    last = None
    for template in templates:
        body = {
            "key": "SHOP",
            "name": "Shopfront",
            "projectTypeKey": "software",
            "projectTemplateKey": template,
            "leadAccountId": LEAD,
            "assigneeType": "PROJECT_LEAD",
        }
        status, data = request("POST", "/rest/api/3/project", body)
        if status in (200, 201):
            print(f"Created project SHOP with template {template}")
            time.sleep(2)
            return data
        last = (status, data, template)
        # if the key is taken / already created, refetch
        if status in (400, 409) and isinstance(data, dict):
            text = json.dumps(data).lower()
            if "already exists" in text or "project with that key" in text:
                st, existing = request("GET", "/rest/api/3/project/SHOP")
                if st == 200:
                    print("Project SHOP already exists (create reported conflict).")
                    return existing
    die("Could not create project SHOP", last)


def issue_types(project_key: str):
    status, data = request("GET", f"/rest/api/3/issue/createmeta/{project_key}/issuetypes")
    if status != 200:
        # fallback older endpoint
        st, meta = request("GET", f"/rest/api/3/issue/createmeta?projectKeys={project_key}&expand=projects.issuetypes")
        if st != 200:
            die("Could not load issue types", data)
        projects = meta.get("projects") or []
        types = projects[0].get("issuetypes") if projects else []
        return types
    return data.get("values") or data.get("issueTypes") or []


def type_id(types, *names, subtask=None):
    wanted = {n.lower() for n in names}
    for t in types:
        if subtask is not None and bool(t.get("subtask")) != subtask:
            continue
        if (t.get("name") or "").lower() in wanted:
            return t.get("id"), t.get("name")
    return None, None


def create_issue(fields: dict):
    status, data = request("POST", "/rest/api/3/issue", {"fields": fields})
    if status not in (200, 201):
        die(f"Could not create issue {fields.get('summary')}", data)
    print(f"Created {data['key']}: {fields['summary']}")
    return data


def adf(text: str):
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }


def transition_to(issue_key: str, wanted: list[str]):
    wanted_l = [w.lower() for w in wanted]
    status, data = request("GET", f"/rest/api/3/issue/{issue_key}/transitions")
    if status != 200:
        die(f"Could not list transitions for {issue_key}", data)
    transitions = data.get("transitions") or []
    names = [f"{t.get('name')} -> {t.get('to',{}).get('name')}" for t in transitions]
    match = None
    for t in transitions:
        target = (t.get("to") or {}).get("name") or t.get("name") or ""
        if target.lower() in wanted_l:
            match = t
            break
    if not match:
        print(f"No transition to {wanted} for {issue_key}. Available: {names}")
        return False
    st, result = request("POST", f"/rest/api/3/issue/{issue_key}/transitions", {"transition": {"id": match["id"]}})
    if st not in (204, 200, 201):
        die(f"Failed to transition {issue_key} to {match['name']}", result)
    print(f"Transitioned {issue_key} via '{match.get('name')}' to '{(match.get('to') or {}).get('name')}'")
    return True


def already_seeded():
    status, data = request(
        "GET",
        "/rest/api/3/search/jql?jql=project=SHOP%20AND%20summary~%22Checkout%20redesign%22&fields=summary,status,issuelinks,subtasks",
    )
    if status != 200:
        # try deprecated search
        status, data = request(
            "GET",
            "/rest/api/3/search?jql=project=SHOP%20AND%20summary~%22Checkout%20redesign%22&fields=summary,status,issuelinks,subtasks",
        )
    if status == 200 and isinstance(data, dict) and (data.get("issues") or data.get("values")):
        issues = data.get("issues") or data.get("values")
        print("Checkout redesign already exists:")
        for issue in issues:
            fields = issue.get("fields") or {}
            print(f"  {issue.get('key')} [{(fields.get('status') or {}).get('name')}] {fields.get('summary')}")
        return issues
    return []


def main():
    if not LEAD:
        die("JIRA_ACCOUNT_ID is required")
    project = ensure_project()
    key = project.get("key") or "SHOP"
    types = issue_types(key)
    print("Issue types:", ", ".join(f"{t.get('name')}(subtask={t.get('subtask')})" for t in types))
    story_id, story_name = type_id(types, "Story", "Task", subtask=False)
    task_id, task_name = type_id(types, "Task", "Story", subtask=False)
    sub_id, sub_name = type_id(types, "Sub-task", "Subtask", subtask=True)
    if not story_id or not task_id:
        die("Project is missing Story/Task issue types", types)
    existing = already_seeded()
    if existing:
        return

    checkout = create_issue(
        {
            "project": {"key": key},
            "summary": "Checkout redesign",
            "issuetype": {"id": story_id},
            "assignee": {"accountId": LEAD},
            "description": adf(
                "Replace the current checkout with a clearer, faster flow before Friday's launch."
            ),
        }
    )
    pci = create_issue(
        {
            "project": {"key": key},
            "summary": "PCI review for payment provider",
            "issuetype": {"id": task_id},
            "assignee": {"accountId": LEAD},
            "description": adf("Finish the PCI review required before the checkout redesign can ship."),
        }
    )
    fields = {
        "project": {"key": key},
        "summary": "Write checkout analytics events",
        "issuetype": {"id": sub_id or task_id},
        "assignee": {"accountId": LEAD},
        "description": adf("Add analytics events for the new checkout so we can compare conversion."),
    }
    if sub_id:
        fields["parent"] = {"key": checkout["key"]}
    analytics = create_issue(fields)

    st, link = request(
        "POST",
        "/rest/api/3/issueLink",
        {
            "type": {"name": "Blocks"},
            "inwardIssue": {"key": checkout["key"]},
            "outwardIssue": {"key": pci["key"]},
        },
    )
    if st not in (201, 200, 204):
        # try alternative orientation
        st2, link2 = request(
            "POST",
            "/rest/api/3/issueLink",
            {
                "type": {"name": "Blocks"},
                "inwardIssue": {"key": pci["key"]},
                "outwardIssue": {"key": checkout["key"]},
            },
        )
        if st2 not in (201, 200, 204):
            die("Could not link blocker", {"first": (st, link), "second": (st2, link2)})
        print(f"Linked {pci['key']} blocks {checkout['key']} (alternate orientation)")
    else:
        print(f"Linked {checkout['key']} is blocked by {pci['key']}")

    transition_to(pci["key"], ["In Progress"])
    # Try In Review first. Some workflows require a stop in In Progress first.
    if not transition_to(checkout["key"], ["In Review", "In review", "Review", "In QA", "QA", "Peer Review"]):
        if transition_to(checkout["key"], ["In Progress"]):
            transition_to(checkout["key"], ["In Review", "In review", "Review", "In QA", "QA", "Peer Review"])
        else:
            print("Left checkout in its default status.")

    print("\nSeed complete:")
    print(f"  Checkout story:   {checkout['key']}  {BASE}/browse/{checkout['key']}")
    print(f"  PCI blocker:      {pci['key']}  {BASE}/browse/{pci['key']}")
    print(f"  Analytics child:  {analytics['key']}  {BASE}/browse/{analytics['key']}")
    print("Record the two Keel decisions in the issue panel or Rovo agent during the demo.")


if __name__ == "__main__":
    main()
