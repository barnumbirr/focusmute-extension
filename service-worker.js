// FocusMute — Service worker (background script)
//
// Forwards mute state changes from content scripts to the FocusMute tray app
// via plain HTTP POST to localhost. Firefox forces TLS on WebSocket connections
// from extension contexts, but allows plain http://127.0.0.1 via fetch().

const DEFAULT_PORT = 9736;
const KEEPALIVE_MS = 20000;

let keepaliveTimer = null;

// ── HTTP transport ──

async function getPort() {
  try {
    const result = await chrome.storage.local.get("websocket_port");
    return result.websocket_port || DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

async function postMessage(payload) {
  const port = await getPort();
  const url = `http://127.0.0.1:${port}/`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.warn("[FocusMute] server responded", response.status);
      return null;
    }
    try {
      return await response.json();
    } catch {
      // Server returned non-JSON (e.g. plain text error) — not fatal.
      return null;
    }
  } catch (e) {
    // Connection refused = FocusMute not running, silently ignore.
    console.debug("[FocusMute] post failed:", e.message);
    return null;
  }
}

// ── Send mute state to tray app ──

function sendMuteState(platform, muted) {
  postMessage({ type: "mute_state", platform, muted });
}

// ── Keepalive ping ──

function startKeepalive() {
  stopKeepalive();
  keepaliveTimer = setInterval(() => {
    postMessage({ type: "ping" });
  }, KEEPALIVE_MS);
}

function stopKeepalive() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

// ── Message handler from content scripts ──

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === "mute_state") {
    sendMuteState(message.platform, message.muted);
  }
});

// ── Reverse sync (app → browser) ──
//
// Content scripts that can APPLY a mute state (currently Meet) open a
// long-lived port. While at least one such port is connected, the worker
// polls the app for pending user-initiated mute actions and forwards them.
// The app answers {"type":"pending_action","action":"mute"|"unmute"|null};
// actions are only produced when reverse sync is enabled in FocusMute.

const REVERSE_POLL_MS = 500;

let reversePorts = [];
let reverseTimer = null;

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith("focusmute-")) return;
  reversePorts.push(port);
  port.onDisconnect.addListener(() => {
    reversePorts = reversePorts.filter((p) => p !== port);
    if (reversePorts.length === 0) stopReversePoll();
  });
  if (reversePorts.length === 1) startReversePoll();
});

function startReversePoll() {
  stopReversePoll();
  reverseTimer = setInterval(async () => {
    const resp = await postMessage({ type: "poll_actions" });
    const action = resp && resp.action;
    if (action !== "mute" && action !== "unmute") return;
    const muted = action === "mute";
    for (const port of reversePorts) {
      try {
        port.postMessage({ type: "apply_mute", muted: muted });
      } catch {
        // Port died between filter and post — the disconnect handler cleans up.
      }
    }
  }, REVERSE_POLL_MS);
}

function stopReversePoll() {
  if (reverseTimer) {
    clearInterval(reverseTimer);
    reverseTimer = null;
  }
}

// ── Start keepalive on load ──

startKeepalive();
