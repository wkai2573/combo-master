import type { CheatSnapshot } from '../engine/cheat';
import { Game } from '../engine/game';
import type { DeckSpec, GameSetup, PlayerId, Request } from '../engine/types';
import { frameFor, viewFor, type Frame, type GameView } from '../engine/view';
import { CheatHub } from './cheatHub';
import type { CheatOp } from './protocol';

/** 一位玩家這一次要看到的東西：自己的視角、要播的影格，以及雙方的作弊開關與自己的作弊檢視 */
export interface SeatUpdate {
  view: GameView;
  frames: Frame[];
  cheatOn: [boolean, boolean];
  /** 只有開啟作弊的那一方有 */
  cheatSnap: CheatSnapshot | null;
}

/** 玩家 A、玩家 B 的更新，由同一次變化同時產生 */
export type MatchUpdate = [SeatUpdate, SeatUpdate];

/** 提交或作弊操作的結果：error 是 null 表示成功；被拒絕時 update 是現況，不帶影格 */
export interface MatchResult {
  error: string | null;
  update: MatchUpdate;
}

/**
 * 一場對局：持有引擎與作弊狀態的一方（單機或房主）用它來推進遊戲。
 * 每個變更方法都回傳兩位玩家的更新，因為影格取走一次就清空，兩邊必須同時產生。
 * 玩家以編號指定：房主是 0，訪客是 1；呼叫端依連線身分決定，這裡不信任任何自稱。
 * 機器人、離線判負與網路都不在這裡。
 */
export class Match {
  private game: Game;
  private hub: CheatHub;

  /** setup 讓測試指定先攻、亂數種子與開局後的場面；影格一律錄製 */
  constructor(decks: [DeckSpec, DeckSpec], setup: Omit<GameSetup, 'decks' | 'animate'> = {}) {
    this.game = new Game({ ...setup, decks, animate: true });
    this.hub = new CheatHub(this.game);
  }

  get over(): boolean {
    return this.game.over;
  }

  /** 目前等待回應的提示；機器人據此決定出招 */
  get pending(): Request | null {
    return this.game.pending;
  }

  /** 取走自上次以來的變化；開局時用它拿第一批影格 */
  flush(): MatchUpdate {
    const raw = this.game.drainFrames();
    return this.update((p) => raw.map((f) => frameFor(f, p)));
  }

  /** 現況視角，不帶影格也不取走尚未取走的影格；補送用 */
  snapshot(): MatchUpdate {
    return this.update(() => []);
  }

  /** by 回應目前的提示；不合法時桌面不變，也不取走影格 */
  submit(by: PlayerId, keys: string[]): MatchResult {
    return this.attempt(() => this.game.submit(by, keys));
  }

  /** player 認輸或離線：對手獲勝 */
  forfeit(player: PlayerId, reason: string): MatchUpdate {
    this.game.forfeit(player, reason);
    return this.flush();
  }

  /** by 開關自己的作弊模式 */
  cheatSwitch(by: PlayerId, on: boolean): MatchUpdate {
    this.hub.setOn(by, on);
    return this.flush();
  }

  /** by 的作弊操作；沒開作弊模式或操作不合法時被拒絕 */
  cheat(by: PlayerId, op: CheatOp): MatchResult {
    return this.attempt(() => this.hub.apply(by, op));
  }

  /** 玩家自己的作弊檢視，每次都即時讀取 */
  cheatSnapshot(player: PlayerId): CheatSnapshot | null {
    return this.hub.snapshotFor(player);
  }

  /** 執行一個可能被拒絕的操作：成功就取走影格，失敗就回現況 */
  private attempt(run: () => string | null | void): MatchResult {
    let error: string | null;
    try {
      error = run() ?? null;
    } catch (e) {
      error = (e as Error).message;
    }
    return { error, update: error ? this.snapshot() : this.flush() };
  }

  private update(framesOf: (p: PlayerId) => Frame[]): MatchUpdate {
    const seat = (p: PlayerId): SeatUpdate => ({
      view: viewFor(this.game, p), frames: framesOf(p),
      cheatOn: [...this.hub.on], cheatSnap: this.hub.snapshotFor(p),
    });
    return [seat(0), seat(1)];
  }
}
