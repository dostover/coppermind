"""Headless smoke tests for Pixel Party Dungeon.

Runs index.html in Chrome via Playwright and checks the main systems. Outside a
Claude viewer the game uses its ready-made stories and browser-only saves.

    python3 apps/pixel-party-dungeon/tests/smoke.py
    CHROME=/path/to/chrome python3 apps/pixel-party-dungeon/tests/smoke.py
"""
import asyncio
import os
import pathlib
import sys

from playwright.async_api import async_playwright

GAME = pathlib.Path(__file__).resolve().parent.parent / "index.html"
FAILS = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not ok:
        FAILS.append(name)


async def new_game(browser, players=2):
    pg = await browser.new_page(viewport={"width": 1280, "height": 760})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    await pg.goto(GAME.as_uri())
    await pg.wait_for_timeout(500)
    for _ in range(players - 1):
        await pg.click(".add")
    await pg.click("#startBtn")
    await pg.wait_for_timeout(400)
    await pg.click("#begin")
    await pg.wait_for_timeout(500)
    return pg, errors


async def play_battle(pg, max_steps=160):
    """Press Act for whoever's turn it is; end the turn when nothing is in reach."""
    keys = {"kb1": ("KeyE", "KeyF"), "kb2": ("Period", "Semicolon")}
    for _ in range(max_steps):
        st = await pg.evaluate("""() => { const C = window.__PPD.combat; if (!C) return null;
            return { phase: C.phase, isP: !!(C.actor && C.actor.isPlayer), ctrl: C.actor && C.actor.ctrl,
              prompt: !!(D.cur && D.cur.phase === 'prompt'), pc: D.cur && D.cur.actor && D.cur.actor.ctrl,
              ok: C.opts && C.opts[C.sel] && C.opts[C.sel].ok && C.opts[C.sel].id } }""")
        if not st:
            return True
        if st["prompt"]:
            await pg.keyboard.press(keys.get(st["pc"], keys["kb1"])[0])
        elif st["phase"] == "pturn" and st["isP"]:
            k = keys.get(st["ctrl"], keys["kb1"])
            await pg.keyboard.press(k[0] if st["ok"] and st["ok"] not in ("end", "run") else k[1])
        await pg.wait_for_timeout(250)
    return False


async def main():
    async with async_playwright() as p:
        kw = {"args": ["--no-sandbox"]}
        if os.environ.get("CHROME"):
            kw["executable_path"] = os.environ["CHROME"]
        b = await p.chromium.launch(**kw)

        # Level generation, battle, gear
        pg, errors = await new_game(b)
        bad = await pg.evaluate("""() => { let bad = 0; for (let i = 0; i < 300; i++) { const L = genLevel(1 + (i % 3));
            if (!L.door || !L.entrance || isSolid(L.map[L.door.ty * MW + L.door.tx]) || isSolid(L.map[L.entrance.ty * MW + L.entrance.tx])) bad++; }
            startLevel(1, false); return bad; }""")
        check("300 generated levels have a clear entrance and exit", bad == 0, f"{bad} bad")

        await pg.evaluate("""() => { const G = window.__PPD, p = G.players[0]; G.enemies.forEach(e => e.alive = false);
            G.enemies.push(mkEnemy('goblin', p.x + 20, p.y + p.h, 1), mkEnemy('slime', p.x + 40, p.y + p.h, 1));
            startCombat(G.enemies[G.enemies.length - 2], true, p); }""")
        check("a full battle ends", await play_battle(pg))

        r = await pg.evaluate("""() => { const p = window.__PPD.players[0]; const ac = p.ac;
            giveItem(p, makeItem('shield', 3, 'guard')); const idx = 4 + p.bag.length - 1; gearAct(p, idx);
            return { before: ac, after: p.ac, offhand: p.gear.offhand.name }; }""")
        check("equipping a magic shield raises AC", r["after"] > r["before"], str(r))

        # Run away, joining rules, falls, wipe chests
        r = await pg.evaluate("""() => { const G = window.__PPD, p = G.players[0]; G.enemies.forEach(e => e.alive = false);
            const a = mkEnemy('goblin', p.x + 20, p.y + p.h, 1); G.enemies.push(a); startCombat(a, false, null);
            const n = G.combat.order.filter(c => c.isEnemy).length; fleeCombat(); return { n, calm: a.calm }; }""")
        check("Run away calms the enemies", r["calm"] == 8, str(r))
        await pg.wait_for_timeout(1700)

        falls = await pg.evaluate("""async () => { const G = window.__PPD, p = G.players[0]; G.enemies.forEach(e => e.alive = false);
            const out = {}, tx = 20, floor = 30;
            for (const h of [8, 10, 14]) {
              for (let y = 1; y < floor; y++) { G.L.map[y * MW + tx] = E; G.L.rope[y * MW + tx] = 0; }
              G.L.map[floor * MW + tx] = ROCK; p.hp = p.maxHp; p.x = tx * T + 3; p.y = (floor - h) * T - p.h; p.vx = p.vy = 0; p.peakY = p.y; p.wasAir = true;
              G.players.forEach(q => { if (q !== p) { q.x = p.x; q.y = p.y; q.peakY = q.y; } });
              await new Promise(r => setTimeout(r, 1600)); out[h] = p.maxHp - p.hp; }
            return out; }""")
        check("one-room drops are free, big falls hurt", falls == {"8": 0, "10": 1, "14": 2}, str(falls))

        r = await pg.evaluate("""() => { const G = window.__PPD, p = G.players[0]; giveItem(p, makeItem('ring', 2, 'spring', 'might')); restartLevel();
            return G.objects.filter(o => o.seed && o.seed.lost).map(o => o.seed.item.name).sort(); }""")
        check("gear found before a wipe waits in chests", r == ["Springy Ring of Might", "Steadfast Shield"], str(r))

        # Camp: rarity lock, pooled map for a chosen player, ready check
        await pg.evaluate("() => { const G = window.__PPD; G.players[0].gold = 100; G.players[1].gold = 100; completeLevel(); }")
        await pg.wait_for_timeout(300)
        locked = await pg.evaluate("() => [...document.querySelectorAll('.rb')].filter(b => b.disabled).length")
        check("Legendary is locked after level 1", locked == 1, f"{locked} locked")
        await pg.click('[data-buyer="party"]')
        await pg.click('[data-for="1"]')
        await pg.click('[data-r="3"]')
        await pg.click("#split")
        await pg.click("#buyMap")
        await pg.wait_for_timeout(200)
        seed = await pg.evaluate("() => window.__PPD.seeds.filter(s => !s.lost).map(s => [s.owner, !!s.pooled])")
        check("a pooled map goes to the chosen player", seed == [[1, True]], str(seed))
        await pg.keyboard.press("KeyE")
        await pg.wait_for_timeout(200)
        mode1 = await pg.evaluate("() => window.__PPD.mode")
        await pg.keyboard.press("Period")
        await pg.wait_for_timeout(600)
        mode2 = await pg.evaluate("() => [window.__PPD.mode, window.__PPD.levelNum]")
        check("the next level waits until everyone is ready", mode1 == "summary" and mode2 == ["play", 2], f"{mode1} -> {mode2}")

        # Save and load
        await pg.wait_for_timeout(500)
        before = await pg.evaluate("() => window.__PPD.players.map(p => [p.lvl, p.gold, p.gear.offhand && p.gear.offhand.name])")
        await pg.evaluate("() => backToLobby()")
        await pg.wait_for_timeout(800)
        await pg.click("[data-load]")
        await pg.wait_for_timeout(800)
        after = await pg.evaluate("() => window.__PPD.players.map(p => [p.lvl, p.snap.gold, p.gear.offhand && p.gear.offhand.name])")
        check("a saved adventure loads back exactly", before == after, f"{before} vs {after}")

        check("no page errors", not errors, "; ".join(errors[:3]))
        await b.close()

    print(f"\n{len(FAILS)} failed" if FAILS else "\nAll checks passed")
    sys.exit(1 if FAILS else 0)


asyncio.run(main())
