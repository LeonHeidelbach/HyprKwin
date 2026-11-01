// Holes in the overlays (cuts.js). Run with: deno test tests/
import { assertEquals } from "./assert.js";

const src = Deno.readTextFileSync(new URL("../package/contents/code/cuts.js", import.meta.url));
const C = new Function(src + "\nreturn { subtractRects, visiblePieces, crosses };")();

const top = { x: 100, y: 50, width: 800, height: 4 };        // a border's top strip

const area = (parts) => parts.reduce((n, p) => n + p.width * p.height, 0);

Deno.test("nothing in front: the whole strip", () => {
    assertEquals(C.visiblePieces(top, []), [{ x: 0, y: 0, width: 800, height: 4 }]);
    assertEquals(C.visiblePieces(top, [{ x: 0, y: 200, width: 50, height: 50 }]), [{ x: 0, y: 0, width: 800, height: 4 }],
                 "something elsewhere");
});

Deno.test("a tooltip over the middle of a strip leaves both sides of it", () => {
    const pieces = C.visiblePieces(top, [{ x: 400, y: 20, width: 120, height: 60 }]);
    assertEquals(pieces, [{ x: 0, y: 0, width: 300, height: 4 }, { x: 420, y: 0, width: 380, height: 4 }]);
});

Deno.test("several cuts, and one covering only part of the strip's thickness", () => {
    const pieces = C.visiblePieces(top, [
        { x: 150, y: 0, width: 100, height: 100 },           // over it
        { x: 600, y: 52, width: 50, height: 30 },            // reaching up to half of it
        { x: 700, y: 0, width: 400, height: 51 },            // the right end, its top row
    ]);
    // 800 * 4 less 100 * 4, 50 * 2 and 200 * 1
    assertEquals(area(pieces), 3200 - 400 - 100 - 200);
    assertEquals(pieces.every((p) => p.width > 0 && p.height > 0), true);
    // Nothing drawn under a cut, everything else drawn exactly once.
    for (let x = 0; x < 800; x += 7) for (let y = 0; y < 4; y++) {
        const hit = pieces.filter((p) => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height).length;
        const gx = x + 100, gy = y + 50;
        const covered = (gx >= 150 && gx < 250) || (gx >= 600 && gx < 650 && gy >= 52) || (gx >= 700 && gy < 51);
        assertEquals(hit, covered ? 0 : 1, `${x},${y}`);
    }
});

Deno.test("whether anything reaches over a strip at all", () => {
    assertEquals(C.crosses(top, []), false);
    assertEquals(C.crosses(top, [{ x: 0, y: 0, width: 100, height: 50 }]), false, "touching its corner is not over it");
    assertEquals(C.crosses(top, [{ x: 0, y: 0, width: 101, height: 51 }]), true);
});

Deno.test("a cut that is not a rect is ignored, not taken as covering everything", () => {
    assertEquals(C.visiblePieces(top, [{ x: NaN, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 99 }]),
                 [{ x: 0, y: 0, width: 800, height: 4 }]);
    assertEquals(C.crosses(top, [{ x: 120, y: NaN, width: 10, height: 10 }]), false);
});

Deno.test("all covered: nothing to draw", () => {
    assertEquals(C.visiblePieces(top, [{ x: 0, y: 0, width: 2000, height: 2000 }]), []);
});
