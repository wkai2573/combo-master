import { describe, expect, it } from 'vitest';
import { triggerWindow, type WindowEffect } from '../src/engine/window';
import { Z } from '../src/engine/ops';
import { botChoice } from '../src/engine/bot';
import { Rng } from '../src/engine/rng';
import type { Request } from '../src/engine/types';
import { names, pick, scenario } from './helpers';
import { 伏擊狀態 } from '../src/engine/sources/thief';
import { 凡骨狀態 } from '../src/engine/sources/swordsman';

const labels = (g: ReturnType<typeof scenario>) => g.pending!.options.map((o) => o.label);

const CAT = '【招財貓】爆發時，抽 1（蓋2）';
const ORDER = '【商人】調整表側經驗的順序';
const TAKE = '【商人】覺醒：將 1 張表側經驗加入手牌';
const END = '結束（不再發動）';

/** 商人帶招財貓，爆發把黑桃3 放進經驗區：表側經驗依序是 黑桃1、黑桃2、黑桃4、黑桃3 */
const burst = (exp = ['黑桃1', '黑桃2', '黑桃4']) =>
  scenario({
    chars: ['商人', '勇者'],
    phase: '爆發',
    singlePhase: true,
    p0: { hand: ['黑桃3'], gear: ['招財貓'], exp },
    p1: { hand: [] },
  });

describe('觸發窗口：爆發後', () => {
  it('同時有多個可發動的效果時列出選單，標示費用，並有結束選項', () => {
    const g = burst();
    pick(g, '黑桃3');
    expect(g.pending!.title).toContain('爆發後');
    expect(labels(g)).toEqual([CAT, ORDER, END]);
  });

  it('可以先發招財貓：蓋最前面的 2 張，之後剩下的單一效果維持發動與否的確認', () => {
    const g = burst();
    pick(g, '黑桃3');
    pick(g, CAT);
    expect(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id)).toEqual(['黑桃1', '黑桃2']);
    expect(Z(g, 0, 'hand')).toHaveLength(3); // 爆發抽 2，招財貓再抽 1
    expect(g.pending!.title).toContain('調整表側經驗的順序'); // 只剩一個：原本的確認
    expect(labels(g)).toEqual(['發動', '不發動']);
  });

  it('先調整順序再發招財貓，蓋到的卡不一樣', () => {
    const g = burst();
    pick(g, '黑桃3');
    pick(g, ORDER);
    pick(g, '黑桃4', '黑桃3', '黑桃2', '黑桃1');
    expect(names(g, 0, 'exp')).toEqual(['黑桃4', '黑桃3', '黑桃2', '黑桃1']);
    expect(g.pending!.title).toContain('招財貓');
    pick(g, '發動');
    expect(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id)).toEqual(['黑桃4', '黑桃3']);
  });

  it('可以選擇結束，什麼都不發', () => {
    const g = burst();
    pick(g, '黑桃3');
    pick(g, END);
    expect(g.pending).toBeNull();
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
    expect(Z(g, 0, 'hand')).toHaveLength(0 + 2); // 只有爆發抽的 2 張，招財貓沒有發
  });

  it('每發完一個就重新檢查：蓋2 之後表側不足，調整順序從清單消失，窗口直接結束', () => {
    const g = burst(['黑桃1']); // 爆發後表側只有黑桃1、黑桃3
    pick(g, '黑桃3');
    expect(labels(g)).toEqual([CAT, ORDER, END]);
    pick(g, CAT);
    expect(g.pending).toBeNull();
  });

  it('同一個效果在窗口內最多發動一次', () => {
    const g = burst(['黑桃1', '黑桃2', '黑桃4', '黑桃5']);
    pick(g, '黑桃3');
    pick(g, ORDER);
    pick(g, '黑桃3', '黑桃5', '黑桃4', '黑桃2', '黑桃1');
    // 順序調整完：剩招財貓一個，選單不會再出現調整順序
    expect(g.pending!.title).toContain('招財貓');
  });

  it('覺醒商人：三個效果都能自己選，先把表側經驗加入手牌再發招財貓', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃3'], gear: ['招財貓'], exp: [...Array(7).fill('黑桃1'), '黑桃4'] },
      p1: { hand: [] },
    });
    pick(g, '黑桃3');
    expect(labels(g)).toEqual([CAT, ORDER, TAKE, END]);
    pick(g, TAKE);
    pick(g, '黑桃4');
    expect(names(g, 0, 'hand')).toContain('黑桃4');
    expect(labels(g)).toEqual([CAT, ORDER, END]);
  });

  it('只有一個效果可發動時維持原本的發動與不發動確認', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃3'], gear: ['招財貓'], exp: ['黑桃1', '黑桃2'] },
      p1: { hand: [] },
    });
    pick(g, '黑桃3');
    expect(g.pending!.title).toContain('招財貓');
    expect(labels(g)).toEqual(['發動', '不發動']);
  });

  it('先攻方先處理完自己的爆發窗口，再換後攻方', () => {
    const g = scenario({
      chars: ['商人', '商人'],
      first: 1,
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃3'], gear: ['招財貓'], exp: ['黑桃1', '黑桃2', '黑桃4'] },
      p1: { hand: ['黑桃6'], gear: ['招財貓'], exp: ['黑桃1', '黑桃2', '黑桃4'] },
    });
    expect(g.pending!.player).toBe(1);
    pick(g, '黑桃6');
    expect(g.pending!.player).toBe(1);
    expect(g.pending!.title).toContain('爆發後');
    pick(g, END);
    expect(g.pending!.player).toBe(0);
    expect(g.pending!.title).toContain('爆發階段');
    pick(g, '黑桃3');
    expect(g.pending!.player).toBe(0);
    expect(g.pending!.title).toContain('爆發後');
  });

  it('機器人回應窗口選單不會卡住，整局壓測不卡', () => {
    const g = burst();
    const rng = new Rng(7);
    let steps = 0;
    while (g.pending && steps++ < 50) g.submit(g.pending.player, botChoice(g.pending, rng));
    expect(g.pending).toBeNull();
  });
});

describe('觸發窗口機制：強制效果與排序', () => {
  const run = (g: ReturnType<typeof scenario>, effects: WindowEffect[]) => {
    const gen = triggerWindow(g, 0, '測試時機', effects);
    const prompts: Request[] = [];
    let r = gen.next();
    return {
      prompts,
      step: (keys?: string[]) => {
        if (!r.done) {
          prompts.push(r.value);
          r = gen.next(keys as string[]);
        }
        return r;
      },
      get done() {
        return r.done === true;
      },
      get current(): Request | undefined {
        return r.done ? undefined : r.value;
      },
    };
  };
  const effect = (name: string, log: string[], extra: Partial<WindowEffect> = {}): WindowEffect => ({
    label: name,
    available: () => true,
    *run() {
      log.push(name);
    },
    ...extra,
  });

  it('強制效果標示強制、沒有結束選項，只能排序', () => {
    const g = scenario();
    const log: string[] = [];
    const w = run(g, [effect('甲', log, { mandatory: true }), effect('乙', log, { mandatory: true })]);
    expect(w.current!.options.map((o) => o.label)).toEqual(['【強制】甲', '【強制】乙']);
    w.step(['e1']); // 先發乙；剩下的強制效果只剩一個，不問直接處理
    expect(w.done).toBe(true);
    expect(log).toEqual(['乙', '甲']);
  });

  it('清單上還有強制效果時，可選效果也沒有結束選項；強制處理完才能結束', () => {
    const g = scenario();
    const log: string[] = [];
    const w = run(g, [effect('強', log, { mandatory: true }), effect('選一', log), effect('選二', log)]);
    expect(w.current!.options.map((o) => o.label)).toEqual(['【強制】強', '選一', '選二']);
    w.step(['e1']);
    expect(w.current!.options.map((o) => o.label)).toEqual(['【強制】強', '選二']);
    w.step(['e0']); // 強制處理完；只剩一個可選效果，交給效果自己決定要不要確認（這裡的效果不問，直接執行）
    expect(w.done).toBe(true);
    expect(log).toEqual(['選一', '強', '選二']);
  });

  it('沒有強制效果時可以結束，剩下的都不發', () => {
    const g = scenario();
    const log: string[] = [];
    const w = run(g, [effect('甲', log), effect('乙', log), effect('丙', log)]);
    expect(w.current!.options.map((o) => o.label)).toEqual(['甲', '乙', '丙', '結束（不再發動）']);
    w.step(['e2']);
    expect(w.current!.options.map((o) => o.label)).toEqual(['甲', '乙', '結束（不再發動）']);
    w.step(['end']);
    expect(w.done).toBe(true);
    expect(log).toEqual(['丙']);
  });

  it('不再可用的效果會從清單移除', () => {
    const g = scenario();
    const log: string[] = [];
    let ok = true;
    const w = run(g, [
      effect('甲', log, { *run() { log.push('甲'); ok = false; } }),
      effect('乙', log, { available: () => ok }),
      effect('丙', log),
    ]);
    w.step(['e0']); // 甲處理後乙不可用，只剩丙：直接處理
    expect(w.done).toBe(true);
    expect(log).toEqual(['甲', '丙']);
  });

  it('選單裡選定的效果以 confirmed=true 執行；只剩一個可選效果時 confirmed=false', () => {
    const g = scenario();
    const seen: boolean[] = [];
    const rec = (name: string): WindowEffect => ({ label: name, available: () => true, *run(c) { seen.push(c); } });
    const w = run(g, [rec('甲'), rec('乙')]);
    w.step(['e0']);
    expect(seen).toEqual([true, false]);
    expect(w.done).toBe(true);
  });
});

describe('提示：窗口選單', () => {
  it('選單必須選 1 個；選項依序是各效果與結束', () => {
    const g = scenario({ chars: ['商人', '勇者'], phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'], gear: ['招財貓'], exp: ['黑桃1', '黑桃2'] }, p1: { hand: [] } });
    pick(g, '黑桃3');
    expect(g.pending!.options.map((o) => o.key)).toEqual(['e0', 'e1', 'end']);
    expect(g.pending!.min).toBe(1);
    expect(g.pending!.max).toBe(1);
  });
});

describe('觸發窗口：回合開始', () => {
  const start = (p0: Parameters<typeof scenario>[0] extends infer S ? (S extends { p0?: infer P } ? P : never) : never, extra: Partial<Parameters<typeof scenario>[0]> = {}) =>
    scenario({ chars: ['商人', '刺客'], phase: '重置', singlePhase: true, p0, ...extra });

  it('家族相片可選、凡骨的意志強制：選單標示強制且沒有結束選項', () => {
    const g = start({ gear: ['家族相片'], exp: ['凡骨的意志', '黑桃3', '黑桃4'], rage: Array(4).fill('黑桃1') });
    expect(g.pending!.title).toContain('回合開始');
    expect(labels(g).map((l) => l.replace(/^【強制】/, '強制：'))).toEqual([
      '【家族相片】回復 1（蓋1、怒3）',
      '強制：【凡骨的意志】蓋前 2 張表側經驗，此回合總攻擊與總防禦加上戰鬥區白板卡的數量',
    ]);
  });

  it('先發家族相片會蓋到凡骨的意志自己，凡骨就沒有效果；先發凡骨則兩張都能發', () => {
    const a = start({ gear: ['家族相片'], exp: ['凡骨的意志', '黑桃3', '黑桃4'], rage: Array(4).fill('黑桃1') });
    pick(a, '【家族相片】回復 1（蓋1、怒3）');
    expect(Z(a, 0, 'exp').map((c) => c.covered)).toEqual([true, false, false]);
    expect(凡骨狀態.read(a, 0).uids).toEqual([]); // 凡骨已被蓋成裏側，從清單消失
    expect(a.pending).toBeNull();

    const b = start({ gear: ['家族相片'], exp: ['凡骨的意志', '黑桃3', '黑桃4'], rage: Array(4).fill('黑桃1') });
    pick(b, '【強制】【凡骨的意志】蓋前 2 張表側經驗，此回合總攻擊與總防禦加上戰鬥區白板卡的數量');
    expect(凡骨狀態.read(b, 0).uids).toEqual([]); // 前 2 張就包含它自己：蓋到自己而失效
    expect(Z(b, 0, 'exp').map((c) => c.covered)).toEqual([true, true, false]);
    expect(b.pending!.title).toContain('家族相片'); // 只剩一個可選效果：原本的確認
    pick(b, '發動');
    expect(Z(b, 0, 'exp').map((c) => c.covered)).toEqual([true, true, true]);
  });

  it('兩個強制效果：凡骨的意志與中毒，自己決定先後，都會處理', () => {
    const g = scenario({
      chars: ['刺客', '商人'],
      first: 0,
      phase: '重置',
      singlePhase: true,
      p0: { exp: ['黑桃1'] },
      p1: { exp: ['Ex-中毒', '黑桃3', '凡骨的意志'] },
    });
    // 玩家0 先攻：先處理玩家0（沒有效果），再到玩家1 的窗口
    expect(g.pending!.player).toBe(1);
    expect(labels(g)).toHaveLength(2);
    expect(labels(g).every((l) => l.startsWith('【強制】'))).toBe(true);
    pick(g, '【強制】【中毒】直擊 3');
    expect(g.pending).toBeNull(); // 剩下的凡骨強制效果直接處理
    expect(凡骨狀態.read(g, 1).uids).toHaveLength(1);
    expect(Z(g, 1, 'discard')).toHaveLength(3);
  });

  it('凡骨的意志先發，把中毒蓋住：中毒不再發動', () => {
    const g = scenario({
      chars: ['刺客', '商人'],
      first: 0,
      phase: '重置',
      singlePhase: true,
      p0: { exp: ['黑桃1'] },
      p1: { exp: ['Ex-中毒', '黑桃3', '凡骨的意志'] },
    });
    pick(g, labels(g).find((l) => l.includes('凡骨的意志'))!);
    expect(Z(g, 1, 'exp').map((c) => c.covered)).toEqual([true, true, false]);
    expect(g.pending).toBeNull(); // 中毒已失效，從窗口消失
    expect(Z(g, 1, 'discard')).toHaveLength(0); // 沒有被直擊
  });

  it('先攻方先處理完自己的窗口，再換後攻方', () => {
    const g = scenario({
      chars: ['商人', '商人'],
      first: 1,
      phase: '重置',
      singlePhase: true,
      p0: { gear: ['家族相片'], exp: ['凡骨的意志', '黑桃3'], rage: Array(4).fill('黑桃1') },
      p1: { gear: ['家族相片'], exp: ['凡骨的意志', '黑桃3'], rage: Array(4).fill('黑桃1') },
    });
    expect(g.pending!.player).toBe(1);
    pick(g, '【家族相片】回復 1（蓋1、怒3）');
    expect(g.pending!.player).toBe(0);
    expect(g.pending!.title).toContain('回合開始');
  });
});

describe('觸發窗口：傷害計算後', () => {
  const hit = (exp: string[]) =>
    scenario({ p0: { hand: ['黑桃1'], exp, rage: Array(12).fill('黑桃1') }, p1: { hand: ['黑桃9'] } });

  it('兩張復仇之嚎各算一個效果：選單可以選要發哪張，也可以結束', () => {
    const g = hit(['復仇之嚎', '復仇之嚎']);
    伏擊狀態.of(g, 1).atk = 3; // 對方多 3 點總攻擊：受到的傷害大於造成的
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('傷害計算後');
    const REV = '【復仇之嚎】將怒氣區上方 1 張卡加入手牌（怒3）';
    // 文字相同的效果註明卡所在的位置，並帶卡的 uid 讓畫面亮起對應的卡
    expect(labels(g)).toEqual([`${REV}（經驗區第 1 張）`, `${REV}（經驗區第 2 張）`, '結束（不再發動）']);
    expect(g.pending!.options.map((o) => o.uid)).toEqual([...Z(g, 0, 'exp').map((c) => c.uid), undefined]);
    const rage = Z(g, 0, 'rage').length;
    pick(g, `${REV}（經驗區第 2 張）`);
    expect(Z(g, 0, 'rage')).toHaveLength(rage - 4);
    expect(g.pending!.title).toContain('復仇之嚎'); // 剩下一張：原本的確認
    pick(g, '不發動');
    expect(Z(g, 0, 'rage')).toHaveLength(rage - 4);
  });

  it('傷害沒有大於造成的傷害，就沒有窗口', () => {
    const g = scenario({ p0: { hand: ['黑桃9'], exp: ['復仇之嚎', '復仇之嚎'], rage: Array(12).fill('黑桃1') }, p1: { hand: ['黑桃1'] } });
    pick(g, '黑桃1');
    expect(g.pending?.title ?? '').not.toContain('復仇之嚎');
  });
});

describe('觸發窗口：收招時', () => {
  it('冰與雷之曲進窗口，只有它一個可選效果時維持原本的發動與不發動確認', () => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], moves: ['冰霜護甲', '電弧'], rage: ['黑桃4'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    expect(g.pending!.title).toContain('冰與雷之曲');
    expect(labels(g)).toEqual(['發動', '不發動']);
  });
});

describe('觸發窗口：被蓋成裏側的蓋反應', () => {
  it('同一次蓋到兩張有蓋反應的卡，擁有者決定先後，兩個都強制', () => {
    const g = scenario({
      p0: { hand: ['高利貸'] },
      p1: { hand: [], exp: ['低價買進', '高價賣出', '黑桃3'], rage: Array(5).fill('黑桃1'), deck: ['黑桃4', ...Array(20).fill('黑桃2')] },
    });
    // 高利貸：對方的表側且帶 [經] 的經驗有 2 張，強制蓋 2，兩張都有蓋反應
    expect(g.pending!.player).toBe(1);
    expect(g.pending!.title).toContain('被蓋成裏側');
    expect(labels(g)).toEqual(['【強制】【低價買進】被蓋成裏側：回復 3', '【強制】【高價賣出】被蓋成裏側：抽 1']);
    pick(g, '【強制】【高價賣出】被蓋成裏側：抽 1'); // 先抽牌
    expect(g.pending?.title ?? '').not.toContain('被蓋成裏側'); // 剩下的低價買進直接處理
    const log = g.state.log.join('\n');
    expect(log.indexOf('【高價賣出】被蓋成裏側')).toBeLessThan(log.indexOf('【低價買進】被蓋成裏側'));
  });
});
