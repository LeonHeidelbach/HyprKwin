// Unit tests for the engine's features after bspwm: preselections, and what
// else bspwm users miss. Run with: deno test tests/
import { assertEquals, assert } from "./assert.js";

const src = Deno.readTextFileSync(new URL("../package/contents/code/engine.js", import.meta.url));
const E = new Function(src + "\nreturn { createEngine };")();

const AREA = { x: 0, y: 0, width: 1920, height: 1080 };
const S = "d1|out1";
const T = "d2|out1";

function eng(cfg) {
    const e = E.createEngine(Object.assign({ gapsIn: 0, gapsOut: { left: 0, top: 0, right: 0, bottom: 0 } }, cfg || {}));
    e.setArea(S, AREA);
    e.setArea(T, AREA);
    return e;
}

// Windows opened one after another, each focused as it opens.
function open(e, ids, space) {
    for (const id of ids) {
        e.add(id, space || S);
        e.focused(id);
    }
}

// ---- preselection -----------------------------------------------------------

Deno.test("presel: the next window takes the preselected side of the focused tile", () => {
    for (const [side, dump, bx] of [
        ["right", { dir: "h", ratio: 0.5, a: "a", b: "b" }, 960],
        ["left", { dir: "h", ratio: 0.5, a: "b", b: "a" }, 0],
    ]) {
        const e = eng();
        open(e, ["a"]);
        assertEquals(e.preselect("a", side), { dir: side, ratio: 0.5, seq: 1 });
        e.add("b", S);
        assertEquals(e.dump(S), dump, side);
        assertEquals(e.layout(S).windows.b.x, bx, side);
        assertEquals(e.preselection("a"), null, "used up");
    }
});

Deno.test("presel: up and down stack the windows even on a wide tile", () => {
    const e = eng();
    open(e, ["a"]);
    e.preselect("a", "down");
    e.add("b", S);
    assertEquals(e.dump(S), { dir: "v", ratio: 0.5, a: "a", b: "b" });
    e.focused("b");
    e.preselect("b", "up");
    e.add("c", S);
    assertEquals(e.dump(S).b, { dir: "v", ratio: 0.5, a: "c", b: "b" });
    const l = e.layout(S);
    assertEquals(l.windows.c, { x: 0, y: 540, width: 1920, height: 270 });
});

Deno.test("presel: the ratio is the first (left or top) side's share, as in bspwm", () => {
    let e = eng();
    open(e, ["a"]);
    e.preselect("a", "right");
    e.preselectRatio("a", 0.3);
    e.add("b", S);
    let l = e.layout(S);
    assertEquals(l.windows.a.width, 576, "the window that was there keeps 30%");
    assertEquals(l.windows.b.width, 1344, "and the new one gets 70%");
    e = eng();
    open(e, ["a"]);
    e.preselect("a", "left");
    e.preselectRatio("a", 0.3);
    e.add("b", S);
    l = e.layout(S);
    assertEquals(l.windows.b, { x: 0, y: 0, width: 576, height: 1080 }, "the new window takes the first 30%");
});

Deno.test("presel: the default ratio is the configured split", () => {
    const e = eng({ splitRatio: 1.2 });
    open(e, ["a"]);
    assertEquals(e.preselect("a", "down").ratio, 0.6);
    e.add("b", S);
    assertEquals(e.dump(S).ratio, 0.6);
});

Deno.test("presel: a ratio with no preselection makes one to the right", () => {
    const e = eng();
    open(e, ["a"]);
    assertEquals(e.preselectRatio("a", 0.7), { dir: "right", ratio: 0.7, seq: 1 });
    assertEquals(e.preselect("a", "down").ratio, 0.7, "a new side keeps the ratio");
    e.add("b", S);
    assertEquals(e.dump(S), { dir: "v", ratio: 0.7, a: "a", b: "b" });
});

Deno.test("presel: the same side again cancels it; another side replaces it", () => {
    const e = eng();
    open(e, ["a"]);
    e.preselect("a", "left");
    assertEquals(e.preselect("a", "left"), null, "cancelled");
    assertEquals(e.preselection("a"), null);
    e.preselect("a", "left");
    assertEquals(e.preselect("a", "up").dir, "up", "replaced");
    e.add("b", S);
    assertEquals(e.dump(S), { dir: "v", ratio: 0.5, a: "b", b: "a" });
    assertEquals(e.cancelPreselection("a"), false, "nothing left to cancel");
});

Deno.test("presel: only the focused window's preselection is used; otherwise the automatic split", () => {
    const e = eng();
    open(e, ["a", "b"]);                     // a | b, b focused
    e.preselect("a", "down");
    e.add("c", S);
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: "a", b: { dir: "v", ratio: 0.5, a: "b", b: "c" } });
    assertEquals(e.preselection("a").dir, "down", "a keeps its preselection");
    e.focused("a");
    e.add("d", S);
    assertEquals(e.dump(S).a, { dir: "v", ratio: 0.5, a: "a", b: "d" });
});

Deno.test("presel: several windows can each have one, and cancelling all clears the space", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);
    open(e, ["x"], T);
    e.preselect("a", "up");
    e.preselect("c", "left");
    e.preselect("x", "right");
    assertEquals(e.preselections(S).map((p) => [p.id, p.dir]), [["a", "up"], ["c", "left"]]);
    assertEquals(e.cancelPreselections(S), true);
    assertEquals(e.preselections(S), []);
    assertEquals(e.preselection("x").dir, "right", "another workspace keeps its own");
    assertEquals(e.cancelPreselections(S), false);
});

Deno.test("presel: goes with its window when it closes, floats or leaves the workspace", () => {
    let e = eng();
    open(e, ["a", "b"]);
    e.preselect("b", "down");
    e.remove("b");
    assertEquals(e.preselections(S), [], "closed");
    e = eng();
    open(e, ["a", "b"]);
    e.preselect("b", "down");
    e.detach("b");                           // floated
    assertEquals(e.preselections(S), []);
    e.add("b", S);
    assertEquals(e.preselection("b"), null, "not back when it tiles again");
    e = eng();
    open(e, ["a", "b"]);
    e.preselect("b", "down");
    e.moveToSpace("b", T, {});
    assertEquals(e.preselections(S), []);
    assertEquals(e.preselections(T), [], "nor does it travel");
});

Deno.test("presel: belongs to a group's tile, so a window leaving the group leaves it", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.toggleGroup("b");
    e.joinGroup("a", "b");                   // one tile: [b, a], a in front
    e.preselect("a", "right");
    assertEquals(e.preselection("b").dir, "right", "every window in the tile shares it");
    e.leaveGroup("b");
    assertEquals(e.preselection("a").dir, "right", "the tile keeps it");
    assertEquals(e.preselection("b"), null);
    e.remove("a");
    assertEquals(e.preselections(S), [], "and it goes with the tile");
});

Deno.test("presel: swapping windows carries their preselections", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.preselect("a", "down");
    e.swap("a", "b");
    assertEquals(e.preselection("a").dir, "down");
    assertEquals(e.layout(S).presels.map((p) => [p.id, p.rect.x]), [["a", 960]]);
});

Deno.test("presel: a window sent to another workspace goes into the preselection focused there", () => {
    const e = eng();
    open(e, ["x", "y"], T);
    e.focused("x");
    e.preselect("x", "left");
    open(e, ["a", "b"]);
    e.moveToSpace("b", T, {});
    assertEquals(e.dump(T), { dir: "h", ratio: 0.5, a: { dir: "h", ratio: 0.5, a: "b", b: "x" }, b: "y" });
    assertEquals(e.preselection("x"), null, "used up");
});

Deno.test("presel: an explicit place (a drop, a group rule) leaves the preselection alone", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.preselect("b", "up");
    e.add("c", S, { target: "a" });
    assertEquals(e.preselection("b").dir, "up");
    e.moveNextTo("c", "b", "left");
    assertEquals(e.preselection("b").dir, "up");
});

Deno.test("presel: dwindle only; kept but unused in the other layouts", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.preselect("b", "up");
    e.setLayout(S, "master");
    assertEquals(e.preselect("a", "left"), false, "no new ones");
    assertEquals(e.preselectRatio("a", 0.3), false);
    assertEquals(e.layout(S).presels, [], "nothing to draw");
    e.add("c", S);
    assertEquals(e.preselection("b").dir, "up", "not used by master's placement");
    e.setLayout(S, "dwindle");
    assertEquals(e.layout(S).presels.length, 1, "back with dwindle");
});

Deno.test("presel: the layout says where the preselected window would go, gaps and all", () => {
    const e = E.createEngine({ gapsIn: 5, gapsOut: { left: 10, top: 10, right: 10, bottom: 10 } });
    e.setArea(S, AREA);
    open(e, ["a"]);
    e.preselect("a", "right");
    e.preselectRatio("a", 0.25);
    let l = e.layout(S);
    assertEquals(l.presels, [{ id: "a", dir: "right", ratio: 0.25, seq: 1, rect: { x: 490, y: 10, width: 1420, height: 1060 } }]);
    e.add("b", S);
    l = e.layout(S);
    assertEquals(l.windows.b, { x: 490, y: 10, width: 1420, height: 1060 }, "where it said");
    assertEquals(l.presels, []);
});

Deno.test("presel: a tile zoomed out of view shows no preselection", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);                // a | (b / c)
    e.preselect("a", "down");
    e.preselect("c", "right");
    e.zoomIn("c");
    assertEquals(e.layout(S).presels.map((p) => p.id), ["c"]);
});

Deno.test("presel: a minimised window's preselection is neither drawn nor used", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.preselect("b", "down");
    e.setVisibility((id) => id !== "b");
    assertEquals(e.layout(S).presels, []);
    e.add("c", S);
    assertEquals(e.preselection("b").dir, "down", "a hidden window is not the focused tile");
});

// ---- moving into preselections, marks ---------------------------------------

Deno.test("moveToPreselection: into the newest preselection on the workspace, which is used up", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);                // a | (b / c)
    e.preselect("a", "up");
    e.preselect("b", "right");
    assertEquals(e.newestPreselection(S, "c"), "b");
    assertEquals(e.moveToPreselection("c", S), true);
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: "a", b: { dir: "h", ratio: 0.5, a: "b", b: "c" } });
    assertEquals(e.preselection("b"), null);
    assertEquals(e.preselection("a").dir, "up", "the older one stays");
    assertEquals(e.moveToPreselection("b", S), true);
    assertEquals(e.dump(S).a, { dir: "v", ratio: 0.5, a: "b", b: "a" });
    assertEquals(e.moveToPreselection("c", S), false, "none left");
});

Deno.test("moveToPreselection: not into its own tile, unless it shares it in a group", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.preselect("b", "down");
    assertEquals(e.newestPreselection(S, "b"), null);
    assertEquals(e.moveToPreselection("b", S), false);
    e.toggleGroup("b");
    e.joinGroup("a", "b");                   // [b, a]
    assertEquals(e.moveToPreselection("a", S), true, "out of the group, under it");
    assertEquals(e.dump(S), { dir: "v", ratio: 0.5, a: { group: ["b"], active: 0 }, b: "a" });
});

Deno.test("moveToPreselection: dwindle only", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.preselect("a", "down");
    e.setLayout(S, "monocle");
    assertEquals(e.moveToPreselection("b", S), false);
});

Deno.test("marks: numbered as they are made, so the newest is known", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);
    open(e, ["x"], T);
    assertEquals(e.toggleFlag("b", "marked"), true);
    e.toggleFlag("a", "marked");
    e.toggleFlag("x", "marked");
    assertEquals(e.newestMarked(S), "a");
    e.setFlag("a", "marked", true);
    assertEquals(e.newestMarked(S), "a", "marking again keeps its place");
    e.toggleFlag("a", "marked");
    assertEquals(e.newestMarked(S), "b");
    e.detach("b");
    assertEquals(e.newestMarked(S), null, "only tiled windows");
    assertEquals(e.flag("b", "marked"), true, "but the flag stays with the window");
    e.remove("b");
    assertEquals(e.flag("b", "marked"), false, "until it closes");
});

// ---- balance, equalize --------------------------------------------------------

Deno.test("balance: every window gets the same area", () => {
    const e = eng();
    open(e, ["a", "b", "c", "d"]);           // a | (b / (c | d))
    e.balance(S);
    assertEquals(e.dump(S), { dir: "h", ratio: 0.25, a: "a", b: { dir: "v", ratio: 0.333, a: "b", b: { dir: "h", ratio: 0.5, a: "c", b: "d" } } });
    const l = e.layout(S);
    const areas = ["a", "b", "c", "d"].map((id) => l.windows[id].width * l.windows[id].height);
    assert(areas.every((x) => Math.abs(x - 1920 * 1080 / 4) < 2000), "equal areas: " + areas);
});

Deno.test("balance: a group counts once, a hidden window not at all", () => {
    const e = eng();
    open(e, ["a", "b", "c", "d"]);           // a | (b / (c | d))
    e.toggleGroup("a");
    e.joinGroup("b", "a");                   // [a, b] | (c | d)
    e.balance(S);
    assertEquals(e.dump(S).ratio, 0.333);
    e.setVisibility((id) => id !== "d");
    e.balance(S);
    assertEquals(e.dump(S).ratio, 0.5, "d gives its share to c");
    assertEquals(e.dump(S).b.ratio, 0.5, "and its own split keeps its ratio");
    assertEquals(e.balance("nowhere"), false);
    e.setLayout(S, "master");
    assertEquals(e.balance(S), false, "dwindle only");
});

Deno.test("equalize: the parent split and everything in it back to the default ratio", () => {
    const e = eng({ splitRatio: 1.2 });
    open(e, ["a", "b", "c", "d"]);
    e.layout(S);
    e.moveDivider("a", 200, 0);              // root
    e.moveDivider("b", 0, 100);              // b / (c | d)
    e.moveDivider("d", -100, 0);             // c | d
    e.layout(S);
    assertEquals(e.equalize("b"), true);
    const d = e.dump(S);
    assert(Math.abs(d.ratio - 0.6) > 0.05, "the root is left alone: " + d.ratio);
    assertEquals([d.b.ratio, d.b.b.ratio], [0.6, 0.6]);
    assertEquals(e.equalize("b"), false, "nothing left to change");
    assertEquals(e.equalize("nobody"), false);
});

// ---- rotate, flip ---------------------------------------------------------------

Deno.test("rotate: a quarter turn clockwise, as bspwm's rotate_tree", () => {
    const e = eng();
    open(e, ["a", "b"]);                     // a | b
    e.rotate("b", 90);
    assertEquals(e.dump(S), { dir: "v", ratio: 0.5, a: "a", b: "b" }, "a on top");
    e.rotate("b", 90);
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: "b", b: "a" }, "then on the right");
    e.rotate("b", 90);
    e.rotate("b", 90);
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: "a", b: "b" }, "round again");
});

Deno.test("rotate: anticlockwise, half round, and every split below the parent", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);                // a | (b / c)
    e.layout(S);
    e.moveDivider("a", 192, 0);              // root ratio 0.6
    e.rotate("b", -90);                      // only b / c turns
    assertEquals(e.dump(S), { dir: "h", ratio: 0.6, a: "a", b: { dir: "h", ratio: 0.5, a: "b", b: "c" } });
    e.focused("a");
    e.rotate("a", 270);                      // the whole tree
    assertEquals(e.dump(S), { dir: "v", ratio: 0.4, a: { dir: "v", ratio: 0.5, a: "c", b: "b" }, b: "a" });
    e.rotate("a", 180);
    assertEquals(e.dump(S), { dir: "v", ratio: 0.6, a: "a", b: { dir: "v", ratio: 0.5, a: "b", b: "c" } });
});

Deno.test("rotate: the new directions hold even when splits follow the window's shape", () => {
    const e = eng({ preserveSplit: false });
    open(e, ["a", "b"]);
    e.rotate("a", 90);
    e.layout(S);
    assertEquals(e.dump(S).dir, "v");
    assertEquals(e.rotate("a", 45), false, "quarter turns only");
    e.remove("b");
    assertEquals(e.rotate("a", 90), false, "nothing to turn");
});

Deno.test("flip: horizontal swaps top and bottom, vertical left and right", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);                // a | (b / c)
    e.flip("a", "horizontal");
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: "a", b: { dir: "v", ratio: 0.5, a: "c", b: "b" } });
    e.flip("a", "vertical");
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: { dir: "v", ratio: 0.5, a: "c", b: "b" }, b: "a" });
    e.flip("b", "vertical");                 // just c / b: nothing side by side in it
    assertEquals(e.dump(S).a, { dir: "v", ratio: 0.5, a: "c", b: "b" });
    assertEquals(e.flip("b", "sideways"), false);
});

// ---- flags ----------------------------------------------------------------------

Deno.test("flags belong to the window: they survive floating, layouts and moves", () => {
    const e = eng();
    open(e, ["a", "b"]);
    assertEquals(e.toggleFlag("a", "locked"), true);
    e.toggleFlag("a", "private");
    e.detach("a");
    e.add("a", S);
    e.setLayout(S, "master");
    e.moveToSpace("a", T, {});
    assertEquals(e.flagsOf("a"), { marked: false, locked: true, "private": true });
    assertEquals(e.toggleFlag("a", "locked"), false);
    assertEquals(e.setFlag("a", "sticky", true), false, "only bspwm's three");
});

Deno.test("private: the automatic split goes to the largest tile that is not private", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);                // a | (b / c)
    e.toggleFlag("c", "private");
    e.add("d", S);                           // c is focused, but private
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: { dir: "v", ratio: 0.5, a: "a", b: "d" }, b: { dir: "v", ratio: 0.5, a: "b", b: "c" } });
});

Deno.test("private: a preselected tile is used before a private one; all private, the usual split", () => {
    let e = eng();
    open(e, ["a", "b"]);
    e.toggleFlag("a", "private");
    e.toggleFlag("b", "private");
    e.preselect("a", "down");
    e.add("c", S);                           // b is focused and private, a has a preselection
    assertEquals(e.dump(S), { dir: "h", ratio: 0.5, a: { dir: "v", ratio: 0.5, a: "a", b: "c" }, b: "b" });
    e = eng();
    open(e, ["a", "b"]);
    e.toggleFlag("a", "private");
    e.toggleFlag("b", "private");
    e.add("c", S);
    assertEquals(e.dump(S).b, { dir: "v", ratio: 0.5, a: "b", b: "c" }, "all private: b splits after all");
    e = eng();
    open(e, ["a", "b"]);
    e.toggleFlag("b", "private");
    e.preselect("b", "up");
    e.add("c", S);
    assertEquals(e.dump(S).b, { dir: "v", ratio: 0.5, a: "c", b: "b" }, "its own preselection still counts");
});

// ---- the focus history walk -------------------------------------------------------

Deno.test("quiet focus: the window has the focus, but the history is left as it was", () => {
    const e = eng();
    open(e, ["a", "b", "c"]);
    assertEquals(e.focusHistory(), ["c", "b", "a"]);
    e.focused("a", true);
    assertEquals(e.focusHistory(), ["c", "b", "a"], "not reordered");
    assertEquals(e.lastFocused(S), "a", "but it is the one in use");
    e.add("d", S);
    assertEquals(e.dump(S).a, { dir: "v", ratio: 0.5, a: "a", b: "d" }, "a new window splits it");
    e.focused("b");
    assertEquals(e.focusHistory(), ["b", "c", "a"], "a normal focus records again");
});

Deno.test("quiet focus brings a group's window to the front", () => {
    const e = eng();
    open(e, ["a", "b"]);
    e.toggleGroup("b");
    e.joinGroup("a", "b");
    e.focused("b", true);
    assertEquals(e.groupOf("a").active, 0);
});

// ---- groups -------------------------------------------------------------------

Deno.test("groupAll: every window shown in the space joins the focused window's group", () => {
    const e = eng();
    open(e, ["a", "b", "c", "d"]);
    open(e, ["x"], T);
    e.setVisibility((id) => id !== "d");
    e.focused("b");
    assertEquals(e.groupAll("b"), true);
    assertEquals(e.dump(S), { dir: "v", ratio: 0.5, a: { group: ["b", "a", "c"], active: 0 }, b: "d" });
    assertEquals(e.spaceOf("x"), T, "other workspaces are left alone");
    assertEquals(e.groupAll("b"), false, "nobody left to join");
});

