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

## Sourcing pass 4 (2026-10-22)

- **PDF front, second round: fully resolved with a real extraction step.** All four
  pass-2/3 healthcare PDF leads now served freely (HTTP 200) and were extracted with
  `pdftotext -layout`, self-read verbatim before landing: Atrium Health 18566
  (teammates.atriumhealth.org verifier-message PDF, TALX-era vintage), Mount Carmel
  Health System 14229 (mountcarmelhealth.com colleague PDF; a Trinity Health ministry —
  landed as its own employer, NOT as a Trinity Health system-wide code), Arkansas
  Children's 19443 (archildrens.org HR PDF, 2016 vintage), University of Miami 25389
  (hr.miami.edu Work Number FAQ PDF; the HTML page itself 403s — the freely-served
  official PDF on the same domain is the source of record).
- **New source class: distinction-aware hosting.** The ecmc.org verifier-message PDF
  names the donor employer verbatim: "Educational Credit Management Corporation (ECMC)
  employee", code 25016. Domain ownership was confirmed (homepage: "nonprofit
  corporation providing services in support of higher education finance"); landed under
  the full legal name with an explicit NOT-Erie-County-Medical-Center note, since the
  shared "ECMC" abbreviation is a classic wrong-entity trap.
- **Verified this pass (15, all self-read verbatim before landing):** finance U.S. Bank
  10360 (official alumni page); education-finance Educational Credit Management Corp
  25016 (official PDF); hospital systems Atrium 18566, Mount Carmel 14229, Arkansas
  Children's 19443, University of Miami 25389; counties Dallas County TX 15311, County
  of Nevada CA 22626, Nashville/Davidson 22559; K-12/higher-ed Tulsa Public Schools
  58858, Ivy Tech 19063, Community College of Philadelphia 5130409, NC A&T 11031935,
  Texas State 4359214, University of Northern Iowa 17853 (student/GA code 18051
  recorded in notes per the one-row-per-name rule).
- **Unverified leads (catalog only, no landing):** UNC Health 15503 — official page
  403s to direct fetch and mirror; access restriction stands per ground rules. Pacific
  Bells (Taco Bell franchise) 118402 — contact page robot-gated. Trinity Health
  corporate (system-wide) — no extractable employer-owned doc; only the Mount Carmel
  affiliate was readable. Fast-food/coffee/movie chains (McDonald's, Starbucks, AMC,
  Regal, Cinemark, et al.) — no employers-owned code pages found again; recorded as a
  standing non-finding, franchise codes (per-operator) must never be landed as brand
  codes. Banks/credit unions beyond U.S. Bank (BoA, Chase, PNC, Capital One, Truist,
  Regions, KeyBank, Navy Federal, PenFed, USAA, insurers) — official pages mention The
  Work Number but publish no numeric code in fetched text; standing non-finding after
  two passes.
- **Matcher spot-check artifact (third documented manifestation).** 25/28 selections
  resolve correctly under the shipped matcher's exact normalization; the 3 misses
  ("Dallas County", "Dallas County TX", "Metro Nashville") are the same already-logged
  precedence artifact: an exact-name generically-titled uncoded Truework directory row
  outranks a coded record reached by exact name or alias on ties. Coded rows resolve on
  canonical and most alias selections (U.S. Bank/US Bank/UNI/Ivy Tech/ECMC/Mount
  Carmel all verified this pass). The code-side fix (coded resolution outranking
  uncoded same-normalized-name rows) remains the singular product fix this catalog
  has been accruing evidence for.

## Sourcing pass 5 (2026-10-22)

- **Big-tech/retail front (direct FAQ pages): verified non-finding.** Amazon,
  Microsoft, Apple, Google, Costco, UPS, FedEx, Tyson and WMI publish no Work Number
  code on their employment-verification surfaces in fetched text; direct fetches and
  not site-restricted searches were used. The only productive brand page this front
  produced was **Bahama Breeze 11533** (bahamabreeze.com/faqs) — the same Darden
  parent code as Olive Garden. Landed as its own row so a Bahama Breeze selection
  displays the correct brand name; duplicate code 11533 is intentional and noted.
  Home Depot 11116 (already in the index from pass 1) could not be re-confirmed on
  current pages — existing landing stands on its pass-1 verification.
- **Chain benefit-plan PDF lane: two landed, one 403, one non-finding.** Farmer Focus
  679792 landed from farmerfocus.com's own 2026 Benefits Guide PDF; County of Ventura
  13009 landed from the ventura.org new-hire resources PDF (extracted via
  pdftotext; the same path on ventura.org serves the same file directly, so the
  CDN-mirror URL was not the basis for verification). Spartanburg Regional's 2024
  benefits guide serves openly but contains no Work Number code in extracted text —
  non-finding, not restricted. McLeod Health 2025 guide: HTTP 403, off-limits and
  logged. No grocery/food/theater chain code remains reachable; the compiled Scribd
  table candidate ("Employer Code Company Name") is unproven, non-US, low-numbered —
  not a Work Number table; recorded and rejected. Pinnacle 12535 (a Scribd doc) is
  an unrelated company. Pacific Bells 118402 stays robot-gated and unverified.
- **Mop-up front: 7 new higher-ed/city codes, all self-read:** Grossmont-Cuyamaca
  CCD 18470, Passaic County Community Colleges 10513118 (8-digit), University of
  Richmond 14541, Missouri State 341964, Appalachian State 17706, PASSHE 15972
  (system-wide, via IUP member-institution page — distinct from Commonwealth of PA
  10574), Pace University 13914.
- **Per-entry rule held:** the one compiled code table found (Scribd) was rejected
  wholesale; nothing landed from any third-party aggregation.
- **Matcher spot-check 23/23** under the shipped normalize + tie rule, including
  both tie assertions (Dallas County -> Dallas County Texas 15311, Polk County ->
  Polk County Oregon 3026524), AMR negative, and the duplicate-code display check
  (Olive Garden selection still resolves to the Olive Garden row).

## Sourcing pass 6 (2026-10-22)

- **Front A (template-wide verifier-PDF sweep) — the named "last lane" is genuinely
  productive.** Query shapes: `"employer code" "the work number" filetype:pdf
  site:.edu`, city/county variants, and `"the employer code is" ... school district
  OR city OR county`. Every landed code was self-read verbatim in fetched text
  (curl + pdftotext), from employer-owned or official-domain PDFs. Landed 35 rows /
  36 records: Stoughton Health 10720867, Central Michigan 157374, SDSU 33022, UGA
  13265, Butler 4681132, Wayne State 12436, Colorado School of Mines 11341979,
  County of Riverside 12421, Harford HCPS 15815, HCPSS 14673, Shelby County Schools
  15934, SDCCD 17710, UMSAz 686635, Texas HHSC 13068, UMUC/UMGC 14819, Columbus
  State (GA) 18679, **Commerce Bank 10204** (first bank code beyond US Bank),
  **IRS 10114** and **NASA 11338** (federal agencies), UTHSC + UTC system-shared
  17617 (two official documents agree; separate brand rows), and the full
  14-entry official Colorado Community College System code list from the
  pikespeak.edu HR PDF (19177 system office + 13 colleges 19241–19253) — landed
  per entry, each name-paired code read in the fetched system document, no bulk
  import of anything third-party.
- **Correction of a pass-5 non-finding:** Spartanburg Regional 10275642 was found
  in the same 2024 benefits guide PDF pass 5 extracted but called a no-hit — the
  earlier pdftotext pass missed it; the full re-extraction shows "the Employer
  Code is 10275642." Landed with a CORRECTS note in the row.
- **Pass-5 non-finding partially overturned by the lane itself** (the store
  chains' benefit PDFs did turn up here): Commerce Bank 10204 landed from
  commercebank.com's own exit-info PDF. The remaining bank/insurer plan-PDF sweep
  found their surfaces mostly robot-gated or code-redacted (UAB) — unresolved.
- **Unresolved leads (never inferred, recorded here only):** Princeton 14343
  (hr.princeton.edu/document/6506 serves HTML; code seen in search snippet only),
  Wayne County MI 13675 (fetch returns HTML), Johns Hopkins Howard County General
  Hospital 12301 (hrpayroll.ssc.jhu.edu serves HTML), UTHealth Houston 13948
  (uth.edu PDF now HTML), UAB (redacted XXXXX), Pro Unlimited 11586 (off-domain
  TalentWise asset authoring — needs an authoritative host), UNC Health 15503
  (403). Kutztown confirmed to carry the already-landed PASSHE 15972 (no new row
  needed).
- **Front B (hygiene) — all sources.md-named source hosts re-fetched live:**
  archildrens.org, bahamabreeze.com/faqs, ecmc.org (302), farmerfocus.com,
  hr.miami.edu, mountcarmelhealth.com, one.walmart.com (301),
  teammates.atriumhealth.org, ventura.org (302) — all resolve.
  Front-B Page-drift findings recorded (recorded-path now 404): sf.gov
  `/income-verification` (re-homed at a new path — tracked with an updated
  pointer in the row notes territory), hr.vcu.edu and hr.gwu.edu recorded paths
  are 404, MMSD path unreachable/dns-undefined — codes remain banked under the
  never-silently-un-verify rule: attribution was verified at landing time;
  drift is annotated in row notes/sources catalog going forward.
- **Index: 15,724 -> 15,742 records; coded rows 94 -> 130 (129 TWN + 1 T&C).**
  build_index.py --check PASS. Matcher spot-check 24/24 under the shipped
  normalize + tie rule (8 standing cases incl. both Dallas/Polk tie assertions +
  AMR negative + no-match + duplicate-code Olive Garden display, plus 16 new-row
  checks incl. "Pikes Peak" shorthand alias and system-shared 17617 brand
  separation).
- Headed E2E: ALL AUTOMATED CHECKS PASSED (exit 0); storage loads 15,742 records;
  tie assertion (Polk County -> 3026524, live SW) intact; match toast +
  no-match injection defense intact; scan latency 6.70ms over 15,742 rows.
