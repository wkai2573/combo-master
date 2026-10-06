import { getCard } from '../src/data/cards';
import { Game } from '../src/engine/game';
import { newCard, Z, data, type GameCtx } from '../src/engine/ops';
import type { DeckSpec, PlayerId, ZoneName } from '../src/engine/types';
import { presetDeck } from '../src/data/presetDecks';

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
  /** 指定起始階段 */
  phase?: import('../src/engine/types').Phase;
  /** 僅執行指定階段 */
  singlePhase?: boolean;
}

const FILLER = Array.from({ length: 20 }, () => '黑桃1');

/** 以指定情境建立遊戲。若指定區域卻沒給 deck，會補上 20 張填充牌避免意外歸零。 */
export function scenario(s: Scenario = {}): Game {
  const [a, b] = s.chars ?? ['勇者', '刺客'];
  const decks: [DeckSpec, DeckSpec] = [
    { charId: a, cards: presetDeck(a) },
    { charId: b, cards: presetDeck(b) },
  ];
  return new Game({
    decks, first: s.first ?? 0, seed: s.seed ?? 1, animate: s.animate,
    startPhase: s.phase,
    singlePhase: s.singlePhase,
    afterSetup: (g) => {
      if (s.p0) setZones(g, 0, { deck: FILLER, ...s.p0 });
      if (s.p1) setZones(g, 1, { deck: FILLER, ...s.p1 });
    },
  });
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

export const title = (g: Game) => g.pending?.title ?? '(無提示)';

/** 卡片攻擊／防禦（直接讀卡表，數值調整時測試不用跟著改） */
export const atkOf = (id: string) => getCard(id).atk;
export const defOf = (id: string) => getCard(id).def;
