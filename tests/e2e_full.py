# Validação de ponta a ponta no navegador real (Chromium headless):
# pesca completa → inventário/coleção → loja (venda e compra) → mapa → barco e viagem pelas 5 ilhas.
# Uso: python3 tests/e2e_full.py [url] [pasta_saida]
import sys, time, json
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100/"
out = sys.argv[2] if len(sys.argv) > 2 else "tests/out"
G = "window.__fishisle"
results = []

def ok(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("  ✓ " if cond else "  ✗ ") + name + (f" — {extra}" if extra else ""), flush=True)

def wait_until(pg, js, timeout=30, step=0.1):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate(js):
            return True
        pg.wait_for_timeout(int(step * 1000))
    return False

def shot(pg, name):
    pg.screenshot(path=f"{out}/{name}.png")

def walk(pg, x, y, timeout=120):
    pg.evaluate(f"{G}.debug.walkTo({x},{y})")
    wait_until(pg, f"!{G}.debug.busy", timeout)
    return pg.evaluate(f"Math.hypot({G}.me.x-{x},{G}.me.y-{y})")

def fish_once(pg, tag=None):
    tgt = pg.evaluate(f"{G}.debug.castTarget()")
    if not tgt:
        return "no-water"
    sx, sy = pg.evaluate(f"{G}.toScreen({tgt['x']},{tgt['y']})")
    rng = pg.evaluate(f"(await import('/shared/items.js')).RODS[{G}.you.rod].range") if False else 170
    power = min(1, (tgt['d'] + 8) / pg.evaluate(f"({G}.you.rod==='vara_bambu'?170:{G}.you.rod==='vara_fibra'?215:260)"))
    pg.mouse.move(sx, sy)
    pg.mouse.down()
    t0 = time.time()
    if tag: pg.wait_for_timeout(int(power * 600)); shot(pg, f"{tag}-1-carregando")
    wait_until(pg, f"{G}.fishing.charge >= {power}", 6, 0.02)
    pg.mouse.up()
    if tag: pg.wait_for_timeout(250); shot(pg, f"{tag}-2-lancamento")
    if not wait_until(pg, f"['wait','bite','hooking','fight'].includes({G}.fishing.state)", 6):
        return "cast-failed:" + pg.evaluate(f"{G}.fishing.state")
    if tag: pg.wait_for_timeout(600); shot(pg, f"{tag}-3-esperando")
    if not wait_until(pg, f"{G}.fishing.state==='bite'", 25, 0.05):
        return "no-bite:" + pg.evaluate(f"{G}.fishing.state")
    if tag: shot(pg, f"{tag}-4-mordida")
    pg.evaluate(f"{G}.debug.autoFight = true")
    pg.mouse.click(sx, sy)
    if not wait_until(pg, f"{G}.fishing.state==='fight'", 5, 0.05):
        return "no-fight:" + pg.evaluate(f"{G}.fishing.state")
    if tag: pg.wait_for_timeout(1800); shot(pg, f"{tag}-5-minigame")
    wait_until(pg, f"['show','idle'].includes({G}.fishing.state)", 70, 0.1)
    st = pg.evaluate(f"{G}.fishing.state")
    if st == "show" and tag:
        pg.wait_for_timeout(500); shot(pg, f"{tag}-6-captura")
    wait_until(pg, f"{G}.fishing.state==='idle'", 6)
    pg.evaluate(f"{G}.debug.autoFight = false")
    return "caught" if st == "show" else "lost"

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "fonts" not in m.text else None)
    pg.goto(url); pg.wait_for_timeout(1200)
    pg.fill("#nick", "Rian"); pg.click(".char-btn:nth-child(3)"); pg.click("[data-act=create]")
    ok("entrou numa sala nova", wait_until(pg, f"{G}.state==='playing'", 10))
    pg.wait_for_timeout(1500)

    print("Pesca")
    moor = pg.evaluate(f"{G}.region.moorings[0].board")
    d = walk(pg, moor["x"], moor["y"] - 90)
    ok("caminhou até o píer", d < 20, f"{d:.0f}px")
    caught = 0; first = True; tries = 0
    while caught < 3 and tries < 10:
        tries += 1
        r = fish_once(pg, "pesca" if first else None)
        first = False
        if r == "caught": caught += 1
        print("    tentativa", tries, r, flush=True)
    ok("ciclo completo de pesca (3 capturas)", caught >= 3, f"{caught} em {tries} tentativas")
    inv = pg.evaluate(f"{G}.you.inventory.length")
    ok("peixes no inventário", inv >= caught, f"{inv}")

    print("Inventário e coleção")
    pg.keyboard.press("i"); pg.wait_for_timeout(500); shot(pg, "inventario")
    ok("inventário abre com I", pg.evaluate(f"{G}.panels.kind==='inventory'"))
    pg.click("[data-sort=value]"); pg.wait_for_timeout(200)
    pg.click("[data-tab=coll]"); pg.wait_for_timeout(400)
    pg.click(".card:not(.unknown)"); pg.wait_for_timeout(300); shot(pg, "colecao")
    txt = pg.inner_text(".coll-head")
    ok("coleção mostra progresso total", "/50 espécies" in txt, txt.split("\n")[0])
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    ok("Esc fecha a janela", pg.evaluate(f"!{G}.panels.open"))

    print("Loja")
    shop = pg.evaluate(f"{G}.region.shop")
    d = walk(pg, shop["x"], shop["y"] + 8)
    ok("chegou ao vendedor", d < 30, f"{d:.0f}px")
    prompt = pg.inner_text("#prompt")
    ok("aviso de interação da loja", "Falar com" in prompt, prompt)
    pg.keyboard.press("e"); pg.wait_for_timeout(600); shot(pg, "loja-vender")
    ok("loja abre com E", pg.evaluate(f"{G}.panels.kind==='shop'"))
    coins0 = pg.evaluate(f"{G}.you.coins")
    total = pg.evaluate(f"{G}.you.inventory.reduce((a,f)=>a+f.value,0)")
    pg.click("[data-qs=all]"); pg.wait_for_timeout(200)
    pg.click("[data-sellsel]"); pg.wait_for_timeout(300); shot(pg, "loja-confirmar")
    pg.click("[data-c=yes]")
    wait_until(pg, f"{G}.you.inventory.length===0", 5)
    coins1 = pg.evaluate(f"{G}.you.coins")
    ok("venda em lote confirmada", coins1 == coins0 + total, f"{coins0} + {total} = {coins1}")
    pg.click("[data-stab=baits]"); pg.wait_for_timeout(300)
    pg.click("[data-buy^='bait|minhoca']"); wait_until(pg, f"({G}.you.baits.minhoca||0) >= 15", 5)
    ok("comprou isca", pg.evaluate(f"({G}.you.baits.minhoca||0) >= 15"))
    pg.click("[data-stab=rods]"); pg.wait_for_timeout(300); shot(pg, "loja-varas")
    pg.click("[data-stab=cos]"); pg.wait_for_timeout(300); shot(pg, "loja-cosmeticos")
    pg.keyboard.press("e"); pg.wait_for_timeout(300)

    print("Mapa e barco")
    pg.keyboard.press("m"); pg.wait_for_timeout(500)
    pg.click("[data-dest=mangue]"); pg.wait_for_timeout(400); shot(pg, "mapa")
    ok("destino escolhido no mapa", pg.evaluate(f"{G}.destination==='mangue'"))
    pg.keyboard.press("m"); pg.wait_for_timeout(300)
    route = ["tropical", "mangue", "congelada", "vulcanica", "cristais", "tropical"]
    inv_before = pg.evaluate(f"JSON.stringify({G}.you.inventory)+{G}.you.coins")
    for i in range(len(route) - 1):
        here, to = route[i], route[i + 1]
        moor = pg.evaluate(f"{G}.region.moorings[0].board")
        d = walk(pg, moor["x"], moor["y"])
        prompt = pg.inner_text("#prompt")
        ok(f"{here}: aviso “E — Entrar no barco”", "Entrar no barco" in prompt, f"{d:.0f}px")
        pg.keyboard.press("e")
        ok(f"{here}: embarcou", wait_until(pg, f"{G}.me.mode==='boat'", 5))
        pg.evaluate(f"{G}.setDestination('{to}')")
        pg.wait_for_timeout(1500)
        if i == 0: shot(pg, "barco-rota")
        ok(f"{here}: rota pontilhada até {to}", pg.evaluate(f"({G}.route||[]).length>=2"))
        gate = pg.evaluate(f"{G}.region.gates['{to}']")
        pg.evaluate(f"{G}.debug.sailTo({gate['x']},{gate['y']})")
        arrived = wait_until(pg, f"{G}.regionId==='{to}' && !document.querySelector('#fade').classList.contains('on')", 120, 0.2)
        ok(f"viagem {here} → {to}", arrived)
        if not arrived:
            shot(pg, f"falha-{here}-{to}")
            print("    estado:", pg.evaluate(f"JSON.stringify({{b:{G}.me.boat, r:{G}.regionId, auto:{G}._auto && {{best:{G}._auto.best, back:{G}._auto.back}}}})"))
            break
        pg.wait_for_timeout(1200)
        if i == 0: shot(pg, "chegada-mangue")
        moor = pg.evaluate(f"{G}.region.moorings[0].boat")
        pg.evaluate(f"{G}.debug.sailTo({moor['x']},{moor['y']})")
        wait_until(pg, f"!{G}.debug.busy", 90, 0.2)
        prompt = pg.inner_text("#prompt")
        pg.keyboard.press("e")
        ok(f"{to}: desembarcou no cais", wait_until(pg, f"{G}.me.mode==='walk'", 5), prompt)
        pg.wait_for_timeout(800)
        if to != "tropical":
            shop = pg.evaluate(f"{G}.region.shop")
            walk(pg, shop["x"] - 40, shop["y"] + 60)
            pg.wait_for_timeout(700)
            shot(pg, f"ilha-{to}")
    inv_after = pg.evaluate(f"JSON.stringify({G}.you.inventory)+{G}.you.coins")
    ok("viagens preservaram inventário e moedas", inv_before == inv_after)

    print("Reconexão no navegador")
    before = pg.evaluate(f"JSON.stringify({{id:{G}.me.id, inv:{G}.you.inventory, coins:{G}.you.coins, coll:{G}.you.collection}})")
    pg.evaluate(f"{G}.net.ws.close()")
    pg.wait_for_timeout(300)
    shot(pg, "reconectando")
    back = wait_until(pg, f"{G}.net.connected && document.querySelector('#reconnect').classList.contains('hidden')", 20)
    after = pg.evaluate(f"JSON.stringify({{id:{G}.me.id, inv:{G}.you.inventory, coins:{G}.you.coins, coll:{G}.you.collection}})")
    ok("reconectou automaticamente", back)
    ok("reconexão manteve personagem, inventário, moedas e coleção", before == after)
    ok("sem personagem duplicado após reconectar", pg.evaluate(f"{G}.room.count") == 1, str(pg.evaluate(f"{G}.room.count")))
    perf = pg.evaluate(f"JSON.stringify({{fps:{G}.perf.fps, js:{G}.perf.frameMs}})")
    print("perf", perf)
    ok("sem erros de JavaScript", not errors, "; ".join(errors[:5]))
    b.close()

failed = [n for n, c in results if not c]
print(f"\n{len(results) - len(failed)}/{len(results)} verificações passaram.")
sys.exit(1 if failed else 0)
