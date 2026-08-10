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
