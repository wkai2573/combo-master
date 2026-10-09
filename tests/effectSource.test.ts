import { describe, expect, it } from 'vitest';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { randomResponse } from '../src/engine/bot';
import { resolveCombatStats } from '../src/engine/combatStats';
import { createEffects, createRegistry, hasEffect } from '../src/engine/effects';
import { defineSource, lasting, NO_MOVE_RULES, slot, type EffectSource } from '../src/engine/effectKit';
import { move, Z } from '../src/engine/ops';
import { Rng } from '../src/engine/rng';
import { drive, scenario } from './helpers';

const noop = () => {};
const labels = (es: { label: string }[]) => es.map((e) => e.label);

/** 測試用條目：借真的卡名與角色名當宿主，用 label 標出是誰的效果 */
const gearSrc = (log: string[] = []) => defineSource({
  id: '黑桃2', at: 'gear',
  on: { turnStart: (c) => c.effect({ label: 'G' }, () => void log.push('G')) },
});
const expSrc = (log: string[] = []) => defineSource({
  id: '黑桃3', at: 'exp',
  on: { turnStart: (c) => c.effect({ label: 'E' }, () => void log.push('E')) },
});
const charSrc = (log: string[] = []) => defineSource({
  id: '勇者', at: 'char',
  on: { turnStart: (c) => c.effect({ label: 'C' }, () => void log.push('C')) },
});

describe('登記表', () => {
  it('重複的 id 在建立時丟錯', () => {
    expect(() => createRegistry([gearSrc(), gearSrc()])).toThrow('黑桃2');
  });

  it('has 同時涵蓋卡片與角色', () => {
    const r = createRegistry([gearSrc(), charSrc()]);
    expect(r.has('黑桃2')).toBe(true);
    expect(r.has('勇者')).toBe(true);
    expect(r.has('刺客')).toBe(false);
  });

  it('開放名單裡的每張卡都已實作，沒有例外', () => {
    expect(ENABLED_EFFECT_CARDS.filter((id) => !hasEffect(id))).toEqual([]);
  });

  it('hasEffect 涵蓋角色與裝備，沒有條目的卡為否', () => {
    for (const id of ['勇者', '刺客', '先人', '後人', '商人', '遊俠', '法師']) expect(hasEffect(id), id).toBe(true);
    for (const id of ['家族相片', '瞄準器', '招財貓', '幸運兔腳', '冰與雷之曲']) expect(hasEffect(id), id).toBe(true);
    expect(hasEffect('黑桃1')).toBe(false);
  });
});

describe('窗口效果的收集', () => {
  it('依常駐位置排序：裝備、經驗、角色，與登記順序無關', () => {
    const fx = createEffects([charSrc(), expSrc(), gearSrc()]);
    const g = scenario({ p0: { gear: ['黑桃2'], exp: ['黑桃1', '黑桃3'] } });
    expect(labels(fx.windowEffects(g, 0, 'turnStart'))).toEqual(['G', 'E', 'C']);
  });

  it('經驗區裏側的卡不被問，角色不符的條目也不被問', () => {
    const fx = createEffects([expSrc(), charSrc()]);
    const g = scenario({ chars: ['刺客', '勇者'], p0: { exp: ['~凡骨的意志'] } });
    expect(fx.windowEffects(g, 0, 'turnStart')).toEqual([]);
    expect(labels(fx.windowEffects(g, 1, 'turnStart'))).toEqual(['C']);
  });

  it('同一張卡有兩個實例時各問一次', () => {
    const fx = createEffects([expSrc()]);
    const g = scenario({ p0: { exp: ['黑桃3', '黑桃1', '黑桃3'] } });
    expect(fx.windowEffects(g, 0, 'turnStart')).toHaveLength(2);
  });

  it('卡離開常駐位置後，已收集的效果不再可發動', () => {
    const fx = createEffects([gearSrc()]);
    const g = scenario({ p0: { gear: ['黑桃2'] } });
    const [e] = fx.windowEffects(g, 0, 'turnStart');
    expect(e.available()).toBe(true);
    move(g, Z(g, 0, 'gear')[0], 'discard');
    expect(e.available()).toBe(false);
  });

  it('沒有明寫 lasting 的處理器，卡不在位就不問；明寫 lasting 的處理器照問，self 為 null', () => {
    const seen: (number | null)[] = [];
    const plain = defineSource({ id: '黑桃2', at: 'gear', on: { turnStart: (c) => (seen.push(-1), undefined) } });
    const keep = defineSource({
      id: '黑桃3', at: 'exp',
      on: { turnStart: lasting((c) => (seen.push(c.self ? c.self.uid : null), undefined)) },
    });
    const fx = createEffects([plain, keep]);
    const g = scenario({ p0: { gear: [], exp: [] } });
    fx.windowEffects(g, 0, 'turnStart');
    expect(seen).toEqual([null]);
  });

  it('主體型時機只問主體那張卡自己的條目，不看它所在的區域', () => {
    const played: string[] = [];
    const a = defineSource({ id: '黑桃1', at: 'gear', on: { onPlay: (c) => c.effect({ label: 'A' }, () => void played.push('A')) } });
    const b = defineSource({ id: '黑桃2', at: 'gear', on: { onPlay: (c) => c.effect({ label: 'B' }, noop) } });
    const fx = createEffects([a, b]);
    const g = scenario({ p0: { moves: ['黑桃1'] } });
    const card = Z(g, 0, 'moves')[0];
    const es = fx.windowEffects(g, 0, 'onPlay', { card });
    expect(labels(es)).toEqual(['A']);
    expect(es[0].available()).toBe(true);
  });

  it('被蓋成裏側一次可以有多張卡，每張各自一個效果', () => {
    const src = (id: string) => defineSource({ id, at: 'exp', on: { onCovered: (c) => c.effect({ label: id }, noop) } });
    const fx = createEffects([src('黑桃1'), src('黑桃2')]);
    const g = scenario({ p0: { exp: ['黑桃2', '黑桃1', '黑桃3'] } });
    const cards = [...Z(g, 0, 'exp')];
    expect(labels(fx.windowEffects(g, 0, 'onCovered', { cards }))).toEqual(['黑桃2', '黑桃1']);
  });

  it('處理器回傳 null 或 undefined 時沒有效果', () => {
    const fx = createEffects([defineSource({ id: '黑桃2', at: 'gear', on: { turnStart: () => null } })]);
    const g = scenario({ p0: { gear: ['黑桃2'] } });
    expect(fx.windowEffects(g, 0, 'turnStart')).toEqual([]);
  });
});

describe('c.effect', () => {
  const withCost = defineSource({
    id: '黑桃2', at: 'gear',
    on: { turnStart: (c) => c.effect({ label: 'P', cost: { cover: 1 } }, () => void c.g.state.log.push('paid')) },
  });

  it('付不起費用時不可發動，付得起時可發動', () => {
    const fx = createEffects([withCost]);
    const poor = scenario({ p0: { gear: ['黑桃2'], exp: [] } });
    expect(fx.windowEffects(poor, 0, 'turnStart')[0].available()).toBe(false);
    const rich = scenario({ p0: { gear: ['黑桃2'], exp: ['黑桃1'] } });
    expect(fx.windowEffects(rich, 0, 'turnStart')[0].available()).toBe(true);
  });

  it('已在窗口選定（confirmed）時直接扣費並執行，不再詢問', () => {
    const fx = createEffects([withCost]);
    const g = scenario({ p0: { gear: ['黑桃2'], exp: ['黑桃1'] } });
    const [e] = fx.windowEffects(g, 0, 'turnStart');
    drive(e.run(true));
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
    expect(g.state.log).toContain('paid');
  });

  it('還沒選定（只剩這一個效果）時維持原本的發動確認', () => {
    const fx = createEffects([withCost]);
    const g = scenario({ p0: { gear: ['黑桃2'], exp: ['黑桃1'] } });
    const [e] = fx.windowEffects(g, 0, 'turnStart');
    const r = e.run(false).next([]);
    expect(r.done).toBe(false);
    expect((r.value as { title: string }).title).toContain('是否發動【黑桃2】');
  });

  it('有費用卻沒有對應的卡時丟錯', () => {
    const bad = defineSource({ id: '勇者', at: 'char', on: { turnStart: (c) => c.effect({ label: 'X', cost: { cover: 1 } }, noop) } });
    const fx = createEffects([bad]);
    const g = scenario({});
    expect(() => fx.windowEffects(g, 0, 'turnStart')).toThrow('沒有對應的卡');
  });
});

describe('fire', () => {
  it('只有一個強制效果時不產生提示，直接結算', () => {
    const log: string[] = [];
    const only = defineSource({ id: '黑桃2', at: 'gear', on: { turnStart: (c) => c.effect({ label: 'M', mandatory: true }, () => void log.push('M')) } });
    const fx = createEffects([only]);
    const g = scenario({ p0: { gear: ['黑桃2'] } });
    drive(fx.fire(g, 0, 'turnStart'));
    expect(log).toEqual(['M']);
  });

  it('同一時機有兩個可發動的效果時，開窗口讓玩家選，標題為該時機的名稱', () => {
    const fx = createEffects([gearSrc(), expSrc()]);
    const g = scenario({ p0: { gear: ['黑桃2'], exp: ['黑桃3'] } });
    const r = fx.fire(g, 0, 'turnStart').next([]);
    expect(r.done).toBe(false);
    const req = r.value as { title: string; options: { label: string }[] };
    expect(req.title).toBe('回合開始：選擇要發動的效果');
    expect(labels(req.options)).toEqual(['G', 'E', '結束（不再發動）']);
  });

  it('先手出招同時是先手出招時與打出時，兩者的效果進同一個窗口，玩家自己選順序', () => {
    const order: string[] = [];
    const src = defineSource({
      id: '黑桃4', at: 'moves',
      on: {
        onOpen: (c) => c.effect({ label: 'O' }, () => void order.push('O')),
        onPlay: (c) => c.effect({ label: 'P' }, () => void order.push('P')),
      },
    });
    const fx = createEffects([src]);
    const g = scenario({ p0: { moves: ['黑桃4'] } });
    const card = Z(g, 0, 'moves')[0];
    const gen = fx.fire(g, 0, ['onOpen', 'onPlay'], { card });
    const r = gen.next([]);
    const req = r.value as { title: string; options: { label: string }[] };
    expect(req.title).toBe('先手出招時：選擇要發動的效果');
    expect(labels(req.options)).toEqual(['O', 'P', '結束（不再發動）']);
    // 先選 P，剩下的 O 是唯一可選的效果，沿用原本的行為直接結算
    expect(gen.next(['e1']).done).toBe(true);
    expect(order).toEqual(['P', 'O']);
  });

  it('一個時機只有一個效果，且玩家沒有選擇的餘地時，不多出任何提示', () => {
    const only = defineSource({
      id: '黑桃4', at: 'moves',
      on: { onPlay: (c) => c.effect({ label: 'P', mandatory: true }, noop) },
    });
    const g = scenario({ p0: { moves: ['黑桃4'] } });
    drive(createEffects([only]).fire(g, 0, 'onPlay', { card: Z(g, 0, 'moves')[0] }));
  });

  it('fireEach 先攻方先，參數可依玩家而異', () => {
    const seen: string[] = [];
    const src = defineSource({
      id: '黑桃1', at: 'lasting',
      on: { afterDamage: (c) => c.effect({ label: 'D', mandatory: true }, () => void seen.push(`${c.p}:${c.dealt}/${c.taken}`)) },
    });
    const fx = createEffects([src]);
    const g = scenario({ first: 1 });
    drive(fx.fireEach(g, 'afterDamage', (p) => ({ dealt: p + 1, taken: 5 })));
    expect(seen).toEqual(['1:2/5', '0:1/5']);
  });
});

describe('覺醒的邊緣偵測', () => {
  const rangerAwake = defineSource({ id: '遊俠', at: 'char', on: { onAwaken: (c) => c.effect({ label: 'W', mandatory: true }, noop) } });
  const exp = (n: number) => Array(n).fill('黑桃1') as string[];

  it('由未覺醒變成覺醒的那一次才收到覺醒效果，同一狀態再問就沒有', () => {
    const fx = createEffects([rangerAwake]);
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { exp: exp(8) } });
    g.state.awakeSeen[0] = false;
    expect(labels(fx.windowEffects(g, 0, 'onAwaken'))).toEqual(['W']);
    expect(fx.windowEffects(g, 0, 'onAwaken')).toEqual([]);
  });

  it('退出覺醒後再次達標，視為重新覺醒', () => {
    const fx = createEffects([rangerAwake]);
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { exp: exp(8) } });
    g.state.awakeSeen[0] = false;
    fx.windowEffects(g, 0, 'onAwaken');
    Z(g, 0, 'exp').pop();
    expect(fx.windowEffects(g, 0, 'onAwaken')).toEqual([]);
    Z(g, 0, 'exp').push(...scenario({ p0: { exp: exp(1) } }).state.players[0].zones.exp);
    expect(labels(fx.windowEffects(g, 0, 'onAwaken'))).toEqual(['W']);
  });

  it('爆發後的窗口一併收覺醒時的效果，且在其他爆發後效果之後', () => {
    const burst = defineSource({ id: '黑桃2', at: 'gear', on: { afterBurst: (c) => c.effect({ label: 'B' }, noop) } });
    const fx = createEffects([rangerAwake, burst]);
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { gear: ['黑桃2'], exp: exp(8) } });
    g.state.awakeSeen[0] = false;
    expect(labels(fx.windowEffects(g, 0, 'afterBurst'))).toEqual(['B', 'W']);
  });
});

describe('查詢', () => {
  const add = (id: string, at: 'gear' | 'exp' | 'char' | 'lasting', n: number) =>
    defineSource({ id, at, ask: { aimLimit: () => n } });

  it('數值加總，沒有任何貢獻時為 0', () => {
    const fx = createEffects([add('黑桃2', 'gear', 1), add('黑桃3', 'exp', 2)]);
    const g = scenario({ p0: { gear: ['黑桃2'], exp: ['黑桃3'] }, p1: {} });
    expect(fx.query(g, 0, 'aimLimit')).toBe(3);
    expect(fx.query(g, 1, 'aimLimit')).toBe(0);
  });

  it('布林型任一為真；物件型欄位各自加總，缺少的欄位視為 0', () => {
    const fx = createEffects([
      defineSource({ id: '勇者', at: 'char', ask: { skipDrawPhase: () => false, combatBonus: () => ({ atk: 2 }) } }),
      defineSource({ id: '黑桃2', at: 'gear', ask: { skipDrawPhase: () => true, combatBonus: (c, { baseAtk }) => ({ atk: baseAtk, def: 1 }) } }),
    ]);
    const g = scenario({ p0: { gear: ['黑桃2'] } });
    expect(fx.query(g, 0, 'skipDrawPhase')).toBe(true);
    expect(fx.query(g, 0, 'combatBonus', { baseAtk: 5 })).toEqual({ atk: 7, def: 1, pursuitDef: 0 });
  });

  it('lasting 的查詢不論場上有幾張卡都只問一次；沒寫 lasting 的每張各問一次', () => {
    const once = createEffects([defineSource({ id: '黑桃3', at: 'exp', ask: { aimLimit: lasting(() => 1) } })]);
    const each = createEffects([defineSource({ id: '黑桃3', at: 'exp', ask: { aimLimit: () => 1 } })]);
    const g = scenario({ p0: { exp: ['黑桃3', '黑桃3'] } });
    expect(once.query(g, 0, 'aimLimit')).toBe(1);
    expect(each.query(g, 0, 'aimLimit')).toBe(2);
  });

  it('卡不在位就不貢獻；明寫 lasting 的查詢離場後仍然貢獻', () => {
    const fx = createEffects([
      defineSource({ id: '黑桃2', at: 'gear', ask: { aimLimit: () => 1 } }),
      defineSource({ id: '黑桃3', at: 'exp', ask: { vanillaBoost: lasting(() => 4) } }),
    ]);
    const g = scenario({ p0: { gear: [], exp: [] } });
    expect(fx.query(g, 0, 'aimLimit')).toBe(0);
    expect(fx.query(g, 0, 'vanillaBoost')).toBe(4);
  });

  it('查詢無副作用：連續兩次結算同一局面，整個狀態不變', () => {
    const g = scenario({ p0: { moves: ['黑桃9'], pursuit: ['黑桃1'], gear: [], exp: ['黑桃1'] } });
    const before = JSON.stringify(g.state);
    resolveCombatStats(g, 0);
    resolveCombatStats(g, 1);
    expect(JSON.stringify(g.state)).toBe(before);
  });
});

describe('moveRules', () => {
  it('沒有條目的卡回傳共用的全預設物件', () => {
    const fx = createEffects([]);
    expect(fx.moveRules('黑桃1')).toBe(NO_MOVE_RULES);
  });

  it('有條目的卡把宣告的欄位蓋在預設上', () => {
    const fx = createEffects([defineSource({ id: '黑桃1', at: 'moves', asMove: { topAtk: 2, liftAtkToDef: true } })]);
    expect(fx.moveRules('黑桃1')).toEqual({ ...NO_MOVE_RULES, topAtk: 2, liftAtkToDef: true });
  });
});

describe('回合狀態槽', () => {
  const counter = slot('測試用計數', () => ({ n: 0 }));

  it('read 不建立槽，of 才建立；兩位玩家各一份', () => {
    const g = scenario({});
    expect(counter.read(g, 0).n).toBe(0);
    expect(g.state.slots[0]).toEqual({});
    counter.of(g, 0).n++;
    counter.of(g, 0).n++;
    expect(counter.read(g, 0).n).toBe(2);
    expect(counter.read(g, 1).n).toBe(0);
  });

  it('回合開始時整批清空', () => {
    const g = scenario({});
    counter.of(g, 0).n = 5;
    const rng = new Rng(7);
    while (g.pending && g.state.turn < 2) g.submit(g.pending.player, randomResponse(g.pending, rng));
    expect(g.state.turn).toBe(2);
    expect(g.state.slots).toEqual([{}, {}]);
  });
});

describe('狀態槽的鍵', () => {
  it('各條目檔匯出的狀態槽，鍵不重複，否則兩張卡會悄悄共用同一份狀態', async () => {
    const mods = await Promise.all([
      import('../src/engine/sources/swordsman'), import('../src/engine/sources/thief'), import('../src/engine/sources/archer'),
      import('../src/engine/sources/mage'), import('../src/engine/sources/merchant'), import('../src/engine/sources/common'),
    ]);
    const keys = mods.flatMap((m) => Object.values(m)).flatMap((v) => (v && typeof v === 'object' && 'of' in v && 'key' in v ? [(v as { key: string }).key] : []));
    expect(keys.length).toBeGreaterThan(5);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('型別', () => {
  it('條目的常駐位置必填', () => {
    // @ts-expect-error 沒有 at 是編譯錯誤
    const bad: EffectSource = { id: '黑桃1' };
    expect(bad.id).toBe('黑桃1');
  });
});
