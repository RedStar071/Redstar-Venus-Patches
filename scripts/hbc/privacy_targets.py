"""Print the HbcPrivacy target lists for the pinned bundle (functions located by name and module)."""
import sys, os, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hbc import Bundle

# Each tuple is (module_path_or_None, function_id_in_348_10, function_name, promise)
# When porting to a new Discord build, pass --locate to resolve functions by (module_path, function_name)
# automatically instead of hardcoded 348.10 function IDs.
G = {
    'analytics': [
        ('MetricReporter.tsx', 34538, 'increment', False),
        ('MetricReporter.tsx', 34539, 'distribution', False),
        ('MetricReporter.tsx', 34540, '_flush', False),
        ('AnalyticsUtils.tsx', 23150, 'track', True),
        ('AnalyticsTrackingStore.tsx', 82662, 'track', True),
        ('AnalyticsTrackingStore.tsx', 82666, 'drainEventsQueue', True),
        ('AnalyticsTrackingStore.tsx', 82667, 'submitEventsImmediately', True),
        ('AnalyticsTrackingStore.tsx', 82668, 'flushQueuedEvents', True),
        ('AnalyticsTrackingStore.tsx', 82669, 'sendTelemetryEvent', True),
        ('AnalyticsTrackingStore.tsx', 82665, 'scheduleDrain', False),
        ('AnalyticsUtils.tsx', 23153, 'startRecordingAnalyticsEvents', False),
        ('AnalyticsUtils.tsx', 23085, 'addBreadcrumb', False),
        ('AnalyticsUtils.tsx', 23086, 'expandEventProperties', False),
        ('AnalyticsUtils.tsx', 23087, 'debugLogEvent', False),
        ('AnalyticsUtils.tsx', 23158, 'trackNetworkAction', False),
        ('ImpressionStore.tsx', 23161, 'setCurrentImpression', False),
        ('ImpressionStore.tsx', 23162, 'cleanupImpression', False),
        ('ImpressionStore.tsx', 23163, 'setDebugTrackedData', False),
        ('ImpressionStore.tsx', 23164, 'getLocation', False),
        ('SessionHeartbeatScheduler.tsx', 40779, 'trackHeartbeat', False),
        ('SessionHeartbeatScheduler.tsx', 40782, 'scheduleHeartbeatTracking', False),
        ('SessionHeartbeatScheduler.tsx', 40794, 'initSessionHeartbeatScheduler', False),
        ('useTrackImpression.tsx', 46836, 'trackImpression', False),
        ('useTrackImpression.tsx', 46837, '', False),
        ('useTrackImpression.tsx', 46838, '', False),
        ('SearchAnalytics.tsx', 59166, 'trackSearchOpened', False),
        ('SearchAnalytics.tsx', 59167, 'trackSearchStarted', False),
        ('SearchAnalytics.tsx', 59168, 'trackSearchResultClicked', False),
        ('SearchAnalytics.tsx', 59169, 'trackSearchResultReturned', False),
        ('SearchAnalytics.tsx', 59170, 'trackSearchEmptyResult', False),
        ('SearchAnalytics.tsx', 59171, 'trackSearchEmptyMessageResult', False),
        ('SearchAnalytics.tsx', 59172, 'trackSearchClosed', False),
        ('SearchAnalytics.tsx', 59173, 'trackSearchIndexing', False),
        ('SearchAnalytics.tsx', 59174, 'trackSearchHistoryClicked', False),
        ('SearchAnalytics.tsx', 59175, 'trackSuggestedSearchClicked', False),
        ('SearchAnalytics.tsx', 59176, 'trackSearchFilterAdd', False),
        ('SearchAnalytics.tsx', 59177, 'trackSearchFilterRemove', False),
        ('SearchAnalytics.tsx', 59178, 'trackSearchTabSelected', False),
        ('GatewaySocketAnalytics.tsx', 63488, 'logReadyPayloadReceived', False),
        ('GatewaySocketAnalytics.tsx', 63490, 'getReadyPayloadByteSizeAnalytics', False),
        ('GatewaySocketAnalytics.tsx', 63491, 'logGatewayConnected', False),
        ('GatewaySocketAnalytics.tsx', 63493, 'logResumeAnalytics', False),
        ('AutoAnalytics.tsx', 74671, 'componentDidMount', False),
        ('AutoAnalytics.tsx', 74672, 'componentDidUpdate', False),
        ('AutoAnalytics.tsx', 74674, '_trackWithMetadata', False),
        ('AppAnalyticsManager.tsx', 76582, '_initialize', False),
        ('AppAnalyticsManager.tsx', 76584, '_trackStartSpeaking', False),
        ('AppAnalyticsManager.tsx', 76585, '_trackStartListening', False),
    ],
    'telemetry': [
        ('PerformanceMetrics.tsx', 19593, 'shouldCollectMetrics', False),
        ('websocketTelemetry.tsx', 78572, 'installWebsocketTelemetryHook', False),
        ('TelemetryRingBuffer.native.tsx', 25121, 'append', False),
        ('TelemetryRingBuffer.tsx', 25124, 'append', False),
        ('importTracker.tsx', 17816, 'fileFinishedImporting', False),
        ('AppStartPerformance.tsx', 17898, 'isTracing', False),
        (None, 17776, '', False),
        ('TelemetryRingLifecycle.tsx', 23031, '_initialize', False),
        ('ZoomedInTelemetry.tsx', 25099, 'shouldRun', False),
        ('ZoomedInAnalyticsExperiment.tsx', 25104, 'isZoomedExperimentEnabled', False),
        ('BaseTelemetryExportChannel.tsx', 25110, 'start', False),
        ('BaseTelemetryExportChannel.tsx', 25116, '_kick', True),
        ('TTIAnalyticsUtils.tsx', 40822, 'trackAppUIViewed2', False),
        ('TTIAnalyticsUtils.tsx', 40827, 'trackAppOpened', False),
        ('TTIAnalyticsUtils.tsx', 40828, 'trackAppUIViewed', False),
        ('TTIAnalyticsUtils.tsx', 40830, 'trackAppLaunchCompleted', False),
        ('timeRequire.native.tsx', 40970, 'timeRequire', False),
        ('PerformanceAnalyticsActionCreators.tsx', 42536, 'ttiRecorded', False),
        ('ArtProfileAnalytics.android.tsx', 42538, 'trackAndroidArtProfileSnapshot', False),
        ('TouchEventAnalyticsManager.android.tsx', 66635, '_initialize', False),
        ('isJankScreenReportingEnabled.tsx', 71400, 'isJankScreenReportingEnabled', False),
        ('navigationTTIEnabled.tsx', 73327, 'isNavigationTTIEnabled', False),
        ('NavigationSpanTracker.tsx', 73356, 'beginNavigation', False),
        ('NavigationSpanTracker.tsx', 73357, 'recordComponentSpan', False),
        ('NavigationSpanTracker.tsx', 73358, 'recordLateComponentLayout', False),
        ('NavigationSpanTracker.tsx', 73362, 'flush', False),
        ('trackHttpRequest.tsx', 76375, 'trackHttpRequest', False),
        ('JankSessionManager.android.tsx', 76815, '_initialize', False),
        ('JankSessionManager.android.tsx', 76818, 'deliverPendingSessions', False),
        ('JankNavigationReporter.android.tsx', 76820, 'attach', False),
        ('JankNavigationReporter.android.tsx', 76821, 'handleDispatch', False),
        ('JankNavigationReporter.android.tsx', 76822, 'handleStateSettled', False),
        ('JankStatsManager.android.tsx', 76825, 'handleAppStateUpdate', False),
        ('JankStatsManager.android.tsx', 76826, 'handleConnectionOpenSupplemental', False),
        ('JankStatsManager.android.tsx', 76827, 'scheduleReport', False),
        ('JankStatsManager.android.tsx', 76828, 'sendReport', False),
        ('NavigationTTIDispatcherManager.tsx', 78481, 'handleChannelSelect', False),
        ('modules/libdiscore/timerUtils.tsx', 78612, 'flushDelayLogs', False),
        ('modules/libdiscore/timerUtils.tsx', 78613, 'onTimersDelayCallback', False),
        ('modules/libdiscore/timerUtils.tsx', 78614, 'setupLibdiscoreTimersMonitor', False),
    ],
    'crash': [
        (None, 80849, 'send', True),
        (None, 111344, 'send', True),
        ('SentryInitUtils.tsx', 23028, 'initSentry', False),
        ('addSentryBreadcrumb.native.tsx', 20069, 'addSentryBreadcrumb', False),
        ('SentryUtils.native.tsx', 23009, 'setUser', False),
        ('SentryUtils.native.tsx', 23010, 'clearUser', False),
        ('SentryUtils.native.tsx', 23011, 'setTags', False),
        ('SentryUtils.native.tsx', 23012, 'setExtra', False),
        ('SentryUtils.native.tsx', 23013, 'captureException', False),
        ('SentryUtils.native.tsx', 23014, 'captureCrash', False),
        ('SentryUtils.native.tsx', 23015, 'captureMessage', False),
        ('SentryUtils.native.tsx', 23016, 'addFeatureFlag', False),
        ('SentryUtils.native.tsx', 23017, 'addBreadcrumb', False),
        ('SentryInitUtils.tsx', 23022, 'getLastCrashReport', True),
        ('SentryInitUtils.tsx', 23027, 'trackCrash', False),
        ('AppCrashedFatalReport.android.tsx', 78615, 'init', False),
    ],
}

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    locate = '--locate' in sys.argv[1:]
    B = Bundle(args[0] if args else 'work/348/assets/index.android.bundle')
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
