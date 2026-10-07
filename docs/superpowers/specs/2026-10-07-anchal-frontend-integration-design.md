# Commissioner Monitoring Frontend Integration Design

## Goal

Replace the Cloudflare Worker backend path with the Apna Ranchi Commissioner Monitoring API at `/v1/api/anchal`, without changing the dashboard's user-facing workflows.

## Scope

- The browser calls the Apna Ranchi API directly through a configurable base URL.
- Login, logout, session, catalog, setup, entries, corrections, history, dashboard and dashboard-detail flows use the ASP.NET contract.
- The API adapter maps backend response envelopes and naming differences into the client models.
- Polling replaces Cloudflare Durable Object/WebSocket live updates; UI surfaces backend `lastUpdated` and supports refresh.
- Cloudflare Worker, D1, Durable Object, and Worker-specific test/runtime dependencies are removed from the production path.

## Constraints

- API prefix is `/v1/api/anchal`.
- Cookie requests use `credentials: "include"`; cross-origin deployments require the API's configured allowed origin and HTTPS.
- Existing Apna Ranchi endpoints and database remain untouched.
- No frontend secrets or database credentials are stored in the client.

## Architecture

`src/client/api.ts` becomes a single transport configured by a build-time API base URL. A monitoring contract adapter converts the ASP.NET JSON payloads and errors into the client types consumed by views. Page-level query hooks poll read endpoints at the current dashboard cadence and use `lastUpdated` to display freshness; mutations invalidate/refetch affected resources.

## Verification

- Unit tests cover URL construction, cookies, errors and contract mapping.
- Component/integration tests cover office setup/report/correction and commissioner dashboard/history flows with mocked Apna Ranchi responses.
- Production build contains no Worker runtime dependency or `/api` transport calls.
