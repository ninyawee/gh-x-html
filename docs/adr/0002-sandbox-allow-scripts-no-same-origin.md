# Iframe sandbox: `allow-scripts` always, `allow-same-origin` never

Every rich block is a `<iframe srcdoc sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox">`. There is no `x-html-static` / `x-html-js` distinction.

**Why one variant:** auto-resizing the iframe to fit its content (decided in Q4) requires injecting a small resizer script into the `srcdoc`, which requires `allow-scripts`. Once `allow-scripts` is on every iframe anyway, gating it per-fence becomes theatre — the real security boundary is `allow-same-origin`, which is never set. Without `allow-same-origin` the iframe is an opaque origin:

- `parent.document` access throws cross-origin
- No GitHub cookies are sent on any fetch from inside the iframe
- `localStorage` is sandboxed to that opaque origin (i.e. effectively useless)
- Top-frame navigation (`window.top.location = …`) is blocked
- `postMessage` works — that's how the resizer talks to the parent

So author scripts can run, but only inside their own bubble. Same threat model as embedding a Codepen.

**Considered alternatives:**

- **Per-fence opt-in** (`x-html` no-scripts, `x-html-js` scripts on). Doubled vocabulary for a boundary that doesn't actually move. Rejected.
- **CSP nonce inside `srcdoc`** to block author scripts while allowing our resizer. Brittle across browser versions; complexity not warranted.

**Consequences:** anyone in the trusted-author allowlist (see ADR-0003) can run arbitrary JS in your browser inside that sandbox. Mitigation is the trust model — you only render fences from authors you've added.
