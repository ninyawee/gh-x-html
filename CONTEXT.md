# Context — gh-x-html

A Chrome extension that lets GitHub comments embed rich content via two independent rewrite paths:

1. **Fence path** — fenced code blocks tagged `x-html` are replaced with a sandboxed iframe rendering the fence body.
2. **Media-URL path** — `<img src>` / `<a href>` pointing at media files (`.mp4`/`.webm`/`.mov`/`.mp3`/`.m4a`/`.ogg`) are replaced with `<video>` / `<audio>` elements inline (no iframe — non-executable media tags). Skips `github.com/user-attachments/*` which GitHub already inlines.

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

- `file://` URL embedding. The original handoff considered rewriting `<a href="file:///tmp/in-html/…">` into iframes, but the new design is **comment-source-only**: the author copies the HTML/Markdown into the fence body. The extension never reads files from the user's filesystem. Threat model collapses to "we render text the comment author already typed."
- External media link rewriting (`<a href="*.mp4">` → `<video>`). Out of scope for v1; revisit later if needed.

## Security model

- iframes use `srcdoc`, never `src` to a remote URL.
- No fence ever gets `allow-same-origin`. Combined with `allow-scripts` that is a sandbox escape.
- Network loads from inside the iframe are allowed (sandboxed iframes can still `fetch` and load CSS/img). The author opted in by writing the fence.
- Top-frame navigation and parent DOM access are blocked by the sandbox attribute by default.

## Decisions captured as ADRs

- [ADR-0001](docs/adr/0001-fence-based-not-url-allowlist.md) — fence-based rendering, not `<a href>` rewriting.
- [ADR-0002](docs/adr/0002-sandbox-allow-scripts-no-same-origin.md) — single sandbox flag set; no static/JS fence split.
- [ADR-0003](docs/adr/0003-trust-model-author-allowlist.md) — render only fences from allowlisted authors.
