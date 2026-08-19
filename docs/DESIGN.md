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

1. A top bar contains breadcrumbs and permitted global status/actions.
2. A page head contains a small uppercase eyebrow, serif title, one-sentence
   description, and right-aligned actions.
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

Semantic tint gradients from the mockup may be used inside status-focused KPI
or matrix cells only. They fade into the normal surface and must not become
decorative page backgrounds.

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

The sidebar order is brand, authenticated institution/principal context,
permission-filtered navigation groups, then the signed-in user footer. The
institution context must say who the user is acting for without exposing
internal peer IDs or implying that every institution hosts a Fabric peer.

Navigation is permission-driven from the verified server principal. Hiding an
item is usability behavior, not authorization. The backend must independently
deny unauthorized or cross-institution requests.

The active item uses the dark hover surface plus a narrow primary-red rail.
Badges are compact and numeric only when the count is meaningful. Avoid a
separate sidebar implementation for each role or hospital.

The top bar shows only functional controls. Do not port the mockup's
non-functional search field, fabricated live block count, or network-health
language unless an official API supplies current, authorized values and the UI
shows unavailable and stale states honestly.

### Page head

Every feature page begins with the same page-head composition. Titles state the
feature; eyebrows state context; subtitles explain the current scope or
freshness. Institution-specific headings use the authenticated display name,
never a client-selected tenant or hard-coded facility name.

Actions are ordered from quiet to dominant, with at most one primary-red action
per action group.

### Buttons and fields

Buttons have default, primary, and ghost variants plus small and large density
sizes. Hover changes tone, pressed state moves at most one pixel, disabled state
keeps its label readable, and restricted actions explain why they are
unavailable when disclosure is safe.

Inputs use surface backgrounds, warm borders, 5px radii, 10px-by-12px padding,
persistent labels, optional helper text, and a visible focus indicator. Error
text is adjacent to the field and cannot rely on a red border alone. Placeholder
text never substitutes for a label.

Authentication forms do not let users select or override their role or
institution. Those values come from the verified session.

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
