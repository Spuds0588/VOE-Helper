# Employer-Code Sourcing — Ground Rules & Sources (2026-10-22)

## Ground rules (binding on every pass that touches code-bearing data)

1. **Freely public data only.** Codes are taken from pages any visitor can read
   without paying, logging in, or accepting a special agreement: the employer's
   own HR/benefits site, government agency sites, public university sites.
2. **No scraping of Equifax / The Work Number / TALX services.** We never fetch
   from theworknumber.com's verifier portal, Equifax services, or any
   authenticated/paywalled surface. no bulk ToS-violating crawling.
3. **robots.txt respected.** This method is a handful of individual page visits
   during data-authoring passes, not automated bulk crawling; we still honor
   robots directives on the pages we read.
4. **Never invent or infer a code.** A code enters `verified_seeds.jsonl` only
   after it has been seen verbatim in text fetched from its source page.
   Agent-reported entries are spot-sampled by the working agent before being
   appended; entries that fail sampling are dropped.
5. **Every appended code carries source attribution** in the record's `notes`
   field (schema-legal location), because the PRD §1.6 record schema has no
   dedicated source column.
6. One employee group may have a different code than another (e.g. students vs
   staff); that distinction goes in `notes`, never as a second row under the
   same name.

## Method

Search engines with domain-scoped queries (`site:gov`, `site:edu`, patterns
like `"Employer Code is" "The Work Number"`) surface employer-owned HR pages
that tell their own staff which code to give verifiers. Each candidate page is
fetched, the code is read in the page text, and the record is built from what
the page says (including the name the employer uses for itself).

## Sources catalog

| Source type | Finding (2026-10-22) |
|---|---|
| Employer HR/benefits pages (.gov/.edu/.org) | The most productive source. 26 verified codes appended this pass (see history.md for the batch). Reproducible query patterns: `site:gov "The Work Number" "Employer Code" employment verification county city HR`, `site:edu "The Work Number" "Employer Code" university HR`, plus phrase variants "employer code is" / "our employer code". |
| Public GitHub mirrors of TWN code lists | Searched repos/gists/raw files ("TWN employer code list", "the work number employer codes" and code-spot-checks for 11116/10115/10396). Found only template boilerplate with `Employer code: [XXXX]` placeholders — no genuine list. Noted as a non-finding: GitHub code search via unauthenticated API is limited, so future passes may retry with different tooling, but nothing usable exists surfaced yet. |
| State UC/claims-agency operational guides publishing codes | Not found in this pass's searches. State workforce/child-support guides examined referenced TWN as a concept without publishing their own employer codes. Retry candidates for a future pass: state DOLHR intranet-facing pages, county HR verification pages (already productive under the employer-page bucket above). |

## Provenance hygiene

- Bulk Truework rows in `raw_employers.jsonl` can never carry codes (Truework
  does not publish numeric employer codes); codes come only through
  `verified_seeds.jsonl`, which wins name collisions at build time by design.
- A future guard could live in `build_index.py`: reject appended codes whose
  `notes` lack a `http` source reference. Not implemented this pass (change
  scope was data-only); recorded here as the natural next step.
