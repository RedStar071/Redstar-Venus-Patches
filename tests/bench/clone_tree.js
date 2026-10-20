// Benchmark cloneTree with primitive-children skip and optional stop predicate on Hermes HBC98.
var React = {
    cloneElement: function (node, props) { return {type: node.type, key: node.key, props: Object.assign({}, node.props, props)}; }
};

function cloneTreeOld(node, change, depth) {
    if (!node || typeof node !== "object" || depth > 24) return node;
    if (Array.isArray(node)) {
        var children = node;
        for (var i = 0; i < node.length; i++) {
            var child = cloneTreeOld(node[i], change, depth + 1);
            if (child !== node[i]) {
                if (children === node) children = node.slice();
                children[i] = child;
            }
        }
        return children;
    }
    if (!node.props) return node;
    var children2 = cloneTreeOld(node.props.children, change, depth + 1);
    var props = children2 !== node.props.children ? Object.assign({}, node.props, {children: children2}) : node.props;
    props = change(node, props);
    return props === node.props ? node : React.cloneElement(node, props);
}

function cloneTreeNew(node, change, depth, isDone) {
    if (!node || typeof node !== "object" || depth > 24 || isDone && isDone()) return node;
    if (Array.isArray(node)) {
        var children = node;
        for (var i = 0; i < node.length; i++) {
            if (isDone && isDone()) break;
            var item = node[i];
            if (!item || typeof item !== "object") continue;
            var child = cloneTreeNew(item, change, depth + 1, isDone);
            if (child !== item) {
                if (children === node) children = node.slice();
                children[i] = child;
            }
        }
        return children;
    }
    var nodeProps = node.props;
    if (!nodeProps) return node;
    var rawChildren = nodeProps.children;
    var children2 = rawChildren && typeof rawChildren === "object" ? cloneTreeNew(rawChildren, change, depth + 1, isDone) : rawChildren;
    var props = children2 !== rawChildren ? Object.assign({}, nodeProps, {children: children2}) : nodeProps;
    if (isDone && isDone()) return props === nodeProps ? node : React.cloneElement(node, props);
    props = change(node, props);
    return props === nodeProps ? node : React.cloneElement(node, props);
}

var sampleTree = {
    type: "View", props: {
        children: [
            {type: "View", props: {children: [
                {type: "Text", props: {children: "UserDisplayName"}},
                {type: "View", props: {children: "Status"}}
            ]}},
            {type: "View", props: {children: [
                {type: "Text", props: {children: "Subtext line 1"}},
                {type: "Text", props: {children: "Subtext line 2"}},
                {type: "View", props: {children: [
                    {type: "Text", props: {children: "Nested A"}},
                    {type: "Text", props: {children: "Nested B"}}
                ]}}
            ]}},
            {type: "View", props: {children: "Trailing icon"}}
        ]
    }
};

bench("old cloneTree (single-target search in tree)", function () {
    var added = false;
    return cloneTreeOld(sampleTree, function (node, nodeProps) {
        if (added) return nodeProps;
        if (node.type === "Text" && nodeProps.children === "UserDisplayName") {
            added = true;
            return Object.assign({}, nodeProps, {selectable: true});
        }
        return nodeProps;
    }, 0);
});

bench("new cloneTree (primitive skip + early exit once added)", function () {
    var added = false;
    return cloneTreeNew(sampleTree, function (node, nodeProps) {
        if (added) return nodeProps;
        if (node.type === "Text" && nodeProps.children === "UserDisplayName") {
            added = true;
            return Object.assign({}, nodeProps, {selectable: true});
        }
        return nodeProps;
    }, 0, function () { return added; });
});
