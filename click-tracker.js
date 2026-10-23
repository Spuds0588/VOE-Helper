// VOE Helper — right-click tracker (MAIN world by design).
//
// Chrome's contextMenus.onClicked does not carry click coordinates, so this
// capture listener records where the user right-clicked. The service worker
// then reads the coordinates back at menu-click time via
// chrome.scripting.executeScript(world: 'MAIN') and uses the DOM element
// under the point as the search string — even when nothing is selected.
// Tracks coordinates + a timestamp only; no extension data reaches the page.
window.__voeRightClick = null;
window.addEventListener('contextmenu', (e) => {
  window.__voeRightClick = {
    x: e.clientX,
    y: e.clientY,
    t: Date.now()
  };
}, true);
