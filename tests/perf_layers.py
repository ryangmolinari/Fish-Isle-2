# Perfil por camadas: mede FPS desligando uma camada de cada vez.
import sys, json
from playwright.sync_api import sync_playwright
url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100/"
G = "window.__fishisle"
def measure(pg, secs=3):
    vals = []
    for _ in range(secs * 2):
        pg.wait_for_timeout(500)
        vals.append(pg.evaluate(f"{G}.perf.fps"))
    return sum(vals[1:]) / len(vals[1:])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.goto(url); pg.wait_for_timeout(1000)
    pg.click("[data-act=create]"); pg.wait_for_timeout(4000)
    base = measure(pg)
    print(f"tudo ligado: {base:.1f} fps")
    for k in ["waves", "light", "vig", "objects", "land", "parts"]:
        pg.evaluate(f"{G}.flags.{k}=0")
        v = measure(pg)
        pg.evaluate(f"{G}.flags.{k}=1")
        print(f"sem {k:8s}: {v:.1f} fps (+{v-base:.1f})")
    pg.evaluate(f"Object.assign({G}.flags,{{waves:0,light:0,vig:0,objects:0,land:0,parts:0}})")
    print(f"só água: {measure(pg):.1f} fps")
    b.close()
