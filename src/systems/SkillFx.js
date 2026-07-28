import Phaser from 'phaser';

/* ═══════════════════════════════════════════════════════════════════
   纯程序化技能特效引擎 —— 零图片依赖
   所有视觉参数集中在 SKILL_FX_CONFIG，想调手感/华丽度改这里即可。
   方法均为“纯视觉”：只画，不造成任何伤害（伤害归 Player/Boss 管）。
     hanliSlash(x, y, facingRight)   韩立 K：月牙剑气 + 拖尾 + 速度线 + 脉冲 + 震屏
     silverPalm(fromX,fromY,toX,toY) 墨老：银白魔掌飞行体 + 旋转爪痕 + 拖尾 + 命中爆
     impactBurst(x, y, color, n)     通用命中爆点（将来可挂到伤害命中处）
   ═══════════════════════════════════════════════════════════════════ */
export const SKILL_FX_CONFIG = {
  hanli: {
    arcColor: 0x7df9ff,        // 青白刃色
    coreColor: 0xffffff,       // 刃心高亮
    trailColor: 0xa5f3fc,      // 拖尾
    pulseColor: 0x67e8f9,      // 径向脉冲环
    speedLineColor: 0xe0fbff,  // 速度线
    arcRadius: 46,             // 月牙半径（越大刃越长）
    arcThickness: 9,           // 刃线宽
    reach: 72,                 // 挥出前冲距离
    duration: 260,             // 挥斩时长 ms（越小越凌厉）
    trailCount: 10,            // 拖尾粒子数
    speedLineCount: 5,         // 速度线数
    shakeDuration: 120,        // 震屏时长
    shakeIntensity: 0.0045,    // 震屏强度（0.002 轻 / 0.01 重）
    scale: 1.0,                // 整体缩放
  },
  molao: {
    coreColor: 0xe5e7eb,       // 银白核
    glowColor: 0xc7d2fe,       // 光环
    clawColor: 0xf8fafc,       // 爪痕
    trailColor: 0xa5b4fc,      // 拖尾
    burstColor: 0xe0e7ff,      // 命中爆色
    coreRadius: 16,            // 核半径
    speed: 360,                // 飞行像素/秒（越大越快）
    trailInterval: 40,         // 拖尾采样间隔 ms
    burstParticles: 14,        // 命中爆粒子数
    scale: 1.0,
  },
};

export default class SkillFx {
  constructor(scene) {
    this.scene = scene;
    this.cfg = SKILL_FX_CONFIG;
  }

  /* ───────── 韩立挥斩：程序化月牙剑气 ───────── */
  hanliSlash(x, y, facingRight, opts = {}) {
    const s = this.scene;
    const c = Object.assign({}, this.cfg.hanli, opts);
    const dir = facingRight ? 1 : -1;
    const cx = x + dir * 30;                 // 刃心偏到身前

    // 视觉容器（高于实体、低于 UI）
    const layer = s.add.container(cx, y).setDepth(50);
    const glow = s.add.graphics();
    const blade = s.add.graphics();
    layer.add(glow); layer.add(blade);

    // 画“朝朝向凸出”的月牙：外辉光两层 + 内亮刃 + 细芯
    const drawArc = (g, color, width, alpha, r) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      const base = facingRight ? 0 : Math.PI;
      g.arc(0, 0, r, base - 1.2, base + 1.2, false);
      g.strokePath();
    };
    drawArc(glow, c.arcColor, c.arcThickness + 9, 0.22, c.arcRadius);
    drawArc(glow, c.arcColor, c.arcThickness + 4, 0.45, c.arcRadius);
    drawArc(blade, c.coreColor, c.arcThickness, 0.95, c.arcRadius);
    drawArc(blade, c.arcColor, 2, 1, c.arcRadius - 6);

    layer.setScale(0.3 * c.scale).setAlpha(1);

    // 挥出：放大 + 前冲 + 微旋 + 淡出
    s.tweens.add({
      targets: layer,
      scaleX: { from: 0.3 * c.scale, to: 1.25 * c.scale },
      scaleY: { from: 0.5 * c.scale, to: 1.10 * c.scale },
      x: cx + dir * c.reach,
      angle: facingRight ? 18 : -18,
      alpha: { from: 1, to: 0 },
      duration: c.duration, ease: 'Cubic.Out',
      onComplete: () => layer.destroy(),
    });

    // 径向脉冲环
    this._pulse(cx, y, c.pulseColor, 12, 72, c.duration);

    // 拖尾粒子（沿挥出路径洒落）
    for (let i = 0; i < c.trailCount; i++) {
      s.time.delayedCall(i * 16, () => {
        if (!layer.active) return;
        const p = s.add.circle(
          layer.x, layer.y + Phaser.Math.Between(-18, 18),
          Phaser.Math.FloatBetween(2, 4), c.trailColor, 0.8
        ).setDepth(49);
        s.tweens.add({
          targets: p, alpha: 0,
          x: p.x - dir * Phaser.Math.Between(8, 24),
          y: p.y + Phaser.Math.Between(-10, 10),
          duration: 300, onComplete: () => p.destroy(),
        });
      });
    }

    // 速度线（刃后方向反射）
    for (let i = 0; i < c.speedLineCount; i++) {
      const ang = Phaser.Math.DegToRad(Phaser.Math.Between(-35, 35));
      const len = Phaser.Math.Between(14, 30);
      const lx = cx + dir * Phaser.Math.Between(6, 20);
      const ly = y + Phaser.Math.Between(-22, 22);
      const line = s.add.graphics().setDepth(48);
      line.lineStyle(2, c.speedLineColor, 0.7);
      line.beginPath();
      line.moveTo(lx, ly);
      line.lineTo(lx - dir * Math.cos(ang) * len, ly + Math.sin(ang) * len);
      line.strokePath();
      s.tweens.add({ targets: line, alpha: 0, duration: 200, delay: i * 20, onComplete: () => line.destroy() });
    }

    // 出招顿帧感：屏幕微震
    if (s.cameras && s.cameras.main) s.cameras.main.shake(c.shakeDuration, c.shakeIntensity);
  }

  /* ───────── 墨老魔银手：银白飞行体 ───────── */
  silverPalm(fromX, fromY, toX, toY, opts = {}) {
    const s = this.scene;
    const c = Object.assign({}, this.cfg.molao, opts);
    const dist = Math.hypot(toX - fromX, toY - fromY) || 1;
    const dur = (dist / c.speed) * 1000;

    const layer = s.add.container(fromX, fromY).setDepth(55);
    const halo = s.add.graphics();
    const claws = s.add.graphics();
    const core = s.add.graphics();
    layer.add(halo); layer.add(claws); layer.add(core);

    // 银白核
    core.fillStyle(c.coreColor, 0.95); core.fillCircle(0, 0, c.coreRadius);
    core.fillStyle(0xffffff, 0.9);     core.fillCircle(0, 0, c.coreRadius * 0.5);
    // 五道爪痕
    claws.lineStyle(3, c.clawColor, 0.85);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      claws.beginPath();
      claws.moveTo(Math.cos(a) * c.coreRadius * 0.8, Math.sin(a) * c.coreRadius * 0.8);
      claws.lineTo(Math.cos(a) * c.coreRadius * 2.0, Math.sin(a) * c.coreRadius * 2.0);
      claws.strokePath();
    }

    // 飞行
    s.tweens.add({
      targets: layer, x: toX, y: toY, duration: dur, ease: 'Linear',
      onComplete: () => { this.impactBurst(toX, toY, c.burstColor, c.burstParticles); layer.destroy(); },
    });
    // 爪痕旋转
    s.tweens.add({ targets: claws, angle: 360, duration: 900, repeat: -1 });
    // 光环脉动
    const ho = { r: c.coreRadius * 1.2, a: 0.6 };
    s.tweens.add({
      targets: ho, r: c.coreRadius * 2.2, a: 0.1, duration: 500, yoyo: true, repeat: -1,
      onUpdate: () => { halo.clear(); halo.lineStyle(3, c.glowColor, ho.a); halo.strokeCircle(0, 0, ho.r); },
    });

    // 飞行拖尾
    const trail = s.time.addEvent({
      delay: c.trailInterval, loop: true,
      callback: () => {
        if (!layer.active) { trail.destroy(); return; }
        const t = s.add.circle(layer.x, layer.y, Phaser.Math.FloatBetween(3, 6), c.trailColor, 0.6).setDepth(54);
        s.tweens.add({ targets: t, alpha: 0, scale: 0.2, duration: 300, onComplete: () => t.destroy() });
      },
    });
    s.time.delayedCall(dur + 60, () => { if (trail) trail.destroy(); });
  }

  /* ───────── 通用命中爆点 ───────── */
  impactBurst(x, y, color = 0xffffff, n = 12) {
    const s = this.scene;
    this._pulse(x, y, color, 6, 46, 260);
    for (let i = 0; i < n; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const sp = Phaser.Math.FloatBetween(40, 120);
      const p = s.add.circle(x, y, Phaser.Math.FloatBetween(1.5, 3.5), color, 1).setDepth(56);
      s.tweens.add({
        targets: p, x: x + Math.cos(a) * sp, y: y + Math.sin(a) * sp,
        alpha: 0, scale: 0.3, duration: Phaser.Math.Between(260, 420), ease: 'Cubic.Out',
        onComplete: () => p.destroy(),
      });
    }
    const flash = s.add.circle(x, y, 10, 0xffffff, 0.9).setDepth(57);
    s.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
  }

  /* ── 内部：径向扩散环 ── */
  _pulse(x, y, color, r0, r1, dur) {
    const s = this.scene;
    const g = s.add.graphics().setDepth(48);
    const o = { r: r0, a: 0.7 };
    s.tweens.add({
      targets: o, r: r1, a: 0, duration: dur, ease: 'Cubic.Out',
      onUpdate: () => { g.clear(); g.lineStyle(3, color, o.a); g.strokeCircle(x, y, o.r); },
      onComplete: () => g.destroy(),
    });
  }
}