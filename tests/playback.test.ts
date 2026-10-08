import { describe, expect, it } from 'vitest';
import { flightTiming } from '../src/engine/flights';
import { frameFor, viewFor, type Frame } from '../src/engine/view';
import { Playback, SCALE } from '../src/ui/playback';
import { scenario } from './helpers';

/** 真實的開局影格與最終桌面 */
function opening() {
  const g = scenario({ animate: true });
  const frames = g.drainFrames().map((f) => frameFor(f, 0));
  return { frames, final: viewFor(g, 0) };
}
const { frames, final } = opening();
const batch = (id: number, fs: Frame[] = frames) => ({ id, frames: fs });
const withFx = (f: Frame, fx: Frame['fx'], ms = f.ms): Frame => ({ ...f, fx, ms });

describe('播放：依序播放', () => {
  it('收到一批就開始播第一格，回傳停留時間；播完回到真實狀態', () => {
    const pb = new Playback();
    const hold = pb.ingest(batch(1), 'normal');
    expect(hold).toBe(Math.max(150, frames[0].ms));
    const p = pb.present(batch(1), final, 'normal');
    expect(p.playing).toBe(true);
    expect(p.settled).toBe(false);
    expect(p.fxKey).toBe(1);
    expect(p.fx).toEqual(frames[0].fx);
    expect(p.caption).toBe(frames[0].caption);
    // 播放中顯示影格當下的桌面：沒有提示，紀錄只到當時的長度
    expect(p.view!.prompt).toBeNull();
    expect(p.view!.waitingFor).toBeNull();
    expect(p.view!.log).toEqual(final.log.slice(0, frames[0].logLen));

    for (let i = 1; i < frames.length; i++) expect(pb.advance('normal')).not.toBeNull();
    expect(pb.advance('normal')).toBeNull();
    const done = pb.present(batch(1), final, 'normal');
    expect(done.playing).toBe(false);
    expect(done.settled).toBe(true);
    expect(done.view).toBe(final);
    expect(done.fxKey).toBe(0);
  });

  it('停留時間乘上速度倍率，但至少 150 毫秒', () => {
    const pb = new Playback();
    const slow = withFx(frames[0], { type: 'info' }, 1000);
    const quick = withFx(frames[0], { type: 'info' }, 10);
    expect(pb.ingest(batch(1, [slow, quick]), 'fast')).toBe(1000 * SCALE.fast);
    expect(pb.advance('fast')).toBe(150);
  });

  it('切換速度只影響之後每一格的停留時間', () => {
    const pb = new Playback();
    const f = withFx(frames[0], { type: 'info' }, 1000);
    expect(pb.ingest(batch(1, [f, f]), 'normal')).toBe(1000);
    expect(pb.advance('fast')).toBe(450);
  });

  it('播放中又來新批次：接在佇列後面，不重新開始', () => {
    const pb = new Playback();
    const a = withFx(frames[0], { type: 'info' }, 500);
    const b = withFx(frames[0], { type: 'step' }, 500);
    pb.ingest(batch(1, [a, a]), 'normal');
    expect(pb.ingest(batch(2, [b]), 'normal')).toBeNull();
    expect(pb.present(batch(2, [b]), final, 'normal').fx).toEqual(a.fx);
    pb.advance('normal');
    pb.advance('normal');
    expect(pb.present(batch(2, [b]), final, 'normal').fx).toEqual(b.fx);
    expect(pb.present(batch(2, [b]), final, 'normal').fxKey).toBe(3);
    expect(pb.advance('normal')).toBeNull();
  });

  it('同一個批次編號只處理一次', () => {
    const pb = new Playback();
    pb.ingest(batch(1, [frames[0]]), 'normal');
    pb.advance('normal');
    expect(pb.ingest(batch(1, [frames[0]]), 'normal')).toBeNull();
    expect(pb.present(batch(1, [frames[0]]), final, 'normal').playing).toBe(false);
  });

  it('跳過：清掉佇列並結束目前的播放', () => {
    const pb = new Playback();
    pb.ingest(batch(1), 'normal');
    pb.skip();
    const p = pb.present(batch(1), final, 'normal');
    expect(p.playing).toBe(false);
    expect(p.settled).toBe(true);
    expect(pb.advance('normal')).toBeNull();
  });

  it('速度是關閉動畫時，新批次直接丟掉，不進佇列也沒有空檔', () => {
    const pb = new Playback();
    expect(pb.ingest(batch(1), 'off')).toBeNull();
    const p = pb.present(batch(1), final, 'off');
    expect(p.gap).toBe(false);
    expect(p.settled).toBe(true);
    expect(p.view).toBe(final);
    expect(p.scale).toBe(0);
    // 之後切回標準速度，不會補播
    expect(pb.advance('normal')).toBeNull();
  });

  it('沒有影格的批次（例如只有作弊）不播放也不是空檔', () => {
    const pb = new Playback();
    const empty = batch(1, []);
    expect(pb.present(empty, final, 'normal').gap).toBe(false);
    expect(pb.ingest(empty, 'normal')).toBeNull();
    expect(pb.present(empty, final, 'normal').settled).toBe(true);
  });

  it('重置後同一批會重新排入', () => {
    const pb = new Playback();
    pb.ingest(batch(1), 'normal');
    pb.reset();
    expect(pb.present(batch(1), final, 'normal').playing).toBe(false);
    expect(pb.ingest(batch(1), 'normal')).not.toBeNull();
  });
});

describe('播放：空檔', () => {
  it('批次到了但還沒開始播：沒有上一桌時取第一格的桌面，不能閃出最終桌面', () => {
    const pb = new Playback();
    const p = pb.present(batch(1), final, 'normal');
    expect(p.gap).toBe(true);
    expect(p.settled).toBe(false);
    expect(p.playing).toBe(false);
    expect(p.view).not.toBe(final);
    expect(p.view!.log).toEqual(final.log.slice(0, frames[0].logLen));
    expect(p.view!.prompt).toBeNull();
  });

  it('有上一桌時維持上一桌，提示與等待對象清空', () => {
    const pb = new Playback();
    const before = pb.present(undefined, final, 'normal');
    pb.settle(before);
    const gap = pb.present(batch(1), final, 'normal');
    expect(gap.gap).toBe(true);
    expect(gap.view).toEqual({ ...final, prompt: null, waitingFor: null });
  });

  it('空檔顯示的是舊桌面，settle 不把它記起來：數值變化拿真正顯示過的桌面來比', () => {
    const pb = new Playback();
    const oldView = { ...final, players: [{ ...final.players[0], deckCount: final.players[0].deckCount + 7 }, final.players[1]] as typeof final.players };
    pb.settle(pb.present(undefined, oldView, 'normal'));
    const k = frames.findIndex((f) => f.fx.type !== 'deal');
    const arrived = batch(1, [frames[k]]);
    pb.settle(pb.present(arrived, final, 'normal')); // 空檔
    pb.ingest(arrived, 'normal');
    const p = pb.present(arrived, final, 'normal');
    expect(p.changes!.life[0]).toBe(frames[k].view.players[0].deckCount - oldView.players[0].deckCount);
    expect(p.changes!.life[0]).not.toBe(0);
  });
});

describe('播放：數值變化', () => {
  it('播放中相對上一個顯示的桌面有變化；沒有播放時沒有', () => {
    const pb = new Playback();
    pb.settle(pb.present(undefined, final, 'normal'));
    expect(pb.present(undefined, final, 'normal').changes).toBeUndefined();
    const step = frames.findIndex((f) => f.fx.type !== 'deal');
    pb.ingest(batch(1, [frames[step]]), 'normal');
    expect(pb.present(batch(1), final, 'normal').changes).toBeDefined();
  });

  it('開局抽起始手牌不算生命變動', () => {
    const pb = new Playback();
    pb.settle(pb.present(undefined, final, 'normal'));
    const deal = frames.find((f) => f.fx.type === 'deal')!;
    pb.ingest(batch(1, [deal]), 'normal');
    expect(pb.present(batch(1), final, 'normal').changes).toBeUndefined();
  });
});

describe('播放：傷害震動', () => {
  it('只有受傷的一方有，延遲由傷害較多的那一方的飛行時序決定，並隨速度縮放', () => {
    const hurt = withFx(frames[0], { type: 'damage', dmg: [3, 0] });
    for (const speed of ['normal', 'fast'] as const) {
      const pb = new Playback();
      pb.ingest(batch(1, [hurt]), speed);
      const p = pb.present(batch(1), final, speed);
      expect(p.hits[1]).toBeUndefined();
      expect(p.hits[0]).toEqual({ amount: 3, key: 1, delay: flightTiming(2).ms * SCALE[speed] });
    }
  });

  it('雙方都受傷時各自帶自己的數字，延遲相同', () => {
    const pb = new Playback();
    pb.ingest(batch(1, [withFx(frames[0], { type: 'damage', dmg: [1, 4] })]), 'normal');
    const [a, b] = pb.present(batch(1), final, 'normal').hits;
    expect([a!.amount, b!.amount]).toEqual([1, 4]);
    expect(a!.delay).toBe(b!.delay);
  });

  it('不是傷害影格就沒有震動', () => {
    const pb = new Playback();
    pb.ingest(batch(1), 'normal');
    expect(pb.present(batch(1), final, 'normal').hits).toEqual([undefined, undefined]);
  });
});

describe('播放：沒有狀態時', () => {
  it('還沒收到任何桌面，呈現是空的', () => {
    const p = new Playback().present(undefined, null, 'normal');
    expect(p.view).toBeNull();
    expect(p.settled).toBe(true);
  });
});
