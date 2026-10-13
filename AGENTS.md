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

## Settings design

Venus settings should feel like part of Discord: simple, modern and calm, never a wall of switches. Since 1.10.0
every screen follows these rules. Follow them for every new feature and every change to an existing one.

### Fewer, better settings

- **One main switch per feature.** It sits on the Features list. Only add options that most users would actually
  change. Don't add an option because something *could* be configurable.
- **Remove options that are useless, near useless or confusing.** If an option only matters in a rare case, does
  something the main switch could do by itself, or needs a paragraph to explain, pick the better behaviour and
  drop the option. 1.10.0 removed Always send links, Removing link previews, Color webhooks by name and
  Profile-colored send button this way.
- When you remove an option, take its key out of `settings` and `featureFor`. An older settings file that still
  has it is then ignored, and nothing else needs migrating. Say so under 🔧 Improvements in the changelog.
- Every feature starts off. Options inside a feature keep sensible defaults, so turning the feature on does what
  its title says straight away.

### The Features list

- Rows are grouped by where you notice them: **Messages, Sending, People, Servers, Appearance, Quests**. Put a
  new feature in the group that fits. Add a group only when none does.
- Every row has its own Discord icon from `FEATURE_ICONS`: a design-system icon module that exports exactly that
  name (check it with `scripts/hbc`). Never reuse another feature's icon.
- A feature with options is a `withOptions` row: the switch and a button to its page. A feature without options
  is a plain `toggle`.

### Titles and descriptions

- **Titles say what it does, in plain words**, at most 40 characters: "Keep deleted messages", "Send long
  messages", "Hide the gift button". Use sentence case and no full stop. Never use a plugin or code name
  (FreeNitro, NoDelete, Pastelize).
- **Descriptions are one short line**, at most about 130 characters. They cover what the user will see, then
  anything important: a limit, what leaves the phone, what it needs. For example: "Stickers and emojis you'd need
  Nitro for are sent as a link, which shows up in chat as the sticker or emoji image."
- Write for someone who has never heard of the feature. Use "you", say "your phone" (not "the device"), and
  don't use words like "spoof", "hook", "prelude" or "endpoint".
- Credits ("Based on … by …") go in the Morphe description and README, not in the Venus row.

### Option pages

Build pages from the shared helpers in `bootstrap.js`, in this order:

1. `statusCard`: one or two plain lines of live status, when the feature has any ("3 deleted messages and 1
   edited message kept until Discord restarts."). When the feature is off it says "Turned off. Switch it on in
   Features to start."
2. Groups of `switchRow`s with short group titles (Display, Storage, Limit…). Use `radioGroup` for a choice of
   one, never check-marked rows.
3. `actionRow` under **Manage** for one-time actions, like clearing what the feature saved. A destructive action
   uses the danger style, is disabled when there's nothing to act on, and always asks first with `confirmAction`.
4. `footnote`: muted small text for anything else worth knowing. Keep it to a sentence or two.

The page's switches grey out while the main switch is off. The page title is short ("Deleted messages", "Tap
gestures").

### Keeping everything in step

- The feature's name is **the same in Venus and in Morphe**: the Venus row title, the Morphe patch `name` in
  `DiscordPatches.kt` and the README features table. Morphe patches sit in the **Features** category. The
  Morphe description is the Venus description, plus any credit.
- Update `README.md` (features table and "Good to know") and the tests in `tests/runtime.test.cjs` whenever a
  title, group or option changes. The Features list test checks title and description length and that each icon
  is unique.
