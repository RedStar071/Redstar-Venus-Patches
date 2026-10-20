#!/usr/bin/env python3
"""
Porting & verification assistant for upgrading Venus Patches to a new Discord Android release.

Usage:
    python3 scripts/hbc/port_check.py [work/new/assets/index.android.bundle]

Prints:
1. HbcPrelude.kt & HbcPrivacy.kt bundle constants (ORIGINAL_SHA256, FUNCTION_COUNT, GLOBAL_OFFSET,
   GLOBAL_SIZE, GLOBAL_SHA256, JOIN_ID, EVAL_ID, PROMISE_ID, RESOLVE_ID).
2. Resolution status of all Metro modules hooked or demand-loaded by bootstrap.js (by source path
   and exported identifiers).
3. Resolution status and auto-located candidates for all 106 HbcPrivacy functions.
"""
import sys, os, hashlib, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hbc import Bundle, CLOSURES
from privacy_targets import G

BOOTSTRAP_MODULES = [
    (17, None, ['AccessibilityInfo', 'Alert', 'AppRegistry', 'Pressable'], 'React Native'),
    (19, None, ['exports'], 'React'),
    (81, None, ['pickScale', 'setCustomSourceTransformer', 'addCustomSourceTransformer', 'default'], 'resolveAssetSource (Icon packs)'),
    (84, None, ['registerAsset', 'getAssetByID'], 'AssetRegistry (Icon packs)'),
    (120, None, ['enableIntersectionObserverByDefault', 'enableMutationObserverByDefault'], 'RN Environment setup'),
    (328, None, ['displayName', 'getSize', 'prefetch', 'resolveAssetSource', 'default'], 'RN.Image (Icon packs)'),
    (414, None, ['Pressable', 'android_disableSound'], 'Chat Picker Pressable'),
    (510, '../discord_common/js/packages/storage/Storage.tsx', ['Storage'], 'Storage (hasLoaded gate for Account switcher)'),
    (584, None, ['default', 'DispatchBand', 'STORAGE_KEY_LOG_DISPATCHES'], 'Flux Dispatcher instance (578 is only the class)'),
    (587, '../discord_common/js/packages/tokens/native.tsx', ['default', 'Theme', 'RawColor'], 'Theme tokens'),
    (589, '../discord_common/js/packages/tokens/colors/generated/native/generated-definitions.tsx', ['_private', 'SemanticColors'], 'SemanticColors'),
    (590, '../discord_common/js/packages/tokens/colors/generated/native/experiment-definitions.tsx', ['_private', 'SemanticColorExperiments'], 'SemanticColorExperiments (Custom themes: experiment overrides win over SemanticColors)'),
    (591, '../discord_common/js/packages/tokens/colors/generated/raw-color-definitions.tsx', ['_private', 'RawColors'], 'RawColors'),
    (1085, None, ['A11Y_RUNTIME_VIOLATION', 'ACCOUNT_SCHEDULED_FOR_DELETION'], 'Discord Constants'),
    (1096, '../discord_common/js/shared/Constants.tsx', ['PRIMARY_NORMAL', 'PRIMARY_NORMAL_ITALIC', 'PRIMARY_MEDIUM'], 'Permissions constant'),
    (1111, '../discord_common/js/shared/lib/TokenManager.tsx', ['init', 'getAnalyticsToken', 'getToken'], 'TokenManager'),
    (1112, 'modules/routing/router_utils.tsx', ['shouldNavigate', 'transitionTo', 'transitionToGuild'], 'NavigationUtils'),
    (1126, 'intl/index.native.tsx', ['intl', 'getSystemLocale', 'getAvailableLocales'], 'Intl / Locale strings'),
    (1162, '../discord_common/js/packages/rtn-codegen/js/NativeFileModule.tsx', ['default'], 'NativeFileModule'),
    (1193, 'modules/user_settings/ThemeStore.tsx', ['default', 'UNSET', 'SET'], 'ThemeStore'),
    (1251, None, ['murmur', 'noConflict'], 'MurmurHashV3'),
    (1282, '../discord_common/js/packages/http-utils/HTTPUtils.tsx', ['INVALID_FORM_BODY_ERROR_CODE', 'convertSkemaError', 'stringifyErrors'], 'HTTPUtils'),
    (1347, '../discord_common/js/packages/analytics-utils/getSuperProperties.tsx', ['browser_user_agent', 'browser_version', 'os_sdk_version'], 'SuperProperties'),
    (1377, 'stores/UserStore.tsx', ['default', 'users', 'ASSISTANT_WUMPUS_VOICE_USER'], 'UserStore'),
    (1402, 'utils/AvatarUtils.tsx', ['default'], 'AvatarUtils'),
    (1490, 'design/components/Navigator/native/useNavigation.native.tsx', ['useNavigation', 'useNativeStackNavigation', 'useStackNavigation'], 'useStackNavigation'),
    (1986, 'stores/native/AppStateStore.tsx', ['default'], 'AppStateStore'),
    (2051, 'stores/ChannelStore.tsx', ['Basic', 'Full', 'default'], 'ChannelStore'),
    (2074, 'stores/GuildStore.tsx', ['default'], 'GuildStore'),
    (2103, 'stores/SelectedChannelStore.tsx', ['default', 'findFirstVoiceChannelId', 'handleConnectionOpen'], 'SelectedChannelStore (Hidden channels never opens a locked channel by itself)'),
    (2106, 'stores/GuildRoleStore.tsx', ['default', 'getNumRoles'], 'GuildRoleStore'),
    (2112, 'stores/GuildMemberStore.tsx', ['GUILD', 'USER', 'default'], 'GuildMemberStore'),
    (2116, 'modules/user_settings/LocaleStore.tsx', ['default'], 'LocaleStore'),
    (4507, 'stores/GuildChannelStore.tsx', ['default', 'GUILD_SELECTABLE_CHANNELS_KEY', 'GUILD_VOCAL_CHANNELS_KEY'], 'GuildChannelsStore'),
    (4509, 'stores/PermissionStore.tsx', ['default'], 'PermissionStore'),
    (4510, 'modules/lurker_mode/LurkingStore.tsx', ['default'], 'LurkingStore'),
    (4516, 'modules/app_channels/AppChannelPermissions.tsx', ['APP_CHANNEL_MINIMUM_BOT_PERMISSIONS', 'SWAP_APP_CHANNEL_APPLICATION_PERMISSION_LIST', 'SWAP_APP_CHANNEL_APPLICATION_PERMISSIONS'], 'computePermissions'),
    (4519, 'stores/RelationshipStore.tsx', ['default'], 'RelationshipStore'),
    (4528, 'utils/PremiumUtils.tsx', ['BUNDLE', 'TIER_0', 'TIER_1'], 'PremiumUtils'),
    (4568, 'modules/toast/native/ToastActionCreators.tsx', ['default'], 'ToastActionCreators'),
    (4579, 'design/components/Icon/native/BaseIconImage.tsx', ['BaseIconImage'], 'BaseIconImage (Icon packs)'),
    (4593, '../discord_common/js/packages/design/components/ThemeContextProvider/ThemeContext.tsx', ['createThemedContext', 'useThemeContext', 'FALLBACK_THEME_CONTEXT_VALUE'], 'ThemeContext'),
    (4736, 'modules/main_tabs_v2/helpers/NavigationRouteUtils.native.tsx', ['navigateToChannel', 'navigateToRootTab', 'pushModal', 'popModal'], 'ModalAPI'),
    (4737, 'modules/main_tabs_v2/RootNavigationRef.native.tsx', ['getRootNavigationRef'], 'RootNavigationRef'),
    (4780, 'stores/GuildMemberCountStore.tsx', ['default', 'getMemberCount', 'getOnlineCount'], 'GuildMemberCountStore'),
    (4792, 'design/components/Icon/native/redesign/generated/CircleCheckIcon.tsx', ['CircleCheckIcon'], 'CircleCheckIcon'),
    (4797, 'design/components/Icon/native/redesign/generated/CircleXIcon.tsx', ['CircleXIcon'], 'CircleXIcon'),
    (4812, 'design/components/Icon/native/redesign/generated/CircleInformationIcon.tsx', ['CircleInformationIcon'], 'CircleInformationIcon'),
    (4817, 'design/components/Icon/native/redesign/generated/EnvelopeIcon.tsx', ['EnvelopeIcon'], 'EnvelopeIcon'),
    (4831, 'design/components/Icon/native/redesign/generated/FriendsIcon.tsx', ['FriendsIcon'], 'FriendsIcon'),
    (4833, 'design/components/Icon/native/redesign/generated/UserPlusIcon.tsx', ['UserPlusIcon'], 'UserPlusIcon'),
    (4839, 'design/components/Icon/native/redesign/generated/LinkIcon.tsx', ['LinkIcon'], 'LinkIcon'),
    (4841, 'design/components/Icon/native/redesign/generated/SendMessageIcon.tsx', ['SendMessageIcon'], 'SendMessageIcon (preview message bar)'),
    (4843, 'design/components/Icon/native/redesign/generated/CopyIcon.tsx', ['CopyIcon'], 'CopyIcon'),
    (4845, 'design/components/Icon/native/redesign/generated/DownloadIcon.tsx', ['DownloadIcon'], 'DownloadIcon'),
    (4847, 'design/components/Icon/native/redesign/generated/TrashIcon.tsx', ['TrashIcon'], 'TrashIcon'),
    (4854, 'modules/action_sheet/native/ActionSheetActionCreators.tsx', ['default', 'ACTION_SHEET_HEIGHT_HALF', 'ACTION_SHEET_HEIGHT_EXPANDED'], 'ActionSheetActionCreators'),
    (4855, 'modules/haptics/HapticUtils.native.tsx', ['HapticFeedbackTypes', 'triggerHapticFeedback'], 'HapticUtils'),
    (4856, 'modules/haptics/HapticFeedbackTypes.tsx', ['IMPACT_LIGHT', 'IMPACT_MEDIUM', 'SELECTION', 'default'], 'HapticFeedbackTypes'),
    (4886, 'design/components/Text/native/Text.tsx', ['TextStyleSheet', 'Text', 'Heading'], 'Design Text'),
    (4890, 'design/components/Styles/native/createStyles.tsx', ['experimental_createToken', 'createStyles', 'createLegacyClassComponentStyles'], 'createStyles'),
    (4905, 'stores/ReadStateStore.tsx', ['IS_GUILD_CHANNEL', 'IS_THREAD', 'IS_MENTION_LOW_IMPORTANCE'], 'ReadStateStore'),
    (4908, 'stores/SessionsStore.tsx', ['default'], 'SessionsStore'),
    (4930, 'stores/PresenceStore.tsx', ['default', 'sortActivity'], 'PresenceStore'),
    (5043, 'modules/channel/useChannelName.tsx', ['default', 'computeDefaultGroupDmNameFromUserIds', 'computeDefaultGroupDmName'], 'ChannelNameUtils'),
    (5072, 'modules/read_states/ReadStateConstants.tsx', ['CHANNEL', 'GUILD_EVENT', 'NOTIFICATION_CENTER'], 'ReadStateTypes'),
    (5110, 'stores/MessageStore.tsx', ['default'], 'MessageStore'),
    (5112, 'modules/messages/MessageRecordUtils.tsx', ['createMessageRecord', 'updateServerMessage', 'updateMessageRecord'], 'MessageRecordUtils'),
    (5593, 'design/components/Stack/native/Stack.native.tsx', ['Stack'], 'Stack'),
    (5594, 'design/components/Button/native/Button.native.tsx', ['Button'], 'Button'),
    (5616, 'stores/SortedGuildStore.tsx', ['default', 'GuildsNodeType', 'insertUnsortedGuilds'], 'SortedGuildStore'),
    (5630, '../discord_common/js/shared/shared-constants/AdCreativeType.tsx', ['INVALID', 'QUEST', 'QUEST_HOME_HERO'], 'AdCreativeType'),
    (5638, 'modules/emojis/EmojiStore.tsx', ['Unloaded', 'Loading', 'Loaded'], 'EmojiStore'),
    (5640, 'modules/emojis/RawGuildEmojiStore.tsx', ['default', 'getGuildEmojis'], 'RawGuildEmojiStore'),
    (5687, 'modules/stickers/StickersStore.tsx', ['Unloaded', 'Loaded', 'default'], 'StickersStore'),
    (5688, 'modules/stickers/GuildStickersStore.tsx', ['default', 'getStickersByGuildId'], 'GuildStickersStore'),
    (5705, 'actions/GuildActionCreators.tsx', ['default', 'requestMembersById'], 'GuildActionCreators'),
    (5708, 'actions/native/AlertActionCreators.tsx', ['default'], 'AlertActionCreators'),
    (5796, 'modules/markup/MarkupChannelMentionRule.tsx', ['default', 'getChannel', 'parseChannel'], 'MarkupChannelMentionRule'),
    (5855, 'design/components/Icon/native/redesign/generated/ChatIcon.tsx', ['ChatIcon'], 'ChatIcon'),
    (5857, 'design/components/Icon/native/redesign/generated/ThreadIcon.tsx', ['ThreadIcon'], 'ThreadIcon (preview channel header)'),
    (5862, 'design/components/Icon/native/redesign/generated/TextLockIcon.tsx', ['TextLockIcon'], 'TextLockIcon'),
    (5864, 'design/components/Icon/native/redesign/generated/TextIcon.tsx', ['TextIcon'], 'TextIcon'),
    (5871, 'design/components/Icon/native/redesign/generated/ImageIcon.tsx', ['ImageIcon'], 'ImageIcon'),
    (5873, 'design/components/Icon/native/redesign/generated/GroupIcon.tsx', ['GroupIcon'], 'GroupIcon'),
    (5874, 'design/components/Icon/native/redesign/generated/AtIcon.tsx', ['AtIcon'], 'AtIcon'),
    (5879, 'design/components/Icon/native/redesign/generated/LockIcon.tsx', ['LockIcon'], 'LockIcon'),
    (5890, 'design/components/Icon/native/redesign/generated/AppsIcon.tsx', ['AppsIcon'], 'AppsIcon'),
    (5928, 'design/components/Icon/native/redesign/generated/ClipboardListIcon.tsx', ['ClipboardListIcon'], 'ClipboardListIcon'),
    (5990, 'design/components/TableRow/native/TableCheckboxRow.native.tsx', ['TableCheckboxRow'], 'TableCheckboxRow'),
    (5993, 'design/components/TableRow/native/TableRow.native.tsx', ['Icon', 'Arrow', 'TrailingText'], 'TableRow'),
    (5995, 'design/components/Card/native/Card.native.tsx', ['Card', 'InternalCard'], 'Card'),
    (5999, 'design/components/TableRow/native/TableRowIcon.native.tsx', ['TableRowIcon'], 'TableRowIcon'),
    (6014, 'design/components/Icon/native/redesign/generated/ArrowLargeLeftIcon.tsx', ['ArrowLargeLeftIcon'], 'ArrowLargeLeftIcon (preview channel header)'),
    (6017, 'design/components/Icon/native/redesign/generated/XSmallIcon.tsx', ['XSmallIcon'], 'XSmallIcon'),
    (6071, 'design/components/TableRow/native/TableRadioRow.native.tsx', ['TableRadioRow'], 'TableRadioRow'),
    (6072, 'design/components/TableRow/native/TableRadioGroup.native.tsx', ['TableRadioGroupContext', 'TableRadioGroup'], 'TableRadioGroup'),
    (6074, 'design/components/TableRow/native/TableRowGroup.native.tsx', ['TableRowGroupTitle', 'TableRowGroup'], 'TableRowGroup'),
    (6112, None, ['BottomSheetScrollView', 'BottomSheetFlatList', 'BottomSheetModal'], '@gorhom/bottom-sheet (Server info sheet scrolling)'),
    (6098, 'design/components/TextInput/native/TextInput.native.tsx', ['TextInput'], 'TextInput'),
    (6446, 'design/components/Icon/native/redesign/generated/KeyIcon.tsx', ['KeyIcon'], 'KeyIcon'),
    (6448, 'design/components/Icon/native/redesign/generated/MobilePhoneIcon.tsx', ['MobilePhoneIcon'], 'MobilePhoneIcon'),
    (6456, 'design/components/Icon/native/redesign/generated/EyeSlashIcon.tsx', ['EyeSlashIcon'], 'EyeSlashIcon'),
    (6547, 'design/components/TextField/native/SearchField.native.tsx', ['SearchField'], 'SearchField'),
    (6548, 'design/components/Icon/native/redesign/generated/MagnifyingGlassIcon.tsx', ['MagnifyingGlassIcon'], 'MagnifyingGlassIcon'),
    (6605, 'actions/ReadStateActionCreators.tsx', ['ack', 'ackCategory', 'ackChannel'], 'ReadStateActionCreators'),
    (6625, 'modules/emojis/native/Emoji.tsx', ['default'], 'Emoji'),
    (6628, 'design/components/Icon/native/redesign/generated/CheckmarkSmallIcon.tsx', ['CheckmarkSmallIcon'], 'CheckmarkSmallIcon'),
    (6644, 'design/components/Sheet/native/BottomSheetTitleHeader.native.tsx', ['BottomSheetTitleHeader'], 'BottomSheetTitleHeader'),
    (6691, None, ['Clipboard', 'Platform', 'addListener'], 'Clipboard'),
    (6693, 'modules/action_sheet/native/showSimpleActionSheet.tsx', ['showSimpleActionSheet'], 'SimpleActionSheet'),
    (6696, 'design/components/Sheet/native/ActionSheetCloseButton.native.tsx', ['ActionSheetCloseButton'], 'ActionSheetCloseButton'),
    (6698, 'design/components/TableRow/native/TableSwitchRow.native.tsx', ['TableSwitchRow'], 'TableSwitchRow'),
    (6699, 'design/components/Forms/native/FormSwitch.native.tsx', ['FormSwitch'], 'FormSwitch'),
    (6701, 'design/components/Sheet/native/ActionSheet.native.tsx', ['ActionSheet'], 'ActionSheet'),
    (6708, 'design/components/Icon/native/redesign/generated/ChevronSmallRightIcon.tsx', ['ChevronSmallRightIcon'], 'ChevronSmallRightIcon'),
    (6815, 'actions/GuildSubscriptionsActionCreators.tsx', ['subscribeGuild'], 'GuildSubscriptionsActionCreators'),
    (6840, 'modules/stickers/StickerSendability.tsx', ['SENDABLE', 'SENDABLE_WITH_PREMIUM', 'NONSENDABLE'], 'StickerUtils'),
    (6883, 'design/components/Icon/native/redesign/generated/SettingsIcon.tsx', ['SettingsIcon'], 'SettingsIcon'),
    (6885, 'modules/user_settings/core/native/openUserSettings.tsx', ['openUserSettings'], 'UserSettingsActionCreators'),
    (6965, 'actions/MessageActionCreators.tsx', ['default'], 'MessageActionCreators'),
    (7037, 'modules/guild_scheduled_events/GuildScheduledEventStore.tsx', ['default', 'getGuildScheduledEventsForGuild'], 'GuildScheduledEventStore'),
    (7039, 'modules/guild_sidebar/ChannelListState.tsx', ['CannotShow', 'DoNotShow', 'WouldShowIfUncollapsed'], 'useGuildChannelsList'),
    (7121, 'stores/GuildReadStateStore.tsx', ['default'], 'GuildReadStateStore'),
    (7166, 'modules/messages/MessageParser.tsx', ['default', 'parseAndRebuild', 'createParserState'], 'MessageParser'),
    (7172, 'modules/chat/SlowmodeUtils.tsx', ['canBypassSlowmode', 'canBypassSlowmodeHelper', 'useCanBypassSlowmode'], 'SlowmodeUtils'),
    (7183, 'modules/quests/utils/QuestDataUtils.tsx', ['THIRTY_DAYS_MS', 'earnedDecisionIsValid', 'findQuestOrReplacement'], 'QuestDataUtils'),
    (7187, 'modules/quests/QuestStore.tsx', ['default'], 'QuestStore'),
    (7194, 'modules/quests/utils/QuestServerUtils.tsx', ['isQuestWithKnownConfigVersion', 'questConfigFromServer', 'questUserStatusFromServer'], 'questUserStatusFromServer'),
    (7243, 'utils/UploadUtils.tsx', ['MAX_TOTAL_ATTACHMENT_SIZE', 'MAX_TOTAL_ATTACHMENT_SIZE_1GB', 'MAX_TOTAL_ATTACHMENT_SIZE_MB'], 'AttachmentUtils'),
    (7252, 'modules/foreground_service/mobile/ForegroundServiceManager.android.tsx', ['default'], 'ForegroundServiceManager'),
    (7268, 'lib/uploader/CloudUpload.tsx', ['NOT_STARTED', 'STARTED', 'UPLOADING'], 'CloudUpload'),
    (7523, 'design/components/Icon/native/redesign/generated/PhoneCallIcon.tsx', ['PhoneCallIcon'], 'PhoneCallIcon'),
    (7553, 'design/components/Icon/native/redesign/generated/PaperIcon.tsx', ['PaperIcon'], 'PaperIcon'),
    (7571, 'design/components/Icon/native/redesign/generated/ThumbsUpIcon.tsx', ['ThumbsUpIcon'], 'ThumbsUpIcon'),
    (7577, 'design/components/Icon/native/redesign/generated/MoreHorizontalIcon.tsx', ['MoreHorizontalIcon'], 'MoreHorizontalIcon (preview server header)'),
    (7591, 'modules/messages/native/renderer/RowGenerator.tsx', ['default'], 'RowGenerator'),
    (7627, 'modules/double_tap_to_react/native/DoubleTapToReactUtils.tsx', ['getFallbackDoubleTapDisambiguatedEmoji', 'reactionEmojiFromSettingsValue', 'disambiguatedEmojiFromSettingsValue'], 'DoubleTapToReactUtils'),
    (7635, 'modules/replies/canReplyToMessage.tsx', ['useCanReplyToMessage', 'canReplyToMessage'], 'canReplyToMessage'),
    (7850, 'modules/user_profile/native/showUserProfileActionSheet.tsx', ['default', 'showUserProfileActionSheet'], 'showUserProfileActionSheet'),
    (7852, 'actions/UserActionCreators.tsx', ['fetchCurrentUser', 'acceptAgreements', 'setFlag'], 'UserActionCreators'),
    (7948, 'design/components/Icon/native/redesign/generated/PlayIcon.tsx', ['PlayIcon'], 'PlayIcon (preview Watch button)'),
    (7950, 'design/components/Icon/native/redesign/generated/PauseIcon.tsx', ['PauseIcon'], 'PauseIcon (preview player)'),
    (8263, 'design/components/Icon/native/redesign/generated/LinkExternalSmallIcon.tsx', ['LinkExternalSmallIcon'], 'LinkExternalSmallIcon'),
    (8313, 'design/components/Icon/native/redesign/generated/NitroWheelIcon.tsx', ['NitroWheelIcon'], 'NitroWheelIcon'),
    (8411, 'design/components/Icon/native/redesign/generated/ReactionIcon.tsx', ['ReactionIcon'], 'ReactionIcon'),
    (8524, 'design/components/Icon/native/redesign/generated/TagIcon.tsx', ['TagIcon'], 'TagIcon'),
    (8551, 'design/components/Icon/native/redesign/generated/GlobeEarthIcon.tsx', ['GlobeEarthIcon'], 'GlobeEarthIcon'),
    (8585, 'design/components/Icon/native/redesign/generated/QuoteIcon.tsx', ['QuoteIcon'], 'QuoteIcon'),
    (8716, 'modules/oauth2/native/OAuth2AuthorizeModal.tsx', ['default'], 'OAuth2AuthorizeModal'),
    (8739, 'design/components/Icon/native/redesign/generated/GameControllerIcon.tsx', ['GameControllerIcon'], 'GameControllerIcon'),
    (8791, 'design/components/Icon/native/redesign/generated/ServerIcon.tsx', ['ServerIcon'], 'ServerIcon'),
    (8809, 'modules/messages/useMessageMaxLength.tsx', ['default', 'getMaxMessageLength'], 'useMessageMaxLength'),
    (8828, 'modules/app_icons/native/AppIconConstants.tsx', ['getDefaultIcon', 'getOfficialAlternateIcons', 'getLimitedAlternateIcons'], 'AppIconConstants'),
    (8878, 'design/components/Icon/native/redesign/generated/UploadIcon.tsx', ['UploadIcon'], 'UploadIcon'),
    (8895, 'design/void/Form/native/index.tsx', ['Form', 'FormArrow', 'FormCheckbox'], 'Form'),
    (8923, 'design/components/Icon/native/redesign/generated/ShieldIcon.tsx', ['ShieldIcon'], 'ShieldIcon'),
    (8944, 'design/components/Icon/native/redesign/generated/ChatSmileIcon.tsx', ['ChatSmileIcon'], 'ChatSmileIcon'),
    (8966, 'lib/pushnotification/PushNotification.tsx', ['default'], 'PushNotification'),
    (9064, 'modules/chat_input/native/useChatBottomManagerUIStore.tsx', ['default', 'updateChatInputContainerHeight', 'updateShowingAutoComplete'], 'ChatInputHeightContext'),
    (9232, 'design/components/Icon/native/redesign/generated/ShieldUserIcon.tsx', ['ShieldUserIcon'], 'ShieldUserIcon'),
    (9266, 'design/components/Icon/native/redesign/generated/BellIcon.tsx', ['BellIcon'], 'BellIcon'),
    (9275, 'design/components/Icon/native/redesign/generated/CalendarIcon.tsx', ['CalendarIcon'], 'CalendarIcon'),
    (9334, 'modules/voice_panel/native/shared/FormComponents.tsx', ['VoicePanelFormSection', 'MemberRowItem'], 'VoiceChannelMembers'),
    (9576, 'design/components/Icon/native/redesign/generated/DoorExitIcon.tsx', ['DoorExitIcon'], 'DoorExitIcon'),
    (9597, 'design/components/Icon/native/redesign/generated/HandRequestSpeakIcon.tsx', ['HandRequestSpeakIcon'], 'HandRequestSpeakIcon (preview Try it button)'),
    (9640, 'design/components/Icon/native/redesign/generated/ImageSparkleIcon.tsx', ['ImageSparkleIcon'], 'ImageSparkleIcon (Icon packs)'),
    (9648, 'modules/premium/components/native/NitroUpsellButton.tsx', ['default'], 'NitroUpsellButton'),
    (9689, 'design/components/Icon/native/redesign/generated/MicrophoneIcon.tsx', ['MicrophoneIcon'], 'MicrophoneIcon (preview message bar)'),
    (9758, 'design/components/ThemeContextProvider/native/RootThemeContextProvider.native.tsx', ['RootThemeContextProvider', 'DisableCustomTheme'], 'RootThemeContextProvider (Custom themes re-keys its memoized context)'),
    (9769, 'modules/chat/native/ChatViewWrapper.tsx', ['default'], 'ChatViewWrapper'),
    (9813, 'design/components/Icon/native/redesign/generated/BellSlashIcon.tsx', ['BellSlashIcon'], 'BellSlashIcon'),
    (9878, 'modules/double_tap_to_react/native/DoubleTapReminderToast.tsx', ['maybeShowDoubleTapReminderToast'], 'DoubleTapReminderToast'),
    (9943, 'design/components/Icon/native/redesign/generated/StarIcon.tsx', ['StarIcon'], 'StarIcon'),
    (9971, 'design/components/Icon/native/redesign/generated/BackspaceIcon.tsx', ['BackspaceIcon'], 'BackspaceIcon'),
    (9994, 'modules/quests/QuestActionCreators.tsx', ['SUCCESS', 'CAPTCHA_FAILED', 'UNKNOWN_ERROR'], 'QuestActionCreators'),
    (10058, 'design/components/Icon/native/redesign/generated/PencilIcon.tsx', ['PencilIcon'], 'PencilIcon'),
    (10090, 'actions/GIFPickerActionCreators.tsx', ['trackSearchStart', 'trackSearchResultViewed', 'search'], 'GIFPickerActionCreators'),
    (10093, 'modules/gif_picker/native/GIFPickerUtils.tsx', ['GIF_HEADER_HEIGHT', 'useFavoriteGIFsMobile', 'GIF_PICKER_ITEM_ESIMTATED_HEIGHT'], 'useFavoriteGIFsMobile'),
    (10358, 'design/components/Icon/native/redesign/generated/IdIcon.tsx', ['IdIcon'], 'IdIcon'),
    (10369, 'design/components/Icon/native/redesign/generated/AttachmentIcon.tsx', ['AttachmentIcon'], 'AttachmentIcon'),
    (10602, 'modules/main_tabs_v2/native/shared_components/user_list/UserRow.tsx', ['CALL', 'MESSAGE', 'ACCEPT'], 'UserRow'),
    (10631, 'design/components/Icon/native/redesign/generated/CrownIcon.tsx', ['CrownIcon'], 'CrownIcon'),
    (10654, 'design/components/Icon/native/redesign/generated/UserCircleIcon.tsx', ['UserCircleIcon'], 'UserCircleIcon'),
    (10689, 'design/components/Icon/native/redesign/generated/PlusLargeIcon.tsx', ['PlusLargeIcon'], 'PlusLargeIcon (preview message bar)'),
    (10692, 'design/components/Icon/native/redesign/generated/PinIcon.tsx', ['PinIcon'], 'PinIcon (Icon packs preview)'),
    (10766, 'design/components/Icon/native/redesign/generated/GiftIcon.tsx', ['GiftIcon'], 'GiftIcon'),
    (10843, 'modules/user_profile/native/UserProfilePrimaryInfo.tsx', ['default', 'DisplayName', 'UserTagAndPronouns'], 'UserProfileHeaderName'),
    (10844, 'design/components/Icon/native/redesign/generated/ChevronSmallDownIcon.tsx', ['ChevronSmallDownIcon'], 'ChevronSmallDownIcon (preview channel category)'),
    (10987, 'modules/profile_customization/native/BioText.tsx', ['default'], 'UserProfileBio'),
    (11021, None, ['pick', 'saveDocuments', 'keepLocalCopy', 'errorCodes', 'isErrorWithCode', 'types'], 'DocumentPicker (Backup and restore, 1.16.0)'),
    (11058, 'design/components/Icon/native/redesign/generated/KeyboardIcon.tsx', ['KeyboardIcon'], 'KeyboardIcon'),
    (11072, 'design/components/Icon/native/redesign/generated/ArrowLargeUpIcon.tsx', ['ArrowLargeUpIcon'], 'ArrowLargeUpIcon'),
    (11129, 'modules/settings/native/renderer/SettingBuilders.tsx', ['createToggle', 'createStatic', 'createRoute'], 'createSettingsList'),
    (11159, 'modules/messages/native/MessagesHandlers.tsx', ['MessagesHandlers'], 'MessagesHandlers'),
    (11227, 'design/components/Icon/native/redesign/generated/TimerIcon.tsx', ['TimerIcon'], 'TimerIcon'),
    (11234, 'design/components/Icon/native/redesign/generated/VideoIcon.tsx', ['VideoIcon'], 'VideoIcon'),
    (11281, 'modules/messages/native/long_press/LongPressMessageActionSheet.tsx', ['default'], 'LongPressMessageActionSheet'),
    (11290, 'modules/messages/native/long_press/LongPressMessageActionSheetUtils.tsx', ['getContextBarCancelReason', 'handleEdit', 'handleCreateThread'], 'LongPressMessageActionSheetUtils'),
    (11305, 'modules/replies/native/replyToMessage.tsx', ['default'], 'replyToMessage'),
    (11363, 'modules/double_tap_to_react/native/DoubleTapEmojiEditNudge.tsx', ['DoubleTapEmojiEditNudge'], 'DoubleTapEmojiEditNudge'),
    (11364, 'design/components/Icon/native/redesign/generated/RetryIcon.tsx', ['RetryIcon'], 'RetryIcon (preview Start over / New people)'),
    (11366, 'design/components/Icon/native/redesign/generated/ArrowAngleLeftUpIcon.tsx', ['ArrowAngleLeftUpIcon'], 'ArrowAngleLeftUpIcon'),
    (11378, 'modules/messages/canEditMessage.tsx', ['default'], 'canEditMessage'),
    (11435, 'design/components/Icon/native/redesign/generated/UserIcon.tsx', ['UserIcon'], 'UserIcon'),
    (11604, 'actions/TypingActionCreators.tsx', ['default'], 'TypingActionCreators'),
    (11775, 'design/components/Icon/native/redesign/generated/ArrowsUpDownIcon.tsx', ['ArrowsUpDownIcon'], 'ArrowsUpDownIcon'),
    (11864, 'modules/chat_input/native/action_buttons/ChatInputActions.tsx', ['displayName', 'default'], 'ChatInputSendAndGiftButton'),
    (11896, 'components_native/chat/JumpToPresentButton.tsx', ['default'], 'JumpToPresentButton'),
    (11897, 'modules/chat_input/native/ChatFloatingNavButton.tsx', ['default'], 'JumpToPresentPill'),
    (11898, None, ['__packager_asset', 'registerAsset'], 'JumpToPresent arrow asset'),
    (11918, 'modules/double_tap_to_react/native/DoubleTapToReactChatInputBanner.tsx', ['DoubleTapToReactChatInputBanner'], 'DoubleTapToReactChatInputBanner'),
    (12056, 'modules/multi_account/MultiAccountStore.tsx', ['INVALID', 'VALIDATING', 'VALID'], 'MultiAccountStore'),
    (12057, 'modules/multi_account/Constants.tsx', ['YOU_ACCOUNT_ACTION_SHEET', 'CHOOSE_ACCOUNT', 'MANAGE_ACCOUNTS_MODAL'], 'MultiAccountConstants'),
    (12058, 'modules/user/isStaffFromRawUser.tsx', ['default'], 'isStaffFromRawUser'),
    (12059, 'modules/multi_account/MultiAccountActionCreators.tsx', ['validateMultiAccountTokens', 'switchAccount', 'moveAccount'], 'MultiAccountActionCreators'),
    (12071, 'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx', ['displayName', 'default'], 'ChatInputGiftButton'),
    (12095, 'design/components/Icon/native/redesign/generated/ChatWarningIcon.tsx', ['ChatWarningIcon'], 'ChatWarningIcon'),
    (12190, 'design/components/Icon/native/redesign/generated/StickerIcon.tsx', ['StickerIcon'], 'StickerIcon'),
    (12241, 'design/components/Icon/native/redesign/generated/BoostTier1Icon.tsx', ['BoostTier1Icon'], 'BoostTier1Icon'),
    (12490, 'design/components/Icon/native/redesign/generated/WaveformIcon.tsx', ['WaveformIcon'], 'WaveformIcon'),
    (12500, 'design/components/Icon/native/redesign/generated/MagicWandIcon.tsx', ['MagicWandIcon'], 'MagicWandIcon'),
    (12767, 'modules/media_viewer/native/components/overlay/MediaViewerOverlayButtonFavoriteGIF.tsx', ['default'], 'MediaViewerHeader'),
    (12849, 'modules/user_profile/native/UserProfileActivityVoiceChannelUsers.tsx', ['default'], 'UserProfileActivityVoiceChannelUsers'),
    (12872, 'modules/user_profile/native/UserProfileNote.tsx', ['default'], 'UserProfileNote'),
    (12956, 'modules/user_profile/native/UserProfileContactButtons.tsx', ['default'], 'UserProfileContactButtons'),
    (13107, 'modules/main_tabs_v2/native/channel/header/PrivateChannelHeader.tsx', ['default'], 'PrivateChannelHeader'),
    (13330, 'design/components/Icon/native/redesign/generated/BoostTier3Icon.tsx', ['BoostTier3Icon'], 'BoostTier3Icon'),
    (13439, 'modules/gateway/GatewaySocketSingleton.tsx', ['handleIdentify', 'socket', 'localPresenceState'], 'GatewaySocketSingleton'),
    (13477, 'modules/gateway/PauseGatewaySocket.tsx', ['getIsPaused', 'setIsPaused'], 'PauseGatewaySocket'),
    (13564, 'stores/PrivateChannelReadStateStore.tsx', ['default'], 'PrivateChannelReadStateStore'),
    (13650, 'modules/message_request/MessageRequestUtils.tsx', ['filterOutMessageRequestsAndSpam', 'filterOutMessageRequestsAndSpamById', 'isMessageRequestOrSpamRequest'], 'MessageRequestUtils'),
    (13773, 'modules/guild/markGuildsAsRead.tsx', ['default'], 'markGuildsAsRead'),
    (13790, 'modules/guild_action_sheet/native/components/GuildActionSheetProgress.tsx', ['default'], 'GuildActionSheetJoinRequestRow'),
    (13797, 'modules/premium/ProductCatalog.tsx', ['ANIMATED_EMOJIS', 'EMOJIS_EVERYWHERE', 'STICKERS_EVERYWHERE'], 'EmojiPermissions'),
    (13920, 'design/void/Status/native/Status.tsx', ['default', 'StatusWithTyping'], 'Status'),
    (14259, 'design/components/ContextMenu/native/ContextMenuPopout.native.tsx', ['ContextMenuPopout'], 'ContextMenuPopout'),
    (14409, 'modules/user_settings/core/native/SettingsRendererConfig.tsx', ['SETTING_RENDERER_CONFIG'], 'SettingRendererConfig'),
    (14421, 'modules/color_picker/native/showCustomColorPickerActionSheet.tsx', ['CUSTOM_COLOR_PICKER_KEY', 'CustomColorPicker'], 'showCustomColorPickerActionSheet'),
    (14500, 'modules/settings/native/renderer/SettingListRenderer.tsx', ['SettingsList', 'SearchableSettingsList'], 'SettingsList'),
    (14503, 'modules/settings/native/renderer/SettingRendererUtils.tsx', ['onRouteSettingOnPress', 'getSettingTitle', 'getSettingSearchableTitles'], 'SettingScreens'),
    (14754, 'design/components/Icon/native/redesign/generated/LaptopPhoneIcon.tsx', ['LaptopPhoneIcon'], 'LaptopPhoneIcon'),
    (14762, 'design/components/Icon/native/redesign/generated/PuzzlePieceIcon.tsx', ['PuzzlePieceIcon'], 'PuzzlePieceIcon'),
    (14803, 'design/components/Icon/native/redesign/generated/QuestsIcon.tsx', ['QuestsIcon'], 'QuestsIcon'),
    (14892, 'modules/quests/native/QuestHooks.native.tsx', ['useMobileQuestDockHeight', 'useMobileQuestDock', 'useIsMobileQuestDockVisibleToUser'], 'useMobileQuestDock'),
    (14899, 'modules/main_tabs_v2/native/you_bar/YouBarConstants.tsx', ['CONNECTION_BANNER_HEIGHT', 'YOU_BAR_SPRING_CONFIG', 'YOU_BAR_PADDING'], 'YouBarConstants'),
    (14985, 'modules/quests/native/QuestDock/QuestDock.tsx', ['PENDING', 'SUCCEEDED', 'FAILED'], 'QuestDock'),
    (15080, 'design/components/Icon/native/redesign/generated/PaintPaletteIcon.tsx', ['PaintPaletteIcon'], 'PaintPaletteIcon'),
    (15172, 'design/components/Icon/native/redesign/generated/EyeDropperIcon.tsx', ['EyeDropperIcon'], 'EyeDropperIcon'),
    (15243, 'design/components/Icon/native/redesign/generated/LanguageIcon.tsx', ['LanguageIcon'], 'LanguageIcon'),
    (15351, 'modules/user_settings/app_icon/native/UserSettingsAppIcons.tsx', ['default'], 'UserSettingsAppIcons'),
    (15352, 'modules/app_icons/native/AppIconRows.tsx', ['default'], 'AppIconRows'),
    (15411, 'design/components/Icon/native/redesign/generated/HashmarkIcon.tsx', ['HashmarkIcon'], 'HashmarkIcon'),
    (15447, 'design/components/Icon/native/redesign/generated/DoubleCheckmarkIcon.tsx', ['DoubleCheckmarkIcon'], 'DoubleCheckmarkIcon'),
    (15493, 'design/components/Icon/native/redesign/generated/LettersIcon.tsx', ['LettersIcon'], 'LettersIcon'),
    (15620, 'design/components/Icon/native/redesign/generated/BugIcon.tsx', ['BugIcon'], 'BugIcon'),
    (15962, 'modules/main_tabs_v2/native/tabs/messages/items/channel/MessagesItemChannelContent.tsx', ['default'], 'MessagesItemChannelContent'),
    (16149, 'design/components/Icon/native/redesign/generated/BoostTier2Icon.tsx', ['BoostTier2Icon'], 'BoostTier2Icon'),
    (16157, 'modules/guild_sidebar/native/ChannelInfo.tsx', ['default'], 'ChannelInfo'),
    (16222, 'modules/guilds_bar/native/GuildsBarConstants.tsx', ['MESSAGES', 'FAVORITES', 'PENDING_JOIN_REQUESTS'], 'FastListRenderSections'),
    (16226, 'modules/guilds_bar/native/utils/getGuildsBarGuildMenuItems.tsx', ['default'], 'getGuildsBarGuildMenuItems (Server info menu row)'),
    (16232, 'modules/guilds_bar/native/hooks/useGuildsBarProps.tsx', ['MESSAGES', 'FAVORITES', 'PENDING_JOIN_REQUESTS'], 'useGuildsBarProps'),
    (16310, 'modules/main_tabs_v2/native/tabs/you/utils/showYouAccountActionSheet.tsx', ['showYouAccountActionSheet'], 'showYouAccountActionSheet'),
    (16315, 'modules/multi_account/native/openManageAccountsModal.tsx', ['default'], 'openManageAccountsModal'),
    (16317, 'modules/multi_account/native/ManageAccountsConstants.tsx', ['MANAGE_ACCOUNTS', 'LOGIN', 'ACCOUNT_DISABLED_OR_DELETION_SCHEDULED'], 'ManageAccountsConstants'),
    (16334, 'modules/main_tabs_v2/native/you_bar/YouBarButton.tsx', ['default', 'YouBarButtonIcon', 'YouBarButtonContainer'], 'YouBarButton'),
    (16335, 'modules/main_tabs_v2/native/you_bar/YouBarNotificationsButton.tsx', ['default'], 'YouBarButtons'),
    (16425, 'design/components/Icon/native/redesign/generated/PaintbrushThinIcon.tsx', ['PaintbrushThinIcon'], 'PaintbrushThinIcon'),
    (16603, 'design/components/Icon/native/redesign/generated/SparklesIcon.tsx', ['SparklesIcon'], 'SparklesIcon'),
    (17106, 'modules/app_icons/native/AppIconsCoachmark.tsx', ['default'], 'AppIconsCoachmark'),
    (17455, 'modules/app_icons/native/AppIconPremiumManager.tsx', ['default'], 'AppIconPremiumManager'),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'work/new/assets/index.android.bundle'
    with open(path, 'rb') as fp:
        raw_bytes = fp.read()

    bundle_sha256 = hashlib.sha256(raw_bytes).hexdigest()
    B = Bundle(path)
    h = B.h
    b = h.b

    f0 = h.func(0)
    g0_sha256 = hashlib.sha256(b[f0['offset']:f0['offset'] + f0['size']]).hexdigest()

    def find_ascii_string_id(target):
        for i in range(h.h['stringCount']):
            if h.string(i) == target:
                return i
        return None

    join_id = find_ascii_string_id('join')
    eval_id = find_ascii_string_id('eval')
    promise_id = find_ascii_string_id('Promise')
    resolve_id = find_ascii_string_id('resolve')
    empty_id = find_ascii_string_id('')

    print("=== 1. Bundle & Global Function Constants ===")
    print(f'HbcPrivacy.ORIGINAL_SHA256 = "{bundle_sha256}"')
    print(f"HbcPrelude.FUNCTION_COUNT  = {h.h['functionCount']}")
    print(f"HbcPrelude.GLOBAL_OFFSET   = {f0['offset']}")
    print(f"HbcPrelude.GLOBAL_SIZE     = {f0['size']}")
    print(f'HbcPrelude.GLOBAL_SHA256   = "{g0_sha256}"')
    print(f"Global #0 frame={f0['frame']}, reads={f0['read']}, flags=0x{f0['flags']:02x}")
    print(f"String IDs: JOIN_ID={join_id}, EVAL_ID={eval_id}, PROMISE_ID={promise_id}, RESOLVE_ID={resolve_id}, EMPTY_ID={empty_id}")

    path_to_mid = {}
    for mid, p in B.paths().items():
        path_to_mid[p] = mid
        path_to_mid[os.path.basename(p)] = mid

    print("\n=== 2. Bootstrap Metro Module Verification ===")
    moved = 0
    for mid, path_hint, exports, desc in BOOTSTRAP_MODULES:
        actual_path = B.paths().get(mid)
        if mid in B.modules:
            mstrings = B.strs(mid, deep=True)
            if all(e in mstrings for e in exports) and (path_hint is None or actual_path == path_hint):
                continue
        candidate = path_to_mid.get(path_hint) if path_hint else (B.find(*exports, deep=True)[0] if exports and B.find(*exports, deep=True) else None)
        print(f"  [MOVED/CHECK] 349.9 id={mid:5d} ({desc}): actual_path={actual_path!r}, candidate_in_new_bundle={candidate}")
        moved += 1
    if moved == 0:
        print(f"  OK: All {len(BOOTSTRAP_MODULES)} inspected Metro modules verified at their pinned IDs.")

    def locate_hbc_target(mod_hint, fn_name):
        if mod_hint:
            mid = path_to_mid.get(mod_hint) or path_to_mid.get(os.path.basename(mod_hint))
            if mid is not None:
                matches = [f for f in B.tree(mid) if h.fname(f) == fn_name and h.func(f)['expanded'] and (h.func(f)['flags'] & 0xc8 == 0)]
                if len(matches) == 1:
                    return matches[0]
                elif matches:
                    return matches
        return None

    print("\n=== 3. HbcPrivacy Target Verification ===")
    missing_hbc = 0
    for group, targets in G.items():
        for mod, fid, name, promise in targets:
            f = h.func(fid) if fid < h.h['functionCount'] else None
            if f is not None and h.fname(fid) == name and f['expanded'] and (f['flags'] & 0xc8 == 0):
                continue
            candidate = locate_hbc_target(mod, name)
            print(f"  [CHANGED] {group} #{fid} expected {name!r} (mod={mod}), got {h.fname(fid) if f else None!r} -> candidate={candidate}")
            missing_hbc += 1
    if missing_hbc == 0:
        print(f"  OK: All {sum(len(v) for v in G.values())} HbcPrivacy targets verified (expanded, no exception handlers, register-safe).")


if __name__ == '__main__':
    main()
