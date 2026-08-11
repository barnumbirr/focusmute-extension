// FocusMute — Microsoft Teams content script
//
// Detects mute state changes in the Teams web client and sends them to the
// service worker. Uses three detection strategies:
// 1. MutationObserver on the toolbar mute button (primary)
// 2. data-tid selectors with aria-pressed / aria-label state reads
// 3. Periodic polling (safety net, also reattaches observer on re-render)
//
// Teams renders the meeting UI in an iframe in some variants, so this script
// runs with all_frames: true; frames without a toolbar just idle on the poll.

const PLATFORM = "teams";
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 30000;
const INITIAL_POLL_MS = 500;

let lastMuted = null;
let observer = null;
let pollTimer = null;
let observedButton = null;

// ── Mute state detection ──

/**
 * Find the Teams microphone toggle. Captured from the live consumer client
 * ("light meetings", teams.live.com, 2026-08-11):
 * - in-meeting toolbar: <button id="mic-button" aria-label="Mute mic|Unmute mic">
 *   — no data-tid, no aria-pressed; the id is the locale-independent hook
 * - prejoin screen: <input role="switch" data-tid="toggle-mute"
 *   data-cid="toggle-mute-true|false" title="Mute mic…|Unmute mic…">
 * data-tid selectors are kept for the enterprise client, which still uses them.
 */
function findMuteButton() {
  const byId = document.getElementById("mic-button");
  if (byId) return byId;

  const byTid =
    document.querySelector('[data-tid="toggle-mute"]') ||
    document.querySelector('[data-tid="microphone-button"]');
  if (byTid) return byTid;

  // Last resort: mic-labeled control. Deliberately NOT matching bare
  // "mute" — participant-roster rows carry "Mute participant" buttons.
  return document.querySelector(
    'button[aria-label*="microphone" i], button[aria-label*="mic" i]'
  );
}

/**
 * Read the current mute state from the button element.
 * Returns true (muted), false (unmuted), or null (unknown).
 */
function readMuteState(button) {
  if (!button) return null;

  // Prejoin switch: data-cid encodes the state machine-readably and
  // locale-independently ("toggle-mute-true" = mic live).
  const cid = button.getAttribute("data-cid");
  if (cid === "toggle-mute-true") return false;
  if (cid === "toggle-mute-false") return true;

  // aria-pressed (enterprise client variants): pressed = muted.
  const pressed = button.getAttribute("aria-pressed");
  if (pressed === "true") return true;
  if (pressed === "false") return false;

  // Label/title text fallback (English-only; Teams localizes these).
  // The in-meeting button carries aria-label, the prejoin switch a title.
  // Order matters: "unmute" contains "mute".
  const label = (
    (button.getAttribute("aria-label") || "") +
    " " +
    (button.getAttribute("title") || "")
  ).toLowerCase();
  if (label.includes("unmute")) return true; // action offered → currently muted
  if (label.includes("muted")) return true; // state description
  if (label.includes("mute")) return false; // action offered → currently live

  return null;
}

function sendState(muted) {
  if (muted === null || muted === lastMuted) return;
  lastMuted = muted;
  console.debug("[FocusMute] teams mute state:", muted);
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
    attributeFilter: ["data-cid", "aria-pressed", "aria-label", "title"],
  });

  // Read initial state
  const muted = readMuteState(button);
  sendState(muted);
}

// ── Polling safety net ──
//
// Polls every 3 seconds to catch missed mutations. Also reattaches the
// MutationObserver when Teams re-renders the toolbar (React replaces the
// observed DOM node with a new one).

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    const button = findMuteButton();
    if (!button) return;

    const muted = readMuteState(button);
    sendState(muted);

    // Reattach observer if the button changed (toolbar re-rendered)
    if (button !== observedButton) {
      console.log("[FocusMute] Teams mute button changed, reattaching observer");
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
 * Wait for the Teams toolbar to render (mute button appears), then attach
 * observer. Uses exponential backoff polling to avoid hammering the DOM.
 */
function waitForToolbar() {
  let elapsed = 0;
  let delay = INITIAL_POLL_MS;

  function check() {
    const button = findMuteButton();
    if (button) {
      console.log("[FocusMute] Teams mute button found");
      startObserver(button);
      startPolling();
      return;
    }

    elapsed += delay;
    if (elapsed >= MAX_WAIT_MS) {
      // No toolbar in this frame (yet) — fall back to the slow poll, which
      // also covers meetings started long after page load.
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
