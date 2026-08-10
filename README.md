# FocusMute Browser Extension

Companion browser extension for [FocusMute](https://github.com/barnumbirr/focusmute). Syncs mute state from browser-based meeting apps to FocusMute LED indicators on Focusrite Scarlett 4th Gen interfaces.

## Supported Browsers

- Firefox 120+
- Chrome / Chromium 116+
- Microsoft Edge 116+

## Supported Meeting Apps

- Google Meet

## Requirements

[FocusMute](https://github.com/barnumbirr/focusmute) v0.9.1 or later (the first version with the browser sync listener). The extension and FocusMute are versioned independently — any extension version works with any FocusMute version that has browser sync.

## Setup

1. **Enable browser sync in FocusMute**: Open Settings > Advanced > Browser sync, set the port to `9736` (or any port >= 1024). Restart FocusMute if you change the port. New installs have browser sync disabled by default.

2. **Install the extension**:
   - **Firefox**: Download the signed `.xpi` from the [latest release](https://github.com/barnumbirr/focusmute-extension/releases/latest) and open it with Firefox (File > Open, or drag it into a Firefox window). Installed versions update automatically from 0.9.3 onward.
   - **Chrome/Edge**: Go to `chrome://extensions`, enable "Developer mode", click "Load unpacked", select this directory.

3. **Configure the port**: Right-click the extension icon > "Options" (or go to the extension's settings page). Set the same port as in FocusMute.

4. **Join a Google Meet call** — the extension detects mute/unmute and forwards the state to FocusMute. Your Scarlett LEDs will reflect the browser mute state.

## How It Works

1. A content script (`meet.js`) monitors the Google Meet mute button using a `MutationObserver` on the `data-is-muted` attribute (filtered to the microphone button via `aria-label`), with `aria-label` text matching as a fallback and periodic polling as a safety net. The observer reattaches automatically if Meet re-renders the toolbar.

2. The service worker forwards mute state changes to `http://127.0.0.1:<port>` via `fetch()` POST with a JSON body. Uses plain HTTP (not WebSocket) because Firefox forces TLS on WebSocket connections from extension background scripts, but allows plain `http://127.0.0.1` via `fetch()`.

3. FocusMute's tray app receives the mute state and calls `set_muted()` on the OS audio — the existing poll thread detects the change and updates LEDs through the normal flow.

## Protocol

The extension sends JSON POST requests to `http://127.0.0.1:<port>/`:

```json
{"type": "mute_state", "platform": "meet", "muted": true}
```

The server responds with:

```json
{"type": "ack"}
```

A keepalive ping is sent every 20 seconds:

```json
{"type": "ping"}
```

The server rejects requests from web page origins (CORS protection) — only browser extension origins and origin-less requests are allowed.

## Configuration

The port defaults to `9736` in the extension. To change it, use the extension's options page (right-click icon > Options) or the DevTools console:

```js
chrome.storage.local.set({ websocket_port: 9736 });
```

In FocusMute: Settings > Advanced > Browser sync > Port.

Both must match. New FocusMute installs have browser sync disabled (port 0) — set a port to enable it.

## Building

### Firefox (.xpi)

Releases are built and signed by CI: pushing a `v*` tag runs the release
workflow, which lints, builds, signs at AMO (unlisted channel), and attaches
the signed `.xpi` to a GitHub release under the name `updates.json` points
at. To sign locally instead:

```bash
npm install --global web-ext
web-ext sign --channel unlisted --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET"
```

The signed `.xpi` is written to `web-ext-artifacts/`.

### Chrome / Edge

Upload the directory contents to the [Chrome Web Store](https://chrome.google.com/webstore/devconsole) or [Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge/).

## License

Apache-2.0 — see [LICENSE](LICENSE).
