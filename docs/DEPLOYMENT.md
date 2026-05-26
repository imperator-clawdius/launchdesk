# LaunchDesk Deployment Plan

## Current target

Deploy LaunchDesk as a small private operator app first. The app is not a public marketplace yet; it is the system used to package offers, track leads, and close the first recurring customers.

## Recommended path: Render

The repository includes `Dockerfile` and `render.yaml`.

1. Push the repo to a private GitHub repository.
2. Create a new Render Blueprint from the repo.
3. Confirm the service uses Docker.
4. Keep the persistent disk mounted at `/data`.
5. Set:
   - `NODE_ENV=production`
   - `PORT=4177`
   - `DATA_FILE=/data/launchdesk.json`
   - `AUTH_USER=admin`
   - `AUTH_PASSWORD=<strong password>`
6. Deploy.
7. Confirm `GET /api/health` returns `{"ok":true,...}`.
8. Open the public URL and verify it prompts for the operator password.
9. Create one test offer.
10. Open `/api/export` and verify the saved test offer appears.

## Backup plan

Until Postgres exists, the data file is the source of truth.

Daily manual backup:

1. Open `/api/export`.
2. Save the JSON export.
3. Keep it in the private repo or a private Drive folder.

Deployment disk backup:

1. Use Render shell or dashboard file tools to copy `/data/launchdesk.json`.
2. Store the copy before any deploy that changes data shape.

## When to move to Postgres

Move from JSON storage to managed Postgres when any of these become true:

- More than one operator needs concurrent edits.
- The pipeline has paying customers whose history cannot be recreated easily.
- You need account login, permissions, or customer-facing dashboards.
- You need automated external integrations writing data at the same time.

The code already isolates persistence in `src/store.js`; replace `JsonStore` with a `PostgresStore` while keeping the route contracts stable.

## Monthly money deployment sequence

1. Deploy private app.
2. Create the first HVAC or plumbing missed-call offer.
3. Add 50 prospects.
4. Run outreach manually for one week.
5. Close one pilot at setup plus monthly.
6. Only then add Stripe, auth, and outbound automation.

## Production hardening checklist

- Add authentication before sharing the URL outside trusted operators.
- Keep `AUTH_PASSWORD` set in every hosted environment.
- Add Stripe checkout after the first offer closes manually.
- Add Twilio/Vapi/Retell only after the missed-call workflow is proven by hand.
- Add Postgres before multiple operators use it.
- Add scheduled backups before live customer data accumulates.
- Add audit logs before assigning tasks to contractors.
