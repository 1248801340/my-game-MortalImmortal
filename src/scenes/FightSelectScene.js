import Phaser from 'phaser';

export default class FightSelectScene extends Phaser.Scene {
  constructor() { super('FightSelect'); }
  create() {
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x10141f);
    this.add.text(W / 2, H * 0.28, '韩立  VS  温天仁', { fontSize: '40px', color: '#ffcc33', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.40, '选择对战模式', { fontSize: '18px', color: '#aaa' }).setOrigin(0.5);

    this.btn(W / 2, H * 0.55, '人 机 对 战', () => this.scene.start('KofFight', { mode: 'pve' }));
    this.btn(W / 2, H * 0.68, '双 人 对 决', () => this.scene.start('KofFight', { mode: 'pvp' }));
    this.add.text(W / 2, H * 0.85, '← 返回首页', { fontSize: '16px', color: '#888' }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('Home'));
  }
  btn(x, y, label, cb) {
    const box = this.add.rectangle(x, y, 260, 52, 0x2a3142).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '22px', color: '#fff' }).setOrigin(0.5);
    box.on('pointerover', () => box.setFillStyle(0x3a4458));
    box.on('pointerout', () => box.setFillStyle(0x2a3142));
    box.on('pointerdown', cb);
    // （已删除错误的 this.add([txt])：text 创建时已自动显示）
  }
}