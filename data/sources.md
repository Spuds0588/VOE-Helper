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

## Sourcing pass 2 (2026-10-22)

- **Rule addition:** this pass, researcher-agent quotes were treated as provisional.
  All 23 candidate codes were therefore self-verified by direct fetch of each
  source page before appending — 23/23 confirmed verbatim. Nothing unverified
  entered verified_seeds.jsonl.
- **Bucket results:**
  - *Private employers (new bucket):* productive for restaurants/hospitality,
    facilities, aviation and logistics (ABM 20784, Delaware North 593504, Endeavor
    Air 13966, HMSHost 19413, Olive Garden 11533, Ryder 10919, Compass Group 11366
    via Crothall's brand page). Banks/telecoms/retail giants (Walmart, Lowe's)
    surfaced only unverifiable PDFs or 403 pages — recorded as unverified leads:
    Atrium Health, Trinity Health, UNC Health, ECMC, Arkansas Children's, U
    Miami, Walmart, Lowe's.
  - *County/city/K-12 (extended from pass 1):* 12 more verified (Baltimore City
    18599, Stanislaus County 35248, Buncombe County 22397, Polk County OR
    3026524, Milwaukee County 13508, Ann Arbor 16993, Thompson SD 15544,
    Rochester CSD 4246414, NEISD 18971, Magnolia ISD 11366549, Fulton County
    Schools 17127, Buffalo Public Schools 19205).
  - *Healthcare systems (new bucket):* 4 verified (Hackensack Meridian Health
    25383, Health First 33162, Bon Secours Mercy Health 12925, University of
    Rochester 11968).
  - *State UC/claims operational guides:* still a non-finding. Fetched guides
    (Mass DTA BEACON, Santa Clara County social-services handbook) describe TWN
    use but publish no numeric agency code. Record: do not infer codes from
    these guides.
  - *Public directories (2nd attempt):* still no genuine public TWN code list on
    GitHub/open web. Equifax's public "Find Your Employer" page is a JS shell
    with no extractable directory in fetched text; per ground rules it stays
    off-limits behind authentication. Not a data source.
- **Matching-precedence observation (not a blocker):** build_index sorts output
  alphabetically, so a bare ambiguous selection like "Polk County" resolves to
  the uncoded generically-named Truework row rather than the coded
  "Polk County Oregon" record; coded rows resolve on any more specific
  selection. Noted as input to a future matcher-precedence pass, where alias
  rows for a coded record should outrank a same-name uncoded row.

## Sourcing pass 3 (2026-10-22)

- **PDF front: resolved.** Walmart's official lender PDF
  (one.walmart.com "Employment-Verification---Lender.pdf") serves openly
  (HTTP 200, no login); downloaded to /tmp and extracted with `pdftotext -layout`,
  which prints "Wal-Mart Company code = 10108" twice. Landed as Walmart 10108 with
  a dated-source caveat in its notes (the PDF uses TALX-era wording — the code is
  old but the document is official and live on Walmart's own domain).
  Lowe's corporate page returned 403 — stays off-limits and logged, per rules.
- **Verified this pass (13, all self-read verbatim before landing):**
  telecom/utilities opened with Verizon 10303 (official offboarding page) and
  Comcast 17000 (official careers FAQ); hospitality got Marriott Vacations
  Worldwide 18137 (public SEC 425 filing — a new allowed source class: federal
  filings); aviation got United 10209 (AFA-CWA union page, dated 2021) and AMR
  10101 (TWU 514 union page, dated vinting - landed as "AMR Corp" with NO
  American Airlines alias, notes state it may predate the merger — matcher
  check confirms "American Airlines" selections still do NOT resolve to it);
  city bucket grew by Cleveland 102720, Cincinnati 4372219, Albuquerque 20618,
  Minneapolis 11468, Boca Raton 29515; education by FIU 19266 and Montclair
  State 14991.
- **Still non-verifiable after another pass (unchanged verdict):** grocery chains
  (Kroger, Costco, Albertsons, Publix, H-E-B, Wegmans — official pages fetched
  but no code in text; Albertsons student-era portal is behind login), hotels
  (no Marriott International code yet — only distinct-company MVW 18137),
  banks/credit unions, remaining utilities, and healthcare PDFs (Atrium, Trinity,
  UNC Health, ECMC, Arkansas Children's, U Miami) whose PDFs/readers remain
  unfetchable or 403. None of these entered employers.json.
- **Source-class note:** union pages may carry employers' codes, but they are
  dated third-party material. Rule for future passes: union-sourced codes are
  landed at most with explicit vintage/parentEntity caveats in `notes`, never as
  aliases of the modern company name unless an employer-owned page confirms.
