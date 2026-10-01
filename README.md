# Nội Gián Văn Phòng

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

## Điều khiển

WASD hoặc phím mũi tên để đi. E làm việc, R báo cáo ghế trống, Q gài bẫy (Nội gián), F phá hoại, Space trốn, M xem sơ đồ. Trên điện thoại có cần điều khiển ảo ở góc trái.

## Cấu trúc mã nguồn

```
src/
├── game/        Luật chơi thuần TypeScript, không phụ thuộc Phaser
│   ├── map.ts   Bản đồ, phòng, đồ đạc, điểm làm việc, chỗ trốn
│   ├── path.ts  Tìm đường cho bot
│   ├── sim.ts   Mô phỏng: di chuyển, AI bot, gài bẫy, phá hoại, họp, vote, điều kiện thắng
│   └── data.ts  Phòng ban, tên, lời thoại
├── render/chars.ts   Vẽ nhân vật và texture bằng canvas
├── scenes/GameScene.ts  Hiển thị bản đồ, nhân vật, tầm nhìn bằng Phaser
├── ui/          Giao diện HTML: sảnh, HUD, mini-game, phòng họp
└── audio.ts     Âm thanh tổng hợp bằng Web Audio
tests/simulate.ts  Chạy hàng loạt ván toàn bot
```

Phần `src/game` được tách riêng để bước tiếp theo (nhiều người chơi qua mạng) có thể chạy nguyên khối luật chơi này trên máy của người tạo phòng.
