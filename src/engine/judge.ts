import {
  data, log, mark, move, pname, Z, type GameCtx, type Gen,
} from './ops';
import { fire } from './effects';
import { scripts } from './scripts';
import { other, type CardInst, type PlayerId } from './types';

// ───────────────────────── 範圍內／追擊判定 ─────────────────────────

/** 該卡是否在 p 的「範圍內」：雙方戰鬥區最後一張招式的連擊值（含）之間 */
export function inRange(g: GameCtx, p: PlayerId, c: CardInst): boolean {
  const mine = Z(g, p, 'combat');
  const opp = Z(g, other(p), 'combat');
  if (mine.length === 0 || opp.length === 0) return true;
  const m = data(mine[mine.length - 1]).combo;
  const o = data(opp[opp.length - 1]).combo;
  const v = data(c).combo;
  return v >= Math.min(m, o) && v <= Math.max(m, o);
}

export function* becomePursuitCard(g: GameCtx, p: PlayerId, card: CardInst): Gen {
  move(g, card, 'pursuit');
  g.state.flags.pursuitSuccess[p]++;
  log(g, `追擊成功：【${data(card).name}】成為追擊卡`);
  mark(g, `追擊成功！【${data(card).name}】成為追擊卡（攻擊 +${data(card).atk}）`,
    { type: 'flipResult', player: p, cardId: card.id, ok: true });
  yield* fire(g, p, 'onPursuitCard', { card });
}

/** 對 card 做追擊判定。回傳是否成功。 */
export function* judge(g: GameCtx, p: PlayerId, card: CardInst): Gen<boolean> {
  const cd = data(card);
  const isMove = cd.kind === 'move';
  const desc = isMove ? `（連擊值 ${cd.combo}）` : '（非招式卡）';

  log(g, `${pname(g, p)} 追擊判定：翻開【${cd.name}】${desc}`);
  mark(g, `${pname(g, p)} 追擊判定：翻開【${cd.name}】${desc}`,
    { type: 'flip', player: p, cardId: card.id });

  const success = isMove && !scripts[card.id]?.pursuitFail && !inRange(g, p, card);
  if (success) {
    yield* becomePursuitCard(g, p, card);
    return true;
  }
  log(g, '追擊判定失敗，該卡加入手中');
  move(g, card, 'hand');
  const failReason = isMove
    ? `【${cd.name}】的連擊值 ${cd.combo} 在範圍內`
    : `【${cd.name}】為非招式卡`;
  mark(g, `追擊失敗：${failReason}，加入手中`,
    { type: 'flipResult', player: p, cardId: card.id, ok: false });
  return false;
}
