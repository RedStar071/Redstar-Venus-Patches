// propsComponent (withoutGift on ChatInput 11864/12071, systemEmojiProps on Emoji 6625) and pickerComponent
// (Pressable 414) run on every render of those components. React passes (props) for functional/memo components
// and (props, ref) for forwardRef components.
var orig = function (props, ref) { return props; };
function change(props) { return props; }
var viaArrayFrom = function (props) {
    var args = Array.from(arguments); args[0] = change(props);
    return orig.apply(this, args);
};
var directCall = function (props, second) {
    var next = change(props), n = arguments.length;
    if (n <= 1) return orig.call(this, next);
    if (n === 2) return orig.call(this, next, second);
    var args = Array.from(arguments); args[0] = next;
    return orig.apply(this, args);
};
var sample = {shouldShowGiftButton: false, name: "\ud83d\ude00"};
bench("Array.from + apply, 1-arg (ships)", function () { for (var i = 0; i < 20000; i++) viaArrayFrom(sample); });
bench("direct call, 1-arg", function () { for (var i = 0; i < 20000; i++) directCall(sample); });
bench("Array.from + apply, 2-arg (ships)", function () { for (var i = 0; i < 20000; i++) viaArrayFrom(sample, null); });
bench("direct call, 2-arg", function () { for (var i = 0; i < 20000; i++) directCall(sample, null); });
