import type { GameView } from './view';

type Pair = [number, number];

/** 相鄰兩個影格之間，各項數值的變化（後 − 前，以玩家編號為索引） */
export interface StatChanges {
  /** 生命＝牌組張數 */
  life: Pair;
  rage: Pair;
  exp: Pair;
  /** 依目前戰鬥區算出的總攻擊、總防禦 */
  atk: Pair;
  def: Pair;
  /** 增益的持續時間指示物：卡片實體編號 → 差值（只列有變動的） */
  buff: Record<number, number>;
}

export function statChanges(prev: GameView, next: GameView): StatChanges {
  const per = (f: (p: GameView['players'][0]) => number): Pair => [
    f(next.players[0]) - f(prev.players[0]),
    f(next.players[1]) - f(prev.players[1]),
  ];
  const buff: Record<number, number> = {};
  for (const p of [0, 1] as const) {
    const before = new Map(prev.players[p].buff.map((c) => [c.uid, c.counters]));
    for (const c of next.players[p].buff) {
      const d = c.counters - (before.get(c.uid) ?? c.counters);
      if (d !== 0) buff[c.uid] = d;
    }
  }
  return {
    life: per((p) => p.deckCount),
    rage: per((p) => p.rage.length),
    exp: per((p) => p.exp.length),
    atk: per((p) => p.atk),
    def: per((p) => p.def),
    buff,
  };
}
