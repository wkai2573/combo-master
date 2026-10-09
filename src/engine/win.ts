import { GameOver, Z, log, mark, pname, type GameCtx } from './ops';
import { other, type PlayerId } from './types';

/**
 * 勝負判定：牌組歸零者落敗。
 * 同時歸零 → 手牌多者勝 → 手牌相同則平手。
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

  s.winner = 'draw';
  s.winReason = `手牌同為 ${h0} 張`;
  s.phase = '結束';
  log(g, '平手');
  mark(g, '平手', { type: 'gameEnd', winner: 'draw' });
  throw new GameOver();
}

function finish(g: GameCtx, winner: PlayerId, reason: string): never {
  g.state.winner = winner;
  g.state.winReason = reason;
  g.state.phase = '結束';
  log(g, `${pname(g, winner)} 獲勝（${reason}）`);
  mark(g, `${pname(g, winner)} 獲勝（${reason}）`, { type: 'gameEnd', winner });
  throw new GameOver();
}
