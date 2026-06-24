"""Cloud Function (gen2): billing kill-switch.

Triggered by a Pub/Sub message published by a Cloud Billing budget. When the
project's spend exceeds the budget amount, this DISABLES billing on the whole
project, which immediately stops Cloud Run (and everything else in the project)
from accruing further charges.

This is a hard backstop, not a precise real-time cap: Google's budget data
updates only a few times a day, so spend may slightly overshoot the threshold
before this fires. Re-enabling billing afterwards is a manual step in the
console.

Based on Google's documented pattern:
https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
"""

import base64
import json
import os

import functions_framework
from googleapiclient import discovery

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
PROJECT_NAME = f"projects/{PROJECT_ID}"


@functions_framework.cloud_event
def stop_billing(cloud_event):
    message = cloud_event.data["message"]
    raw = base64.b64decode(message["data"]).decode("utf-8")
    notification = json.loads(raw)

    cost_amount = notification.get("costAmount", 0)
    budget_amount = notification.get("budgetAmount", 0)
    print(f"Budget notification. cost: {cost_amount}, budget: {budget_amount}")

    if cost_amount <= budget_amount:
        print("Spend is within budget. No action taken.")
        return

    billing = discovery.build("cloudbilling", "v1", cache_discovery=False)
    projects = billing.projects()

    if not _is_billing_enabled(PROJECT_NAME, projects):
        print("Billing is already disabled. Nothing to do.")
        return

    _disable_billing(PROJECT_NAME, projects)


def _is_billing_enabled(project_name, projects):
    try:
        res = projects.getBillingInfo(name=project_name).execute()
        return res.get("billingEnabled", False)
    except Exception as exc:  # noqa: BLE001 (log and treat as unknown)
        print(f"Could not read billing info: {exc}")
        return False


def _disable_billing(project_name, projects):
    # An empty billingAccountName detaches the billing account from the project.
    body = {"billingAccountName": ""}
    res = projects.updateBillingInfo(name=project_name, body=body).execute()
    print(f"!!! BILLING DISABLED for {project_name}: {json.dumps(res)}")
