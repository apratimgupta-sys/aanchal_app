# Shadcn Government UI Migration Design

## Status

Proposed design for review. This document defines the UI migration only; implementation begins after approval of this specification and a separate implementation plan.

## Intent

Replace the current UX4G-based visual system with a Shadcn-style component system while preserving the portal's business behavior, bilingual workflows, and existing government-oriented navy, grey, white, and neutral palette.

The new interface should feel sober and institutional without feeling dense or intimidating. An Anchal office user should be able to complete setup, submit a daily or backdated report, understand validation errors, and recover from failures without technical knowledge. A commissioner should be able to scan status and drill into reports efficiently.

## Users and success criteria

### Office users

- Can identify their current office, active route, reporting date, and submission state.
- Can complete first-time setup with clear field-level guidance and a useful summary before saving.
- Can enter, validate, save, edit, and correct reports without losing context.
- Can distinguish required fields, invalid values, server failures, saved state, and unsaved changes.

### Commissioners

- Can reach dashboard and history from persistent navigation.
- Can scan key metrics and report status on desktop and mobile.
- Can filter and inspect details without the table forcing the entire page wider than the viewport.

### Shared success criteria

- Every interactive state has a visible and accessible response: loading, empty, success, error, retry, disabled, and unsaved changes.
- Forms use consistent field labels, descriptions, required indicators, field-level errors, form-level errors, and submit progress.
- The portal is usable at desktop, tablet, and narrow mobile widths without clipped controls or accidental horizontal page scrolling.
- Existing domain, API, authentication, role isolation, date, balance, correction, and audit rules remain unchanged.
- Existing Playwright acceptance coverage continues to pass, with design assertions updated to the new component contract.

## Non-goals

- No backend rule, API contract, database schema, or authentication-model changes.
- No new operational modules such as grievance management, evidence uploads, staff management, or commissioner directions.
- No replacement of the current palette with a new brand palette.
- No attempt to preserve the current UX4G markup or visual layout pixel-for-pixel.

## Proposed approach

Use the standard Shadcn foundation in the existing React/Vite application:

- Tailwind CSS for layout, responsive variants, spacing, typography, and state styling.
- Radix primitives where interaction and accessibility benefit from a proven primitive, especially Sheet, Dialog, DropdownMenu, Select, Checkbox, Tooltip, and AlertDialog.
- `class-variance-authority` and `clsx` for component variants and conditional classes.
- Lucide icons for restrained, familiar visual cues with text labels retained where meaning matters.
- Local, owned UI components under `src/client/components/ui`, with application-level compositions under `src/client/components`.
- CSS variables as the source of truth for the existing palette, so the theme can be tuned without rewriting component classes.

The migration should be incremental by layer: foundation and shell first, shared controls second, page compositions third, then test and accessibility updates. Existing behavior and API calls remain in place while presentation components are replaced.

## Visual system

### Palette

Preserve the current visual direction:

- Deep navy for primary actions, active navigation, headings, and institutional identity.
- Light blue-grey and neutral grey for page surfaces, secondary surfaces, borders, and muted text.
- White or elevated neutral surfaces for cards, forms, and tables.
- Existing semantic success, warning, error, and informational colors, adjusted only when needed for accessible contrast.

Expose these through Shadcn-compatible CSS variables such as `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, and their semantic equivalents. Do not retain UX4G token names as the application styling contract.

### Typography and density

- Use a highly readable sans-serif stack with generous line-height for Hindi and English.
- Keep headings restrained; hierarchy should come from size, weight, spacing, and location rather than decorative effects.
- Use consistent control heights and touch targets of at least 44px for primary interactions.
- Use helper text and summaries instead of relying on tooltips for essential instructions.

## Application shell

### Desktop

- A compact left sidebar contains the RMC identity, role-aware navigation, active-route indicator, and a lower utility area for language and sign-out.
- The main content has a stable max-width, page title region, optional breadcrumbs/context, and an area for notices.
- The sidebar remains visually quiet; active state uses the existing navy palette and a clear text/icon treatment.

### Mobile and tablet

- The sidebar becomes a Radix Sheet drawer opened by a labeled menu button.
- The top bar keeps the page title/context, language control, and user identity available without overcrowding.
- Navigation closes after route selection and preserves unsaved-form guards.
- Content uses one-column layouts by default; dense reports use contained horizontal scrolling with an explicit scroll affordance.

### Global states

- Loading: skeletons for dashboard cards/tables and a clear progress state for forms; avoid blank pages.
- Empty: explain why there is no data and what action, if any, can produce it.
- Success: use a non-disruptive status notice and reset/redirect only when the workflow requires it.
- Error: show a page-level alert for request failures, field-level errors for invalid fields, and a retry action when retrying is safe.
- Session expiry: preserve safe local draft data where already supported, explain the sign-in requirement, and provide a direct recovery action.
- Unsaved changes: keep the existing confirmation behavior, implemented with an accessible AlertDialog rather than a browser-only prompt where practical.

## Component contract

Create and test a small set of reusable primitives before migrating pages:

- `Button`: primary, secondary/outline, ghost, destructive, and loading states.
- `Input`, `Textarea`, `Select`, `Checkbox`, and `Field`: consistent labels, descriptions, required state, invalid state, and error text.
- `Card`, `Badge`, `Alert`, `Skeleton`, `Progress`, `Separator`, and `Table`.
- `Sheet` for mobile navigation and `Dialog`/`AlertDialog` for confirmation and focused tasks.
- `PageHeader`, `FormSection`, `FormActions`, `StatusNotice`, `EmptyState`, and `DataTableFrame` as application-level compositions.

Each form control must support forwarded refs, native name/value behavior, disabled state, `aria-invalid`, `aria-describedby`, and stable IDs. Error text must be programmatically associated with the control. Submit buttons must expose a busy state and prevent duplicate submissions while a request is pending.

## Form and error behavior

### Client validation

- Validate required fields, numeric bounds, integer constraints, dates, and cross-field rules before submission.
- Keep entered values visible after validation failure.
- Place field errors next to the offending control and summarize the first actionable error near the form heading.
- On submit failure, move focus to the form error summary only when focus movement helps recovery; do not steal focus during passive server updates.

### Server validation and request failures

- Map structured API validation errors to fields when possible.
- Display unknown or network errors in a page-level alert with a retry action.
- Keep the form editable after a failure unless the server confirms the mutation succeeded.
- Disable only the controls involved in the active request; do not make the whole page appear frozen.
- Make duplicate-submit protection explicit through loading text and disabled state.

### Workflow-specific behavior

- Setup: show completion progress for all 25 services, preserve draft values, and require explicit confirmation of zero balances where applicable.
- Daily/backdated entry: show the selected service and date context persistently, surface delayed-reporting and correction reasons as first-class fields, and distinguish draft, saved, and corrected states.
- Dashboard/history: show filter loading, no-result, stale-data, and request-error states without removing the filter controls.

## Page migration order

1. Theme foundation and component utilities; remove UX4G imports and token dependencies.
2. Authenticated shell, sidebar/drawer, header, language control, and sign-out.
3. Login and first-time office setup.
4. Daily entry and backdate entry, including validation, draft protection, and submit states.
5. Commissioner dashboard, metrics, filters, responsive tables, and detail views.
6. Change history and correction dialogs.
7. Browser tests, accessibility checks, screenshots, and responsive regression coverage.

## Testing strategy

- Run typecheck, unit/domain tests, worker tests, production build, and Playwright browser tests after each migration layer.
- Add component tests for field error association, disabled/loading submit behavior, dialog confirmation, mobile drawer navigation, and empty/error states.
- Extend Playwright coverage at representative widths for login, setup, daily entry, backdate, dashboard, history, language switching, unsaved changes, and session-expiry recovery.
- Keep mutation tests for invalid counts, negative values, excessive completions, invalid dates, missing reasons, duplicate submissions, stale versions, failed requests, and rapid repeated clicks.
- Run axe checks against the new shell and each primary workflow.

## Risks and mitigations

- **Large class migration:** migrate route-by-route behind shared primitives; do not rewrite business logic with the visual layer.
- **Responsive table complexity:** constrain scrolling to table regions and provide mobile-friendly summaries for the most important columns.
- **Hindi layout expansion:** test long labels and messages at narrow widths; allow wrapping and avoid fixed-width text containers.
- **Error-state inconsistency:** centralize API error normalization and use a single alert/field-error contract.
- **Accessibility regressions during replacement:** use Radix primitives where appropriate and retain automated axe plus keyboard-flow tests.
- **Unintended backend coupling:** keep `api`, session, navigation, and domain hooks outside presentational components.

## Acceptance criteria

The migration is ready for implementation completion when:

- No production page imports UX4G styles, design-system modules, or relies on `ux4g-*` classes.
- The Shadcn component contract covers every interactive control used by the portal.
- Desktop, tablet, and mobile flows are usable without page-level horizontal overflow.
- All primary forms provide field-level and form-level error handling, safe retry behavior, and duplicate-submit protection.
- Existing business and API behavior is preserved and the full verification suite passes.
- A keyboard-only and screen-reader-oriented review finds no missing labels, inaccessible dialogs, or unreachable navigation actions.
