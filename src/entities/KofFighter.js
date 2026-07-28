import Phaser from 'phaser';

// ===== 玩法数值 =====
const GROUND_SPEED = 260, FLY_SPEED = 300, JUMP_V = 520, FLY_DUR = 6;
const CHARGE_MS = 2000, HURT_MS = 250, TARGET_H = 120;

// ===== 闪避（无敌帧=位移+残影）=====
const DODGE_MS = 160, DODGE_SPEED = 620, INV_MS = 320, ECHO_EVERY = 45, ECHO_LIFE = 300;

// ===== 加减速 =====
const USE_ACCEL = true, TAU_GROUND = 45, TAU_AIR = 150;
const HURT_FLASH_MS = 110;

export const SLOT = { ATK: 0, SKILL: 1, DODGE: 2, CHARGE: 3, SPECIAL: 4, ULT: 5 };

export default class KofFighter extends Phaser.Physics.Arcade.Sprite {
  static ensureBlank(scene) {
    if (scene.textures.exists('kf_blank')) return;
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x000000, 0); g.fillRect(0, 0, 40, 120); g.generateTexture('kf_blank', 40, 120); g.destroy();
  }

  constructor(scene, x, y, _tex, opts = {}) {
    KofFighter.ensureBlank(scene);
    super(scene, x, y, 'kf_blank');
    scene.add.existing(this); scene.physics.add.existing(this); this.setVisible(false);

    this.id = opts.id || 'f'; this.name = opts.name || 'fighter';
    this.projGroup = opts.projGroup; this.isDummy = !!opts.isDummy; this.flipBase = !!opts.flipBase;
    this.fxKey = opts.fxKey || null;
    this.afterImageTint = opts.afterImageTint != null ? opts.afterImageTint : 0x88ccff;

    this.maxHp = opts.hp || 1000; this.hp = this.maxHp; this.alive = true;
    this.facing = opts.facing || 1;

    this.charging = false; this.chargeProgress = 0; this.chargeStart = 0;
    this.attackUntil = 0; this.hurtUntil = 0;
    this.poseHint = null; this.poseUntil = 0;
    this.stunUntil = 0;
    this.dodgeUntil = 0; this.dodgeDir = 0; this.dodgeEcho = 0;
    this.invincible = false; this.invincibleEnd = 0;
    this.flying = false; this.flyRemain = 0; this._jumpHeld = false;
    this.transformUntil = 0; this.regenPerSec = 0;

    // ★ 动画表（frameAnims，绝不占用 Phaser 保留属性 this.anims）；新增 transform 槽
    const u = opts.anims || {};
    const norm = v => (!v ? { frames: [], fps: 8, loop: true }
      : Array.isArray(v) ? { frames: v, fps: 8, loop: true }
      : { frames: (v.frames && v.frames.length) ? v.frames : [], fps: v.fps || 8, loop: v.loop !== false });
    this.frameAnims = { idle: norm(u.idle), walk: norm(u.walk), attack: norm(u.attack),
      shifa: norm(u.shifa), xuemo: norm(u.xuemo), fly: norm(u.fly), hurt: norm(u.hurt),
      transform: norm(u.transform) };

    this.baseTint = opts.tint != null ? opts.tint : 0xffffff;
    const startKey = (this.frameAnims.idle.frames[0]) || 'kf_blank';
    this.vis = scene.add.image(0, 0, startKey).setOrigin(0.5, 0.5).setDepth(2);
    this.visScale = TARGET_H / (this.vis.frame.height || 1);
    this.vis.setScale(this.visScale); this.vis.setTint(this.baseTint);

    this.animName = null; this.animFrame = 0; this.animTimer = 0;
    this.curVx = 0; this._walking = false; this._lastMoveDir = 0;
    this.hurtFlashUntil = 0;

    const b = this.body;
    b.setCollideWorldBounds(true); b.setBounce(0, 0); b.setDragX(800); b.setMaxVelocity(900, 1200);
    const groundTop = scene.scale.height - 40;
    this.y = groundTop - this.displayHeight / 2;
  }

  get onGround() { return this.body.blocked.down; }
  get stunned() { return this.scene.time.now < this.stunUntil; }
  get transformed() { return this.scene.time.now < this.transformUntil; }

  canAct() {
    const n = this.scene.time.now;
    return this.alive && !this.charging && this.attackUntil <= n && this.hurtUntil <= n
      && !this.stunned && this.dodgeUntil <= n;
  }

  getAnim(name) { const a = this.frameAnims[name]; return (a && a.frames && a.frames.length) ? a : this.frameAnims.idle; }

  setVisTexture(key) {
    if (!key || this.vis.texture.key === key) return;
    this.vis.setTexture(key);
    this.visScale = TARGET_H / (this.vis.frame.height || 1);
    this.vis.setScale(this.visScale);
  }

  playActPose(hint, ms) { this.poseHint = hint; this.poseUntil = this.scene.time.now + ms; }

  useSlot(i) {
    if (i === SLOT.DODGE) return this.doDodge();
    if (!this.canAct()) return;
    const n = this.scene.time.now;
    switch (i) {
      case SLOT.ATK:    this.attackUntil = n + 200; this.playActPose('attack', 220); this.spawnFx();
        this.spawnProj({ key: 'kof_sword', dx: 30, vx: 900, damage: 40, knockX: 140, life: 700, consumeOnHit: true }); break;
      case SLOT.SKILL:  this.attackUntil = n + 400; this.playActPose('attack', 360); this.spawnFx();
        this.spawnProj({ key: 'kof_bigswd', dx: 36, vx: 650, damage: 90, knockX: 320, life: 900, consumeOnHit: true }); break;
      case SLOT.CHARGE: this.charging = true; this.chargeStart = n; this.chargeProgress = 0; this.setVelocityX(0); this.curVx = 0; break;
      case SLOT.SPECIAL:this.attackUntil = n + 300; this.playActPose('shifa', 320); this.spawnFx();
        this.spawnProj({ key: 'kof_bug', dx: 40, dy: -10, vx: 320, damage: 18, knockX: 50, life: 3000, isBug: true, tick: 300 }); break;
      case SLOT.ULT:    if (!this.alive || this.flying || this.stunned) return;
        this.flying = true; this.flyRemain = FLY_DUR; this.body.setAllowGravity(false); this.setVelocityY(-220); break;
    }
  }

  releaseCharge() {
    const prog = this.chargeProgress;
    this.charging = false; this.chargeProgress = 0; this.attackUntil = this.scene.time.now + 500;
    this.playActPose('shifa', 400); this.spawnFx();
    this.spawnProj({ key: 'kof_yinmo', dx: 50, vx: 480, damage: Math.round(120 + prog * 180), knockX: 420, life: 1500, consumeOnHit: true });
  }

  doDodge() {
    const n = this.scene.time.now;
    if (!this.alive || this.stunned || this.dodgeUntil > n) return;
    this.dodgeDir = this._lastMoveDir || this.facing;
    this.dodgeUntil = n + DODGE_MS; this.dodgeEcho = 0;
    this.invincible = true; this.invincibleEnd = n + INV_MS;
  }
  spawnAfterImage() {
    const s = this.scene, v = this.vis;
    const img = s.add.image(v.x, v.y, v.texture.key).setOrigin(0.5, 0.5).setDepth(1);
    img.setScale(v.scaleX < 0 ? -this.visScale : this.visScale, this.visScale);
    img.setFlipX(v.flipX); img.setTint(this.afterImageTint); img.setAlpha(0.5);
    s.tweens.add({ targets: img, alpha: 0, duration: ECHO_LIFE, onComplete: () => img.destroy() });
  }

  spawnFx() {
    if (!this.fxKey || !this.scene.textures.exists(this.fxKey)) return;
    const s = this.scene, fx = s.add.image(this.body.center.x + this.facing * 40, this.body.center.y, this.fxKey)
      .setOrigin(0.5, 0.5).setDepth(4).setFlipX(this.facing < 0).setAlpha(0.9);
    const base = Math.max(0.5, TARGET_H / (fx.frame.height || 1));
    fx.setScale(base * (this.facing < 0 ? -1 : 1), base);
    s.tweens.add({ targets: fx, alpha: 0, scaleX: fx.scaleX * 1.5, scaleY: fx.scaleY * 1.5, duration: 340, onComplete: () => fx.destroy() });
  }

  // ★ 定身=暂停蓄力（不再 this.charging=false，蓄力不被控制取消）
  applyStun(ms) { this.stunUntil = Math.max(this.stunUntil, this.scene.time.now + ms); }

  updateState(dt, input, now) {
    if (!this.alive) { this.syncVisual(now); return; }

    if (this.invincible && now > this.invincibleEnd) { this.invincible = false; }
    if (this.flying) { this.flyRemain -= dt / 1000; if (this.flyRemain <= 0) { this.flying = false; this.flyRemain = 0; this.body.setAllowGravity(true); } }
    if (this.transformed) this.hp = Math.min(this.maxHp, this.hp + this.regenPerSec * dt / 1000);

    const busy = this.attackUntil > now || this.hurtUntil > now || this.stunned;

    let targetVx = 0;
    if (now < this.dodgeUntil) {
      this.setVelocityX(this.dodgeDir * DODGE_SPEED); this.curVx = this.dodgeDir * DODGE_SPEED;
      this.dodgeEcho += dt; if (this.dodgeEcho >= ECHO_EVERY) { this.dodgeEcho = 0; this.spawnAfterImage(); }
    } else if (busy) {
      this.curVx = this.stunned ? 0 : this.body.velocity.x; if (this.stunned) this.setVelocityX(0);
    } else {
      const sp = this.flying ? FLY_SPEED : GROUND_SPEED;
      targetVx = input.left ? -sp : input.right ? sp : 0;
      if (USE_ACCEL) {
        const tau = this.onGround ? TAU_GROUND : TAU_AIR;
        this.curVx += (targetVx - this.curVx) * (1 - Math.exp(-dt / tau));
        if (targetVx === 0 && Math.abs(this.curVx) < 2) this.curVx = 0;
      } else this.curVx = targetVx;
      this.setVelocityX(this.curVx);
    }
    this._lastMoveDir = input.left ? -1 : input.right ? 1 : this._lastMoveDir;
    this._walking = !busy && now >= this.dodgeUntil && this.onGround && Math.abs(targetVx) > 1;

    if (this.flying) {
      if (input.up) this.setVelocityY(-FLY_SPEED); else if (input.down) this.setVelocityY(FLY_SPEED); else this.setVelocityY(0);
    } else if (!busy && input.up && !this._jumpHeld && this.onGround) this.setVelocityY(-JUMP_V);
    this._jumpHeld = !!input.up;

    // ★ 蓄力：累加式；定身(stunned)时暂停不推进；全程锁位移
    if (this.charging) {
      if (!this.stunned) this.chargeProgress = Math.min(1, this.chargeProgress + dt / CHARGE_MS);
      this.setVelocityX(0); this.curVx = 0;
      if (this.chargeProgress >= 1) this.releaseCharge();
    }

    // ★ 选动画：transformed 最优先（魔化换图）；stunned 优先于 charging（定身显僵直）
    let name;
    if (this.transformed) name = 'transform';
    else if (this.flying) name = 'fly';
    else if (this.stunned) name = 'hurt';
    else if (this.charging) name = 'xuemo';
    else if (now < this.poseUntil) name = this.poseHint;
    else if (this._walking) name = 'walk';
    else if (this.hurtUntil > now) name = 'hurt';
    else name = 'idle';
    this.playAnim(name, dt);

    this.syncVisual(now);
  }

  playAnim(name, dt) {
    const anim = this.getAnim(name);
    if (name !== this.animName) { this.animName = name; this.animFrame = 0; this.animTimer = 0; }
    if (anim.frames.length > 1) {
      const fms = 1000 / anim.fps; this.animTimer += dt;
      while (this.animTimer >= fms) {
        this.animTimer -= fms; this.animFrame++;
        this.animFrame = anim.loop ? this.animFrame % anim.frames.length : Math.min(this.animFrame, anim.frames.length - 1);
      }
    }
    this.setVisTexture(anim.frames[this.animFrame]);
  }

  // ★ 魔化不再染色（靠换 transform 图）；只保留 定身紫 / 受击闪红 两种短暂反馈
  syncVisual(now) {
    this.vis.x = this.body.center.x; this.vis.y = this.body.center.y;
    this.vis.setFlipX((this.facing < 0) !== this.flipBase);
    let tint = this.baseTint;
    if (this.stunned) tint = 0xaa66ff;
    if (this.hurtFlashUntil > now) tint = 0xff5555;
    this.vis.setTint(tint);
    this.vis.setAlpha(this.invincible ? 0.55 : 1);
  }

  spawnProj(o) {
    const p = this.projGroup.create(this.x + (o.dx || 0) * this.facing, this.y + (o.dy || 0), o.key);
    p.body.setAllowGravity(false); p.body.setBounce(0, 0);
    p.setVelocity((o.vx || 0) * this.facing, o.vy || 0); p.setDepth(3);
    p.owner = this.id; p.facing = this.facing; p.damage = o.damage || 0; p.knockX = o.knockX || 0;
    p.life = o.life || 1000; p.hitTargets = new Set(); p.consumeOnHit = !!o.consumeOnHit;
    p.isBug = !!o.isBug; p.tick = o.tick || 0; p.lastTick = 0; p.stunMs = o.stunMs || 0;
    return p;
  }

  // ★ 蓄力霸体：charging 时挨打只扣血+闪红，不击退、不硬直（蓄力不被普通攻击打断）
  takeDamage(dmg, knockX) {
    if (!this.alive || this.invincible) return;
    const now = this.scene.time.now;
    this.hp = Math.max(0, this.hp - dmg);
    if (this.scene.floatDamage) this.scene.floatDamage(this.x, this.y - this.displayHeight / 2, dmg);
    const superArmor = this.charging;
    if (knockX && !superArmor) this.setVelocityX(knockX);
    if (!this.isDummy && !superArmor) this.hurtUntil = now + HURT_MS;
    if (!this.isDummy) this.hurtFlashUntil = now + HURT_FLASH_MS;
    if (this.hp <= 0) {
      this.alive = false; this.setVelocity(0, 0); this.curVx = 0; this.body.setAllowGravity(true);
      this.vis.setTint(0x555555); this.vis.setAlpha(1);
      if (this.scene.onKO) this.scene.onKO(this);
    }
  }

  destroy(fromScene) { if (this.vis) this.vis.destroy(); super.destroy(fromScene); }
}