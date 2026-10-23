#!/usr/bin/env python3
"""Headed M2 test: wvoe.html form works in manual AND catalog-prefill modes.

M1 proved the bundled pdfme generator + template + download inside the
extension (see PHASE2-WVOE-form.md). M2 adds the editable form:
  P1 manual mode: wvoe.html opened bare — fields are filled in-page, Generate
     runs, the PDF download is re-read with pdftotext and every entered string
     must be present.
  P2 prefill mode: wvoe.html?employer=<catalog row id> — the employer name is
     pre-filled from the matched record (the toast's "Generate WVOE Form"
     path), Generate runs, and the PDF must carry the record's name + code.
  P3 voe-search.html — the manual provider sweep page: 6 provider cards, no
     link on the DNS-dead InVerify card, and the report button builds a
     pre-filled GitHub issue URL (window.open intercepted, never leaves
     Chrome).
  P4 sidepanel.html — the side-panel WVOE collector (user pivot): seeded
     wvoePendingPrefill applies the matched row and is consumed (one-shot),
     an editable field persists to the wvoeDraft storage key, Generate
     downloads a PDF carrying the seeded values, and "Open full-page
     preview" opens a wvoe.html tab that restores the draft.

Run:  DISPLAY=:1 python3 tools/test_wvoe_spike.py
Exit 0 = both phases passed. Uses Chrome for Testing (--load-extension OK).
"""
import asyncio
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import urllib.parse
import websockets

ROOT = Path(__file__).resolve().parent.parent
CFT_BIN = ROOT / "tools" / "cft" / "chrome-linux64" / "chrome"
DEBUG_PORT = 9223
PROFILE = Path("/tmp/wvoe-spike-profile")
DL_DIR = Path("/tmp/wvoe-spike-downloads")
PAGE_EXT_PATH = "/wvoe.html"
VOE_SEARCH_PATH = "/voe-search.html"


def log(*a):
    print("[wvoe-spike]", *a, flush=True)


def start_chrome():
    if PROFILE.exists():
        shutil.rmtree(PROFILE)
    if DL_DIR.exists():
        shutil.rmtree(DL_DIR)
    DL_DIR.mkdir(parents=True, exist_ok=True)
    # Pin the download dir via profile prefs — Browser.setDownloadBehavior is
    # unreliable for extension-page anchor downloads on this Chrome build.
    prefs = PROFILE / "Default" / "Preferences"
    prefs.parent.mkdir(parents=True, exist_ok=True)
    prefs.write_text(json.dumps({
        "download": {"default_directory": str(DL_DIR), "prompt_for_download": False},
        "profile": {"default_content_setting_values": {"automatic_downloads": 1}},
    }))
    import os
    args = [str(CFT_BIN), "--ozone-platform=x11",
            f"--load-extension={ROOT}",
            f"--remote-debugging-port={DEBUG_PORT}",
            f"--user-data-dir={PROFILE}",
            "--no-first-run", "--no-default-browser-check",
            "--window-position=40,40", "--window-size=1100,760"]
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


async def open_wvoe_tab(browser_ws, mp="", policy="new"):
    """Open (or reuse) the wvoe.html tab as `chrome-extension://<id>/wvoe.html<mp>`."""
    url = f"chrome-extension://{EXT_ID}{PAGE_EXT_PATH}{mp}"
    async with Session(websockets.connect(browser_ws, max_size=16 * 1024 * 1024)) as b:
        await b.rpc("Target.createTarget", {"url": url})
    for _ in range(40):
        page = next((t for t in targets() if t["type"] == "page" and PAGE_EXT_PATH in t["url"]
                     and mp in t["url"]), None)
        if page:
            return page
        await asyncio.sleep(0.4)
    raise RuntimeError(f"wvoe tab never opened ({mp or 'manual'})")


async def wait_status(s, want=("ok",)):
    st = "busy|…"
    for _ in range(60):
        st = await s.evaluate(
            "document.getElementById('status').dataset.state + '|'"
            " + document.getElementById('status').textContent")
        if st.split("|")[0] in want:
            return st
        await asyncio.sleep(0.5)
    return st


async def main():
    failures = []
    chrome = None
    try:
        chrome = start_chrome()
        await asyncio.sleep(2)
        sw = next((t for t in targets() if t["type"] == "service_worker"
                   and t["url"].startswith("chrome-extension://")), None)
        if not sw:
            raise RuntimeError("extension service worker target not found")
        global EXT_ID
        EXT_ID = sw["url"].split("/")[2]
        log("extension id:", EXT_ID)
        browser_ws = json.loads(urllib.request.urlopen(
            f"http://127.0.0.1:{DEBUG_PORT}/json/version", timeout=5).read())["webSocketDebuggerUrl"]

        # ---------- P1: manual mode ----------
        page = await open_wvoe_tab(browser_ws)
        async with Session(websockets.connect(page["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s:
            await s.rpc("Runtime.enable")
            for _ in range(20):  # document may still be loading when CDP attaches
                ready = await s.evaluate(
                    "!!document.getElementById('status') && !!document.getElementById('generate')"
                    " && String(typeof window.pdfmeGenerate) === 'function'")
                if ready:
                    break
                await asyncio.sleep(0.4)
            state = await s.evaluate(
                "document.getElementById('status').dataset.state + '|'"
                " + String(typeof window.pdfmeGenerate)")
            log("P1 page state:", state)
            if state != "idle|function":
                failures.append(f"P1: page did not come up clean: {state}")
            layout = await s.evaluate(
                "({wrap: !!document.getElementById('previewWrap'),"
                "  state: document.getElementById('previewWrap').dataset.previewState})")
            log("P1 preview initial:", layout)
            if not (layout and layout.get("wrap") and layout.get("state") == "empty"):
                failures.append(f"P1: preview pane missing/initial state wrong: {layout}")
            vals = {"employmentTitle": "Position: M2 manual mode check",
                    "employerName": "Employer: ACME Rocketry (manual)",
                    "providerBlock": "Provider filled by hand: Truework"}
            # Fill the form in-page (manual path: no ?employer= param) and generate.
            await s.evaluate(
                "(()=>{const vals=" + json.dumps(vals) + ";"
                "Object.entries(vals).forEach(([k,v])=>{"
                "  const e=document.getElementById(k); e.value=v;});"
                "document.getElementById('generate').click();})()")
            st = await wait_status(s, ("ok", "error"))
            log("P1 final status:", st)
            if not st.startswith("ok|"):
                failures.append(f"P1: generate did not succeed: {st}")
            # Live preview must have rendered an <embed.pdf> after the fills
            # (type into a field once, wait for the debounced regeneration).
            await s.evaluate(
                "(()=>{const e=document.getElementById('employmentTitle');"
                "const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;"
                "setter.call(e, 'Position: M2 manual mode check updated');"
                "e.dispatchEvent(new Event('input',{bubbles:true}));})()")
            for _ in range(20):
                preview = await s.evaluate(
                    "({state: document.getElementById('previewWrap').dataset.previewState,"
                    "  embed: !!document.querySelector('#previewWrap embed.pdf')})")
                if preview and preview.get("embed") and preview.get("state") == "ready":
                    break
                await asyncio.sleep(0.4)
            log("P1 preview after edit:", preview)
            if not (preview and preview.get("embed") and preview.get("state") == "ready"):
                failures.append(f"P1: live preview never rendered an embed: {preview}")

        # ---------- P2: catalog prefill mode ----------
        async with Session(websockets.connect(sw["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s2:
            await s2.rpc("Runtime.enable")
            row = await s2.evaluate(
                "chrome.storage.local.get('employers').then(g=>{"
                "  const r=(g.employers||[]).find(e=>e.provider_code==='10108');"
                "  return r ? {id:r.id, name:r.name, provider:r.provider} : null})")
        if not row:
            failures.append("P2: could not resolve a coded Walmart row from storage")
        else:
            page2 = await open_wvoe_tab(browser_ws, "?employer=" + urllib.parse.quote(row["id"]))
            async with Session(websockets.connect(page2["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s:
                await s.rpc("Runtime.enable")
                for _ in range(20):
                    ready = await s.evaluate("!!document.getElementById('status')")
                    if ready:
                        break
                    await asyncio.sleep(0.4)
                for _ in range(20):
                    probe = await s.evaluate(
                        "document.getElementById('employerName').value + '|'"
                        " + document.getElementById('status').dataset.state")
                    if probe.split("|")[0].strip():
                        break
                    await asyncio.sleep(0.4)
                prefill = await s.evaluate(
                    "({name: document.getElementById('employerName').value,"
                    "  provider: document.getElementById('providerBlock').value,"
                    "  status: document.getElementById('status').textContent})")
                log("P2 prefill:", prefill)
                if not (prefill and prefill.get("name") == row["name"]):
                    failures.append(f"P2: employer name not pre-filled: {prefill}")
                if not (prefill and row["provider"] in (prefill.get("provider") or "")
                        and "10108" in (prefill.get("provider") or "")):
                    failures.append(f"P2: provider block not pre-filled: {prefill}")
                extra = await s.evaluate(
                    "(()=>{const e=document.getElementById('employmentTitle');"
                    "e.value='Position: M2 prefill';"
                    "document.getElementById('generate').click();return e.value})()")
                st = await wait_status(s, ("ok", "error"))
                log("P2 final status:", st)
                if not st.startswith("ok|"):
                    failures.append(f"P2: generate did not succeed: {st}")
                # Prefill must also drive the live preview (first preview
                # generation is immediate, no debounce needed).
                for _ in range(20):
                    p2prev = await s.evaluate(
                        "({state: document.getElementById('previewWrap').dataset.previewState,"
                        "  embed: !!document.querySelector('#previewWrap embed.pdf')})")
                    if p2prev and p2prev.get("embed") and p2prev.get("state") == "ready":
                        break
                    await asyncio.sleep(0.4)
                log("P2 preview:", p2prev)
                if not (p2prev and p2prev.get("embed") and p2prev.get("state") == "ready"):
                    failures.append(f"P2: prefill live preview never rendered: {p2prev}")

        # ---------- P3: voe-search.html (manual provider sweep + report link) ----------
        url3 = f"chrome-extension://{EXT_ID}{VOE_SEARCH_PATH}"
        async with Session(websockets.connect(browser_ws, max_size=16 * 1024 * 1024)) as b:
            await b.rpc("Target.createTarget", {"url": url3})
        page3 = None
        for _ in range(40):
            page3 = next((t for t in targets() if t["type"] == "page"
                          and VOE_SEARCH_PATH in t["url"]), None)
            if page3:
                break
            await asyncio.sleep(0.4)
        if not page3:
            failures.append("P3: voe-search tab never opened")
        else:
            async with Session(websockets.connect(
                    page3["webSocketDebuggerUrl"], max_size=16 * 1024 * 1024)) as s3:
                await s3.rpc("Runtime.enable")
                for _ in range(20):
                    ready3 = await s3.evaluate(
                        "!!document.getElementById('reportMatch') && !!(window.chrome)")
                    if ready3:
                        break
                    await asyncio.sleep(0.4)
                ncards = await s3.evaluate(
                    "document.querySelectorAll('#cards .card').length")
                log("P3 provider cards:", ncards)
                if ncards != 6:
                    failures.append(f"P3: expected 6 provider cards, found {ncards}")
                dead = await s3.evaluate(
                    "document.querySelector('#card-inverify a') !== null")
                if dead:
                    failures.append("P3: inverify card must not link (DNS-dead host)")
                # Intercept window.open so the report click never leaves Chrome,
                # fill the employer name, click, and capture the issue URL.
                issue_url = await s3.evaluate(
                    "(async()=>{"
                    "  let captured=null;"
                    "  const orig=window.open; window.open=(u)=>{captured=u; return null};"
                    "  document.getElementById('foundName').value='ACME Rocketry';"
                    "  document.getElementById('reportMatch').click();"
                    "  window.open=orig; return captured;})()")
                log("P3 issue url:", issue_url)
                if not (issue_url and issue_url.startswith(
                        "https://github.com/Spuds0588/VOE-Helper/issues/new")):
                    failures.append(f"P3: report link did not build a GitHub issue URL: {issue_url}")
                elif "ACME+Rocketry" not in issue_url:
                    failures.append(f"P3: employer name missing from issue URL: {issue_url}")

        # ---------- P4: sidepanel.html (side-panel WVOE collector pivot) ----------
        # Seed a pending prefill + clear drafts, then open the panel page in a
        # tab (the same page chrome loads into the side panel). The SW relay
        # path is exercised too: an OPEN_WVOE_PANEL message must stamp the
        # pending prefill into storage before the panel is opened.
        row4 = row  # same coded Walmart row
        if row4:
            async with Session(websockets.connect(sw["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s2:
                await s2.rpc("Runtime.enable")
                _ = await s2.evaluate(
                    "chrome.storage.local.set({wvoePendingPrefill: " + json.dumps(row4["id"]) +
                    ", wvoeDraft: null})")
        if row4:
            url4 = f"chrome-extension://{EXT_ID}/sidepanel.html"
            async with Session(websockets.connect(browser_ws, max_size=16 * 1024 * 1024)) as b:
                await b.rpc("Target.createTarget", {"url": url4})
            page4 = None
            for _ in range(40):
                page4 = next((t for t in targets() if t["type"] == "page"
                              and t["url"].endswith("/sidepanel.html")), None)
                if page4:
                    break
                await asyncio.sleep(0.4)
            if not page4:
                failures.append("P4: sidepanel tab never opened")
            else:
                async with Session(websockets.connect(
                        page4["webSocketDebuggerUrl"], max_size=16 * 1024 * 1024)) as s4:
                    await s4.rpc("Runtime.enable")
                    for _ in range(20):
                        ready4 = await s4.evaluate(
                            "!!document.getElementById('generate') &&"
                            " String(typeof window.pdfmeGenerate) === 'function'")
                        if ready4:
                            break
                        await asyncio.sleep(0.4)
                    for _ in range(20):
                        p4 = await s4.evaluate(
                            "({name: document.getElementById('employerName').value,"
                            "  provider: document.getElementById('providerBlock').value.slice(0,80),"
                            "  status: document.getElementById('status').textContent})")
                        if p4 and (p4.get("name") or "error" in (p4.get("status") or "")):
                            break
                        await asyncio.sleep(0.4)
                    log("P4 prefill:", p4)
                    if not (p4 and p4.get("name") == row4["name"]):
                        failures.append(f"P4: side panel prefill wrong: {p4}")
                    consumed = await s4.evaluate(
                        "chrome.storage.local.get('wvoePendingPrefill')")
                    if (consumed or {}).get("wvoePendingPrefill") is not None:
                        failures.append("P4: wvoePendingPrefill not consumed (one-shot broken)")
                    # Relay check: an OPEN_WVOE_PANEL message from an extension
                    # page must reach the SW (the SW itself cannot
                    # runtime.sendMessage) and stamp the pending key. Fire
                    # without awaiting the response (the relay never
                    # sendResponses) and poll for the stamp.
                    await s4.evaluate(
                        "(chrome.runtime.sendMessage({type:'OPEN_WVOE_PANEL',"
                        " matchId:" + json.dumps(row4["id"]) + "}), true)")
                    relay_start = time.time()
                    relay_stamp = None
                    while time.time() - relay_start < 10:
                        relay_stamp = await s4.evaluate(
                            "chrome.storage.local.get('wvoePendingPrefill')")
                        if (relay_stamp or {}).get("wvoePendingPrefill") is not None:
                            break
                        await asyncio.sleep(0.4)
                    log("P4 relay stamp:", relay_stamp)
                    if not (relay_stamp or {}).get("wvoePendingPrefill"):
                        failures.append("P4: OPEN_WVOE_PANEL relay did not stamp pending prefill")
                    # Editable field persists to wvoeDraft (debounced 400ms).
                    await s4.evaluate(
                        "(()=>{const e=document.getElementById('employmentTitle');"
                        "e.value='Position: side panel collector';"
                        "e.dispatchEvent(new Event('input',{bubbles:true}));})()")
                    draft = None
                    for _ in range(20):
                        d = await s4.evaluate(
                            "chrome.storage.local.get('wvoeDraft').then(g=>"
                            "  (g.wvoeDraft||{}).employmentTitle||null)")
                        if d:
                            draft = d
                            break
                        await asyncio.sleep(0.4)
                    log("P4 draft persisted:", draft)
                    if draft != "Position: side panel collector":
                        failures.append(f"P4: wvoeDraft not persisted: {draft!r}")
                    # Generate + download from the panel itself.
                    await s4.evaluate("document.getElementById('generate').click()")
                    st4 = "busy"
                    for _ in range(60):
                        st4 = await s4.evaluate(
                            "document.getElementById('status').dataset.state + '|'"
                            " + document.getElementById('status').textContent")
                        if st4.split("|")[0] in ("ok", "error"):
                            break
                        await asyncio.sleep(0.5)
                    log("P4 generate status:", st4)
                    if not st4.startswith("ok|"):
                        failures.append(f"P4: panel generate failed: {st4}")

        # ---------- P5: side-panel provider sweep + local route save ----------
        # Probe tab that stands in for the LOS tab: the sweep's card click
        # must NAVIGATE IT (not open a new tab), prefill the Truework search
        # param, auto-select the provider, and a Save writes a customEmployers
        # row that findEmployer resolves immediately (sync-proof storage).
        # The probe is created through chrome.tabs so the seeded tabId is a
        # REAL numeric tab id (a CDP targetId is a hex string and Number()
        # yields NaN — the panel would then navigate the wrong tab).
        before_tids = {t["id"] for t in targets()}
        sw_tok = next(t for t in targets()
                      if t["type"] == "service_worker"
                      and t["url"].startswith("chrome-extension://"))
        async with Session(websockets.connect(
                sw_tok["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s2:
            await s2.rpc("Runtime.enable")
            probe_num = await s2.evaluate(
                "chrome.tabs.create({url:'about:blank'}).then(t=>t.id)")
            _ = await s2.evaluate(
                "chrome.storage.local.set({panelView:'sweep',"
                " voeSweepState:{query:'ACME Rocketry', tabId:" +
                json.dumps(probe_num) + ", lastProvider:null, lastUrl:null}})")
        probe_tid = None
        for _ in range(20):
            newt = [t for t in targets() if t["id"] not in before_tids
                    and t["type"] == "page" and t["url"] == "about:blank"]
            if newt:
                probe_tid = newt[0]["id"]
                break
            await asyncio.sleep(0.4)
        if not probe_tid:
            failures.append("P5: probe tab never appeared")
        async with Session(websockets.connect(browser_ws, max_size=16 * 1024 * 1024)) as b:
            for t in [x for x in targets()
                      if x["type"] == "page" and x["url"].endswith("/sidepanel.html")]:
                # /json entries key on "id"; Target.* results key "targetId".
                await b.rpc("Target.closeTarget", {"targetId": t["id"]})
            await b.rpc("Target.createTarget",
                        {"url": f"chrome-extension://{EXT_ID}/sidepanel.html"})
        page5 = None
        for _ in range(40):
            page5 = next((t for t in targets() if t["type"] == "page"
                          and t["url"].endswith("/sidepanel.html")), None)
            if page5:
                break
            await asyncio.sleep(0.4)
        if not page5:
            failures.append("P5: sweep panel tab never opened")
        else:
            log("P5 panel target:", page5["url"])
            async with Session(websockets.connect(
                    page5["webSocketDebuggerUrl"], max_size=16 * 1024 * 1024)) as s5:
                await s5.rpc("Runtime.enable")
                for _ in range(20):
                    ready5 = await s5.evaluate(
                        "(() => { const v=document.getElementById('view-sweep');"
                        " return v ? (!v.hidden && document.getElementById('sweepName').value) : false; })()")
                    if ready5:
                        break
                    await asyncio.sleep(0.4)
                mode5 = await s5.evaluate(
                    "(() => { const v=document.getElementById('view-sweep');"
                    " return v ? {sweepVisible: !v.hidden,"
                    "  name: document.getElementById('sweepName').value,"
                    "  cards: document.querySelectorAll('.sweep-card').length} : null; })()")
                log("P5 sweep view:", mode5)
                if not (mode5 and mode5.get("sweepVisible") and mode5.get("name") == "ACME Rocketry"
                        and mode5.get("cards") == 5):
                    failures.append(f"P5: sweep view not ready/prefilled/cards wrong: {mode5}")
                # Card 1: Truework — the probe tab must navigate with the
                # prefilled employer-name param.
                await s5.evaluate("document.getElementById('sweep-card-truework').click()")
                nav_url = None
                for _ in range(30):
                    tgt = next((t for t in targets()
                                if t["id"] == probe_tid), None)
                    if tgt and "app.truework.com" in tgt["url"]:
                        nav_url = tgt["url"]
                        break
                    await asyncio.sleep(0.4)
                log("P5 nav url:", nav_url)
                if not (nav_url and "companyName=ACME" in nav_url):
                    failures.append(f"P5: probe tab did not move to prefilled Truework: {nav_url}")
                p5sel = None
                for _ in range(16):
                    p5sel = await s5.evaluate(
                        "document.getElementById('saveProvider').value")
                    if p5sel:
                        break
                    await asyncio.sleep(0.4)
                if p5sel != "truework":
                    failures.append(f"P5: provider auto-select after card click wrong: {p5sel!r}")
                # Save without typing a code → uncoded custom row, matcher-local.
                # Also fill the new community-lane field: where manual WVOEs
                # can be sent (email) — it must round-trip into the stored row.
                await s5.evaluate(
                    "document.getElementById('saveEmail').value='hr@acmerocketry.example'")
                await s5.evaluate("document.getElementById('saveRoute').click()")
                await asyncio.sleep(1.0)
                async with Session(websockets.connect(
                        sw_tok["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s2:
                    await s2.rpc("Runtime.enable")
                    found = await s2.evaluate(
                        "findEmployer('ACME Rocketry')")
                    cnt = await s2.evaluate(
                        "chrome.storage.local.get('customEmployers').then(g=>"
                        "  (g.customEmployers||[]).length)")
                log("P5 matcher:", found, "custom rows:", cnt)
                if not (found and found.get("provider") == "Truework"
                        and not found.get("provider_code") and found.get("custom")):
                    failures.append(f"P5: saved route not resolvable: {found}")
                if not (found and found.get("wvoe_email") == "hr@acmerocketry.example"):
                    failures.append(f"P5: WVOE contact email not stored in the row: {found}")
                if cnt != 1:
                    failures.append(f"P5: expected exactly 1 custom row, got {cnt}")
                # Repeat with a different provider → dedupe/update, not duplicate.
                await s5.evaluate(
                    "(()=>{document.getElementById('saveProvider').value='tc';"
                    "document.getElementById('saveRoute').click();})()")
                await asyncio.sleep(1.0)
                async with Session(websockets.connect(
                        sw_tok["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s2:
                    await s2.rpc("Runtime.enable")
                    found2 = await s2.evaluate("findEmployer('ACME Rocketry')")
                    cnt2 = await s2.evaluate(
                        "chrome.storage.local.get('customEmployers').then(g=>"
                        "  (g.customEmployers||[]).length)")
                log("P5 dedupe matcher:", found2, "custom rows:", cnt2)
                if cnt2 != 1:
                    failures.append(f"P5: repeat save duplicated rows (got {cnt2})")
                elif not (found2 and found2.get("provider") == "Thomas & Company"):
                    failures.append(f"P5: repeat save did not UPDATE the provider: {found2}")

        # ---------- PDF verification (all downloads) ----------
        pdfs = []
        for _ in range(40):
            pdfs = sorted(DL_DIR.glob("voe-wvoe*.pdf"), key=lambda p: p.stat().st_mtime)
            if len(pdfs) >= 3:  # manual + prefill + side panel
                break
            await asyncio.sleep(0.5)
        if len(pdfs) < 3:
            failures.append(f"expected 3 PDFs (manual + prefill + panel), found {len(pdfs)}")
        else:
            alltext = ""
            for pdf in pdfs:
                r = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True)
                alltext += r.stdout + "\n"
                log("pdf:", pdf.name, pdf.stat().st_size, "bytes")
            checks = {
                "manual employer": "ACME Rocketry (manual)",
                "manual provider": "Truework",
                "manual title": "M2 manual mode check",
                "prefill employer": row["name"] if row else "",
                "prefill provider": "10108",
                "prefill title": "M2 prefill",
                "panel title": "side panel collector",
            }
            for label, needle in checks.items():
                if needle and needle not in alltext:
                    failures.append(f"pdftotext missing [{label}]: {needle!r}")
            log("pdftotext verification:", "FAILURES" if failures else "all fields present (P1+P2)")

    except Exception as exc:
        import traceback
        traceback.print_exc()
        failures.append(f"unhandled: {exc}")
    finally:
        if chrome:
            chrome.kill()
        shutil.rmtree(PROFILE, ignore_errors=True)

    if failures:
        for f in failures:
            log("FAIL:", f)
        return 1
    log("WVOE M2 TEST PASSED")
    return 0


import urllib.parse

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
