import Phaser from 'phaser';

export default class StartScene extends Phaser.Scene {
  constructor() { super('StartScene'); }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // 背景装饰
    this.add.rectangle(cx, cy, 960, 540, 0x0f172a);

    // 标题
    this.add.text(cx, cy - 100, '凡人修仙传', {
      fontSize: '48px', fill: '#fbbf24', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(cx, cy - 50, '韩 立 闯 关', {
      fontSize: '28px', fill: '#e2e8f0'
    }).setOrigin(0.5);

    // 开始按钮
    const btn = this.add.text(cx, cy + 40, '【 点击开始修炼 】', {
      fontSize: '22px', fill: '#e2e8f0', backgroundColor: '#1e293b',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#fbbf24'));
    btn.on('pointerout', () => btn.setColor('#e2e8f0'));
    btn.on('pointerdown', () => this.scene.start('GameScene', { level: 0 }));

    // 操作说明
    this.add.text(cx, cy + 120, '← → 移动 | ↑ 跳跃 | J 攻击 | K 技能', {
      fontSize: '14px', fill: '#64748b'
    }).setOrigin(0.5);

    this.add.text(cx, cy + 150, '击败BOSS获取法宝，突破境界，最终飞升！', {
      fontSize: '13px', fill: '#475569'
    }).setOrigin(0.5);
  }
}