# Field Visit Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a field officer record a site visit from a phone — identified by their own login, fixed by device coordinates and a server timestamp — and let the Commissioner read every visit.

**Architecture:** New routes inside the existing React SPA and new endpoints in `backend-anchal`. A third account role (`officer`) sits alongside the six shared office accounts and the commissioner. Visit rows live in their own tables with no foreign keys into daily-entry data, and photo storage sits behind an interface that version 1 never calls.

**Tech Stack:** React 19, TypeScript, Vite 8, TanStack Query 5, react-hook-form + zod 4, Vitest, Playwright, lucide-react icons, UX4G CSS classes.

**Spec:** `docs/superpowers/specs/2026-11-18-field-visit-module-design.md`

## Global Constraints

- Node 22.12+; install with `npm ci --legacy-peer-deps`.
- Frontend served under base path `/anchal/`; routes go through `portalPath` / `portalRoute` in `src/client/portal-path.ts`.
- API base is `/v1/api/anchal`, called only through `api<T>(path, method, body)` in `src/client/api.ts`; `credentials: "same-origin"`.
- Every user-facing string is bilingual via `useText()` from `src/client/i18n.tsx`: `text("English", "हिन्दी")`. Server-sent messages are translated by adding keys to `runtimeHindi` in the same file.
- Dates and "today" are Asia/Kolkata, via the helpers in `src/client/lib/dates.ts`.
- Styling uses existing `ux4g-*` classes and the primitives in `src/client/ui.tsx` (`Input`, `Field`, `Panel`, `Notice`). No new UI dependency.
- TypeScript must pass `npm run typecheck` with no new errors.
- Mutations carry a `requestId` from `mutationIntent` in `src/client/mutation.ts` so a retried submit is not a second record.
- Verification thresholds: accuracy ≤ **100 m**, GPS-capture-to-server-receipt gap ≤ **30 minutes**.
- Issue/Action minimum length: **20 characters**. Anchal **1–6**. Ward **1–53**. Service **1–25**.
- Photographs are not built in v1. The columns and the storage interface exist; the form has no file input.

**Backend note:** `backend-anchal` is a separate repository and was not available while writing this plan. Backend tasks give the exact contract — route, method, payload, status codes, behaviour — and the implementer follows that repository's existing conventions for routing, validation, persistence, migrations and tests. Where this plan names a test command for backend work, substitute that repository's own.

## Review Focus

Five things the spec implies that no feature test would otherwise cover:

1. **Geolocation denied or unavailable** — the officer must see why they cannot submit, in their language; the form must not sit silently disabled. Covered in Task 4 and Task 6.
2. **Duplicate submit** — a double tap or a retried request must produce one visit, not two. Covered in Task 3.
3. **Session expired or officer deactivated mid-form** — the submit must fail with a clear message and the typed text must survive on screen. Covered in Task 6.
4. **Implausible GPS accuracy** — a reading of several kilometres must store and flag as not verified, never be silently treated as on-site. Covered in Task 1.
5. **Issue/Action text that is long, multiline or Devanagari** — must round-trip and display without truncation or mojibake. Covered in Task 3.

---

### Task 1: Shared types and visit domain rules

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/domain/visit.ts`
- Test: `tests/domain/visit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FieldVisitInput`, `StoredFieldVisit`, `FieldVisitView`, `OfficerProfile`, extended `UserSession`; `verifyOnSite(reading: GpsReading, receivedAt: string): VerificationResult`; `validateVisitInput(input: FieldVisitInput, today: string): Record<string, string>`; constants `VERIFY_ACCURACY_METRES = 100`, `VERIFY_WINDOW_MINUTES = 30`.

Types to add to `src/shared/types.ts`:

```ts
export type GpsReading = { latitude: number; longitude: number; accuracyMetres: number; capturedAt: string };
export type FieldVisitInput = { visitDate: string; visitTime: string; officeId: number; ward: number; serviceId: number; gps: GpsReading; issueAction: string };
export type StoredFieldVisit = FieldVisitInput & { id: string; officerId: string; officerName: string; officerDesignation: string; receivedAt: string; verifiedOnSite: boolean; voidedAt: string | null; voidReason: string | null };
export type FieldVisitView = StoredFieldVisit;
export type OfficerProfile = { id: string; username: string; name: string; designation: string; homeOfficeId: number; active: boolean };
export type VerificationResult = { verified: boolean; reason: "ok" | "accuracy" | "stale" };
```

`UserSession["role"]` gains `"officer"`; `UserSession` gains `officer?: OfficerProfile` and `mustChangePassword?: boolean`.

- [ ] **Step 1: Write the failing tests** in `tests/domain/visit.test.ts`

```ts
describe("verifyOnSite", () => {
  it("verifies a tight reading received straight away");          // accuracy 20, gap 1 min → { verified: true, reason: "ok" }
  it("rejects a reading accurate to kilometres");                  // accuracy 5000, gap 1 min → { verified: false, reason: "accuracy" }
  it("rejects a reading captured outside the window");             // accuracy 20, gap 61 min → { verified: false, reason: "stale" }
  it("accepts the boundary values");                               // accuracy 100, gap 30 min → verified
});
describe("validateVisitInput", () => {
  it("accepts a complete visit for today");                        // → {}
  it("rejects a visit date other than today");                     // → { visitDate: ... }
  it("rejects issue/action under 20 characters");                  // → { issueAction: ... }
  it("rejects ward outside 1–53 and anchal outside 1–6");
  it("rejects a service id outside 1–25");
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test:domain -- visit`
Expected: FAIL, module `src/domain/visit.ts` not found.

- [ ] **Step 3: Implement `src/domain/visit.ts`**

Pure functions, no imports from `src/client`. `verifyOnSite` compares `reading.accuracyMetres` against the accuracy constant and the difference between `receivedAt` and `reading.capturedAt` against the window; accuracy is checked first so an inaccurate reading reports `"accuracy"`. `validateVisitInput` returns a map of field name to message, empty when valid, using the same shape the API returns so `normalizeFieldErrors` can consume it unchanged.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test:domain -- visit` then `npm run typecheck`
Expected: PASS, no new type errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/domain/visit.ts tests/domain/visit.test.ts
git commit -m "feat: field visit types and domain rules"
```

---

### Task 2: Backend — officer accounts, role and password lifecycle

**Files:** `backend-anchal`, following its conventions. Migration for `officers`, route handlers, tests.

**Interfaces:**
- Consumes: Task 1's types (mirror them in the backend's own type module if it does not share the frontend package).
- Produces: `GET /session` returning `role: "officer"` with `officer` and `mustChangePassword`; `GET /officers`; `POST /officers`; `PATCH /officers/:id`; `POST /officers/:id/password-reset`; `POST /password`.

Contract:

| Route | Who | Body | Returns |
|---|---|---|---|
| `GET /officers` | commissioner | — | `OfficerProfile[]`, inactive included |
| `POST /officers` | commissioner | `{ username, name, designation, homeOfficeId }` | `{ officer: OfficerProfile, temporaryPassword: string }`, 201 |
| `PATCH /officers/:id` | commissioner | `{ active: boolean }` | `OfficerProfile` |
| `POST /officers/:id/password-reset` | commissioner | — | `{ temporaryPassword: string }` |
| `POST /password` | officer, self | `{ currentPassword, newPassword }` | 204 |

Behaviour: a new or reset account has `mustChangePassword` true; while it is true every endpoint except `GET /session` and `POST /password` returns 403 with code `password_change_required`. A deactivated officer cannot authenticate, and an existing session for one is refused on the next request. Office accounts (`role: "office"`) are refused on all of these with 403. The temporary password is returned once, at creation or reset, and never again.

- [ ] **Step 1: Write the failing tests** — one per row of the table plus: office account refused; deactivated officer refused; `mustChangePassword` gate blocks a visit write.
- [ ] **Step 2: Run them and confirm they fail**
- [ ] **Step 3: Implement the migration, the role and the handlers**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Commit** — `feat: officer accounts and role`

---

### Task 3: Backend — field visit endpoints

**Files:** `backend-anchal`. Migration for `field_visits`, route handlers, tests.

**Interfaces:**
- Consumes: Task 2's officer role and session.
- Produces: `POST /field-visits`, `GET /field-visits`, `POST /field-visits/:id/void`.

Contract:

| Route | Who | Body / query | Returns |
|---|---|---|---|
| `POST /field-visits` | officer | `{ requestId, input: FieldVisitInput }` | `FieldVisitView`, 201 |
| `GET /field-visits` | officer (own) / commissioner (all) | `from`, `to`, `officeId?`, `ward?`, `serviceId?`, `officerId?`, `page?` | `{ rows: FieldVisitView[], total: number }`, newest first |
| `POST /field-visits/:id/void` | commissioner | `{ reason: string }` | `FieldVisitView` |

Behaviour:

- The server sets `receivedAt` and `officerId`, and computes `verifiedOnSite` with Task 1's rule. Values sent by the client for any of these are ignored.
- `visitDate` must be today in Asia/Kolkata; anything else is 422 with a field error on `visitDate`.
- Validation mirrors `validateVisitInput`; failures return the existing `ApiError` shape with `fieldErrors` keyed as `input.<field>`.
- `requestId` is idempotent: the same id replayed returns the original row with 200 and creates nothing.
- There is no update route. A stored visit is immutable apart from voiding.
- Voiding sets `voidedAt` and `voidReason`; the row is still returned by `GET` and is excluded from any count.
- Photo columns exist in the migration and stay null; no upload route in v1.

- [ ] **Step 1: Write the failing tests** — create and read back; server overrides a client-supplied `receivedAt`; an inaccurate reading stores `verifiedOnSite: false`; non-today `visitDate` rejected; short `issueAction` rejected; **replayed `requestId` creates one row** (Review Focus 2); **a 2,000-character multiline Devanagari `issueAction` round-trips byte-identical** (Review Focus 5); officer sees only their own rows; commissioner sees all; void requires a reason; office account refused.
- [ ] **Step 2: Run them and confirm they fail**
- [ ] **Step 3: Implement the migration and handlers**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Commit** — `feat: field visit endpoints`

---

### Task 4: Geolocation capture helper

**Files:**
- Create: `src/client/lib/geolocation.ts`
- Test: `tests/domain/geolocation.test.ts`

**Interfaces:**
- Consumes: `GpsReading` from Task 1.
- Produces: `capturePosition(geo?: Geolocation): Promise<GpsReading>`, rejecting with `GeolocationCaptureError` carrying `kind: "unsupported" | "denied" | "unavailable" | "timeout"`.

- [ ] **Step 1: Write the failing tests** in `tests/domain/geolocation.test.ts`, with a stub `Geolocation` object

```ts
it("returns a reading from a successful fix");                 // → latitude, longitude, accuracyMetres, capturedAt ISO
it("maps PERMISSION_DENIED to kind 'denied'");                 // Review Focus 1
it("maps POSITION_UNAVAILABLE to kind 'unavailable'");
it("maps TIMEOUT to kind 'timeout'");
it("rejects with kind 'unsupported' when no Geolocation is given");
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm run test:domain -- geolocation`

- [ ] **Step 3: Implement `capturePosition`**

Wrap `getCurrentPosition` in a promise with `enableHighAccuracy: true`, `timeout: 15000`, `maximumAge: 0`. `capturedAt` comes from the position's own timestamp, as an ISO string. The parameter defaults to `navigator.geolocation` so tests can inject a stub.

- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Commit**

```bash
git add src/client/lib/geolocation.ts tests/domain/geolocation.test.ts
git commit -m "feat: geolocation capture helper"
```

---

### Task 5: Officer role in routing and shell

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/AppShell.tsx`
- Create: `src/client/pages/ChangePassword.tsx`
- Test: `tests/domain/visit-routes.test.ts`

**Interfaces:**
- Consumes: extended `UserSession` from Task 1; `POST /password` from Task 2.
- Produces: `officerNav(labels: { visit: string; mine: string }): ShellNavItem[]` exported from `AppShell.tsx`; routes `/officer/visit`, `/officer/visits` and `/officer/password`; `officerLanding(session, pathname): string | null` exported from `App.tsx` for test.

- [ ] **Step 1: Write the failing test** in `tests/domain/visit-routes.test.ts`

```ts
it("sends an officer at / to /officer/visit");
it("leaves an officer on /officer/visits alone");
it("sends an officer away from /commissioner/dashboard");
it("sends an officer with mustChangePassword to /officer/password from anywhere");
it("leaves office and commissioner sessions unchanged");
```

- [ ] **Step 2: Run it and confirm it fails**
- [ ] **Step 3: Implement**

Extract the landing decision in `App.tsx` into exported `officerLanding` and call it from the existing redirect effect, beside the current office and commissioner branches. Add `officerNav` to `AppShell.tsx` using `ClipboardList` for the form and `History` for the list, matching `officeNav`'s shape. The unsaved-changes guard (`mayNavigate`) currently keys off `session?.role === "office"`; extend it to officers so a half-typed visit is not lost on a nav click.

`ChangePassword.tsx` is the destination when `mustChangePassword` is set: current password, new password, confirm, posting to `POST /password` and calling the session refresh on success. It renders outside `AppShell`, like the setup screen does for a new office, since the officer may not navigate anywhere else until it is done. Unlike the office setup screen it keeps the language toggle — the setup screen's missing toggle is a known defect in the existing portal and must not be copied here.

- [ ] **Step 4: Run the test and `npm run typecheck`**
- [ ] **Step 5: Commit** — `feat: officer routing and navigation`

---

### Task 6: Visit form page

**Files:**
- Create: `src/client/pages/FieldVisit.tsx`
- Create: `src/client/field-visits.ts`
- Modify: `src/client/App.tsx` (lazy import and render for `/officer/visit`)
- Modify: `src/client/i18n.tsx` (Hindi for server messages this page surfaces)
- Test: `tests/domain/field-visits-api.test.ts`

**Interfaces:**
- Consumes: `capturePosition` (Task 4); `validateVisitInput`, types (Task 1); endpoints (Task 3).
- Produces: `createVisit(input: FieldVisitInput, requestId: string): Promise<FieldVisitView>` and `listVisits(filters: VisitFilters): Promise<{ rows: FieldVisitView[]; total: number }>` in `src/client/field-visits.ts`.

Form, in one column, in this order: visit date (read-only, today), time (defaults to now), Anchal (select 1–6, defaulting to `session.officer.homeOfficeId`), Ward (select 1–53), Activity (select from `src/shared/services.json`, labelled `id` + `name`/`en` by language), location (a **Capture location** button showing coordinates and accuracy once captured, never a text input), Issue/Action (textarea). Submit is disabled until a location is captured and the form validates.

- [ ] **Step 1: Write the failing tests** in `tests/domain/field-visits-api.test.ts`

```ts
it("posts the visit with a requestId and returns the stored row");
it("reuses the same requestId when the payload is unchanged");   // mutationIntent
it("surfaces fieldErrors through normalizeFieldErrors");
it("passes filters through as query parameters");
```

- [ ] **Step 2: Run them and confirm they fail**
- [ ] **Step 3: Implement `src/client/field-visits.ts`, then the page**

Use `api<T>` for both calls. In the page, use react-hook-form with a zod resolver mirroring `validateVisitInput`, `mutationIntent` for the request id, and `Field` / `Input` / `Panel` / `Notice` from `src/client/ui.tsx`. On a capture failure show the message for that `kind` (Review Focus 1) with a Retry button, and keep submit disabled — the officer must see why, never a dead button. On a 401 or a `password_change_required` / deactivated 403, show the error and leave the typed values on screen (Review Focus 3). On success, clear the form and show a confirmation that names the record's time.

- [ ] **Step 4: Run the tests and `npm run typecheck`**
- [ ] **Step 5: Commit** — `feat: field visit form`

---

### Task 7: Officer's own visit list

**Files:**
- Create: `src/client/pages/MyVisits.tsx`
- Modify: `src/client/App.tsx` (route `/officer/visits`)

**Interfaces:**
- Consumes: `listVisits` (Task 6).
- Produces: nothing other tasks use.

Last 30 days, newest first: date and time, Anchal and ward, activity name, the first line of Issue/Action, and the verified-on-site state. A voided row is struck through with its reason. Empty state says no visits yet.

- [ ] **Step 1: Write the failing test** — a render test asserting a voided row renders struck through and an unverified row renders its flag.
- [ ] **Step 2: Run it and confirm it fails**
- [ ] **Step 3: Implement the page with `useQuery` and the existing `queryClient`**
- [ ] **Step 4: Run the test and `npm run typecheck`**
- [ ] **Step 5: Commit** — `feat: officer visit list`

---

### Task 8: Commissioner visit register

**Files:**
- Create: `src/client/pages/VisitRegister.tsx`
- Modify: `src/client/App.tsx` (route `/commissioner/visits`)
- Modify: `src/client/components/AppShell.tsx` (`commissionerNav` gains the register)

**Interfaces:**
- Consumes: `listVisits` (Task 6); `POST /field-visits/:id/void` (Task 3).
- Produces: nothing other tasks use.

Filters across the top in the Dashboard's existing style: date range, Anchal, ward, activity, officer. Table: date and time, officer with designation, Anchal and ward, activity, Issue/Action, verified-on-site, coordinates. Pagination at 50 rows. A **Void** action per row opens a dialog requiring a reason; a voided row stays visible, struck through, with the reason.

- [ ] **Step 1: Write the failing test** — void requires a non-empty reason before the call is made; filters compose into one query; a voided row stays in the list.
- [ ] **Step 2: Run it and confirm it fails**
- [ ] **Step 3: Implement the page and add the nav item**
- [ ] **Step 4: Run the test and `npm run typecheck`**
- [ ] **Step 5: Commit** — `feat: commissioner visit register`

---

### Task 9: Commissioner officer administration

**Files:**
- Create: `src/client/pages/Officers.tsx`
- Modify: `src/client/App.tsx` (route `/commissioner/officers`)
- Modify: `src/client/components/AppShell.tsx` (`commissionerNav` gains officers)

**Interfaces:**
- Consumes: Task 2's officer endpoints.
- Produces: nothing other tasks use.

A table of officers — name, designation, home Anchal, username, active — with **Add officer** (username, name, designation, home Anchal), **Deactivate** / **Reactivate**, and **Reset password**. Creation and reset show the temporary password once, in a panel the administrator must dismiss, with a line saying it will not be shown again.

- [ ] **Step 1: Write the failing test** — the temporary password shows once and is gone after dismissal; deactivate asks for confirmation; the form refuses a blank username or designation.
- [ ] **Step 2: Run it and confirm it fails**
- [ ] **Step 3: Implement the page and add the nav item**
- [ ] **Step 4: Run the test and `npm run typecheck`**
- [ ] **Step 5: Commit** — `feat: officer administration`

---

### Task 10: End-to-end browser test

**Files:**
- Create: `tests/browser/field-visit.spec.ts`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the failing test**

Follow `tests/browser/portal.spec.ts` for setup and credential handling. With geolocation granted and a fixed position via `context.grantPermissions(["geolocation"])` and `context.setGeolocation(...)`: sign in as an officer, capture location, fill the form, submit, and assert the visit appears in the officer's list. Then with permission denied, assert the explanatory message appears and submit stays disabled. Then as commissioner, assert the visit appears in the register and can be voided with a reason.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:browser -- field-visit`

- [ ] **Step 3: Fix whatever the test exposes** in the pages from Tasks 6–9; do not weaken the test.
- [ ] **Step 4: Run the full suite**

Run: `npm run typecheck && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit** — `test: end-to-end field visit flow`

---

## Done when

- An officer signs in on a phone, captures a location, files a visit, and sees it in their own list.
- A visit filed with a poor fix or long after capture is stored and shown as not verified on site.
- The Commissioner filters the register, opens a record and voids one with a reason.
- The Commissioner creates and deactivates officer accounts.
- Every screen reads in English and Hindi.
- `npm run typecheck && npm run test && npm run build` pass.
