# Billing kill-switch

A hard backstop that **disables billing on the whole `rainboltai-474207`
project** when spend crosses a threshold, so a runaway Cloud Run service (or
anything else) can't quietly run up a bill.

## How it works

```
Cloud Billing budget  ──(spend > threshold)──▶  Pub/Sub topic
                                                     │
                                                     ▼
                                          Cloud Function (this code)
                                                     │
                                                     ▼
                                  detaches the billing account from
                                  the project  →  everything stops billing
```

## Important caveats

- **Project-wide.** Disabling billing stops Cloud Run *and every other billable
  resource in the project*. It's a blunt instrument by design.
- **Not real-time.** Google updates budget spend data only a few times a day, so
  spend may overshoot the threshold by a little before this fires. It's a
  "don't let it run away" backstop, not a to-the-cent cap.
- **Re-enabling is manual.** Once billing is detached you re-link it in the
  console: Billing → link a billing account to the project.

## Setup (run AFTER billing is enabled on the project)

1. Find your billing account id:
   ```bash
   gcloud billing accounts list
   ```
2. Put it (and your desired threshold) at the top of `setup.sh`.
3. Run it from this directory:
   ```bash
   cd infra/billing-killswitch
   ./setup.sh
   ```

## Test it without spending money

Publish a fake "over budget" notification to the topic and watch the function
disable billing (then re-link billing afterwards):

```bash
gcloud pubsub topics publish billing-killswitch \
  --project rainboltai-474207 \
  --message '{"costAmount": 999, "budgetAmount": 5}'

# check it fired:
gcloud functions logs read billing-killswitch --gen2 --region us-central1 \
  --project rainboltai-474207 --limit 20
```
