#!/usr/bin/env -S bunx --bun playwright
// Smoke test: load the unpacked extension in a fresh Chromium, pre-seed
// the allowlist with @ninyawee, navigate to the test issue, assert
//   1. the x-html fence got rewritten into a sandboxed iframe, and
//   2. synthetic .mp4 <img> / <a> injected into a .markdown-body get
//      rewritten into <video controls> wrapped in a single span (NO
//      runaway re-wrapping of the fallback anchor).
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

// ---- Media-rewrite check ----
// Inject a synthetic <img src=".mp4"> and <a href=".mp4"> into the existing
// .markdown-body and confirm the rewriter swaps each for exactly ONE
// chrome-extension:// iframe (data-gh-x-html='media-video'). The iframe
// payload arrives via postMessage; the <video controls> ends up inside the
// iframe's document, where the extension page's CSP — not GitHub's — applies
// and 3rd-party media URLs can actually fetch.
const MEDIA_URL =
  "https://pub-d14e28f843ee45049d1467c3f279ed4b.r2.dev/permanent/ninyawee/gh-x-html/2026/05/845c3a7f-gh-x-html-smoke-clip.mp4";

const mediaSummary = await page.evaluate(async (url) => {
  const mb = document.querySelector(".markdown-body");
  if (!mb) return { error: "no .markdown-body in fixture" };

  const img = document.createElement("img");
  img.src = url;
  img.alt = "synthetic test img";
  img.id = "ghxhtml-smoke-img";

  const a = document.createElement("a");
  a.href = url;
  a.textContent = "synthetic test anchor";
  a.id = "ghxhtml-smoke-anchor";

  const p = document.createElement("p");
  p.id = "ghxhtml-smoke-container";
  p.appendChild(img);
  p.appendChild(document.createElement("br"));
  p.appendChild(a);
  mb.appendChild(p);

  // Let the MutationObserver fire and the iframe handshake settle. Any
  // re-entry regression would produce more than two iframes in this window.
  await new Promise((r) => setTimeout(r, 1200));

  const container = document.getElementById("ghxhtml-smoke-container");
  const mediaIframes = container?.querySelectorAll("iframe[data-gh-x-html^='media-']") || [];

  return {
    originalImgGone: !document.getElementById("ghxhtml-smoke-img"),
    originalAnchorGone: !document.getElementById("ghxhtml-smoke-anchor"),
    mediaIframeCount: mediaIframes.length,
    firstIframeSrc: mediaIframes[0]?.getAttribute("src") || null,
    firstIframeSandbox: mediaIframes[0]?.getAttribute("sandbox") || null,
    firstIframeDataKind: mediaIframes[0]?.getAttribute("data-gh-x-html") || null,
  };
}, MEDIA_URL);

console.log("media:", JSON.stringify(mediaSummary, null, 2));

if (mediaSummary.error) {
  console.error(`\nFAIL: media probe — ${mediaSummary.error}`);
  exitCode = 1;
} else if (!mediaSummary.originalImgGone || !mediaSummary.originalAnchorGone) {
  console.error("\nFAIL: media — original <img>/<a> still in DOM (rewriter didn't fire)");
  exitCode = 1;
} else if (mediaSummary.mediaIframeCount !== 2) {
  console.error(`\nFAIL: media — expected 2 media iframes, got ${mediaSummary.mediaIframeCount}`);
  exitCode = 1;
} else if (!mediaSummary.firstIframeSrc?.startsWith("chrome-extension://")) {
  console.error(`\nFAIL: media — iframe src is not chrome-extension:// (got ${mediaSummary.firstIframeSrc})`);
  exitCode = 1;
} else if ((mediaSummary.firstIframeSandbox || "").includes("allow-same-origin")) {
  console.error("\nFAIL: media — iframe carries allow-same-origin (sandbox escape!)");
  exitCode = 1;
} else {
  console.error("PASS: media — img + anchor each replaced by one sandboxed chrome-extension iframe");
}

// Drill into one media iframe and check that <video> got mounted with the
// correct src and that the inner document is loaded from chrome-extension://.
// This is the actual proof that CSP escape worked end-to-end.
const innerFrame = page
  .frames()
  .find((f) => f.url().startsWith("chrome-extension://") && f.url().endsWith("/render.html"));
if (innerFrame) {
  // Find the media frame whose first <video> matches our URL.
  const mediaFrames = page
    .frames()
    .filter((f) => f.url().startsWith("chrome-extension://") && f.url().endsWith("/render.html"));
  let videoSummary = null;
  for (const f of mediaFrames) {
    const got = await f.evaluate((wantedSrc) => {
      const v = document.querySelector("video, audio");
      if (!v) return null;
      const src = v.getAttribute("src");
      if (src !== wantedSrc) return null;
      return {
        tag: v.tagName,
        src,
        hasControls: v.hasAttribute("controls"),
      };
    }, MEDIA_URL);
    if (got) {
      videoSummary = got;
      break;
    }
  }
  console.log("inner-frame:", JSON.stringify(videoSummary, null, 2));
  if (!videoSummary) {
    console.error("\nFAIL: media — no <video> with expected src found inside any chrome-extension iframe");
    exitCode = 1;
  } else if (!videoSummary.hasControls) {
    console.error("\nFAIL: media — inner <video> missing controls attribute");
    exitCode = 1;
  } else {
    console.error("PASS: media — inner <video controls> mounted in chrome-extension iframe with correct src");
  }
}

// ---- Camo-decoding check ----
// GitHub routes `![alt](url)` through camo.githubusercontent.com — the <a>
// and inner <img> both point at `camo.../<sha>/<hex>` where <hex> is the
// original URL hex-encoded. Without decoding, extOf misses the .mp4
// signal and the image-syntax case stays broken.
const camoSummary = await page.evaluate(async (url) => {
  const mb = document.querySelector(".markdown-body");
  if (!mb) return { error: "no .markdown-body in fixture" };

  // Build a plausible camo URL from the test URL — same encoding GitHub uses.
  const hex = [...new TextEncoder().encode(url)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const camoUrl = `https://camo.githubusercontent.com/abc123def456/${hex}`;

  // Mirror GitHub's wrapping shape: <a href=camo><img src=camo /></a>
  const img = document.createElement("img");
  img.src = camoUrl;
  img.alt = "camo test img";
  img.id = "ghxhtml-camo-img";

  const a = document.createElement("a");
  a.href = camoUrl;
  a.target = "_blank";
  a.rel = "noopener noreferrer nofollow";
  a.appendChild(img);
  a.id = "ghxhtml-camo-anchor";

  const p = document.createElement("p");
  p.id = "ghxhtml-camo-container";
  p.appendChild(a);
  mb.appendChild(p);

  await new Promise((r) => setTimeout(r, 1200));

  const container = document.getElementById("ghxhtml-camo-container");
  const mediaIframes = container?.querySelectorAll("iframe[data-gh-x-html^='media-']") || [];
  return {
    originalImgGone: !document.getElementById("ghxhtml-camo-img"),
    originalAnchorGone: !document.getElementById("ghxhtml-camo-anchor"),
    mediaIframeCount: mediaIframes.length,
    camoUrl,
  };
}, MEDIA_URL);

console.log("camo:", JSON.stringify(camoSummary, null, 2));

if (camoSummary.error) {
  console.error(`\nFAIL: camo probe — ${camoSummary.error}`);
  exitCode = 1;
} else if (!camoSummary.originalAnchorGone) {
  console.error("\nFAIL: camo — wrapper <a href=camo> still present (decoder didn't fire)");
  exitCode = 1;
} else if (camoSummary.mediaIframeCount !== 1) {
  console.error(`\nFAIL: camo — expected 1 media iframe for the wrapped <a><img>, got ${camoSummary.mediaIframeCount}`);
  exitCode = 1;
} else {
  console.error("PASS: camo — wrapped <a href=camo><img src=camo></a> decoded and replaced by 1 media iframe");
}

// ---- Aspect-ratio sizing check ----
// After loadedmetadata fires inside the iframe, the parent should size the
// iframe via aspect-ratio + max-width rather than a fixed pixel height, so
// the player snaps to the video's natural aspect instead of leaving a
// whitespace strip below the controls.
await page.waitForFunction(
  () => {
    const f = document.querySelector("iframe[data-gh-x-html='media-video']");
    return f && f.style.aspectRatio && f.style.aspectRatio !== "auto";
  },
  { timeout: 8_000 },
).catch(() => null);

const sizingSummary = await page.evaluate(() => {
  const f = document.querySelector("iframe[data-gh-x-html='media-video']");
  if (!f) return { error: "no media-video iframe" };
  return {
    aspectRatio: f.style.aspectRatio || null,
    maxWidth: f.style.maxWidth || null,
    inlineHeight: f.style.height || null,
  };
});

console.log("sizing:", JSON.stringify(sizingSummary, null, 2));

if (sizingSummary.error) {
  console.error(`\nFAIL: sizing — ${sizingSummary.error}`);
  exitCode = 1;
} else if (!sizingSummary.aspectRatio) {
  console.error("\nFAIL: sizing — iframe has no aspect-ratio (whitespace bug regression?)");
  exitCode = 1;
} else if (!sizingSummary.maxWidth) {
  console.error("\nFAIL: sizing — iframe has no max-width cap (small clips will upscale)");
  exitCode = 1;
} else {
  console.error(`PASS: sizing — iframe aspect-ratio=${sizingSummary.aspectRatio} max-width=${sizingSummary.maxWidth}`);
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
