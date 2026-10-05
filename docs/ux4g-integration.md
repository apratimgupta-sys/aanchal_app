# UX4G integration — RMC Anchal portal

Implemented on `feature/ux4g-design`, 3 October 2026. User approved navy primary actions (`#153A62`), white backgrounds, light-grey panels and black text. The default presentation is light. Dark semantic tokens are supported and tested, without adding a theme switch to the product.

## Delivery and authoritative references

Pinned npm `ux4g-web-components@3.0.0`, using its documented `styles.css` and `design-system` imports once in `src/client/main.tsx`. No CDN assets are loaded at runtime. The supplied skill and design contract are saved under `.agents/skills/ux4g-design/`.

Research started at [UX4G ai.txt](https://web.ux4g.gov.in/ai.txt) and followed the linked [quick start](https://web.ux4g.gov.in/llms/quick-start.md), [catalog](https://web.ux4g.gov.in/catalog.json), [token index](https://web.ux4g.gov.in/llms/tokens.md) and relevant component/utility contracts. Exact input, button and colour declarations were cross-checked with the versioned 3.3.0 distribution. The installed npm CSS was checked for every class actually used. No legacy or mirror documentation was used.

## Component inventory

| Component               | Variant / size                                                  | Portal usage                                                                     |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Button                  | Filled primary / L                                              | Sign in, save balances, save entry/correction                                    |
| Button                  | Outline neutral / L                                             | Language, sign out, refresh, secondary actions                                   |
| Button                  | Tonal primary and text neutral / L                              | Selected and unselected portal navigation                                        |
| Input                   | Default and error / L                                           | Text, numeric, money and native date controls; registration date stays read-only |
| Textarea                | Default and error / L                                           | Remarks, delayed-reporting reasons and correction reasons                        |
| Native form select      | L                                                               | Dashboard view, Anchal and service filters                                       |
| Checkbox                | M, default/checked; 48px labelled target                        | Opening-balance confirmation                                                     |
| Card                    | Outline, vertical, elevated neutral background; XL body padding | Login, entry, filters, metrics, reports, history                                 |
| Table                   | M, zebra rows, responsive wrapper                               | Commissioner performance, service register, setup and audit                      |
| List                    | Default / M; 48px row targets                                   | Service selection; React owns selected state                                     |
| Context alert           | Error and success, contextual width                             | Errors and saved-entry feedback                                                  |
| Tag                     | Tonal neutral and success, documented default size              | Record status, report count and connection state                                 |
| Navbar                  | Default, application-owned navigation buttons                   | Today, Backdate and office history routes; commissioner dashboard/history        |
| Footer                  | Neutral surface and footer row                                  | RMC ownership and demonstration label                                            |
| Progress bar            | Sharp, outside label, default size                              | Submitted services out of 25                                                     |
| Divider                 | Horizontal, default size                                        | Login introduction                                                               |
| Material outlined icons | Default library size                                            | Submitted/not-submitted service indicators                                       |

`src/client/ui.tsx` contains application adapters around standard DOM. These are local helpers, not named exports claimed to exist in the UX4G package. Labels receive stable IDs; errors/helper text are connected through `aria-describedby`, and field errors set `aria-invalid`. Clickable input frames forward focus to the native control.

Utilities used include documented display/flex/align/justify/gap, padding/margin, typescale, background/text colours, radius, minimum height and width classes. Typography uses heading/display/title/body/label composites. The current radius utility is `ux4g-radius-m`; the supplied contract's `ux4g-radius-md` example does not exist in the installed release and was corrected in consuming markup.

## Root theme overrides

All approved theme values live in the root block of `src/client/styles.css`, with `!important`. Primary palette steps 50–950 form a navy ramp around the approved 600 value. Secondary 600/700/800 use grey/near-black. The rest of the neutral and semantic success/error/warning/info system remains the distributed UX4G theme.

The known low-contrast control boundary is fixed by aliasing `--ux4g-control-border-default`, `--ux4g-border-color-neutral-subtle` and `--ux4g-border-color-neutral-default` to `--ux4g-border-color-neutral-strong`. The actual shipped inputs/selects use the latter aliases, so overriding only control-border-default would be insufficient. This deliberately strengthens decorative dividers too.

Dark root overrides set primary strong/hover/stronger and link/brand text to lighter approved navy-ramp steps. Surfaces, spacing, radius, borders and text in application rules use existing UX4G semantic variables (`--ux4g-bg-*`, `--ux4g-text-*`, `--ux4g-padding-*`, `--ux4g-gap-column-*`, `--ux4g-gap-row-*`, `--ux4g-section-*`, `--ux4g-column-xl`, `--ux4g-ff`, `--ux4g-z-dropdown`). There are no invented token names or edits to package internals.

## Verification

- TypeScript checking and production build passed.
- Thirteen focused Chromium scenarios passed, including routed office setup, Today/Backdate separation, delayed-reporting and correction reasons, submission/live update, change history, month filters, deliberate zero activity, canceled route navigation and IST-midnight draft recovery.
- axe checks with WCAG 2 A/AA and WCAG 2.1 AA tags found no violations in scanned login, commissioner dashboard and daily-entry views, in light and dark themes.
- Login was checked at 390, 1100, 1500 and 1920px; dashboard and entry at mobile width. Page overflow assertions pass. Wide reports scroll inside their region.
- Keyboard skip link moves focus to main content; input focus outlines are visible. Native controls and buttons preserve keyboard behavior. Visible buttons, input frames, selects, textareas, summary controls and checkbox targets were checked against 44×44px.
- English/Hindi and desktop/mobile screenshots inspected. Dark login and dashboard screenshots inspected. Automated checks are not a complete manual WCAG or screen-reader audit.

The independent reviewer identified a vendor List runtime conflict: it changes `.active` before React asks whether to discard a draft. Reproduced with a failing browser test, fixed by intercepting row clicks in React capture before the vendor target listener, and verified by the now-passing cancel/accept regression. The review stopped at an account usage limit before a final assessment; remaining integration checks were performed locally.

## Gaps and known debt

- UX4G's full npm stylesheet embeds fonts: production CSS is approximately 8.38 MB (4.03 MB gzip), and the full runtime contributes to a 588 KB JS bundle. The published package has no documented slim export in its current export map. This branch preserves the required npm delivery rather than editing the package.
- The container Markdown contract lacks exact implementation/sizing guidance and the bundled container is redefined by other component rules. A dedicated application frame is used.
- Native date controls are retained within the UX4G Input contract for existing date semantics. Native `details`/`summary` are retained for threshold reasons and audit snapshots, using documented L button presentation/targets on summary rather than replacing the native disclosure with runtime-owned Accordion state.
- The static context-alert Markdown page lists exact structural classes but only provides toast code examples. The implementation uses the verified context-alert CSS structures and existing native live-region semantics; no undocumented dismissal behavior is added.
- No dark-theme preference UI or screen-reader certification is claimed. This is the existing demonstration portal.
- This branch is verified locally; hosted deployment and remote branch publication are separate actions.

## Custom CSS inventory

The inventory below covers every application rule outside the root theme blocks. UX4G owns component visuals. Remaining rules provide the application frame, ledger proportions, dense report widths, scoped scroll behavior and skip-link behavior. Fixed `rem`/`em` widths are application layout constraints, not replacement design tokens.

| Selector                                                          | Condition                  | Purpose                                                                            |
| ----------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `body`                                                            | All widths                 | Full-height application frame and base semantic surface.                           |
| `#root`                                                           | All widths                 | Full-height application frame and base semantic surface.                           |
| `main`                                                            | All widths                 | Full-height application frame and base semantic surface.                           |
| `.utility, .masthead, .portal-nav-wrap, .portal-footer`           | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.utility`                                                        | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.masthead`                                                       | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.monogram`                                                       | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.portal-nav-wrap > span`                                         | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.workspace`                                                      | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.section-heading p, .page-heading p`                             | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.panel`                                                          | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.login-layout`                                                   | All widths                 | RMC login composition, readable line lengths and responsive introduction.          |
| `.login-intro h1`                                                 | All widths                 | RMC login composition, readable line lengths and responsive introduction.          |
| `.login-intro > p, .intro-note`                                   | All widths                 | RMC login composition, readable line lengths and responsive introduction.          |
| `.login-card form`                                                | All widths                 | RMC login composition, readable line lengths and responsive introduction.          |
| `.intro-rule`                                                     | All widths                 | RMC login composition, readable line lengths and responsive introduction.          |
| `.entry-layout`                                                   | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.form-grid`                                                      | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.wide`                                                           | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.form-grid > div`                                                | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.report-toolbar .ux4g-input-container`                           | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.report-toolbar p`                                               | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.report-progress`                                                | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.report-progress strong span`                                    | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.service-list`                                                   | All widths                 | Bounded service-register scrolling, numeric IDs and status alignment.              |
| `.service-list .ux4g-list-item-row > span:nth-child(2)`           | All widths                 | Bounded service-register scrolling, numeric IDs and status alignment.              |
| `.service-number`                                                 | All widths                 | Bounded service-register scrolling, numeric IDs and status alignment.              |
| `.service-status`                                                 | All widths                 | Bounded service-register scrolling, numeric IDs and status alignment.              |
| `.balance-strip`                                                  | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.balance-strip span, .balance-strip strong`                      | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.closing-strip > span`                                           | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.message`                                                        | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.message button`                                                 | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.filters .ux4g-input-container`                                  | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.filters .service-filter`                                        | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.metrics`                                                        | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.metric`                                                         | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.metric > .ux4g-card-body > span, .metric strong, .metric small` | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.metric strong`                                                  | All widths                 | Application-specific ledger proportions and responsive information layout.         |
| `.table-wrap`                                                     | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `.monitoring-table`                                               | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `.details-panel table`                                            | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `.review-cell`                                                    | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `.nowrap`                                                         | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `.table-notes`                                                    | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `.live-dot`                                                       | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.short-field`                                                    | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.checkbox`                                                       | All widths                 | Portal-specific field widths, report arrangement and form feedback spacing.        |
| `.audit-values`                                                   | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `pre`                                                             | All widths                 | Wide ledger/audit content remains readable and scrolls within the report.          |
| `.empty`                                                          | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.portal-footer`                                                  | All widths                 | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.skip-link`                                                      | All widths                 | No UX4G skip-link component; position offscreen and reveal on keyboard focus.      |
| `.skip-link:focus`                                                | All widths                 | No UX4G skip-link component; position offscreen and reveal on keyboard focus.      |
| `.metrics`                                                        | @media (max-width: 1439px) | Application-specific ledger proportions and responsive information layout.         |
| `.form-grid`                                                      | @media (max-width: 1439px) | Application-specific ledger proportions and responsive information layout.         |
| `.utility,   .masthead,   .portal-nav-wrap,   .portal-footer`     | @media (max-width: 1023px) | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.workspace`                                                      | @media (max-width: 1023px) | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.masthead`                                                       | @media (max-width: 1023px) | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.login-layout`                                                   | @media (max-width: 1023px) | RMC login composition, readable line lengths and responsive introduction.          |
| `.login-intro h1`                                                 | @media (max-width: 1023px) | RMC login composition, readable line lengths and responsive introduction.          |
| `.intro-rule,   .intro-meta`                                      | @media (max-width: 1023px) | RMC login composition, readable line lengths and responsive introduction.          |
| `.entry-layout`                                                   | @media (max-width: 1023px) | Application-specific ledger proportions and responsive information layout.         |
| `.service-list`                                                   | @media (max-width: 1023px) | Bounded service-register scrolling, numeric IDs and status alignment.              |
| `.page-heading,   .section-heading`                               | @media (max-width: 1023px) | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.portal-nav-wrap > span`                                         | @media (max-width: 1023px) | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.metrics`                                                        | @media (max-width: 1023px) | Application-specific ledger proportions and responsive information layout.         |
| `.form-grid`                                                      | @media (max-width: 480px)  | Application-specific ledger proportions and responsive information layout.         |
| `.utility`                                                        | @media (max-width: 480px)  | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.wordmark`                                                       | @media (max-width: 480px)  | RMC branding, page headings, navigation/footer placement or responsive page frame. |
| `.balance-strip`                                                  | @media (max-width: 480px)  | Application-specific ledger proportions and responsive information layout.         |
| `.report-toolbar .ux4g-input-container,   .report-progress`       | @media (max-width: 480px)  | Portal-specific field widths, report arrangement and form feedback spacing.        |

### Readable audit history (5 October 2026)

History now presents service names and dates, and a field/previous/updated comparison for changed business values. Initial submissions show recorded values. Setup changes compare opening balances by service ID. Entry IDs, version counters, timestamps and derived balances absent from the original snapshot are excluded from the comparison; a metadata-only correction says “No entry values changed.” Stored audit snapshots remain unchanged. Invalid snapshots produce a friendly unavailable message.

Uses the installed `ux4g-web-components@3.0.0` and the existing verified medium zebra table, responsive table wrapper, and large text-neutral disclosure presentation. Approved root theme overrides remain in use; no custom CSS was added. The existing native-details contract exception remains. Chromium regression verified keyboard disclosure, readable changed values, light/dark axe WCAG AA scans, and no page overflow at 390px. No screen-reader certification is claimed; existing package debt remains as documented above.
