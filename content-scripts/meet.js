// FocusMute — Google Meet content script
//
// Platform-specific detection only; the observer/poll/send lifecycle lives
// in common.js (loaded before this file by the manifest).

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

/**
 * Apply a target mute state from the app (reverse sync): click Meet's mute
 * button when the page's current state differs. The resulting DOM mutation
 * flows back through the normal observer path; the app's idempotency gate
 * treats that echo as a no-op, so no suppression flag is needed here.
 */
function applyMuteTarget(muted) {
  const button = findMuteButton();
  const current = readMuteState(button);
  if (button && current !== null && current !== muted) {
    console.debug("[FocusMute] meet reverse sync:", muted ? "muting" : "unmuting");
    button.click();
  }
}

initFocusMute({
  platform: "meet",
  findMuteButton: findMuteButton,
  readMuteState: readMuteState,
  observedAttributes: ["data-is-muted", "aria-label"],
  warnOnTimeout: true,
  applyMuteTarget: applyMuteTarget,
});
