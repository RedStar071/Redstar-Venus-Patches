# Venus Patches

Extra features and privacy options for Discord on Android, built into the app with **[Morphe](https://morphe.software)**. Everything works offline, except the few features that say they use a service (ReviewDB, Translate messages). Nothing is downloaded from the internet to run, and nothing is tracked.

[**Add to Morphe**](https://morphe.software/add-source?github=VenusIsJaded/Venus-Patches&name=Venus%20Patches) · [Downloads](https://github.com/VenusIsJaded/Venus-Patches/releases) · [What's new](CHANGELOG.md) · [Report a problem](https://github.com/VenusIsJaded/Venus-Patches/issues)

**Works with:** Discord **349.9 - Stable** (the original APKM).

## Install

1. Install [Morphe Manager](https://github.com/MorpheApp/morphe-manager/releases).
2. Tap **[Add to Morphe](https://morphe.software/add-source?github=VenusIsJaded/Venus-Patches&name=Venus%20Patches)**. You can also add `https://github.com/VenusIsJaded/Venus-Patches` as a source.
3. Choose the **original** Discord 349.9 APKM. Don't pick an APK you've already patched.
4. Every patch is selected for you, under **Features** and **Privacy**. Leave **Venus settings** on, then patch and install.
5. Open **Discord Settings → Venus → Features** and turn on the ones you want. They all start off.

You can also download `patches-<version>.mpp` from [Releases](https://github.com/VenusIsJaded/Venus-Patches/releases) and import it under **Sources → + → Local**.

> **Heads up:** the patched app is signed with your key, not Discord's, so you may need to uninstall official Discord first. Uninstalling deletes Discord's local data. Keep the same Morphe signing key so later updates install over the top.

## Features

Open **Discord Settings → Venus → Features** to turn things on or off at any time. Type in the search bar at the top to find a feature by its name, what it does or one of its options. The first time you open it, a **Start with the essentials** card at the top turns on eight popular features in one tap (Keep deleted messages, Nitro stickers and emojis as links, Device indicators, Read all, Jump to first message, Fix unknown mentions, Copy profile bios and file sizes). None of them needs a sign-in, an outside service or a restart. **Undo** switches back exactly those, and **Not now** hides the card for good. Rows with an arrow button have more options. Each feature has the same name in Venus and in Morphe. **Everything starts off**, so Discord looks and works like normal until you turn on what you want. Your choices from an earlier version are kept.

| Group | Feature | What it does |
| --- | --- | --- |
| **Messages** | Keep deleted messages | Deleted messages stay in chat, outlined in red, and edits keep their history |
| | Message highlights | Pick bar width and colors for replies, mentions and deleted messages |
| | Translate messages | Messages in other languages show in yours, automatically or only the ones you pick |
| | Double-tap to reply | Double-tap a message to reply, or your own to edit it |
| | Skip delete confirmation | Messages and link previews are removed with no "Are you sure?" |
| | Jump to first message | A button to go straight to the start of a chat |
| | Favourite any image or video | Star any image or video to keep it in your GIF favourites |
| **Sending** | Send Nitro stickers and emojis as links | Sends Nitro emojis and stickers as links that show as the image |
| | Send audio as voice messages | Audio files are sent as real voice messages, with a waveform |
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
| | Custom themes | Install Revenge and Vendetta color themes from a link, then pick one from a gallery that previews each in its own colors |
| **Quests** | Complete Quests automatically | Finishes video, Play and timed Activity Quests in the background |
| | Hide the Quests banner | Removes the Quest promotion above your profile bar |

**In the background:** Play and Activity Quests keep going while Discord is in the background or the screen is off, like Discord for Windows running unfocused. Video Quests are reported at normal speed, and only while Discord is open, the same as Discord's own player. Leaving Discord pauses a video Quest, the background Quests go ahead in the meantime, and the video picks up where it stopped when you come back. New Quests are accepted while Discord is open.

**Activity Quest support:** automatic completion currently handles `PLAY_ACTIVITY` tasks, which count time. It does not handle `ACHIEVEMENT_IN_ACTIVITY` tasks, such as **VALORANT Aces Round 3**, which require an achievement event rather than elapsed time. Those quests are skipped, including automatic acceptance, and must currently be completed in the Activity through Discord's Launch button. A one-achievement target is not a one-second timer; sending time heartbeats does not implement achievement completion.

**Language** sets the language Venus settings are shown in. It follows Discord's language until you pick another one. 30 languages are included, among them Russian, Ukrainian, German, Spanish, French, Portuguese, Polish, Turkish, Japanese, Korean and Chinese. Counts use each language's plural forms. Corrections are welcome on GitHub ([`patches/src/main/resources/venus/i18n`](patches/src/main/resources/venus/i18n)).

**Backup and restore** keeps your Venus setup safe when you patch again, reinstall or move to a new phone. **Save to a file** opens Android's Save to screen so you can keep the backup in Downloads, Drive or anywhere else, and **Copy to clipboard** lets you paste it into a note. **Restore from a file** or **Paste from clipboard** brings every feature, option, watched person and installed theme back after asking first. Backups are small JSON files and never include your ReviewDB sign-in, saved accounts or kept deleted messages. **Reset to defaults** turns every feature off again.

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
