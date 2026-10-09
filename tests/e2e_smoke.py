# Teste de fumaça no navegador: menu → jogar → andar → screenshot.
# Uso: python3 tests/e2e_smoke.py [url] [pasta_saida]
import sys, time
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100/"
out = sys.argv[2] if len(sys.argv) > 2 else "tests/out"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto(url)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{out}/e2e-menu.png")
    pg.fill("#nick", "Testador")
    pg.click("[data-act=play]")
    pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{out}/e2e-spawn.png")
    pg.keyboard.down("w"); pg.wait_for_timeout(900); pg.keyboard.up("w")
    pg.wait_for_timeout(600)
    pg.screenshot(path=f"{out}/e2e-walk.png")
    print(pg.evaluate("JSON.stringify({fps: __fishisle.perf.fps, ms: __fishisle.perf.frameMs, x: __fishisle.me.x, y: __fishisle.me.y, region: __fishisle.regionId})"))
    for l in logs[-40:]:
        print(l)
    b.close()
