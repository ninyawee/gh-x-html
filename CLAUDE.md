# Working in this repo

This file orients an AI agent (Claude Code or similar) to what `gh-x-html` is
actually for, so changes don't drift away from the product. Read this first;
the technical glossary lives in [`CONTEXT.md`](CONTEXT.md) and the binding
decisions in [`docs/adr/`](docs/adr/).

## What this extension is for

The headline use-case is **UI verification inside a GitHub PR / issue**:

1. **Third-party video plays inline.** A bug recording at
   `https://r2.dev/.../clip.mp4` becomes a `<video controls>` right inside the
   comment. Reviewer never leaves the issue. This is the #1 user-visible win.
2. **Playwright HTML reports render live.** Drop the report HTML inside an
   `x-html` fence; failures, screenshots, traces become browsable in the PR.
3. **Status boards, ADR mockups, design comps.** Rich `x-html` fences become
   sandboxed iframes — animated CSS, real SVG, interactive controls — all
   inside one GitHub comment.

The HTML showcase is the demo. The day-to-day value is **the team stops
posting Drive links and screenshots, and starts shipping the artifact
directly inside the PR.**

## Order of priorities when making changes

1. **Don't break the trust model.** The sandboxed iframe must never carry
   `allow-same-origin`. The author allowlist must continue to gate every
   rewrite. See ADR-0002 and ADR-0003.
2. **Don't regress the video path.** v0.1.9 fixed the CSP-escape for
   third-party media by routing through `chrome-extension://render.html`. If
   you touch `content.js` or `render.js`, run `bun smoke-test.mjs` and verify
   the inner `<video controls>` still mounts with the correct `src`.
3. **Keep it zero-build.** No bundler, no TypeScript, no framework. Vanilla
   JS, MV3 manifest. The whole point is that anyone can read the source.
4. **Keep it small.** ~14 KB shipped. If a change adds more than a few KB,
   ask whether it belongs.

## Things that look like good ideas but aren't

- **Adding `allow-same-origin` to "fix" something.** Don't. It's a sandbox
  escape that gives fence authors access to the viewer's GitHub session.
- **Reading from `file://`.** Out of scope — see ADR-0001. The threat model
  collapses to "we render text the comment author typed."
- **A URL allowlist alongside the author allowlist.** Trust is per-author.
  If you trust an author, you trust their links.
- **Bundling Pico CSS / Tailwind into the extension.** The fence author
  pulls those from a CDN inside their own HTML if they want them. The
  extension itself stays asset-light.

## How to verify a change

`bun smoke-test.mjs` launches a fresh Chromium with the unpacked extension,
seeds `@ninyawee` as the trusted author, opens
`https://github.com/ninyawee/gh-x-html/issues/1`, and asserts:

1. The `x-html` fence got rewritten into a sandboxed iframe.
2. The iframe carries `allow-scripts` but **not** `allow-same-origin`.
3. Synthetic `<img>` / `<a>` `.mp4` injections become exactly one
   `<video controls>` each — no runaway re-wrapping.
4. The inner `<video>` mounts inside the `chrome-extension://render.html`
   frame with the correct `src`.

For visual / UX changes, also capture screenshots against
[issue #4 — the showcase comment](https://github.com/ninyawee/gh-x-html/issues/4)
to confirm the rich-fence path still renders the Q2 dashboard cleanly.

## How to package for the store

`./scripts/build-zip.sh` writes `dist/gh-x-html-<version>.zip` with only the
runtime files. Promo art for the listing lives in `docs/store/`.

## Code map (where to look)

| What | File |
|---|---|
| MV3 manifest, permissions, host matches | `manifest.json` |
| Service worker (storage seeding) | `background.js` |
| Content script — fence + media rewriter, MutationObserver, postMessage resizer | `content.js` |
| Iframe shell loaded via `chrome-extension://render.html` | `render.html` + `render.js` |
| Popup UI for the trusted-authors allowlist | `popup.html` + `popup.js` |
| Smoke test (Playwright) | `smoke-test.mjs` |
| Architecture decision records | `docs/adr/` |
| Web Store icons, promo tiles, screenshots | `docs/store/` |
| Build script (produces the upload zip) | `scripts/build-zip.sh` |
