#!/usr/bin/env python3
"""Capture and check lead pools for the sourcing pipeline.

Lead pools are employer-NAME pools (never code-bearing, never into
employers.json). They are consumed by sourcing passes as dork-target slices;
any candidate still crosses the normal landing bar (verbatim self-read on an
employer-owned/official-domain surface) before a row can land. See
data/sources.md "Recurring re-check methodology" and "Lead-pool lane”.

Rules:
 - Every pool file lives at data/lead_pools/<pool>.jsonl.
 - Line 0 of every file is a provenance record: {"_provenance": {...}} with
   the source URL, license note and capture date. Written only by this script;
   no hand edits.
 - `capture <pool>` (re)builds a pool from its official public source and
   runs `--check` immediately.
 - `--check <pool>|all` re-validates the file(s) without touching the network.

Pools (priority order, per data/sources.md):
  counties  Census FIPS county names (~3.2k; public domain)
  ipeds     NCES IPEDS institution directory (6k; public data)
  fed       USA.gov federal-agency A–Z roster (~400; public page)
  districts NOT YET AVAILABLE (NCES CCD moved its bulk zips behind a
            session-driven downloader; queue for a future pass)

Dev-environment notice: Python3 stdlib only (urllib, zipfile, html.parser) to
hold to the repo's no-node, minimal-memory constraint.
"""
import argparse
import csv
import io
import json
import re
import sys
import tempfile
import zipfile
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

TODAY = date.today().isoformat()
POOL_DIR = Path(__file__).resolve().parent.parent / "data" / "lead_pools"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

SOURCES = {
    "counties": {
        "url": ("https://www2.census.gov/geo/docs/reference/codes2020/"
                "national_county2020.txt"),
        "license": "US Census public domain (GEOnames/FIPS crosswalk file)",
    },
    "ipeds": {
        "url": "https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip",
        "license": "US Department of Education IPEDS public data",
    },
    "fed": {
        "url": "https://www.usa.gov/federal-agencies",
        "license": "USA.gov public-domain page (agency A–Z list)",
    },
}


def fetch(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=60) as resp:
        return resp.read()


def write_pool(pool: str, provenance_extra: dict, rows: list) -> Path:
    POOL_DIR.mkdir(parents=True, exist_ok=True)
    path = POOL_DIR / f"{pool}.jsonl"
    with path.open("w", encoding="utf-8") as f:
        prov = {"_provenance": {
            "pool": pool,
            "source": SOURCES[pool]["url"],
            "license": SOURCES[pool]["license"],
            "captured": TODAY,
            **provenance_extra,
        }}
        f.write(json.dumps(prov, ensure_ascii=False) + "\n")
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return path


def capture_counties() -> Path:
    text = fetch(SOURCES["counties"]["url"]).decode("utf-8")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    header = lines[0].split("|")
    idx = {c.upper(): i for i, c in enumerate(header)}
    rows = []
    for ln in lines[1:]:
        p = ln.split("|")
        rows.append({
            "kind": "counties",
            "name": p[idx["COUNTYNAME"]].strip(),
            "state": p[idx["STATE"]].strip(),
            "fips": f'{p[idx["STATEFP"]] }{p[idx["COUNTYFP"]]}',
            "class": p[idx["CLASSFP"]].strip(),
        })
    return write_pool("counties",
                      {"notes": "Census FIPS 2020 county names, pipe-delimited"},
                      rows)


def capture_ipeds() -> Path:
    blob = fetch(SOURCES["ipeds"]["url"])
    csv_rows = []
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        with z.open(name) as fh:
            reader = csv.reader(io.TextIOWrapper(fh, encoding="latin-1"))
            header = [c.upper() for c in next(reader)]
            i_name = header.index("INSTNM")
            i_st = header.index("STABBR")
            i_web = header.index("WEBADDR")
            i_ctrl = header.index("CONTROL")
            for r in reader:
                if len(r) <= max(i_name, i_web):
                    continue
                csv_rows.append({
                    "kind": "ipeds",
                    "name": r[i_name].strip(),
                    "state": r[i_st].strip(),
                    "site": r[i_web].strip(),
                    "control": r[i_ctrl].strip(),  # 1 public 2 private np 3 for-profit
                })
    # Branch campuses can share name/state/site/control verbatim in HD2024;
    # the pool keeps one row per distinct tuple.
    csv_rows = [json.loads(j) for j in {
        json.dumps(r, sort_keys=True, ensure_ascii=False) for r in csv_rows
    }]
    csv_rows.sort(key=lambda r: (r["state"], r["name"].lower()))
    return write_pool("ipeds",
                      {"notes": ("HD2024 institution directory "
                                 "(deduped to name/state/site/control tuples); "
                                 "control: 1 public, 2 private nonprofit, "
                                 "3 private for-profit")}, csv_rows)


class _AgenciesParser(HTMLParser):
    """Collect the agency names from usa.gov/federal-agencies."""

    def __init__(self):
        super().__init__()
        self._in_item = False
        self._buf: list[str] = []
        self.names: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "h2":
            self._in_item = True
            self._buf = []

    def handle_endtag(self, tag):
        if tag == "h2" and self._in_item:
            name = re.sub(r"\s+", " ", " ".join(self._buf)).strip()
            if name:
                self.names.append(name)
            self._in_item = False

    def handle_data(self, data):
        if self._in_item:
            self._buf.append(data)


def capture_fed() -> Path:
    html = fetch(SOURCES["fed"]["url"]).decode("utf-8", "replace")
    parser = _AgenciesParser()
    parser.feed(html)
    seen = set()
    rows = []
    for n in parser.names:
        if n in seen:
            continue
        seen.add(n)
        rows.append({"kind": "fed", "name": n})
    return write_pool("fed",
                      {"notes": "Agency names parsed from the A–Z roster"},
                      rows)


CAPTURE = {"counties": capture_counties, "ipeds": capture_ipeds,
           "fed": capture_fed}


def read_pool(pool: str) -> list:
    path = POOL_DIR / f"{pool}.jsonl"
    if not path.exists():
        print(f"[pools] MISSING: {path}  (run capture {pool})")
        return []
    with path.open(encoding="utf-8") as f:
        lines = [json.loads(l) for l in f if l.strip()]
    return lines


def check(pool: str) -> bool:
    lines = read_pool(pool)
    if not lines:
        return False
    prov, rows = lines[0], lines[1:]
    ok = True
    for k in ("pool", "source", "license", "captured"):
        if k not in prov.get("_provenance", {}):
            print(f"[pools] {pool}: provenance missing {k}")
            ok = False
    kinds = {r.get("kind") == pool for r in rows}
    if kinds != {True}:
        print(f"[pools] {pool}: bad/missing kind fields")
        ok = False
    dupes = len(rows) - len({json.dumps(r, sort_keys=True) for r in rows})
    if dupes:
        print(f"[pools] {pool}: {dupes} duplicate rows")
        ok = False
    print(f"[pools] {pool}: {len(rows)} rows, source "
          f"{prov['_provenance'].get('source')} "
          f"captured {prov['_provenance'].get('captured')}  "
          f"{'PASS' if ok else 'FAIL'}")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("command", nargs="?", choices=["capture", "check"])
    ap.add_argument("pool", nargs="?", choices=sorted(SOURCES) + ["all"])
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    if args.command == "check" or args.check:
        targets = sorted(SOURCES) if (not args.pool or args.pool == "all") \
            else [args.pool]
        return 0 if all(check(t) for t in targets) else 1
    if args.command == "capture":
        path = CAPTURE[args.pool]()
        print(f"[pools] wrote {path}")
        return 0 if check(args.pool) else 1
    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
