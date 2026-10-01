import Phaser from 'phaser';
import './style.css';
import { GameScene } from './scenes/GameScene';
import { UI } from './ui/ui';
import { session } from './session';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#191a2e',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60 },
  scene: [GameScene],
});

new UI(document.getElementById('ui')!);

// Công cụ gỡ lỗi: thêm ?debug vào địa chỉ để truy cập trạng thái game từ console
if (location.search.includes('debug')) (window as any).__session = session;
