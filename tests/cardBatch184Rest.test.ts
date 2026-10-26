import { describe, expect, it } from 'vitest';
import { totalAtk } from '../src/engine/combat';
import { query } from '../src/engine/effects';
import { Z } from '../src/engine/ops';
import { 捕熊陷阱狀態, 煉金印記狀態 } from '../src/engine/sources/merchant';
import { atkOf, names, pick, scenario, title } from './helpers';

const filler = Array(20).fill('黑桃2') as string[];
const log = (g: ReturnType<typeof scenario>) => g.state.log.join('\n');
const count = (g: ReturnType<typeof scenario>, text: string) => g.state.log.filter((l) => l.includes(text)).length;
/** 經驗區的卡名，裏側的前面加 ~ */
const exp = (g: ReturnType<typeof scenario>, p: 0 | 1, n = 99) => Z(g, p, 'exp').slice(0, n).map((c) => `${c.covered ? '~' : ''}${c.id}`);

/** 把這回合跑完，直到下一回合第一個提示為止 */
function toNextTurn(g: ReturnType<typeof scenario>) {
  while (g.pending && g.state.turn === 1) {
    const req = g.pending;
    g.submit(req.player, req.min === 0 ? [] : [req.options[0].key]);
  }
}

describe('我方出招時、對方出招時：新增的觸發窗口時機', () => {
  it('先攻方的窗口先處理：先攻方是出招者時，他的「我方出招時」先於對方的「對方出招時」', () => {
    // 玩家 1 先攻、先手打出煉金印記；玩家 0 的威嚇戰吼已在最上方，怒氣區多於玩家 1 的牌組
    const g = scenario({
      chars: ['勇者', '商人'], first: 1,
      p0: { moves: ['威嚇戰吼'], rage: Array(9).fill('黑桃1'), hand: [] },
      p1: { hand: ['煉金印記'], exp: ['黑桃3', '黑桃4', '黑桃5'], deck: Array(5).fill('黑桃2') },
      singlePhase: true,
    });
    // 煉金印記是玩家 1 自己的「我方出招時」：先問他；對方的威嚇戰吼還沒處理
    expect(title(g)).toContain('煉金印記');
    expect(count(g, '怒氣區多於對方牌組')).toBe(0);
    pick(g, '不發動');
    expect(count(g, '怒氣區多於對方牌組')).toBe(1);
    expect(names(g, 1, 'discard')).toEqual(['黑桃2']);
  });

  it('後攻方出招時，先攻方的「對方出招時」才處理；後攻方在反擊步驟打出的招式不啟用煉金印記', () => {
    const g = scenario({
      chars: ['勇者', '商人'], first: 0,
      p0: { moves: ['威嚇戰吼'], rage: Array(9).fill('黑桃1'), hand: [] },
      p1: { hand: ['煉金印記'], exp: ['黑桃3', '黑桃4', '黑桃5'], deck: Array(5).fill('黑桃2') },
      singlePhase: true,
    });
    // 玩家 0 沒有手牌，先手步驟沒有招式可出；玩家 1 在反擊步驟打出煉金印記
    pick(g, '煉金印記');
    expect(count(g, '怒氣區多於對方牌組')).toBe(1);
    expect(names(g, 1, 'discard')).toEqual(['黑桃2']);
    expect(煉金印記狀態.read(g, 1).armed).toBe(false);
  });
});

describe('威嚇戰吼：對方出招時，我方怒氣區卡片數 > 對方牌組卡片數，對方直擊 X', () => {
  /** 玩家 0（勇者）先手打出威嚇戰吼；玩家 1 的手牌由 hand 指定，牌組 deckSize 張 */
  const roar = (o: { rage: number; deckSize: number; hand: string[] }) =>
    scenario({
      chars: ['勇者', '刺客'], first: 0,
      p0: { hand: ['威嚇戰吼'], rage: Array(o.rage).fill('黑桃1') },
      p1: { hand: o.hand, deck: Array(o.deckSize).fill('黑桃2') },
      singlePhase: true,
    });

  it('對方第一次出招時 X 為 1，含剛打出的那張', () => {
    const g = roar({ rage: 9, deckSize: 8, hand: ['黑桃5', '黑桃4'] });
    pick(g, '黑桃5');
    expect(names(g, 1, 'discard')).toEqual(['黑桃2']);
    expect(log(g)).toContain('對方直擊 1');
  });

  it('疊越高 X 越大：對方第二次出招時 X 為 2', () => {
    const g = roar({ rage: 9, deckSize: 8, hand: ['黑桃5', '黑桃4'] });
    pick(g, '黑桃5'); // 直擊 1
    pick(g, '黑桃4'); // 玩家 0 沒有手牌，自動收招；玩家 1 繼續出招，戰鬥區 2 張，直擊 2
    expect(names(g, 1, 'discard')).toHaveLength(3);
    expect(log(g)).toContain('對方直擊 2');
  });

  it('怒氣區卡片數不大於對方牌組卡片數時不發動，也不問', () => {
    const g = roar({ rage: 8, deckSize: 8, hand: ['黑桃5', '黑桃4'] });
    pick(g, '黑桃5');
    expect(names(g, 1, 'discard')).toEqual([]);
    expect(count(g, '怒氣區多於對方牌組')).toBe(0);
  });

  it('每次出招都重新判斷條件：第一次不成立，牌組變少之後第二次成立', () => {
    const g = roar({ rage: 8, deckSize: 9, hand: ['黑桃5', '黑桃4'] });
    pick(g, '黑桃5');
    expect(names(g, 1, 'discard')).toEqual([]);
    Z(g, 1, 'deck').splice(0, 3); // 對方牌組剩 6 張，我方怒氣區 8 張
    pick(g, '黑桃4');
    expect(names(g, 1, 'discard')).toHaveLength(2); // 戰鬥區 2 張，直擊 2
  });

  it('不在招式卡疊最上方時不觸發', () => {
    const g = scenario({
      chars: ['勇者', '刺客'], first: 0,
      p0: { hand: ['威嚇戰吼', '黑桃4'], rage: Array(9).fill('黑桃1') },
      p1: { hand: ['黑桃5', '黑桃4'], deck: Array(8).fill('黑桃2') },
      singlePhase: true,
    });
    pick(g, '威嚇戰吼');
    pick(g, '黑桃5'); // 直擊 1
    pick(g, '黑桃4'); // 玩家 0 在威嚇戰吼上面再出黑桃4，威嚇戰吼被壓住
    pick(g, '黑桃4');
    expect(names(g, 1, 'discard')).toEqual(['黑桃2']);
    expect(count(g, '怒氣區多於對方牌組')).toBe(1);
  });

  it('對方的出招才算：我方自己出招不會觸發我方的威嚇戰吼', () => {
    const g = scenario({
      chars: ['勇者', '刺客'], first: 0,
      p0: { hand: ['威嚇戰吼'], rage: Array(9).fill('黑桃1'), deck: Array(8).fill('黑桃2') },
      p1: { hand: [] },
      singlePhase: true,
    });
    expect(names(g, 0, 'discard')).toEqual([]);
    expect(count(g, '怒氣區多於對方牌組')).toBe(0);
  });

  it('怒氣區牌面不公開：紀錄與直擊都沒有洩漏怒氣區的牌名', () => {
    const g = scenario({
      chars: ['勇者', '刺客'], first: 0,
      p0: { hand: ['威嚇戰吼'], rage: ['魅影射擊', '地雷陷阱', '二連矢', '黑桃3', '黑桃4', '黑桃5', '黑桃6', '黑桃7', '黑桃8'] },
      p1: { hand: ['黑桃5'], deck: Array(8).fill('黑桃2') },
      singlePhase: true,
    });
    pick(g, '黑桃5');
    for (const secret of ['魅影射擊', '地雷陷阱', '二連矢']) expect(log(g)).not.toContain(secret);
  });
});

describe('捕熊陷阱：表側經驗被蓋成裏側時，我方總攻擊在本回合結束前增加 3', () => {
  /** 玩家 0（商人）手上只有作假帳，打出後付蓋 1，蓋的是經驗區最前面的表側卡 */
  const trap = (expZone: string[]) =>
    scenario({
      chars: ['商人', '刺客'], first: 0,
      p0: { hand: ['作假帳'], exp: expZone },
      p1: { hand: [] },
      singlePhase: true,
    });

  it('被蓋成裏側時總攻擊 +3', () => {
    const g = trap(['捕熊陷阱', '黑桃3', '黑桃4']);
    pick(g, '發動'); // 作假帳蓋 1，蓋到捕熊陷阱
    expect(query(g, 0, 'flatAtk')).toBe(3);
    expect(totalAtk(g, 0)).toBe(atkOf('作假帳') + 3);
    expect(log(g)).toContain('【捕熊陷阱】');
  });

  it('不是它被蓋成裏側時不觸發', () => {
    const g = trap(['黑桃3', '捕熊陷阱', '黑桃4']);
    pick(g, '發動'); // 蓋的是黑桃3
    expect(query(g, 0, 'flatAtk')).toBe(0);
  });

  it('已經是裏側的捕熊陷阱不會再觸發', () => {
    const g = trap(['~捕熊陷阱', '黑桃3', '黑桃4']);
    pick(g, '發動');
    expect(query(g, 0, 'flatAtk')).toBe(0);
  });

  it('同時蓋到兩張各自加 3', () => {
    const g = scenario({
      chars: ['法師', '刺客'], first: 0,
      p0: { hand: ['冰茅'], exp: ['捕熊陷阱', '捕熊陷阱', '黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [] },
      singlePhase: true,
    });
    pick(g, '發動'); // 蓋 4：兩張捕熊陷阱與黑桃3、黑桃4；兩張同名強制效果併成一個選項，自動結算
    expect(query(g, 0, 'flatAtk')).toBe(6);
  });

  it('加成只在這回合，下回合消失', () => {
    const g = scenario({
      chars: ['商人', '刺客'], first: 0,
      p0: { hand: ['作假帳', '黑桃1'], exp: ['捕熊陷阱', '黑桃3', '黑桃4'], deck: filler },
      p1: { hand: ['黑桃9'], deck: filler },
      phase: '先手',
    });
    pick(g, '作假帳');
    pick(g, '發動');
    expect(捕熊陷阱狀態.read(g, 0).atk).toBe(3);
    toNextTurn(g);
    expect(g.state.turn).toBe(2);
    expect(捕熊陷阱狀態.read(g, 0).atk).toBe(0);
    expect(query(g, 0, 'flatAtk')).toBe(0);
  });
});

describe('作假帳：付蓋 1，將 1 張表側經驗放到經驗區最前方', () => {
  const book = (expZone: string[]) =>
    scenario({
      chars: ['商人', '刺客'], first: 0,
      p0: { hand: ['作假帳'], exp: expZone },
      p1: { hand: [] },
      singlePhase: true,
    });

  it('付蓋 1 後，選一張表側經驗放到最前方', () => {
    const g = book(['黑桃3', '黑桃4', '黑桃5']);
    pick(g, '發動');
    expect(title(g)).toContain('作假帳');
    pick(g, '黑桃5');
    expect(exp(g, 0, 3)).toEqual(['黑桃5', '~黑桃3', '黑桃4']);
  });

  it('可以選擇不發動，經驗區原封不動', () => {
    const g = book(['黑桃3', '黑桃4', '黑桃5']);
    pick(g, '不發動');
    expect(exp(g, 0, 3)).toEqual(['黑桃3', '黑桃4', '黑桃5']);
  });

  it('表側經驗只有 1 張時不提供發動，不白付費用', () => {
    const g = book(['~黑桃3', '黑桃4']);
    expect(g.pending).toBeNull();
    expect(exp(g, 0, 2)).toEqual(['~黑桃3', '黑桃4']);
  });

  it('沒有經驗時不提供發動', () => {
    const g = book([]);
    expect(g.pending).toBeNull();
  });

  it('裏側經驗不能選；放到的是整個經驗區的最前方，裏側的卡位置不動', () => {
    const g = book(['~黑桃1', '黑桃3', '~黑桃2', '黑桃4', '黑桃5']);
    pick(g, '發動'); // 蓋黑桃3
    expect(g.pending!.options.map((o) => o.label).sort()).toEqual(['黑桃4', '黑桃5']);
    pick(g, '黑桃4');
    expect(exp(g, 0, 5)).toEqual(['黑桃4', '~黑桃1', '~黑桃3', '~黑桃2', '黑桃5']);
  });
});

describe('煉金印記：先手步驟打出後，本回合我方每打出 1 張招式都可以將 1 張表側經驗放到最前方', () => {
  const stamp = (extra: { p0hand?: string[]; p1hand?: string[]; exp?: string[]; singlePhase?: boolean } = {}) =>
    scenario({
      chars: ['商人', '刺客'], first: 0,
      p0: { hand: ['煉金印記', ...(extra.p0hand ?? ['黑桃4'])], exp: extra.exp ?? ['黑桃3', '黑桃4', '黑桃5'], deck: filler },
      p1: { hand: extra.p1hand ?? ['黑桃5'], deck: filler },
      ...(extra.singlePhase === false ? { phase: '先手' as const } : { singlePhase: true }),
    });

  it('打出它的那一刻就能發動 1 次（含它自己）', () => {
    const g = stamp();
    pick(g, '煉金印記');
    expect(title(g)).toContain('煉金印記');
    pick(g, '發動');
    pick(g, '黑桃5');
    expect(exp(g, 0, 3)).toEqual(['黑桃5', '黑桃3', '黑桃4']);
  });

  it('之後每打出 1 張招式再發動 1 次', () => {
    const g = stamp();
    pick(g, '煉金印記');
    pick(g, '發動');
    pick(g, '黑桃5'); // 經驗區 [黑桃5, 黑桃3, 黑桃4]
    pick(g, '黑桃5'); // 玩家 1 反擊打出黑桃5
    pick(g, '黑桃4'); // 玩家 0 打出黑桃4（範圍 3~5 內）
    expect(title(g)).toContain('煉金印記');
    pick(g, '發動');
    pick(g, '黑桃4');
    expect(exp(g, 0, 3)).toEqual(['黑桃4', '黑桃5', '黑桃3']);
    expect(count(g, '放到經驗區最前方')).toBe(2);
  });

  it('可以選擇不發動，經驗區不變，下次打出仍可發動', () => {
    const g = stamp();
    pick(g, '煉金印記');
    pick(g, '不發動');
    expect(exp(g, 0, 3)).toEqual(['黑桃3', '黑桃4', '黑桃5']);
    pick(g, '黑桃5');
    pick(g, '黑桃4');
    expect(title(g)).toContain('煉金印記');
  });

  it('對方出招不算：只有我方打出招式才問', () => {
    const g = stamp({ p0hand: [] });
    pick(g, '不發動'); // 煉金印記自己
    pick(g, '黑桃5'); // 玩家 1 出招，玩家 0 沒有手牌，自動收招
    expect(g.pending).toBeNull();
  });

  it('只在先手步驟打出才啟用；反擊步驟打出不啟用', () => {
    const g = scenario({
      chars: ['刺客', '商人'], first: 0,
      p0: { hand: ['黑桃5'] },
      p1: { hand: ['煉金印記', '黑桃4'], exp: ['黑桃3', '黑桃4', '黑桃5'], deck: filler },
      singlePhase: true,
    });
    pick(g, '煉金印記'); // 反擊步驟打出
    expect(煉金印記狀態.read(g, 1).armed).toBe(false);
    expect(g.pending?.title ?? '').not.toContain('煉金印記');
  });

  it('表側經驗只有最前方 1 張、沒有可換位置的卡時不問', () => {
    const g = stamp({ exp: ['黑桃3'] });
    pick(g, '煉金印記');
    expect(title(g)).not.toContain('煉金印記');
  });

  it('下一回合不再作用', () => {
    const g = stamp({ singlePhase: false });
    pick(g, '煉金印記');
    pick(g, '不發動');
    expect(煉金印記狀態.read(g, 0).armed).toBe(true);
    toNextTurn(g);
    expect(g.state.turn).toBe(2);
    expect(煉金印記狀態.read(g, 0).armed).toBe(false);
  });
});

describe('冰茅：付蓋 4 後，雙方各捨棄 2 張最前面的裏側經驗', () => {
  const spear = (mine: string[], foe: string[]) =>
    scenario({
      chars: ['法師', '商人'], first: 0,
      p0: { hand: ['冰茅'], exp: mine },
      p1: { hand: [], exp: foe },
      singlePhase: true,
    });
  const five = ['黑桃3', '黑桃4', '黑桃5', '黑桃6', '黑桃7'];

  it('雙方都有足夠裏側經驗時各捨 2 張，捨的是最前面的', () => {
    const g = spear(five, ['~黑桃1', '~黑桃2', '~黑桃3', '黑桃4']);
    pick(g, '發動');
    expect(names(g, 1, 'discard')).toEqual(['黑桃1', '黑桃2']);
    expect(exp(g, 1)).toEqual(['~黑桃3', '黑桃4']);
  });

  it('先付蓋 4 再捨棄：剛被蓋成裏側的牌也可能被捨掉', () => {
    const g = spear(['黑桃3', '黑桃4', '黑桃5', '黑桃6'], []);
    pick(g, '發動');
    expect(names(g, 0, 'discard')).toEqual(['黑桃3', '黑桃4']);
    expect(exp(g, 0, 2)).toEqual(['~黑桃5', '~黑桃6']);
  });

  it('已有的裏側經驗排在前面，先被捨棄', () => {
    const g = spear(['~黑桃1', ...five], ['~黑桃1']);
    pick(g, '發動');
    expect(names(g, 0, 'discard')).toEqual(['黑桃1', '黑桃3']);
  });

  it('一方裏側經驗不足 2 張時有幾張捨幾張，沒有就不捨', () => {
    const g = spear(five, ['~黑桃1', '黑桃2']);
    pick(g, '發動');
    expect(names(g, 1, 'discard')).toEqual(['黑桃1']);
    expect(exp(g, 1)).toEqual(['黑桃2']);
    const g2 = spear(five, ['黑桃2', '黑桃3']);
    pick(g2, '發動');
    expect(names(g2, 1, 'discard')).toEqual([]);
  });

  it('表側經驗不足 4 張時不能發動', () => {
    const g = spear(['黑桃3', '黑桃4', '黑桃5', '~黑桃6'], ['~黑桃1']);
    expect(g.pending).toBeNull();
    expect(names(g, 1, 'discard')).toEqual([]);
  });

  it('可以選擇不發動，雙方經驗區原封不動', () => {
    const g = spear(five, ['~黑桃1', '~黑桃2']);
    pick(g, '不發動');
    expect(exp(g, 0, 5)).toEqual(five);
    expect(exp(g, 1)).toEqual(['~黑桃1', '~黑桃2']);
  });

  it('紀錄只寫張數，不寫裏側經驗的牌名', () => {
    const g = spear(five, ['~魅影射擊', '~地雷陷阱', '~二連矢']);
    pick(g, '發動');
    expect(log(g)).not.toContain('魅影射擊');
    expect(log(g)).toContain('捨棄 2 張裏側經驗');
  });
});
