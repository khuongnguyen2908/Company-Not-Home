import Phaser from 'phaser';
import './style.css';
import { GameScene } from './scenes/GameScene';
import { LobbyScene } from './scenes/LobbyScene';
import { UI } from './ui/ui';
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
if (location.search.includes('debug')) (window as any).__ui = ui;
}

// Công cụ gỡ lỗi: thêm ?debug vào địa chỉ để truy cập trạng thái game từ console
if (location.search.includes('debug')) { (window as any).__session = session; (window as any).__charCanvas = characterCanvas; }
