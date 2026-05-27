# Changelog

All notable changes to this extension are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows
[semver](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- New icon set and Chrome Web Store promo art in `docs/store/`.
- Repo prepared for public release: refreshed README, packaging script.

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

[Unreleased]: https://github.com/ninyawee/gh-x-html/compare/v0.1.9...HEAD
[0.1.9]: https://github.com/ninyawee/gh-x-html/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/ninyawee/gh-x-html/compare/v0.1.0...v0.1.8
[0.1.0]: https://github.com/ninyawee/gh-x-html/releases/tag/v0.1.0
[a2f8e0c]: https://github.com/ninyawee/gh-x-html/commit/a2f8e0c
[57fcb78]: https://github.com/ninyawee/gh-x-html/commit/57fcb78
[6b987f3]: https://github.com/ninyawee/gh-x-html/commit/6b987f3
[b40b5f8]: https://github.com/ninyawee/gh-x-html/commit/b40b5f8
[87e661f]: https://github.com/ninyawee/gh-x-html/commit/87e661f
