// Lists every plural pair Venus shows ({plural: singular}), from pl(), take() and count() calls in bootstrap.js.
// Developer-only: NODE_PATH=<dir with acorn, acorn-walk> node scripts/i18n_plurals.cjs > work/plurals.json
const fs = require('node:fs'), acorn = require('acorn'), walk = require('acorn-walk');
const source = fs.readFileSync('patches/src/main/resources/venus/bootstrap.js', 'utf8').replace('/*__FEATURES__*/', '{}');
const text = node => node && node.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
const pairs = {};
walk.simple(acorn.parse(source, {ecmaVersion:'latest'}), {CallExpression(node) {
    const name = node.callee && node.callee.type === 'Identifier' && node.callee.name, a = node.arguments;
    if ((name === 'pl' || name === 'take') && text(a[1]) && text(a[2])) pairs[text(a[2])] = text(a[1]);
    if (name === 'count' && text(a[1])) pairs['{n} ' + text(a[1]) + 's'] = '{n} ' + text(a[1]);
}});
process.stdout.write(JSON.stringify(pairs, null, 1));
