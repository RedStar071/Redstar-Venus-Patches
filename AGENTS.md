# Notes for agents working on Venus Patches

Read this before writing a release, a changelog entry or a pull request.

## Release notes

Morphe Manager shows "What's new" from `CHANGELOG.md` on `main` (it derives the URL from
`patches-bundle.json`). It splits each release into cards — **New**, **Fixes**, **Improvements**,
**Performance**, **App support** — with one row per bullet and the bold scope as the small label above
it, like Morphe Patches. That only works in the conventional-changelog format below. Anything else
shows as one grey "Changes" block.

Every release, old or new, uses exactly this shape:

```markdown
## [1.6.1](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.6.0...v1.6.1) (2026-10-11)

### ✨ New Features

* **Discord:** Add `Patch name` patch
* **Discord - NoDelete:** Show what an edited message said before

### 🐛 Bug Fixes

* **Discord - Message tap gestures:** Tapping your own message three times opens it for editing instead of deleting it ([#12](https://github.com/VenusIsJaded/Venus-Patches/issues/12))

### 🔧 Improvements

* **Discord - Venus settings:** Clearer setting descriptions

### ⚡ Performance Improvements

* **Discord - Hidden Channels:** Do less work while turned off

### 🚀 Updated App Support

* **Discord:** Add support for `348.10 - Stable`
```

Rules:

- **Heading:** `## [X.Y.Z](compare link) (YYYY-MM-DD)`, newest at the top. The date is in UTC. Nothing goes above
  the first heading. Morphe ignores a heading without the date.
- **Sections:** only the five above, in that order, each at most once. Leave out empty ones.
- **Bullets:** `* **Discord:** …` for the whole app, or `* **Discord - <Morphe patch name>:** …` for one patch.
  Use the patch name as it shows in Morphe (`NoDelete`, `Pastelize`, `Message tap gestures`, `Venus settings`…).
  One line, sentence case, no full stop, about 4–14 words.
- **Fixes describe the bug** as the user saw it ("Read all's error message starts with \"Error:\""), not the fix.
- Link an issue only when one exists: ` ([#37](https://github.com/VenusIsJaded/Venus-Patches/issues/37))`.
- **Never include:** "Good to know", "Install" or "How to update" sections, SHA-256 sums, test or patch-check
  results, notes about versions that weren't published or numbers that changed, internal module IDs, or
  "your settings carry over". Explanations belong in `README.md`, not in release notes.
- Keep each bullet short, but **list every change a user can see**: every new feature, every bug fixed (including
  settings that misbehaved) and every general change (wording, layout, defaults) under 🔧 Improvements.
  Don't drop a visible change to make the notes shorter. Merge only near-identical changes.
- A new feature means a minor version (1.6.0 → 1.7.0). Fixes and improvements only mean a patch version.
- Only list changes users can see. Internal work (docs, scripts, these notes) isn't mentioned.

## The GitHub release

The release body is that version's changelog entry and nothing else:

```bash
python3 scripts/release_notes.py --check                       # also run by scripts/build.py
python3 scripts/release_notes.py 1.6.1 > /tmp/notes.md
gh release create v1.6.1 patches/build/libs/patches-1.6.1.mpp --title "1.6.1" --notes-file /tmp/notes.md
```

- The title is just the version: `1.6.1`.
- Attach only `patches-X.Y.Z.mpp`.
- If you edit an entry in `CHANGELOG.md`, update that release's body to match with `gh release edit vX.Y.Z --notes-file`.

## Releasing a version

1. Bump `version`, `releaseTag` and `releaseAsset` in `gradle.properties`, and `const revision` in
   `patches/src/main/resources/venus/bootstrap.js` (the build fails if they differ).
2. Nothing to write for `patches-bundle.json`: its `description` is this version's `CHANGELOG.md` sections,
   which Morphe shows when its cached `CHANGELOG.md` doesn't list the new release yet. Never replace it with a sentence.
3. Add the `CHANGELOG.md` entry at the top, as above.
4. `python3 scripts/build.py`, then `python3 scripts/build.py --metadata-only` to write `patches-bundle.json`.
5. Update `README.md` if a feature or setting changed.

## Settings text

Every setting in Venus settings has a title (what it does) and a description (what else the user needs to
know: what it's based on, what it saves, what it can't do). Keep descriptions to one or two short sentences,
and keep `README.md` and the Morphe patch descriptions in `DiscordPatches.kt` saying the same thing.
