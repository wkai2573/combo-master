import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { EX_LEAVE_RULES } from '../src/data/exCards';
import { presetDeck } from '../src/data/presetDecks';
import { pay } from '../src/engine/cost';
import { exZoneOf, hasEffect, hasExpEffect } from '../src/engine/effects';
import { discard, Z } from '../src/engine/ops';
import { viewFor } from '../src/engine/view';
import { drive, names, pick, scenario } from './helpers';

const filler = Array(20).fill('黑桃2') as string[];

describe('強力過件與 Ex-貸款：卡表資料與登記', () => {
  it('強力過件是商人招式 2／2／7（變化）已開放；Ex-貸款是減益特徵', () => {
    expect(getCard('強力過件')).toMatchObject({ cls: '商人', kind: 'move', atk: 2, def: 2, combo: 7, traits: ['變化'] });
    expect(ENABLED_EFFECT_CARDS).toContain('強力過件');
    expect(getCard('Ex-貸款')).toMatchObject({ traits: ['減益'] });
    expect(getCard('Ex-貸款').text).toContain(EX_LEAVE_RULES.exp);
  });

  it('效果來源都有登記：強力過件在招式卡疊，Ex-貸款在經驗區（經驗效果）', () => {
    expect(hasEffect('強力過件')).toBe(true);
    expect(hasEffect('Ex-貸款')).toBe(true);
    expect(exZoneOf('Ex-貸款')).toBe('exp');
    expect(hasExpEffect('Ex-貸款')).toBe(true);
  });

  it('預設牌組：商人放 3 張強力過件，其他職業沒有', () => {
    expect(presetDeck('商人').filter((c) => c === '強力過件')).toHaveLength(3);
    for (const id of ['勇者', '後人', '刺客', '先人', '遊俠', '法師']) expect(presetDeck(id)).not.toContain('強力過件');
  });
});

describe('強力過件 [發_蓋2]：牌組上方 3 張移入怒氣區，5 張 Ex-貸款加入對方經驗', () => {
  const play = (deck: string[], exp = ['黑桃1', '黑桃3'], p1exp: string[] = ['黑桃2']) =>
    scenario({
      chars: ['商人', '勇者'], singlePhase: true,
      p0: { hand: ['強力過件'], exp, deck }, p1: { hand: [], exp: p1exp },
    });

  it('發動後我方牌組少 3 張、怒氣區多 3 張；紀錄不寫卡名；對方經驗區最後方多 5 張表側 Ex-貸款', () => {
    const g = play(['黑桃6', '黑桃7', '黑桃8', ...filler]);
    const deck = Z(g, 0, 'deck').length;
    pick(g, '發動');
    expect(Z(g, 0, 'deck').length).toBe(deck - 3);
    expect(Z(g, 0, 'rage')).toHaveLength(3);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(2); // 蓋2 的費用
    const foeExp = Z(g, 1, 'exp');
    expect(foeExp.map((c) => c.id)).toEqual(['黑桃2', ...Array(5).fill('Ex-貸款')]);
    expect(foeExp.every((c) => !c.covered)).toBe(true);
    const log = g.state.log.join('\n');
    expect(log).toContain('【強力過件】');
    for (const n of ['黑桃6', '黑桃7', '黑桃8']) expect(log).not.toContain(n);
  });

  it('怒氣區的內容對所有人隱藏（ADR 0006）：雙方的視角都只有張數', () => {
    const g = play(['黑桃6', '黑桃7', '黑桃8', ...filler]);
    pick(g, '發動');
    for (const viewer of [0, 1] as const) {
      const rage = viewFor(g, viewer, false).players[0].rage;
      expect(rage, `視角 ${viewer}`).toHaveLength(3);
      expect(rage.every((c) => c.id === null)).toBe(true);
    }
  });

  it('移入怒氣區不是直擊：不進棄牌區，沒有直擊紀錄，不算承受傷害', () => {
    const g = play(['黑桃6', '黑桃7', '黑桃8', ...filler]);
    pick(g, '發動');
    expect(Z(g, 0, 'discard')).toHaveLength(0);
    expect(g.state.log.join('\n')).not.toContain('直擊');
    expect(g.state.flags.damageTaken[0]).toBe(0); // 對方沒有招式，我方這回合沒有承受任何傷害（對方吃的是強力過件本身的攻擊 2）
  });

  it('不發動就沒有任何變化', () => {
    const g = play(['黑桃6', '黑桃7', '黑桃8', ...filler]);
    pick(g, '不發動');
    expect(Z(g, 0, 'rage')).toHaveLength(0);
    expect(Z(g, 1, 'exp').filter((c) => c.id === 'Ex-貸款')).toHaveLength(0);
  });

  it('牌組不足 3 張或表側經驗不足 2 張都不能發動，不詢問', () => {
    const few = play(['黑桃6', '黑桃7']);
    expect(few.pending?.title ?? '').not.toContain('強力過件');
    expect(Z(few, 1, 'exp').filter((c) => c.id === 'Ex-貸款')).toHaveLength(0);

    const poor = play(['黑桃6', '黑桃7', '黑桃8', ...filler], ['黑桃1', '~黑桃3']);
    expect(poor.pending?.title ?? '').not.toContain('強力過件');
    expect(Z(poor, 0, 'rage')).toHaveLength(0);
  });

  it('牌組剛好 3 張可以發動，發動後牌組歸零，我方落敗', () => {
    const g = play(['黑桃6', '黑桃7', '黑桃8']);
    pick(g, '發動');
    expect(Z(g, 0, 'deck')).toHaveLength(0);
    expect(Z(g, 0, 'rage')).toHaveLength(3);
    expect(g.state.winner).toBe(1);
  });
});

describe('Ex-貸款 [經]：被蓋為裏側時，我方直擊1，對方回復1', () => {
  // 玩家 0 持有貸款，用生命藥水的蓋3 當費用蓋住最前面的 3 張表側經驗；玩家 1 是「對方」
  const pot = (exp: string[], p1rage = 3) =>
    scenario({
      chars: ['商人', '勇者'], singlePhase: true,
      p0: { hand: ['生命藥水'], exp, rage: [], deck: filler }, p1: { hand: [], rage: Array(p1rage).fill('黑桃1') },
    });

  it('蓋到 1 張：持有者直擊 1（牌組上方進棄牌區），對手回復 1（怒氣區上方回牌組頂）', () => {
    const g = pot(['Ex-貸款', '黑桃3', '黑桃4', '黑桃5']);
    const [deck0, deck1] = [Z(g, 0, 'deck').length, Z(g, 1, 'deck').length];
    pick(g, '發動'); // 生命藥水蓋3：Ex-貸款、黑桃3、黑桃4
    expect(Z(g, 0, 'deck').length).toBe(deck0 - 1);
    expect(Z(g, 0, 'discard')).toHaveLength(1);
    expect(Z(g, 1, 'rage')).toHaveLength(2);
    expect(Z(g, 1, 'deck').length).toBe(deck1 + 1);
  });

  it('一次蓋到多張貸款：各自觸發，不用逐張選擇', () => {
    const g = pot(['Ex-貸款', 'Ex-貸款', '黑桃4', '黑桃5']);
    const [deck0, deck1] = [Z(g, 0, 'deck').length, Z(g, 1, 'deck').length];
    pick(g, '發動');
    expect(g.pending).toBeNull(); // 只有同組的強制效果，連窗口都不開
    expect(Z(g, 0, 'deck').length).toBe(deck0 - 2);
    expect(Z(g, 1, 'rage')).toHaveLength(1);
    expect(Z(g, 1, 'deck').length).toBe(deck1 + 2);
  });

  it('同時蓋到別的蓋反應時開窗口：貸款併成一個選項標示張數，由持有者決定先後', () => {
    const g = pot(['Ex-貸款', 'Ex-貸款', '低價買進', '黑桃5']);
    pick(g, '發動');
    const opts = g.pending!.options.map((o) => o.label);
    expect(opts).toHaveLength(2);
    expect(opts.some((o) => o.includes('Ex-貸款') && o.includes('×2'))).toBe(true);
    expect(opts.every((o) => o.startsWith('【強制】'))).toBe(true);
    pick(g, opts.find((o) => o.includes('低價買進'))!);
    expect(Z(g, 1, 'rage')).toHaveLength(1); // 兩張貸款各讓對方回復 1
  });

  it('對手怒氣區是空的就不回復，持有者照樣直擊 1', () => {
    const g = pot(['Ex-貸款', '黑桃3', '黑桃4', '黑桃5'], 0);
    const deck0 = Z(g, 0, 'deck').length;
    pick(g, '發動');
    expect(Z(g, 0, 'deck').length).toBe(deck0 - 1);
    expect(Z(g, 1, 'rage')).toHaveLength(0);
  });

  it('裏側時無效；翻回表側再被蓋會再觸發', () => {
    const covered = pot(['~Ex-貸款', '黑桃3', '黑桃4', '黑桃5']);
    const deck0 = Z(covered, 0, 'deck').length;
    pick(covered, '發動'); // 蓋的是表側的黑桃3、黑桃4、黑桃5，原本就裏側的貸款不動
    expect(Z(covered, 0, 'deck').length).toBe(deck0);
    expect(Z(covered, 1, 'rage')).toHaveLength(3);

    const g = scenario({ chars: ['商人', '勇者'], p0: { exp: ['Ex-貸款', '黑桃3'], rage: [] }, p1: { rage: ['黑桃1', '黑桃1'] } });
    const [loan] = Z(g, 0, 'exp');
    drive(pay(g, 0, { cover: 1 }));
    expect(loan.covered).toBe(true);
    expect(Z(g, 1, 'rage')).toHaveLength(1);
    loan.covered = false; // 打開
    drive(pay(g, 0, { cover: 1 }));
    expect(loan.covered).toBe(true);
    expect(Z(g, 1, 'rage')).toHaveLength(0);
  });

  it('離開經驗區直接移除遊戲，不進棄牌區', () => {
    const g = scenario({ p0: { exp: ['Ex-貸款', '黑桃3'] } });
    discard(g, Z(g, 0, 'exp')[0]);
    expect(names(g, 0, 'exp')).toEqual(['黑桃3']);
    expect(Z(g, 0, 'discard')).toHaveLength(0);
  });
});
