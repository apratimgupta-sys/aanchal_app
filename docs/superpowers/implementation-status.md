# First iteration verification

3 October 2026. Implemented React/Vite frontend, Cloudflare Workers API, persistent D1 ledger and authenticated Durable Object notifications. Local preview: http://localhost:8787.

Verification: type checking; 12 domain tests; 11 Workers/D1 integration tests; 4 Chromium browser scenarios; production build. Desktop and mobile screenshots inspected. Independent review completed; important findings corrected. Browser acceptance verifies submission propagation within two seconds, correction history, full-month selection, preserved detail view, deliberate zero activity and recovery without reloading.

Decisions: initialized a new feature branch in the otherwise empty project; RPC errors use envelopes because custom prototypes do not cross RPC; Workers tests override compatibility date to the supported 2026-08-22 while application config remains 2026-10-03. Source and setup instructions are kept in place. No remote push, merge, or deployment.

Cloudflare authentication is expired and cannot refresh non-interactively. Remote deployment requires a new Wrangler login and a real D1 binding ID. Do not confuse local Cloudflare emulation with a hosted deployment.

Minor limitation: raw audit JSON property names are English, with bilingual surrounding labels. Shared logins identify an office, not an individual staff member.
