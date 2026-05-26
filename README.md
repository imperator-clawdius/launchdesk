# LaunchDesk

LaunchDesk is a shippable first version of the monthly-revenue cockpit: it turns a narrow service offer into a scored package, launch assets, and a lead pipeline.

The first wedge is local service businesses because they already understand monthly spend for missed calls, reviews, bookings, and follow-up.

## What ships now

- Express backend with JSON persistence.
- API for offers, leads, summaries, exports, and health checks.
- Static app UI served by the backend.
- Offer scoring for niche fit, price, margin, proof, fulfillment, lead source, promise clarity, and channel mix.
- Generated assets: one-liner, landing-page copy, outbound email, SMS opener, onboarding checklist, weekly report template, and risk list.
- Dockerfile and Render blueprint with a persistent disk.
- Unit and API tests.

## Run locally

```powershell
npm install
npm test
npm run smoke
npm start
```

Open `http://localhost:4177`.

## Environment

Copy `.env.example` into `.env` for local configuration if needed. The server loads `.env` automatically.

- `PORT`: web port, default `4177`
- `DATA_FILE`: persistence file, default `./data/launchdesk.json`
- `APP_BASE_URL`: public base URL for future integrations
- `AUTH_USER`: operator username, default `admin`
- `AUTH_PASSWORD`: enables basic authentication when set

## API

- `GET /api/health`
- `GET /api/meta`
- `GET /api/summary`
- `GET /api/offers`
- `POST /api/offers`
- `GET /api/offers/:id`
- `PUT /api/offers/:id`
- `DELETE /api/offers/:id`
- `GET /api/leads`
- `POST /api/leads`
- `PUT /api/leads/:id`
- `DELETE /api/leads/:id`
- `GET /api/export`

## First customer workflow

1. Use the offer builder to create one niche offer.
2. Keep the highest-scoring offer only.
3. Export the generated email/SMS/landing copy.
4. Add 50 leads manually.
5. Run 20 direct outreach touches per day.
6. Use the weekly report template for every pilot.
7. Charge setup plus monthly before adding custom work.

## Longevity rules

- Do not add broad app-builder features before the lead pipeline closes real money.
- Keep one niche active until 2 paying customers exist.
- Every feature should improve one of these numbers: replies, booked calls, paid pilots, retained MRR.
- Move persistence to managed Postgres only after live customers need multi-user access.
