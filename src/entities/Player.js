import Phaser from 'phaser';
import { PLAYER, REALMS } from '../utils/constants.js';
import { measureAlphaBounds } from '../utils/helpers.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, feetY) {
    super(scene, x, feetY, 'player_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.setBounce(0);

    this.maxHp = PLAYER.maxHp;
    this.hp = this.maxHp;
    this.maxMp = PLAYER.maxMp;
    this.mp = this.maxMp;
    this.facing = 1;
    this.attackTimer = 0;
    this.skillTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.invincible = false;

    this.realm = 0;
    this.treasures = [];
    this.bonusDamage = 0;
    this.bonusHp = 0;
    this.damageReduction = 0;
    this.lifesteal = 0;
    this.stunOnHit = false;
    this.rootOnSkill = false;

    // ═══════════════════════════════════════════════════════════
    // ★ 灵盾（绿光盾）字段 —— 按住 L 举盾，远程伤害 -80%
    // ═══════════════════════════════════════════════════════════
    this.shieldActive  = false;     // 当前是否举盾
    this.shieldFlash   = 0;         // 受击闪光剩余(ms)
    this.SHIELD_REDUCE = 0.8;       // 抵消比例（0.8 = 挡80%，只吃20%）
    this.keyL = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.shieldGfx = this.scene.add.graphics().setDepth(20);  // 绿光圈，压在角色/波之上

    // ═══════════════════════════════════════════════════════════
    // ★ 遁术（空格）字段 —— 0.2s 无敌冲刺 + 青色残影
    //   用独立 dashing 守卫，与受击 invincible 解耦，互不干扰
    // ═══════════════════════════════════════════════════════════
    this.dashing          = false;   // 是否正在遁术
    this.dashTimer        = 0;       // 本次遁术剩余(ms)
    this.dashGhostTimer   = 0;       // 距下一帧残影(ms)
    this.dashCooldownTimer= 0;       // 遁术冷却剩余(ms)
    this.DASH_DURATION    = 200;     // 无敌冲刺时长 0.2s
    this.DASH_SPEED       = 520;     // 冲刺速度（明显快于走路才有“闪”感）
    this.DASH_COOLDOWN    = 700;     // 冷却（含冲刺时长，两次间隔≈此值）
    this.keySpace = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // ★ 捕获空格，阻止浏览器默认“滚页面”行为（不加这行按空格页面会跳）
    this.scene.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);

    this.setPose('player_idle');
    this.placeFeetAt(feetY);

    this.scene.time.addEvent({
      delay: 1000, loop: true,
      callback: () => { this.mp = Math.min(this.maxMp, this.mp + PLAYER.mpRegen); }
    });

    // ★ 操作提示（固定 HUD，不随摄像机滚）
    this.scene.add.text(12, (this.scene.scale.height || 540) - 40,
      '空格 · 遁术（无敌闪避）',
      { fontSize: '12px', fill: '#67e8f9', backgroundColor: '#00000066', padding: { x: 4, y: 2 } }
    ).setDepth(1000).setScrollFactor(0).setAlpha(0.85);
    this.scene.add.text(12, (this.scene.scale.height || 540) - 22,
      '按住 L · 灵盾（远程 -80%）',
      { fontSize: '12px', fill: '#86efac', backgroundColor: '#00000066', padding: { x: 4, y: 2 } }
    ).setDepth(1000).setScrollFactor(0).setAlpha(0.85);
  }

  placeFeetAt(y) { this.y = y; this.setVelocityY(0); }

  setPose(key) {
    if (!this.scene.textures.exists(key)) return;
    this.setTexture(key);
    const img = this.texture.getSourceImage();
    const iw = img.width, ih = img.height;
    let b;
    try { b = measureAlphaBounds(img); }
    catch (e) { b = { x: 0, y: 0, w: iw, h: ih }; }
    const scale = PLAYER.displayHeight / b.h;
    this.setScale(scale);
    this.setOrigin((b.x + b.w / 2) / iw, (b.y + b.h) / ih);
    this.body.setSize(b.w, b.h);
    this.body.setOffset(b.x, b.y);
  }

  /* ───────── 普通攻击 J ───────── */
  attack() {
    if (this.attackTimer > 0) return;
    this.attackTimer = PLAYER.attackCooldown;
    if (this.comboTimer > 0) this.comboCount = (this.comboCount + 1) % 3;
    else this.comboCount = 0;
    this.comboTimer = 600;
    this.setPose('player_attack');

    const dmg = PLAYER.attackDamage + this.bonusDamage + (this.comboCount === 2 ? 15 : 0);
    const w = this.displayWidth * PLAYER.hitbox.widthRatio;
    const h = this.displayHeight * PLAYER.hitbox.heightRatio;
    const hx = this.x + this.facing * this.displayWidth * PLAYER.hitbox.forwardRatio;
    const hy = this.y - this.displayHeight * 0.5;

    const hitbox = this.scene.add.zone(hx, hy, w, h);
    this.scene.physics.add.existing(hitbox);
    hitbox.body.setAllowGravity(false);
    this.scene.physics.add.overlap(hitbox, this.scene.enemies, (hb, enemy) => {
      if (!enemy || !enemy.active || !enemy.body) return;
      enemy.hurt(dmg);
      if (!enemy.active || !enemy.body) return;
      if (this.stunOnHit && enemy.stun) enemy.stun(800);
      if (this.lifesteal > 0) this.heal(Math.round(dmg * this.lifesteal));
      enemy.setVelocityX(this.facing * 150);
    });

    this.spawnHitEffect(hx, hy);

    this.scene.time.delayedCall(180, () => {
      hitbox.destroy();
      if (this.texture.key === 'player_attack') this.setPose('player_idle');
    });
  }

  /* ───────── 技能 K ───────── */
  useSkill() {
    if (this.skillTimer > 0 || this.mp < 30) return;
    this.skillTimer = PLAYER.skillCooldown;
    this.mp -= 30;
    this.setPose('player_skill');

    const w = PLAYER.skillRange.width;
    const h = PLAYER.skillRange.height;
    const sx = this.x + this.facing * (this.displayWidth * 0.5 + w * 0.4);
    const sy = this.y - this.displayHeight * 0.5;

    // ★ 改为播放 hanliskill 序列帧剑气（旧五层程序化特效见 spawnSkillEffect，已保留备用）
    this.spawnHanliSkillFx(sx, sy, this.facing);

    const hitbox = this.scene.add.zone(sx, sy, w, h);
    this.scene.physics.add.existing(hitbox);
    hitbox.body.setAllowGravity(false);
    const dmg = PLAYER.skillDamage + this.bonusDamage;
    this.scene.physics.add.overlap(hitbox, this.scene.enemies, (hb, enemy) => {
      if (!enemy || !enemy.active || !enemy.body) return;
      enemy.hurt(dmg);
      if (!enemy.active || !enemy.body) return;
      if (this.rootOnSkill && enemy.stun) enemy.stun(2000);
      if (this.lifesteal > 0) this.heal(Math.round(dmg * this.lifesteal));
      enemy.setVelocityX(this.facing * 250);
    });

    this.scene.time.delayedCall(400, () => {
      hitbox.destroy();
      if (this.texture.key === 'player_skill') this.setPose('player_idle');
    });
  }

  /* ───────── ★ 韩立 K：播放 hanliskill 序列帧剑气 + 一层淡全屏闪 ───────── */
  spawnHanliSkillFx(x, y, facing) {
    const scene = this.scene;
    if (scene.textures.exists('hanliskill') && scene.anims.exists('hanliskill_anim')) {
      const fx = scene.add.sprite(x, y, 'hanliskill', 0).setDepth(9);
      fx.setOrigin(0.5, 0.5);
      fx.setFlipX(facing < 0);
      // 让剑气比人略大、有气势；太大/太小改这个系数（1.6）
      const target = this.displayHeight * 1.6;
      if (fx.height > 0) fx.setScale(Math.min(target / fx.height, 3));
      fx.play('hanliskill_anim');
      fx.on('animationcomplete', () => fx.destroy());
      scene.time.delayedCall(900, () => { if (fx && fx.active) fx.destroy(); }); // 兜底强删
    }
    // 全屏淡闪补“释放感”（很轻，不抢序列帧）
    const flash = scene.add.rectangle(
      scene.scale.width / 2, scene.scale.height / 2,
      scene.scale.width, scene.scale.height, 0x67e8f9, 0.10
    ).setDepth(50).setScrollFactor(0);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
  }

  /* ───────── 旧·五层程序化剑气（已不被调用，保留备用，零风险） ───────── */
  spawnSkillEffect(x, y, facing) {
    const scene = this.scene;
    const arc = scene.add.graphics().setDepth(9);
    const startA = facing > 0 ? -Math.PI / 3 : Math.PI - Math.PI / 3;
    const endA   = facing > 0 ?  Math.PI / 3 : Math.PI + Math.PI / 3;
    arc.fillStyle(0x60a5fa, 0.35);
    arc.beginPath(); arc.arc(x, y, 60, startA, endA, false); arc.lineTo(x, y); arc.closePath(); arc.fillPath();
    arc.lineStyle(3, 0x93c5fd, 0.9);
    arc.beginPath(); arc.arc(x, y, 60, startA, endA, false); arc.strokePath();
    scene.tweens.add({ targets: arc, alpha: 0, scale: 1.6, duration: 350, onComplete: () => arc.destroy() });
    const ring = scene.add.circle(x, y, 12, 0x93c5fd, 0).setStrokeStyle(3, 0x60a5fa, 0.85).setDepth(9);
    scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    const pColors = [0x60a5fa, 0x93c5fd, 0xffffff, 0x3b82f6];
    for (let i = 0; i < 12; i++) {
      const dot = scene.add.circle(x, y, Phaser.Math.Between(2, 5), pColors[i % 4], 1).setDepth(9);
      const baseAng = facing > 0 ? 0 : Math.PI;
      const ang = baseAng + Phaser.Math.DegToRad(Phaser.Math.Between(-50, 50));
      const dist = Phaser.Math.Between(50, 110);
      scene.tweens.add({ targets: dot, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist - Phaser.Math.Between(0, 30), alpha: 0, scale: 0.2, duration: Phaser.Math.Between(300, 520), onComplete: () => dot.destroy() });
    }
    for (let i = 0; i < 3; i++) {
      const trail = scene.add.rectangle(x + facing * i * 18, y, 70 - i * 16, 5 - i, 0x93c5fd, 0.55 - i * 0.14).setDepth(8).setAngle(facing > 0 ? -12 : 12);
      scene.tweens.add({ targets: trail, alpha: 0, x: trail.x + facing * 35, duration: 280 + i * 60, onComplete: () => trail.destroy() });
    }
    const flash = scene.add.rectangle(scene.scale.width / 2, scene.scale.height / 2, scene.scale.width, scene.scale.height, 0x3b82f6, 0.12).setDepth(50).setScrollFactor(0);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
  }

  /* ───────── J 攻击小火花 ───────── */
  spawnHitEffect(x, y) {
    const flash = this.scene.add.circle(x, y, 12, 0xfbbf24, 0.9).setDepth(8);
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 2.2, duration: 180, onComplete: () => flash.destroy() });
    const colors = [0xfbbf24, 0xf97316, 0xffffff];
    for (let i = 0; i < 6; i++) {
      const dot = this.scene.add.circle(x, y, Phaser.Math.Between(2, 4), colors[i % 3], 1).setDepth(8);
      const ang = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const dist = Phaser.Math.Between(15, 35);
      this.scene.tweens.add({ targets: dot, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, alpha: 0, duration: Phaser.Math.Between(200, 320), onComplete: () => dot.destroy() });
    }
  }

  /* ───────── ★ 遁术：开始 / 结束 / 残影 ───────── */
  startDash() {
    if (this.dashCooldownTimer > 0) return;     // 冷却中
    if (!this.active || this.hp <= 0) return;
    this.dashing = true;
    this.dashTimer = this.DASH_DURATION;
    this.dashGhostTimer = 0;
    this.dashCooldownTimer = this.DASH_COOLDOWN;
    this.setPose('player_dash');                // 无该纹理则 no-op，残影照画
    this.spawnDashGhost();                      // 起手一帧残影
  }

  endDash() {
    this.dashing = false;
    this.setVelocityX(0);                       // 停住水平惯性（不动 Y，避免空中顿一下）
    this.setPose('player_idle');
  }

  spawnDashGhost() {
    const scene = this.scene;
    const key = this.texture.key;
    if (!scene.textures.exists(key)) return;
    const ghost = scene.add.image(this.x, this.y, key);
    ghost.setScale(this.scaleX, this.scaleY);   // 与本体同缩放
    ghost.setFlipX(this.flipX);                 // 同朝向
    ghost.setOrigin(this.originX, this.originY);// 同锚点 → 残影与本体精确重合
    ghost.setTint(0x67e8f9);                    // 青色遁影
    ghost.setAlpha(0.55);
    ghost.setDepth((this.depth || 0) - 1);      // 压在本体下一层，人始终清晰
    scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  /* ───────── 受伤 / 治疗 / 死亡 ───────── */
  // ★ 第二参数 type：'ranged'=远程（护盾可挡），其余/不传=近战（护盾不挡）
  hurt(dmg, type) {
    if (this.invincible || this.dashing) return;   // ★ 遁术中完全免伤（不染红、不触发受击无敌计时）

    let incoming = dmg;
    if (this.shieldActive && type === 'ranged') {
      incoming = dmg * (1 - this.SHIELD_REDUCE);
      this.shieldFlash = 140;
      this.spawnShieldBlockFx();
    }

    const realDmg = Math.round(incoming * (1 - this.damageReduction));
    this.hp = Math.max(0, this.hp - realDmg);
    this.invincible = true;
    this.setTint(0xff5555);
    this.scene.time.delayedCall(500, () => { this.invincible = false; this.clearTint(); });
    if (this.hp <= 0) this.die();
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }

  die() {
    this.dashing = false;                       // ★ 收尾，避免 restart 前一帧残留
    this.shieldActive = false;
    if (this.shieldGfx) this.shieldGfx.clear();
    this.scene.scene.restart();
  }

  /* ───────── 境界 / 法宝 ───────── */
  breakthrough(realmIndex) {
    this.realm = realmIndex;
    const realm = REALMS[realmIndex];
    if (!realm) return;
    this.bonusHp = realm.hpBonus;
    this.bonusDamage = realm.dmgBonus;
    this.maxHp = PLAYER.maxHp + this.bonusHp;
    this.hp = this.maxHp;
  }

  equipTreasure(treasureId) {
    if (this.treasures.includes(treasureId)) return;
    this.treasures.push(treasureId);
    switch (treasureId) {
      case 'golden_brick': this.stunOnHit = true; break;
      case 'jiao_armor':   this.damageReduction = 0.3; break;
      case 'blood_pearl':  this.lifesteal = 0.1; break;
      case 'spider_silk':  this.rootOnSkill = true; break;
    }
  }

  /* ───────── 每帧 ───────── */
  update(cursors, keys) {
    const delta = this.scene.game.loop.delta;
    if (this.attackTimer > 0) this.attackTimer -= delta;
    if (this.skillTimer > 0) this.skillTimer -= delta;
    if (this.comboTimer > 0) this.comboTimer -= delta;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= delta;   // ★ 遁术冷却

    // ★ 遁术触发：空格按下瞬间，且非遁术中、存活
    if (!this.dashing && this.hp > 0 && Phaser.Input.Keyboard.JustDown(this.keySpace)) this.startDash();

    if (this.dashing) {
      // ★ 遁术中：朝 facing 高速平移 + 残影 + 计时收尾；锁住左右/跳/攻击/技能
      this.dashTimer -= delta;
      this.setVelocityX(this.facing * this.DASH_SPEED);
      this.dashGhostTimer -= delta;
      if (this.dashGhostTimer <= 0) { this.spawnDashGhost(); this.dashGhostTimer = 45; }
      if (this.dashTimer <= 0) this.endDash();
    } else {
      if (cursors.left.isDown) { this.setVelocityX(-PLAYER.moveSpeed); this.facing = -1; this.setFlipX(true); }
      else if (cursors.right.isDown) { this.setVelocityX(PLAYER.moveSpeed); this.facing = 1; this.setFlipX(false); }
      else this.setVelocityX(0);

      if (cursors.up.isDown && this.body.blocked.down) this.setVelocityY(-PLAYER.jumpVelocity);

      if (Phaser.Input.Keyboard.JustDown(keys.J)) this.attack();
      if (Phaser.Input.Keyboard.JustDown(keys.K)) this.useSkill();
    }

    // ═══════════════════════════════════════════════════════════
    // ★ 灵盾每帧维护（始终运行，遁术时按 L 仍可举盾，无害）
    // ═══════════════════════════════════════════════════════════
    this.shieldActive = !!this.keyL && this.keyL.isDown && this.active && this.hp > 0;
    if (this.shieldFlash > 0) this.shieldFlash -= delta;
    this.updateShieldVisual();
  }

  /* ───────── ★ 画灵盾绿光圈（呼吸脉冲 + 受击闪白） ───────── */
  updateShieldVisual() {
    const g = this.shieldGfx;
    g.clear();
    if (!this.shieldActive) return;

    const b  = this.getBounds();
    const cx = b.centerX, cy = b.centerY;
    const t  = this.scene.time.now;
    const r  = Math.max(b.width, b.height) * 0.62 + Math.sin(t * 0.01) * 3;

    const flashing = this.shieldFlash > 0;
    const edgeCol  = flashing ? 0xffffff : 0x22ff88;
    const edgeA    = flashing ? 0.95 : (0.55 + Math.sin(t * 0.012) * 0.2);
    const fillA    = flashing ? 0.30 : 0.12;

    g.fillStyle(0x22ff88, fillA);              g.fillCircle(cx, cy, r);
    g.lineStyle(3, edgeCol, edgeA);            g.strokeCircle(cx, cy, r);
    g.lineStyle(1, 0xbbffd9, edgeA * 0.7);     g.strokeCircle(cx, cy, r * 0.78);
  }

  /* ───────── ★ 格挡反馈：身体中心爆一簇绿粒子 ───────── */
  spawnShieldBlockFx() {
    const b  = this.getBounds();
    const cx = b.centerX, cy = b.centerY;
    const d  = (this.depth || 0);

    const flash = this.scene.add.circle(cx, cy, 12, 0x86efac, 0.9).setDepth(d + 25);
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 2.2, duration: 160, onComplete: () => flash.destroy() });

    const cols = [0x22ff88, 0x86efac, 0xffffff];
    for (let i = 0; i < 7; i++) {
      const dot = this.scene.add.circle(cx, cy, Phaser.Math.Between(2, 4), cols[i % 3], 1).setDepth(d + 25);
      const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const dist = Phaser.Math.Between(14, 30);
      this.scene.tweens.add({
        targets: dot,
        x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist,
        alpha: 0, duration: Phaser.Math.Between(180, 300),
        onComplete: () => dot.destroy()
      });
    }
  }
}