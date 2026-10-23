# Phase 2 (planned): WVOE Form Generator — Scope & Plan

Status: **planned, not started.** No deadline; build only after the user asks.
This document exists so the future build session starts from agreed scope
instead of re-deriving it.

## Goal

A mortgage processor who right-clicks an employer and gets the toast should be
able to generate a filled **Written Verification of Employment (WVOE)** PDF in
one step, without leaving the browser or touching a PDF editor.

## Approach (as specified by the user)

- [@pdfme](https://github.com/pdfme/pdfme) (`@pdfme/generator`) for local PDF
  population: template + field values → PDF, entirely client-side.
- The WVOE **template is bundled** with the extension (pdfme template JSON +
  base font), not authored in-app.
- A new **extension-tab UI** (`wvoe.html` opened in a tab) is triggered from a
  toast button (**"Generate WVOE Form"** on coded matches), carrying the
  matched employer row (name, provider, code, notes) into the form.
- **User-defined presets** (borrower file basics: name/loan number/date,
  processor signature block, reusable employer entries) persisted in
  `chrome.storage.local`.

## In scope (v1 of the feature)

1. Bundled one-page WVOE template (standard fields: employer name, address,
   phone, dates of employment, position, compensation, provider + TWN code
   where used, verifier block).
2. New-tab form UI with grouped inputs: Borrower/Preset, Employer (pre-filled
   from the matched row, editable), Verifier.
3. Preset CRUD: save / load / delete / rename; storage local-only.
4. Generate → download the filled PDF (also "open in print preview" as a
   convenience path).
5. Toast wiring: button opens `wvoe.html?employer=<record id>`; tab UI fetches
   the row from `chrome.storage.local`.

## Out of scope (v1)

- No template editing UI (template JSON maintained in-repo, regenerated with
  pdfme's schema by hand/opening the designer once during dev only).
- No cloud, no uploads, no telemetry; everything stays in `chrome.storage`.
- No multi-template support, no digitally signed outputs, no auto-submitting
  to any lender LOS.
- No new data sourcing; the WVOE UI reads only what the index already has.

## Technical notes & risks

- MV3 CSP: no remote code. `@pdfme/generator` + `@pdfme/ui`-equivalents must
  be bundled at build time; verify the bundle does not rely on
  `eval`/remote fetch. pdfme charts its rendering through pdf-lib + fontkit
  (pure JS) — expected to work in an extension page, but **M1 proves it
  before anything else is built**.
- Fonts: pdfme requires a registered font (Base64). Bundle a locally provided
  subset font (no CDN fetch).
- Payload size: template JSON + font should stay well under the extension
  size budget; `employers.json` remains the bulk of the package.
- The tab page reuses the existing matcher storage; no new permissions needed
  (storage + activeTab already granted).

## Milestones

| # | Milestone | Exit criterion |
|---|---|---|
| M1 | pdfme spike in `wvoe.html` | Bundled generator produces the bundled template filled with hardcoded values, downloaded as PDF |
| M2 | Field mapping + employer pre-fill | "Generate WVOE Form" from a toast opens the tab with the matched employer row pre-filled |
| M3 | Presets | Save/load/delete/rename presets; reload keeps them |
| M4 | Tests + docs | Headed test drives the flow end to end; README/PRD notes updated |

## Acceptance

- Right-click a coded employer → toast → "Generate WVOE Form" → tab opens with
  employer/verifier fields pre-filled → Generate → a correct WVOE PDF lands in
  Downloads.
- Works with zero network access; uninstalling the extension clears all data.
