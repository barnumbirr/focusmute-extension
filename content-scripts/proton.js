// FocusMute — Proton Meet content script
//
// Platform-specific detection only; the observer/poll/send lifecycle lives
// in common.js (loaded before this file by the manifest).
//
// Contract taken from Proton's open-source client (ProtonMail/WebClients,
// applications/meet: ToggleButton.tsx, ParticipantControls.tsx,
// mediaButtonAriaLabels.ts) and confirmed against the deployed client
// on 2026-09-11:
// - toolbar toggle: <button class="toggle-button-body-on|off …"
//   aria-label="Mute microphone|Unmute microphone" aria-pressed>
// - aria-pressed = isMicrophoneEnabled — INVERTED relative to Teams:
//   "true" means the mic is LIVE, "false" means muted
// - aria-pressed is absent in warning states (permission denied /
//   no device); the on/off class still reflects the effective state
// - mobile variant: <Button class="circle-button circle-button-default|
//   danger …"> with the same aria attributes
// - labels are localized (ttag); label matching is an English-only
//   fallback, while aria-pressed and the state classes are locale-free
// - the camera toggle is a sibling with the identical shape, so finding
//   the button MUST filter on the microphone label

/**
 * Find the Proton Meet microphone toggle. Every mic label variant contains
 * "microphone" (and every camera label says "camera"), so the label filter
 * separates the twins; the attribute/class qualifiers bias toward the real
 * toolbar toggle over any other mic-labeled control.
 */
function findMuteButton() {
  return (
    document.querySelector('button[aria-pressed][aria-label*="microphone" i]') ||
    document.querySelector('button[class*="toggle-button-body"][aria-label*="microphone" i]') ||
    document.querySelector('button[aria-label*="microphone" i]')
  );
}

/**
 * Read the current mute state from the button element.
 * Returns true (muted), false (unmuted), or null (unknown).
 */
function readMuteState(button) {
  if (!button) return null;

  // aria-pressed = isMicrophoneEnabled (locale-independent, verified in
  // ParticipantControls.tsx). Note the inversion: pressed means LIVE.
  const pressed = button.getAttribute("aria-pressed");
  if (pressed === "true") return false;
  if (pressed === "false") return true;

  // State classes (locale-independent, hard-coded in the components).
  // Covers the warning states where aria-pressed is absent — a mic with
  // denied permission or no device is effectively muted.
  const cls = button.getAttribute("class") || "";
  if (cls.includes("toggle-button-body-off") || cls.includes("circle-button-danger")) {
    return true;
  }
  if (cls.includes("toggle-button-body-on") || cls.includes("circle-button-default")) {
    return false;
  }

  // Label fallback (English-only). Order matters: "unmute" contains "mute".
  // The warning labels contain neither and fall through to null.
  const label = (button.getAttribute("aria-label") || "").toLowerCase();
  if (label.includes("unmute")) return true;
  if (label.includes("mute")) return false;

  return null;
}

/**
 * Apply a target mute state from the app (reverse sync): click the toggle
 * when the page's current state differs. Never clicks unreadable state.
 */
function applyMuteTarget(muted) {
  const button = findMuteButton();
  const current = readMuteState(button);
  if (button && current !== null && current !== muted) {
    console.debug("[FocusMute] proton reverse sync:", muted ? "muting" : "unmuting");
    button.click();
  }
}

initFocusMute({
  platform: "proton",
  findMuteButton: findMuteButton,
  readMuteState: readMuteState,
  observedAttributes: ["aria-pressed", "aria-label", "class"],
  warnOnTimeout: false,
  applyMuteTarget: applyMuteTarget,
});
