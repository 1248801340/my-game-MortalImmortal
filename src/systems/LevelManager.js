import Phaser from 'phaser';
import { GAME_CONFIG } from '../utils/constants.js';
import Boss from '../entities/Boss.js';

const PAL_WARM   = { top: 0x6fa8d8, mid: 0x3a6ea5, mount: 0x2f4a7a, mount2: 0x243a63, fore: 0x10243f, accent: 0xfde68a, motes: [0xfde68a, 0xa5f3fc, 0xbae6fd] };
const PAL_NIGHT  = { top: 0x241a4a, mid: 0x3a2a6e, mount: 0x1c1340, mount2: 0x140d30, fore: 0x0a0820, accent: 0xc4b5fd, motes: [0xc4b5fd, 0xa5f3fc, 0xffffff] };
const PAL_BLOOD  = { top: 0x3a0d12, mid: 0x5c1418, mount: 0x2a0a0e, mount2: 0x1d0709, fore: 0x120406, accent: 0xf87171, motes: [0xf87171, 0xfca5a5, 0xfde68a] };
const PAL_SPIDER = { top: 0x1a0d2e, mid: 0x2d1450, mount: 0x150a26, mount2: 0x0d0618, fore: 0x08040f, accent: 0xa78bfa, motes: [0xa78bfa, 0xc4b5fd, 0x67e8f9] };

const LEVEL_DATA = [
  {
    name: '第一关 · 黄枫谷', bg: 'level_bg1', palette: PAL_WARM,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 300, y: 400, w: 150, h: 16 }, { x: 580, y: 360, w: 180, h: 16 }, { x: 830, y: 400, w: 130, h: 16 } ],
    enemies: [
      { x: 350, y: 460, hp: 100, speed: 60, color: 0x6b7280, name: '低阶弟子',   sprite: 'xuesha', ranged: true },
      { x: 580, y: 340, hp: 120, speed: 55, color: 0x6b7280, name: '低阶弟子',   sprite: 'xuesha', ranged: true, surfaceY: 352 },
      { x: 750, y: 460, hp: 140, speed: 70, color: 0x9ca3af, name: '黄枫谷守卫', sprite: 'xuesha', ranged: true },
    ],
    spawn: { x: 80, y: 480 }, isBoss: false,
  },
  {
    name: 'BOSS · 墨老', bg: 'level_bg1', palette: PAL_WARM,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 250, y: 380, w: 140, h: 16 }, { x: 700, y: 380, w: 140, h: 16 } ],
    enemies: [],
    // ★ 墨老：sprite + 行为字段（Boss 现在会读）
    boss: {
      x: 700, y: 460, name: '墨老', hp: 8000, speed: 55, damage: 18, color: 0x4b5563, treasure: 'golden_brick',
      sprite: 'molao', boss: true, ranged: true,
      maxRange: 380, attackCooldown: 1800,
      waveSpeed: 320, waveDamage: 18,                       // 平 A 高伤波
      skillCooldown: 3000, palmSpeed: 300, palmDamage: 28,  // 每 3s 银色手掌
    },
    spawn: { x: 80, y: 480 }, isBoss: true,
  },
  {
    name: '第二关 · 乱星海', bg: 'level_bg2', palette: PAL_NIGHT,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 200, y: 400, w: 130, h: 16 }, { x: 450, y: 350, w: 160, h: 16 }, { x: 720, y: 400, w: 130, h: 16 }, { x: 900, y: 340, w: 110, h: 16 } ],
    enemies: [
      { x: 300, y: 460, hp: 160, speed: 85, color: 0x0ea5e9, name: '海兽' },
      { x: 450, y: 330, hp: 180, speed: 75, color: 0x0ea5e9, name: '海兽', surfaceY: 342 },
      { x: 700, y: 460, hp: 200, speed: 90, color: 0x06b6d4, name: '深海蛟蛇' },
      { x: 900, y: 320, hp: 220, speed: 80, color: 0x06b6d4, name: '深海蛟蛇', surfaceY: 332 },
    ],
    spawn: { x: 60, y: 480 }, isBoss: false,
  },
  {
    name: 'BOSS · 墨蛟', bg: 'level_bg2', palette: PAL_NIGHT,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 200, y: 370, w: 130, h: 16 }, { x: 480, y: 330, w: 160, h: 16 }, { x: 760, y: 370, w: 130, h: 16 } ],
    enemies: [],
    boss: { x: 750, y: 460, name: '墨蛟', hp: 1200, speed: 65, damage: 22, color: 0x1d4ed8, treasure: 'jiao_armor' },
    spawn: { x: 80, y: 480 }, isBoss: true,
  },
  {
    name: '第三关 · 血煞教', bg: null, palette: PAL_BLOOD,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 250, y: 390, w: 130, h: 16 }, { x: 500, y: 340, w: 150, h: 16 }, { x: 750, y: 390, w: 130, h: 16 } ],
    enemies: [
      { x: 300, y: 460, hp: 220, speed: 95, color: 0xdc2626, name: '血煞弟子' },
      { x: 500, y: 320, hp: 250, speed: 85, color: 0xdc2626, name: '血煞弟子', surfaceY: 332 },
      { x: 700, y: 460, hp: 280, speed: 90, color: 0x991b1b, name: '血煞护法' },
      { x: 880, y: 460, hp: 300, speed: 90, color: 0x991b1b, name: '血煞护法' },
    ],
    spawn: { x: 60, y: 480 }, isBoss: false,
  },
  {
    name: 'BOSS · 血煞教教主', bg: null, palette: PAL_BLOOD,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 300, y: 370, w: 140, h: 16 }, { x: 660, y: 370, w: 140, h: 16 } ],
    enemies: [],
    boss: { x: 750, y: 460, name: '血煞教教主', hp: 1600, speed: 70, damage: 28, color: 0x7f1d1d, treasure: 'blood_pearl' },
    spawn: { x: 80, y: 480 }, isBoss: true,
  },
  {
    name: '第四关 · 蜘蛛巢穴', bg: null, palette: PAL_SPIDER,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 200, y: 400, w: 120, h: 16 }, { x: 420, y: 350, w: 140, h: 16 }, { x: 640, y: 400, w: 120, h: 16 }, { x: 850, y: 340, w: 120, h: 16 } ],
    enemies: [
      { x: 280, y: 460, hp: 280, speed: 105, color: 0x7c3aed, name: '毒蛛' },
      { x: 420, y: 330, hp: 300, speed: 95, color: 0x7c3aed, name: '毒蛛', surfaceY: 342 },
      { x: 680, y: 460, hp: 340, speed: 95, color: 0x6d28d9, name: '蛛后护卫' },
      { x: 850, y: 320, hp: 360, speed: 90, color: 0x6d28d9, name: '蛛后护卫', surfaceY: 332 },
    ],
    spawn: { x: 60, y: 480 }, isBoss: false,
  },
  {
    name: '最终BOSS · 血玉蜘蛛', bg: null, palette: PAL_SPIDER,
    ground: { top: 480, height: 60 },
    platforms: [ { x: 250, y: 370, w: 130, h: 16 }, { x: 480, y: 320, w: 160, h: 16 }, { x: 720, y: 370, w: 130, h: 16 } ],
    enemies: [],
    boss: { x: 750, y: 460, name: '血玉蜘蛛', hp: 2400, speed: 75, damage: 32, color: 0x581c87, treasure: 'spider_silk' },
    spawn: { x: 80, y: 480 }, isBoss: true,
  },
];

export default class LevelManager {
  build(scene, levelIndex) {
    const idx = levelIndex % LEVEL_DATA.length;
    const data = LEVEL_DATA[idx];
    const groundTop = data.ground.top;

    const solids = scene.physics.add.staticGroup();
    scene.enemies = scene.physics.add.group();

    const g = data.ground;
    const ground = scene.add.rectangle(GAME_CONFIG.width / 2, g.top + g.height / 2, GAME_CONFIG.width * 2, g.height, 0x3f2d1a);
    solids.add(ground);

    (data.platforms || []).forEach(p => {
      const plat = scene.add.rectangle(p.x, p.y, p.w, p.h, 0x5c4033);
      plat.setStrokeStyle(1, 0x8d6e63);
      solids.add(plat);
    });

    (data.enemies || []).forEach(e => {
      const enemy = scene.makeEnemy(e.x, e.y, {
        hp: e.hp, speed: e.speed, color: e.color, name: e.name,
        sprite: e.sprite, ranged: e.ranged,
      });
      scene.enemies.add(enemy);
      this.snapToGround(enemy, e.surfaceY || groundTop);
    });

    if (data.boss) {
      const b = data.boss;
      const { x, y, ...bossCfg } = b;                 // ★ 解构透传：sprite/行为字段全送进 Boss
      const boss = new Boss(scene, x, y, bossCfg);
      scene.enemies.add(boss);
      this.snapToGround(boss, groundTop);
    }

    return { solids, spawn: data.spawn, name: data.name, bg: data.bg, palette: data.palette };
  }

  snapToGround(obj, surfaceY) {
    const y = surfaceY - obj.displayHeight / 2;
    obj.y = y;
    if (obj.body) { obj.body.reset(obj.x, y); obj.body.setVelocity(0, 0); }
  }

  isBossLevel(levelIndex) {
    const idx = levelIndex % LEVEL_DATA.length;
    return LEVEL_DATA[idx].isBoss;
  }
}