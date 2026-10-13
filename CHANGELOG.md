## [1.11.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.10.0...v1.11.0) (2026-10-13)

### ✨ New Features

* **Discord - Venus settings:** Venus settings in 30 languages, including Russian ([#50](https://github.com/VenusIsJaded/Venus-Patches/issues/50))
* **Discord - Venus settings:** Pick the settings language in Language, or follow Discord's
* **Discord - Translate messages:** Translate only the messages you pick, from the hold menu ([#50](https://github.com/VenusIsJaded/Venus-Patches/issues/50))
* **Discord - Translate messages:** Hold a message to show its original, or translate your own

### 🐛 Bug Fixes

* **Discord - Translate messages:** A reply shows the message it quotes untranslated ([#51](https://github.com/VenusIsJaded/Venus-Patches/issues/51))

### 🔧 Improvements

* **Discord - Translate messages:** "Translated from" names the language in the settings language

## [1.10.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.9.0...v1.10.0) (2026-10-13)

### ✨ New Features

* **Discord - Venus settings:** Every feature has its own Discord icon in the list
* **Discord - Venus settings:** About shows how many features are on, plus What's new and help links
* **Discord - Keep deleted messages:** Clear kept messages from its settings, with a count of what's kept
* **Discord - Translate messages:** Clear saved translations from its settings

### 🔧 Improvements

* **Discord - Venus settings:** Settings is now Features, in six groups, from Messages to Quests
* **Discord - Venus settings:** Shorter, clearer titles and descriptions for every feature and option
* **Discord - Venus settings:** Option pages show a status card, Discord's radio lists and short notes
* **Discord:** Patches are named by what they do, the same as in Venus
* **Discord - Send Nitro stickers and emojis as links:** Removed Always send links, which only replaced emojis you could already use
* **Discord - Skip delete confirmation:** One switch now covers both messages and link previews
* **Discord - Pastel name colors:** Webhooks always get their color from their name
* **Discord - User and server reviews:** The send button always uses the profile's colors

## [1.9.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.8.0...v1.9.0) (2026-10-13)

### ✨ New Features

* **Discord:** Add `ValidUser` patch
* **Discord - ValidUser:** Fix @unknown-user mentions automatically, with no extra taps
* **Discord:** Add `Profile bar settings button` patch
* **Discord - Profile bar settings button:** Open Venus settings from a button next to the notifications bell
* **Discord:** Add `Split Large Messages` patch
* **Discord - Split Large Messages:** Send messages over the limit as several, keeping code blocks closed
* **Discord:** Add `Translate messages` patch
* **Discord - Translate messages:** Show messages in other languages translated into your language, newest first
* **Discord - Translate messages:** Keep translations on your phone, so reopened chats show them at once

### 🐛 Bug Fixes

* **Discord - Pastelize:** Color message text doesn't color the message a reply quotes ([#45](https://github.com/VenusIsJaded/Venus-Patches/issues/45))

### 🔧 Improvements

* **Discord - Venus settings:** Every feature starts off, so nothing changes until you turn it on

## [1.8.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.7.0...v1.8.0) (2026-10-12)

### ✨ New Features

* **Discord - Disable telemetry and touch logging:** Also stop per-screen smoothness (jank) stats from being saved and sent

### 🐛 Bug Fixes

* **Discord - Disable advertising identifiers:** AppsFlyer still reads your Google advertising ID itself
* **Discord - QuickDelete:** Removing link previews keeps skipping the confirmation after QuickDelete is turned off
* **Discord - NoDelete:** Typing 0 as the maximum saved messages jumps it back to 512
* **Discord - NoDelete:** A saved file too big to read back can still be written
* **Discord - NoDelete:** Servers you leave keep their kept messages and edit history forever
* **Discord - Quest Completer:** Doesn't start until a reconnect when Discord connects before settings load
* **Discord - Force system emojis:** Keycap emojis like 1️⃣ and #️⃣ keep Discord's picture
* **Discord - Force system emojis:** Emojis don't match chat when saved settings can't be read
* **Discord - Force system emojis:** Old emoji designs keep showing after a phone or emoji font update
* **Discord - Force system font:** Reopen now restarts Discord with the old setting when it couldn't be saved
* **Discord - Read All:** Shows "Nothing unread" when unread servers or DMs couldn't be cleared yet
* **Discord - Message tap gestures:** Turning gestures off during a double-tap still opens the editor or replies
* **Discord - Custom voice messages:** Cancelling an upload that's being converted deletes it instead
* **Discord - FreeNitro:** Sticker or emoji names with `||`, `~~` or `#` turn link text into a spoiler, strikethrough or heading

### 🔧 Improvements

* **Discord - Read All:** Say why unread items couldn't be cleared and which servers were marked as read
* **Discord - Force system emojis:** Old emoji drawings are removed from the cache in the background
* **Discord - Disable telemetry and touch logging:** Say that it also stops per-screen smoothness stats
* **Discord - Disable advertising identifiers:** Say that it stops both Discord and AppsFlyer reading the ID

### ⚡ Performance Improvements

* **Discord - Pastelize:** One copy of each chat row's message instead of up to four
* **Discord - Pastelize:** Mentions are copied only when something in them actually changes
* **Discord - Hide call button:** Look up the call icon once per profile instead of per element
* **Discord - Hidden Channels:** Reuse one renamed copy per locked channel instead of copying it every lookup
* **Discord - Hidden Channels:** No longer copy every channel of every server when Discord connects
* **Discord - NoDelete:** Edit history reuses the joined message content until something changes
* **Discord - Dashless:** Check channel types without building a list every time
* **Discord - Custom voice messages:** Check audio file types without building a list every time
* **Discord - PlatformIndicators:** Less work on every presence update
* **Discord - Venus settings:** Row switches and arrows are found once instead of on every render
* **Discord - File size on picker:** Known sizes show straight away on recycled photo tiles, never an old one
* **Discord - File size on picker:** Size badges share one style instead of making new ones per tile
* **Discord - Force system font:** Threads meeting a new font family share one cache slot

## [1.7.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.6.0...v1.7.0) (2026-10-11)

### ✨ New Features

* **Discord:** Add `Hide call button` patch, which removes Call from profiles so Message fills the row

### 🐛 Bug Fixes

* **Discord - Message tap gestures:** Tapping your own message three times opens it for editing instead of deleting it
* **Discord - Venus settings:** Options on a setting's page stay switchable while that setting is off
* **Discord - NoDelete:** The maximum saved messages box can be edited while NoDelete is off

### 🔧 Improvements

* **Discord - Venus settings:** Clearer descriptions for every setting
* **Discord - NoDelete:** Say that it also keeps what edited messages said before
* **Discord - Pastelize:** Say that each color comes from the person's user ID
* **Discord - Message tap gestures:** Describe the Edit it and Reply to it choices

## [1.6.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.5.0...v1.6.0) (2026-10-11)

### ✨ New Features

* **Discord - Message tap gestures:** Double-tap a message to reply, or your own message to edit it
* **Discord - Message tap gestures:** Tap your own message three times to delete it
* **Discord - NoDelete:** Show what an edited message said before, faded and crossed out above it

### 🐛 Bug Fixes

* **Discord:** Passkeys and security keys show "RP ID cannot be validated" instead of explaining why they can't work in patched Discord ([#37](https://github.com/VenusIsJaded/Venus-Patches/issues/37))
* **Discord - NoDelete:** Deleted messages stop saving after the saved file is damaged
* **Discord - Venus settings:** About shows the wrong version
* **Discord - Read All:** Error message starts with "Error:"

### ⚡ Performance Improvements

* **Discord - NoDelete:** Saving a deleted message no longer rewrites every other saved message
* **Discord - NoDelete:** Chats with kept messages do fewer checks per message
* **Discord - Hidden Channels:** Do less work while turned off

## [1.5.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.4.4...v1.5.0) (2026-10-11)

### ✨ New Features

* **Discord:** Add `Force system font` patch
* **Discord:** Add `Force system emojis` patch
* **Discord:** Add `Hide gift button` patch
* **Discord:** Add `Hide Quests promotion` patch

### 🔧 Improvements

* **Discord - Venus settings:** Plugins is now Settings, grouped into Chat, Profiles and people, Servers and channels, and More
* **Discord - Venus settings:** Each switch says what it does instead of showing a plugin name
* **Discord - Venus settings:** Settings with more options have a switch and an arrow button
* **Discord - Venus settings:** Options are greyed out while their main switch is off
* **Discord - Quest Completer:** Starts off until you turn on Complete Quests automatically

## [1.4.4](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.4.3...v1.4.4) (2026-10-10)

### 🐛 Bug Fixes

* **Discord - Read All:** The server list can come back from an older render
* **Discord - Quest Completer:** A game stays unnamed after one dropped connection
* **Discord - Quest Completer:** Being offline pauses a Quest for 6 hours
* **Discord - Quest Completer:** Heartbeats continue after Discord stops counting a Quest
* **Discord - ReviewDB:** The review menu's close button does nothing

### ⚡ Performance Improvements

* **Discord - NoDelete:** Opening Discord no longer rewrites saved deleted messages
* **Discord - Quest Completer:** The settings page no longer redraws every 5 seconds

## [1.4.3](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.4.2...v1.4.3) (2026-10-09)

### 🐛 Bug Fixes

* **Discord - Quest Completer:** Play Quests stop with "HTTP 401" and never finish
* **Discord - Quest Completer:** Activity Quests are refused the same way

### 🔧 Improvements

* **Discord - Quest Completer:** Play time is reported once a minute, the way Discord for Windows does

## [1.4.2](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.4.1...v1.4.2) (2026-10-09)

### ✨ New Features

* **Discord - Quest Completer:** Complete Play Quests without installing or starting the game
* **Discord - Quest Completer:** Add a Play Quests switch

## [1.4.1](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.4.0...v1.4.1) (2026-10-09)

### ✨ New Features

* **Discord:** Add `Quest Completer` patch, which accepts and completes video and Activity Quests in the background

## [1.4.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.9...v1.4.0) (2026-10-09)

### 🐛 Bug Fixes

* **Discord - ReviewDB:** Refreshing reviews can drop another profile's reviews
* **Discord - Hidden Channels:** Some locked channels don't show

### 🔧 Improvements

* **Discord:** Restore the 1.3.8 feature names in Morphe and Venus settings
* **Discord - PlatformIndicators:** Restore the original icons

### ⚡ Performance Improvements

* **Discord - NoDelete:** Lowering the maximum is instant
* **Discord - NoDelete:** Smoother chats with NoDelete or Pastelize on
* **Discord - Hidden Channels:** Opening a server does less work

## [1.3.9](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.8...v1.3.9) (2026-10-09)

### 🔧 Improvements

* **Discord:** Name every feature after what it does
* **Discord - PlatformIndicators:** New device icons
* **Discord:** Remove the size cap on Venus's built-in code

## [1.3.8](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.7...v1.3.8) (2026-10-09)

### 🐛 Bug Fixes

* **Discord - NoDelete:** Turning NoDelete off erases saved messages
* **Discord - Read All:** One empty DM stops the other DMs from being marked as read
* **Discord - JumpToTop:** The channel menu rebuilds every time it updates

### ⚡ Performance Improvements

* **Discord - Hidden Channels:** Half the permission checks
* **Discord - PlatformIndicators:** Less work when people come online, type or change status
* **Discord - NoDelete:** Less work when messages are deleted

## [1.3.7](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.6...v1.3.7) (2026-10-08)

### 🐛 Bug Fixes

* **Discord - Disable crash reporting:** Some crash reports can still be sent
* **Discord - JumpToTop:** Missing on threads
* **Discord - PlatformIndicators:** Missing in the voice panel
* **Discord - ReviewDB:** Copy Text and review cards don't work

### ⚡ Performance Improvements

* **Discord - PlatformIndicators:** Icons only update when that person's status changes

### 🚀 Updated App Support

* **Discord:** Add support for `348.10 - Stable` and drop `347.12`

## [1.3.6](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.5...v1.3.6) (2026-10-08)

### ✨ New Features

* **Discord:** Add `Read All` patch

### 🐛 Bug Fixes

* **Discord - Pastelize:** Color message text turns messages blue and shows "usernameOnClick"

## [1.3.5](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.4...v1.3.5) (2026-10-08)

### 🐛 Bug Fixes

* **Discord - File size on picker:** Files just under 1 MB show as 1024 KB
* **Discord - NoDelete:** Clearing the maximum box resets it to 512

### 🔧 Improvements

* **Discord:** Group patches under Plugins and Privacy in Morphe, with plain descriptions
* **Discord - Venus settings:** Changing an option applies right away

### ⚡ Performance Improvements

* **Discord - NoDelete:** Less background work with saving off
* **Discord:** Patching is faster

## [1.3.4](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.3...v1.3.4) (2026-10-07)

### 🐛 Bug Fixes

* **Discord:** Adding Venus Patches as a Morphe source shows "The patch bundle could not be downloaded"

### ⚡ Performance Improvements

* **Discord - Pastelize:** Name colors are reused instead of worked out for every message
* **Discord:** Patching uses less memory

## [1.3.3](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.2...v1.3.3) (2026-10-07)

### ✨ New Features

* **Discord - Custom voice messages:** Use Discord's own waveform
* **Discord - Custom voice messages:** Support more WAV types and more audio files

### 🐛 Bug Fixes

* **Discord - Custom voice messages:** Some files fail with "Audio format changed during decoding"

## [1.3.2](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.1...v1.3.2) (2026-10-06)

### ✨ New Features

* **Discord - ReviewDB:** Open server reviews inside the server menu

## [1.3.1](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.3.0...v1.3.1) (2026-10-06)

### 🐛 Bug Fixes

* **Discord - PlatformIndicators:** "Rendered fewer hooks" errors when switching chats

## [1.3.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.9...v1.3.0) (2026-10-05)

### ✨ New Features

* **Discord - PlatformIndicators:** Show icons in the DM list and DM top bar

### 🐛 Bug Fixes

* **Discord - NoDelete:** The red outline only appears after reopening the chat

## [1.2.9](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.8...v1.2.9) (2026-10-05)

### ✨ New Features

* **Discord - NoDelete:** Add Save permanently and a maximum number of saved messages

### 🐛 Bug Fixes

* **Discord - NoDelete:** Your own deleted messages aren't kept
* **Discord - ReviewDB:** Server reviews don't open

## [1.2.8](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.7...v1.2.8) (2026-10-05)

### ✨ New Features

* **Discord:** Add `Disable advertising identifiers` patch

### 🐛 Bug Fixes

* **Discord:** A cached Discord update can bypass the privacy options

## [1.2.7](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.6...v1.2.7) (2026-10-05)

### ✨ New Features

* **Discord:** Add `Disable analytics`, `Disable crash reporting`, `Disable telemetry and touch logging` and `Disable install attribution` patches

## [1.2.6](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.5...v1.2.6) (2026-10-05)

### 🐛 Bug Fixes

* **Discord - ReviewDB:** Signing in doesn't work
* **Discord - NoDelete:** Messages are out of order after deleting

## [1.2.5](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.4...v1.2.5) (2026-10-05)

### 🔧 Improvements

* **Discord - ReviewDB:** Use Discord's own look, and ask before deleting or reporting

## [1.2.4](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.3...v1.2.4) (2026-10-05)

### ✨ New Features

* **Discord - Hidden Channels:** Tapping a locked channel shows when it was created and last used

### 🐛 Bug Fixes

* **Discord - Hidden Channels:** Popups open twice

## [1.2.3](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.2...v1.2.3) (2026-10-04)

### 🐛 Bug Fixes

* **Discord - Hidden Channels:** Some channels show without their real names

## [1.2.2](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.1...v1.2.2) (2026-10-04)

### 🐛 Bug Fixes

* **Discord:** ReviewDB, Hidden Channels, PlatformIndicators and NoDelete don't match the originals

## [1.2.1](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.2.0...v1.2.1) (2026-10-04)

### 🐛 Bug Fixes

* **Discord:** Pastelize, ReviewDB, Hidden Channels, PlatformIndicators and NoDelete don't work

## [1.2.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.1.1...v1.2.0) (2026-10-04)

### ✨ New Features

* **Discord:** Add `Pastelize`, `PlatformIndicators` and `ReviewDB` patches

## [1.1.1](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.1.0...v1.1.1) (2026-10-04)

### ⚡ Performance Improvements

* **Discord - Custom voice messages:** Faster conversion

## [1.1.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.0.0...v1.1.0) (2026-10-04)

### ✨ New Features

* **Discord:** Add `No typing`, `QuickDelete`, `NoDelete`, `JumpToTop` and `Hidden Channels` patches

## [1.0.0](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.0.0-dev.3...v1.0.0) (2026-10-04)

### ✨ New Features

* **Discord:** Add `Venus settings`, `CopyBios`, `Dashless`, `FavouriteAnything` and `FreeNitro` patches

## [1.0.0-dev.3](https://github.com/VenusIsJaded/Venus-Patches/compare/v1.0.0-dev.1...v1.0.0-dev.3) (2026-10-03)

### 🐛 Bug Fixes

* **Discord:** Discord doesn't start after patching

## 1.0.0-dev.1 (2026-10-03)

### ✨ New Features

* **Discord:** Add `File size on picker` and `Custom voice messages` patches
