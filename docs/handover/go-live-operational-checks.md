# Go-live operational checks

**For:** the week six Anchal offices start filing real entries.
**Who runs this:** whoever has access to the RSCCL production server and the Vercel project. None of it can be done from a development machine.

Four checks. Each has a pass condition and a line to write the result on. **If any one fails, the branches do not deploy until it passes** — these are the checks that decide whether a failure gets noticed by us or reported by an officer who could not file.

---

## 1. The health endpoint answers in production

**There are two health endpoints and only one of them checks the database. Watch the right one.**

- `/health` is a **liveness probe only**. `Program.cs:56` registers it with `Predicate = _ => false`, so it runs no checks at all and returns `200` for as long as the process is alive — database up or down. Useful for "is the process running", useless for "is the service working".
- `/health/commissioner-monitoring` is the real check. It runs the database check and returns `503` with a JSON body when the database is unreachable.

**Watch `/health/commissioner-monitoring`.** An uptime check pointed at `/health` is a green light wired to nothing.

```
curl -sS -o /dev/null -w '%{http_code}\n' https://<production-host>/health/commissioner-monitoring
```

**Pass:** `200`.

- Host: ______________________
- Response: ______________________
- Date checked: ______________________

If this returns 404, the deployed build predates the endpoint. If it returns 200 but the body is empty, check it is the real endpoint and not a proxy default page.

---

## 2. The health endpoint fails when the database is unreachable

This is the check that gives check 1 its meaning. An endpoint that returns 200 regardless of the database is a green light wired to nothing.

Point a **non-production** instance at an unreachable database — a wrong port in the connection string is enough — and call `/health/commissioner-monitoring` again.

**Pass:** `503`. (`/health` will still return `200`, by design. That is the whole reason this check exists.)

This was confirmed on 21 November 2026, as a side effect of running the backend suite with no local Postgres: the log showed `/health/commissioner-monitoring` returning 503 Unhealthy and `/health` returning 200 in the same run. So the behaviour is known-good — what remains is confirming it on the production host and pointing the monitor at the right path.

- Status observed: ______________________
- Instance used: ______________________

Do not do this against production.

---

## 3. Something watches it

An endpoint nobody polls tells nobody anything.

Any external checker will do. What matters is that it polls `/health/commissioner-monitoring` — not `/health` — about once a minute, and alerts somewhere a person actually reads — not an inbox nobody opens, and not a dashboard someone has to remember to visit.

**Pass:** a check exists, and a test alert has been received.

- Service used: ______________________
- Alert destination: ______________________
- Test alert received: ______________________

The destination matters more than the tool. If the only person who sees the alert is on leave, the check has not been set up.

---

## 4. One restore has actually been rehearsed

**A backup that has never been restored is not yet a backup.** This is the only check here that proves the others matter — the rest tell you something broke; this one tells you the data survives it.

1. Take a dump of the RSCCL production database.
2. Restore it into a scratch database on the same server.
3. Compare two counts between source and restore:

```sql
select count(*) from monitoring_audit_events;
select count(*) from monitoring_offices;
```

**Pass:** both counts equal.

- Audit events — source: __________ restore: __________
- Offices — source: __________ restore: __________
- Date rehearsed: ______________________

The audit-event count is the one that matters. Entries are stored as versioned JSON snapshots in `monitoring_audit_events`; balances are derived at read time rather than stored. If that table restores short, entries are gone, and no other table can rebuild them.

Delete the scratch database afterwards.

---

## Who administers users

User administration moved to a dedicated account. **The commissioner can no longer add, deactivate
or reset anyone.** That screen is gone from the commissioner's portal; the route itself refuses a
commissioner token.

A new seeded login, `rolemanager`, does that work and nothing else. It has no Anchal, sees no
entries, no dashboard figures and no correction history — every monitoring route refuses it. Its
only screen is the user list.

**It needs a password in the provisioning file before the next deploy, or the deploy fails.** See
the credentials note under "Known gaps" below; that failure stops the whole deploy, not just this
account.

### What the role manager can do

- Create a **field officer** (files visits from the field) or an **extra Anchal office login**
  (files daily entries for one of the six Anchals). Both bind to exactly one existing Anchal.
- Deactivate and reactivate those accounts.
- Reset their passwords, which issues a temporary one the user must change at next sign-in.

### What it deliberately cannot do

- **It cannot see or touch the commissioner, or itself.** Those two accounts are not in its list and
  its routes return "not found" for them. So it cannot lock out the commissioner, cannot reset the
  commissioner's password, and cannot lock itself out. The cost of that safety is in the next
  section: a lost password on either account cannot be recovered from inside the product.
- **It cannot create another commissioner or another role manager.** Both are seeded fixtures only.
- **It cannot create a new Anchal.** The six are fixed; a new login attaches to one of them.

### Two behaviours worth telling the operator about

**Deactivating an Anchal's only active login stops that Anchal filing.** The confirmation says so by
name when that is the case. It is fully reversible — reactivate and the account works again, with
the same password — but until then that office cannot file its daily entries, and the commissioner's
dashboard will show it as not filed.

**A password reset takes effect immediately, including for someone already signed in.** A clerk
working in the portal when their password is reset is sent to the change-password screen on their
next action rather than continuing on the old password. Expect the support call: "it asked me to
change my password in the middle of entering data." Nothing entered and saved before that point is
lost; an unsaved form is.

### What the commissioner kept

The commissioner can still **read** the list of field officers, because the visit register filters
visits by officer and that dropdown needs the names. It is read-only and shows field officers only —
no Anchal office logins, no commissioner, no role manager. Reading it reveals nothing the visit
rows do not already print.

### A lost commissioner or role-manager password has no recovery path

**Redeploying with a new password in the provisioning file does not change an existing account's
password.** The provisioner creates accounts that are missing and leaves accounts that exist alone —
it only verifies their role and office. So changing a credential in the environment and redeploying
is silently a no-op for any account already in the database.

For the six Anchal logins and any field officer, this does not bite: the role manager resets them.
For the **commissioner** and the **role manager** nothing resets them, by design — neither account
appears in the other's list. If either password is lost, recovery is a direct database operation on
`monitoring_users` (delete the row and redeploy, or write a fresh hash), performed by whoever
administers the RSCCL server.

This was already true of the commissioner before this work. It matters more now, because the
commissioner can no longer reset anyone either, so there is no account that can rescue another.

**Tell RMC to store both passwords somewhere they will survive a laptop change.** That is the whole
mitigation.

### Hindi still to review

The user-administration screen is new, so its Hindi has not been read by a native speaker: the
screen title, the account label, the add-user form's fields including the two role options, and the
deactivate, reset and temporary-password sentences. Three server messages have no
Hindi at all and currently show in English — `Select a valid role`, `That username is already
taken` and `Officer not found`.

---

## Known gaps that are not checks

Recorded here so they are not discovered during go-live week.

**The provisioning credentials file now needs eight lines, not seven — a deploy with seven fails.**
The role-manager account is seeded like every other fixed account, and the provisioner requires
one password for *each* approved account, exactly. An existing credentials file carrying the six
Anchals and the commissioner will now throw `Provide one 12-128 character password for each of
the eight approved monitoring accounts.` and **the entire deploy stops** — not just the role
manager.

That hard failure is deliberate and is better than the alternative: a deploy that quietly comes up
with no administrator account is worse than one that refuses to start. But it means the credentials
file must be updated **before** the next deploy, not after it fails.

Add a line for `rolemanager`, 12–128 characters, alongside the others.

**Adding a 54th ward is not a one-line change.** Ranchi has had 53 wards since the last delimitation, so this is not urgent — but when it changes, four places need editing and only the first is a constant:

1. the ward bound constant in each repo
2. the message `Select a ward from 1 to 53` in each repo — this **cannot** be built from the constant, because it is the exact string the client matches on to find its Hindi translation
3. the Hindi translation of that message
4. a new database migration, because the field-visit ward check constraint carries 53

A test now fails if the constant and the English message disagree. Nothing can catch the Hindi string or the constraint.

**The ward field's label changed** from "Ward number / name" to "Ward". The ward master's locality names are deliberately not shown in the picker — it offers numbers only. Any SOP or training material quoting the old label needs updating.

**Documents that no longer match the product:**
- the office SOPs still describe the earlier nine-field entry form
- the Commissioner's Guide states that account is read-only, which is not correct

**Still needed from RMC:**
- the ward-to-Anchal mapping
- the field officer roster
- a decision on photograph storage (the option is disabled at their request)
- Hindi names for nine of the twenty-five services, which currently hold English text in the Hindi field

**The `monitoring_reports.IsZeroActivity` column can now disagree with an entry that says "nothing to report".**
An office can mark a service as nothing-to-report while that entry still carries a figure from when the form collected more fields. The report-level column is computed strictly, so it records `false` next to an entry whose flag says otherwise. Nothing reads the column today, and `false` is the conservative value — the day did carry a figure. But whoever first builds ward-level or zero-activity reporting will find the column before they find any of this, and will reasonably read it as the office's own statement. It is not a substitute for the per-entry flag.

**Correcting a seeded entry in demo or staging silently rewrites its ward.**
Ward is now picked from a list of 53. A seeded entry holding free text — `24`, or `Ward 11 — Konka` — shows a blank picker when opened for correction, and the clerk must choose a ward before saving. That is not a dead end, and no production entry exists so no real record is affected. But it means a correction in staging changes a field the clerk did not intend to touch. Reseed staging with canonical `Ward N` values before using it for training.

**The `VerifiedOnSite` database column is retained but unused.** Nothing reads it and nothing computes it; new rows get `false` from the entity default. It stays because dropping it needs a migration, which was deliberately avoided during go-live week. Drop it alongside the next schema change that needs a migration anyway.
