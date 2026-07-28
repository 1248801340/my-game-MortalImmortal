import KofFighter, { SLOT } from './KofFighter.js';

const TRANSFORM_MS = 6000;   // ★ 与韩立风雷翅(FLY_DUR=6s)一致
const REGEN = 16;            // 魔化回血 16/s

export default class WenTianRen extends KofFighter {
  useSlot(i) {
    if (i === SLOT.DODGE) return this.doDodge();
    if (!this.canAct()) return;
    const n = this.scene.time.now;
    const foe = this.scene.foeOf(this);
    switch (i) {
      case SLOT.ATK:    this.attackUntil = n + 200; this.playActPose('shifa', 220); this.spawnFx();
        this.spawnProj({ key: 'kf_ice', dx: 30, vx: 850, damage: 35, knockX: 120, life: 800, consumeOnHit: true }); break;
      case SLOT.SKILL:  this.attackUntil = n + 180; this.playActPose('shifa', 200); this.spawnFx();
        this.spawnProj({ key: 'kf_needle', dx: 30, vx: 1150, damage: 24, knockX: 70, life: 700, consumeOnHit: true }); break;
      case SLOT.CHARGE: this.charging = true; this.chargeStart = n; this.chargeProgress = 0; this.setVelocityX(0); this.curVx = 0; break;
      case SLOT.SPECIAL: this.attackUntil = n + 350; this.playActPose('shifa', 350); this.spawnFx();
        if (foe) this.scene.spawnMirror(this, foe); break;
      case SLOT.ULT:    if (!this.alive || this.transformed || this.stunned) return;
        this.transformUntil = n + TRANSFORM_MS; this.regenPerSec = REGEN; this.playActPose('shifa', 500); this.spawnFx();
        if (foe) this.scene.spawnMinions(this, foe); break;   // 陆续召 6 怪（scene 内计时）
    }
  }

  releaseCharge() {   // 紫云幡 → 紫色定身雾，定 2s，无伤害
    this.charging = false; this.chargeProgress = 0; this.attackUntil = this.scene.time.now + 400;
    this.playActPose('shifa', 400); this.spawnFx();
    this.spawnProj({ key: 'kof_fog', dx: 40, vx: 300, damage: 0, knockX: 0, life: 1600, consumeOnHit: true, stunMs: 2000 });
  }
}