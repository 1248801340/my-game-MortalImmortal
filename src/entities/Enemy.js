import Phaser from 'phaser';
import { ENEMY } from '../utils/constants.js';
import { measureAlphaBounds } from '../utils/helpers.js';

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, cfg = {}) {
    const hasSprite = !!cfg.sprite && scene.textures.exists(cfg.sprite + '_idle');
    const texKey = hasSprite ? cfg.sprite + '_idle' : 'enemy_placeholder';
    super(scene, x, y, texKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.cfg = cfg;
    this.hasSprite = hasSprite;
    this.ranged = !!cfg.ranged;
    this.spriteKey = cfg.sprite;
    this.spriteHeight = cfg.spriteHeight || 72;

    this.maxHp = cfg.hp || ENEMY.hp;
    this.hp = this.maxHp;
    this.speed = cfg.speed || ENEMY.speed;
    this.damage = cfg.damage || ENEMY.damage;
    this.color = cfg.color || 0xffffff;
    this.name = cfg.name || '妖物';

    this.attackRange = cfg.attackRange || ENEMY.attackRange;     // 近战贴脸距离
    this.attackCooldownMax = cfg.attackCooldown || ENEMY.attackCooldown;
    this.attackTimer = 0;
    this.stunTimer = 0;
    this.attackPoseTimer = 0;
    this.dead = false;
    this.facing = -1;

    // 远程参数
    this.maxR = cfg.maxRange || 360;        // 超过就走近
    this.waveSpeed = cfg.waveSpeed || 280;
    this.waveDamage = cfg.waveDamage || this.damage;
    this.waves = [];

    // ★ 银色手掌独立通道（所有 enemy 都初始化，die() 清理时才不会 undefined）
    this.palms = [];

    // ★ Boss 身份（墨老）：开启 3 秒一次的银色手掌技能
    this.isBoss = !!cfg.boss;
    if (this.isBoss) {
      this.skillCooldown = cfg.skillCooldown || 3000;     // 技能间隔 3s
      this.skillTimer = (cfg.skillDelay != null) ? cfg.skillDelay : 1200; // 出场缓冲，别秒拍
      this.palmSpeed = cfg.palmSpeed || 300;              // 手掌飞行速度
      this.palmDamage = cfg.palmDamage || 28;             // 手掌伤害（高）
    }

    if (this.hasSprite) {
      this.setPose(texKey);                 // 设 scale / 中心锚点 / body
    } else {
      this.setTint(this.color);             // 色块染色
    }
  }

  /* 切帧：保持中心锚点 + 恒定显示高度，切攻击/死亡不会上下/左右跳 */
  setPose(key) {
    if (!this.scene.textures.exists(key)) return;
    this.setTexture(key);
    const img = this.texture.getSourceImage();
    const iw = img.width, ih = img.height;
    let b; try { b = measureAlphaBounds(img); } catch (e) { b = { x: 0, y: 0, w: iw, h: ih }; }
    const scale = this.spriteHeight / b.h;
    this.setScale(scale);
    this.setOrigin(0.5, 0.5);               // ★ 中心锚点，匹配血条/落地公式
    this.body.setSize(b.w, b.h);
    this.body.setOffset(b.x, b.y);
  }

  /* ───────── 每帧 AI ───────── */
  update(player) {
    if (this.dead || !player || !player.active) return;
    const dt = this.scene.game.loop.delta;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.attackPoseTimer > 0) {
      this.attackPoseTimer -= dt;
      if (this.attackPoseTimer <= 0 && this.hasSprite) this.setPose(this.spriteKey + '_idle');
    }

    // 眩晕：定身、不射、不打、不放技能（但已发出的波/手掌继续飞）
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.setVelocityX(0);
      this.updateWaves(player);
      this.updatePalms(player);             // ★ 已拍出的手掌眩晕期间仍飞行+命中
      return;
    }

    const dx = player.x - this.x;
    const adx = Math.abs(dx);
    this.facing = dx >= 0 ? 1 : -1;
    this.setFlipX(this.facing < 0);         // 图默认朝右

    if (this.ranged) {
      if (adx > this.maxR) this.setVelocityX(this.facing * this.speed);  // 太远：走近
      else {                                                              // 射程内：站定射
        this.setVelocityX(0);
        if (this.attackTimer <= 0) this.fireWave(player);               // 平 A 波
      }
    } else {
      if (adx > this.attackRange) this.setVelocityX(this.facing * this.speed);
      else { this.setVelocityX(0); if (this.attackTimer <= 0) this.meleeAttack(player); }
    }

    // ★ 墨老技能：独立计时，CD 到就拍银色手掌（与平 A 并行；眩晕时上面已 return）
    if (this.isBoss) {
      if (this.skillTimer > 0) this.skillTimer -= dt;
      if (this.skillTimer <= 0) {
        this.castSilverPalm(player);
        this.skillTimer = this.skillCooldown;
      }
    }

    this.updateWaves(player);
    this.updatePalms(player);               // ★ 银色手掌飞行 + 命中检测
  }

  /* ───────── 发射能量波（★ 墨老用深紫 molao_wave，血煞用红 xuesha_wave） ───────── */
  fireWave(player) {
    this.attackTimer = this.attackCooldownMax;
    if (this.hasSprite) { this.setPose(this.spriteKey + '_attack'); this.attackPoseTimer = 300; }

    const sx = this.x + this.facing * (this.displayWidth * 0.5 + 8);
    const sy = this.y - this.displayHeight * 0.1;     // 胸口/抬手高度

    // ★ 按身份选波贴图：墨老→molao_wave（不存在则兜底红波，绝不报错）
    const want = this.isBoss ? 'molao_wave' : 'xuesha_wave';
    const waveTex = this.scene.textures.exists(want) ? want : 'xuesha_wave';

    const wave = this.scene.physics.add.sprite(sx, sy, waveTex);
    if (wave.body) wave.body.setAllowGravity(false);   // 关重力，能量波才不会往下掉
    wave.setVelocityX(this.facing * this.waveSpeed);
    wave.setFlipX(this.facing < 0);
    wave.setDepth(5);
    wave.damage = this.waveDamage;                      // ★ 墨老 cfg.waveDamage 设高 → "伤害很高"
    this.scene.tweens.add({ targets: wave, alpha: { from: 1, to: 0.55 }, duration: 160, yoyo: true, repeat: 2 });
    this.waves.push(wave);
  }

  meleeAttack(player) {
    this.attackTimer = this.attackCooldownMax;
    if (this.hasSprite) { this.setPose(this.spriteKey + '_attack'); this.attackPoseTimer = 300; }
    player.hurt(this.damage);
  }

  /* ───────── ★ 墨老专属技能：银色手掌（瞄准玩家当前位置直线拍出） ───────── */
  castSilverPalm(player) {
    if (!this.scene.textures.exists('molao_palm')) return;   // 纹理缺失则本拍跳过（不报错）
    if (this.hasSprite) { this.setPose(this.spriteKey + '_skill'); this.attackPoseTimer = 500; }

    const sx = this.x + this.facing * (this.displayWidth * 0.5 + 6);
    const sy = this.y - this.displayHeight * 0.15;

    const palm = this.scene.physics.add.sprite(sx, sy, 'molao_palm');
    if (palm.body) palm.body.setAllowGravity(false);
    palm.setOrigin(0.5, 0.5);
    palm.setDepth(6);
    palm.damage = this.palmDamage;

    // 朝玩家"发射瞬间"的位置直线飞（不追踪 → 玩家可走位躲，有操作性）
    const angle = Phaser.Math.Angle.Between(sx, sy, player.x, player.y);
    palm.setVelocity(Math.cos(angle) * this.palmSpeed, Math.sin(angle) * this.palmSpeed);

    // 银光脉动，体现灵力
    this.scene.tweens.add({ targets: palm, alpha: { from: 1, to: 0.6 }, duration: 200, yoyo: true, repeat: -1 });

    this.palms.push(palm);
  }

  /* ───────── 投射物：手动 AABB 检测命中 + 出界自毁（无全局监听残留） ───────── */
  updateWaves(player) {
    const pb = player.getBounds();
    this.waves = this.waves.filter(w => {
      if (!w.active) return false;
      if (w.x < -60 || w.x > this.scene.scale.width + 60) { w.destroy(); return false; }

      const wb = w.getBounds();
      const hit = wb.x < pb.x + pb.width  && wb.x + wb.width  > pb.x &&
                  wb.y < pb.y + pb.height && wb.y + wb.height > pb.y;

      if (hit) {
        player.hurt(w.damage, 'ranged');   // ★ 标记远程，举盾时才 -80%
        this.spawnWaveHitFx(w.x, w.y);
        w.destroy();
        return false;
      }
      return true;
    });
  }

  /* ───────── ★ 银色手掌：独立检测，命中走全额伤害（boss 技能不被盾减） ───────── */
  updatePalms(player) {
    if (!this.palms.length) return;
    const pb = player.getBounds();
    this.palms = this.palms.filter(p => {
      if (!p.active) return false;
      const W = this.scene.scale.width, H = this.scene.scale.height;
      if (p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) { p.destroy(); return false; }

      const wb = p.getBounds();
      const hit = wb.x < pb.x + pb.width  && wb.x + wb.width  > pb.x &&
                  wb.y < pb.y + pb.height && wb.y + wb.height > pb.y;

      if (hit) {
        // ★ 全额伤害：boss 的银色手掌是杀招，不应被普通举盾抵消。
        //   若你希望举盾也能挡它，把下一行改成：player.hurt(p.damage, 'ranged');
        player.hurt(p.damage);
        this.spawnPalmHitFx(p.x, p.y);
        p.destroy();
        return false;
      }
      return true;
    });
  }

  spawnWaveHitFx(x, y) {
    const f = this.scene.add.circle(x, y, 10, 0xef4444, 0.9).setDepth(8);
    this.scene.tweens.add({ targets: f, alpha: 0, scale: 2, duration: 160, onComplete: () => f.destroy() });
    const cols = [0xef4444, 0xfca5a5, 0xffffff];
    for (let i = 0; i < 5; i++) {
      const d = this.scene.add.circle(x, y, Phaser.Math.Between(2, 4), cols[i % 3], 1).setDepth(8);
      const a = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const dist = Phaser.Math.Between(12, 28);
      this.scene.tweens.add({ targets: d, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, alpha: 0, duration: Phaser.Math.Between(180, 300), onComplete: () => d.destroy() });
    }
  }

  // ★ 银色手掌命中特效：银白爆 + 短促震屏 + 银片飞散
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

  /* ───────── 受击 / 眩晕 / 死亡 ───────── */
  hurt(dmg) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - dmg);
    const flash = this.hasSprite ? 0xff6666 : 0xffffff;
    this.setTint(flash);
    this.scene.time.delayedCall(80, () => {
      if (this.active && !this.dead) { this.hasSprite ? this.clearTint() : this.setTint(this.color); }
    });
    if (this.hp <= 0) this.die();
  }

  stun(ms) {
    if (this.dead) return;
    this.stunTimer = Math.max(this.stunTimer, ms);
    this.setTint(0xfbbf24);
    this.scene.time.delayedCall(ms, () => {
      if (this.active && !this.dead) { this.hasSprite ? this.clearTint() : this.setTint(this.color); }
    });
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.setVelocity(0, 0);
    if (this.hasSprite && this.scene.textures.exists(this.spriteKey + '_skill')) {
      this.setPose(this.spriteKey + '_skill');                  // 死亡帧
    }
    if (this.body) this.body.enable = false;                    // 停物理，不再被击退/碰撞
    if (this.scene.enemies) this.scene.enemies.remove(this, false); // 移出组 → 清怪判定立刻生效
    this.waves.forEach(w => { if (w.active) w.destroy(); }); this.waves = [];
    this.palms.forEach(p => { if (p && p.active) p.destroy(); }); this.palms = [];   // ★ 清银色手掌

    if (this.hasSprite) {
      this.scene.tweens.add({ targets: this, alpha: 0, y: this.y + 12, angle: this.facing * 10, duration: 450, onComplete: () => this.destroy() });
    } else {
      this.scene.tweens.add({ targets: this, alpha: 0, scale: 0.3, duration: 250, onComplete: () => this.destroy() });
    }
  }
}