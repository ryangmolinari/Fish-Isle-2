# Mede FPS do cliente em diferentes modos de renderização do Chromium headless.
import sys, json
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100/"
modes = {
    "swiftshader": ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    "cpu-raster": ["--disable-gpu", "--disable-gpu-compositing"],
    "default": [],
}
with sync_playwright() as p:
    for name, args in modes.items():
        b = p.chromium.launch(args=args)
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.goto(url); pg.wait_for_timeout(1200)
        pg.fill("#nick", "Perf"); pg.click("[data-act=play]")
        pg.wait_for_timeout(5000)
        r = pg.evaluate("JSON.stringify({fps: __fishisle.perf.fps.toFixed(1), jsMs: __fishisle.perf.frameMs.toFixed(2), accel: (()=>{const c=document.createElement('canvas').getContext('2d'); return typeof c.getContextAttributes==='function'?JSON.stringify(c.getContextAttributes()):''})()})")
        print(name, r)
        b.close()
