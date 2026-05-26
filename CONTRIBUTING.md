# Contributing to LaunchDesk

LaunchDesk is meant to stay useful, understandable, and cheap to run. Contributions should make the app easier for people to use, deploy, learn from, or adapt.

## Good Contributions

- Accessibility and mobile polish.
- Better offer scoring explanations.
- CSV import/export.
- Safer deployment defaults.
- More practical launch templates for real local services.
- Tests for API behavior, scoring logic, and persistence.
- Documentation for beginners.

## Product Guardrails

- Keep the app small enough for one person to understand.
- Prefer boring, durable technology over novelty.
- Do not add integrations before the manual workflow is clear.
- Do not make claims that promise guaranteed income.
- Do not add dark-pattern marketing or spam automation.

## Development

```powershell
npm install
npm test
npm run smoke
npm start
```

Open `http://localhost:4177`.

## Pull Request Checklist

- The change has a clear user benefit.
- `npm test` passes.
- `npm run smoke` passes when backend behavior changes.
- README or docs are updated when behavior changes.
- New environment variables are added to `.env.example`.

## Code Style

Use plain JavaScript, explicit functions, and small modules. Avoid introducing a build step unless the feature clearly needs one.
