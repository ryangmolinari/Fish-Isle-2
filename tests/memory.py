# Verifica crescimento de memória ao trocar de região várias vezes (tropical ↔ mangue).
import sys, time, json
from playwright.sync_api import sync_playwright
port = sys.argv[1] if len(sys.argv) > 1 else "3100"
legs = int(sys.argv[2]) if len(sys.argv) > 2 else 6
G = "window.__fishisle"
def until(pg, js, t=150):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(250)
    return False
with sync_playwright() as p:
    b = p.chromium.launch(args=["--js-flags=--expose-gc", "--enable-precise-memory-info"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_timeout(1000)
    pg.click("[data-act=create]"); pg.wait_for_timeout(1500)
    m = pg.evaluate(f"{G}.region.moorings[0].board")
    pg.evaluate(f"{G}.debug.walkTo({m['x']},{m['y']})"); until(pg, f"!{G}.debug.busy")
    pg.keyboard.press("e"); pg.wait_for_timeout(800)
    samples = []
    for i in range(legs):
        to = "mangue" if pg.evaluate(f"{G}.regionId") == "tropical" else "tropical"
        g = pg.evaluate(f"{G}.region.gates['{to}']")
        pg.evaluate(f"{G}.setDestination('{to}')"); pg.evaluate(f"{G}.debug.sailTo({g['x']},{g['y']})")
        okk = until(pg, f"{G}.regionId==='{to}' && !document.querySelector('#fade').classList.contains('on')")
        pg.wait_for_timeout(2500)
        pg.evaluate("window.gc && window.gc()")
        pg.wait_for_timeout(300)
        r = pg.evaluate(f"({{heap: performance.memory.usedJSHeapSize/1048576, chunks: {G}.view.terrain.chunks.size, pages: {G}.view.atlas.pages.length, parts: {G}.particles.active.length}})")
        r["leg"] = f"{i+1}:{to}"; r["ok"] = okk
        samples.append(r)
        print(json.dumps({k: (round(v, 2) if isinstance(v, float) else v) for k, v in r.items()}), flush=True)
    first, last = samples[1]["heap"], samples[-1]["heap"]
    print(f"heap após a 2ª viagem: {first:.1f} MB · após a {legs}ª: {last:.1f} MB · variação: {last-first:+.1f} MB")
    b.close()
