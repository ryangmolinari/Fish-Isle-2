# Captura de tela de uma página do jogo (ferramenta de desenvolvimento).
# Uso: python3 tests/shot.py URL saida.png [largura] [altura] [espera_ms] [js_extra]
import sys
from playwright.sync_api import sync_playwright

url, out = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
h = int(sys.argv[4]) if len(sys.argv) > 4 else 800
wait = int(sys.argv[5]) if len(sys.argv) > 5 else 1500
js = sys.argv[6] if len(sys.argv) > 6 else None
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
    pg = b.new_page(viewport={"width": w, "height": h})
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto(url)
    pg.wait_for_timeout(wait)
    if js:
        print(pg.evaluate(js))
        pg.wait_for_timeout(800)
    pg.screenshot(path=out, full_page=True)
    print(pg.title())
    for l in logs[-30:]:
        print(l)
    b.close()
