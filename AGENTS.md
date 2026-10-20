# Notes for agents working on Venus Patches

Read this before writing a release, a changelog entry or a pull request.

## Release notes

Morphe Manager shows "What's new" from `CHANGELOG.md` on `main` (it derives the URL from
`patches-bundle.json`). It splits each release into cards — **App support**, **New**, **Fixes**,
**Improvements**, **Performance** — with one row per bullet and the bold scope as the small label above
it, like Morphe Patches. That only works in the conventional-changelog format below. Anything else
shows as one grey "Changes" block.

Every release, old or new, uses exactly this shape:

```markdown
## [1.6.1](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.6.0...v1.6.1) (2026-10-11)

### 🚀 Updated App Support

* **Discord:** Add support for `348.10 - Stable`

### ✨ New Features

* **Discord:** Add `Patch name` patch
* **Discord - NoDelete:** Show what an edited message said before

### 🐛 Bug Fixes

* **Discord - Message tap gestures:** Fixed tapping your own message three times opening the editor instead of deleting it ([#12](https://github.com/VenusIsJaded/Venus-Patches/issues/12))

### 🔧 Improvements

* **Discord - Venus settings:** Tons of UI changes across every settings page, including a theme gallery and livelier previews
* **Discord - Disable analytics:** Also block session heartbeats, search tracking and impression events

### ⚡ Performance Improvements

* **Discord - Hidden Channels:** Do less work while turned off
```

Rules:

- **Heading:** `## [X.Y.Z](compare link) (YYYY-MM-DD)`, newest at the top. The date is in UTC. Nothing goes above
  the first heading. Morphe ignores a heading without the date.
- **Sections:** only the five above, in that order, each at most once. Leave out empty ones.
- **App support always comes first.** `### 🚀 Updated App Support` is the first section of any release that has it,
  so the Discord version a release works with is the first thing you read. `scripts/release_notes.py --check` fails
  on any other order.
- **Summarize UI changes in one bullet.** Looks, layout, previews, animations, page redesigns, wording and other
  settings polish go in **one** bullet under 🔧 Improvements, like `* **Discord - Venus settings:** Tons of UI changes
  across every settings page, including …`, naming at most three or four highlights. Never write a bullet per page,
  per preview or per row. Still give their own bullets to new things you can do (✨ New Features), options that were
  removed or changed behavior (🔧 Improvements), and UI bugs users actually hit (🐛 Bug Fixes).
- **Bullets:** `* **Discord:** …` for the whole app, or `* **Discord - <Morphe patch name>:** …` for one patch.
  Use the patch name as it shows in Morphe (`NoDelete`, `Pastelize`, `Message tap gestures`, `Venus settings`…).
  One line, sentence case, no full stop, concise and informative (around 5–22 words).
- **Bug fixes always start with `Fixed` and give clear detail:** every bullet under `### 🐛 Bug Fixes` must begin
  with `Fixed …` and clearly explain both what went wrong and what it prevented or caused (for example,
  `Fixed tapping your own message three times opening the editor instead of deleting it`), so readers never have
  to guess whether the behavior was a bug that was fixed or an intentional change.
- Link an issue only when one exists: ` ([#37](https://github.com/VenusIsJaded/Venus-Patches/issues/37))`.
- **Never include:** "Good to know", "Install" or "How to update" sections, SHA-256 sums, test or patch-check
  results, notes about versions that weren't published or numbers that changed, internal module IDs, or
  "your settings carry over". Explanations belong in `README.md`, not in release notes.
- **Include every meaningful change:** list every new feature, every bug fix (including privacy leaks, background
  disconnects, or settings that misbehaved), general improvements and **privacy additions** under 🔧 Improvements,
  and **startup, patching, memory, or runtime speedups** under ⚡ Performance Improvements. Don't omit privacy
  coverage additions or performance work as "internal": users care about what tracking is stopped and how fast
  Discord starts and runs. Only leave out repo-only chores (docs, test scripts, CI config).
- A new feature means a minor version (1.6.0 → 1.7.0). Fixes, privacy additions, and performance improvements
  mean a patch version.
- Compare with the **previous release**, not with earlier commits. A bug in a brand-new feature added in the same
  release was never seen by users, so don't list it as a separate bug fix; however, privacy additions, fixes to
  existing patches, and app/startup performance improvements shipped in the release should always be listed.
- **Never list bugs that only existed inside the pull request.** Before writing a `Fixed …` bullet, check the
  previous release's code (`git show vX.Y.Z:patches/src/main/resources/venus/bootstrap.js`) and confirm users really
  had the bug. Breakage caused by work in the same pull request (a new feature, a refactor, or a port to a new Discord
  version) that was fixed before release isn't a fix. Ports are the usual trap: the previous release supported the
  old Discord version, so anything that only broke on the new one never reached users. For example, 1.16.0 ported to
  Discord 349.9, and Keep deleted messages (and every feature listening to Discord's events) hooking the wrong module,
  and theme colors 349.9 renamed, were only broken inside that pull request, so neither is in the 1.16.0 notes. The
  same goes for ReviewDB cards failing to render on 348.10 in 1.3.7.
- **Write the notes from the exact difference between the last release and this one, never from the pull request.**
  Before writing an entry (and before a pull request description that lists fixes), run
  `git log --oneline vX.Y.Z..HEAD` and `git diff --stat vX.Y.Z HEAD` against the previous release tag, and for every
  candidate bullet confirm with `git show vX.Y.Z:<file>` that the previous release really had the behavior. Only what
  changed for someone updating from that release goes in. A fix for something a commit in the same range broke (for
  example 1.17.0's Backup defaults fix, which repaired a regression from that release's own startup speedup) and every
  fix to a feature that is new in this release are left out; the new feature gets one ✨ bullet instead.

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
  When a rule changes, rewrite every past entry to follow it and update every published release body.

## Releasing a version

1. Bump `version`, `releaseTag` and `releaseAsset` in `gradle.properties`, and `const revision` in
   `patches/src/main/resources/venus/bootstrap.js` (the build fails if they differ).
2. Nothing to write for `patches-bundle.json`: its `description` is this version's `CHANGELOG.md` sections,
   which Morphe shows when its cached `CHANGELOG.md` doesn't list the new release yet. Never replace it with a sentence.
3. Add the `CHANGELOG.md` entry at the top, as above.
4. `python3 scripts/build.py` (which compacts `bootstrap.js`, verifies HBC98 syntax/bytecode compilation when `hermesc` is present, compiles all extensions and patches, checks every language file, and runs `PrivacyTestKt`), then `python3 scripts/build.py --metadata-only` to write `patches-bundle.json`.
5. Update `README.md` if a feature or setting changed.

## How the Venus runtime is compiled & injected (HBC98 architecture)

Discord on Android runs React Native in **Bridgeless mode** (`com.facebook.react.runtime.ReactInstance`).
In Bridgeless mode, calling `ReactInstance.loadJSBundle` twice (for example, loading a separate `bootstrap.hbc` file before `assets/index.android.bundle`) is **unsafe**: the first `loadJSBundle` call triggers `ReactHostImpl`'s completion callback early, marking the React instance ready and flushing queued native module calls before Discord's own bundle has registered `AppRegistry` or `RCTDeviceEventEmitter`.

Instead, Venus uses **single-bundle HBC98 bytecode injection** (`HbcPrelude.kt`) combined with **in-place HBC98 function stubbing** (`HbcPrivacy.kt`):

1. **Build time (`scripts/build.py` + `hermesc`)**:
   - `scripts/build.py` parses and compacts `patches/src/main/resources/venus/bootstrap.js` with Terser (`compress: false, mangle: false, ascii_only: true`) into `patches/build/bootstrap.js`, and validates it with `hermesc -emit-binary` (HBC98 / `250829098.0.19`) so syntax and Hermes compatibility are guaranteed before packaging `bootstrap.js` into the `.mpp`.
2. **Patch time inside Morphe Manager (`HbcPrelude.kt` & `HbcPrivacy.kt`)**:
   - Because each user selects their own set of Morphe patches in Morphe Manager, the `/*__FEATURES__*/` configuration object in `bootstrap.js` is only known when Morphe patches the APK on the user's phone.
   - `HbcPrelude.inject` embeds the user's `/*__FEATURES__*/` JSON into the compacted `bootstrap.js`, decomposes the script into existing ASCII strings from `index.android.bundle`'s string table using dynamic programming (minimum bytecode bytes), and emits **native HBC98 bytecode instructions** (`NewArray`, `LoadConstString`/`LoadConstStringLongIndex`, `DefineOwnInDenseArray`/`DefineOwnInDenseArrayL`, `Call2 Array.prototype.join`, `Call2 eval`) directly at the top of global function `#0` in `assets/index.android.bundle`.
   - `HbcPrivacy.apply` overwrites 104 pinned analytics, telemetry, and crash-reporting HBC98 functions in-place with 4-to-23-byte register-safe HBC98 stubs (`returnUndefined`, `returnFalse`, `returnEmptyObject`, `returnEmptyString`, `callParam2`, `resolvedPromise`, `resolvedEmptyObject`).

## Upgrading to a new Discord Android version

Every Discord version upgrade touches four layers that are pinned to the exact APK and `assets/index.android.bundle`:
1. **Supported version string** (`349.9 - Stable`) in `DiscordPatches.kt`, `DISCORD_VERSION` in `bootstrap.js` (shown on the About page) and `README.md`. Keep all three the same.
2. **HBC98 bundle & global `#0` constants** in `HbcPrelude.kt` and `HbcPrivacy.kt`.
3. **Metro module IDs** in `patches/src/main/resources/venus/bootstrap.js`.
4. **Pinned HBC98 privacy targets (104 functions)** in `HbcPrivacy.kt` and **pinned native DEX methods (137 methods)** in `PrivacyPatches.kt`.

Follow this step-by-step checklist whenever upgrading the supported Discord version:

### Step 1: Extract the new `.apkm`

```bash
mkdir -p work/new
unzip -p Discord-NEW.apkm base.apk > work/new/base.apk
unzip -o work/new/base.apk assets/index.android.bundle -d work/new
```

Verify that the Hermes bytecode version in `work/new/assets/index.android.bundle` is still HBC98 (`version = 98` at byte offset 8):
```bash
python3 -c "import struct; b=open('work/new/assets/index.android.bundle','rb').read(32); print('HBC version:', struct.unpack_from('<I', b, 8)[0])"
```

### Step 2: Run the automated HBC porting audit (`scripts/hbc/port_check.py`)

```bash
python3 scripts/hbc/port_check.py work/new/assets/index.android.bundle
```

`port_check.py` inspects the new bundle and outputs three sections:

1. **Section 1 — Bundle & Global Function Constants**:
   - Copy `ORIGINAL_SHA256` into `HbcPrivacy.kt`.
   - Copy `FUNCTION_COUNT`, `GLOBAL_OFFSET`, `GLOBAL_SIZE`, `GLOBAL_SHA256`, `JOIN_ID`, and `EVAL_ID` into `HbcPrelude.kt`.
   - Copy `PROMISE_ID`, `RESOLVE_ID`, and `EMPTY_ID` into `HbcPrivacy.kt`.
   - Check `Global #0 frame=..., reads=..., flags=...`:
     - Verify global `#0` still has `flags == 0x12` (compact header, no exception handlers) and `frame >= 4` so `R_ARR=0, R_TMP=1, R_FN=2, R_THIS=3` fit inside its existing frame without modifying the 12-byte header.

2. **Section 2 — Bootstrap Metro Module Verification**:
   - Checks all Metro modules hooked (`holdDefine` / `onDefine`) or demand-loaded (`inspectedExport` / `global.__r`) in `bootstrap.js`.
   - Discord embeds source file paths (`fileFinishedImporting(moduleId, "path/to/File.tsx")`) in almost every module. If any module ID shifted in the new version, `port_check.py` prints `[MOVED/CHECK]` along with `candidate_in_new_bundle=<new_id>`.
   - For any shifted or newly added module ID:
     - Inspect the candidate with `B.show(new_id)` and `B.exports(new_id)` using `scripts/hbc/hbc.py`.
     - **Always update both** `BOOTSTRAP_MODULES` in `scripts/hbc/port_check.py` **and** the module map file (`scripts/hbc/349.9-module-map.md`, or the new version's `<version>-module-map.md`), along with `patches/src/main/resources/venus/bootstrap.js`.
     - Also check the icon module IDs in `FEATURE_ICONS` inside `bootstrap.js`:
       ```bash
       python3 -c "
       import sys, re; sys.path.insert(0,'scripts/hbc'); from hbc import Bundle
       B = Bundle('work/new/assets/index.android.bundle')
       js = open('patches/src/main/resources/venus/bootstrap.js').read()
       for name, mid in re.findall(r'(\w+):\s*\[(\d+),\s*\"(\w+)\"\]', js): pass
       for m, prop in re.findall(r'\[(\d+),\s*\"(\w+)\"\]', js):
           mid = int(m)
           if prop not in B.strs(mid):
               cands = [k for k, p in B.paths().items() if p.endswith('/' + prop + '.tsx')]
               print(f'Icon {prop} moved from {mid} -> {cands}')
       "
       ```

3. **Section 3 — HbcPrivacy Target Verification**:
   - Checks all 104 pinned HBC98 functions across `analytics` (48), `telemetry` (40), and `crash` (16).
   - Regenerate the Kotlin `Target(...)` lists with `--locate`:
     ```bash
     python3 scripts/hbc/privacy_targets.py work/new/assets/index.android.bundle --locate
     ```
   - For the 3 anonymous/unnamed targets (`#17776` `__timingFunction` in `metroRequire`, `#80849` `MetricReporter.send`, `#111344` `Rust Poller.send`), locate them if their function IDs shifted:
     - `__timingFunction` (`#18142` in 349.9): disassemble global `#0` (`B.h.dis(B.h.func(0))[:150]`) and look for `PutByIdLoose ... '__timingFunction'` right after `CreateClosure`.
     - `MetricReporter.send` (`#81910` in 349.9): check `B.tree(mid)` of `MetricReporter.tsx` and its dependencies for the `send` method.
     - `Poller.send` (`#112524` in 349.9): search `B.fnmods('send')` for the module referencing `'NativePollerModule'` or crash reporting.
   - **Critical safety invariants for every `HbcPrivacy` target**:
     - Must have an expanded header (`flags & 0x20 != 0`) so its 32-bit `offset` and `size` live in the 40-byte large header.
     - Must NOT have exception handlers or generator/async flags (`flags & 0xc8 == 0`), because Hermes puts a `uint32 excCount` trailer immediately after `offset + size` when `hasExceptionHandler` (`0x40`) is set.
     - If stubbed with `returnEmptyObject`, `callParam2`, `resolvedPromise`, or `resolvedEmptyObject`, its `firstPointerRegister` (`num + nonptr` in the expanded header) must be `<= lowestRegisterWrittenByStub` (`0` for `returnEmptyObject`/`callParam2`, `0` for `resolvedPromise`/`resolvedEmptyObject` which write `r0, r1, r2`), and `frame` must be large enough for the stub's registers. (`PrivacyTest.kt` automatically enforces all of these invariants against the real APK!)
   - Update the `returnEmptyObjectIds` (`expandEventProperties`, `getLocation`), `returnFalseIds` (`shouldCollectMetrics`, `isTracing`, `shouldRun`, `isZoomedExperimentEnabled`, `isJankScreenReportingEnabled`, `isNavigationTTIEnabled`), `callParam2Ids` (`__timingFunction`, `timeRequire`), and `resolvedEmptyObjectIds` (`track`, `send`) sets in `HbcPrivacy.kt` and `tests/native/PrivacyTest.kt` with the new function IDs.

### Step 3: Verify Native DEX Fingerprints & Guard Targets (`PrivacyPatches.kt` & `DiscordPatches.kt`)

Compile and run `PrivacyTestKt` against the new `base.apk`:

```bash
VENUS_ORIGINAL_APK=/home/user/webapp/work/new/base.apk python3 scripts/build.py
```

- `PrivacyTestKt` loads every `classes*.dex` from `VENUS_ORIGINAL_APK` via Morphe's DEX parser (`MultiDexFileReader`), verifies all 104 HBC targets against `assets/index.android.bundle`, cross-checks every HBC98 opcode constant against `scripts/hbc/ops.txt`, and checks that all **137 native DEX method targets** in `PrivacyPatches.kt` (`crash`, `telemetry`, `advertising`, `attribution`) exist with exact matching parameter types, return types, register counts (`registerCount - paramSlotCount >= requiredTempRegs`), and expected opcodes.
- Also check `DiscordPatches.kt` native methods (`BundleUpdater.checkForUpdateAndReload`, `BundleUpdaterManager.checkForUpdateAndReload`, `ChatEventHandler`, `ReactNativeFontManager`, `EmojiTextView`, `TTIMetrics`, `MobileVoiceOverlay`, `SavedLocales`):
  - If any DEX class or method signature changed in the new Discord APK, use `tests/native/DexInspect.kt` to inspect the updated class/method descriptors in `work/new/base.apk`:
    ```bash
    work/tools/kotlinc/bin/kotlinc -cp work/tools/morphe.jar tests/native/DexInspect.kt -d /tmp/dexinspect.jar
    java -cp /tmp/dexinspect.jar:work/tools/morphe.jar DexInspectKt work/new/base.apk "Sentry"
    ```

### Step 4: End-to-End Patch & Bytecode Verification (`HbcPreludeTest.kt` & `VerifyApk.kt`)

1. Bump the version string in `DiscordPatches.kt` (`compatibleWith("com.discord"("NEW_VERSION - Stable"))`) and `README.md`.
2. Run the full build and test suite with `VENUS_ORIGINAL_APK` set:
   ```bash
   VENUS_ORIGINAL_APK=/home/user/webapp/work/new/base.apk python3 scripts/build.py
   ```
3. Run `HbcPreludeTestKt` to verify that `HbcPrelude.inject` + `HbcPrivacy.apply` commute cleanly on the new bundle and that every relocated/stubbed instruction disassembles without error:
   ```bash
   work/tools/kotlinc/bin/kotlinc -no-stdlib -no-reflect -Xfriend-paths=patches/build/classes.jar \
     -cp patches/build/classes.jar:work/tools/morphe.jar tests/native/HbcPreludeTest.kt -d patches/build/hbc-prelude-tests.jar
   java -Xmx512m -cp patches/build/hbc-prelude-tests.jar:patches/build/classes.jar:work/tools/morphe.jar \
     app.venus.patches.HbcPreludeTestKt work/new/assets/index.android.bundle patches/build/bootstrap.js
   ```
4. Patch the full `base.apk` using Morphe CLI (`work/tools/morphe.jar`) and run `VerifyApk.kt` to confirm every patch applies with zero warnings or errors.

## Settings design

Venus settings should feel like part of Discord: simple, modern and calm, never a wall of switches. Since 1.10.0
every screen starts from these rules. Use them for every new feature and every change to an existing one.

### These rules are a starting point, not a cage

The layouts, page order and styling below are what the user likes, so start from them. They are purely suggestions,
not fixed requirements. What the user wants most is the best-looking, easiest-to-use UI, and what they like won't
always be what looks or works best. Use your own judgement: if you believe something would look better or be easier
to use another way, do it that way, and say what you changed and why in the pull request. This covers the whole Venus
UI inside Discord, not only the settings pages: chat additions, buttons, sheets, toasts, previews and the Features list.

Change something only when it's genuinely better, though. Don't invent changes to look busy, and leave things alone when
the current design already works. Wherever a rule here touches something other than looks (a name staying the same in
Venus and Morphe, translations, tests, the module map), keep following it.

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
- **Descriptions are one short line**: aim for about 65 characters in English (at most 130), so they fit in one or
  two lines of the Features list in every language. Say what the user will see, then only what really matters (a
  limit, what leaves the phone, what it needs). For example: "Sends Nitro emojis and stickers as links that show as
  the image." Details belong on the feature's own page, and a restart is explained by the Reopen Discord dialog.
- Rows with their own page show a switch and a small arrow (`SubpageTrailing`). Keep the trailing side that narrow:
  anything wider takes width from the title and description, which then wrap.
- Write for someone who has never heard of the feature. Use "you", say "your phone" (not "the device"), and
  don't use words like "spoof", "hook", "prelude" or "endpoint".
- Credits ("Based on … by …") go in the Morphe description and README, not in the Venus row.

### Option pages

Every option page shares one look, set by the User activity notifications and Message highlights pages in 1.12.0:
calm, roomy and visual, built from Discord's own components so it feels like part of the app. Follow it for every
new page and every change to an existing one. Check each page yourself, on and off, against the rules below.

**Page order, top to bottom**

1. **Status card** (`statusCard(key, text, {title, IconComponent, leading})`): shown at the top of a page only when the
   feature is off (`offCard(key, Icon, feature)` — "Turned off" / "Turn it on here to start.", with Discord's own switch on the
   card so you never have to go back to Features), when a sub-option state
   needs calling out (e.g. every device indicator location turned off, or both emojis and stickers turned off), or when the
   feature has genuine live runtime state to report (who you're watching in User activity notifications, which account is
   signed in, Quest progress, ReviewDB account, active custom theme, translation engine status, or a non-zero count of kept
   deleted/edited messages). Never show a redundant "Turned on" or "Nothing kept yet" filler card at the top of a page when
   its preview or options below already speak for themselves.
2. **A live preview**, when the feature changes how something looks or what a gesture does: a small chat surface built with
   `chatPreview` + `previewMessage` that follows the settings below it as you change them (bar width and colors,
   edit history, pastel names, device icons, translation notes, link style). Previews use plain sample people and
   text, never real messages, and only the theme tokens from `useChatPreviewStyles`.
   Every preview is drawn as the part of Discord it changes: `previewScreen` with
   `previewHeader` (channel header with `ThreadIcon` / `MagnifyingGlassIcon` / `GroupIcon`), `previewInput` (message bar with `GiftIcon` and `ReactionIcon`) and `previewBar` (reply/edit bar with `@ ON` on replies), or that screen's
   own layout (member list, profile, channel list, message menu with 4 quick reactions + Add Reaction, dialog), using `usePreviewChrome()` tokens.
   - Include **Watch** (`useStory(active, () => [[waitMs, step, caption?], …], deps)` with `storyStrip(k, s, story)` under the
     preview) and **Try it** (`previewToggle(mode, setMode)` from `usePreviewMode()`, shown only while the feature is on)
     only when the feature involves a sequence of steps or gesture interactions in Discord (double-tap / triple-tap gestures,
     tapping a locked channel, opening the expression picker from the message bar to send a Nitro emoji or sticker, or holding
     a message to open its menu and tap Translate). Each Watch caption says in plain words what happens and stays up at least
     `readMs` (2.4–5 s); the strip shows the step number, a progress bar, the time and pause / start over.
   - Static visual features whose appearance is clear from a single chat picture (Keep deleted messages, Pastel name colors,
     Message highlights) show that static end-screen directly and update live as you flip the switches or pick colors below,
     without a Watch loop or Watch/Try it toggle. Show device indicators is directly interactive with its DM / Members / Profile
     switcher and Change Alex's devices button.
   - In Try it, a `previewTip` (Discord's brand tooltip) says what to do next, step by step, until everything your options allow has been tried.
   - Use sample art bundled in Discord (the Wumpus drawables) or plain sample people, never anything from your servers.
3. **Choices**, each group with a short title:
   - a choice of 2–4 short values (widths, who to watch): `venusSegmented` under a `groupTitle`;
   - a choice of one with explanations: `radioGroup`, every choice with a `rowIcon` (4th item);
   - on/off options: `switchRow(Switch, key, label, subLabel, rowIcon(id, "NameIcon"))`;
   - colors: a row of round swatches plus an "Any color" swatch that opens Discord's color picker
     (`showCustomColorPickerActionSheet` 14140), with a hex box only as a fallback;
   - people: rows with `avatarBubble` (status dot when known) and a trailing ✕ (`XSmallIcon`) to remove; never a
     list of IDs or "Tap to remove" text;
   - a text box with an action: `inputWithButton` (Discord's `Button` beside the field), never a separate
     "Add"/"Use" row under it.
4. **Manage**: `actionRow`s for one-time actions (clear, reset). Destructive ones use the danger style, are
   disabled (or hidden) when there's nothing to act on, and always ask first with `confirmAction`. A page that has
   options that can drift from the defaults gets "Reset to defaults".
5. **Footnote**: one or two muted sentences, only for what isn't obvious from the page.

**Rules**

- **Every switch and radio row has its own Discord icon** (`rowIcon`, a design-system icon module that exports
  exactly that name; check it with `scripts/hbc` and add it to `port_check.py` and the module map). Pick an icon
  that shows what the row does, not the feature's icon again. The Language list is the only exception.
- **Colors come from Discord's theme tokens through `useThemed(name, c => styles, darkFallback)`** (createStyles),
  never `ui.colors.X` straight in a style: those are token objects, not colors, and silently fall back. Each style
  set gets a unique name, and the fallback is Discord's dark theme. Status colors use `STATUS_HEX`.
- **Text uses Discord's `Text` (4833) variants**: titles `text-md/semibold` + `text-strong`, details
  `text-sm/medium` + `text-muted`. Cards are 16 radius, 16 horizontal padding, with `CARD_BACKGROUND_DEFAULT`.
- **Show, don't list**: summarize long lists (an avatar pile with "12 friends" rather than 12 checkboxes) and only
  expand them when the user chose to pick one by one. Never use "✓ " in front of a label to show a choice; use a
  radio, a segmented control, a check icon in `trailing`, or a ring around a swatch.
- **Nothing on the page is useless**: hide rows that can't do anything right now (Manage with nothing to reset),
  and keep switches greyed out while the main switch is off.
- Helpers called from a page render (`VenusStatusCard`, `venusSegmented`, `highlightPreview`…) are plain
  functions called directly, not components, so the page stays one render tree; components with their own hooks
  (`HighlightPreview`-style previews that use `useSettings`) are created with `el`.
- The Features list is Discord's own `SettingsList` with `FeatureSearchBar` as its `ListHeaderComponent` (#68). Every
  `toggle`/`withOptions` row is added to `featureSearch.rows` automatically; when a new feature page has options people would
  search for by name, add their labels to `FEATURE_KEYWORDS`.
- **Start with the essentials** (`STARTER_FEATURES`, `starterCard`) sits above the Features search on a fresh install, until any
  feature has been on, Not now is tapped (`setupDone` in the settings file), or you search. Only add a feature there if it works
  on its own: no sign-in, no outside service (ReviewDB, Google Translate), no restart, nothing that acts for you (Quests,
  Skip delete confirmation) or changes what others see (Hide typing indicator).
- **Backup and restore** saves `settings` (plus watched people and installed themes). A new setting needs nothing extra as long
  as `acceptedSetting` can validate it: add a check there for any setting with a fixed list of values, so a hand-edited backup
  can't put a page in a state it can't show. Never add sign-ins, tokens, saved accounts or kept messages to `backupText`.
- Pages whose options are also native setting nodes (Nitro links, Pastel names, Device indicators) keep those
  nodes for Discord's settings search and pass `{page, sections}` to `withOptions`, so the designed page is shown.
- Every new text goes through `tr()`/`pl()` and gets added to all 30 language files.
- **Hand-review every language to be as accurate and as natural as possible (no Google Translate, Acorn, or lazy partial reviews):**
  - **Translations must be both as accurate as possible and as natural as possible.** Never settle for literal, stiff,
    or machine-translated phrasing, and never sacrifice accuracy for fluency. Every string must read the way a native
    speaker of that language would naturally write and expect to see it inside Discord's mobile UI, while conveying the
    exact meaning of the English original.
  - Never use Google Translate or Acorn to draft or parse translations. Every single string in every language file under
    `patches/src/main/resources/venus/i18n/` and `scripts/i18n_overrides/` must be carefully hand-translated and
    hand-reviewed by you for 100% accuracy, natural and idiomatic phrasing, grammatical correctness, consistent tone
    (informal second-person where appropriate, matching Discord's own UI in that language), preserved `{placeholders}`
    and product names (`Venus`, `Discord`, `Nitro`, `ReviewDB`, `Revenge`, `Vendetta`, `Blurple`, `GitHub`,
    `@unknown-user`), and proper CLDR plural categories (`one` / `few` / `many` / `other`).
  - **No lazy or partial audits:** When auditing or updating a language, you must look really hard and think carefully
    about every single string in the entire file (all 718 strings in `patches/src/main/resources/venus/i18n/<code>.json`
    and the full override set in `scripts/i18n_overrides/<code>.json`), never just touching a few lines. Every
    mistranslated word (for example, translating UI nouns like "Themes", "Revenge", "Play", "Watch", "Hold", "Keep", or
    "Clear" into the wrong sense or wrong grammatical form), awkward machine-translated syntax, unnatural word order,
    wrong formality level, or missing plural form must be fixed.
  - Whenever you add or change any English text in `bootstrap.js` (including Venus settings, option pages, previews,
    toasts, dialogs, and the About page), you **must** hand-review and update every other language for an accurate,
    natural, idiomatic translation.
  - When reviewing multiple languages, thoroughly audit one language completely at a time until you are confident it is
    perfectly translated (both as accurate and as natural as possible), commit and push that language to the open pull
    request, and only then move on to the next language.

**Account switcher** (#63, #69)

- MultiAccountStore (12056) is a PersistedStore (505). Its constructor adds a change listener that saves `getState()`
  on every change, even before `initializeIfNeeded()` has read the saved list, when `users` is still `[]`. So never
  call `emitChange()`, `initialize()`, `asyncPersist()` or `initializeIfNeeded()` on it until Discord has set
  `_isInitialized` and Storage (510) `hasLoaded`. Doing so on a cold start wiped every saved account.
- Only save the active token under the signed-in id when no other saved account already uses it: mid-switch, the token
  belongs to the next account while UserStore still shows the last one.

**Custom themes** (since 1.16.0)

- The page leads with a gallery (`themeTile` + `themeMiniChat`), not a status card: Discord's colors first, then each installed
  theme drawn in its own colors (`themePalette`), then a Browse tile. The tile in use has the brand ring and a check.
- Tiles are radios (`accessibilityRole:"radio"`): tapping one uses it (`customThemesUse`), holding one asks to remove it.
  Discord's colors is the way back, so tapping the theme in use does nothing.
- Install problems show under the link field, never at the top of the page.
- Colors are compiled into four 349.9 tables: RawColors (591), SemanticColors (589) and SemanticColorExperiments
  (590), plus the theme slot keys from Themes (588: ASH=`dark`, LIGHT=`light`, DARK=`darker`, ONYX=`midnight`).
  590 wins over 589 while an experiment is on, so every themed token's overrides follow it. Changes reach the screen
  through ThemeStore (1193), the ThemeContext key (4593) and the memoized RootThemeContextProvider (9758).
- Parts of the chat list are drawn by Discord's native Android code with built-in theme colors (`ThemeModule`
  accepts only a theme name), so a JS theme can't recolor everything there.
- Revenge rules Venus follows: arrays are `[dark, light, midnight, darker]`; a slot the array doesn't reach borrows
  index 0, but a slot written as `false` keeps Discord's own color, even if a legacy alias reached it first. When two
  legacy keys feed one token, the key that lists it earlier (then the shorter list) wins. Values tolerate
  `#transparent`, whitespace inside hex and stray spaces around keys.
- Compile journals every key it writes, and switching undoes only those (`restoreOriginalColorTables`). Every raw
  write in `compileThemeIntoTables` goes through `raw.set`, and every token write through `writeSemanticTarget` or
  `touchedSem.add`, or turning a theme off won't undo it. `parseThemeColor` is cached and returns frozen objects:
  copy before changing one.
- Test any theme change against the real 349.9 tables and the published themes:
  `python3 scripts/hbc/color_tables.py` (decodes 589/590/591 to `work/discord_colors.json`), `python3
  tests/themes_fetch.py` (downloads every theme to `work/themes/`), then `node tests/theme_compat.cjs`. It must show
  no errors, `notRestored`, `chainLeaks` or `falseSlotsChanged`. Keep install and switch times where they are
  (1.16.0: install ~4 ms, switch ~1.2 ms median). `WHO=KEY` lists the themes where KEY didn't land; `--each` shows
  every theme.

**Motion** (since 1.14.0)

- `settingsBody` wraps each group in `VenusReveal`: groups rise in one after another when a page opens. Don't add a
  second entrance animation of your own.
- Something that's picked (a swatch's check, the theme or account in use, a status badge) goes through
  `popIn(key, child)`. Key it on what was picked, so it pops again only when the choice changes.
- `switchRow` and `venusSegmented` call `animateLayout()` before changing a setting, so rows that appear or move
  ease into place. Call it yourself before any other setting change that adds or removes rows.
- `venusSegmented` slides its pill (`SegmentedSlider`); `VenusProgress` is the bar for anything with progress.
- Opacity, position and scale animate on the native driver only. Width (`VenusProgress`) is the one exception.
- Every animation checks `motion()` and `reduceMotion`. Without `Animated`, or with Android's Remove animations on,
  everything shows at once. Never make anything depend on an animation finishing.
- **Haptics** (since 1.16.0) go through `haptic(kind)`, Discord's own `triggerHapticFeedback`. Switches already buzz by
  themselves (Discord's `FormSwitch`), so never add a second one there. `venusSegmented` ticks `IMPACT_MEDIUM` like Discord's
  segmented control, and radio choices and color swatches (which Discord leaves silent) tick `SELECTION`. Only buzz when
  something actually changed, never for re-picking the current choice, for toasts, or on a timer.
- Motion confirms what you did. Never loop it on its own, except a preview's Watch story (`useStory`), whose timers
  stop when you switch to Try it or leave the page.

The page title is short ("Deleted messages", "Tap gestures").

### Keeping everything in step

- The feature's name is **the same in Venus and in Morphe**: the Venus row title, the Morphe patch `name` in
  `DiscordPatches.kt` and the README features table. Morphe patches sit in the **Features** category. The
  Morphe description is the Venus description, plus any credit.
- Update `README.md` (features table) whenever a title, group or option changes. Keep titles at most 40 characters,
  descriptions at most 130, and every feature icon unique.
- **Always keep both the module map file (`scripts/hbc/349.9-module-map.md`) and `scripts/hbc/port_check.py` (`BOOTSTRAP_MODULES`) updated** whenever any Metro module ID, export, or native hook is added, changed, or removed in `bootstrap.js`, and run `python3 scripts/hbc/port_check.py` to verify all entries pass.

## Benchmarking optimizations (required)

Every optimization must be benchmarked on the real HBC98 Hermes VM **before** it is committed. Node/V8 numbers
don't count: V8 has a JIT and Hermes on Android doesn't, so a change that is faster on Node can be slower on Hermes
(in this repo, a hand-written `isDigits` loop measured slower on Hermes than the `/^\d+$/` regex it replaced). A change that isn't measurably
faster on Hermes is not an optimization; revert it unless it's also simpler.

1. **Get the VM once per sandbox:** `sh scripts/hbc/bench_setup.sh [Discord.apkm]` sets up everything below in one go
   (tools, compacted runtime, VM, Discord bundle). On its own, `sh scripts/hbc/hermes_vm.sh` It downloads a checksum-pinned prebuilt Hermes
   `250829098.0.16` (HBC98, the bytecode version Discord 349.9 runs) to `work/hermes/hermes-vm`, plus the ICU 70 it
   links against. Bytecode always comes from the pinned compiler, `work/tools/hermesc -emit-binary -O` (written by
   `python3 scripts/build.py`). Don't build Hermes yourself.
2. **Measure with `tests/bench/hermes_bench.cjs`**, never with ad-hoc timing:
   - **Startup** (any change to `bootstrap.js` top-level code, `decorateDefine`, `activatePlugins`, `instrument` or
     anything else that runs at launch): `node tests/bench/hermes_bench.cjs --startup <old-bootstrap.js>`, with the
     old copy from `git show origin/main:patches/src/main/resources/venus/bootstrap.js > work/bench/old.js`. It
     evals the compacted runtime (the same Terser step as `scripts/build.py`) and pushes 17.7k Metro defines through
     its `__d`, old and new interleaved.
     For a change to the shipped form itself (`scripts/build.py`'s compaction), compare two compacted runtimes with
     `node tests/bench/runtime_eval.cjs old.js patches/build/bootstrap.js` and then
     `node tests/bench/hermes_bench.cjs work/bench/runtime_eval.js`.
   - **Cold boot of the real Discord bundle** (required for every startup change, after the above):
     `sh tests/bench/cold_boot.sh <old compacted bootstrap.js> [new]`. It injects each runtime into the user's 349.9
     `index.android.bundle` with `HbcPrelude`, boots it through React Native's own initializer
     (`tests/hermes-startup.js`, which must print `HBC98_REAL_RN_ENVIRONMENT_PASS`) and compares user CPU over
     interleaved cold starts. It needs `sh scripts/hbc/setup.sh Discord.apkm` once. This is the closest number to a
     phone launch; run it at least twice, because one run can land inside noise.
   - **Finding startup work:** `node tests/bench/load_profile.cjs` splits the runtime's eval into compile time and the
     cost of each top-level statement; `node tests/bench/load_calls.cjs` lists which functions actually run at startup
     (as of 1.16.x: only the IIFE, `selectModules`, `decorateDefine`, `defineValue` and the `__d` wrapper; everything
     else is compiled, never run, and costs ~18 us per function plus its size).
   - **A hot function** (a hook, a store wrapper, a sort, a render helper): write `tests/bench/<name>.js` that copies
     the old and new code verbatim and calls `bench("old …", fn)` then `bench("new …", fn)` with realistic inputs
     (a 3000-message channel, 50 accounts, 200 guilds…), and run `node tests/bench/hermes_bench.cjs
     tests/bench/<name>.js`. The first `bench` is the baseline. Commit the bench file with the optimization.
3. **Read the result honestly.** The report gives the p10 (the headline: a busy shared host only ever slows
   CPU-bound code down), the median and the range, then the speedup over the baseline. Anything within ±5% says
   `(within noise)`: that's not a win, so don't ship it as one. If the median and p10 disagree, rerun with more
   `--samples`/`--rounds`. `Date.now()` in this VM has 1 ms resolution, which is why the harness times batches.
4. **Put the numbers in the commit message and the pull request:** the Hermes before/after for what changed, for
   example `Hermes HBC98: 15.5 → 13.3 ms per 3000-message sort (1.17x)`. A ⚡ Performance changelog bullet needs
   this measurement behind it.
5. **Check the change still works:** boot the real bundle with `sh tests/bench/cold_boot.sh` (it must print
   `HBC98_REAL_RN_ENVIRONMENT_PASS`) and try the feature in the patched app. Throwaway verification scripts stay local
   (see [Tests](#tests-what-may-be-committed)).

## Tests: what may be committed

Only commit tests that have a lasting, practical use. **Never commit tests whose only job is to verify that a feature,
page, hook or fix works** (per-feature unit tests, render snapshots, "does this row exist" checks, harnesses that mock
Discord's modules to exercise one feature). Write them locally if they help you, run them, and leave them out of the
commit: they go stale with every Discord port and redesign and slow every change down without catching real problems.

What belongs in the repository:

- **Performance measurement:** the Hermes HBC98 benchmarks in `tests/bench/` (`hermes_bench.cjs`, `cold_boot.sh`,
  `load_profile.cjs`, `load_calls.cjs`, `runtime_eval.cjs` and each optimization's `<name>.js`), and
  `tests/hermes-startup.js`, which cold-boots the real Discord bundle.
- **Checks against the real APK that protect every patch:** `tests/native/VerifyApk.kt` (the patched APK applies and
  every branch is aligned), `tests/native/PrivacyTest.kt` (every pinned HBC98 and DEX target is still safe to stub) and
  `tests/native/HbcPreludeTest.kt` (the prelude injects cleanly). These are reused on every Discord port.
- **Developer tools with a future use:** `tests/theme_compat.cjs` and `tests/themes_fetch.py` (published-theme
  compatibility), and the porting tools in `scripts/hbc/`.
- **Build gates** in `scripts/build.py`: changelog format, HBC98 compilation of the runtime, and language files (valid,
  every `{placeholder}` kept, every text translated).

If you're unsure whether a new test has a future use, it doesn't: keep it local.

## Workflow for bug fixes, optimizations, and GitHub Actions `.mpp` artifacts

- **For every bug or issue:** immediately find the root cause and implement a fix, then **immediately commit and push that fix to the pull request** before moving on to the next issue.
- **For every optimization:** implement the optimization, benchmark it on the real Hermes VM as described in
  [Benchmarking optimizations](#benchmarking-optimizations-required), and **immediately commit and push that
  optimization to the pull request** before moving on to the next one.
- Never batch unrelated fixes or optimizations into a single giant end-of-session commit; each fix or optimization should land in the pull request as soon as it is verified.
- **GitHub Actions precompiled `.mpp` (`venus-patches-mpp` artifact):**
  - `.github/workflows/main.yml` automatically builds, tests, and packages `patches/build/libs/patches-<version>.mpp` (along with `SHA256SUMS` and `bootstrap.hbc`) on every `push` to `main`, every `pull_request` targeting `main`, and on tag pushes (`v*`), uploading them as the `venus-patches-mpp` workflow artifact.
  - When testing a PR or publishing a release, prefer the prebuilt `.mpp` artifact produced by the GitHub Actions workflow (`venus-patches-mpp`), or let the tag workflow publish the `.mpp` directly to the GitHub Release, so the exact CI-verified `.mpp` is used.
