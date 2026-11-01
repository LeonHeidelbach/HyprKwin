// Unit tests for the driver's pure helpers. Run with: deno test tests/
import { assertEquals } from "./assert.js";

const src = Deno.readTextFileSync(new URL("../package/contents/code/driver.js", import.meta.url));
const D = new Function(src + "\nreturn { isLateAnswer, hidesUntilTiled, revealReason };")();

const tile = { x: 10, y: 10, width: 945, height: 1060 };
const wider = { x: 10, y: 10, width: 995, height: 1060 };
const widest = { x: 10, y: 10, width: 1045, height: 1060 };

Deno.test("a window back at a size asked of it earlier is answering late", () => {
    const now = 100000;
    const sent = [{ rect: tile, at: now - 900 }, { rect: wider, at: now - 600 }, { rect: widest, at: now - 500 },
                  { rect: wider, at: now - 400 }, { rect: tile, at: now - 300 }];
    assertEquals(D.isLateAnswer(sent, tile, wider, now), true, "only the size is wrong");
    assertEquals(D.isLateAnswer(sent, tile, { x: 11, y: 10, width: 945, height: 1059 }, now), false, "where it was put (rounding)");
    assertEquals(D.isLateAnswer(sent, tile, { x: 10, y: 10, width: 700, height: 1060 }, now), false,
                 "a size never asked for is the app's own (a minimum size, say)");
    assertEquals(D.isLateAnswer(sent, tile, widest, now + 6000), false, "requests long past are forgotten");
    assertEquals(D.isLateAnswer(sent, null, wider, now), false, "not placed yet");
    assertEquals(D.isLateAnswer(undefined, tile, wider, now), false, "nothing asked");
});

const opening = { enabled: true, initial: false, tiled: true, special: false, pinned: false,
                  fullScreen: false, maximized: false, minimized: false, shown: true };

Deno.test("a new tiled window waits unseen; anything HyprKwin does not tile shows at once", () => {
    assertEquals(D.hidesUntilTiled(opening), true);
    for (const [what, change] of [
        ["the setting is off", { enabled: false }],
        ["open before HyprKwin started", { initial: true }],
        ["floating: a dialog, a fixed size, a float rule", { tiled: false }],
        ["in a scratchpad", { special: true }],
        ["pinned", { pinned: true }],
        ["full screen", { fullScreen: true }],
        ["maximized", { maximized: true }],
        ["minimized", { minimized: true }],
        ["on a workspace not on screen", { shown: false }],
    ]) {
        assertEquals(D.hidesUntilTiled({ ...opening, ...change }), false, what);
    }
});

const waiting = { tiled: true, fullScreen: false, maximized: false, minimized: false,
                  geometry: { x: 760, y: 376, width: 400, height: 328 },
                  opened: { x: 760, y: 376, width: 400, height: 328 },
                  placed: { x: 965, y: 10, width: 945, height: 1060 }, waited: 50, timeout: 400 };

Deno.test("a window waiting unseen shows once it is in its tile, or after the timeout", () => {
    assertEquals(D.revealReason(waiting), null, "still where KWin put it");
    assertEquals(D.revealReason({ ...waiting, geometry: { x: 966, y: 10, width: 944, height: 1061 } }), "in its tile");
    assertEquals(D.revealReason({ ...waiting, geometry: { x: 965, y: 10, width: 400, height: 328 } }), null,
                 "moved, but not yet at its size");
    assertEquals(D.revealReason({ ...waiting, geometry: { x: 965, y: 10, width: 937, height: 1050 } }), "at a size of its own",
                 "answered with a size of its own (a terminal's whole characters)");
    assertEquals(D.revealReason({ ...waiting, placed: { x: 760, y: 376, width: 945, height: 1060 } }), null,
                 "its corner happens to be the tile's, but it has not answered");
    assertEquals(D.revealReason({ ...waiting, geometry: { x: 965, y: 10, width: 945, height: 700 },
                                  asked: [{ width: 945, height: 700 }] }), null,
                 "a late answer to an earlier tile (the layout changed while it waited) is not a size of its own");
    assertEquals(D.revealReason({ ...waiting, waited: 400 }), "timed out", "an app that does not answer in time");
    assertEquals(D.revealReason({ ...waiting, placed: null }), null, "nothing asked of it yet");
});

Deno.test("a window waiting unseen shows when it stops being a tile waiting for its place", () => {
    assertEquals(D.revealReason({ ...waiting, tiled: false }), "no longer tiled");
    assertEquals(D.revealReason({ ...waiting, fullScreen: true }), "full screen");
    assertEquals(D.revealReason({ ...waiting, maximized: true }), "maximized");
    assertEquals(D.revealReason({ ...waiting, minimized: true }), "minimized");
});
