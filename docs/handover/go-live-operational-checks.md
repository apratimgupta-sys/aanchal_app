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

## The field-visit details release deploys backend first

**Deploy the backend, and let it finish, before the frontend goes out.** The new visit form sends an
`input.details` object that a backend from before this release does not know. It does not refuse it:
the request reader skips members it has no field for, stores the visit without them and answers 201.
An officer on the new form with the old backend files dogs picked, pole number and tree count, and the
figures are gone from the server with nothing in any log to show it.

The form now compares what came back with what it sent and, if the details are missing, tells the
officer in so many words and keeps what they typed. That turns a silent loss into a visible one; it
does not recover the figures, and every visit filed in the gap still has to be re-keyed by hand. The
fix is the order, not the notice. The reverse order is safe: a new backend accepts a form that sends no
details exactly as before.

---

## Who administers users

User administration moved to a dedicated account. **The commissioner can no longer add, deactivate
or reset anyone.** That screen is gone from the commissioner's portal, and the three write routes
(create, deactivate and reactivate, reset password) refuse a commissioner token. The commissioner
keeps one read-only route, the field-officer list, described under "What the commissioner kept".

A new seeded login, `rolemanager`, does that work and nothing else. It has no Anchal, sees no
entries, no dashboard figures and no correction history — every monitoring route refuses it. Its
only screen is the user list.

**It needs a password in the provisioning file before the next deploy, or the account is never
created.** See the credentials note under "Known gaps" below. Whether that also stops the deploy
depends on how the deploy pipeline is set up, which this repository does not control.

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
the same password — but until then that office cannot file its daily entries. The commissioner's dashboard will show it as
"Not filed" once a day passes with nothing submitted, and it does not say that the cause is a
deactivated login.

**A password reset takes effect immediately, including for someone already signed in.** The server
refuses a clerk's next request, and the portal then takes them to the change-password screen. That
screen asks for their *current* password, which by then is the temporary one the role manager has
just generated, so the clerk cannot get past it until they have been handed that password. The
screen says so. Expect the support call: "it asked me to change my password in the middle of
entering data." Nothing entered and saved before that point is lost; an unsaved form is. In
practice a reset means: give the user the new password first, then expect them to type it in.

### What the commissioner kept

The commissioner can still **read** the list of field officers, because the visit register filters
visits by officer and that dropdown needs the names. It is read-only and shows field officers only —
no Anchal office logins, no commissioner, no role manager. Each entry carries the officer's name,
designation, home Anchal, login username and whether the account is active; the name and designation
are already printed on every visit row, the username and active state are not.

### A lost commissioner or role-manager password has no recovery path

**Redeploying with a new password in the provisioning file does not change an existing account's
password.** The provisioner creates accounts that are missing and leaves accounts that exist alone —
it only verifies their role and office. So changing a credential in the environment and redeploying
is silently a no-op for any account already in the database.

For the six Anchal logins and any field officer, this does not bite: the role manager resets them.
For the **commissioner** and the **role manager** nothing resets them, by design — neither account
appears in the other's list. If either password is lost, recovery is a direct database operation on
`monitoring_users`, performed by whoever administers the RSCCL server: **write a fresh password hash
onto the existing row** (`"PasswordHash"`), and set `"MustChangePassword"` to true so the person
chooses their own at next sign-in.

**Do not plan on deleting the row.** The database may refuse it. `monitoring_field_visits."VoidedByUserId"`
has a foreign key to `monitoring_users` with restrict-on-delete, and voiding a visit is a
commissioner-only action, so once the commissioner has voided a single visit, deleting the commissioner
row fails with a foreign-key violation. Deleting and redeploying to re-seed is therefore not a recovery
for the commissioner, and finding that out mid-outage means improvising on a production database. (The
role manager's row is referenced by nothing, so deleting it works, but writing a hash is the one method
that works for both.) The hash must be produced the way the application produces it, with the
application's own password hasher; a hash made any other way will not verify.

This was already true of the commissioner before this work. It matters more now, because the
commissioner can no longer reset anyone either, so there is no account that can rescue another.

**Tell RMC to store both passwords somewhere they will survive a laptop change.** That is the whole
mitigation for a *lost* password.

### The commissioner's and role manager's own passwords can now be changed

Until now neither the commissioner nor the role manager could change their own password from inside
the product at all; the password was whatever had been typed into the provisioning file, for the life
of the system. Both accounts can now change their own password from the portal.

This matters for more than a lost password. The real case is **rotation when a person with access
leaves**: whoever ran the deploy, or held the credentials file, knew these passwords, and the
role manager's password can create, deactivate and reset every other login. Before this change the
only way to rotate it was the direct database write above. Now the account holder changes it in the
portal, and nobody else needs to be involved. Changing the credential in the provisioning file and
redeploying still does nothing for an account that already exists, so the portal is the way to rotate,
not the file.

### Hindi still to review

The user-administration screen is new, so its Hindi has not been read by a native speaker: the
screen title, the account label, the add-user form's fields including the two role options, and the
deactivate, reset and temporary-password sentences, the note on the change-password screen that
the current password may be the temporary one an administrator has just reset, and the login screen's
confirmation that a password was changed. Four server messages
now have Hindi that has not been read by a native speaker either — `Change your temporary password
before using the portal`, `Select a valid role`, `That username is already taken` and `Officer not
found`.

One concrete note for the reviewer, found during review rather than translation: the two branches of
the deactivate confirmation disagree on verb agreement — masculine singular for the office login
against honorific plural for the field officer, in the same dialog. Whichever is right, they should
match.

---

## Field work must not leave the daily entry before officers can sign in

This release stops Anchal clerks reporting the eight field-work services on the daily entry. Those
services move **entirely** to field officers, who file them as visits.

**So it must not be deployed until field officers are provisioned and able to sign in.** Shipped
before that, nobody reports field work at all — not the clerk, who can no longer see those
services, and not the officer, who cannot log in. There is no partial state: the figure simply
stops existing.

Two things have to be true first.

**RMC must have supplied the officer roster**, and those officers must have accounts. The role
manager creates them.

**The work must reach production at all.** As of writing it does not. The branches `ui-rebuild`
(frontend) and `role-manager` (backend) have never been merged, and each host builds production
from its production branch — so every push has produced a preview deployment while the production
alias keeps serving a build that predates the field-officer role entirely. That is why "field
officers cannot log in to production" has stayed open: not a hosting misconfiguration, but work
that has never landed on the branch production is built from. Merging those two branches is the
fix, and it is a decision for whoever owns the release, not a step to take quietly.

Until both hold, this release is built and tested but should sit unshipped. The preceding section's
rule still applies when it does ship: **backend first**.

### What changes for the commissioner

The dashboard loses the **"Work done this period"** tile and the **"Work done"** column. They were
fed by the clerk's figure, so after the cutover they would have read zero — which does not say "this
moved elsewhere", it says "no work was done". Per-service reporting from the visits themselves is
deliberately deferred until officers are filing real data.

The service filter and the reports count both drop for the same reason. With the services taken off the daily entry by decision (next section) they now stand at **10**.

### What does not change

The eight services stay in the system. Field visits and the officer's own list
are untouched. The visit register still lists every visit ever filed, including visits for services
the form no longer offers, but its Activity filter now offers only the eight field-work services.
Every daily entry already filed against those services is kept. It is reachable by
whoever can query the database or the API (`/office/history` and `/office/entries`), but not
through the portal: no screen shows it, the clerk's register has no row for those services, and
nothing in the frontend reads the audit trail. Such an entry can no longer be **corrected** by a clerk: the figure now belongs to
officers, so the server refuses the correction rather than leaving two writable sources.

## Services taken off the daily entry by decision

Six services are hidden from the clerk's daily entry: Pradhan Mantri Awas Yojana, SSG Group, Vendor
licence, PM SVANidhi licence, Revolving fund and Self employment programme. A seventh, Community hall
booking, is removed from it. The daily entry now lists **ten** services.

Hidden and removed behave the same in the product today: the service is not offered, the server
refuses a daily entry for it, and it is left out of the dashboard's filter, counts and totals. A
hidden service can be brought back by deleting its id from three places together:
`src/shared/daily-entry-withdrawn.json` (frontend), the `HiddenFromDailyEntry` set in
`MonitoringRules.cs` (backend), and `dailyEntryWithdrawn` in the golden fixture in both repos.

Entries already filed for these services are kept in the database but cannot be corrected through
the portal.

**Known gap:** the opening-balances screen still asks for all 25 services. A balance entered there
for a hidden service is ignored by the dashboard, and if that service is later un-hidden the balance
will be as old as the day it was typed.

A withdrawn service's opening *complaint* or *field* balance (as distinct from its service pending
balance) is still counted in the dashboard's unpinned figures. Gating those the same way would also
remove the eight field-work services' field balances from the Field pending figure, which is
deliberate, so it was left alone. It only arises if someone typed such a balance on the
opening-balances screen, which still lists all 25 services.

The field visit form and the register's filter now offer only the eight field-work services, and the
server refuses a new visit for anything else; visits already filed for other services stay listed.

**Deploy order: backend first.** If the frontend ships first, clerks lose the seven services while
the old backend still expects 17 reports a day, so every office reads as partly filed until the
backend follows.

## Known gaps that are not checks

Recorded here so they are not discovered during go-live week.

**The provisioning credentials file now needs eight lines, not seven — with seven, provisioning seeds nothing.**
The role-manager account is seeded like every other fixed account, and the provisioner requires
one password for *each* approved account, exactly. An existing credentials file carrying the six
Anchals and the commissioner will now throw `Provide one 12-128 character password for each of
the eight approved monitoring accounts.`, and the `provision` command exits non-zero having seeded
nothing — not even the accounts that were valid.

`provision` is a separate command (`provision --credentials-file …`), not part of starting the API.
The API starts normally whether or not provisioning ever ran. So **the deploy pipeline must be
configured to treat a non-zero exit from `provision` as a failed deploy.** If it does not, for
example a script that runs migrate, provision and restart without stopping on error, the failure is
logged, the portal comes up, and there is no `rolemanager` account and no visible error. Confirm that
with whoever owns the RSCCL pipeline; it is not defined in either repository.

Either way, the credentials file must be updated **before** the next deploy, not after it fails.

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
