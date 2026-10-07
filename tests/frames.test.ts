import { describe, expect, it } from 'vitest';
import { PRESET_CHARACTER_IDS, presetDeck } from '../src/data/presetDecks';
import { randomResponse } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import { pay, type GameCtx } from '../src/engine/ops';
import { Rng } from '../src/engine/rng';
import { frameFor, viewFor } from '../src/engine/view';
import { atkOf, defOf, pick, scenario, title } from './helpers';

const types = (g: ReturnType<typeof scenario>, viewer: 0 | 1 = 0) => g.drainFrames().map((f) => frameFor(f, viewer));

/** types 是否依序包含 want（可夾雜其他影格） */
const hasInOrder = (types: string[], want: string[]) => {
  let i = 0;
  for (const t of types) if (t === want[i]) i++;
  return i === want.length;
};

describe('動畫影格', () => {
  it('沒開 animate 時不錄影格', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    pick(g, '黑桃9');
    expect(g.drainFrames()).toHaveLength(0);
  });

  it('一次完整的拼招依序錄下：出招 → 收招 → 翻牌與結果 → 傷害算式 → 扣血 → 歸還', () => {
    const g = scenario({ animate: true, p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    g.drainFrames(); // 丟掉開局的影格
    pick(g, '黑桃9');
    const frames = types(g);
    const t = frames.map((f) => f.fx.type);
    expect(
      hasInOrder(t, ['play', 'pass', 'pass', 'phase', 'flip', 'flipResult', 'flip', 'flipResult', 'calc', 'damage', 'return']),
    ).toBe(true);

    // 傷害算式的數字與實際扣血一致（與 rules.test 的情境相同；玩家1 是刺客，追擊成功 +1）
    const d0 = atkOf('黑桃9') + atkOf('黑桃1') + 1 - defOf('黑桃5');
    const d1 = atkOf('黑桃5') + atkOf('黑桃1') - defOf('黑桃9');
    const calc = frames.find((f) => f.fx.type === 'calc')!.fx;
    expect(calc.type === 'calc' && calc.dmg).toEqual([d0, d1]);
    const dmg = frames.find((f) => f.fx.type === 'damage')!.view;
    expect(dmg.players[0].rage).toHaveLength(d0);
    // 對手的怒氣區內容對我方是隱藏的，但張數看得到
    expect(dmg.players[1].rage).toHaveLength(d1);
    expect(dmg.players[1].rage.every((c) => c.id === null)).toBe(true);
  });

  it('翻牌影格的牌還在牌組、結果影格的牌已到追擊區或手中', () => {
    const g = scenario({
      animate: true,
      p0: { hand: ['黑桃5'], deck: ['黑桃1', ...Array(20).fill('黑桃2')] },
      p1: { hand: ['黑桃9'] },
    });
    g.drainFrames();
    pick(g, '黑桃9');
    const frames = types(g);
    const i = frames.findIndex((f) => f.fx.type === 'flip' && f.fx.player === 0);
    const flip = frames[i];
    const result = frames[i + 1];
    expect(flip.fx.type === 'flip' && flip.fx.cardId).toBe('黑桃1');
    expect(flip.view.players[0].pursuit).toHaveLength(0);
    expect(result.fx.type === 'flipResult' && result.fx.ok).toBe(true); // 黑桃1 不在 5~9 範圍內
    expect(result.view.players[0].pursuit.map((c) => c.id)).toEqual(['黑桃1']);
  });

  it('影格不洩漏對手手牌，且紀錄長度不會倒退', () => {
    const g = scenario({ animate: true, p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9', '黑桃2'] } });
    pick(g, '黑桃9');
    const frames = types(g, 0);
    expect(frames.length).toBeGreaterThan(3);
    for (const f of frames) {
      expect(f.view.players[1].hand.every((c) => c.id === null)).toBe(true);
      expect(f.view.log).toEqual([]); // 影格不攜帶完整紀錄，改以 logLen 截取
    }
    const lens = frames.map((f) => f.logLen);
    expect([...lens].sort((a, b) => a - b)).toEqual(lens);
  });

  it('支付費用自成一個影格：先看到蓋 X，之後才是效果的結果', () => {
    const g = scenario({
      animate: true, chars: ['法師', '勇者'],
      p0: { hand: ['火球'], exp: ['黑桃3', '黑桃4', '黑桃5'] }, p1: { hand: [] },
    });
    g.drainFrames(); // 丟掉開局到「是否發動」之前的影格
    // 唯一可出的招式自動打出，停在「是否發動火球」
    pick(g, '發動');
    const frames = types(g);
    const covered = (f: (typeof frames)[number]) => f.view.players[0].exp.filter((c) => c.covered).length;
    const paid = frames.findIndex((f) => covered(f) === 3);
    expect(paid).toBeGreaterThan(-1);
    expect(frames[paid].view.players[1].discard).toHaveLength(0); // 直擊 2 還沒發生
    expect(frames.some((f, i) => i > paid && f.view.players[1].discard.length === 2)).toBe(true);
  });

  it('玩家每次要回應之前，最後一個影格的桌面一定等於真實桌面（沒有未呈現的變化）', () => {
    const zoneUids = (v: ReturnType<typeof viewFor>) =>
      v.players.map((pv) => ({
        deck: pv.deckCount,
        zones: (['hand', 'discard', 'rage', 'exp', 'combat', 'pursuit', 'gear', 'buff'] as const).map((z) => pv[z].map((c) => `${c.uid}${c.covered ? '~' : ''}`)),
      }));
    const ids = PRESET_CHARACTER_IDS;
    for (let seed = 1; seed <= 12; seed++) {
      const a = ids[seed % ids.length];
      const b = ids[(seed * 3 + 1) % ids.length];
      const g = new Game({
        decks: [{ charId: a, cards: presetDeck(a) }, { charId: b, cards: presetDeck(b) }], seed, animate: true,
      });
      const rng = new Rng(seed);
      let last = g.drainFrames().at(-1);
      for (let step = 0; g.pending && step < 3000; step++) {
        const fresh = g.drainFrames();
        last = fresh.at(-1) ?? last;
        expect(last, `seed ${seed} 第 ${step} 步沒有影格`).toBeDefined();
        expect(zoneUids(frameFor(last!, 0).view), `seed ${seed} 第 ${step} 步（${a} vs ${b}）`).toEqual(zoneUids(viewFor(g, 0, false)));
        g.submit(g.pending.player, randomResponse(g.pending, rng));
      }
      expect(g.pending, `seed ${seed} 在步數上限內沒有結束`).toBeNull();
    }
  });

  it('發動效果自成一個影格，在付費與效果結果之前，並指出發動的是哪張牌', () => {
    const g = scenario({
      animate: true, chars: ['法師', '勇者'],
      p0: { hand: ['火球'], exp: ['黑桃3', '黑桃4', '黑桃5'] }, p1: { hand: [] },
    });
    g.drainFrames();
    pick(g, '發動');
    const frames = types(g);
    const at = frames.findIndex((f) => f.fx.type === 'activate');
    expect(at).toBeGreaterThan(-1);
    const fx = frames[at].fx;
    expect(fx.type === 'activate' && [fx.player, fx.cardId]).toEqual([0, '火球']);
    // 那張牌就是戰鬥區最上方的火球
    const fireball = frames[at].view.players[0].combat.at(-1)!;
    expect(fx.type === 'activate' && fx.uid).toBe(fireball.uid);
    // 發動時還沒付費、效果還沒生效
    expect(frames[at].view.players[0].exp.some((c) => c.covered)).toBe(false);
    expect(frames[at].view.players[1].discard).toHaveLength(0);
  });

  it('不用付費的效果也有發動影格（伏擊）', () => {
    const g = scenario({ animate: true, chars: ['刺客', '勇者'], p0: { hand: ['伏擊'] }, p1: { hand: [] } });
    const act = types(g).find((f) => f.fx.type === 'activate' && f.fx.cardId === '伏擊');
    expect(act).toBeDefined();
    expect(act!.caption).toContain('伏擊');
  });

  it('經驗卡被覆蓋時，覆蓋反應的效果有發動影格', () => {
    const g = scenario({ animate: true, p0: { exp: ['高價賣出', '黑桃3'] } });
    g.drainFrames();
    pay(g as unknown as GameCtx, 0, { cover: 1 }).next();
    const acts = types(g).filter((f) => f.fx.type === 'activate');
    expect(acts.map((f) => f.fx.type === 'activate' && f.fx.cardId)).toEqual(['高價賣出']);
  });

  it('瞄準：把牌組頂的牌放到牌組底，錄一個專屬影格，之後判定的是下一張', () => {
    const g = scenario({
      animate: true, chars: ['遊俠', '勇者'],
      p0: { hand: ['黑桃5'], deck: ['黑桃1', '黑桃2', ...Array(20).fill('黑桃3')] }, p1: { hand: ['黑桃9'] },
    });
    g.drainFrames();
    pick(g, '黑桃9');
    expect(title(g)).toContain('瞄準');
    pick(g, '放到牌組底，改看下一張');
    const frames = types(g);
    const swap = frames.findIndex((f) => f.fx.type === 'aimSwap');
    expect(swap).toBeGreaterThan(-1);
    const fx = frames[swap].fx;
    expect(fx.type === 'aimSwap' && fx.player).toBe(0);
    // 牌組張數不變（只是換了位置），下一個翻開的是原本的第 2 張
    expect(frames[swap].view.players[0].deckCount).toBe(frames[swap - 1].view.players[0].deckCount);
    const flip = frames.slice(swap).find((f) => f.fx.type === 'flip' && f.fx.player === 0);
    expect(flip?.fx.type === 'flip' && flip.fx.cardId).toBe('黑桃2');
  });
});
