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
| 7 | Clean out unnecessary dev-env elements as work proceeds | done (removed 594MB Chrome-for-Testing, profiles, probe logs, raw HTML dumps; .gitignore added) |
| 8 | Test extension in headed chromium session | done - ALL AUTOMATED CHECKS PASSED (Chrome for Testing 137+, headed DISPLAY :1; see tools/test_headed.py, evidence log data/test_headed_pass.log, screenshots data/test/) |
| 9 | Push to production (GitHub main + Pages) | done (commit ae087ac pushed to Spuds0588/VOE-Helper main; Pages target remains index.html for GitHub Pages enablement)

## Hard gates (mission)
- ≥2000 employer records in the index before v1 publishes.
- Headed chromium test passes before declaring ready.
- No Chrome Web Store step in v1.
