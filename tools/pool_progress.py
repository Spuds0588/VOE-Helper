#!/usr/bin/env python3
"""Report lead-pool coverage against the catalog and the candidate queue.

Reads: data/lead_pools/<pool>.jsonl, employers.json (catalog), and the
candidate-queue *and catalog notes* of data/sources.md.

Reports per pool:
 - total rows
 - "cataloged": row's name matches a catalog employer key (coded or not)
 - "queued":    name appears in any sources.md queue line (already a lead)
 - remaining rows, with a --slice N printer that emits the N first remaining
   entities as ready-to-query dork lines.

Usage:
  python3 tools/pool_progress.py            (report)
  python3 tools/pool_progress.py --slice counties 12
"""
import json
import re
import sys
from argparse import ArgumentParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POOL_DIR = ROOT / "data" / "lead_pools"
POOLS = ["counties", "ipeds", "fed"]


def normalize(name: str) -> str:
    s = re.sub(r"[^a-z0-9 ]", " ", name.lower())
    return re.sub(r"\s+", " ", s).strip()


def catalog_keys() -> set:
    idx = json.load((ROOT / "employers.json").open())
    keys = set()
    for r in idx:
        for key in [normalize(r.get("name") or "")] + [
                normalize(a) for a in (r.get("aliases") or [])]:
            if key:
                keys.add(key)
    return keys


def queue_text() -> str:
    text = (ROOT / "data" / "sources.md").read_text(encoding="utf-8")
    # queue lines contain "<Name ...>" style references; just feed the whole
    # document so a queued entity found anywhere in sources.md counts.
    return normalize(text)


def load_pool(pool: str):
    path = POOL_DIR / f"{pool}.jsonl"
    if not path.exists():
        return None, []
    with path.open(encoding="utf-8") as f:
        lines = [json.loads(l) for l in f if l.strip()]
    return lines[0].get("_provenance", {}), lines[1:]


def main() -> int:
    ap = ArgumentParser(description=__doc__)
    ap.add_argument("--slice")
    ap.add_argument("slice_n", nargs="?", type=int, default=12)
    args = ap.parse_args()

    keys = catalog_keys()
    q = queue_text()
    remaining_cache = {}

    for pool in POOLS:
        prov, rows = load_pool(pool)
        if not rows:
            print(f"[progress] {pool}: NO POOL FILE")
            continue
        stats = {"cataloged": 0, "queued": 0, "remaining": 0}
        remaining = []
        for r in rows:
            name = r.get("name", "")
            key = normalize(name)
            if key in keys:
                stats["cataloged"] += 1
            elif name[:40] in q or normalize(name)[:40] in q:
                stats["queued"] += 1
            else:
                stats["remaining"] += 1
                remaining.append(r)
        remaining_cache[pool] = remaining
        print(f"[progress] {pool}: total {len(rows)}  cataloged "
              f"{stats['cataloged']}  queued {stats['queued']}  remaining "
              f"{stats['remaining']}" + ("  (source: %s)" % prov.get("source")
                                          if not args.slice else ""))
    if args.slice and args.slice in remaining_cache:
        for r in remaining_cache[args.slice][: args.slice_n]:
            extra = f" ({r.get('state')})" if r.get("state") else ""
            site = f" site:{r['site']}" if r.get("site") else ""
            print(f'"{r["name"]}"{extra}{site} "employer code"')
    return 0


if __name__ == "__main__":
    sys.exit(main())
