import Phaser from 'phaser';
import './style.css';
import { GameScene } from './scenes/GameScene';
import { UI } from './ui/ui';

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
