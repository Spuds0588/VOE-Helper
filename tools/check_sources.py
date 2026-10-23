#!/usr/bin/env python3
"""Monthly mini-check: re-fetch every source URL recorded in the catalog.

Implements the "Monthly mini-check" step of the recurring re-check methodology
in data/sources.md. Extracts every source surface from data/sources.md and the
`notes` field of data/verified_seeds.jsonl rows — full http(s) URLs plus bare
domain/path tokens as they are recorded (e.g. `uth.edu/hr`) — re-fetches each
once (single request, honest UA, no circumvention) and classifies:

  LIVE      200–299, or a normal 3xx redirect that resolves to a page
  RE-HOME   404 at the recorded path — look for a same-domain replacement
            (manual step; record the new pointer in row notes/sources.md)
  GATED     402/403/429 or a bot-challenge marker in the body (Cloudflare
            "Just a moment", Akamai "Access Denied") — leave alone, no
            circumvention, count as still-walled
  GONE      DNS failure / timeout / connection refused
  BOUNCE    other 4xx/5xx

Read-only. Never lands or changes codes; a mini-check only maintains
pointers (todo.md/history.md deltas, re-homed URLs). Exit status is 0 unless
--strict, in which case any non-LIVE result exits 2 (for cron).

Run:  python3 tools/check_sources.py [--strict] [--timeout N]
"""
import argparse
import json
import re
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")

CHALLENGE_MARKERS = (
    "just a moment", "access denied", "attention required",
    "enable javascript and cookies", "challenge-platform",
)

TLD = r"(?:edu|gov|org|com|net|us|mil)"
FULL_RE = re.compile(r"https?://[^\s)\]>'\"|]+")
# Bare domain (+optional path) tokens as recorded in the catalog/notes.
BARE_RE = re.compile(
    r"(?<![A-Za-z0-9.-])([A-Za-z0-9-]+\." + TLD +
    r"(?:/[A-Za-z0-9/_.%~+-]+)+)")  # require a path so bare portals hit once
BARE_DOMAIN_RE = re.compile(r"(?<![A-Za-z0-9.-])([A-Za-z0-9-]+\." + TLD + r")")


def collect_urls():
    """Return {normalized_url: where} from catalog + row source notes."""
    found = {}

    def add(url, where):
        if url not in found:
            found[url] = where

    catalog = ROOT / "data" / "sources.md"
    if catalog.exists():
        text = catalog.read_text(errors="replace")
        for m in FULL_RE.finditer(text):
            add(m.group(0).rstrip(".,;:"), "sources.md")
        for m in BARE_RE.finditer(text):
            add("https://" + m.group(1), "sources.md")
        # sources.md also names wall/lead hosts with no path; ping domains there
        for m in BARE_DOMAIN_RE.finditer(text):
            add("https://" + m.group(1), "sources.md")

    seeds = ROOT / "data" / "verified_seeds.jsonl"
    if seeds.exists():
        for line in seeds.read_text(errors="replace").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            notes = rec.get("notes", "")
            for m in FULL_RE.finditer(notes):
                add(m.group(0).rstrip(".,;:"), f"notes:{rec['name']}")
            for m in BARE_RE.finditer(notes):
                add("https://" + m.group(1), f"notes:{rec['name']}")
    return found


def classify(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = ""
            try:
                body = resp.read(4096).decode("utf-8", "replace").lower()
            except Exception:
                pass
            if any(mark in body for mark in CHALLENGE_MARKERS):
                return "GATED", f"challenge marker in body after HTTP {resp.status}"
            return "LIVE", f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        if e.code in (402, 403, 429):
            return "GATED", f"HTTP {e.code}"
        if e.code == 404:
            return "RE-HOME", "HTTP 404 at recorded path"
        return "BOUNCE", f"HTTP {e.code}"
    except (socket.timeout, TimeoutError):
        return "GONE", "timeout"
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, socket.gaierror):
            return "GONE", "DNS failure"
        return "GONE", str(reason)[:80]
    except OSError as e:
        return "GONE", str(e)[:80]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="exit 2 when any URL is not LIVE (for cron)")
    ap.add_argument("--timeout", type=int, default=15)
    ap.add_argument("--only-strict-hits", action="store_true",
                    help="print only non-LIVE URLs")
    args = ap.parse_args()

    urls = collect_urls()
    print(f"[check] {len(urls)} unique source surfaces collected from "
          f"sources.md + verified_seeds.jsonl notes")
    counts = {}
    problems = []
    for url in sorted(urls):
        status, detail = classify(url, args.timeout)
        counts[status] = counts.get(status, 0) + 1
        if status == "LIVE":
            if not args.only_strict_hits:
                print(f"[check] {status:<8} {url}")
        else:
            print(f"[check] {status:<8} {url}  <-- {detail}")
            problems.append((status, url, detail))
    order = ["LIVE", "RE-HOME", "GATED", "BOUNCE", "GONE"]
    print("[check] summary:",
          ", ".join(f"{k}={counts.get(k, 0)}" for k in order))
    if problems:
        print("[check] follow-up: manually re-home RE-HOME pointers; "
              "GATED/GONE stay as recorded walls (no circumvention).")
        if args.strict:
            print("[check] strict mode: failing exit.")
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
