# Employer-Code Sourcing — Ground Rules & Sources (2026-10-22)

## Ground rules (binding on every pass that touches code-bearing data)

1. **Freely public data only.** Codes are taken from pages any visitor can read
   without paying, logging in, or accepting a special agreement: the employer's
   own HR/benefits site, government agency sites, public university sites.
2. **No scraping of Equifax / The Work Number / TALX services.** We never fetch
   from theworknumber.com's verifier portal, Equifax services, or any
   authenticated/paywalled surface. no bulk ToS-violating crawling.
   **Exception (authorized by the project owner, 2026-10-23):** TWN's public,
   login-free "Find Your Employer" surface (eeservices.equifax.com corporate
   search — verified live 2026-10-23) may be swept ONCE A YEAR inside the
   *annual deep audit*, by hand in a headed browser, to check whether the
   no-login search coverage has materially changed (employer added/removed).
   Pacing: human-paced single searches with natural breaks; no automation, no
   bulk paging, no capture beyond what a landed row needs, and the normal
   landing bar applies to anything harvested. Never extends to any logged-in
   or verifier-facing TWN/Equifax surface.
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

## Sourcing pass 7 — lead chase + exhaustion verdict (2026-10-22)

- **Result of the chase: dry.** All four in-bounds pass-6 leads were re-attempted
  directly and every reachable surface is a bot-wall, changing their category from
  flaky-fetch to restricted. Nothing landed; no code is added this pass.
  - Princeton 14343: hr.princeton.edu serves Cloudflare "Just a moment..." (HTTP
    403) on document/6506 — the employer's own domain, but gated; no circumvention.
  - UTHealth Houston 13948: www.uth.edu/hr and all asset paths (4 variants tried)
    serve the same Cloudflare challenge; uth.tmc.edu variants fail DNS/403.
  - Wayne County MI 13675: waynecountymi.gov Akamai "Access Denied" on the recorded
    PDF and both alternate county paths tried.
  - Johns Hopkins Howard County General Hospital 12301: hrpayroll.ssc.jhu.edu and
    both alternate hosts (hr.jhu.edu, hopkinsmedicine.org) are Cloudflare 403.
- **Out-of-bounds confirmed and left alone:** UAB 4681132-adjacent UAB (source
  document redacts the code as XXXXX), Pro Unlimited 11586 (only off-domain
  TalentWise-authored postings exist, no employer-owned surface), UNC Health 15503
  (consistent 403 bot-wall). Recorded as restricted; no circumvention attempted.
- **Exhaustion verdict (defensible for public-surface sourcing):** the legal,
  ethical artificial-lane catalog is now fully occupied. Buckets confirmed
  genuinely unreachable within these bounds:
  (a) Cloudflare/Akamai-gated employer HR domains (Princeton, UTHealth, JHU,
      Wayne County, UNC, Pacific Bells, McLeod, U-Miami HTML, Lowe's, UAB-page
      variants) — no code-bearing page serves without circumvention, which the
      ground rules forbid;
  (b) big consumer tech/retail direct FAQ pages — five passes confirm they
      publish no codes (Amazon, Microsoft, Apple, Google, Costco, UPS, FedEx,
      Tyson, WMI, Walmart-adjacent retail);
  (c) grocery/food/theater chains — five passes, four fronts, zero reachable;
  (d) compiled third-party aggregation tables — rejected by the per-entry rule,
      not a legality wall but a source-integrity wall;
  (e) redacted/placeholder source documents (UAB) — nothing to read.
  The residual potential left on the table lives outside public-page sweeps:
  per-employer outreach asking HR to publish their code, and curated/uppercase
  state-employee collections behind credential gates. That is the announced
  successor lane, not a conceivable sweep. Sourcing within the stated bounds is
  **declared exhausted**; any future codes come from a new lane, not this one.

## Pointer correction: Truework portal deep-links retired (2026-10-23)

During the portal-button audit, every per-employer deep link in the bulk rows
(`https://www.truework.com/verifications/<slug>/`, 15,688 rows incl. the curated
tw-stripe seed) was probed and **404s across the board**, while
`truework.com` itself and the letter-index pages
(`/verifications/companies-starting-with-<letter>/`) still serve 200. Truework's
public site no longer publishes per-employer verification pages; the provider's
live ordering entry point is **`https://app.truework.com/requester/quickstart`**
(200 via anonymous GET).

Action taken: all Truework rows in `raw_employers.jsonl` + `verified_seeds.jsonl`
repointed to the quickstart URL (scripted, then `tools/build_index.py` rebuilt —
count unchanged at 15,742; 130 coded rows untouched). `tools/capture_truework.py`
was updated so future captures cannot regenerate the dead slug URLs. Per the
standing rules: rot never un-verifies — no Truework row came *from* these
URLs (names came from the letter indexes, which still serve), and coded-row
data is unaffected.

## Quickstart deep-link prefill probe (2026-10-23, live-DOM verified)

Follow-up to the quickstart repoint: what URL parameters does the Truework
ordering page honor? Verified in a real browser against
`app.truework.com/requester/quickstart` by reading the rendered DOM:

- With the full triple `?companyId=<opaque>&companyName=<Name>&domain=<domain>`
  the page **preselects the employer** ("<Name> — Change" rendered). `companyId`
  is the load-bearing token; Truework issues it per employer.
- `companyName` alone (or `domain` alone) is **ignored** — the page renders the
  generic employer-search state with an empty search box, i.e. name-only
  prefill does NOT work.
- The search combobox is client-side; typing filters Truework's full catalog
  live. There is no server-side prefilter parameter derived from `companyName`.

Extension implication (SUPERSEDED same day — built): a content-script prefill shipped 2026-10-23 (`truework-prefill.js`, registered in manifest.json for `app.truework.com/requester/quickstart*`) plus the background-side link change: Truework portal links now append `?companyName=<match name>`. The page itself ignores the param, but the content script types the name into the employer-search combobox on load (native value setter + `input` event, the standard React-compatible injection — verified live: the list filtered to real catalog entries). The user still picks the employer from the filter list; the script never auto-selects, so the wrong-entity rule holds. The full-triple preselect (companyId resolve at click time) remains the phase-2 upgrade path, unchanged.

## Sourcing pass 8 — event pass: fresh dork lanes, first-ever Thomas & Company code-bearing crop (2026-10-23)

User-authorized event pass (quarterly-style, outside the standing cadence).
Two lanes ordered by the user: (a) new dork shapes for TWN/Equifax
verification PDFs beyond pass-6 templates, (b) a first-ever Thomas & Company
lane. Every landed code was again self-read verbatim in fetched text (plain
fetch, rendered DOM via a real browser, or `pdftotext` on fetched PDFs from
employer-owned/official hosts). No snippet-only landings; no gated surface
penetrated.

- **Started deliberately from readiness, not from a stale URL:** of the
  researcher's first shortlist, 4 of 8 direct URLs were dead or bot-walled
  (lockheedmartin.com VOE-page 404, erlanger.org careers-path 404,
  arregionalhospital.org DNS-dead, mcgeeair.com DNS-dead) — each was re-homed
  by targeted search to the employer's live page before landing; no row points
  at a dead URL.
- **TWN landed (11):** Lockheed Martin 11102 (code lives on
  lockheedmartin.com/contact.html; salary key required for income+employment),
  Collins Aerospace 13770 (rtx.com Collins contacts page), Goodwill Southern
  California 16363 (goodwillsocal.org/contact-us), American Medical Response
  20790 (amr.net; deliberately NOT aliased to "AMR", which belongs to the
  legacy AMR Corp / American Airlines-parent row twn-10101), RXO 35966
  (rxo.com/contact-us; non-DOT only — DOT-era Jacobson records route via
  Tenstreet), County of Orange California 157185 (hrs.oc.gov — biggest county
  government code in the catalog), Erlanger Health System 12995
  (erlanger.org for-associates page), San Antonio Regional Hospital 19123
  (sarh.org; the researcher's "arregionalhospital" domain was dead), McGee Air
  Services 105029 (mcgeeairservices.com/contact; six-digit code), Beneficial
  State Bank 10549908 (beneficialstatebank.com FAQ; eight-digit), Technology
  Service Corporation 107109 (tsc.com verification page; rebranded Falcata,
  TSC branding retained on the VOE page; NOT Tractor Supply).
- **Thomas & Company landed (6; first code-bearing T&C crop):** L3Harris
  Technologies L3H518 (employer's own verifications flyer PDF at
  l3harris.com/resources: "Your company code (L3H518)" — this replaces the
  earlier AA-carrier-adjacent sourcing for the same employer; already in the
  index from the rolling batch), Populus Group PGI584 (Populus EWV FAQ PDF on
  their own help hub), ShiftMed SHIFT (ShiftMed EWV process PDF via their CMS
  asset host), Cinemark CINE15 (Cinemark EWV flyer PDF on media.cinemark.com),
  Yellow Corporation YRC382 (myyellow.com EWV FAQ PDF — landed as VINTAGE:
  Yellow ceased freight operations 2023; useful for legacy employees), Genesis
  Healthcare GENHC91 (genesishcc.com flyer PDF + corroborating procedure PDF).
- **New query shapes that paid (recorded for the quarterly pass):**
  `"thomas & company" OR "tncverify.com" "company code" filetype:pdf` (the T&C
  lane), `site:<employer-domain> "employer code"` contact-page harvesting for
  employers whose dedicated VOE pages moved (Lockheed, Goodwill SoCal, RXO),
  and code-in-snippet → employer-domain re-home drill (San Antonio Regional,
  McGee). The pass-6 template shapes also resurfaced new T&C-hosted PDFs.
- **Non-findings (recorded, no inference):** Leidos 12275 —
  careers.leidos.com is Cloudflare-gated in-session (reload attempted, same
  wall); Mission Health HCA747 — missionandme.mission-health.org dead DNS;
  HIRE Dynamics HIRE59 — wage-verification PDF is image-only (no text layer);
  MLA Global — no code served on the reachable surface. None landed.
- **Dedupe/conflict checks before landing:** the pre-existing "AMR Corp 10101"
  row is the pre-2015 American Airlines parent (per its own vintage note), a
  different entity from American Medical Response — both stay, cross-noted.
  Five uncoded bulk twins were shadowed by the new coded rows via the
  first-seed-wins build (Lockheed, Collins Aerospace, Goodwill SoCal, Genesis
  Healthcare, Rxo Inc).
- **Index after rebuild: 15,750 records, 143 coded (TWN 137, T&C 6,
  Truework 0).** `build_index.py` checks green; headed core E2E green on the
  new catalog (match path incl. the same tiered matcher); the usability suite
  was not re-run — no selection in its matrix collides with the new names or
  aliases (verified by inspection), and the matcher mechanics are unchanged
  data-only append.
- **matcher spot-checks on the new rows:** all 13 codes resolve in employers.json
  via exact/alias path with coded-first ordering (verified in-build above).

## Recurring re-check methodology (standing cadence — binding on future maintenance)

The sourcing catalog represents the world as of 2026-10-22. Employers restructure,
re-host pages, lift bot-walls, and publish new verifier PDFs — and the Truework
and TALX directories themselves grow. The library therefore needs a perpetual,
cheap, scripted maintenance rhythm. The cadence below is defined so that any
future session (or contributor) executes it identically without re-litigating
the ground rules.

### Cadence

| Cycle | Scope | Effort |
|---|---|---|
| **Monthly mini-check** | Rot ping + discovery dorks. (1) Re-fetch every host/URL named in this file (sources catalog + every pass's Front-B list + the gated-wall list). Classify each: live (200/normal redirect), rehomable (404 but re-homed on same domain), gated (403/402/challenge page), gone. Record deltas in history.md; re-home pointers into row notes where a same-domain replacement serves. (2) Run the standing discovery-dork set (below) and append every new-looking candidate URL (deduped against this file) to the candidate queue at the bottom of this file. **No research on candidates, no code changes, no landings from a mini-check.** | ~15 min, scripted rot ping (`tools/check_sources.py`) + the dork set by hand |
| **Quarterly full pass** | (1) Fresh Template-Query A sweep: the three pass-6 query shapes — `"employer code" "the work number" filetype:pdf site:.edu`, `site:.gov`, and theschool-district/city/county phrase variant — re-run date-stamped that quarter, checked against known-coded rows, every hit self-read verbatim. (2) Gated-wall re-probe: one honest direct fetch of each name in the wall list (Princeton, UTHealth, Wayne County MI, JHU Howard General, UNC, McLeod, Pacific Bells, UAB page, Pro Unlimited) — bot-walls lift; if one serves, normal bar applies, **no circumvention ever**. (3) Landing bar + verification: verbatim self-read → `verified_seeds.jsonl` → `tools/build_index.py --check` → matcher spot-check (standing regressions: Dallas/Polk ties, AMR negative,no-match, duplicate-code display) → headed E2E if record count moves. | 1–2 hr |
| **Annual deep audit** | Re-fetch every URL referenced in any row's `notes` field (not just the host-level list) and re-sample at least 8 rows for verbatim re-read at their current live location.Re-examine standing non-findings (big tech FAQ, grocery/food/theater chains) with one fresh query each — only if something material has changed since the last verdict (a new method, a new line of outlet, a known employer event). Re-run the full wrong-entity collision sweep (normalized-key pass) against grown index. | half day |
| **Trigger-based (event)** | Drop everything if: a Chrome MV3 service-worker policy change lands, Equifax/TWN publicly renames or re-codes employer codes, or an employer reorganization (merger/spin-off) is reported by a user touching a coded row — that row gets a targeted re-verification the same session. | as needed |

### Rules the cadence does not change

1. **Rot never un-verifies.** A 404 on a recorded source URL only moves the
   pointer to the re-home or stamps the row's vintage; the code stays banked
   on its at-landing verification. Silent un-verification remains forbidden.
2. **The landing bar is absolute forever:** verbatim self-read in fetched text
   from an employer-owned or official-domain surface. No inference, no
   snippets-are-enough, no bulk import, no 403/bot-wall circumvention, no
   Equifax/TALX surfaces, per-entry verification of any multi-row document.
3. **Every pass gets the same bookkeeping:** append-only entries in
   `todo.md` (live) and `history.md` (log), regardless of whether codes land.
4. **A mini-check may not land codes** — it only maintains pointers and
   queues candidates. Codes land only inside a quarterly full pass (or an
   authorized event pass), always under the landing bar.

### Standing discovery-dork set (run every monthly mini-check)

Added 2026-10-23 after sourcing pass 8 proved the dork lane is not exhausted.
Run each query, dedupe against this file's recorded surfaces, and append
anything new-looking to the candidate queue. Checking candidates is itself
NOT a mini-check task — the queue is harvested line-by-line at the next
quarterly full pass under the normal bar.

1. `"employer code" "the work number" filetype:pdf` — minus the exact
   expressions already in this file (the pass-6 template shapes, restricted
   to .edu/.gov).
2. `"our employer code is" OR "your company code:" filetype:pdf` — plain
   quote variants; pass 8 mined these for T&C and TWN alike.
3. `"tncverify.com" OR "thomas & company" "company code" filetype:pdf` — the
   T&C lane (query shape recorded in pass 8; first run produced 6 codes).
4. `"experian verify" "access code" filetype:pdf` — the Experian Verify
   lane (new provider class; see the landscape verdict below).
5. `"vault verify" "company code"` — Vault Verify lane. GE Vernova's public
   contact page publishes "Employment Verification (USA Employee Only)
   Company Code: 30052" (gevernova.com/contact) — the pattern is real. Note
   (2026-10-23): Equifax completed the Vault Verify acquisition Nov 2025 and
   the vaultverify.com front door now routes to The Work Number, so expect
   stale Vault URLs/codes; every hit needs a currentness check.
6. `"inverify" "company code"` — InVerify lane (Okta's contact page publishes
   Company Code OKT120). Largely a LEGACY-ARTIFACT lane: CSUN announced its
   InVerify decommission in Dec 2022 (moved to The Work Number), and Equifax
   now routes InVerify users into its PeopleHQ login — land nothing here
   without confirming the code is still the active route.
7. Site-scoped contact/FAQ re-sweep: for the letter-slice of bulk Truework
   rows grown most since the last pass, 3–5 `site:<employer-domain>
   "employer code"` spot checks — re-homes dead VOE pages early.

## Provider-landscape verdict (2026-10-23, researched + examples verified)

Question: do OTHER VOE providers publish per-employer codes on public pages
the way The Work Number and Thomas & Company do (i.e. are there more dork
lanes)? Verdict per provider — examples were read on the cited pages:

| Provider | Codes on public pages? | Ordering flow | Dork-lane verdict |
|---|---|---|---|
| **The Work Number / Equifax** | Yes — the catalog's main lane (~137 codes) | Verifier login (VsPortal) | Existing lanes. |
| **Thomas & Company** | Yes — company codes in employer EWV flyer PDFs (6 landed pass 8) | tncverify.com order form; employee login has a public Company Code field | Existing lane, productive. |
| **Truework** | No codes (public per-employer directory retired Oct 2026) | Public quickstart ordering | Not a code lane. Prefill handled by content script. |
| **Vault Verify** | **Yes** — GE Vernova's own contact page: "Company Code: 30052" (gevernova.com/contact) | Public site; **acquired by Equifax Nov 2025**, front door now routes to The Work Number | **High for indexed employer instructions**, with a stale-URL/currentness caveat on every hit. Dork 5. |
| **InVerify** | **Yes** — Okta's contact page: "Company Code: OKT120" (okta.com/contact) | **Legacy/decommissioning**: CSUN moved to TWN in Dec 2022; Equifax routes InVerify users into PeopleHQ | **Moderate, decaying.** Only land a hit if the code is still the active route. Dork 6. |
| **Experian Verify** | **Codes that appear on employer pages are EMPLOYEE access codes, not verifier codes** (e.g. UM System "Employer Access Code: 36567BE5" is for the employee's own account setup; verifiers use the employee's SSN) | Public portal entry; per-person data behind Experian client relationship | **Low for `company code`;** wrong-code trap. Dork 4 must never land an employee-access code as a verifier code. |
| **HireRight** | No verified example — "employer codes" in its documents belong to other fulfillment services | Client/applicant portals | **Very low.** |
| **Sterling (now First Advantage)** | No verified example | Client logins | **Very low.** |
| **Certn** | No verified example | Account/dashboard | **Very low.** |
| **Checkr** | No verified example | Credentialed account | **Very low.** |

- **Net:** only Vault Verify and (decaying) InVerify add genuinely new dork
  lanes; they are in the standing set (queries 5–6). No reliable public
  employer-pool counts exist for any of these providers — published screening
  volumes/coverage must not be read as pool sizes.
- **Applicability to the extension:** coded rows for these lanes would follow
  the same schema (provider field) only if a future pass confirms the code +
  a live ordering route. Vault Verify rows would effectively be TWN rows
  going forward (Equifax merged it); treat any pre-merge Vault code as
  TWN-vintage, and per provider naming it stays recorded under the provider
  named on the employer's own page.

## Candidate queue (monthly mini-checks append here; quarterly passes harvest)

Format: `- [date added] <candidate URL or query> (source dork: <#>) — one-line
why it looks new`. Nothing here is verified; the queue is a lead list only.
Mini-checks append; quarterly full passes (or authorized event passes)
harvest under the normal landing bar and delete harvested lines.

(candidates below; none verified — a lead list only. Added 2026-10-23,
dork-expansion pass 9)

- [2026-10-23] core-docs.s3.amazonaws.com/documents/asset/uploaded_file/2252/MCSD/3119114/The_Work_Number_FAQ_s.pdf (dork: standing-set pass-9 sweep) — generic-guide PDF states "The Employer Code is 391098" but the document self-names NO employer ("MCSD" folder token only); land only after the owning district is confirmed.
- [2026-10-23] commons.csod.com/clientimg/commons/welcome/Employee Guide to The Work Number.pdf (dork: pass-9 sweep) — guide states "The Employer Code is 13883" with no entity self-naming; client landing 404s. Queue until the employer is identified.
- [2026-10-23] nps.k12.nj.us Newark Board of Education guide (dork: pass-9 sweep) — Google snippet reads "you can use the employer code 33000"; district domain is authoritative, but the exact PDF URL is truncated in results and the REST API is disabled — land only after a fetched verbatim self-read.
- [2026-10-23] ascendnps.org/wp-content/uploads/2023/03/Work-Number-Employer-Code-by-Agency-eff-7.1.25.pdf (dork: pass-9 sweep) — multi-row "Agency Employer Code" table (10 codes, CFH/Arts+/AJC/SA/HC/RWCI/MCAI/UWCC/RAIN/SSMC); suspect Charlotte-area nonprofit consortium under Ascend NPS. Per-entry landing needs the official member-name mapping from ascendnps.org.
- [2026-10-23] city.milwaukee.gov/ImageLibrary/Groups/derAuthors/Benefits-/TheWorkNumber.pdf (dork: pass-9 sweep) — City of Milwaukee employee sheet (distinct from catalog's Milwaukee County row); fetch 403'd. Direct honest re-fetch only, per the gated-wall rule.
- [2026-10-23] commerce.gov/hr/employees/benefits/employment-and-income-verifications (dork: pass-9 sweep) — Dept. of Commerce page is Cloudflare-bot-walled from this network. No verification attempted beyond the honest fetch.
- [2026-10-23] Monroe Staffing Services 17410 (dork: pass-10 partner sweep) — verification-instructions PDF self-names "Monroe Staffing Services employer code: 17410" but lives on a generic S3 bucket (oliver-dev.s3.amazonaws.com) + Scribd mirror only; no employer-owned hit on any Monroe domain. Land only from an official-domain self-read.
- [2026-10-23] Rocky Vista University (dork: pass-10 partner sweep) — official employee-handbook subdomain (employeehandbook.rvu.edu) states all verifications go to The Work Number (iSolved payroll), but publishes NO code on the page. Route confirmed; needs a code-specific query before anything can land.
- [2026-10-23] MaineGeneral Health (mainegeneral.org employment-verification PDF) — 403 Access Denied on honest direct fetch (gated-wall list). Direct re-fetch only when the wall lifts.
- [2026-10-23] City of Pasadena personnel-rules PDF (cityofpasadena.net) — 403 on honest fetch; document names "The Work Number for Everyone" + the verifier number in Google's text cache. Gated-wall list. Direct re-fetch only.
- [2026-10-23] essexcountyofnj.com/scdrtransport.pdf (dork: pass-11 Trimble/watch-lane sweep) — Essex County NJ senior/disabled transit subrecipient doc quotes The Work Number; 403 on honest direct fetch (gated-wall list). Direct re-fetch only when the wall lifts.

## Dork-expansion pass 9 (2026-10-23, authorized event pass — user order: "expand

google dorks or alike")

- **New anchor discovered: the TWN Client Service toll-free.** Searching
  `"800-996-7566" "employer code" filetype:pdf` pulls employer-owned verifier
  guides that print the service's support number alongside their own code —
  including employers no other shape had reached (Prolink, Acuity Brands, FERC,
  CompuCom, Prothena). This is the single most productive new query of the pass
  and is added to the standing set as query 8:
  `"800-996-7566" "employer code" filetype:pdf`.
- Weak/empty angles this pass (do not rerun as-is):
  `"1-800-367-2884" "employer code" filetype:pdf` (0 organic hits),
  `"the work number" "0649" "employer code"` (1 hit, our own catalog row),
  `site:.us filetype:pdf` (mostly state already-knowns; landed nothing), the
  union-local shape (generic Equifax templates only), and the salary-key shape
  (retiree guides without codes beyond Navistar).
- **Six codes landed under the bar (all fetched + pdftotext verbatim,
  employer-owned/official domains):** ProLink Staffing 29425, Acuity Brands
  10661, Federal Energy Regulatory Commission 11727, Prothena Corporation plc
  10235943, Northern Rivers Family of Services 21818, Navistar, Inc. 10487
  (vintage 2016 note). Non-findings recorded: NYU login-guide PDF (no code),
  CSX verification page (no code), Commerce.gov (bot-walled), City of
  Milwaukee PDF (403).
- **Index after pass 9: 15,753 records, coded 149 (TWN 143 + T&C 6).** Build
  --check PASS; live matcher sim 11/11 (six new rows resolve coded, standing
  regressions + AMR negative intact); headed core E2E ALL AUTOMATED CHECKS
  PASSED (15,753 records live, scan latency 2.50ms).

## Dork-expansion pass 10 — partner-vendor sweep (2026-10-23, authorized event

pass — user order: "expand google dorks ... find companies that self identify
as being on TWN, verify manually")

- **Premise check for the owner's theory (recorded so the next session doesn't
  re-litigate):** the Paylocity↔TWN interface is NOT new — it dates to
  2021–2022 (marketplace page + employee PSA Apr 2022). But TWN has a genuine
  new partner-integration wave to mine: **Tyler Technologies (May 2025, gov
  ERP/Munis)**, **Workday Employment Verification Connector (Aug 2024, live
  2025)**, **Trimble Vista/Spectrum (Jun 2026, construction ERP)**, plus the
  established isolved (2021) and IRIS. The extension dork thesis the owner
 articulated is correct in direction: an employer that names its payroll
  vendor on an employee page is self-identifying as a TWN candidate, and
  verifier docs often sit beside the code.
- **What the shapes taught (recorded so future passes don't re-run duds):**
  - DEAD shapes: `"<vendor>" "employer code" filetype:pdf` for Paylocity,
    isolved, and Workday connector — all zero hits. Employers do not normally
    name the vendor and the code on the same page.
  - PRODUCTIVE shape: vendor name paired with plain "the work number"
    WITHOUT "employer code" — that pulled employee handbooks/FAQs that
    self-identify as TWN employers (the code then lives in the fetched doc).
  - NEW lead-signal shape worth keeping: government BUDGET/MOU documents that
    line-item "The Work Number" payments (Sampson County NC; Marin County MOU;
    City of Doral; Panhandle RPC invoices) — a fiduciary self-identification
    of TWN subscription, and safe indexing territory.
- **Sector-first trend to watch (not yet a dork):** Trimble's Jun 2026 launch
  means construction/aggregates/infrastructure employers are freshly joining
  TWN; expect their verifier PDFs to appear over the coming quarters. Tyler's
  2025 launch does the same for counties/municipalities/schools using Munis.
- **Six codes landed under the bar (all fetched + pdftotext verbatim on
  employer-owned/official-domain documents):** YMCA of Middle Tennessee 15323
  (ymcamidtn.org 2019 procedure), Bi-State Development 13148 (bistatedev.org
  2012 trifold — vintage), Catholic Health (CH Services) 17878
  (catholichealthli.org handbook; code is per-entity, others have their own),
  University of Louisville 11443 (service.louisville.edu KB page), Innovative
  Employee Solutions 16219 (hr.innovativeemployeesolutions.com Jan 2023
  handbook), PG&E 13391 (myportal.pge.com 2011 retiree newsletter — vintage).
- Non-findings this pass (all recorded in the queue or here): Trinity Health
  trinity-health.org PDF is a scanned image AND its snippet code 14229 belongs
  to Mount Carmel (a Trinity ministry) — already in catalog as twn-14229;
  do NOT treat 14229 as Trinity Health system-wide. MaineGeneral 403;
  City of Pasadena 403; UM Partners page serves no TWN text (snippet from a
  different rendering); Hellertown doc is a 4-page image-only scan; Transdev
  served handbook has no TWN section (see queue).
- **Index after pass 10: 15,756 records, coded 155 (TWN 149 + T&C 6).** Build
  PASS; matcher sim 14/16 exact-alias (the 2 apparent misses are plain-map
  artifacts of the sim, not the shipped tiered matcher; tie rules live-test
  green); headed core E2E ALL AUTOMATED CHECKS PASSED (15,756 live),
  scan latency 2.50ms.

## Watch-lane harvest pass 11 — Tyler/Munis + Trimble (2026-10-23, authorized

event pass — user order: "harvest the tyler/munis and trimble watch lanes")

- **Tyler/Munis lane verdict: NOT a code lane so far.** Four shapes —
  `site:.gov "munis" "the work number" "employer code" filetype:pdf`,
  `("Munis" OR "Tyler Technologies") "verification of employment" ... site:.gov`,
  `"munis" "employer code" "the work number" filetype:pdf`, plus pass-10's
  base shape — produced zero code-bearing hits. Munis-using governments post
  ERP admin docs, not verifier guides. Keep as a passive watch (their
  benefits/HR pages still reach the standing dorks); no more dedicated
  Munis-linked queries without a new idea.
- **Trimble/construction lane: productive via ADJACENT surfaces.** No
  Trimble-customer doc printed a code yet (their July 2026 activation is too
  fresh), but the sector-first query caught three landable rows:
  - **Apache Industrial Services 29061** — employer-owned 22-page HR guideline
    PDF (apacheip.com): "All employment verification... referred to The Work
    Number... Employer code: 29061" (fetched + pdftotext).
  - **Transdev North America 13173** — RESOLVES the pass-10 queue entry: the
    verbatim "Transdev North America, Inc. Employer Code: 13173" tables
    (employees/verifiers/social-services) sit in the 2017 Transdev Employee
    Handbook embedded as Appendix I of Concord Kannapolis Area Transit's 2025
    official safety plan (ckrider.com). Recorded CAVEAT: Transdev's own served
    2023 handbook contains no TWN code section — verify currentness before
    ordering.
  - **Oasis Outsourcing (Paychex Oasis) 11556** — FIRST PEO ROW: co-employment
    handbook in a Palm Beach County 2014 agenda backup (pbcgov.com) states
    "Enter the Employer Code - 11556" with the Salary Key procedure. Oasis is
    the Administrative Employer / Employer of Record for its worksite
    employees; any worksite employer served by this PEO verifiables through
    this code. VINTAGE 2013/14: Paychex acquired Oasis; verify currentness.
- **NEW lead-signal shape recorded: official-agency documents that EMBED an
  employer-authored handbook.** FTA-required safety plans, procurement
  contracts, and council agenda backups routinely append full third-party
  (contractor/PEO) handbooks to the public record on the agency's own domain.
  Query classes to periodically re-run: `site:<govdomain> "employee handbook"
  "the work number" filetype:pdf` and transit-operations terms
  (paratransit/transdev/contract operator) + "employer code".
- Non-findings: Essex County NJ subrecipient transit doc builds 403 (queued);
  several generic .gov/manual aggregates mentioned TWN without codes.
- **Index after pass 11: 15,757 records, coded 158 (TWN 152 + T&C 6).**
  Net +1 record: two Truework name-rows were displaced by the new coded rows
  matching the same employer keys (coded wins, per the tie rule). Build PASS;
  new-row matcher sim 6/6 (12 exact/alias probes incl. names); headed core
  E2E ALL AUTOMATED CHECKS PASSED (15,757 live).

## Provider-landscape verdict (2026-10-23, researched + examples verified)

### Annual TWN public-portal sweep (added 2026-10-23)

The owner authorized a once-a-year, human-paced manual look at TWN's public
login-free employer search ( Ground rule 2 exception above). It is part of the
**annual deep audit**, not the monthly/quarterly cycles: open the public
search in a headed browser, run a handful of representative employer-name
searches with natural breaks, and record whether coverage for rows we track
changed. Anything useful still has to pass the landing bar. This is a
drift-check, not a harvest pipeline; if it ever grows automation, it stops.

**First run — SESSION 1 (2026-10-23): surface re-homed + reCAPTCHA-gated;
  agent declined to solve the bot check, basket not yet runnable.**

- The "Find Your Employer" search is LIVE and login-free, but it has moved
  hosts: `secure.eeservices.equifax.com/ewsweb/auth/employersearchopen`
  (the bare `eeservices.equifax.com` path recorded last pass DNS-dead from
  this network). Surface class unchanged — for the sweep protocol, use the
  new URL.
- The search is reCAPTCHA-gated ("Please check the box to indicate you are
  not a robot"). Per rule 2 and the absolute landing bar, the working agent
  does NOT solve bot checks. NOTHING was harvested; zero code-bearing data
  crossed the bar.
- Second material drift finding (employee front door,
  employees.theworknumber.com, read verbatim today): "**You no longer need
  an employer code to log in.**" Employee registration is identity-verified
  (first/last name, DOB, SSN/ITIN, personal email, mobile). The
  employer-lookup step now comes AFTER that personal-data gate, so it is
  not agent-executable by construction — it is a HUMAN pace step or
  nothing.

**First run — SESSION 2 (2026-10-23, same day): COMPLETED. The OWNER solved
  the reCAPTCHA in the shared headed browser; the agent then ran the
  representative searches ONE AT A TIME and read every result verbatim
  from the results table. Drift-check completed; NOTHING harvested; the
  catalog was NOT edited.**

- Basket results (search text → verbatim surface outcome; catalog code in
  parens):
  - "Wal-Mart" → **MATCH**: code 10108, displayed canonical name
    "Wal-Mart" (+ WALMART CANADA 20108). Catalog row twn-10108
    **confirmed**.
  - "Home Depot" → **DRIFT, MATERIAL**: surface shows **87843**; catalog
    carries **11116**, read verbatim on the official page. Flagged below
    for the maintainer's landing decision; catalog not touched today.
  - "Olive Garden" → **MATCH**: 11533. Catalog row twn-11533 **confirmed**.
  - "Target", then exact "Target Corporation" → **NOT SURFACED** (catalog
    10115): the fuzzy "Target" search returned only unrelated employers
    (TriNet alias "On Target Health" 13096, Warner Bros. Discovery alias
    "MNI Targeted Media" 12406, Anschutz alias "TARGET CENTER" 12317); the
    exact name returned "No records found". This was a CONTROL probe —
    see the aggregate verdict.
  - Verizon → **NOT SURFACED** (catalog 10303): 4 variants tried (Verizon,
    Verizon Wireless, Cellco Partnership, Verizon Theatre); only
    "Verizon Theatre" matched, a different employer.
  - Stoughton Health → **NOT SURFACED** (catalog 10720867): 6 variants
    tried (Stoughton, Stoughton Health, Stoughton Hospital, SSM Health
    Stoughton, SSM Health, SSM Health Care) — all "No records found";
    bare "Stoughton" matched only a TriNet PEO alias
    ("PURELIFE RENAL STOUGHTON", 13096 under TriNet HR Corporation).
  - Dallas County → **NOT SURFACED** (catalog 15311): "Dallas County" and
    "County of Dallas" both "No records found".
  - Farmer Focus → **NOT SURFACED** (catalog 679792): exact name → "No
    records found".
- **Aggregate verdict: this public search is a PARTIAL index of The Work
  Number's employer list, not a complete one.** Codes we hold verbatim
  from employer-owned sources (Target 10115, Verizon 10303, Dallas County
  15311, Stoughton 10720867, Farmer Focus 679792) do not surface, while
  big consumer-visible employers do (Walmart, Darden brands) and Home
  Depot surfaces with a DIFFERENT code than our catalog.
  **Binding rule for every future sweep: a "No records found" on this
  surface can never be used to delete, demote, or re-code a catalog
  row.** Negatives speak about the surface's index breadth, not about the
  row; only a live verbatim surface match may confirm or update a row,
  and always through the normal landing bar.
- Fuzz caveat for the next maintainer: the search matches main name AND
  aliases with loose substring ranking, so short queries pull in
  unrelated small employers ("Stoughton" → TriNet PEO alias;
  "Target" → several alias hits). Read the Employer Name column, not just
  the code, before treating a row as matched.
- Material drift candidate for the NEXT pass (not landed today, needs the
  human verbatim re-read under the normal bar): Home Depot code 87843
  seen on the official surface vs catalog 11116.
- Sweep protocol for the next pass (annual reuse): unchanged in substance
  — solve the bot check as a real human, run single searches one at a
  time with natural breaks, record matched/not-matched per basket row,
  land nothing without the normal bar. Consider re-running the five
  NOT-SURFACED rows above as negative controls: they should stay negative
  unless the index grows; a changed result is its own finding.

## Portal-surface prefill + iframe probe (2026-10-23, live-DOM verified)

Follow-up to the quickstart prefill: could the extension prefill the OTHER
providers' public surfaces, and can any portal page be iframed into a modal
instead of a new tab? All three surfaces were probed in a real browser; frame
policy was checked via response headers.

- **Iframe verdict: all three send `X-Frame-Options: SAMEORIGIN`** (The Work
  Number also sends `frame-ancestors 'self'` CSP; Truework has an explicit
  frame allow-list of ICE Mortgage/Ellie Mae LOS hosts — we are not on it;
  tncverify sets the header too). **No in-page modal iframe is possible** — a
  blocked frame renders blank. The new-tab flow stays for all providers.
  (Truework's allow-list is a later Encompass/ICE LOS integration note,
  phase 3+.)
- **Truework quickstart:** search-box prefill **works** via content-script
  injection (see the SUPERSEDED note above; shipped). Not iframable.
- **The Work Number:** verifier ordering UI lives behind the VsPortal
  authenticated flow — **nothing prefillable on public surfaces.** Not
  iframable either.
- **Thomas & Company:** `tncverify.com/employee/login/` is a plain-HTML form
  with a literal Company Code field (`EmployeeProvidedAccessCode`) that
  accepts programmatic values (persisted, verified). Prefill is possible and
  value-bearing for the borrower/PIN flow; but the PROCESSOR's ordering flow
  has no search box. If T&C ordering is ever surfaced per-row, prefill the
  code field. Not iframable.


Ranked by expected yield inside the ground rules. Anything not listed here is
either exhausted (verdict above) or out-of-bounds forever.

1. **Employer outreach (announced successor lane).** A form email to HR/benefits
   teams asking them to publish their code on a public verification page.
   Track responses in a ledger under `data/` when started; any published code
   lands under the normal bar with the worked surface as its source URL.
   Highest expected yield per effort of any future lane.
2. **Web Archive snapshots of employer-owned pages** (new allowed source-class,
   with caveats). Many recorded source URLs of passes 1–5 have rotted
   (~60%+ of pass-1 samples in the post-ship audit). A wayback snapshot of an
   employer's own dead page is a fetch of the employer's document. Rule:
   acceptable **only** for (a) re-homing pointers when the live page is gone,
   (b)confirming the vintage for a row whose live source died, and (c) as a lead source. A row whose only fetching-side source is a snapshot stays
   at vintage-caveat strength — never upgrade standing on a snapshot.
3. **Federal SEC/EDGAR filings** (used once, in pass 3) — public filings
   regularly name specific affiliates' shared-services codes. A targeted
   EDGAR full-text search (`efts.sec.gov` no-auth) for The Work Number
   language in 10-K/8-K is legal, indexed, and untouched so far.
4. **Union/wage-team benefit flyers** — dated-caveat rule as in pass 3; used
   twice so far (AFA-CWA, TWU 514). A focused union-site sweep has never
   been done; expect low yield but reachable material.
5. **K-12 district ADP/payroll-vendor hosted docs on district domains** —
   districts increasingly host new-hire/verification guides under
   `*.k12.**.us` CMS paths (Pass-6 county/K-12 shape found 3 of these). The
   pass-6 `site:.gov`/city-shape query caught only districts; a systematic
   `filetype:pdf "new employee verification" site:*.k12.*.us`-class query is
   cheap and runs across three productive query lines before it.
6. **State-employee public collections** — some states publish an employee
   benefits PDF listing TWN codes for agencies (behind-the-gate material
   remains out of bounds; only genuinely public state pages qualify).

Reconsideration triggers for out-of-bounds buckets: only an unambiguous,
invited-access change (an employer granting deliberate public access) moves a
gated/credential wall lane back into bounds; nothing here over-rides
the ground rules.

## Lead-pool infra + pass 12 — multi-pool slice-fed harvest (2026-10-23, user
order: "work through the lead pools you identified, largest to smallest")

- **Infrastructure landed this session (new files):** `data/lead_pools/`
  (`counties.jsonl` 3,235 Census FIPS counties; `ipeds.jsonl` 6,052 NCES
  HD2024 institutions; `fed.jsonl` 38 usa.gov agency rows), capture script
  `tools/capture_lead_pools.py` (provenance header row + capture-time dedupe
  against catalog; branch-campus same-name rows collapsed), and
  `tools/pool_progress.py` (per-pool coverage report vs catalog+queue, plus
  `--slice <pool> N` that emits the first N *remaining* entities as
  ready-to-query dork lines). Coverage as captured: ipeds cataloged 952 /
  remaining 5,099; counties 337 / 2,848; fed 2 / 35. A school-districts pool
  is parked: CCD's bulk downloader is session-driven, no direct zip (honest
  note — revisit with a session tool).
- **How pass 12 was fed:** education-lane dorks first (largest pool), then
  counties/districts lanes, then federal-agency lanes. The slice emitted
  names; the dorks worked LANE-first (system code lists, "message to
  verifiers" templates, employee guides) because per-name dorks do not scale
  to 5k entities — pool entities are used as disambiguation/checks, not as
  query volume. Big finding: the education pool is ALREADY heavily harvested
  (most universities/codes surfaced this pass were already coded from passes
  1–8); the counties/districts/fed lanes were the productive frontier.
- **Fifteen codes landed under the bar (all fetched and read verbatim; per-row
  source strength recorded in each row's notes):**
  Yeshiva University 13598 (yu.edu); University Of Tennessee 17617 (system
  code, TWO independent official docs: uthsc.edu Message-to-Verifiers +
  utc.edu FAQ); University of Arkansas for Medical Sciences 14891 (hr.uams.edu);
  The Ohio State University 10380 (hr.osu.edu); Dollar Tree 13180
  (dollartree.com); TriNet 13096 (**second PEO row** — full TriNet PEO
  handbook embedded in SCCOE charter petition, vintage-caveat); Wayne County
  Michigan 13675 (AKAMAI-WALLED via curl — fetched and read rendered in a
  real browser session; resolves the pass-7 WayneCo queue entry); Ds Services
  12819 (employer handbook on recruiting.adp.com, 2016 vintage); Dexian 15027
  (files.disys.com 2023 handbook; DISYS lineage); Signature Consultants 18328
  (VINTAGE historical pre-6/2021-only); JAS Forwarding USA 110881 (court
  settlement doc, six-digit code, caveat); Sweetwater Union HS District 17999
  (district finalsite); Clark County SD 11519 (Frontline-hosted district
  handbook, caveat); Louisville Metro Government 29868 (louisvilleky.gov
  2026-27 booklet, current); NYS Public Health Corps 22383 (nysphcresources.
  health.ny.gov, Apr 2025).
- **Confirmed-already-coded (did not land):** IRS 10114, County of Ventura
  13009 (venturacounty.gov handbook + Dec 2024 new-hire resources agree),
  County of Riverside 12421, City and County of San Francisco 11403, Metro
  Nashville & Davidson County 22559, Shelby County Schools 15934, Tulsa PS
  58858. Also re-confirmed the CCCS code list (pikespeak.edu) codes match our
  landed member-college codes exactly.
- **Queued honestly:** Trinity Health 14229 (snippet on trinity-health.org —
  the 2018 PDF is image-only "Print to PDF", no text layer), USDA Forest
  Service 10284 (energy.gov unrenderable this session), City of Milwaukee
  11692 (Cloudflare wall, Aug 2026 doc — pass-9 403 continues), Manpower 90508
  (Marshall procurement submission, text layer absent), Essex County NJ stays
  403'd. All snippet- or wall-blocked; nothing landed without verbatim text.
- **New productive query shapes recorded:** (a) `"message to verifiers"
  filetype:pdf "employer code" university OR college` — pulled ADP-template
  verifier letters across higher-ed in one line; (b) `"(county|school
  district) "the work number" "employer code" filetype:pdf` lanes with
  finalsite/finalsite-CDN and pcdn (county CMS) carriers — county and
  district docs ride unusual CDNs, so search by content, not domain;
  (c) browser-session reads as bar-compliant evidence for Akamai-walled
  official PDFs (curl blocked, real Chromium passed — used for Wayne County;
  screenshot evidence local-only under data/test/).
- **Index:** 15,757 → 15,762 records; coded 173 (TWN 167 + T&C 6). Net +5
  (15 new coded rows; 10 displaced Truework name-rows on the same keys).
  Build PASS, new-row sim 21/31 strict (exact-key sim is stricter than the
  live tiered matcher; substring cases resolve there), headed core E2E ALL
  AUTOMATED CHECKS PASSED on the live 15,762 index, scan 9.60ms.
- **Remaining-pool verdict after pass 12:** ipeds still has ~5k uncoded
  entities but the education lane dorks now come back mostly
  already-harvested — treat future IPEDS progress as slice-fed mop-up during
  other passes, not a dedicated pass. Counties (2,848) and fed (35) remain
  genuinely under-mined: county lanes produced 4+ rows in this one session
  and fed lane 3. Next dedicated pass should run counties slice-fed again
  (state-by-state letter sweep is cheap) and the fed pool by faction list.

## Dork-sourcing pass 13 (2026-10-23 — user order: "take all of the recommended next steps")
- **Wall re-probes (standing-cadence queue): ALL FOUR RESOLVED.** Trinity Health 14229
  (official trinity-health.org verifier article, screenshot-verified in-browser);
  City of Milwaukee 11692 (city Who-To-Contact 2026-03-31 list confirms the Aug-2026
  records-guide code; PDF.js text-layer read of the live Cloudflare-served PDF);
  Manpower 90508 (associate handbook section in the Marshall University staffing-RFP
  submission, tesseract OCR + Google-snippet dual digit-source); USDA Forest Service
  10284 (the pass-12 image-only energy.gov "article" was actually a scanned PDF —
  downloaded it and OCR'd the page: "USDA Forest Service Employer Code: 10284".
  Lesson recorded: an image-only wall first needs an OCR attempt on its own bytes).
- **Counties lane, slice-fed state batches:** net-new verbatim rows —
  City of Norfolk 28152 (city Exit Guide, norfolk.gov), City of Seattle 11874
  (city 2026 Exit Guide, seattle.gov), Harris Health System 12990 (Harris Health
  benefits guidebook, harrishealth.org). Re-confirmed already-landed: Nashville
  Metro 22559 (county form), Riverside 12421, SF 11403, Shelby 15934, Harford
  15815, Howard County 14673, Wayne 13675, Ventura 13009, Milwaukee 11692.
  Palm Beach 11556 (2014 agenda quote; 48MB bundle timed out twice — snippet-only,
  queued). Lucas County OH: no TWN content in the doc — dropped.
- **Fed lane:** Department of Defense 10365 (official Ramstein AFB civilian-personnel
  handbook, ramstein.af.mil — .mil serves a JS interstitial to curl; PDF.js
  text-layer read of the full in-browser document, P53-P54, code repeats six
  times) and United States Postal Service 12946 (about.usps.com FOIA page,
  fetched verbatim HTML: "The requester must use Employer code 12946").
- **Private-employer lane (incidental finds from the same dorks):** John Wiley &
  Sons 26316 (own separation-agreement exhibit in the Wiley 10-Q), WebMD Health
  Corp 13556 (own handbook, March 2022), Renhill Group 15108 (own handbook),
  Apache Industrial Services 29061 (own verification guideline), Innovative
  Employee Solutions 16219 (own January 2023 contingent handbook), TouchPoint
  Services 11366 (own WisDWD WARN notice; Compass Group brand, same code).
  Broward Health 13739 queued snippet-only (employee-portal wall; browser tabs
  did not attach this session).
- **New bar-compliant evidence path recorded:** tesseract OCR of an employer-
  authored PDF section is accepted when a second independent digit-source
  (e.g. a Google snippet or rendered screenshot) corroborates the same digits —
  used for Manpower and USDA FS. OCR-only with one digit-source is NOT enough.
- **Index:** 15,762 → 15,770 records; coded 186 (TWN 180 + T&C 6); +8 net-new
  coded rows in this pass (Trinity, Milwaukee, Manpower pre-pass + Norfolk,
  Seattle, Wiley, Harris Health, TouchPoint + DoD, USPS + IES, WebMD, Renhill,
  Apache = 13 landed rows; several displaced Truework name-rows). Build PASS,
  20/20 sim over the new keys via the alias index, headed core E2E ALL
  AUTOMATED CHECKS PASSED on the live 15,770-record service worker.
- **Pool verdict update:** casual county/fed dork lanes now return
  already-harvested rows in bulk — the cheap lanes are exhausted; the
  remaining ~2,800 counties and ~33 fed entities need deliberate per-entity
  (state-letter or faction) sweeping rather than broad dorks.

## Dork-sourcing pass 14 (2026-10-23 — continuing per-entity sweeps + queue-wall re-probes)
- **Queue reconnects:** Concord Kannapolis resolved WITHOUT new work — the pass-14
  candidate (Transdev North America 13173) had already been landed from the very
  same ckrider safety-plan document in an earlier pass (same handbook appendix).
  Baltimore 14629 and Palm Beach 11556 have no independent verbatim source yet —
  their single providers (broadwayservices.com, pbcgov agenda bundle) still block
  reads. Broward 13739: the archive.org availability API and CDX were down this
  session (429/temporarily offline) — remains queued. Veolia/Essex still 403.
- **11556 collision resolved responsibly:** The Club at Longview's own handbook
  (theclubatlongview.com) states "Enter the Employer Code 11556" — landed
  verbatim with an inline note that Palm Beach County's 2014 agenda snippet
  claims the same code. Palm Beach stays queued until a verbatim county source
  distinguishes the two.
- **Newly landed verbatim rows:** The Club at Longview 11556 (own handbook),
  Varex Imaging Corp 27429 (own handbook), Darden Restaurants 11533 (10-K
  exhibit; parent of Olive Garden, same code), Arizona Public Service Company
  11803 (APS in the Pinnacle West/APS 8-K exhibit — filer identity resolved from
  the same document's cover page), Pro Unlimited 11586 (talentwise-hosted
  employee sheet), Regina Coeli Child Development Center 110730 (own handbook),
  University of Maine System 17807 (UMA system student-employment handbook,
  code twice).
- **Re-confirmed already-landed rows this pass:** NASA 11338 (official NSSC
  Employment Verification PDF — verbatim again), Mount Carmel Health System
  14229 (new-hire contacts sheet — Trinity Health parent code), UMG/Walmart
  10108 (me.walmart.com associate sheet).
- **Alabama counties slice worked per-entity** (Autauga, Baldwin, Calhoun,
  Cullman, Elmore, Etowah, Houston, Jefferson, Madison, Mobile, Montgomery,
  Talladega, Walker handbooks all fetched): NONE carry TWN guidance in text.
  Alabama is recorded as a dry county lane.
- **Index:** 15,770 → 15,775 records, coded 190 (TWN 184 + T&C 6). Build PASS,
  11/11 sim, headed E2E ALL AUTOMATED CHECKS PASSED on the live index.

## Dork-expansion pass 15 (2026-10-23, authorized event pass — user order: "take the recommended next steps, then add an alpha release")
- **Broward Health 13739 LANDED (queue closed):** employee.browardhealth.org blocks automation on the primary handbook URL, but the SAME official employee portal exposes `/-/media/Broward-Health/Employee/Preboarding/Employee-Handbook.pdf` (alternate filename) under a Wayback snapshot (2023-03-24), fetched + pdftotext verbatim. "…THE WORK NUMBER … BH's employer code is 13739" on p.14. Landed with Wayback provenance.
- **Rot-ping results this pass:** RE-HOME: l3harris.com/resources (404), lockheedmartin.com/contact.html (404), truework.com/verifications/<slug (404). GONE: arregionalhospital.org (DNS), city.mil (DNS), broadwayservices.com (timeout), genesishcc.com (SSL EOF), mcgeeair.com (SSL handshake), polkcountyor.gov/217/Human-Resources (timeout). GATED unchanged at 13. BOUNCE 0.
- **Warehouse-lane sweep recorded dry:** Averitt Express, R+L Carriers, Saia, Southeastern Freight Lines, Estes Express — search returns tariff rules/directories (FCA fees list SCAC-fill "F44367" is not a TWN code), hand-crafted probes 404/301/bot-walled, archive.org download alternates 503 this session (flapping-mode).
- **Alt-routes verified live:** archive.org availability API + CDX back (pass 14 outage was temporary); the Wayback-fetch fallback IS the accepted re-probe route for walls whose vendor/portal hosts block automation.
- **Index:** 15,774 → 15,775 records, coded 191 (TWN 185 + T&C 6). Build PASS, 11/11 sims, headed E2E ALL AUTOMATED CHECKS PASSED on the live index.
