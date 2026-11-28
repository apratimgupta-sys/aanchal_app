# Commissioner dashboard — design

Date: 28 November 2026
Mockup (approved layout, sample figures): https://claude.ai/artifact/UqtdeQanM3yceorHCzGxPb

## Why

The Commissioner opens the dashboard to see progress: what each Anchal and each service
did, what was collected, and what field work happened and where. Today the page gives him
three totals and one table by Anchal. Nothing is broken down by service, by day or by ward,
there is no chart, and field visits do not appear at all.

The cause is the server. It returns one row per Anchal and nothing finer, although every
daily entry carries its service and date and every field visit carries its ward, officer
and its service's own figures.

## Goals

1. One page that shows the Commissioner, in tables and charts, the six things listed under
   "The page".
2. Every section has its own filters and can be changed without touching the others.
3. Every figure is calculated by the server from what was filed. The browser draws; it does
   not add up.
4. Field visits appear on the dashboard for the first time, with each field service showing
   the thing it counts.

## Not in this work

- Filing status. The Commissioner does not need to see which reports were filed or are
  still due. The filing panel, the headline tiles, the reports badge and any "filed"
  figure leave the page.
- Latest-updates feed, export, print, drill-down into single entries, a map, and
  comparing one period with another.
- Any change to how clerks or officers enter data, to the visit register, or to the
  opening-balances screen.
- Clearing old data. The owner will delete past data separately; this work needs no
  migration and makes no assumption about what is stored.

## What would make this a failure even if it works

- A figure on the dashboard that disagrees with what the offices filed.
- A total that adds unlike things (kilograms to metres, visits to trees).
- A blank shown as zero, or a zero shown as blank. Blank means "this service does not
  record that"; zero means "nothing happened".
- A section that fails and takes the rest of the page with it.

## Constraints

- Two repositories that must agree: frontend (`ui-rebuild`) and backend (`role-manager`).
  Backend ships first.
- No new dependencies in either. No chart library is installed and none is added.
- Styling is Tailwind utilities and theme tokens only; `index.css` keeps zero rules.
- Every visible string is an English/Hindi pair. New Hindi is a draft for the client's
  reviewer.
- Commissioner-only, like the present dashboard.
- Days are Indian calendar days. Voided visits never count.

## Approaches considered

1. **The server does the adding up (chosen).** New read-only calls return each section's
   figures already rolled up. The pending balance is the hard number and only the server
   derives it, so nothing is duplicated; responses are small.
2. **The browser does the adding up** from the raw entries the server already exposes. No
   backend work, but the browser would re-implement the pending-balance rule, and rules held
   on both sides have drifted on this project before. Rejected.
3. **Stretch the existing dashboard call** to carry every breakdown. Rejected: daily entries
   and visits are different sources with different rules, and one slow part would hold up
   the whole page.

The owner chose approach 1.

## The page

A header (title, "Figures as of", one Refresh button), then six sections in this order.
There is no page-wide filter bar. Each section is a card with its heading, its own filter
row, and its content.

Shared filter pieces:

- **Period**: Today, Past 7 days (today and the six days before), This month (the 1st to
  today), Custom (a from date and a to date, neither after today). The two chart sections
  leave out Today, because one day on a per-day chart is a single mark.
- **Anchal**: All offices, or one of the six.
- **Service**: named per section below.

Each section remembers its own choices while the page is open and starts from its default
on a fresh load.

### 1. Anchal-wise performance

Filters: Period (default Today), Service (All 10 services, or one).
A table, one row per Anchal and a total row: Received, Disposed, Pending, Disposal %,
Collected (₹). These are the figures the present table shows, with the same rule for a
pinned service: a figure the service does not record is left blank.

### 2. Field visits

Filters: Period (default Today), Anchal.
A line above the cards: how many visits, by how many officers. Then one card per field
service (eight), each showing its number of visits and the thing it counts:

| Service | Headline | Line beneath |
|---|---|---|
| Waste vehicle service | kilograms lifted (sum) | split by waste type: wet, dry, mixed |
| Fogging | routes covered (one per visit) | wards covered |
| Street dog service | dogs picked (sum) | dogs neutered (sum) |
| Street lighting | jobs (one per visit) | split by work type: repair, replace, shift |
| Road and drain construction | metres (sum) | split by structure: road, drain |
| Grass cutting | square metres cut (sum) | wards covered |
| Tree pruning | trees pruned (sum) | wards covered |
| Water body cleaning | sites cleaned (one per visit) | wards covered |

A split follows one rule: where the service has a number, the split is that number per
choice (kilograms per waste type, metres per structure); where it has none, it is visits per
choice (jobs per work type). A visit that left the choice blank is in the headline and in no
split. "Wards covered" is the count of different wards with a visit for that service.

There is no grand total across the cards. A visit's details are optional, so when some
visits in the period gave no figure, the card says how many ("2 without a figure") rather
than letting the sum quietly understate.

### 3. Where the visits were

Filter: Period (default Today).
All 53 wards as a grid of numbered cells, shaded in four steps by visits in the period:
none, 1, 2, 3 or more, with a key. A ward with visits also shows its count in figures under
its number, as well as by shade. The heading line says how many wards had none. This
section is about field visits only; a daily entry's ward is not charted.

### 4. Service-wise progress

Filters: Period (default Today), Anchal.
A table, one row per service on the daily entry (ten, in the daily entry's own order and
numbering) and a total row: Received, Disposed, Disposal %, Pending (with a small bar
comparing each service with the largest pending among them), Collected (₹). A figure a service does not record is blank. The three
collection services show their number of payments under the name.

### 5. Collection

Filters: Period (default This month; no Today), Anchal, Service (all that collect an
amount, or one of them).
The period's total collected, and a bar chart of the amount collected per day.

### 6. Received and disposed

Filters: Period (default This month; no Today), Service (all that take applications, or one
of them), Anchal.
A line chart with two lines per day, received and disposed, a legend, and the latest value
labelled at the end of each line.

## What the figures mean

- **Received, Disposed, Collected** for a period: sums of what was filed for the days in it.
- **Pending**: the closing balance on the period's last day, as the server already derives
  it. It is not a sum over days.
- **Disposal %**: disposed over received for the period; shown as a dash when nothing was received, as the Anchal table already does. A dash is a ratio with nothing received; a figure that was never recorded is left blank, and a recorded zero is shown as 0.
- **Totals and "all services"** cover only what the daily entry collects today, the same
  rule the present dashboard uses.
- **Per-day charts** show a zero for a day with nothing filed.
- **Visits** are counted on the visit's date, in the office and ward it was filed for.

## What the server provides

The present dashboard call stays as it is and feeds section 1. Three read-only calls are
added, all Commissioner-only and all taking a from date and a to date:

1. **By service** (optional Anchal): one row per daily-entry service with received,
   disposed, pending, disposal % and amount. Feeds section 4.
2. **By day** (optional Anchal, optional service): one row per day in the period with
   received, disposed and amount. Feeds sections 5 and 6. It refuses a period longer than
   92 days with a message the page can show.
3. **Visit summary** (optional Anchal): the number of visits and of officers; per field
   service, its visits, wards covered, each number field's sum and how many visits gave it,
   and each choice field's split; and visits per ward. Feeds sections 2 and 3, which call
   it separately because their periods differ.

The visit summary is worked out from each service's own field definitions, not from a list
written out per service, so a field added to a visit form later is summed without new code.
What a card calls its figure ("kg lifted") is wording, and lives with the page.

## Charts

Two small chart components are built by hand as SVG: a bar chart and a two-line chart.
They scale with the card, scroll sideways inside their card on a phone, and take their
colours from theme tokens (two series colours and a four-step ramp for the wards, each with
a light and a dark value that pass the colour checks used for the mockup). Hovering or
focusing a day shows its date and values. Each chart has a "View as table" switch that
shows the same days as a table, which is also what a screen reader is given. Text in and
around a chart uses the page's text colours, never a series colour.

## Behaviour

- **Loading**: a section keeps its last figures on screen while a new choice loads.
- **Nothing to show**: tables show zeros; the visit cards and the ward grid say there were
  no visits in the period.
- **Errors**: a failed section shows its own notice in its own card and the others carry on.
- **Staying current**: as now, the page refreshes itself every 15 seconds while its tab is
  visible and again when the tab regains focus; Refresh does it on demand.
- **Phone**: sections stack; filter rows wrap; tables and charts scroll inside their cards.
- **Language**: everything follows the language switch, including service names, chart
  labels and the wording on the visit cards.

## Left to the builder

- The exact shape and names of the three responses, and how the page code is split into
  files, provided each section is its own piece with its own data call.
- The exact tokens and dark-mode values for the chart colours, within the checks above.
- How the per-service bar in section 4 is drawn.

## Open with the client

- Units on the visit cards (kg, metres, square metres) and the meaning of "shift" are still
  to be confirmed by RMC, as before.
- "One visit is one route / one job / one site" is how Fogging, Street lighting and Water
  body cleaning are counted here. RMC should confirm that reads true to them.
- All new Hindi.
