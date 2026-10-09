# Desempenho com 12 jogadores na mesma ilha: 11 bots (protocolo real) + 1 navegador medindo FPS.
# Uso: python3 tests/perf12.py [porta] [largura] [altura] [qualidade]
import sys, subprocess, time, json, statistics, re
from playwright.sync_api import sync_playwright

port = sys.argv[1] if len(sys.argv) > 1 else "3100"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
H = int(sys.argv[3]) if len(sys.argv) > 3 else 720
Q = sys.argv[4] if len(sys.argv) > 4 else "high"
DYN = (sys.argv[5] if len(sys.argv) > 5 else "on") == "on"
G = "window.__fishisle"

bots = subprocess.Popen(["node", "tests/bots.js", "--url", f"ws://localhost:{port}/ws", "--n", "11", "--secs", "70"], stdout=subprocess.PIPE, text=True)
code = None
while code is None:
    line = bots.stdout.readline()
    m = re.match(r"sala (\w+)", line)
    if m: code = m.group(1)
print("sala", code, flush=True)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-precise-memory-info"])
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.add_init_script(f"localStorage.setItem('fishisle.settings.v1', JSON.stringify({{quality:'{Q}', master:0, dynRes:{'true' if DYN else 'false'}}}))")
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_timeout(1000)
    pg.fill("#code", code); pg.click("[data-act=join]")
    pg.wait_for_timeout(2000)
    m = pg.evaluate(f"{G}.region.moorings[0].board")
    pg.evaluate(f"{G}.debug.walkTo({m['x']},{m['y']-150})")
    pg.wait_for_timeout(9000)
    fps, js, seen = [], [], []
    t0 = time.time()
    while time.time() - t0 < 30:
        pg.wait_for_timeout(500)
        r = pg.evaluate(f"({{f:{G}.perf.fps, j:{G}.perf.frameMs, n:{G}.others.size, c:{G}.room.count}})")
        fps.append(r["f"]); js.append(r["j"]); seen.append(r["n"])
    heap = pg.evaluate("performance.memory ? performance.memory.usedJSHeapSize/1048576 : null")
    room = pg.evaluate(f"{G}.room.count")
    fps_s = sorted(fps)
    print(json.dumps({
        "resolucao": f"{W}x{H}", "qualidade": Q, "jogadores_na_sala": room, "jogadores_na_ilha": max(seen) + 1,
        "fps_medio": round(statistics.mean(fps), 1), "fps_min": round(fps_s[0], 1), "fps_p10": round(fps_s[len(fps_s)//10], 1),
        "js_ms_por_quadro": round(statistics.mean(js), 2), "heap_mb": round(heap, 1) if heap else None,
        "resolucao_dinamica": DYN, "escala_final": pg.evaluate(f"{G}.dyn || 1"),
    }, ensure_ascii=False), flush=True)
    b.close()
bots.wait(timeout=120)
print(bots.stdout.read().strip())
