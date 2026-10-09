import { resolveCombatStats } from './combatStats';
import type { Game } from './game';
import { faceVisibleTo } from './visibility';
import type { CardInst, FrameFx, GameState, PlayerId, Request, Phase, ZoneName } from './types';

/** 玩家看到的卡：id 為 null 表示看不到內容（對手的手牌、怒氣、裏側的經驗） */
export interface CardView {
  uid: number;
  id: string | null;
  covered: boolean;
  counters: number;
}

export interface PlayerView {
  charId: string;
  deckCount: number;
  hand: CardView[];
  discard: CardView[];
  rage: CardView[];
  exp: CardView[];
  moves: CardView[];
  pursuit: CardView[];
  gear: CardView[];
  buff: CardView[];
  /** 本回合是否已收招 */
  passed: boolean;
  /** 依目前戰鬥區即時計算的總攻擊／總防禦 */
  atk: number;
  def: number;
}

export interface GameView {
  me: PlayerId;
  players: [PlayerView, PlayerView];
  first: PlayerId;
  turn: number;
  phase: Phase;
  log: string[];
  winner: PlayerId | 'draw' | null;
  winReason: string;
  /** 需要我回應的提示 */
  prompt: Request | null;
  /** 正在等待哪位玩家（我或對手）；遊戲結束為 null */
  waitingFor: PlayerId | null;
}

/** 一個動畫影格（某位玩家視角） */
export interface Frame {
  view: GameView;
  /** 此影格時紀錄的長度，介面據此顯示「到這一步為止」的紀錄 */
  logLen: number;
  caption: string;
  fx: FrameFx;
  ms: number;
}

/** 引擎錄下的影格：同時含雙方視角 */
export interface RawFrame {
  views: [GameView, GameView];
  logLen: number;
  caption: string;
  fx: FrameFx;
  ms: number;
}

export const frameFor = (f: RawFrame, viewer: PlayerId): Frame => ({
  view: f.views[viewer], logLen: f.logLen, caption: f.caption, fx: f.fx, ms: f.ms,
});

const hide = (c: CardInst): CardView => ({ uid: c.uid, id: null, covered: c.covered, counters: c.counters });
export const show = (c: CardInst): CardView => ({ uid: c.uid, id: c.id, covered: c.covered, counters: c.counters });

function playerView(game: Game, p: PlayerId, viewer: PlayerId): PlayerView {
  const s: GameState = game.state;
  const z = s.players[p].zones;
  const list = (name: ZoneName) => z[name].map((c) => (faceVisibleTo(c, viewer) ? show(c) : hide(c)));
  const stats = resolveCombatStats(game, p);
  return {
    charId: s.players[p].charId,
    deckCount: z.deck.length,
    hand: list('hand'),
    discard: list('discard'),
    rage: list('rage'),
    exp: list('exp'),
    moves: list('moves'),
    pursuit: list('pursuit'),
    gear: list('gear'),
    buff: list('buff'),
    passed: s.passed[p],
    atk: stats.atk,
    def: stats.def,
  };
}

/** withLog=false 時不複製紀錄（動畫影格用，紀錄改用 logLen 截取） */
export function viewFor(game: Game, viewer: PlayerId, withLog = true): GameView {
  const s = game.state;
  const pending = game.pending;
  return {
    me: viewer,
    players: [playerView(game, 0, viewer), playerView(game, 1, viewer)],
    first: s.first,
    turn: s.turn,
    phase: s.phase,
    log: withLog ? s.log.slice() : [],
    winner: s.winner,
    winReason: s.winReason,
    prompt: pending && pending.player === viewer ? pending : null,
    waitingFor: pending ? pending.player : null,
  };
}
