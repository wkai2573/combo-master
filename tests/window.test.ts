import { describe, expect, it } from 'vitest';
import { triggerWindow, type WindowEffect } from '../src/engine/window';
import { Z } from '../src/engine/ops';
import { botChoice } from '../src/engine/bot';
import { Rng } from '../src/engine/rng';
import type { Request } from '../src/engine/types';
import { names, pick, scenario } from './helpers';

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
    pick(g, '黑桃4'); // 排第 1
    pick(g, '黑桃3'); // 排第 2
    pick(g, '黑桃2'); // 排第 3，剩下的黑桃1 排最後
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
    pick(g, '黑桃3');
    pick(g, '黑桃5');
    pick(g, '黑桃4'); // 5 張表側要排 4 次；最後一張自動
    pick(g, '黑桃2');
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
