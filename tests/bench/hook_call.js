// hookExport: every hooked store/action method goes through operation(orig, this, arguments).
var store = {count: 0, getMessage: function (c, id) { this.count++; return id; }};
function pass(orig, self, args) { return orig.apply(self, args); }
var orig = store.getMessage;
var viaArguments = function () { return pass(orig, this, arguments); };
var direct2 = function (a, b) { return arguments.length === 2 ? orig.call(this, a, b) : pass(orig, this, arguments); };
bench("arguments + apply (ships)", function () { for (var i = 0; i < 20000; i++) viaArguments.call(store, "1", i); });
bench("2-arg fast path + call", function () { for (var i = 0; i < 20000; i++) direct2.call(store, "1", i); });
// Where the cost is: reifying `arguments` to pass it on, or .apply?
var viaArray = function (a, b) { return pass(orig, this, arguments.length === 2 ? [a, b] : arguments); };
function passCall(orig, self, args) { return orig.call(self, args[0], args[1]); }
var argsThenCall = function () { return passCall(orig, this, arguments); };
bench("2-arg array literal + apply", function () { for (var i = 0; i < 20000; i++) viaArray.call(store, "1", i); });
bench("arguments + call", function () { for (var i = 0; i < 20000; i++) argsThenCall.call(store, "1", i); });
// Candidate for hookExport: an op that declares `fast` gets (orig, self, a, b) for 2-arg calls, so no arguments
// object is passed on; any other arity falls back to the arguments path unchanged.
function canFast(orig, self, a, b) { return orig.call(self, a, b); }
canFast.args = pass;
var viaFast = function (a, b) { return arguments.length === 2 ? canFast(orig, this, a, b) : canFast.args(orig, this, arguments); };
bench("fast op (orig, self, a, b)", function () { for (var i = 0; i < 20000; i++) viaFast.call(store, "1", i); });

// getMessages(channelId) and avatar Status(props): 1-arg call1 fast path vs arguments + apply (relative to 2-arg baseline)
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
bench("getMessages (old arguments + apply)", function () { for (var i = 0; i < 20000; i++) gmArgs.call(msgStore2, "123"); });
bench("getMessages (new call1 fast path)", function () { for (var i = 0; i < 20000; i++) gmCall1.call(msgStore2, "123"); });
