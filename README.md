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

## Sửa nội dung (không cần đụng code)

Mọi câu chữ trong game (tên vai, luật vai, tên việc, mini-game, tên phòng, trang phục, lời thoại bot, thông báo, danh sách tên...) đều sửa được bằng **Công cụ nội dung**:

1. Mở game với `?content` ở cuối địa chỉ.
2. **Xuất Excel** → mở trên Google Sheets → sửa cột "Nội dung" → tải về `.xlsx`.
3. **Nhập Excel**: công cụ kiểm tra lỗi (câu quá dài, thiếu chỗ trống `{tên}`, danh sách trống...). Sửa trực tiếp trong công cụ cũng được.
4. **Thử trong game**: chạy ngay trên máy bạn (màn hình chính hiện "🧪 Đang chạy nội dung thử").
5. **Tải file cho GitHub** → đưa `content.xlsx` vào thư mục `content/` → GitHub tự build lại.

Bước build (`scripts/content-build.mjs`) đọc `content/content.xlsx` thành `src/content/overrides.json`. Không có file thì dùng nội dung mặc định.

## Cân bằng (bản đồ 3 tầng)

Hồi chiêu gài bẫy tự chỉnh theo số người và số Nội gián (`killCooldownFor` trong `sim.ts`). Ván 6 người trở xuống chỉ có 1 Nội gián. Mỗi người nhận việc ở 2 tầng liền kề (việc chấm công vẫn ở Lễ tân tầng 1). Kiểm chứng bằng 150 ván bot mỗi cỡ (`tests/balance.ts`):

| Số người | Nội gián | Hồi chiêu | Nội gián thắng |
|---|---|---|---|
| 5 | 1 | 55s | 53% |
| 6 | 1 | 36s | 49% |
| 7 | 1 | 28s | 41% |
| 7 | 2 | 120s | 54% |
| 8 | 1 | 20s | 39% |
| 8 | 2 | 82s | 45% |
| 9 | 1 | 16s | 47% |
| 9 | 2 | 62s | 42% |
| 10 | 1 | 12s | 33% |
| 10 | 2 | 50s | 55% |

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
