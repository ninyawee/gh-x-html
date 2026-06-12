# Releasing

Releases are automated by [`.github/workflows/release.yml`](../.github/workflows/release.yml),
triggered by pushing a `vX.Y.Z` tag. CI ([`ci.yml`](../.github/workflows/ci.yml))
validates every PR and push to `main` so the package is always buildable.

## Cut a release

1. Bump the version in [`manifest.json`](../manifest.json).
2. Move the `## [Unreleased]` notes in [`CHANGELOG.md`](../CHANGELOG.md) into a
   new `## [X.Y.Z] — YYYY-MM-DD` section (the `bump` skill does this).
3. (Recommended) run the smoke test locally — CI does not:
   ```bash
   bun smoke-test.mjs
   ```
4. Commit, then tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

The workflow then:

1. checks `manifest.json` version == the tag (fails the release otherwise),
2. pulls the `## [X.Y.Z]` section from `CHANGELOG.md` for the release notes
   (fails if there's no section),
3. builds `dist/gh-x-html-X.Y.Z.zip` via `scripts/build-zip.sh`,
4. creates the GitHub Release with that zip attached,
5. uploads & auto-publishes the zip to the Chrome Web Store.

## Chrome Web Store auth (one-time)

The publish step needs Google OAuth credentials for the Web Store API. Until
they are set, the GitHub Release still ships and the publish step is skipped
with a warning — so the pipeline never hard-fails before auth is wired up.

Set these in **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `CWS_CLIENT_ID` | OAuth client ID |
| Secret | `CWS_CLIENT_SECRET` | OAuth client secret |
| Secret | `CWS_REFRESH_TOKEN` | OAuth refresh token |
| Variable | `CWS_EXTENSION_ID` | *(optional)* the listing ID; defaults to the published `ibmlgnkgaljnihdhpkgdlhklopilkjfk` |

To mint the OAuth credentials, follow
[`chrome-webstore-upload`'s setup guide](https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md):
create a Google Cloud OAuth client, enable the Chrome Web Store API, and
exchange an auth code for a refresh token.

## Notes

- The Web Store review can take hours to days; `--auto-publish` queues the new
  version for review and publishes once approved.
- A re-run of the same tag will fail at the GitHub Release step (the release
  already exists). To re-release, delete the release + tag first, or bump to a
  new patch version.
