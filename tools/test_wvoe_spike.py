#!/usr/bin/env python3
"""Headed M1 spike test: wvoe.html generates + downloads a filled WVOE PDF.

Phase 2 milestone M1 exit criterion (PHASE2-WVOE-form.md): the vendored
@pdfme/generator bundle, loaded from an extension page under the MV3 CSP,
produces the bundled WVOE template filled with hardcoded values, and the
result downloads as a PDF. The PDF is re-read with pdftotext and every
hardcoded field string must be present.

Run:  DISPLAY=:1 python3 tools/test_wvoe_spike.py
Exit 0 = spike passed. Runs Chrome for Testing (supports --load-extension),
so no developerPrivate/file-chooser dance is needed here.
"""
import asyncio
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parent.parent
CFT_BIN = ROOT / "tools" / "cft" / "chrome-linux64" / "chrome"
DEBUG_PORT = 9223
PROFILE = Path("/tmp/wvoe-spike-profile")
DL_DIR = Path("/tmp/wvoe-spike-downloads")
PAGE_EXT_PATH = "/wvoe.html"


def log(*a):
    print("[wvoe-spike]", *a, flush=True)


def start_chrome():
    if PROFILE.exists():
        shutil.rmtree(PROFILE)
    DL_DIR.mkdir(parents=True, exist_ok=True)
    # Pin the download dir via profile prefs — Browser.setDownloadBehavior is
    # unreliable for extension-page anchor downloads on this Chrome build.
    prefs = PROFILE / "Default" / "Preferences"
    prefs.parent.mkdir(parents=True, exist_ok=True)
    prefs.write_text(json.dumps({
        "download": {"default_directory": str(DL_DIR), "prompt_for_download": False},
        "profile": {"default_content_setting_values": {"automatic_downloads": 1}},
    }))
    args = [str(CFT_BIN), "--ozone-platform=x11",
            f"--load-extension={ROOT}",
            f"--remote-debugging-port={DEBUG_PORT}",
            f"--user-data-dir={PROFILE}",
            "--no-first-run", "--no-default-browser-check",
            "--window-position=40,40", "--window-size=1100,760"]
    import os
    env = dict(os.environ)
    env.setdefault("DISPLAY", ":1")
    env.pop("WAYLAND_DISPLAY", None)
    env.pop("XDG_CURRENT_DESKTOP", None)
    env["GTK_USE_PORTAL"] = "0"
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json/version", timeout=1).read()
            return proc
        except Exception:
            time.sleep(0.5)
    proc.kill()
    raise RuntimeError("chrome debug port never came up")


def targets():
    return json.loads(urllib.request.urlopen(
        f"http://127.0.0.1:{DEBUG_PORT}/json", timeout=5).read())


class Session:
    def __init__(self, ws):
        self.ws = ws
        self.ids = __import__("itertools").count(1)

    async def rpc(self, method, params=None):
        rid = next(self.ids)
        await self.ws.send(json.dumps({"id": rid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") == rid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg["result"]

    async def evaluate(self, expr):
        r = await self.rpc("Runtime.evaluate",
                           {"expression": expr, "awaitPromise": True, "returnByValue": True})
        if "exceptionDetails" in r:
            raise RuntimeError("evaluate failed: " + json.dumps(r["exceptionDetails"])[:400])
        return r["result"].get("value")

    async def __aenter__(self):
        self.ws = await self.ws
        return self

    async def __aexit__(self, *exc):
        await self.ws.close()


async def main():
    failures = []
    chrome = None
    try:
        chrome = start_chrome()
        time.sleep(2)

        # Extension ID from its service-worker target, then open wvoe.html as a tab.
        sw = next((t for t in targets() if t["type"] == "service_worker"
                   and t["url"].startswith("chrome-extension://")), None)
        if not sw:
            raise RuntimeError("extension service worker target not found")
        ext_id = sw["url"].split("/")[2]
        log("extension id:", ext_id)

        browser_ws = json.loads(urllib.request.urlopen(
            f"http://127.0.0.1:{DEBUG_PORT}/json/version", timeout=5).read())["webSocketDebuggerUrl"]
        async with Session(websockets.connect(browser_ws, max_size=16 * 1024 * 1024)) as b:
            await b.rpc("Target.createTarget",
                        {"url": f"chrome-extension://{ext_id}{PAGE_EXT_PATH}"})
        time.sleep(1.5)
        page = next((t for t in targets() if t["type"] == "page" and PAGE_EXT_PATH in t["url"]), None)
        if not page:
            raise RuntimeError("wvoe.html page target never opened")

        async with Session(websockets.connect(page["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s:
            await s.rpc("Runtime.enable")
            # CSP probe first: extension page must have loaded both scripts.
            state = await s.evaluate(
                "document.getElementById('status').dataset.state + '|' "
                "+ String(typeof window.pdfmeGenerate)")
            log("page state before click:", state)
            if state != "idle|function":
                failures.append(f"page did not come up clean: {state}")

            await s.evaluate("document.getElementById('generate').click()")
            for _ in range(60):
                st = await s.evaluate(
                    "document.getElementById('status').dataset.state + '|' "
                    "+ document.getElementById('status').textContent")
                if st.split("|")[0] in ("ok", "error"):
                    break
                await asyncio.sleep(0.5)
            log("final status:", st)
            if not st.startswith("ok|"):
                failures.append(f"generate did not succeed: {st}")

        for _ in range(30):
            pdfs = list(DL_DIR.glob("voe-wvoe*.pdf"))
            if not pdfs:  # fallback: the real default Downloads dir
                import pathlib
                pdfs = list(pathlib.Path.home().glob("Downloads/voe-wvoe*.pdf"))
            if pdfs:
                break
            await asyncio.sleep(0.5)
        if not pdfs:
            failures.append("no voe-wvoe*.pdf landed in the download dir")
        else:
            pdf = pdfs[0]
            size = pdf.stat().st_size
            log("downloaded:", pdf.name, size, "bytes")
            if size < 1000:
                failures.append(f"pdf suspiciously small: {size}")
            text = subprocess.run(["pdftotext", str(pdf), "-"],
                                  capture_output=True, text=True).stdout
            for needle in ["Date: 2026-10-23",
                           "Employer: Walmart",
                           "Employer Code: 10108",
                           "The Work Number",
                           "Spuds Lending LLC",
                           "702 SW 8th St"]:
                if needle not in text:
                    failures.append(f"pdftotext missing field: {needle!r}")
            log("pdftotext verification:", "FAILURES" if failures else "all fields present")

    except Exception as exc:
        failures.append(f"unhandled: {exc}")
    finally:
        if chrome:
            chrome.kill()
        shutil.rmtree(PROFILE, ignore_errors=True)

    if failures:
        for f in failures:
            log("FAIL:", f)
        return 1
    log("WVOE M1 SPIKE PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
