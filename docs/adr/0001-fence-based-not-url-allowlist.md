# Rich content comes from fenced code blocks, not from `<a href>` rewriting

The original handoff proposed turning allowlisted `<a href>` links (R2 URLs, raw.githubusercontent media, `file:///tmp/in-html/*`) into inline `<video>`/`<iframe>` elements. We rejected that in favor of letting the comment author paste the HTML source directly into a fenced code block tagged `x-html`.

**Why the pivot:** the `<a href>` rewrite couldn't help with the actual use case — inline-rich `/in-html` artifacts whose contents change every turn. Even the media case is subsumed: a `x-html` fence can contain `<video src="https://…/clip.mp4" controls>` and that just works. The fence approach also keeps the extension's trust surface to "render text the comment author already typed," which is a much smaller threat model than "read files from the user's filesystem."

**Consequences:**

- The extension never reads `file://` URLs. The `file://` host permission is not requested. The user is not asked to enable "Allow access to file URLs."
- For pasting one of those `/tmp/in-html/*.html` artifacts into a comment, the author opens the file, copies the body, and pastes inside a `x-html` fence. The artifact is then captured in the comment itself — survives even without the extension installed (just as unrendered source).
- We are not in the URL-allowlist business. If someone wants `<a href="*.mp4">` to auto-embed, that's a different extension.
