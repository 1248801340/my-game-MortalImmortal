export const GAME_CONFIG = {
  width: 960,
  height: 540,
  gravity: 1200,
  debug: false,
};

export const PLAYER = {
  displayHeight: 72,
  moveSpeed: 240,
  jumpVelocity: 480,
  attackCooldown: 300,
  attackDamage: 25,
  skillCooldown: 2000,
  skillDamage: 60,
  maxHp: 100,
  maxMp: 100,           // 灵力
  mpRegen: 5,           // 每秒回灵
  hitbox: { widthRatio: 1.4, heightRatio: 0.6, forwardRatio: 0.9 },
  skillRange: { width: 200, height: 80 },
};

export const ENEMY = {
  speed: 70,
  hp: 50,
  damage: 10,
  attackRange: 40,
  attackCooldown: 1500,
};

export const BOSS = {
  speed: 50,
  hp: 500,
  damage: 20,
  phases: 3,            // 3个阶段
};

// 境界数据
export const REALMS = [
  { name: '炼气期', level: 1, hpBonus: 0,   dmgBonus: 0 },
  { name: '筑基期', level: 2, hpBonus: 50,  dmgBonus: 10 },
  { name: '结丹期', level: 3, hpBonus: 120, dmgBonus: 25 },
  { name: '元婴期', level: 4, hpBonus: 200, dmgBonus: 50 },
];

// 法宝数据
export const TREASURES = [
  { id: 'golden_brick', name: '金光砖', desc: '普攻附带眩晕', from: '墨老' },
  { id: 'jiao_armor',   name: '蛟鳞甲', desc: '受伤减免30%', from: '墨蛟' },
  { id: 'blood_pearl',  name: '血煞珠', desc: '攻击吸血10%', from: '血煞教教主' },
  { id: 'spider_silk',  name: '蛛丝缚', desc: '技能附带定身2s', from: '血玉蜘蛛' },
];

export const LEVELS = ['level1', 'level2', 'level_boss1', 'level3', 'level_boss2', 'level4', 'level_boss3', 'level5', 'level_boss4'];

export const ASSET_PATHS = {
  player_idle:   '/assets/images/player_idle.png',
  player_attack: '/assets/images/player_attack.png',
  player_skill:  '/assets/images/player_skill.png',
  level1:        '/assets/levels/level_1.json',
  level2:        '/assets/levels/level_2.json',
  level_boss:    '/assets/levels/level_boss.json',
};