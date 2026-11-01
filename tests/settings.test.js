// The settings page against its settings. Run with: deno test tests/
import { assertEquals } from "./assert.js";

const ui = Deno.readTextFileSync(new URL("../package/contents/ui/config.ui", import.meta.url));
const xml = Deno.readTextFileSync(new URL("../package/contents/config/main.xml", import.meta.url));

Deno.test("no two settings share a place on the settings page", () => {
    // A form layout drops a widget put where another already is, and Qt then
    // draws it over the top of the page.
    const stack = [], taken = [];
    for (const line of ui.split("\n")) {
        const open = /<layout class="[^"]+" name="([^"]+)"/.exec(line);
        if (open) stack.push({ name: open[1], cells: {} });
        const item = /<item row="(\d+)" column="(\d+)"/.exec(line);
        if (item && stack.length) {
            const cell = item[1] + "," + item[2], layout = stack[stack.length - 1];
            if (layout.cells[cell]) taken.push(layout.name + " " + cell);
            layout.cells[cell] = true;
        }
        if (/<\/layout>/.test(line)) stack.pop();
    }
    assertEquals(taken, []);
});

Deno.test("every setting on the page is one HyprKwin keeps", () => {
    const entries = new Set([...xml.matchAll(/<entry name="(\w+)"/g)].map((m) => m[1]));
    const widgets = [...ui.matchAll(/<widget class="\w+" name="kcfg_(\w+)"/g)].map((m) => m[1]);
    assertEquals(widgets.filter((w) => !entries.has(w)), []);
});
