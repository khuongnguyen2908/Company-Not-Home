# Kiểm tra chơi nhiều người trong trình duyệt thật (màn chia ô ?multitest).
# Chạy: npm run build:single && (cd dist-single && python3 -m http.server 8765) rồi ở tab khác: python3 tests/multitest_e2e.py
# Phần 1: di chuyển đồng bộ, họp, chat, sẵn sàng bỏ phiếu, bỏ phiếu, chọn nơi bắt đầu.
# Phần 3: tải lại trang giữa ván vào lại đúng nhân vật, dòng 'Bạn đang ở' ở màn chọn nơi bắt đầu, chủ phòng đóng tab.
# Phần 2: hết ván, chơi ván mới, về phòng, rời giữa ván, người đến muộn bị từ chối, vào bằng link, chủ phòng đóng phòng.
import asyncio
from playwright.async_api import async_playwright
async def ev(f, js): return await f.evaluate(js)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        pg = await b.new_page(viewport={"width":1500,"height":900})
        await pg.goto("http://localhost:8765/index.html?multitest=3"); await pg.wait_for_timeout(4500)
        fr = sorted([f for f in pg.frames if 'mt=' in f.url], key=lambda f: f.url)
        for f in fr: await f.evaluate("window.addEventListener('error', e => (window.__errs ||= []).push(e.message))")
        await pg.click(".mt-bar button[data-c='start']"); await pg.wait_for_timeout(2000)
        await pg.click(".mt-bar button[data-c='ready']"); await pg.wait_for_timeout(8000)
        await pg.screenshot(path="/tmp/mt_play.png")
        host = fr[0]
        # người 2 đi sang phải 1,5 giây bằng bàn phím trong ô của mình
        id2 = await fr[1].evaluate("__session.world.meId")
        before = await ev(host, f"(() => {{ const a=__session.world.agents[{id2}]; return [Math.round(a.x), Math.round(a.y)]; }})()")
        el = await pg.query_selector(".mt-cell[data-slot='2'] iframe"); await el.click(position={"x":300,"y":300}); await pg.wait_for_timeout(200)
        await pg.keyboard.down("d"); await pg.wait_for_timeout(1500); mid = await ev(host, f"Math.round(__session.world.agents[{id2}].x)"); await pg.keyboard.up("d"); await pg.wait_for_timeout(500); print("giữa lúc giữ phím, chủ phòng thấy x =", mid)
        after = await ev(host, f"(() => {{ const a=__session.world.agents[{id2}]; return [Math.round(a.x), Math.round(a.y)]; }})()")
        mine = await ev(fr[1], "(() => { const a=__session.world.player; return [Math.round(a.x), Math.round(a.y)]; })()")
        seen3 = await ev(fr[2], f"(() => {{ const a=__session.world.agents[{id2}]; return [Math.round(a.x), Math.round(a.y)]; }})()")
        print("người 2 trên máy chủ phòng: trước", before, "sau", after, "| trên máy người 2:", mine, "| người 3 thấy người 2 ở:", seen3)
        # gọi họp
        await pg.click(".mt-bar button[data-c='meeting']"); await pg.wait_for_timeout(2500)
        for i,f in enumerate(fr): print(f"ô {i+1} họp:", await ev(f, "(() => `phase=${__session.world.phase} khung họp=${!!document.querySelector('.meet')}`)()"))
        # người 2 nhắn tin
        await fr[1].fill("#m-input", "Tôi ở Phòng làm việc nãy giờ"); await fr[1].press("#m-input", "Enter")
        await pg.wait_for_timeout(1200)
        for i,f in enumerate(fr): print(f"ô {i+1} thấy tin nhắn:", await ev(f, "[...document.querySelectorAll('.chat-log .msg')].some(m => m.textContent.includes('Phòng làm việc nãy giờ'))"))
        await pg.screenshot(path="/tmp/mt_meet.png")
        # cả 3 bấm Sẵn sàng bỏ phiếu
        for f in fr: await f.click("#m-ready")
        await pg.wait_for_timeout(1500)
        print("mở bỏ phiếu sớm:", await ev(host, "(() => { const m=__session.world.meeting; return m && m.t >= m.discussEnd; })()"))
        for f in fr: await f.evaluate("document.querySelector('#m-skip') && !document.querySelector('#m-skip').disabled && document.querySelector('#m-skip').click()")
        await pg.wait_for_timeout(1500)
        print("phiếu trên máy chủ phòng:", await ev(host, "(() => { const m=__session.world.meeting; return m ? [...m.votes.entries()].filter(([k])=>k<3).map(([k,v])=>k+':'+v).join(' ') : 'hết họp'; })()"))
        # chờ kết quả + màn chọn nơi bắt đầu
        for t in range(40):
            await pg.wait_for_timeout(1000)
            st = [await ev(f, "!!document.querySelector('.spawn-modal')") for f in fr]
            if any(st): break
        print("màn chọn nơi bắt đầu ở các ô:", st)
        await pg.screenshot(path="/tmp/mt_spawn.png")
        for i,f in enumerate(fr):
            if await ev(f, "!!document.querySelector('.spawn-modal')"): await f.click(".sp-card >> nth=%d" % (i % 3))
        await pg.wait_for_timeout(2000)
        for i,f in enumerate(fr): print(f"ô {i+1} sau chọn:", await ev(f, "(() => { const w=__session.world, p=w.player; return `phase=${w.phase} tạm dừng=${__session.paused} còn màn chọn=${!!document.querySelector('.spawn-modal')} tầng=${Math.round(p.y/48)}`; })()"))
        print("chủ phòng còn chờ:", await ev(host, "__session.world.spawnOffers.size"))
        for i,f in enumerate(fr): print(f"lỗi ô {i+1}:", await ev(f, "(window.__errs||[]).slice(0,3)"))
        await b.close()
print('=== Phần 1 ==='); asyncio.run(main())

async def main2():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        ctx = await b.new_context(viewport={"width":1500,"height":900})
        pg = await ctx.new_page()
        await pg.goto("http://localhost:8765/index.html?multitest=3"); await pg.wait_for_timeout(4500)
        fr = sorted([f for f in pg.frames if 'mt=' in f.url], key=lambda f: f.url)
        for f in fr: await f.evaluate("window.addEventListener('error', e => (window.__errs ||= []).push(e.message))")
        code = await ev(fr[0], "__net.host.code")
        print("dòng 'Có trong ván' ở ô 3 (phòng):", await ev(fr[0], "1"))
        await pg.click(".mt-bar button[data-c='start']"); await pg.wait_for_timeout(2000)
        print("ô 1:", (await ev(fr[0], "document.querySelector('.role-list')?.textContent")), "| ô 3:", (await ev(fr[2], "document.querySelector('.role-list')?.textContent")))
        await pg.click(".mt-bar button[data-c='ready']"); await pg.wait_for_timeout(8000)
        # 4. một tab riêng vào bằng link khi phòng đang chơi -> bị từ chối
        late = await ctx.new_page()
        await late.goto(f"http://localhost:8765/index.html?room={code}"); await late.wait_for_timeout(600)
        await late.fill("#f-name", "Đến muộn"); await late.click("#go-online"); await late.wait_for_timeout(300)
        await late.fill("#on-code", code); await late.click("#on-go"); await late.wait_for_timeout(2500)
        print("người đến muộn thấy:", (await late.evaluate("[...document.querySelectorAll('.modal h2, .modal p')].map(e=>e.textContent).join(' | ')"))[:150])
        # 2. người 3 rời phòng giữa ván
        id3 = await ev(fr[2], "__session.world.meId")
        await ev(fr[2], "__ui.leaveNet()"); await pg.wait_for_timeout(1500)
        print("sau khi người 3 rời: chủ phòng coi nhân vật", id3, "là người thật?", await ev(fr[0], f"__session.world.agents[{id3}].human"), "| còn", await ev(fr[0], "__net.host.players.length"), "người trong phòng")
        # 1. hết ván -> màn kết quả ở mọi ô còn lại
        await ev(fr[0], "__session.world.endGame('crew', 'Thử kết thúc ván')"); await pg.wait_for_timeout(2500)
        for i in (0,1): print(f"ô {i+1} màn kết quả:", await ev(fr[i], "!!document.querySelector('.gameover')"), "| nút:", await ev(fr[i], "[...document.querySelectorAll('.gameover button')].filter(b=>!b.hidden).map(b=>b.textContent).join(', ')"))
        await pg.screenshot(path="/tmp/mt_over.png")
        # chơi ván mới
        await pg.click(".mt-bar button[data-c='again']"); await pg.wait_for_timeout(2500)
        for i in (0,1): print(f"ô {i+1} ván mới:", await ev(fr[i], "(() => `tờ phân công=${!!document.querySelector('.reveal')} phase=${__session.world.phase} người thật=${__session.world.agents.filter(a=>a.human).length}`)()"))
        await pg.click(".mt-bar button[data-c='ready']"); await pg.wait_for_timeout(8000)
        await ev(fr[0], "__session.world.endGame('impostor', 'Thử lần 2')"); await pg.wait_for_timeout(2000)
        # về phòng
        await fr[0].click(".gameover #lobby"); await pg.wait_for_timeout(1500)
        for i in (0,1): print(f"ô {i+1} sau 'Về phòng':", (await ev(fr[i], "document.querySelector('.room-screen')?.innerText.replace(/\\s+/g,' ').slice(0,90) ?? 'không có màn phòng'")))
        # 3. tab riêng vào bằng link lúc phòng chờ
        await late.goto(f"http://localhost:8765/index.html?room={code}"); await late.wait_for_timeout(3000)
        print("vào bằng link: tab mới thấy", (await late.evaluate("document.querySelector('.room-screen')?.innerText.replace(/\\s+/g,' ').slice(0,120) ?? 'không vào được'")))
        print("chủ phòng thấy", await ev(fr[0], "__net.host.players.map(p=>p.name).join(', ')"))
        # 5. chủ phòng đóng phòng
        await ev(fr[0], "__ui.leaveNet()"); await pg.wait_for_timeout(1500)
        print("ô 2 sau khi chủ phòng đóng:", (await ev(fr[1], "[...document.querySelectorAll('.modal h2')].map(e=>e.textContent).join(' | ')")), "| tab link:", (await late.evaluate("[...document.querySelectorAll('.modal h2')].map(e=>e.textContent).join(' | ')")))
        for i,f in enumerate(fr): print(f"lỗi ô {i+1}:", await ev(f, "(window.__errs||[]).slice(0,3)"))
        await b.close()
print('=== Phần 2 ==='); asyncio.run(main2())

async def main3():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        ctx = await b.new_context(viewport={"width":1500,"height":900}); pg = await ctx.new_page()
        await pg.goto("http://localhost:8765/index.html?multitest=3"); await pg.wait_for_timeout(4500)
        fr = lambda: sorted([f for f in pg.frames if 'mt=' in f.url], key=lambda f: f.url)
        F = fr()
        await pg.click(".mt-bar button[data-c='start']"); await pg.wait_for_timeout(2000)
        await pg.click(".mt-bar button[data-c='ready']"); await pg.wait_for_timeout(8000)
        me2 = await ev(F[1], "__session.world.meId"); x_before = await ev(F[0], f"Math.round(__session.world.agents[{me2}].x)")
        print("người 2 là nhân vật", me2)
        # người 2 tải lại trang giữa ván
        await F[1].evaluate("location.reload()"); await pg.wait_for_timeout(6000)
        F = fr()
        print("sau tải lại: người 2 có ván?", await ev(F[1], "!!__session.world && __session.world.phase"), "| nhân vật", await ev(F[1], "__session.world?.meId"), "| tờ phân công còn mở?", await ev(F[1], "!!document.querySelector('.reveal')"))
        print("chủ phòng coi là người thật:", await ev(F[0], f"__session.world.agents[{me2}].human"), "| mất kết nối:", await ev(F[0], f"!!__session.world.agents[{me2}].away"))
        print("thông báo ở ô 3 (toast):", await ev(F[2], "document.querySelector('.toast')?.textContent ?? ''"))
        # gọi họp -> bỏ phiếu bỏ qua -> màn chọn nơi bắt đầu có 'Bạn đang ở'
        await pg.click(".mt-bar button[data-c='meeting']"); await pg.wait_for_timeout(2500)
        for f in F: await f.click("#m-ready")
        await pg.wait_for_timeout(1200)
        for f in F: await f.evaluate("document.querySelector('#m-skip') && !document.querySelector('#m-skip').disabled && document.querySelector('#m-skip').click()")
        for t in range(40):
            await pg.wait_for_timeout(1000)
            if await ev(F[1], "!!document.querySelector('.spawn-modal')"): break
        print("màn chọn ở người 2:", await ev(F[1], "document.querySelector('.sp-here')?.textContent"), "| nhãn cùng tầng:", await ev(F[1], "document.querySelectorAll('.sp-same').length"))
        await pg.screenshot(path="/tmp/mt_here.png")
        # chủ phòng đóng tab
        await F[0].goto("about:blank"); await pg.wait_for_timeout(1500)
        for i in (1, 2): print(f"ô {i+1} sau khi chủ phòng đóng:", await ev(F[i], "[...document.querySelectorAll('.modal h2')].map(e=>e.textContent).join(' | ')"))
        await b.close()
print('=== Phần 3: tải lại giữa ván, màn chọn nơi bắt đầu, chủ phòng đóng tab ==='); asyncio.run(main3())

HIDE = "(() => { window.requestAnimationFrame = () => 0; Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); })()"
async def main4():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        ctx = await b.new_context(viewport={"width":1400,"height":850}); grid = await ctx.new_page()
        await grid.goto("http://localhost:8765/index.html?multitest=2"); await grid.wait_for_timeout(4000)
        F = sorted([f for f in grid.frames if 'mt=' in f.url], key=lambda f: f.url)
        code = await F[0].evaluate("__net.host.code")
        tab = await ctx.new_page(); await tab.goto("http://localhost:8765/index.html?debug"); await tab.wait_for_timeout(800)
        await tab.fill("#f-name", "Tab riêng"); await tab.click("#go-online"); await tab.fill("#on-code", code); await tab.click("#on-go"); await tab.wait_for_timeout(2000)
        await grid.click(".mt-bar button[data-c='start']"); await grid.wait_for_timeout(2500)
        for f in F: await f.evaluate("document.querySelector('.reveal #go')?.click()")
        await tab.evaluate("document.querySelector('.reveal #go')?.click()"); await grid.wait_for_timeout(8000)
        me = await tab.evaluate("__session.world.meId")
        print("3. nhãn mã phòng trong ván:", await tab.evaluate("document.querySelector('#b-room')?.textContent"), "| ở chủ phòng:", await F[0].evaluate("document.querySelector('#b-room')?.textContent"))
        # 2. tab riêng bị ẩn khi đang giữ phím
        await tab.keyboard.down("d"); await tab.wait_for_timeout(400)
        await tab.evaluate(HIDE)
        await tab.wait_for_timeout(300); x1 = await F[0].evaluate(f"Math.round(__session.world.agents[{me}].x)")
        await tab.wait_for_timeout(1500); x2 = await F[0].evaluate(f"Math.round(__session.world.agents[{me}].x)")
        await tab.keyboard.up("d")
        print("2. tab bị ẩn khi đang giữ phím: chủ phòng thấy", x1, "->", x2, "(phải đứng yên)")
        # 4. đóng hẳn tab riêng, mở tab mới -> nút Vào lại phòng
        await tab.close(); await grid.wait_for_timeout(6000)
        print("   chủ phòng: người thật?", await F[0].evaluate(f"__session.world.agents[{me}].human"), "| mất kết nối?", await F[0].evaluate(f"!!__session.world.agents[{me}].away"))
        tab2 = await ctx.new_page(); await tab2.goto("http://localhost:8765/index.html?debug"); await tab2.wait_for_timeout(1000)
        btn = await tab2.evaluate("document.querySelector('.rejoin-btn')?.innerText.replace(/\\s+/g,' ')")
        print("4. màn hình chính tab mới có nút:", btn)
        await tab2.fill("#f-name", "Tab riêng"); await tab2.click(".rejoin-btn"); await tab2.wait_for_timeout(300)
        print("   popup:", await tab2.evaluate("document.querySelector('.rejoin-pop')?.innerText.replace(/\\s+/g,' ')"))
        await tab2.wait_for_timeout(2500)
        print("   vào lại: nhân vật", await tab2.evaluate("__session.world?.meId"), "(cũ là", me, ") | popup còn?", await tab2.evaluate("!!document.querySelector('.rejoin-pop')"), "| chủ phòng: mất kết nối?", await F[0].evaluate(f"!!__session.world.agents[{me}].away"))
        await tab2.screenshot(path="/tmp/rejoin_ok.png")
        # 5. chủ phòng mất kết nối đột ngột (không kịp báo đóng phòng)
        await F[0].evaluate("__net.host.tr.close()")
        await tab2.wait_for_timeout(7000)
        print("5. sau 7 giây:", await tab2.evaluate("document.querySelector('.net-pop:not(.rejoin-pop)')?.innerText.replace(/\\s+/g,' ')"))
        await tab2.screenshot(path="/tmp/hostlost.png")
        await tab2.wait_for_timeout(10000)
        print("   sau 17 giây:", await tab2.evaluate("[...document.querySelectorAll('.modal h2')].map(e=>e.textContent).join(' | ')"), "| nút vào lại còn?", await tab2.evaluate("!!document.querySelector('.rejoin-btn')"))
        await b.close()
print('=== Phần 4: tab riêng + màn chia ô (tab ẩn), nhãn mã phòng, vào lại sau khi đóng tab, mất chủ phòng ==='); asyncio.run(main4())
