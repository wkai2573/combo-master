import { getCard } from '../data/cards';
import { GameOver, Z, log, mark, pname, type GameCtx } from './ops';
import { other, type PlayerId } from './types';

/**
 * 勝負判定：牌組歸零者落敗。
 * 同時歸零 → 手牌多者勝 → 雙方洗勻怒氣區並逐張翻開，連擊值大者勝（同值繼續翻）。
 * 有結果時設定 winner 並丟出 GameOver 中斷流程。
 */
export function checkWin(g: GameCtx): void {
  const dead = [0, 1].filter((p) => Z(g, p as PlayerId, 'deck').length <= 0) as PlayerId[];
  if (dead.length === 0) return;
  const s = g.state;
  if (dead.length === 1) {
    finish(g, other(dead[0]), `${pname(g, dead[0])} 的牌組歸零`);
  }
  log(g, '雙方牌組同時歸零，比較手牌張數');
  const h0 = Z(g, 0, 'hand').length;
  const h1 = Z(g, 1, 'hand').length;
  if (h0 !== h1) finish(g, h0 > h1 ? 0 : 1, `手牌 ${h0} 對 ${h1}`);

  log(g, '手牌相同，雙方洗勻怒氣區並翻牌比較連擊值');
  const a = g.rng.shuffle([...Z(g, 0, 'rage')]);
  const b = g.rng.shuffle([...Z(g, 1, 'rage')]);
  let i = 0;
  for (;;) {
    if (i >= a.length || i >= b.length) {
      if (i >= a.length && i >= b.length) {
        s.winner = 'draw';
        s.winReason = '怒氣區翻牌仍分不出勝負';
        s.phase = '結束';
        log(g, '平手');
        mark(g, '平手', { type: 'gameEnd', winner: 'draw' });
        throw new GameOver();
      }
      finish(g, i >= a.length ? 1 : 0, '怒氣區先翻完者落敗');
    }
    const ca = getCard(a[i].id).combo;
    const cb = getCard(b[i].id).combo;
    log(g, `翻開怒氣：${getCard(a[i].id).name}(${ca}) 對 ${getCard(b[i].id).name}(${cb})`);
    if (ca !== cb) finish(g, ca > cb ? 0 : 1, `怒氣區連擊值 ${ca} 對 ${cb}`);
    i++;
  }
}

function finish(g: GameCtx, winner: PlayerId, reason: string): never {
  g.state.winner = winner;
  g.state.winReason = reason;
  g.state.phase = '結束';
  log(g, `${pname(g, winner)} 獲勝（${reason}）`);
  mark(g, `${pname(g, winner)} 獲勝（${reason}）`, { type: 'gameEnd', winner });
  throw new GameOver();
}
