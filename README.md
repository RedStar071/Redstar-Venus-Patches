# Venus Patches

Extra features and privacy options for Discord on Android, built into the app with **[Morphe](https://morphe.software)**. Everything works offline. Nothing is downloaded from the internet to run, and nothing is tracked.

[**Add to Morphe**](https://morphe.software/add-source?github=VenusIsJaded/Venus-Patches&name=Venus%20Patches) · [Downloads](https://github.com/VenusIsJaded/Venus-Patches/releases) · [What's new](CHANGELOG.md) · [Report a problem](https://github.com/VenusIsJaded/Venus-Patches/issues)

**Works with:** Discord **348.10 - Stable** (the original APKM).

## Install

1. Install [Morphe Manager](https://github.com/MorpheApp/morphe-manager/releases).
2. Tap **[Add to Morphe](https://morphe.software/add-source?github=VenusIsJaded/Venus-Patches&name=Venus%20Patches)**. You can also add `https://github.com/VenusIsJaded/Venus-Patches` as a source.
3. Choose the **original** Discord 348.10 APKM. Don't pick an APK you've already patched.
4. Every patch is selected for you, under **Plugins** and **Privacy**. Leave **Venus settings** on, then patch and install.

You can also download `patches-<version>.mpp` from [Releases](https://github.com/VenusIsJaded/Venus-Patches/releases) and import it under **Sources → + → Local**.

> **Heads up:** the patched app is signed with your key, not Discord's, so you may need to uninstall official Discord first. Uninstalling deletes Discord's local data. Keep the same Morphe signing key so later updates install over the top.

## Features

To turn things on or off at any time, open **Discord Settings → Venus → Settings**. Rows with an arrow button have more options. The **Morphe patch** column is the name to look for when patching, and **Starts** shows whether it's on the first time you open Discord.

| In Venus settings | Morphe patch | Starts |
| --- | --- | --- |
| **Chat** | | |
| Keep deleted messages, outlined in red, and what edited messages said before | NoDelete | Off |
| Send audio files as voice messages | Custom voice messages | Off |
| Send emojis and stickers you can't use as links | FreeNitro | On |
| Hide that you're typing | No typing | On |
| Delete messages without asking | QuickDelete | Off |
| Add a jump to first message button | JumpToTop | On |
| Show file sizes when attaching | File size on picker | On |
| Favourite any image or video | FavouriteAnything | On |
| Hide the gift button | Hide gift button | On |
| Double-tap a message to reply | Message tap gestures | Off |
| **Profiles and people** | | |
| Give names soft pastel colors, picked from each user ID | Pastelize | On |
| Show which devices people are on | PlatformIndicators | On |
| Select and copy profile bios | CopyBios | On |
| Show and write reviews of users and servers | ReviewDB | Off |
| Hide the call button on profiles | Hide call button | On |
| **Servers and channels** | | |
| Add a Read all button to the server list | Read All | On |
| Show channels you can't open, with a lock | Hidden Channels | Off |
| Show spaces instead of dashes in channel names | Dashless | On |
| Hide the Quests promotion | Hide Quests promotion | On |
| **More** | | |
| Force system font | Force system font | Off |
| Force system emojis | Force system emojis | On |
| Complete Quests automatically | Quest Completer | Off |

### Privacy options

These are listed under **Privacy** in Morphe and are all selected. They work once you patch, with nothing to turn on in Discord. To change them, patch again.

| Option | What it stops |
| --- | --- |
| **Disable analytics** | Discord's usage tracking |
| **Disable crash reporting** | Crash reports and logs sent to Sentry |
| **Disable telemetry and touch logging** | Performance tracking and records of what you tap |
| **Disable advertising identifiers** | Reading your Google advertising ID |
| **Disable install attribution** | Tracking of how you installed the app (AppsFlyer) |

Discord can still see what any client needs to work, like your messages, calls and activity on its servers.

## Good to know

- **Voice messages** need Android 10 or newer. Most audio files work. If a file can't be converted, it's sent as a normal attachment.
- **Deleted messages** are kept until Discord restarts. To keep them for good, turn on **Save permanently** in its settings. Delete a kept message again to hide it.
- **Edited messages** show what they said before, faded and crossed out in a quote above the new text. It starts on with NoDelete, and only covers edits made while Discord is open. **Save permanently** keeps them too. Turn it off with **Show what messages said before**.
- **Message tap gestures** starts off. With it on, double-tapping a message replies to it instead of reacting, and double-tapping your own message edits it. Tap your own message three times to delete it, with no question asked. Both can be changed in its settings. Based on [Geastures+](https://rksv.kmmiio99o.dev/GeasturesPlus) by kmmiio99o.
- **Channels you can't open** only show a channel's name and dates. It can't show messages or let you join locked voice channels.
- **Reviews** load from the community ReviewDB service at `manti.vendicated.dev`. To post or report reviews, sign in from its settings page. Signing in never uses your Discord token.
- **Emoji and sticker links** are links, not real Nitro emojis or stickers.
- **Force system emojis** shows your phone's emojis in chat, reactions, statuses and the emoji picker. An emoji your phone doesn't have yet stays Discord's. Custom server emojis aren't changed. Like the font, changing it offers to reopen Discord.
- **Hide the Quests promotion** hides the Quest banner above your profile bar, under the server list. Quests themselves, and Quest Completer, still work.
- **Force system font** needs Android 9 or newer. When you change it, Discord offers to reopen, so every screen switches at once instead of mixing fonts. Fonts people pick for their display name aren't changed.
- **Quest Completer** starts off. Turn on **Complete Quests automatically** in Venus settings. It checks for new Quests when Discord opens and every 30 minutes after. It accepts and completes video, Play and Activity Quests one at a time. Play and Activity Quests count time without installing or starting anything. That time is reported the way Discord's Windows app reports it, because Discord only counts play time from desktop. Stream Quests need a real stream, so they're skipped. You still claim rewards yourself. Discord may pause Quests on accounts that complete them automatically.
- **Passkeys and security keys can't be used to log in.** Google only lets apps signed by Discord use Discord's passkeys, and a patched app is signed with your key. This happens with any patched Discord, not because of a privacy option. Venus shows a clear message instead of "RP ID cannot be validated". Tap **Verify with something else** to use an authenticator app, SMS or a backup code.
- **Hide the call button** removes Call next to Message when you open someone's profile, and Message stretches across to fill the row. Calls from a DM still work.
- **Read all** uses Discord's own "Mark as read". It clears servers by default. Switch it to DMs or both in its settings, or hold the button for a one-time choice.

## For developers

```bash
python3 scripts/build.py    # builds and tests patches/build/libs/*.mpp
```

## License

[GPL-3.0](LICENSE). Notices are in [NOTICE](NOTICE).
