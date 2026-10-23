#!/usr/bin/env python3
"""Headed USABILITY test for VOE Helper (selection-type coverage).

Complements tools/test_headed.py (core E2E). This pass drives the shipped
matcher and toast injector with the messy input shapes a mortgage processor
actually selects: trailing punctuation, quotes, hyphens and inline note text,
newlines, inner-word partials, sentence fragments, digits, URLs, unicode and
case variants — then renders each result through the real injector and
measures the DOM for overflow/UX failures.

Checks (all via live Chrome-for-Testing on DISPLAY):
  A. matcher matrix — findEmployer over ~30 selection shapes
  B. real context-menu flow on a punctuation-trailing selection
  C. no-match toast with a long single-token selection (overflow check)
  D. copy-code click (offscreen doc — no clipboard read-back) + portal deep-link
  E. duplicate-toast guard (second trigger removes the first host)
  F. long-notes row rendering (wrap check)
  G. portal deep-link correctness across all three providers (button href must
     equal the matched record's own ordering URL, target=_blank)

NOTE for anyone watching the browser live: the toast is expected to swap
looking like it "rotates through employers" — each check B–G re-triggers the
real injector with a different selection/match on the same page, one after
another. It is the test sequence, not the matcher cycling matches.

Run:  DISPLAY=:1 timeout 500 python3 tools/test_usability.py  # stays in fg
Exit 0 = all automated checks passed. Screenshots land in data/test/.
"""
import asyncio
import base64
import json
import subprocess
import sys
import time
import urllib.request
import urllib.parse

import websockets

import test_headed as th
from test_headed import Session, key, keydown, keyup

DEBUG_PORT = th.DEBUG_PORT
SERVE_PORT = 8787  # separate from test_headed's 8777
TEST_URL = f"http://127.0.0.1:{SERVE_PORT}/data/test/usability_page.html"


def log(*a):
    print("[usability]", *a, flush=True)


# ---------- matcher matrix (A) ----------
# (selection, expected) where expected is:
#   ("code", "11116")        named coded row surfaced with that provider code
#   ("name", "Row name")     named row surfaced (coded or uncoded by its code)
#   ("nocode", None)         a row surfaces but MUST NOT carry a provider code
#   (None, None)             no match at all
MATRIX = [
    ("Home Depot", ("code", "11116")),
    ("  home \n depot  ", ("code", "11116")),       # whitespace/newlines
    ('"Home Depot"', ("code", "11116")),            # surrounding quotes
    ("Home Depot,", ("code", "11116")),             # trailing punctuation
    ("(Home Depot)", ("code", "11116")),
    ("Home Depot.", ("code", "11116")),
    ("Wal-Mart Stores", ("code", "10108")),         # hyphen + suffix
    ("Walmart, Inc.", ("code", "10108")),
    ("Depot", ("code", "11116")),                   # double-click word fragment
    ("I work at Home Depot", ("code", "11116")),    # sentence fragment
    ("Home Depot, first", ("code", "11116")),       # selection trailing text
    ("Contact Walmart Inc for payroll", ("code", "10108")),
    ("Ryder Truck Rentals", ("code", "10919")),     # substring on short name
    ("Verizon Wireless", ("code", "10303")),
    ("U.S. Bank", ("code", "10360")),
    ("US Bank", ("code", "10360")),
    ("Olive Garden", ("code", "11533")),
    ("Pikes Peak", ("code", "19242")),              # pass-6 alias
    ("Stoughton Health", ("code", "10720867")),
    ("Polk County", ("code", "3026524")),           # standing tie regression
    ("Dallas County", ("code", "15311")),           # standing tie regression
    ("MasterCard Worldwide", None),                 # unknown brand
    ("11116", None),                                # a bare code number
    ("https://www.theworknumber.com/verifier", None),  # URL selection
    ("acme-rocketry-works", None),
    ("Thursday", None),                             # ordinary word
    ("Cafe Mondego", None),
    ("naïve résumé ☂️", None),                       # unicode soup
    ("<img src=x onerror=window.__pwn=1>", None),   # injection-shaped input
    ("American Airlines", ("nocode", "American Airlines")),  # AMR negative
    ("Princeton University", ("nocode", None)),     # uncoded row or no-match
]

# ---------- FAQ: UI page (C/D/E/F) ----------
PAGE_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
span.pick { background:#ffe98a; }
</style></head><body>
<p>Processor notes: <span class="pick" id="hd">Call Home Depot, first.</span></p>
<p>Brand mention: <span class="pick" id="brand">Princeton University payroll</span></p>
<p id="junk">reject-this-{TOKEN}</p>
<script>window.token="{TOKEN}";</script>
</body></html>"""


def usability_page_html():
    junk = "X" * 260 + "-too-long-single-token-for-a-320px-toast-card-overflow-check"
    return PAGE_HTML.replace("{TOKEN}", junk)


async def start_server():
    page = th.ROOT / "data" / "test" / "usability_page.html"
    page.write_text(usability_page_html())
    return subprocess.Popen(
        ["python3", "-m", "http.server", str(SERVE_PORT), "--bind", "127.0.0.1"],
        cwd=str(th.ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def page_wait_for(url, match, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        for t in th.targets():
            if t["type"] == "page" and match in t["url"]:
                return t
        time.sleep(0.3)
    raise RuntimeError(f"page target never appeared: {url}")


async def sw_eval(sw_url, expr):
    async with Session(await websockets.connect(sw_url, max_size=64 * 1024 * 1024)) as s:
        return await s.evaluate(expr)


async def inject_via_shipped_path(sw_url, tab_id, selection, match):
    """Same chrome.scripting call the shipped onClicked handler makes."""
    args = json.dumps(json.dumps([selection, match]))
    return await sw_eval(
        sw_url,
        f"(async()=>{{try{{await chrome.scripting.executeScript({{target:{{tabId:{tab_id}}},"
        f" func:injectToastUI, args:JSON.parse({args})}}); return 'ok'}}"
        f"catch(e){{return 'ERR: '+e.message}}}})()")


async def toast_probe(page_session, fields):
    expr = "(()=>{const h=document.getElementById('voe-helper-shadow-host');if(!h)return null;" \
           "const r=h.shadowRoot;" + fields + "})()"
    return await page_session.evaluate(expr)


async def select_and_point(s, selector, word=None):
    """Select a node (or a substring) and return center point + text."""
    expr = """((selector, word)=>{
  const node=document.querySelector(selector).firstChild;
  const range=document.createRange();range.selectNodeContents(node);
  if(word){const idx=node.textContent.indexOf(word);
    if(idx<0)return null;range.setStart(node,idx);range.setEnd(node,idx+word.length);}
  const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
  const rect=sel.getRangeAt(0).getBoundingClientRect();
  return {x:Math.round((rect.left+rect.right)/2), y:Math.round((rect.top+rect.bottom)/2),
          text:sel.toString()}})""" + f"({json.dumps(selector)}, {json.dumps(word) or 'null'})"
    return await s.evaluate(expr)


async def real_right_click(page, px, py, tag, shotdir=None):
    """Right-click the page at exact CSS viewport coordinates: CDP
    Input.dispatchMouseEvent is pixel-exact (XTest physical math misses the
    browser chrome offset and can hit the tab strip), then the native menu
    popup is typed at with XTest keys like a real user would. The popup is
    captured (xwd + ffmpeg) before the type-ahead for inspection."""
    def xtree_ids():
        out = subprocess.run(["xwininfo", "-root", "-tree"],
                             capture_output=True, text=True).stdout
        return {l.strip().split()[0] for l in out.splitlines()
                if l.strip().startswith("0x")}

    before = xtree_ids()
    base = {"x": px, "y": py, "button": "right", "clickCount": 1}
    await page.rpc("Input.dispatchMouseEvent",
                   {**base, "type": "mousePressed", "buttons": 2})
    time.sleep(0.08)
    await page.rpc("Input.dispatchMouseEvent",
                   {**base, "type": "mouseReleased", "buttons": 2})
    popup = None
    for _ in range(10):
        time.sleep(0.3)
        new = xtree_ids() - before
        if new:
            popup = sorted(new)[0]
            break
    if popup is None:
        log(f"menu({tag}): no popup window appeared")
        return False
    if shotdir:
        xwd = f"{shotdir}/menu-popup-{tag}.xwd"
        png = f"{shotdir}/menu-popup-{tag}.png"
        subprocess.run(["xwd", "-id", popup, "-out", xwd], check=False)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", xwd, png],
                       check=False)
        log(f"menu({tag}): popup captured -> menu-popup-{tag}.png")
    time.sleep(0.7)
    focus_chrome()
    key("l")
    time.sleep(0.7)
    key("Return")
    time.sleep(1.2)
    return True


def focus_chrome():
    return th.focus_chrome()


async def main():
    failures = []
    server = await start_server()
    chrome = None
    try:
        chrome = th.start_chrome()
        time.sleep(2)
        sw = await th.attach_service_worker("")
        sw_url = sw["webSocketDebuggerUrl"]
        log("attached SW:", sw["url"])

        total = await sw_eval(sw_url,
                              "chrome.storage.local.get('employers').then(g=>g.employers.length)")
        log("records:", total)

        # ---- A: matcher matrix ----
        bad = 0
        for selection, expected in MATRIX:
            res = await sw_eval(sw_url, "findEmployer(" + json.dumps(selection) + ")")
            kind, want = expected if expected else (None, None)
            got_code = (res or {}).get("provider_code")
            got_name = (res or {}).get("name")
            if kind is None:
                ok = res is None
                detail = "no-match"
            elif kind == "code":
                ok = got_code == want
                detail = f"code={got_code} name={got_name}"
            elif kind == "name":
                ok = got_name == want
                detail = f"name={got_name}"
            else:  # nocode — uncoded rows carry "", not None
                if want is None:
                    ok = res is None or not got_code
                    detail = f"name={got_name} code={got_code} (expect no code or no match)"
                else:
                    ok = res is not None and got_name == want and not got_code
                detail = f"name={got_name} code={got_code}"
            if not ok:
                failures.append(f"matrix miss [{selection!r}] expected {expected} got {detail}")
                bad += 1
            log(f"matrix {'OK ' if ok else 'MISS'} [{selection!r}] -> {detail}")
        log(f"matrix: {len(MATRIX)-bad}/{len(MATRIX)} green")        # ---- open the test page ----
        # (D's copy check asserts the extension's own response — 'Copied!' — via
        # the offscreen clipboard document; NO page clipboard read, which would
        # fire Chrome's "Share clipboard?" permission bubble during tests, as
        # observed on 2026-10-23.)
        async with Session(await websockets.connect(
                json.loads(urllib.request.urlopen(
                    f"http://127.0.0.1:{DEBUG_PORT}/json/version", timeout=5
                ).read())["webSocketDebuggerUrl"])) as dv:
            await dv.rpc("Target.createTarget", {"url": TEST_URL})
        tgt = page_wait_for(TEST_URL, "usability_page.html")
        async with Session(await websockets.connect(
                tgt["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024)) as ps:
            await ps.rpc("Runtime.enable")
            tab_id = await sw_eval(sw_url,
                                   "chrome.tabs.query({active:true,lastFocusedWindow:true})"
                                   ".then(t=>t[0].id)")

            # ---- B: real context-menu flow on "Call Home Depot, first." ----
            pt = await select_and_point(ps, "#hd", word="Home Depot, first")
            log("selection B:", pt)
            if not pt or "Home Depot, first" not in pt["text"]:
                failures.append("B selection failed")
            okflow = False
            for attempt in range(4):
                popup = await real_right_click(
                    ps, pt["x"], pt["y"], f"B{attempt}", shotdir=str(th.SHOT_DIR))
                toast = await ps.evaluate(
                    "!!document.getElementById('voe-helper-shadow-host')")
                focused = await ps.evaluate("document.hasFocus()")
                log(f"menu B attempt {attempt+1}: popup={popup} toast={toast} focused={focused}")
                if popup and toast:
                    okflow = True
                    break
                key("Escape")
                time.sleep(0.5)
            if not okflow:
                failures.append("B: real context-menu flow failed with messy selection")
            m = await toast_probe(ps, """return {title: r.querySelector('.title')?.textContent,
                    code: r.querySelector('.code-badge')?.textContent,
                    esc: !r.querySelector('img,b')}""")
            log("B toast:", m)
            if not (m and m.get("code") == "11116" and m.get("esc")):
                failures.append(f"B toast render wrong: {m}")

            # ---- C: long single-token no-match selection -> overflow check ----
            junk = (await ps.evaluate("window.token")) + ", 1240 fee schedule CO"
            r = await inject_via_shipped_path(sw_url, tab_id, junk, None)
            log("C inject:", r)
            time.sleep(0.3)
            c = await toast_probe(ps, """const t=r.querySelector('.not-found-text');
                    const card=r.querySelector('.toast-card');
                    return {present:!!t, overflow:t? t.scrollWidth>t.clientWidth+1:false,
                            cardOverflow:!!card&&(card.scrollWidth>card.clientWidth+1),
                            text:t?t.textContent.slice(0,60):null}""")
            log("C long no-match toast:", c)
            if not (c and c.get("present")):
                failures.append("C: no-match toast missing for long selection")
            elif c.get("cardOverflow") or c.get("overflow"):
                failures.append(
                    f"C CONFIRMED BUG: long selection overflows the no-match toast {c}")
                key("Escape")  # leave the broken render visible in screenshot

            # ---- D: copy-code click ----
            r = await inject_via_shipped_path(
                sw_url, tab_id, "Walmart", {"name": "Walmart", "provider": "The Work Number",
                                            "provider_code": "10108", "notes": "", "portal_url": "https://theworknumber.com"})
            time.sleep(0.3)
            btn = await ps.evaluate("""(()=>{const h=document.getElementById('voe-helper-shadow-host');
               if(!h)return null;const b=h.shadowRoot.querySelector('#copy-btn');
               if(!b)return null;const rct=b.getBoundingClientRect();
               return {x:Math.round((rct.left+rct.right)/2),y:Math.round((rct.top+rct.bottom)/2)}})()""")
            if not btn:
                failures.append("D: copy button not rendered on coded match")
            else:
                # CDP click at CSS viewport coords — XTest physical math misses
                # the browser chrome offset and clicks the wrong element.
                # Read-back is intentionally NOT used: navigator.clipboard.
                # readText() in the page fires Chrome's "Share clipboard?"
                # permission bubble (observed 2026-10-23) and blocks the eval.
                # The shipped copy path answers through the offscreen document,
                # so the button state IS the verification.
                dbase = {"x": btn["x"], "y": btn["y"], "button": "left",
                         "clickCount": 1}
                await ps.rpc("Input.dispatchMouseEvent",
                             {**dbase, "type": "mousePressed"})
                await ps.rpc("Input.dispatchMouseEvent",
                             {**dbase, "type": "mouseReleased"})
                time.sleep(1.0)
                btnstate = await ps.evaluate(
                    "document.getElementById('voe-helper-shadow-host')?.shadowRoot"
                    ".querySelector('#copy-btn')?.innerText")
                log("D copy button after click:", btnstate)
                if btnstate != "Copied!":
                    failures.append(f"D: offscreen copy didn't confirm (button: {btnstate!r})")
            dportal = await toast_probe(ps, """const a=r.querySelector('a.btn-portal');
                    return a ? {href:a.href,
                                resolved:a ? new URL('https://theworknumber.com', location.href).href : null,
                                target:a.target} : null""")
            log("D portal link:", dportal)
            # a.href is the browser-resolved form (adds the final '/'); compare
            # against the URL the browser would actually open on click.
            if not (dportal and dportal.get("href") == dportal.get("resolved")
                    and dportal.get("target") == "_blank"):
                failures.append(f"D: portal deep-link wrong for coded TWN match: {dportal}")

            # ---- E: duplicate-toast guard ----
            _ = await inject_via_shipped_path(sw_url, tab_id, "Ryder", None)
            _ = await inject_via_shipped_path(sw_url, tab_id, "Olive Garden", None)
            time.sleep(0.3)
            n_hosts = await ps.evaluate(
                "document.querySelectorAll('#voe-helper-shadow-host').length")
            log("E hosts after two injects:", n_hosts)
            if n_hosts != 1:
                failures.append(f"E: {n_hosts} toast hosts stacked (expected 1)")

            # ---- F: long-notes row wrap (uses the REAL match so the notes ----
            # row actually renders; University of Virginia has a 3-code note) ----
            uva = await sw_eval(sw_url,
                                "findEmployer('University of Virginia')")
            f_recv = await inject_via_shipped_path(sw_url, tab_id,
                                                   "University of Virginia", uva)
            time.sleep(0.3)
            f = await toast_probe(ps, """const box=r.querySelector('.notes-box');
                    const card=r.querySelector('.toast-card');
                    return {notes:box? box.textContent.slice(0,90):null,
                            cardOverflow:!!card&&(card.scrollWidth>card.clientWidth+1),
                            boxOverflow:!!box&&(box.scrollWidth>box.clientWidth+1)}""")
            log("F long-notes render:", f)
            if not (f and f.get("notes")):
                failures.append("F: notes row never rendered for coded match")
            elif f and (f.get("cardOverflow") or f.get("boxOverflow")):
                failures.append(f"F CONFIRMED BUG: long notes overflow the toast {f}")

            # ---- G: portal deep-link correctness across all three providers ----
            # The button must open the matched record's own ordering page — its
            # href is asserted against portal_url (browser-normalized, plus the
            # shipped Truework search-prefill param) and target=_blank.
            for sel in ("Walmart", "L3Harris", "Worldwide Express"):
                mrow = await sw_eval(sw_url,
                                     "findEmployer(" + json.dumps(sel) + ")")
                if not mrow:
                    failures.append(f"G: '{sel}' resolved to no match")
                    continue
                await inject_via_shipped_path(sw_url, tab_id, sel, mrow)
                time.sleep(0.3)
                want = mrow.get("portal_url")
                # Mirror the shipped prefill rule: Truework quickstart rows get
                # their matched name appended as the search-prefill param.
                if want.startswith("https://app.truework.com/requester/quickstart"):
                    want += "?companyName=" + urllib.parse.quote(mrow["name"])
                g = await toast_probe(
                    ps,
                    "const a=r.querySelector('a.btn-portal');\n"
                    "const expected=" + json.dumps(want) + ";\n"
                    "return a ? {href:a.href,\n"
                    "            resolved:a && expected ?"
                    " new URL(expected, location.href).href : null,\n"
                    "            target:a.target} : null")
                # a.href is the browser-resolved form (adds the final '/');
                # compare against the URL the browser would open on click.
                okp = bool(g) and g.get("resolved") is not None \
                    and g.get("href") == g.get("resolved") \
                    and g.get("target") == "_blank"
                log(f"G [{sel}] {mrow['provider']}: portal={g} expect {want}")
                if not okp:
                    failures.append(
                        f"G: {mrow['provider']} portal link wrong: got {g} want {want}")

        ley = "pg-7-usability-final.png"
        try:
            await ps.screenshot(ley)
            log("screenshot ->", ley)
        except Exception as e:
            log("final screenshot skipped:", e)
        log("FAILURES:" if failures else "ALL USABILITY CHECKS PASSED")
        for x_ in failures:
            log(" -", x_)
        return 1 if failures else 0
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
