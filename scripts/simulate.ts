import { presetDeck, PRESET_CHARACTER_IDS } from '../src/data/presetDecks';
import { playOut } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import { Rng } from '../src/engine/rng';

const perPair = Number(process.argv[2] ?? 30);
const ids = PRESET_CHARACTER_IDS;
const wins: Record<string, { win: number; games: number }> = {};
for (const id of ids) wins[id] = { win: 0, games: 0 };

let games = 0, draws = 0, unfinished = 0, turns = 0, steps = 0;
const errors: string[] = [];

for (const a of ids) {
  for (const b of ids) {
    for (let i = 0; i < perPair; i++) {
      const seed = (games + 1) * 7919;
      const decks = [
        { charId: a, cards: presetDeck(a) },
        { charId: b, cards: presetDeck(b) },
      ] as const;
      try {
        const game = new Game({ decks: [decks[0], decks[1]], seed });
        const r = playOut(game, new Rng(seed ^ 0x9e3779b9), [decks[0].cards.length, decks[1].cards.length]);
        games++;
        steps += r.steps;
        turns += game.state.turn;
        if (!r.finished) {
          unfinished++;
          errors.push(`未結束：${a} vs ${b} seed=${seed}`);
          continue;
        }
        wins[a].games++;
        wins[b].games++;
        if (game.state.winner === 'draw') draws++;
        else wins[game.state.winner === 0 ? a : b].win++;
      } catch (e) {
        games++;
        errors.push(`${a} vs ${b} seed=${seed}：${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
      }
    }
  }
}

console.log(`共 ${games} 局，平手 ${draws}，未結束 ${unfinished}，錯誤 ${errors.length}`);
console.log(`平均回合數 ${(turns / games).toFixed(1)}，平均提示數 ${(steps / games).toFixed(0)}`);
for (const id of ids) {
  const w = wins[id];
  console.log(`${id.padEnd(4, '　')} 勝率 ${((w.win / w.games) * 100).toFixed(1)}%（${w.win}/${w.games}）`);
}
if (errors.length) {
  console.log('--- 錯誤（前 10 筆）');
  console.log(errors.slice(0, 10).join('\n'));
  process.exit(1);
}
