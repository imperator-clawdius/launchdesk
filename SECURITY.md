# Security Policy

LaunchDesk is an early free project. Treat hosted deployments as private operator tools unless you have added production-grade account management.

## Supported Versions

Only the latest commit on the default branch is supported.

## Reporting a Vulnerability

Do not publish exploit details in a public issue. Contact the maintainer privately if contact information is available on the GitHub profile. If no private channel is available, open a minimal public issue that says a security report is available, without including secrets or exploit steps.

## Deployment Safety

- Set `AUTH_PASSWORD` before hosting LaunchDesk.
- Use HTTPS through your hosting provider.
- Keep `/api/export` behind authentication.
- Back up the data file before deploys.
- Do not store customer secrets, API keys, or payment details in lead notes.
- Move to Postgres and proper user accounts before running this for a team.
