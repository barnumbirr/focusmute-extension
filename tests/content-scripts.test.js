// Tests for the platform content scripts' pure detection logic.
//
// Each platform file defines findMuteButton/readMuteState and calls
// initFocusMute() (provided by common.js in the browser). Here we load the
// file with a stub initFocusMute that captures its arguments, so the pure
// functions are testable without a DOM.
//
// The Teams vectors are captured from the live consumer client
// ("light meetings", teams.live.com, 2026-08-11) via a headless probe —
// they are the real contract, not documentation.
//
// Run: node --test tests/

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function loadPlatform(file) {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "content-scripts", file),
    "utf8"
  );
  let captured = null;
  new Function("initFocusMute", src)((opts) => {
    captured = opts;
  });
  assert.ok(captured, `${file} must call initFocusMute()`);
  return captured;
}

// Minimal element stub: only getAttribute, like the code under test uses.
const el = (attrs) => ({
  getAttribute: (k) => (k in attrs ? attrs[k] : null),
});

test("meet.js registers with common.js correctly", () => {
  const meet = loadPlatform("meet.js");
  assert.equal(meet.platform, "meet");
  assert.deepEqual(meet.observedAttributes, ["data-is-muted", "aria-label"]);
  assert.equal(typeof meet.findMuteButton, "function");
  assert.equal(typeof meet.readMuteState, "function");
});

test("meet.js readMuteState", () => {
  const { readMuteState } = loadPlatform("meet.js");
  const cases = [
    // [attrs, expected]
    [{ "data-is-muted": "true" }, true],
    [{ "data-is-muted": "false" }, false],
    [{ "aria-label": "Turn on microphone (ctrl + d)" }, true],
    [{ "aria-label": "Turn off microphone (ctrl + d)" }, false],
    [{}, null],
  ];
  for (const [attrs, want] of cases) {
    assert.equal(readMuteState(el(attrs)), want, JSON.stringify(attrs));
  }
  assert.equal(readMuteState(null), null);
});

test("teams.js registers with common.js correctly", () => {
  const teams = loadPlatform("teams.js");
  assert.equal(teams.platform, "teams");
  assert.deepEqual(teams.observedAttributes, [
    "data-cid",
    "aria-pressed",
    "aria-label",
    "title",
  ]);
});

test("teams.js readMuteState (vectors captured from the live client 2026-08-11)", () => {
  const { readMuteState } = loadPlatform("teams.js");
  const cases = [
    // Prejoin switch (consumer client): data-cid is authoritative
    [{ "data-cid": "toggle-mute-true", title: "Mute mic (Ctrl+Shift+M)" }, false],
    [{ "data-cid": "toggle-mute-false", title: "Unmute mic (Ctrl+Shift+M)" }, true],
    // In-meeting button (consumer client): only the label carries state
    [{ "aria-label": "Unmute mic" }, true],
    [{ "aria-label": "Mute mic" }, false],
    // Enterprise client (per production automation code): aria-pressed
    [{ "aria-pressed": "true" }, true],
    [{ "aria-pressed": "false" }, false],
    // Unknown element → send nothing
    [{}, null],
  ];
  for (const [attrs, want] of cases) {
    assert.equal(readMuteState(el(attrs)), want, JSON.stringify(attrs));
  }
  assert.equal(readMuteState(null), null);
});

test('teams.js label fallback checks "unmute" before "mute"', () => {
  const { readMuteState } = loadPlatform("teams.js");
  // A label containing "unmute" must never be read as unmuted just
  // because it also contains the substring "mute".
  assert.equal(readMuteState(el({ "aria-label": "Unmute" })), true);
  assert.equal(readMuteState(el({ title: "Unmute mic (Ctrl+Shift+M)" })), true);
});
