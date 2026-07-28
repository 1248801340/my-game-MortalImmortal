import Phaser from 'phaser';
import { GAME_CONFIG } from './utils/constants.js';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import HomeScene from './scenes/HomeScene.js';                 // 新首页：两栏目
import FightSelectScene from './scenes/FightSelectScene.js';   // 人机/双人 选择
import KofFightScene from './scenes/KofFightScene.js';         // 拳皇式格斗

/**
 * 接管原首页：
 * BootScene 加载完会 this.scene.start('StartScene')，
 * 这里用同名 key 的透明场景把它转发到新的两栏目首页 HomeScene，
 * 所以 BootScene 一行都不用改。
 */
class StartRedirectScene extends Phaser.Scene {
  constructor() { super('StartScene'); }
  create() { this.scene.start('Home'); }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  backgroundColor: '#0f172a',
  parent: document.body,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GAME_CONFIG.gravity },
      debug: GAME_CONFIG.debug,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // 注意：BootScene 必须排第一（自动启动）；原 StartScene 不再注册（被 StartRedirectScene 顶替 key）
  scene: [BootScene, StartRedirectScene, HomeScene, FightSelectScene, KofFightScene, GameScene],
};

new Phaser.Game(config);