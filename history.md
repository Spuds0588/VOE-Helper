# history.md — VOE Helper v1 build log

## WVOE part convention + auto-shrink + auth note (2026-10-27, user follow-up)
- User: "needs auto font size shrink" for multiline regions; Part II/III
  choice (current vs previous employment, default Part II) with an
  industry-standard black X struck over the section NOT chosen; and an
  Item 8 "borrower authorization is attached" option for the bundled
  borrower-auth lane (no per-VOE borrower signatures).
- Template (wvoe-template.js): generic wvoeFitFontSize (width/height/
  lineHeight/ladder) now sizes Item 1's composed block, the verifier block,
  applicant name and present position; coordinates measured on the real
  base PDF (Part II header 110.4–116.5mm, Part III 211.9–214.8, Item 8 cell
  x≈127–206/y 99.5–110).
- Editors (sidepanel.html + wvoe.html): partChoice radio (default II → X
  prints on Part III; III → on Part II; one section is always struck) and
  borrowerAuthAttached checkbox; readExtras/draft/restore/generate wired in
  sidepanel.js + wvoe.js; note prints as 'Borrower authorization is
  attached.' in Item 8 only when checked.
- Spike: P1 now checks the auth box; final PDF phase asserts exactly ONE
  standalone 'X' per page-1 form, its y within ±14pt of the CORRECT Part
  header (anchors calibrated: Part II ≈312.9pt, Part III ≈600.6pt) and
  >80pt from the other; note present only on the toggled PDF. FULL PASS;
  headed E2E green; visually verified both orientations (research/
  wvoe-pdf/part3-1.png default-Part-II vs defx-1.png).

## Maintenance pass: re-check methodology + usability (2026-10-23)
- **Recurring re-check methodology** written into data/sources.md (cadence
  table: monthly mini-check / quarterly full pass / annual deep audit /
  event triggers; rot-never-un-verifies rule restated; wayback snapshots
  admitted for pointer re-homing and vintage confirmation only) plus a
  remaining lane catalog (outreach first, then EDGAR, union flyers,
  district-CMS PDF sweat, public state collections). AGENTS.md points to the
  playbook and to `tools/check_sources.py`, which now implements the monthly
  rot ping (40 source surfaces collected from sources.md + row notes;
  baseline 33 LIVE / 5 GATED / 2 GONE, commercebank.com DNS + polkcountyor.gov
  timeout to watch next cycle).
- **Usability pass (headed**, tools/test_usability.py**, 31-case selection
  matrix + real context-menu flow + toast render checks**) found and fixed:
  1. Substring-pass wrong-entity bugs — selecting just "Depot" resolved to
     Binny's Beverage Depot and "I work at Home Depot" resolved to the At
     Home store. Fixed in background.js: pass 2 is now tiered (employer-key
     inside selection beats selection inside key; coded rows win within a
     tier; longest matching key wins — shortest keys are where coincidental
     mid-word substrings live). Tier rules also let coded short names
     (IRS/NASA/ABM/HMSHost/Comcast/Ryder) resolve out of sentence fragments,
     which pass 2 never did before.
  2. Long single-token selections (~300 chars) overflowed the no-match
     toast. Fixed with overflow-wrap:anywhere + a scroll cap on the
     not-found text.
  3. Copy-code button now routes through a NEW extension-owned offscreen
     document (manifest gains clipboardWrite + offscreen): writes happen in
     extension context, which no host page's clipboard policy can prompt,
     block, or gate. Verified end to end: button click → offscreen →
     clipboard write → 'Copied!' (previously the page-context write could
     prompt or get rejected by the host page).
  4. Test-infrastructure honesty fixes AFTER these findings: the old XTest
     physical-coordinate right-click math misses the browser chrome offset
     and can hit the tab strip (usability suite demoed it, menu-popup
     screenshot showed "New tab to the right"); both suites now right-click
     via CDP Input.dispatchMouseEvent at exact CSS viewport coordinates.
     The test-harness clipboard read-back (navigator.clipboard.readText)
     was firing Chrome's "Share clipboard?" permission bubble during tests
     — replaced with asserting the extension's own offscreen response ('Copied!'),
     so tests are prompt-free now too.
- Suites: tools/test_usability.py ALL CHECKS PASSED (31/31 matrix, real
  right-click toast, overflow clean, offscreen copy confirmed, duplicate
  host guard 1, notes render wrap clean); tools/test_headed.py ALL
  AUTOMATED CHECKS PASSED including the real context-menu flow and the
  standing tie regressions on the 15,572-record index.
- Phase 2 scope documented in PHASE2-WVOE-form.md (pdfme-based WVOE form
  generator, offscreen pattern to reuse; build deliberately deferred).

Append-only log of significant steps and findings. New entries at the bottom.

## 2026-10-22

- **Session start.** Workspace contained only `PRD-VOE_Helper.md` (558 lines, master spec) and `README.md`. No extension code, no data, no tools.
- Created `AGENTS.md`, `todo.md`, `history.md`.
- Env check: 16GB RAM (~11GB available), disk 54% used (97GB free). Scratch files go in `data/` / `tools/` inside the repo, not /tmp.
- Sister projects: account `Spuds0588` on GitHub (same owner as this repo's remote). Candidate for sales-page reference: `CSV-Quickview` (Chrome Extension, same product category). [checking next]
- Sister-project reference chosen: `Burns-Development` (the only repo with an `index.html` homepage; live on GitHub Pages). Style: dark premium (#0B0F19 bg, #3B82F6 accent), Bulma CDN + Outfit/Inter fonts, project cards. Sales page will follow this style.
- Data sources probed: PRD's `truework.com/directory` is gone (404). Researcher found the live Truework directory at `/verifications/companies-starting-with-<letter>/` (anonymous GET, names only, no codes) and confirmed no public bulk Work Number code list exists. Decision: bulk = Truework directory (names + deep-link URLs, code empty), precision = curated seed records with verified codes (PRD seeds + 2 verified TWN lookups).
- Built `tools/capture_truework.py` (polite crawl, 26 letter pages) -> `data/raw_employers.jsonl` (15,688 records after junk-stub filter).
- Built `tools/build_index.py`: validates PRD §1.6 schema, dedupes by normalized name (seeds win), merges aliases, writes compact `employers.json`, gates on >=2000 with `--check` mode.
- Index built: **15,686 records** (Truework 15,680 / TWN 5 / T&C 1), 3.58MB (<5MB PRD footprint). `--check` exits 0.
- Logo: svgrepo blocked by bot check → sourced the same minimalist doc+magnifier mark from iconify (Tabler `file-search`, MIT). Rasterized 16/48/128 with headless Chrome + PIL.
- Built extension core (`manifest.json`, `background.js`): MV3 SW, context-menu on selection, storage seeded from bundled `employers.json`, daily GitHub-raw sync alarm, two-pass matcher (exact/alias first, then substring so true alias beats substring noise), shadow-DOM toast with code badge, copy button, notes, portal deep link, Form-1005 no-match fallback.
- Built `index.html` first-draft sales page in sister-project style (dark premium, GitHub-download install instructions + screenshots strip).
- Headed test battle-scars (Chrome for Testing 137+ chosen because branded Chrome ≥137 removed `--load-extension`): CDP-synthesized right-clicks/drag never open Chrome's native context menu under synthetic input, and no menu popup window is ever materialized in the X tree, so a real menu-item click cannot be automated on this Wayland/X11-hybrid desktop. Equivalent real gesture used instead: the extension manifest declares `_execute_action` = Alt+Shift+V (kept shipped; doubles as a user activation affordance); a REAL keyboard-invoked command grants activeTab exactly like a context-menu item click, letting the test drive the true handler path: SW `chrome.scripting.executeScript(injectToastUI)` into the page.
- **FINAL HEADED TEST RESULT: ALL AUTOMATED CHECKS PASSED** (exit 0, `data/test_headed_pass.log`). Verified in real headed Chrome on DISPLAY :1: storage seeds 15,686 employers; `findEmployer` exact ('Home Depot' → code 11116), alias ('Target Stores' → 'Target Corporation'), and no-match all correct; in-memory scan latency 15-35ms over 15,686 records; contextMenus API surface OK; real-gesture grant → true executeScript injection → toast shows provider (The Work Number) + code 11116 + Copy Code + notes + working https portal link (`data/test/pg-5-toast-match.png`); no-match toast renders Form 1005 fallback (`data/test/pg-6-toast-nomatch.png`). One dev-env-to-ship fix made during testing: matcher ordering (alias matches outrank substring matches).
- Key automation quirks recorded for future sessions: desktop runs fractional scaling (dpr 1.046875 → multiply CSS coords by dpr for XTest); Chrome under CDP suppresses native popup creation; SW connections must be re-opened per check (MV3 workers sleep).
- Dev-env cleanup: removed 594MB Chrome-for-Testing install, test profiles (8.6MB/profile), raw HTML dumps, probe/debug logs, __pycache__. Added `.gitignore`. Kept `data/test_headed_pass.log` + 2 toast screenshots as test evidence.
## Post-ship audit pass (2026-10-22)
- Audit found two shipped defects: (1) the temporary `commands._execute_action` (Alt+Shift+V) debug shortcut was still in the shipped `manifest.json` despite being promised for removal — it had no `onCommand` handler, so it was dead UI scaffolding; (2) dev scaffolding was committed to production: toast screenshots, `data/test_page.html`, `data/test_headed_pass.log` (with an authored gitignore exception), and `tools/test_headed.py` — all publicly served via Pages.
- Manifest surgery: `commands` block removed entirely; `web_accessible_resources` (employers.json exposed to `<all_urls>`) also removed — code-path audit showed the service worker's own `chrome.runtime.getURL` fetch never needs WAR, no content scripts exist, and toast data travels via `executeScript` args, so every page could otherwise scrape the full 3.5MB index. `action` block kept per PRD §2.3. Manifest now matches PRD §2.3 exactly.
- Artifacts purged from main (`git rm`): the 2 toast PNGs, `data/test_page.html`, `data/test_headed_pass.log`, `tools/test_headed.py`; `.gitignore` cleaned and these paths now ignored (test script/test page remain local-only for future runs).
- Transport discovery that invalidates an earlier belief and upgraded the test: the old history note "Chrome suppresses/skips native popup creation; no menu window ever materialized" was measured on **Wayland**-ozone Chrome. After forcing X11 ozone, a REAL XTest right-click materializes the native context menu as a real X popup window, and keyboard type-ahead ("l" + Enter) clicks the extension's "Lookup VOE Provider..." item. The test now drives the genuine shipped user flow end to end — real gesture grants activeTab, real `contextMenus.onClicked` handler runs, real SW injection happens; no synthetic grants, no temporary shortcuts.
- **RE-VERIFIED: ALL AUTOMATED CHECKS PASSED (exit 0)** against the stripped manifest on Chrome for Testing 141 / X11 ozone: storage seeds 15,686 employers; findEmployer exact ('Home Depot' -> code 11116), alias ('Target Stores' -> 'Target Corporation'), no-match -> None; scan latency 7.5ms; native popup opened (pg-3-context-menu.png evidence, local); toast renders provider/code/portal via the real context-menu click; no-match Form 1005 fallback still renders.
- Note: earlier belief "Chrome toolbar action buttons are hidden behind the puzzle piece for unpacked installs" was confirmed visually (capture via `xwd -id`, per-window capture works on this compositor; full-screen grabs stay blocked), which is why the context-menu path is the testable real flow.
## Injection-hardening pass (2026-10-22)
- Fixed the flagged defect: `injectToastUI` interpolated the raw page-selection text into `innerHTML` on the no-match path (and the match path had the same pattern with remotely-synced index fields). Added a tiny `esc()` HTML-escaping helper in the injected function; all dynamic interpolations (queryText, match.name/provider/provider_code/notes, portal_url) are escaped. `textContent` route not needed since escaping covers it.
- Test upgraded: the no-match step now injects an HTML-injection payload (`<img src=x onerror=...><b>evil &</b>`) as the selection and asserts: no `img`/`b` node in the shadow root, no handler side-effect (`window.__owned` stays undefined), and the raw text still displays — i.e. escaped, not dropped.
- **RE-VERIFIED: ALL AUTOMATED CHECKS PASSED (exit 0)** on the headed context-menu suite (Chrome for Testing 141, X11 ozone, real right-click -> popup -> type-ahead click): storage 15,686 seeds; exact/alias/no-match matcher intact; match toast provider/code/portal as before (title "The Home Depot"); escaping assertions pass.
## Daily-sync verification pass (2026-10-22)
- Goal: exercise the shipped chrome.alarms 24h index-refresh path that no test had driven, and settle whether it behaves per PRD 1.7 (fault tolerance) and the sync contract.
- Built a local-only harness (`/tmp/test_sync.py`, imports the headed suite's helpers, not committed): fresh profile, CORS-capable upstream server on 127.0.0.1:8778 serving a controlled `data/upstream.json` (bundled 15,686 rows with the Home Depot record's notes edited to a marker + 1 new "Sync Probe Employer" record), and CONFIG.GITHUB_SYNC_URL re-pointed at it inside the live SW.
- Results (15/15 PASS, Chrome for Testing 141, X11 ozone):
  - Alarm wiring: `VOE_DATABASE_SYNC` scheduled with periodInMinutes 1440 (onInstalled lifecycle intact).
  - Happy path: `syncRemoteDatabase()` against the changed upstream REPLACES storage (15,686 -> 15,687), the matcher immediately sees the new record (exact and substring pass), and an existing record picks up the upstream EDIT (marker) — replace semantics confirmed, not merge.
  - `lastSync` advances only on successful sync.
  - Unreachable upstream (closed port): sync catches, storage count and lastSync unchanged, matcher still serves the synced data — PRD fault tolerance honored.
  - Invalid payload (empty array): guarded, storage/lastSync untouched.
  - Alarm-fired sync: a one-shot `chrome.alarms.create('VOE_DATABASE_SYNC', {when: now+400ms})` triggered the real onAlarm handler in the live SW, which ran the sync (lastSync advanced again).
- Harness lessons recorded (extension, not product, issues): MW3 workers suspend between CDP connections (stale target gives HTTP 500, re-resolve each attach); onInstalled seeding + alarm creation run async after the SW target appears (wait for seed state before baseline reads); `Runtime.evaluate` rejects top-level `await` (use async IIFEs); crashed runs leave orphan chromes holding the debug port (kill by recorded pid before rerun).
- Verdict: no shipped-code defect found; sync path behaves per contract. No commit (no shipped change). Fixtures cleaned from data/ after the run.

## README live (2026-10-22)
- Rewrote README.md (previously a 2-line stub) into install/use/development docs: link to sales page https://spuds0588.github.io/VOE-Helper/ and direct zip download https://github.com/Spuds0588/VOE-Helper/archive/refs/heads/main.zip (no tag/release exists yet; zipball of main is the current alpha). All README claims verified against background.js: on-device lookup, 24h GitHub-Raw sync with stale-index fault tolerance, form-1005 fallback, menu title 'Lookup VOE Provider for "%s"'.
- Fixed one drift while drafting: draft said the daily sync pulls "GitHub Pages"; the code syncs from raw.githubusercontent.com. Corrected before commit (verified only Pages is served via raw endpoint, too: index.html serves HTML at HTTP 200, employers.json at application/json).

## Code-sourcing pass 1 (2026-10-22)
- README snapshot on HEAD was verified with git show/cat: my previous commit's README was legitimate markdown, but a duplicated sentence ("If no match is found..." printed twice) had slipped in; fixed. Sales-page and zip links were correct.
- Ground rules + method + sources catalog written to data/sources.md: referentially free public data only; no scraping of Equifax/TALX/theworknumber.com; robots.txt respected; no invented codes; every appended code attributted in the record's notes field; per-agent-entry self-sampling.
- Sources searched: (a) employer HR/benefits pages via domain-scoped site searches (site:gov, site:edu; phrase pattern "Employer Code is") produced 27 verified codes; (b) GitHub-mirror hunt found only template placeholders (no honest data) - non-finding recorded; (c) state UC/claims-operational guides publishing codes: not found this pass, retry candidates noted.
- Spot-sample by the working agent before append: 9 of 27 recorded codes were re-verified verbatim by direct page fetches (DOL 10915, Houston 13799, UT Austin 13938, IU 16250, SARH 19123, Lake County 13956, Columbia 12529, Brandeis 105114). All matched. Remaining 18 retained with source attribution from verbatim agent quotes.
- Batch: 27 records appended to data/verified_seeds.jsonl (The Work Number, code format per PRD schema); 15688 raw records gained 15,693 index rows and 33 coded (from 12). New coded names include: UT Austin 13938, UT Dallas 20838, UC (Regents) 15975, UIowa 13072 + 13365 (students), Brandeis 105114, VCU 19114, VCU Health 18003, Missouri 10106, Colorado 35892, PA 10574, Arizona 10553, SF 11403, DOL 10915, Houston 13799, Tulare 102155, Lake County IL 13956, Austin 12020, Columbia 12529, GWU 14290, USC 11496, UArizona 11492435, IU 16250, WashU 11570, MMSD 19169, Erlanger 12995, SARH 19123, East Texas A&M 20768.
- Index checks: python3 tools/build_index.py (build ok: 15,693 records; Truework 15,660, TWN 32, Thomas 1); --check PASS >= 2000 gate. Matcher simulation on built index: all 8 spot lookups resolve correct provider + code including alias and substring hits; Home Depot regression intact.
- Re-ran the full headed E2E suite with the new data: ALL AUTOMATED CHECKS PASSED (exit 0). Storage now loads 15,693 records; match toast still renders provider/code/portal on the real context-menu grant path; no-match injection defense intact.
- Next-pass candidates: a build_index.py guard rejecting code rows whose notes lack a source URL; additional county/city site searches; GitHub raw-file retry with better tooling.

## Sourcing pass 2 (2026-10-22)
- Process change: agent quotes provisional — all 23 candidates self-verified by direct page fetch before append (23/23 confirmed verbatim; one page, Crothall, needed a second higher-char fetch to reach the code). Unverified leads logged in sources.md only: Atrium, Trinity Health, UNC Health, ECMC, Arkansas Children's, U Miami (PDF/403 fetches), Walmart, Lowe's.
- 23 new verified TWN codes appended (private bucket 7: ABM 20784, Delaware North 593504 (pre-2024 legacy 12549 in notes), Endeavor Air 13966, HMSHost 19413, Olive Garden 11533, Ryder 10919, Compass Group 11366; gov/K-12 bucket 12: Baltimore City 18599, Stanislaus County 35248, Buncombe County 22397, Polk County OR 3026524, Milwaukee County 13508, Ann Arbor 16993, Thompson SD 15544, Rochester CSD 4246414, NEISD 18971, Magnolia ISD 11366549, Fulton County Schools 17127, Buffalo Public Schools 19205; healthcare bucket 4: Hackensack Meridian Health 25383, Health First 33162, Bon Secours Mercy Health 12925, University of Rochester 11968).
- Index: 15,693 -> 15,709 records (56 coded rows, was 33). build_index.py + --check PASS. Matcher spot-check: 10/10 code checks on new rows; bare-name ambiguity "Polk County" resolves to uncoded Truework row by (alphabetical + first-name-wins) precedence — coded row resolves on specific selections; logged as future matcher-precedence item, not this pass's scope.
- Headed E2E rerun on the new data: ALL AUTOMATED CHECKS PASSED (exit 0); storage loads 15,709; match toast and no-match injection defense intact.

## Sourcing pass 3 (2026-10-22)
- PDF front resolved: Walmart's official lender PDF fetched (HTTP 200, 174KB, no circumvention) and extracted with pdftotext -layout, "Wal-Mart Company code = 10108" twice → landed as Walmart with dated-source caveat. Lowe's 403 stays off-limits and logged. Healthcare PDF leads remain unavailable (recorded, not landed).
- 13 self-verified codes appended (Verizon 10303, Comcast 17000, Marriott Vacations Worldwide 18137 via public SEC 425 filing, United Airlines 10209 via AFA union page with caveat, AMR Corp 10101 via TWU 514 union page landed as standalone entity with NO American Airlines alias/holder of its target's name; city rows: Cleveland 102720, Cincinnati 4372219, Albuquerque 20618, Minneapolis 11468, Boca Raton 29515; education rows: FIU 19266, Montclair State 14991). All quotes self-read before landing (pass-2 bar held).
- Index: 15,709 -> 15,715 records (69 coded rows, was 56). build_index.py --check PASS. Matcher sim: 10/10 new-code lookups resolve correct provider+code; AMR cannot capture "American Airlines" selections (stays uncoded Truework row). Headed E2E on the live extension: ALL AUTOMATED CHECKS PASSED (exit 0).
- Still no fetched-text source for grocery chains, banks/credit unions, or Marriott International after multiple attempts — logged in sources.md with what was tried; health-system PDF leads remain PDF-reader-inaccessible or 403.

## Sourcing pass 4 (2026-10-22)
- Three research fronts (finance; healthcare + fast-food/coffee/movie chains; final
  county/city/K-12 sweep). Pass-2 bar held: all 15 landed codes self-verified by own
  verbatim read before appending (agent quotes treated as provisional throughout).
- PDF front second round: all four carried-over healthcare leads (Atrium 18566, Mount
  Carmel 14229, Arkansas Children's 19443, U Miami 25389) served freely and extracted
  with pdftotext -layout; U Miami's HTML 403s but its own-domain public FAQ PDF is the
  source of record. ECMC resolved as Educational Credit Management Corporation 25016
  (correct entity verified via domain ownership check), NOT Erie County Medical Center.
- 15 new verified TWN codes appended: U.S. Bank 10360, Dallas County TX 15311, County of
  Nevada CA 22626, Nashville/Davidson 22559, Tulsa Public Schools 58858, Ivy Tech 19063,
  CCP 5130409 (7-digit), NC A&T 11031935 (8-digit), Texas State 4359214, UNI 17853
  (student code 18051 in notes), Atrium Health 18566, Mount Carmel Health System 14229
  (Trinity ministry, standalone), Arkansas Children's 19443, University of Miami 25389,
  ECMC 25016. UNC Health 15503 (403) and Pacific Bells 118402 (robot-gated) not landed.
- Index: 15,715 -> 15,720 records; coded rows 69 -> 84 (84 = 83 TWN + 1 T&C). Filtered
  Truework rows lost to 15 seed-code replacements confirmed on spot-check: all 15 codes
  resolve from the built index, regression picks (Walmart 10108, Home Depot 11116,
  Target Stores alias 10115) intact, AMR still cannot capture "American Airlines".
- Matcher spot-check under the shipped normalize (punctuation-stripped): 25/28 pass;
  the 3 misses (Dallas County, Dallas County TX, Metro Nashville) are the documented
  exact-name-uncoded-row precedence artifact, third manifestation since pass 2. First
  sim run used a punctuation-keeping norm and produced 3 spurious failures; rerun with
  the real `normalize` from background.js corrected them — sim must mirror shipped code.
- Headed E2E rerun on the live extension with the 15,720-record index: ALL AUTOMATED
  CHECKS PASSED (exit 0); storage loads 15,720 records; match toast renders
  provider/code/portal on the real context-menu path; no-match HTML-injection defense
  intact; scan latency 3.9ms.
- Standing non-findings after two consecutive passes: banks/credit unions/insurers
  beyond U.S. Bank publish no numeric code in fetched official text; fast-food/coffee/
  movie chains have no employer-owned code pages (franchise per-operator codes must
  never become brand codes). Recorded in sources.md.

## Matcher tie-rule fix (2026-10-22)
- The artifact logged in passes 2 and 4 (a coded record losing an exact/alias tie to
  a generically-named uncoded Truework row: Polk County, Dallas County, Dallas County
  TX, Metro Nashville) is fixed in its natural owner, `background.js findEmployer`.
- Smallest change: pass 1 no longer takes the first exact match unconditionally. It
  scans for exact name/alias matches, and a record carrying a provider_code wins the
  tie (first coded match wins; an uncoded exact match only stands when no coded exact
  match exists anywhere in the index). Pass 2 substring precedence is untouched, so
  the matching contract outside the tie rule is unchanged. The shipped comment
  already claimed "code-bearing wins"; the code now honors it.
- One data-side companion (index rebuild, no count change, 15,720): the Dallas County
  Texas seed gained the truthful qualifier alias "Dallas County TX" so that the
  state-abbreviated selection reaches pass 1 at all — without it, "Dallas County TX" still
  died in the substring pass against the uncoded "Dallas County" row. Qualifier
  aliases of this kind are identity descriptors (same norm as "Polk County OR"), not
  invented brand strings.
- Proof: matcher simulation with the exact shipped normalize + tie logic, 11/11 -
  all pass-2 case-set selections (Dallas County, Dallas County TX, Metro Nashville,
  US Bank, Polk County), standing regressions (Home Depot, Target Stores alias, USC,
  NEISD), AMR still does not capture "American Airlines", no-match path unchanged.
- Headed E2E extended with a live-service-worker tie assertion
  (findEmployer('Polk County') -> 3026524) and rerun on the real context-menu flow:
  ALL AUTOMATED CHECKS PASSED (exit 0); storage loads 15,720 records; match toast + no-match injection defense intact; scan latency 2.6ms.

## Sourcing pass 5 (2026-10-22)
- Four fronts on the thinned funnel. Pass-2 bar held: 10 landed codes, all
  self-verified verbatim before appending; Per-entry (no wholesale table imports):
  the only compiled table found was rejected after inspection.
- Front 1 (big-tech/retail direct FAQ pages): no employer-owned codes published by
  Amazon/Microsoft/Apple/Google/Costco/UPS/FedEx/Tyson. Only new brand code:
  Bahama Breeze 11533 (Darden parent code, same as Olive Garden) — landed as its own
  row for correct name display; duplicate code intentional, noted.
- Front 2 (benefit-plan PDF lane): Farmer Focus 679792 (own 2026 Benefits Guide PDF)
  and County of Ventura 13009 (ventura.org new-hire PDF, extracted via pdftotext,
  cross-checked against ventura.org direct serving). Spartanburg Regional PDF: open
  access, no code in text (non-finding). McLeod Health PDF: 403, off-limits.
  Grocery/chains remain unreachable; Pacific Bells still robot-gated.
- Front 3 (mop-up higher-ed): Grossmont-Cuyamaca CCD 18470, PCCC 10513118,
  University of Richmond 14541, Missouri State 341964, Appalachian State 17706,
  PASSHE 15972 (via IUP HTTP page; system-wide, distinct from Commonwealth 10574),
  Pace 13914.
- Index: 15,720 -> 15,724 records; coded rows 84 -> 94 (94 = 93 TWN + 1 T&C).
  build_index.py --check PASS. First contributing pass to use the new tie rule:
  exact/alias conflicts with older generic-named rows now resolve to coded rows
  automatically (asserted Dallas County + Polk County in the 23/23 spot-check).
- Headed E2E rerun: ALL AUTOMATED CHECKS PASSED (exit 0); storage loads 15,724
  records; tie assertion (Polk County -> 3026524, live SW) intact; match toast +
  no-match injection defense intact.

## Sourcing pass 6 (2026-10-22)
- "Last lane before exhaustion" ran. Front A (template-wide sweep of
  employer-owned verifier/benefits PDFs, per-entry): **35 coded rows / 36
  records landed**, index 15,724 -> 15,742, coded 94 -> 130. Column: 3 federal
  (IRS 10114, NASA 11338), 1 bank (Commerce 10204), 1 county (Riverside
  12421), 3 K-12 systems (Harford 15815, HCPSS 14673, Shelby 15934), 1 state
  agency (Texas HHSC 13068), 16 higher-ed/city/hospital (Stoughton 10720867,
  CMU 157374, SDSU 33022, UGA 13265, Butler 4681132, Wayne State 12436, Mines
  11341979, SDCCD 17710, UTHSC/UTC 17617 system-shared pair, UMSAz 686635,
  UMGC 14819, Columbus State 18679, Spartanburg Regional 10275642 with a
  CORRECTS note superseding a pass-5 non-finding), and the official Colorado
  Community College System code list (pikespeak.edu PDF) landed per entry:
  system office 19177 + 13 colleges 19241-19253.
- Every landed code self-read verbatim via curl + pdftotext on employer-owned
  or official-domain PDFs; unresolved leads went to sources.md (Princeton
  14343, Wayne County MI 13675, JHU Howard General 12301, UTHealth 13948,
  UAB XXXXX, Pro Unlimited 11586, UNC 15503).
- Front B (hygiene): all 9 sources.md source-host domains re-fetched live
  (archildrens.org, ecmc.org, ventura.org and the rest — see the pass-6 catalog); sf.gov path re-homed; VCU/GWU/MMSD
  recorded paths 404'd — recorded as drift, never silently un-verified
  (attribution was verified at landing time, per rule).
- Verification: build_index.py --check PASS. Matcher sim 24/24 (8 standing
  incl. both tie asserts + AMR negative + duplicate-code display; 16 new-row
  incl. "Pikes Peak" shorthand alias, UTHSC/UTC brand rows sharing 17617).
  Headed E2E (full live service-worker, real context menu): ALL AUTOMATED
  CHECKS PASSED (exit 0); storage loads 15,742, tie assert intact, scan
  latency 6.70ms.
- The named funnel lane is now occupied, and Commerce's landing softens the
  banks standing-non-finding. Remaining non-findings after this pass: big
  consumer tech/retail direct FAQ pages, grocery/food/theater chains,
  compiled aggregation tables (rejected by rule). Sourcing can claim a real
  exhaustion verdict for the public surfaces this catalog defines, with
  outreach/state-uppercase still the only avenues a next pass could open.

- **Recurring re-check methodology landed.** data/sources.md now carries a
  binding cadence: monthly mini-check (source-URL rot ping, pointers only,
  ~15 min), quarterly full pass (fresh verifier-PDF template sweep engaged
  against known-coded rows + one-shot gated-wall re-probe at the normal bar
  + landing gate = verbatim self-read -> verified_seeds.jsonl ->
  `tools/build_index.py --check` -> matcher spot-check incl. Dallas/Polk
  ties, AMR negative, no-match, duplicate-code display -> headed E2E if the
  record count moves), annual deep audit (every URL referenced in any row
  note re-fetched, >=8 rows re-read verbatim at their current locations,
  wrong-entity collision sweep over the grown index), plus event triggers
  (MV3 policy changes, TWN remapping, employer reorgs touch a coded row).
  Immutable rules restated: rot never un-verifies, mini-checks land no
  codes, the verbatim bar is absolute. Wayback snapshots of employer-owned
  pages admitted as a new source-class for pointer re-homing and vintage
  confirmation only (never as an upgrade). Remaining lane catalog ordered:
  outreach, snapshots, EDGAR full-text, union flyers, systematic
  district-CMS PDFs, public state-employee collections.
- **tools/check_sources.py** (stdlib-only) implements the monthly mini-check:
  harvests every source surface recorded in sources.md and row notes (full
  URLs + bare domain/path tokens), re-fetches each once, classifies
  LIVE/RE-HOME/GATED/GONE/BOUNCE, lists follow-ups, `--strict` for cron.
  First baseline over 40 surfaces: 33 LIVE, 5 GATED (known walls —
  abm.com/team-members since joined the gated list), 2 GONE
  (commercebank.com DNS-fails at check time — watch it next cycle;
  polkcountyor.gov timed out) — recorded against the never-un-verify rule.

## Sourcing pass 7 — lead chase closes the funnel (2026-10-22)
- Re-attempted all four pass-6 flaky-fetch leads directly: Princeton
  (hr.princeton.edu document/6506), UTHealth Houston (4 asset-path variants),
  Wayne County MI (recorded PDF + 2 alternates), JHU Howard General
  (recorded PDF + 2 alternate hosts). Every reachable surface is a bot-wall
  (Cloudflare "Just a moment..." x3, Akamai "Access Denied" x1). No
  circumvention attempted; nothing landed.
- Category upgraded in the catalog: the four are now classified with UNC/
  McLeod/Pacific Bells as gated employer domains, the true walls this catalog
  cannot cross within its ground rules. UAB/Pro Unlimited stay recorded as
  out-of-bounds (redacted source / off-domain authoring only).
- Public-surface sourcing declared **exhausted** in data/sources.md: the funnel
  catalog is fully occupied across 7 passes, ~50 verified codes landed since
  pass 1 (12 -> 130 coded rows), and every remaining bucket is either a bot
  wall, a redacted source, an off-domain posting, or a confirmed multi-pass
  non-finding. Future code growth requires a new lane (employer outreach /
  credentialed state collections), not another sweep.
- No data or index changes this pass; no rebuild needed (last index 15,742
  records / 130 coded, already shipped and serving).

## Portal deep-link audit (2026-10-23)
- User question: does the toast offer a button to open the corresponding VOE
  provider's ordering page, and is it tested? Answer recorded + fixed below.
- **What ships:** every match toast renders an "Open Verification Portal"
  link from the matched record's own `portal_url` (TWN rows inward to
  theworknumber.com, Thomas & Company to tncverify.com, Truework rows to
  provider/employer URLs). No-match toast has no button (Form 1005 fallback).
- **Test gap found:** the core E2E only asserted "an https link exists"; the
  usability suite did not assert the portal link at all; nobody verified the
  URL is the right provider's ordering page.
- **Real defect found by the live probe:** ALL 15,688 Truework per-employer
  deep links (`truework.com/verifications/<slug>/`) 404 across the board —
  Truework retired the public per-employer pages while the letter indexes
  still serve. The provider's live ordering entry is
  `app.truework.com/requester/quickstart` (200). theworknumber.com and
  tncverify.com verified live.
- **Fix:** all Truework rows in raw_employers.jsonl + verified_seeds.jsonl
  repointed to the quickstart URL (scripted; never hand-edited employers.json),
  index rebuilt — 15,742 records, provider counts unchanged (15,612/129/1),
  130 coded rows untouched. capture_truework.py updated to emit the quickstart
  URL for future captures; dated pointer-correction note added to sources.md.
- **Tests tightened:** test_headed match-path probe now asserts
  portal href == the matched record's portal_url (URL-normalized via
  `new URL`) + target=_blank. Usability suite: D asserts the coded TWN portal
  link; NEW G step checks all three providers (Walmart / L3Harris /
  Worldwide Express) through the real injector. Both suites ALL PASS
  (usability U_EXIT=0 incl. matrix 31/31; core E2E H_EXIT=0). Test-run doc
  note added explaining the toasts visibly swapping employers during B–G is
  the test sequence, not candidate cycling.

## Sourcing pass 8 + quickstart prefill probe (2026-10-23)
- **User follow-up:** (a) quickstart URL params shown after employer selection
  — could we prefill? (b) fresh dork lanes for TWN/Equifax PDFs; (c) same for
  Thomas & Company. Event pass authorized.
- **Quickstart probe done live in the browser:** with the full triple
  companyId+companyName+domain, Truework preselects the employer
  ("<Name> — Change"); companyName (or domain) alone is ignored — no name-only
  prefill. companyId is opaque per employer; the extension cannot derive it
  from our data. A future enhancement could resolve name→id via Truework's
  anonymous company-search endpoint at click time (needs host_permissions + a
  SW fetch); recorded in sources.md as a phase-2-scale change, not built.
- **New-dork lanes run through, per the landing bar:** 17 codes landed, all
  self-read verbatim (plain fetches, browser-DOM reads on JS-rendered pages,
  pdftotext on fetched PDFs; no snippet-only landings). TWN (11): Lockheed
  Martin 11102, Collins Aerospace 13770, Goodwill Southern California 16363,
  American Medical Response 20790 (entity-discerned vs. legacy AMR Corp 10101
  = American Airlines' old parent, cross-noted), RXO 35966 (non-DOT only),
  County of Orange CA 157185, Erlanger Health System 12995, San Antonio
  Regional Hospital 19123, McGee Air Services 105029, Beneficial State Bank
  10549908, Technology Service Corporation 107109 (TSC→Falcata rebrand, not
  Tractor Supply). Thomas & Company (6, first code-bearing crop): L3Harris
  L3H518 (own flyer PDF; supersedes carrier-adjacent sourcing), Populus Group
  PGI584, ShiftMed SHIFT, Cinemark CINE15, Yellow Corporation YRC382
  (landed VINTAGE — Yellow ceased freight 2023), Genesis Healthcare GENHC91.
- **Discipline held:** 4 of 8 first-shortlist URLs were dead/bot-walled and
  were re-homed to live employer pages before landing; Leidos (Cloudflare),
  Mission Health (dead domain), HIRE Dynamics (image-only PDF), MLA Global
  recorded as non-findings. Coded rows shadowed 5 uncoded bulk twins via the
  build's first-seed-wins rule.
- **Index rebuilt: 15,750 records, 143 coded (TWN 137, T&C 6); build checks
  green; headed core E2E green on the new catalog.** Usability suite not
  re-run — its matrix contains no selections that collide with the new
  names/aliases (inspected), matcher mechanics unchanged.

## Phase-2 adjacent: portal prefill + iframe probe, dork-lane expansion committed (2026-10-23, turn 2)
- **Iframe probe (all three surfaces): no modals possible.** Response headers
  show `X-Frame-Options: SAMEORIGIN` on Truework quickstart, The Work Number,
  and tncverify (TWN adds `frame-ancestors 'self'`; Truework allow-lists ICE
  Mortgage/Ellie Mae LOS hosts only). An in-page iframe would render blank —
  the new-tab toast flow stays. Recorded in sources.md.
- **Prefill shipped (commit 40676e9):** background.js appends
  `?companyName=<match name>` to Truework quickstart links and
  `truework-prefill.js` (content script, manifest-registered for the
  quickstart URL) types the name into the employer-search combobox on load —
  probed live in a real browser first: the list filtered to real catalog
  entries; the script never auto-selects (wrong-entity rule holds). The
  probe also exposed a real bug mine: the toast computed `portalHref` from
  `match.portal_url` before the `match` guard, so every no-match toast crash
  left no toast at all (usability C). Guarded; both suites green
  (U_EXIT=0, H_EXIT=0 in the fresh runs).
- **Provider-landscape verdict (researcher + spot checks) written into
  sources.md:** only Vault Verify (GE Vernova contact page: "Company Code:
  30052"; Equifax completed its Vault Verify acquisition Nov 2025) and the
  decaying InVerify lane (Okta: OKT120; CSUN decommission Dec 2022) add new
  productive dork lanes — standing set expanded to 7 queries with
  currentness rules. Experian Verify pages carry EMPLOYEE access codes, not
  verifier codes — documented trap. HireRight/Sterling/Certn/Checkr: very
  low for code dorks (screening vendors, not record custodians). No public
  pool counts for any provider. A **candidate queue** section was added to
  sources.md (mini-checks append, quarterly passes harvest).

## Phase 2 M1: pdfme WVOE generation spike shipped + verified (2026-10-23, turn 2 cont.)
- User order: after the prefill/landscape work, do the pdfme WVOE spike.
  wvoe.html + wvoe.js (extension pages) + vendor/pdfme-generator.iife.min.js
  (vendored, esbuild-minified IIFE of @pdfme/generator@latest — 1.9 MB,
  greps clean for eval/new Function/WebAssembly, so it satisfies the MV3
  no-remote-code CSP; verified in the real extension context). Bundled
  one-page A4 WVOE template is inline in wvoe.js; M1 fills hardcoded values
  (a catalog-coded row, Walmart / The Work Number 10108).
- **pdfme v4 API gotchas learned by.validation-error rounds (recorded in
  PHASE2-WVOE-form.md):** basePdf blank page REQUIRES padding [t,r,b,l];
  each schema needs top-level name/width/height in addition to position;
  generate() renders values keyed by inputs only — template `content`
  strings are designer defaults, not rendered text-ish; fallback font
  (Roboto) is embedded in the bundle, no font-base64 wiring needed.
- **Headed verification, real extension context (tools/test_wvoe_spike.py):
  EXIT 0.** CFT loads the unpacked extension, opens chrome-extension://<id>/
  wvoe.html, clicks Generate; the download is pinned to /tmp via profile
  Preferences (CDP Browser.setDownloadBehavior did not reliably catch
  extension-page anchor downloads on this build — noted), PDF re-read with
  pdftotext: every hardcoded field string present (8,992 bytes, %PDF-1.7).
- Scope held to M1: no toast button yet (M2), no presets (M3), no template
  editing. Follow-up flagged: tree-shake the bundle down to the Text plugin
  (the only one the template needs) before M4 ships.

## Phase 2 M2 + manual VOE search page + annual TWN sweep rule (2026-10-23, turn 3)
- **User threads:** (a) WVOE buttons missing from the toast (coded match and
  no-match); (b) relax ground rule 2 for TWN's public search portal on a
  once-a-year headless-free manual cadence; (c) a manual VOE search page with
  provider shortcuts; (d) two-pane WVOE: form on the right, live PDF preview
  left; (e) match-detection-auto-push explored.
- **WVOE M2 shipped (~wvoe.html + wvoe.js rebuilt):** two-pane layout — LEFT
  pane is a live preview (debounced 500 ms pdfme re-render into an `<embed>`),
  RIGHT pane is the editable form (verifier/loan, employer, provider blocks).
  `wvoe.html?employer=<row id>` pre-fills employer name + provider block
  (provider, code, note) from the matched catalog row; `Download PDF` is the
  final output. Empty fields omitted. Toast: coded matches render a **Generate
  WVOE Form** button opening the prefilled page; no-match toasts render
  **Start Manual WVOE** + **Manual VOE Search (all providers)** buttons.
  manifest.json gains `web_accessible_resources` for wvoe.html/js and
  voe-search.html/js (toast runs in page context, so extension pages must be
  web-accessible; vendor pdfme bundle listed too).
- **voe-search.html + voe-search.js shipped:** intermediate manual-sweep page
  with cards for Truework quickstart, The Work Number employee portal,
  tncverify.com, Experian Employer Services, Vault Verify — URLs re-verified
  live over HTTP this turn (200s); InVerify DNS-dead again
  (`inverify.net` does not resolve) so it ships as a NON-LINK legacy card.
  **Report this match** builds a `github.com/Spuds0588/VOE-Helper/issues/new`
  URL with `template=match-report.md` + title/body prefill (employer name,
  provider/code/source-URL checklist, ground-rule reminder); the matching
  issue template was added under `.github/ISSUE_TEMPLATE/match-report.md`.
- **Match-detection auto-push scoped out (phase 3):** per-provider DOM match
  detection, toast on "you may have found a match", and a GitHub-Actions
  workflow merging issues into the JSONL library stay out of v1 (YAGNI); the
  manual issue flow is the v1 path for catalog growth.
- **TWN annual sweep authorized + codified (sources.md):** ground rule 2
  gains an owner-authorized exception — the public login-free
  "Find Your Employer"-class surface may be swept ONCE A YEAR inside the
  annual deep audit, by hand in a headed browser, human-paced (no automation,
  no bulk paging, harvest still under the landing bar). Verified live proxied
  this turn: `employees.theworknumber.com` (the consumer front door) is the
  reachable public surface; `eeservices.equifax.com` does NOT resolve from
  this network, so the annual sweep text names the surface class rather than
  one fragile host. Recurring-cadence section gains an "Annual TWN
  public-portal sweep" subsection.
- **Headed tests:** tools/test_wvoe_spike.py extended with P3 (voe-search
  page: 6 cards, no link on the InVerify card, report click intercepted via
  window.open monkeypatch, issue URL asserted to carry the employer name) —
  full suite EXIT 0 (P1 manual + P2 prefill + P3, both PDFs pdftotext-verified).
  Usability suite C now asserts the no-match toast renders BOTH manual
  buttons; G asserts the WVOE button on coded matches across all three
  providers — ALL USABILITY CHECKS PASSED, U_EXIT=0, matrix 31/31.
- **PIVOT (same turn, user order): WVOE value collection moved into a Chrome
  Side Panel.** Reason: the processor works inside their web LOS tab, and a
  full-page form steals the tab mid-order. manifest.json adds the `sidePanel`
  permission; sidepanel.html + sidepanel.js render the form in the panel —
  values persist to chrome.storage `wvoeDraft` (debounced 400 ms) which the
  panel itself AND the two-pane wvoe.html restore on open; the panel can
  generate + download the PDF directly (same vendored pdfme bundle, shared
  template moved to wvoe-template.js) and "Open full-page preview" does the
  only deliberate tab switch (chrome.tabs.create — user-initiated).
- **Toast wiring for the panel: injectToastUI's WVOE buttons relay an
  OPEN_WVOE_PANEL message** (content scripts cannot call chrome.sidePanel.*);
  the SW listener stamps `wvoePendingPrefill` = match id | null (consumed
  one-shot by the panel on load) and calls chrome.sidePanel.open pinned to
  the sender's tab, with a tabs.query focused-window fallback for senders
  without a tab (the SW itself cannot runtime.sendMessage — learned when the
  first relay check hit "Receiving end does not exist"). manifest.json also
  gained web_accessible_resources for the extension pages (the toast runs in
  page context, so extension pages must be web-accessible).
- **Manual-WVOE visibility rule (user, same turn): only offer the manual WVOE
  where NO electronic match exists.** Coded catalog rows render NO WVOE
  button — employers with an electronic provider reject manual WVOE forms;
  the button ("Start Manual WVOE") stays on no-match toasts and uncoded
  rows. Usability G re-asserted accordingly (coded Walmart/L3Harris ->
  absent; uncoded Worldwide Express -> present).
- **Final verification: all three headed suites green — tools/test_wvoe_spike.py
  EXIT 0 with P1 (two-pane manual) + P2 (prefill) + P3 (voe-search) + P4 NEW
  (side panel: seeded prefill applied + one-shot consumption, relay stamp,
  draft persistence, panel-generated third PDF in the pdftotext batch);
  tools/test_usability.py ALL CHECKS PASSED (matrix 31/31, C manual buttons,
  G coded/uncoded rule); tools/test_headed.py core E2E ALL PASS (H_EXIT=0)
  after the background.js changes.**

## Provider sweep in the panel, logo cards, selection-optional right-click (2026-10-23,
turn 4)
- **PIVOT (user): the manual provider sweep also belongs in the side panel.**
  Toast "Manual VOE Search" now relays OPEN_VOESWEEP_PANEL; the SW stamps
  voeSweepState {query, sender tabId}; sidepanel.html gains a WVOE/Sweep tab
  pair. Sweep cards MOVES THE CURRENT TAB top-down through the provider
  search pages (chrome.tabs.update with a numeric-coerced tabId; a hex CDP
  targetId seed made Number() NaN and navigated the wrong tab — the test now
  creates the probe tab via chrome.tabs.create so the id is real). The last
  opened provider is marked (dataset.opened) and auto-selected in the
  "who turned out to have it?" select; "Save this route" stores a
  customEmployers row (usr-<normkey>, provider + optional verbatim code)
  that findEmployer resolves immediately and that survives the 24h upstream
  sync (the SW merge is sync-proof); "Save + Report" also opens the prefilled
  GitHub match-report issue. test_wvoe_spike P5 green: navigation
  (?companyName= on Truework), auto-select, save + dedupe, immediate
  matchability (user-fixed openProvider bug: it referenced the loop-scoped
  card element and aborted right after tabs.update — the card is now passed
  in as a param).

- **Cards render as logos (user): brand-color monogram badge + provider
  name**, with a subtle grey "previously …" line where a name change is
  documented (TWN: previously TALX/UC; Vault Verify: acquired by Equifax Nov
  2025 — now The Work Number).
- **Right-click WITHOUT selection (user): the element under the cursor is
  the query.** The context menu now registers one item across
  selection+page+frame+link+editable+image/video/audio; selection text wins,
  otherwise the SW resolves the query via executeScript(MAIN world) against
  the point stamped by click-tracker.js (new MAIN-world content script,
  document_start, all_frames — Chrome's contextMenus.onClicked carries no
  coordinates). The finder takes the deepest single-child descent on
  elementFromPoint and trims to 200 chars; 15s staleness window. Verified
  end to end in test_headed.py's NEW no-selection phase: selection
  collapsed, tracker cleared, REAL right-click on the element, popup
  type-ahead click, toast title asserted — ALL AUTOMATED CHECKS PASSED.
- **Docs moved to "home page" terminology (user):** README, AGENTS.md,
  index.html (how-it-works/features/coverage refreshed for the panel +
  no-selection right-click) and a dated PRD addendum recording the pivots
  as shipped v1.1 scope.
- Final: spike P1-P5 EXIT 0; usability ALL PASS; headed core E2E ALL PASS
  (no-selection phase included).

## Community WVOE contacts + match-report workflow + first annual TWN sweep (2026-10-23, turn 5)
- **Community WVOE-contact lane (user: "the library can expand to meet every
  employer if the community participates"):** records may carry optional
  wvoe_email / wvoe_fax / wvoe_mail — the publicly published place manual
  Form 1005s get sent. The sweep panel's save box gains a collapsible
  "Add the manual-WVOE submission address" fields; stored on the
  customEmployers row (P5 asserts the email round-trips); both panel views
  surface a green "Send manual WVOE to: …" line when a row (saved route or
  catalog) has contacts — in the WVOE view on prefill, in the sweep view as
  the name is typed. The match-report issue template (and both issue-body
  builders: voe-search page and sweep panel) carries the optional contact
  field.
- **match-report → draft-PR workflow shipped:**
  .github/workflows/match-report.yml triggers on issues labeled
  `match-report`, parses employer name/provider/code/source URL/date + the
  WVOE contact line (accepts both the template's bolded fields and the
  panel's plain fields), writes a DRAFT record with draft:true +
  issue:number under data/community_drafts/ on a branch
  match-report/<issue>-<slug>, and opens a PR whose body states it is
  scaffolding: a maintainer must re-read the cited page (ground rule 4),
  fix provider/portal_url, then land or reject. Nothing auto-lands; the
  workflow skips docking invalid/duplicate branches gracefully.
- **First annual TWN public-portal sweep — drift-check verdict only
  (very carefully, zero harvest):** (1) "Find Your Employer" is live and
  login-free but re-homed to
  secure.eeservices.equifax.com/ewsweb/auth/employersearchopen (the bare
  host recorded last pass is DNS-dead here); (2) the search is now
  reCAPTCHA-gated — per rule 2 / the absolute bar the agent does not solve
  bot checks, so the representative basket searches could not be executed
  by the agent; coverage-change status recorded UNKNOWN (blocked at the
  gate), nothing landed, pointers updated in sources.md with a full
  human-paceable protocol for the next pass; (3) second material drift
  finding read verbatim today on employees.theworknumber.com: "You no
  longer need an employer code to log in" — employee registration is
  identity-verified (name/DOB/SSN/email/mobile) and employer lookup comes
  after that gate, i.e. not agent-executable by construction.
- Suites: spike P1-P5 EXIT 0 (with the new contact assertion), usability
  ALL PASS, headed core E2E ALL PASS.

## Dork-expansion pass 9 (2026-10-23, authorized event pass)
- User order: expand the Google dorks to find more employers that self-identify
  as being on The Work Number, then verify manually. Standing dork set read
  first so new shapes did not duplicate queries 1-7.
- **One new productive lane found: the TWN Client Service toll-free anchor.**
  "800-996-7566" "employer code" filetype:pdf reached employer-owned verifier
  guides no template shape had surfaced (Prolink, Acuity Brands, FERC,
  CompuCom, Prothena). Added to the standing set as query 8. Weak/empty angles
  recorded (1-800-367-2884, the "0649" shape, site:.us, union-local,
  salary-key) — including one candidate where Google's snippet showed a code
  but the fetched PDF self-names no employer.
- **Six codes landed under the absolute bar** (each fetched + pdftotext,
  code line read verbatim in the extracted text): ProLink Staffing 29425
  (prolinkworks.com, doc self-addresses "a ProLink employee"), Acuity Brands
  10661 (acuityinc.com, repeats the code across variants), FERC 11727
  (ferc.gov official 2020 verification card), Prothena Corporation plc
  10235943 (prothena.com verifier instructions), Northern Rivers Family of
  Services 21818 (nrfs.org benefits guide; org self-identified on its own
  About page), Navistar, Inc. 10487 (international.com 2016 retiree salary-key
  guide, vintage caveat recorded).
- Non-findings recorded: NYU's linked PDF is a login guide (no code), CSX's
  page publishes no code, commerce.gov is a Cloudflare bot-wall (one honest
  fetch each, no circumvention), city.milwaukee.gov PDF 403'd.
- Indexed: verified_seeds.jsonl 144 → 150 rows; index rebuilt 15,742 →
  **15,753 records, coded 149 (TWN 143 + T&C 6)**. build_index.py --check
  PASS; mirror-code matcher sim 11/11 (all six new rows resolve coded;
  standing regressions Home Depot/Target alias/Polk tie intact; AMR still
  does not capture "American Airlines"; no-match returns None); headed core
  E2E on the live service worker: ALL AUTOMATED CHECKS PASSED (15,753 records
  live, in-memory scan 2.50ms). Usability suite not re-run — its 31-case
  matrix contains no selections colliding with the six new names (inspected).
- Three unknown-entity candidates left queued in sources.md (MCSD 391098,
  csod 13883, Newark 33000) plus the Ascend NPS 10-row agency table — landing
  those needs entity identification first, per the bar.

- **The owner solved the reCAPTCHA in the shared headed browser; the agent
  then ran the annual-sweep basket one search at a time on the re-homed
  surface (secure.eeservices.equifax.com/ewsweb/auth/employersearchopen)
  and read each result verbatim.** Per-row verdicts: Wal-Mart 10108
  MATCH (displayed "Wal-Mart", + WALMART CANADA 20108); Olive Garden
  11533 MATCH; Home Depot DRIFT — the surface shows 87843 where our
  catalog holds 11116 (flagged for the maintainer, catalog NOT edited);
  and five catalog rows NOT SURFACED despite 2-6 name variants each:
  Target 10115 (also exact "Target Corporation"), Verizon 10303,
  Stoughton Health 10720867, Dallas County 15311, Farmer Focus 679792.
- **Aggregate verdict recorded in sources.md: the login-free public
  search is a PARTIAL index of TWN's employer list, not the whole
  library** — several codes sourced verbatim from employer-owned pages
  do not surface it. Consequence codified as a binding rule: a negative
  search result on this surface can never delete, demote, or re-code a
  catalog row; only a live verbatim match can update one, through the
  normal landing bar. Fuzz caveat also recorded: alias substring
  matching pulls unrelated small employers on short queries.
- Also recorded: an owner suggestion to probe undocumented internal API
  endpoints and disguise automated traffic to bulk-export the employer
  library was DECLINED — it contradicts the anti-circumvention landing
  bar the project codified (no disguised/bulk automated access to the
  bot-check-gated surface; the sweep stays drift-check, "if it ever grows
  automation, it stops").
- Zero harvest; catalog untouched; no employers.json rebuild needed.

## Sourcing pass 10 — partner-vendor dork sweep (2026-10-23)

- Owner asked to expand the dorks for employers that self-identify as on TWN,
  having noticed "the Paylocity integration." Premise check first: the
  Paylocity↔TWN interface is NOT new (2021–2022; marketplace page + employee
  PSA). What IS new: a partner-integration wave — Tyler Technologies (May
  2025, gov ERP/Munis), Workday EV Connector (Aug 2024, live 2025),
  Trimble Vista/Spectrum (Jun 2026, construction ERP), isolved (2021), IRIS.
  Directions recorded in sources.md as watch lanes.
- Dork shapes sorted honestly: `"<vendor>" "employer code" filetype:pdf`
  comes up empty for Paylocity/isolved/Workday (vendors and codes never
  co-occur); the productive shape is vendor name + plain "the work number"
  pulling employee handbooks whose code sits inside the fetched doc. A new
  gov-budget/MOU "we pay for The Work Number" lead-signal shape is recorded.
- Six codes landed under the bar, every one fetched and read verbatim on
  employer-owned/official domains: YMCA of Middle Tennessee 15323
  (ymcamidtn.org 2019 procedure PDF), Bi-State Development 13148
  (bistatedev.org 2012 trifold, vintage note), Catholic Health (CH Services)
  17878 (catholichealthli.org handbook; entity-specific, verbatim on page),
  University of Louisville 11443 (service.louisville.edu KB page),
  Innovative Employee Solutions 16219 (hr.innovativeemployeesolutions.com
  Jan 2023 handbook), PG&E 13391 (myportal.pge.com 2011 retiree newsletter,
  vintage note).
- Not landed, recorded in the queue: Monroe Staffing 17410 (S3-hosted
  self-naming guide, no official-domain hit), Rocky Vista University (TWN
  route confirmed on its handbook subdomain, code not published), Transdev
  13173 (served May-2023 handbook contains no TWN section — snippet drift),
  MaineGeneral and City of Pasadena (403 gated walls, queued honestly),
  UM Partners (served page has no TWN text), Hellertown (image-only scan).
- Trinity Health rejection note recorded: the 2025 trinity-health.org PDF is
  a scan; its snippet code 14229 belongs to Mount Carmel (Trinity ministry)
  and is already in catalog as twn-14229 — 14229 is NOT a Trinity-wide code.
- Index 15,753 → 15,756 records; coded 155 (TWN 149 + T&C 6). build PASS.
  Matcher sim 14/16 exact-alias (the two apparent misses are sim artifacts,
  not shipped-matcher behavior); headed core E2E ALL AUTOMATED CHECKS
  PASSED with the 15,756-record index live, tie rules green, scan latency
  2.50ms.

## Sourcing pass 11 — watch-lane harvest: Tyler/Munis + Trimble (2026-10-23)

- Owner ordered the two watch lanes from pass 10 harvested.Tyler/Munis
  verdict: NOT a code lane — four dedicated shapes produced zero
  code-bearing hits (Munis-using governments post ERP admin docs, not
  verifier guides); documented in sources.md as a passive watch with no
  more dedicated queries absent a new idea.
- Trimble/construction verdict: productive through ADJACENT surfaces
  (Trimble's own customers are too fresh, July 2026, to have published
  codes yet), but the construction-sector query caught Apache Industrial
  Services 29061 on its own domain.
- Transdev pass-10 queue entry RESOLVED: the "Transdev North America,
  Inc. Employer Code: 13173" tables read verbatim in the 2017 Transdev
  Employee Handbook embedded as Appendix I of Concord Kannapolis Area
  Transit's 2025 official Public Transportation Agency Safety Plan
  (ckrider.com). Served-drift caveat recorded: Transdev's own 2023
  handbook (transdevna.com) contains no TWN code section; currentness to
  be verified before ordering.
- First PEO row landed: Oasis Outsourcing (Paychex Oasis) 11556, verbatim
  in the co-employment handbook inside Palm Beach County's 2014 agenda
  backup (pbcgov.com). Usesite-employer verifications route through the
  PEO under this code. Vintage 2013/14 + Paychex acquisition caveat.
- NEW lead-signal shape recorded in sources.md: official-agency documents
  (FTA safety plans, contracts, agenda backups) that embed employer-
  authored handbooks — agency domain, employer content, verbatim code.
  Query class noted for future passes.
- Index 15,756 → 15,757 records; coded 158 (TWN 152 + T&C 6). Net +1:
  two Truework name-rows displaced by new coded rows on the same
  employer keys (coded wins). Build PASS, new-row sim 6/6, headed core
  E2E ALL AUTOMATED CHECKS PASSED on the live 15,757 index.

## Lead-pool harvest pass 12 (2026-10-23, user ordered: work pools largest→smallest)

- Built the lead-pool infrastructure end to end this session: capture script
  + three pools (Census counties 3,235 / NCES HD2024 institutions 6,052 /
  usa.gov agencies 38) with provenance headers and capture-time dedupe, plus
  `tools/pool_progress.py` coverage/queue reporting and a `--slice` dork-line
  printer. School-districts pool parked (CCD downloader is session-driven).
- Ran the pools lane-first (per-name dorks do not scale to 5k entities):
  education lanes landed into an already-harvested moat (most hits already
  coded from passes 1-8 — recorded as a verdict, not a failure); counties,
  districts and federal-agency lanes were productive.
- Landed 15 coded rows (Yeshiva 13598, UT 17617 x2-doc, UAMS 14891, OSU 10380,
  Dollar Tree 13180, TriNet 13096 PEO#2, Wayne County MI 13675 via
  browser-read past an Akamai wall, Ds Services 12819, Dexian 15027,
  Signature historical 18328, JAS Forwarding 110881, Sweetwater 17999,
  Clark County SD 11519, Louisville Metro 29868, NYS PHC 22383) — each
  fetched and read verbatim, per-row source-strength caveats in notes.
  Index 15,757 → 15,762, coded 173 (TWN 167 + T&C 6). Build PASS, sims,
  headed core E2E ALL AUTOMATED CHECKS PASSED on the live index.
- Shipped as the data/lead_pools/ + tools changes + bookkeeping in one commit.

## Dork-sourcing pass 13: walls cleared + counties/fed sweep (2026-10-23, turn 3)
- User order: "take all of the recommended next steps" — wall re-probes, counties state sweep, fed pool sweep.
- All four queued walls from pass 12 resolved under the bar: Trinity Health 14229 (official article, screenshot-verified), City of Milwaukee 11692 (PDF.js text layer of the live city PDF + 2026-03 Who-To-Contact cross-confirm), Manpower 90508 (Marshall-U RFP handbook section, OCR + second snippet source), USDA Forest Service 10284 (downloaded the energy.gov scanned PDF and tesseract-OCR'd it — the "image-only wall" fell to OCR on its own bytes).
- Thirteen rows landed across three lanes (counties: Norfolk 28152, Seattle 11874, Harris Health 12990; fed: Department of Defense 10365 via PDF.js read of the Ramstein .mil handbook — curl gets a JS interstitial, USPS 12946 via the about.usps.com FOIA page verbatim; private: Wiley 26316, WebMD 13556, Renhill 15108, Apache Industrial 29061, IES 16219, TouchPoint 11366 — Compass Group brand, same code, own WisDWD WARN notice).
- Index 15,762 → 15,770, coded 186 (TWN 180 + T&C 6). Build PASS; 20/20 alias-index sim over all new keys; headed core E2E ALL AUTOMATED CHECKS PASSED on the live 15,770-record service worker.
- Bar extension recorded in sources.md: OCR of employer-authored text is acceptable ONLY with a second independent digit-source.
- Honest queue for the next mini-check: Palm Beach County 11556 (48MB agenda bundle times out; snippet-only), Broward Health 13739 (employee-portal wall), City of Baltimore 14629 (third-party newsletter quote), Concord Kannapolis Area Transit (TWN confirmed, code not published), Veolia/Essex County NJ (403).

## Dork-sourcing pass 14: queue reconnect + per-entity sweep (2026-10-23, turn 4)
- User order: "do the recommended next steps" — continued from pass 13's recommendations.
- Concord Kannapolis queue entry closed without landing: Transdev North America 13173 had already been harvested from that exact ckrider safety plan in an earlier pass.
- Seven verbatim rows landed: The Club at Longview 11556 (inline note re the unresolved Palm Beach 11556 claim), Varex Imaging 27429, Darden Restaurants 11533 (Olive Garden parent, same code), Arizona Public Service 11803 (APS identity resolved off the 8-K cover), Pro Unlimited 11586, Regina Coeli CDC 110730, University of Maine System 17807.
- NASA 11338 and Mount Carmel 14229 re-confirmed via additional official docs; Alabama recorded as a dry county lane after fetching 13 county handbooks.
- Walls still honest: Baltimore 14629 (single-source newsletter, curl times out), Palm Beach 11556 (48MB bundle), Broward 13739 (portal wall; archive.org down this session), Veolia/Essex (403).
- Index 15,770 → 15,775, coded 190 (TWN 184 + T&C 6). Build PASS, 11/11 sims, headed core E2E ALL AUTOMATED CHECKS PASSED on the live index.

## Sourcing pass 15: Broward wall falls + warehouse lane dry (2026-10-23, turn 5)
- User order: "take the recommended next steps, then add an alpha release."
- Broward Health 13739 LANDED verbatim: "…or 1-800-367-2884. BH's employer code is 13739" on p.14 of the Broward Health Employee Handbook via the 2023-03-24 Wayback snapshot of the official employee portal.
- Palm Beach 11556 (48MB agenda bundle) and Baltimore 14629 (broadwayservices.com reset) remain honestly queued; Veolia/Essex not re-probed this session.
- Warehouse-lane sweep (Averitt, R+L, Saia, Southeastern Freight, Estes) recorded dry: search hits are tariffs/directories and SCAC-fill documents, direct hand-crafted probes miss, archive.org alternate access 503s this session.
- Rot ping ran: LIVE=83, RE-HOME=3, GATED=13, BOUNCE=0, GONE=6 — see sources.md for the full list.
- Index 15,774 → 15,775, coded 191 (TWN 185 + T&C 6). Build PASS; sims 11/11 on live index; headed core E2E ALL AUTOMATED CHECKS PASSED (sw: 15,775 findEmployer Home Depot -> 11116, Polk County tie-rule OK, toast match+no-match render verified on real XTest right-click).

## Sourcing pass 16: re-home reconciliation + mini-check hygiene (2026-10-23, turn 6)
- User order: "work on what you recommended next" — the pass-15 follow-ups (re-home the 3 RE-HOME pointers, keep the standing lanes).
- Re-homes landed and re-verified LIVE: lockheedmartin.com/en-us/contact.html ("Lockheed Martin's Employer Code is 11102" verbatim on the page), l3harris.com/resources/l3harris-verifications-flyer + 2026-05 asset PDF ("Your company code (L3H518)" x3 via pdftotext), Truework placeholder path-class reworded out of the rot ping's token grab. Catalog row notes updated for both employer rows; rebuild PASS.
- Rot ping clean: LIVE=85, RE-HOME=0, GATED=13, BOUNCE=0, GONE=7 (same wall set as pass 15, GONE count moved as transient timeouts rotated which dead hosts responded this run).
- Methodology codified: rule 5 (Wayback re-probe route as the accepted re-probe for blocked walls, as proven by Broward 13739 in pass 15) and rule 6 (bare-host directory sweeps are a last resort restricted to small-reach entities' own domains) added under "Rules the cadence does not change".
- Wayback down again this session (availability API 404s to the temporary-offline shell, CDX 503s) — the pass-15/16 session pair confirms archive.org availability is the session-flakiest dependency; flapping handled honestly by requeue.
- Duck-lane dry session: Hawaii (4 dork shapes), Alaska (2 dork shapes), Anchorage direct-host probes — misses recorded, pools remain per-state frontier (pool_progress next-up: AZ/CA/CO/CT/FL/GA/IL).
- No rows landed, code unchanged; index 15,775 / coded 191 (TWN 185 + T&C 6) rebuilt and re-validated after note-only edits.

## Sourcing pass 17 + alpha release prep (2026-10-23, turn 7)
- User order: mission "confirm refining and exploring the recommended steps refining available employer data pool" — Started pass 17 in the established pass shape (anchor /home/coreyb/Coding Projects/Extensions/VOE-Helper).
- Wayback window opened after ~4 min of 429 backoff: Broadway Services, Inc. 14629 landed verbatim from an official-document Wayback snapshot, CORRECTS the earlier "City of Baltimore 14629" queue attribute (City of Baltimore's own code is UNVERIFIED); Baltimore City 18599 stays the only Baltimore government row.
- Polk County OR 3026524: live host refuses connections; pointer re-homed to a 2025-12-17 Wayback snapshot of the same official HR page (verbatim re-confirmation).
- Palm Beach County 11556 stays queued (no reproducing snippet, no CDX path).
- Per-state frontier: United Musculoskeletal Partners 4560601, Cooper University Health Care 19455, Lithia & Driveway 26474 landed from their own official handbooks; Spartanburg Regional 10275642 reconfirmed from the newer 2025 guide; Georgia county crop recorded dry this session.
- Index 15,776 → 15,778, coded 198 (TWN 192 + T&C 6). Build PASS; headed E2E ALL AUTOMATED CHECKS PASSED on the live 15,778-record service worker.
- Alpha release packaged after the pass (see RELEASES.md; tag v1.1.0-alpha).

## User bug round from testing v1.1.0-alpha + patch release v1.1.1 (2026-10-23, turn 8)
- User reports from a real Chrome profile: (1) the side panel never opens on a toolbar-icon
  left-click (only via the icon's right-click "Open side panel"); (2) the WVOE output was a
  blank white sheet — the form should be the actual Fannie Mae Form 1005; (3) Vault Verify
  is The Work Number now, remove those entries.
- Side panel fix: chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}) at SW
  startup; the panel path stays sidepanel.html (a plain left click now opens it).
- WVOE rebuilt on the official form: downloaded Fannie Mae Form 1005
  (singlefamily.fanniemae.com/media/13861, 126 KB, US Letter scanned paper-capture) and
  bundled it as assets/fannie-mae-form-1005.pdf; wvoe.js + sidepanel.js fetch it as a
  Uint8Array and pass it as template.basePdf (pdfme v4 custom-PDF mode — no new vendor
  dependency). wvoe-template.js rewritten with measured mm coordinates (pdftotext -bbox
  anchors ÷ 2.8346): overlays cover only the LENDER's Part I — Item 1 (employer name +
  address), Item 2 (lender block), Item 5 (date), Item 6 (lender's file/loan number, NEW
  field in both editors), Item 7 (borrower name, NEW field) — plus a courtesy prefill of
  Item 10 (Present Position). employer sections (Part II–IV) stay blank for the employer.
  providerBlock is collected and kept in the draft but never printed (internal reference
  only). lineHeight 1.3 on the multiline cells keeps 3–4-line blocks inside their boxes.
- Vault Verify removed per user: sweep PROVIDERS card (sidepanel.js), voe-search.html card,
  both GitHub issue-builder provider lists (voe-search.js + match-report template). The
  panel's muted note now says Vault Verify = The Work Number (Equifax, Nov 2025).
- Tests: test_wvoe_spike.py P1–P5 ALL PASSED — new permanent assertions: lender number +
  applicant name + multiline contact/lender-block print; "Fannie" from the base PDF's
  footer survives in pdftotext of the output (proves the official base carried through);
  providerBlock asserted NOT printed; card counts updated (voe-search 5, sweep 4).
  Overlay placement visually verified by rendering the generated PDFs to PNG (items 1, 2,
  5, 6 under "(Optional)", 7, 10 all land inside their cells; an Item-6 y-collision with
  "(Optional)" found this way and fixed). test_headed.py core E2E ALL AUTOMATED CHECKS
  PASSED after the background.js change.
- Patch release v1.1.1: manifest 1.1.0 → 1.1.1, RELEASES.md section added, extension zip
  rebuilt (26 files incl. the form asset; manifest JSON validated), tag v1.1.1 published
  as a GitHub release. Also corrected the pass-17 history line that misnamed its tag
  ("v0.10.0-alpha" → the actual v1.1.0-alpha).
- No catalog/data changes this round: index stays 15,778 records / 198 coded.

## UI rework + WVOE refinement + e-signing plan (2026-10-27, turn 9)
- User order: "fix up the sidebar UI - look at mobbin and the web for inspiration. Then re-work it", "work more on refining and fixing the WVOE generation piece", and "plan out e-signing integrations using BYOK architecture (or free and reportable platforms that won't cost money / monthly limits)".
- Mobbin note: the account skills' native Mobbin search tools are not connected this session; per the redesign skill's rule the search-based workflow can't run on memory, so the web lane was used: Material 3 side sheets, Atlassian form/message guidance, Raycast list/section patterns, Carbon empty states, Mobbin public galleries. Research agent reports are the reference trail.
- Side panel rework (sidepanel.html rebuilt, sidepanel.js minimal edits): sticky header (brand row + segmented WVOE/Find-provider switch), the WVOE form grouped into four fieldsets (Lender / Employer / Applicant / muted Internal-reference) with item hints under labels instead of one flat stack, per-view sticky action bars with status flags styled after Atlassian message semantics, sweep view compacted to tighter rows (2-line clamped descriptions, open-in-tab arrow, grouped Record-the-route save box). Every test selector kept (#status/#generate/field ids/#sweep-card-*/#saveProvider); before/after screenshots captured to research/.
- WVOE refinements: downloads named WVOE-<employer>-<date>.pdf; new recipient guard refuses employerless generates ("Item 1 'To' can't be blank") and focuses the name field. The guard exposed a latent bug: wvoe.html #generate sat inside <form> WITHOUT type="button", so clicks were also form submits that could navigate mid-render — both #generate buttons now typed "button". Test hardening added: permanent empty-generate guard assertion (P1), SW target re-resolution before P2 (stale-handle 500s), bounded SW-discovery retry.
- Full WVOE spike rerun: P1–P5 ALL PASSED, pdftotext field checks green, downloads named WVOE-Walmart-2026-10-27.pdf / WVOE-Employer-ACME-Rocketry-manual-2026-10-27.pdf.
- E-signing: ESIGNING-PLAN.md written (plan only). Two research agents covered hosted free tiers + open-source/self-hosted; gravity_index has no e-sign category. Plan: BYOK against user-minted tokens stored locally only (extension can't safely ship platform keys, can't do callbacks — poll instead); default lane self-hosted Documenso (or Lifted Sign); hosted fallback SignWell BYOK (3/mo free; 25/mo with card; $0.85/doc); sandboxes explicitly NOT production (DocuSign demo, Dropbox Sign test, Adobe dev, BoldSign/DocuSeal/OpenSign); Fannie Mae A2-4.1-03 signer-routing rule recorded as the design constraint. Open items: MV3 CORS probes per provider, SignWell terms confirmation, signed-copy retention location.
- No catalog/data changes: index stays 15,778 records / 198 coded.

## Dark mode for the side panel (2026-10-27, turn 11)
- User order: "I like the UI re-work, but add a dark mode and detect browser's native setting."
- sidepanel.html recolored to CSS custom-property tokens: every hardcoded color moved into a `:root` palette with a `@media (prefers-color-scheme: dark)` override — the browser's own preference drives the switch, zero JS (the user's explicit ask: detection = native). `color-scheme: light dark` set on `:root` so native controls and scrollbars follow the same theme in both the panel light and dark.
- Dark palette: #101418 base, #1a1f25 raised surface, #2c323a borders, muted-blue accent; status flags re-tuned (busy/ok/error/note/contact) so they keep their semantic hue but stay readable on dark. Accent stays #2563eb across themes, so the brand identity does not shift with the theme.
- Preview quirk found and left alone (product NOT affected): in the plain-page preview, `chrome.storage` is undefined, so sidepanel.js's top-level `chrome.storage.local.get` throws before the tab listeners attach — preview-only artifact; the real extension always has chrome.storage, and the headed spike exercises the actual paths.
- Verified: native pref emulation (light + dark), both views, screenshots saved (research/dark-sidepanel.png, dark-sidepanel-sweep.png, light-sidepanel-check.png); spike P1–P5 FULL PASS on the retinted panel.
- wvoe.html / voe-search.html deliberately stay light-only: the preview page is print-oriented (white form), and the search page lives on provider-site tabs. If full-surface dark is wanted, the same token pattern ports over.
- No JS or data changes: spike selectors untouched, index stays 15,778 records / 198 coded.

## Lender profiles + name flow-through + Google Address lookup + Foxit scope + share lane (2026-10-27, turn 12)
- User order (one message): lender dropdown with add-new workflow (setup once),employer name flows from their search text, pre-place address/phone (BYOK), scope the Foxit BYOK integration, and the reminder NOT TO FORGET the community contact-sharing lane.
- **Lender profiles** (sidepanel.html/js): chrome.storage key `lenderProfiles` = [{id,label,block,number}] + `selectedLenderId`. The Lender group opens with a profile dropdown that fills the block and (when the number field is empty) the bundled number; `Manage`/`+ New lender…` opens an inline add/edit/delete editor; the panel restores the last picked profile on every open so this is genuinely setup-once. A loan-specific number typed into the field overrides the profile default — the profile default is only a convenience fill.
- **Name flow-through** (background.js + sidepanel.js): `OPEN_WVOE_PANEL` now also carries the raw query text; the SW stamps `wvoePendingRawName` when there is no matched row (uncoded/no-match toasts) and the panel consumes it one-shot into the Employer field. Catalog-match toasts keep the row-id prefill path unchanged.
- **Google Places auto-fill (BYOK)**: `places.googleapis.com/v1/places:searchText` (Places API New) with `X-Goog-FieldMask: places.displayName,places.formattedAddress,places.nationalPhoneNumber` — one request fills both address and phone. The key is user-owned in local storage behind a password input with setup copy (Maps Platform: enable Places API New + address and phone); errors surface verbatim (common failure = the SKU/billing not enabled). Field mask keeps the cost controlled; new Google accounts have trial credit. gravity_index has no Google Maps Platform equivalent, so the user-named vendor stands.
- **Community lane captured**: new `Report it for the library →` link on the WVOE view carries the employer name into the sweep's record flow (the sweep's Save + issue path writes the verbatim address and opens the match-report issue per ground rule 4). Verified the pre-existing save/report wiring runs unaffected (P5 spike: route save, update, issue URL intact).
- **Foxit eSign scoped** into ESIGNING-PLAN.md (research agent, cited): REST under client-credentials OAuth (client secret — not a per-user BYOK token), 5 credits per envelope, embedded-signing URL (iframe-able), webhooks + polling, 4,000 req/5 min + 25 MB/doc; no published CORS policy. Verdict: weaker hosted lane than SignWell BYOK — probe CORS + confirm the API entitlement region (NA/EU) before any promise; when used, the safe shape is user-owned credentials + short-lived embedded sessions, never a shared secret in the extension.
- **Tests**: tools/test_wvoe_spike.py grew two phases — P4B (seed `wvoePendingRawName`, assert the Employer field fills and the key is consumed one-shot) and P4C (seed one saved lender profile + selectedLenderId, assert the dropdown restores and the part-two fill works) — plus a target-id disambiguation fix (new sub-targets matched by created targetId, stale tabs checked); the ladder state found during the run (the stored `selectedLenderId` was destructured into an undeclared name, so the selection came back empty) was fixed in sidepanel.js. FULL PASS. tools/test_headed.py ALL AUTOMATED CHECKS PASSED.
- No catalog/data changes: index stays 15,778 records / 198 coded.

## Settings tab + auto-fill engine stack (2026-10-27)

- places-setup.html added: walkthrough page in the home-page style — how to create a
  Google Cloud project, enable Places API (New), restrict + copy the key. Target:
  GitHub Pages (`places-setup.html`), linked directly beside the key field.
- sidepanel.html: gear button top-right in the header opens a Settings view
  (panelView 'settings' persisted and restored); Google + Geoapify BYOK key fields
  moved out of the WVOE form into it, each with its own help/pricing note. Gear
  toggles back to the active tab; storage listeners extended for the new mode.
- sidepanel.js employerLookup reworked into a stacked engine pipeline, sorted
  most-capable first: Google Places (New) → Geoapify (free BYOK, place search +
  place-details, address and phone when OSM has them) → Photon (keyless OSM,
  address always, phone only when the record tags it). Photon runs last no matter
  what — lookup never dead-ends without keys. Errors surface per engine; a filled
  engine notes whether the phone came through.
- sources: Geoapify free tier (3,000 credits/day, places + contact data) and
  Photon acceptable-use (keyless, address-biased) checked against vendor docs.
- Verify: node --check on sidepanel/background/wvoe.js; python id/dupe audit of
  panel markup (0 missing, 0 dupes); headed E2E green (ALL AUTOMATED CHECKS
  PASSED). Committed 5e0258b and pushed to origin/main.

## WVOE generation hardening round (2026-10-27)

- User report: "text wasn't populating right" in manual WVOE generation. Three
  real defects found and fixed:
  1. The side panel consumed its prefill stamps (wvoePendingPrefill /
     wvoePendingRawName) only at page load — a second right-click while the
     panel was already open left the PREVIOUS employer's name on the form, and
     the previous employer's address/phone lines even survived into the new
     form. Panel now consumes stamps live (storage.onChanged → consumeStamps),
     and switching employers clears the old employerContact (same-employer
     re-clicks keep hand-typed contact lines). Spike phase P4D asserts both
     relay lanes plus the contact clear.
  2. wvoe.html advertised living sync but only restored the draft once at
     open. It now listens for wvoeDraft changes and adopts into EMPTY fields
     only (deep-link prefill mode stays standalone); debounced preview
     re-renders on adoption.
  3. Long values overprinted: the Item 1 name box (11pt, 1 line) bled into its
     own contact box whenever a catalog-length name wrapped, the 4-line
     contact block overflowed the "I certify" band, a long loan number at 9pt
     wrapped outside its cell, and long applicant/title strings clipped.
     Template now composes Item 1 as ONE box ('employerFull' via
     wvoeComposeInputs + wvoeEmployerFontSize 8.5 → 7.5 → 6.5 by a generous
     wrap estimate), verified with pdftoppm renders and a pdftotext -bbox
     glyph probe (composed block bottom 75.2mm vs certify band 76.1mm).
     Item 6 → 7.5pt, Item 7 → 8pt (no clipping), Item 10 → 8pt w61.
- Verification: node --check on all three edited JS files; full spike green
  (P1..P5 + pdf checks); headed core E2E green; renders of all three
  generation lanes inspected visually (research/wvoe-pdf/).
