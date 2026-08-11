// FocusMute — Microsoft Teams content script
//
// Platform-specific detection only; the observer/poll/send lifecycle lives
// in common.js (loaded before this file by the manifest). Runs with
// all_frames: true because Teams variants can host the meeting UI in an
// iframe; frames without a toolbar idle on the slow poll.

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

/**
 * Apply a target mute state from the app (reverse sync): click the Teams
 * toggle when the page's current state differs. Finding the control is
 * locale-independent (#mic-button / data-tid); when the STATE can't be read
 * (e.g. non-English consumer client, where only the label carries it) this
 * deliberately does nothing rather than clicking blind.
 */
function applyMuteTarget(muted) {
  const button = findMuteButton();
  const current = readMuteState(button);
  if (button && current !== null && current !== muted) {
    console.debug("[FocusMute] teams reverse sync:", muted ? "muting" : "unmuting");
    button.click();
  }
}

initFocusMute({
  platform: "teams",
  findMuteButton: findMuteButton,
  readMuteState: readMuteState,
  observedAttributes: ["data-cid", "aria-pressed", "aria-label", "title"],
  warnOnTimeout: false,
  applyMuteTarget: applyMuteTarget,
});
