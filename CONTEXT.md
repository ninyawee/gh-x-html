# Context — gh-x-html

A Chrome extension that turns GitHub comments into a medium for **UI
verification and rich-content review**: third-party video plays inline,
Playwright HTML reports and other rich artifacts render live, and fenced
HTML blocks become sandboxed iframes.

Two independent rewrite paths:

1. **Fence path** — fenced code blocks tagged `x-html` are replaced with a sandboxed iframe rendering the fence body. The iframe is loaded from `chrome-extension://render.html` so the fence escapes GitHub's page CSP. Use this for Playwright reports, status boards, ADR mockups, design comps.
2. **Media-URL path** — `<img src>` / `<a href>` pointing at media files (`.mp4`/`.webm`/`.mov`/`.mp3`/`.m4a`/`.ogg`) are replaced with `<video controls>` / `<audio controls>` rendered inside a `chrome-extension://render.html` iframe (same CSP-escape trick). Skips `github.com/user-attachments/*` which GitHub already inlines. Use this for bug recordings, demo clips, screen captures hosted on R2 / S3 / anywhere outside `*.githubusercontent.com`.

Both paths are gated by the same trust model: only fences and links inside comments authored by an allowlisted GitHub user get rewritten.

## Glossary

- **Fence** — a Markdown fenced code block in a GitHub comment, rendered by GitHub as `<pre><code class="language-…">`. The extension only touches fences whose language tag is in the known set below.
- **Known language tags**
  - `x-html` — arbitrary HTML rendered into a sandboxed iframe. The sandbox carries `allow-scripts allow-popups allow-popups-to-escape-sandbox` but never `allow-same-origin` — that combination would be a sandbox escape. Inside this sandbox the author's scripts can execute but the iframe is its own opaque origin: no GitHub cookies, no parent-DOM access, no top-frame navigation. See [ADR-0002](docs/adr/0002-sandbox-allow-scripts-no-same-origin.md).
  - `x-md` — same model, but the fence contents are first parsed as Markdown. **Deferred to v2.** v1 ships `x-html` only; for now type raw tags.
- **Trusted author** — a GitHub user login in the allowlist (`chrome.storage.sync` key `trustedAuthors`). Fences in their comments get rendered; everyone else's fences stay as plain code blocks. Default allowlist on first install: a single entry for the signed-in user (read from `<meta name="user-login">`). See [ADR-0003](docs/adr/0003-trust-model-author-allowlist.md).
- **Resizer** — a tiny script injected at the end of every `srcdoc`. It posts `{ type: 'gh-x-html:resize', height }` to the parent on `load` and on `ResizeObserver` ticks. The content script listens and updates `iframe.height`.
- **Media extensions** — `.mp4`, `.webm`, `.mov` rewrite to `<video controls preload="metadata">`. `.mp3`, `.m4a`, `.ogg` rewrite to `<audio controls>`. Case-insensitive on the extension.
- **Rich block** — an iframe the extension dropped next to (or in place of) a known fence.

## What is **not** in scope

- `file://` URL embedding. The original handoff considered rewriting `<a href="file:///tmp/in-html/…">` into iframes, but the design is **comment-source-only**: the author copies the HTML / pastes the media URL into the comment. The extension never reads files from the user's filesystem. Threat model collapses to "we render text the comment author already typed."
- A URL allowlist alongside the author allowlist. Trust is per-author. If you trust an author, you trust their links.
- Bundling Pico CSS / Tailwind / mermaid into the extension itself. The fence author pulls those from a CDN inside their own HTML if they want them. The extension stays asset-light.

## Security model

- iframes use `srcdoc`, never `src` to a remote URL.
- No fence ever gets `allow-same-origin`. Combined with `allow-scripts` that is a sandbox escape.
- Network loads from inside the iframe are allowed (sandboxed iframes can still `fetch` and load CSS/img). The author opted in by writing the fence.
- Top-frame navigation and parent DOM access are blocked by the sandbox attribute by default.

## Decisions captured as ADRs

- [ADR-0001](docs/adr/0001-fence-based-not-url-allowlist.md) — fence-based rendering, not `<a href>` rewriting.
- [ADR-0002](docs/adr/0002-sandbox-allow-scripts-no-same-origin.md) — single sandbox flag set; no static/JS fence split.
- [ADR-0003](docs/adr/0003-trust-model-author-allowlist.md) — render only fences from allowlisted authors.
