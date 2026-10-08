import { canPay, optionalPay } from './cost';
import { awakened, confirm, order, Z, type GameCtx, type Gen } from './ops';
import {
  EVENT_TITLES, NO_MOVE_RULES, SUBJECTS,
  type Ctx, type EffectSource, type EventKey, type FireArgList, type FireArgs, type MoveRules, type Offer, type Place,
  type QueryArgs, type QueryContribution, type QueryKey, type Queries,
} from './effectKit';
import { allSources } from './sources';
import type { CardInst, PlayerId } from './types';
import { triggerWindow, type WindowEffect } from './window';

/**
 * 效果來源模組（見 GLOSSARY 的「效果來源」與「時機」、docs/adr/0004）。
 * 階段函式只問「這個時機、這位玩家有哪些效果」，不認得卡名或角色名：
 * - fire／fireEach：開該時機的觸發窗口並結算
 * - query：查詢型，無副作用、不 yield
 * - moveRules：招式的靜態修正
 * - hasEffect：這個卡名或角色名有沒有實作效果
 */

// ───────────────────────── 處理器的共通欄位 ─────────────────────────

export function makeCtx(g: GameCtx, p: PlayerId, self: CardInst | null, here: () => boolean): Ctx {
  return {
    g, p, self, here,
    effect(o, body) {
      if (o.cost && !self) throw new Error(`效果「${o.label}」有費用，但沒有對應的卡`);
      return {
        label: o.label,
        mandatory: o.mandatory,
        mark: o.mark,
        available: () => here() && (!o.when || o.when()) && (!o.cost || canPay(g, p, o.cost)),
        *run(confirmed) {
          if (o.cost) {
            if (!(yield* optionalPay(g, p, self!, o.cost, !confirmed))) return;
          } else if (o.confirm && !confirmed && !(yield* confirm(g, p, o.confirm))) {
            return;
          }
          const r = body();
          if (r) yield* r;
        },
      };
    },
  };
}

// 窗口選單的順序：裝備、經驗、角色，再依登記順序，與遷移前相同
const PLACE_ORDER: Place[] = ['gear', 'exp', 'char', 'combat', 'pursuit', 'lasting', 'buff', 'hand', 'deck', 'discard', 'rage'];

export interface Registry {
  /** 依常駐位置、再依登記順序排列 */
  readonly ordered: readonly EffectSource[];
  readonly byId: ReadonlyMap<string, EffectSource>;
  has(id: string): boolean;
}

/** 登記表：重複的 id 在建立時丟錯 */
export function createRegistry(sources: readonly EffectSource[]): Registry {
  const byId = new Map<string, EffectSource>();
  for (const s of sources) {
    if (byId.has(s.id)) throw new Error(`效果來源重複登記：${s.id}`);
    byId.set(s.id, s);
  }
  const rank = new Map(sources.map((s, i) => [s, i]));
  const ordered = [...sources].sort(
    (a, b) => PLACE_ORDER.indexOf(a.at) - PLACE_ORDER.indexOf(b.at) || rank.get(a)! - rank.get(b)!,
  );
  return { ordered, byId, has: (id) => byId.has(id) };
}

// 各查詢的合併方式
type Fold<K extends QueryKey> = { init: () => Queries[K]; add: (acc: Queries[K], x: QueryContribution[K]) => Queries[K] };
const sum = { init: () => 0, add: (a: number, x: number) => a + x };
const FOLD: { [K in QueryKey]: Fold<K> } = {
  openingDraw: sum,
  drawPhaseExtra: sum,
  skipDrawPhase: { init: () => false, add: (a, x) => a || x },
  aimLimit: sum,
  aimLevel: sum,
  pursuitBonus: sum,
  flatAtk: sum,
  flatDef: sum,
  vanillaBoost: sum,
  combatBonus: {
    init: () => ({ atk: 0, def: 0, pursuitDef: 0 }),
    add: (a, x) => ({ atk: a.atk + (x.atk ?? 0), def: a.def + (x.def ?? 0), pursuitDef: a.pursuitDef + (x.pursuitDef ?? 0) }),
  },
};

type AnyFn = (...a: never[]) => unknown;
const split = (spec: unknown): { run: AnyFn; lasting: boolean } =>
  typeof spec === 'function' ? { run: spec as AnyFn, lasting: false } : { run: (spec as { run: AnyFn }).run, lasting: true };

/** 這位玩家身上，這個條目此刻有哪些實例；null 表示沒有對應的卡（角色或 lasting） */
function instances(src: EffectSource, g: GameCtx, p: PlayerId): (CardInst | null)[] {
  if (src.at === 'lasting') return [null];
  if (src.at === 'char') return g.state.players[p].charId === src.id ? [null] : [];
  return Z(g, p, src.at).filter((c) => c.id === src.id && !(src.at === 'exp' && c.covered));
}

const hereOf = (src: EffectSource, self: CardInst | null) => (): boolean =>
  self === null || (self.zone === src.at && !(src.at === 'exp' && self.covered));

export interface Effects {
  /** 這個時機、這位玩家此刻可發動的效果（不結算）。要與其他窗口合併，或測試時使用 */
  windowEffects<K extends EventKey>(g: GameCtx, p: PlayerId, key: K | readonly K[], ...arg: FireArgList<K>): WindowEffect[];
  /**
   * 開該時機的觸發窗口並結算；沒有效果時不產生任何提示。
   * 同時發生的幾個時機傳陣列，例如先手出招同時是先手出招時與打出時，它們的效果進同一個窗口，標題取第一個。
   */
  fire<K extends EventKey>(g: GameCtx, p: PlayerId, key: K | readonly K[], ...arg: FireArgList<K>): Gen;
  /** 雙方各開一次，先攻方先。參數可依玩家而異 */
  fireEach<K extends EventKey>(g: GameCtx, key: K, ...arg: [arg?: FireArgs[K] | ((p: PlayerId) => FireArgs[K])]): Gen;
  query<K extends QueryKey>(g: GameCtx, p: PlayerId, key: K, ...args: QueryArgs[K]): Queries[K];
  moveRules(cardId: string): Readonly<MoveRules>;
  hasEffect(id: string): boolean;
  /**
   * 這張卡有沒有放在經驗區的效果（表側在經驗區時才有效果）。畫面高亮與高利貸數張數以此為準。
   * 一張卡的效果登記在單一放置位置；將來若有卡同時有經驗效果與其他位置的效果，要先擴充登記表，一致性測試會提醒
   */
  hasExpEffect(id: string): boolean;
}

export function createEffects(sources: readonly EffectSource[]): Effects {
  const registry = createRegistry(sources);
  // 各時機、各查詢有哪些條目，登記後不會變，第一次問到時建立
  const indexed = new Map<string, EffectSource[]>();
  const listeners = (kind: 'on' | 'ask', key: string): EffectSource[] => {
    const k = `${kind}:${key}`;
    let list = indexed.get(k);
    if (!list) indexed.set(k, (list = registry.ordered.filter((s) => s[kind]?.[key as never])));
    return list;
  };

  /** awakeSeen 的邊緣偵測：由未覺醒變成覺醒才算進入覺醒。每次呼叫都會更新偵測狀態 */
  function awakeningEdge(g: GameCtx, p: PlayerId): boolean {
    const now = awakened(g, p);
    const was = g.state.awakeSeen[p];
    g.state.awakeSeen[p] = now;
    return now && !was;
  }

  function gather(g: GameCtx, p: PlayerId, key: EventKey, arg: unknown): WindowEffect[] {
    const out: WindowEffect[] = [];
    const add = (o: Offer) => {
      if (!o) return;
      if (Array.isArray(o)) out.push(...(o as WindowEffect[]));
      else out.push(o as WindowEffect);
    };
    const call = (run: AnyFn, self: CardInst | null, here: () => boolean, extra: object) =>
      add((run as (c: object) => Offer)({ ...makeCtx(g, p, self, here), ...extra }));

    const subjectsOf = SUBJECTS[key] as ((a: unknown) => CardInst[]) | undefined;
    if (subjectsOf) {
      // 主體型：只問主體那張卡自己的條目，不看它所在的區域
      for (const card of subjectsOf(arg)) {
        const spec = registry.byId.get(card.id)?.on?.[key];
        if (spec) call(split(spec).run, card, () => true, { card });
      }
      return out;
    }
    for (const src of listeners('on', key)) {
      const { run, lasting } = split(src.on![key]);
      for (const self of lasting ? [null] : instances(src, g, p)) call(run, self, hereOf(src, self), (arg ?? {}) as object);
    }
    return out;
  }

  function windowEffects(g: GameCtx, p: PlayerId, keyOrKeys: EventKey | readonly EventKey[], arg?: unknown): WindowEffect[] {
    if (Array.isArray(keyOrKeys)) return (keyOrKeys as EventKey[]).flatMap((k) => windowEffects(g, p, k, arg));
    const key = keyOrKeys as EventKey;
    // 爆發後的窗口也收覺醒時的效果；偵測要在每次都做，才不會漏掉進入覺醒的那一次
    if (key === 'afterBurst') {
      const out = gather(g, p, 'afterBurst', arg);
      if (awakeningEdge(g, p)) out.push(...gather(g, p, 'onAwaken', {}));
      return out;
    }
    if (key === 'onAwaken') return awakeningEdge(g, p) ? gather(g, p, 'onAwaken', arg) : [];
    return gather(g, p, key, arg);
  }

  function* fire(g: GameCtx, p: PlayerId, keyOrKeys: EventKey | readonly EventKey[], arg?: unknown): Gen {
    const first = Array.isArray(keyOrKeys) ? (keyOrKeys as EventKey[])[0] : (keyOrKeys as EventKey);
    yield* triggerWindow(g, p, EVENT_TITLES[first], windowEffects(g, p, keyOrKeys, arg));
  }

  function* fireEach(g: GameCtx, key: EventKey, arg?: unknown): Gen {
    for (const p of order(g)) yield* fire(g, p, key, typeof arg === 'function' ? (arg as (p: PlayerId) => unknown)(p) : arg);
  }

  function query(g: GameCtx, p: PlayerId, key: QueryKey, ...args: unknown[]): unknown {
    const fold = FOLD[key] as Fold<QueryKey>;
    let acc: unknown = fold.init();
    for (const src of listeners('ask', key)) {
      const { run, lasting } = split(src.ask![key]);
      for (const self of lasting ? [null] : instances(src, g, p)) {
        const x = (run as (c: object, ...a: unknown[]) => unknown)(makeCtx(g, p, self, hereOf(src, self)), ...args);
        acc = fold.add(acc as never, x as never);
      }
    }
    return acc;
  }

  const moveCache = new Map<string, Readonly<MoveRules>>();
  function moveRules(cardId: string): Readonly<MoveRules> {
    const asMove = registry.byId.get(cardId)?.asMove;
    if (!asMove) return NO_MOVE_RULES;
    let r = moveCache.get(cardId);
    if (!r) moveCache.set(cardId, (r = Object.freeze({ ...NO_MOVE_RULES, ...asMove })));
    return r;
  }

  return { windowEffects, fire, fireEach, query, moveRules, hasEffect: registry.has, hasExpEffect: (id: string) => registry.byId.get(id)?.at === 'exp' } as unknown as Effects;
}

/**
 * 預設實例綁定 sources 的登記表。第一次使用時才建立，不在模組載入時建立：
 * 條目檔會匯入 cost，而 cost 又會匯入這裡，載入時就建立會踩到還沒載入完的條目。
 */
let shared: Effects | undefined;
const effects = (): Effects => (shared ??= createEffects(allSources()));

export const windowEffects: Effects['windowEffects'] = (g, p, key, ...arg) => effects().windowEffects(g, p, key, ...arg);
export const fire: Effects['fire'] = (g, p, key, ...arg) => effects().fire(g, p, key, ...arg);
export const fireEach: Effects['fireEach'] = (g, key, ...arg) => effects().fireEach(g, key, ...arg);
export const query: Effects['query'] = (g, p, key, ...args) => effects().query(g, p, key, ...args);
export const moveRules: Effects['moveRules'] = (cardId) => effects().moveRules(cardId);
/** 這個卡名或角色名有沒有實作效果，涵蓋招式、裝備、增益與角色 */
export const hasEffect = (id: string): boolean => effects().hasEffect(id);
export const hasExpEffect = (id: string): boolean => effects().hasExpEffect(id);
