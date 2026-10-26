import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { EX_LEAVE_RULES } from '../src/data/exCards';
import { presetDeck } from '../src/data/presetDecks';
import { totalAtk, totalDef } from '../src/engine/combat';
import { exZoneOf, hasEffect, query } from '../src/engine/effects';
import { move, Z } from '../src/engine/ops';
import { 冰凍陷阱狀態 } from '../src/engine/sources/thief';
import { atkOf, names, pick, scenario, title } from './helpers';

const filler = Array(20).fill('黑桃4') as string[];
const log = (g: ReturnType<typeof scenario>) => g.state.log.join('\n');
const labels = (g: ReturnType<typeof scenario>) => g.pending!.options.map((o) => o.label);
/** 區域裡的卡名，裏側的前面加 ~ */
const ids = (g: ReturnType<typeof scenario>, p: 0 | 1, z: Parameters<typeof Z>[2]) => Z(g, p, z).map((c) => `${c.covered ? '~' : ''}${c.id}`);
const counters = (g: ReturnType<typeof scenario>, id: string, p: 0 | 1 = 0) => Z(g, p, 'buff').filter((c) => c.id === id).map((c) => c.counters);

/** 把這回合跑完，直到第 2 回合的戰鬥階段（增益階段之後）為止 */
function toNextTurn(g: ReturnType<typeof scenario>) {
  while (g.pending && !(g.state.turn === 2 && ['先手', '反擊'].includes(g.state.phase))) {
    const req = g.pending;
    g.submit(req.player, req.min === 0 ? [] : [req.options[0].key]);
  }
}

describe('卡表資料與登記（聖獸白虎、聖獸玄武、Ex-白虎、Ex-玄武、煙霧陷阱、冰凍陷阱、毒藥）', () => {
  it('卡表數值與開放清單', () => {
    expect(getCard('聖獸白虎')).toMatchObject({ cls: '法師', atk: 3, def: 0, combo: 2, traits: ['召喚'] });
    expect(getCard('聖獸玄武')).toMatchObject({ cls: '法師', atk: 0, def: 3, combo: 7, traits: ['召喚'] });
    expect(getCard('煙霧陷阱')).toMatchObject({ cls: '盜賊', atk: 1, def: 4, combo: 7, traits: ['陷阱'] });
    expect(getCard('冰凍陷阱')).toMatchObject({ cls: '盜賊', atk: 2, def: 3, combo: 8, traits: ['陷阱'] });
    expect(getCard('毒藥')).toMatchObject({ cls: '盜賊', atk: 1, def: 3, combo: 1, traits: ['毒', '藥水'] });
    for (const id of ['聖獸白虎', '聖獸玄武', '煙霧陷阱', '冰凍陷阱', '毒藥']) {
      expect(ENABLED_EFFECT_CARDS, id).toContain(id);
      expect(hasEffect(id), id).toBe(true);
    }
  });

  it('Ex-白虎與 Ex-玄武：持續回合 7，效果來源登記常駐位置為增益區，文字寫離開增益區', () => {
    for (const id of ['Ex-白虎', 'Ex-玄武']) {
      expect(getCard(id).duration).toBe(7);
      expect(hasEffect(id)).toBe(true);
      expect(exZoneOf(id)).toBe('buff');
      expect(getCard(id).text).toContain(EX_LEAVE_RULES.buff);
    }
  });

  it('預設牌組：法師放聖獸白虎與聖獸玄武各 3 張，盜賊放毒藥、煙霧陷阱、冰凍陷阱各 3 張', () => {
    for (const id of ['聖獸白虎', '聖獸玄武']) expect(presetDeck('法師').filter((c) => c === id), id).toHaveLength(3);
    for (const char of ['刺客', '先人']) {
      for (const id of ['毒藥', '煙霧陷阱', '冰凍陷阱']) expect(presetDeck(char).filter((c) => c === id), `${char} ${id}`).toHaveLength(3);
    }
    for (const char of ['勇者', '後人', '商人', '遊俠']) expect(presetDeck(char).join()).not.toMatch(/聖獸|煙霧陷阱|冰凍陷阱|毒藥/);
  });
});

describe('聖獸白虎、聖獸玄武 [發_蓋2]：將 1 張 Ex 卡放入我方增益區', () => {
  const play = (card: string, exp: string[], buff: string[] = []) =>
    scenario({ chars: ['法師', '勇者'], first: 0, p0: { hand: [card], exp, buff }, p1: { hand: ['黑桃5'] }, singlePhase: true });

  it('聖獸白虎付蓋 2，蓋住最前面的 2 張，Ex-白虎 在增益區、指示物 0，不進經驗區', () => {
    const g = play('聖獸白虎', ['黑桃1', '黑桃3', '黑桃4']);
    expect(title(g)).toContain('聖獸白虎');
    pick(g, '發動');
    expect(ids(g, 0, 'buff')).toEqual(['Ex-白虎']);
    expect(counters(g, 'Ex-白虎')).toEqual([0]);
    expect(ids(g, 0, 'exp')).toEqual(['~黑桃1', '~黑桃3', '黑桃4']);
  });

  it('聖獸玄武放入的是 Ex-玄武', () => {
    const g = play('聖獸玄武', ['黑桃1', '黑桃3', '黑桃4']);
    pick(g, '發動');
    expect(ids(g, 0, 'buff')).toEqual(['Ex-玄武']);
  });

  it('不發動就什麼都不放，也不蓋經驗', () => {
    const g = play('聖獸白虎', ['黑桃1', '黑桃3', '黑桃4']);
    pick(g, '不發動');
    expect(ids(g, 0, 'buff')).toEqual([]);
    expect(ids(g, 0, 'exp')).toEqual(['黑桃1', '黑桃3', '黑桃4']);
  });

  it('表側經驗不足 2 張時不能發動，也不詢問', () => {
    const g = play('聖獸白虎', ['黑桃1', '~黑桃3', '~黑桃4']);
    expect(g.pending?.title ?? '').not.toContain('聖獸白虎');
    expect(ids(g, 0, 'buff')).toEqual([]);
  });

  it('放入新的同名 Ex 卡時，舊的指示物不重設，兩張各自計數、各自 +3', () => {
    const g = play('聖獸白虎', ['黑桃1', '黑桃3', '黑桃4'], ['Ex-白虎@3']);
    pick(g, '發動');
    expect(counters(g, 'Ex-白虎')).toEqual([3, 0]);
    expect(query(g, 0, 'flatAtk')).toBe(6);
    expect(totalAtk(g, 0)).toBe(atkOf('聖獸白虎') + 6);
  });
});

describe('Ex-白虎、Ex-玄武：持續回合 7，每張各自提供加成', () => {
  it('Ex-白虎 讓我方總攻擊 +3、Ex-玄武 讓我方總防禦 +3，放幾張加幾次，只加我方', () => {
    const g = scenario({
      chars: ['法師', '勇者'], first: 0,
      p0: { buff: ['Ex-白虎', 'Ex-白虎', 'Ex-玄武'], hand: [] },
      p1: { hand: [] },
      singlePhase: true,
    });
    expect(query(g, 0, 'flatAtk')).toBe(6);
    expect(query(g, 0, 'flatDef')).toBe(3);
    expect(totalAtk(g, 0)).toBe(6);
    expect(totalDef(g, 0)).toBe(3);
    expect(query(g, 1, 'flatAtk')).toBe(0);
    expect(query(g, 1, 'flatDef')).toBe(0);
  });

  it('離開增益區就移除遊戲，不進其他區域，加成跟著消失', () => {
    const g = scenario({ chars: ['法師', '勇者'], first: 0, p0: { buff: ['Ex-白虎', 'Ex-玄武'], hand: [] }, p1: { hand: [] }, singlePhase: true });
    const [tiger, tortoise] = Z(g, 0, 'buff');
    move(g, tiger, 'discard');
    move(g, tortoise, 'exp');
    expect(ids(g, 0, 'buff')).toEqual([]);
    expect(ids(g, 0, 'discard')).toEqual([]);
    expect(ids(g, 0, 'exp')).toEqual([]);
    expect(query(g, 0, 'flatAtk')).toBe(0);
    expect(query(g, 0, 'flatDef')).toBe(0);
  });

  describe('指示物來源一：增益階段開始（既有通則）', () => {
    const buffPhase = (p0: { moves?: string[]; buff: string[] }) =>
      scenario({ chars: ['法師', '勇者'], phase: '增益', singlePhase: true, p0: { hand: [], ...p0 }, p1: { hand: [] } });

    it('每個增益階段開始各 +1', () => {
      const g = buffPhase({ buff: ['Ex-白虎@2', 'Ex-玄武@0'] });
      expect(counters(g, 'Ex-白虎')).toEqual([3]);
      expect(counters(g, 'Ex-玄武')).toEqual([1]);
    });

    it('到 7 個就移除遊戲', () => {
      const g = buffPhase({ buff: ['Ex-白虎@6', 'Ex-玄武@2'] });
      expect(ids(g, 0, 'buff')).toEqual(['Ex-玄武']);
      expect(ids(g, 0, 'discard')).toEqual([]);
      expect(ids(g, 0, 'exp')).toEqual([]);
    });

    it('聖獸白虎位於招式卡疊最上方時，Ex-白虎 不放置，Ex-玄武 照常放置', () => {
      const g = buffPhase({ moves: ['聖獸白虎'], buff: ['Ex-白虎@2', 'Ex-玄武@2'] });
      expect(counters(g, 'Ex-白虎')).toEqual([2]);
      expect(counters(g, 'Ex-玄武')).toEqual([3]);
    });

    it('聖獸玄武位於最上方時，只暫停 Ex-玄武', () => {
      const g = buffPhase({ moves: ['聖獸玄武'], buff: ['Ex-白虎@2', 'Ex-玄武@2'] });
      expect(counters(g, 'Ex-白虎')).toEqual([3]);
      expect(counters(g, 'Ex-玄武')).toEqual([2]);
    });

    it('暫停時就算已經 6 個也不會到期；離開最上方後恢復', () => {
      const held = buffPhase({ moves: ['聖獸白虎'], buff: ['Ex-白虎@6'] });
      expect(counters(held, 'Ex-白虎')).toEqual([6]);
      const free = buffPhase({ moves: ['聖獸白虎', '黑桃3'], buff: ['Ex-白虎@5'] });
      expect(counters(free, 'Ex-白虎')).toEqual([6]);
    });
  });

  describe('指示物來源二：對方每次出招', () => {
    /** 玩家 0（法師）沒有手牌，玩家 1 在反擊步驟連續出招 */
    const foePlays = (p0: { moves?: string[]; buff: string[] }) =>
      scenario({
        chars: ['法師', '勇者'], first: 0,
        p0: { hand: [], ...p0 },
        p1: { hand: ['黑桃5', '黑桃6'] },
        singlePhase: true,
      });

    it('對方每次出招各 +1', () => {
      const g = foePlays({ buff: ['Ex-白虎@0', 'Ex-玄武@3'] });
      pick(g, '黑桃5');
      expect(counters(g, 'Ex-白虎')).toEqual([1]);
      expect(counters(g, 'Ex-玄武')).toEqual([4]);
      pick(g, '黑桃6');
      expect(counters(g, 'Ex-白虎')).toEqual([2]);
      expect(counters(g, 'Ex-玄武')).toEqual([5]);
    });

    it('到 7 個立即移除遊戲，不等下個增益階段，也不進其他區域', () => {
      const g = foePlays({ buff: ['Ex-白虎@6'] });
      pick(g, '黑桃5');
      expect(ids(g, 0, 'buff')).toEqual([]);
      expect(ids(g, 0, 'discard')).toEqual([]);
      expect(ids(g, 0, 'exp')).toEqual([]);
      expect(log(g)).toContain('持續時間結束，移除遊戲');
    });

    it('同名的好幾張各自計數：到期的先走，其餘繼續；不問順序', () => {
      const g = foePlays({ buff: ['Ex-白虎@6', 'Ex-白虎@0', 'Ex-白虎@3'] });
      pick(g, '黑桃5');
      expect(counters(g, 'Ex-白虎')).toEqual([1, 4]);
      expect(g.pending!.title).toContain('反擊步驟');
    });

    it('我方自己出招不放置，只有對方出招才放置', () => {
      const g = scenario({
        chars: ['法師', '勇者'], first: 0,
        p0: { hand: ['黑桃5'], buff: ['Ex-白虎@0'] },
        p1: { hand: [] },
        singlePhase: true,
      });
      expect(counters(g, 'Ex-白虎')).toEqual([0]);
    });

    it('對方先手步驟出招也算', () => {
      const g = scenario({
        chars: ['法師', '勇者'], first: 1,
        p0: { hand: [], buff: ['Ex-白虎@0'] },
        p1: { hand: ['黑桃5'] },
        singlePhase: true,
      });
      expect(counters(g, 'Ex-白虎')).toEqual([1]);
    });

    it('聖獸在最上方時不放置；位置被壓住後恢復', () => {
      const g = foePlays({ moves: ['聖獸白虎'], buff: ['Ex-白虎@3', 'Ex-玄武@3'] });
      pick(g, '黑桃5');
      expect(counters(g, 'Ex-白虎')).toEqual([3]); // 聖獸白虎只暫停 Ex-白虎
      expect(counters(g, 'Ex-玄武')).toEqual([4]);
      const covered = foePlays({ moves: ['聖獸白虎', '黑桃3'], buff: ['Ex-白虎@3'] });
      pick(covered, '黑桃5');
      expect(counters(covered, 'Ex-白虎')).toEqual([4]);
    });

    it('暫停時就算已經 6 個也不會到期', () => {
      const g = foePlays({ moves: ['聖獸白虎'], buff: ['Ex-白虎@6'] });
      pick(g, '黑桃5');
      expect(counters(g, 'Ex-白虎')).toEqual([6]);
    });
  });

  it('兩個來源都計數：同一回合對方出招 +1，下個增益階段再 +1', () => {
    const g = scenario({
      chars: ['法師', '勇者'], first: 0,
      p0: { hand: [], buff: ['Ex-白虎@0'], deck: filler },
      p1: { hand: ['黑桃5'], deck: filler },
      phase: '先手',
    });
    pick(g, '黑桃5');
    expect(counters(g, 'Ex-白虎')).toEqual([1]);
    toNextTurn(g);
    // 第 2 回合：增益階段開始加 1；換玩家 1 先攻，他的先手出招又加 1
    expect(g.state.turn).toBe(2);
    expect(counters(g, 'Ex-白虎')).toEqual([3]);
  });
});

describe('煙霧陷阱：[頂] 對方出招時，將此卡放到我方招式疊最下方', () => {
  /** 玩家 0（刺客）的招式卡疊由下到上是 moves；玩家 1 在反擊步驟出招 */
  const smoke = (moves: string[], extra: { p1hand?: string[]; p0hand?: string[]; first?: 0 | 1 } = {}) =>
    scenario({
      chars: ['刺客', '勇者'], first: extra.first ?? 0,
      p0: { moves, hand: extra.p0hand ?? [], deck: filler },
      p1: { hand: extra.p1hand ?? ['黑桃5', '黑桃5'], deck: filler }, // 第二張同連擊值，讓對局停在他的反擊步驟
      singlePhase: true,
    });

  it('疊裡有多張時它移到最下方，新的最上方卡接手', () => {
    const g = smoke(['黑桃3', '煙霧陷阱']);
    pick(g, '黑桃5');
    expect(ids(g, 0, 'moves')).toEqual(['煙霧陷阱', '黑桃3']);
    expect(log(g)).toContain('【煙霧陷阱】');
  });

  it('新的最上方卡的頂部效果接手：力量爆破成為最上方後，總攻擊 −3', () => {
    const g = smoke(['力量爆破', '煙霧陷阱']);
    const before = totalAtk(g, 0);
    pick(g, '黑桃5');
    expect(ids(g, 0, 'moves')).toEqual(['煙霧陷阱', '力量爆破']);
    expect(before - totalAtk(g, 0)).toBe(Math.min(3, atkOf('力量爆破')));
  });

  it('疊裡只有它一張時行為合理，不出錯也不改動', () => {
    const g = smoke(['煙霧陷阱']);
    expect(() => pick(g, '黑桃5')).not.toThrow();
    expect(ids(g, 0, 'moves')).toEqual(['煙霧陷阱']);
    expect(log(g)).not.toContain('放到招式卡疊最下方');
  });

  it('它不在最上方時不觸發', () => {
    const g = smoke(['煙霧陷阱', '黑桃3']);
    pick(g, '黑桃5');
    expect(ids(g, 0, 'moves')).toEqual(['煙霧陷阱', '黑桃3']);
  });

  it('對方每次出招都觸發：兩次出招後，疊序隨之連動', () => {
    const g = smoke(['黑桃3', '黑桃9', '煙霧陷阱'], { p1hand: ['黑桃5', '黑桃6', '黑桃6'] });
    pick(g, '黑桃5');
    expect(ids(g, 0, 'moves')).toEqual(['煙霧陷阱', '黑桃3', '黑桃9']);
    pick(g, '黑桃6'); // 最上方是黑桃9，不是煙霧陷阱，不再觸發
    expect(ids(g, 0, 'moves')).toEqual(['煙霧陷阱', '黑桃3', '黑桃9']);
  });

  it('我方自己出招不觸發；打出後等對方出招才移動', () => {
    const g = smoke(['黑桃3'], { p0hand: ['煙霧陷阱'] }); // 先手步驟只有它一張可出，自動打出
    expect(ids(g, 0, 'moves')).toEqual(['黑桃3', '煙霧陷阱']);
    pick(g, '黑桃5');
    expect(ids(g, 0, 'moves')).toEqual(['煙霧陷阱', '黑桃3']);
  });

  it('歸還步驟依新的疊序進入經驗區', () => {
    const g = smoke(['黑桃3', '煙霧陷阱'], { p1hand: ['黑桃5'] });
    pick(g, '黑桃5');
    // 雙方都沒有手牌可出，收招；追擊判定翻到範圍內的牌失敗，接著歸還
    while (g.pending) g.submit(g.pending.player, g.pending.min === 0 ? [] : [g.pending.options[0].key]);
    expect(ids(g, 0, 'exp')).toEqual(['煙霧陷阱', '黑桃3']);
    expect(ids(g, 1, 'exp')).toEqual(['黑桃5']);
  });

  it('怒氣區牌面不公開：紀錄沒有洩漏怒氣區的牌名', () => {
    const g = scenario({
      chars: ['刺客', '勇者'], first: 0,
      p0: { moves: ['黑桃3', '煙霧陷阱'], hand: [], rage: ['伏擊', '塗毒', '毒藥'] },
      p1: { hand: ['黑桃5', '黑桃5'], deck: filler },
      singlePhase: true,
    });
    pick(g, '黑桃5');
    for (const secret of ['伏擊', '塗毒', '毒藥']) expect(log(g)).not.toContain(secret);
  });
});

describe('冰凍陷阱：[經_蓋3] 對方出招的連擊值＝我方招式疊最上方招式的連擊值，可付蓋 3，我方 +0+3', () => {
  /** 玩家 0（刺客）的招式卡疊最上方是黑桃7（連擊值 7）；玩家 1 在反擊步驟出招 */
  const trap = (exp: string[], p1hand: string[] = ['黑桃7', '黑桃7', '黑桃9'], moves: string[] = ['黑桃7'], first: 0 | 1 = 0) =>
    scenario({
      chars: ['刺客', '勇者'], first,
      p0: { moves, exp, hand: [], deck: filler },
      p1: { hand: p1hand, deck: filler },
      singlePhase: true,
    });
  const EXP = ['冰凍陷阱', '黑桃3', '黑桃4', '黑桃5'];

  it('連擊值相等時出現選項，付蓋 3 後總防禦 +3，蓋的是最前面的 3 張', () => {
    const g = trap(EXP);
    pick(g, '黑桃7');
    expect(title(g)).toContain('冰凍陷阱');
    const def0 = totalDef(g, 0);
    pick(g, '發動');
    expect(query(g, 0, 'flatDef')).toBe(3);
    expect(totalDef(g, 0)).toBe(def0 + 3);
    expect(query(g, 0, 'flatAtk')).toBe(0);
    expect(ids(g, 0, 'exp')).toEqual(['~冰凍陷阱', '~黑桃3', '~黑桃4', '黑桃5']);
  });

  it('可以選擇不付費：不蓋經驗，沒有加成', () => {
    const g = trap(EXP);
    pick(g, '黑桃7');
    pick(g, '不發動');
    expect(query(g, 0, 'flatDef')).toBe(0);
    expect(ids(g, 0, 'exp')).toEqual(EXP);
  });

  it('連擊值不相等時不出現選項', () => {
    const g = trap(EXP);
    pick(g, '黑桃9');
    expect(g.pending?.title ?? '').not.toContain('冰凍陷阱');
    expect(query(g, 0, 'flatDef')).toBe(0);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toEqual([]);
  });

  it('我方招式疊沒有招式（對方先手出招）時不出現選項', () => {
    const g = trap(EXP, ['黑桃7'], [], 1); // 玩家 1 先手出招，玩家 0 的招式卡疊是空的
    expect(g.pending?.title ?? '').not.toContain('冰凍陷阱');
    expect(query(g, 0, 'flatDef')).toBe(0);
  });

  it('比的是我方最上方的招式：被壓住的不算', () => {
    const g = trap(EXP, ['黑桃7', '黑桃9'], ['黑桃7', '黑桃3']);
    pick(g, '黑桃7');
    expect(g.pending?.title ?? '').not.toContain('冰凍陷阱');
    expect(query(g, 0, 'flatDef')).toBe(0);
  });

  it('表側經驗不足 3 張時不能發動；被蓋成裏側的冰凍陷阱沒有效果', () => {
    const few = trap(['冰凍陷阱', '黑桃3', '~黑桃4']);
    pick(few, '黑桃7');
    expect(few.pending?.title ?? '').not.toContain('冰凍陷阱');
    const covered = trap(['~冰凍陷阱', '黑桃3', '黑桃4', '黑桃5']);
    pick(covered, '黑桃7');
    expect(covered.pending?.title ?? '').not.toContain('冰凍陷阱');
  });

  it('不在表側經驗區時沒有效果：在手牌或棄牌區都不觸發', () => {
    const g = scenario({
      chars: ['刺客', '勇者'], first: 0,
      p0: { moves: ['黑桃7'], exp: ['黑桃3', '黑桃4', '黑桃5'], hand: ['冰凍陷阱'], discard: ['冰凍陷阱'], deck: filler },
      p1: { hand: ['黑桃7'], deck: filler },
      singlePhase: true,
    });
    pick(g, '黑桃7');
    expect(g.pending?.title ?? '').not.toContain('冰凍陷阱');
  });

  it('加成只在這回合：下回合消失', () => {
    const g = scenario({
      chars: ['刺客', '勇者'], first: 0,
      p0: { hand: ['黑桃7'], exp: EXP, deck: filler },
      p1: { hand: ['黑桃7', '黑桃7'], deck: filler },
      phase: '先手',
    });
    // 玩家 0 先手只有黑桃7 可出，自動打出；玩家 1 出同連擊值的黑桃7
    pick(g, '黑桃7');
    pick(g, '發動');
    expect(冰凍陷阱狀態.read(g, 0).def).toBe(3);
    toNextTurn(g);
    expect(g.state.turn).toBe(2);
    expect(冰凍陷阱狀態.read(g, 0).def).toBe(0);
    expect(query(g, 0, 'flatDef')).toBe(0);
  });

  it('怒氣區牌面不公開：紀錄沒有洩漏怒氣區的牌名', () => {
    const g = scenario({
      chars: ['刺客', '勇者'], first: 0,
      p0: { moves: ['黑桃7'], exp: EXP, hand: [], rage: ['伏擊', '塗毒'], deck: filler },
      p1: { hand: ['黑桃7', '黑桃7'], deck: filler },
      singlePhase: true,
    });
    pick(g, '黑桃7');
    pick(g, '發動');
    expect(log(g)).not.toMatch(/伏擊|塗毒/);
  });
});

describe('毒藥：[發_蓋X] 捨棄手中 X 張毒或藥水的卡，將 X 張 Ex-中毒 放入對方經驗區', () => {
  /** 玩家 0（刺客）先手打出毒藥，手中另有 hand；玩家 1 有一張手牌，對局停在他的反擊步驟 */
  const poison = (hand: string[], exp: string[]) => {
    const g = scenario({
      chars: ['刺客', '勇者'], first: 0,
      p0: { hand: ['毒藥', ...hand], exp, deck: filler },
      p1: { hand: ['黑桃8'], exp: ['黑桃9'], deck: filler },
      singlePhase: true,
    });
    pick(g, '毒藥');
    return g;
  };
  const EXP4 = ['黑桃3', '黑桃4', '黑桃5', '黑桃6'];

  it('X 可選 1 到手中符合特徵的張數：蓋 2、捨棄 2 張，對方經驗區最後方放入 2 張 Ex-中毒', () => {
    const g = poison(['塗毒', '生命藥水', '黑桃8'], EXP4);
    expect(labels(g)).toEqual(['不發動', '蓋1', '蓋2']);
    pick(g, '蓋2');
    expect(ids(g, 0, 'exp')).toEqual(['~黑桃3', '~黑桃4', '黑桃5', '黑桃6']);
    expect(names(g, 0, 'discard').sort()).toEqual(['塗毒', '生命藥水'].sort());
    expect(names(g, 0, 'hand')).toEqual(['黑桃8']);
    expect(ids(g, 1, 'exp')).toEqual(['黑桃9', 'Ex-中毒', 'Ex-中毒']);
  });

  it('X＝1：選 1 張要捨棄的卡，其餘留在手中', () => {
    const g = poison(['塗毒', '生命藥水'], EXP4);
    pick(g, '蓋1');
    expect(title(g)).toContain('毒藥');
    pick(g, '塗毒');
    expect(names(g, 0, 'discard')).toEqual(['塗毒']);
    expect(names(g, 0, 'hand')).toEqual(['生命藥水']);
    expect(ids(g, 1, 'exp')).toEqual(['黑桃9', 'Ex-中毒']);
    expect(ids(g, 0, 'exp')).toEqual(['~黑桃3', '黑桃4', '黑桃5', '黑桃6']);
  });

  it('另一張毒藥在手中也符合特徵，可以捨棄', () => {
    const g = poison(['毒藥'], EXP4);
    expect(labels(g)).toEqual(['不發動', '蓋1']);
    pick(g, '蓋1');
    expect(names(g, 0, 'discard')).toEqual(['毒藥']);
    expect(ids(g, 1, 'exp')).toEqual(['黑桃9', 'Ex-中毒']);
  });

  it('X 最大為 3，就算手中符合特徵的卡更多、經驗更多', () => {
    const g = poison(['塗毒', '塗毒', '生命藥水', '毒藥'], ['黑桃3', '黑桃4', '黑桃5', '黑桃6', '黑桃7']);
    expect(labels(g)).toEqual(['不發動', '蓋1', '蓋2', '蓋3']);
  });

  it('X 受我能蓋的張數限制：表側經驗只有 1 張時最多蓋 1', () => {
    const g = poison(['塗毒', '生命藥水'], ['黑桃3', '~黑桃4']);
    expect(labels(g)).toEqual(['不發動', '蓋1']);
  });

  it('手中沒有符合特徵的卡時不能發動，也不詢問', () => {
    const g = poison(['黑桃8', '魅影射擊'], EXP4);
    expect(g.pending?.title ?? '').not.toContain('毒藥');
    expect(ids(g, 1, 'exp')).toEqual(['黑桃9']);
    expect(ids(g, 0, 'exp')).toEqual(EXP4);
  });

  it('沒有表側經驗可蓋時不能發動', () => {
    const g = poison(['塗毒'], ['~黑桃3']);
    expect(g.pending?.title ?? '').not.toContain('毒藥');
    expect(names(g, 0, 'hand')).toEqual(['塗毒']);
  });

  it('選「不發動」什麼都不付：不蓋經驗、不捨棄', () => {
    const g = poison(['塗毒'], EXP4);
    pick(g, '不發動');
    expect(ids(g, 0, 'exp')).toEqual(EXP4);
    expect(names(g, 0, 'hand')).toEqual(['塗毒']);
    expect(ids(g, 1, 'exp')).toEqual(['黑桃9']);
  });

  it('怒氣區牌面不公開：紀錄沒有洩漏怒氣區的牌名', () => {
    const g = scenario({
      chars: ['刺客', '勇者'], first: 0,
      p0: { hand: ['毒藥', '塗毒'], exp: EXP4, rage: ['伏擊', '狂怒'], deck: filler },
      p1: { hand: [], deck: filler },
      singlePhase: true,
    });
    pick(g, '毒藥');
    pick(g, '蓋1');
    expect(log(g)).not.toMatch(/伏擊|狂怒/);
  });
});
