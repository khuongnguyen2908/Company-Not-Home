# Kiểm tra trình duyệt: vào sảnh, chơi một ván, về sảnh 3 lần liên tiếp; lần nào cũng phải đủ 3 biển và ngôi sao lấp lánh.
# Chạy: npm run build:single && python3 tests/lobby_reentry.py (cần playwright cho Python)
import asyncio
from playwright.async_api import async_playwright
URL="file://" + __import__("os").path.abspath("dist-single/index.html") + "?debug"
CNT = """(() => { const sc=__session.phaser.scene.getScene('lobby'); const icons=[...sc.spotIcons.entries()].filter(([k,v])=>v.active && v.scene).map(([k])=>k); return icons.sort().join(',') + ' | sparkle ' + (!!sc.sparkle && sc.sparkle.active); })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        pg = await b.new_page(viewport={"width":1000,"height":700}); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(300)
        await pg.fill("#f-name","Lan"); await pg.click("#go-offline"); await pg.wait_for_timeout(1200)
        print("lần 1:", await pg.evaluate(CNT))
        for i in range(2, 5):
            await pg.evaluate("__ui.startGame()"); await pg.wait_for_timeout(900)
            # kết thúc ván rồi bấm "Chơi ván mới"/về sảnh như người chơi
            await pg.evaluate("(() => { document.querySelector('.reveal')?.remove(); __session.paused=false; __session.world.endGame('crew','KPI đạt 100%!'); })()"); await pg.wait_for_timeout(1500)
            btn = await pg.query_selector(".gameover button")
            labels = await pg.evaluate("[...document.querySelectorAll('.gameover button')].map(b=>b.textContent.trim())")
            # bấm nút về sảnh (nút đầu tiên)
            await pg.evaluate("document.querySelector('.gameover button').click()"); await pg.wait_for_timeout(1500)
            print(f"lần {i} (bấm '{labels[0]}'):", await pg.evaluate(CNT))
        print("ERR", errs[:3])
        await b.close()
asyncio.run(main())
