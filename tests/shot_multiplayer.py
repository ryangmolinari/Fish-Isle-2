# Captura de tela com 12 jogadores na Ilha Tropical (11 bots pescando/navegando + navegador).
import sys, subprocess, re
from playwright.sync_api import sync_playwright
port = sys.argv[1] if len(sys.argv) > 1 else "3100"
G = "window.__fishisle"
bots = subprocess.Popen(["node", "tests/bots.js", "--url", f"ws://localhost:{port}/ws", "--n", "11", "--secs", "45"], stdout=subprocess.PIPE, text=True)
code = None
while code is None:
    m = re.match(r"sala (\w+)", bots.stdout.readline())
    if m: code = m.group(1)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_timeout(1000)
    pg.fill("#nick", "Rian"); pg.fill("#code", code); pg.click("[data-act=join]")
    pg.wait_for_timeout(2000)
    m = pg.evaluate(f"{G}.region.moorings[0].board")
    pg.evaluate(f"{G}.debug.walkTo({m['x']-60},{m['y']-210})")
    pg.wait_for_timeout(14000)
    for i in range(4):
        pg.screenshot(path=f"tests/out/multiplayer-{i}.png")
        pg.wait_for_timeout(2500)
    print(pg.evaluate(f"{G}.room.count"), "na sala;", pg.evaluate(f"{G}.others.size") + 1, "na ilha")
    b.close()
bots.wait(timeout=120)
