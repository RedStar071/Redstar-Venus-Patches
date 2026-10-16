// Lists every English text Venus shows through tr(), so language files can be checked against it.
// Developer-only: NODE_PATH=<dir with acorn, acorn-walk> node scripts/i18n_strings.cjs  ->  JSON array on stdout
const fs = require('node:fs'), acorn = require('acorn'), walk = require('acorn-walk');
const source = fs.readFileSync('patches/src/main/resources/venus/bootstrap.js', 'utf8').replace('/*__FEATURES__*/', '{}');
const ast = acorn.parse(source, {ecmaVersion:'latest'});
const found = new Set();
const text = node => node && node.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
// Helpers whose string arguments (by position) are passed through tr() inside them.
const ARGS = {tr:[0], pl:[1, 2], take:[1, 2], footnote:[1], statusCard:[1], reviewToast:[1], confirmAction:[0, 1, 2], actionRow:[2, 3],
    switchRow:[2, 3], toggle:[2, 3], withOptions:[3, 4, 5], route:[1], section:[0], settingNode:[1, 2], link:[1, 2], option:[1, 2],
    radioGroup:[2], groupTitle:[1], linkRow:[1, 2], pill:[1], button:[2], previewScreen:[2], inputWithButton:[4], picker:[1], count:[], questStatus:[0], mutate:[3], userNotifShow:[0]};
function strings(node, out) {
    if (!node) return;
    const value = text(node);
    if (value !== null) out.push(value);
    else if (node.type === 'ConditionalExpression') { strings(node.consequent, out); strings(node.alternate, out); }
    else if (node.type === 'LogicalExpression') { strings(node.left, out); strings(node.right, out); }
}
walk.simple(ast, {CallExpression(node) {
    if (!node.callee || node.callee.type !== 'Identifier') return;
    const name = node.callee.name;
    // The Features list's toggle(group, key, title, hint), or an option page's own toggle(key, label, subLabel).
    const positions = name === 'toggle' && node.arguments.length === 3 ? [1, 2] : ARGS[name];
    if (!positions) return;
    node.args = node.arguments;
    const out = [];
    positions.forEach(i => strings(node.args[i], out));
    if (name === 'count' && text(node.args[1])) { out.push('{n} ' + text(node.args[1])); out.push('{n} ' + text(node.args[1]) + 's'); }
    // radioGroup's choices: [value, label, subLabel], unless the page passes them already translated.
    if (name === 'radioGroup' && node.args[5] && node.args[5].type === 'ArrayExpression' && !node.args[6])
        node.args[5].elements.forEach(choice => { if (choice && choice.type === 'ArrayExpression') choice.elements.slice(1).forEach(item => strings(item, out)); });
    out.forEach(value => { if (/[A-Za-z]/.test(value) && value !== 'Venus') found.add(value); });
}});
// Message highlights' color names, read by tr() from its swatch tables.
for (const table of ['HIGHLIGHT_PING_CHOICES', 'HIGHLIGHT_DELETED_CHOICES']) {
    const match = new RegExp('const ' + table + ' = \\[([\\s\\S]*?)\\];').exec(source);
    if (match) for (const value of match[1].matchAll(/\["\w+", "([^"]+)"/g)) found.add(value[1]);
}
// The language names "Translated from ..." falls back to when the phone can't name a language.
const names = /const LANGUAGE_NAMES = \{([\s\S]*?)\};/.exec(source);
if (names) for (const match of names[1].matchAll(/:"([^"]+)"/g)) found.add(match[1]);
found.add('another language');
// Tables tr() reads by key: device names and statuses, and the stand-in names of hidden channels.
for (const table of ['PLATFORM_LABELS', 'PLATFORM_STATUS']) {
    const match = new RegExp('const ' + table + ' = \\{([^}]*)\\}').exec(source);
    if (match) for (const value of match[1].matchAll(/:"([^"]+)"/g)) if (value[1] !== 'VR') found.add(value[1]);
}
const hidden = /const HIDDEN_CHANNEL = "([^"]+)", HIDDEN_CATEGORY = "([^"]+)"/.exec(source);
if (hidden) { found.add(hidden[1]); found.add(hidden[2]); }
// Status texts aboutText() picks between.
for (const value of ["Kept deleted messages are saved on this phone.", "Kept deleted messages couldn't be saved.", "Saved deleted messages couldn't be loaded."]) found.add(value);
process.stdout.write(JSON.stringify(Array.from(found).sort(), null, 1));
