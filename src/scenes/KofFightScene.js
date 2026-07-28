import Phaser from 'phaser';
import KofFighter, { SLOT } from '../entities/KofFighter.js';
import WenTianRen from '../entities/WenTianRen.js';
import FighterAI from '../ai/FighterAI.js';

// ★ 全部用数字键码（DOM keyCode），彻底绕开 Phaser 字符串键码命名差异 / 小键盘命名坑 / addKeys 抛错
const P1 = {
  move: { left: 65, right: 68, up: 87, down: 83 },          // A D W S
  slots: [70, 71, 72, 82, 84, 89],                          // F G H R T Y
};
const P2 = {
  move: { left: 37, right: 39, up: 38, down: 40,            // 方向键
          nleft: 100, nright: 102, nup: 104, ndown: 98 },    // 小键盘 4 6 8 2
  slots: [188, 190, 191, 76, 186, 222],                     // , . / L ; '
};
const FIT = 'cover';

export default class KofFightScene extends Phaser.Scene {
  constructor() { super('KofFight'); }

  preload() {
    const IMG = 'assets/images/';
    this.load.image('bg_pk', IMG + 'bg/level_bgpk.png');
    this.load.image('kf_common', IMG + 'player_common-remove-bg-io.png');
    this.load.image('kf_idle',   IMG + 'player_idle.png');
    this.load.image('kf_attack', IMG + 'player_attack.png');
    this.load.image('kf_skill',  IMG + 'player_skill.png');
    this.load.image('kf_shifa',  IMG + 'player_shifa-remove-bg-io.png');
    this.load.image('kf_xuemo',  IMG + 'player_xuemozhan-remove-bg-io.png');
    this.load.image('kf_fly',    IMG + 'player_fly-remove-bg-io.png');
    this.load.image('wt_zhanli', IMG + 'wentianren_zhanli-remove-bg-io.png');
    this.load.image('wt_shifa',  IMG + 'wentianren_shifa-remove-bg-io.png');
    this.load.image('wt_mohua',  IMG + 'wentianren_mohua-remove-bg-io.png');   // ★ 魔化形象
  }

  create() {
    this.over = false;
    const W = this.scale.width, H = this.scale.height;
    const mode = (this.scene.settings.data && this.scene.settings.data.mode) || 'pve';
    this.mode = mode;
    this.makeTextures();

    this.add.rectangle(W / 2, H / 2, W, H, 0x10141f).setDepth(0);
    if (this.textures.exists('bg_pk')) {
      const bg = this.add.image(W / 2, H / 2, 'bg_pk').setDepth(0);
      const src = bg.texture.getSourceImage();
      if (FIT === 'stretch') bg.setDisplaySize(W, H);
      else if (src && src.width) bg.setScale(Math.max(W / src.width, H / src.height));
    }

    const ground = this.add.rectangle(W / 2, H - 20, W, 40, 0x222838).setDepth(1).setVisible(false);
    this.physics.add.existing(ground, true);
    this.physics.world.setBounds(0, 0, W, H);

    this.projectiles = this.physics.add.group();
    this.minionGroup = this.physics.add.group();
    this.mirrors = [];
    const groundY = H - 40;
    const has = k => this.textures.exists(k);

    this.p1 = new KofFighter(this, W * 0.3, groundY - 40, null, {
      id: 'p1', name: '韩立', hp: 1000, tint: 0xffffff, facing: 1, projGroup: this.projectiles,
      afterImageTint: 0x88ccff,
      anims: {
        idle: has('kf_idle') ? ['kf_idle'] : ['kf_common'],
        attack: has('kf_attack') ? ['kf_attack'] : null,
        shifa: has('kf_skill') ? ['kf_skill'] : (has('kf_shifa') ? ['kf_shifa'] : null),
        xuemo: ['kf_xuemo'], fly: ['kf_fly'],
      },
    });

    this.p2 = new WenTianRen(this, W * 0.7, groundY - 40, null, {
      id: 'p2', name: '温天仁', hp: mode === 'pvp' ? 1000 : 1400,
      tint: 0xffffff, facing: -1, projGroup: this.projectiles,
      afterImageTint: 0xcc88ff,
      anims: { idle: ['wt_zhanli'], shifa: ['wt_shifa'], transform: ['wt_mohua'] },   // ★ 魔化换图
    });

    this.ai = (mode === 'pve') ? new FighterAI(this.p2) : null;

    this.physics.add.collider(this.p1, this.p2);
    this.physics.add.collider(this.p1, ground);
    this.physics.add.collider(this.p2, ground);

    this.bindInput(this.p1, P1);
    if (mode === 'pvp') this.bindInput(this.p2, P2);

    const sys = this.input.keyboard.addKeys({ enter: 'ENTER', esc: 'ESC' });
    sys.enter.on('down', () => { if (this.over) this.scene.start('FightSelect'); });
    sys.esc.on('down', () => this.scene.start('Home'));

    this.p1.body.setCollideWorldBounds(true);
    this.p2.body.setCollideWorldBounds(true);
    this.buildUI(W, H, mode);
  }

  foeOf(f) { return f === this.p1 ? this.p2 : this.p1; }
  aabbHit(p, o) {
    const a = p.body, b = o.body;
    if (!a || !b) return false;
    return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
  }

  bindInput(f, cfg) {
    // ★ try/catch 双保险：即便某键异常，也不让一个坏键拖垮整条绑定
    let k = {}, sk = {};
    try { k = this.input.keyboard.addKeys(cfg.move); } catch (e) { console.warn('move keys', e); }
    try { sk = this.input.keyboard.addKeys(Object.fromEntries(cfg.slots.map((s, i) => ['s' + i, s]))); } catch (e) { console.warn('slot keys', e); }
    f._keys = { move: k, slots: sk };
    for (let i = 0; i < 6; i++) { if (sk['s' + i]) sk['s' + i].on('down', () => f.useSlot(i)); }
  }

  readInput(f) {
    const k = f._keys && f._keys.move;
    if (!k) return { left: false, right: false, up: false, down: false };
    return {
      left: !!(k.left && k.left.isDown) || !!(k.nleft && k.nleft.isDown),
      right: !!(k.right && k.right.isDown) || !!(k.nright && k.nright.isDown),
      up: !!(k.up && k.up.isDown) || !!(k.nup && k.nup.isDown),
      down: !!(k.down && k.down.isDown) || !!(k.ndown && k.ndown.isDown),
    };
  }

  onHit(proj, target) {
    if (proj.owner === target.id || !target.alive) return;
    if (proj.isBug) {
      const now = this.time.now;
      if (now - proj.lastTick >= proj.tick) { proj.lastTick = now; target.takeDamage(proj.damage, proj.knockX * proj.facing); }
      return;
    }
    if (proj.stunMs) {
      if (target.invincible) return;
      target.applyStun(proj.stunMs);
      if (proj.consumeOnHit) proj.destroy();
      return;
    }
    if (proj.hitTargets.has(target.id)) return;
    proj.hitTargets.add(target.id);
    target.takeDamage(proj.damage, (proj.knockX || 0) * (proj.facing || 1));
    if (proj.consumeOnHit) proj.destroy();
  }

  spawnMirror(owner, target) {
    if (!this.textures.exists('kof_mirror')) return;
    const img = this.add.image(target.body.center.x, target.body.center.y - 70, 'kof_mirror').setDepth(4).setAlpha(0.85);
    this.mirrors.push({ img, target, owner: owner.id, t: 0, ttl: 1000 });
  }

  // ★ 陆续召唤 6 只小怪（每 0.7s 一只，在 6s 魔化内放完）
  spawnMinions(owner, target) {
    const specs = [
      { tint: 0xff5555, s: 1.6, spd: 150, dmg: 18 }, { tint: 0x55ff88, s: 1.3, spd: 210, dmg: 12 },
      { tint: 0x55aaff, s: 1.9, spd: 120, dmg: 24 }, { tint: 0xffcc33, s: 1.5, spd: 180, dmg: 16 },
      { tint: 0xcc66ff, s: 1.7, spd: 160, dmg: 20 }, { tint: 0xff88cc, s: 1.4, spd: 230, dmg: 14 },
    ];
    let idx = 0;
    const ev = this.time.addEvent({
      delay: 700, loop: true,
      callback: () => {
        if (idx >= specs.length || !owner.alive || !target.alive) { ev.remove(); return; }
        const sp = specs[idx++];
        const m = this.minionGroup.create(owner.x + (idx % 2 ? 22 : -22), owner.y - 20, 'kof_minion');
        m.body.setAllowGravity(false); m.body.setCollideWorldBounds(true);
        m.tintCol = sp.tint; m.setTint(sp.tint); m.setScale(sp.s); m.setDepth(2);
        m.spd = sp.spd; m.dmg = sp.dmg; m.target = target; m.life = 6000; m.dead = false;
        m.setVelocityX((idx % 2 ? 1 : -1) * 100);
      },
    });
  }

  // ★ 自爆爆炸特效
  boomFx(x, y, col) {
    const c = this.add.circle(x, y, 14, col, 0.85).setDepth(5);
    this.tweens.add({ targets: c, scaleX: 2.6, scaleY: 2.6, alpha: 0, duration: 300, onComplete: () => c.destroy() });
  }

  spawnWorldProj(x, y, key, vy, owner, damage, knock) {
    const p = this.projectiles.create(x, y, key);
    p.body.setAllowGravity(false); p.body.setBounce(0, 0); p.setVelocity(0, vy); p.setDepth(3);
    p.owner = owner; p.facing = 1; p.damage = damage; p.knockX = knock; p.life = 900;
    p.hitTargets = new Set(); p.consumeOnHit = true; p.isBug = false; p.stunMs = 0;
  }

  update(t, dt) {
    const now = this.time.now;
    if (this.p1.alive) this.p1.facing = this.p2.x >= this.p1.x ? 1 : -1;
    if (this.p2.alive) this.p2.facing = this.p1.x >= this.p2.x ? 1 : -1;

    const in1 = this.readInput(this.p1);
    const in2 = this.ai ? this.ai.tick(this.p1, dt) : this.readInput(this.p2);
    this.p1.updateState(dt, in1, now);
    this.p2.updateState(dt, in2, now);

    // 手动命中：弹 vs 角色 / 弹 vs 小怪
    const fighters = [this.p1, this.p2];
    this.projectiles.getChildren().slice().forEach(p => {
      if (!p || !p.active || !p.body) return;
      for (const f of fighters) {
        if (!f.alive || p.owner === f.id) continue;
        if (this.aabbHit(p, f)) { this.onHit(p, f); if (!p.active) break; }
      }
      if (!p.active) return;
      this.minionGroup.getChildren().forEach(m => {
        if (!m || m.dead || !m.active || !m.body) return;
        if (this.aabbHit(p, m)) { m.dead = true; if (p.consumeOnHit) p.destroy(); }
      });
    });

    // 金光镜
    for (let i = this.mirrors.length - 1; i >= 0; i--) {
      const m = this.mirrors[i]; m.t += dt;
      m.img.x = m.target.body.center.x; m.img.y = m.target.body.center.y - 70;
      m.img.setScale(1 + 0.25 * Math.sin(m.t * 0.02));
      if (m.t >= m.ttl) { this.spawnWorldProj(m.img.x, m.img.y + 30, 'kof_beam', 950, m.owner, 70, 260); m.img.destroy(); this.mirrors.splice(i, 1); }
    }

    // ★ 小怪：追踪 + 接触自爆（炸一次即消失）
    this.minionGroup.getChildren().slice().forEach(m => {
      if (m.dead) { m.destroy(); return; }
      m.life -= dt; if (m.life <= 0 || !m.target.alive) { m.destroy(); return; }
      const d = Math.sign(m.target.x - m.x) || 1;
      m.setVelocityX(d * m.spd); m.setFlipX(d < 0);
      if (Phaser.Math.Distance.Between(m.x, m.y, m.target.body.center.x, m.target.body.center.y) < 30) {
        m.target.takeDamage(m.dmg, d * 80);
        this.boomFx(m.x, m.y, m.tintCol || 0xffffff);
        m.dead = true; m.destroy();
      }
    });

    this.projectiles.getChildren().slice().forEach(p => { p.life -= dt; if (p.life <= 0) p.destroy(); });
    this.updateUI();
  }

  floatDamage(x, y, dmg) {
    const c = dmg >= 100 ? '#ffdd33' : '#ffffff';
    const tx = this.add.text(x, y, '-' + dmg, { fontSize: '18px', color: c, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: tx, y: y - 40, alpha: 0, duration: 600, onComplete: () => tx.destroy() });
  }
  onKO(loser) {
    if (this.over) return; this.over = true;
    const W = this.scale.width, H = this.scale.height;
    const txt = this.mode === 'pvp' ? (loser === this.p1 ? 'P2 胜！' : 'P1 胜！') : (loser === this.p2 ? '胜利！' : '败北…');
    this.add.text(W / 2, H / 2, txt, { fontSize: '48px', color: '#ffcc33', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(10);
    this.add.text(W / 2, H / 2 + 50, 'ENTER 重选模式   ESC 返回首页', { fontSize: '18px', color: '#cccccc' }).setOrigin(0.5).setDepth(10);
  }

  buildUI(W, H, mode) {
    const barW = 360, barH = 18, y = 24; this.barW = barW; this.barH = barH;
    this.add.rectangle(20, y, barW, barH, 0x441111).setOrigin(0, 0.5).setDepth(8);
    this.hp1fg = this.add.rectangle(20, y, barW, barH, 0x33ff88).setOrigin(0, 0.5).setDepth(9);
    this.add.rectangle(W - 20, y, barW, barH, 0x441111).setOrigin(1, 0.5).setDepth(8);
    this.hp2fg = this.add.rectangle(W - 20, y, barW, barH, 0xff7744).setOrigin(1, 0.5).setDepth(9);
    this.add.text(20, y - 22, '韩立', { fontSize: '14px', color: '#9ff' }).setDepth(9);
    this.add.text(W - 20, y - 22, '温天仁', { fontSize: '14px', color: '#fc9' }).setOrigin(1, 0).setDepth(9);
    this.add.text(W / 2, 14, mode === 'pvp' ? '双人对决  韩立 vs 温天仁' : '韩立  VS  温天仁 (AI)', { fontSize: '16px', color: '#ffcc33' }).setOrigin(0.5).setDepth(9);
    const tip = mode === 'pvp'
      ? 'P1: WASD + F剑 G巨剑 H闪避 R蓄 T虫 Y翅   |   P2: 方向/小键盘 + ,冰锥 .针 /闪避 L蓄雾 ;镜 \'变身'
      : 'WASD移动  F剑 G巨剑 H闪避 R蓄阴魔 T虫群 Y翅   |   ESC 返回';
    this.add.text(W / 2, H - 8, tip, { fontSize: '12px', color: '#888' }).setOrigin(0.5).setDepth(9);

    // ★ 头顶蓄力条（每人一组 bg+fg，默认隐藏）
    this.chargeBars = {};
    [this.p1, this.p2].forEach(f => {
      const bw = 64, bh = 7;
      const bg = this.add.rectangle(0, 0, bw, bh, 0x000000, 0.6).setStrokeStyle(1, 0xffffff, 0.6).setOrigin(0, 0.5).setDepth(9).setVisible(false);
      const fg = this.add.rectangle(0, 0, bw, bh, 0xffee55).setOrigin(0, 0.5).setDepth(10).setVisible(false);
      this.chargeBars[f.id] = { bg, fg, bw, bh };
    });
  }

  updateUI() {
    this.hp1fg.setSize(this.barW * (this.p1.hp / this.p1.maxHp), this.barH);
    this.hp2fg.setSize(this.barW * (this.p2.hp / this.p2.maxHp), this.barH);
    // ★ 蓄力条跟随角色头顶，按进度填充
    [this.p1, this.p2].forEach(f => {
      const cb = this.chargeBars[f.id]; if (!cb) return;
      if (f.charging) {
        const x = f.vis.x - cb.bw / 2, y = f.vis.y - 72;
        cb.bg.setVisible(true).setPosition(x, y);
        cb.fg.setVisible(true).setPosition(x, y).setSize(Math.max(1, cb.bw * f.chargeProgress), cb.bh);
      } else { cb.bg.setVisible(false); cb.fg.setVisible(false); }
    });
  }

  makeTextures() {
    const g = this.make.graphics({ add: false });
    const mk = (key, fn) => { if (this.textures.exists(key)) return; g.clear(); fn(g); };
    mk('kof_sword',  g => { g.fillStyle(0x66ff66, 1); g.fillRect(0, 0, 30, 8); g.generateTexture('kof_sword', 30, 8); });
    mk('kof_bigswd', g => { g.fillStyle(0xdddddd, 1); g.fillRect(0, 0, 64, 74); g.generateTexture('kof_bigswd', 64, 74); });
    mk('kof_yinmo',  g => { g.fillStyle(0xaa44ff, 1); g.fillCircle(48, 48, 44); g.generateTexture('kof_yinmo', 96, 96); });
    mk('kof_bug',    g => { g.fillStyle(0xffcc33, 1); g.fillCircle(36, 36, 30); g.generateTexture('kof_bug', 72, 72); });
    mk('kf_ice',     g => { g.fillStyle(0x66ccff, 1); g.fillTriangle(0, 5, 24, 0, 24, 10); g.generateTexture('kf_ice', 24, 10); });
    mk('kf_needle',  g => { g.fillStyle(0xcc66ff, 1); g.fillRect(0, 0, 28, 4); g.generateTexture('kf_needle', 28, 4); });
    mk('kof_fog',    g => { g.fillStyle(0x9944dd, 0.6); g.fillCircle(24, 24, 22); g.generateTexture('kof_fog', 48, 48); });
    mk('kof_mirror', g => { g.lineStyle(4, 0xffdd44, 1); g.strokeCircle(20, 20, 16); g.fillStyle(0xffdd44, 0.3); g.fillCircle(20, 20, 12); g.generateTexture('kof_mirror', 40, 40); });
    mk('kof_beam',   g => { g.fillStyle(0xffee66, 1); g.fillRect(0, 0, 12, 60); g.generateTexture('kof_beam', 12, 60); });
    // ★ 小怪占位升级：带眼睛+嘴的怪脸（圆对称，无朝向问题；tint 区分 6 只）
    mk('kof_minion', g => {
      g.fillStyle(0xffffff, 1); g.fillCircle(12, 12, 11);
      g.fillStyle(0x101010, 1); g.fillCircle(8, 9, 2.6); g.fillCircle(16, 9, 2.6);
      g.lineStyle(2, 0x101010, 1); g.beginPath(); g.moveTo(7, 16); g.lineTo(17, 16); g.strokePath();
      g.generateTexture('kof_minion', 24, 24);
    });
    g.destroy();
  }
}