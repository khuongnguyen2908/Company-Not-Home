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
        await ev(fr[0], "__session.world.endGame('impostor', 'Thử lần 2')")
        # về phòng (chờ màn kết quả hiện hẳn rồi mới bấm)
        await fr[0].wait_for_selector(".gameover #lobby", timeout=15000); await pg.wait_for_timeout(500)
        await fr[0].click(".gameover #lobby"); await pg.wait_for_timeout(1500)
        for i in (0,1): print(f"ô {i+1} sau 'Về phòng':", (await ev(fr[i], "(document.querySelector('.lc-title')?.textContent ?? 'không ở sảnh phòng') + ' · ' + (document.querySelector('.lc-mode')?.textContent ?? '')")))
        # 3. tab riêng vào bằng link lúc phòng chờ
        await late.goto(f"http://localhost:8765/index.html?room={code}"); await late.wait_for_timeout(3000)
        print("vào bằng link: tab mới thấy", (await late.evaluate("(document.querySelector('.lc-title')?.textContent ?? 'không vào được') + ' · ' + (document.querySelector('.lc-mode')?.textContent ?? '')")))
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

async def main5():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        ctx = await b.new_context(viewport={"width":1500,"height":900}); pg = await ctx.new_page()
        await pg.goto("http://localhost:8765/index.html?multitest=3"); await pg.wait_for_timeout(13000)
        F = sorted([f for f in pg.frames if 'mt=' in f.url], key=lambda f: f.url)
        for f in F: await f.evaluate("window.addEventListener('error', e => (window.__errs ||= []).push(e.message))")
        for i,f in enumerate(F):
            print(f"ô {i+1}:", await f.evaluate("(() => { const sc=__session.phaser.scene.getScene('lobby'); return `cảnh sảnh=${__session.phaser.scene.isActive('lobby')} tiêu đề=${document.querySelector('.lc-title')?.textContent} người khác=${sc.bots.filter(b=>b.peer).length} đã tới=${sc.bots.filter(b=>b.peer&&b.arrived).length} mình đã tới=${sc.me?.arrived}`; })()"))
        await pg.screenshot(path="/tmp/lob_on1.png")
        # người 2 đi sang phải trong sảnh
        p2 = await F[1].evaluate("__net.client.tr.peerId")
        x0 = await F[0].evaluate(f"(() => {{ const m=__session.phaser.scene.getScene('lobby').bots.find(b=>b.peer==='{p2}'); return Math.round(m.x); }})()")
        el = await pg.query_selector(".mt-cell[data-slot='2'] iframe"); await el.click(position={"x":300,"y":300}); await pg.wait_for_timeout(200)
        await pg.keyboard.down("a"); await pg.wait_for_timeout(1000); await pg.keyboard.up("a"); await pg.wait_for_timeout(500)
        own = await F[1].evaluate("Math.round(__session.phaser.scene.getScene('lobby').me.x)")
        x1 = await F[0].evaluate(f"(() => {{ const m=__session.phaser.scene.getScene('lobby').bots.find(b=>b.peer==='{p2}'); return Math.round(m.x); }})()")
        x3 = await F[2].evaluate(f"(() => {{ const m=__session.phaser.scene.getScene('lobby').bots.find(b=>b.peer==='{p2}'); return Math.round(m.x); }})()")
        print("người 2 đi trong sảnh: máy mình", own, "| chủ phòng thấy", x0, "->", x1, "| người 3 thấy", x3)
        # chat
        await F[1].evaluate("__session.phaser.scene.getScene('lobby').chatSay('Chào cả phòng!')"); await pg.wait_for_timeout(800)
        for i in (0,2): print(f"ô {i+1} thấy bong bóng:", await F[i].evaluate("__session.phaser.scene.getScene('lobby').bubbles.some(b=>b.text==='Chào cả phòng!')"))
        # nghịch chuông
        await F[2].evaluate("__session.phaser.scene.getScene('lobby').interact('bell')"); await pg.wait_for_timeout(500)
        print("chủ phòng thấy hiệu ứng chuông:", await F[0].evaluate("__session.phaser.scene.getScene('lobby').fx.some(f=>f.kind==='ring')"))
        await pg.screenshot(path="/tmp/lob_on2.png")
        # chủ phòng vào ca bằng thang máy -> cả phòng xem cảnh thang máy rồi vào ván
        await F[0].evaluate("(() => { const ui=__ui; ui.startOnlineFromLobby(); })()")
        await pg.wait_for_timeout(1500)
        for i,f in enumerate(F): print(f"ô {i+1} đang xem cảnh thang máy:", await f.evaluate("!!__session.phaser.scene.getScene('lobby').cut"))
        await pg.wait_for_timeout(9000)
        for i,f in enumerate(F): print(f"ô {i+1} sau cảnh thang máy:", await f.evaluate("(() => `có ván=${!!__session.world} tờ phân công=${!!document.querySelector('.reveal')}`)()"))
        for i,f in enumerate(F): print(f"lỗi ô {i+1}:", await f.evaluate("(window.__errs||[]).slice(0,3)"))
        await b.close()
print('=== Phần 5: sảnh chung online (tới sảnh, đi lại, chat, nghịch đồ, cùng vào thang máy) ==='); asyncio.run(main5())

OVER6 = """(() => { const sc=__session.phaser.scene.getScene('lobby'); let n=0; const vs=sc.vehicles; for (let i=0;i<vs.length;i++) for (let j=i+1;j<vs.length;j++) { const a=vs[i], b=vs[j]; if (a.lane===b.lane && Math.abs(a.x-b.x) < (a.len+b.len)/2 - 2) n++; } return n; })()"""
async def main6():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        ctx = await b.new_context(viewport={"width":1300,"height":820})
        # 4. sảnh chơi một mình có bot -> thoát -> tạo phòng online
        A = await ctx.new_page(); errs=[]; A.on("pageerror", lambda e: errs.append(str(e)))
        await A.goto("http://localhost:8765/index.html?debug"); await A.wait_for_timeout(800)
        await A.fill("#f-name", "Chủ"); await A.click("#go-offline"); await A.wait_for_timeout(6000)
        print("sảnh chơi một mình: số bot", await A.evaluate("__session.phaser.scene.getScene('lobby').bots.length"))
        await A.evaluate("document.querySelector('#l-exit').click()"); await A.wait_for_timeout(600)
        await A.click("#go-online"); await A.click("#on-create"); await A.wait_for_timeout(5000)
        print("4. sảnh online sau khi tạo phòng: bot còn sót =", await A.evaluate("__session.phaser.scene.getScene('lobby').bots.filter(b=>!b.peer).length"), "| tiêu đề:", await A.evaluate("document.querySelector('.lc-title').innerText"))
        code = await A.evaluate("__net.host.code")
        print("1. nút sao chép:", await A.evaluate("!!document.querySelector('.lc-copy')"))
        # 2. xe chồng nhau: lấy mẫu 25 giây
        worst = 0
        for t in range(50):
            await A.wait_for_timeout(500); worst = max(worst, await A.evaluate(OVER6))
        print("2. số cặp xe cùng làn chồng nhau (lớn nhất trong 25 giây):", worst)
        # người vào phòng
        B = await ctx.new_page(); B.on("pageerror", lambda e: errs.append(str(e)))
        await B.goto("http://localhost:8765/index.html?debug"); await B.wait_for_timeout(800)
        await B.fill("#f-name", "Khách"); await B.click("#go-online"); await B.fill("#on-code", code); await B.click("#on-go"); await B.wait_for_timeout(3000)
        # 3. chủ phòng chỉnh cài đặt
        await A.evaluate("__ui.openRoomPanel()"); await A.wait_for_timeout(300)
        await A.click(".rm-role[data-r='hr']"); await A.select_option("#rm-disc", "90"); await A.check("#rm-anon"); await A.wait_for_timeout(600)
        await A.screenshot(path="/tmp/rm_panel.png")
        await B.evaluate("__ui.openRoomPanel()"); await B.wait_for_timeout(400)
        print("3. người vào phòng thấy: HR bật?", await B.evaluate("document.querySelector(\".rm-role[data-r='hr']\").classList.contains('on')"), "| thảo luận:", await B.evaluate("document.querySelector('#rm-disc').value"), "| ẩn danh:", await B.evaluate("document.querySelector('#rm-anon').checked"), "| chỉnh được?", await B.evaluate("!document.querySelector('#rm-disc').disabled"))
        await A.evaluate("document.querySelector('.room-x')?.click()"); await B.evaluate("document.querySelector('.room-x')?.click()")
        await A.evaluate("__ui.startOnlineFromLobby()"); await A.wait_for_timeout(9000)
        print("   vào ván: thảo luận", await A.evaluate("__session.world.discussTime"), "giây | có HR trong ván?", await A.evaluate("__session.world.roleList.includes('hr')"), "| máy khách phiếu ẩn danh:", await B.evaluate("__ui.anonVotesOn()"))
        print("lỗi:", errs[:3])
        await b.close()
print('=== Phần 6: bot không sót khi chuyển sang phòng online, nút sao chép, xe không chồng nhau, cài đặt phòng ==='); asyncio.run(main6())

async def main7():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        ctx = await b.new_context(viewport={"width":1500,"height":900}); pg = await ctx.new_page()
        await pg.goto("http://localhost:8765/index.html?multitest=3"); await pg.wait_for_timeout(9000)
        F = sorted([f for f in pg.frames if 'mt=' in f.url], key=lambda f: f.url)
        for f in F: await f.evaluate("window.addEventListener('error', e => (window.__errs ||= []).push(e.message))")
        await pg.select_option(".mt-roles select[data-name='Người 2']", "artist")
        await pg.select_option(".mt-roles select[data-name='Người 3']", "animator")
        await pg.wait_for_timeout(300)
        await pg.click(".mt-bar button[data-c='start']"); await pg.wait_for_timeout(3000)
        await pg.click(".mt-bar button[data-c='ready']"); await pg.wait_for_timeout(8000)
        print("vai sau khi giao:", [await f.evaluate("(() => { const p=__session.world.player; return p.name+': '+(p.role==='impostor'?'Nội gián':p.dept); })()") for f in F])
        # ---- Artist ở máy người 2: mở máy so màu, giữ 3 giây
        await F[0].evaluate("(() => { const w=__session.world; w.meetingCount=1; const a=w.agents.find(o=>o.name==='Người 2'); a.artistNext=0; })()"); await pg.wait_for_timeout(600)
        await F[1].evaluate("__ui.openColorCheck()"); await pg.wait_for_timeout(400)
        await F[1].click(".cc-g"); await pg.wait_for_timeout(300)   # bước 1: chọn màu
        hb = await (await F[1].query_selector(".cc-scan .hold")).bounding_box()      # bước 2: giữ nút quét 3 giây
        await pg.mouse.move(hb['x']+hb['width']/2, hb['y']+hb['height']/2); await pg.mouse.down(); await pg.wait_for_timeout(3500); await pg.mouse.up(); await pg.wait_for_timeout(900)
        res = await F[1].evaluate("document.querySelector('.cc-result')?.innerText.replace(/\\s+/g,' ')")
        host_res = await F[0].evaluate("(() => { const a=__session.world.agents.find(o=>o.name==='Người 2'); const r=a.artistResults.at(-1); return r ? r.group+':'+(r.has?'CÓ':'KHÔNG CÓ') : 'không có'; })()")
        print("Artist (máy người 2) thấy:", res, "| chủ phòng ghi:", host_res)
        await pg.screenshot(path="/tmp/role_artist.png")
        await F[1].evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
        # ---- Animator ở máy người 3: có người bị gài mà Animator đã biết
        await F[0].evaluate("""(() => { const w=__session.world; const an=w.agents.find(o=>o.name==='Người 3'); const k=w.agents.find(o=>o.role==='impostor'); const v=w.agents.find(o=>!o.human && o.role==='crew' && o.alive);
          v.alive=false; v.killedBy=k.id; w.bodies.push({victim:v.id,x:v.x,y:v.y,room:null,t:w.time}); an.knownDead.push(v.id); window.__victim=v.name; })()"""); await pg.wait_for_timeout(600)
        await F[2].evaluate("__ui.openAnimator()"); await pg.wait_for_timeout(500)
        print("Animator (máy người 3) thấy:", await F[2].evaluate("document.querySelector('.modal')?.innerText.replace(/\\s+/g,' ').slice(0,160) ?? 'không mở'"))
        await pg.screenshot(path="/tmp/role_anim.png")
        for i,f in enumerate(F): print(f"lỗi ô {i+1}:", await f.evaluate("(window.__errs||[]).slice(0,3)"))
        await b.close()
print('=== Phần 7: giao vai qua thanh công cụ; Artist so màu và Animator ở máy người vào phòng ==='); asyncio.run(main7())

THROTTLE8 = """(() => { const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => st(f, (ms||0) + 60000, ...a); window.requestAnimationFrame = () => 0;
  Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); })()"""
async def main8():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu","--disable-webgl"])
        ctx = await b.new_context(viewport={"width":1500,"height":900}); pg = await ctx.new_page()
        await pg.goto("http://localhost:8765/index.html?multitest=3"); await pg.wait_for_timeout(9000)
        F = lambda: sorted([f for f in pg.frames if 'mt=' in f.url], key=lambda f: f.url)
        await pg.select_option(".mt-roles select[data-name='Người 2']", "climber"); await pg.wait_for_timeout(300)
        await pg.click(".mt-bar button[data-c='start']"); await pg.wait_for_timeout(3000)
        await pg.click(".mt-bar button[data-c='ready']"); await pg.wait_for_timeout(8000)
        fr = F()
        for f in fr: await f.evaluate("window.addEventListener('error', e => (window.__errs ||= []).push(e.message))")
        # ---- 1. họp, người 3 tải lại trang giữa họp
        await pg.click(".mt-bar button[data-c='meeting']"); await pg.wait_for_timeout(3500)
        await fr[2].evaluate("location.reload()"); await pg.wait_for_timeout(6000)
        fr = F()
        print("1. người 3 vào lại giữa họp: phase =", await fr[2].evaluate("__session.world?.phase"), "| phòng họp mở:", await fr[2].evaluate("!!document.querySelector('.meet')"))
        # ---- 3. Intern tham vọng (người 2) tố cáo ẩn danh, xem ở người 3
        await fr[1].evaluate("(async () => { const w=__session.world; const t=w.agents.find(o=>o.alive && o.id!==w.player.id).id; await __net.client.sendActWait('anonAccuse',[t]); })()"); await pg.wait_for_timeout(1500)
        print("3. tin ẩn danh ở người 3: có =", await fr[2].evaluate("!!document.querySelector('.chat-log .msg.anon')"), "| bị hiện như tin của mình (.me):", await fr[2].evaluate("!!document.querySelector('.chat-log .msg.anon.me')"))
        # ---- 2. chủ phòng ẩn tab (hẹn giờ bị hãm thêm 60 giây, vòng lặp vẽ dừng); tua cuộc họp tới kết quả
        await fr[0].evaluate(THROTTLE8)
        await fr[0].evaluate("(() => { const m=__session.world.meeting; m.t = m.duration - 0.2; })()")
        for t in range(14):
            await pg.wait_for_timeout(1000)
            ph = await fr[0].evaluate("__session.world.phase")
            if ph == 'play': break
        print(f"2. chủ phòng ở tab ẩn: sau {t+1} giây cuộc họp kết thúc? phase chủ phòng = {ph} | người 2 thấy phase =", await fr[1].evaluate("__session.world.phase"))
        for i,f in enumerate(F()): print(f"lỗi ô {i+1}:", await f.evaluate("(window.__errs||[]).slice(0,3)"))
        await b.close()
print('=== Phần 8: vào lại giữa họp, tin ẩn danh, chủ phòng ở tab ẩn (hẹn giờ bị hãm) vẫn kết thúc họp ==='); asyncio.run(main8())
