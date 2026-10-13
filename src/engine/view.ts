import { resolveCombatStats } from './combat';
import type { Game } from './game';
import { faceVisibleTo } from './visibility';
import type { CardInst, FrameFx, GameState, PlayerId, Request, Phase, ZoneName } from './types';

/** 玩家看到的卡：id 為 null 表示看不到內容（對手的手牌、雙方的怒氣、對手裏側的經驗） */
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

/** 手機版面以牌堆呈現的牌區頂牌：經驗堆是最後放進去的那張，裝備增益堆是裝備加增益排好後的最後一張；沒有牌就沒有頂牌 */
export function pileTop(pv: PlayerView, zone: 'exp' | 'gear'): CardView | null {
  const cards = zone === 'exp' ? pv.exp : [...pv.gear, ...pv.buff];
  return cards[cards.length - 1] ?? null;
}

/** 經驗區的張數：表側幾張、總共幾張（裏側的牌也算在總數裡，雙方都看得到張數與是否裏側） */
export function expCounts(pv: PlayerView): { faceUp: number; total: number } {
  return { faceUp: pv.exp.filter((c) => !c.covered).length, total: pv.exp.length };
}

/** 一方的戰鬥區：招式卡疊在前、追擊卡疊接在後，由先到後；pursuitFrom 是第一張追擊卡的位置（沒有追擊卡就等於張數） */
export function combatCards(pv: PlayerView): { cards: CardView[]; pursuitFrom: number } {
  return { cards: [...pv.moves, ...pv.pursuit], pursuitFrom: pv.moves.length };
}

export interface GameView {
  me: PlayerId;
  players: [PlayerView, PlayerView];
  first: PlayerId;
  /** 開局的先攻方；舊版房主送來的視角沒有這個欄位 */
  openingFirst?: PlayerId;
  turn: number;
  phase: Phase;
  log: string[];
  winner: PlayerId | 'draw' | null;
  winReason: string;
  /** 對局期間是否有任何一方開過作弊模式 */
  cheated: boolean;
  /** 是否因玩家離線或認輸而結束 */
  forfeited: boolean;
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
    openingFirst: s.openingFirst,
    turn: s.turn,
    phase: s.phase,
    log: withLog ? s.log.slice() : [],
    winner: s.winner,
    winReason: s.winReason,
    cheated: s.cheated,
    forfeited: s.forfeited,
    prompt: pending && pending.player === viewer ? pending : null,
    waitingFor: pending ? pending.player : null,
  };
}
