import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Boss from '../entities/Boss.js';
import LevelManager from '../systems/LevelManager.js';
import UIManager from '../systems/UIManager.js';
import { GAME_CONFIG, REALMS, TREASURES } from '../utils/constants.js';

// ★ 技能特效图路径前缀。与你 BootScene 加载 role 立绘的前缀保持一致（斜杠风格也一致）。
const SKILL_DIR = 'assets/images/skill/';

export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.currentLevel = (data && data.level) || 0;
    this.playerData = (data && data.playerData) || null;
    this.levelCleared = false;
  }

  preload() {
    if (!this.textures.exists('hanliskill_sheet'))
      this.load.image('hanliskill_sheet', SKILL_DIR + 'hanliskill-remove-bg-io.png');
    if (!this.textures.exists('molaoskill_sheet'))
      this.load.image('molaoskill_sheet', SKILL_DIR + 'molaoskill-remove-bg-io.png');
  }

  create() {
    this.setupSkillFx();   // ★ 自适应切帧 + 建动画（必须在 build 之前）

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.keys = {
      J: this.input.keyboard.addKey('J'),
      K: this.input.keyboard.addKey('K'),
      L: this.input.keyboard.addKey('L'),
    };

    this.levelManager = new LevelManager();
    this.makeEnemy = (x, y, cfg) => new Enemy(this, x, y, cfg);

    const level = this.levelManager.build(this, this.currentLevel);

    this.buildBackground(level.bg, level.palette);

    this.player = new Player(this, level.spawn.x, level.spawn.y);

    if (this.playerData) {
      const d = this.playerData;
      Object.assign(this.player, {
        realm: d.realm, treasures: [...d.treasures], bonusDamage: d.bonusDamage,
        bonusHp: d.bonusHp, maxHp: d.maxHp, hp: d.maxHp,
        damageReduction: d.damageReduction, lifesteal: d.lifesteal,
        stunOnHit: d.stunOnHit, rootOnSkill: d.rootOnSkill,
      });
    }

    this.ui = new UIManager(this, this.player);

    this.physics.add.collider(this.player, level.solids);
    this.physics.add.collider(this.enemies, level.solids);
    this.enemies.getChildren().forEach(e => this.physics.add.collider(e, level.solids));

    this.onBossDefeated = (treasureId) => {
      this.player.equipTreasure(treasureId);
      this.showTreasurePopup(TREASURES.find(t => t.id === treasureId));
      this.time.delayedCall(2500, () => this.nextLevel());
    };

    this.showLevelTitle(level.name || `第 ${this.currentLevel + 1} 关`);
  }

  /* ═══════════════════════════════════════════════════════════════
     ★ 自适应切帧器：扫透明通道找缝隙，切成【不等宽】逐帧
       - 适配你这种“紧凑拼接、每帧宽度不同”的图（不再切歪）
       - 扫描异常 / 段数离谱 → 自动回退等宽，绝不崩
       - 每帧裁成独立纹理，动画跨纹理播放（Phaser 标准做法）
     ═══════════════════════════════════════════════════════════════ */
  autoSlice(sheetKey, file, outPrefix, animKey, fps, repeat, fallbackN) {
    if (!this.textures.exists(sheetKey)) {
      console.warn('[SkillFx] 整图没加载 → 路径/文件名不对，我请求的是：' + (SKILL_DIR + file));
      return;
    }
    const tex = this.textures.get(sheetKey);
    const src = (tex && typeof tex.getSourceImage === 'function') ? tex.getSourceImage() : null;
    if (!src || !src.width || !src.height) { console.warn('[SkillFx] 源图无效：', sheetKey); return; }

    const W = src.width, H = src.height;
    let frames = [];          // 自适应切出的 [{x, w}]
    let scanned = false;

    try {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.drawImage(src, 0, 0);
      const data = ctx.getImageData(0, 0, W, H).data;

      const colHasPixel = (x) => {              // 该列是否存在“非透明”像素
        for (let y = 0; y < H; y++) if (data[(y * W + x) * 4 + 3] > 8) return true;
        return false;
      };

      const GAP = 3;                            // 连续全透明列 ≥ GAP 才算“帧缝隙”
      let inFrame = false, start = 0, gapRun = 0;
      for (let x = 0; x < W; x++) {
        if (colHasPixel(x)) {
          if (!inFrame) { inFrame = true; start = x; }
          gapRun = 0;
        } else if (inFrame) {
          if (++gapRun >= GAP) { frames.push({ x: start, w: (x - gapRun) - start + 1 }); inFrame = false; }
        }
      }
      if (inFrame) frames.push({ x: start, w: W - start });
      frames = frames.filter(f => f.w >= 4);    // 去掉 1~3px 的噪声段
      scanned = true;
    } catch (e) {
      console.error('[SkillFx] 透明扫描异常（可能跨域），回退等宽：', e);
    }

    const useAuto = scanned && frames.length >= 2 && frames.length <= 24;
    console.log(`[SkillFx] ${sheetKey} → 扫描 ${frames.length} 段 ` +
                (useAuto ? '✅采用自适应切帧' : `⚠️回退等宽 ${fallbackN}`));

    // —— 回退：等宽切（旧逻辑，保底） ——
    if (!useAuto) {
      const fw = Math.floor(W / fallbackN);
      if (fw <= 0) return;
      try { this.textures.addSpriteSheet(outPrefix, src, { frameWidth: fw, frameHeight: H }); }
      catch (e) { console.error('[SkillFx] 等宽回退失败：', e); return; }
      if (!this.anims.exists(animKey))
        this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(outPrefix, { start: 0, end: fallbackN - 1 }), frameRate: fps, repeat });
      return;
    }

    // —— 自适应：每段裁成独立 canvas → 独立纹理 → 跨纹理动画 ——
    const keys = [];
    frames.forEach((f, i) => {
      const k = outPrefix + '_f' + i;
      if (!this.textures.exists(k)) {
        const c2 = document.createElement('canvas');
        c2.width = f.w; c2.height = H;                       // 高度统一=整图高，垂直不抖
        c2.getContext('2d').drawImage(src, f.x, 0, f.w, H, 0, 0, f.w, H);
        this.textures.addImage(k, c2);                       // 单帧独立纹理
      }
      keys.push(k);
    });
    if (!this.anims.exists(animKey))
      this.anims.create({ key: animKey, frames: keys.map(k => ({ key: k })), frameRate: fps, repeat });
  }

  setupSkillFx() {
    // 韩立 K：挥斩一次性（不循环）。fallbackN=6 仅当自适应失效时用
    this.autoSlice('hanliskill_sheet', 'hanliskill-remove-bg-io.png', 'hanliskill', 'hanliskill_anim', 24, 0, 6);
    // 墨老魔银手：飞行循环
    this.autoSlice('molaoskill_sheet', 'molaoskill-remove-bg-io.png', 'molaoskill', 'molaoskill_anim', 20, -1, 6);
  }

  /* ───────── 背景 / 渐变 / 光尘（逐字保留） ───────── */
  buildBackground(bgKey, p) {
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height;
    if (bgKey && this.textures.exists(bgKey)) {
      this.add.image(W / 2, H / 2, bgKey).setDepth(-10).setScrollFactor(0);
    } else {
      this.drawGradientBg(p, W, H);
    }
    const vig = this.add.graphics().setDepth(-9).setScrollFactor(0);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.18, 0.18, 0.0, 0.0);
    vig.fillRect(0, 0, W, 90);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.0, 0.0, 0.55, 0.55);
    vig.fillRect(0, 90, W, H - 90);
    const colors = (p && p.motes) || [0xfde68a, 0xa5f3fc, 0xbae6fd];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const mote = this.add.circle(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H),
        Phaser.Math.FloatBetween(1.2, 3), colors[i % colors.length], 0
      ).setDepth(-8).setScrollFactor(0);
      this.floatMote(mote, W, H, true);
    }
  }

  drawGradientBg(p, W, H) {
    const g = this.add.graphics().setDepth(-10).setScrollFactor(0);
    g.fillGradientStyle(p.top, p.top, p.mid, p.mid, 1, 1, 1, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(p.mount, 0.92);
    g.beginPath(); g.moveTo(0, 360); g.lineTo(300, 150); g.lineTo(600, 360); g.closePath(); g.fillPath();
    g.fillStyle(p.mount2, 0.96);
    g.beginPath(); g.moveTo(360, 380); g.lineTo(700, 120); g.lineTo(W, 380); g.closePath(); g.fillPath();
    g.lineStyle(2, p.accent, 0.55);
    g.beginPath(); g.moveTo(300, 150); g.lineTo(430, 250); g.strokePath();
    g.beginPath(); g.moveTo(700, 120); g.lineTo(820, 230); g.strokePath();
    g.lineStyle(1, p.accent, 0.35);
    [[180, 300, 14], [520, 250, 18], [820, 320, 12]].forEach(([rx, ry, rr]) => {
      g.strokeCircle(rx, ry, rr); g.strokeCircle(rx, ry, rr * 0.5);
    });
    g.fillStyle(p.fore, 1);
    g.fillRect(0, 430, W, H - 430);
  }

  floatMote(m, W, H, first) {
    const dur = Phaser.Math.Between(6000, 12000);
    const startY = first ? m.y : H + 10;
    const startX = first ? m.x : Phaser.Math.Between(0, W);
    m.setPosition(startX, startY);
    this.tweens.add({
      targets: m, y: -10, x: startX + Phaser.Math.Between(-30, 30),
      alpha: { from: 0, to: 0.7, yoyo: true }, duration: dur,
      onComplete: () => this.floatMote(m, W, H, false),
    });
  }

  update() {
    const c = {
      left:  { isDown: this.cursors.left.isDown  || this.wasd.A.isDown },
      right: { isDown: this.cursors.right.isDown || this.wasd.D.isDown },
      up:    { isDown: this.cursors.up.isDown    || this.wasd.W.isDown },
      down:  { isDown: this.cursors.down.isDown  || this.wasd.S.isDown },
    };
    this.player.update(c, this.keys);
    this.enemies.children.each(e => { if (e.active && e.update) e.update(this.player); });
    this.ui.update();

    if (!this.levelManager.isBossLevel(this.currentLevel)) {
      const alive = this.enemies.children.entries.filter(e => e.active);
      if (alive.length === 0 && !this.levelCleared) {
        this.levelCleared = true;
        this.time.delayedCall(1000, () => this.nextLevel());
      }
    }
  }

  nextLevel() {
    const nextRealm = Math.min(this.currentLevel + 1, REALMS.length - 1);
    if (nextRealm > this.player.realm) this.player.breakthrough(nextRealm);
    const p = this.player;
    this.scene.restart({
      level: this.currentLevel + 1,
      playerData: {
        realm: p.realm, treasures: p.treasures, bonusDamage: p.bonusDamage, bonusHp: p.bonusHp,
        maxHp: p.maxHp, damageReduction: p.damageReduction, lifesteal: p.lifesteal,
        stunOnHit: p.stunOnHit, rootOnSkill: p.rootOnSkill,
      }
    });
  }

  showLevelTitle(name) {
    const txt = this.add.text(this.scale.width / 2, 200, name, {
      fontSize: '36px', fill: '#fbbf24', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0);
    this.tweens.add({ targets: txt, alpha: 0, y: 160, duration: 1500, delay: 1000, onComplete: () => txt.destroy() });
  }

  showTreasurePopup(treasure) {
    if (!treasure) return;
    const cx = this.scale.width / 2, cy = this.scale.height / 2;
    const bg = this.add.rectangle(cx, cy, 320, 100, 0x1e293b, 0.95).setStrokeStyle(2, 0xfbbf24).setDepth(200).setScrollFactor(0);
    const title = this.add.text(cx, cy - 20, `🎉 获得法宝：${treasure.name}`, { fontSize: '20px', fill: '#fbbf24', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201).setScrollFactor(0);
    const desc = this.add.text(cx, cy + 15, treasure.desc, { fontSize: '16px', fill: '#e2e8f0' }).setOrigin(0.5).setDepth(201).setScrollFactor(0);
    this.tweens.add({ targets: [bg, title, desc], alpha: 0, duration: 500, delay: 2000, onComplete: () => { bg.destroy(); title.destroy(); desc.destroy(); } });
  }
}