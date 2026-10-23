# todo.md — VOE Helper v1

Live task list. Update in place; do not backtrack. Full working plan lives here; append-only log goes to `history.md`.

| # | Task | Status |
|---|------|--------|
| 1 | Create tracking files (agents.md, todo.md, history.md) | ✓ done |
| 2 | Find closest sister project's index.html sales page as reference | ✓ done (Burns-Development) |
| 3 | Build extension core (manifest.json, background.js per PRD) | ✓ done |
| 4 | Capture 2000+ employers into employers.json | ✓ done (15,686 records) |
| 5 | Source minimalist logo; generate 16/48/128 PNG icons | ✓ done (Tabler file-search, MIT; svgrepo blocked by bot check) |
| 6 | Create index.html first-draft sales page (GitHub-download distribution) | ✓ done |
| 7.1 | Harden toast against HTML injection from selection text (post-audit follow-up) |
|     | | done (removed 594MB Chrome-for-Testing, profiles, probe logs, raw HTML dumps; .gitignore added) |
| 8 | Test extension in headed chromium session | done - ALL AUTOMATED CHECKS PASSED (Chrome for Testing 141, headed DISPLAY :1). Test now drives the REAL context-menu flow (XTest right-click -> native popup -> type-ahead 'l' + Enter) after the temporary manifest keyboard command was stripped; evidence in data/test/ (gitignored, local-only) |
| 9 | Push to production (GitHub main + Pages) | done (commits to Spuds0588/VOE-Helper main; Pages live at https://spuds0588.github.io/VOE-Helper/ after .nojekyll fix). Post-ship audit cleanup: temp manifest command + <all_urls> WAR block removed; dev scaffolding (test screenshots/page/log/script) purged from main |

## Hard gates (mission)
- ≥2000 employer records in the index before v1 publishes.
- Headed chromium test passes before declaring ready.
- No Chrome Web Store step in v1.
| 7.2 | Exercise the daily-sync path (alarms 24h refresh) in the live service worker | done - 15/15 sync checks passed via local harness (alarm wiring, replace semantics with upstream edit + new record visible to matcher, lastSync gating, unreachable-upstream fault tolerance, invalid-payload guard, alarm-fired handler sync). No shipped change found; local-only harness, not committed |

| 7.3 | README: sales-page link, alpha zip download, install/use/dev instructions | done - shipped edf4df9 |

| 8.1 | Provider-code sourcing pass 1 (data/sources.md ground rules + catalog) | done - 27 verified TWN codes appended, index 15,693, checks green, shipped |

| 8.2 | Sourcing pass 2 (self-verified batch, banked buckets private/healthcare) | done - 23 new codes appended all self-verified, index 15,709 with 56 coded, checks green, shipped |

| 8.3 | Sourcing pass 3 (PDF front resolved: Walmart 10108 via pdftotext; 13 verified) | done - index 15,715 with 69 coded, all self-read, checks + headed E2E green, shipped |

| 8.4 | Sourcing pass 4 (finance PDF front + hospital PDF rally: 15 verified, incl. 4 carried-over healthcare PDFs) | done - index 15,720 with 84 coded, all self-read, checks + headed E2E green, shipped |
| 9.1 | Matcher tie rule: coded rows win exact/alias ties (fixes 3-time-logged artifact) | done - sim 11/11 + headed E2E with live-SW tie assertion green, shipped |
| 8.5 | Sourcing pass 5 (big-tech FAQ front + benefit-PDF lane + mop-up: 10 verified incl. Bahama Breeze/ Ventura/Farmer Focus) | done - index 15,724 with 94 coded, all self-read, tie rule resolved older generic-name conflicts (sim 23/23), checks + headed E2E green, shipped |

| 8.6 | Sourcing pass 6 (template-wide verifier-PDF sweep + hygiene front: 35 coded rows incl. IRS/NASA/Commerce/CCCS system + Spartanburg correction) | done - index 15,742 with 130 coded, all self-read, sim 24/24 incl. Dallas/Polk ties, checks + headed E2E green, shipped |

| 8.7 | Pass 7 lead chase (Princeton/UTHealth/WayneCo/JHU) — all four resolve to bot-walls; no codes land | done - verdict written into sources.md: public-surface sourcing declared exhausted within bounds; UAB/Pro Unlimited/UNC recorded out-of-bounds |

| 8.9 | Usability pass (headed): matcher matrix 31 selections + toast render checks | done - 2 wrong-entity substring bugs fixed (tied to tie rule via tiered pass 2), no-match overflow fixed, copy button routed through extension-owned offscreen doc (manifest clipboardWrite+offscreen) so host pages can never prompt/block; test harness right-click + clipboard verification made prompt-free; both suites ALL PASS |

| 9.2 | Phase 2 scope: PDFme WVOE form generator | done (scope/plan only, in PHASE2-WVOE-form.md; build deferred until requested) |

| 9.3 | Portal deep-link audit (user question: is the ordering-page button there + tested?) | done - button confirmed (a.btn-portal per record portal_url); audit found ALL 15,688 Truework per-slug URLs 404 (directory retired) - repointed to live app.truework.com/requester/quickstart, rebuilt (15,742, counts intact); tests now assert portal href == matched record's ordering URL + target=_blank across all 3 providers (test_headed match path + usability D + new G step); both suites ALL PASS |
