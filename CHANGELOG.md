# FocusMute Extension Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Requires Firefox 140 or later (was 120). Older Firefox versions stay on
  0.11.0.

## [0.11.0] - 2026-09-11

### Added

- Proton Meet support (`meet.proton.me`), both directions: mute detection
  and reverse sync. Detection contract taken from Proton's open-source
  client (`aria-pressed` and the toggle's state classes, both
  locale-independent).
- Options page lists meeting sites Firefox has not granted access to, with
  a button to allow them. Firefox leaves sites added by an extension update
  ungranted, which silently disables detection there.

## [0.10.0] - 2026-08-11

### Added

- Microsoft Teams support (`teams.microsoft.com`, `teams.live.com`,
  `teams.cloud.microsoft`) — mute state detected from the meeting toolbar's
  `data-tid` toggle via `aria-pressed`, sent as `platform: "teams"`.
- Reverse sync (Google Meet and Microsoft Teams): when enabled in FocusMute,
  hotkey/tray mute changes click the meeting's own mute button. The worker
  polls the app with `poll_actions` only while a meeting tab is open; a
  state the script can't read is never clicked blind.

## [0.9.3] - 2026-08-10

First publicly released version (GitHub release with AMO-signed `.xpi`).

### Added

- Automatic updates — Firefox checks this repository's `updates.json` for new
  signed versions (`browser_specific_settings.gecko.update_url`). Installs
  from 0.9.3 onward update themselves; 0.9.2 and earlier must be replaced
  manually once.

## [0.9.2] - 2026-04-01

Internal development version (AMO-signed, distributed manually).

### Added

- Initial extension: Google Meet mute detection (`MutationObserver` on the
  microphone button, with `aria-label` text matching as fallback and periodic
  polling as safety net), service worker forwarding mute state to the
  FocusMute desktop app over localhost HTTP, options page for port
  configuration.

[0.9.0 and 0.9.1 were signing iterations of the same initial version — AMO
version numbers are immutable, so each re-submission required a bump.]
