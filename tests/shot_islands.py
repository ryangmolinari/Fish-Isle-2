# Capturas de cada ilha dentro do jogo (viaja de barco e anda até a loja).
import sys, time
from playwright.sync_api import sync_playwright
port = sys.argv[1] if len(sys.argv) > 1 else "3100"
targets = sys.argv[2:] or ["mangue", "congelada", "vulcanica", "cristais"]
G = "window.__fishisle"
def until(pg, js, t=150):
    t0 = time.time()
    while time.time() - t0 < t:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(250)
    return False
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_timeout(1000)
    pg.fill("#nick", "Rian"); pg.click(".char-btn:nth-child(5)"); pg.click("[data-act=create]"); pg.wait_for_timeout(2000)
    pg.screenshot(path="tests/out/ilha-tropical.png")
    for to in targets:
        m = pg.evaluate(f"{G}.region.moorings[0].board")
        pg.evaluate(f"{G}.debug.walkTo({m['x']},{m['y']})"); until(pg, f"!{G}.debug.busy")
        pg.keyboard.press("e"); until(pg, f"{G}.me.mode==='boat'", 5)
        g = pg.evaluate(f"{G}.region.gates['{to}']")
        pg.evaluate(f"{G}.setDestination('{to}')"); pg.evaluate(f"{G}.debug.sailTo({g['x']},{g['y']})")
        until(pg, f"{G}.regionId==='{to}' && !document.querySelector('#fade').classList.contains('on')")
        mo = pg.evaluate(f"{G}.region.moorings[0].boat")
        pg.evaluate(f"{G}.debug.sailTo({mo['x']},{mo['y']})"); until(pg, f"!{G}.debug.busy", 90)
        pg.keyboard.press("e"); until(pg, f"{G}.me.mode==='walk'", 5)
        s = pg.evaluate(f"{G}.region.shop")
        pg.evaluate(f"{G}.debug.walkTo({s['x']-60},{s['y']+70})"); until(pg, f"!{G}.debug.busy", 120)
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f"tests/out/ilha-{to}.png")
        print(to, "ok", flush=True)
    print("erros:", errs)
    b.close()
