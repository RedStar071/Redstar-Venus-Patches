// Separate getMessages(channelId) A/B benchmark on Hermes HBC98:
// Baseline = old arguments + apply hook
// Candidate = 1-arg call1 fast path

var deletedByChannel = new Map();
var msgObj = {_array: []};
var msgStore2 = {getMessages: function (channelId) { return msgObj; }};
var origGm = msgStore2.getMessages;

function retainedMessagesBench(orig, self, args) {
    var result = orig.apply(self, args), channelId = args[0];
    if (!deletedByChannel.size || !result) return result;
    return result;
}
retainedMessagesBench.call1 = function (orig, self, channelId) {
    if (!deletedByChannel.size || !deletedByChannel.has(channelId)) return orig.call(self, channelId);
    return retainedMessagesBench(orig, self, [channelId]);
};

var gmArgs = function () { return retainedMessagesBench(origGm, this, arguments); };
var gmCall1 = function (a) { return arguments.length === 1 ? retainedMessagesBench.call1(origGm, this, a) : retainedMessagesBench(origGm, this, arguments); };

bench("getMessages: arguments + apply (old)", function () { for (var i = 0; i < 20000; i++) gmArgs.call(msgStore2, "123"); });
bench("getMessages: call1 fast path (new)", function () { for (var i = 0; i < 20000; i++) gmCall1.call(msgStore2, "123"); });
