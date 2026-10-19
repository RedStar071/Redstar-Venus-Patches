// RowGenerator.prototype.generate(row): Venus' messageRow hook runs once per chat row as you scroll.
var gen = {generate: function (row) { return {message: row.message, rowType: row.rowType}; }};
var orig = gen.generate;
function op(orig, self, args) { var r = orig.apply(self, args); return r; }
function op1(orig, self, row) { var r = orig.call(self, row); return r; }
var viaArgs = function () { return op(orig, this, arguments); };
var via1 = function (a) { return arguments.length === 1 ? op1(orig, this, a) : op(orig, this, arguments); };
var rows = []; for (var i = 0; i < 200; i++) rows.push({rowType: 1, message: {id: String(i)}});
bench("arguments + apply (ships)", function () { for (var r = 0; r < 50; r++) for (var i = 0; i < rows.length; i++) viaArgs.call(gen, rows[i]); });
bench("1-arg fast path", function () { for (var r = 0; r < 50; r++) for (var i = 0; i < rows.length; i++) via1.call(gen, rows[i]); });
