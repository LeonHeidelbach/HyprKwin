#!/usr/bin/env python3
"""Measure a Meta+right-drag in the nested KWin: how soon the windows beside
the edge are given their new size, how often, and what HyprKwin spends on it.

    python3 tests/e2e/dragbench.py LAG WINDOWS STEP [deep]

LAG is how long each test window (but the dragged one) takes to draw, in ms
(0: at once); WINDOWS how many tiled windows; STEP the seconds between the 30
pointer steps. "deep" drags the last window's left edge (the innermost
split) rather than the first window's right edge. Prints HyprKwin's own
timings over the drag (count, total ms, longest ms) and, for each window the
edge moves, how many sizes it was given and how long after a pointer step it
had them (the step time is taken once the compositor has the pointer motion,
so it is an upper bound on HyprKwin's part).
"""
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sandbox import Sandbox  # noqa: E402

if len(sys.argv) < 4:
    sys.exit(__doc__)
LAG = sys.argv[1]
N = int(sys.argv[2])
STEP = float(sys.argv[3])
EDGE = sys.argv[4] if len(sys.argv) > 4 else "root"
CFG = {"ShowInactiveBorders": "true", "BorderSize": "4", "InactiveBorderSource": "1", "ActiveBorderSource": "1"}
with Sandbox(config=CFG) as sb:
    logs = {}
    titles = [chr(65 + i) for i in range(N)]
    for t in titles:
        logs[t] = sb.base / ("log-" + t)
        extra = ["--log", str(logs[t])] + (["--lag", LAG] if LAG != "0" and t != "A" else [])
        sb.spawn(t, extra=extra)
    sb.settle(1.5)
    s = sb.state()
    geo = {t: sb.geometry(t, s) for t in titles}
    # drag A's right edge (root split), or the last window's left edge (deepest split)
    if EDGE == "root":
        x, y, w, h = geo["A"]; sx, sy = x + w - 30, y + h // 2; dx = 1
    else:
        x, y, w, h = geo[titles[-1]]; sx, sy = x + 20, y + h // 2; dx = -1
    for t in titles: open(logs[t], "w").close()
    t_before = s["timing"]
    fi = sb.input()
    fi.move_to(sx, sy); fi.key("meta", True); fi.sync(); time.sleep(0.1)
    fi.button(0x111, True); time.sleep(0.1)
    steps = []
    for i in range(1, 31):
        fi.move_to(sx + dx * 6 * i, sy); fi.sync()
        steps.append(time.time()); time.sleep(STEP)
    fi.button(0x111, False); fi.key("meta", False); fi.sync()
    t_release = time.time()
    time.sleep(2.0)
    s2 = sb.state()
    tm = {k: (s2["timing"][k]["count"] - t_before.get(k, {}).get("count", 0),
              round((s2["timing"][k]["total"] - t_before.get(k, {}).get("total", 0)), 1), s2["timing"][k]["max"])
          for k in s2["timing"]}
    print("steps", len(steps), "timing (count, total ms, max ms):", tm)
    for t in titles[1:] if EDGE == "root" else titles[:-1]:
        ev = [l.split() for l in open(logs[t]).read().splitlines()]
        sizes = [(float(a), c) for a, b, c in ev if b == "size"]
        drawn = [(float(a), c) for a, b, c in ev if b == "drawn"]
        lat = []
        for ts, _ in sizes:
            prev = [st for st in steps if st <= ts]
            if prev and ts <= t_release + 0.05: lat.append((ts - prev[-1]) * 1000)
        dlat = []
        for ts, _ in drawn:
            prev = [st for st in steps if st <= ts]
            if prev and ts <= t_release + 2: dlat.append((ts - prev[-1]) * 1000)
        dup = sum(1 for i in range(1, len(sizes)) if sizes[i][1] == sizes[i - 1][1])
        after = [x for x in sizes if x[0] > t_release + 0.03]
        print("%s sizes %d (dup %d, after release %d) drawn %d | step->size ms median %.1f p90 %.1f | step->drawn median %.1f" % (
            t, len(sizes), dup, len(after), len(drawn),
            statistics.median(lat) if lat else -1, sorted(lat)[int(len(lat) * .9)] if lat else -1,
            statistics.median(dlat) if dlat else -1))
