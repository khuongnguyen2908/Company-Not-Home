import Phaser from 'phaser';
import './style.css';
import { GameScene } from './scenes/GameScene';
import { LobbyScene } from './scenes/LobbyScene';
import { UI } from './ui/ui';
import { session } from './session';
import { characterCanvas } from './render/chars';

import { applyStartupContent } from './content/registry';
import { openContentTool } from './content/tool';

// Công cụ nội dung: thêm ?content vào địa chỉ
const contentMode = new URLSearchParams(location.search).has('content');
// Áp dụng nội dung chính thức (file Excel trên GitHub) và bản thử trên máy, trước khi dựng game
const contentInfo = applyStartupContent();
session.contentTest = contentInfo.test;

if (contentMode) {
  document.getElementById('game')!.style.display = 'none';
  openContentTool(document.getElementById('ui')!);
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

new UI(document.getElementById('ui')!);
}

// Công cụ gỡ lỗi: thêm ?debug vào địa chỉ để truy cập trạng thái game từ console
if (location.search.includes('debug')) { (window as any).__session = session; (window as any).__charCanvas = characterCanvas; }
