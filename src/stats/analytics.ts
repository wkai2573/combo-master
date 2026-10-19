import { APP_VERSION } from '../version';
import { RECORDS_API } from './config';
import type { Opponent } from './records';
import { getDeviceId, randomId } from './reporter';

/** 流量統計的對戰類型：戰績只有電腦與玩家，教學只有流量統計記 */
export type PlayType = Opponent | 'tutorial';

/**
 * 匿名流量統計：造訪、停留、有沒有開始或打完對局。
 * 只送匿名裝置代號、版本、對戰類型與事件名稱，沒有任何個人資料；送不出去就算了，不影響遊戲。
 * 只有正式站會送（沒有伺服器網址時什麼都不做），網址帶 ?notrack 可以讓這個瀏覽器不送。
 */

export interface AnalyticsEvent {
  /** beat 是心跳：更新這次造訪的可見時間，伺服器不新增資料 */
  name: 'visit' | 'beat' | 'start' | 'finish';
  visitId: string;
  deviceId: string;
  version: string;
  /** 開始與打完對局才有 */
  opponent?: PlayType;
  /** 教學的開始與完成才有：第幾課 */
  lesson?: number;
  /** 心跳才有：這次造訪到目前為止，分頁在前景可見的累計毫秒數 */
  activeMs?: number;
}

export interface AnalyticsDeps {
  send(event: AnalyticsEvent): void;
  deviceId(): string;
  newId(): string;
  version: string;
  /** 分頁現在是不是在前景可見 */
  visible(): boolean;
  /** 目前時間（毫秒） */
  now(): number;
  /** 這個瀏覽器是否關閉了統計 */
  optedOut(): boolean;
}

export interface Analytics {
  /** 登記這次頁面載入的造訪；同一次載入重複呼叫只送一次 */
  visit(): void;
  /** 定時心跳：只在分頁可見時送，掛機的分頁不會拉長停留時間 */
  heartbeat(): void;
  /** 分頁被切走或關閉的當下：把可見時間結算並補送一次心跳 */
  hidden(): void;
  /** 分頁回到前景：從這一刻起重新累計可見時間 */
  shown(): void;
  /** 開始或打完一場對局；頁面還沒登記造訪就先補登記。教學要帶是第幾課 */
  play(kind: 'start' | 'finish', opponent: PlayType, lesson?: number): void;
}

export function createAnalytics(deps: AnalyticsDeps): Analytics {
  let visitId: string | null = null;
  // 可見時間 = 已結算的累計 + 目前這一段可見（visibleSince 是這一段開始的時間，不可見時是 null）
  let settledMs = 0;
  let visibleSince: number | null = null;
  const activeMs = () => settledMs + (visibleSince === null ? 0 : deps.now() - visibleSince);
  const settle = () => {
    settledMs = activeMs();
    visibleSince = null;
  };
  const emit = (name: AnalyticsEvent['name'], extra: Pick<AnalyticsEvent, 'opponent' | 'lesson' | 'activeMs'> = {}) => {
    if (deps.optedOut() || !visitId) return;
    try {
      deps.send({ name, visitId, deviceId: deps.deviceId(), version: deps.version, ...extra });
    } catch {
      // 統計是附屬功能：任何失敗都不外洩
    }
  };
  const beat = () => emit('beat', { activeMs: Math.round(activeMs()) });
  const visit = () => {
    if (visitId || deps.optedOut()) return;
    visitId = deps.newId();
    if (deps.visible()) visibleSince = deps.now();
    emit('visit');
  };
  return {
    visit,
    heartbeat() {
      if (deps.visible() && visibleSince !== null) beat();
    },
    hidden() {
      if (!visitId) return;
      settle();
      beat();
    },
    shown() {
      if (visitId && visibleSince === null) visibleSince = deps.now();
    },
    play(kind, opponent, lesson) {
      visit();
      emit(kind, { opponent, ...(lesson === undefined ? {} : { lesson }) });
    },
  };
}

/**
 * 送出事件：純文字 POST 不需要預檢，頁面關閉時也能用 keepalive 送完。
 * 回應不重要，連線失敗或同步丟錯都吞掉。
 */
export function createEventSender(base: string, fetchFn: typeof fetch = (...a) => fetch(...a)): (event: AnalyticsEvent) => void {
  return (event) => {
    try {
      void fetchFn(`${base}/events`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify(event),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // 同步丟錯：忽略
    }
  };
}

// ───────────────────────── 排除自己 ─────────────────────────

const OFF_KEY = 'lianji.notrack';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** 這個瀏覽器是否關閉了統計；讀不到儲存時視為沒有關閉 */
export function isTrackingOff(store: Store | null = defaultStore()): boolean {
  try {
    return store?.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 處理網址的搜尋字串：notrack 關閉這個瀏覽器的統計，track 恢復。
 * 回傳去掉這兩個參數後的搜尋字串（沒有這兩個參數時原樣回傳）與有沒有處理過。
 */
export function applyTrackParam(search: string, store: Store | null = defaultStore()): { search: string; changed: boolean } {
  const params = new URLSearchParams(search);
  const off = params.has('notrack');
  const on = params.has('track');
  if (!off && !on) return { search, changed: false };
  try {
    if (off) store?.setItem(OFF_KEY, '1');
    else store?.removeItem(OFF_KEY);
  } catch {
    // 無法寫入：忽略，維持目前狀態
  }
  params.delete('notrack');
  params.delete('track');
  const rest = params.toString();
  return { search: rest ? `?${rest}` : '', changed: true };
}

// ───────────────────────── 預設實例 ─────────────────────────

const HEARTBEAT_EVERY_MS = 30_000;

const noop: Analytics = { visit() {}, heartbeat() {}, hidden() {}, shown() {}, play() {} };

let shared: Analytics | undefined;
/** 預設的統計：沒有設定伺服器網址（本機開發、測試）時什麼都不做 */
export const defaultAnalytics = (): Analytics =>
  (shared ??= RECORDS_API
    ? createAnalytics({
        send: createEventSender(RECORDS_API),
        deviceId: getDeviceId,
        newId: randomId,
        version: APP_VERSION,
        visible: () => document.visibilityState === 'visible',
        now: () => Date.now(),
        optedOut: () => isTrackingOff(),
      })
    : noop);

/** 進站時呼叫一次：登記造訪，之後分頁可見時每 30 秒回報一次可見時間，切走分頁時補送一次 */
export function startAnalytics(analytics: Analytics = defaultAnalytics()): void {
  analytics.visit();
  setInterval(() => analytics.heartbeat(), HEARTBEAT_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') analytics.hidden();
    else analytics.shown();
  });
}

/** 對局開始或打完時的去向；測試可以換成自己的接收函式 */
export type PlayTracker = (kind: 'start' | 'finish', opponent: PlayType, lesson?: number) => void;

let tracker: PlayTracker = (kind, opponent, lesson) => defaultAnalytics().play(kind, opponent, lesson);

/** 對局開始或打完時呼叫 */
export const trackPlay: PlayTracker = (kind, opponent, lesson) => tracker(kind, opponent, lesson);

/** 換掉接收函式，回傳還原的函式 */
export function setPlayTracker(next: PlayTracker): () => void {
  const prev = tracker;
  tracker = next;
  return () => {
    tracker = prev;
  };
}
