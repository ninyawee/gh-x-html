# Chrome Web Store listing — gh-x-html v0.1.11

**Published:** https://chromewebstore.google.com/detail/gh-x-html/ibmlgnkgaljnihdhpkgdlhklopilkjfk

The copy that shipped to the Chrome Web Store developer dashboard. All fields
below are sized against the CWS limits as of 2026-05.

---

## Item name (≤ 75 chars)

> gh-x-html — inline video & rich HTML in GitHub comments

(58 chars. The manifest name is `gh-x-html`; the store lets you set a longer
display name on top of it.)

---

## Short description (≤ 132 chars)

> Plays third-party video, audio, and sandboxed HTML inline inside GitHub
> issue / PR comments — gated by an author allowlist.

(128 chars.)

---

## Detailed description

GitHub's markdown sanitizer flattens `<video>` tags, strips `<style>`, and
turns rich HTML into a wall of escaped source. That means the artifact you
actually want to show in a code review — the bug recording, the Playwright
HTML report, the release dashboard, the ADR mockup — gets posted as a Drive
link or a screenshot instead. Every reviewer pays the friction.

**gh-x-html** does the rendering GitHub refuses to do, client-side, gated by
who you trust:

- **Inline video / audio.** Markdown image links, plain links, and bare URLs
  pointing at `.mp4`, `.webm`, `.mov`, `.mp3`, `.m4a`, or `.ogg` become a
  `<video controls>` or `<audio controls>` rendered inside a sandboxed
  iframe. Works with R2, S3, any host outside `*.githubusercontent.com`.
- **Fenced HTML blocks.** A code block tagged ```` ```x-html ```` becomes a
  sandboxed `<iframe>` rendering the HTML inside. Use it for Playwright
  reports, status boards, ADR mockups, design comps — anything where the
  artifact tells the story better than a screenshot.

**Trust is per-author.** The extension only rewrites comments authored by
GitHub logins in your local allowlist (stored in `chrome.storage.sync`,
seeded on install with your own login from the GitHub page). Open the popup
to add coworkers. Untrusted authors' fences stay as plain code blocks; their
`.mp4` links stay as plain links.

**Security in one paragraph.** Every iframe is `srcdoc` with
`sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"`.
`allow-same-origin` is **never** set — that combination would be a sandbox
escape. Author scripts can run inside the iframe but the iframe is an opaque
origin: no GitHub cookies, no parent-DOM access, no top-frame navigation.
Reasoning lives in ADR-0002 and ADR-0003 in the open-source repo.

**What ships:** vanilla JavaScript, no build step, MV3 manifest, ~14 KB
shipped. Source: https://github.com/ninyawee/gh-x-html

---

## Single-purpose statement (one sentence)

> Rewrites media URLs and `x-html`-tagged code fences inside GitHub comments
> into inline `<video>` / `<audio>` players and sandboxed `<iframe>`
> renderings, but only for comments whose author is in the user's local
> trusted-authors allowlist.

---

## Category

**Developer Tools**

(Secondary: *Productivity*. Pick Developer Tools if the dashboard only
allows one.)

---

## Permission justifications

The dashboard asks for one paragraph per permission. Draft answers:

### `storage`

> The extension stores a single value in `chrome.storage.sync`:
> `trustedAuthors`, an array of GitHub logins. This is the allowlist that
> gates which comment authors get their media links and `x-html` fences
> rewritten. No other data is stored, and the extension transmits nothing
> off-device.

### `scripting`

> The popup uses `chrome.scripting.executeScript` exactly once — to read
> the `<meta name="user-login">` element from the active GitHub tab, so the
> extension can show the user their own GitHub login when editing the
> trusted-authors allowlist. The script runs only inside the popup's own
> click handler and only reads that single meta tag.

### `activeTab`

> The popup uses `chrome.tabs.query({active: true, currentWindow: true})`
> to find the currently-focused GitHub tab so that the one-shot
> `scripting.executeScript` call (described above) targets the right tab.
> The extension only acts on the active tab when the user has explicitly
> opened the popup.

### Host permission — `https://github.com/*`

> The content script needs to read and rewrite comment DOM inside GitHub
> issue, PR, discussion, and commit pages. Rewriting media URLs into
> `<video>` / `<audio>` elements and `x-html` fences into sandboxed
> iframes requires DOM access on every `github.com` page the user visits.
> The extension does not request access to any other host.

---

## Privacy practices section

The CWS dashboard now requires several yes/no answers. Recommended answers:

| Question | Answer |
|---|---|
| Personally identifiable information | **No** — we never collect names, emails, IDs |
| Health information | **No** |
| Financial / payment information | **No** |
| Authentication information | **No** |
| Personal communications | **No** (the extension only reads the public GitHub DOM on the user's own tab to find the comment author; the data never leaves the device) |
| Location | **No** |
| Web history | **No** |
| User activity | **No** |
| Website content | **Yes** — the content script reads the DOM of `github.com` pages to find comment authors and rewrite media links / fences. The data is processed locally and never transmitted. |

Single-purpose declaration (the box above privacy practices):
> This extension serves the single purpose of rewriting media links and
> `x-html` code fences inside GitHub comments into inline players and
> sandboxed iframes, gated by a per-user trusted-authors allowlist.

Remote code declaration:
> **No** — the extension ships with all its code in the package. The
> sandboxed iframes render HTML the comment author typed; that HTML may
> reference external CSS/images/JS, but those are loaded by the iframe,
> not by the extension itself.

Data usage certifications (must check all three):
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## Privacy policy URL

> https://nutchanon.org/gh-x-html-privacy

(Draft page text lives in `docs/store/privacy.md`. Publish it on
nutchanon-org and paste this URL into the dashboard's "Privacy policy"
field.)

---

## Visibility / distribution

**Recommendation:** ship "Unlisted" first so the link works for teammates
and the blog post, but the listing isn't search-indexed while we sand any
rough edges. Flip to "Public" after a few days of dogfooding.

Distribution regions: **All regions**. No region-specific behavior.

---

## Support email / website

- Support email: `life.particles@gmail.com`
- Website: `https://github.com/ninyawee/gh-x-html`

---

## Listing assets (already on disk)

| Slot | File | Notes |
|---|---|---|
| Store icon (128 × 128) | `icons/icon-128.png` | bundled in the zip |
| Small promo tile (440 × 280) | `docs/store/promo-small-440x280.png` | required |
| Large promo tile (920 × 680) | `docs/store/promo-large-920x680.png` | recommended |
| Marquee (1400 × 560) | `docs/store/promo-marquee-1400x560.png` | required only for featured |
| Screenshot 1 (1280 × 800) | `docs/store/screenshot-1-before-after.png` | **real capture** — same comment, raw source → rendered dashboard |
| Screenshot 2 (1280 × 800) | `docs/store/screenshot-2-dashboard.png` | **real capture** — the live Q2 dashboard rendered inline in issue #4 |
| Screenshot 3 (1280 × 800) | `docs/store/screenshot-3-video.png` | **real capture** — third-party `.mp4` playing inline as `<video controls>` |
