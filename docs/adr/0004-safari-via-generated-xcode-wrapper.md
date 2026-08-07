# Safari support via a generated, never-committed Xcode wrapper

**Status: partially validated.** The build pipeline is proven end to end (converts, compiles, signs, installs, Safari-discoverable). The load-time behaviour of the render iframe on `github.com` is **not yet confirmed** — see "The open risk" below. Do not advertise Safari support until that is verified.

Safari is supported by generating an Xcode app wrapper with `xcrun safari-web-extension-converter` at build time, from a staging copy of the runtime files. The generated project is written to `dist/` and is **never committed**.

**Why no code fork:** Safari aliases `chrome.*` onto `browser.*`, so every API this extension touches — `chrome.storage.sync`, `chrome.runtime.getURL`, `chrome.scripting.executeScript`, `chrome.tabs.query` — works unmodified. There is no polyfill, no build step, and no Safari branch in the source. This preserves the zero-build rule in `CLAUDE.md`. The only scheme-dependent code is `smoke-test.mjs`, which asserts `chrome-extension://`; runtime code already routes through `getURL()` and is scheme-agnostic.

**Why the Xcode project is generated, not committed:** a Safari extension must ship inside a macOS app bundle, and the converter emits a full Xcode project plus a Swift target. Checked in, that is substantially larger than the extension it wraps and would need regenerating on every manifest change anyway. Treating it as a build artefact keeps the repo readable — the stated point of this project.

## Build mechanics worth remembering

Three non-obvious things, each of which cost a debugging cycle:

- **`xcode-select` may point at CommandLineTools**, which has no `safari-web-extension-converter`. Rather than a global `sudo xcode-select -s`, the task sets `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` per-invocation. No sudo, no machine-wide state change.

- **The converter must not write inside the directory it is reading.** With `--copy-resources` and a `--project-location` under the extension dir, it recursively copies its own output until the path exceeds `NAME_MAX` and fails with `File name too long`. The task stages the runtime files (the same list as `scripts/build-zip.sh`) into a `mktemp -d` outside the repo and converts from there.

- **Do not override `PRODUCT_BUNDLE_IDENTIFIER` on the `xcodebuild` command line.** It applies to *both* targets, collapsing the app and its appex onto one identifier; Safari then silently refuses to list the extension. The converter already assigns `dev.ninyawee.gh-x-html` to the app and `dev.ninyawee.gh-x-html.Extension` to the appex. Likewise, `CODE_SIGNING_ALLOWED=NO` yields a *linker-signed* binary with a fallback identifier that Safari also rejects — use `CODE_SIGN_IDENTITY="-"` for a real ad-hoc signature ("Sign to Run Locally").

The manifest converts with exactly one warning: `type` is unsupported, referring to `"type": "module"` on the background service worker. `background.js` is a documented no-op that exists only so Playwright/CDP can discover the extension, so this is harmless. It is left in place rather than special-cased for Safari.

## The open risk

The extension's central mechanism is a content script on `github.com` injecting an iframe pointed at `chrome.runtime.getURL("render.html")`, sandboxed **without** `allow-same-origin`, specifically to escape GitHub's `media-src` CSP (see ADR-0002).

Safari has a documented history of refusing `web_accessible_resources` loaded into content-script-injected iframes, and a sandboxed frame at an opaque origin is precisely the case where Safari cannot attribute the request to the extension. If Safari blocks this, **both** rewrite paths — fence and media — fail, and there is no manifest-level fix.

The tempting workaround is adding `allow-same-origin`. **Do not.** It hands fence authors the viewer's GitHub session and voids ADR-0002 and ADR-0003. If Safari blocks the iframe, the correct response is to not ship Safari support, or to redesign the render path — not to weaken the sandbox.

Verifying this requires GUI steps that cannot be scripted: Safari's "Allow Unsigned Extensions" lives in its sandboxed preference container, and `safaridriver` cannot enable an extension either. The manual checklist lives in the README.

## Distribution

Both viable paths require the **$99/yr Apple Developer Program**:

- **Developer ID + notarization** — supported for Safari extensions since Safari 18.4. Ship a signed `.app` from GitHub Releases beside the Chrome zip, no review queue. **Preferred.**
- **Mac App Store** — broader discovery, but App Review on an extension whose premise is "execute HTML someone typed into a GitHub comment" is an argument with a poor expected value.

Ad-hoc signing (what the task produces) is free but requires the user to re-enable *Allow Unsigned Extensions* after every Safari restart. Fine for development, not shippable.

**Considered alternatives:**

- **`webextension-polyfill`** — unnecessary, since Safari already aliases `chrome.*`, and it would introduce the bundler the project deliberately avoids. Rejected.
- **iOS support** (drop `--macos-only`) — reviewing a PR on a phone is not the use case, and it doubles the signing and review surface. Rejected.
- **A Safari branch of `smoke-test.mjs`** — Playwright cannot drive Safari extensions. Replaced by the manual checklist.

**Consequences:** Safari users install a `.app`, not a browser-store item, and must grant `github.com` access explicitly — Safari does not imply it from `host_permissions` the way Chrome does. Every manifest change requires regenerating the wrapper. Until the iframe question above is settled, Safari support is unproven, not shipped.
