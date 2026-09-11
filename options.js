// FocusMute — Options page script

const DEFAULT_PORT = 9736;
const portInput = document.getElementById("port");
const saveButton = document.getElementById("save");
const statusEl = document.getElementById("status");

// Load saved port on page open
chrome.storage.local.get("websocket_port", (result) => {
  portInput.value = result.websocket_port || DEFAULT_PORT;
});

// Save on button click
saveButton.addEventListener("click", () => {
  const value = parseInt(portInput.value, 10);
  if (isNaN(value) || value < 0 || value > 65535) {
    statusEl.textContent = "Invalid port number.";
    statusEl.style.color = "#c00";
    return;
  }
  if (value > 0 && value < 1024) {
    statusEl.textContent = "Port must be 0 (disabled) or >= 1024.";
    statusEl.style.color = "#c00";
    return;
  }
  chrome.storage.local.set({ websocket_port: value }, () => {
    statusEl.textContent = "Saved.";
    statusEl.style.color = "#080";
  });
});

// ── Site access ──
//
// Firefox grants the manifest's host permissions when the extension is
// installed, but a host added by a later update is left ungranted and the
// user is never told (Firefox bug 1893232). Its content script then never
// injects and the platform silently does nothing. The required origins are
// derived from the manifest, so a newly supported meeting site is covered
// here the moment it is declared.

const permSection = document.getElementById("perm-section");
const permList = document.getElementById("perm-list");
const grantButton = document.getElementById("grant");
const permStatus = document.getElementById("perm-status");

/** Every origin the extension needs: content-script sites plus the app listener. */
function requiredOrigins(manifest) {
  const fromScripts = (manifest.content_scripts || []).flatMap((cs) => cs.matches || []);
  return [...new Set([...fromScripts, ...(manifest.host_permissions || [])])];
}

/** Host part of a match pattern, for display: "https://meet.proton.me/*" → "meet.proton.me". */
function hostLabel(origin) {
  return origin.replace(/^[^:]+:\/\//, "").replace(/\/.*$/, "");
}

/** Origins the user has not granted. Checked one at a time to name them. */
async function missingOrigins() {
  const missing = [];
  for (const origin of requiredOrigins(chrome.runtime.getManifest())) {
    if (!(await chrome.permissions.contains({ origins: [origin] }))) {
      missing.push(origin);
    }
  }
  return missing;
}

/** What the section currently lists, so the click handler needs no lookup. */
let pendingOrigins = [];

async function refreshPermissionSection() {
  const missing = await missingOrigins();
  pendingOrigins = missing;
  permList.textContent = "";
  for (const origin of missing) {
    const item = document.createElement("li");
    item.textContent = hostLabel(origin);
    permList.appendChild(item);
  }
  permSection.hidden = missing.length === 0;
}

grantButton.addEventListener("click", () => {
  if (pendingOrigins.length === 0) return;
  // Firefox rejects permissions.request() with "may only be called from a
  // user input handler" if anything is awaited first, which ends the
  // gesture. So the request is reached synchronously here and the origins
  // come from the last refresh rather than a fresh lookup.
  chrome.permissions
    .request({ origins: pendingOrigins })
    .then((granted) => {
      permStatus.textContent = granted
        ? "Allowed. Reload any meeting tabs that are already open."
        : "Not allowed. FocusMute stays inactive on those sites.";
      permStatus.style.color = granted ? "#080" : "#c00";
      return refreshPermissionSection();
    })
    .catch((e) => {
      permStatus.textContent = `Could not request access: ${e.message}`;
      permStatus.style.color = "#c00";
    });
});

refreshPermissionSection();
