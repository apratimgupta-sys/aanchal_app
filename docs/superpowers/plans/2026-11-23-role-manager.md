# Role manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A seeded role-manager account administers users; the Commissioner no longer can.

**Architecture:** A fourth role string with its own policy. The existing officer endpoints move to it and widen from field officers to users. No schema change — `Role` is already an unconstrained `varchar(40)`, and the authorization handler already fails closed on a role it does not know.

**Tech Stack:** Backend .NET 10 / EF Core / xUnit. Frontend React 19 / Vite / TypeScript strict / Tailwind utilities / Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-role-manager-design.md`

## Global Constraints

- **No EF migration.** `schemaVersion` untouched. No change to any stored snapshot.
- **A role manager has no office binding** — `officeIdClaims.Length == 0 && OfficeAssignments.Count == 0`, the same shape the Commissioner check requires.
- **The server rejects roles the client did not agree to.** A role manager may create `FieldOfficer` and `AnchalOffice` only. `Commissioner` and `RoleManager` are rejected server-side, not merely absent from the UI.
- **A role manager cannot create a role manager.** Seeded only.
- **No new Anchals.** An office login binds to one of the six existing office records.
- Every user-visible string paired `t("English", "हिन्दी")`. A server message needs a Hindi key by exact match or it silently degrades to English.
- Frontend is **Tailwind utilities only** — no stylesheet, no rule, no hex, theme keys only.
- Suites stay green: backend **343**, frontend **386**.

## Review Focus

- **A role-manager token against every monitoring endpoint.** It must be denied the dashboard, the entry save, the field-visit endpoints and the office scope — it administers people, not data. The handler fails closed, so the risk is a branch written too loosely.
- **A created office login filing an entry.** It must behave exactly like a seeded one: office scope, opening balances, the version check.
- **Two logins for one Anchal saving the same service entry.** The second must get a version conflict, not a silent overwrite.
- **A `Commissioner` or `RoleManager` value posted directly to the create endpoint**, bypassing the UI. Must be rejected.
- **A commissioner token against the officer endpoints after the move.** Must be denied, not merely hidden in the nav.

---

### Task 1: The role exists, is seeded, and can log in

**Files:**
- Modify: `src/Anchal.Application/CommissionerMonitoring/Auth/MonitoringPolicies.cs`, `src/Anchal.Infrastructure/CommissionerMonitoring/Auth/MonitoringAuthorizationHandler.cs`, `src/Anchal.Infrastructure/CommissionerMonitoring/Seeding/MonitoringProvisioner.cs`, `src/Anchal.Api/Provisioning/AnchalProvisioningCredentials.cs`
- Test: `tests/Anchal.Tests/CommissionerMonitoring/Auth/RoleManagerAuthorizationTests.cs` (create)

**Interfaces:**
- Produces: `MonitoringPolicies.RoleManagerRole` and the `RoleManager` policy, and a seeded account. Task 2 consumes both.

- [ ] **Step 1: Write the failing tests**

Pin, in this order: a role-manager principal satisfies the `RoleManager` requirement; it does **not** satisfy `Office`, `Commissioner`, `FieldOfficer` or `OfficeScope`; a role-manager user carrying an office assignment is **denied** (the no-binding rule is enforced, not assumed); and an unknown role string still satisfies nothing.

- [ ] **Step 2: Run them and watch them fail**

Expected: FAIL — the role and policy do not exist.

- [ ] **Step 3: Add the role and policy**

`RoleManagerRole = "RoleManager"` and a `RoleManager` policy alongside the existing three, following their exact shape.

- [ ] **Step 4: Add the handler branch**

A `validRoleManager` mirroring `validCommissioner`'s no-office-binding requirement, and its arm in the `MonitoringRoleRequirement` match. **Change nothing about the existing three branches.**

- [ ] **Step 5: Seed it**

Add to `AnchalProvisioningCredentials` and provision it in `MonitoringProvisioner` with a null office, as the commissioner is. Choose the username and say what you chose.

- [ ] **Step 6: Run the suite**

Run: `dotnet test Anchal.sln`
Expected: 343 + your new tests, all green.

- [ ] **Step 7: Commit**

`feat: a seeded role manager role that administers nobody yet`

---

### Task 2: The officer endpoints move and widen

**Files:**
- Modify: `src/Anchal.Api/Controllers/MonitoringOfficerController.cs`, the officer service and `CreateOfficerCommand`
- Test: extend the officer endpoint tests; add rejection tests

**Interfaces:**
- Consumes: Task 1's role and policy.
- Produces: the endpoints the frontend calls in Task 3.

- [ ] **Step 1: Write the failing tests**

Pin: a commissioner token is **denied** every officer endpoint; a role-manager token is allowed; creating with role `FieldOfficer` works; creating with `AnchalOffice` plus one of the six office ids works; creating with `Commissioner` is **rejected**; creating with `RoleManager` is **rejected**; creating an office login with no office id is rejected; creating with an office id that is not one of the six is rejected.

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Move the policy**

`[Authorize(Policy = MonitoringPolicies.Commissioner)]` → `RoleManager`.

- [ ] **Step 4: Widen create**

`CreateOfficerCommand` gains a role and an optional office id. Validate as the tests above require. Every rejection message needs a Hindi key — reuse an existing literal if one fits rather than inventing one.

- [ ] **Step 5: Confirm the created user behaves**

A created office login must have exactly one office assignment and satisfy `Office` and `OfficeScope` for its own office only. A created field officer must match a seeded one.

- [ ] **Step 6: Run the suite**

- [ ] **Step 7: Commit**

`feat: the role manager administers users, the commissioner no longer can`

---

### Task 3: The frontend follows

**Files:**
- Modify: `src/shared/types.ts`, `src/client/App.tsx`, `src/client/components/AppShell.tsx`, `src/client/pages/Officers.tsx`
- Test: extend `tests/ui/app-shell.test.tsx`; add a role-manager routing test

**Interfaces:**
- Consumes: Task 2's endpoints.

- [ ] **Step 1: Write the failing tests**

Pin: a role-manager session lands on the user administration screen; the commissioner has **no** route to it and no nav entry; the role-manager header reads its own paired label in both languages; the create form offers field officer and Anchal office **only**.

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Add the role**

`"office" | "commissioner" | "officer" | "rolemanager"` in `types.ts`. `ROLE_TITLE` in `AppShell` is a `Record<ShellRole, [en, hi]>`, so a fourth role is a compile error until named — add its paired label and **flag the Hindi for client review**.

- [ ] **Step 4: Move the screen**

`Officers.tsx` becomes the role manager's. Remove the commissioner's route and nav entry. The route should not exist for a commissioner rather than existing and refusing.

- [ ] **Step 5: Extend the form**

Add the role choice and, for an office login, the Anchal picker over the six existing offices.

- [ ] **Step 6: Run the suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 386 + your new tests, `tsc` clean.

- [ ] **Step 7: Screenshots**

390 and 1440, English and Hindi, of the role manager's screen including the create form with the role choice open.

- [ ] **Step 8: Commit**

`feat: the role manager gets a screen and the commissioner loses one`

---

### Task 4: Handover note

- [ ] **Step 1: Record the new credential**

The role manager is provisioned from `AnchalProvisioningCredentials` like every other seeded account, so **a credential must be supplied in the provisioning environment before deploy, or the account will not exist.** Add it to `docs/handover/go-live-operational-checks.md` with the other things that bite if forgotten.

- [ ] **Step 2: Commit**

`docs: the role manager needs a seeded credential before deploy`
