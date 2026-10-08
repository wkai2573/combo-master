import { describe, expect, it } from 'vitest';
import { cardOpt, Z, data } from '../src/engine/ops';
import { frameFor, viewFor } from '../src/engine/view';
import { pick, scenario } from './helpers';

// 裏側的經驗卡只對擁有者顯示牌面（ADR 0003）：測試放在玩家視角（viewFor／影格／提示）這道接縫上
const exp = (g: ReturnType<typeof scenario>, viewer: 0 | 1, owner: 0 | 1 = 0) => viewFor(g, viewer).players[owner].exp;

describe('裏側卡的視角', () => {
  it('裏側的經驗卡：擁有者看得到牌面，對手只有牌背，雙方都看得出它是裏側', () => {
    const g = scenario({ p0: { exp: ['黑桃3', '~黑桃4'] } });
    const [frontMine, backMine] = exp(g, 0);
    expect(frontMine).toMatchObject({ id: '黑桃3', covered: false });
    expect(backMine).toMatchObject({ id: '黑桃4', covered: true });
    const [frontOpp, backOpp] = exp(g, 1);
    expect(frontOpp).toMatchObject({ id: '黑桃3', covered: false });
    expect(backOpp).toMatchObject({ id: null, covered: true });
  });

  it('對手的視角看自己的裏側卡也是牌背：兩邊各自只看得到自己的', () => {
    const g = scenario({ p0: { exp: ['~黑桃4'] }, p1: { exp: ['~黑桃7'] } });
    expect(exp(g, 0, 0)[0].id).toBe('黑桃4');
    expect(exp(g, 0, 1)[0].id).toBeNull();
    expect(exp(g, 1, 1)[0].id).toBe('黑桃7');
    expect(exp(g, 1, 0)[0].id).toBeNull();
  });

  it('翻回表側後，雙方都看得到牌面', () => {
    const g = scenario({ p0: { exp: ['~黑桃4'] } });
    Z(g, 0, 'exp')[0].covered = false;
    for (const viewer of [0, 1] as const) expect(exp(g, viewer)[0]).toMatchObject({ id: '黑桃4', covered: false });
  });

  it('動畫影格也一樣：擁有者視角的影格帶裏側卡牌面，對手視角的影格不帶', () => {
    const g = scenario({
      animate: true,
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    g.drainFrames();
    pick(g, '冰霜護甲');
    pick(g, '發動');
    g.submit(g.pending!.player, g.pending!.options.slice(0, 3).map((o) => o.key));
    const frames = g.drainFrames();
    expect(frames.length).toBeGreaterThan(0);
    let covered = 0;
    for (const f of frames) {
      for (const viewer of [0, 1] as const) {
        const seen = frameFor(f, viewer).view.players[0].exp.filter((c) => c.covered);
        expect(seen.every((c) => (c.id !== null) === (viewer === 0))).toBe(true);
        covered += seen.length;
      }
    }
    expect(covered).toBeGreaterThan(0); // 確實檢查到裏側卡
  });

  it('冰霜護甲：選裏側卡的提示帶牌面與卡名，擁有者看著牌面選；被捨棄進棄牌區後雙方都看得到', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    const req = g.pending!;
    expect(req.options).toHaveLength(4);
    // 蓋2 之後，黑桃3、黑桃4 也成了裏側；每個選項都帶牌面與卡名
    expect(req.options.map((o) => o.label).sort()).toEqual(['黑桃3', '黑桃4', '黑桃5', '黑桃6']);
    for (const o of req.options) {
      expect(o.cardId).toBe(o.label);
      expect(o.hidden).toBeUndefined();
    }
    // 選項的 uid 對得上經驗區裡的裏側卡（經驗區的裏側卡可以直接點）
    const covered = new Set(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.uid));
    expect(req.options.every((o) => covered.has(o.uid!))).toBe(true);

    pick(g, '黑桃5', '黑桃6', '黑桃4');
    const dropped = Z(g, 0, 'discard').map((c) => data(c).name);
    expect(dropped.sort()).toEqual(['黑桃4', '黑桃5', '黑桃6']);
    for (const viewer of [0, 1] as const) {
      expect(viewFor(g, viewer).players[0].discard.map((c) => c.id).sort()).toEqual(['黑桃4', '黑桃5', '黑桃6']);
    }
  });

  it('提示選項依選擇者決定：不是擁有者就看不到裏側卡的牌面與卡名', () => {
    const g = scenario({ p0: { exp: ['~黑桃4'] } });
    const card = Z(g, 0, 'exp')[0];
    expect(cardOpt(card, undefined, 0)).toMatchObject({ cardId: '黑桃4', label: '黑桃4' });
    const opp = cardOpt(card, undefined, 1);
    expect(opp).toMatchObject({ label: '?', hidden: true });
    expect(opp.cardId).toBeUndefined();
  });

  it('遊戲紀錄不洩漏裏側卡的卡名', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    // 此時四張都是裏側：選之前的紀錄不能有它們的卡名（冰霜護甲與打出的黑桃2 本身是公開的）
    const log = g.state.log.join('\n');
    for (const name of ['黑桃3', '黑桃4', '黑桃5', '黑桃6']) expect(log).not.toContain(name);
  });

  it('其他提示的卡片選項不受影響：手牌選項仍帶牌面', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    const o = g.pending!.options.find((x) => x.label === '黑桃9');
    expect(o?.cardId).toBe('黑桃9');
    expect(o?.hidden).toBeUndefined();
  });
});
