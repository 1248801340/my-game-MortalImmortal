import { REALMS } from '../utils/constants.js';

export default class UIManager {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.hpBg = scene.add.rectangle(20, 20, 180, 18, 0x1e293b).setOrigin(0, 0).setScrollFactor(0).setDepth(50).setStrokeStyle(1, 0x475569);
    this.hpBar = scene.add.rectangle(21, 21, 178, 16, 0x22c55e).setOrigin(0, 0).setScrollFactor(0).setDepth(51);
    this.hpText = scene.add.text(110, 29, '', { fontSize: '11px', fill: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(52);
    this.mpBg = scene.add.rectangle(20, 44, 140, 12, 0x1e293b).setOrigin(0, 0).setScrollFactor(0).setDepth(50).setStrokeStyle(1, 0x475569);
    this.mpBar = scene.add.rectangle(21, 45, 138, 10, 0x3b82f6).setOrigin(0, 0).setScrollFactor(0).setDepth(51);
    this.realmText = scene.add.text(20, 64, '', { fontSize: '13px', fill: '#fbbf24' }).setScrollFactor(0).setDepth(52);
    this.treasureText = scene.add.text(20, 84, '', { fontSize: '11px', fill: '#a78bfa' }).setScrollFactor(0).setDepth(52);
    this.helpText = scene.add.text(scene.scale.width - 20, scene.scale.height - 16, 'WASD/方向键移动  J攻击  K技能', {
      fontSize: '11px', fill: '#64748b'
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(52);
  }
  update() {
    const p = this.player;
    const hpRatio = p.hp / p.maxHp;
    this.hpBar.width = 178 * hpRatio;
    this.hpBar.fillColor = hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.25 ? 0xeab308 : 0xef4444;
    this.hpText.setText(`${p.hp} / ${p.maxHp}`);
    this.mpBar.width = 138 * (p.mp / p.maxMp);
    const realm = REALMS[p.realm];
    this.realmText.setText(`境界：${realm ? realm.name : '凡人'}`);
    this.treasureText.setText(p.treasures.length > 0 ? `法宝：${p.treasures.length}件` : '');
  }
}