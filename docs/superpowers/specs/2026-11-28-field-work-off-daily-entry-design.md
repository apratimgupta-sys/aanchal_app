# Field work leaves the daily entry — design

**Date:** 28 November 2026
**Requested by:** the client. Piece 3 of three; piece 1 (per-service visit details) is built and
verified on staging, and piece 2 (reporting) is deferred by the client until officers are filing.

## What changes

The eight field-work services (8, 9, 10, 13, 14, 15, 16, 17) stop being reported by Anchal clerks
on the daily entry. They are reported by field officers as visits, which piece 1 made capable of
carrying each service's own figures.

1. **The daily entry offers 17 services.** The "Field works" group disappears from it; counter and
   collection work remain.
2. **The server refuses a daily entry for a field-work service.** Not a UI-only change: an old
   cached page or a direct call must be refused, or the change is cosmetic.
3. **The expected-reports denominator becomes 17.** `MonitoringService.cs:261` hardcodes `25`; it is
   derived from the services the daily entry actually collects, so it cannot drift again.
4. **The dashboard loses the "Work done this period" tile and the "Work done" column.** Both are fed
   by the clerk's figure and would read **zero** from the cutover — which on a government dashboard
   does not say "this moved elsewhere", it says "no work was done". The client chose removal over
   leaving them or repointing them at visits.
5. **The dashboard's service filter offers the same 17.** With work done gone, a pinned field-work
   service has no figure left to show, so offering it is a dead end.

## What does not change

- **The eight services stay in the service master.** Visits reference them by id and the register
  prints their names. Removing them from `services.json` would break the register.
- **The `fieldwork` form shape stays.** Historical daily entries exist for these services and remain
  readable; the shape is what makes them readable.
- **Field visits are untouched.** No change to the visit form, its storage, the register or the
  officer's list.
- **No migration.** Nothing is removed from the database and no column changes.
- **Opening balances are unaffected** — field work never moved a pending balance.

## Historical entries

Daily entries already filed against these services stay in the database and stay correct. They are
no longer reachable through the dashboard's service filter, because the figures that filter exists
to show are gone. They remain in the audit trail and the correction history.

There is no production data. On staging a handful of such entries exist and will become
filter-unreachable; that is acceptable and is the same outcome the client chose for the tile.

## The deploy gate, which is not a code concern

This change moves field-work reporting from clerks to officers **entirely**. Shipping it before
field officers are provisioned and able to sign in means **nobody reports field work: not the
clerk, not the officer.**

As of this writing the production Vercel alias has never served this work at all — the branches
`ui-rebuild` and `role-manager` have never been merged, so production builds from a branch that
predates the officer role. Until that is resolved and RMC's officer roster exists, this piece is
built but must not be deployed.

**This is recorded here because it has outlived three conversations.** The build is safe; the deploy
has a precondition.

## Constraints that still hold

- Tailwind utilities only; no hand-written CSS rules.
- Every user-visible string is a paired literal `t(en, hi)`. Server messages match by exact string
  with a silent English fallback, so a new one without a Hindi key renders in English with no error.
- Any new Hindi is drafted, not settled — roughly 76 strings already await RMC's reviewer.
- No new dependencies. Suites stay green: frontend 611, backend 496.
- `tests/ui/service-position.ts` hand-pins the daily entry's service positions and must be updated
  deliberately rather than regenerated from the implementation, so it cannot drift into agreeing
  with a broken list.
