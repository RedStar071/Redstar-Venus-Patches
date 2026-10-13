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
| | Translate messages | Messages in other languages show in yours |
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
| **Servers** | Read all button | Marks servers, DMs or both as read in one tap |
| | Show hidden channels | Channels you can't open appear with a lock |
| | Spaces in channel names | "general chat" instead of "general-chat" |
| **Appearance** | Use your phone's font | Replaces Discord's font everywhere |
| | Use your phone's emojis | Your phone's emojis instead of Discord's |
| | Hide the gift button | Removes the Nitro gift button from the message bar |
| | Hide the call button | Removes Call from people's profiles |
| | Venus button on profile bar | A shortcut to Venus, next to the notifications bell |
| **Quests** | Complete Quests automatically | Finishes video, Play and Activity Quests in the background |
| | Hide the Quests banner | Removes the Quest promotion above your profile bar |

**About** shows your version, how many features are on, whether your settings are saved, and links to what's new and to report a problem.

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

## Good to know

- **Voice messages** need Android 10 or newer. Most audio files work. If a file can't be converted, it's sent as a normal attachment.
- **Deleted messages** are kept until Discord restarts. To keep them for good, turn on **Keep after restarting** in its settings. Delete a kept message again to hide it, or tap **Clear kept messages** to remove them all.
- **Edited messages** show what they said before, faded and crossed out in a quote above the new text. It starts on with Keep deleted messages, and only covers edits made while Discord is open. **Keep after restarting** keeps them too. Turn it off with **Show edit history**.
- **Double-tap to reply** starts off. With it on, double-tapping a message replies to it instead of reacting, and double-tapping your own message edits it. Tap your own message three times to delete it, with no question asked. Both can be changed in its settings. Based on [Geastures+](https://rksv.kmmiio99o.dev/GeasturesPlus) by kmmiio99o.
- **Channels you can't open** only show a channel's name and dates. It can't show messages or let you join locked voice channels.
- **Reviews** load from the community ReviewDB service at `manti.vendicated.dev`. To post or report reviews, sign in from its settings page. Signing in never uses your Discord token.
- **Nitro stickers and emojis** are sent as links, not real Nitro stickers or emojis. Chat shows the link as the image. With **Short links** on, the link shows as the sticker or emoji name instead of a long address.
- **Use your phone's emojis** shows your phone's emojis in chat, reactions, statuses and the emoji picker. An emoji your phone doesn't have yet stays Discord's. Custom server emojis aren't changed. Like the font, changing it offers to reopen Discord.
- **Hide the Quests banner** hides the Quest banner above your profile bar, under the server list. Quests themselves, and Complete Quests automatically, still work.
- **Use your phone's font** needs Android 9 or newer. When you change it, Discord offers to reopen, so every screen switches at once instead of mixing fonts. Fonts people pick for their display name aren't changed.
- **Complete Quests automatically** starts off. It checks for new Quests when Discord opens and every 30 minutes after. It accepts and completes video, Play and Activity Quests one at a time. Play and Activity Quests count time without installing or starting anything. That time is reported the way Discord's Windows app reports it, because Discord only counts play time from desktop. Stream Quests need a real stream, so they're skipped. You still claim rewards yourself. Discord may pause Quests on accounts that complete them automatically.
- **Passkeys and security keys can't be used to log in.** Google only lets apps signed by Discord use Discord's passkeys, and a patched app is signed with your key. This happens with any patched Discord, not because of a privacy option. Venus shows a clear message instead of "RP ID cannot be validated". Tap **Verify with something else** to use an authenticator app, SMS or a backup code.
- **Hide the call button** removes Call next to Message when you open someone's profile, and Message stretches across to fill the row. Calls from a DM still work.
- **Fix unknown mentions** works on its own: when a message mentions someone Discord hasn't loaded (shown as @unknown-user), Venus looks them up one at a time and redraws the message with their name. There's no button to press. Accounts that no longer exist show as Deleted User. Based on [ValidUser](https://github.com/fshinz/Revenge-Plugins/tree/master/plugins/ValidUser) by fshin, o.oer and kmmiio99o.
- **Venus button on profile bar** sits next to the notifications bell, under the server list, and opens Venus settings in one tap. Back goes to Discord's settings.
- **Translate messages** starts off. With it on, messages in another language show translated into Discord's language, or your phone's if you pick that in its settings, with a small "Translated from Spanish" line under them. Mentions, emojis, links, code and formatting stay as they were. Your own messages, short ones like "ok" and ones already in your language aren't changed. It can also show the original in a quote. Translations come from Google Translate's free service, the one its browser extension uses, so there's no key or account to set up. Only messages on screen are sent, once each, in batches, without your Discord account. The newest messages go first, up to three requests run at once, and if a request is slow or fails it's sent to Google's other server straight away. Translations are kept on your phone, so a chat you open again, even after a restart, shows them at once. **Clear saved translations** forgets them. Google doesn't publish a limit for it. If it asks to slow down, Venus waits and tries again later. This is the one feature that sends message text off your phone.
- **Send long messages** lets the message box go past 2,000 characters (4,000 with Nitro). A long message is sent as several, split at line breaks, then spaces. A code block cut in two is closed and opened again in the next part. Replies only apply to the first part, and the parts wait for slowmode. Based on SplitLargeMessages by sunnie.
- **Read all** uses Discord's own "Mark as read". It clears servers by default. Switch it to DMs or both in its settings, or hold the button for a one-time choice.

## For developers

```bash
python3 scripts/build.py    # builds and tests patches/build/libs/*.mpp
```

## License

[GPL-3.0](LICENSE). Notices are in [NOTICE](NOTICE).
