#!/usr/bin/env python3
"""Build employers.json from raw data. Never hand-edit employers.json.

Sources (in merge order, first record for a name wins; later aliases merge in):
  data/verified_seeds.jsonl   <- curated, code-bearing records (source of truth for codes)
  data/raw_employers.jsonl    <- bulk captured records (Truework directory)

Validates every record against PRD §1.6 and gates on the v1 minimum (>=2000 records).
Run: python3 tools/build_index.py          (build + validate + print count)
     python3 tools/build_index.py --check  (validate existing employers.json, exit 1 if < 2000)
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "employers.json"

PROVIDERS = {"The Work Number", "Thomas & Company", "Truework"}
CODE_OK = {
    "The Work Number": re.compile(r"^\d{4,8}$"),
    "Thomas & Company": re.compile(r"^[A-Z0-9]{3,8}$"),
    "Truework": re.compile(r"^$"),
}
REQUIRED = ("id", "name", "aliases", "provider", "provider_code", "portal_url", "notes", "updated_at")
MIN_RECORDS = 2000


def normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def load_jsonl(path: Path):
    for line in path.read_text().splitlines():
        line = line.strip()
        if line:
            yield json.loads(line)


def validate(rec: dict, provider_fallback=None):
    missing = [k for k in REQUIRED if k not in rec]
    if missing:
        raise ValueError(f"{rec.get('id', '?')}: missing keys {missing}")
    if rec["provider"] not in PROVIDERS:
        raise ValueError(f"{rec['id']}: bad provider {rec['provider']!r}")
    if not CODE_OK[rec["provider"]].match(rec["provider_code"]):
        raise ValueError(f"{rec['id']}: bad provider_code {rec['provider_code']!r} for {rec['provider']}")
    rec.setdefault("updated_at", date.today().isoformat())


def build() -> list:
    index = {}  # normalized name -> record
    for src in ("data/verified_seeds.jsonl", "data/raw_employers.jsonl"):
        for rec in load_jsonl(ROOT / src):
            validate(rec)
            key = normalize(rec["name"])
            if key in index:
                prior = index[key]
                prior["aliases"] += [a for a in rec.get("aliases") or [] if a not in prior["aliases"]]
                if not prior["provider_code"] and rec["provider_code"]:
                    prior["provider_code"] = rec["provider_code"]  # later record can donate a code
                continue
            index[key] = rec
    # dedupe aliases that equal another record's canonical name (avoids alias collisions at runtime)
    for rec in index.values():
        rec["aliases"] = [a for a in dict.fromkeys(rec["aliases"]) if normalize(a) != normalize(rec["name"])]
    return list(index.values())


def write(records: list) -> int:
    records.sort(key=lambda r: r["name"].lower())
    OUT.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")))
    return len(records)


def check() -> int:
    data = json.loads(OUT.read_text())
    for rec in data:
        validate(rec)
    n = len(data)
    print(f"[build_index] check: {n} records, providers: {_by_provider(data)}")
    print("[build_index] FAIL: below v1 minimum of 2000" if n < MIN_RECORDS
          else "[build_index] PASS: meets v1 minimum of 2000+")
    return 1 if n < MIN_RECORDS else 0


def _by_provider(data: list) -> dict:
    counts = {}
    for rec in data:
        counts[rec["provider"]] = counts.get(rec["provider"], 0) + 1
    return counts


def main() -> int:
    if "--check" in sys.argv:
        return check()
    records = build()
    n = write(records)
    print(f"[build_index] wrote {n} records -> employers.json  ({_by_provider(records)})")
    if n < MIN_RECORDS:
        print(f"[build_index] FAIL: {n} < {MIN_RECORDS} required for v1")
        return 1
    return check()


if __name__ == "__main__":
    sys.exit(main())
