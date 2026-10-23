# history.md — VOE Helper v1 build log

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
