// FocusMute — Google Meet content script
//
// Detects mute state changes in Google Meet and sends them to the service worker.
// Uses three detection strategies:
// 1. MutationObserver on data-is-muted attribute (primary)
// 2. aria-label text matching (fallback)
// 3. Periodic polling (safety net, also reattaches observer on toolbar re-render)

const PLATFORM = "meet";
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 30000;
const INITIAL_POLL_MS = 500;

let lastMuted = null;
let observer = null;
let pollTimer = null;
let observedButton = null;

// ── Mute state detection ──

/**
 * Find the Meet microphone mute button element.
 * Prefers a compound selector that targets the mic button specifically
 * (Meet uses data-is-muted on both mic and camera buttons).
 */
function findMuteButton() {
  // Best: data-is-muted on an element whose aria-label mentions "microphone"
  const precise = document.querySelector('[data-is-muted][aria-label*="microphone" i]');
  if (precise) return precise;

  // Fallback: first data-is-muted element (usually mic, but could be camera)
  const byAttr = document.querySelector("[data-is-muted]");
  if (byAttr) return byAttr;

  // Last resort: aria-label text search on buttons
  const buttons = document.querySelectorAll("button[aria-label]");
  for (const btn of buttons) {
    const label = btn.getAttribute("aria-label").toLowerCase();
    if (label.includes("turn off microphone") || label.includes("turn on microphone")) {
      return btn;
    }
  }
  return null;
}

/**
 * Read the current mute state from the button element.
 * Returns true (muted), false (unmuted), or null (unknown).
 */
function readMuteState(button) {
  if (!button) return null;

  // data-is-muted="true" / "false"
  const attr = button.getAttribute("data-is-muted");
  if (attr === "true") return true;
  if (attr === "false") return false;

  // aria-label fallback
  const label = (button.getAttribute("aria-label") || "").toLowerCase();
  if (label.includes("turn on microphone")) return true;   // Currently muted
  if (label.includes("turn off microphone")) return false;  // Currently unmuted

  return null;
}

function sendState(muted) {
  if (muted === null || muted === lastMuted) return;
  lastMuted = muted;
  chrome.runtime.sendMessage({
    type: "mute_state",
    platform: PLATFORM,
    muted: muted,
  }).catch(() => {});
}

// ── MutationObserver (primary) ──

function startObserver(button) {
  if (observer) observer.disconnect();

  observedButton = button;

  observer = new MutationObserver(() => {
    const muted = readMuteState(button);
    sendState(muted);
  });

  observer.observe(button, {
    attributes: true,
    attributeFilter: ["data-is-muted", "aria-label"],
  });

  // Read initial state
  const muted = readMuteState(button);
  sendState(muted);
}

// ── Polling safety net ──
//
// Polls every 3 seconds to catch missed mutations. Also reattaches the
// MutationObserver if Meet re-renders the toolbar (e.g. screen sharing,
// breakout rooms), which replaces the observed DOM node with a new one.

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    const button = findMuteButton();
    if (!button) return;

    const muted = readMuteState(button);
    sendState(muted);

    // Reattach observer if the button changed (toolbar re-rendered)
    if (button !== observedButton) {
      console.log("[FocusMute] mute button changed, reattaching observer");
      startObserver(button);
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ── Initialization ──

/**
 * Wait for the Meet toolbar to render (mute button appears), then attach observer.
 * Uses exponential backoff polling to avoid hammering the DOM.
 */
function waitForToolbar() {
  let elapsed = 0;
  let delay = INITIAL_POLL_MS;

  function check() {
    const button = findMuteButton();
    if (button) {
      console.log("[FocusMute] Meet mute button found");
      startObserver(button);
      startPolling();
      return;
    }

    elapsed += delay;
    if (elapsed >= MAX_WAIT_MS) {
      console.warn("[FocusMute] Meet mute button not found after", MAX_WAIT_MS, "ms");
      startPolling();
      return;
    }

    delay = Math.min(delay * 1.5, 2000);
    setTimeout(check, delay);
  }

  check();
}

// ── Cleanup ──

window.addEventListener("beforeunload", () => {
  if (observer) observer.disconnect();
  stopPolling();
});

// ── Start ──

waitForToolbar();
