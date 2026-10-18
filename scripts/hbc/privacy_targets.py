"""Print the HbcPrivacy target lists for the pinned bundle (functions located by name and module)."""
import sys, os, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hbc import Bundle

# Each tuple is (module_path_or_None, function_id_in_349_9, function_name, promise)
# When porting to a new Discord build, pass --locate to resolve functions by (module_path, function_name)
# automatically instead of hardcoded 349.9 function IDs.
G = {
    'analytics': [
        ('MonitoringAgent.tsx', 34891, 'increment', False),
        ('MonitoringAgent.tsx', 34892, 'distribution', False),
        ('MonitoringAgent.tsx', 34893, '_flush', False),
        ('utils/AnalyticsUtils.tsx', 23516, 'track', True),
        ('../discord_common/js/packages/analytics-utils/AnalyticsUtils.tsx', 83725, 'track', True),
        ('AnalyticsTrackingStore.tsx', 83729, 'drainEventsQueue', True),
        ('AnalyticsTrackingStore.tsx', 83730, 'submitEventsImmediately', True),
        ('AnalyticsTrackingStore.tsx', 83731, 'flushQueuedEvents', True),
        ('AnalyticsTrackingStore.tsx', 83732, 'sendTelemetryEvent', True),
        ('AnalyticsTrackingStore.tsx', 83728, 'scheduleDrain', False),
        ('utils/AnalyticsUtils.tsx', 23519, 'startRecordingAnalyticsEvents', False),
        ('utils/AnalyticsUtils.tsx', 23451, 'addBreadcrumb', False),
        ('utils/AnalyticsUtils.tsx', 23452, 'expandEventProperties', False),
        ('utils/AnalyticsUtils.tsx', 23453, 'debugLogEvent', False),
        ('utils/AnalyticsUtils.tsx', 23524, 'trackNetworkAction', False),
        ('ImpressionStore.tsx', 23527, 'setCurrentImpression', False),
        ('ImpressionStore.tsx', 23528, 'cleanupImpression', False),
        ('ImpressionStore.tsx', 23529, 'setDebugTrackedData', False),
        ('ImpressionStore.tsx', 23530, 'getLocation', False),
        ('SessionHeartbeatScheduler.tsx', 40463, 'trackHeartbeat', False),
        ('SessionHeartbeatScheduler.tsx', 40466, 'scheduleHeartbeatTracking', False),
        ('SessionHeartbeatScheduler.tsx', 40478, 'initSessionHeartbeatScheduler', False),
        ('useTrackImpression.tsx', 47146, 'trackImpression', False),
        ('useTrackImpression.tsx', 47147, '', False),
        ('useTrackImpression.tsx', 47148, '', False),
        ('modules/search/native/tracking/Tracking.tsx', 59695, 'trackSearchOpened', False),
        ('modules/search/native/tracking/Tracking.tsx', 59696, 'trackSearchStarted', False),
        ('modules/search/native/tracking/Tracking.tsx', 59697, 'trackSearchResultClicked', False),
        ('modules/search/native/tracking/Tracking.tsx', 59698, 'trackSearchResultReturned', False),
        ('modules/search/native/tracking/Tracking.tsx', 59699, 'trackSearchEmptyResult', False),
        ('modules/search/native/tracking/Tracking.tsx', 59700, 'trackSearchEmptyMessageResult', False),
        ('modules/search/native/tracking/Tracking.tsx', 59701, 'trackSearchClosed', False),
        ('modules/search/native/tracking/Tracking.tsx', 59702, 'trackSearchIndexing', False),
        ('modules/search/native/tracking/Tracking.tsx', 59703, 'trackSearchHistoryClicked', False),
        ('modules/search/native/tracking/Tracking.tsx', 59704, 'trackSuggestedSearchClicked', False),
        ('modules/search/native/tracking/Tracking.tsx', 59705, 'trackSearchFilterAdd', False),
        ('modules/search/native/tracking/Tracking.tsx', 59706, 'trackSearchFilterRemove', False),
        ('modules/search/native/tracking/Tracking.tsx', 59707, 'trackSearchTabSelected', False),
        ('GatewaySocketAnalytics.tsx', 64068, 'logReadyPayloadReceived', False),
        ('GatewaySocketAnalytics.tsx', 64070, 'getReadyPayloadByteSizeAnalytics', False),
        ('GatewaySocketAnalytics.tsx', 64071, 'logGatewayConnected', False),
        ('GatewaySocketAnalytics.tsx', 64073, 'logResumeAnalytics', False),
        ('AutoAnalytics.tsx', 75652, 'componentDidMount', False),
        ('AutoAnalytics.tsx', 75653, 'componentDidUpdate', False),
        ('AutoAnalytics.tsx', 75655, '_trackWithMetadata', False),
        ('AppAnalyticsManager.tsx', 77602, '_initialize', False),
        ('AppAnalyticsManager.tsx', 77604, '_trackStartSpeaking', False),
        ('AppAnalyticsManager.tsx', 77605, '_trackStartListening', False),
    ],
    'telemetry': [
        ('libdiscoreExperiments.tsx', 19961, 'shouldCollectMetrics', False),
        ('websocketTelemetryHook.android.tsx', 79635, 'installWebsocketTelemetryHook', False),
        ('BaseTelemetryChannel.tsx', 25490, 'append', False),
        ('TelemetryRingNative.android.tsx', 25493, 'append', False),
        (None, 18182, 'fileFinishedImporting', False),
        ('AppStartPerformance.tsx', 18264, 'isTracing', False),
        (None, 18142, '', False),
        ('TelemetryRingLifecycle.tsx', 23397, '_initialize', False),
        ('ZoomedInTelemetry.tsx', 25468, 'shouldRun', False),
        ('ZoomedInAnalyticsExperiment.tsx', 25473, 'isZoomedExperimentEnabled', False),
        ('BaseTelemetryExportChannel.tsx', 25479, 'start', False),
        ('BaseTelemetryExportChannel.tsx', 25485, '_kick', True),
        ('TTIAnalyticsUtils.tsx', 40506, 'trackAppUIViewed2', False),
        ('TTIAnalyticsUtils.tsx', 40511, 'trackAppOpened', False),
        ('TTIAnalyticsUtils.tsx', 40512, 'trackAppUIViewed', False),
        ('TTIAnalyticsUtils.tsx', 40514, 'trackAppLaunchCompleted', False),
        ('timeRequire.native.tsx', 40654, 'timeRequire', False),
        ('PerformanceAnalyticsActionCreators.tsx', 42122, 'ttiRecorded', False),
        ('ArtProfileAnalytics.android.tsx', 42124, 'trackAndroidArtProfileSnapshot', False),
        ('TouchEventAnalyticsManager.android.tsx', 67297, '_initialize', False),
        ('isJankScreenReportingEnabled.tsx', 72113, 'isJankScreenReportingEnabled', False),
        ('navigationTTIEnabled.tsx', 74070, 'isNavigationTTIEnabled', False),
        ('NavigationSpanTracker.tsx', 74099, 'beginNavigation', False),
        ('NavigationSpanTracker.tsx', 74100, 'recordComponentSpan', False),
        ('NavigationSpanTracker.tsx', 74101, 'recordLateComponentLayout', False),
        ('NavigationSpanTracker.tsx', 74105, 'flush', False),
        ('trackHttpRequest.tsx', 77403, 'trackHttpRequest', False),
        ('JankSessionManager.android.tsx', 77847, '_initialize', False),
        ('JankSessionManager.android.tsx', 77850, 'deliverPendingSessions', False),
        ('JankNavigationReporter.android.tsx', 77852, 'attach', False),
        ('JankNavigationReporter.android.tsx', 77853, 'handleDispatch', False),
        ('JankNavigationReporter.android.tsx', 77854, 'handleStateSettled', False),
        ('JankStatsManager.android.tsx', 77861, 'handleAppStateUpdate', False),
        ('JankStatsManager.android.tsx', 77862, 'handleConnectionOpenSupplemental', False),
        ('JankStatsManager.android.tsx', 77863, 'scheduleReport', False),
        ('JankStatsManager.android.tsx', 77864, 'sendReport', False),
        ('NavigationTTIDispatcherManager.tsx', 79535, 'handleChannelSelect', False),
        ('modules/libdiscore/timerUtils.tsx', 79675, 'flushDelayLogs', False),
        ('modules/libdiscore/timerUtils.tsx', 79676, 'onTimersDelayCallback', False),
        ('modules/libdiscore/timerUtils.tsx', 79677, 'setupLibdiscoreTimersMonitor', False),
    ],
    'crash': [
        (None, 81910, 'send', True),
        (None, 112524, 'send', True),
        ('SentryInitUtils.tsx', 23394, 'initSentry', False),
        ('addSentryBreadcrumb.native.tsx', 20422, 'addSentryBreadcrumb', False),
        ('SentryUtils.native.tsx', 23375, 'setUser', False),
        ('SentryUtils.native.tsx', 23376, 'clearUser', False),
        ('SentryUtils.native.tsx', 23377, 'setTags', False),
        ('SentryUtils.native.tsx', 23378, 'setExtra', False),
        ('SentryUtils.native.tsx', 23379, 'captureException', False),
        ('SentryUtils.native.tsx', 23380, 'captureCrash', False),
        ('SentryUtils.native.tsx', 23381, 'captureMessage', False),
        ('SentryUtils.native.tsx', 23382, 'addFeatureFlag', False),
        ('SentryUtils.native.tsx', 23383, 'addBreadcrumb', False),
        ('SentryUtils.native.tsx', 23388, 'getLastCrashReport', True),
        ('SentryInitUtils.tsx', 23393, 'trackCrash', False),
        ('AppCrashedFatalReport.android.tsx', 79678, 'init', False),
    ],
}

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    locate = '--locate' in sys.argv[1:]
    B = Bundle(args[0] if args else 'work/new/assets/index.android.bundle')
    h = B.h
    b = h.b
    path_to_mid = {}
    for mid, p in B.paths().items():
        path_to_mid[p] = mid
        path_to_mid[os.path.basename(p)] = mid

    for g, ts in G.items():
        print(f"    val {g} = listOf(")
        for mod, i, n, p in ts:
            if locate and mod and (i >= h.h['functionCount'] or h.fname(i) != n or not h.func(i)['expanded'] or (h.func(i)['flags'] & 0xc8 != 0)):
                mid = path_to_mid.get(mod) or path_to_mid.get(os.path.basename(mod))
                if mid is not None:
                    matches = [f for f in B.tree(mid) if h.fname(f) == n and h.func(f)['expanded'] and (h.func(f)['flags'] & 0xc8 == 0)]
                    if len(matches) == 1:
                        i = matches[0]
            f = h.func(i)
            assert h.fname(i) == n and f['expanded'], (i, n, h.fname(i))
            assert f['flags'] & 0xc8 == 0, f"#{i} ({n}) has exception handler or non-normal flags: 0x{f['flags']:02x}"
            body = hashlib.sha256(b[f['offset']:f['offset'] + f['size']]).hexdigest()
            exp = hashlib.sha256(b[f['header']:f['header'] + 40]).hexdigest()
            print(f'        Target({i}, "{n}", {f["offset"]}, {f["size"]}, "{b[128+i*12:140+i*12].hex()}", "{body}", {"true" if p else "false"}, "{exp}"),')
        print("    )")


if __name__ == '__main__':
    main()
