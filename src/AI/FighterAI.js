import { SLOT } from '../entities/KofFighter.js';

const IDEAL = 150, TOO_CLOSE = 90, MID = 320, ATK_RANGE = 170;

export default class FighterAI {
  constructor(fighter) {
    this.f = fighter;
    this.cd = [0, 0, 0, 0, 0, 0];   // 每槽冷却
    this.think = 0; this.jumpCd = 0;
  }

  tick(target, dt) {
    const f = this.f, n = f.scene.time.now;
    const input = { left: false, right: false, up: false, down: false };
    if (!f.alive || !target.alive) return input;
    for (let i = 0; i < 6; i++) this.cd[i] = Math.max(0, this.cd[i] - dt);
    this.think -= dt; this.jumpCd -= dt;

    const busy = f.charging || f.stunned || n < f.dodgeUntil;
    const dx = target.x - f.x, dist = Math.abs(dx), dir = Math.sign(dx) || 1;

    // 威胁检测：敌方投射物逼近 → 高概率闪避
    let threat = false;
    f.projGroup.getChildren().forEach(p => {
      if (p.owner !== f.id && Math.abs(p.y - f.y) < 60 && (p.x - f.x) * -dir > 0 && Math.abs(p.x - f.x) < 150) threat = true;
    });
    if (threat && this.cd[SLOT.DODGE] <= 0 && Math.random() < 0.6) { this.use(SLOT.DODGE); f._lastMoveDir = -dir; }

    if (!busy) {
      // 大招：残血或开场一段时间后
      if (this.cd[SLOT.ULT] <= 0 && (f.hp / f.maxHp < 0.4 || (n > 6000 && Math.random() < 0.01))) this.use(SLOT.ULT);
      // 定身雾：中距离
      else if (this.cd[SLOT.CHARGE] <= 0 && dist < MID && Math.random() < 0.02) this.use(SLOT.CHARGE);
      // 金光镜：中距离
      else if (this.cd[SLOT.SPECIAL] <= 0 && dist < MID && Math.random() < 0.02) this.use(SLOT.SPECIAL);
      // 近身输出
      else if (dist < ATK_RANGE && this.cd[SLOT.ATK] <= 0) this.use(Math.random() < 0.6 ? SLOT.ATK : SLOT.SKILL);

      // 走位
      if (f.charging) { /* 蓄力原地 */ }
      else if (dist > IDEAL) { if (dir > 0) input.right = true; else input.left = true; }
      else if (dist < TOO_CLOSE && Math.random() < 0.4) { if (dir > 0) input.left = true; else input.right = true; }
      // 偶尔跳
      if (this.jumpCd <= 0 && Math.random() < 0.01) { input.up = true; this.jumpCd = 1200; }
    }
    return input;
  }

  use(i) { if (this.cd[i] <= 0) { this.f.useSlot(i); this.cd[i] = 500 + Math.random() * 1100; } }
}