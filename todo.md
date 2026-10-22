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
