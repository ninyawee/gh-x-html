# Trust model: render only fences written by allowlisted GitHub users

The extension rewrites `x-html` fences only when the surrounding comment was authored by a user in the trusted-author allowlist (stored in `chrome.storage.sync`). The default allowlist contains exactly one entry: the currently signed-in GitHub user, derived from `<meta name="user-login">` in the page head.

**Why not "render everything":** even though the sandbox (ADR-0002) prevents code from breaking out, it doesn't prevent visual deception. A stranger commenting on a public issue could drop a `x-html` fence that mimics GitHub chrome — fake merge buttons, fake review summaries, spoofed user avatars. The trust model limits the rich-render privilege to authors you've already vouched for.

**Why default to self only:** zero-trust default. The popup is one click away to add `@coworker` etc.

**Considered alternatives:**

- **Render everything, trust the sandbox.** Sandbox catches code execution, not UI deception. Rejected.
- **Render-only-for-self, no popup.** Too restrictive for collaboration with people whose artifacts you trust.

**Consequences:**

- On a fresh install, viewing your own PR comments works immediately. Viewing someone else's PR shows no rendered content until you add them.
- The trust grant is per-GitHub-user, not per-repo. If you trust `@alice`, you're trusting her fences across every github.com page you read.
- "Anonymous" comments (deleted users, github-actions[bot], etc.) never render unless you add their login.
