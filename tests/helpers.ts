import { getCard } from '../src/data/cards';
import { Game } from '../src/engine/game';
import { newCard, Z, data, type GameCtx } from '../src/engine/ops';
import type { DeckSpec, GameSetup, PlayerId, StartPhase, ZoneName } from '../src/engine/types';
import { Match } from '../src/net/match';
import { presetDeck } from '../src/data/presetDecks';
import { 伏擊狀態 } from '../src/engine/sources/thief';

type Zones = Partial<Record<ZoneName, string[]>>;

/** 清空該玩家所有區域，改成指定內容（沒列出的區域為空） */
export function setZones(g: GameCtx, p: PlayerId, zones: Zones): void {
  const pl = g.state.players[p];
  for (const z of Object.keys(pl.zones) as ZoneName[]) pl.zones[z] = [];
  for (const [z, ids] of Object.entries(zones) as [ZoneName, string[]][]) {
    for (const id of ids) {
      // 以 ~ 開頭表示覆蓋中的經驗卡
      const covered = id.startsWith('~');
      const c = newCard(g, covered ? id.slice(1) : id, p, z);
      c.covered = covered;
    }
  }
}

export interface Scenario {
  chars?: [string, string];
  first?: PlayerId;
  /** 玩家 0 / 1 的各區域。未提供的玩家沿用預設牌組與起始手牌。 */
  p0?: Zones;
  p1?: Zones;
  seed?: number;
  /** 錄製動畫影格 */
  animate?: boolean;
  /** 指定起始階段；沒指定時從先手步驟開始，讓戰鬥相關測試不必理會回合前段的階段 */
  phase?: StartPhase;
  /** 不指定起始階段，照正式對局從第 1 回合的回合開始走（略過抽牌與爆發） */
  fullGame?: boolean;
  /** 僅執行指定階段 */
  singlePhase?: boolean;
}

const FILLER = Array.from({ length: 20 }, () => '黑桃1');

/** 以指定情境建立遊戲。若指定區域卻沒給 deck，會補上 20 張填充牌避免意外歸零。 */
export function scenario(s: Scenario = {}): Game {
  return new Game(scenarioSetup(s));
}

function scenarioSetup(s: Scenario): GameSetup {
  const [a, b] = s.chars ?? ['勇者', '刺客'];
  const decks: [DeckSpec, DeckSpec] = [
    { charId: a, cards: presetDeck(a) },
    { charId: b, cards: presetDeck(b) },
  ];
  return {
    decks, first: s.first ?? 0, seed: s.seed ?? 1, animate: s.animate,
    startPhase: s.phase ?? (s.fullGame ? undefined : '先手'),
    singlePhase: s.singlePhase,
    afterSetup: (g) => {
      if (s.p0) setZones(g, 0, { deck: FILLER, ...s.p0 });
      if (s.p1) setZones(g, 1, { deck: FILLER, ...s.p1 });
    },
  };
}

/** 以指定情境建立對局（一律錄製影格） */
export function matchScenario(s: Scenario = {}): Match {
  const { decks, animate: _animate, ...setup } = scenarioSetup(s);
  return new Match(decks, setup);
}

export const names = (g: Game, p: PlayerId, z: ZoneName) => Z(g, p, z).map((c) => data(c).name);

/** 以選項文字回應目前提示（同名多張時取第一個） */
export function pick(g: Game, ...labels: string[]): void {
  const req = g.pending!;
  const used = new Set<string>();
  const keys = labels.map((label) => {
    const o = req.options.find((x) => x.label === label && !used.has(x.key));
    if (!o) throw new Error(`提示「${req.title}」沒有選項「${label}」，現有：${req.options.map((x) => x.label).join('、')}`);
    used.add(o.key);
    return o.key;
  });
  g.submit(req.player, keys);
}

/** 對選填提示回覆「不選」 */
export function pass(g: Game): void {
  g.submit(g.pending!.player, []);
}

/** 把不會產生提示的 Gen 跑完並回傳結果；中途要提示就丟錯 */
export function drive<T>(gen: Generator<unknown, T, string[]>): T {
  const r = gen.next([]);
  if (!r.done) throw new Error('預期不會有提示，卻要求了回應');
  return r.value;
}

export const title = (g: Game) => g.pending?.title ?? '(無提示)';

/** 卡片攻擊／防禦（直接讀卡表，數值調整時測試不用跟著改） */
export const atkOf = (id: string) => getCard(id).atk;
export const defOf = (id: string) => getCard(id).def;
/** 盾擊在最上方時，戰鬥區的招式卡攻擊力至少是原始防禦力 */
export const liftedAtkOf = (id: string) => Math.max(getCard(id).atk, getCard(id).def);

/**
 * 冰霜護甲的情境：玩家 0（法師）已打出冰霜護甲在最上方，玩家 1（勇者）手上有黑桃9，總攻擊另加 3，
 * 停在玩家 1 的反擊步驟。pick(g, '黑桃9') 之後，玩家 0 就在傷害計算時的窗口，可以發動冰霜護甲。
 * p0 是玩家 0 的牌區（手牌預設只有冰霜護甲）。
 */
export function armorScenario(p0: Zones = {}, extra: Partial<Scenario> = {}): Game {
  const g = scenario({
    chars: ['法師', '勇者'],
    p0: { hand: ['冰霜護甲'], rage: Array(5).fill('黑桃1'), ...p0 },
    p1: { hand: ['黑桃9'] },
    singlePhase: true,
    ...extra,
  });
  伏擊狀態.of(g, 1).atk = 3;
  return g;
}
