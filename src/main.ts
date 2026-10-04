import Phaser from 'phaser';
import './style.css';
import { GameScene } from './scenes/GameScene';
import { LobbyScene } from './scenes/LobbyScene';
import { UI, MT_SLOT } from './ui/ui';
import { sfx } from './audio';
import { session } from './session';
import { characterCanvas } from './render/chars';

import { applyStartupContent } from './content/registry';
import { openContentTool } from './content/tool';
import { startEmojify } from './ui/emojify';

// Công cụ nội dung: thêm ?content vào địa chỉ
const contentMode = new URLSearchParams(location.search).has('content');
// Áp dụng nội dung chính thức (file Excel trên GitHub) và bản thử trên máy, trước khi dựng game
const contentInfo = applyStartupContent();
session.contentTest = contentInfo.test;

// Thử nhiều người chơi trên một màn hình: thêm ?multitest=4 vào địa chỉ (2–6 ô)
const multiN = Math.max(0, Math.min(6, Number(new URLSearchParams(location.search).get('multitest') ?? 0)));
// Phòng thử mini-game: thêm ?minigames vào địa chỉ
const labMode = new URLSearchParams(location.search).has('minigames');
if (contentMode) {
  document.getElementById('game')!.style.display = 'none';
  openContentTool(document.getElementById('ui')!);
} else if (labMode) {
  document.getElementById('game')!.style.display = 'none';
  startEmojify(document.getElementById('ui')!);
  startEmojify(document.body);
  void import('./devtools/minigame-lab').then(m => m.openMinigameLab(document.getElementById('ui')!));
} else if (multiN) {
  document.getElementById('game')!.style.display = 'none';
  void import('./devtools/multitest').then(m => m.openMultitest(document.getElementById('ui')!, multiN));
} else startGame();

function startGame() {
session.phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#191a2e',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60 },
  scene: [LobbyScene, GameScene], // sảnh tầng G chạy trước, văn phòng bật khi vào ca
});

startEmojify(document.getElementById('ui')!);
// Hiệu ứng mở popup chỉ chạy một lần: popup tự dựng lại nội dung bên trong thì khung không nảy lại
document.addEventListener('animationend', (e) => {
  const t = e.target as HTMLElement;
  if (t.classList?.contains('sheet')) t.closest('.modal')?.classList.add('shown');
}, true);
const ui = new UI(document.getElementById('ui')!);
if (location.search.includes('debug') || MT_SLOT) (window as any).__ui = ui;
// Một ô trong màn chia ô (?multitest): nhận lệnh từ thanh công cụ, báo khi được chọn; chỉ ô đang chọn phát âm thanh
if (MT_SLOT && window.parent !== window) {
  (window as any).__session = session;
  void import('./net/room').then(m => { (window as any).__net = m.net; });
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data as { mt?: string; cmd?: string; arg?: number };
    if (d?.mt === 'cmd' && d.cmd) ui.mtCommand(d.cmd, d.arg);
  });
  const report = (on: boolean) => { sfx.setMuted(!on); window.parent.postMessage({ mt: 'focus', slot: Number(MT_SLOT), on }, location.origin); };
  window.addEventListener('focus', () => report(true));
  window.addEventListener('blur', () => report(false));
  sfx.setMuted(!document.hasFocus());
  // báo trạng thái cho thanh công cụ
  window.setInterval(() => {
    const w = session.world;
    window.parent.postMessage({ mt: 'state', slot: Number(MT_SLOT), phase: w?.phase ?? 'room', role: w ? (w.player.role === 'impostor' ? 'Nội gián' : w.player.dept ?? '') : '', alive: w ? w.player.alive : true }, location.origin);
  }, 700);
}
}

// Công cụ gỡ lỗi: thêm ?debug vào địa chỉ để truy cập trạng thái game từ console
if (location.search.includes('debug')) { (window as any).__session = session; (window as any).__charCanvas = characterCanvas; void import('./net/room').then(m => { (window as any).__net = m.net; }); }
