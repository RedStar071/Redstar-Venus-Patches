// Benchmark escapeTranslate + translateLayout on Hermes HBC98.
var TRANSLATE_GROUPS = new Set(["strong", "em", "u", "s", "spoiler", "subtext", "heading", "blockQuote", "list", "paragraph"]);
var TRANSLATE_LETTER = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/g;
var TRANSLATE_MAX_TEXT = 4000;

function escapeTranslateOld(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function translateLayoutOld(content) {
    var nodes = [];
    var letters = 0, lines = false, failed = false;
    function walk(list, depth) {
        var out = "";
        if (depth > 8) { failed = true; return out; }
        for (var i = 0; i < list.length; i++) {
            var node = list[i];
            if (!node || typeof node !== "object") continue;
            if (node.type === "text" && typeof node.content === "string") {
                var text = node.content.indexOf("\u200b") >= 0 ? node.content.replace(/\u200b/g, "") : node.content;
                if (letters < 3) {
                    TRANSLATE_LETTER.lastIndex = 0;
                    while (letters < 3 && TRANSLATE_LETTER.exec(text)) letters++;
                }
                out += escapeTranslateOld(text);
            } else if (node.type === "br" || node.type === "newline") { lines = true; out += "\n"; }
            else if (TRANSLATE_GROUPS.has(node.type) && Array.isArray(node.content)) {
                var index = nodes.push(node) - 1;
                out += "<g i=" + index + ">" + walk(node.content, depth + 1) + "</g>";
            } else { var index2 = nodes.push(node) - 1; out += "<a i=" + index2 + "/>"; }
        }
        return out;
    }
    var text = Array.isArray(content) ? walk(content, 0) : "";
    return failed || letters < 3 || text.length > TRANSLATE_MAX_TEXT ? null : {text: text, nodes: nodes, lines: lines};
}

var ESCAPE_TEST_RE = /[&<>]/;
function escapeTranslateNew(text) {
    return ESCAPE_TEST_RE.test(text) ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : text;
}
function translateLayoutNew(content) {
    var nodes = [];
    var letters = 0, lines = false, failed = false;
    function walk(list, depth) {
        var out = "";
        if (depth > 8) { failed = true; return out; }
        for (var i = 0; i < list.length; i++) {
            var node = list[i];
            if (!node || typeof node !== "object") continue;
            var type = node.type;
            if (type === "text" && typeof node.content === "string") {
                var raw = node.content;
                var text = raw.indexOf("\u200b") >= 0 ? raw.replace(/\u200b/g, "") : raw;
                if (letters < 3) {
                    TRANSLATE_LETTER.lastIndex = 0;
                    while (letters < 3 && TRANSLATE_LETTER.exec(text)) letters++;
                }
                out += escapeTranslateNew(text);
            } else if (type === "br" || type === "newline") { lines = true; out += "\n"; }
            else if (TRANSLATE_GROUPS.has(type) && Array.isArray(node.content)) {
                var index = nodes.push(node) - 1;
                out += "<g i=" + index + ">" + walk(node.content, depth + 1) + "</g>";
            } else { var index2 = nodes.push(node) - 1; out += "<a i=" + index2 + "/>"; }
        }
        return out;
    }
    var text = Array.isArray(content) ? walk(content, 0) : "";
    return failed || letters < 3 || text.length > TRANSLATE_MAX_TEXT ? null : {text: text, nodes: nodes, lines: lines};
}

var samples = [
    [{type: "text", content: "Hello everyone, how is the project going today?"}],
    [{type: "text", content: "Check out "}, {type: "strong", content: [{type: "text", content: "this update"}]}, {type: "text", content: " from "}, {type: "mention", id: "1"}],
    [{type: "text", content: "x < y && y > z"}],
    [{type: "text", content: "こんにちは世界"}],
    [{type: "text", content: "ok"}]
];
for (var s = 0; s < samples.length; s++) {
    var a = translateLayoutOld(samples[s]), b = translateLayoutNew(samples[s]);
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("Mismatch on sample " + s);
}

bench("old translateLayout (5 message ASTs)", function () {
    for (var i = 0; i < samples.length; i++) translateLayoutOld(samples[i]);
});
bench("new translateLayout (5 message ASTs)", function () {
    for (var i = 0; i < samples.length; i++) translateLayoutNew(samples[i]);
});
