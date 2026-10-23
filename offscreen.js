// Extension-owned clipboard writer. Runs in an offscreen document so writes
// happen in extension context (clipboardWrite permission): no host page can
// prompt, block, or permissions-policy-gate the copy.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'voe-offscreen' || msg.type !== 'copy') return false;
  (async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      sendResponse({ ok: true });
    } catch (e) {
      // Fallback: execCommand copy inside the extension page.
      try {
        const ta = document.createElement('textarea');
        ta.value = msg.text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        sendResponse({ ok });
      } catch (e2) {
        sendResponse({ ok: false, error: String(e2) });
      }
    }
  })();
  return true;  // async sendResponse
});
