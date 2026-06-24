#!/usr/bin/env bash
#
# One-time setup for the billing kill-switch. Run this AFTER billing is enabled
# on the project. It:
#   1. enables the required APIs
#   2. creates a Pub/Sub topic the budget publishes to
#   3. deploys the Cloud Function that disables billing
#   4. grants that function permission to disable billing
#   5. creates the budget wired to the topic
#
# Re-running is safe (creates are idempotent / tolerate "already exists").

set -euo pipefail

# ===================== CONFIG (edit these) ============================
PROJECT_ID="rainboltai-474207"
REGION="us-central1"
BUDGET_AMOUNT="10"           # In the billing account's currency (CAD). Spend past this disables billing project-wide.
BILLING_ACCOUNT_ID="016E9C-6EB886-62508E"  # My Billing Account 1
TOPIC="billing-killswitch"
FUNCTION="billing-killswitch"
# ======================================================================

if [[ -z "$BILLING_ACCOUNT_ID" ]]; then
  echo "ERROR: set BILLING_ACCOUNT_ID at the top of this script first."
  echo "Find it with:  gcloud billing accounts list"
  exit 1
fi

echo "==> 1/5 Enabling APIs..."
gcloud services enable \
  cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  pubsub.googleapis.com cloudbilling.googleapis.com billingbudgets.googleapis.com \
  eventarc.googleapis.com \
  --project "$PROJECT_ID"

echo "==> 2/5 Creating Pub/Sub topic '$TOPIC'..."
gcloud pubsub topics create "$TOPIC" --project "$PROJECT_ID" 2>/dev/null \
  || echo "    (topic already exists)"

echo "==> 3/5 Deploying Cloud Function '$FUNCTION'..."
gcloud functions deploy "$FUNCTION" \
  --gen2 --runtime python312 --region "$REGION" \
  --source . --entry-point stop_billing \
  --trigger-topic "$TOPIC" \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" \
  --project "$PROJECT_ID"

echo "==> 4/5 Granting the function permission to disable billing..."
FUNC_SA=$(gcloud functions describe "$FUNCTION" --gen2 --region "$REGION" \
  --project "$PROJECT_ID" --format='value(serviceConfig.serviceAccountEmail)')
echo "    Function service account: $FUNC_SA"
gcloud billing accounts add-iam-policy-binding "$BILLING_ACCOUNT_ID" \
  --member="serviceAccount:$FUNC_SA" \
  --role="roles/billing.admin"

echo "==> 5/5 Creating budget '$BUDGET_AMOUNT USD' wired to the topic..."
# NOTE: --budget-amount has no currency suffix so it uses the billing account's
# own currency (e.g. CAD). The flag is --notifications-rule-pubsub-topic on
# current gcloud (older docs say --all-updates-rule-pubsub-topic).
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --display-name="killswitch-${PROJECT_ID}" \
  --budget-amount="${BUDGET_AMOUNT}" \
  --filter-projects="projects/${PROJECT_ID}" \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --notifications-rule-pubsub-topic="projects/${PROJECT_ID}/topics/${TOPIC}"

echo
echo "Done. Spend past \$${BUDGET_AMOUNT} will disable billing on ${PROJECT_ID}."
echo "NOTE: budget data lags a few hours, so this is a backstop, not an instant cap."
echo "To re-enable later: console.cloud.google.com/billing -> link account to project."
