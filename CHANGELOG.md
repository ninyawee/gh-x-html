# Changelog

All notable changes to this extension are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows
[semver](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.11] — 2026-05-30

First public release on the
[Chrome Web Store](https://chromewebstore.google.com/detail/gh-x-html/ibmlgnkgaljnihdhpkgdlhklopilkjfk).

### Changed
- **New icon.** Refreshed the mark to a play-bracket — `<` `>` code chevrons
  hugging a glowing cyan play triangle, on a deep indigo→magenta gradient.
  Reads cleanly all the way down to 16 px. Source stays a hand-authored
  `icons/icon.svg`; the PNG sizes are rendered from it.
- **Cohesive store + repo art.** Regenerated the promo tiles
  (440 × 280, 920 × 680) and the 1400 × 560 marquee in the new style, plus a
  README hero banner (`docs/store/github-hero.png`) and a 1280 × 640 GitHub
  social-preview card (`docs/store/github-social.png`).
- **Public-launch docs.** Added the Chrome Web Store listing copy
  (`docs/store/listing.md`) and the privacy-policy page text
  (`docs/store/privacy.md`).

## [0.1.10] — 2026-05-29

### Fixed
- Decode `camo` proxy URLs and size the media iframe by the video's aspect
  ratio ([b9ab907]).

## [0.1.9] — 2026-05-27

### Fixed
- Render media inside a `chrome-extension://` iframe so GitHub's page CSP
  (`media-src` restricted to `github.com` / `*.githubusercontent.com`) no
  longer blocks third-party `.mp4`/`.webm`/`.mp3` URLs. Same escape hatch as
  the fence path. Smoke-test now asserts the media iframe contains a real
  `<video controls>` with the correct src ([a2f8e0c]).

## [0.1.8] — 2026-05-27

### Fixed
- Defer scans until `loadAllowlist` resolves so first-paint comments don't get
  stamped untrusted on a race ([57fcb78]).
- Render fences inside a `chrome-extension://` frame so GitHub's CSP can't
  leak into the iframe ([6b987f3]).
- Seed self into the allowlist even when storage already holds an empty array
  ([b40b5f8]).
- Stop the issue-body selector from excluding the header-author hovercard
  ([87e661f]).

## [0.1.0] — 2026-05-27

### Added
- Initial release.
- `x-html` fenced code blocks render into sandboxed `srcdoc` iframes.
- `.mp4` / `.webm` / `.mov` / `.mp3` / `.m4a` / `.ogg` links rewrite to
  inline `<video>` / `<audio>`.
- Author allowlist gating, stored in `chrome.storage.sync`, seeded with the
  signed-in GitHub login on first install.
- `MutationObserver` re-scan and iframe auto-resize.

[Unreleased]: https://github.com/ninyawee/gh-x-html/compare/v0.1.11...HEAD
[0.1.11]: https://github.com/ninyawee/gh-x-html/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/ninyawee/gh-x-html/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/ninyawee/gh-x-html/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/ninyawee/gh-x-html/compare/v0.1.0...v0.1.8
[0.1.0]: https://github.com/ninyawee/gh-x-html/releases/tag/v0.1.0
[b9ab907]: https://github.com/ninyawee/gh-x-html/commit/b9ab907
[a2f8e0c]: https://github.com/ninyawee/gh-x-html/commit/a2f8e0c
[57fcb78]: https://github.com/ninyawee/gh-x-html/commit/57fcb78
[6b987f3]: https://github.com/ninyawee/gh-x-html/commit/6b987f3
[b40b5f8]: https://github.com/ninyawee/gh-x-html/commit/b40b5f8
[87e661f]: https://github.com/ninyawee/gh-x-html/commit/87e661f
