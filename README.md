# Venus Patches

Extra features and privacy options for Discord on Android, built into the app with **[Morphe](https://morphe.software)**. Everything works offline, except the few features that say they use a service (ReviewDB, Translate messages). Nothing is downloaded from the internet to run, and nothing is tracked.

[**Add to Morphe**](https://morphe.software/add-source?github=VenusIsJaded/Venus-Patches&name=Venus%20Patches) · [Downloads](https://github.com/VenusIsJaded/Venus-Patches/releases) · [What's new](CHANGELOG.md) · [Report a problem](https://github.com/VenusIsJaded/Venus-Patches/issues)

**Works with:** Discord **348.10 - Stable** (the original APKM).

## Install

1. Install [Morphe Manager](https://github.com/MorpheApp/morphe-manager/releases).
2. Tap **[Add to Morphe](https://morphe.software/add-source?github=VenusIsJaded/Venus-Patches&name=Venus%20Patches)**. You can also add `https://github.com/VenusIsJaded/Venus-Patches` as a source.
3. Choose the **original** Discord 348.10 APKM. Don't pick an APK you've already patched.
4. Every patch is selected for you, under **Features** and **Privacy**. Leave **Venus settings** on, then patch and install.
5. Open **Discord Settings → Venus → Features** and turn on the ones you want. They all start off.

You can also download `patches-<version>.mpp` from [Releases](https://github.com/VenusIsJaded/Venus-Patches/releases) and import it under **Sources → + → Local**.

> **Heads up:** the patched app is signed with your key, not Discord's, so you may need to uninstall official Discord first. Uninstalling deletes Discord's local data. Keep the same Morphe signing key so later updates install over the top.

## Features

Open **Discord Settings → Venus → Features** to turn things on or off at any time. Rows with an arrow button have more options. Each feature has the same name in Venus and in Morphe. **Everything starts off**, so Discord looks and works like normal until you turn on what you want. Your choices from an earlier version are kept.

| Group | Feature | What it does |
| --- | --- | --- |
| **Messages** | Keep deleted messages | Deleted messages stay in chat, outlined in red, and edited messages show what they said before |
| | Message highlights | Change the left bar thickness and highlight colors for replies, mentions and deleted messages |
| | Translate messages | Messages in other languages show in yours, automatically or only the ones you pick |
| | Double-tap to reply | Double-tap a message to reply, or your own to edit it |
| | Skip delete confirmation | Messages and link previews are removed with no "Are you sure?" |
| | Jump to first message | A button to go straight to the start of a chat |
| | Favourite any image or video | Star any image or video in the media viewer |
| **Sending** | Send Nitro stickers and emojis as links | Stickers and emojis you'd need Nitro for are sent as a link that shows up as the image |
| | Send audio as voice messages | An audio file becomes a real voice message, with a waveform |
| | Send long messages | Type past the character limit; long messages are sent in parts |
| | Hide typing indicator | Others won't see when you're typing |
| | Show file sizes when attaching | Photos and videos in the picker show their size |
| **People** | Pastel name colors | Names without a role color get a soft pastel color |
| | Show device indicators | Desktop, mobile, web, console or VR icons next to names |
| | Fix unknown mentions | @unknown-user mentions show the person's name |
| | Copy profile bios | Hold a bio to select and copy it |
| | User and server reviews | Read and write reviews, from ReviewDB |
| | User activity notifications | Shows a notice when chosen friends or users change status, start typing or send a message |
| | Account switcher | Switch between up to 50 Discord accounts from the profile bar or Venus settings |
| **Servers** | Read all button | Marks servers, DMs or both as read in one tap |
| | Show hidden channels | Channels you can't open appear with a lock. Only a tap opens their details menu, which you can turn off |
| | Spaces in channel names | "general chat" instead of "general-chat" |
| **Appearance** | Use your phone's font | Replaces Discord's font everywhere |
| | Use your phone's emojis | Your phone's emojis instead of Discord's |
| | Hide the gift button | Removes the Nitro gift button from the message bar |
| | Hide the call button | Removes Call from people's profiles |
| | Venus button on profile bar | A shortcut to Venus, next to the notifications bell |
| | Unlock app icons | Use any Discord app icon in Settings without Nitro |
| | Custom themes | Install color themes from a link and switch between them. Works with Revenge and Vendetta themes |
| **Quests** | Complete Quests automatically | Finishes video, Play and Activity Quests in the background |
| | Hide the Quests banner | Removes the Quest promotion above your profile bar |

**Language** sets the language Venus settings are shown in. It follows Discord's language until you pick another one. 30 languages are included, among them Russian, Ukrainian, German, Spanish, French, Portuguese, Polish, Turkish, Japanese, Korean and Chinese. Counts use each language's plural forms. Corrections are welcome on GitHub ([`patches/src/main/resources/venus/i18n`](patches/src/main/resources/venus/i18n)).

**About** shows your version, how many features are on (in total and per group), whether everything is working, and links to what's new and to report a problem. Venus settings animate gently as you use them, and follow Android's **Remove animations** setting.

### Privacy options

These are listed under **Privacy** in Morphe and are all selected. They work once you patch, with nothing to turn on in Discord. To change them, patch again.

| Option | What it stops |
| --- | --- |
| **Disable analytics** | Discord's usage tracking |
| **Disable crash reporting** | Crash reports and logs sent to Sentry |
| **Disable telemetry and touch logging** | Performance tracking, per-screen smoothness (jank) stats and records of what you tap |
| **Disable advertising identifiers** | Reading your Google advertising ID, by Discord or by AppsFlyer |
| **Disable install attribution** | Tracking of how you installed the app (AppsFlyer) |

Discord can still see what any client needs to work, like your messages, calls and activity on its servers.

## For developers

```bash
python3 scripts/build.py    # builds and tests patches/build/libs/*.mpp
```

## License

[GPL-3.0](LICENSE). Notices are in [NOTICE](NOTICE).
