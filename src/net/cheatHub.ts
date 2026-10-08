import type { CheatSnapshot } from '../engine/cheat';
import type { Game } from '../engine/game';
import type { PlayerId } from '../engine/types';
import type { CheatOp } from './protocol';

/**
 * 一局遊戲的作弊狀態與操作入口，由持有引擎的一方（單機或房主）使用。
 * 房主自己的操作與訪客傳來的訊息都從這裡執行：操作者由呼叫端依連線身分指定，這裡檢查該玩家有開作弊模式，
 * 被拒絕時回傳原因，不改動任何東西。開關只存在這個物件，下一局重新建立就會重置。
 */
export class CheatHub {
  /** 各玩家是否開啟作弊模式 */
  readonly on: [boolean, boolean] = [false, false];

  constructor(private game: Game) {}

  /** 開關自己的作弊模式。狀態沒變就什麼都不做 */
  setOn(by: PlayerId, on: boolean): void {
    if (this.game.over || this.on[by] === on) return;
    this.on[by] = on;
    this.game.cheatSwitch(by, on);
  }

  /** 執行 by 的作弊操作；成功回傳 null，否則是被拒絕的原因 */
  apply(by: PlayerId, op: CheatOp): string | null {
    if (!this.on[by]) return '作弊模式沒有開啟';
    try {
      switch (op?.k) {
        case 'add':
          this.game.cheatAdd(by, op.target, op.cardId);
          break;
        case 'remove':
          this.game.cheatRemove(by, op.target, op.uid);
          break;
        case 'reorder':
          this.game.cheatReorder(by, op.target, op.zone, op.uids);
          break;
        case 'delete':
          this.game.cheatDelete(by, op.target, op.zone, op.uid);
          break;
        case 'insert':
          this.game.cheatInsert(by, op.target, op.zone, op.cardId);
          break;
        case 'flip':
          this.game.cheatFlip(by, op.target, op.uid);
          break;
        default:
          return '作弊操作不合法';
      }
    } catch (e) {
      return (e as Error).message;
    }
    return null;
  }

  /** 作弊檢視只給開啟作弊的那一方；沒開就是 null，另一方的視角不受影響 */
  snapshotFor(viewer: PlayerId): CheatSnapshot | null {
    return this.on[viewer] ? this.game.cheatSnapshot() : null;
  }
}
