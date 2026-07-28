import Phaser from 'phaser';
import { BOSS } from '../utils/constants.js';
import { measureAlphaBounds } from '../utils/helpers.js';

export default class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, 'boss_placeholder');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.bossName = config.name || '墨老';
    this.maxHp = config.hp || BOSS.hp;
    this.hp = this.maxHp;
    this.speed = config.speed || BOSS.speed;
    this.damage = config.damage || BOSS.damage;
    this.phase = 1;
    this.attackTimer = 0;
    this.attackCooldown = config.attackCooldown || 2000;
    this.stunTimer = 0;
    this.isBoss = true;
    this.treasureDrop = config.treasure || null;

    this.dead = false;
    this.facing = 1;
    this.raged = false;
    this.attackPoseTimer = 0;
    this.waves = [];
    this.palms = [];

    this.spriteKey = config.sprite || null;
    this.spriteHeight = config.spriteHeight || 72;
    this.baseTint = config.color || 0x9333ea;
    const idleKey = this.spriteKey ? this.spriteKey + '_idle' : null;
    this.hasSprite = !!(idleKey && scene.textures.exists(idleKey));
    if (this.hasSprite) this.setPose(idleKey);
    else super.setTint(this.baseTint);

    this.ranged = !!config.ranged;
    this.maxR = config.maxRange || 360;
    this.waveSpeed = config.waveSpeed || 280;
    this.waveDamage = config.waveDamage || this.damage;

    this.hasPalmSkill = !!config.skillCooldown;
    this.skillCooldown = config.skillCooldown || 3000;
    this.skillTimer = (config.skillDelay != null) ? config.skillDelay : 1200;
    this.palmSpeed = config.palmSpeed || 300;
    this.palmDamage = config.palmDamage || 28;

    this.nameText = scene.add.text(scene.scale.width / 2, 12, this.bossName, {
      fontSize: '16px', fill: '#fca5a5', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(60);
    this.barBg = scene.add.rectangle(scene.scale.width / 2, 38, 400, 12, 0x1e293b)
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(60).setStrokeStyle(1, 0x7f1d1d);
    this.bar = scene.add.rectangle(scene.scale.width / 2 - 198, 40, 396, 8, 0xef4444)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(61);

    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 800 });
  }

  setPose(key) {
    if (!this.scene.textures.exists(key)) return;
    this.setTexture(key);
    const img = this.texture.getSourceImage();
    const iw = img.width, ih = img.height;
    let b; try { b = measureAlphaBounds(img); } catch (e) { b = { x: 0, y: 0, w: iw, h: ih }; }
    const scale = this.spriteHeight / b.h;
    this.setScale(scale);
    this.setOrigin(0.5, 0.5);
    this.body.setSize(b.w, b.h);
    this.body.setOffset(b.x, b.y);
  }

  restoreLook() {
    if (this.hasSprite) { this.raged ? super.setTint(0xff4444) : this.clearTint(); }
    else super.setTint(this.baseTint);
  }

  hurt(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    super.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => { if (this.active && !this.dead) this.restoreLook(); });
    const ratio = this.hp / this.maxHp;
    if (ratio <= 0.33 && this.phase < 3) { this.phase = 3; this.enterRage(); }
    else if (ratio <= 0.66 && this.phase < 2) { this.phase = 2; this.speed *= 1.3; this.attackCooldown *= 0.8; }
    if (this.hp <= 0) this.die();
  }

  stun(duration) {
    if (this.dead) return;
    this.stunTimer = duration * 0.5;
    super.setTint(0xffff00);
  }

  enterRage() {
    this.raged = true;
    super.setTint(0xff4444);
    this.speed *= 1.5; this.attackCooldown *= 0.6; this.damage = Math.round(this.damage * 1.5);
    this.scene.cameras.main.shake(300, 0.01);
  }

  update(player) {
    if (!this.active || this.dead) return;
    const delta = this.scene.game.loop.delta;
    if (this.attackTimer > 0) this.attackTimer -= delta;
    if (this.attackPoseTimer > 0) {
      this.attackPoseTimer -= delta;
      if (this.attackPoseTimer <= 0 && this.hasSprite) this.setPose(this.spriteKey + '_idle');
    }

    if (this.stunTimer > 0) {
      this.stunTimer -= delta; this.setVelocityX(0);
      this.updateWaves(player); this.updatePalms(player);
      if (this.stunTimer <= 0) this.restoreLook();
      this.bar.width = 396 * Math.max(0, this.hp / this.maxHp);
      return;
    }

    const dist = Math.abs(player.x - this.x);
    const dir = player.x > this.x ? 1 : -1;
    this.facing = dir;
    this.setFlipX(dir < 0);

    if (this.ranged) {
      if (dist > this.maxR) this.setVelocityX(dir * this.speed);
      else { this.setVelocityX(0); if (this.attackTimer <= 0) { this.attackTimer = this.attackCooldown; this.fireWave(player); } }
    } else {
      if (dist > 60) {
        this.setVelocityX(dir * this.speed);
        if (this.phase >= 2 && Math.random() < 0.01 && this.body.blocked.down) this.setVelocityY(-400);
      } else {
        this.setVelocityX(0);
        if (this.attackTimer <= 0) { this.attackTimer = this.attackCooldown; this.bossAttack(player); }
      }
    }

    if (this.hasPalmSkill) {
      if (this.skillTimer > 0) this.skillTimer -= delta;
            if (this.skillTimer <= 0) { this.castSilverPalm(player); this.skillTimer = Math.round(this.skillCooldown * Phaser.Math.FloatBetween(0.45, 1.5)); }
    }

    this.updateWaves(player);
    this.updatePalms(player);

    this.bar.width = 396 * Math.max(0, this.hp / this.maxHp);
  }

  bossAttack(player) {
    const range = 80 + this.phase * 20;
    const slash = this.scene.add.rectangle(this.x + (player.x > this.x ? 1 : -1) * 50, this.y - 20, range, 60, 0x9333ea, 0.5);
    this.scene.tweens.add({ targets: slash, alpha: 0, duration: 300, onComplete: () => slash.destroy() });
    if (Math.abs(player.x - this.x) < range) player.hurt(this.damage);
    this.scene.cameras.main.shake(100, 0.005);
  }

  fireWave(player) {
    if (this.hasSprite) { this.setPose(this.spriteKey + '_attack'); this.attackPoseTimer = 300; }
    const sx = this.x + this.facing * (this.displayWidth * 0.5 + 8);
    const sy = this.y - this.displayHeight * 0.1;
    const want = this.spriteKey ? this.spriteKey + '_wave' : 'xuesha_wave';
    const waveTex = this.scene.textures.exists(want) ? want : 'xuesha_wave';
    const wave = this.scene.physics.add.sprite(sx, sy, waveTex);
    if (wave.body) wave.body.setAllowGravity(false);
    wave.setVelocityX(this.facing * this.waveSpeed);
    wave.setFlipX(this.facing < 0);
    wave.setDepth(5);
    wave.damage = this.waveDamage;
    this.scene.tweens.add({ targets: wave, alpha: { from: 1, to: 0.55 }, duration: 160, yoyo: true, repeat: 2 });
    this.waves.push(wave);
  }

  /* ───────── ★ 魔银手：飞行物播放 molaoskill 序列帧动画 ───────── */
  castSilverPalm(player) {
    if (!this.scene.textures.exists('molaoskill')) return;   // 切帧失败则本拍跳过（不崩）
    if (this.hasSprite) { this.setPose(this.spriteKey + '_skill'); this.attackPoseTimer = 500; }
    const sx = this.x + this.facing * (this.displayWidth * 0.5 + 6);
    const sy = this.y - this.displayHeight * 0.15;
    const palm = this.scene.physics.add.sprite(sx, sy, 'molaoskill', 0);   // ★ 序列帧纹理，第0帧
    if (palm.body) palm.body.setAllowGravity(false);
    palm.setOrigin(0.5, 0.5);
    palm.setDepth(6);
    palm.damage = this.palmDamage;
    if (this.scene.anims.exists('molaoskill_anim')) palm.play('molaoskill_anim');   // ★ 播魔银手动画
    const angle = Phaser.Math.Angle.Between(sx, sy, player.x, player.y);
    palm.setVelocity(Math.cos(angle) * this.palmSpeed, Math.sin(angle) * this.palmSpeed);
    this.palms.push(palm);
  }

  updateWaves(player) {
    if (!this.waves.length) return;
    const pb = player.getBounds();
    this.waves = this.waves.filter(w => {
      if (!w.active) return false;
      if (w.x < -60 || w.x > this.scene.scale.width + 60) { w.destroy(); return false; }
      const wb = w.getBounds();
      const hit = wb.x < pb.x + pb.width && wb.x + wb.width > pb.x && wb.y < pb.y + pb.height && wb.y + wb.height > pb.y;
      if (hit) { player.hurt(w.damage, 'ranged'); this.spawnWaveHitFx(w.x, w.y); w.destroy(); return false; }
      return true;
    });
  }

  updatePalms(player) {
    if (!this.palms.length) return;
    const pb = player.getBounds();
    this.palms = this.palms.filter(p => {
      if (!p.active) return false;
      const W = this.scene.scale.width, H = this.scene.scale.height;
      if (p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) { p.destroy(); return false; }
      const wb = p.getBounds();
      const hit = wb.x < pb.x + pb.width && wb.x + wb.width > pb.x && wb.y < pb.y + pb.height && wb.y + wb.height > pb.y;
      if (hit) {
        player.hurt(p.damage);
        this.spawnPalmHitFx(p.x, p.y); p.destroy(); return false;
      }
      return true;
    });
  }

  spawnWaveHitFx(x, y) {
    const f = this.scene.add.circle(x, y, 10, 0x7c3aed, 0.9).setDepth(8);
    this.scene.tweens.add({ targets: f, alpha: 0, scale: 2, duration: 160, onComplete: () => f.destroy() });
    const cols = [0x7c3aed, 0xa78bfa, 0xffffff];
    for (let i = 0; i < 5; i++) {
      const d = this.scene.add.circle(x, y, Phaser.Math.Between(2, 4), cols[i % 3], 1).setDepth(8);
      const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const dist = Phaser.Math.Between(12, 28);
      this.scene.tweens.add({ targets: d, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, alpha: 0, duration: Phaser.Math.Between(180, 300), onComplete: () => d.destroy() });
    }
  }

  spawnPalmHitFx(x, y) {
    const f = this.scene.add.circle(x, y, 18, 0xe2e8f0, 0.9).setDepth(8);
    this.scene.tweens.add({ targets: f, alpha: 0, scale: 1.8, duration: 200, onComplete: () => f.destroy() });
    this.scene.cameras.main.shake(90, 0.006);
    const cols = [0xffffff, 0xc8ccd2, 0x94a3b8];
    for (let i = 0; i < 8; i++) {
      const d = this.scene.add.rectangle(x, y, 6, 6, cols[i % 3], 1).setDepth(8);
      const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const dist = Phaser.Math.Between(18, 46);
      this.scene.tweens.add({ targets: d, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, angle: 360, alpha: 0, duration: Phaser.Math.Between(200, 380), onComplete: () => d.destroy() });
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.setVelocity(0, 0);
    if (this.body) this.body.enable = false;

    this.scene.cameras.main.shake(500, 0.02);
    if (this.treasureDrop && this.scene.onBossDefeated) this.scene.onBossDefeated(this.treasureDrop);

    this.waves.forEach(w => { if (w && w.active) w.destroy(); }); this.waves = [];
    this.palms.forEach(p => { if (p && p.active) p.destroy(); }); this.palms = [];

    const cols = this.spriteKey === 'molao' ? [0xffffff, 0xc8ccd2, 0x94a3b8] : [0xfbbf24];
    for (let i = 0; i < 8; i++) {
      const p = this.scene.add.circle(this.x + Phaser.Math.Between(-30, 30), this.y + Phaser.Math.Between(-30, 30), Phaser.Math.Between(5, 15), cols[i % cols.length], 0.9);
      this.scene.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 600, delay: i * 50, onComplete: () => p.destroy() });
    }

    this.nameText.destroy(); this.barBg.destroy(); this.bar.destroy();

    if (this.hasSprite) {
      this.scene.tweens.add({ targets: this, alpha: 0, y: this.y + 12, angle: this.facing * 10, duration: 450, onComplete: () => this.destroy() });
    } else {
      this.destroy();
    }
  }
}