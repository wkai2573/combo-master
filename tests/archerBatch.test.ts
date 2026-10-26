import { describe, expect, it } from 'vitest';
import { totalAtk } from '../src/engine/combat';
import { viewFor } from '../src/engine/view';
import { Z } from '../src/engine/ops';
import { names, pick, scenario, title } from './helpers';
import { 天譴之箭狀態 } from '../src/engine/sources/archer';
import { getCard } from '../src/data/cards';

const filler = Array(20).fill('黑桃2') as string[];
const log = (g: ReturnType<typeof scenario>) => g.state.log.join('\n');

/**
 * 箭雨的情境：玩家 0 先手打出箭雨（連擊值 6，在最上方），玩家 1 打出黑桃9，範圍 6~9。
 * 玩家 0 手中留著 [追] 效果的卡，牌組頂是範圍外的卡，所以追擊判定會成功。
 */
const rain = (hand: string[], deck: string[]) =>
  scenario({
    chars: ['勇者', '刺客'],
    p0: { hand: ['箭雨', ...hand], deck: [...deck, ...filler] },
    p1: { hand: ['黑桃9'] },
    singlePhase: true,
  });

describe('箭雨：追擊判定成功後可以捨棄 2 張持有 [追] 效果的卡，追擊+1', () => {
  it('發動後捨棄那 2 張，追擊多翻 1 張', () => {
    const g = rain(['魅影射擊', '地雷陷阱'], ['黑桃1', '黑桃1', '黑桃1']);
    pick(g, '箭雨');
    pick(g, '黑桃9');
    // 玩家 0 的手牌只剩 2 張持有 [追] 的卡，反擊步驟時它們的連擊值在範圍外，不能出
    expect(title(g)).toContain('箭雨');
    pick(g, '發動');
    expect(names(g, 0, 'discard').sort()).toEqual(['地雷陷阱', '魅影射擊']);
    expect(g.state.flags.pursuitSuccess[0]).toBe(2); // 原本 1 次，追擊+1 多 1 次，都成功
    expect(log(g)).toContain('【箭雨】');
  });

  it('可以選擇不發動', () => {
    const g = rain(['魅影射擊', '地雷陷阱'], ['黑桃1', '黑桃1', '黑桃1']);
    pick(g, '箭雨');
    pick(g, '黑桃9');
    pick(g, '不發動');
    expect(names(g, 0, 'hand').sort()).toEqual(['地雷陷阱', '魅影射擊']);
    expect(g.state.flags.pursuitSuccess[0]).toBe(1);
  });

  it('沒有每回合次數限制：手牌夠，連續兩次追擊判定成功都能發動', () => {
    const g = rain(['魅影射擊', '地雷陷阱', '二連矢', '追跡箭矢'], ['黑桃1', '黑桃1', '黑桃1', '黑桃1']);
    pick(g, '箭雨');
    pick(g, '黑桃9');
    pick(g, '發動');
    // 第一次發動捨棄了 2 張（手牌有 4 張可選，由玩家選）
    expect(title(g)).toContain('選擇手中 2 張');
    pick(g, '魅影射擊', '地雷陷阱');
    // 追擊+1 之後第二次判定也成功，手牌還有 2 張，再次可以發動
    expect(title(g)).toContain('箭雨');
    pick(g, '發動');
    expect(names(g, 0, 'discard').sort()).toEqual(['二連矢', '地雷陷阱', '追跡箭矢', '魅影射擊'].sort());
    expect(g.state.flags.pursuitSuccess[0]).toBe(3);
  });

  it('手中持有 [追] 效果的卡不足 2 張時不能發動；提到 [追] 的說明不算', () => {
    const g = rain(['魅影射擊', '天譴之箭'], ['黑桃1', '黑桃1']);
    pick(g, '箭雨');
    pick(g, '黑桃9');
    pick(g, '收招'); // 天譴之箭（連擊值 9）在範圍內，可以出也可以收招
    expect(g.pending).toBeNull(); // 天譴之箭的卡文只在說明裡提到 [追]，所以只有 1 張持有 [追] 效果，沒有提示
    expect(g.state.flags.pursuitSuccess[0]).toBe(1);
  });

  it('不在招式卡疊最上方時不發動', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['箭雨', '黑桃7', '魅影射擊', '地雷陷阱'], deck: ['黑桃1', '黑桃1', ...filler] },
      p1: { hand: ['黑桃9'] },
      singlePhase: true,
    });
    pick(g, '箭雨');
    pick(g, '黑桃9');
    pick(g, '黑桃7'); // 玩家 0 再出 7（在範圍 6~9 內），箭雨被壓在下面
    // 玩家 1 沒有手牌自動收招；追擊判定成功但箭雨不在最上方
    expect(g.pending).toBeNull();
    expect(g.state.flags.pursuitSuccess[0]).toBe(1);
  });
});

describe('天譴之箭：付怒 5，總攻擊增加付出的怒氣中持有 [追] 效果的卡片張數', () => {
  const rage = (cards: string[]) => scenario({
    chars: ['勇者', '刺客'],
    p0: { hand: ['天譴之箭'], rage: cards, deck: filler },
    p1: { hand: [] },
    singlePhase: true,
  });

  it('捨棄的 5 張中有 3 張 [追] 效果，本回合 +3+0', () => {
    const g = rage(['魅影射擊', '黑桃1', '地雷陷阱', '二連矢', '黑桃2', '黑桃3']);
    expect(title(g)).toContain('天譴之箭'); // 先手步驟只有 1 張，自動出招，進入發動確認
    pick(g, '發動');
    expect(天譴之箭狀態.read(g, 0).atk).toBe(3);
    expect(names(g, 0, 'discard')).toHaveLength(5);
    expect(names(g, 0, 'rage')).toEqual(['黑桃3']);
  });

  it('加成算進總攻擊，並且只在這回合', () => {
    const g = scenario({
      chars: ['勇者', '刺客'], first: 0,
      p0: { hand: ['天譴之箭', '黑桃1'], rage: ['魅影射擊', '地雷陷阱', '二連矢', '黑桃2', '黑桃3'], deck: filler },
      p1: { hand: ['黑桃9'] },
      phase: '先手',
    });
    pick(g, '天譴之箭');
    pick(g, '發動');
    expect(totalAtk(g, 0)).toBe(getCard('天譴之箭').atk + 3);
    // 玩家 1 打出黑桃9，直到這回合結束
    pick(g, '黑桃9'); // 玩家 0 的黑桃1 在範圍外，自動收招
    while (g.pending && g.state.turn === 1) {
      const req = g.pending;
      g.submit(req.player, req.min === 0 ? [] : [req.options[0].key]);
    }
    expect(g.state.turn).toBe(2);
    expect(天譴之箭狀態.read(g, 0).atk).toBe(0);
  });

  it('怒氣區不足 5 張時不能發動，不會詢問', () => {
    const g = rage(['魅影射擊', '地雷陷阱', '二連矢', '黑桃2']);
    expect(g.pending).toBeNull();
  });

  it('可以選擇不發動，怒氣區原封不動', () => {
    const g = rage(['魅影射擊', '黑桃1', '地雷陷阱', '二連矢', '黑桃2']);
    pick(g, '不發動');
    expect(天譴之箭狀態.read(g, 0).atk).toBe(0);
    expect(g.state.players[0].zones.rage).toHaveLength(5);
  });

  it('只在先手步驟打出才有效；反擊步驟打出不問', () => {
    const g = scenario({
      chars: ['刺客', '勇者'], first: 0,
      p0: { hand: ['黑桃1'] },
      p1: { hand: ['天譴之箭'], rage: ['魅影射擊', '地雷陷阱', '二連矢', '黑桃2', '黑桃3'], deck: filler },
      singlePhase: true,
    });
    pick(g, '天譴之箭'); // 先攻方已自動出招，後攻方的天譴之箭是反擊步驟打出，不是先手步驟
    expect(g.pending).toBeNull();
    expect(names(g, 1, 'discard')).toEqual([]);
  });

  it('怒氣區牌面不公開：付怒之前提示與視角都沒有牌名，捨棄進棄牌區後才在紀錄看到', () => {
    const g = rage(['魅影射擊', '黑桃1', '地雷陷阱', '二連矢', '黑桃2']);
    const text = JSON.stringify(g.pending) + JSON.stringify(viewFor(g, 0).players[0].rage) + JSON.stringify(viewFor(g, 1).players[0].rage);
    for (const secret of ['魅影射擊', '地雷陷阱', '二連矢', '黑桃2']) expect(text).not.toContain(secret);
    expect(log(g)).not.toContain('魅影射擊');
    pick(g, '發動');
    expect(log(g)).toContain('魅影射擊'); // 進了棄牌區（公開區）之後才公開
  });
});

describe('穿雲箭：付蓋 2 後，立即做一次標準追擊判定', () => {
  const exp = ['黑桃3', '黑桃4', '黑桃5', '黑桃6'];

  it('先手步驟打出：對方沒有招式，所有連擊值都在範圍內，必定失敗，翻到的牌加入手牌', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['穿雲箭'], deck: ['黑桃1', ...filler], exp },
      p1: { hand: [] },
      singlePhase: true,
    });
    pick(g, '發動');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1']);
    expect(names(g, 0, 'pursuit')).toEqual([]);
    expect(log(g)).toContain('追擊判定失敗，該卡加入手中');
    expect(g.state.flags.pursuitSuccess[0]).toBe(0);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(2);
  });

  it('先手步驟打出失敗時觸發追擊判定失敗後的連動效果（幸運兔腳）', () => {
    const g = scenario({
      chars: ['刺客', '勇者'],
      p0: { hand: ['穿雲箭'], gear: ['幸運兔腳'], deck: ['黑桃1', '黑桃2', ...filler], exp: [...exp, '黑桃7'] },
      p1: { hand: [] },
      singlePhase: true,
    });
    pick(g, '發動');
    expect(title(g)).toContain('幸運兔腳');
    pick(g, '發動');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃2']); // 額外翻的第二張也失敗，加入手牌
  });

  it('反擊步驟打出：雙方都有招式，範圍外成功，成為追擊卡並觸發 [追] 效果', () => {
    const g = scenario({
      chars: ['勇者', '後人'], first: 0,
      p0: { hand: ['黑桃7'] },
      p1: { hand: ['穿雲箭'], deck: ['二連矢', ...filler], exp },
      singlePhase: true,
    });
    pick(g, '穿雲箭'); // 玩家 0 先手打出黑桃7，玩家 1 反擊打出穿雲箭（8），範圍 7~8
    pick(g, '發動');
    expect(names(g, 1, 'exp')).toContain('二連矢'); // 成為追擊卡，這回合結束時歸還進經驗區
    expect(g.state.flags.pursuitSuccess[1]).toBeGreaterThanOrEqual(1);
    expect(log(g)).toContain('追擊成功：【二連矢】成為追擊卡');
    expect(log(g)).toContain('【二連矢】追擊+1'); // 二連矢的 [追] 效果
  });

  it('反擊步驟打出：範圍內失敗，加入手牌', () => {
    const g = scenario({
      chars: ['勇者', '刺客'], first: 0,
      p0: { hand: ['黑桃7'] },
      p1: { hand: ['穿雲箭'], deck: ['黑桃8', ...filler], exp },
      singlePhase: true,
    });
    pick(g, '穿雲箭');
    pick(g, '發動');
    expect(names(g, 1, 'hand')).toContain('黑桃8');
    expect(g.state.flags.pursuitSuccess[1]).toBe(0);
  });

  it('追擊成功觸發追擊成功時的連動（刺客：Ex-流血加入對方經驗區）', () => {
    const g = scenario({
      chars: ['勇者', '刺客'], first: 0,
      p0: { hand: ['黑桃7'] },
      p1: { hand: ['穿雲箭'], deck: ['黑桃1', ...filler], exp },
      singlePhase: true,
    });
    pick(g, '穿雲箭');
    pick(g, '發動');
    expect(names(g, 1, 'exp')).toContain('黑桃1');
    expect(names(g, 0, 'exp')).toContain('Ex-流血');
  });

  it('不取代追擊階段：追擊階段仍然照常再判定一次', () => {
    const g = scenario({
      chars: ['勇者', '後人'], first: 0,
      p0: { hand: ['黑桃7'], deck: ['黑桃1', '黑桃1', ...filler] },
      p1: { hand: ['穿雲箭'], deck: ['黑桃1', '黑桃8', ...filler], exp },
      singlePhase: true,
    });
    pick(g, '穿雲箭');
    pick(g, '發動');
    // 穿雲箭翻了黑桃1（範圍外，成功）；追擊階段玩家 1 再翻黑桃8（範圍內，失敗，加入手牌）
    expect(g.state.flags.pursuitSuccess[1]).toBe(1);
    expect(names(g, 1, 'hand')).toContain('黑桃8');
    expect(log(g).match(/玩家B（後人） 追擊判定：翻開/g)).toHaveLength(2); // 穿雲箭一次，追擊階段一次
  });

  it('表側經驗不足 2 張時不能發動；牌組沒有牌時也不發動', () => {
    const poor = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['穿雲箭'], deck: filler, exp: ['黑桃3'] },
      p1: { hand: [] },
      singlePhase: true,
    });
    expect(poor.pending).toBeNull();
    expect(names(poor, 0, 'hand')).toEqual([]);
    const empty = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['穿雲箭'], deck: [], exp },
      p1: { hand: [] },
      singlePhase: true,
    });
    expect(Z(empty, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
  });

  it('可以選擇不發動，不付費也不翻牌', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['穿雲箭'], deck: ['黑桃1', ...filler], exp },
      p1: { hand: [] },
      singlePhase: true,
    });
    pick(g, '不發動');
    expect(names(g, 0, 'hand')).toEqual([]);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
  });
});
