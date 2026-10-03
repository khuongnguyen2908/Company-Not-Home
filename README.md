# Văn Phòng Hạnh Phúc (có rắn)

Game suy luận xã hội lấy bối cảnh công sở: nhân viên chạy KPI, nội gián gài bẫy đồng nghiệp bị đuổi việc, và cả văn phòng họp khẩn để vote sa thải kẻ đáng ngờ. Phiên bản này chơi một mình với các đồng nghiệp là bot.

Làm bằng Vite + TypeScript + Phaser 3. Toàn bộ hình ảnh và âm thanh được tạo bằng code (canvas và Web Audio API), không có file asset nào. Thành tích lưu trong localStorage của trình duyệt.

## Chạy trên máy

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev        # mở http://localhost:5173
npm run build      # tạo thư mục dist/ để deploy
npm run sim        # chạy thử 60 ván toàn bot để kiểm tra luật chơi
```

## Đưa lên mạng

**GitHub Pages:** đẩy code lên nhánh `main`, vào Settings → Pages, chọn Source là "GitHub Actions". File `.github/workflows/deploy.yml` sẽ tự build và đăng game mỗi lần bạn đẩy code. Địa chỉ có dạng `https://ten-ban.github.io/ten-repo/`.

**Vercel:** import repo trên vercel.com, Vercel tự nhận ra Vite, không cần cấu hình.

## Luồng màn hình

1. **Màn hình chính:** nhập tên (hoặc bấm xí ngầu), chọn Chơi offline. Chơi online sẽ có ở đợt sau.
2. **Sảnh tầng G:** đi lại tự do cùng đồng nghiệp bot. **Máy thay đồ** (góc phải) để đổi ngoại hình, **bảng thông báo** (góc trái) để chỉnh luật ván, đi vào **thang máy** hoặc bấm nút để bắt đầu ca.
3. **Văn phòng tầng 7:** ván chơi. Hết ván hoặc rời ca thì quay về sảnh tầng G.

## Đồ đạc (góc nhìn 3/4)

Mọi đồ đạc ở văn phòng và sảnh vẽ chung một bộ (`src/render/furniture.ts`): mặt trên sáng, mặt trước tối, bóng đổ, vệt sáng. Mỗi món là một vật thể riêng, thứ tự che khuất theo mép dưới chân đế (đứng sau tủ thì bị che, đứng trước thì che tủ); sofa và ghế đá xếp theo mép trên để người ngồi nằm trên. Đồ sát tường phía dưới được vẽ thấp. Camera an ninh dùng ảnh nền có vẽ phẳng đủ đồ đạc.

Chuyển động theo từng món (chỉ chạy khi món đó trong khung nhìn, đúng tầng): màn hình chạy chữ, đèn server/router nháy, hơi cà phê, bong bóng bình nước, cá bơi, lá cây và hoa đung đưa, quạt điều hòa quay, đèn máy gắp thú chạy vòng, máy quét vân tay quét, Face ID nhấp nháy, máy so màu đổi màu, vòi nước nhỏ giọt, vệt sáng lướt trên gương. Có người làm việc ở máy nào thì máy đó chạy mạnh hơn (máy in nhả giấy, cà phê chảy...). Mất điện: máy cắm điện tắt, màn hình máy tính vẫn sáng dịu (chạy pin).

Xe cộ, mèo, cây ngoài phố và toàn cảnh sảnh vẽ cùng phong cách (`src/render/street.ts`). Người ngồi sofa giữ nguyên dáng, nằm trên lớp ghế.

Kiểm tra: `python3 tests/lobby_reentry.py` (về sảnh nhiều lần vẫn đủ biển), `npx tsx tests/furn_overlap.ts` (phần nhô lên của đồ cao không che lối trốn, chỗ đứng làm việc, cửa thang máy, cửa thoát hiểm).

## Sảnh chờ (tầng G)

- **Ngoài phố:** người chơi xuống xe buýt ở trạm, đi bộ qua vỉa hè vào cửa kính tự động; bot tới bằng xe buýt hoặc taxi. Đường hai làn có xe chạy liên tục.
- **Trong sảnh:** máy thay đồ, máy tính lễ tân (cài đặt phòng), thang máy (bắt đầu ca). Màn hình phòng trên tường, bên phải thang máy.
- **Ngồi** được trên 2 sofa và ghế đá ngoài vỉa hè. **Món nghịch vặt:** chuông lễ tân, mèo văn phòng, cây nước, bể cá, chậu cây, bảng giờ xe buýt.
- **Chat:** bấm Enter (hoặc nút chat) để mở thanh gõ, Enter gửi xong là đóng. Góc trái dưới hiện 4 tin gần nhất rồi tự mờ, bấm vào để xem lịch sử. Tin hiện thành bong bóng trên đầu (tối đa 4 bong bóng đầy đủ, tin mới nằm trên), chống spam 1,5 giây/tin. Bot thỉnh thoảng nói vu vơ và đáp lại khi được nhắc tên.
- **Vào ca:** tới thang máy bấm "Bắt đầu làm việc", mọi người đi vào thang, bảng số tầng chạy G → 1 → 2.

## Bản đồ: tòa văn phòng 3 tầng + sân thượng

| Tầng | Phòng |
|---|---|
| Sân thượng (chỉ thang bộ hoặc ống gió) | Vườn mái, Khu điều hòa |
| Tầng 3: Lãnh đạo và kỹ thuật | Phòng Giám đốc, Phòng HR, Phòng Server, Phòng QA, Studio Art |
| Tầng 2: Làm việc | Phòng làm việc (bàn), Phòng họp (chuông), Pantry, Phòng in ấn |
| Tầng 1: Đón tiếp | Lễ tân, Phòng bảo vệ (camera), Khu giải trí, Kho điện (cầu dao) |

- **Thang bộ:** mỗi tầng có cửa thoát hiểm dẫn vào một giếng thang chung (tối, không camera). Trong giếng, chiếu nghỉ Sân thượng ở trên cùng, Tầng 1 ở dưới cùng; ra ở cửa của tầng muốn tới. Luôn dùng được, khoảng 6 giây mỗi tầng.
- **Thang máy:** một buồng duy nhất chạy tầng 1–3 (1 giây mỗi tầng, cửa đóng 1 giây sau khi bấm tầng), phải gọi thang và chờ như thật, tối đa 4 người. Có sẵn buồng thì nhanh hơn thang bộ khoảng gấp đôi. Mất điện: cửa khóa ngay, ai trong buồng bị nhốt; cạy cửa được sau 20 giây, Engineer mở được từ bên ngoài, có điện lại thì cửa tự mở.
- **Lối trốn:** nắp trần thang máy (chỉ một chiều: từ trong buồng chui ra cửa kỹ thuật ở tầng buồng thang đang đứng), ống cáp Kho điện ↔ Server, ống gió In ấn ↔ Khu điều hòa, gầm bàn Phòng làm việc ↔ Phòng họp, tủ đồ Lễ tân ↔ Khu giải trí, trần thạch cao Giám đốc ↔ QA.
- **Camera:** 4 chiếc, mỗi tầng một chiếc ở hành lang trước lõi thang, sân thượng một chiếc ở cửa thang bộ.
- **Khu giải trí** (tầng 1) có 3 việc: ném phi tiêu xả stress, gắp thú bông tặng sếp, cho cá ăn.
- **Sơ đồ tòa nhà** chia thẻ theo tầng (kèm số việc của bạn ở mỗi tầng); sơ đồ phá hoại của Nội gián cũng chia theo tầng.
- Mũi tên chỉ đường tới sự cố hay ghế trống ở tầng khác sẽ chỉ về thang bộ trước, kèm nhãn tầng đích.

## Sau mỗi cuộc họp

- **Chọn nơi bắt đầu** (kiểu Airship): Phòng họp luôn có, cộng 2 điểm ngẫu nhiên riêng của mỗi người trong 5 điểm còn lại (Lễ tân, Pantry, Hành lang tầng 3, Studio Art, Vườn mái). 10 giây để chọn, hết giờ thì ở lại Phòng họp. Không ai biết ai chọn gì; bot chọn điểm cùng tầng với việc kế tiếp.
- **Hồn ma** chỉ bay xuyên tường trong tầng đang ở; cửa thang bộ và thang máy không có tác dụng với hồn ma; đổi tầng bằng nút Lên/Xuống tầng (PageUp/PageDown); chỉ thấy người cùng tầng.

## Chơi nhiều người

- Màn hình chính → **Chơi nhiều người** → Tạo phòng mới (mã 6 ký tự, ví dụ `KPI-482`, kèm link mời) hoặc nhập mã để vào phòng. Mở link mời (`?room=MÃ`) là vào thẳng phòng.
- **Màn hình phòng:** danh sách người, chủ phòng chỉnh bot điền ghế trống (bật/tắt), số ghế, số Nội gián; tối đa 10 người, ván cần ít nhất 4 người.
- **Chủ phòng chạy game**, người vào phòng gửi điều khiển và nhận trạng thái đã lọc (không lộ vai, phòng ban, việc, hồi chiêu, kết quả kỹ năng của người khác). Tin nhắn của người đã nghỉ việc / bị sa thải chỉ người đã chết đọc được.
- **Sức chứa phòng = số ghế** chủ phòng chọn; đủ ghế thì người mới bị từ chối.
- **Kết nối:** im lặng quá 4 giây là "mất kết nối" (hiện trên danh sách phòng, thẻ tên, cả phòng nhận thông báo); trong ván quá 60 giây thì bot chơi thay hẳn, ở phòng chờ quá 12 giây thì rời phòng. **Tải lại trang hoặc mở lại link trong 60 giây là vào lại đúng nhân vật cũ.** Người vào phòng không nghe thấy chủ phòng 5 giây thì thấy dải báo, 15 giây thì về màn hình chính. Chủ phòng tắt tab thì phòng đóng ngay.
- **Tab bị ẩn:** trình duyệt dừng vòng lặp vẽ của tab ẩn, nên chủ phòng chạy mô phỏng và gửi trạng thái bằng một luồng nền (`src/net/pump.ts`) khi tab của mình bị ẩn; nhịp kiểm tra kết nối cũng chạy ở đó. Chuyển tab thì phím đang giữ được thả ra (nhân vật không trôi).
- **Mã phòng trong ván:** nhãn "Phòng ABC-123" ở góc trên, bấm để sao chép link mời. **Vào lại:** tải lại trang, mở lại link, hoặc bấm nút "Vào lại phòng" ở màn hình chính (hiện trong 10 phút sau khi rời, kể cả đã đóng tab); popup "Đang vào lại phòng làm việc…" trong lúc kết nối. Mất chủ phòng thì có popup đếm ngược.
- **Thử một mình:** mở game với `?multitest=4` (2–6 ô): mỗi ô là một người chơi; thanh công cụ có Bắt đầu ván, Cả phòng sẵn sàng, Gọi họp ngay, Chơi ván mới, Ép một người làm Nội gián. Bấm vào ô nào thì điều khiển người đó.
- Mã nguồn: `src/net/` (truyền tin, ảnh chụp có lọc, cửa lệnh, chủ phòng / người vào phòng), `src/devtools/multitest.ts`.
- Kiểm tra: `npx tsx tests/net_conn_test.ts` (kết nối: sức chứa, tin hồn ma, mất kết nối, vào lại, bot thay, mất chủ phòng), `npx tsx tests/net_test.ts` (mạng giả có độ trễ và mất gói: không lộ bí mật, bản sao khớp chủ phòng, ván kết thúc đúng), `tests/multitest_e2e.py` (trình duyệt thật).
- **Máy khác, mạng khác (P2P):** dùng WebRTC qua PeerJS (`src/net/peer.ts`): chủ phòng đăng ký tên `ngvp-<mã phòng>` trên máy giới thiệu công cộng `0.peerjs.com`, người vào phòng nối tới đó; có máy chuyển tiếp TURN dự phòng của PeerJS cho mạng chặn kết nối thẳng. Chủ phòng nhận người vào qua cả kênh nội bộ (các tab cùng trình duyệt) lẫn P2P; người vào phòng thử kênh nội bộ trước, 1,2 giây không thấy chủ phòng mới bật P2P. Mỗi tin mang mã máy logic nên vào lại đúng nhân vật dù đi đường khác. Mã phòng trùng phòng khác thì tự đổi mã; mất mạng thì báo rõ. Màn chia ô `?multitest` chỉ dùng kênh nội bộ.
- **Thử P2P:** cần chạy trên trang GitHub Pages (link chơi thử trên claude.ai chặn kết nối ra ngoài). Kiểm tra tự động: `npx tsx tests/p2p_test.ts` (PeerJS giả).
- Giai đoạn sau: rà đủ tính năng với nhiều người thật, sảnh chung.

## Phòng thử mini-game

Mở game với `?minigames` ở cuối địa chỉ: danh sách đủ 39 mini-game (việc thường theo tầng, bảo trì, khu giải trí, sân thượng, sửa sự cố, các màn đặc biệt). Mỗi mini-game có nút Chơi thử và Chơi bản Nội gián, tự ghi thời gian chơi, đánh dấu Ổn / Cần sửa kèm ghi chú (lưu trên máy). Nút Sao chép phản hồi / Tải file phản hồi xuất toàn bộ thành văn bản để gửi lại.

## Sửa nội dung (không cần đụng code)

Mọi câu chữ trong game (tên vai, luật vai, tên việc, mini-game, tên phòng, trang phục, lời thoại bot, thông báo, danh sách tên...) đều sửa được bằng **Công cụ nội dung**:

1. Mở game với `?content` ở cuối địa chỉ.
2. **Xuất Excel** → mở trên Google Sheets → sửa cột "Nội dung" → tải về `.xlsx`.
3. **Nhập Excel**: công cụ kiểm tra lỗi (câu quá dài, thiếu chỗ trống `{tên}`, danh sách trống...). Sửa trực tiếp trong công cụ cũng được.
4. **Thử trong game**: chạy ngay trên máy bạn (màn hình chính hiện "🧪 Đang chạy nội dung thử").
5. **Tải file cho GitHub** → đưa `content.xlsx` vào thư mục `content/` → GitHub tự build lại.

Bước build (`scripts/content-build.mjs`) đọc `content/content.xlsx` thành `src/content/overrides.json`. Không có file thì dùng nội dung mặc định.

## Cân bằng (bản đồ 3 tầng)

Tầm nhìn Nhân viên 3,8 ô (Nội gián gấp rưỡi). Hồi chiêu gài bẫy tự chỉnh theo số người và số Nội gián (`killCooldownFor` trong `sim.ts`). Ván 6 người trở xuống chỉ có 1 Nội gián. Mỗi người nhận việc ở 2 tầng liền kề (việc chấm công vẫn ở Lễ tân tầng 1). Kiểm chứng bằng 150 ván bot mỗi cỡ (`tests/balance.ts`):

| Số người | Nội gián | Hồi chiêu | Nội gián thắng (300 ván) |
|---|---|---|---|
| 5 | 1 | 57s | 49% |
| 6 | 1 | 35s | 48% |
| 7 | 1 | 23s | 52% |
| 7 | 2 | 128s | 48% |
| 8 | 1 | 18s | 52% |
| 8 | 2 | 80s | 48% |
| 9 | 1 | 12s | 39% |
| 9 | 2 | 60s | 47% |
| 10 | 1 | 8s | 41% |
| 10 | 2 | 50s | 46% |

9–10 người với 1 Nội gián hơi nghiêng về Nhân viên; không rút hồi chiêu thêm vì ván sẽ bị nén (xem `tests/pace5.ts` để đo nhịp ván). Cỡ này nên chơi 2 Nội gián.

Bot trong mô phỏng làm mỗi việc mất đúng thời gian thật của mini-game đó (bảng `MINI_TIME` trong `src/game/map.ts`, đo bằng phòng thử). Đổi mini-game thì cập nhật số này rồi chạy lại cân bằng. Mỗi người nhận tối đa 1 việc khó (`MINI_DIFF`).

## Phòng ban bí mật

Mỗi ván, hệ thống bốc ngẫu nhiên tối đa N vai có kỹ năng (chỉnh ở máy tính lễ tân) cho Nhân viên. Ai được vai gì chỉ người đó biết; danh sách vai có trong ván thì công khai. Những người còn lại là Thực tập sinh.

| Vai | Kỹ năng | Luật chính |
|---|---|---|
| 🪪 HR | Quét Face ID biết một người là Nhân viên hay Nội gián | 1 lần/ván; mở sau 60 giây hoặc sau cuộc họp đầu; quét 4 giây, máy phát sáng; kết quả về sau 60 giây |
| 👔 Director | Công bố chức vụ trong họp, phiếu tính gấp đôi | Lộ danh tính sau khi công bố |
| 💻 IT | Xem camera bằng laptop ở bất kỳ đâu | 10 giây/lần, hồi chiêu 40 giây; đèn camera đỏ khi đang xem |
| 📣 Product Owner | Gọi họp gấp từ bất kỳ đâu | 1 lần/ván; lộ danh tính; khóa khi Sếp đi tuần |
| 🛡️ Producer | Bí mật bảo lãnh một người trong mỗi cuộc họp | Được tự bảo lãnh; không bảo lãnh cùng người hai cuộc họp liên tiếp |
| 💾 Developer | Đầu ván chọn một người để backup, lần đầu bị gài bẫy thì không chết | Không backup chính mình; gài hụt diễn ra âm thầm |
| 🎨 Artist | Máy so màu ở Studio Art: Nội gián có màu X ở bất kỳ đâu trên người không | Mở sau cuộc họp đầu, cách nhau 2 cuộc họp; 12 nhóm màu |
| 🔊 Sound Engineer | Bị gài bẫy thì loa hú, mọi người thấy mũi tên chỉ tới ghế trống | 10 giây; Nội gián cũng thấy |
| 📊 Admin | Bảng chấm công: ai đang làm, ai vừa bị đuổi việc, ai bị sa thải | Pin 10 giây, hồi chiêu 20 giây, làm xong việc sạc 5 giây; rớt mạng thì không xem được |
| 🔧 Engineer | Dùng 5 cặp chỗ trốn như Nội gián | Tối đa 15 giây mỗi lần, hồi chiêu 30 giây; thêm 2 việc bảo trì chỗ trốn |
| 📸 Truyền thông | Khi thành hồn ma, gửi 1–3 sticker hình cho người sống ở gần | 6 sticker ngẫu nhiên, đổi được (cách 10 giây), gửi cách 10 giây; chỉ người nhận thấy |
| 🎬 Animator | Làm lại anim một người bị gài bẫy: họ sống lại, Animator đổi mạng | 1 lần/ván; không hồi sinh người bị sa thải |
| 🧪 Tester | Gắn test case cho người đứng cạnh 2 giây, họp sau nhận log lộ trình | 1 người mỗi vòng; lộ bước dịch chuyển khi chui chỗ trốn |
| 🧃 Thực tập sinh | Không có kỹ năng | Vai đông nhất |

### Phe thứ ba

| Vai | Mục tiêu | Luật chính |
|---|---|---|
| 🎲 Game Designer | Đầu tàu dự án: bị sa thải trong họp thì dự án sụp đổ, ván kết thúc, chỉ GD thắng | HR quét ra Nhân viên; bị gài bẫy là thua; việc giả; từ 7 người |
| 📈 Intern tham vọng | Sống sót tới khi chỉ còn mình và tối đa 1 người | Biết mặt Nội gián; gài bẫy cả hai phe (35 giây, gài trúng Nội gián thì reset); chui chỗ trốn; 1 lần tố cáo nặc danh; HR quét ra Nội gián; từ 8 người |

## Tầm nhìn và khóa cửa

Tầm nhìn bị tường che như Among Us (bàn ghế không che). Nội gián có thể khóa cửa từng phòng trong 10 giây (trừ Phòng họp, và không khóa được khi Sếp đi tuần); người bị nhốt quẹt thẻ ở cửa để mở sớm.

## Điều khiển

WASD hoặc phím mũi tên để đi. E làm việc, R báo cáo ghế trống, Q gài bẫy (Nội gián), F phá hoại, Space trốn, Tab xem sơ đồ. Trên điện thoại có cần điều khiển ảo ở góc trái.

## Cấu trúc mã nguồn

```
src/
├── game/        Luật chơi thuần TypeScript, không phụ thuộc Phaser
│   ├── map.ts   Bản đồ 13 phòng, đồ đạc, trạm làm việc, danh sách task, chỗ trốn theo cặp, camera
│   ├── path.ts  Tìm đường cho bot
│   ├── sim.ts   Mô phỏng: di chuyển, AI bot, gài bẫy, phá hoại, họp, vote, điều kiện thắng
│   └── data.ts  Phòng ban, tên, lời thoại
├── render/chars.ts   Vẽ nhân vật và texture bằng canvas
├── scenes/GameScene.ts  Hiển thị văn phòng, nhân vật, tầm nhìn bằng Phaser
├── scenes/LobbyScene.ts Sảnh chờ tầng G
├── ui/          Giao diện HTML: sảnh, HUD, mini-game, phòng họp
└── audio.ts     Âm thanh tổng hợp bằng Web Audio
tests/simulate.ts  Chạy hàng loạt ván toàn bot
```

Phần `src/game` được tách riêng để bước tiếp theo (nhiều người chơi qua mạng) có thể chạy nguyên khối luật chơi này trên máy của người tạo phòng.
