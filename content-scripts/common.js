// FocusMute — shared content-script machinery
//
// Each platform script (meet.js, teams.js) defines how to FIND its mute
// button and how to READ mute state from it, then calls initFocusMute().
// This file owns the shared lifecycle:
// 1. MutationObserver on the button (primary detection)
// 2. Periodic polling (safety net, also reattaches the observer when the
//    page re-renders its toolbar and replaces the observed DOM node)
// 3. Dedup'd forwarding to the service worker
//
// Load order matters: the manifest lists common.js before the platform
// script; files in one content_scripts entry share an isolated world.

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 30000;
const INITIAL_POLL_MS = 500;

function initFocusMute({
  platform,
  findMuteButton,
  readMuteState,
  observedAttributes,
  warnOnTimeout,
  applyMuteTarget,
}) {
  let lastMuted = null;
  let observer = null;
  let pollTimer = null;
  let observedButton = null;

  function sendState(muted) {
    if (muted === null || muted === lastMuted) return;
    lastMuted = muted;
    console.debug(`[FocusMute] ${platform} mute state:`, muted);
    chrome.runtime.sendMessage({
      type: "mute_state",
      platform: platform,
      muted: muted,
    }).catch(() => {});
  }

  function startObserver(button) {
    if (observer) observer.disconnect();

    observedButton = button;

    observer = new MutationObserver(() => {
      sendState(readMuteState(button));
    });

    observer.observe(button, {
      attributes: true,
      attributeFilter: observedAttributes,
    });

    // Read initial state
    sendState(readMuteState(button));
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      const button = findMuteButton();
      if (!button) return;

      sendState(readMuteState(button));

      // Reattach observer if the button changed (toolbar re-rendered)
      if (button !== observedButton) {
        console.log(`[FocusMute] ${platform} mute button changed, reattaching observer`);
        startObserver(button);
      }
    }, POLL_INTERVAL_MS);
  }

  /**
   * Wait for the toolbar to render (mute button appears), then attach the
   * observer. Uses exponential backoff polling to avoid hammering the DOM.
   */
  function waitForToolbar() {
    let elapsed = 0;
    let delay = INITIAL_POLL_MS;

    function check() {
      const button = findMuteButton();
      if (button) {
        console.log(`[FocusMute] ${platform} mute button found`);
        startObserver(button);
        startPolling();
        return;
      }

      elapsed += delay;
      if (elapsed >= MAX_WAIT_MS) {
        // Frames without a toolbar (all_frames pages) idle on the slow
        // poll, which also covers meetings started long after page load.
        if (warnOnTimeout) {
          console.warn(`[FocusMute] ${platform} mute button not found after`, MAX_WAIT_MS, "ms");
        }
        startPolling();
        return;
      }

      delay = Math.min(delay * 1.5, 2000);
      setTimeout(check, delay);
    }

    check();
  }

  window.addEventListener("beforeunload", () => {
    if (observer) observer.disconnect();
    if (pollTimer) clearInterval(pollTimer);
  });

  // Reverse sync: platforms that can APPLY a mute state to the page open a
  // long-lived port; the service worker forwards pending app actions to it
  // (and only polls the app while such a port is connected).
  if (applyMuteTarget) {
    const port = chrome.runtime.connect({ name: `focusmute-${platform}` });
    port.onMessage.addListener((msg) => {
      if (msg && msg.type === "apply_mute") {
        applyMuteTarget(msg.muted === true);
      }
    });
  }

  waitForToolbar();
}
