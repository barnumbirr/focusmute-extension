# FocusMute Extension Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
