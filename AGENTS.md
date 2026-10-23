# AGENTS.md — VOE Helper

Guidance for any agent (or human) working in this repo.

## Project
VOE Helper: Manifest V3 Chrome extension for mortgage processors. Right-click a highlighted employer name → toast shows the VOE/VOI provider (The Work Number, Thomas & Company, Truework) and the employer code, with a deep link to the portal. v1 distribution: GitHub repo download only (no Chrome Web Store). Full spec: `PRD-VOE_Helper.md`.

## Working rules
- YAGNI: no features beyond `PRD-VOE_Helper.md` §1.4 In-Scope. Prefer 1-line solutions.
- Dev environment has limited memory: no heavy installs, no node runtime needed; Python3 + system Chromium only.
- Data work: `tools/build_index.py` regenerates `employers.json` from `data/raw_employers.jsonl`. Never hand-edit `employers.json`.
- Edit `employer` data only via the raw JSONL then rebuild and validate (schema per PRD §1.6; `provider` ∈ {The Work Number, Thomas & Company, Truework}).
- Live progress MUST be recorded in `todo.md` and appended to `history.md` as work happens — these are the anti-backtracking memory.
- Sourcing maintenance runs on a standing cadence: **monthly mini-check** (source-URL rot ping, pointers only, no code changes), **quarterly full pass** (fresh verifier-PDF template sweep + gated-wall re-probe + landing bar), **annual deep audit** (per-note URL revalidation + 8-row verbatim re-sample + collision sweep). Full playbook, cadence table, and remaining lane catalog live in `data/sources.md` §"Recurring re-check methodology" — follow it exactly; the landing bar there is absolute. Run `python3 tools/check_sources.py` for the monthly rot ping.
- Production for v1 = the GitHub repo `Spuds0588/VOE-Helper` (main branch); the sales page (`index.html`) targets GitHub Pages.

## Task-summary format (required at the end of every completed task)

When a task finishes, the final report must open with three plain-language
sections, each a short list of bullet points:

- **What I did** — outcomes and artifacts delivered, including what changed
  and what was verified.
- **What you need to do** — anything only the user can act on (decisions,
  credentials, manual checks), or explicitly "nothing".
- **What I recommend we work on next** — the 1–3 highest-value follow-ups in
  priority order, with a one-line justification each.

## Layout
- `manifest.json`, `background.js`, `employers.json` — extension (per PRD §2.2)
- `icons/` — extension logos (16/48/128 PNG)
- `index.html` — first-draft sales page (sister-project style)
- `tools/` — data pipeline + test scripts
- `data/` — raw captured records (source of truth for the index)
