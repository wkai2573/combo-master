import { flightTiming } from '../engine/flights';
import { statChanges, type StatChanges } from '../engine/stats';
import type { FrameFx } from '../engine/types';
import type { Frame, GameView } from '../engine/view';

export type Speed = 'normal' | 'fast' | 'off';

/** 各速度的停留時間倍率；0 表示不播動畫 */
export const SCALE: Record<Speed, number> = { normal: 1, fast: 0.45, off: 0 };

/** 每個影格至少停留這麼久（毫秒） */
const MIN_HOLD_MS = 150;

export interface Batch {
  id: number;
  frames: Frame[];
}

/** 一側的傷害震動：第一張牌落進怒氣區的時候才開始，延遲已乘上速度倍率 */
export interface Hit {
  amount: number;
  key: number;
  delay: number;
}

/** 播放的過程中，某一刻畫面該顯示的內容 */
export interface Presentation {
  /** 此刻該顯示的桌面；還沒有任何狀態時是 null */
  view: GameView | null;
  /** 相對上一個顯示的桌面的數值變化；沒有播放、或是開局抽牌時沒有 */
  changes?: StatChanges;
  fx?: FrameFx;
  /** 第幾個播放的影格（遞增；用來讓同樣的特效能重新播放），沒有播放為 0 */
  fxKey: number;
  caption?: string;
  hits: [Hit | undefined, Hit | undefined];
  /** 有一個影格正在播 */
  playing: boolean;
  /** 播完，而且不在空檔：這時才顯示結果視窗、允許作弊面板操作 */
  settled: boolean;
  scale: number;
}

interface Playing {
  frame: Frame;
  n: number;
  /** 這一格相對上一個顯示的桌面的數值變化：換格的當下算一次，這一格播放期間不變 */
  changes?: StatChanges;
}

/**
 * 依序播放引擎錄下的動畫影格的狀態機。沒有計時器：呼叫端依 ingest 與 advance 回傳的毫秒數，
 * 時間到了再呼叫 advance。present 是純函式，只讀不寫；「上一個顯示的桌面」由 settle 記錄。
 */
export class Playback {
  private queue: Frame[] = [];
  private cur: Playing | null = null;
  private seen = 0;
  private counter = 0;
  private shown: GameView | null = null;
  private _version = 0;

  /** 內部狀態每改變一次就加一；呈現依賴它重算 */
  get version(): number {
    return this._version;
  }

  /**
   * 新一批影格到了。同一個批次編號只處理一次；速度是關閉時直接丟掉。
   * 如果因此開始播第一格，回傳它要停留的毫秒，否則回傳 null。
   */
  ingest(batch: Batch | undefined, speed: Speed): number | null {
    if (!batch || batch.id === this.seen) return null;
    this.seen = batch.id;
    this._version++;
    if (SCALE[speed] === 0) return null;
    this.queue.push(...batch.frames);
    return this.cur ? null : this.advance(speed);
  }

  /** 停留時間到了，換下一格。回傳這一格要停留的毫秒；已經沒有下一格就回傳 null */
  advance(speed: Speed): number | null {
    const frame = this.queue.shift();
    this._version++;
    if (!frame) {
      this.cur = null;
      return null;
    }
    // 開局抽起始手牌不算生命變動
    const changes = frame.fx.type !== 'deal' && this.shown ? statChanges(this.shown, frame.view) : undefined;
    this.cur = { frame, n: ++this.counter, changes };
    return Math.max(MIN_HOLD_MS, frame.ms * SCALE[speed]);
  }

  /** 跳過：清掉佇列並結束目前的播放 */
  skip(): void {
    if (this.queue.length > 0 || this.cur) this._version++;
    this.queue = [];
    this.cur = null;
  }

  /** 卸載（或 StrictMode 的模擬卸載）時重置；重新掛載後同一批影格會再排入 */
  reset(): void {
    this.skip();
    this.seen = 0;
    this._version++;
  }

  /** 此刻該呈現什麼：batch 是最新收到的一批，final 是最新的真實狀態 */
  present(batch: Batch | undefined, final: GameView | null, speed: Speed): Presentation {
    const scale = SCALE[speed];
    const cur = this.cur;
    // 新的一批影格已經到了，但還沒開始播：這段空檔不能顯示最終桌面
    const gap = !!batch && batch.id !== this.seen && batch.frames.length > 0 && scale > 0;
    const first = gap ? batch.frames[0] : undefined;
    const atFrame = (f: Frame) => ({ ...f.view, log: final!.log.slice(0, f.logLen), prompt: null, waitingFor: null });
    const view: GameView | null =
      final && cur
        ? atFrame(cur.frame)
        : gap && this.shown
          ? { ...this.shown, prompt: null, waitingFor: null }
          : final && first
            ? atFrame(first)
            : final;
    const fx = cur?.frame.fx;
    const fxKey = cur?.n ?? 0;
    const dmg = fx?.type === 'damage' ? fx.dmg : null;
    // 這一批飛行的時序由傷害較多的那一方決定
    const hit = (p: 0 | 1): Hit | undefined =>
      dmg && dmg[p] > 0 ? { amount: dmg[p], key: fxKey, delay: flightTiming(Math.max(...dmg) - 1).ms * scale } : undefined;
    return {
      view, changes: cur?.changes, fx, fxKey, caption: cur?.frame.caption, hits: [hit(0), hit(1)],
      playing: cur !== null, settled: cur === null && !gap, scale,
    };
  }

  /** 渲染之後記下目前顯示的桌面，下一格的數值變化拿它來比；空檔顯示的是舊桌面或第一格，不記 */
  settle(p: Presentation): void {
    if (p.playing || p.settled) this.shown = p.view;
  }
}
