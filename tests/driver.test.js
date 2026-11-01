// Unit tests for the driver's pure helpers. Run with: deno test tests/
import { assertEquals } from "./assert.js";

const src = Deno.readTextFileSync(new URL("../package/contents/code/driver.js", import.meta.url));
const D = new Function(src + "\nreturn { isLateAnswer };")();

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
