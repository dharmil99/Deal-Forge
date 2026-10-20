# DealForge — Design System & UI/UX Blueprint (v2)

**Status: v2. The public home page is LOCKED (Section 10).** Every other
screen inherits its design language from it through the tokens, type
scale, motion rules and app shell defined below. Treat Sections 2, 8 and
10 as fixed; do not reinterpret them.

Live reference of the locked home page:
https://claude.ai/artifact/LPuK12wv8P4rXWcxxWrxS8

**What changed from v1**
- A photographic hero (dark glass-tower photo, `finance-watermark.jpg`)
  replaces the generated candlestick / dot-grid / floating-chip background.
- Hero content is left-aligned over the empty sky so the towers stay
  visible on the right. The scrolling market ticker is kept and is now a
  global element of the whole product, not only the home page.
- Labels are sentence case. No all-caps eyebrows or label rows; only the
  wordmark is tracked capitals.
- Primary button fill is `#2563EB` (white text passes 4.5:1). `#3B82F6`
  stays for chart strokes, links and accents on dark, never under white text.
- Stats count up with CSS only (`@property`), and show real values only.
- Removed: the v1 image-generation prompts section (superseded by the
  approved, built page) and the v1 landing treatment (candlesticks,
  floating data chips, dot-grid, radial glow).
- Added: motion rules, app shell, photography rules, implementation
  hand-off (Section 11).

**Note on sources:** built from general, well-established conventions of
institutional financial software (data density, muted dark palettes,
tabular numerals, minimal ornamentation). Nothing derives from the
earlier reference archive, which was a bulk mirror of public marketing
websites and was not used.

---

## 0. Current Build Status (for calibration)

As of the latest project audit (2026-09-24), the validated backend covers
**Phases 0 through 8**, 172 tests passing:
- Phase 1: data parsing (`screener_import.py`)
- Phase 2: target screening (`screening.py`)
- Phase 3: comparable companies (`comps.py`)
- Phase 4: precedent transactions (`precedents.py`)
- Phase 4.5: DCF (`dcf.py`)
- Phase 5: valuation summary (`valuation.py`)
- Phase 6: deal builder (`deal_model.py`) — 27 tests
- Phase 7: sources & uses (`sources_uses.py`) — 23 tests
- Phase 8: accretion/dilution (`accretion_dilution.py`) — 37 tests

**Not yet built:** Phase 9 (Scenarios, FastAPI, frontend) — `backend/` is
empty, no `frontend/` directory exists yet.

**Known real data limitations, confirmed by audit, that the UI must
surface rather than hide:**
- `target_ebitda_cr` is blank for ALL 4 seed transactions -- the
  Precedents screen's EV/EBITDA band is *always* unavailable today, not
  just sometimes. Design for this as the default state, not an edge case.
- All 4 transactions sit below the 5-deal small-sample threshold --
  `small_sample_warning` fires on every single Precedents call, universe-
  wide, with zero exceptions currently.
- ~15-20 heavily acquisitive companies (large M&A activity distorting the
  `-cfi` CapEx proxy) will trigger DCF's capex-sanity warning by default,
  not just the one Adani Enterprises case found during Phase 4.5 -- the
  DCF screen's warning state is a common outcome, not a rare one.
- 75 financials.csv rows have missing `shares_outstanding`; 46 have
  missing `total_debt` (now correctly surfaces as `NaN` net debt rather
  than a false net-cash figure, per the audit's Task 3 fix).
- `company_id` is derived from the source Excel filename, not a stable
  ticker -- fragile if a file is ever renamed (currently 0 unmatched rows,
  but worth knowing this join has no independent key).

These are exactly the kind of things Section 4's "Data & Methodology"
screen (with its live data-quality panel) exists to make visible.

---

---

## 1. Design Audit -- General Category Conventions

Not derived from the uploaded archive. General, defensible characteristics
of this product category:

| Aspect | Bloomberg-style terminals | FactSet/CapIQ-style workbenches | Modern institutional web (Marquee/LSEG-style) | DealForge take |
|---|---|---|---|---|
| Density | Extremely dense, function-key driven, multi-pane | Dense but tabbed/paginated, research-report oriented | Denser than consumer SaaS, cleaner than terminals | Closer to FactSet/CapIQ: dense but navigable, not a wall of panels |
| Navigation | Command-line + function codes | Left sidebar + top tabs per entity | Left sidebar, breadcrumb-driven | Persistent left sidebar (workflow-ordered), top bar for search/context |
| Color | Black/dark background, amber/green/cyan accents (legacy CRT heritage) | Dark or light theme, blue/gray accents, sparing color | Dark navy/charcoal, restrained accent color | Dark navy/charcoal base, single blue accent, semantic green/red/amber only for data meaning |
| Typography | Monospace-heavy, small sizes | Sans-serif UI + tabular-figure numerics | Modern grotesque sans | Sans-serif UI (Inter), tabular-lining figures for all numeric columns |
| Tables | Extremely dense, minimal row height | Dense, sortable, export-oriented | Moderate density, sortable, inline charts | Dense (32-36px rows), right-aligned numerics, sortable, sticky headers |
| Charts | Functional, minimal styling, small multiples | Clean line/bar, muted palette | Slightly more polished, still restrained | Muted palette, thin gridlines, no 3D/gradients/glow |
| What NOT to copy | Visual noise, non-obvious keyboard-only interaction, dated skeuomorphism | Excessive pagination for simple data | Overly consumer-friendly rounded cards | -- |

**What works and should be borrowed conceptually (not visually copied):**
data density without clutter, persistent workflow-oriented navigation,
numeric alignment discipline, restrained color used only for meaning
(never decoration), fast keyboard/search-driven access to entities.

**What should NOT be implemented:** command-line-only interaction (too
high a barrier), excessive real-time flashing/blinking data (not needed
for this use case), skeuomorphic panel borders/bevels, any true
replication of a specific competitor's exact layout or component code.

---

---

## 2. DealForge Design System (v2)

### 2.1 Color tokens

```
Surfaces (dark theme only)
  --bg-base:        #0B0F14   page background, photo scrims fade to this
  --bg-ticker:      rgba(8,11,16,.85)   ticker strip over photo; use #080B10 in-app
  --bg-surface:     #12171E   panels, cards
  --bg-surface-2:   #1A212B   table headers, nested panels, hover
  --bg-elevated:    #212A36   popovers, menus, modals

Lines
  --line:           #243040   ticker rule, panel borders, default divider
  --line-rule:      #2A3646   stat rules, section dividers
  --line-strong:    #4A586B   ghost button border, input border
  --line-hover:     #8FA1B8   ghost button hover border

Text
  --text-primary:   #F2F5F8   display headline, page titles
  --text-strong:    #E8ECF1   values, table body
  --text-ticker:    #D5DCE6   ticker symbols
  --text-nav:       #C3CCD9   nav links
  --text-body:      #B4BFCE   paragraphs
  --text-label:     #A9B4C3   stat labels, form labels
  --text-muted:     #8794A6   table headers, helper text, "sample data"

Accent
  --accent:         #2563EB   filled primary button (white text = 5.17:1)
  --accent-hover:   #1D4ED8
  --accent-line:    #3B82F6   chart strokes, links, selected-row bar on dark
  --focus:          #60A5FA   focus ring
  --accent-wash:    #1E293B   selected row, badge background

Semantic (meaning only, never decoration)
  --positive:       #22C55E   accretive, gains, ticker up
  --negative:       #EF4444   dilutive, losses, ticker down
  --warning:        #F59E0B   small sample, stale data, assumption flags
  --neutral:        #64748B   not available, no signal
```

Contrast rules: never place white text on `#3B82F6` (3.68:1, fails).
Body text on `--bg-base` must be `--text-label` or lighter. Do not
build a light theme until asked.

### 2.2 Typography

One family: **Inter** (400, 500, 600), loaded from Google Fonts, fallback
`Inter, system-ui, -apple-system, "Segoe UI", sans-serif`. Use
`font-variant-numeric: tabular-nums` on every figure, in tables, cards,
stats and the ticker. No monospace anywhere.

| Role | Size / line-height | Weight | Notes |
|---|---|---|---|
| Display (home headline) | clamp(40px, 5.4vw, 80px) / 1.04 | 600 | letter-spacing -0.025em, left-aligned |
| Page title (app) | 24px / 1.25 | 600 | letter-spacing -0.01em, one per screen |
| Section title | 16px / 1.3 | 600 | `--text-primary` |
| Body large (hero sub) | 18px / 1.55 (16px under 860px) | 400 | `--text-body`, max-width 500px |
| Body | 14px / 1.5 | 400 | `--text-body` |
| Table cell | 13px | 400 text, 500 numeric | numerics right-aligned |
| Table header | 12px | 500 | sentence case, `--text-muted` |
| Label / helper | 13px | 400 | `--text-label` |
| Metric value (app) | 24px | 500 | tabular, letter-spacing -0.02em |
| Stat value (home) | 40px (32px under 860px) | 500 | tabular, letter-spacing -0.02em |
| Ticker | 12px | 400, symbol 500 | tabular |
| Wordmark | 16px | 600 | uppercase, letter-spacing .14em. The only tracked caps in the product |

Rules: sentence case for every label, tab, button and column header; no
all-caps eyebrows above headings; no accent colour on a single word of a
headline; line length under 80 characters.

### 2.3 Number formatting

- Currency: `₹1,23,456.78 Cr`. Indian digit grouping, 2 decimals for
  currency, 1 for percentages, 2 for multiples (`14.83x`).
- Negative numbers: `--negative` text and a leading minus sign. Never
  colour alone.
- Always show the unit (Cr, %, x) beside the number.
- The UI displays backend figures and never recomputes them.

### 2.4 Spacing, radius, elevation

- Scale: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 56px`. No arbitrary values.
- Page gutters: 56px desktop, 24px at 860px and below.
- Panel padding 16px, gap between panels 16px.
- Radius: 4px for buttons, inputs, cards and panels; 2px for badges.
  Nothing above 6px, no pills.
- Elevation: flat. Separate layers with `--bg-*` steps and `--line`
  borders, not shadows. Only popovers and modals get one shadow
  (`0 8px 24px rgba(0,0,0,.4)`).
- Gradients: allowed only as photo scrims (Section 8). Never as
  decoration, never on buttons, cards or charts.

### 2.5 Motion

Motion is sparse and each piece has one job.

| Element | Spec |
|---|---|
| Ticker | continuous `translateX` loop, 50s linear, content duplicated for a seamless loop, pauses on hover |
| Hero photo | 50s ease-in-out alternate drift: scale 1 to 1.07 and translate(-1.5%, 1%); image overscanned by 4% so edges never show |
| Headline | each line rises from a clipped mask, .9s `cubic-bezier(.2,.7,.2,1)`, staggered .12s |
| Sub, buttons, stats | one fade and 8px rise, .8s, delays .7s / .85s / 1.0s |
| Stats count-up | CSS `@property` integer counters, 1.8s, starts 1.1s |
| In-app | hover and focus transitions 120-150ms only. Metric cards may count up once on first load. No looping animation except the ticker. No photo drift |
| Reduced motion | `prefers-reduced-motion: reduce` disables every animation and shows final values immediately |

### 2.6 Components

**Buttons.** Height 44px on public pages and forms, 32px in dense app
toolbars. Radius 4px, 15px/500 (14px small). Primary: `--accent` fill,
white text, hover `--accent-hover`. Ghost: transparent, 1px `--line-strong`
border, `--text-primary`, hover border `--line-hover` and 5% white wash.
Destructive: `--negative` text and border, filled on hover. Icon-only
buttons need an `aria-label`.

**Inputs and selects.** `--bg-surface-2` fill, 1px `--line-strong` border,
4px radius, 32px high in the app, 44px in sign-in and public forms.
Focus: 2px `--focus` outline with 3px offset. Menus use `--bg-elevated`.

**Tabs.** Underline style: 2px `--accent-line` under the active tab,
`--text-label` inactive, `--text-primary` on hover, on a full-width
`--line` rule. No pills.

**Tables.** Rows 36px (32px for lists over 100 rows). Sticky header on
`--bg-surface-2`, 12px sentence-case `--text-muted`. Numerics right-aligned
and tabular. Row hover `--bg-surface-2`; selected row `--accent-wash` with
a 2px `--accent-line` bar on the left. No zebra striping. First column
frozen when the table scrolls sideways.

**Charts.** Strokes in `--accent-line`; supporting series in desaturated
blue-greys. Green and red only where the value means positive or negative
(EPS bridge, accretion/dilution). 1px `--line` gridlines, a slightly
stronger zero line, no fills, 3D or glow. Tooltips on hover in
`--bg-elevated`.

**Metric cards.** `--bg-surface`, 1px `--line`, 4px radius, 16px padding.
A 13px `--text-label` label above a 24px value, with an optional delta in
semantic colour. Compact: four to six fit across a screen.

**Badges.** 2px radius, 12px/500 sentence case, background is the
semantic colour at 15% opacity and the text is the full colour. Used for
"Small sample", "Stale data", "Infeasible", "Industrial", "Financial".

**Tooltips.** `--bg-elevated`, 12px, 150ms delay. Used for methodology
(hover a column header to read its formula).

**Notifications.** Top right, `--bg-elevated`, 3px left stripe in the
semantic colour. Info and success dismiss after 4s; warnings and errors
stay until dismissed.

**Loading.** Skeleton blocks shaped like the final layout. A spinner only
inside a button that is working.

**Empty states.** A line icon, one sentence that says why, and the next
action. Precedents with no data is a first-class state, not an edge case.

**Error states.** Inline beside the failed element. A full-page error only
when the whole load failed, with a retry action.

### 2.7 Accessibility baseline

- Text contrast 4.5:1 (3:1 from 24px up). Colours that must be told apart
  also differ in lightness.
- Visible keyboard focus on every interactive element (`:focus-visible`).
- Real `<a>`, `<button>`, `<input>` with labels; no clickable `<div>`.
- Touch targets 44px on public pages; dense app controls may be smaller
  with a 44px hit area on touch devices.
- Respect `prefers-reduced-motion`.
- Works down to 360px wide on public pages. The app targets 1280px and up
  and shows a "best on desktop" notice below that.

---

## 3. Information Architecture

The brief's proposed structure is close but conflates two different
things under "Deal Workflow": company-level research (Screening,
Companies, Comparable Companies, Precedent Transactions, Valuation) and
transaction-level construction (Deal Builder, Sources & Uses,
Accretion/Dilution). These have different mental models -- the first is
"exploring and understanding the universe," the second is "constructing
and stress-testing one specific deal." Splitting them helps the nav
communicate where the user is in the workflow, mirroring the actual
spec's own funnel (Section 1: Universe -> Screening -> ... -> Deal
Structure -> ... -> IC Report).

**Recommended navigation:**

```
OVERVIEW

RESEARCH
  Screening
  Companies
  Comparable Companies
  Precedent Transactions
  Valuation Summary

DEAL WORKSPACE
  Deal Builder
  Sources & Uses
  Accretion / Dilution
  Scenarios
  Sensitivity Analysis

PORTFOLIO
  Deal Comparison

OUTPUT
  IC Report

SYSTEM
  Data & Methodology
  Settings
```

Rationale for changes from the brief:
- **"RESEARCH" vs "DEAL WORKSPACE"** split: once a user has picked a
  target and moved into Deal Builder, they're in a fundamentally
  different mode (constructing one transaction, not browsing the
  universe) -- the nav should reflect that mode switch, not bury it under
  one flat "Deal Workflow" group.
- **"PORTFOLIO"** as its own group for Deal Comparison: comparing
  multiple deals is a step above any single deal's workspace, not a
  sibling of Sources & Uses -- deserves its own visual tier.
  "Data & Methodology" moved under SYSTEM (with Settings) rather than
  OUTPUT, since it's a reference/trust artifact the user checks
  occasionally, not an output they generate per-deal.
- A **persistent "active deal" context switcher** should sit in the top
  bar once a user is inside DEAL WORKSPACE (e.g. "TCS -> Infosys") so
  they can jump between Deal Builder/S&U/Accretion-Dilution/Scenarios for
  the SAME deal without losing context or re-selecting acquirer/target
  each time.

---

---

## 4. Key Screens

Every screen below renders inside the app shell (Section 8: global ticker, sidebar, header) and uses the v2 tokens from Section 2. Where a screen spec says "metric card", "badge" or "table", it means the v2 component, with sentence-case labels.

Format: purpose -> primary user -> primary actions -> layout -> key
elements. Screens 1-6 have real backend data today; 7-11 are laid out
generically pending those modules' real field names (see Section 0).

### 1. Global Overview
- **Purpose:** landing dashboard, market/universe snapshot.
- **Primary user:** anyone, daily entry point.
- **Primary actions:** jump into Screening or a recent target.
- **Layout:** top row of 4-5 metric cards (Companies Covered, Sectors,
  Industrial vs Financial split, Transactions in dataset, Total Deal
  Value tracked). Below: two-column -- left a sector distribution donut
  (muted palette), right an EV/EBITDA vs Revenue CAGR scatter (reuses
  Screening's own metrics) to surface interesting targets at a glance.
  Bottom: recent/pinned targets as a compact table.
- **Drill-down:** clicking any company anywhere opens Company
  Intelligence for that company_id.

### 2. Company Intelligence
- **Purpose:** single-company deep dive.
- **Primary user:** analyst researching a specific company.
- **Primary actions:** switch tabs, jump to Comps/Valuation for this
  company as target.
- **Layout:** header (name, ticker, sector/industry badges, market cap,
  EV, key multiples inline). Tab bar: Overview / Financials / Valuation
  / Peers / Transactions. Overview tab: revenue/EBITDA bar+line combo
  chart (actual bars, EBITDA margin as a line, both by fiscal year) plus
  a compact company description panel. Financials tab: full historical
  table (sticky first column, horizontal scroll for 10-year history) --
  Revenue, EBITDA, Net Income, Net Debt rows, with `shares_outstanding_is_stale`
  surfaced as a small warning badge on the affected year's column header.
- **Warnings:** stale share count, missing EBITDA (Financial sector_type).

### 3. Target Screening
- **Purpose:** filter the universe to a shortlist.
- **Primary user:** analyst hunting for acquisition candidates.
- **Primary actions:** set filters, run screen, sort results, select a
  target to carry forward into Comps/Valuation.
- **Layout:** filter bar across the top (Sector dropdown, Revenue CAGR
  min slider, EBITDA Margin min slider, EV/EBITDA max slider, Net
  Debt/EBITDA max slider, Industrial/Financial toggle -- defaulting to
  Industrial only per the V0 scope decision) + a prominent "Run Screen"
  button. Results table below: sortable by every column including
  `illustrative_screening_score`, with that column's header carrying a
  tooltip: "Model-defined composite score for sorting a shortlist -- not
  an objective 'best target' judgment."
- **Warnings:** none inherent, but result count and Financial-sector
  exclusion count shown above the table ("102 Industrial companies
  screened, 11 Financial-sector companies excluded").

### 4. Comparable Companies
- **Purpose:** peer-based implied valuation for one target.
- **Primary user:** analyst building a valuation case.
- **Primary actions:** pick target, review/edit peer group (industry
  default, with ability to add/remove individual peers or widen to
  sector), view percentiles and implied valuation.
- **Layout:** target header (same pattern as Company Intelligence).
  Peer group panel: editable chip-list of peer company_ids (removable),
  "+ Add peer" search, small-sample warning badge if count < 5. Multiples
  table: rows = EV/Revenue, EV/EBITDA, P/E; columns = 25th / Median /
  75th / n. Implied valuation panel: 3 cards (one per multiple) each
  showing multiple used -> implied EV -> implied equity value, clearly
  distinct visual treatment from the peer table above (this is the
  "answer," the table above is the "evidence").
- **Warnings:** small-sample badge; a "margin divergence" flag if
  target's own EBITDA margin differs from peer median by more than a
  threshold (surfacing the exact TCS-style finding from Phase 3
  automatically rather than requiring manual investigation each time).

### 5. Precedent Transactions
- **Purpose:** deal-multiple-based implied valuation.
- **Primary user:** analyst building a valuation case.
- **Primary actions:** filter transactions (sector/industry/date/deal
  size), view percentiles, view implied valuation.
- **Layout:** filter bar (Sector, Industry, Year range, Deal size range).
  Transaction table below: Acquirer, Target, Date, Deal Value, Stake %,
  Implied EV (100%-basis), EV/Revenue, EV/EBITDA, Status -- with a small
  icon/tooltip on any row where stake_acquired_pct < 100 explaining the
  scaling. Multiples summary + implied valuation panel, same visual
  pattern as Comps screen 4 for consistency.
- **Empty state:** THIS SCREEN WILL OFTEN BE EMPTY given current seed
  data (only Cement and IT Services covered) -- the empty state must say
  so plainly: "No precedent transactions found for [Industry]. This is a
  known data coverage gap, not a system error. [View covered industries]".
  This is not a hypothetical edge case to handle gracefully as an
  afterthought -- it will be the DEFAULT state for ~100 of 113 companies
  today, so design it as a first-class state, not a fallback.

### 6. Valuation Summary
- **Purpose:** the Phase 5 output -- combine Comps + Precedents + DCF.
- **Primary user:** analyst finalizing a valuation range before Deal
  Builder.
- **Primary actions:** review each methodology's bucket, adjust DCF
  assumptions inline, see the range update live.
- **Layout:** three side-by-side panels (Comps / Precedents / DCF) at
  the top, each showing its bucket value or an explicit "Not Available"
  state with reason. Below: a horizontal range bar visualization --
  Low/Base/High as a labeled bracket, with each methodology's point
  plotted on the same axis so the user can SEE which methodology is
  driving which end of the range, rather than just reading three numbers
  in a table. DCF panel includes an "Edit Assumptions" affordance
  (revenue growth, EBITDA margin, CapEx%, WACC, terminal growth) that
  recomputes only that panel + the range, not a full-page reload.
- **Warnings:** every warning from every module surfaces in a single
  consolidated list at the bottom -- DCF capex-sanity warnings, small
  -sample flags, missing-precedents notices -- exactly matching the
  `warnings` list Phase 5's backend already aggregates. Do not scatter
  these across the three panels only; a consolidated list is the
  difference between "the user might notice" and "the user will notice."

### 7. Deal Builder *(backend: `deal_model.py`, Phase 6)*
- **Purpose:** construct one acquisition -- pick acquirer/target, price
  it, choose the financing mix, set the synergy ramp.
- **Primary user:** M&A analyst/associate.
- **Primary actions:** select acquirer and target, set premium and
  financing mix, enter synergies, run the model.
- **Inputs (real parameter names from the backend; the UI should label
  them in plain English but bind to these):**
  - Acquirer / Target -- `company_id` selectors, populated from the
    113-company universe (Industrial only, per the V0 scope decision).
  - Acquisition premium.
  - Financing mix: `cash_pct`, `debt_pct`, `stock_pct` -- must sum to
    100%. Enforce in the UI (see Deal Workspace notes), not just after
    the backend rejects it.
  - `transaction_fees`.
  - Synergy schedule: `synergy_year_1`, `synergy_year_2`, `synergy_year_3`
    (gross, pre-tax -- the label must say so, because break-even synergy
    on the Accretion/Dilution screen is reported on the same basis).
- **Layout:** two-column. Left: input form. Right: live output summary
  (purchase equity value, transaction enterprise value (TEV), financing
  split in Rs Cr, headline EPS impact). Inputs and outputs are visible
  together, never on separate tabs -- the point of the screen is seeing
  an input change ripple through.
- **Warnings:** the backend's pricing/financing validation warnings
  surface inline beside the input that caused them, and again in one
  consolidated list under the outputs, same pattern as Valuation Summary.
- **Drill-down:** clicking the acquirer or target opens its Company
  Intelligence page; clicking TEV opens the underlying bridge (equity
  value + debt - cash).

### 8. Sources & Uses *(backend: `sources_uses.py`, Phase 7)*
- **Purpose:** show where the money goes and where it comes from, and
  whether the deal can actually be funded.
- **Primary user:** M&A associate / corporate development.
- **Primary actions:** adjust refinancing, cash-sweep and fee
  assumptions; check feasibility.
- **Inputs specific to this screen (real parameter names):**
  `refinance_target_debt`, `use_target_cash` (the target cash sweep),
  `debt_issuance_fee_pct`, `minimum_cash_balance`.
- **Layout:** twin-column ledger (Uses left, Sources right), each row a
  line item plus amount, both columns ending in a Total row. A balance
  indicator sits beneath: Total Sources = Total Uses. This is the single
  most important element on the screen and should be the most visually
  prominent thing on it.
- **Feasibility is a first-class state, not a footnote.** Phase 7 caps
  cash usage against feasibility and reconciles pro-forma cash, so a
  deal can be *infeasible* as specified. When it is, show an explicit
  banner stating what failed (for example, cash required exceeds cash
  available after the minimum balance) rather than a bare red dot. The
  user must be able to tell "balanced and feasible" from "balanced but
  cash-constrained".
- **Pro-forma cash panel:** show the reconciliation (buyer cash, target
  cash swept, cash used, minimum balance, resulting pro-forma cash) as
  its own small table. Phase 7's methodology calls out "pro-forma cash
  reality" specifically, so this is a designed output, not a detail to
  bury.
- **Warnings:** missing target `total_debt` (46 source rows lack it, and
  net debt is now `NaN` rather than a false net-cash figure) must
  surface here as "target debt unknown", not silently as zero.

### 9. Accretion / Dilution *(backend: `accretion_dilution.py`, Phase 8)*
- **Purpose:** show what the deal does to the acquirer's EPS over three
  years, and how much synergy is needed to break even.
- **Primary user:** M&A associate, senior decision-maker reviewing the
  deal.
- **Primary actions:** adjust rates and synergies, read Year 1-3
  accretion/dilution, read break-even synergy.
- **Inputs specific to this screen (real parameter names):**
  `debt_interest_rate`, `foregone_cash_interest_rate` (labelled "cash
  yield" in the UI), `tax_rate`, plus the synergy schedule carried over
  from Deal Builder.
- **Layout:** headline row of metric cards: Standalone EPS, Pro Forma
  EPS, EPS change (Rs), Accretion/Dilution (%). Semantic color goes on
  the % and the badge only. Below: a three-year table (Year 1 / 2 / 3)
  with rows for buyer net income, target net income, interest on new
  debt, foregone interest on cash, after-tax synergies, pro-forma net
  income, pro-forma share count, pro-forma EPS, and A/D in Rs and %.
  Below that: the EPS bridge waterfall for the selected year (Acquirer
  EPS, plus target earnings, plus synergies, minus new-debt interest,
  minus foregone cash interest, equals Pro Forma EPS).
- **Break-even synergy** gets its own panel. The backend derives break-
  even gross and after-tax synergy analytically, so show both, say which
  is which, and show the gap against the synergy assumed.
- **Feasible vs infeasible labeling:** the backend labels
  accretion/dilution differently when the underlying transaction is
  infeasible. Mirror that in the UI with a visible "Infeasible
  transaction" state that changes the headline card's treatment, so a
  number computed on a deal that cannot be funded is never presented like
  a clean result.
- **Worked example to design against (real, validated):** TCS acquiring
  Infosys. Buyer TCS: net income Rs 49,210 Cr, diluted shares
  3,618,087,518, share price Rs 2,173.7, standalone EPS Rs 136.01.
  Target Infosys: net income Rs 29,440 Cr, diluted shares 4,046,940,812,
  share price Rs 1,132.5, standalone EPS Rs 72.75. At 20% premium with
  2/60/38 cash/debt/stock, Year 1 pro-forma EPS is Rs 129.28, a -4.95%
  change, dilutive. Break-even gross synergy is Rs 4,762 Cr.
- **Number-format reminder:** shares are raw counts and net income is in
  Rs Cr, so any per-share figure shown must already be converted by the
  backend. The UI displays, and never recomputes, financial figures.

### 10. Scenario Analysis *(Phase 9 -- see Section 6 below for full detail)*

### 11. Sensitivity Analysis *(layout only, paired with Scenario screen)*

### 12. Deal Comparison
- **Layout:** column-per-deal comparison table (2-4 deals), rows = Deal
  Value, Premium, EV/Revenue, EV/EBITDA, Cash/Debt/Stock %, Synergies,
  Accretion/Dilution, Announcement Date -- explicitly NO ranking/winner
  column or score, matching the spec's own instruction (Section 19: "the
  comparison is descriptive... do not create an arbitrary winner score").

### 13. IC Report
- **Layout:** document-style single-column reading view (not a
  dashboard grid) -- this is the one screen that should read like a
  formatted memo, not a data workbench, since its purpose is
  presentation/export, not exploration. Section anchors in a left rail
  for navigation within the long document. Export buttons (PDF/Excel)
  fixed in the header.

### 14. Data & Methodology
- **Layout:** reference/trust page -- data sources table, methodology
  explanations per module (pulling directly from the actual
  `docs/methodology.md` content already written), and critically, a
  **live data-quality panel**: count of Financial-sector exclusions,
  count of stale share-count fallbacks, count of DCF capex warnings
  across the universe, count of industries with zero precedent
  transaction coverage. This turns the honesty/transparency work already
  built into the backend (warnings, small-sample flags, coverage gaps)
  into a visible, credible feature rather than something only visible in
  console output -- arguably the single most differentiating screen for
  making this look "real" to an actual banker, since real terminals are
  obsessive about data provenance and quality flags.

---

---

## 5. Deal Workspace -- TCS -> Infosys (detailed)

This is the highest-priority screen to get right. Layout, 1440px:

```
+-----------------------------------------------------------------------+
| [Deal: TCS -> Infosys]                     [Export] [Save Scenario]   |
+---------------+---------------------------------------------------------+
| ACQUIRER       |  TRANSACTION SUMMARY                                  |
| TCS            |  +------------+------------+------------+---------+   |
| (edit)         |  |Purchase Eq.|Transaction |  Premium   | Status  |   |
|                |  |  Rs551,381Cr|  EV        |    20%     |  Base   |   |
| TARGET         |  |            |  Rs538,356Cr|            |  Case   |   |
| Infosys        |  +------------+------------+------------+---------+   |
| (edit)         |                                                       |
|                |  FINANCING MIX                                        |
| -------------  |  +-----------------------+  +----------------------+  |
| ASSUMPTIONS    |  | [donut: 2/60/38]      |  | New Debt   Rs327,240 |  |
| Premium   20%  |  |  Cash 2% Debt 60%     |  | Stock Cons.Rs207,252 |  |
| [====|=====]   |  |  Stock 38%            |  | Buyer Cash Rs10,908  |  |
|                |  +-----------------------+  +----------------------+  |
| Cash %     2%  |                                                       |
| [=|========]   |  EPS IMPACT                                           |
| Debt %    60%  |  +---------------------------------------------+     |
| [======|===]   |  |  [waterfall: Acquirer EPS -> +Target ->      |     |
| Stock %   38%  |  |   +Synergies -> -Interest -> -Tax -> =ProForma]|   |
| [====|=====]   |  |                                               |     |
|  must = 100%   |  |  Year 1 Pro Forma EPS: Rs129.28               |     |
|                |  |  Year 1 A/D:  -4.95%  [DILUTIVE] (red badge)  |     |
| Synergies      |  +---------------------------------------------+     |
| Rs___ Cr       |                                                       |
| Fees Rs___ Cr  |  BREAK-EVEN SYNERGY                                   |
|                |  Gross synergy required to reach breakeven:           |
| [Run Model]    |  Rs4,762 Cr  ( vs. Rs___ Cr assumed -- gap/surplus)  |
+---------------+---------------------------------------------------------+
```

Design notes:
- **Left rail (fixed width, ~280px):** all inputs. Sliders for
  Cash/Debt/Stock with a live-updating "must = 100%" validator that
  turns the constraint red the instant the three don't sum correctly --
  this should be impossible to submit in an invalid state, not just
  flagged after the fact.
- **Right area:** all outputs, denser grid of cards + charts. The EPS
  Impact panel is the single most important visual on the screen -- the
  accretion/dilution badge should be immediately visible without
  scrolling, colored red/green per the semantic system.
- **Break-even synergy** gets its own panel specifically because it
  answers the banker's real question ("how much synergy do we NEED for
  this to make sense") rather than just reporting an assumption back --
  this is a derived insight, and should look like one (distinct panel,
  not buried in the assumptions list).
- **Deal context switcher** in the top bar (per Section 3's IA
  rationale) lets the user jump to Sources & Uses or Accretion/Dilution
  for this SAME deal without re-selecting acquirer/target.

---

---

## 6. Scenario Analysis UI (Phase 9)

### Input-to-parameter mapping (bind the form to these exact names)

Every scenario input maps one-to-one onto a parameter the Phase 8
pipeline connector (`calculate_accretion_dilution_from_universe`)
already accepts, so a scenario is just a saved set of these values:

| UI label | Backend parameter |
|---|---|
| Purchase Premium | acquisition premium (Deal Builder input) |
| Cash % / Debt % / Stock % | `cash_pct` / `debt_pct` / `stock_pct` (must sum to 100%) |
| Debt Interest Rate | `debt_interest_rate` |
| Cash Yield | `foregone_cash_interest_rate` |
| Tax Rate | `tax_rate` |
| Year 1 / 2 / 3 Synergy | `synergy_year_1` / `synergy_year_2` / `synergy_year_3` |
| Minimum Cash | `minimum_cash_balance` |
| Target Debt Refinancing | `refinance_target_debt` |
| Target Cash Sweep | `use_target_cash` |
| Debt Issuance Fee | `debt_issuance_fee_pct` |
| Transaction Fees | `transaction_fees` |

Scenario outputs come from the same call, so Base / Downside / Upside are
three invocations with different parameter sets -- no new financial logic
is needed for Phase 9's scenario layer, only orchestration and storage.

Placeholder note: the blank `___` values and the illustrative comparison
numbers in the sketch below are layout placeholders, not real results.
Only the TCS -> Infosys figures in Sections 4 and 5 are validated output.

### Layout

```
+-----------------------------------------------------------------------+
| SCENARIOS: [Base Case] [Downside] [Upside] [+ New Custom]             |
+-----------------------------------------------------------------------+
|  ACTIVE: Base Case                    [Duplicate] [Delete] [Set Base] |
+---------------+---------------------------------------------------------+
| INPUTS         |  OUTPUTS                                              |
| Premium    25% |  Purchase Equity Value    Rs___ Cr                    |
| Cash %      2% |  Transaction EV           Rs___ Cr                    |
| Debt %     60% |  New Debt                 Rs___ Cr                    |
| Stock %    38% |  Stock Consideration      Rs___ Cr                    |
| Debt Rate 8.5% |  Cash Used                Rs___ Cr                    |
| Cash Yield  4% |  Feasibility        [Feasible / Constrained]          |
| Tax Rate  25%  |                                                        |
| Synergy Y1 ___ |  Year 1 EPS   ___   Year 1 A/D   ___%  [badge]        |
| Synergy Y2 ___ |  Year 2 EPS   ___   Year 2 A/D   ___%  [badge]        |
| Synergy Y3 ___ |  Year 3 EPS   ___   Year 3 A/D   ___%  [badge]        |
| Min Cash   ___ |                                                        |
| Refinance  ___ |  Break-even Synergy       Rs___ Cr                    |
| Cash Sweep ___ |                                                        |
| Issuance Fee_  |                                                        |
+---------------+---------------------------------------------------------+
| SCENARIO COMPARISON                                                    |
| +--------------+----------+----------+----------+                     |
| |              |Base Case |Downside  |Upside    |                     |
| +--------------+----------+----------+----------+                     |
| |Year 1 A/D    |  -4.95%  |  -9.2%   |  +2.1%   |                     |
| |Break-even Syn|  Rs4,762 | Rs7,100  | Rs2,900  |                     |
| +--------------+----------+----------+----------+                     |
+-------------------------------------------------------------------------+
| SENSITIVITY: [1D Table] [2D Matrix]                                     |
|                                                                          |
|  Premium x Synergy -- Year 1 A/D %                                      |
|           Synergy: Rs0Cr  Rs1000Cr  Rs2000Cr  Rs3000Cr  Rs4000Cr        |
|  Premium 15%      -2.1%   -0.8%    0.5%     1.8%     3.1%              |
|           20%      -4.9%   -3.6%   -2.3%    -1.0%    0.3%              |
|           25%      -7.2%   -5.9%   -4.6%    -3.3%    -2.0%             |
|           30%      -9.8%   -8.5%   -7.2%    -5.9%    -4.6%             |
|  (cells colored on a red-to-green gradient by value, NOT arbitrary      |
|   colors -- this must read as a heat-map at a glance)                  |
+-------------------------------------------------------------------------+
```

Design notes:
- **Scenario tabs** at the very top, styled as the same underline-tab
  component as the rest of the app (Section 2.6) -- Base Case always
  present and marked, Downside/Upside are suggested defaults but fully
  editable, Custom scenarios addable without limit.
- **Feasibility warning** must be impossible to miss -- if min cash
  constraint is violated or debt capacity is exceeded, the Feasibility
  indicator turns to a warning badge AND a banner appears above the
  Outputs column explaining specifically what's infeasible (e.g. "Cash
  used (Rs X Cr) exceeds available cash after minimum balance (Rs Y Cr)") --
  never just a colored dot with no explanation.
- **Scenario comparison table** always visible below the active
  scenario's detail (not a separate screen) -- the whole point of having
  scenarios is comparing them, so comparison shouldn't require
  navigation away from editing.
- **Sensitivity matrix** toggles between 1D (single table, one variable
  against the output) and 2D (the matrix shown above). Heat-map coloring
  on the 2D matrix is the single highest-value visual element on this
  screen -- a banker should be able to see the "safe zone" and "danger
  zone" of assumption combinations at a glance, which is the entire
  point of a sensitivity table over a single point estimate.
- Every numeric input here should support **inline editing directly in
  the table cell** for quick "what if" adjustments, not just the sidebar
  form -- real analysts iterate fast and won't tolerate a form-only
  interaction model for this screen specifically.

---

---

## 7. Visual Design Direction (summary)

A modern institutional M&A workstation: near-black navy surfaces, hairline
borders, Inter with tabular figures, one blue accent, semantic colour only
for data. Photography appears on public pages only. The market ticker is
the one persistent piece of motion and the one signature element shared by
the home page and every app screen.

**Grid.** 12 columns, 24px gutter, 56px page margin (24px on narrow
screens). Prefer 70/30 or 65/35 splits over even thirds.

**Described 1440px app screen (Valuation Summary).** A 36px ticker
strip spans the full width. Below it, a 240px sidebar on the left and a
56px header (breadcrumb, search, deal switcher, user menu) on the right.
The page title "Valuation summary" sits at 24px/600 with Industrial and
cement badges beside it. Three equal panels (Trading comps, Precedent
transactions, DCF) at `--bg-surface` carry the bucket values at 24px
tabular. Below them, a full-width range bar plots Low, Base and High with
each method marked on the same axis. A consolidated warnings panel with a
`--warning` left stripe closes the screen.

**Responsive.** Public pages work down to 360px. The app starts at 1280px.

---

## 8. App Shell and Photography Rules

### 8.1 Routes

- Public: `/` (home, locked), `/sign-in`, `/methodology`.
- App (after sign-in): the navigation in Section 3.

### 8.2 App shell at 1440px

```
+----------------------------------------------------------------------+
| ticker strip, 36px, full width (same component as the home page)     |
+------------+---------------------------------------------------------+
| sidebar    | header, 56px: breadcrumb | search (Ctrl/Cmd+K) |        |
| 240px      |   deal switcher | user menu                             |
| wordmark   +---------------------------------------------------------+
| nav groups | page content, 24px padding                              |
| (Section 3)|                                                         |
+------------+---------------------------------------------------------+
```

- Sidebar collapses to a 64px icon rail for wide tables. Active item has a
  2px `--accent-line` bar on the left and `--text-primary` text.
- The ticker is part of the shell on every screen. A click on a symbol
  that exists in the 113-company universe opens that company's page.
- **Honesty rule:** until a live market feed exists, the ticker shows the
  label "Markets · sample data". Once live, the label states the source and
  delay. Never show sample numbers without the label.
- Header height 56px; breadcrumb on the left; the deal switcher appears
  only inside the Deal Workspace group (Section 3).

### 8.3 Photography

- The hero photo is used on public pages only: home and sign-in. The IC
  Report cover may use it. It never sits behind tables, forms or charts.
- App screens are flat: `--bg-base` page, `--bg-surface` panels.
- Asset: `finance-watermark.jpg`, 1920 x 1024, 283 KB. Store at
  `/assets/images/finance-watermark.jpg`. Ship a 1600px WebP or AVIF as the
  primary source with the JPEG as fallback.
- Confirm the licence covers commercial web use before any public launch.
- Placement: `background-size: cover`, `background-position: 75% center`,
  overscan 4% on every side so the drift animation never exposes an edge.
- Scrim (the only gradients in the product), over the photo:
  - Horizontal: `rgba(11,15,20,.94)` at 0%, `.78` at 34%, `.30` at 68%,
    `.42` at 100%. This keeps the left half dark for text.
  - Vertical: `rgba(11,15,20,.95)` at the bottom fading to 0 at 38%, so the
    stats strip stays legible.
- Below 860px, keep the towers on the right and let the scrim carry the text.

---

## 9. Final Recommendation (v2)

1. **Visual identity:** near-black navy workstation, hairline borders,
   Inter with tabular figures, one blue accent, semantic colour for data
   only. One photographic hero on public pages. The scrolling market ticker
   is the signature element.
2. **Navigation:** persistent left sidebar grouped Overview / Research /
   Deal workspace / Portfolio / Output / System (Section 3), under a global
   ticker strip, with a deal switcher in the header inside the Deal Workspace.
3. **Layout:** 12-column grid, 56px page margin, asymmetric splits, dense
   tables with sticky headers and frozen first columns.
4. **Build first:** the app shell (ticker, sidebar, header), then Target
   Screening and Valuation Summary. They set the table, filter, metric-card
   and warning vocabulary for everything else.
5. **Do not build yet:** light theme, mobile app layouts, live market feed,
   and the Scenario, Sensitivity, Deal Comparison and IC Report screens
   until their Phase 9 backend exists. Deal Builder, Sources & Uses and
   Accretion/Dilution have validated backends and are safe to build.
6. **Original to DealForge:** surfacing data limits as designed features
   (small-sample badges, empty states that say why, a consolidated warnings
   panel, the live data-quality panel on Data & Methodology), and real
   numbers only on the marketing page.

---

## 10. Home Page (LOCKED v2)

Approved design, built and published at
https://claude.ai/artifact/LPuK12wv8P4rXWcxxWrxS8. Reproduce it exactly.
Change nothing here without an explicit decision.

### 10.1 Structure, top to bottom

1. **Ticker strip** (36px). Left cell: "Markets" plus muted "sample data".
   Right: the scrolling track, two identical groups, the second
   `aria-hidden`. Seven symbols: SENSEX, NIFTY 50, RELIANCE, TCS, HDFCBANK,
   ULTRACEMCO, INFY, each with value and a green up-triangle or red
   down-triangle with percent move.
2. **Nav.** Wordmark "DEALFORGE" on the left. On the right: Screening,
   Valuation, Deal builder, Methodology, and a small ghost "Sign in" button.
   Under 860px only the Sign in button remains.
3. **Hero**, left-aligned, vertically centred in the remaining height.
   Headline in three lines: "Evaluate targets." / "Model deals." /
   "Decide with evidence." Sub: "Screen acquisition targets, benchmark their
   valuation, and see what a deal does to your EPS, all on sourced Indian
   financials." Buttons: primary "Start screening" (to `/screening`) and
   ghost "Read the methodology" (to `/methodology`).
4. **Stats strip** along the bottom, four columns with a 1px `--line-rule`
   top border and column dividers:
   - 113 companies covered
   - 16 sectors
   - 4 sourced transactions
   - 10 years of financial history, at most
5. **Background:** the photo with drift animation and the two-part scrim
   (Section 8.3), behind everything.

### 10.2 Content rules

- Every stat must be computed from the data (count of companies, distinct
  sectors, transactions, maximum years of history), not hard-coded. The
  values above are the current dataset.
- No invented customer counts, logos or testimonials.
- No eyebrow label above the headline.
- Ticker numbers are sample data until a feed exists, and say so.

### 10.3 Reference CSS (from the approved build)

Use these values, keyframes and class names as the source of truth for
sizes, colours, timings and breakpoints. Translate to Tailwind or CSS
modules if needed, but keep the numbers.

```css
body{margin:0;background:#0B0F14}
@property --n1{syntax:"<integer>";inherits:false;initial-value:0}
@property --n2{syntax:"<integer>";inherits:false;initial-value:0}
@property --n3{syntax:"<integer>";inherits:false;initial-value:0}
@property --n4{syntax:"<integer>";inherits:false;initial-value:0}
.page{position:relative;overflow:hidden;min-height:820px;display:flex;flex-direction:column;background:#0B0F14;color:#F2F5F8;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.bg{position:absolute;top:-4%;right:-4%;bottom:-4%;left:-4%;background-image:url(/assets/images/finance-watermark.jpg);background-size:cover;background-position:75% center;animation:drift 50s ease-in-out infinite alternate}
.scrim{position:absolute;top:0;right:0;bottom:0;left:0;background:linear-gradient(90deg,rgba(11,15,20,.94) 0%,rgba(11,15,20,.78) 34%,rgba(11,15,20,.30) 68%,rgba(11,15,20,.42) 100%),linear-gradient(0deg,rgba(11,15,20,.95) 0%,rgba(11,15,20,0) 38%)}
.stack{position:relative;display:flex;flex-direction:column;flex:1}
.ticker{display:flex;align-items:center;height:36px;border-bottom:1px solid #243040;background:rgba(8,11,16,.85);font-size:12px;font-variant-numeric:tabular-nums}
.tlabel{flex:none;display:flex;align-items:center;gap:8px;height:100%;padding:0 16px;border-right:1px solid #243040;color:#C3CCD9;white-space:nowrap}
.tlabel i{font-style:normal;color:#8794A6}
.twin{flex:1;overflow:hidden}
.track{display:flex;width:max-content;animation:tick 50s linear infinite}
.grp{display:flex;gap:36px;padding-right:36px;white-space:nowrap}
.ticker:hover .track{animation-play-state:paused}
.sym{color:#D5DCE6;font-weight:500;margin-right:6px}
.up{color:#22C55E}
.dn{color:#EF4444}
.nav{display:flex;align-items:center;justify-content:space-between;padding:28px 56px 0}
.mark{font-weight:600;font-size:16px;letter-spacing:.14em;color:#F2F5F8;text-decoration:none}
.navlinks{display:flex;align-items:center;gap:32px}
.navlinks a.l{color:#C3CCD9;text-decoration:none;font-size:14px;padding:12px 0}
.navlinks a.l:hover{color:#FFFFFF}
.hero{flex:1;display:flex;flex-direction:column;justify-content:center;padding:56px 56px 40px;max-width:1280px;box-sizing:border-box}
.h1{margin:0 0 28px;font-weight:600;font-size:clamp(40px,5.4vw,80px);line-height:1.04;letter-spacing:-.025em}
.ln{display:block;overflow:hidden;padding-bottom:.08em}
.in{display:block;animation:rise .9s cubic-bezier(.2,.7,.2,1) both}
.sub{margin:0 0 36px;max-width:500px;font-size:18px;line-height:1.55;color:#B4BFCE;animation:fadein .8s ease .7s both}
.cta{display:flex;gap:12px;flex-wrap:wrap;animation:fadein .8s ease .85s both}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;box-sizing:border-box;padding:0 24px;border-radius:4px;font-size:15px;font-weight:500;text-decoration:none}
.btn.p{background:#2563EB;color:#FFFFFF}
.btn.p:hover{background:#1D4ED8}
.btn.g{border:1px solid #4A586B;color:#F2F5F8}
.btn.g:hover{border-color:#8FA1B8;background:rgba(255,255,255,.05)}
.btn.s{padding:0 16px;font-size:14px}
a:focus-visible{outline:2px solid #60A5FA;outline-offset:3px}
.stats{position:relative;display:grid;grid-template-columns:repeat(4,1fr);margin:0 56px;border-top:1px solid #2A3646;animation:fadein .8s ease 1s both}
.stat{padding:22px 24px 28px 0}
.stat + .stat{border-left:1px solid #2A3646;padding-left:24px}
.val{font-size:40px;font-weight:500;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.1}
.lbl{margin-top:6px;font-size:13px;color:#A9B4C3}
.c1{counter-reset:n var(--n1);animation:k1 1.8s cubic-bezier(.2,.7,.2,1) 1.1s both}
.c1::after{content:counter(n)}
.c2{counter-reset:n var(--n2);animation:k2 1.8s cubic-bezier(.2,.7,.2,1) 1.1s both}
.c2::after{content:counter(n)}
.c3{counter-reset:n var(--n3);animation:k3 1.8s cubic-bezier(.2,.7,.2,1) 1.1s both}
.c3::after{content:counter(n)}
.c4{counter-reset:n var(--n4);animation:k4 1.8s cubic-bezier(.2,.7,.2,1) 1.1s both}
.c4::after{content:counter(n)}
@keyframes drift{
from{transform:scale(1) translate(0,0)}
to{transform:scale(1.07) translate(-1.5%,1%)}
}
@keyframes tick{
to{transform:translateX(-50%)}
}
@keyframes rise{
from{transform:translateY(105%)}
to{transform:translateY(0)}
}
@keyframes fadein{
from{opacity:0;transform:translateY(8px)}
to{opacity:1;transform:translateY(0)}
}
@keyframes k1{
from{--n1:0}
to{--n1:113}
}
@keyframes k2{
from{--n2:0}
to{--n2:16}
}
@keyframes k3{
from{--n3:0}
to{--n3:4}
}
@keyframes k4{
from{--n4:0}
to{--n4:10}
}
@media (prefers-reduced-motion:reduce){
.bg,.track,.in,.sub,.cta,.stats{animation:none}
.c1{animation:none;--n1:113}
.c2{animation:none;--n2:16}
.c3{animation:none;--n3:4}
.c4{animation:none;--n4:10}
}
@media (max-width:860px){
.nav{padding:20px 24px 0}
.navlinks a.l{display:none}
.hero{padding:48px 24px 32px}
.stats{grid-template-columns:1fr 1fr;margin:0 24px}
.stat:nth-child(3){border-left:0;padding-left:0}
.stat:nth-child(n+3){border-top:1px solid #2A3646}
.val{font-size:32px}
.sub{font-size:16px}
}
```

### 10.4 Implementation notes (React / Tailwind / Lovable)

- Keep `@property`, `@keyframes` and the counter classes in a global
  stylesheet; Tailwind utilities cannot express them.
- Render the ticker group twice from one array so the loop is seamless.
- The count-up needs no JavaScript. Do not replace it with a JS counter.
- Load Inter with `font-display: swap`.
- Replace the single hard-coded photo URL with the asset path in Section 8.3.
- Headline lines are separate block elements with `overflow: hidden` so the
  rise animation is clipped; do not collapse them into one wrapped paragraph.

---

## 11. Implementation Hand-off

### 11.1 Build order

1. Global tokens, Inter, and the motion rules (Section 2).
2. Home page exactly per Section 10.
3. App shell (Section 8.2).
4. Target Screening and Valuation Summary against the real backend.
5. Deal Builder, Sources & Uses, Accretion/Dilution (parameters in
   Section 4, screens 7-9).
6. Phase 9 screens after their backend exists.

### 11.2 Prompt for the home page (paste into Lovable or Antigravity)

> Build the public home page exactly as specified in Section 10 of
> `docs/design-system.md`, using the tokens in Section 2 and the photo
> rules in Section 8.3. Use the reference CSS in Section 10.3 for sizes,
> colours, timings and breakpoints. Left-aligned hero over the photo, a
> scrolling market ticker strip at the top labelled "Markets · sample
> data", three-line headline with the line-rise animation, CSS-only
> count-up stats at the bottom. No extra sections, no floating cards, no
> gradients except the photo scrims. Respect `prefers-reduced-motion`.

### 11.3 Prompt for the app shell

> Build the authenticated app shell per Section 8.2 of
> `docs/design-system.md`: full-width 36px ticker strip, 240px sidebar
> that collapses to 64px, 56px header with breadcrumb, search and user menu.
> Flat `#0B0F14` surfaces, no photography, Inter with tabular numerals,
> sentence-case labels, 4px radius, hairline borders. Navigation groups
> from Section 3.

### 11.4 Check before accepting any screen

- Colours, type sizes and spacing come from Section 2 tokens, not new values.
- Labels are sentence case; there are no all-caps eyebrows.
- Numbers use Indian grouping with units, and are tabular.
- Warnings, small-sample flags and empty states are visible and say why.
- Reduced motion works; focus is visible; contrast passes.
