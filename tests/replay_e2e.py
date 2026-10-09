# Chơi lại nhiều ván liền (màn chia ô ?multitest=3): ván nào người vào phòng cũng phải thấy màn chọn nơi bắt đầu sau họp
# (trước đây từ ván 2 không thấy, cả phòng đứng hình ~10 giây). Chạy: build:single + http.server 8765, rồi python3 tests/replay_e2e.py
import asyncio
from playwright.async_api import async_playwright
async def ev(f, js): return await f.evaluate(js)
async def main():
    fails = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu"])
        pg = await b.new_page(viewport={"width": 1500, "height": 900})
        await pg.goto("http://localhost:8765/index.html?multitest=3", wait_until="domcontentloaded"); await pg.wait_for_timeout(6000)
        fr = sorted([f for f in pg.frames if 'mt=' in f.url], key=lambda f: f.url)
        for f in fr: await ev(f, "window.addEventListener('error', e => (window.__errs ||= []).push(e.message)); new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('spawn-modal')) window.__spawnSeen = true; }).observe(document.body, { childList: true, subtree: true })")
        await pg.click(".mt-bar button[data-c='start']"); await pg.wait_for_timeout(2500)
        for rnd in (1, 2, 3):
            for t in range(20):  # chờ tờ phân công hiện ở cả 3 ô rồi mới bấm sẵn sàng
                if all([await ev(f, "!!document.querySelector('.reveal')") for f in fr]): break
                await pg.wait_for_timeout(500)
            await pg.click(".mt-bar button[data-c='ready']")
            for t in range(30):  # chờ vào ca thật sự
                await pg.wait_for_timeout(500)
                if all([await ev(f, "!document.querySelector('.reveal') && !__session.paused") for f in fr]): break
            await pg.wait_for_timeout(1500)
            for f in fr: await ev(f, "window.__spawnSeen = false")
            await ev(fr[0], "(() => { const w = __session.world; w.emergencyCd = 0; w.startMeeting(0, null, 'bell'); })()"); await pg.wait_for_timeout(4000)
            await ev(fr[0], "(() => { const w = __session.world, m = w.meeting; if (!m) return; m.t = m.discussEnd; for (const a of w.agents) if (a.alive) m.votes.set(a.id, 'skip'); m.t = m.duration; })()")  # bỏ qua: không ai bị sa thải, ván chưa hết
            st = [False] * 3
            for t in range(40):
                await pg.wait_for_timeout(1000)
                st = [await ev(f, "!!window.__spawnSeen") for f in fr]
                if all(st): break
            ok = all(st)
            if not ok: print('   trạng thái:', [await ev(f, "(() => `phase=${__session.world.phase} họp=${!!__session.world.meeting} offer=${JSON.stringify(__session.world.spawnOffer)}`)()") for f in fr])
            fails += not ok
            print(f"{'✔' if ok else '✘'} ván {rnd}: màn chọn nơi bắt đầu sau họp ở 3 ô = {st}")
            for f in fr: await ev(f, "document.querySelector('.sp-card')?.click()")
            for t in range(30):  # chờ cả phòng chạy lại (ai chưa chọn thì hết 10 giây tự ở lại Phòng họp)
                await pg.wait_for_timeout(500)
                if all([await ev(f, "!__session.paused && !document.querySelector('.spawn-modal')") for f in fr]): break
            mv = [await ev(f, "(() => `phase=${__session.world.phase} tạm dừng=${__session.paused}`)()") for f in fr]
            ok = all('tạm dừng=false' in x and 'play' in x for x in mv)
            fails += not ok
            print(f"{'✔' if ok else '✘'} ván {rnd}: chọn xong cả phòng chơi tiếp: {mv}")
            if rnd < 3:
                await ev(fr[0], "__session.world.endGame('crew', 'Thử')"); await pg.wait_for_timeout(4000)
                await pg.click(".mt-bar button[data-c='again']"); await pg.wait_for_timeout(3000)
        for i, f in enumerate(fr):
            e = await ev(f, "(window.__errs || []).slice(0, 3)")
            fails += bool(e); print(f"{'✔' if not e else '✘'} lỗi ô {i+1}: {e}")
        await b.close()
    print("\nTất cả đạt" if not fails else f"\nCÓ {fails} LỖI")
asyncio.run(main())
