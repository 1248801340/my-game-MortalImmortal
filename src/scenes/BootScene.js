import Phaser from 'phaser';
import { ASSET_PATHS } from '../utils/constants.js';
import { removeCheckerBackground, measureAlphaBounds, trimToAlpha } from '../utils/helpers.js';

const W = 960, H = 540;

// ★ 敌人精灵预缩放目标高度 —— 必须与 Enemy 里默认 spriteHeight(72) 一致 → scale=1 → body 对齐
const ENEMY_SPRITE_H = 72;

const BG_FILES = {
  level_bg1: '../assets/images/bg/level_bg1.png',
  level_bg2: '../assets/images/bg/level_bg2.png',
};

const ROLE_FILES = {
  // 血煞
  xuesha_idle:   '../assets/images/role/xuesha_idle-remove-bg-io.png',
  xuesha_attack: '../assets/images/role/xuesha_attack-remove-bg-io.png',
  xuesha_skill:  '../assets/images/role/xuesha_skill-remove-bg-io.png',   // 死亡帧
  // ★ 墨老（第二关 Boss，同结构 idle/attack/skill 透明 PNG）
  molao_idle:    '../assets/images/role/molao_idle-remove-bg-io.png',
  molao_attack:  '../assets/images/role/molao_attack-remove-bg-io.png',
  molao_skill:   '../assets/images/role/molao_skill-remove-bg-io.png',
};

const FALLBACK_PAL = {
  level_bg1: { top: 0x6fa8d8, mid: 0x3a6ea5, mount: 0x2f4a7a, mount2: 0x243a63, fore: 0x10243f, accent: 0xfde68a },
  level_bg2: { top: 0x241a4a, mid: 0x3a2a6e, mount: 0x1c1340, mount2: 0x140d30, fore: 0x0a0820, accent: 0xc4b5fd },
};
const DEFAULT_PAL = { top: 0x3a6ea5, mid: 0x2f6d57, mount: 0x28375f, mount2: 0x1d2c4a, fore: 0x0c1a30, accent: 0xbae6fd };
const hex = n => '#' + n.toString(16).padStart(6, '0');

function makePlayerFallback(key) {
  const c = document.createElement('canvas'); c.width = 48; c.height = 90;
  const x = c.getContext('2d');
  x.fillStyle = '#22d3ee'; x.fillRect(8, 30, 32, 52);
  x.beginPath(); x.arc(24, 20, 14, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#0f172a';
  x.beginPath(); x.arc(19, 18, 2.5, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(29, 18, 2.5, 0, Math.PI * 2); x.fill();
  if (key.endsWith('_attack')) { x.strokeStyle = '#fbbf24'; x.lineWidth = 4; x.beginPath(); x.moveTo(34, 42); x.lineTo(48, 24); x.stroke(); }
  else if (key.endsWith('_skill')) { x.fillStyle = '#64748b'; x.fillRect(6, 70, 36, 12); }
  return c;
}

function coverCanvas(img) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = Math.max(W / iw, H / ih);
  const dw = iw * s, dh = ih * s;
  x.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return c;
}

function makeBgFallback(key) {
  const p = FALLBACK_PAL[key] || DEFAULT_PAL;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, hex(p.top)); sky.addColorStop(0.55, hex(p.mid)); sky.addColorStop(1, hex(p.fore));
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  x.fillStyle = hex(p.mount); x.beginPath(); x.moveTo(0, 360); x.lineTo(300, 150); x.lineTo(600, 360); x.closePath(); x.fill();
  x.fillStyle = hex(p.mount2); x.beginPath(); x.moveTo(360, 380); x.lineTo(700, 120); x.lineTo(W, 380); x.closePath(); x.fill();
  x.strokeStyle = hex(p.accent); x.globalAlpha = 0.5; x.lineWidth = 2;
  x.beginPath(); x.moveTo(300, 150); x.lineTo(430, 250); x.stroke();
  x.beginPath(); x.moveTo(700, 120); x.lineTo(820, 230); x.stroke();
  x.globalAlpha = 1; x.fillStyle = hex(p.fore); x.fillRect(0, 430, W, H - 430);
  return c;
}

function scaleCanvasToHeight(src, h) {
  const sw = src.width, sh = src.height;
  if (sh === 0) return src;
  const w = Math.max(1, Math.round(sw * h / sh));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, w, h);
  return c;
}

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this.add.text(W / 2, H / 2, '加载立绘 / 背景 / 怪物中...', { fontSize: '18px', fill: '#e2e8f0' }).setOrigin(0.5);
  }

  create() {
    const ge = this.add.graphics();
    ge.fillStyle(0xffffff, 1); ge.fillRoundedRect(0, 0, 36, 48, 4);
    ge.fillStyle(0x888888, 1); ge.fillCircle(13, 16, 3); ge.fillCircle(23, 16, 3);
    ge.generateTexture('enemy_placeholder', 36, 48); ge.destroy();

    const gb = this.add.graphics();
    gb.fillStyle(0xffffff, 1); gb.fillRoundedRect(0, 0, 64, 80, 6);
    gb.fillStyle(0x888888, 1); gb.fillCircle(22, 26, 5); gb.fillCircle(42, 26, 5); gb.fillRect(20, 52, 24, 4);
    gb.generateTexture('boss_placeholder', 64, 80); gb.destroy();

    // 血煞能量波（红）
    const gw = this.add.graphics();
    gw.fillGradientStyle(0x7f1d1d, 0xef4444, 0x7f1d1d, 0xef4444, 0, 0.85, 0, 0.85);
    gw.fillRect(0, 5, 28, 6);
    gw.fillStyle(0xef4444, 1); gw.fillCircle(30, 8, 7);
    gw.fillStyle(0xfca5a5, 1); gw.fillCircle(30, 8, 4);
    gw.fillStyle(0xffffff, 1); gw.fillCircle(30, 8, 2);
    gw.generateTexture('xuesha_wave', 40, 16); gw.destroy();

    // ★ 墨老平 A 波（深紫墨气，与血煞红波区分 → 体现"伤害很高"的压迫感）
    const gmw = this.add.graphics();
    gmw.fillGradientStyle(0x1e1b4b, 0x7c3aed, 0x1e1b4b, 0x7c3aed, 0, 0.9, 0, 0.9);
    gmw.fillRect(0, 5, 32, 8);
    gmw.fillStyle(0xa78bfa, 1); gmw.fillCircle(34, 9, 8);
    gmw.fillStyle(0xede9fe, 1); gmw.fillCircle(34, 9, 4);
    gmw.fillStyle(0xffffff, 1); gmw.fillCircle(34, 9, 2);
    gmw.generateTexture('molao_wave', 44, 18); gmw.destroy();

    // ★ 墨老技能：银色手掌纹理（掌心 + 五指 + 拇指 + 银白高光）
    const gmp = this.add.graphics();
    gmp.fillStyle(0xc8ccd2, 1);                                   // 掌心
    gmp.fillRoundedRect(8, 18, 20, 22, 6);
    gmp.fillStyle(0xd8dde3, 1);                                   // 五指（参差）
    gmp.fillRoundedRect(9,  4, 4, 16, 2);
    gmp.fillRoundedRect(15, 2, 4, 18, 2);
    gmp.fillRoundedRect(21, 4, 4, 16, 2);
    gmp.fillRoundedRect(27, 7, 4, 13, 2);
    gmp.fillRoundedRect(2, 20, 6, 12, 3);                         // 拇指
    gmp.lineStyle(2, 0xffffff, 0.9);                              // 银白描边
    gmp.strokeRoundedRect(8, 18, 20, 22, 6);
    gmp.fillStyle(0xffffff, 0.7); gmp.fillCircle(18, 28, 4);      // 掌心高光
    gmp.generateTexture('molao_palm', 36, 44); gmp.destroy();

    const tasks = [
      // 韩立：保持原样（继续去背、不预缩放）——绝不动
      { key: 'player_idle',   src: ASSET_PATHS.player_idle,   kind: 'sprite' },
      { key: 'player_attack', src: ASSET_PATHS.player_attack, kind: 'sprite' },
      { key: 'player_skill',  src: ASSET_PATHS.player_skill,  kind: 'sprite' },
      { key: 'level_bg1',     src: BG_FILES.level_bg1,        kind: 'bg' },
      { key: 'level_bg2',     src: BG_FILES.level_bg2,        kind: 'bg' },
      // 血煞：checker:false + fixedH
      { key: 'xuesha_idle',   src: ROLE_FILES.xuesha_idle,    kind: 'sprite', checker: false, fixedH: ENEMY_SPRITE_H },
      { key: 'xuesha_attack', src: ROLE_FILES.xuesha_attack,  kind: 'sprite', checker: false, fixedH: ENEMY_SPRITE_H },
      { key: 'xuesha_skill',  src: ROLE_FILES.xuesha_skill,   kind: 'sprite', checker: false, fixedH: ENEMY_SPRITE_H },
      // ★ 墨老：与血煞同待遇（跳过去背 + 预缩放到72）
      { key: 'molao_idle',    src: ROLE_FILES.molao_idle,     kind: 'sprite', checker: false, fixedH: ENEMY_SPRITE_H },
      { key: 'molao_attack',  src: ROLE_FILES.molao_attack,   kind: 'sprite', checker: false, fixedH: ENEMY_SPRITE_H },
      { key: 'molao_skill',   src: ROLE_FILES.molao_skill,    kind: 'sprite', checker: false, fixedH: ENEMY_SPRITE_H },
    ];

    const results = {};
    let done = 0;
    const finish = () => {
      tasks.forEach(t => { if (results[t.key] && !this.textures.exists(t.key)) this.textures.addImage(t.key, results[t.key]); });
      // ★ 验证 log：F12 应见 molao_* 全 true（证明墨老模型+波+手掌都注册成功；嫌吵可删这行）
      ['molao_idle', 'molao_attack', 'molao_skill', 'molao_wave', 'molao_palm']
        .forEach(k => console.log('[Boot]', k, this.textures.exists(k)));
      this.scene.start('StartScene');
    };
    const tick = () => { if (++done === tasks.length) finish(); };

    tasks.forEach(t => {
      const img = new Image();
      img.onload = () => {
        try {
          if (t.kind === 'bg') {
            results[t.key] = coverCanvas(img);
          } else {
            const nw = img.naturalWidth, nh = img.naturalHeight;
            const s = Math.min(1, 512 / Math.max(nw, nh));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(nw * s)); c.height = Math.max(1, Math.round(nh * s));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);

            if (t.checker !== false) {
              try { removeCheckerBackground(c); } catch (e) { console.warn('抠图跳过：', e); }
            }

            const raw = document.createElement('canvas'); raw.width = c.width; raw.height = c.height;
            raw.getContext('2d').drawImage(c, 0, 0);

            let trimmed = null;
            try { trimmed = trimToAlpha(c); } catch (e) { console.warn('trim 跳过：', e); }
            let out = (trimmed && trimmed.width >= 8 && trimmed.height >= 8) ? trimmed : raw;

            if (t.fixedH) out = scaleCanvasToHeight(out, t.fixedH);

            results[t.key] = out;
          }
        } catch (e) {
          console.warn('资源处理异常，用兜底：', t.key, e);
          results[t.key] = t.kind === 'bg' ? makeBgFallback(t.key) : makePlayerFallback(t.key);
        } finally { tick(); }
      };
      img.onerror = () => {
        console.error('资源加载失败（路径可能不对，已用兜底）：', t.src);
        results[t.key] = t.kind === 'bg' ? makeBgFallback(t.key) : makePlayerFallback(t.key);
        tick();
      };
      img.src = t.src;
    });
  }
}