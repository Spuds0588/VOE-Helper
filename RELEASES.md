# Releases — VOE Helper

Distribution for v1 is the GitHub repo itself (`Spuds0588/VOE-Helper`, main branch); the home
page (`index.html`) targets GitHub Pages. No Chrome Web Store listing.

## v1.1.1 (2026-10-23)

Tag: `v1.1.1` · package: `voe-helper-1.1.1.zip` — user-reported fixes from testing the
v1.1.0-alpha in a real Chrome profile.

**Fixed**

- **Side panel opens from the toolbar icon** (a plain left-click used to do nothing; the
  panel was only reachable via the icon's right-click menu).
- **WVOE output prints the official Fannie Mae Form 1005** instead of a blank sheet: the
  form is bundled (`assets/fannie-mae-form-1005.pdf`) and the collected values overlay
  Part I — Item 1 (employer name + address), Item 2 (lender block), Item 5 (date),
  Item 6 (lender's file/loan number), Item 7 (borrower name) — plus a courtesy prefill of
  Item 10 (Present Position). The employer's own sections (Part II–IV) stay blank.
- **Vault Verify removed from the provider cards** (`vaultverify.com` now routes into The
  Work Number after the Equifax acquisition — use the Work Number card).

## v1.1.0-alpha (2026-10-23)

Tag: `v1.1.0-alpha` · package: `voe-helper-1.1.0-alpha.zip` (unchanged-function data refresh
included)

**New since v1.0.0**

- **Side panel** (`chrome.sidePanel`): collect manual WVOE (Form 1005) values next to the LOS
  tab, persist a debounced draft, and generate/download the filled PDF in-panel.
- **Manual VOE sweep** in the side panel: provider cards move the current tab through the
  provider search pages top-down, auto-select the query, and save confirmed
  provider+code pairs as custom employer rows (immediately matchable).
- **Right-click without selection**: the deepest text-bearing element under the click
  supplies the query when nothing is highlighted (`click-tracker.js`).
- **Coded rows suppress the manual-WVOE button** — only uncoded/no-match toasts offer it.
- **WVOE generation** (pdfme) in both the full-page preview and the side panel.
- **Community match-report → draft-PR workflow** (labeled issue opens a maintainer PR,
  never auto-lands).
- **Index refresh**: 15,778 records, 195 coded (The Work Number 189 in-index + Thomas &
  Company 6), built from the pass-17 dork harvest. Every coded row carries verbatim
  provenance notes; see `data/sources.md` for the full sourcing ledger.

**Known limitations (alpha)**

- Loading the index into `chrome.storage` takes a few seconds on first run after install.
- Codes are point-in-time verified; employers reorganize — confirm with the provider before
  ordering a verification (vintage caveats ride along in each row's notes).

## v1.0.0 (shipped 2026-10-22)

- Right-click (selection optional) → toast with provider + employer code + portal deep link.
- Index of 15,000+ employers (Truework bulk capture + curated coded seeds).
- Form 1005 fallback toast on no-match; GitHub issue match-report template.
