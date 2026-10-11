---
version: alpha
name: BloodLedger Clinical Operations Console
description: Draft visual-system baseline for the BloodLedger research prototype, migrated from the reviewed frontend mockup and reconciled with official repository requirements.
colors:
  primary: "#9A1B1B"
  primary-hover: "#6F0F0F"
  primary-container: "#F6E5E5"
  on-primary: "#FFFFFF"
  canvas: "#F4F1EB"
  canvas-subtle: "#ECE7DD"
  surface: "#FFFFFF"
  surface-subtle: "#FAF8F3"
  chrome: "#0F1620"
  chrome-raised: "#1A2230"
  chrome-hover: "#232C3D"
  ink: "#0E1218"
  ink-plain-text: "#111111"
  ink-secondary: "#3A4250"
  ink-muted: "#697181"
  ink-faint: "#9098A6"
  on-chrome: "#E6E2D8"
  on-chrome-muted: "#9098A6"
  line: "#DCD6C8"
  line-subtle: "#E8E3D8"
  line-strong: "#B9B2A1"
  critical: "#C12F2F"
  critical-container: "#FBE7E7"
  warning: "#9A5708"
  warning-container: "#FBEFD8"
  success: "#286F52"
  success-container: "#E1F0E7"
  information: "#234F9E"
  information-container: "#E2EAF8"
  neutral-container: "#ECE7DD"
typography:
  display-page:
    fontFamily: 'Newsreader, "Source Serif Pro", Georgia, serif'
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: -0.015em
  display-stat:
    fontFamily: 'Newsreader, "Source Serif Pro", Georgia, serif'
    fontSize: 38px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.02em
  headline-modal:
    fontFamily: 'Newsreader, "Source Serif Pro", Georgia, serif'
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.015em
  headline-card:
    fontFamily: 'Inter, "Helvetica Neue", system-ui, sans-serif'
    fontSize: 13.5px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.01em
  body-md:
    fontFamily: 'Inter, "Helvetica Neue", system-ui, sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
  body-sm:
    fontFamily: 'Inter, "Helvetica Neue", system-ui, sans-serif'
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
  label-action:
    fontFamily: 'Inter, "Helvetica Neue", system-ui, sans-serif'
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.005em
  label-caps:
    fontFamily: 'Inter, "Helvetica Neue", system-ui, sans-serif'
    fontSize: 10.5px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.14em
  data-mono:
    fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0em
rounded:
  xs: 3px
  sm: 5px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  micro: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 14px
  xl: 18px
  2xl: 24px
  3xl: 28px
  4xl: 64px
  sidebar: 232px
components:
  app-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
  canvas-subtle:
    backgroundColor: "{colors.canvas-subtle}"
    textColor: "{colors.ink}"
  sidebar:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.on-chrome}"
    width: "{spacing.sidebar}"
  sidebar-raised:
    backgroundColor: "{colors.chrome-raised}"
    textColor: "{colors.on-chrome}"
  sidebar-muted:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.on-chrome-muted}"
  sidebar-item:
    backgroundColor: transparent
    textColor: "{colors.on-chrome}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  sidebar-item-hover:
    backgroundColor: "{colors.chrome-hover}"
    textColor: "{colors.on-primary}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-action}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-action}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label-action}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  metadata-faint:
    textColor: "{colors.ink-faint}"
    typography: "{typography.body-sm}"
  divider:
    backgroundColor: "{colors.line}"
    height: 1px
  divider-subtle:
    backgroundColor: "{colors.line-subtle}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.line-strong}"
    height: 1px
  table-header:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-caps}"
    padding: "{spacing.md}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  chip-neutral:
    backgroundColor: "{colors.neutral-container}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  chip-critical:
    backgroundColor: "{colors.critical-container}"
    textColor: "{colors.critical}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  chip-warning:
    backgroundColor: "{colors.warning-container}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  chip-success:
    backgroundColor: "{colors.success-container}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  chip-information:
    backgroundColor: "{colors.information-container}"
    textColor: "{colors.information}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    width: 640px
    padding: "{spacing.2xl}"
  toast:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.on-chrome}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# BloodLedger Design System

## Overview

BloodLedger is a calm, information-dense clinical operations console for a
synthetic research prototype. It should feel closer to a laboratory information
system or a restrained trading desk than to a consumer health application:
serious, fast to scan, explicit about provenance, and composed under pressure.

The visual system combines a warm paper canvas, white data surfaces, near-black
navy application chrome, editorial serif headings and numerals, disciplined
sans-serif interface text, and monospaced technical evidence. Deep blood red is
scarce and purposeful. It identifies the product and the primary action; it is
not decoration.

Three qualities govern every screen:

1. **Density with hierarchy.** Tables, matrices, timelines, and status summaries
   may be dense, but page heads, KPI tiles, card headers, and consistent spacing
   must provide immediate scan points.
2. **Safe provenance.** Inventory, alert, request, and transfer claims expose
   permitted transaction references, versions, timestamps, and status history.
   Restricted location evidence, secrets, identities, and unrelated
   institution detail are never exposed merely to make a screen look auditable.
3. **Calm urgency.** Critical and warning states are unmistakable but never
   theatrical. Do not flash, shake, pulse whole panels, or interrupt users with
   non-critical modal alerts.

### Authority and source boundary

This file is the visual-design home for the official application. It follows
Google Labs' DESIGN.md alpha format and translates the mockup's visual language
into machine-readable tokens plus implementation guidance.

Source precedence is:

1. Official requirements, architecture decisions, privacy rules, and the active
   sprint determine behavior, authorization, terminology, and scope.
2. This file determines the reviewed visual language.
3. The separate frontend mockup supplies visual and interaction references when
   they agree with the first two sources.
4. Prototype code structure, global variables, runtime Babel, CDN dependencies,
   fixture behavior, credentials, topology claims, and tweak controls are not
   implementation requirements.

The approved visual source is `MOCKUP_VISUAL_2026-08-20`, recorded with
per-file hashes in `docs/frontend/MOCKUP_REFERENCE.md` and aggregate SHA-256
`1e625671c6122c73a50cddae4d85ddc0602879ecd521bb72831e1c3df8a27b48`.
It derives from mockup commit `74a8385` plus the approved local visual changes
observed on 2026-08-20. Unsafe fixtures and prototype runtime behavior are not
part of the design snapshot.

This document describes a research prototype. It does not claim clinical
validation, regulatory approval, compliance certification, or production
readiness.

### Audience compositions

Blood-bank institutions share one operational dashboard composition, shell, and
component vocabulary. Institution name, local inventory, requests, transfers,
alerts, freshness, and permitted actions come from the authenticated server
principal. Different institution content must not produce duplicated
per-hospital pages, folders, themes, or hard-coded layouts.

Philippine Red Cross Lipa Chapter and DOH regulatory viewers receive a distinct
read-only regulatory composition using the same BloodLedger visual system. The
composition emphasizes approved city-wide aggregates, alerts, transfer history,
audit summaries, and simulation reports. It must not depict PRC or DOH as an
operational hospital, Fabric peer, endorsement party, or inventory-writing
authority.

System and institution-account administrators receive only approved
non-clinical administration, profile, and system surfaces. Small differences in
navigation, columns, actions, and messages are permission-driven. Separate views
are justified only by a materially different operational, regulatory, or
administrative purpose.

## Colors

The default palette is a warm, light operational workspace surrounded by dark
navy chrome. Tokens in the YAML front matter are normative; components must
consume them through the official CSS token layer rather than repeating literal
hex values.

- **Primary blood red** `{colors.primary}` marks the brand, the active navigation
  rail, and the single dominant action in a context. Hover and pressed states use
  `{colors.primary-hover}`; quiet selected or explanatory surfaces may use
  `{colors.primary-container}`.
- **Canvas** `{colors.canvas}` is a warm paper background. It keeps long
  monitoring sessions humane without adopting generic clinical white.
- **Surface** `{colors.surface}` carries cards, tables, forms, and dialogs.
  `{colors.surface-subtle}` separates headers and hover rows without shadows.
- **Chrome** `{colors.chrome}` contains persistent navigation. Raised and hover
  chrome remain near-black navy rather than becoming gray or red.
- **Ink** progresses from `{colors.ink}` through secondary, muted, and faint
  levels. Faint ink is metadata only and must not carry essential instructions.
- **Lines** are warm neutral dividers. Use subtle lines inside dense tables,
  ordinary lines around cards, and strong lines only for emphasized boundaries.
- **Critical, warning, success, and information** are the complete semantic
  color families. Neutral handles unclassified, inactive, or ordinary pending
  content.

Semantic colors communicate severity, not domain ownership. Hospital, PRC, DOH,
and administrator views do not receive separate brand palettes. Every colored
state also includes readable text and, where useful, an icon or shape.

Map operational states consistently:

| Visual family | Typical states |
|---|---|
| Critical | failed, conflicted, rejected, out of stock, severe expiry condition |
| Warning | stale, degraded, near expiry, attention required |
| Success | committed, completed, healthy, available |
| Information | pending, processing, read-only context, surplus |
| Neutral | disabled, unknown, not applicable, ordinary inactive state |

The default light palette is the Sprint 05 baseline. The mockup's runtime accent
picker and tweaks panel are design-review mechanisms and must not ship. Its dark
theme is not normative until a separate task approves the tokens, contrast
evidence, persistence behavior, and test matrix.

The official `ink-muted`, `warning`, and `success` foregrounds are minimally
darkened from the inspected mockup values so their small-text pairings pass WCAG
AA. This accessibility correction preserves the hue, hierarchy, and component
appearance; do not restore the lower-contrast prototype literals.

Maintain WCAG AA contrast for normal text and controls. Never lower contrast to
make the interface appear quieter.

## Typography

Typography separates narrative hierarchy from operational evidence:

- **Newsreader** is the display voice for page titles, modal headings, important
  blood-type labels, and large KPI numerals. It gives the interface editorial
  gravity without making body content ornamental.
- **Inter** is the working voice for navigation, tables, forms, buttons, body
  copy, filters, and status labels.
- **JetBrains Mono** is reserved for safe technical evidence: opaque identifiers,
  transaction references, versions, timestamps, block references, ISBT-like
  synthetic codes, and aligned numeric data.

The official application must self-host reviewed, licensed font files or use the
fallback stacks declared in the tokens. It must not depend on a runtime font
CDN. A fallback must preserve hierarchy and legibility even if its metrics
differ slightly.

Page titles use `{typography.display-page}`. KPI values use
`{typography.display-stat}`; their units return to the sans-serif body family.
Card headings remain compact and sans-serif. Eyebrows and table headers use
uppercase `{typography.label-caps}`, but sentences, form values, and error
messages retain natural casing.

Do not use serif type for long body copy, uppercase for paragraphs, or
monospace merely to make ordinary text look technical. Tabular numerals should
align without exposing restricted precision.

## Layout

The default desktop shell is a two-column grid: a fixed
`{spacing.sidebar}` sidebar and a fluid main region. The sidebar is sticky at
the viewport top and uses its own vertical scroll when navigation exceeds the
available height. The content column must set `min-width: 0` so tables and
charts cannot force the entire shell wider.

The main page pattern is consistent:

1. A top bar contains breadcrumbs. Pages other than the Dashboard also show
   one `Simulation only` badge.
2. A page head contains a serif title and only context needed for scope,
   freshness, access, or a safety decision. Do not repeat generic eyebrows,
   subtitles, data wrappers, or classification labels.
3. KPI tiles may precede the primary data surface.
4. A card contains the principal table, matrix, timeline, or form.
5. Supporting cards follow in two- or three-column grids where the information
   relationship warrants comparison.

Default page padding is 24px vertically and 28px horizontally, with 64px at the
bottom. Major content groups use an 18px rhythm. Cards use 18px bodies and
14px-by-18px headers. Dense table cells use 10px vertical and 14px horizontal
padding.

The inventory matrix uses eight equal blood-type columns when sufficient width
exists. It is a comparison instrument, not a collection of promotional cards.
Values dominate; supporting labels remain quiet.

### Density

Regular density is the normative Sprint 05 presentation. Compact density may be
introduced later as an explicit user preference, but the prototype tweak toggle
is not migrated automatically. Do not create a third density.

### Responsive behavior

The official desktop dashboard targets existing hospital and administrative
terminals. Sprint 05 does not include a mobile dashboard redesign. At narrower
widths, preserve information and authorization first: allow safe horizontal
table scrolling, prevent clipped actions, and stack supporting grids only where
the composition remains understandable.

Do not invent touch-only controls, hide required columns without an equivalent
detail path, or duplicate the capture PWA's mobile scanner. The dashboard links
to the official capture application at `/capture/`.

## Elevation & Depth

BloodLedger is primarily flat. Hierarchy comes from tonal layers, borders,
spacing, and typography:

- The paper canvas sits behind white data surfaces.
- Warm one-pixel borders define cards, tables, inputs, and modal sections.
- Hover rows and selected regions use subtle tonal changes.
- Standard cards do not float.

Shadows are reserved for transient overlays. A toast may use a restrained
10px-by-24px shadow; a modal may use a 20px-by-40px shadow over a dark scrim.
Matrix hover feedback may use a very small shadow and one-pixel lift. Do not add
glass effects, backdrop blur, glowing panels, decorative gradients, or stacked
card shadows.

Status-focused KPI and matrix cells use flat semantic tints when they need
emphasis. Do not introduce decorative gradients.

## Shapes

The shape language is compact and engineered with slight softness:

- 3px is for keyboard hints and micro-elements.
- 5px is the default for buttons, navigation items, inputs, and matrix cells.
- 8px is for cards, statistics, modals, and toasts.
- 12px is for larger grouped containers when extra separation is necessary.
- Full pills are limited to status chips, counters, avatars, and small presence
  indicators.

Do not mix arbitrary radii on neighboring components. Blood-unit and blood-type
badges may use a specialized compact shape, but they remain data labels rather
than decorative emblems.

Icons use a 24-by-24 view box, `currentColor` strokes, rounded line caps and
joins, and approximately 1.6 stroke width. Use the established icon vocabulary
before adding a new glyph. Icons supplement labels; they do not replace
ambiguous action text.

## Components

### Application shell and navigation

The sidebar order is brand, authenticated institution context,
permission-filtered task groups, then the signed-in user footer. The
institution context must say who the user is acting for without exposing
internal peer IDs or implying that every institution hosts a Fabric peer.

Navigation is permission-driven from the verified server principal. Hiding an
item is usability behavior, not authorization. The backend must independently
deny unauthorized or cross-institution requests.

The active item uses the dark hover surface plus a narrow primary-red rail.
Badges are compact and numeric only when the count is meaningful. Avoid a
separate sidebar implementation for each role or hospital.

The task groups are Overview (Dashboard), Operations (Blood Inventory, Requests
& Transfers, Alerts, Activity History), Insights (Analytics, Network view,
Reports), Account (Profile), and Administration (Accounts when permitted).
These are display labels only; routes and server permissions do not change.
The sidebar uses a thin blue-toned scrollbar that remains keyboard and pointer
scrollable. Blood Unit Transactions remains in the separate Capture PWA.

The top bar shows breadcrumbs; the Dashboard omits the `Simulation only`
badge at Lat's request. Other pages retain the badge. The disconnected
global search, notification preview, fabricated pending-application count,
and floating design-preview panel are excluded. Do not add global status or
counts until an official API supplies current, authorized values and the UI
shows unavailable and stale states honestly.

### Page head

The Dashboard inventory overview follows the original quantity-axis bar chart,
with Critical, Low, Adequate and Surplus legend colors. The isolated visual
review may supply fixed, clearly labeled sample indicators. The regular
frontend displays unavailable status/surplus until approved backend evidence
exists; available inventory must not be presented as predicted surplus.

Every feature page begins with a clear title. Add context only where it explains
scope, freshness, access, or safety. Institution identity comes from the
authenticated session in the sidebar, never a client-selected tenant or
hard-coded facility name. Restricted previews retain the explicit
`Preview · no data access` label and never mount protected read components.

DOH account dashboards include empty Compliance Reports and Alerts sections,
following the HTML reference. Compliance uses an empty reporting table; Alerts
uses an empty message area. Neither placeholder claims a compliance outcome,
reporting deadline or alert. View reports opens the existing Reports page with
stored synthetic census records; View all alerts opens the existing authorized
Alerts page. These shortcuts share the PRC text-link style and respect the
server-assigned read permissions. The sections stack on narrow screens.

PRC account dashboards include layout-only placeholders for Blood-Bank Inventory
Overview, Blood-Bank Reporting Status and Hospital Replenishment Requests, per
the 2026-10-09 HTML reference. The inventory chart scaffold spans the full width;
the two empty tables sit side by side and stack on narrow screens. These panels
intentionally display no data, bank identities, counts or reporting statuses. Manage
accounts opens the existing institution-account page. View alerts opens the
existing scoped Alerts page; the label does not imply shortage data is supplied.
Open coordination records remains disabled with a Coming soon label until a
supported PRC replenishment-record contract exists.

Requester dashboards use My Requests and Network Blood Availability instead of
Blood Inventory Overview, following the six-account HTML reference. My Requests
shows only the authenticated destination's recent requests, linking to existing
request details. Network filters select blood type and component; counts use
only AVAILABLE rows from an authorized city-wide projection, not predicted
surplus or transfer eligibility. Missing projections remain unavailable. Request
actions open the existing supported workflow; automatic routing is not implied.
Refresh updates both inventory availability and scoped requests.

The dashboard leads with four summary cards selected from the authenticated
account category. Blood banks show Total Blood Units, Expiring Soon, Low Stock
and Pending Requests; requestors show Submitted Requests, Awaiting Review,
On the Way and Received; PRC shows Participating Blood Banks, Redistributable
Supply, Critical Blood Types and Open Supply Requests; DOH shows Monitored
Blood Banks, Fully Compliant, Reports Due and Late Submissions. This supersedes
the three-card technical summary at Lat's request on 2026-10-09, following the
external six-account HTML reference. Labels do not establish new business rules.

Only values supported by the scoped API are populated. Missing summary metrics
show a dash with an accessible Unavailable label; available units are never relabeled redistributable,
and no expiry, stock threshold or compliance policy is inferred. Ledger-confirmed
units remain the source of populated totals; uncommitted scans are not counted
as inventory. The separate synchronization row is removed at Lat's request.
A missing projection is not a confirmed zero. The
confirmed/available chart uses only approved data. The duplicate Inventory
Projection heading and aggregate table are omitted from the dashboard; detailed
inventory remains on Blood Inventory. The
authorized ROLE-01/ROLE-02 Capture PWA link belongs on Blood Inventory.

Summary cards contain only the title and count, with no third status/helper row
or colored edge accent. Confirmed zero displays `0`; missing data retains a dash.

Actions are ordered from quiet to dominant, with at most one primary-red action
per action group.

Every dashboard composition uses the same quiet Refresh button in the page head,
with the mockup's refresh icon. It reloads only the authenticated dashboard data
through the existing polling reader. While a request runs it is disabled and
reads `Refreshing…`; a failed refresh preserves the last confirmed view and its
existing failure/retry message. Refresh does not reload the browser or mutate data.

A small muted `Last updated` label sits beside Refresh, aligned on one baseline
and wrapping on narrow screens. It uses the last successful inventory projection
timestamp in Asia/Manila, with the timezone and source in its tooltip. It shows
Unavailable when no timestamp exists and never advances just because Refresh
was clicked. Retained data keeps its original timestamp after refresh failure.

### Buttons and fields

Buttons have default, primary, and ghost variants plus small and large density
sizes. Hover changes tone, pressed state moves at most one pixel, disabled state
keeps its label readable, and restricted actions explain why they are
unavailable when disclosure is safe.

Inputs use surface backgrounds, warm borders, 5px radii, 10px-by-12px padding,
persistent labels, optional helper text, and a visible focus indicator. Error
text is adjacent to the field and cannot rely on a red border alone. Placeholder
text never substitutes for a label.

The frontend styling preference confirmed on 2026-10-10 uses BloodLedger red
for form focus borders and outlines across all account categories. Use the
shared `--focus-ring` token, which resolves to `--primary`, for dropdowns,
text inputs, textareas and future form controls, on pointer and keyboard focus.
Apply this rule in both web and capture interfaces. Keep focus distinct from
validation errors through adjacent error text; do not remove focus visibility.


Authentication forms do not let users select or override their role or
institution. Those values come from the verified session.

For local frontend editing only, the Vite host on 5174 may add a temporary top
account switcher that signs in through the normal API using retained synthetic
accounts. It changes the authenticated session, never a client-side role or
tenant override. It is excluded from built application output. Setup and
boundaries are in [VISUAL-REVIEW.md](frontend/VISUAL-REVIEW.md#temporary-local-account-switcher--2026-10-09).

### Cards and statistics

Cards follow header/body structure. A card header includes title, optional quiet
description, and optional actions. Flush bodies are reserved for edge-to-edge
tables or matrices.

Statistics use an uppercase label, large serif value, sans-serif unit, optional
trend, and optional restrained sparkline. Never present a pending local count as
ledger-confirmed inventory. Every freshness-sensitive statistic exposes its
status or last successful update.

### Tables and matrices

Table headers are uppercase and compact. Identifier columns use monospace;
numeric columns use tabular figures and right alignment. Hover identifies an
interactive row, while keyboard focus provides an equivalent cue.

Prefer in-context drill-down or a stable routed detail view according to the
official router design. Do not reproduce the mockup's non-addressable global
page-state navigation.

Matrices and heatmaps always pair color with a value, label, and status
indicator. Regulatory aggregates must not expose restricted institution detail.
Empty, unavailable, stale, and unauthorized cells are distinct from zero.

### Status chips and system states

Chips are compact labels, not controls unless explicitly implemented as filter
chips. The text is authoritative; color accelerates recognition.

Every data-bearing feature provides explicit presentations for loading, empty,
unavailable, unauthorized, offline or degraded, pending, committed, stale,
failed, and conflicted states. A locally queued event is never styled or worded
as committed.

### Modals, confirmation, and toasts

Modals use a centered surface, restrained scrim, clear heading, scrollable body,
and right-aligned footer actions. Focus moves into the dialog, remains trapped
there, returns to the invoking control, and Escape closes only when doing so
cannot discard an irreversible operation.

Destructive or ledger-affecting actions require explicit confirmation and safe
recovery. Do not copy the mockup's PIN ceremony unless the approved
authentication design requires it.

Toasts acknowledge completed writes or important asynchronous outcomes. They do
not announce ordinary reads. A toast includes readable outcome text and
persists long enough to perceive without blocking continued work.

### Motion and live-state language

Feedback is fast and mechanical: roughly 80–120ms for hover, focus, press, and
scrim transitions, and up to 200ms for toast entrance. Nothing bounces,
overshoots, or continuously animates merely to imply sophistication.

Presence dots and live-state language appear only when backed by current API
state. Polling, stale data, disconnected services, queued events, and confirmed
ledger commits must remain visually and textually distinct. Respect
`prefers-reduced-motion`; non-essential movement collapses to zero.

### Accessibility

All controls are keyboard reachable and have visible focus. Modal focus behavior,
table-row actions, menus, and filters have semantic labels. Status is never
communicated by color alone. Maintain logical heading order, associate form
errors with their fields, and provide accessible names for icon buttons.

Charts and sparklines provide adjacent numeric summaries. Dense tables retain
headers and readable zoom behavior. Time is stored and transported in UTC and
displayed in Asia/Manila with enough context to avoid ambiguity.

## Do's and Don'ts

- **Do** preserve the clinical-operations-console character: warm, dense,
  restrained, and auditable.
- **Do** use the YAML tokens through the official CSS token layer.
- **Do** reuse the shared hospital composition while binding all content to the
  authenticated institution.
- **Do** use a separate regulatory composition for PRC/DOH where the information
  purpose is materially different.
- **Do** show status text, freshness, source classification, and safe provenance.
- **Do** keep pending, committed, stale, failed, offline, and conflicted states
  unmistakably different.
- **Do** use synthetic, opaque, privacy-safe examples and test data.
- **Do** preserve keyboard access, focus handling, contrast, and reduced-motion
  behavior while matching the mockup visually.
- **Don't** create per-hospital themes, cloned dashboards, or role-first feature
  directories.
- **Don't** depict PRC, DOH, or secondary institutions as active Fabric peers.
- **Don't** expose exact restricted locations, raw scan content, credentials,
  private identities, or unrelated institution detail for visual completeness.
- **Don't** introduce a new status color when the existing semantic families
  express the condition.
- **Don't** hardcode colors, fonts, spacing, institution IDs, role names, mock
  hashes, or fabricated live values inside components.
- **Don't** migrate global `window.*` state, browser Babel, runtime CDNs, the
  design tweaks panel, runtime fixture fallbacks, or script-order dependencies.
- **Don't** add gradients, glass surfaces, decorative shadows, playful motion,
  or consumer-health illustrations.
- **Don't** treat a visually complete screen as evidence of clinical safety,
  regulatory compliance, or production readiness.


### Requester Requests & Transfers reference alignment (2026-10-09)
The requester-only `/transfers` presentation follows the supplied MetroLipa HTML structure: request/transfer tabs, a facility workflow strip, an expandable request form, a record list, and an inline verified detail panel. Dashboard Request Blood opens `/transfers?newRequest=1`; the sidebar opens the records view. Both use the existing page and canonical V2 request submission with its operator verification, stable retry keys, and command-status identity validation.

Requests are limited to the authenticated destination institution. Transfer rows represent linked TRANSFER reservations, excluding local releases; request states and reservation states remain independent. Records are read from the permission-scoped service, with explicit empty/unavailable/stale states. No sample rows are inserted. Inline details reuse the existing verified reader, leaving other account modal behavior unchanged.

The mockup's personal fields and automatic supplier routing are not copied because they are unsupported by the current request contract. The form uses source bank, blood type, component, quantity, and urgency. PDF export stays disabled; custody/receipt actions are described as unavailable instead of adding unsupported mutations. This is simulation-only frontend evidence, not clinical or Fabric UAT acceptance.


### Requester form placeholders — 2026-10-09
Following user review, the expanded reference form now includes requester/clinical details, authorized pickup, supporting documents and notes as disabled placeholders. No values or files are collected, persisted or included in the existing V2 command. The visible operator-authorization section explains the already-functional submission verification dialog. [Backend/API gaps](frontend/BACKEND_API_GAPS.md) tracks all frontend dependencies in this desktop continuation and separates missing contracts from existing APIs awaiting wiring.


### Page-level information help — 2026-10-10
Dashboard and Requests & Transfers breadcrumb bars include a far-right circled information control with a short plain-language explanation. Blood-bank dashboards share one description across all three bank accounts; requester, PRC and DOH dashboards use separate descriptions based on the authenticated account category. Help works on hover, keyboard focus and tap, and Escape dismisses it. Content describes page purpose without asserting that placeholder data or deferred backend workflows are implemented.


### Primary requester supplier routing placeholder — 2026-10-10
The MetroLipa institution-account form replaces source-bank choice with read-only Supplier Routing / Assign automatically. Its information control sits at the right edge of the label row. Current canonical requests require a source institution, so requester submission is gated until an approved routing response supplies one; the UI must not silently choose the former default bank. Existing legacy role-fixture request contracts remain unchanged. This supersedes earlier manual source selection for primary requester sessions; see GAP-05.

Requester Blood Unit Receipt follows the MetroLipa inbound-only mockup: camera launch card, scoped received history, responsive capture/review dialog, shared red focus and right-inset dropdown arrow. Camera/file input provides an in-memory preview only; no OCR/receipt claim or automatic confirmation. Confirmation must wait for label-to-reservation matching and authorized operator submission (GAP-19).

Receipt visual refinement: the receipt page omits the top Simulation only badge; Inbound only is plain ink text and the camera launch icon has a neutral border with ink strokes. The scanner uses the mockup phone proportions (420px by up to 860px, dark 8px frame, 34px corners, scrollable single column). A compact frame remains visible on small screens. API simulation metadata remains unchanged.

Receipt scanner refinement: light-weight title above BloodLedger inbound eyebrow, borderless close X, no transaction type or transfer selector. Scan and Manual tabs follow mockup input modes. Manual entry opens an inset phone overlay with unit/product/date/source/purpose fields and preview only; local draft is cleared on scanner close. Source options are derived from scoped incoming transfer records, and matching/confirmation remain pending.

2026-10-10 receipt manual layout amendment: Manual tab now immediately displays the fields inline in the phone input card. Enter/Edit unit details button and nested overlay removed. Draft survives tab changes, clears on scanner close, and Preview Entry remains local/unverified with no submission.

2026-10-10 Alerts visual refinement: shared summary now uses All alerts / Critical / Warnings / Information severity counts. Severity chip buttons with counts replace the Filter alerts label and severity/status dropdowns, following MetroLipa HTML. Alerts page help is in the rightmost top bar. Visible Simulation only badges/captions removed across web and capture screens; API classification metadata preserved. The temporary requester alert sample dataset and its development-only routing override were removed after visual review. Alerts now reads the authorized API feed in development and production.

### Institution Profile and Accounts / Staff — 2026-10-10

Primary institution sessions now separate Profile (facility identity, participation/status, contact/licensing placeholders, account reference) from Accounts / Staff (operator summary, actual operator search/status filters, role/access/status table and supported administration commands). Both share the Account Management sidebar section and far-right page help. The full bloodledger-full-mockup.html ProfilePage/AccountsPage/StaffDirectoryManager layouts inform card spacing, but do not supply fake records or replace the institution operator model. No staff table appears on Profile; own Edit profile appears there. PRC Accounts retains cross-institution directory/application/login controls; Profile never loads those cross-institution lists. Missing field dependencies are GAP-20–21. Existing operator verification, version and idempotency handling remain in place.

### Apply for Access and complete institution Profile — 2026-10-10

The active access application uses mockup-based blood-bank/requester selection and four steps (Facility, Qualification, Primary Account, Documents). Only existing approved basic application fields are editable/submitted; unsupported expanded fields and attachments are disabled placeholders. Confirmation checks the existing 12–128-character applicant password. Submission retry identifiers remain stable. Applicant-status authentication/withdrawal remains separate from activated institution credentials.

Institution Profile displays category-specific licensing/qualification, credentials/access, application record and security alongside facility/contact/account information. Unsupported reads show Not available, and unsupported document/password controls stay disabled. Accounts / Staff retains connected operator administration and actual statistics. See docs/frontend/APPLICATION_PROFILE_FIELD_MAP.md and GAP-20–23 for contracts and remaining work.

2026-10-10 Staff Accounts naming amendment: navigation and page title use Staff Accounts, superseding Accounts / Staff. Removed the repeated institution heading, Staff & operator access heading and its description from this page. Supported operator controls remain available.

### Blood-bank operational screens — 2026-10-10

Blood Inventory follows the full mockup's faceted blood-type/component chips, counts, search and expiry-sorted table. Counts reflect loaded scoped components; unavailable reads show dashes. Confirmed inventory state remains separate from label-expiry evidence. Opaque component/reservation details, capture permissions, historical stock and contract switching remain available. Technical view options are in a disclosure; no mockup CSV import or PDF control is fabricated.

Blood-bank Requests & Transfers uses separate request/reservation tabs, search/status filters and an adjacent authorized record-details panel. Local-release reservations remain distinguishable by purpose. Existing request/local-release forms and operator-bound, versioned/idempotent command processing remain unchanged. Deferred custody actions/reconciliation policy are described in Workflow availability; recorded command history remains available in its disclosure. No simulated approvals or fabricated staff details were copied.

Activity History uses mockup-inspired activity-type chips and combined search over permitted redacted records, with actual summary counts and refresh. Unsupported operator/scan/request linkage fields and PDF export are not fabricated. Page-level help now covers Inventory and Activity History as well as the other navigation sections; rightmost section help explains data and workflow semantics.


### Separate blood-unit transactions and mockup inventory — 2026-10-10

Supersedes the preceding inventory export/import presentation: Blood Inventory now has compact Export PDF, disabled Import CSV, Blood Unit Transactions navigation and Refresh actions above mockup-style blood/component filters, search and an expiry-sorted stock table. Intake status and technical view options are secondary disclosures. Export PDF downloads an actual PDF of the currently filtered authorized component snapshot; it is disabled for unavailable or historical data. CSV importing cannot bypass verified OCR registration.

Blood Unit Transactions is a separate blood-bank navigation page at `/transactions`, with phone-shaped capture launcher, recent authorized inbound/outbound operations, direction/search filters and actual PDF export. The phone embeds the existing capture PWA rather than introducing a simulated command path. Scanner access retains capture permission checks. History merges permitted institution audit and command timeline records, deduplicating ledger references. Missing scan/product/operator fields remain unavailable. Exports preserve full permitted references and recorded statuses, with snapshot scope/filter/time metadata.

Blood-bank Requests & Transfers now follows mockup tab/list/detail/form placement, with a horizontal supplier workflow, New Blood Request scrolling to the inline form, compact Cancel/Submit controls and an empty PRC Supply Requests tab. Canonical request/reservation reads and supported commands remain authoritative.

All three blood-bank dashboards retain their inventory overview and add Requests and Network Blood Availability. Requests use existing permitted transfer reads. Bank inventory is institution-scoped, so the network availability count stays unavailable until an authorized aggregate is connected; it is not calculated from own stock. Request Blood carries selected product filters into the bank request form.


2026-10-10 bank dashboard ordering/error refinement: Blood Inventory Overview precedes Requests and Network Blood Availability, which remain at the bottom. During initial loading or unavailable inventory reads, bank summary cards display unavailable dashes and the inventory overview retains a titled placeholder. Loading/failure notices use compact neutral cards with expandable technical details and a retry action; retained confirmed views stay visible after non-authorization refresh failures. No API or scope changes.


2026-10-10 bank dashboard request-table refinement: removed section information buttons from Requests and Network Blood Availability by user request. Bank Requests now has separate Blood Type and Component columns; blood type is plain text with no circular badge, and product labels use PRBC / Platelets / Cryo / FFP / Whole Blood. Requester dashboard presentation remains unchanged.


### Receipt-style bank mobile scanner — 2026-10-10

The Blood Unit Transactions scanner now reuses the official requester receipt scanner's phone frame, light title/eyebrow, borderless close button, hidden-scrollbar content, equal Scan/Manual tabs and inline manual form. Banks additionally have Inbound/Outbound direction tabs. Changing direction clears that direction's volatile preview, and closing clears the scanner workspace.

Inbound Scan embeds the existing verified capture PWA with `layout=receipt`: compact camera and capture actions replace its standalone hero, while OCR validation, operator/PIN authorization, idempotency, command status and privacy boundaries remain intact. The parent accepts height messages only from its own same-origin capture iframe so the phone uses one content scroll area. Standalone capture remains unchanged.

Outbound Scan supports a volatile photo preview; Outbound Manual supports inline local unit fields and destination choices from permitted request reads. Outbound confirmation stays disabled pending verified scan-to-transfer matching. A link opens the existing Requests & Transfers dispatch workflow. Manual previews in either direction do not create inventory or ledger transactions. No API/schema/ledger changes were made.


2026-10-10 inventory filter simplification: Blood type and Component chip groups are replaced with labeled dropdowns, keeping scoped faceted counts in their options. Search gets more width in the same aligned desktop row. At medium widths search spans a second row; narrow screens stack the controls. Existing padded dropdown arrows and red focus treatment are retained. Combined filter/search behavior, contract-specific component choices, expiry sorting and filtered PDF output remain unchanged.


2026-10-10 PRC/DOH Alerts card alignment: CITY_AGGREGATE alerts now use the same severity-bordered card list as institution/requester alerts instead of a table. Each card retains authorized institution label, alert type, severity, status, aggregate count and available evaluation time. Unit-level detail and acknowledgement controls are not introduced for these network summaries. Shared severity filters remain.


2026-10-10 alert card color refinement: all shared alert cards now use an even 1px severity-colored border and solid light severity background, matching summary cards. Gradients and thick left-edge accents removed. Critical uses red, warning amber and information blue; contents/actions unchanged.


2026-10-10 alert container refinement supersedes individual severity backgrounds: summary cards retain their colors, while individual alert cards and list now inherit the outer container background. Uniform severity borders remain. Filter row has no surrounding border, is inset 18px to align with summaries/cards, and has vertical padding plus roomier filter buttons. Outer container unchanged.


2026-10-10 clarification: individual alert cards retain light red/amber/blue backgrounds and uniform severity borders. Only the list/filter wrapper inherits the outer background. Borderless inset filter spacing remains. This supersedes the preceding individual-card transparency statement.


2026-10-10 Activity History compact layout: removed the redundant permitted-record toolbar label. Page heading and Refresh share one row, retained during loading/unavailable reads. Summary card outer edges align with Activity Records by removing the summary group's extra side padding. Activity type is a dropdown beside a wider search field, stacking at narrow widths. Existing scope, summary values, reference redaction and combined search/action filtering remain unchanged.


2026-10-10 bank Blood Requests product columns: Blood Type and Component now appear separately in Requests & Transfers. Blood type is plain black text without badge, border or background; product labels retain PRBC / Platelets / Cryo naming. Record selection, status and request actions unchanged.

2026-10-10 bank Requests & Transfers: full rows select scoped request/reservation details, keyboard-accessible reference buttons remain. Product fields are separate and facility labels resolve through existing mapping. Linked request/transfer navigation retained. Missing clinical/pickup/document metadata is explicitly unavailable. Decision/receipt/outbound controls are disabled until verified integration; PRC supply button expands a mockup-shaped requirement form with disabled fields/submission. Workflow now uses the requester card layout with supplier stage hints and instructions.

2026-10-10 bank detail review redesign: mockup-style reference/status identity row, compact aligned key/value columns, separate clinical requirements and transfer lifecycle sections, current canonical-stage indicator and compact component links. Long references truncate with full title; unavailable metadata remains explicit. Scoped bank-only detail rendering retains existing validated navigation; requester layout unchanged.

2026-10-11 dashboard layout: removed the enclosing card across blood-bank, requester, PRC and DOH dashboards. Summary and individual content cards remain; shared dashboard sections align with the page edges without inherited outer-card gutters.

2026-10-11 dashboard headings: removed requester, PRC and DOH section captions per review. Card headings explicitly reset default h2 margins after outer-card removal; requester/network, PRC and DOH headers use 12px vertical padding.

2026-10-11 dashboard header padding refinement: requester/network, PRC and DOH card headers now match Blood Inventory Overview at 14px top/bottom and 18px left/right. Removed captions and zero heading margins retained.

2026-10-11 dashboard header padding finalized per review: Blood Inventory Overview, Requests/My Requests, Network Blood Availability, PRC inventory/reporting/replenishment and DOH compliance/alerts use 16px top/bottom and 18px left/right.

2026-10-11 local-release frontend retirement per user: Facility operations heading and Start local release form removed. Only explicitly opened blood requests render in the former operations area. Existing local-release records remain readable, with no available reservation actions. Command recovery and Recorded operations retained. API endpoints, local-release API helper and operator capability mapping preserved. This supersedes the earlier proposal to relocate local release to Transactions.

2026-10-11 Requests & Transfers cleanup: bank page no longer renders manual Recover accepted command, recovery lookup/ID fields or Recorded operations. Shared detail explorer disables manual recovery for this workspace, including linked details. APIs, shared recovery component and submission outcome tracking retained.

2026-10-11 initial navigation presentation: protected reads start in loading state; layouts remain visible before data arrives. Dashboard skeleton cards now apply to all roles, Alerts retains summaries/filters, Activity History retains summaries/filters/card, with unknown counts shown as dashes. No fake successful records or zero counts. First transient initial GET failure retries once quietly; account-context changes discard stale responses and retry current reads. Persistent errors and genuine 401/403 remain explicit.

2026-10-11 inventory unavailable presentation: registry header and six-column table stay visible during loading, unavailable reads and confirmed empty results. Centered colspan row carries state, optional error details and Retry. Duplicate standalone unavailable panels removed. Loaded records remain on transient refresh errors; counts stay unavailable until a verified read.

2026-10-11 inventory table refinement: heading is Blood Unit Inventory. Inventory row hover preserves the normal background and has no left-edge red accent. Record reference buttons retain existing detail navigation.

2026-10-11 inventory layout refinement: removed the table section title, information tooltip and component counter; the six-column table header leads the records. Freshness label is Last refresh and still reports the latest successful validated browser read. Inventory view options moves below the table and freshness footer.

2026-10-11 inventory finishing: all four table wrapper corners use the shared medium radius, retaining horizontal scrolling. Last refresh has a transparent background, scoped to Blood Inventory.

2026-10-11 inventory joined layout: filters and table share one rounded border with no vertical gap and a single divider below the filters. Existing filter and table backgrounds retained. Intake status and refresh errors remain outside the joined card; Last refresh and view options remain below.

2026-10-11 inventory error controls: removed empty-table View details and redundant Retry inventory controls. The page-header Refresh button remains the manual retry path; centered empty/error state and loaded-record refresh notices remain.

2026-10-11 inventory footer refinement: removed the extra Last refresh top border below the table card. Rounded card outline and filter/table divider retained.

2026-10-11 PRC supply placement: following the full HTML mockup, the PRC coordination/action card is separate below Current facility workflow. Request PRC Supply toggles a full-width inline form directly below the action card, before records/details. Existing unsupported submission fields remain disabled; no API changes.

2026-10-11 PRC form compact layout: removed visible submission-availability paragraph. Desktop first row has blood type/component/units; second row has priority and a wider required date/time. Coordination note remains full width; operator authorization sits immediately before action buttons. Reduced header/body/field spacing and note height; narrow screens stack fields. Unsupported fields/submission remain disabled.

2026-10-11 PRC request interaction refinement: all five product/priority/date-time fields occupy one desktop row, with stacked mobile fields. Request PRC Supply opens and smoothly scrolls to the inline form; repeated clicks scroll without closing it. PRC and blood request forms are mutually exclusive. Both scroll paths respect reduced motion.

2026-10-11 PRC desktop field sizing: all five main fields use equal-width grid columns; existing tablet/mobile wrapping retained.

2026-10-11 blood-bank new request form: header and form card have rounded outer corners without clipping help tooltips. Five main fields share equal desktop columns, with existing responsive wrapping retained. Default submission label is Submit; pending/retry/correction state labels and command behavior retained.

2026-10-11 PRC scroll and operator confirmation refinement: PRC scroll targets the coordination card so the opening button and following form stay contextual. Verify operator hides the Synthetic prefix in the institution display label; operator references and authorization payloads unchanged. Operator/PIN share one row. Removed visible PIN caption. Equal-width Cancel and Verify and submit buttons fill one compact bottom row, Cancel left.

2026-10-11 operator verification refinement: Operator select and PIN input share 44px height and matching typography/borders. Increased field/actions gap to 28px. Equal compact Cancel/Verify buttons now occupy a right-aligned 280px maximum group rather than filling the modal width.

2026-10-11 PRC Network View simplification: removed the redundant Institution inventory aggregates subheading and authenticated-aggregate technical paragraph. Network inventory blood types/statuses render plain black text without badges. Shared aggregate badges elsewhere and reporting presentation unchanged.

2026-10-11 PRC Reports empty layout: removed Stored synthetic census reports subheading. Five report table headers remain visible without rows. Loading/unavailable/no-record state is centered with concise inventory/historical-stock context and export-availability message; missing data is not represented as zero. Stored census selector and capture time appear only with real snapshots.

2026-10-11 Reports empty-row hover: no hover background on the centered census report empty-state row.

2026-10-11 PRC dashboard chart placeholder: centered Awaiting inventory data message now has shared 1px border and medium rounded corners. Chart top inset increases from 24px to 32px for slightly more room above grid lines.

2026-10-11 global refresh icon consistency: shared circular-arrow SVG uses the standard 1.6 stroke. Dashboard across all roles, requester receipt/requests, and shared Refresh buttons use the same icon; forecast/census/component/reservation refresh controls also include it. Existing labels, busy states, actions and button colors retained.

2026-10-11 supplier workflow help: Current facility workflow tooltip now presents numbered guidance for request review, stock checks, allocation review, preparation evidence, dispatch/transit, operator verification/confirmed outcomes, receipt tracking and requesting own supply. It accurately distinguishes unavailable request decisions/PRC submission from supported reservation actions and scanner previews. Tooltip has bounded height and scroll for readable desktop/mobile help.
