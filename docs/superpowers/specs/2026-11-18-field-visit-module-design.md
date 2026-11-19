# Field Visit Module — Design

**Date:** 2026-11-18
**Project:** RMC Anchal Office Monitoring Portal (`CommissionerDashboard` frontend, `backend-anchal` backend)
**Status:** Design, awaiting approval

---

## 1. Intent and why

Field officers of Ranchi Municipal Corporation — junior engineers, assistant and executive engineers, sanitary inspectors — make site visits across the six Anchals. Today nothing records that a visit happened. The only field-related data in the portal is the daily service register, which counts work but says nothing about who went where.

This module records visits, as evidence. Its value is that a visit can be shown to have taken place, at a given location, by a named officer. The Commissioner's office can then see which wards and services are being visited and which are not.

It is deliberately not a productivity system. It does not measure how much work a crew completed, and it does not track whether a problem was later fixed.

**What the record proves, in version 1.** Photographs are deferred (§7.2), so the evidentiary weight rests on the device's coordinates and the server's receipt timestamp. That supports a claim that an officer's device was in a given ward at a given time and that the officer recorded a given observation. It does not corroborate the observation itself, and a determined officer can spoof a coordinate. The module should be described to RMC in those terms, not as photographic evidence.

## 2. Goals

- An officer can record a site visit from a phone, at the site, in under two minutes.
- Each record identifies a real person, a real place and a real time.
- The Commissioner's office can read and filter all visits.
- The module reads in English and Hindi, consistent with the rest of the portal.
- Photographs can be switched on later without reworking the record or the form.

## 3. Non-goals

- **Photographs, in version 1.** The field is specified and the storage interface is built, but capture is disabled (§7.2, §9 OI-1).
- Target, completed and pending counts. The source workbook's *Field Activities* sheet carries them; they are excluded (see §6.1).
- Assignment or scheduling of visits.
- Any follow-up, closure or compliance workflow after a visit is filed.
- Export to Excel or PDF.
- Grievance tracking, which the workbook treats as a separate module.
- Offline capture.
- A native mobile application.
- A map view of visits.

## 4. Anti-goals

Outcomes that would make this a failure even if it shipped and worked:

- Records that look like evidence but are not — a visit filed from the office that appears to have been filed on site.
- The record being presented to RMC as stronger proof than it is (§1).
- Officers avoiding the module because filing is slower than the visit itself.
- Field data that cannot be reconciled with the daily register because the same work is counted in both.

## 5. Constraints

- **Existing stack.** React 19 + Vite SPA served under `/anchal/`, `backend-anchal` behind `/v1/api/anchal`, production at `https://apnaranchi.rsccl.in/anchal/`. Cookie-based sessions.
- **Existing accounts.** Six shared office accounts (`anchal1`–`anchal6`) and one `commissioner` account. Passwords are issued by the portal administrator; there is no self-service password change today.
- **Expected volume.** 50–100 visits per day across the six Anchals.
- **No ward master exists.** Neither the portal nor the source workbook contains a ward list, and RMC's published ward list is organised into four zones, not the six Anchals, which were opened on 2 October 2026. The ward-to-Anchal mapping is not public.
- **Geolocation requires HTTPS**, which production has.
- **Browsers cannot enforce camera-only capture.** Relevant when photographs are enabled in phase 2: the `capture` attribute is a hint, and on desktop and several Android browsers the user may still choose an existing file.

## 6. Approaches considered

**A. Inside the existing app — chosen.** New routes in the current SPA, new endpoints and an officer role in `backend-anchal`. Reuses session handling, the language toggle, the design system and the deployment. The module is small — one form and one list — and the Commissioner needs it beside the existing dashboard. Cost: a desktop reporting app and a phone evidence tool share a release cycle, and the auth model grows a third account type.

**B. Separate frontend, same backend.** A second Vite app built for phones, sharing the API and cookie. Independent deploys and a UI owing nothing to the desktop layout, at the cost of a second frontend, duplicated i18n and components, and cookie-scope configuration. Rejected: the field UI is not yet divergent enough to pay that tax, and A can be split into B later without redoing the backend.

**C. Separate service end to end.** Own frontend, backend and database, sharing only the ward and service masters. Cleanest isolation, and the photo store could have its own retention policy. Rejected as disproportionate: both systems serve the same six offices and one administrator, and cross-module reporting would become an integration problem.

Two provisions keep a later move to B or C cheap, and are part of the chosen design:

- Visit records live in their own tables, with no foreign keys into daily-entry data.
- Photo storage sits behind an interface rather than being called directly, since its destination is undecided and capture is deferred.

### 6.1 Why target/completed/pending are excluded

The workbook's *Field Activities* sheet has Target, Completed and Pending columns. They are not built, for two reasons. First, the purpose settled for this module is proof of visit, not output measurement. Second, if an officer enters target and completed in the same form after the work is done, the target becomes whatever was achieved: pending is always zero and the dashboard's field-task pendency flag can never fire. A meaningful target requires an assignment step, which is a non-goal here. If RMC later wants crew productivity tracking, it is a separate module with its own assignment workflow.

## 7. Decisions

Settled with the client. Where a point was decided by the builder rather than the client, it is marked *[builder call]*.

### 7.1 Identity and access

| | |
|---|---|
| Who files | All field officers: JE, AE, EE, Sanitary Inspector and equivalents, across the six Anchals |
| Authentication | One account per officer |
| Account type | A third role alongside the shared office accounts and the commissioner account |
| Officer profile | Name, designation, home Anchal, active flag *[builder call: the minimum needed to attribute a record and default the Anchal]* |
| Administration | The `commissioner` account. It creates and deactivates officer accounts and voids records |
| Who reads | The commissioner account sees all visits. An officer sees their own. *[builder call: an officer seeing their own filings is needed to confirm a submission succeeded]* |
| Office accounts | The six shared office accounts have no access to this module *[builder call: shared logins would defeat the attribution the module exists for]* |
| Passwords | Administrator-issued, forced change on first login, administrator reset path *[builder call: per-officer accounts without a reset path produce shared passwords, which defeats attribution]* |

Note that this makes `commissioner` a privileged account. Everywhere else in the portal it is read-only, and documentation that describes it that way — including the existing Commissioner's Guide — needs amending.

### 7.2 The record

One record is one site. An officer covering several spots in a morning files several records. A record carries one Anchal, one ward, one activity and one location.

| # | Field | Input | Required | Notes |
|---|---|---|---|---|
| 1 | Visit date | Date | Yes | Today only; no backdating (§7.3) |
| 2 | Time of visit | Time | Yes | Defaults to now |
| 3 | Officer | — | Yes | From the authenticated account; not an input |
| 4 | Anchal | Dropdown 1–6 | Yes | Defaults to the officer's home Anchal, changeable |
| 5 | Ward | Dropdown 1–53 | Yes | Numbers only until the ward master exists (§9) |
| 6 | Activity | Dropdown | Yes | The 25 services from Service Master, shown as number + name |
| 7 | Location | Geo-coordinates | Yes | Captured from the device; not typed (§7.3) |
| 8 | Issue / Action | Long text | Yes | What was observed and what is to be done. Minimum 20 characters *[builder call: a free-text field with no floor collects "ok"]* |
| 9 | Photograph 1 | File (image) | **Deferred** | Not shown in v1 |
| 10 | Photograph 2 | File (image) | **Deferred** | Not shown in v1 |

Stored alongside, not shown as inputs: officer ID, server receipt timestamp, GPS accuracy in metres, GPS capture timestamp, client language, and a verified-on-site flag (§7.3).

**Photographs, phase 2.** Two per visit, both required, labelled *Before / After* for the work-verification services — fogging (09), street dog (10), street lighting (13), road and drain (14), grass cutting (15), tree pruning (16), water body cleaning (17) — and *Site photo 1 / 2* for the rest, following Service Master's *Key Output / Evidence* column. Version 1 carries the columns and the storage interface so this is a switch-on rather than a migration.

### 7.3 Capture rules

Filing is strict, because a record that can be filed from anywhere proves nothing.

- **Same day only.** Visit date is today. No backdating.
- **Location is mandatory** and comes from the browser's geolocation API, never typed.
- **The server sets the receipt timestamp.** The client's clock is recorded but not trusted.
- **Verified on site** is computed and stored, not claimed by the officer: GPS accuracy within an acceptable radius, and the gap between GPS capture and server receipt within an acceptable window. *[builder call: thresholds are a tuning decision; start at 100 m and 30 minutes and revisit after a month of real data.]*
- **A record that fails either test is stored and displayed as not verified on site, not rejected.** An officer who captured a location at the site and submitted later from the office still files a record; it simply carries the flag. Blocking submission instead would stop officers filing at all.

### 7.4 After filing

A filed record is permanent. There is no edit path for officers, and no status, assignment or closure workflow.

Because a typo is otherwise uncorrectable and the officer's only recourse is to file a contradictory second record, the commissioner account may **void** a record with a reason. A voided record is struck through, retained in full, excluded from counts, and never deleted.

### 7.5 Commissioner's view

A read-only list of visits, filterable by Anchal, ward, activity, officer and date range, newest first, showing date and time, officer, Anchal and ward, activity, the issue/action text, and the verified-on-site state. Opening a record shows the full text and the coordinates.

No export in v1. No map view in v1.

Visits are not shown against daily-register entries. The two data sets stay separate, which is what anti-goal 3 asks for: the concern is double-counting the same work, not a combined view.

### 7.6 Language

English and Hindi, using the portal's existing toggle and translation setup. Note that 12 of the 25 service names are currently untranslated in the Hindi UI; this module inherits that and should not work around it with a second set of translations.

## 8. What is left to the builder

- Database schema, table and column naming, and migrations.
- API shape and endpoint naming, following whatever `backend-anchal` already does.
- Pagination strategy for the Commissioner's list, sized for 50–100 records a day.
- Component structure and form state management, following existing patterns.
- When geolocation is requested — form open, explicit button, or submit — and the wording shown when the browser denies or fails it. Failure must be visible, not silent.
- Device floor: current-generation Android Chrome and iOS Safari *[builder call; no device inventory was available]*.
- Test coverage, consistent with the existing suite.
- Phase 2 only: image compression, accepted formats, maximum size, and whether EXIF is stripped or retained.

## 9. Open issues

| ID | Issue | Needed from | Blocks |
|---|---|---|---|
| OI-1 | **Photo storage destination**, for phase 2. Application server disk, object storage, or RSCCL/government infrastructure, with a retention period. At 50–100 visits a day, two images each, expect roughly 3,000–6,000 images a month. Carries a policy and procurement angle, not only a technical one. | RMC / RSCCL | Phase 2 only; v1 is unblocked |
| OI-2 | **Ward master.** The ward-to-Anchal mapping is not published and must come from RMC. Until it arrives the ward dropdown is numbers 1–53 with no names and no filtering by Anchal, and no validation prevents an impossible Anchal/ward pair. | RMC | Ward names and Anchal filtering only; not the module |
| OI-3 | **Officer roster.** Names, designations and home Anchals for every officer who needs an account, plus who maintains the list as people transfer. | RMC | Account provisioning before go-live |
| OI-4 | **Anchal numbering.** Whether `anchal1`–`anchal6` in the portal correspond to the six offices opened on 2 October 2026, and in what order. This ambiguity already exists in the daily reporting data. | RMC | Nothing in this module, but worth resolving |

## 10. Risks

- **The record is weaker evidence than it appears** (§1). Without photographs it attests presence and a typed observation, nothing more. The risk is not technical: it is that RMC treats it as proof of condition. Say so in the handover and in the officer SOP.
- **Strict capture plus no edits is harsh.** An officer at a site with no signal files nothing; a mistyped record is permanent. Both were chosen deliberately for evidentiary strength. The commissioner's void (§7.4) is the pressure valve; prefer using it over loosening capture.
- **The commissioner account becomes privileged** (§7.1). One account that can read everything, create logins and void records is a concentration of authority, and its password is already shared within an office. Worth a per-person commissioner-office account later.
- **Officer identity is only as good as account hygiene.** Per-officer logins achieve nothing if officers share passwords. State this in the officer SOP.
- **Phase 2 volume.** When photographs switch on, storage grows faster than the rest of the portal's data combined. OI-1 should be settled before that switch, not at it.
