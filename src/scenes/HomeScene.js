import Phaser from 'phaser';

export default class HomeScene extends Phaser.Scene {
  constructor() { super('Home'); }
  create() {
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x10141f);
    this.add.text(W / 2, H * 0.22, '凡人修仙传', { fontSize: '52px', color: '#ffcc33', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

    // 栏目一：原闯关
    this.card(W / 2, H * 0.50, '韩 立 闯 关', '原汁原味·闯关飞升', () => {
      this.scene.start('GameScene'); // 你原来的闯关场景
    });
    // 栏目二：格斗
    this.card(W / 2, H * 0.70, '韩立 VS 温天仁', '拳皇式·斗法对决', () => this.scene.start('FightSelect'));
  }
  card(x, y, title, sub, cb) {
    const box = this.add.rectangle(x, y, 360, 80, 0x1c2230, 0.9).setStrokeStyle(2, 0x3a4458).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 12, title, { fontSize: '26px', color: '#ffcc33' }).setOrigin(0.5);
    this.add.text(x, y + 20, sub, { fontSize: '14px', color: '#9aa' }).setOrigin(0.5);
    box.on('pointerover', () => box.setFillStyle(0x283044));
    box.on('pointerout', () => box.setFillStyle(0x1c2230));
    box.on('pointerdown', cb);
    // （已删除错误的 this.add([t1, t2])：text 创建时已自动显示，无需再加）
  }
}