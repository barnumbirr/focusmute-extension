// Tests for the options page's site-access logic.
//
// options.js is a plain script that wires itself to the DOM on load, so it
// runs here against stub `document` and `chrome` objects. The scenario that
// motivated the feature is covered directly: every origin granted except a
// site added by a later update.
//
// Run: node --test tests/options.test.js

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const OPTIONS_JS = fs.readFileSync(path.join(__dirname, "..", "options.js"), "utf8");
const REAL_MANIFEST = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);

const ELEMENT_IDS = ["port", "save", "status", "perm-section", "perm-list", "grant", "perm-status"];

function fakeElement() {
  const el = {
    value: "",
    hidden: false,
    style: {},
    children: [],
    listeners: {},
    addEventListener(event, fn) {
      this.listeners[event] = fn;
    },
    appendChild(child) {
      this.children.push(child);
    },
  };
  let text = "";
  Object.defineProperty(el, "textContent", {
    get: () => text,
    set: (value) => {
      text = value;
      if (value === "") el.children.length = 0;
    },
  });
  return el;
}

/** Load options.js against stubbed globals. `granted` is mutated by a request. */
function load({ granted, manifest = REAL_MANIFEST, requestGrants = true }) {
  const els = Object.fromEntries(ELEMENT_IDS.map((id) => [id, fakeElement()]));
  const requested = [];
  const document = {
    getElementById: (id) => els[id],
    createElement: () => fakeElement(),
  };
  // Firefox honors permissions.request() only while the click handler's
  // synchronous stack is still on the stack; an `await` before the call
  // ends the gesture and the request is rejected. This stub models that.
  let inGesture = false;
  const chrome = {
    runtime: { getManifest: () => manifest },
    storage: { local: { get: (_key, cb) => cb({}), set: (_obj, cb) => cb && cb() } },
    permissions: {
      contains: async ({ origins }) => origins.every((o) => granted.includes(o)),
      request: async ({ origins }) => {
        if (!inGesture) {
          throw new Error("permissions.request may only be called from a user input handler");
        }
        requested.push(...origins);
        if (requestGrants) granted.push(...origins);
        return requestGrants;
      },
    },
  };
  new Function("document", "chrome", OPTIONS_JS)(document, chrome);
  // options.js kicks off an async refresh on load; let it settle.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** Click the grant button the way a browser does, gesture and all. */
  const click = async () => {
    inGesture = true;
    try {
      els.grant.listeners.click();
    } finally {
      inGesture = false;
    }
    await settle();
  };

  return { els, requested, settled: settle(), click };
}

const listedHosts = (els) => els["perm-list"].children.map((c) => c.textContent);

test("required origins cover every content-script site and the app listener", () => {
  // Derived from the shipped manifest: a new platform is picked up by
  // declaring it, with no second list to keep in sync.
  const origins = [
    ...REAL_MANIFEST.content_scripts.flatMap((cs) => cs.matches),
    ...REAL_MANIFEST.host_permissions,
  ];
  for (const expected of [
    "https://meet.google.com/*",
    "https://teams.microsoft.com/*",
    "https://meet.proton.me/*",
    "http://127.0.0.1/*",
  ]) {
    assert.ok(origins.includes(expected), `manifest should declare ${expected}`);
  }
});

test("section stays hidden when every origin is granted", async () => {
  const granted = [
    ...REAL_MANIFEST.content_scripts.flatMap((cs) => cs.matches),
    ...REAL_MANIFEST.host_permissions,
  ];
  const { els, settled } = load({ granted });
  await settled;
  assert.equal(els["perm-section"].hidden, true);
  assert.deepEqual(listedHosts(els), []);
});

test("a site added by an update is listed as missing", async () => {
  // The observed failure: 0.10.0's grants carried over, so Proton alone
  // was ungranted and its content script never injected.
  const granted = [
    "http://127.0.0.1/*",
    "https://meet.google.com/*",
    "https://teams.microsoft.com/*",
    "https://teams.live.com/*",
    "https://teams.cloud.microsoft/*",
  ];
  const { els, settled } = load({ granted });
  await settled;
  assert.equal(els["perm-section"].hidden, false);
  assert.deepEqual(listedHosts(els), ["meet.proton.me"]);
});

test("granting requests exactly the missing origins and clears the section", async () => {
  const granted = [
    "http://127.0.0.1/*",
    "https://meet.google.com/*",
    "https://teams.microsoft.com/*",
    "https://teams.live.com/*",
    "https://teams.cloud.microsoft/*",
  ];
  const { els, requested, settled, click } = load({ granted });
  await settled;

  await click();

  assert.deepEqual(requested, ["https://meet.proton.me/*"]);
  assert.match(els["perm-status"].textContent, /Allowed/);
  assert.equal(els["perm-section"].hidden, true);
});

test("a declined request leaves the section up and says so", async () => {
  const granted = ["http://127.0.0.1/*", "https://meet.google.com/*"];
  const { els, settled, click } = load({ granted, requestGrants: false });
  await settled;

  await click();

  assert.match(els["perm-status"].textContent, /Not allowed/);
  assert.equal(els["perm-section"].hidden, false);
  assert.ok(listedHosts(els).includes("meet.proton.me"));
});
