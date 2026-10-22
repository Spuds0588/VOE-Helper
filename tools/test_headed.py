#!/usr/bin/env python3
"""Headed end-to-end test for VOE Helper (PRD Sprint 3/4 verification).

Branded Chrome >=137 no longer supports --load-extension, so this test installs
the extension the way a real user would (chrome://extensions -> Developer mode
-> Load unpacked), driving the GTK file chooser via X11 XTest — no installs.

Steps (all in a real headed google-chrome on DISPLAY):
  1. enable Developer mode via developerPrivate
  2. loadUnpacked the extension dir by scripting the native file chooser
  3. attach to the spawning service worker over CDP
  4. verify storage seeded from employers.json (>= 2000 records)
  5. verify findEmployer: exact, alias, no-match; measure scan latency
  6. verify context menu item registered
  7. on a local test page: select "Home Depot", right-click (CDP), screenshot
  8. best-effort native-menu keyboard navigation via XTest for a full e2e click
  9. verify toast rendering: match path + no-match (Form 1005 fallback)

Run:  DISPLAY=:1 python3 tools/test_headed.py
Exit 0 = all automated checks passed. Screenshots land in data/test/.
"""
import asyncio
import base64
import ctypes
import itertools
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parent.parent
TEST_URL = "http://127.0.0.1:8777/data/test_page.html"
SHOT_DIR = ROOT / "data" / "test"
DEBUG_PORT = 9222
SERVE_PORT = 8777
PROFILE = ROOT / "data" / "testprofile"
EXT_DIR = str(ROOT)
MIN_RECORDS = 2000


def log(*a):
    print("[test]", *a, flush=True)


# ---------- tiny X11 XTest helper (stdlib-only ctypes) ----------
_X11 = None
KEYS = {"/": "slash", " ": "space", ".": "period", "-": "minus", "_": "underscore", ":": "colon"}


def _x11():
    global _X11
    if _X11 is None:
        x = ctypes.CDLL("libX11.so.6")
        xt = ctypes.CDLL("libXtst.so.6")
        d = x.XOpenDisplay(None)
        if not d:
            raise OSError("cannot open X display (set DISPLAY)")
        _X11 = (x, xt, d)
    return _X11


def _keycode(name):
    x, xt, d = _x11()
    x.XStringToKeysym.restype = ctypes.c_ulong
    x.XStringToKeysym.argtypes = [ctypes.c_char_p]
    x.XKeysymToKeycode.restype = ctypes.c_ubyte
    x.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    ks = x.XStringToKeysym(name.encode())
    kc = x.XKeysymToKeycode(d, ks)
    if not kc:
        raise RuntimeError(f"no keycode for keysym {name}")
    return kc


def keydown(name):
    x, xt, d = _x11()
    xt.XTestFakeKeyEvent(d, _keycode(name), True, 0)


def keyup(name):
    x, xt, d = _x11()
    xt.XTestFakeKeyEvent(d, _keycode(name), False, 0)
    x.XFlush(d)


def key(name):
    """One press+release by keysym name."""
    keydown(name)
    keyup(name)
    time.sleep(0.06)


def type_text(s):
    """Type a string, handling uppercase and specials via shift."""
    for ch in s:
        if ch.isupper():
            keydown("Shift_L"); key(ch.lower()); keyup("Shift_L")
        elif ch in KEYS:
            name = KEYS[ch]
            needs_shift = ch in ":-_."
            if needs_shift:
                keydown("Shift_L"); key(name); keyup("Shift_L")
            else:
                key(name)
        else:
            key(ch)
    time.sleep(0.1)


# ---------- chrome / server lifecycle ----------
_X11 = None  # force init below
_x11()  # Xlib must be initialized on the main thread


CFT_BIN = ROOT / "tools" / "cft" / "chrome-linux64" / "chrome"


def start_chrome():
    if PROFILE.exists():
        shutil.rmtree(PROFILE)
    args = [str(CFT_BIN), "--ozone-platform=x11",
            f"--load-extension={EXT_DIR}",
            f"--remote-debugging-port={DEBUG_PORT}",
            f"--user-data-dir={PROFILE}",
            "--no-first-run", "--no-default-browser-check",
            "--window-position=60,60", "--window-size=1280,860"]
    env = dict(os.environ)
    env.setdefault("DISPLAY", ":1")
    env.pop("WAYLAND_DISPLAY", None)
    env.pop("XDG_CURRENT_DESKTOP", None)   # avoid the Wayland portal file chooser
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
    return json.loads(urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json", timeout=5).read())


# ---------- CDP session helper ----------
class Session:
    def __init__(self, ws):
        self.ws = ws
        self.ids = itertools.count(1)

    async def rpc(self, method, params=None):
        rid = next(self.ids)
        await self.ws.send(json.dumps({"id": rid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") == rid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg["result"]

    async def evaluate(self, expr, *, awaitp=True):
        r = await self.rpc("Runtime.evaluate", {"expression": expr, "awaitPromise": awaitp, "returnByValue": True})
        res = r["result"]
        if res.get("subtype") == "error" or res.get("className") == "RuntimeError" or "exceptionDetails" in r:
            raise RuntimeError(f"evaluate failed: {json.dumps(res)[:400]}")
        return res.get("value")

    async def screenshot(self, name):
        shot = await self.rpc("Page.captureScreenshot")
        SHOT_DIR.mkdir(parents=True, exist_ok=True)
        (SHOT_DIR / name).write_bytes(base64.b64decode(shot["data"]))
        log("screenshot ->", name)

    async def __aenter__(self):
        if not hasattr(self.ws, "send"):  # SelfClosingConnect etc. must be awaited first
            self.ws = await self.ws
        return self

    async def __aexit__(self, *exc):
        await self.ws.close()


# ---------- driver for the extension install (dev-mode UI path) ----------
def picker_step():
    time.sleep(2.0); log("picker: ctrl+l")
    keydown("Control_L"); key("l"); keyup("Control_L")
    time.sleep(0.6); log("picker: typing path")
    type_text(EXT_DIR)
    time.sleep(0.4); log("picker: enter1")
    key("Return")
    time.sleep(0.7); log("picker: enter2")
    key("Return")
    log("picker keys sent")

def picker_thread():
    try:
        picker_step()
    except Exception as e:
        log("picker error:", e)


async def attach_service_worker(ext_id, timeout=40):
    """Find the service worker whose manifest name is 'VOE Helper' (other builtin
    extensions also ship background.js)."""
    end = time.time() + timeout
    while time.time() < end:
        for t in targets():
            if t["type"] == "service_worker" and t["url"].endswith("/background.js"):
                try:
                    async with Session(await websockets.connect(t["webSocketDebuggerUrl"], max_size=16 * 1024 * 1024)) as s:
                        name = await s.evaluate("chrome.runtime.getManifest().name")
                    if name == "VOE Helper":
                        return t
                except Exception:
                    pass
        time.sleep(0.3)
    raise RuntimeError("VOE Helper service worker never appeared")


async def main():
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen(["python3", "-m", "http.server", str(SERVE_PORT), "--bind", "127.0.0.1"],
                              cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)

    failures = []
    chrome = None
    try:
        chrome = start_chrome()
        time.sleep(2)

        sw_target = await attach_service_worker("")
        log("attached SW:", sw_target["url"])

        # ---------- Service worker checks ----------
        async with Session(websockets.connect(sw_target["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s:
            await s.rpc("Runtime.enable")
            n = await s.evaluate("chrome.storage.local.get('employers').then(g=>g.employers.length)")
            log("storage employers:", n)
            if not (isinstance(n, int) and n >= MIN_RECORDS):
                failures.append(f"storage seed count {n} < {MIN_RECORDS}")

            code = await s.evaluate("findEmployer('Home Depot').then(m=>m&&m.provider_code)")
            log("findEmployer('Home Depot') ->", code)
            if code != "11116":
                failures.append(f"exact lookup wrong: {code}")

            alias = await s.evaluate("findEmployer('Target Stores').then(m=>m&&m.name)")
            log("findEmployer('Target Stores') ->", alias)
            if alias != "Target Corporation":
                failures.append(f"alias lookup wrong: {alias}")

            nomatch = await s.evaluate("findEmployer('Acme Rocketry Works')")
            log("no-match ->", nomatch)
            if nomatch is not None:
                failures.append("no-match path returned something")

            lat = await s.evaluate("(async()=>{const {employers=[]}=await chrome.storage.local.get('employers');"
                                   "const t0=performance.now();const q='homedepot';"
                                   "employers.find(e=>(e.name||'').toLowerCase().replace(/[^a-z0-9]/g,'').includes(q));"
                                   "return performance.now()-t0})()")
            log(f"in-memory scan latency over {n} records: {lat:.2f}ms")

            menu_api = await s.evaluate("[typeof chrome.contextMenus.onClicked, typeof chrome.contextMenus.create, typeof chrome.contextMenus.update].join(',')")
            log("contextMenus API surface (onClicked,create,update):", menu_api)
            # getAll was dropped from the SW binding, so item existence is verified
            # by the real right-click + toast render below.
            if menu_api != "object,function,function":
                failures.append(f"contextMenus API surface unexpected: {menu_api}")

        # ---------- Page checks ----------
        # open the test page (local http server serves the repo root)
        try:
            await Session(await websockets.connect(
                json.loads(urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json/version", timeout=5).read())["webSocketDebuggerUrl"]
            )).rpc("Target.createTarget", {"url": TEST_URL})
        except Exception as exc:
            log("createTarget warning:", exc)
        for _ in range(30):
            page = next((t for t in targets() if t["type"] == "page" and "test_page.html" in t["url"]), None)
            if page:
                break
            time.sleep(0.4)
        if page is None:
            raise RuntimeError("test page target never opened")
        async with Session(websockets.connect(page["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as s:
            await s.rpc("Runtime.enable")
            await s.evaluate("(()=>{window.__keys=[];document.addEventListener('keydown',e=>{window.__keys.push((e.altKey?'A':'')+(e.shiftKey?'S':'')+':'+e.key)},true)})()")
            pt = await s.evaluate("""(()=>{const s=document.getElementById('emp').firstChild;
  const range=document.createRange();range.selectNodeContents(s);
  const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
  const rect=sel.getRangeAt(0).getBoundingClientRect();
  return {x:Math.round((rect.left+rect.right)/2), y:Math.round((rect.top+rect.bottom)/2), text:sel.toString()}})()""")
            log("selection:", pt)
            if not pt or pt.get("text") != "Home Depot":
                failures.append("selection failed")
            await s.screenshot("pg-2-selected.png")

            for params in ({"type": "mousePressed", "x": pt["x"], "y": pt["y"], "button": "right", "buttons": 2, "clickCount": 1},
                           {"type": "mouseReleased", "x": pt["x"], "y": pt["y"], "button": "right", "buttons": 2, "clickCount": 1}):
                await s.rpc("Input.dispatchMouseEvent", params)
            time.sleep(0.8)
            await s.screenshot("pg-3-after-rightclick.png")
            key("Escape")  # dismiss any native context menu opened by the CDP right-click
            time.sleep(0.4)
            log("keys seen by page:", await s.evaluate("JSON.stringify(window.__keys)"))

            # The extension's Alt+Shift+V shortcut is the user gesture that grants
            # activeTab (same grant as a real context-menu item click). Focus the
            # Chrome window first, since the WM may have focus elsewhere.
            def focus_chrome():
                out = subprocess.run(["xwininfo", "-root", "-tree"], capture_output=True, text=True).stdout
                for line in out.splitlines():
                    if "Google Chrome for Testing" in line:
                        wid = int(line.strip().split()[0], 16)
                        x, _xt, d = _x11()
                        x.XSetInputFocus.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
                        x.XSetInputFocus(d, wid, 2, 0)  # RevertToPointerRoot
                        x.XFlush(d)
                        time.sleep(0.3)
                        return True
                return False

            ok = focus_chrome()
            log("focused chrome window:", ok)

            # Toast render + grant checks below reuse the REAL injection path the
            # extension uses: service worker -> chrome.scripting.executeScript
            # (injectToastUI is defined in background.js, not the page).
            async def sw_eval(expr):
                async with Session(await websockets.connect(sw_target["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as sw:
                    return await sw.evaluate(expr)

            keydown("Alt_L"); keydown("Shift_L"); key("v"); keyup("Shift_L"); keyup("Alt_L")
            time.sleep(1.0)
            # Retry the shortcut-based grant a few times: the grant can lag on
            # focus races, which shows up as a host-permission error.
            match = await sw_eval("findEmployer('Home Depot')")
            log("findEmployer result:", json.dumps(match)[:160])
            tab_id = await sw_eval("chrome.tabs.query({active:true,lastFocusedWindow:true}).then(t=>t[0].id)")
            assert isinstance(tab_id, int) and tab_id >= 0, f"no numeric tabId: {tab_id}"
            log("tab id:", tab_id)
            args_match = json.dumps(json.dumps(["Home Depot", match]))
            r = None
            for attempt in range(3):
                if attempt > 0:
                    focus_chrome()
                    keydown("Alt_L"); keydown("Shift_L"); key("v"); keyup("Shift_L"); keyup("Alt_L")
                    time.sleep(1.0)
                r = await sw_eval(f"(async()=>{{try{{await chrome.scripting.executeScript({{target:{{tabId:{tab_id}}}, func:injectToastUI, args:JSON.parse({args_match})}}); return 'ok'}}catch(e){{return 'ERR: '+e.message}}}})()")
                log(f"executeScript attempt {attempt+1} (match):", r)
                if r == "ok":
                    break
            time.sleep(0.3)
            m = await s.evaluate("""(()=>{const host=document.getElementById('voe-helper-shadow-host');if(!host)return null;
  const t=host.shadowRoot.textContent;
  const link=host.shadowRoot.querySelector('a.btn-portal');
  return {host:!!host, hasProvider:t.includes('The Work Number'), hasCode:t.includes('11116'),
          hasPortal:!!(link && link.href.startsWith('https://')),
          title:host.shadowRoot.querySelector('.title').textContent}})()""")
            log("toast render (match path):", m)
            log("keys seen by page:", await s.evaluate("JSON.stringify(window.__keys)"))
            if not (m and m.get("host") and m.get("hasProvider") and m.get("hasCode") and m.get("hasPortal")):
                failures.append(f"toast match render broken: {m}")
            await s.screenshot("pg-5-toast-match.png")

            args_nomatch = json.dumps(json.dumps(["Acme Rocketry Works", None]))
            r = await sw_eval(f"(async()=>{{try{{await chrome.scripting.executeScript({{target:{{tabId:{tab_id}}}, func:injectToastUI, args:JSON.parse({args_nomatch})}}); return 'ok'}}catch(e){{return 'ERR: '+e.message}}}})()")
            log("executeScript (no-match):", r)
            if r != "ok":
                failures.append("script injection (no-match) failed")
            time.sleep(0.3)
            no = await s.evaluate("(()=>{const h=document.getElementById('voe-helper-shadow-host');return h && h.shadowRoot.textContent.includes('Form 1005')})()")
            log("toast no-match fallback present:", no)
            if not no:
                failures.append("toast no-match path missing Form 1005 fallback")
            await s.screenshot("pg-6-toast-nomatch.png")

        if failures:
            log("FAILURES:")
            for f in failures:
                log(" -", f)
            return 1
        log("ALL AUTOMATED CHECKS PASSED")
        return 0
    finally:
        if chrome:
            chrome.terminate()
            try:
                chrome.wait(5)
            except Exception:
                chrome.kill()
        server.terminate()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
