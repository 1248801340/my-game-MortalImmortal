import KofFighter, { SLOT, ATK_CD } from './KofFighter.js';

const TRANSFORM_MS = 6000;
const REGEN = 16;
const MP = { SKILL: 20, CHARGE: 35, SPECIAL: 30, ULT: 50 };
const DISC_HP = 160;

export default class WenTianRen extends KofFighter {
  useSlot(i) {
    if (i === SLOT.DODGE) return this.doDodge();
    if (!this.canAct()) return;
    const n = this.scene.time.now;
    const foe = this.scene.foeOf(this);
    switch (i) {
      case SLOT.ATK:
        if (n < this.atkCdUntil) return;
        this.atkCdUntil = n + ATK_CD;
        this.attackUntil = n + 200; this.playActPose('shifa', 220); this.spawnFx();
        this.spawnProj({ key: 'kf_ice', dx: 30, vx: 850, damage: 35, knockX: 120, life: 800, consumeOnHit: true }); break;

      case SLOT.SKILL:  if (!this.trySpend(MP.SKILL)) return;
        this.attackUntil = n + 180; this.playActPose('shifa', 200); this.spawnFx();
        this.spawnProj({ key: 'kf_needle', dx: 30, vx: 1150, damage: 24, knockX: 70, life: 700, consumeOnHit: true }); break;

      case SLOT.CHARGE: if (!this.trySpend(MP.CHARGE)) return;
        this.charging = true; this.chargeStart = n; this.chargeProgress = 0; this.setVelocityX(0); this.curVx = 0; break;

      case SLOT.SPECIAL: if (this.shield && this.shield.type === 'disc') return;
        if (!this.trySpend(MP.SPECIAL)) return;
        this.raiseShield('disc', DISC_HP); this.attackUntil = n + 350; this.playActPose('shifa', 350); break;

      case SLOT.ULT:    if (!this.alive || this.transformed || this.stunned) return;
        if (!this.trySpend(MP.ULT)) return;
        this.transformUntil = n + TRANSFORM_MS; this.regenPerSec = REGEN; this.playActPose('shifa', 500); this.spawnFx();
        if (foe) this.scene.spawnMinions(this, foe); break;
    }
  }

  releaseCharge() {
    this.charging = false; this.chargeProgress = 0; this.attackUntil = this.scene.time.now + 400;
    this.playActPose('shifa', 400); this.spawnFx();
    this.spawnProj({ key: 'kof_fog', dx: 40, vx: 300, damage: 0, knockX: 0, life: 1600, consumeOnHit: true, stunMs: 2000 });
  }
}