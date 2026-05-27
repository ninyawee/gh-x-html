#!/usr/bin/env -S bunx --bun playwright
// Smoke test: load the unpacked extension in a fresh Chromium, pre-seed
// the allowlist with @ninyawee, navigate to the test issue, assert the
// x-html fence got rewritten into a sandboxed iframe.
//
// Usage:
//   bunx --bun playwright install chromium   (once)
//   bun smoke-test.mjs
//
// Or:  node smoke-test.mjs   (if @playwright/test is on the system)

import { chromium } from "playwright";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

const EXT_PATH = resolve(import.meta.dirname);
const TEST_ISSUE = "https://github.com/ninyawee/gh-x-html/issues/1";
const TRUSTED_AUTHOR = "ninyawee";
const PROFILE = mkdtempSync(join(tmpdir(), "gh-x-html-smoke-"));

console.error(`extension:    ${EXT_PATH}`);
console.error(`profile:      ${PROFILE}`);
console.error(`test issue:   ${TEST_ISSUE}`);

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
  ],
});

// Wait for the extension's service worker to register so we can grab the
// extension ID and seed chrome.storage.sync before content.js gets a chance
// to run on github.com.
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 10_000 });
const extId = sw.url().split("/")[2];
console.error(`extension id: ${extId}`);

await sw.evaluate(async (login) => {
  await chrome.storage.sync.set({ trustedAuthors: [login] });
}, TRUSTED_AUTHOR);
console.error(`seeded trustedAuthors=[${TRUSTED_AUTHOR}]`);

const page = await context.newPage();

// Capture postMessages from inside the iframe to diagnose resize handshake.
await page.addInitScript(() => {
  window.__ghxhtmlMessages = [];
  window.addEventListener("message", (e) => {
    if (e.data && typeof e.data === "object" && e.data.type === "gh-x-html:resize") {
      window.__ghxhtmlMessages.push({ height: e.data.height, ts: Date.now() });
    }
  });
});

page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("Content Security Policy") || t.includes("CSP") || msg.type() === "error") {
    console.error(`[page console:${msg.type()}] ${t}`);
  }
});
page.on("pageerror", (err) => console.error(`[page pageerror] ${err.message}`));

await page.goto(TEST_ISSUE, { waitUntil: "domcontentloaded" });

// Wait for the iframe to appear (extension is async — author detection
// happens after React hydrates the header).
const iframeHandle = await page
  .waitForSelector("iframe[data-gh-x-html='fence']", { timeout: 15_000 })
  .catch(() => null);

// Wait for postMessage auto-resize to settle.
await page.waitForFunction(
  () => {
    const ifr = document.querySelector("iframe[data-gh-x-html='fence']");
    return ifr && ifr.offsetHeight > 250;
  },
  { timeout: 5_000 },
).catch(() => null);

const summary = await page.evaluate(() => {
  const iframes = document.querySelectorAll("iframe[data-gh-x-html]");
  const pres = document.querySelectorAll('pre[lang="x-html"]');
  const ifr = iframes[0];
  return {
    iframeCount: iframes.length,
    leftoverPres: pres.length,
    leftoverPreApplied: pres[0]?.getAttribute("data-gh-x-html-applied") || null,
    firstIframe: ifr
      ? {
          sandbox: ifr.getAttribute("sandbox"),
          inlineHeight: ifr.style.height,
          offsetHeight: ifr.offsetHeight,
          srcdocLen: ifr.srcdoc.length,
        }
      : null,
    resizeMessages: window.__ghxhtmlMessages || "(initScript missed)",
    srcdocLen2: ifr ? ifr.srcdoc.length : null,
    iframeSrc: ifr ? ifr.src : null,
  };
});

console.log(JSON.stringify(summary, null, 2));

let exitCode = 0;
if (summary.iframeCount === 0) {
  console.error("\nFAIL: no iframe rendered");
  exitCode = 1;
} else {
  const sandbox = summary.firstIframe.sandbox || "";
  if (sandbox.includes("allow-same-origin")) {
    console.error("\nFAIL: iframe carries allow-same-origin (sandbox escape!)");
    exitCode = 1;
  } else if (!sandbox.includes("allow-scripts")) {
    console.error("\nFAIL: iframe missing allow-scripts");
    exitCode = 1;
  } else {
    console.error("\nPASS: fence rewritten, sandbox correct");
  }
}

// Screenshot the iframe area for visual confirmation.
if (iframeHandle) {
  const shot = "/tmp/gh-x-html-smoke.png";
  await iframeHandle.scrollIntoViewIfNeeded();
  await iframeHandle.screenshot({ path: shot });
  console.error(`screenshot:   ${shot}`);
}

await context.close();
process.exit(exitCode);
