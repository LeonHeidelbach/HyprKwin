// Holes in HyprKwin's overlays. KWin draws a script's windows above every
// other window, menus and panels included, so an overlay must leave out
// whatever is in front of the window it belongs to: a border keeps all of
// itself but the part a tooltip, menu or window above actually covers.

// The parts of rect `r` that none of `cuts` covers, as rects (none if it is
// all covered). Exact: each cut splits what is left around it into at most
// four pieces (above, below, left, right of it).
function subtractRects(r, cuts) {
    var parts = [{ x: r.x, y: r.y, width: r.width, height: r.height }];
    (cuts || []).forEach(function (c) {
        if (!usable(c)) return;
        var next = [];
        parts.forEach(function (p) {
            var x1 = Math.max(p.x, c.x), y1 = Math.max(p.y, c.y);
            var x2 = Math.min(p.x + p.width, c.x + c.width), y2 = Math.min(p.y + p.height, c.y + c.height);
            if (x1 >= x2 || y1 >= y2) {
                next.push(p);
                return;
            }
            if (y1 > p.y) next.push({ x: p.x, y: p.y, width: p.width, height: y1 - p.y });
            if (y2 < p.y + p.height) next.push({ x: p.x, y: y2, width: p.width, height: p.y + p.height - y2 });
            if (x1 > p.x) next.push({ x: p.x, y: y1, width: x1 - p.x, height: y2 - y1 });
            if (x2 < p.x + p.width) next.push({ x: x2, y: y1, width: p.x + p.width - x2, height: y2 - y1 });
        });
        parts = next;
    });
    return parts;
}

function usable(c) {
    return !!c && isFinite(c.x) && isFinite(c.y) && isFinite(c.width) && isFinite(c.height) && c.width > 0 && c.height > 0;
}

// Whether any of `cuts` reaches over `r` at all.
function crosses(r, cuts) {
    return (cuts || []).some(function (c) {
        return usable(c) && c.x < r.x + r.width && r.x < c.x + c.width && c.y < r.y + r.height && r.y < c.y + c.height;
    });
}

// The same, relative to `r`'s own corner: what an overlay window at `r`
// draws.
function visiblePieces(r, cuts) {
    return subtractRects(r, cuts).map(function (p) {
        return { x: p.x - r.x, y: p.y - r.y, width: p.width, height: p.height };
    });
}
