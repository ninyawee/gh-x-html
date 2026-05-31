# Privacy policy — gh-x-html

Draft text for the privacy policy page required by the Chrome Web Store.

**Proposed URL:** https://nutchanon.org/gh-x-html-privacy
**Suggested Svelte route:** `src/routes/gh-x-html-privacy/+page.svelte` (or
`src/routes/privacy/gh-x-html/+page.svelte` if you want to keep a /privacy/
prefix for future policies).

---

## Page title

Privacy policy — gh-x-html Chrome extension

## Body

**Last updated: 2026-05-30**

The `gh-x-html` Chrome extension renders inline videos, audio, and
sandboxed HTML inside GitHub comments. This page describes exactly what
the extension reads, what it stores, and what it sends — which is very
little.

### What the extension stores

The extension stores a single value in `chrome.storage.sync`:

- **`trustedAuthors`** — an array of GitHub login strings (e.g.
  `["ninyawee", "alice", "bob"]`). This is the per-user allowlist that
  decides which comment authors get their media links and `x-html` fences
  rewritten. It is seeded on first install with your own GitHub login,
  read from the `<meta name="user-login">` element on github.com. You can
  add or remove logins through the extension popup.

Because `chrome.storage.sync` is synced by your signed-in Chrome profile,
the same allowlist follows you across the browsers where you're signed in
with the same Google account. Google's `chrome.storage.sync` mechanism is
the only thing that touches your allowlist server-side — the gh-x-html
extension itself does not send your allowlist anywhere.

The extension does **not** store, log, or transmit:

- the contents of any GitHub comment, fence, or media URL
- your GitHub username (beyond seeding the allowlist on first install)
- any analytics, telemetry, error reports, or usage data
- any other field from `chrome.storage` or `chrome.cookies`

### What the extension reads

When you visit a `github.com` page, the content script reads the visible
DOM of comments to:

1. find each comment's author login (via GitHub's existing DOM markup)
2. check whether that login is in your local allowlist
3. if it is, rewrite the comment's fenced `x-html` blocks into sandboxed
   `<iframe>` elements, and rewrite `.mp4` / `.webm` / `.mov` / `.mp3` /
   `.m4a` / `.ogg` URLs into `<video>` / `<audio>` players

All of this runs locally in your browser. None of the comment content,
author logins, or media URLs leaves the page.

### What the extension sends over the network

Nothing.

The extension makes no fetch calls, no XHR requests, no WebSocket
connections, and no DNS lookups of its own. There is no analytics
endpoint, no error-reporting endpoint, no update-check endpoint.

The sandboxed `<iframe>` elements created by the extension may, of
course, load images, fonts, CSS, or scripts from URLs the comment author
typed into the fence (for example, a Pico CSS CDN link). That network
activity is initiated by the iframe's own document — not by the
extension — and runs inside an opaque-origin sandbox (no GitHub cookies,
no parent-DOM access).

### Permissions

The extension requests the minimum set of Chrome permissions needed to
do the above:

- **`storage`** — to read and write the `trustedAuthors` allowlist
- **`scripting`** — used once, inside the popup, to read your GitHub
  login from the active tab so the popup can show it to you
- **`activeTab`** — to identify the currently-focused GitHub tab for
  that one-shot read
- **`https://github.com/*`** (host permission) — required so the content
  script can run on GitHub pages and rewrite comment DOM

### Third-party services

The extension does not integrate with any third-party service.
`chrome.storage.sync` is provided by your own signed-in Chrome profile;
that is Google's infrastructure, not ours.

### Children

The extension is a developer tool with no audience-targeting or content
of its own. It performs the same DOM rewriting regardless of who is
using it.

### Changes to this policy

This policy may be updated when the extension's data behavior changes.
Material changes will be reflected in the "Last updated" date at the top
of this page. The history of edits lives in the open-source repo:
https://github.com/ninyawee/gh-x-html

### Contact

Source code, issues, and contact:
[github.com/ninyawee/gh-x-html](https://github.com/ninyawee/gh-x-html).
For other inquiries: life.particles@gmail.com.

---

## Suggested Svelte route stub

```svelte
<!-- src/routes/gh-x-html-privacy/+page.svelte -->
<svelte:head>
  <title>Privacy policy — gh-x-html</title>
  <meta name="description" content="Privacy policy for the gh-x-html Chrome extension. No data leaves the user's browser." />
</svelte:head>

<article style="max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6;">

# Privacy policy — gh-x-html Chrome extension

<!-- paste the body section above here -->

</article>
```

Once the page is live at `https://nutchanon.org/gh-x-html-privacy`, paste
that exact URL into the CWS dashboard's "Privacy policy" field.
