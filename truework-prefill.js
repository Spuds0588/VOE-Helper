// VOE Helper — Truework quickstart search prefill.
//
// The extension builds Truework portal links as
//   https://app.truework.com/requester/quickstart?companyName=<match name>
// The quickstart app itself ignores that parameter (verified 2026-10-23:
// only the companyId triple is honored server-side), so this content script
// does the prefill client-side: it types the name into the employer-search
// combobox on load. The list filters; the USER still picks the employer —
// this extension never auto-selects an entity (wrong-entity risk).
(() => {
  if (window.__voeHelperPrefill) return;
  window.__voeHelperPrefill = true;

  const name = new URLSearchParams(location.search).get("companyName");
  if (!name) return;

  const findInput = () =>
    document.querySelector("input#headlessui-combobox-input-1, input[name='companyId']");

  const type = (input) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value").set;
    setter.call(input, name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // The quickstart app is a SPA; the combobox can appear well after load and
  // may briefly re-render an empty value. Type once the box is empty.
  let tries = 0;
  const timer = setInterval(() => {
    const input = findInput();
    if (input && input.value === "") {
      type(input);
      clearInterval(timer);
    }
    if (++tries > 100) clearInterval(timer); // ~10s, then leave the page as-is
  }, 100);
})();
