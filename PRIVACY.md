# Privacy Policy

**FocusMute Browser Extension** does not collect, store, or transmit any personal data.

## What the extension does

- Detects mute/unmute state on Google Meet pages by reading the mute button's DOM attributes
- Sends the mute state (`true`/`false`) to the FocusMute desktop app via HTTP POST to `127.0.0.1` (localhost only)
- Stores the configured port number in `chrome.storage.local` (browser-local, never transmitted)

## What the extension does NOT do

- Does not collect browsing history, cookies, or personal information
- Does not transmit any data to external servers — mute-state communication is strictly localhost (see "Automatic updates" below)
- Does not track usage, analytics, or telemetry
- Does not access any page content beyond the Meet mute button element

## Automatic updates

The extension is self-hosted. Firefox's standard add-on update mechanism
periodically fetches the update manifest and signed package from GitHub
(`raw.githubusercontent.com` / `github.com`). These requests are made by
Firefox, not by the extension's own code, carry no data beyond what any
HTTP request exposes (IP address, user agent), and can be disabled in
Firefox's add-on settings ("Update Add-ons Automatically").

## Contact

For questions, open an issue at [github.com/barnumbirr/focusmute-extension](https://github.com/barnumbirr/focusmute-extension/issues).
