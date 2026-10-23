#!/usr/bin/env python3
"""Capture employer names from the Truework public directory (the bulk data source).

Crawls the 26 alphabetical index pages (a-z), extracts company slugs, and appends
one record per company to data/raw_employers.jsonl. Records are raw: no codes
(directory has none) - the index build handles validation/dedup.

NOTE (2026-10-23): Truework retired the public per-employer pages — every
/verifications/<slug>/ URL 404s while the letter indexes still serve. New records
therefore carry the provider-level ordering entry point (requester quickstart)
as portal_url, matching the 2026-10-23 repoint of the existing 15,688 rows.
Per-slug deep links must not be regenerated.

Run: python3 tools/capture_truework.py [--letters a-z] (letters defaults to all)
"""
import json
import re
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_JSONL = ROOT / "data" / "raw_employers.jsonl"

LETTER_URL = "https://www.truework.com/verifications/companies-starting-with-{letter}/"
LINK_RE = re.compile(r'href="/verifications/([^"]+?)?employment-verification/"')
UA = "Mozilla/5.0 (X11; Linux x86_64) VOE-Helper-capture/1.0"
DELAY_S = 1.5  # crawl at a polite pace


def slug_to_name(slug: str) -> str:
    words = [w for w in slug.split("-") if w]
    out = []
    for w in words:
        out.append(w.capitalize() if not (w[-1].isdigit() or len(w) == 1) else w.capitalize())
    return " ".join(out)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def main() -> int:
    seeds_slug = set()
    letters = sys.argv[1] if len(sys.argv) > 1 else "abcdefghijklmnopqrstuvwxyz"
    today = date.today().isoformat()

    RAW_JSONL.parent.mkdir(parents=True, exist_ok=True)
    known = set()
    for line in RAW_JSONL.read_text().splitlines() if RAW_JSONL.exists() else []:
        known.add(json.loads(line)["id"])

    added = 0
    for letter in letters:
        try:
            html = fetch(LETTER_URL.format(letter=letter))
        except Exception as exc:
            print(f"[capture] letter {letter}: FAILED {exc}", flush=True)
            continue
        slugs = sorted(set(LINK_RE.findall(html)))
        # The letter index pages link the company pages AND other letters; keep slugs
        # whose first word starts with the letter to avoid /verifications/[not the company]/noise
        slugs = [s for s in slugs if s[0:2]]
        page_records = []
        for slug in slugs:
            slug = slug.rstrip("-")
            if len(slug.split("-")) < 2:  # skip junk stubs like "a"
                continue
            rid = f"tw-{slug}"
            if rid in known:
                continue
            known.add(rid)
            page_records.append({
                "id": rid,
                "name": slug_to_name(rid[3:]),
                "aliases": [],
                "provider": "Truework",
                "provider_code": "",
                "portal_url": "https://app.truework.com/requester/quickstart",
                "notes": "",
                "updated_at": today,
            })
        if page_records:
            with RAW_JSONL.open("a") as fh:
                for rec in page_records:
                    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        added += len(page_records)
        print(f"[capture] letter {letter}: +{len(page_records)} (total {added})", flush=True)
        time.sleep(DELAY_S)

    print(f"[capture] done: {added} new records -> {RAW_JSONL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
