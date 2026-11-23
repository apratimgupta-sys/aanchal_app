# Role manager — design

**Date:** 23 November 2026
**Repos:** backend `backend-anchal`, frontend `CommissionerDashboard`

## Intent

User administration is currently the Commissioner's job. It should not be: the person who
reads the monitoring data should not also be the person who decides who can file it. A
separate role manager account takes over user administration, and the Commissioner loses it.

## Decisions, taken with the client on 23 November

| Question | Decision |
|---|---|
| What can a role manager create? | Field officers, and **extra logins for the existing six Anchals** |
| New Anchals? | **No.** The six office records stay seeded fixtures |
| Commissioners? | **No.** Stays a seeded fixture |
| Another role manager? | **No.** Seeded only |
| Commissioner's Officers screen | **Removed entirely** |

The shape of this is deliberate: a role manager administers *people*, never *structure*. Offices,
the commissioner and the role manager itself are facts of the organisation, seeded and changed
only by someone with database access. Everything a role manager can do is reversible by
deactivating an account.

## Goals

- One account, seeded, whose only job is managing users and their roles.
- The Commissioner can no longer create, deactivate or reset anyone.
- A second or third person can file for a given Anchal.

## Non-goals

- No change to what any role can *do* once logged in, beyond user administration moving.
- No new Anchals, no self-service signup, no password recovery by email.
- No change to the monitoring data model, the entry flow or the dashboard.

## Anti-goals

- **A role manager that can mint its own peers.** One compromised account would then be
  permanent, and resetting a single password would not contain it.
- **A role manager that can create a Commissioner.** That would make it a superuser by one
  short path.
- **A migration.** `Role` is `varchar(40)` with no check constraint, so a new role is a code
  change. Nothing here needs the schema to move.

## Decisions that follow from the code

### D1 — `RoleManager` is a fourth role string, not a flag

`MonitoringPolicies` already names three roles (`AnchalOffice`, `Commissioner`, `FieldOfficer`)
and derives a policy from each. A fourth follows the same shape. The authorization handler
currently fails closed on an unknown role — none of its three branches match, so nothing calls
`context.Succeed` — which means a role-manager token is denied everywhere until the handler
explicitly allows it. That default is correct and is retained.

A role manager has **no office binding**, the same shape the Commissioner check already
requires (`officeIdClaims.Length == 0 && OfficeAssignments.Count == 0`).

### D2 — Extra Anchal logins need no new concept

`validOffice` requires `user.OfficeAssignments.Count == 1` — a constraint on the *user*, not on
the office. So a second user bound to Anchal 3 is already legal; nothing in authorization
changes. What changes is that the username can no longer be derived from the office code, as
the seeder does (`anchal3` → user `anchal3`). Created logins take a username the role manager
supplies.

### D3 — Two people filing for one Anchal is safe, and already handled

The entry save carries `expectedVersion` and a `requestId`. Two people editing the same
service entry produce a version conflict, which the product already surfaces rather than
silently overwriting. Opening balances lock per office on first save, so the second person
finds them locked — correct, and the same as today.

This is worth stating because it is the one place the decision has consequences beyond user
administration, and the answer is that the existing concurrency design already covers it.

### D4 — The officer endpoints move, they do not multiply

`MonitoringOfficerController` is `[Authorize(Policy = Commissioner)]` and offers List, Create,
SetActive and ResetPassword. The policy becomes `RoleManager`. The controller's scope widens
from field officers to users, so `CreateOfficerCommand` gains a role and an optional office.

Rejecting a role the client did not agree to — `Commissioner`, `RoleManager` — is a server-side
rule, not a UI omission. A UI that offers two choices and a server that accepts four is a
product with a hole in it.

### D5 — Credentials reach a person the way they already do

Creating a user returns a temporary password shown once, exactly as the existing reset flow
does. No email, no recovery. The person must change it on first use, which
`MustChangePasswordFilter` already enforces for field officers and now applies to any created
user.

### D6 — The role manager is seeded like every other fixture

`MonitoringProvisioner` provisions anchal1–6 and commissioner from
`AnchalProvisioningCredentials`. The role manager joins that list. It is therefore created on
deploy, with a credential supplied the same way the others are, and it cannot be created
through the product.

## Constraints

- **No EF migration.** `schemaVersion` untouched, no change to any stored snapshot.
- Every user-visible string paired `t("English", "हिन्दी")`; server messages need a Hindi key
  by exact match or they silently fall back to English.
- Frontend is Tailwind utilities only — the rebuilt system, no stylesheet.
- Existing suites stay green: backend 343, frontend 386.

## Left to the builder

- The username rule for created logins, and whether collisions are rejected or suffixed.
- Where the role manager's screen lives in the frontend route table.
- Whether the Commissioner's nav entry disappears or 404s if reached directly — it should do
  neither visibly: the route should simply not exist for that role.
