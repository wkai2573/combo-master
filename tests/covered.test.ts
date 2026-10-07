import { describe, expect, it } from 'vitest';
import { Z, data } from '../src/engine/ops';
import { frameFor, viewFor } from '../src/engine/view';
import { pick, scenario } from './helpers';

// 覆蓋卡對雙方隱藏（ADR 0002）：測試放在玩家視角（viewFor／影格／提示）這道接縫上
const exp = (g: ReturnType<typeof scenario>, viewer: 0 | 1, owner: 0 | 1 = 0) => viewFor(g, viewer).players[owner].exp;

describe('覆蓋卡的視角', () => {
  it('覆蓋中的經驗卡：自己與對手的視角都沒有牌面，但看得到它是覆蓋狀態', () => {
    const g = scenario({ p0: { exp: ['黑桃3', '~黑桃4'] } });
    for (const viewer of [0, 1] as const) {
      const [front, covered] = exp(g, viewer);
      expect(front).toMatchObject({ id: '黑桃3', covered: false });
      expect(covered).toMatchObject({ id: null, covered: true });
    }
  });

  it('翻回正面後，雙方又看得到牌面', () => {
    const g = scenario({ p0: { exp: ['~黑桃4'] } });
    Z(g, 0, 'exp')[0].covered = false;
    for (const viewer of [0, 1] as const) expect(exp(g, viewer)[0]).toMatchObject({ id: '黑桃4', covered: false });
  });

  it('動畫影格也一樣：兩邊視角的影格都不含覆蓋卡的牌面', () => {
    const g = scenario({
      animate: true,
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    g.drainFrames();
    pick(g, '冰霜護甲');
    pick(g, '發動');
    g.submit(g.pending!.player, g.pending!.options.slice(0, 2).map((o) => o.key));
    const frames = g.drainFrames();
    expect(frames.length).toBeGreaterThan(0);
    let covered = 0;
    for (const f of frames) {
      for (const viewer of [0, 1] as const) {
        const seen = frameFor(f, viewer).view.players[0].exp.filter((c) => c.covered);
        expect(seen.every((c) => c.id === null)).toBe(true);
        covered += seen.length;
      }
    }
    expect(covered).toBeGreaterThan(0); // 確實檢查到覆蓋卡
  });

  it('冰霜護甲盲選：選項不帶牌面也不帶卡名，只能依位置選；被捨棄進棄牌區後才公開', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    const req = g.pending!;
    expect(req.options).toHaveLength(4);
    for (const o of req.options) {
      expect(o.cardId).toBeUndefined();
      expect(o.label).toBe('?');
      expect(o.hidden).toBe(true);
    }
    // 選項的 uid 對得上經驗區裡的覆蓋卡（經驗區的覆蓋卡可以直接點）
    const covered = new Set(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.uid));
    expect(req.options.every((o) => covered.has(o.uid!))).toBe(true);

    // 依位置選前兩張：離開經驗區進入公開的棄牌區，雙方都看得到
    g.submit(req.player, req.options.slice(0, 2).map((o) => o.key));
    const dropped = Z(g, 0, 'discard').map((c) => data(c).name);
    expect(dropped).toHaveLength(2);
    for (const viewer of [0, 1] as const) {
      expect(viewFor(g, viewer).players[0].discard.map((c) => c.id)).toEqual(expect.arrayContaining(dropped));
    }
  });

  it('其他提示的卡片選項不受影響：手牌選項仍帶牌面', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    const o = g.pending!.options.find((x) => x.label === '黑桃9');
    expect(o?.cardId).toBe('黑桃9');
    expect(o?.hidden).toBeUndefined();
  });
});
